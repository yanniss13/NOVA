# Chronométrage fiable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher qu’un protocole incohérent produise une mesure crédible et conserver la cadence vidéo réellement observée jusqu’à l’arbitrage humain.

**Architecture:** Les règles indépendantes du navigateur vivent dans `outils/chrono-calcul.js`. La page applique ces règles au DOM et à l’envoi, le script Python les revalide avant consensus, et PostgreSQL constitue la dernière barrière. Chaque couche refuse le même état sans rendre les anciennes lignes sans FPS illisibles.

**Tech Stack:** JavaScript navigateur sans framework, Node `assert`, Playwright, Python `unittest`, PostgreSQL/Supabase, `pglast`.

**Spec:** `docs/superpowers/specs/2026-08-22-chronometrage-fiable-dps-sans-recharge-design.md`

## Global Constraints

- Ne modifier ni régénérer `data/animations-mesurees.json`.
- Ne faire aucun commit, push, déploiement Supabase ou appel mutateur externe.
- Auto-attaque (`jumpatk|normalatk`) = `rafale`; toute autre compétence = `unique`.
- `rafale` exige un entier `reps >= 2`; `unique` exige `reps:null`.
- Une durée valide appartient à `]0, 30]` secondes.
- Un FPS renseigné est fini et appartient à `[10, 240]`; `null` reste accepté pour l’historique.
- La table `animation_measures` reste en ajout seul, sans politique `update` ou `delete`.
- Tous les changements suivent un test rouge puis vert.

---

### Task 1: Isoler les règles de protocole et de cadence

**Files:**
- Modify: `outils/chrono-calcul.js`
- Test: `tests/chrono-calcul.test.js`

**Interfaces:**
- Produces: `protocolePour(gameId) -> { mode:"rafale"|"unique", repetitions:number|null }`
- Produces: `protocoleValide({ gameId, mode, repetitions }) -> boolean`
- Produces: `fpsPour(dureeImage, cadenceRepli=60) -> number`
- Existing: `dureeRafale()` and `dureeUnique()` remain source-compatible.

- [ ] **Step 1: Write the failing protocol tests**

Append to `tests/chrono-calcul.test.js`:

```js
assert.deepStrictEqual(
  outils.protocolePour("meliodas_axe_jumpatk"),
  { mode:"rafale", repetitions:10 }
);
assert.deepStrictEqual(
  outils.protocolePour("meliodas_axe_skill_e"),
  { mode:"unique", repetitions:null }
);
assert.equal(outils.protocoleValide({
  gameId:"x_normalatk", mode:"rafale", repetitions:10
}), true);
assert.equal(outils.protocoleValide({
  gameId:"x_normalatk", mode:"unique", repetitions:null
}), false);
assert.equal(outils.protocoleValide({
  gameId:"x_skill_e", mode:"rafale", repetitions:10
}), false);
assert.equal(outils.protocoleValide({
  gameId:"x_normalatk", mode:"rafale", repetitions:1
}), false);
assert.equal(outils.fpsPour(1 / 30), 30);
assert.equal(outils.fpsPour(0), 60);
```

- [ ] **Step 2: Run the focused test and observe the missing API**

Run: `node tests/chrono-calcul.test.js`

Expected: FAIL because `protocolePour` is not defined.

- [ ] **Step 3: Implement the pure rules**

Add before `const API` in `outils/chrono-calcul.js`:

```js
function estAutoAttaque(gameId){
  return /jumpatk|normalatk/.test(String(gameId || ""));
}

function protocolePour(gameId){
  return estAutoAttaque(gameId)
    ? { mode:"rafale", repetitions:10 }
    : { mode:"unique", repetitions:null };
}

function protocoleValide({ gameId, mode, repetitions }){
  const attendu = protocolePour(gameId);
  if(mode !== attendu.mode) return false;
  if(mode === "unique") return repetitions === null;
  return Number.isInteger(repetitions) && repetitions >= 2;
}

function fpsPour(dureeImage, cadenceRepli=60){
  const fps = Number(dureeImage) > 0 ? 1 / Number(dureeImage) : cadenceRepli;
  return Math.round(fps * 1000) / 1000;
}
```

