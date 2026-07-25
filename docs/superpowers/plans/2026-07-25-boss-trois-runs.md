# Boss de guilde — trois runs par joueur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limiter chaque membre à trois runs de boss par semaine, archiver chaque run terminée avec ses participants, rouvrir immédiatement le même groupe sur la run suivante et adapter le rappel Discord au nombre de runs manquantes.

**Architecture:** Supabase reste la source de vérité. Trois fonctions PostgreSQL atomiques (`join_boss_run`, `leave_boss_run`, `complete_boss_run`) remplacent les écritures directes et protègent la limite même avec deux appareils. L’interface inline de `index.html` affiche uniquement la run ouverte de chaque groupe, calcule le compteur sur toutes les runs de la semaine et rend les runs archivées en lecture seule.

**Tech Stack:** HTML/CSS/JavaScript sans build, Supabase JS v2, PostgreSQL/PL/pgSQL avec RLS, Node.js `node:assert`, Playwright Chromium, GitHub Actions/Discord webhook.

## Global Constraints

- La semaine de boss va du lundi 9 h Europe/Paris au lundi suivant.
- Il y a toujours six groupes ouverts simultanément.
- Une inscription ouverte ou une participation archivée compte dans la limite de `3/3`.
- Quitter une run ouverte libère une participation ; une run archivée est définitive.
- Tout membre inscrit dans une run ouverte peut la terminer.
- Terminer une run crée exactement une run suivante, vide, pour le même numéro de groupe.
- L’interface, les erreurs et le rappel Discord restent en français.
- La logique applicative reste inline dans `index.html` et aucune dépendance runtime n’est ajoutée.
- Le schéma doit rester réexécutable en entier dans le SQL Editor Supabase.
- `boss_participation` n’est modifiable directement par aucun client authentifié ; les écritures passent uniquement par les RPC.
- La validation finale doit inclure les largeurs mobiles `320`, `360` et `390` px.

## File Map

- Modify: `supabase/schema.sql` — migration idempotente, contrainte d’unicité, fonctions atomiques et politiques RLS.
- Modify: `tests/roster-schema.test.js` — contrat statique du schéma et interdiction des anciennes politiques d’écriture.
- Modify: `scripts/reminder-core.js` — calcul pur des runs manquantes et texte Discord.
- Modify: `scripts/discord-reminder.js` — utilisation du nouveau calcul pour toutes les participations de la semaine.
- Modify: `tests/reminder.test.js` — cas `0/3`, `1/3`, `2/3`, `3/3` et grammaire du message.
- Modify: `tests/supabase-etape1.playwright.js` — faux RPC Supabase et parcours navigateur complet.
- Modify: `index.html` — magasin boss, compteur `X/3`, actions, archivage et styles.
- Modify: `AGENTS.md` — documentation de la règle des trois runs et de la migration Supabase.

---

### Task 1: Verrouiller les trois runs dans Supabase

**Files:**
- Modify: `tests/roster-schema.test.js:22-36`
- Modify: `supabase/schema.sql:89-150`

**Interfaces:**
- Consumes: `auth.uid()`, `public.profiles(id, pseudo)`, `public.boss_sessions`, `public.boss_participation`.
- Produces: `join_boss_run(p_session_id uuid) returns void`, `leave_boss_run(p_session_id uuid) returns void`, `complete_boss_run(p_session_id uuid) returns void`.
- Produces: colonnes `boss_sessions.run_no integer` et `boss_sessions.completed_at timestamptz`.

- [ ] **Step 1: Écrire le contrat de schéma qui échoue**

Remplacer le bloc « Sessions de boss » de `tests/roster-schema.test.js` par :

