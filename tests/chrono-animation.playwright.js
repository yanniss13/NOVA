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
    await page.addInitScript(() => {
      window.__chronoInserts = [];
      window.__fakeSb = {
        auth:{ getUser:async() => ({ data:{ user:{ id:"u1" } } }) },
        from(table){
          if(table === "profiles") return {
            select(){ return this; }, eq(){ return this; },
            maybeSingle:async() => ({ data:{ pseudo:"Anne" } })
          };
          return { insert:async(payload) => {
            window.__chronoInserts.push(payload);
            await new Promise(resolve => setTimeout(resolve, 50));
            return { error:null };
          }};
        }
      };
    });
    await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({
      contentType:"application/javascript",
      body:"window.supabase={createClient:function(){return window.__fakeSb;}};"
    }));
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
    await page.selectOption("#competence", { index:0 });
    assert.equal(await page.locator('input[value="rafale"]').isChecked(), true);
    assert.equal(await page.locator('input[value="rafale"]').isDisabled(), true);
    assert.equal(await page.locator("#repetitions").isDisabled(), false);
    const borneRafale = await page.evaluate(() => {
      const repetitions = document.getElementById("repetitions");
      repetitions.value = "1";
      const resultat = {
        min:repetitions.min,
        sousBorne:repetitions.validity.rangeUnderflow
      };
      repetitions.value = "10";
      return resultat;
    });
    assert.deepEqual(borneRafale, { min:"2", sousBorne:true });

    await page.selectOption("#competence", { index:1 });
    assert.equal(await page.locator('input[value="unique"]').isChecked(), true);
    assert.equal(await page.locator('input[value="unique"]').isDisabled(), true);
    assert.equal(await page.locator("#repetitions").isDisabled(), true);

    await page.selectOption("#competence", { index:0 });

    // Dix lancements entre 1.000 s et 13.000 s : 1.2 s chacun.
    await page.evaluate(() => {
      const video = document.getElementById("video");
      Object.defineProperty(video, "currentTime", { value:1, writable:true });
      document.getElementById("marquerDebut").click();
      video.currentTime = 13;
      document.getElementById("marquerFin").click();
      window.ChronoPage.etat.dureeImage = 1 / 30;
    });

    const mesure = await page.evaluate(() => window.ChronoPage.mesureCourante());
    assert.equal(mesure.secondes, 1.2);
    assert.equal(mesure.heros, "meliodas");
    assert.equal(mesure.arme, "Axe");
    assert.ok(mesure.gameId.startsWith("meliodas_axe_"), "vu " + mesure.gameId);
    assert.equal(mesure.mode, "rafale");
    assert.equal(mesure.repetitions, 10);
    assert.equal(mesure.fps, 30);

    /* L'afficheur et le payload reposent sur la meme cadence reelle : 59,94
       img/s ne doit pas etre annonce comme 60 alors qu'il est envoye tel quel. */
    const cadenceReelle = await page.evaluate(() => {
      window.ChronoPage.etat.dureeImage = 1 / 59.94;
      document.getElementById("repetitions").dispatchEvent(
        new Event("input", { bubbles:true })
      );
      return {
        mesure:window.ChronoPage.mesureCourante(),
        libelle:document.getElementById("cadence").textContent
      };
    });
    assert.equal(cadenceReelle.mesure.fps, 59.94);
    assert.equal(cadenceReelle.libelle, "59.94 img/s");

    /* Le DOM reste hostile : une rafale d'un seul cycle ne peut pas contourner
       le protocole. Le retour doit donner les deux formes acceptables, pas
       seulement constater une methode differente. */
    const erreurProtocole = await page.evaluate(() => {
      const repetitions = document.getElementById("repetitions");
      repetitions.value = "1";
      try{
        window.ChronoPage.mesureCourante();
        return null;
      }catch(erreur){
        return erreur.message;
      }finally{
        repetitions.value = "10";
        window.ChronoPage.etat.dureeImage = 1 / 30;
      }
    });
    assert.match(erreurProtocole, /rafale.*entier.*2/i);
    assert.match(erreurProtocole, /unique.*reps.*null/i);

    /* Un FPS reel mais invraisemblable doit etre refuse avant envoi : envoyer
       5 img/s masquerait une cadence mal lue, plutot que de la corriger. */
    const erreurFps = await page.evaluate(() => {
      const etat = window.ChronoPage.etat;
      etat.dureeImage = 1 / 5;
      try{
        window.ChronoPage.mesureCourante();
        return null;
      }catch(erreur){
        return erreur.message;
      }finally{
        etat.dureeImage = 1 / 30;
      }
    });
    assert.match(erreurFps, /cadence.*10.*240/i);

    /* Sans cadence lue dans la video, le repli de 60 img/s reste publie et
       visible : il ne faut pas confondre l'absence de lecture avec 0 FPS. */
    const repli = await page.evaluate(() => {
      const etat = window.ChronoPage.etat;
      etat.dureeImage = 0;
      document.getElementById("repetitions").dispatchEvent(
        new Event("input", { bubbles:true })
      );
      return {
        mesure:window.ChronoPage.mesureCourante(),
        libelle:document.getElementById("cadence").textContent
      };
    });
    assert.equal(repli.mesure.fps, 60);
    assert.match(repli.libelle, /60 img\/s \(repli\)/);

    /* Une mesure unique trop longue ne doit jamais atteindre Supabase : la
       meme borne globale que la base s'applique dans le navigateur. */
    await page.selectOption("#competence", { index:1 });
    const erreurDuree = await page.evaluate(() => {
      const video = document.getElementById("video");
      Object.defineProperty(video, "currentTime", { value:1, writable:true });
      document.getElementById("marquerDebut").click();
      video.currentTime = 32;
      document.getElementById("marquerFin").click();
      try{
        window.ChronoPage.mesureCourante();
        return null;
      }catch(erreur){
        return erreur.message;
      }
    });
    assert.match(erreurDuree, /durée.*30/i);

    await page.selectOption("#competence", { index:0 });
    await page.evaluate(() => {
      const video = document.getElementById("video");
      video.currentTime = 1;
      document.getElementById("marquerDebut").click();
      video.currentTime = 13;
      document.getElementById("marquerFin").click();
      window.ChronoPage.etat.dureeImage = 1 / 30;
    });

    const affiche = await page.locator("#sortieDuree").textContent();
    assert.equal(affiche.trim(), "1.2");

    /* 347 competences chiffrables, le compte exact du guide — 335 avant que
       Ban n'arrive avec la version 2.0. Les competences sans pourcentage de
       degats n'entrent dans aucun calcul de DPS et restent ecartees. */
    await page.waitForFunction(
      () => /\d+ \/ \d+/.test(document.getElementById("avancement").textContent)
    );
    const avancement = await page.locator("#avancement").textContent();
    assert.match(avancement, /\d+ \/ 347 animations mesurées/);

    /* Une ACTIVE_THIRD sans recharge existe dans le catalogue, donc l'aide
       commune ne doit plus attribuer une recharge a toute mesure unique. */
    const activeThirdSansRecharge = await page.evaluate(() =>
      Object.values(window.SEVEN_DS_COMPETENCES).some(competences =>
        competences.some(c =>
          c.categorie === "ACTIVE_THIRD" && !c.recharge && c.nature !== "non-chiffree"
        )
      )
    );
    assert.equal(activeThirdSansRecharge, true);
    await page.selectOption("#competence", { index:1 });
    const detailUnique = await page.locator("#detail").textContent();
    assert.match(detailUnique, /Une seule fois.*lancement/i);

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

    /* Deux clics dans le meme tour ne doivent pas creer deux soumissions :
       on observe le payload recu par la frontiere Supabase et l'etat visible,
       jamais l'existence du faux client. */
    await page.evaluate(() => {
      window.ChronoPage.etat.dureeImage = 1 / 59.94;
      document.getElementById("repetitions").dispatchEvent(
        new Event("input", { bubbles:true })
      );
      const bouton = document.getElementById("envoyer");
      bouton.click();
      bouton.click();
    });
    assert.equal(await page.locator("#envoyer").isDisabled(), true);
    await page.waitForFunction(() => window.__chronoInserts.length === 1);
    assert.equal(await page.evaluate(() => window.__chronoInserts.length), 1);
    await page.waitForFunction(() =>
      /en attente de validation humaine/i.test(
        document.getElementById("retourEnvoi").textContent
      )
    );
    assert.match(await page.locator("#retourEnvoi").textContent(),
      /en attente de validation humaine/i);
    assert.equal((await page.evaluate(() => window.__chronoInserts[0])).fps, 59.94);

    console.log("chrono-animation.playwright.js : OK");
  } finally {
    await navigateur.close();
    await serveur.close();
  }
})();
