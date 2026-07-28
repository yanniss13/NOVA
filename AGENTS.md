# Site Confrérie 7DS — Team Builder (Boss de Guilde)

Outil web statique collaboratif pour que les membres d'une confrérie **7DS Origin** construisent des
équipes (perso + arme + armures + notes) et les affichent sur une page
**« Équipes dispo pour le Boss de Guilde »**.

> Ce fichier est le point d'entrée pour tout agent (Codex, Claude, etc.) qui
> reprend le projet. Lis-le en entier avant de coder.

## État actuel — 2026-07-27

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
- [x] **Rapports de runs du boss**. Groupes limités à 1–5 membres, équipe
      propriétaire obligatoire avec instantané immuable, score global obligatoire
      et note facultative. Les participants archivés peuvent corriger le rapport
      sans modifier la composition; `boss_run_reports` et les RPC associées sont
      synchronisés par Realtime. Les anciennes archives sans rapport restent
      lisibles.
- [x] **Mobile et accessibilité**. Onglets au clavier, pile de modales avec
      piège/restitution du focus, cibles tactiles de 44 px et vues sans
      débordement horizontal entre 320 et 390 px.
- [x] **CI GitHub Pages et mises à jour PWA choisies**. `npm test` garde le
      déploiement ; une nouvelle version attend l'accord du membre.
      Voir « Publication GitHub Pages » et « Cycle de mise à jour PWA ».
- [x] **Tableau de bord personnel « Mon suivi »**. Vue Boss orientée actions,
      affichée par défaut après connexion : runs engagées/terminées/en cours,
      équipe manquante, accès ciblé au groupe ou au rapport et urgence calculée
      en heure de Paris. État dérivé des tables existantes, sans migration
      Supabase. Cache hors ligne séparé par compte et semaine.
- [x] **Stats de builds — lot 1, arme de bout en bout**. Grade, niveau,
      promotion, outrepassement et enchantements sont configurables dans le
      roster et le Team Builder. Le moteur local expose une décomposition
      reconstructible et affiche uniquement « Apport de l’arme — calcul
      partiel ». Les armures et les stats finales du héros restent hors
      couverture.

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
├─ supabase/rollback-boss-reports.sql # Retour arrière fonctionnel, non destructif des rapports de boss.
├─ package.json            # Scripts de test Node + Playwright (développement uniquement).
├─ package-lock.json       # Versions verrouillées des dépendances de test.
├─ tests/                  # Régressions du builder + parcours Supabase simulé dans Chromium.
├─ tests/helpers/load-app.js # Charge le script inline d'index.html dans `vm` et expose ses fonctions pures.
├─ data.js                 # GÉNÉRÉ. window.SEVEN_DS_DATA = { personnages, armes, armures, bijoux }.
├─ stats-build.js          # GÉNÉRÉ. Catalogue chiffré local des seules armes du lot 1.
├─ generate-stats-build.py # Régénère/valide stats-build.js depuis les références locales.
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

## Perle de sortilège (enchantement d'arme haut de gamme)

Ce que les données de 7dsorigin appellent `type:"masterstone"` — et que leur site
traduit par « Pierre maîtresse » — s'appelle en jeu **« Perle de sortilège »**.
Leur propre champ `pearlEnchant` confirme « perle ». Utiliser le nom du jeu dans
l'interface.

Chaque palier a un nom de rareté et **ouvre un nombre d'emplacements de stat
différent** :

| Palier | Nom | Emplacements |
| --- | --- | --- |
| 1 | Commune | 1 |
| 2 | Remarquable | 2 |
| 3 | Rare | 2 |
| 4 | Héroïque | 3 |
| 5 | Légendaire | 4 |

⚠️ **Cette table ne vient pas des données.** Les `tiers[].options` de 7dsorigin ne
listent que les stats possibles, jamais le nombre d'emplacements. Elle vient du
propriétaire, qui joue au jeu. Ne la « corrige » pas d'après `stats-build.js` : la
source de vérité est `PEARL_TIERS` dans `index.html`.

Quatre règles du modèle :

- le **palier et l'élément appartiennent à la perle entière**, pas à chaque
  emplacement. Toutes les entrées renseignées doivent partager les deux, sinon la
  configuration est `incompatible` — sans cette contrainte, deux perles de paliers
  différents sur la même arme passeraient pour valides ;
- changer de palier **reconstruit** le tableau `enchantments` à la longueur du
  nouveau palier ;
- un tableau **plus long** que le palier est `incompatible`. **Plus court**, c'est
  `incomplete` : soit une saisie en cours, soit une configuration enregistrée
  avant que les paliers ouvrent plusieurs emplacements. Ne jamais la déclarer
  invalide, sinon les données déjà en base seraient condamnées ;
- `incompatible` **prime** sur `incomplete` : une stat interdite ou une valeur
  hors bornes reste invalide même dans un tableau encore court. Le contenu est
  donc validé avant la longueur ;
- **la même stat ne peut pas occuper deux emplacements** d'une même perle — le
  jeu l'interdit, information confirmée par le propriétaire. Les emplacements
  encore vides ne comptent pas comme doublons, sinon toute saisie en cours serait
  refusée. L'interface ne propose pas une stat déjà posée ailleurs, et la
  validation la refuse quand même : empêcher l'état interdit **et** le détecter.

