"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadApp, plain } = require("./helpers/load-app");

const HACHE_FILE = "7ds-armes/Hache/hache.webp";
const EPEE_FILE = "7ds-armes/Epee 1 main/epee.webp";
const DOUBLE_FILE = "7ds-armes/Epees doubles/doubles.webp";
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

function fakeNodes(root, predicate){
  const matches = [];
  const visit = node => {
    if(!node || typeof node !== "object") return;
    if(predicate(node)) matches.push(node);
    (node.children || []).forEach(visit);
  };
  visit(root);
  return matches;
}

function fakeText(root){
  return fakeNodes(root, () => true)
    .map(node => node.textContent || "")
    .join(" ");
}

function merlinGameFixture(hooks){
  const weaponConfig = (gradeGameId, overlimit) => ({
    version:1,
    gradeGameId,
    level:50,
    promotion:4,
    overlimit,
    enchantments:[null]
  });
  const gearConfig = (file, level, reinforce, enchantments) => {
    const config = plain(hooks.emptyGearConfig(file));
    config.level = level;
    config.reinforce = reinforce;
    if(enchantments) config.enchantments = enchantments;
    return config;
  };
  const weapon =
    "7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp";
  const armor = {
    Haut:"7ds-armures-ssr/Haut/Haut du souverain cupide.webp",
    Bas:"7ds-armures-ssr/Bas/Bas du souverain cupide.webp",
    Bottes:"7ds-armures-ssr/Bottes/Bottes de combat du souverain cupide.webp",
    Ceinture:"7ds-armures-ssr/Ceinture/Ceinture du souverain cupide.webp",
    "Armure liee":
      "7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp"
  };
  const jewel = {
    Anneau:"7ds-bijoux/Anneau/Anneau du souverain cupide.webp",
    Collier:"7ds-bijoux/Collier/Collier du souverain cupide.webp",
    "Boucle d'oreille":
      "7ds-bijoux/Boucle d'oreille/Boucles d'oreilles du souverain cupide.webp"
  };
  const activeWeaponConfig = weaponConfig("131065005", 6);
  activeWeaponConfig.enchantments = [
    {
      slot:0, tier:5, element:"thunder",
      stat:"Thunder_Element_Rate", value:1680
    },
    {
      slot:1, tier:5, element:"thunder",
      stat:"C_Critical_Dam_Rate", value:1681
    },
    {
      slot:2, tier:5, element:"thunder",
      stat:"Normalskill_Damadd_Rate", value:2045
    },
    {
      slot:3, tier:5, element:"thunder",
      stat:"Normalskillchangetag_Damadd_Rate", value:2722
    }
  ];
  const hero = {
    char:"merlin",
    weapon,
    weaponConfig:activeWeaponConfig,
    armor,
    armorConfig:{
      Haut:gearConfig(armor.Haut, 159, 5),
      Bas:gearConfig(armor.Bas, 159, 5),
      Bottes:gearConfig(armor.Bottes, 156, 5),
      Ceinture:gearConfig(armor.Ceinture, 159, 5),
      "Armure liee":gearConfig(
        armor["Armure liee"],
        129,
        5,
        [
          { slot:0, stat:"Normalskill_Damadd_Rate", value:1766 },
          { slot:1, stat:"TickDam_Rate", value:2930 },
          { slot:2, stat:"C_Critical_Rate", value:450 }
        ]
      )
    },
    jewel,
    jewelConfig:{
      Anneau:gearConfig(jewel.Anneau, 160, 5, [
        { slot:0, stat:"C_Critical_Dam_Rate", value:1205 }
      ]),
      Collier:gearConfig(jewel.Collier, 158, 5, [
        { slot:0, stat:"C_Critical_DamRes_Rate", value:669 }
      ]),
      "Boucle d'oreille":gearConfig(jewel["Boucle d'oreille"], 160, 5, [
        { slot:0, stat:"Fire_Burst_Gauge_Rate", value:789 }
      ])
    },
    potentiel:{ tier:7 },
    note:"",
    activeWeaponType:"Baguette",
    rosterBuilds:{}
  };
  hero.armorConfig["Armure liee"].passiveLevel = 3;
  hero.rosterBuilds.Baguette = plain(hooks.teamBuildSnapshot(hero));
  hero.rosterBuilds.Livre = {
    ...plain(hero.rosterBuilds.Baguette),
    weapon:"7ds-armes/Livre/Grimoire de l'âme vorace.webp",
    weaponConfig:weaponConfig("131105010", 5)
  };
  hero.rosterBuilds.Baton = {
    ...plain(hero.rosterBuilds.Baguette),
    weapon:"7ds-armes/Baton/Bâton des ailes de la flamme noire.webp",
    weaponConfig:weaponConfig("131015005", 3)
  };
  return hero;
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
  const chainedMultipliers = [
    { ...bucketTerms[0], value:100 },
    {
      ...bucketTerms[2],
      id:"weapon-overlimit",
      value:5000,
      bucket:"weapon-overlimit"
    },
    {
      ...bucketTerms[2],
      id:"hero-rate",
      value:2000,
      appliesTo:["weapon-native", "weapon-overlimit"],
      source:{ domain:"potential", component:"hero-main-rate" }
    }
  ];
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(chainedMultipliers)),
    [{ stat:"B_Atk_Equip", unit:"flat", value:180 }],
    "un taux du héros doit inclure le bonus produit par l’outrepassement"
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
  assert.strictEqual(
    result.terms.some(term =>
      term.operation === "multiply"
      && term.source.component === "overlimit"
      && term.stat === "critRate"
    ),
    false,
    "l’outrepassement ne doit jamais multiplier une sous-statistique"
  );
  assert.strictEqual(
    result.totals.find(total => total.stat === "B_Atk_Equip").value,
    16,
    "la statistique principale finale de l’arme est arrondie au supérieur"
  );
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
    fact.source.component === "passive" && fact.level === 2
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

