# Apport par pièce — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher sous chaque pièce d'équipement, dans les deux modales de consultation, un résumé de son apport, dépliable vers le détail complet.

**Architecture:** Les termes de statistiques portent déjà leur origine (`source.slot`, `bucket`). On les regroupe par emplacement plutôt que de recalculer pièce par pièce. La source est `calculateBuildStats`, tolérante aux pièces non configurées — et non `calculateHeroStats`, qui se vide entièrement dès qu'une pièce manque.

**Tech Stack:** JavaScript modules ES, aucune dépendance. Tests Node avec `node:assert` et le chargeur `vm` de `tests/helpers/load-app.js`. Tests navigateur avec Playwright.

**Conception de référence :** `docs/superpowers/specs/2026-08-03-apport-par-piece-design.md`

## Global Constraints

- **Aucun changement du schéma Supabase.** Aucune migration, aucune colonne.
- **Aucune dépendance npm nouvelle.** `playwright` reste la seule dépendance de développement.
- **Ordre des couches respecté.** `tests/modules-imports.test.js` interdit qu'un module dépende d'un module situé plus bas dans `tests/helpers/modules.js`. `vues/fiche-heros.js` (position 14) peut dépendre de `metier/stats-calcul.js` : c'est déjà le cas indirectement.
- **Aucun module nouveau.** Le plan modifie des fichiers existants et ajoute un fichier de test. `tests/helpers/modules.js` n'est donc pas touché.
- **Libellés en français**, avec accents, comme tout le code d'affichage existant.
- **Messages de commit sans accents**, conformément à l'historique du dépôt.
- Toute fonction ajoutée à `js/metier/stats-calcul.js` est **pure** : ni DOM, ni réseau.

---

## File Structure

| Fichier | Rôle | Nature |
|---|---|---|
| `js/metier/stats-calcul.js` | champ `role` sur les termes, `groupBuildTermsBySlot`, `summaryTermsFor` | Modifier |
| `js/vues/fiche-heros.js` | `equipLine` dessine le résumé et le dépliage | Modifier |
| `css/modales.css` | styles du résumé sous une pièce | Modifier |
| `tests/apport-par-piece.test.js` | tests unitaires des trois fonctions métier | Créer |
| `tests/apport-par-piece.playwright.js` | test navigateur de bout en bout | Créer |
| `package.json` | inscrire les deux tests dans `test`, `test:unit`, `test:e2e` | Modifier |

Le découpage suit la frontière métier / vue déjà en place : tout le calcul et le classement vivent dans `metier/`, la vue ne fait que dessiner.

---

## Task 1 : le champ `role` sur chaque terme

**Files:**
- Modify: `js/metier/stats-calcul.js` (`addGearStatTerm` ~521, `addWeaponStatTerm` ~391, leurs appelants)
- Test: `tests/apport-par-piece.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: chaque terme d'équipement et d'arme porte `role`, valeurs `"main" | "sub" | "extra" | "enchantment" | "bonus"`. Les tâches 2 et 3 en dépendent.

**Contexte.** Aujourd'hui la nature d'un terme n'est lisible que par découpage de la chaîne `id` pour l'équipement (`":main:"`, `":sub:"`, `":extra:"`, `":enchantment:"`) et par croisement `bucket` + `source.subStat` pour l'arme. Deux règles à maintenir en parallèle. Le champ `role` les unifie.

`assertBuildStatTerm` (ligne 90) ne valide que les champs requis et **ne rejette pas les clés inconnues** — le champ est donc additif et ne casse aucun consommateur.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/apport-par-piece.test.js` :

