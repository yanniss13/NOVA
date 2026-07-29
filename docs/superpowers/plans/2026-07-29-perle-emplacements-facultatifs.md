# Perle Optional Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre facultatifs le troisième emplacement Héroïque et le quatrième emplacement Légendaire sans réduire le nombre maximal de statistiques configurables.

**Architecture:** `PEARL_TIERS` porte séparément le plafond `slots` et le minimum `requiredSlots`. Le moteur valide la longueur contre ces deux bornes, tandis que l'éditeur continue d'afficher tous les emplacements et représente un emplacement facultatif vide par `null`.

**Tech Stack:** JavaScript autonome dans `index.html`, tests Node `assert`, tests Playwright, documentation Markdown.

## Global Constraints

- Héroïque : 3 emplacements possibles, 2 obligatoires.
- Légendaire : 4 emplacements possibles, 3 obligatoires.
- Les autres paliers et les enchantements basiques ne changent pas.
- Un emplacement facultatif renseigné conserve toutes les validations existantes.
- Ne pas normaliser les fins de ligne de `index.html` ou `AGENTS.md`.

---

### Task 1: Validation et éditeur des emplacements facultatifs

**Files:**
- Modify: `tests/stats-build.test.js:824`
- Modify: `tests/helpers/load-app.js:239`
- Modify: `tests/accessibilite-mobile.playwright.js:497`
- Modify: `index.html:2758`
- Modify: `index.html:2993`
- Modify: `index.html:4517`
- Modify: `index.html:4787`
- Modify: `AGENTS.md:179`

**Interfaces:**
- Consumes: `weaponConfigStatus(file, config)`, `pearlSlotCount(tier)`, `renderMasterstoneWeaponEnchantments(container, grade, draft)`.
- Produces: `pearlRequiredSlotCount(tier): number`; `PEARL_TIERS[].requiredSlots`; un emplacement facultatif vide stocké sous la forme `null`.

- [x] **Step 1: Write the failing engine tests**

Ajouter les assertions suivantes au bloc des perles :

```js
assert.deepStrictEqual(
  [1, 2, 3, 4, 5].map(tier => hooks.pearlRequiredSlotCount(tier)),
  [1, 2, 2, 2, 3]
);
assert.strictEqual(
  hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
    pearl(0, 4, null, "B_Atk_Equip", 500),
    pearl(1, 4, null, "B_Def_Equip", 400)
  ])),
  "valid"
);
assert.strictEqual(
  hooks.weaponConfigStatus(BAGUETTE_VORACE_FILE, pearlConfig([
    pearl(0, 5, "generic", "C_Critical_Rate", 700),
    pearl(1, 5, "generic", "C_Critical_ResRate", 700),
    pearl(2, 5, "generic", "C_Critical_Dam_Rate", 1200)
  ])),
  "valid"
);
```

Ajouter aussi les contre-exemples : une seule stat Héroïque et deux stats
Légendaires restent `incomplete`; une valeur interdite dans le dernier
emplacement facultatif reste `incompatible`.

- [x] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: FAIL parce que `pearlRequiredSlotCount` n'est pas encore exportée ou parce que les tableaux courts sont encore `incomplete`.

- [x] **Step 3: Implement the validation model**

Dans `PEARL_TIERS`, ajouter :

```js
{ tier:4, label:"Héroïque", slots:3, requiredSlots:2 },
{ tier:5, label:"Légendaire", slots:4, requiredSlots:3 }
```

Déclarer `requiredSlots` égal à `slots` pour les paliers 1 à 3, puis :

```js
function pearlRequiredSlotCount(tier){
  const found = pearlTierOf(tier);
  return found ? found.requiredSlots : 0;
}
```

Dans `weaponConfigStatus`, conserver `slots` comme plafond et utiliser
`requiredSlots` comme longueur minimale pour les perles. Valider le contenu
avant la longueur afin qu'une valeur incompatible reste prioritaire.

- [x] **Step 4: Make the editor preserve optional empty slots**

Lors du changement de palier, créer des objets seulement pour les emplacements
obligatoires et mettre `null` dans les derniers emplacements facultatifs.
Rendre la boucle sur `0..pearlSlotCount(tier)-1`, même lorsque l'entrée vaut
`null`, afin que l'utilisateur puisse remplir l'emplacement facultatif. Le
sélecteur crée l'objet complet quand une statistique est choisie et le remet à
`null` quand l'emplacement facultatif est vidé.

Le titre du dernier emplacement devient :

```js
"Emplacement "+(index + 1)+" sur "+slots
  +(index >= requiredSlots ? " — facultatif" : "")
```

- [x] **Step 5: Add the browser regression**

Dans le parcours Playwright existant, remplir seulement deux statistiques au
palier 4 et trois au palier 5. Vérifier que le dernier titre contient
`facultatif`, que l'aperçu chiffré devient visible et que la modale conserve
son absence de débordement horizontal.

- [x] **Step 6: Update the source-of-truth documentation**

Dans `AGENTS.md`, remplacer la colonne unique par « Emplacements possibles » et
« Obligatoires », puis documenter explicitement que les derniers emplacements
Héroïque et Légendaire peuvent être absents sans rendre la configuration
incomplète.

- [x] **Step 7: Run verification**

Run:

```powershell
node tests/stats-build.test.js
npm test
git diff --check
```

Expected: tous les tests sont verts et aucune erreur de diff n'est signalée.

- [x] **Step 8: Commit**

```powershell
git add -- index.html AGENTS.md tests/stats-build.test.js tests/helpers/load-app.js tests/accessibilite-mobile.playwright.js docs/superpowers/plans/2026-07-29-perle-emplacements-facultatifs.md
git commit -m "fix: make high-tier pearl slots optional"
```
