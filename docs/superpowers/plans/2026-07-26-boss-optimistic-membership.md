# Boss Optimistic Membership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre Rejoindre/Quitter instantané dans les groupes de boss, avec confirmation Supabase en arrière-plan, protection contre les doubles clics et retour arrière fiable en cas d’erreur.

**Architecture:** Séparer le chargement réseau du rendu des groupes. Conserver le dernier état serveur en mémoire et superposer les intentions locales `join`/`leave` tant que leur RPC est en cours. Realtime recharge silencieusement l’état serveur, puis les intentions en attente sont réappliquées avant le rendu.

**Tech Stack:** HTML/CSS/JavaScript autonome dans `index.html`, Supabase JS v2 via CDN, Node.js `assert`, Playwright Chromium.

## Global Constraints

- L’application reste statique, sans build et ouvrable en `file://`.
- Aucun changement de schéma Supabase, de RPC SQL ou de politique RLS.
- La limite reste de trois runs par membre et par semaine.
- Seules les actions Rejoindre/Quitter deviennent optimistes.
- Run terminée conserve son rechargement complet.
- Realtime ne doit plus effacer les groupes déjà visibles.
- Les erreurs utilisent toujours `bossActionMessage()`.
- Les données d’autres membres ne doivent pas être perdues lors d’un retour arrière.
- Tous les contrôles tactiles et les règles d’accessibilité existants restent valides.

---

### Task 1: Verrouiller les comportements optimistes avec une RPC contrôlable

**Files:**
- Modify: `tests/supabase-etape1.playwright.js:535-640`
- Modify: `tests/supabase-etape1.playwright.js:870-950`
- Modify: `tests/supabase-etape1.playwright.js:1153-1155`

**Interfaces:**
- Consumes: le faux client Supabase existant, `window.__fakeSupabaseState`, `window.__fakeSupabaseEmit`.
- Produces: `window.__fakeSupabaseHoldBossRpc(name)` et `window.__fakeSupabaseReleaseBossRpc()` pour observer l’interface avant la résolution d’une RPC.

- [ ] **Step 1: Ajouter un verrou de RPC au faux Supabase**

Ajouter `bossRpcHold:null` à l’état de test, près de
`bossRpcFailureOnce:null`.

Dans `rpc(name, args)`, immédiatement après l’ajout à `state.rpcCalls` et avant
la simulation d’erreur, insérer :

```js
const hold = state.bossRpcHold;
if(hold && (!hold.name || hold.name === name)){
  await new Promise(resolve => { hold.release = resolve; });
  if(state.bossRpcHold === hold) state.bossRpcHold = null;
}
```

Exposer les deux commandes de test avec les autres helpers :

```js
window.__fakeSupabaseHoldBossRpc = name => {
  state.bossRpcHold = { name, release:null };
};
window.__fakeSupabaseReleaseBossRpc = () => {
  const hold = state.bossRpcHold;
  if(!hold || typeof hold.release !== "function") return false;
  hold.release();
  return true;
};
```

- [ ] **Step 2: Écrire le test d’adhésion instantanée avant résolution**

Après la vérification Realtime de Merlin et avant les tests d’erreurs existants,
ajouter un scénario qui bloque `join_boss_run` :

```js
const groupOne = page.locator(".boss-card", {
  hasText:"Groupe 1 · Run 1"
});

await page.evaluate(() =>
  window.__fakeSupabaseHoldBossRpc("join_boss_run")
);
await groupOne.getByRole("button", {
  name:"Rejoindre",
  exact:true
}).click();
await page.waitForFunction(() =>
  typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
);

assert.match(await groupOne.textContent(), /Yannis/);
assert.match(await page.locator("#bossCount").textContent(), /1\/3/);
assert.equal(
  await groupOne.getByRole("button", {
    name:"Synchronisation…",
    exact:true
  }).isDisabled(),
  true
);
assert.doesNotMatch(await page.locator("#bossBody").textContent(), /Chargement/);
assert.equal(
  await page.evaluate(() =>
    window.__fakeSupabaseState.boss_participation.length
  ),
  0,
  "L’interface doit changer avant la résolution de la RPC"
);

await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
await page.waitForFunction(() =>
  window.__fakeSupabaseState.boss_participation.length === 1
);
await groupOne.getByRole("button", {
  name:"Quitter",
  exact:true
}).waitFor();
```

