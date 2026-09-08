"use strict";

/* Un administrateur compose un groupe de boss à la place des membres.

   Ce parcours ne prouve PAS le droit — il vit dans le SQL, et
   `tests/boss-admin-schema.test.js` le lit. Il prouve ce que seul un
   navigateur montre : que les trois gestes existent à l'écran, qu'ils visent
   la bonne personne, et surtout que le choix d'équipe propose les équipes DU
   MEMBRE et non celles de l'administrateur.

   Cette dernière confusion serait invisible en lecture de code — les deux
   listes ont la même forme — et écrirait dans le roster une équipe que le
   membre n'a jamais construite. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

/* La vue des sessions de boss n'a pas d'onglet : elle s'atteint par la route.
   Un vrai clic sur une ancre `data-app-route`, comme le fait le site. */
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

    /* Le drapeau se pose AVANT la connexion : `applySession` lit le profil une
       fois, et le poser après laisserait la session sans droit. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles[0].admin = true;
    });
    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();

    await ouvrirBoss(page);

    const carte = page.locator(".boss-card").first();
    await carte.waitFor({ state:"visible" });

    /* ---- 1. Ajouter un membre qui n'est pas soi. ---- */

    const ajouter = carte.locator('[data-boss-action="admin-add"]');
    await ajouter.waitFor({ state:"visible" });
    await ajouter.click();

    const listeMembres = page.locator("#bossMemberList");
    await listeMembres.locator(".boss-member-choice").first().waitFor();

    /* L'invité n'a rien à faire dans cette liste : la RPC le refuserait par
       MEMBRE_REQUIS, autant ne pas le proposer. */
    const proposes = await listeMembres.locator(".boss-member-choice")
      .allTextContents();
    assert.ok(proposes.includes("Merlin"),
      "un membre de la confrérie doit être proposé");
    assert.ok(!proposes.includes("Invité"),
      "un invité ne doit jamais être proposé : l'ajout échouerait");

    await listeMembres.getByText("Merlin", { exact:true }).click();
    await page.locator("#bossMemberOverlay").waitFor({ state:"hidden" });

    const ligneMerlin = carte.locator(".boss-member").filter({ hasText:"Merlin" });
    await ligneMerlin.waitFor({ state:"visible" });

    const inscrit = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_participation
        .map(item => item.owner)
    );
    assert.ok(inscrit.includes("user-2"),
      "Merlin doit être inscrit en base, pas seulement à l'écran");
    assert.ok(!inscrit.includes("user-1"),
      "l'administrateur ne doit pas s'être inscrit lui-même au passage");

    /* ---- 2. Choisir SON équipe, pas celle de l'administrateur. ---- */

    await ligneMerlin.locator('[data-boss-action="team"]').click();
    const listeEquipes = page.locator("#bossTeamList");
    await listeEquipes.locator(".boss-team-choice").first().waitFor();

    const titre = await page.locator("#bossTeamTitle").textContent();
    assert.match(titre, /Merlin/,
      "le titre doit nommer la personne : deux modales identiques sinon");

    /* LE COEUR DU PARCOURS. `team-own` appartient à Yannis, `team-other` à
       Merlin. Proposer la première écrirait dans le roster de Merlin une
       équipe qu'il n'a jamais construite.

       On vérifie D'ABORD que le serveur en sert bien deux. Sans ce contrôle,
       « une seule équipe proposée » passerait aussi le jour où la lecture
       cesserait de rendre celles des autres — l'assertion serait vraie sans
       que le filtre ne serve plus à rien. */
    const equipesServies = await page.evaluate(() =>
      window.__fakeSupabaseState.teams.length
    );
    assert.equal(equipesServies, 2,
      "le serveur doit servir les équipes des deux membres, sinon le filtre "
        + "ci-dessous ne prouve rien");

    const equipesProposees = await page.evaluate(() =>
      [...document.querySelectorAll("#bossTeamList .boss-team-choice")].length
    );
    assert.equal(equipesProposees, 1,
      "seule l'équipe de Merlin doit être proposée");

    await listeEquipes.locator(".boss-team-choice").first().click();
    await page.locator("#bossTeamOverlay").waitFor({ state:"hidden" });

    const choisie = await page.evaluate(() => {
      const ligne = window.__fakeSupabaseState.boss_participation
        .find(item => item.owner === "user-2");
      return ligne ? ligne.team_id : null;
    });
    assert.equal(choisie, "team-other",
      "l'équipe enregistrée doit être celle du membre visé");

    /* ---- 3. Retirer, parce qu'une erreur doit pouvoir se défaire. ---- */

    await ligneMerlin.locator('[data-boss-action="admin-remove"]').click();
    await carte.locator(".boss-member").filter({ hasText:"Merlin" })
      .waitFor({ state:"detached" });

    const restants = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_participation.length
    );
    assert.equal(restants, 0, "le retrait doit atteindre la base");

    /* ---- 4. Un membre ordinaire ne voit rien de tout cela. ---- */

    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles[0].admin = false;
    });
    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();
    await ouvrirBoss(page);

    assert.equal(
      await page.locator('[data-boss-action="admin-add"]').count(), 0,
      "un membre sans droit ne doit pas se voir proposer l'ajout"
    );

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("PASS boss-admin : un administrateur compose un groupe pour autrui");
  }finally{
    await browser.close();
    await server.close();
  }
})();
