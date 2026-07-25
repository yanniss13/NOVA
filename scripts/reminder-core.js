"use strict";
/* Logique pure du rappel Discord des sessions de boss (aucun réseau -> testable). */

// Sessions "dues" : ouvertes, avec un rappel programmé atteint, pas encore rappelées.
function dueSessions(sessions, nowIso) {
  const now = Date.parse(nowIso);
  return (sessions || []).filter(s =>
    s && s.status === "open" && s.remind_at && !s.reminded_at &&
    Date.parse(s.remind_at) <= now
  );
}

// Absents d'une session = membres (profiles) sans participation "participated = true".
function absentPseudos(session, profiles, participations) {
  const done = new Set(
    (participations || [])
      .filter(p => p && p.session_id === session.id && p.participated)
      .map(p => p.owner)
  );
  return (profiles || [])
    .filter(p => p && p.id && !done.has(p.id))
    .map(p => (p.pseudo && String(p.pseudo).trim()) || "Membre");
}

// Message Discord (liste de pseudos, sans vrai @mention).
function reminderMessage(session, absents) {
  const title = (session && session.title) || "Boss de Guilde";
  if (!absents.length) {
    return "✅ **" + title + "** — tout le monde a fait son run. Bravo !";
  }
  return "🔔 **" + title + "** — il manque encore le run de : " +
    absents.join(", ") + ".\nPensez à faire vos dégâts sur le Boss de Guilde ! ⚔️";
}

module.exports = { dueSessions, absentPseudos, reminderMessage };
