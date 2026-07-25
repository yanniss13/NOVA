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

// Sessions de boss (#1)
[
  /create table if not exists public\.boss_sessions/i,
  /create table if not exists public\.boss_participation/i,
  /primary key\s*\(\s*session_id\s*,\s*owner\s*\)/i,
  /alter table public\.boss_sessions\s+enable row level security/i,
  /alter table public\.boss_participation enable row level security/i,
  /create policy boss_sessions_insert[\s\S]*with check\s*\(\s*created_by\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy boss_part_insert[\s\S]*with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy boss_part_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

console.log("PASS schéma roster persistant + sessions de boss");
