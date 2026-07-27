# « Mon suivi » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet personnel « Mon suivi » qui résume les trois runs hebdomadaires du membre, priorise ses prochaines actions et reste compréhensible hors ligne.

**Architecture:** Le tableau de bord est une projection côté client des tables existantes `teams`, `boss_sessions`, `boss_participation` et `boss_run_reports`. Des fonctions pures construisent un état normalisé ; un `DashboardStore` protège les lectures asynchrones, maintient un cache par compte et semaine, puis le rendu inline de `index.html` réutilise les sélecteurs, modales et onglets existants.

**Tech Stack:** HTML/CSS/JavaScript autonome dans `index.html`, Supabase JS v2 déjà chargé par CDN, `localStorage`, Node.js `assert`/`vm`, Playwright, Git.

## Global Constraints

- Lire entièrement `AGENTS.md` et `docs/superpowers/specs/2026-07-27-mon-suivi-dashboard-design.md` avant toute modification.
- Travailler dans une branche ou un worktree isolé ; ne pas fusionner dans `main` et ne pas pousser sans demande explicite de l’utilisateur.
- Conserver toute la logique runtime dans `index.html` ; ne créer aucun nouveau fichier JavaScript chargé par le site.
- Ne modifier ni `supabase/schema.sql`, ni les politiques RLS, ni les RPC, ni `supabase-config.js`.
- Ne pas ajouter de dépendance runtime, de bundler ou d’étape de build.
- Interface et messages en français ; thème héraldique sombre existant.
- Semaine Boss calculée avec `currentBossWeek()` : reset lundi à 9 h dans `Europe/Paris`.
- Une run est engagée dès l’existence de la participation ; maximum trois runs par membre et groupes de un à cinq membres.
- Les scores Supabase sont convertis en chaînes avant toute mise en cache JSON.
- Le cache ne donne aucun droit et ne déclenche jamais de mutation.
- Toutes les modales passent par `ModalStack`; ne pas ajouter d’écouteur Échap local.
- Aucun débordement horizontal entre 320 et 390 px ; cibles tactiles principales d’au moins 44 × 44 px.
- Écrire le test qui échoue avant chaque changement fonctionnel, vérifier l’échec attendu, puis implémenter le minimum nécessaire.
- Exécuter `npm test` avant de déclarer la fonctionnalité terminée.

## File Map

- Modify: `index.html`
  - nouvel onglet, panneau, styles et rendu ;
  - fonctions pures du modèle ;
  - `DashboardStore`, cache, Realtime et actions directes ;
  - intégration à l’authentification et à la navigation existantes.
- Create: `tests/helpers/load-app.js`
  - charge le script principal inline dans `vm` et expose les fonctions pures
    aux tests Node.
- Modify: `tests/potentiel-commun.test.js`
  - utilise le nouveau helper sans changer ses assertions métier.
- Create: `tests/mon-suivi.test.js`
  - teste les compteurs, priorités, échéances et cache sans navigateur.
- Modify: `tests/supabase-etape1.playwright.js`
  - teste le parcours connecté, Supabase simulé, Realtime, hors ligne, courses
    et actions directes.
- Modify: `tests/accessibilite-mobile.playwright.js`
  - ajoute le septième onglet et vérifie clavier, focus et mobile.
- Modify: `package.json`
  - ajoute le test Node de « Mon suivi » aux scripts `test` et `test:unit`.
- Modify: `AGENTS.md`
  - documente le nouvel onglet, son cache et ses règles Realtime.

---

### Task 1: Modèle pur du tableau de bord

**Files:**
- Create: `tests/helpers/load-app.js`
- Create: `tests/mon-suivi.test.js`
- Modify: `tests/potentiel-commun.test.js:1-176`
- Modify: `index.html` dans le bloc `/* Sessions de boss */`, immédiatement après `currentBossWeek`
- Modify: `package.json`

**Interfaces:**
- Consumes: `currentBossWeek(now)`, lignes normalisées des quatre tables existantes.
- Produces:
  - `dashboardDeadlineStatus(now: Date, remaining: number): { level, label, remaining }`
  - `buildDashboardState(input): DashboardState`
  - `DashboardState = { weekStart, engaged, completed, open, remaining, hasOwnTeams, groups, actions, deadlineStatus, lastSyncedAt, offline }`
  - `DashboardGroup = { id, slot, runNo, title, status, completedAt, memberCount, teamSelected, report, canEditReport }`
  - `DashboardAction = { type, sessionId, slot, runNo, label, priority }`

- [ ] **Step 1: Extraire le chargeur `vm` partagé**

Déplacer sans changement fonctionnel les définitions actuellement placées au
début de `tests/potentiel-commun.test.js` — `FakeElement`, `makeDocument`,
`makeLocalStorage`, `loadApp` et `plain` — dans
`tests/helpers/load-app.js`.

Dans le remplacement de fin d’IIFE de `loadApp`, conserver les hooks existants
et ajouter les deux nouveaux hooks :

```js
Object.assign(globalThis.__hooks,{
  normalizePotentiel,
  normalizeHero,
  normalizeTeam,
  potentielDetailsOf,
  weaponTypesOf,
  isWeaponCompatible,
  compatibleWeaponGroups,
  linkedArmorsOf,
  isLinkedArmorCompatible,
  emptyRosterBuild,
  normalizeRosterBuild,
  normalizeRosterCharacter,
  favoriteRosterWeaponType,
  setFavoriteRosterBuild,
  copyFavoriteRosterBuild,
  rosterHeroSnapshot,
  cloudRosterFromRow,
  rosterToCloudRow,
  replaceRosterCacheForOwner,
  MemberRosterStore,
  Store,
  dpsEntriesFromRoster,
  recPlayersForView:typeof recPlayersForView === "function"
    ? recPlayersForView
    : undefined,
  dashboardDeadlineStatus:typeof dashboardDeadlineStatus === "function"
    ? dashboardDeadlineStatus
    : undefined,
  buildDashboardState:typeof buildDashboardState === "function"
    ? buildDashboardState
    : undefined
});
```

Terminer le helper par :

```js
module.exports = { loadApp, plain };
```

Remplacer les définitions déplacées dans `tests/potentiel-commun.test.js` par :

```js
const assert = require("node:assert");
const { loadApp, plain } = require("./helpers/load-app");
```

- [ ] **Step 2: Vérifier que l’extraction ne change pas les tests existants**

Run:

```powershell
node tests/potentiel-commun.test.js
```

Expected: PASS avec le même message final qu’avant l’extraction.

- [ ] **Step 3: Écrire les tests rouges du modèle**

Créer `tests/mon-suivi.test.js` avec les cas ci-dessous :

