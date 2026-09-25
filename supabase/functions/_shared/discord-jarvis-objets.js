"use strict";

/* Les objets et les boutiques de /jarvis : validation du fichier du bucket
   prive et deux outils en lecture seule.

   Le catalogue est fabrique sur le poste du proprietaire
   (outils/fabrication/extraire-objets.js) et depose dans le bucket PRIVE
   jarvis-prive. Il n'est ni dans le depot ni sur Pages : seule la cle
   service_role de l'Edge Function le lit.

   Pour l'instant les seules sources sont les boutiques : une source absente
   ne prouve pas qu'un objet est introuvable, les butins viendront. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_DISCORD_JARVIS_MONSTRES) require("./discord-jarvis-monstres.js");
  if(!globalThis.NOVA_DISCORD_JARVIS_MECANIQUES) require("./discord-jarvis-mecaniques.js");
}

const { normaliserRecherche, propositions } = globalThis.NOVA_DISCORD_BUILD;
const { rangCorrespondanceJarvis, dateLisibleJarvis, sourceDateeJarvis } = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;
const { motsProchesMecanique } = globalThis.NOVA_DISCORD_JARVIS_MECANIQUES;

const CHEMIN_OBJETS_JARVIS = "jarvis-prive/objets.json";
/* Plafonds des resultats : chaque ligne envoyee coute du quota gratuit. */
const SOURCES_MAX_OBJET = 12;
const CANDIDATS_MAX_OBJET = 10;
const ARTICLES_MAX_BOUTIQUE = 40;
const BOUTIQUES_LISTE_MAX = 30;
const LIGNE_OBJET_MAX = 200;
const INDISPONIBLE_OBJETS = { erreur:"données des objets indisponibles" };
const NOTE_ALEATOIRE = "articles tirés au hasard : la boutique peut les proposer, pas toujours";
const OBJETS_MAX_BUTIN = 40;
const NOTE_PROBABILITES = "chance à chaque victoire ou récolte, lue dans les tables et selon le niveau de monde ;"
  + " un objet sans chance indiquée : ne cite aucun chiffre";
const RECETTES_MAX_OBJET = 5;
const NOTE_FILONS = "filons comptés dans les tables d'apparition du monde ouvert ; maximum par jour :"
  + " chaque filon récolté une fois";
/* Les sources de butin (lot 2c, etape 2) et leur nom affiche. */
const TYPES_BUTIN = {
  monstre:"Butin de monstre", capture:"Capture", minage:"Minage",
  donjon:"Donjon", confrerie:"Boss de confrérie", cube:"Cube de récompense"
};

/* ---------------- Validation du fichier ---------------- */

function estObjetObjets(valeur) {
  return Boolean(valeur) && typeof valeur === "object" && !Array.isArray(valeur);
}
function texteObjets(valeur) {
  return typeof valeur === "string" && valeur.trim() !== "";
}
function texteOuAbsentObjets(valeur) {
  return valeur === undefined || texteObjets(valeur);
}
function quantiteValideObjets(valeur) {
  return valeur === undefined || (Number.isInteger(valeur) && valeur > 1);
}

function sourceObjetValide(source) {
  if(estObjetObjets(source) && Object.prototype.hasOwnProperty.call(TYPES_BUTIN, source.type)){
    return texteObjets(source.origine) && texteOuAbsentObjets(source.detail)
      && texteOuAbsentObjets(source.taux);
  }
  if(estObjetObjets(source) && source.type === "recette") return texteObjets(source.origine);
  return estObjetObjets(source) && source.type === "boutique"
    && texteObjets(source.boutique) && texteObjets(source.prix)
    && quantiteValideObjets(source.quantite)
    && texteOuAbsentObjets(source.limite) && texteOuAbsentObjets(source.condition)
    && (source.aleatoire === undefined || source.aleatoire === true);
}

function articleValide(article) {
  return estObjetObjets(article) && texteObjets(article.objet) && texteObjets(article.prix)
    && quantiteValideObjets(article.quantite)
    && texteOuAbsentObjets(article.limite) && texteOuAbsentObjets(article.condition);
}

