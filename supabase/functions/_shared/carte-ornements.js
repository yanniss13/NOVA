"use strict";

/* LA CHARTE DES CARTES DISCORD : obsidienne, filets d'or, equerres de coin.

   Elle est nee avec la fiche `/build`, sur la maquette du proprietaire. Le
   planning la reprend : ce sont deux images du meme serveur, dans le meme fil,
   et deux chartes voisines mais differentes se remarquent plus qu'une seule.

   CE QUI EST ICI est le decor et le texte — ce qui ne sait rien de ce qu'il
   entoure. La MISE EN PAGE reste privee a chaque commande : une fiche de
   personnage et une grille de 168 heures n'ont aucun agencement en commun, et
   les melanger obligerait chaque changement de l'une a relire l'autre.

   Le texte passe par `atlasTextExact`, qui ne transforme rien : c'est ce qui
   permet d'ecrire « Créneaux » et non « CRENEAUX ». */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_AVAILABILITY_FONT) require("./availability-font.js");
  if(!globalThis.NOVA_AVAILABILITY_PDF) require("./availability-pdf.js");
  if(!globalThis.NOVA_CARTE_FONT) require("./carte-font.js");
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
}

const { atlasStringWidthExact } = globalThis.NOVA_AVAILABILITY_PDF;
const { texteCarte } = globalThis.NOVA_DISCORD_BUILD;

const COULEURS = {
  fond:[13, 12, 28, 255],
  panneau:[21, 19, 42, 255],
  creux:[28, 25, 52, 255],
  filet:[122, 97, 57, 255],
  or:[201, 166, 100, 255],
  orVif:[233, 199, 129, 255],
  parchemin:[237, 231, 216, 255],
  attenue:[158, 150, 178, 255],
  faible:[112, 106, 138, 255]
};

/* ------------------------------------------------------------------ */
/* Le texte                                                            */

function largeurTexte(valeur, atlas) {
  return atlasStringWidthExact(texteCarte(valeur), atlas);
}

function ecrire(canvas, x, y, valeur, atlas, couleur) {
  const texte = texteCarte(valeur);
  canvas.atlasTextExact(x, y, texte, atlas, couleur);
  return atlasStringWidthExact(texte, atlas);
}

function ecrireCentre(canvas, centre, y, valeur, atlas, couleur) {
  return ecrire(canvas, centre - largeurTexte(valeur, atlas) / 2, y, valeur,
    atlas, couleur);
}

function ecrireADroite(canvas, droite, y, valeur, atlas, couleur) {
  return ecrire(canvas, droite - largeurTexte(valeur, atlas), y, valeur, atlas,
    couleur);
}

/* Un nom d'objet peut depasser sa colonne. On coupe aux espaces, jamais au
   milieu d'un mot. */
function couperEnLignes(valeur, atlas, largeurMaximale) {
  const mots = texteCarte(valeur).split(" ").filter(Boolean);
  if(!mots.length) return [];
  const lignes = [];
  let courante = "";
  mots.forEach(mot => {
    const essai = courante ? courante + " " + mot : mot;
    if(courante && atlasStringWidthExact(essai, atlas) > largeurMaximale){
      lignes.push(courante);
      courante = mot;
    }else{
      courante = essai;
    }
  });
  if(courante) lignes.push(courante);
  return lignes;
}

/* Un libelle qui partage sa rangee avec une valeur ne peut pas se couper en
   deux lignes : il se raccourcit, et le dit. */
function tronquer(valeur, atlas, largeurMaximale) {
  const texte = texteCarte(valeur);
  if(atlasStringWidthExact(texte, atlas) <= largeurMaximale) return texte;
  const suite = "…";
  const place = largeurMaximale - atlasStringWidthExact(suite, atlas);
  if(place <= 0) return "";
  let coupe = texte;
  while(coupe && atlasStringWidthExact(coupe, atlas) > place){
    coupe = coupe.slice(0, -1);
  }
  return coupe.replace(/[ .]+$/, "") + suite;
}

