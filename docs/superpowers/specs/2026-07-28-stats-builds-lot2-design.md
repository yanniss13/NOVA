# Stats de builds — Lot 2 : équipement, gravure et ensembles

**Date :** 2026-07-28
**Base :** `main` = `e041807` (lot 1 livré, déployé, vérifié)
**Suite de :** `2026-07-28-stats-builds-passation.md` (contexte général et
décisions du propriétaire)

## 1. Objectif

Étendre au reste de l'équipement ce que le lot 1 a fait pour l'arme : le membre
saisit le détail chiffré de chaque pièce, et le moteur en émet la contribution
décomposée.

Périmètre : les 4 armures, les 3 bijoux, l'équipement gravé, et les bonus
d'ensemble.

## 2. Décisions déjà prises, à ne pas re-litiger

Reprises de la passation, section 2 : **modèle documenté** (on distingue
visiblement le certain de l'estimé) et **saisie complète pièce par pièce**. Le
propriétaire a été averti du coût des deux et a maintenu ses choix.

## 3. Faits mesurés

Chaque affirmation ci-dessous a été vérifiée sur les données du dépôt. Les
commandes de vérification sont dans la passation § 3 pour l'arme ; celles
propres au lot 2 sont données ici.

### 3.1 Correspondance des emplacements — exacte

| Emplacement du site | Emplacement du jeu | Pièces |
| --- | --- | --- |
| `armor.Haut` | `Top` | 41 |
| `armor.Bas` | `Bottom` | 41 |
| `armor.Bottes` | `Shoes` | 40 |
| `armor.Ceinture` | `Belt` | 40 |
| `jewel.Anneau` | `Ring` | 22 |
| `jewel.Collier` | `Necklace` | 23 |
| `jewel["Boucle d'oreille"]` | `Earring` | 22 |
| `armor["Armure liee"]` | costume gravé | 83 en catalogue, 66 en images |

229 pièces d'équipement, 5 grades chacun.

### 3.2 « Armure liée » **est** l'équipement gravé

Les 66 images de `7ds-armures-ssr/Armure liee/` correspondent **toutes** à un
costume gravé du catalogue, par égalité de nom français. Zéro orpheline. Les
trois armures liées de Meliodas sont exactement ses trois costumes gravés.

Conséquence : **aucun nouvel emplacement à créer**. Les stats d'une armure liée
se retrouvent dans `armures-gravees.json` par le nom du fichier.

### 3.3 Segmentation par niveau — déductible, sans table cachée

```
nombre de segments = max(1, len(tierBoundaries) − 1)
```

Vérifié sur les **1 156 blocs** de croissance des 312 pièces (229 + 83), zéro
exception. Quand il n'y a qu'une borne, l'intervalle va de `qualityMin` à
`qualityMax`.

⚠️ Le `N` de `growthType: "equiplv_N"` est un **index de groupe interne (1 à 18),
redondant**. 7dsorigin ne publie aucune table de correspondance — 757 occurrences
comme valeur, **zéro comme clé de dictionnaire**. Ne construis pas de table, ne
va pas la chercher : la segmentation est portée par la pièce elle-même.

### 3.4 Renforcement — constante universelle

Les 412 occurrences de `growthType: "reinforce"` des armures portent la même
progression `[10300, 10700, 11200, 11800, 12500]`, soit ×1,03 / ×1,07 / ×1,12 /
×1,18 / ×1,25 pour les niveaux 1 à 5. `reinforceMax` vaut 5 partout.

⚠️ Ne pas confondre avec l'arme, qui n'a **aucun** `growthType: "reinforce"` et
passe par la promotion (passation § 3.2).

### 3.5 Options aléatoires — dans `growth`, et partielles

Elles vivent dans **`growth.randomOptions`**, pas à la racine de la pièce.
Chercher `item.randomOptions` renvoie toujours vide.

- **67 des 229** armures en ont — les hauts grades seulement ;
- **83 sur 83** des gravées en ont.

Un compte partiel n'est pas un bug. Une pièce sans options aléatoires n'émet
simplement aucun terme d'enchantement.

### 3.6 Les seuils d'ensemble ne sont PAS 2 et 4

C'est le piège principal de ce lot. Les noms de champs trompent :

| Champ | Valeurs réellement rencontrées sur les 21 ensembles |
| --- | --- |
| `bonusTwoCount` | **3** dans 11 ensembles, 2 dans 9, **4** dans 1 |
| `bonusFourCount` | 4 dans 8, **5** dans 5, **3** dans 3, **absent** dans 5 |

Coder « 2 pièces » et « 4 pièces » en dur serait **faux pour la majorité des
ensembles**. Les seuils se lisent toujours dans `bonusTwoCount` et
`bonusFourCount`, et un `bonusFourCount` absent signifie que l'ensemble n'a pas
de second palier.

Par ailleurs : les 21 `setId` référencés par des pièces existent tous dans
`sets.json` (zéro orphelin), et **113 des 229 pièces n'ont aucun `setId`**.

## 4. La seule présomption du lot

L'origine du gain par niveau : part-il de la **borne basse du segment** ou de
`qualityMin` ?

Traitement identique à l'outrepassement du lot 1 : **un paramètre nommé unique**,
avec en commentaire juste au-dessus la mention qu'il est présumé et le protocole
de vérification en jeu. Les termes qu'il produit portent
`confidence: "presumed"`.

Nom retenu : `ARMOR_LEVEL_ORIGIN_MODE`, valeurs `"segment-lower-bound"` (défaut)
ou `"quality-min"`. Aucune autre partie du calcul ne connaît cette hypothèse.

**Protocole de vérification à écrire dans le commentaire :** relever la stat
principale d'une pièce à deux niveaux différents d'un même segment, et comparer
l'écart au gain par niveau annoncé. Si l'écart correspond au niveau moins la
borne, le mode par défaut est bon.

## 5. Modèle de données

Symétrie stricte avec `weaponConfig` du lot 1.

```js
// dans un build de roster, ou un héros d'équipe
{
  weapon: "...", weaponConfig: { … },          // lot 1, inchangé
  armor: { Haut:file, Bas:file, Bottes:file, Ceinture:file, "Armure liee":file },
  armorConfig: {                                // nouveau
    Haut: { version:1, level:int, reinforce:int, enchantments:[…] },
    …
  },
  jewel: { Anneau:file, Collier:file, "Boucle d'oreille":file },
  jewelConfig: { Anneau:{ … }, … }              // nouveau
}
```

Règles :

- une config est **absente** tant que le membre n'a rien saisi ; elle n'est
  jamais inventée ;
- changer la pièce équipée **invalide** sa config, comme changer d'arme invalide
  `weaponConfig` ;
- l'armure liée utilise `armorConfig["Armure liee"]` — même forme que les autres,
  pas de structure à part ;
- **migration SQL obligatoire** : étendre les deux triggers du lot 1 pour
  préserver `armorConfig` et `jewelConfig` face à une PWA non mise à jour, selon
  la même logique que `weaponConfig` (préserver seulement si la pièce équipée est
  inchangée).

## 6. Contrat du moteur

Le contrat du lot 1 ne change pas de forme. Il s'étend :

- `bucket` : `"armor:Haut"`, `"jewel:Anneau"`, `"engraving"`, `"set"` ;
- `source.domain` : `"armor"`, `"jewel"`, `"engraving"`, `"set"` ;
- `source.component` : `"level"`, `"reinforce"`, `"enchantment"`, `"bonus"` ;
- `coverage` passe à `["weapon","armor","jewel","engraving","set"]`.

Les six exigences du lot 1 restent obligatoires : unité explicite par terme,
`operation` et `confidence` obligatoires, pas de joker `stat:"*"`, reconstruction
pilotée par les seaux, et **`incompatible` prime sur `incomplete`**.

**L'affichage reste « calcul partiel ».** Maîtrise et potentiel manquent encore :
il ne doit jamais annoncer « stats du héros » avant le lot 3.

## 7. Tests exigés

En TDD strict, et **chaque test doit être prouvé mordant** par mutation, comme à
chaque tâche du lot 1 :

1. segmentation : 1, 2, 3 et 4 segments selon `tierBoundaries` ;
2. renforcement : les cinq multiplicateurs, et le refus d'un niveau hors 0–5 ;
3. une pièce sans `growth.randomOptions` n'émet aucun terme d'enchantement, et
   `coverage` la déclare quand même couverte — pas de faux zéro ;
4. **seuils d'ensemble lus dans les données** : un ensemble à `bonusTwoCount: 3`
   ne s'active pas à 2 pièces. Ce test doit échouer si quelqu'un code 2 en dur ;
5. un ensemble sans `bonusFourCount` n'émet jamais de second palier ;
6. l'armure liée est rapprochée de ses stats par le nom de fichier, et une image
   sans costume correspondant ne casse rien ;
7. reconstruction : pour chaque stat, la somme des termes égale le total du
   moteur ;
8. basculer `ARMOR_LEVEL_ORIGIN_MODE` change la base sans changer le format ;
9. mobile 320 et 390 px : cibles de 44 px, **`overflow-x: hidden` sur tout
   conteneur défilant de modale**, et aucun élément plus large que son conteneur
   — le défaut corrigé en `30374f8` ne doit pas revenir par une nouvelle vue.

## 8. Hors périmètre

Maîtrise, potentiel par arme, totaux du héros et de l'équipe (lot 3). Synergies
de Combines, partage par lien, export d'image, hub communautaire.

## 9. Limites connues, à signaler et non à corriger ici

- **82 costumes gravés au catalogue, 66 images locales.** Les 16 restants seront
  absents du sélecteur, conformément à la règle d'or sur les assets. Un membre qui
  en possède un ne pourra pas le saisir. À combler par `generate-data.ps1`, hors
  de ce lot.
- **Bande passante du Recensement DPS.** `rosterDerivedPlayers()` lit toute la
  table `roster_characters` de tous les membres, `builds` compris, à chaque
  ouverture du Recensement et de l'Analyse. Avec des configs détaillées sur huit
  emplacements, ces deux vues téléchargeront beaucoup plus que nécessaire : elles
  n'ont besoin que du type d'arme et du rôle. Prévoir une RPC qui renvoie le
  recensement déjà calculé — **au lot 3**, quand le volume deviendra réel.
