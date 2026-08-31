"use strict";

/* REPARER UNE RUN DEJA TERMINEE.

   Ce parcours ne prouve PAS le droit — il vit dans le SQL, et
   `tests/boss-correction-schema.test.js` le lit. Il prouve ce que seul un
   navigateur montre : que les gestes de reparation existent a l'ecran sur une
   run ARCHIVEE d'une semaine PASSEE, et surtout qu'ils empruntent les portes
   de correction et non les portes ordinaires.

   Cette derniere confusion serait invisible en lecture de code — les deux
   familles de RPC ont la meme forme — et chaque clic echouerait en production
   sur RUN_ARCHIVED, alors que le faux serveur d'un test moins exigeant
   laisserait passer. On lit donc les noms d'appels reellement emis.

   L'administrateur du parcours n'a PAS participe a la run : c'est le cas qui
   compte, puisque c'est celui qu'aucun participant ne peut reparer. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

const RUN = "boss-run-a-reparer";

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

async function connecter(page, email){
  const modale = page.locator("#authOverlay");
  if(!(await modale.isVisible())) await page.locator("#accountLogin").click();
  await modale.waitFor({ state:"visible" });
  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
}

/* L'archive des semaines passees est repliee a l'ouverture. */
async function ouvrirArchive(page){
  const archive = page.locator("#bossBody .boss-archive:not(.boss-archive-current)");
  await archive.waitFor({ state:"visible" });
  if(!(await archive.evaluate(node => node.open))){
    await archive.locator("summary").click();
  }
  return archive;
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await page.locator("#authOverlay").waitFor({ state:"visible" });

    /* Une run terminee d'une SEMAINE PASSEE, ou seul Merlin a joue. Les deux
       verrous du schema sont donc reunis : statut archive et semaine revolue.
       Le drapeau d'administrateur se pose AVANT la connexion — `applySession`
       lit le profil une fois. */
    await page.evaluate(identifiant => {
      const state = window.__fakeSupabaseState;
      state.profiles[0].admin = true;
      state.boss_sessions.push({
        id:identifiant,
        created_by:"user-2",
        title:"Groupe 3",
        boss_name:"Akumu, bête démoniaque",
        session_date:"2026-07-20",
        week_start:"2026-07-20",
        slot:3,
        run_no:1,
        elements:[],
        status:"archived",
        created_at:"2026-07-20T09:00:00.000Z",
        completed_at:"2026-07-21T20:00:00.000Z"
      });
      state.boss_participation.push({
        session_id:identifiant,
        owner:"user-2",
        pseudo:"Merlin",
        team_id:null,
        team_snapshot:{ id:"snapshot-merlin", data:{ heroes:[] } },
        updated_at:"2026-07-20T09:10:00.000Z"
      });
      state.boss_run_reports.push({
        session_id:identifiant,
        global_score:1200,
        note:"Score recopié de travers.",
        created_by:"user-2",
        created_by_pseudo:"Merlin",
        created_at:"2026-07-21T20:05:00.000Z",
        updated_by:null,
        updated_by_pseudo:null,
        updated_at:null
      });
    }, RUN);

    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();
    await ouvrirBoss(page);
    await ouvrirArchive(page);

    const carte = page.locator('.boss-report-card[data-session-id="' + RUN + '"]');
    await carte.waitFor({ state:"visible" });

    /* ---- 1. Corriger le rapport d'une run ou l'on n'etait pas. ---- */

    const jyEtais = await page.evaluate(identifiant =>
      window.__fakeSupabaseState.boss_participation
        .some(item => item.session_id === identifiant && item.owner === "user-1"),
    RUN);
    assert.equal(jyEtais, false,
      "l'administrateur ne doit pas avoir participe : c'est tout l'enjeu");

    await carte.locator('[data-boss-action="report-edit"]').click();
    await page.locator("#bossReportOverlay").waitFor({ state:"visible" });
    await page.locator("#bossScore").fill("2400");
    await page.locator("#bossReportSubmit").click();
    await page.locator("#bossReportOverlay").waitFor({ state:"hidden" });

    const rapport = await page.evaluate(identifiant =>
      window.__fakeSupabaseState.boss_run_reports
        .find(item => item.session_id === identifiant),
    RUN);
    assert.equal(String(rapport.global_score), "2400",
      "la correction du score doit atteindre la base");
    assert.equal(rapport.updated_by, "user-1",
      "la correction doit porter le nom de qui l'a faite");

    /* ---- 2. Corriger l'equipe, par la porte de correction. ---- */

    await ouvrirArchive(page);
    const ligneMerlin = carte.locator(".boss-report-participant")
      .filter({ hasText:"Merlin" });
    await ligneMerlin.locator('[data-boss-action="correct-team"]').click();

    const listeEquipes = page.locator("#bossTeamList");
    await listeEquipes.locator(".boss-team-choice").first().waitFor();
    const titre = await page.locator("#bossTeamTitle").textContent();
    assert.match(titre, /Corriger l’équipe de Merlin/,
      "le titre doit dire qu'on repare, et nommer la personne");

    /* Meme exigence que sur un groupe ouvert : les equipes proposees sont
       celles DU MEMBRE, jamais celles de l'administrateur. */
    const proposees = await page.evaluate(() =>
      [...document.querySelectorAll("#bossTeamList .boss-team-choice")].length
    );
    assert.equal(proposees, 1, "seule l'équipe de Merlin doit être proposée");

    await listeEquipes.locator(".boss-team-choice").first().click();
    await page.locator("#bossTeamOverlay").waitFor({ state:"hidden" });

    const equipe = await page.evaluate(identifiant => {
      const ligne = window.__fakeSupabaseState.boss_participation
        .find(item => item.session_id === identifiant && item.owner === "user-2");
      return ligne ? ligne.team_id : null;
    }, RUN);
    assert.equal(equipe, "team-other",
      "l'équipe corrigée doit être celle du membre visé");

    /* ---- 3. Ajouter quelqu'un qui manquait. ---- */

    await ouvrirArchive(page);
    await carte.locator('[data-boss-action="correct-add"]').click();
    const listeMembres = page.locator("#bossMemberList");
    await listeMembres.locator(".boss-member-choice").first().waitFor();
    await listeMembres.getByText("Yannis", { exact:true }).click();
    await page.locator("#bossMemberOverlay").waitFor({ state:"hidden" });

    const ajoute = await page.evaluate(identifiant =>
      window.__fakeSupabaseState.boss_participation
        .some(item => item.session_id === identifiant && item.owner === "user-1"),
    RUN);
    assert.equal(ajoute, true, "l'ajout doit atteindre la run archivée");

    /* ---- 4. Retirer quelqu'un qui n'y etait pas. ---- */

    await ouvrirArchive(page);
    await carte.locator(".boss-report-participant").filter({ hasText:"Merlin" })
      .locator('[data-boss-action="correct-remove"]').click();
    await carte.locator(".boss-report-participant").filter({ hasText:"Merlin" })
      .waitFor({ state:"detached" });

    const restants = await page.evaluate(identifiant =>
      window.__fakeSupabaseState.boss_participation
        .filter(item => item.session_id === identifiant)
        .map(item => item.owner),
    RUN);
    assert.deepEqual(restants, ["user-1"], "le retrait doit atteindre la base");

    /* ---- 5. LES PORTES EMPRUNTEES. ---- */

    /* Le coeur du parcours. Les portes ordinaires refuseraient cette run par
       RUN_ARCHIVED et RUN_INVALID_WEEK : si l'un de ces noms apparait, l'ecran
       marche ici et casse en production. */
    const appels = await page.evaluate(() =>
      window.__fakeSupabaseState.rpcCalls.map(item => item.name)
    );
    [
      "admin_correct_boss_run_team",
      "admin_correct_boss_run_join",
      "admin_correct_boss_run_leave"
    ].forEach(nom => {
      assert.ok(appels.includes(nom), nom + " doit avoir été appelée");
    });
    [
      "admin_select_boss_team",
      "admin_join_boss_run",
      "admin_leave_boss_run"
    ].forEach(nom => {
      assert.ok(!appels.includes(nom),
        nom + " ne doit jamais servir sur une run terminée");
    });

    /* ---- 6. Un membre ordinaire ne repare rien. ---- */

    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles[0].admin = false;
    });
    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();
    await ouvrirBoss(page);
    await ouvrirArchive(page);
    await carte.waitFor({ state:"visible" });

    for(const action of ["correct-team", "correct-remove", "correct-add"]){
      assert.equal(
        await page.locator('[data-boss-action="' + action + '"]').count(), 0,
        "un membre sans droit ne doit pas se voir proposer « " + action + " »"
      );
    }

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log(
      "PASS boss-correction : un administrateur répare une run déjà terminée"
    );
  }finally{
    await browser.close();
    await server.close();
  }
})();
