# Conception — Stats de builds, lot 1 : l’arme de bout en bout

**Date :** 2026-07-28

**État :** conception validée par le propriétaire

**Périmètre :** données d’armes, saisie détaillée, calcul de la contribution de
l’arme, roster et Team Builder

## 1. But et décisions validées

Ce lot rend la configuration d’une arme chiffrée et utile sans attendre les
armures, la maîtrise ou les totaux du personnage.

Les décisions suivantes sont définitives pour ce lot :

- le chantier reste découpé en trois lots et commence par l’arme ;
- les cinq familles de statistiques sont affichées : PV/ATK/DEF, statistiques
  supplémentaires, modificateurs de dégâts, statistiques spéciales et
  statistiques élémentaires ;
- chaque membre peut renseigner les builds de son propre roster ; les autres
  membres les consultent en lecture seule ;
- un ancien build reste intact, mais ne montre aucun chiffre tant que sa
  configuration d’arme n’est pas complétée ;
- les paramètres saisis sont stockés, jamais les résultats calculés ;
- l’éditeur est un panneau dédié commun au roster et au Team Builder ;
- des gardes SQL empêchent une ancienne PWA d’effacer les nouveaux champs ;
- aucune nouvelle table ni colonne Supabase n’est créée.

L’exactitude retenue reste celle de la passation : modèle documenté, avec une
distinction visible entre ce qui est prouvé, ce qui repose sur une base
d’application présumée et ce qui sera estimé dans les lots suivants.

## 2. Hors périmètre

Ce lot ne calcule pas :

- les statistiques finales du personnage ;
- les sept pièces d’armure, les sets ou les costumes gravés ;
- la maîtrise ou le potentiel par type d’arme ;
- l’ordre d’application des bonus en pourcentage entre plusieurs domaines ;
- les synergies de Combines ;
- les descriptions longues des passifs d’arme.

Le total du héros et l’application des taux entre plusieurs domaines restent
réservés au lot 3. Le lot 1 applique seulement l’outrepassement interne à l’arme
selon l’hypothèse documentée et affiche uniquement
**« Apport de l’arme — calcul partiel »**.

## 3. Architecture retenue

Le système stocke la configuration de l’arme dans les JSONB existants, puis
recalcule les résultats dans le navigateur à partir d’un catalogue local.

Flux nominal :

1. l’arme est choisie depuis `window.SEVEN_DS_DATA` ;
2. son chemin retrouve sa définition dans
   `window.SEVEN_DS_BUILD_STATS.weaponsByFile` ;
3. l’éditeur modifie un brouillon de `weaponConfig` ;
4. le moteur valide et recalcule l’aperçu à chaque changement ;
5. « Valider la configuration » place le brouillon dans le build ;
6. l’enregistrement existant du roster ou de l’équipe persiste le JSONB ;
7. toute lecture recalcule les résultats localement.

Realtime transporte uniquement les paramètres saisis. Il n’ajoute aucune
requête de calcul et aucune consommation Supabase proportionnelle au nombre de
statistiques affichées.

## 4. Catalogue de données du navigateur

### 4.1 Fichier généré

Un nouveau script `generate-stats-build.py` consomme les fichiers locaux
`7ds-stats/*.json` et scanne les assets suivis par le projet. Il produit :

```js
window.SEVEN_DS_BUILD_STATS = {
  version: 1,
  weaponsByFile: {
    "7ds-armes/Baguette/Baguette de l'âme vorace.webp": {
      slug: "gluttonous-soul-wand",
      weaponType: "Wand",
      mainStat: "attack",
      gradesByGameId: {
        "131065010": {
          rarity: "grade5",
          mainStatValues: {},
          subStats: [],
          promotionSteps: [],
          promotionValues: {},
          overlimit: {},
          enchantments: {}
        }
      }
    }
  },
  statLabels: {
    "B_Atk_Equip": {
      fr: "Attaque de l’équipement",
      family: "main",
      unit: "flat"
    }
  }
};
```

Pour le lot 1, le fichier ne contient que les armes locales, leurs variantes,
leurs courbes, leurs enchantements et les libellés nécessaires. Les personnages
et armures ne seront ajoutés qu’avec leurs lots respectifs.

