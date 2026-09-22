# Entraînement du boss de confrérie — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le sous-onglet « Entraînement » du groupe Boss, où les membres enregistrent, corrigent et comparent leurs runs d'entraînement du boss de confrérie.

**Architecture:** Une table Supabase `boss_training_runs` (une ligne par run), protégée par RLS et par un trigger qui fige les instantanés d'équipe côté serveur. Côté site : un module métier pur (`js/metier/entrainement-boss.js`), un store (`js/donnees/entrainement-store.js`), une modale de saisie et une vue à trois sous-vues locales, branchées sur la navigation, les routes et le Realtime existants.

**Tech Stack:** JavaScript ES modules sans build, PostgreSQL/Supabase (RLS, plpgsql, Realtime), tests Node `assert` + chargeur `vm`, Playwright avec `tests/helpers/faux-supabase.js`, `pglast` pour la syntaxe SQL.

**Spec:** `docs/superpowers/specs/2026-09-22-entrainement-boss-design.md` — la lire avant de commencer.

## Global Constraints

- Français partout dans l'interface et dans les messages de commit.
- Aucune dépendance ajoutée : ni bibliothèque de graphiques, ni paquet npm côté site.
- Les couches de `js/ARCHITECTURE.md` : `metier` sans DOM ni réseau ; `donnees` sans rendu ; un module n'importe jamais un module déclaré après lui dans `tests/helpers/modules.js`.
- Tout nouveau module est ajouté à **trois** endroits : `tests/helpers/modules.js`, `CORE_ASSETS` de `sw.js`, et l'`import` réel de son consommateur. `node tests/modules-imports.test.js` le vérifie ; il refuse aussi un `export` que personne n'importe.
- Les noms de premier niveau sont **uniques dans tout `js/`** (le chargeur `vm` concatène tout dans une portée). Préfixer par `Entrainement`/`entrainement` ou `training`.
- Scores : **chaînes de bout en bout**, comparés en `BigInt`, affichés par `formatBossScore` (`js/metier/boss-logique.js`). Lus avec `global_score::text`.
- Participants : 1 à 5, dont le membre qui saisit. Note ≤ 1000 caractères. Score entier > 0. Date jamais future (heure de Paris).
- Le jeton de concurrence `updated_at` est une **chaîne opaque**, jamais passée par `Date.parse()`.
- `index.html` et certains fichiers mélangent CRLF et LF : modifier avec l'outil Edit (ancre sur une seule ligne), jamais par `sed` multi-ligne ni heredoc Bash (il mange les antislashs).
- Cibles tactiles ≥ 44 px, aucun débordement horizontal entre 320 et 390 px, modales par `ModalStack`.
- Commits : terminer chaque message par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. **Ne jamais pousser** sans l'accord explicite du propriétaire.
- Mise en service : le propriétaire rejoue `supabase/schema.sql` **avant** tout push du frontend.

---

## Carte des fichiers

| Fichier | Rôle |
| --- | --- |
| `supabase/schema.sql` (modif.) | table, trigger `private.boss_training_runs_prepare`, RLS, Realtime |
| `tests/entrainement-schema.test.js` (nouveau) | contrat du SQL |
| `js/metier/entrainement-boss.js` (nouveau) | validation, clés de composition, tri, progression, top, comparaison, date de Paris |
| `tests/entrainement-boss.test.js` (nouveau) | tests unitaires du métier, module chargé isolément |
| `js/noyau/constantes.js` (modif.) | `CLOUD_TRAINING_CACHE_KEY` |
| `js/donnees/entrainement-store.js` (nouveau) | lecture, création, correction CAS, suppression, cache |
| `tests/helpers/faux-supabase.js` (modif.) | table simulée, RLS, trigger, `update().select()` |
| `js/metier/routage.js` + `tests/routage.test.js` (modif.) | route `#training` |
| `js/vues/navigation.js` (modif.) | `training` dans le groupe Boss et les vues de confrérie |
| `index.html` (modif.) | sous-onglet, bouton du dock mobile, section de vue, modale |
| `css/boss.css` (modif.) | styles de la vue et de la modale |
| `js/vues/modale-entrainement.js` (nouveau) | saisie / correction / suppression |
| `js/vues/boss-entrainement.js` (nouveau) | vue : historique, progression (SVG), classement + comparaison |
| `js/app.js` (modif.) | `enregistrerVue("training", …)` |
| `js/vues/synchro-temps-reel.js` (modif.) | écoute de `boss_training_runs` |
| `tests/entrainement.playwright.js` (nouveau) | parcours navigateur |
| `scripts/lancer-tests.js` (modif.) | enregistre les nouveaux tests |
| `tests/accessibilite-mobile.playwright.js`, `tests/navigation-mobile.playwright.js` (vérif.) | dock à 4 boutons |
| `AGENTS.md`, `js/ARCHITECTURE.md` (modif.) | documentation |

---

### Task 1: Schéma Supabase et son contrat

**Files:**
- Modify: `supabase/schema.sql` (nouveau bloc juste **avant** la ligne `-- ============================ Realtime ============================`, et une entrée dans le tableau `foreach realtime_table in array array[...]`)
- Create: `tests/entrainement-schema.test.js`
- Modify: `scripts/lancer-tests.js` (suite `unit`, après `"node tests/collection-schema.test.js",`)

**Interfaces:**
- Produces: table `public.boss_training_runs` (colonnes de la spec, section 1) ; erreurs `TRAINING_DUPLICATE_PARTICIPANT`, `TRAINING_FUTURE_DATE`, `TRAINING_TEAM_OUTSIDE_RUN`, `TRAINING_NOT_A_MEMBER`, `TRAINING_TEAM_NOT_OWNED` (errcode `P0001`). Chaque valeur de `equipes` a la forme `{ pseudo, teamId, snapshot }`, où `snapshot` suit **exactement** la forme de `boss_participation.team_snapshot` (`{id, owner, pseudo, data, createdAt, updatedAt, capturedAt}`) pour que `teamFromBossSnapshot()` la lise telle quelle.

- [ ] **Step 1: Écrire le test du contrat (il doit échouer)**

`tests/entrainement-schema.test.js` :

```js
"use strict";

/* Le schéma de l'entraînement du boss : table, trigger, politiques et
   publication Realtime, tels qu'ils sont commités. Aucun serveur : on lit le
   SQL que l'administrateur colle dans Supabase. La syntaxe, elle, est tenue
   par tests/test_schema_sql.py (pglast). */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"), "utf8"
);

[
  /create table if not exists public\.boss_training_runs/i,
  /global_score\s+bigint not null check \(global_score > 0\)/i,
  /check \(char_length\(note\) <= 1000\)/i,
  /cardinality\(participants\) between 1 and 5/i,
  /alter table public\.boss_training_runs enable row level security/i,
  /create policy training_read[\s\S]*?using \(private\.est_membre\(auth\.uid\(\)\)\)/i,
  /create policy training_insert[\s\S]*?with check \(\s*created_by = auth\.uid\(\)\s+and auth\.uid\(\) = any\(participants\)\s+and private\.est_membre\(auth\.uid\(\)\)\s*\)/i,
  /create policy training_update[\s\S]*?using \(\s*auth\.uid\(\) = any\(participants\)\s+and private\.est_membre\(auth\.uid\(\)\)\s*\)\s*with check \(\s*auth\.uid\(\) = any\(participants\)\s*\)/i,
  /create policy training_delete[\s\S]*?using \(\s*auth\.uid\(\) = any\(participants\)\s+and private\.est_membre\(auth\.uid\(\)\)\s*\)/i,
  /create or replace function private\.boss_training_runs_prepare\(\)/i,
  /create trigger boss_training_runs_prepare\s+before insert or update on public\.boss_training_runs/i
].forEach(motif => assert.match(sql, motif, String(motif)));

/* Le serveur fige les équipes : un instantané fourni par le client ne doit
   jamais être recopié tel quel. Le trigger le reconstruit depuis `teams`, et
   vérifie que l'équipe appartient au participant. */
const trigger = sql.slice(
  sql.search(/create or replace function private\.boss_training_runs_prepare/i)
);
assert.match(trigger, /from public\.teams t\s+where t\.id = v_team_id\s+and t\.owner = v_participant/i);
assert.match(trigger, /TRAINING_TEAM_NOT_OWNED/);
assert.match(trigger, /TRAINING_FUTURE_DATE/);
assert.match(trigger, /now\(\) at time zone 'Europe\/Paris'/i);
/* L'auteur ne se déclare pas : le trigger le pose, et le fige ensuite. */
assert.match(trigger, /new\.created_by := auth\.uid\(\)/i);
assert.match(trigger, /new\.created_by := old\.created_by/i);

/* Aucune politique ne doit laisser écrire hors des participants. */
const politiques = sql.match(/create policy training_\w+[\s\S]*?;/gi) || [];
assert.equal(politiques.length, 4, "exactement quatre politiques training_*");
politiques.filter(p => !/training_read/i.test(p))
  .forEach(p => assert.match(p, /auth\.uid\(\) = any\(participants\)/i, p));

assert.ok(
  /foreach realtime_table in array array\[[^\]]*'boss_training_runs'[^\]]*\]/i.test(sql),
  "boss_training_runs manque au tableau des tables publiées en Realtime"
);

console.log("PASS schema : boss_training_runs, trigger, politiques et Realtime");
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node tests/entrainement-schema.test.js`
Expected: FAIL (`AssertionError` sur `create table if not exists public.boss_training_runs`).

- [ ] **Step 3: Écrire le bloc SQL**

Insérer dans `supabase/schema.sql`, juste avant `-- ============================ Realtime ============================` :

