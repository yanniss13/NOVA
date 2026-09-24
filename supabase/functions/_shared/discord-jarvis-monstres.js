"use strict";

/* Les monstres et boss de /jarvis : validation du fichier du bucket prive et deux outils.

   Le catalogue est fabrique sur le poste du proprietaire
   (outils/fabrication/extraire-monstres.js) et depose dans le bucket PRIVE
   jarvis-prive. Il n'est ni dans le depot ni sur Pages : seule la cle
   service_role de l'Edge Function le lit.

   Signe confirme en jeu : une valeur positive est une faiblesse, une valeur
   negative une resistance. Les PV, la defense et l'attaque sont des valeurs
   de BASE : le niveau de monde les ajuste cote serveur, et aucune table
   exportee ne dit comment. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
}

const { normaliserRecherche, propositions } = globalThis.NOVA_DISCORD_BUILD;

const CHEMIN_MONSTRES_JARVIS = "jarvis-prive/monstres.json";
const MONSTRES_VERSIONS_MAX = 5;
const MONSTRES_RESULTATS_MAX = 15;
const NOTE_VALEURS_DE_BASE = "valeurs de base, avant ajustement du niveau de monde";
const LIBELLE_SANS_CONTEXTE = "présent dans les fichiers, contexte non retrouvé";
const ELEMENTS_MONSTRES_JARVIS = [
  ["Default", "Physique"], ["Thunder", "Foudre"], ["Wind", "Vent"], ["Fire", "Feu"],
  ["Ice", "Glace"], ["Earth", "Terre"], ["Dark", "Ténèbres"], ["Holy", "Sacré"]
];
const LIBELLES_RANG_MONSTRE = { boss:"Boss", elite:"Élite", normal:"Normal" };
const CONTEXTES_MONSTRE_JARVIS = [
  ["terrain", "terrain", ["terrain", "field", "world"]],
  ["donjon", "donjon", ["donjon", "raid", "dungeon"]],
  ["confrerie", "confrérie", ["confrerie", "guilde", "guild"]],
  ["cross", "cross challenge", ["cross"]],
  ["zone", "zone", ["zone", "area"]]
];
const INDISPONIBLE_MONSTRES = { erreur:"données des monstres indisponibles" };

/* ---------------- Validation du fichier ---------------- */

function estObjetMonstre(valeur) {
  return Boolean(valeur) && typeof valeur === "object" && !Array.isArray(valeur);
}

/* La forme que les outils supposent, verifiee une fois a la lecture. */
function catalogueMonstreValide(monstre) {
  return estObjetMonstre(monstre)
    && typeof monstre.nom === "string" && monstre.nom.trim() !== ""
    && Array.isArray(monstre.versions) && monstre.versions.length > 0
    && monstre.versions.every(version => estObjetMonstre(version)
      && Array.isArray(version.contextes) && Array.isArray(version.acteurs)
      && estObjetMonstre(version.stats)
      && estObjetMonstre(version.stats.faiblesses)
      && estObjetMonstre(version.stats.resistances));
}

/* Rend null si le fichier est bon, sinon le motif du refus : le lecteur de
   stockage commun le journalise et garde l'echec une minute. */
function validerCatalogueMonstres(brut) {
  if(!brut || brut.version !== 1 || !Array.isArray(brut.monstres)){
    return "format de monstres.json inconnu : " + (brut && brut.version);
  }
  const malFormee = brut.monstres.find(monstre => !catalogueMonstreValide(monstre));
  if(malFormee !== undefined){
    return "entrée mal formée dans monstres.json : "
      + String((malFormee && malFormee.nom) || "?").slice(0, 40);
  }
  return null;
}

/* ---------------- Mise en mots ---------------- */

function pourcentMonstre(valeur) {
  return String(Number((Math.abs(valeur) / 100).toFixed(2))).replace(".", ",") + " %";
}

