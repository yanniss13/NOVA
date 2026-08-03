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

/* La jauge du jeu : ou se situe le jet entre le minimum et le maximum.

   `HAUT_FILE` ne convient pas ici : son `randomOptions` vaut null — seules
   40 des 96 pieces du catalogue sont gravables. Celle-ci l'est, avec un
   unique emplacement, et ses bornes de qualite acceptent le niveau 120. */
const HAUT_GRAVABLE = "7ds-armures-ssr/Haut/Haut de l'œil de l'étoile sinistre.webp";

function gravure(stat, value){
  return { slot:0, stat, value };
}

function buildAvecGravure(stat, value){
  return {
    weapon:null,
    armor:{ Haut:HAUT_GRAVABLE },
    armorConfig:{ Haut:gearConfig({ enchantments:[gravure(stat, value)] }) },
    jewel:{},
    jewelConfig:{}
  };
}

/* On lit une option reelle du catalogue plutot que d'inventer des bornes :
   un min/max invente passerait le test et mentirait sur les vraies donnees. */
function premiereOptionAleatoire(hooks){
  const definition = hooks.buildGearDefinition(HAUT_GRAVABLE);
  const stats = (definition.randomOptions && definition.randomOptions.stats) || [];
  assert.ok(stats.length > 0, "la piece de reference propose des gravures");
  const option = stats.find(item => item.max > item.min);
  assert.ok(option, "au moins une gravure a un intervalle non degenere");
  return option;
}

function testTirageExposeSesBornes(){
  const { hooks } = loadApp();
  const option = premiereOptionAleatoire(hooks);
  const milieu = Math.round((option.min + option.max) / 2);
  const entrees = plain(hooks.orderedBuildEntries(buildAvecGravure(option.stat, milieu)));
  const haut = entrees.find(entree => entree.slot === "Haut");
  const tirages = plain(hooks.randomRollsFor(haut));

  assert.strictEqual(tirages.length, 1, "la piece rend un seul tirage");
  const tirage = tirages[0];
  assert.strictEqual(tirage.stat, option.stat, "le tirage nomme sa statistique");
  assert.strictEqual(tirage.min, option.min, "le tirage porte le minimum du catalogue");
  assert.strictEqual(tirage.max, option.max, "le tirage porte le maximum du catalogue");
  assert.ok(
    Math.abs(tirage.ratio - 0.5) < 0.01,
    "un jet au milieu de l'intervalle donne un ratio de 0,5, recu : " + tirage.ratio
  );
  assert.strictEqual(typeof tirage.label, "string", "le tirage porte un libelle affichable");
}

function testRatioBorneAUnDansLesDeuxSens(){
  const { hooks } = loadApp();
  const option = premiereOptionAleatoire(hooks);

  const bas = plain(hooks.randomRollsFor(
    plain(hooks.orderedBuildEntries(buildAvecGravure(option.stat, option.min)))
      .find(entree => entree.slot === "Haut")
  ));
  assert.strictEqual(bas[0].ratio, 0, "un jet au minimum donne une jauge vide");

  const haut = plain(hooks.randomRollsFor(
    plain(hooks.orderedBuildEntries(buildAvecGravure(option.stat, option.max)))
      .find(entree => entree.slot === "Haut")
  ));
  assert.strictEqual(haut[0].ratio, 1, "un jet au maximum donne une jauge pleine");
}

/* Une piece sans gravure ne doit pas faire apparaitre de section vide. */
function testAucunTiragePourUnePieceSansGravure(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.orderedBuildEntries(buildDeuxPieces()));
  const haut = entrees.find(entree => entree.slot === "Haut");
  assert.deepStrictEqual(
    plain(hooks.randomRollsFor(haut)),
    [],
    "une piece sans gravure ne rend aucun tirage"
  );
}

/* Seuls les termes tires au sort ont une jauge : une stat de niveau n'en a
   pas, et lui en donner une serait un contresens. */
