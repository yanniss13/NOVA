# Wiki lot 2 — plan d'implémentation

> **Pour l'exécutant :** spec de référence
> `docs/superpowers/specs/2026-08-06-wiki-lot2-equipement-design.md`.
> Les étapes se cochent (`- [ ]`) au fur et à mesure.

**But :** ajouter au wiki quatre catégories — Armes, Armures, Bijoux, Armures
gravées — avec leurs fiches, leurs passifs et les bonus d'ensemble.

**Architecture :** aucune aspiration réseau. Tout vient de `data/stats-build.js`,
déjà précaché, joint à `data/data.js` par le chemin d'image. Un seul champ y est
ajouté : la prose des bonus d'ensemble.

**Pile :** ES modules sans étape de build, données en `window.SEVEN_DS_*`,
générateurs Python, tests `node:test` + Playwright.

## Contraintes globales

- **Tout export doit être importé par quelqu'un** — `tests/modules-imports.test.js`
  refuse un export orphelin. C'est ce qui dicte le regroupement des tâches
  ci-dessous : un module et son premier consommateur atterrissent ensemble.
- **Tout module de `js/` doit figurer dans `tests/helpers/modules.js` et dans
  `CORE_ASSETS` de `sw.js`** — `tests/pwa.test.js` le vérifie.
- **Les couches de `tests/helpers/modules.js` sont ordonnées** : une couche ne
  dépend jamais d'une couche plus bas dans la liste.
- **`data/stats-build.js` ne s'édite jamais à la main** : `--check` compare le
  fichier au rendu du générateur, octet pour octet.
- **Aucune liste de valeurs de filtre écrite à la main** : elles se dérivent des
  données observées. C'est la règle qui a évité le piège `SUPPORT` / `Supporter`
  au lot 1.
- **`tests/wiki.playwright.js` doit passer sans retouche** à la fin de chaque
  tâche : c'est la preuve de non-régression du lot 1.
- Commentaires et libellés en français, sans accent dans les commentaires de
  code (convention du dépôt).

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `scripts/generate-stats-build.py` *(modifié)* | ajoute `twoTextFr` / `fourTextFr` / `sevenTextFr` aux ensembles |
| `js/metier/wiki-equipement.js` *(créé)* | joint images et statistiques ; les quatre listes, l'ensemble et ses pièces. Pur. |
| `js/vues/wiki.js` *(modifié)* | table des cinq catégories, filtres construits par catégorie, grille |
| `js/vues/wiki-blocs.js` *(créé)* | briques de rendu partagées par les quatre fiches |
| `js/vues/wiki-fiche-objet.js` *(créé)* | la modale des objets : navigation, clavier, aiguillage |
| `js/vues/wiki-corps-arme.js` *(créé)* | le corps d'une fiche d'arme |
| `js/vues/wiki-corps-equipement.js` *(créé)* | le corps d'une pièce ou d'une armure gravée |
| `js/vues/wiki-fiche-heros.js` *(modifié)* | ses trois helpers privés partent dans `wiki-blocs.js` |

---

### Tâche 1 : la prose des ensembles

**Fichiers :**
- Modifier : `scripts/generate-stats-build.py:241-264` (`gear_set_entry`)
- Régénérer : `data/stats-build.js`
- Test : `tests/stats-build-catalog.test.js:216-243`

**Interfaces produites :** `catalog.gearSets[id].twoTextFr` (string),
`.fourTextFr` et `.sevenTextFr` (string ou `null`, alignés sur la présence du
seuil correspondant).

- [ ] **Étape 1 : écrire l'assertion qui échoue**

Dans la boucle `sets.forEach` de `tests/stats-build-catalog.test.js`, exiger que
tout palier publié porte son texte, et qu'un palier absent n'en porte pas :

```js
  assert.equal(typeof entry.twoTextFr, "string", id + " : premier palier sans texte");
  [["fourCount", "fourTextFr"], ["sevenCount", "sevenTextFr"]]
    .forEach(([count, texte]) => {
      if(entry[count] === null || entry[count] === undefined){
        assert.equal(entry[texte], null, id + " : " + texte + " sans seuil");
      }else{
        assert.equal(typeof entry[texte], "string", id + " : " + count + " sans texte");
      }
    });
```

- [ ] **Étape 2 : vérifier l'échec**

`node --test tests/stats-build-catalog.test.js` → échec sur `twoTextFr`
`undefined`.

- [ ] **Étape 3 : ajouter les trois champs au générateur**

Dans `gear_set_entry`, à côté des `*Stats` :

```python
        "twoTextFr": raw.get("bonusTwoFr"),
        "fourTextFr": raw.get("bonusFourFr"),
        "sevenTextFr": raw.get("bonusSevenFr"),
```

