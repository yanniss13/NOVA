"use strict";

/* Extrait l'index des objets et les boutiques du jeu pour /jarvis.

   Lit l'export local designe par DONNEES_JEU (le dossier `Content`) et ecrit
   output/jarvis/objets.json, a deposer dans le bucket PRIVE jarvis-prive de
   Supabase (Storage). Ce fichier n'entre jamais dans le depot : .gitignore
   l'en empeche.

   La logique vit dans objets-jarvis.js, testee en CI sans l'export.

     $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
     node outils/fabrication/extraire-objets.js
*/

const fs = require("node:fs");
const path = require("node:path");
const { construireCatalogueObjets } = require("./objets-jarvis.js");

const CONTENU = process.env.DONNEES_JEU || "";
const RACINE = path.resolve(__dirname, "..", "..");
const SORTIE = path.join(RACINE, "output", "jarvis", "objets.json");

function lignesDeTable(relatif) {
  const fichier = path.join(CONTENU, "Table", relatif);
  const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const lignes = Array.isArray(brut) && brut[0] && brut[0].Rows;
  if(!lignes || !Object.keys(lignes).length){
    throw new Error("Table vide ou illisible : " + relatif);
  }
  return lignes;
}

/* Les lignes d'apparition des PNJ et des points de minage : leur region
   principale et leur sous-region, et, pour placer celles qui n'en ont pas,
   leur position, leur zone et le chapitre de leur table. Les tables vivent
   sous Table/Scene/Zone/<zone>/, a plusieurs niveaux selon la zone. */
function apparitionsDes(pnj, minage) {
  const sortie = { pnj:[], minage:[] };
  const racine = path.join(CONTENU, "Table", "Scene", "Zone");
  (function parcourir(dossier) {
    fs.readdirSync(dossier, { withFileTypes:true }).forEach(entree => {
      const chemin = path.join(dossier, entree.name);
      if(entree.isDirectory()){
        parcourir(chemin);
        return;
      }
      if(!/_spawntable\.json$/i.test(entree.name)) return;
      const brut = JSON.parse(fs.readFileSync(chemin, "utf8"));
      const lignes = (Array.isArray(brut) && brut[0] && brut[0].Rows) || {};
      const zone = path.relative(racine, chemin).split(path.sep)[0];
      const chapitre = /^Chapter_0*(\d+)/i.exec(entree.name);
      Object.values(lignes).forEach(ligne => {
        const acteur = ligne && String(ligne.ActorID);
        const famille = !ligne ? null
          : Object.prototype.hasOwnProperty.call(pnj, acteur) ? "pnj"
          : Object.prototype.hasOwnProperty.call(minage, acteur) ? "minage" : null;
        if(!famille) return;
        const apparition = { acteur, secteur:ligne.TagMainSector, sousSecteur:ligne.TagSubSector };
        const position = ligne.position_xyz;
        if(position && Number.isFinite(position.X) && Number.isFinite(position.Y) && chapitre){
          Object.assign(apparition, { position:{ X:position.X, Y:position.Y }, zone, chapitre:Number(chapitre[1]) });
        }
        sortie[famille].push(apparition);
      });
    });
  })(racine);
  return sortie;
}

/* Les contours des secteurs principaux (AreaPoint) des seules zones ou une
   apparition attend d'etre placee. Deux tables de secteurs de zones
   instanciees sont vides dans l'export du 25/09/2026 : on ne les lit pas. */
function contoursDesSecteurs(apparitions) {
  const zones = new Set(apparitions.filter(apparition => apparition.zone).map(apparition => apparition.zone));
  return [...zones].flatMap(zone => {
    const fichier = path.join(CONTENU, "Table", "Scene", "Sector", zone + "_sectortable.json");
    if(!fs.existsSync(fichier)) return [];
    const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
    const lignes = (Array.isArray(brut) && brut[0] && brut[0].Rows) || {};
    return Object.values(lignes)
      .filter(ligne => ligne && ligne.AreaSectorType === "EAreaSectorType::MainSector"
        && Array.isArray(ligne.AreaPoint) && ligne.AreaPoint.length >= 3)
      .map(ligne => ({ zone, cle:ligne.Local_SectorNameMsg,
        points:ligne.AreaPoint.map(point => ({ X:point.X, Y:point.Y })) }));
  });
}

