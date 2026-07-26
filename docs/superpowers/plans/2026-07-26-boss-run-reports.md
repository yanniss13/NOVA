# Boss Run Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter aux groupes de boss un maximum de cinq joueurs, une équipe
obligatoire par participant, un score global obligatoire, des rapports
corrigeables et un historique statistique fondé sur les runs réelles.

**Architecture:** Supabase reste l’autorité grâce à trois nouvelles RPC
atomiques et une table de rapports en lecture partagée. L’application statique
étend son `BossStore`, sa vue Boss et ses modales inline, puis réutilise le
détail d’équipe existant pour lire les instantanés. Toutes les évolutions SQL
sont additives ; un script séparé restaure les anciennes RPC sans supprimer
les données.

**Tech Stack:** HTML/CSS/JavaScript autonome, Supabase PostgreSQL/RLS/RPC/
Realtime, Node.js assertions, Playwright Chromium, Git/GitHub Pages.

## Global Constraints

- Interface et messages exclusivement en français.
- Conserver toute la logique runtime inline dans `index.html`.
- Aucun build ni nouvelle dépendance runtime.
- Un membre conserve exactement trois runs maximum par semaine.
- Un groupe contient entre un et cinq participants.
- Chaque participant doit choisir une de ses propres équipes avant la fin.
- Le score global est obligatoire, entier et strictement supérieur à zéro.
- Aucun champ difficulté, victoire/échec ou dégâts individuels.
- La note de run est facultative et limitée à 1 000 caractères.
- Après archivage, seuls score et note sont corrigeables, par un participant.
- Participants, équipes et instantanés deviennent immuables après archivage.
- Aucun `DROP TABLE`, `DROP COLUMN`, effacement ou migration destructive.
- La policy `boss_sessions_insert` autorise uniquement les seeds des six
  groupes courants (`run_no=1`, slots 1–6). Les autres écritures directes de
  boss restent interdites et le flux métier passe via RPC `security definer`.
- Les modales utilisent `ModalStack`, avec contrôles tactiles de 44 px.
- Aucun débordement horizontal entre 320 et 390 px.
- Ne pas fusionner ni pousser sans autorisation explicite de l’utilisateur.
- Spécification source :
  `docs/superpowers/specs/2026-07-26-boss-run-reports-design.md`.

---

## Préparation obligatoire de l’exécution

- [ ] Vérifier le point de départ.

```powershell
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Attendu : worktree principal propre. Noter explicitement tout écart avec
`origin/main` avant de continuer.

- [ ] Créer le point de sauvegarde demandé.

```powershell
git tag -a backup-before-boss-reports-2026-07-26 -m "Backup avant les rapports de boss"
git show --no-patch --decorate backup-before-boss-reports-2026-07-26
```

Attendu : le tag pointe sur le commit de spécification validé ou sur un
descendant ne contenant encore aucun code de la fonctionnalité. Ne pas pousser
le tag à cette étape.

- [ ] Utiliser `superpowers:using-git-worktrees` pour créer la branche
  `feature/boss-run-reports` dans un worktree isolé.

- [ ] Exécuter la base de référence dans ce worktree.

```powershell
npm test
```

Attendu : suite complète verte avant toute modification.

---

### Task 1: Enforce the Five-Player Capacity

**Files:**

- Modify: `tests/roster-schema.test.js`
- Modify: `supabase/schema.sql`

**Interfaces:**

- Consumes: `public.join_boss_run(p_session_id uuid)`.
- Produces: la même signature RPC, plus l’erreur stable `GROUP_FULL`.
- Preserves: `RUN_LIMIT_REACHED`, la limite hebdomadaire de trois et les
  validations de semaine/statut actuelles.

- [ ] **Step 1: Write the failing SQL contract**

Dans `tests/roster-schema.test.js`, extraire le corps de `join_boss_run` entre
sa déclaration et celle de `leave_boss_run`, puis ajouter :

```js
const joinBossRun = sql.slice(
  sql.indexOf("create or replace function public.join_boss_run"),
  sql.indexOf("create or replace function public.leave_boss_run")
);