Cette distinction ne vaut que pour la perle. Pour un enchantement `basic`, le
nombre d'emplacements est fixé par les données : toute longueur différente est
`incompatible`.

## Stats de référence (`7ds-stats/`)

Données chiffrées du jeu, extraites de 7dsorigin.app par `generate-stats.py`.
**Aucun de ces JSON n'est chargé par `index.html`** : ce sont des fichiers de
référence pour générer `stats-build.js`, pas des données d'exécution. Ne les
précache pas.

| Fichier | Contenu |
| --- | --- |
| `personnages.json` | 24 personnages : `baseHp/baseAtk/baseDef/baseSpd`, précision, blocage, crit (taux, dégâts, résistances), PvP, `weaponSlots`, 15 niveaux de maîtrise, 30 paliers de potentiel, costumes |
| `armes.json` | 142 armes, 262 variantes de grade : `mainStat`, `subStats` (`base`, `max`, `progression`), enchantements, passifs |
| `armures.json` | 229 pièces sur 7 emplacements × 5 grades : `mainStat`, `subStat`, `setId`, `reinforceMax`, qualité, `growth` |
| `armures-gravees.json` | 83 équipements gravés, rapprochés de leur costume et de leur personnage, avec passifs de gravure et matériaux |
| `enchantements.json` | 181 tables basiques, 81 tables de pierre maîtresse, 67 armures, 83 armures gravées |
| `sets.json` | 21 ensembles avec bonus 2 et 4 pièces |
| `libelles-stats.json` | 71 codes de stat → libellés FR/EN, `taux`, libellé court |
| `stat-metadata.json` | Métadonnées explicites `{family, unit}` des codes émis |

Quatre points à ne pas réapprendre à la dure :

- **`robots.txt` de 7dsorigin.app interdit `/api/`** à tous les agents, `ClaudeBot`
  nommément. Le générateur ne tape donc jamais l'API : il lit le payload RSC que
  la page `/fr/team-builder/create` embarque déjà (`self.__next_f.push`), ce qui
  ne demande qu'un GET, sans navigateur ;
- les options aléatoires d'une pièce vivent dans **`growth.randomOptions`**, pas à
  la racine de l'objet. Chercher `item.randomOptions` renvoie toujours vide, et
  les 152 occurrences de ce mot dans le payload sont surtout des libellés
  d'interface ;
- seules **67 des 229** armures ont des options aléatoires (les hauts grades),
  contre **83 sur 83** pour les gravées. Un compte partiel n'est pas un bug ;
- les codes de stat ont deux sources de libellés : les objets `{stat, nameFr}`
  répartis dans l'arbre, et un dictionnaire court `statLabels`
  (« ATK », « Perforation ») qui couvre 8 codes absents des premiers. Il faut
  fusionner les deux, sinon des codes restent sans nom.

Le palier 5 des pierres maîtresses se découpe par élément (`generic`, `default`
puis les 7 éléments) : sa forme diffère des paliers 1 à 4.

## Configuration chiffrée des armes — lot 1

### Catalogue local et données persistées

`generate-stats-build.py` rapproche les images locales des armes de référence et
génère `stats-build.js`, qui pose `window.SEVEN_DS_BUILD_STATS`. La commande de
référence est :

```powershell
python generate-stats-build.py
```

Le rapprochement tient compte du type d'arme, échoue sur une absence ou une
ambiguïté et ne contient aucune liste d'assets écrite à la main. Le catalogue
est chargé par une balise `<script>` classique et précaché comme ressource
essentielle : le calcul fonctionne donc en `file://` et hors ligne. Les JSON
`7ds-stats/*.json` ne sont jamais chargés par le navigateur ni par le service
worker.

Les paramètres, jamais les résultats calculés, vivent dans les JSONB existants :
`teams.data.heroes[x].weaponConfig` et
`roster_characters.builds[weaponType].weaponConfig`.

```js
weaponConfig: {
  version: 1,
  gradeGameId: "131065010",
  level: 50,
  promotion: 4,
  overlimit: 6,
  enchantments: [
    {
      slot: 0,
      tier: 5,
      element: "thunder",
      stat: "I_AtkAdd_Rate",
      value: 787
    }
  ]
}
```

`enchantments` est positionnel. Une entrée `null` signifie explicitement
« emplacement laissé vide » et permet à une saisie complète de rester valide.
Un champ ancien absent est normalisé à `weaponConfig:null`, sans inventer de
grade ou de niveau.

`weaponConfigStatus(weaponFile, config)` possède exactement cinq états :

- `missing` — arme connue, configuration absente ;
- `incomplete` — structure reconnue, saisie non terminée ;
- `valid` — tous les choix et toutes les bornes sont valides ;
- `unavailable` — l'arme locale n'existe pas dans le catalogue ;
- `incompatible` — configuration corrompue ou version inconnue.

Seul `valid` produit des chiffres. Tous les autres états conservent l'équipement
mais masquent le calcul : un ancien build dit « Configuration à compléter »,
jamais `0`. Une source non couverte ne doit jamais être présentée comme un vrai
zéro.

