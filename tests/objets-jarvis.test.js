"use strict";

/* L'index des objets et les boutiques de /jarvis, sur un mini-export ecrit
   ici. Formes de l'export reel du 22/09/2026 : MerchantGoods porte la
   boutique entiere dans MerchantTid ; la boutique se relie a ses PNJ par
   InteractionButtonTable -> InteractionTable -> NPCActorTable, et le PNJ a
   sa region par les tables d'apparition. */

const assert = require("node:assert/strict");
const path = require("node:path");

const { construireCatalogueObjets } = require(path.resolve(
  __dirname, "..", "outils", "fabrication", "objets-jarvis.js"
));

function marchand(id, cle, vente) {
  return { String_Tid:id, Local_Key:cle, SellType:vente || "ESellType::Equip" };
}
const EQUIPEMENT_LIONES = marchand("240110001", "UI_Common_EquipShop");
const ITINERANTE = marchand("240110004", "UI_Common_RandomShop", "ESellType::Random");
const EQUIPEMENT_SANS_REGION = marchand("240120001", "UI_Common_EquipShop");
const EQUIPEMENT_MENU = marchand("240130001", "UI_Common_EquipShop");
const ECHANGE = marchand("242100100", "UI_Common_ExchangeEvent", "ESellType::Exchange");
const ECHANGE_BIS = marchand("242200100", "UI_Common_ExchangeEvent", "ESellType::Exchange");
const ECHANGE_VIDE = marchand("242300100", "UI_Common_ExchangeEvent2", "ESellType::Exchange");

let numero = 0;
function article(boutique, vente, paiement, autres) {
  numero += 1;
  return Object.assign({
    MerchantTid:boutique,
    Sell_Asset:"EMerchantAssetType::" + vente[0], Sell_Asset_Tid:vente[1], GetCount:1,
    Payment_Asset:"EMerchantAssetType::" + paiement[0], Payment_Asset_Tid:paiement[1], Price:paiement[2],
    GoodsResetTime:"EGoodsResetType::None", LimitCount:0,
    LimitLevelType:"ELimitLevelType::None", LimitLevel:0, Order:numero
  }, autres || {});
}
/* Forme commune des quatre tables de recettes : 7 ingredients, un produit. */
function recette(fonction, ingredients, produit, quantite, types) {
  const ligne = { Function_Type:"EFunctionType::" + fonction, Recipe_Type:types || [] };
  for(let i = 1; i <= 7; i++){
    const [id, nombre, groupe] = ingredients[i - 1] || ["None", 0, 0];
    ligne["Material_TID_" + i] = id;
    ligne["Material_Cnt_" + i] = nombre;
    if(fonction.endsWith("Cook")) ligne["Material_Group_" + i] = groupe || 0;
  }
  return Object.assign(ligne, {
    Reward_Item_Tid_1:produit, Reward_Item_Cnt_1:quantite, Reward_Type_1:"ERewardType::Success",
    Reward_Item_Tid_2:"None", Reward_Type_2:"ERewardType::None"
  });
}
const EPEE = ["Item", "131000001"];
const EPEE_BIS = ["Item", "131000002"];
const MINERAI = ["Item", "101000001"];
const SANS_NOM = ["Item", "101000002"];
const POTION = ["Item", "102000001"];

