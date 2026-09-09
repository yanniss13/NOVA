# Rotation d'équipe — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au créateur d'une équipe de composer sa rotation en tapant des icônes de compétence, et aux autres membres de la lire dans la modale de détail.

**Architecture:** La rotation est une liste plate d'appuis stockée dans l'équipe (blob `jsonb` existant, aucune migration). Un module métier pur la replie en cases `×N` et résout chaque étape contre les héros de l'équipe. Une vue à deux modes — lecture ou édition selon `canManageTeam` — vit dans la modale de détail. Les compétences combinées viennent d'une table du jeu extraite en catalogue commité.

**Tech Stack:** JavaScript ES modules, sans framework. Tests unitaires `node:assert` lancés par `node tests/<fichier>.test.js`. Tests de bout en bout Playwright. Aucune dépendance nouvelle.

**Spec:** `docs/superpowers/specs/2026-09-09-rotation-equipe-design.md`

## Global Constraints

- **Le dépôt est en CRLF.** Tout patch doit respecter les fins de ligne du fichier touché.
- **Les modules métier sont PURS** : ni DOM, ni réseau, ni lecture de `window`. Les catalogues arrivent **par argument**. C'est ce qui permet aux tests d'utiliser les vrais catalogues sans passer par le chargeur `vm`.
- **Portée commune en test** : `tests/helpers/load-app.js` concatène tous les modules dans une seule portée. Un nom de fonction privée doit être unique dans TOUT le projet.
- **Tout module `js/` ajouté** doit être déclaré dans `tests/helpers/modules.js` (dans sa couche) ET dans `CORE_ASSETS` de `sw.js`, sinon `tests/modules-imports.test.js` échoue.
- **Tout export doit avoir un importeur.** `tests/modules-imports.test.js` refuse une sortie que personne n'importe. Une fonction utile aux seuls tests reste non exportée : le chargeur l'atteint par la portée commune.
- **Tout fichier `tests/*.test.js` ajouté** doit être déclaré dans `scripts/lancer-tests.js`.
- **Les fichiers `data/*.js` chargés à la demande ne vont PAS dans `CORE_ASSETS`** — `data/wiki-competences.js` n'y est pas, `data/ultimes-combines.js` n'y va pas non plus.
- **Vocabulaire** : français, un seul mot par chose. `rotation`, `etape`, `case`, `lanceur`, `partenaire`, `orpheline`.
- Suite complète : `npm run test:unit` (95 fichiers) et `npm run test:e2e` (23 parcours). Les deux doivent rester au vert.

---

### Task 1: Le catalogue des compétences combinées