function objetValide(objet) {
  return estObjetObjets(objet) && texteObjets(objet.nom) && texteObjets(objet.type)
    && Array.isArray(objet.sources) && objet.sources.length > 0 && objet.sources.every(sourceObjetValide);
}

function boutiqueValide(boutique) {
  return estObjetObjets(boutique) && texteObjets(boutique.nom) && texteObjets(boutique.genre)
    && (boutique.acces === "pnj" || boutique.acces === "menu")
    && Array.isArray(boutique.pnj) && boutique.pnj.every(texteObjets)
    && Array.isArray(boutique.regions) && boutique.regions.every(texteObjets)
    && (boutique.aleatoire === undefined || boutique.aleatoire === true)
    && Array.isArray(boutique.articles) && boutique.articles.every(articleValide);
}

function textesParObjetValides(valeur) {
  return valeur === undefined || (estObjetObjets(valeur) && Object.values(valeur).every(texteObjets));
}

function butinValide(butin) {
  return estObjetObjets(butin) && texteObjets(butin.nom)
    && Object.prototype.hasOwnProperty.call(TYPES_BUTIN, butin.type)
    && texteOuAbsentObjets(butin.detail)
    && Array.isArray(butin.objets) && butin.objets.length > 0 && butin.objets.every(texteObjets)
    && textesParObjetValides(butin.taux) && textesParObjetValides(butin.quantites)
    && textesParObjetValides(butin.parJour)
    && (butin.filons === undefined || (estObjetObjets(butin.filons)
      && Number.isInteger(butin.filons.total) && butin.filons.total > 0
      && Array.isArray(butin.filons.regions) && butin.filons.regions.every(texteObjets)));
}

function recetteValide(recette) {
  return estObjetObjets(recette) && texteObjets(recette.produit) && texteObjets(recette.type)
    && quantiteValideObjets(recette.quantite)
    && Array.isArray(recette.ingredients) && recette.ingredients.length > 0
    && recette.ingredients.every(texteObjets);
}

/* Rend null si le fichier est bon, sinon le motif du refus : le lecteur de
   stockage commun le journalise et garde l'echec une minute. */
function validerCatalogueObjets(brut) {
  if(!brut || brut.version !== 1 || !Array.isArray(brut.objets) || !Array.isArray(brut.boutiques)){
    return "format de objets.json inconnu : " + (brut && brut.version);
  }
  const objet = brut.objets.findIndex(entree => !objetValide(entree));
  if(objet >= 0) return "objets.json : objet mal formé (indice " + objet + ")";
  const boutique = brut.boutiques.findIndex(entree => !boutiqueValide(entree));
  if(boutique >= 0) return "objets.json : boutique mal formée (indice " + boutique + ")";
  /* Facultatif : un fichier d'avant les butins reste lisible. */
  if(brut.butins !== undefined){
    if(!Array.isArray(brut.butins)) return "objets.json : butins mal formés";
    const butin = brut.butins.findIndex(entree => !butinValide(entree));
    if(butin >= 0) return "objets.json : butin mal formé (indice " + butin + ")";
  }
  if(brut.recettes !== undefined){
    if(!Array.isArray(brut.recettes)) return "objets.json : recettes mal formées";
    const recette = brut.recettes.findIndex(entree => !recetteValide(entree));
    if(recette >= 0) return "objets.json : recette mal formée (indice " + recette + ")";
  }
  return null;
}

/* ---------------- Mise en mots ---------------- */

/* « 50 000 », comme les prix de l'extraction. */
function quantiteLisibleObjets(nombre) {
  return Number(nombre).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ");
}

function texteBorneObjets(texte) {
  const lettres = Array.from(String(texte));
  return lettres.length > LIGNE_OBJET_MAX
    ? lettres.slice(0, LIGNE_OBJET_MAX - 1).join("").trimEnd() + "…"
    : lettres.join("");
}

