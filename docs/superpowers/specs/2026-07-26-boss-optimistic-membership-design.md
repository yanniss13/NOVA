# Groupes de boss — adhésion optimiste

## Objectif

Rendre les actions **Rejoindre** et **Quitter** immédiatement visibles dans
l’onglet « Groupes de boss », sans afficher de nouvel écran « Chargement… »
pendant la confirmation Supabase.

L’action **Run terminée** reste inchangée : elle continue à recharger les
sessions, car elle archive la run courante et crée la suivante.

## Cause du délai actuel

Après chaque RPC `join_boss_run` ou `leave_boss_run`, l’interface appelle
`renderBossView()`. Ce rendu efface le contenu, affiche « Chargement… », puis
effectue successivement :

1. l’upsert des six groupes initiaux de la semaine ;
2. la lecture de toutes les sessions ;
3. la lecture des participations.

Un événement Supabase Realtime peut également provoquer un second rendu
complet. Le délai réseau est donc rendu visible alors que la mutation ne
concerne qu’une participation.

## Architecture retenue

### État local de la vue

La vue conserve en mémoire son dernier état validé :

- la semaine affichée ;
- les sessions chargées ;
- les participations chargées ;
- les actions Rejoindre/Quitter encore en cours.

Le rendu visuel est séparé du chargement réseau. Une fonction rend les groupes
à partir de cet état local sans lancer de requête et sans vider la vue.

### Mise à jour optimiste

Lors d’un clic sur **Rejoindre** :

1. l’action en cours est enregistrée pour la session ;
2. une participation locale du membre connecté est ajoutée ;
3. la carte, la liste des membres et le compteur hebdomadaire sont rendus
   immédiatement ;
4. `join_boss_run` est appelé ;
5. après succès, l’état optimiste est conservé jusqu’à la prochaine
   synchronisation Realtime ;
6. après erreur, seule la participation optimiste est retirée, puis le message
   d’erreur existant est affiché.

Lors d’un clic sur **Quitter**, le même flux s’applique en sens inverse. La
participation retirée est mémorisée afin de pouvoir être restaurée si
`leave_boss_run` échoue.

### Concurrence et Realtime

Une action en cours est identifiée par l’ID de session et son intention
`join` ou `leave`. Le bouton de cette session est désactivé jusqu’à la réponse
de la RPC, ce qui bloque les doubles clics.

Quand Realtime recharge silencieusement les données du serveur, les intentions
encore en cours sont réappliquées par-dessus la réponse :

- une intention `join` garantit la présence locale du membre ;
- une intention `leave` garantit son absence locale.

Ainsi, un événement provenant d’un autre membre ne peut pas faire clignoter ou
annuler temporairement l’action locale en attente.

Après succès, l’intention est retirée sans rechargement manuel. L’événement
Realtime de Supabase réconcilie ensuite la vue. Si Realtime est indisponible,
l’état optimiste reste conforme au succès confirmé par la RPC.

Après erreur, l’intention est retirée, la modification locale est annulée et
une actualisation silencieuse est lancée pour récupérer tout changement
concurrent.

## Chargement initial et actualisations

Le premier affichage de l’onglet conserve le comportement actuel :

- affichage de « Chargement… » ;
- création idempotente des six groupes de la semaine ;
- chargement des sessions et des participations.

Les actualisations déclenchées par Realtime réutilisent le contenu affiché :
elles relisent les données sans effacer les cartes et sans afficher
« Chargement… ».

Le compteur `x/3`, les boutons désactivés à la limite hebdomadaire et les noms
des membres sont toujours calculés depuis l’état local rendu.

## Gestion des erreurs

Les messages produits par `bossActionMessage()` restent inchangés.

Une erreur de RPC doit :

1. retirer l’état « action en cours » ;
2. annuler uniquement la participation locale du membre pour la session
   concernée ;
3. rendre immédiatement l’état restauré ;
4. afficher le toast existant ;
5. lancer une réconciliation réseau silencieuse.

Les données d’autres membres reçues pendant l’action ne doivent pas être
écrasées lors du retour arrière.

## Accessibilité et interface

- Le bouton activé reste un véritable `<button>`.
- Pendant la RPC, il reste visible mais désactivé.
- Son libellé indique brièvement `Synchronisation…`.
- Aucun écran de chargement ne remplace les groupes déjà visibles.
- Le compteur et la liste des membres changent dans le même rendu.
- Aucun nouveau modal, défilement ou débordement horizontal n’est introduit.

## Tests

Les tests Playwright Supabase doivent vérifier :

1. avec une RPC artificiellement bloquée, **Rejoindre** affiche immédiatement
   le membre, transforme le bouton en **Quitter** et incrémente `x/3` avant la
   résolution réseau ;
2. **Quitter** produit immédiatement l’effet inverse ;
3. le contenu « Chargement… » n’apparaît pas pendant ces deux actions ;
4. une erreur de `join_boss_run` annule la participation optimiste et restaure
   le compteur ;
5. une erreur de `leave_boss_run` restaure la participation retirée ;
6. un événement Realtime concurrent ne supprime pas une intention locale en
   cours ;
7. les RPC existantes, la limite de trois runs et les archives continuent de
   fonctionner ;
8. **Run terminée** conserve son rechargement et affiche bien la run suivante.

## Hors périmètre

- Modifier les fonctions SQL ou les politiques RLS.
- Modifier la limite de trois runs.
- Optimiser le flux **Run terminée**.
- Ajouter un cache persistant des sessions de boss.
- Remplacer Supabase Realtime.
