# Passation Claude — Akumu, données FModel et état du site

Date de la passation : **2026-08-28**  
Dépôt : `C:\Users\yanni\Desktop\Site Confrérie 7ds`  
Langue de travail avec le propriétaire : **français**

## 1. Demande du propriétaire

Le propriétaire veut exploiter les fichiers du client de **7DS Origin** exportés
avec FModel afin d'améliorer son site de confrérie, en particulier le calculateur
de dégâts et les informations concernant **Akumu, bête démoniaque**.

Ses consignes explicites à conserver :

- Akumu va bien jusqu'au **niveau 30** dans le jeu ;
- ne jamais ajouter les dossiers d'images locaux à un commit sans nouvelle
  demande explicite ;
- continuer à distinguer les données certaines, les déductions et ce qui doit
  encore être contrôlé dans le jeu ;
- si une autre exportation FModel est nécessaire, donner le chemin précis à
  chercher dans FModel.

Lire intégralement `AGENTS.md`, puis `js/ARCHITECTURE.md`, avant toute
modification du code.

## 2. État Git exact au moment de la passation

Branche courante : `main`.

```text
HEAD        fc1d893490d0d5da1934011111db22b44d35726c
origin/main fc1d893490d0d5da1934011111db22b44d35726c
```

`main`, `origin/main` et `feat/integration-donnees-fmodel` pointent tous sur :

```text
fc1d893 feat(calculateur): ajouter les niveaux 21 a 30 d Akumu
```

La fusion et le push demandés par le propriétaire sont donc **déjà faits**.
Ne pas refaire de merge et ne pas fabriquer un commit vide.

Le commit `fc1d893` contient uniquement :

```text
docs/akumu-20-niveaux.md
js/metier/degats-calcul.js
js/vues/calculateur-etat.js
js/vues/calculateur-lignes.js
js/vues/calculateur.js
tests/calculateur.playwright.js
tests/degats-calcul.test.js
```

Aucune image n'est incluse dans ce commit.

État non suivi à préserver :

```text
?? docs/stats-monstres-discord.txt
```

Ce fichier appartient au propriétaire. Ne pas le supprimer, le déplacer, le
modifier ou le committer sans demande explicite.

Autre worktree visible :

```text
.claude/worktrees/ocr-stats-screens
branche worktree-ocr-stats-screens, commit 25ba9e4
```

Ne pas intervenir dans ce worktree pour la tâche Akumu.

## 3. Changements déjà terminés

### Statistiques maximales des tenues gravées

Le bug initial était : la section **« Statistiques au maximum »** s'arrêtait au
renforcement `+5` au lieu de tenir compte du plafond `+15` des tenues gravées.

Correction déjà publiée :

```text
731df9b fix(stats): appliquer le renforcement +15 aux tenues gravees
```

La documentation technique correspondante se trouve notamment dans
`docs/extraction-fichiers-du-jeu.md`, autour de la section expliquant la courbe
de renforcement `+6..+15`.

### Niveaux 21 à 30 d'Akumu

Les trente niveaux sont maintenant proposés par le calculateur. Les niveaux
21–30 viennent directement de `Actor/NpcStatGroupTable`, groupe
`stat_50700109`. Une comparaison automatisée des 30 lignes du site avec la
table FModel avait produit :

```json
{"niveaux":30,"ecarts":[]}
```

Valeurs de référence du niveau 30 :

- PV : `214 755 600` ;
- DEF : `80 264` ;
- résistance critique brute : `2 000`, soit `20 %` ;
- résistance aux dégâts critiques brute : `54 593`, soit `545,93 %`.

Attention à la rupture voulue entre les niveaux 20 et 21 : la résistance
critique passe de `12 235` (`122,35 %`) à `2 000` (`20 %`), puis reste à
`2 000` jusqu'au niveau 30. Ce n'est pas une interpolation.

Fichiers principaux :

- `js/metier/degats-calcul.js` — `AKUMU_PALIERS` et `AKUMU_ELEMENTAIRE` ;
- `docs/akumu-20-niveaux.md` — le fichier garde son ancien nom, mais son titre
  et son contenu couvrent bien 30 niveaux ;
- `tests/degats-calcul.test.js` ;
- `tests/calculateur.playwright.js`.

