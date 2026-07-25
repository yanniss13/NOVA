# Barres de défilement invisibles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Masquer toutes les barres de défilement du site sans désactiver le défilement.

**Architecture:** Une règle CSS globale agit sur tous les conteneurs défilables. Un test Playwright vérifie les styles calculés et fait réellement défiler un conteneur dans les deux axes ; les parcours existants prouvent que les rails et la page restent sans débordement mobile.

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
- Create: `tests/scrollbars-invisibles.playwright.js`
- Modify: `index.html:35-50`
- Modify: `package.json:6-9`

**Interfaces:**
- Consumes: feuille CSS inline de `index.html`.
- Produces: règle globale de présentation des barres, sans API JavaScript.

- [ ] **Step 1: Écrire le test de comportement rouge**

```js
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage();
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    const result = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.cssText = "width:100px;height:100px;overflow:auto;position:fixed;left:-9999px";
      const content = document.createElement("div");
      content.style.cssText = "width:300px;height:300px";
      probe.appendChild(content);
      document.body.appendChild(probe);

      probe.scrollTop = 45;
      probe.scrollLeft = 35;
      const measured = {
        scrollbarWidth:getComputedStyle(probe).scrollbarWidth,
        webkitDisplay:getComputedStyle(probe, "::-webkit-scrollbar").display,
        scrollTop:probe.scrollTop,
        scrollLeft:probe.scrollLeft
      };
      probe.remove();
      return measured;
    });

    assert.equal(result.scrollbarWidth, "none");
    assert.equal(result.webkitDisplay, "none");
    assert.equal(result.scrollTop, 45);
    assert.equal(result.scrollLeft, 35);
    console.log("PASS Playwright: barres invisibles, défilement conservé");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Confirmer l’échec**

Run: `node tests/scrollbars-invisibles.playwright.js`

Expected: FAIL sur `scrollbarWidth` car aucune règle globale
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

Ajouter aux scripts `test` et `test:e2e` de `package.json` :

```json
"node tests/scrollbars-invisibles.playwright.js"
```

- [ ] **Step 5: Vérifier le test ciblé**

Run: `node tests/scrollbars-invisibles.playwright.js`

Expected: `PASS Playwright: barres invisibles, défilement conservé`.

- [ ] **Step 6: Vérifier tous les comportements**

Run: `npm test`

Expected: tous les tests Node et Playwright passent, y compris les contrôles
mobiles et le rail horizontal des types d’arme.

- [ ] **Step 7: Vérifier le diff et enregistrer**

Run: `git diff --check`

Expected: aucune erreur.

```powershell
git add index.html package.json tests/scrollbars-invisibles.playwright.js
git commit -m "style: masquer toutes les barres de défilement"
```
