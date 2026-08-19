"use strict";

/* L'arithmetique du chronometrage, isolee du navigateur. Le mode rafale
   divise par le nombre de repetitions : c'est ce qui ramene l'erreur de
   marquage d'une image a un dixieme d'image. */

const assert = require("node:assert/strict");
const path = require("node:path");

const outils = require(path.resolve(__dirname, "..", "outils", "chrono-calcul.js"));

assert.equal(outils.slotDeGameId("bug_axe_jumpatk"), "jumpatk");
assert.equal(outils.slotDeGameId("gil_thunder_lance_skill_tag"), "skill_tag");
assert.equal(outils.slotDeGameId("meliodas_axe_skill_rmb_ready"), "skill_rmb_ready");
assert.equal(outils.slotDeGameId("daisy_book_normalatk_1_enchant"), "normalatk_1_enchant");

// Dix lancements entre 1.000 s et 13.000 s : 1.2 s chacun.
assert.equal(
  outils.dureeRafale({ secondeDebut: 1, secondeFin: 13, repetitions: 10 }),
  1.2
);

// Arrondi au millieme : au-dela on afficherait du bruit.
assert.equal(
  outils.dureeRafale({ secondeDebut: 0, secondeFin: 1, repetitions: 3 }),
  0.333
);

assert.equal(outils.dureeUnique({ secondeDebut: 2.5, secondeFin: 4 }), 1.5);

// Une saisie incoherente ne doit pas produire un nombre credible.
assert.throws(
  () => outils.dureeRafale({ secondeDebut: 5, secondeFin: 2, repetitions: 10 }),
  /apres le debut/i
);
assert.throws(
  () => outils.dureeRafale({ secondeDebut: 0, secondeFin: 5, repetitions: 0 }),
  /repetition/i
);

console.log("chrono-calcul.test.js : OK");
