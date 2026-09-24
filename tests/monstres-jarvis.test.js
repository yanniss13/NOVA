"use strict";

/* L'extraction des monstres pour /jarvis, sur un mini-export ecrit ici. Les
   formes des tables sont celles de l'export reel du 24/09/2026 : trois
   Demons rouges, dont la version Cross Challenge, Akumu et ses paliers
   (son acteur pointe sur le groupe de test), un donjon nomme, un monstre
   sans contexte, un acteur sans nom. */

const assert = require("node:assert/strict");
const path = require("node:path");

const { construireCatalogueMonstres } = require(path.resolve(
  __dirname, "..", "outils", "fabrication", "monstres-jarvis.js"
));

const ELEMENTS = ["Default", "Thunder", "Wind", "Fire", "Ice", "Earth", "Dark", "Holy"];
function groupe(faiblesses, autres) {
  const g = {};
  ELEMENTS.forEach(e => {
    g[e + "_Weakness_Rate"] = (faiblesses && faiblesses[e]) || 0;
    g[e + "_Element_Res_Rate"] = 1000;
  });
  return Object.assign(g, {
    B_MaxHp:95747, B_Def:555, B_Atk:1547, C_Critical_ResRate:1000,
    C_Critical_DamRes_Rate:869, A_Block:177, D_Block_DamRes_Rate:9500, D_All_DamRes_Rate:0
  }, autres || {});
}
const TOUS_A = valeur => Object.fromEntries(ELEMENTS.map(e => [e, valeur]));
const PUISSANCE = [
  { StandardWorldLevelTID:"Level_01", BattlePower:3144 },
  { StandardWorldLevelTID:"Level_04", BattlePower:19495 }
];
const NOM_ROUGE = "Local_Mon_Name_Boss_Demon_Red_0001";

