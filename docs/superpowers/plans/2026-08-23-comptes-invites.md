# Comptes invités et administration des membres — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner un compte à quelqu'un hors de la confrérie sans lui montrer les données de la confrérie, et pouvoir l'accueillir depuis le site.

**Architecture :** Deux drapeaux booléens (`membre`, `admin`) sur `public.profiles`. Une fonction `security definer` `private.est_membre()` sert de contrôle unique dans toutes les politiques RLS, ce qui évite la récursion de la politique de `profiles` sur elle-même. Le client lit ces drapeaux à l'ouverture de session et n'en fait qu'un usage : réduire la barre d'onglets. **La RLS est le portier ; l'interface n'est qu'une politesse.**

**Tech Stack :** PostgreSQL/Supabase (RLS, `security definer`, schéma `private`, triggers), modules ES vanilla sans étape de build, tests Node (`node:assert`) et Playwright.

**Spec :** [`docs/superpowers/specs/2026-08-23-comptes-invites-design.md`](../specs/2026-08-23-comptes-invites-design.md)

## Global Constraints

- **Aucune étape de build.** Modules ES chargés directement par le navigateur ; pas de transpilation, pas de bundler.
- **Les noms de premier niveau sont uniques dans TOUT `js/`.** Le chargeur `vm` de `tests/helpers/load-app.js` concatène chaque module dans une seule portée : un `function ligne(){}` déjà présent ailleurs fait échouer une vingtaine de tests sans rapport, sur un `SyntaxError: Identifier ... has already been declared`.
- **Tout module nouveau s'inscrit à trois endroits** : `tests/helpers/modules.js` (dans sa couche), `sw.js` → `CORE_ASSETS`, et il doit avoir au moins un importateur — `tests/modules-imports.test.js` refuse un export que personne n'importe.
- **Chaque test nouveau s'inscrit dans `scripts/lancer-tests.js`** : il n'y a aucune découverte automatique.
- **Les couches ne remontent jamais :** `noyau` → `etat` → `metier` → `donnees` → `vues`. Un module n'importe jamais un module déclaré après lui dans `tests/helpers/modules.js`.
- **`supabase/schema.sql` est rejoué EN ENTIER** à chaque évolution. Toute instruction doit rester idempotente **et** correcte au deuxième passage.
- **Le SQL n'est jamais appliqué par l'implémenteur.** Le fichier est versionné ; c'est le propriétaire qui le colle dans l'éditeur SQL de Supabase. Aucune tâche de ce plan ne se connecte au projet Supabase.
- **Français dans toute l'interface et tous les commentaires.** Les commentaires disent *pourquoi*, jamais *quoi*.
- Dépôt en CRLF ; `git` avertit à chaque commit, c'est normal.

## Écart assumé avec la spec

La spec écrit la migration ainsi :

```sql
update public.profiles set membre = true where membre = false;
```

**Cette forme est fausse au deuxième passage.** `schema.sql` est rejoué en entier ; le jour où un invité existe, ce collage le promeut membre. Le plan la remplace par un bloc `do` qui ne promeut qu'au moment exact où les colonnes apparaissent (Task 1). La spec est corrigée dans le même commit pour que les deux ne divergent pas.

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `supabase/schema.sql` | Colonnes, contrôles d'appartenance, verrou des drapeaux, politiques, gardes des RPC | 1, 2, 3 |
| `tests/comptes-invites-schema.test.js` (créé) | Lit le SQL commité et refuse toute porte laissée ouverte | 1, 2, 3 |
| `js/etat/session.js` | Porte `membre` / `admin` et les deux questions qu'on leur pose | 4 |
| `js/vues/session-auth.js` | Lit les drapeaux à l'ouverture de session | 4 |
| `js/vues/navigation.js` | Le portier : quelles vues sont à portée d'un invité | 4 |
| `js/vues/routage.js` | Distingue « il faut un compte » de « pas pour toi » | 4 |
| `tests/comptes-invites.test.js` (créé) | Table de vérité de `vueAutorisee` | 4 |
| `tests/helpers/faux-supabase.js` | Sait distinguer un membre d'un invité | 4 |
| `tests/comptes-invites.playwright.js` (créé) | Parcours invité, puis promotion par l'admin | 4, 5 |
| `js/donnees/administration-store.js` (créé) | Lit les comptes, appelle la RPC de promotion | 5 |
| `js/vues/administration.js` (créé) | La liste et l'interrupteur, sans une ligne de réseau | 5 |
| `index.html`, `css/roster.css`, `js/app.js`, `js/metier/routage.js`, `sw.js`, `tests/helpers/modules.js` | Branchement de l'écran | 5 |
| `docs/comptes-invites.md` (créé) | Ce que le propriétaire doit faire dans Supabase, une fois | 6 |

---

### Task 1 : Les deux drapeaux et le contrôle d'appartenance

Cette tâche ajoute les colonnes, les deux fonctions de contrôle et le verrou qui empêche quiconque de se promouvoir soi-même. Elle ne change encore **aucune** politique : le site se comporte exactement comme avant.

**Files:**
- Modify: `supabase/schema.sql` (insertions après la ligne 12 et après la ligne 69)
- Modify: `docs/superpowers/specs/2026-08-23-comptes-invites-design.md` (bloc migration)
- Create: `tests/comptes-invites-schema.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consomme : rien.
- Produit : `private.est_membre(p_uid uuid) returns boolean`, `private.est_admin(p_uid uuid) returns boolean`, les colonnes `public.profiles.membre` et `public.profiles.admin` (`boolean not null default false`), le trigger `verrouiller_drapeaux_de_profil` sur `public.profiles`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/comptes-invites-schema.test.js` :

```js
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
```

- [ ] **Step 2 : Lancer le test et le voir échouer**

Run : `node tests/comptes-invites-schema.test.js`
Attendu : ÉCHEC sur `AssertionError: profiles doit porter le drapeau membre`.

- [ ] **Step 3 : Ajouter les colonnes dans `supabase/schema.sql`**

Insérer **juste après** la fin de la table `public.profiles` (après le `);` de la ligne 12) :

```sql

-- Deux drapeaux, et non un rôle unique : un admin est toujours membre, mais
-- séparer les deux axes évite d'inventer une hiérarchie dont personne n'a
-- besoin. Les deux partent à `false` : un compte fraîchement créé est un
-- invité, et le reste tant qu'on ne l'accueille pas.
--
-- LE BLOC `do` N'EST PAS UNE COQUETTERIE. Ce fichier est rejoué en entier à
-- chaque évolution du schéma. Un `update ... set membre = true` posé à nu
-- repromouvrait TOUS LES INVITÉS au collage suivant. La promotion n'a de sens
-- qu'au moment exact où les colonnes apparaissent : c'est ce que ce garde
-- exprime, et il tient dans la même transaction que l'ajout.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'membre'
  ) then
    alter table public.profiles
      add column membre boolean not null default false,
      add column admin  boolean not null default false;
    -- Tous les comptes déjà là sont ceux de la confrérie : sans cette ligne,
    -- elle devient invitée chez elle à la seconde où le schéma est appliqué.
    update public.profiles set membre = true;
  end if;
end
$$;
```

- [ ] **Step 4 : Ajouter les deux contrôles et le verrou**

Insérer **juste après** `revoke all on schema private from public;` (ligne 69) :