- [ ] **Step 3: Écrire le test de départ instantané et de Realtime concurrent**

Bloquer `leave_boss_run`, cliquer Quitter, puis injecter Merlin pendant que la
RPC attend :

```js
await page.evaluate(() =>
  window.__fakeSupabaseHoldBossRpc("leave_boss_run")
);
await groupOne.getByRole("button", {
  name:"Quitter",
  exact:true
}).click();
await page.waitForFunction(() =>
  typeof window.__fakeSupabaseState.bossRpcHold.release === "function"
);

assert.doesNotMatch(await groupOne.textContent(), /Yannis/);
assert.match(await page.locator("#bossCount").textContent(), /0\/3/);
assert.doesNotMatch(await page.locator("#bossBody").textContent(), /Chargement/);

await page.evaluate(() => {
  const state = window.__fakeSupabaseState;
  const session = state.boss_sessions.find(item => item.slot === 1);
  state.boss_participation.push({
    session_id:session.id,
    owner:"user-2",
    pseudo:"Merlin",
    updated_at:"2026-07-26T10:05:00.000Z"
  });
  window.__fakeSupabaseEmit("boss_participation", "INSERT");
});
await groupOne.getByText("Merlin", { exact:true }).waitFor();
assert.doesNotMatch(await groupOne.textContent(), /Yannis/);

await page.evaluate(() => window.__fakeSupabaseReleaseBossRpc());
await page.waitForFunction(() =>
  !window.__fakeSupabaseState.boss_participation.some(item =>
    item.owner === "user-1"
  )
);
```

Nettoyer ensuite la participation de Merlin dans l’état du faux serveur,
émettre `boss_participation DELETE` et attendre sa disparition de la carte afin
que les scénarios existants repartent de `0/3`.

- [ ] **Step 4: Écrire les tests de retour arrière join et leave**

Pour `join_boss_run`, combiner le verrou et
`bossRpcFailureOnce:{name:"join_boss_run",message:"AUTH_REQUIRED"}`. Avant
libération, vérifier Yannis et `1/3`. Après libération, attendre le toast puis
vérifier l’absence de Yannis et `0/3`.

Pour `leave_boss_run`, rejoindre d’abord le groupe 1 normalement. Bloquer
ensuite la RPC avec
`bossRpcFailureOnce:{name:"leave_boss_run",message:"RUN_ARCHIVED"}`. Avant
libération, vérifier l’absence optimiste de Yannis et `0/3`. Après libération,
vérifier que Yannis, le bouton Quitter et `1/3` sont restaurés. Quitter enfin le
groupe normalement pour rendre l’état aux tests existants.

Utiliser les messages français déjà couverts :

```js
"Ta session a expiré. Reconnecte-toi pour continuer."
"Cette run vient d’être terminée. La liste a été actualisée."
```

- [ ] **Step 5: Exécuter le test et vérifier l’échec attendu**

Run:

```powershell
node tests/supabase-etape1.playwright.js
```

Expected: FAIL sur la première assertion optimiste, car Yannis n’est pas
affiché tant que `join_boss_run` n’est pas résolue. Le test ne doit pas échouer
à cause du faux verrou.

---

### Task 2: Séparer le rendu du chargement et superposer les actions en cours

**Files:**
- Modify: `index.html:1883-1941`
- Modify: `index.html:4190-4402`

**Interfaces:**
- Consumes: `currentUser`, `currentPseudo`, `BossStore`, `currentBossWeek()`, `bossGroupCard()`.
- Produces:
  - `bossViewState` : dernier état serveur chargé ;
  - `bossPendingActions` : `Map<sessionId, {type:"join"|"leave", member:Object}>` ;
  - `bossApplyIntent(membership, sessionId, intent)` ;
  - `bossVisibleMembership()` ;
  - `renderBossContent()` ;
  - `changeBossMembership(group, mine)` ;
  - `renderBossView({showLoading, ensureWeek})`.