`stats-build.js` est chargé par une balise `<script>` classique avant le script
principal. Il fonctionne en `file://` et fait partie des ressources essentielles
du service worker. Les fichiers de référence `7ds-stats/*.json` ne sont ni
chargés par l’application ni précachés.

### 4.2 Rapprochement avec les images

Le générateur ne contient aucune liste d’armes en dur. Il :

- scanne `7ds-armes/<type>/*.webp` ;
- normalise Unicode, casse, espaces et ponctuation du nom de fichier et de
  `nameFr` ;
- utilise également le type d’arme pour lever les homonymes ;
- échoue si une image n’a aucune correspondance ou en a plusieurs ;
- échoue si deux définitions produisent la même clé de fichier ;
- trie toutes les clés avant sérialisation afin de produire une sortie
  déterministe.

Le rapprochement est fait à la génération, jamais à l’exécution. Le navigateur
fait ensuite une recherche exacte par chemin de fichier.

### 4.3 Libellés, familles et unités

Les libellés fusionnent les deux sources déjà documentées :
`{stat, nameFr}` et le dictionnaire court `statLabels`.

Une table `7ds-stats/stat-metadata.json`, maintenue dans le dépôt, affecte
explicitement chaque code à une famille et à une unité :

```json
{
  "B_Atk_Equip": {
    "family": "main",
    "unit": "flat"
  },
  "I_AtkAdd_Rate": {
    "family": "additional",
    "unit": "ten-thousandths"
  }
}
```

Les deux seules unités autorisées sont :

- `flat` — points bruts ;
- `ten-thousandths` — dix-millièmes, où `500` représente `5 %`.

L’unité n’est jamais déduite du nom du code ni du drapeau `taux` de
`libelles-stats.json`. Ce drapeau est absent pour de nombreux codes, notamment
`B_Atk_Equip` et `A_Accuracy`; une déduction silencieuse produirait donc des
sommes fausses.

Les cinq familles sont :

- `main` — PV, ATK, DEF ;
- `additional` — statistiques supplémentaires ;
- `damage` — modificateurs de dégâts ;
- `special` — statistiques spéciales ;
- `elemental` — statistiques élémentaires.

Cette table décrit des codes de statistiques, pas des assets. Le générateur
échoue dès qu’un code émis ne possède pas de libellé français, d’unité explicite
ou de famille. Il refuse aussi toute unité autre que les deux valeurs ci-dessus.
Une famille vide est masquée à l’affichage.

Les valeurs sémantiques de `mainStat` sont converties par une table de domaine
explicite (`attack` → `B_Atk_Equip`, `defense` → `B_Def_Equip`, `hp` →
`B_MaxHp_Equip`). Le générateur échoue sur toute autre valeur au lieu de choisir
un code par défaut.

## 5. Modèle persistant

### 5.1 Forme

La même propriété est utilisée dans une équipe et dans le roster :

```js
weaponConfig: {
  version: 1,
  gradeGameId: "131065010",
  level: 50,
  promotion: 4,
  overlimit: 6,
  enchantments: [
    {
      slot: 0,
      tier: 5,
      element: "thunder",
      stat: "I_AtkAdd_Rate",
      value: 787
    }
  ]
}
```

Emplacements :

- `teams.data.heroes[x].weaponConfig` ;
- `roster_characters.builds[weaponType].weaponConfig`.

`gradeGameId` est l’identifiant officiel de la variante. Les libellés, limites,
types et familles ne sont jamais copiés dans les données utilisateur.

Les valeurs en taux restent des entiers en dix-millièmes. Par exemple `787` est
affiché `7,87 %`. Aucun flottant formaté n’est persisté.

### 5.2 Enchantements explicitement vides

Le tableau est positionnel et sa longueur vient du grade :

- enchantement basique : un élément par coefficient de `slots` ;
- pierre maîtresse : un élément représentant la pierre ;
- aucun emplacement disponible : tableau vide.

Un élément vaut soit un objet complet, soit `null`. `null` signifie
explicitement « aucun enchantement sur cet emplacement ». Cette distinction
permet de considérer une saisie volontairement vide comme complète, sans la
confondre avec une ancienne configuration jamais renseignée.

Pour une pierre maîtresse de palier 5, `element` est obligatoire et doit
correspondre à l’un des groupes fournis (`generic`, `default` ou un élément).
Pour les paliers 1 à 4, `element` vaut `null`.

### 5.3 Compatibilité et migration