Le texte part tel quel, balisage `[#RRGGBB]texte[-]` compris : `renderBonus()`
le rend côté vue, comme pour les potentiels et les compétences.

- [ ] **Étape 4 : régénérer et vérifier**

```
python scripts/generate-stats-build.py
node --test tests/stats-build-catalog.test.js
python scripts/generate-stats-build.py --check
```

- [ ] **Étape 5 : commit**

```
git add scripts/generate-stats-build.py data/stats-build.js tests/stats-build-catalog.test.js
git commit -m "feat: porter la prose des bonus d'ensemble dans le catalogue"
```

---

### Tâche 2 : le module métier, le rail et les grilles

Le module métier et son premier consommateur atterrissent ensemble : un export
que personne n'importe fait échouer `tests/modules-imports.test.js`.

À la fin de cette tâche les tuiles des quatre nouvelles catégories sont
**inertes** — la fiche d'objet arrive en tâche 4. C'est le patron déjà employé
au lot 1 (`ouvrirFiche` valant `null` jusqu'au branchement).

**Fichiers :**
- Créer : `js/metier/wiki-equipement.js`, `tests/wiki-equipement.test.js`,
  `tests/wiki-lot2.playwright.js`
- Modifier : `js/vues/wiki.js`, `index.html`, `css/wiki.css`,
  `tests/helpers/modules.js`, `sw.js`, `package.json`

**Interfaces produites :**

```js
// js/metier/wiki-equipement.js
armesDuWiki()   // [{file, nom, type, raretes:[string], aPassif:boolean}]
armuresDuWiki() // [{file, nom, slot, setId, grade}]
bijouxDuWiki()  // [{file, nom, slot, setId, grade}]
graveesDuWiki() // [{file, nom, heros}]   heros = slug, ou null
ensembleDe(setId) // {id, nom, paliers:[{compte, stats, texte}], pieces:[file]} | null
objetDuWiki(file) // l'entrée de liste correspondant au chemin, ou null
```

**Interfaces consommées :** `DATA.armes`, `DATA.armures`, `DATA.bijoux`,
`BUILD_STATS.weaponsByFile`, `.gearByFile`, `.engravedByFile`, `.gearSets`.

- [ ] **Étape 1 : écrire `tests/wiki-equipement.test.js`**

Le module tourne dans un `vm` via `tests/helpers/load-app.js` ; comparer avec
`plain()` pour éviter le piège des tableaux inter-royaumes. Cas couverts :

- `armesDuWiki()` rend 155 entrées, dont 94 avec `aPassif` vrai ;
- `armuresDuWiki()` rend 62 entrées, `bijouxDuWiki()` 37, `graveesDuWiki()` 68 ;
- une image absente de `stats-build.js` reste listée, ses champs chiffrés nuls ;
- `ensembleDe("inconnu")` rend `null` ;
- `ensembleDe("accessory_t5_corruption")` rend **toutes** ses pièces, bijoux
  compris ;
- un ensemble sans seuil 7 n'expose pas de palier 7 ;
- les listes sont triées par nom.

- [ ] **Étape 2 : vérifier l'échec**

`node --test tests/wiki-equipement.test.js` → module introuvable.

- [ ] **Étape 3 : écrire `js/metier/wiki-equipement.js`**

Pur, sans DOM. Une pièce sans entrée statistique **reste listée** : une image
ajoutée avant la régénération doit apparaître, pas disparaître.

- [ ] **Étape 4 : déclarer le module**

`tests/helpers/modules.js` — dans la couche `metier`, après
`metier/wiki-competences.js`. `sw.js` — dans `CORE_ASSETS`.

- [ ] **Étape 5 : vérifier**

`node --test tests/wiki-equipement.test.js` puis `npm test` : `modules-imports`
doit **échouer** ici, personne n'important encore le module. C'est le signal
attendu ; l'étape suivante le résout.

- [ ] **Étape 6 : le rail et les filtres dans `index.html`**

Les quatre boutons de catégorie à la suite de `#wikiCategoryHeros`, avec les
identifiants `#wikiCategoryArmes`, `#wikiCategoryArmures`, `#wikiCategoryBijoux`,
`#wikiCategoryGravees`. Les quatre `<select>` figés sont remplacés par
`<div class="wiki-filters" id="wikiFilters"></div>` ; le champ `#wikiSearch`
reste dans l'HTML, seul son `placeholder` change selon la catégorie.

- [ ] **Étape 7 : la table des catégories dans `js/vues/wiki.js`**

Chaque catégorie déclare : `cle`, `libelle`, `source()`, `recherche`
(le placeholder), `filtres[]` (chacun avec son `id`, son libellé, son extracteur
de valeurs et son prédicat), et `tuile(entree)`.

Les filtres de la catégorie Personnages **gardent leurs identifiants**
(`wikiFilterElement`, `wikiFilterWeapon`, `wikiFilterRole`, `wikiFilterRarity`) :
`tests/wiki.playwright.js` s'y appuie et ne doit pas être retouché.

Les valeurs se dérivent des entrées listées, jamais d'une liste écrite ici.

- [ ] **Étape 8 : écrire `tests/wiki-lot2.playwright.js`** *(volet grilles)*

Passer d'une catégorie à l'autre ; vérifier que le nombre de tuiles change et
correspond aux effectifs (155 / 62 / 37 / 68) ; qu'un filtre restreint la
grille dans chacune ; que revenir sur Personnages restaure ses quatre filtres.
Guetteur de réponses `.webp` ≥ 400, comme `wiki.playwright.js`.

- [ ] **Étape 9 : brancher le test et vérifier**

Ajouter le fichier aux trois scripts de `package.json`, puis `npm test` :
tout au vert, `tests/wiki.playwright.js` compris et non modifié.

- [ ] **Étape 10 : commit**

```
git commit -m "feat: ouvrir le wiki aux armes, armures, bijoux et gravees"
```

---

### Tâche 3 : extraire les briques de rendu partagées

Refactorisation pure, sans changement de comportement.
`tests/wiki.playwright.js` en est la preuve : il doit passer inchangé.

**Fichiers :**
- Créer : `js/vues/wiki-blocs.js`
- Modifier : `js/vues/wiki-fiche-heros.js`, `tests/helpers/modules.js`, `sw.js`

**Interfaces produites :**

```js
titreSection(texte, ton)      // <div class="wiki-section wiki-section-<ton>">
ligneDeStat(code, valeur)     // <li class="wiki-stat"> ou null
listeDeStats(entrees)         // <ul class="wiki-stats"> ou null si vide
selecteurNiveaux(niveaux, actif, auChangement)  // <div class="wiki-levels">
repliable(titre, contenu)     // <details class="wiki-fold"> ou null
```

- [ ] **Étape 1 : créer `js/vues/wiki-blocs.js`**

Y déplacer `titreSection`, `ligneDeStat` et `repliable` **à l'identique** depuis
`wiki-fiche-heros.js`, commentaires compris. Y ajouter `listeDeStats` et
`selecteurNiveaux`, encore inutilisés à ce stade — ils le seront en tâche 4, dans
le même souffle.

`selecteurNiveaux` reprend la forme du sélecteur d'arme : des boutons
`aria-pressed`, l'actif marqué `.active`.

- [ ] **Étape 2 : faire importer `wiki-fiche-heros.js`**

Retirer ses trois définitions privées, importer depuis `./wiki-blocs.js`.

- [ ] **Étape 3 : déclarer le module**

`tests/helpers/modules.js` — couche `vues`, **avant** `vues/wiki-fiche-heros.js`.
`sw.js` — dans `CORE_ASSETS`.

- [ ] **Étape 4 : vérifier**

`npm test`. `tests/wiki.playwright.js` passe sans retouche : les replis
« Potentiels / Maîtrises d'arme / Stats de base / Armures gravées » et les
titres de section sont rendus à l'identique.

*Note : `listeDeStats` et `selecteurNiveaux` n'ont pas encore de consommateur.
Si `modules-imports.test.js` les refuse, les ajouter en tâche 4 plutôt qu'ici,
et n'extraire à cette étape que les trois helpers déplacés.*

- [ ] **Étape 5 : commit**

```
git commit -m "refactor: partager les briques de rendu du wiki"
```

---

### Tâche 4 : les trois fiches d'objet

**Fichiers :**
- Créer : `js/vues/wiki-fiche-objet.js`, `js/vues/wiki-corps-arme.js`,
  `js/vues/wiki-corps-equipement.js`
- Modifier : `js/vues/wiki.js` (export `brancherFicheObjet`), `index.html`
  (`#wikiItemOverlay`), `css/wiki.css`, `js/app.js`, `tests/helpers/modules.js`,
  `sw.js`, `tests/wiki-lot2.playwright.js`

**Interfaces consommées :** `ensembleDe`, `objetDuWiki` du module métier ;
`titreSection`, `listeDeStats`, `selecteurNiveaux`, `repliable` de
`wiki-blocs.js` ; `renderBonus`, `ModalStack`, `formatBuildStatValue`.

**Interfaces produites :** `brancherFicheObjet(fonction)` exporté par `wiki.js`,
appelé par `wiki-fiche-objet.js` au chargement — le patron de `brancherFiche`.

- [ ] **Étape 1 : l'overlay dans `index.html`**

`#wikiItemOverlay` calqué sur `#wikiHeroOverlay` : `#wikiItemTitle`,
`#wikiItemClose`, `#wikiItemPrev`, `#wikiItemPosition`, `#wikiItemNext`,
`#wikiItemBody`.

- [ ] **Étape 2 : `js/vues/wiki-corps-arme.js`**

Rend les nœuds du corps d'une arme, dans l'ordre de la spec : en-tête, passif à
sélecteur 1→7 ouvert sur le maximum, statistique principale par rareté,
enchantements. **Pas de section passif** pour les 61 armes qui n'en ont pas.

- [ ] **Étape 3 : `js/vues/wiki-corps-equipement.js`**

En-tête, provenance (ensemble et ses pièces sœurs cliquables, ou héros lié
cliquable), passif 1→3 si présent, statistiques, gravures. Les deux rappels
— ouvrir une pièce sœur, ouvrir la fiche du héros — passent par des fonctions
reçues en paramètre plutôt que par un import : le corps ne connaît pas la
modale qui l'affiche.

- [ ] **Étape 4 : `js/vues/wiki-fiche-objet.js`**

La modale : `ouvrirFicheObjet(file, entrees)`, précédent / suivant, flèches
gauche / droite, compteur, fermeture, et l'aiguillage vers l'un des deux corps.

Reprendre **les deux gardes de focus** de `wiki-fiche-heros.js`, sans quoi les
flèches meurent après un clic :
1. relever avant de vider le corps si le focus était sur un bouton du corps, et
   le rendre à son remplaçant ;
2. rendre le focus quand `precedent`/`suivant` devient `disabled`.

- [ ] **Étape 5 : brancher**

`wiki.js` exporte `brancherFicheObjet` et l'appelle depuis la tuile des quatre
catégories. `app.js` importe `./vues/wiki-fiche-objet.js` pour effet de bord.
Déclarer les trois modules dans `tests/helpers/modules.js` et `sw.js`.

- [ ] **Étape 6 : le CSS**

À la suite de `css/wiki.css` : en-tête d'objet, pastilles de niveau, pièces
sœurs, bloc d'ensemble, héros lié. Traiter la coupure à 520 px et le bloc
`prefers-reduced-motion` déjà présents.

- [ ] **Étape 7 : étendre `tests/wiki-lot2.playwright.js`** *(volet fiches)*

Ouvrir une arme à passif et vérifier les 7 pastilles ; changer de niveau et
voir le texte changer ; ouvrir une arme sans passif et vérifier l'absence de la
section ; ouvrir une pièce d'ensemble, vérifier la prose rendue (pas de `[#`
laissé brut) et cliquer une pièce sœur ; ouvrir une armure gravée et cliquer
son héros pour arriver sur `#wikiHeroOverlay` ; naviguer au clavier.

