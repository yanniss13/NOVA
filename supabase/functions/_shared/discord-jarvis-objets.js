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
const { rangCorrespondanceJarvis, dateLisibleJarvis } = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;
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
function ligneSourceObjet(source, boutiquesParNom) {
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
  const resultat = { nom:objet.nom, type:objet.type, donneesDu:dateLisibleJarvis(catalogue) };
  if(approche) resultat.nomApproche = "nom le plus proche de « " + String(args.objet) + " »";
  resultat.sources = objet.sources.slice(0, SOURCES_MAX_OBJET)
    .map(source => ligneSourceObjet(source, boutiquesParNom));
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

const DECLARATIONS_OUTILS_OBJETS = [
  {
    name:"ou_trouver",
    description:"Où obtenir un objet du jeu (équipement, matériau, consommable, monnaie) :"
      + " boutiques qui le vendent, prix, limites d'achat. Les butins de monstres et les"
      + " recettes ne sont pas encore couverts. Données lues dans les fichiers du jeu.",
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
  }
];

function sourceObjetsJarvis(donnees) {
  return "boutiques" + (donnees && donnees.donneesDu ? " · données du jeu du " + donnees.donneesDu : "");
}

function ajouterOutilsObjetsJarvis(table, lireObjets) {
  table.ou_trouver = {
    executer:args => outilOuTrouver(lireObjets, args),
    source:(args, donnees) => sourceObjetsJarvis(donnees)
  };
  table.boutique = {
    executer:args => outilBoutique(lireObjets, args),
    source:(args, donnees) => sourceObjetsJarvis(donnees)
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