```js
"use strict";

const assert = require("node:assert");
const { loadApp, plain } = require("./helpers/load-app");

const HAUT_FILE = "7ds-armures-ssr/Haut/Haut du souverain cupide.webp";
const HACHE_FILE = "7ds-armes/Hache/hache.webp";

function gearConfig(overrides = {}){
  return Object.assign({
    version:1,
    level:0,
    reinforce:0,
    enchantments:[],
    passiveLevel:null
  }, overrides);
}

function weaponConfig(overrides = {}){
  return Object.assign({
    version:1,
    gradeGameId:"grade-axe",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:[null]
  }, overrides);
}

function testRolesEquipement(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateGearStats(HAUT_FILE, gearConfig(), "Haut"));
  assert.strictEqual(result.status, "valid", "la piece de reference doit etre calculable");
  result.terms.forEach(term => {
    assert.ok(
      ["main", "sub", "extra", "enchantment"].includes(term.role),
      "chaque terme d'equipement porte un role connu, recu : " + term.role
    );
  });
  const roles = result.terms.map(term => term.role);
  assert.ok(roles.includes("main"), "la stat principale porte le role main");
}

function testRolesArme(){
  const { hooks } = loadApp();
  const result = plain(hooks.calculateWeaponStats(HACHE_FILE, weaponConfig()));
  assert.strictEqual(result.status, "valid", "l'arme de reference doit etre calculable");
  result.terms.forEach(term => {
    assert.ok(
      ["main", "sub", "enchantment"].includes(term.role),
      "chaque terme d'arme porte un role connu, recu : " + term.role
    );
  });
  const mains = result.terms.filter(term => term.role === "main");
  assert.ok(
    mains.length >= 1,
    "la stat principale de l'arme (niveau et promotion) porte le role main"
  );
}

function testRolesBonusEnsemble(){
  const { hooks } = loadApp();
  const build = {
    weapon:null,
    armor:{ Haut:HAUT_FILE },
    armorConfig:{ Haut:gearConfig() },
    jewel:{},
    jewelConfig:{}
  };
  const result = plain(hooks.calculateBuildStats(build));
  result.terms
    .filter(term => term.bucket === "set")
    .forEach(term => {
      assert.strictEqual(term.role, "bonus", "un terme d'ensemble porte le role bonus");
    });
}

testRolesEquipement();
testRolesArme();
testRolesBonusEnsemble();
console.log("PASS apport par piece : roles des termes");
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node tests/apport-par-piece.test.js
```

Attendu : ÉCHEC sur `chaque terme d'equipement porte un role connu, recu : undefined`.

- [ ] **Step 3: Ajouter le champ dans les deux constructeurs de terme**

Dans `addGearStatTerm` (~521), ajouter `role` à l'objet poussé, juste après `bucket` :

```js
    terms.push({
      id:settings.id,
      stat:settings.stat,
      operation:"add",
      value:settings.value,
      unit:metadata.unit,
      bucket:settings.bucket,
      role:settings.role,
      family:metadata.family,
      source:settings.source,
      confidence:settings.confidence
    });
```

Faire la même addition dans `addWeaponStatTerm` (~391).

- [ ] **Step 4: Renseigner `role` à chaque appel**

Dans `calculateGearStats`, ajouter la propriété à chacun des quatre appels, en suivant le préfixe déjà présent dans l'`id` :

| `id` construit avec | `role` à ajouter |
|---|---|
| `bucket + ":main:" + definition.mainStat` | `role:"main"` |
| `bucket + ":sub:" + definition.subStat` | `role:"sub"` |
| `bucket + ":extra:" + index + ...` | `role:"extra"` |
| `bucket + ":enchantment:" + index + ...` | `role:"enchantment"` |

Dans `gearSetTerms` (~665), l'unique appel reçoit `role:"bonus"`.

Dans `calculateWeaponStats` (~425), les appels reçoivent :

| Appel | `role` |
|---|---|
| `id:"weapon:level:"+mainStat` | `role:"main"` |
| `id:"weapon:promotion:"+mainStat` | `role:"main"` |
| `id:"weapon:level:"+subStat.stat+":"+index` (boucle `grade.subStats`) | `role:"sub"` |
| `id:"weapon:enchantment:"+slot+...` | `role:"enchantment"` |

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

```bash
node tests/apport-par-piece.test.js
```

Attendu : `PASS apport par piece : roles des termes`

- [ ] **Step 6: Vérifier qu'aucun test existant ne casse**

```bash
npm run test:unit
```

Attendu : tout au vert. Le champ est additif, aucun test existant n'assertait l'absence de clés.

- [ ] **Step 7: Commit**

```bash
git add js/metier/stats-calcul.js tests/apport-par-piece.test.js
git commit -m "feat: nommer la nature de chaque terme de statistique

Le role d'un terme n'etait lisible que par decoupage de son id pour
l'equipement, et par croisement bucket + subStat pour l'arme. Un champ
explicite unifie les deux chemins en une seule regle testable."
```

---

## Task 2 : `groupBuildTermsBySlot` et l'invariant de somme

**Files:**
- Modify: `js/metier/stats-calcul.js` (nouvelle fonction, bloc `export` ~1113)
- Test: `tests/apport-par-piece.test.js`

