# Stats de builds — Lot 3A : statistiques du héros

**Date :** 2026-07-29  
**Base :** `main` = `73aabab` (lots 1 et 2 livrés)  
**Suite de :** `2026-07-28-stats-builds-passation.md` et
`2026-07-28-stats-builds-lot2-design.md`

Cette spécification remplace les anciennes mentions d’un potentiel stocké par
arme. Le palier de potentiel reste unique pour le personnage ; seule l’arme
équipée choisit la branche de bonus chiffrés et les descriptions.

## 1. Objectif et découpage

Le lot 3A calcule et affiche séparément les statistiques de chaque héros à
partir de ses données fixes, de sa maîtrise maximale, de son potentiel commun et
de son build complet.

Le résultat doit être utile pour une comparaison avec le jeu, mais aussi
diagnostiquable : chaque total est reconstruit depuis une liste de termes
portant leur source, leur unité, leur opération et leur niveau de confiance.

Le lot ne produit aucun total collectif d’équipe. Les quatre héros restent
présentés séparément jusqu’à ce que la formule de moyenne utilisée par le jeu
soit comprise.

L’optimisation Supabase du Recensement est indépendante du moteur. Elle sera
conçue et livrée ensuite comme lot 3B, afin de ne pas mélanger une fonctionnalité
visible avec un changement de lecture réseau.

## 2. Décisions du propriétaire

- Les personnages n’ont pas de niveau dans le jeu. Le moteur utilise leurs
  statistiques fixes publiées.
- Tous les personnages sont considérés en maîtrise maximale. Aucun champ de
  maîtrise n’est saisi ni persisté.
- Le potentiel est un unique palier P0–P10 commun au personnage. L’arme équipée
  sélectionne seulement la branche de bonus correspondante.
- Tous les libellés visibles utilisent `P0` à `P10`. Le nom interne historique
  `tier` reste inchangé afin de ne provoquer aucune migration de données.
- Les passifs d’arme, d’armure et de tenue gravée sont affichés, mais ne
  participent jamais au calcul chiffré de ce lot.
- Le total du héros est masqué dès qu’une arme, une pièce requise ou sa
  configuration chiffrée manque ou est invalide.
- Un niveau de passif manquant n’empêche pas le calcul : il ne modifie aucun
  chiffre et l’interface le présente dans la seule section « Passifs ».
- PV, ATK et DEF sont mis en avant, mais chacun porte au même endroit la mention
  « borne inférieure ».
- Toute décomposition est repliée par défaut, notamment à 320 px.
- La formule de base des pourcentages principaux est présumée, concentrée dans
  un paramètre unique et signalée à l’utilisateur.

## 3. Faits vérifiés

### 3.1 Personnages, maîtrise et potentiel

`7ds-stats/personnages.json` contient, pour chacun des 24 personnages :

- les statistiques fixes `baseHp`, `baseAtk`, `baseDef`, `baseSpd`, précision,
  blocage, critique, résistances et modificateurs PvP ;
- `commonMasteryStats` ;
- trois branches de maîtrise d’arme ;
- cinq entrées de maîtrise par branche, dont l’entrée initiale puis les quatre
  gros nœuds du jeu ;
- trente entrées de potentiel, soit trois armes × dix paliers.

En maîtrise maximale, le moteur prend tous les `subLevels[].abilities`, tous les
`nodes[].abilities` et les `commonMasteryStats` de la branche équipée. Aucun
choix de nœud n’est demandé.

Les tableaux `potentials[].stats` sont des instantanés cumulés du palier, pas
des gains à additionner : par exemple, la branche Axe vérifiée passe de
`I_AtkAdd_Rate:300` à P1 à `900` à P3 puis `1800` à P8. Le moteur lit donc
uniquement les statistiques du palier commun sélectionné. P0 n’émet aucun
terme.

### 3.2 Passifs

Trois plafonds distincts existent et ne doivent pas être unifiés :

- une arme concernée possède un passif fixe de sept niveaux ;
- les dix armures ou bijoux spéciaux possèdent un passif fixe de trois niveaux ;
- les 83 tenues gravées possèdent un passif fixe de trois niveaux.

Le code conserve donc deux constantes distinctes :

