"use strict";

/* La table des rubriques de la nouvelle navigation.

   Elle remplace le groupe unique « Boss de Guilde » que portait
   `js/vues/navigation.js`. Ce test protege trois proprietes dont dependent la
   coquille et le surlignage : la couverture, l'unicite, et l'absence de
   collision entre un identifiant de rubrique et un nom de vue.

   La collision n'est pas theorique : la vue `roster` du site est « Equipes
   dispo pour le Boss de Guilde », alors que la rubrique Roster de la maquette
   designe le roster personnel, c'est-a-dire la vue `member-roster`. Deux
   choses differentes qui voudraient le meme nom. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  RUBRIQUES,
  rubriqueDeVue,
  rubriqueParId,
  ongletsDeRubrique,
  vueChefDeRubrique
} = hooks;

assert.ok(Array.isArray(RUBRIQUES), "la table des rubriques doit exister");
assert.equal(typeof rubriqueDeVue, "function",
  "une vue doit savoir dire de quelle rubrique elle releve");
assert.equal(typeof rubriqueParId, "function",
  "une rubrique doit se retrouver par son identifiant");
assert.equal(typeof ongletsDeRubrique, "function",
  "une rubrique doit livrer ses onglets locaux");
assert.equal(typeof vueChefDeRubrique, "function",
  "cliquer une rubrique doit ouvrir une vue precise");

/* LES DOUZE VUES. Les onze deja enregistrees par js/app.js, plus l'accueil
   public que le lot 0 ajoute. Aucune ne doit rester hors rubrique : une vue
   sans rubrique est une vue qu'aucune entree de navigation ne surligne. */
const VUES = [
  "home", "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection", "calculateur", "admin"
];

const vuesDeLaTable = RUBRIQUES.flatMap(rubrique => rubrique.vues);

VUES.forEach(vue => {
  assert.ok(vuesDeLaTable.includes(vue), `vue hors rubrique : ${vue}`);
  assert.ok(rubriqueDeVue(vue), `rubrique introuvable pour la vue : ${vue}`);
});

assert.equal(vuesDeLaTable.length, VUES.length,
  "la table ne doit citer que les douze vues, chacune une seule fois");
assert.equal(new Set(vuesDeLaTable).size, vuesDeLaTable.length,
  "une vue ne peut pas appartenir a deux rubriques : le surlignage serait ambigu");

/* PAS DE COLLISION. `data-rubrique="roster"` a cote de `data-view="roster"`
   dans la meme coquille ferait pointer deux choses differentes vers le meme
   nom, et le premier selecteur ecrit gagnerait silencieusement. */
const identifiants = RUBRIQUES.map(rubrique => rubrique.id);
assert.equal(new Set(identifiants).size, identifiants.length,
  "deux rubriques ne peuvent pas partager un identifiant");
identifiants.forEach(id => {
  assert.ok(!VUES.includes(id),
    `l'identifiant de rubrique « ${id} » porte le nom d'une vue`);
});

RUBRIQUES.forEach(rubrique => {
  assert.ok(rubrique.libelle, `rubrique sans libelle : ${rubrique.id}`);
  assert.deepEqual(plain(rubriqueParId(rubrique.id)), plain(rubrique));
  assert.ok(rubrique.vues.includes(vueChefDeRubrique(rubrique.id)),
    `la vue chef de « ${rubrique.id} » doit appartenir a sa rubrique`);
  /* Un onglet local ne peut mener que dans sa propre rubrique, sinon cliquer
     l'onglet deplacerait le surlignage de la rubrique elle-meme. */
  ongletsDeRubrique(rubrique.id).forEach(onglet => {
    assert.ok(rubrique.vues.includes(onglet.vue),
      `onglet hors rubrique dans « ${rubrique.id} » : ${onglet.vue}`);
    assert.ok(onglet.libelle, `onglet sans libelle dans « ${rubrique.id} »`);
  });
});

/* LA CARTE ATTENDUE, telle que la specification de bascule la fixe. */
assert.equal(rubriqueDeVue("home"), rubriqueDeVue("dashboard"),
  "l'accueil public et Mon suivi sont deux etats de la meme rubrique");
assert.equal(rubriqueDeVue("builder"), rubriqueDeVue("roster"),
  "creer une equipe et les equipes partagees vivent dans Equipes");
assert.equal(rubriqueDeVue("availability"), rubriqueDeVue("boss"),
  "les dispos et les groupes vivent dans le centre Boss");
assert.notEqual(rubriqueDeVue("roster"), rubriqueDeVue("member-roster"),
  "les equipes partagees ne sont pas le roster personnel");
["wiki", "collection", "calculateur", "analyse"].forEach(vue => {
  assert.equal(rubriqueDeVue(vue), rubriqueDeVue("wiki"),
    `${vue} doit vivre dans Outils`);
});

/* LA VUE CHEF SUIT LES DROITS. « Notre guilde » montre l'accueil public a un
   visiteur, et Mon suivi a un membre : c'est `chefConnecte` qui le dit, et le
   portier passe par l'appelant qui tranche. */
const guilde = rubriqueDeVue("home");
assert.equal(vueChefDeRubrique(guilde), "home",
  "sans portier, la vue chef ordinaire est rendue");
assert.equal(vueChefDeRubrique(guilde, () => false), "home",
  "un visiteur sans droit sur Mon suivi reste sur l'accueil");
assert.equal(vueChefDeRubrique(guilde, vue => vue === "dashboard"), "dashboard",
  "un membre qui a droit a Mon suivi y arrive directement");
/* Une rubrique sans `chefConnecte` ne change jamais de vue chef, quoi que
   reponde le portier. */
assert.equal(vueChefDeRubrique(rubriqueDeVue("wiki"), () => true), "wiki");

/* Une rubrique sans onglet local rend une liste vide, jamais `undefined` :
   la coquille boucle dessus sans avoir a se demander si elle existe. */
assert.deepEqual(plain(ongletsDeRubrique(rubriqueDeVue("member-roster"))), []);
assert.deepEqual(plain(ongletsDeRubrique("rubrique-qui-n-existe-pas")), []);
assert.equal(rubriqueDeVue("vue-qui-n-existe-pas"), null);
assert.equal(rubriqueParId("rubrique-qui-n-existe-pas"), null);
assert.equal(vueChefDeRubrique("rubrique-qui-n-existe-pas"), null);

/* Les onglets d'Outils suivent l'ordre de la maquette. */
assert.deepEqual(
  plain(ongletsDeRubrique(rubriqueDeVue("wiki"))).map(onglet => onglet.vue),
  ["wiki", "collection", "calculateur", "analyse"]);

console.log("rubriques.test.js OK");
