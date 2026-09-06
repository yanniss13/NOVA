"use strict";

/* LES DEUX IMAGES DE /planning, dessinees a la charte des cartes Discord.

   Elles remplacent un rendu qui n'avait que l'atlas du planning — 45 glyphes,
   capitales sans accents — et qui ecrivait donc « CRENEAUX PAR MEMBRE » et
   « DISPONIBILITES NON RENSEIGNEES ». La fiche `/build` a apporte un second
   atlas accentue ; ces deux images le reprennent, avec le cadre file d'or,
   l'embleme et les equerres de `carte-ornements.js`.

   DEUX IMAGES, DEUX QUESTIONS. La grille repond « quand la confrerie est-elle
   la plus nombreuse ? » — 168 heures, une couleur par affluence. Les cartes
   par membre repondent « qui est la, et quand ? » — sept jours lus ligne a
   ligne. Les melanger donnerait un tableau que personne ne lit.

   LES RANGEES SONT SERREES. Le petit corps de l'atlas occupe une cellule de
   30 px mais n'encre que 15 : `ecrireEnRangee` centre le texte sur cette encre
   reelle, ce qui laisse tenir 24 heures dans une image en paysage. Discord
   reduit l'image a la largeur du message : c'est la hauteur qui la rend
   illisible, jamais la largeur. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_AVAILABILITY_FONT) require("./availability-font.js");
  if(!globalThis.NOVA_AVAILABILITY_PDF) require("./availability-pdf.js");
  if(!globalThis.NOVA_CARTE_FONT) require("./carte-font.js");
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_CARTE_ORNEMENTS) require("./carte-ornements.js");
}

const {
  RasterCanvas, encodePng, chargerAtlasCarte,
  jourDeLaSemaine, libelleHeure, JOURS_COURTS
} = globalThis.NOVA_AVAILABILITY_PDF;
const {
  COULEURS, largeurTexte, ecrire, ecrireCentre, ecrireADroite, tronquer,
  losange, cadre, filetOrne, cadreExterieur, embleme, anneau, rose
} = globalThis.NOVA_CARTE_ORNEMENTS;

const LARGEUR = 1660;
const MARGE = 36;
const HAUTEUR_ENTETE = 132;
const HAUTEUR_BANDE = 62;
const HAUTEUR_PIED = 92;
/* L'encre reelle du petit corps, mesuree sur l'atlas : c'est elle qui centre
   un texte dans sa rangee, et non la cellule qui l'entoure. */
const ENCRE_PETIT = 15;
const HAUT_ENCRE_PETIT = 7;

/* Du violet sourd a l'or : l'affluence se lit sans compter les chiffres. */
const CHALEUR_BASSE = [54, 42, 92, 255];
const CHALEUR_HAUTE = [214, 172, 96, 255];

/* « Semaine du 01/09 au 07/09 » : la forme courte de la maquette. Le libelle
   long du rapport (« semaine du 1 au 7 septembre ») ferme le pied. */
function periodeCourte(weekStart) {
  const chiffres = date => String(date.getUTCDate()).padStart(2, "0") + "/"
    + String(date.getUTCMonth() + 1).padStart(2, "0");
  return chiffres(jourDeLaSemaine(weekStart, 0)) + " au "
    + chiffres(jourDeLaSemaine(weekStart, 6));
}

function melange(depuis, vers, part) {
  const ratio = Math.max(0, Math.min(1, part));
  return [0, 1, 2, 3].map(canal =>
    Math.round(depuis[canal] + (vers[canal] - depuis[canal]) * ratio));
}

/* ------------------------------------------------------------------ */
/* Les petites icones                                                  */

function iconeCalendrier(canvas, x, y, couleur) {
  canvas.outline(x, y + 3, 22, 19, 1, couleur);
  canvas.rectangle(x, y + 3, 22, 5, couleur);
  canvas.rectangle(x + 5, y, 2, 6, couleur);
  canvas.rectangle(x + 15, y, 2, 6, couleur);
  [0, 1, 2].forEach(colonne => {
    canvas.rectangle(x + 4 + colonne * 6, y + 12, 3, 3, couleur);
    canvas.rectangle(x + 4 + colonne * 6, y + 17, 3, 3, couleur);
  });
}

