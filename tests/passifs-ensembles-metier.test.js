"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const donnees = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "passifs-ensembles.js"), "utf8"),
  donnees
);

const source = fs.readFileSync(
  path.join(racine, "js", "metier", "passifs-ensembles.js"), "utf8"
).replace(/^\s*export\s*\{[\s\S]*?\}\s*;\s*$/m, "");
const bac = { window:donnees.window };
vm.runInNewContext(source, bac, { filename:"passifs-ensembles.js" });
const resolve = bac.passifEnsembleApplicable;

assert.equal(typeof resolve, "function",
  "passifEnsembleApplicable doit etre exposee.");
assert.equal(resolve({
  ensembles:[], etats:{}, setId:"equip_t5_greed"
}), null, "moins de cinq pieces ne doit rien rendre.");

const cinq = resolve({
  ensembles:[{ setId:"equip_t5_greed", count:5 }],
  etats:{ equip_t5_greed:1 }, setId:"equip_t5_greed"
});
assert.equal(cinq.tier, "four");
assert.deepEqual(Array.from(cinq.lignes, ligne => ligne.valeur), [300]);

const six = resolve({
  ensembles:[{ setId:"equip_t5_greed", count:6 }],
  etats:{ equip_t5_greed:2 }, setId:"equip_t5_greed"
});
assert.equal(six.tier, "four");
assert.deepEqual(Array.from(six.lignes, ligne => ligne.valeur), [700, 700]);

const sept = resolve({
  ensembles:[{ setId:"equip_t5_greed", count:7 }],
  etats:{ equip_t5_greed:2 }, setId:"equip_t5_greed"
});
assert.equal(sept.tier, "seven", "sept pieces remplace le palier precedent.");
assert.deepEqual(Array.from(sept.lignes, ligne => ligne.valeur), [1200, 1200]);
assert.equal(resolve({
  ensembles:[{ setId:"equip_t5_greed", count:7 }],
  etats:{ equip_t5_greed:99 }, setId:"equip_t5_greed"
}).lignes.length, 0, "un etat invalide replie sur aucun buff.");

sept.lignes[0].valeur = 1;
assert.equal(resolve({
  ensembles:[{ setId:"equip_t5_greed", count:7 }],
  etats:{ equip_t5_greed:2 }, setId:"equip_t5_greed"
}).lignes[0].valeur, 1200, "la table ne doit jamais etre mutee.");

console.log("passifs-ensembles-metier.test.js OK");
