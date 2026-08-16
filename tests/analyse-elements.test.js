"use strict";

/* La couverture élémentaire de l'onglet Analyse, et la place de « Physique ».

   `ELEM_ORDER` pilote tout ce tableau : les cartes de couverture, les pastilles
   du classement et les colonnes. Un élément absent de cette liste n'est pas
   affiché discrètement de travers — il n'existe pas. Les héros qui le portent
   ne comptent alors pour aucune colonne, et un membre dont le roster penche de
   ce côté paraît ne rien couvrir, dans l'onglet même qui sert à décider d'une
   composition face au boss.

   Le code `DEFAULT` a longtemps voulu dire « pas d'élément », et `charElements`
   l'écartait pour cette raison. Le jeu l'a promu élément à part entière le
   15 août 2026 sous le nom « Physique », en y basculant Dreyfus et Griamore.
   L'exclusion est devenue une omission.

   Le fixture de `load-app.js` porte déjà le cas : Gowther y tient un Grimoire
   d'élément `Default` entre deux armes Foudre. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { charElements, ELEM_ORDER } = hooks;

assert.equal(typeof charElements, "function",
  "charElements doit etre exporte pour les tests");
assert.ok(ELEM_ORDER && ELEM_ORDER.length, "ELEM_ORDER doit etre exporte");

/* ---- Physique est une colonne comme les autres ---- */
assert.ok(ELEM_ORDER.includes("DEFAULT"),
  "« Physique » (DEFAULT) doit avoir sa colonne dans la couverture");
assert.equal(new Set(ELEM_ORDER).size, ELEM_ORDER.length,
  "aucun element repete dans ELEM_ORDER");

/* Tout element ayant un libelle doit avoir sa colonne, et reciproquement :
   c'est ce qui empechera la prochaine divergence entre les deux listes. */
const { ELEMENTS } = hooks;
assert.deepEqual(
  plain(ELEM_ORDER).sort(),
  Object.keys(plain(ELEMENTS)).sort(),
  "ELEM_ORDER et ELEMENTS doivent couvrir exactement les memes elements"
);

/* ---- Une arme Physique compte pour son porteur ----

   Gowther : Baguette Foudre, Grimoire Physique, Bâton Foudre. Ses éléments
   possibles sont donc Foudre ET Physique — l'ordre suit ses armes. */
assert.deepEqual(plain(charElements("gowther")), ["THUNDER", "DEFAULT"],
  "une arme Physique doit compter parmi les elements possibles du heros");

/* Le cas temoin : un heros sans arme Physique n'en gagne pas. */
assert.deepEqual(plain(charElements("meliodas")), ["DARK"]);
assert.deepEqual(plain(charElements("merlin")), ["ICE", "THUNDER", "FIRE"]);

/* Un personnage inconnu ne lève pas, il ne couvre rien. */
assert.deepEqual(plain(charElements("personne-nexiste-pas")), []);

console.log("analyse-elements.test.js OK ("
  + ELEM_ORDER.length + " elements couverts)");
