"use strict";

/* Les presets dans un vrai navigateur, par les gestes d'un membre : ouvrir la
   fiche d'un heros, enregistrer son equipement sous un nom, changer de type
   d'arme, et le reposer la.

   Ce parcours ne passe par AUCUN crochet de test : il clique ce qu'un membre
   clique. C'est le seul moyen de prouver que le branchement des ecrans
   fonctionne — la logique pure, elle, a deja ses tests unitaires. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

const HAUT = "Haut de la mélodie d'Arachnée";
const ANNEAU = "Anneau de la mélodie d'Arachnée";
const ARME_EPEE = "En plein cœur !";

(async () => {
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  /* Le nom du preset se saisit dans une invite native, comme le changement
     d'arme demande deja confirmation dans cet ecran. */
  page.on("dialog", dialogue => dialogue.accept("Set Arachnée"));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");

    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();

    await page.locator('.tab[data-view="member-roster"]').click();
    await page.locator("#memberRosterGrid .member-roster-card")
      .filter({ hasText:"Meliodas" })
      .locator(".member-roster-edit")
      .click();

    const editeur = page.locator("#memberRosterEditor");
    await editeur.locator('.gear-slot[data-slot="Haut"]').waitFor();

    /* Le build favori de Meliodas est celui a la Hache : il porte un Haut et
       un Anneau, et c'est lui qui s'ouvre. */
    assert.match(
      await editeur.locator('.gear-slot[data-slot="Haut"]').getAttribute("title"),
      new RegExp(HAUT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "le build ouvert doit deja porter le Haut du set"
    );

    // ---------- Enregistrer l'equipement sous un nom ----------
    await editeur.getByRole("button", { name:"Enregistrer comme preset" }).click();

    await page.waitForFunction(() =>
      (window.__fakeSupabaseState.gear_presets || []).length === 1);
    const enregistre = await page.evaluate(() =>
      window.__fakeSupabaseState.gear_presets[0]);

    assert.equal(enregistre.nom, "Set Arachnée");
    assert.equal(enregistre.owner, "user-1", "le preset appartient au membre connecte");
    assert.equal(enregistre.payload.armor["Haut"].includes(HAUT), true);
    assert.equal(enregistre.payload.jewel["Anneau"].includes(ANNEAU), true);
    /* L'armure gravee n'entre JAMAIS dans un preset : elle appartient au
       personnage, la deplacer n'a aucun sens dans le jeu. */
    assert.equal(
      Object.prototype.hasOwnProperty.call(enregistre.payload.armor, "Armure liee"),
      false,
      "l'armure gravee ne doit pas etre capturee"
    );

    // ---------- Le reposer sur un autre type d'arme ----------
    await editeur.getByRole("button", { name:/Epee 1 main|Épée à une main/ }).click();
    await editeur.locator('.gear-slot[data-slot="Haut"]').waitFor();

    const avant = await editeur.locator('.gear-slot[data-slot="Haut"]').getAttribute("title");
    assert.equal(avant.includes(HAUT), false,
      "ce build ne doit pas encore porter le set");

    await editeur.getByRole("button", { name:"Appliquer un preset" }).click();
    await page.getByRole("button", { name:"Set Arachnée" }).click();

    await page.waitForFunction(nom => {
      const slot = document.querySelector('#memberRosterEditor .gear-slot[data-slot="Haut"]');
      return slot && (slot.getAttribute("title") || "").includes(nom);
    }, HAUT);

    // L'arme du build cible n'a pas bouge : un preset ne porte pas d'arme.
    assert.match(
      await editeur.locator(".gear-slot.weapon").getAttribute("title"),
      new RegExp(ARME_EPEE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      "l'arme de la cible doit rester la sienne"
    );
    // Le bijou a suivi le meme chemin que l'armure.
    assert.equal(
      (await editeur.locator('.gear-slot[data-slot="Anneau"]').getAttribute("title")).includes(ANNEAU),
      true
    );

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("presets.playwright.js : OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