// L'import roster conserve les trois builds par valeur et un changement
// Hache -> Épée -> Hache ne perd jamais le brouillon de départ.
{
  const { hooks } = loadApp();
  const favoriteConfig = validConfig();
  const targetConfig = validConfig({ level:4 });
  const doubleConfig = validConfig({ level:2 });
  const entry = {
    charId:"meliodas",
    builds:{
      Hache:{ weapon:HACHE_FILE, weaponConfig:favoriteConfig, favorite:true },
      "Epee 1 main":{ weapon:EPEE_FILE, weaponConfig:targetConfig, favorite:false },
      "Epees doubles":{
        weapon:DOUBLE_FILE,
        weaponConfig:doubleConfig,
        favorite:false
      }
    }
  };
  const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
  assert.deepStrictEqual(
    Object.keys(snapshot.rosterBuilds).sort(),
    ["Epee 1 main", "Epees doubles", "Hache"].sort()
  );
  assert.strictEqual(snapshot.activeWeaponType, "Hache");
  assert.strictEqual("favorite" in snapshot.rosterBuilds.Hache, false);
  assert.deepStrictEqual(snapshot.weaponConfig, favoriteConfig);
  favoriteConfig.level = 7;
  assert.strictEqual(snapshot.weaponConfig.level, 0);

  snapshot.weaponConfig.level = 8;
  const sword = plain(hooks.activateHeroBuild(snapshot, "Epee 1 main"));
  assert.strictEqual(sword.activeWeaponType, "Epee 1 main");
  assert.strictEqual(sword.weaponConfig.level, 4);
  const returned = plain(hooks.activateHeroBuild(sword, "Hache"));
  assert.strictEqual(returned.activeWeaponType, "Hache");
  assert.strictEqual(returned.weaponConfig.level, 8);

  const legacy = plain(hooks.normalizeHero({
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:validConfig(),
    potentiel:{tier:7}
  }));
  assert.deepStrictEqual(Object.keys(legacy.rosterBuilds), ["Hache"]);
  assert.strictEqual(legacy.activeWeaponType, "Hache");

  const changedCharacter = plain(hooks.normalizeHero({
    ...snapshot,
    char:"merlin"
  }));
  assert.deepStrictEqual(changedCharacter.rosterBuilds, {});
  assert.strictEqual(changedCharacter.weapon, null);

  assert.strictEqual(
    typeof hooks.applyCharacterChange,
    "function"
  );
  const changed = plain(
    hooks.applyCharacterChange(snapshot, "merlin")
  );
  assert.strictEqual(changed.char, "merlin");
  assert.deepStrictEqual(changed.rosterBuilds, {});
  assert.strictEqual(changed.weapon, null);
  assert.strictEqual(changed.activeWeaponType, null);
  assert.strictEqual(
    changed.potentiel.tier,
    snapshot.potentiel.tier
  );

  assert.strictEqual(
    typeof hooks.rosterEntryWithActiveHeroBuild,
    "function"
  );
  const existing = plain(hooks.normalizeRosterCharacter({
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:entry.builds,
    updatedAt:123
  }));
  const inactiveBefore = {
    sword:JSON.stringify(existing.builds["Epee 1 main"]),
    dual:JSON.stringify(existing.builds["Epees doubles"])
  };
  const activeDraft = plain(returned);
  activeDraft.potentiel = {tier:9};
  const targeted = plain(
    hooks.rosterEntryWithActiveHeroBuild(
      existing,
      activeDraft,
      "user-1"
    )
  );
  assert.strictEqual(targeted.potentialTier, 9);
  assert.strictEqual(targeted.builds.Hache.weaponConfig.level, 8);
  assert.strictEqual(targeted.builds.Hache.favorite, true);
  assert.strictEqual(
    JSON.stringify(targeted.builds["Epee 1 main"]),
    inactiveBefore.sword
  );
  assert.strictEqual(
    JSON.stringify(targeted.builds["Epees doubles"]),
    inactiveBefore.dual
  );

  assert.strictEqual(
    typeof hooks.rosterBaselineIdentityMatches,
    "function"
  );
  assert.strictEqual(
    hooks.rosterBaselineIdentityMatches(
      { ownerId:"user-1", charId:"meliodas" },
      "user-1",
      "meliodas"
    ),
    true
  );
  assert.strictEqual(
    hooks.rosterBaselineIdentityMatches(
      { ownerId:"user-1", charId:"meliodas" },
      "user-2",
      "meliodas"
    ),
    false
  );
  assert.strictEqual(
    hooks.rosterBaselineIdentityMatches(
      { ownerId:"user-1", charId:"meliodas" },
      "user-1",
      "merlin"
    ),
    false
  );
  assert.strictEqual(
    typeof hooks.rosterBaselineVersionMatches,
    "function"
  );
  const firstMicrosecond = "2026-07-25T08:40:00.123456Z";
  const secondMicrosecond = "2026-07-25T08:40:00.123789Z";
  assert.strictEqual(
    hooks.rosterBaselineVersionMatches(
      {
        updatedAt:Date.parse(firstMicrosecond),
        updatedAtToken:firstMicrosecond
      },
      {
        updatedAt:Date.parse(secondMicrosecond),
        updatedAtToken:secondMicrosecond
      }
    ),
    false
  );
  assert.strictEqual(
    hooks.rosterBaselineVersionMatches(
      { updatedAt:Date.parse(firstMicrosecond), updatedAtToken:"" },
      { updatedAt:Date.parse(secondMicrosecond), updatedAtToken:"" }
    ),
    true,
    "un ancien cache sans jeton conserve le repli milliseconde"
  );

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

  const preciseTimestamp = "2026-07-25T08:40:00.123456Z";
  const precise = plain(hooks.cloudRosterFromRow({
    owner:"user-1",
    char_id:"meliodas",
    potential_tier:7,
    builds:cloud.builds,
    updated_at:preciseTimestamp
  }));
  assert.strictEqual(precise.updatedAt, Date.parse(preciseTimestamp));
  assert.strictEqual(
    precise.updatedAtToken,
    preciseTimestamp,
    "le jeton CAS doit conserver les microsecondes PostgreSQL"
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
  assert.deepStrictEqual(
    [1, 2, 3, 4, 5].map(tier => hooks.pearlRequiredSlotCount(tier)),
    [1, 2, 2, 2, 3],
    "emplacements obligatoires par palier de perle"
  );

  // Le dernier emplacement Héroïque n'est pas garanti dans le jeu.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500),
      pearl(1, 4, null, "B_Def_Equip", 400)
    ])),
    "valid",
    "une perle héroïque doit être valide avec ses deux stats garanties"
  );
  const normalizedHeroic = hooks.normalizeWeaponConfig(
    BAGUETTE_VORACE_FILE,
    pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500),
      pearl(1, 4, null, "B_Def_Equip", 400)
    ])
  );
  assert.strictEqual(
    normalizedHeroic.enchantments.length,
    3,
    "la normalisation conserve l'emplacement héroïque facultatif"
  );
  assert.strictEqual(
    normalizedHeroic.enchantments[2],
    null,
    "l'emplacement héroïque facultatif vide est normalisé à null"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 4, null, "B_Atk_Equip", 500)
    ])),
    "incomplete",
    "une perle héroïque conserve deux stats obligatoires"
  );

  // Le dernier emplacement Légendaire n'est pas garanti dans le jeu.
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_ResRate", 700),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200)
    ])),
    "valid",
    "une perle légendaire doit être valide avec ses trois stats garanties"
  );
  const normalizedLegendary = hooks.normalizeWeaponConfig(
    BAGUETTE_VORACE_FILE,
    pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_ResRate", 700),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200)
    ])
  );
  assert.strictEqual(
    normalizedLegendary.enchantments.length,
    4,
    "la normalisation conserve l'emplacement légendaire facultatif"
  );
  assert.strictEqual(
    normalizedLegendary.enchantments[3],
    null,
    "l'emplacement légendaire facultatif vide est normalisé à null"
  );
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_ResRate", 700)
    ])),
    "incomplete",
    "une perle légendaire conserve trois stats obligatoires"
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
  assert.strictEqual(
    hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
      pearl(0, 5, "generic", "C_Critical_Rate", 700),
      pearl(1, 5, "generic", "C_Critical_ResRate", 700),
      pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200),
      pearl(3, 5, "generic", "C_Critical_DamRes_Rate", 999999)
    ])),
    "incompatible",
    "un emplacement facultatif rempli conserve les bornes du catalogue"
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
  assert.strictEqual(base.passiveLevel, null);
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

