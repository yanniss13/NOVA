"use strict";

/* La lecture d'un panneau par un modele distant.

   Ce test ne verifie PAS que le modele lit bien — ca, seule une capture reelle
   le dira. Il verifie ce qui se passe quand il lit MAL, parce que c'est la
   seule chose qui puisse abimer un roster.

   Le principe : tout ce qui n'est pas exploitable doit etre REJETE ici, avant
   d'atteindre la deduction. Une ligne sans chiffre, un libelle vide, une
   valeur avec du texte parasite : la deduction les prendrait au serieux et
   chercherait une piece capable de les porter.

   La distinction section / hors-section est traitee a part parce qu'elle est
   la plus lourde de consequences : une ligne au-dessus du premier titre est
   une statistique NATIVE, une ligne sous un titre est un ENCHANTEMENT. Les
   confondre rend la capture inexploitable. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { normaliserLecture, lectureAssisteeDisponible } = hooks;
assert.equal(typeof normaliserLecture, "function", "hook manquant");
assert.equal(typeof lectureAssisteeDisponible, "function", "hook manquant");

/* La capture de reference : la baguette du proprietaire, telle que le panneau
   l'affiche. Une ligne native au-dessus, quatre enchantements sous
   « Enchanter ». */
const LUE = plain(normaliserLecture({
  nom:"Baguette des ailes de la flamme noire",
  niveau:50,
  passif:7,
  stats:[
    { libelle:"Dégâts crit.", valeur:"48.82%", section:null },
    { libelle:"Augmentation des dégâts de Foudre", valeur:"16.80%",
      section:"Enchanter" },
    { libelle:"Dégâts crit.", valeur:"16.81%", section:"Enchanter" },
    { libelle:"Augmentation des dégâts, compétence normale", valeur:"20.45%",
      section:"Enchanter" },
    { libelle:"Augmentation des dégâts, compétence de relève", valeur:"27.22%",
      section:"Enchanter" }
  ]
}));

assert.equal(LUE.statut, "ok");
assert.equal(LUE.entete.nom, "Baguette des ailes de la flamme noire");
assert.equal(LUE.entete.niveau, 50);
assert.equal(LUE.passif, 7);
assert.equal(LUE.stats.length, 5);

/* LA GARDE PRINCIPALE : une seule ligne native, quatre en section. */
const natives = LUE.stats.filter(ligne => ligne.section === null);
assert.equal(natives.length, 1,
  "une seule ligne doit rester hors section : la statistique native");
assert.equal(natives[0].valeur, "48.82%",
  "la valeur native doit rester intacte, au centieme pres");
assert.equal(LUE.stats.filter(ligne => ligne.section === "Enchanter").length, 4,
  "les quatre enchantements doivent garder leur section");

/* SECONDE CAPTURE REELLE, et la plus instructive : la hache du proprietaire.
   Sa statistique principale s'affiche « 3 425 », separateur de milliers
   compris. La premiere version de ce module la refusait — sa regle etait plus
   stricte que celle de Tesseract — et l'arme perdait son attaque, donc toute
   chance d'etre reconnue. Ce cas ne doit plus jamais passer inapercu. */
const HACHE = plain(normaliserLecture({
  nom:"Hache flamboyante",
  niveau:50,
  passif:7,
  stats:[
    { libelle:"Attaque de l'équipement", valeur:"3 425", section:null },
    { libelle:"Perforation", valeur:"82", section:null },
    { libelle:"Attaque de l'équipement", valeur:"832", section:"Enchanter" },
    { libelle:"PV de l'équipement", valeur:"1427", section:"Enchanter" }
  ]
}));
assert.equal(HACHE.statut, "ok");
assert.equal(HACHE.stats.length, 4,
  "les quatre lignes doivent survivre, separateur de milliers compris");
assert.equal(HACHE.stats[0].valeur, "3 425",
  "la valeur reste BRUTE : c'est valeurNumerique, en aval, qui la convertit");
assert.equal(
  HACHE.stats.filter(ligne => ligne.section === null).length, 2,
  "cette arme porte DEUX statistiques natives, pas une"
);

/* Les trois espaces que le jeu emploie comme separateur de milliers : espace
   ordinaire, insecable, insecable fine. Elles sont ECHAPPEES a dessein : trois caracteres invisibles cote a cote seraient irrelisibles, et une correction maladroite les remplacerait par des espaces ordinaires sans que personne ne s'en apercoive. */
