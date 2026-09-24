"use strict";

/* Les outils de la commande Discord /jarvis.

   Gemini ne lit JAMAIS la base ni le catalogue en entier : il demande un
   outil, et seul le resultat de cet outil part chez Google. C'est la
   minimisation decidee pour le palier gratuit, ou Google peut reutiliser ce
   qu'on lui envoie.

   Rien ici ne fait de `fetch` : le catalogue et `requete(chemin)` sont
   injectes. L'Edge Function branche PostgREST, les tests un faux. Aucun
   resultat ne contient d'UUID ni d'email — seulement des pseudos.

   Aucun outil n'ecrit : dans le pire des cas, le bot repond de travers. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_DISCORD_PLANNING) require("./discord-planning.js");
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_AVAILABILITY_PDF) require("./availability-pdf.js");
  if(!globalThis.NOVA_BOSS_REMINDER) require("./boss-reminder.js");
}

const { PLANNING_PROFILES_QUERY } = globalThis.NOVA_DISCORD_PLANNING;
const {
  normaliserRecherche, propositions, trouverProfil, nomDeFichier,
  BUILD_TYPE_TO_ENUM, libelleArme
} = globalThis.NOVA_DISCORD_BUILD;
const {
  currentAvailabilityWeekStart, buildAvailabilityReport
} = globalThis.NOVA_AVAILABILITY_PDF;
const { currentBossWeekStart } = globalThis.NOVA_BOSS_REMINDER;

const NOVA_CONNAISSANCES_URL =
  "https://yanniss13.github.io/NOVA/data/connaissances-discord.json";
/* Plafonds des resultats : chaque ligne envoyee coute du quota gratuit. */
const JARVIS_LIGNES_MAX = 40;
const JARVIS_OBJETS_MAX = 5;

const DECLARATIONS_OUTILS_JARVIS = [
  {
    name:"lister_personnages",
    description:"Liste les héros jouables de 7DS Origin avec leur rareté et leurs trois armes"
      + " (élément, rôle). À appeler pour savoir quels héros existent ou retrouver un nom."
  },
  {
    name:"fiche_personnage",
    description:"Compétences, passifs et potentiels P1 à P10 d'un héros, arme par arme.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom du héros, même approximatif (ex. « mel » pour Meliodas)." },
        arme:{ type:"STRING", description:"Facultatif : un type d'arme pour ne garder qu'elle (ex. « hache », « grimoire »)." }
      },
      required:["nom"]
    }
  },
  {
    name:"chercher_equipement",
    description:"Cherche une arme, une armure, un bijou ou une armure gravée par son nom"
      + " ou par le nom de son ensemble : passif et bonus d'ensemble.",
    parameters:{
      type:"OBJECT",
      properties:{ texte:{ type:"STRING", description:"Nom ou partie du nom." } },
      required:["texte"]
    }
  },
  {
    name:"qui_possede",
    description:"Membres de la confrérie qui possèdent un héros, avec leur potentiel"
      + " et les armes pour lesquelles ils ont un build.",
    parameters:{
      type:"OBJECT",
      properties:{
        personnage:{ type:"STRING", description:"Nom du héros, même approximatif." },
        arme:{ type:"STRING", description:"Facultatif : ne garder que les membres qui ont un build pour cette arme." },
        potentiel_min:{ type:"INTEGER", description:"Facultatif : potentiel minimal, de 0 à 10." }
      },
      required:["personnage"]
    }
  },
  {
    name:"roster_de",
    description:"Roster d'un membre : ses héros, leur potentiel, et le nom de l'arme"
      + " et des pièces de chaque build. Aucun chiffre de stats.",
    parameters:{
      type:"OBJECT",
      properties:{ pseudo:{ type:"STRING", description:"Pseudo du membre." } },
      required:["pseudo"]
    }
  },
  {
    name:"dispos",
    description:"Disponibilités des membres pour la semaine en cours, en heure de Paris."
      + " Avec un jour et une heure : qui est disponible sur ce créneau d'une heure."
      + " Sinon : les meilleurs créneaux, éventuellement limités à un jour.",
    parameters:{
      type:"OBJECT",
      properties:{
        jour:{ type:"STRING", description:"Facultatif : lundi, mardi, mercredi, jeudi, vendredi, samedi ou dimanche." },
        heure:{ type:"INTEGER", description:"Facultatif : heure de début du créneau, de 0 à 23." }
      }
    }
  },
  {
    name:"scores_boss",
    description:"Scores du boss de confrérie : meilleur, moyen, dernier, et les 5 meilleures"
      + " runs avec leurs participants et leurs héros.",
    parameters:{
      type:"OBJECT",
      properties:{
        periode:{ type:"STRING", enum:["semaine", "historique"],
          description:"« semaine » pour la semaine de boss en cours, « historique » pour tout." }
      },
      required:["periode"]
    }
  }
];

