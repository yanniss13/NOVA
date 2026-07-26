# Site Confrérie 7DS — Team Builder (Boss de Guilde)

Outil web statique collaboratif pour que les membres d'une confrérie **7DS Origin** construisent des
équipes (perso + arme + armures + notes) et les affichent sur une page
**« Équipes dispo pour le Boss de Guilde »**.

> Ce fichier est le point d'entrée pour tout agent (Codex, Claude, etc.) qui
> reprend le projet. Lis-le en entier avant de coder.

## État actuel — 2026-07-26

- [x] Assets rangés dans des dossiers (fournis par l'utilisateur, ne pas renommer).
- [x] `generate-data.ps1` — scanne les dossiers et génère `data.js`.
- [x] `data.js` — données d'assets générées (24 persos, 12 types d'armes, 5 armures).
- [x] `index.html` — appli complète (builder + page d'affichage), autonome.
- [x] Bijoux **SSR uniquement** (grade5) : 34 images intégrées
      (11 anneaux, 12 colliers, 11 boucles d'oreilles) — correspond aux badges
      « SSR » du site. Source : `https://7dsorigin.app/images/items/<gameId>.webp`
      (gameId lu dans le JSON embarqué de `7dsorigin.app/fr/bijoux`, filtré sur
      `grade == grade5`, `displayName` = nom de fichier, `slot`
      Ring/Necklace/Earring → dossier Anneau/Collier/Boucle d'oreille).
- [x] Potentiels : palier T0→T10 par héros, façon page team-builder du site.
      Données FR (24 persos × ~3 types d'arme × 10 paliers) dans `potentiels.js`,
      régénérable via `generate-potentiels.py`. Le palier est **commun au héros** ;
      les 3 clés d'armes par héros déterminent les armes compatibles et l'arme
      équipée choisit les descriptions de bonus affichées.
- [x] Compatibilité des armes : le picker ne propose que les 3 types autorisés
      du héros. Toute arme incompatible est automatiquement retirée.
- [x] Compatibilité des armures liées : 66 images locales associées aux 24 héros
      (2 ou 3 par héros). Le picker filtre selon le personnage et retire les
      anciennes valeurs incompatibles.
- [x] Badges **élément + armes** par personnage. `personnages-meta.js`
      (`generate-meta.py`) : role/rarity + `weapons` = 3 slots
      `{weapon, role, element}`. ⚠️ L'élément **dépend de l'arme équipée**
      (chaque slot a son élément) — ne PAS afficher `meta.element` fixe.
      `badgesRow(ch, hero, compact)` : la pastille d'élément et le surlignage
      suivent l'arme équipée (`FOLDER_TO_ENUM` mappe le dossier → enum du slot).
      Builder = 3 armes (équipée surlignée, autres estompées) ; roster = seule
      l'arme équipée. Icônes locales `7ds-ui/mastery/<arme>.webp` (12) +
      `role-elements/<element>_<role>.webp` (30), depuis `7dsorigin.app/images/ui/`.
- [x] Roster épuré : les cartes d'équipe ne montrent plus les icônes
      d'équipement (portrait, nom, badge d'arme équipée, potentiel, note).
      Clic sur la carte / bouton « Voir l'équipement » → modal `#teamOverlay`
      (`openTeamDetail`/`heroDetail`/`equipLine`) avec l'équipement complet
      (arme + 5 armures + 3 bijoux, noms) par héros.
- [x] **Partage réseau (Supabase) — Étape 1 implémentée**. Comptes + équipes +
      recensement/analyse partagés. Auth email/mot de passe, ownership par RLS,
      cache hors ligne séparé et migration one-shot des anciennes données locales.
      👉 **Codex : lis `docs/superpowers/specs/2026-07-25-supabase-etape1-handoff.md`**
      (contexte, modèle de données et manips Supabase restantes).
      Fichiers : `supabase-config.js`, `supabase/schema.sql`.
      Auth validée = email + mot de passe SANS confirmation email.
- [x] **Roster persistant des membres**. Une fiche par personnage et par compte,
      avec potentiel commun T0–T10 et au maximum un build par type d'arme
      compatible. Tous les membres connectés peuvent consulter les fiches ;
      seul leur propriétaire peut les créer, modifier ou supprimer. Un build
      peut être copié vers le Team Builder ou importé explicitement depuis une
      équipe propriétaire, toujours sous forme d'instantané indépendant. Un
      build peut être marqué favori et son équipement copié vers un autre type
      d'arme compatible.
- [x] **Synchronisation Realtime** des équipes, rosters, profils et sessions de
      boss. Une seule chaîne par membre actualise la vue partagée concernée,
      avec regroupement des événements rapprochés.
- [x] **Mobile et accessibilité**. Onglets au clavier, pile de modales avec
      piège/restitution du focus, cibles tactiles de 44 px et vues sans
      débordement horizontal entre 320 et 390 px.
- [x] **CI GitHub Pages et mises à jour PWA choisies**. `npm test` garde le
      déploiement ; une nouvelle version attend l'accord du membre.
      Voir « Publication GitHub Pages » et « Cycle de mise à jour PWA ».

Après cette mise à jour, l'utilisateur doit rejouer le contenu complet de
`supabase/schema.sql` dans le SQL Editor Supabase afin d'appliquer le schéma,
les politiques RLS et la publication Realtime. Le script est idempotent.

L'appli reste un site statique ouvrable en `file://` ou via GitHub Pages. Une
connexion internet et un compte sont nécessaires pour lire/écrire le registre
partagé. Sans connexion, le builder reste utilisable, mais « Enregistrer l'équipe »
ouvre la connexion. Les anciennes données locales et les caches cloud restent dans
le `localStorage`.

## Comment lancer

Double-clic sur `index.html` ou ouvrir le site GitHub Pages. Aucun serveur, aucune
install, aucun build. Le builder fonctionne hors ligne ; Supabase exige internet.

Pour les tests de développement uniquement :

```powershell
npm test
```

Playwright et Chromium sont des outils de vérification ; l'application livrée
reste autonome et ne dépend pas de npm.

## Structure du dépôt

```
Site Confrérie 7ds/
├─ index.html              # L'appli + auth/store Supabase. Charge les données locales et le client CDN.
├─ sw.js                   # Service worker. Cache versionné par __BUILD_VERSION__, mise à jour explicite.
├─ .github/workflows/pages.yml         # Tests de toute contribution + déploiement Pages du seul `main` testé.
├─ .github/workflows/boss-reminder.yml # Rappel Discord (secrets propres). Indépendant du déploiement.
├─ supabase-config.js      # URL + clé publique publishable (jamais de service_role).
├─ supabase/schema.sql     # Tables partagées, RPC boss, RLS et publication Realtime.
├─ package.json            # Scripts de test Node + Playwright (développement uniquement).
├─ package-lock.json       # Versions verrouillées des dépendances de test.
├─ tests/                  # Régressions du builder + parcours Supabase simulé dans Chromium.
├─ data.js                 # GÉNÉRÉ. window.SEVEN_DS_DATA = { personnages, armes, armures, bijoux }.
├─ generate-data.ps1       # Régénère data.js en scannant les dossiers d'images.
├─ potentiels.js           # GÉNÉRÉ. 3 armes compatibles + bonus par héros.
├─ generate-potentiels.py  # Régénère potentiels.js depuis 7dsorigin.app (internet requis).
├─ armures-liees.js        # GÉNÉRÉ. Fichiers d’armure liée par personnage.
├─ generate-armures-liees.py # Régénération manuelle depuis la page publique.
├─ personnages-meta.js     # GÉNÉRÉ. element/role/rarity + weapons[] par personnage.
├─ generate-meta.py        # Régénère personnages-meta.js depuis 7dsorigin.app.
├─ 7ds-ui/                 # Icônes d'UI : mastery/<arme>.webp, role-elements/<el>_<role>.webp
├─ AGENTS.md               # Ce fichier.
├─ docs/superpowers/specs/ # Spec de design détaillée.
├─ 7ds-personnages/        # <id>.webp  (ex. meliodas.webp)
├─ 7ds-armes/<Type>/       # 12 dossiers de types d'armes, *.webp
├─ 7ds-armures-ssr/<Slot>/ # Haut, Bas, Bottes, Ceinture, Armure liee — *.webp
└─ 7ds-bijoux/<Slot>/      # Anneau, Collier, Boucle d'oreille — *.webp (vides pour l'instant)
```

## Règle d'or sur les assets

**On ne hardcode JAMAIS la liste des images dans `index.html`.**
Les assets proviennent de `window.SEVEN_DS_DATA`, régénéré via
`generate-data.ps1` lorsque l'utilisateur ajoute ou retire des images. La
compatibilité des armures liées provient de `window.SEVEN_DS_ARMURES_LIEES`.

Pourquoi un fichier généré et pas un scan JS direct ? En `file://`, JavaScript ne
peut pas lister le contenu d'un dossier. `data.js` contourne ça sans serveur.

### Forme de `window.SEVEN_DS_DATA`
```js
{
  generatedAt: "AAAA-MM-JJ HH:mm:ss",
  personnages: [ { id, name, file } ],          // file = chemin relatif .webp
  armes:   { "<Libellé type>": [ { name, file } ] },   // groupé par type
  armures: { "Haut": [ { name, file } ], "Bas": [...], "Bottes": [...],
             "Ceinture": [...], "Armure liee": [...] }, // groupé par emplacement
  bijoux:  { "Anneau": [ { name, file } ], "Collier": [...],
             "Boucle d'oreille": [...] }  // groupé par emplacement (peut être vide)
}
```

### Armures liées (`window.SEVEN_DS_ARMURES_LIEES`, depuis `armures-liees.js`)
```js
window.SEVEN_DS_ARMURES_LIEES = {
  "<charId>": [
    "7ds-armures-ssr/Armure liee/<nom>.webp"
  ]
};
```

`generate-armures-liees.py` régénère cet instantané uniquement lorsqu’il est
lancé manuellement avec `python generate-armures-liees.py`. Il lit la page
publique de référence en une requête, sans télécharger aucune image. Il ne
s’exécute jamais dans le navigateur : `index.html` ne charge que
`armures-liees.js` local et ne contacte donc jamais cette source.

`normalizeHero()` refuse une valeur de `armor["Armure liee"]` si son fichier
n’appartient pas au tableau du héros. Les quatre emplacements universels
`Haut`, `Bas`, `Bottes` et `Ceinture` ne sont pas filtrés par cette règle.

## Modèle de données d'une équipe (Supabase + cache local)

Table Supabase : `teams(id, owner, pseudo, data, created_at, updated_at)`.
`data` conserve la forme historique ci-dessous. La clé locale
`confrerie7ds.teams` reste la source de migration/backup ; le cache des lignes
cloud utilise `confrerie7ds.cloud.teams`.

```js
{
  id: "uuid",
  pseudo: "NomDuMembre",
  boss: "",                 // réservé (non utilisé dans l'UI actuelle)
  createdAt: 1690000000000,
  updatedAt: 1690000000000,
  heroes: [                 // TOUJOURS 4 entrées (slot vide = char null)
    {
      char: "meliodas" | null,        // id de personnage
      weapon: "7ds-armes/.../x.webp" | null, // forcément compatible avec char
      armor: { "Haut": file|null, "Bas": file|null, "Bottes": file|null,
               "Ceinture": file|null, "Armure liee": file|null },
      jewel: { "Anneau": file|null, "Collier": file|null,
               "Boucle d'oreille": file|null },
      potentiel: { tier: 0..10 },
      note: "texte libre"
    }
    // x4
  ]
}
```

### Potentiels (`window.SEVEN_DS_POTENTIELS`, depuis `potentiels.js`)
```js
{ "<charId>": { "<dossier d'arme>": [ "<bonusFr T1>", ... "<T10>" ] } }
// dossier d'arme = segment de chemin de hero.weapon (ex. "Hache", "Epee 1 main").
// bonusFr contient un balisage couleur [#RRGGBB]texte[-] rendu par renderBonus().
// Les 3 sous-clés sont les armes compatibles du héros.
// L'arme équipée choisit la liste affichée ; le palier stocké reste commun au héros.
```

Constantes utiles dans `index.html` : `STORAGE_KEY`, `TEAM_SIZE` (= 4),
`ARMOR_SLOTS`, `JEWEL_SLOTS` (ordre d'affichage des emplacements).
`Store`, `editTeam()` et l'import normalisent les anciennes équipes : ajout des
champs d'équipement manquants et migration de l'ancien potentiel
`{ weaponType, tier }` vers `{ tier }`. `normalizeHero()` retire aussi toute arme
dont le dossier n'appartient pas aux 3 clés de potentiel du personnage, ainsi
que toute armure liée incompatible avec le héros.

Connecté, `Store.refresh/upsert/remove` utilise Supabase et ne montre les actions
Modifier/Supprimer que si `team.owner === currentUser.id`. Déconnecté, le builder
reste accessible mais la sauvegarde exige l'authentification.

Le recensement partagé utilise une ligne Supabase par compte :
`recensement(owner, pseudo, dps, updated_at)`. Tous les membres connectés lisent
toutes les lignes pour l'Analyse ; seul le propriétaire modifie sa fiche. Le cache
cloud local est `confrerie7ds.cloud.recensement`.

## Modèle du roster persistant

Table Supabase :
`roster_characters(owner, char_id, potential_tier, builds, updated_at)`.
La clé primaire composée `(owner, char_id)` garantit une seule fiche par
personnage et par membre. Le cache local partagé est
`confrerie7ds.cloud.roster`.

```js
{
  owner: "uuid-du-membre",
  charId: "meliodas",
  potentialTier: 0..10,
  builds: {
    "Hache": {
      weapon: "7ds-armes/Hache/x.webp" | null,
      armor: { "Haut": file|null, "Bas": file|null, "Bottes": file|null,
               "Ceinture": file|null, "Armure liee": file|null },
      jewel: { "Anneau": file|null, "Collier": file|null,
               "Boucle d'oreille": file|null },
      note: "texte libre",
      favorite: true | false
    }
  },
  updatedAt: 1690000000000
}
```

Les clés de `builds` sont uniquement les dossiers présents dans
`window.SEVEN_DS_POTENTIELS[charId]`. Une clé représente au maximum une
configuration modifiable pour ce type d'arme ; les configurations partielles
sont autorisées. `MemberRosterStore` lit le roster de tous les membres mais
n'écrit que celui de `currentUser`. Les politiques RLS appliquent la même règle
côté Supabase. Toute copie vers une équipe passe par `rosterHeroSnapshot()` et
ne reste pas liée à la fiche source.

Chaque personnage possède au maximum un build favori. Le champ `favorite` est
stocké dans l'objet du type d'arme ; les anciens builds sont normalisés à
`false`. La copie du favori transfère les armures, les bijoux et la note,
conserve l'arme de destination et ne crée jamais un second favori.

## Synchronisation Supabase Realtime

Une chaîne `confrerie-live-<userId>` écoute `profiles`, `teams`,
`roster_characters`, `boss_sessions` et `boss_participation`. Les événements
sont regroupés puis seule la vue active concernée est relue. Le Recensement et
l'Analyse réagissent au roster et aux profils, car ils sont entièrement dérivés.

Après déploiement de cette fonction, rejouer `supabase/schema.sql` une fois dans
le SQL Editor afin d'ajouter les tables à la publication
`supabase_realtime`. Le bloc est idempotent.

## Décisions de conception (ne pas casser sans raison)

- **4 personnages** par équipe (format boss de guilde). Voir `TEAM_SIZE`.
- Équipement par héros : 1 arme + 5 armures + **3 bijoux** (Anneau, Collier,
  Boucle d'oreille), calqués sur les 3 catégories du site de référence.
- Chaque équipe porte un **pseudo de membre** (seule métadonnée demandée).
- **Potentiel** par héros : un palier commun T0–T10, indépendant de son arme.
  L'arme équipée choisit seulement les descriptions officielles affichées.
  `renderBonus()` rend leur balisage couleur. Pas de calcul de stats.
- **Pas de calcul de stats chiffrées** : aucune donnée de stats n'existe dans les
  assets. Le « détail » d'un perso = arme + 5 armures + une note libre.
- Arme choisie en 2 temps : type puis arme. Le picker filtre les groupes aux
  3 types autorisés par les clés de `window.SEVEN_DS_POTENTIELS[charId]`.
- Export / Import JSON = sauvegarde de secours et format pivot indépendant de Supabase.
- Auth Supabase : email + mot de passe sans confirmation email. Toute lecture
  partagée exige un membre authentifié ; RLS limite l'écriture au propriétaire.

## Groupes de Boss de Guilde (onglet « Groupes de boss »)

- **6 groupes ouverts simultanément chaque semaine** (reset lundi 9h), boss
  *Akumu, bête démoniaque*. `BossStore.ensureWeek` crée uniquement les runs n°1
  avec un `upsert` sur `(week_start, slot, run_no)`.
- Chaque membre dispose de **3 runs par semaine**. Rejoindre une run ouverte la
  réserve ; quitter la run ouverte la libère. Les participations archivées sont
  définitives.
- **Rejoindre/Quitter est optimiste** : la participation, la carte et le
  compteur changent avant la réponse RPC. `bossPendingActions` protège les
  doubles clics et se superpose aux rechargements Realtime silencieux. Une
  erreur annule uniquement l’intention locale concernée. `Run terminée`
  conserve un rechargement complet.
- Tout membre du groupe peut cliquer « Run terminée ». La RPC
  `complete_boss_run` archive la session et ses participants, puis crée
  immédiatement la run suivante, vide, pour le même groupe.
- Les écritures passent par `join_boss_run`, `leave_boss_run` et
  `complete_boss_run`. Les politiques RLS interdisent les écritures directes
  dans `boss_participation` et la modification directe des sessions.
- Semaine courante = `currentBossWeek()` (lundi 9h Paris le plus récent ≤ maintenant).
- **Rappel Discord** : dimanche midi Paris (`scripts/discord-reminder.js` + GitHub Actions),
  liste les membres sous `3/3` et le nombre de runs manquantes.
  Voir `docs/superpowers/specs/2026-07-25-boss-trois-runs-design.md`.
- Après une modification de ce schéma, réexécuter le contenu complet de
  `supabase/schema.sql` dans le SQL Editor Supabase.

## Publication GitHub Pages

`.github/workflows/pages.yml` est le seul workflow qui publie le site.

- Une **pull request** vers `main` exécute uniquement le job `test` : `npm ci`,
  installation de Chromium puis `npm test`. Elle ne déploie jamais.
- Un **push vers `main`** exécute `test`, puis `package` (`needs: test`), puis
  `deploy` (`needs: package`). Si `npm test` échoue, aucun déploiement n'a lieu
  et l'ancienne version Pages reste en ligne.
- `workflow_dispatch` permet de relancer un déploiement à la main.

Le job `package` reconstruit `_site` avec `git archive HEAD`, donc **seuls les
fichiers suivis par Git** sont publiés : jamais `node_modules`, jamais les
worktrees, jamais un fichier local non suivi. Il remplace ensuite
`__BUILD_VERSION__` par `${GITHUB_SHA}` dans `_site/sw.js` uniquement, puis
échoue volontairement si le marqueur est absent ou subsiste.

Le workflow Pages **n'a besoin d'aucun secret** : il ne touche pas à Supabase.
`boss-reminder.yml` reste séparé, avec son propre calendrier et ses propres
secrets — ne pas le modifier pour des raisons de déploiement.

**Réglage manuel unique** (une seule fois, après la fusion) :
`Settings → Pages → Build and deployment → Source → GitHub Actions`.

## Cycle de mise à jour PWA

Le SHA du commit déployé devient la version du cache : `sw.js` garde le
marqueur littéral `__BUILD_VERSION__` dans le dépôt et
`CACHE = CACHE_PREFIX + BUILD_VERSION`. **Ne pas remplacer ce marqueur à la
main** ; l'Action l'injecte dans la copie publiée. Chaque commit publié produit
donc un nouveau cache, sans « bump » manuel oublié.

`sw.js` n'appelle plus `skipWaiting()` pendant `install`. Une nouvelle version
reste en attente et `index.html` affiche le bandeau `#pwaUpdateBanner`
(« Nouvelle version disponible » + **Mettre à jour** + fermeture accessible).
Le clic envoie `{type:"SKIP_WAITING"}` au worker en attente, attend
`controllerchange`, puis recharge la page **une seule fois** (garde
`activationRequested` + `reloadStarted`). Fermer le bandeau ne refuse pas la
version : elle peut réapparaître après un rechargement.

Une première installation ne montre aucun bandeau et son `clients.claim()` ne
doit jamais provoquer de rechargement. Les navigations et les fichiers
applicatifs (`CORE_PATHS`) sont `network-first` ; seules les images locales
restent en `stale-while-revalidate`. Supabase et le CDN jsDelivr ne sont jamais
mis en cache.

## Accessibilité et mobile

Les onglets principaux suivent le motif ARIA et se pilotent avec les flèches,
Début et Fin. Toutes les modales passent par `ModalStack`, qui gère la pile, le
piège à focus, Échap et la restitution du focus. Ne pas réintroduire d'écouteurs
Échap locaux. Sur écran tactile, les contrôles principaux restent à 44 × 44 px
minimum et aucune vue ne doit élargir le document.

## Évolutions prévues

- Champ **note globale d'équipe** (déjà réservé dans le modèle).

## Conventions

- Français partout dans l'UI.
- La logique applicative reste inline dans `index.html` (pas de build). Les seules
  exceptions runtime sont `supabase-config.js` et le client Supabase chargé par CDN.
- Thème : héraldique sombre (obsidienne + or vieilli + pourpre). Voir la spec.
- Après modif des dossiers d'images : relancer `generate-data.ps1`.
