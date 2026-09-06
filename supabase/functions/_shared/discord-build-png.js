"use strict";

/* La carte PNG de /build.

   Elle reprend la charte du planning — bandeau dore, panneaux violets, les
   trois polices NOVA — et sa surface de dessin : `RasterCanvas`, les atlas et
   l'encodeur sortent de availability-pdf.js. Seule la MISE EN PAGE vit ici.

   LES IMAGES. Le portrait du personnage et l'icone de chaque piece sont
   dessines sur la carte. Les images du site sont en webp, que rien dans ce
   runtime ne decode : `scripts/generer-vignettes.py` en publie une version
   PNG a la taille exacte ou la carte les pose, et le workflow Pages fabrique
   ce dossier au deploiement — il n'est jamais versionne.

   Le chargement des images est INJECTE (`options.chargerImage`). Le rendu
   reste ainsi verifiable sans reseau, et une vignette introuvable ne prive
   personne de sa carte : l'emplacement se dessine sans image.

   LE TEXTE. L'atlas ne connait que « ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
   -/:.()|=? ». Tout texte passe donc par `texteCarte`, qui met en capitales,
   retire les accents et traduit ce qui ne se dessine pas. Le « % » fait
   exception : `dessinerPourcent` le trace au rectangle et au disque, a une
   taille deduite de la police — sans lui, chaque pourcentage serait un « ? ». */

const Buffer = globalThis.Buffer;
if(!Buffer) throw new Error("Buffer indisponible pour la carte de build");
if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_AVAILABILITY_FONT) require("./availability-font.js");
  if(!globalThis.NOVA_AVAILABILITY_PDF) require("./availability-pdf.js");
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_PNG_DECODE) require("./png-decode.js");
}

const {
  RasterCanvas, encodePng, availabilityFonts, atlasStringWidth
} = globalThis.NOVA_AVAILABILITY_PDF;
const { texteCarte } = globalThis.NOVA_DISCORD_BUILD;
const { decodePng } = globalThis.NOVA_PNG_DECODE;

const BASE_VIGNETTES = "https://yanniss13.github.io/NOVA/7ds-vignettes/";

const LARGEUR = 1000;
const MARGE = 44;
/* ICONE et PORTRAIT doivent rester d'accord avec TAILLE_OBJET et
   TAILLE_PORTRAIT de scripts/generer-vignettes.py : les vignettes sont posees
   pixel pour pixel, sans redimensionnement. */
const ICONE = 72;
const PORTRAIT = 144;
const PADDING_PANNEAU = 14;
const COLONNE_TEXTE = MARGE + PADDING_PANNEAU + ICONE + 18;
const HAUTEUR_ENTETE = 208;
const HAUTEUR_TITRE_SECTION = 46;
const HAUTEUR_ETIQUETTE = 28;
const HAUTEUR_NOM = 34;
const HAUTEUR_DETAIL = 28;
const ESPACE_PANNEAU = 8;
const ESPACE_SECTION = 24;
const INDENT_DETAIL = 16;
const HAUTEUR_PIED = 62;

const COULEURS = {
  fond:[12, 9, 18, 255],
  entete:[22, 14, 31, 255],
  panneau:[27, 20, 36, 255],
  panneauVide:[20, 15, 27, 255],
  cadreIcone:[39, 29, 50, 255],
  bordure:[91, 70, 101, 255],
  or:[239, 190, 67, 255],
  orSombre:[145, 91, 29, 255],
  parchemin:[248, 241, 222, 255],
  attenue:[184, 169, 191, 255],
  faible:[122, 108, 132, 255]
};

/* Le « % » n'est pas dans l'atlas, et la barre « / » de la police est trop
   etroite pour porter deux disques lisibles. On le trace donc entierement, a
   une taille deduite de la hauteur de cellule : il grandit avec la police. */
function metriquesPourcent(atlas) {
  const hauteur = Math.round(atlas.cellHeight * 0.60);
  return {
    hauteur,
    largeur:Math.round(hauteur * 0.82),
    rayon:Math.max(3, Math.round(hauteur * 0.18)),
    epaisseur:Math.max(2, Math.round(hauteur * 0.10)),
    /* Les glyphes de l'atlas ne commencent pas au sommet de leur cellule :
       ce decalage aligne le pourcentage sur la hauteur des capitales. */
    dessus:Math.round(atlas.cellHeight * 0.13),
    ecart:Math.max(2, Math.round(hauteur * 0.14))
  };
}

