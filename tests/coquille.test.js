"use strict";

/* LE CONTRAT DE LA COQUILLE, lu dans index.html.

   La coquille se construit en JavaScript depuis la table des rubriques, mais
   elle a besoin de points d'accroche ecrits dans le fichier : sans eux, la
   construction s'arrete en silence et la page s'affiche sans navigation.

   Ce test verifie donc trois choses :

   1. les accroches existent ;
   2. l'ancienne coquille a disparu en entier — un reste de balisage sans CSS
      ni JS derriere ne se voit pas en test unitaire, mais s'affiche a l'ecran ;
   3. chaque vue de la table a sa section, et se nomme par un titre qui existe
      vraiment. Un `aria-labelledby` qui pointe dans le vide ne fait echouer
      aucun test de comportement. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadApp, plain } = require("./helpers/load-app");

const RACINE = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");

const { hooks } = loadApp();
const RUBRIQUES = plain(hooks.RUBRIQUES);

/* ---------- 1. Les accroches ---------- */

const ACCROCHES = [
  ['<a class="skip-link" href="#main">', "le lien d'evitement"],
  ['<header class="app-header">', "l'en-tete"],
  ['id="desktopNav"', "la navigation de bureau"],
  ['id="accountLogin"', "le bouton de connexion"],
  ['id="accountConnected"', "le bloc du compte ouvert"],
  ['id="accountMenu"', "le menu du compte"],
  ['id="liveStatus"', "le temoin de synchronisation"],
  ['id="mobileDrawer"', "le tiroir mobile"],
  ['id="localTabsBar"', "la barre des onglets locaux"],
  ['id="localTabs"', "la liste des onglets locaux"],
  ['<main id="main" tabindex="-1">', "la cible du lien d'evitement"],
  ['<footer class="site-footer">', "le pied de page"],
  ['id="mobileNav"', "la barre du pouce"]
];
ACCROCHES.forEach(([marqueur, quoi]) => {
  assert.ok(html.includes(marqueur), `accroche absente : ${quoi} (${marqueur})`);
});

/* Le lien affilie descend au pied de page, mais garde ce qui le rend legal :
   `sponsored` declare la remuneration, `noopener` protege la page ouvrante. */
const lootbar = html.match(/<a class="lootbar"[\s\S]{0,400}?<\/a>/);
assert.ok(lootbar, "le lien LootBar doit exister");
assert.match(lootbar[0], /rel="sponsored noopener noreferrer"/,
  "le lien LootBar doit rester declare comme remunere");
assert.ok(html.indexOf('<a class="lootbar"') > html.indexOf("<footer"),
  "le lien LootBar doit vivre dans le pied de page");

/* ---------- 2. L'ancienne coquille ---------- */

/* Ces marqueurs n'ont plus ni CSS ni JavaScript derriere eux. Un seul qui
   survit, c'est un bouton mort a l'ecran, et rien pour le signaler. */
const DISPARUS = [
  "topbar", "tabs-rail", "tabs-cue", "subtabs", "mobile-more",
  "mobile-nav-item", "mobile-boss-subnav", "mobileAccount", "mobileAuth",
  "mobileLiveStatus", "mobileBtnMigrateLocal", 'id="tab-', "brand-txt",
  "brand-title", "brand-sub", 'class="crest"', "has-mobile-subnav"
];
DISPARUS.forEach(marqueur => {
  assert.ok(!html.includes(marqueur),
    `reste de l'ancienne coquille dans index.html : ${marqueur}`);
});

/* ---------- 3. Les vues ---------- */

const identifiants = new Set(
  [...html.matchAll(/\sid="([^"]+)"/g)].map(trouve => trouve[1]));

RUBRIQUES.flatMap(rubrique => rubrique.vues).forEach(vue => {
  const section = html.match(
    new RegExp(`<section id="view-${vue}"[\\s\\S]{0,200}?>`));
  assert.ok(section, `vue sans section dans index.html : ${vue}`);
  const nomme = section[0].match(/aria-labelledby="([^"]+)"/);
  assert.ok(nomme, `la vue ${vue} ne se nomme pas`);
  assert.ok(identifiants.has(nomme[1]),
    `la vue ${vue} se nomme par « ${nomme[1] } », qui n'existe pas`);
});

/* Une seule vue est ouverte au chargement, et c'est l'accueil : deux vues
   « active » s'empileraient l'une sous l'autre. */
const ouvertes = [...html.matchAll(/<section id="view-([^"]+)" class="view active"/g)]
  .map(trouve => trouve[1]);
assert.deepEqual(ouvertes, ["home"],
  "l'accueil, et lui seul, doit etre ouvert au chargement");

/* ---------- 4. Pas d'entree orpheline ---------- */

/* Un `data-rubrique` ecrit a la main et absent de la table serait un bouton
   qui n'ouvre rien. Le seul autorise hors table est celui de la marque, qui
   ramene a l'accueil. */
const connues = new Set(RUBRIQUES.map(rubrique => rubrique.id));
[...html.matchAll(/data-rubrique="([^"]+)"/g)].forEach(trouve => {
  assert.ok(connues.has(trouve[1]),
    `data-rubrique inconnu de la table : ${trouve[1]}`);
});

/* Idem pour les vues citees en dur dans l'accueil. */
const vuesConnues = new Set(RUBRIQUES.flatMap(rubrique => rubrique.vues));
[...html.matchAll(/data-view="([^"]+)"/g)].forEach(trouve => {
  assert.ok(vuesConnues.has(trouve[1]),
    `data-view inconnu de la table : ${trouve[1]}`);
});

console.log("coquille.test.js OK (" + RUBRIQUES.length + " rubriques, "
  + [...vuesConnues].length + " vues)");
