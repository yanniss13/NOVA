"use strict";

/* Lanceur de la suite de tests.

   La suite vivait comme une chaine de 63 `&&` dans package.json. Un echec au
   troisieme parcours arretait tout : l'etat des soixante commandes suivantes
   restait inconnu, et il fallait corriger puis relancer trois minutes pour le
   decouvrir. Ce lanceur les execute toutes, laisse la sortie s'afficher en
   direct, et rend un recapitulatif ou l'on lit d'un coup ce qui casse.

   Usage :
     node scripts/lancer-tests.js              les deux suites
     node scripts/lancer-tests.js unit         les tests unitaires seuls
     node scripts/lancer-tests.js e2e          les parcours navigateur seuls
     node scripts/lancer-tests.js --bail       arret a la premiere panne
     node scripts/lancer-tests.js -f routage   ne garde que les noms filtres

   Les commandes restent sequentielles : les parcours Playwright ouvrent chacun
   un serveur et un navigateur, les paralleliser rendrait les pannes illisibles
   et les temps ininterpretables. */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");

const SUITES = {
  unit: [
    "node tests/serve.test.js",
    "node tests/social-preview.test.js",
    "node tests/modules-imports.test.js",
    "node tests/imports-resolus.test.js",
    "node tests/css-ordre.test.js",
    "python -m unittest tests/test_schema_sql.py",
    "python -m unittest tests/test_generate_stats_build.py",
    "python scripts/generate-stats-build.py --check",
    "node tests/pages-workflow.test.js",
    "node tests/mon-suivi.test.js",
    "node tests/accueil.test.js",
    "node tests/roster-schema.test.js",
    "node tests/collection-schema.test.js",
    "node tests/animation-measures-schema.test.js",
    "node tests/presets-schema.test.js",
    "node tests/comptes-invites-schema.test.js",
    "node tests/comptes-invites.test.js",
    "node tests/invites-hors-donnees.test.js",
    "node tests/filtre-equipes-par-joueur.test.js",
    "node tests/roster-affichage-instantane.test.js",
    "node tests/vendor-tesseract.test.js",
    "node tests/ocr-panneau.test.js",
    "node tests/ocr-enchantements.test.js",
    "node tests/ocr-deduction.test.js",
    "node tests/ocr-deduction-piece.test.js",
    "node tests/ocr-arme.test.js",
    "node tests/lecture-assistee.test.js",
    "node tests/import-captures-roster.test.js",
    "node tests/stats-build-catalog.test.js",
    "node tests/stats-build-schema.test.js",
    "node tests/availability-schema.test.js",
    "node tests/availability.test.js",
    "node tests/recommandation-groupes.test.js",
    "node tests/boss-reports-schema.test.js",
    "node tests/boss-admin-schema.test.js",
    "node tests/boss-correction-schema.test.js",
    "node --test tests/boss-account-retention.test.js",
    "node tests/pwa.test.js",
    "node tests/reminder.test.js",
    "node tests/discord-planning.test.js",
    "python -m unittest tests/test_generate_armures_liees.py",
    "python -m unittest tests/test_generate_stats.py",
    "python -m unittest tests/test_generate_wiki.py",
    "python scripts/generate-wiki.py --check",
    "python -m unittest tests/test_generate_competences.py",
    "python -m unittest tests/test_rapatrier_mesures.py",
    "python scripts/generate-competences.py --check",
    "python -m unittest tests/test_generate_effets_dps.py",
    "python scripts/generate-effets-dps.py --check",
    "node tests/wiki-catalogue.test.js",
    "node tests/wiki-competences.test.js",
    "node tests/wiki-equipement.test.js",
    "node tests/competences-catalogue.test.js",
    "node tests/transcendances-catalogue.test.js",
    "node tests/badges-role-element.test.js",
    "node tests/degats-calcul.test.js",
    "node tests/effets-dps-catalogue.test.js",
    "node tests/dps-effets.test.js",
    "node tests/dps-simulation.test.js",
    "node tests/dps-merlin.test.js",
    "node tests/fiche-heros.test.js",
    "node tests/chrono-calcul.test.js",
    "node tests/calculateur-entrees.test.js",
    "node tests/essai-enchantements.test.js",
    "node tests/equipe-buffs.test.js",
    "node tests/passifs-graves.test.js",
    "node tests/passifs-armes.test.js",
    "node tests/passifs-ensembles.test.js",
    "node tests/passifs-ensembles-metier.test.js",
    "node tests/potentiels-equipe.test.js",
    "node tests/degats-supplementaires.test.js",
    "node tests/collection.test.js",
    "node tests/presets.test.js",
    "node tests/presets-store.test.js",
    "node tests/potentiel-commun.test.js",
    "node tests/stats-build.test.js",
    "node tests/apport-par-piece.test.js",
    "node tests/manques-libelles.test.js",
    "node tests/animations-mesurees.test.js",
    "node tests/animations-verrous.test.js",
    "node tests/tout-au-maximum.test.js",
    "python -m unittest tests/test_lister_chronometrage.py",
    "python scripts/lister-chronometrage.py --check",
    "node tests/routage.test.js",
    "node tests/analyse-elements.test.js",
    "node tests/recensement-supports.test.js"
  ],
  e2e: [
    "node tests/routage-groupe.playwright.js",
    "node tests/scrollbars-invisibles.playwright.js",
    "node tests/visiteur-anonyme.playwright.js",
    "node tests/comptes-invites.playwright.js",
    "node tests/boss-admin.playwright.js",
    "node tests/boss-correction.playwright.js",
    "node tests/potentiel-commun.playwright.js",
    "node tests/supabase-etape1.playwright.js",
    "node tests/analyse-recensements.playwright.js",
    "node tests/navigation-mobile.playwright.js",
    "node tests/accessibilite-mobile.playwright.js",
    "node tests/chrono-animation.playwright.js",
    "node tests/presets.playwright.js",
    "node tests/availability.playwright.js",
    "node tests/pwa-update.playwright.js",
    "node tests/import-captures.playwright.js",
    "node tests/lecture-assistee-image.playwright.js",
    "node tests/apport-par-piece.playwright.js",
    "node tests/wiki.playwright.js",
    "node tests/wiki-lot2.playwright.js",
    "node tests/akumu-page.playwright.js",
    "node tests/collection.playwright.js",
    "node tests/calculateur.playwright.js"
  ]
};

