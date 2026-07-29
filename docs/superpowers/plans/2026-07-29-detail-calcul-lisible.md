# Détail du calcul lisible — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** rendre lisible le bloc « Détail du calcul » en regroupant les
termes identiques, sans toucher au moteur de calcul.

**Architecture :** trois rendus tripliqués sont remplacés par une fonction
commune `statTermsDetails(stat, { termLabel, termValue, termProvenance,
termEmphasis })`.
Une fonction pure `statTermGroups()` regroupe les termes dont la ligne rendue
serait identique. Chaque terme du moteur conserve son propre nœud DOM.

**Pile technique :** JavaScript inline dans `index.html`, aucune étape de build,
aucun module ES. Tests Node natifs (`assert`) via le bac à sable `vm` de
`tests/helpers/load-app.js`, plus Playwright pour le rendu réel.

**Spec :** `docs/superpowers/specs/2026-07-29-detail-calcul-lisible-design.md`

## Contraintes globales

- **Aucune étape de build.** Tout doit fonctionner par double-clic sur
  `index.html`, en `file://`.
- **`index.html` a des fins de ligne mixtes (CRLF et LF).** Ne jamais présumer
  le séparateur d'une ancre multi-ligne : inspecter la zone ciblée, utiliser une
  expression tolérant `\r?\n`, ou éditer ligne par ligne. Ne pas normaliser le
  fichier au passage.
- **Toute fonction pure à tester doit être ajoutée à `HOOK_EXPORT`** dans
  `tests/helpers/load-app.js` (~ligne 80).
- **Le moteur ne bouge pas** : `terms`, `totals`, `appliesTo`, `bucket`,
  `confidence` et les constantes d'hypothèse restent inchangés.
- **Le lot ne change pas quelles lignes sont mises en avant.** `termEmphasis`
  reproduit les règles actuelles : tout terme `multiply` pour le héros et pour
  l'arme, aucun pour l'équipement.
- **Règle d'or sur les assets :** aucune liste d'armes, d'armures ou de
  personnages codée en dur. Les libellés d'arme viennent de `WEAPON_ENUM`
  (`index.html` ~2003).
- **TDD strict** : écrire le test, le voir échouer pour la bonne raison,
  implémenter au minimum. Prouver qu'une assertion mord en cassant volontairement
  le code visé.
- **Un commit par tâche**, message en français décrivant le *pourquoi*.
- **Les numéros de ligne de ce plan valent pour `11ca999` et se décalent dès la
  première édition.** Toujours retrouver une ancre par le nom de la fonction
  (`grep -n "function heroTermLabel" index.html`), jamais par son numéro.
- Commandes de vérification : `node tests/stats-build.test.js` pour la boucle
  courte, `npm test` en fin de lot, puis `git diff --check` et
  `git status --short`.

---

### Tâche 1 : libellés d'origine des termes du héros

