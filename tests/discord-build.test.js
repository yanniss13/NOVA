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
  "Niveau 50 · promotion 4 · dépassement 2",
  "Perle légendaire",
  "Taux critique : 12.5 %"
], "la valeur en dix-millièmes redevient un pourcentage");

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
  /generateBuildCardPng/
].forEach(motif => assert.match(source, motif,
  "l'Edge Function doit brancher /build : " + motif));

console.log("OK discord-build");
