# Détail du calcul lisible — conception

**Date :** 2026-07-29
**Base :** `main` = `4be3fae` (parité des statistiques de Merlin livrée)
**État :** conception validée par le propriétaire
**Périmètre :** rendu du bloc « Détail du calcul ». Aucune modification du moteur.

## 1. Le défaut constaté

Sur le détail des PV de Merlin, le bloc « Détail du calcul » empile des dizaines
de lignes identiques :

```
Application du taux                    ×1,03 — base présumée
Source : mastery · weapon-mastery · unité dix-millièmes · arme Wand ·
nœud 2 · node · code original I_MaxHpAdd_Rate · seaux character:base,
mastery:common, mastery:Wand, mastery:reserve:Book, mastery:reserve:Staff,
armor:Bas, armor:Ceinture, engraving:Armure liee, jewel:Boucle d'oreille
```

Le calcul est juste. Chaque source de pourcentage produit son propre terme
multiplicatif ciblant `B_MaxHp`, ce qui est le contrat voulu : la maîtrise
Baguette donne 1 200 dix-millièmes répartis sur quatre nœuds, soit `+3 %`
chacun. Avec les maîtrises de réserve ajoutées par `4be3fae`, le potentiel,
l'équipement et les ensembles, le nombre de termes rend le bloc illisible.

Trois défauts distincts, tous dans le rendu :

1. **La notation ment sur l'opération.** Le moteur calcule
   `base × (1 + Σ taux)`. Afficher `×1,03` pour chaque terme laisse croire à un
   produit composé : trois nœuds à 3 % font `+9 %`, pas `+9,27 %`.
2. **La liste des seaux est recopiée sur chaque ligne.**
   `heroTermProvenance()` termine par `"seaux "+term.appliesTo.join(", ")`. Cette
   liste est identique pour tous les termes d'une même statistique et représente
   l'essentiel du volume affiché. Elle décrit la statistique, pas le terme.
3. **Le libellé ne distingue rien.** « Application du taux » est identique
   partout ; ce qui différencie les lignes est noyé dans la ligne de provenance.

## 2. Triplication du rendu

Le même bloc est écrit trois fois dans `index.html` :

| Emplacement | Fonction | Portée |
| --- | --- | --- |
| ~4234 | `heroStatDetails()` | statistiques du héros |
| ~4547 | bloc inline | aperçu de configuration d'arme |
| ~5365 | bloc inline | aperçu de configuration d'équipement |

Les trois portent les mêmes défauts latents. Le lot les remplace par une
fonction unique.

## 3. Décisions du propriétaire

- Unifier les trois rendus plutôt que ne réparer que celui du héros, en assumant
  le risque de régression sur les panneaux arme et équipement.
- Grouper l'équipement en une seule ligne, le détail par pièce restant
  accessible en dépliant.
- Le lot est réversible : si le rendu ne convient pas, on revient en arrière ou
  on ajuste le groupement sans toucher au moteur.

## 4. Architecture retenue

### 4.1 Fonction unique

Signature figée :

```js
statTermsDetails(stat, {
  termLabel,      // (term) => string
  termValue,      // (term, group) => string   texte de la colonne de droite
  termProvenance, // (term) => string
  termEmphasis    // (term) => string | null   classe de mise en avant
})
```

Elle consomme la forme déjà produite par `groupBuildStatResults()` :
`{ stat, unit, value, label, terms }`. Elle est utilisée par les trois appelants
et ne connaît ni le héros, ni l'arme, ni l'équipement.

Les fonctions existantes (`heroTermLabel` / `heroTermProvenance`,
`weaponTermLabel` / `weaponTermProvenance`, `gearTermLabel` /
`gearTermProvenance`) restent la source des noms et des provenances. L'appelant
les fournit ; `statTermsDetails` ne les choisit jamais elle-même.

`termEmphasis` et `termValue` remplacent un paramètre `context` fourre-tout :
ce sont les **deux seules** différences restantes entre appelants, et les nommer
les rend testables. Un rappel de contexte non typé inviterait à y glisser peu à
peu la logique d'affichage que cette fonction est justement censée unifier.

**Pourquoi `termValue` existe.** Le texte de la colonne de droite n'est pas le
même d'un appelant à l'autre pour un multiplicateur :

| Appelant | Colonne de droite aujourd'hui |
| --- | --- |
| Panneau d'arme | `weaponTermLabel(term)` en entier, soit `Outrepassement ×1,05 — base présumée` |
| Fiche du héros | `×1,05 — base présumée` |
| Panneau d'équipement | aucun multiplicateur en pratique |

