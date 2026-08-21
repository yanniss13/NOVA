"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const helpers = require("../supabase/functions/_shared/discord-planning.js");
const pdfFromNode = require("../scripts/availability-pdf.js");
const pdfShared = require("../supabase/functions/_shared/availability-pdf.js");
const { registerPlanningCommand } = require("../scripts/register-discord-planning.js");

assert.deepStrictEqual(helpers.planningCommandDefinition(), {
  name:"planning",
  description:"Affiche le planning des disponibilités de la confrérie",
  type:1
});
assert.ok(helpers.planningCommandDefinition().description.length <= 100);
assert.strictEqual(pdfFromNode, pdfShared,
  "Node et l'Edge Function doivent utiliser le même générateur d'images");

assert.equal(
  pdfShared.currentAvailabilityWeekStart(new Date("2026-08-02T21:30:00Z")),
  "2026-07-27",
  "dimanche 23h30 à Paris reste dans la semaine précédente"
);
assert.equal(
  pdfShared.currentAvailabilityWeekStart(new Date("2026-08-02T22:30:00Z")),
  "2026-08-03",
  "lundi 00h30 à Paris ouvre la nouvelle semaine ISO"
);

const maskA = "0".repeat(18) + "111" + "0".repeat(147);
const maskB = "0".repeat(19) + "11" + "0".repeat(147);
const sampleAvailabilityReport = pdfShared.buildAvailabilityReport([
  { id:"a", pseudo:"Éléonore" },
  { id:"b", pseudo:"Boris" },
  { id:"c", pseudo:"Sans saisie" }
], [
  { owner:"a", slots:maskA },
  { owner:"b", slots:maskB }
], "2026-08-17");
assert.equal(sampleAvailabilityReport.declaredCount, 2);
assert.equal(sampleAvailabilityReport.members.length, 3);
assert.deepStrictEqual(sampleAvailabilityReport.counts.slice(18, 22), [1, 2, 2, 0]);
assert.deepStrictEqual(sampleAvailabilityReport.best.slice(0, 2), [
  { index:19, count:2 },
  { index:20, count:2 }
]);
assert.deepStrictEqual(pdfShared.memberDayIntervals(maskA, 0), [{ start:18, end:21 }]);

assert.deepStrictEqual(helpers.parseIdList(" a, b ,,a "), ["a", "b", "a"]);
assert.equal(helpers.hasManagementPermission("8"), true, "Administrator");
assert.equal(helpers.hasManagementPermission("32"), true, "Manage Guild");
assert.equal(helpers.hasManagementPermission("0"), false);
assert.equal(helpers.hasManagementPermission("pas-un-entier"), false);

const baseInteraction = {
  guild_id:"guild", channel_id:"channel",
  member:{ roles:["member"], permissions:"0" }
};
assert.equal(helpers.planningAuthorizationError(baseInteraction, {
  guildId:"guild", channelIds:["channel"], allowedRoleIds:[]
}), "");
assert.match(helpers.planningAuthorizationError(baseInteraction, {
  guildId:"autre", channelIds:["channel"], allowedRoleIds:[]
}), /serveur/);
assert.match(helpers.planningAuthorizationError(baseInteraction, {
  guildId:"guild", channelIds:["autre"], allowedRoleIds:[]
}), /salon/);
assert.match(helpers.planningAuthorizationError(baseInteraction, {
  guildId:"guild", channelIds:["channel"], allowedRoleIds:["officier"]
}), /rôle/);
assert.equal(helpers.planningAuthorizationError({
  ...baseInteraction,
  member:{ roles:["officier"], permissions:"0" }
}, {
  guildId:"guild", channelIds:["channel"], allowedRoleIds:["officier"]
}), "");
assert.equal(helpers.planningAuthorizationError({
  ...baseInteraction,
  member:{ roles:[], permissions:"32" }
}, {
  guildId:"guild", channelIds:["channel"], allowedRoleIds:["officier"]
}), "", "un membre qui gère le serveur garde l'accès");