```js
// Sessions de boss : trois runs atomiques par membre et par semaine.
[
  /create table if not exists public\.boss_sessions/i,
  /create table if not exists public\.boss_participation/i,
  /run_no\s+integer\s+not null\s+default\s+1/i,
  /completed_at\s+timestamptz/i,
  /primary key\s*\(\s*session_id\s*,\s*owner\s*\)/i,
  /create unique index if not exists boss_sessions_week_slot_run_idx[\s\S]*\(\s*week_start\s*,\s*slot\s*,\s*run_no\s*\)/i,
  /create unique index if not exists boss_sessions_one_open_slot_idx[\s\S]*\(\s*week_start\s*,\s*slot\s*\)[\s\S]*where\s+status\s*=\s*'open'/i,
  /create or replace function public\.join_boss_run\s*\(\s*p_session_id uuid\s*\)/i,
  /create or replace function public\.leave_boss_run\s*\(\s*p_session_id uuid\s*\)/i,
  /create or replace function public\.complete_boss_run\s*\(\s*p_session_id uuid\s*\)/i,
  /join_boss_run[\s\S]*pg_advisory_xact_lock[\s\S]*RUN_LIMIT_REACHED/i,
  /complete_boss_run[\s\S]*for update[\s\S]*status\s*=\s*'archived'[\s\S]*run_no\s*\+\s*1/i,
  /security definer\s+set search_path\s*=\s*public\s*,\s*pg_temp/i,
  /alter table public\.boss_sessions\s+enable row level security/i,
  /alter table public\.boss_participation enable row level security/i,
  /create policy boss_sessions_insert[\s\S]*with check[\s\S]*created_by\s*=\s*auth\.uid\(\)[\s\S]*run_no\s*=\s*1[\s\S]*slot\s+between\s+1\s+and\s+6/i,
  /create policy boss_part_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /grant execute on function public\.join_boss_run\(uuid\) to authenticated/i,
  /grant execute on function public\.leave_boss_run\(uuid\) to authenticated/i,
  /grant execute on function public\.complete_boss_run\(uuid\) to authenticated/i
].forEach(pattern => assert.match(sql, pattern));

assert.doesNotMatch(sql, /create policy boss_sessions_update/i);
assert.doesNotMatch(sql, /create policy boss_sessions_delete/i);
assert.doesNotMatch(sql, /create policy boss_part_insert/i);
assert.doesNotMatch(sql, /create policy boss_part_update/i);
assert.doesNotMatch(sql, /create policy boss_part_delete/i);
```

- [ ] **Step 2: Lancer le test et constater l’échec**

Run:

```bash
node tests/roster-schema.test.js
```

Expected: FAIL sur `run_no`, `boss_sessions_week_slot_run_idx` ou `join_boss_run`, car le schéma actuel ne possède pas encore le nouveau contrat.

- [ ] **Step 3: Migrer les colonnes et l’index unique**

Dans `supabase/schema.sql`, ajouter les deux colonnes à la création de `boss_sessions`, puis conserver la migration idempotente :

```sql
  run_no       integer not null default 1,      -- run du groupe pendant la semaine
  completed_at timestamptz,                     -- fin définitive de cette run
```

```sql
alter table public.boss_sessions add column if not exists run_no       integer not null default 1;
alter table public.boss_sessions add column if not exists completed_at timestamptz;

drop index if exists public.boss_sessions_week_slot_idx;
create unique index if not exists boss_sessions_week_slot_run_idx
  on public.boss_sessions(week_start, slot, run_no);
create unique index if not exists boss_sessions_one_open_slot_idx
  on public.boss_sessions(week_start, slot)
  where status = 'open';
```

Mettre à jour le commentaire : une ligne `boss_sessions` représente une run précise, pas un groupe permanent.

- [ ] **Step 4: Ajouter la RPC atomique d’inscription**

Ajouter avant les politiques RLS :

```sql
create or replace function public.join_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_week date;
  v_status text;
  v_count integer;
  v_pseudo text;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select week_start, status
    into v_week, v_status
    from public.boss_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status <> 'open' then
    raise exception 'RUN_ARCHIVED' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.boss_participation
     where session_id = p_session_id and owner = v_owner
  ) then
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_owner::text || ':' || v_week::text, 0)
  );

  select count(*)
    into v_count
    from public.boss_participation bp
    join public.boss_sessions bs on bs.id = bp.session_id
   where bp.owner = v_owner
     and bs.week_start = v_week;

  if v_count >= 3 then
    raise exception 'RUN_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select nullif(trim(pseudo), '')
    into v_pseudo
    from public.profiles
   where id = v_owner;

  insert into public.boss_participation(session_id, owner, pseudo, updated_at)
  values (p_session_id, v_owner, coalesce(v_pseudo, 'Membre'), now())
  on conflict (session_id, owner) do nothing;
end;
$$;
```

Le verrou advisory est indexé par membre et par semaine : deux inscriptions concurrentes du même membre sont sérialisées avant le comptage.

- [ ] **Step 5: Ajouter les RPC de départ et de fin**

Ajouter :

```sql
create or replace function public.leave_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_status text;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select status
    into v_status
    from public.boss_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status <> 'open' then
    raise exception 'RUN_ARCHIVED' using errcode = 'P0001';
  end if;

  delete from public.boss_participation
   where session_id = p_session_id
     and owner = v_owner;
end;
$$;

create or replace function public.complete_boss_run(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := auth.uid();
  v_run public.boss_sessions%rowtype;
begin
  if v_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = 'P0001';
  end if;

  select *
    into v_run
    from public.boss_sessions
   where id = p_session_id
   for update;

  if not found then
    raise exception 'RUN_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_run.status <> 'open' then
    return;
  end if;
  if not exists (
    select 1 from public.boss_participation
     where session_id = p_session_id
       and owner = v_owner
  ) then
    raise exception 'RUN_MEMBERS_ONLY' using errcode = 'P0001';
  end if;

  update public.boss_sessions
     set status = 'archived',
         completed_at = now()
   where id = p_session_id;

  insert into public.boss_sessions(
    created_by, title, boss_name, session_date, week_start, slot,
    run_no, elements, status, created_at
  )
  values (
    v_owner, 'Groupe ' || v_run.slot, v_run.boss_name, v_run.session_date,
    v_run.week_start, v_run.slot, v_run.run_no + 1, v_run.elements, 'open', now()
  )
  on conflict (week_start, slot, run_no) do nothing;
end;
$$;
```

