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

async function openHistoryFragment(page, fragment){
  await page.evaluate(value => {
    history.pushState(null, "", value);
    window.dispatchEvent(new PopStateEvent("popstate"));
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
    await openAppFragment(protectedPage, "#boss");

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

    const analyseFixture = await protectedPage.evaluate(() => {
      const state = window.__fakeSupabaseState;
      const openGroups = state.boss_sessions
        .filter(item => item.status === "open")
        .sort((a, b) => a.slot - b.slot);
      const group = openGroups[0];
      const emptyGroup = openGroups[1];
      state.profiles.push(
        { id:"user-3", pseudo:"Escanor extérieur" },
        { id:"user-without-roster", pseudo:"Sans roster" }
      );
      state.roster_characters.push({
        owner:"user-3",
        char_id:"merlin",
        potential_tier:5,
        builds:{
          Livre:{
            weapon:"7ds-armes/Livre/Grimoire béni.webp",
            armor:{},
            jewel:{},
            note:""
          }
        },
        updated_at:"2026-08-18T08:00:00.000Z"
      });
      state.boss_participation = state.boss_participation.filter(
        item => item.session_id !== group.id && item.session_id !== emptyGroup.id
      );
      state.boss_participation.push(
        { session_id:group.id, owner:"user-1", pseudo:"Yannis" },
        { session_id:group.id, owner:"user-2", pseudo:"Merlin" },
        {
          session_id:group.id,
          owner:"user-without-roster",
          pseudo:"Sans roster"
        }
      );
      return {
        group:{ id:group.id, title:group.title, runNo:group.run_no || 1 },
        emptyGroup:{ id:emptyGroup.id },
        archivedGroupId:"" + state.boss_sessions.find(
          item => item.status === "archived"
        ).id
      };
    });

    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.group.id
    );
    await protectedPage.locator("#analysePanel-dps .matrix").waitFor();
    assert.equal(
      await protectedPage.locator("#analyseSubpage-dps").getAttribute("aria-pressed"),
      "true"
    );
    assert.equal(await protectedPage.locator("#analysePanel-dps").isVisible(), true);
    assert.equal(
      await protectedPage.locator("#analyseGroupTitle").textContent(),
      analyseFixture.group.title + " · Run " + analyseFixture.group.runNo
    );
    const groupBanner = protectedPage.locator(".analyse-group-context");
    assert.match(await groupBanner.textContent(), /3 participants/);
    assert.match(await groupBanner.textContent(), /1 sans roster exploitable/);
    assert.deepEqual(
      (await protectedPage.locator(
        "#analysePanel-dps .matrix-membre"
      ).allTextContents()).sort(),
      ["Merlin", "Tous", "Yannis"]
    );
    assert.equal(
      await protectedPage.locator(
        "#analysePanel-overview .analyse-summary-card"
      ).first().locator(".analyse-summary-value").textContent(),
      "2",
      "le résumé doit compter les rosters du groupe uniquement"
    );
    assert.doesNotMatch(
      await protectedPage.locator("#analyseBody").textContent(),
      /Escanor extérieur/,
      "les trois panneaux doivent exclure un roster extérieur au groupe"
    );

    await protectedPage.locator("#analysePanel-dps .matrix-membre", {
      hasText:/^Yannis$/
    }).click();
    assert.deepEqual(
      await protectedPage.locator(
        "#analysePanel-dps .matrix td.mx-player"
      ).allTextContents(),
      ["Yannis"],
      "le filtre manuel reste limité à la matrice"
    );
    assert.equal(
      await protectedPage.locator(
        "#analysePanel-overview .analyse-summary-card"
      ).first().locator(".analyse-summary-value").textContent(),
      "2",
      "filtrer la matrice ne doit pas modifier le résumé"
    );

    await protectedPage.evaluate(id => {
      const state = window.__fakeSupabaseState;
      state.boss_participation = state.boss_participation.filter(item =>
        item.session_id !== id || item.owner !== "user-2"
      );
      state.boss_participation.push({
        session_id:id,
        owner:"user-3",
        pseudo:"Escanor extérieur"
      });
    }, analyseFixture.group.id);
    await protectedPage.locator('.tab[data-view="wiki"]').click();
    await protectedPage.locator("#view-wiki.active").waitFor();
    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.group.id
    );
    await protectedPage.locator("#analysePanel-dps .matrix").waitFor();
    assert.deepEqual(
      (await protectedPage.locator(
        "#analysePanel-dps .matrix-membre"
      ).allTextContents()).sort(),
      ["Escanor extérieur", "Tous", "Yannis"],
      "une nouvelle ouverture doit relire les participants actuels"
    );

    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.emptyGroup.id
    );
    await protectedPage.getByText(
      "Ce groupe ne contient encore aucun participant.",
      { exact:true }
    ).waitFor();
    assert.equal(
      await protectedPage.locator("#analyseBody .matrix").count(),
      0,
      "un groupe vide ne doit pas retomber sur toute la confrérie"
    );

    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.archivedGroupId
    );
    await protectedPage.locator("#view-analyse.active").getByText(
      "Ce groupe n’est plus ouvert ou n’existe plus.",
      { exact:true }
    ).waitFor();
    assert.equal(
      await protectedPage.getByRole("link", { name:"Retour aux sessions" })
        .getAttribute("href"),
      "#boss"
    );

    await protectedPage.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"boss_participation",
        message:"lecture participation simulée"
      };
    });
    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.group.id
    );
    await protectedPage.getByText(
      "Impossible de lire les participants du groupe.",
      { exact:true }
    ).waitFor();
    assert.equal(
      await protectedPage.getByRole("link", { name:"Réessayer" })
        .getAttribute("href"),
      "#analyse/groupe/" + analyseFixture.group.id
    );

    await protectedPage.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"roster_characters",
        message:"lecture roster simulée"
      };
    });
    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.group.id
    );
    await protectedPage.getByText(
      "Données de roster indisponibles",
      { exact:true }
    ).waitFor();
    assert.doesNotMatch(
      await protectedPage.locator(".analyse-group-context").textContent(),
      /sans roster exploitable/,
      "une lecture en échec ne doit pas inventer des rosters manquants"
    );

    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.group.id
    );
    await protectedPage.locator(".analyse-group-context").waitFor();
    await protectedPage.getByRole("button", {
      name:"Toute la confrérie",
      exact:true
    }).click();
    await protectedPage.locator("#view-analyse.active").waitFor();
    assert.equal(await protectedPage.evaluate(() => location.hash), "#analyse");
    assert.equal(await protectedPage.locator(".analyse-group-context").count(), 0,
      "sortir du contexte doit effacer son bandeau");

    await openAppFragment(protectedPage, "#boss");
    const fallbackCopyCard = protectedPage.locator(".boss-card").filter({
      has:protectedPage.locator('.boss-analyse-link[aria-disabled="false"]')
    }).first();
    const fallbackGroupId = await fallbackCopyCard.getAttribute("data-session-id");
    await protectedPage.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", {
        configurable:true,
        value:()=>Promise.reject(new Error("clipboard simulé indisponible"))
      });
      window.__promptCall = null;
      window.prompt = (label, value) => {
        window.__promptCall = { label, value };
        return value;
      };
      const toast = document.querySelector("#toast");
      toast.textContent = "";
      toast.classList.remove("on");
    });
    await fallbackCopyCard.getByRole("button", { name:"Copier le lien" }).click();
    const fallbackPrompt = await protectedPage.evaluate(() => window.__promptCall);
    assert.deepEqual(fallbackPrompt, {
      label:"Copie ce lien",
      value:new URL("#boss/groupe/" + fallbackGroupId, protectedPage.url()).href
    });
    assert.doesNotMatch(await protectedPage.locator("#toast").textContent(), /copié/i,
      "un prompt de secours ne doit pas annoncer une copie réussie");

    const invalidFragments = [
      "#boss/groupe/",
      "#boss/groupe/a/b",
      "#analyse/groupe/%2F",
      "#analyse/groupe/" + "a".repeat(129),
      "#route-inconnue"
    ];
    for(const fragment of invalidFragments){
      const callCount = await protectedPage.evaluate(() =>
        window.__fakeSupabaseState.calls.length
      );
      await openHistoryFragment(protectedPage, fragment);
      await protectedPage.locator("#view-dashboard.active").waitFor();
      assert.equal(await protectedPage.evaluate(() => location.hash), "#dashboard");
      const targetedBossReads = await protectedPage.evaluate(start =>
        window.__fakeSupabaseState.calls.slice(start).filter(call =>
          call.table === "boss_sessions"
          && call.filters.some(([key]) => key === "id")
        ).length,
      callCount);
      assert.equal(targetedBossReads, 0,
        "une route invalide ne doit lancer aucune lecture ciblée de groupe");
    }

    for(const width of [320, 390]){
      await protectedPage.setViewportSize({ width, height:844 });
      await openAppFragment(
        protectedPage,
        "#boss/groupe/" + fallbackGroupId
      );
      await protectedPage.locator(
        `.boss-card[data-session-id="${fallbackGroupId}"]`
      ).waitFor();
      const bossMetrics = await protectedPage.evaluate(() => ({
        overflow:document.scrollingElement.scrollWidth
          - document.scrollingElement.clientWidth,
        heights:[...document.querySelectorAll(".boss-secondary-actions .btn")]
          .filter(node => node.getClientRects().length)
          .map(node => node.getBoundingClientRect().height)
      }));
      assert.ok(bossMetrics.overflow <= 1,
        `la route Boss ne doit pas déborder à ${width}px`);
      assert.ok(bossMetrics.heights.length > 0
        && bossMetrics.heights.every(height => height >= 43.5),
      `les actions Boss doivent mesurer 44px à ${width}px`);

      await openAppFragment(
        protectedPage,
        "#analyse/groupe/" + analyseFixture.group.id
      );
      await protectedPage.locator(".analyse-group-context").waitFor();
      const analyseMetrics = await protectedPage.evaluate(() => ({
        overflow:document.scrollingElement.scrollWidth
          - document.scrollingElement.clientWidth,
        heights:[...document.querySelectorAll(".analyse-group-context .btn")]
          .filter(node => node.getClientRects().length)
          .map(node => node.getBoundingClientRect().height)
      }));
      assert.ok(analyseMetrics.overflow <= 1,
        `la route Analyse ne doit pas déborder à ${width}px`);
      assert.ok(analyseMetrics.heights.length > 0
        && analyseMetrics.heights.every(height => height >= 43.5),
      `l'action Analyse doit mesurer 44px à ${width}px`);
    }
    await protectedPage.setViewportSize({ width:1280, height:900 });

    await openAppFragment(
      protectedPage,
      "#boss/groupe/" + fallbackGroupId
    );
    await openAppFragment(
      protectedPage,
      "#analyse/groupe/" + analyseFixture.group.id
    );
    await protectedPage.locator('.tab[data-view="wiki"]').click();
    await protectedPage.goBack();
    await protectedPage.locator("#view-analyse.active .analyse-group-context").waitFor();
    assert.equal(await protectedPage.evaluate(() => location.hash),
      "#analyse/groupe/" + analyseFixture.group.id);
    await protectedPage.goBack();
    await protectedPage.locator(
      `#view-boss.active .boss-card[data-session-id="${fallbackGroupId}"]`
    ).waitFor();
    assert.equal(await protectedPage.evaluate(() => location.hash),
      "#boss/groupe/" + fallbackGroupId);
    await protectedPage.goForward();
    await protectedPage.locator("#view-analyse.active .analyse-group-context").waitFor();

    const anonymousInvalidPage = await context.newPage();
    anonymousInvalidPage.on("pageerror", error => errors.push(error.message));
    await installFakeSupabase(anonymousInvalidPage);
    await anonymousInvalidPage.goto(server.url + "/index.html#boss/groupe/%2F");
    await anonymousInvalidPage.locator("#view-wiki.active").waitFor();
    assert.equal(
      await anonymousInvalidPage.evaluate(() => location.hash),
      "#wiki",
      "une route invalide anonyme doit se replier localement sur le Wiki"
    );
    assert.equal(
      await anonymousInvalidPage.evaluate(() =>
        window.__fakeSupabaseState.calls.filter(call =>
          call.table === "boss_sessions" || call.table === "boss_participation"
        ).length
      ),
      0
    );

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
