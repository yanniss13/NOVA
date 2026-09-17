"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  substituer, filtrerHerosJouables, resoudreLocalisation, comportements,
  listerImages, validerAssets, preflightHeros, extraireDepuisTables, validerSnapshot
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
      weaponType:weapon, levels:Array.from({length:5}, (_, index) => ({level:index + 1, subLevels:[]}))
    })), commonMasteryStats:[{stat:"B_Atk", value:1}], pvpDmgUp:null, pvpDmgDown:null, coverage:{
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

function tablesPipeline(){
  const weapons = ["SwordDual", "Cudgel3c", "Gauntlets"];
  const fr = {};
  const en = {};
  const localise = (key, frText, enText) => {
    fr[key] = frText || "FR " + key;
    en[key] = enText || "EN " + key;
  };
  localise("khala_name", "Khala", "Calla");
  const defaultWeaponSkills = {};
  const pcSkills = {};
  const skillFields = ["SkillAttack", "SkillActiveNormal", "SkillActiveNormalTag", "SkillActiveSpecial", "SkillActiveThird", "SkillPassive"];
  for(const weapon of weapons) {
    const defaults = {};
    for(const field of skillFields) {
      const id = "fixture_" + weapon + "_" + field;
      defaults[field] = id;
      localise("name_" + id);
      localise("desc_" + id);
      pcSkills[id] = {String_Tid:id, SkillCategory:"ESkillCategory::NormalSkill", Local_Key:"name_" + id,
        Local_Desc:"desc_" + id, Local_Replace:[], Icon:"skill_icon_fixture", Cooltime:0,
        ActionStart_Behavior_Tid:[], Action_Behavior_TidList:[], OnceAction_Behavior_TidList:[]};
    }
    defaultWeaponSkills["calla_" + weapon.toLowerCase() + "_default"] = defaults;
    for(let tier = 1; tier <= 10; tier++) {
      const key = "potential_" + weapon + "_" + tier;
      localise(key);
      defaultWeaponSkills["calla_" + weapon.toLowerCase() + "_grade_" + tier] = {
        Potential_Level:tier, Local_Key:key, Local_Replace:[]
      };
    }
  }
  const weaponMastery = {};
  const weaponMasteryGroupExp = {};
  for(const [index, weapon] of weapons.entries()) for(let level = 1; level <= 5; level++) {
    const key = "mastery_" + weapon + "_" + level;
    const group = "fixture_group_" + (index + 1) + "_" + level;
    localise(key);
    weaponMastery["fixture_mastery_" + (index + 1) + "_" + level] = {
      Weapon_Mastery_Index:level, Weapon_Mastery_Grade:1, Weapon_Mastery_Group:group,
      Weapon_Mastery_AbilityType:[], Weapon_Mastery_AbilityValue:[], Skill_Weapon_Mastery_Desc:key
    };
    // Le niveau 5 n'a aucun sous-palier dans le jeu : la fixture le reproduit.
    if(level === 5) continue;
    // Insérés dans le désordre : l'extracteur doit trier par WeaponGroupEXP_Index.
    for(const subIndex of [3, 1, 2]) {
      weaponMasteryGroupExp[group + "_" + subIndex] = {
        WeaponGroupTid:group, WeaponGroupEXP_Index:subIndex, Mastery_Exp_Value:1000 * subIndex,
        Mastery_AbilityType:["EAbilityType::" + ["B_Atk", "B_Def", "B_MaxHp"][subIndex - 1]],
        Mastery_AbilityValue:[10 * level + subIndex]
      };
    }
  }
  const commonMastery = {
    common_1:{Common_Mastery_Tid:"common", Common_Mastery_Index:1,
      Mastery_AbilityType:["EAbilityType::B_Atk", "EAbilityType::B_Def"], Mastery_AbilityValue:[26, 20]},
    common_2:{Common_Mastery_Tid:"common", Common_Mastery_Index:2,
      Mastery_AbilityType:["EAbilityType::A_Accuracy"], Mastery_AbilityValue:[7]},
    common_3:{Common_Mastery_Tid:"common", Common_Mastery_Index:3,
      Mastery_AbilityType:["EAbilityType::B_Atk"], Mastery_AbilityValue:[26]},
    autre_1:{Common_Mastery_Tid:"autre", Common_Mastery_Index:1,
      Mastery_AbilityType:["EAbilityType::B_Atk"], Mastery_AbilityValue:[999]}
  };
  const equipments = {};
  for(let index = 1; index <= 3; index++) {
    const key = "armor_" + index;
    localise(key);
    equipments["armor_" + index] = {ItemDivision:"EItemDivision::BindArmor", OnlyUse:["1029"], Local_Key:key,
      IconName:"icon_bindarmor_t" + index, grade:"EGrade::SSR", Reinforce_Max:20, Quality_Min:1, Quality_MAX:5};
  }
  const uiImages = new Set([
    "Icon_Item/portrait_Hero/slot_Calla_001.png", "Icon_Item/Skill/Fixture.png",
    "Icon_Item/BindArmor/BindArmor_t1.png", "Icon_Item/BindArmor/BindArmor_t2.png", "Icon_Item/BindArmor/BindArmor_t3.png"
  ]);
  return {
    fr, en, heroMastery:{"1029":{Common_Mastery_Tid:"common", Weapon_1_Mastery_Tid:"fixture_mastery_1_",
      Weapon_2_Mastery_Tid:"fixture_mastery_2_", Weapon_3_Mastery_Tid:"fixture_mastery_3_"}},
    heroActors:{"1029":{StatGroupTid:"stats", Local_Key:"khala_name", grade:"EGrade::SSR"}},
    heroStats:{stats:{B_MaxHp:1, B_Atk:2, B_Def:3, Move_Spd:4, A_Accuracy:5, A_Block:6,
      C_Critical_Rate:7, C_Critical_Dam_Rate:8, C_Critical_ResRate:9, C_Critical_DamRes_Rate:10, D_Block_DamRes_Rate:11}},
    defaultSkills:{"1029":{WeaponType01:"EItemDivision::SwordDual", WeaponType02:"EItemDivision::Cudgel3c", WeaponType03:"EItemDivision::Gauntlets",
      WeaponType01_Roll:"ERole::Attacker", WeaponType02_Roll:"ERole::Attacker", WeaponType03_Roll:"ERole::Attacker",
      WeaponType01_Element:"EElement::Wind", WeaponType02_Element:"EElement::Wind", WeaponType03_Element:"EElement::Wind"}},
    defaultWeaponSkills, pcSkills, pcSkillBehaviors:{}, buffs:{}, weaponMastery, weaponMasteryGroupExp,
    commonMastery, equipments, uiImages,
    skillIcons:new Map([["fixture", "Icon_Item/Skill/Fixture.png"]])
  };
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

const preflight = preflightHeros([
  {id:"1029", internalName:"Calla", nameFr:"Khala", weapons:["SwordDual", "Cudgel3c", "Gauntlets"]},
  {id:"409100119", internalName:"UnknownOne", nameFr:"Inconnu", weapons:["Axe", "Cudgel3c", "Shield"]},
  {id:"409100124", internalName:"UnknownTwo", nameFr:"Inconnu", weapons:["Rapier", "Book", "Staff"]}
]);
assert.equal(preflight.jouables.length, 1, "le préflight CLI utilise le filtre jouable");
assert.deepEqual(preflight.ignored, ["409100119", "409100124"], "le compte des IDs anonymes est calculé");

const extraitPipeline = extraireDepuisTables(tablesPipeline());
const characterPipeline = extraitPipeline.heroes.khala.character;
assert.equal(characterPipeline.pvpDmgUp, null);
assert.equal(characterPipeline.pvpDmgDown, null);
assert.deepEqual(characterPipeline.coverage.pvpDmgUp, {
  status:"missing-from-export", provenance:"Table/Actor/HeroStatGroupTable"
}, "le pipeline publie explicitement la couverture JcJ manquante");
assert.deepEqual(characterPipeline.commonMasteryStats, [
  {stat:"B_Atk", value:52}, {stat:"B_Def", value:20}, {stat:"A_Accuracy", value:7}
], "la maîtrise commune somme les paliers de SON identifiant, dans l'ordre d'apparition des codes");
assert.deepEqual(characterPipeline.weaponMasteries[1].levels[1].subLevels, [
  {exp:1000, abilities:[{stat:"B_Atk", value:21}]},
  {exp:2000, abilities:[{stat:"B_Def", value:22}]},
  {exp:3000, abilities:[{stat:"B_MaxHp", value:23}]}
], "les sous-paliers d'un niveau viennent de son groupe, triés par index");
assert.ok(characterPipeline.weaponMasteries.every(branch => branch.levels[4].subLevels.length === 0),
  "un niveau sans ligne d'expérience publie une liste de sous-paliers vide");

const sansMaitriseCommune = tablesPipeline();
sansMaitriseCommune.commonMastery = {autre_1:sansMaitriseCommune.commonMastery.autre_1};
assert.throws(() => extraireDepuisTables(sansMaitriseCommune), /maîtrise commune absente.*common/i,
  "un identifiant de maîtrise commune sans ligne fait échouer l'extraction");
const sousPalierIncoherent = tablesPipeline();
sousPalierIncoherent.weaponMasteryGroupExp.fixture_group_1_1_1.Mastery_AbilityValue = [];
assert.throws(() => extraireDepuisTables(sousPalierIncoherent), /sous-palier incohérent/i,
  "un sous-palier dont les codes et valeurs divergent fait échouer l'extraction");
const groupesMelanges = tablesPipeline();
groupesMelanges.weaponMastery.fixture_mastery_1_2.Weapon_Mastery_Group = "fixture_group_1_1";
assert.throws(() => extraireDepuisTables(groupesMelanges), /SwordDual.*groupe de maîtrise ambigu/i,
  "deux niveaux ne peuvent pas partager un même groupe de sous-paliers");

const serializedPipeline = JSON.stringify(extraitPipeline);
assert.doesNotMatch(serializedPipeline, /\blocal_[a-z0-9_]+\b/i,
  "le pipeline ne publie aucune clé de localisation brute");
assert.ok(characterPipeline.weaponMasteries.every(branch => branch.levels.every(level => level.nodes.every(node =>
  typeof node.descriptionFr === "string" && typeof node.descriptionEn === "string" && !Object.hasOwn(node, "descriptionKey")
))), "les maîtrises conservent les textes résolus, pas leurs clés");
const iconsPipeline = new Set([
  ...extraitPipeline.heroes.khala.assets.skills,
  ...extraitPipeline.heroes.khala.assets.commonSkills
].map(asset => path.basename(asset.target)));
assert.ok(
  extraitPipeline.heroes.khala.assets.linkedArmors.every(asset =>
    path.basename(asset.target).startsWith("Khala — ")),
  "les armures Khala ont des cibles propres"
);
assert.ok([...extraitPipeline.heroes.khala.wikiSkills, ...extraitPipeline.heroes.khala.calculatorSkills]
  .every(skill => iconsPipeline.has(skill.icone)),
"chaque icône Wiki/calcul est soit exportée soit une cible commune reconnue");
const pipelineIconMissing = tablesPipeline();
pipelineIconMissing.pcSkills.fixture_SwordDual_SkillAttack.Icon = "skill_icon_absente";
assert.throws(() => extraireDepuisTables(pipelineIconMissing), /icône.*absente.*fixture_SwordDual_SkillAttack/i,
  "une icône manquante fait échouer le pipeline complet");

assert.doesNotThrow(() => validerSnapshot(snapshotNominal()),
  "le fixture nominal respecte toutes les cardinalités requises");

const sansSousPaliers = snapshotNominal();
delete sansSousPaliers.heroes.khala.character.weaponMasteries[0].levels[0].subLevels;
assert.throws(() => validerSnapshot(sansSousPaliers), /sous-paliers.*khala/i,
  "chaque niveau de maîtrise déclare ses sous-paliers, même vides");
const sansCommune = snapshotNominal();
sansCommune.heroes.khala.character.commonMasteryStats = [];
assert.throws(() => validerSnapshot(sansCommune), /maîtrise commune.*khala/i,
  "la maîtrise commune ne peut pas être vide");

const placeholder = snapshotNominal();
placeholder.heroes.khala.potentials.SwordDual[0].descriptionFr = "reste {0}";
assert.throws(() => validerSnapshot(placeholder), /placeholder.*khala/i,
  "un placeholder résiduel doit refuser le snapshot");

const rawMasteryKey = snapshotNominal();
rawMasteryKey.heroes.khala.character.weaponMasteries[0].levels[0].descriptionKey = "local_weapon_mastery_desc_test";
assert.throws(() => validerSnapshot(rawMasteryKey), /clé brute interdite.*khala/i,
  "une clé locale de maîtrise est interdite dans le snapshot");

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
assert.deepEqual(
  resoudreLocalisation({}, {}, "local_weapon_mastery_desc_210291000"),
  {fr:null, en:null, status:"missing-from-export", reason:"localisation non couverte par l'export"},
  "la liste fermée des descriptions de maîtrise non exportées conserve une couverture explicite"
);
assert.throws(
  () => resoudreLocalisation({}, {}, "local_weapon_mastery_desc_999999000"),
  /localisation absente ou auto-référente/i,
  "une clé de maîtrise hors allowlist ferme l'extraction"
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