Dernière vérification complète effectuée avant la passation, au commit
`fc1d893` :

- tests unitaires : `82/82` ;
- parcours Playwright : `21/21` ;
- durée totale observée après fusion : environ `314,8 s`.

Ne pas annoncer de nouveaux résultats de tests sans les relancer.

## 4. CI GitHub Pages

Une exécution GitHub Actions antérieure, sur `731df9b`, avait l'état suivant :

- `test` réussi ;
- `package` réussi ;
- `deploy` annulé après avoir dépassé `10 min` ;
- annotation : `The job has exceeded the maximum execution time of 10m0s`.

Le job `deploy` de `.github/workflows/pages.yml` conserve actuellement
`timeout-minutes: 10`. Les commits suivants contiennent notamment :

```text
5c7e748 chore(ci): forcer un nouveau SHA pour debloquer le deploiement Pages
7abdae2 fix(wiki): les gravures possibles tiennent sur un ecran de telephone
fc1d893 feat(calculateur): ajouter les niveaux 21 a 30 d Akumu
```

L'état du dernier run GitHub n'a pas été contrôlé dans cette passation. Le
vérifier avant de conclure que le déploiement est réparé ou encore bloqué.
Le temps local des tests et le temps du job GitHub Pages sont deux sujets
différents.

## 5. Emplacements FModel

Export courant à utiliser en priorité :

```text
C:\Users\yanni\Downloads\FModel\Output\Exports\SevenDeadlySins\Content
```

Ancienne extraction, utile surtout pour certains assets de personnages :

```text
C:\Users\yanni\Downloads\FModel\Output\Exports-2.0-build-24909433\SevenDeadlySins\Content
```

Journal FModel utile :

```text
C:\Users\yanni\Downloads\FModel\Output\Logs\FModel-Log-2026-08-28.log
```

Index local des chemins de PAK :

```text
outils/fmodel/tous-les-chemins.txt
```

Cet index a été généré avec `outils/fmodel/lister-paks.js` : `468` PAK lus et
`703 055` chemins indexés. Quelques `pakchunk10000_*` n'ont pas été lus à
cause d'un pied de PAK introuvable ; cela n'a pas empêché l'identification des
assets Akumu.

## 6. Dernière exportation demandée au propriétaire

Le propriétaire a exporté en JSON :

```text
Maps/KnightRaid_Dungeon001_WP/KnightRaid_Dungeon001_WP.json
Maps/KnightRaid_Dungeon001_WP/KnightRaid_Dungeon001_WP/_Generated_/*.json
DataLayers/KnightRaid_Dungeon001_WP/KnightRaid_Dungeon001_WP/*.json
```

Constat :

- la carte principale est présente ;
- `48` JSON sont présents dans `_Generated_` ;
- les DataLayers `52005002_*`, `NavVolumes`, `Portal` et `SectorData` sont
  présents ;
- `_Generated_` contient seulement du décor, des lumières, du brouillard, de
  l'audio et des volumes techniques ;
- les JSON de DataLayer sont seulement des descripteurs d'assets avec une
  couleur de débogage ; ils ne contiennent pas les acteurs de gameplay ;
- aucun spawn d'Akumu, arbre de comportement ou déclencheur de mécanique n'a
  été trouvé dans ces JSON.

Conclusion : ne pas demander au propriétaire de réexporter ces dossiers. Les
spawns et règles utiles vivent principalement dans les tables déjà exportées.
Les identifiants `ai_boss_acumu_demon_0001` et `ai_acumu_stone` ne correspondent
à aucun chemin de fichier dans l'index des PAK ; ce sont des identifiants
internes/de table, pas des Behavior Trees exportables sous ces noms.

## 7. Faits confirmés sur le combat d'Akumu

Les éléments ci-dessous viennent des tables et animations du client. Conserver
les identifiants dans toute documentation technique afin que les résultats
restent auditables.

### Instance et apparition

- Donjon `1801` : `EDungeonType::Boss_Guild`.
- Limite : `300000 ms`, soit **5 minutes**.
- Boss : acteur `50700109`.
- Position du boss : `(X 0, Y 0, Z 806,90607)`, orientation `Yaw 90°`.
- Secteur restrictif : `KnightRaid_Boss_Restriction_Sector`.
- `IsLeaveRestriction = true` : le combat utilise une enceinte empêchant de
  quitter la zone.

