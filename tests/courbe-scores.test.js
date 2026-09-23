"use strict";

/* L'échelle verticale de la courbe de scores, partagée par l'entraînement et
   par la progression hebdomadaire du boss de guilde. Le module n'a aucun
   import : on le charge seul dans un contexte `vm`. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { plain } = require("./helpers/load-app");

const source = fs
  .readFileSync(path.join(__dirname, "..", "js", "metier", "courbe-scores.js"), "utf8")
  .replace(/export\s*\{[^}]*\};?/, "");
const contexte = {};
vm.runInNewContext(source + `
this.__api = { echelleCourbeScores, resumeCourbeScores };`, contexte, { filename:"courbe-scores.js" });
const api = contexte.__api;

/* LA RÈGLE QUI COMPTE : elle ne part pas de zéro.

   Une confrérie progresse par paliers de quelques pour cent. Cadrée sur
   zéro, cette série s'écrase en un filet plat dans le haut du cadre et la
   progression qu'on vient consulter devient invisible. C'est le défaut qui
   a motivé cette fonction ; sans cette assertion, un « max(0, …) » de trop
   la ferait silencieusement revenir. */
const serrees = ["212000","218500","216000","231000","240500","255500"];
const echelle = plain(api.echelleCourbeScores(serrees));
assert.ok(echelle.bas > 200000,
  "l'échelle doit se cadrer sur les données, pas sur zéro (bas=" + echelle.bas + ")");
/* …tout en contenant réellement les données : un cadrage serré qui coupe
   un point serait pire que le vide qu'on vient de supprimer. */
assert.ok(echelle.bas < 212000 && echelle.haut > 255500,
  "l'échelle doit contenir toute la série");
/* La courbe doit occuper l'essentiel de sa hauteur, sinon rien n'est gagné. */
assert.ok((255500 - 212000) / (echelle.haut - echelle.bas) > 0.6,
  "la série doit occuper plus de 60 % de la hauteur");
/* Graduations : des ENTIERS multiples du pas — formatBossScore() les relit
   en BigInt et rendrait « — » sur une décimale. */
assert.ok(echelle.graduations.length >= 2, "au moins deux graduations");
echelle.graduations.forEach(valeur => {
  assert.ok(Number.isInteger(valeur), "graduation entière : " + valeur);
  assert.equal(valeur % echelle.pas, 0, "graduation sur le pas : " + valeur);
  assert.ok(valeur >= echelle.bas && valeur <= echelle.haut,
    "graduation dans le cadre : " + valeur);
});

/* Séries sans étendue : un seul point, ou deux fois le même score. Sans
   garde, l'amplitude vaut zéro et toute division rend NaN — la courbe
   disparaîtrait au lieu d'afficher son point. */
[["188000"], ["188000","188000","188000"]].forEach(plate => {
  const cadre = plain(api.echelleCourbeScores(plate));
  assert.ok(cadre.haut > cadre.bas, "une série plate garde une hauteur");
  assert.ok(cadre.bas < 188000 && cadre.haut > 188000, "le point reste dans le cadre");
  assert.ok(cadre.graduations.every(Number.isInteger), "graduations entières");
});
assert.equal(api.echelleCourbeScores([]), null);

/* Les semaines du boss de guilde se comptent en centaines de millions : le
   pas doit suivre la magnitude, sans quoi la courbe porterait des milliers
   de graduations. */
const grandes = plain(api.echelleCourbeScores(["212000000","255500000"]));
assert.ok(grandes.graduations.length <= 12,
  "une série à neuf chiffres garde un nombre de graduations lisible");

/* Résumé : record, dernier point, écart au record. Au-delà de 2^53 sans
   perte — un Number tronquerait le record en silence. */
const serieResume = ["9007199254740993","100","200"].map(score => ({ score }));
assert.deepEqual(plain(api.resumeCourbeScores(serieResume)),
  { meilleur:"9007199254740993", dernier:"200", ecart:"-9007199254740793" });
assert.equal(api.resumeCourbeScores([]), null);

console.log("courbe-scores: ok");