Export the three functions in `API`. Change `dureeRafale()` to reject
`repetitions < 2` so its arithmetic contract matches the protocol.

- [ ] **Step 4: Run the focused unit test**

Run: `node tests/chrono-calcul.test.js`

Expected: `chrono-calcul.test.js : OK`.

- [ ] **Step 5: Review the local diff without committing**

Run: `git diff --check -- outils/chrono-calcul.js tests/chrono-calcul.test.js`

Expected: exit 0.

---

### Task 2: Enforce the protocol in the browser and protect submission

**Files:**
- Modify: `outils/chrono-animation.js`
- Modify: `outils/chrono-animation.html`
- Test: `tests/chrono-animation.playwright.js`

**Interfaces:**
- Consumes: `ChronoCalcul.protocolePour`, `protocoleValide`, `fpsPour` from Task 1.
- Produces: `mesureCourante() -> { gameId, heros, arme, secondes, mode, repetitions, fps }`.
- Produces: one Supabase insert at most while `envoiEnCours === true`.

- [ ] **Step 1: Add failing Playwright assertions for automatic mode and FPS**

After selecting Meliodas’s axe, add:

```js
await page.selectOption("#competence", { index:0 });
assert.equal(await page.locator('input[value="rafale"]').isChecked(), true);
assert.equal(await page.locator('input[value="rafale"]').isDisabled(), true);
assert.equal(await page.locator("#repetitions").isDisabled(), false);

await page.selectOption("#competence", { index:1 });
assert.equal(await page.locator('input[value="unique"]').isChecked(), true);
assert.equal(await page.locator('input[value="unique"]').isDisabled(), true);
assert.equal(await page.locator("#repetitions").isDisabled(), true);
```

Before reading `mesureCourante()`, select the auto-attack again and set
`window.ChronoPage.etat.dureeImage = 1 / 30`. Assert:

```js
assert.equal(mesure.mode, "rafale");
assert.equal(mesure.repetitions, 10);
assert.equal(mesure.fps, 30);
```

- [ ] **Step 2: Run the browser test and verify the old free-choice UI fails**

Run: `node tests/chrono-animation.playwright.js`

Expected: FAIL on disabled/selected protocol or missing `mesure.fps`.

- [ ] **Step 3: Synchronize controls and validate `mesureCourante()`**

Replace the local `estAutoAttaque()` decision with Task 1’s API. Add:

```js
function synchroniserProtocole(){
  const competence = competenceChoisie();
  if(!competence) return;
  const protocole = window.ChronoCalcul.protocolePour(competence.gameId);
  document.querySelectorAll("input[name=mode]").forEach(radio => {
    radio.checked = radio.value === protocole.mode;
    radio.disabled = true;
  });
  const repetitions = $("repetitions");
  repetitions.disabled = protocole.mode === "unique";
  if(protocole.repetitions !== null) repetitions.value = protocole.repetitions;
}
```

Call it from `majDetail()` before `afficher()`. In `mesureCourante()`, build
`repetitions` as `null` in unique mode, call `protocoleValide`, throw
`Error("La méthode ne correspond pas à cette compétence.")` on failure, and
add `fps:ChronoCalcul.fpsPour(etat.dureeImage, etat.cadence)`.

Update the cadence display to append `" (repli)"` when `dureeImage` is absent.
Change the existing copy to:

```text
Déjà mesurée : ton envoi sera proposé comme correction.
```

- [ ] **Step 4: Add a fake Supabase client and a failing double-submit test**

Before `page.goto`, route the CDN script to a deterministic fake client:

