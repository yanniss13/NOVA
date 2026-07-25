# Groupes de boss — trois runs par joueur

**Date :** 2026-07-25
**Statut :** validé par l’utilisateur

## Objectif

Chaque membre dispose de trois runs sur le boss par semaine. Une inscription
réserve une run. Lorsqu’un groupe termine, sa run et ses participants sont
archivés, puis le même numéro de groupe redevient immédiatement disponible.

## Règles fonctionnelles

- La semaine reste calculée du lundi 9 h Europe/Paris au lundi suivant.
- Six groupes sont disponibles simultanément.
- La limite est de trois participations par joueur et par semaine, tous groupes
  confondus.
- Une participation dans un groupe ouvert compte immédiatement dans la limite.
- Quitter un groupe ouvert libère la place correspondante.
- Une participation à une run terminée reste enregistrée et ne peut plus être
  quittée.
- À `3/3`, le membre ne peut plus rejoindre de nouvelle run avant le reset
  hebdomadaire.
- N’importe quel membre inscrit dans un groupe ouvert peut terminer sa run.
- Terminer une run archive tous les participants présents puis crée la run
  suivante du même groupe, vide.
- Un groupe peut enchaîner autant de runs que nécessaire pendant la semaine ;
  la limite concerne les joueurs, pas le groupe.

## Interface

Chaque carte affiche :

- `Groupe N · Run X` ;
- les membres inscrits ;
- `Rejoindre` ou `Quitter` tant que la run est ouverte ;
- `Run terminée` uniquement pour un membre du groupe.

Le compteur personnel affiche `X/3 runs réservés ou terminés`. À `3/3`, les
boutons `Rejoindre` sont désactivés avec une explication. La confirmation de fin
de run rappelle que tous les membres affichés utiliseront définitivement une
run.

L’archive contient deux niveaux :

1. les runs terminées de la semaine courante ;
2. les semaines précédentes.

Chaque entrée conserve le groupe, le numéro de run, les participants et la date
de fin.

## Modèle Supabase

### `boss_sessions`

Ajouter :

```sql
run_no      integer not null default 1
completed_at timestamptz
```

Remplacer l’unicité `(week_start, slot)` par :

```sql
(week_start, slot, run_no)
```

Une ligne représente désormais une run précise. Une seule run `open` est
affichée par emplacement. Les anciennes lignes reçoivent `run_no = 1`.

### `boss_participation`

La clé `(session_id, owner)` reste inchangée. Les lignes attachées à une session
archivée constituent l’historique définitif de cette run.

## Opérations atomiques

Les écritures de participation passent par trois fonctions PostgreSQL appelées
avec `supabase.rpc` :

- `join_boss_run(session_id)` : verrouille le compteur du membre pour la
  semaine, vérifie que la session est ouverte et que le total est inférieur à
  trois, puis inscrit le membre ;
- `leave_boss_run(session_id)` : vérifie que la session est ouverte et supprime
  uniquement la participation du membre courant ;
- `complete_boss_run(session_id)` : verrouille la session, vérifie que le membre
  courant y participe, renseigne `status = 'archived'` et `completed_at`, puis
  crée `run_no + 1` pour le même groupe.

Les fonctions utilisent `auth.uid()`, un `search_path` explicite et des
verrouillages transactionnels. Un double clic ou deux appareils ne peuvent ni
dépasser la limite, ni créer deux runs suivantes.

Les politiques RLS de lecture restent partagées. Les politiques directes
d’insertion, modification et suppression de `boss_participation` sont retirées :
seules les fonctions peuvent écrire. Les politiques directes de modification et
suppression de `boss_sessions` sont également retirées ; `ensureWeek` conserve
uniquement l’insertion initiale des six groupes. Une run archivée reste ainsi en
lecture seule.

## Rappel Discord

Le rappel du dimanche compte les participations de la semaine courante, ouvertes
ou archivées. Pour chaque profil sous la limite, il affiche le nombre manquant :

```text
Yannis : 1 run restante
Merlin : 3 runs restantes
```

Les membres à `3/3` ne sont pas rappelés. Si tout le monde a terminé ses trois
runs, le message l’indique.

## Gestion des erreurs

- Une tentative de quatrième inscription renvoie un message clair et laisse
  l’interface à `3/3`.
- Une run déjà terminée est rechargée sans créer de doublon.
- Un non-participant ne peut pas terminer une run.
- Après une erreur réseau, l’interface recharge l’état Supabase avant de
  réactiver les boutons.

## Vérification

Les tests doivent couvrir :

- réservation des trois runs et refus de la quatrième ;
- place libérée après avoir quitté une run ouverte ;
- archivage définitif des participants ;
- création immédiate de la run suivante ;
- double terminaison sans doublon ;
- interdiction de terminer pour un non-participant ;
- compteur et archive dans Chromium ;
- rappel Discord à 0/3, 1/3, 2/3 et 3/3 ;
- absence de débordement mobile.

## Migration utilisateur

Après déploiement du code, l’utilisateur doit exécuter le contenu complet de
`supabase/schema.sql` dans le SQL Editor Supabase avant d’utiliser les nouvelles
actions.
