"use strict";

/* Le schéma de la collection : la table et ses politiques, telles qu'elles
   sont commitées. Ce test ne parle à aucun serveur — il lit le SQL que
   l'administrateur va coller dans Supabase, et vérifie qu'il dit bien ce que
   la conception a décidé. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.collection_items/i,
  /primary key\s*\(\s*owner\s*,\s*item\s*\)/i,
  /alter table public\.collection_items enable row level security/i,
  /create policy collection_read[\s\S]*?for select to authenticated using\s*\(\s*true\s*\)/i,
  /create policy collection_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy collection_delete[\s\S]*?using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

/* La clé primaire composite EST la règle métier : un membre ne peut pas
   posséder deux fois le même objet, et la base le garantit plutôt que le
   client. C'est aussi ce qui rend le double clic inoffensif. */
assert.match(
  sql,
  /create table if not exists public\.collection_items[\s\S]*?primary key\s*\(\s*owner\s*,\s*item\s*\)/i,
  "la clé primaire doit appartenir à collection_items"
);

/* Aucune politique `update` : une ligne de collection n'a rien à modifier,
   elle existe ou elle n'existe pas. En créer une ouvrirait un droit dont
   personne n'a besoin. */
assert.equal(
  /create policy collection_update/i.test(sql),
  false,
  "collection_items ne doit pas avoir de politique update"
);

/* Le compte supprimé emporte sa collection : sans cette cascade, des lignes
   orphelines survivraient à leur propriétaire, et la RLS ne saurait plus à
   qui les rattacher. */
assert.match(
  sql,
  /create table if not exists public\.collection_items[\s\S]*?owner\s+uuid\s+not null\s+references auth\.users\(id\) on delete cascade/i,
  "owner doit référencer auth.users avec suppression en cascade"
);

console.log("PASS schema : collection_items et ses politiques");