const ENTREE_OBJETS_TEST = {
  objets:{
    etc:{
      "101000010":{ Local_Key:"Local_Item_Riz" }, "101000011":{ Local_Key:"Local_Item_Orge" },
      "101000012":{ Local_Key:"Local_Item_Ble" }, "101000013":{ Local_Key:"Local_Item_Mais" },
      "101000014":{ Local_Key:"Local_Item_Seigle" }, "101000015":{ Local_Key:"Local_Item_Avoine" },
      "101000001":{ Local_Key:"Local_Item_Ore" },
      /* Traduction absente : le jeu rend la cle elle-meme. */
      "101000002":{ Local_Key:"local_item_sans_nom" }
    },
    /* Deux epees homonymes : une seule entree dans l'index. */
    equip:{
      "131000001":{ Local_Key:"Local_Item_Sword" }, "131000002":{ Local_Key:"Local_Item_Sword" },
      "131000010":{ Local_Key:"Local_Item_Tenue" }
    },
    use:{
      "102000001":{ Local_Key:"Local_Item_Potion" },
      "102000010":{ Local_Key:"Local_Item_Beignets" }, "102000011":{ Local_Key:"Local_Item_Filet" }
    },
    quest:{},
    pet:{},
    dropType:{
      "100000101":{ Local_Key:"Local_Item_Gold" }, "100000905":{ Local_Key:"Local_Item_Coin_005" },
      "100000201":{ Local_Key:"Local_Item_Seal_Liones" }
    }
  },
  /* La ligne de monnaie n'a pas de nom : il passe par LinkItemTid. */
  monnaies:{
    gold:{ LinkItemTid:100000101 },
    campaign_coin_005:{ LinkItemTid:100000905 },
    seal_liones:{ LinkItemTid:100000201 },
    coin_perdu:{ LinkItemTid:999 }
  },
  /* ---------------- Butins ---------------- */
  groupesButin:{
    /* Un paquet absent de DropPackTable ne fait pas planter. */
    g_banakro:{ DropPack_Key:["p_banakro", "p_absent"], DropPack_Rate:[10000, 10000], DropPack_Type:[false, false] },
    /* Paquet ALEATOIRE (DropPack_Type vrai) : il donne un objet de sa liste,
       les taux des lignes sont des poids. Un seul objet : 80 % x 100 %
       (la Belette, verifiee sur 7dsorigin.app : 80 %). */
    g_capture:{ DropPack_Key:["p_capture"], DropPack_Rate:[8000], DropPack_Type:[true] },
    /* Sans taux de groupe : aucune chance affichee. */
    g_minage:{ DropPack_Key:["p_minage"] },
    /* Poids 22500 et 2500 dans un paquet aleatoire a 20 % : 18 % et 2 %
       (le Chaman ours-garou sur 7dsorigin.app). */
    g_donjon:{ DropPack_Key:["p_donjon", "p_hasard"], DropPack_Rate:[10000, 2000], DropPack_Type:[false, true] },
    g_premiere:{ DropPack_Key:["p_premiere"], DropPack_Rate:[10000], DropPack_Type:[false] },
    g_confrerie:{ DropPack_Key:["p_confrerie"], DropPack_Rate:[10000], DropPack_Type:[false] }
  },
  paquetsButin:{
    /* Le meme objet, un taux par niveau de monde : une seule fois. */
    p_banakro_1:{ DropPack_Key:"p_banakro", DropType:"EDropType::Item", Item_Tid:"101000001", Standard_Level:"level_01", Rate:150 },
    p_banakro_2:{ DropPack_Key:"p_banakro", DropType:"EDropType::Item", Item_Tid:"101000001", Standard_Level:"level_02", Rate:350 },
    /* Une monnaie par le suffixe de DropType. */
    p_banakro_3:{ DropPack_Key:"p_banakro", DropType:"EDropType::Seal_Liones", Item_Tid:"None", Standard_Level:"None", Rate:10000 },
    /* Sans monnaie (Exp) ou sans nom : ignores. */
    p_banakro_4:{ DropPack_Key:"p_banakro", DropType:"EDropType::Exp", Item_Tid:"None" },
    p_banakro_5:{ DropPack_Key:"p_banakro", DropType:"EDropType::Item", Item_Tid:"101000002" },
    p_capture_1:{ DropPack_Key:"p_capture", DropType:"EDropType::Item", Item_Tid:"102000001", Standard_Level:"None", Rate:2500 },
    p_minage_1:{ DropPack_Key:"p_minage", DropType:"EDropType::Item", Item_Tid:"101000001" },
    p_donjon_1:{ DropPack_Key:"p_donjon", DropType:"EDropType::Gold", Item_Tid:"None", Standard_Level:"None", Rate:10000 },
    p_hasard_1:{ DropPack_Key:"p_hasard", DropType:"EDropType::Item", Item_Tid:"102000001", Standard_Level:"None", Rate:22500 },
    p_hasard_2:{ DropPack_Key:"p_hasard", DropType:"EDropType::Item", Item_Tid:"101000001", Standard_Level:"None", Rate:2500 },
    /* Deux lignes du meme objet au meme niveau : cumul non confirme, pas de taux. */
    p_premiere_1:{ DropPack_Key:"p_premiere", DropType:"EDropType::Item", Item_Tid:"131000001", Standard_Level:"None", Rate:10000 },
    p_premiere_2:{ DropPack_Key:"p_premiere", DropType:"EDropType::Item", Item_Tid:"131000001", Standard_Level:"None", Rate:5000 },
    p_confrerie_1:{ DropPack_Key:"p_confrerie", DropType:"EDropType::Item", Item_Tid:"102000001", Standard_Level:"None", Rate:10000 }
  },
  monstres:{
    /* Deux versions de Banakro, meme nom, meme butin : une seule source. */
    "51300003":{ Local_Key:"Local_Mon_Banakro", DropGroupTid:"g_banakro", CatchDropGroupTid:"None" },
    "50600211":{ Local_Key:"Local_Mon_Banakro", DropGroupTid:"g_banakro", CatchDropGroupTid:"None" },
    "50100005":{ Local_Key:"Local_Mon_Mouette", DropGroupTid:"None", CatchDropGroupTid:"g_capture" },
    "70000001":{ Local_Key:"local_mon_sans_nom", DropGroupTid:"g_banakro", CatchDropGroupTid:"None" }
  },
  minage:{
    "84000002":{ Local_Key:"Local_Mining_Fer", DropGroupTid:"g_minage" },
    "84000001":{ Local_Key:"local_mining_sans_nom", DropGroupTid:"g_minage" }
  },
  donjons:{
    "1201":{ Dungeon_Group:81001200, Local_Sub_Name:"local_dungeon_sub_name_2802",
      Reward_Tid:"g_donjon", First_Reward_Tid:"g_premiere" }
  },
  groupesDonjon:{ "81001200":{ Local_Main_Name:"local_dungeon_main_name_ferzen", Local_Main_Sub_Name:"None" } },
  recompensesConfrerie:{
    "1":{ Reward_Check_01:5, Reward_Drop_01:"g_confrerie", Reward_Check_02:0, Reward_Drop_02:"None" }
  },
  /* ---------------- Recettes ---------------- */
  recettesCuisine:{
    /* Un groupe inconnu : l'ingredient reste, sans alternatives. */
    "1001101":recette("ManualCook", [["101000010", 2, 999]], "102000011", 2),
    /* Un ingredient sans nom : la recette est ecartee. */
    "1001102":recette("ManualCook", [["101000002", 1]], "102000011", 1),
    /* Meme recette en cuisine manuelle et automatique : une, « Cuisine ». */
    "1001103":recette("ManualCook", [["101000001", 1], ["101000010", 1, 130]], "102000010", 1),
    "2000422":recette("AutoCook", [["101000001", 1], ["101000010", 1, 130]], "102000010", 1),
    /* La meme recette une seconde fois : une seule. */
    "2000423":recette("AutoCook", [["101000001", 1], ["101000010", 1, 130]], "102000010", 1)
  },
  recettesFabrication:{
    /* Visible a plusieurs etablis : le plus modeste « ou superieur ». */
    "5":recette("Production", [["101000001", 8], ["100000101", 500]], "102000001", 1,
      ["productiontable_2", "productiontable_1"]),
    "7":recette("Production", [["101000001", 9]], "102000010", 1, ["productiontable_2"]),
    "6":recette("Production", [["101000001", 3]], "102000001", 1, ["productiontable_1"])
  },
  recettesGravure:{ "130100092":recette("AutoBind", [["131000001", 1], ["102000001", 1]], "131000010", 1) },
  recettesCombinaison:{ "170400026":recette("Combine", [["101000001", 5]], "101000011", 1) },
  categoriesFabrication:{
    cooking_manualcook_1:{ Function_Type:"EFunctionType::ManualCook", Local_Key:"UI_Making_title_SelfCooking" },
    cooking_autocook_1:{ Function_Type:"EFunctionType::AutoCook", Local_Key:"UI_Making_title_AutoCooking" },
    making_npc:{ Function_Type:"EFunctionType::Production", Local_Key:"Local_Making_NPC" },
    making_productiontable_1:{ Function_Type:"EFunctionType::Production", Local_Key:"Local_Item_Install_Name_102061001" },
    making_productiontable_2:{ Function_Type:"EFunctionType::Production", Local_Key:"Local_Item_Install_Name_102061002" }
  },
  /* Les ingredients interchangeables : un groupe de cereales. */
  listeIngredients:{
    "101000010":{ Material_Group:130 }, "101000011":{ Material_Group:130 }, "101000012":{ Material_Group:130 },
    "101000013":{ Material_Group:130 }, "101000014":{ Material_Group:130 }, "101000015":{ Material_Group:130 }
  },
  articles:{
    "250110001":article(EQUIPEMENT_LIONES, EPEE, ["Currency", "gold", 1800],
      { GoodsResetTime:"EGoodsResetType::Shop_Daily", LimitCount:3 }),
    /* Meme article pour l'epee homonyme : une seule ligne. */
    "250110002":article(EQUIPEMENT_LIONES, EPEE_BIS, ["Currency", "gold", 1800],
      { GoodsResetTime:"EGoodsResetType::Shop_Daily", LimitCount:3 }),
    "250110003":article(EQUIPEMENT_LIONES, MINERAI, ["Item", "102000001", 2],
      { GetCount:5, GoodsResetTime:"EGoodsResetType::Shop_Weekly", LimitCount:10 }),
    "250110004":article(EQUIPEMENT_LIONES, POTION, ["Currency", "gold", 100],
      { GoodsResetTime:"EGoodsResetType::Permanent", LimitCount:1,
        LimitLevelType:"ELimitLevelType::World_Level", LimitLevel:3 }),
    /* Paiement dont le nom est introuvable, objet sans nom : ecartes. */
    "250110005":article(EQUIPEMENT_LIONES, POTION, ["Currency", "coin_perdu", 10]),
    "250110006":article(EQUIPEMENT_LIONES, SANS_NOM, ["Currency", "gold", 10]),
    "250110007":article(ITINERANTE, MINERAI, ["Currency", "gold", 500]),
    "250120001":article(EQUIPEMENT_SANS_REGION, EPEE, ["Currency", "gold", 2000]),
    /* Une limite sans periode de renouvellement : « au total ». */
    "250130001":article(EQUIPEMENT_MENU, POTION, ["Currency", "gold", 50], { LimitCount:2 }),
    "252100101":article(ECHANGE, POTION, ["Currency", "campaign_coin_005", 5]),
    "252100102":article(ECHANGE, ["Currency", "gold"], ["Item", "102000001", 1], { GetCount:1000 }),
    /* Meme nom, sans PNJ ni region : un numero les distingue. */
    "252200101":article(ECHANGE_BIS, POTION, ["Currency", "campaign_coin_005", 7]),
    /* Tous ses articles sont ecartes : la boutique disparait. */
    "252300101":article(ECHANGE_VIDE, POTION, ["Currency", "coin_perdu", 1])
  },
  boutons:{
    btn_ch1_merchant_equip_01:{ ButtonDetailType:"merchant", ButtonDetailValue01:"240110001" },
    btn_merchant_wonderer_01:{ ButtonDetailType:"merchant", ButtonDetailValue01:"240110004" },
    btn_ch2_merchant_equip_01:{ ButtonDetailType:"merchant", ButtonDetailValue01:"240120001" },
    btn_quete:{ ButtonDetailType:"quest", ButtonDetailValue01:"240130001" }
  },
  interactions:{
    intertid_ch1_merchant_equip_01:{ ButtonTid:"btn_ch1_merchant_equip_01" },
    intertid_merchant_wonderer_01:{ ButtonTid:"btn_merchant_wonderer_01" },
    intertid_ch2_merchant_equip_01:{ ButtonTid:"btn_ch2_merchant_equip_01" },
    intertid_quete:{ ButtonTid:"btn_quete" }
  },
  pnj:{
    "60180014":{ Local_Key:"Local_Npc_Karim", InteractionTid:["intertid_ch1_merchant_equip_01"] },
    "60180006":{ Local_Key:"Local_Npc_Alexander", InteractionTid:["intertid_ch1_merchant_equip_01"] },
    "60190001":{ Local_Key:"Local_Npc_Nyandin", InteractionTid:["intertid_merchant_wonderer_01"] },
    /* Un PNJ qui n'apparait nulle part : sa boutique n'a pas de region. */
    "60200001":{ Local_Key:"Local_Npc_Gerard", InteractionTid:["intertid_ch2_merchant_equip_01"] },
    "60300001":{ Local_Key:"Local_Npc_Quete", InteractionTid:["intertid_quete"] }
  },
  apparitions:[
    { acteur:"60180006", secteur:"CH01_Sector_Main_Liones", sousSecteur:"CH01_Sector_Sub_Liones_Plain" },
    { acteur:"60180006", secteur:"CH01_Sector_Main_Liones", sousSecteur:"CH01_Sector_Sub_Liones_Plain" },
    { acteur:"60180014", secteur:"CH05_Sector_Main_Vanya", sousSecteur:"None" },
    { acteur:"60190001", secteur:"CH01_Sector_Main_Liones", sousSecteur:"CH01_Sector_Sub_Liones_Plain" }
  ],
  textes:{
    local_item_ore:"Minerai",
    local_item_sans_nom:"local_item_sans_nom",
    local_item_sword:"Épée longue",
    local_item_potion:"Potion",
    local_item_gold:"Or",
    local_item_coin_005:"Jeton Magi★Pop",
    ui_common_equipshop:"Boutique d'équipement",
    ui_common_randomshop:"Boutique itinérante",
    ui_common_exchangeevent:"Boutique d'échange de jeton Magi★Pop",
    ui_common_exchangeevent2:"Son retour : boutique d'échange",
    local_npc_karim:"Karim",
    local_npc_alexander:"Alexander",
    local_npc_nyandin:"Nyandin et Mou",
    local_npc_gerard:"Gérard",
    local_npc_quete:"Donneur de quête",
    ch01_sector_main_liones:"Liones",
    ch01_sector_sub_liones_plain:"Plaines de Liones",
    ch05_sector_main_vanya:"Vanya",
    local_item_seal_liones:"Sceau de Liones",
    local_mon_banakro:"Banakro",
    local_mon_mouette:"Mouette",
    local_mon_sans_nom:"local_mon_sans_nom",
    local_mining_fer:"Minerai de fer",
    local_dungeon_main_name_ferzen:"Mine de Ferzen",
    local_dungeon_sub_name_2802:"Normal",
    local_item_riz:"Riz", local_item_orge:"Orge", local_item_ble:"Blé", local_item_mais:"Maïs",
    local_item_seigle:"Seigle", local_item_avoine:"Avoine",
    local_item_tenue:"Tenue de prince", local_item_beignets:"Beignets", local_item_filet:"Filet",
    ui_making_title_selfcooking:"Élaborer des recettes",
    ui_making_title_autocooking:"Cuisiner la recette",
    local_making_npc:"local_making_npc",
    local_item_install_name_102061001:"Établi de fortune",
    local_item_install_name_102061002:"Établi robuste"
  },
  genereLe:"2026-09-25T00:00:00.000Z",
  dateExport:"2026-09-22"
};

