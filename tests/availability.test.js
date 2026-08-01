"use strict";

const assert = require("node:assert/strict");
/* `plain` est indispensable : les objets renvoyés naissent dans le bac à sable
   `vm`, donc avec un autre Object.prototype que celui du test. deepStrictEqual
   compare les prototypes et échouerait sur des valeurs pourtant identiques. */
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  availabilityWeekStart,
  availabilityPreviousWeekStart,
  availabilitySlotIndex,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask,
  availabilityMaskHas,
  availabilityMaskWith
} = hooks;

const EMPTY = "0".repeat(168);

/* Semaine ISO calculée en heure de Paris, comme tout le reste de l'appli : les
   instants sont donnés en UTC explicite pour que le test ne dépende ni du
   fuseau ni de la locale de la machine qui l'exécute. */
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-01T12:00:00Z")),
  "2026-07-27",
  "Un samedi appartient à la semaine du lundi précédent"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-07-26T22:30:00Z")),
  "2026-07-27",
  "Minuit trente à Paris le lundi ouvre déjà la nouvelle semaine"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-02T21:00:00Z")),
  "2026-07-27",
  "23h à Paris le dimanche appartient encore à la semaine écoulée"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-02T23:30:00Z")),
  "2026-08-03",
  "1h30 à Paris le lundi bascule sur la nouvelle semaine, pas 9h"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-03T05:00:00Z")),
  "2026-08-03",
  "Le lundi 7h à Paris : la semaine ISO a basculé alors que la semaine de "
  + "boss est encore la précédente"
);
assert.strictEqual(
  availabilityPreviousWeekStart("2026-08-03"),
  "2026-07-27"
);
assert.strictEqual(
  availabilityPreviousWeekStart("2026-01-05"),
  "2025-12-29",
  "Le passage d'année doit rester correct"
);

/* Index de créneau : le jour 0 est le lundi, l'heure 0 est minuit. */
assert.strictEqual(availabilitySlotIndex(0, 0), 0);
assert.strictEqual(availabilitySlotIndex(0, 22), 22);
assert.strictEqual(availabilitySlotIndex(1, 0), 24);
assert.strictEqual(availabilitySlotIndex(6, 23), 167);
assert.deepStrictEqual(plain(availabilitySlotFromIndex(0)), { day:0, hour:0 });
assert.deepStrictEqual(plain(availabilitySlotFromIndex(24)), { day:1, hour:0 });
assert.deepStrictEqual(plain(availabilitySlotFromIndex(167)), { day:6, hour:23 });

/* Normalisation : toute valeur douteuse retombe sur une semaine vide. */
assert.strictEqual(normalizeAvailabilityMask(EMPTY), EMPTY);
assert.strictEqual(normalizeAvailabilityMask(null), EMPTY);
assert.strictEqual(normalizeAvailabilityMask(undefined), EMPTY);
assert.strictEqual(normalizeAvailabilityMask(""), EMPTY);
assert.strictEqual(normalizeAvailabilityMask("1".repeat(167)), EMPTY);
assert.strictEqual(normalizeAvailabilityMask("2".repeat(168)), EMPTY);
assert.strictEqual(normalizeAvailabilityMask("1".repeat(168)), "1".repeat(168));

/* Écriture : jamais de mutation en place, ce qui rend l'aperçu de sélection
   trivial à afficher puis à jeter. */
const filled = availabilityMaskWith(EMPTY, [0, 24, 167], true);
assert.strictEqual(filled.length, 168);
assert.strictEqual(EMPTY, "0".repeat(168), "Le masque source ne doit pas changer");
assert.ok(availabilityMaskHas(filled, 0));
assert.ok(availabilityMaskHas(filled, 24));
assert.ok(availabilityMaskHas(filled, 167));
assert.ok(!availabilityMaskHas(filled, 1));
const erased = availabilityMaskWith(filled, [24], false);
assert.ok(availabilityMaskHas(erased, 0));
assert.ok(!availabilityMaskHas(erased, 24));
assert.strictEqual(availabilityMaskWith(EMPTY, [], true), EMPTY);

console.log("availability.test.js OK");
