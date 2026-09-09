# La rotation d'une équipe — conception

**9 septembre 2026.** Validé point par point avec le membre avant écriture.

## Ce qu'on livre

Celui qui crée une équipe pose sa rotation en tapant des icônes de compétence.
Les autres membres la lisent d'un coup d'œil dans la modale de détail de
l'équipe. C'est un outil de **communication**, pas une entrée du simulateur :
il dit « voilà l'ordre dans lequel je joue », rien de plus.

Une rotation mélange les quatre héros de l'équipe, répète autant qu'il faut, et
peut contenir des **compétences combinées** — l'action d'équipe où un héros
lance et un ou deux autres enchaînent.

## 1. Le modèle de données

La rotation est **une liste plate de chaînes**, une par appui, portée par
l'équipe :

```js
rotation: [
  "ban_cudgel3c_jumpatk",
  "ban_cudgel3c_skill_e",
  "derieri_sword2h_skill_e",
  "@combine:merlin_staff_skill_r:tristan_sworddual_skill_q",
  "meliodas_sword1h_jumpatk",
  "meliodas_sword1h_skill_e",
  "meliodas_sword1h_skill_e"
]
```

**Pourquoi une liste plate et non des séries `{gameId, fois}`.** L'affichage
regroupe les répétitions consécutives en une case `×N`, mais le regroupement
reste une **vue calculée**. Stocker des séries introduirait un invariant —
« jamais deux séries voisines identiques » — que chaque mutation devrait
maintenir, et qu'une seule oubliée casserait en silence. La liste plate n'a
aucun invariant : elle est toujours valide.

**Pourquoi le `gameId` seul suffit.** Il encode déjà héros, arme et compétence
(`ban_cudgel3c_skill_e`). Rien à tenir d'accord avec un index de héros, qui
casserait au premier réordonnancement de l'équipe.

**Deux formes d'étape, une seule liste :**

| Forme | Sens |
|---|---|
| `ban_cudgel3c_skill_e` | une compétence d'un héros de l'équipe |
| `@combine:<lanceur>:<a>` | une combinaison à deux, **lanceur en tête** |
| `@combine:<lanceur>:<a>:<b>` | une combinaison à trois |

Le préfixe `@` ne peut pas entrer en collision avec un identifiant du jeu :
aucun n'en contient.

**Plafond : 60 appuis.** Il compte les appuis, pas les cases — `E ×5` en
consomme cinq. 60 identifiants pèsent moins de 2 Ko dans le blob.

**Aucune migration de schéma.** `public.teams.data` est un `jsonb` où
`teamToCloudRow` sérialise l'équipe entière, et `normalizeTeam` conserve les
champs qu'il ne connaît pas (`Object.assign({}, t, …)`). Le champ voyage seul,
en local comme dans le nuage.

## 2. Le catalogue des compétences combinées

### Ce que la table du jeu publie

`Output/Exports/…/Content/Table/Skill/CombineSkillTable.json` — **672 lignes**.

| Champ | Rôle |
|---|---|
| `UseCategory` | `CombineSkillTwoHeros` (456) ou `CombineSkillThreeHeros` (216) |
| `Owner_Skill_Tid` | **le lanceur** — c'est natif, on ne le déduit pas |
| `Striker_A_Skill_Tid` | le premier partenaire |
| `Striker_B_Skill_Tid` | le second, ou `None` |

**L'appariement se fait par compétence ET arme, jamais par héros.** Les 21
combinaisons de Ban sont toutes `ban_gauntlets_skill_r` : aux gantelets
uniquement. Un Ban au nunchaku ne peut lancer aucune combinaison. Une liste de
héros écrite à la main aurait laissé composer une rotation impossible.

⚠️ **CORRIGÉ le 9 septembre 2026, après implémentation.** Cette section
annonçait deux rubriques de palette, « ultimes combinés » et « spéciales
combinées ». **Elles n'existent pas dans le jeu**, et un membre l'a relevé :
il n'y a pas d'« attaque spéciale combinée ».

**LE SUFFIXE D'UN IDENTIFIANT NE DIT PAS SA CATÉGORIE.** C'est la racine des
deux erreurs, et il a fallu trois corrections du membre pour la trouver.

Vérification faite dans `Skill/PC_SkillTable.json`, champ `SkillCategory` :

| Identifiant | Catégorie réelle |
|---|---|
| `tristan_sworddual_skill_q` | `UltimateSKill` |
| `tristan_sworddual_skill_r` | **n'existe pas** |
| `tristan_sworddual_skill_rmb` | `ActiveThird` (sa spéciale) |
| `ban_gauntlets_skill_r` | `UltimateSKill` |
| `ban_gauntlets_skill_q` | `ActiveThird` |

Le suffixe varie d'un héros à l'autre pour la même catégorie. Et le verdict sur
tout le catalogue : **les 24 compétences de lancement et les 24 compétences de
partenaire sont TOUTES de catégorie `UltimateSKill`.**

