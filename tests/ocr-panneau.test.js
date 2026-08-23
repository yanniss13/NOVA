"use strict";

/* La geometrie du panneau de statistiques du jeu, isolee du navigateur.

   Aucune coordonnee n'est codee en dur : le panneau se detecte par sa zone
   claire collee au bord droit, et les colonnes se deduisent de son contenu.
   C'est ce qui permet a la meme lecture de fonctionner en 1920x1080 et en
   2796x1290 — deux resolutions et deux rapports d'image differents — sans le
   moindre reglage. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { detecterPanneau, detecterEntete, extraireStats, lireEntete,
  niveauDePassif } = hooks;
assert.equal(typeof detecterPanneau, "function",
  "detecterPanneau doit etre expose par js/metier/ocr-panneau.js");
assert.equal(typeof extraireStats, "function",
  "extraireStats doit etre expose par js/metier/ocr-panneau.js");
assert.equal(typeof detecterEntete, "function",
  "detecterEntete doit etre expose par js/metier/ocr-panneau.js");
assert.equal(typeof lireEntete, "function",
  "lireEntete doit etre expose par js/metier/ocr-panneau.js");
assert.equal(typeof niveauDePassif, "function",
  "niveauDePassif doit etre expose par js/metier/ocr-panneau.js");

/* Une image sombre avec un rectangle clair colle au bord droit. */
const zone = plain(detecterPanneau({
  largeur:1000, hauteur:800,
  estClair:(x, y) => x >= 700 && y >= 100 && y <= 600
}));
assert.ok(zone, "le panneau doit etre trouve");
assert.ok(Math.abs(zone.left - 700) <= 4, "bord gauche du panneau");
assert.ok(Math.abs(zone.top - 100) <= 4, "bord haut du panneau");

/* Une image entierement sombre n'a pas de panneau : on rend null plutot que
   d'inventer un rectangle que l'OCR lira pour rien. */
assert.equal(detecterPanneau({
  largeur:400, hauteur:300, estClair:() => false
}), null);

/* L'en-tete est la partie de la carte que la detection du panneau laisse
   dehors : le cadre dore n'atteint pas le seuil de « clair ». Il appartient
   pourtant a la carte, et c'est la que vit le nom de la piece — la seule chose
   qui identifie une arme. */
const entete = plain(detecterEntete({
  estCarte:(x, y) => x >= 700 && y >= 20 && y <= 600
}, { left:700, top:100, width:300, height:500 }));
assert.ok(entete, "l'en-tete doit etre trouve");
assert.ok(Math.abs(entete.top - 20) <= 4, "bord haut de l'en-tete");
assert.equal(entete.left, 700, "l'en-tete reprend la colonne du panneau");
assert.equal(entete.height, 100 - entete.top, "l'en-tete s'arrete au panneau");

/* Une bande de separation sombre au milieu de l'en-tete ne le termine pas. */
const coupe = plain(detecterEntete({
  estCarte:(x, y) => x >= 700 && y >= 20 && y <= 600 && !(y >= 60 && y <= 62)
}, { left:700, top:100, width:300, height:500 }));
assert.ok(Math.abs(coupe.top - 20) <= 4,
  "quelques rangs sombres ne doivent pas couper l'en-tete");

/* Rien au-dessus du panneau : on rend null plutot qu'un rectangle vide. */
assert.equal(detecterEntete({
  estCarte:(x, y) => y >= 100
}, { left:700, top:100, width:300, height:500 }), null);

const mot = (text, x0, x1, y) => ({ text, bbox:{ x0, x1, y0:y, y1:y + 18 } });

/* Une arme affiche `Lv.50`, une armure jamais. Le meme motif sert donc de
   discriminant entre les deux familles ET de source pour le niveau. */
const enteteArme = plain(lireEntete([
  mot("5j", 100, 120, 5), mot("®", 300, 315, 5),
  mot("Baguette", 100, 190, 40), mot("des", 196, 230, 40),
  mot("ailes", 236, 280, 40), mot("de", 286, 306, 40),
  mot("la", 312, 328, 40), mot("flamme", 334, 400, 40),
  mot("noire", 406, 460, 40),
  mot("Baguette", 100, 190, 80), mot("Lv.50", 400, 460, 80)
]));
assert.equal(enteteArme.nom, "Baguette des ailes de la flamme noire");
assert.equal(enteteArme.type, "Baguette");
assert.equal(enteteArme.niveau, 50);

const enteteArmure = plain(lireEntete([
  mot("Haut", 100, 150, 40), mot("du", 156, 176, 40),
  mot("souverain", 182, 270, 40), mot("cupide", 276, 330, 40),
  mot("Haut", 100, 150, 80), mot("+5", 400, 430, 80)
]));
assert.equal(enteteArmure.nom, "Haut du souverain cupide");
assert.equal(enteteArmure.niveau, null,
  "une armure n'affiche pas de niveau `Lv.` : c'est ce qui la distingue");

