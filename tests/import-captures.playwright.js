"use strict";

/* L'import de captures, de bout en bout, dans un vrai navigateur.

   Ce test ne bouchonne rien : il depose deux vraies captures dans le champ de
   la modale, laisse le moteur verse dans `vendor/tesseract` les lire, et
   verifie le recapitulatif. Il couvre donc d'un coup le decodage d'image, la
   detection du panneau, les deux passes d'OCR, le recalage et l'inversion.

   Les deux captures viennent de deux appareils differents — un PC en 1920x1080
   et un iPhone en 2796x1290, tous deux recadres — et doivent produire le meme
   genre de resultat sans le moindre reglage. C'est la propriete qui compte :
   aucune coordonnee n'est calee sur une resolution.

   Il est lent — le moteur pese quatre megaoctets et chaque capture demande une
   seconde ou deux. C'est le prix d'une verification qui porte sur la chaine
   entiere plutot que sur ses morceaux. */

const assert = require("node:assert/strict");
const path = require("node:path");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const FIXTURES = path.join(__dirname, "fixtures", "ocr");

/* Verite terrain relevee a l'oeil sur chaque capture. */
const ATTENDU = [
  {
    fichier:"pc-armure-gravee.png",
    piece:/Sanglier de la Gourmandise/,
    slot:"Armure liee",
    level:130,
    reinforce:5
  },
  {
    fichier:"mobile-ceinture.png",
    piece:/Ceinture du souverain cupide/,
    slot:"Ceinture",
    level:159,
    reinforce:5
  }
];

(async () => {
  const serveur = await serveRepo();
  const navigateur = await chromium.launch({ headless:true });
  try{
    const page = await navigateur.newPage();
    const erreurs = [];
    page.on("pageerror", erreur => erreurs.push(String(erreur)));
    await page.goto(serveur.url + "/index.html");

    /* On ouvre la modale directement : le bouton vit dans l'editeur de roster,
       qui demande une session connectee. Ce qu'on verifie ici est la chaine de
       lecture, pas le chemin de navigation. */
    const avantDepot = await page.evaluate(async () => {
      /* Sans session, la page ouvre sa modale de connexion, qui recouvre la
         notre et intercepte les clics. On l'ecarte : ce test porte sur la
         lecture des captures, pas sur l'authentification. */
      const auth = document.querySelector("#authOverlay");
      if(auth) auth.remove();
      const module = await import("./js/vues/import-captures.js");
      window.__importVu = [];
      module.ouvrirImportCaptures({
        herosSlug:"merlin",
        existant:{},
        surEnregistrement:parEmplacement => window.__importVu.push(parEmplacement)
      });
      return window.__importVu.length;
    });
    assert.equal(avantDepot, 0, "ouvrir la modale ne doit rien ecrire");

    await page.setInputFiles("#importCapturesFichiers",
      ATTENDU.map(cas => path.join(FIXTURES, cas.fichier)));

    /* Le moteur se telecharge puis lit deux captures : on laisse largement le
       temps, l'echec interessant serait un resultat faux, pas une lenteur. */
    await page.waitForFunction(
      () => document.querySelectorAll(".import-captures-ligne").length === 2,
      null, { timeout:180000 });

    const lues = await page.evaluate(() =>
      [...document.querySelectorAll(".import-captures-ligne")].map(ligne => ({
        statut:ligne.dataset.statut,
        piece:(ligne.querySelector(".import-captures-piece") || {}).textContent,
        detail:(ligne.querySelector(".import-captures-detail") || {}).textContent
      })));

    assert.deepEqual(erreurs, [], "aucune erreur de page");

    ATTENDU.forEach((attendu, rang) => {
      const lue = lues[rang];
      assert.equal(lue.statut, "unique",
        attendu.fichier + " doit etre lue sans ambiguite (obtenu : "
          + lue.statut + ")");
      assert.match(lue.piece || "", attendu.piece,
        attendu.fichier + " : piece attendue");
      const detail = lue.detail || "";
      assert.ok(detail.includes(attendu.slot),
        attendu.fichier + " : emplacement " + attendu.slot
          + " attendu, lu « " + detail + " »");
      assert.ok(detail.includes("niveau " + attendu.level),
        attendu.fichier + " : niveau " + attendu.level
          + " attendu, lu « " + detail + " »");
      assert.ok(detail.includes("+" + attendu.reinforce),
        attendu.fichier + " : renforcement +" + attendu.reinforce + " attendu");
    });

    /* Toujours rien d'ecrit : c'est la propriete de surete de la
       fonctionnalite. Le membre voit avant que ca parte. */
    assert.equal(await page.evaluate(() => window.__importVu.length), 0,
      "rien ne doit etre ecrit avant le clic sur Enregistrer");

    await page.click("#importCapturesSave");
    const ecrit = await page.evaluate(() => window.__importVu);
    assert.equal(ecrit.length, 1, "un seul envoi apres le clic");
    assert.deepEqual(Object.keys(ecrit[0]).sort(), ["Armure liee", "Ceinture"],
      "les deux emplacements deduits doivent etre ecrits");

    console.log("import-captures (bout en bout) : OK");
  }finally{
    await navigateur.close();
    await serveur.close();
  }
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