```sql

-- Le contrôle d'appartenance, et pourquoi il vit dans une fonction.
--
-- La politique de lecture de `profiles` doit demander « es-tu membre ? », donc
-- lire `profiles`. Une fonction ordinaire relancerait la politique sur
-- elle-même : récursion infinie de RLS, l'erreur classique sur Supabase.
-- `security definer` contourne la RLS et ferme la boucle.
--
-- L'usage du schéma `private` est accordé à `authenticated` plus bas, avec
-- `private.current_boss_week_start()` : les politiques appellent déjà ce
-- schéma, c'est un chemin éprouvé.
create or replace function private.est_membre(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select membre from public.profiles where id = p_uid), false);
$$;

create or replace function private.est_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select admin from public.profiles where id = p_uid), false);
$$;

revoke all on function private.est_membre(uuid) from public;
revoke all on function private.est_admin(uuid) from public;
grant execute on function private.est_membre(uuid) to authenticated;
grant execute on function private.est_admin(uuid) to authenticated;

-- Le drapeau `membre` ne se pose pas soi-même.
--
-- `profiles_update` autorise chacun à modifier SA ligne, pseudo compris. Sans
-- ce verrou, un invité s'accorderait `membre = true` en une requête et toute
-- la cloison tomberait. Une politique RLS ne peut pas comparer l'ancienne et
-- la nouvelle ligne : c'est un trigger, ou rien.
--
-- `auth.uid()` vaut null hors session JWT — éditeur SQL, `service_role`. C'est
-- par là, et seulement par là, que le propriétaire se pose `admin = true` la
-- première fois.
create or replace function private.verrouiller_drapeaux_de_profil()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.membre is not distinct from old.membre
     and new.admin is not distinct from old.admin then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;
  if new.admin is distinct from old.admin then
    raise exception 'ADMIN_NON_MODIFIABLE' using errcode = 'P0001';
  end if;
  if not private.est_admin(auth.uid()) then
    raise exception 'ADMIN_REQUIS' using errcode = 'P0001';
  end if;
  -- Se retirer soi-même couperait le dernier responsable de tout ce qu'il
  -- administre, sans que personne puisse l'y remettre.
  if new.id = auth.uid() and old.membre and not new.membre then
    raise exception 'AUTO_RETRAIT_REFUSE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists verrouiller_drapeaux_de_profil on public.profiles;
create trigger verrouiller_drapeaux_de_profil
before update of membre, admin on public.profiles
for each row execute function private.verrouiller_drapeaux_de_profil();
```

- [ ] **Step 5 : Inscrire le test dans le lanceur**

Dans `scripts/lancer-tests.js`, ajouter la ligne juste après `"node tests/presets-schema.test.js",` :

```js
    "node tests/comptes-invites-schema.test.js",
```

- [ ] **Step 6 : Lancer le test et le voir passer**

Run : `node tests/comptes-invites-schema.test.js`
Attendu : `comptes-invites-schema.test.js : OK`

- [ ] **Step 7 : Vérifier que le SQL parse vraiment**

Run : `python -m unittest tests/test_schema_sql.py`
Attendu : OK. Ce test embarque le parseur de PostgreSQL, corps PL/pgSQL compris — c'est lui qui attrape une virgule oubliée dans le bloc `do`.

- [ ] **Step 8 : Corriger la spec pour qu'elle ne mente pas**

Dans `docs/superpowers/specs/2026-08-23-comptes-invites-design.md`, remplacer le bloc SQL de la section « La migration, et son risque » par le bloc `do` ci-dessus, et ajouter juste après :

```markdown
Le garde `if not exists` n'est pas décoratif : ce fichier est rejoué en entier
à chaque évolution du schéma, et un `update` posé à nu repromouvrait tous les
invités au collage suivant.
```

- [ ] **Step 9 : Commit**

```bash
git add supabase/schema.sql tests/comptes-invites-schema.test.js scripts/lancer-tests.js docs/superpowers/specs/2026-08-23-comptes-invites-design.md
git commit -m "feat(invites): poser les drapeaux membre et admin, et leur verrou"
```

---

### Task 2 : Les politiques, en deux familles

Le cœur du chantier. Après cette tâche, un invité ne lit plus que ses propres lignes, et n'écrit plus une seule ligne de confrérie.

**Files:**
- Modify: `supabase/schema.sql` (lignes 318-364, 1028-1058, 1101-1109, 1256-1257)
- Modify: `tests/comptes-invites-schema.test.js`

**Interfaces:**
- Consomme : `private.est_membre(uuid)` (Task 1).
- Produit : dix tables cloisonnées. Aucune signature nouvelle.

- [ ] **Step 1 : Étendre le test avec les deux familles**

Ajouter dans `tests/comptes-invites-schema.test.js`, avant la ligne `console.log` finale :

```js
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
```

- [ ] **Step 2 : Lancer le test et le voir échouer**

Run : `node tests/comptes-invites-schema.test.js`
Attendu : ÉCHEC sur `profiles_read doit rendre ses propres lignes à un invité, et tout à un membre`.

- [ ] **Step 3 : Réécrire les politiques « à moi ou membre »**

Dans `supabase/schema.sql`, remplacer les quatre lignes de lecture existantes.

Remplacer :

```sql
create policy profiles_read   on public.profiles for select to authenticated using (true);
```

par :

```sql
-- « À moi ou membre » : l'invité voit son propre profil, le membre voit la
-- confrérie. C'est ici que la récursion menaçait — d'où private.est_membre.
create policy profiles_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or private.est_membre(auth.uid()));
```

Remplacer :

```sql
create policy teams_read   on public.teams for select to authenticated using (true);
```

par :

```sql
create policy teams_read on public.teams
  for select to authenticated
  using (owner = auth.uid() or private.est_membre(auth.uid()));
```

Remplacer :

```sql
create policy roster_read   on public.roster_characters for select to authenticated using (true);
```

par :

```sql
create policy roster_read on public.roster_characters
  for select to authenticated
  using (owner = auth.uid() or private.est_membre(auth.uid()));
```

Remplacer :

```sql
create policy collection_read   on public.collection_items for select to authenticated using (true);
```

par :

```sql
create policy collection_read on public.collection_items
  for select to authenticated
  using (owner = auth.uid() or private.est_membre(auth.uid()));
```

- [ ] **Step 4 : Réécrire les politiques du recensement**

Remplacer les quatre lignes :

```sql
create policy rec_read   on public.recensement for select to authenticated using (true);
create policy rec_insert on public.recensement for insert to authenticated with check (owner = auth.uid());
create policy rec_update on public.recensement for update to authenticated using (owner = auth.uid());
create policy rec_delete on public.recensement for delete to authenticated using (owner = auth.uid());
```

par :

```sql
-- « Membre uniquement », lecture ET écriture. Un recensement écrit par un
-- invité serait invisible pour lui et bien réel dans l'analyse de la
-- confrérie : c'est le pire des deux mondes.
create policy rec_read on public.recensement
  for select to authenticated
  using (private.est_membre(auth.uid()));
create policy rec_insert on public.recensement
  for insert to authenticated
  with check (owner = auth.uid() and private.est_membre(auth.uid()));
create policy rec_update on public.recensement
  for update to authenticated
  using (owner = auth.uid() and private.est_membre(auth.uid()));
create policy rec_delete on public.recensement
  for delete to authenticated
  using (owner = auth.uid() and private.est_membre(auth.uid()));
```

- [ ] **Step 5 : Réécrire les politiques des disponibilités**

Remplacer :

```sql
create policy avail_read on public.member_availability
  for select to authenticated using (true);
create policy avail_insert on public.member_availability
  for insert to authenticated with check (owner = auth.uid());
create policy avail_update on public.member_availability
  for update to authenticated using (owner = auth.uid())
  with check (owner = auth.uid());
create policy avail_delete on public.member_availability
  for delete to authenticated using (owner = auth.uid());
```

par :

```sql
create policy avail_read on public.member_availability
  for select to authenticated
  using (private.est_membre(auth.uid()));
create policy avail_insert on public.member_availability
  for insert to authenticated
  with check (owner = auth.uid() and private.est_membre(auth.uid()));
create policy avail_update on public.member_availability
  for update to authenticated
  using (owner = auth.uid() and private.est_membre(auth.uid()))
  with check (owner = auth.uid() and private.est_membre(auth.uid()));
create policy avail_delete on public.member_availability
  for delete to authenticated
  using (owner = auth.uid() and private.est_membre(auth.uid()));
```

- [ ] **Step 6 : Réécrire les politiques du boss**

Remplacer :

```sql
create policy boss_sessions_read   on public.boss_sessions for select to authenticated using (true);
```

par :

```sql
create policy boss_sessions_read on public.boss_sessions
  for select to authenticated
  using (private.est_membre(auth.uid()));
```

Dans `create policy boss_sessions_insert`, remplacer la première ligne du `with check` :

```sql
    created_by = auth.uid()
```

par :

```sql
    created_by = auth.uid()
    and private.est_membre(auth.uid())
```

Remplacer :

```sql
create policy boss_part_read   on public.boss_participation for select to authenticated using (true);
```

par :

```sql
create policy boss_part_read on public.boss_participation
  for select to authenticated
  using (private.est_membre(auth.uid()));
```

Remplacer :

```sql
create policy boss_reports_read
  on public.boss_run_reports
  for select to authenticated using (true);
```

