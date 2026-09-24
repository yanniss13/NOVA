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
      && typeof variante.cible === "string"
      && NATURES_MECANIQUES.includes(variante.nature)
      && typeof variante.description === "string");
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

/* Le jeu reutilise un nom pour des buffs de natures ou de descriptions
   differentes : une variante qui s'ecarte de l'effet le dit. */
function varianteLisible(variante, effet) {
  const lisible = { cible:LIBELLES_CIBLE[variante.cible] || variante.cible };
  if(variante.nature !== effet.nature) lisible.nature = LIBELLES_NATURE[variante.nature];
  if(variante.description !== effet.description) lisible.description = variante.description;
  lisible.valeurs = variante.valeurs.map(valeur => valeur.stat + " : " + valeur.valeur);
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

function distanceMecanique(a, b) {
  let precedente = Array.from({ length:b.length + 1 }, (_, j) => j);
  for(let i = 1; i <= a.length; i++){
    const courante = [i];
    for(let j = 1; j <= b.length; j++){
      courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1,
        precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    precedente = courante;
  }
  return precedente[b.length];
}

/* Le jeu ecrit « Clotho » et « Derrierie » la ou le wiki dit « Klotho » et
   « Derieri ». Un mot d'au moins 5 lettres admet une faute, 2 a partir de 7 :
   assez pour ces noms, trop peu pour confondre deux mots courts. */
function motsProchesMecanique(cherche, sujet) {
  const motsSujet = normaliserRecherche(sujet).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return cherche.split(/\s+/).filter(mot => mot.length >= 5).some(mot =>
    motsSujet.some(autre => distanceMecanique(mot, autre) <= (mot.length >= 7 ? 2 : 1)));
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
  const classes = catalogue.effets
    .map(effet => ({ effet, rang:rangCorrespondanceJarvis(effet.nom, cherche) }))
    .filter(entree => entree.rang > 0);
  if(!classes.length){
    return {
      introuvable:String(args.nom === undefined ? "" : args.nom),
      proches:propositions(catalogue.effets.map(effet => effet.nom), args.nom)
    };
  }
  /* Un nom exact gagne toujours. Sinon le mot est partiel (« attaque ») :
     l'effet qu'un heros pose passe avant celui dont le nom commence
     seulement par le mot — sans quoi « attaque » rendait « Attaque totale
     ultime », un bonus de duree, et cachait « Augmentation de l'attaque ». */
  const exact = classes.some(entree => entree.rang === 4);
  const trouves = (exact ? classes.filter(entree => entree.rang === 4) : classes)
    .sort((a, b) => Number(aUnPorteur(b.effet)) - Number(aUnPorteur(a.effet))
      || b.rang - a.rang || a.effet.nom.length - b.effet.nom.length
      || a.effet.nom.localeCompare(b.effet.nom, "fr"))
    .map(entree => entree.effet);
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
  if(!exact){
    resultat.nomPartiel = "nom partiel : si ce n'est pas l'effet voulu, cite les autres"
      + " correspondances ou utilise chercher_effets";
  }
  resultat.totalVariantes = effet.variantes.length;
  resultat.variantes = effet.variantes.slice(0, EFFET_VARIANTES_MAX)
    .map(variante => varianteLisible(variante, effet));
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
    /* Nature et heros filtrent les VARIANTES : un malus range sous un nom
       de buff reste trouvable comme malus. */
    const variantes = effet.variantes.filter(variante =>
      (!nature || variante.nature === nature) && (!heros || variante.posePar.some(deCeHeros)));
    if(!variantes.length) return;
    const foin = [effet.nom]
      .concat(variantes.map(variante => variante.description))
      .concat(variantes.flatMap(variante => variante.valeurs.map(valeur => valeur.stat)))
      .map(normaliserRecherche).join(" | ");
    if(!termes.some(terme => terme.split(/\s+/).every(mot => foin.includes(mot)))) return;
    const porteurs = [];
    variantes.forEach(variante => variante.posePar.forEach(porteur => {
      if(!deCeHeros(porteur)) return;
      const ligne = porteur.heros + " — " + porteur.competence;
      if(!porteurs.includes(ligne)) porteurs.push(ligne);
    }));
    const trouve = {
      nom:effet.nom,
      nature:LIBELLES_NATURE[variantes[0].nature],
      description:variantes[0].description,
      cibles:[...new Set(variantes.map(variante => LIBELLES_CIBLE[variante.cible] || variante.cible))],
      porteurs:porteurs.slice(0, EFFETS_PORTEURS_RESUME_MAX)
    };
    if(porteurs.length > EFFETS_PORTEURS_RESUME_MAX){
      trouve.autresPorteurs = porteurs.length - EFFETS_PORTEURS_RESUME_MAX;
    }
    trouves.push({ trouve, rang:rangCorrespondanceJarvis(effet.nom, cherche) });
  });
  /* Un membre cherche d'abord qui POSE l'effet, puis l'effet dont le NOM
     porte le mot : « attaque » ne commence plus par « Altération ». */
  trouves.sort((a, b) => Number(b.trouve.porteurs.length > 0) - Number(a.trouve.porteurs.length > 0)
    || b.rang - a.rang || a.trouve.nom.localeCompare(b.trouve.nom, "fr"));
  const resultat = {
    texte:String(args.texte),
    donneesDu:dateLisibleJarvis(catalogue),
    total:trouves.length,
    effets:trouves.slice(0, EFFETS_RESULTATS_MAX).map(entree => entree.trouve)
  };
  if(trouves.length > EFFETS_RESULTATS_MAX){
    resultat.suite = "seuls les " + EFFETS_RESULTATS_MAX + " premiers effets sont listés :"
      + " préciser le mot, la nature ou le héros pour affiner";
  }
  return resultat;
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
    const approchees = catalogue.regles.filter(regle => motsProchesMecanique(cherche, regle.sujet));
    if(approchees.length){
      return {
        donneesDu:dateLisibleJarvis(catalogue),
        orthographeProche:true,
        sujets:approchees.slice(0, REGLES_SUJETS_MAX).map(regle => ({
          sujet:regle.sujet, texte:texteBorneRegle(regle.pages.join("\n\n"))
        }))
      };
    }
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