```js
const WEAPON_PASSIVE_MAX_LEVEL = 7;
const GEAR_PASSIVE_MAX_LEVEL = 3;
```

Pour l’arme, le niveau est strictement dérivé :

```text
passiveLevel = overlimit + 1
overlimit 0..6 → passiveLevel 1..7
```

Il ne faut donc aucun champ de passif d’arme.

Pour les dix équipements spéciaux et les tenues gravées, le niveau 1–3 est une
valeur séparée dans le jeu. Il doit être saisi.

Les descriptions sont de la prose conditionnelle. Elles ne sont pas converties
en termes numériques. Leur présence reste déclarée dans `uncovered`.

## 4. Catalogue généré

`generate-stats-build.py` enrichit `stats-build.js` sans charger les JSON de
référence dans le navigateur.

Un dictionnaire `charactersBySlug` est ajouté. Chaque entrée contient uniquement
les données d’exécution nécessaires :

```js
charactersBySlug[charId] = {
  baseStats: [
    { stat, value }
  ],
  commonMasteryStats: [
    { stat, value }
  ],
  masteriesByWeapon: {
    Axe: {
      abilities: [
        { stat, value, source: { level, kind, index } }
      ]
    }
  },
  potentialsByWeapon: {
    Axe: {
      1: [{ stat, value }],
      // …
      10: [{ stat, value }]
    }
  }
};
```

Le rapprochement utilise le `slug` du personnage, identique au `charId` local,
et échoue sur une absence ou une ambiguïté. Il n’existe aucune liste de
personnages codée en dur dans `index.html`.

Le catalogue d’arme conserve le texte français des sept niveaux du passif fixe
quand il existe. Les catalogues `gearByFile` et `engravedByFile` conservent le
texte français de leurs trois niveaux. Le balisage couleur existant est rendu
avec `renderBonus()` ; les descriptions ne sont jamais injectées comme HTML.

`statLabels` est étendu à tous les codes de personnage, de maîtrise et de
potentiel émis. Chaque code possède toujours une unité explicite `flat` ou
`ten-thousandths`.

## 5. Modèle persistant des passifs d’équipement

La forme version 1 de la configuration d’une pièce gagne un sous-champ
facultatif :

```js
{
  version: 1,
  level: 130,
  reinforce: 5,
  enchantments: [],
  passiveLevel: 1 | 2 | 3 | null
}
```

Règles :

- le champ n’existe que dans `armorConfig` ou `jewelConfig` ;
- il n’est proposé que si la définition porte un passif d’équipement ou de
  gravure ;
- une ancienne configuration sans champ est normalisée à `null`, sans inventer
  un niveau ;
- changer la pièce équipée invalide toujours sa configuration, donc son niveau
  de passif ;
- les copies roster → builder → équipe → archive de boss conservent le champ
  dans l’instantané ;
- le statut numérique de la pièce ne dépend pas de `passiveLevel`.

La lecture du passif possède son propre statut :

```text
not-applicable | missing | valid | incompatible
```

Une valeur absente donne `missing`. Une valeur hors 1–3 donne `incompatible`.
Ces deux états produisent un message dans la section « Passifs » mais ne
changent ni les termes ni les totaux.

## 6. Contrat du moteur

### 6.1 Entrée et sortie

La fonction canonique est :

```js
calculateHeroStats(hero)
```

Elle consomme la forme normalisée déjà utilisée par les héros d’équipe :
`char`, `weapon`, `weaponConfig`, `armor`, `armorConfig`, `jewel`,
`jewelConfig` et `potentiel`.

Elle renvoie :

```js
{
  version: 1,
  status: "valid" | "incomplete" | "unavailable" | "incompatible",
  coverage: [],
  uncovered: [],
  assumptions: {},
  missing: [],
  terms: [],
  totals: [],
  facts: {
    passives: []
  }
}
```

Une sortie `valid` couvre :

```js
[
  "character",
  "mastery",
  "potential",
  "weapon",
  "armor",
  "jewel",
  "engraving",
  "set"
]
```

Les passifs non calculés restent énumérés dans `uncovered` avec les clés déjà
livrées : `weapon:passive`, `armor:passive` et `engraving:passive`.