const LIONES = "Boutique d'équipement — Liones";
const ITINERANTE_LIONES = "Boutique itinérante — Liones";
const GERARD = "Boutique d'équipement (Gérard)";
const MAGI = "Boutique d'échange de jeton Magi★Pop";

const catalogue = construireCatalogueObjets(ENTREE_OBJETS_TEST);
assert.equal(catalogue.version, 1);
assert.equal(catalogue.dateExport, "2026-09-22");
assert.equal(catalogue.articlesEcartes, 3);

assert.deepEqual(catalogue.boutiques, [
  { nom:LIONES, genre:"Boutique d'équipement", acces:"pnj",
    /* PNJ dans l'ordre de leur identifiant ; regions dedoublonnees. */
    pnj:["Alexander", "Karim"], regions:["Liones (Plaines de Liones)", "Vanya"],
    articles:[
      { objet:"Épée longue", prix:"1 800 Or", limite:"3 par jour" },
      { objet:"Minerai", quantite:5, prix:"2 Potion", limite:"10 par semaine" },
      { objet:"Potion", prix:"100 Or", limite:"1 au total", condition:"à partir du niveau de monde 3" }
    ] },
  { nom:ITINERANTE_LIONES, genre:"Boutique itinérante", acces:"pnj",
    pnj:["Nyandin et Mou"], regions:["Liones (Plaines de Liones)"], aleatoire:true,
    articles:[{ objet:"Minerai", prix:"500 Or" }] },
  /* Sans region : le nom du PNJ la distingue, rien n'est invente. */
  { nom:GERARD, genre:"Boutique d'équipement", acces:"pnj",
    pnj:["Gérard"], regions:[], articles:[{ objet:"Épée longue", prix:"2 000 Or" }] },
  { nom:"Boutique d'équipement", genre:"Boutique d'équipement", acces:"menu",
    pnj:[], regions:[], articles:[{ objet:"Potion", prix:"50 Or", limite:"2 au total" }] },
  { nom:MAGI, genre:MAGI, acces:"menu", pnj:[], regions:[],
    articles:[
      { objet:"Potion", prix:"5 Jeton Magi★Pop" },
      { objet:"Or", quantite:1000, prix:"1 Potion" }
    ] },
  /* Deux boutiques homonymes : la plus ancienne garde le nom nu. */
  { nom:MAGI + " (2)", genre:MAGI, acces:"menu", pnj:[], regions:[],
    articles:[{ objet:"Potion", prix:"7 Jeton Magi★Pop" }] }
]);

