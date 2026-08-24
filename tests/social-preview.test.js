"use strict";

/* Contrat vu par les robots qui construisent l'aperçu d'un lien. Le test lit
   la vraie page servie puis télécharge l'image déclarée : une balise correcte
   qui pointerait vers un fichier absent ne doit pas passer. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");

const URL_SITE = "https://yanniss13.github.io/NOVA/";
const URL_IMAGE = URL_SITE + "nova-banniere-etendue.png";

function attributs(source){
  return Object.fromEntries(
    [...source.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)]
      .map(capture => [capture[1].toLowerCase(), capture[2]])
  );
}

function balises(html, nom){
  return [...html.matchAll(new RegExp("<" + nom + "\\b[^>]*>", "gi"))]
    .map(capture => attributs(capture[0]));
}

(async () => {
  const serveur = await serveRepo();
  try{
    const reponse = await fetch(serveur.url + "/");
    assert.equal(reponse.status, 200, "la page publique doit être servie");
    const html = await reponse.text();
    const metas = balises(html, "meta");
    const liens = balises(html, "link");
    const meta = (champ, valeur) => metas.find(item => item[champ] === valeur);

    assert.equal(
      liens.find(item => item.rel === "canonical")?.href,
      URL_SITE,
      "l'aperçu doit annoncer l'URL canonique publique"
    );
    assert.equal(meta("property", "og:type")?.content, "website");
    assert.equal(meta("property", "og:locale")?.content, "fr_FR");
    assert.equal(meta("property", "og:site_name")?.content, "NOVA");
    assert.equal(
      meta("property", "og:title")?.content,
      "NOVA — Confrérie 7DS Origin"
    );
    assert.ok(meta("property", "og:description")?.content,
      "une description Open Graph doit accompagner la bannière");
    assert.equal(meta("property", "og:url")?.content, URL_SITE);
    assert.equal(meta("property", "og:image")?.content, URL_IMAGE);
    assert.equal(meta("property", "og:image:type")?.content, "image/png");
    assert.equal(meta("property", "og:image:width")?.content, "1920");
    assert.equal(meta("property", "og:image:height")?.content, "1080");
    assert.ok(meta("property", "og:image:alt")?.content,
      "la bannière doit avoir une alternative textuelle");

    assert.equal(meta("name", "twitter:card")?.content,
      "summary_large_image");
    assert.equal(meta("name", "twitter:title")?.content,
      "NOVA — Confrérie 7DS Origin");
    assert.equal(meta("name", "twitter:image")?.content, URL_IMAGE);
    assert.ok(meta("name", "twitter:image:alt")?.content,
      "Twitter/X doit recevoir l'alternative de la bannière");

    const image = await fetch(serveur.url + "/nova-banniere-etendue.png");
    assert.equal(image.status, 200, "la bannière déclarée doit être publiée");
    assert.equal(image.headers.get("content-type"), "image/png");
    const pixels = Buffer.from(await image.arrayBuffer());
    assert.equal(pixels.subarray(1, 4).toString("ascii"), "PNG",
      "le fichier annoncé comme PNG doit réellement en être un");
    assert.equal(pixels.readUInt32BE(16), 1920, "largeur réelle de la bannière");
    assert.equal(pixels.readUInt32BE(20), 1080, "hauteur réelle de la bannière");

    console.log("social-preview.test.js OK (Open Graph + Twitter, 1920x1080)");
  }finally{
    await serveur.close();
  }
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
