"use strict";

/* CHAQUE IMPORT NOMME EXISTE-T-IL VRAIMENT DANS LE MODULE VISE ?

   Le chargeur des autres tests concatene tous les modules dans UNE portee : un
   nom y est visible qu'il soit exporte ou non. Les tests unitaires passent donc
   sur un import casse, et seul le navigateur s'en apercoit — en refusant de
   charger l'application entiere, pas seulement la vue fautive.

   C'est arrive : `stats-heros.js` importait `reconstructStatTotals` de
   `stats-calcul.js`, qui ne l'exportait pas. 83 tests unitaires au vert, neuf
   parcours Playwright rouges, et l'erreur a trente secondes de timeout de la
   cause.

   Ce test lit le TEXTE des modules plutot que de les executer : c'est ce qui
   lui permet de voir la surface d'export, que l'execution efface. */

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const { MODULES } = require("./helpers/modules");

/* Les noms qu'un module rend publics : son bloc `export { … }` final, plus les
   `export function` / `export const` poses en ligne. Les commentaires sont
   retires d'abord, sans quoi un nom cite dans une explication passerait pour
   un export. */
function exportsDe(source){
  const net = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const noms = new Set();
  const bloc = /export\s*\{([^}]*)\}/g;
  let trouve = bloc.exec(net);
  while(trouve){
    trouve[1].split(",").forEach(brut => {
      const nom = brut.trim().split(/\s+as\s+/).pop().trim();
      if(nom) noms.add(nom);
    });
    trouve = bloc.exec(net);
  }
  const enLigne = /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g;
  trouve = enLigne.exec(net);
  while(trouve){
    noms.add(trouve[1]);
    trouve = enLigne.exec(net);
  }
  return noms;
}

/* Les imports NOMMES d'un module, avec le chemin vise. Les imports par defaut
   et les `import "…"` sans nom ne sont pas concernes : rien a verifier. */
function importsDe(source){
  const net = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  const motif = /import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g;
  const liste = [];
  let trouve = motif.exec(net);
  while(trouve){
    const cible = trouve[2];
    trouve[1].split(",").forEach(brut => {
      const nom = brut.trim().split(/\s+as\s+/)[0].trim();
      if(nom) liste.push({ nom, cible });
    });
    trouve = motif.exec(net);
  }
  return liste;
}

const cache = new Map();
function exportsDuFichier(chemin){
  if(!cache.has(chemin)){
    cache.set(chemin, exportsDe(fs.readFileSync(chemin, "utf8")));
  }
  return cache.get(chemin);
}

let verifies = 0;
MODULES.forEach(nom => {
  const chemin = path.join(RACINE, "js", nom);
  const source = fs.readFileSync(chemin, "utf8");
  importsDe(source).forEach(({ nom:importe, cible }) => {
    /* Seuls les modules du depot sont verifiables : une dependance externe n'a
       pas de fichier a lire ici. */
    if(!cible.startsWith(".")) return;
    const vise = path.resolve(path.dirname(chemin), cible);
    assert.ok(fs.existsSync(vise),
      nom + " importe depuis " + cible + ", qui n'existe pas");
    assert.ok(exportsDuFichier(vise).has(importe),
      nom + " importe { " + importe + " } de " + cible
        + ", qui ne l'exporte pas");
    verifies += 1;
  });
});

assert.ok(verifies > 100,
  "trop peu d'imports verifies (" + verifies + ") — le lecteur ne lit plus rien");

console.log("imports-resolus.test.js OK (" + verifies + " imports nommés)");
