"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp, plain } = require("./helpers/load-app");

const ROOT = path.resolve(__dirname, "..");
function catalogueGlobal(file, key){
  const sandbox = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, file), "utf8"),
    sandbox,
    { filename:file }
  );
  return sandbox.window[key];
}

const competencesCatalogue = catalogueGlobal(
  "data/competences.js", "SEVEN_DS_COMPETENCES"
);
const effetsCatalogue = catalogueGlobal(
  "data/effets-dps.js", "SEVEN_DS_EFFETS_DPS"
);
const { hooks } = loadApp();
const { effetsDuBuild, simulerDpsCompetences } = hooks;

const weaponFile = "7ds-armes/Baguette/Baguette de l'âme vorace.webp";
const contexte = plain(effetsDuBuild({
  hero:{
    char:"merlin",
    potentiel:{ tier:10 },
    weapon:weaponFile,
    weaponConfig:{ version:1, overlimit:0 },
    armor:{},
    jewel:{}
  },
  dossierArme:"Baguette",
  catalogue:effetsCatalogue,
  statsResult:{
    totals:[
      { stat:"B_Atk", value:1000 },
      { stat:"B_Def", value:500 },
      { stat:"B_MaxHp", value:10000 },
      { stat:"C_Critical_Rate", value:0 },
      { stat:"C_Critical_Dam_Rate", value:0 },
      { stat:"Thunder_Add", value:0 },
      { stat:"Thunder_Rate", value:0 },
      { stat:"Thunder_Element_Rate", value:0 }
    ],
    facts:{
      passives:[{
        source:"weapon:passive",
        slot:"weapon",
        file:weaponFile,
        level:1,
        status:"valid"
      }]
    }
  }
}));

const competences = competencesCatalogue.merlin
  .filter(competence => competence.weaponType === "Wand")
  .concat(
    Object.entries(effetsCatalogue.skills)
      .filter(([, competence]) => competence.synthetic
        && competence.weaponType === "Wand")
      .map(([gameId, competence]) => Object.assign({ gameId }, plain(competence)))
  );
const cible = {
  def:5600,
  critResist:0,
  critDmgResist:0,
  resistanceElementaire:0,
  faiblesse:0
};
const simuler = effets => plain(simulerDpsCompetences({
  stats:contexte.stats,
  competences,
  effets,
  cible,
  duree:60
}));
const effetsTier6 = contexte.effets.filter(effet =>
  effet.origine !== "potential" || effet.tier <= 6
);
const tier6SansChamp = effetsTier6.map(effet =>
  effet.id === "skill:merlin_wand_skill_q"
    ? Object.assign({}, effet, {
        regles:effet.regles.filter(regle => regle.type !== "recharge-par-impact")
      })
    : effet
);

const avecChamp = simuler(effetsTier6);
const sansReduction = simuler(tier6SansChamp);
const potentiel10 = simuler(contexte.effets);
const usages = (resultat, gameId) => resultat.rotation.filter(
  evenement => evenement.type === "action" && evenement.gameId === gameId
).length;

assert.ok(avecChamp.total > sansReduction.total);
assert.ok(
  usages(avecChamp, "merlin_wand_skill_e_enchant")
      + usages(avecChamp, "merlin_wand_divine_judgment")
    > usages(sansReduction, "merlin_wand_skill_e_enchant")
      + usages(sansReduction, "merlin_wand_divine_judgment"),
  "Jugement divin remplace temporairement la competence normale : les deux "
    + "formes doivent etre comptees ensemble"
);
assert.ok(
  potentiel10.rotation.some(evenement =>
    evenement.gameId === "merlin_wand_divine_judgment"
  )
);
assert.equal(potentiel10.duree, 60);

console.log("dps-merlin.test.js OK");