Table de spawn :

```text
Table/Scene/Zone/52005002/spawn/KnightRaid_Dungeon001_Spawn_spawntable.json
```

### Cycle des cinq pierres

Le comportement `51300084_skill_1_start_sp1` fait apparaître exactement :

| Élément | Actor ID |
| --- | ---: |
| Feu | `50700102` |
| Glace | `50700103` |
| Foudre | `50700104` |
| Vent | `50700105` |
| Terre | `50700106` |

Les acteurs Ténèbres `50700107` et Sacré `50700108` existent dans les tables,
mais ne figurent pas dans cette liste d'apparition : ne pas les présenter comme
des pierres de la mécanique normale d'Akumu.

Chaque pierre possède :

- `10 000` PV ;
- `2 215` DEF ;
- aucune résistance/faiblesse contre son propre élément ;
- résistance brute `9999` et faiblesse brute `-9000` contre les autres
  éléments ;
- `Dying_Skill = 51300084_skill_1_groggy`.

Chaque mort de pierre applique au boss un cumul du marqueur `305033002` pour
`45 s`. Le marqueur est limité à cinq cumuls. Le comportement
`51300084_skill_1_stonebreak_weaken` vérifie explicitement :

```text
ChkBuff = 305033002
ChkBuff_Min = 5
ChkBuff_Max = 5
```

La vulnérabilité ne se déclenche donc qu'après les **cinq pierres**, et non à
chaque pierre. Elle applique `305033013` pendant `15 s` :

```text
D_All_DamRes_Rate = -5000
```

Interprétation cohérente avec les autres taux du jeu : Akumu subit alors
**+50 % de dégâts** pendant 15 secondes.

### Chronologie exacte de la mécanique

Les tables de compétence et les montages d'animation concordent :

| Étape | Compétence/montage | Durée |
| --- | --- | ---: |
| Début | `51300084_skill_1_start` | `2,4 s` d'action (`3 s` d'animation source) |
| Phase des pierres | `51300084_skill_1_loop` | **`30 s`** |
| Akumu réussit son attaque | `51300084_skill_1_end` | `5 s`, impact à `1,33 s` |
| Akumu échoue / fenêtre groggy | `51300084_skill_1_fail_ready` | **`12 s`** |
| Récupération après groggy | `51300084_skill_1_fail_end` | **`3 s`** |

Le montage de boucle de 30 secondes répète quinze fois une animation de deux
secondes. La branche `skill_1_end` inflige une attaque de Ténèbres décrite par
`dam_attacker_b_atk_dark_500_ignore_def`, dans un cercle de `3800`, ignore la
DEF et applique pendant `30 s` :

```text
305033017 : C_Critical_Dam_Rate = -10000
```

Donc l'échec à détruire les pierres produit une très grosse attaque ignorant
la défense et retire **100 % de dégâts critiques** pendant 30 secondes.

La fenêtre de vulnérabilité de 15 secondes correspond exactement aux `12 s`
de groggy plus `3 s` de récupération. Le rapprochement temporel est très fort,
mais le passage de l'IA entre ces compétences n'est pas présent dans les
assets exportables : formuler ce lien comme une déduction si une phrase exige
le détail de l'enchaînement interne.

### Attaque dans le dos

Le buff d'apparition `305033023` vérifie `EPackCondType::AtkBack` puis applique
`305033015` :

```text
D_All_DamRes_Rate = -100
durée = 5 s
MaxStack = 100
```

Chaque attaque dans le dos ajoute donc un cumul correspondant à **+1 % de
dégâts subis par Akumu**, jusqu'à 100 cumuls, chaque cumul durant 5 secondes.
Le jeu conseille explicitement les attaques dorsales dans sa stratégie.

### Renforcement d'Akumu à la mort d'un joueur

Les attaques d'Akumu appliquent conditionnellement `305033014` avec :

```text
ConType = EPackCondType::Kill
BuffTime = 600000
BuffCnt = 5
I_AtkAdd_Rate = 2000
MaxStack = 5
```

Les tables indiquent donc `+20 % ATK` par cumul, jusqu'à cinq. Comme
`BuffCnt = 5`, elles suggèrent fortement qu'une seule mort donne immédiatement
les cinq cumuls, soit **+100 % ATK**. Cette conclusion doit rester marquée
comme déduction tant qu'elle n'est pas contrôlée dans le jeu ou dans la logique
d'IA non exportée.

