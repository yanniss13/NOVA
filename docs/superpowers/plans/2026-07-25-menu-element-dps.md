# Custom DPS Element Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le sélecteur natif d’élément du recensement DPS par un menu héraldique entièrement personnalisé, accessible et persistant.

**Architecture:** Le composant reste construit dans `index.html` par `elemControl(charId, current, onChange)`. Un petit contrôleur partagé garantit qu’un seul menu est ouvert, ferme au clic extérieur et coordonne le focus ; la valeur continue d’être transmise au callback existant, sans changement du stockage local ou Supabase.

**Tech Stack:** HTML/CSS/JavaScript sans dépendance dans `index.html`, Node.js, Playwright, `node:assert/strict`.

## Global Constraints

- Uniquement le choix d’élément présent dans chaque ligne DPS du recensement.
- Les sept éléments et leurs couleurs continuent de provenir de la constante `ELEMENTS`.
- La valeur enregistrée reste l’identifiant actuel de l’élément.
- Aucun changement aux données locales, à Supabase ou aux autres sélecteurs.
- Une seule liste peut être ouverte à la fois.
- Les contrôles souris et clavier, les attributs ARIA, le mobile et `prefers-reduced-motion` doivent être couverts.
- Le projet reste sans nouvelle dépendance et fonctionne en `file://`.

---

### Task 1: Accessible custom element menu behavior

**Files:**
- Create: `tests/menu-element-dps.playwright.js`
- Modify: `index.html:2062-2098`
- Modify: `package.json:6-10`

**Interfaces:**
- Consumes: `charElements(charId): string[]`, `elemLabel(element): string`, `elemColor(element): string`, `el(tag, props, kids): HTMLElement`.
- Produces: `elemControl(charId: string, current: string, onChange: (element: string) => void): HTMLElement`, `.dps-elem-trigger`, `.dps-elem-menu`, and options carrying `role="option"`.

- [ ] **Step 1: Write the failing Playwright behavior test**

Create `tests/menu-element-dps.playwright.js` with a local recensement containing
two multi-element characters, then exercise ARIA, exclusivity, keyboard control,
click-outside closing, and persistence:

```js
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const REC_KEY = "confrerie7ds.recensement";

(async()=>{
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.addInitScript(({ key }) => {
      localStorage.setItem(key, JSON.stringify([{
        id:"menu-test",
        name:"Test menu",
        dps:[
          { char:"merlin", element:"ICE", pot:5 },
          { char:"tristan", element:"FIRE", pot:3 }
        ]
      }]));
    }, { key:REC_KEY });

    await page.goto(pathToFileURL(path.resolve(__dirname, "..", "index.html")).href);
    await page.getByRole("button", {
      name:"Continuer hors connexion",
      exact:true
    }).click();
    await page.locator('.tab[data-view="recensement"]').click();

    const triggers = page.locator(".dps-elem-trigger");
    assert.equal(await triggers.count(), 2);
    assert.equal(await page.locator(".dps-elem-sel select").count(), 0);

    const first = page.locator(".dps-row").filter({ hasText:"Merlin" })
      .locator(".dps-elem-trigger");
    const other = page.locator(".dps-row").filter({ hasText:"Tristan" })
      .locator(".dps-elem-trigger");
    assert.equal(await first.getAttribute("aria-haspopup"), "listbox");
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    await first.click();
    assert.equal(await first.getAttribute("aria-expanded"), "true");

    const firstMenu = page.locator(".dps-row").filter({ hasText:"Merlin" })
      .locator(".dps-elem-menu");
    await firstMenu.waitFor({ state:"visible" });
    assert.equal(await firstMenu.getByRole("option").count(), 3);
    assert.equal(
      await firstMenu.getByRole("option", { name:"Glace", exact:true })
        .getAttribute("aria-selected"),
      "true"
    );

    await other.click();
    assert.equal(await page.locator(".dps-elem-menu:visible").count(), 1);
    assert.equal(await first.getAttribute("aria-expanded"), "false");

    await first.click();
    await firstMenu.getByRole("option", { name:"Glace", exact:true }).press("ArrowDown");
    await page.locator(":focus").press("Enter");
    assert.equal(await first.locator(".dps-elem-label").textContent(), "Foudre");
    await page.waitForFunction(key => {
      const stored = JSON.parse(localStorage.getItem(key));
      return stored[0].dps.find(item => item.char === "merlin").element === "THUNDER";
    }, REC_KEY);

    await first.click();
    await firstMenu.getByRole("option", { name:"Foudre", exact:true }).press("Escape");
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    assert.equal(await first.evaluate(node => node === document.activeElement), true);

    await first.click();
    await page.locator(".rec-player-head").click();
    assert.equal(await first.getAttribute("aria-expanded"), "false");
    assert.deepEqual(errors, []);

    console.log("PASS Playwright: menu d’élément DPS accessible et persistant");
  }finally{
    await browser.close();
  }
})().catch(error=>{
  console.error(error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Register and run the test to verify it fails**

Add the new command to both relevant scripts:

```json
{
  "scripts": {
    "test": "python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js && node tests/potentiel-commun.playwright.js && node tests/supabase-etape1.playwright.js && node tests/menu-element-dps.playwright.js",
    "test:e2e": "node tests/potentiel-commun.playwright.js && node tests/supabase-etape1.playwright.js && node tests/menu-element-dps.playwright.js"
  }
}
```

Run:

```powershell
node tests/menu-element-dps.playwright.js
```

Expected: FAIL because `.dps-elem-trigger` does not exist and the native
`<select>` is still rendered.

- [ ] **Step 3: Add the shared open-menu controller**

Immediately before `elemControl`, add one document-level controller so rerenders
do not register one outside-click listener per DPS row:

```js
let activeElemMenu = null;

