"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadApp, plain } = require("./helpers/load-app");

const HACHE_FILE = "7ds-armes/Hache/hache.webp";
const EPEE_FILE = "7ds-armes/Epee 1 main/epee.webp";
const BAGUETTE_VORACE_FILE = "7ds-armes/Baguette/Baguette de l'âme vorace.webp";
const EPEE_LONGUE_USEE_FILE = "7ds-armes/Epee 1 main/Épée longue usée.webp";

function validConfig(overrides = {}){
  return Object.assign({
    version:1,
    gradeGameId:"grade-axe",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:[null]
  }, overrides);
}

function assertThrowsCode(action, code){
  assert.throws(action, new RegExp(code));
}

function masterstoneConfig(enchantment){
  return {
    version:1,
    gradeGameId:"131065010",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:[enchantment]
  };
}

// Les primitives reproduisent les segments, promotions, bornes et formats documentés.
{
  const { hooks } = loadApp();
  assert.strictEqual(
    hooks.curveValueAtLevel({ base:100, progression:[2, 3], max:150 }, 0),
    100
  );
  assert.strictEqual(hooks.curveValueAtLevel({ base:100, progression:[2, 3] }, 10), 120);
  assert.strictEqual(hooks.curveValueAtLevel({ base:100, progression:[2, 3] }, 11), 123);
  assert.strictEqual(hooks.curveValueAtLevel({ base:100, progression:[2, 3] }, 20), 150);
  assert.strictEqual(
    hooks.promotionValueAt({
      promotionValues:{ base:50, progression:[73, 145, 218], max:486 }
    }, 0),
    50
  );
  assert.strictEqual(
    hooks.promotionValueAt({
      promotionValues:{ base:50, progression:[73, 145, 218], max:486 }
    }, 3),
    486
  );
  assert.deepStrictEqual(
    plain(hooks.enchantmentBounds({ min:315, max:787 }, 5000)),
    { min:158, max:393 }
  );
  assert.strictEqual(hooks.weaponConfigStatus(HACHE_FILE, validConfig({
    enchantments:[{
      slot:0, tier:null, element:null, stat:"critRate", value:5
    }]
  })), "valid");
  assert.strictEqual(hooks.weaponConfigStatus(HACHE_FILE, validConfig({
    enchantments:[{
      slot:0, tier:null, element:null, stat:"critRate", value:4
    }]
  })), "incompatible");
  assert.strictEqual(hooks.formatBuildStatValue(787, "ten-thousandths"), "+7,87 %");
  assert.strictEqual(hooks.formatBuildStatValue(500, "ten-thousandths"), "+5 %");
  assert.strictEqual(hooks.formatBuildStatValue(3291, "flat"), "+3\u202f291");
  assert.deepStrictEqual(
    plain(hooks.overlimitTargetBuckets("native-before-enchantments")),
    ["weapon-native"]
  );
  assert.deepStrictEqual(
    plain(hooks.overlimitTargetBuckets("native-and-enchantments")),
    ["weapon-native", "weapon-enchantment"]
  );
  assertThrowsCode(
    () => hooks.overlimitTargetBuckets("mode-inconnu"),
    "OVERLIMIT_MODE_INVALID"
  );
}

// L'hypothèse d'outrepassement reste unique et inséparable de son protocole.
{
  const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.strictEqual(
    (source.match(/\bconst\s+OVERLIMIT_APPLICATION_MODE\b/g) || []).length,
    1
  );
  assert.match(source, /PRÉSUMÉ, NON VÉRIFIÉ/);
  assert.match(source, /outrepassement 0 puis 1/);
  assert.match(source, /arme enchantée/);
}

