"use strict";

/* L'extraction des mecaniques pour /jarvis, sur un mini-export ecrit ici.
   Les formes sont celles de l'export reel du 24/09/2026 : le Canon a eau
   d'Elizabeth et ses deux effets (l'un cite par la description, l'autre
   non), deux buffs de meme nom pour l'equipe et pour le porteur, un
   controle sans porteur, un effet sans texte, un identifiant de competence
   qui en prolonge un autre, et les tables du journal et des guides. */

const assert = require("node:assert/strict");
const path = require("node:path");

const { construireCatalogueMecaniques } = require(path.resolve(
  __dirname, "..", "outils", "fabrication", "mecaniques-jarvis.js"
));

const ajout = (code, valeur) => ({ TargetAbil:"EAbilityType::" + code, Value:valeur });
function buff(type, application, cle, ajouts, cumul, detail) {
  return { Type:"EBuffDivision::" + type, DetailType:"EBuffType::" + (detail || "None"),
    ApplyType:"EApplyType::" + application, Local_Key:cle,
    Local_Desc:cle === "None" ? "None" : cle.replace(/_Name$/, "_Desc"),
    AddAbil_List:ajouts, StackType:{ MaxStack:cumul } };
}
const pose = (id, ms) => ({ BuffTid:id, BuffTime:ms });

