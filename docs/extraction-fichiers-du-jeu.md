# Extraction des fichiers du jeu (FModel) — état au 27 août 2026

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
- Mapping file : `C:\Users\yanni\Downloads\mappings.usmap` — case *Overwrite*
  cochée. C'est toujours ce nom-là que FModel lit ; chaque version reçoit en
  plus une copie nommée (`mappings-1.7.usmap`, `mappings-1.8.usmap`) pour
  qu'on sache laquelle est chargée.
- Désactiver `Preview New Explorer System` : sa barre de recherche ne trouve rien,
  pas même des noms de fichiers présents.
- Output Directory : `C:\Users\yanni\Downloads\FModel\Output` — voir la règle
  de rangement des extractions plus bas.

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

Voir `docs/potentiels-du-jeu.md`. C'est le seul défaut de fond trouvé.

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

## Le usmap `mappings-1.7` — 24 aout 2026

Un usmap plus fourni (3,2 Mo bruts contre 2,2 Mo) a debloque l'essentiel.
Malgre son nom, il fonctionne sur le build `1.8.1.2`.

| | Avant | Apres |
|---|---|---|
| Tables lisibles | 420 | **1 409** |
| Coquilles vides | 1 097 | 108 |

Reglage : `Settings` -> section du jeu -> bloc `Mappings`, case *Overwrite*
cochee. **Fermer et rouvrir FModel** : le mapping n'est lu qu'au chargement
des paks.

### 37 tables echouent ENCORE

Une table qui echoue au decodage produit le meme fichier de 430 octets qu'une
table reellement vide. **La taille ne permet pas de les distinguer** — seul le
journal le dit :

```
Output/Logs/FModel-Log-<date>.log
  [ERR] ... Could not read DataTable correctly
```

La ligne juste au-dessus nomme le fichier. Sur les 108 coquilles, 37 sont des
echecs et 71 sont vides pour de bon (Labyrinthos, mini-jeux, peche).

Trois echecs comptent :

```
Table/Skill/PC_SkillTable      <- la plus importante
Table/Skill/SkillTable
Table/Skill/Mon_SkillTable
```

`PC_SkillTable` est le candidat le plus probable pour les **temps de recharge**
et les taux de degats des competences. Tant qu'elle ne s'ouvre pas, on ne peut
pas conclure que ces valeurs sont calculees cote serveur : les 2 703 entrees
d'attaque de `PC_SkillBehaviorTable` ont toutes `AttackRate = 0`, mais ce n'est
pas la bonne table.

### Ce que le usmap NE change PAS

Verifie en reexportant tout et en comparant, pas suppose :

| | Resultat |
|---|---|
| Montages d'animation (`Cha/PC`) | **1 906 / 1 906 identiques** — duree, impacts, fenetres |
| `TextDatas/CData/HitNotify` | 0 / 5 155 fichiers modifies |
| `Localization/Game/fr/Game.json` | octet pour octet identique |

1 410 des 4 271 fichiers de montage ont pourtant **grossi**. Le supplement ne
concerne que des marqueurs qu'aucun script ne lit — `EAnimNotify_Sound`,
`EAnimNotifyState_SuperArmor`, cameras. `EEnableSkipBy*`, d'ou sortent les
fenetres d'annulation, n'apparait dans aucun echec du journal.

Consequence : les 45 % de montages sans fenetre d'annulation sont une
**propriete de la donnee**, pas un defaut de lecture. Et `animations-verrous.json`
est valide.

L'ancien export avait ete conserve pour cette comparaison dans
`Output/Exports-ANCIEN-usmap-5.5.4/`. Elle est faite : le dossier a ete supprime
le 25 aout, voir la section suivante.

## Le usmap 1.8 et le rangement des extractions — 25 août 2026

Un usmap plus récent est arrivé : `Downloads/mappings.usmap`, 3 232 103 octets,
md5 `4ac00d9a71d7ea1be4fca0dac02e98dc`, archivé sous `mappings-1.8.usmap`.
FModel le charge déjà (`Mappings pulled from 'mappings.usmap'` dans le journal).

`Content/Table` a été exporté le 25 août : 1 492 fichiers, 358 Mo, ~5 minutes.

### La règle : `Exports/` est toujours l'extraction courante

Les ~30 scripts d'`outils/fmodel/` codent en dur
`Output/Exports/SevenDeadlySins/Content/`. Plutôt que de les repointer à chaque
usmap, c'est le dossier qui bouge :

1. renommer `Exports/` en `Exports-usmap-<ancienne version>/` ;
2. y déposer un `LISEZ-MOI.txt` disant ce qu'il contient et pourquoi il survit ;
3. laisser FModel recréer un `Exports/` vide, où atterrit la nouvelle extraction.

Le renommage marche **FModel ouvert** — inutile de le fermer, contrairement à ce
qu'a fait croire l'échec sur `UIImg` en août.

État du disque de sortie :

| Dossier | Contenu |
|---|---|
| `Output/Exports/` | usmap 1.8 — `Table/` seulement (358 Mo). `Cha`, `TextDatas`, `Localization`, `UIImg` restent à ré-exporter si besoin. |
| `Output/Exports-usmap-1.7/` | 2,8 Go, l'extraction complète des 23–24 août |

`Exports-ANCIEN-usmap-5.5.4/` a été **supprimé** : sa seule raison d'être était
la comparaison des montages 1.7 contre 5.5.4, conclue plus haut (1 906 / 1 906
identiques). Une archive se garde le temps d'une comparaison, pas plus.

### Verdict : 38 tables débloquées, dont les trois tables de compétences

Mesuré en relançant `bilan-tables.js` sur les deux extractions, à la même aune
(il accepte désormais un chemin en argument) :

| | usmap 1.7 | usmap 1.8 |
|---|---:|---:|
| DataTable avec des lignes | 795 / 859 | **833 / 834** |
| DataTable creuses | 64 | **1** |

Le compte tombe juste : les 64 creuses de la 1.7 se répartissent en 25 non
ré-exportées (des `Scene/Sector/*_sectortable`, déjà vides), **38 débloquées**,
et 1 qui résiste — `Quest/QuestAreaPreview`, sans intérêt pour nous.

Et surtout, **zéro `Could not read DataTable correctly` dans le journal du
25 août** : les 42 erreurs qu'il contient datent toutes du 24.

Les trois cibles du doc sont ouvertes :

| Table | Lignes |
|---|---:|
| `Skill/PC_SkillTable` | 2 163 |
| `Skill/Mon_SkillTable` | 2 357 |
| `Skill/SkillTable` | 1 156 |