```js
"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  dashboardDeadlineStatus,
  buildDashboardState
} = hooks;

const weekStart = "2026-07-27";
const openRun = {
  id:"run-open",
  title:"Groupe 2",
  week_start:weekStart,
  slot:2,
  run_no:1,
  status:"open",
  completed_at:null
};
const archivedRun = {
  id:"run-archived",
  title:"Groupe 4",
  week_start:weekStart,
  slot:4,
  run_no:1,
  status:"archived",
  completed_at:"2026-07-30T20:00:00.000Z"
};
const foreignRun = {
  id:"run-old",
  title:"Groupe 1",
  week_start:"2026-07-20",
  slot:1,
  run_no:3,
  status:"archived",
  completed_at:"2026-07-26T10:00:00.000Z"
};

{
  const state = plain(buildDashboardState({
    userId:"user-1",
    weekStart,
    sessions:[openRun, archivedRun, foreignRun],
    membership:[
      {
        session_id:"run-open",
        owner:"user-1",
        pseudo:"Yannis",
        team_snapshot:null
      },
      {
        session_id:"run-open",
        owner:"user-1",
        pseudo:"Doublon",
        team_snapshot:null
      },
      {
        session_id:"run-open",
        owner:"user-2",
        pseudo:"Merlin",
        team_snapshot:{ id:"other-team" }
      },
      {
        session_id:"run-archived",
        owner:"user-1",
        pseudo:"Yannis",
        team_snapshot:{ id:"team-own" }
      },
      {
        session_id:"run-old",
        owner:"user-1",
        pseudo:"Yannis",
        team_snapshot:{ id:"old-team" }
      }
    ],
    reports:[{
      session_id:"run-archived",
      global_score:"9007199254740991",
      note:"Rapport exact"
    }],
    teams:[{ id:"team-own", owner:"user-1" }, { id:"other", owner:"user-2" }],
    now:new Date("2026-07-31T12:00:00.000Z"),
    lastSyncedAt:1234,
    offline:false
  }));

  assert.equal(state.engaged, 2);
  assert.equal(state.completed, 1);
  assert.equal(state.open, 1);
  assert.equal(state.remaining, 1);
  assert.deepEqual(
    state.actions.map(action => action.type),
    ["choose-team", "find-group", "edit-report"]
  );
  assert.equal(state.groups.find(group => group.id === "run-open").memberCount, 3);
  assert.equal(
    state.groups.find(group => group.id === "run-archived").report.globalScore,
    "9007199254740991"
  );
  assert.equal(state.groups.some(group => group.id === "run-old"), false);
}

{
  const state = plain(buildDashboardState({
    userId:"user-1",
    weekStart,
    sessions:[
      openRun,
      Object.assign({}, archivedRun, { id:"run-2" }),
      Object.assign({}, archivedRun, { id:"run-3", slot:5 })
    ],
    membership:[
      { session_id:"run-open", owner:"user-1", team_snapshot:{} },
      { session_id:"run-2", owner:"user-1", team_snapshot:{} },
      { session_id:"run-3", owner:"user-1", team_snapshot:{} }
    ],
    reports:[],
    teams:[],
    now:new Date("2026-08-02T11:00:00.000Z")
  }));
  assert.equal(state.engaged, 3);
  assert.equal(state.remaining, 0);
  assert.equal(state.deadlineStatus.level, "complete");
  assert.equal(state.actions[0].type, "view-group");
  assert.equal(state.actions.some(action => action.type === "find-group"), false);
}

{
  const noTeam = plain(buildDashboardState({
    userId:"user-1",
    weekStart,
    sessions:[openRun],
    membership:[{ session_id:"run-open", owner:"user-1", team_snapshot:null }],
    reports:[],
    teams:[],
    now:new Date("2026-07-31T12:00:00.000Z")
  }));
  assert.equal(noTeam.actions[0].type, "create-team");
}

assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-07-31T12:00:00.000Z"),
    2
  ).level,
  "neutral"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-01T10:00:00.000Z"),
    2
  ).level,
  "warning"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-02T09:59:00.000Z"),
    2
  ).level,
  "warning"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-02T10:00:00.000Z"),
    2
  ).level,
  "urgent"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-03T06:59:00.000Z"),
    2
  ).level,
  "urgent"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-03T07:00:00.000Z"),
    2
  ).level,
  "neutral"
);
assert.equal(
  dashboardDeadlineStatus(
    new Date("2026-08-03T07:00:00.000Z"),
    0
  ).level,
  "complete"
);

console.log("PASS Mon suivi : compteurs, priorités et échéances");
```

Ajouter le test dans `package.json` avant les tests de schéma :

```json
"test": "node tests/pages-workflow.test.js && node tests/mon-suivi.test.js && node tests/roster-schema.test.js && node tests/boss-reports-schema.test.js && node --test tests/boss-account-retention.test.js && node tests/pwa.test.js && node tests/reminder.test.js && python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js && node tests/scrollbars-invisibles.playwright.js && node tests/potentiel-commun.playwright.js && node tests/supabase-etape1.playwright.js && node tests/accessibilite-mobile.playwright.js && node tests/pwa-update.playwright.js",
"test:unit": "node tests/pages-workflow.test.js && node tests/mon-suivi.test.js && node tests/roster-schema.test.js && node tests/boss-reports-schema.test.js && node --test tests/boss-account-retention.test.js && node tests/pwa.test.js && node tests/reminder.test.js && python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js"
```

- [ ] **Step 4: Exécuter le nouveau test et confirmer l’échec**

Run:

```powershell
node tests/mon-suivi.test.js
```

Expected: FAIL car `dashboardDeadlineStatus` et `buildDashboardState`
n’existent pas encore.

- [ ] **Step 5: Implémenter les fonctions pures**

Ajouter sous `currentBossWeek()` :

```js
function dashboardParisParts(now){
  const parts = new Intl.DateTimeFormat("en-CA",{
    timeZone:"Europe/Paris",
    weekday:"short",
    hour:"2-digit",
    hourCycle:"h23"
  }).formatToParts(now || new Date());
  const get = type => (parts.find(part => part.type === type) || {}).value;
  return {
    weekday:{ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[
      get("weekday")
    ],
    hour:Number(get("hour"))
  };
}

function dashboardRunCountLabel(count){
  return count+" run"+(count > 1 ? "s" : "");
}

function dashboardDeadlineStatus(now, remaining){
  const left = Math.max(0, Math.min(3, Number(remaining) || 0));
  if(left === 0){
    return { level:"complete", label:"Semaine complète", remaining:0 };
  }
  const paris = dashboardParisParts(now);
  const urgent = paris.weekday === 0 && paris.hour >= 12
    || paris.weekday === 1 && paris.hour < 9;
  const warning = paris.weekday === 6
    || paris.weekday === 0 && paris.hour < 12;
  if(urgent){
    return {
      level:"urgent",
      label:"Priorité : "+dashboardRunCountLabel(left)+
        " manquante"+(left > 1 ? "s" : "")+" avant le reset",
      remaining:left
    };
  }
  if(warning){
    return {
      level:"warning",
      label:"Il reste "+dashboardRunCountLabel(left)+" avant lundi 9 h",
      remaining:left
    };
  }
  return {
    level:"neutral",
    label:"Reset lundi 9 h · Encore "+dashboardRunCountLabel(left)+
      " disponible"+(left > 1 ? "s" : ""),
    remaining:left
  };
}

function buildDashboardState(input){
  const source = input || {};
  const userId = source.userId || "";
  const weekStart = source.weekStart || "";
  const sessions = (source.sessions || []).filter(session =>
    session &&
    session.week_start === weekStart &&
    (session.status === "open" || session.status === "archived")
  );
  const sessionById = new Map(sessions.map(session => [session.id, session]));
  const seen = new Set();
  const mine = (source.membership || []).filter(member => {
    if(!member || member.owner !== userId || !sessionById.has(member.session_id)){
      return false;
    }
    if(seen.has(member.session_id)) return false;
    seen.add(member.session_id);
    return true;
  });
  const reports = new Map(
    (source.reports || []).map(report => [report.session_id, report])
  );
  const ownTeamCount = (source.teams || []).filter(team =>
    team && team.owner === userId
  ).length;
  const groups = mine.map(member => {
    const session = sessionById.get(member.session_id);
    const report = reports.get(session.id) || null;
    return {
      id:session.id,
      slot:Number(session.slot) || 0,
      runNo:Number(session.run_no) || 1,
      title:session.title || "Groupe "+(session.slot || ""),
      status:session.status,
      completedAt:session.completed_at || null,
      memberCount:(source.membership || []).filter(row =>
        row && row.session_id === session.id
      ).length,
      teamSelected:!!member.team_snapshot,
      report:report ? {
        globalScore:String(report.global_score),
        note:String(report.note || "")
      } : null,
      canEditReport:session.status === "archived" && !!report
    };
  }).sort((a,b) => {
    if(a.status !== b.status) return a.status === "open" ? -1 : 1;
    if(a.status === "open" && a.teamSelected !== b.teamSelected){
      return a.teamSelected ? 1 : -1;
    }
    if(a.status === "archived"){
      const dateOrder = String(b.completedAt || "")
        .localeCompare(String(a.completedAt || ""));
      if(dateOrder) return dateOrder;
    }
    return a.slot - b.slot || a.runNo - b.runNo;
  });
  const completed = groups.filter(group => group.status === "archived").length;
  const open = groups.filter(group => group.status === "open").length;
  const engaged = groups.length;
  const remaining = Math.max(0, 3 - engaged);
  const actions = [];
  groups.filter(group => group.status === "open").forEach(group => {
    const type = group.teamSelected
      ? "view-group"
      : (ownTeamCount ? "choose-team" : "create-team");
    actions.push({
      type,
      sessionId:group.id,
      slot:group.slot,
      runNo:group.runNo,
      label:type === "view-group"
        ? "Voir le groupe"
        : (type === "choose-team" ? "Choisir mon équipe" : "Créer une équipe"),
      priority:group.teamSelected ? 2 : 1
    });
  });
  if(remaining > 0){
    actions.push({
      type:"find-group",
      sessionId:null,
      slot:null,
      runNo:null,
      label:"Trouver un groupe",
      priority:3
    });
  }
  groups
    .filter(group => group.canEditReport)
    .forEach(group => actions.push({
      type:"edit-report",
      sessionId:group.id,
      slot:group.slot,
      runNo:group.runNo,
      label:"Corriger le rapport",
      priority:4
    }));
  actions.sort((a,b) =>
    a.priority - b.priority ||
    (a.slot || 0) - (b.slot || 0) ||
    (a.runNo || 0) - (b.runNo || 0)
  );
  return {
    weekStart,
    engaged,
    completed,
    open,
    remaining,
    hasOwnTeams:ownTeamCount > 0,
    groups,
    actions,
    deadlineStatus:dashboardDeadlineStatus(source.now || new Date(), remaining),
    lastSyncedAt:Number(source.lastSyncedAt) || null,
    offline:!!source.offline
  };
}
```

