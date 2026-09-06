"use strict";

/* L'image de la carte /build. On ne compare pas des pixels : on verifie que le
   PNG est un PNG, qu'il grandit avec ce qu'il contient, et qu'aucun build
   incomplet ne fait tomber le rendu — un membre peut avoir equipe une arme
   sans jamais ouvrir l'editeur. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
require(path.join(ROOT, "supabase", "functions", "_shared", "availability-font.js"));
const {
  RasterCanvas, encodePng, availabilityFonts
} = require(path.join(
  ROOT, "supabase", "functions", "_shared", "availability-pdf.js"
));
const {
  generateBuildCardPng, MESURES, largeurTexte, mesurer
} = require(path.join(
  ROOT, "supabase", "functions", "_shared", "discord-build-png.js"
));
const {
  decodePng
} = require(path.join(
  ROOT, "supabase", "functions", "_shared", "png-decode.js"
));

assert.equal(typeof RasterCanvas, "function",
  "le rendu de /build reutilise la surface de dessin du planning");
assert.equal(typeof encodePng, "function");
assert.equal(typeof availabilityFonts, "function");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function dimensions(png) {
  assert.ok(png.subarray(0, 8).equals(SIGNATURE), "signature PNG absente");
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  return { largeur:png.readUInt32BE(16), hauteur:png.readUInt32BE(20) };
}

const CARTE_PLEINE = {
  joueur:"YanniSs13",
  personnage:"Ban",
  element:"Ténèbres",
  potentiel:7,
  arme:"Nunchaku",
  portrait:"7ds-personnages/ban.webp",
  note:"Build de raid, à garder pour le boss de la semaine",
  fichier:"build-yanniss13-ban-nunchaku.png",
  sections:[
    {
      titre:"Arme",
      lignes:[{
        emplacement:"Nunchaku",
        nom:"Baguette à l'aura triomphale",
        image:"7ds-armes/Nunchaku/Nunchaku du renard.webp",
        details:[
          "Niveau 50 · promotion 4 · dépassement 2",
          "Perle légendaire",
          "Taux critique : 12.5 %"
        ]
      }]
    },
    {
      titre:"Armure",
      lignes:[
        { emplacement:"Haut", nom:"Haut du chasseur",
          image:"7ds-armures-ssr/Haut/Haut du chasseur.webp",
          details:["Passif niveau 3", "ATK : 120"] },
        { emplacement:"Bas", nom:"", details:[] },
        { emplacement:"Bottes", nom:"", details:[] },
        { emplacement:"Ceinture", nom:"", details:[] },
        { emplacement:"Armure gravée", nom:"Épée & bouclier gravé", details:[] }
      ]
    },
    {
      titre:"Bijoux",
      lignes:[
        { emplacement:"Anneau", nom:"Anneau du loup",
          image:"7ds-bijoux/Anneau/Anneau du loup.webp", details:[] },
        { emplacement:"Collier", nom:"", details:[] },
        { emplacement:"Boucle d'oreille", nom:"", details:[] }
      ]
    }
  ]
};

const CARTE_NUE = {
  joueur:"Élodie",
  personnage:"Merlin",
  element:"",
  potentiel:0,
  arme:"Grimoire",
  portrait:"",
  note:"",
  fichier:"build-elodie-merlin-grimoire.png",
  sections:[
    { titre:"Arme", lignes:[{ emplacement:"Grimoire", nom:"", details:[] }] },
    { titre:"Armure", lignes:[] },
    { titre:"Bijoux", lignes:[] }
  ]
};

/* Les vignettes vivent dans un dossier ignore par git — la CI ne les a pas.
   Le rendu recoit donc son chargeur d'images : ce test lui en donne un qui
   fabrique des carres rouges, et compte ensuite le rouge dans le PNG. Si les
   images n'etaient pas posees, il n'y en aurait aucun. */
const SANS_IMAGES = { chargerImage:async () => null };
const ROUGE = [214, 40, 40];
function imageUnie(taille) {
  const pixels = Buffer.alloc(taille * taille * 4);
  for(let index = 0; index < taille * taille; index += 1){
    pixels[index * 4] = ROUGE[0];
    pixels[index * 4 + 1] = ROUGE[1];
    pixels[index * 4 + 2] = ROUGE[2];
    pixels[index * 4 + 3] = 255;
  }
  return { width:taille, height:taille, pixels };
}

function chargeurFactice(demandes) {
  return async chemin => {
    demandes.push(chemin);
    return imageUnie(chemin.startsWith("7ds-personnages/")
      ? MESURES.PORTRAIT : MESURES.ICONE);
  };
}

function comptePixels(png, couleur) {
  // Le PNG est encode : on le relit pour compter, plutot que de deviner.
  return decodePng(png).then(image => {
    let total = 0;
    for(let index = 0; index < image.pixels.length; index += 4){
      if(image.pixels[index] === couleur[0]
        && image.pixels[index + 1] === couleur[1]
        && image.pixels[index + 2] === couleur[2]) total += 1;
    }
    return total;
  });
}

