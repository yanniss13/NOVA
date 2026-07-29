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

```js
statTermsDetails(stat)
```

Elle consomme la forme déjà produite par `groupBuildStatResults()` :
`{ stat, unit, value, label, terms }`. Elle est utilisée par les trois appelants
et ne connaît ni le héros, ni l'arme, ni l'équipement.

Les fonctions de libellé existantes (`heroTermLabel`, `weaponTermLabel`,
`gearTermLabel`) restent la source des noms. `statTermsDetails` reçoit la
fonction de libellé applicable en paramètre au lieu de la choisir elle-même.

### 4.2 Clé de groupe

Le groupe d'un terme est dérivé de `source.domain` et `source.component`. Aucune
liste d'objets, d'armes ou de personnages n'est codée en dur, conformément à la
règle d'or du dépôt.

| `domain` | `component` | Groupe affiché |
| --- | --- | --- |
| `character` | `base` | Base du personnage |
| `mastery` | `common-mastery` | Maîtrise commune |
| `mastery` | `weapon-mastery` | Maîtrise `<weaponType>` |
| `mastery` | `reserve-weapon-mastery` | Maîtrise de réserve |
| `potential` | `potential` | Potentiel P`<tier>` |
| `weapon` | `level`, `promotion`, `overlimit`, `enchantment` | Arme |
| `secondary-weapon` | `attack-transfer` | Arme secondaire `<weaponType>` |
| `armor`, `jewel`, `engraving` | tous | Équipement |
| `set` | `bonus` | Ensembles |
| `weapon`, `rounding` | `final-rounding`, `final-ceil` | Arrondi du jeu |

Un couple `domain`/`component` inconnu forme son propre groupe, libellé par la
fonction de libellé reçue. Le rendu ne doit jamais masquer un terme qu'il ne
sait pas classer.

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

```
Base du personnage                              +2 000 points
Maîtrise commune                                +1 248 points
Maîtrise Baguette            4 apports          +3 024 points
Taux principaux                                 +42 %            ▸
    Maîtrise Baguette        4 apports          +12 %
    Maîtrise de réserve      2 apports           +6 %
    Potentiel P10                               +10 %
    Équipement               5 apports          +14 %
Arrondi du jeu                                      +1 point

Appliqué à toutes les contributions fixes · base présumée
```

Règles d'affichage :

- un groupe qui ne contient qu'un terme n'affiche pas de compteur ;
- un groupe de plusieurs termes affiche leur nombre suivi du mot invariable
  `apports` (`4 apports`). Aucun vocabulaire par domaine n'est inventé : le mot
  est le même pour un nœud de maîtrise, une pièce ou un ensemble ;
- les taux s'écrivent `+3 %`, jamais `×1,03` ;
- « base présumée » apparaît une fois, sous le bloc, dès qu'au moins un terme
  multiplicatif porte `confidence: "presumed"` ;
- la liste des seaux ciblés apparaît une fois par statistique, en pied de bloc ;
- l'outrepassement d'arme garde sa mise en avant existante
  (`weapon-stat-term-overlimit`) : c'est le seul multiplicateur dont la base
  présumée est propre à l'arme.

## 5. Invariants à ne pas casser

Ces points sont couverts par des tests existants ou à ajouter. Ils sont la
raison pour laquelle ce lot ne touche pas au moteur.

1. **Un nœud `.weapon-stat-term` par terme du moteur.** Les groupes sont des
   conteneurs supplémentaires, pas un remplacement. Chaque nœud conserve son
   `dataset.operation`, `dataset.unit` et `dataset.buckets` inchangés.
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

- la clé de groupe est dérivée de `domain` + `component`, pas d'une liste en
  dur ;
- un couple inconnu produit son propre groupe au lieu d'être avalé ;
- additifs et multiplicateurs d'un même groupe ne sont jamais additionnés
  ensemble ;
- la somme des taux d'un groupe égale la somme des valeurs des termes qui le
  composent ;
- un terme `presumed` suffit à faire apparaître « base présumée », zéro terme
  `presumed` le fait disparaître ;
- le formatage d'un taux donne `+3 %` et jamais `×1,03`.

### Rendu

- le nombre de nœuds `.weapon-stat-term` égale `stat.terms.length` sur une
  fiche Merlin complète ;
- `dataset.buckets` est identique avant et après le lot pour chaque terme ;
- la liste des seaux n'apparaît qu'une fois par statistique ;
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
- aucun taux n'est écrit sous forme multiplicative ;
- la liste des seaux n'est plus répétée ;
- les trois rendus passent par une seule fonction et aucun bloc de détail
  inline ne subsiste dans `index.html` ;
- les tests Playwright existants passent sans réécriture.