// La base fixe, la maîtrise maximale et le potentiel commun restent traçables.
{
  const { hooks } = loadApp();
  const definition = hooks.characterDefinitionForHero({ char:"meliodas" });
  assert.ok(definition, "Meliodas doit être présent dans le catalogue local");

  const base = plain(hooks.characterBaseTerms(definition));
  assert.strictEqual(base.length, 13);
  assert.ok(base.some(term =>
    term.stat === "B_Atk"
    && term.value === 250
    && term.unit === "flat"
    && term.bucket === "character:base"
    && term.source.field === "baseAtk"
  ));
  assert.ok(base.some(term =>
    term.stat === "critRate"
    && term.value === 1000
    && term.unit === "ten-thousandths"
  ));

  const mastery = plain(hooks.fullMasteryTerms(definition, "Axe"));
  assert.strictEqual(
    mastery.length,
    definition.commonMasteryStats.length
      + definition.masteriesByWeapon.Axe.abilities.length
  );
  assert.ok(mastery.some(term =>
    term.bucket === "mastery:common"
    && term.source.component === "common-mastery"
  ));
  assert.ok(mastery.some(term =>
    term.bucket === "mastery:Axe"
    && term.source.component === "weapon-mastery"
    && term.source.kind === "node"
  ));
  assert.strictEqual(
    mastery.some(term => term.bucket === "mastery:Sword1h"),
    false,
    "une autre branche de maîtrise ne doit pas contribuer"
  );

  assert.strictEqual(
    typeof hooks.reserveMasteryTerms,
    "function",
    "le moteur doit exposer les apports de maîtrise des armes de réserve"
  );
  const merlinDefinition = hooks.characterDefinitionForHero({ char:"merlin" });
  const reserve = plain(hooks.reserveMasteryTerms(merlinDefinition, "Wand"));
  const reserveTotals = Object.fromEntries(
    ["B_Atk", "B_Def", "B_MaxHp", "I_AtkAdd_Rate", "I_DefAdd_Rate",
      "I_MaxHpAdd_Rate", "A_Accuracy", "A_Block"].map(stat => [
      stat,
      reserve
        .filter(term => term.stat === stat)
        .reduce((sum, term) => sum + term.value, 0)
    ])
  );
  assert.deepStrictEqual(reserveTotals, {
    B_Atk:1764,
    B_Def:1134,
    B_MaxHp:3024,
    I_AtkAdd_Rate:2400,
    I_DefAdd_Rate:2400,
    I_MaxHpAdd_Rate:2400,
    A_Accuracy:202,
    A_Block:145
  });
  assert.ok(reserve.every(term =>
    ["Book", "Staff"].includes(term.source.weaponType)
    && term.source.component === "reserve-weapon-mastery"
    && (term.source.kind === "subLevel"
      || (term.source.kind === "node" && term.source.nodeType === "Special"))
  ));

  assert.deepStrictEqual(plain(hooks.potentialTerms(definition, "Axe", 0)), []);
  const p3 = plain(hooks.potentialTerms(definition, "Axe", 3));
  assert.deepStrictEqual(
    p3.map(term => [term.stat, term.value]),
    [
      ["I_AtkAdd_Rate", 1500],
      ["I_DefAdd_Rate", 1200],
      ["I_MaxHpAdd_Rate", 500]
    ],
    "P3 est un instantané cumulé et ne doit pas additionner P1+P2+P3"
  );
  assert.ok(p3.every(term =>
    term.bucket === "potential:Axe:3"
    && term.source.component === "potential"
    && term.source.tier === 3
  ));

  const canonical = plain(hooks.canonicalHeroTerm({
    id:"armor",
    stat:"B_Atk_Equip",
    operation:"add",
    value:100,
    unit:"flat",
    bucket:"armor:Haut",
    family:"main",
    source:{ domain:"armor", component:"level" },
    confidence:"exact"
  }));
  assert.strictEqual(canonical.stat, "B_Atk");
  assert.strictEqual(canonical.source.originalStat, "B_Atk_Equip");
  assert.strictEqual(
    hooks.canonicalHeroTerm({
      ...canonical,
      stat:"A_Accuracy",
      source:{ domain:"armor", component:"level" }
    }).stat,
    "A_Accuracy",
    "aucun rapprochement implicite des autres codes n'est autorisé"
  );

  [base, mastery, p3].flat().forEach(term => {
    assert.strictEqual(term.operation, "add");
    assert.strictEqual(term.confidence, "exact");
    assert.ok(term.source.domain);
    assert.ok(term.source.component);
  });
}

