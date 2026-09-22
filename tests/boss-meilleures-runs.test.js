"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { bossTopRuns } = hooks;

const run = (id, week, completedAt) => ({
  id, title:"Groupe "+id, week_start:week, slot:1, run_no:1,
  status:"archived", completed_at:completedAt
});
const groups = [
  run("a", "2026-09-14", "2026-09-15T20:00:00Z"),
  run("b", "2026-09-14", "2026-09-16T20:00:00Z"),
  run("c", "2026-09-07", "2026-09-08T20:00:00Z"),
  run("d", "2026-09-14", "2026-09-17T20:00:00Z"),
  run("sans-rapport", "2026-09-14", "2026-09-18T20:00:00Z")
];
const reports = [
  /* Au-dela de Number.MAX_SAFE_INTEGER : la comparaison doit rester exacte. */
  { session_id:"a", global_score:"9007199254740993" },
  { session_id:"b", global_score:"9007199254740992" },
  { session_id:"c", global_score:"99999999999999999" },
  { session_id:"d", global_score:"9007199254740993" },
  { session_id:"fantome", global_score:"1" },
  { session_id:"sans-rapport-illisible", global_score:"abc" }
];
const membership = [
  { session_id:"a", pseudo:"Zoé" },
  { session_id:"a", pseudo:"émile" },
  { session_id:"b", pseudo:"Bob" }
];

const all = bossTopRuns(groups, reports, membership);
assert.deepEqual(plain(all.map(row => row.group.id)), ["c", "a", "d", "b"],
  "tri par score décroissant, égalité départagée par la run la plus ancienne");
assert.deepEqual(plain(all.map(row => row.rank)), [1, 2, 3, 4]);
assert.equal(typeof all[0].score, "bigint", "le score reste un BigInt");
assert.deepEqual(plain(all[1].members.map(m => m.pseudo)), ["émile", "Zoé"],
  "membres triés par pseudo, sans que la casse ni l'accent les séparent");
assert.ok(!all.some(row => row.group.id === "sans-rapport"),
  "une run sans rapport n'est jamais classée à zéro");

const week = bossTopRuns(groups, reports, membership, { weekStart:"2026-09-14" });
assert.deepEqual(plain(week.map(row => row.group.id)), ["a", "d", "b"],
  "le filtre de semaine exclut les autres semaines");

const top2 = bossTopRuns(groups, reports, membership, { limit:2 });
assert.equal(top2.length, 2);

assert.deepEqual(plain(bossTopRuns([], [], [])), []);
assert.deepEqual(plain(bossTopRuns(null, null, null)), []);
assert.equal(reports.length, 6, "les données sources ne sont pas modifiées");

console.log("PASS meilleures runs : tri exact, égalités, filtre de semaine, runs sans rapport");
