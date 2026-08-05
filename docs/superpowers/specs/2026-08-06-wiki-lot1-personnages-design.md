# Wiki — lot 1 : la catégorie Personnages

**Date :** 2026-08-06
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Donner aux membres un endroit où lire ce qu'un héros fait réellement : ses
compétences et ses passifs, arme par arme, en français, sans quitter le site
ni ouvrir un onglet vers 7dsorigin.

## Découpage d'ensemble

Le wiki range tout par catégorie. Chaque catégorie est une tranche verticale :
elle livre des fiches complètes que le membre consulte, plutôt qu'une couche
technique invisible.

| Lot | Contenu | État |
|---|---|---|
| **1** | Catégorie Personnages : fiche par héros, compétences et passifs par arme | **cette spec** |
| 2 | Catégories Armes et Équipement : passifs d'armes, armures gravées, bonus d'ensembles | à cadrer |

Le lot 1 porte l'onglet, le rail de catégories, la grille et la modale de
fiche. Le lot 2 n'aura donc à écrire que ses propres fiches.

## Ce qui existe déjà et n'est pas à refaire

- **Les passifs d'armes et d'équipement**, avec leur texte français complet :
  `stats-build.js` porte `weaponsByFile[].passiveLevels` (7 niveaux, 94 armes),
  `engravedByFile[].passiveLevels` (3 niveaux, 68 armures gravées) et
  `gearSets` (bonus 2 / 4 / 7 pièces). C'est la matière du lot 2, déjà chargée
  par l'appli. **Le lot 1 n'y touche pas.**
- **Le rendu du balisage couleur** `[#RRGGBB]texte[-]` : `renderBonus()`
  (`js/vues/elements.js`) l'affiche déjà pour les potentiels. La source
  emploie exactement le même balisage pour les descriptions de compétences.
- **La technique d'extraction** : `flight_payload()` de
  `scripts/generate-stats.py` recolle le payload RSC de Next.js
  (`self.__next_f.push`). Cinq générateurs s'en servent déjà.
- **Les filtres de catégorie** : les quatre listes déroulantes du Roster
  (élément, arme, rôle, rareté) sont dérivées de `window.SEVEN_DS_META`, sans
  aucune liste écrite à la main. La grille du wiki réemploie ce dérivé.
- **La navigation de fiche en fiche** : `js/vues/detail-roster.js` gère déjà
  boutons précédent / suivant, flèches clavier et compteur « n / total »,
  au-dessus de `ModalStack`.
- **Le sélecteur d'arme d'une fiche** : `rosterDetailWeaponSwitch()` pose une
  rangée de boutons par type d'arme du personnage.
- **La mise en cache à la demande** : le gestionnaire `fetch` de `sw.js`
  (`cacheFirst`) met en cache tout fichier same-origin au premier accès.

## Source : ce qui a été relevé, pas supposé

### `https://7dsorigin.app/fr/characters/<slug>`

Relevé sur Derieri le 2026-08-06 : le payload RSC porte **18 compétences**,
six par type d'arme — `jumpatk`, `passive`, `skill_q`, `skill_e`, `skill_r`,
`skill_tag`. La page française porte exactement les mêmes `gameId` que la
page anglaise : aucune perte de couverture à lire le français.

Chaque compétence expose `gameId`, `weaponType`, `skillCategory`
(`PASSIVE` / `NORMAL` / `ULTIMATE` / …), `nameFr`, `descriptionFr`,
`descriptionEn` et `cooldown`.

Exemple intégral, tel que publié :

```json
{"gameId":"derieri_axe_passive","weaponType":"Axe","skillCategory":"PASSIVE",
 "nameFr":"Charge ténébreuse",
 "descriptionFr":"Réduit la résistance aux Ténèbres de l'ennemi de [#1A7331]3%[-] pendant [#1A7331]30s[-] pour chaque attaque normale qui fait mouche. (Max : [#1A7331]10 fois[-])\nLorsqu'un héros allié active un [#0F5CD8]Déluge des Ténèbres[-], augmente les dégâts crit. des héros alliés d'attribut Ténèbres de [#1A7331]40%[-] pendant [#1A7331]30s[-]."}
```

