# Wiki — lot 2 : Armes, Armures, Bijoux, Armures gravées

**Date :** 2026-08-06
**État :** validé, prêt pour le plan d'implémentation
**Suite de :** `2026-08-06-wiki-lot1-personnages-design.md`

## Objectif

Donner aux membres, dans le même onglet que les fiches de héros, le texte
complet des passifs d'armes et d'armures gravées, les statistiques de chaque
pièce et les bonus d'ensemble — sans quitter le site.

## Ce que le lot 1 a déjà posé et qui ne bouge pas

- L'onglet `#tab-wiki`, la section `#view-wiki`, le rail `.wiki-categories`
  construit pour accueillir d'autres entrées, la grille `#wikiGrid`, le champ
  `#wikiSearch` et l'état vide `#wikiEmpty`.
- `renderBonus()` (`js/vues/elements.js`) pour le balisage `[#RRGGBB]texte[-]`.
- `ModalStack` et le patron de navigation précédent / suivant / flèches /
  compteur de `detail-roster.js`, repris par `wiki-fiche-heros.js`.
- `formatBuildStatValue(valeur, unite)` et `BUILD_STATS.statLabels[code]`
  (`{fr, family, unit}`) pour rendre un code de statistique lisible.

## La donnée est déjà là — sauf un champ

Contrairement au lot 1, **aucun aspirateur n'est à écrire**. `data/stats-build.js`
est précaché et chargé au démarrage ; il porte déjà tout :

| Ce qu'il faut | Où c'est | Volume relevé |
|---|---|---|
| Passifs d'armes | `weaponsByFile[file].passiveLevels` | 7 niveaux × 94 armes (61 armes n'en ont pas) |
| Raretés et enchantements d'arme | `weaponsByFile[file].gradesByGameId` | 275 raretés sur 155 armes |
| Stats de pièce | `gearByFile[file]` | 99 pièces `grade5` |
| Passifs de pièce | `gearByFile[file].passiveLevels` | 3 niveaux × 10 pièces |
| Armures gravées | `engravedByFile[file]` | 68 pièces, 3 niveaux de passif chacune, `character` = slug du héros |
| Ensembles | `gearSets[setId]` | 15 ensembles, tous cités par au moins une pièce |

Les clés de ces trois tables **sont les chemins d'image** de `data/data.js`
(`7ds-armes/Hache/Hache de guerre.webp`). La jointure grille ↔ statistiques est
donc directe, sans table de correspondance à écrire.

### Le champ manquant : la prose des ensembles

`gearSets[setId]` porte `nameFr`, les seuils et les statistiques chiffrées,
mais **pas le texte**. Or `7ds-stats/sets.json`, déjà commité, le porte :

```json
"bonusFourFr": "Attaque [#D67314]+5%[-]\nL'activation d'un [#0F5CD8]Déluge[-] restaure la [#0F5CD8]jauge de magie[-] de [#1A7331]200[-]. (Temps de recharge : [#1A7331]20s[-])"
```

`fourStats` ne retient que `I_AtkAdd_Rate: 500` : la clause sur le Déluge est
perdue. Afficher un bonus d'ensemble amputé de sa moitié conditionnelle
tromperait le lecteur.

**Décision.** `gear_set_entry()` dans `scripts/generate-stats-build.py` gagne
`twoTextFr`, `fourTextFr`, `sevenTextFr`, copiés tels quels de `bonusTwoFr`,
`bonusFourFr`, `bonusSevenFr`. `data/stats-build.js` est régénéré : +6 Ko sur
2,3 Mo. Aucun autre générateur n'est touché, aucun appel réseau n'est ajouté.

Le champ est du texte, pas un chiffre : il n'entre dans aucun calcul et
`tests/stats-build-catalog.test.js` continue de valider les seuils et les
statistiques comme avant.

## Découpage : quatre catégories, pas trois

Le rail passe à cinq entrées :

`Personnages · Armes · Armures · Bijoux · Armures gravées`

Armures (62 pièces) et Bijoux (37) sont séparés bien qu'ils partagent la table
`gearByFile` et le mécanisme d'ensembles. C'est le choix du commanditaire :
deux grilles courtes valent mieux qu'une de 99 vignettes.

**La conséquence est traitée, pas subie.** Un ensemble comme « Au bord du
néant » n'a que des bijoux, un autre que des armures : la coupure des grilles
couperait l'information. Chaque fiche de pièce affiche donc l'ensemble **avec
toutes ses pièces sœurs en vignettes cliquables**, quelle que soit la grille
d'origine. Cliquer une sœur ouvre sa fiche, même si elle appartient à l'autre
catégorie.

## Architecture

### 1. `js/metier/wiki-equipement.js` *(créé)*