- [ ] **Step 6: Vérifier les tests du modèle et la suite unitaire**

Run:

```powershell
node tests/mon-suivi.test.js
npm run test:unit
```

Expected: les deux commandes passent.

- [ ] **Step 7: Commit**

```powershell
git add index.html package.json tests/helpers/load-app.js tests/potentiel-commun.test.js tests/mon-suivi.test.js
git commit -m "feat: add personal dashboard model"
```

---

### Task 2: Vue connectée et chargement Supabase

**Files:**
- Modify: `index.html` dans les styles, la barre d’onglets, les panneaux, `applySession`, `showView`, `BossStore` et la section Boss
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `tests/accessibilite-mobile.playwright.js`

**Interfaces:**
- Consumes: `buildDashboardState`, `BossStore.ensureWeek`, `BossStore.listMembership`, `Store.refresh`, `currentUser`, `currentPseudo`.
- Produces:
  - éléments `#tab-dashboard`, `#view-dashboard`, `#dashboardBody`,
    `#dashboardStatus` et `#dashboardSyncMeta` ;
  - `BossStore.listWeek(weekStart): Promise<boss_sessions[]>` ;
  - `BossStore.listReportsForSessions(sessionIds): Promise<boss_run_reports[]>` ;
  - `DashboardStore.refresh(): Promise<DashboardState>` ;
  - `DashboardStore.current(): DashboardState | null` ;
  - `DashboardStore.reset(userId): void` ;
  - `renderDashboardView(options?): Promise<boolean>` ;
  - `renderDashboardContent(state): void`.

- [ ] **Step 1: Écrire le test rouge de navigation et de rendu connecté**

Dans `tests/accessibilite-mobile.playwright.js`, remplacer les assertions
figées à six onglets :

```js
assert.equal(await tabs.count(), 7);
assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");

await tabs.nth(0).focus();
await page.keyboard.press("ArrowRight");
assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
assert.equal(await page.locator("#view-dashboard").isVisible(), true);

await page.keyboard.press("End");
assert.equal(await tabs.nth(6).getAttribute("aria-selected"), "true");
assert.equal(await page.locator("#view-boss").isVisible(), true);
```

Dans `tests/supabase-etape1.playwright.js`, avant la connexion, vérifier que le
builder reste la vue initiale. Après la connexion, vérifier que « Mon suivi »
devient la vue active :

```js
assert.equal(await page.locator("#view-builder").isVisible(), true);
assert.equal(await page.locator("#view-dashboard").isVisible(), false);

await page.locator("#authEmail").fill("yannis@example.test");
await page.locator("#authPassword").fill("mot-de-passe-test");
await page.getByRole("button", { name:"Se connecter", exact:true }).click();

await page.locator("#view-dashboard").waitFor({ state:"visible" });
assert.equal(
  await page.locator("#tab-dashboard").getAttribute("aria-selected"),
  "true"
);
```

Après la création des six seeds par le tableau de bord, injecter une run
ouverte et une run archivée pour le membre, puis émettre Realtime :

```js
await page.evaluate(() => {
  const state = window.__fakeSupabaseState;
  const openRun = state.boss_sessions.find(run => run.slot === 2);
  const archivedRun = state.boss_sessions.find(run => run.slot === 4);
  archivedRun.status = "archived";
  archivedRun.completed_at = "2026-07-30T20:00:00.000Z";
  state.boss_participation.push(
    {
      session_id:openRun.id,
      owner:"user-1",
      pseudo:"Yannis",
      team_id:null,
      team_snapshot:null
    },
    {
      session_id:openRun.id,
      owner:"user-2",
      pseudo:"Merlin",
      team_id:"team-other",
      team_snapshot:{ id:"team-other" }
    },
    {
      session_id:archivedRun.id,
      owner:"user-1",
      pseudo:"Yannis",
      team_id:"team-own",
      team_snapshot:{ id:"team-own" }
    }
  );
  state.boss_run_reports.push({
    session_id:archivedRun.id,
    global_score:"9007199254740991",
    note:"Rapport exact",
    created_by:"user-1",
    created_by_pseudo:"Yannis",
    created_at:"2026-07-30T20:00:00.000Z",
    updated_by:null,
    updated_by_pseudo:null,
    updated_at:null
  });
});
await page.locator('.tab[data-view="dashboard"]').click();

await page.getByText("Runs engagées 2/3", { exact:true }).waitFor();
assert.match(await page.locator("#dashboardBody").textContent(), /Terminées\\s*1/);
assert.match(await page.locator("#dashboardBody").textContent(), /En cours\\s*1/);
assert.match(await page.locator("#dashboardBody").textContent(), /Encore disponibles\\s*1/);
assert.match(await page.locator("#dashboardBody").textContent(), /Groupe 2 · Run 1/);
assert.match(await page.locator("#dashboardBody").textContent(), /9\\s*007\\s*199\\s*254\\s*740\\s*991/);
```

- [ ] **Step 2: Exécuter les tests et confirmer l’échec**

Run:

```powershell
node tests/accessibilite-mobile.playwright.js
node tests/supabase-etape1.playwright.js
```

Expected: FAIL car le septième onglet et `#view-dashboard` n’existent pas.

- [ ] **Step 3: Ajouter l’onglet et le panneau**

Insérer l’onglet juste après « Créer une équipe » :

```html
<button class="tab" id="tab-dashboard" data-view="dashboard"
        role="tab" aria-controls="view-dashboard"
        aria-selected="false" tabindex="-1">Mon suivi</button>
```

Insérer le panneau juste avant le Team Builder :