const FERZEN = "Mine de Ferzen (Normal)";

const ELABORER = "Cuisine — Élaborer des recettes";
const FORTUNE = "Fabrication — Établi de fortune";

/* Les boutiques d'abord, puis les butins (monstres et captures par acteur
   croissant, minage, donjons, confrerie), puis les recettes. */
assert.deepEqual(catalogue.objets, [
  { nom:"Beignets", type:"Consommable", sources:[
    { type:"recette", origine:"Cuisine" },
    { type:"recette", origine:"Fabrication — Établi robuste" }
  ] },
  { nom:"Épée longue", type:"Équipement", sources:[
    { type:"boutique", boutique:LIONES, prix:"1 800 Or", limite:"3 par jour" },
    { type:"boutique", boutique:GERARD, prix:"2 000 Or" },
    { type:"donjon", origine:FERZEN, detail:"première victoire" }
  ] },
  { nom:"Filet", type:"Consommable", sources:[{ type:"recette", origine:ELABORER }] },
  { nom:"Minerai", type:"Divers", sources:[
    { type:"boutique", boutique:LIONES, quantite:5, prix:"2 Potion", limite:"10 par semaine" },
    { type:"boutique", boutique:ITINERANTE_LIONES, prix:"500 Or", aleatoire:true },
    { type:"monstre", origine:"Banakro" },
    { type:"minage", origine:"Minerai de fer" },
    { type:"donjon", origine:FERZEN }
  ] },
  { nom:"Or", type:"Monnaie", sources:[
    { type:"boutique", boutique:MAGI, quantite:1000, prix:"1 Potion" },
    { type:"donjon", origine:FERZEN }
  ] },
  { nom:"Orge", type:"Divers", sources:[{ type:"recette", origine:"Combinaison" }] },
  { nom:"Potion", type:"Consommable", sources:[
    { type:"boutique", boutique:LIONES, prix:"100 Or", limite:"1 au total",
      condition:"à partir du niveau de monde 3" },
    { type:"boutique", boutique:"Boutique d'équipement", prix:"50 Or", limite:"2 au total" },
    { type:"boutique", boutique:MAGI, prix:"5 Jeton Magi★Pop" },
    { type:"boutique", boutique:MAGI + " (2)", prix:"7 Jeton Magi★Pop" },
    { type:"capture", origine:"Mouette" },
    { type:"donjon", origine:FERZEN },
    { type:"confrerie", origine:"Boss de confrérie", detail:"palier de participation 5" },
    { type:"recette", origine:FORTUNE + " ou supérieur" },
    { type:"recette", origine:FORTUNE }
  ] },
  /* Un objet que seul un butin donne entre aussi dans l'index. */
  { nom:"Sceau de Liones", type:"Monnaie", sources:[{ type:"monstre", origine:"Banakro" }] },
  { nom:"Tenue de prince", type:"Équipement", sources:[{ type:"recette", origine:"Gravure" }] }
]);

