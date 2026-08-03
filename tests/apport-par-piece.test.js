"use strict";

/* L'apport de chaque pièce, sous la pièce elle-même.

   Conception : docs/superpowers/specs/2026-08-03-apport-par-piece-design.md

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

testRolesEquipement();
testRolesArme();
testRolesBonusEnsemble();
console.log("PASS apport par piece : roles des termes");
