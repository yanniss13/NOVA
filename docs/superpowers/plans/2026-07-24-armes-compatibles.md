# Armes compatibles par héros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Limiter chaque héros aux trois types d’armes indiqués par les clés de `potentiels.js`, avec suppression automatique de toute arme incompatible.

**Architecture:** `potentiels.js` reste l’unique source générée des compatibilités : ses trois clés par héros servent à la fois aux descriptions de potentiel et au filtrage des armes. Des fonctions pures dans `index.html` valident une arme et construisent les groupes compatibles ; les frontières de normalisation et le sélecteur les utilisent sans ajouter de liste codée en dur.

**Tech Stack:** HTML/CSS/JavaScript natif, localStorage, Node.js, Playwright Chromium, données générées dans `potentiels.js`.

## Global Constraints

- L’application doit rester ouvrable directement en `file://`.
- Aucun type d’arme par héros ne doit être codé en dur dans `index.html`.
- Les libellés et images d’armes continuent de venir exclusivement de `window.SEVEN_DS_DATA`.
- Les trois compatibilités viennent exclusivement des clés de `window.SEVEN_DS_POTENTIELS[charId]`.
- Toute arme incompatible est remplacée automatiquement par `null`.
- Les armures, bijoux, notes et le palier de potentiel ne changent pas lors de cette suppression.
- L’interface reste en français et sans dépendance d’exécution.

---

## File Map

- Modify: `index.html` — fonctions de compatibilité, normalisation et sélecteur filtré.
- Modify: `tests/potentiel-commun.test.js` — tests purs sur les 24×3 compatibilités, les groupes et la migration.
- Modify: `tests/potentiel-commun.playwright.js` — parcours réel du sélecteur et du changement de héros.
- Modify: `generate-potentiels.py` — documenter que les clés générées pilotent aussi les compatibilités.
- Modify: `potentiels.js` — aligner l’en-tête généré actuel.
- Modify: `AGENTS.md` — documenter la source et la règle de suppression.

### Task 1: Valider et normaliser les armes par héros

**Files:**
- Modify: `tests/potentiel-commun.test.js`
- Modify: `index.html:514-615`

**Interfaces:**
- Produces: `weaponTypesOf(charId)` retourne les dossiers autorisés du héros.
- Produces: `isWeaponCompatible(charId, file)` retourne un booléen ; une valeur `null` est valide.
- Produces: `compatibleWeaponGroups(charId)` retourne un objet au format attendu par `Picker.open({ groups })`.
- Consumes: `POT`, `DATA.armes` et `weaponFolderOf(file)`.

- [x] **Step 1: Écrire les tests purs en échec**

Exposer depuis le vrai script inline les trois nouvelles fonctions, puis ajouter :

```js
assert.deepStrictEqual(plain(hooks.weaponTypesOf("meliodas")).sort(), [
  "Epee 1 main", "Epees doubles", "Hache"
]);
assert.equal(
  hooks.isWeaponCompatible("meliodas", "7ds-armes/Hache/hache.webp"),
  true
);
assert.equal(
  hooks.isWeaponCompatible("meliodas", "7ds-armes/Livre/grimoire.webp"),
  false
);
assert.equal(hooks.isWeaponCompatible("meliodas", null), true);

const groups = plain(hooks.compatibleWeaponGroups("meliodas"));
assert.deepStrictEqual(Object.keys(groups).sort(), [
  "Epee a une main", "Epees doubles", "Hache"
]);
assert.ok(Object.values(groups).flat().every(
  item => ["Hache", "Epee 1 main", "Epees doubles"].includes(
    item.file.split("/")[1]
  )
));
```

Charger aussi le vrai `potentiels.js` dans un contexte VM et vérifier :

```js
assert.equal(Object.keys(actualPot).length, 24);
assert.ok(Object.values(actualPot).every(byWeapon =>
  Object.keys(byWeapon).length === 3
));
```

- [x] **Step 2: Vérifier l’échec attendu**

Run: `node tests/potentiel-commun.test.js`  
Expected: FAIL avec `weaponTypesOf is not defined`.

- [x] **Step 3: Implémenter les fonctions minimales**

Dans `index.html`, remplacer `potTypesOf` par :

```js
const weaponTypesOf = charId => Object.keys((charId && POT[charId]) || {});
const isWeaponCompatible = (charId, file) =>
  !file || !!charId && weaponTypesOf(charId).includes(weaponFolderOf(file));
function compatibleWeaponGroups(charId){
  const allowed = new Set(weaponTypesOf(charId));
  return Object.entries(DATA.armes||{}).reduce((groups, [label, items])=>{
    const compatible = items.filter(item => allowed.has(weaponFolderOf(item.file)));
    if(compatible.length) groups[label] = compatible;
    return groups;
  }, {});
}
```

Utiliser `weaponTypesOf` dans le contrôle et la fenêtre de potentiel.