Il n'existe donc **que l'ultime combiné** — pas de « spéciale combinée », et
une seule touche pour le déclencher : R au clavier, R2 à la manette. La table
s'appelle `ETagLinkSkillTableUseCategory` : c'est la **relève**, un coéquipier
entre en jeu et enchaîne.

La palette porte **une seule** rubrique, « Ultimes combinés », et chaque case
nomme ses **participants**, lanceur en tête. `tests/ultimes-combines-catalogue.test.js`
verrouille le fait **hors ligne**, en croisant le catalogue avec la catégorie
publiée dans `wiki-competences.js`.

**La leçon.** Le catalogue du site, lui, était juste depuis le début : il lit la
catégorie PUBLIÉE au lieu de la déduire d'un suffixe. Seul le code de rotation
inférait. La règle de la maison — « le code de la stat tranche, jamais la
prose » — vaut pour les VALEURS ; elle ne dispense jamais de demander la
mécanique à quelqu'un qui joue.

### L'extraction

`outils/fmodel/ecrire-ultimes-combines.js` lit l'export et écrit
`data/ultimes-combines.js`. Même procédé que `ecrire-verrous.js`, qui produit
déjà `data/animations-verrous.json` : l'outil vit dans `outils/fmodel/` parce
qu'il dépend d'un chemin local hors dépôt, le catalogue produit est commité, et
le site ne fait aucun appel réseau au rendu.

Forme du catalogue produit :

```js
window.SEVEN_DS_ULTIMES_COMBINES = [
  { lanceur:"ban_gauntlets_skill_r",
    partenaires:["tristan_sworddual_skill_q"] },
  …
];
```

Les `String_Tid` et `Local_Key` de la table valent `None` sur les lignes
observées : **aucune combinaison n'a de nom publié.** La case se nomme donc par
ses participants, jamais par une chaîne inventée.

## 3. Les modules

### `js/metier/rotation-equipe.js` — pur, ni DOM ni réseau

| Fonction | Ce qu'elle rend |
|---|---|
| `normaliserRotation(brut)` | liste de chaînes, saletés retirées, plafond appliqué |
| `paletteDeLEquipe(heroes)` | par héros : ses compétences pour son **arme équipée** |
| `combinaisonsDeLEquipe(heroes, catalogue)` | les combinaisons que cette équipe peut réellement exécuter |
| `casesDeLaRotation(rotation, heroes)` | la liste plate repliée en cases `{ etape, fois, participants, orpheline }` |
| `ajouterEtape(rotation, etape)` | ajout en fin, plafond respecté |
| `retirerUne(rotation, indexDeCase)` | retire **une** occurrence de la série |
| `retirerLaCase(rotation, indexDeCase)` | retire la série entière |
| `deplacerCase(rotation, de, vers)` | déplace la série entière |

`paletteDeLEquipe` s'appuie sur `metier/wiki-competences.js`
(`competencesParArme`), qui sait déjà grouper par arme et ordonner les touches,
et sur `equippedEnumOf` de `metier/armes.js` pour l'arme portée. Les passifs
sont exclus : on ne les lance pas.

`combinaisonsDeLEquipe` retient une ligne du catalogue quand **toutes** ses
compétences — lanceur et partenaires — appartiennent à un héros de l'équipe
avec son arme équipée. Une équipe qui n'en permet aucune reçoit une liste vide,
et la vue le dit.

### `js/donnees/catalogue-wiki.js` — extraction

`js/vues/wiki.js` porte aujourd'hui un chargeur paresseux privé pour
`wiki-competences.js` et `transcendances.js`. La modale de détail en a besoin à
son tour pour les icônes. On extrait donc ce chargeur, comme
`donnees/catalogues-dps.js` l'a été de `vues/fiche-heros.js` — deux chargeurs
finiraient par diverger sur ce qui est bloquant et ce qui ne l'est pas. Il
charge aussi le nouveau `data/ultimes-combines.js`, **non bloquant** : le jour
où ce fichier manque, la rotation perd sa section combinée, pas le bloc entier.

### `js/vues/rotation-equipe.js` — le bloc, deux modes

Lecture si le membre ne peut pas gérer l'équipe, édition sinon
(`canManageTeam`). Un seul composant, deux rendus.

### `js/metier/equipe-modele.js` — normalisation

`normalizeTeam` passe `rotation` par `normaliserRotation`. C'est ce qui garantit
qu'aucune saleté ne parte vers Supabase, quelle que soit la porte d'entrée.

### `js/vues/detail-equipe.js` — le branchement

Pose le bloc sous les fiches de héros et lui donne de quoi enregistrer.

## 4. L'interaction

### La palette

Les quatre héros de l'équipe, chacun avec les compétences de son arme équipée —
auto-attaque, compétence normale, spéciale, ultime, relève. Puis deux sections
séparées : **ultimes combinés** et **spéciales combinées**, limitées à ce que
l'équipe peut faire.