function largeurPourcent(atlas) {
  const metriques = metriquesPourcent(atlas);
  return metriques.largeur + metriques.ecart;
}

function dessinerPourcent(canvas, x, y, atlas, couleur) {
  const { hauteur, largeur, rayon, epaisseur, dessus } = metriquesPourcent(atlas);
  const haut = y + dessus;
  for(let pas = 0; pas < hauteur; pas += 1){
    const avance = (pas * (largeur - epaisseur)) / (hauteur - 1);
    canvas.rectangle(x + largeur - epaisseur - avance, haut + pas,
      epaisseur, 1, couleur);
  }
  canvas.circle(x + rayon, haut + rayon, rayon, couleur);
  canvas.circle(x + largeur - rayon, haut + hauteur - rayon, rayon, couleur);
  return largeurPourcent(atlas);
}

function largeurTexte(valeur, atlas) {
  return String(valeur).split("%").reduce((total, morceau, index) =>
    total + atlasStringWidth(morceau, atlas)
      + (index ? largeurPourcent(atlas) : 0),
  0);
}

function dessinerTexte(canvas, x, y, valeur, atlas, couleur) {
  let curseur = x;
  String(valeur).split("%").forEach((morceau, index) => {
    if(index) curseur += dessinerPourcent(canvas, curseur, y, atlas, couleur);
    canvas.atlasText(curseur, y, morceau, atlas, couleur);
    curseur += atlasStringWidth(morceau, atlas);
  });
  return curseur - x;
}

/* Un nom d'objet peut depasser sa colonne. On coupe aux espaces, jamais au
   milieu d'un mot : « HACHE DE GUERRE » sur deux lignes reste lisible,
   « HACHE DE GUER / RE » ne l'est plus. */
function couperEnLignes(valeur, atlas, largeurMaximale) {
  const mots = texteCarte(valeur).split(" ").filter(Boolean);
  if(!mots.length) return [];
  const lignes = [];
  let courante = "";
  mots.forEach(mot => {
    const essai = courante ? courante + " " + mot : mot;
    if(courante && largeurTexte(essai, atlas) > largeurMaximale){
      lignes.push(courante);
      courante = mot;
    }else{
      courante = essai;
    }
  });
  if(courante) lignes.push(courante);
  return lignes;
}

function sectionsDe(carte) {
  const sections = carte && Array.isArray(carte.sections) ? carte.sections : [];
  return sections.map(section => ({
    titre:(section && section.titre) || "",
    lignes:(section && Array.isArray(section.lignes) ? section.lignes : [])
      .map(ligne => ({
        emplacement:(ligne && ligne.emplacement) || "",
        nom:(ligne && ligne.nom) || "",
        image:(ligne && ligne.image) || "",
        details:(ligne && Array.isArray(ligne.details) ? ligne.details : [])
          .filter(detail => typeof detail === "string" && detail)
      }))
  }));
}

/* Toutes les images que la carte affichera, sans doublon : deux emplacements
   peuvent porter la meme piece. */
function cheminsImages(carte) {
  const chemins = new Set();
  if(carte && carte.portrait) chemins.add(carte.portrait);
  sectionsDe(carte).forEach(section => {
    section.lignes.forEach(ligne => {
      if(ligne.image) chemins.add(ligne.image);
    });
  });
  return [...chemins];
}

/* Mesure d'abord, dessin ensuite : la hauteur du PNG depend de ce qu'il y a
   dedans, et une surface ne se redimensionne pas apres coup. */
