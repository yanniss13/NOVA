"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");
const rollbackPath = path.join(ROOT, "supabase/rollback-boss-reports.sql");
const design = fs.readFileSync(
  path.join(ROOT, "docs/superpowers/specs/2026-07-26-boss-run-reports-design.md"),
  "utf8"
);
const plan = fs.readFileSync(
  path.join(ROOT, "docs/superpowers/plans/2026-07-26-boss-run-reports.md"),
  "utf8"
);

function between(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${label} : début absent`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label} : fin absente`);
  return source.slice(start, end);
}

function assertOrdered(source, expectations, label) {
  let cursor = 0;
  for (const [name, pattern] of expectations) {
    const match = source.slice(cursor).match(pattern);
    assert.ok(match, `${label} : étape absente (${name})`);
    cursor += match.index + match[0].length;
  }
}

function assertStrictRpc(source, name) {
  assert.match(
    source,
    new RegExp(`create or replace function public\\.${name}\\b`, "i"),
    `${name} : signature absente`
  );
  assert.match(
    source,
    /returns void\s+language plpgsql\s+security definer\s+set search_path = public,\s*pg_temp\s+as \$\$/i,
    `${name} : sécurité de la RPC incomplète`
  );
  assert.match(source, /v_owner uuid := auth\.uid\(\)/i, `${name} : auth.uid absent`);
  assert.match(source, /AUTH_REQUIRED/i, `${name} : authentification non exigée`);
}

const reportsTable = between(
  sql,
  "create table if not exists public.boss_run_reports",
  "create index if not exists boss_participation_session_idx",
  "table boss_run_reports"
);
assert.match(reportsTable, /session_id\s+uuid\s+primary key/i);
assert.match(reportsTable, /global_score\s+bigint\s+not null\s+check\s*\(\s*global_score\s*>\s*0\s*\)/i);
assert.match(reportsTable, /char_length\(note\)\s*<=\s*1000/i);
assert.match(
  sql,
  /alter table public\.boss_participation add column if not exists team_snapshot jsonb/i
);
assert.match(sql, /alter table public\.boss_run_reports\s+enable row level security/i);

const policyStatements = sql.match(/create policy[\s\S]*?;/gi) || [];
const reportPolicies = policyStatements.filter(statement =>
  /on\s+(?:public\.)?boss_run_reports\b/i.test(statement)
);
assert.equal(
  reportPolicies.length,
  1,
  "boss_run_reports doit posséder uniquement sa policy de lecture"
);
assert.match(
  reportPolicies[0],
  /for select to authenticated using\s*\(\s*true\s*\)/i,
  "La policy des rapports doit être une lecture authentifiée"
);
assert.doesNotMatch(
  reportPolicies[0],
  /\bfor\s+(?:all|insert|update|delete)\b|\bwith\s+check\b/i,
  "Aucune écriture directe des rapports ne doit être autorisée"
);

