# Clavier numérique mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le pavé numérique mobile pour chaque saisie réservée aux entiers.

**Architecture:** Une fonction pure centralise les attributs HTML des champs numériques créés dynamiquement. Les quatre familles de saisie du builder l’utilisent, tandis que le champ statique du score reçoit les mêmes attributs directement.

**Tech Stack:** HTML autonome, JavaScript inline, tests Node et Playwright existants.

## Global Constraints

- Ne modifier ni les calculs, ni les bornes, ni la persistance des valeurs.
- Réserver le clavier numérique aux champs qui acceptent exclusivement des entiers non négatifs.
- Conserver les fins de ligne existantes de `index.html` et éviter toute normalisation globale.
- Ne toucher ni `.claude/` ni `.vscode/`.

---

### Task 1: Centraliser et appliquer les attributs du pavé numérique

**Files:**
- Modify: `index.html:1839,2073,4982,5138,5215,5543,5631`
- Modify: `tests/helpers/load-app.js`
- Test: `tests/potentiel-commun.test.js`

**Interfaces:**
- Consumes: les objets de propriétés déjà passés à `el("input", props)`.
- Produces: `numericKeyboardInputProps(props)`, qui retourne les propriétés reçues avec `type:"number"`, `inputmode:"numeric"` et `pattern:"[0-9]*"`.

- [ ] **Step 1: Écrire le test en échec**

Ajouter `numericKeyboardInputProps` aux exports facultatifs de `tests/helpers/load-app.js`, puis ajouter dans `tests/potentiel-commun.test.js` :

```js
// Les saisies exclusivement entières doivent demander le pavé numérique mobile.
{
  const source = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const { hooks } = loadApp();
  assert.deepStrictEqual(
    plain(hooks.numericKeyboardInputProps({ class:"numeric-test", min:"0" })),
    {
      type:"number",
      inputmode:"numeric",
      pattern:"[0-9]*",
      class:"numeric-test",
      min:"0"
    }
  );
  assert.match(
    source,
    /<input id="bossScore"[^>]*inputmode="numeric"[^>]*pattern="\[0-9\]\*"/
  );
  assert.strictEqual(
    (source.match(/numericKeyboardInputProps\(\{/g) || []).length,
    5,
    "Les cinq créations de champs numériques dynamiques doivent partager le contrat"
  );
  assert.strictEqual(
    (source.match(/type:"number"/g) || []).length,
    1,
    "Le type number doit être centralisé dans numericKeyboardInputProps"
  );
}
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL parce que `hooks.numericKeyboardInputProps` est absent et que `bossScore` ne possède pas encore `pattern="[0-9]*"`.

- [ ] **Step 3: Écrire l’implémentation minimale**

Ajouter près de `el()` dans `index.html` :

```js
function numericKeyboardInputProps(props){
  return Object.assign({
    type:"number",
    inputmode:"numeric",
    pattern:"[0-9]*"
  }, props || {});
}
```

Pour les deux valeurs d’enchantement d’arme, le niveau d’arme, la valeur d’option d’équipement et le niveau de qualité, remplacer :

```js
el("input", {
  class:"...",
  type:"number",
  // propriétés existantes
});
```

par :

```js
el("input", numericKeyboardInputProps({
  class:"...",
  // propriétés existantes, sans type
}));
```

Il existe cinq appels au total : deux rendus d’enchantement d’arme, le niveau
d’arme, une option d’équipement et le niveau de qualité. Le test doit donc
compter exactement cinq appels au helper.

Ajouter au champ statique :

```html
<input id="bossScore" type="text" inputmode="numeric" pattern="[0-9]*"
       autocomplete="off" aria-describedby="bossReportError">
```

Enfin, exposer la fonction dans `HOOK_EXPORT` :

```js
numericKeyboardInputProps:
  typeof numericKeyboardInputProps === "function"
    ? numericKeyboardInputProps
    : undefined,
```

- [ ] **Step 4: Vérifier le test ciblé puis la suite complète**

Run: `node tests/potentiel-commun.test.js`

Expected: PASS.

Run: `npm test`

Expected: toutes les suites passent.

- [ ] **Step 5: Contrôler le diff et committer**

Run: `git diff --check`

Expected: aucune erreur.

```powershell
git add -- index.html tests/helpers/load-app.js tests/potentiel-commun.test.js
git commit -m "feat: afficher le pave numerique mobile"
```