par :

```sql
create policy boss_reports_read
  on public.boss_run_reports
  for select to authenticated
  using (private.est_membre(auth.uid()));
```

- [ ] **Step 7 : Réécrire les politiques du chronométrage**

Remplacer :

```sql
create policy animation_measures_read   on public.animation_measures for select to authenticated using (true);
create policy animation_measures_insert on public.animation_measures for insert to authenticated with check (owner = auth.uid());
```

par :

```sql
-- Le chronométrage est un effort de confrérie. Aucun écran du site ne lit
-- cette table : seul `scripts/rapatrier-mesures.py` la lit, et il ouvre une
-- session avec un compte ordinaire — la RLS s'y applique donc pleinement.
-- Qui rapatrie doit être membre, et qui envoie une mesure aussi. Un invité
-- qui chronomètre verra ses envois refusés tant qu'on ne l'a pas accueilli.
create policy animation_measures_read on public.animation_measures
  for select to authenticated
  using (private.est_membre(auth.uid()));
create policy animation_measures_insert on public.animation_measures
  for insert to authenticated
  with check (owner = auth.uid() and private.est_membre(auth.uid()));
```

- [ ] **Step 8 : Lancer les deux tests SQL et les voir passer**

Run : `node tests/comptes-invites-schema.test.js && python -m unittest tests/test_schema_sql.py`
Attendu : `comptes-invites-schema.test.js : OK` puis `OK`.

- [ ] **Step 9 : Lancer les autres tests de schéma, qui lisent le même fichier**

Run : `node tests/roster-schema.test.js && node tests/collection-schema.test.js && node tests/availability-schema.test.js && node tests/boss-reports-schema.test.js && node tests/animation-measures-schema.test.js && node tests/presets-schema.test.js`
Attendu : six `: OK`. Si l'un échoue sur une assertion `using (true)`, c'est qu'il gravait l'ancienne règle : mettre à jour SON assertion, et écrire dans son commentaire pourquoi la règle a changé.

- [ ] **Step 10 : Commit**

```bash
git add supabase/schema.sql tests/comptes-invites-schema.test.js
git commit -m "feat(invites): cloisonner les dix tables de la confrerie"
```

---

### Task 3 : Les portes dérobées — RPC du boss et RPC de promotion

Les fonctions `security definer` traversent la RLS : les politiques de la Task 2 ne les arrêtent pas. Un invité pourrait rejoindre un run par appel direct. Cette tâche ferme ce chemin, et ouvre le seul qui doit l'être : la promotion par un admin.

**Files:**
- Modify: `supabase/schema.sql` (5 fonctions boss + nouvelle section 13 en fin de fichier)
- Modify: `tests/comptes-invites-schema.test.js`

**Interfaces:**
- Consomme : `private.est_membre(uuid)`, `private.est_admin(uuid)` (Task 1).
- Produit : `public.definir_membre(p_uid uuid, p_membre boolean) returns void`, exécutable par `authenticated`. Erreurs levées : `AUTH_REQUIRED`, `ADMIN_REQUIS`, `PARAMETRES_INVALIDES`, `AUTO_RETRAIT_REFUSE`, `PROFIL_INTROUVABLE`.

- [ ] **Step 1 : Étendre le test avec les gardes et la RPC**

Ajouter dans `tests/comptes-invites-schema.test.js`, avant la ligne `console.log` finale :

```js
/* ---- Les RPC du boss : la porte dérobée du chantier. ----

   Elles sont `security definer` : les politiques de table ne les arrêtent pas.
   Un contrôle posé uniquement sur les tables laisserait un invité rejoindre un
   run par appel direct au client Supabase. */

const RPC_BOSS = [
  "join_boss_run",
  "leave_boss_run",
  "select_boss_team",
  "complete_boss_run_with_report",
  "update_boss_run_report"
];

RPC_BOSS.forEach(nom => {
  const bloc = sql.match(
    new RegExp(
      "create or replace function public\\." + nom + "\\([\\s\\S]*?\\n\\$\\$;",
      "i"
    )
  );
  assert.ok(bloc, "public." + nom + " doit exister");
  assert.match(
    bloc[0],
    /if not private\.est_membre\(v_owner\) then\s*raise exception 'MEMBRE_REQUIS'/i,
    "public." + nom + " doit refuser un invité : elle contourne la RLS"
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
```

- [ ] **Step 2 : Lancer le test et le voir échouer**

Run : `node tests/comptes-invites-schema.test.js`
Attendu : ÉCHEC sur `public.join_boss_run doit refuser un invité : elle contourne la RLS`.

- [ ] **Step 3 : Poser le garde dans les cinq fonctions du boss**

Dans `supabase/schema.sql`, les cinq fonctions `join_boss_run`, `leave_boss_run`, `select_boss_team`, `complete_boss_run_with_report` et `update_boss_run_report` contiennent chacune, en tête de leur `begin`, ce bloc **à l'identique** :

```sql
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
```

Dans **chacune de ces cinq fonctions**, insérer juste après ce bloc :

```sql
  -- Cette fonction est `security definer` : elle traverse la RLS. Sans ce
  -- garde, un invité rejoindrait un run par appel direct, quelles que soient
  -- les politiques posées sur les tables.
  if not private.est_membre(v_owner) then
    raise exception 'MEMBRE_REQUIS' using errcode = 'P0001';
  end if;
```

**Attention :** le même bloc `AUTH_REQUIRED` apparaît une sixième fois, dans `public.update_roster_build` (vers la ligne 385). **Ne pas y toucher** : cette fonction n'est pas `security definer`, la RLS s'y applique déjà, et c'est le roster personnel d'un invité — il y a droit.

`public.complete_boss_run` n'a pas de garde à recevoir non plus : son corps entier lève `REPORT_REQUIRED`.

- [ ] **Step 4 : Ajouter la RPC de promotion en fin de fichier**

Ajouter à la fin de `supabase/schema.sql` :

```sql

-- 13) Promouvoir un compte, et rien d'autre.
--
-- L'écran d'administration passe par ici et jamais par un `update` direct :
-- `profiles_update` reste limité à SA propre ligne, et le trigger
-- `verrouiller_drapeaux_de_profil` refuse de toute façon un drapeau posé à la
-- main depuis une session.
--
-- Le drapeau `admin` n'est PAS touché ici. Il se pose une fois, à la main,
-- dans l'éditeur SQL de Supabase — voir docs/comptes-invites.md.
create or replace function public.definir_membre(p_uid uuid, p_membre boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_acteur uuid := auth.uid();
begin
  if v_acteur is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if not private.est_admin(v_acteur) then
    raise exception 'ADMIN_REQUIS' using errcode = 'P0001';
  end if;
  if p_uid is null or p_membre is null then
    raise exception 'PARAMETRES_INVALIDES' using errcode = 'P0001';
  end if;
  -- Se retirer soi-même de la confrérie couperait le dernier responsable de
  -- tout ce qu'il administre, sans que personne puisse l'y remettre.
  if p_uid = v_acteur and not p_membre then
    raise exception 'AUTO_RETRAIT_REFUSE' using errcode = 'P0001';
  end if;
  update public.profiles set membre = p_membre where id = p_uid;
  if not found then
    raise exception 'PROFIL_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.definir_membre(uuid, boolean) from public;
grant execute on function public.definir_membre(uuid, boolean) to authenticated;
```

- [ ] **Step 5 : Lancer les deux tests SQL et les voir passer**

Run : `node tests/comptes-invites-schema.test.js && python -m unittest tests/test_schema_sql.py`
Attendu : `comptes-invites-schema.test.js : OK` puis `OK`.

- [ ] **Step 6 : Commit**

```bash
git add supabase/schema.sql tests/comptes-invites-schema.test.js
git commit -m "feat(invites): fermer les RPC du boss et ouvrir la promotion"
```

---

### Task 4 : L'invité, côté site — session et navigation

Le SQL refuse déjà tout à un invité. Cette tâche évite qu'il se cogne à six écrans vides : la barre d'onglets se réduit, exactement comme elle le fait déjà pour un visiteur sans compte.

