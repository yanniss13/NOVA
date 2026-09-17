"use strict";

/* Les tenues gravees d'un heros lu dans les tables du jeu, ramenees a la forme
   exacte de 7ds-stats/armures-gravees.json. Le test tourne sans export local :
   les tables sont des fixtures minimales, construites ligne par ligne. */

const assert = require("node:assert/strict");
const {
  pieceGravee, vocabulaireHistorique, fusionnerGravees
} = require("../outils/fabrication/extraire-gravees-non-declarees.js");

const ID = "133990001";

function valeurs(unique, position){
  const ligne = {};
  for(let i = 1; i <= 15; i++) ligne["Value_Add_" + i] = 0;
  if(position) ligne["Value_Add_" + position] = unique;
  return ligne;
}
function renfort(){
  const ligne = {};
  [10300, 10700, 11200, 11800, 12500].forEach((v, i) => { ligne["Value_Add_" + (i + 1)] = v; });
  return ligne;
}
function statique(prefixe, code, valeur, ajout){
  return {
    [prefixe + "_" + ID]:{GrowthType:"equiplv_15", AbilityType:"EAbilityType::" + code, Value_Base:0, ...valeurs(valeur, 2)},
    [prefixe + "_equiplv_" + ID]:{GrowthType:"equiplv_add_15", AbilityType:"EAbilityType::" + code, Value_Base:0, ...valeurs(ajout, 2)},
    [prefixe + "_reinforce_" + ID]:{GrowthType:"reinforce", AbilityType:"EAbilityType::" + code, Value_Base:0, ...renfort()}
  };
}