### Formules d'arme et métadonnées

Pour une courbe `{base, progression}`, chaque entrée de `progression` est un
gain par niveau sur un segment de dix niveaux :

```text
valueAtLevel(curve, level) =
  base + Σ progression[i] × clamp(level - 10×i, 0, 10)
```

La **promotion** utilise uniquement `promotionValues` :

```text
promotionValue(n) =
  promotionValues.base + Σ promotionValues.progression[0..n-1]
```

Le contrôle et les termes doivent donc s'appeler « Promotion », jamais
« Renforcement ». Les plafonds de niveau 10/20/30/40/50 sont dérivés
exclusivement de `promotionSteps[].reinforceMax` : le palier zéro vaut dix
niveaux de moins que le premier plafond, puis chaque étape ouvre son plafond.
Les armes n'ont aucun `growthType:"reinforce"` et n'utilisent jamais la
progression multiplicative `[10300,10700,11200,11800,12500]`, propre aux
armures.

Chaque code émis possède des métadonnées explicites
`{fr, family, unit}`. Les familles sont `main`, `additional`, `damage`,
`special` et `elemental`; les unités autorisées sont `flat` et
`ten-thousandths`. Ne jamais déduire l'unité depuis le nom du code ni depuis le
drapeau incomplet `taux` de `libelles-stats.json`.

L'outrepassement est multiplicatif. Les taux connus sont
`0/500/1000/1750/2500/3750/5000` en dix-millièmes, donc `500 = +5 %` et le
facteur exact vaut `1 + statRate/10000`. Sa base d'application est présumée :
`OVERLIMIT_APPLICATION_MODE` vaut actuellement
`"native-before-enchantments"`. Une seule fonction traduit ce mode en seaux
ciblés.

Protocole de validation dans le vrai jeu : relever l'ATK d'une même arme
enchantée aux outrepassements 0 puis 1. Si le gain de 5 % inclut les
enchantements, remplacer uniquement le mode par
`"native-and-enchantments"`. Le taux est exact ; seule la base porte la
présomption et l'interface l'annonce par
« Outrepassement ×1,05 — base présumée ».

### Contrat du moteur et rendu

`calculateWeaponStats()` ne renvoie jamais un nombre isolé. Sa sortie canonique
contient :

- `coverage` — domaines entièrement calculés ;
- `terms` — contributions typées et leur provenance ;
- `totals` — commodité reconstruite depuis les termes ;
- `facts` — informations non numériques, par exemple le niveau de passif ;
- `assumptions` — hypothèses actives nécessaires pour reproduire le résultat.

Une arme valide déclare `coverage:["weapon"]`; tout autre état déclare `[]`.
Quand un domaine est couvert, l'absence d'un terme pour une statistique est un
vrai zéro de ce domaine. Quand il ne l'est pas, son apport n'est simplement pas
encore calculé.

Chaque terme porte un `stat` concret, une `unit`, une `confidence`, une
provenance et :

- `operation:"add"` avec un `bucket` pour une contribution additive ;
- `operation:"multiply"` avec `unit:"ten-thousandths"` et `appliesTo` pour les
  seaux ciblés.

La reconstruction est pilotée par les seaux, sans ordre de domaines codé en
dur : sommer les additifs par seau, appliquer chaque multiplicateur à la somme
des seuls seaux de `appliesTo`, puis additionner les seaux et les contributions
multiplicatives. Pour chaque statistique, `totals` doit être **strictement
égal** au résultat reconstruit depuis `terms`; les totaux ne constituent jamais
une seconde source de vérité.

Tant que seule l'arme est couverte, tout rendu porte exactement le titre
**« Apport de l'arme — calcul partiel »**. Il est interdit d'afficher
« stats du héros » ou « total du héros ». Le panneau partagé permet la saisie
dans le roster et le Team Builder; les autres rosters, détails d'équipe et
archives de boss restent en lecture seule.

### Inconnue réservée au futur lot armures

Ne jamais créer de table pour `equiplv_N` : cet identifiant est redondant. Le
nombre de segments d'une armure se dérive de l'objet :

```text
nombreDeSegments = max(1, len(tierBoundaries) - 1)
```

Quand il n'existe qu'une borne, l'intervalle va de `qualityMin` à `qualityMax`.
La seule inconnue est l'origine du gain par niveau : borne inférieure du
segment ou `qualityMin`. Le futur lot doit concentrer ce choix dans l'unique
paramètre `ARMOR_SEGMENT_ORIGIN_MODE`, présumé et non exécuté au lot 1; les
termes concernés porteront `confidence:"presumed"`.

Protocole de validation : relever la même statistique d'une même armure à
`qualityMin`, juste avant, au niveau et juste après la première borne interne,
puis comparer les reconstructions `"segment-lower-bound"` et `"quality-min"`.
Changer de résultat doit coûter une seule valeur de paramètre, pas une
réécriture du moteur.

### Compatibilité des anciennes PWA, activation et retour arrière