### 6.2 Complétude

Un résultat de héros n’est `valid` que si :

- le personnage existe dans le catalogue ;
- une arme compatible est équipée ;
- la configuration de l’arme est valide ;
- les cinq emplacements d’armure, tenue gravée comprise, sont équipés et
  configurés ;
- les trois bijoux sont équipés et configurés ;
- le potentiel commun est un entier de 0 à 10.

Dans tout autre cas, `missing` décrit chaque source concernée et `terms` ainsi
que `totals` restent vides. Les panneaux de pièce du lot 2 restent disponibles
pour consulter les contributions déjà configurées.

Un `passiveLevel` absent ou invalide ne rend pas ce résultat incomplet, puisque
le passif n’entre pas dans le calcul.

### 6.3 Termes canoniques

Les termes du héros réutilisent le contrat des lots 1 et 2 :

- `stat` concret, jamais `*` ;
- `unit` explicite ;
- `operation: "add"` avec `bucket`, ou `operation: "multiply"` avec
  `appliesTo` ;
- `confidence` ;
- provenance détaillée dans `source`.

Nouveaux domaines et seaux :

```text
character:base
mastery:common
mastery:<weaponType>
potential:<weaponType>:<tier>
```

Pour réunir les statistiques principales :

```text
B_Atk_Equip   → B_Atk
B_Def_Equip   → B_Def
B_MaxHp_Equip → B_MaxHp
```

Le code original reste disponible dans `source.originalStat`. Les autres codes
ne sont jamais fusionnés par ressemblance de nom.

`totals` est strictement reconstruit depuis `terms`. Il ne constitue jamais une
seconde source de vérité.

### 6.4 Base d’application présumée

Le mode initial est unique :

```js
const HERO_MAIN_RATE_APPLICATION_MODE = "all-flat-before-passives";
```

Il signifie :

```text
PV, ATK ou DEF =
  somme des contributions fixes personnage + maîtrise + équipement + sets
  × (1 + somme des taux correspondants / 10 000)
```

La fonction qui traduit ce mode en `appliesTo` est le seul endroit connaissant
l’hypothèse. Les termes multiplicatifs concernés portent
`confidence: "presumed"`. Les taux eux-mêmes restent exacts.

L’outrepassement d’arme conserve son propre paramètre et son propre calcul du
lot 1. Il ne doit pas être fusionné avec ce nouveau mode.

Protocole de vérification : relever les statistiques d’un nouveau personnage
avant son premier potentiel, puis juste après, sans modifier son équipement. En
attendant cette mesure, l’interface présente explicitement la base comme
présumée.

## 7. Interface

### 7.1 Emplacements

Le résumé chiffré du héros est rendu :

- dans le Team Builder ;
- dans l’éditeur du roster ;
- dans le détail en lecture seule du roster d’un membre ;
- dans le détail d’une équipe ;
- dans les instantanés d’équipe visibles depuis une archive de boss.

Les vues d’équipe montrent les héros séparément. Aucun total ou score global
d’équipe n’est calculé.

### 7.2 Résumé et décomposition

PV, ATK et DEF apparaissent en tête sous forme de trois cartes. Chaque carte
porte elle-même, à côté du chiffre, « borne inférieure ». Le titre général seul
ne suffit pas.

Un badge séparé annonce « Base d’application présumée ». La fiche n’utilise
jamais « vérifié » tant que le protocole en jeu n’a pas été réalisé.

Les autres statistiques restent rangées dans les cinq familles existantes.
Chaque statistique utilise un élément repliable fermé par défaut. Son ouverture
montre les termes, les opérations, les unités et les sources. Ce comportement
est identique sur ordinateur et mobile.

Si le build est incomplet, le résumé chiffré est remplacé par une liste d’actions
précises : arme absente, configuration d’arme à compléter, emplacement vide ou
configuration de pièce à compléter.

### 7.3 Passifs

Une section séparée s’intitule exactement :

**« Passifs non inclus dans le calcul »**

Elle affiche :

- le niveau 1–7 et le texte du passif fixe de l’arme, dérivés de
  l’outrepassement ;