Le retour silencieux si la session est déjà archivée rend un double clic idempotent ; l’index `(week_start, slot, run_no)` interdit aussi deux runs suivantes identiques.

- [ ] **Step 6: Fermer les écritures directes avec RLS et accorder les RPC**

Conserver `boss_sessions_read` et `boss_part_read`. Recréer
`boss_sessions_insert` avec une vérification limitée aux six runs initiales :

```sql
create policy boss_sessions_insert
  on public.boss_sessions
  for insert
  to authenticated
  with check (
    created_by = auth.uid()
    and run_no = 1
    and slot between 1 and 6
    and status = 'open'
    and completed_at is null
  );
```

Supprimer la recréation des cinq politiques d’écriture directe et ajouter :

```sql
revoke all on function public.join_boss_run(uuid) from public;
revoke all on function public.leave_boss_run(uuid) from public;
revoke all on function public.complete_boss_run(uuid) from public;
grant execute on function public.join_boss_run(uuid) to authenticated;
grant execute on function public.leave_boss_run(uuid) to authenticated;
grant execute on function public.complete_boss_run(uuid) to authenticated;
```

Les `drop policy if exists` restent nécessaires pour migrer une base déjà déployée :

```sql
drop policy if exists boss_sessions_update on public.boss_sessions;
drop policy if exists boss_sessions_delete on public.boss_sessions;
drop policy if exists boss_part_insert on public.boss_participation;
drop policy if exists boss_part_update on public.boss_participation;
drop policy if exists boss_part_delete on public.boss_participation;
```

- [ ] **Step 7: Relancer le test de schéma**

Run:

```bash
node tests/roster-schema.test.js
```

Expected: `PASS schéma roster persistant + sessions de boss`.

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql tests/roster-schema.test.js
git commit -m "feat: sécuriser les trois runs de boss"
```

---

### Task 2: Rappeler le nombre exact de runs manquantes sur Discord

**Files:**
- Modify: `tests/reminder.test.js:4-62`
- Modify: `scripts/reminder-core.js:1-53`
- Modify: `scripts/discord-reminder.js:1-69`

**Interfaces:**
- Consumes: tableaux `profiles: Array<{id:string,pseudo:string}>` et `memberships: Array<{owner:string}>`.
- Produces: `missingRuns(profiles, memberships, maxRuns = 3): Array<{pseudo:string, missing:number}>`.
- Produces: `reminderMessage(weekLabel, missingMembers): string`.

- [ ] **Step 1: Écrire les tests qui échouent pour `0/3` à `3/3`**

Dans `tests/reminder.test.js`, importer `missingRuns` à la place de `absentPseudos`, puis remplacer les anciens tests d’absents par :

```js
// missingRuns : une participation ouverte ou archivée vaut une run.
{
  const profiles = [
    { id: "u0", pseudo: "Zéro" },
    { id: "u1", pseudo: "Une" },
    { id: "u2", pseudo: "Deux" },
    { id: "u3", pseudo: "Trois" }
  ];
  const memberships = [
    { owner: "u1" },
    { owner: "u2" }, { owner: "u2" },
    { owner: "u3" }, { owner: "u3" }, { owner: "u3" }
  ];
  assert.deepStrictEqual(missingRuns(profiles, memberships), [
    { pseudo: "Zéro", missing: 3 },
    { pseudo: "Une", missing: 2 },
    { pseudo: "Deux", missing: 1 }
  ]);
  assert.deepStrictEqual(
    missingRuns([profiles[0]], memberships.concat({ owner: "u0" }), 2),
    [{ pseudo: "Zéro", missing: 1 }]
  );
}

// reminderMessage : détail par pseudo et cas où tout le monde est à 3/3.
{
  const msg = reminderMessage("semaine du 20 juil.", [
    { pseudo: "Casté", missing: 1 },
    { pseudo: "Syval", missing: 3 }
  ]);
  assert.match(msg, /Boss de confrérie/);
  assert.match(msg, /semaine du 20 juil\./);
  assert.match(msg, /Casté : 1 run restante/);
  assert.match(msg, /Syval : 3 runs restantes/);
  assert.match(reminderMessage("semaine du 20 juil.", []), /tout le monde est à 3\/3/);
}
```

- [ ] **Step 2: Vérifier que les nouveaux tests échouent**

Run:

```bash
node tests/reminder.test.js
```

Expected: FAIL car `missingRuns` n’est pas exportée.

- [ ] **Step 3: Implémenter le calcul et le message**

Dans `scripts/reminder-core.js`, remplacer `absentPseudos` et `reminderMessage` par :

```js
function missingRuns(profiles, memberships, maxRuns = 3) {
  const counts = new Map();
  (memberships || []).forEach(membership => {
    if (!membership || !membership.owner) return;
    counts.set(membership.owner, (counts.get(membership.owner) || 0) + 1);
  });
  return (profiles || []).flatMap(profile => {
    if (!profile || !profile.id) return [];
    const missing = Math.max(0, maxRuns - (counts.get(profile.id) || 0));
    if (!missing) return [];
    return [{
      pseudo: (profile.pseudo && String(profile.pseudo).trim()) || "Membre",
      missing
    }];
  });
}

