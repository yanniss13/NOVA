# Analyse cliquable et retrait du Recensement DPS — conception

**Date :** 2026-07-29
**Base :** `main` = `6e7fd8e`
**État :** conception à valider par le propriétaire
**Périmètre :** onglet Analyse (lot 1) puis retrait du Recensement DPS (lot 2).
Aucune modification du schéma Supabase.

## 1. Constat vérifié

Chaque point ci-dessous a été relu dans le code, pas déduit.

- `rosterDerivedPlayers()` (`index.html` ~6307) lit uniquement
  `roster_characters` et les profils. Elle ne touche **jamais** la table
  `recensement`.
- `renderAnalyse()` (~9496) et le classement `renderRankTable()` (~9471) se
  nourrissent exclusivement de `rosterDerivedPlayers()`.
- La table `recensement` n'est lue et écrite que par la machinerie de son
  propre onglet : `cloudRecCache` (~8996), `recPlayersForView()` (~9005), et les
  trois accès Supabase (~9027, ~9042, ~9056).
- Ni les groupes de boss, ni « Mon suivi », ni `scripts/discord-reminder.js` ne
  consomment ces données.
- La règle DPS vit déjà dans `isRosterBuildDps()` (~6281) : rôle `Attacker`
  toujours ; rôle `Buster` uniquement pour `gowther` en `Wand` à partir du
  palier 7.

Le Recensement frontend fait donc doublon avec l'Analyse, sans rien lui fournir.

## 2. Le défaut découvert en concevant

`dpsEntriesFromRoster()` (~6288) **déduplique par élément** :

```js
if(!element || seen.has(element)) return;
seen.add(element);
out.push({ char:entry.charId, element, pot:entry.potentialTier||0 });
```

Conséquences, toutes vérifiées sur les données :

1. **Meliodas SSR possède trois builds DPS Ténèbres** — Épée à une main
   (`Sword1h`), Hache (`Axe`), Épées doubles (`SwordDual`). La fonction n'en
   émet **qu'un seul** ; les deux autres sont silencieusement perdus.
2. Le survivant dépend de l'ordre de `Object.keys(entry.builds)`, qui n'est
   garanti par rien de métier. Deux membres ayant saisi les mêmes builds dans un
   ordre différent peuvent voir des armes différentes.
3. L'entrée produite ne porte **aucune information d'arme**. Déduire le build
   depuis l'élément est donc impossible pour Meliodas, et fragile partout
   ailleurs.

Ce lot ne complète pas la donnée : il répare une perte. Le classement continue
d'afficher **une ligne par élément** — ce comportement ne change pas — mais la
ligne sait désormais quels builds elle représente.

## 3. Décisions du propriétaire

- Ordre : les personnages cliquables d'abord, le retrait du Recensement ensuite.
- Le classement reste trié par palier de potentiel. Ce lot n'y touche pas.
- Ne jamais déduire le build depuis le seul élément.
- `supabase/schema.sql` reste inchangé ; la table `recensement` et ses données
  sont conservées. Une suppression SQL éventuelle fera l'objet d'une migration
  séparée dans quelques semaines.
- Rien n'est poussé sans autorisation explicite.

## 4. Lot 1 — personnages cliquables dans l'Analyse

### 4.1 Donnée dérivée enrichie

`dpsEntriesFromRoster(entry)` produit désormais, par élément :

```js
{
  char: "meliodas",
  element: "DARK",
  pot: 7,
  weaponTypes: ["Sword1h", "Axe", "SwordDual"],
  preferredWeaponType: "Sword1h"
}
```

**Espace de noms.** `weaponTypes` et `preferredWeaponType` sont des **enums**
(`Sword1h`, `Axe`, `Wand`…), pas des noms de dossier. Les clés de
`entry.builds` sont des dossiers français (`"Epee 1 main"`, `"Hache"`) ; la
conversion passe par les tables existantes `FOLDER_TO_ENUM` et `ENUM_TO_FOLDER`
(~2013). Aucune nouvelle table de correspondance n'est créée. Les consommateurs
qui ont besoin d'une clé de build reconvertissent par `ENUM_TO_FOLDER`.

**Ordre stable.** `weaponTypes` est trié selon l'ordre des slots d'arme du
personnage tel que publié dans ses métadonnées (`m.weapons`), pas selon l'ordre
des clés de `entry.builds`. Deux membres ayant les mêmes builds obtiennent donc
la même liste, dans le même ordre.

**Filtrage.** Seuls les builds satisfaisant `isRosterBuildDps()` entrent dans
`weaponTypes`. La règle Gowther P7+ est donc respectée sans être réécrite : sa
Baguette est le seul build `Buster` admis, et uniquement à partir du palier 7.

**Le regroupement par élément est conservé, la perte ne l'est pas.** La
fonction continue d'émettre **une entrée par élément** — le classement affiche
donc le même nombre de lignes qu'aujourd'hui. Ce qui change est le traitement
du deuxième build d'un même élément : au lieu d'être ignoré (`return`), son
type d'arme est **ajouté au `weaponTypes` de l'entrée existante**. La
déduplication devient une agrégation.

