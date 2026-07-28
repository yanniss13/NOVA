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
  const engineEnd = source.indexOf("function gearDomainOf", engineStart);
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

/* `uncovered` : ce que les données contiennent mais que le moteur ne calcule
   pas. Les 567 `passiveLevels` des armes ne sont ni au catalogue ni calculés ;
   sans cette déclaration, leur absence passerait pour un vrai zéro et le total
   serait lu comme complet alors qu'il est une borne inférieure. */
{
  const { hooks } = loadApp();
  const result = hooks.calculateWeaponStats(HACHE_FILE, validConfig());
  assert.strictEqual(result.status, "valid");
  assert.deepStrictEqual(
    plain(result.coverage),
    ["weapon"],
    "l'arme est couverte pour ses stats"
  );
  assert.deepStrictEqual(
    plain(result.uncovered),
    ["weapon:passive"],
    "le passif d'arme doit être déclaré non couvert"
  );
  // Un résultat invalide porte le champ malgré tout : la forme reste constante.
  const invalide = hooks.calculateWeaponStats(HACHE_FILE, validConfig({ level:999 }));
  assert.notStrictEqual(invalide.status, "valid");
  assert.deepStrictEqual(plain(invalide.uncovered), []);

  /* Le TEXTE affiché doit suivre `uncovered`, pas seulement le résultat du
     moteur : sans ce contrôle, le titre restait « calcul partiel » alors que le
     total est une borne inférieure. */
  const sujet = { of:"de l’arme", passiveKey:"weapon:passive" };
  assert.strictEqual(
    hooks.buildStatsTitle(sujet, { uncovered:["weapon:passive"] }),
    "Apport de l’arme hors passif — borne inférieure"
  );
  assert.strictEqual(
    hooks.buildStatsTitle(sujet, { uncovered:["autre:chose"] }),
    "Apport de l’arme — borne inférieure"
  );
  assert.strictEqual(
    hooks.buildStatsTitle(sujet, { uncovered:[] }),
    "Apport de l’arme — calcul partiel"
  );
  // Le titre réellement produit pour une arme valide annonce la borne.
  assert.strictEqual(
    hooks.buildStatsTitle(sujet, result),
    "Apport de l’arme hors passif — borne inférieure",
    "le titre doit annoncer une borne inférieure quand le passif manque"
  );
}

/* Perle de sortilège : le nombre d'emplacements de stat dépend du palier.
   Cette table vient du propriétaire, qui joue au jeu — les données de
   7dsorigin ne la portent pas. Ne pas la « corriger » d'après le catalogue.
     commune 1 · remarquable 2 · rare 2 · héroïque 3 · légendaire 4 */
{
  const { hooks } = loadApp();
  const pearlConfig = entries => ({
    version:1,
    gradeGameId:"131065010",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:entries
  });
  const pearl = (slot, tier, element, stat, value) => ({ slot, tier, element, stat, value });

  assert.deepStrictEqual(
    [1, 2, 3, 4, 5].map(tier => hooks.pearlSlotCount(tier)),
    [1, 2, 2, 3, 4],
    "emplacements par palier de perle"
  );

  // Légendaire : quatre emplacements remplis, tous du même palier et du même élément.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_ResRate", 700),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200),
      pearl(3, 5, "generic", "C_Critical_DamRes_Rate", 1200)
    ])),
    "valid",
    "une perle légendaire doit accepter ses quatre stats"
  );

  // Un cinquième emplacement n'existe pas.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_ResRate", 700),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200),
      pearl(3, 5, "generic", "C_Critical_DamRes_Rate", 1200),
      pearl(4, 5, "generic", "Activethird_Damadd_Rate", 2000)
    ])),
    "incompatible",
    "une perle légendaire n'a pas de cinquième emplacement"
  );

  // Héroïque : trois emplacements, et ce palier n'a pas d'élément.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500),
      pearl(1, 4, null, "B_Def_Equip", 400),
      pearl(2, 4, null, "B_MaxHp_Equip", 1000)
    ])),
    "valid",
    "une perle héroïque doit accepter ses trois stats"
  );

  // Commune : un seul emplacement.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 1, null, "B_Atk_Equip", 100),
      pearl(1, 1, null, "B_Def_Equip", 80)
    ])),
    "incompatible",
    "une perle commune n'a qu'un emplacement"
  );

  // Une seule perle par arme : ni deux paliers, ni deux éléments.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500),
      pearl(1, 3, null, "B_Def_Equip", 300),
      pearl(2, 4, null, "B_MaxHp_Equip", 1000)
    ])),
    "incompatible",
    "deux paliers différents sur la même perle"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "fire", "C_Critical_ResRate", 700),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200),
      pearl(3, 5, "generic", "C_Critical_DamRes_Rate", 1200)
    ])),
    "incompatible",
    "deux éléments différents sur la même perle"
  );

  /* Le jeu interdit deux fois la même stat sur une perle (confirmé par le
     propriétaire). Deux emplacements encore vides ne comptent pas comme un
     doublon. */
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_Rate", 800),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200),
      pearl(3, 5, "generic", "C_Critical_DamRes_Rate", 1200)
    ])),
    "incompatible",
    "deux fois la même stat sur une perle"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500),
      pearl(1, 4, null, "", null),
      pearl(2, 4, null, "", null)
    ])),
    "incomplete",
    "deux emplacements vides ne sont pas des doublons"
  );

  /* Saisie en cours : incomplète, jamais incompatible — distinction introduite
     par le correctif de revue finale, à ne pas casser. */
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500),
      pearl(1, 4, null, "B_Def_Equip", 400),
      pearl(2, 4, null, "", null)
    ])),
    "incomplete",
    "une perle héroïque à moitié remplie est incomplète"
  );
}