```sql
-- =============================================================================
--  Entraînement du boss de confrérie (mode arrivé en 2.1).
--
--  Une ligne par run. Le score est celui du groupe : le jeu ne donne pas les
--  dégâts par membre. Aucun lien avec les runs de la semaine (quotas, groupes,
--  rapports) : c'est pourquoi la table est distincte de boss_sessions.
--
--  Le client n'envoie que l'identifiant d'équipe de chaque participant. Le
--  trigger reconstruit l'instantané depuis `teams`, vérifie que l'équipe
--  appartient bien au participant, puis le fige : une équipe modifiée ou
--  supprimée ensuite ne change jamais la run.
-- =============================================================================
create table if not exists public.boss_training_runs (
  id                uuid primary key default gen_random_uuid(),
  played_on         date not null,
  global_score      bigint not null check (global_score > 0),
  note              text not null default '' check (char_length(note) <= 1000),
  participants      uuid[] not null
                    check (cardinality(participants) between 1 and 5
                           and array_position(participants, null) is null),
  equipes           jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(equipes) = 'object'),
  created_by        uuid references auth.users(id) on delete set null,
  created_by_pseudo text not null default '',
  created_at        timestamptz not null default now(),
  updated_by_pseudo text,
  updated_at        timestamptz not null default now()
);
create index if not exists boss_training_runs_played_idx
  on public.boss_training_runs(played_on desc, created_at desc);

create or replace function private.boss_training_runs_prepare()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_participant uuid;
  v_entree      jsonb;
  v_ancienne    jsonb;
  v_team_id     uuid;
  v_snapshot    jsonb;
  v_pseudo      text;
  v_equipes     jsonb := '{}'::jsonb;
  v_auteur      text := coalesce(
    (select pseudo from public.profiles where id = auth.uid()), 'Membre');
begin
  if (select count(distinct p) from unnest(new.participants) as p)
     <> cardinality(new.participants) then
    raise exception 'TRAINING_DUPLICATE_PARTICIPANT' using errcode = 'P0001';
  end if;
  if new.played_on > (now() at time zone 'Europe/Paris')::date then
    raise exception 'TRAINING_FUTURE_DATE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from jsonb_object_keys(new.equipes) as k
     where not (k = any(array(select unnest(new.participants)::text)))
  ) then
    raise exception 'TRAINING_TEAM_OUTSIDE_RUN' using errcode = 'P0001';
  end if;

  foreach v_participant in array new.participants loop
    v_entree   := new.equipes -> v_participant::text;
    v_team_id  := nullif(coalesce(v_entree ->> 'teamId', ''), '')::uuid;
    v_ancienne := case when tg_op = 'UPDATE'
                       then old.equipes -> v_participant::text end;

    -- Un nouveau venu doit être membre ; un participant déjà présent garde
    -- sa place même si son compte a disparu depuis.
    if v_ancienne is null and not private.est_membre(v_participant) then
      raise exception 'TRAINING_NOT_A_MEMBER' using errcode = 'P0001';
    end if;

    if v_team_id is null then
      v_snapshot := null;
    elsif v_ancienne is not null
      and v_ancienne ->> 'teamId' = v_team_id::text then
      v_snapshot := v_ancienne -> 'snapshot';
    else
      select jsonb_build_object(
               'id', t.id,
               'owner', t.owner,
               'pseudo', t.pseudo,
               'data', t.data,
               'createdAt', t.created_at,
               'updatedAt', t.updated_at,
               'capturedAt', now()
             )
        into v_snapshot
        from public.teams t
       where t.id = v_team_id
         and t.owner = v_participant;
      if v_snapshot is null then
        raise exception 'TRAINING_TEAM_NOT_OWNED' using errcode = 'P0001';
      end if;
    end if;

    v_pseudo := coalesce(
      v_ancienne ->> 'pseudo',
      (select pseudo from public.profiles where id = v_participant),
      'Membre');
    v_equipes := v_equipes || jsonb_build_object(
      v_participant::text,
      jsonb_build_object('pseudo', v_pseudo,
                         'teamId', v_team_id,
                         'snapshot', v_snapshot));
  end loop;
  new.equipes := v_equipes;

  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_by_pseudo := v_auteur;
    new.created_at := now();
    new.updated_by_pseudo := null;
  else
    new.created_by := old.created_by;
    new.created_by_pseudo := old.created_by_pseudo;
    new.created_at := old.created_at;
    new.updated_by_pseudo := v_auteur;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.boss_training_runs_prepare() from public;

drop trigger if exists boss_training_runs_prepare on public.boss_training_runs;
create trigger boss_training_runs_prepare
  before insert or update on public.boss_training_runs
  for each row execute function private.boss_training_runs_prepare();

alter table public.boss_training_runs enable row level security;
drop policy if exists training_read   on public.boss_training_runs;
drop policy if exists training_insert on public.boss_training_runs;
drop policy if exists training_update on public.boss_training_runs;
drop policy if exists training_delete on public.boss_training_runs;
create policy training_read on public.boss_training_runs
  for select to authenticated
  using (private.est_membre(auth.uid()));
-- On n'enregistre pas une run à laquelle on n'a pas participé.
create policy training_insert on public.boss_training_runs
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and auth.uid() = any(participants)
    and private.est_membre(auth.uid())
  );
-- Participant AVANT (using) et APRÈS (with check) : on peut changer les
-- autres participants, jamais se retirer soi-même.
create policy training_update on public.boss_training_runs
  for update to authenticated
  using (
    auth.uid() = any(participants)
    and private.est_membre(auth.uid())
  )
  with check (
    auth.uid() = any(participants)
  );
create policy training_delete on public.boss_training_runs
  for delete to authenticated
  using (
    auth.uid() = any(participants)
    and private.est_membre(auth.uid())
  );
```

Puis, dans le tableau Realtime, remplacer la ligne `    'collection_items'` par :

```sql
    'collection_items',
    'boss_training_runs'
```

- [ ] **Step 4: Enregistrer le test dans le lanceur**

Dans `scripts/lancer-tests.js`, après `    "node tests/collection-schema.test.js",` ajouter :

```js
    "node tests/entrainement-schema.test.js",
```

- [ ] **Step 5: Lancer les tests**

Run: `node tests/entrainement-schema.test.js && python -m unittest tests/test_schema_sql.py && node tests/roster-schema.test.js`
Expected: `PASS schema : boss_training_runs…`, puis `OK` pour pglast (syntaxe du corps plpgsql comprise), puis le test Realtime existant vert.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql tests/entrainement-schema.test.js scripts/lancer-tests.js
git commit -m "feat(entrainement): table boss_training_runs, trigger et RLS"
```

---

### Task 2: Logique métier pure

**Files:**
- Create: `js/metier/entrainement-boss.js`
- Create: `tests/entrainement-boss.test.js`
- Modify: `tests/helpers/modules.js` (après `"metier/boss-logique.js",`)
- Modify: `sw.js` (`CORE_ASSETS`, après `"./js/metier/boss-logique.js",`)
- Modify: `scripts/lancer-tests.js` (suite `unit`, après la ligne ajoutée en Task 1)

**Interfaces:**
- Consumes: rien (module sans `import` : ni DOM ni réseau).
- Produces (forme d'une run normalisée, utilisée par toutes les tâches suivantes) :
  `{ id, playedOn:"AAAA-MM-JJ", score:"<chaîne d'entier>", note, participants:[uuid], equipes:{ [uuid]:{ pseudo, teamId|null, snapshot|null } }, createdBy, createdByPseudo, createdAt, updatedByPseudo, updatedAt:"<jeton opaque>" }`
  - `ENTRAINEMENT_MAX_PARTICIPANTS = 5`, `ENTRAINEMENT_NOTE_MAX = 1000`
  - `dateParisEntrainement(now?: Date) → "AAAA-MM-JJ"`
  - `validerSaisieEntrainement({ auteurId, participants, score, note, playedOn, aujourdhui }) → { ok:true, valeur:{ participants, score, note, playedOn } } | { ok:false, erreur:string }` — codes : `PARTICIPANTS_VIDES`, `TROP_DE_PARTICIPANTS`, `AUTEUR_ABSENT`, `PARTICIPANT_EN_DOUBLE`, `SCORE_INVALIDE`, `NOTE_TROP_LONGUE`, `DATE_INVALIDE`, `DATE_FUTURE`
  - `cleCompositionEntrainement(snapshot) → string|null` (ids de héros non nuls, triés, joints par `|`)
  - `trierRunsEntrainement(runs) → runs[]` (plus récente d'abord)
  - `serieProgressionEntrainement(runs, membreId|null) → [{ id, playedOn, score }]` (chronologique)
  - `resumeProgressionEntrainement(serie) → { meilleur, dernier, ecart } | null` (chaînes ; `ecart` = dernier − meilleur, ≤ 0)
  - `topRunsEntrainement(runs, limite=10) → [{ rang, run }]`
  - `comparaisonEquipesEntrainement(runs, membreId) → [{ cle, heros:[charId], runs:number, meilleur, mediane }]`

- [ ] **Step 1: Écrire les tests unitaires (ils doivent échouer)**

`tests/entrainement-boss.test.js` :

```js
"use strict";

/* Les règles de l'entraînement du boss, lues sur le module isolé : il n'a
   aucun import, on le charge seul dans un contexte `vm`. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { plain } = require("./helpers/load-app");

const source = fs
  .readFileSync(path.join(__dirname, "..", "js", "metier", "entrainement-boss.js"), "utf8")
  .replace(/export\s*\{[^}]*\};?/, "");
const contexte = {};
vm.runInNewContext(source + `
this.__api = { ENTRAINEMENT_MAX_PARTICIPANTS, ENTRAINEMENT_NOTE_MAX,
  dateParisEntrainement, validerSaisieEntrainement, cleCompositionEntrainement,
  trierRunsEntrainement, serieProgressionEntrainement,
  resumeProgressionEntrainement, topRunsEntrainement,
  comparaisonEquipesEntrainement };`, contexte, { filename:"entrainement-boss.js" });
const api = contexte.__api;

/* ---------- date de Paris ---------- */
/* 23h30 UTC le 21 septembre = 1h30 le 22 à Paris (heure d'été). */
assert.equal(api.dateParisEntrainement(new Date("2026-09-21T23:30:00Z")), "2026-09-22");

/* ---------- validation ---------- */
const base = { auteurId:"a", participants:["a","b"], score:"1500000",
  note:"", playedOn:"2026-09-20", aujourdhui:"2026-09-22" };
const erreur = changes => api.validerSaisieEntrainement(Object.assign({}, base, changes)).erreur;
assert.equal(api.validerSaisieEntrainement(base).ok, true);
assert.deepEqual(plain(api.validerSaisieEntrainement(base).valeur),
  { participants:["a","b"], score:"1500000", note:"", playedOn:"2026-09-20" });
assert.equal(erreur({ participants:[] }), "PARTICIPANTS_VIDES");
assert.equal(erreur({ participants:["a","b","c","d","e","f"] }), "TROP_DE_PARTICIPANTS");
assert.equal(erreur({ participants:["b","c"] }), "AUTEUR_ABSENT");
assert.equal(erreur({ participants:["a","b","b"] }), "PARTICIPANT_EN_DOUBLE");
assert.equal(erreur({ score:"0" }), "SCORE_INVALIDE");
assert.equal(erreur({ score:"-3" }), "SCORE_INVALIDE");
assert.equal(erreur({ score:"12,5" }), "SCORE_INVALIDE");
assert.equal(erreur({ score:"" }), "SCORE_INVALIDE");
assert.equal(erreur({ note:"x".repeat(1001) }), "NOTE_TROP_LONGUE");
assert.equal(erreur({ playedOn:"20/09/2026" }), "DATE_INVALIDE");
assert.equal(erreur({ playedOn:"2026-09-23" }), "DATE_FUTURE");
/* Les espaces et séparateurs de milliers saisis sont tolérés et retirés. */
assert.equal(api.validerSaisieEntrainement(Object.assign({}, base,
  { score:" 1 500 000 " })).valeur.score, "1500000");
/* La note est rognée. */
assert.equal(api.validerSaisieEntrainement(Object.assign({}, base,
  { note:"  bien  " })).valeur.note, "bien");

/* ---------- composition ---------- */
const snap = chars => ({ data:{ heroes:chars.map(char => ({ char })) } });
assert.equal(api.cleCompositionEntrainement(snap(["merlin","ban",null,"diane"])), "ban|diane|merlin");
assert.equal(api.cleCompositionEntrainement(snap(["diane","merlin","ban"])), "ban|diane|merlin");
assert.equal(api.cleCompositionEntrainement(null), null);
assert.equal(api.cleCompositionEntrainement(snap([null,null])), null);

/* ---------- jeu de runs ---------- */
const run = (id, playedOn, score, equipes, createdAt) => ({
  id, playedOn, score, note:"", participants:Object.keys(equipes),
  equipes, createdAt:createdAt || playedOn+"T20:00:00Z", updatedAt:"t"
});
const eq = chars => ({ pseudo:"x", teamId:"t", snapshot:snap(chars) });
const runs = [
  run("r1", "2026-09-10", "9007199254740993", { a:eq(["ban","diane"]), b:eq(["merlin"]) }),
  run("r2", "2026-09-12", "9007199254740992", { a:eq(["diane","ban"]) }),
  run("r3", "2026-09-12", "100", { b:eq(["merlin"]) }, "2026-09-12T21:00:00Z"),
  run("r4", "2026-09-15", "300", { a:{ pseudo:"x", teamId:null, snapshot:null } }),
  run("r5", "2026-09-16", "200", { a:eq(["king"]) })
];

assert.deepEqual(plain(api.trierRunsEntrainement(runs).map(r => r.id)),
  ["r5","r4","r3","r2","r1"]);

/* Progression : chronologique ; filtrée sur un membre. */
assert.deepEqual(plain(api.serieProgressionEntrainement(runs, null).map(p => p.id)),
  ["r1","r2","r3","r4","r5"]);
assert.deepEqual(plain(api.serieProgressionEntrainement(runs, "b").map(p => p.id)),
  ["r1","r3"]);