### Les gestes

| Geste | Effet |
|---|---|
| appui sur une icône de la palette | nouvelle case en fin, ou **+1** si c'est la même compétence que la dernière |
| appui sur une case | **+1** |
| `−` dans le coin de la case | **−1**, la case disparaît à zéro |
| glisser une case | déplace **la série entière** |
| flèches `◀ ▶` sous la case | déplace la série, au clavier et là où le glisser échoue |

Deux cibles tactiles par case, pas quatre. Le glisser passe par les **Pointer
Events** : le glisser-déposer HTML5 ne fonctionne pas au doigt.

**Limite assumée** : insérer une compétence au milieu d'une série demande de
raccourcir la série puis de reposer. C'est le prix de la compacité demandée, et
le cas est rare — on écrit une rotation dans l'ordre.

### L'affichage d'une case

- Compétence : l'icône du jeu (`7ds-ui/skills/<icone>`), le portrait du héros en
  médaillon, et `×N` quand N > 1.
- Combinaison : les portraits des participants, **lanceur en premier et plus
  grand**, dans un cadre distinct — c'est une action d'équipe, elle ne doit pas
  se lire comme la compétence d'un héros.

Le `×N` est écrit, jamais porté par la seule couleur.

## 5. L'enregistrement

Les mutations restent **en mémoire**. Un bouton « Enregistrer la rotation »
s'active quand l'état diffère de l'enregistré ; un bouton « Annuler » revient
en arrière.

Pas d'enregistrement automatique : chaque appui déclencherait un `upsert`
Supabase, et une rotation à moitié composée partirait dans le nuage. Même
frontière que l'essai d'enchantements du calculateur, qui ne touche jamais le
build enregistré tant qu'on ne le lui demande pas.

- Équipe de compte → `Store.upsert(equipe)`, asynchrone.
- Équipe locale → `Store.save(liste)` après remplacement dans la liste.
- Échec réseau → un `toast`, et l'état édité **reste à l'écran** pour être
  réessayé. On ne perd pas le travail du membre sur une coupure.

## 6. Les cas limites

| Cas | Comportement |
|---|---|
| étape dont le héros n'est plus dans l'équipe, ou a changé d'arme | case **orpheline** : cadre discret, libellé « compétence absente de l'équipe », retirable. Jamais supprimée en silence — la même règle que le catalogue de compétences, où une compétence non chiffrable garde sa ligne |
| combinaison dont un participant a quitté l'équipe | même règle, même rendu |
| équipe sans aucune combinaison possible | la section le dit en une phrase, au lieu d'ouvrir un sélecteur vide |
| `data/ultimes-combines.js` absent | la section combinée disparaît, le reste du bloc fonctionne |
| rotation vide, membre sans droit | le bloc ne s'affiche pas du tout : une section vide chez quelqu'un qui ne peut rien y faire n'est que du bruit |
| rotation vide, membre propriétaire | le bloc s'affiche avec sa palette, c'est l'invitation à en poser une |

## 7. Les tests

**Unitaires — `tests/rotation-equipe.test.js`**
- normalisation : types refusés, plafond à 60, préfixe `@combine` mal formé
- `casesDeLaRotation` : regroupement des séries consécutives, non-regroupement
  de séries séparées par autre chose, comptage `×N`
- étape orpheline : héros absent, arme changée, participant de combinaison parti
- les cinq mutations, y compris aux bornes (première case, dernière case)
- `combinaisonsDeLEquipe` : une équipe dont un héros porte la mauvaise arme
  n'obtient pas la combinaison — **le cas Ban nunchaku contre Ban gantelets**

**Unitaires — `tests/equipe-modele.test.js`**
- une rotation valide survit à `normalizeTeam`
- une rotation saturée de saletés en ressort propre

**Bout en bout — `tests/rotation-equipe.playwright.js`**
- ouvrir une équipe qu'on possède, taper deux compétences, vérifier le `×2`
- réordonner avec les flèches, enregistrer, rouvrir, vérifier l'ordre
- ouvrir une équipe d'un autre membre : aucune palette, aucun bouton
- cibles tactiles conformes à `CIBLE_TACTILE_PX`

## 8. Hors périmètre, explicitement

- **Alimenter le simulateur DPS.** Les `gameId` sont pourtant les mêmes que ceux
  du simulateur, donc comparer « ta rotation » à « celle que le simulateur
  trouve » deviendra possible sans changer le modèle. Ce n'est pas ce lot.
- **Des repères de temps par étape.** Écarté au cadrage : trop lourd à saisir au
  doigt pour ce que ça apporte.
- **Nommer la paire d'une combinaison à la main.** La table la donne.
- **Un aperçu sur la carte d'équipe dans la liste du Roster.** Une seule surface
  pour ce lot.
