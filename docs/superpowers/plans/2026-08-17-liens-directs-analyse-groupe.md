# Liens directs et analyse de groupe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner une URL stable à chaque vue de NOVA et permettre d’ouvrir, partager et analyser la composition actuelle d’un groupe de boss.

**Architecture:** La syntaxe des routes reste dans un module métier pur, tandis qu’un contrôleur de vue synchronise `history`, l’authentification et les gestionnaires de routes spécialisées. Les vues Boss et Analyse enregistrent chacune leur gestionnaire afin d’éviter tout cycle d’import ; l’Analyse conserve un contexte de groupe explicite qui filtre tous ses panneaux avant rendu.

**Tech Stack:** JavaScript ES modules sans build, DOM natif, History API, Clipboard API, Supabase JS existant, tests Node `assert`, Playwright, CSS Grid/Flexbox.

**Spec:** `docs/superpowers/specs/2026-08-17-liens-directs-analyse-groupe-design.md`

## Global Constraints

- Le site reste statique et compatible GitHub Pages : toutes les routes utilisent un fragment commençant par `#`.
- Les routes stables sont exactement `dashboard`, `builder`, `roster`, `member-roster`, `availability`, `boss`, `analyse`, `wiki` et `collection`.
- Les routes spécialisées sont exactement `#boss/groupe/<session-id>` et `#analyse/groupe/<session-id>`.
- Un identifiant de session accepte uniquement 1 à 128 caractères ASCII parmi `A-Z`, `a-z`, `0-9`, `_` et `-` ; toute autre forme est rejetée avant lecture Supabase.
- Aucun nouveau paquet, aucune table, aucune politique RLS, aucune RPC et aucune migration Supabase.
- Le contexte de groupe est relu à chaque ouverture, mais ne reçoit aucun abonnement Realtime dédié.
- Le filtre manuel par membre continue de ne modifier que la matrice DPS.
- Les nouvelles cibles interactives mesurent au moins 44 px et aucune vue ne déborde horizontalement entre 320 et 390 px.
- Tout nouveau module est ajouté à `tests/helpers/modules.js` et à `sw.js` dans `CORE_ASSETS`.
- `npm test` doit réussir avant tout push.

---

## File Map

- Create `js/metier/routage.js`: contrat pur des routes, validation des identifiants, fragments et URL absolues.
- Create `js/vues/routage.js`: coordination History API, reprise après connexion et registre des gestionnaires spécialisés.
- Modify `js/vues/navigation.js`: mise à jour canonique du fragment lors d’un `showView()` normal.
- Modify `js/vues/session-auth.js`: priorité à la route courante lors du premier passage vers un compte connecté.
- Modify `js/vues/boss-sessions.js`: actions de groupe, copie, ciblage et états de route Boss.
- Modify `js/donnees/boss-store.js`: lecture ciblée et non mutante d’une session.
- Modify `js/vues/analyse.js`: contexte de groupe, filtrage global, bandeau et états d’erreur.
- Modify `js/app.js`: initialisation du routage après enregistrement des vues et avant l’authentification.
- Modify `css/boss.css`, `css/analyse.css`, `css/responsive.css`: actions secondaires et bandeau responsives.
- Modify `tests/helpers/modules.js`, `tests/helpers/load-app.js`, `sw.js`: déclaration et chargement des nouveaux modules.
- Create `tests/routage.test.js`: contrat pur des fragments et URL.
- Create `tests/routage-groupe.playwright.js`: historique, auth, cartes Boss, copie, analyse filtrée, erreurs et mobile.
- Modify `package.json`: exécution des deux nouveaux tests.

---

### Task 1: Contrat pur des routes

**Files:**
- Create: `js/metier/routage.js`
- Create: `tests/routage.test.js`
- Modify: `tests/helpers/modules.js` dans la couche `metier`
- Modify: `tests/helpers/load-app.js` dans `HOOK_EXPORT`
- Modify: `package.json` dans `scripts.test:unit`
- Modify: `sw.js` dans `CORE_ASSETS`

