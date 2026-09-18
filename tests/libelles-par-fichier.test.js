"use strict";

/* UN SEUL VOCABULAIRE POUR NOMMER UNE PIECE : `nameOfFile`.

   Le chemin d'une image identifie un FICHIER, pas un objet a nommer. Quand
   deux heros portent une tenue de meme nom, le fichier de l'un prend le nom
   de son heros en prefixe — « Khala — Citoyenne modele.webp » — pour ne pas
   ecraser l'autre. Le generateur retire ce prefixe du LIBELLE ; tout code
   qui refabriquait un nom a partir du chemin le remettait donc a l'ecran.

   Khala a ete le premier heros a en porter : cinq endroits du site
   rebatissaient ainsi un libelle, dont l'import de captures, qui l'affichait
   au membre et s'en servait pour lever l'ambiguite entre deux tenues.

   Ce test tient les trois bouts : le catalogue nomme bien ses tenues, le
   rapprochement par le nom lu les retrouve, et plus aucun module ne rebatit
   un libelle depuis un chemin. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadApp, plain } = require("./helpers/load-app");

const RACINE = path.resolve(__dirname, "..");
const { hooks } = loadApp();
const { nameOfFile, restreindreParLeNom } = hooks;
assert.equal(typeof nameOfFile, "function",
  "nameOfFile doit etre expose par js/metier/catalogue.js");
assert.equal(typeof restreindreParLeNom, "function",
  "restreindreParLeNom doit etre expose par js/metier/ocr-deduction.js");

/* Les tenues liees de Khala, et leur libelle, lus dans les fichiers GENERES :
   rien n'est recopie ici. */
function lireGenere(fichier, globale){
  const bac = { window:{} };
  require("node:vm").runInNewContext(
    fs.readFileSync(path.join(RACINE, "data", fichier), "utf8"), bac);
  return bac.window[globale];
}
const DATA = lireGenere("data.js", "SEVEN_DS_DATA");
const LIEES = lireGenere("armures-liees.js", "SEVEN_DS_ARMURES_LIEES");
const libelleDuCatalogue = new Map(
  (DATA.armures["Armure liee"] || []).map(piece => [piece.file, piece.name]));
const tenuesKhala = LIEES.khala || [];
assert.equal(tenuesKhala.length, 3, "Khala porte trois tenues liees");

/* 1. Le catalogue nomme la tenue sans le prefixe du fichier. */
for(const fichier of tenuesKhala){
  const attendu = libelleDuCatalogue.get(fichier);
  assert.ok(attendu, fichier + " doit avoir un libelle au catalogue");
  assert.ok(!attendu.startsWith("Khala"),
    "le generateur doit avoir retire le prefixe : " + attendu);
  assert.equal(nameOfFile(fichier), attendu,
    "nameOfFile doit rendre le libelle du catalogue, pas le nom de fichier");
}

/* 2. LE NOM LU TRANCHE AUSSI CHEZ KHALA.

   « Preparation totale » et « Tenue de travail ultralegere » partagent leur
   statistique principale et leur secondaire : une capture dont la secondaire
   est mal lue les laisse candidates toutes les deux, et c'est le titre du
   panneau qui doit trancher. Le jeu y ecrit « Preparation totale », jamais
   « Khala — Preparation totale » : compare au nom de FICHIER, le titre ne
   pouvait correspondre a aucune de ses tenues, et le membre devait choisir
   a la main a chaque import. */
const candidats = tenuesKhala.map(fichier => ({ fichier, level:111, reinforce:0 }));
for(const fichier of tenuesKhala){
  const titre = libelleDuCatalogue.get(fichier);
  const retenus = plain(restreindreParLeNom(candidats, titre));
  assert.deepEqual(retenus.map(item => item.fichier), [fichier],
    "le titre « " + titre + " » doit designer sa seule tenue");
}
/* Et le garde-fou d'origine tient : un titre inconnu ne restreint rien. */
assert.equal(plain(restreindreParLeNom(candidats, "Tenue inconnue")).length,
  candidats.length, "un titre sans correspondance exacte ne doit rien trancher");

/* 3. PLUS AUCUN LIBELLE REBATI DEPUIS UN CHEMIN.

   Le motif est toujours le meme : garder la feuille du chemin, oter
   l'extension `.webp`. `metier/catalogue.js` est le seul endroit qui y a
   droit — c'est le repli de `nameOfFile` pour une piece absente du
   catalogue. Ailleurs, il faut appeler `nameOfFile`. */
function fichiersJs(dossier){
  return fs.readdirSync(dossier, { withFileTypes:true }).flatMap(entree => {
    const complet = path.join(dossier, entree.name);
    if(entree.isDirectory()) return fichiersJs(complet);
    return entree.name.endsWith(".js") ? [complet] : [];
  });
}
const AUTORISE = path.join(RACINE, "js", "metier", "catalogue.js");
const coupables = fichiersJs(path.join(RACINE, "js"))
  .filter(fichier => fichier !== AUTORISE)
  .filter(fichier => /replace\(\s*\/\\\.webp\$?\/i?\s*,/
    .test(fs.readFileSync(fichier, "utf8")))
  .map(fichier => path.relative(RACINE, fichier).split(path.sep).join("/"));
assert.deepEqual(coupables, [],
  "ces modules rebatissent encore un libelle depuis un chemin d'image : "
    + coupables.join(", "));

console.log("libelles-par-fichier.test.js OK (" + tenuesKhala.length
  + " tenues de Khala, aucun libelle tire d'un chemin)");
