# Armes secondaires et changement de build dans le Team Builder

Date : 2026-07-29  
Statut : conception validée par le propriétaire

## 1. Problème confirmé

Le moteur du lot 3A calcule actuellement un héros à partir d'une seule arme :
`hero.weapon` et `hero.weaponConfig`. Lorsqu'un build du roster est copié vers
une équipe, les deux autres builds du même personnage ne sont pas conservés.

Cette limite produit une sous-estimation importante de l'ATK. Dans le jeu, les
deux armes non utilisées transfèrent chacune **30 % de leur ATK plate** au
personnage. Le propriétaire a confirmé que la valeur transférable inclut :

- la progression de niveau ;
- la promotion ;
- l'outrepassement ;
- les enchantements d'ATK plate.

Les bonus d'ATK en pourcentage d'une arme secondaire ne sont ni transférés ni
activés.

Mesure initiale fournie sur Merlin :

| Statistique | Site avant correction | Jeu |
| --- | ---: | ---: |
| PV | 77 931,36 | 98 184 |
| ATK | 13 055,26 | 22 422 |
| DEF | 29 053,2 | 36 355 |

Ce lot corrige la source connue de l'écart d'ATK. Il ne prétend pas expliquer
les écarts restants de PV et de DEF : les passifs demeurent hors calcul et la
base d'application de certains multiplicateurs reste présumée.

## 2. Objectifs

1. Conserver les trois builds d'un personnage dans chaque héros d'équipe.
2. Permettre de changer de build depuis « Créer une équipe » en cliquant sur
   les trois icônes d'arme déjà visibles.
3. Garder un seul build visible et modifiable à la fois.
4. Ne jamais perdre les modifications non enregistrées lors d'un changement
   d'icône.
5. Ajouter le transfert reconstructible de 30 % des deux ATK plates
   secondaires.
6. Permettre de renvoyer explicitement le build affiché vers le roster.
7. Conserver des instantanés autonomes dans les équipes et les archives de boss.
8. Rester compatible avec les équipes et les anciennes PWA existantes.

## 3. Hors périmètre

- Les passifs textuels d'arme, d'armure ou de gravure ne deviennent pas des
  termes numériques.
- Les écarts de PV et de DEF ne sont pas corrigés sans nouvelle règle vérifiée
  dans le jeu.
- Aucun score ou total collectif d'équipe n'est ajouté.
- Le Team Builder n'affiche jamais les trois formulaires simultanément.
- Une modification dans le Team Builder n'est jamais synchronisée
  automatiquement vers le roster.

## 4. Modèle d'un héros d'équipe

### 4.1 Nouveau dictionnaire de brouillons

La forme normalisée du héros gagne un dictionnaire :

```js
rosterBuilds: {
  "Livre": {
    weapon,
    weaponConfig,
    armor,
    armorConfig,
    jewel,
    jewelConfig,
    note
  },
  "Baguette": { /* même forme */ },
  "Baton": { /* même forme */ }
},
activeWeaponType: "Livre"
```

Les clés sont exclusivement les trois types compatibles de `weaponTypesOf()`.
Chaque valeur suit la forme déjà définie par `normalizeRosterBuild()`, sans
`favorite`, car le favori appartient au roster et non à l'instantané d'équipe.

Les champs historiques de premier niveau restent présents :

```js
weapon
weaponConfig
armor
armorConfig
jewel
jewelConfig
note
```

Ils représentent toujours le build actif. Cette duplication contrôlée préserve
les consommateurs existants. Une seule paire de fonctions est autorisée à
synchroniser les deux représentations :

- enregistrer le build actif de premier niveau dans `rosterBuilds` ;
- charger un build de `rosterBuilds` vers les champs de premier niveau.

Le potentiel reste uniquement au premier niveau du héros. Il demeure commun
aux trois builds.

### 4.2 Normalisation et anciennes équipes

Pour une ancienne équipe sans `rosterBuilds` :

- le build historique devient l'entrée du type de l'arme active ;
- les deux autres entrées restent absentes ;
- aucun équipement secondaire n'est inventé ;
- le héros reste lisible et ses statistiques disponibles restent affichées ;
- son ATK est marquée incomplète tant que les deux armes secondaires manquent.

Une valeur de type inconnue, une arme incompatible ou une structure future
inconnue est rejetée par la normalisation existante, sans contaminer les autres
builds.

Changer de personnage vide toujours `rosterBuilds`. Aucun build d'un personnage
ne peut être transporté vers un autre.

### 4.3 Import depuis le roster

`rosterHeroSnapshot(entry, weaponType)` copie par valeur tous les builds connus
du personnage. Le type choisi devient actif. Les modifications ultérieures du
roster ne changent jamais l'équipe ni une archive déjà créée.

L'enregistrement d'une équipe et les instantanés de boss transportent le
dictionnaire complet. Aucune lecture du roster en direct n'est nécessaire pour
afficher une équipe partagée ou une archive.

