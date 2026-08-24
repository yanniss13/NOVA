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
const fs = require("node:fs");
const path = require("node:path");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const FIXTURES = path.join(__dirname, "fixtures", "ocr");
const PNG_MINUSCULE = [{
  nom:"pixel.png",
  type:"image/png",
  base64:"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
}];

function fichiersPourNavigateur(noms, type="image/png"){
  return noms.map(nom => ({
    nom,
    type,
    base64:fs.readFileSync(path.join(FIXTURES, nom)).toString("base64")
  }));
}

async function envoyerFichiers(page, evenement, cible, fichiers){
  return page.evaluate(({ evenement, cible, fichiers }) => {
    const transfert = new DataTransfer();
    fichiers.forEach(fichier => {
      const octets = Uint8Array.from(atob(fichier.base64), caractere =>
        caractere.charCodeAt(0));
      transfert.items.add(new File([octets], fichier.nom, { type:fichier.type }));
    });
    const emis = new Event(evenement, { bubbles:true, cancelable:true });
    Object.defineProperty(emis,
      evenement === "paste" ? "clipboardData" : "dataTransfer",
      { value:transfert });
    const receveur = cible === "document"
      ? document : document.querySelector(cible);
    receveur.dispatchEvent(emis);
    return emis.defaultPrevented;
  }, { evenement, cible, fichiers });
}

async function ouvrirModaleImport(page, herosSlug="merlin"){
  return page.evaluate(async slug => {
    const module = await import("./js/vues/import-captures.js");
    window.__importVu = [];
    module.ouvrirImportCaptures({
      herosSlug:slug,
      existant:{},
      surEnregistrement:parEmplacement => window.__importVu.push(parEmplacement)
    });
    return window.__importVu.length;
  }, herosSlug);
}

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

