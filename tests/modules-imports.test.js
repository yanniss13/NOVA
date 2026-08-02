"use strict";

/* Chaque module de `js/` doit importer ce qu'il emploie.

   Ce test existe à cause d'un échec réel du lot 5 : `js/picker.js` appelait
   `ModalStack.open()` sans importer `ModalStack`. Le navigateur levait un
   `ReferenceError` à l'ouverture de la modale, mais les tests unitaires
   restaient verts — le chargeur `vm` concatène tous les modules dans une
   portée commune, où le symbole manquant est visible. Le `vm` ne peut donc
   structurellement pas attraper un `import` oublié : il faut ce contrôle-ci.

   Le piège est d'autant plus vicieux qu'un relevé de dépendances mené contre
   `js/app.js` seul ne voit rien : `ModalStack` en était déjà sorti au lot 3.
   On compare donc chaque module à TOUS les autres. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { MODULES } = require("./helpers/modules");

const RACINE = path.join(__dirname, "..", "js");

/* Commentaires et chaînes produiraient de fausses alertes : une mention de
   `ModalStack` dans un commentaire n'est pas un emploi.
   Les gabarits gardent leurs interpolations — `${norm(x)}` est un emploi bien
   réel — mais perdent leur texte. Les chaînes sont vidées sans disparaître,
   pour que les spécificateurs de module restent reconnaissables.
   Les littéraux d'expression régulière partent aussi : le `$` de `/^[01]{168}$/`
   n'est pas l'utilitaire `$`. On ne les reconnaît qu'après un caractère qui ne
   peut pas terminer une expression, sans quoi une division serait avalée. */
