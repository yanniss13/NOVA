"use strict";

/* LA TABLE DES RUBRIQUES, LUE DEPUIS LE MODULE DE PRODUCTION.

   Les tests navigateur ont besoin de savoir dans quelle rubrique vit une vue.
   Recopier la table ici en ferait une seconde source : elle se tairait le jour
   ou la vraie changerait, et les tests navigueraient vers des entrees qui
   n'existent plus en croyant tout verifier.

   `js/metier/rubriques.js` est un module ES, et ces aides sont en CommonJS.
   On lit donc le fichier, on retire sa clause `export`, et on l'evalue : le
   module est pur — ni DOM, ni reseau, ni session — c'est ce qui rend cette
   lecture sure. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = path.join(__dirname, "..", "..", "js", "metier", "rubriques.js");

function lireRubriques(){
  const source = fs.readFileSync(SOURCE, "utf8").replace(/\nexport\s*\{[\s\S]*?\};?/, "");
  const bac = { resultat:null };
  vm.runInNewContext(source + "\nresultat = RUBRIQUES;", bac, { filename:SOURCE });
  if(!Array.isArray(bac.resultat) || !bac.resultat.length){
    throw new Error("table des rubriques illisible dans " + SOURCE);
  }
  return bac.resultat;
}

module.exports = { RUBRIQUES:lireRubriques() };
