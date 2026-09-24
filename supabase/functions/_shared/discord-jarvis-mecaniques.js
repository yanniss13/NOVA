"use strict";

/* Les effets du jeu et ses regles pour /jarvis : trois outils en lecture
   seule sur mecaniques.json, fabrique sur le poste du proprietaire
   (outils/fabrication/extraire-mecaniques.js) et depose dans le bucket
   PRIVE jarvis-prive.

   Les chiffres de la description d'une competence priment : les tables
   ajoutent la cible, le cumul et la duree. « nom absent de la description »
   ne dit PAS qu'un effet est cache : la prose le decrit souvent avec
   d'autres mots. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_DISCORD_JARVIS_MONSTRES) require("./discord-jarvis-monstres.js");
}

const { normaliserRecherche, propositions } = globalThis.NOVA_DISCORD_BUILD;
const {
  rangCorrespondanceJarvis, dateLisibleJarvis, sourceDateeJarvis, elementDeSaisieMonstre
} = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;

const CHEMIN_MECANIQUES_JARVIS = "jarvis-prive/mecaniques.json";
/* Plafonds des resultats : chaque ligne envoyee coute du quota gratuit. */
const EFFET_VARIANTES_MAX = 6;
const EFFET_PORTEURS_MAX = 10;
const EFFETS_RESULTATS_MAX = 12;
const EFFETS_PORTEURS_RESUME_MAX = 6;
const REGLES_SUJETS_MAX = 3;
const REGLES_AUTRES_MAX = 10;
const REGLES_PROCHES_MAX = 20;
const REGLE_TEXTE_MAX = 1_500;
const NATURES_MECANIQUES = ["buff", "malus", "controle"];
const LIBELLES_NATURE = { buff:"Buff", malus:"Malus", controle:"Contrôle" };
const LIBELLES_CIBLE = { equipe:"toute l'équipe", porteur:"le porteur", ennemi:"l'ennemi" };
const NATURES_SAISIE = {
  buff:"buff", bonus:"buff", malus:"malus", debuff:"malus", controle:"controle", cc:"controle"
};
const NOTE_NON_CITE = "nom absent de la description";
const INDISPONIBLE_MECANIQUES = { erreur:"données des mécaniques indisponibles" };

/* ---------------- Validation du fichier ---------------- */

function estObjetMecanique(valeur) {
  return Boolean(valeur) && typeof valeur === "object" && !Array.isArray(valeur);
}

function effetValide(effet) {
  return estObjetMecanique(effet)
    && typeof effet.nom === "string" && effet.nom.trim() !== ""
    && NATURES_MECANIQUES.includes(effet.nature)
    && typeof effet.description === "string"
    && Array.isArray(effet.variantes)
    && effet.variantes.every(variante => estObjetMecanique(variante)
      && Array.isArray(variante.valeurs) && Array.isArray(variante.posePar)
      && typeof variante.cible === "string");
}

function sujetValide(regle) {
  return estObjetMecanique(regle)
    && typeof regle.sujet === "string" && regle.sujet.trim() !== ""
    && Array.isArray(regle.pages) && regle.pages.every(page => typeof page === "string");
}

/* Rend null si le fichier est bon, sinon le motif du refus. */
function validerCatalogueMecaniques(brut) {
  if(!brut || brut.version !== 1 || !Array.isArray(brut.effets) || !Array.isArray(brut.regles)){
    return "format de mecaniques.json inconnu : " + (brut && brut.version);
  }
  const effet = brut.effets.find(entree => !effetValide(entree));
  if(effet !== undefined){
    return "entrée mal formée dans mecaniques.json : " + String((effet && effet.nom) || "?").slice(0, 40);
  }
  const regle = brut.regles.find(entree => !sujetValide(entree));
  if(regle !== undefined){
    return "sujet mal formé dans mecaniques.json : " + String((regle && regle.sujet) || "?").slice(0, 40);
  }
  return null;
}

/* ---------------- Mise en mots ---------------- */

function aUnPorteur(effet) {
  return effet.variantes.some(variante => variante.posePar.length > 0);
}

function varianteLisible(variante) {
  const lisible = {
    cible:LIBELLES_CIBLE[variante.cible] || variante.cible,
    valeurs:variante.valeurs.map(valeur => valeur.stat + " : " + valeur.valeur)
  };
  if(variante.duree !== undefined) lisible.duree = String(variante.duree).replace(".", ",") + " s";
  if(variante.cumulMax !== undefined) lisible.cumulMax = variante.cumulMax;
  if(variante.posePar.length){
    lisible.posePar = variante.posePar.slice(0, EFFET_PORTEURS_MAX).map(porteur =>
      porteur.heros + " (" + porteur.arme + ") — " + porteur.competence
      + (porteur.citeParDescription ? "" : " — " + NOTE_NON_CITE));
    if(variante.posePar.length > EFFET_PORTEURS_MAX){
      lisible.autresPorteurs = variante.posePar.length - EFFET_PORTEURS_MAX;
    }
  }
  return lisible;
}