function iconeHorloge(canvas, x, y, couleur) {
  anneau(canvas, x + 11, y + 11, 11, 2, couleur, COULEURS.fond);
  canvas.rectangle(x + 10, y + 4, 2, 8, couleur);
  canvas.rectangle(x + 11, y + 10, 6, 2, couleur);
}

function iconeMembres(canvas, x, y, couleur) {
  anneau(canvas, x + 7, y + 7, 5, 2, couleur, COULEURS.fond);
  anneau(canvas, x + 16, y + 7, 5, 2, couleur, COULEURS.fond);
  canvas.rectangle(x + 1, y + 14, 12, 7, couleur);
  canvas.rectangle(x + 3, y + 16, 8, 5, COULEURS.fond);
  canvas.rectangle(x + 11, y + 14, 11, 7, couleur);
  canvas.rectangle(x + 13, y + 16, 7, 5, COULEURS.fond);
}

function iconeAvatar(canvas, centreX, centreY, couleur) {
  anneau(canvas, centreX, centreY, 13, 1, couleur, COULEURS.panneau);
  anneau(canvas, centreX, centreY - 3, 4, 4, couleur, COULEURS.panneau);
  canvas.rectangle(centreX - 6, centreY + 3, 12, 6, couleur);
  canvas.rectangle(centreX - 4, centreY + 5, 8, 4, COULEURS.panneau);
}

function iconeInfo(canvas, centreX, centreY, couleur) {
  anneau(canvas, centreX, centreY, 13, 1, couleur, COULEURS.panneau);
  canvas.rectangle(centreX - 1, centreY - 7, 3, 3, couleur);
  canvas.rectangle(centreX - 1, centreY - 2, 3, 9, couleur);
}

/* ------------------------------------------------------------------ */
/* Le texte dans une rangee serree                                     */

function ecrireEnRangee(canvas, x, y, hauteur, valeur, atlas, couleur) {
  return ecrire(canvas, x, y + (hauteur - ENCRE_PETIT) / 2 - HAUT_ENCRE_PETIT,
    valeur, atlas, couleur);
}

function ecrireCentreEnRangee(canvas, centre, y, hauteur, valeur, atlas,
  couleur) {
  return ecrireCentre(canvas, centre,
    y + (hauteur - ENCRE_PETIT) / 2 - HAUT_ENCRE_PETIT, valeur, atlas, couleur);
}

/* ------------------------------------------------------------------ */
/* L'en-tete et le pied, communs aux deux images                       */

function dessinerEntete(canvas, titre, report, fonts) {
  embleme(canvas, 48, 20, fonts);

  ecrireCentre(canvas, LARGEUR / 2, 30, titre, fonts.titre, COULEURS.parchemin);
  const largeur = largeurTexte(titre, fonts.titre);
  filetOrne(canvas, LARGEUR / 2 - largeur / 4, 106, largeur / 2,
    COULEURS.filet);

  /* Le bloc de droite dit la semaine, le fuseau et l'assiduite. Le fuseau y
     figure parce que la confrerie n'est pas toute en France : « 21h » sans
     fuseau est une source de rendez-vous manques. */
  const x = 1218;
  const droite = LARGEUR - MARGE - 12;
  iconeCalendrier(canvas, x, 22, COULEURS.or);
  ecrire(canvas, x + 34, 20, "Semaine du " + periodeCourte(report.weekStart), fonts.petit,
    COULEURS.parchemin);
  iconeHorloge(canvas, x, 55, COULEURS.or);
  ecrire(canvas, x + 34, 53, "Heure de Paris", fonts.petit, COULEURS.parchemin);
  iconeMembres(canvas, x, 88, COULEURS.or);
  const renseignes = report.declaredCount + " / " + report.members.length
    + " membres renseignés";
  ecrire(canvas, x + 34, 86, renseignes, fonts.petit, COULEURS.parchemin);

  /* La jauge d'assiduite : le rapport se lit d'un coup d'oeil, sans lire. */
  const jaugeX = x + 34 + largeurTexte(renseignes, fonts.petit) + 16;
  if(droite - jaugeX > 60){
    const largeurJauge = droite - jaugeX;
    canvas.rectangle(jaugeX, 92, largeurJauge, 14, COULEURS.creux);
    const part = report.members.length
      ? report.declaredCount / report.members.length : 0;
    const remplie = Math.round((largeurJauge - 2) * part);
    if(remplie > 0) canvas.rectangle(jaugeX + 1, 93, remplie, 12, COULEURS.or);
    canvas.outline(jaugeX, 92, largeurJauge, 14, 1, COULEURS.filet);
  }
}

