# Disponibilités hebdomadaires des membres

## Statut

Design validé avec l'utilisateur le 1er août 2026.

Ce document décrit la première version de l'onglet **« Dispos »**.
L'implémentation fera l'objet d'un plan séparé.

## Objectif

Permettre à chaque membre de déclarer les créneaux horaires où il peut jouer
pendant la semaine, et donner à la confrérie une lecture immédiate des heures
où le plus de monde est disponible, afin de **former les groupes de Boss de
Guilde et de caler l'horaire des runs**.

## Périmètre

La première version couvre :

- la saisie de créneaux d'une heure sur les sept jours de la semaine courante ;
- la reprise en un clic des créneaux de la semaine précédente ;
- une lecture collective par densité, avec la liste nominative des membres
  disponibles sur un créneau donné ;
- le marquage des membres qui n'ont encore rejoint aucun groupe de la semaine.

Elle ne couvre pas :

- les disponibilités récurrentes permanentes (« tous les mardis ») ni les
  exceptions associées ;
- la navigation vers des semaines futures ou passées ;
- le croisement automatique des créneaux membre par membre au sein d'un
  groupe de boss déjà constitué ;
- la création d'événements datés ou d'inscriptions à ces événements ;
- l'attribution automatique des membres aux six groupes ;
- toute notification, Discord ou autre.

## Choix structurants

### Grille maison, sans bibliothèque de calendrier

L'utilisateur avait évoqué FullCalendar. Le besoin réel est une grille
hebdomadaire jour × heure où l'on **peint une sélection**, doublée d'une
coloration par densité. Le glisser-déposer de FullCalendar sert à déplacer un
événement existant, ce qui n'est pas l'interaction voulue ; ses vues mois,
sa récurrence, ses fuseaux et son glisser-déposer d'événements seraient du
poids mort, et la heatmap se construirait contre lui.

La grille est donc écrite à la main dans `index.html`, comme le reste du site :
aucun kilo-octet supplémentaire, mode hors ligne et ouverture en `file://`
préservés, style identique au thème, cibles tactiles et densité maîtrisées.

### Semaine calendaire, distincte de la semaine de boss

La grille couvre la **semaine calendaire ISO, du lundi 00h au dimanche 24h**,
et bascule le lundi à 00h.

Les tables de boss utilisent une semaine qui bascule le **lundi à 9h**
(`private.current_boss_week_start()`). Les deux ne coïncident pas entre minuit
et 9h le lundi matin. La divergence est volontaire : une grille de dispos qui
montrerait encore la semaine écoulée le lundi matin ne servirait à rien.

En conséquence, `member_availability.week_start` **ne doit jamais être joint
naïvement** à `boss_sessions.week_start`. Un commentaire SQL le rappelle sur la
table.

## Navigation

Un onglet principal **« Dispos »** est ajouté à la barre d'onglets, placé juste
après « Boss de Guilde ». Il s'agit d'un outil de coordination de boss, pas d'un
agenda général.

L'onglet reste ouvrable par un visiteur déconnecté, mais les politiques RLS
réservent la lecture aux membres connectés : la vue n'affiche alors **aucune
donnée**, seulement une grille vide désactivée et une invitation à se connecter.
Aucune disponibilité n'est jamais servie à un visiteur anonyme.

## Vue « Mes dispos »

### Structure de la grille

- **Colonnes** : les sept jours de la semaine courante, avec leur date
  (`Lun 3`, `Mar 4`, …).
- **Lignes** : vingt-quatre créneaux d'une heure, de **00h à 24h**.
- **168 cases** au total pour la semaine.

L'en-tête des jours et la gouttière des heures restent collants pendant le
défilement. Les cases conservent au minimum 44 px de côté ; si la largeur
manque, la grille défile horizontalement **dans son propre conteneur**, selon le
même procédé que le rail d'onglets, sans jamais faire déborder la vue entre
320 et 390 px.

### Saisie par glissement

