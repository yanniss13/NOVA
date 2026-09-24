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
const { ENTREE_OBJETS_TEST } = require("./objets-jarvis.test.js");

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
  assert.deepEqual(O.DECLARATIONS_OUTILS_OBJETS.map(d => d.name), ["ou_trouver", "boutique", "butin", "recette"]);
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
    "Butin de monstre : Banakro",
    "Minage : Minerai de fer"
  ]);
  const potion = await o.executer("ou_trouver", { objet:"potion" });
  assert.equal(potion.donnees.sources[1], "Boutique d'équipement (depuis un menu) : 50 Or, 2 au total");
  assert.equal(potion.donnees.sources[0],
    LIONES + " (Alexander, Karim ; Liones (Plaines de Liones), Vanya) : 100 Or, 1 au total,"
    + " à partir du niveau de monde 3");
  assert.deepEqual(potion.donnees.sources.slice(4), [
    "Capture : Mouette",
    "Boss de confrérie, palier de participation 5",
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
  const NOTE = "la table ne donne pas de probabilité lisible : ne cite aucun taux";
  const banakro = await o.executer("butin", { nom:"banakro" });
  assert.deepEqual(banakro.donnees, {
    nom:"Banakro", donneesDu:"22/09/2026", noteProbabilites:NOTE,
    butins:[{ type:"Butin de monstre", objets:["Minerai", "Sceau de Liones"] }]
  });
  assert.equal(banakro.source, "butins · données du jeu du 22/09/2026");
  /* Un meme nom, plusieurs facons d'obtenir : toutes, dans une reponse. */
  assert.deepEqual((await o.executer("butin", { nom:"Mine de Ferzen" })).donnees.butins, [
    { type:"Donjon", objets:["Or"] },
    { type:"Donjon", detail:"première victoire", objets:["Épée longue"] }
  ]);
  assert.deepEqual((await o.executer("butin", { nom:"mouette" })).donnees.butins,
    [{ type:"Capture", objets:["Potion"] }]);
  /* Des noms differents de meme rang : la liste, sans choisir. */
  assert.deepEqual((await o.executer("butin", { nom:"de" })).donnees, {
    recherche:"de", correspondances:3,
    candidats:["Minerai de fer", "Boss de confrérie", "Mine de Ferzen (Normal)"]
  });
  const sansButin = await o.executer("butin", { nom:"dragon" });
  assert.equal(sansButin.donnees.introuvable, "dragon");
  assert.ok(Array.isArray(sansButin.donnees.proches));
  assert.deepEqual((await o.executer("butin", {})).donnees, { erreur:"nom de source manquant" });

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