**Interfaces:**
- Consumes: le champ `role` de la tâche 1.
- Produces:

```
groupBuildTermsBySlot(build) → [{ slot, domain, file, status, terms, totals }]
```

Un tableau d'entrées. `slot` vaut le nom d'emplacement (`"Haut"`, `"Anneau"`…), ou `"weapon"` pour l'arme, ou `"set"` pour le bonus d'ensemble. Chaque entrée a la même forme qu'un résultat `calculateGearStats`, donc `groupBuildStatResults(entrée)` fonctionne dessus. La tâche 4 consomme ce tableau.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/apport-par-piece.test.js`, avant les appels finaux :

```js
const BAS_FILE = "7ds-armures-ssr/Bas/Bas du souverain cupide.webp";

function buildDeuxPieces(){
  return {
    weapon:null,
    armor:{ Haut:HAUT_FILE, Bas:BAS_FILE },
    armorConfig:{ Haut:gearConfig(), Bas:gearConfig() },
    jewel:{},
    jewelConfig:{}
  };
}

function totalParStat(totals){
  const somme = new Map();
  (totals || []).forEach(total => {
    somme.set(total.stat, (somme.get(total.stat) || 0) + total.value);
  });
  return somme;
}

function testInvariantDeSomme(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  const global = plain(hooks.calculateBuildStats(build));
  const entrees = plain(hooks.groupBuildTermsBySlot(build));

  const attendu = totalParStat(global.totals);
  const obtenu = new Map();
  entrees.forEach(entree => {
    totalParStat(entree.totals).forEach((value, stat) => {
      obtenu.set(stat, (obtenu.get(stat) || 0) + value);
    });
  });

  assert.deepStrictEqual(
    [...obtenu.keys()].sort(),
    [...attendu.keys()].sort(),
    "les entrees couvrent exactement les memes statistiques que le total"
  );
  attendu.forEach((value, stat) => {
    assert.strictEqual(
      obtenu.get(stat),
      value,
      "la somme des entrees egale le total de l'equipement pour " + stat
    );
  });
}

function testToleranceAuxPiecesNonConfigurees(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  build.armorConfig.Bas = null;

  const entrees = plain(hooks.groupBuildTermsBySlot(build));
  const haut = entrees.find(entree => entree.slot === "Haut");
  const bas = entrees.find(entree => entree.slot === "Bas");

  assert.ok(haut, "l'entree de la piece configuree existe");
  assert.strictEqual(haut.status, "valid", "la piece configuree reste calculee");
  assert.ok(haut.terms.length > 0, "la piece configuree garde ses termes");

  assert.ok(bas, "l'entree de la piece non configuree existe quand meme");
  assert.notStrictEqual(bas.status, "valid", "la piece non configuree est signalee");
  assert.strictEqual(bas.terms.length, 0, "la piece non configuree n'a aucun terme");
}

function testBonusEnsembleNonAttribue(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.groupBuildTermsBySlot(buildDeuxPieces()));
  entrees
    .filter(entree => entree.slot !== "set")
    .forEach(entree => {
      entree.terms.forEach(term => {
        assert.notStrictEqual(
          term.bucket,
          "set",
          "aucun terme d'ensemble n'est attribue a une piece"
        );
      });
    });
}
```

Et ajouter les appels :

```js
testInvariantDeSomme();
testToleranceAuxPiecesNonConfigurees();
testBonusEnsembleNonAttribue();
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node tests/apport-par-piece.test.js
```

Attendu : ÉCHEC — `hooks.groupBuildTermsBySlot is not a function`.

- [ ] **Step 3: Écrire la fonction**

Dans `js/metier/stats-calcul.js`, juste après `calculateBuildStats` (~758) :