`tests/potentiel-commun.playwright.js` (~625) compare le texte **exactement**
(`assert.equal` après `trim()`). Une règle de valeur commune casserait donc ce
test, que ce lot s'interdit de réécrire. `termValue` reçoit le groupe en second
argument afin de connaître `group.mainRate` et d'appliquer la notation additive
aux seuls taux principaux.

**Le lot ne change pas quelles lignes sont mises en avant.** `termEmphasis`
reproduit exactement les règles actuelles :

| Appelant | Règle existante | Référence |
| --- | --- | --- |
| Fiche du héros | tout terme `multiply` | `index.html` ~4261 |
| Panneau d'arme | tout terme `multiply` | `index.html` ~4572 |
| Panneau d'équipement | aucun | `index.html` ~5377 |

À noter pour éviter une erreur de lecture du code existant : sur la fiche du
héros, `presumedMultiplierBase` (~4239) ne pilote **que** le suffixe texte
« — base présumée ». Il ne conditionne pas la classe. Restreindre la mise en
avant aux termes présumés serait un changement de comportement ; il n'est pas
demandé et n'entre pas dans ce lot.

### 4.2 Clé de groupe

Deux termes ne sont regroupés que s'ils produiraient **exactement la même
ligne**. La clé est donc le quintuplet :

```text
( libellé rendu, operation, unit, appliesTo normalisé, termEmphasis(term) || "" )
```

`appliesTo` est trié puis joint ; il vaut la chaîne vide pour un terme `add`.

`termEmphasis` fait partie de la clé parce qu'il modifie la ligne rendue :
fusionner un terme mis en avant avec un terme qui ne l'est pas produirait une
ligne unique dont la mise en forme trahit l'un des deux.

**Pourquoi `appliesTo` fait partie de la clé.** La contribution d'un
multiplicateur vaut `base(appliesTo) × valeur / 10 000`. Sommer les taux de deux
multiplicateurs qui ne visent pas les mêmes seaux afficherait un total appliqué
à une base qui n'existe pas. Aujourd'hui `heroMainRateTargetBuckets()` renvoie
la même liste pour tous les taux d'une même statistique, donc le cas ne se
présente pas — mais la clé doit l'interdire structurellement, pas compter
là-dessus.

**Pourquoi le libellé plutôt qu'une table `domain`/`component`.** Les fonctions
`weaponTermLabel`, `gearTermLabel` et `heroTermLabel` font déjà ce travail
sémantique. Une seconde table ferait doublon et divergerait. Surtout, une table
qui range `level`, `promotion` et `overlimit` sous un même groupe « Arme »
casserait `tests/potentiel-commun.playwright.js` (~243) : ce test ouvre un seul
`summary` puis exige que « Promotion » soit **visible**. Avec ces libellés
distincts, chacun reste une ligne de premier niveau et le test continue de
passer.

Deux ajustements de libellé, et deux seulement :

- dans le contexte du héros, les domaines `armor`, `jewel` et `engraving` sont
  libellés **« Équipement »**, ce qui réunit les pièces en une ligne comme
  décidé. Le détail par pièce reste lisible en dépliant, via la provenance de
  chaque terme ;
- un multiplicateur portant `source.application === "hero-main-rate"` est
  libellé d'après **sa provenance d'origine** (« Maîtrise Baguette »,
  « Potentiel P7 », « Équipement »), et non « Application du taux ». C'est ce
  qui produit les sous-lignes de §4.4 au lieu d'un bloc indistinct.

Un terme dont le libellé est inconnu forme son propre groupe. Le rendu ne doit
jamais masquer un terme qu'il ne sait pas classer.

### 4.3 Séparation additifs / multiplicateurs

Dans un groupe, les termes `add` et les termes `multiply` ne sont jamais
fusionnés : ce sont deux opérations différentes sur deux unités différentes.

- les termes `add` d'un groupe sont sommés et affichés dans l'unité du total ;
- les termes `multiply` **portant `source.application === "hero-main-rate"`**
  sont réunis sous une seule entrée **« Taux principaux »**, elle-même
  sous-groupée par provenance.

Tout autre multiplicateur reste dans le groupe de sa provenance. C'est le cas de
l'outrepassement d'arme (`source.component === "overlimit"`), qui ne vise pas
les mêmes seaux et possède sa propre base présumée : le fondre dans « Taux
principaux » afficherait un total faux.

C'est ce regroupement qui supprime l'empilement constaté, puisque les termes
répétés sont précisément les taux principaux.

### 4.4 Rendu cible