- [ ] **Step 1: Ajouter l’état local et les fonctions d’intention**

À côté de `bossRenderId`, ajouter :

```js
  const emptyBossViewState = userId => ({
    userId:userId || "",
    week:null,
    allGroups:[],
    membership:[],
    ready:false
  });
  let bossViewState = emptyBossViewState("");
  const bossPendingActions = new Map();

  function ensureBossViewOwner(){
    const userId = currentUser ? currentUser.id : "";
    if(bossViewState.userId === userId) return;
    bossViewState = emptyBossViewState(userId);
    bossPendingActions.clear();
  }

  function bossApplyIntent(membership, sessionId, intent){
    const owner = currentUser && currentUser.id;
    const next = (membership || []).filter(member =>
      member.session_id !== sessionId || member.owner !== owner
    );
    if(intent && intent.type === "join") next.push(intent.member);
    return next;
  }

  function bossVisibleMembership(){
    let membership = (bossViewState.membership || []).slice();
    bossPendingActions.forEach((intent, sessionId) => {
      membership = bossApplyIntent(membership, sessionId, intent);
    });
    return membership;
  }
```

- [ ] **Step 2: Extraire le rendu pur de la vue**

Déplacer la partie de `renderBossView()` qui commence au calcul de
`weekGroups` dans une nouvelle fonction `renderBossContent()`.

Cette fonction doit :

```js
  function renderBossContent(){
    const body = $("#bossBody");
    const week = bossViewState.week || currentBossWeek();
    const allGroups = bossViewState.allGroups || [];
    const membership = bossVisibleMembership();
    // calcul actuel : weekGroups, current, completedCurrent, past, myCount
    // puis body.innerHTML = "", compteur, en-tête, grille et archives
  }
```

Elle ne doit contenir aucun `await`, aucune requête Supabase et aucun texte
« Chargement… ».

- [ ] **Step 3: Faire de renderBossView un chargeur configurable**

Conserver le nom `renderBossView` pour ne pas casser ses appelants, avec :

```js
  async function renderBossView(options){
    const settings = Object.assign({
      showLoading:true,
      ensureWeek:true
    }, options || {});
    const renderId = ++bossRenderId;
    const body = $("#bossBody");
    ensureBossViewOwner();

    if(!currentUser){
      $("#bossCount").textContent = "";
      body.className = "";
      body.innerHTML = "";
      body.appendChild(/* état de connexion existant */);
      return;
    }
    if(settings.showLoading || !bossViewState.ready){
      body.className = "";
      body.innerHTML = "";
      body.appendChild(/* état Chargement… existant */);
    }

    const week = currentBossWeek();
    try{
      if(settings.ensureWeek) await BossStore.ensureWeek(week);
      const allGroups = await BossStore.listAll();
      const membership = await BossStore.listMembership(
        allGroups.map(group => group.id)
      );
      if(renderId !== bossRenderId) return;
      bossViewState = {
        userId:currentUser.id,
        week,
        allGroups,
        membership,
        ready:true
      };
      renderBossContent();
    }catch(error){
      if(renderId !== bossRenderId) return;
      toast("Groupes indisponibles.", true);
      if(bossViewState.ready) renderBossContent();
    }
  }
```

Ne pas appliquer les intentions à `bossViewState.membership` lors du
chargement : elles sont superposées uniquement par `bossVisibleMembership()`.

- [ ] **Step 4: Rendre Realtime silencieux**

Dans `RealtimeSync.flush()`, remplacer :

```js
await renderBossView();
```

par :

```js
await renderBossView({ showLoading:false, ensureWeek:false });
```

Le premier affichage via `showView("boss")` reste `renderBossView()` et conserve
donc le chargement initial.

- [ ] **Step 5: Implémenter changeBossMembership**

Ajouter avant `bossGroupCard()` :