```js
  /* Regroupe les termes deja calcules par emplacement, sans rien recalculer.

     La source est `calculateBuildStats` et non `calculateHeroStats` : la
     seconde renvoie un resultat vide des qu'une seule piece n'est pas
     configuree, ce qui ferait disparaitre les resumes de toutes les autres.

     L'arme ne porte pas de `source.slot` : elle est reconnue par son domaine.
     Le bonus d'ensemble n'appartient a aucune piece : il sort dans sa propre
     entree, sans quoi la somme des entrees ne ferait plus le total. */
  function groupBuildTermsBySlot(build){
    const source = build || {};
    const result = calculateBuildStats(source);
    const entries = new Map();

    const entryFor = (slot, domain, file) => {
      if(!entries.has(slot)){
        entries.set(slot, { slot, domain, file, status:"valid", terms:[] });
      }
      return entries.get(slot);
    };

    if(source.weapon){
      const entry = entryFor("weapon", "weapon", source.weapon);
      entry.status = result.statuses.weapon || "missing";
    }
    GEAR_SLOT_DOMAINS.forEach(([storageKey, slots]) => {
      slots.forEach(slot => {
        const file = (source[storageKey] || {})[slot];
        if(!file) return;
        const domain = gearDomainOf(slot);
        const entry = entryFor(slot, domain, file);
        entry.status = result.statuses[domain + ":" + slot] || "missing";
      });
    });

    result.terms.forEach(term => {
      if(term.bucket === "set"){
        entryFor("set", "set", null).terms.push(term);
        return;
      }
      const slot = term.source.domain === "weapon"
        ? "weapon"
        : term.source.slot;
      if(!slot || !entries.has(slot)) return;
      entries.get(slot).terms.push(term);
    });

    return [...entries.values()].map(entry => Object.assign({}, entry, {
      totals:reconstructStatTotals(entry.terms)
    }));
  }
```

- [ ] **Step 4: Exporter la fonction**

Dans le bloc `export` en fin de fichier (~1113), ajouter la ligne en conservant l'ordre alphabétique :

```js
export {
  calculateGearStats,
  calculateHeroStats,
  calculateWeaponStats,
  gearDomainOf,
  groupBuildStatResults,
  groupBuildTermsBySlot
};
```

- [ ] **Step 5: Exposer la fonction au chargeur de test**

Dans `tests/helpers/load-app.js`, à côté de `calculateBuildStats` (~367), ajouter :

```js
  groupBuildTermsBySlot:typeof groupBuildTermsBySlot === "function"
    ? groupBuildTermsBySlot
    : undefined,
```

- [ ] **Step 6: Lancer le test pour vérifier qu'il passe**

```bash
node tests/apport-par-piece.test.js
```

Attendu : `PASS apport par piece : roles des termes` sans erreur d'assertion.

- [ ] **Step 7: Commit**

```bash
git add js/metier/stats-calcul.js tests/helpers/load-app.js tests/apport-par-piece.test.js
git commit -m "feat: regrouper les termes de statistiques par emplacement

La somme des entrees egale l'apport total de l'equipement par construction :
ce sont les memes termes, seulement ranges. L'invariant est teste, et la
fonction tolere les pieces non configurees, contrairement a calculateHeroStats
qui vide son resultat entier des qu'une piece manque."
```

---

## Task 3 : le classement du résumé

**Files:**
- Modify: `js/metier/stats-calcul.js`
- Test: `tests/apport-par-piece.test.js`

**Interfaces:**
- Consumes: `role` (tâche 1), les entrées de `groupBuildTermsBySlot` (tâche 2).
- Produces:

```
summaryTermsFor(entry, limite = 3) → [{ stat, value, unit, label }]
```

Les apports les plus caractéristiques d'une entrée, au plus `limite`. La tâche 4 les affiche.

**Règle de classement.** Les unités ne sont pas comparables — « PV +4 200 » est en points, « CRIT 12 % » en dix-millièmes. On ne compare donc jamais deux unités entre elles : on suit l'ordre des rôles, qui vient de la structure des données du jeu.

| Ordre | `role` |
|---|---|
| 1 | `main` |
| 2 | `sub` |
| 3 | `extra` |
| 4 | `enchantment` |

