"use strict";

/* LA COURBE DE PROGRESSION DE LA CONFRÉRIE, dans la vue Boss.

   Le regroupement par semaine est tenu par `tests/boss-serie-hebdo.test.js`.
   Ce parcours prouve ce que seul un navigateur montre : que la courbe
   n'apparaît qu'à partir de DEUX semaines rapportées — en dessous, elle ne
   dirait rien de plus que la case « Meilleur score » juste au-dessus —,
   qu'elle porte un point par semaine avec son équivalent textuel, et qu'elle
   tient à 360 px sans élargir la page.

   `CAPTURES=<dossier>` enregistre en plus une capture, pour relire le rendu
   à l'œil. */

const assert = require("node:assert/strict");
const path = require("node:path");
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

async function ouvrirBoss(page){
  await page.evaluate(() => {
    const ancre = document.createElement("a");
    ancre.href = "#boss";
    ancre.dataset.appRoute = "";
    document.body.appendChild(ancre);
    ancre.dispatchEvent(new MouseEvent("click", {
      bubbles:true, cancelable:true, button:0
    }));
    ancre.remove();
  });
  await page.locator("#view-boss .boss-grid").waitFor({ state:"visible" });
}

/* Une run archivée avec son rapport, `reculDeSemaines` semaines avant la
   semaine courante — dont on relit la date plutôt que de la recalculer. */
async function poserUneRun(page, reculDeSemaines, score){
  await page.evaluate(({ recul, valeur }) => {
    const state = window.__fakeSupabaseState;
    const courante = state.boss_sessions.find(g => g.status === "open").week_start;
    const date = new Date(courante+"T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - 7 * recul);
    const semaine = date.toISOString().slice(0,10);
    const id = "run-recul-"+recul;
    const fin = new Date(semaine+"T20:00:00Z");
    fin.setUTCDate(fin.getUTCDate() + 1);
    state.boss_sessions.push({
      id, created_by:"user-1", title:"Groupe 1",
      boss_name:"Akumu, bête démoniaque", session_date:semaine,
      week_start:semaine, slot:1, run_no:1, elements:[],
      status:"archived", created_at:semaine+"T09:00:00.000Z",
      completed_at:fin.toISOString()
    });
    state.boss_run_reports.push({
      session_id:id, global_score:valeur, note:"",
      created_by:"user-1", created_by_pseudo:"Yannis",
      created_at:fin.toISOString(), updated_by:null,
      updated_by_pseudo:null, updated_at:null
    });
    window.__fakeSupabaseEmit("boss_run_reports", "INSERT");
  }, { recul:reculDeSemaines, valeur:score });
  await page.waitForTimeout(600);
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const captures = process.env.CAPTURES || "";
  const errors = [];

  try{
    const page = await browser.newPage({ viewport:{ width:1280, height:1000 } });
    page.on("pageerror", error => errors.push(error.message));
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await connecter(page);
    await ouvrirBoss(page);

    const bloc = page.locator("#bossBody .boss-progression");

    /* Aucun rapport : rien à tracer, et surtout pas une courbe plate à zéro. */
    assert.equal(await bloc.count(), 0,
      "sans aucun rapport, la progression ne s'affiche pas");

    /* Une seule semaine : la case « Meilleur score » le dit déjà. */
    await poserUneRun(page, 2, "212000000");
    assert.equal(await bloc.count(), 0,
      "une seule semaine rapportée n'apprend rien de plus qu'un chiffre");

    /* Deux semaines : la courbe apparaît. */
    await poserUneRun(page, 1, "228500000");
    await bloc.waitFor({ state:"visible" });
    await bloc.locator("svg.score-chart").waitFor();
    assert.equal(await bloc.locator("ol.score-chart-points li").count(), 2,
      "un point par semaine dans l'équivalent textuel");

    await poserUneRun(page, 0, "255500000");
    assert.equal(await bloc.locator("ol.score-chart-points li").count(), 3);

    const texte = await bloc.textContent();
    assert.match(texte, /Progression de la confrérie/);
    assert.match(texte, /Record\s*:\s*255\s500\s000/,
      "le résumé donne le record de l'historique");
    assert.match(texte, /Semaine du/,
      "chaque point est daté par sa semaine, pas par un jour");

    /* L'aria-label promet une liste chiffrée : elle doit exister. */
    const etiquette = await bloc.locator("svg.score-chart").getAttribute("aria-label");
    assert.match(etiquette, /listées sous la courbe/);

    if(captures){
      await bloc.screenshot({ path:path.join(captures, "boss-progression-bureau.png") });
    }

    /* 360 px : rien ne déborde. */
    await page.setViewportSize({ width:360, height:900 });
    await page.waitForTimeout(400);
    const debordement = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    assert.ok(debordement <= 0,
      "la page ne doit pas s'élargir à 360 px ("+debordement+" px)");
    if(captures){
      await bloc.screenshot({ path:path.join(captures, "boss-progression-mobile.png") });
    }

    /* La courbe n'est pas une carte de session : « Mon suivi » et la
       restitution du focus cherchent `data-session-id`. */
    assert.equal(await page.locator(".boss-progression [data-session-id]").count(), 0);

    assert.deepEqual(errors, [], "aucune erreur JavaScript");
    console.log("PASS progression du boss : seuil de deux semaines, un point par semaine, 360 px");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