function tables(){
  return {
    equip:{[ID]:{
      OnlyUse:["1999"], grade:"EGrade::Grade5", Quality_Min:111, Quality_MAX:130,
      PromotionGroupID:"promo_t5", ExpGroupID:"exp_t5",
      Growth_Ability_Main:["armor_main1_" + ID, "armor_main2_" + ID],
      Growth_Ability_Sub:["armor_sub1_" + ID, "armor_sub2_" + ID],
      Equip_Option:["groupe_a", "groupe_a"],
      LimitBreak_Option:["armor_limitbreak1_" + ID, "armor_limitbreak2_" + ID],
      LimitBreak_Passive:[{EquipPassiveID:"EpLb_Heros_B", PromotionLevel:3}],
      Equip_Passive:[1, 2, 3].map(level => ({EquipPassiveID:"EpEq_Heros_B", PassiveLv:level}))
    }},
    options:{
      ...statique("armor_main1", "B_MaxHP_Equip", 14739, 137),
      ...statique("armor_main2", "B_Def_Equip", 5276, 49),
      ...statique("armor_sub1", "Wind_Add", 637, 6),
      ...statique("armor_sub2", "UltimateSkill_DamAdd_Rate", 1194, 12),
      ["armor_limitbreak1_" + ID]:{AbilityType:"EAbilityType::I_AtkAdd_Rate", Value_Base:1048, ...valeurs(0)},
      ["armor_limitbreak2_" + ID]:{AbilityType:"EAbilityType::Wind_Burst_Gauge_Rate", Value_Base:0, ...valeurs(3327, 2)}
    },
    ranges:{equiplv_15:{...valeurs(0), Value_Add_1:110, Value_Add_2:130, Value_Add_3:133}},
    promotion:{
      promo_t5_1:{PromotionGroupID:"promo_t5", PromotionLevel:1, MaxReinforce:10, Is_Max:true, Cost:1000, NeedItem:[{Item_ID:"101", Count:3}], PromotionRate:8000},
      promo_t5_0:{PromotionGroupID:"promo_t5", PromotionLevel:0, MaxReinforce:5, Is_Max:false, Cost:0, NeedItem:[], PromotionRate:0}
    },
    exp:{
      b:{ExpGroupID:"exp_t5", ExpKey:"s2", Reinforce:0, exp:728, Cost:2964, NeedItem:[]},
      a:{ExpGroupID:"exp_t5", ExpKey:"s1", Reinforce:1, exp:364, Cost:780, NeedItem:[]},
      c:{ExpGroupID:"exp_t5", ExpKey:"s1", Reinforce:0, exp:156, Cost:572, NeedItem:[]}
    },
    expKeys:{weapon:{}, s1:{}, s2:{}},
    random:{
      r1:{Group_ID:"groupe_a", AbilityType:"EAbilityType::I_AtkAdd_Rate", Tier:2, Value_Min:10, Value_Max:20, OptionRate:30},
      r2:{Group_ID:"groupe_a", AbilityType:"EAbilityType::I_AtkAdd_Rate", Tier:1, Value_Min:21, Value_Max:30, OptionRate:10},
      r3:{Group_ID:"groupe_a", AbilityType:"EAbilityType::UltimateSkill_DamAdd_Rate", Tier:1, Value_Min:5, Value_Max:9, OptionRate:40},
      autre:{Group_ID:"groupe_b", AbilityType:"EAbilityType::B_Def_Equip", Tier:1, Value_Min:1, Value_Max:2, OptionRate:40}
    },
    passiveBase:{
      epeq_heros_b:{Core_Name:"local_nom_b", Icon:"icone_b", MaxLv:3, GroupID:"epeq_heros_b_group"},
      eplb_heros_b:{Core_Name:"local_lb_nom", Icon:"icone_lb", MaxLv:1, GroupID:"eplb_heros_b_group"}
    },
    passiveGroup:{
      l3:{GroupID:"epeq_heros_b_group", Level:3, Desc:"local_desc_b", Local_Replace:["{0}:{30%}"]},
      l1:{GroupID:"epeq_heros_b_group", Level:1, Desc:"local_desc_b", Local_Replace:["{0}:{10%}"]},
      l2:{GroupID:"epeq_heros_b_group", Level:2, Desc:"local_desc_b", Local_Replace:["{0}:{20%}"]},
      lb:{GroupID:"eplb_heros_b_group", Level:1, Desc:"local_lb_desc", Local_Replace:["{0}:{15%}"]}
    },
    costumes:{c1:{ItemId:"134199901", Open_Condition_Value:[ID], Achive_Key:"local_costume_achive_999"}},
    recipes:{[ID]:{Material_TID_1:"132", Material_Cnt_1:1, Material_TID_2:"None", Material_Cnt_2:0}},
    fr:{
      ["local_item_equip_name_" + ID]:"Tenue d'essai", local_nom_b:"Don", local_desc_b:"Augmente de {0}.",
      local_lb_nom:"Transcendance", local_lb_desc:"Augmente l'équipe de {0}.",
      local_costume_achive_999:"Débloqué lors de l'obtention de l'équipement gravé"
    },
    en:{
      ["local_item_equip_name_" + ID]:"Trial Outfit", local_nom_b:"Gift", local_desc_b:"Increases by {0}.",
      local_lb_nom:"Transcendence", local_lb_desc:"Increases the team by {0}."
    }
  };
}

/* Le depot garde l'orthographe historique de chaque code, et l'ordre des
   options aleatoires, tels que les pieces deja publiees les ecrivent. */
const EXISTANTES = [{
  gameId:"133010001", mainStat:"B_MaxHp_Equip", subStat:"Wind_Add",
  growth:{
    extraStats:[{key:"UltimateSkill_DamAdd_Rate"}],
    randomOptions:{slots:3, stats:[{key:"Ultimateskill_Damadd_Rate"}, {key:"I_AtkAdd_Rate"}]},
    limitBreak:{options:[{abilityType:"I_AtkAdd_Rate"}]}
  },
  personnage:"ancien"
}];
const LIBELLES = {
  B_MaxHp_Equip:{fr:"PV de l'équipement", en:"Equipment HP"},
  B_Def_Equip:{fr:"Défense de l'équipement", en:"Equipment Defense"},
  Wind_Add:{fr:"Attaque de Vent", en:"Wind Attack"},
  UltimateSkill_DamAdd_Rate:{fr:"Dégâts d'ultime", en:"Ultimate Damage"},
  I_AtkAdd_Rate:{fr:"Augmentation de l'attaque", en:"Attack Increase"},
  Wind_Burst_Gauge_Rate:{fr:"Efficacité de Déluge de Vent", en:"Wind Burst Efficiency"}
};
const METADONNEES = {
  B_MaxHp_Equip:{unit:"flat"}, B_Def_Equip:{unit:"flat"}, Wind_Add:{unit:"flat"},
  UltimateSkill_DamAdd_Rate:{unit:"ten-thousandths"}, I_AtkAdd_Rate:{unit:"ten-thousandths"},
  Wind_Burst_Gauge_Rate:{unit:"ten-thousandths"}
};
const HEROS = {"1999":{slug:"heros", nameFr:"Héros"}};

