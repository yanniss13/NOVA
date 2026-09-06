"use strict";

/* Fabrique `data/libelles-discord.json`, le seul catalogue que la commande
   Discord /build a besoin de lire.

   POURQUOI UN FICHIER DE PLUS. L'Edge Function ne peut pas importer les
   modules du site : ils lisent `window` et tirent `data/stats-build.js`
   derriere eux, soit 2,5 Mo a charger a chaque appel. Or /build n'a besoin
   que de deux tables minuscules — l'identite et les trois slots d'arme de
   chaque personnage, le libelle et l'unite de chaque statistique. Extraites,
   elles tiennent en quelques dizaines de kilo-octets, publies sur GitHub Pages comme
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

/* LES BORNES DES ENCHANTEMENTS, dedoublonnees.

   Le jeu remplit une barre selon la position de la valeur tiree entre le
   minimum et le maximum possibles de sa statistique. La carte Discord fait de
   meme, il lui faut donc ces bornes.

   Publiees telles quelles, elles pesent 590 Ko — la combinatoire palier x
   element des perles. Deux constats les ramenent a 17 Ko :

   1. L'element ne change PAS les bornes, seulement la liste des statistiques
      proposees. Verifie sur les 17 141 paires palier|statistique du
      catalogue : zero desaccord. On peut donc aplatir sur « palier|stat ».
   2. Les tables se repetent enormement : quatre suffisent aux 276 grades
      d'arme, dix-huit aux 136 pieces enchantables. On les partage, et chaque
      objet ne garde qu'un index.

   Les bornes d'une piece s'emploient telles quelles ; celles d'une arme se
   mettent a l'echelle du taux de leur emplacement, d'ou `slots`. */
function partagerTables() {
  const tables = [];
  const index = new Map();
  return {
    tables,
    ajouter(valeur) {
      const cle = JSON.stringify(valeur);
      if(!index.has(cle)){
        index.set(cle, tables.length);
        tables.push(valeur);
      }
      return index.get(cle);
    }
  };
}

function bornesDesObjets(stats) {
  const partage = partagerTables();
  const index = {};
  ["gearByFile", "engravedByFile"].forEach(source => {
    const catalogue = stats[source] || {};
    Object.keys(catalogue).sort().forEach(fichier => {
      const options = catalogue[fichier].randomOptions;
      if(!options || !Array.isArray(options.stats)) return;
      const table = {};
      options.stats.forEach(option => {
        table[option.stat] = [option.min, option.max];
      });
      index[fichier] = partage.ajouter(table);
    });
  });
  return { tables:partage.tables, index };
}

function bornesDesArmes(stats) {
  const partage = partagerTables();
  const index = {};
  const catalogue = stats.weaponsByFile || {};
  Object.keys(catalogue).sort().forEach(fichier => {
    const grades = catalogue[fichier].gradesByGameId || {};
    Object.keys(grades).sort().forEach(identifiant => {
      const enchantements = grades[identifiant].enchantements
        || grades[identifiant].enchantments;
      if(!enchantements) return;
      const table = {};
      const poser = (palier, option) => {
        table[palier + "|" + option.stat] = [option.min, option.max];
      };
      /* Le palier zero est celui des armes sans perle (type « basic ») : une
         seule cle, la meme que celle que lit le module partage. */
      if(enchantements.type === "basic"){
        (enchantements.options || []).forEach(option => poser(0, option));
      }else{
        (enchantements.tiers || []).forEach(palier => {
          if(palier.elements){
            palier.elements.forEach(groupe =>
              (groupe.options || []).forEach(option =>
                poser(palier.tier, option)));
          }else{
            (palier.options || []).forEach(option => poser(palier.tier, option));
          }
        });
      }
      index[identifiant] = partage.ajouter({
        slots:enchantements.slots || [],
        stats:table
      });
    });
  });
  return { tables:partage.tables, index };
}