## 5. Changement de build dans « Créer une équipe »

### 5.1 Icônes cliquables

Les trois icônes d'arme du personnage deviennent des boutons uniquement dans le
Team Builder propriétaire :

- l'icône active est annoncée et mise en évidence ;
- une icône inactive charge son build complet : arme, armures, bijoux,
  configurations et note ;
- le potentiel ne change pas ;
- une entrée absente charge un build vide du type demandé ;
- les cibles restent d'au moins 44 px et utilisables au clavier.

Le roster public et les détails d'équipe restent en lecture seule.

### 5.2 Conservation des brouillons

Avant chaque changement d'icône, le build visible est recopié dans
`rosterBuilds[activeWeaponType]`. Le nouveau build est ensuite chargé depuis le
dictionnaire local.

Ce changement :

- ne lit jamais Supabase ;
- ne sauvegarde jamais le roster ;
- ne perd aucune modification ;
- reste instantané hors ligne.

Un repère visuel indique les builds modifiés depuis le dernier chargement du
roster. Ce repère est un état d'interface et n'entre pas dans les statistiques.

### 5.3 Actions roster explicites

Deux actions sont disponibles :

- **« Mettre à jour mon roster »** enregistre uniquement le build affiché et le
  potentiel commun ;
- **« Recharger depuis mon roster »** remplace les trois brouillons après une
  confirmation si l'un d'eux a été modifié localement.

La première action crée l'entrée ou le build dans le roster propriétaire s'il
n'existe pas encore. Elle ne modifie jamais les deux autres builds.

Les écritures réseau sont désactivées hors ligne. En cas de modification
concurrente du roster depuis son chargement, l'application n'écrase rien
silencieusement : elle propose de recharger ou d'écraser explicitement, selon
le mécanisme de conflit déjà utilisé par les éditeurs.

## 6. Calcul des deux armes secondaires

### 6.1 Valeur transférable

Pour chaque type compatible différent du type actif :

1. valider uniquement `weapon` et `weaponConfig` ;
2. appeler `calculateWeaponStats()` ;
3. lire exclusivement le total `B_Atk_Equip` en unité `flat` ;
4. ignorer `I_AtkAdd_Rate` et tous les autres codes ;
5. calculer :

```text
ATK transférée = B_Atk_Equip final × 3000 / 10000
```

Le `B_Atk_Equip final` reconstruit par le moteur d'arme comprend déjà le niveau,
la promotion, l'outrepassement et les enchantements plats de ce même code.
Aucun arrondi intermédiaire n'est appliqué.

Le taux est centralisé :

```js
const SECONDARY_WEAPON_ATTACK_TRANSFER_RATE = 3000;
```

Les plafonds de passif d'arme et la règle d'outrepassement existante restent
inchangés.

### 6.2 Termes et diagnostic

Chaque arme secondaire valide produit un terme additif concret sur `B_Atk` :

```js
{
  stat: "B_Atk",
  operation: "add",
  unit: "flat",
  bucket: "secondary-weapon:<weaponType>",
  value: transferredAttack,
  source: {
    domain: "secondary-weapon",
    component: "attack-transfer",
    weaponType,
    file,
    originalStat: "B_Atk_Equip",
    originalValue: weaponAttack,
    transferRate: 3000
  },
  confidence: "exact"
}
```

La décomposition visible donne au minimum :

```text
Baguette secondaire : 15 400 ATK × 30 % = +4 620 ATK
```

Le terme est additif du point de vue du héros, mais sa provenance conserve la
valeur d'origine et le taux afin que le calcul soit diagnostiquable.

### 6.3 Interaction présumée avec les taux du héros

Le transfert rejoint les seaux d'ATK plate avant les taux globaux du héros.
Cette application est présumée et centralisée :

```js
const SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE = "before-hero-rates";
```

Les `ATK %` portés par les armes secondaires ne sont jamais ajoutés aux termes.
Les taux globaux déjà produits par le personnage, sa maîtrise ou son potentiel
peuvent en revanche cibler le seau transféré dans ce mode.

Protocole de validation : comparer l'ATK calculée et l'ATK du jeu avec les trois
armes renseignées. Si l'écart montre que les 30 % sont ajoutés après les taux
globaux, changer uniquement ce mode et la fonction qui traduit ses seaux, pas
les producteurs de termes.

## 7. Complétude du résultat

Les équipements du build actif conservent la règle actuelle : s'ils sont
absents ou invalides, `terms` et `totals` restent vides.

Une arme secondaire absente ou invalide constitue une exception contrôlée,
car elle ne peut affecter que l'ATK :

- les termes et totaux calculables restent présents ;
- le résultat porte `status: "partial"` ;
- `partialStats` contient `["B_Atk"]` ;
- `missing` contient le chemin précis du build ou de sa configuration ;
- `coverage` ne contient pas `secondary-weapon` ;
- `uncovered` contient `secondary-weapon:<weaponType>`.

