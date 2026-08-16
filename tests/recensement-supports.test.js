"use strict";

/* Les deux recensements de l'Analyse : ce qui affaiblit la cible, ce qui
   renforce les allies. Quelles lignes ils montrent, et qui les possede.

   Ce que ce fichier garde, et que rien d'autre ne garde :

   1. LE CRITERE EST L'EFFET TRANSCRIT, JAMAIS LE ROLE DE SLOT. Escanor porte
      son malus de defense avec une Epee a deux mains de role Attaquant ; King
      avec un Grimoire de role Gardien. Un recensement fonde sur le role les
      manquerait tous les deux, et c'est ce qui a motive la premiere section.

   2. DEUX SOURCES, DEUX REGLES DE POSSESSION. Une ligne d'arme se possede par
      le couple personnage + arme ; une ligne de tenue gravee par le fichier
      d'armure REELLEMENT EQUIPE dans un build. Les confondre annoncerait des
      porteurs qui ne peuvent rien apporter.

   3. UN PASSIF GRAVE DE CIBLE « soi » N'EST DANS AUCUNE DES DEUX SECTIONS. Il
      ne profite qu'a celui qui porte la tenue, donc il ne dit rien de ce que
      le membre apporte au groupe. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { lignesDeSoutien, porteursDeLaLigne, buffsApplicables } = hooks;

assert.equal(typeof lignesDeSoutien, "function",
  "lignesDeSoutien doit etre expose par le chargeur de tests");
assert.equal(typeof porteursDeLaLigne, "function",
  "porteursDeLaLigne doit etre expose par le chargeur de tests");

const lignes = lignesDeSoutien();
const parId = id => lignes.find(ligne => ligne.id === id);
const contre = camp => lignes.filter(ligne => ligne.vise === camp);

/* ---- Les deux camps existent, et aucune ligne n'echappe au classement ---- */
assert.ok(contre("ennemi").length > 0, "des lignes doivent viser l'ennemi");
assert.ok(contre("allies").length > 0, "des lignes doivent viser les allies");
assert.equal(contre("ennemi").length + contre("allies").length, lignes.length,
  "toute ligne vise un camp, et un seul");

/* ---- 1. Le critere est l'effet, pas le role ---- */
const escanor = parId("escanor-inflammation-defense");
assert.ok(escanor,
  "Escanor doit figurer : son Epee a deux mains est de role Attaquant, et "
    + "c'est justement le cas qui interdit de filtrer par role");
assert.equal(escanor.vise, "ennemi");
assert.equal(escanor.source, "arme");
assert.equal(escanor.arme, "Sword2h");
assert.equal(escanor.armeDossier, "Epee 2 mains");

assert.ok(parId("king-marque-degats-subis"),
  "King debuffe avec un Grimoire de role Gardien : lui aussi doit figurer");

/* Un bonus rendu aux allies vit desormais dans la SECONDE section - il n'a
   jamais dit ce que la cible encaisse, et il ne le dit toujours pas. */
const reveil = parId("daisy-reveil-degats-crit");
assert.ok(reveil, "un bonus aux allies doit figurer au recensement");
assert.equal(reveil.vise, "allies",
  "un bonus rendu aux allies ne dit rien de ce que la cible encaisse");

/* La zone de Manny, l'exemple qui a motive la seconde section. */
const manny = parId("manny-pretresse-degats-crit");
assert.ok(manny, "le bonus de degats crit. de Manny doit figurer");
assert.equal(manny.vise, "allies");
assert.equal(manny.arme, "Staff");

/* ---- 2. Les tenues gravees ---- */
const tenues = lignes.filter(ligne => ligne.source === "tenue");
assert.ok(tenues.length >= 23,
  "les tenues gravees doivent apporter leurs lignes, recu " + tenues.length);

/* Howzer : l'exemple cite par le proprietaire, et un MALUS malgre sa source.
   Sa place est du cote « ennemi », parce qu'une section se definit par son
   effet et non par la piece d'ou il vient. */
const howzer = parId("howzer-aventure-securite-defense-crit");
assert.ok(howzer, "la tenue de Howzer doit figurer au recensement");
assert.equal(howzer.vise, "ennemi",
  "une tenue qui reduit la defense crit. de l'ennemi affaiblit la cible");