function texteBorneRegle(texte) {
  const lettres = Array.from(texte);
  return lettres.length > REGLE_TEXTE_MAX
    ? lettres.slice(0, REGLE_TEXTE_MAX - 1).join("").trimEnd() + "…"
    : texte;
}

/* ---------------- Outils ---------------- */

async function outilFicheEffet(lireMecaniques, args) {
  const catalogue = await lireMecaniques();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MECANIQUES);
  const cherche = normaliserRecherche(args.nom);
  let meilleurRang = 0;
  let trouves = [];
  catalogue.effets.forEach(effet => {
    const rang = rangCorrespondanceJarvis(effet.nom, cherche);
    if(rang > meilleurRang){
      meilleurRang = rang;
      trouves = [effet];
    }else if(rang && rang === meilleurRang){
      trouves.push(effet);
    }
  });
  if(!trouves.length){
    return {
      introuvable:String(args.nom === undefined ? "" : args.nom),
      proches:propositions(catalogue.effets.map(effet => effet.nom), args.nom)
    };
  }
  /* A correspondance egale : un effet qu'un heros pose, puis le nom le plus
     court. */
  trouves.sort((a, b) => Number(aUnPorteur(b)) - Number(aUnPorteur(a))
    || a.nom.length - b.nom.length || a.nom.localeCompare(b.nom, "fr"));
  const effet = trouves[0];
  const resultat = {
    nom:effet.nom,
    nature:LIBELLES_NATURE[effet.nature],
    description:effet.description,
    donneesDu:dateLisibleJarvis(catalogue)
  };
  if(trouves.length > 1){
    resultat.correspondances = trouves.length;
    resultat.autresCorrespondances = trouves.slice(1, 6).map(autre => autre.nom);
  }
  resultat.totalVariantes = effet.variantes.length;
  resultat.variantes = effet.variantes.slice(0, EFFET_VARIANTES_MAX).map(varianteLisible);
  if(effet.variantes.length > EFFET_VARIANTES_MAX){
    resultat.suite = "seules les " + EFFET_VARIANTES_MAX + " premières variantes sont listées";
  }
  return resultat;
}

async function outilChercherEffets(lireMecaniques, args) {
  const catalogue = await lireMecaniques();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MECANIQUES);
  const cherche = normaliserRecherche(args.texte);
  if(!cherche) return { erreur:"texte à chercher manquant" };
  let nature = null;
  if(args.nature !== undefined && args.nature !== null && String(args.nature).trim()){
    nature = NATURES_SAISIE[normaliserRecherche(args.nature)] || null;
    if(!nature) return { erreur:"nature inconnue : buff, malus ou contrôle" };
  }
  const heros = normaliserRecherche(args.heros);
  const deCeHeros = porteur => !heros || normaliserRecherche(porteur.heros).startsWith(heros);
  /* « lumière » cherche aussi « Sacré » : le libelle des stats est en
     francais du jeu, pas dans les mots du membre. */
  const termes = [cherche];
  const element = elementDeSaisieMonstre(args.texte);
  if(element) termes.push(normaliserRecherche(element[1]));

  const trouves = [];
  catalogue.effets.forEach(effet => {
    if(nature && effet.nature !== nature) return;
    const variantes = heros
      ? effet.variantes.filter(variante => variante.posePar.some(deCeHeros))
      : effet.variantes;
    if(!variantes.length) return;
    const foin = [effet.nom, effet.description]
      .concat(effet.variantes.flatMap(variante => variante.valeurs.map(valeur => valeur.stat)))
      .map(normaliserRecherche).join(" | ");
    if(!termes.some(terme => terme.split(/\s+/).every(mot => foin.includes(mot)))) return;
    const porteurs = [];
    variantes.forEach(variante => variante.posePar.forEach(porteur => {
      if(!deCeHeros(porteur)) return;
      const ligne = porteur.heros + " — " + porteur.competence;
      if(!porteurs.includes(ligne)) porteurs.push(ligne);
    }));
    trouves.push({
      nom:effet.nom,
      nature:LIBELLES_NATURE[effet.nature],
      description:effet.description,
      cibles:[...new Set(variantes.map(variante => LIBELLES_CIBLE[variante.cible] || variante.cible))],
      porteurs:porteurs.slice(0, EFFETS_PORTEURS_RESUME_MAX)
    });
  });
  /* Un membre cherche d'abord qui POSE l'effet. */
  trouves.sort((a, b) => Number(b.porteurs.length > 0) - Number(a.porteurs.length > 0)
    || a.nom.localeCompare(b.nom, "fr"));
  return {
    texte:String(args.texte),
    donneesDu:dateLisibleJarvis(catalogue),
    total:trouves.length,
    effets:trouves.slice(0, EFFETS_RESULTATS_MAX)
  };
}