Aujourd'hui `heroTermLabel()` renvoie « Application du taux » pour **tous** les
multiplicateurs, ce qui rend les dizaines de lignes indiscernables. Elle renvoie
aussi « Maîtrise Wand » (l'enum brut) et ne distingue pas les maîtrises de
réserve. Cette tâche corrige les libellés ; le regroupement viendra ensuite.

**Fichiers :**
- Modifier : `index.html` (`heroTermLabel`, ~4185-4211)
- Modifier : `tests/helpers/load-app.js` (`HOOK_EXPORT`, ~80)
- Test : `tests/stats-build.test.js`

**Interfaces :**
- Produit : `heroTermOriginLabel(term) -> string | null` — libellé de la
  provenance d'un terme, indépendamment de son opération. `null` si la
  provenance n'est pas reconnue.
- Produit : `heroTermLabel(term) -> string` — signature inchangée, valeurs de
  retour modifiées pour les multiplicateurs `hero-main-rate`, les maîtrises de
  réserve et les domaines d'équipement.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `tests/stats-build.test.js`, avant l'appel final
`console.log("PASS ...")` :

```js
function testHeroTermOriginLabels(hooks){
  const originLabel = hooks.heroTermOriginLabel;
  assert.strictEqual(
    originLabel({ source:{ domain:"character", component:"base" } }),
    "Base du personnage"
  );
  assert.strictEqual(
    originLabel({ source:{ domain:"mastery", component:"common-mastery" } }),
    "Maîtrise commune"
  );
  assert.strictEqual(
    originLabel({
      source:{ domain:"mastery", component:"weapon-mastery", weaponType:"Wand" }
    }),
    "Maîtrise Baguette",
    "Le libellé doit venir de WEAPON_ENUM, pas de l'enum brut"
  );
  assert.strictEqual(
    originLabel({
      source:{
        domain:"mastery", component:"reserve-weapon-mastery", weaponType:"Book"
      }
    }),
    "Maîtrises de réserve"
  );
  assert.strictEqual(
    originLabel({ source:{ domain:"potential", component:"potential", tier:7 } }),
    "Potentiel P7"
  );
  ["armor", "jewel", "engraving"].forEach(domain => {
    assert.strictEqual(
      originLabel({ source:{ domain, component:"level" } }),
      "Équipement",
      "Les pièces sont réunies sous un seul libellé dans la fiche du héros"
    );
  });
  assert.strictEqual(
    originLabel({ source:{ domain:"set", component:"bonus" } }),
    "Bonus d’ensemble",
    "Les ensembles restent distincts des pièces"
  );
  assert.strictEqual(
    originLabel({ source:{ domain:"weapon", component:"level" } }),
    null,
    "Une provenance non regroupée doit répondre null"
  );
}

function testHeroTermLabelUsesOrigin(hooks){
  const label = hooks.heroTermLabel;
  assert.strictEqual(
    label({
      operation:"multiply",
      appliesTo:["character:base"],
      source:{
        domain:"mastery",
        component:"weapon-mastery",
        weaponType:"Wand",
        application:"hero-main-rate"
      }
    }),
    "Maîtrise Baguette",
    "Un taux principal est libellé par sa provenance, pas « Application du taux »"
  );
  assert.strictEqual(
    label({
      operation:"multiply",
      appliesTo:["weapon-native"],
      source:{ domain:"weapon", component:"overlimit", id:"x.webp" }
    }),
    "Outrepassement",
    "L'outrepassement n'est pas un taux principal"
  );
  assert.strictEqual(
    label({
      operation:"add",
      bucket:"armor:Bas",
      source:{ domain:"armor", component:"level", slot:"Bas", id:"x.webp" }
    }),
    "Équipement"
  );
}
```

Puis appeler les deux fonctions à l'endroit où les autres tests du fichier sont
appelés, juste avant `console.log("PASS stats de builds ...")` :

```js
testHeroTermOriginLabels(hooks);
testHeroTermLabelUsesOrigin(hooks);
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
node tests/stats-build.test.js
```

Attendu : `TypeError: hooks.heroTermOriginLabel is not a function`.

- [ ] **Étape 3 : exposer les deux fonctions dans le bac à sable**

Dans `tests/helpers/load-app.js`, à l'intérieur de l'objet `HOOK_EXPORT`
(~ligne 80), ajouter :

```js
  heroTermOriginLabel:typeof heroTermOriginLabel === "function"
    ? heroTermOriginLabel
    : undefined,
  heroTermLabel:typeof heroTermLabel === "function"
    ? heroTermLabel
    : undefined,
```

- [ ] **Étape 4 : implémenter le minimum**

Dans `index.html`, juste avant `function heroTermLabel(term){` (~4185),
insérer :

```js
  /* Libellé de la provenance d'un terme, indépendant de son opération. C'est
     lui qui réunit les pièces sous « Équipement » et qui donne un nom aux taux
     principaux, dont le libellé historique « Application du taux » était le
     même pour des dizaines de lignes. Renvoie null quand la provenance n'est
     pas regroupée : l'appelant garde alors son libellé spécifique. */
  function heroTermOriginLabel(term){
    const source = (term && term.source) || {};
    if(source.domain === "character") return "Base du personnage";
    if(source.domain === "mastery"){
      if(source.component === "common-mastery") return "Maîtrise commune";
      if(source.component === "reserve-weapon-mastery"){
        return "Maîtrises de réserve";
      }
      const meta = WEAPON_ENUM[source.weaponType];
      return "Maîtrise "+((meta && meta.label) || source.weaponType || "");
    }
    if(source.domain === "potential") return "Potentiel P"+source.tier;
    if(source.domain === "set") return "Bonus d’ensemble";
    if(source.domain === "armor" || source.domain === "jewel"
      || source.domain === "engraving"){
      return "Équipement";
    }
    return null;
  }
```

Puis remplacer le corps de `heroTermLabel` par :

```js
  function heroTermLabel(term){
    const source = term.source || {};
    if(source.component === "final-ceil"
      || source.component === "final-rounding"){
      return "Arrondi du jeu";
    }
    if(term.operation === "multiply"){
      if(source.application === "hero-main-rate"){
        return heroTermOriginLabel(term) || "Application du taux";
      }
      return source.component === "overlimit"
        ? "Outrepassement" : "Application du taux";
    }
    const origin = heroTermOriginLabel(term);
    if(origin) return origin;
    if(source.domain === "weapon") return weaponTermLabel(term);
    if(source.domain === "secondary-weapon"){
      return (source.weaponType || "Arme")
        +" secondaire : "
        +formatBuildStatValue(source.originalValue, "flat")
        +" ATK × "
        +formatBuildStatValue(source.transferRate, "ten-thousandths")
        +" =";
    }
    return gearTermLabel(term);
  }
```

- [ ] **Étape 5 : lancer le test pour le voir passer**

```bash
node tests/stats-build.test.js
```

Attendu : `PASS stats de builds : modèle et calcul de l’arme`.

- [ ] **Étape 6 : prouver que l'assertion mord**

Remplacer temporairement `return "Maîtrises de réserve";` par
`return "Maîtrise de réserve";` (singulier), relancer le test, vérifier
l'échec, puis rétablir.

- [ ] **Étape 7 : commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: nommer les taux principaux par leur provenance

« Application du taux » était le libellé de dizaines de lignes
indiscernables. Un taux principal porte désormais le nom de sa source, les
pièces sont réunies sous « Équipement » et les maîtrises de réserve sont
distinguées de l'arme équipée."
```

---

### Tâche 2 : regroupement pur des termes

**Fichiers :**
- Modifier : `index.html` (insérer avant `heroStatDetails`, ~4234)
- Modifier : `tests/helpers/load-app.js` (`HOOK_EXPORT`, ~80)
- Test : `tests/stats-build.test.js`

**Interfaces :**
- Consomme : `heroTermLabel` de la tâche 1.
- Produit : `statTermGroups(stat, { termLabel, termEmphasis }) -> Array<{
  key, label, operation, unit, appliesTo, emphasis, mainRate, value, terms }>`
  — groupes dans l'ordre de première apparition de leurs termes.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `tests/stats-build.test.js` :

```js
function testStatTermGroups(hooks){
  const groups = hooks.statTermGroups;
  const label = term => term.source.label;
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"add", unit:"flat", value:10,
        bucket:"mastery:Wand", source:{ label:"Maîtrise Baguette" }
      },
      {
        id:"b", operation:"add", unit:"flat", value:32,
        bucket:"mastery:Wand", source:{ label:"Maîtrise Baguette" }
      },
      {
        id:"c", operation:"add", unit:"flat", value:5,
        bucket:"character:base", source:{ label:"Base du personnage" }
      }
    ]
  };
  const result = groups(stat, { termLabel:label });
  assert.strictEqual(result.length, 2, "Deux libellés distincts, deux groupes");
  assert.strictEqual(result[0].label, "Maîtrise Baguette");
  assert.strictEqual(result[0].value, 42, "Les additifs d'un groupe se somment");
  assert.strictEqual(result[0].terms.length, 2);
  assert.strictEqual(
    result[1].label, "Base du personnage",
    "L'ordre suit la première apparition des termes"
  );
}

