"use strict";
/* Rappel Discord automatique des sessions de boss.
   Lancé par GitHub Actions (cron). Lit Supabase avec la clé service_role
   (secret GitHub) et poste la liste des absents sur le webhook Discord (secret).
   Ni la clé ni le webhook n'apparaissent dans le site public. */
const { dueSessions, absentPseudos, reminderMessage } = require("./reminder-core.js");

const SUPABASE_URL = process.env.SUPABASE_URL || "https://uxouhbgdlolidjmxwgae.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

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
  const nowIso = new Date().toISOString();
  const sessions = await sb("boss_sessions?select=*");
  const due = dueSessions(sessions, nowIso);
  if (!due.length) { console.log("Aucun rappel dû."); return; }

  const profiles = await sb("profiles?select=id,pseudo");
  for (const s of due) {
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