function testSeulsLesTermesAleatoiresPortentDesBornes(){
  const { hooks } = loadApp();
  const option = premiereOptionAleatoire(hooks);
  const result = plain(hooks.calculateGearStats(
    HAUT_GRAVABLE,
    gearConfig({ enchantments:[gravure(option.stat, option.max)] }),
    "Haut"
  ));
  assert.strictEqual(result.status, "valid", "la piece gravee reste calculable");
  result.terms.forEach(term => {
    if(term.role === "enchantment") return;
    assert.strictEqual(
      term.roll,
      undefined,
      "un terme deterministe ne porte aucune borne de tirage : " + term.id
    );
  });
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
/* L'arme aussi : le jeu montre ses enchantements avec la meme jauge.
   `grade-axe` propose critRate entre 10 et 20, ramene a [5, 10] par le taux
   de l'emplacement (5000 / 10000). */
function testTirageDArmeBasique(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateWeaponStats(HACHE_FILE, weaponConfig({
    enchantments:[{ slot:0, stat:"critRate", value:7 }]
  })));
  assert.strictEqual(result.status, "valid", "l'arme enchantee reste calculable");

  const tirages = plain(hooks.randomRollsFor({ terms:result.terms }));
  assert.strictEqual(tirages.length, 1, "l'arme rend son enchantement");
  assert.strictEqual(tirages[0].min, 5, "le minimum suit le taux de l'emplacement");
  assert.strictEqual(tirages[0].max, 10, "le maximum suit le taux de l'emplacement");
  assert.ok(
    Math.abs(tirages[0].ratio - 0.4) < 0.001,
    "un jet de 7 sur [5, 10] remplit la jauge aux deux cinquiemes, recu : "
      + tirages[0].ratio
  );
}

/* Une perle a bien des bornes, contrairement a ce que la premiere version
   supposait : chaque palier porte ses propres options min/max, et les
   privait de jauge etait un bug, pas une limite des donnees.

   L'arme vient du VRAI catalogue : la fixture synthetique n'a pas de courbes
   sur son grade a perles, donc son calcul n'aboutit pas. Palier 1, un seul
   emplacement, B_Def_Equip entre 56 et 112. */
const BAGUETTE_PERLE = "7ds-armes/Baguette/Baguette de l'âme vorace.webp";

function testTirageDePerle(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateWeaponStats(BAGUETTE_PERLE, weaponConfig({
    gradeGameId:"131065010",
    enchantments:[{ slot:0, tier:1, element:null, stat:"B_Def_Equip", value:84 }]
  })));
  assert.strictEqual(result.status, "valid", "l'arme a perle reste calculable");

  const tirages = plain(hooks.randomRollsFor({ terms:result.terms }));
  assert.strictEqual(tirages.length, 1, "la perle rend son tirage");
  assert.strictEqual(tirages[0].min, 56, "la perle porte le minimum de son palier");
  assert.strictEqual(tirages[0].max, 112, "la perle porte le maximum de son palier");
  assert.ok(
    Math.abs(tirages[0].ratio - 0.5) < 0.001,
    "un jet de 84 sur [56, 112] remplit la jauge a moitie, recu : "
      + tirages[0].ratio
  );
}

/* La partition fixe / tire au sort : exhaustive et sans recouvrement.
   C'est elle qui garantit qu'aucun apport ne s'affiche deux fois. */
function testPartitionSansDoublonNiPerte(){
  const { hooks } = loadApp();
  const option = premiereOptionAleatoire(hooks);
  const entrees = plain(hooks.orderedBuildEntries(
    buildAvecGravure(option.stat, option.max)
  ));
  const haut = entrees.find(entree => entree.slot === "Haut");

  const fixes = plain(hooks.fixedStatsOf(haut));
  const tirages = plain(hooks.randomRollsFor(haut));

  assert.ok(tirages.length > 0, "la piece gravee a bien un tirage");
  assert.strictEqual(
    fixes.terms.length + haut.terms.filter(t => t.role === "enchantment").length,
    haut.terms.length,
    "les deux parts couvrent tous les termes, sans en perdre"
  );
  fixes.terms.forEach(term => {
    assert.notStrictEqual(
      term.role,
      "enchantment",
      "aucun terme tire au sort ne reste dans la part fixe"
    );
  });
}