function reminderMessage(weekLabel, missingMembers) {
  const label = weekLabel ? (" (" + weekLabel + ")") : "";
  if (!missingMembers.length) {
    return "✅ **Boss de confrérie**" + label +
      " — tout le monde est à 3/3 avant le reset de lundi 9h. Bravo !";
  }
  const lines = missingMembers.map(member =>
    member.pseudo + " : " + member.missing + " run" +
    (member.missing > 1 ? "s restantes" : " restante")
  );
  return "🔔 **Boss de confrérie**" + label + " — reset lundi 9h !\n" +
    lines.join("\n") + "\n" +
    "Réserve tes runs sur NOVA avant le reset ! ⚔️";
}
```

Exporter :

```js
module.exports = {
  isReminderWindow, currentBossWeekStart, missingRuns, reminderMessage,
  REMINDER_WEEKDAY, REMINDER_HOUR
};
```

- [ ] **Step 4: Brancher le script Discord**

Dans `scripts/discord-reminder.js`, importer `missingRuns`, puis remplacer :

```js
const absents = absentPseudos(profiles, memberships);
const content = reminderMessage(weekLabel, absents);
```

par :

```js
const missingMembers = missingRuns(profiles, memberships);
const content = reminderMessage(weekLabel, missingMembers);
```

Et remplacer le journal final par :

```js
console.log(
  "Rappel envoyé (" + weekStart + ") — " +
  missingMembers.length + " membre(s) sous les 3 runs."
);
```

Mettre à jour le commentaire d’en-tête : le script relance les membres sous `3/3`, et pas seulement ceux sans groupe.

- [ ] **Step 5: Vérifier le rappel**

Run:

```bash
node tests/reminder.test.js
```

Expected: `PASS rappel Discord (logique pure)`.

- [ ] **Step 6: Commit**

```bash
git add tests/reminder.test.js scripts/reminder-core.js scripts/discord-reminder.js
git commit -m "feat: rappeler les runs de boss manquantes"
```

---

### Task 3: Simuler les RPC et spécifier le parcours utilisateur

**Files:**
- Modify: `tests/supabase-etape1.playwright.js:216-240`
- Modify: `tests/supabase-etape1.playwright.js:328-490`

**Interfaces:**
- Consumes: RPC définies à la Task 1.
- Produces: `window.__fakeSupabaseClient.rpc(name, args)` avec les mêmes erreurs métier que Supabase.
- Produces: scénario navigateur de référence pour la limite, le départ, l’archivage, l’idempotence et le mobile.

- [ ] **Step 1: Ajouter le faux moteur RPC**

Dans `installFakeSupabase`, ajouter avant l’exposition de `window.__fakeSupabaseClient` :

```js
async function rpc(name, args){
  const sessionId = args && args.p_session_id;
  const run = state.boss_sessions.find(item => item.id === sessionId);
  const owner = state.session && state.session.user && state.session.user.id;
  const fail = message => ({ data:null, error:{ message } });
  if(!owner) return fail("AUTH_REQUIRED");
  if(!run) return fail("RUN_NOT_FOUND");

  if(name === "join_boss_run"){
    if(run.status !== "open") return fail("RUN_ARCHIVED");
    if(state.boss_participation.some(item =>
      item.session_id === sessionId && item.owner === owner
    )) return { data:null, error:null };
    const weekSessionIds = new Set(state.boss_sessions
      .filter(item => item.week_start === run.week_start)
      .map(item => item.id));
    const used = state.boss_participation.filter(item =>
      item.owner === owner && weekSessionIds.has(item.session_id)
    ).length;
    if(used >= 3) return fail("RUN_LIMIT_REACHED");
    const profile = state.profiles.find(item => item.id === owner);
    state.boss_participation.push({
      session_id:sessionId,
      owner,
      pseudo:(profile && profile.pseudo) || "Membre",
      updated_at:"2026-07-25T10:00:00.000Z"
    });
    return { data:null, error:null };
  }

  if(name === "leave_boss_run"){
    if(run.status !== "open") return fail("RUN_ARCHIVED");
    state.boss_participation = state.boss_participation.filter(item =>
      item.session_id !== sessionId || item.owner !== owner
    );
    return { data:null, error:null };
  }

  if(name === "complete_boss_run"){
    if(run.status !== "open") return { data:null, error:null };
    const mine = state.boss_participation.some(item =>
      item.session_id === sessionId && item.owner === owner
    );
    if(!mine) return fail("RUN_MEMBERS_ONLY");
    run.status = "archived";
    run.completed_at = "2026-07-25T10:30:00.000Z";
    const nextRunNo = (run.run_no || 1) + 1;
    if(!state.boss_sessions.some(item =>
      item.week_start === run.week_start &&
      item.slot === run.slot &&
      item.run_no === nextRunNo
    )){
      state.boss_sessions.push(Object.assign({}, run, {
        id:"boss-" + run.week_start + "-" + run.slot + "-" + nextRunNo,
        created_by:owner,
        title:"Groupe " + run.slot,
        run_no:nextRunNo,
        status:"open",
        completed_at:null,
        created_at:"2026-07-25T10:30:00.000Z"
      }));
    }
    return { data:null, error:null };
  }

  return fail("RPC inconnue");
}
```

Exposer `rpc` à côté de `from: query` :

```js
      rpc,
      from:query
