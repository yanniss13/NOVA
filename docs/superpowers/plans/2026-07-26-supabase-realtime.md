# Supabase Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actualiser automatiquement les équipes, rosters, analyses et groupes de boss lorsqu'une donnée partagée change dans Supabase.

**Architecture:** Une seule chaîne Supabase Realtime est liée à la session authentifiée. Les événements sont convertis en domaines fonctionnels, regroupés, puis seule la vue active concernée relit ses données ; les brouillons de modales ne sont jamais remplacés.

**Tech Stack:** JavaScript inline, Supabase JS v2 Postgres Changes, SQL PostgreSQL idempotent, Node.js `assert`, Playwright.

## Global Constraints

- Une seule chaîne Realtime par session authentifiée.
- Tables observées : `profiles`, `teams`, `roster_characters`, `boss_sessions`, `boss_participation`.
- Recensement et Analyse restent dérivés de `roster_characters` et `profiles`.
- Aucune politique RLS ne doit être assouplie.
- Une panne Realtime ne doit pas bloquer les lectures manuelles existantes.
- Aucun éditeur ouvert ne doit perdre son brouillon.
- Aucune nouvelle dépendance.

## File Structure

- `supabase/schema.sql` : inscription idempotente des tables dans la publication Realtime.
- `tests/roster-schema.test.js` : contrat SQL de publication.
- `index.html` : indicateur de connexion et contrôleur Realtime.
- `tests/supabase-etape1.playwright.js` : faux canal Supabase et parcours de synchronisation.
- `AGENTS.md` : documentation de reprise et étape Supabase à rejouer.

## Visual Direction

- Sujet : registre vivant d'une confrérie, pas tableau de bord SaaS.
- Palette : obsidienne `#0e0d12`, panneau `#1b1922`, or `#d9a441`,
  parchemin `#e8e0d0`, vert de sceau `#4c9a5a`.
- Typographie : Cinzel reste réservée aux titres ; le statut utilise la police UI
  compacte déjà présente.
- Signature : l'état Realtime se lit comme le petit sceau vivant du compte, sans
  nouvelle carte, gros badge ni animation décorative.
- Auto-critique : réutiliser la pilule de compte existante évite l'apparence
  générique d'un bandeau de synchronisation.

---

### Task 1: Publier les tables partagées dans Supabase Realtime

**Files:**
- Modify: `tests/roster-schema.test.js`
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: publication Supabase standard `supabase_realtime`.
- Produces: les cinq tables partagées présentes dans `pg_publication_tables`.

- [ ] **Step 1: Écrire le contrat SQL en échec**

Ajouter à `tests/roster-schema.test.js` :

```js
const realtimeTables = [
  "profiles",
  "teams",
  "roster_characters",
  "boss_sessions",
  "boss_participation"
];

assert.match(sql, /pg_publication_tables/i);
assert.match(sql, /alter publication supabase_realtime add table/i);
realtimeTables.forEach(table => {
  assert.match(
    sql,
    new RegExp("\\b" + table + "\\b", "i"),
    table + " doit être ajoutée à Supabase Realtime"
  );
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node tests/roster-schema.test.js`

Expected: FAIL sur l'absence de `pg_publication_tables`.

- [ ] **Step 3: Ajouter le bloc SQL idempotent**

Ajouter à la fin de `supabase/schema.sql` :

```sql
-- ============================ Realtime ============================
-- Chaque table est vérifiée séparément pour que le schéma complet reste rejouable.
do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'profiles',
    'teams',
    'roster_characters',
    'boss_sessions',
    'boss_participation'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end
$$;
```

- [ ] **Step 4: Vérifier le passage au vert**

Run: `node tests/roster-schema.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql tests/roster-schema.test.js
git commit -m "feat: publish shared tables to realtime"
```

---

### Task 2: Simuler Supabase Realtime et définir le parcours en échec

