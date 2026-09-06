"use strict";

/* La commande Discord /build : ce qui est PUR y est verifie ici, sans reseau
   ni dessin. Le module partage ne lit rien lui-meme — l'Edge Function lui
   tend les profils, les lignes de roster et les libelles, il rend soit un
   message d'erreur, soit des cartes pretes a dessiner. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const {
  buildCommandDefinition,
  commandDefinitions,
  lireOptionsBuild,
  lireOptionFocalisee,
  classerPropositions,
  nomsDePersonnages,
  trouverCharId,
  propositionsBuild,
  texteCarte,
  resoudreDemandeBuild,
  contenuMessageBuild
} = require(path.join(
  ROOT, "supabase", "functions", "_shared", "discord-build.js"
));

/* ------------------------------------------------------------------ */
/* La definition de la commande                                        */

const definition = buildCommandDefinition();
assert.equal(definition.name, "build");
assert.equal(definition.type, 1);
const noms = definition.options.map(option => option.name);
assert.deepEqual(noms, ["joueur", "personnage", "arme"],
  "les deux arguments demandes, plus l'arme facultative");
assert.deepEqual(
  definition.options.map(option => Boolean(option.required)),
  [true, true, false],
  "sans arme, la commande envoie tous les builds du personnage");
definition.options.forEach(option => {
  assert.equal(option.type, 3, "trois chaines de caracteres");
  assert.ok(option.description && option.description.length <= 100,
    "Discord refuse une description vide ou de plus de cent caracteres");
  assert.equal(option.autocomplete, true,
    "les trois champs se completent : personne ne connait par coeur"
    + " l'orthographe d'un pseudo ni d'un personnage");
});

/* ------------------------------------------------------------------ */
/* L'autocompletion : quel champ est en cours de frappe                */

const focalisee = lireOptionFocalisee({
  data:{
    name:"build",
    options:[
      { name:"joueur", type:3, value:"yanni" },
      { name:"personnage", type:3, value:"ba", focused:true }
    ]
  }
});
assert.equal(focalisee.nom, "personnage");
assert.equal(focalisee.valeur, "ba");
assert.deepEqual(focalisee.options,
  { joueur:"yanni", personnage:"ba", arme:"" },
  "les autres champs arrivent avec : c'est ce qui permet de ne proposer que"
  + " les personnages du joueur deja choisi");
assert.deepEqual(lireOptionFocalisee({}),
  { nom:"", valeur:"", options:{ joueur:"", personnage:"", arme:"" } },
  "une interaction sans options ne doit pas faire tomber la fonction");
assert.equal(
  lireOptionFocalisee({ data:{ options:[{ name:"joueur", value:"x" }] } }).nom,
  "", "sans champ focalise, aucun champ n'est en cours de frappe");

/* ------------------------------------------------------------------ */
/* Le classement des propositions                                      */

const MEMBRES = ["Yanniss13", "Yannick", "Élodie", "Bastien", "Zoe"];

assert.deepEqual(classerPropositions(MEMBRES, "yan"),
  [{ name:"Yannick", value:"Yannick" },
    { name:"Yanniss13", value:"Yanniss13" }],
  "les deux qui commencent par la saisie, par ordre alphabetique");
assert.deepEqual(classerPropositions(MEMBRES, "elo"),
  [{ name:"Élodie", value:"Élodie" }],
  "la saisie sans accent doit trouver le pseudo accentue");
assert.deepEqual(classerPropositions(MEMBRES, "STIE"),
  [{ name:"Bastien", value:"Bastien" }],
  "une correspondance au milieu du mot compte aussi, sans egard a la casse");
assert.deepEqual(classerPropositions(MEMBRES, "zzz"), [],
  "rien ne correspond : on ne propose rien plutot que n'importe quoi");
assert.equal(classerPropositions(MEMBRES, "").length, 5,
  "un champ vide propose tout le monde");

/* Ce qui commence par la saisie passe avant ce qui la contient : taper « an »
   doit remonter « Anne » avant « Yannick ». */
assert.deepEqual(classerPropositions(["Yannick", "Anne"], "an"),
  [{ name:"Anne", value:"Anne" }, { name:"Yannick", value:"Yannick" }]);

/* Discord refuse plus de vingt-cinq propositions, et coupe la liste entiere
   quand elle deborde : c'est a nous de la tailler. */
