"use strict";

/* Les deux buffs temporaires de Souverain cupide restent ecrits a la main.
   Ce test les rattache chacun a une phrase unique du texte publie, pour que
   le chiffre ne puisse pas survivre a une source qui aurait change. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");

function catalogueDe(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

function texteNet(texte){
  return String(texte || "").replace(/\[[^\]]*\]/g, "");
}

function nombreApres(texte, phrase, quoi){
  const morceaux = texte.split(phrase);
  assert.equal(morceaux.length, 2,
    quoi + " : ancre non unique (" + (morceaux.length - 1) + ").");
  const trouve = /^(\d+(?:\.\d+)?)%/.exec(morceaux[1]);
  assert.ok(trouve, quoi + " : pourcentage absent apres l'ancre.");
  return Number(trouve[1]) * 100;
}

const TABLE = catalogueDe("passifs-ensembles.js", "SEVEN_DS_PASSIFS_ENSEMBLES");
const BUILD = catalogueDe("stats-build.js", "SEVEN_DS_BUILD_STATS");
const cupide = TABLE.equip_t5_greed;

assert.ok(cupide, "Souverain cupide doit avoir une table.");
assert.equal(cupide.nom, "Souverain cupide");
assert.equal(cupide.paliers.length, 2, "deux paliers temporaires attendus.");

const attendus = [
  { seuil:5, tier:"four", valeurs:[[], [300], [700, 700]] },
  { seuil:7, tier:"seven", valeurs:[[], [600], [1200, 1200]] }
];

cupide.paliers.forEach((palier, index) => {
  const attendu = attendus[index];
  const quoi = "Souverain cupide palier " + attendu.seuil;
  assert.equal(palier.seuil, attendu.seuil, quoi + " : mauvais seuil.");
  assert.equal(palier.tier, attendu.tier, quoi + " : mauvais palier source.");
  assert.equal(palier.etats.length, 3, quoi + " : trois etats exclusifs attendus.");
  const texte = texteNet(BUILD.gearSets.equip_t5_greed[palier.tier + "TextFr"]);
  palier.etats.forEach((lignes, etat) => {
    assert.deepEqual(Array.from(lignes, ligne => ligne.valeur), attendu.valeurs[etat],
      quoi + " etat " + etat + " : valeurs differentes du jeu.");
    lignes.forEach((ligne, ligneIndex) => {
      const origine = quoi + " etat " + etat + " ligne " + ligneIndex;
      assert.ok(BUILD.statLabels[ligne.stat],
        origine + " : code de stat inconnu : " + ligne.stat);
      assert.equal(ligne.porteur, "hero", origine + " : le buff vise son porteur.");
      assert.ok(ligne.provenance && ligne.provenance.phrase,
        origine + " : provenance absente.");
      assert.equal(nombreApres(texte, ligne.provenance.phrase, origine), ligne.valeur,
        origine + " : valeur mal transcrite.");
    });
  });
});

assert.deepEqual(Array.from(cupide.paliers[0].etats[2], ligne => ligne.stat),
  ["C_Critical_Rate", "D_Protect_Cur_Rate"]);
assert.deepEqual(Array.from(cupide.paliers[1].etats[2], ligne => ligne.stat),
  ["C_Critical_Rate", "D_Protect_Cur_Rate"]);

console.log("passifs-ensembles.test.js OK");