**Files:**
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `client.channel(name).on(...).subscribe(callback)` et `client.removeChannel(channel)`.
- Produces: `window.__fakeSupabaseEmit(table, eventType)` pour déclencher un changement distant réel dans le test.

- [ ] **Step 1: Étendre l'état du faux Supabase**

Dans `installFakeSupabase(page)`, ajouter à `state` :

```js
      realtimeChannels:[],
      removedRealtimeChannels:0,
```

Ajouter les fonctions suivantes avant la création de
`window.__fakeSupabaseClient` :

```js
    function channel(name){
      const handlers = [];
      const realtimeChannel = {
        name,
        handlers,
        on(kind, filter, callback){
          handlers.push({ kind, filter:clone(filter), callback });
          return realtimeChannel;
        },
        subscribe(callback){
          realtimeChannel.statusCallback = callback;
          state.realtimeChannels.push(realtimeChannel);
          queueMicrotask(() => callback("SUBSCRIBED"));
          return realtimeChannel;
        }
      };
      return realtimeChannel;
    }

    function emitDatabase(table, eventType){
      state.realtimeChannels.forEach(realtimeChannel => {
        realtimeChannel.handlers
          .filter(handler =>
            handler.kind === "postgres_changes" &&
            handler.filter.schema === "public" &&
            handler.filter.table === table
          )
          .forEach(handler => handler.callback({
            schema:"public",
            table,
            eventType:eventType || "UPDATE",
            new:{},
            old:{}
          }));
      });
    }

    window.__fakeSupabaseEmit = emitDatabase;
```

Étendre le client :

```js
      channel,
      async removeChannel(realtimeChannel){
        state.realtimeChannels = state.realtimeChannels
          .filter(item => item !== realtimeChannel);
        state.removedRealtimeChannels++;
        return "ok";
      },
```

- [ ] **Step 2: Ajouter les assertions Realtime au parcours**

Après la connexion, ajouter :

```js
    await page.getByText("À jour", { exact:true }).waitFor();
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.realtimeChannels.length),
      1
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.realtimeChannels[0]
        .statusCallback("CHANNEL_ERROR");
    });
    await page.getByText("Synchronisation indisponible", { exact:true }).waitFor();
    await page.evaluate(() => {
      window.__fakeSupabaseState.realtimeChannels[0]
        .statusCallback("SUBSCRIBED");
    });
    await page.getByText("À jour", { exact:true }).waitFor();
```

Après l'ouverture de la vue des équipes :

```js
    await page.evaluate(() => {
      window.__fakeSupabaseState.teams.push({
        id:"team-realtime",
        owner:"user-2",
        pseudo:"Merlin",
        data:{
          id:"team-realtime",
          pseudo:"Merlin",
          heroes:Array.from({length:4}, () => ({
            char:null, weapon:null, armor:{}, jewel:{},
            potentiel:{tier:0}, note:""
          }))
        },
        created_at:"2026-07-26T09:00:00.000Z",
        updated_at:"2026-07-26T09:00:00.000Z"
      });
      window.__fakeSupabaseEmit("teams", "INSERT");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("#rosterGrid .team").length === 3
    );
    await page.evaluate(() => {
      window.__fakeSupabaseState.teams =
        window.__fakeSupabaseState.teams
          .filter(team => team.id !== "team-realtime");
      window.__fakeSupabaseEmit("teams", "DELETE");
    });
    await page.waitForFunction(() =>
      document.querySelectorAll("#rosterGrid .team").length === 2
    );
```

Dans la vue Recensement :