`normalizeHero()` et `normalizeRosterBuild()` ajoutent `weaponConfig: null`
lorsque le champ est absent. Ils ne fabriquent ni grade ni niveau.

Les anciens builds :

- restent enregistrables et utilisables ;
- conservent armes, armures, bijoux, potentiel et note ;
- affichent « Configuration à compléter » ;
- ne produisent aucune statistique.

Le format JSONB évite toute nouvelle table ou colonne. La migration applicative
est rétrocompatible.

### 5.4 Copies et changements

- Changer d’arme remet la configuration à `null`, après confirmation si elle
  existait.
- Changer de grade dans l’éditeur avertit avant de supprimer les valeurs
  devenues incompatibles.
- Réinitialiser place explicitement `weaponConfig: null` sans retirer l’arme.
- Une copie roster vers Team Builder copie la configuration.
- Une duplication, un export ou un import d’équipe la conserve.
- Un instantané de participation au boss la fige avec l’équipe.
- « Copier le favori ici » conserve l’arme et la configuration de la
  destination, comme il conserve déjà son arme ; seules armures, bijoux et note
  viennent du favori.

## 6. Validation et états

`weaponConfigStatus(weaponFile, config)` renvoie un état stable :

- `missing` — arme connue, configuration absente ;
- `incomplete` — structure reconnue mais saisie non terminée ;
- `valid` — tous les choix sont autorisés ;
- `unavailable` — arme locale absente du catalogue ;
- `incompatible` — configuration corrompue ou version non comprise.

Une configuration est valide lorsque :

- le chemin d’arme existe dans le catalogue ;
- `gradeGameId` appartient à cette arme ;
- `level`, `promotion` et `overlimit` sont des entiers dans leurs bornes ;
- le niveau ne dépasse pas le plafond ouvert par la promotion ;
- le tableau d’enchantements a la forme exigée par le grade ;
- chaque objet utilise une option autorisée pour son type, palier et élément ;
- chaque valeur respecte les bornes de l’option et le coefficient de son
  emplacement.

Une valeur invalide masque les chiffres. La normalisation peut supprimer une
option inconnue ou borner une donnée manifestement corrompue, mais elle ne
transforme jamais une configuration incomplète en configuration valide.

Le plafond avant la première promotion correspond au premier plafond de
`promotionSteps` moins dix niveaux. Avec les données mesurées, le palier zéro
ouvre donc le niveau 10, puis les étapes ouvrent exactement 20, 30, 40 et 50 via
leur `reinforceMax`. Si une variante ne possède aucune étape, son plafond n'est
pas déductible : elle est signalée incompatible au lieu d'inventer un repli sur
un champ de grade.

## 7. Moteur de calcul

### 7.1 Courbe de niveau

Pour une courbe `{base, progression}`, chaque élément de `progression`
représente l’incrément par niveau d’un segment de dix niveaux :

```text
valueAtLevel(curve, level) =
  base +
  Σ progression[i] × clamp(level - 10×i, 0, 10)
```

Le niveau est borné entre zéro et le plafond du grade. Au plafond,
`valueAtLevel` doit reproduire `max`. Cette formule s’applique aux statistiques
principales et aux sous-statistiques qui portent cette structure.

### 7.2 Promotion

Les armes ne possèdent aucun `growthType: "reinforce"` : la progression
`[10300, 10700, 11200, 11800, 12500]` appartient aux armures et ne doit jamais
être utilisée ici.

Le champ interne `promotion` correspond au contrôle affiché « Promotion ». Au
palier `n`, la valeur est :

```text
promotionValue(n) =
  promotionValues.base +
  Σ promotionValues.progression[0..n-1]
```

Les `promotionSteps` déterminent le plafond de niveau ouvert. Aucune valeur
n’est extrapolée au-delà des étapes présentes. Au palier zéro,
`promotionValue(0)` vaut donc exactement `promotionValues.base`. Au dernier
palier, l'égalité avec `promotionValues.max` est garantie par
`max == base + Σ(progression)`, vérifiée sur 261 cas sur 261.

### 7.3 Outrepassement

Le niveau sélectionné retrouve directement :

- `statRate` ;
- `passiveLevel`.

Pour les 81 armes qui possèdent l'outrepassement, les `statRate` suivent la
table constante `0 / 500 / 1000 / 1750 / 2500 / 3750 / 5000`. Ils sont stockés
en dix-millièmes : `500` s'affiche donc `+5 %`.

