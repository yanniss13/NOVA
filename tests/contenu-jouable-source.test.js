"use strict";

const assert = require("node:assert/strict");
const {
  substituer, filtrerHerosJouables, validerSnapshot
} = require("../outils/fabrication/contenu-jouable.js");

function snapshotNominal(){
  const weapons = ["SwordDual", "Cudgel3c", "Gauntlets"];
  const skills = Array.from({length:18}, (_, index) => ({
    gameId:"calla_skill_" + index,
    descriptionFr:"Compétence " + index,
    descriptionEn:"Skill " + index,
    effectSourceId:index < 3 ? "skill:calla_skill_" + index : null
  }));
  const potentials = Object.fromEntries(weapons.map(weapon => [weapon,
    Array.from({length:10}, (_, index) => ({
      tier:index + 1,
      descriptionFr:"Palier " + (index + 1),
      descriptionEn:"Tier " + (index + 1),
      effectSourceId:index === 0 ? "potential:" + weapon + ":1" : null
    }))
  ]));
  return {version:1, heroes:{khala:{
    id:"1029",
    internalName:"Calla",
    nameFr:"Khala",
    nameEn:"Calla",
    meta:{weapons:weapons.map(weapon => ({weapon}))},
    character:{...Object.fromEntries([
      "baseHp", "baseAtk", "baseDef", "baseSpd", "accuracy", "block",
      "critRate", "critDamage", "critResist", "critDmgResist", "blockDmgResist",
      "pvpDmgUp", "pvpDmgDown"
    ].map((stat, index) => [stat, index])), weaponMasteries:weapons.map(weapon => ({
      weaponType:weapon, levels:Array.from({length:5}, (_, index) => ({level:index + 1}))
    }))},
    potentials,
    wikiSkills:skills,
    calculatorSkills:skills.slice(0, 15),
    effectSources:{
      skills:skills.slice(0, 3).map(skill => ({id:skill.effectSourceId, texts:{fr:skill.descriptionFr, en:skill.descriptionEn}, buffs:[]})),
      potentials:weapons.map(weapon => ({id:"potential:" + weapon + ":1", texts:{fr:"Palier", en:"Tier"}, buffs:[]}))
    },
    linkedArmors:[{id:"armor-1"}, {id:"armor-2"}, {id:"armor-3"}],
    assets:{portrait:{source:"slot_Calla_001.png", target:"7ds-personnages/khala.webp"}, skills:[], linkedArmors:[]}
  }}};
}

assert.equal(
  substituer("Inflige {0} pendant {1}s.", ["{0}:{294%}", "{1}:{10}"]),
  "Inflige 294% pendant 10s."
);

assert.deepEqual(
  filtrerHerosJouables([
    {id:"1029", internalName:"Calla", nameFr:"Khala", weapons:["SwordDual", "Cudgel3c", "Gauntlets"]},
    {id:"409100119", internalName:null, nameFr:null, weapons:["Axe", "Cudgel3c", "Shield"]},
    {id:"409100124", internalName:null, nameFr:null, weapons:["Rapier", "Book", "Staff"]}
  ]).map(hero => hero.id),
  ["1029"],
  "seul le héros localisé qui possède exactement trois armes est jouable"
);

assert.doesNotThrow(() => validerSnapshot(snapshotNominal()),
  "le fixture nominal respecte toutes les cardinalités requises");

const placeholder = snapshotNominal();
placeholder.heroes.khala.potentials.SwordDual[0].descriptionFr = "reste {0}";
assert.throws(() => validerSnapshot(placeholder), /placeholder.*khala/i,
  "un placeholder résiduel doit refuser le snapshot");

const wrongCount = snapshotNominal();
wrongCount.heroes.khala.wikiSkills.pop();
assert.throws(() => validerSnapshot(wrongCount), /18.*compétences wiki.*khala/i,
  "une fiche wiki incomplète doit refuser le snapshot");

const missingEffect = snapshotNominal();
missingEffect.heroes.khala.effectSources.skills.pop();
assert.throws(() => validerSnapshot(missingEffect), /source d'effet.*khala/i,
  "chaque compétence déclarant un effet doit conserver sa source bilingue"
);

console.log("contenu-jouable-source.test.js: OK");