```html
<section id="view-dashboard" class="view" role="tabpanel"
         aria-labelledby="tab-dashboard">
  <div class="dashboard-heading">
    <div>
      <p class="section-eyebrow">Boss de Guilde</p>
      <h1 class="section-title" id="dashboardTitle" tabindex="-1">Mon suivi</h1>
      <p class="section-lead">Tes trois runs de la semaine et la prochaine action utile.</p>
    </div>
    <div id="dashboardSyncMeta" class="dashboard-sync-meta"></div>
  </div>
  <div id="dashboardStatus" class="dashboard-status"
       role="status" aria-live="polite" aria-atomic="true"></div>
  <div id="dashboardBody"></div>
</section>
```

- [ ] **Step 4: Ajouter les lectures ciblées**

Étendre `BossStore` sans changer les méthodes utilisées par la vue Boss :

```js
async listWeek(weekStart){
  if(!currentUser || !sb) return [];
  const { data, error } = await sb.from("boss_sessions")
    .select("*")
    .eq("week_start", weekStart)
    .order("slot", {ascending:true})
    .order("run_no", {ascending:true});
  if(error) throw error;
  return data || [];
},
async listReportsForSessions(sessionIds){
  if(!currentUser || !sb || !sessionIds.length) return [];
  const reports = [];
  for(let start=0; start<sessionIds.length; start+=100){
    const batch = sessionIds.slice(start, start+100);
    const { data, error } = await sb.from("boss_run_reports")
      .select("*")
      .in("session_id", batch);
    if(error) throw error;
    reports.push(...(data || []));
  }
  return reports;
},
```

- [ ] **Step 5: Implémenter le store en ligne et le rendu orienté actions**

Créer `DashboardStore` à proximité de `BossStore`. La première version de ce
lot charge en ligne et possède déjà le garde de génération :

```js
const DashboardStore = (function(){
  let issued = 0;
  let ownerId = "";
  let state = null;

  function reset(userId){
    issued++;
    ownerId = userId || "";
    state = null;
  }

  function current(){
    return state;
  }

  async function refresh(){
    const userId = currentUser?.id || "";
    const week = currentBossWeek();
    if(!userId || !sb) throw new Error("AUTH_REQUIRED");
    if(ownerId !== userId) reset(userId);
    const requestId = ++issued;
    const isCurrent = () =>
      issued === requestId &&
      currentUser?.id === userId &&
      currentBossWeek().startDate === week.startDate;

    const teamsPromise = Store.refresh();
    await BossStore.ensureWeek(week);
    const sessions = await BossStore.listWeek(week.startDate);
    const sessionIds = sessions.map(session => session.id);
    const membershipPromise = BossStore.listMembership(sessionIds);
    const reportsPromise = BossStore.listReportsForSessions(sessionIds)
      .then(reports => ({ reports, reportsAvailable:true }))
      .catch(error => {
        if(isBossSchemaCompatibilityError(error)){
          return { reports:[], reportsAvailable:false };
        }
        throw error;
      });
    const [membership, reportResult, teams] = await Promise.all([
      membershipPromise,
      reportsPromise,
      teamsPromise
    ]);
    if(!isCurrent()) return state;
    state = Object.assign(buildDashboardState({
      userId,
      weekStart:week.startDate,
      sessions,
      membership,
      reports:reportResult.reports,
      teams,
      now:new Date(),
      lastSyncedAt:Date.now(),
      offline:false
    }), {
      userId,
      reportsAvailable:reportResult.reportsAvailable
    });
    return state;
  }

  return { current, refresh, reset };
})();
```

Lors de l’implémentation, ne conserver qu’un seul compteur de génération. Le
snippet montre le contrat : une réponse n’est appliquée que si la requête, le
compte et la semaine sont encore courants.

Ajouter des fonctions de rendu séparées :

```js
function dashboardProgressCell(label, value, className){
  return el("div",{class:"dashboard-progress-cell "+className},[
    el("strong",{text:String(value)}),
    el("span",{text:label})
  ]);
}

function dashboardActionButton(action){
  return el("button",{
    class:"btn "+(action.priority === 1 ? "btn-primary" : ""),
    type:"button",
    dataset:{
      dashboardAction:action.type,
      sessionId:action.sessionId || "",
      dashboardNetworkAction:[
        "choose-team",
        "view-group",
        "find-group",
        "edit-report"
      ].includes(action.type) ? "true" : "false"
    },
    text:action.label
  });
}
```

`renderDashboardContent(state)` doit :

1. vider `#dashboardBody` ;
2. afficher `Runs engagées X/3` ;
3. afficher les cellules Terminées, En cours et Encore disponibles ;
4. afficher « À faire maintenant » dans l’ordre de `state.actions` ;
5. afficher les cartes ouvertes avec groupe, run, `memberCount/5` et équipe
   sélectionnée/manquante ;
6. afficher les cartes terminées avec date, score formaté par
   `formatBossScore` ou message d’archive historique ;
7. afficher le bandeau `state.deadlineStatus` ;
8. afficher un avis de maintenance non bloquant si
   `state.reportsAvailable === false`.

`renderDashboardView()` doit gérer trois états :

```js
async function renderDashboardView(){
  const body = $("#dashboardBody");
  if(!currentUser){
    $("#dashboardSyncMeta").textContent = "";
    $("#dashboardStatus").textContent = "";
    body.replaceChildren(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Connecte-toi pour afficher ton suivi"}),
      el("button",{
        class:"btn btn-primary",
        type:"button",
        text:"Connexion",
        onclick:()=>openAuth()
      })
    ]));
    return true;
  }
  body.replaceChildren(el("div",{class:"empty-state"},[
    el("p",{class:"big",text:"Chargement du suivi…"})
  ]));
  $("#dashboardStatus").textContent = "Chargement du suivi";
  try{
    const state = await DashboardStore.refresh();
    if(!state) return true;
    renderDashboardContent(state);
    $("#dashboardStatus").textContent = "Suivi actualisé";
    return true;
  }catch(error){
    body.replaceChildren(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Suivi indisponible"}),
      el("p",{text:"Impossible de charger ton suivi pour le moment."}),
      el("button",{
        class:"btn btn-primary",
        type:"button",
        text:"Réessayer",
        onclick:()=>void renderDashboardView()
      })
    ]));
    $("#dashboardStatus").textContent = "Suivi indisponible";
    return false;
  }
}
```

- [ ] **Step 6: Brancher navigation et authentification**

Dans `showView(name)`, ajouter :

```js
if(name === "dashboard") void renderDashboardView();
```

Dans `applySession(session)` :

1. appeler `DashboardStore.reset(expectedUserId)` lorsque `sessionChanged` ;
2. après validation du profil et mise à jour du compte, appeler
   `showView(currentUser ? "dashboard" : "builder")` uniquement si
   `sessionChanged`.

Ne pas appeler `showView("dashboard")` lors d’un simple `TOKEN_REFRESHED` du
même compte.

- [ ] **Step 7: Ajouter les styles de base**

Ajouter près des styles Boss :