**Compatibilité.** Les champs `char`, `element` et `pot` sont conservés à
l'identique, avec les mêmes valeurs qu'avant le lot.

### 4.1 bis Les données nécessaires à la modale doivent survivre au chargement

`rosterDerivedPlayers()` construit aujourd'hui `byOwner` à partir de
`cloudRosterFromRow(row)`, s'en sert pour calculer les entrées DPS, puis
**jette les rosters normalisés** : elle ne renvoie que
`{ owner, name, dps }`. `analysePlayers` ne contient donc ni armes, ni armures,
ni configurations — de quoi afficher un classement, pas un équipement.

Sans correctif, ouvrir la modale depuis l'Analyse imposerait une relecture
réseau, ce que §4.5 interdit.

`rosterDerivedPlayers()` conserve donc les personnages normalisés déjà
calculés :

```js
{ owner, name, dps:[…], characters:[…] }   // characters = les entrées de byOwner
```

Aucune requête supplémentaire : ces objets sont déjà en mémoire, le lot cesse
simplement de les jeter. Le coût est la rétention des rosters de la confrérie
déjà téléchargés pour cette vue.

### 4.2 Sélection initiale

`preferredWeaponType` est déterminé dans cet ordre, sans exception :

1. le build favori du personnage, s'il existe et s'il fait partie de
   `weaponTypes` — `favoriteRosterWeaponType(entry)` (~6065) renvoie une clé de
   dossier, à convertir en enum avant comparaison ;
2. sinon `Sword1h`, s'il fait partie de `weaponTypes` ;
3. sinon le premier élément de `weaponTypes`, dont l'ordre est stable par §4.1.

La règle 2 est une préférence de jeu du propriétaire pour Meliodas. Elle
s'applique telle quelle à tout personnage dont les builds DPS incluent
`Sword1h` ; aucune exception codée par personnage n'est introduite, ce que la
règle d'or du dépôt interdirait.

### 4.3 Ouvrir la modale depuis l'Analyse

**Obstacle réel.** La modale de détail du roster s'ouvre aujourd'hui par
`openRosterDetail(index)` (~7277), où `index` désigne une position dans la
liste de roster actuellement rendue, et où `moveRosterDetail(step)` navigue par
incrément dans cette même liste. L'Analyse ne possède pas cette liste : elle a
un joueur, un personnage et des types d'armes.

**Résolution.** Le point d'entrée est dédoublé, sans dupliquer le rendu :

```js
openRosterDetail(index)                       // inchangé, appelants existants
openRosterDetailFor(context)                  // nouveau
```

`context` porte explicitement ce qu'il faut afficher :

```js
{
  entry,                 // le personnage normalisé, issu de player.characters (§4.1 bis)
  memberName,            // pseudo affiché du propriétaire du roster
  weaponTypes,           // enums, ordre stable
  weaponType,            // build ouvert initialement
  returnFocusTo          // élément à refocaliser à la fermeture
}
```

`entry` est l'objet déjà normalisé, pas un identifiant : la modale rend depuis
la mémoire et n'a rien à retrouver ni à recharger.

`openRosterDetail(index)` devient un adaptateur qui construit ce contexte
depuis la liste du roster puis appelle `openRosterDetailFor`. Le rendu, la pile
de modales et la fermeture restent communs.

**Navigation précédent/suivant.** Elle n'a pas de sens depuis un classement
filtré par élément. Dans un contexte ouvert par `openRosterDetailFor` sans
liste, les contrôles de navigation sont **masqués**, pas désactivés : un
contrôle inerte visible est une promesse non tenue.

### 4.4 Ce que la modale affiche depuis l'Analyse

- un DPS ordinaire : **uniquement son build DPS** ;
- Gowther au palier 7 ou plus : **uniquement la Baguette** ;
- Meliodas : **ses trois builds DPS Ténèbres enregistrés**, sélectionnables par
  leurs icônes d'arme ;
- les builds Support, Gardien ou Briseur non concernés sont **masqués**.

Ces builds masqués restent consultables normalement depuis l'onglet Roster :
cette restriction est propre à la vue Analyse, elle ne supprime rien.

Le sélecteur d'arme n'apparaît que si `weaponTypes` contient au moins deux
entrées. Un sélecteur à un seul choix est du bruit.

### 4.5 Interaction et accessibilité

- Chaque ligne DPS de `renderRankTable()` devient un `<button>`, pas une `<div>`
  munie d'un `onclick` : le rôle, la tabulation et l'activation clavier
  viennent alors du navigateur.
- Cible tactile d'au moins 44 × 44 px, y compris à 320 px.
- Ouverture par la pile `ModalStack` existante.
- La fermeture — bouton, Échap ou clic extérieur — **rend le focus à la ligne
  exacte** qui a ouvert la modale, via `returnFocusTo`.
- **Aucune lecture réseau au clic.** Les données viennent de
  `analysePlayers`, déjà chargé par `renderAnalyse()`. Le clic ne déclenche ni
  requête Supabase, ni rechargement de page.