**Interfaces:**
- Produces: `ROUTE_SESSION_ID_MAX_LENGTH = 128`.
- Produces: `lireRoute(fragment: string): AppRoute | null`.
- Produces: `fragmentDeRoute(route: AppRoute): string | null`.
- Produces: `routeDeVue(view: string): AppRoute | null`.
- Produces: `urlAbsolueDeRoute(route: AppRoute, href: string): string | null`.
- `AppRoute` is `{ type:"view", view:string }` or `{ type:"group", view:"boss"|"analyse", sessionId:string }`.

- [ ] **Step 1: Add the module to the test loader and expose its pure hooks**

Insert `"metier/routage.js"` before the other domain modules in `tests/helpers/modules.js`, then expose these exact names from `HOOK_EXPORT`:

```js
  ROUTE_SESSION_ID_MAX_LENGTH:
    typeof ROUTE_SESSION_ID_MAX_LENGTH === "number"
      ? ROUTE_SESSION_ID_MAX_LENGTH
      : undefined,
  lireRoute:typeof lireRoute === "function" ? lireRoute : undefined,
  fragmentDeRoute:typeof fragmentDeRoute === "function"
    ? fragmentDeRoute
    : undefined,
  routeDeVue:typeof routeDeVue === "function" ? routeDeVue : undefined,
  urlAbsolueDeRoute:typeof urlAbsolueDeRoute === "function"
    ? urlAbsolueDeRoute
    : undefined,
```

- [ ] **Step 2: Write the failing route contract test**

Create `tests/routage.test.js` with assertions covering every stable view, both group routes, percent-decoding rejection, extra segments, empty IDs, forbidden characters, 128/129-character bounds, canonical serialization and preservation of the GitHub Pages pathname:

```js
"use strict";

const assert = require("node:assert/strict");
const { loadApp, plain } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  ROUTE_SESSION_ID_MAX_LENGTH,
  lireRoute,
  fragmentDeRoute,
  routeDeVue,
  urlAbsolueDeRoute
} = hooks;

const stableViews = [
  "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection"
];

stableViews.forEach(view => {
  assert.deepEqual(plain(lireRoute("#" + view)), { type:"view", view });
  assert.equal(fragmentDeRoute(routeDeVue(view)), "#" + view);
});

assert.equal(routeDeVue("calculateur"), null);
assert.deepEqual(plain(lireRoute("#boss/groupe/run_2026-08-17")), {
  type:"group", view:"boss", sessionId:"run_2026-08-17"
});
assert.deepEqual(plain(lireRoute("#analyse/groupe/abc-123")), {
  type:"group", view:"analyse", sessionId:"abc-123"
});
assert.equal(ROUTE_SESSION_ID_MAX_LENGTH, 128);
assert.ok(lireRoute("#boss/groupe/" + "a".repeat(128)));
[
  "", "#", "#inconnue", "#boss/groupe/", "#boss/groupe/a/b",
  "#analyse/groupe/%2F", "#analyse/groupe/espace%20interdit",
  "#analyse/groupe/" + "a".repeat(129), "#analyse/groupe/%E0%A4%A"
].forEach(fragment => assert.equal(lireRoute(fragment), null, fragment));

const groupRoute = { type:"group", view:"boss", sessionId:"abc-123" };
assert.equal(fragmentDeRoute(groupRoute), "#boss/groupe/abc-123");
assert.equal(
  urlAbsolueDeRoute(groupRoute, "https://yanniss13.github.io/NOVA/index.html#wiki"),
  "https://yanniss13.github.io/NOVA/index.html#boss/groupe/abc-123"
);
assert.equal(urlAbsolueDeRoute(groupRoute, "pas une url"), null);

console.log("routage.test.js OK");
```

- [ ] **Step 3: Run the focused test and confirm the red state**

Run: `node tests/routage.test.js`

Expected: FAIL because `js/metier/routage.js` or the exposed functions do not exist.

- [ ] **Step 4: Implement the minimal pure route module**

Create `js/metier/routage.js` with immutable route values and no access to `window`, `document`, Supabase or the session:

