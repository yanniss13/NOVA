"use strict";

/* UN SEUL VOCABULAIRE DE COULEUR DANS LE PROJET.

   La bascule sur la charte de la maquette a renomme les jetons partout plutot
   que de les aliaser. Un alias aurait coute une ligne ; il aurait aussi laisse
   deux facons de nommer la meme couleur, et c'est exactement ce qui force une
   refactorisation plus tard.

   Ce test tient la promesse dans le temps. Il refuse :

   - le retour d'un ancien nom de jeton, dans une feuille ou dans le balisage ;
   - un jeton employe mais jamais declare — `var(--typo)` ne casse rien de
     visible, la propriete est simplement ignoree et l'element prend la couleur
     heritee ;
   - un jeton declare que plus personne n'emploie, qui laisserait croire que la
     charte compte une couleur de plus qu'elle n'en a. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const DOSSIER = path.join(RACINE, "css");
const feuilles = fs.readdirSync(DOSSIER).filter(nom => nom.endsWith(".css"));
const sources = new Map(feuilles.map(nom =>
  [nom, fs.readFileSync(path.join(DOSSIER, nom), "utf8")]));
const tout = [...sources.values()].join("\n");
const charte = sources.get("charte.css");

assert.ok(charte, "css/charte.css doit exister : c'est la source des jetons");

/* ---------- 1. Les anciens noms ne reviennent pas ---------- */

const ABANDONNES = [
  "obsidian", "obsidian-2", "panel", "panel-2", "gold-bright",
  "crimson", "crimson-bright", "muted", "muted-2", "ui"
];
ABANDONNES.forEach(ancien => {
  const motif = new RegExp("--" + ancien + "(?![-a-zA-Z0-9])");
  sources.forEach((source, nom) => {
    /* charte.css cite ces noms dans son commentaire d'ouverture, pour dire
       precisement qu'ils ont disparu. */
    if(nom === "charte.css") return;
    assert.ok(!motif.test(source),
      `l'ancien jeton --${ancien} est revenu dans css/${nom}`);
  });
});

/* ---------- 2. Tout jeton employe est declare ---------- */

/* La charte est la seule feuille qui a le droit de DECLARER une couleur.
   Ailleurs, une declaration de jeton est locale a un composant — le liseré du
   calculateur, la hauteur du bandeau PWA — et reste legitime : on ne compte
   donc que ce qui est declare quelque part. */
const declares = new Set(
  [...tout.matchAll(/(?:^|[{;\s])(--[a-zA-Z0-9-]+)\s*:/gm)]
    .map(trouve => trouve[1]));

/* Certains jetons sont poses A L'EXECUTION, en style en ligne : la lueur d'un
   heros prend la couleur de son element, le bandeau de mise a jour publie sa
   hauteur reelle. On lit donc aussi les declarations du JavaScript, plutot que
   d'entretenir une liste d'exceptions qui se perimerait. */
function sourcesJs(dossier){
  return fs.readdirSync(dossier, { withFileTypes:true }).flatMap(entree => {
    const complet = path.join(dossier, entree.name);
    if(entree.isDirectory()) return sourcesJs(complet);
    return entree.name.endsWith(".js") ? [fs.readFileSync(complet, "utf8")] : [];
  });
}
const scripts = sourcesJs(path.join(RACINE, "js"))
  .concat(fs.readFileSync(path.join(RACINE, "index.html"), "utf8"))
  .join("\n");
[...scripts.matchAll(/"(--[a-zA-Z0-9-]+)"|(--[a-zA-Z0-9-]+)\s*:/g)]
  .forEach(trouve => declares.add(trouve[1] || trouve[2]));

const employes = new Set(
  [...tout.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map(trouve => trouve[1]));

const orphelins = [...employes].filter(jeton => !declares.has(jeton)).sort();
assert.deepEqual(orphelins, [],
  "des jetons sont employes sans etre declares : la propriete est ignoree, "
    + "et l'element prend la couleur heritee sans qu'aucun test ne le voie");

/* ---------- 3. La charte ne declare rien d'inutile ---------- */

const declaresParLaCharte = [...charte.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)]
  .map(trouve => trouve[1]);
const inutilises = declaresParLaCharte
  .filter(jeton => !employes.has(jeton))
  .sort();
assert.deepEqual(inutilises, [],
  "la charte declare des jetons que personne n'emploie");

/* ---------- 4. La charte ne fait QUE nommer ---------- */

/* Une regle de mise en page dans charte.css la rendrait dependante de l'ordre
   de chargement, ce qu'un fichier de jetons ne doit jamais etre. */
const reglesHorsRoot = charte
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/:root\s*\{[\s\S]*?\n\}/, "")
  .trim();
assert.equal(reglesHorsRoot, "",
  "charte.css ne doit contenir que le bloc :root : elle nomme, elle ne dessine pas");

console.log("charte.test.js OK ("
  + declaresParLaCharte.length + " jetons, "
  + employes.size + " employes, aucun ancien nom)");