- [ ] **Étape 8 : vérifier**

`npm test` complet, `tests/wiki.playwright.js` toujours inchangé.

- [ ] **Étape 9 : commit**

```
git commit -m "feat: ouvrir les fiches d'arme, de piece et d'armure gravee"
```

---

### Tâche 5 : la documentation

**Fichiers :** `AGENTS.md`

- [ ] **Étape 1 : compléter la section wiki**

Les cinq catégories, la provenance de chaque table, et le point à retenir : le
lot 2 **n'aspire rien**, il joint `data.js` à `stats-build.js` par le chemin
d'image. Nommer aussi le seul ajout à un générateur, la prose des ensembles, et
pourquoi elle ne pouvait pas venir des `*Stats`.

- [ ] **Étape 2 : vérifier et commit**

`npm test`, puis :

```
git commit -m "docs: decrire les categories du lot 2 du wiki"
```

---

## Relecture du plan

**Couverture de la spec.** Prose des ensembles → tâche 1. Module métier →
tâche 2. Rail à cinq catégories et filtres par catégorie → tâche 2. Briques
partagées → tâche 3. Les trois fiches, les pièces sœurs, le héros lié →
tâche 4. Tests unitaires → tâche 2, Playwright → tâches 2 et 4. `AGENTS.md` →
tâche 5.

**Cohérence des noms.** `ensembleDe` et `objetDuWiki` sont définis en tâche 2 et
consommés en tâche 4 sous les mêmes noms. `brancherFicheObjet` est produit par
`wiki.js` et appelé par `wiki-fiche-objet.js`, en miroir de `brancherFiche`.
`selecteurNiveaux` et `listeDeStats` sont créés en tâche 3 et consommés en
tâche 4 — d'où la note sur `modules-imports.test.js` à l'étape 4 de la tâche 3.

**Piège connu, déjà rencontré au lot 1.** L'invariant « tout export est
importé » impose que module et consommateur atterrissent dans le même commit.
C'est la raison du regroupement de la tâche 2 et de la note de la tâche 3 ; ce
n'est pas un découpage arbitraire.
