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
    const cartes = page.locator("#trainingBody li.boss-run-card");
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

    /* La modale garde ses actions atteignables à 320 px, même pour une grande
       confrérie : seul son corps défile, jamais la page verrouillée. */
    await page.evaluate(() => {
      const s = window.__fakeSupabaseState;
      for(let n = 4; n <= 10; n++) s.profiles.push({
        id:"user-"+n, pseudo:"Membre "+n, membre:true, admin:false
      });
    });
    await page.setViewportSize({ width:320, height:480 });
    await page.locator("#trainingAdd").click();
    await page.locator("#trainingOverlay").waitFor({ state:"visible" });
    await page.locator("#trainingSubmit").scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => {
      const action = document.querySelector("#trainingSubmit").getBoundingClientRect();
      const overlay = document.querySelector("#trainingOverlay").getBoundingClientRect();
      return action.top >= overlay.top && action.bottom <= overlay.bottom;
    }), true, "les actions restent atteignables dans la modale");
    /* La note facultative est partie en ligne écrasée sur deux pixels : son
       `<textarea>` n'héritait d'aucune hauteur, faute de reprendre la classe
       du rapport de boss. Personne ne pouvait y écrire, et aucun test ne le
       voyait — le CSS était muet, pas cassé. On mesure donc les deux notes
       du site à l'écran, et on exige qu'elles se ressemblent. */
    const noteEntrainement = await page.locator("#trainingNote").boundingBox();
    assert.ok(noteEntrainement.height >= 80,
      "la note d’entraînement doit être une vraie zone de saisie ("
      + Math.round(noteEntrainement.height) + " px)");
    assert.ok(noteEntrainement.width >= 240,
      "la note d’entraînement doit occuper la largeur du formulaire");

    await page.locator("#trainingClose").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });

    /* La modale ouverte fige la page (`body.modal-locked`, position:fixed +
       overflow:hidden) : une assertion de débordement prise pendant qu'elle
       est ouverte passerait quoi qu'il arrive. Elle porte donc sur les trois
       sous-vues, modale FERMÉE, y compris le corps qui défile réellement. */
    for(const vue of ["historique", "progression", "classement"]){
      await page.locator(`[data-training-vue="${vue}"]`).click();
      await page.locator(`[data-training-vue="${vue}"][aria-pressed="true"]`).waitFor();
      const debordement = await page.evaluate(() => {
        const corps = document.querySelector("#trainingBody");
        return {
          page:document.documentElement.scrollWidth <= innerWidth,
          corps:corps.scrollWidth <= corps.clientWidth
        };
      });
      assert.equal(debordement.page, true,
        "pas de débordement horizontal à 320 px (" + vue + ", modale fermée)");
      assert.equal(debordement.corps, true,
        "#trainingBody ne déborde pas à 320 px (" + vue + ")");
    }
    await page.locator('[data-training-vue="historique"]').click();

    await page.setViewportSize({ width:1280, height:900 });

    /* Deux ouvertures concurrentes : la plus ancienne ne peut pas repeindre
       la correction qui vient d'être demandée après elle. */
    const demandes = await page.evaluate(() => ({
      ajout:window.__fakeSupabaseQueueProfileRead(),
      correction:window.__fakeSupabaseQueueProfileRead()
    }));
    await page.locator("#trainingAdd").click();
    await page.waitForFunction(id => window.__fakeSupabaseProfileReadClaimed(id), demandes.ajout);
    await page.locator('.training-edit[data-training-run-id="tr-1"]').click();
    await page.waitForFunction(id => window.__fakeSupabaseProfileReadClaimed(id), demandes.correction);
    assert.equal(await page.evaluate(id => window.__fakeSupabaseReleaseQueuedProfileRead(id),
      demandes.correction), true);
    await page.locator("#trainingOverlay").waitFor({ state:"visible" });
    assert.equal(await page.locator("#trainingScore").inputValue(), "9007199254740993");
    assert.equal(await page.evaluate(id => window.__fakeSupabaseReleaseQueuedProfileRead(id),
      demandes.ajout), true);
    await page.waitForTimeout(250);
    assert.match(await page.locator("#trainingTitle").textContent(), /Corriger/,
      "une ouverture périmée ne remplace pas la cible courante");
    assert.equal(await page.locator("#trainingScore").inputValue(), "9007199254740993");
    await page.locator("#trainingClose").click();

    /* --- Saisie : Yannis (coché d'office) + Merlin, équipes et score. --- */
    await page.locator("#trainingAdd").click();
    await page.locator("#trainingOverlay").waitFor({ state:"visible" });
    const moi = page.locator('#trainingMembers input[data-member-id="user-1"]');
    assert.equal(await moi.isChecked(), true);
    assert.equal(await moi.isDisabled(), true, "on ne se retire pas de sa propre saisie");
    await page.locator('#trainingMembers input[data-member-id="user-2"]').check();
    await page.locator('#trainingTeams select[data-team-for="user-1"]').selectOption("team-own");
    await page.locator('#trainingTeams select[data-team-for="user-2"]').selectOption("team-other");
    await page.locator("#trainingScore").fill("abc");
    await page.locator("#trainingSubmit").click();
    assert.match(await page.locator("#trainingError").textContent(), /score/i);
    await page.locator("#trainingScore").fill("1 234 567");
    await page.locator("#trainingNote").fill("Avec Merlin");
    await page.locator("#trainingSubmit").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });

    const nouvelle = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_training_runs.find(r => r.note === "Avec Merlin"));
    assert.equal(nouvelle.global_score, "1234567");
    assert.equal(nouvelle.equipes["user-2"].snapshot.id, "team-other",
      "l'instantané est construit côté serveur depuis l'équipe choisie");
    await page.locator(`li.boss-run-card[data-training-run-id="${nouvelle.id}"]`).waitFor();

    /* --- Correction : conflit RÉEL sur le jeton `updated_at`, pas le
       raccourci synthétique `trainingConflictOnce` (retiré du faux : il
       court-circuitait avant que matchRow() ne lise `updated_at`, et un
       `.eq("updated_at", jeton)` oublié dans le store aurait laissé ce test
       vert). On ouvre la modale — elle capture le jeton courant — puis on
       modifie la ligne dans le faux Supabase comme si Merlin venait de
       sauvegarder, et on soumet depuis la modale déjà ouverte. */
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    await page.locator("#trainingOverlay").waitFor({ state:"visible" });
    await page.evaluate(id => {
      const s = window.__fakeSupabaseState;
      const ligne = s.boss_training_runs.find(r => r.id === id);
      ligne.updated_at = "2026-09-22T10:59:59.999999+00:00";
      ligne.updated_by_pseudo = "Merlin";
    }, nouvelle.id);
    await page.locator("#trainingScore").fill("2000000");
    await page.locator("#trainingSubmit").click();
    assert.match(await page.locator("#trainingError").textContent(), /modifiée/i);
    assert.match(await page.locator("#trainingError").textContent(), /Merlin/,
      "le message de conflit nomme qui a sauvegardé en dernier");
    await page.locator("#trainingClose").click();
    /* --- Succès : la même correction, rejouée avec le jeton à jour. --- */
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    await page.locator("#trainingScore").fill("2000000");
    await page.locator("#trainingSubmit").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });
    assert.match(await page.locator(`li.boss-run-card[data-training-run-id="${nouvelle.id}"]`)
      .textContent(), /2\s?000\s?000/);

    /* Une équipe supprimée n'est plus proposée : l'absence affichée est aussi
       la valeur sauvegardée, afin de pouvoir réellement l'effacer. */
    await page.evaluate(() => {
      const s = window.__fakeSupabaseState;
      s.teams = s.teams.filter(team => team.id !== "team-other");
    });
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    assert.equal(await page.locator('#trainingTeams select[data-team-for="user-2"]').inputValue(), "");
    await page.locator("#trainingSubmit").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });
    assert.equal(await page.evaluate(id =>
      window.__fakeSupabaseState.boss_training_runs.find(run => run.id === id).equipes["user-2"].teamId,
      nouvelle.id), null, "une équipe archivée est bien retirée de la correction");

    /* --- Suppression, avec confirmation. --- */
    page.once("dialog", dialogue => dialogue.accept());
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    await page.locator("#trainingDelete").click();
    await page.locator(`li.boss-run-card[data-training-run-id="${nouvelle.id}"]`)
      .waitFor({ state:"detached" });

    /* Un ancien participant reste coché et son instantané est conservé même
       s'il ne remonte plus dans le registre actuel des membres. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles.find(profile => profile.id === "user-2").membre = false;
    });
    await page.locator('.training-edit[data-training-run-id="tr-1"]').click();
    const ancien = page.locator('#trainingMembers input[data-member-id="user-2"]');
    assert.equal(await ancien.isChecked(), true);
    await page.locator("#trainingSubmit").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });
    assert.equal(await page.evaluate(() =>
      window.__fakeSupabaseState.boss_training_runs.find(run => run.id === "tr-1").participants.includes("user-2")),
    true, "un participant historique n'est jamais retiré silencieusement");

    /* --- Progression : trois points (tr-1, tr-2, tr-3), valeurs
       lisibles hors de la courbe. Aucune requête en changeant de sous-vue. --- */
    await page.waitForTimeout(800);
    const appelsAvant = await page.evaluate(() => window.__fakeSupabaseState.calls.length);
    await page.locator('[data-training-vue="progression"]').click();
    await page.locator("svg.training-chart").waitFor();
    assert.equal(await page.locator("ol.training-points li").count(), 3);
    await page.locator("#trainingProgressionMember").selectOption("user-1");
    assert.equal(await page.locator("ol.training-points li").count(), 1);
    assert.match(await page.locator(".training-summary").textContent(), /Meilleur/);
    /* dessinerEntrainement() vide #trainingBody et reconstruit ce <select> :
       sans re-focus explicite, le focus tombe sur body (même piège que les
       filtres du roster, voir AGENTS.md). */
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id),
      "trainingProgressionMember", "le focus reste sur le filtre après le changement");

    /* --- Classement : tr-1 en tête ; comparaison d'équipes de Yannis. --- */
    await page.locator('[data-training-vue="classement"]').click();
    assert.equal(await page.locator("ol.boss-run-cards li").first()
      .getAttribute("data-training-run-id"), "tr-1");
    await page.locator("#trainingCompareMember").selectOption("user-1");
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id),
      "trainingCompareMember", "le focus reste sur le filtre après le changement");
    assert.equal(await page.locator("table.training-compare tbody tr").count(), 1);
    assert.match(await page.locator(".training-compare-caveat").textContent(),
      /score est celui du groupe/);
    assert.equal(await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      appelsAvant, "changer de sous-vue ne doit faire aucune requête");

    /* Au clavier : Tab jusqu'à « Historique », Entrée. */
    await page.locator('[data-training-vue="historique"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator('[data-training-vue="historique"]')
      .getAttribute("aria-pressed"), "true");

    console.log("PASS entrainement : navigation et historique");
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(erreur => { console.error(erreur); process.exit(1); });
