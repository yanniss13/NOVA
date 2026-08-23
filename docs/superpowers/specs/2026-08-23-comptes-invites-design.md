# Comptes invités et administration des membres — conception

Date : 23 août 2026
Branche : `feat/comptes-invites`

## Le problème

Le site n'a qu'un seul niveau de compte : connecté. Dix tables portent la même
politique de lecture, `for select to authenticated using (true)`, et
l'inscription est ouverte à tous — `sb.auth.signUp` sans restriction, sans
confirmation d'email.

Conséquence, aujourd'hui : **n'importe qui connaissant l'URL crée un compte en
dix secondes et lit toute la confrérie** — rosters, collections, sessions de
boss, et les disponibilités nominatives de chaque membre.

Le besoin déclencheur est plus modeste : donner un compte à une personne hors
de la confrérie pour qu'elle garde son propre roster. Mais il n'existe aucun
moyen de le faire sans tout lui montrer.

## Ce que l'exploration a établi

**Le mécanisme d'onglets réduits existe déjà.** `js/vues/navigation.js:94`
porte `vueAutorisee(nom) = vuePublique(nom) || !visiteurAnonyme()`, et
`VUES_PUBLIQUES` vaut `builder`, `wiki`, `collection`, `calculateur`. Un invité
réutilise ce chemin au lieu d'en inventer un second.

**Les fonctions RPC du boss traversent la RLS.** `join_boss_run`,
`select_boss_team` et les autres sont en `security definer` : les politiques de
table ne les arrêtent pas. Un contrôle posé uniquement sur les tables laisserait
un invité rejoindre un run par appel direct.

**`gear_presets` est déjà cloisonné par propriétaire** et ne change pas.

## Décisions prises avec l'utilisateur

| Question | Décision |
|---|---|
| Qui ouvre-t-on | Une personne hors confrérie, pour l'instant |
| Son besoin | Garder son propre roster, utiliser l'OCR |
| Approche | Drapeau sur le profil + RLS conditionnelle, une seule instance |
| Écran d'administration | Oui, dès maintenant — plusieurs recrues par mois |
| Admin au départ | Le propriétaire seul |
| Équipes d'un invité | Enregistrables, visibles de lui seul |

## Ce que voit un invité

| | Invité | Membre |
|---|---|---|
| Builder, Wiki, Collection, Calculateur | ✅ | ✅ |
| Son roster, son OCR, ses presets, ses équipes | ✅ | ✅ |
| Roster des autres, Analyse, Accueil | ❌ | ✅ |
| Dispos, Sessions de boss, Recensement | ❌ | ✅ |

## Modèle de données

Deux colonnes sur `public.profiles`, toutes deux `not null default false` :

- `membre` — voit et alimente les données de la confrérie ;
- `admin` — peut promouvoir un autre compte.

Deux axes et non un rôle unique : un admin est toujours membre, mais séparer
les deux évite d'inventer une hiérarchie de rôles dont personne n'a besoin.

### Le piège de la récursion

La politique de lecture de `profiles` doit demander « es-tu membre ? », donc
lire `profiles`. Une fonction SQL ordinaire relancerait la politique sur
elle-même : **récursion infinie de RLS**, l'erreur classique sur Supabase.

Le contrôle vit donc dans une fonction `security definer` qui contourne la RLS :

```sql
create or replace function private.est_membre(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((select membre from public.profiles where id = p_uid), false);
$$;
```

`private.est_admin(p_uid)` suit la même forme. Toutes deux sont révoquées de
`public` et accordées à `authenticated`.

## Les politiques, en deux familles

**« à moi ou membre »** — l'invité lit ses propres lignes, rien d'autre :
`profiles` (`id = auth.uid()`), `teams`, `roster_characters`,
`collection_items` (`owner = auth.uid()`).

```sql
using (owner = auth.uid() or private.est_membre(auth.uid()))
```

**« membre uniquement »** — `recensement`, `member_availability`,
`boss_sessions`, `boss_participation`, `boss_run_reports`,
`animation_measures`. L'invité n'y accède pas, **même pas à ses propres
lignes** :

```sql
using (private.est_membre(auth.uid()))
```

**L'écriture est concernée autant que la lecture.** Une ligne de recensement ou
de disponibilité écrite par un invité remonterait dans l'analyse et dans la
grille de la confrérie. Les politiques `insert` et `update` de ces tables
exigent donc `private.est_membre(auth.uid())` dans leur `with check`.

