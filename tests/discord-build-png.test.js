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
  generateBuildCardPng, MESURES, largeurTexte, tronquer, mesurer,
  cartoucheJoueur, urlVignette, diagnostiquerVignette,
  chargerVignette, viderCacheVignettes
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

/* Le catalogue reel, et non une poignee de noms choisis : c'est la piece la
   plus longue du jeu qui decide si la colonne est assez large. */
function catalogueArmures() {
  const source = require("node:fs")
    .readFileSync(path.join(ROOT, "data", "data.js"), "utf8");
  const data = JSON.parse(
    source.replace(/^[\s\S]*?=\s*/, "").trim().replace(/;$/, "")
  );
  const noms = [];
  ["Haut", "Bas", "Bottes", "Ceinture"].forEach(emplacement => {
    (data.armures[emplacement] || []).forEach(objet => {
      const nom = objet.name || objet.nom || "";
      if(nom) noms.push(nom);
    });
  });
  return noms;
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
  role:"Attaquant",
  iconeArme:"7ds-ui/mastery/sword1h.webp",
  iconeRoleElement:"7ds-ui/role-elements/dark_attacker.webp",
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
              texte:"20.84 %", part:0.8 },
            { libelle:"Dégâts élémentaires", texte:"14.2 %", part:0.6 }
          ]
        }),
        ligne("Armure gravée", "Ami loyal", {
          image:"7ds-armures-ssr/Armure liee/Ami loyal.webp",
          details:["Passif niveau 3"],
          enchantements:[
            { libelle:"Dégâts critiques", texte:"18.4 %", part:0.72 },
            { libelle:"Attaque", texte:"12.1 %", part:0.55 },
            { libelle:"Compétence normale", texte:"23.8 %", part:0.85 }
          ]
        })
      ]
    },
    {
      titre:"Armure",
      disposition:"grille",
      lignes:[
        /* 43 des 99 pieces du jeu portent une sous-stat, et dix un passif :
           « Haut de l'œil de l'étoile sinistre » a les deux. */
        ligne("Haut", "Haut de l'œil de l'étoile sinistre", {
          image:"7ds-armures-ssr/Haut/Haut.webp",
          details:["Passif niveau 3"],
          enchantements:[
            { libelle:"Chances crit.", texte:"5.64 %", part:0.5 }
          ]
        }),
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
          enchantements:[{
            libelle:"Augmentation des dégâts de tous les éléments",
            texte:"12.05 %", part:0.6
          }]
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
      ? MESURES.PORTRAIT
      : chemin.startsWith("7ds-ui/") ? MESURES.IDENTITE : MESURES.ICONE);
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
  assert.equal(MESURES.IDENTITE, 64,
    "les icones d'identite gardent leur finesse a leur taille native");

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
  assert.equal(taille.hauteur, 1010,
    "un build complet garde le format de la maquette");
  assert.ok(taille.hauteur < taille.largeur,
    "la carte doit rester plus large que haute : " + taille.largeur + " x "
    + taille.hauteur);

  const sansRole = await generateBuildCardPng(
    Object.assign({}, CARTE, { role:"" }), SANS_IMAGES);
  assert.notDeepEqual(png, sansRole,
    "le role du slot d'arme doit etre visible dans la fiche");

  const autreValeurBijou = JSON.parse(JSON.stringify(CARTE));
  autreValeurBijou.sections.find(section => section.titre === "Bijoux")
    .lignes[0].enchantements[0].texte = "99.99 %";
  assert.notDeepEqual(png,
    await generateBuildCardPng(autreValeurBijou, SANS_IMAGES),
    "la valeur d'une stat de bijou reste visible meme si son libelle est long");

  /* La rangee du libelle d'une jauge doit contenir la police, sinon le texte
     descend sur la barre dessinee juste dessous. */
  assert.ok(MESURES.HAUTEUR_JAUGE_TITRE >= fonts.petit.cellHeight,
    "le libelle d'une jauge deborde sur son trait : "
    + MESURES.HAUTEUR_JAUGE_TITRE + " px pour une police de "
    + fonts.petit.cellHeight);

  /* Rien ne doit deborder de sa colonne. Le jour ou un nom deborde, il se
     dessine par-dessus la colonne voisine sans que rien n'echoue. */
  const plan = mesurer(CARTE, fonts);
  assert.ok(Number.isFinite(plan.separateurSections),
    "le plan doit fixer un repere commun aux deux colonnes");
  assert.equal(plan.hauteurArmure + MESURES.ESPACE_BLOC,
    plan.separateurSections,
    "la separation centrale et le debut des bijoux doivent etre alignes");
  const margeSousArme = plan.separateurSections
    - MESURES.DEBUT_CONTENU_SECTION - plan.milieu[0].hauteur;
  assert.ok(margeSousArme >= 16,
    "la derniere jauge de l'arme doit respirer avant le separateur");
  const finBijoux = MESURES.DEBUT_CONTENU_SECTION
    + plan.bijoux.reduce((total, ligne) => total + ligne.hauteur
      + MESURES.ESPACE_LIGNE_LISTE, 0);
  assert.ok(plan.hauteurBijoux - finBijoux >= 16,
    "la derniere jauge des bijoux doit respirer avant le cadre");
  const sansJaugeBijou = JSON.parse(JSON.stringify(CARTE));
  sansJaugeBijou.sections.find(section => section.titre === "Bijoux")
    .lignes.forEach(entree => { entree.enchantements = []; });
  assert.equal(plan.hauteurBijoux, mesurer(sansJaugeBijou, fonts).hauteurBijoux,
    "une stat de bijou tient dans sa ligne sans allonger toute la carte");
  const largeurBloc = MESURES.COLONNE_MILIEU - 2 * MESURES.PADDING
    - MESURES.ICONE - 20;
  plan.milieu.forEach(bloc => {
    bloc.nom.concat(bloc.details).forEach(morceau => {
      assert.ok(atlasStringWidthExact(morceau, fonts.corps) <= largeurBloc,
        "hors de la colonne du milieu : " + morceau);
    });
  });
  const largeurArmure = MESURES.COLONNE_DROITE - 2 * MESURES.PADDING
    - MESURES.ICONE - 18;
  plan.armure.forEach(entree => {
    assert.ok(entree.nom.length <= 2,
      "une ligne d'armure ne s'etale pas sans fin : " + entree.nom.length);
    entree.nom.forEach(morceau => {
      assert.ok(atlasStringWidthExact(morceau, fonts.corps) <= largeurArmure,
        "hors de sa colonne : " + morceau);
    });
  });

  /* LE CATALOGUE ENTIER DOIT S'AFFICHER EN ENTIER. En grille de deux cases,
     l'icone prenait 80 des 268 px d'une demi-colonne : il restait une
     trentaine de caracteres pour des noms qui en font quarante, et le reste
     etait jete en silence. « Bottes de combat de la mélodie d'Arachnée »
     devenait « Bottes de combat de la », qui ressemble a un vrai nom sans en
     etre un — le membre lit une piece et en equipe une autre. Ce qui
     distingue deux pieces d'un meme ensemble est toujours a la FIN du nom. */
  const armures = catalogueArmures();
  assert.ok(armures.length > 40,
    "le catalogue doit etre lu, sinon ce test ne prouve rien : "
    + armures.length);
  const carteCatalogue = JSON.parse(JSON.stringify(CARTE));
  carteCatalogue.sections.find(section => section.titre === "Armure").lignes =
    armures.map(nom => ligne("Haut", nom));
  const planCatalogue = mesurer(carteCatalogue, fonts);
  planCatalogue.armure.forEach((entree, rang) => {
    assert.equal(entree.nom.join(" "), texteCarte(armures[rang]),
      "nom d'armure ampute : « " + entree.nom.join(" ") + " » au lieu de « "
      + armures[rang] + " »");
  });

  /* UNE PIECE D'ARMURE PORTE UNE SOUS-STAT, et un passif. Le modele les
     calcule depuis le roster ; la section les jetait, parce que la grille de
     deux cases n'avait la place ni de l'une ni de l'autre. Le membre voyait
     un nom d'objet la ou le jeu montre un taux critique. */
  assert.equal(plan.armure[0].jauges.length, 1,
    "la sous-stat d'une piece doit arriver jusqu'au dessin");
  assert.deepEqual(plan.armure[0].details, ["Passif niveau 3"],
    "le palier du passif grave doit arriver jusqu'au dessin");
  /* L'entete d'une rangee est une MESURE, pas une decision du trace : la
     sous-stat ne doit reserver que la place qu'elle occupe, sinon le passif
     sort en « Passif nivea… » alors que la rangee est aux deux tiers vide. */
  /* « Haut de l'œil de l'étoile sinistre » porte deja son emplacement : la
     rangee ne le repete pas, mais le passif, lui, ne se lit nulle part
     ailleurs. */
  assert.equal(plan.armure[0].entete, "Passif niveau 3",
    "le palier du passif se lit en entier, sans repeter l'emplacement");
  assert.equal(plan.armure[1].entete, "",
    "sans passif, un nom qui porte son emplacement n'a pas d'entete");
  const armureNue = JSON.parse(JSON.stringify(CARTE));
  armureNue.sections.find(section => section.titre === "Armure")
    .lignes.forEach(entree => { entree.enchantements = []; });
  const orAvecSousStat = await comptePixels(
    await generateBuildCardPng(CARTE, SANS_IMAGES), MESURES.OR_BARRE);
  const orSansSousStat = await comptePixels(
    await generateBuildCardPng(armureNue, SANS_IMAGES), MESURES.OR_BARRE);
  assert.ok(orAvecSousStat - orSansSousStat > 500,
    "la barre de la sous-stat doit se dessiner : " + orAvecSousStat
    + " contre " + orSansSousStat);

  /* LE LIBELLE DE LA SOUS-STAT PREND LA PLACE LAISSEE LIBRE. Il etait plafonne
     a 58 % de la rangee quoi qu'il arrive, si bien que « Résistance au
     percement » sortait « Résistance au perce… » a cote d'un « Anneau » de
     69 px qui laissait la moitie de la rangee vide. L'emplacement prend ce
     qu'il lui faut, le libelle recupere le reste. */
  const bijouLibelle = JSON.parse(JSON.stringify(CARTE));
  bijouLibelle.sections.find(section => section.titre === "Bijoux").lignes = [
    ligne("Anneau", "Anneau du souverain cupide", {
      enchantements:[
        { libelle:"Efficacité de la durée des bonus", texte:"11.78 %",
          part:0.5 }
      ]
    })
  ];
  const rangeeLibelle = mesurer(bijouLibelle, fonts).bijoux[0];
  assert.equal(rangeeLibelle.libelleJauge, "Efficacité de la durée des bonus",
    "un libelle de 271 px doit tenir dans sa rangee");

  /* L'EMPLACEMENT NE SE REPETE PAS. Les 99 pieces et bijoux du jeu commencent
     par le nom de leur emplacement : « Anneau » au-dessus de « Anneau du
     souverain cupide » n'apprend rien et prend la place de la statistique. */
  assert.equal(rangeeLibelle.entete, "",
    "un nom qui porte deja son emplacement rend la rangee a la statistique");

  /* Mais un emplacement VIDE garde le sien : « Aucun » tout seul ne dirait pas
     de quel bijou il s'agit — et c'est justement ce qu'un membre vient
     verifier. */
  const bijouVide = JSON.parse(JSON.stringify(bijouLibelle));
  bijouVide.sections.find(section => section.titre === "Bijoux")
    .lignes[0] = ligne("Collier", "");
  assert.equal(mesurer(bijouVide, fonts).bijoux[0].entete, "Collier");

  /* Et le passif reste, lui : il ne se lit nulle part ailleurs. */
  const bijouPassif = JSON.parse(JSON.stringify(bijouLibelle));
  bijouPassif.sections.find(section => section.titre === "Bijoux")
    .lignes[0].details = ["Passif niveau 3"];
  assert.equal(mesurer(bijouPassif, fonts).bijoux[0].entete, "Passif niveau 3");

  /* Un objet qui ne porterait pas son emplacement le garderait : la regle
     s'appuie sur le nom, pas sur une promesse du catalogue. */
  const bijouAutre = JSON.parse(JSON.stringify(bijouLibelle));
  bijouAutre.sections.find(section => section.titre === "Bijoux")
    .lignes[0].nom = "Talisman du serment";
  assert.equal(mesurer(bijouAutre, fonts).bijoux[0].entete, "Anneau");

  /* Mais l'emplacement ne disparait pas pour autant : le plus bavard des
     libelles du jeu — 425 px — ne peut pas lui prendre toute la rangee. */
  const bijouBavard = JSON.parse(JSON.stringify(bijouLibelle));
  bijouBavard.sections.find(section => section.titre === "Bijoux")
    .lignes[0].enchantements[0].libelle =
      "Augmentation de toutes les attaques élémentaires";
  const rangeeBavarde = mesurer(bijouBavard, fonts).bijoux[0];
  assert.equal(rangeeBavarde.entete, "",
    "le nom portant deja l'emplacement, toute la rangee va au libelle");
  assert.ok(rangeeBavarde.libelleJauge.endsWith("…"),
    "ce libelle-la ne tient dans aucune largeur : il porte sa marque");

  /* Un bijou trop long ne se raccourcit plus non plus : deux des 37 du jeu
     depassent la colonne, ils passent a la ligne comme une armure. */
  const bijouLong = JSON.parse(JSON.stringify(CARTE));
  bijouLong.sections.find(section => section.titre === "Bijoux").lignes = [
    ligne("Boucle d'oreille",
      "Boucles d'oreilles des 100 jours (jamais portées)")
  ];
  const rangeeBijou = mesurer(bijouLong, fonts).bijoux[0];
  assert.deepEqual(rangeeBijou.nom.join(" "),
    texteCarte("Boucles d'oreilles des 100 jours (jamais portées)"),
    "un nom de bijou passe a la ligne au lieu d'etre ampute");

  /* Le garde-fou reste : un nom qu'aucune largeur ne peut porter se raccourcit
     avec sa marque, jamais en silence. */
  const NOM_IMPOSSIBLE = "Bottes de combat de la mélodie d'Arachnée "
    + "du cauchemar ressuscité du souverain cupide";
  const carteImpossible = JSON.parse(JSON.stringify(CARTE));
  carteImpossible.sections.find(section => section.titre === "Armure")
    .lignes = [ligne("Bottes", NOM_IMPOSSIBLE)];
  const caseImpossible = mesurer(carteImpossible, fonts).armure[0];
  assert.ok(caseImpossible.nom.length <= 2,
    "une ligne d'armure ne s'etale pas sans fin : " + caseImpossible.nom.length);
  const nomRendu = caseImpossible.nom.join(" ");
  assert.ok(nomRendu.endsWith("…"),
    "un nom raccourci doit porter sa marque de coupe : « " + nomRendu + " »");
  assert.ok(texteCarte(NOM_IMPOSSIBLE).startsWith(nomRendu.slice(0, -1)),
    "un nom raccourci reste un debut du vrai nom : « " + nomRendu + " »");

  /* Le cartouche sous le portrait nomme le joueur : la commande s'appelle
     `/build <joueur>`, et « Portrait » ne nommait que l'evidence. */
  assert.equal(typeof cartoucheJoueur, "function",
    "le texte du cartouche est une decision, pas un litteral du dessin");
  assert.equal(cartoucheJoueur(CARTE, fonts), "YanniSs13");
  assert.equal(cartoucheJoueur({}, fonts), "",
    "sans joueur, le cartouche n'invente rien");
  /* Un pseudo Discord monte a 32 caracteres : sans garde-fou il passe
     par-dessus les filets qui l'encadrent. */
  const pseudoLong = cartoucheJoueur({ joueur:"M".repeat(32) }, fonts);
  assert.ok(atlasStringWidthExact(pseudoLong, fonts.petit)
    <= MESURES.LARGEUR_CARTOUCHE,
    "un pseudo long doit tenir entre ses filets : " + pseudoLong);
  assert.ok(pseudoLong.endsWith("…"),
    "un pseudo raccourci doit porter sa marque de coupe : " + pseudoLong);

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

  /* LE DIAGNOSTIC DES VIGNETTES. Quand une carte sort avec des cadres vides,
     rien sur l'image ne dit pourquoi : le code s'en tient a un cadre plutot
     qu'a une carte perdue, ce qui est bien, mais laisse la cause invisible.
     Ce sondage rejoue le meme chemin — meme URL, meme decodage — et rapporte
     ce que le runtime a REELLEMENT vu. */
  assert.equal(typeof diagnostiquerVignette, "function");
  const url = urlVignette("7ds-personnages/meliodas.webp");
  assert.match(url, /^https:\/\/[^/]+\/NOVA\/7ds-vignettes\//,
    "la vignette se lit sur le site publie : " + url);
  assert.ok(url.endsWith("meliodas.png"),
    "les vignettes sont des PNG : le webp ne se decode pas ici");

  const png80 = await generateBuildCardPng(CARTE, SANS_IMAGES);
  const sonde = await diagnostiquerVignette("7ds-personnages/meliodas.webp",
    async () => ({ ok:true, status:200,
      arrayBuffer:async () => png80.buffer.slice(png80.byteOffset,
        png80.byteOffset + png80.byteLength) }));
  assert.equal(sonde.statut, 200);
  assert.equal(sonde.octets, png80.byteLength,
    "le sondage doit rapporter la taille reellement recue");
  assert.equal(sonde.decode, true, "un PNG valide doit se decoder");
  assert.equal(sonde.url, url);

  const sondeRatee = await diagnostiquerVignette("7ds-personnages/x.webp",
    async () => { throw new Error("dns"); });
  assert.match(sondeRatee.erreur, /dns/,
    "une panne reseau doit etre rapportee telle quelle, pas avalee");
  const sonde404 = await diagnostiquerVignette("7ds-personnages/x.webp",
    async () => ({ ok:false, status:404 }));
  assert.equal(sonde404.statut, 404);
  assert.equal(sonde404.decode, false);

  /* LE CHARGEUR REEL, celui que la production emploie. Tous les autres tests
     lui substituent le leur — c'est ce qui rend le rendu verifiable sans
     reseau, et c'est aussi ce qui a laisse passer une variable de cache jamais
     declaree : chaque chargement levait une ReferenceError, avalee par le
     `try` qui protege les vignettes manquantes. Les cartes sortaient avec tous
     leurs cadres vides, en silence, pendant que les URL repondaient 200. */
  const vraiFetch = globalThis.fetch;
  let appels = 0;
  globalThis.fetch = async () => {
    appels += 1;
    return { ok:true, status:200,
      arrayBuffer:async () => png.buffer.slice(png.byteOffset,
        png.byteOffset + png.byteLength) };
  };
  try {
    viderCacheVignettes();
    const chargee = await chargerVignette("7ds-personnages/meliodas.webp");
    assert.ok(chargee && chargee.width > 0,
      "le chargeur de production doit rendre une image");
    assert.equal(appels, 1);

    /* Le cache evite de retelecharger la meme vignette sur une seconde carte. */
    await chargerVignette("7ds-personnages/meliodas.webp");
    assert.equal(appels, 1, "la seconde demande doit venir du cache");

    /* Mais un echec ne se grave pas : l'isolat survit d'un appel a l'autre, et
       un 404 passager condamnait toutes les cartes suivantes. */
    globalThis.fetch = async () => ({ ok:false, status:404 });
    assert.equal(await chargerVignette("7ds-personnages/absent.webp"), null);
    globalThis.fetch = async () => {
      appels += 1;
      return { ok:true, status:200,
        arrayBuffer:async () => png.buffer.slice(png.byteOffset,
          png.byteOffset + png.byteLength) };
    };
    assert.ok(await chargerVignette("7ds-personnages/absent.webp"),
      "apres un echec, la vignette doit etre redemandee");
  } finally {
    globalThis.fetch = vraiFetch;
    viderCacheVignettes();
  }

  /* Les images sont bien demandees, et bien posees. */
  const demandes = [];
  const illustree = await generateBuildCardPng(CARTE, {
    chargerImage:chargeurFactice(demandes)
  });
  assert.ok(demandes.includes("7ds-personnages/meliodas.webp"),
    "le portrait du personnage doit etre demande");
  assert.ok(demandes.includes("7ds-ui/mastery/sword1h.webp"));
  assert.ok(demandes.includes("7ds-ui/role-elements/dark_attacker.webp"));
  assert.equal(demandes.length, 7,
    "portrait, deux icones d'identite et quatre objets illustres");
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
