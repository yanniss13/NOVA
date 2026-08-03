"use strict";

/* L'apport d'une piece, verifie dans un vrai navigateur.

   Conception : docs/superpowers/specs/2026-08-03-apport-par-piece-modale-design.md

   L'equipe est amorcee dans localStorage plutot que construite au clic : le
   parcours d'equipement est deja couvert par potentiel-commun.playwright.js.

   Le heros porte une piece configuree ET une piece non configuree : c'est ce
   qui permet de verifier l'ordre du parcours. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";
const HAUT = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
const BAS = "7ds-armures-ssr/Bas/Bas de l'araignée de l'ombre.webp";

const CONFIG = { version:1, level:120, reinforce:0, enchantments:[], passiveLevel:null };

const EQUIPE = {
  id:"apport-1",
  name:"Apport",
  pseudo:"Apport",
  heroes:[{
    char:"diane",
    weapon:null,
    armor:{ Haut:HAUT, Bas:BAS },
    armorConfig:{ Haut:CONFIG },
    jewel:{},
    jewelConfig:{},
    potentiel:{ tier:0 }
  }]
};

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.evaluate(([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, [EQUIPE]]);
    await page.reload();

    await page.locator('[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();

    /* La ligne d'une piece equipee est un bouton, et elle ouvre la modale. */
    const ligne = page.locator("button.eq-line").first();
    await ligne.waitFor({ state:"visible" });
    await ligne.click();

    const overlay = page.locator("#pieceDetailOverlay");
    await overlay.waitFor({ state:"visible" });
    assert.equal(
      await overlay.evaluate(node => node.classList.contains("on")),
      true,
      "un clic sur la ligne ouvre la modale de la piece"
    );

    /* Le titre nomme la piece, et la piece configuree vient en premier. */
    assert.equal(
      (await page.locator("#pieceDetailTitle").textContent()).trim(),
      "Haut de l'araignée de l'ombre",
      "la modale est titree du nom de la piece, configuree d'abord"
    );
    assert.equal(
      (await page.locator("#pieceDetailPosition").textContent()).trim(),
      "1 / 2",
      "la position reflete le parcours"
    );
    assert.ok(
      await page.locator("#pieceDetailBody .weapon-stat").count() > 0,
      "une piece configuree affiche ses statistiques"
    );

    /* Aux bornes, les fleches sont desactivees. */
    assert.equal(
      await page.locator("#pieceDetailPrev").isDisabled(),
      true,
      "la fleche precedente est desactivee sur la premiere entree"
    );

    /* La navigation passe a la piece suivante sans refermer la modale. */
    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await page.locator("#pieceDetailPosition").textContent()).trim(),
      "2 / 2",
      "la fleche suivante avance dans le parcours"
    );
    assert.equal(
      (await page.locator("#pieceDetailTitle").textContent()).trim(),
      "Bas de l'araignée de l'ombre",
      "le titre suit la navigation"
    );
    assert.equal(
      await page.locator("#pieceDetailNext").isDisabled(),
      true,
      "la fleche suivante est desactivee sur la derniere entree"
    );

    /* Une piece non configuree annonce son etat, sans statistique. */
    assert.match(
      await page.locator("#pieceDetailBody").textContent(),
      /pas encore configurée/,
      "une piece non configuree affiche son message"
    );
    assert.equal(
      await page.locator("#pieceDetailBody .weapon-stat").count(),
      0,
      "une piece non configuree n'affiche aucune statistique"
    );

    /* Echap ferme la modale de piece SANS fermer la modale d'equipe qui la
       porte : ModalStack ne leve son verrou de defilement qu'a la derniere
       fermeture, une regression ici casserait le defilement de la page. */
    await page.keyboard.press("Escape");
    assert.equal(
      await overlay.evaluate(node => node.classList.contains("on")),
      false,
      "Echap ferme la modale de la piece"
    );
    assert.equal(
      await page.locator("#teamOverlay").evaluate(node => node.classList.contains("on")),
      true,
      "la modale d'equipe reste ouverte dessous"
    );

    /* Le focus revient sur la ligne d'origine. */
    assert.equal(
      await page.evaluate(() =>
        document.activeElement && document.activeElement.classList.contains("eq-line")
      ),
      true,
      "le focus revient sur la ligne qui a ouvert la modale"
    );

    assert.deepEqual(errors, [], "aucune erreur de page pendant le scenario");
    console.log("PASS Playwright: apport par piece");
  }finally{
    await browser.close();
    await server.close();
  }
})();