const beaucoup = Array.from({ length:40 }, (_, index) =>
  "Membre" + String(index).padStart(2, "0"));
assert.equal(classerPropositions(beaucoup, "").length, 25);

/* Un doublon ne doit pas occuper deux places : deux personnages du roster
   peuvent porter le meme nom si le catalogue evolue. */
assert.deepEqual(classerPropositions(["Ban", "Ban", "Bug"], "b"),
  [{ name:"Ban", value:"Ban" }, { name:"Bug", value:"Bug" }]);
assert.deepEqual(classerPropositions(["", null, "Ban"], ""),
  [{ name:"Ban", value:"Ban" }], "ni vide ni nul dans la liste");

/* Les personnages proposes sont ceux du roster, nommes par le catalogue. Un
   identifiant absent du catalogue se propose brut : mieux vaut un slug qu'un
   personnage qui disparait du menu. */
assert.deepEqual(
  nomsDePersonnages(
    [{ char_id:"merlin" }, { char_id:"ban" }, { char_id:"inconnu" }],
    { personnages:{ ban:{ nom:"Ban" }, merlin:{ nom:"Merlin" } } }
  ),
  ["Ban", "inconnu", "Merlin"],
  "classes par nom sans egard a la casse, comme un lecteur les cherche,"
  + " et non par code de caractere");
assert.deepEqual(nomsDePersonnages(null, null), []);

/* Retrouver l'identifiant derriere un nom saisi. Le menu des armes en a
   besoin : il lit les builds d'UNE ligne, et doit donc savoir laquelle avant
   de la demander. La commande s'en sert aussi — une seule regle de
   correspondance, pas deux qui divergeraient. */
const LIGNES_NOMMEES = [{ char_id:"ban" }, { char_id:"merlin" }];
const CATALOGUE = { personnages:{ ban:{ nom:"Ban" }, merlin:{ nom:"Merlin" } } };
assert.equal(trouverCharId(LIGNES_NOMMEES, CATALOGUE, "merlin"), "merlin");
assert.equal(trouverCharId(LIGNES_NOMMEES, CATALOGUE, "MERLIN"), "merlin",
  "la casse ne compte pas");
assert.equal(trouverCharId(LIGNES_NOMMEES, CATALOGUE, "Bân"), "ban",
  "ni les accents");
assert.equal(trouverCharId(LIGNES_NOMMEES, CATALOGUE, "escanor"), "",
  "un personnage absent du roster ne rend aucun identifiant");
assert.equal(trouverCharId(null, null, "ban"), "");

/* ------------------------------------------------------------------ */
/* L'enchainement complet des trois menus                              */

/* Les lectures Supabase sont INJECTEES : l'enchainement — quel menu declenche
   quelle lecture, et laquelle ne se fait pas — se verifie ici, en Node, sans
   Discord ni base. L'Edge Function n'apporte que les lecteurs et leur cache. */
function interactionFocalisee(champ, valeurs){
  const options = ["joueur", "personnage", "arme"]
    .filter(nom => valeurs[nom] !== undefined)
    .map(nom => ({
      name:nom, type:3, value:valeurs[nom],
      ...(nom === champ ? { focused:true } : {})
    }));
  return { type:4, data:{ name:"build", options } };
}

function lecteurs(journal){
  return {
    lireProfils:async () => {
      journal.push("profils");
      return [{ id:"u-1", pseudo:"YanniSs13" }, { id:"u-2", pseudo:"Élodie" }];
    },
    lireRoster:async ownerId => {
      journal.push("roster:" + ownerId);
      return ownerId === "u-1" ? [{ char_id:"ban" }, { char_id:"merlin" }] : [];
    },
    lireBuilds:async (ownerId, charId) => {
      journal.push("builds:" + ownerId + ":" + charId);
      return charId === "ban" ? { Nunchaku:{}, Hache:{} } : {};
    }
  };
}

const CATALOGUE_MENU = { personnages:{
  ban:{ nom:"Ban" }, merlin:{ nom:"Merlin" }
} };

async function menu(champ, valeurs, journal){
  return await propositionsBuild(Object.assign(
    { interaction:interactionFocalisee(champ, valeurs), libelles:CATALOGUE_MENU },
    lecteurs(journal)
  ));
}

