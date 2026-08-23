"use strict";

/* La cloison entre la confrérie et ses invités vit dans le SQL, et nulle part
   ailleurs. Ce test ne parle à aucun serveur : il lit le fichier que le
   propriétaire collera dans Supabase.

   Il compte plus que les tests d'interface : masquer un onglet est une
   politesse, refuser une lecture est la seule barrière réelle. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

/* ---- Les colonnes, et la promotion qui n'a lieu QU'UNE FOIS. ---- */

assert.match(
  sql,
  /add column membre boolean not null default false/i,
  "profiles doit porter le drapeau membre"
);
assert.match(
  sql,
  /add column admin\s+boolean not null default false/i,
  "profiles doit porter le drapeau admin"
);

/* `schema.sql` est rejoué en entier. Une promotion posée à nu repromouvrait
   tous les invités au collage suivant : elle doit être enfermée dans le garde
   qui ne se déclenche qu'à l'apparition des colonnes. */
const blocMigration = sql.match(
  /do \$\$[\s\S]*?column_name = 'membre'[\s\S]*?end\s*\$\$;/i
);
assert.ok(blocMigration, "la migration doit vivre dans un bloc do gardé");
assert.match(
  blocMigration[0],
  /update public\.profiles set membre = true/i,
  "les comptes déjà là doivent devenir membres, dans le même bloc"
);
assert.equal(
  /update public\.profiles set membre = true/gi.test(
    sql.replace(blocMigration[0], "")
  ),
  false,
  "aucune promotion en masse ne doit exister hors du bloc gardé"
);

/* ---- Les deux contrôles, et pourquoi ils contournent la RLS. ---- */

["est_membre", "est_admin"].forEach(nom => {
  const bloc = sql.match(
    new RegExp(
      "create or replace function private\\." + nom + "[\\s\\S]*?\\$\\$;",
      "i"
    )
  );
  assert.ok(bloc, "private." + nom + " doit exister");
  assert.match(
    bloc[0],
    /security definer/i,
    "private." + nom + " doit contourner la RLS, sans quoi la politique de "
      + "profiles se rappellerait elle-même"
  );
  assert.match(bloc[0], /stable/i, "private." + nom + " doit être stable");
  assert.match(
    sql,
    new RegExp(
      "grant execute on function private\\." + nom + "\\(uuid\\) to authenticated",
      "i"
    ),
    "private." + nom + " doit être exécutable par un compte connecté"
  );
});

/* ---- Le verrou : on ne se pose pas le drapeau soi-même. ---- */

const verrou = sql.match(
  /create or replace function private\.verrouiller_drapeaux_de_profil[\s\S]*?\$\$;/i
);
assert.ok(verrou, "le verrou des drapeaux doit exister");
assert.match(verrou[0], /ADMIN_NON_MODIFIABLE/,
  "le drapeau admin ne se change jamais depuis une session");
assert.match(verrou[0], /ADMIN_REQUIS/,
  "seul un admin change le drapeau membre");
assert.match(verrou[0], /AUTO_RETRAIT_REFUSE/,
  "un admin ne peut pas se retirer lui-même de la confrérie");
assert.match(
  sql,
  /create trigger verrouiller_drapeaux_de_profil\s+before update of membre, admin on public\.profiles/i,
  "le verrou doit être branché en trigger sur les deux colonnes"
);

/* Un détecteur qui ne détecte rien passerait tout. On injecte la faute dans
   une copie en mémoire et on exige qu'elle soit vue. */
const sansVerrou = sql.replace(
  /create trigger verrouiller_drapeaux_de_profil[^;]*;/i,
  ""
);
const verrouBranche = source =>
  /create trigger verrouiller_drapeaux_de_profil/i.test(source);
assert.equal(verrouBranche(sansVerrou), false,
  "le détecteur doit voir un verrou débranché");
assert.equal(verrouBranche(sql), true,
  "le verrou doit être branché");

console.log("comptes-invites-schema.test.js : OK");
