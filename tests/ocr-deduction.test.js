"use strict";

/* Le recalage des libelles lus par l'OCR sur le catalogue de statistiques.

   Le jeu ecrit exactement les memes chaines que `statLabels` : l'OCR n'a donc
   pas besoin d'etre exact, seulement d'etre proche. Trois contraintes se
   cumulent pour que « proche » suffise sans jamais deviner faux — la
   normalisation, l'unite deduite du « % », et la restriction aux stats que la
   piece peut porter. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { recalerLibelle } = hooks;
assert.equal(typeof recalerLibelle, "function",
  "recalerLibelle doit etre expose par js/metier/ocr-deduction.js");

/* Un libelle intact se reconnait sans distance d'edition. */
const intact = recalerLibelle("PV de l'équipement", "21 678", []);
assert.equal(intact.statut, "exact");
assert.equal(intact.code, "B_MaxHp_Equip");

/* Accents perdus, virgule a la place du point, icone collee devant : la
   normalisation absorbe tout ca avant meme que la distance intervienne. */
assert.equal(
  recalerLibelle("* Degats crit,", "12.42%", []).code,
  "C_Critical_Dam_Rate"
);

/* Une vraie faute de lecture doit etre rattrapee, pas rejetee. Le « rn » lu a
   la place du « m » est le grand classique de l'OCR. */
const rattrape = recalerLibelle(
  "Augmentation des dégats, competence norrnale", "10.80%", []);
assert.equal(rattrape.code, "Normalskill_Damadd_Rate");
assert.equal(rattrape.statut, "rattrape");

/* L'unite est le garde-fou decisif. Sept paires de libelles sont homonymes :
   `Attaque de Feu` existe en valeur brute ET en pourcentage. Sans le signal du
   « % », le recalage tranchait a pile ou face. */
assert.equal(recalerLibelle("Attaque de Feu", "1 409", []).code, "Fire_Add");
assert.equal(recalerLibelle("Attaque de Feu", "12.34%", []).code, "fireDamage");

/* La famille elementaire est le cas le plus serre du catalogue : cinq libelles
   qui ne different que par un mot court. C'est la seule confusion qui subsistait
   a la mesure, et restreindre aux stats que la piece peut porter la fait tomber.

   Sans restriction, « de Foue » est plus proche de « de Feu » que de
   « de Foudre » — l'OCR a mange le « dr », pas ajoute de lettre. */
assert.notEqual(
  recalerLibelle("Augmentation des dégâts de Foue", "16.80%", []).code,
  "Thunder_Element_Rate"
);
/* Avec la restriction, le mauvais voisin n'est plus candidat. */
assert.equal(
  recalerLibelle("Augmentation des dégâts de Foue", "16.80%",
    ["Thunder_Element_Rate", "C_Critical_Dam_Rate"]).code,
  "Thunder_Element_Rate"
);

/* Le code doit exister vraiment : `Défense de Foudre` est une valeur BRUTE,
   pas un pourcentage. Se tromper d'unite ici ferait rejeter la lecture. */
assert.equal(recalerLibelle("Défense de Foudre", "1 409", []).code, "Thunder_Res");

/* Un texte qui n'est pas un libelle de stat doit etre REJETE, jamais rapproche
   du moins mauvais candidat : c'est ce qui empeche un titre de section ou un
   bouton d'entrer dans le roster. */
assert.equal(recalerLibelle("Équipement gravé", "130", []).statut, "rejete");
assert.equal(recalerLibelle("Échanger", "0", []).statut, "rejete");

/* Une entree vide ne doit pas lever. */
assert.equal(recalerLibelle("", "0", []).statut, "rejete");
assert.equal(recalerLibelle(null, null, []).statut, "rejete");

console.log("ocr-deduction (recalage) : OK");
