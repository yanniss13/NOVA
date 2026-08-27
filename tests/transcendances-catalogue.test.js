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
const gravees = charger("stats-build.js", "SEVEN_DS_BUILD_STATS").engravedByFile;

/* Les cibles que le moteur DPS sait appliquer. Derivees de dps-simulation.js
   (CATEGORIE_DPS) et des regles deja ecrites : une cible hors de cette liste
   serait publiee sans jamais etre comptee. */
const CIBLES = new Set(["normal", "normal-skill", "special", "ultimate", "tag-skill"]);
let regles = 0;

/* Les tenues deja reclamees, pour prouver qu'aucune n'en porte deux. */
const tenuesVues = new Map();

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

    /* LA TENUE QUI LA PORTE.

       Une transcendance n'est active que si sa tenue gravee est portee. Sans
       ce lien elle ne peut pas entrer dans le calcul, et le catalogue
       retombe au rang de texte a lire. Le rapprochement se fait par
       identifiants (costume -> equipement -> LimitBreak_Passive), jamais par
       nom : deux heros partagent « Sortie decontractee ». */
    const tenue = gravees[entree.tenue];
    assert.ok(tenue,
      slug + " : tenue inconnue de engravedByFile — « " + entree.tenue + " »");
    assert.equal(tenue.character, slug,
      entree.id + " : rattachee a une tenue de " + tenue.character);
    assert.equal(entree.promotion, 3,
      entree.id + " : palier de promotion inattendu (" + entree.promotion + ")");

    /* Une tenue ne donne qu'une transcendance. Si deux la reclamaient, le
       rapprochement se serait effondre quelque part en amont — et le calcul
       compterait deux fois le meme bonus. */
    const dejaVue = tenuesVues.get(entree.tenue);
    assert.ok(!dejaVue,
      entree.tenue + " : reclamee par " + entree.id + " ET par " + dejaVue);
    tenuesVues.set(entree.tenue, entree.id);

    /* LA REGLE DE TRANSCRIPTION, celle de data/passifs-graves.js.

       Le jeu ne publie pas la statistique touchee — elle se deduit de la
       phrase francaise, et c'est la seule interpretation du catalogue. On
       verifie donc que la valeur stockee est bien LE NOMBRE QUI SUIT
       IMMEDIATEMENT la phrase citee, et que cette phrase ouvre le texte.
       Sans ce controle, rien n'empecherait d'attribuer a un effet la valeur
       d'un autre. */
    if(entree.regle){
      regles++;
      assert.ok(CIBLES.has(entree.regle.cible),
        entree.id + " : cible « " + entree.regle.cible + " » inconnue du moteur");
      assert.ok(entree.texte.startsWith(entree.regle.phrase),
        entree.id + " : le texte ne commence pas par la phrase citee");
      const apres = entree.texte.slice(entree.regle.phrase.length);
      const nombre = apres.match(/^(\d+(?:[.,]\d+)?)%/);
      assert.ok(nombre,
        entree.id + " : aucun pourcentage apres la phrase — « " + apres + " »");
      assert.equal(
        entree.regle.valeur,
        Math.round(parseFloat(nombre[1].replace(",", ".")) * 100),
        entree.id + " : la valeur stockee ne suit pas la phrase citee"
      );
    }else{
      /* Pas de regle : ce doit etre un effet d'equipe ou un debuff de cible,
         hors perimetre du comparateur. Un bonus au heros SANS regle serait un
         oubli silencieux — exactement ce que ce test existe pour attraper. */
      assert.match(entree.texte, /héros alliés|de l'équipe|tous les héros|ennemi|cible|subis/,
        entree.id + " : bonus au heros sans regle DPS — « " + entree.texte + " »");
    }
  });

  /* Trois transcendances distinctes, pas la meme recopiee : plusieurs heros en
     ont deux qui portent le MEME nom (Bug a deux « Frappe lourde »), donc
     c'est l'identifiant qui doit differer, pas le libelle. */
  const ids = new Set(liste.map(entree => entree.id));
  assert.equal(ids.size, 3, slug + " : trois identifiants distincts attendus");
});

assert.equal(total, 78, "78 transcendances attendues, recu : " + total);

/* 30 regles sur 78 : le reste vise l'equipe (43) ou la cible (5). Si ce
   compte baisse, une phrase du jeu a change de tournure et un bonus est
   passe a la trappe sans bruit. */
assert.equal(regles, 30,
  "30 transcendances doivent porter une regle DPS, recu : " + regles);

/* 93 tenues gravees, 78 transcendables : les 15 restantes sont les quatriemes
   tenues des heros qui en ont quatre. Le compte se ferme, donc aucune n'a ete
   perdue en route. */
assert.equal(tenuesVues.size, 78,
  "78 tenues distinctes attendues, recu : " + tenuesVues.size);
const sansTranscendance = Object.keys(gravees).length - tenuesVues.size;
assert.equal(sansTranscendance, 15,
  "15 tenues gravees sans transcendance attendues, recu : " + sansTranscendance);

/* Khala est dans les tables du jeu mais n'a aucune transcendance, aucune image
   et pas de cle de competence : elle n'est pas sortie. Sa presence ici
   signalerait qu'elle vient d'arriver — et qu'il faut la traiter partout. */
assert.ok(!table["calla"] && !table["khala"],
  "Khala n'est pas encore dans le jeu : sa presence demande une passe complete");

console.log(
  "transcendances-catalogue.test.js OK ("
  + slugs.length + " heros, " + total + " transcendances)"
);