const ENTREE_MECANIQUES_TEST = {
  buffs:{
    "302171011":buff("DeBuff", "Team", "Local_Buff_Splash_Name", [ajout("I_DefAdd_Rate", -2000)], 1),
    "302171012":buff("DeBuff", "Team", "Local_Buff_WeakUp_Name",
      [ajout("Thunder_Weakness_Rate", 1000), ajout("Holy_Weakness_Rate", 1000)], 1),
    "302171017":buff("Buff", "Team", "None", [], 1),
    "301000001":buff("Buff", "Team", "Local_Buff_AtkUp_Name", [ajout("I_AtkAdd_Rate", 1500)], 1),
    "301000002":buff("Buff", "Hero", "Local_Buff_AtkUp_Name", [ajout("I_AtkAdd_Rate", 3000), ajout("None", 5)], 5),
    "301000003":buff("Buff", "Hero", "Local_Buff_Mystery_Name", [ajout("Mystery_Stat", 42)], 0),
    "309000001":buff("DeBuff", "Team", "Local_Buff_Petrify_Name", [ajout("Earth_Weakness_Rate", 1500)], 1, "StateCC"),
    "309000002":buff("DeBuff", "Team", "Local_Debuff_Fear_Name", [], 1),
    /* Le jeu reutilise un nom pour un malus, avec sa propre description :
       « Augmentation de l'attaque » existe aussi en malus d'attribut Feu. */
    "301000004":Object.assign(buff("DeBuff", "Team", "Local_Buff_AtkUp_Name", [ajout("I_AtkAdd_Rate", -1000)], 1),
      { Local_Desc:"Local_Buff_AtkUpFeu_Desc" }),
    /* Un nom qui COMMENCE par « attaque », qu'aucun heros ne pose. */
    "301000005":buff("Buff", "Hero", "Local_Buff_Ultime_Name", [ajout("Buff_Time_Rate", 300)], 1),
    /* Traduction absente, le jeu rend la cle elle-meme : ce n'est pas un nom. */
    "301000006":buff("Buff", "Hero", "local_buff_atk_increase02_name", [ajout("I_AtkAdd_Rate", 500)], 1)
  },
  comportements:{
    elizabeth_book_skill_q_a:{ BehaviorDetail_SetBuffTid:[pose("302171011", 40000), pose("302171012", 20000)] },
    elizabeth_book_skill_q_b:{ BehaviorDetail_SetBuffTid:[pose("302171011", 40000), pose("302171012", 20000)] },
    elizabeth_book_skill_e:{ BehaviorDetail_SetBuffTid:[pose("302171017", 20000), pose("301000004", 15000)] },
    ban_cudgel3c_skill_e:{ BehaviorDetail_SetBuffTid:[pose("301000001", 30000)] },
    ban_cudgel3c_skill_q:{ BehaviorDetail_SetBuffTid:[pose("301000002", -1)] },
    ban_cudgel3c_skill_q_ex_a:{ BehaviorDetail_SetBuffTid:[pose("301000003", 10000)] },
    common_effect_atk:{ BehaviorDetail_SetBuffTid:[pose("301000001", 30000)] },
    ban_cudgel3c_skill_e_vide:{ BehaviorDetail_SetBuffTid:[pose("999", 1000)] }
  },
  competences:{
    elizabeth:[
      { gameId:"elizabeth_book_skill_q", weaponType:"Book", categorie:"ACTIVE_THIRD", nomFr:"Canon à eau",
        descriptionFr:"Inflige [#0F5CD8]Éclaboussures[-] à l'ennemi pendant [#1A7331]40s[-]." },
      { gameId:"elizabeth_book_skill_e", weaponType:"Book", categorie:"NORMAL_SKILL",
        nomFr:"Bouchée rafraîchissante", descriptionFr:"Soigne." }
    ],
    ban:[
      { gameId:"ban_cudgel3c_skill_e", weaponType:"Cudgel3c", categorie:"NORMAL_SKILL",
        nomFr:"Ruée en spirale", descriptionFr:"Augmente l'attaque de 15 %." },
      { gameId:"ban_cudgel3c_skill_q", weaponType:"Cudgel3c", categorie:"ACTIVE_THIRD",
        nomFr:"Chaîne", descriptionFr:"AUGMENTATION DE L'ATTAQUE de 30 %." },
      { gameId:"ban_cudgel3c_skill_q_ex", weaponType:"Lance", categorie:"ACTIVE_THIRD",
        nomFr:"Chaîne renforcée", descriptionFr:"Rien." }
    ]
  },
  personnages:{
    elizabeth:{ nom:"Elizabeth", armes:[{ type:"Book", arme:"Grimoire" }] },
    ban:{ nom:"Ban", armes:[{ type:"Cudgel3c", arme:"Nunchaku" }] }
  },
  libelles:{
    I_DefAdd_Rate:{ fr:"Augmentation de la défense", taux:true },
    I_AtkAdd_Rate:{ fr:"Augmentation de l'attaque", taux:true }
  },
  unites:{
    I_DefAdd_Rate:{ family:"additional", unit:"ten-thousandths" },
    I_AtkAdd_Rate:{ family:"additional", unit:"ten-thousandths" }
  },
  journal:{
    combat_1:{ Local_Key:"Local_Tutorial_Log_SubTitle_Burst_Fire" },
    combat_2:{ Local_Key:"Local_Tutorial_Log_SubTitle_Vide" },
    combat_3:{ Local_Key:"None" }
  },
  pagesJournal:{
    combat_1_2:{ Group_Tid:"combat_1", List_Sort:2, Pc_Desc_Local:"local_tutorial_log_pagedesc_burst_fire02" },
    combat_1_1:{ Group_Tid:"combat_1", List_Sort:1, Pc_Desc_Local:"local_tutorial_log_pagedesc_burst_fire01" },
    combat_1_10:{ Group_Tid:"combat_1", List_Sort:10, Pc_Desc_Local:"local_tutorial_log_pagedesc_burst_fire10" },
    combat_3_1:{ Group_Tid:"combat_3", List_Sort:1, Pc_Desc_Local:"local_tutorial_log_pagedesc_orphelin" }
  },
  guides:{
    burst_fire:{ Title_Local:"ui_tutorial_burst_fire_title", Group_Value:["burst_fire_1", "burst_fire_2"] },
    meliodas_sword:{ Title_Local:"ui_guide_meliodas_sword_title", Group_Value:["meliodas_sword_1"] }
  },
  pagesGuides:{
    burst_fire_1:{ Pc_Desc_Local:["local_tutorial_log_pagedesc_burst_fire02"] },
    burst_fire_2:{ Pc_Desc_Local:["ui_tutorial_burst_fire_desc_03"] },
    meliodas_sword_1:{ Pc_Desc_Local:["ui_guide_meliodas_sword_desc"] }
  },
  textes:{
    local_buff_splash_name:"Éclaboussures",
    local_buff_splash_desc:"Réduit la défense de [#1A7331]{0}[-]",
    Local_Buff_WeakUp_Name:"Augmentation des dégâts de faiblesse",
    Local_Buff_WeakUp_Desc:"Dégâts de faiblesse +{0}",
    Local_Buff_AtkUp_Name:"Augmentation de l'attaque",
    Local_Buff_AtkUp_Desc:"Attaque +{0}",
    Local_Buff_AtkUpFeu_Desc:"Attaque des héros d'attribut Feu +{0}",
    Local_Buff_Ultime_Name:"Attaque totale ultime",
    local_buff_atk_increase02_name:"local_buff_atk_increase02_name",
    Local_Buff_Mystery_Name:"Mystère",
    Local_Buff_Petrify_Name:"Pétrification",
    Local_Buff_Petrify_Desc:"Immobilisation. Dégâts de Terre subis +{0}",
    local_tutorial_log_subtitle_burst_fire:"Déluge élémentaire - Feu",
    local_tutorial_log_subtitle_vide:"Sujet sans page",
    local_tutorial_log_pagedesc_burst_fire01:"Remplissez la [#FF0000]jauge[-] avec {Inputkey_Hero_Attack}.",
    local_tutorial_log_pagedesc_burst_fire02:"Deuxième page.",
    local_tutorial_log_pagedesc_burst_fire10:"Dixième page.",
    local_tutorial_log_pagedesc_orphelin:"Page sans titre.",
    ui_tutorial_burst_fire_title:"Déluge élémentaire - Feu",
    ui_tutorial_burst_fire_desc_03:"Page du guide.",
    ui_guide_meliodas_sword_title:"Meliodas (épée longue)",
    ui_guide_meliodas_sword_desc:"Enchaînez les coups jusqu'à {time}.",
    ui_loadingtip_desc_08:"Astuce huit.",
    ui_loadingtip_desc_02:"Astuce deux."
  },
  genereLe:"2026-09-24T12:00:00.000Z",
  dateExport:"2026-09-24"
};

