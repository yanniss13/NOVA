"use strict";

/* Le catalogue des jauges de relève, lu comme le navigateur : un simple
   fichier de données, sans réseau. Il ne ré-extrait RIEN — l'outil dépend d'un
   chemin local hors dépôt, et `npm test` ne doit pas en dépendre. */

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

const jauges = lire("jauges-releve.js").SEVEN_DS_JAUGES_RELEVE;
const wiki = lire("wiki-competences.js").SEVEN_DS_WIKI_COMPETENCES;

assert.ok(jauges && typeof jauges === "object", "le catalogue doit être un objet");

const entrees = Object.entries(jauges);
assert.ok(
  entrees.length >= 380,
  "catalogue anormalement maigre, reçu : " + entrees.length
);

const IDENTIFIANT = /^[a-z0-9]+(_[a-z0-9]+)+$/;
entrees.forEach(([id, valeur]) => {
  assert.match(id, IDENTIFIANT, "identifiant mal formé : " + id);
  assert.equal(typeof valeur, "number", id + " : la jauge doit être un nombre");
  assert.ok(Number.isInteger(valeur) && valeur >= 0,
    id + " : jauge invalide, reçu " + valeur);
});

/* LE CATALOGUE COUVRE CE QU'UNE ROTATION PEUT CONTENIR, et rien d'autre.

   Les passifs sortent — on ne les lance pas, ils ne sont pas dans la palette.
   Tout le reste doit être là : une compétence sans jauge connue ferait
   silencieusement disparaître une relève. */
const parCategorie = new Map();
Object.values(wiki).forEach(liste => (liste || []).forEach(competence => {
  parCategorie.set(competence.gameId, competence.categorie);
}));

const manquantes = [...parCategorie]
  .filter(([id, categorie]) => categorie !== "PASSIVE"
    && !Object.prototype.hasOwnProperty.call(jauges, id))
  .map(([id]) => id);
assert.deepEqual(
  manquantes, [],
  "des compétences posables n'ont pas de jauge : " + manquantes.join(", ")
);

const passifs = Object.keys(jauges).filter(id => parCategorie.get(id) === "PASSIVE");
assert.deepEqual(passifs, [], "un passif n'a rien à faire ici : " + passifs.join(", "));

/* LE PIÈGE QUI JUSTIFIE CE FICHIER, et qu'on refuse de reperdre.

   Le wiki publie la chaîne d'auto-attaques sous l'identifiant `..._jumpatk`.
   Dans la table du jeu, cet identifiant désigne l'attaque SAUTÉE — une autre
   compétence, à zéro de jauge. Une jointure naïve sur le gameId donnerait donc
   zéro à toutes les auto-attaques, et l'auto-attaque est ce qu'on enchaîne le
   plus. La valeur retenue est la somme de la chaîne `normalatk_*`.

   Si cette assertion tombe, c'est que l'outil est revenu à la jointure
   naïve. */
const autos = [...parCategorie]
  .filter(([, categorie]) => categorie === "NORMAL")
  .map(([id]) => id);
const autosMuettes = autos.filter(id => !jauges[id]);
assert.deepEqual(
  autosMuettes, [],
  "des auto-attaques à zéro de jauge — la jointure a repris l'identifiant du "
    + "saut : " + autosMuettes.slice(0, 5).join(", ")
);
assert.ok(autos.length >= 70, "il manque des auto-attaques, reçu : " + autos.length);

/* Une COMPÉTENCE DE RELÈVE ne remplit pas la jauge : elle la dépense. */
const relevesQuiRemplissent = [...parCategorie]
  .filter(([id, categorie]) => categorie === "TAG_SKILL" && jauges[id])
  .map(([id]) => id + " = " + jauges[id]);
assert.deepEqual(
  relevesQuiRemplissent, [],
  "une relève ne remplit pas la jauge : " + relevesQuiRemplissent.join(", ")
);

/* Quelques valeurs témoins, écrites en clair. Si le jeu les change, ce test
   tombe et le modèle de rotation est à relire — c'est le but. */
assert.equal(jauges.ban_gauntlets_skill_e, 181, "le E de Ban aux gantelets");
assert.equal(jauges.ban_gauntlets_jumpatk, 76, "la chaîne d'autos de Ban aux gantelets");
assert.equal(jauges.ban_cudgel3c_skill_e, 151, "le E de Ban au nunchaku");

const remplissantes = entrees.filter(([, valeur]) => valeur > 0);
console.log(
  "jauges-releve : catalogue cohérent (" + entrees.length + " compétences, "
  + remplissantes.length + " remplissent la jauge, max "
  + Math.max(...entrees.map(([, valeur]) => valeur)) + ")"
);
