# Rapports de runs du Boss de Guilde — Spécification

**Date :** 2026-07-26  
**Statut :** conception validée, implémentation à planifier

## Objectif

Transformer les runs archivées en données concrètes et réutilisables, sans
inventer de statistiques de combat :

- chaque participant déclare l’équipe qu’il utilise ;
- chaque run terminée reçoit un score global obligatoire ;
- l’historique conserve des instantanés indépendants des équipes originales ;
- les participants peuvent corriger un score ou une note après archivage ;
- un bilan de confrérie est calculé uniquement à partir des rapports réellement
  enregistrés.

Ce premier lot prépare les futurs outils d’analyse sans prétendre recommander
une composition optimale avant d’avoir accumulé suffisamment de résultats.

## Contexte actuel

- Six groupes sont ouverts chaque semaine.
- Une ligne `boss_sessions` représente une run précise.
- Chaque membre dispose de trois participations par semaine.
- `complete_boss_run(uuid)` archive la run et crée immédiatement la suivante.
- `boss_participation` possède déjà les colonnes historiques `team_id`,
  `damage` et `participated`, mais elles ne sont pas utilisées par l’interface.
- Toutes les écritures de boss passent par des RPC `security definer`.
- Les groupes n’ont actuellement aucune capacité maximale.

## Décisions validées

- Un groupe accepte **au minimum un participant et au maximum cinq**.
- Le rapport ne contient ni difficulté, ni victoire/échec.
- Une run possède **un score global unique**, obligatoire, entier et strictement
  supérieur à zéro.
- Chaque participant doit avoir choisi une équipe avant l’archivage.
- Les équipes sont conservées sous forme d’instantanés indépendants.
- Une note de run est facultative et limitée à 1 000 caractères.
- Après archivage, tout participant de la run peut corriger le score global et
  la note.
- La liste des participants, les équipes, le groupe, le numéro de run et la
  date de fin deviennent immuables.
- Les anciennes runs sans rapport restent lisibles, sans reconstruction
  rétroactive.
- La sauvegarde repose sur Git et sur un schéma Supabase additif accompagné
  d’un script de retour arrière non destructif.

## Hors périmètre

- difficulté du boss ;
- victoire ou échec ;
- dégâts ou classement individuels ;
- captures d’écran et Supabase Storage ;
- horaires, confirmation de présence et liste d’attente ;
- nouvelles notifications Discord ;
- recommandation automatique d’équipe ;
- note globale d’équipe, lien direct et comparaison d’équipes ;
- saisie rétroactive des anciennes runs.

## Modèle de données

### Table `boss_run_reports`

Une ligne représente le rapport d’une session archivée :

```sql
create table if not exists public.boss_run_reports (
  session_id         uuid primary key
                     references public.boss_sessions(id) on delete cascade,
  global_score       bigint not null check (global_score > 0),
  note               text not null default ''
                     check (char_length(note) <= 1000),
  created_by         uuid references auth.users(id) on delete set null,
  created_by_pseudo  text not null,
  created_at         timestamptz not null default now(),
  updated_by         uuid references auth.users(id) on delete set null,
  updated_by_pseudo  text,
  updated_at         timestamptz
);
```

Les pseudos sont copiés au moment de la création ou de la correction afin que
l’attribution reste lisible si un profil change ou disparaît.

### Instantané d’équipe

`boss_participation` reçoit une colonne additive :

```sql
team_snapshot jsonb
```

La colonne existante `team_id` conserve l’identifiant de l’équipe sélectionnée.
La RPC copie également dans `team_snapshot` la ligne Supabase complète au
moment du choix :

```js
{
  id: "uuid",
  owner: "uuid-du-membre",
  pseudo: "Nom du membre",
  data: {
    // copie exacte de teams.data, dont les quatre héros et leur équipement
  },
  createdAt: "date ISO de la ligne teams",
  updatedAt: "date ISO de la ligne teams",
  capturedAt: "date ISO de la sélection"
}
```

L’instantané ne possède aucune relation vivante avec `teams`. Une modification
ou une suppression ultérieure de l’équipe source ne change jamais le rapport.
À la lecture, l’interface passe `team_snapshot.data` par le normaliseur d’équipe
existant avant de réutiliser le composant de détail.
Les anciennes colonnes `damage` et `participated` restent présentes, mais ne
sont pas utilisées dans ce lot.

## Capacité des groupes