// La reconstruction somme les seaux, puis applique chaque multiplicateur à ses seules cibles.
{
  const { hooks } = loadApp();
  const bucketTerms = [
    {
      id:"level", stat:"B_Atk_Equip", operation:"add",
      value:2000, unit:"flat", bucket:"weapon-native", family:"main",
      source:{ domain:"weapon", component:"level" }, confidence:"exact"
    },
    {
      id:"promotion", stat:"B_Atk_Equip", operation:"add",
      value:1000, unit:"flat", bucket:"weapon-native", family:"main",
      source:{ domain:"weapon", component:"promotion" }, confidence:"exact"
    },
    {
      id:"overlimit", stat:"B_Atk_Equip", operation:"multiply",
      value:500, unit:"ten-thousandths", appliesTo:["weapon-native"],
      family:"main",
      source:{ domain:"weapon", component:"overlimit" }, confidence:"exact"
    },
    {
      id:"enchantment", stat:"B_Atk_Equip", operation:"add",
      value:100, unit:"flat", bucket:"weapon-enchantment", family:"main",
      source:{ domain:"weapon", component:"enchantment", slot:0 },
      confidence:"exact"
    }
  ];
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(bucketTerms)),
    [{ stat:"B_Atk_Equip", unit:"flat", value:3250 }]
  );
  const includingEnchantments = bucketTerms.map(term =>
    term.id === "overlimit"
      ? { ...term, appliesTo:["weapon-native", "weapon-enchantment"] }
      : term
  );
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(includingEnchantments)),
    [{ stat:"B_Atk_Equip", unit:"flat", value:3255 }]
  );

  const additive = bucketTerms[0];
  const multiplier = bucketTerms[2];
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...additive, unit:undefined }]),
    "BUILD_STAT_UNIT_INVALID"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...additive, confidence:undefined }]),
    "BUILD_STAT_CONFIDENCE_INVALID"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...additive, confidence:"maybe" }]),
    "BUILD_STAT_CONFIDENCE_INVALID"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([
      additive,
      { ...additive, id:"other-unit", unit:"ten-thousandths", bucket:"other" }
    ]),
    "BUILD_STAT_UNIT_MISMATCH"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...multiplier, unit:"flat" }, additive]),
    "BUILD_STAT_MULTIPLIER_UNIT_INVALID"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...multiplier, stat:"*" }, additive]),
    "BUILD_STAT_CONCRETE_STAT_REQUIRED"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...multiplier, appliesTo:[] }, additive]),
    "BUILD_STAT_TARGETS_INVALID"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([
      { ...multiplier, appliesTo:["absent"] },
      additive
    ]),
    "BUILD_STAT_TARGET_UNRESOLVED"
  );
  assertThrowsCode(
    () => hooks.reconstructStatTotals([{ ...additive, operation:"divide" }]),
    "BUILD_STAT_OPERATION_INVALID"
  );
}