function testStatTermGroupsKeepAppliesToApart(hooks){
  const stat = {
    stat:"B_Atk",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base", "armor:Bas"], source:{ label:"Taux" }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["weapon-native"], source:{ label:"Taux" }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label
  });
  assert.strictEqual(
    result.length, 2,
    "Deux multiplicateurs visant des seaux différents ne peuvent pas être sommés"
  );
}

function testStatTermGroupsKeepEmphasisApart(hooks){
  const stat = {
    stat:"B_Atk",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"], source:{ label:"Taux", strong:true }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"], source:{ label:"Taux", strong:false }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label,
    termEmphasis:term => term.source.strong ? "weapon-stat-term-overlimit" : ""
  });
  assert.strictEqual(
    result.length, 2,
    "Une emphase différente change la ligne rendue : pas de fusion"
  );
}

function testStatTermGroupsFlagMainRate(hooks){
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"],
        source:{ label:"Maîtrise Baguette", application:"hero-main-rate" }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:500,
        appliesTo:["weapon-native"],
        source:{ label:"Outrepassement", component:"overlimit" }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label
  });
  assert.deepStrictEqual(
    result.map(group => group.mainRate),
    [true, false],
    "Seuls les taux principaux sont marqués pour le regroupement d'affichage"
  );
}

function testStatTermGroupsKeepMainRateApart(hooks){
  const stat = {
    stat:"B_Atk",
    unit:"flat",
    terms:[
      {
        id:"a", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"],
        source:{ label:"Équipement", application:"hero-main-rate" }
      },
      {
        id:"b", operation:"multiply", unit:"ten-thousandths", value:300,
        appliesTo:["character:base"],
        source:{ label:"Équipement" }
      }
    ]
  };
  const result = hooks.statTermGroups(stat, {
    termLabel:term => term.source.label
  });
  assert.strictEqual(
    result.length, 2,
    "Un taux principal ne fusionne jamais avec un multiplicateur ordinaire :"
      +" leur notation et leur emplacement diffèrent"
  );
}
```

Puis appeler les quatre fonctions avec les autres :

```js
testStatTermGroups(hooks);
testStatTermGroupsKeepAppliesToApart(hooks);
testStatTermGroupsKeepEmphasisApart(hooks);
testStatTermGroupsKeepMainRateApart(hooks);
testStatTermGroupsFlagMainRate(hooks);
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
node tests/stats-build.test.js
```

Attendu : `TypeError: hooks.statTermGroups is not a function`.

- [ ] **Étape 3 : exposer la fonction**

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  statTermGroups:typeof statTermGroups === "function"
    ? statTermGroups
    : undefined,
```

- [ ] **Étape 4 : implémenter le minimum**

Dans `index.html`, juste avant `function heroStatDetails(stat){` (~4234) :

```js
  /* Deux termes ne sont regroupés que s'ils produiraient exactement la même
     ligne. `appliesTo` fait partie de la clé parce que la contribution d'un
     multiplicateur vaut base(appliesTo) × valeur : sommer deux taux visant des
     seaux différents afficherait un total appliqué à une base qui n'existe
     pas. L'emphase en fait partie parce qu'elle change la ligne rendue. */
  const STAT_TERM_KEY_SEPARATOR = "\u0001";
  function statTermGroupKey(term, termLabel, termEmphasis){
    return [
      termLabel(term) || "Autre",
      term.operation,
      term.unit,
      term.operation === "multiply"
        ? [...(term.appliesTo || [])].sort().join(",")
        : "",
      termEmphasis(term) || "",
      /* `mainRate` change la notation ET l'emplacement du groupe : un taux
         principal et un multiplicateur ordinaire ne doivent jamais fusionner,
         même si tout le reste coïncide. */
      ((term.source || {}).application === "hero-main-rate") ? "1" : "0"
    ].join(STAT_TERM_KEY_SEPARATOR);
  }
  function statTermGroups(stat, options){
    const settings = options || {};
    const termLabel = settings.termLabel;
    const termEmphasis = settings.termEmphasis || (() => "");
    const groups = [];
    const index = new Map();
    ((stat && stat.terms) || []).forEach(term => {
      const key = statTermGroupKey(term, termLabel, termEmphasis);
      let group = index.get(key);
      if(!group){
        const source = term.source || {};
        group = {
          key,
          label:termLabel(term) || "Autre",
          operation:term.operation,
          unit:term.unit,
          appliesTo:term.operation === "multiply"
            ? [...(term.appliesTo || [])].sort() : [],
          emphasis:termEmphasis(term) || "",
          mainRate:source.application === "hero-main-rate",
          value:0,
          terms:[]
        };
        index.set(key, group);
        groups.push(group);
      }
      group.value += Number(term.value) || 0;
      group.terms.push(term);
    });
    return groups;
  }
```

- [ ] **Étape 5 : lancer le test pour le voir passer**

```bash
node tests/stats-build.test.js
```

Attendu : `PASS stats de builds : modèle et calcul de l’arme`.

- [ ] **Étape 6 : prouver que les assertions mordent**

Trois mutations, une par composante ajoutée à la clé. Après chacune, relancer
`node tests/stats-build.test.js`, vérifier l'échec attendu, puis rétablir.

| Mutation | Test qui doit échouer |
| --- | --- |
| remplacer la ligne `appliesTo` de la clé par `""` | `testStatTermGroupsKeepAppliesToApart` |
| retirer `termEmphasis(term) \|\| ""` de la clé | `testStatTermGroupsKeepEmphasisApart` |
| remplacer la ligne `mainRate` de la clé par `"0"` | `testStatTermGroupsKeepMainRateApart` |

- [ ] **Étape 7 : commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: regrouper les termes qui rendraient la même ligne