```css
.dashboard-heading,
.dashboard-summary-head,
.dashboard-card-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:16px
}
.dashboard-sync-meta{color:var(--muted);font-size:13px;text-align:right}
.dashboard-status{
  position:absolute;
  width:1px;
  height:1px;
  padding:0;
  margin:-1px;
  overflow:hidden;
  clip:rect(0,0,0,0);
  white-space:nowrap;
  border:0
}
.dashboard-summary,
.dashboard-actions-panel,
.dashboard-section,
.dashboard-deadline{
  border:1px solid var(--line);
  background:linear-gradient(145deg,rgba(35,27,42,.96),rgba(20,16,26,.96));
  border-radius:14px;
  padding:18px;
  margin-top:16px
}
.dashboard-progress{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
  margin-top:14px
}
.dashboard-progress-cell,
.dashboard-action-row,
.dashboard-run-card{
  min-width:0;
  border:1px solid rgba(199,167,91,.22);
  border-radius:12px;
  background:rgba(255,255,255,.025)
}
.dashboard-progress-cell{padding:14px;text-align:center}
.dashboard-progress-cell strong{display:block;font-size:24px;color:var(--gold)}
.dashboard-progress-cell span{display:block;color:var(--muted)}
.dashboard-action-list,
.dashboard-run-list{display:grid;gap:10px;margin-top:12px}
.dashboard-action-row,
.dashboard-run-card{padding:14px}
.dashboard-action-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.dashboard-run-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.dashboard-deadline[data-level="complete"]{border-color:rgba(111,176,138,.6)}
.dashboard-deadline[data-level="warning"]{border-color:rgba(199,167,91,.7)}
.dashboard-deadline[data-level="urgent"]{border-color:rgba(190,74,85,.8)}
```

Employer les variables déjà définies dans le thème. Si le nom exact d’une
variable n’existe pas, utiliser la valeur héraldique déjà présente dans les
styles Boss au lieu d’introduire une nouvelle palette.

- [ ] **Step 8: Vérifier le rendu en ligne**

Run:

```powershell
node tests/accessibilite-mobile.playwright.js
node tests/supabase-etape1.playwright.js
```

Expected: PASS, avec sept onglets et les compteurs `2/3`, `1`, `1`, `1`.

- [ ] **Step 9: Commit**

```powershell
git add index.html tests/supabase-etape1.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "feat: add mon suivi dashboard view"
```

---

### Task 3: Cache hors ligne, concurrence et Realtime

**Files:**
- Modify: `index.html` dans `DashboardStore`, `renderDashboardView` et `RealtimeSync`
- Modify: `tests/mon-suivi.test.js`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `DashboardStore.refresh`, la fonction privée `activeView()` de
  `RealtimeSync`, `localStorage`.
- Produces:
  - `DASHBOARD_CACHE_PREFIX = "confrerie7ds.cloud.dashboard."`
  - `DASHBOARD_CACHE_VERSION = 1`
  - `dashboardCacheKey(userId, weekStart): string`
  - `readDashboardCache(userId, weekStart): DashboardState | null`
  - `writeDashboardCache(userId, state): void`
  - `DashboardStore.markDirty(): void`
  - `DashboardStore.isDirty(): boolean`
  - `DashboardStore.refresh(): Promise<DashboardState>`
  - `renderDashboardView({ showLoading?, force? }): Promise<boolean>`

- [ ] **Step 1: Ajouter les tests rouges du cache**

Étendre `tests/mon-suivi.test.js` et les hooks de
`tests/helpers/load-app.js` avec :

```js
dashboardCacheKey,
readDashboardCache,
writeDashboardCache
```

Ajouter :

```js
{
  const { hooks:cacheHooks, localStorage } = loadApp();
  const cached = {
    weekStart:"2026-07-27",
    engaged:2,
    completed:1,
    open:1,
    remaining:1,
    groups:[{
      id:"run-archived",
      report:{ globalScore:"9007199254740991", note:"Exact" }
    }],
    actions:[],
    deadlineStatus:{ level:"neutral", label:"Reset lundi 9 h", remaining:1 },
    lastSyncedAt:1234,
    offline:false
  };
  cacheHooks.writeDashboardCache("user-1", cached);
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-07-27")
      .groups[0].report.globalScore,
    "9007199254740991"
  );
  assert.equal(
    cacheHooks.readDashboardCache("user-2", "2026-07-27"),
    null
  );
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-08-03"),
    null
  );
  localStorage.setItem(
    cacheHooks.dashboardCacheKey("user-1", "2026-07-27"),
    JSON.stringify({ version:999, userId:"user-1", weekStart:"2026-07-27" })
  );
  assert.equal(
    cacheHooks.readDashboardCache("user-1", "2026-07-27"),
    null
  );
}
```

- [ ] **Step 2: Écrire les tests Playwright rouges de résilience**

Dans `tests/supabase-etape1.playwright.js`, après le premier rendu valide :

```js
const dashboardCacheKey = await page.evaluate(() => {
  const weekStart = window.__fakeSupabaseState.boss_sessions[0].week_start;
  return "confrerie7ds.cloud.dashboard.user-1."+weekStart;
});
assert.equal(
  await page.evaluate(key => localStorage.getItem(key) !== null, dashboardCacheKey),
  true
);

await page.locator('.tab[data-view="builder"]').click();
await page.evaluate(() => {
  window.__fakeSupabaseState.bossReadFailureOnce = {
    table:"boss_sessions",
    message:"Réseau dashboard indisponible"
  };
  window.__fakeSupabaseEmit("boss_participation", "UPDATE");
});
await page.locator('.tab[data-view="dashboard"]').click();
await page.getByText("Hors ligne", {exact:true}).waitFor();
assert.match(await page.locator("#dashboardBody").textContent(), /Runs engagées 2\\/3/);

await page.evaluate(key => {
  localStorage.removeItem(key);
  window.__fakeSupabaseApplySession(null);
}, dashboardCacheKey);
await page.waitForFunction(() =>
  document.querySelector("#view-builder").classList.contains("active")
);
await page.evaluate(() => {
  window.__fakeSupabaseState.bossReadFailureOnce = {
    table:"boss_sessions",
    message:"Réseau dashboard toujours indisponible"
  };
  window.__fakeSupabaseApplySession({
    id:"user-1",
    email:"yannis@example.test"
  });
});
await page.getByText("Suivi indisponible hors ligne", {exact:true}).waitFor();
assert.doesNotMatch(await page.locator("#dashboardBody").textContent(), /0\\/3/);
assert.equal(await page.locator(".dashboard-progress").count(), 0);
await page.getByRole("button", {name:"Réessayer", exact:true}).click();
await page.getByText("Runs engagées 2/3", {exact:true}).waitFor();
```

Ajouter ensuite les scénarios Realtime :

```js
await page.evaluate(() => {
  window.__fakeSupabaseState.calls.length = 0;
  window.__fakeSupabaseEmit("boss_participation", "UPDATE");
});
await page.waitForFunction(() =>
  window.__fakeSupabaseState.calls.some(call =>
    call.table === "boss_sessions" && call.operation === "select"
  )
);

await page.locator('.tab[data-view="builder"]').click();
await page.evaluate(() => {
  window.__fakeSupabaseState.calls.length = 0;
  window.__fakeSupabaseEmit("boss_participation", "UPDATE");
});
await page.waitForTimeout(180);
assert.equal(
  await page.evaluate(() =>
    window.__fakeSupabaseState.calls.some(call =>
      call.table === "boss_sessions" && call.operation === "select"
    )
  ),
  false,
  "Realtime ne doit pas relire le dashboard inactif"
);
await page.locator('.tab[data-view="dashboard"]').click();
await page.waitForFunction(() =>
  window.__fakeSupabaseState.calls.some(call =>
    call.table === "boss_sessions" && call.operation === "select"
  )
);
```

Ajouter la course réseau avec les helpers déjà présents :

```js
await page.locator('.tab[data-view="builder"]').click();
await page.evaluate(() => {
  window.__fakeSupabaseQueueBossRead("dashboard-old", "boss_sessions");
  window.__fakeSupabaseEmit("boss_participation", "UPDATE");
});
await page.locator('.tab[data-view="dashboard"]').click();
await page.waitForFunction(() =>
  window.__fakeSupabaseState.bossReadQueue.some(item =>
    item.token === "dashboard-old" && item.claimed
  )
);

await page.locator('.tab[data-view="builder"]').click();
await page.evaluate(() => {
  const run = window.__fakeSupabaseState.boss_sessions.find(item =>
    item.slot === 2 && item.status === "open"
  );
  run.title = "Groupe actualisé";
  window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
});
await page.locator('.tab[data-view="dashboard"]').click();
await page.getByText(/Groupe actualisé · Run 1/).waitFor();
await page.evaluate(() =>
  window.__fakeSupabaseReleaseQueuedBossRead("dashboard-old")
);
await page.waitForFunction(() =>
  window.__fakeSupabaseState.bossReadQueue.some(item =>
    item.token === "dashboard-old" && item.finished
  )
);
assert.match(await page.locator("#dashboardBody").textContent(), /Groupe actualisé/);
```

