"use strict";

/* Le catalogue livre au navigateur les deux colonnes de magie dont la
   rotation a besoin. Les donnees du client restent hors depot : ce test porte
   donc sur l'artefact commite, comme le test des jauges de releve. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const lire = fichier => {
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window;
};

assert.ok(
  fs.existsSync(path.join(racine, "data", "magie-rotation.js")),
  "data/magie-rotation.js doit etre genere depuis PC_SkillTable"
);
const magie = lire("magie-rotation.js").SEVEN_DS_MAGIE_ROTATION;
const wiki = lire("wiki-competences.js").SEVEN_DS_WIKI_COMPETENCES;

assert.ok(magie && typeof magie === "object", "le catalogue doit etre un objet");

const categories = new Map();
Object.values(wiki).forEach(liste => (liste || []).forEach(competence => {
  categories.set(competence.gameId, competence.categorie);
}));

const manquantes = [...categories]
  .filter(([id, categorie]) => categorie !== "PASSIVE"
    && !Object.prototype.hasOwnProperty.call(magie, id))
  .map(([id]) => id);
assert.deepEqual(
  manquantes, [],
  "des competences posables n'ont pas de donnees de magie : "
    + manquantes.join(", ")
);

const entrees = Object.entries(magie);
assert.ok(entrees.length >= 380, "catalogue anormalement maigre : " + entrees.length);
entrees.forEach(([id, regle]) => {
  assert.equal(typeof regle, "object", id + " : regle absente");
  assert.ok(Number.isInteger(regle.recharge) && regle.recharge >= 0,
    id + " : recharge invalide");
  assert.ok(Number.isInteger(regle.cout) && regle.cout >= 0 && regle.cout <= 7,
    id + " : cout invalide");
  if(categories.get(id) !== "ULTIMATE"){
    assert.equal(regle.cout, 0, id + " : seule une attaque ultime coute des boules");
  }
});

/* Le wiki publie la chaine d'attaques normales sous l'identifiant du saut,
   qui vaut zero dans PC_SkillTable. Le generateur doit sommer
   `normalatk_1..N`, exactement comme pour la jauge de releve. */
assert.deepEqual(
  JSON.parse(JSON.stringify(magie.ban_gauntlets_jumpatk)),
  { recharge:26, cout:0 },
  "la chaine d'attaques normales de Ban vaut 4 + 4 + 6 + 12"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(magie.ban_gauntlets_skill_e)),
  { recharge:144, cout:0 },
  "la competence normale lit UI_MagicForceGauge"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(magie.ban_gauntlets_skill_r)),
  { recharge:0, cout:2 },
  "l'ultime lit UseMagicForceStack"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(magie.derieri_gauntlets_skill_r_enchant)),
  { recharge:0, cout:0 },
  "Etoile combo est explicitement gratuite dans le jeu"
);

console.log("magie-rotation-catalogue.test.js OK (" + entrees.length + " competences)");
