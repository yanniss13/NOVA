"use strict";
/* Logique pure du rappel Discord des groupes de boss (aucun réseau -> testable).
   6 groupes sont créés chaque semaine (reset lundi 9h). Chaque dimanche à midi
   (heure de Paris), on relance les membres qui n'ont rejoint AUCUN groupe. */

const REMINDER_WEEKDAY = 0; // dimanche (getDay : 0 = dimanche)
const REMINDER_HOUR = 12;   // midi, heure locale de Paris

// Fenêtre d'envoi : dimanche 12h (heure de Paris). Le runner fournit l'heure Paris.
function isReminderWindow(parisWeekday, parisHour) {
  return parisWeekday === REMINDER_WEEKDAY && parisHour === REMINDER_HOUR;
}

// Lundi 9h (Paris) de la semaine de boss courante -> "YYYY-MM-DD".
// (Même calcul que l'appli, pour cibler exactement les groupes de la semaine.)
function currentBossWeekStart(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(now || new Date());
  const get = t => (parts.find(x => x.type === t) || {}).value;
  const y = +get("year"), m = +get("month"), day = +get("day"), hour = +get("hour");
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get("weekday")];
  let offset = (wd + 6) % 7;            // jours écoulés depuis lundi
  if (wd === 1 && hour < 9) offset = 7;  // lundi avant 9h -> semaine précédente
  const base = new Date(Date.UTC(y, m - 1, day));
  base.setUTCDate(base.getUTCDate() - offset);
  return base.toISOString().slice(0, 10);
}

// Absents = membres (profiles) qui n'apparaissent dans AUCUNE appartenance de la semaine.
function absentPseudos(profiles, memberships) {
  const joined = new Set((memberships || []).filter(m => m && m.owner).map(m => m.owner));
  return (profiles || [])
    .filter(p => p && p.id && !joined.has(p.id))
    .map(p => (p.pseudo && String(p.pseudo).trim()) || "Membre");
}

// Message Discord (liste de pseudos, sans vrai @mention).
function reminderMessage(weekLabel, absents) {
  const label = weekLabel ? (" (" + weekLabel + ")") : "";
  if (!absents.length) {
    return "✅ **Boss de confrérie**" + label + " — tout le monde a rejoint un groupe avant le reset de lundi 9h. Bravo !";
  }
  return "🔔 **Boss de confrérie**" + label + " — reset lundi 9h !\n" +
    "Pas encore de groupe pour : " + absents.join(", ") + ".\n" +
    "Rejoins un groupe sur NOVA pour ne pas rater ton run ! ⚔️";
}

module.exports = {
  isReminderWindow, currentBossWeekStart, absentPseudos, reminderMessage,
  REMINDER_WEEKDAY, REMINDER_HOUR
};