```js
const ROUTE_SESSION_ID_MAX_LENGTH = 128;
const ROUTE_VIEWS = new Set([
  "dashboard", "builder", "roster", "member-roster", "availability",
  "boss", "analyse", "wiki", "collection"
]);
const GROUP_ROUTE_VIEWS = new Set(["boss", "analyse"]);
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function sessionIdDeSegment(segment){
  if(typeof segment !== "string") return null;
  let decoded;
  try{ decoded = decodeURIComponent(segment); }
  catch(error){ return null; }
  return SESSION_ID_PATTERN.test(decoded) ? decoded : null;
}

function lireRoute(fragment){
  const source = String(fragment || "").replace(/^#/, "");
  if(ROUTE_VIEWS.has(source)) return { type:"view", view:source };
  const parts = source.split("/");
  if(parts.length !== 3 || parts[1] !== "groupe"
    || !GROUP_ROUTE_VIEWS.has(parts[0])) return null;
  const sessionId = sessionIdDeSegment(parts[2]);
  return sessionId
    ? { type:"group", view:parts[0], sessionId }
    : null;
}

function fragmentDeRoute(route){
  if(!route || typeof route !== "object") return null;
  if(route.type === "view" && ROUTE_VIEWS.has(route.view)){
    return "#" + route.view;
  }
  if(route.type === "group" && GROUP_ROUTE_VIEWS.has(route.view)
    && SESSION_ID_PATTERN.test(String(route.sessionId || ""))){
    return "#" + route.view + "/groupe/" + encodeURIComponent(route.sessionId);
  }
  return null;
}

function routeDeVue(view){
  return ROUTE_VIEWS.has(view) ? { type:"view", view } : null;
}

function urlAbsolueDeRoute(route, href){
  const fragment = fragmentDeRoute(route);
  if(!fragment) return null;
  try{
    const url = new URL(href);
    url.hash = fragment;
    return url.href;
  }catch(error){
    return null;
  }
}

export {
  ROUTE_SESSION_ID_MAX_LENGTH,
  fragmentDeRoute,
  lireRoute,
  routeDeVue,
  urlAbsolueDeRoute
};
```

- [ ] **Step 5: Register the test and offline asset, then run focused guards**

Add `node tests/routage.test.js` to `test:unit` immediately before `node tests/analyse-elements.test.js`. Add `"./js/metier/routage.js"` to `CORE_ASSETS` beside the other métier modules.

Run: `node tests/routage.test.js && node tests/modules-imports.test.js && node tests/pwa.test.js`

Expected: all three commands print PASS/OK and exit 0.

- [ ] **Step 6: Commit the pure route contract**

```powershell
git add -- js/metier/routage.js tests/routage.test.js tests/helpers/modules.js tests/helpers/load-app.js package.json sw.js
git commit -m "feat(routage): definir les fragments de l'application"
```

---

### Task 2: Navigation stable, historique et reprise après connexion

**Files:**
- Create: `js/vues/routage.js`
- Create: `tests/routage-groupe.playwright.js`
- Modify: `js/vues/navigation.js:70-165`
- Modify: `js/vues/session-auth.js:15-145`
- Modify: `js/app.js:10-75`
- Modify: `tests/helpers/modules.js` dans la couche `vues`
- Modify: `tests/helpers/load-app.js` dans le navigateur factice
- Modify: `package.json` dans `scripts.test:e2e`
- Modify: `sw.js` dans `CORE_ASSETS`

**Interfaces:**
- Consumes: `lireRoute`, `fragmentDeRoute`, `routeDeVue` from Task 1.
- Produces: `showView(name, { historyMode?:"push"|"replace"|"none" }): Promise<unknown>`.
- Produces: `enregistrerGestionnaireRoute(view:"boss"|"analyse", handler:(route:AppRoute)=>Promise<boolean>): void`.
- Produces: `initialiserRoutage(): Promise<boolean>`.
- Produces: `reprendreRouteCourante(): Promise<boolean>`.
- Produces: `naviguerVersRoute(route:AppRoute, options?:{replace?:boolean}): Promise<boolean>`.

- [ ] **Step 1: Write the failing Playwright scenarios for stable routes**

Create `tests/routage-groupe.playwright.js`. In its first scenario, serve the repository, open `index.html#collection`, assert `#view-collection.active`, reload, then assert the same view. Click the Builder and Wiki tabs, call `page.goBack()` and `page.goForward()`, and assert both the fragment and active panel after each transition.