// Le moteur publie des termes traçables dont les totaux sont uniquement reconstruits.
{
  const { hooks } = loadApp();
  const result = plain(hooks.calculateWeaponStats(HACHE_FILE, validConfig({
    overlimit:1,
    enchantments:[{
      slot:0,
      tier:null,
      element:null,
      stat:"critRate",
      value:10
    }]
  })));
  assert.strictEqual(result.version, 1);
  assert.strictEqual(result.status, "valid");
  assert.deepStrictEqual(result.coverage, ["weapon"]);
  assert.strictEqual(result.assumptions.overlimitBase, "native-before-enchantments");
  assert.ok(result.terms.length > 0);
  assert.ok(result.terms.every(term =>
    term.stat !== "*" &&
    ["add", "multiply"].includes(term.operation) &&
    ["flat", "ten-thousandths"].includes(term.unit) &&
    ["exact", "presumed"].includes(term.confidence) &&
    term.family &&
    term.source && term.source.domain === "weapon" &&
    term.source.component
  ));
  assert.ok(result.terms.some(term =>
    term.operation === "multiply" &&
    term.source.component === "overlimit" &&
    term.stat === "B_Atk_Equip" &&
    term.value === 500 &&
    JSON.stringify(term.appliesTo) === JSON.stringify(["weapon-native"])
  ));
  assert.ok(result.terms.some(term =>
    term.operation === "add" &&
    term.source.component === "level" &&
    term.stat === "B_Atk_Equip" &&
    term.value === 10 &&
    term.bucket === "weapon-native"
  ));
  assert.ok(result.terms.some(term =>
    term.operation === "add" &&
    term.source.component === "promotion" &&
    term.stat === "B_Atk_Equip" &&
    term.value === 5 &&
    term.bucket === "weapon-native"
  ));
  assert.ok(result.terms.some(term =>
    term.operation === "add" &&
    term.source.component === "level" &&
    term.stat === "critRate" &&
    term.value === 20 &&
    term.bucket === "weapon-native"
  ));
  assert.ok(result.terms.some(term =>
    term.operation === "add" &&
    term.source.component === "enchantment" &&
    term.stat === "critRate" &&
    term.value === 10 &&
    term.bucket === "weapon-enchantment"
  ));
  assert.ok(result.facts.some(fact =>
    fact.source.component === "passive" && fact.level === 7
  ));
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(result.terms)),
    result.totals
  );

  const grouped = plain(hooks.groupBuildStatResults(result));
  assert.deepStrictEqual(grouped.map(group => group.family), ["main", "additional"]);
  assert.deepStrictEqual(
    grouped[0].stats[0].terms,
    result.terms.filter(term => term.stat === "B_Atk_Equip")
  );
  assert.deepStrictEqual(
    grouped[1].stats[0].terms,
    result.terms.filter(term => term.stat === "critRate")
  );

  const invalidCases = [
    [HACHE_FILE, null, "missing"],
    [HACHE_FILE, validConfig({ gradeGameId:null }), "incomplete"],
    ["7ds-armes/Hache/sans-stats.webp", validConfig(), "unavailable"],
    [HACHE_FILE, { version:99, opaque:true }, "incompatible"]
  ];
  for(const [file, config, expectedStatus] of invalidCases){
    const invalidResult = plain(hooks.calculateWeaponStats(file, config));
    assert.strictEqual(invalidResult.status, expectedStatus);
    assert.deepStrictEqual(invalidResult.coverage, []);
    assert.deepStrictEqual(invalidResult.terms, []);
    assert.deepStrictEqual(invalidResult.totals, []);
  }

  const validWithoutEnchantments = plain(hooks.calculateWeaponStats(
    HACHE_FILE,
    validConfig({ enchantments:[null] })
  ));
  assert.deepStrictEqual(validWithoutEnchantments.coverage, ["weapon"]);
  assert.strictEqual(
    validWithoutEnchantments.terms.some(
      term => term.source.component === "enchantment"
    ),
    false
  );
  assert.notDeepStrictEqual(
    plain(hooks.reconstructStatTotals(result.terms.slice(1))),
    result.totals
  );
}

// Le moteur d'arme n'importe jamais la progression de renforcement des armures.
{
  const source = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const engineStart = source.indexOf("function curveValueAtLevel");
  const engineEnd = source.indexOf("function applyWeaponChange", engineStart);
  assert.ok(engineStart >= 0 && engineEnd > engineStart);
  assert.doesNotMatch(source.slice(engineStart, engineEnd), /\b10300\b/);
  assert.doesNotMatch(source.slice(engineStart, engineEnd), /\breinforce\b/i);
}

// Cette assertion échoue tant que le modèle n'expose pas son état public.
{
  const { hooks } = loadApp();
  assert.strictEqual(typeof hooks.weaponConfigStatus, "function");
}

// Un ancien build ne reçoit aucun niveau ou grade inventé.
{
  const { hooks } = loadApp();
  const legacy = plain(hooks.normalizeHero({
    char:"meliodas",
    weapon:HACHE_FILE
  }));
  assert.strictEqual(legacy.weaponConfig, null);
  assert.strictEqual(hooks.weaponConfigStatus(legacy.weapon, legacy.weaponConfig), "missing");
}

// Une version future reste inchangée et reste lisiblement incompatible.
{
  const { hooks } = loadApp();
  const future = { version:99, opaque:{ keep:"yes" } };
  const normalized = plain(hooks.normalizeHero({
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:future
  }));
  assert.deepStrictEqual(normalized.weaponConfig, future);
  assert.strictEqual(hooks.weaponConfigStatus(normalized.weapon, future), "incompatible");
  future.opaque.keep = "changed";
  assert.strictEqual(normalized.weaponConfig.opaque.keep, "yes");
}