`join_boss_run` conserve la limite personnelle de trois runs par semaine et
ajoute une capacité de cinq participants.

La session est verrouillée avant de compter ses participations. Deux
inscriptions concurrentes pour la cinquième place sont donc sérialisées :
la première réussit, la seconde reçoit `GROUP_FULL`.

L’interface affiche `n/5 joueurs`. À `5/5`, rejoindre est désactivé, mais un
participant déjà inscrit peut toujours quitter. Supabase reste l’autorité :
le contrôle serveur s’applique même si l’interface est obsolète.

Si une session déjà ouverte contient exceptionnellement plus de cinq membres
au moment de la migration, aucune participation n’est supprimée. La session
affiche `Groupe au-dessus de la nouvelle limite` et ne peut être terminée
qu’après le départ volontaire de membres jusqu’à cinq.

## RPC

### `select_boss_team(p_session_id, p_team_id)`

Cette RPC :

1. exige un membre authentifié ;
2. verrouille et vérifie une session ouverte de la semaine courante ;
3. vérifie que l’appelant participe à cette session ;
4. vérifie que `p_team_id` appartient à l’appelant ;
5. normalise et copie la ligne `teams` dans `team_snapshot` ;
6. met à jour `team_id` et `updated_at`.

Le participant peut remplacer sa sélection tant que la run est ouverte.
Quitter la run supprime la ligne de participation et donc sa sélection.

### `complete_boss_run_with_report(p_session_id, p_global_score, p_note)`

La nouvelle RPC exécute dans une seule transaction :

1. authentification et verrouillage de la session ;
2. validation de la semaine et du statut `open` ;
3. vérification que l’appelant participe à la run ;
4. vérification d’un nombre de participants compris entre 1 et 5 ;
5. vérification que chaque participation possède `team_snapshot` ;
6. validation du score entier strictement positif ;
7. normalisation de la note et contrôle des 1 000 caractères ;
8. insertion de `boss_run_reports` avec le pseudo courant de l’auteur ;
9. archivage de la session et horodatage de `completed_at` ;
10. création de la run suivante, vide, pour le même groupe.

Si une étape échoue, aucune des écritures n’est conservée. La session reste
ouverte et aucune nouvelle run n’est créée.

La première transaction concurrente qui termine la run gagne. Une seconde
requête reçoit `RUN_ARCHIVED` et ne remplace pas le premier rapport.

### `update_boss_run_report(p_session_id, p_global_score, p_note)`

Cette RPC :

1. exige une session archivée possédant un rapport ;
2. exige que l’appelant figure dans les participations archivées ;
3. valide le nouveau score et la note ;
4. modifie uniquement `global_score`, `note`, `updated_by`,
   `updated_by_pseudo` et `updated_at`.

Elle ne peut modifier ni la session, ni les participations, ni les instantanés
d’équipe.

### Ancienne RPC de fin de run

`complete_boss_run(uuid)` ne doit plus pouvoir archiver sans rapport. Elle reste
appelable uniquement pour retourner l’erreur explicite `REPORT_REQUIRED` aux
anciens onglets ou anciennes PWA.

Le nouveau site utilise exclusivement `complete_boss_run_with_report`.

## RLS et permissions

- Tous les membres authentifiés peuvent lire `boss_run_reports`.
- Aucune politique d’insertion, modification ou suppression directe n’est
  créée pour cette table.
- Les écritures passent exclusivement par les RPC.
- Les règles existantes de `boss_participation` restent inchangées : lecture
  partagée, aucune écriture directe.
- Les trois nouvelles RPC sont accordées à `authenticated` et révoquées pour
  `public`.
- La table `boss_run_reports` est ajoutée de manière idempotente à la
  publication `supabase_realtime`.

La suppression d’un compte ne supprime pas les rapports : les UUID d’auteur ou
de correcteur deviennent `null`, tandis que leurs pseudos instantanés restent.

## Parcours utilisateur

### Sélection d’équipe

Sur une carte de groupe rejoint, le membre voit :

- `Choisir mon équipe` si aucune équipe n’est déclarée ;
- le nom de l’équipe et `Changer` après sélection.

Le sélecteur montre uniquement les équipes appartenant au membre connecté. Si
son registre est vide, l’interface l’invite à passer au Team Builder.

Les autres membres voient un état compact `Équipe prête` ou `Équipe manquante`,
sans pouvoir choisir à la place du participant.

### Fin de run

