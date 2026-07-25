# Sessions de boss + PWA + Recensement auto — Design

Date : 2026-07-25
Statut : **en attente de validation utilisateur** (décisions ci-dessous déjà tranchées).
Ordre de construction : **#5 (recensement auto) → #2 (PWA) → #1 (sessions de boss)**.
Chaque brique est utilisable indépendamment.

## Décisions validées
- Sessions de boss = **assignation (avant) + suivi (après)**.
- Recensement ↔ Roster = **sync automatique, 100% auto (roster seul)**.
- PWA = gratuit (statique sur GitHub Pages).

---

## #5 — Recensement 100% auto depuis le Roster

> **Statut : IMPLÉMENTÉ (2026-07-25).** `dpsEntriesFromRoster` +
> `rosterDerivedPlayers` ; Recensement/Analyse dérivés du roster, en lecture
> seule, connexion requise. Saisie manuelle retirée. Tests : unitaire
> `dpsEntriesFromRoster` + intégration (recensement dérivé + overflow mobile).
> Les tests obsolètes `menu-element-dps` et `mobile-analyse-partielle` (qui
> testaient la saisie manuelle) ont été retirés de la suite.

### But
Supprimer la double saisie : le **Roster devient l'unique source des DPS**. Le
Recensement et l'Analyse sont **dérivés** du roster de chaque membre.

### Règle de dérivation
Pour chaque membre, pour chaque personnage de `roster_characters`, pour chaque
`build` (indexé par type d'arme) dont le **rôle est offensif** (`Attacker` ou
`Buster`, via `WSLOT_ROLES`/les `weaponSlots` du perso) :
→ une entrée DPS `{ char, element, pot }` où
  - `element` = élément du slot d'arme correspondant (`meta.weapons[].element`),
  - `pot` = `potential_tier` (potentiel commun du perso).

Un perso avec 2 builds offensifs (2 éléments) produit **2 entrées DPS**.
Les builds à rôle défensif/soutien (`Warden`, `Supporter`) ne comptent pas.

### Impact sur l'existant (à assumer)
- **Suppression** de la saisie manuelle du Recensement : plus d'« Ajouter un
  membre / Ajouter un DPS / sélecteur d'élément/potentiel ».
- La table Supabase `recensement`, le store `Rec`/`LocalRec` et le cache
  `confrerie7ds.cloud.roster`… → le **module recensement lit désormais tous les
  `roster_characters`** (via un nouveau `refreshAllRosters()` : select léger
  `owner, char_id, potential_tier, builds, updated_at` sur toute la table) et
  dérive les DPS. `recensement` table conservée mais **non écrite** (dépréciée) —
  ou retirée du flux ; ne pas la supprimer du schéma pour ne rien casser.
- La vue **Recensement** devient en lecture seule : liste par membre des DPS
  dérivés (avec badges élément + potentiel), avec un lien « éditer mon roster ».
- La vue **Analyse** (couverture, classement, matrice) fonctionne à l'identique
  mais sur les DPS dérivés du roster.
- Nécessite d'être **connecté** (le roster vit dans Supabase). Sans connexion,
  Recensement/Analyse invitent à se connecter.

### Fonctions produites
- `dpsEntriesFromRoster(entry): [{char, element, pot}]` (pure, testable).
- `rosterPlayersToDps(rosterRows, profiles): [{name, dps:[…]}]` (agrégat pour Analyse).
- `refreshAllRosters(): Promise<rosterRows[]>` (lecture Supabase de toute la table).

### Tests
- Unitaire : `dpsEntriesFromRoster` (multi-builds → multi-DPS ; rôles non
  offensifs ignorés ; potentiel repris).
- Playwright (faux Supabase) : 2 membres avec rosters → Analyse affiche les bons
  DPS/éléments/classements ; aucune saisie manuelle présente.

---

## #2 — PWA (installable, gratuit)

### Livrables
- `manifest.webmanifest` : `name` « Confrérie 7DS », `short_name` « 7DS »,
  `display:"standalone"`, `theme_color:"#0e0d12"`, `background_color:"#0e0d12"`,
  `start_url:"./?pwa=1"`, `icons` (192, 512, + maskable) générées depuis le
  blason doré « 7 » sur fond obsidienne.
