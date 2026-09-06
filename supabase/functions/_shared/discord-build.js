"use strict";

/* La commande Discord /build : tout ce qui se raisonne sans reseau ni dessin.

   L'Edge Function lit les profils, les lignes de `roster_characters` et le
   petit catalogue de libelles publie sur Pages, puis tend le tout a
   `resoudreDemandeBuild`. Ce module rend alors soit UNE phrase d'erreur, soit
   des cartes pretes a dessiner. Aucun `fetch` ici : c'est ce qui rend la
   commande verifiable par des tests Node, sans Discord ni Supabase.

   Les libelles des emplacements et des elements sont recopies depuis
   js/noyau/constantes.js. Une Edge Function ne peut pas importer les modules
   ES du site — ils lisent `window` et tirent 2,5 Mo de catalogue derriere eux.
   Ces deux tables-la sont courtes et stables ; le reste (noms d'objets, noms
   de personnages, libelles de statistiques) vient du catalogue publie, jamais
   d'une copie. */

const ARMOR_SLOTS = ["Haut", "Bas", "Bottes", "Ceinture", "Armure liee"];
const ARMOR_LABELS = {
  "Haut":"Haut",
  "Bas":"Bas",
  "Bottes":"Bottes",
  "Ceinture":"Ceinture",
  /* « Armure gravée » est le nom du jeu ; « Armure liee » reste la CLE, celle
     qui est ecrite dans Supabase et dans les chemins des images. */
  "Armure liee":"Armure gravée"
};
const JEWEL_SLOTS = ["Anneau", "Collier", "Boucle d'oreille"];
const ELEMENT_LABELS = {
  FIRE:"Feu", WIND:"Vent", DARK:"Ténèbres", EARTH:"Terre",
  HOLY:"Sacré", ICE:"Glace", THUNDER:"Foudre", DEFAULT:"Physique"
};
/* Table du jeu, rapportee par le proprietaire — la meme que js/metier/perles.js.
   Le palier d'une perle est commun a tous ses emplacements : on le lit sur la
   premiere entree renseignee. */
const PEARL_LABELS = {
  1:"commune", 2:"remarquable", 3:"rare", 4:"héroïque", 5:"légendaire"
};

/* Les caracteres que l'atlas de polices sait dessiner. Le « % » n'en fait pas
   partie : le rendu PNG le trace a la main, ce module se contente de le
   laisser passer. */
const CARACTERES_DESSINABLES = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.()|=?%";
/* Deux caracteres tres frequents dans les noms d'objets du jeu, et qu'il vaut
   mieux traduire que reduire a une espace : « Épée & bouclier » doit rester
   lisible, et « Niveau 50, promotion 4 » garder sa ponctuation. */
const REMPLACEMENTS = { "&":"ET", ",":"." };

function buildCommandDefinition() {
  return {
    name:"build",
    description:"Partage le build d'un personnage du roster d'un joueur",
    type:1,
    options:[
      {
        type:3,
        name:"joueur",
        description:"Le pseudo du membre dont on veut voir le roster",
        autocomplete:true,
        required:true
      },
      {
        type:3,
        name:"personnage",
        description:"Le personnage dont on veut voir le build",
        autocomplete:true,
        required:true
      },
      {
        type:3,
        name:"arme",
        description:"Facultatif : une seule arme au lieu de tous les builds",
        autocomplete:true,
        required:false
      }
    ]
  };
}

/* L'AUTOCOMPLETION.

   Discord envoie une interaction de type 4 a chaque frappe, et n'accorde que
   trois secondes pour y repondre : aucune reponse differee n'est possible,
   contrairement a la commande elle-meme. Ces fonctions sont donc pures et
   immediates ; l'Edge Function ne garde que les lectures et leur cache.

   Elle envoie TOUTES les options avec la frappe, pas seulement celle qui est
   focalisee. C'est ce qui permet de ne proposer, dans « personnage », que les
   personnages du joueur deja choisi. */
const CHOIX_MAXIMUM = 25;

function lireOptionFocalisee(interaction) {
  const options = (interaction && interaction.data && interaction.data.options)
    || [];
  const lues = lireOptionsBuild(interaction);
  const focalisee = (Array.isArray(options) ? options : [])
    .find(option => option && option.focused);
  return {
    nom:focalisee && Object.prototype.hasOwnProperty.call(lues, focalisee.name)
      ? focalisee.name : "",
    valeur:focalisee ? lues[focalisee.name] || "" : "",
    options:lues
  };
}