// Une pièce d'équipement possède un modèle de configuration indépendant de l'arme.
{
  const { hooks } = loadApp();
  const FILE = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const definition = hooks.buildGearDefinition(FILE);
  assert.ok(definition, "la pièce doit exister au catalogue");

  assert.strictEqual(hooks.gearConfigStatus(FILE, undefined), "missing");
  assert.strictEqual(
    hooks.gearConfigStatus("7ds-armures-ssr/Haut/inconnu.webp", null),
    "unavailable"
  );

  const base = hooks.emptyGearConfig(FILE);
  assert.strictEqual(base.level, definition.qualityMin);
  assert.strictEqual(base.reinforce, 0);
  assert.strictEqual(
    base.enchantments.length,
    definition.randomOptions ? definition.randomOptions.slots : 0
  );
  assert.strictEqual(hooks.gearConfigStatus(FILE, base), "valid");

  assert.strictEqual(
    hooks.gearConfigStatus(FILE, {
      ...base,
      level:definition.qualityMax + 1
    }),
    "incompatible",
    "un niveau supérieur à la qualité maximale doit être refusé"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(FILE, {
      ...base,
      level:definition.qualityMin - 1
    }),
    "incompatible"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(FILE, {
      ...base,
      reinforce:definition.reinforceMax + 1
    }),
    "incompatible"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(FILE, { ...base, reinforce:-1 }),
    "incompatible"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(FILE, { ...base, version:2 }),
    "incompatible"
  );

  const ENGRAVED =
    "7ds-armures-ssr/Armure liee/Arrogance adéquate.webp";
  const engraved = hooks.emptyGearConfig(ENGRAVED);
  assert.strictEqual(engraved.enchantments.length, 3);
  assert.strictEqual(hooks.gearConfigStatus(ENGRAVED, engraved), "valid");
  const attackOption = {
    slot:0,
    stat:"I_AtkAdd_Rate",
    value:315
  };
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[attackOption, null, null]
    }),
    "valid"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[{ ...attackOption, value:null }, null, null]
    }),
    "incomplete"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[{ ...attackOption, stat:"stat-inconnue" }, null, null]
    }),
    "incompatible"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[{ ...attackOption, value:314 }, null, null]
    }),
    "incompatible"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[attackOption, { ...attackOption, slot:1 }, null]
    }),
    "incompatible",
    "une même stat ne peut pas occuper deux emplacements"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[attackOption]
    }),
    "incomplete"
  );
  assert.strictEqual(
    hooks.gearConfigStatus(ENGRAVED, {
      ...engraved,
      enchantments:[null, null, null, null]
    }),
    "incompatible"
  );
}