/* « Boutique d'equipement — Liones (Alexander, Karim ; Liones (Plaines de
   Liones)) : 1 800 Or, 3 par jour ». Le PNJ deja dans le nom n'est pas
   repete. */
function ligneSourceObjet(source, boutiquesParNom, butin) {
  /* « Butin de monstre : Banakro », « Donjon : Mines de Ferzen (Normal),
     premiere victoire », « Boss de confrerie, palier de participation 5 ». */
  if(source.type === "recette") return texteBorneObjets("Recette : " + source.origine);
  if(Object.prototype.hasOwnProperty.call(TYPES_BUTIN, source.type)){
    const libelle = TYPES_BUTIN[source.type];
    const suite = butin ? [
      butin.taux ? "chance " + butin.taux : null,
      butin.quantite ? "quantité " + butin.quantite : null,
      butin.filons ? butin.filons + " filons" : null,
      butin.parJour ? "au plus " + butin.parJour + " par jour" : null
    ].filter(Boolean) : [];
    return texteBorneObjets(libelle + (source.origine !== libelle ? " : " + source.origine : "")
      + (source.detail ? ", " + source.detail : "") + (suite.length ? ", " + suite.join(", ") : ""));
  }
  const boutique = boutiquesParNom.get(source.boutique);
  const precisions = [];
  if(boutique && boutique.acces === "menu"){
    precisions.push("depuis un menu");
  }else if(boutique){
    const pnj = boutique.pnj.filter(nom => !boutique.nom.includes(nom));
    if(pnj.length) precisions.push(pnj.join(", "));
    if(boutique.regions.length) precisions.push(boutique.regions.join(", "));
  }
  const suite = [source.limite, source.condition, source.aleatoire ? "article tiré au hasard" : null].filter(Boolean);
  return texteBorneObjets(source.boutique
    + (precisions.length ? " (" + precisions.join(" ; ") + ")" : "")
    + " : " + (source.quantite ? "x" + quantiteLisibleObjets(source.quantite) + " pour " : "") + source.prix
    + (suite.length ? ", " + suite.join(", ") : ""));
}

function ligneArticle(article) {
  const suite = [article.limite, article.condition].filter(Boolean);
  return texteBorneObjets(article.objet + (article.quantite ? " x" + quantiteLisibleObjets(article.quantite) : "")
    + " : " + article.prix + (suite.length ? ", " + suite.join(", ") : ""));
}

/* ---------------- Outils ---------------- */

async function outilOuTrouver(lireObjets, args) {
  const catalogue = await lireObjets();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_OBJETS);
  const cherche = normaliserRecherche(args.objet);
  if(!cherche) return { erreur:"nom d'objet manquant" };
  const classes = catalogue.objets
    .map(objet => ({ objet, rang:rangCorrespondanceJarvis(objet.nom, cherche) }))
    .filter(entree => entree.rang > 0);
  let trouves;
  let approche = false;
  if(classes.length){
    const meilleur = Math.max(...classes.map(entree => entree.rang));
    trouves = classes.filter(entree => entree.rang === meilleur).map(entree => entree.objet);
  }else{
    /* Une faute de frappe (« minerais ») : les noms dont un mot est proche. */
    trouves = catalogue.objets.filter(objet => motsProchesMecanique(cherche, objet.nom));
    approche = true;
  }
  if(!trouves.length){
    return {
      introuvable:String(args.objet),
      proches:propositions(catalogue.objets.map(objet => objet.nom), args.objet)
    };
  }
  trouves.sort((a, b) => a.nom.length - b.nom.length || a.nom.localeCompare(b.nom, "fr"));
  /* Plusieurs objets possibles : la liste, sans en choisir un a la place
     du membre. */
  if(trouves.length > 1){
    return {
      recherche:String(args.objet), correspondances:trouves.length,
      candidats:trouves.slice(0, CANDIDATS_MAX_OBJET).map(objet => objet.nom)
    };
  }
  const objet = trouves[0];
  const boutiquesParNom = new Map(catalogue.boutiques.map(boutique => [boutique.nom, boutique]));
  /* Chance, quantite et filons d'un butin vivent dans `butins` : une seule
     copie dans le fichier. */
  const butinsParCle = new Map((catalogue.butins || []).map(butin =>
    [butin.type + "|" + butin.nom + "|" + (butin.detail || ""), butin]));
  const pour = (table, nom) => table && Object.prototype.hasOwnProperty.call(table, nom) ? table[nom] : null;
  const butinDe = source => {
    const butin = butinsParCle.get(source.type + "|" + source.origine + "|" + (source.detail || ""));
    if(!butin) return null;
    return {
      taux:pour(butin.taux, objet.nom), quantite:pour(butin.quantites, objet.nom),
      filons:butin.filons ? butin.filons.total : null, parJour:pour(butin.parJour, objet.nom)
    };
  };
  const resultat = { nom:objet.nom, type:objet.type, donneesDu:dateLisibleJarvis(catalogue) };
  if(approche) resultat.nomApproche = "nom le plus proche de « " + String(args.objet) + " »";
  resultat.sources = objet.sources.slice(0, SOURCES_MAX_OBJET)
    .map(source => ligneSourceObjet(source, boutiquesParNom, butinDe(source)));
  if(objet.sources.length > SOURCES_MAX_OBJET) resultat.autresSources = objet.sources.length - SOURCES_MAX_OBJET;
  return resultat;
}