PV de la Merlin Foudre du propriétaire. Les termes ont été **relevés sur la
sortie réelle de `calculateHeroStats()`**, pas reconstitués : nombres d'apports,
répartition des taux et palier de potentiel compris.

```
Base du personnage                              +2 000 points
Maîtrise commune                                +1 248 points
Maîtrise Baguette            8 apports          +3 024 points
Maîtrises de réserve         8 apports          +3 024 points
Équipement                   4 apports         +60 338 points
Taux principaux                                 +41 %            ▸
    Maîtrise Baguette        4 apports          +12 %
    Maîtrises de réserve     8 apports          +24 %
    Potentiel P7                                 +5 %
Arrondi du jeu                                   +0,06 point
                                        Total   98 184
```

Contrôles :

- `12 + 24 + 5 = 41 %` — aucune ligne d'équipement dans les taux, ce build n'a
  aucune option aléatoire en `I_MaxHpAdd_Rate` ;
- `P7` donne bien `I_MaxHpAdd_Rate: 500` dans `7ds-stats/personnages.json`,
  branche Wand ;
- `(2 000 + 1 248 + 3 024 + 3 024 + 60 338) × 1,41 = 98 183,94`, arrondi au
  supérieur à `98 184` ;
- la base `9 296` et l'équipement `60 338` correspondent au détail relevé dans
  le jeu.

Cet exemple sert de fixture de régression : le rendu doit produire exactement
ces lignes pour ce build.

Règles d'affichage :

- un groupe qui ne contient qu'un terme n'affiche pas de compteur ;
- un groupe de plusieurs termes affiche leur nombre suivi du mot invariable
  `apports` (`4 apports`). Aucun vocabulaire par domaine n'est inventé : le mot
  est le même pour un nœud de maîtrise, une pièce ou un ensemble ;
- **les taux s'écrivent `+3 %` uniquement pour les multiplicateurs portant
  `source.application === "hero-main-rate"`.** Tout autre multiplicateur garde
  la notation de sa fonction de libellé. En particulier l'outrepassement d'arme
  conserve `Outrepassement ×1,05 — base présumée`, chaîne assertie mot pour mot
  par `tests/potentiel-commun.playwright.js` (~253) : sa base et ses seaux ne
  sont pas ceux des taux du héros, une notation additive y serait fausse ;
- « base présumée » apparaît une fois sous le bloc pour les taux principaux, dès
  qu'au moins un de leurs termes porte `confidence: "presumed"` ; celle de
  l'outrepassement reste sur sa propre ligne ;
- la liste des seaux ciblés apparaît **une fois par valeur distincte
  d'`appliesTo` normalisée**, et non une fois par statistique. Une même
  statistique en porte plusieurs : les taux principaux visent tous les seaux
  fixes, tandis que l'outrepassement d'arme ne vise que les seaux natifs de
  l'arme. Une ligne unique en pied de bloc afficherait la mauvaise base pour
  l'un des deux ;
- l'outrepassement d'arme garde sa mise en avant existante
  (`weapon-stat-term-overlimit`).

## 5. Invariants à ne pas casser

Ces points sont couverts par des tests existants ou à ajouter. Ils sont la
raison pour laquelle ce lot ne touche pas au moteur.

### 5.1 Structure DOM imposée

Un groupe de **plusieurs** termes :

```html
<details class="stat-term-group">          <!-- fermé par défaut -->
  <summary class="stat-term-group-head">…total groupé…</summary>
  <div class="weapon-stat-term" data-term-id="…">…</div>
  <div class="weapon-stat-term" data-term-id="…">…</div>
</details>
```

Un groupe d'**un seul** terme n'introduit aucun repli : son
`.weapon-stat-term` est un enfant direct du `<details>` principal, donc visible
dès son ouverture.

```html
<div class="weapon-stat-term" data-term-id="…">…</div>
```

Deux règles non négociables :

- **le `<summary>` d'un groupe ne porte jamais la classe
  `.weapon-stat-term`.** Sinon le compte de nœuds cesse de correspondre aux
  termes du moteur et les sélecteurs des tests attrapent un résumé au lieu d'un
  terme ;
- **un groupe à un terme reste directement visible.** C'est ce qui garde
  « Promotion » et « Outrepassement » accessibles en un clic, comme l'exigent
  `tests/potentiel-commun.playwright.js` (~243 et ~253).

### 5.2 Invariants

1. **Un nœud `.weapon-stat-term` par terme du moteur**, portant
   `data-term-id = term.id`. Les groupes sont des conteneurs supplémentaires,
   pas un remplacement. Chaque nœud conserve son `dataset.operation`,
   `dataset.unit` et `dataset.buckets` inchangés.
   `tests/supabase-etape1.playwright.js` (~1166) et
   `tests/potentiel-commun.playwright.js` (~246) doivent passer sans être
   réécrits.