function lire(argv){
  const options = { suites:[], bail:false, filtre:"" };
  for(let i = 0; i < argv.length; i++){
    const arg = argv[i];
    if(arg === "--bail") options.bail = true;
    else if(arg === "-f" || arg === "--filtre") options.filtre = argv[++i] || "";
    else if(SUITES[arg]) options.suites.push(arg);
    else {
      console.error("argument inconnu : " + arg);
      process.exit(2);
    }
  }
  if(!options.suites.length) options.suites = Object.keys(SUITES);
  return options;
}

function duree(ms){
  return ms < 1000 ? ms + " ms" : (ms / 1000).toFixed(1) + " s";
}

const options = lire(process.argv.slice(2));
const resultats = [];
let interrompu = false;

for(const suite of options.suites){
  const commandes = SUITES[suite]
    .filter(c => !options.filtre || c.includes(options.filtre));
  if(!commandes.length) continue;
  console.log("\n=== " + suite + " : " + commandes.length + " commandes ===\n");
  for(const commande of commandes){
    if(interrompu){
      resultats.push({ suite, commande, etat:"ignore", ms:0 });
      continue;
    }
    const debut = Date.now();
    const sortie = spawnSync(commande, { cwd:RACINE, shell:true, stdio:"inherit" });
    const ms = Date.now() - debut;
    const code = sortie.status === null ? 1 : sortie.status;
    resultats.push({ suite, commande, etat:code === 0 ? "ok" : "echec", ms, code });
    if(code !== 0 && options.bail) interrompu = true;
  }
}

const echecs = resultats.filter(r => r.etat === "echec");
const ignores = resultats.filter(r => r.etat === "ignore");
const total = resultats.reduce((somme, r) => somme + r.ms, 0);

console.log("\n" + "=".repeat(64));
console.log("RECAPITULATIF");
console.log("=".repeat(64));
for(const suite of options.suites){
  const lot = resultats.filter(r => r.suite === suite);
  if(!lot.length) continue;
  const ko = lot.filter(r => r.etat === "echec").length;
  const zappes = lot.filter(r => r.etat === "ignore").length;
  console.log("  " + suite.padEnd(6) + " " + (lot.length - ko - zappes) + "/"
    + lot.length + " au vert" + (ko ? "  (" + ko + " en echec)" : ""));
}

/* Les cinq plus lentes : c'est la seule mesure qui dit ou passent les minutes. */
const lentes = [...resultats].filter(r => r.etat !== "ignore")
  .sort((a, b) => b.ms - a.ms).slice(0, 5);
if(lentes.length){
  console.log("\n  les plus lentes");
  for(const r of lentes) console.log("    " + duree(r.ms).padStart(8) + "  " + r.commande);
}

if(echecs.length){
  console.log("\n  EN ECHEC");
  for(const r of echecs) console.log("    code " + r.code + "  " + r.commande);
}
if(ignores.length) console.log("\n  " + ignores.length + " commandes non lancees (--bail)");

console.log("\n  total " + duree(total) + "\n");
process.exit(echecs.length ? 1 : 0);