Le reste des 38 : `Actor/MonsterActorTable` (1 451), `Actor/NPCActorTable`
(1 415), `Achievement/DictionaryTable` (1 690), `Fx/FxTable` (1 288), les sept
tables `Quest/*` (2 181 au total), `Dungeon`, `Gacha`, `Labyrinthos`, `MiniGame`.

### Piège du bilan : `Table/` ne contient pas que des tables

`Table/Directing/` héberge **657 assets `OGDirecting_*`** — de la mise en scène
de cinématiques, sans clé `Rows` et sans être en échec pour autant. La première
version de `bilan-tables.js` les comptait comme vides et annonçait « 833 lues,
659 vides », soit une régression massive là où il n'y avait qu'un export sain.
Le script distingue maintenant trois catégories : DataTable lues, DataTable
creuses, et assets hors-sujet. Seule la deuxième signale un problème.

Un fichier reste à 0 octet dans les deux extractions :
`Scene/Sector/52003002_sectortable.json`. Antérieur au usmap 1.8.

### Ce que `PC_SkillTable` apporte

2 163 compétences, 115 colonnes, indexées par **le `gameId` du dépôt**
(`tristan_common_avoidanceskill`). Les 376 compétences de `data/competences.js`
s'y retrouvent **toutes les 376**.

`Cooltime` est en **millisecondes**. Confronté au champ `recharge` de
`competences.js`, repris de SevenCodex :

| | Compétences |
|---|---:|
| recharge des deux côtés | 224 |
| concordantes | **207** |
| divergentes | 17 |
| aucune recharge des deux côtés | 151 |
| recharge au dépôt, mais 0 dans le jeu | 1 |

Sur les 17 divergences, **13 sont une troncature à la seconde** de SevenCodex
(16,2 s publié 16 ; 7,5 s publié 7). Restent **4 vrais désaccords** :

| `gameId` | Dépôt | Jeu |
|---|---:|---:|
| `elizabeth_wand_skill_q` | 10,0 s | **11,0 s** |
| `elizabeth_wand_skill_r` | 11,0 s | **10,0 s** |
| `jericho_lance_skill_rmb` | 10,0 s | **12,1 s** |
| `manny_sword1h_skill_rmb` | 10,0 s | **11,2 s** |

Les deux premiers sont **inversés** : Q et R d'Elizabeth se sont échangé leur
recharge quelque part entre le jeu et la fiche.

Autres colonnes renseignées et pas encore exploitées : `UseStamina`,
`ChargeTime` (58 compétences), `CoolTimeGroup` (315 — des recharges partagées),
`ComboSkill`, `SkillMaxStack`, et l'économie de jauges (`UI_BurstGauge`,
`UI_TagGauge`, `UI_MagicForceGauge`).

**Pas de taux de dégâts dans cette table** : aucune colonne ne les porte. La
question reste donc ouverte, et `PC_SkillBehaviorTable` — dont les 2 703 entrées
d'attaque ont toutes `AttackRate = 0` — est à réexaminer avec le usmap 1.8.

### Ce que le usmap 1.8 ne change pas

Vérifié en ré-exportant et en comparant, pas supposé.

| | Résultat |
|---|---|
| `TextDatas` (dont `HitNotify`) | **8 323 / 8 323 identiques**, octet pour octet |
| `Cha/PC` | 16 518 fichiers de part et d'autre, **151 diffèrent en octets** |
| dont montages `_MTG` | 52 sur 4 489 |
| **marqueurs exploités** (`SequenceLength`, `EHit`, `EEnableSkipBy`) | **0 changement** |

Les 151 écarts se répartissent en 59 `AnimBP` (de la logique d'animation, pas du
chronométrage), 52 montages et 40 séquences diverses. Curiosité : **102 fichiers
ont maigri** avec le usmap le plus récent, contre 49 qui ont grossi.

Conséquence : `data/temps-action.json`, `animations-extraites.json`,
`cycles-auto-attaque.json` et `animations-verrous.json` **n'ont pas à être
régénérés**. Deux usmap successifs, le même résultat — la thèse « les montages
et les fichiers bruts ne dépendent pas du usmap » est maintenant vérifiée deux
fois plutôt que déduite.

## Comment les mises à jour du jeu arrivent sur le disque — 25 août 2026

**FModel ne suit pas le jeu en temps réel.** Il lit les paks au chargement et ne
les rouvre plus : ce qu'il montre est l'état du disque à l'instant de son
démarrage. Un `Directory → Reload` ou un redémarrage suffit à lui faire voir de
nouveaux paks.

Mais le piège est ailleurs. **`PakCache` est rempli par le téléchargeur du jeu,
pas par Steam.** Tant que le jeu n'est pas lancé, un correctif publié le jour
même n'existe nulle part sur la machine. Le 25 août, une mise à jour ajoutait Ban
et les armures de transcendance ; le disque, lui, n'avait pas bougé depuis le
**13 août** :

| Contrôle | Commande |
|---|---|
| Version installée | `grep BUILD_ID PakCache/CachedBuildManifest.txt` |
| Paks touchés depuis une date | `find PakCache -name '*.pak' -newermt '2026-08-24'` |
| Dernier lancement du jeu | date de `Saved/Config/Windows/GameUserSettings.ini` |

Ordre correct : lancer le jeu → laisser le patch descendre en entier → quitter →
**puis** démarrer FModel → exporter. Et se méfier : un nouveau build peut exiger
un nouveau usmap, exactement comme le 5.5.4 est devenu inutilisable.

## Le contenu dormant : sept héros livrés sans données

Les paks du 13 août contiennent des assets d'animation pour des héros **absents
de `HitNotify` comme de `PC_SkillTable`**. Le contenu arrive en couches : les
modèles et les animations d'abord, les données de jeu avec le correctif qui les
active.

| Héros | Montages | Avec fenêtre d'annulation | Armes |
|---|---:|---:|---|
| **Ban** | 137 | 41 | Cudgel3c, Gauntlets, Sword2H |
| **Calla** | 120 | 27 | Cudgel3c, Gauntlets, SwordDual |
| **Lancelot** | 81 | 8 | Staff, Sword1H |
| Estarossa | 14 | 0 | aucune |
| Estia, Estia_Var, Melascula | 0 | 0 | dossiers vides |

Pour l'échelle : Tristan pèse 182 montages / 44 fenêtres, Bug 172 / 60. Ban et
Calla sont donc à environ 75 % d'un héros fini, avec la structure à trois armes.

Leurs **durées et fenêtres d'annulation sont déjà exploitables** :
`ban_gauntlets_normalatk_1_mtg` donne `SequenceLength = 2,667 s`, un `EHit` et
6 marqueurs `EEnableSkipBy`. Leurs dégâts et leurs recharges, non — ça vit dans
les tables, et elles sont vides pour eux.

