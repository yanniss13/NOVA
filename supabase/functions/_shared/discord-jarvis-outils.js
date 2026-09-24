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
  if(!globalThis.NOVA_DISCORD_JARVIS_MONSTRES) require("./discord-jarvis-monstres.js");
  if(!globalThis.NOVA_DISCORD_JARVIS_MECANIQUES) require("./discord-jarvis-mecaniques.js");
  if(!globalThis.NOVA_DISCORD_JARVIS_OBJETS) require("./discord-jarvis-objets.js");
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
const {
  DECLARATIONS_OUTILS_MONSTRES, ajouterOutilsMonstresJarvis, rangCorrespondanceJarvis
} = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;
const {
  DECLARATIONS_OUTILS_MECANIQUES, ajouterOutilsMecaniquesJarvis
} = globalThis.NOVA_DISCORD_JARVIS_MECANIQUES;
const {
  DECLARATIONS_OUTILS_OBJETS, ajouterOutilsObjetsJarvis
} = globalThis.NOVA_DISCORD_JARVIS_OBJETS;

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
].concat(DECLARATIONS_OUTILS_MONSTRES, DECLARATIONS_OUTILS_MECANIQUES, DECLARATIONS_OUTILS_OBJETS);

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
  /* Trois vocabulaires pour une meme arme : le libelle du jeu (« Grimoire »),
     l'enum (« Book ») et le dossier du site (« Livre »). Un membre emploie
     celui qu'il a sous les yeux ; chaque refus coutait a Gemini un tour. */
  const noms = arme => [arme.arme, arme.type, TYPE_ARME_VERS_DOSSIER[arme.type]]
    .filter(Boolean).map(normaliserRecherche);
  const trouvee = armes.find(arme => noms(arme).includes(cherche))
    || armes.find(arme => noms(arme).some(nom => nom.startsWith(cherche)))
    || (cherche.length >= 3 && armes.find(arme => noms(arme).some(nom => nom.includes(cherche))));
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
  /* Lot 2a : les monstres, lus dans le bucket prive. Sans lecteur fourni, ils
     repondent « indisponibles » : le reste de /jarvis n'en depend pas. */
  ajouterOutilsMonstresJarvis(table, options.lireMonstres || (async () => null));
  /* Lot 2b : les effets et les regles du jeu, meme bucket, meme repli. */
  ajouterOutilsMecaniquesJarvis(table, options.lireMecaniques || (async () => null));
  /* Lot 2c : les objets et les boutiques, meme bucket, meme repli. */
  ajouterOutilsObjetsJarvis(table, options.lireObjets || (async () => null));
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

const JOURS_JARVIS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const JOURS_AFFICHES_JARVIS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const SCORE_LISIBLE = /^\d+$/;
const TYPE_ARME_VERS_DOSSIER = Object.fromEntries(
  Object.entries(BUILD_TYPE_TO_ENUM).map(([dossier, type]) => [type, dossier])
);

function pseudoAfficheJarvis(profil) {
  return String((profil && profil.pseudo) || "Membre").trim() || "Membre";
}

async function membresJarvis(requete) {
  const profils = await requete(PLANNING_PROFILES_QUERY);
  return (Array.isArray(profils) ? profils : []).filter(profil => profil && profil.id);
}

/* Gemini envoie parfois « 8 » ou 21.0 la ou le schema dit INTEGER. */
function entierJarvis(valeur) {
  if(valeur === undefined || valeur === null || valeur === "") return null;
  const nombre = Number(valeur);
  return Number.isFinite(nombre) ? Math.trunc(nombre) : NaN;
}

function nomObjetJarvis(contexte, fichier) {
  if(!fichier) return null;
  return contexte.nomsParFichier.get(fichier) || nomDeFichier(fichier) || null;
}

/* Le nom de l'arme et des pieces, jamais la note : elle est ecrite par un
   membre, peut contenir n'importe quoi, et n'a rien a faire chez Google. */