Deux triggers idempotents dans `supabase/schema.sql`,
`preserve_roster_weapon_configs` et `preserve_team_weapon_configs`, empêchent
une ancienne PWA qui omet `weaponConfig` d'effacer une saisie récente lorsque
l'arme et l'objet sont inchangés. Une clé explicitement mise à `null` reste une
suppression volontaire; retirer un build/héros ou changer d'arme ne ressuscite
ni ne transporte l'ancienne configuration. Aucune table, colonne ou politique
RLS n'est ajoutée.

Ordre de mise en service :

1. rejouer le `supabase/schema.sql` complet pour installer les gardes ;
2. fusionner/pousser le frontend seulement après autorisation ;
3. attendre le workflow GitHub Pages vert ;
4. appliquer la mise à jour PWA proposée ;
5. vérifier que le `BUILD_VERSION` servi correspond au SHA publié.

Retour arrière du frontend : revenir au commit antérieur, déployer ce revert,
puis appliquer la mise à jour PWA, **en conservant les triggers SQL**. Les
`weaponConfig` restent dans les JSONB et réapparaissent lors d'une réactivation;
aucun rollback SQL destructif n'est nécessaire.

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
  name: "Compo burst",      // nom facultatif, ≤ 40 car., "" pour les anciennes
  pseudo: "NomDuMembre",
  boss: "",                 // réservé (non utilisé dans l'UI actuelle)
  createdAt: 1690000000000,
  updatedAt: 1690000000000,
  heroes: [                 // TOUJOURS 4 entrées (slot vide = char null)
    {
      char: "meliodas" | null,        // id de personnage
      weapon: "7ds-armes/.../x.webp" | null, // forcément compatible avec char
      weaponConfig: { /* forme version 1 documentée plus haut */ } | null,
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
      weaponConfig: { /* forme version 1 documentée plus haut */ } | null,
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

## Modale de détail du roster d'un membre

Elle n'existe **que** dans le roster consulté (`editable === false`) : sur son
propre roster, « Modifier » ouvre déjà l'éditeur. Chaque fiche est cliquable et
porte un bouton `.member-roster-detail-btn` — le bouton existe pour l'accès
clavier, pas pour la décoration.

`#rosterDetailOverlay` réutilise `heroDetail()` pour ne pas dupliquer la
présentation du détail d'équipe. L'option `settings.badgesFor` remplace la
rangée de badges figée par `rosterDetailWeaponSwitch()` : un bouton
`.roster-detail-weapon[data-weapon-type]` par type d'arme du personnage, actif
seulement si un build est enregistré pour ce type, `aria-pressed="true"` sur le
build affiché.

Navigation : `#rosterDetailPrev` / `#rosterDetailNext`, les touches
`ArrowLeft` / `ArrowRight`, et `#rosterDetailPosition` (« n / total »). Les
flèches sont désactivées aux extrémités, sans bouclage.

Deux pièges vérifiés par les tests :

- Le navigateur **retire le focus** d'un bouton dès qu'il devient `disabled`.
  `renderRosterDetail()` lit donc `document.activeElement` **avant** de
  désactiver une flèche, puis rend le focus à l'autre flèche. Sans ça, le focus
  tombe sur `body` et les touches fléchées cessent de répondre.
- `rosterDetail.entries` est une **copie** de la liste affichée. Une
  synchronisation Realtime pendant la lecture ne doit pas déplacer le
  personnage consulté.

## Filtres de catégorie du roster

Les quatre catégories (`element`, `weapon`, `role`, `rarity`) sont des listes
déroulantes, pas des chips : `#memberRosterFilterElement`,
`#memberRosterFilterWeapon`, `#memberRosterFilterRole`,
`#memberRosterFilterRarity`. Elles vivent dans une grille
`.member-roster-filter-fields` en `auto-fit` — quatre colonnes sur bureau, deux
sur mobile — et **ne doivent jamais défiler horizontalement**. L'ancien rail
`overflow-x` est supprimé : il rendait visible une barre de défilement que le
reste du site masque (voir `tests/scrollbars-invisibles.playwright.js`).

Une liste dont la valeur n'est pas `""` porte la classe `on` (bordure et texte
dorés). Le bouton `#memberRosterFilterReset` n'existe dans le DOM que si au
moins un filtre est actif ; `syncMemberRosterFilterReset()` l'ajoute et le
retire **sans reconstruire les listes**, sinon le focus clavier serait perdu
juste après un choix. Les valeurs proposées viennent toujours de
`rosterFilterValues(key)`, dérivé de `window.SEVEN_DS_META` : aucune liste
d'éléments ou d'armes n'est écrite en dur.

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
  `renderBonus()` rend leur balisage couleur. Le potentiel ne participe pas
  encore au calcul chiffré du lot 1.
- **Calcul chiffré partiel de l'arme uniquement** : `stats-build.js` calcule
  l'apport de l'arme configurée. Aucune statistique finale de héros, d'armure,
  de set, de potentiel ou de maîtrise n'est encore annoncée comme couverte.
- Arme choisie en 2 temps : type puis arme. Le picker filtre les groupes aux
  3 types autorisés par les clés de `window.SEVEN_DS_POTENTIELS[charId]`.
- Export / Import JSON = sauvegarde de secours et format pivot indépendant de Supabase.
- Auth Supabase : email + mot de passe sans confirmation email. Toute lecture
  partagée exige un membre authentifié ; RLS limite l'écriture au propriétaire.

## Groupes de Boss de Guilde (onglet « Groupes de boss »)

- **6 groupes ouverts simultanément chaque semaine, de 1 à 5 membres** (reset
  lundi 9h), boss *Akumu, bête démoniaque*. `BossStore.ensureWeek` crée
  uniquement les runs n°1 avec un `upsert` sur `(week_start, slot, run_no)`.
- Chaque membre dispose de **3 runs par semaine**. Rejoindre une run ouverte la
  réserve ; quitter la run ouverte la libère. Les participations archivées sont
  définitives.
- **Rejoindre/Quitter est optimiste** : la participation, la carte et le
  compteur changent avant la réponse RPC. `bossPendingActions` protège les
  doubles clics et se superpose aux rechargements Realtime silencieux. Une
  erreur annule uniquement l’intention locale concernée. Les sélections
  d’équipe et rapports conservent un rechargement complet.
- Chaque participant d’une run ouverte doit choisir une **équipe propriétaire
  obligatoire**. `select_boss_team` enregistre alors un **instantané immuable**
  dans `boss_participation.team_snapshot` : les modifications ou suppressions
  ultérieures de l’équipe source ne changent jamais l’archive.
- Tout membre du groupe peut cliquer « Run terminée » quand toutes les équipes
  sont prêtes. La modale exige un **score global obligatoire** et accepte une
  **note facultative** (1 000 caractères maximum). La RPC
  `complete_boss_run_with_report` crée le rapport, archive la session et crée
  immédiatement la run suivante, vide, pour le même groupe, dans une unique
  transaction. `complete_boss_run` historique répond `REPORT_REQUIRED` aux
  anciennes PWA et ne peut plus archiver sans rapport.
- `boss_run_reports` stocke un rapport par session archivée. Les trois nouvelles
  RPC sont `select_boss_team`, `complete_boss_run_with_report` et
  `update_boss_run_report`. Un **participant archivé** peut corriger uniquement
  le score et la note; ni les participants, ni les équipes, ni leurs instantanés
  ne sont modifiables. Les archives historiques sans rapport restent consultables
  et affichent « Rapport non disponible pour cette ancienne run. ».
- La suppression d’un compte conserve l’historique : le créateur de session et
  le propriétaire de participation deviennent `NULL`, mais sessions, rapports,
  pseudos et instantanés restent intacts. Une participation anonymisée ne donne
  plus aucun droit de correction à un compte actif.
- Exception de démarrage : la policy `boss_sessions_insert` autorise la
  **création initiale des seeds** des six groupes courants (`run_no=1`, slots
  1–6) par `BossStore.ensureWeek`. Les modifications/suppressions de sessions
  et les écritures directes dans `boss_participation` et `boss_run_reports`
  restent interdites ; le flux métier passe via RPC (`join_boss_run`,
  `leave_boss_run`, `select_boss_team`, `complete_boss_run_with_report` et
  `update_boss_run_report`).
- La chaîne Realtime écoute aussi `boss_run_reports`; les événements sont
  regroupés et ne rechargent que la vue Boss concernée.
- Le bilan de confrérie ne calcule aucune statistique individuelle : il utilise
  uniquement les rapports disponibles pour les runs renseignées, meilleur score,
  score moyen, dernier score et variation hebdomadaire.
- Semaine courante = `currentBossWeek()` (lundi 9h Paris le plus récent ≤ maintenant).
- **Rappel Discord** : dimanche midi Paris (`scripts/discord-reminder.js` + GitHub Actions),
  liste les membres sous `3/3` et le nombre de runs manquantes.
  Voir `docs/superpowers/specs/2026-07-25-boss-trois-runs-design.md`.
- Après une modification de ce schéma, réexécuter le contenu complet de
  `supabase/schema.sql` dans le SQL Editor Supabase.

### Activation et retour arrière des rapports de boss

Le tag annoté local `backup-before-boss-reports-2026-07-26` sauvegarde le
`main` antérieur aux rapports; il n’est poussé qu’avec l’autorisation explicite
du membre. La mise en service requiert une courte fenêtre de maintenance :

1. rejouer `supabase/schema.sql` dans le SQL Editor Supabase ;
2. effectuer la fusion/push de la branche validée vers `main` ;
3. attendre le workflow GitHub Pages vert ;
4. demander aux onglets ouverts d’appliquer la mise à jour PWA.

Pendant l’intervalle SQL → Pages, les anciennes pages peuvent consulter les
groupes mais `Run terminée` reçoit `REPORT_REQUIRED`. En cas de retour arrière,
respecter l’ordre inverse de compatibilité :

1. exécuter `supabase/rollback-boss-reports.sql` dans Supabase ;
2. lancer un `git revert` du commit ou de la fusion des rapports ;
3. push le revert et attendre le déploiement Pages testé.

Cette fenêtre de compatibilité concerne les onglets et PWA récents : dès le
rollback SQL, leurs nouvelles RPC sont révoquées et l’interface affiche le
message explicite de maintenance du schéma. Une ancienne interface utilisant
`complete_boss_run` redevient compatible après le rollback SQL. Une fois le
frontend restauré déployé par Pages, cliquer sur **Mettre à jour** dans chaque
onglet ou PWA encore ouvert ; à défaut, fermer puis rouvrir chaque onglet et
chaque PWA afin d’activer la version restaurée.

Ce script de rollback est rejouable et non destructif : il restaure les RPC et
leurs privilèges, mais ne supprime aucune table, colonne, participation,
session, instantané ni rapport. Les objets ajoutés restent disponibles pour une
réactivation ultérieure.

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

Le job `package` porte `pages: read` : `configure-pages` interroge l'API Pages et
répondrait 403 avec la seule permission `contents: read`. `package` et `deploy`
sont en outre limités à `refs/heads/main`, pour qu'un `workflow_dispatch` lancé
depuis une autre branche ne publie jamais. La concurrence est cloisonnée par
référence (`${{ github.workflow }}-${{ github.ref }}`), sinon une pull request
annulerait un déploiement de `main` en cours.

**Réglage manuel unique** (une seule fois, après la fusion) :
`Settings → Pages → Build and deployment → Source → GitHub Actions`.

⚠️ Ordre : la fusion déclenche le workflow immédiatement. Si la source Pages est
encore `Deploy from a branch`, ce premier run échoue à `configure-pages` ou
`deploy-pages`. C'est attendu : basculer la source, puis relancer via
`Actions → Tests et déploiement GitHub Pages → Run workflow`.

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
doit jamais provoquer de rechargement. Si l'activation n'aboutit pas dans les
10 s, le bouton redevient utilisable et le bandeau reste affiché : jamais de
bouton bloqué, jamais de boucle de rechargement.

Les navigations et les fichiers applicatifs (`CORE_PATHS`) sont `network-first` ;
seules les images locales restent en `stale-while-revalidate`. Supabase et le CDN
jsDelivr ne sont jamais mis en cache. Le préchargement d'installation passe par
`cache.add` fichier par fichier : `addAll` est atomique et un seul 404 laisserait
un cache vide, donc sans mode hors ligne. Les écritures en cache restent hors du
chemin de réponse, pour qu'un `put` refusé ne fasse jamais passer un succès
réseau pour une panne.

Le bandeau est en `z-index:55`, **sous** la couche des modales (`.overlay` 60,
`#overlay` 70, `.auth-overlay` 75) et sous le toast (80). Ne pas le remonter :
le piège à focus de `ModalStack` le rendrait inatteignable au clavier tout en
interceptant les clics sur la modale ouverte. `tests/accessibilite-mobile.playwright.js`
verrouille cet ordre d'empilement.

**Premier passage après ce déploiement** : l'ancien service worker appelait
`skipWaiting()` à l'installation. Les membres déjà équipés reçoivent donc le
nouveau `index.html` tout en restant contrôlés par l'ancien worker, et le bandeau
apparaît aussitôt. C'est normal, pas un bug : un clic sur « Mettre à jour »
suffit et le comportement devient explicite dès la version suivante.

## Tableau de bord personnel « Mon suivi »

Septième onglet principal, placé juste après « Créer une équipe ». Il devient la
vue par défaut au passage **« aucun compte → un compte »** : résolution initiale
d'une session ou connexion réussie. Un changement de compte piloté de l'extérieur
ou un `TOKEN_REFRESHED` ne déplace **jamais** la navigation ; il réaffiche
seulement le suivi du bon compte si le panneau est visible. Déconnecté, l'onglet
reste ouvrable et propose la connexion.

**Aucune table, aucune RPC, aucune migration Supabase.** Le tableau de bord est
une projection calculée dans `index.html`. Les seules sources d'autorité restent
`teams`, `boss_sessions`, `boss_participation` et `boss_run_reports`.

Fonctions pures, testables sans navigateur via `tests/helpers/load-app.js` :

- `dashboardDeadlineStatus(now, remaining)` → `neutral` / `warning` / `urgent` /
  `complete`, toujours en heure de Paris ;
- `buildDashboardState(input)` → `{ weekStart, engaged, completed, open,
  remaining, hasOwnTeams, groups, actions, deadlineStatus, lastSyncedAt,
  offline }`.

Une participation est comptée **une seule fois par `session_id`** ; une ligne
d'une autre semaine ou sans session n'entre dans aucun compteur. Le serveur
reste l'autorité sur la limite de trois runs. Les scores sont conservés en
**chaînes** pour ne perdre aucun bit avant `formatBossScore`.

Priorité du bloc « À faire maintenant » : équipe manquante, puis équipe prête,
puis rejoindre une run, puis corriger un rapport. Les six actions réutilisent
les interfaces existantes sans rechargement de page, et rendent le focus dans
la vue destination — fermer une modale ouverte depuis le tableau de bord ramène
le focus dans la vue Boss, jamais dans le panneau désormais caché.

### Cache et Realtime

Clé locale, cloisonnée par compte **et** par semaine :

```
confrerie7ds.cloud.dashboard.<userId>.<weekStart>
```

L'enveloppe porte une version de format ; une version, un compte ou une semaine
qui ne correspondent pas font renvoyer `null`. En cas d'échec réseau, le dernier
cache compatible s'affiche avec le badge « Hors ligne », la date de dernière
synchronisation et les actions réseau désactivées. **Sans cache compatible, la
vue dit que le suivi est indisponible hors ligne et n'affiche jamais un faux
`0/3`.** Le cache n'accorde aucun droit et ne déclenche jamais de mutation.

Realtime : quand « Mon suivi » est actif, un événement `teams` ou boss le
recharge silencieusement, et cette lecture unique remplace les branches
`teams`/`boss` du même lot. Quand un autre onglet est actif, le tableau de bord
est seulement **marqué sale** et relu à sa prochaine ouverture — Realtime ne
change jamais l'onglet actif ni le focus. Chaque lecture est protégée par une
génération, l'identité du compte et la semaine attendue : une réponse lente ne
remplace jamais un état plus récent et ne fait jamais fuiter un compte vers
l'autre.

## Accessibilité et mobile

**Header rétractable sur mobile** (≤ 560 px). En défilant vers le bas au-delà de
`RETRACT_FROM` (140 px), `.topbar` reçoit `is-retracted` : la marque et le bloc
compte se replient et seule la barre d'onglets reste collante. Le header passe de
211 px à 73 px, soit 138 px rendus au contenu (25 % → 9 % de l'écran).

Il ne se replie jamais en haut de page ni en desktop, et **ne se redéploie qu'en
haut de page** (`EXPAND_AT`, 4 px) : remonter à mi-page pour relire un paragraphe
ne doit pas recouvrir la lecture. Le seuil est volontairement bas — se replier
raccourcit le document et le navigateur recale `scrollY` d'environ 90 px pendant
l'animation ; un seuil large ferait rebondir le header entre les deux états.

Le repli est **animé** : `max-height` + `opacity` sur les deux zones, `padding` +
`gap` sur le header, environ 0,26 s.

Cinq garde-fous à ne pas retirer :

- l'état replié se termine sur `visibility:hidden`, **jamais** un simple
  `max-height:0`. C'est lui qui retire ces contrôles de l'ordre de tabulation, ce
  que faisait `display:none` avant l'animation (`display` ne se transitionne
  pas). Il ne bascule qu'en fin de course au repli, sinon le bloc disparaîtrait
  avant d'avoir replié ;
- corollaire pour les tests : un bloc replié **garde un rectangle client** de
  hauteur nulle. Tester `getClientRects().length` ne prouve donc plus rien ;
  comparer hauteur peinte **et** `visibility` calculée ;
- comme ils quittent l'ordre de tabulation, **toute frappe de Tab redéploie le
  header**, sinon un membre au clavier ne pourrait plus jamais les atteindre ;
- le garde « ne pas masquer un contrôle focalisé » ne teste que `.brand` et
  `.account`, **jamais `.topbar` entière**. Les onglets vivent aussi dans le
  header mais restent visibles replié : les inclure faisait que le focus laissé
  sur l'onglet cliqué bloquait le repli définitivement, donc plus aucun repli
  après la moindre navigation ;
- `lastY` est relu **après** le basculement, jamais avant. Le header est dans le
  flux : le replier raccourcit le document et le navigateur recale aussitôt
  `scrollY`. Lire la position avant laisserait ce saut auto-infligé passer pour
  un scroll vers le haut au coup suivant, et l'oscillation deviendrait infinie.
  Un amortisseur en nombre de frames corrigeait aussi l'oscillation, mais il
  avalait un scroll réel arrivant juste après une navigation.

Ce code vit dans un bloc `<script>` séparé, car le bac à sable `vm` des tests
unitaires ne fournit ni `window.addEventListener`, ni `matchMedia`, ni
`requestAnimationFrame`.

**Repères de défilement des onglets.** Sept onglets pour 390 px : `.tabs` défile
en `overflow-x:auto` avec la barre masquée, donc rien n'indiquait qu'on pouvait
défiler. Un fondu surmonté d'un chevron doré (`.tabs-cue-left` /
`.tabs-cue-right`) apparaît du côté où il reste des onglets à atteindre.

