# Mobile Picker Overlap Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher les images et les noms des vignettes de se superposer dans tous les sélecteurs du Team Builder sur téléphone.

**Architecture:** Le test Playwright mesure les boîtes réelles des boutons, images et libellés à 320 px et 390 px. La correction reste limitée au dimensionnement des lignes implicites de `.picker-grid`, dont le défilement interne et le nombre de colonnes restent inchangés.

**Tech Stack:** CSS Grid inline dans `index.html`, Playwright Chromium, Node.js `assert`.

## Global Constraints

- Aucun changement de taille des images ou d'identité visuelle.
- Les sélecteurs de héros et d'armes doivent être vérifiés à 320 px et 390 px.
- Chaque image et chaque libellé doivent rester entièrement dans leur bouton `.tile`.
- `.picker-grid` reste la zone verticale défilable de la modale.
- Aucun débordement horizontal du document.
- Aucune nouvelle dépendance.

---

### Task 1: Dimensionner les lignes des sélecteurs sur leurs vignettes

**Files:**
- Modify: `tests/accessibilite-mobile.playwright.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `#pickerGrid`, `.tile`, `.tile-img`, `.tile-name` et les sélecteurs existants du Team Builder.
- Produces: des lignes CSS Grid dont la hauteur contient entièrement chaque `.tile`.

- [ ] **Step 1: Ajouter l'assertion de géométrie mobile**

Ajouter avant le parcours principal :

```js
async function assertPickerTilesContained(page, label){
  const layout = await page.locator("#pickerGrid").evaluate(grid => ({
    clientHeight:grid.clientHeight,
    scrollHeight:grid.scrollHeight,
    tiles:[...grid.querySelectorAll(".tile")].slice(0, 6).map(tile => {
      const tileRect = tile.getBoundingClientRect();
      const imageRect = tile.querySelector(".tile-img").getBoundingClientRect();
      const nameRect = tile.querySelector(".tile-name").getBoundingClientRect();
      return {
        tileTop:tileRect.top,
        tileBottom:tileRect.bottom,
        imageTop:imageRect.top,
        imageBottom:imageRect.bottom,
        nameTop:nameRect.top,
        nameBottom:nameRect.bottom
      };
    })
  }));
  assert.ok(layout.scrollHeight > layout.clientHeight, label+" doit rester défilable");
  layout.tiles.forEach((item, index) => {
    assert.ok(
      item.imageTop >= item.tileTop - 1 &&
      item.imageBottom <= item.tileBottom + 1,
      label+" : image hors de la vignette "+index
    );
    assert.ok(
      item.nameTop >= item.tileTop - 1 &&
      item.nameBottom <= item.tileBottom + 1,
      label+" : nom hors de la vignette "+index
    );
  });
}
```

Dans le test, créer un contexte tactile pour chacune des largeurs `320` et
`390`. Ouvrir le sélecteur de héros, appeler
`assertPickerTilesContained(page, "Héros "+width+"px")`, choisir Meliodas,
ouvrir le sélecteur d'arme et rappeler la fonction avec
`"Armes "+width+"px"`. Vérifier après chaque ouverture :

```js
const overflow = await page.evaluate(() =>
  document.scrollingElement.scrollWidth -
  document.scrollingElement.clientWidth
);
assert.ok(overflow <= 1, "Débordement horizontal du picker à "+width+"px");
```

- [ ] **Step 2: Vérifier que le test échoue sur le bug**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: FAIL avec `image hors de la vignette` car une ligne mesure 44–54 px
alors que l'image mesure environ 89–110 px.

- [ ] **Step 3: Appliquer la correction CSS minimale**

Dans `.picker-grid`, ajouter :

```css
grid-auto-rows:max-content;
```

Ne modifier ni `.tile-img`, ni le nombre de colonnes, ni la hauteur de la
modale.

- [ ] **Step 4: Vérifier le test ciblé**

Run: `node tests/accessibilite-mobile.playwright.js`

Expected: PASS.

- [ ] **Step 5: Vérifier visuellement les trois modales du Team Builder**

Prendre des captures à 320 px du sélecteur de héros, du sélecteur d'arme et de
la modale de potentiel. Les vignettes des deux sélecteurs doivent être
séparées ; la modale de potentiel doit rester inchangée.

- [ ] **Step 6: Exécuter toutes les régressions**

Run: `npm test`

Expected: toutes les suites Node, Python et Playwright passent.

Run: `git diff --check`

Expected: aucune sortie et code de retour 0.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/accessibilite-mobile.playwright.js
git commit -m "fix: prevent mobile picker tile overlap"
```