// Le niveau du passif de pièce est persistant mais ne participe jamais au calcul.
{
  const { hooks } = loadApp();
  const NORMAL = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const PASSIVE = "7ds-armures-ssr/Bas/Bas de la puissance retorse.webp";
  const passiveDefinition = hooks.buildGearDefinition(PASSIVE);
  const passiveConfig = hooks.emptyGearConfig(PASSIVE);

  assert.strictEqual(hooks.GEAR_PASSIVE_MAX_LEVEL, 3);
  assert.strictEqual(hooks.WEAPON_PASSIVE_MAX_LEVEL, 7);
  assert.strictEqual(
    hooks.gearPassiveStatus(hooks.buildGearDefinition(NORMAL), passiveConfig),
    "not-applicable"
  );
  assert.strictEqual(
    hooks.gearPassiveStatus(passiveDefinition, passiveConfig),
    "missing"
  );
  assert.strictEqual(
    hooks.gearPassiveStatus(passiveDefinition, { ...passiveConfig, passiveLevel:1 }),
    "valid"
  );
  assert.strictEqual(
    hooks.gearPassiveStatus(passiveDefinition, { ...passiveConfig, passiveLevel:3 }),
    "valid"
  );
  assert.strictEqual(
    hooks.gearPassiveStatus(passiveDefinition, { ...passiveConfig, passiveLevel:0 }),
    "incompatible"
  );
  assert.strictEqual(
    hooks.gearPassiveStatus(passiveDefinition, { ...passiveConfig, passiveLevel:4 }),
    "incompatible"
  );

  const withoutLevel = hooks.calculateGearStats(PASSIVE, passiveConfig, "Bas");
  const withLevel = hooks.calculateGearStats(
    PASSIVE,
    { ...passiveConfig, passiveLevel:3 },
    "Bas"
  );
  assert.deepStrictEqual(plain(withLevel.terms), plain(withoutLevel.terms));
  assert.deepStrictEqual(plain(withLevel.totals), plain(withoutLevel.totals));
  assert.strictEqual(
    hooks.gearConfigStatus(PASSIVE, { ...passiveConfig, passiveLevel:99 }),
    "valid",
    "le statut numérique ne dépend pas du passif"
  );

  const oldHero = hooks.normalizeHero({
    char:"meliodas",
    armor:{ Bas:PASSIVE },
    armorConfig:{ Bas:{
      version:1,
      level:passiveDefinition.qualityMin,
      reinforce:0,
      enchantments:Array.from({
        length:passiveDefinition.randomOptions
          ? passiveDefinition.randomOptions.slots : 0
      }, () => null)
    }}
  });
  assert.strictEqual(oldHero.armorConfig.Bas.passiveLevel, null);
  oldHero.armorConfig.Bas.passiveLevel = 2;
  const copied = hooks.normalizeHero(plain(oldHero));
  assert.strictEqual(copied.armorConfig.Bas.passiveLevel, 2);
  copied.armorConfig.Bas.passiveLevel = 1;
  assert.strictEqual(oldHero.armorConfig.Bas.passiveLevel, 2);

  const weaponFact = hooks.weaponPassiveFact(
    hooks.buildWeaponDefinition(HACHE_FILE),
    { overlimit:6 }
  );
  assert.strictEqual(weaponFact.level, 7);
  assert.strictEqual(weaponFact.maxLevel, 7);
  assert.strictEqual(weaponFact.text, "Passif arme 7");
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
    Math.ceil(3073 * 1.25)
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

// Les ensembles suivent leurs seuils réels et le build agrège toutes les sources.
{
  const { hooks } = loadApp();
  const sets = hooks.buildGearSets();
  const catalog = hooks.buildGearCatalog();
  const threePiece = Object.entries(sets)
    .find(([, item]) => item.twoCount === 3);
  assert.ok(threePiece, "il existe un ensemble dont le premier seuil vaut trois");
  const threeFiles = Object.keys(catalog)
    .filter(file => catalog[file].setId === threePiece[0]);
  assert.ok(threeFiles.length >= 3);
  assert.strictEqual(
    hooks.activeGearSets(threeFiles.slice(0, 2))[0].twoActive,
    false,
    "deux pièces ne doivent pas activer un seuil à trois"
  );
  assert.deepStrictEqual(
    plain(hooks.gearSetTerms(threeFiles.slice(0, 2))),
    []
  );
  const firstTier = hooks.gearSetTerms(threeFiles.slice(0, 3));
  assert.ok(firstTier.length > 0);
  firstTier.forEach(term => {
    assert.strictEqual(term.bucket, "set");
    assert.strictEqual(term.source.domain, "set");
    assert.strictEqual(term.source.tier, "two");
    assert.strictEqual(term.confidence, "exact");
  });

  const sixPiece = Object.entries(sets)
    .find(([, item]) => item.sevenCount === 6);
  assert.ok(sixPiece, "un ensemble local possède un troisième seuil à six");
  const sixFiles = Object.keys(catalog)
    .filter(file => catalog[file].setId === sixPiece[0]);
  assert.strictEqual(
    hooks.activeGearSets(sixFiles.slice(0, 5))[0].sevenActive,
    false
  );
  assert.strictEqual(
    hooks.activeGearSets(sixFiles.slice(0, 6))[0].sevenActive,
    true
  );
  assert.ok(
    hooks.gearSetTerms(sixFiles.slice(0, 6))
      .some(term => term.source.tier === "seven"),
    "le troisième palier doit produire ses propres termes"
  );

  const orphan = Object.keys(catalog).find(file => !catalog[file].setId);
  assert.ok(orphan);
  assert.deepStrictEqual(plain(hooks.activeGearSets([orphan])), []);

  const empty = hooks.calculateBuildStats({
    weapon:null,
    armor:{},
    jewel:{}
  });
  assert.deepStrictEqual(plain(empty.coverage), []);
  assert.deepStrictEqual(plain(empty.uncovered), []);
  assert.deepStrictEqual(plain(empty.terms), []);

  const ARMOR = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const ENGRAVED =
    "7ds-armures-ssr/Armure liee/Arrogance adéquate.webp";
  const build = {
    weapon:HACHE_FILE,
    weaponConfig:validConfig(),
    armor:{
      Haut:ARMOR,
      "Armure liee":ENGRAVED
    },
    armorConfig:{
      Haut:hooks.emptyGearConfig(ARMOR),
      "Armure liee":hooks.emptyGearConfig(ENGRAVED)
    },
    jewel:{},
    jewelConfig:{}
  };
  const aggregate = hooks.calculateBuildStats(build);
  assert.deepStrictEqual(
    plain(aggregate.coverage),
    ["weapon", "armor", "engraving"]
  );
  assert.deepStrictEqual(
    plain(aggregate.uncovered),
    ["weapon:passive", "engraving:passive"]
  );
  assert.strictEqual(aggregate.statuses.weapon, "valid");
  assert.strictEqual(aggregate.statuses["armor:Haut"], "valid");
  assert.strictEqual(
    aggregate.statuses["engraving:Armure liee"],
    "valid"
  );
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(aggregate.terms)),
    plain(aggregate.totals)
  );

  const missing = hooks.calculateBuildStats({
    weapon:null,
    armor:{ Haut:ARMOR },
    jewel:{}
  });
  assert.strictEqual(missing.statuses["armor:Haut"], "missing");
  assert.deepStrictEqual(plain(missing.coverage), []);
}

