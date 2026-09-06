"use strict";

/* La carte PNG de /build : une fiche de personnage, dessinee.

   ELLE A SA PROPRE CHARTE, et non celle du planning. Le planning est un
   tableau ; ceci est une fiche de jeu, et la maquette du proprietaire en fixe
   la forme : un cadre file d'or a coins ornementes, un en-tete centre, puis
   trois zones — le portrait a gauche, l'arme au centre, l'equipement a droite.
   Seule la surface de dessin est partagee (`RasterCanvas`, `encodePng`).

   ELLE A SA PROPRE POLICE. `carte-font.js` porte 120 caracteres, minuscules et
   accents compris, la ou l'atlas du planning n'en connait que 45 en capitales.
   C'est pour cela que le texte s'ecrit ici « Dégâts crit. » et non
   « DEGATS CRIT. », et que le trace passe par `atlasTextExact`, qui ne
   transforme rien.

   POURQUOI LE PAYSAGE. Discord fait tenir l'image dans le message, et c'est la
   hauteur qui commande la reduction : une carte haute arrive minuscule.

   LES IMAGES. Les images du site sont en webp, que rien dans ce runtime ne
   decode : `scripts/generer-vignettes.py` en publie une version PNG a la
   taille exacte ou la carte les pose, et le workflow Pages fabrique ce dossier
   au deploiement — il n'est jamais versionne. Leur chargement est INJECTE
   (`options.chargerImage`), ce qui rend le rendu verifiable sans reseau ; une
   vignette introuvable laisse un cadre vide plutot qu'une carte perdue. */

const Buffer = globalThis.Buffer;
if(!Buffer) throw new Error("Buffer indisponible pour la carte de build");
if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_AVAILABILITY_FONT) require("./availability-font.js");
  if(!globalThis.NOVA_AVAILABILITY_PDF) require("./availability-pdf.js");
  if(!globalThis.NOVA_CARTE_FONT) require("./carte-font.js");
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_PNG_DECODE) require("./png-decode.js");
}

const {
  RasterCanvas, encodePng, chargerAtlasCarte, atlasStringWidthExact
} = globalThis.NOVA_AVAILABILITY_PDF;
const { texteCarte } = globalThis.NOVA_DISCORD_BUILD;
const { decodePng } = globalThis.NOVA_PNG_DECODE;

const BASE_VIGNETTES = "https://yanniss13.github.io/NOVA/7ds-vignettes/";

const LARGEUR = 1660;
const MARGE = 30;
const GOUTTIERE = 16;
const COLONNE_GAUCHE = 384;
const COLONNE_MILIEU = 600;
const COLONNE_DROITE = LARGEUR - 2 * MARGE - COLONNE_GAUCHE - COLONNE_MILIEU
  - 2 * GOUTTIERE;
/* ICONE et PORTRAIT doivent rester d'accord avec TAILLE_OBJET et
   TAILLE_PORTRAIT de scripts/generer-vignettes.py : les vignettes sont posees
   pixel pour pixel, sans redimensionnement. */
const ICONE = 80;
const PORTRAIT = 336;
const IDENTITE = 64;

const HAUTEUR_ENTETE = 178;
const HAUTEUR_PIED = 76;
const PADDING = 18;
const HAUTEUR_TITRE_SECTION = 52;
const HAUTEUR_LIGNE = 30;
const HAUTEUR_NOM = 34;
/* Une jauge tient sur deux rangees : le libelle et sa valeur en vis-a-vis,
   puis le trait dessous. Sur une seule il faudrait partager la largeur entre
   trois choses, et aucune colonne n'en a assez. */
const HAUTEUR_JAUGE_TITRE = 30;
const HAUTEUR_JAUGE_TRAIT = 14;
const HAUTEUR_JAUGE = HAUTEUR_JAUGE_TITRE + HAUTEUR_JAUGE_TRAIT;
const ESPACE_BLOC = 16;
const DEBUT_CONTENU_SECTION = 60;
const ESPACE_LIGNE_BIJOU = 4;
const MARGE_BASSE_SECTION = 16;
const MARGE_AVANT_SEPARATEUR = 18;

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

/* Un libelle de jauge partage sa rangee avec sa valeur : il ne peut pas se
   couper en deux lignes, il se raccourcit. */
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