function main() {
  if(!CONTENU){
    console.error("DONNEES_JEU n'est pas défini. Lancer d'abord :\n"
      + "  $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path");
    process.exit(1);
  }
  const tableArticles = path.join(CONTENU, "Table", "Merchant", "MerchantGoods.json");
  const pnj = lignesDeTable("Actor/NPCActorTable.json");
  const minage = lignesDeTable("Actor/MiningObjectTable.json");
  const apparitions = apparitionsDes(pnj, minage);
  const catalogue = construireCatalogueObjets({
    objets:{
      etc:lignesDeTable("Item/ItemTable_Data_Etc.json"),
      equip:lignesDeTable("Item/ItemTable_Data_Equip.json"),
      use:lignesDeTable("Item/ItemTable_Data_Use.json"),
      quest:lignesDeTable("Item/ItemTable_Data_Quest.json"),
      pet:lignesDeTable("Item/ItemTable_Data_Pet.json"),
      dropType:lignesDeTable("Item/ItemTable_Data_DropType.json")
    },
    monnaies:lignesDeTable("Item/CurrencyTable.json"),
    articles:lignesDeTable("Merchant/MerchantGoods.json"),
    magasins:lignesDeTable("PackageStore/PackageStoreTable.json"),
    ongletsMagasin:lignesDeTable("PackageStore/PackageStoreSubTabTable.json"),
    articlesMagasin:lignesDeTable("PackageStore/PackageStoreGoodsTable.json"),
    boutons:lignesDeTable("Interaction/InteractionButtonTable.json"),
    interactions:lignesDeTable("Interaction/InteractionTable.json"),
    pnj,
    apparitions:apparitions.pnj,
    apparitionsMinage:apparitions.minage,
    secteurs:contoursDesSecteurs(apparitions.pnj.concat(apparitions.minage)),
    groupesButin:lignesDeTable("Drop/DropGroupTable.json"),
    paquetsButin:lignesDeTable("Drop/DropPackTable.json"),
    monstres:lignesDeTable("Actor/MonsterActorTable.json"),
    minage,
    donjons:lignesDeTable("Dungeon/DungeonTable.json"),
    groupesDonjon:lignesDeTable("Dungeon/DungeonGroupTable.json"),
    recompensesConfrerie:lignesDeTable("Guild/GuildContentRewardTable.json"),
    /* MakingRecipe n'est pas lue : table perimee (voir objets-jarvis.js). */
    recettesCuisine:lignesDeTable("Making/CookingRecipeTable.json"),
    recettesFabrication:lignesDeTable("Making/ProductionRecipeTable.json"),
    recettesGravure:lignesDeTable("Making/BindingRecipeTable.json"),
    recettesCombinaison:lignesDeTable("Making/CombineRecipeTable.json"),
    categoriesFabrication:lignesDeTable("Making/MakingCategory.json"),
    listeIngredients:lignesDeTable("Making/MakingList.json"),
    textes:JSON.parse(fs.readFileSync(
      path.join(CONTENU, "Localization", "Game", "fr", "Game.json"), "utf8"
    )).client_language_table,
    genereLe:new Date().toISOString(),
    dateExport:fs.statSync(tableArticles).mtime.toISOString().slice(0, 10)
  });
  fs.mkdirSync(path.dirname(SORTIE), { recursive:true });
  const texte = JSON.stringify(catalogue);
  fs.writeFileSync(SORTIE, texte);
  console.log("Écrit " + path.relative(RACINE, SORTIE) + " : " + catalogue.objets.length
    + " objets, " + catalogue.boutiques.length + " boutiques, " + catalogue.butins.length
    + " sources de butin, " + catalogue.recettes.length + " recettes, " + catalogue.articlesEcartes
    + " articles écartés, " + Math.round(Buffer.byteLength(texte) / 1024) + " Ko.");
  console.log("À déposer dans le bucket privé « jarvis-prive » (Supabase → Storage).");
}

main();
