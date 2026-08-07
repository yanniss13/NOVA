/* Constantes de donnees du site : catalogues, libelles et cles de stockage.

   Feuille de l'arbre, au meme titre que dom.js : ce module ne depend de rien
   et presque tout le reste depend de lui. Il ne lit `window.SEVEN_DS_*` qu'a
   l'evaluation, apres les scripts classiques d'index.html qui les posent.

   N'y mettre que de l'immuable. L'etat mutable de session (`currentUser`,
   `currentPseudo`) reste dans js/app.js : une liaison de module ne peut pas
   etre reaffectee depuis un importateur. */

  const DATA = window.SEVEN_DS_DATA;
  const BUILD_STATS = window.SEVEN_DS_BUILD_STATS || {
    version:0,
    weaponsByFile:{},
    statLabels:{}
  };
  const STORAGE_KEY = "confrerie7ds.teams";
  const TEAM_SIZE = 4;
  const ARMOR_SLOTS = ["Haut","Bas","Bottes","Ceinture","Armure liee"];
  const LINKED_ARMOR_SLOT = "Armure liee";
  const LINKED_ARMORS = window.SEVEN_DS_ARMURES_LIEES || {};
  const ARMOR_LABELS = {
    "Haut":"Haut","Bas":"Bas","Bottes":"Bottes",
    /* « Armure gravée » est le nom du jeu. La CLE reste « Armure liee » :
       elle est ecrite dans localStorage, dans Supabase et dans les chemins
       des images. Renommer le libelle est cosmetique, renommer la cle
       demanderait une migration de toutes les configurations enregistrees. */
    "Ceinture":"Ceinture","Armure liee":"Armure gravée"
  };
  const JEWEL_SLOTS = ["Anneau","Collier","Boucle d'oreille"];
  const JEWEL_LABELS = {
    "Anneau":"Anneau","Collier":"Collier","Boucle d'oreille":"B. oreille"
  };
  const POT = window.SEVEN_DS_POTENTIELS || {};
  const POT_MAX = 10;
  const META = window.SEVEN_DS_META || {};
  const CLOUD_TEAMS_CACHE_KEY = "confrerie7ds.cloud.teams";
  const CLOUD_ROSTER_CACHE_KEY = "confrerie7ds.cloud.roster";
  const CLOUD_COLLECTION_CACHE_KEY = "confrerie7ds.cloud.collection";
  /* Pas de prefixe `cloud.` : la constante C se mesure sur SON build et ne se
     partage pas, voir js/donnees/calibration-store.js. */
  const CALIBRATION_KEY = "confrerie7ds.calibration";
  const MIGRATION_KEY_PREFIX = "confrerie7ds.supabase.migrated.";

  const ELEMENTS = {
    FIRE:   {label:"Feu",      color:"#d24b3e"},
    WIND:   {label:"Vent",     color:"#4fa563"},
    DARK:   {label:"Ténèbres", color:"#9a6fd0"},
    EARTH:  {label:"Terre",    color:"#c0863e"},
    HOLY:   {label:"Sacré",    color:"#e6c766"},
    ICE:    {label:"Glace",    color:"#56b0c9"},
    THUNDER:{label:"Foudre",   color:"#5c74e0"}
  };
  // rôles au niveau des slots d'arme (vocabulaire plus fin du jeu)
  const WSLOT_ROLES = {
    Attacker:"Attaquant", Defender:"Défenseur", Supporter:"Soutien",
    Warden:"Gardien", Buster:"Briseur"
  };
  // enum d'arme du site -> libellé + icône de maîtrise (7ds-ui/mastery/<icon>.webp)
  const WEAPON_ENUM = {
    Axe:{label:"Hache",icon:"axe"}, Book:{label:"Grimoire",icon:"book"},
    SwordDual:{label:"Épées doubles",icon:"sworddual"}, Rapier:{label:"Rapière",icon:"rapier"},
    Shield:{label:"Épée & bouclier",icon:"shield"}, Lance:{label:"Lance",icon:"lance"},
    Sword1h:{label:"Épée à une main",icon:"sword1h"}, Cudgel3c:{label:"Nunchaku",icon:"cudgel3c"},
    Gauntlets:{label:"Gantelets",icon:"gauntlets"}, Sword2h:{label:"Épée à deux mains",icon:"sword2h"},
    Staff:{label:"Bâton",icon:"staff"}, Wand:{label:"Baguette",icon:"wand"}
  };
  const metaOf = id => (id && META[id]) || null;
  // dossier d'arme (chemin) -> enum du site (pour matcher les slots du perso)
  const FOLDER_TO_ENUM = {
    "Baguette":"Wand","Baton":"Staff","Bouclier":"Shield","Epee 1 main":"Sword1h",
    "Epee 2 mains":"Sword2h","Epees doubles":"SwordDual","Gantelets":"Gauntlets",
    "Hache":"Axe","Lance":"Lance","Livre":"Book","Nunchaku":"Cudgel3c","Rapiere":"Rapier"
  };
  const ENUM_TO_FOLDER = Object.fromEntries(
    Object.entries(FOLDER_TO_ENUM)
      .map(([folder, value]) => [value, folder])
  );

export {
  DATA,
  BUILD_STATS,
  STORAGE_KEY,
  TEAM_SIZE,
  ARMOR_SLOTS,
  LINKED_ARMOR_SLOT,
  LINKED_ARMORS,
  ARMOR_LABELS,
  JEWEL_SLOTS,
  JEWEL_LABELS,
  POT,
  POT_MAX,
  META,
  CLOUD_TEAMS_CACHE_KEY,
  CLOUD_ROSTER_CACHE_KEY,
  CLOUD_COLLECTION_CACHE_KEY,
  CALIBRATION_KEY,
  MIGRATION_KEY_PREFIX,
  ELEMENTS,
  WSLOT_ROLES,
  WEAPON_ENUM,
  metaOf,
  FOLDER_TO_ENUM,
  ENUM_TO_FOLDER
};
