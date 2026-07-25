# Barres de défilement invisibles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Masquer toutes les barres de défilement du site sans désactiver le défilement.

**Architecture:** Une règle CSS globale agit sur tous les conteneurs défilables. Un test Node vérifie les mécanismes Firefox et WebKit ; les parcours Playwright existants prouvent que les rails et la page restent défilables et sans débordement mobile.

**Tech Stack:** HTML/CSS autonome, Node.js `assert`, Playwright Chromium.

## Global Constraints

- Ne modifier aucune règle `overflow` existante.
- Conserver molette, pavé tactile, toucher, clavier et gestes horizontaux.
- Couvrir Firefox avec `scrollbar-width:none`.
- Couvrir Chromium et Safari avec `::-webkit-scrollbar`.
- Ne pas ajouter de dépendance runtime.

---

### Task 1: Masquage global sans perte du défilement

**Files:**
- Create: `tests/scrollbars-invisibles.test.js`
- Modify: `index.html:35-50`
- Modify: `package.json:6-9`

**Interfaces:**
- Consumes: feuille CSS inline de `index.html`.
- Produces: règle globale de présentation des barres, sans API JavaScript.

- [ ] **Step 1: Écrire le test statique rouge**

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(
  path.resolve(__dirname, "..", "index.html"),
  "utf8"
);

assert.match(
  html,
  /\*\s*\{[^}]*scrollbar-width\s*:\s*none[^}]*\}/i,
  "Tous les conteneurs doivent masquer leur barre dans Firefox"
);
assert.match(
  html,
  /\*::\s*-webkit-scrollbar\s*\{[^}]*display\s*:\s*none[^}]*\}/i,
  "Tous les conteneurs doivent masquer leur barre dans Chromium et Safari"
);

console.log("PASS barres de défilement invisibles");
```

- [ ] **Step 2: Confirmer l’échec**

Run: `node tests/scrollbars-invisibles.test.js`

Expected: FAIL sur la première assertion car aucune règle globale
`scrollbar-width:none` n’existe.

- [ ] **Step 3: Ajouter la règle CSS minimale**

Dans la feuille `<style>` principale, immédiatement après le reset :

```css
  *{scrollbar-width:none}
  *::-webkit-scrollbar{width:0;height:0;display:none}
```

Ces règles masquent seulement l’habillage natif. Elles ne changent ni
`overflow`, ni `scrollWidth`, ni `scrollHeight`.

- [ ] **Step 4: Ajouter le test à la suite**

Préfixer les scripts `test` et `test:unit` de `package.json` avec :

```json
"node tests/scrollbars-invisibles.test.js && "
```

- [ ] **Step 5: Vérifier le test ciblé**

Run: `node tests/scrollbars-invisibles.test.js`

Expected: `PASS barres de défilement invisibles`.

- [ ] **Step 6: Vérifier tous les comportements**

Run: `npm test`

Expected: tous les tests Node et Playwright passent, y compris les contrôles
mobiles et le rail horizontal des types d’arme.

- [ ] **Step 7: Vérifier le diff et enregistrer**

Run: `git diff --check`

Expected: aucune erreur.

```powershell
git add index.html package.json tests/scrollbars-invisibles.test.js
git commit -m "style: masquer toutes les barres de défilement"
```
