# Tableau de bord personnel « Mon suivi »

## Statut

Design validé avec l’utilisateur le 27 juillet 2026.

Ce document décrit la première version de l’onglet personnel **« Mon suivi »**.
L’implémentation fera l’objet d’un plan séparé et sera réalisée ultérieurement
par Claude Code.

## Objectif

Donner à chaque membre connecté une vue immédiate de sa semaine de Boss de
Guilde :

- combien de runs sont déjà engagées sur les trois autorisées ;
- lesquelles sont terminées ou encore ouvertes ;
- quelle est la prochaine action utile ;
- dans quel groupe se trouve le membre ;
- quel rapport peut être consulté ou corrigé.

Le tableau de bord doit éviter au membre de parcourir plusieurs onglets pour
savoir ce qu’il lui reste à faire.

## Périmètre

La première version couvre uniquement le **Boss de Guilde**.

Elle réutilise :

- les équipes propriétaires du membre ;
- les sessions de boss de la semaine courante ;
- les participations ouvertes ou archivées du membre ;
- les rapports associés aux runs archivées.

Elle ne couvre pas :

- les personnages ou builds du roster ;
- une recommandation automatique d’équipe ;
- des statistiques individuelles de dégâts ;
- un classement des membres ;
- une nouvelle table, une nouvelle RPC ou une migration Supabase ;
- la modification directe d’une participation ou d’un rapport depuis le
  tableau de bord.

Toutes les mutations continuent de passer par les flux existants de l’onglet
Boss et du Team Builder.

## Navigation

### Nouvel onglet principal

Un onglet principal **« Mon suivi »** est ajouté au même niveau que le Team
Builder, les équipes et les groupes de boss.

Après la résolution initiale d’une session authentifiée ou après une connexion
réussie, cet onglet devient la vue par défaut. En l’absence de compte connecté,
le Team Builder reste la vue initiale.

Un visiteur déconnecté peut néanmoins ouvrir « Mon suivi » : la vue lui propose
alors de se connecter. Une déconnexion ne doit jamais laisser de données du
compte précédent visibles.

Une actualisation Realtime ne change jamais l’onglet actif et ne vole jamais le
focus.

### Actions directes

Les actions du tableau de bord réutilisent les interfaces existantes :

- **Choisir mon équipe** ouvre le sélecteur d’équipe de la participation
  concernée ;
- **Voir le groupe** ouvre l’onglet Boss et place le groupe concerné dans la
  zone visible ;
- **Corriger le rapport** ouvre la modale existante sur la run archivée
  concernée ;
- **Créer une équipe** ouvre le Team Builder en création ;
- **Voir mes équipes** ouvre la liste des équipes ;
- **Trouver un groupe** ouvre l’onglet Boss sur les groupes ouverts de la
  semaine.

L’ouverture ciblée doit s’effectuer sans rechargement complet de la page. La
navigation met à jour les onglets ARIA existants, puis restitue un focus logique
dans la vue destination.

## Organisation visuelle

La disposition retenue est la variante **orientée actions**.

L’ordre de lecture est :

1. en-tête personnel et état de connexion ;
2. progression des trois runs sous forme de trois repères explicites ;
3. bloc **« À faire maintenant »** ;
4. cartes des runs en cours ;
5. historique des runs terminées de la semaine ;
6. rappel de la prochaine réinitialisation.

Les statistiques restent secondaires. Elles ne doivent pas prendre plus de
place que les actions ou les groupes.

### Progression

Le résumé principal affiche **« Runs engagées X/3 »**, puis trois états :

- **Terminées** ;
- **En cours** ;
- **Encore disponibles**.

Les couleurs ne sont jamais le seul moyen de comprendre un état : chaque
repère possède également un libellé ou une icône accompagnée d’un texte
accessible.

### Cartes de run

Une carte de run en cours affiche au minimum :

- le numéro du groupe ;
- le numéro de la run ;
- le nombre de membres sur cinq ;
- l’état de l’équipe personnelle : sélectionnée ou manquante ;
- l’action directe adaptée.

Une carte terminée affiche au minimum :

- le groupe et le numéro de run ;
- la date de fin ;
- le score global si un rapport existe ;
- l’action **« Corriger le rapport »** si le compte courant possède encore le
  droit de correction.

Une archive historique sans rapport reste lisible avec le message existant
**« Rapport non disponible pour cette ancienne run. »** et sans bouton de
correction.

## Définitions des compteurs

Tous les compteurs portent uniquement sur la semaine renvoyée par
`currentBossWeek()`.

Pour le compte courant :

- **engagées** = nombre de participations distinctes reliées à une session
  ouverte ou archivée de la semaine ;
- **terminées** = participations reliées à une session dont le statut est
  `archived` ;
- **en cours** = participations reliées à une session dont le statut est
  `open` ;
- **encore disponibles** = `max(0, 3 - engagées)`.

Une run est engagée dès que le membre l’a rejointe. L’absence d’équipe
sélectionnée ne la rend pas disponible une seconde fois.