/* Cuisine, fabrication, gravure, combinaison, chacune par identifiant. */
assert.deepEqual(catalogue.recettes, [
  { produit:"Filet", quantite:2, type:ELABORER, ingredients:["Riz x2"] },
  { produit:"Beignets", type:"Cuisine",
    ingredients:["Minerai x1", "Riz x1 (ou : Orge, Blé, Maïs, Seigle et 1 autre)"] },
  { produit:"Potion", type:FORTUNE + " ou supérieur", ingredients:["Minerai x8", "Or x500"] },
  { produit:"Potion", type:FORTUNE, ingredients:["Minerai x3"] },
  { produit:"Beignets", type:"Fabrication — Établi robuste", ingredients:["Minerai x9"] },
  { produit:"Tenue de prince", type:"Gravure", ingredients:["Épée longue x1", "Potion x1"] },
  { produit:"Orge", type:"Combinaison", ingredients:["Minerai x5"] }
]);

assert.deepEqual(catalogue.butins, [
  { nom:"Mouette", type:"capture", objets:["Potion"], taux:{ Potion:"80 %" } },
  { nom:"Banakro", type:"monstre", objets:["Minerai", "Sceau de Liones"],
    /* Des niveaux qui se suivent : la forme courte. */
    taux:{ Minerai:"niveaux de monde 1 à 2 : 1,5 % ; 3,5 %", "Sceau de Liones":"100 %" } },
  { nom:"Minerai de fer", type:"minage", objets:["Minerai"] },
  { nom:FERZEN, type:"donjon", objets:["Or", "Potion", "Minerai"],
    taux:{ Or:"100 %", Potion:"18 %", Minerai:"2 %" } },
  { nom:FERZEN, type:"donjon", detail:"première victoire", objets:["Épée longue"] },
  { nom:"Boss de confrérie", type:"confrerie", detail:"palier de participation 5", objets:["Potion"],
    taux:{ Potion:"100 %" } }
]);

/* Une apparition sans region (chapitre 7 : Velia) se place par sa position
   dans le contour d'un secteur principal (Scene/Sector). Seulement si un
   seul contour la contient ET qu'il est du chapitre de sa table ; jamais de
   sous-secteur, que les contours ne tranchent pas. */
function regionsDeGerard(apparition, secteurs) {
  const entree = Object.assign({}, ENTREE_OBJETS_TEST, {
    apparitions:ENTREE_OBJETS_TEST.apparitions.concat([Object.assign(
      { acteur:"60200001", secteur:"None", sousSecteur:"None" }, apparition)]),
    secteurs,
    textes:Object.assign({ ch02_sector_main_fairyforest:"Forêt du roi des fées",
      ch03_sector_main_ferzen:"Ferzen" }, ENTREE_OBJETS_TEST.textes)
  });
  const boutique = construireCatalogueObjets(entree).boutiques.find(b => b.pnj.includes("Gérard"));
  return { nom:boutique.nom, regions:boutique.regions };
}
const CARRE = (x, y) => [{ X:x, Y:y }, { X:x + 100, Y:y }, { X:x + 100, Y:y + 100 }, { X:x, Y:y + 100 }];
const FORET = { cle:"CH02_Sector_Main_FairyForest", points:CARRE(0, 0) };
const FERZEN_CONTOUR = { cle:"CH03_Sector_Main_Ferzen", points:CARRE(50, 50) };

assert.deepEqual(regionsDeGerard({ position:{ X:20, Y:20 }, chapitre:2 }, [FORET, FERZEN_CONTOUR]),
  { nom:"Boutique d'équipement — Forêt du roi des fées", regions:["Forêt du roi des fées"] });
/* Deux contours : a la frontiere, on ne tranche pas. */
assert.deepEqual(regionsDeGerard({ position:{ X:70, Y:70 }, chapitre:2 }, [FORET, FERZEN_CONTOUR]),
  { nom:GERARD, regions:[] });
/* Un seul contour, mais d'un autre chapitre que la table d'apparition. */
assert.deepEqual(regionsDeGerard({ position:{ X:120, Y:120 }, chapitre:2 }, [FORET, FERZEN_CONTOUR]),
  { nom:GERARD, regions:[] });
/* Hors de tout contour, ou sans chapitre connu. */
assert.deepEqual(regionsDeGerard({ position:{ X:500, Y:500 }, chapitre:2 }, [FORET]),
  { nom:GERARD, regions:[] });
assert.deepEqual(regionsDeGerard({ position:{ X:20, Y:20 } }, [FORET]),
  { nom:GERARD, regions:[] });

/* Les filons : quantite par filon (Min_Cnt/Max_Cnt), nombre de filons par
   region (tables d'apparition, placees comme les PNJ), maximum par jour
   quand la chance vaut 100 %. Le filon de la carte JcJ (table sans
   chapitre) n'est pas compte. Pierre a feu : deux lignes, ni chance ni
   quantite. */
function entreeAvecFilons(apparitionsMinage) {
  const base = ENTREE_OBJETS_TEST;
  return Object.assign({}, base, {
    objets:Object.assign({}, base.objets, { etc:Object.assign({
      "101010041":{ Local_Key:"Local_Item_Platine" }, "101010000":{ Local_Key:"Local_Item_Pierre" }
    }, base.objets.etc) }),
    groupesButin:Object.assign({
      g_platine:{ DropPack_Key:["p_platine"], DropPack_Rate:[10000], DropPack_Type:[false] }
    }, base.groupesButin),
    paquetsButin:Object.assign({
      p_platine_1:{ DropPack_Key:"p_platine", DropType:"EDropType::Item", Item_Tid:"101010041",
        Standard_Level:"None", Rate:10000, Min_Cnt:2, Max_Cnt:3 },
      p_platine_2:{ DropPack_Key:"p_platine", DropType:"EDropType::Item", Item_Tid:"101010000",
        Standard_Level:"None", Rate:10000, Min_Cnt:4, Max_Cnt:4 },
      p_platine_3:{ DropPack_Key:"p_platine", DropType:"EDropType::Item", Item_Tid:"101010000",
        Standard_Level:"None", Rate:10000, Min_Cnt:2, Max_Cnt:4 }
    }, base.paquetsButin),
    minage:{ "84000017":{ Local_Key:"Local_Mining_Platine", DropGroupTid:"g_platine" } },
    apparitionsMinage,
    secteurs:[FORET],
    textes:Object.assign({
      local_item_platine:"Minerai de platine", local_item_pierre:"Pierre à feu",
      local_mining_platine:"Minerai de platine", ch02_sector_main_fairyforest:"Forêt du roi des fées"
    }, base.textes)
  });
}
const APPARITIONS_PLATINE_TEST = [
  { acteur:"84000017", secteur:"CH01_Sector_Main_Liones", sousSecteur:"None" },
  { acteur:"84000017", secteur:"CH01_Sector_Main_Liones", sousSecteur:"CH01_Sector_Sub_Liones_Plain" },
  { acteur:"84000017", secteur:"None", sousSecteur:"None", position:{ X:20, Y:20 }, chapitre:2 },
  { acteur:"84000017", secteur:"None", sousSecteur:"None", position:{ X:20, Y:20 } }
];
function butinsAvecFilons(apparitionsMinage) {
  return construireCatalogueObjets(entreeAvecFilons(apparitionsMinage)).butins.find(butin => butin.type === "minage");
}

