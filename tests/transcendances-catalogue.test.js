"use strict";

/* Les transcendances commitees, lues comme le navigateur les lit : un simple
   fichier de donnees, sans reseau.

   Ce test compte, mais surtout il traque L'ERREUR MUETTE de cette table. Les
   descriptions du jeu sont des gabarits — « Augmente les degats de {0} » — et
   les nombres vivent a cote, dans `Local_Replace`. Une substitution manquee ne
   casse rien : elle publie « de {0} » sur la fiche du heros, et personne ne
   s'en apercoit avant qu'un membre le signale. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");

function charger(fichier, cle){
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
  );
  return bac.window[cle];
}

const table = charger("transcendances.js", "SEVEN_DS_TRANSCENDANCES");
const meta = charger("personnages-meta.js", "SEVEN_DS_META");

assert.ok(table, "Les transcendances doivent s'exposer sur window");

const slugs = Object.keys(table);
assert.equal(slugs.length, 26,
  "26 heros ont des transcendances, recu : " + slugs.length);

/* Un slug inconnu du site serait publie sans jamais s'afficher : la fiche du
   wiki cherche par slug, et ne trouverait rien. */
slugs.forEach(slug => {
  assert.ok(meta[slug],
    slug + " n'est pas un personnage du site — slug ou alias a corriger");
});

let total = 0;
slugs.forEach(slug => {
  const liste = table[slug];
  assert.ok(Array.isArray(liste), slug + " : la valeur doit etre une liste");
  assert.equal(liste.length, 3,
    slug + " : trois transcendances attendues, recu " + liste.length);

  liste.forEach(entree => {
    total++;
    ["id", "nom", "texte"].forEach(champ => {
      assert.ok(
        typeof entree[champ] === "string" && entree[champ].trim(),
        slug + " : le champ " + champ + " est vide"
      );
    });

    /* Le suffixe porte l'ordre d'affichage. La serie commence a _b : _a
       n'existe pas dans le jeu, et l'attendre ferait echouer a tort. */
    assert.match(entree.id, /^eplb_[a-z0-9]+_[bcd]$/,
      slug + " : identifiant inattendu, recu " + entree.id);

    /* LE point de ce test. */
    assert.doesNotMatch(entree.texte, /\{\d+\}/,
      slug + " : substitution manquee dans « " + entree.texte + " »");
    assert.doesNotMatch(entree.nom, /\{\d+\}/,
      slug + " : substitution manquee dans le nom « " + entree.nom + " »");

    /* Les balises de couleur du jeu ne veulent rien dire hors de son
       interface : les laisser afficherait « [#1A7331]50%[-] » au membre. */
    assert.doesNotMatch(entree.texte, /\[#?[-0-9A-Fa-f]*\]/,
      slug + " : balise de couleur du jeu laissee dans « " + entree.texte + " »");
  });

  /* Trois transcendances distinctes, pas la meme recopiee : plusieurs heros en
     ont deux qui portent le MEME nom (Bug a deux « Frappe lourde »), donc
     c'est l'identifiant qui doit differer, pas le libelle. */
  const ids = new Set(liste.map(entree => entree.id));
  assert.equal(ids.size, 3, slug + " : trois identifiants distincts attendus");
});

assert.equal(total, 78, "78 transcendances attendues, recu : " + total);

/* Khala est dans les tables du jeu mais n'a aucune transcendance, aucune image
   et pas de cle de competence : elle n'est pas sortie. Sa presence ici
   signalerait qu'elle vient d'arriver — et qu'il faut la traiter partout. */
assert.ok(!table["calla"] && !table["khala"],
  "Khala n'est pas encore dans le jeu : sa presence demande une passe complete");

console.log(
  "transcendances-catalogue.test.js OK ("
  + slugs.length + " heros, " + total + " transcendances)"
);