function dessinerPied(canvas, hauteur, report, fonts) {
  /* Le pied vit A L'INTERIEUR du double filet : pose sur la marge, il passait
     sous le bord de l'image et se coupait en deux. */
  const y = hauteur - 62;
  ecrire(canvas, MARGE + 12, y, "NOVA  ·  Confrérie 7DS", fonts.petit,
    COULEURS.faible);
  [-42, 0, 42].forEach((decalage, rang) => {
    losange(canvas, LARGEUR / 2 + decalage, y + 12, rang === 1 ? 6 : 4,
      COULEURS.or);
  });
  canvas.rectangle(LARGEUR / 2 - 130, y + 12, 78, 1, COULEURS.filet);
  canvas.rectangle(LARGEUR / 2 + 52, y + 12, 78, 1, COULEURS.filet);
  ecrireADroite(canvas, LARGEUR - MARGE - 12, y, report.label, fonts.petit,
    COULEURS.faible);
}

/* Le bandeau d'explication qui ferme le contenu des deux images. */
function dessinerBandeau(canvas, y, fonts, contenu) {
  cadre(canvas, MARGE, y, LARGEUR - 2 * MARGE, HAUTEUR_BANDE);
  contenu(MARGE + 24, y, HAUTEUR_BANDE);
  rose(canvas, LARGEUR - MARGE - 34, y + HAUTEUR_BANDE / 2, 15, COULEURS.or);
}

/* ------------------------------------------------------------------ */
/* La grille des 168 heures                                            */

const COLONNE_HEURE = 132;
const HAUTEUR_TETE_GRILLE = 56;
const HAUTEUR_RANGEE = 22;

