"use strict";
/* Logique pure du rappel Discord des sessions de boss (aucun réseau -> testable).
   Rappel hebdomadaire : chaque dimanche à midi (heure de Paris), on relance les
   membres qui n'ont pas fait leur run sur la session en cours. */

const REMINDER_WEEKDAY = 0; // dimanche (getDay : 0 = dimanche)
const REMINDER_HOUR = 12;   // midi, heure locale de Paris

// Fenêtre d'envoi : dimanche 12h (heure de Paris). Le runner fournit l'heure Paris.
function isReminderWindow(parisWeekday, parisHour) {
  return parisWeekday === REMINDER_WEEKDAY && parisHour === REMINDER_HOUR;
}

// Session à relancer = la session OUVERTE la plus récente, pas déjà rappelée
// dans les ~20 dernières heures (garde-fou contre un double envoi le même jour ;
// d'une semaine sur l'autre, reminded_at a > 6 jours -> on relance).
function sessionsToRemind(sessions, nowIso) {
  const now = Date.parse(nowIso);
  const open = (sessions || []).filter(s =>
    s && s.status === "open" &&
    (!s.reminded_at || (now - Date.parse(s.reminded_at)) > 20 * 3600 * 1000)
  );
  open.sort((a, b) => Date.parse(b.created_at || 0) - Date.parse(a.created_at || 0));
  return open.slice(0, 1);
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
    return "✅ **" + title + "** — tout le monde a fait son run avant le reset de lundi 9h. Bravo !";
  }
  return "🔔 **" + title + "** — reset lundi 9h ! Il manque encore le run de : " +
    absents.join(", ") + ".\nPensez à faire vos dégâts sur le Boss de Guilde ! ⚔️";
}

module.exports = { isReminderWindow, sessionsToRemind, absentPseudos, reminderMessage, REMINDER_WEEKDAY, REMINDER_HOUR };