// Le héros complet est tout-ou-rien et expose une décomposition reconstructible.
{
  const { hooks } = loadApp();
  const catalog = hooks.buildGearCatalog();
  const firstValid = slot => Object.keys(catalog).find(file => {
    const definition = hooks.buildGearDefinition(file);
    const config = hooks.emptyGearConfig(file);
    return definition.slot === slot
      && config
      && hooks.gearConfigStatus(file, config) === "valid";
  });
  const PASSIVE =
    "7ds-armures-ssr/Bas/Bas de la puissance retorse.webp";
  const armor = {
    Haut:firstValid("Top"),
    Bas:PASSIVE,
    Bottes:firstValid("Shoes"),
    Ceinture:firstValid("Belt"),
    "Armure liee":
      "7ds-armures-ssr/Armure liee/Défense simple.webp"
  };
  const jewel = {
    Anneau:firstValid("Ring"),
    Collier:firstValid("Necklace"),
    "Boucle d'oreille":firstValid("Earring")
  };
  Object.values(armor).concat(Object.values(jewel)).forEach(file => {
    assert.ok(file, "chaque emplacement de la fixture doit avoir une pièce");
  });
  const hero = {
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:validConfig(),
    armor,
    armorConfig:Object.fromEntries(
      Object.entries(armor).map(([slot, file]) => [
        slot,
        hooks.emptyGearConfig(file)
      ])
    ),
    jewel,
    jewelConfig:Object.fromEntries(
      Object.entries(jewel).map(([slot, file]) => [
        slot,
        hooks.emptyGearConfig(file)
      ])
    ),
    potentiel:{ tier:0 },
    note:""
  };
  const baseSnapshot = plain(hooks.teamBuildSnapshot(hero));
  hero.activeWeaponType = "Hache";
  hero.rosterBuilds = {
    Hache:plain(baseSnapshot),
    "Epee 1 main":{
      ...plain(baseSnapshot),
      weapon:EPEE_FILE,
      weaponConfig:{
        version:1,
        gradeGameId:"grade-sword",
        level:10,
        promotion:1,
        overlimit:1,
        enchantments:[{
          slot:0,
          tier:null,
          element:null,
          stat:"B_Atk_Equip",
          value:100
        }]
      }
    },
    "Epees doubles":{
      ...plain(baseSnapshot),
      weapon:DOUBLE_FILE,
      weaponConfig:{
        version:1,
        gradeGameId:"grade-dual",
        level:0,
        promotion:0,
        overlimit:0,
        enchantments:[{
          slot:0,
          tier:null,
          element:null,
          stat:"I_AtkAdd_Rate",
          value:3000
        }]
      }
    }
  };

  assert.strictEqual(
    hooks.HERO_MAIN_RATE_APPLICATION_MODE,
    "all-flat-before-passives"
  );
  assert.strictEqual(
    hooks.SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE,
    "before-hero-rates"
  );
  const result = plain(hooks.calculateHeroStats(hero));
  assert.strictEqual(result.status, "valid");
  assert.deepStrictEqual(result.coverage, [
    "character",
    "mastery",
    "potential",
    "weapon",
    "armor",
    "jewel",
    "engraving",
    "set",
    "secondary-weapon"
  ]);
  assert.deepStrictEqual(result.partialStats, []);
  assert.deepStrictEqual(
    result.assumptions.secondaryWeaponTransfer,
    {
      mode:"before-hero-rates",
      confidence:"presumed"
    }
  );
  const transfers = result.terms.filter(term =>
    term.source.domain === "secondary-weapon"
  );
  assert.strictEqual(transfers.length, 2);
  assert.deepStrictEqual(
    transfers.map(term => term.source.transferRate),
    [3000, 3000]
  );
  assert.deepStrictEqual(
    transfers.map(term => term.source.originalValue),
    [226, 205]
  );
  assert.deepStrictEqual(
    transfers.map(term => term.value),
    [68, 62]
  );
  transfers.forEach(term => {
    assert.strictEqual(term.stat, "B_Atk");
    assert.strictEqual(term.operation, "add");
    assert.strictEqual(term.unit, "flat");
    assert.strictEqual(
      term.value,
      Math.ceil(term.source.originalValue * 3000 / 10000)
    );
  });
  assert.strictEqual(
    result.terms.some(term =>
      term.source.domain === "secondary-weapon"
      && term.source.originalStat === "I_AtkAdd_Rate"
    ),
    false
  );
  assert.deepStrictEqual(result.assumptions.heroMainRateApplication, {
    mode:"all-flat-before-passives",
    confidence:"presumed"
  });
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(result.terms)),
    result.totals,
    "la décomposition doit être l'unique source des totaux"
  );
  assert.ok(
    result.totals
      .filter(total => ["B_Atk", "B_Def", "B_MaxHp"].includes(total.stat))
      .every(total => Number.isInteger(total.value)),
    "les trois statistiques principales finales sont arrondies au supérieur"
  );
  const percentageSword = plain(hero);
  percentageSword.rosterBuilds["Epee 1 main"].weaponConfig.enchantments[0] = {
    slot:0,
    tier:null,
    element:null,
    stat:"I_AtkAdd_Rate",
    value:100
  };
  const percentageSwordResult = plain(
    hooks.calculateHeroStats(percentageSword)
  );
  const percentageSwordTransfer = percentageSwordResult.terms.find(term =>
    term.source.domain === "secondary-weapon"
    && term.source.weaponType === "Epee 1 main"
  );
  assert.strictEqual(percentageSwordTransfer.source.originalValue, 126);
  assert.strictEqual(percentageSwordTransfer.value, 38);
  assert.strictEqual(
    transfers.find(term =>
      term.source.weaponType === "Epee 1 main"
    ).value - percentageSwordTransfer.value,
    30,
    "remplacer 100 ATK plate par 100 ATK % retire exactement 30 ATK transférée"
  );

  const missingSecondary = plain(hero);
  delete missingSecondary.rosterBuilds["Epees doubles"];
  const partial = plain(hooks.calculateHeroStats(missingSecondary));
  assert.strictEqual(partial.status, "partial");
  assert.deepStrictEqual(partial.partialStats, ["B_Atk"]);
  assert.ok(partial.missing.includes(
    "rosterBuilds.Epees doubles.weapon"
  ));
  assert.ok(partial.uncovered.includes(
    "secondary-weapon:Epees doubles"
  ));
  assert.strictEqual(
    partial.coverage.includes("secondary-weapon"),
    false
  );
  assert.ok(partial.totals.some(total => total.stat === "B_MaxHp"));
  assert.ok(partial.totals.some(total => total.stat === "B_Def"));
  assert.ok(partial.totals.some(total => total.stat === "B_Atk"));
  const partialSection = hooks.heroStatsSection(missingSecondary);
  assert.strictEqual(
    hooks.heroStatsTitle(partial),
    "Statistiques du héros — calcul partiel"
  );
  const attackCard = fakeNodes(partialSection, node =>
    node.className
      && node.className.split(/\s+/).includes("hero-stat-card")
      && /ATK/.test(fakeText(node))
  )[0];
  assert.ok(attackCard);
  assert.match(
    fakeText(attackCard),
    /calcul incomplet — arme secondaire manquante/i
  );
  const hpAndDef = fakeNodes(partialSection, node =>
    node.className
      && node.className.split(/\s+/).includes("hero-stat-card")
      && /(?:PV|DEF)/.test(fakeText(node))
  );
  assert.strictEqual(hpAndDef.length, 2);
  hpAndDef.forEach(card =>
    assert.doesNotMatch(
      fakeText(card),
      /arme secondaire manquante/i
    )
  );
  const completeSection = hooks.heroStatsSection(hero);
  assert.match(
    fakeText(completeSection),
    /secondaire.*×\s*30\s*%.*=\s*\+/i
  );
  assert.ok(result.terms.some(term =>
    term.operation === "multiply"
    && term.stat === "B_Atk"
    && term.confidence === "presumed"
    && term.source.originalStat === "I_AtkAdd_Rate"
  ));
  assert.ok(result.terms.some(term =>
    term.source.originalStat === "B_Atk_Equip"
    && term.stat === "B_Atk"
  ));
  const overlimitedHero = plain(hero);
  overlimitedHero.weaponConfig.overlimit = 1;
  const overlimitedResult = plain(hooks.calculateHeroStats(overlimitedHero));
  assert.strictEqual(overlimitedResult.status, "valid");
  assert.ok(overlimitedResult.terms.some(term =>
    term.operation === "multiply"
    && term.source.domain === "weapon"
    && term.source.component === "overlimit"
    && term.stat === "B_Atk"
    && term.unit === "ten-thousandths"
  ), "l’outrepassement canonisé doit rester un taux en dix-millièmes");
  assert.match(
    fakeText(hooks.heroStatsSection(overlimitedHero)),
    /Outrepassement\s+×1,05 — base présumée/,
    "le taux exact doit continuer d’annoncer sa base d’application présumée"
  );
  assert.deepStrictEqual(
    plain(hooks.heroMainRateTargetBuckets(
      "B_Atk",
      result.terms.filter(term => term.operation === "add")
    )),
    [...new Set(result.terms
      .filter(term =>
        term.operation === "add"
        && term.stat === "B_Atk"
        && term.unit === "flat"
      )
      .map(term => term.bucket))]
  );
  const simpleTerms = [
    {
      id:"base",
      stat:"B_Atk",
      operation:"add",
      value:100,
      unit:"flat",
      bucket:"character:base",
      family:"main",
      source:{ domain:"character", component:"base" },
      confidence:"exact"
    },
    {
      id:"gear",
      stat:"B_Atk",
      operation:"add",
      value:50,
      unit:"flat",
      bucket:"armor:Haut",
      family:"main",
      source:{ domain:"armor", component:"level" },
      confidence:"exact"
    }
  ];
  simpleTerms.push({
    id:"rate",
    stat:"B_Atk",
    operation:"multiply",
    value:500,
    unit:"ten-thousandths",
    appliesTo:plain(hooks.heroMainRateTargetBuckets("B_Atk", simpleTerms)),
    family:"main",
    source:{ domain:"potential", component:"potential" },
    confidence:"presumed"
  });
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(simpleTerms)),
    [{ stat:"B_Atk", unit:"flat", value:157.5 }]
  );
  assert.ok(result.uncovered.includes("weapon:passive"));
  assert.ok(result.uncovered.includes("armor:passive"));
  assert.ok(result.uncovered.includes("engraving:passive"));
  assert.ok(result.facts.passives.some(fact =>
    fact.source === "weapon:passive"
    && fact.level === 1
    && fact.maxLevel === 7
  ));
  assert.ok(result.facts.passives.some(fact =>
    fact.source === "armor:passive"
    && fact.slot === "Bas"
    && fact.status === "missing"
  ));
  assert.ok(result.facts.passives.some(fact =>
    fact.source === "engraving:passive"
    && fact.slot === "Armure liee"
    && fact.status === "missing"
  ));

  assert.strictEqual(
    hooks.heroStatsTitle(result),
    "Statistiques du héros — borne inférieure"
  );
  const section = hooks.heroStatsSection(hero);
  assert.ok(section.className.includes("hero-stats"));
  const primaryCards = fakeNodes(
    section,
    node => node.className
      && node.className.split(/\s+/).includes("hero-stat-card")
  );
  assert.strictEqual(primaryCards.length, 3);
  primaryCards.forEach(card => {
    assert.match(fakeText(card), /borne inférieure/i);
  });
  const details = fakeNodes(
    section,
    node => node.className && node.className.includes("weapon-stat-details")
  );
  assert.ok(details.length > 3);
  assert.ok(details.every(node => !node.open));
  assert.match(fakeText(section), /Base d’application présumée/);
  assert.match(fakeText(section), /Passifs non inclus dans le calcul/);
  assert.match(fakeText(section), /Arrondi du jeu/);
  assert.doesNotMatch(fakeText(section), /final-(?:ceil|rounding)/);

  const withPassives = plain(hero);
  withPassives.armorConfig.Bas.passiveLevel = 3;
  withPassives.armorConfig["Armure liee"].passiveLevel = 2;
  const withPassivesResult = plain(hooks.calculateHeroStats(withPassives));
  assert.deepStrictEqual(withPassivesResult.terms, result.terms);
  assert.deepStrictEqual(withPassivesResult.totals, result.totals);
  assert.ok(withPassivesResult.facts.passives.some(fact =>
    fact.slot === "Bas" && fact.level === 3 && fact.status === "valid"
  ));
  const invalidPassive = plain(hero);
  invalidPassive.armorConfig.Bas.passiveLevel = 99;
  const invalidPassiveResult = plain(hooks.calculateHeroStats(invalidPassive));
  assert.strictEqual(invalidPassiveResult.status, "valid");
  assert.deepStrictEqual(invalidPassiveResult.totals, result.totals);
  assert.ok(invalidPassiveResult.facts.passives.some(fact =>
    fact.slot === "Bas" && fact.status === "incompatible"
  ));

  [
    ["weapon", draft => { draft.weapon = null; }],
    ["weaponConfig", draft => { draft.weaponConfig = null; }],
    ["armor.Haut", draft => { draft.armor.Haut = null; }],
    ["armorConfig.Haut", draft => { delete draft.armorConfig.Haut; }],
    ["jewel.Anneau", draft => { draft.jewel.Anneau = null; }],
    ["jewelConfig.Anneau", draft => { delete draft.jewelConfig.Anneau; }]
  ].forEach(([missingPath, mutate]) => {
    const draft = plain(hero);
    mutate(draft);
    const incomplete = plain(hooks.calculateHeroStats(draft));
    assert.strictEqual(incomplete.status, "incomplete", missingPath);
    assert.ok(incomplete.missing.includes(missingPath), missingPath);
    assert.deepStrictEqual(incomplete.terms, [], missingPath);
    assert.deepStrictEqual(incomplete.totals, [], missingPath);
    const incompleteSection = hooks.heroStatsSection(draft);
    assert.doesNotMatch(
      fakeText(incompleteSection),
      /\b(?:PV|ATK|DEF)\s*0\b/,
      "un build incomplet ne doit jamais afficher un faux zéro"
    );
  });

  const badPotential = plain(hero);
  badPotential.potentiel.tier = 11;
  assert.strictEqual(
    hooks.calculateHeroStats(badPotential).status,
    "incompatible"
  );
  const unknownCharacter = plain(hero);
  unknownCharacter.char = "inconnu";
  assert.strictEqual(
    hooks.calculateHeroStats(unknownCharacter).status,
    "unavailable"
  );
  const futureConfig = plain(hero);
  futureConfig.armorConfig.Haut.version = 99;
  assert.strictEqual(
    hooks.calculateHeroStats(futureConfig).status,
    "incompatible"
  );
}