assert.deepEqual(plain(api.resumeProgressionEntrainement(
  api.serieProgressionEntrainement(runs, "a"))),
  { meilleur:"9007199254740993", dernier:"200", ecart:"-9007199254740793" });
assert.equal(api.resumeProgressionEntrainement([]), null);

/* Top : au-delà de 2^53 sans perte, égalité → la plus ancienne d'abord. */
const top = api.topRunsEntrainement(runs, 3);
assert.deepEqual(plain(top.map(t => [t.rang, t.run.id])),
  [[1,"r1"],[2,"r2"],[3,"r4"]]);
assert.equal(api.topRunsEntrainement(runs).length, 5);

/* Comparaison : par composition du membre, équipe manquante exclue,
   médiane sur un nombre pair = moyenne entière des deux centrales. */
const comparaison = plain(api.comparaisonEquipesEntrainement(runs, "a"));
assert.deepEqual(comparaison, [
  { cle:"ban|diane", heros:["ban","diane"], runs:2,
    meilleur:"9007199254740993", mediane:"9007199254740992" },
  { cle:"king", heros:["king"], runs:1, meilleur:"200", mediane:"200" }
]);
assert.deepEqual(plain(api.comparaisonEquipesEntrainement(runs, "inconnu")), []);

console.log("entrainement-boss : ok");
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node tests/entrainement-boss.test.js`
Expected: FAIL (`ENOENT` : `js/metier/entrainement-boss.js` n'existe pas).

- [ ] **Step 3: Écrire le module**

`js/metier/entrainement-boss.js` :

```js
/* Logique pure de l'entraînement du boss de confrérie.

   Ni DOM, ni Supabase, ni stockage : tout vient en argument. Les scores sont
   des CHAINES du début à la fin et se comparent en BigInt — un score de boss
   dépasse vite 2^53, et un Number le tronquerait sans rien dire.

   Le score est celui du GROUPE : le jeu ne donne pas les dégâts par membre.
   La comparaison d'équipes le rappelle à l'écran ; ici, elle ne fait que
   regrouper les runs d'un membre par la composition qu'il a jouée. */

  const ENTRAINEMENT_MAX_PARTICIPANTS = 5;
  const ENTRAINEMENT_NOTE_MAX = 1000;

  function dateParisEntrainement(now){
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Europe/Paris", year:"numeric", month:"2-digit", day:"2-digit"
    }).formatToParts(now || new Date());
    const partie = type => (parts.find(p => p.type === type) || {}).value;
    return partie("year") + "-" + partie("month") + "-" + partie("day");
  }

  function scoreEntrainementBigInt(valeur){
    try{ return BigInt(String(valeur)); }catch(erreur){ return null; }
  }

  function validerSaisieEntrainement(saisie){
    const s = saisie || {};
    const participants = Array.isArray(s.participants) ? s.participants.slice() : [];
    const echec = erreur => ({ ok:false, erreur });
    if(!participants.length) return echec("PARTICIPANTS_VIDES");
    if(participants.length > ENTRAINEMENT_MAX_PARTICIPANTS) return echec("TROP_DE_PARTICIPANTS");
    if(new Set(participants).size !== participants.length) return echec("PARTICIPANT_EN_DOUBLE");
    if(!participants.includes(s.auteurId)) return echec("AUTEUR_ABSENT");
    const score = String(s.score == null ? "" : s.score).replace(/[\s  .]/g, "");
    if(!/^[0-9]+$/.test(score) || BigInt(score) <= 0n) return echec("SCORE_INVALIDE");
    const note = String(s.note || "").trim();
    if(note.length > ENTRAINEMENT_NOTE_MAX) return echec("NOTE_TROP_LONGUE");
    const playedOn = String(s.playedOn || "");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(playedOn)) return echec("DATE_INVALIDE");
    if(playedOn > String(s.aujourdhui || "")) return echec("DATE_FUTURE");
    return { ok:true, valeur:{
      participants, score:BigInt(score).toString(), note, playedOn
    } };
  }

  function herosDuSnapshotEntrainement(snapshot){
    const heroes = snapshot && snapshot.data && Array.isArray(snapshot.data.heroes)
      ? snapshot.data.heroes : [];
    return heroes.map(h => h && h.char).filter(Boolean).sort();
  }

  function cleCompositionEntrainement(snapshot){
    const heros = herosDuSnapshotEntrainement(snapshot);
    return heros.length ? heros.join("|") : null;
  }

  function comparerDatesEntrainement(a, b){
    return String(a.playedOn).localeCompare(String(b.playedOn))
      || String(a.createdAt).localeCompare(String(b.createdAt));
  }

  function trierRunsEntrainement(runs){
    return (runs || []).slice().sort((a, b) => comparerDatesEntrainement(b, a));
  }

  function serieProgressionEntrainement(runs, membreId){
    return (runs || [])
      .filter(run => !membreId || (run.participants || []).includes(membreId))
      .filter(run => scoreEntrainementBigInt(run.score) !== null)
      .slice()
      .sort(comparerDatesEntrainement)
      .map(run => ({ id:run.id, playedOn:run.playedOn, score:String(run.score) }));
  }

  function resumeProgressionEntrainement(serie){
    if(!serie || !serie.length) return null;
    let meilleur = null;
    serie.forEach(point => {
      const valeur = BigInt(point.score);
      if(meilleur === null || valeur > meilleur) meilleur = valeur;
    });
    const dernier = BigInt(serie[serie.length - 1].score);
    return {
      meilleur:meilleur.toString(),
      dernier:dernier.toString(),
      ecart:(dernier - meilleur).toString()
    };
  }

  function topRunsEntrainement(runs, limite){
    const max = Number.isInteger(limite) && limite > 0 ? limite : 10;
    return (runs || [])
      .filter(run => scoreEntrainementBigInt(run.score) !== null)
      .slice()
      .sort((a, b) => {
        const sa = BigInt(a.score), sb = BigInt(b.score);
        if(sa !== sb) return sa > sb ? -1 : 1;
        return comparerDatesEntrainement(a, b);
      })
      .slice(0, max)
      .map((run, index) => ({ rang:index + 1, run }));
  }

  function medianeEntrainement(valeurs){
    const triees = valeurs.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const milieu = Math.floor(triees.length / 2);
    return triees.length % 2
      ? triees[milieu]
      : (triees[milieu - 1] + triees[milieu]) / 2n;
  }

  function comparaisonEquipesEntrainement(runs, membreId){
    const groupes = new Map();
    (runs || []).forEach(run => {
      const entree = run.equipes && run.equipes[membreId];
      const cle = entree ? cleCompositionEntrainement(entree.snapshot) : null;
      const score = scoreEntrainementBigInt(run.score);
      if(!cle || score === null) return;
      if(!groupes.has(cle)){
        groupes.set(cle, { cle, heros:herosDuSnapshotEntrainement(entree.snapshot), scores:[] });
      }
      groupes.get(cle).scores.push(score);
    });
    return [...groupes.values()]
      .map(g => {
        const meilleur = g.scores.reduce((m, v) => (v > m ? v : m));
        return { cle:g.cle, heros:g.heros, runs:g.scores.length,
          meilleur:meilleur.toString(),
          mediane:medianeEntrainement(g.scores).toString() };
      })
      .sort((a, b) => {
        const ma = BigInt(a.meilleur), mb = BigInt(b.meilleur);
        return ma === mb ? a.cle.localeCompare(b.cle) : (ma > mb ? -1 : 1);
      });
  }

export {
  ENTRAINEMENT_MAX_PARTICIPANTS,
  ENTRAINEMENT_NOTE_MAX,
  cleCompositionEntrainement,
  comparaisonEquipesEntrainement,
  dateParisEntrainement,
  resumeProgressionEntrainement,
  serieProgressionEntrainement,
  topRunsEntrainement,
  trierRunsEntrainement,
  validerSaisieEntrainement
};
```

- [ ] **Step 4: Déclarer le module**

`tests/helpers/modules.js`, après `  "metier/boss-logique.js",` :

```js
  "metier/entrainement-boss.js",
```

`sw.js`, dans `CORE_ASSETS`, remplacer `"./js/metier/boss-logique.js",` par :

```js
"./js/metier/boss-logique.js", "./js/metier/entrainement-boss.js",
```

`scripts/lancer-tests.js`, suite `unit`, après `"node tests/entrainement-schema.test.js",` :

```js
    "node tests/entrainement-boss.test.js",
```

- [ ] **Step 5: Lancer les tests**

Run: `node tests/entrainement-boss.test.js`
Expected: `entrainement-boss : ok`.

Run: `node tests/modules-imports.test.js`
Expected: **un seul** échec attendu à ce stade — les exports de `metier/entrainement-boss.js` ne sont encore importés par personne. Il passera au vert en Task 5. Tout autre échec est à corriger maintenant.

- [ ] **Step 6: Commit**

```bash
git add js/metier/entrainement-boss.js tests/entrainement-boss.test.js tests/helpers/modules.js sw.js scripts/lancer-tests.js
git commit -m "feat(entrainement): regles pures des runs d'entrainement"
```

---

### Task 3: Store Supabase et table simulée

**Files:**
- Modify: `js/noyau/constantes.js` (déclaration à côté de `CLOUD_COLLECTION_CACHE_KEY`, ligne ~51, et dans le bloc `export`, ligne ~129)
- Create: `js/donnees/entrainement-store.js`
- Modify: `tests/helpers/modules.js` (après `"donnees/boss-store.js",`)
- Modify: `sw.js` (`CORE_ASSETS`, après `"./js/donnees/boss-store.js",`)
- Modify: `tests/helpers/faux-supabase.js`

**Interfaces:**
- Consumes: `sb` (`noyau/supabase-client.js`), `sessionCourante` (`etat/session.js`), `CLOUD_TRAINING_CACHE_KEY`.
- Produces:
  - `EntrainementStore.all() → run[]` (cache, forme normalisée de Task 2)
  - `EntrainementStore.refresh() → Promise<run[]>` (lit tout, trié par la vue)
  - `EntrainementStore.create({ playedOn, score, note, participants, equipes:{[uuid]:{teamId}} }) → Promise<void>`
  - `EntrainementStore.update(id, jeton, memeForme) → Promise<void>` — lève `Error("TRAINING_CONFLICT")` si zéro ligne n'est modifiée
  - `EntrainementStore.remove(id) → Promise<void>`
  - `EntrainementStore.lastSyncedAt() → number|null`
  - Dans le faux : `state.boss_training_runs` (tableau de lignes au format SQL), `state.trainingConflictOnce` (booléen).

- [ ] **Step 1: Ajouter la clé de cache**

Dans `js/noyau/constantes.js`, sous `  const CLOUD_COLLECTION_CACHE_KEY = "confrerie7ds.cloud.collection";` :

```js
  const CLOUD_TRAINING_CACHE_KEY = "confrerie7ds.cloud.training";
```

et dans l'`export`, sous `  CLOUD_COLLECTION_CACHE_KEY,` :

```js
  CLOUD_TRAINING_CACHE_KEY,
```

- [ ] **Step 2: Écrire le store**

`js/donnees/entrainement-store.js` :

```js
/* Les runs d'entraînement du boss de confrérie.

   Une ligne par run. Toute écriture est suivie d'une relecture complète : le
   volume est minuscule (quelques runs par semaine) et c'est le serveur qui
   fige les équipes — la ligne relue est la seule vérité.

   Une correction porte le `updated_at` relu, en CHAINE OPAQUE : Date.parse
   perdrait les microsecondes de PostgreSQL et ferait échouer toute
   comparaison. Zéro ligne modifiée = quelqu'un est passé entre-temps.

   Le cache sert à afficher hors ligne, il n'accorde AUCUN droit. */

