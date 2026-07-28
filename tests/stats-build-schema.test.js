"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create or replace function private\.preserve_roster_weapon_configs/i,
  /create trigger preserve_roster_weapon_configs[\s\S]*before update of builds/i,
  /not\s*\(\s*v_new_build\s*\?\s*'weaponConfig'\s*\)/i,
  /v_new_build->>'weapon'\s+is not distinct from\s+v_old_build->>'weapon'/i,
  /jsonb_set[\s\S]*weaponConfig/i,
  /create or replace function private\.preserve_team_weapon_configs/i,
  /create trigger preserve_team_weapon_configs[\s\S]*before update of data/i,
  /v_new_hero->>'char'\s+is not distinct from\s+v_old_hero->>'char'/i
].forEach(pattern => assert.match(sql, pattern));

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
