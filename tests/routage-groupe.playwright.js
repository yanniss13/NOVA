"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { serveRepo } = require("./helpers/serve");

async function activeView(page){
  return page.locator(".view.active").getAttribute("id");
}

async function signIn(page){
  await page.locator("#authOverlay").waitFor({ state:"visible" });
  await page.locator("#authEmail").fill("yannis@example.test");
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
  await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();
}

async function openAppFragment(page, fragment){
  await page.evaluate(value => {
    const anchor = document.createElement("a");
    anchor.href = value;
    anchor.dataset.appRoute = "";
    document.body.appendChild(anchor);
    anchor.dispatchEvent(new MouseEvent("click", {
      bubbles:true,
      cancelable:true,
      button:0
    }));
    anchor.remove();
  }, fragment);
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const context = await browser.newContext({
    permissions:["clipboard-read", "clipboard-write"]
  });
  const errors = [];

  try{
    const publicPage = await context.newPage();
    publicPage.on("pageerror", error => errors.push(error.message));
    await installFakeSupabase(publicPage);
    await publicPage.goto(server.url + "/index.html#collection");
    await publicPage.locator("#view-collection.active").waitFor();
    assert.equal(await activeView(publicPage), "view-collection");
    assert.equal(await publicPage.evaluate(() => location.hash), "#collection");

    await publicPage.reload();
    await publicPage.locator("#view-collection.active").waitFor();
    assert.equal(await activeView(publicPage), "view-collection",
      "une vue publique directe doit survivre au rechargement");
    await publicPage.locator("#authOffline").click();

    await publicPage.locator('.tab[data-view="builder"]').click();
    await publicPage.locator("#view-builder.active").waitFor();
    assert.equal(await publicPage.evaluate(() => location.hash), "#builder");
    await publicPage.locator('.tab[data-view="wiki"]').click();
    await publicPage.locator("#view-wiki.active").waitFor();
    assert.equal(await publicPage.evaluate(() => location.hash), "#wiki");

    await publicPage.goBack();
    await publicPage.locator("#view-builder.active").waitFor();
    assert.equal(await publicPage.evaluate(() => location.hash), "#builder");
    await publicPage.goForward();
    await publicPage.locator("#view-wiki.active").waitFor();
    assert.equal(await publicPage.evaluate(() => location.hash), "#wiki");

    const protectedPage = await context.newPage();
    protectedPage.on("pageerror", error => errors.push(error.message));
    await installFakeSupabase(protectedPage);
    await protectedPage.goto(server.url + "/index.html#boss");
    await signIn(protectedPage);
    try{
      await protectedPage.waitForFunction(() =>
        document.querySelector(".view.active")?.id === "view-boss"
        && !!document.querySelector("#view-boss .boss-grid"), null,
      { timeout:10000 });
    }catch(error){
      const state = await protectedPage.evaluate(() => ({
        active:document.querySelector(".view.active")?.id || "",
        hash:location.hash,
        bossText:document.querySelector("#bossBody")?.textContent || ""
      }));
      throw new Error("route boss non reprise: " + JSON.stringify(state));
    }
    assert.equal(await activeView(protectedPage), "view-boss");
    assert.equal(await protectedPage.evaluate(() => location.hash), "#boss",
      "la connexion doit reprendre la route protégée au lieu du tableau de bord");

    const bossFixture = await protectedPage.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const openGroups = state.boss_sessions
        .filter(item => item.status === "open")
        .sort((a, b) => a.slot - b.slot);
      const group = openGroups[0];
      const emptyGroup = openGroups[1];
      const archivedGroup = openGroups[2];
      state.boss_participation.push(
        {
          session_id:group.id,
          owner:"user-1",
          pseudo:"Yannis",
          team_id:null,
          team_snapshot:null
        },
        {
          session_id:group.id,
          owner:"user-2",
          pseudo:"Merlin",
          team_id:null,
          team_snapshot:null
        }
      );
      archivedGroup.status = "archived";
      archivedGroup.completed_at = new Date().toISOString();
      return {
        group:{ id:group.id, title:group.title },
        emptyGroup:{ id:emptyGroup.id, title:emptyGroup.title },
        archivedGroup:{ id:archivedGroup.id, title:archivedGroup.title }
      };
    });
    await protectedPage.locator('.tab[data-view="boss"]').click();

    const groupCard = protectedPage.locator(
      `.boss-card[data-session-id="${bossFixture.group.id}"]`
    );
    await groupCard.waitFor();
    const analyseLink = groupCard.getByRole("link", { name:"Analyser ce groupe" });
    assert.equal(
      await analyseLink.getAttribute("href"),
      "#analyse/groupe/" + bossFixture.group.id
    );
    assert.equal(await analyseLink.getAttribute("aria-disabled"), "false");
    assert.equal(
      await groupCard.getByRole("button", { name:"Copier le lien" }).count(),
      1
    );

    const archivedCard = protectedPage.locator(
      `.boss-report-card[data-session-id="${bossFixture.archivedGroup.id}"]`
    );
    await archivedCard.waitFor();
    assert.equal(await archivedCard.getByText("Analyser ce groupe").count(), 0,
      "une archive ne doit pas analyser les rosters actuels");
    assert.equal(await archivedCard.getByText("Copier le lien").count(), 0,
      "une archive ne reçoit pas les actions des groupes ouverts");

    const emptyCard = protectedPage.locator(
      `.boss-card[data-session-id="${bossFixture.emptyGroup.id}"]`
    );
    const emptyAnalyse = emptyCard.getByRole("link", { name:"Analyser ce groupe" });
    assert.equal(await emptyAnalyse.getAttribute("aria-disabled"), "true");
    const hashBeforeDisabled = await protectedPage.evaluate(() => location.hash);
    await emptyAnalyse.click({ force:true });
    assert.equal(await protectedPage.evaluate(() => location.hash), hashBeforeDisabled,
      "un groupe vide ne doit pas ouvrir l'analyse");

    const beforeCopy = await protectedPage.evaluate(() => ({
      calls:window.__fakeSupabaseState.calls.length,
      rpcCalls:window.__fakeSupabaseState.rpcCalls.length,
      sessions:JSON.stringify(window.__fakeSupabaseState.boss_sessions),
      membership:JSON.stringify(window.__fakeSupabaseState.boss_participation)
    }));
    await groupCard.getByRole("button", { name:"Copier le lien" }).click();
    const expectedCopiedUrl = new URL(
      "#boss/groupe/" + bossFixture.group.id,
      protectedPage.url()
    ).href;
    assert.equal(
      await protectedPage.evaluate(() => navigator.clipboard.readText()),
      expectedCopiedUrl
    );
    const afterCopy = await protectedPage.evaluate(() => ({
      calls:window.__fakeSupabaseState.calls.length,
      rpcCalls:window.__fakeSupabaseState.rpcCalls.length,
      sessions:JSON.stringify(window.__fakeSupabaseState.boss_sessions),
      membership:JSON.stringify(window.__fakeSupabaseState.boss_participation)
    }));
    assert.deepEqual(afterCopy, beforeCopy,
      "copier un lien ne doit lire ni écrire les données Boss");

    await openAppFragment(
      protectedPage,
      "#boss/groupe/" + bossFixture.group.id
    );
    await protectedPage.waitForFunction(id =>
      document.activeElement?.dataset.bossAction === "analyse"
      && document.activeElement.closest("[data-session-id]")?.dataset.sessionId === id,
    bossFixture.group.id);
    assert.equal(await protectedPage.evaluate(() => location.hash),
      "#boss/groupe/" + bossFixture.group.id);

    await protectedPage.evaluate(id => {
      const state = window.__fakeSupabaseState;
      state.boss_sessions = state.boss_sessions.filter(item => item.id !== id);
      state.boss_participation = state.boss_participation.filter(
        item => item.session_id !== id
      );
    }, bossFixture.group.id);
    await openAppFragment(
      protectedPage,
      "#boss/groupe/" + bossFixture.group.id
    );
    await protectedPage.getByText(
      "Ce groupe n’est plus ouvert ou n’existe plus.",
      { exact:true }
    ).waitFor();

    const defaultPage = await context.newPage();
    defaultPage.on("pageerror", error => errors.push(error.message));
    await installFakeSupabase(defaultPage);
    await defaultPage.goto(server.url + "/index.html");
    await signIn(defaultPage);
    await defaultPage.locator("#view-dashboard.active").waitFor();
    assert.equal(await defaultPage.evaluate(() => location.hash), "#dashboard",
      "sans fragment, la connexion doit garder Mon suivi par défaut");

    assert.deepEqual(errors, [], "aucune erreur JavaScript pendant le routage");
    console.log("routage-groupe.playwright.js navigation OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