In its second scenario, install fake Supabase, open `index.html#boss`, verify the auth modal appears, sign in with `yannis@example.test` / `mot-de-passe-test`, and assert that `#view-boss` becomes active while `location.hash === "#boss"`. Add a control page opened without a fragment and assert that the same sign-in opens `#view-dashboard` with `#dashboard`.

Use these concrete helpers at the top of the test:

```js
async function activeView(page){
  return page.locator(".view.active").getAttribute("id");
}

async function signIn(page){
  await page.locator("#authOverlay").waitFor({ state:"visible" });
  await page.locator("#authEmail").fill("yannis@example.test");
  await page.locator("#authPassword").fill("mot-de-passe-test");
  await page.getByRole("button", { name:"Se connecter", exact:true }).click();
  await page.locator("#accountPseudo").getByText("Yannis", { exact:true }).waitFor();
}
```

- [ ] **Step 2: Run the browser test and confirm the red state**

Run: `node tests/routage-groupe.playwright.js`

Expected: FAIL because the current startup ignores fragments and `showView()` does not write history.

- [ ] **Step 3: Extend `showView()` with explicit history behavior**

Import `fragmentDeRoute` and `routeDeVue` into `navigation.js`. Change the signature to `showView(name, options)` and normalize:

```js
const settings = Object.assign({ historyMode:"push" }, options || {});
```

After authorization and before rendering, serialize the stable route. For `push`, call `history.pushState()` only when `location.hash` differs; for `replace`, call `history.replaceState()`; for `none`, do not touch the URL. Keep `calculateur` unchanged because `routeDeVue("calculateur")` returns `null`.

When the visitor is unauthorized, preserve the existing explicit fallback behavior by calling:

```js
return showView(VUE_DE_REPLI, {
  historyMode:settings.historyMode === "none" ? "none" : "replace"
});
```

Export `vueAutorisee` for the route controller.

- [ ] **Step 4: Implement the route controller and specialized-handler registry**

Create `js/vues/routage.js` after `modale-auth.js` in module order. It imports only the pure route module, `sessionCourante`, `openAuth`, `showView` and `vueAutorisee`.

Implement a `Map` of specialized handlers. `ouvrirRoute(route)` must:

1. return `false` for invalid routes;
2. remember a protected route and call `openAuth()` without rewriting its fragment when unauthorized;
3. call `showView(route.view, {historyMode:"none"})` for stable routes;
4. call the registered specialized handler for group routes;
5. fall back with `history.replaceState()` to `#dashboard` when connected and `#wiki` otherwise if no specialized handler exists.

Use one captured document listener for links marked `data-app-route`; intercept only an unmodified primary click with no `target="_blank"`. Parse the link’s `href`, call `history.pushState()` once through `naviguerVersRoute()`, then resolve the route. Register one `popstate` listener that resolves `location.hash` with no new history entry.

`initialiserRoutage()` distingue l’absence de fragment d’un fragment invalide : une URL sans fragment retourne `false` sans rien réécrire afin que la connexion ouvre encore le tableau de bord ; un fragment non vide mais invalide est remplacé par `#dashboard` si une session existe, sinon par `#wiki`. `reprendreRouteCourante()` applique la même règle après une connexion ou un changement explicite d’URL.

The public surface is:

```js
function enregistrerGestionnaireRoute(view, handler){
  if((view === "boss" || view === "analyse") && typeof handler === "function"){
    gestionnaires.set(view, handler);
  }
}

async function reprendreRouteCourante(){
  const route = lireRoute(location.hash);
  if(!route) return false;
  return ouvrirRoute(route);
}
```

- [ ] **Step 5: Initialize routing before authentication and resume it on login**

In `app.js`, import `initialiserRoutage`, register all views first, keep the initial synchronous `renderBuilder()`, then replace the final startup with:

```js
void initialiserRoutage().finally(() => void initAuth());
```

In `session-auth.js`, import `reprendreRouteCourante`. In the `sessionChanged && !previousUserId && sessionCourante.user` branch, await it and open the dashboard only when it returns `false`:

```js
const routeReprise = await reprendreRouteCourante();
if(!isCurrentApplication()) return;
if(!routeReprise) await showView("dashboard", { historyMode:"replace" });
```

Keep logout fallback in `appliquerVisibiliteOnglets()` so a protected fragment becomes `#wiki` and is not replayed at a later login.

