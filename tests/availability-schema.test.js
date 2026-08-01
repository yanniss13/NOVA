"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.member_availability/i,
  /owner\s+uuid not null references auth\.users\(id\) on delete cascade/i,
  /week_start\s+date not null/i,
  /slots\s+text not null default repeat\('0', 168\)/i,
  /check\s*\(\s*slots\s*~\s*'\^\[01\]\{168\}\$'\s*\)/i,
  /primary key\s*\(\s*owner\s*,\s*week_start\s*\)/i,
  /create index if not exists member_availability_week_idx/i,
  /alter table public\.member_availability enable row level security/i
].forEach(pattern => assert.match(sql, pattern));

function normalizedPolicy(name) {
  const marker = "create policy " + name;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, name + " doit exister");
  const end = sql.indexOf(";", start);
  assert.notEqual(end, -1, name + " doit être une instruction complète");
  return sql.slice(start, end + 1).replace(/\s+/g, " ").trim().toLowerCase();
}

assert.strictEqual(
  normalizedPolicy("avail_read"),
  "create policy avail_read on public.member_availability "
  + "for select to authenticated using (true);"
);
assert.strictEqual(
  normalizedPolicy("avail_insert"),
  "create policy avail_insert on public.member_availability "
  + "for insert to authenticated with check (owner = auth.uid());"
);
assert.strictEqual(
  normalizedPolicy("avail_update"),
  "create policy avail_update on public.member_availability "
  + "for update to authenticated using (owner = auth.uid()) "
  + "with check (owner = auth.uid());"
);
assert.strictEqual(
  normalizedPolicy("avail_delete"),
  "create policy avail_delete on public.member_availability "
  + "for delete to authenticated using (owner = auth.uid());"
);

// La table doit être publiée en Realtime comme les autres tables partagées.
const realtimeStart = sql.indexOf("foreach realtime_table in array array[");
assert.notEqual(realtimeStart, -1, "Le bloc Realtime doit exister");
const realtimeEnd = sql.indexOf("]", realtimeStart);
assert.match(
  sql.slice(realtimeStart, realtimeEnd),
  /'member_availability'/,
  "member_availability doit rejoindre la publication supabase_realtime"
);

// La divergence avec la semaine de boss doit rester documentée dans le SQL.
assert.match(
  sql,
  /lundi ISO[\s\S]{0,400}current_boss_week_start/i,
  "Le commentaire doit avertir que week_start n'est pas la semaine de boss"
);

console.log("availability-schema.test.js OK");