2. **Aucun terme masqué.** La somme des termes rendus égale la longueur de
   `stat.terms`. Un groupe inconnu reste visible.
3. **Le moteur est inchangé** : `terms`, `totals`, `appliesTo`, `bucket`,
   `confidence` et les hypothèses centralisées ne bougent pas.
4. **Tout est replié par défaut**, y compris le sous-groupe « Taux principaux ».
5. **Aucun débordement horizontal à 320, 360 et 390 px**, cibles tactiles d'au
   moins 44 × 44 px, focus restitué au déclencheur.

## 6. Tests

TDD strict, chaque assertion vue échouer pour la bonne raison, puis prouvée
mordante par une mutation volontaire.

### Fonctions pures

- la clé de groupe est le quintuplet
  `(libellé, operation, unit, appliesTo, emphase)` ;
- **deux multiplicateurs de même libellé mais d'`appliesTo` différents ne sont
  pas regroupés** — la mutation qui retire `appliesTo` de la clé doit faire
  échouer ce test ;
- **deux termes de même libellé mais d'emphase différente ne sont pas
  regroupés** — la mutation qui retire l'emphase de la clé doit faire échouer
  ce test ;
- `termEmphasis` de chaque appelant reproduit le comportement actuel : tout
  multiplicateur pour le héros et pour l'arme, aucun pour l'équipement ;
- un libellé inconnu produit son propre groupe au lieu d'être avalé ;
- additifs et multiplicateurs d'un même groupe ne sont jamais additionnés
  ensemble ;
- la somme des taux d'un groupe égale la somme des valeurs des termes qui le
  composent ;
- un terme `presumed` suffit à faire apparaître « base présumée », zéro terme
  `presumed` le fait disparaître ;
- un multiplicateur `hero-main-rate` se formate `+3 %` ;
- un multiplicateur d'outrepassement garde `×1,05 — base présumée` : le test
  échoue si la notation additive est appliquée à tous les multiplicateurs.

### Rendu

- **correspondance un-à-un** : comparaison des **listes triées complètes**, plus
  une assertion d'unicité des identifiants du moteur.

  ```js
  assert.deepStrictEqual(
    renderedIds.slice().sort(),
    engineTermIds.slice().sort()
  );
  assert.strictEqual(
    new Set(engineTermIds).size,
    engineTermIds.length
  );
  ```

  Ni un compte égal ni une égalité d'ensembles ne suffisent : `A, A, B` rendu
  contre `A, B` calculé passerait les deux ;
- aucun `<summary>` ne porte la classe `.weapon-stat-term` ;
- un groupe d'un seul terme est visible sans second clic ;
- `dataset.buckets` est identique avant et après le lot pour chaque terme ;
- la liste des seaux n'apparaît qu'une fois par valeur distincte d'`appliesTo` ;
  une statistique portant à la fois des taux principaux et un outrepassement en
  affiche donc deux, pas une ;
- les trois appelants (héros, arme, équipement) produisent la même structure ;
- tout est replié à l'ouverture ;
- 320 et 390 px : aucun débordement, aucune superposition.

### Régression

- suite complète `npm test` ;
- `git diff --check` et `git status --short` propres.

## 7. Dégradation

- Un terme sans `source` reste affiché, dans un groupe « Autre ».
- Une unité inconnue continue de lever `BUILD_STAT_UNIT_INVALID` : le rendu ne
  doit pas inventer d'affichage pour une unité non prévue.
- Le bloc reste utilisable hors ligne : aucune donnée nouvelle n'est chargée.

## 8. Mise en service et retour arrière

Aucune modification SQL, aucun champ persisté, aucune migration. Le retour
arrière est un simple revert du commit de rendu : les données des membres ne
sont pas concernées.

Ordre : fusionner après validation, attendre le workflow Pages vert, accepter la
mise à jour PWA, vérifier le `BUILD_VERSION` servi.

## 9. Critères d'acceptation

- le détail des PV de Merlin tient en une dizaine de lignes au lieu de plusieurs
  dizaines ;
- aucun taux principal n'est écrit sous forme multiplicative, et
  l'outrepassement d'arme conserve exactement
  `Outrepassement ×1,05 — base présumée` ;
- la liste des seaux n'est plus répétée ;
- les trois rendus passent par une seule fonction et aucun bloc de détail
  inline ne subsiste dans `index.html` ;
- les tests Playwright existants passent sans réécriture.
