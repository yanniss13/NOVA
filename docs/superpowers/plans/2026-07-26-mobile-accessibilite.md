# Mobile et Accessibilité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les onglets, modales et contrôles principaux utilisables au clavier et sur écran tactile, tout en empêchant les débordements mobiles.

**Architecture:** Les onglets suivent le motif ARIA avec activation automatique. Une pile unique gère le focus de toutes les modales, y compris le Picker imbriqué ; les styles mobiles appliquent les cibles tactiles et les contraintes de viewport sans modifier la logique métier.

**Tech Stack:** HTML/CSS/JavaScript inline, ARIA, Playwright Chromium, PWA existante.

## Global Constraints

- Aucun changement de l'identité visuelle héraldique.
- Navigation complète avec clavier, souris et toucher.
- `Échap` ferme uniquement la modale supérieure.
- `Tab` et `Maj+Tab` restent dans la modale supérieure.
- Le focus revient au déclencheur ou, s'il a disparu, dans la modale sous-jacente.
- Cibles tactiles principales d'au moins 44 × 44 pixels.
- Aucun débordement horizontal de la page entre 320 et 390 pixels.
- `prefers-reduced-motion: reduce` désactive les mouvements décoratifs et le scroll fluide.
- Aucune nouvelle dépendance.

## File Structure

- `tests/accessibilite-mobile.playwright.js` : contrat des onglets, modales, cibles tactiles et viewport.
- `tests/supabase-etape1.playwright.js` : cas imbriqué Picker dans l'éditeur du roster.
- `index.html` : attributs ARIA, pile de modales, live regions et CSS responsive.
- `package.json` : ajout du nouveau parcours aux suites E2E et complète.
- `sw.js` : version de cache augmentée après le changement significatif d'interface.
- `AGENTS.md` : conventions d'accessibilité à préserver.

## Visual Direction

- Sujet : registre héraldique sombre manipulé rapidement pendant l'organisation
  d'un boss de guilde.
- Palette : focus en or brillant `#f0c674`, erreurs cramoisies `#a12c2c`,
  surfaces obsidienne `#0e0d12`/`#1b1922`.
- Typographie : Cinzel conserve son rôle de titre ; aucun texte utilitaire
  supplémentaire ne l'emploie.
- Signature : le focus doré suit les contrôles comme un filet d'enluminure,
  tandis que les cibles tactiles gagnent de l'espace sans devenir de gros blocs.
- Auto-critique : ne créer aucun nouveau composant visuel pour « montrer »
  l'accessibilité ; améliorer directement les contrôles existants.

---

### Task 1: Rendre les onglets principaux conformes au motif ARIA

**Files:**
- Create: `tests/accessibilite-mobile.playwright.js`
- Modify: `package.json`
- Modify: `index.html`

**Interfaces:**
- Consumes: six boutons `.tab[data-view]` et six sections `.view`.
- Produces: `showView(name)` synchronisant visibilité, sélection ARIA et focus clavier.

- [ ] **Step 1: Créer le test en échec**

Créer `tests/accessibilite-mobile.playwright.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{width:1280,height:900} });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    const tabs = page.getByRole("tab");
    assert.equal(await tabs.count(), 6);
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await tabs.nth(0).getAttribute("tabindex"), "0");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "false");
    assert.equal(await tabs.nth(1).getAttribute("tabindex"), "-1");

    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.nth(1).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-roster").isVisible(), true);

    await page.keyboard.press("End");
    assert.equal(await tabs.nth(5).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-boss").isVisible(), true);

    await page.keyboard.press("Home");
    assert.equal(await tabs.nth(0).getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#view-builder").isVisible(), true);
    assert.deepStrictEqual(errors, []);
    console.log("PASS accessibilité : onglets, modales et mobile");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
```

Modifier les scripts :

```json
"test": "node tests/roster-schema.test.js && node tests/pwa.test.js && node tests/reminder.test.js && python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js && node tests/scrollbars-invisibles.playwright.js && node tests/potentiel-commun.playwright.js && node tests/supabase-etape1.playwright.js && node tests/accessibilite-mobile.playwright.js",
"test:e2e": "node tests/scrollbars-invisibles.playwright.js && node tests/potentiel-commun.playwright.js && node tests/supabase-etape1.playwright.js && node tests/accessibilite-mobile.playwright.js"
```