function dessinerGrille(canvas, report, y, fonts) {
  const gauche = MARGE;
  const largeurGrille = LARGEUR - 2 * MARGE;
  const largeurJour = (largeurGrille - COLONNE_HEURE) / 7;
  const hauteur = HAUTEUR_TETE_GRILLE + 24 * HAUTEUR_RANGEE;
  cadre(canvas, gauche, y, largeurGrille, hauteur, COULEURS.panneau);

  /* La tete : le jour, puis sa date. Sans la date, « LUN » ne dit pas de
     quelle semaine il s'agit une fois l'image partagee. */
  canvas.rectangle(gauche + 1, y + 1, largeurGrille - 2,
    HAUTEUR_TETE_GRILLE - 1, COULEURS.creux);
  ecrireCentreEnRangee(canvas, gauche + COLONNE_HEURE / 2, y + 12, 24, "Heure",
    fonts.petit, COULEURS.parchemin);
  for(let jour = 0; jour < 7; jour += 1){
    const x = gauche + COLONNE_HEURE + jour * largeurJour;
    const date = jourDeLaSemaine(report.weekStart, jour);
    ecrireCentreEnRangee(canvas, x + largeurJour / 2, y + 6, 24,
      JOURS_COURTS[jour], fonts.corps, COULEURS.parchemin);
    ecrireCentreEnRangee(canvas, x + largeurJour / 2, y + 32, 20,
      String(date.getUTCDate()).padStart(2, "0") + "/"
      + String(date.getUTCMonth() + 1).padStart(2, "0"),
      fonts.petit, COULEURS.attenue);
    if(jour) canvas.rectangle(x, y + 1, 1, hauteur - 2, COULEURS.filet);
  }
  canvas.rectangle(gauche + COLONNE_HEURE, y + 1, 1, hauteur - 2,
    COULEURS.filet);
  canvas.rectangle(gauche + 1, y + HAUTEUR_TETE_GRILLE, largeurGrille - 2, 1,
    COULEURS.filet);

  for(let heure = 0; heure < 24; heure += 1){
    const rangeeY = y + HAUTEUR_TETE_GRILLE + heure * HAUTEUR_RANGEE;
    ecrireCentreEnRangee(canvas, gauche + COLONNE_HEURE / 2, rangeeY,
      HAUTEUR_RANGEE, libelleHeure(heure), fonts.petit, COULEURS.attenue);
    for(let jour = 0; jour < 7; jour += 1){
      const compte = report.counts[jour * 24 + heure];
      const x = gauche + COLONNE_HEURE + jour * largeurJour;
      if(compte){
        const part = report.max ? compte / report.max : 0;
        canvas.rectangle(x + 2, rangeeY + 1, largeurJour - 3,
          HAUTEUR_RANGEE - 2, melange(CHALEUR_BASSE, CHALEUR_HAUTE, part));
        ecrireCentreEnRangee(canvas, x + largeurJour / 2, rangeeY,
          HAUTEUR_RANGEE, String(compte), fonts.petit,
          part > 0.55 ? COULEURS.fond : COULEURS.parchemin);
      }
    }
    /* Un filet plus franc toutes les six heures : l'oeil retrouve la nuit,
       le matin, l'apres-midi et la soiree sans compter les rangees. */
    if(heure && heure % 6 === 0){
      canvas.rectangle(gauche + 1, rangeeY, largeurGrille - 2, 1, COULEURS.or);
    }
  }
  return hauteur;
}

/* Le bandeau des creneaux a privilegier, en tete de la grille. */
function dessinerMeilleurs(canvas, report, y, fonts) {
  const largeur = LARGEUR - 2 * MARGE;
  cadre(canvas, MARGE, y, largeur, HAUTEUR_BANDE);
  rose(canvas, MARGE + 34, y + HAUTEUR_BANDE / 2, 15, COULEURS.or);
  ecrire(canvas, MARGE + 60, y + 8, "Créneaux", fonts.petit, COULEURS.or);
  ecrire(canvas, MARGE + 60, y + 32, "à privilégier", fonts.petit,
    COULEURS.or);

  const gauche = MARGE + 200;
  const disponible = largeur - 200 - 24;
  const cases = 3;
  const largeurCase = (disponible - (cases - 1) * 16) / cases;
  for(let rang = 0; rang < cases; rang += 1){
    const x = gauche + rang * (largeurCase + 16);
    cadre(canvas, x, y + 12, largeurCase, HAUTEUR_BANDE - 24, COULEURS.creux);
    losange(canvas, x + 22, y + HAUTEUR_BANDE / 2, 7, COULEURS.or);
    const creneau = report.best[rang];
    const texte = creneau
      ? JOURS_COURTS[Math.floor(creneau.index / 24)] + "  ·  "
        + libelleHeure(creneau.index % 24) + "–"
        + libelleHeure(creneau.index % 24 + 1) + "  ·  "
        + creneau.count + (creneau.count > 1 ? " membres" : " membre")
      : "Aucun créneau commun";
    ecrireCentreEnRangee(canvas, x + largeurCase / 2 + 12,
      y + 12, HAUTEUR_BANDE - 24, tronquer(texte, fonts.petit, largeurCase - 60),
      fonts.petit, creneau ? COULEURS.parchemin : COULEURS.faible);
  }
}