La clé retient le libellé, l'opération, l'unité, les seaux ciblés et
l'emphase. Les seaux en font partie parce qu'un multiplicateur s'applique à
la base qu'il vise : sommer deux taux de seaux différents afficherait un
total appliqué à une base inexistante."
```

---

### Tâche 3 : rendu commun et branchement de la fiche du héros

**Fichiers :**
- Modifier : `index.html` (CSS, `heroStatDetails`, `heroTermProvenance`,
  `weaponTermProvenance`)
- Test : `tests/stats-build.test.js`

**Interfaces :**
- Consomme : `statTermGroups` (tâche 2), `heroTermLabel` (tâche 1).
- Produit : `statTermsDetails(stat, { termLabel, termValue, termProvenance,
  termEmphasis }) -> HTMLDetailsElement` — le bloc « Détail du calcul » complet.
- Produit : `mainRateValueText(value) -> string` — notation additive des taux
  principaux, réutilisée par les trois appelants.

- [ ] **Étape 0 : donner un nom de balise aux nœuds factices**

`FakeElement` (`tests/helpers/load-app.js` ~19) ne retient pas le nom de balise :
`createElement:() => new FakeElement()` l'ignore. Sans lui, l'assertion « aucun
`<summary>` ne porte la classe d'un terme » est inécrivable. Modifier
`makeDocument()` (~57) :

```js
    createElement:tag => {
      const node = new FakeElement();
      node.tag = String(tag);
      return node;
    },
```

Lancer `node tests/stats-build.test.js` : la suite doit rester verte, ce
changement n'ajoute qu'une propriété.

- [ ] **Étape 1 : écrire le test qui échoue**

```js
function testStatTermsDetailsStructure(hooks){
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    label:"PV",
    terms:[
      {
        id:"m1", operation:"add", unit:"flat", value:10,
        bucket:"mastery:Wand", source:{ label:"Maîtrise Baguette" }
      },
      {
        id:"m2", operation:"add", unit:"flat", value:32,
        bucket:"mastery:Wand", source:{ label:"Maîtrise Baguette" }
      },
      {
        id:"base", operation:"add", unit:"flat", value:5,
        bucket:"character:base", source:{ label:"Base du personnage" }
      }
    ]
  };
  const node = hooks.statTermsDetails(stat, {
    termLabel:term => term.source.label,
    termValue:term => String(term.value),
    termProvenance:() => "Source : test"
  });

  const rendered = fakeNodes(node, item =>
    (item.className || "").split(" ").includes("weapon-stat-term")
  );
  assert.deepStrictEqual(
    rendered.map(item => item.dataset.termId).slice().sort(),
    ["base", "m1", "m2"],
    "Un nœud de terme par terme du moteur, identifié par data-term-id"
  );

  const summaries = fakeNodes(node, item => item.tag === "summary");
  summaries.forEach(summary => {
    assert.ok(
      !(summary.className || "").split(" ").includes("weapon-stat-term"),
      "Un résumé de groupe ne doit jamais porter la classe d'un terme"
    );
  });

  const groups = fakeNodes(node, item =>
    (item.className || "").split(" ").includes("stat-term-group")
  );
  assert.strictEqual(
    groups.length, 1,
    "Seul le groupe de deux termes est replié ; le groupe d'un terme reste plat"
  );
  const solo = rendered.find(item => item.dataset.termId === "base");
  assert.ok(
    node.children.includes(solo),
    "Un groupe d'un seul terme est enfant direct du détail : sans quoi il "
      +"faudrait un second clic pour le voir, et potentiel-commun casse"
  );
  const paired = rendered.find(item => item.dataset.termId === "m1");
  assert.ok(
    !node.children.includes(paired),
    "Un terme d'un groupe multiple est enfant du repli, pas du détail"
  );
}
```

Ajouter aussi le test du repli de dégradation exigé par la spec §7 :

```js
function testStatTermGroupsFallbackLabel(hooks){
  const stat = {
    stat:"B_MaxHp",
    unit:"flat",
    terms:[
      { id:"x", operation:"add", unit:"flat", value:3, bucket:"z", source:{} }
    ]
  };
  const result = hooks.statTermGroups(stat, { termLabel:() => undefined });
  assert.strictEqual(
    result[0].label, "Autre",
    "Un terme dont le libellé est inconnu reste visible dans un groupe « Autre »"
  );
}
```

Appeler `testStatTermsDetailsStructure(hooks);` et
`testStatTermGroupsFallbackLabel(hooks);` avec les autres.

`FakeElement` expose bien `className` et `dataset` (~19-29) ; `tag` vient de
l'étape 0.

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
node tests/stats-build.test.js
```

Attendu : `TypeError: hooks.statTermsDetails is not a function`.

- [ ] **Étape 3 : exposer la fonction**

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  statTermsDetails:typeof statTermsDetails === "function"
    ? statTermsDetails
    : undefined,
  heroTermValue:typeof heroTermValue === "function"
    ? heroTermValue
    : undefined,
  groupBuildStatResults:typeof groupBuildStatResults === "function"
    ? groupBuildStatResults
    : undefined,
```

- [ ] **Étape 4 : ajouter le style du groupe**

Dans `index.html`, après la règle `.weapon-stat-term-overlimit` (~1330) :

```css
  .stat-term-group{margin-top:6px}
  .stat-term-group>summary{
    min-height:44px;display:flex;align-items:center;
    justify-content:space-between;gap:10px;cursor:pointer;
    color:var(--muted);font-size:11px
  }
  .stat-term-group>summary span:last-child{flex:none;color:var(--parchment)}
  .stat-term-group .weapon-stat-term{margin-left:10px}
  .stat-term-buckets{
    margin-top:8px;overflow-wrap:anywhere;color:var(--muted-2);font-size:11px
  }