Pur, sans DOM. Il joint `data.js` (les images et les noms) à
`stats-build.js` (les chiffres et les textes), et ne rend que des objets.

```js
armesDuWiki()      // [{file, nom, type, raretes:[...], aPassif}]
armuresDuWiki()    // [{file, nom, slot, setId, grade}]
bijouxDuWiki()     // idem
graveesDuWiki()    // [{file, nom, heros}]
ensembleDe(setId)  // {id, nom, paliers:[{compte, stats, texte}], pieces:[file]} | null
objetDuWiki(file)  // l'entrée ci-dessus correspondant à un chemin, ou null
```

Règles :

- **Une pièce sans entrée dans `stats-build.js` reste listée**, avec ses champs
  chiffrés à `null`. Une image ajoutée au dépôt avant la régénération des
  statistiques doit apparaître dans la grille, pas disparaître.
- `ensembleDe()` rend `null` pour un `setId` inconnu plutôt que de lever.
- `paliers` ne contient que les seuils réellement publiés : un ensemble sans
  palier 7 n'en expose pas un vide.
- Les listes sont triées par nom en `fr-FR`.

### 2. `js/vues/wiki-blocs.js` *(créé)*

Les briques de rendu partagées par les quatre fiches :

```js
titreSection(texte, ton)          // le filet + le libellé en petites capitales
ligneDeStat(code, valeur)         // <li> ou null si le code n'a pas de libellé
listeDeStats(entrees)             // <ul class="wiki-stats"> ou null si vide
selecteurNiveaux(niveaux, actif, auChangement)  // la rangée de pastilles
repliable(titre, contenu)         // <details> ou null si contenu vide
```

`wiki-fiche-heros.js` porte aujourd'hui ses copies privées de `titreSection`,
`ligneDeStat` et `repliable` ; elles sont **déplacées ici** et le module les
importe. Trois définitions ne doivent pas devenir six.

### 3. `js/vues/wiki-fiche-objet.js` *(créé)*

La modale des objets : une seule pour les trois natures. Elle porte ce qui ne
dépend pas du contenu — ouverture, fermeture, précédent / suivant, flèches
clavier, compteur « n / total », préservation du focus — et aiguille le corps
vers `wiki-corps-arme.js` ou `wiki-corps-equipement.js` selon la nature de
l'entrée. Elle s'enregistre auprès de `wiki.js` par `brancherFicheObjet()`,
comme `wiki-fiche-heros.js` le fait déjà avec `brancherFiche()`.

Elle réutilise le même patron de préservation du focus que la fiche de héros :
le bouton focalisé disparaît quand le corps est vidé, et le focus retombe hors
de la modale, ce qui tue les flèches. Le remplaçant reçoit le focus.

### 4. `js/vues/wiki-corps-arme.js` *(créé)*

Le corps d'une fiche d'arme, dans cet ordre :

1. **En-tête** : vignette, nom, type d'arme, raretés disponibles en pastilles.
2. **Passif** — le sélecteur de niveaux 1→7, **ouvert sur le niveau maximum**,
   et le texte du niveau choisi rendu par `renderBonus()`. Les 61 armes sans
   passif n'affichent pas de section : une section vide serait un mensonge sur
   ce que l'arme sait faire.
3. **Statistique principale**, par rareté : valeur de base et valeur maximale.
4. **Enchantements** : les options tirables de la rareté maximale, min → max.

### 5. `js/vues/wiki-corps-equipement.js` *(créé)*

Le corps d'une pièce ou d'une armure gravée — même fichier, les deux ne
diffèrent que par leur provenance :

1. **En-tête** : vignette, nom, emplacement, rareté.
2. **Provenance** :
   - une pièce d'ensemble affiche son ensemble, chaque palier avec son seuil,
     sa prose rendue par `renderBonus()`, et les pièces sœurs en vignettes
     cliquables ;
   - une armure gravée affiche **le héros lié**, portrait et nom, cliquable :
     il ouvre la fiche de héros du lot 1.
3. **Passif** — sélecteur 1→3 quand la pièce en a un (10 pièces sur 99, les 68
   gravées).
4. **Statistiques** principale, secondaire, et supplémentaires.
5. **Gravures** : les options tirables, min → max, avec leur nombre
   d'emplacements.

### 6. `js/vues/wiki.js` *(modifié)*

Le rail devient une table :

```js
const CATEGORIES = [
  { cle:"heros",   libelle:"Personnages",      ... },
  { cle:"armes",   libelle:"Armes",            ... },
  { cle:"armures", libelle:"Armures",          ... },
  { cle:"bijoux",  libelle:"Bijoux",           ... },
  { cle:"gravees", libelle:"Armures gravées",  ... }
];
```

Chaque entrée déclare : son libellé, sa source (une fonction du module métier),
le texte du champ de recherche, ses filtres, et ce que fait un clic sur une
tuile.

