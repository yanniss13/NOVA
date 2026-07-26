"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.roster_characters/i,
  /primary key\s*\(\s*owner\s*,\s*char_id\s*\)/i,
  /check\s*\(\s*potential_tier\s+between\s+0\s+and\s+10\s*\)/i,
  /alter table public\.roster_characters enable row level security/i,
  /create policy roster_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /create policy roster_insert[\s\S]*with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy roster_update[\s\S]*?using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy roster_delete[\s\S]*using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

// Sessions de boss : trois runs atomiques par membre et par semaine.
[
  /create table if not exists public\.boss_sessions/i,
  /create table if not exists public\.boss_participation/i,
  /run_no\s+integer\s+not null\s+default\s+1/i,
  /completed_at\s+timestamptz/i,
  /primary key\s*\(\s*session_id\s*,\s*owner\s*\)/i,
  /create unique index if not exists boss_sessions_week_slot_run_idx[\s\S]*\(\s*week_start\s*,\s*slot\s*,\s*run_no\s*\)/i,
  /create unique index if not exists boss_sessions_one_open_slot_idx[\s\S]*\(\s*week_start\s*,\s*slot\s*\)[\s\S]*where\s+status\s*=\s*'open'/i,
  /create or replace function public\.join_boss_run\s*\(\s*p_session_id uuid\s*\)/i,
  /create or replace function public\.leave_boss_run\s*\(\s*p_session_id uuid\s*\)/i,
  /create or replace function public\.complete_boss_run\s*\(\s*p_session_id uuid\s*\)/i,
  /create or replace function private\.current_boss_week_start\s*\(\s*\)[\s\S]*language sql[\s\S]*stable[\s\S]*Europe\/Paris/i,
  /join_boss_run[\s\S]*pg_advisory_xact_lock[\s\S]*RUN_LIMIT_REACHED/i,
  /join_boss_run[\s\S]*v_week is null[\s\S]*private\.current_boss_week_start\s*\(\s*\)/i,
  /leave_boss_run[\s\S]*v_week is null[\s\S]*private\.current_boss_week_start\s*\(\s*\)/i,
  /complete_boss_run[\s\S]*v_run\.week_start is null[\s\S]*private\.current_boss_week_start\s*\(\s*\)/i,
  /complete_boss_run[\s\S]*for update[\s\S]*status\s*=\s*'archived'[\s\S]*run_no\s*\+\s*1/i,
  /security definer\s+set search_path\s*=\s*public\s*,\s*pg_temp/i,
  /alter table public\.boss_sessions\s+enable row level security/i,
  /alter table public\.boss_participation enable row level security/i,
  /create policy boss_sessions_insert[\s\S]*with check[\s\S]*created_by\s*=\s*auth\.uid\(\)[\s\S]*week_start is not null[\s\S]*week_start\s*=\s*private\.current_boss_week_start\s*\(\s*\)[\s\S]*run_no\s*=\s*1[\s\S]*slot\s+between\s+1\s+and\s+6/i,
  /create policy boss_part_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /grant execute on function public\.join_boss_run\(uuid\) to authenticated/i,
  /grant execute on function public\.leave_boss_run\(uuid\) to authenticated/i,
  /grant execute on function public\.complete_boss_run\(uuid\) to authenticated/i
].forEach(pattern => assert.match(sql, pattern));

const bossSessionsTable = sql.slice(
  sql.indexOf("create table if not exists public.boss_sessions"),
  sql.indexOf("create table if not exists public.boss_participation")
);
assert.match(
  bossSessionsTable,
  /week_start\s+date\s*,/i,
  "Le DDL rejouable doit assumer explicitement les anciennes semaines nullables"
);
assert.doesNotMatch(
  bossSessionsTable,
  /week_start\s+date\s+not null/i,
  "Aucun SET NOT NULL implicite ne doit risquer un backfill ou un conflit historique"
);
assert.match(
  bossSessionsTable,
  /alter table public\.boss_sessions add column if not exists week_start\s+date\s*;/i
);

const bossSessionsInsertPolicy = sql.slice(
  sql.indexOf("create policy boss_sessions_insert"),
  sql.indexOf("-- boss_participation")
);
[
  /title\s*=\s*'Groupe '\s*\|\|\s*slot/i,
  /boss_name\s*=\s*'Akumu, bête démoniaque'/i,
  /session_date\s*=\s*week_start/i,
  /elements\s*=\s*'\{\}'::text\[\]/i,
  /remind_at\s+is null/i,
  /reminded_at\s+is null/i
].forEach(pattern => assert.match(
  bossSessionsInsertPolicy,
  pattern,
  "La seed directe doit conserver toutes les métadonnées canoniques"
));

assert.doesNotMatch(sql, /create policy boss_sessions_update/i);
assert.doesNotMatch(sql, /create policy boss_sessions_delete/i);
assert.doesNotMatch(sql, /create policy boss_part_insert/i);
assert.doesNotMatch(sql, /create policy boss_part_update/i);
assert.doesNotMatch(sql, /create policy boss_part_delete/i);

const realtimeTables = [
  "profiles",
  "teams",
  "roster_characters",
  "boss_sessions",
  "boss_participation"
];

assert.match(sql, /pg_publication_tables/i);
assert.match(sql, /alter publication supabase_realtime add table/i);
realtimeTables.forEach(table => {
  assert.match(
    sql,
    new RegExp("\\b" + table + "\\b", "i"),
    table + " doit être ajoutée à Supabase Realtime"
  );
});

console.log("PASS schéma roster persistant + sessions de boss");
