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

/* Les lignes d'apparition des seuls PNJ : leur region principale et leur
   sous-region. Les tables vivent sous Table/Scene/Zone/<zone>/, a plusieurs
   niveaux selon la zone. */
function apparitionsDesPnj(pnj) {
  const sortie = [];
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
      Object.values(lignes).forEach(ligne => {
        if(!ligne || !Object.prototype.hasOwnProperty.call(pnj, String(ligne.ActorID))) return;
        sortie.push({ acteur:String(ligne.ActorID), secteur:ligne.TagMainSector, sousSecteur:ligne.TagSubSector });
      });
    });
  })(path.join(CONTENU, "Table", "Scene", "Zone"));
  return sortie;
}

function main() {
  if(!CONTENU){
    console.error("DONNEES_JEU n'est pas défini. Lancer d'abord :\n"
      + "  $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path");
    process.exit(1);
  }
  const tableArticles = path.join(CONTENU, "Table", "Merchant", "MerchantGoods.json");
  const pnj = lignesDeTable("Actor/NPCActorTable.json");
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
    boutons:lignesDeTable("Interaction/InteractionButtonTable.json"),
    interactions:lignesDeTable("Interaction/InteractionTable.json"),
    pnj,
    apparitions:apparitionsDesPnj(pnj),
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
    + " objets, " + catalogue.boutiques.length + " boutiques, " + catalogue.articlesEcartes
    + " articles écartés, " + Math.round(Buffer.byteLength(texte) / 1024) + " Ko.");
  console.log("À déposer dans le bucket privé « jarvis-prive » (Supabase → Storage).");
}

main();