async function generatePlanningTablePng(report) {
  const fonts = await chargerAtlasCarte();
  const hautBande = HAUTEUR_ENTETE;
  const hautGrille = hautBande + HAUTEUR_BANDE + 16;
  const hauteurGrille = HAUTEUR_TETE_GRILLE + 24 * HAUTEUR_RANGEE;
  const hautLegende = hautGrille + hauteurGrille + 16;
  const hauteur = hautLegende + HAUTEUR_BANDE + HAUTEUR_PIED;

  const canvas = new RasterCanvas(LARGEUR, hauteur, COULEURS.fond);
  cadreExterieur(canvas, LARGEUR, hauteur);
  dessinerEntete(canvas, "Planning hebdomadaire", report, fonts);
  dessinerMeilleurs(canvas, report, hautBande, fonts);
  dessinerGrille(canvas, report, hautGrille, fonts);

  dessinerBandeau(canvas, hautLegende, fonts, (x, y, hauteurBande) => {
    ecrireEnRangee(canvas, x, y, hauteurBande,
      "Chaque case porte le nombre de membres disponibles sur cette heure.",
      fonts.petit, COULEURS.attenue);
    /* L'echelle : quatre carres du plus creux au plus plein. Sans elle, la
       couleur n'est qu'une decoration. */
    const echelle = x + 660;
    [0, 0.34, 0.67, 1].forEach((part, rang) => {
      const caseX = echelle + rang * 34;
      canvas.rectangle(caseX, y + 20, 26, 22,
        rang ? melange(CHALEUR_BASSE, CHALEUR_HAUTE, part) : COULEURS.panneau);
      canvas.outline(caseX, y + 20, 26, 22, 1, COULEURS.filet);
    });
    ecrireEnRangee(canvas, echelle + 150, y, hauteurBande,
      "de faible à forte disponibilité", fonts.petit, COULEURS.parchemin);
    ecrireEnRangee(canvas, echelle + 430, y, hauteurBande,
      "Case vide : personne", fonts.petit, COULEURS.faible);
  });
  dessinerPied(canvas, hauteur, report, fonts);
  return await encodePng(canvas);
}

/* ------------------------------------------------------------------ */
/* Les cartes par membre                                               */

const COLONNES_MEMBRES = 3;
const GOUTTIERE_MEMBRE = 18;
const HAUTEUR_JOUR = 20;
const LABEL_JOUR = 52;
const HAUTEUR_REGLE = 22;
const HAUTEUR_CARTE_MEMBRE = 46 + HAUTEUR_REGLE + 7 * HAUTEUR_JOUR + 16;
/* La case d'une heure. Sa largeur se deduit de la carte, sa hauteur est fixe :
   c'est elle qui donne a la bande son epaisseur. */
const CELLULE_HAUTEUR = 14;

function largeurCarteMembre() {
  return (LARGEUR - 2 * MARGE
    - (COLONNES_MEMBRES - 1) * GOUTTIERE_MEMBRE) / COLONNES_MEMBRES;
}

/* SEPT BANDES DE VINGT-QUATRE HEURES, une par jour, meme vides.

   La liste de plages — « 11h-12h / 14h-15h / 16h-17h / 19h-24h » — etait exacte
   et illisible : sept lignes de chiffres par membre, douze membres par image, et
   les jours charges finissaient tronques. Une bande se lit d'un coup d'oeil, ne
   tronque jamais, et laisse comparer deux membres sans compter.

   Un jour vide se dessine quand meme : « ce membre n'a rien mis ce jour-la » et
   « je n'ai pas regarde ce jour-la » ne sont pas la meme information. */
function joursDeMembre(membre) {
  return JOURS_COURTS.map((court, jour) => {
    const heures = [];
    for(let heure = 0; heure < 24; heure += 1){
      heures.push(membre.mask[jour * 24 + heure] === "1");
    }
    return { court, heures, vide:!heures.some(Boolean) };
  });
}

function largeurCellule(largeurCarte) {
  return (largeurCarte - LABEL_JOUR - 34) / 24;
}

/* UNE DECLARATION VIDE N'EST PAS UNE ABSENCE DE DECLARATION. Les deux donnent
   zero heure ; les ecrire pareil ferait lire « ce membre n'est jamais la »
   alors que personne n'en sait rien. Le membre qui a repondu se compte en
   heures, meme a zero ; celui qui n'a pas repondu se dit. */
