"use strict";

/* Normalise le sous-ensemble jouable d'un export local deja produit.
   Cet outil ne lit jamais une archive du jeu et ne conserve aucun chemin local
   dans sa sortie. */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const HERO_ID = "1029";
const HERO_SLUG = "khala";
const HERO_IDS_EXCLUS = new Set(["409100119", "409100124"]);
const LOCALISATIONS_NON_COUVERTES = new Set([
  "local_skill_calla_gauntlets_normalskill_desc",
  ...["210291", "210292", "210293"].flatMap(prefix => Array.from({length:21},
    (_, index) => "local_weapon_mastery_desc_" + prefix + String(index).padStart(3, "0")))
]);
const ASSET_TARGET_PREFIXES = [
  "7ds-personnages/", "7ds-ui/skills/", "7ds-armures-ssr/Armure liee/"
];
const COMMON_REPOSITORY_ICONS = {
  SwordDual:"7ds-ui/skills/common_SwordDual_normalAttack.webp",
  Cudgel3c:"7ds-ui/skills/common_Cudgel3c_normalAttack.webp",
  Gauntlets:"7ds-ui/skills/common_Gauntlets_normalAttack.webp",
  TagSkill:"7ds-ui/skills/Icon_TagSkill.webp"
};
const COMMON_EXPORT_ICONS = new Map([
  [cleIcone("skill_icon_common_tagskill"), "Icon_Item/Skill/Icon_TagSkill.png"]
]);
const WEAPON_FOLDERS = {
  SwordDual:"Epees doubles", Cudgel3c:"Nunchaku", Gauntlets:"Gantelets"
};
const CATEGORY = {
  NormalAttack:"NORMAL", NormalSkill:"NORMAL_SKILL",
  NormalSkillChangeTagLink:"TAG_SKILL", UltimateSKill:"ULTIMATE",
  ActiveThird:"ACTIVE_THIRD"
};
const SKILL_FIELDS = [
  "SkillAttack", "SkillActiveNormal", "SkillActiveNormalTag",
  "SkillActiveSpecial", "SkillActiveThird"
];
const WIKI_FIELDS = [...SKILL_FIELDS, "SkillPassive"];
const BASE_STATS = {
  B_MaxHp:"baseHp", B_Atk:"baseAtk", B_Def:"baseDef", Move_Spd:"baseSpd",
  A_Accuracy:"accuracy", A_Block:"block", C_Critical_Rate:"critRate",
  C_Critical_Dam_Rate:"critDamage", C_Critical_ResRate:"critResist",
  C_Critical_DamRes_Rate:"critDmgResist", D_Block_DamRes_Rate:"blockDmgResist",
  Pvp_DamAdd_Rate:"pvpDmgUp", Pvp_DamRes_Rate:"pvpDmgDown"
};

function substituer(texte, remplacements){
  let sortie = String(texte || "");
  for(const brut of remplacements || []){
    const match = /^\{(\d+)\}:\{(.*)\}$/.exec(String(brut));
    if(match) sortie = sortie.split("{" + match[1] + "}").join(match[2]);
  }
  return sortie;
}

function filtrerHerosJouables(heroes){
  return heroes.filter(hero => !HERO_IDS_EXCLUS.has(String(hero.id))
    && hero.nameFr && hero.internalName
    && Array.isArray(hero.weapons) && hero.weapons.length === 3);
}

function lireTable(racine, relatif){
  const brut = JSON.parse(fs.readFileSync(path.join(racine, "Table", relatif), "utf8"));
  return (Array.isArray(brut) ? brut[0] : brut).Rows || {};
}

function lireLocalisation(racine, langue){
  const fichier = path.join(racine, "Localization", "Game", langue, "Game.json");
  const table = JSON.parse(fs.readFileSync(fichier, "utf8")).client_language_table || {};
  Object.defineProperty(table, "__lower", {value:new Map(
    Object.entries(table).map(([key, value]) => [key.toLowerCase(), value])
  )});
  return table;
}

function valeurLocalisee(table, cle){
  if(!cle || cle === "None") return undefined;
  const value = table[cle] === undefined ? table.__lower && table.__lower.get(String(cle).toLowerCase()) : table[cle];
  return value === undefined ? undefined : String(value);
}

