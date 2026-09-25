"use strict";

/* Les objets et boutiques de /jarvis : les deux outils, sur un catalogue
   fabrique par la VRAIE extraction a partir du mini-export de
   tests/objets-jarvis.test.js. Les formes ne peuvent pas diverger entre
   l'extracteur et le bot. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const O = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-objets.js"));
const { construireCatalogueObjets } = require(path.join(ROOT, "outils", "fabrication", "objets-jarvis.js"));
const { ENTREE_OBJETS_TEST, ENTREE_FILONS_TEST, ENTREE_CUBE_TEST, ENTREE_LOTS_TEST, ENTREE_FAMILIERS_TEST }
  = require("./objets-jarvis.test.js");

const CATALOGUE = construireCatalogueObjets(ENTREE_OBJETS_TEST);
const LIONES = "Boutique d'équipement — Liones";
const MAGI = "Boutique d'échange de jeton Magi★Pop";

function outils(catalogue) {
  const table = {};
  O.ajouterOutilsObjetsJarvis(table, async () => catalogue);
  return {
    async executer(nom, args) {
      const donnees = await table[nom].executer(args);
      return { donnees, source:table[nom].source(args, donnees) };
    }
  };
}

async function main() {
  /* ---------------- Declarations et fichier ---------------- */
  assert.deepEqual(O.DECLARATIONS_OUTILS_OBJETS.map(d => d.name),
    ["ou_trouver", "boutique", "butin", "recette", "familier", "chercher_familiers"]);
  O.DECLARATIONS_OUTILS_OBJETS.forEach(d => assert.equal(d.parameters.type, "OBJECT"));
  assert.equal(O.CHEMIN_OBJETS_JARVIS, "jarvis-prive/objets.json");
  assert.equal(O.validerCatalogueObjets(CATALOGUE), null);
  assert.match(O.validerCatalogueObjets({ version:2 }), /format de objets\.json inconnu/);
  const abime = JSON.parse(JSON.stringify(CATALOGUE));
  abime.objets.find(objet => objet.nom === "Épée longue").sources[0].prix = 1800;
  assert.match(O.validerCatalogueObjets(abime), /mal formé/);
  const boutiqueAbimee = JSON.parse(JSON.stringify(CATALOGUE));
  boutiqueAbimee.boutiques[0].acces = "porte";
  assert.match(O.validerCatalogueObjets(boutiqueAbimee), /mal formée/);

  const o = outils(CATALOGUE);

  /* ---------------- ou_trouver ---------------- */
  const epee = await o.executer("ou_trouver", { objet:"epee longue" });
  assert.deepEqual(epee.donnees, {
    nom:"Épée longue", type:"Équipement", donneesDu:"22/09/2026",
    sources:[
      LIONES + " (Alexander, Karim ; Liones (Plaines de Liones), Vanya) : 1 800 Or, 3 par jour",
      /* Le PNJ est deja dans le nom : pas de redite. */
      "Boutique d'équipement (Gérard) : 2 000 Or",
      "Donjon : Mine de Ferzen (Normal), première victoire"
    ]
  });
  /* ou_trouver cite boutiques, butins et recettes : la source le dit. */
  assert.equal(epee.source, "où trouver Épée longue · données du jeu du 22/09/2026");

  const minerai = await o.executer("ou_trouver", { objet:"Minerai" });
  assert.deepEqual(minerai.donnees.sources, [
    LIONES + " (Alexander, Karim ; Liones (Plaines de Liones), Vanya) : x5 pour 2 Potion, 10 par semaine",
    "Boutique itinérante — Liones (Nyandin et Mou ; Liones (Plaines de Liones)) : 500 Or, article tiré au hasard",
    "Butin de monstre : Banakro, chance niveaux de monde 1 à 2 : 1,5 % ; 3,5 %",
    /* Sans taux de groupe : aucune chance. */
    "Minage : Minerai de fer",
    "Donjon : Mine de Ferzen (Normal), chance 2 %"
  ]);
  const potion = await o.executer("ou_trouver", { objet:"potion" });
  assert.equal(potion.donnees.sources[1], "Boutique d'équipement (depuis un menu) : 50 Or, 2 au total");
  assert.equal(potion.donnees.sources[0],
    LIONES + " (Alexander, Karim ; Liones (Plaines de Liones), Vanya) : 100 Or, 1 au total,"
    + " à partir du niveau de monde 3");
  assert.deepEqual(potion.donnees.sources.slice(4), [
    "Capture : Mouette, chance 80 %",
    "Donjon : Mine de Ferzen (Normal), chance 18 %",
    "Boss de confrérie, palier de participation 5, chance 100 %",
    "Recette : Fabrication — Établi de fortune ou supérieur",
    "Recette : Fabrication — Établi de fortune"
  ]);

  /* Un nom court et exact gagne. */
  const or = await o.executer("ou_trouver", { objet:"or" });
  assert.equal(or.donnees.nom, "Or");
  assert.equal(or.donnees.candidats, undefined);
  /* Les grandes quantites se lisent comme les prix. */
  assert.equal(or.donnees.sources[0], MAGI + " (depuis un menu) : x1 000 pour 1 Potion");

  /* Un nom partiel qui designe plusieurs objets : la liste, sans choisir. */
  const partiel = await o.executer("ou_trouver", { objet:"on" });
  assert.deepEqual(partiel.donnees, {
    recherche:"on", correspondances:3, candidats:["Potion", "Épée longue", "Sceau de Liones"]
  });

  /* Une faute proche : l'objet, avec l'aveu. */
  const faute = await o.executer("ou_trouver", { objet:"minerais" });
  assert.equal(faute.donnees.nom, "Minerai");
  assert.match(faute.donnees.nomApproche, /minerais/);

  const inconnu = await o.executer("ou_trouver", { objet:"dragon" });
  assert.equal(inconnu.donnees.introuvable, "dragon");
  assert.ok(Array.isArray(inconnu.donnees.proches));
  assert.deepEqual((await o.executer("ou_trouver", {})).donnees, { erreur:"nom d'objet manquant" });

  /* ---------------- boutique ---------------- */
  const itinerante = await o.executer("boutique", { nom:"boutique itinerante" });
  assert.deepEqual(itinerante.donnees, {
    nom:"Boutique itinérante — Liones", genre:"Boutique itinérante", acces:"auprès d'un PNJ",
    pnj:["Nyandin et Mou"], regions:["Liones (Plaines de Liones)"], donneesDu:"22/09/2026",
    noteAleatoire:"articles tirés au hasard : la boutique peut les proposer, pas toujours",
    articles:["Minerai : 500 Or"]
  });
  assert.equal(itinerante.source, "boutiques · données du jeu du 22/09/2026");

  /* Un genre partage : la liste des boutiques et de leurs regions. */
  const equipement = await o.executer("boutique", { nom:"boutique d'equipement" });
  assert.deepEqual(equipement.donnees, {
    recherche:"boutique d'equipement", correspondances:3,
    boutiques:[LIONES, "Boutique d'équipement (Gérard)", "Boutique d'équipement"],
    regionsPossibles:["Liones (Plaines de Liones)", "Vanya"]
  });
  const liones = await o.executer("boutique", { nom:"boutique d'équipement", region:"vanya" });
  assert.equal(liones.donnees.nom, LIONES);
  assert.deepEqual(liones.donnees.articles, [
    "Épée longue : 1 800 Or, 3 par jour",
    "Minerai x5 : 2 Potion, 10 par semaine",
    "Potion : 100 Or, 1 au total, à partir du niveau de monde 3"
  ]);
  const ailleurs = await o.executer("boutique", { nom:"boutique d'équipement", region:"ravens" });
  assert.deepEqual(ailleurs.donnees, {
    erreur:"aucune boutique de ce nom dans cette région",
    regionsPossibles:["Liones (Plaines de Liones)", "Vanya"]
  });

  const menu = await o.executer("boutique", { nom:MAGI + " (2)" });
  assert.equal(menu.donnees.acces, "depuis un menu");
  assert.deepEqual(menu.donnees.articles, ["Potion : 7 Jeton Magi★Pop"]);
  assert.equal((await o.executer("boutique", { nom:"magi" })).donnees.correspondances, 2);

  const forge = await o.executer("boutique", { nom:"forge" });
  assert.equal(forge.donnees.introuvable, "forge");
  assert.equal(forge.donnees.boutiques.length, CATALOGUE.boutiques.length);
  assert.deepEqual((await o.executer("boutique", {})).donnees, { erreur:"nom de boutique manquant" });

  /* ---------------- butin ---------------- */
  const NOTE = "chance à chaque victoire ou récolte, lue dans les tables et selon le niveau de monde ;"
    + " un objet sans chance indiquée : ne cite aucun chiffre";
  const banakro = await o.executer("butin", { nom:"banakro" });
  assert.deepEqual(banakro.donnees, {
    nom:"Banakro", donneesDu:"22/09/2026", noteProbabilites:NOTE,
    butins:[{ type:"Butin de monstre", objets:["Minerai — niveaux de monde 1 à 2 : 1,5 % ; 3,5 %", "Sceau de Liones — 100 %"] }]
  });
  assert.equal(banakro.source, "butins · données du jeu du 22/09/2026");
  /* Un meme nom, plusieurs facons d'obtenir : toutes, dans une reponse. */
  assert.deepEqual((await o.executer("butin", { nom:"Mine de Ferzen" })).donnees.butins, [
    { type:"Donjon", objets:["Or — 100 %", "Potion — 18 %", "Minerai — 2 %"] },
    { type:"Donjon", detail:"première victoire", objets:["Épée longue"] }
  ]);
  assert.deepEqual((await o.executer("butin", { nom:"mouette" })).donnees.butins,
    [{ type:"Capture", objets:["Potion — 80 %"] }]);
  /* Des noms differents de meme rang : la liste, sans choisir. */
  assert.deepEqual((await o.executer("butin", { nom:"de" })).donnees, {
    recherche:"de", correspondances:3,
    candidats:["Minerai de fer", "Boss de confrérie", "Mine de Ferzen (Normal)"]
  });
  /* Un donjon en plusieurs difficultes : ses difficultes, pas cinq candidats. */
  const difficultes = JSON.parse(JSON.stringify(CATALOGUE));
  difficultes.butins.push(Object.assign({}, difficultes.butins.find(b => b.nom === "Mine de Ferzen (Normal)" && !b.detail),
    { nom:"Mine de Ferzen (Difficile)" }));
  const dif = outils(difficultes);
  assert.deepEqual((await dif.executer("butin", { nom:"mine de ferzen" })).donnees, {
    recherche:"mine de ferzen", nom:"Mine de Ferzen", difficultesPossibles:["Normal", "Difficile"],
    noteDifficulte:"précise la difficulté avec le paramètre « difficulte »"
  });
  assert.equal((await dif.executer("butin", { nom:"mine de ferzen", difficulte:"difficile" })).donnees.nom,
    "Mine de Ferzen (Difficile)");
  assert.deepEqual((await dif.executer("butin", { nom:"mine de ferzen", difficulte:"abysse" })).donnees, {
    erreur:"difficulté inconnue pour Mine de Ferzen", difficultesPossibles:["Normal", "Difficile"]
  });
    const sansButin = await o.executer("butin", { nom:"dragon" });
  assert.equal(sansButin.donnees.introuvable, "dragon");
  assert.ok(Array.isArray(sansButin.donnees.proches));
  assert.deepEqual((await o.executer("butin", {})).donnees, { erreur:"nom de source manquant" });

  /* Les filons : quantite par recolte, filons par region, maximum par jour. */
  const filons = outils(construireCatalogueObjets(ENTREE_FILONS_TEST));
  assert.deepEqual((await filons.executer("butin", { nom:"platine" })).donnees, {
    nom:"Minerai de platine", donneesDu:"22/09/2026", noteProbabilites:NOTE,
    noteFilons:"filons comptés dans les tables d'apparition du monde ouvert ; maximum par jour :"
      + " chaque filon récolté une fois",
    butins:[{ type:"Minage",
      objets:["Minerai de platine — 100 %, quantité 2 à 3", "Pierre à feu"],
      filons:"3 filons (Liones : 2 ; Forêt du roi des fées : 1)",
      maximumParJour:["Minerai de platine : 6 à 9"] }]
  });
  assert.deepEqual((await filons.executer("ou_trouver", { objet:"minerai de platine" })).donnees.sources,
    ["Minage : Minerai de platine, chance 100 %, quantité 2 à 3, 3 filons, au plus 6 à 9 par jour"]);
  /* Sans filons (Banakro) : pas de note sur les filons. */
  assert.equal((await filons.executer("butin", { nom:"banakro" })).donnees.noteFilons, undefined);
  const filonsAbimes = construireCatalogueObjets(ENTREE_FILONS_TEST);
  filonsAbimes.butins.find(butin => butin.filons).filons.total = "3";
  assert.match(O.validerCatalogueObjets(filonsAbimes), /butin mal formé/);
  const quantitesAbimees = construireCatalogueObjets(ENTREE_FILONS_TEST);
  quantitesAbimees.butins.find(butin => butin.quantites).quantites = "2 à 3";
  assert.match(O.validerCatalogueObjets(quantitesAbimees), /butin mal formé/);
  assert.equal(O.validerCatalogueObjets(construireCatalogueObjets(ENTREE_FILONS_TEST)), null);

  /* Le cube de recompense d'un boss : une source a part, avec son cout. */
  const cube = outils(construireCatalogueObjets(ENTREE_CUBE_TEST));
  assert.deepEqual((await cube.executer("butin", { nom:"démon rouge" })).donnees.butins, [{
    type:"Cube de récompense", detail:"à ouvrir avec 10 Clé de cube",
    objets:["Or — 100 %, quantité 16 000 à 19 000", "Épée longue — 10 %", "Potion — 90 %",
      "Minerai — niveau de monde 1 : 100 %, quantité 13 à 17", "Riz — niveau de monde 2 : 100 %, quantité 9 à 12"]
  }]);
  assert.ok((await cube.executer("ou_trouver", { objet:"épée longue" })).donnees.sources.includes(
    "Cube de récompense : Démon rouge, à ouvrir avec 10 Clé de cube, chance 10 %"));
  assert.equal(O.validerCatalogueObjets(construireCatalogueObjets(ENTREE_CUBE_TEST)), null);

  /* Les lots de la Boutique : l'objet renvoie au lot ; le lot dit son contenu. */
  const lots = outils(construireCatalogueObjets(ENTREE_LOTS_TEST));
  const PRIX_REEL = "argent réel (prix selon ta boutique d'applications)";
  assert.deepEqual((await lots.executer("ou_trouver", { objet:"clé de cube" })).donnees.sources, [
    "Lots — Clé de cube (depuis un menu) : dans « Lot Clé de cube », x120 pour " + PRIX_REEL
      + ", 5 tous les 35 à 36 jours environ"
  ]);
  assert.deepEqual((await lots.executer("boutique", { nom:"lots" })).donnees.articles, [
    "Lot Clé de cube : " + PRIX_REEL + ", 5 tous les 35 à 36 jours environ (contient : Clé de cube x120, Minerai)",
    "Renforcement niv. 1 : 990 Mémoire des étoiles (payée) (contient : Minerai)",
    "Une fois par jour : gratuit, 1 par jour (contient : Minerai)"
  ]);
  const lotsCatalogue = construireCatalogueObjets(ENTREE_LOTS_TEST);
  assert.equal(O.validerCatalogueObjets(lotsCatalogue), null);
  lotsCatalogue.boutiques.find(boutique => boutique.genre === "Lots").articles[0].contenu = "Clé de cube";
  assert.match(O.validerCatalogueObjets(lotsCatalogue), /mal formée/);

  /* ---------------- familiers ---------------- */
  const NOTE_CAPTURE = "taux de base et résistance lus dans les tables de capture ; l'effet des potions"
    + " n'est pas calculé : n'en donne aucun chiffre";
  const catalogueFamiliers = construireCatalogueObjets(ENTREE_FAMILIERS_TEST);
  assert.equal(O.validerCatalogueObjets(catalogueFamiliers), null);
  const fam = outils(catalogueFamiliers);
  const faineant = await fam.executer("familier", { nom:"faineant" });
  assert.deepEqual(faineant.donnees, {
    nom:"Fainéant tacheté", type:"Invocation", rarete:"Général", description:"Un lapin tacheté.",
    donneesDu:"22/09/2026",
    competences:["Récupération auto. : Ramasse automatiquement les objets normaux."],
    obtention:["capture : Lapin mutilateur (difficulté 1, taux de base 27 % ; ou difficulté 1, taux de base 100 %,"
      + " selon la version du monstre)"],
    noteCapture:NOTE_CAPTURE
  });
  assert.equal(faineant.source, "familiers · données du jeu du 22/09/2026");
  /* Une boutique qui vend le familier : reprise de l'index des objets. */
  const avecBoutique = JSON.parse(JSON.stringify(catalogueFamiliers));
  avecBoutique.objets.find(objet => objet.nom === "Cheval fougueux").sources.push(
    { type:"boutique", boutique:"Boutique d'échange — Loyauté", prix:"8 000 Loyauté", limite:"1 par compte" });
  assert.deepEqual((await outils(avecBoutique).executer("familier", { nom:"cheval" })).donnees.autresSources,
    ["Boutique d'échange — Loyauté : 8 000 Loyauté, 1 par compte"]);
  assert.deepEqual((await fam.executer("familier", { nom:"hawk" })).donnees.obtention,
    ["en faisant manger : Viande de démon rouge"]);
  const sansObtention = JSON.parse(JSON.stringify(catalogueFamiliers));
  delete sansObtention.familiers.find(familier => familier.nom.startsWith("Hawk")).obtention;
  assert.match((await outils(sansObtention).executer("familier", { nom:"hawk" })).donnees.noteObtention,
    /quêtes, succès, événements/);
  assert.equal((await fam.executer("familier", { nom:"dragon" })).donnees.introuvable, "dragon");
  assert.deepEqual((await fam.executer("familier", {})).donnees, { erreur:"nom de familier manquant" });

  assert.deepEqual((await fam.executer("chercher_familiers", { texte:"extraction minière" })).donnees,
    { recherche:"extraction minière", familiers:["Cheval fougueux (Monture)"] });
  assert.deepEqual((await fam.executer("chercher_familiers", { texte:"récupération" })).donnees.familiers,
    ["Fainéant tacheté (Invocation)"]);
  assert.deepEqual((await fam.executer("chercher_familiers", { texte:"licorne" })).donnees,
    { recherche:"licorne", familiers:[], typesPossibles:["Invocation", "Monture", "Vol"] });
  const familiersAbimes = JSON.parse(JSON.stringify(catalogueFamiliers));
  familiersAbimes.familiers[0].competences = "Galop";
  assert.match(O.validerCatalogueObjets(familiersAbimes), /familier mal formé/);
  assert.deepEqual((await outils(CATALOGUE).executer("familier", { nom:"lapin" })).donnees.introuvable, "lapin");

  /* Un fichier d'avant les butins reste lisible. */
  const ancien = JSON.parse(JSON.stringify(CATALOGUE));
  delete ancien.butins;
  assert.equal(O.validerCatalogueObjets(ancien), null);
  assert.equal((await outils(ancien).executer("butin", { nom:"banakro" })).donnees.introuvable, "banakro");
  const typeInconnu = JSON.parse(JSON.stringify(CATALOGUE));
  typeInconnu.objets[0].sources.push({ type:"coffre", origine:"Coffre" });
  assert.match(O.validerCatalogueObjets(typeInconnu), /objet mal formé/);
  const butinAbime = JSON.parse(JSON.stringify(CATALOGUE));
  butinAbime.butins[0].objets = "Potion";
  assert.match(O.validerCatalogueObjets(butinAbime), /butin mal formé/);
  const tauxAbime = JSON.parse(JSON.stringify(CATALOGUE));
  tauxAbime.butins.find(butin => butin.taux).taux = "20 %";
  assert.match(O.validerCatalogueObjets(tauxAbime), /butin mal formé/);
  const sourceTauxAbimee = JSON.parse(JSON.stringify(CATALOGUE));
  sourceTauxAbimee.objets.find(objet => objet.nom === "Or").sources[1].taux = 100;
  assert.match(O.validerCatalogueObjets(sourceTauxAbimee), /objet mal formé/);

  /* ---------------- recette ---------------- */
  const beignets = await o.executer("recette", { objet:"beignets" });
  assert.deepEqual(beignets.donnees, {
    produit:"Beignets", donneesDu:"22/09/2026",
    recettes:[
      { type:"Cuisine", ingredients:["Minerai x1", "Riz x1 (ou : Orge, Blé, Maïs, Seigle et 1 autre)"] },
      { type:"Fabrication — Établi robuste", ingredients:["Minerai x9"] }
    ]
  });
  assert.equal(beignets.source, "recettes · données du jeu du 22/09/2026");
  assert.deepEqual((await o.executer("ou_trouver", { objet:"beignets" })).donnees.sources,
    ["Recette : Cuisine", "Recette : Fabrication — Établi robuste"]);
  assert.equal((await o.executer("recette", { objet:"filet" })).donnees.recettes[0].quantite, 2);
  assert.deepEqual((await o.executer("recette", { objet:"et" })).donnees,
    { recherche:"et", correspondances:2, candidats:["Filet", "Beignets"] });
  const sansRecette = await o.executer("recette", { objet:"dragon" });
  assert.equal(sansRecette.donnees.introuvable, "dragon");
  assert.ok(Array.isArray(sansRecette.donnees.proches));
  assert.deepEqual((await o.executer("recette", {})).donnees, { erreur:"nom d'objet manquant" });
  const avantRecettes = JSON.parse(JSON.stringify(CATALOGUE));
  delete avantRecettes.recettes;
  assert.equal(O.validerCatalogueObjets(avantRecettes), null);
  assert.equal((await outils(avantRecettes).executer("recette", { objet:"filet" })).donnees.introuvable, "filet");
  const recetteAbimee = JSON.parse(JSON.stringify(CATALOGUE));
  recetteAbimee.recettes[0].ingredients = [];
  assert.match(O.validerCatalogueObjets(recetteAbimee), /recette mal formée/);

  /* ---------------- Bornes ---------------- */
  const gros = JSON.parse(JSON.stringify(CATALOGUE));
  gros.objets.find(objet => objet.nom === "Épée longue").sources = Array.from({ length:20 }, (_, i) =>
    ({ type:"boutique", boutique:"Boutique " + i, prix:i + " Or" }));
  gros.boutiques[0].articles = Array.from({ length:50 }, (_, i) => ({ objet:"Objet " + i, prix:i + " Or" }));
  const borne = outils(gros);
  const sources = (await borne.executer("ou_trouver", { objet:"Épée longue" })).donnees;
  assert.equal(sources.sources.length, 12);
  assert.equal(sources.autresSources, 8);
  const articles = (await borne.executer("boutique", { nom:LIONES })).donnees;
  assert.equal(articles.articles.length, 40);
  assert.equal(articles.autresArticles, 10);
  gros.butins[1].objets = Array.from({ length:50 }, (_, i) => "Objet " + i);
  const butinBorne = (await borne.executer("butin", { nom:"Banakro" })).donnees.butins[0];
  assert.equal(butinBorne.objets.length, 40);
  assert.equal(butinBorne.autresObjets, 10);
  gros.recettes = Array.from({ length:8 }, (_, i) => ({ produit:"Filet", type:"Cuisine", ingredients:["Riz x" + (i + 1)] }));
  const recettesBornees = (await borne.executer("recette", { objet:"Filet" })).donnees;
  assert.equal(recettesBornees.recettes.length, 5);
  assert.equal(recettesBornees.autresRecettes, 3);

  /* ---------------- Fichier absent ---------------- */
  const absent = outils(null);
  assert.deepEqual((await absent.executer("ou_trouver", { objet:"or" })).donnees,
    { erreur:"données des objets indisponibles" });
  assert.deepEqual((await absent.executer("boutique", { nom:"x" })).donnees,
    { erreur:"données des objets indisponibles" });
  assert.equal((await absent.executer("boutique", { nom:"x" })).source, "boutiques");

  console.log("OK discord-jarvis-objets");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
