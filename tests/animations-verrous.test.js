"use strict";

/* Les verrous d'animation deduits des fichiers du jeu.

   Contrairement a `data/animations-mesurees.json`, ce fichier se REGENERE
   (`node outils/fmodel/ecrire-verrous.js`). Il n'en est pas moins fragile :
   `data/competences.js` se regenere lui aussi, et un `gameId` qui change
   laisserait un verrou rattache a rien, ignore en silence par le simulateur.

   Ce test verifie aussi la regle de priorite : une mesure faite a la main doit
   toujours pouvoir ecraser une valeur deduite. Si les deux fichiers portaient
   des cles de nature differente, la fusion de `fiche-heros.js` ne le ferait
   pas. */

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

const brut = JSON.parse(
  fs.readFileSync(path.join(racine, "data", "animations-verrous.json"), "utf8")
);
assert.equal(typeof brut.animations, "object",
  "le fichier doit porter un objet « animations »");
assert.ok(brut.animations !== null, "« animations » ne doit pas etre nul");

const gameIds = new Set();
const categories = {};
for(const liste of Object.values(catalogue)){
  for(const skill of liste || []){
    if(skill && skill.gameId){
      gameIds.add(skill.gameId);
      categories[skill.gameId] = skill.categorie;
    }
  }
}

const orphelins = [];
const aberrants = [];
for(const [cle, valeur] of Object.entries(brut.animations)){
  if(!gameIds.has(cle)) orphelins.push(cle);
  /* Zero est desormais une VALEUR, pas une absence : « relancable
     aussitot » est une reponse, et la publier evite d'envoyer quelqu'un
     chronometrer ce que le jeu dit deja. Une absence signale une vraie
     inconnue. Au-dela de trente secondes, ce n'est plus un coup. */
  if(typeof valeur !== "number" || !Number.isFinite(valeur)
    || valeur < 0 || valeur > 30){
    aberrants.push(cle + " = " + JSON.stringify(valeur));
  }
}
assert.deepEqual(orphelins, [],
  "verrous rattaches a aucune competence du catalogue");
assert.deepEqual(aberrants, [],
  "verrous hors des bornes plausibles (0 s admis, 30 s max)");

/* Le releve du client dit que les ultimes immobilisent et que les attaques
   normales non. Si cette repartition s'inversait, c'est que le sens des
   fenetres aurait ete perdu quelque part entre l'extraction et le fichier. */
const parCategorie = {};
for(const [cle, valeur] of Object.entries(brut.animations)){
  const c = categories[cle] || "?";
  const p = parCategorie[c] || (parCategorie[c] = { n:0, somme:0 });
  p.n++; p.somme += valeur;
}
assert.ok(parCategorie.ULTIMATE && parCategorie.ULTIMATE.n > 50,
  "les ultimes doivent porter un verrou, recu : "
    + JSON.stringify(parCategorie.ULTIMATE));
const moyenneUltime = parCategorie.ULTIMATE.somme / parCategorie.ULTIMATE.n;
assert.ok(moyenneUltime > 1,
  "un ultime immobilise plus d'une seconde, moyenne recue : "
    + moyenneUltime.toFixed(3));

/* La priorite : `animations-mesurees.json` fait foi la ou il parle. Les deux
   fichiers doivent donc etre indexes de la meme facon. */
const mesurees = JSON.parse(
  fs.readFileSync(path.join(racine, "data", "animations-mesurees.json"), "utf8")
).animations || {};
const inconnues = Object.keys(mesurees).filter(cle => !gameIds.has(cle));
assert.deepEqual(inconnues, [],
  "une mesure manuelle doit viser une competence connue pour pouvoir ecraser");

console.log("animations-verrous.test.js OK ("
  + Object.keys(brut.animations).length + " verrou(s), dont "
  + parCategorie.ULTIMATE.n + " ultimes a "
  + moyenneUltime.toFixed(2) + " s de moyenne)");