async function outilRegle(lireMecaniques, args) {
  const catalogue = await lireMecaniques();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MECANIQUES);
  const cherche = normaliserRecherche(args.sujet);
  if(!cherche) return { erreur:"sujet manquant" };
  const classes = catalogue.regles
    .map(regle => ({ regle, rang:rangCorrespondanceJarvis(regle.sujet, cherche) }))
    .filter(entree => entree.rang > 0)
    .sort((a, b) => b.rang - a.rang || a.regle.sujet.localeCompare(b.regle.sujet, "fr"));
  if(!classes.length){
    const mots = cherche.split(/\s+/).filter(mot => mot.length >= 3);
    const proches = catalogue.regles.map(regle => regle.sujet)
      .filter(sujet => mots.some(mot => normaliserRecherche(sujet).includes(mot)))
      .slice(0, REGLES_PROCHES_MAX);
    return proches.length
      ? { introuvable:String(args.sujet), proches }
      : { erreur:"aucune règle sur ce sujet" };
  }
  const resultat = {
    donneesDu:dateLisibleJarvis(catalogue),
    sujets:classes.slice(0, REGLES_SUJETS_MAX).map(({ regle }) => ({
      sujet:regle.sujet, texte:texteBorneRegle(regle.pages.join("\n\n"))
    }))
  };
  if(classes.length > REGLES_SUJETS_MAX){
    resultat.autresSujets = classes.slice(REGLES_SUJETS_MAX, REGLES_SUJETS_MAX + REGLES_AUTRES_MAX)
      .map(({ regle }) => regle.sujet);
  }
  return resultat;
}

const DECLARATIONS_OUTILS_MECANIQUES = [
  {
    name:"fiche_effet",
    description:"Fiche d'un effet du jeu (buff, malus ou contrôle : Pétrification, Éclaboussures,"
      + " Augmentation de l'attaque…) : description, valeurs, durée, cumul, cible, et les héros et"
      + " compétences qui le posent. Données lues dans les fichiers du jeu.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom de l'effet, même approximatif." }
      },
      required:["nom"]
    }
  },
  {
    name:"chercher_effets",
    description:"Cherche les effets du jeu par mot (« défense », « critique », « Foudre »…) et dit"
      + " quels héros les posent : répond à « qui réduit la défense ? ».",
    parameters:{
      type:"OBJECT",
      properties:{
        texte:{ type:"STRING", description:"Mot ou stat à chercher." },
        nature:{ type:"STRING", enum:["buff", "malus", "controle"],
          description:"Facultatif : buff, malus ou controle." },
        heros:{ type:"STRING", description:"Facultatif : ne garder que les effets posés par ce héros." }
      },
      required:["texte"]
    }
  },
  {
    name:"regle",
    description:"Textes officiels du jeu sur une règle ou une mécanique (Déluge, Contre, Relève,"
      + " jauge de stupeur…) et fiches d'aide par héros et par arme : journal des tutoriels,"
      + " fenêtres d'aide, astuces de chargement.",
    parameters:{
      type:"OBJECT",
      properties:{
        sujet:{ type:"STRING", description:"Sujet cherché (ex. « Déluge », « Contre », « Meliodas »)." }
      },
      required:["sujet"]
    }
  }
];

function ajouterOutilsMecaniquesJarvis(table, lireMecaniques) {
  table.fiche_effet = {
    executer:args => outilFicheEffet(lireMecaniques, args),
    source:(args, donnees) => sourceDateeJarvis("effet ", donnees.nom || args.nom || "?", donnees)
  };
  table.chercher_effets = {
    executer:args => outilChercherEffets(lireMecaniques, args),
    source:(args, donnees) => sourceDateeJarvis("recherche d'effets ", String(args.texte || "?"), donnees)
  };
  table.regle = {
    executer:args => outilRegle(lireMecaniques, args),
    source:(args, donnees) => sourceDateeJarvis("règle ",
      (donnees.sujets && donnees.sujets[0] && donnees.sujets[0].sujet) || args.sujet || "?", donnees)
  };
}

const discordJarvisMecaniquesApi = {
  CHEMIN_MECANIQUES_JARVIS,
  DECLARATIONS_OUTILS_MECANIQUES,
  validerCatalogueMecaniques,
  ajouterOutilsMecaniquesJarvis
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisMecaniquesApi;
}
globalThis.NOVA_DISCORD_JARVIS_MECANIQUES = discordJarvisMecaniquesApi;