Trois contraintes à respecter :

- les repères vivent dans l'enveloppe `.tabs-rail`, **hors** du conteneur
  défilant. Un pseudo-élément posé sur `.tabs` défilerait avec les onglets, le
  conteneur de bloc d'un descendant absolu étant l'aire de débordement ;
- `pointer-events:none` obligatoire : le repère recouvre le dernier onglet
  visible et ne doit jamais lui voler une touche. Le test le vérifie par
  `elementFromPoint` au centre du repère, qui doit rendre un `.tab` ;
- le contrôleur pose seulement `can-scroll-left` / `can-scroll-right` sur le
  rail — le CSS décide de les rendre visibles, et ne le fait que dans la requête
  média mobile. En desktop les onglets ne défilent pas : aucun repère, même si
  les classes sont posées.

`.tabs-rail` porte `order:3` et `width:100%` en mobile (c'est lui le
flex-item de `.topbar`, plus `.tabs`).

**Bouton « Importer mes données locales »** : action à usage unique, affichée
seulement s'il reste réellement des données dans le `localStorage` de ce
navigateur et que la migration n'a pas déjà eu lieu. Elle disparaît ensuite au
lieu de rester désactivée — elle occupait une ligne entière du header mobile
pour toujours, et le bloc compte est ainsi passé de 136 px à 58 px.

