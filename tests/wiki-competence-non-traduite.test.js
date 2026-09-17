"use strict";

/* Une competence que le jeu ne traduit pas ne doit pas s'afficher vide.

   `calla_gauntlets_skill_e` (« Crochet explosif ») n'a ni texte francais ni
   texte anglais dans l'export du jeu. Le catalogue le DIT — `localisation`
   porte un statut et sa raison — mais la fiche rendait quand meme un
   paragraphe vide : le membre voyait une competence nommee, avec sa recharge,
   et rien dessous. Rien ne distinguait ce trou d'un bug du site.

   Le libelle se decide sur la COUVERTURE declaree, jamais sur le slug de la
   competence ni sur le heros : le jour ou le jeu publiera ce texte, la note
   disparaitra d'elle-meme. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { couvertureTexteCompetence } = hooks;

assert.equal(
  typeof couvertureTexteCompetence,
  "function",
  "la fiche wiki doit savoir dire pourquoi une description manque"
);

assert.equal(
  couvertureTexteCompetence({ descriptionFr:"Inflige des degats.",
    localisation:{ status:"resolved", reason:null } }),
  null,
  "une localisation resolue ne porte aucune note"
);
assert.equal(
  couvertureTexteCompetence({ descriptionFr:"Inflige des degats." }),
  null,
  "une competence sans champ de couverture ne porte aucune note"
);

const note = couvertureTexteCompetence({
  descriptionFr:null,
  localisation:{ status:"missing-from-export",
    reason:"localisation non couverte par l'export" }
});
assert.equal(typeof note, "string", "une couverture manquante doit se dire");
assert.ok(note.length > 10, "la note doit etre une phrase, pas un code");
assert.doesNotMatch(note, /calla|khala|gauntlets/i,
  "la note se decide sur la couverture, jamais sur le heros ni le slug");

/* Le catalogue commite doit rester la seule source de cette situation : si
   une autre competence perdait sa traduction, elle recevrait la meme note. */
const contexte = { window:{} };
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, "..", "data", "wiki-competences.js"), "utf8"
  ),
  contexte,
  { filename:"wiki-competences.js" }
);
const catalogue = contexte.window.SEVEN_DS_WIKI_COMPETENCES;
const sansTexte = Object.values(catalogue)
  .flat()
  .filter(competence => !competence.descriptionFr);
assert.ok(sansTexte.length > 0, "le cas doit exister dans le catalogue reel");
sansTexte.forEach(competence => {
  assert.ok(
    couvertureTexteCompetence(competence),
    "description absente sans note : " + competence.gameId
  );
});

console.log("wiki-competence-non-traduite : ok");