function closeActiveElemMenu(restoreFocus=false){
  if(!activeElemMenu) return;
  const closing = activeElemMenu;
  activeElemMenu = null;
  closing.close(restoreFocus);
}

document.addEventListener("pointerdown", event=>{
  if(activeElemMenu && !activeElemMenu.root.contains(event.target)){
    closeActiveElemMenu(false);
  }
});
```

- [ ] **Step 4: Replace the native select with the accessible custom component**

Rewrite `elemControl` around this structure and behavior:

```js
function elemControl(charId, current, onChange){
  const opts = charElements(charId);
  if(opts.length <= 1) return elemBadge(current || opts[0] || elemOf(charId));

  let value = current || opts[0];
  let activeIndex = Math.max(0, opts.indexOf(value));
  const wrap = el("span", {
    class:"dps-elem-sel",
    title:"Élément (selon l'arme jouée)"
  });
  const trigger = el("button", {
    class:"dps-elem-trigger",
    type:"button",
    "aria-haspopup":"listbox",
    "aria-expanded":"false"
  });
  const triggerDot = el("span", { class:"dot", "aria-hidden":"true" });
  const triggerLabel = el("span", { class:"dps-elem-label" });
  const caret = el("span", {
    class:"dps-elem-caret",
    text:"⌄",
    "aria-hidden":"true"
  });
  const menu = el("span", { class:"dps-elem-menu", role:"listbox" });
  menu.hidden = true;
  const optionNodes = [];

  function paint(){
    wrap.style.setProperty("--ec", elemColor(value));
    triggerLabel.textContent = elemLabel(value);
    trigger.setAttribute("aria-label", "Élément : "+elemLabel(value));
    optionNodes.forEach((node,index)=>{
      node.setAttribute("aria-selected", String(opts[index] === value));
      node.classList.toggle("selected", opts[index] === value);
    });
  }

  function focusOption(index){
    activeIndex = (index + optionNodes.length) % optionNodes.length;
    optionNodes[activeIndex].focus();
  }

  const controller = {
    root:wrap,
    close(restoreFocus=false){
      wrap.classList.remove("open");
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      if(restoreFocus) trigger.focus();
    }
  };

  function openMenu(){
    if(activeElemMenu && activeElemMenu !== controller) closeActiveElemMenu(false);
    activeElemMenu = controller;
    wrap.classList.add("open");
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    activeIndex = Math.max(0, opts.indexOf(value));
    focusOption(activeIndex);
  }

  function choose(index){
    value = opts[index];
    paint();
    onChange(value);
    closeActiveElemMenu(true);
  }

  opts.forEach((element,index)=>{
    const option = el("button", {
      class:"dps-elem-option",
      type:"button",
      role:"option",
      "aria-label":elemLabel(element),
      tabindex:"-1"
    }, [
      el("span", {
        class:"dot",
        "aria-hidden":"true",
        style:"--ec:"+elemColor(element)
      }),
      el("span", { text:elemLabel(element) }),
      el("span", {
        class:"dps-elem-check",
        text:"✓",
        "aria-hidden":"true"
      })
    ]);
    option.addEventListener("click", ()=>choose(index));
    option.addEventListener("keydown", event=>{
      if(event.key === "ArrowDown"){
        event.preventDefault();
        focusOption(activeIndex+1);
      }else if(event.key === "ArrowUp"){
        event.preventDefault();
        focusOption(activeIndex-1);
      }else if(event.key === "Enter" || event.key === " "){
        event.preventDefault();
        choose(activeIndex);
      }else if(event.key === "Escape"){
        event.preventDefault();
        closeActiveElemMenu(true);
      }
    });
    optionNodes.push(option);
    menu.appendChild(option);
  });

  trigger.addEventListener("click", ()=>{
    if(activeElemMenu === controller) closeActiveElemMenu(false);
    else openMenu();
  });
  trigger.addEventListener("keydown", event=>{
    if(event.key === "ArrowDown" || event.key === "ArrowUp"){
      event.preventDefault();
      openMenu();
    }else if(event.key === "Escape"){
      event.preventDefault();
      closeActiveElemMenu(true);
    }
  });

  trigger.append(triggerDot, triggerLabel, caret);
  wrap.append(trigger, menu);
  paint();
  return wrap;
}
```

If `el()` does not map a supplied inline `style` string as expected, set the
option dot color explicitly with `option.querySelector(".dot").style.setProperty("--ec", elemColor(element))`;
do not change `el()` globally.

- [ ] **Step 5: Run the focused test and make it pass**

Run:

```powershell
node tests/menu-element-dps.playwright.js
```

Expected: `PASS Playwright: menu d’élément DPS accessible et persistant`.

- [ ] **Step 6: Commit the behavioral component**

```powershell
git add index.html package.json tests/menu-element-dps.playwright.js
git commit -m "feat: add accessible DPS element menu"
```

---

### Task 2: Heraldic styling, responsive placement, and regression verification

**Files:**
- Modify: `index.html:407-424`
- Modify: `tests/menu-element-dps.playwright.js`

**Interfaces:**
- Consumes: `.dps-elem-sel`, `.dps-elem-trigger`, `.dps-elem-menu`, `.dps-elem-option`, `--ec`.
- Produces: an obsidian/gold dropdown that remains inside the viewport at 390 px and removes opening motion under reduced-motion preferences.

- [ ] **Step 1: Extend the Playwright test with failing visual-contract assertions**

Near the end of the test, while all menus are closed, assert the themed surface,
mobile bounds, and reduced-motion behavior:

```js
await page.setViewportSize({ width:390, height:844 });
await first.click();
await firstMenu.waitFor({ state:"visible" });
const menuStyle = await firstMenu.evaluate(node => {
  const style = getComputedStyle(node);
  return {
    background:style.backgroundImage,
    border:style.borderTopColor,
    shadow:style.boxShadow
  };
});
assert.notEqual(menuStyle.background, "none");
assert.notEqual(menuStyle.shadow, "none");

