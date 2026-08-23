# Extraction des fichiers du jeu (FModel) — état au 23 août 2026

Point d'arrêt d'une session interrompue. Ce qui est écrit ici a été **vérifié en
exécutant**, pas planifié. Ce qui reste à faire est signalé comme tel.

## Le jeu et ses archives

| Élément | Valeur |
|---|---|
| Installation | `C:\Program Files (x86)\Steam\steamapps\common\The Seven Deadly Sins Origin` |
| Socle Steam | `SevenDeadlySins\Content\Paks` — 6 paks, 912 Mo |
| Contenu live | `SevenDeadlySins\Saved\PersistentDownloadDir\PakCache` — 483 paks, 23 Go |
| Build installé | `1.8.1.2`, hash `ba6915377ce_274921` (lu dans `PakCache\CachedBuildManifest.txt`) |
| Format | pak version 11, UE 5.5, index chiffré AES-256 (GUID de clé nul = clé principale) |
| Anticheat | XignCode3 (`Binaries\Win64\Nmssw\`) — ne jamais scanner la mémoire du jeu |

**Clé AES** (vérifiée : déchiffre l'index de `pakchunk0`, point de montage `../../../`) :

```
0x8F3DB944AD41569DA8EB28966875CFCEEB04F137954B9E846B66862B3A898834
```

## Réglages FModel

FModel 4.4.4 dans `C:\Users\yanni\Downloads\FModel\FModel.exe`.

- **UE Version : `GAME_UE5_5`** — avec `GAME_UE4_28` (le défaut), tout échoue en
  `OverflowException` et un seul pak se charge.
- Mapping file : `C:\Users\yanni\Downloads\5.5.4-0+UE5-SevenDeadlySins.usmap`
- Désactiver `Preview New Explorer System` : sa barre de recherche ne trouve rien,
  pas même des noms de fichiers présents.
- Output Directory : `C:\Users\yanni\Downloads\FModel\Output`

## Où sont les données

**`SevenDeadlySins/Content/Table`**, dans `pakchunk950-Windows.pak`. Environ
1 540 tables.

Fausse piste déjà écartée : `Content/GameData/USLData` (17 tables `DBSC_####`)
ne contient que des grappes de ressources de téléchargement, pas des stats.
`Content/Cha` ne contient que de l'art et des blueprints.

Tables utiles repérées :

| Table du jeu | Correspondance dans `7ds-stats/personnages.json` |
|---|---|
| `Actor/HeroStatGroupTable` | 86 groupes `stat_####` : `B_Atk`, `B_Def`, `B_MaxHp`, `Move_Spd`, `A_Accuracy`, `A_Block`, `C_Critical_*`… |
| `Actor/HeroActorTable` | rattachement héros → groupe de stats — **illisible**, voir plus bas |
| `HeroMastery/HeroMastery` | 27 héros, clé = id (1001 = Tristan), donne `Common_Mastery_Tid` et les 3 `Weapon_Mastery_Tid` |
| `HeroMastery/HeroCommonMastery` | `commonMasteryTid`, `commonMasteryStats` |
| `HeroMastery/HeroWeaponMastery` + `…Group` + `…GroupExp` | `weaponMasteries` |
| `Skill/HeroPotentialRewardTable` | `potentials` — 1 seule ligne lue, à revoir |
| `Buff/BuffTable` | `data/buffs-supports.js` — **illisible** |
| `Item/ItemTable_Equip_*`, `Item/EquipSetOptionTable` | `armes.json`, `armures.json`, `sets.json` — **illisibles** |

## Résultats de comparaison déjà obtenus

Export de `Content/Table` : **1 517 tables, dont 420 lisibles et 1 097 vides.**

Les tables vides ne le sont pas dans le jeu : FModel échoue à les décoder avec
`FName could not be read, requested index <aberrant>, name map size <n>`, ce qui
signe un `.usmap` décalé par rapport au build `1.8.1.2`. Le usmap actuel annonce
`5.5.4-0`, qui est la version du **moteur**, pas celle du jeu.

Sur ce qui est lisible, les données du site sont **exactes**. Quatre lots
comparés, **aucun écart** :

- **Stats de base** — 25 héros × 11 colonnes (`baseHp`, `baseAtk`, `baseDef`,
  `baseSpd`, `accuracy`, `block`, `critRate`, `critDamage`, `critResist`,
  `critDmgResist`, `blockDmgResist`), identiques à `Actor/HeroStatGroupTable`.
  La clé de rapprochement est la convention **`stat_<id du héros>`** : le héros
  `1015` (Bug) porte le groupe `stat_1015`. Elle tient pour les 25.
- **Maîtrise commune** — `commonMasteryTid` et les 5 valeurs de
  `commonMasteryStats`. Bug : `B_Atk=480`, `B_Def=360`, `B_MaxHp=960`,
  `A_Accuracy=120`, `A_Block=90`, cumul des 30 paliers du tid `11001`.
- **Types d'armes** — les 3 `weaponSlots`, dans le même ordre que le jeu.
- **Maîtrises d'arme** — 375 entrées (25 héros × 3 armes × 5 paliers),
  expérience et gains de chaque sous-palier.

`pvpDmgUp`/`pvpDmgDown` valent 150/125 pour les 25 héros : une constante
globale, pas une donnée par personnage. `HeroStatGroupTable` n'a aucune colonne
PvP. Rien à vérifier de ce côté.

Autrement dit : les données reprises de 7dsorigin.app sont confirmées par les
fichiers du jeu sur tout ce qu'on a pu lire.

## Fausse piste : les potentiels de Derieri et Gowther

Dans `7ds-stats/personnages.json`, ces deux héros ont leurs **30 entrées de
potentiel avec `stats` vide**, alors que les 23 autres sont renseignés. Ce n'est
**pas un défaut à corriger** : `scripts/generate-stats-build.py` comble déjà le
trou en relisant la prose, et `data/stats-build.js` publie bien 500/400/200,
1500/1200/500 et 3000/2400/1000 pour les deux. Le générateur extrait même en
plus les bonus de catégorie du texte. Ne pas « réparer » le fichier source : il
est la référence là où il parle, et le générateur ne comble que ses silences.

À noter au passage : dans les potentiels, `stats` porte le **cumul** depuis le
palier 1, pas le gain du palier. Le texte, lui, annonce le gain. Bug/Hache p3
annonce +6/5/2 % et publie 900/700/300, parce que 300+600, 200+500, 100+200.

## Temps d'animation — extraits, 374 compétences sur 376

Les durées d'animation **sont dans les fichiers du jeu**, contrairement à ce que
suppose l'en-tête de `data/animations-mesurees.json`.

Les assets vivent dans `Cha/PC/PC_<Héros>/Ani/<Arme>/`, un dossier par type
d'arme. Le nommage colle au dépôt : le `gameId` `bug_axe_jumpatk` de
`data/competences.js` correspond à l'asset `Bug_Axe_JumpAtk`. Sur les 376
compétences du dépôt, **374 trouvent leur animation**, les deux manquantes étant
`klotho_book_skill_e_a` et `klotho_book_skill_q_a`.

Chaque montage (`_MTG`) porte trois choses :

- `SequenceLength` — la durée brute, en secondes.
- les marqueurs `EHit` — l'instant d'application des dégâts. **Un marqueur n'est
  pas un coup** : une seule marque peut déclencher une attaque à 13 coups. Le
  champ `coups` de `competences.js` n'est donc pas contredit par les 82 cas où
  les deux nombres diffèrent.
- les marqueurs `EEnableSkipBy*` — les **fenêtres d'annulation**, avec leur
  instant d'ouverture : `normalAttack`, `jump`, `avoidance`, `activeSkill`,
  `movement`, `tagOut`, `sameSkill`.

Ce sont les fenêtres qui comptent pour le DPS, pas la durée brute :

| | Tristan / Épées jumelles | Bug / Hache |
|---|---|---|
| somme des durées brutes du cycle | 6,500 s | 11,333 s |
| somme des temps enchaînables | 1,867 s | 1,750 s |
| écart | 71 % | 85 % |

**Contrôle de cohérence** : sur 320 animations portant à la fois des impacts et
une fenêtre `normalAttack`, **291 ouvrent la fenêtre après leur dernier impact**.
Les 29 exceptions sont presque toutes des `skill_tag` — le héros quitte le
terrain et ses dégâts continuent après la relève, ce qui est cohérent.

### La table officielle des temps d'action

`TextDatas/CData/HitNotify` contient **5 155 fichiers**, un par action, nommés
par identifiant — le même que le `gameId` de `data/competences.js`. Ce sont des
fichiers bruts, pas des assets : **ni le usmap ni les structures ne s'y
appliquent**, ils se lisent quel que soit l'état du reste.

```json
{ "ID": "tristan_sworddual_normalatk_4",
  "MontageName": "Tristan_SwordDual_NormalAtk_4_MTG",
  "TotalTime": 2.23333, "ActionSec": 2.23333, "SkipSec": 0,
  "HitList": [[0.06, 0.23, 0.36, 0.62]] }
```

C'est la source de référence, et elle **confirme l'extraction des montages** :
sur les entrées rapprochées, `HitList` reproduit les marqueurs `EHit` au
millième près, et `TotalTime` reproduit `SequenceLength` dans 2 223 cas sur
2 432. Deux chemins indépendants, le même résultat.

Attention, `SkipSec` **n'est pas** la fenêtre d'annulation : il vaut 0 sur les
auto-attaques. Les fenêtres n'existent que dans les marqueurs des montages.

Deux pièges de la table :

- **Variantes `grade_1_` à `grade_10_`** — 1 587 entrées, qui doublent une
  action existante. 149 ont une durée différente de leur base (9,5 %), surtout
  des compétences, surtout au `grade_10`, et plutôt plus longues.

  **Ce que « grade » désigne reste inconnu.** Quatre hypothèses testées et
  écartées, à ne pas re-tester :

  | Hypothèse | Ce qui l'infirme |
  |---|---|
  | Niveau de charge d'une compétence | Grades non contigus (`[2]`, `[9,10]`, `[1,2]`) ; durée monotone dans 6 familles seulement contre 12 décroissantes et 220 plates ; 282 des 696 familles sont des auto-attaques, qui ne se chargent pas |
  | Palier de potentiel | Corrélation inversée : les paliers purement statistiques changent la durée dans 25 % des cas, ceux qui modifient une compétence dans 7 % |
  | Rareté de l'objet | `EGrade` s'arrête à `Grade5` ; `ItemTable_Growth_LvGold` n'a que `grade_1` à `grade_5` |
  | Dépassement de limite de l'arme | Niveaux 0 à 6 seulement |

  Piste restante : les 14 cas qui infirment la piste des potentiels ne
  concernent que Howzer, Tioreh et Tristan, aux grades 1, 3 et 8. Tristan et
  Tioreh sont les héros de départ — ce pourraient être des versions de
  tutoriel. Non prouvé.

  Ce qui trancherait est dans `Table/Skill/SkillTable` ou `Actor/HeroActorTable`,
  tous deux bloqués par le usmap.
- **Identifiants fautifs** — `tristant_sworddual_normalatk_1` et consorts.

Les deux sont écartés du calcul des cycles.

### Fichiers produits

| Fichier | Contenu |
|---|---|
| `data/temps-action.json` | les 5 155 actions : durée, impacts, tirs, fenêtres quand elles sont connues. Couvre aussi monstres et PNJ. |
| `data/animations-extraites.json` | 1 906 animations lues dans les montages, avec les fenêtres d'annulation |
| `data/cycles-auto-attaque.json` | 79 cycles d'auto-attaque, dont 65 complets |

`data/animations-mesurees.json` n'a **pas** été touché : il est écrit à la main.
Là où les deux concordent, la mesure est confirmée ; là où ils divergent, c'est
qu'une mécanique s'intercale.

Régénération, après export FModel de `Cha/PC` puis de `TextDatas/CData/HitNotify` :

```
node outils/fmodel/extraire-tout.js       # les montages
node outils/fmodel/fusionner.js           # + la table officielle
node outils/fmodel/cycles-officiels.js    # les cycles
```

## La localisation, et ce qu'elle vérifie

`Content/Localization/Game/fr` — **56 400 chaînes françaises**, indexées par
identifiant. Ce sont des `.locres`, indépendants du usmap.

Le jeu stocke ses textes avec des paramètres (`{0}`, `{1}`) là où le dépôt cite
les valeurs déjà substituées. Toute comparaison doit donc neutraliser les
nombres des deux côtés — `outils/fmodel/verifier-phrases.js` le fait.

### Les phrases citées par `data/` : 150 sur 150

| Fichier | Phrases | Confirmées |
|---|---|---|
| `buffs-supports.js` | 43 | 43 |
| `passifs-graves.js` | 53 | 53 |
| `degats-supplementaires.js` | 29 | 29 |
| `passifs-armes.js` | 19 | 19 |
| `passifs-ensembles.js` | 6 | 6 |

Chaque phrase transcrite à la main existe mot pour mot dans le client.

### `sets.json` : intégralement vérifié

22 ensembles, appariés par `gameId`. **45 paliers chiffrés et 29 passifs
d'ensemble, tous concordants.** 21 noms sur 22 identiques.

Le seul écart n'en est pas un : `equip_t5_greed` pointe la clé
`local_item_set_name_equip_t5_greed`, qui vaut « Paramètre de promotion » — un
résidu. Le vrai nom est sous `..._greedyruler` = « Souverain cupide ». Le dépôt
a raison, la table du jeu pointe une clé périmée.

### Les potentiels : 31 divergences, dont 29 modélisées

Voir `docs/potentiels-divergents.md`. C'est le seul défaut de fond trouvé.

### `grade_N` est le palier de potentiel

La localisation publie `local_skill_<héros>_<arme>_potential_<n>_desc`, et
**334 des 341 descriptions correspondent à une variante `grade_` de même
palier** (98 %). La répartition confirme : quasi rien aux paliers 2, 3 et 8 —
purement statistiques — et l'essentiel aux paliers 5, 7 et 10.

Les quatre hypothèses écartées plus haut le sont sur des tests dont deux étaient
mal posés. Celui-ci s'appuie sur le jeu seul.

## Équipements : `armes.json` et `armures.json` vérifiés

`Item/Option_StaticTable` indexe ses lignes par **le `gameId` du dépôt** :
`weapon_main1_<gameId>`, `armor_main1_<gameId>`, `accessory_main1_<gameId>`,
avec les variantes `_reinforce`, `_equiplv`, `_promotion`. Le pont existe donc
sans passer par la table d'objets bloquée.

| Donnée | Étendue | Écarts |
|---|---|---|
| Statistiques d'armes (principale et secondaire) : valeur de base et progression | 428 couples | **0** |
| Paliers de promotion : niveau, or, renforcement max, matériaux et quantités | 798 | **0** |
| Dépassement de limite : niveau, expérience, passif, taux, or | 658 | **0** |
| Armures et bijoux : code de statistique principale et `reinforceMax` | 232 | **0** |

Les bijoux passent par le préfixe `accessory_`, pas `armor_`.

Attention à la casse des codes : le jeu écrit `B_MaxHP_Equip` là où le dépôt
écrit `B_MaxHp_Equip`, et `I_MaxHPAdd_Rate` contre `I_MaxHpAdd_Rate`. Toute
comparaison doit être insensible à la casse.

**Non vérifiable** : les bornes d'enchantement de `enchantements.json`. Les 1 086
options du dépôt ne correspondent à aucune ligne d'`Option_RandomTable`, mais
leurs 18 triplets distincts suivent un motif trop régulier (270–330 = 300 ±10 %,
720–880 = 800 ±10 %) pour être faux : elles semblent **calculées** autour d'une
valeur de base que porte une table bloquée.

## Ce qui reste à faire

1. **Un usmap généré sur le build `1.8.1.2`** débloquerait d'un coup les 1 097
   tables vides. C'est le geste qui rapporte le plus, et tout le reste en dépend.
2. **`potentials`** — introuvables dans les 420 tables lisibles.
   `Skill/HeroPotentialRewardTable` ne porte que la récompense de fin de palier
   (1 ligne). Les valeurs sont dans le lot bloqué.
3. **Élément et rôle par emplacement d'arme** — `ElementTable` (lisible) ne
   contient que des icônes ; le lien héros → élément est dans
   `Actor/HeroActorTable`, illisible.
4. **Armes, armures, sets, buffs** — `Item/ItemTable_Equip_*`,
   `Item/EquipSetOptionTable` et `Buff/BuffTable` sont tous illisibles.

## Note d'environnement

**Smart App Control est actif** sur cette machine
(`HKLM:\SYSTEM\CurrentControlSet\Control\CI\Policy` →
`VerifiedAndReputablePolicyState = 1`). FModel n'étant pas signé, le raccourci
épinglé à la barre des tâches est refusé (« Une stratégie de contrôle
d'application a bloqué ce fichier »). L'exe lui-même se lance normalement depuis
son dossier. Ne pas désactiver Smart App Control : la coupure est irréversible
sans réinstallation de Windows.

## Outils écrits pendant la session

Dans `outils/fmodel/`, à lancer avec `node` :

| Script | Rôle |
|---|---|
| `lister-paks.js` | lit l'index des 459 paks et écrit `tous-les-chemins.txt` (689 116 chemins, ~99 Mo). Attend la clé dans `CLE_PAK`, en hexadécimal sans `0x`. |
| `bilan-tables.js` | compte les tables exportées lisibles et vides |
| `voir-table.js` | affiche la structure et les premières lignes d'une table exportée |
| `aligner-heros.js` | apparie les 27 héros du jeu aux 25 du site |
| `comparer-masteries.js` | maîtrise commune + types d'armes |
| `comparer-armes.js` | les 375 entrées de maîtrises d'arme |

Appel type :

```
CLE_PAK=8F3D...8834 node outils/fmodel/lister-paks.js
node outils/fmodel/comparer-armes.js
```

Deux pièges rencontrés, à ne pas refaire :

- Les chemins internes des paks commencent par `../../../`, un `grep '^SevenDeadlySins'`
  ne trouve rien.
- `EItemDivision::EndWeapon` est une valeur sentinelle et non un type d'arme ;
  le type fiable d'un emplacement se lit sur l'icône du héros
  (`icon_mastery_sworddual`).