function regionsDe(boutiques) {
  return [...new Set(boutiques.flatMap(boutique => boutique.regions))].slice(0, BOUTIQUES_LISTE_MAX);
}

async function outilBoutique(lireObjets, args) {
  const catalogue = await lireObjets();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_OBJETS);
  const cherche = normaliserRecherche(args.nom);
  if(!cherche) return { erreur:"nom de boutique manquant" };
  /* Le nom propre ou le nom du jeu : « boutique d'equipement » designe
     toutes les boutiques d'equipement, meme celle qui porte ce nom nu. */
  const classes = catalogue.boutiques
    .map(boutique => ({ boutique, rang:Math.max(
      rangCorrespondanceJarvis(boutique.nom, cherche), rangCorrespondanceJarvis(boutique.genre, cherche)) }))
    .filter(entree => entree.rang > 0);
  if(!classes.length){
    return {
      introuvable:String(args.nom),
      boutiques:catalogue.boutiques.slice(0, BOUTIQUES_LISTE_MAX).map(boutique => boutique.nom)
    };
  }
  const meilleur = Math.max(...classes.map(entree => entree.rang));
  let trouvees = classes.filter(entree => entree.rang === meilleur).map(entree => entree.boutique);
  const region = normaliserRecherche(args.region);
  if(region){
    const dansRegion = trouvees.filter(boutique =>
      normaliserRecherche(boutique.nom + " " + boutique.regions.join(" ")).includes(region));
    if(!dansRegion.length){
      return { erreur:"aucune boutique de ce nom dans cette région", regionsPossibles:regionsDe(trouvees) };
    }
    trouvees = dansRegion;
  }
  if(trouvees.length > 1){
    return {
      recherche:String(args.nom), correspondances:trouvees.length,
      boutiques:trouvees.slice(0, BOUTIQUES_LISTE_MAX).map(boutique => boutique.nom),
      regionsPossibles:regionsDe(trouvees)
    };
  }
  const boutique = trouvees[0];
  const resultat = {
    nom:boutique.nom, genre:boutique.genre,
    acces:boutique.acces === "menu" ? "depuis un menu" : "auprès d'un PNJ",
    pnj:boutique.pnj, regions:boutique.regions, donneesDu:dateLisibleJarvis(catalogue)
  };
  if(boutique.aleatoire) resultat.noteAleatoire = NOTE_ALEATOIRE;
  resultat.articles = boutique.articles.slice(0, ARTICLES_MAX_BOUTIQUE).map(ligneArticle);
  if(boutique.articles.length > ARTICLES_MAX_BOUTIQUE){
    resultat.autresArticles = boutique.articles.length - ARTICLES_MAX_BOUTIQUE;
  }
  return resultat;
}