`robots.txt` de 7dsorigin.app interdit `/api/` à tous les agents, `ClaudeBot`
nommément. Le générateur lit donc la page publique, comme les cinq autres.

## Décision : un catalogue distinct de celui du comparateur

La branche `comparateur-degats-lot1` produit déjà un `data/competences.js`.
C'est un catalogue de **calcul** : noms anglais, pourcentages de dégâts,
répartition des coups — et `tests/competences-catalogue.test.js` y interdit
explicitement les passifs (« un passif ne doit pas entrer dans le catalogue de
calcul »).

Le wiki veut l'inverse : de la prose française, et les passifs surtout. Le lot
1 écrit donc **un fichier séparé**, `data/wiki-competences.js`. Aucun couplage
avec une branche non fusionnée, aucun risque de casser son invariant.

Le prix est assumé et nommé : les mêmes 18 compétences × 25 héros existeront
dans deux fichiers, avec des champs différents. **Chantier de fusion à ouvrir
quand le comparateur aura atterri sur `main`**, pas avant : concevoir contre
une cible mouvante coûte plus que la duplication.

## Architecture

### 1. `scripts/generate-wiki.py` *(créé)*

Lit `/fr/characters/<slug>` pour les 25 héros, une requête par héros, et écrit
`data/wiki-competences.js` posant `window.SEVEN_DS_WIKI_COMPETENCES`.

Forme du fichier :

```js
window.SEVEN_DS_WIKI_COMPETENCES = {
  "derieri": [
    {
      "gameId": "derieri_axe_passive",
      "weaponType": "Axe",
      "categorie": "PASSIVE",
      "nomFr": "Charge ténébreuse",
      "descriptionFr": "Réduit la résistance…",
      "recharge": null
    }
  ]
};
```

Le balisage couleur est conservé tel quel : `renderBonus()` le rend.
`recharge` vaut le `cooldown` publié, ou `null` — jamais 0 par défaut, une
absence n'est pas une valeur.

La liste des héros vient de `7ds-stats/personnages.json`, déjà commité : le
script n'écrit aucune liste de slugs à la main.

**Garde-fous.** Le script sort en erreur, sans rien écrire, si : moins de 20
héros sont extraits ; un héros n'a aucune compétence ; un type d'arme d'un
héros n'a pas de passif ; une description française est vide. Un catalogue
amputé en silence est pire que pas de catalogue.

`--check` vérifie seulement la présence du fichier commité et sort. Il ne
ré-aspire pas : `npm test` ne doit dépendre d'aucun site tiers.

### 2. `js/metier/wiki-competences.js` *(créé)*

Pur, sans DOM, donc testable seul :

- `competencesParArme(slug)` → `{ "Axe": [compétences ordonnées], … }`
- l'ordre est **passif, Q, E, R, TAG, attaque sautée**, dérivé du suffixe du
  `gameId` ; toute compétence à suffixe inconnu est rangée en fin plutôt que
  perdue ;
- un héros absent du catalogue rend un objet vide, jamais une exception : le
  site doit rester affichable si la donnée manque.

### 3. `js/vues/wiki.js` *(créé)*

La vue : rail de catégories, grille de portraits, filtres, chargement du
catalogue.

Le rail n'affiche que « Personnages » en lot 1, mais il est construit à partir
d'une liste — le lot 2 y ajoute deux entrées sans restructurer. Pas d'onglets
grisés promettant une date inconnue.

La grille reprend les portraits façon picker, les quatre filtres déroulants
dérivés de `SEVEN_DS_META` et un champ de recherche par nom.

**Chargement du catalogue** : à la première ouverture de l'onglet, une balise
`<script src="./data/wiki-competences.js">` est injectée — même forme que les
autres fichiers de données, qui posent tous un `window.*`. Un état d'attente
pendant le chargement ; en cas d'échec, un message explicite, pas une grille
vide.

