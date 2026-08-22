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
const { detecterPanneau, extraireStats } = hooks;
assert.equal(typeof detecterPanneau, "function",
  "detecterPanneau doit etre expose par js/metier/ocr-panneau.js");
assert.equal(typeof extraireStats, "function",
  "extraireStats doit etre expose par js/metier/ocr-panneau.js");

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

const mot = (text, x0, x1, y) => ({ text, bbox:{ x0, x1, y0:y, y1:y + 18 } });

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
  [{ libelle:"Augmentation des dégâts, compétence normale", valeur:"10.80%" }]
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
  [{ libelle:"Efficacité des dégâts sur la durée", valeur:"29.30%" }]
);

/* Un titre de section n'a pas de valeur et ne doit pas polluer le libelle
   suivant. */
assert.deepEqual(
  plain(extraireStats([
    mot("Bonus", 100, 150, 10), mot("de", 156, 176, 10),
    mot("gravure", 182, 240, 10),
    mot("Chances", 100, 170, 40), mot("crit.", 176, 210, 40),
    mot("4.50%", 700, 780, 70)
  ])),
  [{ libelle:"Chances crit.", valeur:"4.50%" }]
);

/* Plusieurs stats a la suite, chacune sur une seule ligne. */
assert.deepEqual(
  plain(extraireStats([
    mot("PV", 100, 130, 10), mot("de", 136, 156, 10),
    mot("l'équipement", 162, 260, 10), mot("21678", 700, 780, 10),
    mot("Défense", 100, 170, 50), mot("de", 176, 196, 50),
    mot("l'équipement", 202, 300, 50), mot("7759", 700, 780, 50)
  ])),
  [
    { libelle:"PV de l'équipement", valeur:"21678" },
    { libelle:"Défense de l'équipement", valeur:"7759" }
  ]
);

/* Entrees degenerees : ne rien rendre, ne pas lever. */
assert.deepEqual(plain(extraireStats([])), []);
assert.deepEqual(plain(extraireStats(null)), []);

console.log("ocr-panneau : OK");