- [ ] **Step 2: Vérifier le RED**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: FAIL car `aria-selected`, `tabindex` et la navigation fléchée sont
absents.

- [ ] **Step 3: Ajouter les relations ARIA au HTML**

Utiliser exactement les paires suivantes :

| Vue | Onglet | Panneau |
|---|---|---|
| builder | `tab-builder` | `view-builder` |
| roster | `tab-roster` | `view-roster` |
| member-roster | `tab-member-roster` | `view-member-roster` |
| recensement | `tab-recensement` | `view-recensement` |
| analyse | `tab-analyse` | `view-analyse` |
| boss | `tab-boss` | `view-boss` |

Le premier onglet prend :

```html
<button class="tab active" id="tab-builder" data-view="builder"
        role="tab" aria-controls="view-builder"
        aria-selected="true" tabindex="0">Créer une équipe</button>
```

Les cinq autres onglets reprennent la même structure avec leur paire exacte,
`aria-selected="false"` et `tabindex="-1"`. Chacune des six vues reçoit :

```html
<section id="view-builder" class="view active" role="tabpanel"
         aria-labelledby="tab-builder">
```

- [ ] **Step 4: Centraliser l'état et le clavier des onglets**

Remplacer le branchement actuel par :

```js
  const mainTabs = [...document.querySelectorAll(".tab[data-view]")];

  function showView(name){
    mainTabs.forEach(button => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("active", view.id === "view-"+name);
    });
    if(name==="builder") renderBuilder();
    if(name==="roster") void renderRoster();
    if(name==="member-roster") void renderMemberRoster();
    if(name==="recensement") void renderRecensement();
    if(name==="analyse") void renderAnalyse();
    if(name==="boss") void renderBossView();
    const reduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top:0, behavior:reduced ? "auto" : "smooth"});
  }

  mainTabs.forEach((button, index) => {
    button.addEventListener("click", ()=>showView(button.dataset.view));
    button.addEventListener("keydown", event => {
      let next = null;
      if(event.key === "ArrowRight") next = (index + 1) % mainTabs.length;
      if(event.key === "ArrowLeft"){
        next = (index - 1 + mainTabs.length) % mainTabs.length;
      }
      if(event.key === "Home") next = 0;
      if(event.key === "End") next = mainTabs.length - 1;
      if(next === null) return;
      event.preventDefault();
      const target = mainTabs[next];
      showView(target.dataset.view);
      target.focus();
    });
  });
```

- [ ] **Step 5: Vérifier le GREEN**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html package.json tests/accessibilite-mobile.playwright.js
git commit -m "feat: add accessible tab navigation"
```

---

### Task 2: Centraliser le focus et la fermeture des modales

**Files:**
- Modify: `tests/accessibilite-mobile.playwright.js`
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: overlays existants et élément actif au moment de l'ouverture.
- Produces: `ModalStack.open(overlay, initialFocus)`, `ModalStack.close(overlay)`, `ModalStack.focusTop()`.

- [ ] **Step 1: Ajouter les tests en échec d'une modale simple**

Avant le message PASS du nouveau test, ajouter :

```js
    const login = page.locator("#accountLogin");
    await login.focus();
    await login.click();
    await page.locator("#authOverlay").waitFor({state:"visible"});
    await page.waitForFunction(() => document.activeElement.id === "authEmail");
    await page.keyboard.press("Escape");
    await page.locator("#authOverlay").waitFor({state:"hidden"});
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "accountLogin"
    );

    const portrait = page.locator(".hero .portrait").first();
    await portrait.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.locator("#pickerClose").focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("#overlay").contains(document.activeElement)
      ),
      true
    );
    await page.keyboard.press("Escape");
    await page.locator("#overlay").waitFor({state:"hidden"});
    assert.equal(await portrait.evaluate(node => node === document.activeElement), true);