```js
await page.addInitScript(() => {
  window.__chronoInserts = [];
  window.__fakeSb = {
    auth:{ getUser:async() => ({ data:{ user:{ id:"u1" } } }) },
    from(table){
      if(table === "profiles") return {
        select(){ return this; }, eq(){ return this; },
        maybeSingle:async() => ({ data:{ pseudo:"Anne" } })
      };
      return { insert:async(payload) => {
        window.__chronoInserts.push(payload);
        await new Promise(resolve => setTimeout(resolve, 50));
        return { error:null };
      }};
    }
  };
});
await page.route("https://cdn.jsdelivr.net/**", route => route.fulfill({
  contentType:"application/javascript",
  body:"window.supabase={createClient:function(){return window.__fakeSb;}};"
}));
```

After preparing a valid measurement, click `#envoyer` twice without awaiting
between calls, assert the button is disabled during the delay, then assert:

```js
assert.equal(await page.evaluate(() => window.__chronoInserts.length), 1);
assert.match(await page.locator("#retourEnvoi").textContent(),
  /en attente de validation humaine/i);
assert.equal((await page.evaluate(() => window.__chronoInserts[0])).fps, 30);
```

- [ ] **Step 5: Implement the pending guard**

Add `let envoiEnCours = false`. At the start of `envoyer()`, return if true.
After all synchronous validation succeeds, set the flag and disable the button.
Wrap profile lookup and insert in `try/finally`; in `finally`, clear the flag and
enable the button. Send `fps:mesure.fps`, not `etat.cadence`. Use the exact
success copy from the spec.

- [ ] **Step 6: Run the full chrono browser test**

Run: `node tests/chrono-animation.playwright.js`

Expected: `chrono-animation.playwright.js : OK`.

- [ ] **Step 7: Review the local diff without committing**

Run: `git diff --check -- outils/chrono-animation.js outils/chrono-animation.html tests/chrono-animation.playwright.js`

Expected: exit 0.

---

### Task 3: Revalidate the protocol during human arbitration

**Files:**
- Modify: `scripts/rapatrier-mesures.py`
- Test: `tests/test_rapatrier_mesures.py`

**Interfaces:**
- Produces: `protocole_mesure_valide(envoi: dict) -> bool`.
- Changes: `trier_envois()` classifies a bad protocol in `invalides` after selecting the latest author submission.

- [ ] **Step 1: Write failing Python protocol tests**

Add:

```python
def test_le_protocole_mode_repetitions_et_fps_est_valide_ensemble(self):
    valides = [
        {"mode": "unique", "reps": None, "fps": 30},
        {"mode": "rafale", "reps": 10, "fps": 59.94},
        {"mode": "unique", "reps": None, "fps": None},
    ]
    invalides = [
        {"mode": "unique", "reps": 1, "fps": 60},
        {"mode": "rafale", "reps": None, "fps": 60},
        {"mode": "rafale", "reps": 1, "fps": 60},
        {"mode": "rafale", "reps": 10.5, "fps": 60},
        {"mode": "rafale", "reps": 10, "fps": 9},
        {"mode": "rafale", "reps": 10, "fps": float("inf")},
    ]
    for envoi in valides:
        self.assertTrue(MODULE.protocole_mesure_valide(envoi), envoi)
    for envoi in invalides:
        self.assertFalse(MODULE.protocole_mesure_valide(envoi), envoi)
```

Add a `trier_envois` case with a known `game_id`, valid seconds and invalid
`mode/reps`; assert it appears only in `invalides`.

- [ ] **Step 2: Run the focused Python tests**

Run: `python -m unittest tests/test_rapatrier_mesures.py`

Expected: FAIL because `protocole_mesure_valide` does not exist.

- [ ] **Step 3: Implement protocol validation**

Add:

```python
def protocole_mesure_valide(envoi):
    mode = envoi.get("mode")
    reps = envoi.get("reps")
    fps = envoi.get("fps")
    if mode == "unique":
        if reps is not None:
            return False
    elif mode == "rafale":
        if isinstance(reps, bool) or not isinstance(reps, int) or reps < 2:
            return False
    else:
        return False
    if fps is None:
        return True
    try:
        fps = float(fps)
    except (TypeError, ValueError):
        return False
    return math.isfinite(fps) and 10 <= fps <= 240
```