function resumeBuildsJarvis(contexte, builds) {
  return Object.entries(builds || {})
    .filter(([, build]) => build && typeof build === "object" && build.weapon)
    .map(([dossier, build]) => {
      const pieces = [...Object.values(build.armor || {}), ...Object.values(build.jewel || {})]
        .filter(Boolean)
        .map(fichier => nomObjetJarvis(contexte, fichier));
      const resume = { arme:libelleArme(dossier), equipee:nomObjetJarvis(contexte, build.weapon), pieces };
      if(build.favorite) resume.favori = true;
      return resume;
    });
}

async function outilQuiPossede(contexte, args) {
  const catalogue = contexte.catalogue;
  const id = trouverPersonnageJarvis(catalogue, args.personnage);
  if(!id) return introuvableJarvis(args.personnage, nomsDesPersonnagesJarvis(catalogue));
  const personnage = catalogue.personnages[id];
  const type = trouverTypeArmeJarvis(personnage, args.arme);
  if(type === undefined){
    return {
      personnage:personnage.nom, armeInconnue:args.arme,
      armes:personnage.armes.map(arme => arme.arme)
    };
  }
  const dossier = type ? TYPE_ARME_VERS_DOSSIER[type] : null;
  /* « P8 », tel que le site l'affiche, vaut 8. Une valeur illisible ou hors
     bornes est signalee : l'ignorer ferait croire a Gemini qu'il a filtre. */
  const minimumLu = entierJarvis(typeof args.potentiel_min === "string"
    ? args.potentiel_min.trim().replace(/^p\s*/i, "") : args.potentiel_min);
  if(minimumLu !== null && !(minimumLu >= 0 && minimumLu <= 10)){
    return { erreur:"potentiel invalide : de 0 à 10" };
  }
  const minimum = minimumLu === null ? 0 : minimumLu;
  const [profils, lignes] = await Promise.all([
    membresJarvis(contexte.requete),
    contexte.requete("roster_characters?char_id=eq." + encodeURIComponent(id)
      + "&select=owner,potential_tier,builds")
  ]);
  const pseudos = new Map(profils.map(profil => [profil.id, pseudoAfficheJarvis(profil)]));
  const possesseurs = (Array.isArray(lignes) ? lignes : [])
    .filter(ligne => ligne && pseudos.has(ligne.owner))
    .map(ligne => {
      const armes = Object.entries(ligne.builds || {})
        .filter(([, build]) => build && typeof build === "object" && build.weapon);
      const favori = armes.find(([, build]) => build.favorite);
      return {
        pseudo:pseudos.get(ligne.owner),
        palier:Number(ligne.potential_tier) || 0,
        dossiers:armes.map(([cle]) => cle),
        favori:favori ? favori[0] : null
      };
    })
    .filter(possesseur => possesseur.palier >= minimum
      && (!dossier || possesseur.dossiers.includes(dossier)))
    .sort((a, b) => b.palier - a.palier || a.pseudo.localeCompare(b.pseudo, "fr"));
  return {
    personnage:personnage.nom,
    filtre:{
      arme:type ? personnage.armes.find(arme => arme.type === type).arme : null,
      potentielMin:minimum
    },
    total:possesseurs.length,
    membres:possesseurs.slice(0, JARVIS_LIGNES_MAX).map(possesseur => {
      const membre = {
        pseudo:possesseur.pseudo,
        potentiel:"P" + possesseur.palier,
        builds:possesseur.dossiers.map(libelleArme)
      };
      if(possesseur.favori) membre.favori = libelleArme(possesseur.favori);
      return membre;
    })
  };
}