function signeMonstre(valeur) {
  return (valeur > 0 ? "+" : "−") + pourcentMonstre(valeur);
}

function elementsTriesMonstre(parElement, garder, sens) {
  return ELEMENTS_MONSTRES_JARVIS
    .map(([code, libelle], rang) => ({ libelle, rang, valeur:Number(parElement[code]) || 0 }))
    .filter(entree => garder(entree.valeur))
    .sort((a, b) => sens * (a.valeur - b.valeur) || a.rang - b.rang)
    .map(entree => entree.libelle + " " + signeMonstre(entree.valeur));
}

/* Une resistance de base negative garde son signe : l'Esprit du feu a
   Feu −100 %, qu'un « Feu 100 % » ferait lire comme une immunite. */
function resistanceSigneeMonstre(valeur) {
  return (valeur < 0 ? "−" : "") + pourcentMonstre(valeur);
}

function resistanceDeBaseMonstre(resistances) {
  const valeurs = ELEMENTS_MONSTRES_JARVIS.map(([code]) => Number(resistances[code]) || 0);
  if(valeurs.every(valeur => valeur === valeurs[0])){
    return valeurs[0] === 0 ? "aucune" : resistanceSigneeMonstre(valeurs[0]) + " sur tous les éléments";
  }
  return ELEMENTS_MONSTRES_JARVIS
    .filter(([code]) => Number(resistances[code]))
    .map(([code, libelle]) => libelle + " " + resistanceSigneeMonstre(Number(resistances[code])))
    .join(", ");
}

function versionLisibleMonstre(version) {
  const lisible = {};
  if(version.niveau !== undefined) lisible.niveau = version.niveau;
  lisible.contextes = version.contextes.length
    ? version.contextes.map(contexte =>
      contexte.type === "confrerie" && version.niveau !== undefined
        ? contexte.libelle + ", niveau " + version.niveau
        : contexte.libelle)
    : [LIBELLE_SANS_CONTEXTE];
  if(!version.contextes.length) lisible.nonConfirme = true;
  lisible.faiblesses = elementsTriesMonstre(version.stats.faiblesses, valeur => valeur > 0, -1);
  lisible.resistances = elementsTriesMonstre(version.stats.faiblesses, valeur => valeur < 0, 1);
  lisible.resistanceElementaireBase = resistanceDeBaseMonstre(version.stats.resistances);
  lisible.resistanceCritique = pourcentMonstre(version.stats.resCrit);
  lisible.defenseCritique = pourcentMonstre(version.stats.defCrit);
  lisible.valeursDeBase = {
    pv:version.stats.pv, defense:version.stats.defense, attaque:version.stats.attaque,
    note:NOTE_VALEURS_DE_BASE
  };
  if(version.puissance){
    lisible.puissanceRecommandee = Object.fromEntries(Object.entries(version.puissance)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([niveau, puissance]) => ["Niveau de monde " + niveau, puissance]));
  }
  return lisible;
}

function dateLisibleMonstre(catalogue) {
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(catalogue.dateExport || ""));
  return date ? date[3] + "/" + date[2] + "/" + date[1] : null;
}

/* ---------------- Recherche par nom ---------------- */

function rangNomMonstre(candidat, cherche) {
  const normalise = normaliserRecherche(candidat);
  if(!cherche || !normalise) return 0;
  if(normalise === cherche) return 4;
  if(normalise.startsWith(cherche)) return 3;
  if(normalise.includes(cherche)) return 2;
  const mots = cherche.split(/\s+/).filter(Boolean);
  if(mots.length > 1 && mots.every(mot => normalise.includes(mot))) return 1;
  return 0;
}

