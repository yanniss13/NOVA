"use strict";

/* La serie hebdomadaire qui alimente la courbe de progression du BdG.

   Un point par SEMAINE de boss, valeur = le meilleur score rapporte cette
   semaine-la. Une semaine sans rapport lisible n'a pas de point : la placer
   a zero dessinerait un effondrement que personne n'a joue. */

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const { bossSerieHebdo } = hooks;

const session = (id, week) => ({ id, week_start:week, slot:1, run_no:1 });
const groups = [
  session("a", "2026-09-14"),
  session("b", "2026-09-14"),
  session("c", "2026-09-07"),
  session("vide", "2026-08-31")
];
const reports = [
  /* Au-dela de Number.MAX_SAFE_INTEGER : le meilleur doit rester exact. */
  { session_id:"a", global_score:"9007199254740992" },
  { session_id:"b", global_score:"9007199254740993" },
  { session_id:"c", global_score:"212000" },
  { session_id:"fantome", global_score:"999999999" },
  { session_id:"vide", global_score:"pas-un-score" }
];

const serie = bossSerieHebdo(groups, reports);

assert.deepEqual(plain(serie.map(point => point.weekStart)),
  ["2026-09-07", "2026-09-14"],
  "un point par semaine, de la plus ancienne a la plus recente");
assert.deepEqual(plain(serie.map(point => point.score)),
  ["212000", "9007199254740993"],
  "le meilleur score de la semaine, exact au-dela de 2^53");
assert.ok(serie.every(point => typeof point.score === "string"),
  "les scores restent des chaines, jamais des Number");
assert.ok(!serie.some(point => point.weekStart === "2026-08-31"),
  "une semaine sans rapport lisible n'est jamais tracee a zero");

const rapportOrphelin = bossSerieHebdo([], reports);
assert.deepEqual(plain(rapportOrphelin), [],
  "un rapport dont la session est inconnue n'invente pas de semaine");

assert.deepEqual(plain(bossSerieHebdo(null, null)), [],
  "sans donnees, une serie vide plutot qu'une erreur");

console.log("boss-serie-hebdo: ok");