Le facteur multiplicatif est exact :

```text
facteur = 1 + statRate / 10000
```

La base d’application, elle, n’est pas documentée. Le lot 1 retient comme
hypothèse les statistiques natives de l’arme, avant les enchantements. Ce choix
est concentré dans un paramètre unique :

```js
/*
 * PRÉSUMÉ, NON VÉRIFIÉ :
 * l’outrepassement multiplie les statistiques natives de l’arme avant
 * les enchantements.
 *
 * Vérification dans le jeu :
 * relever l’ATK à outrepassement 0 puis 1 sur une arme enchantée.
 * Si le gain de 5 % inclut les enchantements, remplacer uniquement
 * "native-before-enchantments" par "native-and-enchantments".
 */
const OVERLIMIT_APPLICATION_MODE = "native-before-enchantments";
```

Une seule fonction traduit ce mode en seaux ciblés. Aucun autre calcul ni rendu
ne connaît l’hypothèse. Le résultat expose également le mode sous
`assumptions.overlimitBase`, afin qu’une comparaison avec le jeu reste
reproductible.

Le moteur émet un terme multiplicatif distinct pour chaque statistique native
réellement affectée. Il n’utilise jamais de joker `stat: "*"`. Le taux du terme
est exact ; seul le choix des seaux placés dans `appliesTo` est présumé.

Le niveau de passif reste une information annexe dans `facts`, car ce n’est pas
une contribution numérique à une statistique.

### 7.4 Enchantements

La valeur saisie est un entier dans l’intervalle permis par l’option et son
emplacement. Le moteur l’émet directement avec l’unité explicite provenant de
`stat-metadata.json`; il ne consulte pas le drapeau `taux` des libellés.

Pour un emplacement basique de coefficient `slotRate`, les bornes inclusives
sont :

```text
minimum = ceil(option.min × slotRate / 10000)
maximum = floor(option.max × slotRate / 10000)
```

La valeur persistée est la valeur après application de ce coefficient. Une
pierre maîtresse utilise directement les bornes de son option.

Les taux ne sont pas appliqués à une base de personnage dans ce lot.

### 7.5 Contrat de sortie : couverture et termes

La sortie canonique n’est jamais un nombre isolé :

```js
{
  version: 1,
  coverage: ["weapon"],
  assumptions: {
    overlimitBase: "native-before-enchantments"
  },
  terms: [
    {
      id: "weapon:level:B_Atk_Equip",
      stat: "B_Atk_Equip",
      operation: "add",
      value: 2147,
      unit: "flat",
      bucket: "weapon-native",
      family: "main",
      source: {
        domain: "weapon",
        component: "level",
        id: "7ds-armes/Hache/exemple.webp"
      },
      confidence: "exact"
    },
    {
      id: "weapon:promotion:B_Atk_Equip",
      stat: "B_Atk_Equip",
      operation: "add",
      value: 1144,
      unit: "flat",
      bucket: "weapon-native",
      family: "main",
      source: {
        domain: "weapon",
        component: "promotion",
        id: "7ds-armes/Hache/exemple.webp"
      },
      confidence: "exact"
    },
    {
      id: "weapon:overlimit:B_Atk_Equip",
      stat: "B_Atk_Equip",
      operation: "multiply",
      value: 500,
      unit: "ten-thousandths",
      appliesTo: ["weapon-native"],
      family: "main",
      source: {
        domain: "weapon",
        component: "overlimit",
        id: "7ds-armes/Hache/exemple.webp"
      },
      confidence: "exact"
    },
    {
      id: "weapon:enchantment:0:I_AtkAdd_Rate",
      stat: "I_AtkAdd_Rate",
      operation: "add",
      value: 787,
      unit: "ten-thousandths",
      bucket: "weapon-enchantment",
      family: "additional",
      source: {
        domain: "weapon",
        component: "enchantment",
        id: "7ds-armes/Hache/exemple.webp",
        slot: 0
      },
      confidence: "exact"
    }
  ],
  totals: [
    {
      stat: "B_Atk_Equip",
      unit: "flat",
      value: 3455.55
    },
    {
      stat: "I_AtkAdd_Rate",
      unit: "ten-thousandths",
      value: 787
    }
  ],
  facts: [
    {
      key: "passiveLevel",
      value: 7,
      source: {
        domain: "weapon",
        component: "overlimit"
      }
    }
  ]
}
```