function trouverMonstresJarvis(catalogue, saisie) {
  const cherche = normaliserRecherche(saisie);
  let meilleurRang = 0;
  let trouves = [];
  catalogue.monstres.forEach(monstre => {
    const rang = rangNomMonstre(monstre.nom, cherche);
    if(rang > meilleurRang){
      meilleurRang = rang;
      trouves = [monstre];
    }else if(rang && rang === meilleurRang){
      trouves.push(monstre);
    }
  });
  /* A correspondance egale, l'ordre alphabetique rendait « Démon champignon »
     pour « démon ». Un membre qui tape un nom vague pense d'abord aux boss :
     boss, puis elite, puis normal, puis le nom le plus court. */
  const poids = rang => ["normal", "elite", "boss"].indexOf(rang);
  return trouves.sort((a, b) => poids(b.rang) - poids(a.rang)
    || a.nom.length - b.nom.length || a.nom.localeCompare(b.nom, "fr"));
}

function typeDeContexteMonstre(saisie) {
  const cherche = normaliserRecherche(saisie);
  const trouve = CONTEXTES_MONSTRE_JARVIS.find(([, , mots]) =>
    mots.some(mot => cherche.includes(mot)));
  return trouve ? trouve[0] : undefined;
}

function entierMonstre(valeur) {
  if(valeur === undefined || valeur === null || valeur === "") return null;
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? Math.trunc(nombre) : NaN;
}

/* ---------------- Outils ---------------- */

async function outilFicheMonstre(lireMonstres, args) {
  const catalogue = await lireMonstres();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MONSTRES);
  const trouves = trouverMonstresJarvis(catalogue, args.nom);
  if(!trouves.length){
    return {
      introuvable:String(args.nom === undefined ? "" : args.nom),
      proches:propositions(catalogue.monstres.map(monstre => monstre.nom), args.nom)
    };
  }
  const monstre = trouves[0];
  let versions = monstre.versions;
  const resultat = {
    nom:monstre.nom,
    rang:LIBELLES_RANG_MONSTRE[monstre.rang] || monstre.rang,
    donneesDu:dateLisibleMonstre(catalogue)
  };
  if(trouves.length > 1){
    resultat.correspondances = trouves.length;
    resultat.autresCorrespondances = trouves.slice(1, 6).map(autre => autre.nom);
  }

  if(args.contexte !== undefined && args.contexte !== null && String(args.contexte).trim()){
    const type = typeDeContexteMonstre(args.contexte);
    if(!type){
      return {
        erreur:"contexte inconnu",
        contextesPossibles:CONTEXTES_MONSTRE_JARVIS.map(([, libelle]) => libelle)
      };
    }
    const filtrees = versions.filter(version =>
      version.contextes.some(contexte => contexte.type === type));
    if(!filtrees.length){
      return Object.assign(resultat, {
        aucuneVersionPour:CONTEXTES_MONSTRE_JARVIS.find(([code]) => code === type)[1],
        contextesDisponibles:[...new Set(versions.flatMap(version =>
          version.contextes.map(contexte => contexte.libelle)))]
      });
    }
    versions = filtrees;
  }

  const niveaux = versions.filter(version => version.niveau !== undefined)
    .map(version => version.niveau);
  if(niveaux.length){
    const minimum = Math.min(...niveaux);
    const maximum = Math.max(...niveaux);
    /* Les bornes viennent des donnees : un boss a 20 paliers annoncait
       « 1 à 30 » quand elles etaient forcees sur Akumu. */
    const bornes = { bas:minimum, haut:maximum };
    const niveau = entierMonstre(args.niveau);
    if(niveau !== null){
      if(!(niveau >= bornes.bas && niveau <= bornes.haut)){
        return { erreur:"niveau hors bornes : de " + bornes.bas + " à " + bornes.haut };
      }
      const palier = versions.filter(version => version.niveau === niveau);
      if(!palier.length){
        return { erreur:"niveau " + niveau + " absent des données", niveauxDisponibles:niveaux };
      }
      versions = palier;
    }else{
      /* Sans niveau demande : les versions hors paliers (l'export reel a un
         second acteur « Akumu » sans contexte), puis le premier et le dernier
         palier. Jamais une version hors paliers a la place du palier 1. */
      const horsPaliers = versions.filter(version => version.niveau === undefined);
      const paliers = versions.filter(version => version.niveau !== undefined)
        .sort((a, b) => a.niveau - b.niveau);
      if(paliers.length > 1){
        resultat.paliers = bornes.bas + " à " + bornes.haut;
        /* Les paliers d'abord : Gemini lit la vraie version avant la version
           non confirmee. */
        versions = [paliers[0], paliers[paliers.length - 1]].concat(horsPaliers);
      }
    }
  }else if(entierMonstre(args.niveau) !== null){
    /* L'ignorer en silence ferait croire a Gemini qu'il a filtre. */
    resultat.niveauIgnore = "ce monstre n'a pas de paliers : niveau ignoré";
  }

  resultat.total = versions.length;
  resultat.versions = versions.slice(0, MONSTRES_VERSIONS_MAX).map(versionLisibleMonstre);
  if(versions.length > MONSTRES_VERSIONS_MAX){
    resultat.suite = "seules les " + MONSTRES_VERSIONS_MAX + " premières versions sont listées :"
      + " préciser un contexte (terrain, donjon, confrérie, cross challenge, zone) pour affiner";
  }
  return resultat;
}