// Régression mesurée dans le vrai jeu avec le build Supabase de Merlin Foudre.
{
  const { hooks } = loadApp();
  const hero = merlinGameFixture(hooks);
  assert.strictEqual(
    hooks.weaponConfigStatus(hero.weapon, hero.weaponConfig),
    "valid",
    "configuration de la baguette active"
  );
  Object.entries(hero.armor).forEach(([slot, file]) => {
    assert.strictEqual(
      hooks.gearConfigStatus(file, hero.armorConfig[slot]),
      "valid",
      "configuration d’armure " + slot
    );
  });
  Object.entries(hero.jewel).forEach(([slot, file]) => {
    assert.strictEqual(
      hooks.gearConfigStatus(file, hero.jewelConfig[slot]),
      "valid",
      "configuration de bijou " + slot
    );
  });
  const result = plain(hooks.calculateHeroStats(hero));
  assert.strictEqual(result.status, "valid");

  const totalsOf = terms => Object.fromEntries(
    plain(hooks.reconstructStatTotals(terms))
      .filter(total => ["B_Atk", "B_Def", "B_MaxHp"].includes(total.stat))
      .map(total => [total.stat, total.value])
  );
  const base = totalsOf(result.terms.filter(term =>
    ["character", "mastery"].includes(term.source.domain)
    && term.operation === "add"
  ));
  assert.deepStrictEqual(base, {
    B_Atk:4813,
    B_Def:2950,
    B_MaxHp:9296
  });

  const equipment = totalsOf(result.terms.filter(term =>
    ["weapon", "armor", "engraving", "jewel", "set", "secondary-weapon"]
      .includes(term.source.domain)
  ));
  assert.deepStrictEqual(equipment, {
    B_Atk:10036,
    B_Def:21614,
    B_MaxHp:60338
  });

  assert.deepStrictEqual(
    Object.fromEntries(
      result.totals
        .filter(total =>
          ["I_AtkAdd_Rate", "I_DefAdd_Rate", "I_MaxHpAdd_Rate"]
            .includes(total.stat)
        )
        .map(total => [total.stat, total.value])
    ),
    {
      I_AtkAdd_Rate:5100,
      I_DefAdd_Rate:4800,
      I_MaxHpAdd_Rate:4100
    }
  );
  assert.deepStrictEqual(
    Object.fromEntries(
      result.totals
        .filter(total => ["B_Atk", "B_Def", "B_MaxHp"].includes(total.stat))
        .map(total => [total.stat, total.value])
    ),
    {
      B_Atk:22422,
      B_Def:36355,
      B_MaxHp:98184
    }
  );
}