const bounds = await firstMenu.boundingBox();
assert.ok(bounds.x >= 0);
assert.ok(bounds.x + bounds.width <= 390);

await first.press("Escape");
await page.emulateMedia({ reducedMotion:"reduce" });
await first.click();
const duration = await firstMenu.evaluate(node => getComputedStyle(node).animationDuration);
assert.equal(duration, "0s");
await first.press("Escape");
```

Run:

```powershell
node tests/menu-element-dps.playwright.js
```

Expected: FAIL because the custom menu has no themed surface or
reduced-motion override yet.

- [ ] **Step 2: Replace the native-select rules with the themed component styles**

Replace `.dps-elem-sel select` rules with selectors for the trigger, menu and
options. Use the existing theme variables and these concrete values:

```css
.dps-elem-sel{
  --ec:var(--gold);position:relative;display:inline-flex;flex:none;
  max-width:126px
}
.dps-elem-trigger{
  appearance:none;display:inline-flex;align-items:center;gap:6px;min-width:94px;
  max-width:126px;padding:4px 9px;border-radius:999px;cursor:pointer;
  border:1px solid color-mix(in srgb,var(--ec) 60%,var(--line));
  background:color-mix(in srgb,var(--ec) 18%,var(--obsidian-2));
  color:var(--parchment);font:600 11px var(--ui);transition:.14s
}
.dps-elem-trigger:hover,
.dps-elem-trigger:focus-visible,
.dps-elem-sel.open .dps-elem-trigger{
  border-color:color-mix(in srgb,var(--ec) 80%,var(--gold-bright));
  box-shadow:0 0 0 2px color-mix(in srgb,var(--ec) 18%,transparent)
}
.dps-elem-trigger:focus{outline:none}
.dps-elem-sel .dot{
  width:8px;height:8px;border-radius:50%;background:var(--ec);flex:none;
  box-shadow:0 0 6px var(--ec)
}
.dps-elem-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dps-elem-caret{margin-left:auto;color:var(--gold-bright);transition:transform .14s}
.dps-elem-sel.open .dps-elem-caret{transform:rotate(180deg)}
.dps-elem-menu{
  position:absolute;z-index:40;top:calc(100% + 6px);right:0;min-width:142px;
  padding:5px;border:1px solid var(--gold-deep);border-radius:9px;
  background:linear-gradient(155deg,var(--panel),var(--obsidian-2));
  box-shadow:0 14px 30px #050309d9,0 0 18px #5c214533;
  animation:dps-menu-in .14s ease-out
}
.dps-elem-menu[hidden]{display:none}
.dps-elem-option{
  appearance:none;width:100%;display:grid;grid-template-columns:10px 1fr 14px;
  align-items:center;gap:8px;padding:7px 8px;border:0;border-radius:6px;
  background:transparent;color:var(--muted);font:600 11px var(--ui);
  text-align:left;cursor:pointer
}
.dps-elem-option:hover,
.dps-elem-option:focus-visible{
  outline:none;background:#5c214542;color:var(--parchment)
}
.dps-elem-option.selected{color:var(--parchment);background:#b88a441c}
.dps-elem-check{color:var(--gold-bright);opacity:0}
.dps-elem-option.selected .dps-elem-check{opacity:1}
@keyframes dps-menu-in{
  from{opacity:0;transform:translateY(-4px)}
  to{opacity:1;transform:translateY(0)}
}
@media (prefers-reduced-motion:reduce){
  .dps-elem-menu{animation:none}
  .dps-elem-trigger,.dps-elem-caret{transition:none}
}
```

- [ ] **Step 3: Run focused desktop, mobile, and reduced-motion verification**

Run:

```powershell
node tests/menu-element-dps.playwright.js
```

Expected: all behavioral and visual-contract assertions pass with no page
errors.

- [ ] **Step 4: Run the full regression suite**

Run:

```powershell
npm test
```

Expected: Python asset tests, potential tests, Supabase tests, and the new DPS
menu test all pass.

- [ ] **Step 5: Perform visual QA in a real browser**

Open `index.html`, continue offline, open **Recensement DPS**, and inspect the
menu at desktop and mobile widths. Confirm:

- the panel is not clipped by its card or the viewport;
- color dots correspond to `ELEMENTS`;
- hover, keyboard focus, selection and the gold check remain legible;
- opening one row closes another;
- the potential selector next to it is unchanged.

- [ ] **Step 6: Commit the visual polish**

```powershell
git add index.html tests/menu-element-dps.playwright.js
git commit -m "style: theme DPS element dropdown"
```
