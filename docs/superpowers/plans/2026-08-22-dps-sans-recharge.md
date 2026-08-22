# DPS sans recharge mesurée Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire entrer les attaques normales et l’attaque spéciale sans recharge dans la rotation DPS uniquement lorsque leur animation réelle est mesurée, tout en isolant clairement les relèves.

**Architecture:** Le simulateur décide seul de l’éligibilité temporelle et garantit qu’une recharge nulle possède une durée strictement positive. Le générateur de chronométrage reflète ensuite trois niveaux d’utilité — débloque, affine, relève — consommés sans requête supplémentaire par « Mon suivi » et Discord.

**Tech Stack:** JavaScript ES modules, moteur événementiel pur, Node `assert`, Python `unittest`, fichiers statiques générés, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-22-chronometrage-fiable-dps-sans-recharge-design.md`

## Global Constraints

- Le plan `2026-08-22-chronometrage-fiable.md` doit être vert avant ce plan.
- Ne modifier ni régénérer `data/animations-mesurees.json`.
- Ne faire aucun commit, push, déploiement ou mutation externe.
- Une recharge nulle n’est planifiable qu’avec une animation mesurée strictement positive.
- `NORMAL` et `ACTIVE_THIRD` sont les seules catégories sans recharge ajoutées.
- `TAG_SKILL` reste hors simulation avec `raison:"releve-hors-simulation-equipe"`.
- Sans animation mesurée, les résultats historiques restent inchangés.
- Les sorties générées changent uniquement via `scripts/lister-chronometrage.py`.
- Tous les changements suivent un test rouge puis vert.

---

### Task 1: Make zero-recharge actions safe in the event engine

**Files:**
- Modify: `js/metier/dps-simulation.js`
- Test: `tests/dps-simulation.test.js`

**Interfaces:**
- Existing: `simulerDpsCompetences(entree) -> resultat` remains the public API.
- New internal category: `CATEGORIE_DPS.NORMAL === "normal"`.
- New exclusion: `{ id, nom, raison:"releve-hors-simulation-equipe" }`.

- [ ] **Step 1: Write failing tests for measured and missing zero recharge**

Append near the existing animation tests:

```js
{
  const attaqueNormale = {
    gameId:"auto",
    nom:"Auto-attaque",
    categorie:"NORMAL",
    recharge:0,
    composantes:[{ base:"atk", pourcentage:100 }],
    pourcentage:100
  };
  const sansAnimation = lancer([attaqueNormale], [], 3);
  assert.equal(sansAnimation.dps, null);
  assert.ok(sansAnimation.nonInclus.some(e =>
    e.id === "auto" && e.raison === "categorie-ou-recharge-non-modelisee"
  ));

  const avecAnimation = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[attaqueNormale],
    effets:[], cible:CIBLE_NEUTRE, duree:3,
    animations:{ auto:1 }
  });
  assert.deepStrictEqual(
    Array.from(avecAnimation.rotation
      .filter(e => e.type === "action").map(e => e.temps)),
    [0, 1, 2]
  );
  assert.equal(avecAnimation.animations.mesurees, 1);
  assert.equal(avecAnimation.animations.total, 1);
  assert.ok(!avecAnimation.hypotheses.includes(
    "attaques-normales-non-chiffrees"
  ));
}
```

Add the one supported zero-recharge special case:

```js
{
  const speciale = {
    gameId:"speciale-zero", nom:"Spéciale", categorie:"ACTIVE_THIRD",
    recharge:0, composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
  };
  const simulation = simulerDpsCompetences({
    stats:SANS_CRITIQUE, competences:[speciale], effets:[],
    cible:CIBLE_NEUTRE, duree:2, animations:{ "speciale-zero":0.5 }
  });
  assert.deepStrictEqual(
    Array.from(simulation.rotation
      .filter(e => e.type === "action").map(e => e.temps)),
    [0, 0.5, 1, 1.5]
  );
}
```

- [ ] **Step 2: Write the failing relay exclusion test**

```js
{
  const releve = simulerDpsCompetences({
    stats:SANS_CRITIQUE,
    competences:[{
      gameId:"tag", nom:"Relève", categorie:"TAG_SKILL", recharge:0,
      composantes:[{ base:"atk", pourcentage:100 }], pourcentage:100
    }],
    effets:[], cible:CIBLE_NEUTRE, duree:3, animations:{ tag:1 }
  });
  assert.equal(releve.dps, null);
  assert.ok(releve.nonInclus.some(e =>
    e.id === "tag" && e.raison === "releve-hors-simulation-equipe"
  ));
}
```

- [ ] **Step 3: Run the focused simulation test**

Run: `node tests/dps-simulation.test.js`

Expected: FAIL because `NORMAL` and recharge zero remain excluded and the
relay reason is still generic.

- [ ] **Step 4: Add category and eligibility helpers**

Add `NORMAL:"normal"` to `CATEGORIE_DPS`. Before filtering input skills in
`simulerDpsCompetences`, read a copied `animations` object and calculate:

```js
const animationMsDe = competence => Math.max(
  0, enMs(animations[competence && competence.gameId]) || 0
);
const rechargeMs = enMs(competence && competence.recharge);
const sansRechargeModelisee = rechargeMs === 0
  && ["NORMAL", "ACTIVE_THIRD"].includes(competence && competence.categorie)
  && animationMsDe(competence) > 0;
