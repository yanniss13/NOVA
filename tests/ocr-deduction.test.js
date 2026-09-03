"use strict";

/* Le recalage des libelles lus par l'OCR sur le catalogue de statistiques.

   Le jeu ecrit exactement les memes chaines que `statLabels` : l'OCR n'a donc
   pas besoin d'etre exact, seulement d'etre proche. Trois contraintes se
   cumulent pour que « proche » suffise sans jamais deviner faux — la
   normalisation, l'unite deduite du « % », et la restriction aux stats que la
   piece peut porter. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { recalerLibelle } = hooks;
assert.equal(typeof recalerLibelle, "function",
  "recalerLibelle doit etre expose par js/metier/ocr-deduction.js");

/* Un libelle intact se reconnait sans distance d'edition. */
const intact = recalerLibelle("PV de l'équipement", "21 678", []);
assert.equal(intact.statut, "exact");
assert.equal(intact.code, "B_MaxHp_Equip");

/* Le jeu peut etre configure en anglais : les alias du catalogue doivent
   conduire exactement aux memes codes que les libelles francais. */
assert.equal(
  recalerLibelle("Equipment Attack", "4,937", []).code,
  "B_Atk_Equip"
);
assert.equal(
  recalerLibelle("Lightning Burst Efficiency", "17.61%", []).code,
  "Thunder_Burst_Gauge_Rate"
);
assert.equal(
  recalerLibelle("Crit Defense", "12.73%", []).code,
  "C_Critical_DamRes_Rate"
);

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

/* L'unite reste le garde-fou, mais elle n'arbitre plus qu'UNE paire homonyme :
   `Perforation`, portee par `A_Accuracy` en points et par `accuracy` en
   pourcentage. Les sept autres n'existaient pas : elles venaient des six codes
   d'attaque elementaire de `armes.json`, declares en dix-milliemes alors que
   la table du jeu les donne plats — `weapon_sub1_131025010` vaut
   `EAbilityType::Dark_Add`. Le catalogue ne porte plus ces codes.

   Consequence directe : `Attaque de Feu` n'existe QUE plate. Un pourcentage
   lu sous ce libelle n'est plus rattache a rien, et c'est juste — inventer un
   code aurait verse la valeur dans un seau qui n'existe pas. */
assert.equal(recalerLibelle("Attaque de Feu", "1 409", []).code, "Fire_Add");
assert.equal(recalerLibelle("Attaque de Feu", "12.34%", []).code, null);
assert.equal(recalerLibelle("Attaque de Feu", "12.34%", []).statut, "rejete");
assert.equal(recalerLibelle("Perforation", "120", []).code, "A_Accuracy");
assert.equal(recalerLibelle("Perforation", "1.20%", []).code, "accuracy");

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

/* ---------------------------------------------------------------------------
   L'inversion : de la valeur affichee vers le couple (niveau, renforcement).

   Le panneau du jeu montre des resultats ; le site stocke une configuration.
   Les trois donnees qui identifient une piece — le niveau en chiffres dores, le
   badge de renforcement, l'icone — sont precisement celles qui se lisent le
   plus mal. On ne les lit donc pas, on les deduit.
   ------------------------------------------------------------------------- */

const { configsDePiece } = hooks;
assert.equal(typeof configsDePiece, "function",
  "configsDePiece doit etre expose par js/metier/ocr-deduction.js");

/* Valeurs relevees a l'oeil sur une capture reelle : la ceinture de Merlin
   affiche « PV de l'equipement 12 560 ». Une seule configuration la produit. */
assert.deepEqual(
  plain(configsDePiece("7ds-armures-ssr/Ceinture/Ceinture du souverain cupide.webp",
    "belt", 12560, null)),
  [{ level:159, reinforce:5 }]
);

/* La piece gravee, avec sa stat secondaire : PV 21 678 et Foudre 1 409. */
assert.deepEqual(
  plain(configsDePiece("7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp",
    "engraved", 21678, 1409)),
  [{ level:130, reinforce:5 }]
);

/* Le point qui compte le plus. Les valeurs atteignables sont RARES dans leur
   intervalle — 3,56 % des entiers en mediane. Un chiffre mal lu ne correspond
   donc presque jamais a une configuration : l'erreur se signale au lieu de
   s'ecrire. C'est ce filet qui rend l'import sur, bien plus que la qualite de
   l'OCR lui-meme. */
assert.deepEqual(
  plain(configsDePiece("7ds-armures-ssr/Ceinture/Ceinture du souverain cupide.webp",
    "belt", 12561, null)),
  []
);

/* Un fichier inconnu ne doit pas lever, seulement ne rien proposer. */
assert.deepEqual(plain(configsDePiece("inexistant.webp", "belt", 100, null)), []);

console.log("ocr-deduction (recalage + inversion) : OK");