// Seul un vrai changement d'arme retire la configuration chiffrée.
{
  const { hooks } = loadApp();
  const config = validConfig();
  const changed = plain(hooks.applyWeaponChange({
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:config
  }, EPEE_FILE));
  assert.strictEqual(changed.weaponConfig, null);

  const unchanged = plain(hooks.applyWeaponChange({
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:config
  }, HACHE_FILE));
  assert.deepStrictEqual(unchanged.weaponConfig, config);
  config.level = 9;
  assert.strictEqual(unchanged.weaponConfig.level, 0);
}

// Les cinq états distinguent l'absence de catalogue, la saisie et la corruption.
{
  const { hooks } = loadApp();
  assert.strictEqual(
    hooks.weaponConfigStatus("7ds-armes/Hache/inconnue.webp", validConfig()),
    "unavailable"
  );
  assert.strictEqual(hooks.weaponConfigStatus(HACHE_FILE, { version:1 }), "incomplete");
  assert.strictEqual(hooks.weaponConfigStatus(HACHE_FILE, validConfig()), "valid");
  assert.strictEqual(
    hooks.weaponConfigStatus(HACHE_FILE, validConfig({ gradeGameId:"grade-etranger" })),
    "incompatible"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(HACHE_FILE, validConfig({ level:11 })),
    "incompatible"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(HACHE_FILE, validConfig({ enchantments:[] })),
    "incompatible"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(HACHE_FILE, validConfig({ gradeGameId:"grade-sans-courbe" })),
    "unavailable"
  );
}

// Une pierre maîtresse reconnue mais en cours de saisie reste incomplète.
{
  const { hooks } = loadApp();
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, masterstoneConfig({
      slot:0,
      tier:5,
      element:"",
      stat:"",
      value:null
    })),
    "incomplete"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, masterstoneConfig({
      slot:0,
      tier:5,
      element:"generic",
      stat:"I_AtkAdd_Rate",
      value:null
    })),
    "incomplete"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, masterstoneConfig({
      slot:0,
      tier:5,
      element:"generic",
      stat:"stat-interdite",
      value:423
    })),
    "incompatible"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, masterstoneConfig({
      slot:0,
      tier:5,
      element:"generic",
      stat:"I_AtkAdd_Rate",
      value:422
    })),
    "incompatible"
  );
}

// La variante réelle sans courbes natives n'annonce jamais un zéro couvert.
{
  const { hooks } = loadApp();
  const config = {
    version:1,
    gradeGameId:"130100098",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:[null]
  };
  assert.strictEqual(
    hooks.weaponConfigStatus(EPEE_LONGUE_USEE_FILE, config),
    "unavailable"
  );
  const result = plain(hooks.calculateWeaponStats(EPEE_LONGUE_USEE_FILE, config));
  assert.strictEqual(result.status, "unavailable");
  assert.deepStrictEqual(result.coverage, []);
  assert.deepStrictEqual(result.terms, []);
  assert.deepStrictEqual(result.totals, []);
  assert.strictEqual(
    hooks.weaponConfigSummary(EPEE_LONGUE_USEE_FILE, null),
    "Données chiffrées indisponibles"
  );
  assert.strictEqual(
    hooks.weaponConfigSummary(EPEE_LONGUE_USEE_FILE, config),
    "Données chiffrées indisponibles"
  );
}

// Les plafonds sont lus exclusivement dans les étapes réellement disponibles.
{
  const { hooks } = loadApp();
  const grade = hooks.buildWeaponGrade(HACHE_FILE, "grade-axe");
  assert.strictEqual(hooks.weaponLevelCap(grade, 0), 10);
  assert.strictEqual(hooks.weaponLevelCap(grade, 1), 20);
  assert.strictEqual(hooks.weaponLevelCap(grade, 2), 30);
  assert.strictEqual(hooks.weaponLevelCap(grade, 3), 40);
  assert.strictEqual(hooks.weaponLevelCap(grade, 4), 50);
  assert.strictEqual(hooks.weaponLevelCap({}, 0), -1);
  assert.deepStrictEqual(plain(hooks.emptyWeaponConfig(HACHE_FILE, "grade-axe")), validConfig());
  assert.strictEqual(hooks.emptyWeaponConfig(HACHE_FILE, "grade-inconnue"), null);
}

