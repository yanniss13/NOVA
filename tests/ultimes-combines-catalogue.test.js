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
const provenance = bac.window.SEVEN_DS_ULTIMES_COMBINES_PROVENANCE;

assert.ok(Array.isArray(catalogue), "le catalogue doit être un tableau");

/* LE PLANCHER : CE QUE LA TABLE DU JEU CONTENAIT À L'EXTRACTION.

   Les assertions qui suivent ne savent dire que « rien de faux », jamais
   « rien ne manque » : un catalogue tronqué à une ligne les passerait toutes.
   Un plancher écrit ici à la main (« au moins 600 ») périme au premier build
   qui bouge — c'est pour ça que les précédents ont été supprimés.

   Le générateur écrit donc son propre recensement à côté des données, et le
   test compare les deux. Le plancher se régénère avec le catalogue : il ne
   peut pas se démoder, et il tombe dès que le fichier perd des lignes. */
assert.ok(
  provenance && typeof provenance === "object",
  "data/ultimes-combines.js doit publier sa provenance ; regénérer avec "
    + "node outils/fabrication/ecrire-ultimes-combines.js"
);
assert.equal(
  provenance.source, "Table/Skill/CombineSkillTable",
  "provenance : source inattendue, reçue : " + provenance.source
);
assert.ok(
  Number.isInteger(provenance.lignesLues) && provenance.lignesLues > 0,
  "provenance : nombre de lignes lues absent ou nul"
);
assert.ok(
  provenance.lignesRetenues <= provenance.lignesLues,
  "provenance incohérente : " + provenance.lignesRetenues + " retenues sur "
    + provenance.lignesLues + " lues"
);
assert.equal(
  catalogue.length, provenance.lignesRetenues,
  "le catalogue a perdu des lignes : " + catalogue.length + " entrées pour "
    + provenance.lignesRetenues + " retenues à l'extraction"
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

/* CHAQUE PORTEUR N'A QU'UNE COMPÉTENCE DE LANCEMENT, ET AUCUN NE MANQUE.

   Un « porteur » est un couple (héros, arme) : l'ultime combiné dépend de
   l'arme, pas seulement du personnage. Autant de porteurs que de compétences
   de lancement — aucun n'en a deux — et leur nombre est celui que la table du
   jeu nommait à l'extraction, pas un chiffre recopié ici.

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
const lanceurs = new Set(catalogue.map(entree => entree.lanceur));
assert.equal(
  parPorteur.size, lanceurs.size,
  "un porteur pour une compétence de lancement, reçu : " + parPorteur.size
    + " porteurs pour " + lanceurs.size + " compétences"
);
assert.equal(
  lanceurs.size, provenance.lanceurs,
  "le catalogue a perdu des lanceurs : " + lanceurs.size + " pour "
    + provenance.lanceurs + " relevés à l'extraction"
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
  const competencesPosables = new Set();
  Object.values(bacWiki.window.SEVEN_DS_WIKI_COMPETENCES || {})
    .forEach(liste => (liste || []).forEach(competence => {
      categorie.set(competence.gameId, competence.categorie);
      if(competence.categorie !== "PASSIVE"){
        competencesPosables.add(competence.gameId);
      }
    }));

  const identifiants = new Set();
  catalogue.forEach(entree => {
    identifiants.add(entree.lanceur);
    entree.partenaires.forEach(partenaire => identifiants.add(partenaire));
  });

  const horsWiki = [...identifiants]
    .filter(id => !competencesPosables.has(id));
  assert.deepEqual(
    horsWiki, [],
    "les cles de combinaison doivent appartenir aux competences posables du Wiki : "
      + horsWiki.join(", ")
  );

  const intrus = [...identifiants]
    .filter(id => categorie.get(id) !== "ULTIMATE")
    .map(id => id + " = " + (categorie.get(id) || "absent du wiki"));
  assert.deepEqual(
    intrus, [],
    "une combinaison n'engage que des ULTIMES, reçu : " + intrus.join(", ")
  );

  /* LE RECENSEMENT DE LA TABLE, tenu à côté du catalogue et pas dedans.

     `provenance.competences` liste toutes les compétences que
     `CombineSkillTable` nommait — lanceurs et partenaires confondus. Le
     catalogue doit les citer toutes, et n'en citer aucune autre. C'est ce qui
     tombe si une extraction rate une partie de la table, ou si le fichier de
     données est tronqué. */
  const recensees = new Set(provenance.competences || []);
  const oubliees = [...recensees].filter(id => !identifiants.has(id)).sort();
  assert.deepEqual(
    oubliees, [],
    "des compétences relevées dans la table ont disparu du catalogue : "
      + oubliees.join(", ")
  );
  const inventees = [...identifiants].filter(id => !recensees.has(id)).sort();
  assert.deepEqual(
    inventees, [],
    "le catalogue cite des compétences absentes du relevé : "
      + inventees.join(", ")
  );

  /* LE PLANCHER TIRÉ DU WIKI, qui ne dépend ni de l'export ni du relevé.

     La description PUBLIÉE d'un ultime dit quand il sert de BASE à une attaque
     combinée. Tout ultime qui l'annonce doit lancer au moins une combinaison,
     sinon le catalogue ment par omission. Ce plancher se recompte à chaque
     exécution depuis `wiki-competences.js` : il ne périme pas, et il vaut même
     si la provenance disparaissait. */
  const BASE_DE_COMBINAISON =
    "attaque combinée avec l'attaque ultime du héros en tant que base";
  const basesPubliees = [];
  Object.values(bacWiki.window.SEVEN_DS_WIKI_COMPETENCES || {})
    .forEach(liste => (liste || []).forEach(competence => {
      if(competence.categorie === "ULTIMATE"
        && String(competence.descriptionFr || "").includes(BASE_DE_COMBINAISON)){
        basesPubliees.push(competence.gameId);
      }
    }));
  assert.ok(
    basesPubliees.length > 0,
    "le Wiki doit nommer des ultimes servant de base à une attaque combinée ; "
      + "zéro trouvé, la phrase repère a dû changer de traduction"
  );
  const muets = basesPubliees.filter(id => !lanceurs.has(id)).sort();
  assert.deepEqual(
    muets, [],
    "le Wiki annonce ces ultimes comme base d'attaque combinée, le catalogue "
      + "ne leur en fait lancer aucune : " + muets.join(", ")
  );

  /* LA CONTRE-ÉPREUVE KHALA, vérifiable hors ligne.

     Le catalogue est identique, octet pour octet, à celui d'avant Khala. Sans
     relevé, rien ne distinguerait « le jeu ne publie aucune combinaison pour
     elle » de « le générateur n'a jamais tourné sur un build qui la
     contient ». Le recensement tranche : il dit ce que la table nommait, et
     aucune compétence de Khala — `calla` dans les données du jeu — n'y est.

     Les deux assertions se répondent : la table n'en parle pas, et le
     catalogue ne lui en invente pas. */
  const khalaRelevee = [...recensees].filter(id => id.startsWith("calla_"));
  assert.deepEqual(
    khalaRelevee, [],
    "le relevé de CombineSkillTable nomme des compétences de Khala : "
      + khalaRelevee.join(", ")
  );
  const khala = bacWiki.window.SEVEN_DS_WIKI_COMPETENCES.khala
    .filter(skill => skill.categorie !== "PASSIVE");
  const combinaisonsKhala = khala
    .filter(skill => identifiants.has(skill.gameId))
    .map(skill => skill.gameId);
  assert.deepEqual(
    Array.from(combinaisonsKhala), [],
    "Khala ne figure pas dans CombineSkillTable (" + provenance.lignesLues
      + " lignes relevées le " + provenance.exporteLe
      + ") et ne doit pas avoir de combinaison inventée : "
      + combinaisonsKhala.join(", ")
  );
}

console.log(
  "ultimes-combines : catalogue cohérent (" + catalogue.length
  + " combinaisons, dont "
  + catalogue.filter(c => c.partenaires.length === 2).length + " à trois héros)"
  + " — relevé : " + provenance.lignesLues + " lignes, "
  + provenance.lanceurs + " lanceurs, aucune de Khala"
);