Une participation est dédupliquée par son `session_id`. Une ligne orpheline ou
reliée à une session d’une autre semaine n’entre dans aucun compteur.

Le serveur reste l’autorité sur la limite de trois runs. Le tableau de bord
n’ajoute pas de nouvelle règle de validation.

## Priorité des actions

Le bloc **« À faire maintenant »** est ordonné ainsi :

1. run ouverte rejointe sans `team_snapshot` ;
2. run ouverte rejointe avec une équipe sélectionnée ;
3. possibilité de rejoindre une nouvelle run lorsque moins de trois runs sont
   engagées ;
4. accès secondaire aux rapports des runs terminées.

### Équipe manquante

Si une participation ouverte n’a pas de `team_snapshot` :

- le tableau de bord affiche **« Choisir mon équipe »** lorsque le membre
  possède au moins une équipe ;
- il affiche **« Créer une équipe »** lorsque le membre n’en possède aucune ;
- **« Voir mes équipes »** reste disponible comme action secondaire lorsque
  des équipes existent.

### Équipe prête

Si la participation possède un `team_snapshot`, la carte indique
**« Équipe sélectionnée »** et propose **« Voir le groupe »**.

### Run disponible

Lorsque `engagées < 3`, une action **« Trouver un groupe »** est proposée. Elle
n’effectue pas automatiquement l’adhésion : le membre choisit toujours son
groupe dans la vue Boss.

### Semaine complète

Dès que trois runs sont engagées :

- le tableau de bord affiche **« Semaine complète »** ;
- aucune invitation à rejoindre un autre groupe n’est montrée ;
- les runs ouvertes restent présentées comme « En cours » jusqu’à leur
  archivage.

## Échéance hebdomadaire

Les règles temporelles utilisent toujours le fuseau `Europe/Paris`.

Lorsque des runs restent disponibles :

- du lundi 9 h au vendredi 23 h 59, le rappel est neutre et indique
  **« Reset lundi 9 h »** ;
- du samedi 0 h au dimanche 11 h 59, un avertissement modéré rappelle le nombre
  de runs restantes ;
- du dimanche 12 h au lundi 8 h 59, une alerte prioritaire indique clairement
  le nombre de runs manquantes.

Lorsque trois runs sont engagées, l’état vert **« Semaine complète »** remplace
les alertes d’urgence.

La frontière du lundi avant 9 h appartient encore à la semaine précédente,
conformément à `currentBossWeek()`.

## Architecture retenue

### Calcul côté client

Le tableau de bord est une projection calculée dans `index.html`. Il ne possède
ni table ni RPC dédiée.

Les sources d’autorité restent :

- `teams` ;
- `boss_sessions` ;
- `boss_participation` ;
- `boss_run_reports`.

Les lectures sont limitées autant que possible à la semaine et au compte
courants. Les données indépendantes peuvent être chargées en parallèle ; les
participations et rapports attendent seulement de connaître les identifiants
des sessions de la semaine.

### État normalisé

Un état dédié, nommé conceptuellement `DashboardStore`, expose au rendu une
forme normalisée :

```js
{
  weekStart,
  engaged,
  completed,
  open,
  remaining,
  groups,
  actions,
  deadlineStatus,
  lastSyncedAt,
  offline
}
```

`groups` contient seulement les runs auxquelles le membre courant participe.
`actions` est dérivé de ces groupes et des équipes propriétaires disponibles.

Les scores sont conservés comme chaînes JSON sûres dans l’état mis en cache,
afin de ne pas perdre de précision avant leur formatage.

### Protection contre les courses

Chaque chargement capture :

- une génération de requête ;
- l’identifiant du compte ;
- le début de semaine attendu.

Une réponse n’est appliquée que si ces trois valeurs correspondent encore au
contexte actif. Ainsi :

- une réponse lente ne remplace pas une actualisation plus récente ;
- une déconnexion ne réaffiche pas les données du compte précédent ;
- un changement de semaine pendant un chargement ne mélange pas deux périodes.

Le rendu initial peut afficher un état de chargement, mais une actualisation
silencieuse conserve le contenu déjà visible jusqu’au résultat.

## Realtime

La chaîne Realtime existante couvre déjà les quatre tables nécessaires.

Lorsque « Mon suivi » est actif, un événement pertinent déclenche une
actualisation regroupée du tableau de bord.

Lorsqu’un autre onglet est actif, le tableau de bord est seulement marqué
**sale**. Il est actualisé à sa prochaine ouverture. Cette stratégie évite des
lectures inutiles et interdit à Realtime de changer la navigation.

Les événements rapprochés restent regroupés par le mécanisme de debounce
existant. La protection par génération empêche également une lecture ancienne
de reprendre le dessus.

## Cache et mode hors ligne

Le dernier état validé est enregistré localement avec :

- une version de format ;
- l’identifiant du compte ;
- le début de semaine ;
- la date de synchronisation ;
- l’état normalisé.

Le cache est strictement séparé par compte et par semaine. Une déconnexion
retire l’état de la mémoire et de l’écran, sans devoir supprimer les sauvegardes
des autres comptes.