```

- [ ] **Step 2: Adapter l’unicité du faux `upsert`**

Dans la branche `boss_sessions` du faux query builder, comparer aussi `run_no` :

```js
if(table === "boss_sessions"){
  return row.week_start === value.week_start &&
    row.slot === value.slot &&
    (row.run_no || 1) === (value.run_no || 1);
}
```

- [ ] **Step 3: Remplacer le scénario Playwright des groupes**

Remplacer l’ancien parcours « multi-groupes » par :

```js
// Boss : trois runs maximum, départ libérateur, archive et run suivante.
await page.locator('.tab[data-view="boss"]').click();
await page.locator(".boss-grid .boss-card").nth(5).waitFor();
assert.equal(await page.locator(".boss-grid .boss-card").count(), 6);
assert.equal(await page.evaluate(() => window.__fakeSupabaseState.boss_sessions.length), 6);
assert.match(await page.locator("#bossCount").textContent(), /0\/3/);

for(const number of [1, 2, 3]){
  await page.locator(".boss-card", { hasText:"Groupe " + number + " · Run 1" })
    .getByRole("button", { name:"Rejoindre", exact:true }).click();
}
await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 3);
assert.match(await page.locator("#bossCount").textContent(), /3\/3/);
assert.equal(
  await page.locator(".boss-card", { hasText:"Groupe 4 · Run 1" })
    .getByRole("button", { name:"Rejoindre", exact:true }).isDisabled(),
  true
);
const fourthJoinError = await page.evaluate(async () => {
  const run = window.__fakeSupabaseState.boss_sessions.find(item =>
    item.slot === 4 && item.run_no === 1
  );
  const result = await window.__fakeSupabaseClient.rpc(
    "join_boss_run",
    { p_session_id:run.id }
  );
  return result.error && result.error.message;
});
assert.equal(fourthJoinError, "RUN_LIMIT_REACHED");
assert.equal(
  await page.evaluate(() => window.__fakeSupabaseState.boss_participation.length),
  3
);

await page.locator(".boss-card", { hasText:"Groupe 1 · Run 1" })
  .getByRole("button", { name:"Quitter", exact:true }).click();
await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 2);
assert.match(await page.locator("#bossCount").textContent(), /2\/3/);

await page.locator(".boss-card", { hasText:"Groupe 4 · Run 1" })
  .getByRole("button", { name:"Rejoindre", exact:true }).click();
await page.waitForFunction(() => window.__fakeSupabaseState.boss_participation.length === 3);

page.once("dialog", dialog => dialog.accept());
await page.locator(".boss-card", { hasText:"Groupe 2 · Run 1" })
  .getByRole("button", { name:"Run terminée", exact:true }).click();
await page.locator(".boss-card", { hasText:"Groupe 2 · Run 2" }).waitFor();
assert.equal(await page.locator(".boss-grid .boss-card").count(), 6);
assert.match(await page.locator("#bossCount").textContent(), /3\/3/);
assert.match(await page.locator(".boss-archive-current").textContent(), /Groupe 2 · Run 1/);
assert.match(await page.locator(".boss-archive-current").textContent(), /Yannis/);

const archivedId = await page.evaluate(() =>
  window.__fakeSupabaseState.boss_sessions.find(item =>
    item.slot === 2 && item.run_no === 1
  ).id
);
await page.evaluate(async id => {
  await window.__fakeSupabaseClient.rpc("complete_boss_run", { p_session_id:id });
}, archivedId);
assert.equal(
  await page.evaluate(() => window.__fakeSupabaseState.boss_sessions.filter(item =>
    item.slot === 2 && item.run_no === 2
  ).length),
  1,
  "Une double terminaison ne crée jamais deux runs suivantes"
);
const archivedLeaveError = await page.evaluate(async id => {
  const result = await window.__fakeSupabaseClient.rpc(
    "leave_boss_run",
    { p_session_id:id }
  );
  return result.error && result.error.message;
}, archivedId);
assert.equal(archivedLeaveError, "RUN_ARCHIVED");
assert.equal(
  await page.evaluate(id => window.__fakeSupabaseState.boss_participation.some(item =>
    item.session_id === id && item.owner === "user-1"
  ), archivedId),
  true,
  "La participation archivée reste définitive"
);

