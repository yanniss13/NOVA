"use strict";

/* La carte PNG de /build. On ne compare pas des pixels un a un : on verifie
   que le PNG est un PNG, qu'il tient dans les proportions voulues, que rien ne
   deborde de sa colonne, que les images sont posees, et qu'aucun build
   incomplet ne fait tomber le rendu — un membre peut avoir equipe une arme
   sans jamais ouvrir l'editeur. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const partage = nom => path.join(
  ROOT, "supabase", "functions", "_shared", nom
);
require(partage("availability-font.js"));
require(partage("carte-font.js"));
const {
  RasterCanvas, encodePng, chargerAtlasCarte, atlasStringWidthExact
} = require(partage("availability-pdf.js"));
const {
  generateBuildCardPng, MESURES, largeurTexte, tronquer, mesurer
} = require(partage("discord-build-png.js"));
const { decodePng } = require(partage("png-decode.js"));
const { texteCarte } = require(partage("discord-build.js"));

assert.equal(typeof RasterCanvas, "function",
  "le rendu de la carte reutilise la surface de dessin du planning");
assert.equal(typeof encodePng, "function");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function dimensions(png) {
  assert.ok(png.subarray(0, 8).equals(SIGNATURE), "signature PNG absente");
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  return { largeur:png.readUInt32BE(16), hauteur:png.readUInt32BE(20) };
}

function ligne(emplacement, nom, extra) {
  return Object.assign({
    emplacement, nom, image:"", mesures:[], details:[], enchantements:[]
  }, extra || {});
}

const CARTE = {
  joueur:"YanniSs13",
  personnage:"Méliodas",
  element:"Ténèbres",
  potentiel:10,
  arme:"Épée à une main",
  portrait:"7ds-personnages/meliodas.webp",
  note:"Build de raid : garder la perle légendaire sur le taux critique.",
  fichier:"build-yanniss13-meliodas-epee-a-une-main.png",
  sections:[
    {
      titre:"Arme",
      disposition:"colonne",
      lignes:[
        ligne("Épée à une main", "En plein cœur !", {
          image:"7ds-armes/Epee 1 main/En plein coeur.webp",
          mesures:[
            { libelle:"Niveau", valeur:50, maximum:50, forme:"barre" },
            { libelle:"Outrepassement", valeur:6, maximum:6, forme:"etoile" }
          ],
          details:["Perle légendaire"],
          enchantements:[
            { libelle:"Attaque de l'équipement", texte:"95", part:0.35 },
            { libelle:"Augmentation des dégâts d'attaque spéciale",
              texte:"20.84 %", part:0.8 }
          ]
        }),
        ligne("Armure gravée", "Ami loyal", {
          image:"7ds-armures-ssr/Armure liee/Ami loyal.webp",
          details:["Passif niveau 3"]
        })
      ]
    },
    {
      titre:"Armure",
      disposition:"grille",
      lignes:[
        ligne("Haut", "Haut de l'œil de l'étoile sinistre",
          { image:"7ds-armures-ssr/Haut/Haut.webp" }),
        ligne("Bas", "Bas de la mélodie d'Arachnée"),
        ligne("Bottes", ""),
        ligne("Ceinture", "Ceinture de la mélodie d'Arachnée")
      ]
    },
    {
      titre:"Bijoux",
      disposition:"liste",
      lignes:[
        ligne("Anneau", "Anneau de la mélodie d'Arachnée", {
          image:"7ds-bijoux/Anneau/Anneau.webp",
          enchantements:[{ libelle:"Dégâts crit.", texte:"12.05 %", part:0.6 }]
        }),
        ligne("Collier", ""),
        ligne("Boucle d'oreille", "Boucles d'oreilles de la mélodie d'Arachnée")
      ]
    }
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
  const fonts = await chargerAtlasCarte();

  /* LA CARTE ECRIT EN MINUSCULES ACCENTUEES. C'est la raison d'etre de son
     atlas separe : sans lui, « Dégâts crit. » redeviendrait « DEGATS CRIT. ».
     Le test le verifie sur les glyphes, pas sur une intention. */
  assert.equal(texteCarte("Dégâts crit."), "Dégâts crit.");
  ["é", "è", "à", "ç", "œ", "É", "%", "&", "…"].forEach(caractere => {
    assert.ok(fonts.corps.characters.includes(caractere),
      "l'atlas de la carte doit porter « " + caractere + " »");
    assert.ok(atlasStringWidthExact(caractere, fonts.corps) > 0,
      "« " + caractere + " » doit avoir une avance non nulle");
  });

  /* LA CARTE EST EN PAYSAGE : Discord fait tenir l'image dans le message, et
     une carte plus haute que large arrive minuscule. */
  const png = await generateBuildCardPng(CARTE, SANS_IMAGES);
  const taille = dimensions(png);
  assert.equal(taille.largeur, MESURES.LARGEUR);
  assert.ok(taille.hauteur < taille.largeur,
    "la carte doit rester plus large que haute : " + taille.largeur + " x "
    + taille.hauteur);

  /* La rangee du libelle d'une jauge doit contenir la police, sinon le texte
     descend sur la barre dessinee juste dessous. */
  assert.ok(MESURES.HAUTEUR_JAUGE_TITRE >= fonts.corps.cellHeight,
    "le libelle d'une jauge deborde sur son trait : "
    + MESURES.HAUTEUR_JAUGE_TITRE + " px pour une police de "
    + fonts.corps.cellHeight);

  /* Rien ne doit deborder de sa colonne. Le jour ou un nom deborde, il se
     dessine par-dessus la colonne voisine sans que rien n'echoue. */
  const plan = mesurer(CARTE, fonts);
  const largeurBloc = MESURES.COLONNE_MILIEU - 2 * MESURES.PADDING
    - MESURES.ICONE - 20;
  plan.milieu.forEach(bloc => {
    bloc.nom.concat(bloc.details).forEach(morceau => {
      assert.ok(atlasStringWidthExact(morceau, fonts.corps) <= largeurBloc,
        "hors de la colonne du milieu : " + morceau);
    });
  });
  const largeurCase = (MESURES.COLONNE_DROITE - 2 * MESURES.PADDING - 12) / 2
    - MESURES.ICONE - 16;
  plan.armure.forEach(entree => {
    assert.ok(entree.nom.length <= 2,
      "une case de la grille ne tient que deux lignes : " + entree.nom.length);
    entree.nom.forEach(morceau => {
      assert.ok(atlasStringWidthExact(morceau, fonts.corps) <= largeurCase,
        "hors de sa case : " + morceau);
    });
  });

  /* Un libelle trop long se raccourcit au lieu de se dessiner par-dessus sa
     valeur — il partage sa rangee avec elle. */
  const long = "Augmentation des dégâts d'attaque spéciale";
  const place = 260;
  assert.ok(largeurTexte(long, fonts.corps) > place,
    "ce libelle doit bien etre trop long pour que le test ait un sens");
  assert.ok(
    atlasStringWidthExact(tronquer(long, fonts.corps, place), fonts.corps)
      <= place, "le libelle doit tenir dans la place laissee par sa valeur");
  assert.equal(tronquer("ATK", fonts.corps, place), "ATK",
    "un libelle qui tient n'est pas touche");

  /* L'or est la couleur de tout ce qui est acquis : etoiles pleines et
     portions remplies. Sans un pixel dore, la carte n'est qu'une liste de
     nombres. */
  const carteNue = {
    personnage:"Merlin",
    sections:[{ titre:"Arme", disposition:"colonne",
      lignes:[ligne("Grimoire", "Grimoire")] }]
  };
  const avecJauges = {
    personnage:"Merlin",
    sections:[{ titre:"Arme", disposition:"colonne", lignes:[
      ligne("Grimoire", "Grimoire", {
        mesures:[
          { libelle:"Niveau", valeur:50, maximum:50, forme:"barre" },
          { libelle:"Outrepassement", valeur:6, maximum:6, forme:"etoile" }
        ]
      })
    ] }]
  };
  const orSans = await comptePixels(
    await generateBuildCardPng(carteNue, SANS_IMAGES), MESURES.OR);
  const orAvec = await comptePixels(
    await generateBuildCardPng(avecJauges, SANS_IMAGES), MESURES.OR);
  assert.ok(orAvec - orSans > 400,
    "jauges absentes de la carte : " + orAvec + " contre " + orSans);

  /* Une part inconnue ne dessine AUCUNE barre : une barre remplie au hasard
     mentirait sur la qualite du tirage. */
  const partConnue = {
    personnage:"Merlin",
    sections:[{ titre:"Arme", disposition:"colonne", lignes:[
      ligne("Grimoire", "Grimoire",
        { enchantements:[{ libelle:"ATK", texte:"340", part:1 }] })
    ] }]
  };
  const partInconnue = {
    personnage:"Merlin",
    sections:[{ titre:"Arme", disposition:"colonne", lignes:[
      ligne("Grimoire", "Grimoire",
        { enchantements:[{ libelle:"ATK", texte:"340", part:null }] })
    ] }]
  };
  const orPart = await comptePixels(
    await generateBuildCardPng(partConnue, SANS_IMAGES), MESURES.OR_BARRE);
  const orSansPart = await comptePixels(
    await generateBuildCardPng(partInconnue, SANS_IMAGES), MESURES.OR_BARRE);
  assert.ok(orPart - orSansPart > 2000,
    "une part connue doit remplir sa barre : " + orPart + " contre "
    + orSansPart);

  /* Les images sont bien demandees, et bien posees. */
  const demandes = [];
  const illustree = await generateBuildCardPng(CARTE, {
    chargerImage:chargeurFactice(demandes)
  });
  assert.ok(demandes.includes("7ds-personnages/meliodas.webp"),
    "le portrait du personnage doit etre demande");
  assert.equal(demandes.length, 5,
    "un portrait, une arme, une gravee, une piece d'armure, un bijou");
  const rouges = await comptePixels(illustree, ROUGE);
  /* Le filet de chaque cadre recouvre le bord de son image : le seuil laisse
     passer ces bordures, pas une image manquante — la plus petite pese 6 400
     pixels. */
  const attendus = MESURES.PORTRAIT * MESURES.PORTRAIT
    + 4 * MESURES.ICONE * MESURES.ICONE;
  assert.ok(rouges >= attendus - 3000,
    "images manquantes : " + rouges + " pixels pour " + attendus + " attendus");
  assert.equal(await comptePixels(png, ROUGE), 0,
    "une vignette introuvable ne doit rien poser du tout");

  /* Une carte incomplete arrive quand le catalogue evolue plus vite que le
     roster : le rendu doit tenir, pas rendre l'image indisponible. */
  dimensions(await generateBuildCardPng({ arme:"Hache" }, SANS_IMAGES));
  dimensions(await generateBuildCardPng({}, SANS_IMAGES));

  console.log("OK discord-build-png");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