```

- [ ] **Step 2: Ajouter le test en échec de la modale imbriquée**

Dans `tests/supabase-etape1.playwright.js`, après l'ouverture de l'éditeur du
roster :

```js
    const rosterWeaponButton = page.locator(
      "#memberRosterEditor .gear-slot.weapon"
    );
    await rosterWeaponButton.click();
    await page.locator("#overlay").waitFor({state:"visible"});
    await page.keyboard.press("Escape");
    await page.locator("#overlay").waitFor({state:"hidden"});
    assert.equal(
      await page.locator("#memberRosterOverlay").isVisible(),
      true
    );
    assert.equal(
      await page.evaluate(() =>
        document.querySelector("#memberRosterOverlay")
          .contains(document.activeElement)
      ),
      true
    );
```

- [ ] **Step 3: Vérifier le RED**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: FAIL parce que `Échap` ne rend pas le focus au bouton Connexion.

Run: `node tests/supabase-etape1.playwright.js`

Expected: FAIL parce que le Picker ne restitue pas correctement le focus à la
modale sous-jacente.

- [ ] **Step 4: Ajouter la pile de modales**

Après les utilitaires DOM de `index.html`, ajouter :

```js
  const ModalStack = (function(){
    const stack = [];
    const focusableSelector = [
      "button:not([disabled])",
      "[href]",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])"
    ].join(",");

    function focusables(overlay){
      return [...overlay.querySelectorAll(focusableSelector)]
        .filter(node => !node.hidden && node.getClientRects().length);
    }

    function focusTop(){
      const record = stack[stack.length - 1];
      if(!record) return;
      const target = focusables(record.overlay)[0];
      if(target) target.focus();
    }

    function open(overlay, initialFocus, requestClose){
      const existing = stack.find(record => record.overlay === overlay);
      if(existing) return;
      const trigger = document.activeElement;
      overlay.classList.add("on");
      overlay.setAttribute("aria-hidden", "false");
      stack.push({ overlay, trigger, requestClose });
      setTimeout(() => {
        const target = typeof initialFocus === "string"
          ? overlay.querySelector(initialFocus)
          : initialFocus;
        if(target && target.focus) target.focus();
        else focusTop();
      }, 0);
    }

    function close(overlay){
      const index = stack.findIndex(record => record.overlay === overlay);
      if(index < 0) return;
      const [record] = stack.splice(index, 1);
      overlay.classList.remove("on");
      overlay.setAttribute("aria-hidden", "true");
      setTimeout(() => {
        if(record.trigger && record.trigger.isConnected && record.trigger.focus){
          record.trigger.focus();
        }else{
          focusTop();
        }
      }, 0);
    }

    document.addEventListener("keydown", event => {
      const record = stack[stack.length - 1];
      if(!record) return;
      if(event.key === "Escape"){
        event.preventDefault();
        if(record.requestClose) record.requestClose();
        else close(record.overlay);
        return;
      }
      if(event.key !== "Tab") return;
      const nodes = focusables(record.overlay);
      if(!nodes.length){
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if(event.shiftKey && document.activeElement === first){
        event.preventDefault();
        last.focus();
      }else if(!event.shiftKey && document.activeElement === last){
        event.preventDefault();
        first.focus();
      }
    });

    return { open, close, focusTop };
  })();
```

- [ ] **Step 5: Brancher tous les overlays**

Ajouter `aria-hidden="true"` aux cinq overlays. Remplacer leurs ouvertures et
fermetures :

```js
ModalStack.open(authOverlay, "#authEmail", closeAuth);
ModalStack.close(authOverlay);

ModalStack.open(overlay, "#pickerSearch", close);
ModalStack.close(overlay);

ModalStack.open(
  $("#memberRosterOverlay"),
  "#memberRosterClose",
  closeMemberRosterEditor
);
ModalStack.close($("#memberRosterOverlay"));

ModalStack.open($("#potOverlay"), "#potClose", close);
ModalStack.close($("#potOverlay"));