function testHeroTermOriginLabels(hooks){
  const originLabel = hooks.heroTermOriginLabel;
  assert.strictEqual(
    originLabel({ source:{ domain:"character", component:"base" } }),
    "Base du personnage"
  );
  assert.strictEqual(
    originLabel({ source:{ domain:"mastery", component:"common-mastery" } }),
    "Maîtrise commune"
  );
  assert.strictEqual(
    originLabel({
      source:{ domain:"mastery", component:"weapon-mastery", weaponType:"Wand" }
    }),
    "Maîtrise Baguette",
    "Le libellé doit venir de WEAPON_ENUM, pas de l'enum brut"
  );
  assert.strictEqual(
    originLabel({
      source:{
        domain:"mastery", component:"reserve-weapon-mastery", weaponType:"Book"
      }
    }),
    "Maîtrises de réserve"
  );
  assert.strictEqual(
    originLabel({ source:{ domain:"potential", component:"potential", tier:7 } }),
    "Potentiel P7"
  );
  ["armor", "jewel", "engraving"].forEach(domain => {
    assert.strictEqual(
      originLabel({ source:{ domain, component:"level" } }),
      "Équipement",
      "Les pièces sont réunies sous un seul libellé dans la fiche du héros"
    );
  });
  assert.strictEqual(
    originLabel({ source:{ domain:"set", component:"bonus" } }),
    "Bonus d’ensemble",
    "Les ensembles restent distincts des pièces"
  );
  assert.strictEqual(
    originLabel({ source:{ domain:"weapon", component:"level" } }),
    null,
    "Une provenance non regroupée doit répondre null"
  );
}