/* Les mots qu'un membre, ou Gemini, emploie pour un element : chaque refus
   coutait un tour sur cinq. Cles normalisees (sans accents ni casse). */
const SYNONYMES_ELEMENTS_MONSTRE = {
  lumiere:"Holy", light:"Holy", saint:"Holy", sacre:"Holy",
  eclair:"Thunder", electrique:"Thunder", electricite:"Thunder", lightning:"Thunder",
  physical:"Default", neutre:"Default", normal:"Default",
  ombre:"Dark", shadow:"Dark", tenebre:"Dark",
  froid:"Ice", frost:"Ice", flamme:"Fire", flame:"Fire"
};

function elementDeSaisieMonstre(saisie) {
  const cherche = normaliserRecherche(saisie);
  if(!cherche) return null;
  const synonyme = SYNONYMES_ELEMENTS_MONSTRE[cherche];
  if(synonyme) return ELEMENTS_MONSTRES_JARVIS.find(([code]) => code === synonyme);
  return ELEMENTS_MONSTRES_JARVIS.find(([code, libelle]) =>
    normaliserRecherche(libelle) === cherche || normaliserRecherche(code) === cherche
    || (cherche.length >= 3 && normaliserRecherche(libelle).startsWith(cherche))) || null;
}

async function outilChercherMonstres(lireMonstres, args) {
  const catalogue = await lireMonstres();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MONSTRES);
  const element = elementDeSaisieMonstre(args.element);
  if(!element){
    return { erreur:"élément inconnu", elements:ELEMENTS_MONSTRES_JARVIS.map(([, libelle]) => libelle) };
  }
  const rangDemande = normaliserRecherche(args.rang || "boss");
  const rang = rangDemande.startsWith("tou") ? "tous"
    : rangDemande === "elite" ? "elite"
    : rangDemande === "boss" ? "boss" : null;
  if(!rang) return { erreur:"rang inconnu : boss, élite ou tous" };

  const vus = new Set();
  const trouves = [];
  catalogue.monstres.forEach(monstre => {
    /* « ??? » est un nom provisoire du jeu, sans une lettre : il reste
       consultable par fiche_monstre, jamais recommande dans une liste. */
    if(!/\p{L}/u.test(monstre.nom)) return;
    monstre.versions.forEach(version => {
      if(rang !== "tous" && version.rang !== rang) return;
      const valeur = Number(version.stats.faiblesses[element[0]]) || 0;
      if(valeur <= 0) return;
      const contextes = version.contextes.length
        ? version.contextes.map(contexte => contexte.libelle)
        : [LIBELLE_SANS_CONTEXTE];
      const cle = monstre.nom + "|" + valeur + "|" + contextes.join("|");
      if(vus.has(cle)) return;
      vus.add(cle);
      trouves.push({
        nom:monstre.nom, valeur, faiblesse:signeMonstre(valeur), contextes,
        confirme:version.contextes.length > 0
      });
    });
  });
  /* Les versions confirmees en jeu d'abord, meme moins faibles : un membre
     cherche un monstre qu'il peut affronter. */
  trouves.sort((a, b) => Number(b.confirme) - Number(a.confirme)
    || b.valeur - a.valeur || a.nom.localeCompare(b.nom, "fr"));
  return {
    element:element[1],
    rang,
    donneesDu:dateLisibleMonstre(catalogue),
    total:trouves.length,
    monstres:trouves.slice(0, MONSTRES_RESULTATS_MAX)
      .map(({ nom, faiblesse, contextes }) => ({ nom, faiblesse, contextes }))
  };
}