(async () => {
  let journal = [];
  assert.deepEqual(await menu("joueur", { joueur:"yan" }, journal),
    [{ name:"YanniSs13", value:"YanniSs13" }]);
  assert.deepEqual(journal, ["profils"],
    "le menu des joueurs ne touche pas au roster");

  journal = [];
  assert.deepEqual(
    await menu("personnage", { joueur:"YanniSs13", personnage:"" }, journal),
    [{ name:"Ban", value:"Ban" }, { name:"Merlin", value:"Merlin" }]);
  assert.deepEqual(journal, ["profils", "roster:u-1"],
    "le roster du joueur choisi, et rien de plus : pas la colonne des builds");

  journal = [];
  assert.deepEqual(
    await menu("personnage", { joueur:"inconnu", personnage:"b" }, journal),
    [], "tant que le joueur ne designe personne, on ne propose rien");
  assert.deepEqual(journal, ["profils"],
    "et surtout on ne lit aucun roster");

  journal = [];
  assert.deepEqual(
    await menu("arme", { joueur:"YanniSs13", personnage:"Ban", arme:"" }, journal),
    [{ name:"Hache", value:"Hache" }, { name:"Nunchaku", value:"Nunchaku" }],
    "seules les armes sur lesquelles ce joueur a vraiment un build");
  assert.deepEqual(journal, ["profils", "roster:u-1", "builds:u-1:ban"],
    "les builds d'UNE ligne, le personnage etant deja choisi");

  journal = [];
  assert.deepEqual(
    await menu("arme",
      { joueur:"YanniSs13", personnage:"Escanor", arme:"" }, journal),
    [], "un personnage absent du roster ne propose aucune arme");
  assert.deepEqual(journal, ["profils", "roster:u-1"],
    "et ne declenche pas la lecture des builds");

  journal = [];
  assert.deepEqual(await propositionsBuild(Object.assign(
    { interaction:{ type:4, data:{ name:"build", options:[] } },
      libelles:CATALOGUE_MENU },
    lecteurs(journal)
  )), [], "sans champ focalise, aucune proposition");
  assert.deepEqual(journal, [], "et aucune lecture");

  console.log("OK discord-build : autocompletion");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

/* Le script d'enregistrement ne connait que `commandDefinitions` : une
   commande absente de cette liste n'arriverait jamais dans Discord. */
const {
  commandDefinitions: planningCommandDefinitions
} = require(path.join(
  ROOT, "supabase", "functions", "_shared", "discord-planning.js"
));
assert.ok(
  planningCommandDefinitions().some(commande => commande.name === "build"),
  "/build doit rejoindre les commandes enregistrees par le script");
assert.equal(commandDefinitions, undefined,
  "une seule liste de commandes, celle de discord-planning.js");

/* ------------------------------------------------------------------ */
/* La lecture des options                                              */

const optionsLues = lireOptionsBuild({
  data:{
    name:"build",
    options:[
      { name:"personnage", type:3, value:"  Ban " },
      { name:"joueur", type:3, value:"YanniSs13" }
    ]
  }
});
assert.deepEqual(optionsLues, { joueur:"YanniSs13", personnage:"Ban", arme:"" },
  "l'ordre d'arrivee ne compte pas, et les espaces sont retires");
assert.deepEqual(lireOptionsBuild({}), { joueur:"", personnage:"", arme:"" },
  "une interaction sans options ne doit pas faire tomber la fonction");
assert.deepEqual(
  lireOptionsBuild({ data:{ options:[{ name:"joueur", value:42 }] } }),
  { joueur:"42", personnage:"", arme:"" },
  "une valeur non textuelle est ramenee a du texte");

/* ------------------------------------------------------------------ */
/* Le texte que la police du PNG sait dessiner                         */

assert.equal(texteCarte("Baguette à l'aura triomphale"),
  "BAGUETTE A L AURA TRIOMPHALE",
  "l'apostrophe n'existe pas dans l'atlas : elle devient une espace");
assert.equal(texteCarte("Epee & bouclier"), "EPEE ET BOUCLIER",
  "l'esperluette se lit, elle ne se dessine pas");
assert.equal(texteCarte("Ténèbres"), "TENEBRES");
assert.equal(texteCarte("12.5 %"), "12.5 %",
  "le pourcentage survit : le rendu le dessine a la main");
assert.equal(texteCarte("Niveau 50, promotion 4"), "NIVEAU 50. PROMOTION 4",
  "la virgule devient un point, que l'atlas connait");
assert.equal(texteCarte("a  b"), "A B", "les espaces multiples sont ramenes a une");
assert.equal(texteCarte(null), "");
const ATLAS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/:.()|=?%";
[...texteCarte("Épée « Croc » +3 ~ 90 % / niv. 5, palier 2")].forEach(caractere => {
  assert.ok(ATLAS.includes(caractere),
    "caractere indessinable rendu par texteCarte : " + caractere);
});

/* ------------------------------------------------------------------ */
/* Le jeu de donnees des cas suivants                                  */

const LIBELLES = {
  personnages:{
    ban:{ nom:"Ban", element:"DARK", fichier:"7ds-personnages/ban.webp" },
    merlin:{ nom:"Merlin", element:"ICE", fichier:"7ds-personnages/merlin.webp" }
  },
  armes:{
    "7ds-armes/Nunchaku/Nunchaku du renard.webp":{
      g1:{ promotionMax:4, outrepassementMax:6, niveauMax:50 }
    }
  },
  stats:{
    B_Atk:{ fr:"ATK", unit:"flat" },
    C_Critical_Rate:{ fr:"Taux critique", unit:"ten-thousandths" }
  }
};

const PROFILS = [
  { id:"u-1", pseudo:"YanniSs13" },
  { id:"u-2", pseudo:"Élodie" }
];

const LIGNES_ROSTER = [{
  owner:"u-1",
  char_id:"ban",
  potential_tier:7,
  builds:{
    Nunchaku:{
      weapon:"7ds-armes/Nunchaku/Nunchaku du renard.webp",
      weaponConfig:{
        version:1,
        gradeGameId:"g1",
        level:50,
        promotion:4,
        overlimit:2,
        enchantments:[
          { slot:0, tier:5, stat:"C_Critical_Rate", value:1250 },
          null
        ]
      },
      armor:{
        Haut:"7ds-armures-ssr/Haut/Haut du chasseur.webp",
        Bas:null, Bottes:null, Ceinture:null, "Armure liee":null
      },
      armorConfig:{
        Haut:{ version:1, passiveLevel:3, enchantments:[
          { slot:0, stat:"B_Atk", value:120 }
        ] }
      },
      jewel:{ Anneau:"7ds-bijoux/Anneau/Anneau du loup.webp",
        Collier:null, "Boucle d'oreille":null },
      jewelConfig:{},
      note:"Build de raid"
    },
    Hache:{
      weapon:"7ds-armes/Hache/Hache de guerre.webp",
      weaponConfig:null,
      armor:{ Haut:null, Bas:null, Bottes:null, Ceinture:null, "Armure liee":null },
      armorConfig:{},
      jewel:{ Anneau:null, Collier:null, "Boucle d'oreille":null },
      jewelConfig:{},
      note:""
    }
  }
}];

function demande(options){
  return resoudreDemandeBuild({
    profils:PROFILS,
    lignes:LIGNES_ROSTER,
    libelles:LIBELLES,
    options
  });
}

/* ------------------------------------------------------------------ */
/* Retrouver le joueur                                                 */

const joueurInconnu = demande({ joueur:"Yannick", personnage:"Ban", arme:"" });
assert.equal(joueurInconnu.cartes, undefined);
assert.match(joueurInconnu.erreur, /Yannick/,
  "l'erreur cite ce qui a ete tape");
assert.match(joueurInconnu.erreur, /YanniSs13/,
  "et propose le pseudo proche plutot que de laisser chercher");

const casseIgnoree = demande({ joueur:"yanniss13", personnage:"ban", arme:"" });
assert.equal(casseIgnoree.erreur, undefined, casseIgnoree.erreur);

const accentIgnore = demande({ joueur:"elodie", personnage:"Ban", arme:"" });
assert.match(accentIgnore.erreur, /Élodie/,
  "« elodie » trouve « Élodie », dont le roster est vide");
assert.match(accentIgnore.erreur, /roster/i);

/* ------------------------------------------------------------------ */
/* Retrouver le personnage                                             */

const personnageAbsent = demande({
  joueur:"YanniSs13", personnage:"Merlin", arme:""
});
assert.match(personnageAbsent.erreur, /Merlin/);
assert.match(personnageAbsent.erreur, /Ban/,
  "les personnages que le joueur possede sont proposes");

/* ------------------------------------------------------------------ */
/* Les cartes                                                          */

const tousLesBuilds = demande({ joueur:"YanniSs13", personnage:"Ban", arme:"" });
assert.equal(tousLesBuilds.erreur, undefined, tousLesBuilds.erreur);
assert.equal(tousLesBuilds.cartes.length, 2,
  "sans arme precisee, chaque build du personnage part dans le salon");
assert.deepEqual(tousLesBuilds.cartes.map(carte => carte.arme),
  ["Hache", "Nunchaku"],
  "les armes sont classees, pour que deux appels rendent le meme ordre");

const uneArme = demande({
  joueur:"YanniSs13", personnage:"Ban", arme:"nunchaku"
});
assert.equal(uneArme.cartes.length, 1);
assert.equal(uneArme.cartes[0].arme, "Nunchaku");

const armeSansBuild = demande({
  joueur:"YanniSs13", personnage:"Ban", arme:"Rapiere"
});
assert.match(armeSansBuild.erreur, /Rapiere/);
assert.match(armeSansBuild.erreur, /Nunchaku/,
  "les armes reellement equipees sont proposees");

const carte = uneArme.cartes[0];
assert.equal(carte.joueur, "YanniSs13");
assert.equal(carte.personnage, "Ban");
assert.equal(carte.element, "Ténèbres");
assert.equal(carte.potentiel, 7);
assert.equal(carte.note, "Build de raid");
assert.equal(carte.fichier, "build-yanniss13-ban-nunchaku.png",
  "un nom de fichier stable, sans accent ni espace");

/* La carte est illustree : chaque ligne porte le chemin de l'image de son
   objet, et l'en-tete le portrait du personnage. Le rendu en deduit l'adresse
   de la vignette publiee ; sans ces chemins, il n'aurait que du texte. */
assert.equal(carte.portrait, "7ds-personnages/ban.webp");

const sections = carte.sections;
assert.deepEqual(sections.map(section => section.titre),
  ["Arme", "Armure", "Bijoux"]);

const [armeSection, armureSection, bijouxSection] = sections;
assert.equal(armeSection.lignes[0].nom, "Nunchaku du renard",
  "le nom lisible se lit dans le chemin de l'image");
assert.equal(armeSection.lignes[0].image,
  "7ds-armes/Nunchaku/Nunchaku du renard.webp");
assert.deepEqual(armeSection.lignes[0].details, [
  "Perle légendaire",
  "Taux critique : 12.5 %"
], "la valeur en dix-millièmes redevient un pourcentage");

/* Le niveau, la promotion et l'outrepassement quittent la phrase de details :
   ce sont des MESURES, chacune avec son maximum, que le rendu dessine.
   « Promotion 4 » ne disait pas si c'etait la moitie ou le bout ; « 4 sur 4 »
   le dit. Le maximum vient du catalogue publie, jamais d'une supposition. */
assert.deepEqual(armeSection.lignes[0].mesures, [
  { libelle:"Niveau", valeur:50, maximum:50, forme:"barre" },
  { libelle:"Outrepassement", valeur:2, maximum:6, forme:"etoile" }
], "« outrepassement » est le mot du jeu, « dépassement » n'en est pas un");

/* Sans maximum connu — une arme absente du catalogue, ou un build enregistre
   avant que le grade soit note — la mesure garde sa valeur et perd sa jauge.
   Un maximum invente serait pire qu'un maximum absent. */
const sansGrade = resoudreDemandeBuild({
  profils:PROFILS,
  lignes:[{
    owner:"u-1", char_id:"ban", potential_tier:0,
    builds:{ Hache:{
      weapon:"7ds-armes/Hache/Hache de guerre.webp",
      weaponConfig:{ level:30, promotion:2, overlimit:0 },
      armor:{}, armorConfig:{}, jewel:{}, jewelConfig:{}, note:""
    } }
  }],
  libelles:LIBELLES,
  options:{ joueur:"YanniSs13", personnage:"Ban", arme:"" }
}).cartes[0];
assert.deepEqual(sansGrade.sections[0].lignes[0].mesures, [
  { libelle:"Niveau", valeur:30, maximum:0, forme:"barre" }
], "la promotion se deduit du niveau : deux lignes pour une seule information");

assert.equal(armureSection.lignes.length, 5,
  "les cinq emplacements d'armure, meme vides");
assert.deepEqual(armureSection.lignes.map(ligne => ligne.emplacement),
  ["Haut", "Bas", "Bottes", "Ceinture", "Armure gravée"]);
assert.equal(armureSection.lignes[0].nom, "Haut du chasseur");
assert.equal(armureSection.lignes[0].image,
  "7ds-armures-ssr/Haut/Haut du chasseur.webp");
assert.deepEqual(armureSection.lignes[0].details,
  ["Passif niveau 3", "ATK : 120"],
  "une stat plate ne porte pas de pourcentage");
assert.equal(armureSection.lignes[1].nom, "",
  "un emplacement vide se dit vide, il ne se tait pas");
assert.deepEqual(armureSection.lignes[1].details, []);
assert.equal(armureSection.lignes[1].image, "",
  "un emplacement vide ne porte aucune image");

assert.deepEqual(bijouxSection.lignes.map(ligne => ligne.emplacement),
  ["Anneau", "Collier", "Boucle d'oreille"]);
assert.equal(bijouxSection.lignes[0].nom, "Anneau du loup");

/* Une arme sans configuration reste affichable : le joueur a equipe l'objet
   sans jamais ouvrir l'editeur. */
const carteNue = tousLesBuilds.cartes[0];
assert.equal(carteNue.arme, "Hache");
assert.equal(carteNue.sections[0].lignes[0].nom, "Hache de guerre");
assert.deepEqual(carteNue.sections[0].lignes[0].details, []);
assert.equal(carteNue.note, "");

/* Une stat absente du catalogue ne doit pas faire tomber la commande. */
const inconnue = resoudreDemandeBuild({
  profils:PROFILS,
  lignes:[{
    owner:"u-1", char_id:"ban", potential_tier:0,
    builds:{ Hache:{
      weapon:"7ds-armes/Hache/Hache de guerre.webp",
      weaponConfig:{ enchantments:[{ slot:0, tier:1, stat:"X_Inconnue", value:7 }] },
      armor:{}, armorConfig:{}, jewel:{}, jewelConfig:{}, note:""
    } }
  }],
  libelles:LIBELLES,
  options:{ joueur:"YanniSs13", personnage:"Ban", arme:"" }
});
assert.equal(inconnue.erreur, undefined, inconnue.erreur);
assert.deepEqual(inconnue.cartes[0].sections[0].lignes[0].details,
  ["Perle commune", "X_Inconnue : 7"],
  "le code brut vaut mieux qu'une ligne disparue");

/* ------------------------------------------------------------------ */
/* Le message qui accompagne les images                                */

const contenu = contenuMessageBuild(tousLesBuilds.cartes);
assert.match(contenu, /YanniSs13/);
assert.match(contenu, /Ban/);
assert.match(contenu, /2 builds/,
  "le lecteur sait combien d'images arrivent");
assert.match(contenuMessageBuild(uneArme.cartes), /Nunchaku/,
  "une seule arme, elle se nomme dans le message");

/* ------------------------------------------------------------------ */
/* Les libelles publies sur Pages                                      */

const libelles = JSON.parse(fs.readFileSync(
  path.join(ROOT, "data", "libelles-discord.json"), "utf8"
));
assert.ok(libelles.personnages.ban, "le catalogue publie doit citer Ban");
assert.equal(libelles.personnages.ban.nom, "Ban");
assert.equal(libelles.personnages.merlin.element, "ICE");
/* Ban n'a pas d'element dans les donnees du jeu : `DEFAULT` est une valeur
   normale, pas un trou. Le module la traduit en « Physique ». */
assert.equal(libelles.personnages.ban.element, "DEFAULT");
const ELEMENTS_CONNUS = new Set([
  "FIRE", "WIND", "DARK", "EARTH", "HOLY", "ICE", "THUNDER", "DEFAULT"
]);
Object.entries(libelles.personnages).forEach(([id, fiche]) => {
  assert.ok(ELEMENTS_CONNUS.has(fiche.element),
    "element inconnu pour " + id + " : " + fiche.element);
  assert.ok(fiche.nom, "nom manquant pour " + id);
});
assert.equal(libelles.personnages.ban.fichier, "7ds-personnages/ban.webp",
  "le portrait vient du catalogue publie, pas d une convention devinee");
assert.ok(libelles.stats.B_Atk, "et les libelles de stats");
assert.equal(libelles.stats.B_Atk.unit, "flat");
assert.ok(Object.keys(libelles.stats).length > 50,
  "les 82 statistiques du catalogue, pas un echantillon");

/* Le controle de fraicheur ne doit pas dependre des fins de ligne. Le depot
   est en CRLF sous Windows et en LF sur le runner Linux : une comparaison de
   texte brut declarait le fichier perime d'un cote et a jour de l'autre. */
const { estAJour, texteDeSortie } = require(path.join(
  ROOT, "scripts", "generer-libelles-discord.js"
));
assert.equal(estAJour(texteDeSortie()), true);
assert.equal(estAJour(texteDeSortie().replace(/\n/g, "\r\n")), true,
  "le meme contenu en CRLF est a jour, pas perime");
assert.equal(estAJour("{}"), false, "un contenu different reste perime");

/* ------------------------------------------------------------------ */
/* Le branchement dans l'Edge Function                                 */

const source = fs.readFileSync(path.join(
  ROOT, "supabase", "functions", "discord-planning", "index.ts"
), "utf8");

/* CHAQUE module partage doit etre importe EXPLICITEMENT par index.ts.
   Les modules de `_shared/` sont universels : ils se chargent mutuellement
   par `require` cote Node, et se lisent sur `globalThis` cote Deno. Or la CLI
   Supabase construit la liste des fichiers a televerser en suivant les
   `import` — elle ne voit aucun `require`. Un module absent de cette liste
   n'est pas deploye, et la fonction tombe a son premier appel.
   C'est arrive a png-decode.js : sept fichiers televerses, celui-la oublie. */
const MODULES_PARTAGES = [
  "availability-font.js",
  "availability-pdf.js",
  "discord-planning.js",
  "boss-reminder.js",
  "png-decode.js",
  "discord-build.js",
  "discord-build-png.js"
];
const positions = MODULES_PARTAGES.map(fichier => {
  const position = source.indexOf('import("../_shared/' + fichier + '")');
  assert.notEqual(position, -1,
    fichier + " n'est pas importé par index.ts : la CLI Supabase ne le"
    + " téléversera pas");
  return { fichier, position };
});
/* L'ordre compte autant que la presence : un module lit l'API du precedent
   sur `globalThis` des son chargement. */
assert.ok(
  positions.find(entree => entree.fichier === "png-decode.js").position
    < positions.find(entree => entree.fichier === "discord-build-png.js").position,
  "png-decode.js doit être importé avant discord-build-png.js, qui lit son API"
);
assert.ok(
  positions.find(entree => entree.fichier === "availability-pdf.js").position
    < positions.find(entree => entree.fichier === "discord-build-png.js").position,
  "availability-pdf.js doit être importé avant discord-build-png.js"
);
[
  /_shared\/discord-build\.js/,
  /build:publishCharacterBuild/,
  /roster_characters\?owner=eq\./,
  /libelles-discord\.json/,
  /resoudreDemandeBuild/,
  /generateBuildCardPng/,
  /* L'autocompletion : interaction de type 4, reponse de type 8. Le choix des
     propositions, lui, vit dans le module partage — l'Edge Function n'apporte
     que les lectures et leur cache. */
  /interaction\.type === 4/,
  /type:8/,
  /propositionsBuild\(/,
  /lireProfils:/,
  /lireRoster:/,
  /lireBuilds:/,
  /* Le roster lu pour l'autocompletion ne demande QUE `char_id` : la colonne
     `builds` est la colonne lourde, et le menu des personnages n'en a pas
     besoin. */
  /select=char_id/
].forEach(motif => assert.match(source, motif,
  "l'Edge Function doit brancher /build : " + motif));

/* L'autocompletion doit passer par le meme controle de serveur, de salon et de
   role que la commande. Proposer la liste des pseudos de la confrerie dans un
   salon non autorise serait une fuite — et Discord ne sait pas afficher
   d'erreur dans un menu de suggestions : on repond une liste vide. */
const blocAutocompletion = source.slice(source.indexOf("interaction.type === 4"));
assert.match(blocAutocompletion.slice(0, 2000), /planningAuthorizationError/,
  "l'autocomplétion doit vérifier les droits avant de proposer des pseudos");

console.log("OK discord-build");
