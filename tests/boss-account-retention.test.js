"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");
const rollback = fs.readFileSync(
  path.join(ROOT, "supabase/rollback-boss-reports.sql"),
  "utf8"
);

function between(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${label} : début absent`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${label} : fin absente`);
  return source.slice(start, end);
}

const sessionsTable = between(
  sql,
  "create table if not exists public.boss_sessions",
  "-- Colonnes ajoutées",
  "boss_sessions"
);
const participationTable = between(
  sql,
  "create table if not exists public.boss_participation",
  "alter table public.boss_participation add column if not exists team_snapshot",
  "boss_participation"
);
const reportsTable = between(
  sql,
  "create table if not exists public.boss_run_reports",
  "-- Migration non destructive des archives de boss",
  "boss_run_reports"
);
const migration = between(
  sql,
  "-- Migration non destructive des archives de boss",
  "create index if not exists boss_participation_session_idx",
  "migration des archives de boss"
);

test("supprimer le créateur conserve la session et rend son UUID nullable", () => {
  assert.match(
    sessionsTable,
    /created_by\s+uuid\s+references auth\.users\(id\) on delete set null/i
  );
  assert.doesNotMatch(
    sessionsTable,
    /created_by[\s\S]*?on delete cascade/i
  );
  assert.match(
    migration,
    /alter table public\.boss_sessions\s+alter column created_by drop not null/i
  );
  assert.match(
    migration,
    /foreign key\s*\(created_by\)\s+references auth\.users\(id\)\s+on delete set null/i
  );
});

test("supprimer un participant conserve pseudo et snapshot avec une identité technique", () => {
  assert.match(
    participationTable,
    /id\s+uuid\s+primary key\s+default gen_random_uuid\(\)/i
  );
  assert.match(
    participationTable,
    /owner\s+uuid\s+references auth\.users\(id\) on delete set null/i
  );
  assert.match(
    participationTable,
    /constraint boss_participation_session_owner_key\s+unique\s*\(\s*session_id\s*,\s*owner\s*\)/i
  );
  assert.match(
    migration,
    /add column if not exists id uuid/i
  );
  assert.match(
    migration,
    /update public\.boss_participation\s+set id = gen_random_uuid\(\)\s+where id is null/i
  );
  assert.match(
    migration,
    /alter column id set not null/i
  );
  assert.match(
    migration,
    /primary key\s*\(\s*id\s*\)/i
  );
  assert.match(
    migration,
    /alter column owner drop not null/i
  );
  assert.match(
    migration,
    /foreign key\s*\(owner\)\s+references auth\.users\(id\)\s+on delete set null/i
  );
  assert.match(
    migration,
    /unique\s*\(\s*session_id\s*,\s*owner\s*\)/i
  );
  assert.doesNotMatch(
    migration,
    /\bdrop\s+(?:table|column)\b|\bdelete\s+from\b|\btruncate\b/i
  );
});

test("les participations, snapshots et rapports empêchent la suppression en cascade d'une session", () => {
  assert.match(
    participationTable,
    /session_id\s+uuid\s+not null references public\.boss_sessions\(id\) on delete restrict/i
  );
  assert.match(
    reportsTable,
    /references public\.boss_sessions\(id\) on delete restrict/i
  );
  assert.doesNotMatch(
    participationTable + reportsTable,
    /references public\.boss_sessions\(id\) on delete cascade/i
  );
  assert.match(
    migration,
    /foreign key\s*\(session_id\)\s+references public\.boss_sessions\(id\)\s+on delete restrict/gi
  );
});