`coverage` déclare les domaines entièrement pris en charge par cette version :

- configuration d’arme valide : `["weapon"]` ;
- configuration absente, incomplète, indisponible ou incompatible : `[]`.

Une source couverte sans terme pour une statistique contribue réellement zéro.
Une source non couverte n’est pas encore calculée. Ainsi, l’absence d’un terme
d’enchantement avec `weapon` couvert signifie « aucun enchantement », pas
« fonctionnalité non implémentée ».

Les futurs domaines sont `character`, `armor`, `set`, `potential` et `mastery`.
L’outrepassement reste un composant du domaine `weapon`, identifiable par
`source.component`.

La provenance structurée est conçue dès maintenant pour rendre la future
décomposition complète sans changer de contrat :

- base du personnage : `domain:"character", component:"base"` ;
- arme : `domain:"weapon"` avec `level`, `promotion`, `enchantment` ou
  `overlimit` ;
- chaque pièce d’armure : `domain:"armor", component:"piece"` avec son `slot`
  et son `id`, afin que deux pièces ne soient jamais fusionnées dans la trace ;
- bonus de set : `domain:"set"` avec l’identifiant du set et le seuil 2/4 ;
- potentiel : `domain:"potential"` avec le palier ;
- maîtrise : `domain:"mastery"` avec le type d’arme et le niveau.

Chaque terme possède obligatoirement :

- un `stat` concret ;
- une `operation` valant `add` ou `multiply` ;
- une `unit` valant `flat` ou `ten-thousandths` ;
- une provenance structurée ;
- soit un `bucket` pour un additif, soit `appliesTo` pour un multiplicateur.

Un multiplicateur n’est jamais ajouté comme une valeur brute. Sa valeur en
dix-millièmes est appliquée uniquement aux seaux nommés dans `appliesTo`.

### 7.6 Reconstruction générique par seaux

Le calcul n’impose aucun ordre global entre « arme », « armure » ou futurs
domaines. Pour chaque code de statistique :

1. sommer les termes `add` séparément dans leur `bucket` ;
2. pour chaque terme `multiply`, sommer les seaux cités par `appliesTo` ;
3. calculer sa contribution avec
   `baseCiblée × value / 10000` ;
4. additionner les seaux additifs et les contributions multiplicatives.

Les additifs d’une même statistique doivent tous déclarer la même unité : c’est
l’unité du total reconstruit. Les multiplicateurs utilisent toujours
`ten-thousandths`, quelle que soit l’unité du total ciblé. Un multiplicateur ne
peut exister que si la même statistique possède au moins un additif dans un seau
ciblé. Un multiplicateur visant un nom de seau inconnu rend la sortie
incompatible au lieu d’être ignoré.

`totals` est une commodité dérivée, jamais une seconde source de vérité. Pour
chaque `stat`, la reconstruction indépendante depuis tous ses termes doit être
strictement égale à la valeur correspondante de `totals`; l’unité du total est
celle de ses termes additifs. Ce contrat est testé, puis prouvé par mutation en
retirant un terme : le test d’égalité doit échouer.

Le mode d’outrepassement ne change que la liste de seaux produite dans
`appliesTo` :

- `native-before-enchantments` → `["weapon-native"]` ;
- `native-and-enchantments` →
  `["weapon-native", "weapon-enchantment"]`.

Changer l’hypothèse coûte donc une ligne et ne modifie ni le format des termes,
ni le regroupement, ni l’interface.

Affichage du lot 1 :

```text
Apport de l’arme — calcul partiel

Attaque de l’équipement
  Niveau                                  +2 147
  Promotion                               +1 144
  Outrepassement ×1,05 — base présumée
```

Les nombres utilisent `fr-FR`. Les valeurs `ten-thousandths` divisent l’entier
par 100 pour l’affichage en pourcentage. Tant que `coverage` ne contient pas
tous les domaines attendus, aucun rendu ne peut employer « stats du héros » ou
« total du héros ».

## 8. Interface validée

### 8.1 Disposition

Le choix visuel validé est le **panneau dédié**.

Sur ordinateur :

- configuration à gauche ;
- aperçu « Apport de l’arme — calcul partiel » à droite.

