"use strict";
/* Rappel Discord automatique — chaque DIMANCHE à MIDI (heure de Paris).
   (Le boss de confrérie reset le lundi 9h ; 6 groupes sont créés par semaine.)
   Lancé par GitHub Actions (cron). Lit Supabase avec la clé service_role (secret
   GitHub) et relance sur le webhook Discord les membres sous 3/3 runs de la
   semaine. Ni la clé ni le webhook n'apparaissent dans le site public. */
const {
  isReminderWindow, currentBossWeekStart, missingRuns, reminderMessage
} = require("./reminder-core.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://uxouhbgdlolidjmxwgae.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const FORCE = process.env.FORCE === "1"; // lancement manuel : ignore la fenêtre horaire

// Heure locale de Paris (gère automatiquement l'heure d'été/hiver).
function parisNow() {
  const paris = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return { weekday: paris.getDay(), hour: paris.getHours() };
}

async function sb(pathname, opts) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + pathname, Object.assign({
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: "Bearer " + SERVICE_ROLE,
      "Content-Type": "application/json"
    }
  }, opts || {}));
  if (!res.ok) throw new Error(pathname + " -> " + res.status + " " + await res.text());
  return res.status === 204 ? null : res.json();
}

async function main() {
  if (!SERVICE_ROLE || !WEBHOOK) {
    console.log("Secrets manquants (SUPABASE_SERVICE_ROLE / DISCORD_WEBHOOK_URL) — rien à envoyer.");
    return;
  }
  const now = new Date();
  const { weekday, hour } = parisNow();
  if (!FORCE && !isReminderWindow(weekday, hour)) {
    console.log("Hors fenêtre (dimanche 12h Paris). Heure Paris actuelle : jour " + weekday + ", " + hour + "h. Rien à faire.");
    return;
  }

  const weekStart = currentBossWeekStart(now);
  const sessions = await sb("boss_sessions?week_start=eq." + weekStart + "&select=id");
  if (!sessions.length) {
    console.log("Groupes de la semaine (" + weekStart + ") pas encore créés — rien à envoyer.");
    return;
  }
  const ids = sessions.map(s => s.id);
  const memberships = await sb("boss_participation?select=owner&session_id=in.(" + ids.join(",") + ")");
  const profiles = await sb("profiles?select=id,pseudo");
  const missingMembers = missingRuns(profiles, memberships);

  const weekLabel = "semaine du " + new Date(weekStart + "T00:00:00Z")
    .toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const content = reminderMessage(weekLabel, missingMembers);

  const post = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // allowed_mentions vide : on ne déclenche jamais @everyone/@here par accident.
    body: JSON.stringify({ content: content, allowed_mentions: { parse: [] } })
  });
  if (!post.ok) {
    console.error("Webhook Discord échec:", post.status, await post.text());
    process.exitCode = 1;
    return;
  }
  console.log(
    "Rappel envoyé (" + weekStart + ") — " +
    missingMembers.length + " membre(s) sous les 3 runs."
  );
}

main().catch(e => { console.error(e); process.exitCode = 1; });