Les onglets principaux suivent le motif ARIA et se pilotent avec les flèches,
Début et Fin. Toutes les modales passent par `ModalStack`, qui gère la pile, le
piège à focus, Échap et la restitution du focus. Ne pas réintroduire d'écouteurs
Échap locaux. Sur écran tactile, les contrôles principaux restent à 44 × 44 px
minimum et aucune vue ne doit élargir le document.

## Sets d'équipement en un clic

Deux boutons figurent dans la grille d'équipement du **roster des membres** et du
**Team Builder** : **« Équiper un set d'armure »** remplit `Haut`, `Bas`,
`Bottes` et `Ceinture`, **« Équiper un set de bijoux »** remplit `Anneau`,
`Collier` et `Boucle d'oreille`. Les libellés diffèrent volontairement : deux
boutons identiques dans la même grille seraient ambigus au lecteur d'écran.

Chacun n'agit que sur ses propres emplacements — équiper des bijoux ne vide pas
les armures, et réciproquement. L'`Armure liee` n'est **jamais** touchée : elle
dépend du personnage et n'a pas de structure de set.

⚠️ Ne pas répéter cette erreur : les bijoux ont d'abord été déclarés « sans
set » sur la foi d'un test d'égalité **exacte** des noms, qui renvoie zéro pour
les armures comme pour les bijoux. Les deux familles suivent en réalité la même
convention. Toujours comparer par suffixe.