for(const width of [320, 360, 390]){
  await page.setViewportSize({ width, height:844 });
  const overflow = await page.evaluate(() =>
    document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth
  );
  assert.ok(overflow <= 1, `Débordement boss de ${overflow}px à ${width}px`);
}
```

- [ ] **Step 4: Ajouter le refus d’un non-membre au faux RPC**

Après le test d’idempotence, appeler directement la RPC sur le groupe 5 non rejoint :

```js
const nonMemberError = await page.evaluate(async () => {
  const run = window.__fakeSupabaseState.boss_sessions.find(item =>
    item.slot === 5 && item.run_no === 1
  );
  const result = await window.__fakeSupabaseClient.rpc(
    "complete_boss_run",
    { p_session_id:run.id }
  );
  return result.error && result.error.message;
});
assert.equal(nonMemberError, "RUN_MEMBERS_ONLY");
```

- [ ] **Step 5: Lancer le scénario et constater l’échec côté interface**

Run:

```bash
node tests/supabase-etape1.playwright.js
```

Expected: FAIL car l’interface actuelle affiche `Groupe 1`, effectue des écritures directes et n’a ni compteur `0/3`, ni bouton `Run terminée`.

- [ ] **Step 6: Commit des tests rouges**

```bash
git add tests/supabase-etape1.playwright.js
git commit -m "test: définir le parcours des trois runs"
```

---

### Task 4: Implémenter le cycle des runs dans l’interface

**Files:**
- Modify: `index.html:647-674`
- Modify: `index.html:3752-3912`
- Test: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `BossStore.join(sessionId)`, `BossStore.leave(sessionId)` et `BossStore.complete(sessionId)` via `supabase.rpc`.
- Consumes: `boss_sessions.run_no`, `boss_sessions.status`, `boss_sessions.completed_at`.
- Produces: six cartes ouvertes, compteur `X/3`, archive courante et archives hebdomadaires.

- [ ] **Step 1: Faire passer toutes les écritures par RPC**

Dans `BossStore.ensureWeek`, ajouter `run_no:1` à chaque ligne et utiliser :

```js
.upsert(rows, {
  onConflict:"week_start,slot,run_no",
  ignoreDuplicates:true
});
```

Remplacer `join` et `leave`, puis ajouter `complete` :

```js
async join(sessionId){
  if(!currentUser || !sb) throw new Error("AUTH_REQUIRED");
  const { error } = await sb.rpc("join_boss_run", { p_session_id:sessionId });
  if(error) throw error;
},
async leave(sessionId){
  if(!currentUser || !sb) throw new Error("AUTH_REQUIRED");
  const { error } = await sb.rpc("leave_boss_run", { p_session_id:sessionId });
  if(error) throw error;
},
async complete(sessionId){
  if(!currentUser || !sb) throw new Error("AUTH_REQUIRED");
  const { error } = await sb.rpc("complete_boss_run", { p_session_id:sessionId });
  if(error) throw error;
}
```

Trier aussi `listAll()` par `run_no` après `slot`.

- [ ] **Step 2: Calculer les runs utilisées sur toute la semaine**

Dans `renderBossView`, remplacer la séparation actuelle par :

```js
const weekGroups = allGroups.filter(g => g.week_start === week.startDate);
const current = weekGroups
  .filter(g => g.status === "open")
  .sort((a,b)=>(a.slot||0)-(b.slot||0));
const completedCurrent = weekGroups
  .filter(g => g.status === "archived")
  .sort((a,b)=>(b.completed_at||"").localeCompare(a.completed_at||""));
const past = allGroups.filter(g =>
  g.week_start && g.week_start !== week.startDate
);
const currentSessionIds = new Set(weekGroups.map(g => g.id));
const myCount = membership.filter(m =>
  m.owner === currentUser.id && currentSessionIds.has(m.session_id)
).length;
```

Rendre le compteur sans cas spécial :

```js
$("#bossCount").innerHTML =
  "<b>"+myCount+"/3</b> runs réservés ou terminés";