const ENTREE_MONSTRES_TEST = {
  textes:{
    local_mon_name_boss_demon_red_0001:"Démon rouge",
    local_mon_name_akumu:"Akumu, bête démoniaque",
    local_mon_name_rabbit:"Lapin",
    local_dungeon_main_name_2806:"Démon rouge",
    local_dungeon_main_sub_name_2806:"Réveil après un long sommeil",
    local_dungeon_sub_name_2801:"Facile",
    local_dungeon_sub_name_2804:"Cauchemar",
    area_sector_1m:"Britannia"
  },
  monstres:{
    "50103301":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_50103301", Recommend_BattlePower:PUISSANCE },
    "50103302":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_50103301", Recommend_BattlePower:PUISSANCE },
    "51900001":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_51900001", Recommend_BattlePower:[] },
    "50600106":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_50600106", Recommend_BattlePower:[] },
    "51300009":{ Local_Key:NOM_ROUGE, grade:"EActorGrade::Boss", StatGroupTid:"stat_poweroverwhelming", Recommend_BattlePower:[] },
    "50700109":{ Local_Key:"local_mon_name_akumu", grade:"EActorGrade::Boss", StatGroupTid:"stat_poweroverwhelming", Recommend_BattlePower:[] },
    "60000001":{ Local_Key:"local_mon_name_rabbit", grade:"EActorGrade::Normal", StatGroupTid:"stat_rabbit", Recommend_BattlePower:[] },
    "60000002":{ Local_Key:"local_mon_name_sans_texte", grade:"EActorGrade::Elite", StatGroupTid:"stat_rabbit", Recommend_BattlePower:[] },
    "60000003":{ Local_Key:"local_mon_name_rabbit", grade:"EActorGrade::Normal", StatGroupTid:"stat_absent", Recommend_BattlePower:[] }
  },
  groupes:{
    stat_50103301:groupe({ Fire:-3000, Earth:2000, Holy:2000 }),
    stat_51900001:groupe({ Fire:-3000, Earth:2000, Holy:2000 }, { B_Atk:1426 }),
    stat_50600106:groupe(Object.assign(TOUS_A(-8000), { Ice:3000, Holy:3000 }), { B_Atk:601 }),
    stat_50700109_1:groupe(TOUS_A(-3000), { B_MaxHp:1000000 }),
    stat_50700109_30:groupe(TOUS_A(-3000), { B_MaxHp:9000000 }),
    stat_rabbit:Object.assign(groupe(null, { B_MaxHp:100, B_Def:5, B_Atk:3 }),
      Object.fromEntries(ELEMENTS.map(e => [e + "_Element_Res_Rate", 0]))),
    stat_poweroverwhelming:groupe(null, { B_MaxHp:9999999 })
  },
  paliersBoss:{
    "1001":{ Boss_Tid:50700109, Stat_Level:1, Stat_Group:"stat_50700109_1" },
    "1030":{ Boss_Tid:50700109, Stat_Level:30, Stat_Group:"stat_50700109_30" }
  },
  bossTerrain:{ "1":{ FieldBossTid:"50103301" } },
  donjons:{
    "1601":{ Dungeon_Zone:50801003, Dungeon_Type:"EDungeonType::Boss_Replay_Event",
      Dungeon_Group:81002806, Local_Sub_Name:"local_dungeon_sub_name_2801", Dungeon_Clear_Value:"51900001" },
    "1604":{ Dungeon_Zone:50801003, Dungeon_Type:"EDungeonType::Boss_Replay_Event",
      Dungeon_Group:81002806, Local_Sub_Name:"local_dungeon_sub_name_2804", Dungeon_Clear_Value:"51900001" }
  },
  groupesDonjon:{
    "81002806":{ Local_Main_Name:"local_dungeon_main_name_2806",
      Local_Main_Sub_Name:"local_dungeon_main_sub_name_2806", Dungeon_Core_Monster:["51900001"] }
  },
  zones:{ "50201001":{ Local_ZoneName:"area_sector_1m" }, "50801003":{ Local_ZoneName:"None" } },
  apparitions:[
    { fichier:"Chapter_03_Mon_spawntable", zone:"50201001", acteurs:["50103302"] },
    { fichier:"CrossChallenge_50406002_Spawn_spawntable", zone:"50406002", acteurs:["50600106"] },
    { fichier:"DemonRed_Spawn_spawntable", zone:"50801003", acteurs:["51900001"] }
  ],
  genereLe:"2026-09-24T12:00:00.000Z",
  dateExport:"2026-09-24"
};

const LIBELLE_DONJON = "Donjon : Démon rouge — Réveil après un long sommeil"
  + " (boss rejouable, événement) — Facile, Cauchemar";