Un glissement peint un **rectangle de cases** délimité par la case d'ancrage et
la case sous le curseur, sur la plage de jours et la plage d'heures
correspondantes.

Le sens de la peinture est décidé par l'état de la case d'ancrage :

- ancrage sur une case vide → le rectangle est **rempli** ;
- ancrage sur une case pleine → le rectangle est **effacé**.

Un aperçu suit le curseur pendant le geste ; la modification n'est appliquée
qu'au relâchement.

Sur écran tactile, **seul l'appui bascule une case** — il n'y a pas de peinture
par glissement.

Cette règle a été corrigée le 1er août 2026 après mesure sur navigateur. La
version initiale prévoyait un appui maintenu de 150 ms engageant la peinture :
c'était irréalisable. Le navigateur émet `pointercancel` dès qu'il décide de
faire défiler, donc le geste ne s'engage jamais ; et le forcer reviendrait à
confisquer le défilement d'une grille de 24 lignes.

Symétriquement, quand le doigt bouge **moins** que le seuil de défilement du
navigateur, aucun `pointercancel` n'est émis et le `pointerup` arrive quand
même. Sans filtre, tout doigt posé pour tenter un défilement remplissait un
créneau. L'appui n'est donc retenu que s'il est **bref (moins de 300 ms) et
immobile (moins de 10 px de déplacement cumulé)**, le déplacement étant mesuré
pendant le geste et non au relâchement.

La saisie de plusieurs créneaux au doigt passe par le contrôle « Ajouter un
créneau » décrit plus bas.

Un `touch-action: none` permanent sur la grille est proscrit : il rendrait le
défilement impossible au doigt.

### Raccourcis

- Appui sur l'en-tête d'un jour : bascule la journée entière.
- Appui sur la gouttière d'une heure : bascule ce créneau sur les sept jours.

Ces deux raccourcis suivent la même règle de sens que le glissement : si tout
est déjà sélectionné, l'appui efface ; sinon il remplit.

### Créneaux de nuit

Un contrôle placé sous la grille pose un créneau qui enjambe minuit :

```
de [22h] à [02h]    [L][M][M][J][V][S][D]    [ Ajouter ]  [ Retirer ]
```

Règles :

- les deux heures désignent des **débuts de créneau**, et la plage couvre
  `[début, fin[` : `22h → 02h` sélectionne 22h, 23h, 00h et 01h, soit quatre
  cases ;
- si l'heure de fin est **strictement inférieure** à l'heure de début, le
  créneau se poursuit le lendemain ;
- si les deux heures sont **égales**, la plage serait vide ou longue de
  vingt-quatre heures selon la lecture : le cas est donc interdit et les boutons
  « Ajouter » et « Retirer » restent désactivés tant qu'elles le sont ;
- le créneau s'applique à chaque jour coché, la partie après minuit tombant sur
  le jour suivant ;
- la partie qui dépasserait **dimanche 24h** est **écrêtée** et un message
  discret l'indique : elle appartient à la semaine suivante, hors de cette
  grille ;
- « Retirer » applique la même plage en effacement.

Ce contrôle est aussi le moyen le plus rapide de déclarer un rythme régulier
sur plusieurs jours.

### Accessibilité au clavier

Chaque case est un `button` portant `aria-pressed`. Les flèches déplacent le
focus dans la grille, `Espace` bascule la case, `Maj` + flèches étendent la
sélection depuis la case ancrée. Le contrôle de créneau de nuit est atteignable
et utilisable au clavier seul.

### Enregistrement

L'enregistrement est **automatique**, environ 600 ms après la fin du geste, et
son état s'affiche dans un indicateur dédié `#availSaveStatus`. `liveStatus` a
été écarté : il appartient à `RealtimeSync`, qui y écrit l'état de la connexion,
et deux écrivains sur le même nœud se chasseraient l'un l'autre.

La grille est mise à jour **sur place** : seuls les attributs des cases
concernées changent. La reconstruire à chaque bascule faisait perdre la position
de défilement et le focus, ce qui donnait au membre l'impression que le planning
se rechargeait à chaque créneau.

