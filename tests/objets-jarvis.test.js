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
    /* Chance = taux du groupe x taux de l'objet : 80 % x 25 % = 20 %
       (confirme par le proprietaire sur la Belette). */
    g_capture:{ DropPack_Key:["p_capture"], DropPack_Rate:[8000], DropPack_Type:[true] },
    /* Sans taux de groupe : aucune chance affichee. */
    g_minage:{ DropPack_Key:["p_minage"] },
    g_donjon:{ DropPack_Key:["p_donjon"], DropPack_Rate:[10000], DropPack_Type:[false] },
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
    { type:"minage", origine:"Minerai de fer" }
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
  { nom:"Mouette", type:"capture", objets:["Potion"], taux:{ Potion:"20 %" } },
  { nom:"Banakro", type:"monstre", objets:["Minerai", "Sceau de Liones"],
    /* Des niveaux qui se suivent : la forme courte. */
    taux:{ Minerai:"niveaux de monde 1 à 2 : 1,5 % ; 3,5 %", "Sceau de Liones":"100 %" } },
  { nom:"Minerai de fer", type:"minage", objets:["Minerai"] },
  { nom:FERZEN, type:"donjon", objets:["Or"], taux:{ Or:"100 %" } },
  { nom:FERZEN, type:"donjon", detail:"première victoire", objets:["Épée longue"] },
  { nom:"Boss de confrérie", type:"confrerie", detail:"palier de participation 5", objets:["Potion"],
    taux:{ Potion:"100 %" } }
]);

module.exports = { ENTREE_OBJETS_TEST };

if(require.main === module) console.log("OK objets-jarvis");
