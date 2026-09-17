"use strict";

/* Normalise le sous-ensemble jouable d'un export FModel deja produit.
   Cet outil ne lit jamais une archive du jeu et ne conserve aucun chemin local
   dans sa sortie. */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const HERO_ID = "1029";
const HERO_SLUG = "khala";
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
/* Les deux coefficients JcJ ne figurent pas dans HeroStatGroupTable : le
   client applique ces constantes communes aux 26 héros déjà catalogués. */
const PVP_DEFAULTS = {pvpDmgUp:150, pvpDmgDown:125};

function substituer(texte, remplacements){
  let sortie = String(texte || "");
  for(const brut of remplacements || []){
    const match = /^\{(\d+)\}:\{(.*)\}$/.exec(String(brut));
    if(match) sortie = sortie.split("{" + match[1] + "}").join(match[2]);
  }
  return sortie;
}

function filtrerHerosJouables(heroes){
  return heroes.filter(hero => hero.nameFr && hero.internalName
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

function localisation(table, cle){
  if(!cle || cle === "None") return "";
  const value = table[cle] === undefined ? table.__lower && table.__lower.get(String(cle).toLowerCase()) : table[cle];
  return value === undefined ? "" : String(value);
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
  const nom = String(icon || "").replace(/^skill_icon_/, "");
  if(!/^calla_/i.test(nom)) return null;
  const pieces = nom.split("_").map(part => part.charAt(0).toUpperCase() + part.slice(1));
  return "Icon_Item/Skill/" + pieces.join("_") + ".png";
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
    else if(Object.hasOwn(PVP_DEFAULTS, target)) baseStats[target] = PVP_DEFAULTS[target];
    else throw new Error("Khala : statistique absente " + source);
  }

  const character = {
    id:HERO_ID, slug:HERO_SLUG, nameFr:localisation(tables.fr, actor.Local_Key),
    nameEn:localisation(tables.en, actor.Local_Key), rarity:sansEnum(actor.grade),
    role:slots[0].role.toUpperCase(), element:slots[0].element.toUpperCase(),
    portraitUrl:"/images/characters/khala.webp", weaponSlots:slots,
    commonMasteryTid:mastery.Common_Mastery_Tid, ...baseStats,
    weaponMasteries:masteries(mastery, weapons, tables.weaponMastery)
  };
  return { actor, mastery, weapons, slots, character };
}

function masteries(mastery, weapons, table){
  return weapons.map((weapon, index) => {
    const tid = String(mastery["Weapon_" + (index + 1) + "_Mastery_Tid"] || "");
    const nodes = Object.entries(table)
      .filter(([id]) => id.startsWith(tid))
      .map(([id, node]) => ({ id, level:node.Weapon_Mastery_Index,
        grade:node.Weapon_Mastery_Grade, group:node.Weapon_Mastery_Group,
        abilities:(node.Weapon_Mastery_AbilityType || []).map(sansEnum),
        values:node.Weapon_Mastery_AbilityValue || [], descriptionKey:node.Skill_Weapon_Mastery_Desc }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const levels = [...new Set(nodes.map(node => node.level))];
    if(levels.length !== 5) throw new Error("Khala/" + weapon + " : maîtrise sans cinq niveaux");
    return { weaponType:weapon, levels:levels.map(level => ({ level, nodes:nodes.filter(node => node.level === level) })) };
  });
}

function competence(id, weaponType, tables){
  const raw = tables.pcSkills[id];
  if(!raw) throw new Error("Khala : compétence absente " + id);
  const category = sansEnum(raw.SkillCategory);
  return {
    gameId:id, weaponType, skillCategory:CATEGORY[category] || category.toUpperCase(),
    categorie:CATEGORY[category] || category.toUpperCase(),
    nomFr:localisation(tables.fr, raw.Local_Key), nom:localisation(tables.en, raw.Local_Key),
    nameEn:localisation(tables.en, raw.Local_Key), descriptionFr:substituer(localisation(tables.fr, raw.Local_Desc), raw.Local_Replace),
    descriptionEn:substituer(localisation(tables.en, raw.Local_Desc), raw.Local_Replace),
    recharge:Number(raw.Cooltime || 0) / 1000, cooldown:Number(raw.Cooltime || 0) / 1000,
    icone:cheminImageIcone(raw.Icon, tables) ? path.basename(cheminImageIcone(raw.Icon, tables)).replace(/\.png$/i, ".webp") : "",
    sourceBehaviors:comportements(raw, tables.pcSkillBehaviors)
  };
}

function comportements(skill, table){
  const ids = [];
  for(const field of ["ActionStart_Behavior_Tid", "Action_Behavior_TidList", "OnceAction_Behavior_TidList"]) {
    for(const value of skill[field] || []) {
      if(typeof value === "string" && value !== "None") ids.push(value);
      for(const nested of value && value.Array || []) if(nested !== "None") ids.push(nested);
    }
  }
  return [...new Set(ids)].map(id => {
    const behavior = table[id] || {};
    const buffs = behavior.BehaviorDetail_SetBuffTid || [];
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
      .map(([id, row]) => ({ tier:Number(row.Potential_Level), weaponType:weapon,
        bonusFr:substituer(localisation(tables.fr, row.Local_Key), row.Local_Replace),
        bonusEn:substituer(localisation(tables.en, row.Local_Key), row.Local_Replace),
        localKey:row.Local_Key }))
      .sort((a, b) => a.tier - b.tier);
    result[weapon] = list;
  }
  return result;
}

function effectSources(skills, potentials){
  const sourceForSkill = skill => ({
    id:(skill.skillCategory === "PASSIVE" ? "hero-passive:" : "skill:") + skill.gameId,
    kind:skill.skillCategory === "PASSIVE" ? "hero-passive" : "skill", hero:HERO_SLUG,
    weaponType:skill.weaponType, gameId:skill.gameId, textFr:skill.descriptionFr,
    textEn:skill.descriptionEn, coefficientDejaCalcule:skill.skillCategory !== "PASSIVE",
    provenance:"Table/Skill/PC_SkillTable", buffs:skill.sourceBehaviors
  });
  return {
    skills:skills.map(sourceForSkill),
    potentials:Object.values(potentials).flat().map(potential => ({
      id:"potential:" + HERO_SLUG + ":" + potential.weaponType + ":" + potential.tier,
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
    .map(([gameId, item]) => ({ gameId, nameFr:localisation(tables.fr, item.Local_Key),
      nameEn:localisation(tables.en, item.Local_Key), weaponType:(item.BindArmor_RecommendEquip_WeaponType || [])[0] || null,
      icon:item.IconName, grade:sansEnum(item.grade), reinforceMax:item.Reinforce_Max,
      quality:{min:item.Quality_Min, max:item.Quality_MAX}, mainStats:item.Growth_Ability_Main || [],
      subStats:item.Growth_Ability_Sub || [], options:item.Equip_Option || [],
      passives:item.Equip_Passive || [], limitBreakPassives:item.LimitBreak_Passive || [] }))
    .sort((a, b) => a.gameId.localeCompare(b.gameId));
}

function assets(tables, hero, skills, armors){
  const skillAssets = [...new Set(skills.map(skill => cheminImageIcone(tables.pcSkills[skill.gameId].Icon, tables))
    .filter(source => source && (!tables.uiImages || tables.uiImages.has(source))))]
    .map(source => ({source, target:"7ds-ui/skills/" + path.basename(source).replace(/\.png$/i, ".webp")}));
  return {
    portrait:{source:"Icon_Item/portrait_Hero/slot_Calla_001.png", target:"7ds-personnages/khala.webp"},
    skills:skillAssets,
    linkedArmors:armors.map(armor => ({
      source:"Icon_Item/BindArmor/" + armor.icon.replace(/^icon_bindarmor_/, "BindArmor_").replace(/_pc_/i, "_PC_").replace(/_calla_/i, "_Calla_") + ".png",
      target:"7ds-armures-ssr/Armure liee/" + armor.nameFr + ".webp"
    }))
  };
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
      const skill = competence(id, weapon, tables);
      allSkills.push(skill);
      if(SKILL_FIELDS.includes(field)) calculatorSkills.push(skill);
    }
  }
  const allPotentials = potentiels(hero.weapons, tables);
  const armors = linkedArmors(tables);
  const snapshot = {version:1, heroes:{khala:{
    id:HERO_ID, internalName:"Calla", nameFr:hero.character.nameFr, nameEn:hero.character.nameEn,
    meta:{role:hero.character.role, rarity:hero.character.rarity, weapons:hero.slots},
    character:hero.character, potentials:allPotentials, wikiSkills:allSkills,
    calculatorSkills, effectSources:effectSources(allSkills, allPotentials), linkedArmors:armors,
    assets:assets(tables, hero, allSkills, armors)
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
  if(!hero) throw new Error("snapshot Khala absent ou version incompatible");
  walk(hero, text => { if(/\{\d+\}/.test(text)) throw new Error("placeholder résiduel dans khala"); });
  const weapons = hero.meta && hero.meta.weapons || [];
  if(weapons.length !== 3 || new Set(weapons.map(item => item.weapon)).size !== 3) throw new Error("trois armes uniques requises pour khala");
  for(const weapon of weapons.map(item => item.weapon)) if(!hero.potentials || !Array.isArray(hero.potentials[weapon]) || hero.potentials[weapon].length !== 10) throw new Error("dix potentiels requis pour khala/" + weapon);
  if(!Array.isArray(hero.wikiSkills) || hero.wikiSkills.length !== 18) throw new Error("18 compétences Wiki requises pour khala");
  if(!Array.isArray(hero.calculatorSkills) || hero.calculatorSkills.length !== 15) throw new Error("15 compétences de calcul requises pour khala");
  const stats = hero.character && ["baseHp", "baseAtk", "baseDef", "baseSpd", "accuracy", "block", "critRate", "critDamage", "critResist", "critDmgResist", "blockDmgResist", "pvpDmgUp", "pvpDmgDown"];
  if(!stats || stats.some(stat => typeof hero.character[stat] !== "number")) throw new Error("13 statistiques de base requises pour khala");
  const masteries = hero.character.weaponMasteries || hero.character.masteries || [];
  const branches = Array.isArray(masteries) ? masteries : Object.values(masteries);
  if(branches.length !== 3 || branches.some(branch => !Array.isArray(branch.levels || branch) || (branch.levels || branch).length !== 5)) throw new Error("trois branches de maîtrise à cinq niveaux requises pour khala");
  if(!Array.isArray(hero.linkedArmors) || hero.linkedArmors.length !== 3) throw new Error("trois armures liées requises pour khala");
  const sources = [...(hero.effectSources && hero.effectSources.skills || []), ...(hero.effectSources && hero.effectSources.potentials || [])];
  const ids = new Set(sources.map(source => source.id));
  for(const skill of hero.wikiSkills) if(skill.effectSourceId && !ids.has(skill.effectSourceId)) throw new Error("source d'effet absente pour khala");
  for(const potential of Object.values(hero.potentials).flat()) if(potential.effectSourceId && !ids.has(potential.effectSourceId)) throw new Error("source d'effet absente pour khala");
}

function extraireContenu(racine){
  const tables = {
    fr:lireLocalisation(racine, "fr"), en:lireLocalisation(racine, "en"),
    heroMastery:lireTable(racine, "HeroMastery/HeroMastery.json"),
    heroActors:lireTable(racine, "Actor/HeroActorTable.json"), heroStats:lireTable(racine, "Actor/HeroStatGroupTable.json"),
    defaultSkills:lireTable(racine, "Skill/DefaultSkillTable.json"), defaultWeaponSkills:lireTable(racine, "Skill/DefaultSkillWeaponTypeTable.json"),
    pcSkills:lireTable(racine, "Skill/PC_SkillTable.json"), pcSkillBehaviors:lireTable(racine, "Skill/PC_SkillBehaviorTable.json"),
    weaponMastery:lireTable(racine, "HeroMastery/HeroWeaponMastery.json"), equipments:lireTable(racine, "Item/ItemTable_Data_Equip.json")
  };
  tables.uiImages = new Set(listerImages(path.join(racine, "UIImg"), racine));
  tables.skillIcons = new Map([...tables.uiImages]
    .filter(image => image.startsWith("Icon_Item/Skill/"))
    .map(image => [cleIcone(path.basename(image, ".png")), image]));
  return extraireDepuisTables(tables);
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
  const snapshot = extraireContenu(racine);
  const sortie = path.join(ROOT, "7ds-stats", "contenu-jeu.json");
  const temporaire = sortie + ".tmp";
  fs.writeFileSync(temporaire, JSON.stringify(snapshot, null, 1) + "\n", "utf8");
  fs.renameSync(temporaire, sortie);
  console.log("1 héros jouable extrait : khala");
  console.log("2 entrées anonymes ignorées : 409100119, 409100124");
  console.log("écrit : 7ds-stats/contenu-jeu.json");
}

if(require.main === module) main();

module.exports = {substituer, filtrerHerosJouables, lireTable, extraireDepuisTables, extraireContenu, validerSnapshot};