`animation_measures` bascule en membre pour la lecture comme pour l'envoi : le
chronométrage est un effort de confrérie. Aucun écran du site ne lit cette
table — seul `scripts/rapatrier-mesures.py` la lit, et il ouvre une session
avec un compte ordinaire : la RLS s'y applique pleinement. Qui rapatrie doit
donc être membre, et qui envoie une mesure aussi.

## Les fonctions RPC du boss

Chaque RPC `security definer` du boss reçoit en tête :

```sql
if not private.est_membre(auth.uid()) then
  raise exception 'MEMBRE_REQUIS';
end if;
```

Sans cela, les politiques de table seraient contournées par la fonction
elle-même. C'est la porte dérobée du chantier, et elle se ferme ici.

## Interface

**Navigation.** `vueAutorisee` gagne un troisième cas. Les vues de confrérie —
`dashboard`, `roster`, `analyse`, `availability`, `boss` — exigent d'être
membre. `member-roster` reste ouvert à l'invité : c'est son propre roster.

**Écran d'administration.** Une vue `admin`, visible des seuls admins, qui
liste les comptes avec leur pseudo et un interrupteur « membre ». Aucune
suppression de compte, aucune gestion de rôles fine, aucun retrait du drapeau
`admin` : le strict nécessaire pour accueillir une recrue.

Un admin ne peut pas se retirer lui-même le drapeau `membre` — la garde est
posée côté SQL, pas seulement dans l'écran, pour qu'un appel direct ne puisse
pas vider la confrérie de son dernier responsable.

## La migration, et son risque

C'est le point qui fait mal si on le rate. Les deux instructions suivantes sont
dans **la même transaction** que l'ajout des colonnes :

```sql
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'profiles'
       and column_name = 'membre'
  ) then
    alter table public.profiles
      add column membre boolean not null default false,
      add column admin  boolean not null default false;
    -- Tous les comptes existants sont des membres : sans cette ligne, la
    -- confrérie entière devient invitée à la seconde où le schéma est appliqué.
    update public.profiles set membre = true;
  end if;
end
$$;
```

Le garde `if not exists` n'est pas décoratif : ce fichier est rejoué en entier
à chaque évolution du schéma, et un `update` posé à nu repromouvrait tous les
invités au collage suivant.

Le drapeau `admin` du propriétaire se pose ensuite **à la main, une fois**,
dans l'éditeur SQL de Supabase :

```sql
update public.profiles set admin = true, membre = true
where id = '<uuid-du-proprietaire>';
```

Il n'est pas dans le schéma rejouable : y écrire un identifiant de compte
figerait une donnée d'installation dans un fichier versionné. Tant qu'il n'est
pas posé, **personne ne peut promouvoir personne**, et l'écran d'administration
reste inaccessible — c'est la première chose à vérifier après application.

## Erreurs et cas limites

- **Invité qui atteint une vue de confrérie par l'URL** (`#analyse`) — même
  traitement que le visiteur anonyme aujourd'hui : repli sur la vue par défaut,
  sans message d'échec.
- **Compte promu pendant sa session** — le drapeau est lu à la connexion. La
  recrue doit recharger la page ; l'écran d'administration le dit à l'admin qui
  vient de promouvoir.
- **Admin qui se dégrade lui-même** — retirer son propre `membre` le
  couperait de la confrérie sans que personne puisse l'y remettre. Le SQL le
  refuse, et pas seulement l'écran : un appel direct doit échouer aussi.
- **Hors ligne** — inchangé : sans `sb`, tout retombe sur `localStorage` et
  aucun cloisonnement ne s'applique, faute de compte.

## Tests

- `tests/comptes-invites-schema.test.js` — les deux fonctions sont
  `security definer`, aucune table de confrérie ne garde `using (true)`, la
  ligne de migration `update … set membre = true` est présente, et les RPC boss
  portent leur garde.
- `tests/comptes-invites.playwright.js` — un compte invité voit la barre
  d'onglets réduite, ne lit pas le roster d'un membre, et l'écran
  d'administration lui est invisible ; un admin promeut un invité et la barre
  s'élargit après rechargement.
- `tests/helpers/faux-supabase.js` gagne la notion de membre : sans elle,
  aucun test navigateur ne peut distinguer les deux niveaux.

## Hors périmètre

Confirmation d'email à l'inscription, invitation par code, rôles fins,
suppression de compte depuis l'écran, plusieurs confréries sur une instance.
