"use strict";

/* « MEILLEURES RUNS » DANS LA VUE BOSS.

   Le tri lui-meme est tenu par `tests/boss-meilleures-runs.test.js`. Ce
   parcours prouve ce que seul un navigateur montre : que le bloc s'affiche
   avec les equipes des participants, qu'il choisit la bonne periode tout
   seul, que changer de periode garde le focus, et qu'il tient a 360 px sans
   elargir la page.

   `CAPTURES=<dossier>` enregistre en plus deux captures d'ecran, pour relire
   le rendu a l'oeil. */

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

/* Les runs sont posees APRES l'ouverture : c'est elle qui cree les groupes de
   la semaine courante, dont on relit la date plutot que de la recalculer. */
async function poserDesRuns(page){
  await page.evaluate(() => {
    const state = window.__fakeSupabaseState;
    const semaine = state.boss_sessions.find(g => g.status === "open").week_start;
    const passee = new Date(semaine+"T00:00:00Z");
    passee.setUTCDate(passee.getUTCDate() - 7);
    const semainePassee = passee.toISOString().slice(0,10);
    const lendemain = jour => {
      const date = new Date(jour+"T20:00:00Z");
      date.setUTCDate(date.getUTCDate() + 1);
      return date.toISOString();
    };
    const equipe = (id, heros) => ({
      id, data:{ id, name:"", heroes:heros.map(char => ({ char })) }
    });
    const runs = [
      { id:"run-semaine-1", semaine, slot:2, score:"184250000",
        note:"Escanor en ouverture, Merlin garde son ultime pour la phase 2.",
        membres:[
          ["user-1", "Yannis", ["escanor", "merlin", "elizabeth", "ban"]],
          ["user-2", "Merlin", ["meliodas", "diane", "king", "gowther"]]
        ] },
      { id:"run-semaine-2", semaine, slot:4, score:"152900000", note:"",
        membres:[["user-2", "Merlin", ["tristan", "daisy", "slader", "elaine"]]] },
      { id:"run-passee", semaine:semainePassee, slot:1, score:"210000000",
        note:"Record de la confrérie.",
        membres:[["user-1", "Yannis", ["khala", "merlin", "escanor", "derieri"]]] }
    ];
    runs.forEach(run => {
      state.boss_sessions.push({
        id:run.id, created_by:"user-1", title:"Groupe "+run.slot,
        boss_name:"Akumu, bête démoniaque", session_date:run.semaine,
        week_start:run.semaine, slot:run.slot, run_no:1, elements:[],
        status:"archived", created_at:run.semaine+"T09:00:00.000Z",
        completed_at:lendemain(run.semaine)
      });
      run.membres.forEach(([owner, pseudo, heros]) => {
        state.boss_participation.push({
          session_id:run.id, owner, pseudo, team_id:null,
          team_snapshot:equipe("snap-"+run.id+"-"+owner, heros),
          updated_at:run.semaine+"T09:10:00.000Z"
        });
      });
      state.boss_run_reports.push({
        session_id:run.id, global_score:run.score, note:run.note,
        created_by:"user-1", created_by_pseudo:"Yannis",
        created_at:lendemain(run.semaine), updated_by:null,
        updated_by_pseudo:null, updated_at:null
      });
    });
    window.__fakeSupabaseEmit("boss_run_reports", "INSERT");
  });
}

const identifiantsAffiches = page => page.$$eval(
  ".boss-best-runs .boss-run-card",
  cartes => cartes.map(carte => carte.dataset.bestRunId)
);

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

    const bloc = page.locator("#bossBody .boss-best-runs");
    await bloc.waitFor({ state:"visible" });
    assert.match(await bloc.textContent(), /dès le premier rapport/,
      "sans aucun rapport, le bloc annonce ce qu'il montrera");

    await poserDesRuns(page);
    await page.locator(".boss-run-card").first().waitFor();

    /* La semaine a des rapports : c'est elle qui s'affiche d'abord. */
    assert.equal(
      await bloc.locator('[data-periode="week"]').getAttribute("aria-pressed"),
      "true"
    );
    assert.deepEqual(await identifiantsAffiches(page),
      ["run-semaine-1", "run-semaine-2"]);
    const premiere = bloc.locator(".boss-run-card").first();
    assert.match(await premiere.locator(".boss-run-card-score").textContent(),
      /184\s250\s000/);
    assert.equal(await premiere.locator(".boss-report-participant").count(), 2,
      "chaque participant de la run apparaît avec son équipe");
    assert.match(await premiere.textContent(), /Escanor en ouverture/);
    if(captures){
      await bloc.screenshot({ path:path.join(captures, "meilleures-runs-bureau.png") });
    }

    /* Toutes les semaines : la run passee prend la tete, et le focus reste. */
    const toutes = bloc.locator('[data-periode="all"]');
    await toutes.focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await identifiantsAffiches(page),
      ["run-passee", "run-semaine-1", "run-semaine-2"]);
    assert.equal(await toutes.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.evaluate(() => document.activeElement?.dataset.periode),
      "all",
      "changer de période ne doit pas faire perdre le focus"
    );
    assert.match(await bloc.locator(".boss-run-card").first().textContent(),
      /Semaine du/, "sur tout l'historique, chaque run dit sa semaine");

    /* Le choix survit a une relecture Realtime. */
    await page.evaluate(() => window.__fakeSupabaseEmit("boss_run_reports", "UPDATE"));
    await page.waitForTimeout(600);
    assert.equal(
      await page.locator('#bossBody .boss-best-runs [data-periode="all"]')
        .getAttribute("aria-pressed"),
      "true"
    );

    /* Ouvrir une equipe depuis le palmares. */
    await page.locator(".boss-run-card").first()
      .locator(".boss-report-team").first().click();
    await page.locator("#teamOverlay").waitFor({ state:"visible" });
    await page.keyboard.press("Escape");
    await page.locator("#teamOverlay").waitFor({ state:"hidden" });

    /* 360 px : rien ne deborde. */
    await page.setViewportSize({ width:360, height:900 });
    await page.waitForTimeout(200);
    const debordement = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    assert.ok(debordement <= 0, "la page ne doit pas s'élargir à 360 px ("+debordement+" px)");
    if(captures){
      await page.locator("#bossBody .boss-best-runs")
        .screenshot({ path:path.join(captures, "meilleures-runs-mobile.png") });
    }

    /* Le palmares ne doit jamais se faire passer pour une carte de session :
       « Mon suivi » et la restitution du focus cherchent `data-session-id`. */
    assert.equal(
      await page.locator(".boss-best-runs [data-session-id]").count(), 0
    );

    assert.deepEqual(errors, [], "aucune erreur JavaScript");
    console.log("PASS meilleures runs : période automatique, classement, équipes, focus, 360 px");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