ModalStack.open($("#teamOverlay"), "#teamClose", closeTeamDetail);
ModalStack.close($("#teamOverlay"));
```

Extraire la fermeture du détail d'équipe :

```js
  function closeTeamDetail(){
    ModalStack.close($("#teamOverlay"));
  }

  $("#teamClose").addEventListener("click", closeTeamDetail);
  $("#teamOverlay").addEventListener("click", event => {
    if(event.target === $("#teamOverlay")) closeTeamDetail();
  });
```

Les autres callbacks ci-dessus réutilisent leurs fonctions métier existantes,
afin de vider correctement leurs brouillons.

Supprimer les cinq écouteurs `keydown` locaux qui ferment sur `Escape`. Les
clics sur le fond et les boutons de fermeture appellent toujours la fonction
`close()` métier correspondante.

- [ ] **Step 6: Vérifier le GREEN**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: PASS.

Run: `node tests/supabase-etape1.playwright.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/accessibilite-mobile.playwright.js tests/supabase-etape1.playwright.js
git commit -m "feat: trap and restore modal focus"
```

---

### Task 3: Ajouter les live regions et les contraintes tactiles

**Files:**
- Modify: `tests/accessibilite-mobile.playwright.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: viewport tactile 390 × 844 et contexte `reducedMotion:"reduce"`.
- Produces: contrôles mesurables à 44 px, page sans débordement et retours annoncés.

- [ ] **Step 1: Étendre le test avec un contexte mobile**

Après le premier `page` et avant la fermeture du navigateur, créer :

```js
    const mobileContext = await browser.newContext({
      viewport:{width:390,height:844},
      isMobile:true,
      hasTouch:true,
      reducedMotion:"reduce"
    });
    const mobile = await mobileContext.newPage();
    await mobile.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({
        status:200,
        contentType:"application/javascript",
        body:"window.supabase=undefined;"
      })
    );
    await mobile.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);

    assert.equal(await mobile.locator("#toast").getAttribute("role"), "status");
    assert.equal(await mobile.locator("#toast").getAttribute("aria-live"), "polite");

    for(const selector of [".tab", ".btn"]){
      const box = await mobile.locator(selector).first().boundingBox();
      assert.ok(box && box.height >= 44, selector+" doit mesurer au moins 44 px");
    }

    await mobile.locator(".hero .portrait").first().click();
    await mobile.locator('#pickerGrid .tile[title="Meliodas"]').click();
    const gearBox = await mobile.locator(".hero .gear-slot.weapon")
      .first().boundingBox();
    assert.ok(gearBox && gearBox.height >= 44, ".gear-slot doit mesurer 44 px");
    await mobile.locator(".hero .gear-slot.weapon").first().click();
    await mobile.locator("#overlay").waitFor({state:"visible"});
    for(const selector of [".icon-btn", ".chip"]){
      const box = await mobile.locator(selector).first().boundingBox();
      assert.ok(box && box.height >= 44, selector+" doit mesurer au moins 44 px");
      if(selector === ".icon-btn"){
        assert.ok(box.width >= 44, selector+" doit mesurer au moins 44 px de large");
      }
    }
    await mobile.keyboard.press("Escape");

    for(const name of [
      "builder", "roster", "member-roster",
      "recensement", "analyse", "boss"
    ]){
      await mobile.locator('.tab[data-view="'+name+'"]').click();
      await mobile.waitForTimeout(50);
      const overflow = await mobile.evaluate(() =>
        document.scrollingElement.scrollWidth -
        document.scrollingElement.clientWidth
      );
      assert.ok(overflow <= 1, "Débordement "+name+" : "+overflow+"px");
    }

    const motion = await mobile.locator(".view.active").evaluate(node => ({
      animationName:getComputedStyle(node).animationName,
      animationDuration:getComputedStyle(node).animationDuration
    }));
    assert.ok(
      motion.animationName === "none" || motion.animationDuration === "0s",
      "Les animations doivent être neutralisées"
    );
    await mobileContext.close();
```

Déplacer le `console.log()` après ce bloc.

- [ ] **Step 2: Vérifier le RED**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: FAIL sur `.icon-btn` à 34 px ou `.chip` sous 44 px.

- [ ] **Step 3: Rendre les retours accessibles**

