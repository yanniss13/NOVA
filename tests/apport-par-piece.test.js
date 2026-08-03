"use strict";

/* L'apport de chaque pièce : ses termes rangés par emplacement, et l'ordre
   dans lequel la modale les fait défiler.

   Conception : docs/superpowers/specs/2026-08-03-apport-par-piece-modale-design.md

   Les armures viennent du VRAI catalogue : `tests/helpers/load-app.js` ne
   synthétise que `weaponsByFile`, et reprend `gearByFile` tel quel de
   `data/stats-build.js`. Les armes, elles, sont synthétiques. */

const assert = require("node:assert");
const { loadApp, plain } = require("./helpers/load-app");

const HAUT_FILE = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
const HACHE_FILE = "7ds-armes/Hache/hache.webp";

/* `gearConfigStatus` exige qualityMin <= level <= qualityMax. Pour ces
   pièces, qualityMin vaut 120 : un niveau 0 sortirait « incompatible ». */
function gearConfig(overrides = {}){
  return Object.assign({
    version:1,
    level:120,
    reinforce:0,
    enchantments:[],
    passiveLevel:null
  }, overrides);
}

function weaponConfig(overrides = {}){
  return Object.assign({
    version:1,
    gradeGameId:"grade-axe",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:[null]
  }, overrides);
}

function testRolesEquipement(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateGearStats(HAUT_FILE, gearConfig(), "Haut"));
  assert.strictEqual(result.status, "valid", "la piece de reference doit etre calculable");
  result.terms.forEach(term => {
    assert.ok(
      ["main", "sub", "extra", "enchantment"].includes(term.role),
      "chaque terme d'equipement porte un role connu, recu : " + term.role
    );
  });
  const roles = result.terms.map(term => term.role);
  assert.ok(roles.includes("main"), "la stat principale porte le role main");
}

function testRolesArme(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateWeaponStats(HACHE_FILE, weaponConfig()));
  assert.strictEqual(result.status, "valid", "l'arme de reference doit etre calculable");
  result.terms.forEach(term => {
    assert.ok(
      ["main", "sub", "enchantment"].includes(term.role),
      "chaque terme d'arme porte un role connu, recu : " + term.role
    );
  });
  const mains = result.terms.filter(term => term.role === "main");
  assert.ok(
    mains.length >= 1,
    "la stat principale de l'arme (niveau et promotion) porte le role main"
  );
}

function testRolesBonusEnsemble(){
  const { hooks } = loadApp();
  const build = {
    weapon:null,
    armor:{ Haut:HAUT_FILE },
    armorConfig:{ Haut:gearConfig() },
    jewel:{},
    jewelConfig:{}
  };
  const result = plain(hooks.calculateBuildStats(build));
  result.terms
    .filter(term => term.bucket === "set")
    .forEach(term => {
      assert.strictEqual(term.role, "bonus", "un terme d'ensemble porte le role bonus");
    });
}

const BAS_FILE = "7ds-armures-ssr/Bas/Bas de l'araignée de l'ombre.webp";

function buildDeuxPieces(){
  return {
    weapon:null,
    armor:{ Haut:HAUT_FILE, Bas:BAS_FILE },
    armorConfig:{ Haut:gearConfig(), Bas:gearConfig() },
    jewel:{},
    jewelConfig:{}
  };
}

function totalParStat(totals){
  const somme = new Map();
  (totals || []).forEach(total => {
    somme.set(total.stat, (somme.get(total.stat) || 0) + total.value);
  });
  return somme;
}

/* L'invariant central : les entrees ne recalculent rien, elles rangent les
   memes termes. Leur somme doit donc egaler l'apport total de l'equipement.
   Attention : pas le total du HEROS, qui ajoute la base du personnage, la
   maitrise, le potentiel et les passifs. */