**Piège d'appariement** : ne jamais découper un identifiant au premier `_`.
`gil_thunder_sword1h_normalatk_1` se range alors sous `gil` et Gilthunder passe
pour un héros dormant alors qu'il est publié (slug `gil-thunder` au dépôt,
identifiants `gil_thunder_*` dans le jeu). Même piège pour `guila_demon` et
`daisy_golem`, qui ont bien leurs données. Apparier sur le préfixe complet, en
excluant les noms plus longs.

Au passage, deux entités de combat que le site ne couvre pas : `daisy_golem`
(12 temps d'action, 13 compétences) et `guila_demon` (16 et 18). Reste à savoir
si leurs dégâts comptent à part ou sont attribués à Daisy et Guila — les tables
seules ne le disent pas.

Côté **transcendance**, ne pas chercher dans les tables seules : rien n’y
apparaît, mais la localisation en porte déjà la trace.
`local_item_material_name_101100201` vaut « Essence de transcendance », et
l’objet `101100201` existe dans `Item/ItemTable_Data_Etc`, avec sa recette
et son démontage.

Attention au vocabulaire : `ui_manageheroes_bt_transcendence` et
`ui_transcendenceheroes_title` se traduisent tous deux par « **Potentiel** ».
Ce que le jeu nomme transcendance en interne est le système de potentiels que le
site couvre déjà — une « armure de transcendance » est donc vraisemblablement
l’extension de ce système à l’équipement, pas un système sans rapport.

La localisation confirme aussi l’état intermédiaire de Ban : **25 clés
`local_hero_name_*`** — exactement les 25 héros du site — mais **27 clés
`local_hero_desc_*`**. Les deux en trop sont `ban_01` et `meliodas_01`
(distinct de `master_meliodas_01`, le Meliodas jouable). Ban a une fiche, pas
de nom, pas de compétences.

## Les taux de dégâts ne sont pas dans le client — tranché le 25 août

Question ouverte depuis août, close par la négative. Le usmap 1.8 ouvre les trois
tables qui manquaient ; aucune ne porte de taux de dégâts.

| Table | Lignes | Colonne de taux |
|---|---:|---|
| `Skill/PC_SkillTable` | 2 163 | **aucune** parmi 115 colonnes |
| `Skill/SkillTable` | 1 156 | **aucune** parmi 115 colonnes |
| `Skill/PC_SkillBehaviorTable` | 3 845 | `AttackRate` existe, **vaut 0 sur les 2 703 entrées** |

Le doc réservait son jugement : « on ne peut pas conclure que ces valeurs sont
calculées côté serveur, ce n'est pas la bonne table ». Les bonnes tables sont
maintenant ouvertes, et la réponse ne change pas.

Le détail d'attaque `BehaviorDetail_AttackTid` porte pourtant toute la
structure attendue — `AttackRate`, `AddAttackRate_HPRate`,
`HitTarget_AtkRate`, `CondMyBuff_AtkRate_List`,
`CondTargetBuff_AtkRate_List` — et **tous ces champs sont à zéro**, y compris
la `Value` des listes conditionnelles.

Deux exceptions, qui prouvent que le zéro est une donnée et pas un défaut de
lecture : `BackAtk_AtkRate` vaut 3 500 sur 23 entrées, et
`Charge_Element_Value` porte 40 à 120 sur 2 172 entrées. Les champs
fonctionnent ; ce sont les taux de base qui sont absents.

**Conséquence pour le site** : les pourcentages d'ATK de `data/competences.js`,
repris de 7dsorigin.app, **ne sont pas vérifiables contre les fichiers du jeu**.
Ils vivent côté serveur. Ne pas relancer cette chasse à chaque nouveau usmap.

## Un usmap plus complet DECALE des colonnes — 25 août 2026

Le piège le plus coûteux de la journée, et il ne ressemble pas à une panne : les
scripts tournent, ne lèvent aucune erreur, et rendent zéro résultat.

`HeroMastery`, ligne 1001, lue par les deux usmap :

| Colonne | usmap 1.7 | usmap 1.8 |
|---|---|---|
| `Weapon_Mastery_Reward` | *colonne inconnue* | `Tristan_SpecialMastery_Reward` |
| `String_Tid` | `Tristan_SpecialMastery_Reward` | `1001` |
| `Local_Key` | `1001` | `None` |

Le usmap 1.7 ignorait `Weapon_Mastery_Reward`. Sa valeur atterrissait donc
dans `String_Tid`, et celle de `String_Tid` dans `Local_Key` : **toute
la fin de la ligne était décalée d'un cran**. Le 1.8 connaît la colonne et lit
juste.

Quatre scripts cherchaient le nom du héros dans `String_Tid` et rendaient
soudain **0 héros apparié** — sans message d'erreur, puisque la colonne existe
toujours, elle contient juste autre chose. Corrigés en lisant
`Weapon_Mastery_Reward` avec repli sur `String_Tid`, ce qui garde la
lecture des extractions archivées :
`aligner-heros.js`, `comparer-armes.js`, `comparer-masteries.js`,
`comparer-stats-base.js`.

**La règle à retenir** : un usmap plus complet n'ajoute pas seulement des tables
lisibles, il peut **changer l'interprétation de tables qui se lisaient déjà**.
Après tout changement de usmap, relancer les scripts de comparaison et se méfier
d'un résultat qui tombe à zéro plutôt que de lever une erreur.

### Les conclusions d'août tiennent sous la lecture corrigée

Vérifié en relançant toute la chaîne sur l'extraction 1.8 :

| Contrôle | Résultat |
|---|---|
| `comparer-stats-base` | 25 héros appariés, **0 écart** sur 11 champs |
| `comparer-masteries` | 25 héros vérifiés, **0 écart** |
| `comparer-armes` | 375 entrées, **0 écart** |
| `verifier-sets2` | 45 paliers, **45 concordants** |
| `verifier-passifs-sets` | 29 passifs, **29 retrouvés** |
| `verifier-phrases` | **153 phrases sur 153** (le doc en annonçait 150 ; `buffs-supports.js` en a gagné 3 depuis) |

Attention en relançant : `verifier-phrases.js` **attend les fichiers en
argument**, sinon il ne fait rien et sort en code 0 :

```
node outils/fmodel/verifier-phrases.js buffs-supports.js passifs-graves.js \
     degats-supplementaires.js passifs-armes.js passifs-ensembles.js
```

### L'export courant est complet

`Table`, `TextDatas`, `Cha` et `Localization` sont tous présents
sous le usmap 1.8. `Localization` apporte au passage `GamePatch/`, la
surcouche de textes d'un correctif live : elle est **vide**, ce qui confirme une
fois de plus que rien n'est arrivé sur ce client depuis le 13 août.
`Game.json` fr est identique octet pour octet à celui de la 1.7.

## Le contenu arrive en trois couches — 25 août 2026

Constat le plus utile de la session, et il change la façon de chercher : un objet
n'apparaît pas d'un coup. Le client reçoit ses morceaux dans un ordre fixe, et
`Item/ItemTable_Data_Equip` est le **dernier** servi.

| Couche | Ce que le client a | Armures gravées |
|---|---|---:|
| 1 — déclarée | ligne d'objet, qualité, rareté, icône, passifs | **85** |
| 2 — nommée | stats, recette, nom traduit dans les 13 langues | **15** |
| 3 — muette | stats et recette seulement, aucun nom nulle part | **4** |

Conséquence méthodologique : **ne jamais recenser un type d'objet depuis
`ItemTable_Data_Equip` seule.** Un recensement fait le 25 août sur cette table
annonçait « 86 armures liées, 85 au dépôt, une seule nouveauté » — faux. En
repartant d'`Item/Option_StaticTable`, on trouve **107 équipements qui ont leurs
statistiques sans ligne d'objet**, dont 19 armures gravées.

La bonne source pour « qu'est-ce qui existe » est `Option_StaticTable` ; la bonne
source pour « qu'est-ce qui est jouable » est `ItemTable_Data_Equip`.

### Ce que les data miners publient avant nous

Une fiche publiée le 25 août pour `133255003` (« Défense minimale »,
équipement gravé de Gowther) se reconstruit **au chiffre près** depuis les paks
du 13 août, jusqu'au renforcement +5 :

```
+N    PV calculé / publié
+0    14739 / 14739     +3    16508 / 16508
+1    15181 / 15181     +4    17392 / 17392
+2    15771 / 15771     +5    18424 / 18424
```

Formule : `Value_Add_2` d'`armor_main1_<id>` multiplié par chaque
`Value_Add_1..5` d'`armor_main1_reinforce_<id>`, en dix-millièmes.

Puis ça s'arrête net. Les fiches montrent +6 à +15 sous une bannière
« Transcendence Refinement » — or **aucune entrée `_reinforce` du jeu ne porte
de valeur dans `Value_Add_6..10`**, pour aucun objet. Les cinq emplacements
existent dans le schéma et sont vides partout. La transcendance est exactement
l'extension du renforcement de +5 à +15, et c'est la seule chose qu'il faut un
build plus récent pour obtenir.

Autrement dit : ils ont le build suivant, mais l'essentiel de ce qu'ils publient
est déjà chez nous.

### `armures-gravees-nouvelles.json`

`node outils/fmodel/extraire-gravees-non-declarees.js` écrit les 19 armures
des couches 2 et 3 dans `7ds-stats/armures-gravees-nouvelles.json`, au format
d'`armures-gravees.json`.

**Fichier séparé, volontairement.** Les entrées sont incomplètes : sans ligne
d'objet, `qualityMin`, `qualityMax`, `tierBoundaries`, `rarity`, `personnage`,
`costumeSlug`, `iconUrl`, `engravingPassives`, `randomOptions` et
`growth.promotion` restent à `null`. Les fusionner dans le fichier vivant est une
décision à part, pas un effet de bord de l'extraction. Chaque entrée porte un
champ `provenance` qui liste ses trous.

Deux pièges rencontrés en écrivant l'extracteur :

- **La casse des codes de stat n'est pas dérivable.** Le jeu écrit
  `B_MaxHP_Equip` et `UltimateSkill_DamAdd_Rate` ; le dépôt écrit
  `B_MaxHp_Equip` et `Ultimateskill_Damadd_Rate`. Aucune règle mécanique
  ne relie les deux — passer par les clés de `libelles-stats.json` et
  `stat-metadata.json`, comparées sans casse.
- **La position dans `Value_Add_N` n'est pas une donnée.** Un
  `equiplv_15` range toujours sa valeur unique en `Value_Add_2`, et le
  dépôt n'en garde que la valeur. Élaguer les zéros de tête **et** de queue ;
  les `reinforce`, qui remplissent 1 à 5, en sortent intacts.

Le mappage entre les deux, vérifié sur une entrée déjà publiée et non deviné :

| Jeu | Dépôt |
|---|---|
| `armor_main1_<id>` | `mainStat` |
| `armor_main2_<id>` | `growth.extraStats`, slot `main` |
| `armor_sub1_<id>` | `subStat` |
| `armor_sub2_<id>` | `growth.extraStats`, slot `sub` |

## Reconstituer une progression d'équipement — 25 août 2026

Deux modèles, vérifiés chacun contre des fiches publiées par des data miners
travaillant sur un build plus récent. Les deux partent de données que **notre
client possède déjà**.

### Armes : 50 paliers depuis deux lignes

Cinq paliers de promotion de dix niveaux. Le client donne tout :

| Ligne | Champ | Rôle |
|---|---|---|
| `weapon_main1_<id>` | `Value_Base` | le socle |
| `weapon_main1_<id>` | `Value_Add_1..5` | le gain par niveau, un par palier |
| `weapon_main1_promotion_<id>` | `Value_Add_1..4` | le bonus au passage de palier |

```
depart[0] = Value_Base
valeur(palier T, niveau L) = depart[T] + pas[T] x L          L de 1 a 10
depart[T+1]                = depart[T] + pas[T] x 10 + bonus[T]
```

Éprouvé sur le Nunchaku de l'âme vorace (`131055010`) : base 637,
pas `[15, 20, 27, 37, 52]`, bonus `[115, 229, 343, 457]`.
**54 valeurs justes, 0 écart** — les 50 niveaux et les 4 lignes de promotion.

Le `Max Reinforce +50` de la fiche n'a donc pas à être lu : il découle des
cinq pas de progression.

Le dépassement de limite se lit directement dans
`ItemTable_Growth_Overlimit` : le groupe `overlimit_weapon_t5_type1`
reproduit la table « Limit Break » publiée — or, bonus de statistique et niveaux
de passif, au dernier chiffre.

### Armures : les multiplicateurs de transcendance

Les armures gravées plafonnent à +15, pas +50, et suivent une logique
multiplicative et non additive. Le client donne les paliers 1 à 5 dans
`armor_*_reinforce_<id>` (`Value_Add_1..5`) et **laisse 6 à 10 à zéro**.

Ces cinq-là se déduisent des fiches publiées, par division :

```
+1..+5   10300 10700 11200 11800 12500   lus dans le client
+6..+15  12750 13000 13250 13500 13750
         14000 14250 14500 14750 15000   deduits, pas constant de 250
```

Vérification : 5 mesures indépendantes aux paliers +6 et +7, 2 par palier
au-delà, sur **deux héros** (Gowther et Ban) et **deux statistiques** (PV et
Défense). Aucun désaccord, écart d'arrondi jamais supérieur à 1 pour 10 000.

Consigné dans `7ds-stats/transcendance-multiplicateurs.json`, avec un bloc
`_provenance` qui distingue le lu du déduit. **À remplacer par une lecture
directe** dès que `Value_Add_6..10` sera renseigné.

### Les 107 équipements non déclarés

`node outils/fmodel/extraire-equipements-non-declares.js` écrit
`7ds-stats/equipements-non-declares.json` : **52 armes, 43 armures,
12 bijoux**, dont **103 portent déjà leur nom français**. Les 4 anonymes sont les
armures gravées de Ban.

Trois structures, chacune avec sa convention d'élagage :

| Famille | Emplacements | Progression |
|---|---|---|
| arme | `main1` (+ `sub1` pour 35) | s'arrête à la première valeur nulle, comme `verifier-stats-armes.js` |
| bijou | `main1` + `_equiplv` + `_reinforce` | élaguée des deux côtés |
| armure | jusqu'à `main1 main2 sub1 sub2 sub3` | élaguée des deux côtés |

### Ban : ce qu'on a et ce qu'on n'a pas

Ses quatre armures gravées sont l'index **27** : `133274001`,
`133275001`, `133275002`, `133275003`. L'index se lit sur les deux
chiffres qui suivent `133` — 01 Tristan … 25 Gowther, 41 Derieri, et 23, 26,
27 restaient vides. Que 27 soit Ban n'a **pas** été déduit : les fiches publiées
portent « Only For : Ban ».

Attention : `Sort` de `HeroActorTable` n'est **pas** cet index — 12
accords contre 33 désaccords. Ce sont deux numérotations sans rapport, et Ban n'a
aucune ligne dans `HeroActorTable`.

Et une arme n'appartient à personne : elle va par type. Le Nunchaku de l'âme
vorace n'est pas « l'arme de Ban » — `Cudgel3c` est déjà manié par Diane,
Griamore, Howzer et Slader. Les fiches d'arme n'ont d'ailleurs pas de champ
« Only For », contrairement aux armures gravées.

## La version 2.0 — 26 août 2026

Le jeu est passé en `2.0.0.0`, hash `ad1d412c970_281752`, mise à jour Steam du
build `24651645` vers `24909433` — 4,53 Go téléchargés, 16,6 Go recomposés.

### Le usmap de la 2.0

| | octets | md5 | noms |
|---|---|---|---|
| `mappings-1.7.usmap` | 3 201 369 | | 78 432 |
| `mappings-1.8.usmap` | 3 232 103 | `4ac00d9a71d7ea1be4fca0dac02e98dc` | 79 213 |
| **`ban-update.usmap`** | 3 281 061 | `07531df1f5994e3f38926e6c52f463aa` | **80 456** |

Un `.usmap` **ne contient aucun numéro de version du jeu** : les seuls octets de
version sont ceux du format (`0x04`, identique aux trois). Les noms `1.7` / `1.8`
sont des étiquettes posées à la main. Pour dater un usmap, il faut comparer son
contenu — 1 187 noms nouveaux et 94 disparus entre le 1.8 et celui-ci.

Le format se lit ainsi : magie `0x30C4`, version sur un octet, puis le corps
**à l'offset 16** — nombre de noms sur 4 octets, puis chaque nom précédé de sa
longueur sur **deux** octets. Partir de l'offset 12 donne du charabia qui
consomme quand même tout le fichier sans lever : le décodage semble marcher.

### LE PIÈGE : un usmap périmé ment en silence

L'export du 26 août a d'abord tourné avec le usmap 1.8 sur les fichiers 2.0.
Résultat, invisible sans comparaison :

- **9 tables 2.0** sorties en coquilles vides (~460 octets, un `RowStruct` et
  rien dedans) : `UELabyrinthos*`, `UEEventBingo*`, `UEPetDoubleJumpTable`…
- **24 tables lisibles en 1.8 devenues vides** : `SoundSFXAssetTable`
  14 501 → 0, `Option_StaticTable` 3 464 → 0, `PortalTable` 1 097 → 0,
  `ItemTable_Data_Equip` 760 → 0.
- Des **troncatures silencieuses**, les plus vicieuses parce qu'elles ne sont
  pas vides : `DungeonTable` 132 → **1**, `SectorAreaOpenTable` 76 → **1**,
  `SoundVoiceAssetTable` 27 067 → **4 793**. Le décodeur s'arrête à la
  première ligne qu'il ne comprend pas.

Le journal de FModel le dit, à condition de le lire : `Mappings pulled from
'<fichier>'`, et des `Missing prop mappings for type <UEChose>` pour les types
inconnus. **Vérifier cette ligne avant toute analyse.**

Bilan des trois combinaisons, en tables `DataTable` porteuses de lignes :

| extraction | avec lignes | vides |
|---|---|---|
| jeu 1.8 + usmap 1.8 | 833 | 1 |
| jeu 2.0 + usmap 1.8 | 832 | **34** |
| jeu 2.0 + usmap 2.0 | **865** | 1 |

### Vérifier qu'aucune colonne n'a décalé

Le décalage de colonnes documenté plus haut (section du 25 août) ne s'est PAS
produit au passage 1.8 → 2.0, et c'est vérifié plutôt que supposé. La méthode,
à refaire à chaque usmap :

1. Comparer les tables **ligne par ligne**, pas fichier par fichier : un diff
   de 217 793 lignes peut ne contenir aucun écart de valeur.
2. Pour chaque ligne commune, comparer **champ par champ**. Les seuls écarts
   admissibles sont des colonnes AJOUTÉES en fin de ligne, avec leur valeur
   par défaut sur l'existant.
3. Se méfier des **réordonnancements**. Sur 23 entrées de maîtrise d'arme, les
   nœuds avaient changé d'ordre sans changer de valeur — tous de grade 1, donc
   sans conséquence. Comparer les ensembles triés, pas les tableaux.

Ce qui a réellement changé côté colonnes : `Value_Add_11` à `Value_Add_15` sur
`Option_StaticTable` et `GrowthTypeRangeTable`, `Hide_Passive_Level` sur les
passifs d'équipement, et `LimitBreak_Passive` / `LimitBreak_Option` /
`RewardBox_PopupName` sur toutes les `ItemTable_Data_*`.

### Ce que la 2.0 apporte

- **Ban** (`1021`), jouable : trois armes, `Base_Skill_Key: "1021"`, sa ligne
  dans `HeroMastery`. Son arbre de maîtrise `210211*`–`210213*` existait déjà
  sous le nom générique `ui_heromastery_weapon_title_special`, renommé en
  `ui_heromastery_weapon_title_cudgel3c` — « Maîtrise des nunchakus ».
- **Khala** (`1029`) : posée mais pas sortie. `Base_Skill_Key: "None"`,
  `StatGroupTid` recopié de Daisy (`stat_1028`), portraits pointant sur
  `liz_001`, **452 fichiers d'animation et zéro image**.
- **Le Limit Break** : 78 passifs `eplb_<héros>_b/c/d`, trois par héros pour 26
  héros, plus 156 lignes `armor_limitbreak1` / `armor_limitbreak2` — deux
  paliers, armures uniquement.
- **Les ultimes combinés** : `CombineSkillTable` passe de 630 à 672. Les 42
  combinaisons ajoutées sont toutes celles de Ban, aucune perdue. Attention,
  les identifiants de ligne ont été **renumérotés** : comparer par paire
  (propriétaire, frappeur), jamais par numéro, sous peine de croire que des
  héros se sont fait voler leurs combinaisons.
- Deux montures : le **Destrier royal** (`26070118`, le seul familier à double
  saut) et le **Bourdoléphant du miel** (`26070315`).
- Labyrinthos et son balayage, le Donjon du 『Livre stellaire』, le boss
  **Monspiet (Indura)**, un bingo, une lucky box, le chapitre 07.

### La Chaîne, la mécanique de Ban

`ban_cudgel3c_passive` (« Rythme jubilatoire ») pose un cumul de **Chaîne**
chaque fois que Ban touche trois fois la même cible, jusqu'à 5, pour 20 s.
Chaque cumul vaut +2 % de percement et +6 % de chances critiques, et plusieurs
effets du nunchaku s'indexent en plus dessus. Confirmé par un joueur : sur un
boss, la pile reste saturée. Les effets qui en dépendent sont donc modélisés
au maximum, en `passif-max`.

### Les trois mécaniques de Ban — résolues le 27 août 2026

Elles étaient données pour inconnues la veille. Elles ne le sont plus : les
valeurs se lisent dans `Table/Buff/BuffTable`, une fois le bon nom de buff
trouvé. Le hotfix du 26 au soir a livré les traductions françaises qui
manquaient, et c'est un libellé traduit qui a donné le dernier nom.

| Mécanique | Buff | Ce qu'il fait vraiment |
| --- | --- | --- |
| **Brèche** | `302293005` | Résistance au Déluge −20 %, dégâts subis **+25 %** |
| **Brèche** (renforcée) | `302293024` | Résistance au Déluge −20 %, dégâts subis **+55 %** |
| **Détournement** | `302293021` | `F_Def → Dark_Res` −20 % |
| **Berserker** | `302292002` / `302292021` | Dégâts crit. +20 %, défense crit. +25 % |
| **Berserker** (complet) | `302292024` | Dégâts crit. **+50 %**, défense crit. +25 %, dégâts +20 % |

Deux pièges se cachent là-dedans, et ils illustrent la règle de la maison —
**le code de la stat tranche, jamais la prose du jeu**.

Le premier : les deux lignes de Brèche portent `ActiveElement: None`. La hausse
des dégâts subis porte donc sur **tous** les dégâts, alors que le texte français
dit « dégâts des Ténèbres subis ». Le texte se trompe, pas la table.

Le second : Détournement n'est pas un −20 % plat. C'est `F_Def → Dark_Res`, une
réduction **indexée sur la défense** du porteur. Lu de travers, on obtient un
tout autre nombre.

Enfin, le +25 % et le +55 % de Brèche ne se contredisent pas : ce sont deux
lignes distinctes. Le texte de la compétence décrit la première, la table de
buffs publiée par 7dsorigin affiche la seconde.

**Berserker est permanent, par arithmétique.** L'ultime de l'épée à deux mains
y fait entrer pour 12 s ; sa recharge est de 10 s. Joué sur recharge, l'état ne
retombe jamais — ce qui autorise `passif-max` sur les effets qui en dépendent.
Ce n'est pas une hypothèse de confort comme la saturation de Chaîne, c'est une
soustraction. Si un patch porte la recharge au-delà de 12 s, la règle devient
fausse : la vérification tient dans `data/competences.js`, entrée
`ban_sword2h_skill_r`.

### Deux familles d'images chez 7dsorigin

Un même costume est servi sous deux formes, et **`iconUrl` publié dans
`armures-gravees.json` pointe sur la mauvaise** pour notre usage :

| chemin | rend | format |
|---|---|---|
| `/images/costumes/icon_<Héros>_00N.webp` | le personnage qui porte la tenue | 256 × 512 |
| `/images/items/<gameId>.webp` | **la tenue seule** | 256 × 256 |

Le catalogue veut la pièce d'équipement, donc le second. Même logique que les
bijoux dans `telecharger-images.py`.

Les badges élément/rôle vivent ailleurs encore :
`/images/ui/role-elements/<element>_<role>.webp`, en 50 × 50. Ils ne sont pas
dans le jeu — c'est l'artwork de 7dsorigin. Le rôle donne la forme, l'élément
la couleur. `dark_buster` manquait : les Gantelets de Ban sont la première arme
Buster de Ténèbres, et un badge absent n'affiche qu'un carré blanc sans rien
casser. `tests/badges-role-element.test.js` garde désormais le cas.

### SevenCodex publie en retard

SevenCodex n'avait pas Ban le jour de sa sortie — 25 personnages, ceux d'avant
la 2.0. `generate-competences.py` traite maintenant un 404 sur leur fiche comme
« pas encore chez eux » et se rabat sur les recharges arrondies de 7dsorigin,
qu'`extraire-recharges.js` remplace ensuite par celles du client. Toute autre
erreur reste levée.

L'ordre compte : `extraire-recharges.js` s'apparie au catalogue commité, donc
un héros neuf n'a ses recharges précises qu'au **second** passage.

## Les transcendances entrent dans le calcul — 27 août 2026

### La règle du jeu, et pourquoi aucun champ n'a été ajouté

Une transcendance n'agit **que si la tenue gravée qui l'a donnée est portée**.
Ce n'est pas un bonus de compte.

Elle exige en plus le dernier palier de promotion de la pièce. Le site ne suit
pas la promotion — et n'en a pas besoin, parce que `ItemTable_Growth_Promotion`
(groupe `limitbr_armor_t5_default`, identique pour les 78) plafonne le
renforcement palier par palier :

| Palier | Renforcement max | Réussite |
| --- | --- | --- |
| 0 (départ) | +5 | — |
| 1 | +10 | 80 % |
| 2 | **+14** | 50 % |
| 3 | **+15** | 30 % |

**On ne peut donc pas atteindre +15 sans avoir transcendé trois fois.** Le
renforcement maximal *prouve* la transcendance, et c'est ce que teste
`dps-effets.js`. Attention au palier 2 : il plafonne à **+14**, pas +15 — une
suite lue « +5 / +10 / +15 » ferait compter le bonus un cran trop tôt.

Le sens de l'erreur est voulu : une pièce transcendée mais pas encore renforcée
à fond passe pour non transcendée, et son bonus manque. Le chiffre est
sous-estimé, jamais flatté — même règle que le niveau de passif inconnu.

Les taux de réussite ci-dessus donnent leur sens à
`ui_menu_limitbreak_failed_rate` : la troisième transcendance rate deux fois
sur trois.

### Les 30 règles, dérivées de cinq phrases

Le jeu **ne publie pas** la statistique touchée. `SkillTable` ne contient
qu'une coquille vide de passif, et `BuffTable` n'en cite qu'une sur trois, sans
ligne d'abilité : le calcul est côté serveur. Seule la phrase française dit à
quoi le nombre se rapporte.

`extraire-transcendances.js` porte donc une table de **cinq phrases** — la
seule interprétation du fichier — ancrée sur la phrase entière (`^…$`) et non
sur un fragment, sans quoi « Augmente les dégâts des Ténèbres de tous les héros
alliés de 30 % » passerait pour un bonus au héros :

| Phrase | Cible | Combien |
| --- | --- | --- |
| Augmente les dégâts de compétence normale de N % | `normal-skill` | 14 |
| Augmente les dégâts d'attaque ultime de N % | `ultimate` | 9 |
| Augmente les dégâts d'attaque spéciale de N % | `special` | 5 |
| Augmente les dégâts d'attaque normale de N % | `normal` | 1 |
| Augmente les dégâts de compétence de relève de N % | `tag-skill` | 1 |

Ce que la table ne reconnaît pas n'a **pas** de règle, et l'extracteur affiche
le compte. Un patch qui reformule une phrase fera donc *baisser* ce compte au
lieu de publier un bonus muet — `tests/transcendances-catalogue.test.js` refuse
tout écart à 30, et vérifie pour chacune que la valeur stockée est bien le
nombre qui suit immédiatement la phrase citée.

### Le lien tenue ↔ transcendance

Par identifiants, jamais par nom : deux héros portent « Sortie décontractée ».

```
engravedByFile[fichier].slug  →  ban-costume-134102102
CostumeTable                  →  Open_Condition_Value = 133274001
ItemTable_Data_Equip          →  LimitBreak_Passive = EpLb_Ban_B
```

Le compte se ferme : **93 tenues gravées, 78 transcendables, 15 sans** — les
quatrièmes tenues des 15 héros qui en ont quatre. Tristan est le cas qui
discrimine dans les tests : quatre tenues, trois transcendances, donc un
rapprochement fait dans l'ordre se ferait attraper.

### L'arme de chaque transcendance — un repère, pas une condition

`BindArmor_RecommendEquip_WeaponType` donne le type d'arme de chaque tenue
transcendable. La correspondance est une **bijection sur les 26 héros** : les
trois transcendances d'un héros visent ses trois armes, jamais deux fois la
même. Et l'effet colle au kit à chaque fois — chez Ban, l'ultime au nunchaku,
la compétence normale à l'épée à deux mains, le buff de Ténèbres d'équipe aux
gantelets, qui sont justement son arme Ténèbres.

⚠️ **Mais ce n'est qu'une recommandation.** Tranché par un joueur le 27 août
2026 : le passif de transcendance est lié **à la tenue**, pas à l'arme. Porter
« Cuisinier remplaçant » avec les gantelets garde les +50 % d'ultime. Le nom du
champ le disait déjà, et les tables le confirmaient — le passif ne porte aucune
condition d'arme, et les effets sont génériques (toutes les armes ont un
ultime).

