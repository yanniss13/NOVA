"use strict";
/* Rappel Discord automatique — chaque DIMANCHE à MIDI (heure de Paris).
   (Le boss de confrérie reset le lundi 9h ; 6 groupes sont créés par semaine.)
   Lancé par GitHub Actions (cron). Lit Supabase avec la clé service_role (secret
   GitHub) et relance sur le webhook Discord les membres sous 3/3 runs de la
   semaine. Ni la clé ni le webhook n'apparaissent dans le site public. */
const {
  isReminderWindow, currentBossWeekStart, missingRuns, reminderMessage
} = require("./reminder-core.js");

/* L'URL du projet n'est pas un secret : elle est servie à tous les visiteurs
   dans supabase-config.js. Elle vit donc en dur, et le workflow ne la passe
   pas. La variable d'environnement reste lue pour permettre aux tests de
   pointer ailleurs. Ce qui est secret, c'est la clé service_role. */
const SUPABASE_URL = process.env.SUPABASE_URL || "https://uxouhbgdlolidjmxwgae.supabase.co";
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const FORCE = process.env.FORCE === "1"; // lancement manuel : ignore la fenêtre horaire
// Lancement manuel avec un texte : simple vérification du webhook (voir main).
const TEST_MESSAGE = (process.env.TEST_MESSAGE || "").trim();

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

async function collectReminderData(request, weekStart) {
  const sessions = await request(
    "boss_sessions?week_start=eq." + weekStart + "&select=id"
  );
  const profiles = await request("profiles?select=id,pseudo");
  const ids = (sessions || []).map(session => session.id);
  const memberships = ids.length
    ? await request(
      "boss_participation?select=owner&session_id=in.(" + ids.join(",") + ")"
    )
    : [];
  return {
    sessions:sessions || [],
    profiles:profiles || [],
    memberships:memberships || [],
    missingMembers:missingRuns(profiles || [], memberships || [])
  };
}

// Envoi brut sur le webhook. `allowed_mentions` vide : jamais de @everyone.
async function postToDiscord(content) {
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: content, allowed_mentions: { parse: [] } })
  });
  if (!res.ok) {
    console.error("Webhook Discord échec:", res.status, await res.text());
    return false;
  }
  return true;
}

async function main() {
  if (!WEBHOOK) {
    console.log("Secret DISCORD_WEBHOOK_URL manquant — rien à envoyer.");
    return;
  }

  /* Message de vérification, passé au lancement manuel. Il ne touche NI
     Supabase NI la fenêtre horaire : il ne sert qu'à prouver que le webhook
     répond, typiquement après en avoir changé.

     Il court-circuite volontairement le vrai rappel : envoyer celui-ci hors
     dimanche listerait la semaine à peine commencée, où tout le monde est à
     0/3, et sèmerait la confusion dans le salon. */
  if (TEST_MESSAGE) {
    console.log("Message de vérification demandé — Supabase n'est pas interrogé.");
    if (!await postToDiscord(TEST_MESSAGE)) process.exitCode = 1;
    else console.log("Webhook joignable, message envoyé : " + TEST_MESSAGE);
    return;
  }

  if (!SERVICE_ROLE) {
    console.log("Secret SUPABASE_SERVICE_ROLE manquant — rien à envoyer.");
    return;
  }
  const now = new Date();
  const { weekday, hour } = parisNow();
  /* L'heure reste journalisée : c'est elle qui a révélé que le cron partait
     systématiquement en retard, et elle resservira au prochain doute. */
  if (!FORCE && !isReminderWindow(weekday)) {
    console.log("Hors fenêtre (dimanche, heure de Paris). Heure Paris actuelle : jour " + weekday + ", " + hour + "h. Rien à faire.");
    return;
  }
  console.log("Dans la fenêtre : dimanche, " + hour + "h à Paris. Envoi du rappel.");

  const weekStart = currentBossWeekStart(now);
  const { missingMembers } = await collectReminderData(sb, weekStart);

  const weekLabel = "semaine du " + new Date(weekStart + "T00:00:00Z")
    .toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const content = reminderMessage(weekLabel, missingMembers);

  if (!await postToDiscord(content)) {
    process.exitCode = 1;
    return;
  }
  console.log(
    "Rappel envoyé (" + weekStart + ") — " +
    missingMembers.length + " membre(s) sous les 3 runs."
  );
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exitCode = 1; });
}

module.exports = { collectReminderData };