function testInvariantDeSomme(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  const global = plain(hooks.calculateBuildStats(build));
  const entrees = plain(hooks.groupBuildTermsBySlot(build));

  const attendu = totalParStat(global.totals);
  const obtenu = new Map();
  entrees.forEach(entree => {
    totalParStat(entree.totals).forEach((value, stat) => {
      obtenu.set(stat, (obtenu.get(stat) || 0) + value);
    });
  });

  assert.deepStrictEqual(
    [...obtenu.keys()].sort(),
    [...attendu.keys()].sort(),
    "les entrees couvrent exactement les memes statistiques que le total"
  );
  attendu.forEach((value, stat) => {
    assert.strictEqual(
      obtenu.get(stat),
      value,
      "la somme des entrees egale le total de l'equipement pour " + stat
    );
  });
}

/* Le test qui aurait attrape le defaut de conception initial : bati sur
   calculateHeroStats, une seule piece non configuree aurait vide le
   resultat entier et fait disparaitre TOUS les resumes. */
function testToleranceAuxPiecesNonConfigurees(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  build.armorConfig.Bas = null;

  const entrees = plain(hooks.groupBuildTermsBySlot(build));
  const haut = entrees.find(entree => entree.slot === "Haut");
  const bas = entrees.find(entree => entree.slot === "Bas");

  assert.ok(haut, "l'entree de la piece configuree existe");
  assert.strictEqual(haut.status, "valid", "la piece configuree reste calculee");
  assert.ok(haut.terms.length > 0, "la piece configuree garde ses termes");

  assert.ok(bas, "l'entree de la piece non configuree existe quand meme");
  assert.notStrictEqual(bas.status, "valid", "la piece non configuree est signalee");
  assert.strictEqual(bas.terms.length, 0, "la piece non configuree n'a aucun terme");
}

function testBonusEnsembleNonAttribue(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.groupBuildTermsBySlot(buildDeuxPieces()));
  entrees
    .filter(entree => entree.slot !== "set")
    .forEach(entree => {
      entree.terms.forEach(term => {
        assert.notStrictEqual(
          term.bucket,
          "set",
          "aucun terme d'ensemble n'est attribue a une piece"
        );
      });
    });
}

/* Le parcours de la modale : les pieces configurees d'abord, sans quoi le
   membre enchaine des modales vides avant d'atteindre ce qu'il cherche. */
function testOrdreConfigureesDAbord(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  build.armorConfig.Bas = null;

  const entrees = plain(hooks.orderedBuildEntries(build));
  const slots = entrees.map(entree => entree.slot);
  const iHaut = slots.indexOf("Haut");
  const iBas = slots.indexOf("Bas");

  assert.ok(iHaut >= 0 && iBas >= 0, "les deux pieces sont dans le parcours");
  assert.ok(
    iHaut < iBas,
    "la piece configuree passe avant la non configuree, recu : " + slots.join(", ")
  );
}

function testOrdreNaturelDansUnGroupe(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.orderedBuildEntries(buildDeuxPieces()));
  const slots = entrees.map(entree => entree.slot);
  assert.ok(
    slots.indexOf("Haut") < slots.indexOf("Bas"),
    "a statut egal, l'ordre naturel des emplacements est conserve"
  );
}

function testOrdreContientLesMemesEntrees(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  const brut = plain(hooks.groupBuildTermsBySlot(build)).map(e => e.slot).sort();
  const trie = plain(hooks.orderedBuildEntries(build)).map(e => e.slot).sort();
  assert.deepStrictEqual(
    trie,
    brut,
    "le tri ne perd ni n'invente aucune entree"
  );
}

testRolesEquipement();
testRolesArme();
testRolesBonusEnsemble();
testInvariantDeSomme();
testToleranceAuxPiecesNonConfigurees();
testBonusEnsembleNonAttribue();
testOrdreConfigureesDAbord();
testOrdreNaturelDansUnGroupe();
testOrdreContientLesMemesEntrees();
console.log("PASS apport par piece : roles, regroupement, invariant et ordre");