`dps-effets.js` applique donc le bonus dès que la tenue est portée au
renforcement maximal, **sans regarder l'arme**. L'arme est publiée pour
l'affichage seul : le wiki l'annonce « Conseillée avec : Nunchaku », sous le
nom de la transcendance.

### Où la transcendance s'affiche

**Deux endroits, et ce sont deux questions différentes.**

Sur la **fiche du héros**, section « Armures gravées » : *laquelle de mes trois
tenues dois-je monter ?* Les trois y sont côte à côte, comparables d'un coup
d'œil.

Sur la **fiche de la pièce**, section « Transcendance », entre le passif et les
statistiques : *cette pièce-là vaut-elle d'être poussée jusqu'au bout ?* C'est
la page qu'on consulte avant de dépenser ses matériaux, et le passif juste
au-dessus ne répond qu'à moitié — il s'obtient dès le premier niveau, la
transcendance seulement au renforcement maximal.

Les 15 tenues non transcendables n'affichent **aucune** section, comme une arme
sans passif : une rubrique creuse ferait croire à une donnée manquante.

### Une seule section, celle des armures gravées

La fiche de héros a porté une section « Transcendances » du 26 au 27 août 2026,
listant les trois passifs. Elle a été **retirée** : les armures gravées, juste
en dessous, redonnaient les mêmes trois phrases en disant **en plus quelle
pièce les donne**.