- [ ] **Step 6: Make the VM loader browser-compatible and register the new e2e test**

Add `"vues/routage.js"` after `"vues/modale-auth.js"` in `tests/helpers/modules.js`, and add `"./js/vues/routage.js"` to `CORE_ASSETS`.

In `load-app.js`, provide minimal `location` and `history` objects whose `pushState`/`replaceState` update `location.hash`, plus `scrollTo(){}`. Add `node tests/routage-groupe.playwright.js` at the beginning of `test:e2e`.

- [ ] **Step 7: Run focused navigation tests**

Run: `node tests/routage.test.js && node tests/routage-groupe.playwright.js && node tests/visiteur-anonyme.playwright.js && node tests/modules-imports.test.js && node tests/pwa.test.js`

Expected: all five commands exit 0; the direct protected route opens after login and a no-fragment login still opens the dashboard.

- [ ] **Step 8: Commit stable routing**

```powershell
git add -- js/vues/routage.js js/vues/navigation.js js/vues/session-auth.js js/app.js tests/routage-groupe.playwright.js tests/helpers/modules.js tests/helpers/load-app.js package.json sw.js
git commit -m "feat(routage): synchroniser les vues avec l'historique"
```

---

### Task 3: Actions et liens directs des groupes Boss

**Files:**
- Modify: `js/vues/boss-sessions.js:320-405,1220-1315`
- Modify: `css/boss.css:38-90`
- Modify: `css/responsive.css` dans les règles 320–640 px
- Modify: `tests/routage-groupe.playwright.js`

**Interfaces:**
- Consumes: `fragmentDeRoute`, `urlAbsolueDeRoute`, `enregistrerGestionnaireRoute`, `showView`.
- Produces: `ouvrirRouteBossGroupe(route:AppRoute): Promise<boolean>` registered for `"boss"`.
- Produces: `copierLienBoss(sessionId:string): Promise<boolean>`.

- [ ] **Step 1: Extend the browser test with Boss card behavior**

After signing in, use one session generated by `BossStore.ensureWeek()`, insert two `boss_participation` rows into `window.__fakeSupabaseState`, then revisit `#boss`. Assert the open card contains exactly:

- an enabled `Analyser ce groupe` link whose `href` is `#analyse/groupe/<id>`;
- a `Copier le lien` button;
- no equivalent actions inside `.boss-report-card`.

Navigate to `#boss/groupe/<id>` and assert the matching `.boss-card[data-session-id]` is visible and its analysis action has focus. Remove the session, reopen the same route and assert the visible text `Ce groupe n’est plus ouvert ou n’existe plus.`.

For an empty generated group, assert `Analyser ce groupe` has `aria-disabled="true"` and cannot change the fragment.

Grant clipboard permissions in the Playwright context, click `Copier le lien`, read `navigator.clipboard.readText()`, and compare it with `new URL("#boss/groupe/<id>", page.url()).href`. Snapshot `calls`, `rpcCalls`, `boss_sessions` and `boss_participation` before the click and assert they are unchanged afterward.

- [ ] **Step 2: Run the Boss scenarios and confirm the red state**

Run: `node tests/routage-groupe.playwright.js`

Expected: FAIL because cards do not expose link/copy actions and no route handler focuses a group.

- [ ] **Step 3: Add the two secondary actions to open cards only**

Import the pure route helpers and route-handler registration into `boss-sessions.js`. In `bossGroupCard()`, build:

```js
const groupRoute = { type:"group", view:"boss", sessionId:g.id };
const analyseRoute = { type:"group", view:"analyse", sessionId:g.id };
const analyseLink = el("a",{
  class:"btn btn-secondary boss-analyse-link",
  href:fragmentDeRoute(analyseRoute),
  dataset:{ appRoute:"", bossAction:"analyse" },
  text:"Analyser ce groupe",
  "aria-disabled":String(members.length === 0),
  tabindex:members.length === 0 ? -1 : 0
});
if(!members.length){
  analyseLink.addEventListener("click", event => event.preventDefault());
}
const copyButton = el("button",{
  class:"btn boss-copy-link",
  type:"button",
  dataset:{ bossAction:"copy" },
  text:"Copier le lien",
  onclick:()=>void copierLienBoss(g.id)
});
```