// La valeur d'une pièce suit ses segments de qualité, puis son renforcement.
{
  const { hooks } = loadApp();
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[119] }), 1);
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[60, 70] }), 1);
  assert.strictEqual(
    hooks.gearSegmentCount({ tierBoundaries:[95, 112, 119, 125] }),
    3
  );
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[] }), 1);
  assert.deepStrictEqual(
    [0, 1, 2, 3, 4, 5].map(hooks.reinforceMultiplier),
    [1, 1.03, 1.07, 1.12, 1.18, 1.25]
  );

  const definition = {
    tierBoundaries:[119],
    qualityMin:120,
    qualityMax:160,
    reinforceMax:5
  };
  const curve = { base:0, progression:[3073] };
  const add = { base:0, progression:[35] };
  assert.strictEqual(
    hooks.gearStatValue(definition, curve, add, 120, 0),
    3073
  );
  assert.strictEqual(
    hooks.gearStatValue(definition, curve, add, 160, 0),
    3073 + 35 * 40
  );
  assert.strictEqual(
    hooks.gearStatValue(definition, curve, add, 120, 5),
    Math.round(3073 * 1.25)
  );

  const segmented = {
    tierBoundaries:[95, 112, 119, 125],
    qualityMin:96,
    qualityMax:125
  };
  assert.strictEqual(hooks.gearSegmentIndex(segmented, 112), 0);
  assert.strictEqual(hooks.gearSegmentIndex(segmented, 113), 1);
  assert.strictEqual(hooks.gearSegmentIndex(segmented, 120), 2);
  assert.strictEqual(hooks.gearLevelOrigin(segmented, 2), 120);
  assert.strictEqual(
    hooks.gearStatValue(
      segmented,
      { base:0, progression:[1000, 2000, 3000] },
      { base:0, progression:[10, 20, 30] },
      122,
      0
    ),
    3060
  );
  assert.strictEqual(
    hooks.ARMOR_LEVEL_ORIGIN_MODE,
    "segment-lower-bound"
  );
}

// Chaque pièce produit des termes reconstructibles et déclare ses manques connus.
{
  const { hooks } = loadApp();
  const FILE = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const config = hooks.emptyGearConfig(FILE);
  const result = hooks.calculateGearStats(FILE, config, "Haut");
  assert.strictEqual(result.status, "valid");
  assert.deepStrictEqual(plain(result.coverage), ["armor"]);
  assert.deepStrictEqual(plain(result.uncovered), []);
  assert.strictEqual(
    result.assumptions.armorLevelOrigin,
    "segment-lower-bound"
  );
  assert.deepStrictEqual(
    [...new Set(result.terms.map(term => term.bucket))],
    ["armor:Haut"]
  );
  result.terms.forEach(term => {
    assert.ok(
      term.unit === "flat" || term.unit === "ten-thousandths",
      "chaque terme doit déclarer son unité"
    );
    assert.strictEqual(term.operation, "add");
    assert.strictEqual(term.confidence, "presumed");
    assert.strictEqual(term.source.domain, "armor");
  });
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(result.terms)),
    plain(result.totals),
    "les totaux doivent être reconstruits uniquement depuis les termes"
  );

  const ENGRAVED =
    "7ds-armures-ssr/Armure liee/Arrogance adéquate.webp";
  const engraving = hooks.calculateGearStats(
    ENGRAVED,
    hooks.emptyGearConfig(ENGRAVED),
    "Armure liee"
  );
  assert.deepStrictEqual(plain(engraving.coverage), ["engraving"]);
  assert.deepStrictEqual(
    plain(engraving.uncovered),
    ["engraving:passive"]
  );
  assert.ok(
    engraving.terms.some(term => term.source.extra === true),
    "les contributions extraStats de la gravure doivent être calculées"
  );

  const PASSIVE =
    "7ds-armures-ssr/Bas/Bas de la puissance retorse.webp";
  const passiveConfig = hooks.emptyGearConfig(PASSIVE);
  passiveConfig.enchantments[0] = {
    slot:0,
    stat:"Aerialattack_Damadd_Rate",
    value:1381
  };
  const passive = hooks.calculateGearStats(PASSIVE, passiveConfig, "Bas");
  assert.deepStrictEqual(plain(passive.uncovered), ["armor:passive"]);
  const enchantmentTerm = passive.terms.find(
    term => term.source.component === "enchantment"
  );
  assert.ok(enchantmentTerm, "l'option aléatoire doit produire un terme");
  assert.strictEqual(enchantmentTerm.value, 1381);
  assert.strictEqual(enchantmentTerm.confidence, "exact");

  const withoutOptions = Object.entries(hooks.buildGearCatalog())
    .find(([, item]) => !item.randomOptions);
  assert.ok(withoutOptions, "il existe des pièces sans option aléatoire");
  const noOptions = hooks.calculateGearStats(
    withoutOptions[0],
    hooks.emptyGearConfig(withoutOptions[0]),
    "Haut"
  );
  assert.deepStrictEqual(plain(noOptions.coverage), ["armor"]);
  assert.strictEqual(
    noOptions.terms.some(term => term.source.component === "enchantment"),
    false
  );

  const invalid = hooks.calculateGearStats(
    FILE,
    { ...config, level:9999 },
    "Haut"
  );
  assert.strictEqual(invalid.status, "incompatible");
  assert.deepStrictEqual(plain(invalid.terms), []);
  assert.deepStrictEqual(plain(invalid.totals), []);
  assert.deepStrictEqual(plain(invalid.coverage), []);
  assert.deepStrictEqual(plain(invalid.uncovered), []);
}

console.log("PASS stats de builds : modèle et calcul de l’arme");
