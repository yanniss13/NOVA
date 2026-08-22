"use strict";

/* Les enchantements, de ce que le panneau affiche vers ce que le site stocke.

   Ils ne s'inversent pas comme le reste : ils s'affichent. Le libelle donne la
   statistique, le nombre donne la valeur, le rang donne l'emplacement. Le
   catalogue ne sert qu'a verifier que le triplet est possible — et c'est
   justement ce controle qui transforme une lecture en filet.

   Une perle de sortilege fait exception : son palier et son element ne sont
   ecrits nulle part. Ils se retrouvent par recoupement, et quand le
   recoupement ne tranche pas, le module le dit.

   Toutes les valeurs de ce fichier sont relevees a l'oeil sur des captures
   reelles du roster de Merlin, PC et mobile. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { enchantementsDePiece, enchantementsDArme, buildWeaponGrade,
  weaponConfigStatus, gearConfigStatus, buildGearDefinition } = hooks;
assert.equal(typeof enchantementsDePiece, "function",
  "enchantementsDePiece doit etre expose par js/metier/ocr-enchantements.js");
assert.equal(typeof enchantementsDArme, "function",
  "enchantementsDArme doit etre expose par js/metier/ocr-enchantements.js");

const GRAVEE = "7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp";
const BAGUETTE = "7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp";
const RAPIERE = "7ds-armes/Rapiere/Rapière de l'âme vorace.webp";

/* --- Une piece gravee : trois emplacements, lus tels quels --- */
const gravee = plain(enchantementsDePiece(GRAVEE, [
  { libelle:"Augmentation des dégâts, compétence normale", valeur:"17.66%" },
  { libelle:"Efficacité des dégâts sur la durée", valeur:"29.30%" },
  { libelle:"Chances crit.", valeur:"4.50%" }
]));
assert.equal(gravee.length, 3, "la gravee ouvre trois emplacements");
assert.deepEqual(gravee.map(choix => choix && choix.value), [1766, 2930, 450]);
assert.equal(gravee[0].slot, 0);
assert.equal(gravee[2].slot, 2);
/* Le juge de la saisie manuelle doit accepter ce que la lecture produit :
   aucune configuration ne doit entrer par une porte qu'une saisie a la main
   n'aurait pas franchie. */
const definitionGravee = buildGearDefinition(GRAVEE);
assert.equal(gearConfigStatus(GRAVEE, {
  version:1, level:definitionGravee.qualityMax, reinforce:5,
  enchantments:gravee, passiveLevel:1
}), "valid", "les enchantements lus doivent former une configuration valide");

/* Une valeur hors des bornes du catalogue est une mauvaise lecture : elle
   laisse son emplacement vide plutot que d'entrer dans le roster. */
const horsBornes = plain(enchantementsDePiece(GRAVEE, [
  { libelle:"Chances crit.", valeur:"99.90%" }
]));
assert.equal(horsBornes[0], null,
  "une valeur hors bornes doit etre refusee, pas arrondie");

/* Une piece ordinaire n'a pas d'emplacement d'enchantement : `randomOptions`
   est absent de toutes les pieces non gravees. */
assert.deepEqual(
  plain(enchantementsDePiece(
    "7ds-armures-ssr/Haut/Haut du souverain cupide.webp",
    [{ libelle:"Chances crit.", valeur:"4.50%" }]
  )),
  [],
  "une armure ordinaire n'ouvre aucun emplacement"
);

/* --- Une perle dont l'element est FORCE par une statistique elementaire --- */
const gradeBaguette = plain(buildWeaponGrade(BAGUETTE, 131065005));
const perleForcee = plain(enchantementsDArme(gradeBaguette, [
  { libelle:"Augmentation des dégâts de Foudre", valeur:"16.80%" },
  { libelle:"Dégâts crit.", valeur:"16.81%" },
  { libelle:"Augmentation des dégâts, compétence normale", valeur:"20.45%" },
  { libelle:"Augmentation des dégâts, compétence de relève", valeur:"27.22%" }
], ["C_Critical_Dam_Rate"]));
assert.equal(perleForcee.tier, 5, "quatre emplacements : palier Legendaire");
assert.equal(perleForcee.element, "thunder",
  "« dégâts de Foudre » n'existe que dans le groupe foudre");