/* Couper en lignes puis jeter le reste ferait passer « Bottes de combat de la
   mélodie d'Arachnée » pour « Bottes de combat de la » : un nom plausible, et
   faux — il designe un autre ensemble. La derniere ligne autorisee porte donc
   tout ce qui reste, raccourci avec sa marque de coupe. Ce qui distingue deux
   pieces d'un meme ensemble se trouve a la fin du nom, jamais au debut. */
function couperEnLignesLimite(valeur, atlas, largeurMaximale, nombreLignes) {
  const lignes = couperEnLignes(valeur, atlas, largeurMaximale);
  if(lignes.length <= nombreLignes) return lignes;
  return lignes.slice(0, nombreLignes - 1).concat(
    tronquer(lignes.slice(nombreLignes - 1).join(" "), atlas, largeurMaximale)
  );
}

/* ------------------------------------------------------------------ */
/* Les ornements                                                       */

function remplirPolygone(canvas, sommets, couleur) {
  const hauts = sommets.map(point => point[1]);
  const debut = Math.floor(Math.min.apply(null, hauts));
  const fin = Math.ceil(Math.max.apply(null, hauts));
  for(let y = debut; y < fin; y += 1){
    const milieu = y + 0.5;
    const croisements = [];
    for(let index = 0; index < sommets.length; index += 1){
      const [x1, y1] = sommets[index];
      const [x2, y2] = sommets[(index + 1) % sommets.length];
      if((y1 <= milieu && y2 > milieu) || (y2 <= milieu && y1 > milieu)){
        croisements.push(x1 + (milieu - y1) / (y2 - y1) * (x2 - x1));
      }
    }
    croisements.sort((gauche, droite) => gauche - droite);
    for(let paire = 0; paire + 1 < croisements.length; paire += 2){
      canvas.rectangle(croisements[paire], y,
        croisements[paire + 1] - croisements[paire], 1, couleur);
    }
  }
}

function losange(canvas, centreX, centreY, rayon, couleur) {
  remplirPolygone(canvas, [
    [centreX, centreY - rayon],
    [centreX + rayon, centreY],
    [centreX, centreY + rayon],
    [centreX - rayon, centreY]
  ], couleur);
}

function etoile(canvas, centreX, centreY, rayon, couleur) {
  const sommets = [];
  for(let branche = 0; branche < 10; branche += 1){
    /* On part du sommet haut : une etoile posee de travers se remarque. */
    const angle = -Math.PI / 2 + branche * Math.PI / 5;
    const distance = branche % 2 === 0 ? rayon : rayon * 0.42;
    sommets.push([
      centreX + Math.cos(angle) * distance,
      centreY + Math.sin(angle) * distance
    ]);
  }
  remplirPolygone(canvas, sommets, couleur);
}

function anneau(canvas, centreX, centreY, rayon, epaisseur, couleur, fond) {
  canvas.circle(centreX, centreY, rayon, couleur);
  canvas.circle(centreX, centreY, Math.max(1, rayon - epaisseur), fond);
}

/* La rose des vents des bandeaux de la maquette : quatre pointes longues,
   quatre courtes. */
function rose(canvas, centreX, centreY, rayon, couleur) {
  const branches = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  branches.forEach(([dx, dy]) => {
    remplirPolygone(canvas, [
      [centreX + dx * rayon, centreY + dy * rayon],
      [centreX + dy * rayon * 0.22, centreY - dx * rayon * 0.22],
      [centreX - dy * rayon * 0.22, centreY + dx * rayon * 0.22]
    ], couleur);
  });
  const oblique = rayon * 0.42;
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dx, dy]) => {
    losange(canvas, centreX + dx * oblique * 0.7, centreY + dy * oblique * 0.7,
      Math.max(2, rayon * 0.12), couleur);
  });
}

/* Les equerres de coin de la maquette. Deux traits et un losange suffisent a
   en donner l'idee ; les entrelacs fins de l'image d'origine demanderaient un
   dessin vectoriel que ce rendu n'a pas. */