function codeSeul(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(
      /(^|[=(,:[!&|?{};+\-*%~^]|\breturn|\btypeof)(\s*)\/(?![*/])(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+\/[gimsuyd]*/g,
      (tout, avant, espace) => avant + espace + " ")
    .replace(/`(?:[^`\\]|\\.)*`/g, gabarit =>
      " " + [...gabarit.matchAll(/\$\{([^{}]*)\}/g)].map(m => m[1]).join(" ") + " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

function exportsDe(source){
  const noms = new Set();
  /* Forme groupée : export { a, b as c }; */
  for(const bloc of source.matchAll(/export\s*\{([^}]*)\}\s*;/g)){
    for(const brut of bloc[1].split(",")){
      const morceau = brut.trim();
      if(!morceau) continue;
      const alias = morceau.split(/\s+as\s+/);
      noms.add((alias[1] || alias[0]).trim());
    }
  }
  /* Forme directe : export const x = …, export function f(){} */
  for(const direct of source.matchAll(
        /export\s+(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)){
    noms.add(direct[1]);
  }
  return noms;
}

function importsDe(source){
  const noms = new Set();
  for(const bloc of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*["']/g)){
    for(const brut of bloc[1].split(",")){
      const morceau = brut.trim();
      if(!morceau) continue;
      const alias = morceau.split(/\s+as\s+/);
      noms.add((alias[1] || alias[0]).trim());
    }
  }
  return noms;
}

/* Une déclaration locale du même nom n'est pas une dépendance manquante. */
function declarationsDe(source){
  const noms = new Set();
  for(const decl of source.matchAll(
        /(?:^|[;{}\n])\s*(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/g)){
    noms.add(decl[1]);
  }
  return noms;
}

/* Les paramètres de fonction sont des noms connus du module : sans eux, un
   paramètre nommé comme une constante d'un autre module passerait pour un
   emprunt. */
function parametresDe(source){
  const noms = new Set();
  for(const m of source.matchAll(/\(([^()]*)\)\s*(?:=>|\{)/g)){
    for(const brut of m[1].split(",")){
      const p = /([A-Za-z_$][\w$]*)/.exec(brut.replace(/[{}[\]]/g, " "));
      if(p) noms.add(p[1]);
    }
  }
  for(const m of source.matchAll(/(?:^|[(,=\s])([A-Za-z_$][\w$]*)\s*=>/gm)) noms.add(m[1]);
  return noms;
}

function emploie(source, nom){
  /* `$` demande une précaution : dans un gabarit, `${` n'est pas un emploi de
     l'utilitaire `$` mais une interpolation. */
  const suite = nom === "$" ? "(?![\\w${])" : "(?![\\w$])";
  /* Le point qui précède doit être écarté quand il est un accès de propriété
     (`objet.nom`), mais PAS quand il fait partie d'un spread (`...nom`) — qui
     est un emploi bien réel. D'où « pas un point qui ne soit lui-même précédé
     d'un point ». Une version naïve `(?<![\w$.])` a laissé passer une vraie
     régression : `[...HERO_STAT_COVERAGE]` n'était vu par aucun contrôle. */
  return new RegExp("(?<![\\w$])(?<!(?<!\\.)\\.)"
    + nom.replace(/\$/g, "\\$") + suite).test(source);
}

const sources = new Map();
for(const fichier of MODULES){
  const chemin = path.join(RACINE, fichier);
  assert.ok(fs.existsSync(chemin),
    "MODULES cite " + fichier + ", qui n'existe pas dans js/");
  sources.set(fichier, codeSeul(fs.readFileSync(chemin, "utf8")));
}

/* Tout fichier de js/ doit être déclaré : un module oublié dans MODULES
   échappe au chargeur `vm` comme au lecteur de source. */
for(const fichier of fs.readdirSync(RACINE).filter(f => f.endsWith(".js"))){
  assert.ok(MODULES.includes(fichier),
    "js/" + fichier + " n'est pas déclaré dans tests/helpers/modules.js");
}

const exportes = new Map();
for(const [fichier, source] of sources) exportes.set(fichier, exportsDe(source));

/* Déclarations de PREMIER niveau d'un module : deux espaces d'indentation,
   héritage de l'IIFE d'origine. Ce sont les seules qui peuvent être exportées. */
function declarationsTopNiveau(source){
  const noms = new Set();
  for(const ligne of source.split("\n")){
    const m = /^ {2}(?:async )?(?:const|let|var|function\*?|class) +([A-Za-z_$][\w$]*)/.exec(ligne);
    if(m) noms.add(m[1]);
  }
  return noms;
}

const topNiveau = new Map();
for(const [fichier, source] of sources) topNiveau.set(fichier, declarationsTopNiveau(source));

/* Un module ne voit d'un autre QUE ce que celui-ci exporte et qu'il importe.
   Trois fautes possibles, toutes silencieuses pour le chargeur `vm` — qui
   concatène tout dans une portée commune — et donc invisibles aux tests
   unitaires. Seul le navigateur les révèle, souvent loin de leur cause :

   1. le symbole est exporté mais non importé ;
   2. le symbole est déclaré ailleurs mais **pas exporté** ;
   3. le symbole est resté dans js/app.js, dont rien ne sort.

   Les trois ont déjà mordu : `ModalStack` (1), `ARMOR_LEVEL_ORIGIN_MODE` (2),
   `HERO_STAT_COVERAGE` (3). */
const manques = [];
for(const [fichier, source] of sources){
  const importes = importsDe(source);
  const locaux = declarationsDe(source);
  const siens = exportes.get(fichier);
  const parametres = parametresDe(source);
  /* Une clé d'objet (`pseudo:`) n'est pas un emprunt de symbole. */
  const corps = source.replace(/([A-Za-z_$][\w$]*)\s*:/g, " ");

  for(const [autre, declares] of topNiveau){
    if(autre === fichier) continue;
    for(const nom of declares){
      if(importes.has(nom) || locaux.has(nom) || siens.has(nom)
         || parametres.has(nom)) continue;
      if(!emploie(corps, nom)) continue;
      if(autre === "app.js"){
        manques.push("js/" + fichier + " emploie « " + nom
          + " », resté dans js/app.js dont rien n'est exporté");
      }else if(!exportes.get(autre).has(nom)){
        manques.push("js/" + fichier + " emploie « " + nom
          + " », que ./" + autre + " déclare mais n'exporte PAS");
      }else{
        manques.push("js/" + fichier + " emploie « " + nom
          + " » sans l'importer de ./" + autre);
      }
    }
  }
}

assert.deepEqual(manques, [],
  "Des modules emploient des symboles qu'ils ne peuvent pas voir :\n  "
  + manques.join("\n  "));


/* Et l'inverse : un `import` qui ne sert plus est du bruit. Il survit aux
   extractions successives — on importe large « au cas où » — et finit par
   mentir sur les dépendances réelles du module. */
const inutiles = [];
for(const [fichier, source] of sources){
  /* On retire les lignes d'import avant de chercher : sinon chaque symbole se
     trouverait lui-même dans sa propre déclaration d'import. */
  const corps = source.replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']*["']\s*;?/g, " ");
  for(const nom of importsDe(source)){
    if(!emploie(corps, nom)){
      inutiles.push("js/" + fichier + " importe « " + nom + " » sans s'en servir");
    }
  }
}

assert.deepEqual(inutiles, [],
  "Des modules importent des symboles qu'ils n'emploient pas :\n  "
  + inutiles.join("\n  "));

/* Chaque module doit aussi être servi hors ligne. */
const sw = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
for(const fichier of MODULES){
  assert.ok(sw.includes('"./js/' + fichier + '"'),
    "js/" + fichier + " manque à CORE_ASSETS de sw.js : le mode hors ligne casserait");
}

console.log("PASS modules : imports déclarés et fichiers mis en cache");