function main() {
  const catalogue = construireCatalogueMecaniques(ENTREE_MECANIQUES_TEST);
  assert.equal(catalogue.version, 1);
  assert.equal(catalogue.dateExport, "2026-09-24");
  assert.equal(catalogue.genereLe, "2026-09-24T12:00:00.000Z");
  assert.deepEqual(catalogue.effets.map(effet => effet.nom), [
    "Attaque totale ultime", "Augmentation de l'attaque", "Augmentation des dégâts de faiblesse",
    "Éclaboussures", "Mystère", "Pétrification"
  ], "tri par nom ; l'effet sans nom et celui dont le texte manque sont écartés");

  const effet = nom => catalogue.effets.find(entree => entree.nom === nom);
  assert.deepEqual(effet("Éclaboussures"), {
    nom:"Éclaboussures", nature:"malus", description:"Réduit la défense de X",
    variantes:[{
      valeurs:[{ stat:"Augmentation de la défense", valeur:"-20 %" }],
      duree:40, cumulMax:1, cible:"ennemi", nature:"malus", description:"Réduit la défense de X",
      posePar:[{ heros:"Elizabeth", arme:"Grimoire", competence:"Canon à eau",
        categorie:"ACTIVE_THIRD", citeParDescription:true }]
    }]
  }, "posé par _a et _b : un seul porteur");

  assert.deepEqual(effet("Augmentation des dégâts de faiblesse").variantes, [{
    valeurs:[
      { stat:"Dégâts de faiblesse Foudre", valeur:"+10 %" },
      { stat:"Dégâts de faiblesse Sacré", valeur:"+10 %" }
    ],
    duree:20, cumulMax:1, cible:"ennemi", nature:"malus", description:"Dégâts de faiblesse +X",
    posePar:[{ heros:"Elizabeth", arme:"Grimoire", competence:"Canon à eau",
      categorie:"ACTIVE_THIRD", citeParDescription:false }]
  }], "familles élémentaires libellées et en dix-millièmes ; nom absent de la description");

  /* Un nom partagé par un buff et un malus : chaque variante garde SA nature
     et SA description, sinon la fiche dit « Buff… cible l'ennemi » ou
     prête à un héros un bonus d'attribut Feu qu'il ne donne pas. */
  const attaque = effet("Augmentation de l'attaque");
  assert.equal(attaque.nature, "buff");
  assert.equal(attaque.description, "Attaque +X");
  assert.deepEqual(attaque.variantes, [
    { valeurs:[{ stat:"Augmentation de l'attaque", valeur:"+15 %" }], duree:30, cumulMax:1, cible:"equipe",
      nature:"buff", description:"Attaque +X",
      posePar:[{ heros:"Ban", arme:"Nunchaku", competence:"Ruée en spirale",
        categorie:"NORMAL_SKILL", citeParDescription:false }] },
    { valeurs:[{ stat:"Augmentation de l'attaque", valeur:"+30 %" }], cumulMax:5, cible:"porteur",
      nature:"buff", description:"Attaque +X",
      posePar:[{ heros:"Ban", arme:"Nunchaku", competence:"Chaîne",
        categorie:"ACTIVE_THIRD", citeParDescription:true }] },
    { valeurs:[{ stat:"Augmentation de l'attaque", valeur:"-10 %" }], duree:15, cumulMax:1, cible:"ennemi",
      nature:"malus", description:"Attaque des héros d'attribut Feu +X",
      posePar:[{ heros:"Elizabeth", arme:"Grimoire", competence:"Bouchée rafraîchissante",
        categorie:"NORMAL_SKILL", citeParDescription:false }] }
  ], "Team → équipe, Hero → porteur ; -1 ms → sans durée ; la stat None est ignorée ;"
    + " le comportement commun sans compétence est ignoré ; citation sans casse");

  assert.deepEqual(effet("Mystère"), {
    nom:"Mystère", nature:"buff", description:"",
    variantes:[{ valeurs:[{ stat:"Mystery_Stat", valeur:"42 (valeur brute)" }], duree:10, cible:"porteur",
      nature:"buff", description:"",
      posePar:[{ heros:"Ban", arme:"Lance", competence:"Chaîne renforcée",
        categorie:"ACTIVE_THIRD", citeParDescription:false }] }]
  }, "le plus long identifiant gagne ; type d'arme inconnu gardé brut ; cumul 0 omis ; sans description");

  assert.deepEqual(effet("Pétrification"), {
    nom:"Pétrification", nature:"controle", description:"Immobilisation. Dégâts de Terre subis +X",
    variantes:[{ valeurs:[{ stat:"Dégâts de faiblesse Terre", valeur:"+15 %" }], cumulMax:1,
      cible:"ennemi", nature:"controle", description:"Immobilisation. Dégâts de Terre subis +X", posePar:[] }]
  }, "StateCC passe avant DeBuff ; sans porteur, gardé dans le glossaire");

  assert.deepEqual(catalogue.regles, [
    { sujet:"Astuces de chargement", pages:["Astuce deux.", "Astuce huit."] },
    { sujet:"Déluge élémentaire - Feu", pages:[
      "Remplissez la jauge avec (touche).", "Deuxième page.", "Dixième page.", "Page du guide."
    ] },
    { sujet:"Meliodas (épée longue)", pages:["Enchaînez les coups jusqu'à X."] }
  ], "journal trié par List_Sort ; guide de même titre fusionné sans doublon ;"
    + " sujets sans page ou sans titre écartés");

  console.log("OK mecaniques-jarvis");
}

module.exports = { ENTREE_MECANIQUES_TEST };

if(require.main === module) main();
