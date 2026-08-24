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

/* ---- Famille « à moi ou membre » : l'invité lit ses lignes, rien d'autre. ---- */

const AMOI_OU_MEMBRE = [
  ["profiles_read", "id"],
  ["teams_read", "owner"],
  ["roster_read", "owner"],
  ["collection_read", "owner"]
];

AMOI_OU_MEMBRE.forEach(([policy, colonne]) => {
  const bloc = sql.match(
    new RegExp("create policy " + policy + "[\\s\\S]*?;", "i")
  );
  assert.ok(bloc, "la politique " + policy + " doit exister");
  assert.match(
    bloc[0],
    new RegExp(
      colonne + "\\s*=\\s*auth\\.uid\\(\\)\\s+or\\s+private\\.est_membre\\(auth\\.uid\\(\\)\\)",
      "i"
    ),
    policy + " doit rendre ses propres lignes à un invité, et tout à un membre"
  );
});

/* ---- Famille « membre uniquement » : lecture ET écriture. ---- */

const MEMBRE_SEUL_LECTURE = [
  "rec_read",
  "avail_read",
  "boss_sessions_read",
  "boss_part_read",
  "boss_reports_read",
  "animation_measures_read"
];

MEMBRE_SEUL_LECTURE.forEach(policy => {
  const bloc = sql.match(
    new RegExp("create policy " + policy + "[\\s\\S]*?;", "i")
  );
  assert.ok(bloc, "la politique " + policy + " doit exister");
  assert.match(
    bloc[0],
    /using\s*\(\s*private\.est_membre\(auth\.uid\(\)\)\s*\)/i,
    policy + " doit être réservée aux membres"
  );
});

/* L'écriture compte autant que la lecture : une ligne de dispo ou de
   recensement écrite par un invité remonterait dans la grille et dans
   l'analyse de la confrérie, invisible pour lui et bien réelle pour elle. */
const MEMBRE_SEUL_ECRITURE = [
  "rec_insert", "rec_update", "rec_delete",
  "avail_insert", "avail_update", "avail_delete",
  "boss_sessions_insert",
  "animation_measures_insert"
];

MEMBRE_SEUL_ECRITURE.forEach(policy => {
  const bloc = sql.match(
    new RegExp("create policy " + policy + "[\\s\\S]*?;", "i")
  );
  assert.ok(bloc, "la politique " + policy + " doit exister");
  assert.match(
    bloc[0],
    /private\.est_membre\(auth\.uid\(\)\)/i,
    policy + " doit exiger d'être membre"
  );
});

/* Plus AUCUNE table de confrérie ne garde `using (true)`. C'est l'assertion
   qui aurait vu le trou d'origine : dix politiques identiques, ouvertes à tout
   compte créé en dix secondes depuis l'écran d'inscription. */
MEMBRE_SEUL_LECTURE.concat(AMOI_OU_MEMBRE.map(paire => paire[0]))
  .forEach(policy => {
    const bloc = sql.match(
      new RegExp("create policy " + policy + "[\\s\\S]*?;", "i")
    );
    assert.equal(
      /using\s*\(\s*true\s*\)/i.test(bloc[0]),
      false,
      policy + " ne doit plus être ouverte à tout compte connecté"
    );
  });

/* Le détecteur, mis à l'épreuve sur une copie fautive. */
const rouverte = sql.replace(
  /create policy rec_read[^;]*;/i,
  "create policy rec_read on public.recensement for select to authenticated using (true);"
);
const lectureOuverte = source =>
  /create policy rec_read[\s\S]*?using\s*\(\s*true\s*\)/i.test(source);
assert.equal(lectureOuverte(rouverte), true,
  "le détecteur doit voir une lecture rouverte");
assert.equal(lectureOuverte(sql), false,
  "le recensement ne doit jamais être ouvert à tout compte connecté");

/* ---- Les RPC du boss : la porte dérobée du chantier. ----

   Elles sont `security definer` : les politiques de table ne les arrêtent pas.
   Un contrôle posé uniquement sur les tables laisserait un invité rejoindre un
   run par appel direct au client Supabase. */

/* Le corps d'une fonction, quel que soit son schéma. */
function corpsDeFonction(qualifie){
  const bloc = sql.match(
    new RegExp(
      "create or replace function " + qualifie.replace(".", "\\.")
        + "\\s*\\([\\s\\S]*?\\n\\$\\$;",
      "i"
    )
  );
  return bloc ? bloc[0] : null;
}