function localisation(table, cle){
  return valeurLocalisee(table, cle) || "";
}

function estLocalisationInvalide(value, cle){
  return value === undefined || value === null || !String(value).trim()
    || String(value).trim().toLowerCase() === String(cle).trim().toLowerCase();
}

function resoudreLocalisation(fr, en, cle, remplacements){
  const frBrut = valeurLocalisee(fr, cle);
  const enBrut = valeurLocalisee(en, cle);
  if(estLocalisationInvalide(frBrut, cle) || estLocalisationInvalide(enBrut, cle)) {
    if(LOCALISATIONS_NON_COUVERTES.has(String(cle).toLowerCase())
      && estLocalisationInvalide(frBrut, cle) && estLocalisationInvalide(enBrut, cle)) {
      return {fr:null, en:null, status:"missing-from-export", reason:"localisation non couverte par l'export"};
    }
    throw new Error("localisation absente ou auto-référente : " + cle);
  }
  const result = {fr:substituer(frBrut, remplacements), en:substituer(enBrut, remplacements), status:"resolved", reason:null};
  if(/\{\d+\}/.test(result.fr) || /\{\d+\}/.test(result.en)) {
    throw new Error("placeholder résiduel dans la localisation : " + cle);
  }
  return result;
}

function sansEnum(value){
  return String(value || "").replace(/^E[A-Za-z_]+::/, "");
}