function symboleIdentite(canvas, type, centreX, centreY) {
  if(type === "element"){
    anneau(canvas, centreX, centreY, 27, 2, COULEURS.or, COULEURS.panneau);
    etoile(canvas, centreX, centreY, 18, COULEURS.orVif);
    etoile(canvas, centreX, centreY, 8, COULEURS.panneau);
    return;
  }
  if(type === "arme"){
    /* Une lame verticale, volontairement héraldique plutôt que réaliste. */
    remplirPolygone(canvas, [
      [centreX, centreY - 30], [centreX + 5, centreY - 22],
      [centreX + 3, centreY + 16], [centreX - 3, centreY + 16],
      [centreX - 5, centreY - 22]
    ], COULEURS.or);
    canvas.rectangle(centreX - 15, centreY + 14, 30, 3, COULEURS.orVif);
    canvas.rectangle(centreX - 2, centreY + 17, 4, 16, COULEURS.or);
    losange(canvas, centreX, centreY + 34, 5, COULEURS.orVif);
    return;
  }
  /* Un écu simple pour le rôle. Le panneau intérieur creuse son filet. */
  remplirPolygone(canvas, [
    [centreX - 24, centreY - 27], [centreX + 24, centreY - 27],
    [centreX + 20, centreY + 11], [centreX, centreY + 30],
    [centreX - 20, centreY + 11]
  ], COULEURS.or);
  remplirPolygone(canvas, [
    [centreX - 20, centreY - 22], [centreX + 20, centreY - 22],
    [centreX + 16, centreY + 8], [centreX, centreY + 24],
    [centreX - 16, centreY + 8]
  ], COULEURS.panneau);
  etoile(canvas, centreX, centreY - 1, 13, COULEURS.orVif);
}

/* Les icônes de maîtrise sont blanches sur fond transparent ; les badges de
   rôle ont un fond élémentaire coloré et un glyphe clair. Cette copie teintée
   conserve les vrais contours du jeu tout en les accordant au filet d'or. */
