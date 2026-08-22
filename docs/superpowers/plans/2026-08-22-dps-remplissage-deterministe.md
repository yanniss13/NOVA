# DPS — remplissage déterministe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir qu’une simulation DPS de 60 secondes avec attaque normale mesurée termine rapidement, sans retarder les compétences à recharge et sans promettre un optimum global.

**Architecture:** La recherche exhaustive continue d’ordonner les compétences à recharge. `NORMAL` sort de cette combinatoire : elle devient un remplissage lancé seulement quand aucune compétence à recharge n’est prête et quand son animation ne chevauche pas le prochain cooldown. Le résultat publie cette hypothèse et la fiche remplace son intitulé d’optimum par une formulation fidèle.

**Tech Stack:** JavaScript ES modules, moteur événementiel pur, Node `assert`, sous-processus Node borné pour la régression de performance.

**Spec:** `docs/superpowers/specs/2026-08-22-chronometrage-fiable-dps-sans-recharge-design.md`

## Global Constraints

- Ne modifier ni régénérer `data/animations-mesurees.json`.
- Ne faire aucun commit, push, merge, déploiement ou mutation externe.
- Ne jamais toucher `.claude/worktrees/ocr-stats-screens/` ni la branche `worktree-ocr-stats-screens`.
- Ne lancer ni `git worktree remove` ni `git worktree prune`.
- `NORMAL` reste une vraie action : dégâts, déclencheurs et verrouillage d’animation sont conservés.
- Toute compétence à recharge disponible est prioritaire sur `NORMAL`.
- Une normale ne doit pas retarder le prochain cooldown : fin d’animation égale au retour autorisée, fin postérieure refusée.
- La fenêtre reste semi-ouverte `[0, borne[`.
- Le test synthétique de 60 secondes doit terminer en moins de 5 secondes.
- Tous les changements de comportement suivent un test rouge puis vert.

---

### Task 1: Sortir NORMAL de la recherche combinatoire

**Files:**
- Create: `tests/helpers/dps-performance-runner.js`
- Modify: `tests/dps-simulation.test.js`
- Modify: `js/metier/dps-simulation.js`

**Interfaces:**
- Existing public API unchanged: `simulerDpsCompetences(entree) -> resultat`.
- New internal helper: `prochaineRechargeHorsNormale(etat, borne) -> number|null`.
- New result hypothesis when a measured normal participates: `"attaques-normales-remplissage"`.

- [ ] **Step 1: Keep the failing 60-second subprocess regression**

Keep `tests/helpers/dps-performance-runner.js` as a real four-category simulation with only `NORMAL` measured, `duree:60`, and a final assertion that the ultimate appears. Keep this parent assertion in `tests/dps-simulation.test.js`:

```js
const performance = spawnSync(
  process.execPath,
  [path.join(__dirname, "helpers", "dps-performance-runner.js")],
  { encoding:"utf8", timeout:5000 }
);
assert.equal(
  performance.error && performance.error.code,
  undefined,
  "la simulation DPS de 60 s doit terminer en moins de 5 s"
);
assert.equal(performance.status, 0, performance.stderr || performance.stdout);
```

- [ ] **Step 2: Verify the performance test is red for the expected reason**

Run: `node tests/dps-simulation.test.js`

Expected: FAIL after about five seconds with `actual: 'ETIMEDOUT'`.

- [ ] **Step 3: Add literal scheduling regressions**

Keep the existing `burst-cadence` regression requiring `[0, 5]`. Add a boundary case where an auto launched at `4` finishes exactly when a six-second cooldown returns; assert that the auto at `4` and cooldown action at `6` both exist. Add a priority case with auto and a ready cooldown at `0`; assert the first action is the cooldown skill.

```js
assert.deepStrictEqual(tempsActions(frontiere, "auto-frontiere"), [0, 2, 4, 6]);
assert.deepStrictEqual(tempsActions(frontiere, "burst-frontiere"), [0, 6]);
assert.deepStrictEqual(
  Array.from(frontiere.rotation.filter(item =>
    item.type === "action" && item.temps === 6
  ).map(item => item.gameId)),
  ["burst-frontiere", "auto-frontiere"]
);
assert.equal(
  priorite.rotation.find(item => item.type === "action").gameId,
  "skill-prioritaire"
);
```

Run: `node tests/dps-simulation.test.js`

Expected: the performance test remains red; the literal scheduling assertions characterize the approved policy.

- [ ] **Step 4: Restore the precise Merlin accumulation proof**

Replace the weakened `some(total > 500)` assertion with the causal comparison at ten seconds:

```js
assert.ok(
  avecCumuls.rotation.find(e => e.type === "action"
    && e.gameId === "normal" && e.temps === 10).total
    > lancer([normal, zoneCumuls], [], 20).rotation.find(e =>
      e.type === "action" && e.gameId === "normal" && e.temps === 10
    ).total,
  "les impacts du Champ doivent construire le cumul de degats de Merlin"
);
```

Run: `node tests/dps-simulation.test.js`

Expected: still red only on the five-second performance bound.

- [ ] **Step 5: Implement the deterministic filler scheduler**

Add next to `prochainInstant()`:

```js
function prochaineRechargeHorsNormale(etat, borne){
  const candidats = Object.entries(etat.recharges)
    .filter(([categorie]) => categorie !== CATEGORIE_DPS.NORMAL)
    .map(([, disponible]) => disponible)
    .filter(disponible => Number.isFinite(disponible)
      && disponible > etat.tempsMs && disponible < borne);
  return candidats.length ? Math.min(...candidats) : null;
}
```

