"use strict";

/* La memoire courte de /jarvis : les 3 derniers echanges d'un membre,
   gardes 30 minutes. La table vit dans le schema prive, sans politique :
   seule l'Edge Function, en service_role, passe par les deux fonctions.
   La syntaxe PL/pgSQL est validee a part par tests/test_schema_sql.py. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(path.resolve(__dirname, "..", "supabase", "schema.sql"), "utf8");

assert.match(sql, /create table if not exists private\.jarvis_memoire\s*\(/i,
  "la table est dans le schéma privé, hors de toute API cliente");
assert.match(sql, /revoke all on table private\.jarvis_memoire from public/i);
assert.doesNotMatch(sql, /create policy[^;]*jarvis_memoire/is, "aucune politique : aucun navigateur ne la lit");

["jarvis_memoire_lire(text)", "jarvis_memoire_noter(text, text, text)"].forEach(signature => {
  const nom = signature.replace(/\(.*$/, "");
  const echappee = signature.replace(/[()]/g, "\\$&");
  const corps = new RegExp("create or replace function public\\." + nom + "\\([\\s\\S]*?\\$\\$;", "i").exec(sql);
  assert.ok(corps, nom + " existe");
  assert.match(corps[0], /security definer/i, nom + " s'exécute avec les droits de son auteur");
  assert.match(corps[0], /set search_path = pg_catalog, public, private/i, nom + " fixe son search_path");
  assert.match(sql, new RegExp("revoke all on function public\\." + echappee + "\\s+from public", "i"));
  assert.match(sql, new RegExp("grant execute on function public\\." + echappee + "\\s+to service_role;", "i"),
    nom + " n'est ouverte qu'à la clé serveur");
});

const noter = /create or replace function public\.jarvis_memoire_noter\([\s\S]*?\$\$;/i.exec(sql)[0];
assert.match(noter, /interval '30 minutes'/, "les échanges expirent après 30 minutes");
assert.match(noter, /limit 3/i, "trois échanges au plus");
assert.match(noter, /delete from private\.jarvis_memoire where updated_at < now\(\) - interval '30 minutes'/i,
  "chaque écriture efface les mémoires périmées de tout le monde : rien ne s'accumule");
assert.match(noter, /left\(coalesce\(p_reponse, ''\), 600\)/i, "la réponse gardée est bornée");
const lire = /create or replace function public\.jarvis_memoire_lire\([\s\S]*?\$\$;/i.exec(sql)[0];
assert.match(lire, /interval '30 minutes'/, "un échange trop vieux n'est jamais relu");

console.log("OK jarvis-memoire-schema");
