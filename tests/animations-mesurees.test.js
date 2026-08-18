"use strict";

/* Les temps d'animation mesures a la main doivent rester rattachables.

   `data/competences.js` est REGENERE a chaque patch : un `gameId` peut
   disparaitre ou changer. `data/animations-mesurees.json`, lui, ne se
   regenere pas - il ne contient que ce qu'un humain a chronometre en jeu,
   parce qu'aucune source publique ne publie ces durees.

   Une mesure orpheline serait donc du travail perdu en silence : la cle ne
   correspondrait plus a rien, et le calcul l'ignorerait sans rien dire. Ce
   test la fait remonter tant qu'elle est encore rattrapable. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "competences.js"), "utf8"),
  bac
);
const catalogue = bac.window.SEVEN_DS_COMPETENCES;
assert.ok(catalogue, "Le catalogue de competences doit s'exposer sur window");

const fichier = path.join(racine, "data", "animations-mesurees.json");
const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
assert.equal(typeof brut.animations, "object",
  "le fichier doit porter un objet « animations »");
assert.ok(brut.animations !== null, "« animations » ne doit pas etre nul");

const gameIds = new Set();
for(const liste of Object.values(catalogue)){
  for(const skill of liste || []) if(skill && skill.gameId) gameIds.add(skill.gameId);
}
assert.ok(gameIds.size > 300, "catalogue trop maigre, recu : " + gameIds.size);

const orphelines = [];
const aberrantes = [];
for(const [cle, valeur] of Object.entries(brut.animations)){
  if(!gameIds.has(cle)) orphelines.push(cle);
  /* Une animation se compte en secondes. Zero voudrait dire « instantanee »,
     ce qui rendrait un DPS infini ; au-dela de trente secondes on a saisi
     autre chose que la duree d'un coup. */
  if(typeof valeur !== "number" || !Number.isFinite(valeur)
    || valeur <= 0 || valeur > 30){
    aberrantes.push(cle + " = " + JSON.stringify(valeur));
  }
}

assert.deepEqual(orphelines, [],
  "mesures rattachees a aucune competence du catalogue");
assert.deepEqual(aberrantes, [],
  "mesures hors des bornes plausibles (0 s exclu, 30 s max)");

const mesurees = Object.keys(brut.animations).length;
const aMesurer = [...gameIds].length;
console.log("animations-mesurees.test.js OK ("
  + mesurees + " mesure(s) sur " + aMesurer + " competences, aucune orpheline)");
