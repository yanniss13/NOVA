"use strict";

/* Les donnees du jeu lues par /jarvis ne vivent QUE dans un bucket prive :
   jamais dans le depot public, jamais sur Pages. Ce test lit le SQL que
   l'administrateur colle dans Supabase, et le .gitignore qui empeche un
   `git add .` distrait de publier l'extraction. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(RACINE, "supabase", "schema.sql"), "utf8");

assert.match(sql,
  /insert into storage\.buckets\s*\(\s*id\s*,\s*name\s*,\s*public\s*\)\s*values\s*\(\s*'jarvis-prive'\s*,\s*'jarvis-prive'\s*,\s*false\s*\)/i,
  "le bucket jarvis-prive est cree prive");
assert.match(sql, /on conflict\s*\(\s*id\s*\)\s*do update set public\s*=\s*false/i,
  "rejouer le schema remet le bucket en prive s'il avait ete ouvert a la main");
assert.doesNotMatch(sql, /create policy[^;]*storage\.objects[^;]*jarvis-prive/is,
  "aucune politique n'ouvre la lecture du bucket : seule la cle service_role le lit");

const gitignore = fs.readFileSync(path.join(RACINE, ".gitignore"), "utf8");
assert.match(gitignore, /^output\/jarvis\/\s*$/m,
  "l'extraction des donnees du jeu ne doit jamais etre commitee");

console.log("OK jarvis-stockage");