Le cas qui tranche est Meliodas. Deux de ses transcendances portent le même nom
*et* le même texte — « Transcendance de puissance : Technique », dégâts de
compétence normale +50 %. Hors de leur tenue, elles sont **indiscernables**. Sur
les armures gravées, elles ne le sont plus : l'une vient de « Défense simple »
(conseillée à la hache), l'autre d'« Une nouvelle aventure » (épée à une main).

La leçon vaut au-delà de ce cas : une liste d'effets sans leur source n'est pas
une information, c'est un rappel. La question d'un membre n'est jamais « quels
sont mes trois passifs » mais « quelle pièce dois-je monter ».

## Savoir si le jeu a bougé sans tout ré-extraire — 27 août 2026

Un hotfix est tombé **le soir même de l'extraction 2.0**. Méthode pour mesurer
ce qu'il a changé sans relancer cinq heures d'export.

### Établir qu'il y a eu un patch

`C:/Program Files (x86)/Steam/logs/content_log.txt` tient l'historique complet
des mises à jour, horodaté. La ligne qui compte :

```
[2026-08-26 19:21:39] AppID 3679080 finished update, 1 mounted depots (BuildID 24929381)
```

L'extraction du matin portait sur le **BuildID 24909433**, celle du soir sur
**24929381** : 31 fichiers mis à jour, 35,7 Mo téléchargés. Une date de fichier
ne suffit pas à le dire — Steam réécrit un pak entier pour un delta, et un
`LastWriteTime` change sans qu'aucun octet utile ne bouge.