/* Le niveau de passif vaut le depassement plus un. Il est facultatif : mal lu,
   il vaut null et l'inversion se debrouille sans. */
assert.equal(niveauDePassif("ga Niv. 7 Énergie de la flamme noire"), 7);
assert.equal(niveauDePassif("| Niv. 1 Faille croissante"), 1);
assert.equal(niveauDePassif("Attaque de l'équipement 4731"), null);
assert.equal(niveauDePassif(null), null);

/* Disposition 1 — la valeur est sur la PREMIERE ligne du libelle, et le libelle
   continue en dessous. Fermer le bloc des la valeur vue perdrait « competence
   normale » : c'est le bug qui produisait un decalage en cascade, et le seul
   qui ait fabrique une valeur fausse et silencieuse. */
assert.deepEqual(
  plain(extraireStats([
    mot("Augmentation", 100, 220, 10), mot("des", 226, 250, 10),
    mot("dégâts,", 256, 320, 10), mot("10.80%", 700, 780, 10),
    mot("compétence", 100, 200, 40), mot("normale", 206, 270, 40)
  ])),
  [{ libelle:"Augmentation des dégâts, compétence normale",
    valeur:"10.80%", section:null }]
);

/* Disposition 2 — la valeur arrive APRES une barre de progression, sous le
   libelle. La bouillie que la barre laisse a l'OCR (« Le », « —e », « ESS »)
   ne fait jamais plus de trois lettres, la ou un vrai mot en fait davantage. */
assert.deepEqual(
  plain(extraireStats([
    mot("Efficacité", 100, 190, 10), mot("des", 196, 220, 10),
    mot("dégâts", 226, 280, 10), mot("sur", 286, 310, 10),
    mot("la", 316, 330, 10),
    mot("durée", 100, 150, 40),
    mot("—e", 300, 320, 70), mot("29.30%", 700, 780, 70)
  ])),
  [{ libelle:"Efficacité des dégâts sur la durée",
    valeur:"29.30%", section:null }]
);

/* La bordure superieure du panneau laisse des debris que l'ancien decompte
   global de lettres laissait passer : « Le V4 LS » en compte cinq. Ils se
   collaient alors au libelle suivant, et le principal d'une arme ressortait
   en « Le V4 LS X Attaque de l'équipement ». Un fragment qui OUVRE un libelle
   doit desormais porter un mot d'au moins quatre lettres. */
assert.deepEqual(
  plain(extraireStats([
    mot("Le", 100, 120, 10), mot("V4", 126, 146, 10), mot("LS", 152, 172, 10),
    mot("X", 100, 112, 40), mot("Attaque", 118, 190, 40),
    mot("de", 196, 216, 40), mot("l'équipement", 222, 320, 40),
    mot("4731", 700, 780, 40)
  ])),
  [{ libelle:"X Attaque de l'équipement", valeur:"4731", section:null }]
);

/* Un titre de section n'a pas de valeur et ne doit pas polluer le libelle
   suivant. Il marque en revanche les lignes qui le suivent : sans quoi les
   enchantements passeraient pour des statistiques natives, et l'inversion
   chercherait une piece capable de les porter toutes. */
assert.deepEqual(
  plain(extraireStats([
    mot("Bonus", 100, 150, 10), mot("de", 156, 176, 10),
    mot("gravure", 182, 240, 10),
    mot("Chances", 100, 170, 40), mot("crit.", 176, 210, 40),
    mot("4.50%", 700, 780, 70)
  ])),
  [{ libelle:"Chances crit.", valeur:"4.50%", section:"bonus de gravure" }]
);

/* Plusieurs stats a la suite, chacune sur une seule ligne, puis une section. */
assert.deepEqual(
  plain(extraireStats([
    mot("PV", 100, 130, 10), mot("de", 136, 156, 10),
    mot("l'équipement", 162, 260, 10), mot("21678", 700, 780, 10),
    mot("Défense", 100, 170, 50), mot("de", 176, 196, 50),
    mot("l'équipement", 202, 300, 50), mot("7759", 700, 780, 50),
    mot("Enchanter", 100, 200, 90),
    mot("Dégâts", 100, 160, 130), mot("crit.", 166, 200, 130),
    mot("16.81%", 700, 780, 130)
  ])),
  [
    { libelle:"PV de l'équipement", valeur:"21678", section:null },
    { libelle:"Défense de l'équipement", valeur:"7759", section:null },
    { libelle:"Dégâts crit.", valeur:"16.81%", section:"enchanter" }
  ]
);

/* Entrees degenerees : ne rien rendre, ne pas lever. */
assert.deepEqual(plain(extraireStats([])), []);
assert.deepEqual(plain(extraireStats(null)), []);
assert.deepEqual(plain(lireEntete(null)), { nom:"", type:"", niveau:null });

console.log("ocr-panneau : OK");