- Lecture seule stricte : aucun contrôle d'édition, aucun bouton suggérant une
  modification. Les politiques RLS l'interdisent déjà côté serveur ; l'interface
  ne doit pas laisser croire le contraire.

## 5. Lot 2 — retrait du Recensement DPS du frontend

Supprimés, après vérification que plus rien ne les référence :

- l'onglet `tab-recensement` et la vue `view-recensement` ;
- `renderRecensement()` et son routage (~6496, ~6816) ;
- les rafraîchissements Realtime propres à cette vue ;
- `cloudRecCache`, `saveCloudRecCache()`, `readRecCache()` ;
- `recPlayersForView()` ;
- l'ancien repli local (`LocalRec`) et la migration locale vers le cloud
  (`localPlayerForMigration`) ;
- les fonctions et le CSS devenus réellement morts — chacun vérifié par
  recherche avant suppression, jamais supprimé par présomption ;
- les références dans les tests, notamment la liste d'onglets de
  `tests/accessibilite-mobile.playwright.js` (~1193) ;
- les textes frontend devenus faux, notamment le message d'authentification qui
  parle encore du recensement.

Conservés sans exception :

- `supabase/schema.sql` **inchangé** ;
- la table `recensement`, ses politiques RLS et ses données ;
- aucun `DROP`, aucune migration destructive.

Un `grep -rn "recensement"` après le lot ne doit plus retourner que
`supabase/schema.sql` et les documents d'historique.

## 6. Tests

TDD strict, chaque assertion vue échouer pour la bonne raison, puis prouvée
mordante par une mutation volontaire.

### Donnée dérivée

- une entrée DPS porte `weaponTypes` et `preferredWeaponType`, et ne les devine
  jamais depuis l'élément ;
- Meliodas avec trois builds Ténèbres enregistrés produit **une** ligne dont
  `weaponTypes` contient les trois enums ; la mutation qui rétablit la
  déduplication par élément doit faire échouer ce test ;
- l'ordre de `weaponTypes` suit les slots du personnage et ne dépend pas de
  l'ordre d'insertion des clés de `builds` ;
- le favori est choisi en priorité ;
- sans favori, `Sword1h` est choisi ;
- sans favori et sans `Sword1h`, repli stable sur le premier de `weaponTypes` ;
- un favori portant sur un build **non DPS** n'est pas retenu ;
- un DPS ordinaire ne porte qu'un seul `weaponTypes` ;
- Gowther au palier 7 ne porte que `Wand` ; au palier 6 il ne produit aucune
  entrée DPS ;
- `char`, `element` et `pot` sont inchangés pour les entrées existantes ;
- **le nombre de lignes du classement est identique avant et après le lot**
  pour un même roster : l'agrégation ne doit pas multiplier les lignes de
  Meliodas ;
- `rosterDerivedPlayers()` renvoie les personnages normalisés, et la mutation
  qui les rejette à nouveau doit faire échouer le test d'ouverture de la modale.

### Modale et interaction

- ouvrir depuis l'Analyse affiche le build attendu ;
- les armes non DPS sont absentes de cette modale ;
- le sélecteur d'arme est absent quand il n'y a qu'un build ;
- la navigation précédent/suivant est absente dans ce contexte ;
- `openRosterDetail(index)` conserve son comportement pour ses appelants
  existants ;
- clic souris et activation clavier ouvrent la même modale ;
- la fermeture rend le focus à la ligne cliquée ;
- cible tactile d'au moins 44 px à 320 et 390 px, sans débordement horizontal ;
- aucune requête réseau n'est émise au clic.

### Retrait

- aucune référence frontend active à l'ancien onglet Recensement ;
- `supabase/schema.sql` est identique avant et après le lot ;
- suite `npm test` entièrement verte, puis `git diff --check` et
  `git status --short` propres.

## 7. Dégradation

- Un membre sans aucun build DPS n'apparaît pas dans le classement, comme
  aujourd'hui.
- Un personnage absent du catalogue local ne produit aucune entrée.
- Un `weaponTypes` vide est impossible par construction : une entrée n'existe
  que si au moins un build DPS l'a produite. Le rendu ne doit malgré tout jamais
  supposer un tableau non vide.
- Hors ligne, le classement affiche ce que le chargement précédent a fourni ;
  le clic reste fonctionnel puisqu'il ne lit rien.

## 8. Mise en service et retour arrière

Aucune modification SQL, aucun champ persisté, aucune migration. Les deux lots
sont réversibles par revert. Ordre : lot 1, validation du propriétaire, lot 2,
validation, puis fusion et push **sur autorisation explicite**. Ensuite workflow
Pages vert, mise à jour PWA acceptée, et vérification que le `BUILD_VERSION`
servi correspond au SHA publié.

## 9. Critères d'acceptation

- Meliodas apparaît une fois en Ténèbres, et sa modale propose ses trois armes
  DPS ;
- aucun build n'est plus perdu par la déduplication ;
- un DPS ordinaire ouvre directement son unique build ;
- Gowther P7+ ouvre sa Baguette et rien d'autre ;
- l'onglet Recensement a disparu sans qu'aucune donnée Supabase soit touchée ;
- tout est utilisable au clavier, et la fermeture rend le focus.