Remplacer le toast :

```html
<div class="toast" id="toast" role="status"
     aria-live="polite" aria-atomic="true"></div>
```

Dans `toast(msg, isErr)` :

```js
    t.setAttribute("role", isErr ? "alert" : "status");
    t.setAttribute("aria-live", isErr ? "assertive" : "polite");
```

Ajouter des noms accessibles aux deux contrôles historiques uniquement
représentés par une croix :

```js
el("button",{
  class:"rec-del",
  type:"button",
  title:"Retirer le membre",
  "aria-label":"Retirer le membre",
  text:"✕"
})

el("button",{
  class:"dps-del",
  type:"button",
  title:"Retirer le DPS",
  "aria-label":"Retirer le DPS",
  text:"✕"
})
```

Étendre le focus visible :

```css
  :where(button,[href],input,select,textarea,[tabindex]):focus-visible{
    outline:2px solid var(--gold-bright);
    outline-offset:2px
  }
```

- [ ] **Step 4: Ajouter les styles tactiles et de viewport**

Ajouter :

```css
  .modal{
    max-height:min(88vh,calc(100dvh - 24px));
    max-width:100%
  }
  .toast{
    bottom:calc(26px + env(safe-area-inset-bottom))
  }
  .member-roster-card,.member-roster-build-tag,.boss-card,
  .team,.hero,.modal{
    overflow-wrap:anywhere
  }

  @media (pointer:coarse), (max-width:560px){
    button,.btn,.tab,.chip,.gear-slot,.pot-btn,.dps-elem-trigger,
    .dps-elem-option{
      min-height:44px
    }
    .icon-btn,.rec-del,.dps-del{
      min-width:44px;
      min-height:44px
    }
    .overlay{
      padding:
        max(12px,env(safe-area-inset-top))
        max(12px,env(safe-area-inset-right))
        max(12px,env(safe-area-inset-bottom))
        max(12px,env(safe-area-inset-left))
    }
  }
```

Conserver le bloc existant :

```css
  @media(prefers-reduced-motion:reduce){
    *{animation:none!important;transition:none!important}
  }
```

- [ ] **Step 5: Vérifier le GREEN**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: PASS.

- [ ] **Step 6: Vérifier les tests mobiles existants**

Run: `node tests/scrollbars-invisibles.playwright.js`

Expected: PASS.

Run: `node tests/supabase-etape1.playwright.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/accessibilite-mobile.playwright.js
git commit -m "feat: improve touch targets and live feedback"
```

---

### Task 4: Documenter et vérifier l'ensemble

**Files:**
- Modify: `AGENTS.md`
- Modify: `sw.js`

**Interfaces:**
- Consumes: parcours accessibilité terminé.
- Produces: conventions de reprise et cache PWA renouvelé.

- [ ] **Step 1: Documenter les invariants**

Ajouter à `AGENTS.md` :

```markdown
## Accessibilité et mobile

Les onglets principaux suivent le motif ARIA et se pilotent avec les flèches,
Début et Fin. Toutes les modales passent par `ModalStack`, qui gère la pile, le
piège à focus, Échap et la restitution du focus. Ne pas réintroduire d'écouteurs
Échap locaux. Sur écran tactile, les contrôles principaux restent à 44 × 44 px
minimum et aucune vue ne doit élargir le document.
```

- [ ] **Step 2: Renouveler le cache PWA**

Dans `sw.js` :

```js
const CACHE = "conf7ds-v3";
```

- [ ] **Step 3: Exécuter la suite complète**

Run: `npm test`

Expected: toutes les suites Node, Python et Playwright passent.

- [ ] **Step 4: Vérifier le diff et les références obsolètes**

Run: `git diff --check`

Expected: aucune sortie et code de retour 0.

Run: `rg -n 'document\\.addEventListener\\(\"keydown\".*Escape' index.html`

Expected: aucune fermeture locale de modale ; seuls le gestionnaire global et
les contrôles non modaux spécialisés peuvent traiter `Escape`.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md sw.js
git commit -m "docs: preserve mobile accessibility contracts"
```