```

- [ ] **Étape 5 : implémenter le rendu commun**

Remplacer entièrement `heroStatDetails` (~4234-4273) par :

```js
  /* Les taux principaux s'additionnent : les écrire ×1,03 laisserait croire à
     un produit composé. Trois nœuds à 3 % font +9 %, pas +9,27 %. */
  function mainRateValueText(value){
    return formatBuildStatValue(value, "ten-thousandths");
  }
  function statTermNode(term, group, termValue, termProvenance){
    return el("div",{
      class:"weapon-stat-term",
      dataset:{
        termId:term.id,
        operation:term.operation,
        unit:term.unit,
        buckets:term.operation === "multiply"
          ? term.appliesTo.join(",") : term.bucket
      }
    },[
      el("div",{class:"weapon-stat-term-value"},[
        el("span",{text:group.label}),
        el("span",{
          class:group.emphasis,
          text:termValue(term, group)
        })
      ]),
      el("small",{
        class:"weapon-stat-provenance",
        text:termProvenance(term)
      })
    ]);
  }
  /* Le total d'un groupe n'est affiché que pour les taux principaux et les
     additifs, dont la somme a un sens. Un groupe de multiplicateurs non
     principaux n'existe pas en pratique : chacun porte un libellé distinct. */
  function statGroupTotalText(group){
    if(group.operation === "multiply"){
      return group.mainRate ? mainRateValueText(group.value) : "";
    }
    return formatBuildStatValue(group.value, group.unit)
      +(group.unit === "flat" ? " points" : "");
  }
  function statGroupNode(group, termValue, termProvenance){
    if(group.terms.length === 1){
      return statTermNode(group.terms[0], group, termValue, termProvenance);
    }
    const node = el("details",{class:"stat-term-group"},[
      el("summary",{},[
        el("span",{
          text:group.label+" · "+group.terms.length+" apports"
        }),
        el("span",{class:group.emphasis, text:statGroupTotalText(group)})
      ])
    ]);
    group.terms.forEach(term => {
      node.appendChild(statTermNode(term, group, termValue, termProvenance));
    });
    return node;
  }
  function statBucketNotes(groups){
    /* Une même statistique porte plusieurs bases : les taux principaux visent
       tous les seaux fixes, l'outrepassement les seuls seaux natifs de l'arme.
       Une note unique afficherait la mauvaise base pour l'un des deux.
       La note dit seulement où le taux s'applique : la mention « base
       présumée » vit sur la ligne ou le bloc concerné, jamais deux fois. */
    const seen = new Set();
    const notes = [];
    groups.forEach(group => {
      if(group.operation !== "multiply") return;
      const key = group.appliesTo.join(",");
      if(!key || seen.has(key)) return;
      seen.add(key);
      notes.push(el("small",{
        class:"stat-term-buckets",
        text:"Appliqué à : "+key.split(",").join(", ")
      }));
    });
    return notes;
  }
  function statTermsDetails(stat, options){
    const settings = options || {};
    const termValue = settings.termValue;
    const termProvenance = settings.termProvenance;
    const termEmphasis = settings.termEmphasis || (() => "");
    const details = el("details",{class:"weapon-stat-details"},[
      el("summary",{text:"Détail du calcul"})
    ]);
    const groups = statTermGroups(stat, {
      termLabel:settings.termLabel,
      termEmphasis
    });
    /* Un bloc « Taux principaux » par base visée. Additionner des taux qui ne
       visent pas les mêmes seaux donnerait un total appliqué à une base qui
       n'existe pas — c'est précisément ce que la clé de groupe interdit, et le
       rendu ne doit pas le réintroduire. */
    const mainRateBlocks = new Map();
    groups.forEach(group => {
      if(!group.mainRate) return;
      const key = group.appliesTo.join(",");
      if(!mainRateBlocks.has(key)) mainRateBlocks.set(key, []);
      mainRateBlocks.get(key).push(group);
    });
    const renderedBlocks = new Set();
    groups.forEach(group => {
      if(!group.mainRate){
        details.appendChild(
          statGroupNode(group, termValue, termProvenance)
        );
        return;
      }
      const key = group.appliesTo.join(",");
      if(renderedBlocks.has(key)) return;
      renderedBlocks.add(key);
      const block = mainRateBlocks.get(key);
      const total = block.reduce((sum, item) => sum + item.value, 0);
      const presumed = block.some(item =>
        item.terms.some(term => term.confidence === "presumed")
      );
      const parent = el("details",{class:"stat-term-group"},[
        el("summary",{},[
          el("span",{
            text:"Taux principaux"+(presumed ? " — base présumée" : "")
          }),
          el("span",{text:mainRateValueText(total)})
        ])
      ]);
      block.forEach(item => {
        parent.appendChild(statGroupNode(item, termValue, termProvenance));
      });
      details.appendChild(parent);
    });
    statBucketNotes(groups).forEach(note => details.appendChild(note));
    return details;
  }
  /* La valeur affichée diffère réellement d'un appelant à l'autre : le panneau
     d'arme met le libellé complet à droite — c'est la chaîne exacte assertie
     par tests/potentiel-commun.playwright.js — là où la fiche du héros n'y met
     que le facteur. D'où termValue plutôt qu'une règle unique. */
  function heroTermValue(term, group){
    if(term.operation !== "multiply"){
      return formatBuildStatValue(term.value, term.unit)
        +(term.unit === "flat" ? " points" : "");
    }
    if(group.mainRate) return mainRateValueText(term.value);
    const presumed = term.confidence === "presumed"
      || (term.source && term.source.component === "overlimit");
    return "×"+new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:4
    }).format(1 + Number(term.value) / 10000)
      +(presumed ? " — base présumée" : "");
  }
  function heroStatDetails(stat){
    return statTermsDetails(stat, {
      termLabel:heroTermLabel,
      termValue:heroTermValue,
      termProvenance:heroTermProvenance,
      termEmphasis:term => term.operation === "multiply"
        ? "weapon-stat-term-overlimit" : ""
    });
  }
