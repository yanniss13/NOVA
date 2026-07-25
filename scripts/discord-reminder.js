"use strict";
/* Rappel Discord automatique — chaque DIMANCHE à MIDI (heure de Paris).
   (Le boss de confrérie reset le lundi 9h.) Lancé par GitHub Actions (cron).
   Lit Supabase avec la clé service_role (secret GitHub) et poste la liste des
   membres qui n'ont pas fait leur run sur le webhook Discord (secret).
   Ni la clé ni le webhook n'apparaissent dans le site public. */
const {
  isReminderWindow, sessionsToRemind, absentPseudos, reminderMessage
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
  const { weekday, hour } = parisNow();
  if (!FORCE && !isReminderWindow(weekday, hour)) {
    console.log("Hors fenêtre (dimanche 12h Paris). Heure Paris actuelle : jour " + weekday + ", " + hour + "h. Rien à faire.");
    return;
  }

  const nowIso = new Date().toISOString();
  const sessions = await sb("boss_sessions?select=*");
  const targets = sessionsToRemind(sessions, nowIso);
  if (!targets.length) { console.log("Aucune session ouverte à relancer."); return; }

  const profiles = await sb("profiles?select=id,pseudo");
  for (const s of targets) {
    const parts = await sb("boss_participation?select=owner,participated,session_id&session_id=eq." + s.id);
    const absents = absentPseudos(s, profiles, parts);
    const content = reminderMessage(s, absents);

    const post = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // allowed_mentions vide : on ne déclenche jamais @everyone/@here par accident.
      body: JSON.stringify({ content: content, allowed_mentions: { parse: [] } })
    });
    if (!post.ok) {
      console.error("Webhook Discord échec:", post.status, await post.text());
      continue;
    }
    await sb("boss_sessions?id=eq." + s.id, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ reminded_at: nowIso })
    });
    console.log("Rappel envoyé pour «" + s.title + "» — " + absents.length + " absent(s).");
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
