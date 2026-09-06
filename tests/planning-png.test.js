"use strict";

/* Les deux images de /planning. On ne compare pas des pixels un a un : on
   verifie que le PNG est un PNG, qu'il reste en paysage, que les 168 heures y
   sont toutes, que la chaleur se dessine, et surtout qu'aucune des deux ne
   confond « ce membre n'a rien coche » avec « ce membre n'a jamais repondu ». */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const partage = nom => path.join(
  ROOT, "supabase", "functions", "_shared", nom
);
require(partage("availability-font.js"));
const {
  RasterCanvas, chargerAtlasCarte, buildAvailabilityReport
} = require(partage("availability-pdf.js"));
require(partage("carte-font.js"));
const { texteCarte } = require(partage("discord-build.js"));
require(partage("carte-ornements.js"));
const {
  generatePlanningTablePng, generatePlanningMembersPng, joursDeMembre,
  libelleHeuresMembre, MESURES
} = require(partage("planning-png.js"));
const { decodePng } = require(partage("png-decode.js"));

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function dimensions(png) {
  assert.ok(png.subarray(0, 8).equals(SIGNATURE), "signature PNG absente");
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  return { largeur:png.readUInt32BE(16), hauteur:png.readUInt32BE(20) };
}

/* Le nuancier de la legende porte lui aussi la couleur pleine : compter toute
   l'image ferait passer une grille vide pour une grille remplie. On ne compte
   donc que DANS la grille. */
function comptePixels(png, couleur, zone) {
  return decodePng(png).then(image => {
    const gauche = zone ? zone.x : 0;
    const haut = zone ? zone.y : 0;
    const droite = zone ? zone.x + zone.largeur : image.width;
    const bas = zone ? zone.y + zone.hauteur : image.height;
    let total = 0;
    for(let y = haut; y < bas; y += 1){
      for(let x = gauche; x < droite; x += 1){
        const index = (y * image.width + x) * 4;
        if(image.pixels[index] === couleur[0]
          && image.pixels[index + 1] === couleur[1]
          && image.pixels[index + 2] === couleur[2]) total += 1;
      }
    }
    return total;
  });
}

const ZONE_GRILLE = {
  x:MESURES.MARGE + MESURES.COLONNE_HEURE,
  y:MESURES.HAUTEUR_ENTETE + MESURES.HAUTEUR_BANDE + 16
    + MESURES.HAUTEUR_TETE_GRILLE,
  largeur:MESURES.LARGEUR - 2 * MESURES.MARGE - MESURES.COLONNE_HEURE,
  hauteur:24 * MESURES.HAUTEUR_RANGEE
};

/* Un masque lisible : les heures citees sont a « 1 », le reste a « 0 ». */
function masque(plages) {
  const cases = new Array(168).fill("0");
  plages.forEach(([jour, debut, fin]) => {
    for(let heure = debut; heure < fin; heure += 1) cases[jour * 24 + heure] = "1";
  });
  return cases.join("");
}

const PROFILS = [
  { id:"u-1", pseudo:"YanniSs13" },
  { id:"u-2", pseudo:"Élodie" },
  { id:"u-3", pseudo:"Bastien" },
  { id:"u-4", pseudo:"Zoé" }
];
/* Trois cas qui doivent se distinguer a l'oeil : des creneaux, une declaration
   vide, et aucune declaration du tout. */
const LIGNES = [
  { owner:"u-1", slots:masque([[0, 20, 24], [0, 14, 16], [4, 19, 23]]) },
  { owner:"u-2", slots:masque([[0, 20, 24]]) },
  { owner:"u-3", slots:masque([]) }
];
const REPORT = buildAvailabilityReport(PROFILS, LIGNES, "2026-09-07");

