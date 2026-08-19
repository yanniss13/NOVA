"use strict";

/* Le schema de la boite de reception : la table et ses politiques, telles
   qu'elles sont commitees. Ce test ne parle a aucun serveur, il lit le SQL
   que l'administrateur va coller dans Supabase. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.animation_measures/i,
  /alter table public\.animation_measures enable row level security/i,
  /create policy animation_measures_read[\s\S]*?for select to authenticated using\s*\(\s*true\s*\)/i,
  /create policy animation_measures_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

/* Aucune politique `update` ni `delete` : une mesure envoyee est un fait
   date, pas un brouillon. La corriger, c'est en envoyer une autre, et c'est
   le rapatriement qui tranche entre les deux sous les yeux d'un humain. */
["update", "delete"].forEach(verbe => {
  assert.equal(
    new RegExp("create policy animation_measures_" + verbe, "i").test(sql),
    false,
    "aucune politique " + verbe + " ne doit exister sur animation_measures"
  );
});

/* Le mode conditionne la lecture du chiffre : sans lui, on ne sait pas si
   `seconds` est une mesure directe ou une moyenne sur `reps` lancements. */
assert.match(sql, /mode\s+text\s+not null[\s\S]*?rafale[\s\S]*?unique/i);

console.log("animation-measures-schema.test.js : OK");
