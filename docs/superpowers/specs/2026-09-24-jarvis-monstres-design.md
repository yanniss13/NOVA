# J.A.R.V.I.S. — lot 2a : monstres et boss lus dans les tables du jeu

Date : 2026-09-24 · Statut : conception validée en discussion, à relire
Prolonge : `docs/superpowers/specs/2026-09-24-discord-jarvis-design.md` (lot 1)

## But

`/jarvis texte:faiblesse démon rouge` répond aujourd'hui « je ne trouve pas ça
dans les données de NOVA ». Le lot 2a donne au bot les monstres et boss du
jeu : faiblesses et résistances par élément, résistance élémentaire de base,
défense, résistances critiques, avec le **contexte** de chaque version (boss de
terrain, donjon, boss de confrérie, Cross Challenge…).

Critère de réussite : pour le Démon rouge, le bot répond que la version boss de
terrain est faible à la **Terre et au Sacré (+20 %)** et résiste au **Feu
(−30 %)**. Il distingue aussi la version Cross Challenge (Glace et Sacré +30 %,
le reste −80 %), et cite la date de l'export.

## Découpage du lot 2

| Lot | Domaine | Statut |
| --- | --- | --- |
| **2a** | Monstres et boss, et **toute la chaîne commune** (extraction → stockage privé → lecture par le bot) | cette spec |
| 2b | Mécaniques de combat (`BuffTable`, constantes) | spec à venir |
| 2c | Objets et progression (`MerchantGoods`, `DropPackTable`, `DropGroupTable`) | spec à venir |
| 2d | Contenu non sorti, distingué du contenu sorti | spec à venir |

Chaque lot suivant ajoute un extracteur et un fichier dans le même stockage,
lu par le même mécanisme.

## Faits établis sur l'export du 24/09/2026

Tous vérifiés en lisant l'export, aucun supposé :

- 895 tables sur 896 se lisent. `Actor/MonsterActorTable` (1 566 lignes),
  hier illisible, se lit avec le usmap Dumper-7.
- Chaîne des noms : `MonsterActorTable[id].Local_Key` → la clé de
  `Localization/Game/fr/Game.json` (`client_language_table`), **comparée sans
  la casse**. Chaîne des statistiques :
  `MonsterActorTable[id].StatGroupTid` → `Actor/NpcStatGroupTable` (1 130
  groupes, 101 colonnes).
- 1 202 acteurs ont un vrai groupe, dont 1 043 avec un nom français, soit
  290 noms distincts. Rangs : 792 normaux, 161 élites, 90 boss. Un nom couvre
  souvent plusieurs acteurs : le Démon rouge en a 5, dont 2 pointent sur le
  groupe de test `stat_poweroverwhelming`.
- **Signe des faiblesses, confirmé en jeu par le propriétaire** : une valeur
  positive de `<Élément>_Weakness_Rate` est une faiblesse (dégâts en plus),
  une valeur négative une résistance. L'unité est le dix-millième :
  `2000` = +20 %.
- Les trois vrais Démons rouges diffèrent. `50103301` apparaît dans
  `FieldBoss/FieldBossTable` et dans l'apparition du chapitre 3 : faiblesses
  Terre et Sacré +20 %, Feu −30 %. `51900001` est dans `Dungeon/DungeonTable`,
  type `Boss_Replay_Event` : mêmes faiblesses. `50600106` est dans la zone
  `CrossChallenge_50406002` : Glace et Sacré +30 %, tous les autres −80 %.
- **Akumu** : son acteur (`50700109`) pointe sur `stat_poweroverwhelming`. Ses
  vraies statistiques sont les 30 groupes de `Dungeon/BossStatGroupTable`
  (`Boss_Tid` → `Stat_Level` → `Stat_Group`), tous présents. Niveau 1 : −30 %
  sur les 8 éléments, ce qui concorde avec les « 8 résistances à 30 % » de
  `docs/akumu-20-niveaux.md`.
- **Aucune table exportée n'applique le niveau de monde aux statistiques.**
  Seul `Recommend_BattlePower` donne une puissance par
  `StandardWorldLevelTID`. L'ajustement des PV, de la défense et de l'attaque
  se fait côté serveur. Les faiblesses de la table concordent avec la mesure
  faite au niveau de monde 4 (`docs/RAPPORT-analyse-tapscreen.md`).

## Chaîne de données (approche A validée)

### 1. Extraction locale

Deux fichiers dans `outils/fabrication/` :

| Fichier | Rôle |
| --- | --- |
| `monstres-jarvis.js` | Logique **pure** : reçoit les tables déjà lues et les textes, rend l'objet catalogue. Aucun accès disque. Testée en CI. |
| `extraire-monstres.js` | Enveloppe : lit l'export via `DONNEES_JEU`, appelle la logique pure et écrit `output/jarvis/monstres.json`. |

