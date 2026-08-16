"use strict";

/* Les etats des deux recensements de l'Analyse qui dependent du reseau, et la
   possession par TENUE GRAVEE, qui ne se lit nulle part ailleurs.

   Le faux Supabase partage reproduit la chaine reelle `from().select()` et
   ses erreurs. Le rendu est exerce dans Chromium : ce test porte sur les
   classes et les libelles effectivement presentes dans l'onglet Analyse. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

async function ouvrirAnalyse(page){
  await page.locator('.tab[data-view="analyse"]').click();
  await page.locator("#analyseBody .debuff-row").first().waitFor();
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await page.locator("#authOverlay").waitFor({ state:"visible" });
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();

    /* Une lecture reussie et vide affirme que personne ne possede l'effet. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [];
    });
    await ouvrirAnalyse(page);
    const lignes = page.locator("#analyseBody .debuff-row");
    const nombreDeLignes = await lignes.count();
    assert.ok(nombreDeLignes > 0, "le catalogue doit rester visible sans roster");
    assert.equal(
      await page.locator("#analyseBody .debuff-row.db-absente").count(),
      nombreDeLignes,
      "une lecture vide doit griser chaque effet absent"
    );
    assert.equal(
      await page.getByText("Personne", { exact:true }).count(),
      nombreDeLignes,
      "une lecture vide doit annoncer une absence certaine"
    );

    /* Une erreur ne dit rien de la possession : elle ne doit pas ressembler
       au roster vide ci-dessus. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"roster_characters",
        message:"Echec roster simule"
      };
    });
    await ouvrirAnalyse(page);
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null
    );
    assert.equal(
      await page.locator("#analyseBody .debuff-row.db-absente").count(),
      0,
      "une lecture en erreur ne doit griser aucun effet"
    );
    assert.equal(
      await page.getByText("Porteurs indisponibles", { exact:true }).count(),
      nombreDeLignes,
      "une lecture en erreur doit signaler une possession inconnue"
    );
    assert.equal(
      await page.getByText("Personne", { exact:true }).count(),
      0,
      "une erreur ne doit jamais annoncer une absence certaine"
    );

    /* P0 est un potentiel renseigne, pas une valeur manquante. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"escanor",
        potential_tier:0,
        builds:{ "Epee 2 mains":{} },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);
    const escanor = page.locator("#analyseBody .debuff-row")
      .filter({ hasText:"Escanor" });
    assert.equal(await escanor.count(), 1, "Escanor doit avoir une ligne");
    assert.equal(
      await escanor.locator(".db-porteur").textContent(),
      "Yannis P0",
      "le potentiel zero doit etre affiche comme tout potentiel renseigne"
    );

    /* LE MEMBRE SOUTIEN-SEULEMENT, et c'est lui qui justifie tout le retrait
       du filtre DPS de rosterDerivedPlayers().

       King au Grimoire est de role Gardien : il ne produit aucune entree DPS,
       donc l'ancien filtre ecartait son proprietaire de l'analyse entiere.
       Il porte pourtant la Marque de la foret. Sans ce cas, rien ne verifiait
       que la vue passe bien la liste NON filtree au recensement - et la
       regression serait passee inapercue, le test P0 ci-dessus utilisant
       Escanor, qui est un DPS. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"king",
        potential_tier:6,
        builds:{ "Livre":{} },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);
    const king = page.locator("#analyseBody .debuff-row")
      .filter({ hasText:"King" });
    assert.equal(await king.count(), 1, "King doit avoir une ligne");
    assert.equal(
      await king.locator(".db-porteur").textContent(),
      "Yannis P6",
      "un membre sans aucun DPS doit tout de meme etre compte comme porteur"
    );
    assert.equal(
      await king.locator(".db-personne").count(),
      0,
      "sa ligne ne doit plus annoncer une absence"
    );
    /* Et la consigne reste : sans aucun DPS, l'onglet doit encore dire quoi
       faire, au lieu d'aligner des sections vides. */
    assert.equal(
      await page.getByText("Rien à analyser", { exact:true }).count(),
      0,
      "un roster non vide ne doit pas afficher l'etat vide"
    );

    /* Aucun roster du tout : la consigne revient, et le recensement reste. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [];
    });
    await ouvrirAnalyse(page);
    assert.equal(
      await page.getByText("Rien à analyser", { exact:true }).count(),
      1,
      "sans aucun roster, la consigne doit dire ou ajouter des personnages"
    );
    assert.ok(
      await page.locator("#analyseBody .debuff-row").count() > 0,
      "la consigne ne doit pas emporter le recensement avec elle"
    );

    /* LA POSSESSION PAR TENUE GRAVEE, qui n'obeit pas a la regle des armes :
       ce n'est pas le couple personnage + arme qui compte, mais le fichier
       d'armure REELLEMENT equipe dans un build - et le niveau de son passif,
       parce que la valeur en depend du simple au tiers pres. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters = [{
        owner:"user-1",
        char_id:"merlin",
        potential_tier:9,
        builds:{
          "Livre":{
            armor:{ "Armure liee":"7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp" },
            armorConfig:{ "Armure liee":{ passiveLevel:2 } }
          }
        },
        updated_at:"2026-08-16T12:00:00.000Z"
      }];
    });
    await ouvrirAnalyse(page);
    const chercheuse = page.locator('#analyseBody .debuff-row[data-source="tenue"]')
      .filter({ hasText:"Chercheuse de savoir" }).first();
    assert.ok(await chercheuse.count() > 0,
      "la tenue gravee doit nommer la tenue, pas une arme");
    assert.equal(
      await chercheuse.getAttribute("data-vise"),
      "allies",
      "un passif qui renforce l'equipe appartient au second recensement"
    );
    assert.equal(
      await chercheuse.locator(".db-porteur").first().textContent(),
      "Yannis P9 · N2",
      "la ligne d'une tenue montre le niveau de passif declare par le membre"
    );
    /* Le libelle d'une tenue annonce son MAXIMUM : la ligne doit le dire,
       sinon elle promet a tout le monde ce que seul un niveau 3 rend. */
    assert.ok(await chercheuse.locator(".db-au-max").count() > 0,
      "une ligne de tenue doit signaler que son libelle vaut au niveau 3");

    /* Niveau non renseigne : dit, jamais suppose. */
    await page.locator('.tab[data-view="builder"]').click();
    await page.evaluate(() => {
      window.__fakeSupabaseState.roster_characters[0].builds.Livre.armorConfig = {};
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await ouvrirAnalyse(page);
    assert.equal(
      await page.locator('#analyseBody .debuff-row[data-source="tenue"]')
        .filter({ hasText:"Chercheuse de savoir" }).first()
        .locator(".db-porteur").first().textContent(),
      "Yannis P9 · niv. ?",
      "un niveau absent se dit, il ne se remplace pas par le maximum"
    );

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("analyse-recensements.playwright.js OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