assert.equal(howzer.source, "tenue");
assert.equal(howzer.tenueNom, "Aventure en toute sécurité",
  "le nom lisible d'une tenue est son fichier, sans dossier ni extension");
assert.equal(howzer.support, "howzer",
  "le personnage d'une tenue se lit dans la table des armures liees");

/* Une tenue qui renforce, pour le cas symetrique. */
const merlin = parId("merlin-chercheuse-attaque-feu");
assert.ok(merlin, "les tenues qui renforcent doivent figurer aussi");
assert.equal(merlin.vise, "allies");
assert.equal(merlin.support, "merlin");

/* ---- 3. Les passifs qui ne profitent qu'a leur porteur restent dehors ---- */
{
  const catalogue = plain(hooks.SEVEN_DS_PASSIFS_GRAVES || {});
  const soi = Object.values(catalogue).flat()
    .filter(passif => passif.cible === "soi");
  assert.ok(soi.length > 0, "la table doit porter des passifs de cible « soi »");
  const recenses = new Set(lignes.map(ligne => ligne.id));
  soi.forEach(passif => assert.ok(!recenses.has(passif.id),
    passif.id + " : un passif qui ne profite qu'a son porteur ne dit rien de "
      + "ce que le membre apporte au groupe"));
}

/* ---- L'arme est celle du gameId, PAS la premiere du personnage ----

   Drake porte Epee 2 mains, Baton, Epee 1 main dans cet ordre. Son malus vient
   du Baton : afficher sa premiere arme serait une ligne fausse, et le membre
   irait monter la mauvaise. */
const drake = parId("drake-courant-electrique-defense-crit");
assert.equal(drake.arme, "Staff",
  "l'arme affichee doit venir du gameId, pas de l'ordre des slots du perso");
assert.equal(drake.armeDossier, "Baton");

/* Les deux orthographes de Gil Thunder, sur deux armes differentes. */
assert.equal(parId("gil-thunder-paralysie-resistance-foudre").arme, "Lance");
assert.equal(parId("gil-thunder-barriere-resistance-foudre").arme, "Shield");
assert.equal(parId("gil-thunder-deluge-resistance-foudre").arme, "Sword1h");

/* Aucune ligne sans origine lisible : elle ne trouverait aucun porteur, donc
   s'afficherait grise a tort et pour toujours. */
lignes.forEach(ligne => assert.ok(
  ligne.source === "tenue" ? ligne.tenue : ligne.arme,
  ligne.id + " : ni arme ni tenue lisible"));

/* ---- Les lignes consignees : presentes ici, absentes du calculateur ---- */
const consignees = lignes.filter(ligne => ligne.horsCalcul);
assert.equal(consignees.length, 4,
  "les quatre lignes de resistance a la Foudre doivent figurer au recensement");
const proposees = new Set(buffsApplicables("thunder").map(buff => buff.id));
consignees.forEach(ligne => assert.ok(!proposees.has(ligne.id),
  ligne.id + " : consignee au recensement, elle ne doit jamais etre proposee "
    + "en case a cocher du calculateur"));

/* ---- La possession par l'ARME : le personnage ET l'arme ---- */
const YANNIS = {
  owner:"u-1",
  name:"Yannis",
  characters:[
    { charId:"escanor", potentialTier:8, builds:{ "Epee 2 mains":{} } },
    /* Il a Drake, mais a l'Epee 1 main : son Baton n'est pas monte, donc il
       n'apporte PAS le Courant electrique. */
    { charId:"drake", potentialTier:5, builds:{ "Epee 1 main":{} } }
  ]
};
const MARC = {
  owner:"u-2",
  name:"Marc",
  characters:[
    { charId:"escanor", potentialTier:10, builds:{ "Epee 2 mains":{}, "Hache":{} } }
  ]
};

assert.deepEqual(plain(porteursDeLaLigne(escanor, [YANNIS, MARC])), [
  { owner:"u-2", nom:"Marc", potentiel:10, niveau:null },
  { owner:"u-1", nom:"Yannis", potentiel:8, niveau:null }
], "les porteurs se lisent du meilleur potentiel au moins bon");