Ajouter ensuite la fuite entre comptes :

```js
await page.locator('.tab[data-view="builder"]').click();
await page.evaluate(() => {
  window.__fakeSupabaseQueueBossRead("dashboard-user-1", "boss_sessions");
  window.__fakeSupabaseEmit("boss_sessions", "UPDATE");
});
await page.locator('.tab[data-view="dashboard"]').click();
await page.waitForFunction(() =>
  window.__fakeSupabaseState.bossReadQueue.some(item =>
    item.token === "dashboard-user-1" && item.claimed
  )
);
await page.evaluate(() => window.__fakeSupabaseApplySession({
  id:"user-2",
  email:"merlin@example.test"
}));
await page.locator("#accountPseudo").getByText("Merlin", {exact:true}).waitFor();
await page.getByText("Runs engagées 0/3", {exact:true}).waitFor();
await page.evaluate(() =>
  window.__fakeSupabaseReleaseQueuedBossRead("dashboard-user-1")
);
await page.waitForTimeout(50);
assert.equal(await page.locator("#accountPseudo").textContent(), "Merlin");
assert.match(await page.locator("#dashboardBody").textContent(), /Runs engagées 0\\/3/);
assert.doesNotMatch(await page.locator("#dashboardBody").textContent(), /Groupe actualisé/);
await page.evaluate(() => window.__fakeSupabaseApplySession({
  id:"user-1",
  email:"yannis@example.test"
}));
await page.locator("#accountPseudo").getByText("Yannis", {exact:true}).waitFor();
```

- [ ] **Step 3: Exécuter les tests et confirmer l’échec**

Run:

```powershell
node tests/mon-suivi.test.js
node tests/supabase-etape1.playwright.js
```

Expected: FAIL sur les fonctions de cache et sur le badge hors ligne.

- [ ] **Step 4: Implémenter le cache strict**

Ajouter :

```js
const DASHBOARD_CACHE_PREFIX = "confrerie7ds.cloud.dashboard.";
const DASHBOARD_CACHE_VERSION = 1;

function dashboardCacheKey(userId, weekStart){
  return DASHBOARD_CACHE_PREFIX+userId+"."+weekStart;
}

function readDashboardCache(userId, weekStart){
  if(!userId || !weekStart) return null;
  try{
    const raw = localStorage.getItem(dashboardCacheKey(userId, weekStart));
    if(!raw) return null;
    const envelope = JSON.parse(raw);
    if(
      !envelope ||
      envelope.version !== DASHBOARD_CACHE_VERSION ||
      envelope.userId !== userId ||
      envelope.weekStart !== weekStart ||
      !envelope.state
    ) return null;
    return Object.assign({}, envelope.state, {
      offline:true,
      userId
    });
  }catch(error){
    return null;
  }
}

function writeDashboardCache(userId, state){
  if(!userId || !state || !state.weekStart) return;
  try{
    localStorage.setItem(
      dashboardCacheKey(userId, state.weekStart),
      JSON.stringify({
        version:DASHBOARD_CACHE_VERSION,
        userId,
        weekStart:state.weekStart,
        savedAt:Date.now(),
        state:Object.assign({}, state, { offline:false })
      })
    );
  }catch(error){
    // Un quota local indisponible ne doit jamais casser la vue en ligne.
  }
}
```

Ne jamais chercher « le dernier cache » sans compte : l’identité et la semaine
doivent être connues avant la lecture.

- [ ] **Step 5: Durcir `DashboardStore`**

Le store doit conserver :

```js
let issued = 0;
let ownerId = "";
let state = null;
let dirty = true;
```

Règles exactes :

- `reset(userId)` incrémente `issued`, remplace `ownerId`, vide `state` et met
  `dirty = true` ;
- `markDirty()` met seulement `dirty = true` ;
- `isDirty()` renvoie `dirty` ;
- un succès valide met `dirty = false`, écrit le cache et conserve
  `offline:false` ;
- une erreur valide lit uniquement le cache du même `userId` et de la même
  `week.startDate`, le conserve avec `offline:true`, puis le renvoie ;
- une erreur sans cache est relancée ;
- une réponse périmée ne modifie ni `state`, ni le cache, ni le DOM ;
- un score est déjà une chaîne grâce à `buildDashboardState`.

Le garde courant doit capturer une seule génération :

```js
const requestId = ++issued;
const userId = currentUser?.id || "";
const weekStart = currentBossWeek().startDate;
const isCurrent = () =>
  issued === requestId &&
  currentUser?.id === userId &&
  currentBossWeek().startDate === weekStart;
```

- [ ] **Step 6: Rendre les états hors ligne**

Quand l’état renvoyé a `offline:true` :

```js
$("#dashboardSyncMeta").replaceChildren(
  el("span",{class:"dashboard-offline-badge",text:"Hors ligne"}),
  el("span",{
    text:state.lastSyncedAt
      ? "Dernière synchronisation "+frDateTime(
          new Date(state.lastSyncedAt).toISOString()
        )
      : "Dernière synchronisation inconnue"
  })
);
```

Ajouter un texte visible « Données potentiellement anciennes », désactiver les
boutons portant `data-dashboard-network-action="true"` et ajouter
**« Réessayer »**.

Sans cache, rendre exactement :

```text
Suivi indisponible hors ligne
Reconnecte-toi puis réessaie. Aucun compteur fiable n’est disponible.
```

Ne pas créer les éléments de progression dans ce cas.

- [ ] **Step 7: Brancher Realtime sans double lecture**

Dans `RealtimeSync.flush()`, calculer :

```js
const dashboardChanged =
  changed.has("teams") || changed.has("boss");
```

Puis :

```js
if(dashboardChanged){
  if(view === "dashboard"){
    const refreshed = await renderDashboardView({
      showLoading:false,
      force:true
    });
    if(!refreshed) throw new Error("DASHBOARD_SYNC_FAILED");
  }else{
    DashboardStore.markDirty();
  }
}
```

Quand `view === "dashboard"`, ne pas exécuter en plus les branches séparées
`Store.refresh()` ou `renderBossView()` pour le même lot d’événements. Les vues
Roster et Boss conservent leur comportement actuel lorsqu’elles sont actives.

Dans `renderDashboardView(options)`, si l’état existe et
`!DashboardStore.isDirty()` et que `force !== true`, rendre cet état sans
nouvelle lecture. Une ouverture après `markDirty()` relance la lecture.

- [ ] **Step 8: Vérifier cache, Realtime et courses**

Run:

```powershell
node tests/mon-suivi.test.js
node tests/supabase-etape1.playwright.js
```

Expected: PASS pour le cache isolé, l’état hors ligne, le marquage sale et les
deux courses.

