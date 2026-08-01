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

const {
  aggregateAvailability,
  availabilityDensityTier,
  availabilitySlotMembers,
  staleAvailabilityWeeks
} = hooks;

function maskOf(indexes){
  const chars = EMPTY.split("");
  indexes.forEach(index => { chars[index] = "1"; });
  return chars.join("");
}

/* Agrégation : trois membres, des recouvrements partiels. */
{
  const rows = [
    { owner:"a", slots:maskOf([20, 21, 22]) },
    { owner:"b", slots:maskOf([21, 22]) },
    { owner:"c", slots:maskOf([21]) }
  ];
  const { counts, max, best } = aggregateAvailability(rows);
  assert.strictEqual(counts.length, 168);
  assert.strictEqual(counts[20], 1);
  assert.strictEqual(counts[21], 3);
  assert.strictEqual(counts[22], 2);
  assert.strictEqual(counts[23], 0);
  assert.strictEqual(max, 3);
  assert.deepStrictEqual(plain(best), [
    { index:21, count:3 },
    { index:22, count:2 },
    { index:20, count:1 }
  ]);
}

/* Une ligne au masque corrompu ne doit pas fausser le comptage. */
{
  const { counts, max } = aggregateAvailability([
    { owner:"a", slots:"pas un masque" },
    { owner:"b", slots:null },
    { owner:"c", slots:maskOf([5]) }
  ]);
  assert.strictEqual(max, 1);
  assert.strictEqual(counts[5], 1);
}

/* Semaine vide : aucun meilleur créneau, aucun maximum. */
{
  const { max, best } = aggregateAvailability([]);
  assert.strictEqual(max, 0);
  assert.deepStrictEqual(plain(best), []);
}

/* Égalité : le créneau le plus tôt passe devant, pour un classement stable. */
{
  const rows = [{ owner:"a", slots:maskOf([100, 40, 70]) }];
  const { best } = aggregateAvailability(rows);
  assert.deepStrictEqual(plain(best.map(entry => entry.index)), [40, 70, 100]);
}

/* Moins de trois créneaux occupés : on n'invente jamais un créneau vide. */
{
  const { best } = aggregateAvailability([{ owner:"a", slots:maskOf([3]) }]);
  assert.deepStrictEqual(plain(best), [{ index:3, count:1 }]);
}

/* Paliers de densité : cinq niveaux, et zéro quand personne n'a rien saisi. */
assert.strictEqual(availabilityDensityTier(0, 16), 0);
assert.strictEqual(availabilityDensityTier(1, 16), 1);
assert.strictEqual(availabilityDensityTier(4, 16), 1);
assert.strictEqual(availabilityDensityTier(5, 16), 2);
assert.strictEqual(availabilityDensityTier(16, 16), 4);
assert.strictEqual(availabilityDensityTier(0, 0), 0, "Aucune division par zéro");
assert.strictEqual(availabilityDensityTier(3, 0), 0);

/* Membres d'un créneau : moi d'abord, puis l'ordre alphabétique. Le marquage
   « sans groupe » repose sur les participations de la semaine de boss. */
{
  const rows = [
    { owner:"zoe", slots:maskOf([21]) },
    { owner:"moi", slots:maskOf([21]) },
    { owner:"alix", slots:maskOf([21]) },
    { owner:"absent", slots:maskOf([22]) }
  ];
  const members = availabilitySlotMembers(rows, 21, {
    pseudoOf:owner => ({ zoe:"Zoé", moi:"Moi", alix:"Alix" })[owner],
    currentUserId:"moi",
    ownersWithGroup:new Set(["alix"])
  });
  assert.deepStrictEqual(plain(members), [
    { owner:"moi", pseudo:"Moi", isMe:true, withoutGroup:true },
    { owner:"alix", pseudo:"Alix", isMe:false, withoutGroup:false },
    { owner:"zoe", pseudo:"Zoé", isMe:false, withoutGroup:true }
  ]);
}

/* Un profil manquant ne doit jamais produire « undefined » à l'écran. */
{
  const members = availabilitySlotMembers(
    [{ owner:"inconnu", slots:maskOf([0]) }],
    0,
    { pseudoOf:() => null, currentUserId:"moi", ownersWithGroup:new Set() }
  );
  assert.strictEqual(members[0].pseudo, "Membre");
}

/* Purge : quatre semaines conservées, la cinquième part. */
assert.deepStrictEqual(
  plain(staleAvailabilityWeeks(
    ["2026-08-03", "2026-07-27", "2026-07-06", "2026-06-29"],
    "2026-08-03",
    4
  )),
  ["2026-07-06", "2026-06-29"]
);
assert.deepStrictEqual(plain(staleAvailabilityWeeks([], "2026-08-03", 4)), []);

const fs = require("node:fs");
const path = require("node:path");
const { availabilityViewState, availabilityWeekLabel } = hooks;
const indexSource = fs.readFileSync(
  path.resolve(__dirname, "..", "index.html"),
  "utf8"
);