**Files:**
- Create: `outils/fmodel/ecrire-ultimes-combines.js`
- Create: `data/ultimes-combines.js` (produit par l'outil, commité)
- Test: `tests/ultimes-combines-catalogue.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: rien.
- Produces: `window.SEVEN_DS_ULTIMES_COMBINES`, un tableau de `{ lanceur:string, partenaires:string[] }` où `lanceur` et chaque partenaire sont des `gameId` de compétence (`ban_gauntlets_skill_r`).

- [ ] **Step 1: Écrire l'outil d'extraction**

Créer `outils/fmodel/ecrire-ultimes-combines.js` :

```js
/* Ecrit data/ultimes-combines.js a partir de la table du jeu.

   `Skill/CombineSkillTable.json` publie 672 lignes. Le champ
   `Owner_Skill_Tid` EST le lanceur — on ne le deduit pas, la table le dit.
   `Striker_A_Skill_Tid` et `Striker_B_Skill_Tid` portent les partenaires ; le
   second vaut `None` sur les combinaisons a deux heros.

   L'appariement se fait par COMPETENCE, donc par arme : les 21 combinaisons de
   Ban sont toutes `ban_gauntlets_skill_r`. Un Ban au nunchaku n'en lance
   aucune, et c'est la table qui l'interdit, pas une liste ecrite a la main.

   `String_Tid` et `Local_Key` valent `None` : aucune combinaison n'a de nom
   publie. Le catalogue n'en invente pas.

   Lancer : node outils/fmodel/ecrire-ultimes-combines.js
*/
const fs = require('fs');
const path = require('path');

const T = 'C:/Users/yanni/Downloads/FModel/Output/Exports/SevenDeadlySins/Content/Table/';
const racine = path.join(__dirname, '..', '..');

const source = JSON.parse(fs.readFileSync(T + 'Skill/CombineSkillTable.json', 'utf8'));
const lignes = (source[0] && source[0].Rows) || source.Rows || source;

const combinaisons = Object.values(lignes)
  .map(ligne => ({
    lanceur: ligne.Owner_Skill_Tid,
    partenaires: [ligne.Striker_A_Skill_Tid, ligne.Striker_B_Skill_Tid]
      .filter(tid => tid && tid !== 'None'),
  }))
  .filter(c => c.lanceur && c.lanceur !== 'None' && c.partenaires.length);

/* Tri stable : le fichier est commite, deux extractions successives ne
   doivent pas produire un diff qui ne dit rien. */
const cle = c => c.lanceur + '|' + c.partenaires.join('|');
combinaisons.sort((a, b) => cle(a).localeCompare(cle(b)));

const entete = [
  '// Genere par outils/fmodel/ecrire-ultimes-combines.js depuis la table',
  '// Skill/CombineSkillTable.json du jeu.',
  '// lanceur = Owner_Skill_Tid, le heros qui declenche. partenaires =',
  '// Striker_A puis Striker_B, un ou deux selon la combinaison.',
  '// Les identifiants portent l ARME : une combinaison n est possible que si',
  '// chaque participant porte l arme citee.',
  '',
].join('\n');

fs.writeFileSync(
  path.join(racine, 'data', 'ultimes-combines.js'),
  entete + 'window.SEVEN_DS_ULTIMES_COMBINES = '
    + JSON.stringify(combinaisons, null, 1) + ';\n'
);

const ultimes = combinaisons.filter(c => /_skill_r$/.test(c.lanceur));
console.log('combinaisons ecrites :', combinaisons.length);
console.log('  dont lanceur a l ultime :', ultimes.length);
console.log('  dont trois heros :', combinaisons.filter(c => c.partenaires.length === 2).length);
```

- [ ] **Step 2: Lancer l'outil**

Run: `node outils/fmodel/ecrire-ultimes-combines.js`
Expected: `combinaisons ecrites : 672`, dont `lanceur a l ultime : 219`, dont `trois heros : 216`.

Si le chemin `T` n'existe pas sur la machine, le fichier `data/ultimes-combines.js` est déjà commité : passer à l'étape suivante sans relancer l'outil.

- [ ] **Step 3: Écrire le test du catalogue**

Créer `tests/ultimes-combines-catalogue.test.js` :

```js
"use strict";

/* Le catalogue des compétences combinées, lu comme le navigateur : un simple
   fichier de données, sans réseau. Il ne re-extrait RIEN — l'outil dépend d'un
   chemin local hors dépôt, et npm test ne doit pas en dépendre. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "ultimes-combines.js"), "utf8"),
  bac
);
const catalogue = bac.window.SEVEN_DS_ULTIMES_COMBINES;

assert.ok(Array.isArray(catalogue), "le catalogue doit être un tableau");
assert.ok(
  catalogue.length >= 600,
  "catalogue anormalement maigre, reçu : " + catalogue.length
);

const IDENTIFIANT = /^[a-z0-9]+(_[a-z0-9]+)+$/;
catalogue.forEach(entree => {
  assert.match(
    entree.lanceur, IDENTIFIANT,
    "lanceur mal formé : " + entree.lanceur
  );
  assert.ok(
    Array.isArray(entree.partenaires) && entree.partenaires.length >= 1
      && entree.partenaires.length <= 2,
    "une combinaison porte un ou deux partenaires : " + entree.lanceur
  );
  entree.partenaires.forEach(partenaire => {
    assert.match(partenaire, IDENTIFIANT, "partenaire mal formé : " + partenaire);
    assert.notEqual(partenaire, "None", "un None a survécu au filtre");
    assert.notEqual(
      partenaire, entree.lanceur,
      "un héros ne se combine pas avec lui-même : " + entree.lanceur
    );
  });
});

/* LE FAIT QUI FONDE TOUTE LA FONCTIONNALITÉ, et qu'on refuse de perdre.

   L'appariement se fait par compétence, donc par ARME. Les combinaisons de Ban
   sont toutes aux gantelets : un Ban au nunchaku n'en lance aucune. Une liste
   de héros écrite à la main aurait laissé composer une rotation impossible. */
const lanceursDeBan = new Set(
  catalogue.filter(c => c.lanceur.startsWith("ban_")).map(c => c.lanceur)
);
assert.deepEqual(
  [...lanceursDeBan], ["ban_gauntlets_skill_r"],
  "Ban ne lance de combinaison qu'aux gantelets, reçu : " + [...lanceursDeBan]
);

/* Cinq héros seulement lancent un ultime combiné. Le jour où le jeu en ajoute
   un, ce test le dira au lieu de laisser passer un catalogue périmé. */
const lanceursDUltime = new Set(
  catalogue.filter(c => /_skill_r$/.test(c.lanceur))
    .map(c => c.lanceur.split("_")[0])
);
assert.deepEqual(
  [...lanceursDUltime].sort(),
  ["ban", "derieri", "elizabeth", "gowther", "merlin"],
  "lanceurs d'ultime combiné inattendus : " + [...lanceursDUltime].sort()
);

console.log(
  "ultimes-combines : catalogue cohérent (" + catalogue.length
  + " combinaisons, dont "
  + catalogue.filter(c => c.partenaires.length === 2).length + " à trois héros)"
);
```

- [ ] **Step 4: Déclarer le test**

Dans `scripts/lancer-tests.js`, ajouter après la ligne `"node tests/competences-catalogue.test.js",` :

```js
    "node tests/ultimes-combines-catalogue.test.js",
```

- [ ] **Step 5: Lancer le test**

Run: `node tests/ultimes-combines-catalogue.test.js`
Expected: `ultimes-combines : catalogue cohérent (672 combinaisons, dont 216 à trois héros)`

- [ ] **Step 6: Commit**

```bash
git add outils/fmodel/ecrire-ultimes-combines.js data/ultimes-combines.js tests/ultimes-combines-catalogue.test.js scripts/lancer-tests.js
git commit -m "feat(rotation): extraire le catalogue des competences combinees"
```

---

### Task 2: Normalisation et repli en cases

**Files:**
- Create: `js/metier/rotation-equipe.js`
- Create: `tests/rotation-equipe.test.js`
- Modify: `tests/helpers/modules.js`
- Modify: `sw.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: rien (module pur, catalogues par argument).
- Produces:
  - `PLAFOND_ROTATION` = `60` (nombre d'appuis).
  - `normaliserRotation(brut) -> string[]`
  - `etapeCombinee(etape) -> { lanceur:string, partenaires:string[] } | null`
  - `seriesDeLaRotation(rotation) -> [{ etape:string, fois:number, debut:number }]`

- [ ] **Step 1: Écrire les tests**

Créer `tests/rotation-equipe.test.js` :

```js
"use strict";

/* La rotation d'une équipe : une liste plate d'appuis, repliée en cases.

   Le module est PUR — les catalogues arrivent par argument. Les tests lisent
   donc les vrais fichiers de `data/` au lieu de fabriquer un faux catalogue :
   un catalogue inventé fait voir des bugs qui n'existent pas, et rate ceux qui
   existent. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  PLAFOND_ROTATION, etapeCombinee, normaliserRotation, seriesDeLaRotation
} = hooks;

assert.equal(typeof normaliserRotation, "function");
assert.equal(PLAFOND_ROTATION, 60, "le plafond compte les appuis, pas les cases");

/* NORMALISATION : ce qui entre dans Supabase doit être propre, quelle que soit
   la porte d'entrée. */
{
  assert.equal(normaliserRotation(null).length, 0);
  assert.equal(normaliserRotation("ban_cudgel3c_skill_e").length, 0,
    "une chaîne seule n'est pas une rotation");
  assert.equal(normaliserRotation({}).length, 0);

  const propre = normaliserRotation([
    "ban_cudgel3c_skill_e",
    42,
    null,
    "",
    "MAJUSCULES_INTERDITES",
    "ban cudgel3c skill e",
    "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q",
    "@combine:seul",
    "@combine:a_b:c_d:e_f:g_h",
    "ban_cudgel3c_jumpatk"
  ]);
  assert.deepEqual(
    Array.from(propre),
    [
      "ban_cudgel3c_skill_e",
      "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q",
      "ban_cudgel3c_jumpatk"
    ],
    "seuls un identifiant du jeu et une combinaison à deux ou trois passent"
  );

  /* Le plafond mord sur les APPUIS. Une rotation de 200 fois la même
     compétence est une case à l'écran, mais soixante appuis en mémoire. */
  const longue = normaliserRotation(new Array(200).fill("ban_cudgel3c_skill_e"));
  assert.equal(longue.length, PLAFOND_ROTATION);
}

/* LA COMBINAISON : le lanceur est en tête, la table le dit et le format le
   garde. Une combinaison mal formée rend null au lieu de deviner. */
{
  const deux = etapeCombinee(
    "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q"
  );
  assert.equal(deux.lanceur, "ban_gauntlets_skill_r");
  assert.deepEqual(Array.from(deux.partenaires), ["tristan_sworddual_skill_q"]);

  const trois = etapeCombinee(
    "@combine:merlin_staff_skill_r:tristan_sworddual_skill_q:tioreh_book_skill_q"
  );
  assert.equal(trois.partenaires.length, 2, "une combinaison à trois héros");

  assert.equal(etapeCombinee("ban_cudgel3c_skill_e"), null,
    "une compétence ordinaire n'est pas une combinaison");
  assert.equal(etapeCombinee("@combine:seul"), null);
  assert.equal(etapeCombinee(null), null);
}

/* LE REPLI EN CASES. Onze appuis de Meliodas deviennent quatre cases, et
   `debut` garde l'index du premier appui de chaque série — c'est lui qui rend
   les mutations possibles sans stocker de séries. */
{
  const rotation = [
    "meliodas_sword1h_jumpatk",
    "meliodas_sword1h_skill_e",
    "meliodas_sword1h_skill_e",
    "meliodas_sword1h_skill_e",
    "meliodas_sword1h_jumpatk",
    "meliodas_sword1h_skill_e"
  ];
  const series = seriesDeLaRotation(rotation);
  assert.equal(series.length, 4, "quatre cases pour six appuis");
  assert.deepEqual(
    series.map(s => s.fois), [1, 3, 1, 1]
  );
  assert.deepEqual(
    series.map(s => s.debut), [0, 1, 4, 5]
  );

  /* Deux séries identiques SÉPARÉES par autre chose ne se rejoignent pas :
     l'ordre est le message, le fusionner le détruirait. */
  assert.equal(series[1].etape, series[3].etape);
  assert.equal(series.length, 4);

  assert.equal(seriesDeLaRotation([]).length, 0);
  assert.equal(seriesDeLaRotation(null).length, 0);
}

console.log("rotation-equipe.test.js OK");
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/rotation-equipe.test.js`
Expected: FAIL — `AssertionError` sur `typeof normaliserRotation`, qui vaut `undefined`.

- [ ] **Step 3: Écrire le module**

Créer `js/metier/rotation-equipe.js` :

```js
/* La rotation d'une equipe : l'ordre dans lequel son auteur joue.

   C'est un outil de COMMUNICATION, pas une entree du simulateur. Il dit
   « voila comment je joue », et rien de plus.

   Module PUR : ni DOM, ni reseau, ni lecture de `window`. Les catalogues
   arrivent par argument — c'est ce qui permet aux tests d'utiliser les vrais
   fichiers de `data/` plutot qu'un faux catalogue, qui ferait voir des bugs
   inexistants et raterait ceux qui existent.

   LA ROTATION EST UNE LISTE PLATE D'APPUIS, un identifiant par appui. Le repli
   en cases « x5 » est une VUE calculee, jamais un stockage : ranger des series
   poserait un invariant — « jamais deux series voisines identiques » — que
   chaque mutation devrait maintenir, et qu'une seule oubliee casserait en
   silence. Une liste plate n'a aucun invariant, elle est toujours valide. */

  /* Le plafond compte les APPUIS, pas les cases : « E x5 » en consomme cinq.
     Soixante identifiants pesent moins de 2 Ko dans le blob de l'equipe. */
  const PLAFOND_ROTATION = 60;

  const MARQUEUR_COMBINE = "@combine:";

  /* Un identifiant du jeu : des segments minuscules separes par des blancs
     soulignes. Le prefixe `@` d'une combinaison ne peut donc pas entrer en
     collision avec lui. */
  const IDENTIFIANT = /^[a-z0-9]+(_[a-z0-9]+)+$/;

  /* Les participants d'une combinaison, LANCEUR EN TETE. Rend null plutot que
     de deviner : une etape mal formee n'est pas une combinaison approximative,
     c'est une etape a jeter. */
  function etapeCombinee(etape){
    if(typeof etape !== "string" || !etape.startsWith(MARQUEUR_COMBINE)){
      return null;
    }
    const parts = etape.slice(MARQUEUR_COMBINE.length).split(":");
    if(parts.length < 2 || parts.length > 3) return null;
    if(!parts.every(part => IDENTIFIANT.test(part))) return null;
    return { lanceur:parts[0], partenaires:parts.slice(1) };
  }

  function etapeValide(etape){
    if(typeof etape !== "string") return false;
    return etape.startsWith(MARQUEUR_COMBINE)
      ? etapeCombinee(etape) !== null
      : IDENTIFIANT.test(etape);
  }

  /* Ce qui entre dans l'equipe — donc dans Supabase — passe par ici, quelle
     que soit la porte d'entree. */
  function normaliserRotation(brut){
    if(!Array.isArray(brut)) return [];
    return brut.filter(etapeValide).slice(0, PLAFOND_ROTATION);
  }

  /* Les appuis consecutifs identiques, replies en series. `debut` garde
     l'index du premier appui : c'est lui qui rend les mutations possibles sans
     jamais stocker de series. */
  function seriesDeLaRotation(rotation){
    const liste = Array.isArray(rotation) ? rotation : [];
    const series = [];
    liste.forEach((etape, index) => {
      const derniere = series[series.length - 1];
      if(derniere && derniere.etape === etape){
        derniere.fois += 1;
        return;
      }
      series.push({ etape, fois:1, debut:index });
    });
    return series;
  }

export {
  PLAFOND_ROTATION,
  etapeCombinee,
  normaliserRotation,
  seriesDeLaRotation
};
```

- [ ] **Step 4: Déclarer le module**

Dans `tests/helpers/modules.js`, ajouter dans la couche `metier`, juste après `"metier/equipe-modele.js",` :

```js
  /* Pur : la rotation ne connait ni le DOM ni les catalogues, qu'elle recoit
     en argument. */
  "metier/rotation-equipe.js",
```

Dans `sw.js`, ajouter `"./js/metier/rotation-equipe.js",` juste après `"./js/metier/equipe-modele.js",`.

Dans `scripts/lancer-tests.js`, ajouter après `"node tests/essai-enchantements.test.js",` :

```js
    "node tests/rotation-equipe.test.js",
```

- [ ] **Step 5: Exposer les fonctions au chargeur de tests**

Dans `tests/helpers/load-app.js`, dans le bloc `HOOK_EXPORT`, ajouter :

```js
  PLAFOND_ROTATION:typeof PLAFOND_ROTATION === "number"
    ? PLAFOND_ROTATION
    : undefined,
  etapeCombinee:typeof etapeCombinee === "function"
    ? etapeCombinee
    : undefined,
  normaliserRotation:typeof normaliserRotation === "function"
    ? normaliserRotation
    : undefined,
  seriesDeLaRotation:typeof seriesDeLaRotation === "function"
    ? seriesDeLaRotation
    : undefined,
```

- [ ] **Step 6: Lancer les tests**

Run: `node tests/rotation-equipe.test.js && node tests/modules-imports.test.js`
Expected: `rotation-equipe.test.js OK` puis `PASS modules`.

`modules-imports` va refuser les exports que personne n'importe. Tant que la vue n'existe pas, retirer de l'`export` toute fonction non consommée est FAUX : les tâches suivantes les importent. Si le test échoue sur ce motif, passer à la tâche 3 et relancer à la fin de la tâche 5, où `equipe-modele.js` importe `normaliserRotation`.

- [ ] **Step 7: Commit**

```bash
git add js/metier/rotation-equipe.js tests/rotation-equipe.test.js tests/helpers/modules.js tests/helpers/load-app.js sw.js scripts/lancer-tests.js
git commit -m "feat(rotation): normaliser une rotation et la replier en cases"
```

---

### Task 3: La palette et les combinaisons de l'équipe

**Files:**
- Modify: `js/metier/rotation-equipe.js`
- Modify: `tests/rotation-equipe.test.js`

**Interfaces:**
- Consumes: `seriesDeLaRotation`, `etapeCombinee` de la tâche 2.
- Produces:
  - `paletteDeLEquipe(heroes, competences) -> [{ char, arme, competences:[{ gameId, nomFr, categorie, icone }] }]`
  - `combinaisonsDeLEquipe(heroes, competences, combinaisons) -> [{ etape:string, lanceur:string, partenaires:string[] }]`

  `heroes` est le tableau `equipe.heroes` (quatre entrées, certaines vides). `competences` est `window.SEVEN_DS_WIKI_COMPETENCES` — un objet `{ [slugHeros]: [competence] }`. `combinaisons` est `window.SEVEN_DS_ULTIMES_COMBINES`.

- [ ] **Step 1: Écrire les tests**

Dans `tests/rotation-equipe.test.js`, insérer avant `console.log("rotation-equipe.test.js OK");` :

```js
/* LA PALETTE ET LES COMBINAISONS, contre les VRAIS catalogues. */
{
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const racine = path.join(__dirname, "..");
  const lire = fichier => {
    const bac = { window:{} };
    vm.runInNewContext(
      fs.readFileSync(path.join(racine, "data", fichier), "utf8"), bac
    );
    return bac.window;
  };
  const competences = lire("wiki-competences.js").SEVEN_DS_WIKI_COMPETENCES;
  const combinaisons = lire("ultimes-combines.js").SEVEN_DS_ULTIMES_COMBINES;

  const banNunchaku = { char:"ban", weapon:"7ds-armes/Nunchaku/Nunchaku béni.webp" };
  const banGantelets = { char:"ban", weapon:"7ds-armes/Gantelets/Gantelets bénis.webp" };
  const tristan = { char:"tristan", weapon:"7ds-armes/Epees doubles/Epees doubles bénies.webp" };

  /* La palette ne propose que l'arme EQUIPEE, jamais tout le kit du héros. */
  const palette = paletteDeLEquipe([banNunchaku, tristan, {}, {}], competences);
  assert.equal(palette.length, 2, "un héros sans arme n'entre pas dans la palette");
  assert.equal(palette[0].char, "ban");
  assert.equal(palette[0].arme, "Cudgel3c");
  assert.ok(
    palette[0].competences.every(c => /^ban_cudgel3c_/.test(c.gameId)),
    "la palette de Ban au nunchaku ne porte que ses compétences de nunchaku"
  );
  assert.ok(
    palette[0].competences.every(c => c.categorie !== "PASSIVE"),
    "un passif ne se lance pas : il n'a rien à faire dans une rotation"
  );
  assert.ok(
    palette[0].competences.length >= 4,
    "auto, normale, spéciale, ultime au minimum"
  );

  /* LE CŒUR DE LA FONCTIONNALITÉ. Ban ne lance de combinaison qu'aux
     gantelets : au nunchaku, l'équipe n'en propose aucune. */
  const sansCombinaison = combinaisonsDeLEquipe(
    [banNunchaku, tristan, {}, {}], competences, combinaisons
  );
  assert.equal(
    sansCombinaison.length, 0,
    "Ban au nunchaku ne lance aucune combinaison"
  );

  const avecCombinaison = combinaisonsDeLEquipe(
    [banGantelets, tristan, {}, {}], competences, combinaisons
  );
  assert.ok(
    avecCombinaison.length >= 1,
    "Ban aux gantelets avec Tristan aux épées doubles en a une"
  );
  assert.ok(
    avecCombinaison.every(c => c.lanceur === "ban_gauntlets_skill_r"),
    "le lanceur vient de la table, jamais d'un ordre de frappe"
  );
  assert.ok(
    avecCombinaison.every(c => c.etape.startsWith("@combine:" + c.lanceur + ":")),
    "l'étape encode le lanceur en tête"
  );

  /* Une combinaison à trois héros n'est retenue que si les TROIS sont là. */
  const troisIncomplete = combinaisonsDeLEquipe(
    [banGantelets, {}, {}, {}], competences, combinaisons
  );
  assert.equal(
    troisIncomplete.length, 0,
    "sans partenaire, aucune combinaison ne tient"
  );

  assert.equal(combinaisonsDeLEquipe(null, competences, combinaisons).length, 0);
  assert.equal(paletteDeLEquipe(null, competences).length, 0);
}
```

Ajouter les deux noms au `require` en tête du fichier :

```js
const {
  PLAFOND_ROTATION, combinaisonsDeLEquipe, etapeCombinee, normaliserRotation,
  paletteDeLEquipe, seriesDeLaRotation
} = hooks;
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/rotation-equipe.test.js`
Expected: FAIL — `paletteDeLEquipe is not a function`.

- [ ] **Step 3: Implémenter**

Dans `js/metier/rotation-equipe.js`, ajouter avant le bloc `export` :

```js
  /* L'arme EQUIPEE d'un heros, en enum du site. Le roster range ses builds par
     dossier d'image (« Nunchaku »), la source les publie par enum
     (« Cudgel3c ») : FOLDER_TO_ENUM fait le pont, et il existait deja. */
  function armeEquipee(hero){
    const chemin = hero && typeof hero.weapon === "string" ? hero.weapon : "";
    const dossier = chemin.split("/")[1];
    return (dossier && FOLDER_TO_ENUM[dossier]) || null;
  }

  /* La palette d'une equipe : chaque heros avec les competences de l'arme
     qu'il PORTE, jamais tout son kit. Un heros sans arme ni personnage n'a
     rien a proposer et sort de la liste plutot que d'y figurer vide.

     Les passifs sont exclus : on ne les lance pas. */
  function paletteDeLEquipe(heroes, competences){
    const liste = Array.isArray(heroes) ? heroes : [];
    const catalogue = competences || {};
    return liste.reduce((palette, hero) => {
      const char = hero && hero.char;
      const arme = armeEquipee(hero);
      if(!char || !arme) return palette;
      const retenues = (catalogue[char] || [])
        .filter(competence => competence.weaponType === arme
          && competence.categorie !== "PASSIVE");
      if(retenues.length) palette.push({ char, arme, competences:retenues });
      return palette;
    }, []);
  }

  /* Les combinaisons que CETTE equipe peut reellement executer.

     Une ligne du catalogue n'est retenue que si TOUTES ses competences —
     lanceur et partenaires — appartiennent a un heros de l'equipe avec son
     arme equipee. C'est ce qui interdit de composer une rotation impossible :
     les combinaisons de Ban sont toutes aux gantelets, donc un Ban au nunchaku
     n'en obtient aucune.

     Le lanceur vient de la TABLE (`Owner_Skill_Tid`), jamais d'un ordre dans
     lequel le membre aurait tape les portraits. */
  function combinaisonsDeLEquipe(heroes, competences, combinaisons){
    const disponibles = new Set();
    paletteDeLEquipe(heroes, competences).forEach(entree => {
      entree.competences.forEach(competence => disponibles.add(competence.gameId));
    });
    return (Array.isArray(combinaisons) ? combinaisons : [])
      .filter(entree => entree && disponibles.has(entree.lanceur)
        && Array.isArray(entree.partenaires)
        && entree.partenaires.every(partenaire => disponibles.has(partenaire)))
      .map(entree => ({
        etape:MARQUEUR_COMBINE + [entree.lanceur].concat(entree.partenaires).join(":"),
        lanceur:entree.lanceur,
        partenaires:entree.partenaires.slice()
      }));
  }
```

Ajouter en tête du fichier, sous le commentaire d'ouverture :

```js
import { FOLDER_TO_ENUM } from "../noyau/constantes.js";
```

Et compléter l'`export` :

```js
export {
  PLAFOND_ROTATION,
  combinaisonsDeLEquipe,
  etapeCombinee,
  normaliserRotation,
  paletteDeLEquipe,
  seriesDeLaRotation
};
```

- [ ] **Step 4: Exposer au chargeur**

Dans `tests/helpers/load-app.js`, ajouter au bloc `HOOK_EXPORT` :

```js
  paletteDeLEquipe:typeof paletteDeLEquipe === "function"
    ? paletteDeLEquipe
    : undefined,
  combinaisonsDeLEquipe:typeof combinaisonsDeLEquipe === "function"
    ? combinaisonsDeLEquipe
    : undefined,
```

- [ ] **Step 5: Lancer le test**

Run: `node tests/rotation-equipe.test.js`
Expected: `rotation-equipe.test.js OK`

Si le test échoue sur `palette[0].competences.length >= 4`, vérifier que `data/wiki-competences.js` publie bien Ban au nunchaku sous `weaponType: "Cudgel3c"` avec :
`node -e "global.window={};require('./data/wiki-competences.js');console.log(window.SEVEN_DS_WIKI_COMPETENCES.ban.filter(c=>c.weaponType==='Cudgel3c').map(c=>c.categorie).join(' '))"`

- [ ] **Step 6: Commit**

```bash
git add js/metier/rotation-equipe.js tests/rotation-equipe.test.js tests/helpers/load-app.js
git commit -m "feat(rotation): la palette et les combinaisons possibles de l equipe"
```

---

### Task 4: Résolution des cases et mutations

**Files:**
- Modify: `js/metier/rotation-equipe.js`
- Modify: `tests/rotation-equipe.test.js`

**Interfaces:**
- Consumes: `seriesDeLaRotation`, `etapeCombinee`, `paletteDeLEquipe` des tâches 2 et 3.
- Produces:
  - `casesDeLaRotation(rotation, heroes, competences) -> [{ etape, fois, debut, competence, char, participants, orpheline }]`
    - `competence` : l'entrée du wiki, ou `null` pour une combinaison ou une orpheline.
    - `participants` : pour une combinaison, `[{ char, competence }]` lanceur en tête ; sinon `[]`.
    - `orpheline` : `true` quand une des compétences citées n'appartient à aucun héros de l'équipe.
  - `ajouterEtape(rotation, etape) -> string[]`
  - `retirerUne(rotation, indexDeCase) -> string[]`
  - `retirerLaCase(rotation, indexDeCase) -> string[]`
  - `deplacerCase(rotation, de, vers) -> string[]`

  Toutes les mutations rendent un NOUVEAU tableau et ne mutent jamais l'entrée.

- [ ] **Step 1: Écrire les tests**

Dans `tests/rotation-equipe.test.js`, insérer avant `console.log("rotation-equipe.test.js OK");` :

```js
/* LA RÉSOLUTION DES CASES ET LES MUTATIONS. */
{
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const racine = path.join(__dirname, "..");
  const bacWiki = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", "wiki-competences.js"), "utf8"),
    bacWiki
  );
  const competences = bacWiki.window.SEVEN_DS_WIKI_COMPETENCES;

  const equipe = [
    { char:"ban", weapon:"7ds-armes/Nunchaku/Nunchaku béni.webp" },
    { char:"tristan", weapon:"7ds-armes/Epees doubles/Epees doubles bénies.webp" },
    {}, {}
  ];

  const cases = casesDeLaRotation(
    [
      "ban_cudgel3c_skill_e",
      "ban_cudgel3c_skill_e",
      "merlin_staff_skill_e",
      "@combine:ban_gauntlets_skill_r:tristan_sworddual_skill_q"
    ],
    equipe, competences
  );
  assert.equal(cases.length, 3);
  assert.equal(cases[0].fois, 2, "deux appuis de suite font une case ×2");
  assert.equal(cases[0].orpheline, false);
  assert.ok(cases[0].competence, "une case résolue porte sa compétence");
  assert.equal(cases[0].char, "ban");

  /* UNE ÉTAPE ORPHELINE GARDE SA CASE. Merlin n'est pas dans l'équipe : la
     supprimer en silence ferait disparaître le travail du membre sans qu'il
     comprenne pourquoi. Même règle que le catalogue de compétences, où une
     compétence non chiffrable garde sa ligne. */
  assert.equal(cases[1].orpheline, true, "Merlin n'est pas dans cette équipe");
  assert.equal(cases[1].competence, null);

  /* Ban est au nunchaku : la combinaison aux gantelets est orpheline elle
     aussi, et pour la même raison. */
  assert.equal(cases[2].orpheline, true);
  assert.equal(
    cases[2].participants.length, 2,
    "une combinaison orpheline nomme quand même ses participants"
  );
  assert.equal(
    cases[2].participants[0].char, "ban",
    "le lanceur reste en tête, même orphelin"
  );

  assert.equal(casesDeLaRotation([], equipe, competences).length, 0);
  assert.equal(casesDeLaRotation(null, equipe, competences).length, 0);
}

/* LES MUTATIONS : elles portent sur des INDEX DE CASE, jamais d'appui. */
{
  const base = ["a_un", "a_un", "b_deux", "c_trois"];

  const ajoute = ajouterEtape(base, "d_quatre");
  assert.deepEqual(Array.from(ajoute), ["a_un", "a_un", "b_deux", "c_trois", "d_quatre"]);
  assert.deepEqual(Array.from(base), ["a_un", "a_un", "b_deux", "c_trois"],
    "une mutation ne mute jamais son entrée");

  /* Le plafond tient jusque dans l'ajout. */
  const pleine = new Array(60).fill("a_un");
  assert.equal(ajouterEtape(pleine, "b_deux").length, 60,
    "au plafond, un ajout de plus ne passe pas");

  /* −1 sur une série de deux laisse la case à ×1. */
  assert.deepEqual(
    Array.from(retirerUne(base, 0)), ["a_un", "b_deux", "c_trois"]
  );
  /* −1 sur une série de un fait disparaître la case. */
  assert.deepEqual(
    Array.from(retirerUne(base, 1)), ["a_un", "a_un", "c_trois"]
  );
  /* Retirer la case emporte toute la série. */
  assert.deepEqual(
    Array.from(retirerLaCase(base, 0)), ["b_deux", "c_trois"]
  );

  /* Déplacer emporte la série entière, dans les deux sens. */
  assert.deepEqual(
    Array.from(deplacerCase(base, 0, 2)), ["b_deux", "c_trois", "a_un", "a_un"]
  );
  assert.deepEqual(
    Array.from(deplacerCase(base, 2, 0)), ["c_trois", "a_un", "a_un", "b_deux"]
  );

  /* Un index hors bornes ne casse rien et ne change rien. */
  assert.deepEqual(Array.from(deplacerCase(base, 0, 9)), Array.from(base));
  assert.deepEqual(Array.from(deplacerCase(base, -1, 0)), Array.from(base));
  assert.deepEqual(Array.from(retirerUne(base, 9)), Array.from(base));
  assert.deepEqual(Array.from(retirerLaCase(base, 9)), Array.from(base));
}
```

Compléter le `require` en tête :

```js
const {
  PLAFOND_ROTATION, ajouterEtape, casesDeLaRotation, combinaisonsDeLEquipe,
  deplacerCase, etapeCombinee, normaliserRotation, paletteDeLEquipe,
  retirerLaCase, retirerUne, seriesDeLaRotation
} = hooks;
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/rotation-equipe.test.js`
Expected: FAIL — `casesDeLaRotation is not a function`.

- [ ] **Step 3: Implémenter**

Dans `js/metier/rotation-equipe.js`, ajouter avant le bloc `export` :

```js
  /* L'index des competences que l'equipe porte REELLEMENT, du gameId vers son
     heros et sa fiche. C'est lui qui decide si une etape est orpheline. */
  function indexDeLEquipe(heroes, competences){
    const index = new Map();
    paletteDeLEquipe(heroes, competences).forEach(entree => {
      entree.competences.forEach(competence => {
        index.set(competence.gameId, { char:entree.char, competence });
      });
    });
    return index;
  }

  /* Les cases affichables : les series, resolues contre l'equipe.

     UNE ETAPE QUE L'EQUIPE NE PORTE PLUS GARDE SA CASE, marquee orpheline. La
     supprimer en silence ferait disparaitre le travail du membre sans qu'il
     comprenne pourquoi — c'est la meme regle que le catalogue de competences,
     ou une competence non chiffrable garde sa ligne au lieu d'etre tue. */
  function casesDeLaRotation(rotation, heroes, competences){
    const index = indexDeLEquipe(heroes, competences);
    const nomme = gameId => {
      const trouve = index.get(gameId);
      return {
        gameId,
        char:trouve ? trouve.char : null,
        competence:trouve ? trouve.competence : null
      };
    };
    return seriesDeLaRotation(rotation).map(serie => {
      const combinee = etapeCombinee(serie.etape);
      if(combinee){
        const participants = [combinee.lanceur]
          .concat(combinee.partenaires).map(nomme);
        return Object.assign({}, serie, {
          competence:null,
          char:null,
          participants,
          orpheline:participants.some(part => !part.competence)
        });
      }
      const trouve = index.get(serie.etape) || null;
      return Object.assign({}, serie, {
        competence:trouve ? trouve.competence : null,
        char:trouve ? trouve.char : null,
        participants:[],
        orpheline:!trouve
      });
    });
  }

  /* LES MUTATIONS portent sur un index de CASE, jamais d'appui : c'est ce que
     le membre voit et touche. Elles rendent toujours un nouveau tableau — une
     rotation mutee sur place echapperait au bouton « Annuler ». */
  function ajouterEtape(rotation, etape){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    if(!etapeValide(etape) || liste.length >= PLAFOND_ROTATION) return liste;
    liste.push(etape);
    return liste;
  }

  function serieVisee(rotation, indexDeCase){
    const series = seriesDeLaRotation(rotation);
    const serie = series[indexDeCase];
    return serie && indexDeCase >= 0 ? serie : null;
  }

  function retirerUne(rotation, indexDeCase){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    const serie = serieVisee(liste, indexDeCase);
    if(!serie) return liste;
    liste.splice(serie.debut, 1);
    return liste;
  }

  function retirerLaCase(rotation, indexDeCase){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    const serie = serieVisee(liste, indexDeCase);
    if(!serie) return liste;
    liste.splice(serie.debut, serie.fois);
    return liste;
  }

  function deplacerCase(rotation, de, vers){
    const liste = Array.isArray(rotation) ? rotation.slice() : [];
    const series = seriesDeLaRotation(liste);
    if(de < 0 || vers < 0 || de >= series.length || vers >= series.length){
      return liste;
    }
    if(de === vers) return liste;
    const bougee = series[de];
    const restantes = series.slice(0, de).concat(series.slice(de + 1));
    restantes.splice(vers, 0, bougee);
    return restantes.reduce(
      (plate, serie) => plate.concat(new Array(serie.fois).fill(serie.etape)),
      []
    );
  }
```

Compléter l'`export` :

```js
export {
  PLAFOND_ROTATION,
  ajouterEtape,
  casesDeLaRotation,
  combinaisonsDeLEquipe,
  deplacerCase,
  etapeCombinee,
  normaliserRotation,
  paletteDeLEquipe,
  retirerLaCase,
  retirerUne,
  seriesDeLaRotation
};
```

- [ ] **Step 4: Exposer au chargeur**

Dans `tests/helpers/load-app.js`, ajouter au bloc `HOOK_EXPORT` une entrée par fonction, sur le modèle des précédentes : `casesDeLaRotation`, `ajouterEtape`, `retirerUne`, `retirerLaCase`, `deplacerCase`.

- [ ] **Step 5: Lancer le test**

Run: `node tests/rotation-equipe.test.js`
Expected: `rotation-equipe.test.js OK`

- [ ] **Step 6: Commit**

```bash
git add js/metier/rotation-equipe.js tests/rotation-equipe.test.js tests/helpers/load-app.js
git commit -m "feat(rotation): resoudre les cases et muter la rotation"
```

---

### Task 5: La rotation entre dans le modèle d'équipe

**Files:**
- Modify: `js/metier/equipe-modele.js`
- Modify: `tests/equipe-modele.test.js`

**Interfaces:**
- Consumes: `normaliserRotation` de la tâche 2.
- Produces: `normalizeTeam(raw).rotation` — toujours un tableau, toujours propre.

- [ ] **Step 1: Écrire le test**

Dans `tests/equipe-modele.test.js`, insérer avant la ligne `console.log(` finale :

```js
/* LA ROTATION D'ÉQUIPE.

   Elle voyage dans le blob `jsonb` de `public.teams.data`, donc aucune
   migration — mais c'est aussi pourquoi elle doit être nettoyée ICI : c'est le
   seul passage obligé avant Supabase, quelle que soit la porte d'entrée. */
{
  const propre = normalizeTeam({
    heroes:[],
    rotation:["ban_cudgel3c_skill_e", 42, "PAS BON", null]
  });
  assert.deepEqual(
    Array.from(propre.rotation), ["ban_cudgel3c_skill_e"],
    "les saletés ne partent pas vers Supabase"
  );

  const absente = normalizeTeam({ heroes:[] });
  assert.ok(
    Array.isArray(absente.rotation) && absente.rotation.length === 0,
    "une équipe sans rotation en porte une vide, jamais undefined"
  );

  const invalide = normalizeTeam({ heroes:[], rotation:"ban_cudgel3c_skill_e" });
  assert.equal(
    invalide.rotation.length, 0,
    "une chaîne n'est pas une rotation"
  );
}
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/equipe-modele.test.js`
Expected: FAIL — `propre.rotation` vaut le tableau brut, saletés comprises.

- [ ] **Step 3: Implémenter**

Dans `js/metier/equipe-modele.js`, ajouter l'import en tête, après les autres imports :

```js
import { normaliserRotation } from "./rotation-equipe.js";
```

Puis, dans `normalizeTeam`, ajouter `rotation` à l'objet rendu :

```js
  function normalizeTeam(raw){
    const t = raw && typeof raw === "object" ? raw : {};
    const heroes = Array.isArray(t.heroes) ? t.heroes.slice(0, TEAM_SIZE) : [];
    while(heroes.length < TEAM_SIZE) heroes.push({});
    return Object.assign({}, t, {
      name:normalizeTeamName(t.name),
      heroes:heroes.map(normalizeHero),
      /* La rotation voyage dans le meme blob que le reste de l'equipe. C'est
         le seul passage obligé avant Supabase : la nettoyer ici la nettoie
         pour toutes les portes d'entree a la fois. */
      rotation:normaliserRotation(t.rotation)
    });
  }
```

- [ ] **Step 4: Lancer les tests**

Run: `node tests/equipe-modele.test.js && node tests/modules-imports.test.js`
Expected: les deux passent. `modules-imports` accepte désormais l'export `normaliserRotation`, qui a un importeur.

- [ ] **Step 5: Vérifier qu'aucune équipe existante ne casse**

Run: `npm run test:unit`
Expected: 96/96 au vert (95 d'origine + `rotation-equipe.test.js` ; `ultimes-combines-catalogue.test.js` porte le total à 97).

- [ ] **Step 6: Commit**

```bash
git add js/metier/equipe-modele.js tests/equipe-modele.test.js
git commit -m "feat(rotation): la rotation entre dans le modele d equipe"
```

---

### Task 6: Le chargeur du catalogue wiki, extrait et partagé

**Files:**
- Create: `js/donnees/catalogue-wiki.js`
- Modify: `js/vues/wiki.js:88-118`
- Modify: `tests/helpers/modules.js`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `el` de `js/noyau/dom.js`.
- Produces: `chargerCatalogueWiki() -> Promise<true>` et `catalogueWikiPret() -> boolean`. Après résolution, `window.SEVEN_DS_WIKI_COMPETENCES` et `window.SEVEN_DS_ULTIMES_COMBINES` sont posés.

- [ ] **Step 1: Créer le module**

Créer `js/donnees/catalogue-wiki.js` :

```js
/* Le chargement A LA DEMANDE des catalogues du wiki.

   `wiki-competences.js` pese 230 Ko : le charger au demarrage le ferait payer
   a chaque visiteur qui n'ouvre ni le wiki ni une rotation d'equipe.

   Ce module vit dans `donnees` et non dans `metier` parce qu'il TOUCHE le
   reseau et le document. Il a ete extrait de vues/wiki.js le jour ou la modale
   de detail d'une equipe en a eu besoin a son tour — deux chargeurs auraient
   fini par diverger sur ce qui est bloquant et ce qui ne l'est pas, qui est
   justement la seule chose subtile ici. */

import { el } from "../noyau/dom.js";

  /* Nomme LONG a dessein : le chargeur `vm` des tests concatene tous les
     modules dans une portee commune, ou un `chargement` tout court entrerait
     en collision avec son homonyme d'un autre module. */
  let chargementCatalogueWiki = null;

  function scriptDeCatalogue(src){
    return new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src,
        onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable : " + src))
      }));
    });
  }

  function catalogueWikiPret(){
    return Boolean(typeof window !== "undefined"
      && window.SEVEN_DS_WIKI_COMPETENCES);
  }

  /* Les competences sont BLOQUANTES : sans elles, ni fiche de heros ni
     rotation. Les transcendances et les combinaisons ne le sont PAS — elles
     viennent d'une extraction locale du jeu, et le jour ou l'une manque, la
     page doit perdre une section, pas son onglet. */
  function chargerCatalogueWiki(){
    if(catalogueWikiPret()) return Promise.resolve(true);
    if(chargementCatalogueWiki) return chargementCatalogueWiki;
    chargementCatalogueWiki = Promise.all([
      scriptDeCatalogue("./data/wiki-competences.js"),
      scriptDeCatalogue("./data/transcendances.js").catch(()=>false),
      scriptDeCatalogue("./data/ultimes-combines.js").catch(()=>false)
    ]).then(()=>true).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner la page pour toute
         la duree de la session. */
      chargementCatalogueWiki = null;
      throw erreur;
    });
    return chargementCatalogueWiki;
  }

export { catalogueWikiPret, chargerCatalogueWiki };
```

- [ ] **Step 2: Brancher `wiki.js` dessus**

Dans `js/vues/wiki.js`, supprimer la fonction privée `scriptDeDonnees` (lignes 88-96) et la fonction `chargerCatalogue` (lignes 105-118), puis ajouter l'import :

```js
import { chargerCatalogueWiki } from "../donnees/catalogue-wiki.js";
```

Remplacer chaque appel `chargerCatalogue()` par `chargerCatalogueWiki()`.

- [ ] **Step 3: Déclarer le module**

Dans `tests/helpers/modules.js`, ajouter dans la couche `donnees`, après `"donnees/catalogues-dps.js",` :

```js
  /* Charge a la demande le catalogue du wiki : l'onglet Wiki et la rotation
     d'equipe y passent tous les deux. */
  "donnees/catalogue-wiki.js",
```

Dans `sw.js`, ajouter `"./js/donnees/catalogue-wiki.js",` après `"./js/donnees/catalogues-dps.js",`.

- [ ] **Step 4: Vérifier que le wiki n'a pas régressé**

Run: `node tests/modules-imports.test.js && node tests/wiki.playwright.js && node tests/wiki-lot2.playwright.js`
Expected: les trois passent. Les deux parcours Playwright du wiki couvrent la grille, les filtres et la fiche de héros — c'est-à-dire tout ce qui dépend du chargeur qu'on vient de déplacer.

- [ ] **Step 5: Commit**

```bash
git add js/donnees/catalogue-wiki.js js/vues/wiki.js tests/helpers/modules.js sw.js
git commit -m "refactor(wiki): sortir le chargeur de catalogue de la vue"
```

---

### Task 7: Le bloc en lecture

**Files:**
- Create: `js/vues/rotation-equipe.js`
- Modify: `js/vues/detail-equipe.js`
- Modify: `css/modales.css`
- Modify: `tests/helpers/modules.js`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `casesDeLaRotation` (tâche 4), `chargerCatalogueWiki` / `catalogueWikiPret` (tâche 6), `canManageTeam` de `js/etat/session.js`, `charOf` de `js/metier/catalogue.js`, `el` de `js/noyau/dom.js`.
- Produces: `suiteDesCases(items) -> HTMLElement` — la liste `<ol>` des cases, en lecture seule. La tâche 8 lui ajoutera un second argument `actions` et cessera de l'exporter : elle ne servira plus qu'à `blocRotation`, dans le même fichier.

- [ ] **Step 1: Créer la vue en lecture**

Créer `js/vues/rotation-equipe.js` :

```js
/* La rotation d'une equipe, a l'ecran.

   Un seul composant, deux modes : lecture pour qui consulte l'equipe d'un
   autre, edition pour son auteur. Deux composants auraient fini par diverger
   sur le rendu d'une case, qui est exactement ce qu'on veut identique.

   Le catalogue du wiki arrive a la demande : le bloc s'affiche d'abord en
   attente, puis se redessine. */

import { el } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { casesDeLaRotation } from "../metier/rotation-equipe.js";

  /* Le portrait d'un heros, en medaillon. `charOf` rend null pour un
     personnage retire du catalogue : la case reste, sans image. */
  function medaillon(char){
    const fiche = char ? charOf(char) : null;
    const cadre = el("span",{ class:"rota-portrait" });
    if(fiche){
      cadre.appendChild(el("img",{
        src:fiche.file, alt:fiche.name, loading:"lazy"
      }));
    }
    return cadre;
  }

  function iconeDeCompetence(competence){
    return competence && competence.icone
      ? el("img",{
          class:"rota-icone",
          src:"7ds-ui/skills/" + competence.icone,
          alt:competence.nomFr || "",
          loading:"lazy"
        })
      : el("span",{ class:"rota-icone rota-icone-absente", text:"?" });
  }

  /* Une case ORDINAIRE : le portrait du heros, l'icone de sa competence, et
     « xN » quand la serie en compte plusieurs.

     Le multiplicateur est ECRIT, jamais porte par la seule couleur. */
  function caseCompetence(item){
    const enfants = [medaillon(item.char), iconeDeCompetence(item.competence)];
    if(item.fois > 1){
      enfants.push(el("span",{ class:"rota-fois", text:"×" + item.fois }));
    }
    return enfants;
  }

  /* Une case COMBINEE : les portraits des participants, lanceur en premier et
     plus grand. Elle ne doit pas se lire comme la competence d'un heros — le
     cadre la distingue, et le titre nomme le lanceur. */
  function caseCombinee(item){
    const portraits = el("span",{ class:"rota-combine-portraits" },
      item.participants.map((part, rang) => {
        const cadre = medaillon(part.char);
        cadre.classList.add(rang === 0 ? "rota-lanceur" : "rota-partenaire");
        return cadre;
      })
    );
    const enfants = [portraits];
    if(item.fois > 1){
      enfants.push(el("span",{ class:"rota-fois", text:"×" + item.fois }));
    }
    return enfants;
  }

  function nomDuHeros(char){
    const fiche = char ? charOf(char) : null;
    return fiche ? fiche.name : "héros absent";
  }

  function titreDeLaCase(item){
    if(item.participants.length){
      const noms = item.participants.map(part => nomDuHeros(part.char));
      return "Combinaison — " + noms[0] + " lance, avec "
        + noms.slice(1).join(" et ")
        + (item.orpheline ? " (absente de l'équipe)" : "");
    }
    const nom = item.competence ? item.competence.nomFr : "compétence inconnue";
    return nomDuHeros(item.char) + " — " + nom
      + (item.orpheline ? " (absente de l'équipe)" : "");
  }

  function caseDeRotation(item){
    const classe = "rota-case"
      + (item.participants.length ? " rota-case-combine" : "")
      + (item.orpheline ? " rota-case-orpheline" : "");
    return el("li",{ class:classe, title:titreDeLaCase(item) },
      item.participants.length ? caseCombinee(item) : caseCompetence(item));
  }

  function suiteDesCases(items){
    return el("ol",{ class:"rota-suite" }, items.map(caseDeRotation));
  }

export { suiteDesCases };
```

- [ ] **Step 2: Écrire le style**

Dans `css/modales.css`, ajouter à la fin :

```css
/* LA ROTATION D'UNE ÉQUIPE.

   Les cases se lisent en ligne et repassent à la ligne : une rotation de
   quinze cases ne doit jamais forcer un défilement horizontal sur mobile. */
.rota{margin-top:18px;display:flex;flex-direction:column;gap:10px}
.rota-titre{margin:0;font-size:15px}
.rota-suite{
  list-style:none;margin:0;padding:0;
  display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end
}
.rota-case{
  position:relative;display:flex;flex-direction:column;align-items:center;
  gap:2px;padding:4px;border:1px solid var(--line-soft);border-radius:8px;
  background:var(--panel)
}
.rota-portrait{
  display:block;width:26px;height:26px;border-radius:50%;overflow:hidden;
  background:var(--line-soft);flex:none
}
.rota-portrait img{width:100%;height:100%;object-fit:cover}
.rota-icone{display:block;width:34px;height:34px}
.rota-icone-absente{
  display:grid;place-items:center;color:var(--muted);font-weight:700
}
.rota-fois{font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}

/* Une COMBINAISON est une action d'équipe, pas la compétence d'un héros : son
   cadre le dit, et le lanceur est plus grand que ses partenaires. */
.rota-case-combine{border-color:var(--gold);border-style:dashed}
.rota-combine-portraits{display:flex;align-items:center;gap:2px}
.rota-combine-portraits .rota-lanceur{width:34px;height:34px}
.rota-combine-portraits .rota-partenaire{width:22px;height:22px}

/* Une case ORPHELINE — le héros a quitté l'équipe ou changé d'arme. Elle reste
   affichée : la supprimer en silence ferait disparaître le travail du membre.
   La marque ne repose pas sur la seule couleur, le titre la porte aussi. */
.rota-case-orpheline{opacity:.55;border-style:dotted}
.rota-case-orpheline::after{
  content:"!";position:absolute;top:-6px;right:-6px;
  width:14px;height:14px;border-radius:50%;
  background:var(--crimson);color:#fff;font-size:10px;font-weight:700;
  display:grid;place-items:center
}
```

- [ ] **Step 3: Brancher la modale**

Dans `js/vues/detail-equipe.js`, ajouter les imports :

```js
import { catalogueWikiPret, chargerCatalogueWiki } from "../donnees/catalogue-wiki.js";
import { casesDeLaRotation } from "../metier/rotation-equipe.js";
import { suiteDesCases } from "./rotation-equipe.js";
```

Puis ajouter la fonction avant `openTeamDetail` :

```js
  /* LE BLOC DE ROTATION.

     Il ne s'affiche PAS quand l'equipe n'en a pas et que le visiteur ne peut
     pas en poser : une section vide chez quelqu'un qui ne peut rien y faire
     n'est que du bruit.

     Le catalogue du wiki arrive a la demande — 230 Ko qu'un visiteur qui
     n'ouvre aucune equipe ne doit pas payer. Le bloc s'affiche donc d'abord en
     attente, puis se redessine une fois le catalogue la. */
  function sectionRotation(equipe){
    const rotation = (equipe && equipe.rotation) || [];
    if(!rotation.length && !canManageTeam(equipe)) return null;
    const section = el("section",{ class:"rota" },[
      el("h3",{ class:"rota-titre", text:"Rotation" })
    ]);
    const corps = el("div");
    section.appendChild(corps);

    const dessiner = () => {
      corps.innerHTML = "";
      if(!catalogueWikiPret()){
        corps.appendChild(el("p",{ class:"calc-muette",
          text:"Chargement des compétences…" }));
        return;
      }
      const items = casesDeLaRotation(
        rotation, equipe.heroes || [],
        window.SEVEN_DS_WIKI_COMPETENCES || {}
      );
      corps.appendChild(items.length
        ? suiteDesCases(items)
        : el("p",{ class:"calc-muette",
            text:"Aucune rotation n'a encore été posée pour cette équipe." }));
    };

    dessiner();
    if(!catalogueWikiPret()){
      chargerCatalogueWiki().then(dessiner).catch(() => {
        corps.innerHTML = "";
        corps.appendChild(el("p",{ class:"calc-avertissement",
          text:"Les compétences n'ont pas pu être chargées." }));
      });
    }
    return section;
  }
```

Et dans `openTeamDetail`, après la boucle qui ajoute les fiches de héros :

```js
    (t.heroes||[]).forEach(h=>box.appendChild(heroDetail(h, settings)));
    const rotation = sectionRotation(t);
    if(rotation) box.appendChild(rotation);
    ModalStack.open($("#teamOverlay"), "#teamClose", closeTeamDetail);
```

Ajouter `el` à l'import de `js/noyau/dom.js` en tête du fichier : `import { $, el } from "../noyau/dom.js";`

- [ ] **Step 4: Déclarer le module**

Dans `tests/helpers/modules.js`, ajouter dans la couche `vues`, **avant** `"vues/detail-equipe.js"` :

```js
  /* Avant `detail-equipe.js`, qui l'importe pour son bloc de rotation. */
  "vues/rotation-equipe.js",
```

Dans `sw.js`, ajouter `"./js/vues/rotation-equipe.js",` avant `"./js/vues/detail-equipe.js",`.

- [ ] **Step 5: Vérifier**

Run: `node tests/modules-imports.test.js && node tests/css-ordre.test.js && npm run test:unit`
Expected: tout au vert.

- [ ] **Step 6: Commit**

```bash
git add js/vues/rotation-equipe.js js/vues/detail-equipe.js css/modales.css tests/helpers/modules.js sw.js
git commit -m "feat(rotation): afficher la rotation d une equipe en lecture"
```

---

### Task 8: Le mode édition

**Files:**
- Modify: `js/vues/rotation-equipe.js`
- Modify: `js/vues/detail-equipe.js`
- Modify: `css/modales.css`

**Interfaces:**
- Consumes: tout ce que produisent les tâches 3, 4 et 7.
- Produces: `blocRotation(equipe, options) -> HTMLElement`, où `options = { modifiable:boolean, surEnregistrement:(rotation)=>Promise }`. Remplace l'usage direct de `suiteDesCases` dans `detail-equipe.js`.

- [ ] **Step 1: Ajouter les contrôles d'une case**

Dans `js/vues/rotation-equipe.js`, modifier `caseDeRotation` pour accepter un second argument :

```js
  /* Les commandes d'une case, en mode edition seulement.

     `−` retire une occurrence, les fleches deplacent la serie entiere. Le
     glisser existe aussi, mais il ne suffit pas : il exclut le clavier et
     reste fragile sur certains navigateurs tactiles. Les fleches sont donc la
     voie SURE, pas un ornement. */
  function commandesDeLaCase(rang, total, actions){
    return el("span",{ class:"rota-commandes" },[
      el("button",{
        class:"rota-cmd", type:"button", text:"◀",
        title:"Déplacer vers la gauche",
        disabled:rang === 0 ? "disabled" : null,
        onclick:()=>actions.deplacer(rang, rang - 1)
      }),
      el("button",{
        class:"rota-cmd", type:"button", text:"−",
        title:"Retirer une occurrence",
        onclick:()=>actions.retirerUne(rang)
      }),
      el("button",{
        class:"rota-cmd", type:"button", text:"▶",
        title:"Déplacer vers la droite",
        disabled:rang === total - 1 ? "disabled" : null,
        onclick:()=>actions.deplacer(rang, rang + 1)
      })
    ]);
  }

  function caseDeRotation(item, rang, total, actions){
    const classe = "rota-case"
      + (item.participants.length ? " rota-case-combine" : "")
      + (item.orpheline ? " rota-case-orpheline" : "");
    const contenu = item.participants.length
      ? caseCombinee(item) : caseCompetence(item);
    const li = el("li",{ class:classe, title:titreDeLaCase(item) }, contenu);
    if(!actions) return li;
    /* Appui sur la case = +1. Le geste le plus courant est le plus direct. */
    li.appendChild(el("button",{
      class:"rota-plus", type:"button", text:"+",
      title:"Une occurrence de plus",
      onclick:()=>actions.ajouter(item.etape)
    }));
    li.appendChild(commandesDeLaCase(rang, total, actions));
    return li;
  }

  function suiteDesCases(items, actions){
    return el("ol",{ class:"rota-suite" + (actions ? " rota-suite-edition" : "") },
      items.map((item, rang) => caseDeRotation(item, rang, items.length, actions)));
  }
```

- [ ] **Step 2: Ajouter la palette**

Dans `js/vues/rotation-equipe.js`, ajouter :

```js
  /* LA PALETTE : les quatre heros avec les competences de leur arme EQUIPEE,
     puis les combinaisons que cette equipe peut reellement executer.

     Une equipe qui n'en permet aucune le lit en une phrase, au lieu de se voir
     offrir un selecteur vide. */
  function paletteDesCompetences(palette, combinaisons, actions){
    const bloc = el("div",{ class:"rota-palette" });
    palette.forEach(entree => {
      const ligne = el("div",{ class:"rota-palette-ligne" },[
        medaillon(entree.char),
        el("span",{ class:"rota-palette-nom", text:nomDuHeros(entree.char) })
      ]);
      entree.competences.forEach(competence => {
        const bouton = el("button",{
          class:"rota-palette-bouton", type:"button",
          title:nomDuHeros(entree.char) + " — " + (competence.nomFr || competence.gameId),
          onclick:()=>actions.ajouter(competence.gameId)
        },[iconeDeCompetence(competence)]);
        ligne.appendChild(bouton);
      });
      bloc.appendChild(ligne);
    });

    const ultimes = combinaisons.filter(c => /_skill_r$/.test(c.lanceur));
    const speciales = combinaisons.filter(c => !/_skill_r$/.test(c.lanceur));
    [["Ultimes combinés", ultimes], ["Spéciales combinées", speciales]]
      .forEach(([titre, liste]) => {
        if(!liste.length) return;
        const ligne = el("div",{ class:"rota-palette-ligne" },[
          el("span",{ class:"rota-palette-nom", text:titre })
        ]);
        liste.forEach(combinaison => {
          const noms = [combinaison.lanceur].concat(combinaison.partenaires)
            .map(id => nomDuHeros(id.split("_")[0]));
          ligne.appendChild(el("button",{
            class:"rota-palette-bouton rota-palette-combine", type:"button",
            title:noms[0] + " lance, avec " + noms.slice(1).join(" et "),
            onclick:()=>actions.ajouter(combinaison.etape)
          }, [combinaison.lanceur].concat(combinaison.partenaires)
              .map(id => medaillon(id.split("_")[0]))));
        });
        bloc.appendChild(ligne);
      });

    if(!combinaisons.length){
      bloc.appendChild(el("p",{ class:"calc-muette",
        text:"Cette équipe ne permet aucune compétence combinée : "
          + "elles dépendent de l'arme équipée de chaque héros." }));
    }
    return bloc;
  }
```

- [ ] **Step 3: Assembler `blocRotation`**

Dans `js/vues/rotation-equipe.js`, ajouter :

```js
  /* Le bloc complet. Il porte SON etat d'edition — la rotation en cours et
     celle enregistree — et ne remonte rien tant que le membre n'a pas
     enregistre. Meme frontiere que l'essai d'enchantements du calculateur, qui
     ne touche jamais le build enregistre.

     Pas d'enregistrement automatique : chaque appui declencherait un `upsert`
     Supabase, et une rotation a moitie composee partirait dans le nuage. */
  function blocRotation(equipe, options){
    const reglages = options || {};
    const modifiable = reglages.modifiable === true;
    const heroes = (equipe && equipe.heroes) || [];
    const competences = (typeof window !== "undefined"
      && window.SEVEN_DS_WIKI_COMPETENCES) || {};
    const catalogueCombinaisons = (typeof window !== "undefined"
      && window.SEVEN_DS_ULTIMES_COMBINES) || [];

    let enregistree = normaliserRotation((equipe && equipe.rotation) || []);
    let courante = enregistree.slice();

    const bloc = el("div",{ class:"rota-corps" });

    const actions = {
      ajouter:etape => { courante = ajouterEtape(courante, etape); dessiner(); },
      retirerUne:rang => { courante = retirerUne(courante, rang); dessiner(); },
      deplacer:(de, vers) => {
        courante = deplacerCase(courante, de, vers);
        dessiner();
      }
    };

    function dessiner(){
      bloc.innerHTML = "";
      const items = casesDeLaRotation(courante, heroes, competences);
      bloc.appendChild(items.length
        ? suiteDesCases(items, modifiable ? actions : null)
        : el("p",{ class:"calc-muette",
            text:modifiable
              ? "Tape une compétence ci-dessous pour commencer."
              : "Aucune rotation n'a encore été posée pour cette équipe." }));
      if(!modifiable) return;

      bloc.appendChild(paletteDesCompetences(
        paletteDeLEquipe(heroes, competences),
        combinaisonsDeLEquipe(heroes, competences, catalogueCombinaisons),
        actions
      ));

      const differe = JSON.stringify(courante) !== JSON.stringify(enregistree);
      const barre = el("div",{ class:"rota-barre" });
      const enregistrer = el("button",{
        class:"btn", type:"button", text:"Enregistrer la rotation",
        disabled:differe ? null : "disabled",
        onclick:()=>{
          enregistrer.disabled = true;
          Promise.resolve(reglages.surEnregistrement(courante.slice()))
            .then(()=>{ enregistree = courante.slice(); dessiner(); })
            .catch(()=>{ dessiner(); });
        }
      });
      barre.appendChild(enregistrer);
      if(differe){
        barre.appendChild(el("button",{
          class:"btn btn-ghost", type:"button", text:"Annuler",
          onclick:()=>{ courante = enregistree.slice(); dessiner(); }
        }));
        barre.appendChild(el("span",{ class:"calc-muette",
          text:courante.length + " / " + PLAFOND_ROTATION + " appuis" }));
      }
      bloc.appendChild(barre);
    }

    dessiner();
    return bloc;
  }
```

Compléter les imports du fichier :

```js
import {
  PLAFOND_ROTATION, ajouterEtape, casesDeLaRotation, combinaisonsDeLEquipe,
  deplacerCase, normaliserRotation, paletteDeLEquipe, retirerUne
} from "../metier/rotation-equipe.js";
```

Et l'export : `export { blocRotation };` — `suiteDesCases` n'est plus exportée, elle ne sert qu'ici.

- [ ] **Step 4: Brancher l'enregistrement**

Dans `js/vues/detail-equipe.js`, remplacer le corps de `sectionRotation` par :

```js
  function sectionRotation(equipe){
    const rotation = (equipe && equipe.rotation) || [];
    const modifiable = canManageTeam(equipe);
    if(!rotation.length && !modifiable) return null;
    const section = el("section",{ class:"rota" },[
      el("h3",{ class:"rota-titre", text:"Rotation" })
    ]);
    const corps = el("div");
    section.appendChild(corps);

    const dessiner = () => {
      corps.innerHTML = "";
      if(!catalogueWikiPret()){
        corps.appendChild(el("p",{ class:"calc-muette",
          text:"Chargement des compétences…" }));
        return;
      }
      corps.appendChild(blocRotation(equipe, {
        modifiable,
        surEnregistrement:enregistrerRotation.bind(null, equipe)
      }));
    };

    dessiner();
    if(!catalogueWikiPret()){
      chargerCatalogueWiki().then(dessiner).catch(() => {
        corps.innerHTML = "";
        corps.appendChild(el("p",{ class:"calc-avertissement",
          text:"Les compétences n'ont pas pu être chargées." }));
      });
    }
    return section;
  }

  /* L'ENREGISTREMENT. Une equipe de compte passe par Supabase, une equipe
     locale par le stockage du navigateur — `Store` connait deja la
     difference, cette vue n'a pas a la refaire.

     En cas d'echec, l'etat edite RESTE a l'ecran : on ne perd pas le travail
     du membre sur une coupure reseau. */
  function enregistrerRotation(equipe, rotation){
    equipe.rotation = rotation;
    if(sessionCourante.user){
      return Store.upsert(equipe)
        .then(()=>{ toast("Rotation enregistrée."); })
        .catch(()=>{
          toast("La rotation n'a pas pu être enregistrée.", true);
          throw new Error("ROTATION_NON_ENREGISTREE");
        });
    }
    const liste = Store.all();
    const index = liste.findIndex(item => item.id === equipe.id);
    if(index >= 0) liste[index] = equipe;
    Store.save(liste);
    toast("Rotation enregistrée.");
    return Promise.resolve(true);
  }
```

Ajouter les imports manquants en tête de `js/vues/detail-equipe.js` :

```js
import { Store } from "../donnees/equipes-store.js";
import { toast } from "./toast.js";
import { blocRotation } from "./rotation-equipe.js";
```

et retirer l'import devenu inutile de `casesDeLaRotation`.

- [ ] **Step 5: Style des commandes**

Dans `css/modales.css`, ajouter à la suite du bloc précédent :

```css
/* Les commandes d'édition. Chaque cible fait au moins 24 px : la suite
   d'accessibilité mobile le vérifie. */
.rota-suite-edition .rota-case{padding-bottom:2px}
.rota-plus{
  position:absolute;top:-8px;right:-8px;width:20px;height:20px;
  border-radius:50%;border:1px solid var(--line-soft);background:var(--panel);
  color:var(--gold-bright);font-weight:700;line-height:1;cursor:pointer
}
.rota-commandes{display:flex;gap:2px;margin-top:2px}
.rota-cmd{
  min-width:24px;min-height:24px;padding:0;border:1px solid var(--line-soft);
  border-radius:4px;background:transparent;color:var(--muted);cursor:pointer
}
.rota-cmd:disabled{opacity:.3;cursor:default}
.rota-palette{
  margin-top:12px;display:flex;flex-direction:column;gap:6px;
  padding-top:10px;border-top:1px solid var(--line-soft)
}
.rota-palette-ligne{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.rota-palette-nom{min-width:90px;font-size:12px;color:var(--muted)}
.rota-palette-bouton{
  min-width:40px;min-height:40px;padding:2px;border:1px solid var(--line-soft);
  border-radius:6px;background:var(--panel);cursor:pointer
}
.rota-palette-combine{display:flex;align-items:center;gap:2px}
.rota-barre{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}
```

- [ ] **Step 6: Vérifier**

Run: `node tests/modules-imports.test.js && node tests/css-ordre.test.js && npm run test:unit`
Expected: tout au vert.

- [ ] **Step 7: Commit**

```bash
git add js/vues/rotation-equipe.js js/vues/detail-equipe.js css/modales.css
git commit -m "feat(rotation): composer et enregistrer une rotation"
```

---

### Task 9: Le glisser, en Pointer Events

**Files:**
- Modify: `js/vues/rotation-equipe.js`
- Modify: `css/modales.css`

**Interfaces:**
- Consumes: `actions.deplacer(de, vers)` de la tâche 8.
- Produces: rien de nouveau — le glisser est une seconde voie vers la même mutation que les flèches.

**Pourquoi les deux.** Les flèches sont la voie SÛRE : clavier, lecteur d'écran, navigateurs tactiles capricieux. Le glisser est la voie NATURELLE quand on déplace une case de trois rangs. Aucune ne remplace l'autre, et le membre a demandé le glisser explicitement.

Le glisser-déposer HTML5 (`dragstart`/`drop`) ne fonctionne pas au doigt : on passe donc par les **Pointer Events**, qui couvrent souris, doigt et stylet d'une seule interface.

- [ ] **Step 1: Implémenter le geste**

Dans `js/vues/rotation-equipe.js`, ajouter avant `caseDeRotation` :

```js
  /* LE GLISSER, en Pointer Events.

     Le glisser-deposer HTML5 ne marche pas au doigt : `dragstart` n'est jamais
     emis sur la plupart des navigateurs tactiles. Les Pointer Events couvrent
     souris, doigt et stylet d'une seule interface.

     Un appui qui ne BOUGE PAS n'est pas un glisser : sous le seuil, on laisse
     le clic passer, sinon la case ne repondrait plus au bouton « + ». Le seuil
     vaut 6 px, la distance sous laquelle un doigt pose ne se distingue pas
     d'un doigt qui glisse.

     La case visee se lit avec `elementFromPoint` plutot qu'en calculant des
     rectangles : les cases passent a la ligne, et une geometrie reconstruite
     se tromperait des le premier retour a la ligne. */
  const SEUIL_GLISSER = 6;

  function rendreDeplacable(li, rang, actions){
    let depart = null;
    let glisse = false;

    li.addEventListener("pointerdown", event => {
      /* Les commandes gardent leur geste : un appui sur « + » n'est pas le
         debut d'un glisser. */
      if(event.target.closest("button")) return;
      depart = { x:event.clientX, y:event.clientY };
      glisse = false;
      li.setPointerCapture(event.pointerId);
    });

    li.addEventListener("pointermove", event => {
      if(!depart) return;
      const ecart = Math.hypot(event.clientX - depart.x, event.clientY - depart.y);
      if(!glisse && ecart < SEUIL_GLISSER) return;
      glisse = true;
      li.classList.add("rota-case-glissee");
      /* Empeche le defilement de la modale de suivre le doigt. */
      event.preventDefault();
    });

    const terminer = event => {
      if(!depart) return;
      const partait = glisse;
      depart = null;
      glisse = false;
      li.classList.remove("rota-case-glissee");
      if(li.hasPointerCapture(event.pointerId)){
        li.releasePointerCapture(event.pointerId);
      }
      if(!partait) return;
      const sous = document.elementFromPoint(event.clientX, event.clientY);
      const cible = sous && sous.closest(".rota-case");
      if(!cible || cible === li) return;
      const rangs = Array.from(li.parentElement.children);
      actions.deplacer(rang, rangs.indexOf(cible));
    };

    li.addEventListener("pointerup", terminer);
    li.addEventListener("pointercancel", terminer);
  }
```

Puis, dans `caseDeRotation`, juste avant le `return li` final :

```js
    li.appendChild(commandesDeLaCase(rang, total, actions));
    rendreDeplacable(li, rang, actions);
    return li;
```

- [ ] **Step 2: Empêcher le geste natif de gêner**

Dans `css/modales.css`, ajouter :

```css
/* `touch-action` coupe le défilement et le zoom SUR la case : sans lui, le
   navigateur fait défiler la modale au lieu de laisser passer le glisser. Il
   ne s'applique qu'en mode édition — en lecture, la case doit rester un
   morceau de page ordinaire qu'on peut faire défiler du doigt. */
.rota-suite-edition .rota-case{touch-action:none;cursor:grab}
.rota-case-glissee{opacity:.6;cursor:grabbing}
```

- [ ] **Step 3: Vérifier que rien n'a régressé**

Run: `node tests/modules-imports.test.js && node tests/css-ordre.test.js && npm run test:unit`
Expected: tout au vert. Le geste n'a pas de test unitaire — il ne vit que dans le DOM. La tâche 10 le couvre en bout en bout : `page.mouse.move` de Playwright émet de vrais Pointer Events.

- [ ] **Step 4: Commit**

```bash
git add js/vues/rotation-equipe.js css/modales.css
git commit -m "feat(rotation): deplacer une case au glisser, en pointer events"
```

---

### Task 10: Le parcours de bout en bout

**Files:**
- Create: `tests/rotation-equipe.playwright.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: tout le reste.
- Produces: rien.

- [ ] **Step 1: Écrire le parcours**

Créer `tests/rotation-equipe.playwright.js`. Reprendre le montage d'équipe de `tests/calculateur.playwright.js` lignes 21-132 — il bâtit une équipe complète DEPUIS LES CATALOGUES, ce qu'une liste de fichiers écrite à la main ne saurait faire sans se périmer. Remplacer `char:"meliodas"` par `char:"ban"` et la boucle sur `window.SEVEN_DS_DATA.armes.Hache` par `armes.Nunchaku`.

Le parcours ensuite :

```js
    /* La modale de détail d'une équipe qu'on possède : la palette est là. */
    await page.locator('.tabs .tab[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    const rota = page.locator(".rota");
    await rota.waitFor();
    await rota.locator(".rota-palette-bouton").first().waitFor();

    /* Deux appuis sur la MÊME compétence font une case ×2, pas deux cases.
       C'est la demande du membre : onze cases identiques ne se lisent pas. */
    const premiere = rota.locator(".rota-palette-bouton").first();
    await premiere.click();
    await premiere.click();
    assert.equal(
      await rota.locator(".rota-case").count(), 1,
      "deux appuis identiques font une seule case"
    );
    assert.equal(
      await rota.locator(".rota-fois").innerText(), "×2",
      "la case annonce sa série"
    );

    /* Une seconde compétence ouvre une seconde case. */
    await rota.locator(".rota-palette-bouton").nth(1).click();
    assert.equal(await rota.locator(".rota-case").count(), 2);

    /* Les flèches réordonnent — la voie sûre, celle qui marche au clavier. */
    const avant = await rota.locator(".rota-case").first().getAttribute("title");
    await rota.locator(".rota-case").first()
      .locator('.rota-cmd[title="Déplacer vers la droite"]').click();
    const apres = await rota.locator(".rota-case").first().getAttribute("title");
    assert.notEqual(avant, apres, "la première case a changé après le déplacement");

    /* Enregistrer, fermer, rouvrir : l'ordre a survécu. */
    await page.getByRole("button", { name:"Enregistrer la rotation" }).click();
    await page.waitForFunction(() =>
      document.querySelector(".rota-barre .btn").disabled === true);
    await page.locator("#teamClose").click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();
    await rota.locator(".rota-case").first().waitFor();
    assert.equal(
      await rota.locator(".rota-case").first().getAttribute("title"), apres,
      "la rotation enregistrée revient dans le même ordre"
    );
    assert.equal(await rota.locator(".rota-case").count(), 2);

    /* LE GLISSER. `mouse.move` de Playwright émet de vrais Pointer Events,
       donc le geste se teste pour de bon — pas seulement les flèches. On pose
       une troisième case, puis on tire la première sur la dernière. */
    await rota.locator(".rota-palette-bouton").nth(2).click();
    assert.equal(await rota.locator(".rota-case").count(), 3);
    const tiree = await rota.locator(".rota-case").first().getAttribute("title");
    const source = await rota.locator(".rota-case").first().boundingBox();
    const destination = await rota.locator(".rota-case").last().boundingBox();
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      destination.x + destination.width / 2,
      destination.y + destination.height / 2,
      { steps:12 }
    );
    await page.mouse.up();
    assert.equal(
      await rota.locator(".rota-case").last().getAttribute("title"), tiree,
      "la case tirée doit finir là où on l'a lâchée"
    );

    /* Les cibles tactiles restent conformes. */
    const boite = await rota.locator(".rota-cmd").first().boundingBox();
    assert.ok(
      boite.width >= 24 && boite.height >= 24,
      "une commande d'édition doit rester touchable, reçu : "
        + boite.width + "×" + boite.height
    );
```

Le squelette du fichier — serveur, navigateur, `try/finally`, assertion finale sur `errors` — se copie de `tests/calculateur.playwright.js` lignes 14-30 et de sa fin. Terminer par :

```js
    assert.deepEqual(errors, [], "aucune erreur de page");
    console.log("PASS Playwright: rotation d'équipe, composition et relecture");
```

- [ ] **Step 2: Déclarer le parcours**

Dans `scripts/lancer-tests.js`, ajouter dans la liste `e2e`, après `"node tests/calculateur.playwright.js",` :

```js
    "node tests/rotation-equipe.playwright.js",
```

- [ ] **Step 3: Lancer**

Run: `node tests/rotation-equipe.playwright.js`
Expected: `PASS Playwright: rotation d'équipe, composition et relecture`

- [ ] **Step 4: Lancer les deux suites complètes**

Run: `npm run test:unit && npm run test:e2e`
Expected: unit 97/97 au vert, e2e 24/24 au vert.

- [ ] **Step 5: Commit**

```bash
git add tests/rotation-equipe.playwright.js scripts/lancer-tests.js
git commit -m "test(rotation): le parcours complet, de la palette a la relecture"
```

---

## Ce que ce plan ne fait pas

Repris de la spec, section 8, et laissé dehors volontairement : alimenter le simulateur DPS avec la rotation ; des repères de temps par étape ; nommer à la main la paire d'une combinaison ; un aperçu sur la carte d'équipe du Roster.

Une limite assumée du modèle, à répéter au membre si la question vient : insérer une compétence **au milieu** d'une série demande de raccourcir la série puis de reposer. C'est le prix de la compacité `×N` qu'il a demandée, et le cas est rare — on écrit une rotation dans l'ordre.