```

Passer `myCount` à chaque carte :

```js
current.forEach(g => grid.appendChild(bossGroupCard(g, membership, myCount)));
```

- [ ] **Step 3: Afficher les actions et les erreurs métier**

Ajouter :

```js
function bossActionMessage(error){
  const message = String(error && error.message || "");
  if(message.includes("RUN_LIMIT_REACHED")) return "Tes 3 runs de la semaine sont déjà réservés ou terminés.";
  if(message.includes("RUN_ARCHIVED")) return "Cette run vient d’être terminée. La liste a été actualisée.";
  if(message.includes("RUN_MEMBERS_ONLY")) return "Seuls les membres de ce groupe peuvent terminer la run.";
  if(message.includes("RUN_NOT_FOUND")) return "Cette run n’existe plus. La liste a été actualisée.";
  return authMessage(error);
}
```

Remplacer entièrement `bossGroupCard` par :

```js
function bossGroupCard(g, membership, myCount){
  const members = membership.filter(m => m.session_id === g.id);
  const mine = members.some(m => m.owner === currentUser.id);
  const list = el("div",{class:"boss-members"});
  if(members.length){
    members.forEach(m => list.appendChild(el("span",{
      class:"boss-chip"+(m.owner===currentUser.id?" me":""),
      text:m.pseudo||"Membre"
    })));
  }else{
    list.appendChild(el("span",{
      class:"boss-none",
      text:"Personne pour l'instant"
    }));
  }

  const joinButton = el("button",{
    class:"btn "+(mine?"btn-danger":"btn-primary")+" boss-join",
    type:"button",
    text:mine?"Quitter":"Rejoindre",
    title:!mine && myCount >= 3 ? "Limite hebdomadaire atteinte : 3/3" : "",
    onclick:async()=>{
      joinButton.disabled = true;
      try{
        mine ? await BossStore.leave(g.id) : await BossStore.join(g.id);
      }catch(error){
        toast("Action impossible : "+bossActionMessage(error), true);
      }
      await renderBossView();
    }
  });
  joinButton.disabled = !mine && myCount >= 3;

  const completeButton = mine ? el("button",{
    class:"btn btn-secondary boss-complete",
    type:"button",
    text:"Run terminée",
    onclick:async()=>{
      const names = members.map(member => member.pseudo || "Membre").join(", ");
      if(!confirm(
        "Terminer "+g.title+" · Run "+(g.run_no||1)+" ?\n\n"+
        "Runs utilisées définitivement pour : "+names
      )) return;
      completeButton.disabled = true;
      try{
        await BossStore.complete(g.id);
      }catch(error){
        toast("Fin de run impossible : "+bossActionMessage(error), true);
      }
      await renderBossView();
    }
  }) : null;

  const actions = el("div",{class:"boss-actions"},[
    joinButton,
    ...(completeButton ? [completeButton] : [])
  ]);

  return el("div",{class:"boss-card"+(mine?" mine":"")},[
    el("div",{class:"boss-card-head"},[
      el("span",{
        class:"boss-card-title",
        text:g.title+" · Run "+(g.run_no||1)
      }),
      el("span",{
        class:"boss-membercount",
        text:members.length+" membre"+(members.length>1?"s":"")
      })
    ]),
    list,
    actions
  ]);
}
```

- [ ] **Step 4: Rendre l’archive courante et les semaines précédentes**

Ajouter un formateur :

```js
const frDateTime = iso => iso
  ? new Date(iso).toLocaleString("fr-FR", {
      day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"
    })
  : "";
```

Créer `bossArchiveRows(groups, membership)` :

```js
function bossArchiveRows(groups, membership){
  const wrap = el("div");
  groups.forEach(g=>{
    const names = membership
      .filter(m=>m.session_id===g.id)
      .map(m=>m.pseudo||"Membre")
      .join(", ") || "—";
    wrap.appendChild(el("div",{class:"boss-archive-row"},[
      el("b",{text:g.title+" · Run "+(g.run_no||1)+" : "}),
      el("span",{text:names}),
      ...(g.completed_at ? [
        el("small",{text:" · terminée le "+frDateTime(g.completed_at)})
      ] : [])
    ]));
  });
  return wrap;
}
```

Dans `renderBossView`, afficher les runs terminées de la semaine en premier :

```js
if(completedCurrent.length){
  const currentArchive = el("details",{
    class:"boss-archive boss-archive-current",
    open:true
  });
  currentArchive.appendChild(el("summary",{
    text:"Runs terminées cette semaine ("+completedCurrent.length+")"
  }));
  currentArchive.appendChild(bossArchiveRows(completedCurrent, membership));
  body.appendChild(currentArchive);
}
if(past.length) body.appendChild(bossArchive(past, membership));
```

Remplacer `bossArchive` par :

```js
function bossArchive(past, membership){
  const weeks = [...new Set(past.map(g=>g.week_start))].sort().reverse();
  const wrap = el("details",{class:"boss-archive"});
  wrap.appendChild(el("summary",{
    text:"Semaines précédentes ("+weeks.length+")"
  }));
  weeks.forEach(weekStart=>{
    const groups = past
      .filter(g => g.week_start === weekStart)
      .sort((a,b)=>
        ((a.slot||0)-(b.slot||0)) ||
        ((a.run_no||1)-(b.run_no||1))
      );
    const weekBlock = el("div",{class:"boss-archive-week"});
    weekBlock.appendChild(el("div",{
      class:"boss-archive-title",
      text:"Semaine du "+frDate(weekStart)
    }));
    weekBlock.appendChild(bossArchiveRows(groups, membership));
    wrap.appendChild(weekBlock);
  });
  return wrap;
}
```

- [ ] **Step 5: Adapter les styles sans débordement mobile**

Dans la zone CSS boss :

```css
.boss-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.boss-actions .btn{min-width:0;width:100%;justify-content:center}
.boss-archive-row{overflow-wrap:anywhere}
.boss-archive-row small{color:var(--muted-2)}
@media(max-width:520px){
  .boss-grid{grid-template-columns:minmax(0,1fr)}
  .boss-actions{grid-template-columns:1fr}
}
```

Conserver la règle globale de masquage des barres de défilement déjà présente ; ne pas réintroduire `overflow-x` sur le document.

- [ ] **Step 6: Lancer le test Playwright ciblé**

Run:

```bash
node tests/supabase-etape1.playwright.js
```

Expected: `PASS Playwright: Supabase Étape 1 — auth, partage et migration`.

- [ ] **Step 7: Lancer les tests unitaires**

Run:

```bash
npm run test:unit
```

Expected: tous les tests unitaires passent.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: gérer trois runs par joueur"
```