Le manifeste du jeu, lui, donne sa propre version :
`Saved/PersistentDownloadDir/PakCache/CachedBuildManifest.txt`, en tête,
`$BUILD_ID = 2.0.1.1`. Si `LocalManifest.txt` porte les mêmes SHA1, le client
est à jour et rien n'est en attente.

### Prouver qu'aucun asset n'a été ajouté ni retiré

FModel journalise chaque pak monté avec son nombre de fichiers :

```
Mount: Pak "pakchunk950-Windows.pak": 2928 files, mount point: ...
```

Deux sessions encadrant le patch, un `awk` sur les lignes `Mount:`, et la
comparaison tombe : **469 paks des deux côtés, aucun écart**. Ça ne prouve pas
l'égalité des octets, mais ça élimine d'un coup toute création ou suppression
d'asset — donc tout contenu réellement neuf.

### Ne ré-extraire que ce qui peut avoir bougé

`outils/fmodel/tous-les-chemins.txt` dit quel pak porte quoi. Croisé avec la
liste des paks modifiés, on sait où regarder :

| Ce qu'on cherche | Pak | Poids |
| --- | --- | --- |
| `Content/Table` (1 672 fichiers) | `pakchunk950` | 20 Mo |
| `Content/Localization` | `pakchunk0` + `pakchunk10` | 94 Mo |
| `TextDatas/CData/HitNotify` | `pakchunk0` | 13 Mo |
| `Cha/PC` (animations) | `pakchunk0` | **1,5 Go** |