```

`heroTermValue` reproduit exactement l'ancien `presumedMultiplierBase`
(`index.html` ~4239) pour les multiplicateurs non principaux : le suffixe
« — base présumée » ne doit pas disparaître de la fiche du héros.

- [ ] **Étape 5 bis : retirer la liste des seaux des provenances**

**Sans cette étape le lot échoue son objectif principal.** `statBucketNotes`
ajoute la liste des seaux en pied de bloc, mais les fonctions de provenance
continuent de la recopier sur chaque ligne — elle apparaîtrait donc **deux
fois**, alors que sa répétition est le défaut n°2 de la spec.

Ne retirer que la branche `multiply` : la liste `appliesTo` est identique sur
toutes les lignes d'une même base, c'est elle le pavé. Le `"seau <bucket>"` d'un
terme additif reste, il est court et distinct par terme.

D'abord, sortir le dictionnaire français de `weaponTermProvenance` (~4471) pour
que le pied de bloc puisse le réutiliser. Le déclarer juste avant
`statTermGroupKey` :

```js
  const BUILD_BUCKET_LABELS = {
    "weapon-native":"statistiques natives de l’arme",
    "weapon-enchantment":"enchantements de l’arme"
  };
```

Dans `weaponTermProvenance`, supprimer la déclaration locale `const buckets = {…}`
et remplacer le bloc final :

```js
    if(term.operation === "add"){
      parts.push("seau "+(BUILD_BUCKET_LABELS[term.bucket] || term.bucket));
    }
    return parts.join(" · ");
```

Dans `heroTermProvenance` (~4230), remplacer :

```js
    if(term.operation === "add") parts.push("seau "+term.bucket);
    return parts.join(" · ");
```

`gearTermProvenance` (~5320) n'a que la branche additive : ne pas y toucher.

Enfin, faire lire le dictionnaire par le pied de bloc, dans `statBucketNotes` :

```js
        text:"Appliqué à : "+key.split(",")
          .map(bucket => BUILD_BUCKET_LABELS[bucket] || bucket)
          .join(", ")
```

Test à ajouter dans `tests/stats-build.test.js` :

```js
function testProvenanceDropsTargetBuckets(hooks){
  const term = {
    operation:"multiply",
    unit:"ten-thousandths",
    value:500,
    appliesTo:["weapon-native"],
    source:{ domain:"weapon", component:"overlimit", id:"x.webp" }
  };
  [hooks.heroTermProvenance, hooks.weaponTermProvenance].forEach(provenance => {
    assert.ok(
      !provenance(term).includes("seau"),
      "La liste des seaux ciblés vit en pied de bloc, plus sur chaque ligne"
    );
  });
  assert.ok(
    hooks.heroTermProvenance({
      operation:"add", unit:"flat", value:10, bucket:"armor:Bas",
      source:{ domain:"armor", component:"level" }
    }).includes("seau armor:Bas"),
    "Le seau d'un terme additif reste : il est court et distinct par terme"
  );
}
```

Exposer `heroTermProvenance` et `weaponTermProvenance` dans `HOOK_EXPORT`, puis
appeler `testProvenanceDropsTargetBuckets(hooks);` avec les autres.

- [ ] **Étape 6 : lancer les tests**

```bash
node tests/stats-build.test.js
node tests/supabase-etape1.playwright.js
```

Attendu : les deux passent. `tests/supabase-etape1.playwright.js` (~1166) lit
`dataset.buckets` sur le premier `.weapon-stat-term` : il prouve que le nœud
par terme est conservé. Il vérifie aussi que le texte du terme commence par
`Source : …`, ce que l'étape 5 bis ne touche pas.

- [ ] **Étape 7 : prouver que l'assertion mord**

Faire porter la classe `weapon-stat-term` au `summary` de `statGroupNode`,
relancer `node tests/stats-build.test.js`, vérifier l'échec, puis rétablir.

- [ ] **Étape 8 : commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: replier les termes identiques du détail du calcul

Le détail des PV empilait des dizaines de lignes identiques. Les termes qui
rendraient la même ligne sont réunis sous un repli, les taux principaux
regroupés sous une entrée unique, et la liste des seaux affichée une fois
par base visée au lieu d'être recopiée sur chaque ligne."
```

---

### Tâche 4 : brancher les panneaux arme et équipement

**Fichiers :**
- Modifier : `index.html` (bloc inline arme ~4547-4582, bloc inline équipement
  ~5365-5389)

**Interfaces :**
- Consomme : `statTermsDetails` (tâche 3).

- [ ] **Étape 1 : remplacer le bloc inline de l'arme**

Dans `index.html`, remplacer les lignes du bloc `const details = el("details",
{class:"weapon-stat-details"}, ...)` de l'aperçu d'arme (~4547 à ~4582, jusqu'à
la parenthèse fermante du `stat.terms.forEach`) par :

```js
        const details = statTermsDetails(stat, {
          termLabel:term => term.operation === "multiply"
            ? "Outrepassement" : weaponTermLabel(term),
          termValue:term => term.operation === "multiply"
            ? weaponTermLabel(term)
            : formatBuildStatValue(term.value, term.unit)
              +(term.unit === "flat" ? " points" : ""),
          termProvenance:weaponTermProvenance,
          termEmphasis:term => term.operation === "multiply"
            ? "weapon-stat-term-overlimit" : ""
        });
```

La ligne suivante, `statNode.appendChild(details);`, reste inchangée.

Ces deux rappels reproduisent **exactement** l'ancien bloc : à gauche
`"Outrepassement"`, à droite `weaponTermLabel(term)` en entier, soit
`Outrepassement ×1,05 — base présumée`.
`tests/potentiel-commun.playwright.js` (~625) compare ce texte avec
`assert.equal` après `trim()` : toute autre valeur casse le test.

- [ ] **Étape 2 : lancer le test Playwright de l'arme**

```bash
node tests/potentiel-commun.playwright.js
```

Attendu : PASS. Ce test ouvre un seul `summary` puis exige que « Promotion »
soit visible (~243) et que la chaîne exacte
`Outrepassement ×1,05 — base présumée` apparaisse (~253). Les libellés
`weaponTermLabel` étant distincts pour `level`, `promotion` et `overlimit`,
chacun forme un groupe d'un seul terme et reste plat.

- [ ] **Étape 3 : commit**