(async () => {
  const fonts = await availabilityFonts();
  /* Le pied de page doit tenir dans la bande qui lui est reservee, sinon il
     sort du PNG et se retrouve coupe. */
  assert.ok(MESURES.HAUTEUR_PIED >= fonts.body.cellHeight + 20,
    "la bande du pied de page est trop courte pour la police");

  /* Les details sont dessines EN RETRAIT du nom de l'objet. S'ils sont
     mesures sans ce retrait, une ligne longue deborde du panneau : elle est
     coupee par le bord du PNG, et rien n'echoue pour le signaler. */
  const plan = mesurer({
    sections:[{ titre:"Arme", lignes:[{
      emplacement:"Epee a deux mains",
      nom:"Epee de la lune noire",
      details:[
        "Augmentation des dégâts d'attaque spéciale contre les boss : 12.5 %",
        "Niveau 50 · promotion 4 · dépassement 2"
      ]
    }] }]
  }, fonts);
  const droiteMaximale = MESURES.LARGEUR - MESURES.MARGE
    - MESURES.PADDING_PANNEAU;
  plan.sections[0].lignes[0].details.forEach(detail => {
    const droite = MESURES.COLONNE_TEXTE + MESURES.INDENT_DETAIL
      + largeurTexte(detail, fonts.body);
    assert.ok(droite <= droiteMaximale,
      "detail hors du panneau (" + Math.round(droite) + " > "
      + droiteMaximale + ") : " + detail);
  });
  /* Un panneau ne peut pas etre plus court que l'icone qu'il porte : elle
     deborderait sur le panneau suivant. */
  plan.sections[0].lignes.forEach(ligne => {
    assert.ok(ligne.hauteur >= MESURES.ICONE + 2 * MESURES.PADDING_PANNEAU,
      "panneau plus court que son icone : " + ligne.hauteur);
  });

  /* Les images sont bien demandees, et bien posees. */
  const demandes = [];
  const illustree = await generateBuildCardPng(CARTE_PLEINE, {
    chargerImage:chargeurFactice(demandes)
  });
  assert.ok(demandes.includes("7ds-personnages/ban.webp"),
    "le portrait du personnage doit etre demande");
  assert.ok(demandes.includes("7ds-armes/Nunchaku/Nunchaku du renard.webp"),
    "l'image de l'arme doit etre demandee");
  assert.equal(demandes.filter(chemin => chemin).length, demandes.length,
    "aucun chemin vide ne doit etre demande");
  assert.equal(demandes.length, 4,
    "un portrait, une arme, une piece d'armure, un bijou — pas les vides");
  const rouges = await comptePixels(illustree, ROUGE);
  /* Le compte exact serait la surface des quatre images ; le lisere dore du
     portrait et le filet des icones en recouvrent le bord, soit environ deux
     mille pixels. Le seuil laisse passer ces bordures, pas une image
     manquante — la plus petite pese 5 184 pixels. */
  const attendus = MESURES.PORTRAIT * MESURES.PORTRAIT
    + 3 * MESURES.ICONE * MESURES.ICONE;
  assert.ok(rouges >= attendus - 3000,
    "images manquantes sur la carte : " + rouges + " pixels pour "
    + attendus + " attendus");

  /* Une vignette introuvable ne doit pas priver le salon de la carte : le
     rendu continue, l'emplacement reste dessine sans image. */
  const sansImages = await generateBuildCardPng(CARTE_PLEINE, {
    chargerImage:async () => null
  });
  dimensions(sansImages);
  assert.equal(await comptePixels(sansImages, ROUGE), 0);

  const pleine = await generateBuildCardPng(CARTE_PLEINE, SANS_IMAGES);
  const tailleP = dimensions(pleine);
  assert.equal(tailleP.largeur, 1000, "une largeur fixe, lisible dans Discord");
  assert.ok(tailleP.hauteur > 400 && tailleP.hauteur < 2000,
    "hauteur hors de toute proportion : " + tailleP.hauteur);
  assert.ok(pleine.length > 2000, "image suspecte de vide : " + pleine.length);

  const nue = await generateBuildCardPng(CARTE_NUE, SANS_IMAGES);
  const tailleN = dimensions(nue);
  assert.equal(tailleN.largeur, 1000);
  assert.ok(tailleN.hauteur < tailleP.hauteur,
    "une carte sans equipement doit etre plus courte que la carte pleine");

  /* Une carte incomplete arrive quand le catalogue evolue plus vite que le
     roster : le rendu doit tenir, pas rendre l'image indisponible. */
  const bancale = await generateBuildCardPng({ arme:"Hache" }, SANS_IMAGES);
  dimensions(bancale);

  console.log("OK discord-build-png");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
