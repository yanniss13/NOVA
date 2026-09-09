"use strict";

/* Le catalogue des compétences combinées, lu comme le navigateur : un simple
   fichier de données, sans réseau. Il ne re-extrait RIEN — l'outil dépend d'un
   chemin local hors dépôt, et `npm test` ne doit pas en dépendre. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "ultimes-combines.js"), "utf8"),
  bac
);
const catalogue = bac.window.SEVEN_DS_ULTIMES_COMBINES;

assert.ok(Array.isArray(catalogue), "le catalogue doit être un tableau");
assert.ok(
  catalogue.length >= 600,
  "catalogue anormalement maigre, reçu : " + catalogue.length
);

const IDENTIFIANT = /^[a-z0-9]+(_[a-z0-9]+)+$/;
catalogue.forEach(entree => {
  assert.match(
    entree.lanceur, IDENTIFIANT,
    "lanceur mal formé : " + entree.lanceur
  );
  assert.ok(
    Array.isArray(entree.partenaires) && entree.partenaires.length >= 1
      && entree.partenaires.length <= 2,
    "une combinaison porte un ou deux partenaires : " + entree.lanceur
  );
  entree.partenaires.forEach(partenaire => {
    assert.match(partenaire, IDENTIFIANT, "partenaire mal formé : " + partenaire);
    assert.notEqual(partenaire, "None", "un None a survécu au filtre");
    assert.notEqual(
      partenaire, entree.lanceur,
      "un héros ne se combine pas avec lui-même : " + entree.lanceur
    );
  });
});

/* LE FAIT QUI FONDE TOUTE LA FONCTIONNALITÉ, et qu'on refuse de perdre.

   L'appariement se fait par compétence, donc par ARME. Les combinaisons de Ban
   sont toutes aux gantelets : un Ban au nunchaku n'en lance aucune. Une liste
   de héros écrite à la main aurait laissé composer une rotation impossible. */
const lanceursDeBan = new Set(
  catalogue.filter(c => c.lanceur.startsWith("ban_")).map(c => c.lanceur)
);
assert.deepEqual(
  [...lanceursDeBan], ["ban_gauntlets_skill_r"],
  "Ban ne lance de combinaison qu'aux gantelets, reçu : " + [...lanceursDeBan]
);

/* CHAQUE PORTEUR N'A QU'UNE COMPÉTENCE DE LANCEMENT.

   Un « porteur » est un couple (héros, arme) : l'ultime combiné dépend de
   l'arme, pas seulement du personnage. Vingt-quatre porteurs, vingt-quatre
   compétences de lancement — aucun n'en a deux.

   Ce test remplace une assertion périmée qui comptait « les héros dont
   l'identifiant finit par _skill_r ». Ce suffixe ne veut rien dire : c'est un
   artefact de nommage, pas une catégorie. Le bloc suivant le démontre. */
const parPorteur = new Map();
catalogue.forEach(entree => {
  const segments = entree.lanceur.split("_");
  const porteur = segments.slice(0, -2).join("_");
  if(!parPorteur.has(porteur)) parPorteur.set(porteur, new Set());
  parPorteur.get(porteur).add(entree.lanceur);
});
const ambigus = [...parPorteur]
  .filter(([, lancements]) => lancements.size > 1)
  .map(([porteur, lancements]) => porteur + " -> " + [...lancements].join(", "));
assert.deepEqual(
  ambigus, [],
  "un porteur ne lance que d'UNE compétence, reçu : " + ambigus.join(" | ")
);
assert.ok(
  parPorteur.size >= 20,
  "le catalogue doit couvrir les porteurs du jeu, reçu : " + parPorteur.size
);


/* TOUTES LES COMPÉTENCES D'UNE COMBINAISON SONT DES ULTIMES.

   C'est LE fait qui nomme cette fonctionnalité, et il n'était pas évident : le
   suffixe de l'identifiant ne dit PAS la catégorie. L'ultime de Tristan
   s'appelle `tristan_sworddual_skill_q` et sa spéciale `..._skill_rmb` ;
   `tristan_sworddual_skill_r` n'existe pas. Chez Ban c'est l'inverse.

   Une lecture du seul suffixe a fait inventer deux fois une mécanique qui
   n'existe pas — « spéciales combinées », puis « une touche par héros ». Il
   n'y a qu'un ultime combiné, déclenché par une seule touche.

   Ce test croise le catalogue avec `wiki-competences.js`, qui porte la
   catégorie PUBLIÉE. Hors ligne, sans l'export du jeu, et il tombera le jour
   où le jeu ajouterait une combinaison d'un autre type. */
{
  const bacWiki = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", "wiki-competences.js"), "utf8"),
    bacWiki
  );
  const categorie = new Map();
  Object.values(bacWiki.window.SEVEN_DS_WIKI_COMPETENCES || {})
    .forEach(liste => (liste || []).forEach(
      competence => categorie.set(competence.gameId, competence.categorie)
    ));

  const identifiants = new Set();
  catalogue.forEach(entree => {
    identifiants.add(entree.lanceur);
    entree.partenaires.forEach(partenaire => identifiants.add(partenaire));
  });

  const intrus = [...identifiants]
    .filter(id => categorie.get(id) !== "ULTIMATE")
    .map(id => id + " = " + (categorie.get(id) || "absent du wiki"));
  assert.deepEqual(
    intrus, [],
    "une combinaison n'engage que des ULTIMES, reçu : " + intrus.join(", ")
  );
  assert.ok(
    identifiants.size >= 20,
    "le croisement doit porter sur tout le catalogue, reçu : " + identifiants.size
  );
}

console.log(
  "ultimes-combines : catalogue cohérent (" + catalogue.length
  + " combinaisons, dont "
  + catalogue.filter(c => c.partenaires.length === 2).length + " à trois héros)"
);
