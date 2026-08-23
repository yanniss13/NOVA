"use strict";

/* Les presets sont prives. Ce test ne parle a aucun serveur : il lit le SQL
   commite, celui que l'administrateur collera dans Supabase. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.gear_presets/i,
  /primary key\s*\(\s*owner\s*,\s*id\s*\)/i,
  /nom\s+text\s+not null\s+check\s*\(\s*length\s*\(\s*btrim\s*\(\s*nom\s*\)\s*\)\s+between\s+1\s+and\s+40\s*\)/i,
  /payload\s+jsonb\s+not null/i,
  /alter table public\.gear_presets enable row level security/i
].forEach(pattern => assert.match(sql, pattern));

/* Les quatre verbes sont reserves au proprietaire. Un preset n'est pas une
   donnee de confrerie : personne d'autre ne le lit. */
["read", "insert", "update", "delete"].forEach(verbe => {
  assert.match(
    sql,
    new RegExp("create policy gear_presets_" + verbe + "\\b", "i"),
    "la politique gear_presets_" + verbe + " doit exister"
  );
});

assert.match(
  sql,
  /create policy gear_presets_read[\s\S]*?for select to authenticated using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  "la lecture doit etre limitee au proprietaire"
);
assert.match(
  sql,
  /create policy gear_presets_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
);

/* `for all` contournerait les quatre politiques d'un coup. On le refuse quel
   que soit le nom de la policy. */
assert.equal(
  /create\s+policy[\s\S]*?on\s+public\.gear_presets\s+for\s+all\b/i.test(sql),
  false,
  "aucune politique for all ne doit exister sur gear_presets"
);

/* Une policy de lecture ouverte a tous ferait fuiter les presets. Le test
   injecte la fuite dans une copie en memoire et exige son rejet : sans cela
   il ne prouverait que l'absence d'un texte, pas la regle. */
const fuite = sql.replace(
  /create policy gear_presets_read[^;]*;/i,
  "create policy gear_presets_read on public.gear_presets for select to authenticated using (true);"
);
const lectureOuverte = source =>
  /create policy gear_presets_read[\s\S]*?using\s*\(\s*true\s*\)/i.test(source);
assert.equal(lectureOuverte(fuite), true, "le detecteur doit voir une lecture ouverte");
assert.equal(lectureOuverte(sql), false, "la lecture ne doit jamais etre ouverte a tous");

console.log("presets-schema.test.js : OK");