async function outilRosterDe(contexte, args) {
  const profils = await membresJarvis(contexte.requete);
  const profil = trouverProfil(profils, args.pseudo);
  if(!profil) return introuvableJarvis(args.pseudo, profils.map(pseudoAfficheJarvis));
  const lignes = await contexte.requete("roster_characters?owner=eq."
    + encodeURIComponent(profil.id) + "&select=char_id,potential_tier,builds");
  const personnages = (Array.isArray(lignes) ? lignes : [])
    .map(ligne => ({
      nom:((contexte.catalogue.personnages || {})[ligne.char_id] || {}).nom || ligne.char_id,
      potentiel:"P" + (Number(ligne.potential_tier) || 0),
      builds:resumeBuildsJarvis(contexte, ligne.builds)
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return {
    pseudo:pseudoAfficheJarvis(profil),
    total:personnages.length,
    personnages:personnages.slice(0, JARVIS_LIGNES_MAX)
  };
}

/* `null` : pas de jour demande. -1 : un jour illisible. */
function indexDuJourJarvis(saisie) {
  if(saisie === undefined || saisie === null || String(saisie).trim() === "") return null;
  const cherche = normaliserRecherche(saisie);
  return JOURS_JARVIS.findIndex(jour =>
    jour === cherche || (cherche.length >= 3 && jour.startsWith(cherche)));
}

function libelleCreneauJarvis(index) {
  const heure = index % 24;
  return JOURS_AFFICHES_JARVIS[Math.floor(index / 24)] + " " + heure + "h-" + (heure + 1) + "h";
}

/* L'heure de la semaine ISO en cours, a Paris : 0 = lundi 0h, 167 = dimanche 23h. */
function indexCreneauActuelJarvis(date) {
  const parties = new Intl.DateTimeFormat("en-GB", {
    timeZone:"Europe/Paris", weekday:"short", hour:"2-digit", hourCycle:"h23"
  }).formatToParts(date);
  const lire = type => (parties.find(partie => partie.type === type) || {}).value;
  const jour = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(lire("weekday"));
  return jour * 24 + Number(lire("hour"));
}

async function outilDispos(contexte, args) {
  const jour = indexDuJourJarvis(args.jour);
  if(jour === -1) return { erreur:"jour inconnu : utiliser lundi à dimanche", jour:args.jour };
  const heure = entierJarvis(args.heure);
  if(heure !== null && !(heure >= 0 && heure <= 23)) return { erreur:"heure invalide : de 0 à 23" };
  const semaine = currentAvailabilityWeekStart(contexte.maintenant());
  const [profils, lignes] = await Promise.all([
    membresJarvis(contexte.requete),
    contexte.requete("member_availability?week_start=eq." + semaine + "&select=owner,slots")
  ]);
  const rapport = buildAvailabilityReport(profils, Array.isArray(lignes) ? lignes : [], semaine);
  const base = {
    semaine:rapport.label, fuseau:"Europe/Paris",
    membres:rapport.members.length, membresAyantRenseigne:rapport.declaredCount
  };
  const pseudosSur = index => rapport.members
    .filter(membre => membre.mask[index] === "1").map(membre => membre.pseudo);
  if(jour !== null && heure !== null){
    const index = jour * 24 + heure;
    return { ...base, creneau:libelleCreneauJarvis(index), disponibles:pseudosSur(index) };
  }
  /* Sans jour demande, un membre cherche un creneau encore jouable : les heures
     deja passees cette semaine sont ecartees, le creneau en cours compte. */
  const premierCreneau = jour === null ? indexCreneauActuelJarvis(contexte.maintenant()) : 0;
  const creneaux = rapport.counts
    .map((nombre, index) => ({ nombre, index }))
    .filter(creneau => creneau.nombre > 0 && creneau.index >= premierCreneau
      && (jour === null || Math.floor(creneau.index / 24) === jour)
      && (heure === null || creneau.index % 24 === heure))
    .sort((a, b) => b.nombre - a.nombre || a.index - b.index)
    .slice(0, JARVIS_OBJETS_MAX);
  return {
    ...base,
    meilleursCreneaux:creneaux.map(creneau => ({
      creneau:libelleCreneauJarvis(creneau.index),
      disponibles:creneau.nombre,
      pseudos:pseudosSur(creneau.index)
    }))
  };
}

function comparerScoresJarvis(gauche, droite) {
  const a = BigInt(gauche);
  const b = BigInt(droite);
  return a < b ? -1 : a > b ? 1 : 0;
}

function formaterScoreJarvis(score) {
  return String(score).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function herosDeLInstantane(catalogue, heros) {
  return (Array.isArray(heros) ? heros : [])
    .map(hero => hero && hero.char)
    .filter(Boolean)
    .map(id => ((catalogue.personnages || {})[id] || {}).nom || id);
}

/* Les scores restent des chaines lues en `::text` : un `Number` perdrait des
   chiffres au-dela de 2^53. Une run sans rapport n'est jamais classee a zero. */
async function outilScoresBoss(contexte, args) {
  const periode = args.periode === "historique" ? "historique" : "semaine";
  const requete = contexte.requete;
  let sessions = null;
  let rapports;
  if(periode === "semaine"){
    const semaine = currentBossWeekStart(contexte.maintenant());
    sessions = await requete("boss_sessions?week_start=eq." + semaine
      + "&select=id,week_start,slot,run_no");
    const ids = (Array.isArray(sessions) ? sessions : []).map(session => session.id);
    rapports = ids.length
      ? await requete("boss_run_reports?session_id=in.(" + ids.join(",")
        + ")&select=session_id,global_score::text,created_at")
      : [];
  }else{
    rapports = await requete("boss_run_reports?select=session_id,global_score::text,created_at");
  }
  const lisibles = (Array.isArray(rapports) ? rapports : [])
    .filter(rapport => rapport && SCORE_LISIBLE.test(String(rapport.global_score)));
  if(!lisibles.length) return { periode, runs:0, message:"aucun rapport de run" };

  const classes = lisibles.slice().sort((a, b) =>
    comparerScoresJarvis(b.global_score, a.global_score)
    || String(a.created_at).localeCompare(String(b.created_at)));
  const dernier = lisibles.slice().sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)))[0];
  const somme = lisibles.reduce((total, rapport) => total + BigInt(rapport.global_score), 0n);
  const meilleurs = classes.slice(0, JARVIS_OBJETS_MAX);
  const idsMeilleurs = meilleurs.map(rapport => rapport.session_id);
  if(!sessions){
    sessions = await requete("boss_sessions?id=in.(" + idsMeilleurs.join(",")
      + ")&select=id,week_start,slot,run_no");
  }
  /* select_boss_team fige {id, owner, pseudo, data:{heroes}, …} : les heros
     sont sous `data`, comme le lit teamFromBossSnapshot cote site. */
  const participations = await requete("boss_participation?session_id=in.("
    + idsMeilleurs.join(",") + ")&select=session_id,pseudo,heros:team_snapshot->data->heroes");
  const sessionParId = new Map((Array.isArray(sessions) ? sessions : [])
    .map(session => [session.id, session]));
  return {
    periode,
    runs:lisibles.length,
    meilleur:formaterScoreJarvis(classes[0].global_score),
    /* Meme arrondi que le bilan du site (js/metier/boss-logique.js) : au plus
       proche, demi vers le haut. Deux chiffres differents pour une meme
       moyenne passeraient pour une erreur. */
    moyenne:formaterScoreJarvis(((somme + BigInt(Math.floor(lisibles.length / 2)))
      / BigInt(lisibles.length)).toString()),
    dernier:formaterScoreJarvis(dernier.global_score),
    meilleuresRuns:meilleurs.map(rapport => {
      const session = sessionParId.get(rapport.session_id) || {};
      return {
        score:formaterScoreJarvis(rapport.global_score),
        semaine:session.week_start || null,
        groupe:session.slot || null,
        run:session.run_no || null,
        participants:(Array.isArray(participations) ? participations : [])
          .filter(participation => participation.session_id === rapport.session_id)
          .map(participation => ({
            pseudo:String(participation.pseudo || "Membre"),
            heros:herosDeLInstantane(contexte.catalogue, participation.heros)
          }))
      };
    })
  };
}

function ajouterOutilsConfrerie(table, contexte) {
  table.qui_possede = {
    executer:args => outilQuiPossede(contexte, args),
    source:(args, donnees) => "possesseurs de " + (donnees.personnage || args.personnage || "?")
  };
  table.roster_de = {
    executer:args => outilRosterDe(contexte, args),
    source:(args, donnees) => "roster de " + (donnees.pseudo || args.pseudo || "?")
  };
  table.dispos = {
    executer:args => outilDispos(contexte, args),
    source:() => "dispos de la semaine"
  };
  table.scores_boss = {
    executer:args => outilScoresBoss(contexte, args),
    source:(args, donnees) => "scores de boss (" + (donnees.periode || "semaine") + ")"
  };
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