(async () => {
  const fonts = await chargerAtlasCarte();
  assert.equal(typeof RasterCanvas, "function");

  /* Le rapport doit bien porter les trois cas, sinon le test ne prouve rien. */
  const parPseudo = nom => REPORT.members.find(membre => membre.pseudo === nom);
  assert.equal(parPseudo("YanniSs13").hours, 10);
  assert.equal(parPseudo("Bastien").declared, true,
    "Bastien a repondu, en ne cochant rien");
  assert.equal(parPseudo("Bastien").hours, 0);
  assert.equal(parPseudo("Zoé").declared, false,
    "Zoé n'a jamais rempli sa ligne");

  /* CE QUI EST DIT ET CE QUI EST TU. Une declaration vide et une absence de
     declaration donnent toutes deux zero heure ; les afficher pareil ferait
     lire « Zoé n'est jamais disponible » alors que personne n'en sait rien. */
  assert.equal(libelleHeuresMembre(parPseudo("YanniSs13")), "10 h");
  assert.equal(libelleHeuresMembre(parPseudo("Bastien")), "0 h",
    "une declaration vide est une reponse : elle se compte en heures");
  assert.equal(libelleHeuresMembre(parPseudo("Zoé")), "non renseigné",
    "une absence de declaration se dit, elle ne se compte pas");

  /* SEPT BANDES DE VINGT-QUATRE HEURES, une par jour. La liste de plages
     — « 11h-12h / 14h-15h / 16h-17h / 19h-24h » — etait exacte et illisible :
     sept lignes de chiffres par membre, douze membres par image. Une bande se
     lit d'un coup d'oeil, et deux membres se comparent sans compter.

     Sept jours, toujours : un jour absent de la liste se lirait « je n'ai pas
     regarde » alors qu'il veut dire « rien ce jour-la ». */
  const jours = joursDeMembre(parPseudo("YanniSs13"));
  assert.equal(jours.length, 7);
  assert.deepEqual(jours.map(jour => jour.court),
    ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]);
  assert.equal(jours[0].heures.length, 24, "une bande porte les 24 heures");
  assert.deepEqual(
    jours[0].heures.map((libre, heure) => libre ? heure : null)
      .filter(heure => heure !== null),
    [14, 15, 20, 21, 22, 23],
    "la bande du lundi doit allumer exactement les heures declarees");
  assert.equal(jours[0].vide, false);
  assert.equal(jours[1].vide, true, "un mardi sans creneau reste une bande vide");
  assert.ok(jours[1].heures.every(libre => !libre));

  /* Le tiret demi-cadratin ne figure pas dans l'atlas : sans traduction, une
     plage d'heures se lisait « 14h 16h ». */
  assert.equal(texteCarte("14h–16h"), "14h-16h");

  /* LES DEUX IMAGES SONT EN PAYSAGE. Discord fait tenir l'image dans le
     message : c'est la hauteur qui commande la reduction. */
  const grille = await generatePlanningTablePng(REPORT);
  const tailleGrille = dimensions(grille);
  assert.equal(tailleGrille.largeur, MESURES.LARGEUR);
  assert.ok(tailleGrille.hauteur < tailleGrille.largeur,
    "la grille doit rester plus large que haute : " + tailleGrille.largeur
    + " x " + tailleGrille.hauteur);
  /* Les 24 heures tiennent dans la grille, en entier. */
  assert.equal(tailleGrille.hauteur, MESURES.HAUTEUR_ENTETE + MESURES.HAUTEUR_BANDE
    + 16 + MESURES.HAUTEUR_TETE_GRILLE + 24 * MESURES.HAUTEUR_RANGEE + 16
    + MESURES.HAUTEUR_BANDE + MESURES.HAUTEUR_PIED);

  /* La chaleur se dessine : l'heure la plus frequentee porte l'or plein. */
  const orPlein = await comptePixels(grille, MESURES.CHALEUR_HAUTE, ZONE_GRILLE);
  assert.ok(orPlein > 400,
    "le creneau le plus suivi doit remplir sa case : " + orPlein + " pixels");
  const vide = buildAvailabilityReport(PROFILS, [], "2026-09-07");
  assert.equal(await comptePixels(await generatePlanningTablePng(vide),
    MESURES.CHALEUR_HAUTE, ZONE_GRILLE), 0,
    "sans aucun creneau declare, aucune case ne doit s'allumer");

  const membres = await generatePlanningMembersPng(REPORT);
  const tailleMembres = dimensions(membres);
  assert.equal(tailleMembres.largeur, MESURES.LARGEUR);
  /* CHAQUE HEURE DECLAREE SE VOIT. La surface allumee doit valoir le total des
     heures de la confrerie : une bande qui oublierait des heures, ou en
     inventerait, se verrait ici avant de se voir dans le salon. */
  const heuresDeclarees = REPORT.members.reduce(
    (total, membre) => total + membre.hours, 0);
  assert.equal(heuresDeclarees, 14);
  /* Le nuancier de la legende porte la meme couleur : on ne compte que la zone
     des cartes, sinon une bande vide passerait pour une bande remplie. */
  const zoneCartes = {
    x:MESURES.MARGE,
    y:MESURES.HAUTEUR_ENTETE,
    largeur:MESURES.LARGEUR - 2 * MESURES.MARGE,
    hauteur:2 * MESURES.HAUTEUR_CARTE_MEMBRE + 18
  };
  const allumees = await comptePixels(membres, MESURES.CHALEUR_HAUTE,
    zoneCartes);
  const attendu = heuresDeclarees * MESURES.CELLULE_LARGEUR
    * MESURES.CELLULE_HAUTEUR;
  assert.ok(Math.abs(allumees - attendu)
    <= heuresDeclarees * MESURES.CELLULE_HAUTEUR,
    "surface allumee " + allumees + " pour " + Math.round(attendu) + " attendus");

  /* Quatre membres tiennent sur deux rangees de trois. */
  assert.equal(tailleMembres.hauteur, MESURES.HAUTEUR_ENTETE
    + 2 * MESURES.HAUTEUR_CARTE_MEMBRE + 18 + 16
    + MESURES.HAUTEUR_BANDE + MESURES.HAUTEUR_PIED);

  /* Une confrerie vide ne doit pas faire tomber le rendu — elle arrive le jour
     ou la table des profils est vide, pas seulement en test. */
  dimensions(await generatePlanningMembersPng(
    buildAvailabilityReport([], [], "2026-09-07")));
  dimensions(await generatePlanningTablePng(
    buildAvailabilityReport([], [], "2026-09-07")));

  console.log("OK planning-png");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
