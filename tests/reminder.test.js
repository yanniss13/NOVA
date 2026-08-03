"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  isReminderWindow, currentBossWeekStart, missingRuns, reminderMessage
} = require("../scripts/reminder-core.js");
const reminderLogs = [];
const originalConsoleLog = console.log;
console.log = (...args) => reminderLogs.push(args);
let collectReminderData;
try {
  ({ collectReminderData } = require("../scripts/discord-reminder.js"));
} finally {
  console.log = originalConsoleLog;
}
assert.deepStrictEqual(
  reminderLogs,
  [],
  "Importer le collecteur ne doit déclencher ni rappel ni message"
);

/* Fenêtre : le DIMANCHE, quelle que soit l'heure de Paris.

   L'heure exacte a été abandonnée après avoir constaté que le rappel n'était
   JAMAIS parti. GitHub Actions lance ses crons avec 20 à 90 minutes de retard
   sur les runners partagés : les quatre exécutions relevées les 26 juillet et
   2 août 2026 ont toutes vu 13h alors que la fenêtre exigeait 12h pile.

   Un seul cron subsiste, donc un seul déclenchement par dimanche : la fenêtre
   large ne peut pas produire de doublon. */
{
  assert.equal(isReminderWindow(0, 12), true);
  assert.equal(isReminderWindow(0, 11), true, "11h : un cron en avance poste quand même");
  assert.equal(isReminderWindow(0, 13), true, "13h : le retard observé ne doit plus rien annuler");
  assert.equal(isReminderWindow(0, 0), true, "minuit reste un dimanche");
  assert.equal(isReminderWindow(0, 23), true, "23h reste un dimanche");
  assert.equal(isReminderWindow(1, 12), false); // lundi -> non
  assert.equal(isReminderWindow(6, 12), false); // samedi -> non
}

/* L'invariant qui rend la fenêtre large sûre : UN SEUL cron.

   La fenêtre couvrant tout le dimanche, un second déclenchement posterait un
   second message dans le salon. Le garde-fou vit ici parce que rien dans le
   code JavaScript ne peut le voir : la faute se commettrait dans le YAML. */
{
  const workflow = fs.readFileSync(
    path.join(__dirname, "..", ".github", "workflows", "boss-reminder.yml"),
    "utf8"
  );
  const crons = workflow.match(/^\s*-\s*cron:/gm) || [];
  assert.equal(
    crons.length,
    1,
    "Un seul cron : la fenêtre couvre tout le dimanche, deux crons enverraient "
      + "deux messages. En ajouter un exige d'abord un verrou par semaine. "
      + "Trouvé : " + crons.length
  );
  assert.match(
    workflow,
    /cron:\s*"0 \d+ \* \* 0"/,
    "Le cron doit rester calé sur le dimanche (0 en fin d'expression)"
  );
  assert.match(
    workflow,
    /TEST_MESSAGE:\s*\$\{\{\s*inputs\.message\s*\}\}/,
    "Le message de vérification doit être câblé depuis l'entrée du workflow"
  );
}

/* Le message de vérification n'interroge JAMAIS Supabase.

   C'est ce qui le rend utilisable n'importe quand : envoyer le vrai rappel
   hors dimanche listerait la semaine à peine commencée, où tout le monde est
   à 0/3, et sèmerait la confusion dans le salon. */
{
  const source = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "discord-reminder.js"),
    "utf8"
  );
  const debutTest = source.indexOf("if (TEST_MESSAGE)");
  const premierAppelSupabase = source.indexOf("collectReminderData(sb");
  assert.ok(debutTest > 0, "La branche de vérification existe");
  assert.ok(premierAppelSupabase > 0, "L'appel Supabase existe");
  assert.ok(
    debutTest < premierAppelSupabase,
    "La branche de vérification doit court-circuiter l'appel Supabase"
  );
  assert.match(
    source.slice(debutTest, premierAppelSupabase),
    /return;/,
    "La branche de vérification doit rendre la main avant le vrai rappel"
  );
}

// currentBossWeekStart : lundi 9h (Paris) de la semaine de boss courante.
// (Juillet 2026 = heure d'été, Paris = UTC+2.)
{
  // Mercredi 22/07 12h Paris (10h UTC) -> lundi 20/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-22T10:00:00Z")), "2026-07-20");
  // Dimanche 26/07 12h Paris (10h UTC) -> toujours lundi 20/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-26T10:00:00Z")), "2026-07-20");
  // Lundi 20/07 8h Paris (6h UTC), avant le reset -> semaine précédente, lundi 13/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-20T06:00:00Z")), "2026-07-13");
  // Lundi 20/07 10h Paris (8h UTC), après le reset -> nouvelle semaine, lundi 20/07.
  assert.equal(currentBossWeekStart(new Date("2026-07-20T08:00:00Z")), "2026-07-20");
}

// missingRuns : une participation ouverte ou archivée vaut une run.
{
  const profiles = [
    { id: "u0", pseudo: "Zéro" },
    { id: "u1", pseudo: "Une" },
    { id: "u2", pseudo: "Deux" },
    { id: "u3", pseudo: "Trois" }
  ];
  const memberships = [
    { owner: "u1" },
    { owner: "u2" }, { owner: "u2" },
    { owner: "u3" }, { owner: "u3" }, { owner: "u3" }
  ];
  assert.deepStrictEqual(missingRuns(profiles, memberships), [
    { pseudo: "Zéro", missing: 3 },
    { pseudo: "Une", missing: 2 },
    { pseudo: "Deux", missing: 1 }
  ]);
  assert.deepStrictEqual(
    missingRuns([profiles[0]], memberships.concat({ owner: "u0" }), 2),
    [{ pseudo: "Zéro", missing: 1 }]
  );
}

// reminderMessage : détail par pseudo et cas où tout le monde est à 3/3.
{
  const msg = reminderMessage("semaine du 20 juil.", [
    { pseudo: "Casté", missing: 1 },
    { pseudo: "Syval", missing: 3 }
  ]);
  assert.match(msg, /Boss de confrérie/);
  assert.match(msg, /semaine du 20 juil\./);
  assert.match(msg, /Casté : 1 run restante/);
  assert.match(msg, /Syval : 3 runs restantes/);
  assert.match(reminderMessage("semaine du 20 juil.", []), /tout le monde est à 3\/3/);
}

async function testReminderCollectionWithoutSessions() {
  const profiles = [
    { id: "u1", pseudo: "Yannis" },
    { id: "u2", pseudo: "Merlin" }
  ];
  const requestedPaths = [];
  const request = async pathname => {
    requestedPaths.push(pathname);
    if (pathname.startsWith("boss_sessions?")) return [];
    if (pathname === "profiles?select=id,pseudo") return profiles;
    throw new Error("Requête inattendue : " + pathname);
  };

  const collected = await collectReminderData(request, "2026-07-20");

  assert.deepStrictEqual(collected.memberships, []);
  assert.deepStrictEqual(collected.missingMembers, [
    { pseudo: "Yannis", missing: 3 },
    { pseudo: "Merlin", missing: 3 }
  ]);
  assert.deepStrictEqual(requestedPaths, [
    "boss_sessions?week_start=eq.2026-07-20&select=id",
    "profiles?select=id,pseudo"
  ]);
  assert.equal(
    requestedPaths.some(pathname => pathname.startsWith("boss_participation?")),
    false,
    "Une semaine sans session ne doit pas produire de filtre in.() vide"
  );
}

testReminderCollectionWithoutSessions()
  .then(() => console.log("PASS rappel Discord (logique pure + collecte)"))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
