"use strict";

/* CHAQUE VUE A SA PHRASE DE BANNIÈRE, ET LE CSS SAIT L'AFFICHER.

   La bannière porte un texte par vue, écrit en dur dans `index.html` et
   révélé par un sélecteur de `css/ambiance.css`. Les deux listes sont
   séparées de la liste des vues (`ROUTE_VIEWS` de js/metier/routage.js) :
   rien n'obligeait un nouvel onglet à s'y ajouter.

   C'est exactement ce qui est arrivé à « Entraînement » : l'onglet est parti
   en ligne avec une bannière muette, sans qu'aucun test ne bronche. Le
   parcours `tests/ambiance.playwright.js` ne visite que les vues publiques —
   il ne pouvait pas le voir.

   Ce test lit les trois fichiers et exige qu'ils disent la même chose. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const lire = relatif => fs.readFileSync(path.join(RACINE, relatif), "utf8");

const html = lire("index.html");
const css = lire("css/ambiance.css");
const routage = lire("js/metier/routage.js");

const vues = new Set(
  (routage.match(/const ROUTE_VIEWS = new Set\(\[([\s\S]*?)\]\)/) || [])[1]
    .match(/"([^"]+)"/g)
    .map(item => item.slice(1, -1))
);
assert.ok(vues.size >= 11, "ROUTE_VIEWS doit être lisible (" + vues.size + ")");

const phrases = new Map();
const bloc = /<div class="guild-banner-texte" data-vue="([^"]+)">([\s\S]*?)<\/div>/g;
let trouve;
while((trouve = bloc.exec(html)) !== null){
  const titre = (trouve[2].match(/<p class="guild-banner-title">([\s\S]*?)<\/p>/) || [])[1];
  const accroche = (trouve[2].match(/<p class="guild-banner-lead">([\s\S]*?)<\/p>/) || [])[1];
  assert.ok(titre && titre.trim(), "La vue « " + trouve[1] + " » doit avoir un titre de bannière");
  assert.ok(accroche && accroche.trim(), "La vue « " + trouve[1] + " » doit avoir une accroche");
  /* Deux lignes exactement : un titre plus long change la hauteur de la
     bannière d'une vue à l'autre, ce que tests/ambiance.playwright.js refuse. */
  assert.equal((titre.match(/<br>/g) || []).length, 1,
    "Le titre de « " + trouve[1] + " » doit tenir sur deux lignes");
  phrases.set(trouve[1], titre.trim());
}

vues.forEach(vue => {
  assert.ok(phrases.has(vue),
    "La vue « " + vue + " » n'a aucune phrase de bannière dans index.html");
  assert.match(
    css,
    new RegExp('body:has\\(#view-' + vue + '\\.active\\) \\.guild-banner-texte\\[data-vue="' + vue + '"\\]'),
    "css/ambiance.css n'affiche jamais la phrase de « " + vue + " »"
  );
});

phrases.forEach((_, vue) => {
  assert.ok(vues.has(vue),
    "La phrase de bannière « " + vue + " » ne correspond à aucune vue routable");
});

/* Une phrase répétée ferait croire au membre qu'il n'a pas changé de page. */
assert.equal(new Set(phrases.values()).size, phrases.size,
  "Chaque vue doit avoir sa propre phrase de bannière");

console.log("banniere-par-vue : " + phrases.size + " vues, chacune avec sa phrase");