Sur téléphone :

- feuille presque plein écran ;
- une colonne, configuration puis résultats ;
- aucun débordement horizontal ;
- cibles tactiles d’au moins 44 × 44 px.

Le composant est partagé entre roster et Team Builder. Il reçoit un adaptateur
de contexte au lieu de dupliquer le formulaire.

### 8.2 Entrées et résumé

Après le choix d’une arme, le build présente « Configurer l’arme » et l’un de
ces résumés :

- « Configuration à compléter » ;
- « Configurée · SSR · Nv. 50 · Outrepassement 6 » ;
- « Données chiffrées indisponibles ».

Le panneau propose dans cet ordre :

1. grade ;
2. niveau ;
3. promotion ;
4. outrepassement, masqué si non disponible ;
5. enchantements basiques ou pierre maîtresse ;
6. apport partiel calculé.

Un enchantement basique propose la statistique autorisée et une valeur dans ses
bornes. Une pierre maîtresse propose le palier, l’élément seulement au palier 5,
la statistique puis la valeur.

### 8.3 Brouillon et accessibilité

Le panneau modifie une copie temporaire :

- « Annuler » et Échap ne changent pas le build ;
- « Valider la configuration » est refusé tant que le brouillon est invalide ;
- la première erreur reçoit le focus ;
- « Réinitialiser » demande confirmation puis écrit `null`.

Le panneau passe uniquement par `ModalStack`. Fermer rend le focus au bouton
exact qui l’a ouvert, y compris lorsqu’il est empilé au-dessus de l’éditeur du
roster.

Les cartes compactes ne montrent que le résumé. Les cinq familles et le détail
par source apparaissent dans :

- l’aperçu de l’éditeur ;
- le détail du roster consulté ;
- le détail d’une équipe ;
- les instantanés archivés du boss.

## 9. Realtime et conflits

À l’ouverture, l’adaptateur conserve l’identifiant de l’objet et son
`updatedAt`.

Si Realtime apporte une version plus récente pendant l’édition :

- le brouillon reste intact ;
- l’enregistrement affiche un choix explicite :
  « Recharger la version récente » ou « Enregistrer quand même » ;
- aucune actualisation ne ferme la modale, ne change l’onglet ou ne déplace le
  focus.

Cette protection couvre principalement deux onglets du même compte. Les
politiques RLS continuent d’interdire la modification du roster d’autrui.

## 10. Protections SQL contre les anciennes PWA

Une ancienne version reconstruit les objets connus et omet `weaponConfig`.
Sans garde serveur, une sauvegarde depuis cette version pourrait effacer la
nouvelle saisie.

`supabase/schema.sql` ajoute donc des fonctions et triggers idempotents, sans
table ni colonne :

- sur `roster_characters`, si un build entrant existe, garde la même arme et
  omet la clé `weaponConfig`, la valeur existante est réinjectée ;
- sur `teams`, la même règle s’applique héros par héros, au même index, si
  personnage et arme sont inchangés.

Règles importantes :

- une clé explicitement présente avec la valeur `null` est une suppression
  volontaire et n’est jamais restaurée ;
- retirer un build ou un héros ne le ressuscite pas ;
- changer d’arme ne transporte jamais l’ancienne configuration ;
- une insertion neuve n’a rien à préserver ;
- les politiques RLS restent inchangées.

Ces gardes rendent aussi un retour temporaire à l’ancien frontend non
destructif.

## 11. Dégradation et fonctionnement hors ligne

- Catalogue absent ou version inconnue : équipement visible, chiffres masqués.
- Arme non rapprochée : « Données chiffrées indisponibles ».
- Ancien build : « Configuration à compléter », jamais `0` inventé.
- JSON corrompu : équipement conservé, configuration classée incompatible.
- Erreur Supabase : comportement de cache existant, brouillon non perdu.
- Hors ligne : éditeur et calcul disponibles, car données et moteur sont locaux.

Le catalogue local n’accorde aucun droit et ne remplace jamais les protections
RLS.

## 12. Tests

La mise en œuvre suit le TDD strict demandé dans la passation. Chaque assertion
critique est vue échouer pour la bonne raison et une mutation volontaire prouve
qu’elle mord.

### 12.1 Générateur