assert.deepEqual(plain(porteursDeLaLigne(drake, [YANNIS, MARC])), [],
  "posseder le personnage sans l'arme qui porte l'effet n'est pas le posseder");

/* Une ligne d'arme ne rend jamais de niveau : il n'y en a pas, et en inventer
   un ferait afficher « N1 » a cote de chaque nom. */
porteursDeLaLigne(escanor, [YANNIS]).forEach(p => assert.equal(p.niveau, null));

/* ---- La possession par la TENUE : le fichier reellement equipe ---- */
const TENUE_HOWZER = "7ds-armures-ssr/Armure liee/Aventure en toute sécurité.webp";
const AUTRE_TENUE = "7ds-armures-ssr/Armure liee/Chevalier sacré de la tempête.webp";
const buildAvec = (tenue, niveau) => ({
  armor:{ "Armure liee":tenue },
  armorConfig:niveau === undefined
    ? {}
    : { "Armure liee":{ passiveLevel:niveau } }
});

{
  const equipe = {
    owner:"u-3", name:"Léa",
    characters:[{
      charId:"howzer", potentialTier:7,
      builds:{ "Nunchaku":buildAvec(TENUE_HOWZER, 2) }
    }]
  };
  assert.deepEqual(plain(porteursDeLaLigne(howzer, [equipe])),
    [{ owner:"u-3", nom:"Léa", potentiel:7, niveau:2 }],
    "un build qui equipe la tenue apporte son passif, a son niveau declare");
}

{
  /* Meme personnage, autre tenue : il ne l'apporte pas. */
  const autre = {
    owner:"u-4", name:"Paul",
    characters:[{
      charId:"howzer", potentialTier:9,
      builds:{ "Nunchaku":buildAvec(AUTRE_TENUE, 3) }
    }]
  };
  assert.deepEqual(plain(porteursDeLaLigne(howzer, [autre])), [],
    "posseder le personnage sans SA tenue n'est pas posseder le passif");
}

{
  /* Niveau non renseigne : null, jamais 3. Supposer le maximum ferait lire un
     chiffre que le membre n'a pas. */
  const sansNiveau = {
    owner:"u-5", name:"Zoé",
    characters:[{
      charId:"howzer", potentialTier:4,
      builds:{ "Nunchaku":buildAvec(TENUE_HOWZER) }
    }]
  };
  assert.deepEqual(plain(porteursDeLaLigne(howzer, [sansNiveau])),
    [{ owner:"u-5", nom:"Zoé", potentiel:4, niveau:null }],
    "un niveau absent reste absent");

  /* Un niveau hors bornes ne vaut pas mieux qu'un niveau absent. */
  const niveauFaux = {
    owner:"u-6", name:"Hugo",
    characters:[{
      charId:"howzer", potentialTier:4,
      builds:{ "Nunchaku":buildAvec(TENUE_HOWZER, 9) }
    }]
  };
  assert.equal(plain(porteursDeLaLigne(howzer, [niveauFaux]))[0].niveau, null,
    "un niveau hors bornes est traite comme non renseigne");
}

{
  /* Deux builds portent la meme tenue a des niveaux differents : on retient le
     MEILLEUR, celui que le membre peut effectivement amener. */
  const deuxBuilds = {
    owner:"u-7", name:"Nina",
    characters:[{
      charId:"howzer", potentialTier:6,
      builds:{
        "Nunchaku":buildAvec(TENUE_HOWZER, 1),
        "Gantelets":buildAvec(TENUE_HOWZER, 3)
      }
    }]
  };
  assert.equal(plain(porteursDeLaLigne(howzer, [deuxBuilds]))[0].niveau, 3,
    "entre deux builds, on retient le meilleur niveau de passif");
}