À rôle égal, on classe par valeur décroissante — c'est alors licite, les termes d'un même rôle partageant leur unité. Plusieurs termes visant la même statistique sont additionnés avant classement (l'arme, par exemple, produit deux termes `main` : niveau et promotion).

Une entrée qui n'a que deux rôles présents rend deux résultats. **On ne complète jamais pour atteindre trois.**

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `tests/apport-par-piece.test.js` :

```js
function testClassementSuitLesRoles(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.groupBuildTermsBySlot(buildDeuxPieces()));
  const haut = entrees.find(entree => entree.slot === "Haut");
  const resume = plain(hooks.summaryTermsFor(haut, 3));

  assert.ok(resume.length >= 1, "une piece configuree a au moins un apport");
  assert.ok(resume.length <= 3, "le resume ne depasse jamais la limite demandee");
  resume.forEach(item => {
    assert.strictEqual(typeof item.stat, "string", "chaque apport nomme sa statistique");
    assert.strictEqual(typeof item.label, "string", "chaque apport porte un libelle affichable");
    assert.ok(Number.isFinite(item.value), "chaque apport porte une valeur numerique");
    assert.ok(
      item.unit === "flat" || item.unit === "ten-thousandths",
      "chaque apport porte une unite connue"
    );
  });

  const premier = resume[0];
  const termesMain = haut.terms.filter(term => term.role === "main");
  assert.ok(
    termesMain.some(term => term.stat === premier.stat),
    "le premier apport affiche est la statistique principale de la piece"
  );
}

function testResumeNeCompletePas(){
  const { hooks } = loadApp();
  const entree = {
    slot:"Test",
    domain:"armor",
    file:"x.webp",
    status:"valid",
    terms:[
      {
        id:"a", stat:"B_Hp_Equip", operation:"add", value:1000, unit:"flat",
        bucket:"armor:Haut", role:"main", family:"main",
        source:{ domain:"armor", component:"level", slot:"Test" },
        confidence:"presumed"
      }
    ],
    totals:[]
  };
  const resume = plain(hooks.summaryTermsFor(entree, 3));
  assert.strictEqual(
    resume.length,
    1,
    "une entree a un seul role rend un seul apport, jamais trois"
  );
}

function testResumeVidePourPieceNonConfiguree(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  build.armorConfig.Bas = null;
  const entrees = plain(hooks.groupBuildTermsBySlot(build));
  const bas = entrees.find(entree => entree.slot === "Bas");
  assert.deepStrictEqual(
    plain(hooks.summaryTermsFor(bas, 3)),
    [],
    "une piece non configuree ne produit aucun apport"
  );
}
```

Et les appels :

```js
testClassementSuitLesRoles();
testResumeNeCompletePas();
testResumeVidePourPieceNonConfiguree();
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
node tests/apport-par-piece.test.js
```

Attendu : ÉCHEC — `hooks.summaryTermsFor is not a function`.

- [ ] **Step 3: Écrire la fonction**

Dans `js/metier/stats-calcul.js`, après `groupBuildTermsBySlot` :

```js
  /* Les apports les plus caracteristiques d'une entree.

     On ne compare jamais deux unites entre elles : « PV +4 200 » est en points,
     « CRIT 12 % » en dix-milliemes, et toute normalisation serait arbitraire.
     L'ordre vient donc des roles, qui viennent de la structure du jeu. A role
     egal, le tri par valeur est licite : les termes d'un meme role partagent
     leur unite.

     On ne complete jamais pour atteindre la limite : une piece qui n'a qu'un
     role rend un seul apport. */
  const SUMMARY_ROLE_ORDER = ["main", "sub", "extra", "enchantment"];

  function summaryTermsFor(entry, limite){
    const max = Number.isInteger(limite) && limite > 0 ? limite : 3;
    const terms = entry && Array.isArray(entry.terms) ? entry.terms : [];
    if(!terms.length) return [];

    const cumules = new Map();
    terms.forEach(term => {
      const rank = SUMMARY_ROLE_ORDER.indexOf(term.role);
      if(rank < 0) return;
      const cle = term.role + "|" + term.stat;
      if(!cumules.has(cle)){
        cumules.set(cle, {
          stat:term.stat,
          unit:term.unit,
          value:0,
          rank
        });
      }
      cumules.get(cle).value += term.value;
    });

    return [...cumules.values()]
      .sort((a, b) => a.rank - b.rank || b.value - a.value)
      .slice(0, max)
      .map(item => ({
        stat:item.stat,
        value:item.value,
        unit:item.unit,
        label:buildStatMetadata(item.stat).fr || item.stat
      }));
  }
```

- [ ] **Step 4: Exporter et exposer**

Ajouter `summaryTermsFor` au bloc `export` (ordre alphabétique, après `groupBuildTermsBySlot`), et dans `tests/helpers/load-app.js` à côté de `groupBuildTermsBySlot` :

```js
  summaryTermsFor:typeof summaryTermsFor === "function"
    ? summaryTermsFor
    : undefined,
```

- [ ] **Step 5: Lancer les tests**

```bash
node tests/apport-par-piece.test.js && npm run test:unit
```

Attendu : tout au vert.

*Note : `buildStatMetadata(stat)` renvoie l'entrée de `BUILD_STATS.statLabels`, qui porte bien un champ `fr` — c'est celui que lit déjà `groupBuildStatResults` à la ligne 1105. Le repli `|| item.stat` couvre le cas où une statistique nouvelle n'aurait pas encore de libellé.*

- [ ] **Step 6: Commit**

```bash
git add js/metier/stats-calcul.js tests/helpers/load-app.js tests/apport-par-piece.test.js
git commit -m "feat: classer les apports d'une piece par nature puis par valeur

Les unites ne sont pas comparables, donc l'ordre vient des roles et non
d'une normalisation arbitraire. Une piece qui n'a qu'un role rend un seul
apport : on ne complete jamais pour atteindre trois."
```

---

## Task 4 : le résumé sous chaque pièce

**Files:**
- Modify: `js/vues/fiche-heros.js` (`equipLine` ~82, ses trois appels ~120-124, l'en-tête du module)
- Modify: `css/modales.css`
- Test: `tests/apport-par-piece.playwright.js` (créé en tâche 5)

**Interfaces:**
- Consumes: `groupBuildTermsBySlot` et `summaryTermsFor` (tâches 2 et 3).
- Produces: `equipLine(file, slotLabel, variant, entry)` — quatrième paramètre facultatif. Absent, la ligne se dessine comme aujourd'hui.

- [ ] **Step 1: Importer les deux fonctions**

Dans `js/vues/fiche-heros.js`, ajouter à l'import existant de `stats-calcul.js`. Il n'y en a pas encore : ajouter la ligne après l'import de `equipe-modele.js` :

```js
import {
  groupBuildStatResults,
  groupBuildTermsBySlot,
  summaryTermsFor
} from "../metier/stats-calcul.js";
import { formatBuildStatValue, statTermsDetails, gearTermLabel } from "./stats-affichage.js";
```

`vues/stats-affichage.js` est en position 8 et `vues/fiche-heros.js` en position 14 : la dépendance respecte l'ordre des couches.

- [ ] **Step 2: Étendre `equipLine`**

Remplacer la fonction (~82) par :

```js
  /* La ligne d'une piece. `entry` vient de groupBuildTermsBySlot : absente,
     la ligne se dessine comme avant, ce qui garde les appelants qui n'ont pas
     de build a montrer. */
  function equipLine(file, slotLabel, variant, entry){
    const thumb = el("div",{class:"eq-thumb"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file) thumb.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')";
    const txt = el("div",{class:"eq-txt"},[
      el("span",{class:"eq-slot", text:slotLabel}),
      el("span",{class:"eq-name", text: file ? nameOfFile(file) : "—"})
    ]);
    const line = el("div",{class:"eq-line"+(file?"":" empty"), title: file ? nameOfFile(file) : ""},[
      thumb,
      txt
    ]);
    if(file && entry) txt.appendChild(equipContribution(entry));
    return line;
  }
```

- [ ] **Step 3: Écrire le rendu de l'apport**

Ajouter juste au-dessus de `equipLine` :

```js
  function contributionText(item){
    return item.label+" "+formatBuildStatValue(item.value, item.unit)
      +(item.unit === "flat" ? "" : " %");
  }

  /* L'apport d'une piece : un resume toujours visible, le detail au clic.
     Le detail passe par la chaine d'affichage deja utilisee par les editeurs,
     donc le membre retrouve une presentation qu'il connait. */
  function equipContribution(entry){
    const resume = summaryTermsFor(entry, 3);
    if(!resume.length){
      return el("span",{
        class:"eq-contribution empty",
        text:"À configurer"
      });
    }
    const box = el("details",{class:"eq-contribution"});
    box.appendChild(el("summary",{
      text:resume.map(contributionText).join(" · ")
    }));
    groupBuildStatResults(entry).forEach(group => {
      group.stats.forEach(stat => {
        box.appendChild(statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit),
          termProvenance:term => term.source.component
        }));
      });
    });
    return box;
  }
```

- [ ] **Step 4: Passer les entrées aux trois appels**

Dans `heroDetail`, avant la construction de `gear` (~119) :

```js
    const entries = groupBuildTermsBySlot(h);
    const entryOf = slot => entries.find(item => item.slot === slot) || null;
```

Puis remplacer les trois appels :

```js
    gear.appendChild(equipLine(h.weapon, "Arme", "weapon", entryOf("weapon")));
```

```js
    ARMOR_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.armor ? h.armor[s] : null, ARMOR_LABELS[s], "", entryOf(s))
    ));
```

```js
    JEWEL_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.jewel ? h.jewel[s] : null, JEWEL_LABELS[s], "jewel", entryOf(s))
    ));
```

- [ ] **Step 5: Afficher le bonus d'ensemble**

Après la boucle des bijoux, avant que `gear` soit ajouté à `col` :

```js
    const setEntry = entryOf("set");
    if(setEntry && setEntry.terms.length){
      const bonus = el("div",{class:"eq-set-bonus"});
      bonus.appendChild(el("div",{class:"hd-group-t", text:"Bonus d’ensemble"}));
      bonus.appendChild(equipContribution(setEntry));
      gear.appendChild(bonus);
    }
```

- [ ] **Step 6: Corriger l'en-tête périmé du module**

Le commentaire annonce « le noyau commun aux quatre grosses modales ». `heroDetail` n'a que deux appelants. Remplacer la phrase par :

```
   C'est le noyau commun aux deux modales de consultation — detail d'une
   equipe et detail du roster d'un membre. Le Builder et le roster des
   membres n'utilisent que le bloc de stats, pas la fiche entiere.
```

- [ ] **Step 7: Ajouter les styles**

Dans `css/modales.css`, à la fin du fichier :

```css
/* L'apport d'une piece, sous son nom. Le resume tient sur une ligne et se
   tronque : la modale affiche jusqu'a huit heros de neuf pieces, la hauteur
   est la ressource rare. */
.eq-contribution {
  margin-top: 0.15rem;
  font-size: 0.78rem;
  color: var(--or-doux, #c9a961);
}
.eq-contribution > summary {
  cursor: pointer;
  list-style: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.eq-contribution > summary::-webkit-details-marker { display: none; }
.eq-contribution > summary::before { content: "▸ "; }
.eq-contribution[open] > summary::before { content: "▾ "; }
.eq-contribution.empty {
  display: block;
  color: rgba(255, 255, 255, 0.4);
  font-style: italic;
}
.eq-set-bonus { margin-top: 0.5rem; }
```

- [ ] **Step 8: Vérifier l'ordre des feuilles de style**

```bash
node tests/css-ordre.test.js
```

Attendu : PASS. `modales.css` est chargée avant `responsive.css`, l'ajout ne change pas l'ordre.

- [ ] **Step 9: Vérifier que les imports respectent les couches**

```bash
node tests/modules-imports.test.js
```

Attendu : PASS. Si le test refuse l'import de `stats-affichage.js`, c'est que l'ordre a changé — vérifier `tests/helpers/modules.js` avant de contourner.

- [ ] **Step 10: Commit**

```bash
git add js/vues/fiche-heros.js css/modales.css
git commit -m "feat: montrer l'apport de chaque piece sous la piece

Un resume d'au plus trois apports, deplie vers le detail complet par la
meme chaine d'affichage que les editeurs. Le bonus d'ensemble apparait a
part : il n'appartient a aucune piece, et le repartir serait faux."
```

---

## Task 5 : test de bout en bout et inscription dans la suite

**Files:**
- Create: `tests/apport-par-piece.playwright.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien pour les tâches suivantes — c'est la dernière.

- [ ] **Step 1: Écrire le test**

Créer `tests/apport-par-piece.playwright.js`. La structure — serveur, navigateur, neutralisation du CDN Supabase, capture des erreurs de page — est celle commune à tous les tests navigateur du dépôt :

```js
"use strict";

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();

    /* Amener une equipe a l'ecran, puis ouvrir sa modale de detail.
       Reprendre ici la sequence exacte de tests/potentiel-commun.playwright.js
       pour equiper un heros : elle est deja eprouvee et evite d'en inventer
       une seconde. */

    /* Une piece configuree porte un resume. */
    const resume = page.locator(".eq-contribution > summary").first();
    await resume.waitFor({ state:"visible" });
    const texte = await resume.textContent();
    assert.ok(
      texte && texte.trim().length > 2,
      "le resume d'une piece configuree n'est pas vide"
    );

    /* Il est replie a l'ouverture, et se deplie au clic. */
    const details = page.locator(".eq-contribution").first();
    assert.equal(
      await details.evaluate(node => node.open),
      false,
      "le detail est replie a l'ouverture de la modale"
    );
    await resume.click();
    assert.equal(
      await details.evaluate(node => node.open),
      true,
      "un clic sur le resume deplie le detail"
    );

    /* Une piece non configuree l'annonce au lieu de rester muette. */
    const nonConfiguree = page.locator(".eq-contribution.empty").first();
    if(await nonConfiguree.count()){
      assert.equal(
        (await nonConfiguree.textContent()).trim(),
        "À configurer",
        "une piece non configuree affiche sa mention"
      );
    }

    assert.deepEqual(errors, [], "aucune erreur de page pendant le scenario");
    console.log("PASS Playwright: apport par piece");
  }finally{
    await browser.close();
    await server.close();
  }
})();
```

Le bloc de commentaire au milieu est le seul endroit à compléter : reprendre la séquence d'équipement d'un héros de `tests/potentiel-commun.playwright.js` (fonctions `chooseHero` et clics sur `.gear-slot`), qui est déjà éprouvée.

- [ ] **Step 2: Lancer le test**

```bash
node tests/apport-par-piece.playwright.js
```

Attendu : PASS. En cas d'échec sur un sélecteur, ouvrir la modale à la main sur `http://127.0.0.1:8001` et comparer le DOM réel — ne pas relâcher l'assertion pour la faire passer.

