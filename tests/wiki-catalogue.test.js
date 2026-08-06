"use strict";

/* Le catalogue commité du wiki : ce test est le garde-fou qui criera le jour
   où le jeu ajoutera un héros sans qu'on regénère.

   Il lit le fichier réel, pas un échantillon : c'est le seul contrôle qui
   voit un catalogue périmé. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RACINE = path.join(__dirname, "..");

const contexte = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(RACINE, "data", "wiki-competences.js"), "utf8"),
  contexte,
  { filename:"wiki-competences.js" }
);
const catalogue = contexte.window.SEVEN_DS_WIKI_COMPETENCES;

const personnages = JSON.parse(
  fs.readFileSync(path.join(RACINE, "7ds-stats", "personnages.json"), "utf8")
);
const slugs = personnages.map(p => p.slug);

assert.deepEqual(
  Object.keys(catalogue).sort(),
  [...slugs].sort(),
  "le catalogue doit couvrir exactement les personnages de 7ds-stats"
);

slugs.forEach(slug => {
  const competences = catalogue[slug];
  assert.ok(competences.length, slug+" : catalogue vide");

  const parArme = {};
  competences.forEach(competence => {
    (parArme[competence.weaponType] = parArme[competence.weaponType] || [])
      .push(competence);
  });
  assert.equal(
    Object.keys(parArme).length, 3,
    slug+" : trois types d'arme attendus, reçu "+Object.keys(parArme).length
  );

  Object.entries(parArme).forEach(([arme, liste]) => {
    assert.ok(
      liste.some(competence => competence.categorie === "PASSIVE"),
      slug+"/"+arme+" : aucun passif"
    );
  });

  competences.forEach(competence => {
    assert.ok(competence.nomFr, slug+" : nom absent ("+competence.gameId+")");
    assert.ok(
      competence.descriptionFr,
      slug+" : description absente ("+competence.gameId+")"
    );
    assert.ok(
      competence.recharge === null || typeof competence.recharge === "number",
      slug+" : recharge ni nombre ni null ("+competence.gameId+")"
    );
  });
});

/* Chaque icône citée doit exister en local : sans ce contrôle, une fiche
   afficherait des cadres vides et aucun test ne le verrait. */
const iconesCitees = new Set();
Object.values(catalogue).forEach(liste => {
  liste.forEach(competence => {
    assert.ok(
      competence.icone,
      "icône absente pour "+competence.gameId
    );
    iconesCitees.add(competence.icone);
  });
});
const dossierIcones = path.join(RACINE, "7ds-ui", "skills");
const iconesLocales = new Set(fs.readdirSync(dossierIcones));
const manquantes = [...iconesCitees].filter(nom => !iconesLocales.has(nom));
assert.deepEqual(
  manquantes, [],
  "icônes citées mais absentes de 7ds-ui/skills : "+manquantes.join(", ")
);

console.log(
  "PASS wiki : catalogue cohérent ("+slugs.length+" personnages, "
  + Object.values(catalogue).reduce((total, l) => total + l.length, 0)
  + " compétences)"
);