const rechargeValide = rechargeMs > 0 || sansRechargeModelisee;
```

When rejecting `TAG_SKILL`, emit `releve-hors-simulation-equipe` before the
generic reason. Keep the damage and category guards unchanged.

- [ ] **Step 5: Make zero recharge available exactly after its animation**

In `dureeRecharge()`:

```js
if(enMs(competence.recharge) === 0){
  return Math.max(1, competence.animationMs);
}
```

Add `normal:0` to the initial `etat.recharges`. Because `executerAction()`
already advances `tempsMs` by `animationMs` after scheduling the recharge, the
same action becomes available exactly at animation end.

Compute `attaqueNormaleIncluse` from `configuration.competences`. Append
`attaques-normales-non-chiffrees` only when it is false, in both the empty and
normal result branches.

- [ ] **Step 6: Run simulation regressions**

Run:

```powershell
node tests/dps-simulation.test.js
node tests/dps-merlin.test.js
node tests/dps-effets.test.js
```

Expected: all three print their PASS/OK message. Existing positive-recharge
timestamps remain unchanged.

- [ ] **Step 7: Review the local diff without committing**

Run: `git diff --check -- js/metier/dps-simulation.js tests/dps-simulation.test.js`

Expected: exit 0.

---

### Task 2: Make coverage and wording honest in the hero sheet

**Files:**
- Modify: `js/vues/fiche-heros.js`
- Test: `tests/fiche-heros.test.js`

**Interfaces:**
- Consumes: `hypotheses` and `nonInclus[].raison` from Task 1.
- Produces: French label for `releve-hors-simulation-equipe`.

- [ ] **Step 1: Add a failing rendering test for conditional normal coverage**

Extend the two-build fixture in `tests/fiche-heros.test.js` with one line whose
`hypotheses` omits `attaques-normales-non-chiffrees`, and assert the detail for
that line does not invent the phrase. Add an exclusion fixture:

```js
exclusions:[{ raison:"releve-hors-simulation-equipe" }]
```

Assert the rendered text contains:

```js
assert.match(texte, /Compétence de relève hors simulation d’équipe/);
```

- [ ] **Step 2: Run the focused view test**

Run: `node tests/fiche-heros.test.js`

Expected: FAIL because the raw reason is displayed.

- [ ] **Step 3: Centralize the exclusion label**

Add a `libelleExclusion(exclusion)` helper next to `libelleHypothese()`:

```js
function libelleExclusion(exclusion){
  if(exclusion && exclusion.raison === "releve-hors-simulation-equipe"){
    return "Compétence de relève hors simulation d’équipe";
  }
  return exclusion && (
    exclusion.texteFr || exclusion.nom || exclusion.id || exclusion.raison
  );
}
```

Use it in `detailRotation()`. Change the permanent summary sentence
`"Attaques normales et temps d'animation non chiffrés."` so it does not make a
global claim contradicted by covered builds; retain the per-build hypothesis
list as source of truth. Exact replacement:

```text
La couverture exacte des animations et effets est détaillée pour chaque build.
```

- [ ] **Step 4: Run focused view and simulation tests**

Run:

```powershell
node tests/fiche-heros.test.js
node tests/dps-simulation.test.js
```

Expected: both pass.

- [ ] **Step 5: Review the local diff without committing**

Run: `git diff --check -- js/vues/fiche-heros.js tests/fiche-heros.test.js`

Expected: exit 0.

---

### Task 3: Generate three honest measurement priorities

**Files:**
- Modify: `scripts/lister-chronometrage.py`
- Modify: `tests/test_lister_chronometrage.py`
- Regenerate: `docs/chronometrage-animations.md`
- Regenerate: `data/chronometrage-avancement.json`

**Interfaces:**
- Changes: `lignes() -> (debloquent, affinent, releves)`.
- Changes JSON: adds integer `affinent` and `releves`.
- Changes JSON: `prochaines[].role` is `debloque|affine|releve`.

- [ ] **Step 1: Rewrite the synthetic priority test to fail on two groups**

Use four unmeasured skills and one measured normal:

```python
competences = [
    {"gameId":"avec-recharge", "weaponType":"Axe", "nom":"Affine",
     "categorie":"ULTIMATE", "pourcentage":500, "recharge":12},
    {"gameId":"auto", "weaponType":"Axe", "nom":"Débloque",
     "categorie":"NORMAL", "pourcentage":100, "recharge":0},
    {"gameId":"speciale-zero", "weaponType":"Axe", "nom":"Débloque Q",
     "categorie":"ACTIVE_THIRD", "pourcentage":200, "recharge":0},
    {"gameId":"releve", "weaponType":"Axe", "nom":"Future",
     "categorie":"TAG_SKILL", "pourcentage":300, "recharge":0},
    {"gameId":"deja-mesuree", "weaponType":"Axe", "nom":"Faite",
     "categorie":"NORMAL", "pourcentage":400, "recharge":0},
]
```

Assert:

```python
self.assertEqual(avancement["total"], 5)
self.assertEqual(avancement["mesurees"], 1)
self.assertEqual(avancement["debloquent"], 3)
self.assertEqual(avancement["affinent"], 1)
self.assertEqual(avancement["releves"], 1)
self.assertEqual(
    [ligne["gameId"] for ligne in avancement["prochaines"]],
    ["auto", "speciale-zero", "avec-recharge", "releve"],
)
self.assertEqual(
    [ligne["role"] for ligne in avancement["prochaines"]],
    ["debloque", "debloque", "affine", "releve"],
)
```

The measured normal counts in `debloquent` but is absent from `prochaines`.

- [ ] **Step 2: Run the Python test and observe missing three-way output**

Run: `python -m unittest tests/test_lister_chronometrage.py`

Expected: FAIL because `affinent`/`releves` do not exist and ordering differs.

- [ ] **Step 3: Implement three-way classification**

Change `lignes()` to initialize three lists. Classify with:

```python
if recharge > 0:
    ligne["impact"] = ANIMATION_SUPPOSEE / (recharge + ANIMATION_SUPPOSEE) * 100
    affinent.append(ligne)