**Files:**
- Modify: `js/etat/session.js`
- Modify: `js/vues/session-auth.js`
- Modify: `js/vues/navigation.js`
- Modify: `js/vues/routage.js`
- Modify: `tests/helpers/load-app.js` (bloc `HOOK_EXPORT`)
- Modify: `tests/helpers/faux-supabase.js`
- Create: `tests/comptes-invites.test.js`
- Create: `tests/comptes-invites.playwright.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consomme : les colonnes `membre` / `admin` de `public.profiles` (Task 1), la RLS de la Task 2.
- Produit :
  - `sessionCourante.membre` (booléen, vaut `true` par défaut) et `sessionCourante.admin` (booléen, `false` par défaut), dans `js/etat/session.js` ;
  - `inviteHorsConfrerie() : boolean` et `estAdministrateur() : boolean`, exportés par `js/etat/session.js` ;
  - `vueAutorisee(nom)` accepte désormais la vue `"admin"`, réservée aux administrateurs (l'écran arrive en Task 5).

- [ ] **Step 1 : Écrire le test unitaire qui échoue**

Créer `tests/comptes-invites.test.js` :

```js
"use strict";

/* La table de vérité du portier. Quatre situations, et une seule règle par
   ligne — c'est le genre de fonction où une condition inversée ne se voit
   qu'en production, chez la personne qu'elle enferme dehors. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  vueAutorisee, inviteHorsConfrerie, estAdministrateur, sessionCourante
} = hooks;

assert.equal(typeof vueAutorisee, "function", "le portier doit être exposé");
assert.equal(typeof inviteHorsConfrerie, "function");
assert.equal(typeof estAdministrateur, "function");
assert.equal(typeof sessionCourante, "object");

function poser(etat){
  sessionCourante.applicationEpoch = etat.epoch;
  sessionCourante.user = etat.user;
  sessionCourante.membre = etat.membre;
  sessionCourante.admin = etat.admin;
}

const PUBLIQUES = ["builder", "wiki", "collection", "calculateur"];
const CONFRERIE = ["dashboard", "roster", "analyse", "availability", "boss"];

/* ---- Hors ligne : aucune session appliquée, donc aucune porte fermée. ----

   C'est le contre-exemple qui compte. Sans Supabase — PWA sans réseau, script
   CDN absent — `applySession` n'est jamais appelée et tout retombe sur
   localStorage. Y fermer des portes enfermerait le membre hors de ses propres
   équipes, sans aucune fenêtre de connexion à lui proposer. */
poser({ epoch:0, user:null, membre:true, admin:false });
assert.equal(inviteHorsConfrerie(), false,
  "avant toute session, personne n'est un invité");
CONFRERIE.concat(PUBLIQUES).forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "hors ligne, « " + vue + " » doit rester ouverte"));

/* ---- Visiteur sans compte : le comportement d'avant, inchangé. ---- */
poser({ epoch:1, user:null, membre:true, admin:false });
assert.equal(inviteHorsConfrerie(), false,
  "un visiteur sans compte n'est pas un invité : c'est autre chose");
PUBLIQUES.forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "« " + vue + " » tient debout sans compte"));
CONFRERIE.concat(["member-roster"]).forEach(vue =>
  assert.equal(vueAutorisee(vue), false,
    "sans compte, « " + vue + " » n'a rien à montrer"));

/* ---- Invité : un compte, un roster, et rien de la confrérie. ---- */
poser({ epoch:1, user:{ id:"user-3" }, membre:false, admin:false });
assert.equal(inviteHorsConfrerie(), true);
assert.equal(estAdministrateur(), false);
PUBLIQUES.concat(["member-roster"]).forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "un invité garde « " + vue + " » : c'est la raison de son compte"));
CONFRERIE.forEach(vue =>
  assert.equal(vueAutorisee(vue), false,
    "la RLS rendrait « " + vue + " » vide : mieux vaut ne pas l'ouvrir"));
assert.equal(vueAutorisee("admin"), false,
  "l'écran d'administration n'existe pas pour un invité");

/* ---- Membre : tout, sauf l'administration. ---- */
poser({ epoch:1, user:{ id:"user-1" }, membre:true, admin:false });
assert.equal(inviteHorsConfrerie(), false);
assert.equal(estAdministrateur(), false);
PUBLIQUES.concat(CONFRERIE, ["member-roster"]).forEach(vue =>
  assert.equal(vueAutorisee(vue), true,
    "un membre garde « " + vue + " »"));
assert.equal(vueAutorisee("admin"), false,
  "être membre ne suffit pas à administrer");

/* ---- Admin : l'écran en plus, et rien d'autre en plus. ---- */
poser({ epoch:1, user:{ id:"user-1" }, membre:true, admin:true });
assert.equal(estAdministrateur(), true);
assert.equal(vueAutorisee("admin"), true);

/* Un admin déconnecté n'est plus un admin : le drapeau seul ne suffit pas. */
poser({ epoch:1, user:null, membre:true, admin:true });
assert.equal(estAdministrateur(), false,
  "sans compte ouvert, le drapeau ne veut plus rien dire");

console.log("comptes-invites.test.js : OK");
```

- [ ] **Step 2 : Lancer le test et le voir échouer**

Run : `node tests/comptes-invites.test.js`
Attendu : ÉCHEC sur `le portier doit être exposé` (`vueAutorisee` vaut `undefined`).

- [ ] **Step 3 : Porter les drapeaux dans l'état de session**

Dans `js/etat/session.js`, remplacer :

```js
  const sessionCourante = {
    user: null,
    pseudo: "",
    applicationEpoch: 0,
    rosterProfiles: []
  };
```

par :

```js
  /* `membre` part à VRAI, et ce n'est pas une étourderie.

     Hors ligne, ou avant la première lecture de profil, personne n'a de
     drapeau. Traiter ce vide comme « pas membre » enfermerait la confrérie
     entière dehors dès que Supabase répond mal. La RLS reste le vrai portier :
     un onglet ouvert sur des données vides se répare d'un rechargement, un
     membre exilé de son propre roster, non. */
  const sessionCourante = {
    user: null,
    pseudo: "",
    membre: true,
    admin: false,
    applicationEpoch: 0,
    rosterProfiles: []
  };