function libelleHeuresMembre(membre) {
  return membre.declared ? membre.hours + " h" : "non renseigné";
}

function dessinerCarteMembre(canvas, membre, x, y, largeur, fonts) {
  cadre(canvas, x, y, largeur, HAUTEUR_CARTE_MEMBRE);
  iconeAvatar(canvas, x + 26, y + 24, COULEURS.or);

  const heures = libelleHeuresMembre(membre);
  const largeurHeures = largeurTexte(heures, fonts.petit);
  ecrireADroite(canvas, x + largeur - 18, y + 12, heures, fonts.petit,
    membre.hours ? COULEURS.parchemin : COULEURS.faible);
  iconeHorloge(canvas, x + largeur - 30 - largeurHeures - 24, y + 12,
    COULEURS.or);
  ecrire(canvas, x + 48, y + 6,
    tronquer(membre.pseudo, fonts.section,
      largeur - 48 - largeurHeures - 70),
    fonts.section, COULEURS.orVif);
  canvas.rectangle(x + 14, y + 46, largeur - 28, 1, COULEURS.filet);

  /* La regle des heures, une fois par carte : sans elle, une bande allumee ne
     dit pas A QUELLE heure. Quatre reperes suffisent, la nuit et la soiree se
     retrouvant seules. */
  const bandeX = x + LABEL_JOUR;
  const cellule = largeurCellule(largeur);
  const regleY = y + 50;
  [0, 6, 12, 18, 24].forEach(heure => {
    const marque = bandeX + heure * cellule;
    canvas.rectangle(Math.round(marque), regleY + 14, 1, 5, COULEURS.filet);
    ecrireCentreEnRangee(canvas, marque, regleY, 16,
      String(heure).padStart(2, "0") + "h", fonts.petit, COULEURS.faible);
  });

  joursDeMembre(membre).forEach((jour, rang) => {
    const rangeeY = y + 46 + HAUTEUR_REGLE + rang * HAUTEUR_JOUR;
    ecrireEnRangee(canvas, x + 16, rangeeY, HAUTEUR_JOUR, jour.court,
      fonts.petit, jour.vide ? COULEURS.faible : COULEURS.attenue);
    /* L'ORDRE DU TRACE EST L'ORDRE DE LECTURE. Le creux, puis les reperes des
       six heures, puis les heures declarees, puis le filet AUTOUR de la bande.
       Dessines apres, le filet et les reperes rognaient chaque heure allumee —
       la bande disait moins que ce que le membre avait coche. */
    const hautBande = rangeeY + (HAUTEUR_JOUR - CELLULE_HAUTEUR - 2) / 2;
    const hautCase = hautBande + 1;
    canvas.rectangle(bandeX, hautBande, cellule * 24, CELLULE_HAUTEUR + 2,
      COULEURS.creux);
    [6, 12, 18].forEach(heure => {
      canvas.rectangle(Math.round(bandeX + heure * cellule), hautCase, 1,
        CELLULE_HAUTEUR, COULEURS.fond);
    });
    jour.heures.forEach((libre, heure) => {
      if(!libre) return;
      const gauche = Math.round(bandeX + heure * cellule);
      canvas.rectangle(gauche, hautCase,
        Math.round(bandeX + (heure + 1) * cellule) - gauche, CELLULE_HAUTEUR,
        CHALEUR_HAUTE);
    });
    canvas.outline(bandeX, hautBande, cellule * 24, CELLULE_HAUTEUR + 2, 1,
      COULEURS.filet);
  });
}