assert.match(
  joinBossRun,
  /select\s+week_start,\s*status[\s\S]*from public\.boss_sessions[\s\S]*for update/i,
  "La session doit être verrouillée avant le contrôle de capacité"
);
assert.match(
  joinBossRun,
  /from public\.boss_participation[\s\S]*where session_id\s*=\s*p_session_id/i,
  "La capacité doit compter uniquement la session ciblée"
);
assert.match(
  joinBossRun,
  /if v_member_count\s*>=\s*5 then[\s\S]*GROUP_FULL/i,
  "Le sixième joueur doit être refusé"
);
assert.match(
  joinBossRun,
  /if v_week_count\s*>=\s*3 then[\s\S]*RUN_LIMIT_REACHED/i,
  "La limite personnelle de trois runs doit rester active"
);
```

Renommer l’ancien `v_count` en deux compteurs explicites dans le contrat :
`v_member_count` pour la session et `v_week_count` pour le membre.

- [ ] **Step 2: Run the test and confirm the right failure**

```powershell
node tests/roster-schema.test.js
```

Attendu : échec sur `v_member_count` ou `GROUP_FULL`, pas sur une assertion
historique.

- [ ] **Step 3: Add the server-side capacity check**

Dans `join_boss_run`, conserver le premier `SELECT ... FOR UPDATE` sur
`boss_sessions`. Après la vérification d’une participation existante et avant
l’insertion, ajouter :

```sql
select count(*)
  into v_member_count
  from public.boss_participation
 where session_id = p_session_id;

if v_member_count >= 5 then
  raise exception 'GROUP_FULL' using errcode = 'P0001';
end if;
```

Renommer le compteur hebdomadaire actuel :

```sql
select count(*)
  into v_week_count
  from public.boss_participation bp
  join public.boss_sessions bs on bs.id = bp.session_id
 where bp.owner = v_owner
   and bs.week_start = v_week;

if v_week_count >= 3 then
  raise exception 'RUN_LIMIT_REACHED' using errcode = 'P0001';
end if;
```

Déclarer les deux variables comme `integer`. Ne pas retirer le verrou
consultatif par membre : il protège toujours deux inscriptions simultanées du
même joueur sur des groupes différents.

- [ ] **Step 4: Verify the focused and unit suites**

```powershell
node tests/roster-schema.test.js
npm run test:unit
```

Attendu : succès complet.

- [ ] **Step 5: Commit the capacity change**

```powershell
git add supabase/schema.sql tests/roster-schema.test.js
git commit -m "feat: limit boss groups to five players"
```

---

### Task 2: Add Reports, Team Snapshots, Strict RPCs, and Rollback

**Files:**

- Create: `tests/boss-reports-schema.test.js`
- Create: `supabase/rollback-boss-reports.sql`
- Modify: `supabase/schema.sql`
- Modify: `package.json`

**Interfaces:**

- Produces:
  - `public.select_boss_team(uuid, uuid) returns void`
  - `public.complete_boss_run_with_report(uuid, bigint, text) returns void`
  - `public.update_boss_run_report(uuid, bigint, text) returns void`
  - `public.boss_run_reports`
  - `public.boss_participation.team_snapshot jsonb`
- Changes: `complete_boss_run(uuid)` retourne désormais `REPORT_REQUIRED`.
- Rollback: restaure exactement les anciennes fonctions `join_boss_run` et
  `complete_boss_run(uuid)` sans supprimer les objets additifs.

- [ ] **Step 1: Write the failing schema and rollback contract**

Créer `tests/boss-reports-schema.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const sql = fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");
const rollbackPath = path.join(ROOT, "supabase/rollback-boss-reports.sql");