function testHeroTermLabelUsesOrigin(hooks){
  const label = hooks.heroTermLabel;
  assert.strictEqual(
    label({
      operation:"multiply",
      appliesTo:["character:base"],
      source:{
        domain:"mastery",
        component:"weapon-mastery",
        weaponType:"Wand",
        application:"hero-main-rate"
      }
    }),
    "Maîtrise Baguette",
    "Un taux principal est libellé par sa provenance, pas « Application du taux »"
  );
  assert.strictEqual(
    label({
      operation:"multiply",
      appliesTo:["weapon-native"],
      source:{ domain:"weapon", component:"overlimit", id:"x.webp" }
    }),
    "Outrepassement",
    "L'outrepassement n'est pas un taux principal"
  );
  assert.strictEqual(
    label({
      operation:"add",
      bucket:"armor:Bas",
      source:{ domain:"armor", component:"level", slot:"Bas", id:"x.webp" }
    }),
    "Équipement"
  );
}

// Les libellés d'origine distinguent les taux principaux, les maîtrises de
// réserve et regroupent les pièces d'équipement sous un même libellé.
{
  const { hooks } = loadApp();
  testHeroTermOriginLabels(hooks);
  testHeroTermLabelUsesOrigin(hooks);
}

function testStatTermGroups(hooks){
  const groups = hooks.statTermGroups;
  const label = term => term.source.label;
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"add", unit:"flat", value:10,
        bucket:"mastery:Wand", source:{ label:"Maîtrise Baguette" }
      },
      {
        id:"b", operation:"add", unit:"flat", value:32,
        bucket:"mastery:Wand", source:{ label:"Maîtrise Baguette" }
      },
      {
        id:"c", operation:"add", unit:"flat", value:5,
        bucket:"character:base", source:{ label:"Base du personnage" }
      }
    ]
  };
  const result = groups(stat, { termLabel:label });
  assert.strictEqual(result.length, 2, "Deux libellés distincts, deux groupes");
  assert.strictEqual(result[0].label, "Maîtrise Baguette");
  assert.strictEqual(result[0].value, 42, "Les additifs d'un groupe se somment");
  assert.strictEqual(result[0].terms.length, 2);
  assert.strictEqual(
    result[1].label, "Base du personnage",
    "L'ordre suit la première apparition des termes"
  );
}

function testStatTermGroupsKeepAppliesToApart(hooks){
  const stat = {
    stat:"B_Atk",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base", "armor:Bas"], source:{ label:"Taux" }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["weapon-native"], source:{ label:"Taux" }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label
  });
  assert.strictEqual(
    result.length, 2,
    "Deux multiplicateurs visant des seaux différents ne peuvent pas être sommés"
  );
}

function testStatTermGroupsKeepEmphasisApart(hooks){
  const stat = {
    stat:"B_Atk",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"], source:{ label:"Taux", strong:true }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"], source:{ label:"Taux", strong:false }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label,
    termEmphasis:term => term.source.strong ? "weapon-stat-term-overlimit" : ""
  });
  assert.strictEqual(
    result.length, 2,
    "Une emphase différente change la ligne rendue : pas de fusion"
  );
}

function testStatTermGroupsFlagMainRate(hooks){
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"],
        source:{ label:"Maîtrise Baguette", application:"hero-main-rate" }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:500,
        appliesTo:["weapon-native"],
        source:{ label:"Outrepassement", component:"overlimit" }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label
  });
  assert.deepStrictEqual(
    plain(result).map(group => group.mainRate),
    [true, false],
    "Seuls les taux principaux sont marqués pour le regroupement d'affichage"
  );
}

function testStatTermGroupsKeepMainRateApart(hooks){
  const stat = {
    stat:"B_Atk",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"],
        source:{ label:"Équipement", application:"hero-main-rate" }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"],
        source:{ label:"Équipement" }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label
  });
  assert.strictEqual(
    result.length, 2,
    "Un taux principal ne fusionne jamais avec un multiplicateur ordinaire :"
      +" leur notation et leur emplacement diffèrent"
  );
}

function testStatTermGroupsFallsBackToAutre(hooks){
  // Un libellé inconnu ne doit jamais faire disparaître un terme : il reste
  // visible sous un groupe « Autre ». On couvre les deux valeurs fausses que
  // `termLabel(term) || "Autre"` prétend gérer : chaîne vide et undefined.
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"add", unit:"flat", value:10,
        bucket:"unknown:a", source:{}
      },
      {
        id:"b", operation:"add", unit:"flat", value:5,
        bucket:"unknown:b", source:{}
      }
    ]
  };
  const unusableLabels = { a:"", b:undefined };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => unusableLabels[term.id]
  });
  assert.strictEqual(
    result.length, 1,
    "Chaîne vide et undefined retombent sur la même clé « Autre » : un seul groupe"
  );
  assert.strictEqual(result[0].label, "Autre");
  assert.strictEqual(
    result[0].terms.length, 2,
    "Les deux termes à libellé inconnu restent visibles dans le groupe, pas perdus"
  );
}

// Le regroupement pur fusionne les termes qui rendraient la même ligne :
// même libellé, même opération/unité, même seau ciblé, même emphase, et ne
// mélange jamais un taux principal avec un multiplicateur ordinaire.
{
  const { hooks } = loadApp();
  testStatTermGroups(hooks);
  testStatTermGroupsKeepAppliesToApart(hooks);
  testStatTermGroupsKeepEmphasisApart(hooks);
  testStatTermGroupsKeepMainRateApart(hooks);
  testStatTermGroupsFlagMainRate(hooks);
  testStatTermGroupsFallsBackToAutre(hooks);
}

console.log("PASS stats de builds : modèle et calcul de l’arme");