assert.deepEqual(butinsAvecFilons(APPARITIONS_PLATINE_TEST), {
  nom:"Minerai de platine", type:"minage", objets:["Minerai de platine", "Pierre à feu"],
  taux:{ "Minerai de platine":"100 %" },
  quantites:{ "Minerai de platine":"2 à 3" },
  filons:{ total:3, regions:["Liones : 2", "Forêt du roi des fées : 1"] },
  parJour:{ "Minerai de platine":"6 à 9" }
});
/* Sans filon place : ni total ni maximum par jour, la quantite reste. */
assert.deepEqual(butinsAvecFilons([]), {
  nom:"Minerai de platine", type:"minage", objets:["Minerai de platine", "Pierre à feu"],
  taux:{ "Minerai de platine":"100 %" },
  quantites:{ "Minerai de platine":"2 à 3" }
});

/* La Boutique d'echange du menu Boutique (PackageStore*) : ses onglets
   d'echange contre une monnaie du jeu. Un article expire a la date de
   l'export n'y figure pas ; un article en argent reel y figure sans prix. La periode de
   « packageshop_update_3 » n'est pas dans les fichiers : le proprietaire
   l'a relevee en jeu (35 a 36 jours). */
function magasin(onglet, nom, paiement, prix, limite, reset, typeLimite, fin, paquet, autres) {
  return Object.assign({
    Store_Show_Group:onglet, Store_Show_Order:1, Goods_Payment_Type:"ECurrencyType::" + paiement,
    Cash_Product_Check:false, Goods_Payment_Value:[prix], Goods_Name:nom, Goods_Buy_Limit:limite,
    Goods_Buy_Limit_Type:"EGoodsBuyLimitType::" + typeLimite, Buy_Limit_Contents_Reset:reset,
    Limit_Goods_Time_End:fin, Sell_Goods_DropTid:paquet
  }, autres || {});
}
function entreeAvecMagasin() {
  const base = ENTREE_OBJETS_TEST;
  return Object.assign({}, base, {
    monnaies:Object.assign({ core_ether:{ LinkItemTid:100000119 } }, base.monnaies),
    objets:Object.assign({}, base.objets, {
      dropType:Object.assign({ "100000119":{ Local_Key:"Local_Item_Ether" } }, base.objets.dropType)
    }),
    groupesButin:Object.assign({ g_minerai_magasin:{ DropPack_Key:["p_minerai_magasin"] } }, base.groupesButin),
    paquetsButin:Object.assign({
      p_minerai_magasin_1:{ DropPack_Key:"p_minerai_magasin", DropType:"EDropType::Item", Item_Tid:"101000001" }
    }, base.paquetsButin),
    magasins:{ store_tradein_data:{ Store_Button_Name:"ui_store02_tap_name_04" } },
    ongletsMagasin:{
      store_tradein_subtab_03:{ Store_Tid:"store_tradein_data", Store_Show_Order:3, Shop_SubTab_Name:"ui_store03_tap_name_03" }
    },
    articlesMagasin:{
      m_minerai:magasin("store_tradein_subtab_03", "local_item_ore", "Core_Ether", 5, 100,
        "packageshop_update_3", "ContentsReset", "None", "g_minerai_magasin", { Store_Show_Order:2 }),
      m_potion:magasin("store_tradein_subtab_03", "local_item_potion", "Core_Ether", 120, 8,
        "packageshop_weekly", "ContentsReset", "None", "g_minerai_magasin", { Store_Show_Order:1 }),
      m_epee:magasin("store_tradein_subtab_03", "local_item_sword", "Core_Ether", 180, 2,
        "None", "Limit", "+09:00 2026-10-08 15:59:59", "g_minerai_magasin", { Store_Show_Order:3 }),
      /* Periode inconnue des fichiers et non relevee : dite telle quelle. */
      m_ticket:magasin("store_tradein_subtab_03", "local_item_sword", "Core_Ether", 50, 7,
        "packageshop_update_6", "ContentsReset", "None", "g_minerai_magasin", { Store_Show_Order:4 }),
      /* Offre terminee avant l'export du 22/09/2026. */
      m_perime:magasin("store_tradein_subtab_03", "local_item_ore", "Core_Ether", 30, 25,
        "None", "Limit", "+09:00 2026-04-10 15:59:59", "g_minerai_magasin"),
      /* Argent reel : sans chiffre. */
      m_payant:magasin("store_tradein_subtab_03", "local_item_ore", "Cash", 1, 1,
        "None", "None", "None", "g_minerai_magasin", { Cash_Product_Check:true }),
      /* Un paquet d'un autre magasin (onglet inconnu) : ignore. */
      m_ailleurs:magasin("store_package_subtab_01", "local_item_ore", "Core_Ether", 1, 1,
        "None", "None", "None", "g_minerai_magasin")
    },
    textes:Object.assign({
      local_item_ether:"Fragment de traînée stellaire",
      ui_store02_tap_name_04:"Boutique d'échange",
      ui_store03_tap_name_03:"Fragment de traînée stellaire"
    }, base.textes)
  });
}
const AVEC_MAGASIN = construireCatalogueObjets(entreeAvecMagasin());
const ECHANGE_ETHER = "Boutique d'échange — Fragment de traînée stellaire";
assert.deepEqual(AVEC_MAGASIN.boutiques.find(boutique => boutique.nom === ECHANGE_ETHER), {
  nom:ECHANGE_ETHER, genre:"Boutique d'échange", acces:"menu", pnj:[], regions:[],
  articles:[
    /* Le paquet de la potion contient du minerai : il le dit. */
    { objet:"Potion", prix:"120 Fragment de traînée stellaire", limite:"8 par semaine", contenu:["Minerai"] },
    { objet:"Minerai", prix:"argent réel (prix selon ta boutique d'applications)", limite:"1 au total" },
    { objet:"Minerai", prix:"5 Fragment de traînée stellaire", limite:"100 tous les 35 à 36 jours environ" },
    { objet:"Épée longue", prix:"180 Fragment de traînée stellaire", limite:"2 au total, jusqu'au 08/10/2026",
      contenu:["Minerai"] },
    { objet:"Épée longue", prix:"50 Fragment de traînée stellaire", limite:"7 par période (durée inconnue)",
      contenu:["Minerai"] }
  ]
});
assert.deepEqual(AVEC_MAGASIN.objets.find(objet => objet.nom === "Minerai").sources[0],
  { type:"boutique", boutique:LIONES, quantite:5, prix:"2 Potion", limite:"10 par semaine" });