**Choisir une sonde plutôt que tout sortir.** `HitNotify` vit dans le même pak
que `Cha/PC` et pèse cent fois moins. Ses 5 411 fichiers ressortis identiques à
l'octet près rendent une modification des animations voisines très peu crédible
— les 1,5 Go n'ont pas été extraits, et n'avaient pas à l'être.

### Le résultat, et ce qu'il apprend

Archiver l'export précédent sous `Exports-2.0-build-24909433/` (nommé par
BuildID : la convention `Exports-usmap-1.8` ne sépare plus rien quand les deux
extractions partagent le même usmap), ré-exporter, puis comparer en SHA1.

* **Tables : 1 571 identiques sur 1 579.** Les 8 écarts sont de la
  progression — numérotation de quêtes, verrous de zone, un libellé de
  classement, quatre costumes de Derieri qui gagnent une récompense. Aucune
  table de combat n'a bougé : ni `BuffTable`, ni `SkillTable`, ni les
  potentiels, ni les maîtrises, ni les transcendances.
* **HitNotify : 5 411 identiques sur 5 411.**
* **Localization : 12 fichiers de langue sur 28.** Côté français, 36 clés
  modifiées, **0 ajoutée, 0 retirée** — presque toutes des traductions
  manquantes enfin remplies (la clé s'affichait telle quelle). Aucune n'est
  utilisée par `data/` ni `7ds-stats/` : rien à régénérer.

C'est pourtant Localization qui a payé. La clé
`local_buff_ban_sword2h_1_desc_2`, sans traduction la veille, nomme l'état
**Berserker** — le dernier des trois blocages de Ban. Le nom trouvé, les
chiffres suivent dans `BuffTable`.

**Leçon générale : un hotfix qui ne touche aucun chiffre peut quand même
débloquer un travail, en nommant ce qui n'avait pas de nom.**

### Un raté reproductible de FModel

`Table/ConditionLogic/Condition.uasset` (6 630 lignes, 6,5 Mo dans l'export du
26) **ne ressort plus**, sur deux tentatives, sans la moindre erreur au journal
— FModel note pourtant la demande d'extraction. Ses deux voisines de dossier
sortent identiques, donc le pak est sain. Sans effet sur le site : cette table
sert aux conditions de déclenchement de quêtes.

## Ce qui reste à faire

1. **Ce qui reste dehors chez Ban** — les trois mécaniques sont résolues
   (section ci-dessus) et deux potentiels de plus sont modélisés, mais six
   effets restent hors du comparateur, désormais pour des raisons de
   **structure** et non d'ignorance :
   * Brèche et Détournement sont des débuffs posés sur la **cible**. Le
     comparateur compare des builds à cible constante ; ils profitent à toute
     l'équipe et sortent de son périmètre, comme les `effet-equipe`.
   * Le passif des gantelets majore les dégâts critiques de la **seule
     attaque normale**. `bonus-critique` ne porte pas de champ de portée —
     `cible` n'existe que pour les règles de recharge — et une règle
     `critDamage` globale majorerait aussi compétences et ultime. Élargir la
     grammaire des règles reste à faire ; surestimer serait pire que taire.
   * La **compétence normale améliorée** n'a pas d'entrée propre dans
     `data/competences.js` : le jeu la décrit à l'intérieur du texte de
     `ban_sword2h_skill_e` au lieu de lui donner un identifiant. Les
     potentiels 4 et 9, qui la majorent, n'ont donc rien où s'accrocher.
2. **Dix potentiels étiquetés à tort `sans-impact-dps`** — la règle générique
   y range les majorations d'une **sous-partie** nommée d'une compétence (une
   frappe précise, une forme améliorée) faute de cible à accrocher. Les deux
   de Ban sont corrigés en `non-inclus` ; il en reste huit, chez Daisy,
   Derieri, Manny, Meliodas, Slader et Tristan. L'effet existe, il n'est pas
   compté : `non-inclus` le dit, `sans-impact-dps` le nie.
3. **Les 48 transcendances hors calcul** — sur 78, **30 sont branchées** dans
   le comparateur (voir la section ci-dessous). Les 48 autres majorent
   l'équipe (43) ou frappent la cible (5) : hors périmètre, comme les autres
   `effet-equipe`. Elles auraient leur place dans
   `data/buffs-supports.js` le jour où les buffs d'équipe seront traités.
4. **Les buffs d'équipe de Ban** — `data/buffs-supports.js` est écrit à la
   main et ne le contient pas : joué en soutien, son apport est ignoré.
5. **Khala** le jour où elle sortira : elle demandera une passe complète, de
   l'image au catalogue.
6. **`CoolTimeGroup`** (315 compétences) et l'économie de jauges, jamais
   regardés. Les 4 recharges fausses et les décimales de SevenCodex sont
   réglées : `extraire-recharges.js` les lit dans le client.
7. **Question 3 des buffs de soutien** — voir
   `docs/buffs-portee-lue-dans-le-jeu.md` : le taux elementaire du receveur
   multiplie-t-il le buff plat ? Question de formule, pas de table. Seule une
   mesure en jeu repond.
8. **La constante C du calcul de degats** — intestable depuis les fichiers, il
   faut un coup sur cible defendue.

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
| `extraire-recharges.js` | les recharges de `PC_SkillTable`, au millième |
| `extraire-transcendances.js` | les 78 passifs de Limit Break → `data/transcendances.js` |

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
