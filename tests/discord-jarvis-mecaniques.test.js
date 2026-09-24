"use strict";

/* Les trois outils des mecaniques de /jarvis, sur un catalogue fabrique par
   la VRAIE extraction a partir du mini-export de
   tests/mecaniques-jarvis.test.js : les formes ne peuvent pas diverger
   entre l'extracteur et le bot. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-mecaniques.js"));
const { construireCatalogueMecaniques } = require(path.join(ROOT, "outils", "fabrication", "mecaniques-jarvis.js"));
const { ENTREE_MECANIQUES_TEST } = require("./mecaniques-jarvis.test.js");

const CATALOGUE = construireCatalogueMecaniques(ENTREE_MECANIQUES_TEST);

function outils(catalogue) {
  const table = {};
  M.ajouterOutilsMecaniquesJarvis(table, async () => catalogue);
  return {
    async executer(nom, args) {
      const donnees = await table[nom].executer(args);
      return { donnees, source:table[nom].source(args, donnees) };
    }
  };
}

async function main() {
  /* ---------------- Declarations et validation ---------------- */
  assert.deepEqual(M.DECLARATIONS_OUTILS_MECANIQUES.map(d => d.name), ["fiche_effet", "chercher_effets", "regle"]);
  M.DECLARATIONS_OUTILS_MECANIQUES.forEach(d => assert.equal(d.parameters.type, "OBJECT"));
  assert.equal(M.CHEMIN_MECANIQUES_JARVIS, "jarvis-prive/mecaniques.json");
  assert.equal(M.validerCatalogueMecaniques(CATALOGUE), null, "le vrai catalogue extrait passe");
  assert.match(M.validerCatalogueMecaniques({ version:2, effets:[], regles:[] }), /format de mecaniques\.json inconnu : 2/);
  assert.match(M.validerCatalogueMecaniques(null), /format de mecaniques\.json inconnu/);
  assert.match(M.validerCatalogueMecaniques({ version:1, regles:[],
    effets:[{ nom:"Bizarre", nature:"autre", description:"", variantes:[] }] }),
  /entrée mal formée dans mecaniques\.json : Bizarre/);
  assert.match(M.validerCatalogueMecaniques({ version:1, effets:[], regles:[{ sujet:"Vide", pages:[3] }] }),
    /sujet mal formé dans mecaniques\.json : Vide/);

  const o = outils(CATALOGUE);

  /* ---------------- fiche_effet ---------------- */
  const eclaboussures = await o.executer("fiche_effet", { nom:"eclaboussures" });
  assert.deepEqual(eclaboussures.donnees, {
    nom:"Éclaboussures", nature:"Malus", description:"Réduit la défense de X",
    donneesDu:"24/09/2026", totalVariantes:1,
    variantes:[{ cible:"l'ennemi", valeurs:["Augmentation de la défense : -20 %"], duree:"40 s",
      cumulMax:1, posePar:["Elizabeth (Grimoire) — Canon à eau"] }]
  });
  assert.equal(eclaboussures.source, "effet Éclaboussures · données du jeu du 24/09/2026");

  const attaque = await o.executer("fiche_effet", { nom:"augmentation" });
  assert.equal(attaque.donnees.nom, "Augmentation de l'attaque", "à égalité : le nom le plus court");
  assert.equal(attaque.donnees.correspondances, 2);
  assert.deepEqual(attaque.donnees.autresCorrespondances, ["Augmentation des dégâts de faiblesse"]);
  assert.deepEqual(attaque.donnees.variantes, [
    { cible:"toute l'équipe", valeurs:["Augmentation de l'attaque : +15 %"], duree:"30 s", cumulMax:1,
      posePar:["Ban (Nunchaku) — Ruée en spirale — nom absent de la description"] },
    { cible:"le porteur", valeurs:["Augmentation de l'attaque : +30 %"], cumulMax:5,
      posePar:["Ban (Nunchaku) — Chaîne"] }
  ]);

  const petrification = await o.executer("fiche_effet", { nom:"pétrification" });
  assert.equal(petrification.donnees.nature, "Contrôle");
  assert.deepEqual(petrification.donnees.variantes, [{ cible:"l'ennemi",
    valeurs:["Dégâts de faiblesse Terre : +15 %"], cumulMax:1 }], "sans porteur : pas de posePar");

  /* Gemini passe parfois une stat au lieu d'un nom d'effet. */
  const parStat = await o.executer("fiche_effet", { nom:"defense" });
  assert.equal(parStat.donnees.introuvable, "defense",
    "aucun NOM d'effet ne contient « défense » ici : introuvable, jamais une erreur muette");
  assert.ok(Array.isArray(parStat.donnees.proches));
  const parNomPartiel = await o.executer("fiche_effet", { nom:"attaque" });
  assert.equal(parNomPartiel.donnees.nom, "Augmentation de l'attaque", "un nom qui contient le mot suffit");
  const introuvable = await o.executer("fiche_effet", { nom:"zzzz" });
  assert.equal(introuvable.donnees.introuvable, "zzzz");
  assert.ok(Array.isArray(introuvable.donnees.proches));

  /* ---------------- chercher_effets ---------------- */
  const defense = await o.executer("chercher_effets", { texte:"défense", nature:"malus" });
  assert.deepEqual(defense.donnees, {
    texte:"défense", donneesDu:"24/09/2026", total:1,
    effets:[{ nom:"Éclaboussures", nature:"Malus", description:"Réduit la défense de X",
      cibles:["l'ennemi"], porteurs:["Elizabeth — Canon à eau"] }]
  });
  assert.equal(defense.source, "recherche d'effets défense · données du jeu du 24/09/2026");

  const lumiere = await o.executer("chercher_effets", { texte:"lumière" });
  assert.deepEqual(lumiere.donnees.effets.map(e => e.nom), ["Augmentation des dégâts de faiblesse"],
    "synonyme d'élément : lumière → Sacré");

  const deBan = await o.executer("chercher_effets", { texte:"attaque", heros:"BAN" });
  assert.deepEqual(deBan.donnees.effets.map(e => e.nom), ["Augmentation de l'attaque"]);
  assert.deepEqual(deBan.donnees.effets[0].porteurs, ["Ban — Ruée en spirale", "Ban — Chaîne"]);
  assert.equal((await o.executer("chercher_effets", { texte:"attaque", heros:"élizabeth" })).donnees.total, 0);

  const controle = await o.executer("chercher_effets", { texte:"immobilisation", nature:"contrôle" });
  assert.deepEqual(controle.donnees.effets.map(e => e.nom), ["Pétrification"]);

  assert.deepEqual((await o.executer("chercher_effets", { texte:"   " })).donnees,
    { erreur:"texte à chercher manquant" }, "un texte vide ne rend jamais tout");
  assert.deepEqual((await o.executer("chercher_effets", { texte:"x", nature:"poison" })).donnees,
    { erreur:"nature inconnue : buff, malus ou contrôle" });

  /* ---------------- regle ---------------- */
  const deluge = await o.executer("regle", { sujet:"deluge" });
  assert.deepEqual(deluge.donnees, {
    donneesDu:"24/09/2026",
    sujets:[{ sujet:"Déluge élémentaire - Feu",
      texte:"Remplissez la jauge avec (touche).\n\nDeuxième page.\n\nDixième page.\n\nPage du guide." }]
  });
  assert.equal(deluge.source, "règle Déluge élémentaire - Feu · données du jeu du 24/09/2026");
  assert.equal((await o.executer("regle", { sujet:"meliodas" })).donnees.sujets[0].sujet, "Meliodas (épée longue)");
  assert.deepEqual((await o.executer("regle", { sujet:"feu de camp" })).donnees,
    { introuvable:"feu de camp", proches:["Déluge élémentaire - Feu"] });
  assert.deepEqual((await o.executer("regle", { sujet:"pêche" })).donnees, { erreur:"aucune règle sur ce sujet" });

  const long = outils({ version:1, dateExport:"2026-09-24", effets:[], regles:[
    { sujet:"Relève", pages:["a".repeat(2000)] },
    { sujet:"Relève A", pages:["a"] }, { sujet:"Relève B", pages:["b"] }, { sujet:"Relève C", pages:["c"] }
  ] });
  const releve = (await long.executer("regle", { sujet:"releve" })).donnees;
  assert.equal(Array.from(releve.sujets[0].texte).length, 1500, "borné à 1 500 caractères");
  assert.ok(releve.sujets[0].texte.endsWith("…"));
  assert.equal(releve.sujets.length, 3);
  assert.deepEqual(releve.autresSujets, ["Relève C"]);

  /* ---------------- Fichier indisponible ---------------- */
  const absent = outils(null);
  for(const [nom, args] of [["fiche_effet", { nom:"x" }], ["chercher_effets", { texte:"x" }], ["regle", { sujet:"x" }]]){
    assert.deepEqual((await absent.executer(nom, args)).donnees, { erreur:"données des mécaniques indisponibles" });
  }

  console.log("OK discord-jarvis-mecaniques");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