- [ ] **Step 3: Inscrire les deux tests dans `package.json`**

Ajouter `node tests/apport-par-piece.test.js` à la fin des chaînes `test` et `test:unit`, et `node tests/apport-par-piece.playwright.js` à la fin des chaînes `test` et `test:e2e`. Respecter l'ordre existant : les tests unitaires avant les Playwright dans `test`.

- [ ] **Step 4: Lancer la suite complète**

```bash
npm test
```

Attendu : tout au vert. Les deux tests `supabase-etape1` et `accessibilite-mobile` sont connus pour échouer par intermittence — les relancer une fois avant de conclure à une régression.

- [ ] **Step 5: Commit**

```bash
git add tests/apport-par-piece.playwright.js package.json
git commit -m "test: verifier l'apport par piece dans le navigateur

Le resume est present sous une piece configuree, replie a l'ouverture, et
se deplie au clic. Une piece non configuree affiche sa mention au lieu de
rester muette."
```

---

## Écarts assumés par rapport au spec

Deux points ont bougé pendant l'écriture du plan, tous deux dans le sens de la simplification. Ils sont notés ici pour que personne ne croie à un oubli.

**1. `calculateBuildStats` n'est finalement pas exportée.** Le spec (5.1a) prévoyait de l'exporter. Mais `groupBuildTermsBySlot` l'appelle en interne, et la vue n'a besoin de rien d'autre : exporter les deux élargirait la surface publique du module sans usage. Elle reste privée, et les tests y accèdent par le chargeur `loadApp`, qui l'expose déjà (ligne ~367).