- [ ] **Step 9: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/mon-suivi.test.js tests/supabase-etape1.playwright.js
git commit -m "feat: make mon suivi resilient offline"
```

---

### Task 4: Actions directes et restitution du focus

**Files:**
- Modify: `index.html` dans `showView`, les actions Builder, les helpers Boss et le rendu Dashboard
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `DashboardAction`, `renderBossView`, `bossViewState`,
  `openBossTeamPicker`, `openBossReport`, `ModalStack`, `showView`.
- Produces:
  - `resetTeamDraft(): void`
  - `showView(name): Promise<boolean>`
  - `openDashboardBossTarget(sessionId, mode): Promise<void>`
  - `runDashboardAction(action): Promise<void>`

- [ ] **Step 1: Écrire les tests rouges des actions**

Dans `tests/supabase-etape1.playwright.js`, tester successivement :

```js
await page.locator(
  '[data-dashboard-action="choose-team"][data-session-id]'
).click();
await page.locator("#bossTeamOverlay").waitFor({state:"visible"});
assert.equal(
  await page.locator("#bossTeamOverlay").getAttribute("aria-hidden"),
  "false"
);
await page.locator("#bossTeamClose").click();
await page.waitForFunction(() =>
  document.querySelector("#view-boss").contains(document.activeElement)
);
```

Pour **Voir le groupe** :

```js
await page.locator('.tab[data-view="dashboard"]').click();
await page.locator('[data-dashboard-action="view-group"]').click();
await page.locator("#view-boss").waitFor({state:"visible"});
assert.equal(
  await page.evaluate(() =>
    document.activeElement.closest("[data-session-id]")?.dataset.sessionId
  ),
  await page.locator('[data-dashboard-action="view-group"]')
    .getAttribute("data-session-id")
);
```

Conserver l’ID avant le clic dans une variable Playwright, car le bouton du
dashboard devient caché après la navigation.

Pour **Corriger le rapport** :

```js
await page.locator('.tab[data-view="dashboard"]').click();
await page.locator('[data-dashboard-action="edit-report"]').click();
await page.locator("#bossReportOverlay").waitFor({state:"visible"});
assert.equal(
  await page.locator("#bossReportTitle").textContent(),
  "Corriger le rapport"
);
await page.locator("#bossReportClose").click();
await page.waitForFunction(() =>
  document.querySelector("#view-boss").contains(document.activeElement)
);
```

Pour **Créer une équipe**, retirer temporairement toutes les équipes
propriétaires de `user-1`, actualiser le dashboard, cliquer l’action et vérifier :

```js
assert.equal(await page.locator("#view-builder").isVisible(), true);
assert.equal(await page.locator("#editFlag").isVisible(), false);
assert.equal(
  await page.locator(".hero .portrait img").count(),
  0
);
```

Pour **Trouver un groupe**, vérifier que l’onglet Boss est actif et que le
premier bouton Rejoindre disponible reçoit le focus.

Pour **Voir mes équipes**, vérifier que l’onglet des équipes est actif et que
son titre reçoit le focus.

Enfin, modifier les données entre le clic et le rendu Boss pour vérifier qu’un
groupe archivé ou un rapport disparu produit un toast compréhensible sans
ouvrir une modale périmée.

- [ ] **Step 2: Exécuter le test et confirmer l’échec**

Run:

```powershell
node tests/supabase-etape1.playwright.js
```

Expected: FAIL car les boutons n’ont encore aucun gestionnaire.

- [ ] **Step 3: Rendre `showView` awaitable**

Faire retourner la promesse de rendu sans casser les appels existants :

```js
function showView(name){
  // Conserver ici la mise à jour ARIA et des classes existante.
  let result = Promise.resolve(true);
  if(name === "builder") renderBuilder();
  if(name === "roster") result = Promise.resolve(renderRoster()).then(()=>true);
  if(name === "member-roster"){
    result = Promise.resolve(renderMemberRoster()).then(()=>true);
  }
  if(name === "recensement"){
    result = Promise.resolve(renderRecensement()).then(()=>true);
  }
  if(name === "analyse"){
    result = Promise.resolve(renderAnalyse()).then(()=>true);
  }
  if(name === "boss") result = renderBossView();
  if(name === "dashboard") result = renderDashboardView();
  // Conserver le scroll réduit existant.
  return result;
}
```

Les écouteurs existants peuvent continuer d’ignorer la valeur de retour.

- [ ] **Step 4: Factoriser la création d’une équipe vide**

Remplacer le corps du clic `#btnNew` par :

```js
function resetTeamDraft(){
  draft = emptyDraft();
  editing = false;
  renderBuilder();
}

$("#btnNew").addEventListener("click", ()=>{
  resetTeamDraft();
  toast("Nouvelle équipe prête.");
});
```

Ajouter `id="builderTitle" tabindex="-1"` au titre du builder et
`id="rosterTitle" tabindex="-1"` au titre de la liste d’équipes.

- [ ] **Step 5: Implémenter les cibles Boss**

Ajouter :

```js
function dashboardBossCard(sessionId){
  return [...$("#bossBody").querySelectorAll("[data-session-id]")]
    .find(node => node.dataset.sessionId === sessionId) || null;
}

async function openDashboardBossTarget(sessionId, mode){
  const loaded = await showView("boss");
  if(!loaded){
    toast("Le groupe n’a pas pu être chargé.", true);
    return;
  }
  const group = (bossViewState.allGroups || [])
    .find(item => item.id === sessionId);
  if(!group){
    toast("Cette run n’est plus disponible.", true);
    return;
  }
  const card = dashboardBossCard(sessionId);
  if(card) card.scrollIntoView({ block:"center", behavior:"smooth" });

  if(mode === "choose-team"){
    const member = (bossViewState.membership || []).find(item =>
      item.session_id === sessionId &&
      item.owner === currentUser?.id
    );
    const trigger = card && card.querySelector('[data-boss-action="team"]');
    if(!member || group.status !== "open" || !trigger){
      toast("Cette run n’accepte plus de sélection d’équipe.", true);
      if(card) card.focus();
      return;
    }
    trigger.focus();
    await openBossTeamPicker(group, member);
    return;
  }

  if(mode === "edit-report"){
    const trigger = card && card.querySelector(
      '[data-boss-action="report-edit"]'
    );
    const report = (bossViewState.reports || []).find(item =>
      item.session_id === sessionId
    );
    if(group.status !== "archived" || !report || !trigger){
      toast("Ce rapport n’est plus modifiable.", true);
      if(card) card.focus();
      return;
    }
    trigger.focus();
    openBossReport(group, "edit");
    return;
  }

  if(card){
    card.setAttribute("tabindex", "-1");
    card.focus();
  }else{
    $("#tab-boss").focus();
  }
}
```

Pour une carte d’archive, `dashboardBossCard` doit retrouver
`.boss-report-card`; pour une run ouverte, `.boss-card`.

- [ ] **Step 6: Implémenter le routeur d’actions**

```js
async function runDashboardAction(action){
  if(!action) return;
  if(action.type === "choose-team" ||
     action.type === "view-group" ||
     action.type === "edit-report"){
    await openDashboardBossTarget(action.sessionId, action.type);
    return;
  }
  if(action.type === "create-team"){
    resetTeamDraft();
    await showView("builder");
    $("#builderTitle").focus();
    return;
  }
  if(action.type === "view-teams"){
    await showView("roster");
    $("#rosterTitle").focus();
    return;
  }
  if(action.type === "find-group"){
    const loaded = await showView("boss");
    if(!loaded) return;
    const target = $("#bossBody").querySelector(
      '.boss-card:not(.mine) .boss-join:not([disabled])'
    );
    (target || $("#tab-boss")).focus();
  }
}
```

Dans `dashboardActionButton`, ajouter :

```js
onclick:()=>void runDashboardAction(action)
```

Ajouter l’action secondaire **« Voir mes équipes »** dans une carte à équipe
manquante lorsque `state.hasOwnTeams === true`. Cette action utilise le type
`view-teams`, n’est pas une mutation réseau et ne remplace pas **« Choisir mon
équipe »**.

- [ ] **Step 7: Vérifier les actions et le focus**

Run:

```powershell
node tests/supabase-etape1.playwright.js
```