/* L'onglet et la vue doivent exister et se répondre par leurs attributs ARIA. */
assert.match(
  indexSource,
  /<button class="tab" id="tab-availability" data-view="availability"[\s\S]{0,160}aria-controls="view-availability"/,
  "L'onglet Dispos doit exister et cibler sa vue"
);
assert.match(
  indexSource,
  /<section id="view-availability" class="view" role="tabpanel"[\s\S]{0,120}aria-labelledby="tab-availability"/,
  "La vue Dispos doit exister et pointer vers son onglet"
);
assert.match(
  indexSource,
  /if\(name==="availability"\)/,
  "showView doit rendre la vue Dispos"
);

assert.strictEqual(availabilityWeekLabel("2026-08-03"), "semaine du 3 au 9 août");
assert.strictEqual(
  availabilityWeekLabel("2026-07-27"),
  "semaine du 27 juillet au 2 août",
  "Un changement de mois doit nommer les deux mois"
);

/* Membre connecté : sa propre ligne alimente la grille, l'édition est ouverte. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[
      { owner:"moi", slots:maskOf([20, 21]) },
      { owner:"autre", slots:maskOf([21]) }
    ],
    currentUserId:"moi",
    mode:"mine",
    online:true
  });
  assert.strictEqual(state.weekStart, "2026-07-27");
  assert.strictEqual(state.weekLabel, "semaine du 27 juillet au 2 août");
  assert.strictEqual(state.mask, maskOf([20, 21]));
  assert.strictEqual(state.canEdit, true);
  assert.strictEqual(state.offline, false);
  assert.strictEqual(state.rows.length, 2);
}

/* Membre sans ligne enregistrée : grille vide, édition ouverte quand même. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[],
    currentUserId:"moi",
    mode:"mine",
    online:true
  });
  assert.strictEqual(state.mask, EMPTY);
  assert.strictEqual(state.canEdit, true);
}

/* Hors ligne : lecture seule et message explicite. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[{ owner:"moi", slots:maskOf([20]) }],
    currentUserId:"moi",
    mode:"mine",
    online:false
  });
  assert.strictEqual(state.canEdit, false);
  assert.strictEqual(state.offline, true);
  assert.match(state.message, /hors ligne/i);
}

/* Visiteur déconnecté : aucune donnée servie, invitation à se connecter.
   Les politiques RLS réservent déjà la lecture aux membres connectés. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[{ owner:"autre", slots:maskOf([20]) }],
    currentUserId:"",
    mode:"guild",
    online:true
  });
  assert.strictEqual(state.canEdit, false);
  assert.deepStrictEqual(plain(state.rows), []);
  assert.strictEqual(state.mask, EMPTY);
  assert.match(state.message, /connecte/i);
}

const { availabilityToggleDay, availabilityToggleHour } = hooks;

/* En-tête de jour : remplit la colonne, puis la vide au second appui. */
{
  const filled = availabilityToggleDay(EMPTY, 2);
  for(let hour = 0; hour < 24; hour += 1){
    assert.strictEqual(filled[48 + hour], "1");
  }
  assert.strictEqual(filled[47], "0");
  assert.strictEqual(filled[72], "0");
  assert.strictEqual(availabilityToggleDay(filled, 2), EMPTY);
}

/* Journée partiellement remplie : le premier appui complète, il n'efface pas. */
{
  const partial = maskOf([48, 49]);
  const filled = availabilityToggleDay(partial, 2);
  for(let hour = 0; hour < 24; hour += 1){
    assert.strictEqual(filled[48 + hour], "1");
  }
}

/* Gouttière d'heure : même règle, sur les sept jours. */
{
  const filled = availabilityToggleHour(EMPTY, 21);
  assert.deepStrictEqual(
    selectedIndexes(filled),
    [21, 45, 69, 93, 117, 141, 165]
  );
  assert.strictEqual(availabilityToggleHour(filled, 21), EMPTY);
}

/* Le formulaire de créneau de nuit et la reprise doivent exister dans la page. */
assert.match(indexSource, /id="availRangeForm"/);
assert.match(indexSource, /id="availRangeStart"/);
assert.match(indexSource, /id="availRangeEnd"/);
assert.match(indexSource, /id="availRangeAdd"/);
assert.match(indexSource, /id="availRangeRemove"/);
assert.match(indexSource, /id="availCopyPrevious"/);
assert.match(
  indexSource,
  /availRangeDays/,
  "Les sept cases de jours doivent être regroupées"
);

assert.match(indexSource, /id="availSlotOverlay"/);
assert.match(indexSource, /id="availSlotTitle"/);
assert.match(indexSource, /id="availSlotList"/);
assert.match(indexSource, /id="availBest"/);
assert.match(
  indexSource,
  /sans groupe/i,
  "Le panneau doit marquer les membres sans groupe"
);

console.log("availability.test.js OK");