function bloc(growthType, code, progression){
  return {base:0, growthType, abilityType:code, progression};
}
const RENFORT = [10300, 10700, 11200, 11800, 12500];

{
  const vocabulaire = vocabulaireHistorique(EXISTANTES, LIBELLES, METADONNEES);
  const piece = pieceGravee(ID, tables(), vocabulaire, HEROS);
  assert.deepEqual(piece, {
    gameId:ID, mainStat:"B_MaxHp_Equip", subStat:"Wind_Add",
    qualityMin:111, qualityMax:130, qualityMinLive:null, qualityMaxLive:null,
    tierBoundaries:[110, 130],
    growth:{
      promotion:[
        {gold:0, rate:0, tier:0, isMax:false, items:null, maxReinforce:5},
        {gold:1000, rate:8000, tier:1, isMax:true, items:[{count:3, itemId:"101"}], maxReinforce:10}
      ],
      extraStats:[
        {key:"B_Def_Equip", slot:"main", isRate:false, nameEn:"Equipment Defense", nameFr:"Défense de l'équipement",
          reinforce:bloc("reinforce", "B_Def_Equip", RENFORT),
          equiplvAdd:bloc("equiplv_add_15", "B_Def_Equip", [49]),
          statValues:bloc("equiplv_15", "B_Def_Equip", [5276])},
        {key:"UltimateSkill_DamAdd_Rate", slot:"sub", isRate:true, nameEn:"Ultimate Damage", nameFr:"Dégâts d'ultime",
          reinforce:bloc("reinforce", "UltimateSkill_DamAdd_Rate", RENFORT),
          equiplvAdd:bloc("equiplv_add_15", "UltimateSkill_DamAdd_Rate", [12]),
          statValues:bloc("equiplv_15", "UltimateSkill_DamAdd_Rate", [1194])}
      ],
      limitBreak:{
        options:[
          {tier:1, value:1048, abilityType:"I_AtkAdd_Rate"},
          {tier:2, value:3327, abilityType:"Wind_Burst_Gauge_Rate"}
        ],
        passive:{id:"EpLb_Heros_B", tier:3, descEn:"Increases the team by 15%.",
          descFr:"Augmente l'équipe de 15%.", nameEn:"Transcendence", nameFr:"Transcendance"}
      },
      subReinforce:bloc("reinforce", "Wind_Add", RENFORT),
      subStatLabel:{nameEn:"Wind Attack", nameFr:"Attaque de Vent"},
      mainReinforce:bloc("reinforce", "B_MaxHp_Equip", RENFORT),
      mainStatLabel:{nameEn:"Equipment HP", nameFr:"PV de l'équipement"},
      randomOptions:{slots:2, stats:[
        {key:"Ultimateskill_Damadd_Rate", max:9, min:5, tiers:[{max:9, min:5, tier:1, chance:10000}],
          chance:5000, isRate:true, nameEn:"Ultimate Damage", nameFr:"Dégâts d'ultime"},
        {key:"I_AtkAdd_Rate", max:30, min:10, tiers:[
          {max:30, min:21, tier:1, chance:2500}, {max:20, min:10, tier:2, chance:7500}
        ], chance:5000, isRate:true, nameEn:"Attack Increase", nameFr:"Augmentation de l'attaque"}
      ]},
      reinforcement:[
        {exp:156, gold:572, tier:0, items:null, level:0},
        {exp:728, gold:2964, tier:1, items:null, level:0},
        {exp:364, gold:780, tier:0, items:null, level:1}
      ],
      subEquiplvAdd:bloc("equiplv_add_15", "Wind_Add", [6]),
      subStatValues:bloc("equiplv_15", "Wind_Add", [637]),
      mainEquiplvAdd:bloc("equiplv_add_15", "B_MaxHp_Equip", [137]),
      mainStatValues:bloc("equiplv_15", "B_MaxHp_Equip", [14739])
    },
    personnage:"heros", personnageNomFr:"Héros", costumeSlug:"heros-costume-134199901",
    nameFr:"Tenue d'essai", nameEn:"Trial Outfit", rarity:"SSR",
    effectNameFr:"Débloqué lors de l'obtention de l'équipement gravé",
    engravingPassives:[{id:"EpEq_Heros_B", icon:"icone_b", levels:[
      {level:1, descEn:"Increases by 10%.", descFr:"Augmente de 10%."},
      {level:2, descEn:"Increases by 20%.", descFr:"Augmente de 20%."},
      {level:3, descEn:"Increases by 30%.", descFr:"Augmente de 30%."}
    ], nameEn:"Gift", nameFr:"Don"}],
    bindingMaterials:[{itemId:"132", quantity:1}],
    iconUrl:null
  });
  // L'ordre des cles fait partie du format : le fichier est relu par des diffs.
  assert.deepEqual(Object.keys(piece), [
    "gameId", "mainStat", "subStat", "qualityMin", "qualityMax", "qualityMinLive",
    "qualityMaxLive", "tierBoundaries", "growth", "personnage", "personnageNomFr",
    "costumeSlug", "nameFr", "nameEn", "rarity", "effectNameFr", "engravingPassives",
    "bindingMaterials", "iconUrl"
  ]);
  assert.deepEqual(Object.keys(piece.growth), [
    "promotion", "extraStats", "limitBreak", "subReinforce", "subStatLabel",
    "mainReinforce", "mainStatLabel", "randomOptions", "reinforcement",
    "subEquiplvAdd", "subStatValues", "mainEquiplvAdd", "mainStatValues"
  ]);
}

