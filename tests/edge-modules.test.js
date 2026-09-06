"use strict";

/* LE PIEGE DE DEPLOIEMENT DES EDGE FUNCTIONS, éprouvé ici plutôt qu'en
   production.

   Les modules partagés sont du JavaScript universel : entre eux ils se
   chargent par `require` côté Node, et se lisent sur `globalThis` côté Deno.
   La CLI Supabase, elle, construit la liste des fichiers à téléverser en
   suivant les `import` de `index.ts` — jamais les `require`. Un module qui
   n'apparaît qu'en `require` n'est donc PAS déployé, et la fonction tombe à
   son premier appel, en production, sans que rien n'ait échoué avant.

   Node ne peut pas voir ce défaut : chez lui, `require` suffit. C'est pour
   cela que ce test lit le graphe des dépendances au lieu de charger le code.

   Il a été écrit le jour où `carte-font.js` — l'atlas accentué de toutes les
   cartes — s'est révélé absent de la liste depuis sa création. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PARTAGE = path.join(ROOT, "supabase", "functions", "_shared");
const INDEX = path.join(
  ROOT, "supabase", "functions", "discord-planning", "index.ts"
);

const source = fs.readFileSync(INDEX, "utf8");
/* L'ordre de la liste est celui du chargement : il compte autant que la
   présence, un module lu trop tôt ne trouvant qu'un `undefined`. */
const importes = [...source.matchAll(/await import\("\.\.\/_shared\/([^"]+)"\)/g)]
  .map(trouve => trouve[1]);

assert.ok(importes.length >= 9,
  "index.ts doit importer les modules partagés un par un : "
  + importes.length + " trouvés");
assert.equal(new Set(importes).size, importes.length,
  "un module importé deux fois signale une fusion mal résolue");

function requires(contenu) {
  return [...contenu.matchAll(/require\("\.\/([^"]+)"\)/g)]
    .map(trouve => trouve[1]);
}

/* Tout ce qu'un module peut demander, tôt ou tard : c'est cette liste-là qui
   doit être déployée en entier. */
function dependances(fichier) {
  return requires(fs.readFileSync(path.join(PARTAGE, fichier), "utf8"));
}

/* Ce qu'il demande AU CHARGEMENT, et qui lui impose donc un ordre. Le dépôt
   place ces `require` en tête de fichier, avant la première fonction ; ceux
   qui vivent DANS une fonction sont volontairement paresseux — voir
   `buildCommandDefinitionOrNull`, écrit précisément pour que l'ordre des
   imports n'ait pas d'importance. */
function dependancesAuChargement(fichier) {
  const contenu = fs.readFileSync(path.join(PARTAGE, fichier), "utf8");
  const premiereFonction = contenu.indexOf("\nfunction ");
  return requires(premiereFonction === -1
    ? contenu : contenu.slice(0, premiereFonction));
}

/* 1. TOUT CE QUI EST REQUIS EST IMPORTE. On part des modules cités par
   `index.ts` et on suit leurs `require` : chaque fichier atteint doit figurer
   dans la liste, sinon il manquera au téléversement. */
const aVisiter = [...importes];
const vus = new Set();
while(aVisiter.length){
  const fichier = aVisiter.shift();
  if(vus.has(fichier)) continue;
  vus.add(fichier);
  dependances(fichier).forEach(dependance => {
    assert.ok(importes.includes(dependance),
      "« " + dependance + " » est requis par « " + fichier + " » mais absent "
      + "des `await import` de index.ts : il ne sera pas déployé, et la "
      + "fonction tombera à son premier appel");
    aVisiter.push(dependance);
  });
}

/* 2. CHACUN ARRIVE APRES CE DONT IL SE SERT. Côté Deno il n'y a pas de
   `require` : un module lit les API de ses dépendances sur `globalThis` au
   moment où il est évalué. Chargé avant elles, il n'y trouve rien. */
importes.forEach((fichier, rang) => {
  dependancesAuChargement(fichier).forEach(dependance => {
    assert.ok(importes.indexOf(dependance) < rang,
      "« " + fichier + " » est chargé avant « " + dependance + " », dont il "
      + "lit les API : côté Deno il n'y trouvera qu'un `undefined`");
  });
});

/* 3. RIEN N'EST OUBLIE DANS LE DOSSIER. Un module partagé qui n'est utilisé
   par personne est soit mort, soit oublié — les deux méritent d'être vus. */
const surDisque = fs.readdirSync(PARTAGE).filter(nom => nom.endsWith(".js"));
const inutilises = surDisque.filter(nom => !importes.includes(nom));
assert.deepEqual(inutilises, [],
  "modules présents dans _shared mais jamais importés par index.ts : "
  + inutilises.join(", "));

console.log("OK edge-modules (" + importes.length + " modules partagés, "
  + "dans l'ordre de leurs dépendances)");