En cas d’échec réseau :

- le dernier cache compatible est affiché ;
- un badge **« Hors ligne »** est visible ;
- la date de dernière synchronisation est affichée ;
- les informations sont signalées comme potentiellement anciennes ;
- toutes les actions nécessitant Supabase sont désactivées ;
- un bouton **« Réessayer »** relance le chargement.

S’il n’existe aucun cache compatible, la vue affiche que le suivi est
indisponible hors ligne. Elle ne montre jamais un faux `0/3`.

Le cache n’accorde aucun droit et n’est jamais utilisé pour envoyer une
mutation.

## Erreurs et compatibilité

Une erreur d’une lecture ne vide pas un tableau de bord déjà utilisable. Le
dernier état connu reste visible avec un message non bloquant et l’action
**« Réessayer »**.

Les erreurs d’une action directe restent gérées par l’interface destination :
sélecteur d’équipe, Team Builder, groupe ou modale de rapport.

Une base Supabase qui n’a pas encore les rapports de boss peut encore afficher
les participations et les groupes. Les scores et corrections utilisent le
comportement de maintenance déjà prévu par l’onglet Boss ; le tableau de bord
ne contourne jamais cette protection.

## Mobile et accessibilité

Entre 320 et 390 px :

- aucune carte ne doit élargir le document ;
- les actions peuvent passer sur plusieurs lignes ;
- les nombres et scores longs restent contenus ;
- les cartes conservent un ordre de lecture linéaire ;
- les barres de défilement ne sont pas nécessaires pour comprendre le contenu.

L’onglet rejoint le motif ARIA existant. Les exigences déjà documentées restent
obligatoires :

- navigation par flèches, Début et Fin ;
- focus visible ;
- cibles tactiles d’au moins 44 × 44 px ;
- libellés compréhensibles sans dépendre de la couleur ;
- restitution du focus après une modale ;
- annonce accessible des états de chargement, d’erreur et hors ligne.

## Sécurité et données

Le tableau de bord n’élargit aucun droit :

- toutes les lectures continuent de respecter les politiques RLS existantes ;
- seules les équipes dont `owner === currentUser.id` servent aux actions
  personnelles ;
- le droit de corriger un rapport est déterminé par la participation archivée
  et reste contrôlé par la RPC existante ;
- aucune clé `service_role` n’est ajoutée ;
- aucune donnée Supabase n’est copiée dans un cache partagé entre comptes.

Le projet reste statique, sans nouvelle dépendance runtime et sans étape de
build.

## Vérifications attendues

### Calculs

- `engaged`, `completed`, `open` et `remaining` sont corrects pour zéro à trois
  participations ;
- une participation ouverte est comptée une seule fois ;
- une participation archivée est terminée même si son rapport historique
  manque ;
- une participation d’une autre semaine est ignorée ;
- trois runs engagées suppriment toute invitation à en rejoindre une autre.

### Actions

- une équipe manquante reçoit la bonne action selon l’existence d’équipes
  propriétaires ;
- chaque action ouvre la bonne vue, le bon groupe ou la bonne modale ;
- une archive sans rapport ne propose pas de correction ;
- une correction n’est proposée qu’à un participant autorisé ;
- les actions réseau sont désactivées hors ligne.

### Temps, cache et concurrence

- les trois niveaux d’échéance respectent l’heure de Paris ;
- le lundi avant 9 h utilise encore la semaine précédente ;
- un cache d’un autre compte ou d’une autre semaine est refusé ;
- l’absence de cache hors ligne ne produit jamais `0/3` ;
- une réponse réseau tardive ne remplace pas un état plus récent ;
- Realtime actualise la vue active ou marque la vue inactive comme sale, sans
  changer d’onglet.

### Interface

- le nouvel onglet fonctionne au clavier avec le motif ARIA existant ;
- les actions directes conservent un focus logique ;
- les états ne reposent pas seulement sur leur couleur ;
- les largeurs 320, 360, 375 et 390 px ne présentent aucun débordement
  horizontal ;
- les cibles principales mesurent au moins 44 × 44 px.

### Non-régression

La suite complète `npm test` doit rester verte. Les tests du tableau de bord
s’ajoutent aux tests Node et Playwright existants sans modifier les contrats
Supabase déjà validés.

## Critères d’acceptation

La fonctionnalité est acceptée lorsque :

1. un membre connecté arrive sur « Mon suivi » et comprend immédiatement son
   état sur trois runs ;
2. chaque run rejointe est classée correctement comme ouverte ou terminée ;
3. l’action la plus urgente est toujours placée avant les actions secondaires ;
4. les boutons dirigent vers les interfaces existantes sans rechargement de
   page ;
5. le dimanche après midi, un membre incomplet voit une alerte prioritaire ;
6. un membre à `3/3` voit « Semaine complète » sans nouvelle invitation ;
7. le dernier état connu reste compréhensible hors ligne sans être présenté
   comme actuel ;
8. aucun changement Supabase, aucune dépendance runtime et aucun débordement
   mobile ne sont introduits.