const joinBossRun = between(
  sql,
  "create or replace function public.join_boss_run",
  "create or replace function public.leave_boss_run",
  "join_boss_run"
);
assertStrictRpc(joinBossRun, "join_boss_run");
assert.match(
  joinBossRun,
  /select count\(\*\)\s+into v_member_count\s+from public\.boss_participation\s+where session_id\s*=\s*p_session_id/i,
  "join_boss_run doit compter uniquement les membres de la session verrouillée"
);
assert.match(
  joinBossRun,
  /if v_member_count\s*>=\s*5 then\s+raise exception 'GROUP_FULL'/i,
  "join_boss_run doit refuser le sixième membre"
);
assert.match(joinBossRun, /RUN_LIMIT_REACHED/i, "La limite personnelle de trois runs doit rester active");
assertOrdered(
  joinBossRun,
  [
    ["verrou de session", /from public\.boss_sessions[\s\S]*?for update/i],
    ["retour idempotent", /if exists\s*\([\s\S]*?from public\.boss_participation[\s\S]*?then\s+return;/i],
    ["comptage de session", /select count\(\*\)\s+into v_member_count[\s\S]*?where session_id\s*=\s*p_session_id/i],
    ["refus à cinq", /if v_member_count\s*>=\s*5 then[\s\S]*?GROUP_FULL/i],
    ["insertion", /insert into public\.boss_participation/i]
  ],
  "join_boss_run"
);

const selectBossTeam = between(
  sql,
  "create or replace function public.select_boss_team",
  "create or replace function public.complete_boss_run_with_report",
  "select_boss_team"
);
assertStrictRpc(selectBossTeam, "select_boss_team");
assert.match(
  selectBossTeam,
  /create or replace function public\.select_boss_team\s*\(\s*p_session_id uuid\s*,\s*p_team_id uuid\s*\)/i
);
assert.match(selectBossTeam, /v_week <> private\.current_boss_week_start\(\)/i);
assert.match(selectBossTeam, /v_status <> 'open'/i);
assert.match(selectBossTeam, /t\.id = p_team_id\s+and t\.owner = v_owner/i);
assert.match(selectBossTeam, /'capturedAt', now\(\)/i);
assert.match(
  selectBossTeam,
  /update public\.boss_participation\s+set team_id = p_team_id,\s+team_snapshot = v_snapshot,\s+updated_at = now\(\)\s+where session_id = p_session_id\s+and owner = v_owner/i
);
assert.doesNotMatch(selectBossTeam, /\b(?:insert|delete)\b/i);
assert.doesNotMatch(selectBossTeam, /update public\.(?:boss_sessions|boss_run_reports|teams)/i);
assertOrdered(
  selectBossTeam,
  [
    ["verrou de session", /from public\.boss_sessions[\s\S]*?for update/i],
    ["semaine courante", /if v_week <> private\.current_boss_week_start\(\)/i],
    ["statut ouvert", /if v_status <> 'open'/i],
    ["participation", /if not exists\s*\([\s\S]*?from public\.boss_participation/i],
    ["lecture équipe propriétaire", /from public\.teams[\s\S]*?t\.owner = v_owner/i],
    ["écriture instantané", /update public\.boss_participation/i]
  ],
  "select_boss_team"
);

const completeWithReport = between(
  sql,
  "create or replace function public.complete_boss_run_with_report",
  "create or replace function public.update_boss_run_report",
  "complete_boss_run_with_report"
);
assertStrictRpc(completeWithReport, "complete_boss_run_with_report");
assert.match(
  completeWithReport,
  /create or replace function public\.complete_boss_run_with_report\s*\(\s*p_session_id uuid\s*,\s*p_global_score bigint\s*,\s*p_note text\s*\)/i
);
assert.doesNotMatch(
  completeWithReport,
  /exception\s+when/i,
  "La terminaison doit laisser PostgreSQL annuler toute la transaction"
);
assert.doesNotMatch(completeWithReport, /\bdelete\b|update public\.boss_participation|update public\.boss_run_reports/i);
assertOrdered(
  completeWithReport,
  [
    ["verrou de session", /from public\.boss_sessions[\s\S]*?for update/i],
    ["semaine courante", /if v_run\.week_start <> private\.current_boss_week_start\(\)/i],
    [
      "comptage et équipes manquantes",
      /select count\(\*\),\s+count\(\*\) filter \(where team_snapshot is null\),\s+string_agg\(pseudo, ', '\) filter \(where team_snapshot is null\)/
    ],
    ["statut ouvert", /if v_run\.status <> 'open' then[\s\S]*?RUN_ARCHIVED/i],
    ["appelant participant", /if not exists\s*\([\s\S]*?owner = v_owner[\s\S]*?NOT_A_PARTICIPANT/i],
    ["groupe non vide", /if v_member_count < 1 then[\s\S]*?NOT_A_PARTICIPANT/i],
    ["capacité maximum", /if v_member_count > 5 then[\s\S]*?GROUP_OVER_CAPACITY/i],
    ["équipe obligatoire", /if v_missing_count > 0 then[\s\S]*?TEAM_REQUIRED/i],
    ["score valide", /if p_global_score is null or p_global_score <= 0 then[\s\S]*?INVALID_SCORE/i],
    ["note valide", /if char_length\(coalesce\(p_note, ''\)\) > 1000 then[\s\S]*?NOTE_TOO_LONG/i],
    ["insertion rapport", /insert into public\.boss_run_reports/i],
    ["archivage session", /update public\.boss_sessions[\s\S]*?status = 'archived'/i],
    ["création run suivante", /insert into public\.boss_sessions[\s\S]*?v_run\.run_no \+ 1/i]
  ],
  "complete_boss_run_with_report"
);

const updateReport = between(
  sql,
  "create or replace function public.update_boss_run_report",
  "create or replace function public.complete_boss_run(p_session_id uuid)",
  "update_boss_run_report"
);
assertStrictRpc(updateReport, "update_boss_run_report");
assert.match(
  updateReport,
  /create or replace function public\.update_boss_run_report\s*\(\s*p_session_id uuid\s*,\s*p_global_score bigint\s*,\s*p_note text\s*\)/i
);
assert.match(updateReport, /from public\.boss_run_reports[\s\S]*?for update/i);
assert.match(updateReport, /v_run_status <> 'archived'/i);
assert.match(
  updateReport,
  /from public\.boss_participation\s+where session_id = p_session_id\s+and owner = v_owner/i
);
assert.match(updateReport, /INVALID_SCORE/i);
assert.match(updateReport, /NOTE_TOO_LONG/i);
assertOrdered(
  updateReport,
  [
    ["verrou du rapport", /from public\.boss_run_reports[\s\S]*?for update/i],
    ["session archivée", /if v_run_status <> 'archived'/i],
    ["appelant participant", /from public\.boss_participation[\s\S]*?owner = v_owner/i],
    ["score valide", /if p_global_score is null or p_global_score <= 0/i],
    ["note valide", /if char_length\(coalesce\(p_note, ''\)\) > 1000/i],
    ["mise à jour du rapport", /update public\.boss_run_reports/i]
  ],
  "update_boss_run_report"
);
const correctionUpdates = updateReport.match(/\bupdate public\.[\s\S]*?;/gi) || [];
assert.equal(correctionUpdates.length, 1, "La correction doit exécuter un seul UPDATE");
assert.match(correctionUpdates[0], /^update public\.boss_run_reports/i);
assert.doesNotMatch(updateReport, /update public\.boss_sessions/i);
assert.doesNotMatch(updateReport, /update public\.boss_participation/i);
const assignedColumns = [...correctionUpdates[0].matchAll(/(?:\bset|,)\s*(\w+)\s*=/g)]
  .map(match => match[1]);
assert.deepEqual(
  assignedColumns,
  ["global_score", "note", "updated_by", "updated_by_pseudo", "updated_at"],
  "La correction doit préserver tous les champs immuables"
);
assert.match(updateReport, /updated_by\s*=\s*v_owner/i);
assert.match(updateReport, /updated_at\s*=\s*now\(\)/i);

const legacyComplete = between(
  sql,
  "create or replace function public.complete_boss_run(p_session_id uuid)",
  "-- boss_sessions :",
  "complete_boss_run legacy"
);
assert.match(
  legacyComplete,
  /returns void\s+language plpgsql\s+security definer\s+set search_path = public,\s*pg_temp\s+as \$\$/i
);
assert.match(legacyComplete, /REPORT_REQUIRED/i);
assert.doesNotMatch(
  legacyComplete,
  /\b(?:insert|update|delete)\b/i,
  "La terminaison legacy ne doit réaliser aucune écriture"
);

const grants = between(
  sql,
  "revoke all on function public.join_boss_run",
  "-- ============================ Realtime",
  "permissions RPC"
);
for (const signature of [
  "select_boss_team\\(uuid,\\s*uuid\\)",
  "complete_boss_run_with_report\\(uuid,\\s*bigint,\\s*text\\)",
  "update_boss_run_report\\(uuid,\\s*bigint,\\s*text\\)"
]) {
  assert.match(grants, new RegExp(`revoke all on function public\\.${signature} from public`, "i"));
  assert.match(grants, new RegExp(`grant execute on function public\\.${signature} to authenticated`, "i"));
}

const realtimeStart = sql.indexOf("-- ============================ Realtime");
assert.notEqual(realtimeStart, -1, "publication Realtime : début absent");
const realtime = sql.slice(realtimeStart);
assert.match(realtime, /['"]boss_run_reports['"]/i);

assert.ok(fs.existsSync(rollbackPath), "script de retour arrière manquant");
const rollback = fs.readFileSync(rollbackPath, "utf8");
const rollbackJoin = between(
  rollback,
  "create or replace function public.join_boss_run",
  "create or replace function public.complete_boss_run",
  "rollback join_boss_run"
);
assertStrictRpc(rollbackJoin, "join_boss_run");
assert.doesNotMatch(
  rollbackJoin,
  /GROUP_FULL|v_member_count/i,
  "Le rollback doit restaurer l’ancienne capacité non limitée"
);
assert.match(rollbackJoin, /RUN_LIMIT_REACHED/i);

const rollbackComplete = between(
  rollback,
  "create or replace function public.complete_boss_run",
  "revoke all on function public.select_boss_team",
  "rollback complete_boss_run"
);
assertStrictRpc(rollbackComplete, "complete_boss_run");
assert.match(rollbackComplete, /update public\.boss_sessions[\s\S]*?status = 'archived'/i);
assert.match(rollbackComplete, /insert into public\.boss_sessions[\s\S]*?v_run\.run_no \+ 1/i);

for (const signature of [
  "select_boss_team\\(uuid,\\s*uuid\\)",
  "complete_boss_run_with_report\\(uuid,\\s*bigint,\\s*text\\)",
  "update_boss_run_report\\(uuid,\\s*bigint,\\s*text\\)"
]) {
  assert.match(
    rollback,
    new RegExp(`revoke all on function public\\.${signature} from authenticated`, "i"),
    `Révocation rollback absente : ${signature}`
  );
}
assert.match(rollback, /revoke all on function public\.complete_boss_run\(uuid\) from public/i);
assert.match(rollback, /grant execute on function public\.complete_boss_run\(uuid\) to authenticated/i);
assert.doesNotMatch(
  rollback,
  /\bdrop\s+(?:table|column)\b|\bdelete\s+from\b|\btruncate\b/i,
  "Le retour arrière ne doit effacer aucune donnée"
);
assert.match(
  rollback,
  /fenêtre de compatibilité[\s\S]*?onglets[\s\S]*?PWA[\s\S]*?maintenance/i,
  "Le script doit prévenir de la fenêtre de compatibilité des clients récents"
);

const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
assert.match(
  agents,
  /Groupes de Boss de Guilde[\s\S]*?groupes ouverts simultanément[\s\S]*?1 à 5/i,
  "La documentation opérationnelle doit borner les groupes de boss à cinq membres"
);
assert.match(
  agents,
  /équipe propriétaire\s+obligatoire[\s\S]*?instantané immuable/i,
  "La documentation opérationnelle doit imposer une équipe propriétaire et son instantané"
);
assert.match(
  agents,
  /score global\s+obligatoire[\s\S]*?note facultative/i,
  "La documentation opérationnelle doit distinguer score obligatoire et note facultative"
);
assert.match(
  agents,
  /participant\s+archivé[\s\S]*?corriger[\s\S]*?score[\s\S]*?note/i,
  "La documentation opérationnelle doit réserver la correction aux participants archivés"
);
assert.match(
  agents,
  /SQL[\s\S]*?fusion\/push[\s\S]*?Pages[\s\S]*?mise à jour PWA/i,
  "La documentation opérationnelle doit donner l'ordre de déploiement"
);
assert.match(
  agents,
  /rollback-boss-reports\.sql[\s\S]*?git revert[\s\S]*?push/i,
  "La documentation opérationnelle doit donner l'ordre de retour arrière"
);
assert.doesNotMatch(
  agents,
  /Les écritures passent exclusivement par/i,
  "La documentation opérationnelle ne doit pas nier l'exception de seed boss_sessions"
);
assert.match(
  agents,
  /policy[\s\S]*?création initiale des seeds[\s\S]*?modifications\/suppressions de sessions[\s\S]*?boss_participation[\s\S]*?boss_run_reports[\s\S]*?flux métier[\s\S]*?via RPC/i,
  "La documentation opérationnelle doit borner exactement l'exception d'insertion des seeds"
);
assert.match(
  agents,
  /fenêtre de compatibilité[\s\S]*?onglets[\s\S]*?PWA[\s\S]*?maintenance[\s\S]*?Pages[\s\S]*?Mettre à jour[\s\S]*?chaque[\s\S]*?(?:fermer|fermeture)[\s\S]*?(?:rouvrir|réouverture)/i,
  "La procédure de rollback doit guider les clients récents jusqu’à la version PWA restaurée"
);
assert.match(
  agents,
  /ancienne interface[\s\S]*?complete_boss_run[\s\S]*?après le rollback/i,
  "La procédure doit expliquer quand l’ancienne interface redevient compatible"
);
assert.doesNotMatch(
  design,
  /Toutes les écritures de boss passent par des RPC/i,
  "La spec ne doit pas nier l’exception d’insertion des six seeds"
);
assert.match(
  design,
  /boss_sessions_insert[\s\S]*?six groupes courants[\s\S]*?run_no=1[\s\S]*?slots 1[–-]6[\s\S]*?écritures directes[\s\S]*?via RPC/i,
  "La spec doit borner exactement l’exception d’insertion des six seeds"
);
assert.match(
  design,
  /suppression d’un\s+compte[\s\S]*?conserve[\s\S]*?participation[\s\S]*?pseudo[\s\S]*?instantané[\s\S]*?droit de correction/i,
  "La spec doit garantir la conservation historique après suppression d’un compte"
);
assert.doesNotMatch(
  plan,
  /Toutes les écritures passent par des RPC `security definer`/i,
  "Le plan ne doit pas nier l’exception d’insertion des six seeds"
);
assert.match(
  plan,
  /boss_sessions_insert[\s\S]*?six\s+groupes courants[\s\S]*?run_no=1[\s\S]*?slots 1[–-]6[\s\S]*?via RPC/i,
  "Le plan doit refléter l’exception de seed sans élargir les écritures directes"
);

console.log("PASS rapports de boss : contrats stricts RPC, RLS, Realtime et rollback");