import { CLOUD_TRAINING_CACHE_KEY } from "../noyau/constantes.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";

  const TABLE_ENTRAINEMENT = "boss_training_runs";
  const COLONNES_ENTRAINEMENT = "id,played_on,global_score::text,note,participants,"
    + "equipes,created_by,created_by_pseudo,created_at,updated_by_pseudo,updated_at";

  function lireCacheEntrainement(){
    try{
      const brut = JSON.parse(localStorage.getItem(CLOUD_TRAINING_CACHE_KEY));
      return brut && brut.version === 1 && Array.isArray(brut.runs) ? brut : null;
    }catch(erreur){
      return null;
    }
  }
  let cacheEntrainement = lireCacheEntrainement();

  function normaliserRunEntrainement(ligne){
    return {
      id:ligne.id,
      playedOn:ligne.played_on,
      score:String(ligne.global_score),
      note:ligne.note || "",
      participants:Array.isArray(ligne.participants) ? ligne.participants : [],
      equipes:ligne.equipes && typeof ligne.equipes === "object" ? ligne.equipes : {},
      createdBy:ligne.created_by || null,
      createdByPseudo:ligne.created_by_pseudo || "Membre",
      createdAt:ligne.created_at,
      updatedByPseudo:ligne.updated_by_pseudo || null,
      updatedAt:String(ligne.updated_at)
    };
  }

  function ligneDeSaisieEntrainement(saisie){
    const equipes = {};
    saisie.participants.forEach(id => {
      const choix = saisie.equipes && saisie.equipes[id];
      equipes[id] = { teamId:choix && choix.teamId ? choix.teamId : null };
    });
    return {
      played_on:saisie.playedOn,
      global_score:saisie.score,
      note:saisie.note,
      participants:saisie.participants,
      equipes
    };
  }

  function exigerSessionEntrainement(){
    if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
  }

  const EntrainementStore = {
    all(){
      return cacheEntrainement ? cacheEntrainement.runs.slice() : [];
    },
    lastSyncedAt(){
      return cacheEntrainement ? cacheEntrainement.syncedAt : null;
    },
    aUnCache(){
      return !!cacheEntrainement;
    },
    async refresh(){
      exigerSessionEntrainement();
      const { data, error } = await sb.from(TABLE_ENTRAINEMENT)
        .select(COLONNES_ENTRAINEMENT)
        .order("played_on", { ascending:false });
      if(error) throw error;
      cacheEntrainement = {
        version:1,
        syncedAt:Date.now(),
        runs:(data || []).map(normaliserRunEntrainement)
      };
      try{
        localStorage.setItem(CLOUD_TRAINING_CACHE_KEY, JSON.stringify(cacheEntrainement));
      }catch(erreur){ /* quota plein : le cache est un confort */ }
      return EntrainementStore.all();
    },
    async create(saisie){
      exigerSessionEntrainement();
      const ligne = Object.assign(ligneDeSaisieEntrainement(saisie),
        { created_by:sessionCourante.user.id });
      const { error } = await sb.from(TABLE_ENTRAINEMENT).insert(ligne);
      if(error) throw error;
    },
    async update(id, jeton, saisie){
      exigerSessionEntrainement();
      const { data, error } = await sb.from(TABLE_ENTRAINEMENT)
        .update(ligneDeSaisieEntrainement(saisie))
        .eq("id", id)
        .eq("updated_at", jeton)
        .select("id");
      if(error) throw error;
      if(!data || !data.length) throw new Error("TRAINING_CONFLICT");
    },
    async remove(id){
      exigerSessionEntrainement();
      const { error } = await sb.from(TABLE_ENTRAINEMENT).delete().eq("id", id);
      if(error) throw error;
    }
  };

export { EntrainementStore };
```

- [ ] **Step 3: Déclarer le module**

`tests/helpers/modules.js`, après `  "donnees/boss-store.js",` :

```js
  "donnees/entrainement-store.js",
```

`sw.js`, `CORE_ASSETS` : remplacer `"./js/donnees/boss-store.js",` par
`"./js/donnees/boss-store.js", "./js/donnees/entrainement-store.js",`

- [ ] **Step 4: Étendre le faux Supabase**

Dans `tests/helpers/faux-supabase.js` :

1. Dans l'objet `state` (après `calls:[],`), ajouter :

```js
      boss_training_runs:[],
      /* Fait echouer la prochaine correction comme si un autre membre
         l'avait devancee : zero ligne modifiee. */
      trainingConflictOnce:false,
      trainingClock:0,
```

2. Dans `bossAcl.sharedReadTables` et dans `bossAcl.membreOnlyTables`, ajouter `"boss_training_runs"`.

3. Dans `query(table)`, déclarer `let returning = false;` après `let upsertOptions = null;`, puis remplacer la méthode `select` du `builder` par :

```js
        /* `update(...).select()` renvoie les lignes modifiees, comme
           PostgREST : c'est ainsi que le client detecte un conflit. */
        select(){
          if(operation === "update" || operation === "delete") returning = true;
          else operation = "select";
          return builder;
        },