### 4. `js/vues/wiki-fiche-heros.js` *(créé)*

La fiche, en modale au-dessus de `ModalStack`, avec précédent / suivant,
flèches clavier et compteur — le comportement de `detail-roster.js`.

Contenu, dans cet ordre :

1. portrait, nom, badges rareté / élément / rôle ;
2. sélecteur d'arme à trois boutons ;
3. les six compétences de l'arme choisie : nom français, recharge quand elle
   est publiée, description rendue par `renderBonus()` ;
4. quatre blocs repliables, alimentés par des données **déjà chargées** :
   potentiels P1→P10 (`potentiels.js`), maîtrises d'arme et stats de base
   (`stats-build.js`), armures liées (`armures-liees.js`).

Cette fiche est en lecture seule. Elle ne réemploie pas `heroDetail()` de
`fiche-heros.js`, qui décrit un **build** — un héros équipé — là où le wiki
décrit un **personnage**.

### 5. Intégration

- `index.html` : 8e onglet « Wiki » et `<section id="view-wiki">`.
- `sw.js` : les trois modules JS et `css/wiki.css` entrent dans
  `CORE_ASSETS`. **`data/wiki-competences.js` n'y entre pas** : ~150 à 200 Ko
  de prose pour un onglet qu'on ouvre délibérément, le faire télécharger à
  chaque membre au premier lancement coûterait plus qu'il ne rapporte.
  `cacheFirst` le met en cache au premier passage sur le Wiki, donc hors ligne
  ensuite. C'est le raisonnement déjà appliqué à l'icône 512 dans `sw.js`.
- `css/wiki.css` : liée dans l'ordre, vérifiée par `tests/css-ordre.test.js`.
- `AGENTS.md` : une section décrivant le catalogue et son générateur.

## Tests

### `tests/test_generate_wiki.py` *(créé, unittest)*

Le parsing, sur un échantillon de payload figé dans le test. Aucun appel
réseau. Couvre : extraction nominale, description vide rejetée, héros sans
passif rejeté.

### `python scripts/generate-wiki.py --check` *(ajouté à `npm test`)*

Le fichier commité est présent.

### `tests/wiki-competences.test.js` *(créé, unitaire)*

Le module métier : regroupement par arme, ordre des six compétences, suffixe
inconnu rangé en fin, héros absent rendant un objet vide.

### `tests/wiki-catalogue.test.js` *(créé)*

La cohérence du catalogue **commité** : 25 héros, trois types d'arme chacun,
un passif par type d'arme, aucune description vide. C'est ce test qui criera
le jour où le jeu ajoutera un héros sans qu'on regénère.

### `tests/wiki.playwright.js` *(créé)*

Le parcours réel : ouvrir l'onglet, filtrer, ouvrir une fiche, changer d'arme,
naviguer au clavier vers le héros suivant, et vérifier que la fiche s'affiche
encore une fois le réseau coupé.

### Tests existants qui couvrent le reste

`tests/modules-imports.test.js` et `tests/pwa.test.js` vérifient déjà que tout
module importé est déclaré et précaché. Les nouveaux modules y entrent sans
code de test supplémentaire.

## Hors périmètre

- La recherche transversale par effet (« qui donne des dégâts de Foudre ? »).
- La comparaison entre héros.
- Un lien depuis le Builder ou le Roster vers la fiche wiki.
- La fusion avec le `data/competences.js` du comparateur.
- Les catégories Armes et Équipement — lot 2.

## Risques

- **Le format du payload RSC peut changer chez la source.** Le script échoue
  bruyamment plutôt que d'écrire un catalogue amputé, comme les cinq autres
  générateurs. Le catalogue commité continue de servir en attendant.
- **Le poids du fichier.** Estimation : 150 à 200 Ko, ce qui passe pour un
  chargement à la demande. Si la génération sort nettement plus, le catalogue
  sera scindé par héros et chargé à l'ouverture d'une fiche plutôt qu'à
  l'ouverture de l'onglet.
