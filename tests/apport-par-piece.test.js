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

/* Le classement ne compare jamais deux unites entre elles : « PV +4 200 »
   est en points, « CRIT 12 % » en dix-milliemes. L'ordre vient des roles. */
function testClassementSuitLesRoles(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.groupBuildTermsBySlot(buildDeuxPieces()));
  const haut = entrees.find(entree => entree.slot === "Haut");
  const resume = plain(hooks.summaryTermsFor(haut, 3));

  assert.ok(resume.length >= 1, "une piece configuree a au moins un apport");
  assert.ok(resume.length <= 3, "le resume ne depasse jamais la limite demandee");
  resume.forEach(item => {
    assert.strictEqual(typeof item.stat, "string", "chaque apport nomme sa statistique");
    assert.strictEqual(typeof item.label, "string", "chaque apport porte un libelle affichable");
    assert.ok(Number.isFinite(item.value), "chaque apport porte une valeur numerique");
    assert.ok(
      item.unit === "flat" || item.unit === "ten-thousandths",
      "chaque apport porte une unite connue"
    );
  });

  const premier = resume[0];
  const termesMain = haut.terms.filter(term => term.role === "main");
  assert.ok(
    termesMain.some(term => term.stat === premier.stat),
    "le premier apport affiche est la statistique principale de la piece"
  );
}

/* On ne complete jamais pour atteindre la limite. */
function testResumeNeCompletePas(){
  const { hooks } = loadApp();
  const entree = {
    slot:"Test",
    domain:"armor",
    file:"x.webp",
    status:"valid",
    terms:[
      /* Une VRAIE statistique du catalogue : `addGearStatTerm` appelle
         `buildStatMetadata` a la creation, donc un terme sans libelle ne
         peut pas exister en pratique. */
      {
        id:"a", stat:"B_Def_Equip", operation:"add", value:1000, unit:"flat",
        bucket:"armor:Haut", role:"main", family:"main",
        source:{ domain:"armor", component:"level", slot:"Test" },
        confidence:"presumed"
      }
    ],
    totals:[]
  };
  const resume = plain(hooks.summaryTermsFor(entree, 3));
  assert.strictEqual(
    resume.length,
    1,
    "une entree a un seul role rend un seul apport, jamais trois"
  );
}

function testResumeVidePourPieceNonConfiguree(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  build.armorConfig.Bas = null;
  const entrees = plain(hooks.groupBuildTermsBySlot(build));
  const bas = entrees.find(entree => entree.slot === "Bas");
  assert.deepStrictEqual(
    plain(hooks.summaryTermsFor(bas, 3)),
    [],
    "une piece non configuree ne produit aucun apport"
  );
}

testRolesEquipement();
testRolesArme();
testRolesBonusEnsemble();
testInvariantDeSomme();
testToleranceAuxPiecesNonConfigurees();
testBonusEnsembleNonAttribue();
testClassementSuitLesRoles();
testResumeNeCompletePas();
testResumeVidePourPieceNonConfiguree();
console.log("PASS apport par piece : roles, regroupement, invariant et classement");
