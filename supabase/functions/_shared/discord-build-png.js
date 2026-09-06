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
  if(!globalThis.NOVA_CARTE_ORNEMENTS) require("./carte-ornements.js");
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
/* Le cartouche sous le portrait est encadre de deux filets et de deux
   losanges : ce qui lui reste est la largeur de la colonne moins ce decor. */
const LARGEUR_CARTOUCHE = COLONNE_GAUCHE - 2 * PADDING - 2 * 46;
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
const ESPACE_LIGNE_LISTE = 4;
const MARGE_BASSE_SECTION = 16;
const MARGE_AVANT_SEPARATEUR = 18;

/* Le decor — cadre, filets, equerres, texte — est celui de toutes les cartes
   Discord : il vit dans `carte-ornements.js`. Ce qui suit est ce que la fiche
   de personnage est seule a dessiner. */
const {
  COULEURS, largeurTexte, ecrire, ecrireCentre, ecrireADroite,
  couperEnLignes, tronquer, couperEnLignesLimite,
  remplirPolygone, losange, etoile, anneau, cadre, filetOrne, cadreExterieur
} = globalThis.NOVA_CARTE_ORNEMENTS;

/* ------------------------------------------------------------------ */
/* Les symboles d'identite                                             */

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

/* UNE RANGEE DE LISTE — une piece d'armure ou un bijou. Les deux ont la meme
   forme : l'icone a gauche ; a droite l'emplacement et la premiere sous-stat
   en vis-a-vis, puis le nom, puis la barre de cette sous-stat.

   Le jeu montre la stat sur la meme ligne que l'identite de l'objet : la
   premiere jauge occupe donc les 80 px que l'icone ouvre de toute facon, et
   n'allonge rien. Seules d'eventuelles jauges supplementaires agrandissent la
   rangee — 43 des 99 pieces du jeu portent une sous-stat, jamais deux. */
/* Le premier mot, sans accent, sans casse et sans marque de pluriel : c'est
   ce qui permet de reconnaitre « Boucles d'oreilles du souverain cupide »
   comme portant l'emplacement « Boucle d'oreille ». */