Append them in a new `.boss-secondary-actions` container after `.boss-actions`. Do not touch `bossReportCard()`.

- [ ] **Step 4: Implement clipboard success and fallback truthfully**

`copierLienBoss()` constructs the absolute URL with `urlAbsolueDeRoute(groupRoute, location.href)`. If `navigator.clipboard.writeText` succeeds, show `toast("Lien du groupe copié.")` and return `true`. If the API is absent or rejects, call exactly `window.prompt("Copie ce lien", url)` and return `false`; do not show a success toast.

- [ ] **Step 5: Register and implement the Boss group route handler**

Maintain a local `bossRouteTargetId`. `ouvrirRouteBossGroupe(route)` sets it, awaits `showView("boss", {historyMode:"none"})`, then searches only open `.boss-card[data-session-id]` nodes. If found, call `scrollIntoView({block:"center"})` and focus `[data-boss-action="analyse"]`, falling back to `[data-boss-action="copy"]` when analysis is disabled.

If absent, prepend a `role="status"` route notice to `#bossBody` containing `Ce groupe n’est plus ouvert ou n’existe plus.` and a native link `Retour aux groupes` pointing to `#boss` with `data-app-route`. Clear the notice and target when rendering the stable `#boss` route.

Register at module evaluation:

```js
enregistrerGestionnaireRoute("boss", ouvrirRouteBossGroupe);
```

- [ ] **Step 6: Style actions without horizontal overflow**

Add `.boss-secondary-actions` as a two-column grid on desktop and keep both buttons at `min-width:0; min-height:44px; width:100%`. At `max-width:480px`, use one column. Give disabled analysis links `pointer-events:none`, visible muted styling and no misleading hover state. Ensure long copied-link labels can wrap with `overflow-wrap:anywhere`.

- [ ] **Step 7: Run focused Boss and accessibility regressions**

Run: `node tests/routage-groupe.playwright.js && node tests/supabase-etape1.playwright.js && node tests/accessibilite-mobile.playwright.js`

Expected: all three commands exit 0; no Boss data is written by analysis/copy actions.

- [ ] **Step 8: Commit Boss group links**

```powershell
git add -- js/vues/boss-sessions.js css/boss.css css/responsive.css tests/routage-groupe.playwright.js
git commit -m "feat(boss): partager et cibler un groupe ouvert"
```

---

### Task 4: Analyse dynamique limitée au groupe

**Files:**
- Modify: `js/donnees/boss-store.js:14-105`
- Modify: `js/vues/analyse.js:15-970`
- Modify: `css/analyse.css:1-235`
- Modify: `css/responsive.css` dans les règles 320–640 px
- Modify: `tests/routage-groupe.playwright.js`

**Interfaces:**
- Consumes: `BossStore.sessionById`, `BossStore.listMembership`, `enregistrerGestionnaireRoute`, `lireRoute`, `showView`.
- Produces: `BossStore.sessionById(sessionId:string): Promise<object|null>`.
- Produces: `ouvrirRouteAnalyseGroupe(route:AppRoute): Promise<boolean>` registered for `"analyse"`.
- Internal state: `analyseGroupContext` with status `none | loading | ready | not-found | read-error`.

- [ ] **Step 1: Extend the browser test with a scoped group analysis**

Seed a current open group with participants `user-1`, `user-2` and `user-without-roster`. Add a third roster/profile owner outside the group. Open `#analyse/groupe/<id>` and assert:

- `#analyseSubpage-dps[aria-pressed="true"]` and visible `#analysePanel-dps`;
- a context heading containing `<title> · Run <run_no>`;
- `3 participants` and `1 sans roster exploitable`;
- matrix member chips contain only Yannis and Merlin plus `Tous`;
- overview member count is 2, not the guild total;
- coverage cards, target debuffs and ally supports contain no carrier from the outside owner;
- the existing manual member filter still changes only matrix rows.

Then mutate participation so `user-2` leaves and the outside owner joins. Navigate to `#wiki`, reopen the same analysis URL, and assert the new owner replaces Merlin. This proves a new route opening rereads participation.

- [ ] **Step 2: Add explicit empty and failure scenarios to the browser test**

Cover these exact outcomes:

