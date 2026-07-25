# Débordement mobile et classement potentiel partiel — Design

> **Statut : IMPLÉMENTÉ** (2026-07-25). Vérifié par
> `tests/mobile-analyse-partielle.playwright.js` (ajouté à `npm test`).
> Le débordement mesuré avant correctif était de 37px à 320px ; il est nul après.

## Objectif

Corriger le défilement horizontal involontaire de la page sur téléphone et
rendre le filtre par élément du « Classement par potentiel » instantané, sans
effet de rechargement de toute la vue Analyse.

## Périmètre

- Corriger le débordement global observé à 320, 360 et 390 pixels de large.
- Conserver les défilements horizontaux internes nécessaires :
  - navigation par onglets ;
  - matrice de couverture élémentaire.
- Au clic sur un élément du classement, mettre à jour uniquement :
  - l’état actif des boutons d’élément ;
  - le tableau du classement par potentiel.
- Ne modifier ni le modèle de données, ni le schéma Supabase, ni les règles de
  sauvegarde.

## Diagnostic confirmé

### Débordement mobile

Deux contraintes de largeur dans le Recensement agrandissent le document :

1. `#recLocalControls` conserve ses contrôles sur une seule ligne alors que
   `.rec-input` impose une largeur minimale de 200 pixels ;
2. `.rec-player`, enfant d’une grille, conserve la largeur minimale intrinsèque
   de ses lignes DPS faute de `min-width: 0`.

La matrice d’analyse est volontairement plus large que l’écran, mais elle est
déjà contenue par `.matrix-wrap { overflow-x: auto; }`. Elle ne constitue donc
pas un débordement global à supprimer.

### Impression de rechargement

Le clic sur un bouton d’élément appelle actuellement `renderAnalyse()`. Cette
fonction :

1. efface tout `#analyseBody` ;
2. affiche un état de chargement ;
3. relit le recensement via Supabase ;
4. reconstruit la couverture, le classement et la matrice.

Il n’y a pas de véritable navigation du navigateur, mais cette reconstruction
complète produit le même ressenti visuel qu’un rechargement.

## Design mobile

- Ajouter `min-width: 0` à `.rec-player` pour autoriser la piste de grille à se
  réduire à la largeur disponible.
- Sous 520 pixels, faire passer `#recLocalControls` sur plusieurs lignes.
- Sous 520 pixels, donner à son champ pseudo et à son bouton une largeur de
  100 %, avec `min-width: 0`.
- Ne pas appliquer de `overflow-x: hidden` à `html`, `body` ou à un conteneur
  global : cela masquerait la cause et pourrait couper les zones qui doivent
  rester défilables.

Le résultat attendu est que la largeur défilable du document soit égale à la
largeur du viewport à 320, 360 et 390 pixels, tandis que la matrice et les
onglets conservent leur propre défilement interne.

## Design du rendu partiel de l’analyse

`renderAnalyse()` reste le point d’entrée du rendu complet. Il continue à
charger les joueurs lors de l’ouverture ou du rafraîchissement de la vue, puis
construit les trois blocs :

1. couverture élémentaire ;
2. classement par potentiel ;
3. matrice des joueurs et éléments.

Le calcul et la construction du classement sont isolés dans une fonction dédiée
qui reçoit la liste de joueurs déjà chargée et l’élément choisi. Le classement
possède un conteneur stable identifiable dans le DOM.

Lors d’un clic sur un élément :

1. `analyseElem` prend la nouvelle valeur ;
2. les boutons mettent à jour leur classe active et `aria-pressed` ;
3. seul le contenu du conteneur du classement est remplacé à partir des joueurs
   déjà chargés ;
4. aucun appel à `Rec.refresh()` ou à `renderAnalyse()` n’est effectué.

La couverture et la matrice restent les mêmes nœuds DOM. La position de lecture
de l’utilisateur est donc conservée et aucun message « Chargement de
l’analyse… » n’apparaît.

## Données et fraîcheur

La liste utilisée par les boutons provient du chargement réussi de la vue
Analyse. Aucun cache persistant supplémentaire n’est introduit.

Un rendu complet reste déclenché dans les situations où les données peuvent
avoir changé : entrée dans la vue Analyse, changement de session, migration ou
sauvegarde du recensement pendant que cette vue est active. Ainsi, le clic sur
un filtre est local et instantané, sans rendre les données durablement
obsolètes.

Si le chargement initial Supabase échoue, le comportement de secours existant
est conservé : utilisation des données disponibles dans `Rec.all` et affichage
du message d’erreur actuel. Le filtrage local fonctionne ensuite sur ces
données de secours.

## Accessibilité

- Chaque bouton d’élément expose `aria-pressed="true"` lorsqu’il est actif et
  `aria-pressed="false"` sinon.
- Les boutons natifs restent utilisables à la souris, au toucher et au clavier.
- Le remplacement ciblé ne déplace pas volontairement le focus.

## Vérification

Un test Playwright couvre les comportements suivants :

- à 320, 360 et 390 pixels, le document n’a aucun débordement horizontal ;
- la matrice conserve un débordement horizontal interne lorsqu’elle est plus
  large que son conteneur ;
- choisir un autre élément ne crée aucune navigation ;
- le clic ne déclenche aucune nouvelle lecture Supabase ;
- le tableau de classement est remplacé et affiche le filtre choisi ;
- les nœuds de couverture et de matrice restent connectés et identiques ;
- `aria-pressed` reflète correctement l’élément sélectionné.

La suite complète `npm test` doit rester verte.
