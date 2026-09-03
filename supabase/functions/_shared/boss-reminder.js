"use strict";
/* Logique du rappel Discord des groupes de boss. 6 groupes sont créés chaque
   semaine (reset lundi 9h) ; chaque dimanche, on relance les membres sous 3/3
   runs.

   Module universel, sur le modèle de `availability-pdf.js` : le cron Node
   (`scripts/reminder-core.js`) et la commande `/run` de l'Edge Function lisent
   le MÊME code. Une copie de ce texte quelque part ailleurs divergerait au
   premier changement de formulation, et `/run` n'afficherait plus ce que le
   salon reçoit le dimanche.

   Aucun accès réseau en dur : `collectReminderData` reçoit sa fonction de
   requête, ce qui la rend testable et utilisable des deux côtés. */

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
   verrou par semaine, sans quoi le salon recevrait deux fois le message.

   La commande `/run`, elle, ne consulte pas cette fenêtre : demandée à la
   main, elle répond n'importe quel jour. */
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

/* Libellé affiché entre parenthèses dans le message. Il vit ici et non chez
   l'appelant : calculé à deux endroits, il finirait par différer entre le
   rappel du dimanche et `/run`. */
function bossWeekLabel(weekStart) {
  return "semaine du " + new Date(weekStart + "T00:00:00Z")
    .toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
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
    "Réserve tes runs sur [NOVA](https://yanniss13.github.io/NOVA/) avant le reset ! ⚔️";
}

/* `request` est injecté par l'appelant : le cron passe son client
   service_role, l'Edge Function le sien, les tests une fonction sans réseau.

   Une semaine sans session ne déclenche aucune requête de participation :
   `in.()` vide serait une erreur PostgREST. */
/* LE RAPPEL NE RELANCE QUE DES MEMBRES. La requete part en service_role,
   donc sans RLS : sans `membre=eq.true`, chaque invite etait compte « sous
   les 3 runs » et nomme dans le message Discord de la confrerie. */
const REMINDER_PROFILES_QUERY = "profiles?select=id,pseudo&membre=eq.true";

async function collectReminderData(request, weekStart) {
  const sessions = await request(
    "boss_sessions?week_start=eq." + weekStart + "&select=id"
  );
  const profiles = await request(REMINDER_PROFILES_QUERY);
  const ids = (sessions || []).map(session => session.id);
  const memberships = ids.length
    ? await request(
      "boss_participation?select=owner&session_id=in.(" + ids.join(",") + ")"
    )
    : [];
  return {
    sessions: sessions || [],
    profiles: profiles || [],
    memberships: memberships || [],
    missingMembers: missingRuns(profiles || [], memberships || [])
  };
}

const bossReminderApi = {
  REMINDER_WEEKDAY,
  REMINDER_PROFILES_QUERY,
  isReminderWindow,
  currentBossWeekStart,
  bossWeekLabel,
  missingRuns,
  reminderMessage,
  collectReminderData
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = bossReminderApi;
}
globalThis.NOVA_BOSS_REMINDER = bossReminderApi;