```js
    await page.evaluate(() => {
      window.__fakeSupabaseState.calls.length = 0;
      const row = window.__fakeSupabaseState.roster_characters
        .find(item => item.owner === "user-2" && item.char_id === "merlin");
      row.potential_tier = 10;
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
      window.__fakeSupabaseEmit("profiles", "UPDATE");
    });
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#recGrid .rec-player")]
        .some(card => card.textContent.includes("Merlin") && card.textContent.includes("P10"))
    );
    assert.equal(
      await page.evaluate(() =>
        window.__fakeSupabaseState.calls.filter(call =>
          call.table === "roster_characters" && call.operation === "select"
        ).length
      ),
      1,
      "Deux événements du même domaine doivent produire une seule relecture"
    );
```

Pendant l'édition du roster :

```js
    await page.locator("#memberRosterGrid .member-roster-edit").first().click();
    const protectedNote = page.locator("#memberRosterEditor textarea");
    await protectedNote.fill("Brouillon non écrasé");
    await page.evaluate(() => {
      window.__fakeSupabaseEmit("roster_characters", "UPDATE");
    });
    await page.waitForTimeout(300);
    assert.equal(await protectedNote.inputValue(), "Brouillon non écrasé");
    await page.locator("#memberRosterClose").click();
```

Après l'affichage des groupes de boss, injecter une participation distante :

```js
    await page.evaluate(() => {
      const session = window.__fakeSupabaseState.boss_sessions
        .find(item => item.status === "open");
      window.__fakeSupabaseState.boss_participation.push({
        session_id:session.id,
        owner:"user-2",
        pseudo:"Merlin",
        updated_at:"2026-07-26T10:00:00.000Z"
      });
      window.__fakeSupabaseEmit("boss_participation", "INSERT");
    });
    await page.locator("#bossBody").getByText("Merlin", { exact:true }).waitFor();
```

Enfin, déclencher la déconnexion et vérifier le nettoyage :

```js
    await page.locator("#authLogout").click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.realtimeChannels.length === 0
    );
    assert.equal(
      await page.evaluate(() => window.__fakeSupabaseState.removedRealtimeChannels),
      1
    );
    await page.locator("#authEmail").fill("yannis@example.test");
    await page.locator("#authPassword").fill("mot-de-passe-test");
    await page.getByRole("button", { name:"Se connecter", exact:true }).click();
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.realtimeChannels.length === 1
    );
```

- [ ] **Step 3: Lancer le parcours et constater l'échec**

Run: `node tests/supabase-etape1.playwright.js`

Expected: FAIL car le faux client ne reçoit encore aucun appel `channel()` de
l'application et l'indicateur `À jour` n'existe pas.

- [ ] **Step 4: Commit des tests rouges**

```bash
git add tests/supabase-etape1.playwright.js
git commit -m "test: define realtime synchronization"
```

---

### Task 3: Implémenter le contrôleur Realtime et son état visible

**Files:**
- Modify: `index.html`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: session courante, fonctions `Store.refresh`, `renderRoster`, `renderMemberRoster`, `renderRecensement`, `renderAnalyse`, `renderBossView`.
- Produces: `RealtimeSync.start(userId)`, `RealtimeSync.stop()`, `RealtimeSync.schedule(table)`.

- [ ] **Step 1: Ajouter l'indicateur de connexion**

Dans `#accountConnected`, après le pseudo :

```html
      <span class="live-status" id="liveStatus" role="status"
            aria-live="polite" aria-atomic="true">Connexion…</span>
```

Ajouter le style :

```css
  .live-status{
    font-size:10px;color:var(--muted);white-space:nowrap
  }
  .live-status[data-state="online"]{color:var(--ok)}
  .live-status[data-state="offline"]{color:#e98d8d}
```

- [ ] **Step 2: Ajouter le contrôleur**

Avant la section Authentification de `index.html`, ajouter :