- open group with zero participation: `Ce groupe ne contient encore aucun participant.` and no guild-wide analysis;
- missing or archived session: `Ce groupe n’est plus ouvert ou n’existe plus.` and a `Retour aux sessions` link;
- `bossReadFailureOnce` on participation: `Impossible de lire les participants du groupe.` and a `Réessayer` link to the same route;
- roster read failure after a valid membership: banner keeps the participant total but displays `Données de roster indisponibles` rather than treating everyone as missing.

- [ ] **Step 3: Run the analysis scenarios and confirm the red state**

Run: `node tests/routage-groupe.playwright.js`

Expected: FAIL because the analysis still uses the whole guild and has no group context.

- [ ] **Step 4: Add a targeted, read-only session lookup**

Add to `BossStore`:

```js
async sessionById(sessionId){
  if(!sessionCourante.user || !sb) return null;
  const { data, error } = await sb.from("boss_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();
  if(error) throw error;
  return data || null;
},
```

Do not add update/upsert/RPC behavior.

- [ ] **Step 5: Model and resolve the group context before reading rosters**

In `analyse.js`, add a single context object:

```js
let analyseGroupContext = { status:"none" };
```

`ouvrirRouteAnalyseGroupe(route)` must set `analyseSousVue = "dps"`, set a `loading` context, and await `showView("analyse", {historyMode:"none"})`. It then reads `BossStore.sessionById(route.sessionId)` and, only for `status === "open"`, calls `BossStore.listMembership([route.sessionId])`. Normalize unique participants by owner into `{owner, pseudo}`. Set `ready`, `not-found` or `read-error`, then await `renderAnalyse()` again and focus the context heading when present.

Register:

```js
enregistrerGestionnaireRoute("analyse", ouvrirRouteAnalyseGroupe);
```

At the start of `renderAnalyse()`, parse `location.hash`. If it is not the matching `analyse/groupe` route, reset the context to `{status:"none"}`. Thus a normal tab click, `#analyse`, logout fallback or `Toute la confrérie` cannot retain a stale group.

- [ ] **Step 6: Render loading/error/empty states without false guild data**

Before `rosterDerivedPlayers()`, handle:

- `loading`: only `Chargement du groupe…`;
- `not-found`: route banner plus `Retour aux sessions` link to `#boss`;
- `read-error`: route banner plus `Réessayer` link to the current analysis route;
- `ready` with zero participants: the group banner plus the explicit empty sentence.

All links use native `href` and `data-app-route`. These states must return before reading roster/support tables so they never fall back silently to all members.

- [ ] **Step 7: Filter every analysis source before calculations**

After a successful `rosterDerivedPlayers()` call, derive exactly one scoped array:

```js
const participantOwners = analyseGroupContext.status === "ready"
  ? new Set(analyseGroupContext.participants.map(item => item.owner))
  : null;
const membresAnalyses = participantOwners
  ? membres.filter(membre => participantOwners.has(membre.owner))
  : membres;
```

Replace every downstream use that drives overview counts, `players`, element coverage, `resumeDesSupports()` and `rendreRecensement()` with `membresAnalyses`. Do not apply `analyseMembres` outside `rendreMatrice()`.

Compute missing rosters only when the roster read succeeded:

```js
const ownersAvecRoster = new Set(membresAnalyses.map(item => item.owner));
const sansRoster = analyseGroupContext.participants.filter(
  item => !ownersAvecRoster.has(item.owner)
).length;
```

When roster reading fails, show `Données de roster indisponibles` in the banner and keep all numerical analysis values as `—`.

- [ ] **Step 8: Add the group banner and exit action**

Insert `.analyse-group-context` before `.analyse-subnav`. Its heading has `id="analyseGroupTitle"`, `tabindex="-1"` and text `<title> · Run <run_no>`. Add participant and missing-roster summaries plus a `Toute la confrérie` button whose handler is:

```js
onclick:()=>void showView("analyse")
```

This pushes `#analyse`; the next render clears the group context. The banner uses `role="region"` and `aria-labelledby="analyseGroupTitle"`.

- [ ] **Step 9: Keep the context responsive and accessible**

