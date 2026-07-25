"use strict";

const assert = require("node:assert/strict");
const {
  isReminderWindow, sessionsToRemind, absentPseudos, reminderMessage
} = require("../scripts/reminder-core.js");

// Fenêtre : dimanche (0) à 12h, heure de Paris.
{
  assert.equal(isReminderWindow(0, 12), true);
  assert.equal(isReminderWindow(0, 11), false); // 11h -> non
  assert.equal(isReminderWindow(0, 13), false); // 13h -> non
  assert.equal(isReminderWindow(1, 12), false); // lundi -> non
  assert.equal(isReminderWindow(6, 12), false); // samedi -> non
}

// sessionsToRemind : la session OUVERTE la plus récente, pas rappelée récemment.
{
  const now = "2026-07-26T10:00:00.000Z"; // un dimanche
  const sessions = [
    { id:"old", status:"open", created_at:"2026-07-20T10:00:00.000Z", reminded_at:null },
    { id:"cur", status:"open", created_at:"2026-07-25T10:00:00.000Z", reminded_at:null }, // + récente
    { id:"won", status:"won",  created_at:"2026-07-25T12:00:00.000Z", reminded_at:null }  // fermée -> non
  ];
  assert.deepStrictEqual(sessionsToRemind(sessions, now).map(s => s.id), ["cur"]);

  // Déjà rappelée il y a 1h -> garde-fou : rien.
  const guarded = [{ id:"cur", status:"open", created_at:"2026-07-25T10:00:00.000Z", reminded_at:"2026-07-26T09:00:00.000Z" }];
  assert.deepStrictEqual(sessionsToRemind(guarded, now), []);

  // Rappelée la semaine dernière (> 20h) -> on relance.
  const lastWeek = [{ id:"cur", status:"open", created_at:"2026-07-25T10:00:00.000Z", reminded_at:"2026-07-19T10:00:00.000Z" }];
  assert.deepStrictEqual(sessionsToRemind(lastWeek, now).map(s => s.id), ["cur"]);
}

// absentPseudos : membres sans participation "participated=true".
{
  const session = { id:"s1" };
  const profiles = [
    { id:"u1", pseudo:"Akaaarix" },
    { id:"u2", pseudo:"Casté" },
    { id:"u3", pseudo:"Syval" }
  ];
  const participations = [
    { session_id:"s1", owner:"u1", participated:true },   // a fait son run
    { session_id:"s1", owner:"u2", participated:false },  // pas encore
    { session_id:"autre", owner:"u3", participated:true } // autre session -> ne compte pas
  ];
  assert.deepStrictEqual(
    absentPseudos(session, profiles, participations).sort(),
    ["Casté", "Syval"].sort()
  );
}

// reminderMessage : liste les pseudos ; cas "tout le monde a fait".
{
  const s = { title:"BDG semaine 30" };
  const msg = reminderMessage(s, ["Casté", "Syval"]);
  assert.match(msg, /BDG semaine 30/);
  assert.match(msg, /Casté, Syval/);
  assert.match(reminderMessage(s, []), /tout le monde a fait/);
}

console.log("PASS rappel Discord (logique pure)");