**2. Il y a quatre natures de terme d'équipement, pas trois.** Le spec (5.2) listait `main`, `sub`, `enchantment`, `bonus`. La lecture du code a révélé un quatrième préfixe, `":extra:"`. Il est intégré au champ `role` et classé entre `sub` et `enchantment` : c'est une statistique native de la pièce, au même titre que la principale et la secondaire.

---

## Ce qui n'est PAS dans ce plan

**La mention « À configurer » n'est pas cliquable.** Le spec prévoyait qu'elle ouvre l'éditeur de la pièce sur son propre build. L'écriture du plan a montré que c'est disproportionné : `openGearConfigEditor(context, restoreFocus)` attend un contexte `{ file, slotKey, label, config, commit }`, où `commit` est le rappel qui **persiste** la configuration modifiée. Or les deux modales visées sont des vues de consultation, qui affichent le plus souvent le build d'un autre membre : aucune n'a de chemin de persistance, et `detail-roster.js` n'importe même pas l'éditeur.

Câbler `commit` depuis une modale de consultation reviendrait à y faire entrer la logique d'écriture du roster et des équipes — un chantier d'une autre nature, et probablement au mauvais endroit.

Le plan livre donc la mention en texte, dans les deux modales. Le lien reste possible en suite, avec sa propre conception.

**Également hors périmètre**, conformément au spec : le Builder, le roster personnel, le bloc « Statistiques du héros » en bas de fiche, et toute modification du schéma Supabase.
