"use strict";

/* La page de chronometrage, dans un vrai navigateur. On ne charge pas de
   fichier video : on pilote directement currentTime, car ce qu'on verifie
   ici c'est la chaine marquage -> calcul -> affichage, pas le decodage. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

(async () => {
  const serveur = await serveRepo();
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  try{
    await page.goto(serveur.url + "/outils/chrono-animation.html");

    const nombreHeros = await page.locator("#heros option").count();
    assert.ok(nombreHeros >= 20, "les heros doivent etre proposes, vu " + nombreHeros);

    /* Le meme heros n'a pas le meme moveset selon l'arme : Meliodas a la hache
       et Meliodas a l'epee longue sont deux animations a mesurer separement.
       Une mesure ne vaut donc que pour un seul gameId. */
    await page.selectOption("#heros", "meliodas");
    await page.selectOption("#arme", "Axe");
    const avecHache = await page.evaluate(() =>
      document.getElementById("competence").value);
    await page.selectOption("#arme", "Sword1h");
    const avecEpee = await page.evaluate(() =>
      document.getElementById("competence").value);
    assert.ok(avecHache.startsWith("meliodas_axe_"), "vu " + avecHache);
    assert.ok(avecEpee.startsWith("meliodas_sword1h_"), "vu " + avecEpee);
    assert.notEqual(avecHache, avecEpee, "changer d'arme doit changer la mesure");

    /* Les competences portent leur nom francais, pas leur identifiant. */
    const libelle = await page.locator("#competence option").first().textContent();
    assert.ok(!/_/.test(libelle), "aucun identifiant technique visible : " + libelle);
    assert.match(libelle, /clic gauche|\(E\)|\(Q\)|\(R\)|1 à 4/);

    await page.selectOption("#arme", "Axe");

    // Dix lancements entre 1.000 s et 13.000 s : 1.2 s chacun.
    await page.evaluate(() => {
      const video = document.getElementById("video");
      Object.defineProperty(video, "currentTime", { value:1, writable:true });
      document.getElementById("marquerDebut").click();
      video.currentTime = 13;
      document.getElementById("marquerFin").click();
    });

    const mesure = await page.evaluate(() => window.ChronoPage.mesureCourante());
    assert.equal(mesure.secondes, 1.2);
    assert.equal(mesure.heros, "meliodas");
    assert.equal(mesure.arme, "Axe");
    assert.ok(mesure.gameId.startsWith("meliodas_axe_"), "vu " + mesure.gameId);

    const affiche = await page.locator("#sortieDuree").textContent();
    assert.equal(affiche.trim(), "1.2");

    /* 335 competences chiffrables, le compte exact du guide. Les 41 sans
       pourcentage de degats n'entrent dans aucun calcul de DPS. */
    await page.waitForFunction(
      () => /\d+ \/ \d+/.test(document.getElementById("avancement").textContent)
    );
    const avancement = await page.locator("#avancement").textContent();
    assert.match(avancement, /\d+ \/ 335 animations mesurées/);

    /* L'envoi demande une session, qu'un test ne peut pas ouvrir. On verifie
       la seule propriete stable : un clic ne reste jamais sans reponse. */
    await page.click("#envoyer");
    await page.waitForFunction(
      () => document.getElementById("retourEnvoi").textContent.trim().length > 0
    );

    /* Reculer reste une recherche, et son pas doit suivre la cadence MESUREE
       de la video, pas 60 img/s code en dur. Avancer, lui, ne cherche plus :
       il lit une image et met en pause, seul moyen d'eviter que le decodeur
       ne retombe sur une image-cle et ne bondisse de soixante-dix images. */
    const recul = await page.evaluate(() => {
      const video = document.getElementById("video");
      const etat = window.ChronoPage.etat;
      etat.dureeImage = 1 / 30;
      etat.mediaTime = 2;
      video.currentTime = 2;
      document.dispatchEvent(new KeyboardEvent("keydown", { key:"ArrowLeft" }));
      return video.currentTime;
    });
    /* L'image courante commence a 2 s, la precedente occupe [2 - 1/30, 2).
       On vise son milieu : 2 - 1/60. Retirer 1.5 image visait celle d'encore
       avant, et reculait donc de deux. */
    assert.ok(
      Math.abs(recul - (2 - 1 / 60)) < 1e-6,
      "le recul doit viser le milieu de l'image precedente, vu " + recul
    );

    /* L'avance suit la meme regle : l'image suivante occupe [T + d, T + 2d),
       son milieu est a T + 1,5 d. Supposer 60 img/s sur une capture a 30
       faisait sauter d'une demi-image, d'ou une avance qui ne marchait qu'une
       fois sur deux. */
    const avance = await page.evaluate(() => {
      const video = document.getElementById("video");
      const etat = window.ChronoPage.etat;
      etat.dureeImage = 1 / 30;
      etat.mediaTime = 2;
      video.currentTime = 2;
      document.dispatchEvent(new KeyboardEvent("keydown", { key:"ArrowRight" }));
      return video.currentTime;
    });
    assert.ok(
      Math.abs(avance - (2 + 1.5 / 30)) < 1e-6,
      "l'avance doit viser le milieu de l'image suivante, vu " + avance
    );

    console.log("chrono-animation.playwright.js : OK");
  } finally {
    await navigateur.close();
    await serveur.close();
  }
})();