```bash
git add index.html
git commit -m "refactor: rendre l'aperçu d'arme par la fonction commune

Le bloc de détail était recopié à l'identique dans trois rendus. Le premier
des deux appelants restants passe par statTermsDetails."
```

- [ ] **Étape 4 : remplacer le bloc inline de l'équipement**

Remplacer le bloc équivalent de l'aperçu d'équipement (~5365 à ~5389) par :

```js
        const details = statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit)
            +(term.unit === "flat" ? " points" : ""),
          termProvenance:gearTermProvenance
        });
```

`termEmphasis` est volontairement omis : ce panneau n'a jamais mis de terme en
avant, et le lot ne change pas ce comportement. Son `termValue` n'a pas de
branche `multiply` parce que l'ancien bloc n'en avait pas non plus — une pièce
d'équipement ne produit que des termes additifs.

- [ ] **Étape 5 : lancer la boucle courte**

```bash
node tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
```

Attendu : les trois passent.

- [ ] **Étape 6 : vérifier qu'aucun bloc inline ne subsiste**

```bash
grep -n "weapon-stat-details" index.html
```

Attendu : les occurrences restantes sont la règle CSS (~1317) et l'unique
`statTermsDetails` (~4234). Aucun autre `el("details",{class:"weapon-stat-details"}`.

- [ ] **Étape 7 : commit**

```bash
git add index.html
git commit -m "refactor: rendre l'aperçu d'équipement par la fonction commune

Plus aucun bloc de détail inline ne subsiste : une correction d'affichage ne
doit plus être faite trois fois."
```

---

### Tâche 5 : régression Merlin et vérification finale

**Fichiers :**
- Modifier : `tests/stats-build.test.js`
- Modifier : `tests/accessibilite-mobile.playwright.js` (~1146, motif de boucle
  320/390 px existant)
- Modifier : `AGENTS.md`

**Interfaces :**
- Consomme : `merlinGameFixture(hooks)` (déjà présent,
  `tests/stats-build.test.js` ~57), `calculateHeroStats`,
  `groupBuildStatResults`, `statTermGroups`, `statTermsDetails`,
  `heroTermLabel`, `heroTermValue`.

- [ ] **Étape 1 : écrire le test de régression qui échoue**

```js
// Rendu attendu du détail des PV pour le build Supabase de Merlin Foudre.
// Valeurs relevées sur la sortie réelle de calculateHeroStats() :
// (2000 + 1248 + 3024 + 3024 + 60338) × 1,41 = 98 183,94 → 98 184.
function testMerlinHpDetailRendering(hooks){
  const hero = merlinGameFixture(hooks);
  const result = plain(hooks.calculateHeroStats(hero));
  const stat = hooks.groupBuildStatResults(result)
    .flatMap(group => group.stats)
    .find(item => item.stat === "B_MaxHp");
  assert.ok(stat, "Les PV doivent être présents dans les totaux");

  const node = hooks.statTermsDetails(stat, {
    termLabel:hooks.heroTermLabel,
    termValue:hooks.heroTermValue,
    termProvenance:() => "",
    termEmphasis:term => term.operation === "multiply"
      ? "weapon-stat-term-overlimit" : ""
  });

  const renderedIds = fakeNodes(node, item =>
    (item.className || "").split(" ").includes("weapon-stat-term")
  ).map(item => item.dataset.termId);
  const engineTermIds = stat.terms.map(term => term.id);

  assert.deepStrictEqual(
    renderedIds.slice().sort(),
    engineTermIds.slice().sort(),
    "Correspondance un-à-un entre nœuds rendus et termes du moteur"
  );
  assert.strictEqual(
    new Set(engineTermIds).size,
    engineTermIds.length,
    "Les identifiants du moteur doivent être uniques"
  );

  // Les chiffres, pas seulement les libellés : c'est ce que la spec fige.
  assert.strictEqual(stat.value, 98184, "Total des PV du build mesuré");
  const groups = plain(hooks.statTermGroups(stat, {
    termLabel:hooks.heroTermLabel
  }));
  const shape = groups.map(group => [
    group.label, group.mainRate, group.terms.length, group.value
  ]);
  [
    ["Base du personnage", false, 1, 2000],
    ["Maîtrise commune", false, 1, 1248],
    ["Maîtrise Baguette", false, 8, 3024],
    ["Maîtrises de réserve", false, 8, 3024],
    ["Équipement", false, 4, 60338],
    ["Maîtrise Baguette", true, 4, 1200],
    ["Maîtrises de réserve", true, 8, 2400],
    ["Potentiel P7", true, 1, 500]
  ].forEach(expected => {
    assert.ok(
      shape.some(actual =>
        actual.every((value, index) => value === expected[index])
      ),
      "Groupe attendu absent ou différent : "+JSON.stringify(expected)
        +" — obtenu "+JSON.stringify(shape)
    );
  });
  assert.strictEqual(
    groups.filter(group => group.mainRate)
      .reduce((sum, group) => sum + group.value, 0),
    4100,
    "12 % + 24 % + 5 % = 41 % de taux principaux"
  );

  const text = fakeText(node);
  assert.ok(
    !text.includes("Application du taux"),
    "Plus aucune ligne indistincte « Application du taux »"
  );
  assert.ok(
    !/×1,0\d/.test(text),
    "Les taux principaux ne s'écrivent plus en notation multiplicative"
  );
  assert.strictEqual(
    (text.match(/Appliqué à :/g) || []).length,
    new Set(
      stat.terms
        .filter(term => term.operation === "multiply")
        .map(term => [...term.appliesTo].sort().join(","))
    ).size,
    "Une note de seaux par base visée, ni plus ni moins"
  );
}
```

Appeler `testMerlinHpDetailRendering(hooks);` avec les autres.

- [ ] **Étape 2 : lancer le test**

```bash
node tests/stats-build.test.js
```

Si une assertion échoue sur un libellé ou un nombre, **corriger l'implémentation
si elle est fautive, ou corriger l'attendu si la mesure du propriétaire est plus
fine que la spec** — mais ne jamais assouplir l'assertion de correspondance
un-à-un, qui est l'invariant du lot.