**Les sets ne sont JAMAIS listés en dur**, conformément à la règle d'or : ils
sont déduits de `window.SEVEN_DS_DATA` par `armorSetsFrom(armures)`. Le nom d'une
pièce est le libellé de son emplacement suivi du nom du set :

```
Haut de la mélodie d'Arachnée
Bas de la mélodie d'Arachnée
Bottes de combat de la mélodie d'Arachnée
Ceinture de la mélodie d'Arachnée
```

Le regroupement se fait donc par **plus long suffixe commun** (au moins 6
caractères utiles), et non par égalité de nom — aucun nom n'est identique d'un
emplacement à l'autre. Ce choix survit à l'ajout d'une pièce hors convention :
seule celle-là ne trouvera pas de set, les autres tiennent. Un regroupement par
préfixe commun aurait au contraire cassé tout un emplacement d'un seul coup.

Seuls les sets **complets sur tous les emplacements de leur famille** sont
proposés. Avec les données actuelles : **14 sets d'armure** (56 des 62 pièces) et
**10 sets de bijoux** (30 des 34) ; le reste n'existe que dans un emplacement.
`armorSetLabel` retire l'article français de liaison pour l'affichage
(« du cristal de vie » → « Cristal de vie »).

`stripSetNote` retire une note finale entre parenthèses avant la comparaison.
Sans elle, « Anneau des 100 jours (jamais porté) » et « Boucles d'oreilles des
100 jours (jamais port**ées**) » ne partagent que « ) » : l'accord du participe
casse le suffixe commun et ce 10ᵉ set disparaît. Les noms d'armure ne comportent
aucune parenthèse, donc ce nettoyage ne change rien pour eux.