async function outilButin(lireObjets, args) {
  const catalogue = await lireObjets();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_OBJETS);
  const cherche = normaliserRecherche(args.nom);
  if(!cherche) return { erreur:"nom de source manquant" };
  const butins = catalogue.butins || [];
  const noms = [...new Set(butins.map(butin => butin.nom))];
  const classes = noms.map(nom => ({ nom, rang:rangCorrespondanceJarvis(nom, cherche) }))
    .filter(entree => entree.rang > 0);
  if(!classes.length){
    return { introuvable:String(args.nom), proches:propositions(noms, args.nom) };
  }
  const meilleur = Math.max(...classes.map(entree => entree.rang));
  const trouves = classes.filter(entree => entree.rang === meilleur).map(entree => entree.nom)
    .sort((a, b) => a.length - b.length || a.localeCompare(b, "fr"));
  if(trouves.length > 1){
    return { recherche:String(args.nom), correspondances:trouves.length, candidats:trouves.slice(0, CANDIDATS_MAX_OBJET) };
  }
  /* Toutes les facons d'obtenir aupres de cette source : recompense et
     premiere victoire d'un donjon, butin et capture d'un monstre. */
  const retenus = butins.filter(butin => butin.nom === trouves[0]);
  const resultat = { nom:trouves[0], donneesDu:dateLisibleJarvis(catalogue), noteProbabilites:NOTE_PROBABILITES };
  if(retenus.some(butin => butin.filons)) resultat.noteFilons = NOTE_FILONS;
  resultat.butins = retenus.map(butin => {
    const sortie = { type:TYPES_BUTIN[butin.type] };
    if(butin.detail) sortie.detail = butin.detail;
    const taux = butin.taux || {};
    const quantites = butin.quantites || {};
    sortie.objets = butin.objets.slice(0, OBJETS_MAX_BUTIN).map(objet => {
      const precisions = [
        Object.prototype.hasOwnProperty.call(taux, objet) ? taux[objet] : null,
        Object.prototype.hasOwnProperty.call(quantites, objet) ? "quantité " + quantites[objet] : null
      ].filter(Boolean);
      return precisions.length ? objet + " — " + precisions.join(", ") : objet;
    });
    if(butin.objets.length > OBJETS_MAX_BUTIN) sortie.autresObjets = butin.objets.length - OBJETS_MAX_BUTIN;
    if(butin.filons){
      sortie.filons = texteBorneObjets(butin.filons.total + " filons (" + butin.filons.regions.join(" ; ") + ")");
    }
    if(butin.parJour) sortie.maximumParJour = Object.entries(butin.parJour).map(([nom, nombre]) => nom + " : " + nombre);
    return sortie;
  });
  return resultat;
}

async function outilRecette(lireObjets, args) {
  const catalogue = await lireObjets();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_OBJETS);
  const cherche = normaliserRecherche(args.objet);
  if(!cherche) return { erreur:"nom d'objet manquant" };
  const recettes = catalogue.recettes || [];
  const produits = [...new Set(recettes.map(recette => recette.produit))];
  const classes = produits.map(nom => ({ nom, rang:rangCorrespondanceJarvis(nom, cherche) }))
    .filter(entree => entree.rang > 0);
  if(!classes.length){
    return { introuvable:String(args.objet), proches:propositions(produits, args.objet) };
  }
  const meilleur = Math.max(...classes.map(entree => entree.rang));
  const trouves = classes.filter(entree => entree.rang === meilleur).map(entree => entree.nom)
    .sort((a, b) => a.length - b.length || a.localeCompare(b, "fr"));
  if(trouves.length > 1){
    return { recherche:String(args.objet), correspondances:trouves.length, candidats:trouves.slice(0, CANDIDATS_MAX_OBJET) };
  }
  const siennes = recettes.filter(recette => recette.produit === trouves[0]);
  const resultat = {
    produit:trouves[0], donneesDu:dateLisibleJarvis(catalogue),
    recettes:siennes.slice(0, RECETTES_MAX_OBJET).map(recette => {
      const sortie = { type:recette.type };
      if(recette.quantite) sortie.quantite = recette.quantite;
      sortie.ingredients = recette.ingredients;
      return sortie;
    })
  };
  if(siennes.length > RECETTES_MAX_OBJET) resultat.autresRecettes = siennes.length - RECETTES_MAX_OBJET;
  return resultat;
}