- le niveau 1–3 choisi et le texte de chaque équipement spécial ;
- le niveau 1–3 choisi et le texte de la tenue gravée.

Quand le niveau d’une armure, d’un bijou ou d’une gravure manque, la section dit
« Niveau du passif à renseigner ». Le sélecteur vit dans le bloc « Passif » de
la modale de pièce, pas parmi les champs qui modifient les statistiques.

## 8. Garde SQL pour anciennes PWA

`private.preserved_gear_config` doit protéger deux générations de clients :

1. si le nouveau payload omet toute la clé `armorConfig` ou `jewelConfig`, le
   comportement du lot 2 conserve les configurations des pièces inchangées ;
2. si le nouveau payload contient la configuration de l’emplacement mais omet
   seulement `passiveLevel`, le garde réinsère ce sous-champ depuis l’ancienne
   configuration.

La préservation du sous-champ exige simultanément :

- même héros dans une équipe ;
- même fichier équipé au même emplacement ;
- ancienne et nouvelle configurations d’emplacement de type objet ;
- `passiveLevel` présent dans l’ancienne configuration ;
- `passiveLevel` absent de la nouvelle.

Une clé explicitement envoyée avec `null` fait foi. Changer de pièce ou de héros
ne transporte jamais le niveau précédent.

Le changement ne crée aucune table, colonne ou politique RLS. Le
`supabase/schema.sql` complet doit néanmoins être rejoué avant de publier le
frontend.

## 9. Tests obligatoires

Les tâches suivent un TDD strict et chaque contrat important est prouvé mordant
par une mutation volontaire.

### Générateur

- 24 personnages rapprochés sans liste codée en dur ;
- trois branches de maîtrise et dix paliers de potentiel par branche ;
- tous les codes émis possèdent `{fr, family, unit}` ;
- passifs d’arme limités à 7, passifs d’équipement et de gravure limités à 3 ;
- régénération déterministe et `--check` propre.

### Moteur

- maîtrise maximale : commun + tous les sous-niveaux + tous les nœuds de la
  seule arme équipée ;
- potentiel commun inchangé lors d’un changement d’arme, mais termes issus de
  la nouvelle branche ;
- P0 n’émet aucun terme de potentiel tout en couvrant le domaine ;
- aucun contrôle ou résumé visible du potentiel ne conserve un libellé `T0` à
  `T10` ; les onze valeurs sont affichées `P0` à `P10` ;
- chaque total est égal à la reconstruction depuis les termes ;
- les trois codes d’équipement principaux sont fusionnés uniquement vers leur
  code de héros explicite ;
- changer `HERO_MAIN_RATE_APPLICATION_MODE` change la base sans modifier le
  format ;
- tout emplacement ou toute configuration numérique manquante masque les
  totaux ;
- `passiveLevel` absent, valide ou invalide ne change aucun chiffre.

### Persistance et SQL

- normalisation des anciennes configurations vers `passiveLevel: null` ;
- copie du champ jusqu’aux instantanés de boss ;
- pièce inchangée + sous-champ omis : conservation ;
- sous-champ explicitement `null` : suppression respectée ;
- pièce ou héros changé : aucune conservation ;
- PWA antérieure au lot 2 : conservation de la configuration complète inchangée.

### Interface

- les trois cartes principales portent chacune « borne inférieure » ;
- le badge de formule présumée est visible ;
- toutes les décompositions sont fermées par défaut ;
- les passifs sont annoncés hors calcul et le bon texte est affiché ;
- aucun total collectif d’équipe ;
- à 320 et 390 px : aucune superposition, aucune largeur supérieure au
  conteneur, cibles tactiles de 44 px et restitution correcte du focus.

La validation finale exécute `npm test`, `git diff --check` et
`git status --short`.

## 10. Mise en service et retour arrière

Ordre :

1. rejouer le `supabase/schema.sql` complet ;
2. fusionner et pousser le frontend seulement après autorisation ;
3. attendre le workflow Pages vert ;
4. accepter la mise à jour PWA ;
5. vérifier le `BUILD_VERSION` servi.

Le retour arrière du frontend conserve les gardes SQL. Les nouveaux sous-champs
restent dans les JSONB et réapparaissent lors d’une réactivation du lot.
