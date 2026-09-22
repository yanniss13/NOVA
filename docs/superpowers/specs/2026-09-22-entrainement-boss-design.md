# Entraînement du boss de confrérie — design

Date : 2026-09-22. Statut : validé section par section avec le propriétaire.

## Contexte

La 2.1 a ajouté un **mode entraînement** au combat de boss de confrérie
(débloqué par la fabrication de l'« Ornement à emblème doré » au QG). Les
membres veulent y consigner leurs runs pour :

- garder une trace (qui, quelles équipes, quel score) ;
- suivre la progression des scores ;
- comparer les équipes ;
- classer les meilleures runs.

Faits de jeu confirmés par le propriétaire :

- une run d'entraînement se joue **en groupe de 1 à 5 membres** ;
- le jeu n'affiche qu'un **score global**, jamais les dégâts par membre ;
- le mode n'a **aucune variante** (même boss, mêmes règles) : les scores se
  comparent directement.

Ce n'est **pas** le boss de la semaine : aucun quota de 3 runs, aucun des six
groupes, aucun rappel Discord, rien dans « Mon suivi » ni dans
« Meilleures runs ». D'où une table dédiée plutôt qu'un drapeau dans
`boss_sessions`, qui aurait imposé une exception à chacune de ces règles.

## Décisions

| Sujet | Décision |
| --- | --- |
| Stockage | Une ligne par run (`boss_training_runs`), participants en tableau, équipes en JSON |
| Saisie | Un seul membre saisit tout : participants, équipe de chacun, score |
| Équipe d'un participant | Facultative (« équipe non renseignée ») |
| Placement | 4ᵉ sous-onglet du groupe Boss, « Entraînement » |
| Droits d'écriture | Les participants de la run |
| Vues | Historique, Progression, Classement (avec comparaison d'équipes) |

## 1. Données

### Table `public.boss_training_runs`

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | `uuid` pk | `gen_random_uuid()` |
| `played_on` | `date not null` | jamais dans le futur (heure de Paris), vérifié par trigger |
| `global_score` | `bigint not null` | `> 0` |
| `note` | `text not null default ''` | `char_length(note) <= 1000` |
| `participants` | `uuid[] not null` | 1 à 5 éléments, sans doublon, sans `null` |
| `equipes` | `jsonb not null default '{}'` | voir ci-dessous |
| `created_by` | `uuid` → `auth.users`, `on delete set null` | = `auth.uid()` à la création |
| `created_by_pseudo` | `text not null` | lu dans `profiles` par le trigger |
| `created_at` | `timestamptz not null default now()` | |
| `updated_by_pseudo` | `text` | lu dans `profiles` par le trigger |
| `updated_at` | `timestamptz not null default now()` | réécrit par le trigger à chaque modification |

`equipes` a une clé par participant :

```js
{
  "<uuid du membre>": {
    pseudo: "NomDuMembre",
    teamId: "uuid" | null,     // null = équipe non renseignée
    snapshot: { /* copie de teams.data */ } | null
  }
}
```

### Trigger `boss_training_runs_prepare` (before insert or update)

Le client ne fournit que `teamId`. Le serveur fait le reste, pour qu'aucun
instantané ne puisse être forgé :

- toute clé de `equipes` appartient à `participants`, et tout participant a
  sa clé ;
- un `teamId` non nul doit désigner une équipe dont `owner` est ce
  participant, sinon `TRAINING_TEAM_NOT_OWNED` ;
- `pseudo` et `snapshot` sont recopiés depuis `profiles` et `teams.data`
  **quand `teamId` change** (ou à l'insertion). Inchangé, l'instantané
  existant est conservé tel quel : il est **immuable**, comme pour le vrai
  boss. Modifier ou supprimer l'équipe source ne change jamais la run ;
- `played_on` postérieur à la date du jour à Paris → `TRAINING_FUTURE_DATE` ;
- `created_by`, `created_by_pseudo` et `created_at` ne changent jamais après
  l'insertion ; `updated_at` et `updated_by_pseudo` sont posés à chaque mise
  à jour.

### Droits (RLS)

- `select` : tout membre authentifié.
- `insert` : `created_by = auth.uid()` **et** `auth.uid() = any(participants)`.
  On n'enregistre pas une run à laquelle on n'a pas participé.
- `update` : `using (auth.uid() = any(participants))` — participant *avant* la
  modification — et `with check (auth.uid() = any(participants))` : on peut
  ajouter ou retirer d'autres participants, jamais se retirer soi-même, et une
  run ne devient jamais orpheline.
- `delete` : `auth.uid() = any(participants)`.
- Aucun droit pour `anon`.

Un compte supprimé laisse ses runs intactes : pseudo et équipe sont figés
dans `equipes`, son identifiant reste dans `participants` sans plus donner
aucun droit.

### Concurrence

Une correction porte le `updated_at` relu par le client
(`.eq("updated_at", jeton)`). Zéro ligne modifiée → `TRAINING_CONFLICT`,
message « Cette run a été modifiée par <pseudo> entre-temps : recharge-la. »
Le jeton est conservé comme chaîne opaque, jamais reconstruit par
`Date.parse()` (même piège que `update_roster_build` : les microsecondes).

### Realtime et schéma

La table rejoint la publication `supabase_realtime` et la chaîne
`confrerie-live-<userId>`. Tout le bloc est idempotent dans
`supabase/schema.sql`. **Ordre de mise en service** : rejouer le schéma
complet dans le SQL Editor, puis seulement pousser le frontend.

## 2. Interface

### Emplacement

Sous-onglet **« Entraînement »** après Équipes / Dispos / Sessions de boss,
dans `#bossSubtabs` et dans le dock mobile `#mobileBossSubtabs`. Réservé aux
membres connectés (`vueAutorisee()`), comme les trois autres.

### Saisie — modale `ModalStack`

Bouton **« Enregistrer une run »** en tête de vue. Champs, dans l'ordre :

1. **Date** — aujourd'hui (Paris) par défaut, pas de date future.
2. **Participants** — le membre qui saisit ou corrige est coché d'office et
   non décochable (la RLS le refuserait), jusqu'à 4 autres choisis parmi les
   membres (`profiles`).
3. **Équipe de chaque participant** — liste des équipes *de ce membre*
   (nom + portraits des 4 héros) ; « Équipe non renseignée » toujours
   proposée.
4. **Score global** (obligatoire) et **note** (facultative, compteur
   /1000).

La même modale corrige une run existante, avec **« Supprimer »** derrière une
confirmation. Le rendu n'a lieu qu'après la réponse de Supabase : une panne
ne doit jamais faire croire qu'une run est enregistrée.

### Trois vues locales

Construites depuis une seule lecture ; changer de vue ne fait **aucune**
requête.

- **Historique** — runs de la plus récente à la plus ancienne (`played_on`,
  puis `created_at`). Date, score, participants avec les portraits de leur
  équipe, note, « Corriger » visible seulement pour un participant. Un clic
  sur une équipe ouvre la fiche d'équipement existante (`openTeamDetail`).
- **Progression** — courbe des scores dans le temps en **SVG fait main**
  (aucune bibliothèque ajoutée). Filtre « Toute la confrérie » ou un membre
  (les runs auxquelles il a participé). Sous la courbe : meilleur score,
  dernier score, écart entre les deux. Chaque point porte sa valeur écrite
  dans une liste accessible : la courbe n'est jamais la seule porteuse de
  l'information.
- **Classement** — les 10 meilleures runs, avec l'équipe de chaque
  participant. On classe **des runs, jamais des équipes**.
  Dessous, **Comparaison des équipes** : choix d'un membre (soi par défaut) ;
  pour chaque composition qu'il a utilisée (mêmes 4 héros, ordre
  indifférent) : nombre de runs, meilleur score, score médian. Mention
  explicite : « Le score est celui du groupe : les autres participants y
  comptent aussi. » Les runs où son équipe n'est pas renseignée n'y entrent
  pas.

### États

- Aucune run : message d'invitation et bouton de saisie.
- Hors ligne : dernier cache compatible avec le badge « Hors ligne » et les
  actions d'écriture désactivées ; sans cache, « L'entraînement est
  indisponible hors ligne » — jamais une liste vide qui passerait pour
  « aucune run ».
- Mobile : cibles de 44 px, aucun débordement entre 320 et 390 px.

## 3. Code

| Couche | Fichier | Rôle |
| --- | --- | --- |
| métier | `js/metier/entrainement-boss.js` | validation d'une saisie, clé de composition, série de progression, top 10, comparaison (nombre, meilleur, médiane) |
| données | `js/donnees/entrainement-store.js` | lecture, création, correction avec jeton, suppression, cache `confrerie7ds.cloud.training` |
| vues | `js/vues/boss-entrainement.js` | les trois vues et la courbe SVG |
| vues | `js/vues/modale-entrainement.js` | la saisie et la correction |

Les scores restent des **chaînes** de bout en bout et se comparent en
`BigInt`, comme `formatBossScore`. Les noms de premier niveau restent uniques
dans tout `js/` (chargeur `vm` des tests).

Branchements : `index.html` (sous-onglet, dock mobile, section de vue),
`vues/navigation.js`, `vues/synchro-temps-reel.js` (relecture si la vue est
active, sinon marquée à relire), `tests/helpers/modules.js`, `CORE_ASSETS` de
`sw.js`, `AGENTS.md`.

## 4. Tests

- **Unitaires** (`entrainement-boss`) : 6 participants refusés, auteur absent
  refusé, doublon refusé, score nul ou négatif refusé, note de 1001
  caractères refusée ; clé de composition indépendante de l'ordre ; équipe
  non renseignée exclue de la comparaison ; médiane sur un nombre pair ;
  scores au-delà de 2⁵³ triés sans perte.
- **Schéma** : syntaxe par `pglast` ; RLS activée ; aucune politique
  n'autorise l'écriture d'une run sans être participant ; table dans la
  publication Realtime ; trigger présent.
- **Playwright** (Supabase simulé) : saisir une run et la voir dans
  l'historique ; la corriger ; conflit `TRAINING_CONFLICT` affiché ; un
  non-participant ne voit pas « Corriger » ; les trois vues au clavier ;
  aucun débordement à 320 px.

## Hors périmètre

- Dégâts par membre (le jeu ne les donne pas).
- Lien avec les runs du vrai boss, « Mon suivi », Discord.
- Import d'une run depuis une capture d'écran.