- correspondance image/arme ;
- refus des absences et ambiguïtés ;
- tri et sortie déterministes ;
- couverture libellé, unité explicite et famille ;
- aucune unité dérivée du code de statistique ou du drapeau `taux` ;
- enchantements basiques à zéro, un ou deux emplacements ;
- pierres maîtresses paliers 1 à 4 ;
- palier 5 découpé par élément ;
- absence des descriptions et données inutiles au lot 1.

### 12.2 Fonctions pures

- segments aux niveaux 0, 10, 11 et au plafond ;
- égalité avec `max` au plafond ;
- cumul de promotion ;
- invariant `promotionValues.max == base + Σ(progression)` ;
- plafonds de niveau ouverts ;
- plafonds 10/20/30/40/50 dérivés uniquement de `promotionSteps` ;
- table d’outrepassement séparée `0/500/1000/1750/2500/3750/5000` ;
- termes `add` et `multiply` munis d’une unité explicite ;
- aucun terme avec `stat: "*"` ;
- regroupement et reconstruction pilotés uniquement par les seaux ;
- couverture `["weapon"]` ou `[]` selon l’état de la configuration ;
- égalité stricte entre reconstruction des termes et `totals` pour chaque stat ;
- mutation d’un terme faisant échouer cette égalité ;
- bascule du mode d’outrepassement sans changement de contrat ;
- validation de grade, palier, élément, statistique et valeur ;
- regroupement des cinq familles ;
- format français ;
- statuts `missing`, `incomplete`, `valid`, `unavailable`, `incompatible` ;
- absence de mutation des entrées.

### 12.3 Modèle et SQL

- ancien héros et ancien build normalisés avec `null` ;
- changement d’arme et de grade ;
- copie roster vers équipe ;
- duplication, import, export et instantané du boss ;
- copie du favori sans écraser l’arme ni sa configuration ;
- conservation SQL quand une ancienne PWA omet la clé ;
- suppression explicite respectée ;
- aucune résurrection après suppression ou changement d’arme.

### 12.4 Navigateur

- saisie roster, sauvegarde et relecture Supabase simulée ;
- lecture seule du build d’un autre membre ;
- saisie identique dans le Team Builder ;
- aperçu et détails d’équipe ;
- avertissement de conflit Realtime ;
- brouillon préservé en cas d’erreur ;
- pile de modales, Échap, piège et restitution du focus ;
- écrans 320, 360 et 390 px sans chevauchement ni débordement.

### 12.5 PWA et régressions

- `stats-build.js` existe et fait partie des ressources essentielles ;
- aucun `7ds-stats/*.json` n’est précaché ;
- calcul disponible hors ligne ;
- installation et mise à jour explicite inchangées ;
- suite complète `npm test`.

La fin de lot exige aussi `git diff --check` et `git status --short`.

## 13. Déploiement et retour arrière

Ordre :

1. créer un repère Git local sur l’état antérieur ;
2. rejouer `supabase/schema.sql` avec les gardes de conservation ;
3. fusionner et pousser uniquement après autorisation ;
4. attendre le workflow Pages vert ;
5. appliquer la mise à jour PWA ;
6. vérifier que le `BUILD_VERSION` servi correspond au SHA publié.

Il n’y a pas de coupure de service.

Retour arrière :

1. revenir au commit antérieur du frontend ;
2. conserver les gardes SQL, qui restent sûres et rejouables ;
3. déployer le revert ;
4. appliquer la mise à jour PWA.

Les `weaponConfig` restent dans les JSONB et redeviennent visibles lors d’une
réactivation. Aucun script destructif n’est nécessaire.

## 14. Critères d’acceptation

Le lot 1 est terminé lorsque :

- un membre peut configurer complètement une arme dans son roster et dans une
  équipe ;
- le même moteur et le même panneau servent aux deux parcours ;
- les contributions sont chiffrées, regroupées et lisibles en français ;
- chaque total partiel est reconstructible exactement depuis ses termes typés ;
- le lot 1 est toujours nommé « Apport de l’arme — calcul partiel » ;
- aucun ancien build n’affiche un faux total ;
- un autre membre voit les résultats sans pouvoir les modifier ;
- une ancienne PWA ne peut pas supprimer silencieusement la configuration ;
- le mode hors ligne, la PWA, Realtime, le mobile et l’accessibilité restent
  fonctionnels ;
- le lot est utilisable seul, sans attendre les armures ou le total du héros.
