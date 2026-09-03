"use strict";

/* LES INVITES NE PARASITENT PAS LES DONNEES DE LA CONFRERIE.

   Un invite est quelqu'un qui a un compte sans appartenir a la confrerie
   (`profiles.membre = false`). Il garde l'acces au site, mais il n'a rien a
   faire dans le planning, dans la liste des equipes, ni dans le decompte du
   webhook Discord : « 12/14 membres ont renseigne leurs creneaux » devient
   faux des qu'un invite gonfle le denominateur.

   La RLS bloque deja ses ecritures la ou elle le peut (`member_availability`,
   `recensement`). Ce qui reste, c'est sa simple PRESENCE dans la liste des
   profils — d'ou ce garde-fou, sur les deux filtres qui la portent. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { profilsDeLaConfrerie, equipesDeLaConfrerie } = hooks;

assert.equal(typeof profilsDeLaConfrerie, "function",
  "le filtre des profils doit être exposé");
assert.equal(typeof equipesDeLaConfrerie, "function",
  "le filtre des équipes doit être exposé");

/* ---- Les profils ---- */

const LIGNES = [
  { id:"m1", pseudo:"behemoth", membre:true },
  { id:"g1", pseudo:"Fønzey",   membre:false },
  { id:"m2", pseudo:"Casté",    membre:true }
];

assert.deepEqual(
  profilsDeLaConfrerie(LIGNES).map(p => p.id),
  ["m1", "m2"],
  "l'invité sort de la liste des profils"
);
/* Les objets viennent de la portée `vm` du chargeur : leur prototype n'est
   pas celui de ce fichier, et `deepStrictEqual` s'en apercevrait. On
   compare donc les champs, ce qui dit de toute façon mieux l'intention. */
const premier = profilsDeLaConfrerie(LIGNES)[0];
assert.equal(premier.id, "m1");
assert.equal(premier.pseudo, "behemoth");
assert.deepEqual(Object.keys(premier).sort(), ["id", "pseudo"],
  "la forme retournée ne change pas : un id et un pseudo, rien de plus");
assert.equal(profilsDeLaConfrerie(null).length, 0,
  "une lecture vide ne casse pas");
assert.equal(
  profilsDeLaConfrerie([{ id:"x", pseudo:"" , membre:true }])[0].pseudo,
  "Membre",
  "un pseudo vide garde son repli"
);
/* Le drapeau est `not null default false` : une ligne sans drapeau est une
   ligne qu'on ne sait pas lire, et on ne l'invente pas membre. */
assert.equal(profilsDeLaConfrerie([{ id:"y", pseudo:"Y" }]).length, 0,
  "sans drapeau, on ne suppose pas l'appartenance");

/* ---- Les equipes ---- */

const EQUIPES = [
  { id:"t1", owner:"m1", name:"Ténèbre power" },
  { id:"t2", owner:"g1", name:"Compo d'un invité" },
  { id:"t3", owner:"m2", name:"Foudre" }
];
const MEMBRES = ["m1", "m2"];

assert.deepEqual(
  equipesDeLaConfrerie(EQUIPES, MEMBRES, "m1").map(t => t.id),
  ["t1", "t3"],
  "l'équipe d'un invité sort de la liste de la confrérie"
);

/* L'INVITE GARDE SES PROPRES EQUIPES. Il peut toujours acceder au site : lui
   masquer ses compos le laisserait devant une page vide sans rien expliquer. */
assert.deepEqual(
  equipesDeLaConfrerie(EQUIPES, MEMBRES, "g1").map(t => t.id),
  ["t1", "t2", "t3"],
  "l'invité continue de voir les siennes"
);

/* Tant que la liste des membres n'est pas chargee, on ne masque RIEN : un
   filtre qui s'applique sur une liste vide viderait l'ecran de tout le monde. */
assert.deepEqual(
  equipesDeLaConfrerie(EQUIPES, [], "m1").map(t => t.id),
  ["t1", "t2", "t3"],
  "sans liste de membres, aucune équipe n'est masquée"
);
assert.equal(equipesDeLaConfrerie(null, MEMBRES, "m1").length, 0,
  "aucune équipe ne casse pas");

console.log("invites-hors-donnees.test.js OK");
