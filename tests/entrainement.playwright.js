"use strict";

/* L'onglet Entraînement du groupe Boss : navigation, historique, et (tâches
   suivantes) saisie, correction, conflit, progression, classement. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

async function connecter(page){
  await page.locator("#authOverlay").waitFor({ state:"visible" });
  await page.locator("#authEmail").fill("yannis@example.test");
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
  await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();
}

async function ouvrirEntrainement(page){
  await page.locator('.tabs .tab[data-view="roster"]').click();
  await page.locator('.subtabs .tab[data-view="training"]').click();
  await page.locator("#view-training").waitFor({ state:"visible" });
}

/* Trois runs posées directement dans la table simulée, au format SQL.
   tr-3 est poussée AVANT tr-2 et partage son `played_on` : la table simulée
   trie `.order("played_on")` de façon stable, donc l'ordre brut renvoyé par
   Supabase serait déjà [tr-3, tr-2, tr-1]. Seul le tri côté vue
   (`trierRunsEntrainement`, qui départage par `created_at` décroissant) peut
   produire [tr-2, tr-3, tr-1] : l'assertion d'ordre ne peut donc pas passer
   par accident si ce tri est cassé. */
async function poserDesRuns(page){
  await page.evaluate(() => {
    const s = window.__fakeSupabaseState;
    const equipe = (id, owner, chars) => ({ pseudo:owner === "user-1" ? "Yannis" : "Merlin",
      teamId:id, snapshot:{ id, owner, pseudo:"", data:{ id, name:"Compo",
        heroes:chars.map(char => ({ char })) } } });
    s.boss_training_runs.push(
      { id:"tr-1", played_on:"2026-09-18", global_score:"9007199254740993", note:"Premier essai",
        participants:["user-1","user-2"],
        equipes:{ "user-1":equipe("team-own","user-1",["meliodas","diane"]),
                  "user-2":equipe("team-other","user-2",["merlin"]) },
        created_by:"user-1", created_by_pseudo:"Yannis", created_at:"2026-09-18T20:00:00Z",
        updated_by_pseudo:null, updated_at:"2026-09-18T20:00:00.000001+00:00" },
      { id:"tr-3", played_on:"2026-09-20", global_score:"50000", note:"",
        participants:["user-2"],
        equipes:{ "user-2":{ pseudo:"Merlin", teamId:null, snapshot:null } },
        created_by:"user-2", created_by_pseudo:"Merlin", created_at:"2026-09-20T08:00:00Z",
        updated_by_pseudo:null, updated_at:"2026-09-20T08:00:00.000001+00:00" },
      { id:"tr-2", played_on:"2026-09-20", global_score:"120000", note:"",
        participants:["user-2"],
        equipes:{ "user-2":{ pseudo:"Merlin", teamId:null, snapshot:null } },
        created_by:"user-2", created_by_pseudo:"Merlin", created_at:"2026-09-20T20:00:00Z",
        updated_by_pseudo:null, updated_at:"2026-09-20T20:00:00.000001+00:00" }
    );
  });
}

(async () => {
  const server = await serveRepo();
  const browser = await chromium.launch();
  try{
    const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html#training");
    await connecter(page);
    await poserDesRuns(page);
    await ouvrirEntrainement(page);

    /* Le sous-onglet appartient au groupe Boss et l'URL le nomme. */
    assert.equal(await page.locator('.subtabs .tab[data-view="training"]')
      .getAttribute("aria-selected"), "true");
    assert.match(page.url(), /#training$/);

    /* Historique : la plus récente d'abord ; à égalité de date jouée
       (tr-2/tr-3), la plus récemment créée d'abord ; score exact au-delà de
       2^53. */
    const cartes = page.locator("#trainingBody li.training-run");
    await cartes.first().waitFor();
    assert.deepEqual(
      await cartes.evaluateAll(n => n.map(x => x.dataset.trainingRunId)),
      ["tr-2", "tr-3", "tr-1"]);
    assert.match(await cartes.nth(2).textContent(), /9\s?007\s?199\s?254\s?740\s?993/);
    assert.match(await cartes.nth(0).textContent(), /Équipe non renseignée/);

    /* « Corriger » n'apparaît que pour un participant (user-1 est dans tr-1,
       pas dans tr-2). */
    assert.equal(await page.locator('.training-edit[data-training-run-id="tr-1"]').count(), 1);
    assert.equal(await page.locator('.training-edit[data-training-run-id="tr-2"]').count(), 0);

    /* Aucun débordement horizontal à 320 px. */
    await page.setViewportSize({ width:320, height:800 });
    assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth), true);

    console.log("PASS entrainement : navigation et historique");
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(erreur => { console.error(erreur); process.exit(1); });