async function generatePlanningMembersPng(report) {
  const fonts = await chargerAtlasCarte();
  const membres = report.members;
  const rangees = Math.max(1, Math.ceil(membres.length / COLONNES_MEMBRES));
  const hautCartes = HAUTEUR_ENTETE;
  const hauteurCartes = membres.length
    ? rangees * HAUTEUR_CARTE_MEMBRE + (rangees - 1) * GOUTTIERE_MEMBRE
    : 96;
  const hautLegende = hautCartes + hauteurCartes + 16;
  const hauteur = hautLegende + HAUTEUR_BANDE + HAUTEUR_PIED;

  const canvas = new RasterCanvas(LARGEUR, hauteur, COULEURS.fond);
  cadreExterieur(canvas, LARGEUR, hauteur);
  dessinerEntete(canvas, "Créneaux par membre", report, fonts);

  const largeur = largeurCarteMembre();
  if(!membres.length){
    cadre(canvas, MARGE, hautCartes, LARGEUR - 2 * MARGE, 96);
    ecrireCentre(canvas, LARGEUR / 2, hautCartes + 32,
      "Aucun membre enregistré dans la confrérie", fonts.corps,
      COULEURS.attenue);
  }else{
    membres.forEach((membre, rang) => {
      const colonne = rang % COLONNES_MEMBRES;
      const rangee = Math.floor(rang / COLONNES_MEMBRES);
      dessinerCarteMembre(canvas, membre,
        MARGE + colonne * (largeur + GOUTTIERE_MEMBRE),
        hautCartes + rangee * (HAUTEUR_CARTE_MEMBRE + GOUTTIERE_MEMBRE),
        largeur, fonts);
    });
  }

  dessinerBandeau(canvas, hautLegende, fonts, (x, y, hauteurBande) => {
    iconeInfo(canvas, x + 12, y + hauteurBande / 2, COULEURS.or);
    ecrireEnRangee(canvas, x + 38, y, hauteurBande,
      "Une bande par jour, de minuit à minuit, heure de Paris.", fonts.petit,
      COULEURS.attenue);
    /* Deux echantillons plutot qu'une phrase : la bande n'a que deux etats, et
       les montrer coute moins de place que les decrire. */
    const echantillon = x + 520;
    canvas.rectangle(echantillon, y + 21, 30, 14, CHALEUR_HAUTE);
    canvas.outline(echantillon, y + 20, 30, 16, 1, COULEURS.filet);
    ecrireEnRangee(canvas, echantillon + 42, y, hauteurBande, "disponible",
      fonts.petit, COULEURS.parchemin);
    const creux = echantillon + 170;
    canvas.rectangle(creux, y + 21, 30, 14, COULEURS.creux);
    canvas.outline(creux, y + 20, 30, 16, 1, COULEURS.filet);
    ecrireEnRangee(canvas, creux + 42, y, hauteurBande, "indisponible",
      fonts.petit, COULEURS.attenue);
    canvas.rectangle(creux + 190, y + 14, 1, hauteurBande - 28, COULEURS.filet);
    ecrireEnRangee(canvas, creux + 214, y, hauteurBande,
      "« non renseigné » : ce membre n'a pas encore répondu", fonts.petit,
      COULEURS.faible);
  });
  dessinerPied(canvas, hauteur, report, fonts);
  return await encodePng(canvas);
}

const planningPngApi = {
  generatePlanningTablePng,
  generatePlanningMembersPng,
  joursDeMembre,
  libelleHeuresMembre,
  MESURES:{
    LARGEUR,
    MARGE,
    HAUTEUR_ENTETE,
    HAUTEUR_BANDE,
    HAUTEUR_PIED,
    HAUTEUR_RANGEE,
    HAUTEUR_TETE_GRILLE,
    COLONNE_HEURE,
    COLONNES_MEMBRES,
    HAUTEUR_CARTE_MEMBRE,
    CELLULE_LARGEUR:largeurCellule(
      (LARGEUR - 2 * MARGE - (COLONNES_MEMBRES - 1) * GOUTTIERE_MEMBRE)
      / COLONNES_MEMBRES),
    CELLULE_HAUTEUR,
    OR:COULEURS.or.slice(0, 3),
    CHALEUR_HAUTE:CHALEUR_HAUTE.slice(0, 3)
  }
};

globalThis.NOVA_PLANNING_PNG = planningPngApi;
if(typeof module !== "undefined" && module.exports){
  module.exports = planningPngApi;
}