/* Les trois gestes de boss ont été factorisés le jour où un administrateur a
   pu les faire pour autrui : leurs règles vivent maintenant dans une fonction
   privée que les deux entrées partagent. Le garde n'a pas disparu, il a changé
   d'adresse — et ce test doit le suivre plutôt que de conclure à son absence.

   Les entrées « admin » figurent ici au même titre que les autres : elles
   traversent la RLS elles aussi, et un invité promu administrateur par erreur
   ne doit toujours pas entrer dans un run. */
const DELEGATION = {
  join_boss_run:"private.rejoindre_run",
  admin_join_boss_run:"private.rejoindre_run",
  leave_boss_run:"private.quitter_run",
  admin_leave_boss_run:"private.quitter_run",
  select_boss_team:"private.choisir_equipe_run",
  admin_select_boss_team:"private.choisir_equipe_run"
};

const RPC_BOSS = [
  "join_boss_run",
  "leave_boss_run",
  "select_boss_team",
  "admin_join_boss_run",
  "admin_leave_boss_run",
  "admin_select_boss_team",
  "complete_boss_run_with_report",
  "update_boss_run_report"
];

RPC_BOSS.forEach(nom => {
  const bloc = corpsDeFonction("public." + nom);
  assert.ok(bloc, "public." + nom + " doit exister");
  const delegue = DELEGATION[nom];
  if(delegue){
    assert.match(
      bloc,
      new RegExp(delegue.replace(".", "\\.") + "\\s*\\("),
      "public." + nom + " doit déléguer à " + delegue
    );
  }
  /* Le garde se lit là où il est réellement exécuté : dans le corps de la RPC
     quand elle porte ses règles, dans la fonction privée sinon. */
  const porteur = delegue ? corpsDeFonction(delegue) : bloc;
  assert.ok(porteur, (delegue || nom) + " doit exister");
  assert.match(
    porteur,
    /if not private\.est_membre\([pv]_owner\) then\s*raise exception 'MEMBRE_REQUIS'/i,
    "public." + nom + " doit refuser un invité : elle contourne la RLS"
  );
});

/* Les trois entrées d'administration ajoutent leur propre barrière, portée sur
   l'APPELANT. Sans elle, n'importe quel membre inscrirait n'importe qui. */
["admin_join_boss_run", "admin_leave_boss_run", "admin_select_boss_team"]
  .forEach(nom => {
    assert.match(
      corpsDeFonction("public." + nom),
      /if not private\.est_admin\(auth\.uid\(\)\) then\s*raise exception 'ADMIN_REQUIS'/i,
      "public." + nom + " doit exiger que l'appelant soit administrateur"
    );
  });

/* ---- La RPC de promotion : le seul chemin de l'écran d'administration. ---- */

const promotion = sql.match(
  /create or replace function public\.definir_membre[\s\S]*?\n\$\$;/i
);
assert.ok(promotion, "public.definir_membre doit exister");
assert.match(promotion[0], /security definer/i,
  "definir_membre doit écrire sur la ligne d'autrui, ce que la RLS interdit");
assert.match(promotion[0], /private\.est_admin\(v_acteur\)/i,
  "seul un admin promeut");
assert.match(promotion[0], /AUTO_RETRAIT_REFUSE/,
  "un admin ne peut pas se retirer lui-même");
assert.match(
  sql,
  /grant execute on function public\.definir_membre\(uuid, boolean\) to authenticated/i,
  "la RPC doit être appelable depuis le site"
);

/* Sans le garde admin, n'importe quel compte se promouvrait par appel direct.
   On l'ôte d'une copie et on exige que le détecteur le voie. */
const sansGarde = sql.replace(/private\.est_admin\(v_acteur\)/i, "true");
const gardeAdmin = source =>
  /create or replace function public\.definir_membre[\s\S]*?private\.est_admin\(v_acteur\)/i
    .test(source);
assert.equal(gardeAdmin(sansGarde), false,
  "le détecteur doit voir un garde admin retiré");
assert.equal(gardeAdmin(sql), true, "le garde admin doit être en place");

console.log("comptes-invites-schema.test.js : OK");