function equerre(canvas, x, y, sensX, sensY, taille, couleur) {
  canvas.rectangle(sensX > 0 ? x : x - taille, y, taille, 1, couleur);
  canvas.rectangle(x, sensY > 0 ? y : y - taille, 1, taille, couleur);
  losange(canvas, x + sensX * 10, y + sensY * 10, 4, couleur);
}

function cadre(canvas, x, y, largeur, hauteur, fond) {
  canvas.rectangle(x, y, largeur, hauteur, fond || COULEURS.panneau);
  canvas.outline(x, y, largeur, hauteur, 1, COULEURS.filet);
}

/* Un filet horizontal coupe d'un losange, comme les separations de la
   maquette. */
function filetOrne(canvas, x, y, largeur, couleur) {
  const centre = x + largeur / 2;
  canvas.rectangle(x, y, largeur / 2 - 12, 1, couleur);
  canvas.rectangle(centre + 12, y, largeur / 2 - 12, 1, couleur);
  losange(canvas, centre, y, 5, couleur);
}

/* LE CADRE EXTERIEUR, commun a toutes les cartes : un double filet, un losange
   creuse en haut et en bas, quatre equerres. C'est lui qu'on reconnait d'un
   coup d'oeil dans le fil Discord, avant meme d'avoir lu le titre. */
function cadreExterieur(canvas, largeur, hauteur) {
  canvas.outline(14, 14, largeur - 28, hauteur - 28, 1, COULEURS.filet);
  canvas.outline(20, 20, largeur - 40, hauteur - 40, 1, COULEURS.filet);
  [20, hauteur - 20].forEach(y => {
    losange(canvas, largeur / 2, y, 9, COULEURS.or);
    losange(canvas, largeur / 2, y, 4, COULEURS.fond);
  });
  equerre(canvas, 30, 30, 1, 1, 34, COULEURS.or);
  equerre(canvas, largeur - 30, 30, -1, 1, 34, COULEURS.or);
  equerre(canvas, 30, hauteur - 30, 1, -1, 34, COULEURS.or);
  equerre(canvas, largeur - 30, hauteur - 30, -1, -1, 34, COULEURS.or);
}

/* L'EMBLEME DE LA CONFRERIE, en haut a gauche des deux images du planning :
   le sept dans son anneau, le nom, la devise. */
function embleme(canvas, x, y, fonts) {
  const centre = x + 46;
  const milieu = y + 46;
  anneau(canvas, centre, milieu, 44, 2, COULEURS.or, COULEURS.fond);
  anneau(canvas, centre, milieu, 37, 1, COULEURS.filet, COULEURS.fond);
  ecrireCentre(canvas, centre, milieu - 30, "7", fonts.titre, COULEURS.orVif);
  [[-44, 0], [44, 0]].forEach(([dx]) => {
    losange(canvas, centre + dx, milieu, 5, COULEURS.or);
  });

  const texte = x + 106;
  ecrire(canvas, texte, y + 8, "Confrérie 7DS", fonts.section,
    COULEURS.parchemin);
  ecrire(canvas, texte, y + 52, "Team builder  ·  Boss de guilde", fonts.petit,
    COULEURS.attenue);
  const largeurDevise = largeurTexte("Team builder  ·  Boss de guilde",
    fonts.petit);
  filetOrne(canvas, texte, y + 84, largeurDevise, COULEURS.filet);
}

const carteOrnementsApi = {
  COULEURS,
  largeurTexte,
  ecrire,
  ecrireCentre,
  ecrireADroite,
  couperEnLignes,
  tronquer,
  couperEnLignesLimite,
  remplirPolygone,
  losange,
  etoile,
  anneau,
  rose,
  equerre,
  cadre,
  filetOrne,
  cadreExterieur,
  embleme
};

globalThis.NOVA_CARTE_ORNEMENTS = carteOrnementsApi;
if(typeof module !== "undefined" && module.exports){
  module.exports = carteOrnementsApi;
}