Le bouton `Run terminée` remplace la confirmation native par une modale gérée
par `ModalStack`.

Elle affiche :

- le groupe et le numéro de run ;
- les participants et l’état de leur équipe ;
- un champ numérique `Score global`, obligatoire ;
- une zone `Note de run`, facultative, avec compteur jusqu’à 1 000 caractères ;
- le bouton `Enregistrer et terminer la run`.

Le bouton de validation reste indisponible si le score local est invalide ou
si une équipe manque. Le serveur répète toutes les vérifications.

Pendant l’appel RPC, le bouton est protégé contre les doubles clics. Une erreur
conserve le score et la note dans la modale et affiche son message précis.

### Historique

Une ligne de run renseignée prend cette forme :

```text
Groupe 2 · Run 3 — 12 450 800 points — 5 joueurs
Terminée le 26 juillet à 21:42
```

Le détail affiche :

- les participants ;
- un bouton par participant pour consulter son instantané d’équipe avec le
  composant de détail d’équipement existant ;
- la note ;
- l’auteur et la date de création du rapport ;
- la dernière correction, si elle existe.

Un participant de la run voit `Corriger le rapport`. La modale de correction
ne contient que le score et la note.

Une archive antérieure à cette fonctionnalité affiche :

```text
Rapport non disponible pour cette ancienne run.
```

Elle reste consultable et n’est jamais bloquée par l’absence d’instantané.

## Bilan de confrérie

Le haut de la vue Boss affiche, à partir des seuls rapports disponibles :

- nombre de runs renseignées pendant la semaine affichée ;
- meilleur score de cette semaine ;
- score moyen de cette semaine, arrondi à l’entier ;
- dernier score de cette semaine selon `completed_at` ;
- évolution du score moyen de la semaine courante par rapport à la semaine
  précédente.

L’évolution n’est affichée que si les deux semaines possèdent au moins un
rapport. Elle est exprimée en valeur et en pourcentage. Aucun classement
individuel n’est produit.

Les scores sont formatés en français avec des séparateurs de milliers. La base
les stocke en `bigint`; l’interface refuse toute valeur supérieure à la limite
d’entier sûr de JavaScript afin d’éviter un arrondi silencieux.

## Realtime

La chaîne existante écoute également `boss_run_reports`.

Les événements suivants invalident uniquement la vue Boss :

- changement de `team_id` ou `team_snapshot` ;
- création d’un rapport ;
- correction d’un rapport ;
- archivage et création de la run suivante.

Les événements rapprochés restent regroupés par le mécanisme actuel afin
d’éviter plusieurs rechargements complets pour une seule transaction.

## Messages d’erreur

Les erreurs RPC sont traduites en français :

- `GROUP_FULL` → `Ce groupe est déjà complet (5/5).`
- `GROUP_OVER_CAPACITY` → `Des membres doivent quitter ce groupe pour revenir à 5 joueurs.`
- `TEAM_REQUIRED` → liste des pseudos sans équipe.
- `INVALID_SCORE` → `Saisis un score entier supérieur à zéro.`
- `RUN_ARCHIVED` → `Cette run vient déjà d’être terminée.`
- `NOT_A_PARTICIPANT` → `Seuls les participants peuvent effectuer cette action.`
- `REPORT_REQUIRED` → `Une mise à jour du site est nécessaire pour terminer cette run.`
- `REPORT_NOT_FOUND` → `Aucun rapport modifiable n’existe pour cette run.`

Une erreur réseau utilise le toast existant et conserve le formulaire ouvert.

## Compatibilité et données existantes

- Le schéma complet reste idempotent et rejouable dans le SQL Editor Supabase.
- Les sessions et participations existantes ne sont ni transformées ni
  supprimées.
- Les archives sans rapport restent visibles.
- Les nouvelles colonnes sont nullables pour les anciennes lignes.
- Le cache local existant ne devient jamais la source d’autorité d’un rapport.
- Le site reste utilisable en `file://`; les fonctions partagées exigent
  toujours une connexion et un compte Supabase.

## Sauvegarde et retour arrière

### Avant l’implémentation

1. vérifier que `main` est propre ;
2. créer le tag annoté
   `backup-before-boss-reports-2026-07-26` sur le `main` courant ;
3. créer une branche et un worktree isolés ;
4. ne fusionner ni pousser la fonctionnalité avant validation locale et revue.

