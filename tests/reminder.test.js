"use strict";

const assert = require("node:assert/strict");
const {
  isReminderWindow, currentBossWeekStart, absentPseudos, reminderMessage
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

// absentPseudos : membres qui n'ont rejoint aucun groupe de la semaine.
{
  const profiles = [
    { id: "u1", pseudo: "Akaaarix" },
    { id: "u2", pseudo: "Casté" },
    { id: "u3", pseudo: "Syval" }
  ];
  const memberships = [
    { owner: "u1" },            // a rejoint un groupe
    { owner: "u1" },            // (doublon : plusieurs groupes) -> compte une fois
  ];
  assert.deepStrictEqual(
    absentPseudos(profiles, memberships).sort(),
    ["Casté", "Syval"].sort()
  );
  // Tout le monde a rejoint -> personne d'absent.
  assert.deepStrictEqual(
    absentPseudos(profiles, [{ owner: "u1" }, { owner: "u2" }, { owner: "u3" }]),
    []
  );
}

// reminderMessage : liste les pseudos ; cas "tout le monde a rejoint".
{
  const msg = reminderMessage("semaine du 20 juil.", ["Casté", "Syval"]);
  assert.match(msg, /Boss de confrérie/);
  assert.match(msg, /semaine du 20 juil\./);
  assert.match(msg, /Casté, Syval/);
  assert.match(reminderMessage("semaine du 20 juil.", []), /tout le monde a rejoint/);
}

console.log("PASS rappel Discord (logique pure)");
