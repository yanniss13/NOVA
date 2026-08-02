"use strict";

/* Les feuilles de style : toutes liées, dans le bon ordre, toutes en cache.

   En CSS la cascade dépend de l'ordre de chargement. Découper une feuille en
   dix fichiers crée donc un risque que le fichier unique n'avait pas : une
   balise ajoutée au mauvais endroit change silencieusement quelle règle
   gagne, et aucun test de comportement ne le voit forcément.

   Ce contrôle est le pendant de `tests/modules-imports.test.js` pour le CSS.
   Il refuse :

   - une feuille de `css/` qui n'est liée nulle part ;
   - une balise `<link>` qui désigne un fichier absent ;
   - un ordre de chargement différent de celui déclaré ici ;
   - une feuille absente de `CORE_ASSETS` — sinon le mode hors ligne s'affiche
     sans style, **sans aucun test rouge visible**. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");

/* Ordre de chargement, source unique de vérité.

   `responsive` surcharge tout ce qui précède : il doit rester après. `dispos`
   porte ses propres `@media` et doit gagner sur `responsive` : il reste
   dernier. C'était déjà l'ordre du `<style>` d'origine. */
const FEUILLES = [
  "base",
  "builder",
  "roster",
  "analyse",
  "boss",
  "suivi",
  "modales",
  "notifications",
  "responsive",
  "dispos"
];

const html = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
const lies = [...html.matchAll(/<link[^>]*href="\.\/css\/([^"]+)\.css"/g)]
  .map(m => m[1]);

assert.deepEqual(lies, FEUILLES,
  "L'ordre des <link> d'index.html ne correspond pas à FEUILLES.\n"
  + "  index.html : " + lies.join(", ") + "\n"
  + "  attendu    : " + FEUILLES.join(", "));

const surDisque = fs.readdirSync(path.join(RACINE, "css"))
  .filter(nom => nom.endsWith(".css"))
  .map(nom => nom.slice(0, -4))
  .sort();

assert.deepEqual(surDisque, [...FEUILLES].sort(),
  "css/ et FEUILLES divergent : une feuille a été ajoutée ou renommée sans "
  + "être déclarée.\n  sur disque : " + surDisque.join(", "));

/* Une feuille coupée AU MILIEU d'une règle passerait tout ce qui précède, et
   la concaténation des dix fichiers resterait pourtant identique à l'octet
   près — c'est ce qui rend la faute invisible. Le navigateur, lui, parse
   chaque feuille séparément : une accolade orpheline y perd la règle.

   Cette erreur a été commise pour de vrai en découpant le `<style>` : les
   bornes avaient été relevées sur le fichier AVEC son en-tête puis appliquées
   au corps SANS en-tête, soit douze lignes de décalage. Quatre feuilles sur
   dix étaient tranchées en plein milieu d'une règle, et seul un test
   Playwright de mesure tactile l'a signalé — par hasard. */
for(const nom of FEUILLES){
  const chemin = path.join(RACINE, "css", nom + ".css");
  const source = fs.readFileSync(chemin, "utf8");
  assert.ok(source.includes("{"),
    "css/" + nom + ".css ne contient aucune règle");

  const sansCommentaires = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const ouvrantes = (sansCommentaires.match(/\{/g) || []).length;
  const fermantes = (sansCommentaires.match(/\}/g) || []).length;
  assert.equal(ouvrantes, fermantes,
    "css/" + nom + ".css a " + ouvrantes + " accolades ouvrantes pour "
    + fermantes + " fermantes : elle est coupée au milieu d'une règle");
  assert.ok(!sansCommentaires.includes("/*") && !sansCommentaires.includes("*/"),
    "css/" + nom + ".css est coupée au milieu d'un commentaire");
}

const sw = fs.readFileSync(path.join(RACINE, "sw.js"), "utf8");
for(const nom of FEUILLES){
  assert.ok(sw.includes('"./css/' + nom + '.css"'),
    "css/" + nom + ".css manque à CORE_ASSETS de sw.js : "
    + "le site s'afficherait sans style hors ligne");
}

/* Le balisage ne doit plus porter de style : c'est ce qui rendait index.html
   illisible, et un `<style>` réintroduit échapperait à tout ce qui précède. */
assert.ok(!/<style[\s>]/i.test(html),
  "index.html porte à nouveau un bloc <style> : le style vit dans css/");
assert.ok(!/\sstyle="/i.test(html),
  "index.html porte un attribut style= en ligne : le style vit dans css/");

console.log("PASS css : feuilles liées dans l'ordre, présentes et mises en cache");