assert.equal(perleForcee.suppose, false,
  "une seule combinaison explique la lecture : rien n'est suppose");
assert.deepEqual(perleForcee.choix.map(c => c.value), [1680, 1681, 2045, 2722]);
assert.equal(weaponConfigStatus(BAGUETTE, {
  version:1, gradeGameId:131065005, level:50, promotion:4, overlimit:6,
  enchantments:perleForcee.choix
}), "valid", "la perle lue doit former une configuration valide");

/* --- Une perle dont l'element n'est PAS force --- */
const gradeRapiere = plain(buildWeaponGrade(RAPIERE, 131085010));
const perleSupposee = plain(enchantementsDArme(gradeRapiere, [
  { libelle:"Dégâts crit.", valeur:"11.71%" },
  { libelle:"Chances crit.", valeur:"9.53%" },
  { libelle:"Augmentation des dégâts d'attaque normale", valeur:"18.56%" }
], ["Wind_Burst_Gauge_Rate", "windDamage"]));
assert.equal(perleSupposee.tier, 5);
assert.equal(perleSupposee.suppose, true,
  "les neuf groupes elementaires expliquent aussi bien ces trois lignes");
assert.equal(perleSupposee.element, "wind",
  "a defaut de preuve, on retient l'element de l'arme elle-meme");
assert.equal(weaponConfigStatus(RAPIERE, {
  version:1, gradeGameId:131085010, level:50, promotion:4, overlimit:0,
  enchantments:perleSupposee.choix
}), "valid");

/* --- Rien de lisible : la configuration nue, jamais un rejet --- */
const nue = plain(enchantementsDArme(gradeBaguette, [], []));
assert.deepEqual(nue.choix, [null],
  "une perle vide compte un emplacement, pas zero");
assert.equal(nue.suppose, false);
assert.equal(weaponConfigStatus(BAGUETTE, {
  version:1, gradeGameId:131065005, level:50, promotion:4, overlimit:6,
  enchantments:nue.choix
}), "valid", "l'arme doit entrer meme sans ses enchantements");

/* Des lignes qui ne correspondent a rien laissent aussi la configuration nue :
   une lecture douteuse ne doit pas fabriquer un enchantement. */
const illisible = plain(enchantementsDArme(gradeBaguette, [
  { libelle:"xxxxxxxx yyyyyyyy", valeur:"12.00%" }
], []));
assert.deepEqual(illisible.choix, [null]);

/* --- Un enchantement basique : les bornes sont redressees par emplacement --- */
const BASIQUE = "7ds-armes/Baguette/Baguette bénie.webp";
const gradeBasique = plain(buildWeaponGrade(BASIQUE, 131062003));
const basique = plain(enchantementsDArme(gradeBasique, [
  { libelle:"Dégâts crit.", valeur:"20.00%" },
  { libelle:"Chances crit.", valeur:"5.00%" }
], []));
assert.equal(basique.choix.length, 2,
  "le catalogue fixe le nombre d'emplacements d'un enchantement basique");
assert.equal(basique.choix[0].value, 2000,
  "premier emplacement : taux 10000, la plage 1800-2200 vaut telle quelle");
assert.equal(basique.choix[1].value, 500,
  "second emplacement : taux 5000, la plage 900-1100 devient 450-550");
assert.equal(basique.tier, null, "un enchantement basique n'a pas de palier");
assert.equal(weaponConfigStatus(BASIQUE, {
  version:1, gradeGameId:131062003, level:30, promotion:2, overlimit:0,
  enchantments:basique.choix
}), "valid");

/* Le meme second emplacement refuse une valeur qui n'aurait ete valable qu'au
   premier : c'est le redressement par le taux qui fait la difference. */
assert.equal(plain(enchantementsDArme(gradeBasique, [
  { libelle:"Dégâts crit.", valeur:"20.00%" },
  { libelle:"Chances crit.", valeur:"10.00%" }
], [])).choix[1], null);

console.log("ocr-enchantements : OK");