const DECLARATIONS_OUTILS_OBJETS = [
  {
    name:"ou_trouver",
    description:"Où obtenir un objet du jeu (équipement, matériau, consommable, monnaie) :"
      + " boutiques (prix, limites d'achat), butins de monstres, captures, minage, donjons"
      + ", boss de confrérie et recettes. Données lues dans les fichiers du jeu.",
    parameters:{
      type:"OBJECT",
      properties:{
        objet:{ type:"STRING", description:"Nom de l'objet, même approximatif (ex. « épée longue d'aventurier »)." }
      },
      required:["objet"]
    }
  },
  {
    name:"boutique",
    description:"Articles d'une boutique du jeu (équipement, articles divers, cuisine, sceaux,"
      + " échange, itinérante, confrérie, événements) : prix, monnaie, limites d'achat,"
      + " PNJ et région.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom de la boutique (ex. « boutique d'équipement », « boutique de la confrérie »)." },
        region:{ type:"STRING", description:"Facultatif : région de la boutique (ex. « Liones », « Vanya »)." }
      },
      required:["nom"]
    }
  },
  {
    name:"butin",
    description:"Ce que peut donner une source du jeu : monstre (butin, capture, et cube de"
      + " récompense des boss de zone et des élites, avec les clés pour l'ouvrir), point de"
      + " minage, donjon (récompense et première victoire), boss de confrérie (paliers de"
      + " participation), avec la chance d'obtention et la quantité quand les tables les donnent ;"
      + " pour un minerai : nombre de filons par région et maximum par jour.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom du monstre, du donjon ou du point de minage (ex. « Banakro », « Mines de Ferzen »)." }
      },
      required:["nom"]
    }
  },
  {
    name:"recette",
    description:"Comment fabriquer, cuisiner ou graver un objet : type de recette (cuisine,"
      + " établi, gravure, combinaison) et ingrédients, avec leurs alternatives.",
    parameters:{
      type:"OBJECT",
      properties:{
        objet:{ type:"STRING", description:"Nom de l'objet à produire (ex. « beignets protéinés », « établi robuste »)." }
      },
      required:["objet"]
    }
  }
];

function sourceObjetsJarvis(donnees) {
  return "boutiques" + (donnees && donnees.donneesDu ? " · données du jeu du " + donnees.donneesDu : "");
}

function ajouterOutilsObjetsJarvis(table, lireObjets) {
  /* Boutiques, butins et recettes : la source nomme l'objet, pas un seul
     type d'origine. */
  table.ou_trouver = {
    executer:args => outilOuTrouver(lireObjets, args),
    source:(args, donnees) =>
      sourceDateeJarvis("où trouver ", (donnees && donnees.nom) || args.objet || "?", donnees || {})
  };
  table.boutique = {
    executer:args => outilBoutique(lireObjets, args),
    source:(args, donnees) => sourceObjetsJarvis(donnees)
  };
  table.recette = {
    executer:args => outilRecette(lireObjets, args),
    source:(args, donnees) => "recettes"
      + (donnees && donnees.donneesDu ? " · données du jeu du " + donnees.donneesDu : "")
  };
  table.butin = {
    executer:args => outilButin(lireObjets, args),
    source:(args, donnees) => "butins"
      + (donnees && donnees.donneesDu ? " · données du jeu du " + donnees.donneesDu : "")
  };
}

const discordJarvisObjetsApi = {
  CHEMIN_OBJETS_JARVIS,
  DECLARATIONS_OUTILS_OBJETS,
  validerCatalogueObjets,
  ajouterOutilsObjetsJarvis
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisObjetsApi;
}
globalThis.NOVA_DISCORD_JARVIS_OBJETS = discordJarvisObjetsApi;