Hors ligne, la grille reste lisible depuis le cache local mais n'accepte plus de
modification, et le message le dit explicitement — même comportement
qu'« Enregistrer l'équipe » aujourd'hui.

### Reprise de la semaine précédente

Un bouton **« Reprendre mes dispos de la semaine dernière »** copie le masque de
la semaine précédente dans la semaine courante. Il n'apparaît que si la semaine
courante est encore vide et que la semaine précédente existe.

## Vue « La confrérie »

Une bascule à deux positions, **« Mes dispos » / « La confrérie »**, surmonte la
même grille.

En mode confrérie, chaque case affiche le **nombre de membres disponibles** et
prend une couleur parmi **cinq paliers de densité, relatifs au maximum de la
semaine**. Si ce maximum est nul — personne n'a encore rien saisi — toutes les
cases restent au palier zéro, sans division par zéro. Le nombre est toujours
écrit : la couleur seule ne doit jamais porter l'information. Les cases où le membre courant est lui-même disponible gardent un
liseré qui le situe dans la grille.

Sous la grille, une ligne **« Meilleurs créneaux »** liste les trois créneaux les
plus fournis de la semaine, cliquables. À nombre égal, le créneau le plus tôt
dans la semaine passe devant, afin que le classement soit déterministe et
testable. Les créneaux sans personne n'y figurent jamais, même si la semaine
compte moins de trois créneaux occupés.

### Panneau d'un créneau

L'appui sur une case ouvre un panneau, dans la pile de modales existante, qui
affiche :

- l'intitulé du créneau et le nombre de membres (« Samedi 21h — 16 membres ») ;
- la liste des pseudos disponibles, le membre courant en tête ;
- une mention **« sans groupe »** à côté des membres qui n'ont rejoint aucun
  groupe de la semaine de boss courante.

Cette mention réutilise les participations déjà chargées par la vue Boss ; elle
indique directement qui reste à recruter. Elle est calculée sur la **semaine de
boss** en cours, et non sur la semaine calendaire de la grille.

Les pseudos proviennent de la table `profiles`, déjà lue par les vues
partagées : aucune dénormalisation n'est ajoutée.

## Modèle de données

### Table

```sql
-- Disponibilités hebdomadaires : une ligne par membre et par semaine.
-- `week_start` est le LUNDI ISO (00h) et NON la semaine de boss, qui bascule le
-- lundi à 9h (private.current_boss_week_start()). Ne pas joindre naïvement les
-- deux : elles diffèrent entre minuit et 9h le lundi.
-- `slots` : un caractère par créneau d'une heure, à l'index jour * 24 + heure,
-- le jour 0 étant le lundi. '1' = disponible.
create table if not exists public.member_availability (
  owner      uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  slots      text not null default repeat('0', 168)
             check (slots ~ '^[01]{168}$'),
  updated_at timestamptz not null default now(),
  primary key (owner, week_start)
);

create index if not exists member_availability_week_idx
  on public.member_availability(week_start);
```

Le masque de longueur fixe se vérifie en une seule contrainte, tient dans un
`upsert` atomique, se lit en JS par `slots[jour * 24 + heure]` et rend la charge
Realtime négligeable. Une ligne par créneau aurait produit des centaines
d'écritures par geste.

`on delete cascade` est volontaire : contrairement aux archives de boss, une
disponibilité n'a aucune valeur historique une fois le compte supprimé.

### Sécurité

Les quatre politiques sont calquées sur celles de `roster_characters` :

```sql
alter table public.member_availability enable row level security;
create policy avail_read   on public.member_availability
  for select to authenticated using (true);
create policy avail_insert on public.member_availability
  for insert to authenticated with check (owner = auth.uid());
create policy avail_update on public.member_availability
  for update to authenticated using (owner = auth.uid())
  with check (owner = auth.uid());
create policy avail_delete on public.member_availability
  for delete to authenticated using (owner = auth.uid());
```