- [ ] **Étape 3 : prouver que l'assertion mord**

Dans `statTermNode`, remplacer `termId:term.id` par `termId:"x"`, relancer,
vérifier l'échec de `deepStrictEqual`, puis rétablir.

- [ ] **Étape 3 bis : test de débordement à 320 et 390 px**

La spec exige ce contrôle dans les tests, pas seulement à l'œil. Ajouter dans
`tests/accessibilite-mobile.playwright.js`, en suivant le motif de la boucle
existante (~1146) :

```js
    for(const width of [320, 390]){
      const detailContext = await browser.newContext({
        viewport:{width,height:844},
        isMobile:true,
        hasTouch:true,
        reducedMotion:"reduce"
      });
      const detailPage = await detailContext.newPage();
      await detailPage.route(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*",
        route => route.fulfill({
          status:200,
          contentType:"application/javascript",
          body:"window.supabase=undefined;"
        })
      );
      await detailPage.goto(
        pathToFileURL(path.resolve(__dirname, "..", "index.html")).href
      );

      await detailPage.locator(".weapon-config-open").first().click();
      await detailPage.locator("#weaponConfigPreview .weapon-stat-details summary")
        .first().click();
      // Déplier tous les groupes : c'est replié que rien ne déborde jamais.
      await detailPage.evaluate(() => {
        document.querySelectorAll("#weaponConfigPreview details")
          .forEach(node => { node.open = true; });
      });

      const metrics = await detailPage.evaluate(() => {
        const root = document.scrollingElement;
        const summaries = [...document.querySelectorAll(
          "#weaponConfigPreview .weapon-stat-details summary,"
          +" #weaponConfigPreview .stat-term-group>summary"
        )];
        return {
          overflow:root.scrollWidth - root.clientWidth,
          shortestSummary:summaries.reduce(
            (smallest, node) => Math.min(
              smallest,
              Math.round(node.getBoundingClientRect().height)
            ),
            Infinity
          ),
          summaryCount:summaries.length
        };
      });

      assert.ok(
        metrics.summaryCount > 0,
        `Le détail du calcul doit être rendu à ${width}px`
      );
      assert.ok(
        metrics.overflow <= 2,
        `Aucun débordement horizontal à ${width}px `
          +`(mesuré ${metrics.overflow}px)`
      );
      assert.ok(
        metrics.shortestSummary >= 44,
        `Les replis gardent une cible tactile de 44px à ${width}px `
          +`(mesuré ${metrics.shortestSummary}px)`
      );

      await detailContext.close();
    }
```

Lancer :

```bash
node tests/accessibilite-mobile.playwright.js
```

Attendu : PASS. Si le débordement dépasse 2 px, la cause est presque toujours la
ligne de provenance : vérifier que `.weapon-stat-provenance` et
`.stat-term-buckets` portent bien `overflow-wrap:anywhere`.

- [ ] **Étape 4 : documenter dans AGENTS.md**

Dans la section « Stats de builds — lot 3A », ajouter une sous-section :

```markdown
### Détail du calcul : regroupement d'affichage

`statTermsDetails(stat, { termLabel, termValue, termProvenance, termEmphasis })`
est le seul rendu du bloc « Détail du calcul ». Les trois appelants (fiche du
héros, aperçu d'arme, aperçu d'équipement) lui passent leurs fonctions.

`termValue` existe parce que la colonne de droite diffère réellement : le
panneau d'arme y met `weaponTermLabel(term)` en entier, soit
`Outrepassement ×1,05 — base présumée`, là où la fiche du héros n'y met que le
facteur. `tests/potentiel-commun.playwright.js` compare ce texte exactement.

`statTermGroups()` regroupe deux termes seulement s'ils produiraient la même
ligne. La clé est le sextuplet
`(libellé, operation, unit, appliesTo trié, emphase, mainRate)`. Les seaux en
font partie parce qu'un multiplicateur s'applique à la base qu'il vise : sommer
deux taux de seaux différents afficherait un total appliqué à une base
inexistante. Pour la même raison, le rendu produit **un bloc « Taux
principaux » par `appliesTo` distinct**, jamais un bloc unique.

Invariant : **un nœud `.weapon-stat-term` par terme du moteur**, portant
`data-term-id`. Les groupes sont des conteneurs supplémentaires. Un `<summary>`
ne porte jamais cette classe, et un groupe d'un seul terme n'introduit aucun
repli — sans quoi `tests/potentiel-commun.playwright.js` casse, car il n'ouvre
qu'un seul niveau avant d'exiger « Promotion » visible.

Les taux principaux (`source.application === "hero-main-rate"`) s'écrivent en
pourcentage additif ; tout autre multiplicateur garde sa notation, notamment
`Outrepassement ×1,05 — base présumée`.
```

- [ ] **Étape 5 : suite complète**

```bash
npm test
git diff --check
git status --short
```

Attendu : `npm test` en code de retour 0, `git diff --check` sans sortie.

- [ ] **Étape 6 : commit**

```bash
git add tests/stats-build.test.js tests/accessibilite-mobile.playwright.js AGENTS.md
git commit -m "test: figer le rendu du détail des PV de Merlin

Le build mesuré sert de régression : correspondance un-à-un entre nœuds
rendus et termes du moteur, libellés attendus présents, et disparition de la
notation multiplicative sur les taux principaux."
```

---

## Vérification manuelle avant fusion

Ces points ne sont pas couverts par les tests automatiques et demandent un
regard.

- [ ] Ouvrir `index.html` par double-clic, aller sur le roster, ouvrir le détail
      des PV de Merlin : le bloc tient en une dizaine de lignes.
- [ ] Déplier « Taux principaux » : les sous-lignes portent des noms distincts.
- [ ] Vérifier à l'œil qu'aucun texte ne se chevauche à 320 px — le test
      automatique mesure le débordement et la hauteur des cibles, pas la
      superposition.
- [ ] Le panneau d'équipement n'a aucun terme mis en avant, comme avant le lot.
