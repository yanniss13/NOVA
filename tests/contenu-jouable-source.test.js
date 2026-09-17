"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  substituer, filtrerHerosJouables, resoudreLocalisation, comportements,
  listerImages, validerAssets, validerSnapshot
} = require("../outils/fabrication/contenu-jouable.js");

function snapshotNominal(){
  const weapons = ["SwordDual", "Cudgel3c", "Gauntlets"];
  const skills = Array.from({length:18}, (_, index) => ({
    gameId:"calla_skill_" + index,
    descriptionFr:"Compétence " + index,
    descriptionEn:"Skill " + index,
    localisation:{status:"resolved", reason:null},
    effectSourceIds:["skill:calla_skill_" + index]
  }));
  const potentials = Object.fromEntries(weapons.map(weapon => [weapon,
    Array.from({length:10}, (_, index) => ({
      tier:index + 1,
      descriptionFr:"Palier " + (index + 1),
      descriptionEn:"Tier " + (index + 1),
      bonusFr:"Palier " + (index + 1),
      bonusEn:"Tier " + (index + 1),
      effectSourceIds:["potential:khala:" + weapon + ":" + (index + 1)]
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
      "critRate", "critDamage", "critResist", "critDmgResist", "blockDmgResist"
    ].map((stat, index) => [stat, index])), weaponMasteries:weapons.map(weapon => ({
      weaponType:weapon, levels:Array.from({length:5}, (_, index) => ({level:index + 1}))
    })), pvpDmgUp:null, pvpDmgDown:null, coverage:{
      pvpDmgUp:{status:"missing-from-export", provenance:"Table/Actor/HeroStatGroupTable"},
      pvpDmgDown:{status:"missing-from-export", provenance:"Table/Actor/HeroStatGroupTable"}
    }},
    potentials,
    wikiSkills:skills,
    calculatorSkills:skills.slice(0, 15),
    effectSources:{
      skills:skills.map(skill => ({id:skill.effectSourceIds[0], texts:{fr:skill.descriptionFr, en:skill.descriptionEn}, buffs:[]})),
      potentials:Object.values(potentials).flat().map(potential => ({id:potential.effectSourceIds[0], texts:{fr:potential.descriptionFr, en:potential.descriptionEn}, buffs:[]}))
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
    {id:"409100119", internalName:"UnknownOne", nameFr:"Inconnu", weapons:["Axe", "Cudgel3c", "Shield"]},
    {id:"409100124", internalName:"UnknownTwo", nameFr:"Inconnu", weapons:["Rapier", "Book", "Staff"]}
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

const invalidTiers = snapshotNominal();
invalidTiers.heroes.khala.potentials.SwordDual[9].tier = 9;
assert.throws(() => validerSnapshot(invalidTiers), /paliers 1 à 10.*khala\/SwordDual/i,
  "les paliers sont exactement 1 à 10 et uniques par arme");

const incoherentEffect = snapshotNominal();
incoherentEffect.heroes.khala.wikiSkills[0].effectSourceIds = ["skill:autre"];
assert.throws(() => validerSnapshot(incoherentEffect), /source d'effet incohérente.*khala/i,
  "chaque compétence et potentiel déclare son identifiant de source canonique");

const missingKnownLocalization = snapshotNominal();
const eighteenthSkill = missingKnownLocalization.heroes.khala.wikiSkills[17];
eighteenthSkill.descriptionFr = null;
eighteenthSkill.descriptionEn = null;
eighteenthSkill.localisation = {status:"missing-from-export", reason:"localisation non couverte par l'export"};
assert.doesNotThrow(() => validerSnapshot(missingKnownLocalization),
  "la localisation explicitement non couverte est publiée comme null, jamais comme clé brute");
const missingUnannouncedLocalization = snapshotNominal();
missingUnannouncedLocalization.heroes.khala.wikiSkills[0].descriptionFr = null;
missingUnannouncedLocalization.heroes.khala.wikiSkills[0].descriptionEn = null;
assert.throws(() => validerSnapshot(missingUnannouncedLocalization), /localisation de compétence invalide/i);

assert.deepEqual(
  resoudreLocalisation({description:"Dégâts"}, {description:"Damage"}, "description"),
  {fr:"Dégâts", en:"Damage", status:"resolved", reason:null}
);
assert.throws(
  () => resoudreLocalisation({}, {}, "description_absente"),
  /localisation absente ou auto-référente/i,
  "une clé absente ne devient jamais du texte publié"
);
assert.throws(
  () => resoudreLocalisation({description:"description"}, {description:"description"}, "description"),
  /localisation absente ou auto-référente/i,
  "une auto-référence ne devient jamais du texte publié"
);
assert.deepEqual(
  resoudreLocalisation({}, {}, "local_skill_calla_gauntlets_normalskill_desc"),
  {fr:null, en:null, status:"missing-from-export", reason:"localisation non couverte par l'export"},
  "la seule localisation non couverte connue reste explicitement nulle"
);

const lignesBuff = comportements({ActionStart_Behavior_Tid:["behavior"]}, {
  behavior:{BehaviorDetail_SetBuffTid:[{BuffTid:"buff", BuffTime:40000, BuffCnt:2, ConType:"EPackCondType::None"}]}
}, {
  buff:{ApplyType:"EApplyType::Hero", AddAbil_List:[{TargetAbil:"EAbilityType::Wind_Element_Rate", Value:3000}], StackType:{MaxStack:5}}
});
assert.deepEqual(lignesBuff, [{id:"behavior", buffs:[{
  buffTid:"buff", applyType:"Hero", stat:"Wind_Element_Rate", value:3000,
  stack:{applicationCount:2, max:5}, durationMs:40000, trigger:"None"
}], attacks:[]}]);
assert.throws(
  () => comportements({ActionStart_Behavior_Tid:["behavior"]}, {
    behavior:{BehaviorDetail_SetBuffTid:[{BuffTid:"inconnu"}]}
  }, {}),
  /BuffTid absent.*inconnu/i,
  "chaque référence BuffTid est résolue"
);

const tempUi = fs.mkdtempSync(path.join(os.tmpdir(), "khala-uiimg-"));
try {
  const uiRoot = path.join(tempUi, "UIImg");
  fs.mkdirSync(path.join(uiRoot, "Icon_Item", "Skill"), {recursive:true});
  fs.writeFileSync(path.join(uiRoot, "Icon_Item", "Skill", "Calla_Test.png"), "fixture");
  const uiImages = new Set(listerImages(uiRoot, tempUi));
  assert.doesNotThrow(() => validerAssets({
    portrait:{source:"Icon_Item/Skill/Calla_Test.png", target:"7ds-personnages/khala.webp"},
    skills:[], linkedArmors:[]
  }, uiImages));
  assert.throws(() => validerAssets({
    portrait:{source:"Icon_Item/Skill/Inexistant.png", target:"7ds-personnages/khala.webp"},
    skills:[], linkedArmors:[]
  }, uiImages), /asset source absente/i);
  assert.throws(() => validerAssets({
    portrait:{source:"Icon_Item/Skill/Calla_Test.png", target:"7ds-personnages/khala.webp"},
    skills:[{source:"Icon_Item/Skill/Calla_Test.png", target:"7ds-personnages/khala.webp"}], linkedArmors:[]
  }, uiImages), /asset cible dupliquée/i);
  assert.throws(() => validerAssets({
    portrait:{source:"Icon_Item/Skill/Calla_Test.png", target:"../hors-racine.webp"},
    skills:[], linkedArmors:[]
  }, uiImages), /asset cible hors racines autorisées/i);
} finally {
  fs.rmSync(tempUi, {recursive:true, force:true});
}

console.log("contenu-jouable-source.test.js: OK");