```

4. Dans `execute()`, juste **avant** `if(operation === "select"){`, insérer le bloc qui simule la RLS et le trigger de `boss_training_runs` :

```js
        if(table === "boss_training_runs" && operation !== "select"){
          const moi = bossAcl.owner();
          const refus = { data:null, error:{ code:"42501",
            message:"new row violates row-level security policy" } };
          const horloge = () => {
            state.trainingClock += 1;
            return "2026-09-22T10:00:" + String(state.trainingClock).padStart(2, "0") + ".123456+00:00";
          };
          const pseudoDe = id => (state.profiles.find(p => p.id === id) || {}).pseudo || "Membre";
          const preparer = (ligne, ancienne) => {
            const participants = ligne.participants || [];
            if(participants.length < 1 || participants.length > 5
              || new Set(participants).size !== participants.length){
              return { error:{ code:"P0001", message:"TRAINING_DUPLICATE_PARTICIPANT" } };
            }
            const equipes = {};
            for(const id of participants){
              const demande = (ligne.equipes || {})[id] || {};
              const avant = ancienne && ancienne.equipes && ancienne.equipes[id];
              const teamId = demande.teamId || null;
              let snapshot = null;
              if(teamId && avant && avant.teamId === teamId) snapshot = avant.snapshot;
              else if(teamId){
                const equipe = state.teams.find(t => t.id === teamId && t.owner === id);
                if(!equipe) return { error:{ code:"P0001", message:"TRAINING_TEAM_NOT_OWNED" } };
                snapshot = { id:equipe.id, owner:equipe.owner, pseudo:equipe.pseudo,
                  data:clone(equipe.data), createdAt:equipe.created_at,
                  updatedAt:equipe.updated_at, capturedAt:"2026-09-22T10:00:00Z" };
              }
              equipes[id] = { pseudo:(avant && avant.pseudo) || pseudoDe(id), teamId, snapshot };
            }
            return { ligne:Object.assign({}, ligne, { equipes }) };
          };

          if(operation === "insert"){
            const valeur = Array.isArray(payload) ? payload[0] : payload;
            if(!moi || valeur.created_by !== moi || !(valeur.participants || []).includes(moi)){
              return refus;
            }
            const pret = preparer(valeur, null);
            if(pret.error) return { data:null, error:pret.error };
            rows.push(Object.assign({}, pret.ligne, {
              id:"training-" + (rows.length + 1) + "-" + state.trainingClock,
              global_score:String(valeur.global_score),
              created_by:moi, created_by_pseudo:pseudoDe(moi),
              created_at:horloge(), updated_by_pseudo:null, updated_at:horloge()
            }));
            emitDatabase(table, "INSERT");
            return { data:null, error:null };
          }
          if(operation === "update"){
            if(state.trainingConflictOnce){
              state.trainingConflictOnce = false;
              return { data:[], error:null };
            }
            const cibles = rows.filter(row => matchRow(row) && row.participants.includes(moi));
            if(payload.participants && !payload.participants.includes(moi)) return refus;
            for(const row of cibles){
              const pret = preparer(Object.assign({}, row, payload), row);
              if(pret.error) return { data:null, error:pret.error };
              Object.assign(row, pret.ligne, {
                global_score:String(pret.ligne.global_score),
                updated_by_pseudo:pseudoDe(moi), updated_at:horloge()
              });
            }
            if(cibles.length) emitDatabase(table, "UPDATE");
            return { data:returning ? cibles.map(row => ({ id:row.id })) : null, error:null };
          }
          if(operation === "delete"){
            for(let index = rows.length - 1; index >= 0; index--){
              if(matchRow(rows[index]) && rows[index].participants.includes(moi)) rows.splice(index, 1);
            }
            emitDatabase(table, "DELETE");
            return { data:null, error:null };
          }
        }
```

(`emitDatabase` existe déjà plus bas dans le fichier ; c'est une déclaration de fonction, donc remontée.)

- [ ] **Step 5: Vérifier que rien d'existant ne casse**

Run: `node tests/collection.playwright.js && node tests/boss-meilleures-runs.playwright.js && node tests/supabase-etape1.playwright.js`
Expected: les trois passent (le changement de `select()` ne touche que `update/delete` suivis de `select`, que personne n'utilisait). `supabase-etape1` est connu pour être instable : le relancer une fois avant de conclure à une régression.

- [ ] **Step 6: Commit**

```bash
git add js/noyau/constantes.js js/donnees/entrainement-store.js tests/helpers/modules.js sw.js tests/helpers/faux-supabase.js
git commit -m "feat(entrainement): store Supabase et table simulee"
```

---

### Task 4: Navigation, route, balisage et vue minimale (historique)

**Files:**
- Modify: `js/metier/routage.js` (`ROUTE_VIEWS`)
- Modify: `tests/routage.test.js` (`stableViews`)
- Modify: `js/vues/navigation.js` (`VUES_DU_GROUPE`, `VUES_DE_CONFRERIE`)
- Modify: `index.html` (sous-onglet, dock mobile, section de vue)
- Create: `js/vues/boss-entrainement.js`
- Modify: `js/app.js`
- Modify: `tests/helpers/modules.js` (après `"vues/boss-sessions.js",`), `sw.js`
- Modify: `css/boss.css` (fin de fichier)
- Create: `tests/entrainement.playwright.js`
- Modify: `scripts/lancer-tests.js` (suite `e2e`, après `"node tests/boss-meilleures-runs.playwright.js",`)

**Interfaces:**
- Consumes: `EntrainementStore` (Task 3) ; `trierRunsEntrainement`, `ENTRAINEMENT_MAX_PARTICIPANTS` (Task 2) ; `formatBossScore`, `frDate` (`metier/boss-logique.js`) ; `bossTeamBanner` (`vues/equipe-boss.js`) ; `teamFromBossSnapshot` (`metier/equipe-modele.js`) ; `openTeamDetail` (`vues/detail-equipe.js`) ; `el`, `$` (`noyau/dom.js`) ; `sessionCourante`.
- Produces:
  - `renderTrainingView(options?:{ silencieux?:boolean }) → Promise<boolean>`
  - `invaliderEntrainement() → void` (marque la vue à relire)
  - DOM : `#view-training`, `#trainingAdd`, `#trainingSubviews` (boutons `[data-training-vue]` avec `aria-pressed`), `#trainingStatus`, `#trainingBody` ; une carte par run `li.training-run[data-training-run-id]` ; bouton `.training-edit[data-training-run-id]` visible seulement pour un participant.
  - Crochet de la modale : `renderTrainingView` accepte que la Task 5 branche `ouvrirSaisieEntrainement` sur `#trainingAdd` et `.training-edit`. En Task 4, ces boutons existent mais n'ont pas d'action.

- [ ] **Step 1: Écrire le parcours Playwright (il doit échouer)**

`tests/entrainement.playwright.js` :

```js
"use strict";

/* L'onglet Entraînement du groupe Boss : navigation, historique, et (tâches
   suivantes) saisie, correction, conflit, progression, classement. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { installFakeSupabase } = require("./helpers/faux-supabase");
const { chromium } = require("playwright");

async function connecter(page){
  await page.locator("#authOverlay").waitFor({ state:"visible" });
  await page.locator("#authEmail").fill("yannis@example.test");
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
  await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();
}

async function ouvrirEntrainement(page){
  await page.locator('.tabs .tab[data-view="roster"]').click();
  await page.locator('.subtabs .tab[data-view="training"]').click();
  await page.locator("#view-training").waitFor({ state:"visible" });
}

/* Deux runs posées directement dans la table simulée, au format SQL. */
async function poserDesRuns(page){
  await page.evaluate(() => {
    const s = window.__fakeSupabaseState;
    const equipe = (id, owner, chars) => ({ pseudo:owner === "user-1" ? "Yannis" : "Merlin",
      teamId:id, snapshot:{ id, owner, pseudo:"", data:{ id, name:"Compo",
        heroes:chars.map(char => ({ char })) } } });
    s.boss_training_runs.push(
      { id:"tr-1", played_on:"2026-09-18", global_score:"9007199254740993", note:"Premier essai",
        participants:["user-1","user-2"],
        equipes:{ "user-1":equipe("team-own","user-1",["meliodas","diane"]),
                  "user-2":equipe("team-other","user-2",["merlin"]) },
        created_by:"user-1", created_by_pseudo:"Yannis", created_at:"2026-09-18T20:00:00Z",
        updated_by_pseudo:null, updated_at:"2026-09-18T20:00:00.000001+00:00" },
      { id:"tr-2", played_on:"2026-09-20", global_score:"120000", note:"",
        participants:["user-2"],
        equipes:{ "user-2":{ pseudo:"Merlin", teamId:null, snapshot:null } },
        created_by:"user-2", created_by_pseudo:"Merlin", created_at:"2026-09-20T20:00:00Z",
        updated_by_pseudo:null, updated_at:"2026-09-20T20:00:00.000001+00:00" }
    );
  });
}

(async () => {
  const server = await serveRepo();
  const browser = await chromium.launch();
  try{
    const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
    await installFakeSupabase(page);
    await page.goto(server.url + "/index.html#training");
    await connecter(page);
    await poserDesRuns(page);
    await ouvrirEntrainement(page);

    /* Le sous-onglet appartient au groupe Boss et l'URL le nomme. */
    assert.equal(await page.locator('.subtabs .tab[data-view="training"]')
      .getAttribute("aria-selected"), "true");
    assert.match(page.url(), /#training$/);

    /* Historique : la plus récente d'abord, score exact au-delà de 2^53. */
    const cartes = page.locator("#trainingBody li.training-run");
    await cartes.first().waitFor();
    assert.deepEqual(
      await cartes.evaluateAll(n => n.map(x => x.dataset.trainingRunId)),
      ["tr-2", "tr-1"]);
    assert.match(await cartes.nth(1).textContent(), /9\s?007\s?199\s?254\s?740\s?993/);
    assert.match(await cartes.nth(0).textContent(), /Équipe non renseignée/);

    /* « Corriger » n'apparaît que pour un participant (user-1 est dans tr-1,
       pas dans tr-2). */
    assert.equal(await page.locator('.training-edit[data-training-run-id="tr-1"]').count(), 1);
    assert.equal(await page.locator('.training-edit[data-training-run-id="tr-2"]').count(), 0);

    /* Aucun débordement horizontal à 320 px. */
    await page.setViewportSize({ width:320, height:800 });
    assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth), true);

    console.log("PASS entrainement : navigation et historique");
  } finally {
    await browser.close();
    await server.close();
  }
})().catch(erreur => { console.error(erreur); process.exit(1); });
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node tests/entrainement.playwright.js`
Expected: FAIL (timeout sur `.subtabs .tab[data-view="training"]`).

- [ ] **Step 3: Route et navigation**

`js/metier/routage.js` : dans `ROUTE_VIEWS`, remplacer
`"boss", "analyse", "wiki", "collection", "calculateur", "admin"` par
`"boss", "training", "analyse", "wiki", "collection", "calculateur", "admin"`.

`tests/routage.test.js` : même remplacement dans `stableViews`.

`js/vues/navigation.js` :
- `const VUES_DU_GROUPE = new Set(["roster", "availability", "boss"]);` → `new Set(["roster", "availability", "boss", "training"]);`
- dans `VUES_DE_CONFRERIE`, remplacer `"dashboard", "roster", "analyse", "availability", "boss"` par `"dashboard", "roster", "analyse", "availability", "boss", "training"`.

- [ ] **Step 4: Balisage `index.html`** (outil Edit, une ancre d'une ligne à chaque fois)

1. Après le bouton `id="tab-boss"` du `#bossSubtabs` (sa ligne `aria-selected="false" tabindex="-1">Sessions de boss</button>`), ajouter :

```html
    <button class="tab subtab" id="tab-training" data-view="training"
            role="tab" aria-controls="view-training"
            aria-selected="false" tabindex="-1">Entraînement</button>
```

2. Dans `#mobileBossSubtabs`, après le bouton `data-mobile-view="boss"` (son `Sessions` + `</button>`), ajouter :

```html
  <button class="mobile-boss-subnav-item" type="button"
          data-mobile-view="training" aria-controls="view-training">
    Entraînement
  </button>
```

3. Après la fermeture `</section>` de `#view-boss` (juste avant `<!-- ============ WIKI ============ -->`), ajouter :

```html
  <!-- ============ ENTRAINEMENT DU BOSS ============ -->
  <section id="view-training" class="view" role="tabpanel"
           aria-labelledby="tab-training">
    <p class="section-eyebrow">Confrérie</p>
    <h1 class="section-title">Entraînement du boss</h1>
    <p class="section-lead">Consigne vos runs du mode entraînement : qui était là, avec quelles équipes, et le score du groupe.</p>
    <div class="roster-toolbar training-toolbar">
      <button class="btn btn-primary" id="trainingAdd" type="button">Enregistrer une run</button>
      <div class="training-subviews" id="trainingSubviews" role="group" aria-label="Vue de l’entraînement">
        <button type="button" class="btn btn-ghost" data-training-vue="historique" aria-pressed="true">Historique</button>
        <button type="button" class="btn btn-ghost" data-training-vue="progression" aria-pressed="false">Progression</button>
        <button type="button" class="btn btn-ghost" data-training-vue="classement" aria-pressed="false">Classement</button>
      </div>
      <span class="roster-count" id="trainingStatus"></span>
    </div>
    <div id="trainingBody"></div>
  </section>
```

- [ ] **Step 5: La vue (historique seul)**

`js/vues/boss-entrainement.js` :

```js
/* L'onglet « Entraînement » du groupe Boss.

   Une seule lecture alimente trois sous-vues locales : changer de sous-vue
   ne fait AUCUNE requête. Hors ligne, le dernier cache s'affiche avec son
   badge ; sans cache, la vue le dit — une liste vide passerait pour « aucune
   run ». */

import { EntrainementStore } from "../donnees/entrainement-store.js";
import { sessionCourante } from "../etat/session.js";
import { frDate, formatBossScore } from "../metier/boss-logique.js";
import { trierRunsEntrainement } from "../metier/entrainement-boss.js";
import { teamFromBossSnapshot } from "../metier/equipe-modele.js";
import { $, el } from "../noyau/dom.js";
import { openTeamDetail } from "./detail-equipe.js";
import { bossTeamBanner } from "./equipe-boss.js";

  const etatEntrainement = { vue:"historique", horsLigne:false, perime:true };

  function invaliderEntrainement(){
    etatEntrainement.perime = true;
  }

  function participantEntrainement(run, membreId){
    const entree = run.equipes[membreId] || {};
    const pseudo = entree.pseudo || "Membre";
    const equipe = teamFromBossSnapshot(entree.snapshot);
    const ligne = el("div",{class:"boss-report-participant training-participant"},[
      el("span",{class:"boss-report-participant-name",text:pseudo})
    ]);
    if(equipe){
      ligne.appendChild(el("button",{
        class:"boss-report-team", type:"button",
        "aria-label":"Voir l’équipe de "+pseudo,
        onclick:()=>openTeamDetail(equipe)
      },[bossTeamBanner(equipe), el("span",{class:"boss-report-team-label",text:"Voir l’équipe"})]));
    }else{
      ligne.appendChild(el("span",{class:"boss-report-team-missing",text:"Équipe non renseignée"}));
    }
    return ligne;
  }

  function carteRunEntrainement(run){
    const moi = sessionCourante.user && sessionCourante.user.id;
    const tete = el("div",{class:"training-run-head"},[
      el("strong",{class:"training-run-score",text:formatBossScore(run.score)}),
      el("span",{class:"training-run-meta",text:frDate(run.playedOn)+" · saisie par "+run.createdByPseudo
        +(run.updatedByPseudo ? " · corrigée par "+run.updatedByPseudo : "")})
    ]);
    if(moi && run.participants.includes(moi)){
      tete.appendChild(el("button",{
        class:"btn btn-ghost training-edit", type:"button",
        dataset:{trainingRunId:run.id},
        "aria-label":"Corriger la run du "+frDate(run.playedOn)
      },["Corriger"]));
    }
    const carte = el("li",{class:"training-run",dataset:{trainingRunId:run.id}},[tete]);
    if(run.note) carte.appendChild(el("p",{class:"training-run-note",text:run.note}));
    carte.appendChild(el("div",{class:"boss-report-participants"},
      run.participants.map(id => participantEntrainement(run, id))));
    return carte;
  }

  function vueHistoriqueEntrainement(runs){
    if(!runs.length){
      return el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Aucune run d’entraînement"}),
        el("p",{text:"Enregistre la première avec le bouton ci-dessus."})
      ]);
    }
    return el("ol",{class:"training-runs"}, trierRunsEntrainement(runs).map(carteRunEntrainement));
  }

  /* Tâche 6 remplacera ces deux sous-vues provisoires. */
  const SOUS_VUES_ENTRAINEMENT = {
    historique:vueHistoriqueEntrainement,
    progression:vueHistoriqueEntrainement,
    classement:vueHistoriqueEntrainement
  };

  function dessinerEntrainement(){
    const corps = $("#trainingBody");
    if(!corps) return;
    const runs = EntrainementStore.all();
    corps.replaceChildren();
    if(etatEntrainement.horsLigne && !EntrainementStore.aUnCache()){
      corps.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"L’entraînement est indisponible hors ligne"})
      ]));
    }else{
      corps.appendChild(SOUS_VUES_ENTRAINEMENT[etatEntrainement.vue](runs));
    }
    $("#trainingStatus").textContent = etatEntrainement.horsLigne
      ? "Hors ligne" : runs.length+" run"+(runs.length > 1 ? "s" : "");
    $("#trainingAdd").disabled = etatEntrainement.horsLigne;
    document.querySelectorAll("#trainingSubviews [data-training-vue]").forEach(bouton => {
      bouton.setAttribute("aria-pressed", String(bouton.dataset.trainingVue === etatEntrainement.vue));
    });
  }

  let sousVuesBranchees = false;
  function brancherSousVuesEntrainement(){
    if(sousVuesBranchees) return;
    sousVuesBranchees = true;
    document.querySelectorAll("#trainingSubviews [data-training-vue]").forEach(bouton => {
      bouton.addEventListener("click", () => {
        etatEntrainement.vue = bouton.dataset.trainingVue;
        dessinerEntrainement();
        bouton.focus();
      });
    });
  }

  async function renderTrainingView(options){
    const reglages = Object.assign({ silencieux:false }, options || {});
    brancherSousVuesEntrainement();
    if(!reglages.silencieux && !EntrainementStore.aUnCache()){
      $("#trainingStatus").textContent = "Chargement…";
    }
    try{
      await EntrainementStore.refresh();
      etatEntrainement.horsLigne = false;
      etatEntrainement.perime = false;
    }catch(erreur){
      etatEntrainement.horsLigne = true;
    }
    dessinerEntrainement();
    return !etatEntrainement.horsLigne;
  }

export { invaliderEntrainement, renderTrainingView };
```

- [ ] **Step 6: Déclarer, enregistrer, styler**

`tests/helpers/modules.js`, après `  "vues/boss-sessions.js",` : `  "vues/boss-entrainement.js",`

`sw.js`, `CORE_ASSETS` : remplacer `"./js/vues/boss-sessions.js",` par `"./js/vues/boss-sessions.js", "./js/vues/boss-entrainement.js",`

`js/app.js` : après `import { renderBossView } from "./vues/boss-sessions.js";` ajouter
`import { renderTrainingView } from "./vues/boss-entrainement.js";`
et après `  enregistrerVue("boss", renderBossView);` ajouter
`  enregistrerVue("training", () => renderTrainingView());`

`js/vues/synchro-temps-reel.js` :
- import : `import { invaliderEntrainement, renderTrainingView } from "./boss-entrainement.js";` (après l'import de `./boss-sessions.js`)
- tableau `tables` : ajouter `"boss_training_runs"` après `"collection_items"`
- dans `schedule(table)`, avant `clearTimeout(timer);` : `      if(table === "boss_training_runs") pending.add("training");`
- dans `flush()`, après le bloc `collection` :

```js
        /* Comme la collection : marquee a relire meme cachee, relue si
           affichee. Realtime ne change jamais l'onglet actif. */
        if(changed.has("training")){
          invaliderEntrainement();
          if(view === "training"){
            const refreshed = await renderTrainingView({ silencieux:true });
            if(!refreshed) throw new Error("TRAINING_SYNC_FAILED");
          }
        }
```

`css/boss.css`, en fin de fichier :

```css
/* ============ Entraînement du boss ============ */
.training-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.training-subviews{display:flex;flex-wrap:wrap;gap:6px}
.training-subviews [aria-pressed="true"]{color:var(--gold-bright);border-color:var(--gold-bright)}
.training-subviews .btn,#trainingAdd{min-height:44px}
.training-runs{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:12px}
.training-run{border:1px solid var(--line);border-radius:12px;padding:12px;min-width:0}
.training-run-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}
.training-run-score{font-size:1.25rem;color:var(--gold-bright)}
.training-run-meta{color:var(--muted);font-size:.85rem;flex:1 1 12rem;min-width:0}
.training-edit{min-height:44px;margin-left:auto}
.training-run-note{margin:8px 0 0;overflow-wrap:anywhere}
```

- [ ] **Step 7: Enregistrer le parcours**

`scripts/lancer-tests.js`, suite `e2e`, après `"node tests/boss-meilleures-runs.playwright.js",` : `    "node tests/entrainement.playwright.js",`

- [ ] **Step 8: Lancer les tests**

Run: `node tests/entrainement.playwright.js`
Expected: `PASS entrainement : navigation et historique`.

Run: `node tests/routage.test.js && node tests/navigation-mobile.playwright.js && node tests/accessibilite-mobile.playwright.js`
Expected: verts. Le dock mobile porte maintenant 4 boutons ; `navigation-mobile` vérifie qu'ils font tous ≥ 44 px et qu'un seul est actif. Si `accessibilite-mobile` échoue, vérifier d'abord qu'il ne s'agit pas de son instabilité connue (tuile du picker) en le relançant.

Run: `node tests/modules-imports.test.js`
Expected: il reste au plus l'export orphelin de `validerSaisieEntrainement` / `ENTRAINEMENT_*` / progression / classement (consommés en Tasks 5–6).

- [ ] **Step 9: Commit**

```bash
git add js/metier/routage.js tests/routage.test.js js/vues/navigation.js index.html js/vues/boss-entrainement.js js/app.js js/vues/synchro-temps-reel.js tests/helpers/modules.js sw.js css/boss.css tests/entrainement.playwright.js scripts/lancer-tests.js
git commit -m "feat(entrainement): sous-onglet et historique des runs"
```

---

### Task 5: Modale de saisie, correction et suppression

**Files:**
- Modify: `index.html` (overlay, juste après la fermeture `</div>` de `#bossReportOverlay`)
- Create: `js/vues/modale-entrainement.js`
- Modify: `js/vues/boss-entrainement.js` (brancher `#trainingAdd` et `.training-edit`)
- Modify: `tests/helpers/modules.js` (`"vues/modale-entrainement.js"` **avant** `"vues/boss-entrainement.js"`), `sw.js`
- Modify: `css/boss.css`
- Modify: `tests/entrainement.playwright.js`

**Interfaces:**
- Consumes: `EntrainementStore.create/update/remove`, `validerSaisieEntrainement`, `dateParisEntrainement`, `ENTRAINEMENT_MAX_PARTICIPANTS`, `ENTRAINEMENT_NOTE_MAX` ; `Store` (`donnees/equipes-store.js`, `Store.refresh()` puis `Store.all()` → équipes de tout le registre, champ `owner`) ; `refreshRosterProfiles()` (`donnees/roster-profils.js` → `[{id, pseudo}]`) ; `ModalStack.open(overlay, focusInitial, demandeFermeture)` / `ModalStack.close(overlay)` ; `toast(message, erreur?)` ; `bossTeamBanner`.
- Produces: `ouvrirSaisieEntrainement(run|null, { apres:() => Promise<unknown> }) → Promise<void>` ; DOM `#trainingOverlay`, `#trainingTitle`, `#trainingClose`, `#trainingDate`, `#trainingMembers` (cases `input[type=checkbox][data-member-id]`), `#trainingTeams` (un `select[data-team-for]` par participant), `#trainingScore`, `#trainingNote`, `#trainingCount`, `#trainingError`, `#trainingSubmit`, `#trainingDelete`.

- [ ] **Step 1: Étendre le parcours (il doit échouer)**

Dans `tests/entrainement.playwright.js`, avant `console.log("PASS …")`, remettre la fenêtre à `1280×900` puis ajouter :

```js
    await page.setViewportSize({ width:1280, height:900 });

    /* --- Saisie : Yannis (coché d'office) + Merlin, équipes et score. --- */
    await page.locator("#trainingAdd").click();
    await page.locator("#trainingOverlay").waitFor({ state:"visible" });
    const moi = page.locator('#trainingMembers input[data-member-id="user-1"]');
    assert.equal(await moi.isChecked(), true);
    assert.equal(await moi.isDisabled(), true, "on ne se retire pas de sa propre saisie");
    await page.locator('#trainingMembers input[data-member-id="user-2"]').check();
    await page.locator('#trainingTeams select[data-team-for="user-1"]').selectOption("team-own");
    await page.locator('#trainingTeams select[data-team-for="user-2"]').selectOption("team-other");
    await page.locator("#trainingScore").fill("abc");
    await page.locator("#trainingSubmit").click();
    assert.match(await page.locator("#trainingError").textContent(), /score/i);
    await page.locator("#trainingScore").fill("1 234 567");
    await page.locator("#trainingNote").fill("Avec Merlin");
    await page.locator("#trainingSubmit").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });

    const nouvelle = await page.evaluate(() =>
      window.__fakeSupabaseState.boss_training_runs.find(r => r.note === "Avec Merlin"));
    assert.equal(nouvelle.global_score, "1234567");
    assert.equal(nouvelle.equipes["user-2"].snapshot.id, "team-other",
      "l'instantané est construit côté serveur depuis l'équipe choisie");
    await page.locator(`li.training-run[data-training-run-id="${nouvelle.id}"]`).waitFor();

    /* --- Correction : conflit d'abord, puis succès. --- */
    await page.evaluate(() => { window.__fakeSupabaseState.trainingConflictOnce = true; });
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    await page.locator("#trainingScore").fill("2000000");
    await page.locator("#trainingSubmit").click();
    assert.match(await page.locator("#trainingError").textContent(), /modifiée/i);
    await page.locator("#trainingClose").click();
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    await page.locator("#trainingScore").fill("2000000");
    await page.locator("#trainingSubmit").click();
    await page.locator("#trainingOverlay").waitFor({ state:"hidden" });
    assert.match(await page.locator(`li.training-run[data-training-run-id="${nouvelle.id}"]`)
      .textContent(), /2\s?000\s?000/);

    /* --- Suppression, avec confirmation. --- */
    page.once("dialog", dialogue => dialogue.accept());
    await page.locator(`.training-edit[data-training-run-id="${nouvelle.id}"]`).click();
    await page.locator("#trainingDelete").click();
    await page.locator(`li.training-run[data-training-run-id="${nouvelle.id}"]`)
      .waitFor({ state:"detached" });
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `node tests/entrainement.playwright.js`
Expected: FAIL (timeout sur `#trainingOverlay`).

- [ ] **Step 3: Balisage de la modale** (`index.html`, après le `</div>` final de `#bossReportOverlay`)

```html
<div class="overlay" id="trainingOverlay" role="dialog" aria-modal="true"
     aria-labelledby="trainingTitle" aria-hidden="true">
  <div class="modal training-modal">
    <div class="modal-head">
      <h2 id="trainingTitle">Enregistrer une run d’entraînement</h2>
      <button class="icon-btn" id="trainingClose" type="button"
              aria-label="Fermer">×</button>
    </div>
    <div class="training-form">
      <label for="trainingDate">Date de la run</label>
      <input id="trainingDate" type="date">
      <fieldset class="training-members">
        <legend>Participants (5 au maximum)</legend>
        <div id="trainingMembers"></div>
      </fieldset>
      <div id="trainingTeams" class="training-teams"></div>
      <label for="trainingScore">Score global</label>
      <input id="trainingScore" type="text" inputmode="numeric"
             autocomplete="off" aria-describedby="trainingError">
      <label for="trainingNote">Note (facultative)</label>
      <textarea id="trainingNote" maxlength="1000"
                aria-describedby="trainingCount trainingError"></textarea>
      <div id="trainingCount">0/1000</div>
      <p id="trainingError" role="alert"></p>
      <div class="training-actions">
        <button class="btn btn-ghost" id="trainingDelete" type="button" hidden>Supprimer</button>
        <button class="btn btn-primary" id="trainingSubmit" type="button">Enregistrer</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: La modale**

`js/vues/modale-entrainement.js` :

```js
/* Saisie, correction et suppression d'une run d'entraînement.

   Le membre qui saisit est coché d'office et ne peut pas se décocher : la
   RLS refuserait l'écriture. Pour chaque participant, on ne propose que SES
   équipes ; le serveur vérifie de toute façon qu'elle lui appartient, et en
   fige l'instantané lui-même.

   Rien n'est affiché comme enregistré avant la réponse de Supabase. */

import { EntrainementStore } from "../donnees/entrainement-store.js";
import { Store } from "../donnees/equipes-store.js";
import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { sessionCourante } from "../etat/session.js";
import {
  ENTRAINEMENT_MAX_PARTICIPANTS, ENTRAINEMENT_NOTE_MAX,
  dateParisEntrainement, validerSaisieEntrainement
} from "../metier/entrainement-boss.js";
import { $, el } from "../noyau/dom.js";
import { ModalStack } from "./modal-stack.js";
import { toast } from "./toast.js";

  const MESSAGES_ENTRAINEMENT = {
    PARTICIPANTS_VIDES:"Choisis au moins un participant.",
    TROP_DE_PARTICIPANTS:"Cinq participants au maximum.",
    AUTEUR_ABSENT:"Tu dois faire partie de la run.",
    PARTICIPANT_EN_DOUBLE:"Un participant apparaît deux fois.",
    SCORE_INVALIDE:"Le score doit être un nombre entier supérieur à zéro.",
    NOTE_TROP_LONGUE:"La note dépasse 1000 caractères.",
    DATE_INVALIDE:"La date est invalide.",
    DATE_FUTURE:"La date ne peut pas être dans le futur.",
    TRAINING_FUTURE_DATE:"La date ne peut pas être dans le futur.",
    TRAINING_TEAM_NOT_OWNED:"Une des équipes n’appartient plus à son membre : recharge la page.",
    TRAINING_NOT_A_MEMBER:"Un des participants n’est pas membre de la confrérie.",
    TRAINING_CONFLICT:"Cette run a été modifiée entre-temps : ferme cette fenêtre, la liste vient d’être rechargée."
  };

  const modaleEntrainement = { run:null, apres:null, profils:[], equipes:[], choix:{} };

  function messageEntrainement(erreur){
    const code = String(erreur && (erreur.message || erreur) || "");
    const connu = Object.keys(MESSAGES_ENTRAINEMENT).find(cle => code.includes(cle));
    return connu ? MESSAGES_ENTRAINEMENT[connu] : "Enregistrement impossible. Réessaie.";
  }

  function participantsCochesEntrainement(){
    return [...document.querySelectorAll("#trainingMembers input[data-member-id]:checked")]
      .map(caseACocher => caseACocher.dataset.memberId);
  }

  function dessinerEquipesEntrainement(){
    const boite = $("#trainingTeams");
    boite.replaceChildren();
    participantsCochesEntrainement().forEach(id => {
      const profil = modaleEntrainement.profils.find(p => p.id === id) || { pseudo:"Membre" };
      const select = el("select",{ id:"trainingTeam-"+id, dataset:{teamFor:id} },[
        el("option",{ value:"", text:"Équipe non renseignée" })
      ]);
      modaleEntrainement.equipes.filter(t => t.owner === id).forEach(t => {
        select.appendChild(el("option",{ value:t.id, text:t.name || "Équipe sans nom" }));
      });
      select.value = modaleEntrainement.choix[id] || "";
      select.addEventListener("change", () => { modaleEntrainement.choix[id] = select.value; });
      boite.appendChild(el("div",{class:"training-team-field"},[
        el("label",{ for:"trainingTeam-"+id, text:"Équipe de "+profil.pseudo }),
        select
      ]));
    });
  }

  function dessinerMembresEntrainement(){
    const moi = sessionCourante.user.id;
    const coches = new Set(modaleEntrainement.run ? modaleEntrainement.run.participants : [moi]);
    coches.add(moi);
    const boite = $("#trainingMembers");
    boite.replaceChildren();
    modaleEntrainement.profils.forEach(profil => {
      const caseACocher = el("input",{ type:"checkbox", id:"trainingMember-"+profil.id,
        dataset:{memberId:profil.id} });
      caseACocher.checked = coches.has(profil.id);
      if(profil.id === moi) caseACocher.disabled = true;
      caseACocher.addEventListener("change", () => {
        if(participantsCochesEntrainement().length > ENTRAINEMENT_MAX_PARTICIPANTS){
          caseACocher.checked = false;
          $("#trainingError").textContent = MESSAGES_ENTRAINEMENT.TROP_DE_PARTICIPANTS;
          return;
        }
        dessinerEquipesEntrainement();
      });
      boite.appendChild(el("label",{ class:"training-member", for:"trainingMember-"+profil.id },[
        caseACocher, el("span",{ text:profil.pseudo })
      ]));
    });
  }

  function mettreAJourCompteurEntrainement(){
    $("#trainingCount").textContent = $("#trainingNote").value.length+"/"+ENTRAINEMENT_NOTE_MAX;
  }

  async function enregistrerEntrainement(){
    const bouton = $("#trainingSubmit");
    const aujourdhui = dateParisEntrainement();
    const verdict = validerSaisieEntrainement({
      auteurId:sessionCourante.user.id,
      participants:participantsCochesEntrainement(),
      score:$("#trainingScore").value,
      note:$("#trainingNote").value,
      playedOn:$("#trainingDate").value,
      aujourdhui
    });
    if(!verdict.ok){
      $("#trainingError").textContent = MESSAGES_ENTRAINEMENT[verdict.erreur];
      return;
    }
    const equipes = {};
    verdict.valeur.participants.forEach(id => {
      equipes[id] = { teamId:modaleEntrainement.choix[id] || null };
    });
    const saisie = Object.assign({}, verdict.valeur, { equipes });
    bouton.disabled = true;
    try{
      if(modaleEntrainement.run){
        await EntrainementStore.update(modaleEntrainement.run.id, modaleEntrainement.run.updatedAt, saisie);
      }else{
        await EntrainementStore.create(saisie);
      }
      ModalStack.close($("#trainingOverlay"));
      toast(modaleEntrainement.run ? "Run corrigée." : "Run enregistrée.");
      await modaleEntrainement.apres();
    }catch(erreur){
      $("#trainingError").textContent = messageEntrainement(erreur);
      if(String(erreur && erreur.message) === "TRAINING_CONFLICT") await modaleEntrainement.apres();
    }finally{
      bouton.disabled = false;
    }
  }

  async function supprimerEntrainement(){
    if(!modaleEntrainement.run) return;
    if(!window.confirm("Supprimer définitivement cette run d’entraînement ?")) return;
    try{
      await EntrainementStore.remove(modaleEntrainement.run.id);
      ModalStack.close($("#trainingOverlay"));
      toast("Run supprimée.");
      await modaleEntrainement.apres();
    }catch(erreur){
      $("#trainingError").textContent = messageEntrainement(erreur);
    }
  }

  let modaleEntrainementBranchee = false;
  function brancherModaleEntrainement(){
    if(modaleEntrainementBranchee) return;
    modaleEntrainementBranchee = true;
    $("#trainingClose").addEventListener("click", () => ModalStack.close($("#trainingOverlay")));
    $("#trainingSubmit").addEventListener("click", () => void enregistrerEntrainement());
    $("#trainingDelete").addEventListener("click", () => void supprimerEntrainement());
    $("#trainingNote").addEventListener("input", mettreAJourCompteurEntrainement);
  }

  async function ouvrirSaisieEntrainement(run, options){
    brancherModaleEntrainement();
    modaleEntrainement.run = run || null;
    modaleEntrainement.apres = (options && options.apres) || (async () => {});
    try{
      const [profils] = await Promise.all([refreshRosterProfiles(), Store.refresh()]);
      modaleEntrainement.profils = profils;
      modaleEntrainement.equipes = Store.all();
    }catch(erreur){
      toast("Membres ou équipes indisponibles hors ligne.", true);
      return;
    }
    modaleEntrainement.choix = {};
    if(run){
      Object.entries(run.equipes).forEach(([id, entree]) => {
        modaleEntrainement.choix[id] = entree.teamId || "";
      });
    }
    $("#trainingTitle").textContent = run ? "Corriger la run d’entraînement" : "Enregistrer une run d’entraînement";
    $("#trainingDate").value = run ? run.playedOn : dateParisEntrainement();
    $("#trainingDate").max = dateParisEntrainement();
    $("#trainingScore").value = run ? run.score : "";
    $("#trainingNote").value = run ? run.note : "";
    $("#trainingError").textContent = "";
    $("#trainingDelete").hidden = !run;
    mettreAJourCompteurEntrainement();
    dessinerMembresEntrainement();
    dessinerEquipesEntrainement();
    const overlay = $("#trainingOverlay");
    ModalStack.open(overlay, "#trainingDate", () => ModalStack.close(overlay));
  }

export { ouvrirSaisieEntrainement };
```

- [ ] **Step 5: Brancher la vue sur la modale**

Dans `js/vues/boss-entrainement.js` :
- ajouter l'import `import { ouvrirSaisieEntrainement } from "./modale-entrainement.js";`
- dans `carteRunEntrainement`, sur le bouton `.training-edit`, ajouter la propriété
  `onclick:()=>void ouvrirSaisieEntrainement(run, { apres:()=>renderTrainingView({ silencieux:true }) })`
- dans `brancherSousVuesEntrainement()`, en tête du corps après `sousVuesBranchees = true;` :

```js
    $("#trainingAdd").addEventListener("click", () =>
      void ouvrirSaisieEntrainement(null, { apres:()=>renderTrainingView({ silencieux:true }) }));
```

`tests/helpers/modules.js` : ajouter `  "vues/modale-entrainement.js",` **juste avant** `  "vues/boss-entrainement.js",`.
`sw.js` : ajouter `"./js/vues/modale-entrainement.js",` à côté de `"./js/vues/boss-entrainement.js",`.

`css/boss.css`, en fin de fichier :

```css
.training-form{display:grid;gap:8px}
.training-members{border:1px solid var(--line-soft);border-radius:10px;padding:8px;min-width:0}
#trainingMembers{display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:4px}
.training-member{display:flex;gap:8px;align-items:center;min-height:44px;cursor:pointer}
.training-member input{width:20px;height:20px}
.training-teams{display:grid;gap:8px}
.training-team-field{display:grid;gap:4px}
.training-team-field select,#trainingDate,#trainingScore{min-height:44px}
.training-actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.training-actions .btn{min-height:44px}
```

- [ ] **Step 6: Lancer les tests**

Run: `node tests/entrainement.playwright.js && node tests/modules-imports.test.js`
Expected: PASS ; `modules-imports` ne signale plus que les exports de progression/classement (Task 6).

- [ ] **Step 7: Commit**

```bash
git add index.html js/vues/modale-entrainement.js js/vues/boss-entrainement.js tests/helpers/modules.js sw.js css/boss.css tests/entrainement.playwright.js
git commit -m "feat(entrainement): saisie, correction et suppression d'une run"
```

---

### Task 6: Progression (SVG) et classement avec comparaison d'équipes

**Files:**
- Modify: `js/vues/boss-entrainement.js`
- Modify: `css/boss.css`
- Modify: `tests/entrainement.playwright.js`

**Interfaces:**
- Consumes: `serieProgressionEntrainement`, `resumeProgressionEntrainement`, `topRunsEntrainement`, `comparaisonEquipesEntrainement` (Task 2) ; `charOf` (`metier/catalogue.js`) pour les noms de héros ; `sessionCourante.rosterProfiles` (rempli par `refreshRosterProfiles()`).
- Produces: `#trainingProgressionMember` (select), `svg.training-chart` + `ol.training-points` (valeurs accessibles), `.training-summary` ; `ol.training-top > li[data-training-run-id]` ; `#trainingCompareMember` (select), `table.training-compare`.

- [ ] **Step 1: Étendre le parcours (il doit échouer)**

Dans `tests/entrainement.playwright.js`, après le bloc suppression :

```js
    /* --- Progression : trois points (tr-1, tr-2 + aucun autre), valeurs
       lisibles hors de la courbe. Aucune requête en changeant de sous-vue. --- */
    const appelsAvant = await page.evaluate(() => window.__fakeSupabaseState.calls.length);
    await page.locator('[data-training-vue="progression"]').click();
    await page.locator("svg.training-chart").waitFor();
    assert.equal(await page.locator("ol.training-points li").count(), 2);
    await page.locator("#trainingProgressionMember").selectOption("user-1");
    assert.equal(await page.locator("ol.training-points li").count(), 1);
    assert.match(await page.locator(".training-summary").textContent(), /Meilleur/);

    /* --- Classement : tr-1 en tête ; comparaison d'équipes de Yannis. --- */
    await page.locator('[data-training-vue="classement"]').click();
    assert.equal(await page.locator("ol.training-top li").first()
      .getAttribute("data-training-run-id"), "tr-1");
    await page.locator("#trainingCompareMember").selectOption("user-1");
    assert.equal(await page.locator("table.training-compare tbody tr").count(), 1);
    assert.match(await page.locator(".training-compare-caveat").textContent(),
      /score est celui du groupe/);
    assert.equal(await page.evaluate(() => window.__fakeSupabaseState.calls.length),
      appelsAvant, "changer de sous-vue ne doit faire aucune requête");

    /* Au clavier : Tab jusqu'à « Historique », Entrée. */
    await page.locator('[data-training-vue="historique"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator('[data-training-vue="historique"]')
      .getAttribute("aria-pressed"), "true");
```

- [ ] **Step 2: Lancer pour vérifier l'échec**

Run: `node tests/entrainement.playwright.js`
Expected: FAIL (timeout sur `svg.training-chart`).

- [ ] **Step 3: Implémenter les deux sous-vues**

Dans `js/vues/boss-entrainement.js` :

1. Compléter les imports :

```js
import { charOf } from "../metier/catalogue.js";
import {
  comparaisonEquipesEntrainement, resumeProgressionEntrainement,
  serieProgressionEntrainement, topRunsEntrainement, trierRunsEntrainement
} from "../metier/entrainement-boss.js";
```

(remplace l'ancien import limité à `trierRunsEntrainement`).

2. Ajouter à `etatEntrainement` : `membreProgression:"", membreComparaison:""`.

3. Ajouter, au-dessus de `SOUS_VUES_ENTRAINEMENT` :

```js
  const SVG_NS_ENTRAINEMENT = "http://www.w3.org/2000/svg";

  function svgEntrainement(tag, attributs){
    const noeud = document.createElementNS(SVG_NS_ENTRAINEMENT, tag);
    Object.entries(attributs || {}).forEach(([cle, valeur]) => noeud.setAttribute(cle, String(valeur)));
    return noeud;
  }

  function choixMembreEntrainement(id, libelle, valeur, avecTous, onChange){
    const profils = sessionCourante.rosterProfiles || [];
    const select = el("select",{ id },
      (avecTous ? [el("option",{ value:"", text:"Toute la confrérie" })] : [])
        .concat(profils.map(p => el("option",{ value:p.id, text:p.pseudo }))));
    select.value = valeur;
    select.addEventListener("change", () => onChange(select.value));
    return el("div",{class:"training-filter"},[el("label",{ for:id, text:libelle }), select]);
  }

  /* La courbe n'est qu'une aide visuelle : les valeurs sont aussi écrites
     dans la liste qui suit. Les pixels passent par Number — la précision
     n'y compte pas — mais jamais les valeurs affichées. */
  function courbeEntrainement(serie){
    const L = 640, H = 220, M = 24;
    const svg = svgEntrainement("svg",{ class:"training-chart", viewBox:"0 0 "+L+" "+H,
      role:"img", "aria-label":"Courbe des scores d’entraînement" });
    const valeurs = serie.map(p => Number(p.score));
    const max = Math.max(...valeurs, 1);
    const x = i => serie.length === 1 ? L / 2 : M + i * (L - 2 * M) / (serie.length - 1);
    const y = v => H - M - (v / max) * (H - 2 * M);
    svg.appendChild(svgEntrainement("line",{ x1:M, y1:H - M, x2:L - M, y2:H - M, class:"training-axis" }));
    if(serie.length > 1){
      svg.appendChild(svgEntrainement("polyline",{ class:"training-line",
        points:valeurs.map((v, i) => x(i)+","+y(v)).join(" ") }));
    }
    valeurs.forEach((v, i) => svg.appendChild(
      svgEntrainement("circle",{ class:"training-dot", cx:x(i), cy:y(v), r:4 })));
    return svg;
  }

  function vueProgressionEntrainement(runs){
    const serie = serieProgressionEntrainement(runs, etatEntrainement.membreProgression || null);
    const bloc = el("div",{class:"training-progression"},[
      choixMembreEntrainement("trainingProgressionMember", "Runs de", etatEntrainement.membreProgression, true,
        valeur => { etatEntrainement.membreProgression = valeur; dessinerEntrainement(); })
    ]);
    if(!serie.length){
      bloc.appendChild(el("p",{class:"empty-state",text:"Aucune run pour ce choix."}));
      return bloc;
    }
    const resume = resumeProgressionEntrainement(serie);
    bloc.appendChild(courbeEntrainement(serie));
    bloc.appendChild(el("p",{class:"training-summary",text:
      "Meilleur : "+formatBossScore(resume.meilleur)
      +" · Dernier : "+formatBossScore(resume.dernier)
      +" · Écart au meilleur : "+formatBossScore(resume.ecart)}));
    bloc.appendChild(el("ol",{class:"training-points"}, serie.map(point =>
      el("li",{ text:frDate(point.playedOn)+" : "+formatBossScore(point.score) }))));
    return bloc;
  }

  function nomsHerosEntrainement(heros){
    return heros.map(id => { const c = charOf(id); return c ? c.name : id; }).join(", ");
  }

  function vueClassementEntrainement(runs){
    const bloc = el("div",{class:"training-classement"});
    const top = topRunsEntrainement(runs, 10);
    bloc.appendChild(el("h2",{class:"training-subtitle",text:"Meilleures runs"}));
    bloc.appendChild(top.length
      ? el("ol",{class:"training-top"}, top.map(({ rang, run }) => {
          const carte = carteRunEntrainement(run);
          carte.insertBefore(el("span",{class:"training-rank","aria-label":"Rang "+rang,text:String(rang)}),
            carte.firstChild);
          return carte;
        }))
      : el("p",{class:"empty-state",text:"Aucune run à classer."}));

    const moi = sessionCourante.user ? sessionCourante.user.id : "";
    const membre = etatEntrainement.membreComparaison || moi;
    bloc.appendChild(el("h2",{class:"training-subtitle",text:"Comparaison des équipes"}));
    bloc.appendChild(choixMembreEntrainement("trainingCompareMember", "Équipes de", membre, false,
      valeur => { etatEntrainement.membreComparaison = valeur; dessinerEntrainement(); }));
    bloc.appendChild(el("p",{class:"training-compare-caveat",
      text:"Le score est celui du groupe : les autres participants y comptent aussi."}));
    const lignes = comparaisonEquipesEntrainement(runs, membre);
    bloc.appendChild(lignes.length
      ? el("div",{class:"training-compare-wrap"},[el("table",{class:"training-compare"},[
          el("thead",{},[el("tr",{},[
            el("th",{scope:"col",text:"Équipe"}), el("th",{scope:"col",text:"Runs"}),
            el("th",{scope:"col",text:"Meilleur"}), el("th",{scope:"col",text:"Médiane"})])]),
          el("tbody",{}, lignes.map(l => el("tr",{},[
            el("th",{scope:"row",text:nomsHerosEntrainement(l.heros)}),
            el("td",{text:String(l.runs)}),
            el("td",{text:formatBossScore(l.meilleur)}),
            el("td",{text:formatBossScore(l.mediane)})])))
        ])])
      : el("p",{class:"empty-state",text:"Aucune équipe renseignée pour ce membre."}));
    return bloc;
  }
```

4. Remplacer `SOUS_VUES_ENTRAINEMENT` (et retirer son commentaire « Tâche 6 remplacera… ») par :

```js
  const SOUS_VUES_ENTRAINEMENT = {
    historique:vueHistoriqueEntrainement,
    progression:vueProgressionEntrainement,
    classement:vueClassementEntrainement
  };
```

5. Dans `renderTrainingView`, avant `await EntrainementStore.refresh();`, charger les pseudos pour les filtres (lecture déjà faite par d'autres vues, sans coût notable) :

```js
      await refreshRosterProfiles();
```

avec l'import `import { refreshRosterProfiles } from "../donnees/roster-profils.js";`.

`css/boss.css`, en fin de fichier :

```css
.training-filter{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0}
.training-filter select{min-height:44px;max-width:100%}
.training-chart{width:100%;height:auto;max-height:260px;display:block}
.training-axis{stroke:var(--line);stroke-width:1}
.training-line{fill:none;stroke:var(--gold-bright);stroke-width:2}
.training-dot{fill:var(--gold-bright)}
.training-points{columns:2 14rem;color:var(--muted);font-size:.9rem}
.training-subtitle{margin:20px 0 8px;font-size:1.1rem}
.training-top{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.training-rank{font-weight:700;color:var(--gold-bright);margin-right:8px}
.training-compare-caveat{color:var(--muted);font-size:.85rem}
.training-compare-wrap{overflow-x:auto;max-width:100%}
.training-compare{border-collapse:collapse;width:100%;min-width:0}
.training-compare th,.training-compare td{padding:8px;border-bottom:1px solid var(--line-soft);text-align:left;overflow-wrap:anywhere}
```

- [ ] **Step 4: Lancer les tests**

Run: `node tests/entrainement.playwright.js && node tests/modules-imports.test.js && node tests/entrainement-boss.test.js`
Expected: tous verts ; `modules-imports` n'a **plus aucun** export orphelin.

- [ ] **Step 5: Commit**

```bash
git add js/vues/boss-entrainement.js css/boss.css tests/entrainement.playwright.js
git commit -m "feat(entrainement): progression et classement avec comparaison d'equipes"
```

---

### Task 7: Documentation et suite complète

**Files:**
- Modify: `AGENTS.md` (nouvelle section après « ## Groupes de Boss de Guilde », et mention dans « État actuel »)
- Modify: `js/ARCHITECTURE.md` (tables `metier/`, `donnees/`, `vues/`)

- [ ] **Step 1: `AGENTS.md`**

Ajouter après la section « Groupes de Boss de Guilde » :

```markdown
## Entraînement du boss de confrérie (sous-onglet « Entraînement »)

Le mode entraînement (2.1) se consigne dans `boss_training_runs`, **table
distincte** de `boss_sessions` : aucun quota, aucun groupe, aucun rappel, rien
dans « Mon suivi » ni dans « Meilleures runs ». Spec :
`docs/superpowers/specs/2026-09-22-entrainement-boss-design.md`.

- Une ligne par run : date, score global (le jeu ne donne pas de dégâts par
  membre), note ≤ 1000, 1 à 5 `participants`, et `equipes` par participant.
- Le client n'envoie que `teamId`. Le trigger
  `private.boss_training_runs_prepare` vérifie que l'équipe appartient au
  participant, **reconstruit** l'instantané depuis `teams` et le fige ; il pose
  aussi l'auteur, les pseudos et `updated_at`. Ne jamais faire confiance à un
  instantané venu du client.
- RLS : lecture par les membres ; écriture seulement par un participant,
  qui ne peut pas se retirer lui-même.
- Correction en comparaison-et-échange sur `updated_at` (chaîne opaque) :
  zéro ligne modifiée → `TRAINING_CONFLICT`.
- Scores lus en `global_score::text`, jamais en `number`.
- Trois sous-vues locales (Historique, Progression, Classement) : en changer
  ne fait **aucune** requête.

Après ce déploiement, rejouer `supabase/schema.sql` dans le SQL Editor
**avant** de pousser le frontend.
```

Dans « État actuel », ajouter une case :

```markdown
- [x] **Entraînement du boss de confrérie**. Sous-onglet du groupe Boss :
      saisie d'une run de groupe (1 à 5), équipes figées côté serveur,
      historique, progression en SVG, classement et comparaison d'équipes.
      Voir « Entraînement du boss de confrérie ».
```

- [ ] **Step 2: `js/ARCHITECTURE.md`**

Ajouter une ligne dans chacune des trois tables :
- `metier/` : `| entrainement-boss.js | Entraînement du boss : validation, progression, classement, comparaison |`
- `donnees/` : `| entrainement-store.js | Runs d'entraînement : lecture, écritures, conflit, cache |`
- `vues/` : `| modale-entrainement.js | La saisie d'une run d'entraînement |` et `| boss-entrainement.js | L'onglet Entraînement : historique, progression, classement |`

- [ ] **Step 3: Suite complète**

Run: `npm test`
Expected: toutes les suites au vert. Les trois tests connus pour être instables (`supabase-etape1`, `accessibilite-mobile`, `visiteur-anonyme`) se relancent une fois avant de conclure.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md js/ARCHITECTURE.md
git commit -m "docs(entrainement): documenter l'onglet et sa table"
```

- [ ] **Step 5: Rappel de mise en service (ne rien pousser)**

Signaler au propriétaire : 1) rejouer tout `supabase/schema.sql` dans le SQL
Editor ; 2) seulement ensuite, sur son accord, pousser `main` ; 3) attendre le
workflow Pages vert ; 4) accepter la mise à jour PWA.