Aucun chemin de disque n'est écrit dans un fichier suivi :
`tests/chemins-personnels.test.js` le garde. `output/jarvis/` est ajouté à
`.gitignore`. Aujourd'hui, `output/` est seulement non suivi, et un `git add .`
publierait les données du jeu.

**Règles d'extraction :**

1. Pour chaque acteur de `MonsterActorTable`, on cherche d'abord ses paliers
   dans `BossStatGroupTable` (`Boss_Tid` = identifiant de l'acteur). S'il en
   a, **chaque palier** devient une version, et son contexte porte le niveau.
2. Sinon, on prend son `StatGroupTid`. Sont écartés : les groupes absents de
   `NpcStatGroupTable`, `stat_poweroverwhelming`, et les acteurs sans nom
   français.
3. Le **contexte** d'un acteur est la liste de tous les contextes qui le
   citent, dans cet ordre de priorité d'affichage :
   1. boss de confrérie : `BossStatGroupTable`, avec le niveau ;
   2. boss de terrain : `FieldBossTable` ;
   3. donjon : `DungeonTable`, avec le nom français tiré de `Local_Sub_Name`,
      et le type ;
   4. Cross Challenge : zone d'apparition dont le nom de fichier commence par
      `CrossChallenge_` ;
   5. zone d'apparition : `Scene/Zone/<zone>/spawn/*_spawntable.json`, avec le
      nom de la zone tiré de `Scene/ZoneTable` quand il est traduit, sinon
      son identifiant ;
   6. aucun : « contexte non retrouvé ».

   Le nom exact des champs de `ZoneTable` et des tables d'apparition est
   vérifié sur l'export au moment du plan.
4. Statistiques retenues, avec les valeurs brutes du jeu (dix-millièmes pour
   les taux) :
   - faiblesses : `Default`, `Thunder`, `Wind`, `Fire`, `Ice`, `Earth`, `Dark`
     et `Holy`, suffixées `_Weakness_Rate` ;
   - résistances élémentaires de base : les mêmes éléments, suffixés
     `_Element_Res_Rate` ;
   - `B_MaxHp`, `B_Def`, `B_Atk` ;
   - `C_Critical_ResRate`, `C_Critical_DamRes_Rate` ;
   - `A_Block`, `D_Block_DamRes_Rate`, `D_All_DamRes_Rate` ;
   - la puissance recommandée par niveau de monde.
5. **Fusion** : deux versions d'un même nom qui ont **les mêmes statistiques
   retenues** deviennent une seule entrée, dont on garde l'union des contextes
   et la liste des acteurs. Seuls les paliers d'un boss à paliers ne se
   fusionnent pas.
6. En-tête : `version` du format (1), `genereLe` (date de l'extraction),
   `dateExport` (date de modification de `MonsterActorTable.json`) et la
   version du jeu si l'export la donne.

### 2. Stockage privé

Un bucket Supabase Storage **`jarvis-prive`, privé**, est créé par un bloc
idempotent dans `supabase/schema.sql`
(`insert into storage.buckets … on conflict do nothing`). **Aucune politique
RLS** ne l'ouvre : seule la clé `service_role` de l'Edge Function le lit.
Chemin de l'objet : `monstres.json`.

Le propriétaire dépose le fichier par glisser-déposer dans *Storage*, ou avec
la CLI Supabase. Rien n'est commité, rien n'est publié sur Pages.

### 3. Lecture par le bot

Une fonction du module partagé, `fetch` et horloge injectés, lit
`<SUPABASE_URL>/storage/v1/object/jarvis-prive/monstres.json` avec la clé
`service_role` :

- elle garde un succès en mémoire **1 heure** ;
- elle garde un échec **1 minute** ;
- elle refuse une `version` de format inconnue ;
- elle ne lève jamais d'exception : elle rend le catalogue ou `null`, et
  journalise la raison.

## Outils du bot

### `fiche_monstre(nom, contexte?, niveau?)`

- Nom approximatif, avec la même tolérance que les héros : sans accents, sans
  casse, par début de nom, par mots. Si le monstre est introuvable, l'outil
  rend `{ introuvable, proches }`.
- Il rend `{ nom, rang, total, versions:[…] }`, avec au plus 5 versions. Chaque
  version contient :
  - `contextes` : libellés français (« Boss de terrain », « Donjon : <nom>
    (rejouable) », « Cross Challenge », « Boss de confrérie, niveau 12 »,
    « Zone : <nom> ») ;
  - `faiblesses` et `resistances` : `["Terre +20 %", …]` et
    `["Feu −30 %", …]`, triées par valeur, zéros omis ;
  - `resistanceElementaireBase` : « 10 % sur tous les éléments » si elle est
    uniforme, sinon le détail ;
  - `resistanceCritique` et `defenseCritique`, en pourcentage ;
  - `valeursDeBase` : `{ pv, defense, attaque, note:"valeurs de base, avant
    ajustement du niveau de monde" }` ;
  - `puissanceRecommandee` : `{ "Niveau de monde 1": 3144, … }` quand elle
    existe ;
  - `nonConfirme:true` quand aucun contexte n'a été retrouvé, avec le libellé
    « présent dans les fichiers, contexte non retrouvé ».
- `contexte` filtre les versions : « terrain », « donjon », « confrérie »,
  « cross challenge », « zone ».
- `niveau` sert aux boss à paliers. Sans niveau, l'outil rend le premier et le
  dernier palier, plus `paliers:"1 à 30"`. Un niveau hors bornes renvoie une
  erreur qui rappelle les bornes.

### `chercher_monstres(element, rang?)`

- `element` est l'un des 8 libellés français (Physique, Foudre, Vent, Feu,
  Glace, Terre, Ténèbres, Sacré), avec la même tolérance que les noms.
- `rang` vaut `boss` par défaut ; on peut demander `elite` ou `tous`.
- Il rend les versions **faibles** à cet élément (valeur > 0), triées par
  faiblesse décroissante puis par nom, au plus 15, avec leurs contextes et le
  total.

### Commun

- Libellés des éléments : `Default` Physique, `Thunder` Foudre, `Wind` Vent,
  `Fire` Feu, `Ice` Glace, `Earth` Terre, `Dark` Ténèbres, `Holy` Sacré, comme
  `ELEMENT_LABELS` du site.
- Sources : `fiche monstre <nom> · données du jeu du <JJ/MM/AAAA>` et
  `monstres faibles à <élément> · données du jeu du <JJ/MM/AAAA>`.
- Catalogue indisponible : `{ erreur:"données des monstres indisponibles" }`.
  Les autres outils ne sont pas touchés.
- La consigne gagne une règle : les PV, la défense et l'attaque d'un monstre
  sont des valeurs de base, et le bot doit le préciser s'il les cite.
- Aucune donnée de membre dans ces outils.

## Erreurs

| Cas | Comportement |
| --- | --- |
| 404 sur l'objet | Outils monstres → « données des monstres indisponibles » ; échec gardé 1 min. |
| JSON illisible ou `version` inconnue | Même réponse, avec la raison dans les journaux. |
| Stockage injoignable | Même réponse. |
| Fichier redéposé | Pris en compte au plus tard 1 h après, sans redéploiement. |

## Tests

Tous en CI, sans export du jeu et sans réseau :

- `tests/monstres-jarvis.test.js` : mini-export écrit dans le test. On y
  vérifie :
  - les trois Démons rouges ;
  - le groupe de test écarté ;
  - Akumu avec deux paliers, **malgré son acteur sur
    `stat_poweroverwhelming`** ;
  - un donjon nommé ;
  - une version sans contexte ;
  - un acteur sans nom ;
  - le signe des faiblesses ;
  - la fusion des versions identiques ;
  - l'ordre des contextes ;
  - la comparaison des clés de nom sans la casse.
- La lecture du bucket, avec un faux `fetch` : 200 puis cache, expiration
  après 1 h, 404, JSON illisible, version inconnue, échec gardé 1 min.
- Les outils, sur un petit catalogue : noms approximatifs, filtres `contexte`
  et `niveau`, niveau hors bornes, plafonds, tri, étiquette « valeurs de
  base », `nonConfirme`, source datée, catalogue indisponible.
- Schéma : le bucket est créé avec `public = false`, et aucune politique sur
  `storage.objects` ne le cite.
- `.gitignore` contient `output/jarvis/`.

## Mise en service

1. Rejouer `supabase/schema.sql` dans le SQL Editor pour créer le bucket
   privé.
2. Lancer l'extraction :
   `$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path`,
   puis `node outils/fabrication/extraire-monstres.js`.
3. Déposer `output/jarvis/monstres.json` dans le bucket `jarvis-prive`.
4. Fusionner et pousser vers `main` **sur accord du propriétaire**, puis
   redéployer `discord-planning`. Aucune commande Discord à réenregistrer.
5. Essayer `/jarvis texte:faiblesse démon rouge`.

Après une mise à jour du jeu : les étapes 2 et 3 seulement.

## Hors de ce lot

- Compétences, butins et comportements des monstres.
- L'ajustement par le niveau de monde, qui n'est dans aucune table exportée.
- La distinction du contenu non sorti : lot 2d. En attendant, une version sans
  contexte est marquée « contexte non retrouvé », sans rien affirmer.