Expected: PASS pour les six destinations, la fermeture des modales et les
données devenues périmées.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/supabase-etape1.playwright.js
git commit -m "feat: connect mon suivi actions"
```

---

### Task 5: Mobile, accessibilité, documentation et validation finale

**Files:**
- Modify: `index.html` dans les media queries et les attributs accessibles
- Modify: `tests/accessibilite-mobile.playwright.js`
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: DOM final de « Mon suivi ».
- Produces: comportement validé entre 320 et 390 px, documentation de reprise
  et suite complète verte.

- [ ] **Step 1: Écrire les assertions mobiles rouges**

Dans le parcours authentifié de `tests/supabase-etape1.playwright.js`, pour
chaque largeur `[320, 360, 375, 390]` :

```js
for(const width of [320, 360, 375, 390]){
  await page.setViewportSize({ width, height:844 });
  await page.locator('.tab[data-view="dashboard"]').click();
  await page.locator("#dashboardBody").waitFor();
  const metrics = await page.evaluate(() => {
    const root = document.scrollingElement;
    const controls = [...document.querySelectorAll(
      "#view-dashboard button:not([hidden])"
    )].filter(node => node.getClientRects().length).map(node => {
      const rect = node.getBoundingClientRect();
      return { width:rect.width, height:rect.height, right:rect.right };
    });
    const cards = [...document.querySelectorAll(
      "#view-dashboard .dashboard-run-card"
    )].map(node => {
      const rect = node.getBoundingClientRect();
      return { left:rect.left, right:rect.right, width:rect.width };
    });
    return {
      viewport:document.documentElement.clientWidth,
      overflow:root.scrollWidth-root.clientWidth,
      controls,
      cards
    };
  });
  assert.ok(metrics.overflow <= 1, `Mon suivi déborde à ${width}px`);
  metrics.controls.forEach(control => {
    assert.ok(control.height >= 44, `Action inférieure à 44 px à ${width}px`);
    assert.ok(control.right <= metrics.viewport + 1);
  });
  metrics.cards.forEach(card => {
    assert.ok(card.left >= 0 && card.right <= metrics.viewport + 1);
  });
}
```

Dans `tests/accessibilite-mobile.playwright.js` :

- parcourir le nouvel onglet avec Flèche droite, Flèche gauche, Début et Fin ;
- ouvrir « Mon suivi » déconnecté, cliquer **Connexion**, fermer par Échap et
  vérifier que le focus revient sur le bouton qui a ouvert la modale ;
- vérifier que les états Terminées / En cours / Encore disponibles possèdent
  chacun un texte, pas seulement une classe de couleur.

- [ ] **Step 2: Exécuter les tests et confirmer l’échec mobile**

Run:

```powershell
node tests/accessibilite-mobile.playwright.js
node tests/supabase-etape1.playwright.js
```

Expected: FAIL sur au moins une largeur ou une cible tactile avant les derniers
styles.

- [ ] **Step 3: Ajouter les règles responsive**

Dans la media query mobile existante :

```css
@media(max-width:700px){
  .dashboard-heading,
  .dashboard-summary-head,
  .dashboard-card-head,
  .dashboard-action-row{
    align-items:stretch;
    flex-direction:column
  }
  .dashboard-sync-meta{text-align:left}
  .dashboard-progress{grid-template-columns:1fr}
  .dashboard-run-grid{grid-template-columns:1fr}
  .dashboard-action-row .btn,
  .dashboard-run-card .btn{
    width:100%;
    min-height:44px
  }
}
```

Ajouter sur les blocs flex/grid concernés :

```css
#view-dashboard,
#dashboardBody,
.dashboard-summary,
.dashboard-actions-panel,
.dashboard-section,
.dashboard-run-grid,
.dashboard-run-card{
  min-width:0;
  max-width:100%
}
.dashboard-run-card,
.dashboard-run-card *{
  overflow-wrap:anywhere
}
```

Les scores utilisent `formatBossScore` et peuvent se couper entre groupes de
chiffres, mais ne doivent jamais créer un défilement horizontal.

- [ ] **Step 4: Vérifier les annonces et les focus**

S’assurer que :

- `#dashboardStatus` annonce seulement chargement, succès, hors ligne ou erreur,
  pas tout le contenu des cartes ;
- le badge « Hors ligne » reste visible sans dépendre de sa couleur ;
- les boutons désactivés hors ligne conservent un texte expliquant pourquoi ;
- le titre ciblé par une navigation possède `tabindex="-1"` ;
- fermer les modales Team ou Rapport ouvertes depuis le dashboard restaure le
  focus dans la vue Boss, jamais dans le panneau Dashboard désormais caché.

- [ ] **Step 5: Documenter l’état final**

Dans `AGENTS.md` :

1. mettre la date d’état à `2026-07-27` ;
2. ajouter dans la liste d’état :

```markdown
- [x] **Tableau de bord personnel « Mon suivi »**. Vue Boss orientée actions,
      affichée par défaut après connexion : runs engagées/terminées/en cours,
      équipe manquante, accès ciblé au groupe ou au rapport et urgence calculée
      en heure de Paris. État dérivé des tables existantes, sans migration
      Supabase. Cache hors ligne séparé par compte et semaine.
```

3. documenter la clé :

```markdown
`confrerie7ds.cloud.dashboard.<userId>.<weekStart>`
```

4. compléter la section Realtime : la vue active se recharge silencieusement ;
   la vue inactive est seulement marquée sale ;
5. préciser que `teams`, `boss_sessions`, `boss_participation` et
   `boss_run_reports` restent les seules sources d’autorité.

Ne pas indiquer qu’il faut rejouer `supabase/schema.sql` pour cette
fonctionnalité.

- [ ] **Step 6: Exécuter les tests ciblés**

Run:

```powershell
node tests/mon-suivi.test.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: les trois commandes passent.

- [ ] **Step 7: Exécuter toute la validation**

Run:

```powershell
npm test
git diff --check
git status --short
git diff --name-only main...HEAD -- supabase/schema.sql supabase-config.js
```

Expected:

- `npm test` passe intégralement ;
- `git diff --check` ne remonte aucune erreur ;
- seuls les fichiers annoncés dans ce plan sont modifiés ;
- la dernière commande ne produit aucune sortie.

- [ ] **Step 8: Relecture fonctionnelle manuelle**

Ouvrir `index.html` et vérifier :

1. déconnecté : Team Builder initial, « Mon suivi » demande la connexion ;
2. connecté : « Mon suivi » devient la vue par défaut ;
3. zéro run : aucune fausse run terminée et action « Trouver un groupe » ;
4. run sans équipe : action « Choisir mon équipe » ou « Créer une équipe » ;
5. run prête : « Voir le groupe » ;
6. archive avec rapport : score exact et « Corriger le rapport » ;
7. archive sans rapport : message historique sans correction ;
8. trois runs engagées : « Semaine complète » sans invitation supplémentaire ;
9. perte réseau : cache, badge, date, avertissement et « Réessayer » ;
10. retour réseau : état actualisé et actions réactivées.

- [ ] **Step 9: Commit final**

```powershell
git add index.html tests/accessibilite-mobile.playwright.js tests/supabase-etape1.playwright.js AGENTS.md
git commit -m "docs: finalize mon suivi dashboard"
```

- [ ] **Step 10: Préparer la revue sans fusion ni push**

Run:

```powershell
git log --oneline --decorate -5
git diff --stat main...HEAD
git status --short --branch
```

Expected: cinq commits propres au maximum pour cette fonctionnalité, worktree
propre, branche locale non fusionnée et non poussée.

Présenter à l’utilisateur :

- la branche ou le worktree utilisé ;
- les cinq résultats principaux ;
- le résultat exact de `npm test` ;
- la confirmation « aucune migration Supabase » ;
- les commandes simples pour tester localement ;
- le choix explicite entre conserver, corriger ou fusionner.