/* Plusieurs salons peuvent recevoir la commande : chacun doit être accepté,
   et un salon absent de la liste reste refusé. */
assert.equal(helpers.planningAuthorizationError(baseInteraction, {
  guildId:"guild", channelIds:["salon-2", "channel"], allowedRoleIds:[]
}), "", "un salon ajouté à la liste garde l'accès");
assert.equal(helpers.planningAuthorizationError({
  ...baseInteraction, channel_id:"salon-2"
}, {
  guildId:"guild", channelIds:["channel", "salon-2"], allowedRoleIds:[]
}), "", "le second salon configuré est autorisé");
assert.match(helpers.planningAuthorizationError({
  ...baseInteraction, channel_id:"salon-3"
}, {
  guildId:"guild", channelIds:["channel", "salon-2"], allowedRoleIds:[]
}), /salon/, "un salon hors liste reste refusé");
assert.match(helpers.planningAuthorizationError(baseInteraction, {
  guildId:"guild", channelIds:[], allowedRoleIds:[]
}), /configurée/, "aucun salon configuré bloque la commande");

const now = Date.UTC(2026, 7, 20, 12, 0, 0);
assert.equal(helpers.isFreshDiscordTimestamp(String(now / 1000), now), true);
assert.equal(helpers.isFreshDiscordTimestamp(String(now / 1000 - 301), now), false);
assert.equal(helpers.isFreshDiscordTimestamp("invalide", now), false);
assert.deepStrictEqual([...helpers.hexToUint8Array("00a1ff")], [0, 161, 255]);
assert.equal(helpers.hexToUint8Array("xyz"), null);
assert.equal(
  helpers.originalInteractionUrl("app", "jeton/test"),
  "https://discord.com/api/v10/webhooks/app/jeton%2Ftest/messages/@original"
);
assert.deepStrictEqual(helpers.ephemeralInteractionMessage("Refus"), {
  type:4,
  data:{ content:"Refus", flags:64, allowed_mentions:{ parse:[] } }
});

/* /chrono : le message est une fonction pure, verifiee sans reseau. */
assert.deepStrictEqual(helpers.chronoCommandDefinition(), {
  name:"chrono",
  description:"Où en est le chronométrage des animations, et quoi mesurer",
  type:1
});
assert.ok(helpers.chronoCommandDefinition().description.length <= 100);
assert.deepStrictEqual(
  helpers.commandDefinitions().map(commande => commande.name),
  ["planning", "chrono"]
);

