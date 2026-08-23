"use strict";

/* L'arithmetique du chronometrage, isolee du navigateur. Le mode rafale
   divise par le nombre de repetitions : c'est ce qui ramene l'erreur de
   marquage d'une image a un dixieme d'image. */

const assert = require("node:assert/strict");
const path = require("node:path");

const outils = require(path.resolve(__dirname, "..", "outils", "chrono-calcul.js"));


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

assert.deepStrictEqual(
  outils.protocolePour("meliodas_axe_jumpatk"),
  { mode:"rafale", repetitions:10 }
);
assert.deepStrictEqual(
  outils.protocolePour("meliodas_axe_skill_e"),
  { mode:"unique", repetitions:null }
);
assert.equal(outils.protocoleValide({
  gameId:"x_normalatk", mode:"rafale", repetitions:10
}), true);
assert.equal(outils.protocoleValide({
  gameId:"x_normalatk", mode:"unique", repetitions:null
}), false);
assert.equal(outils.protocoleValide({
  gameId:"x_skill_e", mode:"rafale", repetitions:10
}), false);
assert.equal(outils.protocoleValide({
  gameId:"x_normalatk", mode:"rafale", repetitions:1
}), false);
assert.equal(outils.fpsPour(1 / 30), 30);
assert.equal(outils.fpsPour(0), 60);

/* La cadence ne se lit pas sur DEUX images. L'ecart entre deux images voisines
   tremble de quelques centiemes de milliseconde, et 1/33,334 ms s'ecrit 29.999
   quand 1/33,333 ms s'ecrit 30. Sur une fenetre longue, le compteur d'images du
   navigateur donne le nombre exact d'images ecoulees : la division tombe juste. */
assert.equal(
  outils.dureeImageMesuree({
    tempsDebut:1, imagesDebut:30, tempsFin:5, imagesFin:150
  }),
  1 / 30
);

// Une recherche fait bondir le temps sans derouler les images : ce n'est pas
// une cadence, et une duree d'image de 8 s ferait sauter tout le reste.
assert.equal(
  outils.dureeImageMesuree({
    tempsDebut:1, imagesDebut:30, tempsFin:9, imagesFin:31
  }),
  0
);

// Revenir en arriere ne donne pas une duree d'image negative.
assert.equal(
  outils.dureeImageMesuree({
    tempsDebut:5, imagesDebut:150, tempsFin:1, imagesFin:151
  }),
  0
);

// Sans image ecoulee, il n'y a rien a conclure.
assert.equal(
  outils.dureeImageMesuree({
    tempsDebut:1, imagesDebut:30, tempsFin:1.01, imagesFin:30
  }),
  0
);

/* L'afficheur montre une cadence, pas une mesure de laboratoire : 29.999 est
   un 30 qui tremble, et l'ecrire tel quel fait croire a un outil qui derive.
   Les cadences reelles a decimales, elles, restent lisibles. */
assert.equal(outils.cadenceAffichee(29.999), "30");
assert.equal(outils.cadenceAffichee(30.03), "30.03");
assert.equal(outils.cadenceAffichee(30), "30");
assert.equal(outils.cadenceAffichee(59.94), "59.94");
assert.equal(outils.cadenceAffichee(23.976), "23.98");

console.log("chrono-calcul.test.js : OK");