Style the banner with a wrapping flex/grid layout, `min-width:0`, `overflow-wrap:anywhere`, and 44 px minimum action height. At 320, 360 and 390 px, stack metadata and the exit action without any fixed minimum width. Preserve the three equal analysis subnavigation columns and the existing mobile DPS cards.

- [ ] **Step 10: Run focused analysis and mobile regressions**

Run: `node tests/routage-groupe.playwright.js && node tests/analyse-recensements.playwright.js && node tests/analyse-elements.test.js && node tests/recensement-supports.test.js && node tests/accessibilite-mobile.playwright.js`

Expected: all five commands exit 0; group scope changes every analysis panel while the manual chip filter remains matrix-only.

- [ ] **Step 11: Commit dynamic group analysis**

```powershell
git add -- js/donnees/boss-store.js js/vues/analyse.js css/analyse.css css/responsive.css tests/routage-groupe.playwright.js
git commit -m "feat(analyse): limiter les resultats au groupe ouvert"
```

---

### Task 5: Invalid routes, fallback clipboard, mobile proof and release verification

**Files:**
- Modify: `tests/routage-groupe.playwright.js`
- Modify if a regression is exposed: only the files introduced or changed in Tasks 1–4

**Interfaces:**
- Consumes: the complete routing and group-analysis behavior from Tasks 1–4.
- Produces: release evidence for invalid input, fallback behavior, mobile layout and the complete suite.

- [ ] **Step 1: Add invalid-route and clipboard-fallback browser assertions**

Open each of these fragments in a fresh page and assert no Supabase `boss_sessions` or `boss_participation` select receives the invalid value:

```js
[
  "#boss/groupe/",
  "#boss/groupe/a/b",
  "#analyse/groupe/%2F",
  "#analyse/groupe/" + "a".repeat(129),
  "#route-inconnue"
]
```

After authentication, each invalid route must be replaced by `#dashboard`; while anonymous it must be replaced by `#wiki`.

For clipboard fallback, replace `navigator.clipboard.writeText` with a rejecting function and replace `window.prompt` with a recorder. Click `Copier le lien`, assert the recorder receives exactly `("Copie ce lien", expectedUrl)`, and assert no success toast containing `copié` is visible.

- [ ] **Step 2: Add exact mobile overflow and touch-target assertions**

For widths 320 and 390, open one Boss group route and one group Analysis route. Evaluate:

```js
const metrics = await page.evaluate(() => ({
  overflow:document.scrollingElement.scrollWidth
    - document.scrollingElement.clientWidth,
  actionHeights:[...document.querySelectorAll(
    ".boss-secondary-actions .btn, .analyse-group-context .btn"
  )].filter(node => node.getClientRects().length)
    .map(node => node.getBoundingClientRect().height)
}));
assert.ok(metrics.overflow <= 1);
assert.ok(metrics.actionHeights.every(height => height >= 43.5));
```

Also use Back/Forward between `#boss/groupe/<id>`, `#analyse/groupe/<id>` and `#wiki`, asserting both active view and group context after every transition.

- [ ] **Step 3: Run the new end-to-end test alone**

Run: `node tests/routage-groupe.playwright.js`

Expected: PASS with no page errors, invalid network reads, horizontal overflow or sub-44 px targets.

- [ ] **Step 4: Run structural and whitespace verification**

Run: `node tests/modules-imports.test.js && node tests/pwa.test.js && git diff --check`

Expected: both tests pass and `git diff --check` prints no error.

- [ ] **Step 5: Run the complete project suite**

Run: `npm test`

Expected: `test:unit` and `test:e2e` both exit 0.

- [ ] **Step 6: Inspect the final diff and commit test hardening if needed**

Run: `git status --short` and `git diff --stat HEAD~3..HEAD`.

If Task 5 added assertions or fixes after the Task 4 commit, commit only those files:

```powershell
git add -- tests/routage-groupe.playwright.js
git commit -m "test(routage): couvrir les erreurs et le mobile"
```

If implementation files also required a correction exposed by Task 5, include each exact corrected path in the same command and describe that correction in the commit body.

- [ ] **Step 7: Stop before push and report release evidence**

Report the final commit hashes, the successful `npm test` result, the absence of SQL migration, and the clean/remaining worktree state. Do not run `git push` until the user explicitly asks for it.