/* 4 : egal, 3 : commence par, 2 : contient, 1 : contient tous les mots. */
function rangCorrespondanceJarvis(candidat, cherche) {
  const normalise = normaliserRecherche(candidat);
  if(!cherche || !normalise) return 0;
  if(normalise === cherche) return 4;
  if(normalise.startsWith(cherche)) return 3;
  if(normalise.includes(cherche)) return 2;
  const mots = cherche.split(/\s+/).filter(Boolean);
  if(mots.length > 1 && mots.every(mot => normalise.includes(mot))) return 1;
  return 0;
}

function nomsDesPersonnagesJarvis(catalogue) {
  return Object.values(catalogue.personnages || {}).map(personnage => personnage.nom);
}

function trouverPersonnageJarvis(catalogue, saisie) {
  const cherche = normaliserRecherche(saisie);
  let meilleur = null;
  let meilleurRang = 0;
  Object.entries(catalogue.personnages || {}).forEach(([id, personnage]) => {
    const rang = Math.max(
      rangCorrespondanceJarvis(personnage.nom, cherche),
      rangCorrespondanceJarvis(id, cherche)
    );
    if(rang > meilleurRang){
      meilleurRang = rang;
      meilleur = id;
    }
  });
  return meilleur;
}

/* `null` : aucun filtre demande. `undefined` : une arme demandee mais que ce
   heros ne porte pas — le resultat le dit au lieu d'ignorer le filtre. */
function trouverTypeArmeJarvis(personnage, saisie) {
  if(saisie === undefined || saisie === null || String(saisie).trim() === "") return null;
  const cherche = normaliserRecherche(saisie);
  const armes = personnage.armes || [];
  const trouvee = armes.find(arme =>
    normaliserRecherche(arme.arme) === cherche || normaliserRecherche(arme.type) === cherche)
    || armes.find(arme => normaliserRecherche(arme.arme).startsWith(cherche));
  return trouvee ? trouvee.type : undefined;
}

function introuvableJarvis(saisie, candidats) {
  return { introuvable:String(saisie === undefined ? "" : saisie), proches:propositions(candidats, saisie) };
}

function outilListerPersonnages(catalogue) {
  return Object.values(catalogue.personnages || {}).map(personnage => ({
    nom:personnage.nom,
    rarete:personnage.rarete,
    armes:(personnage.armes || []).map(arme =>
      arme.arme + " (" + [arme.element, arme.role].filter(Boolean).join(", ") + ")")
  }));
}

function competenceLisible(competence) {
  return {
    categorie:competence.categorie, nom:competence.nom,
    description:competence.description, recharge:competence.recharge
  };
}

function outilFichePersonnage(catalogue, args) {
  const id = trouverPersonnageJarvis(catalogue, args.nom);
  if(!id) return introuvableJarvis(args.nom, nomsDesPersonnagesJarvis(catalogue));
  const personnage = catalogue.personnages[id];
  const filtre = trouverTypeArmeJarvis(personnage, args.arme);
  if(filtre === undefined){
    return {
      personnage:personnage.nom, armeInconnue:args.arme,
      armes:personnage.armes.map(arme => arme.arme)
    };
  }
  const competences = (catalogue.competences || {})[id] || [];
  const potentiels = (catalogue.potentiels || {})[id] || {};
  return {
    personnage:personnage.nom,
    rarete:personnage.rarete,
    competencesCommunes:competences.filter(c => !c.type).map(competenceLisible),
    armes:personnage.armes
      .filter(arme => !filtre || arme.type === filtre)
      .map(arme => ({
        arme:arme.arme, element:arme.element, role:arme.role,
        competences:competences.filter(c => c.type === arme.type).map(competenceLisible),
        potentiels:(potentiels[arme.type] || []).map((texte, rang) => "P" + (rang + 1) + " : " + texte)
      }))
  };
}