### Bonus d'ATK des joueurs après les pierres

Le comportement `51300084_skill_1_stonebreak_playerbuff` et le buff
`305033016` sont définis :

```text
I_AtkAdd_Rate = 2500
durée = 15 s
MaxStack = 1
```

Cela décrit **+25 % ATK aux joueurs pendant 15 secondes**. Toutefois, aucune
référence appelante de ce comportement n'a été trouvée dans les tables client
exportées. Il peut être invoqué par l'IA native/cuite, mais ne doit pas encore
être affiché comme un fait garanti sur le site.

### Autres affaiblissements appliqués par Akumu

Les comportements des attaques normales définissent notamment des effets de
30 secondes :

- dégâts reçus augmentés de `+50 %` ou `+100 %` selon la zone ;
- ATK `-80 %` ;
- DEF `-70 %` ;
- récupération d'endurance `-90 %` ;
- soins reçus `-90 %` ;
- dégâts critiques `-100 %` pour l'attaque de fin des pierres.

Les attaques normales et leurs temps/impacts sont déjà normalisés dans
`data/temps-action.json`, entrées `51300084_*`.

## 8. Résistances élémentaires : ne pas modifier le calcul trop vite

Les lignes brutes FModel d'Akumu indiquent :

- résistance élémentaire brute `5000` ;
- faiblesse brute `-3000` ;
- résistance au percement brute `2000` aux niveaux 1–20 ;
- puis `2020` à `2200` aux niveaux 21–30.

Le calculateur conserve volontairement les hypothèses historiques suivantes :

```js
resistanceElementaire: 3000,
faiblesse: 0,
resistancePercement: 0
```

La raison est documentée dans `AKUMU_ELEMENTAIRE` et
`docs/akumu-20-niveaux.md` : le sens exact et la combinaison des champs bruts
avec la formule de dégâts n'ont pas été validés dans le jeu. Ne pas remplacer
ces valeurs par `5000`, `-3000` et `2000..2200` sans protocole de mesure et
tests, car tous les dégâts calculés pourraient être faussés.

## 9. Améliorations recommandées pour la suite

Priorité recommandée : ajouter une **fiche de mécanique Akumu** dans le site,
séparée du multiplicateur de dégâts tant que les formules ne sont pas validées.
Elle peut afficher dès maintenant les faits certains :

1. cinq pierres et leur élément ;
2. fenêtre de destruction de 30 secondes ;
3. déclenchement à cinq pierres détruites ;
4. vulnérabilité de 15 secondes, dont 12 secondes de groggy et 3 secondes de
   récupération ;
5. attaque de punition ignorant la DEF si la mécanique échoue ;
6. attaque dans le dos : `+1 %` par cumul, 5 secondes, maximum 100 ;
7. durée totale du combat : 5 minutes.

Maintenir deux niveaux de confiance dans l'interface ou la documentation :

- **confirmé par les tables/animations** ;
- **à confirmer en jeu** : `+25 % ATK` des joueurs et `+100 % ATK` immédiat
  d'Akumu après une mort.

Le calculateur mentionne déjà les mécaniques comme hors calcul dans
`js/vues/calculateur.js`. Ne pas les intégrer automatiquement aux chiffres
avant de définir précisément leur activation et leur portée.

## 10. Prochaine reprise conseillée

Avant toute modification :

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Puis :

1. vérifier le dernier run GitHub Pages ;
2. présenter au propriétaire un design court de la fiche Akumu et obtenir son
   accord avant de coder ;
3. écrire d'abord les tests de la logique pure ;
4. conserver les mécaniques dans `js/metier/` et le rendu dans `js/vues/` ;
5. relancer `npm test` avant toute affirmation de réussite ;
6. ne jamais inclure `docs/stats-monstres-discord.txt` ni un dossier d'images
   dans un commit sans autorisation explicite.

Il n'est pas nécessaire de demander une nouvelle exportation FModel pour la
fiche décrite ci-dessus. Pour lever les deux incertitudes restantes, une mesure
ou une vidéo en jeu sera probablement plus utile qu'une nouvelle exportation
de carte.
