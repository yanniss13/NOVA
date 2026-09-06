"use strict";

/* Fabrique `data/libelles-discord.json`, le seul catalogue que la commande
   Discord /build a besoin de lire.

   POURQUOI UN FICHIER DE PLUS. L'Edge Function ne peut pas importer les
   modules du site : ils lisent `window` et tirent `data/stats-build.js`
   derriere eux, soit 2,5 Mo a charger a chaque appel. Or /build n'a besoin
   que de deux tables minuscules — le nom et l'element de chaque personnage,
   le libelle et l'unite de chaque statistique. Extraites, elles tiennent en
   une dizaine de kilo-octets, publies sur GitHub Pages comme
   `data/chronometrage-avancement.json` l'est deja pour /chrono.

   Le nom d'un objet, lui, n'est PAS dans ce fichier : le nom lisible d'une
   arme ou d'une piece est exactement le nom de fichier de son image, et les
   348 entrees du catalogue le verifient. Le dupliquer ici ne ferait
   qu'ajouter une source a garder d'accord.

   Usage :
     node scripts/generer-libelles-discord.js              (re)ecrit le fichier
     node scripts/generer-libelles-discord.js --verifier   echoue s'il est perime
*/

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RACINE = path.resolve(__dirname, "..");
const SORTIE = path.join(RACINE, "data", "libelles-discord.json");

/* Les trois fichiers de `data/` sont des scripts de navigateur : ils posent
   leur catalogue sur `window`. On les evalue dans un bac a sable plutot que
   d'en analyser le texte — c'est le meme contenu que celui que le site lit. */
function lireCatalogue(fichier, propriete) {
  const source = fs.readFileSync(path.join(RACINE, "data", fichier), "utf8");
  const bac = { window:{} };
  vm.createContext(bac);
  vm.runInContext(source, bac, { filename:fichier });
  const catalogue = bac.window[propriete];
  if(!catalogue || typeof catalogue !== "object"){
    throw new Error(fichier + " ne pose pas window." + propriete);
  }
  return catalogue;
}

function construireLibelles() {
  const data = lireCatalogue("data.js", "SEVEN_DS_DATA");
  const meta = lireCatalogue("personnages-meta.js", "SEVEN_DS_META");
  const stats = lireCatalogue("stats-build.js", "SEVEN_DS_BUILD_STATS");

  const personnages = {};
  (data.personnages || []).forEach(personnage => {
    if(!personnage || !personnage.id) return;
    const fiche = meta[personnage.id] || {};
    personnages[personnage.id] = {
      nom:personnage.name || personnage.id,
      /* Le portrait : la carte Discord l affiche, et le chemin vient du
         catalogue plutot que d une convention devinee dans le rendu. */
      fichier:personnage.file || "",
      /* `DEFAULT` est l'element des personnages sans element : il est ecrit
         tel quel, c'est le module partage qui le traduit en « Physique ». */
      element:fiche.element || "DEFAULT"
    };
  });

  const libellesStats = {};
  Object.keys(stats.statLabels || {}).sort().forEach(code => {
    const entree = stats.statLabels[code] || {};
    libellesStats[code] = { fr:entree.fr || code, unit:entree.unit || "flat" };
  });

  return {
    /* Ni date ni horodatage : ce fichier est compare a l'octet pres par
       `--verifier`, et une date le rendrait perime a chaque execution. */
    version:1,
    personnages,
    stats:libellesStats
  };
}

function texteDeSortie() {
  return JSON.stringify(construireLibelles(), null, 1) + "\n";
}

function principal() {
  const attendu = texteDeSortie();
  if(process.argv.includes("--verifier")){
    const actuel = fs.existsSync(SORTIE)
      ? fs.readFileSync(SORTIE, "utf8") : "";
    if(actuel !== attendu){
      console.error(
        "data/libelles-discord.json est perime : relance"
        + " `node scripts/generer-libelles-discord.js`."
      );
      process.exitCode = 1;
      return;
    }
    console.log("data/libelles-discord.json est a jour.");
    return;
  }
  fs.writeFileSync(SORTIE, attendu);
  const libelles = JSON.parse(attendu);
  console.log(
    "data/libelles-discord.json ecrit : "
    + Object.keys(libelles.personnages).length + " personnages, "
    + Object.keys(libelles.stats).length + " statistiques."
  );
}

if(require.main === module) principal();

module.exports = { construireLibelles, texteDeSortie };