In `trier_envois()`, classify as invalid when either seconds or protocol is
invalid. Keep grouping before validation. In `detail_envoi()`, append
`"fps inconnu"` when `fps is None`.

- [ ] **Step 4: Run all arbitration tests**

Run: `python -m unittest tests/test_rapatrier_mesures.py`

Expected: all tests pass.

- [ ] **Step 5: Review the local diff without committing**

Run: `git diff --check -- scripts/rapatrier-mesures.py tests/test_rapatrier_mesures.py`

Expected: exit 0.

---

### Task 4: Add idempotent SQL constraints and document the protocol

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `tests/animation-measures-schema.test.js`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-22-chronometrage-fiable-dps-sans-recharge-design.md` only if implementation reveals a contradiction

**Interfaces:**
- Database accepts exactly the protocol accepted by Task 3, except legacy `fps:null` remains allowed.

- [ ] **Step 1: Write failing SQL contract assertions**

Append to `tests/animation-measures-schema.test.js`:

```js
assert.match(sql, /animation_measures_seconds_range_check[\s\S]*?seconds\s*>\s*0[\s\S]*?seconds\s*<=\s*30/i);
assert.match(sql, /animation_measures_fps_range_check[\s\S]*?fps\s+is\s+null[\s\S]*?fps\s*>=\s*10[\s\S]*?fps\s*<=\s*240/i);
assert.match(sql, /animation_measures_protocol_check[\s\S]*?mode\s*=\s*'unique'[\s\S]*?reps\s+is\s+null[\s\S]*?mode\s*=\s*'rafale'[\s\S]*?reps\s*>=\s*2/i);
```

- [ ] **Step 2: Run schema content and parser tests**

Run:

```powershell
node tests/animation-measures-schema.test.js
python -m unittest tests/test_schema_sql.py
```

Expected: the Node test fails on the missing named constraints; the existing
SQL parser test remains green before editing.

- [ ] **Step 3: Implement constraints for fresh and existing tables**

Give the inline `create table` checks the three exact names above. After the
compatibility `alter table` statements, add `drop constraint if exists` for the
old autogenerated seconds/reps checks and for the three named constraints,
then recreate:

```sql
alter table public.animation_measures
  drop constraint if exists animation_measures_seconds_check,
  drop constraint if exists animation_measures_reps_check,
  drop constraint if exists animation_measures_seconds_range_check,
  drop constraint if exists animation_measures_fps_range_check,
  drop constraint if exists animation_measures_protocol_check;

alter table public.animation_measures
  add constraint animation_measures_seconds_range_check
  check (seconds > 0 and seconds <= 30),
  add constraint animation_measures_fps_range_check
  check (fps is null or (fps >= 10 and fps <= 240)),
  add constraint animation_measures_protocol_check
  check (
    (mode = 'unique' and reps is null)
    or (mode = 'rafale' and reps is not null and reps >= 2)
  );
```

Do not add `not valid`: replaying the schema must reveal historical bad rows
instead of silently retaining them. Do not add write policies.

- [ ] **Step 4: Update operational documentation**

In the “Chronométrage des animations” section of `AGENTS.md`, record the
automatic mode rules, actual FPS/fallback, importer validation, and the need to
replay `supabase/schema.sql` before publishing this lot.

- [ ] **Step 5: Run targeted verification**

Run:

```powershell
node tests/chrono-calcul.test.js
node tests/chrono-animation.playwright.js
python -m unittest tests/test_rapatrier_mesures.py tests/test_schema_sql.py
node tests/animation-measures-schema.test.js
git diff --check
git diff --exit-code -- data/animations-mesurees.json
```

Expected: every command exits 0; the last command prints no diff.

- [ ] **Step 6: Run the whole project suite**

Run: `npm test`

Expected: summary reports `unit 63/63` and `e2e 16/16` or higher if the runner
gains a command; no failures.

- [ ] **Step 7: Stop at the local checkpoint**

Run: `git status --short`

Expected: only intended project files plus the pre-existing user file
`AUDIT-jessmarchal-fr.md`; do not commit, push, deploy or apply SQL.