---

### Task 5: Documenter, vérifier et préparer le déploiement

**Files:**
- Modify: `AGENTS.md:259-271`
- Verify: `supabase/schema.sql`
- Verify: `index.html`
- Verify: `scripts/reminder-core.js`
- Verify: `scripts/discord-reminder.js`
- Verify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: toutes les interfaces des Tasks 1 à 4.
- Produces: documentation de reprise et preuve finale de non-régression.

- [ ] **Step 1: Mettre à jour la documentation de reprise**

Remplacer la section « Groupes de Boss de Guilde » de `AGENTS.md` par :

```markdown
## Groupes de Boss de Guilde (onglet « Groupes de boss »)

- **6 groupes ouverts simultanément chaque semaine** (reset lundi 9h), boss
  *Akumu, bête démoniaque*. `BossStore.ensureWeek` crée uniquement les runs n°1
  avec un `upsert` sur `(week_start, slot, run_no)`.
- Chaque membre dispose de **3 runs par semaine**. Rejoindre une run ouverte la
  réserve ; quitter la run ouverte la libère. Les participations archivées sont
  définitives.
- Tout membre du groupe peut cliquer « Run terminée ». La RPC
  `complete_boss_run` archive la session et ses participants, puis crée
  immédiatement la run suivante, vide, pour le même groupe.
- Les écritures passent par `join_boss_run`, `leave_boss_run` et
  `complete_boss_run`. Les politiques RLS interdisent les écritures directes
  dans `boss_participation` et la modification directe des sessions.
- Semaine courante = `currentBossWeek()` (lundi 9h Paris le plus récent ≤ maintenant).
- **Rappel Discord** : dimanche midi Paris (`scripts/discord-reminder.js` +
  GitHub Actions), liste les membres sous `3/3` et le nombre de runs manquantes.
  Voir `docs/superpowers/specs/2026-07-25-boss-trois-runs-design.md`.
- Après une modification de ce schéma, réexécuter le contenu complet de
  `supabase/schema.sql` dans le SQL Editor Supabase.
```

- [ ] **Step 2: Scanner les anciennes règles qui ne doivent plus exister**

Run:

```bash
rg -n "absentPseudos|onConflict:\"week_start,slot\"|create policy boss_part_(insert|update|delete)|create policy boss_sessions_(update|delete)" .
```

Expected: aucune occurrence dans le code actif ; seules d’éventuelles mentions historiques sous `docs/superpowers/specs/` sont acceptables.

- [ ] **Step 3: Exécuter la suite complète**

Run:

```bash
npm test
```

Expected: tous les tests Node, Python et Playwright passent, sans erreur de page Chromium.

- [ ] **Step 4: Vérifier le diff final**

Run:

```bash
git status --short
git diff --check
git diff --stat HEAD~4..HEAD
```

Expected:

- aucun espace fautif signalé par `git diff --check` ;
- seuls les huit fichiers annoncés dans le File Map ont changé ;
- aucune clé Supabase `service_role` ni URL de webhook n’apparaît dans le diff.

- [ ] **Step 5: Commit de documentation**

```bash
git add AGENTS.md
git commit -m "docs: expliquer le cycle des runs de boss"
```

- [ ] **Step 6: Rejouer la vérification avant intégration**

Run:

```bash
npm test
git status --short --branch
```

Expected: suite verte et branche propre. L’étape utilisateur suivante est de réexécuter `supabase/schema.sql` dans Supabase avant de tester les boutons du site publié.