const avancementExemple = {
  total:335,
  mesurees:4,
  debloquent:151,
  prochaines:[{
    gameId:"klotho_staff_normalatk_enchant_ready",
    heros:"klotho",
    arme:"Bâton",
    nom:"Projection dimensionnelle",
    categorie:"Attaque normale",
    touche:"clic gauche",
    role:"debloque"
  }]
};
const messageChrono = helpers.formatChronoMessage(avancementExemple, 7);
assert.match(messageChrono, /4\/335 mesurées/);
assert.match(messageChrono, /151 compétences n'ont aucun DPS calculable/);
assert.match(messageChrono, /7 mesure\(s\) reçue\(s\)/);
assert.match(messageChrono, /klotho · Bâton · Projection dimensionnelle/);
assert.match(messageChrono, /attaque normale, clic gauche/);

/* Ne pas pouvoir compter la boite de reception et la trouver vide sont deux
   informations differentes : la seconde seule s'annonce. */
assert.doesNotMatch(
  helpers.formatChronoMessage(avancementExemple, null), /reçue\(s\)/
);
assert.doesNotMatch(
  helpers.formatChronoMessage(avancementExemple, 0), /reçue\(s\)/
);

assert.match(
  helpers.formatChronoMessage({ total:335, mesurees:335, prochaines:[] }, 0),
  /Tout est fait/
);
assert.match(helpers.formatChronoMessage(null, null), /indisponible/);

/* Cinq lignes au plus : le fichier en publie cinq, mais le rendu ne doit pas
   dependre de cette promesse pour rester lisible dans Discord. */
assert.equal(
  helpers.formatChronoMessage({
    total:335, mesurees:0, debloquent:151,
    prochaines:Array.from({ length:9 }, (_, index) => ({
      heros:"h"+index, arme:"Hache", nom:"n"+index,
      categorie:"Attaque normale", touche:"clic gauche"
    }))
  }, null).split("\n").filter(ligne => ligne.startsWith("•")).length,
  5
);

assert.deepStrictEqual(helpers.chronoInteractionComponents(), [{
  type:1,
  components:[{
    type:2,
    style:5,
    label:"NOVA - Chronométrer une animation",
    url:helpers.NOVA_CHRONO_URL
  }]
}]);
assert.match(helpers.NOVA_CHRONO_URL, /outils\/chrono-animation\.html$/);

/* Le libelle de refus nomme la commande refusee, sinon /chrono renvoie le
   membre vers /planning. */
assert.match(
  helpers.planningAuthorizationError({ guild_id:"g", channel_id:"autre" },
    { guildId:"g", channelIds:["salon"] }, "chrono"),
  /Utilise \/chrono/
);

const edgeSource = fs.readFileSync(path.join(
  ROOT, "supabase", "functions", "discord-planning", "index.ts"
), "utf8");
[
  /X-Signature-Ed25519/,
  /X-Signature-Timestamp/,
  /nacl\.sign\.detached\.verify/,
  /interaction\.type === 1/,
  /planning:generateAndPublishPlanning/,
  /chrono:publishChronoProgress/,
  /* Une table de routage indexée par une chaîne venue du réseau : sans cette
     garde, « constructor » remonterait une fonction héritée d'Object. */
  /hasOwnProperty\.call\(taches, commandName\)/,
  /EdgeRuntime\.waitUntil\(tache\(interaction, config\)\)/,
  /chronometrage-avancement\.json/,
  /animation_measures\?select=id/,
  /chronoInteractionComponents\(\)/,
  /return jsonResponse\(\{ type:5 \}\)/,
  /rpc\/claim_discord_planning_request/,
  /parseIdList\(Deno\.env\.get\("DISCORD_PLANNING_CHANNEL_ID"\)\)/,
  /config\.guildId \+ ":" \+ \(interaction\.channel_id/,
  /availability-font\.js/,
  /member_availability\?week_start=eq\./,
  /generateAvailabilityTablePng\(report\)/,
  /generateAvailabilityDetailsPng\(report\)/,
  /form\.append\("payload_json"/,
  /form\.append\("files\[0\]"/,
  /form\.append\("files\[1\]"/,
  /type:"image\/png"/,
  /attachment:\/\//,
  /style:5/,
  /NOVA - Renseigner mes créneaux/,
  /https:\/\/yanniss13\.github\.io\/NOVA\/#availability/,
  /allowed_mentions:\{ parse:\[\] \}/
].forEach(pattern => assert.match(edgeSource, pattern, "contrat Edge absent : " + pattern));
assert.doesNotMatch(edgeSource, /DISCORD_WEBHOOK_URL|DISCORD_BOT_TOKEN/,
  "la fonction n'a besoin ni du webhook historique ni du token Bot");
assert.doesNotMatch(edgeSource, /application\/pdf|generateAvailabilityPdf/,
  "la commande /planning ne doit plus générer ni joindre de PDF");

const fontSource = fs.readFileSync(path.join(
  ROOT, "supabase", "functions", "_shared", "availability-font.js"
), "utf8");
assert.match(fontSource, /NOVA_AVAILABILITY_FONT/);
assert.match(fontSource, /"brand"/);

const config = fs.readFileSync(path.join(ROOT, "supabase", "config.toml"), "utf8");
assert.match(config, /\[functions\.discord-planning\][\s\S]*verify_jwt\s*=\s*false/);

const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
assert.match(schema, /create table if not exists private\.discord_planning_cooldown/i);
assert.match(schema, /create or replace function public\.claim_discord_planning_request/i);
assert.match(schema, /grant execute on function public\.claim_discord_planning_request\(text, integer\)\s+to service_role/i);
assert.doesNotMatch(schema,
  /grant execute on function public\.claim_discord_planning_request\(text, integer\)\s+to authenticated/i);

async function testRegistrationCreatesWithoutReplacing() {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    if(init.method === "GET") return new Response("[]", { status:200 });
    return new Response(JSON.stringify({ id:"new", name:"planning" }), { status:201 });
  };
  const result = await registerPlanningCommand({
    request, applicationId:"app", guildId:"guild", token:"secret"
  });
  assert.equal(result.action, "created");
  /* Une seule lecture, puis un POST par commande : /planning et /chrono
     partagent l'unique endpoint d'interactions de l'application. */
  assert.deepStrictEqual(
    calls.map(call => call.init.method), ["GET", "POST", "POST"]
  );
  assert.deepStrictEqual(
    result.commands.map(commande => commande.name), ["planning", "chrono"]
  );
  assert.doesNotMatch(calls[1].url, /\/commands\//);
  assert.equal(calls[1].init.headers.Authorization, "Bot secret");
  assert.deepStrictEqual(JSON.parse(calls[1].init.body), helpers.planningCommandDefinition());
  assert.deepStrictEqual(JSON.parse(calls[2].init.body), helpers.chronoCommandDefinition());
}

function assertPng(png, expectedHeight) {
  assert.deepStrictEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.readUInt32BE(16), 1600);
  if(expectedHeight) assert.equal(png.readUInt32BE(20), expectedHeight);
  else assert.ok(png.readUInt32BE(20) >= 680);
  assert.equal(png.subarray(-8, -4).toString("ascii"), "IEND");
  assert.ok(png.length < 2_000_000, "l'aperçu PNG reste léger pour Discord");
}

async function testAvailabilityImages() {
  const [table, details] = await Promise.all([
    pdfShared.generateAvailabilityTablePng(sampleAvailabilityReport),
    pdfShared.generateAvailabilityDetailsPng(sampleAvailabilityReport)
  ]);
  assertPng(table, 1000);
  assertPng(details);
  assert.notDeepStrictEqual(table, details);
}

async function testRegistrationUpdatesExisting() {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    if(init.method === "GET"){
      return new Response(JSON.stringify([
        { id:"other", name:"autre" }, { id:"planning-id", name:"planning" }
      ]), { status:200 });
    }
    return new Response(JSON.stringify({ id:"planning-id", name:"planning" }), { status:200 });
  };
  const result = await registerPlanningCommand({
    request, applicationId:"app", guildId:"guild", token:"secret"
  });
  /* /planning existe déjà, /chrono non : la première est corrigée sur place,
     la seconde créée, et la commande « autre » d'une autre application du
     serveur n'est jamais touchée. */
  assert.equal(result.action, "updated");
  assert.deepStrictEqual(
    calls.map(call => call.init.method), ["GET", "PATCH", "POST"]
  );
  assert.match(calls[1].url, /\/commands\/planning-id$/);
  assert.doesNotMatch(calls[2].url, /\/commands\//);
  assert.deepStrictEqual(
    result.commands.map(commande => commande.action), ["updated", "created"]
  );
  assert.equal(calls.some(call => call.init.method === "PUT"), false,
    "PUT remplacerait toutes les commandes de l'application");
}

Promise.all([
  testRegistrationCreatesWithoutReplacing(),
  testRegistrationUpdatesExisting(),
  testAvailabilityImages()
]).then(() => {
  console.log("PASS Discord : /planning en images, /chrono en avancement, autorisation");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