const ARMES_ATTENDUES = [
  {
    fichier:"pc-arme-baguette.png",
    herosSlug:"merlin",
    nom:"Baguette des ailes de la flamme noire",
    details:["Arme", "niveau 50", "promotion 4", "outrepassement 6",
      "4 enchantements remplis"],
    elementSuppose:false,
    fichierArme:"7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp",
    config:{ gradeGameId:"131065005", level:50, promotion:4, overlimit:6 },
    element:null
  },
  {
    fichier:"ultrawide-arme-rapiere.png",
    herosSlug:"dreyfus",
    nom:"Rapi\u00e8re de l'\u00e2me vorace",
    details:["Arme", "niveau 50", "3 enchantements remplis"],
    elementSuppose:true,
    fichierArme:"7ds-armes/Rapiere/Rapi\u00e8re de l'\u00e2me vorace.webp",
    config:{ gradeGameId:"131085010", level:50, promotion:4, overlimit:0 },
    element:"wind"
  },
  /* Bandeau VIOLET, la ou les deux precedentes l'ont dore. Le nom de l'arme
     vit dans ce bandeau, et il ne se deduit pas : sans lui l'inversion ne
     tranche que dans onze cas sur cent. Un seuil de luminance cale sur le
     dore laissait donc le titre hors de la zone lue, et cette capture
     echouait entierement — chiffres impeccables, arme introuvable. */
  {
    fichier:"pc-arme-grimoire.png",
    herosSlug:"gowther",
    nom:"Grimoire flamboyant",
    details:["Arme", "niveau 50", "promotion 4", "outrepassement 6",
      "3 enchantements remplis"],
    elementSuppose:true,
    fichierArme:"7ds-armes/Livre/Grimoire flamboyant.webp",
    config:{ gradeGameId:"131104011", level:50, promotion:4, overlimit:6 },
    element:"generic"
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
    await page.evaluate(() => {
      /* Sans session, la page ouvre sa modale de connexion, qui recouvre la
         notre et intercepte les clics. On l'ecarte : ce test porte sur la
         lecture des captures, pas sur l'authentification. */
      const auth = document.querySelector("#authOverlay");
      if(auth) auth.remove();
    });
    const avantDepot = await ouvrirModaleImport(page);
    assert.equal(avantDepot, 0, "ouvrir la modale ne doit rien ecrire");

    const zoneDepot = page.locator(".import-captures-depot");
    await zoneDepot.waitFor({ state:"visible", timeout:5000 });
    assert.match(await zoneDepot.textContent(), /Glisse.*colle/si,
      "la zone doit annoncer les deux gestes directs");
    await page.locator("#importCapturesFichiers").focus();
    assert.equal(await zoneDepot.evaluate(zone => zone.matches(":focus-within")),
      true, "le sélecteur transparent doit garder un focus visible sur le cadre");

    await page.setViewportSize({ width:320, height:800 });
    const mobile = await page.evaluate(() => {
      const zone = document.querySelector(".import-captures-depot")
        .getBoundingClientRect();
      return {
        zoneWidth:zone.width,
        zoneHeight:zone.height,
        viewport:innerWidth,
        documentWidth:document.documentElement.scrollWidth
      };
    });
    assert.ok(mobile.zoneWidth <= mobile.viewport,
      "la zone de dépôt doit tenir dans 320 px");
    assert.ok(mobile.zoneHeight >= 150,
      "la zone mobile doit conserver une grande cible tactile");
    assert.ok(mobile.documentWidth <= mobile.viewport,
      "la modale de dépôt ne doit pas créer de débordement horizontal");
    await page.setViewportSize({ width:1280, height:720 });

    await page.evaluate(async () => {
      const { ModalStack } = await import("./js/vues/modal-stack.js");
      ModalStack.closeAll();
    });
    const collageApresFermeture = await envoyerFichiers(page, "paste", "document",
      fichiersPourNavigateur([ATTENDU[0].fichier]));
    assert.equal(collageApresFermeture, false,
      "fermer toutes les modales doit retirer l'écouteur de collage");
    await ouvrirModaleImport(page);
    await page.locator(".import-captures-depot")
      .waitFor({ state:"visible", timeout:5000 });

    await page.evaluate(() => {
      window.__createObjectURLOriginal = URL.createObjectURL.bind(URL);
      window.__createObjectURLFiles = [];
      URL.createObjectURL = fichier => {
        window.__createObjectURLFiles.push(fichier && fichier.name || "");
        return window.__createObjectURLOriginal(fichier);
      };
    });
    await envoyerFichiers(page, "drop", ".import-captures-depot",
      fichiersPourNavigateur([ATTENDU[0].fichier]));
    await page.locator(".import-captures-progression")
      .waitFor({ state:"visible", timeout:5000 });
    const collagePendantLecture = await envoyerFichiers(
      page, "paste", "document", PNG_MINUSCULE);
    assert.equal(collagePendantLecture, true,
      "une image collée pendant la lecture doit être absorbée sans relancer l'OCR");
    await page.waitForFunction(() =>
      document.querySelectorAll(".import-captures-ligne").length === 1,
      null, { timeout:10000 });
    assert.equal(await page.evaluate(() =>
      window.__createObjectURLFiles.filter(nom => nom === "pixel.png").length), 0,
      "une seconde entrée pendant la lecture ne doit pas lancer un second OCR");

    await page.evaluate(async () => {
      const { ModalStack } = await import("./js/vues/modal-stack.js");
      ModalStack.closeAll();
    });
    await ouvrirModaleImport(page);
    await envoyerFichiers(page, "drop", ".import-captures-depot",
      fichiersPourNavigateur([ATTENDU[0].fichier]));
    await page.locator(".import-captures-progression")
      .waitFor({ state:"visible", timeout:5000 });
    await page.evaluate(() => {
      window.__ancienneProgression = document.querySelector(
        ".import-captures-progression");
    });
    await page.evaluate(async () => {
      const { ModalStack } = await import("./js/vues/modal-stack.js");
      ModalStack.closeAll();
    });
    await ouvrirModaleImport(page);
    await page.waitForFunction(() =>
      window.__ancienneProgression?.textContent.includes("1 sur 1"),
      null, { timeout:180000 });
    assert.equal(await page.locator(".import-captures-ligne").count(), 0,
      "un ancien OCR ne doit pas écrire dans une modale rouverte");
    await page.locator(".import-captures-depot")
      .waitFor({ state:"visible", timeout:5000 });
    await page.evaluate(() => {
      URL.createObjectURL = window.__createObjectURLOriginal;
      delete window.__createObjectURLOriginal;
      delete window.__createObjectURLFiles;
      delete window.__ancienneProgression;
    });

    const depotNonImage = await envoyerFichiers(page, "drop",
      ".import-captures-depot",
      fichiersPourNavigateur([ATTENDU[0].fichier], "text/plain"));
    assert.equal(depotNonImage, true,
      "un fichier non image depose ne doit pas etre ouvert par le navigateur");
    assert.match(
      await page.locator(".import-captures-depot-message").textContent(),
      /Aucune image détectée/,
      "un depot sans image doit expliquer quoi fournir"
    );

    await envoyerFichiers(page, "paste", "document",
      fichiersPourNavigateur([ATTENDU[0].fichier], "text/plain"));
    assert.match(
      await page.locator(".import-captures-depot-message").textContent(),
      /Aucune image détectée/,
      "un collage sans image doit expliquer quoi fournir"
    );

    const depotIntercepte = await envoyerFichiers(page, "drop",
      ".import-captures-depot",
      fichiersPourNavigateur(ATTENDU.map(cas => cas.fichier)));
    assert.equal(depotIntercepte, true,
      "déposer des images doit empêcher le navigateur de les ouvrir");

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

    for(const [indexArme, attendu] of ARMES_ATTENDUES.entries()){
      const avantArme = await page.evaluate(async herosSlug => {
        const module = await import("./js/vues/import-captures.js");
        window.__importVu = [];
        module.ouvrirImportCaptures({
          herosSlug,
          existant:{},
          surEnregistrement:parEmplacement => window.__importVu.push(parEmplacement)
        });
        return window.__importVu.length;
      }, attendu.herosSlug);
      assert.equal(avantArme, 0, attendu.fichier + " : ouvrir ne doit rien ecrire");

      if(indexArme === 0){
        const collageIntercepte = await envoyerFichiers(page, "paste", "document",
          fichiersPourNavigateur([attendu.fichier]));
        assert.equal(collageIntercepte, true,
          "coller une image doit empêcher le collage natif");
      }else{
        await page.setInputFiles("#importCapturesFichiers",
          path.join(FIXTURES, attendu.fichier));
      }
      await page.waitForFunction(
        () => document.querySelectorAll(".import-captures-ligne").length === 1,
        null, { timeout:180000 });

      const lue = await page.evaluate(() => {
        const ligne = document.querySelector(".import-captures-ligne");
        return {
          statut:ligne.dataset.statut,
          piece:(ligne.querySelector(".import-captures-piece") || {}).textContent,
          detail:(ligne.querySelector(".import-captures-detail") || {}).textContent
        };
      });
      assert.equal(lue.statut, "unique", attendu.fichier + " doit etre unique");
      assert.equal(lue.piece, attendu.nom, attendu.fichier + " : nom attendu");
      attendu.details.forEach(detail => assert.ok((lue.detail || "").includes(detail),
        attendu.fichier + " : detail attendu Â« " + detail + " Â»"));
      assert.equal((lue.detail || "").includes("élément supposé"), attendu.elementSuppose,
        attendu.fichier + " : signalement d'element suppose");

      assert.equal(await page.evaluate(() => window.__importVu.length), 0,
        attendu.fichier + " : rien ne doit etre ecrit avant Enregistrer");
      await page.click("#importCapturesSave");
      const sortie = await page.evaluate(() => window.__importVu);
      assert.equal(sortie.length, 1, attendu.fichier + " : un seul envoi apres le clic");
      assert.deepEqual(Object.keys(sortie[0]), ["Arme"],
        attendu.fichier + " : seule l'arme est ecrite");
      const arme = sortie[0].Arme;
      assert.equal(arme.fichier, attendu.fichierArme, attendu.fichier + " : fichier attendu");
      assert.equal(arme.config.gradeGameId, attendu.config.gradeGameId);
      assert.equal(arme.config.level, attendu.config.level);
      assert.equal(arme.config.promotion, attendu.config.promotion);
      assert.equal(arme.config.overlimit, attendu.config.overlimit);
      assert.equal(arme.config.enchantments.filter(Boolean).length,
        attendu.details.some(detail => detail.startsWith("4 ")) ? 4 : 3,
        attendu.fichier + " : enchantements attendus");
      if(attendu.element){
        assert.ok(arme.config.enchantments.filter(Boolean).every(enchantement =>
          enchantement.element === attendu.element),
        attendu.fichier + " : enchantements " + attendu.element + " attendus");
      }
      assert.equal(await page.evaluate(async ({ fichier, config }) => {
        const { weaponConfigStatus } = await import("./js/metier/build-config.js");
        return weaponConfigStatus(fichier, config);
      }, arme), "valid", attendu.fichier + " : configuration valide");
    }

    assert.deepEqual(erreurs, [],
      "aucune erreur de page pendant les parcours d'armes");

    console.log("import-captures (bout en bout) : OK");
  }finally{
    await navigateur.close();
    await serveur.close();
  }
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