function cleIcone(icon){
  return String(icon || "").replace(/^skill_icon_/, "").replace(/skillpassive/i, "passive")
    .replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function cheminImageIcone(icon, tables){
  if(tables && tables.skillIcons && tables.skillIcons.has(cleIcone(icon))) return tables.skillIcons.get(cleIcone(icon));
  const common = COMMON_EXPORT_ICONS.get(cleIcone(icon));
  if(common && tables && tables.uiImages && tables.uiImages.has(common)) return common;
  return null;
}

function resoudreIcone(skill, weaponType, tables){
  const source = cheminImageIcone(skill.Icon, tables);
  if(source) return {source, target:"7ds-ui/skills/" + path.basename(source).replace(/\.png$/i, ".webp"), kind:"export"};
  const target = skill.SkillCategory === "ESkillCategory::NormalAttack" && COMMON_REPOSITORY_ICONS[weaponType];
  if(target && fs.existsSync(path.join(ROOT, target))) return {source:null, target, kind:"common"};
  throw new Error("icône absente pour " + skill.String_Tid);
}

function heroDepuisTables(tables){
  const mastery = tables.heroMastery[HERO_ID];
  const actor = tables.heroActors[HERO_ID];
  const stat = actor && tables.heroStats[actor.StatGroupTid];
  const defaults = tables.defaultSkills[HERO_ID];
  if(!mastery || !actor || !stat || !defaults) throw new Error("Khala : tables de héros incomplètes");

  const weapons = [1, 2, 3].map(index => sansEnum(defaults["WeaponType0" + index]));
  if(new Set(weapons).size !== 3 || weapons.some(weapon => !WEAPON_FOLDERS[weapon])) {
    throw new Error("Khala : armes incompatibles dans DefaultSkillTable");
  }
  const slots = weapons.map((weapon, index) => ({
    weapon,
    role:sansEnum(defaults["WeaponType0" + (index + 1) + "_Roll"]),
    element:sansEnum(defaults["WeaponType0" + (index + 1) + "_Element"])
  }));
  const baseStats = {};
  for(const [source, target] of Object.entries(BASE_STATS)) {
    if(typeof stat[source] === "number") baseStats[target] = stat[source];
    else if(target === "pvpDmgUp" || target === "pvpDmgDown") baseStats[target] = null;
    else throw new Error("Khala : statistique absente " + source);
  }

  const name = resoudreLocalisation(tables.fr, tables.en, actor.Local_Key);
  const character = {
    id:HERO_ID, slug:HERO_SLUG, nameFr:name.fr,
    nameEn:name.en, rarity:sansEnum(actor.grade),
    role:slots[0].role.toUpperCase(), element:slots[0].element.toUpperCase(),
    portraitUrl:"/images/characters/khala.webp", weaponSlots:slots,
    commonMasteryTid:mastery.Common_Mastery_Tid,
    commonMasteryStats:maitriseCommune(tables.commonMastery, mastery.Common_Mastery_Tid), ...baseStats,
    coverage:{
      pvpDmgUp:{status:"missing-from-export", provenance:"Table/Actor/HeroStatGroupTable"},
      pvpDmgDown:{status:"missing-from-export", provenance:"Table/Actor/HeroStatGroupTable"}
    },
    weaponMasteries:masteries(mastery, weapons, tables.weaponMastery, tables.fr, tables.en, tables.weaponMasteryGroupExp)
  };
  return { actor, mastery, weapons, slots, character };
}

function gains(types, values, contexte){
  if(!Array.isArray(types) || !Array.isArray(values) || types.length !== values.length
    || values.some(value => typeof value !== "number")) throw new Error(contexte);
  return types.map((type, index) => ({stat:sansEnum(type), value:values[index]}));
}

/* Maîtrise commune : la somme de tous les paliers de l'identifiant du héros,
   par code et dans l'ordre où le jeu les nomme. */
function maitriseCommune(table, tid){
  const rows = Object.values(table || {})
    .filter(row => String(row.Common_Mastery_Tid) === String(tid))
    .sort((a, b) => a.Common_Mastery_Index - b.Common_Mastery_Index);
  if(!rows.length) throw new Error("maîtrise commune absente pour " + tid);
  const totals = new Map();
  for(const row of rows) for(const {stat, value} of gains(row.Mastery_AbilityType, row.Mastery_AbilityValue,
    "palier de maîtrise commune incohérent : " + tid)) totals.set(stat, (totals.get(stat) || 0) + value);
  return [...totals].map(([stat, value]) => ({stat, value}));
}

/* Sous-paliers d'un niveau de maîtrise d'arme : les lignes d'expérience de
   son groupe, triées par index. Un niveau sans ligne en publie zéro. */
function sousPaliers(table, group){
  return Object.values(table || {})
    .filter(row => String(row.WeaponGroupTid) === String(group))
    .sort((a, b) => a.WeaponGroupEXP_Index - b.WeaponGroupEXP_Index)
    .map(row => {
      if(typeof row.Mastery_Exp_Value !== "number") throw new Error("sous-palier incohérent : " + group);
      return {exp:row.Mastery_Exp_Value, abilities:gains(row.Mastery_AbilityType, row.Mastery_AbilityValue,
        "sous-palier incohérent : " + group)};
    });
}

function masteries(mastery, weapons, table, fr, en, groupExp){
  return weapons.map((weapon, index) => {
    const tid = String(mastery["Weapon_" + (index + 1) + "_Mastery_Tid"] || "");
    const nodes = Object.entries(table)
      .filter(([id]) => id.startsWith(tid))
      .map(([id, node]) => {
        const description = resoudreLocalisation(fr, en, node.Skill_Weapon_Mastery_Desc);
        const coverage = description.status === "missing-from-export" ? {
          status:"missing-from-export", provenance:"Localization/Game/fr+en", reason:description.reason
        } : null;
        return { id, level:node.Weapon_Mastery_Index, grade:node.Weapon_Mastery_Grade,
          group:node.Weapon_Mastery_Group, abilities:(node.Weapon_Mastery_AbilityType || []).map(sansEnum),
          values:node.Weapon_Mastery_AbilityValue || [], descriptionFr:description.fr,
          descriptionEn:description.en, provenance:"Table/HeroMastery/HeroWeaponMastery",
          coverage };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const levels = [...new Set(nodes.map(node => node.level))];
    if(levels.length !== 5) throw new Error("Khala/" + weapon + " : maîtrise sans cinq niveaux");
    const groupes = levels.map(level => [...new Set(nodes.filter(node => node.level === level).map(node => String(node.group)))]);
    if(groupes.some(groupe => groupe.length !== 1) || new Set(groupes.flat()).size !== levels.length) {
      throw new Error("Khala/" + weapon + " : groupe de maîtrise ambigu");
    }
    return { weaponType:weapon, levels:levels.map((level, rang) => ({ level,
      subLevels:sousPaliers(groupExp, groupes[rang][0]), nodes:nodes.filter(node => node.level === level) })) };
  });
}

function competence(id, weaponType, tables, field){
  const raw = tables.pcSkills[id];
  if(!raw) throw new Error("Khala : compétence absente " + id);
  const category = sansEnum(raw.SkillCategory);
  const normalizedCategory = field === "SkillPassive" && category === "None"
    ? "PASSIVE" : CATEGORY[category] || category.toUpperCase();
  const gameId = normalizedCategory === "PASSIVE" ? "calla_" + weaponType.toLowerCase() + "_passive" : id;
  const name = resoudreLocalisation(tables.fr, tables.en, raw.Local_Key);
  const description = resoudreLocalisation(tables.fr, tables.en, raw.Local_Desc, raw.Local_Replace);
  const icon = resoudreIcone(raw, weaponType, tables);
  const sourceId = (normalizedCategory === "PASSIVE" ? "hero-passive:" : "skill:") + gameId;
  const cooldown = Number(raw.Cooltime || 0) / 1000;
  const recharge = cooldown === 0 && ["NORMAL", "TAG_SKILL"].includes(normalizedCategory) ? null : cooldown;
  return {
    gameId, sourceGameId:id, weaponType, skillCategory:normalizedCategory, categorie:normalizedCategory,
    nomFr:name.fr, nom:name.en, nameEn:name.en, descriptionFr:description.fr,
    descriptionEn:description.en, localisation:{status:description.status, reason:description.reason},
    recharge, cooldown:recharge, portee:sansEnum(raw.SkillDamType) || null,
    icone:path.basename(icon.target),
    effectSourceIds:[sourceId], sourceBehaviors:comportements(raw, tables.pcSkillBehaviors, tables.buffs)
  };
}

function lignesBuff(behaviorId, setBuffs, buffTable){
  return (setBuffs || []).map(setBuff => {
    const buffTid = setBuff && setBuff.BuffTid;
    const buff = buffTable && buffTable[buffTid];
    if(!buffTid || buffTid === "None" || !buff) throw new Error("BuffTid absent pour " + behaviorId + " : " + buffTid);
    const stats = (buff.AddAbil_List || []).filter(row => row && sansEnum(row.TargetAbil) !== "None");
    const common = {
      buffTid, applyType:sansEnum(buff.ApplyType),
      stack:{applicationCount:Number(setBuff.BuffCnt || 0), max:Number(buff.StackType && buff.StackType.MaxStack || 0)},
      durationMs:Number(setBuff.BuffTime), trigger:sansEnum(setBuff.ConType)
    };
    return stats.length ? stats.map(row => ({...common, stat:sansEnum(row.TargetAbil), value:row.Value}))
      : [{...common, stat:null, value:null}];
  }).flat();
}

function comportements(skill, table, buffTable = {}){
  const ids = [];
  for(const field of ["ActionStart_Behavior_Tid", "Action_Behavior_TidList", "OnceAction_Behavior_TidList"]) {
    for(const value of skill[field] || []) {
      if(typeof value === "string" && value !== "None") ids.push(value);
      for(const nested of value && value.Array || []) if(nested !== "None") ids.push(nested);
    }
  }
  return [...new Set(ids)].map(id => {
    const behavior = table[id] || {};
    const buffs = lignesBuff(id, behavior.BehaviorDetail_SetBuffTid, buffTable);
    const attacks = behavior.BehaviorDetail_AttackTid || [];
    return buffs.length || attacks.length ? {id, buffs, attacks} : null;
  }).filter(Boolean);
}

function potentiels(weapons, tables){
  const result = {};
  for(const weapon of weapons){
    const prefix = "calla_" + weapon.toLowerCase() + "_grade_";
    const list = Object.entries(tables.defaultWeaponSkills)
      .filter(([id]) => id.startsWith(prefix))
      .map(([id, row]) => {
        const text = resoudreLocalisation(tables.fr, tables.en, row.Local_Key, row.Local_Replace);
        const tier = Number(row.Potential_Level);
        return {tier, weaponType:weapon, bonusFr:text.fr, bonusEn:text.en,
          effectSourceIds:["potential:" + HERO_SLUG + ":" + weapon + ":" + tier]};
      })
      .sort((a, b) => a.tier - b.tier);
    const tiers = list.map(potential => potential.tier);
    if(tiers.length !== 10 || tiers.some((tier, index) => tier !== index + 1)) {
      throw new Error("Khala/" + weapon + " : paliers de potentiel requis de 1 à 10");
    }
    result[weapon] = list;
  }
  return result;
}

function effectSources(skills, potentials){
  const sourceForSkill = skill => ({
    id:skill.effectSourceIds[0],
    kind:skill.skillCategory === "PASSIVE" ? "hero-passive" : "skill", hero:HERO_SLUG,
    weaponType:skill.weaponType, gameId:skill.gameId, textFr:skill.descriptionFr,
    textEn:skill.descriptionEn, coefficientDejaCalcule:skill.skillCategory !== "PASSIVE",
    provenance:"Table/Skill/PC_SkillTable", localisation:skill.localisation, buffs:skill.sourceBehaviors
  });
  return {
    skills:skills.map(sourceForSkill),
    potentials:Object.values(potentials).flat().map(potential => ({
      id:potential.effectSourceIds[0],
      kind:"potential", hero:HERO_SLUG, weaponType:potential.weaponType, tier:potential.tier,
      textFr:potential.bonusFr, textEn:potential.bonusEn,
      provenance:"Table/Skill/DefaultSkillWeaponTypeTable", buffs:[]
    }))
  };
}

function linkedArmors(tables){
  return Object.entries(tables.equipments)
    .filter(([, item]) => item.ItemDivision === "EItemDivision::BindArmor"
      && (item.OnlyUse || []).map(String).includes(HERO_ID))
    .map(([gameId, item]) => {
      const name = resoudreLocalisation(tables.fr, tables.en, item.Local_Key);
      return { gameId, nameFr:name.fr, nameEn:name.en, weaponType:(item.BindArmor_RecommendEquip_WeaponType || [])[0] || null,
      icon:item.IconName, grade:sansEnum(item.grade), reinforceMax:item.Reinforce_Max,
      quality:{min:item.Quality_Min, max:item.Quality_MAX}, mainStats:item.Growth_Ability_Main || [],
      subStats:item.Growth_Ability_Sub || [], options:item.Equip_Option || [],
      passives:item.Equip_Passive || [], limitBreakPassives:item.LimitBreak_Passive || [] };
    })
    .sort((a, b) => a.gameId.localeCompare(b.gameId));
}

function assets(tables, hero, skills, armors){
  const icons = skills.map(skill => resoudreIcone(tables.pcSkills[skill.sourceGameId], skill.weaponType, tables));
  const skillAssets = [...new Map(icons.filter(icon => icon.kind === "export"
    && icon.target !== COMMON_REPOSITORY_ICONS.TagSkill)
    .map(icon => [icon.source, {source:icon.source, target:icon.target}])).values()];
  const commonSkills = [...new Map(icons.filter(icon => icon.kind === "common"
    || icon.target === COMMON_REPOSITORY_ICONS.TagSkill)
    .map(icon => [icon.target, {target:icon.target, provenance:"repository/7ds-ui/skills"}])).values()];
  return {
    portrait:{source:"Icon_Item/portrait_Hero/slot_Calla_001.png", target:"7ds-personnages/khala.webp"},
    skills:skillAssets, commonSkills,
    linkedArmors:armors.map(armor => ({
      source:"Icon_Item/BindArmor/" + armor.icon.replace(/^icon_bindarmor_/, "BindArmor_").replace(/_pc_/i, "_PC_").replace(/_calla_/i, "_Calla_") + ".png",
      target:"7ds-armures-ssr/Armure liee/Khala — " + armor.nameFr + ".webp"
    }))
  };
}

function validerAssets(descriptors, uiImages){
  const all = [descriptors.portrait, ...(descriptors.skills || []), ...(descriptors.linkedArmors || [])];
  const targets = new Set();
  for(const asset of all){
    if(!asset || !uiImages || !uiImages.has(asset.source)) throw new Error("asset source absente : " + (asset && asset.source));
    const target = String(asset.target || "").split("\\").join("/");
    if(path.isAbsolute(target) || target.includes("../") || !ASSET_TARGET_PREFIXES.some(prefix => target.startsWith(prefix))) {
      throw new Error("asset cible hors racines autorisées : " + target);
    }
    if(targets.has(target)) throw new Error("asset cible dupliquée : " + target);
    targets.add(target);
  }
  for(const asset of descriptors.commonSkills || []){
    const target = String(asset.target || "").split("\\").join("/");
    if(!COMMON_REPOSITORY_ICONS || !Object.values(COMMON_REPOSITORY_ICONS).includes(target)
      || asset.provenance !== "repository/7ds-ui/skills" || !fs.existsSync(path.join(ROOT, target))) {
      throw new Error("icône commune absente : " + target);
    }
    if(targets.has(target)) throw new Error("asset cible dupliquée : " + target);
    targets.add(target);
  }
}

function extraireDepuisTables(tables){
  const hero = heroDepuisTables(tables);
  const allSkills = [];
  const calculatorSkills = [];
  for(const weapon of hero.weapons){
    const defaults = tables.defaultWeaponSkills["calla_" + weapon.toLowerCase() + "_default"];
    if(!defaults) throw new Error("Khala/" + weapon + " : compétences par défaut absentes");
    for(const field of WIKI_FIELDS) {
      const id = defaults[field];
      if(!id || id === "None") throw new Error("Khala/" + weapon + " : " + field + " absent");
      const skill = competence(id, weapon, tables, field);
      allSkills.push(skill);
      if(SKILL_FIELDS.includes(field)) calculatorSkills.push(skill);
    }
  }
  const allPotentials = potentiels(hero.weapons, tables);
  const armors = linkedArmors(tables);
  const assetDescriptors = assets(tables, hero, allSkills, armors);
  if(tables.uiImages) validerAssets(assetDescriptors, tables.uiImages);
  const snapshot = {version:1, heroes:{khala:{
    id:HERO_ID, internalName:"Calla", nameFr:hero.character.nameFr, nameEn:hero.character.nameEn,
    meta:{role:hero.character.role, rarity:hero.character.rarity, weapons:hero.slots},
    character:hero.character, potentials:allPotentials, wikiSkills:allSkills,
    calculatorSkills, effectSources:effectSources(allSkills, allPotentials), linkedArmors:armors,
    assets:assetDescriptors
  }}};
  validerSnapshot(snapshot);
  return snapshot;
}

function walk(value, visitor){
  if(typeof value === "string") return visitor(value);
  if(Array.isArray(value)) value.forEach(item => walk(item, visitor));
  else if(value && typeof value === "object") Object.values(value).forEach(item => walk(item, visitor));
}

function validerSnapshot(snapshot){
  const hero = snapshot && snapshot.version === 1 && snapshot.heroes && snapshot.heroes.khala;
  if(!hero || Object.keys(snapshot.heroes).length !== 1) throw new Error("snapshot Khala absent ou version incompatible");
  walk(hero, text => {
    if(/\{\d+\}/.test(text)) throw new Error("placeholder résiduel dans khala");
    if(/^local_[a-z0-9_]+$/i.test(text)) throw new Error("clé brute interdite dans khala");
  });
  const weapons = hero.meta && hero.meta.weapons || [];
  if(weapons.length !== 3 || new Set(weapons.map(item => item.weapon)).size !== 3) throw new Error("trois armes uniques requises pour khala");
  for(const weapon of weapons.map(item => item.weapon)) {
    const potentials = hero.potentials && hero.potentials[weapon];
    if(!Array.isArray(potentials) || potentials.length !== 10) throw new Error("dix potentiels requis pour khala/" + weapon);
    if(potentials.some((potential, index) => potential.tier !== index + 1)) throw new Error("paliers 1 à 10 requis pour khala/" + weapon);
    if(potentials.some(potential => typeof potential.bonusFr !== "string" || typeof potential.bonusEn !== "string")) throw new Error("textes de potentiels requis pour khala/" + weapon);
  }
  if(!Array.isArray(hero.wikiSkills) || hero.wikiSkills.length !== 18) throw new Error("18 compétences Wiki requises pour khala");
  if(!Array.isArray(hero.calculatorSkills) || hero.calculatorSkills.length !== 15) throw new Error("15 compétences de calcul requises pour khala");
  const stats = hero.character && ["baseHp", "baseAtk", "baseDef", "baseSpd", "accuracy", "block", "critRate", "critDamage", "critResist", "critDmgResist", "blockDmgResist"];
  if(!stats || stats.some(stat => typeof hero.character[stat] !== "number")
    || hero.character.pvpDmgUp !== null || hero.character.pvpDmgDown !== null
    || ["pvpDmgUp", "pvpDmgDown"].some(stat => !hero.character.coverage
      || hero.character.coverage[stat].status !== "missing-from-export"
      || !hero.character.coverage[stat].provenance)) throw new Error("statistiques de base ou couverture JcJ invalides pour khala");
  const masteries = hero.character.weaponMasteries || hero.character.masteries || [];
  const branches = Array.isArray(masteries) ? masteries : Object.values(masteries);
  if(branches.length !== 3 || branches.some(branch => !Array.isArray(branch.levels || branch) || (branch.levels || branch).length !== 5)) throw new Error("trois branches de maîtrise à cinq niveaux requises pour khala");
  if(branches.some(branch => (branch.levels || branch).some(level => !Array.isArray(level.subLevels)))) {
    throw new Error("sous-paliers de maîtrise requis pour khala");
  }
  if(!Array.isArray(hero.character.commonMasteryStats) || !hero.character.commonMasteryStats.length) {
    throw new Error("maîtrise commune requise pour khala");
  }
  const masteryNodes = branches.flatMap(branch => (branch.levels || branch).flatMap(level => level.nodes || []));
  if(masteryNodes.some(node => {
    const resolved = typeof node.descriptionFr === "string" && typeof node.descriptionEn === "string" && node.coverage === null;
    const missing = node.descriptionFr === null && node.descriptionEn === null && node.coverage
      && node.coverage.status === "missing-from-export" && node.coverage.provenance === "Localization/Game/fr+en";
    return !resolved && !missing;
  })) throw new Error("localisation de maîtrise invalide pour khala");
  if(!Array.isArray(hero.linkedArmors) || hero.linkedArmors.length !== 3) throw new Error("trois armures liées requises pour khala");
  const sources = [...(hero.effectSources && hero.effectSources.skills || []), ...(hero.effectSources && hero.effectSources.potentials || [])];
  const ids = new Set(sources.map(source => source.id));
  if(ids.size !== sources.length) throw new Error("sources d'effet dupliquées pour khala");
  for(const source of sources) {
    if(!Object.hasOwn(source, "textFr") || !Object.hasOwn(source, "textEn") || Object.hasOwn(source, "texts")) {
      throw new Error("textes d'effet requis sous textFr/textEn pour khala");
    }
  }
  for(const skill of hero.wikiSkills) {
    const expected = (skill.skillCategory === "PASSIVE" ? "hero-passive:" : "skill:") + skill.gameId;
    if(!Array.isArray(skill.effectSourceIds) || skill.effectSourceIds.length !== 1
      || skill.effectSourceIds[0] !== expected) throw new Error("source d'effet incohérente pour khala");
    if(!ids.has(expected)) throw new Error("source d'effet absente pour khala");
    const missing = skill.descriptionFr === null && skill.descriptionEn === null
      && skill.localisation && skill.localisation.status === "missing-from-export"
      && skill.localisation.reason === "localisation non couverte par l'export";
    const resolved = typeof skill.descriptionFr === "string" && typeof skill.descriptionEn === "string"
      && skill.localisation && skill.localisation.status === "resolved" && skill.localisation.reason === null;
    if(!missing && !resolved) throw new Error("localisation de compétence invalide pour khala");
    const source = sources.find(item => item.id === expected);
    if(source.textFr !== skill.descriptionFr || source.textEn !== skill.descriptionEn) {
      throw new Error("textes d'effet incohérents pour khala");
    }
  }
  for(const [weapon, potentials] of Object.entries(hero.potentials || {})) for(const potential of potentials) {
    const expected = "potential:" + HERO_SLUG + ":" + weapon + ":" + potential.tier;
    if(!Array.isArray(potential.effectSourceIds) || potential.effectSourceIds.length !== 1
      || potential.effectSourceIds[0] !== expected) throw new Error("source d'effet incohérente pour khala");
    if(!ids.has(expected)) throw new Error("source d'effet absente pour khala");
    const source = sources.find(item => item.id === expected);
    if(source.textFr !== potential.bonusFr || source.textEn !== potential.bonusEn) {
      throw new Error("textes d'effet incohérents pour khala");
    }
  }
}

function extraireContenu(racine){
  return extraireDepuisTables(chargerTables(racine));
}

function chargerTables(racine){
  const tables = {
    fr:lireLocalisation(racine, "fr"), en:lireLocalisation(racine, "en"),
    heroMastery:lireTable(racine, "HeroMastery/HeroMastery.json"),
    heroActors:lireTable(racine, "Actor/HeroActorTable.json"), heroStats:lireTable(racine, "Actor/HeroStatGroupTable.json"),
    defaultSkills:lireTable(racine, "Skill/DefaultSkillTable.json"), defaultWeaponSkills:lireTable(racine, "Skill/DefaultSkillWeaponTypeTable.json"),
    pcSkills:lireTable(racine, "Skill/PC_SkillTable.json"), pcSkillBehaviors:lireTable(racine, "Skill/PC_SkillBehaviorTable.json"),
    buffs:lireTable(racine, "Buff/BuffTable.json"),
    weaponMastery:lireTable(racine, "HeroMastery/HeroWeaponMastery.json"),
    weaponMasteryGroupExp:lireTable(racine, "HeroMastery/HeroWeaponMasteryGroupExp.json"),
    commonMastery:lireTable(racine, "HeroMastery/HeroCommonMastery.json"), equipments:lireTable(racine, "Item/ItemTable_Data_Equip.json")
  };
  tables.uiImages = new Set(listerImages(path.join(racine, "UIImg"), racine));
  tables.skillIcons = new Map([...tables.uiImages]
    .filter(image => image.startsWith("Icon_Item/Skill/"))
    .map(image => [cleIcone(path.basename(image, ".png")), image]));
  return tables;
}

function candidatsHeros(tables){
  return Object.keys(tables.heroMastery).map(id => {
    const actor = tables.heroActors[id] || {};
    const defaults = tables.defaultSkills[id] || {};
    return {
      id, internalName:actor.String_Tid || actor.InternalName || id,
      nameFr:localisation(tables.fr, actor.Local_Key),
      weapons:[1, 2, 3].map(index => sansEnum(defaults["WeaponType0" + index])).filter(Boolean)
    };
  });
}

function preflightHeros(heroes){
  return {
    jouables:filtrerHerosJouables(heroes),
    ignored:heroes.filter(hero => HERO_IDS_EXCLUS.has(String(hero.id))).map(hero => String(hero.id))
  };
}

function listerImages(directory, racine, found = []){
  for(const entry of fs.readdirSync(directory, {withFileTypes:true})){
    const absolute = path.join(directory, entry.name);
    if(entry.isDirectory()) listerImages(absolute, racine, found);
    else if(entry.isFile() && /\.png$/i.test(entry.name)) {
      found.push(path.relative(path.join(racine, "UIImg"), absolute).split(path.sep).join("/"));
    }
  }
  return found;
}

function main(){
  const racine = process.env.DONNEES_JEU;
  if(!racine) throw new Error("DONNEES_JEU doit désigner le dossier Content exporté");
  const tables = chargerTables(racine);
  const candidats = candidatsHeros(tables);
  const {jouables, ignored} = preflightHeros(candidats);
  if(!jouables.some(hero => hero.id === HERO_ID)) throw new Error("Khala absente de la liste des héros jouables");
  const snapshot = extraireDepuisTables(tables);
  const sortie = path.join(ROOT, "7ds-stats", "contenu-jeu.json");
  const temporaire = sortie + ".tmp";
  fs.writeFileSync(temporaire, JSON.stringify(snapshot, null, 1) + "\n", "utf8");
  fs.renameSync(temporaire, sortie);
  console.log(Object.keys(snapshot.heroes).length + " héros jouable extrait : khala");
  console.log(ignored.length + " entrées anonymes ignorées : " + ignored.join(", "));
  console.log("écrit : 7ds-stats/contenu-jeu.json");
}

if(require.main === module) main();

module.exports = {substituer, filtrerHerosJouables, lireTable, resoudreLocalisation,
  comportements, listerImages, validerAssets, preflightHeros, extraireDepuisTables, extraireContenu, validerSnapshot,
  maitriseCommune, sousPaliers, chargerTables};
