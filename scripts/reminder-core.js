"use strict";
/* Logique pure du rappel Discord des groupes de boss (aucun réseau -> testable).
   6 groupes sont créés chaque semaine (reset lundi 9h). Chaque dimanche, on
   relance les membres sous 3/3 runs. */

const REMINDER_WEEKDAY = 0; // dimanche (getDay : 0 = dimanche)

/* Fenêtre d'envoi : LE DIMANCHE, sans condition d'heure.

   Elle exigeait « 12h pile » à l'origine, et le rappel n'est de ce fait
   JAMAIS parti. GitHub Actions lance ses crons avec 20 à 90 minutes de retard
   sur les runners partagés : les quatre exécutions des 26 juillet et 2 août
   2026 ont toutes vu 13h à Paris et se sont arrêtées là.

   Contrôler l'heure supposait un déclenchement ponctuel — une garantie que
   GitHub ne donne pas. Le jour, lui, résiste à n'importe quel retard
   plausible.

   Cette largeur n'expose à aucun doublon TANT QU'UN SEUL cron subsiste dans
   .github/workflows/boss-reminder.yml. En rajouter un demanderait d'abord un
   verrou par semaine, sans quoi le salon recevrait deux fois le message. */
function isReminderWindow(parisWeekday) {
  return parisWeekday === REMINDER_WEEKDAY;
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

function missingRuns(profiles, memberships, maxRuns = 3) {
  const counts = new Map();
  (memberships || []).forEach(membership => {
    if (!membership || !membership.owner) return;
    counts.set(membership.owner, (counts.get(membership.owner) || 0) + 1);
  });
  return (profiles || []).flatMap(profile => {
    if (!profile || !profile.id) return [];
    const missing = Math.max(0, maxRuns - (counts.get(profile.id) || 0));
    if (!missing) return [];
    return [{
      pseudo: (profile.pseudo && String(profile.pseudo).trim()) || "Membre",
      missing
    }];
  });
}

function reminderMessage(weekLabel, missingMembers) {
  const label = weekLabel ? (" (" + weekLabel + ")") : "";
  if (!missingMembers.length) {
    return "✅ **Boss de confrérie**" + label +
      " — tout le monde est à 3/3 avant le reset de lundi 9h. Bravo !";
  }
  const lines = missingMembers.map(member =>
    member.pseudo + " : " + member.missing + " run" +
    (member.missing > 1 ? "s restantes" : " restante")
  );
  return "🔔 **Boss de confrérie**" + label + " — reset lundi 9h !\n" +
    lines.join("\n") + "\n" +
    "Réserve tes runs sur NOVA avant le reset ! ⚔️";
}

module.exports = {
  isReminderWindow, currentBossWeekStart, missingRuns, reminderMessage,
  REMINDER_WEEKDAY
};
