"use strict";

/* Le schéma de l'entraînement du boss : table, trigger, politiques et
   publication Realtime, tels qu'ils sont commités. Aucun serveur : on lit le
   SQL que l'administrateur colle dans Supabase. La syntaxe, elle, est tenue
   par tests/test_schema_sql.py (pglast). */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"), "utf8"
);

[
  /create table if not exists public\.boss_training_runs/i,
  /global_score\s+bigint not null check \(global_score > 0\)/i,
  /check \(char_length\(note\) <= 1000\)/i,
  /cardinality\(participants\) between 1 and 5/i,
  /alter table public\.boss_training_runs enable row level security/i,
  /create policy training_read[\s\S]*?using \(private\.est_membre\(auth\.uid\(\)\)\)/i,
  /create policy training_insert[\s\S]*?with check \(\s*created_by = auth\.uid\(\)\s+and auth\.uid\(\) = any\(participants\)\s+and private\.est_membre\(auth\.uid\(\)\)\s*\)/i,
  /create policy training_update[\s\S]*?using \(\s*auth\.uid\(\) = any\(participants\)\s+and private\.est_membre\(auth\.uid\(\)\)\s*\)\s*with check \(\s*auth\.uid\(\) = any\(participants\)\s*\)/i,
  /create policy training_delete[\s\S]*?using \(\s*auth\.uid\(\) = any\(participants\)\s+and private\.est_membre\(auth\.uid\(\)\)\s*\)/i,
  /create or replace function private\.boss_training_runs_prepare\(\)/i,
  /create trigger boss_training_runs_prepare\s+before insert or update on public\.boss_training_runs/i
].forEach(motif => assert.match(sql, motif, String(motif)));

/* Le serveur fige les équipes : un instantané fourni par le client ne doit
   jamais être recopié tel quel. Le trigger le reconstruit depuis `teams`, et
   vérifie que l'équipe appartient au participant. */
const trigger = sql.slice(
  sql.search(/create or replace function private\.boss_training_runs_prepare/i)
);
assert.match(trigger, /from public\.teams t\s+where t\.id = v_team_id\s+and t\.owner = v_participant/i);
assert.match(trigger, /TRAINING_TEAM_NOT_OWNED/);
assert.match(trigger, /TRAINING_FUTURE_DATE/);
assert.match(trigger, /now\(\) at time zone 'Europe\/Paris'/i);
/* L'auteur ne se déclare pas : le trigger le pose, et le fige ensuite. */
assert.match(trigger, /new\.created_by := auth\.uid\(\)/i);
assert.match(trigger, /new\.created_by := old\.created_by/i);

/* Aucune politique ne doit laisser écrire hors des participants. */
const politiques = sql.match(/create policy training_\w+[\s\S]*?;/gi) || [];
assert.equal(politiques.length, 4, "exactement quatre politiques training_*");
politiques.filter(p => !/training_read/i.test(p))
  .forEach(p => assert.match(p, /auth\.uid\(\) = any\(participants\)/i, p));

assert.ok(
  /foreach realtime_table in array array\[[^\]]*'boss_training_runs'[^\]]*\]/i.test(sql),
  "boss_training_runs manque au tableau des tables publiées en Realtime"
);

/* Le pseudo est recopié depuis profiles quand teamId change. La condition
   if/else suit le même motif que le snapshot. Si teamId inchangé, on garde
   l'ancien pseudo ; sinon, on relit depuis profiles. */
assert.match(trigger,
  /if\s+v_ancienne\s+is\s+not\s+null\s+and\s+\(\s*v_ancienne\s+->>.*?teamId.*?\)\s+is\s+not\s+distinct\s+from\s+v_team_id::/,
  "La condition du pseudo DOIT utiliser 'is not distinct from' pour traiter null=null comme inchangé"
);

console.log("PASS schema : boss_training_runs, trigger, politiques et Realtime");
