"use strict";

/* Le catalogue commite est la seule source lue par la PWA. Ce test juge sa
   couverture sans toucher aux fiches publiques qui ont servi a le generer. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

const racine = path.resolve(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "effets-dps.js"), "utf8"),
  bac,
  { filename:"effets-dps.js" }
);
const catalogue = bac.window.SEVEN_DS_EFFETS_DPS;
const bacCompetences = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "competences.js"), "utf8"),
  bacCompetences,
  { filename:"competences.js" }
);

assert.equal(catalogue.version, 1);
assert.equal(catalogue.audit.inconnus, 0);
assert.ok(catalogue.audit.total > 700, "Le catalogue doit couvrir toutes les sources");
assert.ok(catalogue.heroes.merlin.Wand.potentials["10"]);
assert.ok(catalogue.skills.merlin_wand_divine_judgment);

const classifications = new Set([
  "modelise",
  "sans-impact-dps",
  "non-inclus"
]);
catalogue.audit.sources.forEach(source => {
  assert.ok(
    classifications.has(source.classification),
    source.id + " : classification inconnue"
  );
  source.regles.forEach(regle => {
    assert.equal(regle.sourceId, source.id, source.id + " : provenance perdue");
  });
});

assert.equal(
  catalogue.heroes.meliodas.Axe.passives.meliodas_axe_passive.regles[0].valeur,
  9000,
  "Les trois cumuls de Liberation infernale doivent etre actifs"
);

/* Une remise a zero de sa propre recharge existe vraiment sur Diane/Hache.
   Sans exclusion explicite, elle ramenait la recharge a 1 ms et faisait
   deborder la pile avant meme que la fiche puisse s'afficher. */
const dianeAxe = catalogue.heroes.diane.Axe;
const effetsDiane = [
  ...Object.values(dianeAxe.potentials),
  ...Object.values(dianeAxe.passives),
  ...Object.values(catalogue.skills).filter(source =>
    source.hero === "diane" && source.weaponType === "Axe"
  )
].filter(source => source.classification === "modelise");
const competencesDiane = bacCompetences.window.SEVEN_DS_COMPETENCES.diane
  .filter(competence => competence.weaponType === "Axe")
  .concat(Object.entries(catalogue.skills)
    .filter(([, source]) => source.hero === "diane"
      && source.weaponType === "Axe" && source.synthetic)
    .map(([gameId, source]) => Object.assign({ gameId }, plain(source))));
const simulationDiane = plain(loadApp().hooks.simulerDpsCompetences({
  stats:{
    atk:1000, def:500, maxHp:10000, remainingHp:10000,
    attaqueElementaire:0, element:"earth", critRate:0, critDamage:0,
    bonusCategorie:{ "normal-skill":0, special:0, ultimate:0 },
    bonusElementaire:0, bonusGlobal:0
  },
  competences:competencesDiane,
  effets:effetsDiane,
  cible:{
    def:5600, critResist:0, critDmgResist:0,
    resistanceElementaire:0, faiblesse:0
  },
  duree:60
}));
assert.ok(Number.isFinite(simulationDiane.dps));
assert.ok(simulationDiane.nonInclus.some(exclusion =>
  exclusion.id === "skill:diane_axe_skill_rmb_ready"
    && exclusion.raison === "reinitialisation-sans-animation-bornee"
));

console.log(
  "effets DPS : catalogue coherent (" + catalogue.audit.total + " sources)"
);