**Les filtres passent de l'HTML au JS.** `index.html` ne fige plus quatre
`<select>` : il porte un `<div id="wikiFilters">` vide que la vue remplit selon
la catégorie active. Les filtres de la catégorie Personnages **gardent leurs
identifiants actuels** (`#wikiFilterElement`, `#wikiFilterWeapon`,
`#wikiFilterRole`, `#wikiFilterRarity`) : les tests du lot 1 continuent de
passer sans retouche.

Les valeurs des listes déroulantes restent **dérivées des données observées**,
jamais écrites à la main — la règle du lot 1, qui a évité le piège
`SUPPORT` / `Supporter`.

| Catégorie | Filtres |
|---|---|
| Personnages | élément, arme, rôle, rareté *(inchangés)* |
| Armes | type d'arme, rareté maximale, « avec passif » |
| Armures | emplacement, ensemble |
| Bijoux | emplacement, ensemble |
| Armures gravées | héros |

Le catalogue `data/wiki-competences.js` reste chargé à la demande à
l'ouverture de l'onglet : les quatre nouvelles catégories n'en ont pas besoin,
mais la catégorie Personnages ouvre l'onglet dans neuf cas sur dix et le
chargement conditionnel par catégorie compliquerait la vue sans rien gagner.

### 7. Intégration

- `index.html` : les quatre boutons de catégorie, `#wikiFilters` à la place des
  quatre `<select>`, et l'overlay `#wikiItemOverlay` sur le modèle de
  `#wikiHeroOverlay`.
- `sw.js` : les quatre nouveaux modules JS entrent dans `CORE_ASSETS`.
- `css/wiki.css` : les classes des nouvelles fiches, à la suite des
  existantes.
- `js/app.js` : `import "./vues/wiki-fiche-objet.js";` pour effet de bord.
- `tests/helpers/modules.js` : les quatre modules dans leur couche.
- `AGENTS.md` : la section wiki décrit les catégories du lot 2 et la
  provenance de la prose des ensembles.

## Tests

### `tests/wiki-equipement.test.js` *(créé, unitaire)*

Le module pur dans un `vm`, sans navigateur : les quatre listes ont la bonne
taille, une pièce absente de `stats-build.js` reste listée avec des champs
nuls, `ensembleDe()` rend `null` sur un identifiant inconnu, `ensembleDe()`
d'un ensemble de bijoux rend bien **toutes** ses pièces, un ensemble sans
palier 7 n'en expose pas.

### `tests/wiki-lot2.playwright.js` *(créé)*

Le parcours réel : passer d'une catégorie à l'autre, vérifier que la grille et
les filtres changent, filtrer dans chacune, ouvrir les trois natures de fiche,
manœuvrer le sélecteur de niveaux et voir le texte changer, cliquer une pièce
sœur d'un ensemble et arriver sur sa fiche, cliquer le héros d'une armure
gravée et arriver sur la fiche du lot 1, naviguer au clavier. Un guetteur de
réponses `.webp` ≥ 400 comme dans `wiki.playwright.js`.

### Tests existants

`tests/wiki.playwright.js` doit passer **sans modification** : c'est la preuve
que le lot 1 n'a pas régressé. `tests/css-ordre.test.js`,
`tests/modules-imports.test.js` et `tests/pwa.test.js` couvrent
automatiquement les nouveaux fichiers une fois déclarés.

## Hors périmètre

- Un lien depuis le Builder ou l'éditeur d'équipement vers ces fiches.
- La recherche transversale par effet (« quelles armes donnent du crit ? »).
- Les 61 armes sans passif : elles sont listées et leurs statistiques
  s'affichent, mais rien n'est inventé pour combler la section absente.
- Les raretés `grade1` à `grade4` des pièces d'équipement : le dépôt ne porte
  d'images que pour les `grade5`, et une fiche sans vignette n'a pas sa place
  dans une grille d'images.
- La fusion avec `data/competences.js` du comparateur, toujours différée.

## Risques

- **Le poids de `stats-build.js`.** Il est déjà précaché et pèse 2,3 Mo ; les
  +6 Ko de prose ne changent pas sa nature. Aucun chargement à la demande n'est
  introduit : la donnée est là au démarrage, les fiches s'ouvrent hors ligne
  dès la première session, contrairement au catalogue du lot 1.
- **La régénération de `stats-build.js`** doit produire exactement le même
  contenu que le générateur, sinon `--check` échoue dans `npm test`. Le fichier
  est régénéré par le script, jamais édité à la main.
- **`wiki.js` grossit.** La table des catégories le tient : chaque catégorie
  est une ligne de données, pas une branche de code. Si le fichier dépasse ce
  qui se lit d'un trait, les filtres partiront dans leur propre module.