[
  /create table if not exists public\.boss_run_reports/i,
  /session_id\s+uuid\s+primary key/i,
  /global_score\s+bigint\s+not null\s+check\s*\(\s*global_score\s*>\s*0\s*\)/i,
  /char_length\(note\)\s*<=\s*1000/i,
  /alter table public\.boss_participation add column if not exists team_snapshot jsonb/i,
  /create or replace function public\.select_boss_team\s*\(\s*p_session_id uuid\s*,\s*p_team_id uuid\s*\)/i,
  /create or replace function public\.complete_boss_run_with_report\s*\(\s*p_session_id uuid\s*,\s*p_global_score bigint\s*,\s*p_note text/i,
  /create or replace function public\.update_boss_run_report\s*\(\s*p_session_id uuid\s*,\s*p_global_score bigint\s*,\s*p_note text/i,
  /TEAM_REQUIRED/i,
  /INVALID_SCORE/i,
  /REPORT_REQUIRED/i,
  /create policy boss_reports_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /grant execute on function public\.select_boss_team\(uuid,\s*uuid\) to authenticated/i,
  /grant execute on function public\.complete_boss_run_with_report\(uuid,\s*bigint,\s*text\) to authenticated/i,
  /grant execute on function public\.update_boss_run_report\(uuid,\s*bigint,\s*text\) to authenticated/i
].forEach(pattern => assert.match(sql, pattern, "Contrat absent : " + pattern));

assert.doesNotMatch(
  sql,
  /create policy boss_reports_(insert|update|delete)/i,
  "Les rapports ne doivent jamais être écrits directement"
);
const realtime = sql.slice(sql.indexOf("-- ============================ Realtime"));
assert.match(
  realtime,
  /['"]boss_run_reports['"]/i,
  "Les rapports doivent être publiés en Realtime"
);

const correction = sql.slice(
  sql.indexOf("create or replace function public.update_boss_run_report"),
  sql.indexOf("-- boss_sessions :")
);
assert.match(correction, /updated_by\s*=\s*v_owner/i);
assert.match(correction, /updated_at\s*=\s*now\(\)/i);
assert.doesNotMatch(correction, /update public\.boss_sessions/i);
assert.doesNotMatch(correction, /update public\.boss_participation/i);

assert.ok(fs.existsSync(rollbackPath), "script de retour arrière manquant");
const rollback = fs.readFileSync(rollbackPath, "utf8");
assert.match(rollback, /create or replace function public\.join_boss_run/i);
assert.match(rollback, /create or replace function public\.complete_boss_run/i);
assert.match(rollback, /grant execute on function public\.complete_boss_run\(uuid\) to authenticated/i);
assert.match(
  rollback,
  /revoke all on function public\.select_boss_team\(uuid,\s*uuid\) from authenticated/i
);
assert.doesNotMatch(
  rollback,
  /\bdrop\s+(table|column)\b|\bdelete\s+from\b|\btruncate\b/i,
  "Le retour arrière ne doit effacer aucune donnée"
);
assert.doesNotMatch(
  rollback,
  /GROUP_FULL/i,
  "Le rollback doit restaurer l’ancienne capacité non limitée"
);
assert.match(rollback, /RUN_LIMIT_REACHED/i);

console.log("PASS rapports de boss : schéma, RPC, RLS et rollback");
```

Ajouter `node tests/boss-reports-schema.test.js` après
`tests/roster-schema.test.js` dans `test` et `test:unit`.

- [ ] **Step 2: Run the test and confirm it fails**

```powershell
node tests/boss-reports-schema.test.js
```

Attendu : échec `boss_run_reports` absent ou rollback manquant.

- [ ] **Step 3: Add the additive table and columns**

Après `boss_participation`, ajouter de manière idempotente :

```sql
alter table public.boss_participation
  add column if not exists team_snapshot jsonb;

create table if not exists public.boss_run_reports (
  session_id         uuid primary key
                     references public.boss_sessions(id) on delete cascade,
  global_score       bigint not null check (global_score > 0),
  note               text not null default ''
                     check (char_length(note) <= 1000),
  created_by         uuid references auth.users(id) on delete set null,
  created_by_pseudo  text not null,
  created_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null,
  updated_by_pseudo  text,
  updated_at         timestamptz
);

alter table public.boss_run_reports enable row level security;
drop policy if exists boss_reports_read on public.boss_run_reports;
create policy boss_reports_read
  on public.boss_run_reports
  for select to authenticated
  using (true);
```

Ne créer aucune policy directe `insert`, `update` ou `delete`.

- [ ] **Step 4: Implement `select_boss_team`**

La fonction doit verrouiller la session, vérifier `open`, semaine courante et
participation, puis sélectionner uniquement une équipe propriétaire :

```sql
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
 where t.id = p_team_id
   and t.owner = v_owner;

if v_snapshot is null then
  raise exception 'TEAM_NOT_OWNED' using errcode = 'P0001';
end if;

update public.boss_participation
   set team_id = p_team_id,
       team_snapshot = v_snapshot,
       updated_at = now()
 where session_id = p_session_id
   and owner = v_owner;

if not found then
  raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
end if;
```

Utiliser `security definer set search_path = public, pg_temp`. Le contrôle de
session se fait avant la lecture de l’équipe.

- [ ] **Step 5: Implement atomic completion with a report**

Créer `complete_boss_run_with_report`. Le corps doit :

```sql
select *
  into v_run
  from public.boss_sessions
 where id = p_session_id
 for update;

select count(*),
       count(*) filter (where team_snapshot is null),
       string_agg(pseudo, ', ') filter (where team_snapshot is null)
  into v_member_count, v_missing_count, v_missing_names
  from public.boss_participation
 where session_id = p_session_id;
```

Puis appliquer dans cet ordre :

```sql
if v_run.status <> 'open' then
  raise exception 'RUN_ARCHIVED' using errcode = 'P0001';
end if;
if not exists (
  select 1 from public.boss_participation
   where session_id = p_session_id and owner = v_owner
) then
  raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
end if;
if v_member_count < 1 then
  raise exception 'NOT_A_PARTICIPANT' using errcode = 'P0001';
end if;
if v_member_count > 5 then
  raise exception 'GROUP_OVER_CAPACITY' using errcode = 'P0001';
end if;
if v_missing_count > 0 then
  raise exception 'TEAM_REQUIRED:%', coalesce(v_missing_names, 'Membre')
    using errcode = 'P0001';
end if;
if p_global_score is null or p_global_score <= 0 then
  raise exception 'INVALID_SCORE' using errcode = 'P0001';
end if;
if char_length(coalesce(p_note, '')) > 1000 then
  raise exception 'NOTE_TOO_LONG' using errcode = 'P0001';
end if;
```

Lire le pseudo courant dans `profiles`, insérer le rapport, archiver la session
et créer `run_no + 1` avec les mêmes colonnes canoniques que la RPC actuelle.
Ne pas ajouter de gestionnaire d’exception : PostgreSQL doit annuler toute la
transaction si l’une des écritures échoue.

- [ ] **Step 6: Implement correction and retire the legacy completion**

`update_boss_run_report` verrouille le rapport et exige :

```sql
exists (
  select 1
    from public.boss_participation
   where session_id = p_session_id
     and owner = v_owner
)
```

Mettre à jour uniquement :

```sql
update public.boss_run_reports
   set global_score = p_global_score,
       note = btrim(coalesce(p_note, '')),
       updated_by = v_owner,
       updated_by_pseudo = coalesce(v_pseudo, 'Membre'),
       updated_at = now()
 where session_id = p_session_id;
```

Redéfinir l’ancienne fonction sans aucune écriture :

```sql
create or replace function public.complete_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'REPORT_REQUIRED' using errcode = 'P0001';
end;
$$;
```

- [ ] **Step 7: Add grants and Realtime**

Révoquer `public`, accorder `authenticated` aux trois nouvelles signatures,
puis ajouter `"boss_run_reports"` à la boucle idempotente de publication
Realtime.

- [ ] **Step 8: Create the non-destructive rollback**

Créer `supabase/rollback-boss-reports.sql` en copiant depuis le tag de
sauvegarde les définitions complètes de :

- `join_boss_run(uuid)` sans capacité maximale ;
- `complete_boss_run(uuid)` qui archive et crée la run suivante.

Terminer avec :

```sql
revoke all on function public.select_boss_team(uuid, uuid) from authenticated;
revoke all on function public.complete_boss_run_with_report(uuid, bigint, text) from authenticated;
revoke all on function public.update_boss_run_report(uuid, bigint, text) from authenticated;
revoke all on function public.complete_boss_run(uuid) from public;
grant execute on function public.complete_boss_run(uuid) to authenticated;
```

Le script ne retire ni table, ni colonne, ni rapport.

- [ ] **Step 9: Verify schema and unit tests**

```powershell
node tests/boss-reports-schema.test.js
npm run test:unit
git diff --check
```

Attendu : succès complet.

- [ ] **Step 10: Commit the database contract**

```powershell
git add supabase/schema.sql supabase/rollback-boss-reports.sql tests/boss-reports-schema.test.js package.json
git commit -m "feat: store boss run reports atomically"
```

---

### Task 3: Add Team Selection and Capacity UI

**Files:**

- Modify: `index.html`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**

- Consumes:
  - `select_boss_team(p_session_id, p_team_id)`
  - `Store.refresh()` and normalized teams
  - membership fields `team_id`, `team_snapshot`
- Produces:
  - `BossStore.selectTeam(sessionId, teamId)`
  - `openBossTeamPicker(group, member)`
  - modal `#bossTeamOverlay`
  - visual states `Équipe prête` / `Équipe manquante`

- [ ] **Step 1: Extend the fake Supabase and write failing browser assertions**

Dans l’état de `tests/supabase-etape1.playwright.js`, ajouter :

```js
boss_run_reports: []
```

Étendre les participations avec :

```js
team_id:null,
team_snapshot:null
```

Dans le faux `join_boss_run`, compter les participations de la session et
retourner `GROUP_FULL` à cinq.

Ajouter le faux RPC `select_boss_team` qui :

- refuse une run archivée ;
- exige une participation du compte courant ;
- trouve `team.id === p_team_id && team.owner === owner` ;
- retourne `TEAM_NOT_OWNED` sinon ;
- copie profondément `id`, `owner`, `pseudo`, `data`, `created_at`,
  `updated_at` et un `capturedAt` fixe dans la participation.

Écrire les assertions UI suivantes avant le code :

```js
assert.match(await groupCard.textContent(), /1\/5 joueurs/);
assert.match(await groupCard.textContent(), /Équipe manquante/);
await groupCard.getByRole("button", { name:"Choisir mon équipe" }).click();
await page.locator("#bossTeamOverlay").waitFor({ state:"visible" });
assert.equal(
  await page.locator("#bossTeamList .boss-team-choice").count(),
  await page.evaluate(() =>
    window.__fakeSupabaseState.teams.filter(t => t.owner === "user-1").length
  )
);
```

Après choix :

```js
assert.match(await groupCard.textContent(), /Équipe prête/);
assert.equal(
  await page.evaluate(() =>
    window.__fakeSupabaseState.rpcCalls.at(-1).name
  ),
  "select_boss_team"
);
```

Créer également une session avec cinq faux participants et vérifier `5/5`,
bouton rejoindre désactivé et erreur RPC `GROUP_FULL` pour le sixième.

- [ ] **Step 2: Run the focused test and confirm failure**

```powershell
node tests/supabase-etape1.playwright.js
```

Attendu : échec sur `#bossTeamOverlay` ou `1/5 joueurs`.

- [ ] **Step 3: Add the accessible team picker modal**

Ajouter avant `#toast` :

```html
<div class="overlay" id="bossTeamOverlay" role="dialog" aria-modal="true"
     aria-labelledby="bossTeamTitle" aria-hidden="true">
  <div class="modal boss-team-modal">
    <div class="modal-head">
      <h2 id="bossTeamTitle">Choisir mon équipe</h2>
      <button class="icon-btn" id="bossTeamClose" type="button"
              aria-label="Fermer">×</button>
    </div>
    <div class="boss-team-list" id="bossTeamList"></div>
  </div>
</div>
```

Chaque `.boss-team-choice` montre quatre portraits/noms et la date de dernière
modification. Aucun titre d’équipe fictif n’est ajouté.

- [ ] **Step 4: Extend BossStore and membership reads**

Modifier la sélection :

```js
.select("session_id,owner,pseudo,team_id,team_snapshot")
```

Ajouter :

```js
async selectTeam(sessionId, teamId){
  if(!currentUser || !sb) throw new Error("AUTH_REQUIRED");
  const { error } = await sb.rpc("select_boss_team", {
    p_session_id:sessionId,
    p_team_id:teamId
  });
  if(error) throw error;
}
```

- [ ] **Step 5: Implement picker behavior**

`openBossTeamPicker(group, member)` doit :

1. appeler `Store.refresh()` ;
2. filtrer `team.owner === currentUser.id` ;
3. afficher un état vide avec bouton vers l’onglet Builder si nécessaire ;
4. ouvrir avec `ModalStack.open`;
5. envoyer la sélection par `BossStore.selectTeam`;
6. désactiver la tuile pendant la RPC ;
7. fermer et recharger silencieusement la vue Boss en succès ;
8. conserver la modale et afficher un toast en erreur.

Le détail d’un snapshot se reconstruit ainsi :

```js
function teamFromBossSnapshot(snapshot){
  if(!snapshot || typeof snapshot !== "object") return null;
  return normalizeTeam(Object.assign({}, snapshot.data || {}, {
    id:snapshot.id || snapshot.teamId || "",
    pseudo:snapshot.pseudo || ""
  }));
}
```

- [ ] **Step 6: Render capacity and readiness**

Sur chaque carte :

```js
text:members.length+"/5 joueurs"
```

Pour chaque membre, afficher son pseudo et un libellé prêt/manquant. Pour le
membre connecté, afficher `Choisir mon équipe` ou `Changer`.

Un non-membre ne peut plus rejoindre si `members.length >= 5`; un membre
inscrit conserve `Quitter`. Ajouter les traductions `GROUP_FULL`,
`TEAM_NOT_OWNED` et `NOT_A_PARTICIPANT` dans `bossActionMessage`.

- [ ] **Step 7: Verify team selection and existing boss behavior**

```powershell
node tests/supabase-etape1.playwright.js
npm run test:e2e
```

Attendu : sélection propriétaire, instantané et capacité passent ; les tests
d’adhésion optimiste restent verts.

- [ ] **Step 8: Commit the selection flow**

```powershell
git add index.html tests/supabase-etape1.playwright.js
git commit -m "feat: select teams for boss runs"
```

---

### Task 4: Complete, Correct, and Display Run Reports

**Files:**

- Modify: `index.html`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**

- Consumes:
  - `complete_boss_run_with_report(uuid, bigint, text)`
  - `update_boss_run_report(uuid, bigint, text)`
  - `boss_run_reports`
  - `teamFromBossSnapshot(snapshot)`
- Produces:
  - `BossStore.listReports()`
  - `BossStore.complete(sessionId, globalScore, note)`
  - `BossStore.updateReport(sessionId, globalScore, note)`
  - `openBossReport(group, mode)`
  - `bossStatsForWeek(groups, reports, weekStart)`
  - modal `#bossReportOverlay`

- [ ] **Step 1: Extend the fake RPCs and write failing completion tests**

Remplacer le faux `complete_boss_run` par :

- `complete_boss_run` retourne toujours `REPORT_REQUIRED`;
- `complete_boss_run_with_report` exige :
  - appelant participant ;
  - run ouverte ;
  - 1 à 5 participants ;
  - chaque `team_snapshot` présent ;
  - `p_global_score` entier supérieur à zéro ;
  - note de 1 000 caractères maximum ;
- en succès, créer une ligne `boss_run_reports`, archiver et créer la suivante.

Ajouter `update_boss_run_report` qui exige un rapport et une participation
archivée, puis modifie seulement score/note/audit.

Adapter les anciens cas Boss du même fichier :

- l’appel direct à `complete_boss_run` attend désormais `REPORT_REQUIRED`;
- la double terminaison réutilise `complete_boss_run_with_report` et vérifie
  `RUN_ARCHIVED`;
- le cas non-membre appelle la nouvelle RPC et attend
  `NOT_A_PARTICIPANT`;
- l’ancienne assertion « passe par complete_boss_run » attend maintenant
  `complete_boss_run_with_report` avec les trois arguments exacts.

Écrire le parcours :

```js
await groupCard.getByRole("button", { name:"Run terminée" }).click();
await page.locator("#bossReportOverlay").waitFor({ state:"visible" });
assert.equal(await page.locator("#bossReportSubmit").isDisabled(), true);
await page.locator("#bossScore").fill("12450800");
assert.equal(await page.locator("#bossReportSubmit").isDisabled(), false);
await page.locator("#bossReportNote").fill("Rotation propre.");
await page.locator("#bossReportSubmit").click();
```

Puis vérifier :

```js
assert.equal(state.boss_run_reports.length, 1);
assert.equal(state.boss_run_reports[0].global_score, 12450800);
assert.equal(state.boss_sessions.find(r => r.id === archivedId).status, "archived");
assert.equal(state.boss_sessions.filter(r => r.slot === 2 && r.run_no === 2).length, 1);
```

Ajouter des cas séparés `TEAM_REQUIRED`, `INVALID_SCORE`, double soumission et
formulaire conservé après une erreur RPC simulée.

- [ ] **Step 2: Run the browser test and confirm failure**

```powershell
node tests/supabase-etape1.playwright.js
```

Attendu : échec car la modale ou le nouveau RPC n’existe pas.

- [ ] **Step 3: Add the report modal**

Ajouter :

```html
<div class="overlay" id="bossReportOverlay" role="dialog" aria-modal="true"
     aria-labelledby="bossReportTitle" aria-hidden="true">
  <div class="modal boss-report-modal">
    <div class="modal-head">
      <h2 id="bossReportTitle">Terminer la run</h2>
      <button class="icon-btn" id="bossReportClose" type="button"
              aria-label="Fermer">×</button>
    </div>
    <div class="boss-report-body">
      <div id="bossReportMembers"></div>
      <label for="bossScore">Score global</label>
      <input id="bossScore" type="text" inputmode="numeric"
             autocomplete="off" aria-describedby="bossReportError">
      <label for="bossReportNote">Note de run</label>
      <textarea id="bossReportNote" maxlength="1000"></textarea>
      <div id="bossReportCount">0/1000</div>
      <p id="bossReportError" role="alert"></p>
      <button class="btn btn-primary" id="bossReportSubmit" type="button">
        Enregistrer et terminer la run
      </button>
    </div>
  </div>
</div>
```

La même modale sert en mode `complete` et `edit`. En mode correction, le titre
devient `Corriger le rapport` et le bouton `Enregistrer la correction`.

- [ ] **Step 4: Extend BossStore and view state**

Ajouter `reports:[]` dans `emptyBossViewState`. Implémenter :

```js
async listReports(){
  if(!currentUser || !sb) return [];
  const { data, error } = await sb.from("boss_run_reports")
    .select("*")
    .order("created_at", { ascending:false });
  if(error) throw error;
  return data || [];
},
async complete(sessionId, globalScore, note){
  const { error } = await sb.rpc("complete_boss_run_with_report", {
    p_session_id:sessionId,
    p_global_score:globalScore,
    p_note:note
  });
  if(error) throw error;
},
async updateReport(sessionId, globalScore, note){
  const { error } = await sb.rpc("update_boss_run_report", {
    p_session_id:sessionId,
    p_global_score:globalScore,
    p_note:note
  });
  if(error) throw error;
}
```

Charger sessions, participations et rapports dans le même cycle de
`renderBossView`, puis appliquer ensemble un résultat seulement si le
`renderId` est encore courant.

- [ ] **Step 5: Implement validation and modal submission**

Valider le score comme chaîne :

```js
const SCORE_RE = /^[1-9]\d*$/;
function validBossScore(value){
  if(!SCORE_RE.test(String(value || "").trim())) return false;
  try{
    const score = BigInt(String(value).trim());
    return score > 0n && score <= BigInt(Number.MAX_SAFE_INTEGER);
  }catch(error){
    return false;
  }
}
```

Envoyer la chaîne numérique à Supabase pour éviter une conversion prématurée.
Le bouton est désactivé si le score est invalide, si une équipe manque ou si
une soumission est en cours.

En erreur, remplir `#bossReportError`, conserver les champs et réactiver le
bouton. En succès, fermer via `ModalStack`, invalider les rendus et relire la
vue.

- [ ] **Step 6: Render reports, details, and correction**

Associer les rapports par `session_id`. Pour une archive avec rapport :

- afficher score formaté avec `Intl.NumberFormat("fr-FR")`;
- afficher note, auteur/date et correction éventuelle ;
- afficher les participants et `Voir l’équipe`;
- passer `teamFromBossSnapshot(member.team_snapshot)` à `openTeamDetail`;
- montrer `Corriger le rapport` seulement si le compte courant appartenait à
  cette session.

Sans rapport, afficher exactement :

```text
Rapport non disponible pour cette ancienne run.
```

- [ ] **Step 7: Add pure weekly statistics**

Implémenter :

```js
function bossStatsForWeek(groups, reports, weekStart){
  const ids = new Set(groups
    .filter(group => group.week_start === weekStart)
    .map(group => group.id));
  const rows = reports.filter(report => ids.has(report.session_id));
  const scores = rows.map(report => BigInt(String(report.global_score)));
  const sum = scores.reduce((total, score) => total + score, 0n);
  return {
    count:scores.length,
    best:scores.length ? scores.reduce((a,b) => a > b ? a : b) : null,
    average:scores.length ? (sum + BigInt(Math.floor(scores.length / 2))) /
      BigInt(scores.length) : null,
    latest:rows[0] || null
  };
}
```

Trier `rows` par `completed_at` de leur session avant de choisir `latest`.
Afficher les quatre valeurs de la semaine et la différence de moyenne avec la
semaine précédente uniquement si les deux moyennes existent.

- [ ] **Step 8: Test correction permissions and immutable snapshots**

Dans Playwright :

1. modifier l’équipe source après archivage ;
2. ouvrir `Voir l’équipe` et vérifier que l’ancien héros/équipement apparaît ;
3. corriger score et note en tant que participant ;
4. vérifier `updated_by`, `updated_at`, participants et snapshot inchangés ;
5. basculer le faux compte vers un non-participant et vérifier l’absence du
   bouton de correction ;
6. ajouter une archive sans rapport et vérifier le message historique.

Ajouter deux rapports à la semaine courante et un à la semaine précédente,
puis vérifier le nombre, le meilleur score, la moyenne arrondie, le dernier
score et l’évolution de moyenne. Avec une semaine précédente vide, vérifier
que l’évolution n’est pas rendue.

- [ ] **Step 9: Verify focused end-to-end tests**

```powershell
node tests/supabase-etape1.playwright.js
npm run test:e2e
git diff --check
```

Attendu : succès complet.

- [ ] **Step 10: Commit reports and history**

```powershell
git add index.html tests/supabase-etape1.playwright.js
git commit -m "feat: complete and review boss run reports"
```

---

### Task 5: Add Realtime, Mobile, and Failure Regressions

**Files:**

- Modify: `index.html`
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `tests/accessibilite-mobile.playwright.js`

**Interfaces:**

- Consumes: table Realtime `boss_run_reports`, both boss modals.
- Produces: synchronized report refresh, mobile and accessibility guarantees.

- [ ] **Step 1: Write failing Realtime and mobile assertions**

Dans le test Supabase :

```js
assert.ok(
  await page.evaluate(() =>
    window.__fakeSupabaseState.realtimeTables.includes("boss_run_reports")
  ),
  "Realtime doit écouter les rapports"
);
```

Ajouter `realtimeTables:[]` dans l’état du faux backend. Dans son double
`channel.on("postgres_changes", config, callback)`, ajouter une seule fois
`config.table` à ce tableau avant d’enregistrer le callback.

Émettre rapidement une mise à jour de `boss_participation`, une insertion de
`boss_run_reports` et une mise à jour de `boss_sessions`; vérifier qu’un seul
cycle final de lecture Boss est appliqué et que le score affiché est le plus
récent.

Dans le test Supabase authentifié, ouvrir réellement chaque nouvelle modale à
320 et 390 px et vérifier le piège/restitution du focus. Dans
`tests/accessibilite-mobile.playwright.js`, révéler temporairement les deux
overlays par leurs classes/attributs uniquement pour mesurer leur géométrie,
puis vérifier :

```js
assert.ok(
  await page.evaluate(() =>
    document.scrollingElement.scrollWidth -
    document.scrollingElement.clientWidth
  ) <= 1
);
```

Vérifier aussi 44 px pour fermeture, choix d’équipe et validation, piège à
focus, Échap et restitution au bouton déclencheur.

- [ ] **Step 2: Run tests and confirm failure**

```powershell
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Attendu : au moins l’écoute Realtime ou l’ouverture mobile échoue.

- [ ] **Step 3: Wire Realtime**

Ajouter `"boss_run_reports"` à `RealtimeSync.tables`. Dans `schedule(table)`,
traiter cette table comme `boss_sessions` et `boss_participation` :

```js
if(
  table === "boss_sessions" ||
  table === "boss_participation" ||
  table === "boss_run_reports"
){
  pending.add("boss");
}
```

Conserver le debounce existant de 120 ms et les gardes `renderId`.

- [ ] **Step 4: Complete responsive and accessible CSS**

Les deux modales :

- `width:min(...,100%)`;
- corps défilable verticalement ;
- `min-width:0` sur les enfants flex/grid ;
- score et note limités à la largeur disponible ;
- boutons au moins 44 × 44 px ;
- portraits et textes avec `overflow-wrap:anywhere`;
- aucune nouvelle barre visible.

Le champ score utilise un libellé réel, `aria-describedby` pour l’erreur et
`aria-invalid="true"` lorsqu’il est incorrect. Le compteur de note est
`aria-live="polite"` seulement à l’approche de la limite pour éviter le bruit.

- [ ] **Step 5: Add error-message regressions**

Tester les traductions exactes :

- `GROUP_FULL`;
- `GROUP_OVER_CAPACITY`;
- `TEAM_REQUIRED:Yannis, Arthur`;
- `INVALID_SCORE`;
- `TEAM_NOT_OWNED`;
- `NOT_A_PARTICIPANT`;
- `REPORT_REQUIRED`;
- `REPORT_NOT_FOUND`;
- `NOTE_TOO_LONG`.

Vérifier qu’une erreur de fin de run ne ferme pas la modale et ne crée ni
rapport, ni archive, ni run suivante.

- [ ] **Step 6: Run all browser tests**

```powershell
npm run test:e2e
```

Attendu : tous les parcours Playwright passent sans `pageerror`.

- [ ] **Step 7: Commit synchronization and mobile polish**

```powershell
git add index.html tests/supabase-etape1.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "test: harden boss reports on realtime and mobile"
```

---

### Task 6: Document Operations and Verify the Release

**Files:**

- Modify: `AGENTS.md`
- Reference: `docs/superpowers/specs/2026-07-26-boss-run-reports-design.md`
- Reference: `supabase/rollback-boss-reports.sql`

**Interfaces:**

- Documents: modèle, RPC, limite 1–5, rapport/correction, déploiement et rollback.
- Produces: une branche vérifiée, non fusionnée et non poussée.

- [ ] **Step 1: Update AGENTS.md**

Dans l’état actuel et la section Boss, documenter :

- groupes de 1 à 5 ;
- trois runs hebdomadaires inchangées ;
- équipe propriétaire obligatoire et instantané immuable ;
- score global obligatoire, note facultative ;
- correction score/note par tout participant archivé ;
- `boss_run_reports`, les trois nouvelles RPC et Realtime ;
- anciennes archives sans rapport ;
- ordre de maintenance :
  1. SQL,
  2. fusion/push,
  3. workflow Pages,
  4. mise à jour PWA ;
- rollback :
  1. `supabase/rollback-boss-reports.sql`,
  2. `git revert`,
  3. push.

Retirer `Champ note globale d’équipe` de cette documentation uniquement si son
état réel change — cette fonctionnalité reste hors périmètre.

- [ ] **Step 2: Run the complete verification**

Utiliser `superpowers:verification-before-completion`, puis :

```powershell
npm test
git diff --check
git status --short
```

Attendu :

- tous les tests Node, Python et Playwright réussissent ;
- aucune erreur d’espaces ;
- seul `AGENTS.md` reste non commité.

- [ ] **Step 3: Commit the operational documentation**

```powershell
git add AGENTS.md
git commit -m "docs: explain boss run reports and rollback"
```

- [ ] **Step 4: Request code review**

Utiliser `superpowers:requesting-code-review`. La revue doit vérifier en
priorité :

- ordre des verrous et absence de sixième participant ;
- atomicité rapport/archive/run suivante ;
- impossibilité de corriger équipes ou participants ;
- RLS et privilèges ;
- script de rollback non destructif ;
- coexistence des archives historiques ;
- focus et débordement mobile.

Corriger chaque constat valide avec test de régression et commit séparé.

- [ ] **Step 5: Re-run final evidence**

```powershell
npm test
git diff --check
git status --short
git log --oneline --decorate -10
git show --no-patch --decorate backup-before-boss-reports-2026-07-26
```

Attendu : suite verte, worktree propre, tag de sauvegarde visible.

- [ ] **Step 6: Stop before external changes**

Ne pas exécuter `supabase/schema.sql`, ne pas fusionner et ne pas pousser.
Présenter à l’utilisateur :

- résumé des changements ;
- preuves de tests ;
- liste des commits ;
- SHA du tag de sauvegarde ;
- procédure de validation locale ;
- fenêtre de maintenance nécessaire ;
- ordre exact SQL → fusion/push → Pages ;
- ordre exact rollback SQL → revert → push.

L’intégration ultérieure doit utiliser
`superpowers:finishing-a-development-branch`.
