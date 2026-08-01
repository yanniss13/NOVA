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

const {
  applyAvailabilityRange,
  paintAvailabilityRectangle
} = hooks;

function selectedIndexes(mask){
  const indexes = [];
  for(let index = 0; index < 168; index += 1){
    if(mask[index] === "1") indexes.push(index);
  }
  return indexes;
}

/* Cas nominal : 22h → 02h le lundi couvre quatre créneaux, dont deux le mardi.
   La plage est [début, fin[ : 02h n'est pas inclus. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 2, [0], true);
  assert.strictEqual(result.clipped, false);
  assert.deepStrictEqual(selectedIndexes(result.mask), [22, 23, 24, 25]);
}

/* La même plage sur plusieurs jours cochés. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 2, [0, 1], true);
  assert.deepStrictEqual(
    selectedIndexes(result.mask),
    [22, 23, 24, 25, 46, 47, 48, 49]
  );
}

/* Plage ordinaire, sans franchissement. */
{
  const result = applyAvailabilityRange(EMPTY, 20, 23, [2], true);
  assert.strictEqual(result.clipped, false);
  assert.deepStrictEqual(selectedIndexes(result.mask), [68, 69, 70]);
}

/* Heures égales : cas interdit, aucun effet et aucun écrêtage signalé. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 22, [0, 1, 2], true);
  assert.strictEqual(result.mask, EMPTY);
  assert.strictEqual(result.clipped, false);
}

/* Nuit du dimanche : la partie après minuit appartient à la semaine suivante,
   elle est écrêtée et signalée. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 2, [6], true);
  assert.strictEqual(result.clipped, true);
  assert.deepStrictEqual(selectedIndexes(result.mask), [166, 167]);
}

/* Effacement : la même plage retire exactement ce qu'elle aurait ajouté. */
{
  const added = applyAvailabilityRange(EMPTY, 22, 2, [0], true).mask;
  const removed = applyAvailabilityRange(added, 22, 2, [0], false).mask;
  assert.strictEqual(removed, EMPTY);
}

/* Rectangle : bornes inclusives, ordre des extrémités indifférent. */
{
  const painted = paintAvailabilityRectangle(
    EMPTY, { day:1, hour:20 }, { day:3, hour:22 }, true
  );
  assert.deepStrictEqual(selectedIndexes(painted), [
    44, 45, 46,
    68, 69, 70,
    92, 93, 94
  ]);
  const reversed = paintAvailabilityRectangle(
    EMPTY, { day:3, hour:22 }, { day:1, hour:20 }, true
  );
  assert.strictEqual(reversed, painted, "Le sens du glissement est indifférent");
}

/* Une seule case : le rectangle dégénéré bascule un créneau. */
{
  const single = paintAvailabilityRectangle(
    EMPTY, { day:0, hour:0 }, { day:0, hour:0 }, true
  );
  assert.deepStrictEqual(selectedIndexes(single), [0]);
}

/* Le rectangle efface aussi bien qu'il remplit. */
{
  const full = "1".repeat(168);
  const cleared = paintAvailabilityRectangle(
    full, { day:0, hour:0 }, { day:0, hour:1 }, false
  );
  assert.strictEqual(cleared[0], "0");
  assert.strictEqual(cleared[1], "0");
  assert.strictEqual(cleared[2], "1");
}

console.log("availability.test.js OK");