test("un owner anonymisé ne récupère jamais les droits d'un compte actif", () => {
  /* Ces deux-là portent encore leurs règles dans leur propre corps. */
  for (const [name, end] of [
    ["complete_boss_run_with_report", "create or replace function public.update_boss_run_report"],
    ["update_boss_run_report", "create or replace function public.complete_boss_run(p_session_id uuid)"]
  ]) {
    const rpc = between(
      sql,
      `create or replace function public.${name}`,
      end,
      name
    );
    assert.match(rpc, /v_owner uuid := auth\.uid\(\)/i, `${name} : auth.uid absent`);
    assert.match(rpc, /AUTH_REQUIRED/i, `${name} : auth obligatoire absente`);
    assert.match(
      rpc,
      /owner\s*=\s*v_owner/i,
      `${name} : le droit actif doit comparer owner à auth.uid`
    );
    assert.doesNotMatch(
      rpc,
      /\bowner\s+is\s+null|coalesce\s*\(\s*owner\s*,/i,
      `${name} : un owner NULL ne doit jamais être assimilé à l'appelant`
    );
  }

  /* Les trois gestes de boss sont factorisés depuis qu'un administrateur peut
     les faire pour autrui. La garantie n'a pas faibli, elle se lit à deux
     endroits : l'entrée publique fournit l'identité de l'appelant, la fonction
     privée refuse un propriétaire nul et compare `owner` à l'argument reçu.

     C'est le refus du propriétaire nul qui porte tout le poids ici : un compte
     supprimé laisse `owner` à NULL, et sans ce refus la comparaison
     `owner = p_owner` rapprocherait deux NULL. */
  for (const [prive, entree, finPrive, finEntree] of [
    ["rejoindre_run", "join_boss_run",
      "create or replace function public.join_boss_run",
      "create or replace function public.admin_join_boss_run"],
    ["quitter_run", "leave_boss_run",
      "create or replace function public.leave_boss_run",
      "create or replace function public.admin_leave_boss_run"],
    ["choisir_equipe_run", "select_boss_team",
      "create or replace function public.select_boss_team",
      "create or replace function public.admin_select_boss_team"]
  ]) {
    const porteur = between(
      sql, `create or replace function private.${prive}`, finPrive, prive
    );
    const publique = between(
      sql, `create or replace function public.${entree}`, finEntree, entree
    );
    assert.match(
      publique,
      new RegExp(`private\\.${prive}\\s*\\(\\s*p_session_id\\s*,\\s*auth\\.uid\\(\\)`, "i"),
      `${entree} : l'entrée du membre doit passer auth.uid() et rien d'autre`
    );
    assert.match(
      porteur,
      /if p_owner is null then\s*raise exception 'AUTH_REQUIRED'/i,
      `${prive} : un propriétaire nul doit être refusé, pas comparé`
    );
    assert.match(
      porteur,
      /owner\s*=\s*p_owner/i,
      `${prive} : le droit actif doit comparer owner au propriétaire reçu`
    );
    assert.doesNotMatch(
      porteur,
      /\bowner\s+is\s+null|coalesce\s*\(\s*owner\s*,/i,
      `${prive} : un owner NULL ne doit jamais être assimilé à l'appelant`
    );
  }
});

test("le rollback reste compatible avec la clé technique et les owners nullables", () => {
  const rollbackJoin = between(
    rollback,
    "create or replace function public.join_boss_run",
    "create or replace function public.complete_boss_run",
    "rollback join_boss_run"
  );
  assert.match(
    rollbackJoin,
    /insert into public\.boss_participation\s*\(\s*session_id\s*,\s*owner\s*,\s*pseudo\s*,\s*updated_at\s*\)/i
  );
  assert.match(
    rollbackJoin,
    /on conflict\s*\(\s*session_id\s*,\s*owner\s*\)\s+do nothing/i
  );
  assert.match(rollbackJoin, /owner\s*=\s*v_owner/i);
  assert.doesNotMatch(
    rollbackJoin,
    /\bowner\s+is\s+null|coalesce\s*\(\s*owner\s*,/i
  );
  assert.doesNotMatch(
    rollback,
    /\bdrop\s+(?:table|column)\b|\bdelete\s+from\b|\btruncate\b/i
  );
});