function mesurer(carte, fonts) {
  const largeurTexteMaximale = LARGEUR - MARGE - PADDING_PANNEAU - COLONNE_TEXTE;
  const sections = sectionsDe(carte).map(section => {
    const lignes = section.lignes.map(ligne => {
      const nom = couperEnLignes(ligne.nom, fonts.body, largeurTexteMaximale);
      /* Les details sont dessines en retrait du nom : ils se coupent donc sur
         une largeur reduite d'autant, sinon la derniere ligne sort du panneau
         sans que rien ne le signale. */
      const details = ligne.details.flatMap(detail =>
        couperEnLignes(detail, fonts.body, largeurTexteMaximale - INDENT_DETAIL));
      const texte = HAUTEUR_ETIQUETTE
        + Math.max(1, nom.length) * HAUTEUR_NOM
        + details.length * HAUTEUR_DETAIL;
      /* Jamais plus court que l'icone : elle deborderait sur le panneau
         suivant. */
      const hauteur = 2 * PADDING_PANNEAU + Math.max(ICONE, texte);
      return Object.assign({}, ligne, { nom, details, hauteur });
    });
    const hauteur = HAUTEUR_TITRE_SECTION
      + lignes.reduce((total, ligne) => total + ligne.hauteur + ESPACE_PANNEAU, 0);
    return Object.assign({}, section, { lignes, hauteur });
  });

  const note = couperEnLignes(
    carte && carte.note, fonts.body, LARGEUR - 2 * MARGE - 2 * PADDING_PANNEAU
  );
  const hauteurNote = note.length
    ? ESPACE_SECTION + 2 * PADDING_PANNEAU + HAUTEUR_TITRE_SECTION
      + note.length * HAUTEUR_DETAIL
    : 0;

  const hauteur = HAUTEUR_ENTETE
    + sections.reduce((total, section) => total + section.hauteur + ESPACE_SECTION, 0)
    + hauteurNote + HAUTEUR_PIED;
  return { sections, note, hauteur:Math.round(hauteur) };
}

function dessinerEntete(canvas, carte, fonts, images) {
  canvas.rectangle(0, 0, LARGEUR, HAUTEUR_ENTETE, COULEURS.entete);
  canvas.rectangle(0, 0, LARGEUR, 8, COULEURS.or);
  canvas.rectangle(0, HAUTEUR_ENTETE - 1, LARGEUR, 1, COULEURS.bordure);

  const portrait = carte && images.get(carte.portrait);
  canvas.rectangle(MARGE, 36, PORTRAIT, PORTRAIT, COULEURS.cadreIcone);
  if(portrait) canvas.drawImage(portrait, MARGE, 36);
  canvas.outline(MARGE, 36, PORTRAIT, PORTRAIT, 2, COULEURS.orSombre);

  const gauche = MARGE + PORTRAIT + 28;
  dessinerTexte(canvas, gauche, 44,
    texteCarte((carte && carte.personnage) || "Personnage"),
    fonts.display, COULEURS.parchemin);

  const details = [
    carte && carte.element,
    carte && carte.potentiel ? "Potentiel " + carte.potentiel : "",
    carte && carte.joueur ? "Roster de " + carte.joueur : ""
  ].filter(Boolean).map(morceau => texteCarte(morceau)).join(" | ");
  dessinerTexte(canvas, gauche, 118, details, fonts.body, COULEURS.attenue);

  /* Le type d'arme est l'information qui distingue deux cartes du meme
     personnage : il se lit sans chercher, sous le nom. */
  const arme = texteCarte((carte && carte.arme) || "");
  if(arme){
    const largeur = largeurTexte(arme, fonts.brand);
    canvas.rectangle(gauche, 152, largeur + 36, 48, COULEURS.orSombre);
    canvas.outline(gauche, 152, largeur + 36, 48, 2, COULEURS.or);
    dessinerTexte(canvas, gauche + 18, 158, arme, fonts.brand,
      COULEURS.parchemin);
  }
}

