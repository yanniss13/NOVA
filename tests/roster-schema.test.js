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
  /join_boss_run[\s\S]*pg_advisory_xact_lock[\s\S]*RUN_LIMIT_REACHED/i,
  /complete_boss_run[\s\S]*for update[\s\S]*status\s*=\s*'archived'[\s\S]*run_no\s*\+\s*1/i,
  /security definer\s+set search_path\s*=\s*public\s*,\s*pg_temp/i,
  /alter table public\.boss_sessions\s+enable row level security/i,
  /alter table public\.boss_participation enable row level security/i,
  /create policy boss_sessions_insert[\s\S]*with check[\s\S]*created_by\s*=\s*auth\.uid\(\)[\s\S]*run_no\s*=\s*1[\s\S]*slot\s+between\s+1\s+and\s+6/i,
  /create policy boss_part_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /grant execute on function public\.join_boss_run\(uuid\) to authenticated/i,
  /grant execute on function public\.leave_boss_run\(uuid\) to authenticated/i,
  /grant execute on function public\.complete_boss_run\(uuid\) to authenticated/i
].forEach(pattern => assert.match(sql, pattern));

assert.doesNotMatch(sql, /create policy boss_sessions_update/i);
assert.doesNotMatch(sql, /create policy boss_sessions_delete/i);
assert.doesNotMatch(sql, /create policy boss_part_insert/i);
assert.doesNotMatch(sql, /create policy boss_part_update/i);
assert.doesNotMatch(sql, /create policy boss_part_delete/i);

console.log("PASS schéma roster persistant + sessions de boss");
