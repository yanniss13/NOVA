"use strict";

/* La deduction d'une piece entiere a partir de ce que l'OCR a lu.

   Le point contre-intuitif de toute la fonctionnalite : on ne lit jamais ce
   qu'on cherche. Le nom de la piece, son niveau et son renforcement sont
   affiches — en doré sur doré, en badges de douze pixels, en icones — et c'est
   precisement ce que l'OCR lit le plus mal. Les valeurs de statistiques, elles,
   se lisent tres bien. On part donc des secondes pour retrouver les premiers.

   Les valeurs de ce fichier ont ete relevees a l'oeil sur des captures reelles
   du roster de Merlin, PC et mobile. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { deduirePiece } = hooks;
assert.equal(typeof deduirePiece, "function",
  "deduirePiece doit etre expose par js/metier/ocr-deduction.js");

/* Une seule piece du catalogue porte `B_MaxHp_Equip` en principale avec cette
   valeur exacte : le nom, le niveau et le renforcement tombent ensemble. */
const ceinture = plain(deduirePiece({
  herosSlug:"merlin",
  stats:[
    { libelle:"PV de l'équipement", valeur:"12 560" },
    { libelle:"Augmentation des soins reçus", valeur:"5.53%" }
  ]
}));
assert.equal(ceinture.statut, "unique");
assert.equal(ceinture.candidats.length, 1);
assert.equal(ceinture.candidats[0].slot, "Ceinture");
assert.equal(ceinture.candidats[0].level, 159);
assert.equal(ceinture.candidats[0].reinforce, 5);
assert.match(ceinture.candidats[0].fichier, /Ceinture du souverain cupide/);

/* Le haut, releve sur la meme serie de captures. */
const haut = plain(deduirePiece({
  herosSlug:"merlin",
  stats:[
    { libelle:"Défense de l'équipement", valeur:"5 625" },
    { libelle:"Défense crit.", valeur:"10.50%" }
  ]
}));
assert.equal(haut.statut, "unique");
assert.equal(haut.candidats[0].slot, "Haut");
assert.equal(haut.candidats[0].level, 159);

/* Un libelle abime doit passer aussi : c'est tout l'interet du recalage. */
assert.equal(plain(deduirePiece({
  herosSlug:"merlin",
  stats:[{ libelle:"PV de l'equipernent", valeur:"12 560" }]
})).statut, "unique");

/* Le filet. Une valeur mal lue d'un seul chiffre ne correspond a AUCUNE
   configuration : la ligne se signale au lieu d'entrer dans le roster. C'est la
   propriete qui rend l'import sur, bien plus que la qualite de l'OCR. */
assert.equal(plain(deduirePiece({
  herosSlug:"merlin",
  stats:[{ libelle:"PV de l'équipement", valeur:"12 561" }]
})).statut, "aucun");

/* Aucun libelle reconnaissable : echec franc, jamais de devinette. */
assert.equal(plain(deduirePiece({
  herosSlug:"merlin",
  stats:[{ libelle:"Échanger", valeur:"0" }]
})).statut, "aucun");

/* Les entrees degenerees ne doivent pas lever. */
assert.equal(plain(deduirePiece({ herosSlug:"merlin", stats:[] })).statut, "aucun");
assert.equal(plain(deduirePiece({})).statut, "aucun");

console.log("ocr-deduction (piece) : OK");