function dessinerLigne(canvas, ligne, y, fonts, images) {
  const vide = !ligne.nom.length;
  canvas.rectangle(MARGE, y, LARGEUR - 2 * MARGE, ligne.hauteur,
    vide ? COULEURS.panneauVide : COULEURS.panneau);
  canvas.rectangle(MARGE, y, 4, ligne.hauteur,
    vide ? COULEURS.bordure : COULEURS.or);

  const iconeX = MARGE + PADDING_PANNEAU;
  const iconeY = y + PADDING_PANNEAU;
  canvas.rectangle(iconeX, iconeY, ICONE, ICONE, COULEURS.cadreIcone);
  const image = images.get(ligne.image);
  if(image) canvas.drawImage(image, iconeX, iconeY);
  canvas.outline(iconeX, iconeY, ICONE, ICONE, 1, COULEURS.bordure);

  let curseur = y + PADDING_PANNEAU;
  dessinerTexte(canvas, COLONNE_TEXTE, curseur, texteCarte(ligne.emplacement),
    fonts.body, COULEURS.faible);
  curseur += HAUTEUR_ETIQUETTE;
  if(vide){
    dessinerTexte(canvas, COLONNE_TEXTE, curseur + 2, "AUCUN", fonts.body,
      COULEURS.faible);
    return;
  }
  ligne.nom.forEach(morceau => {
    dessinerTexte(canvas, COLONNE_TEXTE, curseur + 2, morceau, fonts.body,
      COULEURS.parchemin);
    curseur += HAUTEUR_NOM;
  });
  ligne.details.forEach(detail => {
    dessinerTexte(canvas, COLONNE_TEXTE + INDENT_DETAIL, curseur, detail,
      fonts.body, COULEURS.attenue);
    curseur += HAUTEUR_DETAIL;
  });
}

/* Les vignettes changent a un deploiement du site : les garder en memoire
   evite de les retelecharger a chaque commande. Une lecture ratee est mise en
   cache elle aussi — reessayer trois fois par carte ne la ferait pas
   apparaitre. */
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
  const chemins = cheminsImages(carte);
  const images = new Map();
  await Promise.all(chemins.map(async chemin => {
    try {
      const image = await charger(chemin);
      if(image) images.set(chemin, image);
    } catch (erreur) {
      console.error("Image ignorée : " + chemin, erreur);
    }
  }));
  return images;
}

async function generateBuildCardPng(carte, options) {
  const charger = (options && options.chargerImage) || chargerVignette;
  const [fonts, images] = await Promise.all([
    availabilityFonts(),
    chargerImages(carte, charger)
  ]);
  const plan = mesurer(carte, fonts);
  const canvas = new RasterCanvas(LARGEUR, plan.hauteur, COULEURS.fond);
  dessinerEntete(canvas, carte, fonts, images);

  let y = HAUTEUR_ENTETE + ESPACE_SECTION;
  plan.sections.forEach(section => {
    dessinerTexte(canvas, MARGE, y, texteCarte(section.titre), fonts.brand,
      COULEURS.or);
    y += HAUTEUR_TITRE_SECTION;
    section.lignes.forEach(ligne => {
      dessinerLigne(canvas, ligne, y, fonts, images);
      y += ligne.hauteur + ESPACE_PANNEAU;
    });
    y += ESPACE_SECTION;
  });

  if(plan.note.length){
    dessinerTexte(canvas, MARGE, y, "NOTE DU JOUEUR", fonts.brand, COULEURS.or);
    y += HAUTEUR_TITRE_SECTION;
    const hauteur = 2 * PADDING_PANNEAU + plan.note.length * HAUTEUR_DETAIL;
    canvas.rectangle(MARGE, y, LARGEUR - 2 * MARGE, hauteur, COULEURS.panneau);
    let curseur = y + PADDING_PANNEAU;
    plan.note.forEach(morceau => {
      dessinerTexte(canvas, MARGE + PADDING_PANNEAU + 12, curseur, morceau,
        fonts.body, COULEURS.parchemin);
      curseur += HAUTEUR_DETAIL;
    });
    y += hauteur + ESPACE_SECTION;
  }

  const pied = plan.hauteur - HAUTEUR_PIED;
  canvas.rectangle(MARGE, pied + 8, LARGEUR - 2 * MARGE, 1, COULEURS.bordure);
  dessinerTexte(canvas, MARGE, pied + 18, "NOVA - CONFRERIE 7DS",
    fonts.body, COULEURS.faible);
  return await encodePng(canvas);
}

const discordBuildPngApi = {
  generateBuildCardPng,
  largeurTexte,
  mesurer,
  urlVignette,
  MESURES:{
    LARGEUR,
    MARGE,
    ICONE,
    PORTRAIT,
    COLONNE_TEXTE,
    PADDING_PANNEAU,
    INDENT_DETAIL,
    HAUTEUR_ENTETE,
    HAUTEUR_PIED
  }
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordBuildPngApi;
}
globalThis.NOVA_DISCORD_BUILD_PNG = discordBuildPngApi;