/* Rien ne se devine : une donnee illisible fait echouer la piece. */
{
  const vocabulaire = vocabulaireHistorique(EXISTANTES, LIBELLES, METADONNEES);
  const sansTexte = tables();
  delete sansTexte.fr.local_desc_b;
  assert.throws(() => pieceGravee(ID, sansTexte, vocabulaire, HEROS), /local_desc_b/);

  const ambigue = tables();
  ambigue.options["armor_limitbreak1_" + ID].Value_Add_4 = 12;
  assert.throws(() => pieceGravee(ID, ambigue, vocabulaire, HEROS), /transcendance/);

  const inconnu = tables();
  inconnu.options["armor_sub1_" + ID].AbilityType = "EAbilityType::Code_Invente";
  assert.throws(() => pieceGravee(ID, inconnu, vocabulaire, HEROS), /Code_Invente/);

  assert.throws(() => pieceGravee(ID, tables(), vocabulaire, {}), /1999/);

  const troisNiveaux = tables();
  delete troisNiveaux.passiveGroup.l2;
  assert.throws(() => pieceGravee(ID, troisNiveaux, vocabulaire, HEROS), /EpEq_Heros_B/);
}

/* La fusion n'ajoute que les pieces des heros du snapshot, triees par gameId,
   et refuse de toucher une piece d'un heros historique. */
{
  const ancienne = {gameId:"133010001", personnage:"ancien", valeur:1};
  const suivante = {gameId:"133500001", personnage:"autre", valeur:2};
  const perimee = {gameId:ID, personnage:"heros", valeur:"perimee"};
  const neuve = {gameId:ID, personnage:"heros", valeur:"neuve"};

  const fusion = fusionnerGravees([ancienne, suivante], [neuve], ["heros"]);
  assert.deepEqual(fusion.map(piece => piece.gameId), ["133010001", "133500001", ID]);
  assert.equal(fusion[0], ancienne);

  assert.deepEqual(
    fusionnerGravees([ancienne, perimee, suivante], [neuve], ["heros"]),
    [ancienne, suivante, neuve]
  );
  assert.throws(
    () => fusionnerGravees([ancienne], [{gameId:"133010001", personnage:"heros"}], ["heros"]),
    /133010001/
  );
  assert.throws(
    () => fusionnerGravees([ancienne], [neuve, neuve], ["heros"]),
    /dupliqu/
  );
}

console.log("gravees-client : OK");