const DECLARATIONS_OUTILS_MONSTRES = [
  {
    name:"fiche_monstre",
    description:"Faiblesses et résistances élémentaires, résistances critiques et valeurs de base"
      + " d'un monstre ou d'un boss du jeu, version par version (boss de terrain, donjon,"
      + " boss de confrérie, Cross Challenge, zone). Données lues dans les fichiers du jeu.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom du monstre, même approximatif (ex. « démon rouge », « akumu »)." },
        contexte:{ type:"STRING", description:"Facultatif : terrain, donjon, confrérie, cross challenge ou zone." },
        niveau:{ type:"INTEGER", description:"Facultatif : palier d'un boss à paliers comme Akumu (1 à 30)." }
      },
      required:["nom"]
    }
  },
  {
    name:"chercher_monstres",
    description:"Monstres faibles à un élément, du plus faible au moins faible, avec leur contexte.",
    parameters:{
      type:"OBJECT",
      properties:{
        element:{ type:"STRING", description:"Physique, Foudre, Vent, Feu, Glace, Terre, Ténèbres ou Sacré." },
        rang:{ type:"STRING", enum:["boss", "elite", "tous"], description:"Facultatif : boss (par défaut), elite ou tous." }
      },
      required:["element"]
    }
  }
];

/* Le NOM est borne, jamais la date : c'est elle qui dit de quel export
   viennent les chiffres. 40 caracteres de nom tiennent, avec la date, sous
   la limite d'une source dans la ligne « Sources ». */
function nomBorneMonstre(nom) {
  const lettres = Array.from(String(nom));
  return lettres.length > 40 ? lettres.slice(0, 39).join("").trimEnd() + "…" : lettres.join("");
}

function sourceDateeMonstre(debut, nom, donnees) {
  return debut + nomBorneMonstre(nom)
    + (donnees.donneesDu ? " · données du jeu du " + donnees.donneesDu : "");
}

function ajouterOutilsMonstresJarvis(table, lireMonstres) {
  table.fiche_monstre = {
    executer:args => outilFicheMonstre(lireMonstres, args),
    source:(args, donnees) =>
      sourceDateeMonstre("fiche monstre ", donnees.nom || args.nom || "?", donnees)
  };
  table.chercher_monstres = {
    executer:args => outilChercherMonstres(lireMonstres, args),
    source:(args, donnees) =>
      sourceDateeMonstre("monstres faibles à ", donnees.element || args.element || "?", donnees)
  };
}

const discordJarvisMonstresApi = {
  CHEMIN_MONSTRES_JARVIS,
  DECLARATIONS_OUTILS_MONSTRES,
  validerCatalogueMonstres,
  ajouterOutilsMonstresJarvis
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisMonstresApi;
}
globalThis.NOVA_DISCORD_JARVIS_MONSTRES = discordJarvisMonstresApi;
