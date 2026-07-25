# Handoff Codex — Supabase Étape 1 (comptes + partage)

Date : 2026-07-25
Statut : **Étape 1 implémentée**. Config + SQL fournis. Restent les 2 manips
Supabase côté utilisateur décrites ci-dessous.

> Ce doc contient TOUT le contexte pour qu'un agent (Codex) implémente l'Étape 1
> sans repartir de zéro. Lis-le en entier, puis suis « Plan d'implémentation ».

## Résultat de l'implémentation
- Gate email/mot de passe avec création de compte, profil/pseudo, déconnexion et
  possibilité de continuer à composer hors connexion.
- Équipes partagées via `teams`, avec actions Modifier/Supprimer réservées au
  propriétaire et cache local séparé.
- Recensement partagé via une ligne par compte ; Analyse alimentée par toutes les
  lignes visibles.
- Migration one-shot de `confrerie7ds.teams` et du recensement correspondant au
  pseudo connecté. Les sauvegardes locales d'origine ne sont pas supprimées.
- Parcours Chromium automatisé avec faux client Supabase, sans compte réel.

## Contexte / décisions validées par l'utilisateur
- Objectif : rendre **collaboratif** ce qui est aujourd'hui local (localStorage) →
  chaque membre a un **compte**, les **équipes (Boss de Guilde)** ET le
  **Recensement DPS / Analyse** sont **partagés** entre tous les membres.
- **Auth = email + mot de passe, SANS confirmation email** (choix validé : l'email
  intégré Supabase est trop limité en débit sur le plan gratuit pour une confrérie).
- Vision Étape 2 (PLUS TARD, pas maintenant) : « roster persistant » — chaque
  membre construit ses persos équipés une fois et les réutilise. NE PAS commencer
  l'Étape 2 tant que l'Étape 1 n'est pas validée.
- Gratuité : plan Free Supabase largement suffisant (données en Ko/Mo). Garder
  l'export/import JSON existant comme filet / format pivot (pas de lock-in).

## Projet Supabase (déjà créé par l'utilisateur)
- Project URL : `https://uxouhbgdlolidjmxwgae.supabase.co`
- Publishable key (publique, OK dans le navigateur) : dans `supabase-config.js`
  (`window.SB_URL`, `window.SB_KEY`). NE JAMAIS utiliser/committer la clé secret/service_role.
- Vérifié : `/auth/v1/health` = 200, provider **email activé**.

## Manips Supabase RESTANT à faire par l'utilisateur (lui indiquer)
1. **SQL** : ouvrir Supabase → *SQL Editor* → coller `supabase/schema.sql` → **Run**.
   (crée `profiles`, `teams`, `recensement` + RLS).
2. **Auth** : Authentication → provider **Email** → **désactiver « Confirm email »**
   (inscription immédiate sans email). Vérifier que *Enable Email signup* est ON.
   (Optionnel : Authentication → URL Configuration → Site URL =
   `https://yanniss13.github.io/N-VA/`.)

## Modèle de données (voir `supabase/schema.sql`)
- `profiles(id=auth.uid, pseudo)` — pseudo affiché du membre.
- `teams(id, owner=auth.uid, pseudo, data jsonb, created_at, updated_at)` —
  `data` = l'équipe complète (même forme que `normalizeTeam()` actuelle :
  `{heroes:[4×{char,weapon,armor{},jewel{},potentiel,note}], ...}`).
- `recensement(owner=auth.uid PK, pseudo, dps jsonb)` — `dps` = `[{char, element, pot}]`
  (même forme que le module Recensement actuel).
- RLS : **lecture par tout membre connecté**, **écriture uniquement de ses propres
  lignes** (`owner = auth.uid()`).

## Plan d'implémentation réalisé (app — `index.html`)
Charger le client (après `supabase-config.js`) :
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
```
Puis dans le script app :
```js
const sb = window.supabase.createClient(window.SB_URL, window.SB_KEY);
```

1. **Écran de connexion (gate)** : overlay au chargement si pas de session.
   - Champs : email, mot de passe, (+ pseudo pour l'inscription).
   - Boutons : « Se connecter » → `sb.auth.signInWithPassword({email,password})` ;
     « Créer un compte » → `sb.auth.signUp({email,password})` puis upsert du
     `profiles.pseudo`. (Pas de confirmation email → session directe.)
   - Afficher le pseudo connecté + bouton « Déconnexion » (`sb.auth.signOut()`).
   - `sb.auth.onAuthStateChange(...)` pour réagir login/logout.
2. **Bascule des données vers le cloud** (remplacer le localStorage pour ces 2 features
   quand connecté ; garder localStorage comme cache/offline optionnel) :
   - **Teams** : remplacer `Store` (teams) par des appels Supabase :
     - lire toutes : `sb.from('teams').select('*').order('updated_at',{ascending:false})`
       → alimente `renderRoster()` / `openTeamDetail()`.
     - créer/màj : `sb.from('teams').upsert({id, owner:user.id, pseudo, data, updated_at})`.
     - supprimer : `sb.from('teams').delete().eq('id', id)` (RLS bloque si pas owner).
     - « Modifier » n'est autorisé que sur ses équipes (owner). Afficher les autres en lecture seule.
   - **Recensement** : remplacer `Rec` par la table `recensement` (une ligne = le membre courant).
     - lire toutes (tous les membres) pour l'Analyse : `sb.from('recensement').select('*')`.
     - upsert de SA ligne quand il modifie ses DPS :
       `sb.from('recensement').upsert({owner:user.id, pseudo, dps, updated_at})`.
     - `renderAnalyse()` agrège TOUTES les lignes (déjà écrit pour parcourir une liste de joueurs :
       adapter `players` = lignes `recensement` {pseudo, dps}).
   - Rendre `renderRoster/renderRecensement/renderAnalyse` **async** (await des fetch),
     ajouter des états de chargement simples.
3. **Migration** : bouton « Importer mes données locales » (one-shot) qui pousse les
   `confrerie7ds.teams` / `confrerie7ds.recensement` du localStorage vers Supabase
   (owner = user courant). Garder aussi l'Export/Import JSON existant.
4. **Builder** : composer sans être connecté reste possible ; « Enregistrer l'équipe »
   exige la connexion (sinon inviter à se connecter).

## Notes techniques
- Le format de clé `sb_publishable_...` fonctionne avec supabase-js v2 récent (CDN ci-dessus).
  En cas de souci, l'onglet « Legacy anon, service_role API keys » de Supabase donne
  une clé `anon` JWT classique en repli.
- Site déployé : GitHub Pages `https://yanniss13.github.io/N-VA/` (branche `main`).
  Pages n'a pas de CSP stricte → charger le CDN supabase-js et appeler l'API OK.
- Tester : l'utilisateur doit d'abord lancer le SQL + désactiver Confirm email.
  Le flux auth ne se teste pas via Playwright sans vrai compte ; tester à la main
  (inscription → créer une équipe → 2ᵉ compte voit l'équipe).
- Ne pas casser l'existant : `npm test` doit continuer à passer (les tests actuels
  ciblent le builder/potentiel en local, pas le cloud).

## Fichiers concernés
- `supabase-config.js` (créé) — URL + clé publique.
- `supabase/schema.sql` (créé) — tables + RLS.
- `index.html` — modifié : client + gate + équipes, recensement/analyse et migration.
- `AGENTS.md` — pointera vers ce doc.