function premierMot(valeur) {
  return String(valeur || "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().split(/[ '’]/)[0].replace(/s$/, "");
}

/* L'EMPLACEMENT NE SE REPETE PAS. Les 99 pieces et bijoux du jeu commencent
   par le nom de leur emplacement : « Anneau » au-dessus de « Anneau du
   souverain cupide » n'apprend rien, et prend la place de la statistique.

   Deux exceptions, et ce sont elles qui font la regle. Un emplacement VIDE
   garde son nom — « Aucun » tout seul ne dirait pas de quel bijou il s'agit,
   et c'est justement ce qu'un membre vient verifier. Un objet qui ne porterait
   pas son emplacement le garderait aussi : la regle s'appuie sur le nom, pas
   sur une promesse du catalogue. */
function enteteDeLigne(ligne) {
  const repete = ligne.nom
    && premierMot(ligne.nom) === premierMot(ligne.emplacement);
  const morceaux = (repete ? [] : [ligne.emplacement]).concat(ligne.details);
  return morceaux.filter(Boolean).join(" · ");
}

function mesurerLigneListe(ligne, fonts, largeurColonne) {
  const largeur = largeurColonne - ICONE - 18;
  const nom = couperEnLignesLimite(ligne.nom, fonts.corps, largeur, 2);
  const lignesNom = Math.max(1, nom.length);

  /* La rangee d'entete se partage entre l'emplacement a gauche et la sous-stat
     a droite. La sous-stat ne reserve que ce qu'elle occupe VRAIMENT : lui
     donner d'office 58 % de la rangee sortait « Haut · Passif nivea… » sur une
     ligne aux deux tiers vide. Le plafond reste, pour qu'un libelle bavard ne
     mange pas l'emplacement a son tour. */
  const premiere = ligne.jauges.length ? ligne.jauges[0] : null;
  const enteteVoulu = enteteDeLigne(ligne);
  let libelleJauge = "";
  let valeurJauge = "";
  let largeurEntete = largeur;
  if(premiere){
    valeurJauge = texteCarte(premiere.texte);
    const largeurValeur = atlasStringWidthExact(valeurJauge, fonts.petit);
    /* CHACUN PREND CE QU'IL LUI FAUT, ET NON UNE PART FIXE. Le libelle etait
       plafonne a 58 % de la rangee quoi qu'il arrive : « Résistance au
       percement » sortait ampute a cote d'un « Anneau » de 69 px qui laissait
       la moitie de la rangee vide. L'emplacement se sert le premier — c'est
       l'identite de la ligne — mais jamais au-dela de sa part quand les deux
       ne tiennent pas, sinon un passif bavard chasserait la statistique. */
    const disponible = largeur - largeurValeur - 28;
    const voulu = atlasStringWidthExact(enteteVoulu, fonts.petit);
    const restant = disponible
      - atlasStringWidthExact(texteCarte(premiere.libelle), fonts.petit);
    largeurEntete = Math.min(voulu, Math.max(restant, disponible * 0.42));
    libelleJauge = tronquer(premiere.libelle, fonts.petit,
      disponible - largeurEntete);
  }
  const entete = tronquer(enteteVoulu, fonts.petit, largeurEntete);

  /* L'ORDRE DE LA RANGEE EST UNE MESURE, et non une decision du trace : on
     cherche un objet par son NOM, qui ouvre donc la rangee ; la statistique
     vient le qualifier, et sa barre se pose juste dessous, contre ce qu'elle
     mesure. Les decalages sortent d'ici pour pouvoir etre eprouves autrement
     qu'en regardant l'image. */
  const decalageStat = lignesNom * HAUTEUR_NOM;
  const decalageBarre = decalageStat + HAUTEUR_LIGNE - 4;
  const hauteur = Math.max(ICONE,
    decalageBarre + (ligne.jauges.length ? 16 : 0))
    + Math.max(0, ligne.jauges.length - 1) * HAUTEUR_JAUGE;
  /* Une rangee SANS statistique n'a rien a empiler sous son nom : le coller en
     haut d'une case de 80 px le laisserait flotter au-dessus de son icone.
     Il se centre. */
  const decalageNom = ligne.jauges.length
    ? 0 : (hauteur - lignesNom * HAUTEUR_NOM) / 2;
  return Object.assign({}, ligne, {
    nom,
    lignesNom,
    entete,
    libelleJauge,
    valeurJauge,
    decalageNom,
    decalageStat,
    decalageBarre,
    hauteur
  });
}

function mesurer(carte, fonts) {
  const largeurBloc = COLONNE_MILIEU - 2 * PADDING;
  const milieu = lignesDe(sectionParTitre(carte, "Arme"))
    .map(ligne => mesurerBloc(ligne, fonts, largeurBloc));

  /* L'armure est une LISTE, et non une grille de deux cases. En grille,
     l'icone prenait 80 des 268 px d'une demi-colonne : il restait 172 px, soit
     une trentaine de caracteres, quand les noms du jeu en font quarante — 35
     pieces sur 62 sortaient amputees. Sur la colonne entiere, les 62 tiennent
     sur une seule ligne. La liste coute une trentaine de pixels de hauteur ;
     un nom faux coute a un membre la mauvaise piece equipee. */
  const largeurListe = COLONNE_DROITE - 2 * PADDING;
  const armure = lignesDe(sectionParTitre(carte, "Armure"))
    .map(ligne => mesurerLigneListe(ligne, fonts, largeurListe));
  const hauteurArmureNaturelle = DEBUT_CONTENU_SECTION
    + armure.reduce((total, entree) => total + entree.hauteur
      + ESPACE_LIGNE_LISTE, 0) + MARGE_BASSE_SECTION;

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

  const bijoux = lignesDe(sectionParTitre(carte, "Bijoux"))
    .map(ligne => mesurerLigneListe(ligne, fonts, largeurListe));
  const hauteurBijoux = DEBUT_CONTENU_SECTION
    + bijoux.reduce((total, ligne) => total + ligne.hauteur
      + ESPACE_LIGNE_LISTE, 0) + MARGE_BASSE_SECTION;

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

/* Le cartouche sous le portrait nomme le joueur. La commande s'appelle
   `/build <joueur>` : savoir de qui est le build fait partie de la reponse,
   et « Portrait » ne nommait que l'evidence. Sans joueur — une carte de test,
   un roster sans profil — il ne reste que le filet : rien n'est invente. */
function cartoucheJoueur(carte, fonts) {
  const joueur = carte && carte.joueur ? String(carte.joueur) : "";
  return joueur ? tronquer(joueur, fonts.petit, LARGEUR_CARTOUCHE) : "";
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
  const cartouche = cartoucheJoueur(carte, fonts);
  if(cartouche){
    const largeurCartouche = largeurTexte(cartouche, fonts.petit);
    const debutLabel = centre - largeurCartouche / 2;
    canvas.rectangle(x + PADDING, basPortrait,
      debutLabel - 14 - (x + PADDING), 1, COULEURS.filet);
    canvas.rectangle(debutLabel + largeurCartouche + 14, basPortrait,
      x + COLONNE_GAUCHE - PADDING
        - (debutLabel + largeurCartouche + 14), 1, COULEURS.filet);
    losange(canvas, debutLabel - 7, basPortrait, 4, COULEURS.or);
    losange(canvas, debutLabel + largeurCartouche + 7, basPortrait, 4,
      COULEURS.or);
    ecrireCentre(canvas, centre, basPortrait - 14, cartouche, fonts.petit,
      COULEURS.parchemin);
  }else{
    filetOrne(canvas, x + PADDING, basPortrait, COLONNE_GAUCHE - 2 * PADDING,
      COULEURS.filet);
  }

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

/* L'armure et les bijoux se dessinent de la meme facon : voir
   `mesurerLigneListe`. L'armure tenait autrefois en grille de deux cases, plus
   compacte, mais qui amputait la majorite des noms du jeu et n'avait la place
   ni de la sous-stat ni du passif. */
function dessinerLigneListe(canvas, ligne, x, y, largeurColonne, fonts, images) {
  dessinerIcone(canvas, images.get(ligne.image), x, y);
  const texteX = x + ICONE + 18;
  const droite = x + largeurColonne;
  const largeurTexteBloc = droite - texteX;
  /* Le palier du passif se lit a cote de l'emplacement : il tient en trois
     mots, et lui donner sa propre rangee couterait cette hauteur aux quatre
     cinquiemes des pieces, qui n'en ont pas. Le partage de la rangee est
     decide par `mesurerLigneListe` ; ici on ne fait que poser. */
  let ligneY = y + ligne.decalageNom;
  if(!ligne.nom.length){
    ecrire(canvas, texteX, ligneY, "Aucun", fonts.corps, COULEURS.faible);
  }else{
    ligne.nom.forEach(morceau => {
      ecrire(canvas, texteX, ligneY, morceau, fonts.corps, COULEURS.parchemin);
      ligneY += HAUTEUR_NOM;
    });
  }

  const rangeeStat = y + ligne.decalageStat;
  const premiere = ligne.jauges.length ? ligne.jauges[0] : null;
  if(premiere){
    const largeurValeur = largeurTexte(ligne.valeurJauge, fonts.petit);
    ecrireADroite(canvas, droite, rangeeStat, ligne.valeurJauge, fonts.petit,
      COULEURS.parchemin);
    ecrireADroite(canvas, droite - largeurValeur - 12, rangeeStat,
      ligne.libelleJauge, fonts.petit, COULEURS.attenue);
  }
  ecrire(canvas, texteX, rangeeStat, ligne.entete, fonts.petit,
    COULEURS.faible);

  if(!premiere) return;
  if(premiere.part !== null && premiere.part !== undefined){
    dessinerBarre(canvas, texteX, y + ligne.decalageBarre, premiere.part,
      largeurTexteBloc);
  }
  const basRangee = y + Math.max(ICONE, ligne.decalageBarre + 16);
  ligne.jauges.slice(1).forEach((jauge, rang) => {
    dessinerJauge(canvas, jauge, texteX, basRangee + rang * HAUTEUR_JAUGE,
      largeurTexteBloc, fonts);
  });
}

function dessinerSectionListe(canvas, numero, titre, lignes, x, y, hauteur,
  fonts, images) {
  cadre(canvas, x, y, COLONNE_DROITE, hauteur);
  const largeur = COLONNE_DROITE - 2 * PADDING;
  titreSection(canvas, numero, titre, x + PADDING, y + PADDING, largeur, fonts);
  let curseur = y + DEBUT_CONTENU_SECTION;
  lignes.forEach(ligne => {
    dessinerLigneListe(canvas, ligne, x + PADDING, curseur, largeur, fonts,
      images);
    curseur += ligne.hauteur + ESPACE_LIGNE_LISTE;
  });
}

function urlVignette(chemin) {
  return BASE_VIGNETTES + String(chemin)
    .replace(/\.webp$/i, ".png")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

/* Une carte pose la meme icone plusieurs fois, et trois cartes d'un meme
   personnage partagent son portrait : le cache evite de retelecharger. Il
   VIVAIT SANS ETRE DECLARE — chaque chargement levait une ReferenceError,
   avalee par le `try` qui protege les vignettes manquantes, et toutes les
   cartes sortaient avec des cadres vides pendant que les URL repondaient 200.
   Aucun test ne l'avait vu : tous injectent leur propre chargeur. */
const cacheVignettes = new Map();

function viderCacheVignettes() {
  cacheVignettes.clear();
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
  /* ON NE MEMORISE QUE LES SUCCES. L'isolat survit d'un appel a l'autre : un
     echec passager — le temps d'un deploiement du site, par exemple — restait
     grave pour toute sa duree de vie, et toutes les cartes suivantes sortaient
     avec des cadres vides sans qu'aucune ne reessaie. */
  if(image) cacheVignettes.set(chemin, image);
  return image;
}

/* CE QUE LE RUNTIME VOIT VRAIMENT. Une carte aux cadres vides ne dit pas
   pourquoi : le rendu prefere un cadre vide a une carte perdue, ce qui est
   bien, mais laisse la cause invisible depuis Discord. Cette sonde rejoue le
   meme chemin — meme URL, meme decodage — et rapporte l'etape qui a lache.
   `recuperer` n'est injecte que par les tests ; en production c'est `fetch`. */
async function diagnostiquerVignette(chemin, recuperer) {
  const url = urlVignette(chemin);
  const depart = Date.now();
  const chercher = recuperer || fetch;
  try {
    const reponse = await chercher(url);
    if(!reponse.ok){
      return { url, statut:reponse.status, octets:0, decode:false,
        ms:Date.now() - depart };
    }
    const octets = Buffer.from(await reponse.arrayBuffer());
    let decode = false;
    let erreur;
    try {
      const image = await decodePng(octets);
      decode = Boolean(image && image.width);
    } catch (echec) {
      erreur = String((echec && echec.message) || echec);
    }
    return Object.assign({ url, statut:reponse.status,
      octets:octets.length, decode, ms:Date.now() - depart },
    erreur ? { erreur } : {});
  } catch (echec) {
    return { url, erreur:String((echec && echec.message) || echec),
      ms:Date.now() - depart };
  }
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

  cadreExterieur(canvas, LARGEUR, plan.hauteur);

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
  dessinerSectionListe(canvas, "02", "Armure", plan.armure, droiteX, hautCorps,
    plan.hauteurArmure, fonts, images);
  dessinerSectionListe(canvas, "03", "Bijoux", plan.bijoux, droiteX,
    hautCorps + plan.separateurSections, plan.hauteurBijoux,
    fonts, images);

  /* Le pied vit A L'INTERIEUR du double filet, et non dessus : dessine a la
     marge, il passait sur les equerres de coin et sortait par le bas. */
  const pied = plan.hauteur - HAUTEUR_PIED + 10;
  filetOrne(canvas, MARGE + 14, pied - 12, LARGEUR - 2 * MARGE - 28,
    COULEURS.filet);
  /* Le pied signe la confrerie, pas le joueur : son pseudo est desormais au
     cartouche, sous son portrait, ou on le cherche. */
  ecrire(canvas, MARGE + 22, pied, "Confrérie NOVA", fonts.petit,
    COULEURS.faible);
  const note = carte && carte.note
    ? tronquer(carte.note, fonts.petit, COLONNE_MILIEU + 200) : "";
  if(note) ecrireCentre(canvas, LARGEUR / 2, pied, note, fonts.petit,
    COULEURS.attenue);
  ecrireADroite(canvas, LARGEUR - MARGE - 22, pied,
    (carte && carte.arme) || "", fonts.petit, COULEURS.faible);
  return await encodePng(canvas);
}

/* UNE RAFALE, comme la carte en lance une. La sonde a une image passait, et la
   carte sortait pourtant vide : le sondage ne prouvait que le cas facile. Une
   carte demande dix vignettes D'UN COUP, et c'est ce que ceci rejoue. */
async function diagnostiquerRafale(chemins, recuperer) {
  const chercher = recuperer || fetch;
  return await Promise.all(chemins.map(async chemin => {
    const depart = Date.now();
    try {
      const reponse = await chercher(urlVignette(chemin));
      return { chemin, statut:reponse.status, ms:Date.now() - depart };
    } catch (echec) {
      return { chemin, erreur:String((echec && echec.message) || echec),
        ms:Date.now() - depart };
    }
  }));
}

/* LE CHEMIN EXACT DE LA CARTE, et non plus un fetch isole. Le sondage a une
   image passait, la rafale aussi, et la carte sortait pourtant vide : ce qui
   restait a eprouver, c'est `chargerImages` lui-meme — la collecte des chemins
   depuis la carte, puis le chargeur avec son cache. */
async function diagnostiquerChargement(carte) {
  const demandes = cheminsImages(carte);
  const images = await chargerImages(carte, chargerVignette);
  return {
    demandes,
    chargees:[...images.keys()],
    tailles:[...images.entries()].map(([chemin, image]) =>
      chemin + " " + image.width + "x" + image.height)
  };
}

const discordBuildPngApi = {
  generateBuildCardPng,
  largeurTexte,
  tronquer,
  mesurer,
  cartoucheJoueur,
  urlVignette,
  diagnostiquerVignette,
  diagnostiquerRafale,
  diagnostiquerChargement,
  chargerVignette,
  viderCacheVignettes,
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
    LARGEUR_CARTOUCHE,
    HAUTEUR_NOM,
    HAUTEUR_LIGNE,
    HAUTEUR_JAUGE,
    HAUTEUR_JAUGE_TITRE,
    ESPACE_BLOC,
    DEBUT_CONTENU_SECTION,
    ESPACE_LIGNE_LISTE,
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