function construireBornes(stats) {
  return {
    objets:bornesDesObjets(stats),
    armes:bornesDesArmes(stats)
  };
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
      element:fiche.element || "DEFAULT",
      /* L'element ET le role changent avec l'arme equipee. Le type d'arme
         reste l'enum stable du jeu ; discord-build.js fait le pont avec le
         nom de dossier enregistre dans le roster. */
      armes:Object.fromEntries((Array.isArray(fiche.weapons)
        ? fiche.weapons : []).filter(slot => slot && slot.weapon).map(slot => [
        slot.weapon,
        {
          element:String(slot.element || "Default").toUpperCase(),
          role:slot.role || ""
        }
      ]))
    };
  });

  const libellesStats = {};
  Object.keys(stats.statLabels || {}).sort().forEach(code => {
    const entree = stats.statLabels[code] || {};
    libellesStats[code] = { fr:entree.fr || code, unit:entree.unit || "flat" };
  });

  /* LES BORNES DE CHAQUE ARME, par grade.
     La carte ecrit « outrepassement 4 sur 6 » et non « outrepassement 4 » :
     un nombre seul n'apprend rien a qui ne connait pas le plafond de l'arme.
     Ces plafonds dependent de l'arme ET de son grade, ils ne se devinent pas.
     Le catalogue complet pese 2,5 Mo et l'Edge Function ne peut pas le
     charger ; cet extrait tient en quelques dizaines de kilo-octets.

     Le plafond de PROMOTION n'y est pas : la carte ne montre plus la
     promotion, qui se deduit du niveau. Publier une donnee que rien ne lit
     serait une source de plus a garder d'accord. */
  const armes = {};
  Object.keys(stats.weaponsByFile || {}).sort().forEach(fichier => {
    const grades = stats.weaponsByFile[fichier].gradesByGameId || {};
    Object.keys(grades).sort().forEach(identifiant => {
      const grade = grades[identifiant];
      const paliers = Array.isArray(grade.promotionSteps)
        ? grade.promotionSteps : [];
      const niveaux = grade.overlimit && Array.isArray(grade.overlimit.levels)
        ? grade.overlimit.levels
          .map(entree => entree && entree.level)
          .filter(niveau => Number.isFinite(niveau))
        : [];
      armes[fichier] = armes[fichier] || {};
      armes[fichier][identifiant] = {
        outrepassementMax:niveaux.length ? Math.max.apply(null, niveaux) : 0,
        /* Le plafond de niveau est celui de la DERNIERE promotion : c'est le
           niveau maximal que l'arme peut atteindre, tous paliers faits. */
        niveauMax:paliers.length
          ? Number(paliers[paliers.length - 1].reinforceMax) || 0
          : 0
      };
    });
  });

  return {
    /* Ni date ni horodatage : ce fichier est compare a l'octet pres par
       `--verifier`, et une date le rendrait perime a chaque execution. */
    version:1,
    personnages,
    armes,
    bornes:construireBornes(stats),
    stats:libellesStats
  };
}

function texteDeSortie() {
  return JSON.stringify(construireLibelles(), null, 1) + "\n";
}

/* Le controle de fraicheur ignore les fins de ligne. Le depot est en CRLF
   dans une copie de travail Windows et en LF sur le runner Linux : comparer
   le texte brut declarait le fichier perime d'un cote et a jour de l'autre,
   pour un contenu strictement identique. */
function estAJour(texteActuel) {
  const sansFins = texte => String(texte || "").replace(/\r\n/g, "\n");
  return sansFins(texteActuel) === sansFins(texteDeSortie());
}

function principal() {
  const attendu = texteDeSortie();
  if(process.argv.includes("--verifier")){
    const actuel = fs.existsSync(SORTIE)
      ? fs.readFileSync(SORTIE, "utf8") : "";
    if(!estAJour(actuel)){
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

module.exports = { construireLibelles, texteDeSortie, estAJour };
