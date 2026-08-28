"use strict";

/* La fiche d'Akumu est une page AUTONOME, servie a la racine a cote de
   index.html : un lien qu'on colle dans Discord, qui n'ouvre pas l'application.

   Ce parcours verifie qu'elle porte bien ses donnees et qu'elle herite du style
   du site. Il ne mesure aucune largeur en pixels : les polices du runner Linux
   sont plus larges qu'en local, et un seuil absolu passerait ici pour casser le
   deploiement. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  const errors = [];
  const ratees = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("response", r => { if(r.status() >= 400) ratees.push(r.url()); });

  try{
    await page.goto(server.url + "/akumu.html");

    assert.equal(await page.locator("h1").textContent(), "Akumu, bête démoniaque");

    /* Les trente paliers sont ecrits par le script : s'il ne tourne pas, le
       tableau reste vide et la fiche perd sa raison d'etre. */
    const lignes = page.locator("#akNiveaux tr");
    assert.equal(await lignes.count(), 30, "les trente niveaux doivent etre rendus");
    assert.deepEqual(
      await lignes.first().locator("td").allTextContents(),
      ["1", "8 795", "3 454", "2 090 121"].map(t => t.replace(/ /g, "\u202f")),
      "le premier palier doit porter les chiffres du client, en format francais"
    );
    assert.equal(
      (await lignes.last().textContent()).replace(/\s/g, ""),
      "3014658280264214755600",
      "le dernier palier est le niveau 30"
    );

    /* Le piege des cinq pierres : quatre pastilles allumees, une eteinte. */
    assert.equal(await page.locator(".ak-tally span").count(), 5);
    assert.equal(await page.locator(".ak-tally span.on").count(), 4,
      "la rangee doit montrer quatre pierres sur cinq, l'etat qui ne donne rien");

    /* L'habillage vient de css/base.css : sans lui, la page tomberait sur le
       fond blanc du navigateur au lieu de l'obsidienne du site. */
    const fond = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor);
    assert.notEqual(fond, "rgba(0, 0, 0, 0)", "le fond du site doit s'appliquer");
    assert.notEqual(fond, "rgb(255, 255, 255)", "la feuille du site n'est pas chargee");

    /* Elle ne doit PAS enregistrer le service worker : seul index.html le fait,
       et une seconde inscription depuis une page annexe brouillerait le cycle
       de mise a jour choisi par le membre. */
    const html = await page.content();
    assert.doesNotMatch(html, /serviceWorker\.register/,
      "la fiche ne doit pas enregistrer le service worker");

    /* Le lien affilie remunere le proprietaire : il doit survivre aux retouches
       de cette page, avec les attributs qui declarent la remuneration. Les
       reponses >= 400 sont deja refusees plus bas, donc une image cassee
       ferait echouer ce parcours. */
    const lootbar = page.locator("#lootbarLink");
    assert.equal(await lootbar.count(), 1, "le lien LootBar doit rester dans l'en-tete");
    assert.equal(
      await lootbar.getAttribute("href"),
      "https://www.lootbar.com/a/raTV3p",
      "le lien affilie doit porter le code du proprietaire"
    );
    assert.equal(
      await lootbar.getAttribute("rel"),
      "sponsored noopener noreferrer",
      "un lien remunere se declare, et n'ouvre pas d'acces a cette page"
    );

    const retour = page.locator(".ak-back");
    assert.equal(await retour.getAttribute("href"), "index.html",
      "la fiche doit ramener au site");

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
    assert.deepEqual(ratees, [], "aucune ressource manquante attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: fiche Akumu, page autonome");
})();