/* Ce qui COMMENCE par la saisie passe avant ce qui la contient : taper « an »
   doit remonter « Anne » avant « Yannick ». A rang egal, l'ordre alphabetique,
   pour que deux frappes identiques donnent le meme menu. */
function classerPropositions(candidats, saisie) {
  const cherchee = normaliserRecherche(saisie);
  const vus = new Set();
  return (Array.isArray(candidats) ? candidats : [])
    .filter(candidat => {
      if(typeof candidat !== "string" || !candidat) return false;
      if(vus.has(candidat)) return false;
      vus.add(candidat);
      return true;
    })
    .map(candidat => {
      const normalise = normaliserRecherche(candidat);
      if(!cherchee) return { candidat, rang:1 };
      if(normalise.startsWith(cherchee)) return { candidat, rang:0 };
      return normalise.includes(cherchee) ? { candidat, rang:1 } : null;
    })
    .filter(Boolean)
    .sort((gauche, droite) => gauche.rang !== droite.rang
      ? gauche.rang - droite.rang
      : gauche.candidat.localeCompare(droite.candidat, "fr"))
    /* Discord refuse plus de vingt-cinq propositions, et rejette la liste
       entiere quand elle deborde : c'est a nous de la tailler. */
    .slice(0, CHOIX_MAXIMUM)
    .map(entree => ({ name:entree.candidat, value:entree.candidat }));
}

/* Le nom lisible d'une ligne de roster : celui du catalogue, ou l'identifiant
   brut quand le catalogue ne le connait pas. Mieux vaut un slug affiche qu'un
   personnage qui disparait du menu. */
function nomDeLigne(ligne, libelles) {
  const identifiant = ligne && ligne.char_id;
  if(!identifiant) return "";
  const fiche = ((libelles && libelles.personnages) || {})[identifiant];
  return (fiche && fiche.nom) || identifiant;
}

/* L'identifiant derriere un nom saisi. La commande et le menu des armes s'en
   servent tous les deux : une seule regle de correspondance, pas deux qui
   divergeraient au premier accent. */
function trouverCharId(lignes, libelles, saisie) {
  const cherche = normaliserRecherche(saisie);
  if(!cherche) return "";
  const ligne = (Array.isArray(lignes) ? lignes : []).find(entree =>
    normaliserRecherche(nomDeLigne(entree, libelles)) === cherche
    || normaliserRecherche(entree && entree.char_id) === cherche);
  return ligne ? ligne.char_id : "";
}

/* L'enchainement des trois menus, avec ses lectures INJECTEES.

   Le choix de la lecture depend du champ en cours de frappe : c'est
   exactement ce qu'il fallait pouvoir eprouver sans Discord ni base. L'Edge
   Function n'apporte que `lireProfils`, `lireRoster` et `lireBuilds`, avec
   leur cache — la decision, elle, est ici.

   Aucune lecture inutile : le menu des joueurs ne touche pas au roster, et le
   menu des personnages ne demande jamais la colonne `builds`. */
async function propositionsBuild(entree) {
  const source = entree || {};
  const { nom, valeur, options } = lireOptionFocalisee(source.interaction);
  if(!nom) return [];

  const profils = await source.lireProfils();
  if(nom === "joueur"){
    return classerPropositions(
      (profils || []).map(profil => profil && profil.pseudo), valeur
    );
  }

  /* Tant que le champ « joueur » ne designe personne, les deux autres se
     taisent : lister les vingt-six personnages du jeu quand le membre n'en
     possede que six serait pire que le silence. */
  const profil = trouverProfil(profils, options.joueur);
  if(!profil) return [];

  const lignes = await source.lireRoster(profil.id);
  if(nom === "personnage"){
    return classerPropositions(
      nomsDePersonnages(lignes, source.libelles), valeur
    );
  }

  const charId = trouverCharId(lignes, source.libelles, options.personnage);
  if(!charId) return [];
  const builds = await source.lireBuilds(profil.id, charId);
  return classerPropositions(Object.keys(builds || {}), valeur);
}

function nomsDePersonnages(lignes, libelles) {
  return (Array.isArray(lignes) ? lignes : [])
    .map(ligne => nomDeLigne(ligne, libelles))
    .filter(Boolean)
    .sort((gauche, droite) => gauche.localeCompare(droite, "fr"));
}