// Les copies de roster gardent la configuration, sauf le favori ciblé qui garde la sienne.
{
  const { hooks } = loadApp();
  const favoriteConfig = validConfig();
  const targetConfig = validConfig({ level:4 });
  const entry = {
    charId:"meliodas",
    builds:{
      Hache:{ weapon:HACHE_FILE, weaponConfig:favoriteConfig, favorite:true },
      "Epee 1 main":{ weapon:EPEE_FILE, weaponConfig:targetConfig, favorite:false }
    }
  };
  const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
  assert.deepStrictEqual(snapshot.weaponConfig, favoriteConfig);
  favoriteConfig.level = 7;
  assert.strictEqual(snapshot.weaponConfig.level, 0);

  const copied = plain(hooks.copyFavoriteRosterBuild(entry, "Epee 1 main"));
  assert.deepStrictEqual(copied.builds["Epee 1 main"].weaponConfig, targetConfig);
  targetConfig.level = 8;
  assert.strictEqual(copied.builds["Epee 1 main"].weaponConfig.level, 4);
}

// La configuration complète traverse chaque frontière JSONB sans être reconstruite.
{
  const { hooks } = loadApp();
  const emptyArmorFixture = {
    Haut:null, Bas:null, Bottes:null, Ceinture:null, "Armure liee":null
  };
  const emptyJewelFixture = {
    Anneau:null, Collier:null, "Boucle d'oreille":null
  };
  const buildFixture = (weapon, weaponConfig, favorite) => ({
    weapon,
    weaponConfig,
    armor:emptyArmorFixture,
    jewel:emptyJewelFixture,
    note:"",
    favorite:!!favorite
  });
  const sourceConfig = validConfig({
    overlimit:1,
    enchantments:[{
      slot:0,
      tier:null,
      element:null,
      stat:"critRate",
      value:7
    }]
  });
  const entry = {
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{
      Hache:buildFixture(HACHE_FILE, sourceConfig, true)
    },
    updatedAt:123
  };

  const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
  assert.strictEqual(
    JSON.stringify(snapshot.weaponConfig),
    JSON.stringify(sourceConfig)
  );

  const cloud = plain(hooks.rosterToCloudRow(entry, "user-1"));
  assert.ok(cloud, "La conversion cloud doit accepter un propriétaire explicite en test pur");
  assert.strictEqual(cloud.owner, "user-1");
  assert.strictEqual(
    JSON.stringify(cloud.builds.Hache.weaponConfig),
    JSON.stringify(sourceConfig)
  );
  const restored = plain(hooks.cloudRosterFromRow(cloud));
  assert.strictEqual(
    JSON.stringify(restored.builds.Hache.weaponConfig),
    JSON.stringify(sourceConfig)
  );

  const team = plain(hooks.normalizeTeam({
    id:"team-1",
    pseudo:"Yannis",
    heroes:[{
      char:"meliodas",
      weapon:HACHE_FILE,
      weaponConfig:sourceConfig
    }]
  }));
  assert.strictEqual(
    JSON.stringify(team.heroes[0].weaponConfig),
    JSON.stringify(sourceConfig)
  );

  const imported = plain(hooks.normalizeTeam(
    JSON.parse(JSON.stringify(team))
  ));
  assert.strictEqual(
    JSON.stringify(imported.heroes[0].weaponConfig),
    JSON.stringify(sourceConfig)
  );

  const duplicated = plain(hooks.normalizeTeam(
    JSON.parse(JSON.stringify(imported))
  ));
  duplicated.id = "team-copy";
  assert.strictEqual(
    JSON.stringify(duplicated.heroes[0].weaponConfig),
    JSON.stringify(sourceConfig)
  );

  const bossSnapshot = plain(JSON.parse(JSON.stringify(team)));
  assert.strictEqual(
    JSON.stringify(bossSnapshot.heroes[0].weaponConfig),
    JSON.stringify(sourceConfig)
  );
}

console.log("PASS stats de builds : modèle et calcul de l’arme");
