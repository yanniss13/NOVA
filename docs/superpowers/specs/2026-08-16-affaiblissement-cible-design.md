# Conception — recenser qui affaiblit la cible

Date : 2026-08-16
Demande : « j'ai un recensement des DPS, tu pourrais faire pareil avec tous les
personnages support, ceux qui mettent des malus de défense aussi, par exemple
Escanor lumière serait pris en compte ».

---

## 1. Pourquoi

L'onglet Analyse recense les DPS de la confrérie : qui les possède, à quel
potentiel, pour quel élément. Rien ne dit en revanche **qui peut affaiblir le
boss**, alors que c'est la seconde moitié d'une composition.

La demande nomme un cas qui décide de toute la conception : *Escanor lumière*.
Son épée à deux mains porte le rôle de slot `Attacker`, pas `Supporter`. Un
recensement fondé sur le rôle ne le verrait jamais — et c'est précisément lui
qu'on veut voir.

Le rôle de slot dit ce qu'un personnage **est**. Cette section doit dire ce
qu'il **fait**.

---

## 2. Décisions du propriétaire

Prises pendant le cadrage, elles ferment des questions et ne se rouvrent pas
sans raison :

1. **Étendre les données d'abord**, puis bâtir le recensement dessus. Le
   recensement ne vaut que ce que la table sait.
2. **Périmètre transcrit : les malus de défense ET la vulnérabilité**
   (`effet:"vulnerabiliteGlobale"`, « augmente les dégâts subis »). Pas le
   reste du kit de support — ni soins, ni bonus aux alliés — pour les
   personnages ajoutés.
3. **Quatre dimensions par ligne** : qui le possède dans la confrérie et à quel
   potentiel, l'effet chiffré, l'arme concernée, l'élément visé.

---

## 3. Ce qui est acquis et ne bouge pas

- `data/buffs-supports.js` garde sa forme actuelle. On ajoute des entrées, on
  ne change pas le schéma. Les tests existants couvrent donc les nouvelles
  lignes sans modification.
- La règle « une entrée porte un `stat` OU un `effet`, jamais les deux »
  reste, et son test aussi.
- `provenance.gameId` + `provenance.phrase` restent obligatoires. Le test
  vérifie que la phrase est un extrait **littéral** de la description du
  gameId.
- Le recensement des DPS n'est pas touché. La nouvelle section vit à côté.

---

## 4. Le nom de la section

**« Affaiblissement de la cible »**, et non « Supports ».

Meliodas et Escanor posent des malus de défense en étant des DPS purs. Les
ranger sous « Supports » ferait mentir la section sur ce que le membre y
trouve. Ce qui rassemble réellement ces lignes, c'est l'effet — faire encaisser
davantage au boss — pas le rôle du porteur.

---

## 5. Volet données

### 5.1 Périmètre chiffré

Relevé par expressions régulières sur `data/wiki-competences.js` :

Décompte en **personnages**, l'union étant ce qui décide du travail :

| | Concernés | Déjà couverts |
|---|---|---|
| Malus de défense | 15 | 7 |
| Vulnérabilité | 12 | 1 |
| **Union** | **19** | **7** |

La table compte aujourd'hui 8 personnages et 30 lignes. Le huitième, howzer,
ne pose ni malus ni vulnérabilité : il buffe les alliés, et sort donc de ce
décompte sans sortir de la table.

À ajouter : **12 personnages** — drake, elaine, escanor, gil-thunder, griamore,
hendrickson, jericho, king, klotho, meliodas, slader, tioreh — pour environ
**33 lignes**.

### 5.2 Les deux limites, écrites d'avance

**Le relevé est approximatif.** Le commentaire en tête de la table prévient que
les effets se cachent souvent dans la *définition d'un état* — « ※ Extinction :
… augmente les dégâts subis de 100 % » — et non dans la phrase principale de la
compétence. Une expression régulière sur les descriptions en manque. La table
sera plus complète qu'aujourd'hui ; elle ne sera pas exhaustive, et on ne
saura pas ce qui manque.

**La transcription lit des phrases, elle ne joue pas au jeu.** Une valeur mal
interprétée passe les tests sans broncher : le test vérifie que la phrase citée
existe, pas qu'elle a été comprise. Les valeurs restent donc à vérifier en jeu,
comme les trois hypothèses de formule déjà signalées dans AGENTS.md.

### 5.3 Effet de bord, et il est bienvenu

`js/metier/equipe-buffs.js` lit cette table pour alimenter le calculateur. Les
33 nouvelles lignes y apparaîtront comme autant de **cases à cocher**
supplémentaires, filtrées par l'arme réellement équipée du coéquipier.

Aucun calcul existant ne change en silence : les buffs sont opt-in, décochés par
défaut. Le calculateur gagne des options, il n'en réécrit aucune.

---

## 6. Volet Analyse

### 6.1 Emplacement

Une section dans `js/vues/analyse.js`, **après** la couverture élémentaire et
**avant** le classement par potentiel. La couverture pose le décor, cette
section dit qui peut l'exploiter.

### 6.2 Ce qu'une ligne montre

Une ligne par couple *personnage + effet*, portant :

- **le personnage et l'arme** qui porte l'effet — un support ne débuffe souvent
  qu'avec une arme précise, et l'omettre rendrait la ligne trompeuse ;
- **l'effet chiffré**, repris du `libelle` de la table, déjà rédigé en
  français : « Défense de l'ennemi −30 % » ;
- **l'élément visé** quand l'effet en cible un (`element` non nul), sinon la
  mention qu'il vaut pour tous ;
- **les membres qui le possèdent**, avec leur potentiel, comme le classement
  DPS. Un effet que personne ne possède reste affiché, en grisé : savoir qu'il
  manque à la confrérie est une information.

### 6.3 Source de la possession

Les rosters déjà agrégés par `rosterPlayerFrom`. Un membre possède l'effet s'il
a le personnage **et** l'arme qui le porte dans ses `builds`. La correspondance
arme ↔ effet se lit sur `provenance.gameId`, avec la même règle de jeton que
`vientDeLArme` dans `equipe-buffs.js` — pas un découpage par position, qui
casserait sur `gil_thunder_lance_jumpatk`.

### 6.4 Contrainte de couches

`analyse.js` est déclaré après `metier/` dans `tests/helpers/modules.js` : il
peut donc importer la logique de correspondance. Si `vientDeLArme` doit être
partagé, il remonte dans `metier/equipe-buffs.js` et s'exporte — jamais
l'inverse, et jamais recopié.

---

## 7. Tests

- **Table** : les tests existants de `buffs-supports.js` couvrent les nouvelles
  lignes sans modification. Ils exigent phrase littérale, forme unique
  (`stat` xor `effet`), et unité déclarée.
- **Recensement** : un test unitaire, sur le modèle de
  `tests/analyse-elements.test.js`, vérifiant que
  - un personnage à malus apparaît **quel que soit son rôle de slot** — le cas
    Escanor, qui est la raison d'être de la section ;
  - un personnage à slot Soutien **sans** malus mesuré n'y figure pas ;
  - l'arme affichée est celle du `gameId`, pas la première du personnage ;
  - un effet que personne ne possède reste listé.
- **Parcours** : une assertion dans le Playwright de l'Analyse, si un membre
  connecté y est déjà mis en scène.

---

## 8. Hors périmètre

- Le reste du kit des personnages ajoutés : soins, bonus aux alliés,
  résistance critique. Décision 2 du propriétaire.
- Toute vérification en jeu des valeurs transcrites.
- Le classement DPS, inchangé.
- Une refonte de `buffs-supports.js` : on ajoute des lignes, on ne remanie pas.
