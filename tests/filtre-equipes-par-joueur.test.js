"use strict";

/* LE SELECTEUR DE JOUEUR DU REGISTRE DES EQUIPES.

   A douze equipes on parcourt la grille des yeux ; a cinq cents, non. Le
   selecteur ne liste donc PAS la confrerie entiere : il liste les joueurs qui
   ont effectivement propose une equipe, avec leur compte. Un membre sans
   equipe dans la liste serait un choix qui mene a une grille vide. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { joueursAvecEquipe } = hooks;

assert.equal(typeof joueursAvecEquipe, "function",
  "le recensement des joueurs doit être exposé");

const EQUIPES = [
  { id:"t1", owner:"u2", pseudo:"Behemoth" },
  { id:"t2", owner:"u1", pseudo:"Akaaarix" },
  { id:"t3", owner:"u2", pseudo:"Behemoth" },
  { id:"t4", owner:"u3", pseudo:"Casté" }
];

/* Les tableaux nés dans la portée `vm` du chargeur n'ont pas le prototype
   de ce fichier, et `deepStrictEqual` s'en aperçoit. On les recopie ici. */
const joueurs = Array.from(joueursAvecEquipe(EQUIPES));

assert.deepEqual(joueurs.map(j => j.pseudo), ["Akaaarix", "Behemoth", "Casté"],
  "un joueur par ligne, dans l'ordre alphabétique français");
assert.deepEqual(joueurs.map(j => j.equipes), [1, 2, 1],
  "chaque joueur porte le nombre de ses équipes");
assert.deepEqual(joueurs.map(j => j.id), ["u1", "u2", "u3"]);

/* L'accent et la casse ne doivent pas exiler un pseudo en fin de liste. */
assert.deepEqual(
  Array.from(joueursAvecEquipe([
    { id:"a", owner:"z", pseudo:"Élise" },
    { id:"b", owner:"y", pseudo:"emma" },
    { id:"c", owner:"x", pseudo:"Zoé" }
  ])).map(j => j.pseudo),
  ["Élise", "emma", "Zoé"],
  "« Élise » se range à « elise » : ni l'accent ni la casse n'exilent un pseudo"
);

/* Une equipe sans proprietaire ne peut pas ouvrir une entree : le selecteur
   proposerait un choix qui ne filtre rien. */
assert.equal(joueursAvecEquipe([{ id:"t", pseudo:"Orpheline" }]).length, 0,
  "une équipe sans propriétaire n'entre pas dans la liste");

/* Le pseudo se lit sur l'equipe. S'il manque partout, on nomme quand meme le
   joueur plutot que d'afficher une ligne vide. */
assert.equal(joueursAvecEquipe([{ id:"t", owner:"u9" }])[0].pseudo,
  "Sans pseudo",
  "un propriétaire sans pseudo reste sélectionnable");
/* Une seule de ses equipes porte le pseudo : c'est celle-la qui nomme. */
assert.equal(
  joueursAvecEquipe([
    { id:"t1", owner:"u9" },
    { id:"t2", owner:"u9", pseudo:"Tardif" }
  ])[0].pseudo,
  "Tardif",
  "le pseudo se rattrape sur n'importe laquelle de ses équipes"
);

assert.equal(joueursAvecEquipe(null).length, 0, "aucune équipe ne casse pas");

console.log("filtre-equipes-par-joueur.test.js OK");
