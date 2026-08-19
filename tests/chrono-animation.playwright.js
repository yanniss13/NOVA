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

    await page.selectOption("#heros", "meliodas");
    await page.selectOption("#slot", "jumpatk");

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
    assert.equal(mesure.slot, "jumpatk");
    assert.ok(
      mesure.gameIds.every(id => id.startsWith("meliodas_")),
      "la mesure ne doit viser que les gameId de meliodas"
    );
    assert.ok(
      mesure.gameIds.length > 1,
      "une animation couvre plusieurs armes du meme heros"
    );

    const affiche = await page.locator("#sortieDuree").textContent();
    assert.equal(affiche.trim(), "1.2");

    /* Le denominateur de l'avancement vaut le nombre de couples heros x slot.
       S'il valait 376, slotDeGameId ne regrouperait rien et chaque arme
       demanderait sa propre mesure. */
    await page.waitForFunction(
      () => !/chargement/.test(document.getElementById("avancement").textContent)
    );
    const avancement = await page.locator("#avancement").textContent();
    assert.match(avancement, /Avancement : \d+ \/ 161 animations mesurées\./);

    /* L'envoi lui-meme demande une session, qu'un test ne peut pas ouvrir.
       On verifie donc la seule propriete stable : un clic ne reste jamais
       sans reponse. Un bouton muet laisserait le membre croire que sa mesure
       est partie. */
    await page.click("#envoyer");
    await page.waitForFunction(
      () => document.getElementById("retourEnvoi").textContent.trim().length > 0
    );
    const retour = await page.locator("#retourEnvoi").textContent();
    assert.ok(retour.trim().length > 0, "le bouton d'envoi doit toujours repondre");

    console.log("chrono-animation.playwright.js : OK");
  } finally {
    await navigateur.close();
    await serveur.close();
  }
})();
