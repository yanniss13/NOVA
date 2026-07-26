"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");
const rollbackPath = path.join(ROOT, "supabase/rollback-boss-reports.sql");

[
  /create table if not exists public\.boss_run_reports/i,
  /session_id\s+uuid\s+primary key/i,
  /global_score\s+bigint\s+not null\s+check\s*\(\s*global_score\s*>\s*0\s*\)/i,
  /char_length\(note\)\s*<=\s*1000/i,
  /alter table public\.boss_participation add column if not exists team_snapshot jsonb/i,
  /create or replace function public\.select_boss_team\s*\(\s*p_session_id uuid\s*,\s*p_team_id uuid\s*\)/i,
  /create or replace function public\.complete_boss_run_with_report\s*\(\s*p_session_id uuid\s*,\s*p_global_score bigint\s*,\s*p_note text/i,
  /create or replace function public\.update_boss_run_report\s*\(\s*p_session_id uuid\s*,\s*p_global_score bigint\s*,\s*p_note text/i,
  /TEAM_REQUIRED/i,
  /INVALID_SCORE/i,
  /REPORT_REQUIRED/i,
  /create policy boss_reports_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /grant execute on function public\.select_boss_team\(uuid,\s*uuid\) to authenticated/i,
  /grant execute on function public\.complete_boss_run_with_report\(uuid,\s*bigint,\s*text\) to authenticated/i,
  /grant execute on function public\.update_boss_run_report\(uuid,\s*bigint,\s*text\) to authenticated/i
].forEach(pattern => assert.match(sql, pattern, "Contrat absent : " + pattern));

assert.doesNotMatch(
  sql,
  /create policy boss_reports_(insert|update|delete)/i,
  "Les rapports ne doivent jamais être écrits directement"
);
const realtime = sql.slice(sql.indexOf("-- ============================ Realtime"));
assert.match(
  realtime,
  /['"]boss_run_reports['"]/i,
  "Les rapports doivent être publiés en Realtime"
);

const correction = sql.slice(
  sql.indexOf("create or replace function public.update_boss_run_report"),
  sql.indexOf("-- boss_sessions :")
);
assert.match(correction, /updated_by\s*=\s*v_owner/i);
assert.match(correction, /updated_at\s*=\s*now\(\)/i);
assert.doesNotMatch(correction, /update public\.boss_sessions/i);
assert.doesNotMatch(correction, /update public\.boss_participation/i);

assert.ok(fs.existsSync(rollbackPath), "script de retour arrière manquant");
const rollback = fs.readFileSync(rollbackPath, "utf8");
assert.match(rollback, /create or replace function public\.join_boss_run/i);
assert.match(rollback, /create or replace function public\.complete_boss_run/i);
assert.match(rollback, /grant execute on function public\.complete_boss_run\(uuid\) to authenticated/i);
assert.match(
  rollback,
  /revoke all on function public\.select_boss_team\(uuid,\s*uuid\) from authenticated/i
);
assert.doesNotMatch(
  rollback,
  /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b/i,
  "Le retour arrière ne doit effacer aucune donnée"
);
assert.doesNotMatch(
  rollback,
  /GROUP_FULL/i,
  "Le rollback doit restaurer l’ancienne capacité non limitée"
);
assert.match(rollback, /RUN_LIMIT_REACHED/i);

console.log("PASS rapports de boss : schéma, RPC, RLS et rollback");
