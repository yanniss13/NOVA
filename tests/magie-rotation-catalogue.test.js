"use strict";

/* Le catalogue livre au navigateur les deux colonnes de magie dont la
   rotation a besoin. Les donnees du client restent hors depot : ce test porte
   donc sur l'artefact commite, comme le test des jauges de releve. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");

/* La source directe est celle de la passe courante : elle doit primer sur un
   dossier d'archives plus ancien, sans introduire de chemin local dans les
   artefacts versionnes. */
const { sourceDirecte, choisirSource } = require(path.join(
  racine, "outils", "fabrication", "ecrire-magie-rotation.js"
));
const exportDirect = path.join("D:", "export-courant", "Content");
assert.equal(
  sourceDirecte({
    DONNEES_JEU: exportDirect,
    DONNEES_JEU_SOURCES: path.join("D:", "exports-anciens")
  }),
  path.join(exportDirect, "Table", "Skill", "PC_SkillTable.json"),
  "DONNEES_JEU doit primer sur DONNEES_JEU_SOURCES"
);
assert.equal(sourceDirecte({}), null, "sans export direct, la selection retombe sur les archives");
assert.throws(
  () => choisirSource({
    DONNEES_JEU_SOURCES: path.join(racine, "absent-pour-le-test-magie-rotation")
  }),
  /PC_SkillTable\.json introuvable/,
  "sans source, l'erreur doit nommer PC_SkillTable.json"
);

// Deux archives existent, dont la plus recente porte un nom trie avant
// l'ancienne. Une inversion de priorite ou un tri par nom doit echouer ici.
const dossierSources = fs.mkdtempSync(path.join(os.tmpdir(), "magie-sources-"));
try {
  const directe = path.join(dossierSources, "courant", "Table", "Skill", "PC_SkillTable.json");
  const archives = path.join(dossierSources, "archives");
  const recente = path.join(archives, "Exports-a", "SevenDeadlySins", "Content", "Table", "Skill", "PC_SkillTable.json");
  const ancienne = path.join(archives, "Exports-z", "SevenDeadlySins", "Content", "Table", "Skill", "PC_SkillTable.json");
  for(const [fichier, date] of [[directe, 1000], [ancienne, 2000], [recente, 3000]]){
    fs.mkdirSync(path.dirname(fichier), { recursive:true });
    fs.writeFileSync(fichier, "{}");
    fs.utimesSync(fichier, date, date);
  }
  const env = {
    DONNEES_JEU:path.join(dossierSources, "courant"),
    DONNEES_JEU_SOURCES:archives
  };
  assert.equal(choisirSource(env), directe,
    "l'export direct prime meme sur une archive plus recente");
  assert.equal(choisirSource({ DONNEES_JEU_SOURCES:archives }), recente,
    "sans export direct, choisir le fichier d'archive le plus recent");
  assert.equal(choisirSource({ ...env, DONNEES_JEU:path.join(dossierSources, "absent") }), recente,
    "un export direct absent permet le repli sur les archives");
} finally {
  fs.rmSync(dossierSources, { recursive:true, force:true });
}

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

const competencesPosables = [...categories]
  .filter(([, categorie]) => categorie !== "PASSIVE")
  .map(([id]) => id)
  .sort();
assert.deepEqual(
  Object.keys(magie).sort(), competencesPosables,
  "les cles de magie doivent etre exactement les competences posables du Wiki"
);

const khala = wiki.khala.filter(skill => skill.categorie !== "PASSIVE");
khala.forEach(skill => assert.ok(
  Object.prototype.hasOwnProperty.call(magie, skill.gameId),
  "magie absente pour " + skill.gameId
));

const entrees = Object.entries(magie);
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
