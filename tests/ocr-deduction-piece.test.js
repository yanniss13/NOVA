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

/* LE NOM TRANCHE ENTRE DES PIECES INDISCERNABLES.

   Trois armures liees partagent les memes courbes : leurs totaux coincident au
   point pres, et l'inversion seule ne peut pas les departager. Le titre du
   panneau, lui, le fait. Les valeurs viennent d'une capture reelle des
   « Vetements formels legers », lue par la fonction de lecture assistee. */
const GRAVEE = [
  { libelle:"PV de l'équipement", valeur:"20 822", section:null },
  { libelle:"Défense de l'équipement", valeur:"7 453", section:null },
  { libelle:"Attaque de Froid", valeur:"1 703", section:null },
  { libelle:"Dégâts crit.", valeur:"12.84%", section:null },
  { libelle:"Dégâts crit.", valeur:"7.95%", section:"Bonus de gravure" },
  { libelle:"Résistance crit.", valeur:"7.21%", section:"Bonus de gravure" },
  { libelle:"Augmentation des dégâts, compétence de relève", valeur:"27.21%",
    section:"Bonus de gravure" }
];

const sansNom = plain(deduirePiece({ stats:GRAVEE }));
assert.equal(sansNom.statut, "ambigu",
  "sans le nom, les statistiques seules ne separent pas ces pieces");
assert.ok(sansNom.candidats.length > 1);

const avecNom = plain(deduirePiece({
  nom:"Vêtements formels légers", stats:GRAVEE
}));
assert.equal(avecNom.statut, "unique",
  "le nom lu doit lever l'ambiguite");
assert.match(avecNom.candidats[0].fichier, /Vêtements formels légers/,
  "et designer la bonne piece");

/* LE GARDE-FOU. Un nom APPROCHANT ne doit RIEN trancher : transformer une
   ambiguite honnete — ou le site pose la question au membre — en certitude
   fausse serait bien pire que de la garder. Seul l'exact compte. */
for(const approchant of [
  "Vetements formels leger",
  "Vêtements formels",
  "Piste de la flamme",
  "n'importe quoi"
]){
  const flou = plain(deduirePiece({ nom:approchant, stats:GRAVEE }));
  assert.equal(flou.statut, "ambigu",
    "un nom approchant a tranche : " + approchant);
  assert.equal(flou.candidats.length, sansNom.candidats.length,
    "un nom approchant a restreint la liste : " + approchant);
}

/* Le nom ne doit jamais ELARGIR : une piece que les chiffres excluent ne peut
   pas revenir par son titre. */
const impossible = plain(deduirePiece({
  nom:"Vêtements formels légers",
  stats:[{ libelle:"Échanger", valeur:"0" }]
}));
assert.equal(impossible.statut, "aucun",
  "le nom ne doit pas ressusciter une piece que les chiffres refusent");

console.log("ocr-deduction (piece) : le nom leve l'ambiguite, "
  + sansNom.candidats.length + " candidates -> 1");
