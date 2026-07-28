"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

function extractFunction(name) {
  const marker = "create or replace function " + name;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, name + " doit exister");
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1, name + " doit avoir un corps SQL borné");
  return sql.slice(start, end + 4);
}

function extractStatement(marker) {
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, marker + " doit exister");
  const end = sql.indexOf(";", start);
  assert.notEqual(end, -1, marker + " doit être une instruction complète");
  return sql.slice(start, end + 1);
}

const rosterFunction = extractFunction(
  "private.preserve_roster_weapon_configs()"
);
[
  /returns trigger\s+language plpgsql\s+set search_path\s*=\s*pg_catalog\s*,\s*public/i,
  /for v_type in select jsonb_object_keys\(new\.builds\)/i,
  /v_old_build\s*:=\s*old\.builds\s*->\s*v_type/i,
  /v_new_build\s*:=\s*new\.builds\s*->\s*v_type/i,
  /jsonb_typeof\(v_old_build\)\s*=\s*'object'/i,
  /jsonb_typeof\(v_new_build\)\s*=\s*'object'/i,
  /not\s*\(\s*v_new_build\s*\?\s*'weaponConfig'\s*\)/i,
  /v_old_build\s*\?\s*'weaponConfig'/i,
  /nullif\(v_new_build->>'weapon'\s*,\s*''\)\s+is not null/i,
  /v_new_build->>'weapon'\s+is not distinct from\s+v_old_build->>'weapon'/i,
  /new\.builds\s*:=\s*jsonb_set\(\s*new\.builds\s*,\s*array\[v_type\s*,\s*'weaponConfig'\]\s*,\s*v_old_build->'weaponConfig'\s*,\s*true\s*\)/i
].forEach(pattern => assert.match(rosterFunction, pattern));

const rosterDropTrigger = extractStatement(
  "drop trigger if exists preserve_roster_weapon_configs"
);
assert.match(
  rosterDropTrigger,
  /^drop trigger if exists preserve_roster_weapon_configs on public\.roster_characters\s*;$/i
);
const rosterTrigger = extractStatement(
  "create trigger preserve_roster_weapon_configs"
);
assert.match(
  rosterTrigger,
  /^create trigger preserve_roster_weapon_configs\s+before update of builds on public\.roster_characters\s+for each row execute function private\.preserve_roster_weapon_configs\(\)\s*;$/i
);

const teamFunction = extractFunction(
  "private.preserve_team_weapon_configs()"
);
[
  /returns trigger\s+language plpgsql\s+set search_path\s*=\s*pg_catalog\s*,\s*public/i,
  /jsonb_typeof\(new\.data->'heroes'\)\s*<>\s*'array'/i,
  /for v_index in 0\s*\.\.\s*jsonb_array_length\(new\.data->'heroes'\)\s*-\s*1/i,
  /v_old_hero\s*:=\s*old\.data->'heroes'->v_index/i,
  /v_new_hero\s*:=\s*new\.data->'heroes'->v_index/i,
  /jsonb_typeof\(v_old_hero\)\s*=\s*'object'/i,
  /jsonb_typeof\(v_new_hero\)\s*=\s*'object'/i,
  /not\s*\(\s*v_new_hero\s*\?\s*'weaponConfig'\s*\)/i,
  /v_old_hero\s*\?\s*'weaponConfig'/i,
  /nullif\(v_new_hero->>'weapon'\s*,\s*''\)\s+is not null/i,
  /v_new_hero->>'char'\s+is not distinct from\s+v_old_hero->>'char'/i,
  /v_new_hero->>'weapon'\s+is not distinct from\s+v_old_hero->>'weapon'/i,
  /new\.data\s*:=\s*jsonb_set\(\s*new\.data\s*,\s*array\['heroes'\s*,\s*v_index::text\s*,\s*'weaponConfig'\]\s*,\s*v_old_hero->'weaponConfig'\s*,\s*true\s*\)/i
].forEach(pattern => assert.match(teamFunction, pattern));

const teamDropTrigger = extractStatement(
  "drop trigger if exists preserve_team_weapon_configs"
);
assert.match(
  teamDropTrigger,
  /^drop trigger if exists preserve_team_weapon_configs on public\.teams\s*;$/i
);
const teamTrigger = extractStatement(
  "create trigger preserve_team_weapon_configs"
);
assert.match(
  teamTrigger,
  /^create trigger preserve_team_weapon_configs\s+before update of data on public\.teams\s+for each row execute function private\.preserve_team_weapon_configs\(\)\s*;$/i
);

const guardsStart = sql.indexOf(
  "create or replace function private.preserve_roster_weapon_configs"
);
const guardsEnd = sql.indexOf("-- ============================ RLS", guardsStart);
assert.notEqual(guardsStart, -1, "Les gardes SQL doivent exister");
assert.notEqual(guardsEnd, -1, "Les gardes doivent précéder le bloc RLS");

const guardsSql = sql.slice(guardsStart, guardsEnd);
assert.doesNotMatch(
  guardsSql,
  /\b(?:create\s+table|alter\s+table|add\s+column|create\s+policy|drop\s+policy)\b/i,
  "Les gardes ne doivent ni modifier le schéma ni toucher aux policies RLS"
);

console.log("PASS gardes SQL weaponConfig pour anciennes PWA");