`equipmentSetsFrom(source, slots)` porte la logique ; `armorSetsFrom` et
`jewelSetsFrom` ne sont que des enveloppes sur la liste d'emplacements.

## Nom d'équipe et duplication

Une équipe porte un **nom facultatif** de 40 caractères maximum, `normalizeTeamName`
le coupant et le bornant. Il vit dans le `jsonb` de `teams.data`, donc **aucune
migration Supabase** : une équipe créée avant devient simplement sans nom.

Le nom s'affiche là où deux compos étaient indistinguables : carte d'équipe (il
prend la ligne principale, le pseudo passe dessous), **sélecteur d'équipe du Boss
de Guilde** — sa raison d'être — et titre de la modale d'équipement. Les
instantanés de `boss_participation` copiant tout `teams.data`, le nom du moment
est figé dans les rapports archivés, gratuitement.

**« Dupliquer » est proposé sur toute équipe**, pas seulement les siennes : le
registre est partagé et la copie est indépendante. Elle arrive comme **brouillon
non enregistré** — nouvel identifiant, hors mode édition, nom suffixé
« (copie) », pseudo remplacé par le sien, et `owner`/`createdAt`/`updatedAt`
retirés. Rien n'est écrit dans Supabase avant « Enregistrer ». *Modifier* et
*Supprimer* restent réservés au propriétaire ; les tests comptent désormais
`[data-team-action="edit"]` plutôt que le conteneur `.team-actions`, présent sur
chaque carte.

## Évolutions prévues

- Champ **note globale d'équipe** (déjà réservé dans le modèle via `boss`).

## Conventions

- Français partout dans l'UI.
- La logique applicative reste inline dans `index.html` (pas de build). Les seules
  exceptions runtime sont `supabase-config.js` et le client Supabase chargé par CDN.
- Thème : héraldique sombre (obsidienne + or vieilli + pourpre). Voir la spec.
- Après modif des dossiers d'images : relancer `generate-data.ps1`.
