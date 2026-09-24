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
const EPEE = ["Item", "131000001"];
const EPEE_BIS = ["Item", "131000002"];
const MINERAI = ["Item", "101000001"];
const SANS_NOM = ["Item", "101000002"];
const POTION = ["Item", "102000001"];

const ENTREE_OBJETS_TEST = {
  objets:{
    etc:{
      "101000001":{ Local_Key:"Local_Item_Ore" },
      /* Traduction absente : le jeu rend la cle elle-meme. */
      "101000002":{ Local_Key:"local_item_sans_nom" }
    },
    /* Deux epees homonymes : une seule entree dans l'index. */
    equip:{ "131000001":{ Local_Key:"Local_Item_Sword" }, "131000002":{ Local_Key:"Local_Item_Sword" } },
    use:{ "102000001":{ Local_Key:"Local_Item_Potion" } },
    quest:{},
    pet:{},
    dropType:{ "100000101":{ Local_Key:"Local_Item_Gold" }, "100000905":{ Local_Key:"Local_Item_Coin_005" } }
  },
  /* La ligne de monnaie n'a pas de nom : il passe par LinkItemTid. */
  monnaies:{
    gold:{ LinkItemTid:100000101 },
    campaign_coin_005:{ LinkItemTid:100000905 },
    coin_perdu:{ LinkItemTid:999 }
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
    "252100102":article(ECHANGE, ["Currency", "gold"], ["Item", "102000001", 1], { GetCount:1000 })
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
    local_npc_karim:"Karim",
    local_npc_alexander:"Alexander",
    local_npc_nyandin:"Nyandin et Mou",
    local_npc_gerard:"Gérard",
    local_npc_quete:"Donneur de quête",
    ch01_sector_main_liones:"Liones",
    ch01_sector_sub_liones_plain:"Plaines de Liones",
    ch05_sector_main_vanya:"Vanya"
  },
  genereLe:"2026-09-25T00:00:00.000Z",
  dateExport:"2026-09-22"
};

const LIONES = "Boutique d'équipement de Liones";
const ITINERANTE_LIONES = "Boutique itinérante de Liones";
const MAGI = "Boutique d'échange de jeton Magi★Pop";

const catalogue = construireCatalogueObjets(ENTREE_OBJETS_TEST);
assert.equal(catalogue.version, 1);
assert.equal(catalogue.dateExport, "2026-09-22");
assert.equal(catalogue.articlesEcartes, 2);

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
  /* Deux boutiques homonymes sans region : la plus ancienne garde le nom. */
  { nom:"Boutique d'équipement", genre:"Boutique d'équipement", acces:"pnj",
    pnj:["Gérard"], regions:[], articles:[{ objet:"Épée longue", prix:"2 000 Or" }] },
  { nom:"Boutique d'équipement (2)", genre:"Boutique d'équipement", acces:"menu",
    pnj:[], regions:[], articles:[{ objet:"Potion", prix:"50 Or", limite:"2 au total" }] },
  { nom:MAGI, genre:MAGI, acces:"menu", pnj:[], regions:[],
    articles:[
      { objet:"Potion", prix:"5 Jeton Magi★Pop" },
      { objet:"Or", quantite:1000, prix:"1 Potion" }
    ] }
]);

assert.deepEqual(catalogue.objets, [
  { nom:"Épée longue", type:"Équipement", sources:[
    { type:"boutique", boutique:LIONES, prix:"1 800 Or", limite:"3 par jour" },
    { type:"boutique", boutique:"Boutique d'équipement", prix:"2 000 Or" }
  ] },
  { nom:"Minerai", type:"Divers", sources:[
    { type:"boutique", boutique:LIONES, quantite:5, prix:"2 Potion", limite:"10 par semaine" },
    { type:"boutique", boutique:ITINERANTE_LIONES, prix:"500 Or", aleatoire:true }
  ] },
  { nom:"Or", type:"Monnaie", sources:[
    { type:"boutique", boutique:MAGI, quantite:1000, prix:"1 Potion" }
  ] },
  { nom:"Potion", type:"Consommable", sources:[
    { type:"boutique", boutique:LIONES, prix:"100 Or", limite:"1 au total",
      condition:"à partir du niveau de monde 3" },
    { type:"boutique", boutique:"Boutique d'équipement (2)", prix:"50 Or", limite:"2 au total" },
    { type:"boutique", boutique:MAGI, prix:"5 Jeton Magi★Pop" }
  ] }
]);

module.exports = { ENTREE_OBJETS_TEST };

if(require.main === module) console.log("OK objets-jarvis");