function outilChercherEquipement(catalogue, args) {
  const cherche = normaliserRecherche(args.texte);
  if(cherche.length < 2) return { erreur:"recherche trop courte" };
  const ensembles = catalogue.ensembles || {};
  const equipements = catalogue.equipements || [];
  const trouves = equipements
    .map(entree => ({
      entree,
      rang:Math.max(
        rangCorrespondanceJarvis(entree.nom, cherche),
        entree.ensemble && ensembles[entree.ensemble]
          ? rangCorrespondanceJarvis(ensembles[entree.ensemble].nom, cherche) : 0
      )
    }))
    .filter(trouve => trouve.rang > 0)
    .sort((a, b) => b.rang - a.rang || a.entree.nom.localeCompare(b.entree.nom, "fr"));
  if(!trouves.length){
    return introuvableJarvis(args.texte, equipements.map(entree => entree.nom));
  }
  return {
    total:trouves.length,
    objets:trouves.slice(0, JARVIS_OBJETS_MAX).map(({ entree }) => {
      const objet = { nom:entree.nom, categorie:entree.categorie, type:entree.type };
      if(entree.heros){
        objet.heros = ((catalogue.personnages || {})[entree.heros] || {}).nom || entree.heros;
      }
      if(entree.passif) objet.passif = "Niv. " + entree.passif.niveau + " : " + entree.passif.texte;
      const ensemble = entree.ensemble && ensembles[entree.ensemble];
      if(ensemble){
        objet.ensemble = {
          nom:ensemble.nom,
          paliers:ensemble.paliers.map(palier => palier.pieces + " pièces : " + palier.texte)
        };
      }
      return objet;
    })
  };
}

function creerOutilsJarvis(options) {
  const catalogue = options.catalogue || {};
  const contexte = {
    catalogue,
    requete:options.requete,
    maintenant:options.maintenant || (() => new Date()),
    nomsParFichier:new Map((catalogue.equipements || []).map(entree => [entree.fichier, entree.nom]))
  };
  const table = {
    lister_personnages:{
      executer:() => outilListerPersonnages(catalogue),
      source:() => "liste des héros"
    },
    fiche_personnage:{
      executer:args => outilFichePersonnage(catalogue, args),
      source:(args, donnees) => "fiche " + (donnees.personnage || args.nom || "?")
    },
    chercher_equipement:{
      executer:args => outilChercherEquipement(catalogue, args),
      source:args => "recherche « " + String(args.texte || "") + " »"
    }
  };
  ajouterOutilsConfrerie(table, contexte);
  return {
    declarations:DECLARATIONS_OUTILS_JARVIS,
    async executer(nom, args) {
      if(!Object.prototype.hasOwnProperty.call(table, nom)){
        return { donnees:{ erreur:"outil inconnu" }, source:null };
      }
      const arguments_ = args && typeof args === "object" && !Array.isArray(args) ? args : {};
      try {
        const donnees = await table[nom].executer(arguments_);
        return { donnees, source:table[nom].source(arguments_, donnees || {}) };
      } catch (erreur) {
        console.error("Outil /jarvis « " + nom + " » en échec", erreur);
        return { donnees:{ erreur:"lecture impossible" }, source:null };
      }
    }
  };
}

/* Rempli a la tache suivante : les outils qui lisent la confrerie. */
function ajouterOutilsConfrerie(table, contexte) {
  void table;
  void contexte;
}

const discordJarvisOutilsApi = {
  NOVA_CONNAISSANCES_URL,
  DECLARATIONS_OUTILS_JARVIS,
  creerOutilsJarvis
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisOutilsApi;
}
globalThis.NOVA_DISCORD_JARVIS_OUTILS = discordJarvisOutilsApi;