Lorsque les deux armes secondaires sont valides :

- le résultat porte `status: "valid"` ;
- `partialStats` est vide ;
- `coverage` contient `secondary-weapon` ;
- aucun manque secondaire ne reste dans `uncovered`.

L'interface affiche toujours les passifs comme borne inférieure. En plus :

- PV et DEF restent affichés normalement ;
- une ATK partielle porte sur sa propre carte
  **« calcul incomplet — arme secondaire manquante »** ;
- le titre général annonce un calcul partiel ;
- aucune ATK partielle ne peut être confondue avec une valeur complète.

## 8. Compatibilité des anciennes PWA

Le schéma Supabase ne gagne ni table ni colonne. Le JSONB d'équipe accepte les
nouveaux champs.

Le trigger idempotent de préservation des héros d'équipe doit descendre au
niveau de `rosterBuilds` :

- même héros au même index ;
- ancienne valeur `rosterBuilds` présente ;
- nouvelle valeur omise ;
- alors seulement, réinjecter l'ancienne valeur.

Une clé explicitement mise à `null` reste une suppression volontaire. Changer
de personnage interdit toute préservation. Une ancienne PWA peut modifier le
build actif de premier niveau : lors de la prochaine normalisation, ce build
actif remplace l'entrée correspondante du dictionnaire préservé.

`activeWeaponType` est dérivé en priorité de l'arme active lorsque celle-ci
existe. Une valeur sauvegardée n'est utilisée que pour un build actif encore
vide.

Le contenu complet de `supabase/schema.sql` devra être rejoué avant la
publication du frontend.

## 9. Tests obligatoires

### 9.1 Moteur

- deux armes secondaires valides ajoutent chacune exactement 30 % de leur
  `B_Atk_Equip` final ;
- niveau, promotion, outrepassement et enchantement ATK plat changent la
  contribution ;
- `I_AtkAdd_Rate` d'une arme secondaire ne change aucun total ;
- les autres statistiques d'une arme secondaire ne sont pas transférées ;
- la reconstruction depuis les termes reste strictement égale aux totaux ;
- modifier le mode d'application change uniquement l'interaction avec les taux
  du héros ;
- une arme secondaire manquante conserve PV et DEF, marque seulement `B_Atk`
  partielle et n'affiche aucun faux zéro ;
- deux armes valides ajoutent `secondary-weapon` à la couverture.

### 9.2 Modèle et instantanés

- une ancienne équipe est normalisée avec le seul build actif ;
- l'import roster copie les trois builds par valeur ;
- changer A → B → A conserve les modifications non enregistrées de A ;
- changer de personnage vide les trois brouillons ;
- l'équipe sauvegardée et l'archive de boss conservent les trois builds ;
- modifier le roster après l'archivage ne change pas l'archive.

### 9.3 Roster et conflits

- « Mettre à jour mon roster » ne modifie que le build affiché et le potentiel ;
- les deux autres builds restent byte-for-byte identiques ;
- un roster absent est créé ;
- hors ligne, aucune écriture n'est tentée ;
- une modification concurrente exige un choix explicite ;
- « Recharger depuis mon roster » avertit avant d'écraser un brouillon sale.

### 9.4 Interface et SQL

- les trois icônes sont des boutons de 44 px utilisables au clavier ;
- l'icône active possède un libellé accessible et un état visible ;
- le changement de build ne recharge pas la page ;
- l'ATK partielle est annoncée sur sa carte ;
- le trigger préserve `rosterBuilds` omis par une ancienne PWA ;
- le trigger ne préserve ni une valeur explicitement nulle ni les builds d'un
  autre personnage ;
- la syntaxe PostgreSQL complète reste valide.

## 10. Activation et retour arrière

Le travail est isolé sur une branche dédiée et séparé en commits fonctionnels.

Ordre de publication :

1. exécuter la suite complète ;
2. rejouer le `supabase/schema.sql` idempotent ;
3. fusionner la branche après validation ;
4. pousser `main` ;
5. attendre GitHub Pages vert ;
6. accepter la mise à jour PWA ;
7. vérifier le `BUILD_VERSION` servi ;
8. comparer à nouveau Merlin avec les trois armes complètes.

Retour arrière :

- déployer un revert des commits frontend ;
- conserver le trigger SQL, compatible avec les anciennes données ;
- les dictionnaires `rosterBuilds` restent dans les JSONB et réapparaissent lors
  d'une réactivation.

La comparaison de Merlin après activation servira à mesurer séparément :

- l'écart d'ATK restant après le transfert des armes ;
- l'écart de PV ;
- l'écart de DEF.

Aucune nouvelle formule ne sera ajoutée pour ces écarts sans mesure ou règle
confirmée par le propriétaire.