assert.ok(AVEC_MAGASIN.objets.find(objet => objet.nom === "Minerai").sources.some(source =>
  source.boutique === ECHANGE_ETHER && source.limite === "100 tous les 35 à 36 jours environ"));
assert.equal(AVEC_MAGASIN.boutiques.length, catalogue.boutiques.length + 1);

/* Le cube de recompense d'un boss ou d'une elite : MonsterActorTable
   (DropActorObjectTid) -> ObjectActorTable (InteractionTid) ->
   InteractionTable (DropGroupTid), ouvert avec des cles (bouton RewardKey :
   monnaie et nombre). Aucun lien par le nom. Un cout de 0 n'est pas dit. */
function entreeAvecCube() {
  const base = ENTREE_OBJETS_TEST;
  return Object.assign({}, base, {
    monnaies:Object.assign({ rewardkey:{ LinkItemTid:100000150 } }, base.monnaies),
    objets:Object.assign({}, base.objets, {
      dropType:Object.assign({ "100000150":{ Local_Key:"Local_Item_Cle" } }, base.objets.dropType)
    }),
    monstres:Object.assign({}, base.monstres, {
      "50103301":{ Local_Key:"Local_Mon_Demon", DropGroupTid:"None", CatchDropGroupTid:"None",
        DropActorObjectTid:"77220301" },
      "50200001":{ Local_Key:"Local_Mon_Elite", DropGroupTid:"None", CatchDropGroupTid:"None",
        DropActorObjectTid:"77230001" },
      /* Objet absent d'ObjectActorTable : rien. */
      "50200002":{ Local_Key:"Local_Mon_Perdu", DropGroupTid:"None", CatchDropGroupTid:"None",
        DropActorObjectTid:"77999999" }
    }),
    objetsActeurs:{
      "77220301":{ InteractionTid:["intertid_cube_boss"] },
      "77230001":{ InteractionTid:["intertid_cube_elite"] }
    },
    interactions:Object.assign({
      intertid_cube_boss:{ ButtonTid:"btn_cube_boss", DropGroupTid:"g_cube" },
      intertid_cube_elite:{ ButtonTid:"btn_cube_elite", DropGroupTid:"g_cube" }
    }, base.interactions),
    boutons:Object.assign({
      btn_cube_boss:{ ButtonType:"EInteractionButtonType::RewardKey", ButtonDetailValue01:"rewardkey", ButtonDetailValue02:"10" },
      btn_cube_elite:{ ButtonType:"EInteractionButtonType::RewardKey", ButtonDetailValue01:"rewardkey", ButtonDetailValue02:"0" }
    }, base.boutons),
    groupesButin:Object.assign({
      g_cube:{ DropPack_Key:["p_cube_or", "p_cube_hasard", "p_cube_pierre"], DropPack_Rate:[10000, 10000, 10000],
        DropPack_Type:[false, true, false] }
    }, base.groupesButin),
    paquetsButin:Object.assign({
      p_cube_or_1:{ DropPack_Key:"p_cube_or", DropType:"EDropType::Gold", Item_Tid:"None",
        Standard_Level:"None", Rate:10000, Min_Cnt:16000, Max_Cnt:19000 },
      p_cube_hasard_1:{ DropPack_Key:"p_cube_hasard", DropType:"EDropType::Item", Item_Tid:"131000001",
        Standard_Level:"None", Rate:1000, Min_Cnt:1, Max_Cnt:1 },
      p_cube_hasard_2:{ DropPack_Key:"p_cube_hasard", DropType:"EDropType::Item", Item_Tid:"102000001",
        Standard_Level:"None", Rate:9000, Min_Cnt:1, Max_Cnt:1 },
      /* Chaque objet a UN niveau de monde : jamais « 100 % » tout court. */
      p_cube_pierre_1:{ DropPack_Key:"p_cube_pierre", DropType:"EDropType::Item", Item_Tid:"101000001",
        Standard_Level:"level_01", Rate:10000, Min_Cnt:13, Max_Cnt:17 },
      p_cube_pierre_2:{ DropPack_Key:"p_cube_pierre", DropType:"EDropType::Item", Item_Tid:"101000010",
        Standard_Level:"level_02", Rate:10000, Min_Cnt:9, Max_Cnt:12 }
    }, base.paquetsButin),
    textes:Object.assign({
      local_item_cle:"Clé de cube", local_mon_demon:"Démon rouge", local_mon_elite:"Chef des ours-garous",
      local_mon_perdu:"Monstre perdu"
    }, base.textes)
  });
}
const AVEC_CUBE = construireCatalogueObjets(entreeAvecCube());
assert.deepEqual(AVEC_CUBE.butins.filter(butin => butin.type === "cube"), [
  { nom:"Démon rouge", type:"cube", detail:"à ouvrir avec 10 Clé de cube",
    objets:["Or", "Épée longue", "Potion", "Minerai", "Riz"],
    taux:{ Or:"100 %", "Épée longue":"10 %", Potion:"90 %",
      Minerai:"niveau de monde 1 : 100 %", Riz:"niveau de monde 2 : 100 %" },
    quantites:{ Or:"16 000 à 19 000", Minerai:"13 à 17", Riz:"9 à 12" } },
  { nom:"Chef des ours-garous", type:"cube", objets:["Or", "Épée longue", "Potion", "Minerai", "Riz"],
    taux:{ Or:"100 %", "Épée longue":"10 %", Potion:"90 %",
      Minerai:"niveau de monde 1 : 100 %", Riz:"niveau de monde 2 : 100 %" },
    quantites:{ Or:"16 000 à 19 000", Minerai:"13 à 17", Riz:"9 à 12" } }
]);
assert.ok(AVEC_CUBE.objets.find(objet => objet.nom === "Épée longue").sources
  .some(source => source.type === "cube" && source.origine === "Démon rouge"
    && source.detail === "à ouvrir avec 10 Clé de cube"));