/* Le doublon concret que l'utilisateur a vu : une statistique dont la
   TOTALITE vient d'un enchantement s'affichait dans les deux sections. */
function testStatPurementTireeNApparaitPasDansLesFixes(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateWeaponStats(HACHE_FILE, weaponConfig({
    enchantments:[{ slot:0, stat:"critRate", value:7 }]
  })));
  const entree = { terms:result.terms };

  const tirees = new Set(plain(hooks.randomRollsFor(entree)).map(t => t.stat));
  const fixees = new Set(plain(hooks.fixedStatsOf(entree)).totals.map(t => t.stat));

  assert.ok(tirees.has("critRate"), "critRate est bien un tirage ici");
  /* L'arme porte aussi critRate en sous-statistique de niveau : au niveau 0
     elle vaut 20, donc la stat reste dans les fixes. Ce que le test protege,
     c'est que la part TIREE n'y soit pas comptee deux fois. */
  const totalFixe = plain(hooks.fixedStatsOf(entree)).totals
    .find(total => total.stat === "critRate");
  assert.ok(
    !totalFixe || totalFixe.value !== 27,
    "le total fixe n'additionne pas la part tiree au sort (20 + 7)"
  );
  assert.ok(fixees.size >= 1, "la part fixe conserve les statistiques de niveau");
}

/* Le passif appartient a la piece, pas seulement au heros.

   Il vient de `groupBuildTermsBySlot` et non de `calculateHeroStats` : la
   seconde vide son resultat des qu'une piece n'est pas configuree, et le
   passif de l'arme disparaitrait avec. */
function testPassifDArmeSurSonEntree(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.orderedBuildEntries({
    weapon:HACHE_FILE,
    weaponConfig:weaponConfig({ overlimit:0 }),
    armor:{}, armorConfig:{}, jewel:{}, jewelConfig:{}
  }));
  const arme = entrees.find(entree => entree.slot === "weapon");

  assert.ok(arme, "l'entree de l'arme existe");
  assert.ok(arme.passive, "l'arme porte son passif");
  assert.strictEqual(arme.passive.status, "valid", "le passif de l'arme est lisible");
  assert.ok(arme.passive.text.length > 0, "le passif de l'arme porte son texte");
  assert.ok(
    arme.passive.level >= 1 && arme.passive.level <= arme.passive.maxLevel,
    "le niveau du passif tient dans ses bornes"
  );
}

/* Le passif n'est PAS un terme : sa prose est conditionnelle et rien ne la
   chiffre. L'ajouter aux totaux serait un faux calcul. */
function testPassifNestPasUnTerme(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.orderedBuildEntries({
    weapon:HACHE_FILE,
    weaponConfig:weaponConfig(),
    armor:{}, armorConfig:{}, jewel:{}, jewelConfig:{}
  }));
  const arme = entrees.find(entree => entree.slot === "weapon");
  arme.terms.forEach(term => {
    assert.notStrictEqual(
      term.source.component,
      "passive",
      "aucun terme ne provient du passif"
    );
  });
}

/* Une piece sans passif n'en invente pas un. */
function testPieceSansPassif(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.orderedBuildEntries(buildDeuxPieces()));
  entrees
    .filter(entree => entree.slot === "set")
    .forEach(entree => {
      assert.strictEqual(
        entree.passive,
        undefined,
        "le bonus d'ensemble n'est pas une piece et n'a pas de passif"
      );
    });
}

testTirageExposeSesBornes();
testPassifDArmeSurSonEntree();
testPassifNestPasUnTerme();
testPieceSansPassif();
testPartitionSansDoublonNiPerte();
testStatPurementTireeNApparaitPasDansLesFixes();
testTirageDArmeBasique();
testTirageDePerle();
testRatioBorneAUnDansLesDeuxSens();
testAucunTiragePourUnePieceSansGravure();
testSeulsLesTermesAleatoiresPortentDesBornes();
console.log("PASS apport par piece : roles, regroupement, invariant, ordre et tirages");
