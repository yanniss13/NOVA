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
distinction visible entre ce qui est prouvé, ce qui est un modificateur non
appliqué et ce qui sera estimé dans les lots suivants.

## 2. Hors périmètre

Ce lot ne calcule pas :

- les statistiques finales du personnage ;
- les sept pièces d’armure, les sets ou les costumes gravés ;
- la maîtrise ou le potentiel par type d’arme ;
- l’ordre d’application des bonus en pourcentage ;
- les synergies de Combines ;
- les descriptions longues des passifs d’arme.

Le total du héros et l’application des taux restent réservés au lot 3. Le lot 1
affiche uniquement **« Contribution de l’arme »**.

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
          reinforceMax: 50,
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
      rate: false,
      family: "main"
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

### 4.3 Libellés et familles

Les libellés fusionnent les deux sources déjà documentées :
`{stat, nameFr}` et le dictionnaire court `statLabels`.

Une petite table de classification maintenue dans le dépôt affecte chaque code à
l’une des cinq familles :

- `main` — PV, ATK, DEF ;
- `additional` — statistiques supplémentaires ;
- `damage` — modificateurs de dégâts ;
- `special` — statistiques spéciales ;
- `elemental` — statistiques élémentaires.

Cette table classe des codes de statistiques, pas des assets. Le générateur
échoue dès qu’un code émis ne possède pas de libellé français, d’unité ou de
famille. Une famille vide est masquée à l’affichage.

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

Le plafond avant le premier renforcement correspond au premier plafond de
`promotionSteps` moins dix niveaux. Chaque palier suivant utilise exactement le
`reinforceMax` de son étape. Si une variante ne possède aucune étape, son propre
`reinforceMax` est le plafond unique.

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

### 7.2 Renforcement

Le champ interne `promotion` correspond au contrôle affiché
« Renforcement ». Le niveau zéro n’ajoute rien. Au palier `n`, le bonus est :

```text
promotionValue(n) =
  promotionValues.base +
  Σ promotionValues.progression[0..n-1]
```

Les `promotionSteps` déterminent le plafond de niveau ouvert. Aucune valeur
n’est extrapolée au-delà des étapes présentes.

### 7.3 Outrepassement

Le niveau sélectionné retrouve directement :

- `statRate` ;
- `passiveLevel`.

Le lot 1 les affiche séparément :

```text
Bonus aux statistiques de l’arme   +50 %
Niveau du passif                        7
```

`statRate` n’est pas appliqué aux valeurs principales ou secondaires tant que
sa base exacte n’est pas documentée.

### 7.4 Enchantements

La valeur saisie est un entier dans l’intervalle permis par l’option et son
emplacement. Le moteur l’émet directement :

- valeur plate si `statLabels[stat].rate === false` ;
- taux en dix-millièmes si `rate === true`.

Pour un emplacement basique de coefficient `slotRate`, les bornes inclusives
sont :

```text
minimum = ceil(option.min × slotRate / 10000)
maximum = floor(option.max × slotRate / 10000)
```

La valeur persistée est la valeur après application de ce coefficient. Une
pierre maîtresse utilise directement les bornes de son option.

Les taux ne sont pas appliqués à une base de personnage dans ce lot.

### 7.5 Sortie et regroupement

Le moteur émet des contributions atomiques :

```js
{
  stat: "B_Atk_Equip",
  value: 2147,
  rate: false,
  family: "main",
  source: "level",
  confidence: "exact"
}
```

`groupWeaponStats()` regroupe les mêmes codes, conserve le détail par source et
ne mélange jamais une valeur plate avec un taux.

Affichage :

```text
Attaque de l’équipement       +3 291
  Niveau                      +2 147
  Renforcement                +1 144
```

Les nombres utilisent `fr-FR`. Les taux divisent la valeur entière par 100 pour
l’affichage en pourcentage.

## 8. Interface validée

### 8.1 Disposition

Le choix visuel validé est le **panneau dédié**.

Sur ordinateur :

- configuration à gauche ;
- aperçu « Contribution de l’arme » à droite.

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
3. renforcement ;
4. outrepassement, masqué si non disponible ;
5. enchantements basiques ou pierre maîtresse ;
6. contribution calculée.

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
- couverture libellé, unité et famille ;
- enchantements basiques à zéro, un ou deux emplacements ;
- pierres maîtresses paliers 1 à 4 ;
- palier 5 découpé par élément ;
- absence des descriptions et données inutiles au lot 1.

### 12.2 Fonctions pures

- segments aux niveaux 0, 10, 11 et au plafond ;
- égalité avec `max` au plafond ;
- cumul de renforcement ;
- plafonds de niveau ouverts ;
- outrepassement séparé ;
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
- aucun ancien build n’affiche un faux total ;
- un autre membre voit les résultats sans pouvoir les modifier ;
- une ancienne PWA ne peut pas supprimer silencieusement la configuration ;
- le mode hors ligne, la PWA, Realtime, le mobile et l’accessibilité restent
  fonctionnels ;
- le lot est utilisable seul, sans attendre les armures ou le total du héros.