/* Les autres onglets de la Boutique (Lots, Mémoire des étoiles, Boutique de
   renforcement). Choix du proprietaire du 25/09/2026 : un paquet paye en
   argent reel est une source comme une autre, mais sans chiffre (la valeur
   des fichiers n'est pas un prix : « 120 memoires des etoiles » y vaut 120).
   Le contenu du lot vient de son groupe de butin ; chaque objet du lot
   renvoie au lot. Les coupons (internes) ne sont jamais lus. */
const PRIX_REEL = "argent réel (prix selon ta boutique d'applications)";
function entreeAvecLots() {
  const base = entreeAvecMagasin();
  return Object.assign({}, base, {
    monnaies:Object.assign({ rewardkey:{ LinkItemTid:100000150 }, cash_paid:{ LinkItemTid:100000151 } }, base.monnaies),
    objets:Object.assign({}, base.objets, {
      dropType:Object.assign({
        "100000150":{ Local_Key:"Local_Item_Cle" }, "100000151":{ Local_Key:"Local_Item_Memoire" }
      }, base.objets.dropType)
    }),
    groupesButin:Object.assign({ g_lot:{ DropPack_Key:["p_lot"], DropPack_Rate:[10000], DropPack_Type:[false] } },
      base.groupesButin),
    paquetsButin:Object.assign({
      p_lot_1:{ DropPack_Key:"p_lot", DropType:"EDropType::RewardKey", Item_Tid:"None", Standard_Level:"None",
        Rate:10000, Min_Cnt:120, Max_Cnt:120 },
      p_lot_2:{ DropPack_Key:"p_lot", DropType:"EDropType::Item", Item_Tid:"101000001", Standard_Level:"None",
        Rate:10000, Min_Cnt:1, Max_Cnt:1 },
      /* Sans nom (abonnement) : absent du contenu. */
      p_lot_3:{ DropPack_Key:"p_lot", DropType:"EDropType::Subscription", Item_Tid:"None", Standard_Level:"None",
        Rate:10000, Min_Cnt:1, Max_Cnt:1 }
    }, base.paquetsButin),
    magasins:Object.assign({ store_lots:{ Store_Button_Name:"ui_lots" }, store_coupon_data:{ Store_Button_Name:"None" } },
      base.magasins),
    ongletsMagasin:Object.assign({
      lots_cle:{ Store_Tid:"store_lots", Store_Show_Order:4, Shop_SubTab_Name:"ui_lots_cle" },
      coupons:{ Store_Tid:"store_coupon_data", Store_Show_Order:1, Shop_SubTab_Name:"None" }
    }, base.ongletsMagasin),
    articlesMagasin:Object.assign({
      l_cle:magasin("lots_cle", "local_lot_cle", "Cash", 5900, 5, "packageshop_update_3", "ContentsReset",
        "None", "g_lot", { Cash_Product_Check:true, Store_Show_Order:1 }),
      l_renfo:magasin("lots_cle", "local_lot_renfo", "Cash_Paid", 990, 0, "None", "None",
        "None", "g_minerai_magasin", { Store_Show_Order:2 }),
      l_gratuit:magasin("lots_cle", "local_lot_gratuit", "Cash_Paid", 0, 1, "packageshop_daily", "ContentsReset",
        "None", "g_minerai_magasin", { Store_Show_Order:3 }),
      l_coupon:magasin("coupons", "local_lot_cle", "Coupon", 0, 0, "None", "None", "None", "g_lot",
        { Cash_Product_Check:true })
    }, base.articlesMagasin),
    textes:Object.assign({
      local_item_cle:"Clé de cube", local_item_memoire:"Mémoire des étoiles (payée)",
      ui_lots:"Lots", ui_lots_cle:"Clé de cube",
      local_lot_cle:"Lot Clé de cube", local_lot_renfo:"Renforcement niv. 1", local_lot_gratuit:"Une fois par jour"
    }, base.textes)
  });
}
const AVEC_LOTS = construireCatalogueObjets(entreeAvecLots());
assert.deepEqual(AVEC_LOTS.boutiques.find(boutique => boutique.nom === "Lots — Clé de cube"), {
  nom:"Lots — Clé de cube", genre:"Lots", acces:"menu", pnj:[], regions:[],
  articles:[
    { objet:"Lot Clé de cube", prix:PRIX_REEL, limite:"5 tous les 35 à 36 jours environ",
      contenu:["Clé de cube x120", "Minerai"] },
    { objet:"Renforcement niv. 1", prix:"990 Mémoire des étoiles (payée)", contenu:["Minerai"] },
    { objet:"Une fois par jour", prix:"gratuit", limite:"1 par jour", contenu:["Minerai"] }
  ]
});
assert.equal(AVEC_LOTS.boutiques.filter(boutique => boutique.genre === "Lots").length, 1, "les coupons ne sont pas lus");
const sourcesCle = AVEC_LOTS.objets.find(objet => objet.nom === "Clé de cube").sources;
assert.deepEqual(sourcesCle, [{ type:"boutique", boutique:"Lots — Clé de cube", paquet:"Lot Clé de cube",
  quantite:120, prix:PRIX_REEL, limite:"5 tous les 35 à 36 jours environ" }]);
assert.deepEqual(AVEC_LOTS.objets.find(objet => objet.nom === "Lot Clé de cube").sources,
  [{ type:"boutique", boutique:"Lots — Clé de cube", prix:PRIX_REEL, limite:"5 tous les 35 à 36 jours environ" }]);

module.exports = { ENTREE_OBJETS_TEST, ENTREE_FILONS_TEST:entreeAvecFilons(APPARITIONS_PLATINE_TEST),
  ENTREE_CUBE_TEST:entreeAvecCube(), ENTREE_LOTS_TEST:entreeAvecLots() };

if(require.main === module) console.log("OK objets-jarvis");
