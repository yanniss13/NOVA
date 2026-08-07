# Calculateur de dégâts par compétence — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes utilisent des cases à cocher (`- [ ]`).

**But :** un onglet « Calculateur » où un membre choisit un personnage et un de
ses builds enregistrés, et lit les dégâts que chaque compétence inflige à
Akumu, le boss de confrérie.

**Architecture :** le catalogue de compétences et le moteur de formule sont
**importés** de la branche `comparateur-degats-lot1`, pas réécrits. La cible
passe de Banakro à Akumu — un changement de constante. Une table de buffs de
soutien écrite à la main alimente les entrées du moteur. Un module métier pur
traduit « build + buffs cochés » en entrées ; la vue ne calcule rien.

**Pile :** modules ES natifs sans build, Python 3 pour les générateurs, harnais
`vm` maison pour l'unitaire, Playwright pour le bout en bout.

## Contraintes globales

- **Spec de référence :** `docs/superpowers/specs/2026-08-07-calculateur-degats-competence-design.md`.
- **Branche de travail :** `calculateur-degats-competence`, déjà créée depuis
  `main`. Ne **pas** rebaser les 13 commits de `comparateur-degats-lot1` :
  importer fichier par fichier avec `git checkout <branche> -- <chemin>`.
- **Formule :** `Dégâts = Base × Bonus offensif × Critique × K/(K+DEF) × (1−Résistance) × (1+Faiblesse)`.
- **`K = 5600`** (milieu de l'intervalle 5500–5700 publié). Ne pas y toucher.
- **Cible Akumu, valeurs relevées :** `def:3454`, `critResist:2000`,
  `critDmgResist:5000`, `resistanceElementaire:3000`, `faiblesse:0`.
- **Échelle :** unité `ten-thousandths` — `valeur / 10000` donne le rapport,
  `valeur / 100` le pourcentage affiché.
- **Une donnée absente vaut `null`, jamais zéro.** Une ligne sans coefficient
  connu reste listée **sans chiffre**, jamais à `0`.
- **Un module métier neuf s'enregistre à QUATRE endroits :**
  `tests/helpers/modules.js` (dans sa couche), `sw.js` (`CORE_ASSETS`),
  l'`import` de son consommateur, et l'objet `hooks` de
  `tests/helpers/load-app.js`.
- **Un test unitaire neuf rejoint les DEUX scripts** `test` et `test:unit` de
  `package.json`. Un test absent des scripts ne s'exécute jamais.
- **Une feuille CSS neuve s'inscrit à TROIS endroits :** le tableau `FEUILLES`
  de `tests/css-ordre.test.js`, une balise `<link>` d'`index.html` **au même
  rang**, et `CORE_ASSETS` de `sw.js`.
- **`tests/modules-imports.test.js` refuse tout export que personne
  n'importe.** Les tâches 2, 3 et 4 s'enchaînent donc sans interruption, et
  `npm test` complet n'est exigé qu'à la **fin de la tâche 4**.
- **Fins de ligne mixtes CRLF/LF** dans `index.html`. Ne jamais construire une
  ancre multi-ligne en supposant un séparateur unique : inspecter la zone,
  utiliser `\r?\n`. Ne pas normaliser le fichier au passage.
- **Messages de commit sans accents.** Libellés d'interface en français
  accentué.
- **Vérification navigateur :** toujours un port **jamais utilisé** — le
  service worker est en `cacheFirst`.
- **Deux scénarios Playwright sont connus comme instables** —
  `tests/supabase-etape1.playwright.js` (44 px) et
  `tests/accessibilite-mobile.playwright.js` (tuile du picker). Les relancer
  isolément avant de conclure à une régression.
- Suite complète : `npm test`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `data/competences.js` *(importé)* | Catalogue de calcul figé : coefficients, coups, répartition, composantes, nature. 7 491 lignes. |
| `scripts/generate-competences.py` *(importé)* | Régénère le catalogue. `--check` sans réseau. |
| `tests/competences-catalogue.test.js` *(importé)* | Cohérence du catalogue commité. |
| `tests/test_generate_competences.py` *(importé)* | Unitaire du générateur, hors réseau. |
| `js/metier/degats-calcul.js` *(importé, modifié)* | La formule et ses termes. Cible Akumu, trois colonnes. |
| `tests/degats-calcul.test.js` *(importé, modifié)* | Régressions du moteur. |
| `data/buffs-supports.js` *(créé, ÉCRIT À LA MAIN)* | Buffs des sept supports réellement joués. |
| `js/metier/calculateur-entrees.js` *(créé)* | Pur : build + buffs cochés → entrées du moteur, et buffs applicables à un build. |
| `tests/calculateur-entrees.test.js` *(créé)* | Unitaire du module ci-dessus, table de buffs comprise. |
| `js/vues/calculateur.js` *(créé)* | La page : sélection, retouche, soutiens, tableau. Aucun calcul. |
| `css/calculateur.css` *(créé)* | Son habillage. |
| `js/vues/fiche-heros.js` *(modifié)* | Le lien « Calculer les dégâts ». |
| `tests/calculateur.playwright.js` *(créé)* | Bout en bout de la page. |

---

## Tâche 1 : le catalogue de compétences

**Fichiers :**
- Importer : `data/competences.js`, `scripts/generate-competences.py`,
  `tests/competences-catalogue.test.js`, `tests/test_generate_competences.py`
- Modifier : `sw.js` (`CORE_ASSETS`), `package.json` (les deux scripts)

**Interfaces :**
- Produit : `window.SEVEN_DS_COMPETENCES`, chargé **paresseusement**.
  ```js
  window.SEVEN_DS_COMPETENCES = {
    "<slug>": [
      { gameId:"bug_axe_skill_e", weaponType:"Axe", categorie:"NORMAL_SKILL",
        nom:"Dark Thrash", nature:"direct", pourcentage:188.0, coups:1,
        repartition:[], periodique:null, recharge:14.0, portee:"Melee",
        composantes:[{ base:"atk", pourcentage:188.0 }] }
    ]
  };
  ```

- [ ] **Étape 1 : importer les quatre fichiers**

```bash
git checkout comparateur-degats-lot1 -- \
  data/competences.js \
  scripts/generate-competences.py \
  tests/competences-catalogue.test.js \
  tests/test_generate_competences.py
```

Ne rien importer d'autre. En particulier **pas** `data/effets-dps.js`,
`scripts/generate-effets-dps.py`, `scripts/effets-dps-regles.py`,
`js/metier/dps-*.js` ni leurs tests : ils n'existent que pour dérouler le temps
et sont hors périmètre.

- [ ] **Étape 2 : précacher le catalogue**

Dans `sw.js`, `CORE_ASSETS`, ligne 25-26 : ajouter `"./data/competences.js"`
après `"./data/personnages-meta.js"`.

```js
  "./data/personnages-meta.js", "./data/competences.js", "./supabase-config.js",
```

**Pourquoi précaché alors que `data/wiki-competences.js` ne l'est pas :** le
wiki est une consultation, le calculateur prolonge le builder, qui fonctionne
hors ligne. Ne pas modifier le traitement du catalogue du wiki au passage.

- [ ] **Étape 3 : ne PAS l'ajouter à index.html**

Le catalogue fait 7 491 lignes. Les cinq `<script src="data/...">`
d'`index.html` (lignes 588-592) sont chargés au démarrage ; celui-ci ne doit
pas l'être. Il sera injecté à la demande par la vue, en tâche 4, sur le motif
de `chargerCatalogue()` de `js/vues/wiki.js:52-70`.

Vérifier qu'aucune balise n'a été ajoutée :

```bash
grep -n 'data/competences.js' index.html
```

Attendu : aucune sortie.

- [ ] **Étape 4 : inscrire les tests dans les scripts npm**

Dans `package.json`, ajouter dans **`test` ET `test:unit`**, après
`node tests/wiki-equipement.test.js` :

```
 && node tests/competences-catalogue.test.js
```

et après `python -m unittest tests/test_generate_wiki.py` :

```
 && python -m unittest tests/test_generate_competences.py && python scripts/generate-competences.py --check
```

- [ ] **Étape 5 : lancer**

```bash
node tests/competences-catalogue.test.js
python -m unittest tests/test_generate_competences.py
python scripts/generate-competences.py --check
node tests/pwa.test.js
```

Attendu : tout au vert. `tests/pwa.test.js` vérifie la cohérence de
`CORE_ASSETS` ; s'il échoue, c'est l'étape 2 qui est en cause.

- [ ] **Étape 6 : commit**

```bash
git add data/competences.js scripts/generate-competences.py \
        tests/competences-catalogue.test.js tests/test_generate_competences.py \
        sw.js package.json
git commit -m "feat: importer le catalogue de competences chiffrees"
```

---

## Tâche 2 : la cible Akumu et les trois colonnes

**Fichiers :**
- Importer : `js/metier/degats-calcul.js`, `tests/degats-calcul.test.js`
- Modifier : les deux ci-dessus, `tests/helpers/modules.js`,
  `tests/helpers/load-app.js`, `sw.js`, `package.json`

**Interfaces :**
- Produit :
  ```js
  degatsAttendus({ stats, competence, cible })
    // stats : { atk, def, hp, critRate, critDamage,
    //           bonusGlobal, bonusElementaire, bonusCategorie }
    //         critRate/critDamage/bonus* en dix-millièmes
    // competence : { pourcentage, repartition, composantes }
    // cible : { def, critResist, critDmgResist, resistanceElementaire, faiblesse }
    // -> null si une entrée manque
    // -> { total, sansCritique, avecCritique, parCoup, termes }
  CIBLE_REFERENCE // { nom, def, critResist, critDmgResist,
                  //   resistanceElementaire, faiblesse }
  ```
  `total` reste **l'espérance** et conserve sa valeur : les assertions
  existantes de `tests/degats-calcul.test.js` portent sur lui.

> ⚠️ `tests/modules-imports.test.js` refuse un export que personne n'importe.
> Cette tâche laisse donc la suite complète rouge. C'est attendu : elle
> s'enchaîne avec les tâches 3 et 4, et `npm test` n'est exigé qu'à la fin de
> la tâche 4. Ne pas « réparer » ce rouge en supprimant un export.

- [ ] **Étape 1 : importer le moteur et son test**

```bash
git checkout comparateur-degats-lot1 -- \
  js/metier/degats-calcul.js tests/degats-calcul.test.js
```

- [ ] **Étape 2 : lire le fichier importé avant de l'éditer**

```bash
sed -n '1,60p' js/metier/degats-calcul.js
```

Le fichier a évolué sur la branche depuis son plan d'origine : il gère des
`composantes` (`base:"atk"|"def"|"hp"`) et **trois** bonus offensifs distincts
(`bonusCategorie`, `bonusElementaire`, `bonusGlobal`), avec repli sur l'ancien
`bonusType`. Ne pas le réécrire depuis le listing du plan de la branche, qui
est périmé.

- [ ] **Étape 3 : écrire les assertions qui échouent**

Dans `tests/degats-calcul.test.js`, remplacer le bloc final qui fige les
valeurs de Banakro par celui-ci, et ajouter les assertions de colonnes :

```js
/* La cible de reference porte les valeurs relevees sur Akumu, le boss de
   confrerie, jamais des chiffres inventes. Source :
   7dsorigin.app/en/knighthood-boss/demonic-beast-akumu */
{
  assert.equal(CIBLE_REFERENCE.def, 3454);
  assert.equal(CIBLE_REFERENCE.critResist, 2000);
  assert.equal(CIBLE_REFERENCE.critDmgResist, 5000);
  assert.equal(CIBLE_REFERENCE.resistanceElementaire, 3000);
  assert.equal(CIBLE_REFERENCE.faiblesse, 0);
}

/* Les trois colonnes sont trois lectures d'un SEUL calcul. L'esperance est
   forcement encadree par le coup sans critique et le coup critique plein :
   c'est ce qui interdit qu'une colonne derive des deux autres. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:5000, critDamage:14000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.ok(r.sansCritique < r.total, "l'esperance depasse le coup sans crit");
  assert.ok(r.total < r.avecCritique, "le coup critique depasse l'esperance");
  /* 500 sans critique, 1,4 de degats crit -> 1200 en critique plein. */
  assert.equal(Math.round(r.sansCritique), 500);
  assert.equal(Math.round(r.avecCritique), 1200);
}

/* Un taux critique nul aplatit l'esperance sur le coup sans critique, et ne
   touche pas au coup critique plein. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:0, critDamage:14000 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), Math.round(r.sansCritique));
  assert.equal(Math.round(r.avecCritique), 1200);
}
```

- [ ] **Étape 4 : lancer et vérifier l'échec**

```bash
node tests/degats-calcul.test.js
```

Attendu : échec sur `CIBLE_REFERENCE.def` (493 reçu, 3454 attendu).

- [ ] **Étape 5 : porter la cible sur Akumu**

Dans `js/metier/degats-calcul.js`, remplacer le bloc `CIBLE_REFERENCE` :

```js
  /* Valeurs REELLES relevees sur le boss de confrerie, page
     7dsorigin.app/en/knighthood-boss/demonic-beast-akumu. Jamais inventees.

     La source ne publie qu'un seul bloc de statistiques alors que le boss a
     vingt niveaux de difficulte : la vue doit le dire, et rien ici ne doit
     extrapoler un niveau choisi.

     Les huit resistances elementaires valent 30 % et aucune faiblesse n'est
     publiee : sur Akumu, l'element ne change rien. */
  const CIBLE_REFERENCE = {
    nom:"Akumu, bête démoniaque",
    def:3454,
    critResist:2000,
    critDmgResist:5000,
    resistanceElementaire:3000,
    faiblesse:0
  };
```

- [ ] **Étape 6 : ajouter les deux colonnes**

Toujours dans `degatsAttendus`, après la ligne `const total = facteur * base;`,
ajouter :

```js
    /* Trois lectures d'un SEUL calcul, jamais trois appels : `facteur` porte
       deja le critique en esperance, donc l'en retirer donne le coup sans
       critique, et y substituer le critique plein donne l'autre borne. Trois
       appels aux entrees differentes ouvriraient trois occasions de diverger. */
    const sansCritique = total / critique;
    const avecCritique = sansCritique * (1 + degatsCrit);
```

Puis, dans l'objet retourné, après `total,` :

```js
      sansCritique,
      avecCritique,
```

Le nom `avecCritique` — et non `critique` comme l'annonçait la spec — évite
d'ombrer la constante locale `critique`, qui est le multiplicateur d'espérance.

- [ ] **Étape 7 : enregistrer le module**

`tests/helpers/modules.js`, dans la couche `metier`, **après**
`"metier/stats-calcul.js"` :

```js
  "metier/stats-calcul.js",
  "metier/degats-calcul.js",
```

`sw.js`, `CORE_ASSETS`, après `"./js/metier/stats-calcul.js"` :

```js
"./js/metier/stats-calcul.js", "./js/metier/degats-calcul.js",
```

`tests/helpers/load-app.js`, dans le littéral `hooks` — le garde `typeof` est
le motif du fichier, et **aucun accent grave** n'y est permis, son contenu
vivant dans un gabarit de chaîne :

```js
  degatsAttendus:typeof degatsAttendus === "function"
    ? degatsAttendus
    : undefined,
  CIBLE_REFERENCE:typeof CIBLE_REFERENCE === "object"
    ? CIBLE_REFERENCE
    : undefined,
```

- [ ] **Étape 8 : ajouter le test aux deux scripts npm**

Dans `package.json`, après `node tests/competences-catalogue.test.js`, **dans
`test` et dans `test:unit`** :

```
 && node tests/degats-calcul.test.js
```

- [ ] **Étape 9 : lancer le test du moteur**

```bash
node tests/degats-calcul.test.js
```

Attendu : PASS. `npm test` reste rouge sur `modules-imports` — c'est prévu.

- [ ] **Étape 10 : commit**

```bash
git add js/metier/degats-calcul.js tests/degats-calcul.test.js \
        tests/helpers/modules.js tests/helpers/load-app.js sw.js package.json
git commit -m "feat: viser le boss de confrerie et exposer les trois colonnes"
```

---

## Tâche 3 : la table des buffs et le module d'entrées

**Fichiers :**
- Créer : `data/buffs-supports.js`, `js/metier/calculateur-entrees.js`,
  `tests/calculateur-entrees.test.js`
- Modifier : `tests/helpers/modules.js`, `tests/helpers/load-app.js`, `sw.js`,
  `package.json`

**Interfaces :**
- Consomme : `degatsAttendus`, `CIBLE_REFERENCE` (tâche 2) ;
  `window.SEVEN_DS_COMPETENCES` (tâche 1) ; `window.SEVEN_DS_BUFFS_SUPPORTS` ;
  `FOLDER_TO_ENUM` (`js/noyau/constantes.js`, déjà exporté ligne 99).
- Produit :
  ```js
  buffsApplicables(elementDuBuild)
    // -> [{ support, ...buff }] : les buffs sans element, plus ceux dont
    //    l'element vaut elementDuBuild. Jamais de buff grise.

  entreesDuCalcul({ statsDuBuild, buffsCoches })
    // statsDuBuild : { atk, def, hp, critRate, critDamage }
    // buffsCoches  : [{ stat, valeur, unite, operation }]
    // -> { atk, def, hp, critRate, critDamage,
    //      bonusGlobal, bonusElementaire, bonusCategorie }

  resultatsParCompetence({ competences, entrees, cible })
    // -> [{ competence, resultat }] ; resultat null pour une competence
    //    non chiffrable, la ligne restant presente
  ```

- [ ] **Étape 1 : relever la matière première**

La table est écrite à la main, mais **aucune valeur ne s'invente**. Extraire
les descriptions françaises des sept supports :

```bash
python -c "
import re,json,sys
sys.stdout.reconfigure(encoding='utf-8',errors='replace')
s=open('data/wiki-competences.js',encoding='utf-8').read()
cat=json.loads(s[s.index('{'):s.rindex('}')+1])
mot=re.compile(r'alli|equipe|équipe',re.I)
for c in ['elizabeth','daisy','manny','howzer','gowther','guila','dreydrin']:
    print('=== '+c)
    for k in cat.get(c,[]):
        if mot.search(k['descriptionFr'] or ''):
            d=re.sub(r'\[#?[0-9A-Fa-f-]*\]','',k['descriptionFr']).replace(chr(10),' / ')
            print('  '+k['gameId']+' ['+k['weaponType']+'] '+k['nomFr'])
            print('     '+d)
"
```

⚠️ **`dreydrin` est à confirmer auprès du propriétaire.** Le catalogue contient
aussi `derieri`, dont les buffs sont offensifs là où ceux de `dreydrin` sont
défensifs. Si la réponse est `derieri`, remplacer le slug dans la commande et
dans la table — rien d'autre ne change.

- [ ] **Étape 2 : écrire la table**

Créer `data/buffs-supports.js`. **Ce fichier n'est pas généré** : c'est
l'exception dans `data/`, et son en-tête doit le dire.

Règles de transcription, à appliquer sans exception :

- `provenance.gameId` et `provenance.phrase` sont **copiés** de la sortie de
  l'étape 1. La phrase est un extrait littéral, accents compris.
- Un soin, une barrière, un gain de défense ou de PV **n'entre pas** dans la
  table : sans conversion offensive il ne change aucun dégât. Ne pas l'y mettre
  à zéro — il n'y a pas sa place.
- `operation` vaut `"add"` (le buff s'ajoute) ou `"multiply"` (le buff
  multiplie la valeur du héros). « +10 % de l'attaque des alliés » est un
  `multiply` sur `B_Atk` ; « à hauteur de 30 % de l'attaque du héros
  (Max : 3000) » est un `add` plat, dont la valeur retenue est le **plafond
  relevé**, corrigeable par le membre.
- `element` vaut `null`, ou l'élément visé en minuscules tel que
  `personnages-meta.js` l'écrit, quand le buff ne concerne qu'un attribut.

```js
// Buffs des supports que la confrerie joue reellement.
//
// ECRIT ET MAINTENU A LA MAIN. C'est l'exception de data/ : aucun script ne
// le regenere, et aucun ne doit le citer. La source ne publie pas ces
// valeurs - son champ `buffs` ne porte qu'un identifiant, un type et une
// duree - donc elles sont transcrites depuis les descriptions FR du wiki.
//
// provenance.gameId + provenance.phrase disent d'ou vient chaque chiffre :
// quand le jeu dement une valeur, on sait quelle phrase avait ete lue.
//
// operation : "add" ajoute la valeur, "multiply" multiplie celle du heros.
// element   : null, ou l'attribut vise quand le buff ne concerne que lui.
// unite     : "ten-thousandths" pour un taux, "flat" pour une valeur brute.
window.SEVEN_DS_BUFFS_SUPPORTS = {
  "daisy": [
    {
      id:"daisy-degats-crit",
      libelle:"Dégâts crit. des alliés +15 %",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"<relevé à l'étape 1>",
        phrase:"Augmente les dégâts crit. des alliés de 15% pendant 40s"
      }
    }
  ]
};
```

Compléter les sept supports sur ce modèle, à partir de la sortie de l'étape 1.
Un support dont aucune compétence ne produit d'effet offensif reste présent
avec un tableau **vide** — son absence ferait croire à un oubli.

- [ ] **Étape 3 : écrire le test qui échoue**

Créer `tests/calculateur-entrees.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadApp } = require("./helpers/load-app");

const racine = path.join(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "buffs-supports.js"), "utf8"), bac
);
const TABLE = bac.window.SEVEN_DS_BUFFS_SUPPORTS;

/* Le catalogue du wiki sert de juge : chaque valeur transcrite doit pouvoir
   etre retrouvee dans la phrase dont elle se reclame. C'est ce qui empeche
   une valeur inventee de s'installer discretement. */
const wiki = (() => {
  const bac2 = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", "wiki-competences.js"), "utf8"),
    bac2
  );
  return bac2.window.SEVEN_DS_WIKI_COMPETENCES;
})();

const SUPPORTS = ["elizabeth","daisy","manny","howzer","gowther","guila","dreydrin"];
const STATS_CONNUES = new Set([
  "B_Atk", "C_Critical_Rate", "C_Critical_Dam_Rate",
  "AllElement_Add", "AllSkill_Add", "AllCategory_Add"
]);

assert.deepEqual(Object.keys(TABLE).sort(), [...SUPPORTS].sort(),
  "La table doit couvrir exactement les sept supports joues");

SUPPORTS.forEach(slug => {
  TABLE[slug].forEach(buff => {
    assert.ok(STATS_CONNUES.has(buff.stat),
      slug + " : stat inconnue -> " + buff.stat);
    assert.ok(["add","multiply"].includes(buff.operation),
      slug + " : operation invalide -> " + buff.operation);
    assert.ok(["flat","ten-thousandths"].includes(buff.unite),
      slug + " : unite invalide -> " + buff.unite);
    assert.ok(typeof buff.valeur === "number" && buff.valeur > 0,
      slug + " : une valeur absente vaut null, jamais zero -> " + buff.libelle);

    /* La provenance doit designer une competence REELLE du support, et sa
       phrase doit etre un extrait litteral de sa description. */
    const source = (wiki[slug] || [])
      .find(k => k.gameId === buff.provenance.gameId);
    assert.ok(source,
      slug + " : gameId absent du wiki -> " + buff.provenance.gameId);
    const nue = (source.descriptionFr || "").replace(/\[#?[0-9A-Fa-f-]*\]/g, "");
    assert.ok(nue.includes(buff.provenance.phrase),
      slug + " : la phrase n'est pas un extrait de " + source.nomFr);
  });
});

const { hooks } = loadApp();
const { buffsApplicables, entreesDuCalcul, resultatsParCompetence } = hooks;

/* Un buff sans element vaut pour tout build ; un buff elementaire n'est
   propose qu'au build de cet element, et il est ABSENT des autres - ni grise
   ni affiche a zero. */
{
  const tous = buffsApplicables("wind").map(b => b.id);
  const autres = buffsApplicables("fire").map(b => b.id);
  const elementaires = SUPPORTS
    .flatMap(s => TABLE[s])
    .filter(b => b.element === "wind")
    .map(b => b.id);
  elementaires.forEach(id => {
    assert.ok(tous.includes(id), "buff Vent absent d'un build Vent : " + id);
    assert.ok(!autres.includes(id), "buff Vent propose a un build Feu : " + id);
  });
}

/* Un buff coche modifie l'entree attendue et UNE SEULE. */
{
  const nu = entreesDuCalcul({
    statsDuBuild:{ atk:1000, def:0, hp:0, critRate:3000, critDamage:12000 },
    buffsCoches:[]
  });
  const avec = entreesDuCalcul({
    statsDuBuild:{ atk:1000, def:0, hp:0, critRate:3000, critDamage:12000 },
    buffsCoches:[{ stat:"C_Critical_Dam_Rate", operation:"add",
                   valeur:1500, unite:"ten-thousandths" }]
  });
  assert.equal(avec.critDamage, nu.critDamage + 1500);
  assert.equal(avec.atk, nu.atk, "un buff de degats crit ne touche pas l'ATK");
  assert.equal(avec.critRate, nu.critRate);
}

/* `multiply` multiplie la valeur du heros ; `add` s'y ajoute. */
{
  const r = entreesDuCalcul({
    statsDuBuild:{ atk:1000, def:0, hp:0, critRate:0, critDamage:0 },
    buffsCoches:[{ stat:"B_Atk", operation:"multiply",
                   valeur:1000, unite:"ten-thousandths" }]
  });
  assert.equal(r.atk, 1100, "+10 % de 1000");
  const p = entreesDuCalcul({
    statsDuBuild:{ atk:1000, def:0, hp:0, critRate:0, critDamage:0 },
    buffsCoches:[{ stat:"B_Atk", operation:"add", valeur:3000, unite:"flat" }]
  });
  assert.equal(p.atk, 4000, "un plafond plat s'ajoute tel quel");
}

/* Une competence non chiffrable garde sa LIGNE et perd son chiffre : la
   masquer ferait croire qu'elle n'existe pas, la chiffrer a zero qu'elle ne
   fait rien. */
{
  const lignes = resultatsParCompetence({
    competences:[
      { nom:"chiffree", pourcentage:100, repartition:[100],
        composantes:[{ base:"atk", pourcentage:100 }] },
      { nom:"muette", pourcentage:null, repartition:[], composantes:[] }
    ],
    entrees:{ atk:1000, def:0, hp:0, critRate:0, critDamage:0 },
    cible:{ def:5600, critResist:0, critDmgResist:0,
            resistanceElementaire:0, faiblesse:0 }
  });
  assert.equal(lignes.length, 2, "les deux lignes restent presentes");
  assert.ok(lignes[0].resultat, "la competence chiffree porte un resultat");
  assert.strictEqual(lignes[1].resultat, null, "la muette rend null, pas zero");
}

console.log("calculateur-entrees.test.js OK");
```

- [ ] **Étape 4 : lancer et vérifier l'échec**

```bash
node tests/calculateur-entrees.test.js
```

Attendu : `TypeError: buffsApplicables is not a function`.

- [ ] **Étape 5 : écrire le module**

Créer `js/metier/calculateur-entrees.js` :

```js
/* Traduit « un build et des buffs coches » en entrees du moteur de degats.

   Module PUR : ni DOM ni reseau. Il existe pour que cette traduction soit
   testable sans navigateur, et pour que js/vues/calculateur.js ne contienne
   aucun calcul. */

import { degatsAttendus } from "./degats-calcul.js";

  const RAPPORT = 10000;

  /* Ou chaque stat de buff atterrit dans les entrees du moteur. Les trois
     bonus offensifs sont distincts parce que le moteur les distingue : les
     confondre reviendrait a inventer une equivalence que la formule ne pose
     pas. */
  const CIBLE_DU_BUFF = {
    B_Atk:"atk",
    C_Critical_Rate:"critRate",
    C_Critical_Dam_Rate:"critDamage",
    AllElement_Add:"bonusElementaire",
    AllSkill_Add:"bonusGlobal",
    AllCategory_Add:"bonusCategorie"
  };

  function table(){
    return window.SEVEN_DS_BUFFS_SUPPORTS || {};
  }

  /* Un buff elementaire ne concerne que les builds de cet element. Il est
     ABSENT des autres, jamais grise : c'est la meme regle qu'une competence
     sans coefficient, qui disparait au lieu de valoir zero. */
  function buffsApplicables(elementDuBuild){
    const catalogue = table();
    return Object.keys(catalogue).sort().flatMap(support =>
      (catalogue[support] || [])
        .filter(buff => !buff.element || buff.element === elementDuBuild)
        .map(buff => Object.assign({ support }, buff))
    );
  }

  function entreesDuCalcul(entree){
    const source = entree || {};
    const stats = source.statsDuBuild || {};
    const coches = Array.isArray(source.buffsCoches) ? source.buffsCoches : [];

    const sorties = {
      atk:Number(stats.atk) || 0,
      def:Number(stats.def) || 0,
      hp:Number(stats.hp) || 0,
      critRate:Number(stats.critRate) || 0,
      critDamage:Number(stats.critDamage) || 0,
      bonusGlobal:0,
      bonusElementaire:0,
      bonusCategorie:0
    };

    coches.forEach(buff => {
      const cle = CIBLE_DU_BUFF[buff && buff.stat];
      if(!cle) return;
      const valeur = Number(buff.valeur);
      if(!Number.isFinite(valeur)) return;
      if(buff.operation === "multiply"){
        sorties[cle] = sorties[cle] * (1 + valeur / RAPPORT);
        return;
      }
      sorties[cle] = sorties[cle] + valeur;
    });

    return sorties;
  }

  /* Une competence non chiffrable garde sa ligne et rend `null`. La masquer
     ferait croire qu'elle n'existe pas ; la chiffrer a zero, qu'elle ne fait
     rien. */
  function resultatsParCompetence(entree){
    const source = entree || {};
    const liste = Array.isArray(source.competences) ? source.competences : [];
    return liste.map(competence => ({
      competence,
      resultat:degatsAttendus({
        stats:source.entrees, competence, cible:source.cible
      })
    }));
  }

export { buffsApplicables, entreesDuCalcul, resultatsParCompetence };
```

- [ ] **Étape 6 : enregistrer aux quatre endroits**

`tests/helpers/modules.js`, après `"metier/degats-calcul.js"` :

```js
  "metier/degats-calcul.js",
  "metier/calculateur-entrees.js",
```

`sw.js`, `CORE_ASSETS` : ajouter `"./js/metier/calculateur-entrees.js"` après
`"./js/metier/degats-calcul.js"`, et `"./data/buffs-supports.js"` après
`"./data/competences.js"`.

`tests/helpers/load-app.js`, dans `hooks` :

```js
  buffsApplicables:typeof buffsApplicables === "function"
    ? buffsApplicables
    : undefined,
  entreesDuCalcul:typeof entreesDuCalcul === "function"
    ? entreesDuCalcul
    : undefined,
  resultatsParCompetence:typeof resultatsParCompetence === "function"
    ? resultatsParCompetence
    : undefined,
```

Le quatrième endroit — l'`import` du consommateur — est la tâche 4.

- [ ] **Étape 7 : ajouter le test aux deux scripts npm**

Dans `package.json`, après `node tests/degats-calcul.test.js`, **dans `test` et
dans `test:unit`** :

```
 && node tests/calculateur-entrees.test.js
```

- [ ] **Étape 8 : lancer**

```bash
node tests/calculateur-entrees.test.js
```

Attendu : PASS. `npm test` reste rouge sur `modules-imports` — c'est prévu.

- [ ] **Étape 9 : commit**

```bash
git add data/buffs-supports.js js/metier/calculateur-entrees.js \
        tests/calculateur-entrees.test.js tests/helpers/modules.js \
        tests/helpers/load-app.js sw.js package.json
git commit -m "feat: table des buffs de soutien et entrees du calculateur"
```

---

## Tâche 4 : la page Calculateur

**Fichiers :**
- Créer : `js/vues/calculateur.js`, `css/calculateur.css`
- Modifier : `index.html`, `js/app.js`, `tests/helpers/modules.js`,
  `tests/css-ordre.test.js`, `sw.js`

**Interfaces :**
- Consomme : `buffsApplicables`, `entreesDuCalcul`, `resultatsParCompetence`
  (tâche 3) ; `CIBLE_REFERENCE` (tâche 2) ; `calculateHeroStats` et
  `groupBuildStatResults` (`js/metier/stats-calcul.js`) ; `FOLDER_TO_ENUM`
  (`js/noyau/constantes.js`) ; `equippedEnumOf` (`js/metier/armes.js`) ;
  `metaOf` (`js/metier/catalogue.js`) ; `MemberRosterStore`
  (`js/donnees/roster-store.js`) ; `enregistrerVue` (`js/vues/navigation.js`).
- Produit : `renderCalculateur()` et `ouvrirCalculateur(charId, weaponType)`.

- [ ] **Étape 1 : l'onglet et le panneau**

`index.html`, après le bouton `tab-collection` (ligne 71-73) :

```html
    <button class="tab" id="tab-calculateur" data-view="calculateur"
            role="tab" aria-controls="view-calculateur"
            aria-selected="false" tabindex="-1">Calculateur</button>
```

Après la section `view-collection`, une section jumelle :

```html
  <section id="view-calculateur" class="view" role="tabpanel"
           aria-labelledby="tab-calculateur"></section>
```

⚠️ Relever d'abord les bornes exactes : `index.html` mélange CRLF et LF. Ne pas
normaliser le fichier.

- [ ] **Étape 2 : la feuille de style, à ses trois endroits**

`tests/css-ordre.test.js`, à la fin du tableau `FEUILLES` :

```js
  "wiki",
  "collection",
  "calculateur"
];
```

`index.html`, après le `<link>` de `collection.css` (ligne 31) :

```html
<link rel="stylesheet" href="./css/calculateur.css">
```

`sw.js`, `CORE_ASSETS`, après `"./css/collection.css"` :

```js
"./css/collection.css", "./css/calculateur.css",
```

Créer `css/calculateur.css` :

```css
.calc-form{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:16px}
.calc-champ{display:flex;flex-direction:column;gap:4px;min-width:150px}
.calc-champ label{font-size:12px;color:var(--muted)}
.calc-champ input{min-height:44px}
.calc-retouche{color:var(--gold-bright)}
.calc-avertissement{font-size:12px;color:var(--muted);margin:8px 0 16px}
.calc-soutiens{margin:16px 0;border-top:1px solid var(--line-soft);padding-top:12px}
.calc-buff{display:flex;gap:10px;align-items:center;padding:6px 0;min-height:44px}
.calc-table{width:100%;border-collapse:collapse}
.calc-table th,.calc-table td{padding:8px 6px;text-align:right;border-bottom:1px solid var(--line-soft)}
.calc-table th:first-child,.calc-table td:first-child{text-align:left}
.calc-valeur{font-variant-numeric:tabular-nums}
.calc-muette{color:var(--muted);font-style:italic}
@media (max-width:560px){
  .calc-table th:nth-child(2),.calc-table td:nth-child(2){display:none}
}
```

- [ ] **Étape 3 : écrire la vue**

Créer `js/vues/calculateur.js`. Points obligatoires, chacun vérifié en
tâche 5 :

1. **Chargement paresseux du catalogue**, sur le motif exact de
   `js/vues/wiki.js:52-70` — mêmes `let chargement = null`, même rejeu après
   échec, `src:"./data/competences.js"`. Faire de même pour
   `./data/buffs-supports.js`.
2. **L'élément vient de l'ARME équipée**, jamais du personnage :
   ```js
   /* Piege documente dans AGENTS.md : chaque slot d'arme porte SON element.
      `meta.element` fixe n'existe pas et ne doit pas etre invente. */
   function elementDuBuild(charId, hero){
     const meta = metaOf(charId);
     const equipee = equippedEnumOf(hero);
     const slot = meta && meta.weapons
       ? meta.weapons.find(w => w.weapon === equipee)
       : null;
     return slot ? (slot.element || "").toLowerCase() : null;
   }
   ```
3. **Les trois bases offensives** viennent de `calculateHeroStats(hero)`, lues
   par code via `groupBuildStatResults` : `B_Atk`, `C_Critical_Rate`,
   `C_Critical_Dam_Rate`. Un statut autre que `valid` ou `partial` n'affiche
   **aucun tableau** mais le message « Configuration à compléter ».
4. **La retouche** : chaque base est un `<input type="number">` pré-rempli.
   Toute valeur modifiée ajoute la classe `calc-retouche` au champ et fait
   apparaître l'en-tête `« Valeurs retouchées — ne reflète plus ton build »`.
   Un bouton « Réinitialiser » restaure les valeurs du build. **Rien n'est
   jamais écrit dans le roster.**
5. **Les soutiens** : `buffsApplicables(element)` remplit la section, chaque
   buff avec une case **décochée par défaut** et sa valeur modifiable.
   L'en-tête du résultat dit « héros seul » ou « avec N buff(s) d'équipe ».
6. **Le tableau** : une ligne par compétence, colonnes Non-crit / Crit /
   Espérance, valeurs formatées par `new Intl.NumberFormat("fr-FR")`. Une
   ligne dont `resultat` vaut `null` porte la classe `calc-muette` et le texte
   « Non inclus dans le calcul », **jamais un zéro**.
7. **Le nom affiché** de la compétence vient de `wiki-competences.js` par
   `gameId` ; à défaut, le `nom` anglais de `competences.js`, sans icône.
8. **Les avertissements**, en toutes lettres sous le tableau : les vingt
   niveaux de difficulté ne sont pas publiés, l'élément ne change rien sur
   Akumu, les durées des buffs ne sont pas modélisées, et la liste « Non inclus
   dans le calcul » de la spec.

- [ ] **Étape 4 : enregistrer la vue**

`tests/helpers/modules.js`, dans la couche `vues`, **avant**
`"vues/fiche-heros.js"` :

```js
  "vues/calculateur.js",
  "vues/fiche-heros.js",
```

**Ce rang n'est pas arbitraire.** Un module n'importe jamais un module déclaré
après lui, et la tâche 5 fait importer `calculateur.js` **par**
`fiche-heros.js`. Le déclarer après obligerait à le déplacer ensuite. En
contrepartie, `calculateur.js` ne doit rien importer de `fiche-heros.js` :
c'est `ouvrirCalculateur` qui voyage, jamais `heroDetail`.

`sw.js`, `CORE_ASSETS` : ajouter `"./js/vues/calculateur.js"`.

`js/app.js`, après la ligne 51 :

```js
  enregistrerVue("calculateur", renderCalculateur);
```

avec l'`import` correspondant en tête de fichier.

- [ ] **Étape 5 : lancer la suite complète**

```bash
npm test
```

Attendu : **tout au vert**, `PASS modules : imports déclarés et fichiers mis en
cache` et `PASS css : feuilles liées dans l'ordre` compris. C'est ici que les
enregistrements des tâches 2, 3 et 4 sont validés d'un coup.

Si `tests/supabase-etape1.playwright.js` ou
`tests/accessibilite-mobile.playwright.js` échoue, le relancer isolément avant
de conclure à une régression : les deux sont connus comme instables.

- [ ] **Étape 6 : vérifier au navigateur**

```bash
npx --yes http-server -p <port jamais utilisé> -c-1 --silent
```

Ouvrir l'onglet, choisir un personnage et un build : le tableau doit
apparaître, les buffs être décochés, et une retouche marquer l'en-tête.

- [ ] **Étape 7 : commit**

```bash
git add index.html js/app.js js/vues/calculateur.js css/calculateur.css \
        tests/helpers/modules.js tests/css-ordre.test.js sw.js
git commit -m "feat: onglet calculateur de degats par competence"
```

---

## Tâche 5 : le lien depuis la fiche de héros

**Fichiers :**
- Modifier : `js/vues/fiche-heros.js` (`heroDetail`, ligne 115),
  `js/vues/calculateur.js`
- Créer : `tests/calculateur.playwright.js`
- Modifier : `package.json` (scripts `test` et `test:e2e`)

**Interfaces :**
- Consomme : `ouvrirCalculateur(charId, weaponType)` (tâche 4), `showView`
  (`js/vues/navigation.js`).

- [ ] **Étape 1 : écrire le scénario qui échoue**

Créer `tests/calculateur.playwright.js` sur le modèle de
`tests/wiki.playwright.js` (même amorçage, même serveur). Assertions
obligatoires :

```js
  /* Le catalogue est PARESSEUX : absent avant l'ouverture de l'onglet,
     present apres. Le charger au demarrage couterait 7 491 lignes a chaque
     visiteur qui ne calcule rien. */
  assert.equal(
    await page.evaluate(() => typeof window.SEVEN_DS_COMPETENCES),
    "undefined",
    "le catalogue ne doit pas etre charge au demarrage"
  );
  await page.click("#tab-calculateur");
  await page.waitForFunction(() => !!window.SEVEN_DS_COMPETENCES);

  /* Les trois colonnes, et leur ordre : l'esperance est toujours encadree. */
  const ligne = page.locator(".calc-table tbody tr").first();
  const chiffres = (await ligne.locator(".calc-valeur").allTextContents())
    .map(t => Number(t.replace(/[^0-9]/g, "")));
  assert.equal(chiffres.length, 3, "trois colonnes par competence");
  assert.ok(chiffres[0] <= chiffres[2] && chiffres[2] <= chiffres[1],
    "non-crit <= esperance <= crit, recu : " + chiffres.join(", "));

  /* Aucun zero affiche a la place d'un inconnu. */
  const muettes = page.locator(".calc-muette");
  if(await muettes.count()){
    assert.match(await muettes.first().textContent(),
      /Non inclus dans le calcul/,
      "une competence non chiffrable porte la formule exacte");
    assert.doesNotMatch(await muettes.first().textContent(), /\b0\b/,
      "une competence non chiffrable ne doit jamais afficher un zero");
  }

  /* Les buffs sont decoches par defaut : le chiffre par defaut est celui du
     heros seul. */
  const coches = await page.locator(".calc-buff input:checked").count();
  assert.equal(coches, 0, "aucun buff de soutien coche par defaut");

  /* Retoucher une base marque le resultat. */
  const champAtk = page.locator(".calc-champ input").first();
  await champAtk.fill("99999");
  await champAtk.blur();
  assert.match(await page.locator(".calc-avertissement").textContent(),
    /retouch/i, "une valeur retouchee doit etre annoncee");
```

- [ ] **Étape 2 : lancer et constater l'échec**

```bash
node tests/calculateur.playwright.js
```

Attendu : échec sur `#tab-calculateur` si la tâche 4 est incomplète, sinon sur
l'assertion de retouche.

- [ ] **Étape 3 : ajouter le lien dans la fiche**

Dans `js/vues/fiche-heros.js`, `heroDetail` (ligne 115), après le bloc de
statistiques existant :

```js
    /* La fiche ne calcule plus rien elle-meme : un seul calcul, un seul
       endroit a corriger. Le lien porte le heros ET son type d'arme, pour que
       la page s'ouvre sur le build qu'on regardait. */
    const typeArme = weaponFolderOf(h);
    if(h.char && typeArme){
      col.appendChild(el("button",{
        class:"btn btn-ghost hd-calcul",
        type:"button",
        text:"Calculer les dégâts",
        onclick:()=>ouvrirCalculateur(h.char, typeArme)
      }));
    }
```

avec, en tête de fichier :

```js
import { ouvrirCalculateur } from "./calculateur.js";
```

La tâche 4 étape 4 a déjà déclaré `"vues/calculateur.js"` **avant**
`"vues/fiche-heros.js"` dans `tests/helpers/modules.js` : cet `import` est
précisément la raison de ce rang. Vérifier qu'il n'a pas bougé, et que
`calculateur.js` n'importe toujours rien de `fiche-heros.js` — l'inverse
créerait un cycle que `tests/modules-imports.test.js` refuse.

- [ ] **Étape 4 : inscrire le scénario dans les scripts npm**

Dans `package.json`, après `node tests/collection.playwright.js`, **dans `test`
et dans `test:e2e`** :

```
 && node tests/calculateur.playwright.js
```

- [ ] **Étape 5 : lancer**

```bash
node tests/calculateur.playwright.js
npm test
```

Attendu : tout au vert.

- [ ] **Étape 6 : vérifier au navigateur**

Serveur sur un port jamais utilisé. Ouvrir la fiche d'un héros du roster,
cliquer « Calculer les dégâts » : la page doit s'ouvrir pré-remplie sur ce
héros et ce type d'arme.

- [ ] **Étape 7 : commit**

```bash
git add js/vues/fiche-heros.js js/vues/calculateur.js \
        tests/helpers/modules.js tests/calculateur.playwright.js package.json
git commit -m "feat: ouvrir le calculateur depuis la fiche de heros"
```

---

## Auto-relecture du plan

**Couverture de la spec.** Page dédiée → tâche 4. Cible Akumu et ses trois
conséquences affichées → tâche 2 étape 5 et tâche 4 étape 3 point 8. Détail par
compétence, trois colonnes → tâche 2 étapes 3 et 6, tâche 4 point 6, vérifié en
tâche 5. Retouche marquée et jamais persistée → tâche 4 point 4, vérifiée en
tâche 5. Table de buffs manuelle avec provenance → tâche 3 étapes 1 et 2,
gardée par le test de l'étape 3. Trois natures de buff → règles de
transcription, tâche 3 étape 2. Filtre par élément lu depuis l'arme → tâche 3
(`buffsApplicables`) et tâche 4 point 2, testé aux deux niveaux. Jointure par
`gameId` avec repli sur le nom anglais → tâche 4 point 7. Ni zéro ni ligne
masquée → testé en tâches 3 et 5. Lien depuis la fiche → tâche 5. Import
sélectif sans rebase → tâches 1 et 2 étape 1. Quatre enregistrements → tâches
2, 3 et 4, validés d'un coup par `npm test` en tâche 4 étape 5.

**Écarts assumés par rapport à la spec.**

1. La spec annonçait les catalogues « chargés par `index.html` en `<script>`
   classique ». `data/wiki-competences.js`, pourtant plus petit (4 118 lignes
   contre 7 491), est chargé **paresseusement** par `js/vues/wiki.js` et n'est
   pas dans `index.html`. Le plan suit cette convention et charge le catalogue
   à l'ouverture de l'onglet, tout en le **précachant** — le calculateur
   prolonge le builder, qui fonctionne hors ligne. Le wiki, lui, n'est pas
   modifié.
2. La spec listait quatre entrées de moteur (`atk`, `critRate`, `critDamage`,
   `bonusType`). Le moteur de la branche a évolué : il consomme des
   `composantes` (`atk`/`def`/`hp`) et **trois** bonus offensifs distincts.
   `CIBLE_DU_BUFF` les distingue, parce que le moteur les distingue — les
   confondre poserait une équivalence que la formule n'écrit pas.
3. La spec nommait les colonnes `sansCritique` et `critique`. Le plan retient
   `avecCritique` : `critique` est déjà le nom de la constante locale portant
   le multiplicateur d'espérance, et l'ombrer serait un vrai piège de lecture.
4. La spec ne mentionnait pas le champ `operation`. Le relevé des descriptions
   a montré deux formes irréductibles — « +10 % de l'attaque des alliés »
   (multiplicatif) et « à hauteur de 30 % de l'attaque du héros, Max 3000 »
   (plat). Les aplatir aurait produit des chiffres faux.
5. Le slug de « Dedrin » reste à confirmer (`dreydrin` ou `derieri`). La tâche 3
   étape 1 le signale ; c'est une valeur de liste, pas une décision
   d'architecture.

**Cohérence des types.** `degatsAttendus` rend `{ total, sansCritique,
avecCritique, parCoup, termes }` en tâche 2 ; `resultatsParCompetence` le
transporte tel quel en tâche 3 ; la tâche 4 point 6 en lit trois colonnes et la
tâche 5 les vérifie dans cet ordre. `buffsApplicables`, `entreesDuCalcul` et
`resultatsParCompetence` portent les mêmes noms dans le bloc « Interfaces » de
la tâche 3, dans son test, dans son module, dans les `hooks` et dans les
consommateurs de la tâche 4. Les classes `.calc-table`, `.calc-valeur`,
`.calc-muette`, `.calc-buff`, `.calc-champ` et `.calc-avertissement` sont
identiques entre le CSS (tâche 4 étape 2), la vue (étape 3) et le scénario
(tâche 5 étape 1).