function dessinerImageTeintee(canvas, image, x, y, couleur, seuil) {
  if(!image || !image.pixels) return false;
  let dessines = 0;
  const gauche = Math.round(x);
  const haut = Math.round(y);
  for(let ligne = 0; ligne < image.height; ligne += 1){
    for(let colonne = 0; colonne < image.width; colonne += 1){
      const source = (ligne * image.width + colonne) * 4;
      const alphaSource = image.pixels[source + 3];
      const lumiere = Math.min(image.pixels[source], image.pixels[source + 1],
        image.pixels[source + 2]);
      if(!alphaSource || lumiere < seuil) continue;
      const cibleX = gauche + colonne;
      const cibleY = haut + ligne;
      if(cibleX < 0 || cibleX >= canvas.width
        || cibleY < 0 || cibleY >= canvas.height) continue;
      const cible = (cibleY * canvas.width + cibleX) * 4;
      const ratio = alphaSource / 255 * lumiere / 255;
      for(let canal = 0; canal < 3; canal += 1){
        canvas.pixels[cible + canal] = Math.round(
          couleur[canal] * ratio + canvas.pixels[cible + canal] * (1 - ratio)
        );
      }
      canvas.pixels[cible + 3] = 255;
      dessines += 1;
    }
  }
  return dessines > 0;
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

/* ------------------------------------------------------------------ */
/* Les jauges                                                          */

function dessinerBarre(canvas, x, y, part, largeur) {
  const hauteur = 12;
  canvas.rectangle(x, y, largeur, hauteur, COULEURS.creux);
  const remplie = Math.round((largeur - 2) * Math.max(0, Math.min(1, part)));
  if(remplie > 0) canvas.rectangle(x + 1, y + 1, remplie, hauteur - 2,
    COULEURS.or);
  canvas.outline(x, y, largeur, hauteur, 1, COULEURS.filet);
}

function dessinerEtoiles(canvas, x, y, valeur, total, largeurMaximale) {
  if(!total) return;
  const rayon = Math.min(12, Math.max(5,
    Math.floor(largeurMaximale / total / 2.5)));
  const pas = rayon * 2.5;
  for(let index = 0; index < total; index += 1){
    etoile(canvas, x + rayon + index * pas, y + rayon, rayon,
      index < valeur ? COULEURS.orVif : COULEURS.creux);
  }
}

function dessinerJauge(canvas, jauge, x, y, largeur, fonts) {
  const valeur = texteCarte(jauge.texte);
  const largeurValeur = valeur
    ? atlasStringWidthExact(valeur, fonts.petit) : 0;
  ecrire(canvas, x, y,
    tronquer(jauge.libelle, fonts.petit, largeur - largeurValeur - 18),
    fonts.petit, COULEURS.attenue);
  if(valeur){
    ecrireADroite(canvas, x + largeur, y, valeur, fonts.petit,
      COULEURS.parchemin);
  }
  const bas = y + HAUTEUR_JAUGE_TITRE;
  if(jauge.forme === "etoile"){
    dessinerEtoiles(canvas, x, bas - 4, jauge.valeur, jauge.maximum, largeur);
    return;
  }
  /* Une part inconnue ne dessine aucune barre : une barre remplie au hasard
     mentirait sur la qualite du tirage. La valeur, elle, reste lisible. */
  if(jauge.part === null || jauge.part === undefined) return;
  dessinerBarre(canvas, x, bas, jauge.part, largeur);
}

/* Mesures et enchantements deviennent des jauges de meme forme : le rendu
   n'a plus qu'une rangee a savoir dessiner. */
function jaugesDeLigne(ligne) {
  const mesures = (Array.isArray(ligne.mesures) ? ligne.mesures : [])
    .map(mesure => ({
      libelle:mesure.libelle,
      texte:mesure.maximum
        ? mesure.valeur + " / " + mesure.maximum
        : String(mesure.valeur),
      forme:mesure.forme,
      valeur:mesure.valeur,
      maximum:mesure.maximum,
      part:mesure.maximum ? mesure.valeur / mesure.maximum : null
    }));
  const enchantements = (Array.isArray(ligne.enchantements)
    ? ligne.enchantements : [])
    .map(entree => ({
      libelle:entree.libelle,
      texte:entree.texte,
      forme:"barre",
      part:entree.part
    }));
  return mesures.concat(enchantements);
}

/* ------------------------------------------------------------------ */
/* Le modele de mise en page                                           */

function lignesDe(section) {
  return (section && Array.isArray(section.lignes) ? section.lignes : [])
    .map(ligne => ({
      emplacement:(ligne && ligne.emplacement) || "",
      nom:(ligne && ligne.nom) || "",
      image:(ligne && ligne.image) || "",
      jauges:jaugesDeLigne(ligne || {}),
      details:(ligne && Array.isArray(ligne.details) ? ligne.details : [])
        .filter(detail => typeof detail === "string" && detail)
    }));
}

function sectionParTitre(carte, titre) {
  const sections = carte && Array.isArray(carte.sections) ? carte.sections : [];
  return sections.find(section => section && section.titre === titre) || null;
}

function cheminsImages(carte) {
  const chemins = new Set();
  if(carte && carte.portrait) chemins.add(carte.portrait);
  if(carte && carte.iconeArme) chemins.add(carte.iconeArme);
  if(carte && carte.iconeRoleElement) chemins.add(carte.iconeRoleElement);
  ["Arme", "Armure", "Bijoux"].forEach(titre => {
    lignesDe(sectionParTitre(carte, titre)).forEach(ligne => {
      if(ligne.image) chemins.add(ligne.image);
    });
  });
  return [...chemins];
}

/* Un bloc de la colonne centrale : icone a gauche, nom et jauges a droite. */
function mesurerBloc(ligne, fonts, largeur) {
  const largeurTexteBloc = largeur - ICONE - 20;
  const nom = couperEnLignes(ligne.nom, fonts.corps, largeurTexteBloc);
  const details = ligne.details.flatMap(detail =>
    couperEnLignes(detail, fonts.petit, largeurTexteBloc));
  const texte = HAUTEUR_LIGNE
    + Math.max(1, nom.length) * HAUTEUR_NOM
    + details.length * HAUTEUR_LIGNE
    + ligne.jauges.length * HAUTEUR_JAUGE;
  return Object.assign({}, ligne, {
    nom, details, hauteur:Math.max(ICONE, texte)
  });
}

function mesurer(carte, fonts) {
  const largeurBloc = COLONNE_MILIEU - 2 * PADDING;
  const milieu = lignesDe(sectionParTitre(carte, "Arme"))
    .map(ligne => mesurerBloc(ligne, fonts, largeurBloc));

  /* La grille d'armure : deux colonnes de deux cases, chacune une icone et
     deux lignes de texte. Elle ne porte pas de jauge — c'est ce qui lui permet
     de rester compacte. */
  const largeurCase = (COLONNE_DROITE - 2 * PADDING - 12) / 2;
  const armure = lignesDe(sectionParTitre(carte, "Armure")).map(ligne => ({
    ...ligne,
    /* Deux lignes de nom, pas une : « Bottes de combat de la mélodie
       d'Arachnée » ne tient sur aucune demi-colonne, et le tronquer perdait
       justement ce qui distingue deux pieces d'un meme ensemble. */
    nom:couperEnLignes(ligne.nom, fonts.corps, largeurCase - ICONE - 16)
      .slice(0, 2)
  }));
  const hauteurCase = Math.max(ICONE, 40 + 2 * HAUTEUR_NOM) + 2 * 12;
  const hauteurArmureNaturelle = HAUTEUR_TITRE_SECTION
    + Math.ceil(armure.length / 2) * (hauteurCase + 12) + PADDING;

  /* Le filet qui ouvre l'armure gravee et le bord haut des bijoux sont une
     seule ligne visuelle. Leur coordonnee vient donc d'un repere commun, et
     non de deux additions independantes qui divergeaient selon les jauges. */
  const separateurMilieu = milieu.length > 1
    ? DEBUT_CONTENU_SECTION + milieu[0].hauteur + MARGE_AVANT_SEPARATEUR
    : 0;
  const separateurSections = Math.max(
    hauteurArmureNaturelle + ESPACE_BLOC, separateurMilieu
  );
  const hauteurArmure = separateurSections - ESPACE_BLOC;
  let hauteurMilieu = DEBUT_CONTENU_SECTION;
  milieu.forEach((bloc, rang) => {
    if(rang){
      const ligneY = rang === 1 ? separateurSections : hauteurMilieu - 8;
      hauteurMilieu = ligneY + 16;
    }
    hauteurMilieu += bloc.hauteur + ESPACE_BLOC;
  });
  hauteurMilieu += PADDING;

  const largeurBijou = COLONNE_DROITE - 2 * PADDING - ICONE - 18;
  const bijoux = lignesDe(sectionParTitre(carte, "Bijoux")).map(ligne => {
    /* Le jeu place la stat du bijou dans la même ligne que son identité.
       La première jauge exploite donc les 80 px déjà ouverts par l'icône ;
       seules d'éventuelles jauges supplémentaires agrandissent la ligne. */
    const nom = tronquer(ligne.nom, fonts.corps, largeurBijou);
    const hauteur = Math.max(ICONE,
      HAUTEUR_LIGNE + HAUTEUR_NOM + (ligne.jauges.length ? 16 : 0))
      + Math.max(0, ligne.jauges.length - 1) * HAUTEUR_JAUGE;
    return Object.assign({}, ligne, { nom, hauteur });
  });
  const hauteurBijoux = DEBUT_CONTENU_SECTION
    + bijoux.reduce((total, ligne) => total + ligne.hauteur
      + ESPACE_LIGNE_BIJOU, 0) + MARGE_BASSE_SECTION;

  const gauche = PORTRAIT + 2 * PADDING + 120;
  const corps = Math.max(
    hauteurMilieu, hauteurArmure + ESPACE_BLOC + hauteurBijoux, gauche
  );
  return {
    milieu,
    armure,
    bijoux,
    hauteurMilieu,
    hauteurArmure,
    hauteurBijoux,
    separateurSections,
    hauteurGauche:corps,
    hauteur:Math.round(HAUTEUR_ENTETE + corps + HAUTEUR_PIED)
  };
}

/* ------------------------------------------------------------------ */
/* Le dessin                                                           */

function titreSection(canvas, numero, titre, x, y, largeur, fonts) {
  const ecart = 16;
  const largeurNumero = largeurTexte(numero, fonts.section);
  const largeurTitre = largeurTexte(titre, fonts.section);
  const largeurGroupe = largeurNumero + ecart + largeurTitre;
  const debut = x + (largeur - largeurGroupe) / 2;
  const margeFilet = 18;
  const gaucheFin = debut - margeFilet;
  const droiteDebut = debut + largeurGroupe + margeFilet;
  if(gaucheFin - x > 18) canvas.rectangle(x, y + 20, gaucheFin - x, 1,
    COULEURS.filet);
  if(x + largeur - droiteDebut > 18){
    canvas.rectangle(droiteDebut, y + 20, x + largeur - droiteDebut, 1,
      COULEURS.filet);
  }
  ecrire(canvas, debut, y, numero, fonts.section, COULEURS.or);
  ecrire(canvas, debut + largeurNumero + ecart, y, titre, fonts.section,
    COULEURS.parchemin);
  losange(canvas, x + largeur / 2, y + 43, 4, COULEURS.or);
}

function dessinerEntete(canvas, carte, fonts, images) {
  const centre = LARGEUR / 2;
  ecrireCentre(canvas, centre, 26, "7DS Origin", fonts.petit, COULEURS.or);
  const largeurSurtitre = largeurTexte("7DS Origin", fonts.petit);
  losange(canvas, centre - largeurSurtitre / 2 - 22, 36, 5, COULEURS.or);
  losange(canvas, centre + largeurSurtitre / 2 + 22, 36, 5, COULEURS.or);
  canvas.rectangle(centre - largeurSurtitre / 2 - 120, 36, 90, 1,
    COULEURS.filet);
  canvas.rectangle(centre + largeurSurtitre / 2 + 30, 36, 90, 1,
    COULEURS.filet);

  ecrireCentre(canvas, centre, 56,
    (carte && carte.personnage) || "Personnage", fonts.titre,
    COULEURS.parchemin);

  const details = [
    carte && carte.element,
    carte && carte.role,
    carte && carte.potentiel ? "Potentiel " + carte.potentiel : ""
  ].filter(Boolean).join("  ·  ");
  ecrireCentre(canvas, centre, 138, details, fonts.petit, COULEURS.attenue);
  void images;
}

function dessinerColonneGauche(canvas, carte, x, y, hauteur, fonts, images) {
  cadre(canvas, x, y, COLONNE_GAUCHE, hauteur);
  const centre = x + COLONNE_GAUCHE / 2;
  const portraitX = Math.round(centre - PORTRAIT / 2);
  const portraitY = y + 30;
  canvas.outline(portraitX - 7, portraitY - 7, PORTRAIT + 14, PORTRAIT + 14,
    1, COULEURS.filet);
  canvas.rectangle(portraitX, portraitY, PORTRAIT, PORTRAIT, COULEURS.creux);
  const portrait = carte && images.get(carte.portrait);
  if(portrait) canvas.drawImage(portrait, portraitX, portraitY);
  canvas.outline(portraitX, portraitY, PORTRAIT, PORTRAIT, 1, COULEURS.filet);

  const basPortrait = portraitY + PORTRAIT + 28;
  const largeurPortraitLabel = largeurTexte("Portrait", fonts.petit);
  const debutLabel = centre - largeurPortraitLabel / 2;
  canvas.rectangle(x + PADDING, basPortrait,
    debutLabel - 14 - (x + PADDING), 1, COULEURS.filet);
  canvas.rectangle(debutLabel + largeurPortraitLabel + 14, basPortrait,
    x + COLONNE_GAUCHE - PADDING
      - (debutLabel + largeurPortraitLabel + 14), 1, COULEURS.filet);
  losange(canvas, debutLabel - 7, basPortrait, 4, COULEURS.or);
  losange(canvas, debutLabel + largeurPortraitLabel + 7, basPortrait, 4,
    COULEURS.or);
  ecrireCentre(canvas, centre, basPortrait - 14, "Portrait", fonts.petit,
    COULEURS.parchemin);

  /* Trois cases sous le portrait, comme la maquette : ce qui identifie le
     personnage avant meme son equipement. */
  const cases = [
    ["element", "Élément", (carte && carte.element) || "—"],
    ["arme", "Arme", (carte && carte.arme) || "—"],
    ["role", "Rôle", (carte && carte.role) || "—"]
  ];
  const largeurCase = (COLONNE_GAUCHE - 2 * PADDING) / cases.length;
  cases.forEach((entree, rang) => {
    const gauche = x + PADDING + rang * largeurCase;
    if(rang){
      canvas.rectangle(gauche, basPortrait + 30, 1, 126, COULEURS.filet);
    }
    const milieu = gauche + largeurCase / 2;
    const hautIcone = basPortrait + 66 - IDENTITE / 2;
    let iconeDessinee = false;
    if(entree[0] === "element" && carte && carte.iconeRoleElement){
      const icone = images.get(carte.iconeRoleElement);
      if(icone){
        canvas.drawImage(icone, milieu - IDENTITE / 2, hautIcone);
        iconeDessinee = true;
      }
    }else if(entree[0] === "arme" && carte && carte.iconeArme){
      iconeDessinee = dessinerImageTeintee(canvas, images.get(carte.iconeArme),
        milieu - IDENTITE / 2, hautIcone, COULEURS.orVif, 1);
    }else if(entree[0] === "role" && carte && carte.iconeRoleElement){
      iconeDessinee = dessinerImageTeintee(canvas,
        images.get(carte.iconeRoleElement), milieu - IDENTITE / 2, hautIcone,
        COULEURS.orVif, 170);
    }
    if(!iconeDessinee) symboleIdentite(canvas, entree[0], milieu,
      basPortrait + 66);
    const morceaux = couperEnLignes(entree[2], fonts.petit, largeurCase - 14)
      .slice(0, 2);
    morceaux.forEach((morceau, ligne) => {
      ecrireCentre(canvas, milieu, basPortrait + 103 + ligne * 26, morceau,
        fonts.petit, COULEURS.parchemin);
    });
    ecrireCentre(canvas, milieu, basPortrait + 158, entree[1], fonts.petit,
      COULEURS.faible);
  });
}

function dessinerIcone(canvas, image, x, y) {
  canvas.rectangle(x, y, ICONE, ICONE, COULEURS.creux);
  if(image) canvas.drawImage(image, x, y);
  canvas.outline(x, y, ICONE, ICONE, 1, COULEURS.filet);
}

function dessinerBloc(canvas, bloc, x, y, largeur, fonts, images) {
  dessinerIcone(canvas, images.get(bloc.image), x, y);
  const texteX = x + ICONE + 20;
  const largeurTexteBloc = largeur - ICONE - 20;
  let curseur = y;
  ecrire(canvas, texteX, curseur, bloc.emplacement, fonts.petit,
    COULEURS.faible);
  curseur += HAUTEUR_LIGNE;
  if(!bloc.nom.length){
    ecrire(canvas, texteX, curseur, "Aucun", fonts.corps, COULEURS.faible);
    return;
  }
  bloc.nom.forEach(morceau => {
    ecrire(canvas, texteX, curseur, morceau, fonts.corps, COULEURS.parchemin);
    curseur += HAUTEUR_NOM;
  });
  bloc.details.forEach(detail => {
    ecrire(canvas, texteX, curseur, detail, fonts.petit, COULEURS.attenue);
    curseur += HAUTEUR_LIGNE;
  });
  bloc.jauges.forEach(jauge => {
    dessinerJauge(canvas, jauge, texteX, curseur, largeurTexteBloc, fonts);
    curseur += HAUTEUR_JAUGE;
  });
}

function dessinerGrilleArmure(canvas, lignes, x, y, hauteur, fonts, images) {
  cadre(canvas, x, y, COLONNE_DROITE, hauteur);
  titreSection(canvas, "02", "Armure", x + PADDING, y + PADDING,
    COLONNE_DROITE - 2 * PADDING, fonts);
  const largeurCase = (COLONNE_DROITE - 2 * PADDING - 12) / 2;
  const hauteurCase = Math.max(ICONE, 40 + 2 * HAUTEUR_NOM) + 24;
  lignes.forEach((ligne, rang) => {
    const gauche = x + PADDING + (rang % 2) * (largeurCase + 12);
    const haut = y + PADDING + HAUTEUR_TITRE_SECTION
      + Math.floor(rang / 2) * (hauteurCase + 12);
    dessinerIcone(canvas, images.get(ligne.image), gauche, haut + 12);
    const texteX = gauche + ICONE + 16;
    ecrire(canvas, texteX, haut + 12, ligne.emplacement, fonts.petit,
      COULEURS.faible);
    let curseur = haut + 44;
    if(!ligne.nom.length){
      ecrire(canvas, texteX, curseur, "Aucun", fonts.corps, COULEURS.faible);
      return;
    }
    ligne.nom.forEach(morceau => {
      ecrire(canvas, texteX, curseur, morceau, fonts.corps, COULEURS.parchemin);
      curseur += HAUTEUR_NOM;
    });
  });
}

function dessinerBijoux(canvas, lignes, x, y, hauteur, fonts, images) {
  cadre(canvas, x, y, COLONNE_DROITE, hauteur);
  titreSection(canvas, "03", "Bijoux", x + PADDING, y + PADDING,
    COLONNE_DROITE - 2 * PADDING, fonts);
  let curseur = y + DEBUT_CONTENU_SECTION;
  const largeur = COLONNE_DROITE - 2 * PADDING;
  lignes.forEach(ligne => {
    const gauche = x + PADDING;
    dessinerIcone(canvas, images.get(ligne.image), gauche, curseur);
    const texteX = gauche + ICONE + 18;
    const droite = gauche + largeur;
    const largeurTexteBloc = droite - texteX;
    ecrire(canvas, texteX, curseur, ligne.emplacement, fonts.petit,
      COULEURS.faible);
    if(ligne.jauges.length){
      const premiere = ligne.jauges[0];
      const valeur = texteCarte(premiere.texte);
      const largeurValeur = largeurTexte(valeur, fonts.petit);
      const largeurResume = largeurTexteBloc * 0.58;
      const libelle = tronquer(premiere.libelle, fonts.petit,
        largeurResume - largeurValeur - 12);
      ecrireADroite(canvas, droite, curseur, valeur, fonts.petit,
        COULEURS.parchemin);
      ecrireADroite(canvas, droite - largeurValeur - 12, curseur, libelle,
        fonts.petit, COULEURS.attenue);
    }
    ecrire(canvas, texteX, curseur + HAUTEUR_LIGNE,
      ligne.nom || "Aucun", fonts.corps,
      ligne.nom ? COULEURS.parchemin : COULEURS.faible);
    if(ligne.jauges.length){
      const premiere = ligne.jauges[0];
      if(premiere.part !== null && premiere.part !== undefined){
        dessinerBarre(canvas, texteX, curseur + 68, premiere.part,
          largeurTexteBloc);
      }
      ligne.jauges.slice(1).forEach((jauge, rang) => {
        dessinerJauge(canvas, jauge, texteX,
          curseur + ICONE + rang * HAUTEUR_JAUGE, largeurTexteBloc, fonts);
      });
    }
    curseur += ligne.hauteur + ESPACE_LIGNE_BIJOU;
  });
}

/* ------------------------------------------------------------------ */
/* Les vignettes                                                       */

const cacheVignettes = new Map();

function urlVignette(chemin) {
  return BASE_VIGNETTES + String(chemin)
    .replace(/\.webp$/i, ".png")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

async function chargerVignette(chemin) {
  if(cacheVignettes.has(chemin)) return cacheVignettes.get(chemin);
  let image = null;
  try {
    const reponse = await fetch(urlVignette(chemin));
    if(reponse.ok){
      image = await decodePng(Buffer.from(await reponse.arrayBuffer()));
    }else{
      console.error("Vignette " + chemin + " -> " + reponse.status);
    }
  } catch (erreur) {
    console.error("Vignette illisible : " + chemin, erreur);
  }
  cacheVignettes.set(chemin, image);
  return image;
}

async function chargerImages(carte, charger) {
  const images = new Map();
  await Promise.all(cheminsImages(carte).map(async chemin => {
    try {
      const image = await charger(chemin);
      if(image) images.set(chemin, image);
    } catch (erreur) {
      console.error("Image ignorée : " + chemin, erreur);
    }
  }));
  return images;
}

/* ------------------------------------------------------------------ */

async function generateBuildCardPng(carte, options) {
  const charger = (options && options.chargerImage) || chargerVignette;
  const [fonts, images] = await Promise.all([
    chargerAtlasCarte(),
    chargerImages(carte, charger)
  ]);
  const plan = mesurer(carte, fonts);
  const canvas = new RasterCanvas(LARGEUR, plan.hauteur, COULEURS.fond);

  /* Le cadre exterieur : un double filet et quatre equerres, comme la
     maquette. */
  canvas.outline(14, 14, LARGEUR - 28, plan.hauteur - 28, 1, COULEURS.filet);
  canvas.outline(20, 20, LARGEUR - 40, plan.hauteur - 40, 1, COULEURS.filet);
  losange(canvas, LARGEUR / 2, 20, 9, COULEURS.or);
  losange(canvas, LARGEUR / 2, 20, 4, COULEURS.fond);
  equerre(canvas, 30, 30, 1, 1, 34, COULEURS.or);
  equerre(canvas, LARGEUR - 30, 30, -1, 1, 34, COULEURS.or);
  equerre(canvas, 30, plan.hauteur - 30, 1, -1, 34, COULEURS.or);
  equerre(canvas, LARGEUR - 30, plan.hauteur - 30, -1, -1, 34, COULEURS.or);

  dessinerEntete(canvas, carte, fonts, images);
  const hautCorps = HAUTEUR_ENTETE;
  dessinerColonneGauche(canvas, carte, MARGE, hautCorps, plan.hauteurGauche,
    fonts, images);

  const milieuX = MARGE + COLONNE_GAUCHE + GOUTTIERE;
  cadre(canvas, milieuX, hautCorps, COLONNE_MILIEU, plan.hauteurGauche);
  titreSection(canvas, "01", "Arme", milieuX + PADDING, hautCorps + PADDING,
    COLONNE_MILIEU - 2 * PADDING, fonts);
  let curseur = hautCorps + DEBUT_CONTENU_SECTION;
  plan.milieu.forEach((bloc, rang) => {
    if(rang){
      const ligneY = rang === 1
        ? hautCorps + plan.separateurSections
        : curseur - 8;
      filetOrne(canvas, milieuX + PADDING, ligneY,
        COLONNE_MILIEU - 2 * PADDING, COULEURS.filet);
      curseur = ligneY + 16;
    }
    dessinerBloc(canvas, bloc, milieuX + PADDING, curseur,
      COLONNE_MILIEU - 2 * PADDING, fonts, images);
    curseur += bloc.hauteur + ESPACE_BLOC;
  });

  const droiteX = milieuX + COLONNE_MILIEU + GOUTTIERE;
  dessinerGrilleArmure(canvas, plan.armure, droiteX, hautCorps,
    plan.hauteurArmure, fonts, images);
  dessinerBijoux(canvas, plan.bijoux, droiteX,
    hautCorps + plan.separateurSections, plan.hauteurBijoux,
    fonts, images);

  /* Le pied vit A L'INTERIEUR du double filet, et non dessus : dessine a la
     marge, il passait sur les equerres de coin et sortait par le bas. */
  const pied = plan.hauteur - HAUTEUR_PIED + 10;
  filetOrne(canvas, MARGE + 14, pied - 12, LARGEUR - 2 * MARGE - 28,
    COULEURS.filet);
  const signature = "NOVA · " + ((carte && carte.joueur) || "Confrérie 7DS");
  ecrire(canvas, MARGE + 22, pied, signature, fonts.petit,
    COULEURS.faible);
  const note = carte && carte.note
    ? tronquer(carte.note, fonts.petit, COLONNE_MILIEU + 200) : "";
  if(note) ecrireCentre(canvas, LARGEUR / 2, pied, note, fonts.petit,
    COULEURS.attenue);
  ecrireADroite(canvas, LARGEUR - MARGE - 22, pied,
    (carte && carte.arme) || "", fonts.petit, COULEURS.faible);
  return await encodePng(canvas);
}

const discordBuildPngApi = {
  generateBuildCardPng,
  largeurTexte,
  tronquer,
  mesurer,
  urlVignette,
  MESURES:{
    LARGEUR,
    MARGE,
    GOUTTIERE,
    COLONNE_GAUCHE,
    COLONNE_MILIEU,
    COLONNE_DROITE,
    ICONE,
    PORTRAIT,
    IDENTITE,
    PADDING,
    HAUTEUR_JAUGE,
    HAUTEUR_JAUGE_TITRE,
    ESPACE_BLOC,
    DEBUT_CONTENU_SECTION,
    ESPACE_LIGNE_BIJOU,
    HAUTEUR_ENTETE,
    HAUTEUR_PIED,
    /* Deux nuances : l'or vif des etoiles acquises, l'or sourd des barres
       remplies. Les tests comptent l'une ou l'autre selon ce qu'ils eprouvent. */
    OR:COULEURS.orVif.slice(0, 3),
    OR_BARRE:COULEURS.or.slice(0, 3)
  }
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordBuildPngApi;
}
globalThis.NOVA_DISCORD_BUILD_PNG = discordBuildPngApi;