- `<link rel="manifest">` + `<meta name="apple-mobile-web-app-*">` dans `index.html`.
- `sw.js` (service worker) enregistré depuis `index.html`.

### Stratégie de cache (éviter le bug de cache déjà rencontré)
- **App shell + assets locaux** (index.html, *.js générés, images `7ds-*`,
  `7ds-ui`) : **stale-while-revalidate** — affichage instantané + mise à jour en
  arrière-plan, avec un **numéro de version** (`CACHE = "conf7ds-vN"`) ; à
  l'activation, purge des anciens caches.
- **Supabase et CDN supabase-js** : **network-only** (jamais mis en cache).
- **Mise à jour** : `skipWaiting()` + `clients.claim()` ; quand une nouvelle
  version du SW est prête, un petit bandeau « Nouvelle version — recharger »
  (non bloquant).
- `index.html` reste servi frais tant que possible (le SW ne doit pas figer la
  page comme le cache Safari l'a fait).

### Tests
- Playwright : présence `<link rel=manifest>` + manifest JSON valide + SW
  enregistré ; le SW ne met pas en cache les requêtes `supabase.co`.

---

## #1 — Sessions de boss (assignation + suivi)

### Modèle Supabase (nouvelles tables, partagées)
```sql
-- Une session = un boss à une date, avec les éléments concernés
create table public.boss_sessions (
  id         uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title      text not null,          -- ex. "Boss de guilde – semaine 30"
  boss_name  text,
  session_date date,
  elements   text[] not null default '{}',  -- éléments visés (FIRE, ICE, …)
  status     text not null default 'open',  -- open | closed
  created_at timestamptz not null default now()
);

-- Participation d'un membre à une session : assignation (avant) + résultat (après)
create table public.boss_participation (
  session_id uuid not null references public.boss_sessions(id) on delete cascade,
  owner      uuid not null references auth.users(id) on delete cascade,
  pseudo     text,
  element    text,                    -- élément assigné
  team_id    uuid,                    -- équipe utilisée (référence libre vers teams.id)
  damage     bigint,                  -- dégâts (suivi après)
  participated boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (session_id, owner)
);
```
RLS : lecture par tout membre connecté ; `boss_sessions` écrite par
`created_by = auth.uid()` (ou tout membre — à trancher, défaut : le créateur) ;
`boss_participation` : chaque membre écrit **sa propre ligne**
(`owner = auth.uid()`).

### Interface (nouvel onglet « Sessions de boss »)
- **Liste des sessions** (ouvertes/fermées) + bouton « Nouvelle session ».
- **Créer** : titre, nom du boss, date, éléments visés.
- **Détail d'une session** :
  - **Assignation (avant)** : pour chaque élément visé, afficher le **classement
    des membres** (issu des DPS dérivés du roster — réutilise #5) ; chaque membre
    choisit l'élément qu'il prend + (optionnel) l'équipe. Vue d'ensemble « qui
    couvre quoi », trous mis en évidence.
  - **Suivi (après)** : chaque membre saisit ses **dégâts** et coche
    « participé » ; affichage du **total guilde**, du **classement des dégâts**,
    et statut vaincu/non (clôture par le créateur).

### Dépendances
- Réutilise l'agrégat DPS de #5 (classement par élément).
- Référence les `teams` existantes (équipe utilisée).

### Tests
- Unitaire : agrégation dégâts/classement d'une session.
- Playwright (faux Supabase) : créer une session, assigner un élément, saisir des
  dégâts, voir le total + classement ; un autre membre ne modifie que sa ligne.

---

## Contraintes globales (toutes les briques)
- Français partout ; logique inline dans `index.html` ; aucun framework.
- Aucun débordement horizontal à 320/360/390 px ; champs 16px sous 560px.
- `npm test` reste vert (tests ajoutés au fur et à mesure).
- Manip Supabase restante à indiquer à l'utilisateur : relancer `supabase/schema.sql`
  (qui contiendra les nouvelles tables `boss_sessions` / `boss_participation`).
