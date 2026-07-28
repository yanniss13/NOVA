"use strict";

const assert = require("node:assert");
const { loadApp, plain } = require("./helpers/load-app");

const HACHE_FILE = "7ds-armes/Hache/hache.webp";
const EPEE_FILE = "7ds-armes/Epee 1 main/epee.webp";

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
    "incompatible"
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

console.log("stats-build.test.js: OK");
