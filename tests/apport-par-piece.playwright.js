"use strict";

/* L'apport de chaque pièce, vérifié dans un vrai navigateur.

   Conception : docs/superpowers/specs/2026-08-03-apport-par-piece-design.md

   L'équipe est amorcée dans `localStorage` plutôt que construite au clic :
   le parcours d'équipement complet est déjà couvert par
   potentiel-commun.playwright.js, et le rejouer ici rendrait ce test
   sensible à des évolutions d'interface qu'il ne cherche pas à protéger.

   Le héros porte volontairement une pièce configurée ET une pièce équipée
   mais non configurée : c'est le cas qui a fait échouer la conception
   initiale, et le seul qui prouve la tolérance de calculateBuildStats. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";
const HAUT = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
const BAS = "7ds-armures-ssr/Bas/Bas de l'araignée de l'ombre.webp";

/* gearConfigStatus exige qualityMin <= level <= qualityMax : 120 minimum. */
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

    /* La pièce configurée porte un résumé non vide. */
    const resume = page.locator(".eq-contribution:not(.empty) > summary").first();
    await resume.waitFor({ state:"visible" });
    const texte = (await resume.textContent()).trim();
    assert.ok(
      texte.length > 2,
      "le resume d'une piece configuree n'est pas vide, recu : " + texte
    );
    assert.match(
      texte,
      /Défense/,
      "le premier apport affiche est la statistique principale, recu : " + texte
    );
    assert.doesNotMatch(
      texte,
      /% ?%/,
      "le pourcentage n'est pose qu'une fois, recu : " + texte
    );

    /* Il est replié à l'ouverture, et se déplie au clic. */
    const details = page.locator(".eq-contribution:not(.empty)").first();
    assert.equal(
      await details.evaluate(node => node.open),
      false,
      "le detail est replie a l'ouverture de la modale"
    );
    await resume.click();
    assert.equal(
      await details.evaluate(node => node.open),
      true,
      "un clic sur le resume deplie le detail"
    );
    assert.ok(
      await details.locator("details").count() > 0,
      "le detail deplie contient la ventilation par terme"
    );

    /* La pièce équipée mais non configurée l'annonce au lieu de rester muette. */
    const nonConfiguree = page.locator(".eq-contribution.empty").first();
    await nonConfiguree.waitFor({ state:"visible" });
    assert.equal(
      (await nonConfiguree.textContent()).trim(),
      "À configurer",
      "une piece equipee mais non configuree affiche sa mention"
    );

    /* Une pièce non configurée n'efface pas les résumés des autres : c'est
       ce que calculateHeroStats aurait fait, et la raison du choix de
       calculateBuildStats comme source. */
    assert.ok(
      await page.locator(".eq-contribution:not(.empty)").count() >= 1,
      "une piece non configuree n'efface pas le resume des autres"
    );

    assert.deepEqual(errors, [], "aucune erreur de page pendant le scenario");
    console.log("PASS Playwright: apport par piece");
  }finally{
    await browser.close();
    await server.close();
  }
})();
