# Supabase Realtime — synchronisation des vues partagées

## Objectif

Mettre à jour automatiquement les données partagées lorsqu'un autre membre
modifie une équipe, son roster ou une session de boss, sans recharger la page et
sans interrompre un formulaire en cours.

## Sources observées

Une seule chaîne Supabase Realtime, ouverte uniquement lorsqu'un membre est
connecté, écoutera les changements PostgreSQL des tables suivantes :

- `profiles` ;
- `teams` ;
- `roster_characters` ;
- `boss_sessions` ;
- `boss_participation`.

La table historique `recensement` n'est plus la source de l'écran du même nom :
le Recensement DPS et l'Analyse sont dérivés de `roster_characters` et
`profiles`. Ce sont donc les événements de ces deux tables qui actualisent ces
vues.

## Routage des actualisations

Les événements seront regroupés pendant un court délai afin qu'une RPC qui
modifie plusieurs lignes ne provoque qu'un seul rendu.

| Table modifiée | Données/vues à actualiser |
|---|---|
| `teams` | cache partagé des équipes ; vue Boss de Guilde si elle est ouverte |
| `profiles` | liste des membres ; Roster, Recensement ou Analyse si ouvert |
| `roster_characters` | cache roster ; Roster, Recensement ou Analyse si ouvert |
| `boss_sessions` | Sessions de boss si ouverte |
| `boss_participation` | Sessions de boss si ouverte |

Une vue inactive n'est pas rendue inutilement. Elle effectuera sa lecture
normale lorsqu'elle sera ouverte.

Un éditeur ou une modale déjà ouverte n'est jamais remplacé par un événement
distant. L'arrière-plan peut être actualisé, mais le brouillon local de
l'utilisateur reste intact.

## Cycle de vie

Un contrôleur unique :

1. crée la chaîne après une authentification réussie ;
2. empêche la création de plusieurs chaînes pour la même session ;
3. route et regroupe les événements ;
4. supprime la chaîne à la déconnexion ou au changement de session ;
5. peut être recréé après une reconnexion.

Les événements produits par les propres écritures du membre sont acceptés. Le
regroupement limite le double rendu après la mise à jour optimiste déjà réalisée
par les stores.

## État visible et erreurs

Un indicateur discret, associé à une région `aria-live`, affiche :

- `Connexion…` pendant la souscription ;
- `À jour` lorsque la chaîne est abonnée ;
- `Hors ligne` ou `Synchronisation indisponible` en cas de fermeture ou d'erreur.

Une panne Realtime ne bloque jamais les lectures et écritures Supabase
classiques. La navigation continue d'appeler les méthodes `refresh()` actuelles,
ce qui constitue le repli fonctionnel.

## Configuration Supabase

`supabase/schema.sql` ajoutera individuellement les cinq tables à la publication
`supabase_realtime`. Chaque ajout vérifiera d'abord
`pg_publication_tables` afin que le script complet reste idempotent et puisse
être rejoué dans le SQL Editor.

Aucune politique RLS n'est assouplie. Les événements visibles respectent les
droits de lecture existants des membres authentifiés.

## Tests d'acceptation

- Une seule chaîne est créée après connexion.
- Elle est retirée à la déconnexion et recréée à la reconnexion.
- Un événement `teams` actualise la liste d'équipes ouverte sans rechargement.
- Un événement `roster_characters` actualise le Roster, le Recensement ou
  l'Analyse selon la vue active.
- Un événement de session ou participation actualise les groupes de boss.
- Plusieurs événements rapprochés ne produisent qu'un rendu groupé par domaine.
- Un événement reçu pendant l'édition d'un roster ne modifie pas le brouillon.
- Une erreur de chaîne affiche l'état dégradé mais laisse les lectures manuelles
  utilisables.