```js
  async function changeBossMembership(group, mine){
    if(bossPendingActions.has(group.id)) return;
    const intent = mine
      ? { type:"leave", member:null }
      : {
          type:"join",
          member:{
            session_id:group.id,
            owner:currentUser.id,
            pseudo:currentPseudo || "Membre"
          }
        };
    bossPendingActions.set(group.id, intent);
    renderBossContent();

    try{
      mine
        ? await BossStore.leave(group.id)
        : await BossStore.join(group.id);
      bossViewState.membership = bossApplyIntent(
        bossViewState.membership,
        group.id,
        intent
      );
      bossPendingActions.delete(group.id);
      renderBossContent();
    }catch(error){
      bossPendingActions.delete(group.id);
      renderBossContent();
      toast("Action impossible : "+bossActionMessage(error), true);
      void renderBossView({ showLoading:false, ensureWeek:true });
    }
  }
```

Le succès est inscrit dans l’état local avant de retirer l’intention afin
d’éviter tout retour visuel à l’ancien état si un événement Realtime concurrent
a chargé une réponse antérieure.

- [ ] **Step 6: Brancher les cartes sur l’action optimiste**

Dans `bossGroupCard()` :

```js
const pending = bossPendingActions.has(g.id);
```

Construire le bouton avec :

```js
text:pending ? "Synchronisation…" : (mine ? "Quitter" : "Rejoindre"),
onclick:()=>void changeBossMembership(g, mine)
```

Puis appliquer :

```js
joinButton.disabled = pending || (!mine && myCount >= 3);
if(completeButton) completeButton.disabled = pending;
```

Supprimer l’ancien bloc qui attend la RPC puis appelle systématiquement
`renderBossView()`.

Ne pas modifier le gestionnaire **Run terminée** : après
`BossStore.complete(g.id)`, il doit toujours exécuter
`await renderBossView()`.

- [ ] **Step 7: Exécuter le test ciblé et vérifier le passage au vert**

Run:

```powershell
node tests/supabase-etape1.playwright.js
```

Expected:

```text
PASS Playwright: Supabase Étape 1 — auth, partage et migration
```

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/supabase-etape1.playwright.js
git commit -m "feat: make boss membership actions instant"
```

---

### Task 3: Documenter et vérifier toutes les régressions

**Files:**
- Modify: `AGENTS.md:185-205`
- Test: `tests/supabase-etape1.playwright.js`
- Test: `tests/accessibilite-mobile.playwright.js`
- Test: `tests/scrollbars-invisibles.playwright.js`

**Interfaces:**
- Consumes: comportement terminé des Tasks 1 et 2.
- Produces: contrat de maintenance documenté et résultat vérifié sur toute la suite.

- [ ] **Step 1: Documenter le contrat dans AGENTS.md**

Dans « Groupes de Boss de Guilde », ajouter :

```markdown
- **Rejoindre/Quitter est optimiste** : la participation, la carte et le
  compteur changent avant la réponse RPC. `bossPendingActions` protège les
  doubles clics et se superpose aux rechargements Realtime silencieux. Une
  erreur annule uniquement l’intention locale concernée. `Run terminée`
  conserve un rechargement complet.
```

- [ ] **Step 2: Lancer la suite complète**

Run:

```powershell
npm test
```

Expected: tous les tests Node, Python et Playwright passent, notamment :

```text
PASS schéma roster persistant + sessions de boss
PASS Playwright: barres invisibles, défilement conservé
PASS Playwright: Supabase Étape 1 — auth, partage et migration
PASS accessibilité : onglets, modales et mobile
```

- [ ] **Step 3: Vérifier le diff**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: aucune erreur de whitespace ; seuls `index.html`,
`tests/supabase-etape1.playwright.js` et `AGENTS.md` sont modifiés depuis le
commit de conception/plan.

- [ ] **Step 4: Commit**

```powershell
git add AGENTS.md
git commit -m "docs: describe optimistic boss membership"
```

- [ ] **Step 5: Revue et intégration**

Utiliser `superpowers:requesting-code-review` sur le range depuis le commit de
plan jusqu’au HEAD, corriger tout problème Critical ou Important, puis utiliser
`superpowers:verification-before-completion` et
`superpowers:finishing-a-development-branch`.
