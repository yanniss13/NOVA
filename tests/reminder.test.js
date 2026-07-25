"use strict";

const assert = require("node:assert/strict");
const { dueSessions, absentPseudos, reminderMessage } = require("../scripts/reminder-core.js");

const NOW = "2026-07-25T18:00:00.000Z";

// dueSessions : ouverte + remind_at passé + pas encore rappelée.
{
  const sessions = [
    { id:"a", status:"open", remind_at:"2026-07-25T17:00:00.000Z", reminded_at:null },   // due
    { id:"b", status:"open", remind_at:"2026-07-25T19:00:00.000Z", reminded_at:null },   // futur -> non
    { id:"c", status:"open", remind_at:"2026-07-25T17:00:00.000Z", reminded_at:"2026-07-25T17:05:00.000Z" }, // déjà -> non
    { id:"d", status:"won",  remind_at:"2026-07-25T17:00:00.000Z", reminded_at:null },   // fermée -> non
    { id:"e", status:"open", remind_at:null, reminded_at:null }                          // pas de rappel -> non
  ];
  const due = dueSessions(sessions, NOW).map(s => s.id);
  assert.deepStrictEqual(due, ["a"]);
}

// absentPseudos : membres sans participation "participated=true" pour la session.
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