In `rechercher()`, split available actions:

```js
const disponibles = actionsDisponibles(etat, configuration);
const normales = disponibles.filter(action => action.categorie === "NORMAL");
const aRecharge = disponibles.filter(action => action.categorie !== "NORMAL");
const prochaineRecharge = prochaineRechargeHorsNormale(etat, borne);
const normaleRentre = prochaineRecharge === null || normales.some(action =>
  etat.tempsMs + action.animationMs <= prochaineRecharge
);
const actions = aRecharge.length
  ? aRecharge
  : normaleRentre ? normales : [];
```

Keep exhaustive recursion over `actions`. Build alignment waits only from `aRecharge`. When `disponibles` contains only a normal that does not fit, `actions` is empty and the existing `prochainInstant()` path advances through forced ticks/events until the cooldown. Do not add a second wait branch for a normal that fits.

Append the new hypothesis only when `attaqueNormaleIncluse` is true:

```js
...(attaqueNormaleIncluse ? ["attaques-normales-remplissage"] : [])
```

- [ ] **Step 6: Run focused regressions green**

Run:

```powershell
node tests/dps-simulation.test.js
node tests/dps-merlin.test.js
node tests/dps-effets.test.js
```

Expected: all three exit 0; the 60-second child finishes before its five-second timeout; burst timestamps remain `[0,5]`.

- [ ] **Step 7: Measure the actual 60-second runtime**

Run: `node .superpowers/sdd/2026-08-22-dps-sans-recharge/repro-performance.js 60`

Expected: JSON with `duree:60`, a finite result, and `elapsedMs < 5000`.

- [ ] **Step 8: Check the task diff without committing**

Run:

```powershell
git diff --check -- js/metier/dps-simulation.js tests/dps-simulation.test.js tests/helpers/dps-performance-runner.js
git diff --exit-code -- data/animations-mesurees.json
```

Expected: both commands exit 0.

---

### Task 2: Rendre la politique de priorité explicite

**Files:**
- Modify: `js/vues/fiche-heros.js`
- Modify: `tests/fiche-heros.test.js`
- Modify: `tests/apport-par-piece.playwright.js`
- Modify: `scripts/lister-chronometrage.py`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `simulation.hypotheses` containing `"attaques-normales-remplissage"` from Task 1.
- Produces heading: `"Rotation simulée selon les priorités connues"`.
- Produces hypothesis label: `"Attaques normales utilisées uniquement entre les compétences à recharge"`.

- [ ] **Step 1: Add failing hero-sheet copy assertions**

In the existing comparison fixture, add `"attaques-normales-remplissage"` to one build and assert:

```js
assert.match(texte, /Rotation simulée selon les priorités connues/);
assert.doesNotMatch(texte, /Rotation optimale selon les données connues/);
assert.match(texte,
  /Attaques normales utilisées uniquement entre les compétences à recharge/);
```

- [ ] **Step 2: Run the view test red**

Run: `node tests/fiche-heros.test.js`

Expected: FAIL because the heading and hypothesis mapping do not exist yet.

- [ ] **Step 3: Implement the honest copy**

In `libelleHypothese()`, add:

```js
"attaques-normales-remplissage":
  "Attaques normales utilisées uniquement entre les compétences à recharge"
```

Replace the `<summary>` text exactly:

```js
el("summary",{text:"Rotation simulée selon les priorités connues"})
```

- [ ] **Step 4: Run the view and simulation tests green**

Run:

```powershell
node tests/fiche-heros.test.js
node tests/dps-simulation.test.js
```

Expected: both exit 0.

Update the existing Playwright selector in
`tests/apport-par-piece.playwright.js` to click the same new heading, then run:

```powershell
node tests/apport-par-piece.playwright.js
```

Expected: exit 0; the real browser opens the renamed detail and completes the
existing equipment assertions.

- [ ] **Step 5: Correct durable documentation**

In `scripts/lister-chronometrage.py`, replace the obsolete comment saying an unknown category remains listed at the end with a comment saying it is rejected explicitly. In `AGENTS.md`, document that `NORMAL` is a deterministic filler, that ready cooldown skills are prioritized, and that the UI no longer promises a global optimum.

- [ ] **Step 6: Run all relevant local checks**

Run:

```powershell
python -m unittest tests/test_lister_chronometrage.py
python scripts/lister-chronometrage.py --check
node tests/fiche-heros.test.js
node tests/dps-simulation.test.js
node tests/dps-merlin.test.js
git diff --check
git diff --exit-code -- data/animations-mesurees.json
```

Expected: all commands exit 0.

- [ ] **Step 7: Run the complete project suite**

Run: `npm test`

Expected: unit and e2e summaries contain no failure.

- [ ] **Step 8: Review local state without integrating**

Run: `git status --short`

Expected: the intended local files remain modified/untracked; no commit, merge, push, worktree removal or external mutation has occurred.

## Correctif issu de la revue indépendante

La première implémentation ne regardait que le timestamp brut des recharges,
puis une première correction traitait chaque événement réducteur comme une
barrière. Ces deux approximations sont remplacées par une projection
déterministe : elle avance sur les échéances, ticks et événements périodiques
déjà planifiés jusqu'à la fin de l'animation, et ne refuse la normale que
lorsqu'une compétence à recharge devient réellement disponible avant cette fin.
Les effets causés par la normale candidate ne peuvent pas interdire leur propre
déclencheur. Les régressions couvrent une réduction périodique qui débloque le
burst, des réductions fréquentes qui ne doivent pas affamer le remplissage, une
réduction plate causée par la normale et le reset à 100 % de la spéciale Howzer.