Le tag distant n’est poussé qu’avec l’autorisation explicite de l’utilisateur.

### Script SQL de retour arrière

L’implémentation fournit `supabase/rollback-boss-reports.sql`. Ce script :

- restaure l’ancienne définition de `join_boss_run` sans capacité maximale ;
- restaure l’ancienne définition fonctionnelle de `complete_boss_run(uuid)` ;
- restaure ses permissions ;
- révoque l’exécution des nouvelles RPC ;
- ne supprime aucune table, colonne, participation, session ou rapport ;
- peut être rejoué sans danger.

Les objets additifs restent dormants après le retour arrière.

### Procédure après déploiement

Si la fonctionnalité ne convient pas :

1. exécuter `supabase/rollback-boss-reports.sql` dans Supabase ;
2. faire un `git revert` du commit ou de la fusion de la fonctionnalité ;
3. pousser le revert et attendre le déploiement Pages testé.

Cet ordre garantit que l’ancienne interface retrouve immédiatement ses RPC.
Les rapports collectés restent disponibles pour une éventuelle réactivation.

## Tests

### Contrats SQL

Les tests vérifient :

- table, contraintes, RLS et publication Realtime ;
- colonne `team_snapshot` additive ;
- verrouillage de la session avant le contrôle de capacité ;
- maximum cinq membres et erreur `GROUP_FULL` ;
- limite hebdomadaire de trois runs inchangée ;
- propriété de l’équipe dans `select_boss_team` ;
- présence d’un instantané pour chaque participant ;
- score strictement positif ;
- transaction unique d’archivage et création de la run suivante ;
- droits de correction réservés aux participants archivés ;
- champs immuables absents de la RPC de correction ;
- ancienne RPC transformée en `REPORT_REQUIRED` ;
- script de retour arrière rejouable, restaurant les RPC sans `DROP`.

### Parcours navigateur

Les doubles Supabase Playwright couvrent :

- groupe vide puis adhésion du premier membre ;
- compteur jusqu’à `5/5` et refus du sixième ;
- choix et remplacement d’une équipe propriétaire ;
- refus d’une équipe appartenant à un autre membre ;
- détail basé sur l’instantané après modification de l’équipe source ;
- blocage de la fin de run tant qu’une équipe manque ;
- conservation du formulaire en cas d’erreur ;
- archivage avec score et ouverture immédiate de la run suivante ;
- correction par un participant ;
- absence du bouton de correction pour un non-participant ;
- affichage des archives historiques sans rapport ;
- mise à jour Realtime regroupée.

### Mobile et accessibilité

- modales intégrées à `ModalStack` ;
- piège et restitution du focus ;
- fermeture avec Échap ;
- libellés et messages d’erreur associés aux champs ;
- contrôles de 44 × 44 px minimum ;
- aucune superposition ni débordement horizontal entre 320 et 390 px ;
- score lisible sans élargir la page.

### Vérification finale

```powershell
npm test
git diff --check
git status --short
```

Une validation manuelle avec le faux backend confirme le parcours complet. Le
schéma réel est ensuite rejoué une fois dans Supabase par l’utilisateur avant
la fusion vers `main`.

L’activation exige une courte fenêtre de maintenance :

1. valider localement la branche et préparer la fusion ;
2. rejouer `supabase/schema.sql`, ce qui rend l’ancienne RPC stricte ;
3. fusionner et pousser immédiatement la branche ;
4. attendre le workflow Pages vert puis demander aux onglets ouverts
   d’appliquer la mise à jour PWA.

Pendant ces quelques minutes, une ancienne page peut consulter les groupes,
mais `Run terminée` répond `REPORT_REQUIRED`. Si le déploiement Pages échoue,
le script SQL de retour arrière restaure immédiatement l’ancien comportement.

## Critères d’acceptation

La fonctionnalité est prête lorsque :

- un groupe ne dépasse jamais cinq participants ;
- tout participant a choisi une équipe propriétaire avant la fin ;
- une run ne peut pas être archivée sans score global valide ;
- le rapport, l’archive et la run suivante sont atomiques ;
- les instantanés restent lisibles après modification ou suppression des
  équipes sources ;
- seuls les participants corrigent le score et la note ;
- les anciennes archives restent compatibles ;
- le bilan n’utilise que des rapports réels ;
- le retour arrière restaure l’ancien comportement sans effacer de données ;
- toute la suite de tests passe sur ordinateur et mobile.
