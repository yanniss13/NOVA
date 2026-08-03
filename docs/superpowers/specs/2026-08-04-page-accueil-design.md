# Page d'accueil — design

**Date :** 2026-08-04
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Donner au membre connecté un écran d'arrivée qui répond aux questions qu'il se
pose en ouvrant le site, et pas seulement à celles qui concernent le boss.

## Décisions cadrées avec l'utilisateur

1. **Public : le membre connecté.** Pas de vitrine publique. Le site sert à
   agir, pas à se présenter.
2. **Approche : élargir « Mon suivi » plutôt que créer une seconde vue.** Deux
   tableaux de bord pour quinze personnes finiraient par diverger, et « Mon
   suivi » possède déjà le cache hors ligne, le rendu et le pilotage d'onglets.

## Ce qui existe déjà et ne change pas

`js/vues/suivi.js` rend aujourd'hui : « À faire maintenant », « Runs engagées
X/3 », « Runs en cours », « Runs terminées cette semaine », l'échéance, les
états hors ligne et le mode déconnecté. `runDashboardAction` est le seul
endroit du site qui pilote une autre vue : il change d'onglet **puis** met le
focus, et c'est pour lui que `showView` renvoie une promesse.

Ces blocs sont testés et fonctionnent. Le design ne les touche pas.

Le trou est ailleurs : la vue ne parle **que** du boss. Les dispos, le roster
et les équipes n'y apparaissent pas.

## 1. Navigation

- L'onglet `#tab-dashboard` est renommé **« Accueil »** et passe en première
  position dans `<nav class="tabs">`, devant « Créer une équipe ».
- `class="view active"` quitte `#view-builder` pour `#view-dashboard`.
- `aria-selected="true"` et `tabindex="0"` suivent le même déplacement ;
  `#tab-builder` repasse à `aria-selected="false"` et `tabindex="-1"`.
- Le titre de section devient « Accueil » et le chapô décrit la semaine, pas
  seulement les runs : « Ce qu'il te reste à faire cette semaine. »

**Effet de bord voulu.** `js/vues/session-auth.js:128` appelle
`showView("dashboard")` une fois la session appliquée. Comme le membre partait
de `builder`, il voyait un bref clignotement entre les deux vues. Avec
`dashboard` par défaut, l'appel devient sans effet visible. Il est **conservé**
tel quel : il reste nécessaire quand le membre se connecte depuis un autre
onglet.

**Coût mesuré.** Treize références supposent aujourd'hui que le Builder est la
vue d'arrivée : deux dans `tests/accessibilite-mobile.playwright.js`, onze dans
`tests/supabase-etape1.playwright.js`. Chacune doit être relue et corrigée. Ce
n'est pas un dommage collatéral à absorber en silence : c'est du travail à
inscrire dans le plan.

## 2. Les trois cartes nouvelles

Elles se placent **après** « À faire maintenant » et **avant** « Runs en
cours », dans cet ordre.

### Carte « Mes dispos »

| Situation | Contenu | Action |
|---|---|---|
| Masque vide | « Tes dispos ne sont pas posées » + « La confrérie ne peut pas te compter dans ses créneaux. » | Bouton « Poser mes dispos » → onglet Dispos |
| Masque non vide | « N créneaux posés cette semaine » | Bouton « Modifier mes dispos » → onglet Dispos |
| Lecture indisponible | *carte absente* | — |

### Carte « Mon roster »

Un personnage du roster porte **plusieurs builds**, un par type d'arme
autorisé, dont au plus un marqué `favorite`. La règle doit donc désigner le
build à juger, sans quoi un membre qui garde volontairement un build alternatif
à moitié rempli serait signalé à tort.

**Règle retenue.** Un personnage est *à compléter* si :

1. il ne porte **aucun** build ; ou
2. le build jugé n'est pas valide, c'est-à-dire
   `calculateHeroStats(rosterHeroSnapshot(entry, weaponType)).status !==
   "valid"`.

Le build jugé est le **favori**. À défaut de favori, l'unique build s'il n'y en
a qu'un ; s'il y en a plusieurs sans favori, le premier dans l'ordre de
`weaponTypesOf(charId)`.

`rosterHeroSnapshot` (`js/metier/equipe-modele.js:262`) est l'adaptateur qui
convertit une entrée de roster en héros exploitable ; `calculateHeroStats`
distingue déjà `incomplete`, `unavailable` et `incompatible`. Aucune notion
nouvelle n'est créée, et `equipe-modele.js` précède le nouveau module dans
l'ordre des couches, donc l'import est légal.

| Situation | Contenu | Action |
|---|---|---|
| Au moins un héros à compléter | « N héros à compléter » | Bouton « Compléter mon roster » → onglet Roster |
| Roster complet | *carte absente* | — |
| Lecture indisponible | *carte absente* | — |

### Carte « Créneau fort »

Alimentée par `aggregateAvailability(rows).best[0]`, déjà calculé pour la vue
Dispos.

| Situation | Contenu | Action |
|---|---|---|
| Au moins un créneau peuplé | « Mardi 21 h — 8 membres disponibles » | Bouton « Voir le planning » → onglet Dispos, mode confrérie |
| Personne n'a posé de dispo | *carte absente* | — |
| Lecture indisponible | *carte absente* | — |

Le passage en mode confrérie utilise `Availability.setMode("guild")` après le
`showView("availability")`, sur le modèle de `runDashboardAction`.

## 3. Une carte muette vaut mieux qu'une carte fausse