for(const espace of [" ", "\u00a0", "\u202f"]){
  const resultat = plain(normaliserLecture({
    nom:"X",
    stats:[{ libelle:"Attaque", valeur:"3" + espace + "425", section:null }]
  }));
  assert.equal(resultat.stats.length, 1,
    "separateur de milliers refuse : " + JSON.stringify(espace));
}

/* Une section vide vaut « hors section ». Le modele peut rendre l'un ou
   l'autre, le reste du site n'attend que `null`. */
const videEgaleNul = plain(normaliserLecture({
  nom:"X", stats:[{ libelle:"Dégâts crit.", valeur:"10%", section:"" }]
}));
assert.equal(videEgaleNul.stats[0].section, null,
  "une section vide doit devenir null, pas rester une chaine");

/* CE QUI DOIT ETRE JETE. Chaque cas ci-dessous est une ligne qu'un modele peut
   produire et que la deduction ne saurait pas interpreter. */
const rejets = [
  { libelle:"", valeur:"10%" },
  { libelle:"Dégâts crit.", valeur:"" },
  { libelle:"Dégâts crit.", valeur:"environ 10%" },
  { libelle:"Dégâts crit.", valeur:"10 - 20%" },
  { libelle:"Dégâts crit.", valeur:null },
  { libelle:"Dégâts crit." },
  null,
  "Dégâts crit. 10%"
];
for(const ligne of rejets){
  const resultat = plain(normaliserLecture({
    nom:"X",
    stats:[ligne, { libelle:"Chances crit.", valeur:"5%", section:null }]
  }));
  assert.equal(resultat.stats.length, 1,
    "ligne inexploitable acceptee : " + JSON.stringify(ligne));
}

/* Sans aucune ligne exploitable, la lecture ne vaut rien : elle doit le dire
   pour que l'appelant retombe sur Tesseract au lieu de deduire dans le vide. */
assert.equal(plain(normaliserLecture({ nom:"X", stats:[] })).statut,
  "aucune-stat-lue");
assert.equal(plain(normaliserLecture(null)).statut, "lecture-illisible");
assert.equal(plain(normaliserLecture("bonjour")).statut, "lecture-illisible");
assert.equal(
  plain(normaliserLecture({ nom:"X", stats:[{ libelle:"a", valeur:"x" }] })).statut,
  "aucune-stat-lue",
  "une seule ligne, illisible : rien a exploiter"
);

/* Un niveau ecrit en toutes lettres, ou absent, ne doit pas devenir un nombre
   invente : `deduireArme` filtre sur ce niveau, une valeur fausse ecarterait
   la bonne configuration. */
const niveaux = [
  [50, 50], ["50", 50], [null, null], ["cinquante", null],
  [50.5, null], [undefined, null]
];
for(const [brut, attendu] of niveaux){
  const resultat = plain(normaliserLecture({
    nom:"X", niveau:brut,
    stats:[{ libelle:"Dégâts crit.", valeur:"10%", section:null }]
  }));
  assert.equal(resultat.entete.niveau, attendu,
    "niveau mal normalise pour " + JSON.stringify(brut));
}

/* LA DISPONIBILITE. La lecture assistee ne doit JAMAIS etre tentee hors ligne
   ni sans compte : dans les deux cas l'appel echouerait, et le membre
   attendrait pour rien avant le repli. */
assert.equal(lectureAssisteeDisponible({
  client:{}, connecte:true, enLigne:true
}), true, "connecte et en ligne : la lecture assistee est possible");
assert.equal(lectureAssisteeDisponible({
  client:{}, connecte:true, enLigne:false
}), false, "hors ligne : Tesseract, et lui seul");
assert.equal(lectureAssisteeDisponible({
  client:{}, connecte:false, enLigne:true
}), false, "sans compte : la fonction Edge refuserait");
assert.equal(lectureAssisteeDisponible({
  client:null, connecte:true, enLigne:true
}), false, "sans client Supabase : personne a appeler");
assert.equal(lectureAssisteeDisponible(null), false,
  "un etat absent ne doit pas ouvrir la voie");

console.log("lecture-assistee.test.js OK (" + (LUE.stats.length + HACHE.stats.length)
  + " lignes lues, " + natives.length + " native, "
  + rejets.length + " formes rejetees)");
