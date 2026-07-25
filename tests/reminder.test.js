"use strict";

const assert = require("node:assert/strict");
const {
  isReminderWindow, currentBossWeekStart, missingRuns, reminderMessage
} = require("../scripts/reminder-core.js");

// Fenêtre : dimanche (0) à 12h, heure de Paris.
{
  assert.equal(isReminderWindow(0, 12), true);
  assert.equal(isReminderWindow(0, 11), false); // 11h -> non
  assert.equal(isReminderWindow(0, 13), false); // 13h -> non
  assert.equal(isReminderWindow(1, 12), false); // lundi -> non
  assert.equal(isReminderWindow(6, 12), false); // samedi -> non
}

// currentBossWeekStart : lundi 9h (Paris) de la semaine de boss courante.
// (Juillet 2026 = heure d'été, Paris = UTC+2.)
{
  // Mercredi 22/07 12h Paris (10h UTC) -> lundi 20/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-22T10:00:00Z")), "2026-07-20");
  // Dimanche 26/07 12h Paris (10h UTC) -> toujours lundi 20/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-26T10:00:00Z")), "2026-07-20");
  // Lundi 20/07 8h Paris (6h UTC), avant le reset -> semaine précédente, lundi 13/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-20T06:00:00Z")), "2026-07-13");
  // Lundi 20/07 10h Paris (8h UTC), après le reset -> nouvelle semaine, lundi 20/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-20T08:00:00Z")), "2026-07-20");
}

// missingRuns : une participation ouverte ou archivée vaut une run.
{
  const profiles = [
    { id: "u0", pseudo: "Zéro" },
    { id: "u1", pseudo: "Une" },
    { id: "u2", pseudo: "Deux" },
    { id: "u3", pseudo: "Trois" }
  ];
  const memberships = [
    { owner: "u1" },
    { owner: "u2" }, { owner: "u2" },
    { owner: "u3" }, { owner: "u3" }, { owner: "u3" }
  ];
  assert.deepStrictEqual(missingRuns(profiles, memberships), [
    { pseudo: "Zéro", missing: 3 },
    { pseudo: "Une", missing: 2 },
    { pseudo: "Deux", missing: 1 }
  ]);
  assert.deepStrictEqual(
    missingRuns([profiles[0]], memberships.concat({ owner: "u0" }), 2),
    [{ pseudo: "Zéro", missing: 1 }]
  );
}

// reminderMessage : détail par pseudo et cas où tout le monde est à 3/3.
{
  const msg = reminderMessage("semaine du 20 juil.", [
    { pseudo: "Casté", missing: 1 },
    { pseudo: "Syval", missing: 3 }
  ]);
  assert.match(msg, /Boss de confrérie/);
  assert.match(msg, /semaine du 20 juil\./);
  assert.match(msg, /Casté : 1 run restante/);
  assert.match(msg, /Syval : 3 runs restantes/);
  assert.match(reminderMessage("semaine du 20 juil.", []), /tout le monde est à 3\/3/);
}

console.log("PASS rappel Discord (logique pure)");