elif categorie in ("NORMAL", "ACTIVE_THIRD"):
    ligne["impact"] = None
    debloquent.append(ligne)
else:
    ligne["impact"] = None
    releves.append(ligne)
```

Sort `debloquent` by category rank then descending damage, `affinent` by
descending impact, and `releves` by category rank then descending damage.
Return all three.

Update `rendre()` to emit exact sections in this order:

1. `Mesures qui débloquent maintenant`;
2. `Mesures qui affinent maintenant`;
3. `Relèves — simulation d’équipe future`.

Update `rendre_avancement()` counters and build `restantes` from
`debloquent + affinent + releves`, assigning exact roles.

- [ ] **Step 4: Run generator unit tests**

Run: `python -m unittest tests/test_lister_chronometrage.py`

Expected: all tests pass except the published-file freshness test, which may
fail until regeneration.

- [ ] **Step 5: Regenerate both derived outputs**

Run: `python scripts/lister-chronometrage.py`

Expected:

```text
ecrit docs/chronometrage-animations.md
ecrit data/chronometrage-avancement.json
```

- [ ] **Step 6: Verify exact published counts and order**

Run:

```powershell
python scripts/lister-chronometrage.py --check
python -m unittest tests/test_lister_chronometrage.py
```

Expected: check is current and tests assert `total=335`, `debloquent=76`,
`affinent=184`, `releves=75`; the first five `prochaines` have role
`debloque` while no measurements exist.

- [ ] **Step 7: Prove the manual source stayed untouched**

Run: `git diff --exit-code -- data/animations-mesurees.json`

Expected: exit 0 and no output.

---

### Task 4: Align dashboard, Discord and operational documentation

**Files:**
- Modify: `js/vues/suivi.js`
- Modify: `supabase/functions/_shared/discord-planning.js`
- Modify: `tests/mon-suivi.test.js`
- Modify: `tests/discord-planning.test.js`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes JSON counters `debloquent`, `affinent`, `releves` from Task 3.
- Does not fetch Supabase when switching or rendering views.

- [ ] **Step 1: Write failing dashboard copy assertions**

Use fixture counters `debloquent:76`, `affinent:184`, `releves:75` and assert
the dashboard text contains:

```js
assert.match(lu, /76 compétences sans recharge deviennent calculables avec leur mesure/);
assert.match(lu, /75 compétences de relève attendent une simulation d’équipe/);
```

Update the first `prochaines` fixture to `role:"debloque"` and a normal attack.

- [ ] **Step 2: Write failing Discord copy assertions**

Use the same counters and assert:

```js
assert.match(messageChrono, /76 compétences sans recharge deviennent calculables par leur mesure/);
assert.match(messageChrono, /75 relèves restent hors du comparateur individuel/);
```

- [ ] **Step 3: Run both focused tests**

Run:

```powershell
node tests/mon-suivi.test.js
node tests/discord-planning.test.js
```

Expected: both fail on the old two-group wording.

- [ ] **Step 4: Implement exact three-group copy**

In `chronoCarte()`, read all three counters and replace the old sentence with:

```text
Aucune source publique ne publie ces durées. 76 compétences sans recharge
deviennent calculables avec leur mesure ; 184 calculs existants sont affinés. 75 compétences de
relève attendent une simulation d’équipe.
```

Build it dynamically from counters and omit only clauses whose count is zero.

In `formatChronoMessage()`, use the corresponding Discord wording:

```text
76 compétences sans recharge deviennent calculables par leur mesure ; 184 calculs existants sont affinés.
75 relèves restent hors du comparateur individuel.
```

- [ ] **Step 5: Update `AGENTS.md`**

Replace the current two-group chronology paragraph with the exact `76 → 184 →
75` contract, document the measured-animation guard, the relay exclusion, and
the conditional removal of `attaques-normales-non-chiffrees`.

- [ ] **Step 6: Run targeted verification**

Run:

```powershell
node tests/dps-simulation.test.js
node tests/dps-merlin.test.js
node tests/fiche-heros.test.js
python -m unittest tests/test_lister_chronometrage.py
python scripts/lister-chronometrage.py --check
node tests/mon-suivi.test.js
node tests/discord-planning.test.js
git diff --check
git diff --exit-code -- data/animations-mesurees.json
```

Expected: all commands exit 0 and the manual measurement JSON has no diff.

- [ ] **Step 7: Run the whole project suite**

Run: `npm test`

Expected: `unit 63/63` and `e2e 16/16` or higher, zero failures.

- [ ] **Step 8: Final local-only review**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected: the intended implementation, spec and plan files are local; the
pre-existing `AUDIT-jessmarchal-fr.md` remains untouched. Do not commit, push,
deploy the Edge Function or apply `supabase/schema.sql`.
