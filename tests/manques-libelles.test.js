"use strict";

/* Ce qu'un membre lit quand son build n'est pas fini.

   `calculateHeroStats` rend ses manques sous forme de CHEMINS DE DONNEES —
   `armor.Haut`, `rosterBuilds.Axe.weaponConfig`. Ce sont des identifiants
   internes, utiles au code et illisibles a l'ecran. Deux vues les affichaient
   tels quels ; ce test tient le dictionnaire qui les traduit.

   Les deux exigences se contredisent presque, et c'est pour ca qu'il faut les
   ecrire :

   - AUCUN chemin connu ne doit sortir en francais approximatif. Le francais
     impose deux formes selon la place du mot — « les bottes » mais « la
     configuration DES bottes » —, et une seule table les couvrirait mal ;
   - un chemin INCONNU ne doit pas disparaitre. Une omission silencieuse
     laisserait un membre chercher une piece que rien ne nomme. Il ressort tel
     quel, laid mais present.

   La liste des chemins possibles n'est pas recopiee a la main : elle est
   derivee des memes constantes que `stats-calcul.js` emploie pour les
   fabriquer, sinon elle se perimerait au premier emplacement ajoute. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { libelleDuManque, libelleDesManques } = hooks;

assert.equal(typeof libelleDuManque, "function",
  "libelleDuManque doit etre exporte pour les tests");
assert.equal(typeof libelleDesManques, "function",
  "libelleDesManques doit etre exporte pour les tests");

/* ---- Les chemins simples ---- */
const SIMPLES = {
  character:"le personnage",
  potential:"le potentiel",
  weapon:"l'arme",
  weaponConfig:"la configuration de l'arme",
  mastery:"la maîtrise d'arme"
};
Object.entries(SIMPLES).forEach(([chemin, attendu]) => {
  assert.equal(libelleDuManque(chemin), attendu,
    chemin + " doit se lire « " + attendu + " »");
});

/* ---- Les emplacements, et leur configuration ----

   Les cles viennent de `constantes.js` : ARMOR_SLOTS et JEWEL_SLOTS. Un
   emplacement ajoute au jeu fera echouer ce test tant qu'il n'aura pas de
   libelle, ce qui est exactement le but. */
const EMPLACEMENTS = {
  "armor.Haut":"le haut d'armure",
  "armor.Bas":"le bas d'armure",
  "armor.Bottes":"les bottes",
  "armor.Ceinture":"la ceinture",
  "armor.Armure liee":"l'armure gravée",
  "jewel.Anneau":"l'anneau",
  "jewel.Collier":"le collier",
  "jewel.Boucle d'oreille":"la boucle d'oreille"
};
const CONFIGS = {
  "armorConfig.Haut":"la configuration du haut d'armure",
  "armorConfig.Bas":"la configuration du bas d'armure",
  "armorConfig.Bottes":"la configuration des bottes",
  "armorConfig.Ceinture":"la configuration de la ceinture",
  "armorConfig.Armure liee":"la configuration de l'armure gravée",
  "jewelConfig.Anneau":"la configuration de l'anneau",
  "jewelConfig.Collier":"la configuration du collier",
  "jewelConfig.Boucle d'oreille":"la configuration de la boucle d'oreille"
};
Object.entries(Object.assign({}, EMPLACEMENTS, CONFIGS)).forEach(
  ([chemin, attendu]) => {
    assert.equal(libelleDuManque(chemin), attendu,
      chemin + " doit se lire « " + attendu + " »");
  }
);

/* ---- Les builds secondaires du roster ----

   `rosterBuilds.<enum d'arme>.<champ>` : le type d'arme se lit avec le meme
   libellé que partout ailleurs dans le site, pas avec son enum anglaise. */
assert.equal(libelleDuManque("rosterBuilds.Axe.weapon"),
  "l'arme du build Hache");
assert.equal(libelleDuManque("rosterBuilds.Book.weaponConfig"),
  "la configuration de l'arme du build Grimoire");

/* ---- Aucun chemin fabricable ne doit rester en anglais ----

   La garde qui compte : on reconstruit tous les chemins que `stats-calcul.js`
   sait produire, et aucun ne doit ressortir identique a lui-meme. */
const { ARMOR_SLOTS, JEWEL_SLOTS, WEAPON_ENUM } = hooks;
const tousLesChemins = [
  ...Object.keys(SIMPLES),
  ...ARMOR_SLOTS.flatMap(slot => ["armor." + slot, "armorConfig." + slot]),
  ...JEWEL_SLOTS.flatMap(slot => ["jewel." + slot, "jewelConfig." + slot]),
  ...Object.keys(WEAPON_ENUM).flatMap(type => [
    "rosterBuilds." + type + ".weapon",
    "rosterBuilds." + type + ".weaponConfig"
  ])
];
tousLesChemins.forEach(chemin => {
  const lu = libelleDuManque(chemin);
  assert.notEqual(lu, chemin,
    "chemin sans traduction, il s'afficherait tel quel : " + chemin);
  /* Aucun fragment de chemin ne doit survivre dans la phrase. Le point est
     le marqueur : `armor.Haut` traduit a moitie donnerait « la configuration
     de armor.Haut ». Les majuscules, elles, sont legitimes — « Hache » et
     « Grimoire » sont les noms des types d'arme. */
  assert.ok(!lu.includes("."),
    "fragment de chemin dans le libelle : " + chemin + " -> " + lu);
});

/* ---- Un chemin inconnu ressort tel quel plutot que de disparaitre ---- */
assert.equal(libelleDuManque("chose.inconnue"), "chose.inconnue");
assert.equal(libelleDuManque(""), "");

/* ---- La liste, telle qu'une phrase la porte ---- */
assert.equal(
  libelleDesManques(["armor.Haut", "jewelConfig.Anneau"]),
  "le haut d'armure, la configuration de l'anneau"
);
assert.equal(libelleDesManques([]), "");
/* Les doublons se fondent : deux chemins distincts peuvent viser la meme
   piece, et « les bottes, les bottes » se lirait comme une erreur. */
assert.equal(libelleDesManques(["armor.Bottes", "armor.Bottes"]), "les bottes");

console.log("manques-libelles.test.js OK ("
  + tousLesChemins.length + " chemins traduits)");
