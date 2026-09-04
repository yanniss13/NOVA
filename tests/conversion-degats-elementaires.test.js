"use strict";

/* LA CONVERSION : un pourcentage de la SOMME d'autres statistiques.

   Le passif d'armure gravee de Ban (« Pillard ultime ») augmente ses degats
   physiques « a hauteur de 60/80/100 % de l'augmentation de degats de tous
   les elements, sauf Physique ». BuffTable 303419201-203 le dit sans
   ambiguite : sept entrees `<Element>_Element_Rate` -> `Default_Element_Rate`,
   de type `Per`.

   CE QUE CE TEST PROTEGE. Une telle ligne ne doit JAMAIS etre ajoutee comme
   une valeur ordinaire : `niveaux[2]` vaut 10000, et un seau qui recevrait
   ce nombre a plat offrirait +100 % de degats a un build qui n'a aucun bonus
   elementaire a convertir. C'est le pire mode de panne pour ce site — un
   chiffre faux, credible, et silencieux. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { statsElementairesDuBuild, entreesDuCalcul } = hooks;

assert.equal(typeof statsElementairesDuBuild, "function");
assert.equal(typeof entreesDuCalcul, "function");

/* Un build physique qui porte 30 % de degats Tenebres et 20 % de Feu — le cas
   que le passif existe pour recompenser. */
const BUILD = {
  Dark_Element_Rate:3000,
  Fire_Element_Rate:2000,
  Default_Element_Rate:1000
};
const lire = code => BUILD[code] || 0;

/* Sans le passif, seul le seau physique compte. */
assert.equal(
  statsElementairesDuBuild(lire, "DEFAULT").bonusElementaire, 1000,
  "sans conversion, le heros physique ne lit que Default_Element_Rate"
);

/* Avec 80 % : 1000 + 0,8 x (3000 + 2000) = 5000. */
assert.equal(
  statsElementairesDuBuild(lire, "DEFAULT", { conversionHorsPhysique:8000 })
    .bonusElementaire,
  5000,
  "80 % de la somme des degats elementaires non physiques s'ajoutent"
);

/* LE SEAU PHYSIQUE NE SE CONVERTIT PAS LUI-MEME : « sauf Physique ». Sans
   cette exclusion, les 1000 de Default_Element_Rate se compteraient deux
   fois. */
assert.equal(
  statsElementairesDuBuild(
    { Default_Element_Rate:1000 } && (code => code === "Default_Element_Rate" ? 1000 : 0),
    "DEFAULT",
    { conversionHorsPhysique:10000 }
  ).bonusElementaire,
  1000,
  "un build sans element autre que Physique ne convertit rien"
);

/* LA CONVERSION N'EXISTE QUE POUR UN HEROS PHYSIQUE. Le passif vise
   `Default_Element_Rate` ; sur un heros Tenebres, ce seau n'est pas celui que
   le moteur lit, et la conversion ne doit rien y verser. */
assert.equal(
  statsElementairesDuBuild(lire, "DARK", { conversionHorsPhysique:10000 })
    .bonusElementaire,
  3000,
  "un heros Tenebres garde son seul Dark_Element_Rate"
);

/* Et la ligne ne doit pas passer par le chemin ordinaire des buffs coches :
   sinon `niveaux[2]` y entrerait a plat. */
const NEUTRE = {
  atk:1000, attaqueElementaire:500, def:400, maxHp:20000,
  critRate:3000, critDamage:12000, percementDefense:500, bonusElementaire:1000
};
const ligne = {
  id:"ban-cuisinier-conversion-physique",
  stat:"Default_Element_Rate",
  depuis:"degats-elementaires-hors-physique",
  operation:"add", unite:"ten-thousandths", cible:"soi",
  valeur:10000, niveaux:[6000, 8000, 10000]
};
assert.equal(
  entreesDuCalcul({ statsDuBuild:NEUTRE, buffsCoches:[ligne] }).bonusElementaire,
  1000,
  "une ligne `depuis` n'ajoute RIEN a plat : sa valeur est un taux de conversion"
);

console.log("conversion-degats-elementaires.test.js OK");