Tout membre connecté lit les disponibilités de la confrérie ; seul le
propriétaire écrit les siennes.

### Publication Realtime

`member_availability` est ajoutée au tableau des tables publiées dans le bloc
Realtime de `supabase/schema.sql`.

### Purge

À chaque enregistrement, le client supprime **ses propres** lignes dont
`week_start` est antérieur de plus de quatre semaines. La suppression est
autorisée par `avail_delete`. La table se nettoie ainsi seule, sans tâche
planifiée ni RPC dédiée.

### Migration

Aucune RPC n'est nécessaire : un `upsert` sous RLS suffit, et la reprise de la
semaine précédente est une lecture suivie d'une écriture côté client.

L'utilisateur devra rejouer l'intégralité de `supabase/schema.sql` dans le SQL
Editor Supabase. Le script reste idempotent.

## Synchronisation

`member_availability` rejoint la chaîne Realtime unique existante, avec le même
regroupement des événements rapprochés que les autres tables partagées.

Une garde est indispensable : tant qu'un geste de saisie ou son débounce
d'enregistrement est en cours, les événements Realtime portant sur **la ligne du
membre courant** sont ignorés. Sans cette garde, l'écho du serveur écrase la
sélection en cours de peinture.

Le cache hors ligne est séparé par compte et par semaine, comme les autres
caches cloud du projet.

## Découpage et testabilité

Le rendu DOM ne doit contenir aucune règle métier. La logique est isolée dans
des fonctions pures, exposées au chargeur `vm` des tests
(`tests/helpers/load-app.js`) :

| Fonction | Rôle |
|---|---|
| `availabilityWeekStart(date)` | lundi ISO de la semaine contenant `date` |
| `slotIndex(day, hour)` / `slotFromIndex(i)` | conversion index ↔ (jour, heure) |
| `applyNightRange(mask, startHour, endHour, days, fill)` | plage horaire pouvant enjamber minuit, écrêtée au dimanche 24h |
| `paintRectangle(mask, anchor, cursor, fill)` | rectangle jours × heures |
| `aggregateAvailability(rows)` | 168 compteurs et créneaux les mieux fournis |
| `densityTier(count, max)` | palier de densité 0 à 4 |

Chaque fonction prend un masque et en renvoie un nouveau : aucune mutation en
place, ce qui rend l'aperçu de sélection trivial à afficher et à annuler.

## Tests

| Fichier | Couverture |
|---|---|
| `tests/availability-schema.test.js` | table, clé primaire `(owner, week_start)`, contrainte du masque, quatre politiques RLS, présence dans la publication Realtime |
| `tests/availability.test.js` | fonctions pures : bornes de semaine, conversion d'index, plage 22h→02h, écrêtage du dimanche, rectangle, agrégation, paliers de densité |
| `tests/availability.playwright.js` | glissement de sélection, appui maintenu tactile, contrôle de créneau de nuit, bascule des deux vues, navigation clavier, absence de débordement horizontal entre 320 et 390 px |

Les trois fichiers sont ajoutés aux scripts `test`, `test:unit` et `test:e2e` de
`package.json`, selon leur nature.

`tests/availability-schema.test.js` suit le modèle de `tests/roster-schema.test.js`
(lecture du SQL et vérification par expressions régulières).

## Points hors périmètre assumés

- **Fuseaux horaires** : toutes les heures sont en heure de Paris, comme le
  reste de l'application. Aucune conversion n'est faite.
- **Créneaux de trente minutes** : le pas est d'une heure. Le passage à trente
  minutes ne changerait que la longueur du masque et le nombre de lignes ; rien
  dans le modèle ne l'interdit plus tard.
- **Plage horaire réduite** : les vingt-quatre heures sont toujours affichées,
  sans repli.
- **Nuit du dimanche au lundi** : sa partie après minuit appartient à la semaine
  suivante et se saisit dans la grille de cette semaine-là.