```js
  const RealtimeSync = (function(){
    const tables = [
      "profiles",
      "teams",
      "roster_characters",
      "boss_sessions",
      "boss_participation"
    ];
    let channel = null;
    let userId = "";
    let timer = null;
    const pending = new Set();

    function setStatus(state, text){
      const node = $("#liveStatus");
      if(!node) return;
      node.dataset.state = state;
      node.textContent = text;
    }

    function activeView(){
      const view = document.querySelector(".view.active");
      return view ? view.id.replace(/^view-/, "") : "";
    }

    async function flush(){
      timer = null;
      const changed = new Set(pending);
      pending.clear();
      const view = activeView();
      try{
        if(changed.has("teams")){
          if(view === "roster") await renderRoster();
          else await Store.refresh();
        }
        if(changed.has("roster")){
          if(view === "member-roster") await renderMemberRoster();
          if(view === "recensement") await renderRecensement();
          if(view === "analyse") await renderAnalyse();
        }
        if(changed.has("boss") && view === "boss"){
          await renderBossView();
        }
      }catch(error){
        setStatus("offline", "Synchronisation indisponible");
      }
    }

    function schedule(table){
      if(table === "teams") pending.add("teams");
      if(table === "profiles" || table === "roster_characters"){
        pending.add("roster");
      }
      if(table === "boss_sessions" || table === "boss_participation"){
        pending.add("boss");
      }
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), 120);
    }

    function stop(){
      clearTimeout(timer);
      timer = null;
      pending.clear();
      const previous = channel;
      channel = null;
      userId = "";
      if(previous && sb) void sb.removeChannel(previous);
      setStatus("offline", "Hors ligne");
    }

    function start(nextUserId){
      if(!sb || !nextUserId) return stop();
      if(channel && userId === nextUserId) return;
      stop();
      userId = nextUserId;
      setStatus("connecting", "Connexion…");
      let next = sb.channel("confrerie-live-"+nextUserId);
      tables.forEach(table => {
        next = next.on("postgres_changes", {
          event:"*",
          schema:"public",
          table
        }, () => schedule(table));
      });
      channel = next.subscribe(status => {
        if(channel !== next) return;
        if(status === "SUBSCRIBED") setStatus("online", "À jour");
        if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
          setStatus("offline", "Synchronisation indisponible");
        }
        if(status === "CLOSED") setStatus("offline", "Hors ligne");
      });
    }

    return { start, stop, schedule };
  })();
```

- [ ] **Step 3: Lier le contrôleur à la session**

Dans `applySession(session)`, après la résolution du profil et avant le rendu des
vues :

```js
    if(currentUser) RealtimeSync.start(currentUser.id);
    else RealtimeSync.stop();
```

- [ ] **Step 4: Vérifier le parcours**

Run: `node tests/supabase-etape1.playwright.js`

Expected: PASS.

- [ ] **Step 5: Vérifier les régressions unitaires**

Run: `npm run test:unit`

Expected: toutes les suites unitaires passent.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/supabase-etape1.playwright.js
git commit -m "feat: synchronize shared views in realtime"
```

---

### Task 4: Documenter et vérifier Realtime

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: schéma et contrôleur terminés.
- Produces: procédure de reprise et configuration Supabase explicites.

- [ ] **Step 1: Ajouter la documentation**

Ajouter dans `AGENTS.md` une section indiquant :

```markdown
## Synchronisation Supabase Realtime

Une chaîne `confrerie-live-<userId>` écoute `profiles`, `teams`,
`roster_characters`, `boss_sessions` et `boss_participation`. Les événements
sont regroupés puis seule la vue active concernée est relue. Le Recensement et
l'Analyse réagissent au roster et aux profils, car ils sont entièrement dérivés.

Après déploiement de cette fonction, rejouer `supabase/schema.sql` une fois dans
le SQL Editor afin d'ajouter les tables à la publication `supabase_realtime`.
Le bloc est idempotent.
```

- [ ] **Step 2: Exécuter la suite complète**

Run: `npm test`

Expected: toutes les suites Node, Python et Playwright passent.

- [ ] **Step 3: Vérifier le diff**

Run: `git diff --check`

Expected: aucune sortie et code de retour 0.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: explain realtime synchronization"
```