/* ---- LE CHIFFRE COMPARABLE : sens, total cumule, valeurs par niveau ----

   Le libelle d'une ligne a cumuls n'annonce que le taux UNITAIRE, et rien
   dans la table ne porte le sens de l'effet : `valeur` est une magnitude, et
   `cible` ne tranche pas — « degats subis par l'ennemi +2 % » vise l'ennemi
   et monte. Le sens se lit donc dans le libelle. Ces controles existent pour
   qu'une ligne ajoutee demain sans signe lisible se voie ici, et non a
   l'ecran sous la forme d'un « + » invente. */
{
  const aCumuls = lignes.filter(ligne => ligne.totalCumule !== null);
  assert.ok(aCumuls.length > 0,
    "des lignes doivent annoncer leur taux par cumul plutot que leur total");
  aCumuls.forEach(ligne => {
    assert.ok(ligne.sens === 1 || ligne.sens === -1,
      "sens illisible pour « " + ligne.libelle + " » : la vue afficherait un "
        + "total sans savoir s'il monte ou s'il descend");
    assert.ok(/par (cumul|coup)/.test(ligne.libelle),
      "seul un libelle qui donne un taux unitaire merite qu'on affiche son "
        + "total : « " + ligne.libelle + " »");
  });

  /* Le contre-exemple qui fixe la regle. Sa valeur est bien cumulee, mais son
     libelle donne DEJA le total : afficher « −20 % » a cote de « −20 % »
     n'aiderait personne. C'est la tournure qui decide, pas `cumuls`. */
  const gelure = lignes.find(ligne => /^Gelure/.test(ligne.libelle));
  assert.ok(gelure, "la ligne Gelure doit exister");
  assert.equal(gelure.totalCumule, null,
    "un libelle qui donne deja son total ne doit pas se le voir repeter");

  const inflammation = parId("escanor-inflammation-defense");
  assert.equal(inflammation.totalCumule, 1500,
    "« −0,15 % par cumul, 100 cumuls » vaut −15 %, soit 1500 dix-millemes");
  assert.equal(inflammation.sens, -1);

  /* Une tenue gravee porte ses trois valeurs DEJA cumulees : c'est ce qui
     permet d'annoncer ce qu'un porteur apporte a SON niveau plutot que le
     maximum de la tenue. */
  const chercheuse = tenues.find(ligne =>
    ligne.id === "merlin-chercheuse-attaque-feu");
  assert.ok(chercheuse, "la tenue de Merlin doit figurer au recensement");
  assert.deepEqual(plain(chercheuse.niveaux), [1200, 1600, 2000],
    "les trois niveaux du passif doivent voyager avec la ligne");
  assert.equal(chercheuse.sens, 1);
  assert.equal(chercheuse.totalCumule, null,
    "une tenue ne passe pas par le total cumule : ses niveaux le portent");

  /* Toute ligne de tenue doit pouvoir se chiffrer, sinon la vue retombe sur
     un « N2 » que le membre doit traduire lui-meme. */
  tenues.forEach(ligne => {
    assert.ok(Array.isArray(ligne.niveaux) && ligne.niveaux.length === 3,
      "trois niveaux attendus pour « " + ligne.libelle + " »");
    assert.ok(ligne.sens === 1 || ligne.sens === -1,
      "sens illisible pour la tenue « " + ligne.libelle + " »");
  });
}

/* ---- Une ligne que personne ne possede reste une ligne ---- */
assert.deepEqual(plain(porteursDeLaLigne(escanor, [])), [],
  "aucun porteur ne doit lever : savoir qu'un effet manque est une information");
assert.deepEqual(plain(porteursDeLaLigne(howzer, [])), []);

/* ---- Les entrees illisibles ne cassent rien ---- */
assert.deepEqual(plain(porteursDeLaLigne(null, [YANNIS])), []);
assert.deepEqual(plain(porteursDeLaLigne(escanor, null)), []);
assert.deepEqual(
  plain(porteursDeLaLigne(escanor, [{ owner:"u-9", name:"Vide" }])), [],
  "un membre sans roster charge ne doit pas lever");
assert.deepEqual(
  plain(porteursDeLaLigne(howzer, [{
    owner:"u-9", name:"Sans armure",
    characters:[{ charId:"howzer", potentialTier:1, builds:{ "Nunchaku":{} } }]
  }])), [],
  "un build sans armure liee ne doit pas lever");

console.log("recensement-supports.test.js OK ("
  + contre("ennemi").length + " lignes contre la cible, "
  + contre("allies").length + " pour les allies, dont "
  + tenues.length + " de tenue gravee)");
