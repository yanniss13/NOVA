"use strict";

/* Extrait les effets du jeu et ses regles pour /jarvis.

   Lit l'export local designe par DONNEES_JEU (le dossier `Content`), plus
   trois fichiers publics du depot (competences du wiki, heros de /jarvis,
   libelles et unites des stats), et ecrit output/jarvis/mecaniques.json, a
   deposer dans le bucket PRIVE jarvis-prive de Supabase (Storage). Ce
   fichier n'entre jamais dans le depot : .gitignore l'en empeche.

   La logique vit dans mecaniques-jarvis.js, testee en CI sans l'export.

     $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
     node outils/fabrication/extraire-mecaniques.js
*/

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { construireCatalogueMecaniques, resumeControleValeurs } = require("./mecaniques-jarvis.js");

const CONTENU = process.env.DONNEES_JEU || "";
const RACINE = path.resolve(__dirname, "..", "..");
const SORTIE = path.join(RACINE, "output", "jarvis", "mecaniques.json");

function lignesDeTable(relatif) {
  const fichier = path.join(CONTENU, "Table", relatif);
  const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const lignes = Array.isArray(brut) && brut[0] && brut[0].Rows;
  if(!lignes || !Object.keys(lignes).length){
    throw new Error("Table vide ou illisible : " + relatif);
  }
  return lignes;
}

function jsonDuDepot(relatif) {
  return JSON.parse(fs.readFileSync(path.join(RACINE, relatif), "utf8"));
}

/* data/wiki-competences.js pose window.SEVEN_DS_WIKI_COMPETENCES. */
function competencesDuWiki() {
  const contexte = { window:{} };
  vm.runInNewContext(fs.readFileSync(path.join(RACINE, "data", "wiki-competences.js"), "utf8"), contexte);
  const competences = contexte.window.SEVEN_DS_WIKI_COMPETENCES;
  if(!competences || !Object.keys(competences).length) throw new Error("wiki-competences.js vide");
  return competences;
}

function main() {
  if(!CONTENU){
    console.error("DONNEES_JEU n'est pas défini. Lancer d'abord :\n"
      + "  $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path");
    process.exit(1);
  }
  const tableBuffs = path.join(CONTENU, "Table", "Buff", "BuffTable.json");
  const catalogue = construireCatalogueMecaniques({
    buffs:lignesDeTable("Buff/BuffTable.json"),
    comportements:lignesDeTable("Skill/PC_SkillBehaviorTable.json"),
    journal:lignesDeTable("TutorialLogGroupTable.json"),
    pagesJournal:lignesDeTable("TutorialLogTable.json"),
    guides:lignesDeTable("GuidePopup/GuidePopupGroupTable.json"),
    pagesGuides:lignesDeTable("GuidePopup/GuidePopupTable.json"),
    textes:JSON.parse(fs.readFileSync(
      path.join(CONTENU, "Localization", "Game", "fr", "Game.json"), "utf8"
    )).client_language_table,
    competences:competencesDuWiki(),
    personnages:jsonDuDepot("data/connaissances-discord.json").personnages,
    libelles:jsonDuDepot("7ds-stats/libelles-stats.json"),
    unites:jsonDuDepot("7ds-stats/stat-metadata.json"),
    genereLe:new Date().toISOString(),
    dateExport:fs.statSync(tableBuffs).mtime.toISOString().slice(0, 10)
  });
  fs.mkdirSync(path.dirname(SORTIE), { recursive:true });
  const texte = JSON.stringify(catalogue);
  fs.writeFileSync(SORTIE, texte);
  const avecPorteur = catalogue.effets.filter(effet =>
    effet.variantes.some(variante => variante.posePar.length)).length;
  console.log("Écrit " + path.relative(RACINE, SORTIE) + " : " + catalogue.effets.length
    + " effets (" + avecPorteur + " posés par un héros), " + catalogue.regles.length
    + " sujets de règles, " + Math.round(Buffer.byteLength(texte) / 1024) + " Ko.");
  console.log(resumeControleValeurs(catalogue));
  console.log("À déposer dans le bucket privé « jarvis-prive » (Supabase → Storage).");
}

main();
