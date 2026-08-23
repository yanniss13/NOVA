"use strict";

/* Le schema de la boite de reception : la table et ses politiques, telles
   qu'elles sont commitees. Ce test ne parle a aucun serveur, il lit le SQL
   que l'administrateur va coller dans Supabase. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.animation_measures/i,
  /game_id\s+text\s+not null/i,
  /alter table public\.animation_measures enable row level security/i,
  /create policy animation_measures_read[\s\S]*?using\s*\(\s*private\.est_membre\(auth\.uid\(\)\)\s*\)/i,
  /create policy animation_measures_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

/* Aucune politique `update` ni `delete` : une mesure envoyee est un fait
   date, pas un brouillon. La corriger, c'est en envoyer une autre, et c'est
   le rapatriement qui tranche entre les deux sous les yeux d'un humain. */
["update", "delete"].forEach(verbe => {
  assert.equal(
    new RegExp("create policy animation_measures_" + verbe, "i").test(sql),
    false,
    "aucune politique " + verbe + " ne doit exister sur animation_measures"
  );
});
const policyInterdite =
  /create\s+policy[\s\S]*?on\s+public\.animation_measures\s+for\s+(?:update|delete|all)\b/i;
assert.doesNotMatch(
  sql,
  policyInterdite,
  "aucune policy, quel que soit son nom, ne doit autoriser update, delete ou all"
);
assert.throws(
  () => assert.doesNotMatch(
    sql + "\ncreate policy animation_measures_trop_large on public.animation_measures for all using (true);",
    policyInterdite
  ),
  "la garde doit detecter une mutation FOR ALL sur la boite de reception"
);

/* Le mode conditionne la lecture du chiffre : sans lui, on ne sait pas si
   `seconds` est une mesure directe ou une moyenne sur `reps` lancements. */
assert.match(sql, /mode\s+text\s+not null[\s\S]*?rafale[\s\S]*?unique/i);

/* Le schema doit proteger les bornes et le protocole entier, y compris lors
   d'une relecture sur une installation deja existante. `fps:null` reste
   compatible avec les anciennes mesures. */
assert.match(sql, /animation_measures_seconds_range_check[\s\S]*?seconds\s*>\s*0[\s\S]*?seconds\s*<=\s*30/i);
assert.match(sql, /animation_measures_fps_range_check[\s\S]*?fps\s+is\s+null[\s\S]*?fps\s*>=\s*10[\s\S]*?fps\s*<=\s*240/i);
assert.match(sql, /animation_measures_protocol_check[\s\S]*?mode\s*=\s*'unique'[\s\S]*?reps\s+is\s+null[\s\S]*?mode\s*=\s*'rafale'[\s\S]*?reps\s*>=\s*2/i);

/* Les memes contraintes doivent etre rejouees APRES la compatibilite des
   colonnes, sinon une base qui possede deja la table conserverait ses anciens
   checks. On isole le second ALTER TABLE, pas le CREATE TABLE initial. */
const migrationTableExistante = sql.match(new RegExp([
  "alter\\s+table\\s+public\\.animation_measures\\s+add\\s+column\\s+if\\s+not\\s+exists\\s+game_id\\s+text;",
  "alter\\s+table\\s+public\\.animation_measures\\s+drop\\s+column\\s+if\\s+exists\\s+hero;",
  "alter\\s+table\\s+public\\.animation_measures\\s+drop\\s+column\\s+if\\s+exists\\s+slot;",
  "(alter\\s+table\\s+public\\.animation_measures\\s+drop\\s+constraint\\s+if\\s+exists\\s+animation_measures_seconds_check,[\\s\\S]*?",
  "alter\\s+table\\s+public\\.animation_measures\\s+add\\s+constraint[\\s\\S]*?;)"
].join("\\s*"), "i"));
assert.ok(migrationTableExistante, "la migration des tables existantes doit remplacer les checks");
const contraintesExistantes = migrationTableExistante[1];
[
  "animation_measures_seconds_check",
  "animation_measures_reps_check",
  "animation_measures_seconds_range_check",
  "animation_measures_fps_range_check",
  "animation_measures_protocol_check"
].forEach(nom => {
  assert.match(
    contraintesExistantes,
    new RegExp("drop\\s+constraint\\s+if\\s+exists\\s+" + nom, "i")
  );
});
assert.match(
  contraintesExistantes,
  /add\s+constraint\s+animation_measures_seconds_range_check\s+check\s*\(\s*seconds\s*>\s*0\s+and\s+seconds\s*<=\s*30\s*\)/i
);
assert.match(
  contraintesExistantes,
  /add\s+constraint\s+animation_measures_fps_range_check\s+check\s*\(\s*fps\s+is\s+null\s+or\s*\(\s*fps\s*>=\s*10\s+and\s+fps\s*<=\s*240\s*\)\s*\)/i
);
assert.match(
  contraintesExistantes,
  /add\s+constraint\s+animation_measures_protocol_check\s+check\s*\([\s\S]*?mode\s*=\s*'unique'[\s\S]*?reps\s+is\s+null[\s\S]*?mode\s*=\s*'rafale'[\s\S]*?reps\s*>=\s*2[\s\S]*?\)/i
);

/* La cle est le game_id, qui porte le heros, l'arme ET l'emplacement. Un
   heros change de moveset avec son arme : stocker heros + emplacement
   melangeait deux animations differentes sous une seule mesure. */
["hero", "slot"].forEach(colonne => {
  assert.equal(
    new RegExp("^\s+" + colonne + "\s+text", "im").test(sql),
    false,
    colonne + " ne suffit pas a designer une animation : utiliser game_id"
  );
});

console.log("animation-measures-schema.test.js : OK");
