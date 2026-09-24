"use strict";

/* Extrait les monstres et boss du jeu pour /jarvis.

   Lit l'export local designe par DONNEES_JEU (le dossier `Content`) et ecrit
   output/jarvis/monstres.json, a deposer dans le bucket PRIVE jarvis-prive de
   Supabase (Storage). Ce fichier n'entre jamais dans le depot : .gitignore
   l'en empeche.

   La logique vit dans monstres-jarvis.js et effets-monstres-jarvis.js,
   testees en CI sans l'export.

     $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
     node outils/fabrication/extraire-monstres.js
*/

const fs = require("node:fs");
const path = require("node:path");
const { construireCatalogueMonstres } = require("./monstres-jarvis.js");
const { effetsParActeur, rattacherEffets } = require("./effets-monstres-jarvis.js");

const CONTENU = process.env.DONNEES_JEU || "";
const RACINE = path.resolve(__dirname, "..", "..");
const SORTIE = path.join(RACINE, "output", "jarvis", "monstres.json");

function lignesDeTable(relatif) {
  const fichier = path.join(CONTENU, "Table", relatif);
  const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const lignes = Array.isArray(brut) && brut[0] && brut[0].Rows;
  if(!lignes || !Object.keys(lignes).length){
    throw new Error("Table vide ou illisible : " + relatif);
  }
  return lignes;
}

/* Les tables d'apparition vivent sous Table/Scene/Zone/<zone>/, dans un
   dossier « spawn » ou « Spawn » selon la zone. */
function apparitionsDesZones() {
  const racine = path.join(CONTENU, "Table", "Scene", "Zone");
  const sortie = [];
  fs.readdirSync(racine, { withFileTypes:true }).forEach(zone => {
    if(!zone.isDirectory()) return;
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
        sortie.push({
          fichier:entree.name.replace(/\.json$/i, ""),
          zone:zone.name,
          acteurs:[...new Set(Object.values(lignes)
            .map(ligne => String(ligne && ligne.ActorID))
            .filter(id => id && id !== "None" && id !== "undefined"))]
        });
      });
    })(path.join(racine, zone.name));
  });
  return sortie;
}

function main() {
  if(!CONTENU){
    console.error("DONNEES_JEU n'est pas défini. Lancer d'abord :\n"
      + "  $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path");
    process.exit(1);
  }
  const tableMonstres = path.join(CONTENU, "Table", "Actor", "MonsterActorTable.json");
  const monstres = lignesDeTable("Actor/MonsterActorTable.json");
  const textes = JSON.parse(fs.readFileSync(
    path.join(CONTENU, "Localization", "Game", "fr", "Game.json"), "utf8"
  )).client_language_table;
  const catalogue = construireCatalogueMonstres({
    monstres,
    groupes:lignesDeTable("Actor/NpcStatGroupTable.json"),
    paliersBoss:lignesDeTable("Dungeon/BossStatGroupTable.json"),
    bossTerrain:lignesDeTable("FieldBoss/FieldBossTable.json"),
    donjons:lignesDeTable("Dungeon/DungeonTable.json"),
    groupesDonjon:lignesDeTable("Dungeon/DungeonGroupTable.json"),
    zones:lignesDeTable("Scene/ZoneTable.json"),
    apparitions:apparitionsDesZones(),
    textes,
    genereLe:new Date().toISOString(),
    dateExport:fs.statSync(tableMonstres).mtime.toISOString().slice(0, 10)
  });
  rattacherEffets(catalogue.monstres, effetsParActeur({
    monstres,
    competences:lignesDeTable("Skill/Mon_SkillTable.json"),
    comportements:lignesDeTable("Skill/Mon_SkillBehaviorTable.json"),
    buffs:lignesDeTable("Buff/BuffTable.json"),
    textes
  }));
  fs.mkdirSync(path.dirname(SORTIE), { recursive:true });
  const texte = JSON.stringify(catalogue);
  fs.writeFileSync(SORTIE, texte);
  const versions = catalogue.monstres.reduce((total, monstre) => total + monstre.versions.length, 0);
  console.log("Écrit " + path.relative(RACINE, SORTIE) + " : " + catalogue.monstres.length
    + " monstres, " + versions + " versions, "
    + catalogue.monstres.filter(monstre => monstre.effets).length + " avec effets, " + Math.round(Buffer.byteLength(texte) / 1024) + " Ko.");
  console.log("À déposer dans le bucket privé « jarvis-prive » (Supabase → Storage).");
}

main();