function main() {
  const catalogue = construireCatalogueMonstres(ENTREE_MONSTRES_TEST);
  assert.equal(catalogue.version, 1);
  assert.equal(catalogue.dateExport, "2026-09-24");
  assert.equal(catalogue.genereLe, "2026-09-24T12:00:00.000Z");
  assert.deepEqual(catalogue.monstres.map(m => m.nom),
    ["Akumu, bête démoniaque", "Démon rouge", "Lapin"],
    "tri par nom ; l'acteur sans texte et le groupe absent sont ecartes");

  const rouge = catalogue.monstres.find(m => m.nom === "Démon rouge");
  assert.equal(rouge.rang, "boss");
  assert.equal(rouge.versions.length, 3,
    "terrain et chapitre 3 fusionnes (memes stats), donjon, Cross Challenge ; le groupe de test ecarte");
  const [terrain, donjon, cross] = rouge.versions;
  assert.deepEqual(terrain.acteurs, ["50103301", "50103302"]);
  assert.deepEqual(terrain.contextes, [
    { type:"terrain", libelle:"Boss de terrain" },
    { type:"zone", libelle:"Zone : Britannia" }
  ]);
  assert.deepEqual(terrain.puissance, { "1":3144, "4":19495 });
  assert.equal(terrain.stats.faiblesses.Fire, -3000, "negatif = resistance, tel quel");
  assert.equal(terrain.stats.faiblesses.Earth, 2000);
  assert.equal(terrain.stats.resistances.Holy, 1000);
  assert.deepEqual(
    [terrain.stats.pv, terrain.stats.defense, terrain.stats.attaque, terrain.stats.resCrit, terrain.stats.defCrit],
    [95747, 555, 1547, 1000, 869]);
  assert.deepEqual(donjon.acteurs, ["51900001"]);
  assert.deepEqual(donjon.contextes, [{ type:"donjon", libelle:LIBELLE_DONJON }],
    "l'apparition dans la zone du donjon prend le nom du donjon, sans doublon");
  assert.equal(donjon.puissance, undefined, "aucune puissance publiee, aucun champ");
  assert.deepEqual(cross.contextes, [{ type:"cross", libelle:"Cross Challenge" }]);
  assert.equal(cross.stats.faiblesses.Ice, 3000);
  assert.equal(cross.stats.faiblesses.Thunder, -8000);
  assert.ok(!rouge.versions.some(v => v.acteurs.includes("51300009")),
    "stat_poweroverwhelming est un groupe de test");

  const akumu = catalogue.monstres.find(m => m.nom.startsWith("Akumu"));
  assert.deepEqual(akumu.versions.map(v => v.niveau), [1, 30],
    "les paliers de BossStatGroupTable, malgre l'acteur sur le groupe de test");
  assert.deepEqual(akumu.versions[0].contextes, [{ type:"confrerie", libelle:"Boss de confrérie" }]);
  assert.equal(akumu.versions[1].stats.pv, 9000000);
  assert.equal(akumu.versions[0].stats.faiblesses.Holy, -3000);

  const lapin = catalogue.monstres.find(m => m.nom === "Lapin");
  assert.equal(lapin.rang, "normal");
  assert.deepEqual(lapin.versions[0].contextes, [], "aucun contexte retrouve : liste vide");
  assert.equal(lapin.versions[0].stats.resistances.Fire, 0);

  /* Une zone partagee par des donjons de noms differents : l'export reel en a
     sept sur quarante-deux. Une apparition y prenait le nom du PREMIER donjon
     trouve, faux une fois sur deux. Deux groupes de meme nom ne comptent
     qu'une fois ; le boss garde son etiquette exacte, sans l'etiquette
     generique de la zone en plus. */
  const partage = JSON.parse(JSON.stringify(ENTREE_MONSTRES_TEST));
  partage.textes.local_dungeon_main_name_9001 = "Berceau des étoiles";
  partage.donjons["1701"] = { Dungeon_Zone:50801003, Dungeon_Type:"EDungeonType::Normal",
    Dungeon_Group:9001, Local_Sub_Name:"None", Dungeon_Clear_Value:"None" };
  partage.donjons["1801"] = { Dungeon_Zone:50801003, Dungeon_Type:"EDungeonType::Boss_Replay",
    Dungeon_Group:9002, Local_Sub_Name:"None", Dungeon_Clear_Value:"None" };
  partage.groupesDonjon["9001"] = { Local_Main_Name:"local_dungeon_main_name_9001" };
  partage.groupesDonjon["9002"] = { Local_Main_Name:"local_dungeon_main_name_2806" };
  partage.apparitions.push({ fichier:"Berceau_spawntable", zone:"50801003", acteurs:["60000001"] });
  const catalogueDePartage = construireCatalogueMonstres(partage);
  const lapinPartage = catalogueDePartage.monstres.find(m => m.nom === "Lapin");
  assert.deepEqual(lapinPartage.versions[0].contextes, [{ type:"donjon",
    libelle:"Donjons partageant la zone : Berceau des étoiles, Démon rouge" }]);
  const rougePartage = catalogueDePartage.monstres.find(m => m.nom === "Démon rouge");
  assert.deepEqual(rougePartage.versions[1].contextes, [{ type:"donjon", libelle:LIBELLE_DONJON }],
    "le boss garde son étiquette exacte, sans l'étiquette générique de la zone");

  console.log("OK monstres-jarvis");
}

module.exports = { ENTREE_MONSTRES_TEST };

if(require.main === module) main();