function lireOptionsBuild(interaction) {
  const options = (interaction && interaction.data && interaction.data.options)
    || [];
  const lues = { joueur:"", personnage:"", arme:"" };
  (Array.isArray(options) ? options : []).forEach(option => {
    const nom = option && option.name;
    if(!Object.prototype.hasOwnProperty.call(lues, nom)) return;
    if(option.value === null || option.value === undefined) return;
    lues[nom] = String(option.value).trim();
  });
  return lues;
}

/* Sans accents ni casse : c'est la forme sur laquelle on compare deux noms
   ecrits par deux personnes differentes. */
function normaliserRecherche(valeur) {
  return String(valeur === null || valeur === undefined ? "" : valeur)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function texteCarte(valeur) {
  const source = String(valeur === null || valeur === undefined ? "" : valeur)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase();
  let sortie = "";
  for(const caractere of source){
    if(Object.prototype.hasOwnProperty.call(REMPLACEMENTS, caractere)){
      sortie += REMPLACEMENTS[caractere];
    }else if(CARACTERES_DESSINABLES.includes(caractere)){
      sortie += caractere;
    }else{
      sortie += " ";
    }
  }
  return sortie.replace(/\s+/g, " ").trim();
}

/* Le nom lisible d'un objet EST le nom de fichier de son image : les 348
   entrees du catalogue le verifient. Rien a charger, donc, pour ecrire
   « Hache de guerre » a partir de « 7ds-armes/Hache/Hache de guerre.webp ». */
function nomDeFichier(chemin) {
  if(typeof chemin !== "string" || !chemin) return "";
  return chemin.split("/").pop().replace(/\.webp$/i, "");
}

function identifiantDeFichier(valeur) {
  return normaliserRecherche(valeur)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/* Les propositions faites au lecteur quand rien ne correspond. On garde ce
   qui contient la saisie, et ce qui partage au moins trois lettres de tete —
   « yannick » doit ramener « YanniSs13 » sans deviner plus loin. */
function longueurPrefixeCommun(gauche, droite) {
  const maximum = Math.min(gauche.length, droite.length);
  let index = 0;
  while(index < maximum && gauche[index] === droite[index]) index += 1;
  return index;
}

function propositions(candidats, saisie) {
  const cherchee = normaliserRecherche(saisie);
  return candidats
    .map(candidat => {
      const normalise = normaliserRecherche(candidat);
      const prefixe = longueurPrefixeCommun(normalise, cherchee);
      const contient = cherchee.length >= 2
        && (normalise.includes(cherchee) || cherchee.includes(normalise));
      return { candidat, score:contient ? 100 : prefixe };
    })
    .filter(entree => entree.score >= 3)
    .sort((gauche, droite) => droite.score - gauche.score)
    .slice(0, 5)
    .map(entree => entree.candidat);
}

function phraseProposition(candidats, saisie) {
  const proches = propositions(candidats, saisie);
  const liste = proches.length ? proches : candidats.slice(0, 5);
  if(!liste.length) return "";
  return liste.length === 1
    ? " Tu voulais dire **" + liste[0] + "** ?"
    : " Au choix : " + liste.map(nom => "**" + nom + "**").join(", ") + ".";
}

function trouverProfil(profils, saisie) {
  const cherche = normaliserRecherche(saisie);
  return (profils || []).find(
    profil => normaliserRecherche(profil && profil.pseudo) === cherche
  ) || null;
}

/* Une valeur en dix-millemes redevient un pourcentage ; une valeur plate
   reste telle quelle. Les zeros de fin sont retires : « 12.50 % » ne dit rien
   de plus que « 12.5 % ». */
function valeurLisible(valeur, unite) {
  const nombre = Number(valeur);
  if(!Number.isFinite(nombre)) return "";
  if(unite !== "ten-thousandths") return String(nombre);
  const pourcentage = nombre / 100;
  return String(Number(pourcentage.toFixed(4))) + " %";
}

function ligneEnchantement(choix, libellesStats) {
  if(!choix || typeof choix !== "object" || Array.isArray(choix)) return "";
  const code = choix.stat;
  if(typeof code !== "string" || !code) return "";
  /* Un code absent du catalogue s'affiche brut : une ligne disparue laisserait
     croire que l'emplacement est vide. */
  const metadonnees = Object.prototype.hasOwnProperty.call(libellesStats, code)
    ? libellesStats[code] : null;
  const libelle = (metadonnees && metadonnees.fr) || code;
  const valeur = valeurLisible(choix.value, metadonnees && metadonnees.unit);
  return valeur ? libelle + " : " + valeur : libelle;
}

function paliersPerle(enchantements) {
  const premiere = (Array.isArray(enchantements) ? enchantements : [])
    .find(choix => choix && typeof choix === "object" && !Array.isArray(choix));
  const palier = premiere && premiere.tier;
  return Object.prototype.hasOwnProperty.call(PEARL_LABELS, palier)
    ? "Perle " + PEARL_LABELS[palier]
    : "";
}

function detailsArme(config, libellesStats) {
  if(!config || typeof config !== "object") return [];
  const details = [];
  const niveau = [];
  if(Number.isFinite(Number(config.level)) && Number(config.level) > 0){
    niveau.push("Niveau " + Number(config.level));
  }
  if(Number.isFinite(Number(config.promotion)) && Number(config.promotion) > 0){
    niveau.push("promotion " + Number(config.promotion));
  }
  if(Number.isFinite(Number(config.overlimit)) && Number(config.overlimit) > 0){
    niveau.push("dépassement " + Number(config.overlimit));
  }
  if(niveau.length) details.push(niveau.join(" · "));
  const perle = paliersPerle(config.enchantments);
  if(perle) details.push(perle);
  (Array.isArray(config.enchantments) ? config.enchantments : [])
    .forEach(choix => {
      const ligne = ligneEnchantement(choix, libellesStats);
      if(ligne) details.push(ligne);
    });
  return details;
}

function detailsPiece(config, libellesStats) {
  if(!config || typeof config !== "object") return [];
  const details = [];
  const passif = Number(config.passiveLevel);
  if(Number.isFinite(passif) && passif > 0){
    details.push("Passif niveau " + passif);
  }
  (Array.isArray(config.enchantments) ? config.enchantments : [])
    .forEach(choix => {
      const ligne = ligneEnchantement(choix, libellesStats);
      if(ligne) details.push(ligne);
    });
  return details;
}

function lignesEmplacements(slots, etiquettes, equipement, configs, libellesStats) {
  const pieces = equipement && typeof equipement === "object" ? equipement : {};
  const configurations = configs && typeof configs === "object" ? configs : {};
  return slots.map(slot => {
    const fichier = pieces[slot];
    return {
      emplacement:etiquettes[slot] || slot,
      nom:nomDeFichier(fichier),
      image:typeof fichier === "string" ? fichier : "",
      details:fichier
        ? detailsPiece(configurations[slot], libellesStats)
        : []
    };
  });
}

function carteDeBuild(contexte, typeArme, build) {
  const libellesStats = (contexte.libelles && contexte.libelles.stats) || {};
  const donnees = build && typeof build === "object" ? build : {};
  return {
    joueur:contexte.pseudo,
    personnage:contexte.personnage,
    element:contexte.element,
    potentiel:contexte.potentiel,
    portrait:contexte.portrait,
    arme:typeArme,
    note:typeof donnees.note === "string" ? donnees.note : "",
    fichier:"build-" + identifiantDeFichier(contexte.pseudo)
      + "-" + identifiantDeFichier(contexte.charId)
      + "-" + identifiantDeFichier(typeArme) + ".png",
    sections:[
      {
        titre:"Arme",
        lignes:[{
          emplacement:typeArme,
          nom:nomDeFichier(donnees.weapon),
          image:typeof donnees.weapon === "string" ? donnees.weapon : "",
          details:donnees.weapon
            ? detailsArme(donnees.weaponConfig, libellesStats)
            : []
        }]
      },
      {
        titre:"Armure",
        lignes:lignesEmplacements(
          ARMOR_SLOTS, ARMOR_LABELS, donnees.armor, donnees.armorConfig,
          libellesStats
        )
      },
      {
        titre:"Bijoux",
        lignes:lignesEmplacements(
          JEWEL_SLOTS,
          { Anneau:"Anneau", Collier:"Collier",
            "Boucle d'oreille":"Boucle d'oreille" },
          donnees.jewel, donnees.jewelConfig, libellesStats
        )
      }
    ]
  };
}

/* L'unique porte d'entree. Elle rend `{ erreur }` ou `{ cartes }`, jamais les
   deux : l'appelant n'a qu'une question a poser. */
function resoudreDemandeBuild(entree) {
  const source = entree || {};
  const options = source.options || {};
  const profils = Array.isArray(source.profils) ? source.profils : [];
  const lignes = Array.isArray(source.lignes) ? source.lignes : [];
  const libelles = source.libelles || {};
  const personnages = libelles.personnages || {};

  const profil = trouverProfil(profils, options.joueur);
  if(!profil){
    return { erreur:"Aucun membre nommé **" + options.joueur
      + "** dans la confrérie."
      + phraseProposition(profils.map(item => item.pseudo).filter(Boolean),
        options.joueur) };
  }

  const siennes = lignes.filter(ligne => ligne && ligne.owner === profil.id);
  if(!siennes.length){
    return { erreur:"**" + profil.pseudo
      + "** n'a encore aucun personnage dans son roster." };
  }

  const nomDuPersonnage = ligne => nomDeLigne(ligne, libelles);
  /* La MEME regle de correspondance que le menu d'autocompletion : deux
     lectures differentes du meme nom saisi finiraient par se contredire. */
  const charId = trouverCharId(siennes, libelles, options.personnage);
  const ligne = charId
    ? siennes.find(entree => entree.char_id === charId)
    : null;
  if(!ligne){
    return { erreur:"**" + profil.pseudo + "** n'a pas **"
      + options.personnage + "** dans son roster."
      + phraseProposition(siennes.map(nomDuPersonnage), options.personnage) };
  }

  const builds = ligne.builds && typeof ligne.builds === "object"
    && !Array.isArray(ligne.builds) ? ligne.builds : {};
  /* Un ordre stable : deux appels identiques doivent publier les memes images
     dans le meme ordre, sinon le salon devient illisible. */
  const types = Object.keys(builds).sort((gauche, droite) =>
    gauche.localeCompare(droite, "fr"));
  if(!types.length){
    return { erreur:"**" + profil.pseudo + "** n'a enregistré aucun build sur **"
      + nomDuPersonnage(ligne) + "**." };
  }

  let retenus = types;
  if(options.arme){
    const armeCherchee = normaliserRecherche(options.arme);
    retenus = types.filter(type => normaliserRecherche(type) === armeCherchee);
    if(!retenus.length){
      return { erreur:"Aucun build **" + options.arme + "** sur **"
        + nomDuPersonnage(ligne) + "**."
        + phraseProposition(types, options.arme) };
    }
  }

  const meta = personnages[ligne.char_id] || {};
  const contexte = {
    pseudo:profil.pseudo,
    charId:ligne.char_id,
    personnage:nomDuPersonnage(ligne),
    element:ELEMENT_LABELS[meta.element] || "",
    portrait:meta.fichier || "",
    potentiel:Number(ligne.potential_tier) || 0,
    libelles
  };
  return { cartes:retenus.map(type => carteDeBuild(contexte, type, builds[type])) };
}

function contenuMessageBuild(cartes) {
  const liste = Array.isArray(cartes) ? cartes : [];
  if(!liste.length) return "";
  const premiere = liste[0];
  const entete = "🗡️ **" + premiere.personnage + "**"
    + (premiere.element ? " · " + premiere.element : "")
    + (premiere.potentiel ? " · potentiel " + premiere.potentiel : "")
    + " — roster de **" + premiere.joueur + "**";
  if(liste.length === 1){
    return entete + "\nBuild **" + premiere.arme + "**.";
  }
  return entete + "\n" + liste.length + " builds partagés : "
    + liste.map(carte => "**" + carte.arme + "**").join(", ") + ".";
}

const discordBuildApi = {
  ARMOR_SLOTS,
  ARMOR_LABELS,
  JEWEL_SLOTS,
  buildCommandDefinition,
  lireOptionsBuild,
  lireOptionFocalisee,
  classerPropositions,
  nomsDePersonnages,
  trouverCharId,
  propositionsBuild,
  normaliserRecherche,
  trouverProfil,
  texteCarte,
  nomDeFichier,
  resoudreDemandeBuild,
  contenuMessageBuild
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordBuildApi;
}
globalThis.NOVA_DISCORD_BUILD = discordBuildApi;
