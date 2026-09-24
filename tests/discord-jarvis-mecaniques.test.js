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
  /* Un porteur ou une valeur abimes feraient lever l'outil a chaque question
     pendant une heure : le fichier est refuse en entier. */
  const varianteSaine = { valeurs:[{ stat:"Défense", valeur:"-20 %" }], cible:"ennemi", nature:"malus",
    description:"", posePar:[{ heros:"Ban", arme:"Nunchaku", competence:"Chaîne",
      categorie:"ACTIVE_THIRD", citeParDescription:true }] };
  const avecVariante = variante => ({ version:1, regles:[],
    effets:[{ nom:"Abîmé", nature:"malus", description:"", variantes:[variante] }] });
  assert.equal(M.validerCatalogueMecaniques(avecVariante(varianteSaine)), null);
  assert.equal(M.validerCatalogueMecaniques(Object.assign(avecVariante(varianteSaine), {
    controleValeurs:{ prouvees:1, brutes:0, desaccords:0 }
  })), null, "les contrôles d'extraction valides sont acceptés");
  assert.match(M.validerCatalogueMecaniques(Object.assign(avecVariante(varianteSaine), {
    controleValeurs:{ prouvees:"1", brutes:0, desaccords:0 }
  })), /contrôle des valeurs mal formé/);
  assert.match(M.validerCatalogueMecaniques(avecVariante(Object.assign({}, varianteSaine, { posePar:[null] }))),
    /entrée mal formée dans mecaniques\.json : Abîmé/);
  assert.match(M.validerCatalogueMecaniques(avecVariante(Object.assign({}, varianteSaine,
    { posePar:[{ heros:"Ban", arme:"Nunchaku", competence:7, citeParDescription:true }] }))),
  /entrée mal formée/);
  assert.match(M.validerCatalogueMecaniques(avecVariante(Object.assign({}, varianteSaine,
    { valeurs:[{ stat:1, valeur:"-20 %" }] }))), /entrée mal formée/);
  assert.match(M.validerCatalogueMecaniques(avecVariante(Object.assign({}, varianteSaine,
    { texteJeu:15 }))), /entrée mal formée/);

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

  const desaccord = await o.executer("fiche_effet", { nom:"effet en désaccord" });
  assert.deepEqual(desaccord.donnees.variantes[0].valeurs,
    ["Réception des soins : -6 %"], "la phrase des valeurs reste issue de la table");
  assert.match(desaccord.donnees.variantes[0].texteDuJeu, /15\s*%/,
    "Gemini reçoit séparément le texte contradictoire affiché par le jeu");

  const attaque = await o.executer("fiche_effet", { nom:"augmentation" });
  assert.equal(attaque.donnees.nom, "Augmentation de l'attaque", "à égalité : le nom le plus court");
  assert.equal(attaque.donnees.correspondances, 2);
  assert.deepEqual(attaque.donnees.autresCorrespondances, ["Augmentation des dégâts de faiblesse"]);
  assert.ok(attaque.donnees.nomPartiel, "un nom partiel le dit, pour que Gemini cite les autres");
  assert.deepEqual(attaque.donnees.variantes, [
    { cible:"toute l'équipe", valeurs:["Augmentation de l'attaque : +15 %"], duree:"30 s", cumulMax:1,
      posePar:["Ban (Nunchaku) — Ruée en spirale — nom absent de la description"] },
    { cible:"le porteur", valeurs:["Augmentation de l'attaque : +30 %"], cumulMax:5,
      posePar:["Ban (Nunchaku) — Chaîne"] },
    /* Une variante d'une autre nature, ou d'une autre description, le dit :
       jamais « Buff » pour un malus qui vise l'ennemi. */
    { cible:"l'ennemi", nature:"Malus", description:"Attaque des héros d'attribut Feu +X",
      valeurs:["Augmentation de l'attaque : -10 %"], duree:"15 s", cumulMax:1,
      posePar:["Elizabeth (Grimoire) — Bouchée rafraîchissante — nom absent de la description"] }
  ]);
  const exact = await o.executer("fiche_effet", { nom:"attaque totale ultime" });
  assert.equal(exact.donnees.nom, "Attaque totale ultime");
  assert.equal(exact.donnees.nomPartiel, undefined, "un nom exact n'est pas partiel");

  const petrification = await o.executer("fiche_effet", { nom:"pétrification" });
  assert.equal(petrification.donnees.nature, "Contrôle");
  assert.deepEqual(petrification.donnees.variantes, [{ cible:"l'ennemi",
    valeurs:["Dégâts de faiblesse Terre : +15 %"], cumulMax:1 }], "sans porteur : pas de posePar");

  /* Gemini passe parfois une stat au lieu d'un nom d'effet. */
  const parStat = await o.executer("fiche_effet", { nom:"defense" });
  assert.equal(parStat.donnees.introuvable, "defense",
    "aucun NOM d'effet ne contient « défense » ici : introuvable, jamais une erreur muette");
  assert.ok(Array.isArray(parStat.donnees.proches));
  /* « Attaque totale ultime » COMMENCE par « attaque » mais aucun heros ne
     la pose : le buff d'attaque que tout le monde cherche passe devant, et
     l'autre reste cite. */
  const parNomPartiel = await o.executer("fiche_effet", { nom:"attaque" });
  assert.equal(parNomPartiel.donnees.nom, "Augmentation de l'attaque", "un effet posé passe devant");
  assert.deepEqual(parNomPartiel.donnees.autresCorrespondances, ["Attaque totale ultime"]);
  assert.equal(parNomPartiel.donnees.correspondances, 2);
  const introuvable = await o.executer("fiche_effet", { nom:"zzzz" });
  assert.equal(introuvable.donnees.introuvable, "zzzz");
  assert.ok(Array.isArray(introuvable.donnees.proches));
  assert.deepEqual((await o.executer("fiche_effet", { nom:"  " })).donnees,
    { erreur:"nom d'effet manquant" }, "comme les deux autres outils");

  /* ---------------- chercher_effets ---------------- */
  const defense = await o.executer("chercher_effets", { texte:"défense", nature:"malus" });
  assert.deepEqual(defense.donnees, {
    texte:"défense", donneesDu:"24/09/2026", total:2,
    effets:[{ nom:"Éclaboussures", nature:"Malus", description:"Réduit la défense de X",
      cibles:["l'ennemi"], porteurs:["Elizabeth (Grimoire) — Canon à eau"] },
    { nom:"Petite valeur", nature:"Malus", description:"Défense -X.",
      cibles:["l'ennemi"], porteurs:[] }]
  });
  assert.equal(defense.source, "recherche d'effets défense · données du jeu du 24/09/2026");

  const lumiere = await o.executer("chercher_effets", { texte:"lumière" });
  assert.deepEqual(lumiere.donnees.effets.map(e => e.nom), ["Augmentation des dégâts de faiblesse"],
    "synonyme d'élément : lumière → Sacré");

  const deBan = await o.executer("chercher_effets", { texte:"attaque", heros:"BAN" });
  assert.deepEqual(deBan.donnees.effets.map(e => e.nom), ["Augmentation de l'attaque"]);
  assert.deepEqual(deBan.donnees.effets[0].porteurs, ["Ban (Nunchaku) — Ruée en spirale", "Ban (Nunchaku) — Chaîne"]);
  /* Un heros que le fichier ne connait pas le dit : « total 0 » ferait
     conclure a Gemini que Merlin ne pose rien. */
  const inconnu = (await o.executer("chercher_effets", { texte:"attaque", heros:"merlin" })).donnees;
  assert.equal(inconnu.erreur, "héros inconnu");
  assert.ok(Array.isArray(inconnu.proches));
  assert.equal((await o.executer("chercher_effets", { texte:"pétrification", heros:"ban" })).donnees.total, 0,
    "un héros connu qui ne pose pas l'effet : total 0, sans erreur");

  /* Le filtre de nature porte sur chaque variante : le malus rangé sous un
     nom de buff est trouvé, avec sa propre description. */
  const malusAttaque = await o.executer("chercher_effets", { texte:"attaque", nature:"malus", heros:"élizabeth" });
  assert.deepEqual(malusAttaque.donnees.effets, [{ nom:"Augmentation de l'attaque", nature:"Malus",
    description:"Attaque des héros d'attribut Feu +X", cibles:["l'ennemi"],
    porteurs:["Elizabeth (Grimoire) — Bouchée rafraîchissante"] }]);

  const controle = await o.executer("chercher_effets", { texte:"immobilisation", nature:"contrôle" });
  assert.deepEqual(controle.donnees.effets.map(e => e.nom), ["Pétrification"]);

  assert.deepEqual((await o.executer("chercher_effets", { texte:"   " })).donnees,
    { erreur:"texte à chercher manquant" }, "un texte vide ne rend jamais tout");
  assert.deepEqual((await o.executer("chercher_effets", { texte:"x", nature:"poison" })).donnees,
    { erreur:"nature inconnue : buff, malus ou contrôle" });

  /* Classement par pertinence du nom, liste coupée annoncée, porteurs en
     trop comptés : « qui étourdit ? » ne reçoit jamais une liste incomplète
     présentée comme complète. */
  const varianteTest = (heros, competence) => ({ valeurs:[], cible:"ennemi", nature:"malus",
    description:"Réduit l'attaque de X",
    posePar:[{ heros, arme:"Épée", competence, categorie:"NORMAL_SKILL", citeParDescription:true }] });
  const effetTest = (nom, variantes) => ({ nom, nature:"malus", description:"Réduit l'attaque de X", variantes });
  const nombreux = outils({ version:1, dateExport:"2026-09-24", regles:[], effets:[
    effetTest("Altération", [varianteTest("Ban", "Chaîne")]),
    effetTest("Augmentation de l'attaque", [varianteTest("Ban", "Chaîne")]),
    effetTest("Étourdissement", ["A", "B", "C", "D", "E", "F", "G", "H"].map(h => varianteTest(h, "Coup")))
  ].concat(Array.from({ length:11 }, (_, i) =>
    effetTest("Effet " + String(i + 1).padStart(2, "0"), [varianteTest("Ban", "Chaîne")]))) });
  const classes = (await nombreux.executer("chercher_effets", { texte:"attaque" })).donnees;
  assert.equal(classes.effets[0].nom, "Augmentation de l'attaque", "le nom qui contient le mot passe devant");
  assert.equal(classes.total, 14);
  assert.equal(classes.effets.length, 12);
  assert.ok(classes.suite, "une liste coupée le dit");
  const etourdit = (await nombreux.executer("chercher_effets", { texte:"étourdissement" })).donnees;
  assert.equal(etourdit.effets[0].porteurs.length, 6);
  /* Un mot du nom suffit : « Thunder » trouve Gil Thunder. */
  const gil = outils({ version:1, dateExport:"2026-09-24", regles:[], effets:[
    effetTest("Choc", [varianteTest("Gil Thunder", "Éclair")])] });
  assert.equal((await gil.executer("chercher_effets", { texte:"choc", heros:"thunder" })).donnees.total, 1);

  /* fiche_effet ne montre que 6 variantes : les heros des suivantes sont
     nommes, pour qu'un porteur ne disparaisse pas sans le dire. */
  const masques = outils({ version:1, dateExport:"2026-09-24", regles:[], effets:[
    effetTest("Coupe", ["A", "B", "C", "D", "E", "A", "Daisy", "Khala"].map((h, i) =>
      Object.assign(varianteTest(h, "Coup"), { duree:i + 1 })))] });
  const coupe = (await masques.executer("fiche_effet", { nom:"coupe" })).donnees;
  assert.equal(coupe.variantes.length, 6);
  assert.deepEqual(coupe.porteursMasques, ["Daisy", "Khala"]);
  assert.equal(etourdit.effets[0].autresPorteurs, 2);

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

  /* Le jeu écrit « Clotho » et « Derrierie » là où le wiki dit « Klotho » et
     « Derieri » : une orthographe proche trouve leurs fiches d'aide. */
  const heros = outils({ version:1, dateExport:"2026-09-24", effets:[], regles:[
    { sujet:"Clotho (rapière)", pages:["p"] }, { sujet:"Derrierie (hache)", pages:["q"] }
  ] });
  assert.deepEqual((await heros.executer("regle", { sujet:"Klotho" })).donnees, {
    donneesDu:"24/09/2026", orthographeProche:true, sujets:[{ sujet:"Clotho (rapière)", texte:"p" }]
  });
  assert.equal((await heros.executer("regle", { sujet:"derieri hache" })).donnees.sujets[0].sujet,
    "Derrierie (hache)");

  /* ---------------- Fichier indisponible ---------------- */
  const absent = outils(null);
  for(const [nom, args] of [["fiche_effet", { nom:"x" }], ["chercher_effets", { texte:"x" }], ["regle", { sujet:"x" }]]){
    assert.deepEqual((await absent.executer(nom, args)).donnees, { erreur:"données des mécaniques indisponibles" });
  }

  console.log("OK discord-jarvis-mecaniques");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