- [x] **Step 4: Supprimer les armes incompatibles pendant la normalisation**

Dans `normalizeHero(raw)`, calculer d’abord `char` puis `weapon` :

```js
const char = h.char || null;
const weapon = isWeaponCompatible(char, h.weapon) ? (h.weapon || null) : null;
```

Retourner ces deux valeurs dans le héros normalisé. Ajouter au test une équipe avec
Meliodas + Livre et vérifier `weapon === null`, puis Meliodas + Hache et vérifier
que le chemin reste intact.

- [x] **Step 5: Vérifier et committer**

Run: `node tests/potentiel-commun.test.js`  
Expected: `PASS potentiel commun`.

```bash
git add index.html tests/potentiel-commun.test.js
git commit -m "feat: validate weapons per hero"
```

### Task 2: Filtrer le sélecteur et vérifier l’interface réelle

**Files:**
- Modify: `tests/potentiel-commun.playwright.js`
- Modify: `index.html:817-831`
- Modify: `generate-potentiels.py`
- Modify: `potentiels.js`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: `compatibleWeaponGroups(hero.char)` et `isWeaponCompatible(char, file)`.
- Produces: un picker contenant `Tous` plus exactement trois groupes compatibles.

- [x] **Step 1: Ajouter le parcours Playwright en échec**

Avant de choisir un héros, cliquer sur `.gear-slot.weapon` et vérifier que le picker
reste fermé et que le toast contient `Choisis d'abord un héros.`.

Après avoir choisi Meliodas, ouvrir le picker et vérifier :

```js
assert.deepEqual(
  (await page.locator("#pickerChips .chip").allTextContents()).sort(),
  ["Epee a une main", "Epees doubles", "Hache", "Tous"].sort()
);
```

Sur un second emplacement, choisir Meliodas, équiper une Hache, remplacer le héros
par Merlin et vérifier que `.gear-slot.weapon` ne possède plus la classe `filled`.

Dans le scénario d’équipe héritée, utiliser un chemin `7ds-armes/Livre/x.webp` pour
Meliodas et vérifier après sauvegarde que `weapon === null`.

- [x] **Step 2: Vérifier l’échec attendu**

Run: `node tests/potentiel-commun.playwright.js`  
Expected: FAIL parce que le picker affiche actuellement les douze groupes.

- [x] **Step 3: Filtrer le picker et nettoyer au changement de héros**

Modifier `pickChar(i)` :

```js
onSelect:v=>{
  const hero = draft.heroes[i];
  hero.char = v;
  if(!isWeaponCompatible(hero.char, hero.weapon)) hero.weapon = null;
  renderBuilder();
}
```

Modifier `pickWeapon(i)` :

```js
const hero = draft.heroes[i];
if(!hero.char){
  toast("Choisis d'abord un héros.", true);
  return;
}
Picker.open({
  title:"Choisir une arme",
  value:hero.weapon,
  groups:compatibleWeaponGroups(hero.char),
  emptyHint:"Aucune arme compatible disponible.",
  onSelect:v=>{ hero.weapon=v; renderBuilder(); }
});
```

- [x] **Step 4: Aligner la documentation générée**

Dans `generate-potentiels.py` et l’en-tête de `potentiels.js`, préciser que les clés
de types d’armes représentent les compatibilités du héros et les valeurs ses
descriptions T1–T10. Dans `AGENTS.md`, documenter le picker filtré et la suppression
automatique aux frontières du Store et de l’import.

- [x] **Step 5: Lancer la suite complète**

Run: `npm test`  
Expected:

```text
PASS potentiel commun
PASS Playwright: potentiel commun, changement d'arme et migration
```

- [x] **Step 6: Committer**

```bash
git add index.html tests/potentiel-commun.playwright.js generate-potentiels.py potentiels.js AGENTS.md
git commit -m "feat: filter weapons by hero compatibility"
```

### Task 3: Revue et vérification finale

**Files:**
- Verify: tous les fichiers modifiés par les Tasks 1 et 2

**Interfaces:**
- Consumes: la suite `npm test`.
- Produces: une branche prête à être fusionnée dans `main`.

- [x] **Step 1: Vérifier les exigences**

Run:

```powershell
node -e "global.window={};require('./potentiels.js');const p=window.SEVEN_DS_POTENTIELS;if(Object.keys(p).length!==24||Object.values(p).some(x=>Object.keys(x).length!==3))process.exit(1)"
```

Expected: exit code `0`.

Run:

```powershell
rg -n "groups:DATA\\.armes|potTypesOf" index.html
```

Expected: aucune occurrence.

- [x] **Step 2: Vérifier l’état Git**

Run: `git status --short`  
Expected: aucun fichier non committé.

- [x] **Step 3: Relancer les tests sur l’état à intégrer**

Run: `npm test`  
Expected: les deux lignes `PASS` et un code de sortie `0`.
