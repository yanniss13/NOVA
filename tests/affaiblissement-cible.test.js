"use strict";

/* Le recensement "Affaiblissement de la cible" : quelles lignes il montre,
   et qui les possede.

   Ce que ce fichier garde, et que rien d'autre ne garde : le critere du
   recensement est l'EFFET TRANSCRIT, jamais le role de slot. Escanor porte son
   malus de defense avec une Epee a deux mains de role Attaquant ; King avec un
   Grimoire de role Gardien. Un recensement fonde sur le role les manquerait
   tous les deux, et c'est exactement ce qui a motive cette section. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { lignesDAffaiblissement, porteursDeLaLigne, buffsApplicables } = hooks;

assert.equal(typeof lignesDAffaiblissement, "function",
  "lignesDAffaiblissement doit etre expose par le chargeur de tests");
assert.equal(typeof porteursDeLaLigne, "function",
  "porteursDeLaLigne doit etre expose par le chargeur de tests");

const lignes = lignesDAffaiblissement();
const parId = id => lignes.find(ligne => ligne.id === id);

/* ---- Le critere est l'effet, pas le role ---- */
const escanor = parId("escanor-inflammation-defense");
assert.ok(escanor,
  "Escanor doit figurer au recensement : son Epee a deux mains est de role "
    + "Attaquant, et c'est justement le cas qui interdit de filtrer par role");
assert.equal(escanor.arme, "Sword2h");
assert.equal(escanor.armeDossier, "Epee 2 mains");

assert.ok(parId("king-marque-degats-subis"),
  "King debuffe avec un Grimoire de role Gardien : lui aussi doit figurer");

/* ---- Un bonus pose sur le HEROS n'est pas un affaiblissement ---- */
assert.ok(!parId("daisy-reveil-degats-crit"),
  "un bonus rendu aux allies ne dit rien de ce que la cible encaisse");
lignes.forEach(ligne => assert.ok(ligne.effet,
  ligne.id + " : toute ligne du recensement porte un effet sur la cible"));

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

/* Aucune ligne sans arme lisible : une ligne dont l'arme est inconnue ne peut
   trouver aucun porteur, donc elle s'afficherait grise a tort et pour
   toujours. */
lignes.forEach(ligne => assert.ok(ligne.arme,
  ligne.id + " : aucune arme lisible dans son gameId"));

/* ---- Les lignes consignees : presentes ici, absentes du calculateur ---- */
const consignees = lignes.filter(ligne => ligne.horsCalcul);
assert.equal(consignees.length, 4,
  "les quatre lignes de resistance a la Foudre doivent figurer au recensement");
const proposees = new Set(buffsApplicables("thunder").map(buff => buff.id));
consignees.forEach(ligne => assert.ok(!proposees.has(ligne.id),
  ligne.id + " : consignee au recensement, elle ne doit jamais etre proposee "
    + "en case a cocher du calculateur"));

/* ---- La possession : le personnage ET l'arme ---- */
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
  { owner:"u-2", nom:"Marc", potentiel:10 },
  { owner:"u-1", nom:"Yannis", potentiel:8 }
], "les porteurs se lisent du meilleur potentiel au moins bon");

assert.deepEqual(plain(porteursDeLaLigne(drake, [YANNIS, MARC])), [],
  "posseder le personnage sans l'arme qui porte l'effet n'est pas le posseder");

/* ---- Une ligne que personne ne possede reste une ligne ---- */
assert.deepEqual(plain(porteursDeLaLigne(escanor, [])), [],
  "aucun porteur ne doit lever : savoir qu'un effet manque est une information");
assert.ok(lignes.length >= 13,
  "le recensement doit couvrir les treize lignes transcrites, recu "
    + lignes.length);

/* ---- Les entrees illisibles ne cassent rien ---- */
assert.deepEqual(plain(porteursDeLaLigne(null, [YANNIS])), []);
assert.deepEqual(plain(porteursDeLaLigne(escanor, null)), []);
assert.deepEqual(
  plain(porteursDeLaLigne(escanor, [{ owner:"u-3", name:"Vide" }])), [],
  "un membre sans roster charge ne doit pas lever");

console.log("affaiblissement-cible.test.js OK (" + lignes.length + " lignes, "
  + consignees.length + " consignees)");