```

Puis, juste avant la ligne `export {`, ajouter :

```js
  /* L'invite : quelqu'un dont on SAIT qu'il a un compte SANS appartenir a la
     confrerie. Meme prudence que `visiteurAnonyme` — tant que la session n'a
     pas ete appliquee, la reponse est « non ». */
  function inviteHorsConfrerie(){
    return sessionCourante.applicationEpoch > 0
      && !!sessionCourante.user
      && !sessionCourante.membre;
  }

  /* Le drapeau seul ne suffit pas : il survit en memoire a une deconnexion
     tant que `applySession` n'a pas fini son travail. */
  function estAdministrateur(){
    return !!sessionCourante.user && !!sessionCourante.admin;
  }
```

Et remplacer la ligne d'export :

```js
export { canManageTeam, sessionCourante, visiteurAnonyme };
```

par :

```js
export {
  canManageTeam,
  estAdministrateur,
  inviteHorsConfrerie,
  sessionCourante,
  visiteurAnonyme
};
```

- [ ] **Step 4 : Lire les drapeaux à l'ouverture de session**

Dans `js/vues/session-auth.js`, remplacer la fonction `profilePseudo` :

```js
  async function profilePseudo(user){
    if(!user || !sb) return "";
    const { data, error } = await sb.from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .maybeSingle();
    if(error) throw error;
    return data && typeof data.pseudo === "string" ? data.pseudo.trim() : "";
  }
```

par :

```js
  /* Le pseudo ET les deux drapeaux, en une seule lecture : ils arrivent de la
     meme ligne, et deux allers-retours ouvriraient une fenetre pendant
     laquelle la barre d'onglets ne saurait pas encore qui elle sert. */
  async function profilDuCompte(user){
    if(!user || !sb) return null;
    const { data, error } = await sb.from("profiles")
      .select("pseudo,membre,admin")
      .eq("id", user.id)
      .maybeSingle();
    if(error) throw error;
    return data || null;
  }
```

Puis, dans `applySession`, remplacer :

```js
    sessionCourante.pseudo = "";
    sessionCourante.rosterProfiles = [];
    if(sessionCourante.user){
      let loadedPseudo = "";
      try{
        loadedPseudo = await profilePseudo(expectedUser);
      }catch(error){
        if(!isCurrentApplication()) return;
        toast("Profil indisponible : "+authMessage(error), true);
      }
      if(!isCurrentApplication()) return;
      sessionCourante.pseudo = loadedPseudo;
      if(!sessionCourante.pseudo) sessionCourante.pseudo = (sessionCourante.user.email||"membre").split("@")[0];
      closeAuth();
    }else if(sb){
```

par :

```js
    sessionCourante.pseudo = "";
    sessionCourante.membre = true;
    sessionCourante.admin = false;
    sessionCourante.rosterProfiles = [];
    if(sessionCourante.user){
      let profil = null;
      try{
        profil = await profilDuCompte(expectedUser);
      }catch(error){
        if(!isCurrentApplication()) return;
        toast("Profil indisponible : "+authMessage(error), true);
      }
      if(!isCurrentApplication()) return;
      sessionCourante.pseudo = profil && typeof profil.pseudo === "string"
        ? profil.pseudo.trim() : "";
      /* Une lecture en echec laisse `membre` a vrai : voir etat/session.js.
         La RLS reste le portier, elle ne depend pas de cette ligne. */
      if(profil){
        sessionCourante.membre = profil.membre !== false;
        sessionCourante.admin = profil.admin === true;
      }
      if(!sessionCourante.pseudo) sessionCourante.pseudo = (sessionCourante.user.email||"membre").split("@")[0];
      closeAuth();
    }else if(sb){
```

- [ ] **Step 5 : Étendre le portier**

Dans `js/vues/navigation.js`, remplacer l'import :

```js
import { visiteurAnonyme } from "../etat/session.js";
```

par :

```js
import {
  estAdministrateur, inviteHorsConfrerie, visiteurAnonyme
} from "../etat/session.js";
```

Puis remplacer :

```js
  function vueAutorisee(nom){
    return vuePublique(nom) || !visiteurAnonyme();
  }
```

par :

```js
  /* Les vues qui montrent la CONFRERIE : elles lisent les donnees de tout le
     monde, et la RLS les rend vides pour un invite. Un onglet qui n'affiche
     rien se lit comme une panne — il vaut mieux ne pas l'ouvrir du tout.

     `member-roster` n'y figure pas : c'est SON roster, la raison meme de son
     compte. `builder`, `wiki`, `collection` et `calculateur` non plus : ils
     tiennent debout sans aucun compte. */
  const VUES_DE_CONFRERIE = new Set([
    "dashboard", "roster", "analyse", "availability", "boss"
  ]);
  const VUE_ADMIN = "admin";

  function vueAutorisee(nom){
    if(vuePublique(nom)) return true;
    if(visiteurAnonyme()) return false;
    if(nom === VUE_ADMIN) return estAdministrateur();
    return !(VUES_DE_CONFRERIE.has(nom) && inviteHorsConfrerie());
  }

  /* Le repli depend de qui frappe a la porte. Le Wiki accueille le visiteur
     sans compte ; l'invite, lui, a un roster — l'y renvoyer vaut mieux que de
     le poser sur une page de consultation. */
  function vueDeRepli(){
    return inviteHorsConfrerie() ? "member-roster" : VUE_DE_REPLI;
  }
```

Enfin, dans le même fichier, remplacer les **deux** usages de `VUE_DE_REPLI` qui restent — dans `appliquerVisibiliteOnglets` et dans `showView` — par `vueDeRepli()` :

```js
      void showView(vueDeRepli(), { historyMode:settings.historyMode });
```

```js
      return showView(vueDeRepli(), {
        historyMode:settings.historyMode === "none" ? "none" : "replace"
      });
```

- [ ] **Step 6 : Ne pas proposer une fenêtre de connexion à qui est déjà connecté**

Dans `js/vues/routage.js`, `ouvrirRoute` confond aujourd'hui deux refus : « il faut un compte » et « cette vue n'est pas pour toi ». Un invité qui atteint `#analyse` recevrait la fenêtre de connexion alors qu'il a déjà un compte.

Remplacer :

```js
  if(attendConnexion || !vueAutorisee(route.view)){
    routeEnAttente = route;
    await showView("wiki", { historyMode:"none" });
    openAuth();
    return true;
  }
```

par :

```js
  if(attendConnexion){
    routeEnAttente = route;
    await showView("wiki", { historyMode:"none" });
    openAuth();
    return true;
  }
  /* Vue hors de portee, mais le compte est deja ouvert : un invite n'a rien a
     faire d'une fenetre de connexion, il en a une. Le repli est confie a
     `showView`, seul juge de la vue d'accueil de chacun — le Wiki pour un
     visiteur, son roster pour un invite. */
  if(!vueAutorisee(route.view)){
    routeEnAttente = null;
    await showView(route.view, { historyMode:"none" });
    return true;
  }
```

- [ ] **Step 7 : Exposer les trois symboles au chargeur `vm`**

Dans `tests/helpers/load-app.js`, à l'intérieur du littéral `HOOK_EXPORT`, ajouter avant l'accolade fermante :

```js
  vueAutorisee:typeof vueAutorisee === "function" ? vueAutorisee : undefined,
  inviteHorsConfrerie:typeof inviteHorsConfrerie === "function"
    ? inviteHorsConfrerie
    : undefined,
  estAdministrateur:typeof estAdministrateur === "function"
    ? estAdministrateur
    : undefined,
  sessionCourante:typeof sessionCourante === "object"
    ? sessionCourante
    : undefined,
```

- [ ] **Step 8 : Lancer le test unitaire et le voir passer**

Run : `node tests/comptes-invites.test.js`
Attendu : `comptes-invites.test.js : OK`

- [ ] **Step 9 : Apprendre la notion de membre au faux Supabase**

Dans `tests/helpers/faux-supabase.js` :

**a.** Remplacer le tableau `state.profiles` :

```js
      profiles:[
        { id:"user-1", pseudo:"Yannis" },
        { id:"user-2", pseudo:"Merlin" }
      ],
```

par :

```js
      /* `user-1` n'est PAS admin par defaut : la barre d'onglets qu'il voit
         est celle que verifient les tests deja en place. Le parcours
         d'administration se donne le drapeau lui-meme, avant de se connecter. */
      profiles:[
        { id:"user-1", pseudo:"Yannis", membre:true,  admin:false },
        { id:"user-2", pseudo:"Merlin", membre:true,  admin:false },
        { id:"user-3", pseudo:"Invité", membre:false, admin:false }
      ],
      /* L'email choisit le compte. Sans mapping, tous les parcours se
         connectaient en `user-1` et aucun ne pouvait jouer un invite. */
      comptesParEmail:{ "invite@example.test":"user-3" },
```

**b.** Dans `bossAcl`, ajouter après `rpcOnlyWriteTables` :

```js
      /* Les tables de la confrerie : un invite n'y lit ni n'y ecrit rien,
         pas meme ses propres lignes. */
      membreOnlyTables:new Set([
        "recensement",
        "member_availability",
        "boss_sessions",
        "boss_participation",
        "boss_run_reports",
        "animation_measures"
      ]),
      /* Les tables possedees : un invite n'y voit que les siennes. */
      partageEntreMembres:new Set([
        "profiles",
        "teams",
        "roster_characters",
        "collection_items"
      ]),
      estMembreCourant(){
        const id = this.owner();
        if(!id) return false;
        const profil = state.profiles.find(item => item.id === id);
        return !!profil && profil.membre === true;
      },
```

**c.** Dans `execute()`, juste après le bloc `if(bossAcl.requiresRpc(table, operation)) return rpcRequired();`, ajouter :

```js
        /* Le faux applique les memes refus que la RLS reelle : un harnais plus
           permissif que la production laisserait passer exactement les fautes
           qu'on cherche. */
        if(bossAcl.membreOnlyTables.has(table) && !bossAcl.estMembreCourant()){
          return operation === "select"
            ? { data:[], error:null }
            : { data:null, error:{ message:"MEMBRE_REQUIS" } };
        }
```

**d.** Dans la branche `if(operation === "select")`, remplacer :

```js
          const selected = bossAcl.canRead(table)
            ? clone(rows.filter(matchRow))
            : [];
```

par :

```js
          let selected = bossAcl.canRead(table)
            ? clone(rows.filter(matchRow))
            : [];
          if(bossAcl.partageEntreMembres.has(table)
            && !bossAcl.estMembreCourant()){
            const moi = bossAcl.owner();
            selected = selected.filter(row =>
              (table === "profiles" ? row.id : row.owner) === moi);
          }
```

**e.** Dans `rpc(name, args)`, juste après `if(!owner) return fail("AUTH_REQUIRED");`, ajouter :

```js
      if(name === "definir_membre"){
        const acteur = state.profiles.find(item => item.id === owner);
        if(!acteur || acteur.admin !== true) return fail("ADMIN_REQUIS");
        if(args.p_uid === owner && !args.p_membre){
          return fail("AUTO_RETRAIT_REFUSE");
        }
        const cible = state.profiles.find(item => item.id === args.p_uid);
        if(!cible) return fail("PROFIL_INTROUVABLE");
        cible.membre = !!args.p_membre;
        return { data:null, error:null };
      }
      /* Les RPC du boss traversent la RLS en production : leur garde membre
         vit dans la fonction SQL, et doit donc vivre ici aussi. */
      if(!bossAcl.estMembreCourant()) return fail("MEMBRE_REQUIS");
```

**f.** Remplacer les deux méthodes d'authentification :

```js
        async signInWithPassword({ email }){
          state.session = { user:{ id:"user-1", email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
        async signUp({ email }){
          state.session = { user:{ id:"user-1", email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
```

par :

```js
        async signInWithPassword({ email }){
          const id = state.comptesParEmail[email] || "user-1";
          state.session = { user:{ id, email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
        async signUp({ email }){
          const id = state.comptesParEmail[email] || "user-1";
          state.session = { user:{ id, email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
```

- [ ] **Step 10 : Écrire le parcours navigateur de l'invité**

Créer `tests/comptes-invites.playwright.js` :

```js
"use strict";

/* Ce qu'un invité voit, et ce qu'il ne voit pas.

   Ce parcours ne prouve pas la sécurité — elle vit dans la RLS, et
   `tests/comptes-invites-schema.test.js` la lit. Il prouve autre chose, que
   seul un navigateur peut montrer : qu'un invité ne se cogne pas à six écrans
   vides avant de comprendre qu'ils ne sont pas pour lui.

   Le parcours d'administration le rejoindra en Task 5. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

const ONGLETS_INVITE = [
  "builder", "member-roster", "wiki", "collection", "calculateur"
];
const ONGLETS_MEMBRE = [
  "dashboard", "builder", "roster", "member-roster",
  "analyse", "wiki", "collection", "calculateur"
];

/* `getClientRects()` et non l'attribut `hidden` : on veut savoir ce que l'oeil
   voit, pas ce que le code a ecrit. */
const ongletsVisibles = page => page.evaluate(() =>
  [...document.querySelectorAll(".tabs .tab[data-view]")]
    .filter(onglet => onglet.getClientRects().length > 0)
    .map(onglet => onglet.dataset.view)
);

const vueActive = page => page.evaluate(() => {
  const vue = document.querySelector(".view.active");
  return vue ? vue.id.replace(/^view-/, "") : null;
});

async function connecter(page, email){
  await page.locator("#accountLogin").click();
  await page.locator("#authEmail").fill(email);
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
}

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html");
    await page.locator("#authOverlay").waitFor({ state:"visible" });

    /* ---- L'invité : son roster, et rien de la confrérie. ---- */
    await connecter(page, "invite@example.test");
    await page.locator("#accountPseudo")
      .getByText("Invité", { exact:true }).waitFor();

    assert.deepEqual(await ongletsVisibles(page), ONGLETS_INVITE,
      "un invité garde son roster et les pages publiques, rien d'autre");
    assert.equal(await vueActive(page), "member-roster",
      "la connexion doit le poser sur son roster, pas sur un Wiki");

    /* LA ROUTE, et pas seulement l'onglet : un onglet masqué ne protège que la
       souris.

       On passe par un lien interne — `a[data-app-route]`, le seul chemin que
       `js/vues/routage.js` écoute — et non par une écriture de
       `location.hash`, que rien n'observe : la page ne bougerait pas et le
       test passerait sans rien prouver.

       On part du Wiki pour que le repli soit une TRANSITION observable. Rester
       sur le roster prouverait la même chose que ne rien faire. */
    await page.locator('.tabs .tab[data-view="wiki"]').click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    await page.evaluate(() => {
      const lien = document.createElement("a");
      lien.id = "lienTestAnalyse";
      lien.href = "#analyse";
      lien.setAttribute("data-app-route", "");
      lien.textContent = "Analyse";
      document.body.appendChild(lien);
    });
    await page.locator("#lienTestAnalyse").click();
    await page.locator("#view-member-roster").waitFor({ state:"visible" });
    assert.equal(await vueActive(page), "member-roster",
      "l'Analyse ne doit pas s'ouvrir, et le repli mène au roster de l'invité");
    assert.equal(
      await page.locator("#authOverlay").evaluate(noeud => noeud.hidden),
      true,
      "un invité connecté n'a rien à faire d'une fenêtre de connexion"
    );
    await page.evaluate(() => {
      const lien = document.querySelector("#lienTestAnalyse");
      if(lien) lien.remove();
    });

    /* ---- Le membre : la barre entière revient. ---- */
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });
    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();

    assert.deepEqual(await ongletsVisibles(page), ONGLETS_MEMBRE,
      "un membre retrouve la barre entière");
    assert.equal(await vueActive(page), "dashboard",
      "un membre atterrit sur le suivi, comme avant");

    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("comptes-invites.playwright.js OK");
  }finally{
    await browser.close();
    await server.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 11 : Inscrire les deux tests dans le lanceur**

Dans `scripts/lancer-tests.js` :
- dans la liste `unit`, ajouter après `"node tests/comptes-invites-schema.test.js",` :

```js
    "node tests/comptes-invites.test.js",
```

- dans la liste `e2e`, ajouter après `"node tests/visiteur-anonyme.playwright.js",` :

```js
    "node tests/comptes-invites.playwright.js",
```

- [ ] **Step 12 : Lancer le parcours et le voir passer**

Run : `node tests/comptes-invites.playwright.js`
Attendu : `comptes-invites.playwright.js OK`

- [ ] **Step 13 : Lancer la suite entière**

Run : `npm test`
Attendu : tout au vert. Les parcours qui touchent aux dispos, au recensement et aux sessions passent par le nouveau contrôle du faux Supabase : s'ils échouent, c'est que leur compte n'a pas `membre:true` dans `state.profiles` — le vérifier avant de toucher au code de production.

- [ ] **Step 14 : Commit**

```bash
git add js/etat/session.js js/vues/session-auth.js js/vues/navigation.js js/vues/routage.js tests/helpers/load-app.js tests/helpers/faux-supabase.js tests/comptes-invites.test.js tests/comptes-invites.playwright.js scripts/lancer-tests.js
git commit -m "feat(invites): reduire la barre d'onglets d'un compte invite"
```

---

### Task 5 : L'écran d'administration

Une liste de comptes et un interrupteur. Rien d'autre : pas de suppression de compte, pas de rôles fins, pas de retrait du drapeau `admin`.

**Files:**
- Create: `js/donnees/administration-store.js`
- Create: `js/vues/administration.js`
- Modify: `index.html` (onglet, panneau « Plus », section de vue)
- Modify: `css/roster.css`
- Modify: `js/metier/routage.js`
- Modify: `js/vues/navigation.js` (`VUES_DANS_PLUS`)
- Modify: `js/app.js`
- Modify: `tests/helpers/modules.js`
- Modify: `sw.js`
- Modify: `tests/routage.test.js`
- Modify: `tests/comptes-invites.playwright.js`

**Interfaces:**
- Consomme : `public.definir_membre(uuid, boolean)` (Task 3), `sessionCourante` et `estAdministrateur()` (Task 4), `vueAutorisee("admin")` (Task 4).
- Produit :
  - `AdministrationStore.comptes() : Promise<Array<{id:string, pseudo:string, membre:boolean, admin:boolean}>>` et `AdministrationStore.definirMembre(id:string, membre:boolean) : Promise<void>`, exportés par `js/donnees/administration-store.js` ;
  - `renderAdministration() : Promise<true>`, exporté par `js/vues/administration.js` et enregistré sous le nom de vue `"admin"`.

- [ ] **Step 1 : Étendre le parcours navigateur avec la promotion**

Dans `tests/comptes-invites.playwright.js`, insérer juste avant le bloc `assert.deepEqual(errors, [], ...)` :

```js
    /* ---- L'admin accueille l'invité, et la barre de l'invité s'élargit. ---- */
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });
    await page.evaluate(() => {
      window.__fakeSupabaseState.profiles[0].admin = true;
    });
    await connecter(page, "yannis@example.test");
    await page.locator("#accountPseudo")
      .getByText("Yannis", { exact:true }).waitFor();

    const ongletAdmin = page.locator('.tabs .tab[data-view="admin"]');
    await ongletAdmin.waitFor({ state:"visible" });
    await ongletAdmin.click();
    await page.locator("#view-admin").waitFor({ state:"visible" });

    const ligneInvite = page.locator("#adminBody tr")
      .filter({ hasText:"Invité" });
    await ligneInvite.getByRole("button",
      { name:"Accueillir dans la confrérie", exact:true }).click();
    await ligneInvite.getByRole("button",
      { name:"Retirer de la confrérie", exact:true }).waitFor();

    /* Un admin ne peut pas se retirer lui-même : le bouton refuse le geste
       avant que le SQL n'ait à le refuser. */
    const ligneAdmin = page.locator("#adminBody tr")
      .filter({ hasText:"Yannis" });
    assert.equal(
      await ligneAdmin.getByRole("button",
        { name:"Retirer de la confrérie", exact:true }).isDisabled(),
      true,
      "un admin ne doit pas pouvoir se retirer lui-même"
    );

    /* Et la promotion se voit : l'ancien invité retrouve la barre entière. */
    await page.getByRole("button", { name:"Déconnexion", exact:true }).click();
    await page.locator("#accountLogin").waitFor({ state:"visible" });
    await connecter(page, "invite@example.test");
    await page.locator("#accountPseudo")
      .getByText("Invité", { exact:true }).waitFor();
    assert.deepEqual(await ongletsVisibles(page), ONGLETS_MEMBRE,
      "accueilli dans la confrérie, l'invité voit ce qu'un membre voit");
```

- [ ] **Step 2 : Lancer le parcours et le voir échouer**

Run : `node tests/comptes-invites.playwright.js`
Attendu : ÉCHEC sur un délai dépassé en attendant `.tabs .tab[data-view="admin"]` — l'onglet n'existe pas.

- [ ] **Step 3 : Créer le magasin**

Créer `js/donnees/administration-store.js` :

```js
/* Les comptes du site, et le seul droit qu'on leur accorde ou leur retire.

   Le magasin ne connait pas le DOM, l'ecran ne connait pas Supabase : c'est ce
   qui permet de lire la regle sans navigateur et l'affichage sans reseau.

   ⚠️ Les noms de premier niveau sont uniques dans tout js/ — le chargeur `vm`
   des tests concatene les modules dans une portee commune. */

import { sb } from "../noyau/supabase-client.js";

  const AdministrationStore = {
    /* Tous les profils, invites compris. Un admin est membre : la politique
       « a moi ou membre » lui rend donc la table entiere. */
    async comptes(){
      if(!sb) return [];
      const { data, error } = await sb.from("profiles")
        .select("id,pseudo,membre,admin")
        .order("pseudo", { ascending:true });
      if(error) throw error;
      return (data || [])
        .filter(item => item && item.id)
        .map(item => ({
          id:item.id,
          pseudo:item.pseudo || "Membre",
          membre:item.membre === true,
          admin:item.admin === true
        }));
    },
    /* Par la RPC et jamais par un `update` direct : le droit d'ecrire sur la
       ligne d'autrui n'existe pas, et c'est voulu. Un trigger refuse de toute
       facon un drapeau pose a la main depuis une session. */
    async definirMembre(id, membre){
      if(!sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("definir_membre", {
        p_uid:id,
        p_membre:!!membre
      });
      if(error) throw error;
    }
  };

export { AdministrationStore };
```

- [ ] **Step 4 : Créer l'écran**

Créer `js/vues/administration.js` :

```js
/* L'ecran d'administration : la liste des comptes, et un interrupteur.

   Il ne fait qu'une chose — ouvrir ou fermer la porte de la confrerie. Pas de
   suppression de compte, pas de roles fins, pas de retrait du drapeau `admin` :
   celui-la se pose une fois a la main dans Supabase, et le SQL refuse de le
   changer autrement.

   Cet ecran n'est PAS la securite. Un compte non-admin qui appellerait la RPC
   directement recevrait `ADMIN_REQUIS` : c'est la que vit la regle. Ici, on
   evite seulement de proposer des gestes qui echoueront.

   ⚠️ Noms de premier niveau uniques dans tout js/ — le chargeur `vm` des tests
   concatene les modules dans une portee commune. D'ou `ligneDeCompte` et
   `renderAdministration` plutot que `ligne` et `rendre`. */

import { $, el } from "../noyau/dom.js";
import { authMessage } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";
import { AdministrationStore } from "../donnees/administration-store.js";
import { toast } from "./toast.js";

  function ligneDeCompte(compte, redessiner){
    const moi = !!sessionCourante.user && compte.id === sessionCourante.user.id;
    const bouton = el("button", {
      class:"btn " + (compte.membre ? "btn-ghost" : "btn-primary"),
      type:"button",
      text:compte.membre
        ? "Retirer de la confrérie"
        : "Accueillir dans la confrérie"
    });
    /* Se retirer soi-meme couperait le dernier responsable de tout ce qu'il
       administre. Le SQL le refuse aussi : ici on ne propose simplement pas un
       geste dont on connait deja la reponse. */
    bouton.disabled = moi && compte.membre;
    bouton.addEventListener("click", async () => {
      bouton.disabled = true;
      try{
        await AdministrationStore.definirMembre(compte.id, !compte.membre);
        toast(compte.membre
          ? compte.pseudo + " n'est plus membre de la confrérie."
          : compte.pseudo + " rejoint la confrérie. Il doit recharger la page.");
        await redessiner();
      }catch(error){
        bouton.disabled = false;
        toast("Changement impossible : " + authMessage(error), true);
      }
    });
    return el("tr", null, [
      el("td", { text:compte.pseudo }),
      el("td", { text:compte.membre ? "Membre" : "Invité" }),
      el("td", { text:compte.admin ? "Oui" : "—" }),
      el("td", null, [bouton])
    ]);
  }

  async function renderAdministration(){
    const corps = $("#adminBody");
    if(!corps) return true;
    corps.textContent = "";
    let comptes;
    try{
      comptes = await AdministrationStore.comptes();
    }catch(error){
      corps.appendChild(el("p", {
        class:"admin-etat",
        text:"Comptes indisponibles : " + authMessage(error)
      }));
      return true;
    }
    if(!comptes.length){
      corps.appendChild(el("p", {
        class:"admin-etat",
        text:"Aucun compte."
      }));
      return true;
    }
    corps.appendChild(el("table", { class:"admin-table" }, [
      el("thead", null, [el("tr", null, [
        el("th", { text:"Pseudo" }),
        el("th", { text:"Accès" }),
        el("th", { text:"Admin" }),
        el("th", { text:"Action" })
      ])]),
      el("tbody", null,
        comptes.map(compte => ligneDeCompte(compte, renderAdministration)))
    ]));
    return true;
  }

export { renderAdministration };
```

- [ ] **Step 5 : Ajouter l'onglet, l'entrée mobile et la section**

Dans `index.html` :

**a.** Après le bouton `tab-calculateur`, dans `<nav class="tabs">` :

```html
    <!-- Masqué pour tout le monde sauf un administrateur : c'est
         `appliquerVisibiliteOnglets` qui le range, comme les six autres
         onglets réservés. -->
    <button class="tab" id="tab-admin" data-view="admin"
            role="tab" aria-controls="view-admin"
            aria-selected="false" tabindex="-1">Membres</button>
```

**b.** Après le lien `calculateur` dans `<div class="mobile-more-links">` :

```html
    <button class="mobile-more-link" type="button" data-mobile-view="admin">
      <span>Membres</span><span aria-hidden="true">›</span>
    </button>
```

**c.** Après la section `view-availability`, ajouter :

```html
  <!-- ============ MEMBRES ============ -->
  <section id="view-admin" class="view" role="tabpanel"
           aria-labelledby="tab-admin">
    <p class="section-eyebrow">Confrérie</p>
    <h1 class="section-title">Membres</h1>
    <p class="section-lead">Qui a accès aux données de la confrérie. Un compte fraîchement créé est invité : il ne voit que son propre roster tant qu'il n'est pas accueilli ici.</p>
    <div id="adminBody"></div>
  </section>
```

- [ ] **Step 6 : Habiller la table**

Ajouter à la fin de `css/roster.css` :

```css
/* L'écran « Membres ». Il vit dans cette feuille et non dans la sienne : une
   feuille de plus imposerait une entrée dans FEUILLES (tests/css-ordre.test.js)
   et dans CORE_ASSETS, pour trois règles. */
.admin-table{width:100%;border-collapse:collapse}
.admin-table th{
  font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);text-align:left;padding:8px 10px
}
.admin-table td{
  padding:8px 10px;border-bottom:1px solid var(--line-soft);
  vertical-align:middle
}
.admin-table tbody tr:last-child td{border-bottom:0}
.admin-etat{color:var(--muted)}
```

- [ ] **Step 7 : Rendre la vue routable et l'enregistrer**

Dans `js/metier/routage.js`, remplacer :

```js
const ROUTE_VIEWS = new Set([
  "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection", "calculateur"
]);
```

par :

```js
const ROUTE_VIEWS = new Set([
  "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection", "calculateur", "admin"
]);
```

Dans `js/vues/navigation.js`, remplacer :

```js
  const VUES_DANS_PLUS = new Set(["analyse", "wiki", "collection", "calculateur"]);
```

par :

```js
  const VUES_DANS_PLUS = new Set([
    "analyse", "wiki", "collection", "calculateur", "admin"
  ]);
```

Dans `js/app.js`, ajouter l'import après celui du calculateur :

```js
import { renderAdministration } from "./vues/administration.js";
```

et l'enregistrement après celui du calculateur :

```js
  enregistrerVue("admin", renderAdministration);
```

- [ ] **Step 8 : Inscrire les deux modules là où le dépôt les attend**

Dans `tests/helpers/modules.js` :
- couche `donnees`, après `"donnees/presets-store.js",` :

```js
  "donnees/administration-store.js",
```

- couche `vues`, après `"vues/suivi.js",` :

```js
  "vues/administration.js",
```

Dans `sw.js`, ajouter `"./js/donnees/administration-store.js"` à la suite de `"./js/donnees/presets-store.js"` et `"./js/vues/administration.js"` à la suite de `"./js/vues/suivi.js"`, dans `CORE_ASSETS`.

Dans `tests/routage.test.js`, ajouter `"admin"` à la fin du tableau `stableViews`.

- [ ] **Step 9 : Lancer le parcours et le voir passer**

Run : `node tests/comptes-invites.playwright.js`
Attendu : `comptes-invites.playwright.js OK`

- [ ] **Step 10 : Lancer la suite entière**

Run : `npm test`
Attendu : tout au vert. Trois tests méritent un regard particulier :
- `tests/modules-imports.test.js` — il refuse un module absent de `CORE_ASSETS` ou un export sans importateur ;
- `tests/routage.test.js` — la nouvelle route ;
- `tests/accessibilite-mobile.playwright.js` — le nouveau lien du panneau « Plus » doit atteindre 44 px de haut, ce que `.mobile-more-link` fait déjà.

- [ ] **Step 11 : Commit**

```bash
git add js/donnees/administration-store.js js/vues/administration.js index.html css/roster.css js/metier/routage.js js/vues/navigation.js js/app.js tests/helpers/modules.js sw.js tests/routage.test.js tests/comptes-invites.playwright.js
git commit -m "feat(invites): accueillir un compte depuis un ecran d'administration"
```

---

### Task 6 : Le mode d'emploi du propriétaire

Le SQL est versionné, mais rien ne l'applique. Sans ce document, la fonctionnalité est livrée et inerte — et pire, l'écran d'administration reste inaccessible sans un geste que personne n'a écrit nulle part.

**Files:**
- Create: `docs/comptes-invites.md`
- Modify: `tests/pages-workflow.test.js` (uniquement si ce test énumère les fichiers de `docs/` — le vérifier avant)

**Interfaces:**
- Consomme : tout ce qui précède.
- Produit : rien de programmatique.

- [ ] **Step 1 : Écrire le document**

Créer `docs/comptes-invites.md` :

```markdown
# Ouvrir un compte à quelqu'un hors de la confrérie

Le site distingue trois situations : le **visiteur** sans compte, l'**invité**
qui a un compte sans appartenir à la confrérie, et le **membre**. Un compte
fraîchement créé est un invité — il garde son propre roster, son OCR, ses
presets et ses équipes, et ne voit rien de la confrérie.

## Ce qu'un invité voit

| | Invité | Membre |
|---|---|---|
| Créer une équipe, Wiki, Collection, Calculateur | ✅ | ✅ |
| Son roster, son OCR, ses presets, ses équipes | ✅ | ✅ |
| Accueil, Analyse, Équipes de la confrérie | ❌ | ✅ |
| Dispos, Sessions de boss, Recensement | ❌ | ✅ |

Le cloisonnement vit dans les politiques RLS de Supabase, pas dans l'interface :
masquer un onglet est une politesse, refuser une lecture est la barrière.

## 1. Appliquer le schéma

Coller le contenu complet de `supabase/schema.sql` dans **Supabase → SQL
Editor → Run**. Le fichier est idempotent : il se rejoue sans dommage.

À ce collage, et à celui-là seulement, **tous les comptes déjà existants
deviennent membres**. C'est voulu : sans cette promotion, la confrérie entière
se retrouverait invitée chez elle. Les collages suivants ne repromeuvent
personne — le garde `if not exists` du bloc de migration s'en assure.

## 2. Se donner le drapeau d'administrateur — une seule fois

Cette étape ne peut pas vivre dans le schéma : y écrire un identifiant de
compte figerait une donnée d'installation dans un fichier versionné.

Relever son propre identifiant dans **Supabase → Authentication → Users**, puis
dans le SQL Editor :

```sql
update public.profiles set admin = true, membre = true
where id = '<uuid-du-proprietaire>';
```

**Tant que cette ligne n'est pas passée, personne ne peut promouvoir personne**
et l'onglet « Membres » n'apparaît nulle part. C'est la première chose à
vérifier après application.

Le drapeau `admin` ne se change **que** par ici : un trigger refuse toute
modification venue d'une session du site, y compris celle d'un administrateur.

## 3. Accueillir quelqu'un

La personne crée son compte depuis le site, comme n'importe qui. Elle est
invitée.

Ouvrir l'onglet **Membres**, trouver son pseudo, cliquer sur **Accueillir dans
la confrérie**. Elle doit **recharger la page** : les drapeaux sont lus à
l'ouverture de session, pas à chaque instant.

Le même écran permet de la retirer. Un administrateur ne peut pas se retirer
lui-même — ni depuis l'écran, ni par un appel direct : le SQL le refuse aussi.

## Vérifier que la cloison tient

Depuis un compte invité :

- l'onglet « Accueil » n'apparaît pas, et `#analyse` dans l'URL ne l'ouvre pas ;
- son roster s'affiche et s'enregistre normalement ;
- la page Collection ne propose que son propre pseudo dans la liste des membres.

## Ce qui reste hors périmètre

Confirmation d'email à l'inscription, invitation par code, rôles fins,
suppression de compte depuis l'écran, plusieurs confréries sur une instance.
```

- [ ] **Step 2 : Vérifier qu'aucun test n'énumère `docs/`**

Run : `node tests/pages-workflow.test.js`
Attendu : OK. Si ce test échoue en réclamant une entrée pour le nouveau fichier, l'ajouter à la liste qu'il énumère.

- [ ] **Step 3 : Lancer la suite entière une dernière fois**

Run : `npm test`
Attendu : tout au vert, unitaires et bout-en-bout.

- [ ] **Step 4 : Commit**

```bash
git add docs/comptes-invites.md
git commit -m "docs(invites): dire comment ouvrir un compte et se donner l'administration"
```

---

## Après le plan

Le code est livré, **le schéma n'est pas appliqué**. Rien ne change dans
Supabase tant que le propriétaire n'a pas collé `supabase/schema.sql` et posé
son propre drapeau `admin`. C'est `docs/comptes-invites.md` qui décrit ces deux
gestes, dans cet ordre.

Point de vigilance à signaler au propriétaire au moment de la livraison : entre
l'application du schéma et la pose du drapeau `admin`, **l'écran d'administration
n'est accessible à personne**. Les deux gestes se font à la suite.