**Règle transverse :** quand une lecture échoue, la carte concernée
**disparaît**. Elle n'affiche jamais une valeur par défaut.

Afficher « tes dispos ne sont pas posées » parce que la requête a échoué
pousserait le membre à refaire un travail déjà fait. C'est exactement l'erreur
du rappel Discord qui se déclarait en succès sans avoir rien envoyé : un état
inconnu présenté comme un état connu.

Conséquence sur les types : chaque résumé vaut `null` quand la donnée manque,
et cette valeur est distincte du cas « rien à signaler ». Trois états, pas
deux : donnée absente, donnée vide, donnée pleine.

## 4. Deux pièges concrets

### Les deux semaines ne coïncident pas

Les dispos suivent `availabilityWeekStart` — lundi 0 h. Le boss suit
`currentBossWeekStart` — lundi 9 h. **Le lundi entre 0 h et 9 h, les deux
désignent des semaines différentes.**

Les cartes dispos doivent donc être calculées sur la semaine des dispos, pas
sur `state.weekStart` qui est la semaine de boss. Mélanger les deux afficherait
le lundi matin les créneaux de la semaine écoulée.

### Le cache doit changer de version

`DASHBOARD_CACHE_VERSION` passe de `1` à `2` dans
`js/donnees/suivi-store.js:18`. Sans ce passage, les enveloppes déjà écrites
sur les appareils des membres — dépourvues des nouveaux champs — seraient
relues comme valides et les trois cartes resteraient absentes jusqu'à la
première synchronisation réussie.

## 5. Découpage du code

### Nouveau : `js/metier/accueil-logique.js`

Pur, sans DOM ni réseau. Placé **après** `metier/boss-logique.js` dans l'ordre
des couches, ce qui l'autorise à lire `dispos-logique.js` et `stats-calcul.js`,
tous deux situés plus haut.

```js
// rows === null  -> lecture indisponible -> renvoie null
// rows === []    -> personne n'a posé    -> best null, mine.count 0
availabilitySummary({ rows, userId })
  // -> null | { mine:{ posed:boolean, count:number },
  //             best:{ day:number, hour:number, count:number } | null }

// characters === null -> lecture indisponible -> renvoie null
rosterSummary({ characters })
  // -> null | { toComplete:number }
```

Ce module reste hors de `boss-logique.js` : ce dernier parle du boss, et le
laisser accueillir les dispos et le roster brouillerait sa raison d'être.

### Modifiés

- `js/donnees/suivi-store.js` — deux lectures ajoutées dans `load()` :
  `member_availability` pour la semaine des dispos, et
  `MemberRosterStore.refresh(userId)`. Chacune porte son propre
  `.catch(() => null)` : l'échec d'une carte ne doit jamais emporter le
  tableau de bord entier. Version de cache à 2.
- `js/vues/suivi.js` — rendu des trois cartes, et trois cibles ajoutées à
  `runDashboardAction`.
- `index.html` — onglet renommé et déplacé, vue active déplacée, titre et
  chapô.
- `sw.js` — `accueil-logique.js` ajouté aux `CORE_ASSETS`.
- `tests/helpers/modules.js` — le module enregistré dans la couche `metier`.

**Rappel structurel :** un module nouveau s'enregistre à *trois* endroits —
`tests/helpers/modules.js`, `sw.js`, et l'import du consommateur. En oublier un
casse soit les tests de couches, soit le mode hors ligne.

### Une seule lecture pour deux cartes

« Mes dispos » et « Créneau fort » sortent de la **même** requête : la vue
Dispos lit déjà toutes les lignes de la semaine sans filtrer sur le
propriétaire. Aucune requête supplémentaire n'est nécessaire pour la seconde
carte.

## 6. Tests

### `tests/accueil.test.js` (nouveau, unitaire)

- `availabilitySummary` : `rows` à `null` renvoie `null` ; `rows` à `[]` donne
  `mine.posed === false` et `best === null` ; un masque non vide donne le bon
  décompte de créneaux ; `best` désigne bien le créneau le plus peuplé.
- `rosterSummary` : `null` renvoie `null` ; un roster entièrement valide donne
  `toComplete === 0` ; un personnage sans aucun build est compté ; un
  personnage dont le build **favori** est valide n'est **pas** compté même s'il
  porte par ailleurs un build alternatif incomplet — c'est la règle de la
  section 2 et elle mérite son test.
- La frontière des semaines : le lundi à 7 h (Paris), la semaine des dispos et
  la semaine de boss diffèrent, et le résumé des dispos utilise la sienne.

### `tests/accueil.playwright.js` (nouveau, bout en bout)

- Au chargement, l'onglet actif est « Accueil » et `#view-dashboard` porte la
  classe `active` — le Builder ne s'affiche à aucun moment.
- Chaque bouton des trois cartes atterrit sur le bon onglet, et « Voir le
  planning » arrive bien en mode confrérie.
- **Une lecture des dispos en échec masque la carte** au lieu d'annoncer
  « dispos non posées ». C'est l'assertion qui protège la règle de la
  section 3 ; elle doit être vue rouge avant d'être vue verte.

### Existants à corriger

Les treize références citées en section 1. Elles ne sont pas cassées par
accident : elles décrivent l'ancienne vue d'arrivée et doivent décrire la
nouvelle.

## Hors périmètre

Écartés délibérément, chacun étant une page à lui seul et aucun ne répondant à
une question posée à l'arrivée :

- compte à rebours du reset hebdomadaire ;
- mur d'annonces de la confrérie ;
- classement ou palmarès des membres ;
- vitrine publique pour visiteur non connecté.
