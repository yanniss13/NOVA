# Chantier calculateur — fichier de travail partagé (Claude ↔ Codex)

Ouvert le 1er septembre 2026. **Lis `AGENTS.md` d'abord**, il reste le point
d'entrée du projet ; ce fichier-ci ne couvre que le calculateur de dégâts et
son catalogue d'effets.

## Comment on travaille à deux dans ce fichier

1. **Un constat n'entre ici qu'avec sa preuve** — une commande qui le montre,
   un fichier et une ligne, ou une mesure. Pas de « il semble que ».
2. **Chaque chantier porte une case et un propriétaire.** Prends-en un, écris
   ton nom dedans, et laisse les autres tranquilles : deux agents sur le même
   fichier généré, c'est un conflit garanti.
3. **Ne régénère jamais `data/effets-dps.js` sans lancer la suite ensuite.**
   `node scripts/lancer-tests.js unit` doit rester à 83/83.
4. **La règle de la maison** : le code de la stat tranche, jamais la prose du
   jeu, et jamais un site tiers. Quand une source externe contredit une mesure
   locale, c'est une **question ouverte**, pas une correction à appliquer.
5. Ce qui est **écarté** est écrit ici aussi (section « fausses pistes »).
   Relis-la avant d'ouvrir une enquête : elle a déjà coûté du temps.

## État du dépôt à l'ouverture

Quatre fichiers modifiés **non commités**, tous verts en test :

```
 M data/effets-dps.js
 M scripts/generate-effets-dps.py
 M tests/effets-dps-catalogue.test.js
 M tests/test_generate_effets_dps.py
```

C'est le correctif du chantier 0 ci-dessous. Ne pas régénérer par-dessus sans
avoir lu ce qu'il fait.

**Mise à jour du 3 septembre 2026.** Le catalogue a été régénéré depuis les
fiches françaises après correction de l'URL du générateur. Les 391 compétences
publiques ont désormais leur `texteFr`; le total reste à 2 283 sources et 393
compétences, avec des règles et classifications strictement identiques hors de
ces textes. Le test de catalogue refuse désormais toute nouvelle description
française vide, sauf pour les deux compétences synthétiques.

---

## Chantier 0 — FAIT : le double comptage des potentiels

**Propriétaire : Claude. Revu et finalisé par Codex le 1er septembre 2026,
en attente de commit.**

`stats-calcul` compte déjà les stats d'un potentiel via `potentialsByWeapon`
(`data/stats-build.js`), en repliant `I_AtkAdd_Rate` sur `B_Atk`. Le générateur
d'effets a un garde pour ne pas les recompter — il jugeait sur le champ `stats`
de `7ds-stats/personnages.json`. Or **ban, derieri et gowther** en sortent avec
`stats: []` sur leurs trente paliers ; `generate-stats-build.py` reconstruit
alors leurs chiffres depuis la prose. Le garde ne se déclenchait pas, une règle
`bonus-stat` était émise en plus, et `dps-effets` la réappliquait.

**Effet mesuré** : attaque ×1,690 au lieu de ×1,300 au palier 10, sur les trois
armes des trois héros. PV max ×1,10 de trop.

**Correctif** : `couverture_des_potentiels()` lit `data/stats-build.js`,
l'artefact que la PWA charge. La question posée est désormais celle à laquelle
`stats-calcul` répond. Le garde exige les trois codes de la forme de base
(`I_AtkAdd_Rate`, `I_DefAdd_Rate`, `I_MaxHpAdd_Rate`) et refuse explicitement
une couverture partielle : il ne peut donc ni masquer une stat absente, ni
réarmer silencieusement une voie de double comptage.

**Périmètre prouvé** : le catalogue conserve ses `2 283` sources. Seules
`27` entrées changent : les paliers P1, P3 et P8 des trois armes de ban,
derieri et gowther. Les `234` potentiels qui suivent la forme de base sont
couverts une fois, et une seule.

Vérification :

```
node tests/effets-dps-catalogue.test.js
# effets DPS : catalogue coherent (2283 sources, 234 potentiels de forme de base comptes une seule fois)

python -m unittest tests/test_generate_effets_dps.py
# Ran 86 tests — OK

npm test
# unit 83/83, e2e 23/23 — total 235,6 s
```

---

## Chantier 1 — La constante C : 5600 local contre 5128 publié

**Libre. Impact : précision absolue, nul sur un classement.**

`js/metier/degats-calcul.js:26` pose `CONSTANTE_PAR_DEFAUT = 5600`, documenté
comme le « milieu de l'intervalle 5500-5700 publié » (spec du 4 août 2026).

`https://7dsorigin.app/en/damage-formula` publie depuis une valeur **mesurée**,
pas un intervalle :

> « Measured 2026-08-20: the Scorpybeast's stacked defense-buff plateaus
> (junction, sector 10) give a unique solution K = 5,128, cross-validated on
> four defense states (gaps < 0.1%). »

Et elle la donne **universelle**, quand le dépôt modélise C comme propre au
personnage, à son build et à ses potentiels.

Écart sur la mitigation, aux paliers d'Akumu :

| Palier | DEF | C=5600 | K=5128 | écart |
|---|---|---|---|---|
| 1 | 3 454 | 0,6185 | 0,5975 | +3,5 % |
| 10 | 14 453 | 0,2793 | 0,2619 | +6,6 % |
| 20 | 38 544 | 0,1269 | 0,1174 | +8,0 % |
| 30 | 80 264 | 0,0652 | 0,0601 | +8,6 % |

**Ce qui n'est PAS en jeu** : le comparateur reste juste, l'écart se simplifie
dans un rapport entre deux builds. C'est le mode prédictif — « combien je vais
taper » — qui dérive.

**Ce qui trancherait** : une calibration réelle. `calibrerConstante()` existe
déjà ; si plusieurs membres calibrent et que leurs C se groupent autour de
5128, la thèse « universelle » gagne et la machinerie par membre devient un
absorbeur d'autre chose. S'ils divergent franchement, c'est le dépôt qui a
raison et il faut l'écrire.

**Ne pas remplacer 5600 par 5128 tant que ce n'est pas mesuré ici.** Changer un
défaut sur la foi d'un site, c'est troquer une incertitude documentée contre
une autre qui ne l'est pas.

## Chantier 2 — Le critique contre Akumu

**TRANCHÉ par la table du client, 1er septembre 2026. Corrigé.**

Akumu porte une défense critique qui explose avec le palier : 50 % au niveau 1,
**545,93 %** au niveau 30 (`js/metier/degats-calcul.js`, table `AKUMU_PALIERS`).
Les deux modèles ne divergeaient que là où le multiplicateur passerait sous 1 —
c'est-à-dire exactement là où la confrérie joue.

### Ce qui a tranché

`docs/constantes-combat-du-jeu.md`, section « Plafonds et planchers — les bornes
que le jeu applique en fin de calcul » :

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_min_critical_dam_rate` | 10000 | 100 % |

Elle voisine `battle_min_damres_rate` = 500, dont les 5 % sont exactement ceux
que le module applique déjà comme `PLANCHER_DEGATS` — ce plancher-là vient du
datamine 7dsorigin, et la table du client le confirme au chiffre près. Retenir
une borne de cette section et écarter sa voisine ne se défend pas.

Le plancher ne peut pas mordre **avant** la soustraction de la défense critique :
les dégâts critiques d'un build valent déjà au moins 100 % par construction
(`ga_default_criticalpowerper_rate` = 12000). Une borne qui ne mord jamais ne
serait pas dans la table. Elle s'applique donc après.

### Ce qui plaidait pour l'ancien modèle, et pourquoi ça ne suffit pas

`RAPPORT-analyse-tapscreen.md` section 4 : à `cd` = 0 contre 42,93 % de défense
critique, tapscreen rend **36 329** en critique contre **63 658** en non-critique
— ratio 0,5708, mesuré en boîte noire, non ambigu. La mesure est solide.

Mais elle prouve ce que fait **l'outil**, pas ce que fait le jeu — c'est
exactement ce que dit déjà la table de crédit des sources plus bas. Et l'outil
d'en face, 7dsorigin, plancherise à ×1,00. Deux modèles tiers qui se
contredisent ne pèsent pas contre la table du client.

⚠️ **Le commentaire du module induisait en erreur** : il présentait ce
comportement comme une mécanique de jeu (« un critique peut frapper plus faible
qu'un coup normal ») sans dire que la source était un calculateur tiers. Corrigé
en même temps que le code.

### Ce qui change

`Math.max(0, 1 + degatsCrit)` → `Math.max(1, 1 + degatsCrit)`.

| CD build | niv 17 | niv 20 | niv 25 | niv 30 |
|---|---|---|---|---|
| 150 % — avant | 0,79 | 0,34 | **0,00** | **0,00** |
| 150 % — après | 1,00 | 1,00 | 1,00 | 1,00 |
| 350 % — avant | 2,79 | 2,34 | **0,05** | **0,00** |
| 350 % — après | 2,79 | 2,34 | 1,00 | 1,00 |

À partir du palier 21, le taux critique n'est plus un handicap : il est
**neutre**. Sur un build à 90 % de taux et multiplicateur planché, le facteur
critique passe de ×0,10 à ×1,00 — un facteur 10 sur la fiche Akumu.

Daisy garde tout son intérêt, pour une raison plus juste : elle ne retourne plus
une pénalité en bonus, elle **débloque** un gain que la défense critique
neutralisait.

### Ce qui reste à faire

La mesure en jeu reste souhaitable, non plus pour trancher mais pour confirmer :
frapper Akumu palier 25+ avec un build à critique garanti et comparer au coup non
critique. Égal = table confirmée ; inférieur = la table ne dit pas ce qu'on croit.
**Le correctif Ban du patch 2.0.2 la rend faisable** : les valeurs de ses coups
s'affichent enfin (voir `docs/extraction-fichiers-du-jeu.md`).

## Chantier 3 — La formule sort de sa plage mesurée dès le palier 17

**Libre. À documenter avant tout, corriger ensuite si besoin.**

7dsorigin borne explicitement sa propre formule :

> « the K/(K+DEF) form remains an approximation outside the measured range
> (DEF 0 → 26,727) »

Or Akumu dépasse cette borne **à partir du palier 17** (DEF 30 029), et la
triple au palier 30 (DEF 80 264). Toute la zone où la confrérie joue est donc
en extrapolation, y compris chez la source.

Ce n'est pas un bug : c'est une limite qui n'est écrite nulle part dans le
dépôt et qui devrait l'être, au moins en commentaire dans `degats-calcul.js` et
dans l'aide de la page. Un chiffre extrapolé qui ne se présente pas comme tel
est plus dangereux qu'un chiffre absent.

## Chantier 4 — Les chantiers déjà connus, inchangés

Ils vivent dans `docs/extraction-fichiers-du-jeu.md`, section « Ce qui reste à
faire ». Rien de ce que j'ai vu aujourd'hui ne les déplace :

1. Six effets de Ban hors du comparateur, pour des raisons de **structure**
   (Brèche et Détournement sont des débuffs de cible ; le passif des gantelets
   demande une portée que `bonus-critique` ne porte pas ; la compétence normale
   améliorée n'a pas d'identifiant propre).
2. Huit potentiels étiquetés `sans-impact-dps` à tort, chez daisy, derieri,
   manny, meliodas, slader et tristan.
3. Les 48 transcendances hors calcul (43 pour l'équipe, 5 pour la cible).
4. **Soutien de Ban partiellement fait le 3 septembre 2026** (`a04027f`) :
   Détournement (défense des Ténèbres −20 %, attaque des Ténèbres +30 %) et
   Brèche (dégâts subis +25 %) sont dans `data/buffs-supports.js`. Le cumul
   d'« Instinct de voleur » reste dehors tant que sa permanence en combat
   n'est pas mesurée (`docs/mesures-en-jeu/1-ban-en-soutien.md`).
5. Khala, le jour où elle sortira.
6. `CoolTimeGroup` et l'économie de jauges, jamais regardés.
7. Question 3 des buffs de soutien — mesure en jeu.
8. La constante C → **devient le chantier 1 ci-dessus**, la mesure existe.

---

## Chantier 5 — Passe systématique des 200 constantes contre le code

**Ouverte. Faite une première fois le 1er septembre 2026, résultats ci-dessous.**

Le chantier 2 est sorti d'une lecture de `docs/constantes-combat-du-jeu.md`,
pas d'une méthode. La passe complète a été faite ensuite. Voici son état.

### Ce qui concorde, vérifié

| Constante | Valeur | Code |
|---|---:|---|
| `ga_critical_rate_max` | 9000 | `PLAFOND_PROPRE` |
| `battle_max_critical_rate` | 10000 | `PLAFOND_TOTAL` |
| `battle_max_sum_protect_cur_rate` | 9000 | `PLAFOND_PERCEMENT` |
| `battle_min_damres_rate` | 500 | `PLANCHER_DEGATS` (5 %) |
| `battle_min_critical_dam_rate` | 10000 | plancher du multiplicateur, **chantier 2** |

`ga_criticalpowerper_rate_range_max` = 20000 (200 %) n'est **pas** un plafond du
multiplicateur critique : le relevé Derieri en jeu (dégâts critiques 126,46 %,
soit un multiplicateur de 2,2646) le dépasse et tombe juste à 1e-4 près. Ne pas
le brancher.

### Candidat A — la mitigation peut-elle dépasser 1 ?

`battle_max_damres_rate` = **10000**, soit 100 %, dans la même section de bornes
finales. Si `damres_rate` désigne le facteur de dégâts après mitigation, alors
`mitigation × résistance` devrait être **plafonné à 1**, et le percement au-delà
du point où `C/(C+DEF) + percement = 1` ne rendrait plus rien.

Le module fait l'inverse et l'assume : « la mitigation peut dépasser 1, et les
dégâts dépasser alors la valeur pré-armure », sur cinq mesures tapscreen
prédites à l'avance (session 3).

**Non tranché, et à ne pas trancher au jugé.** Deux lectures possibles de
`damres_rate` : facteur de dégâts final (→ plafond) ou statistique de résistance
`D_All_DamRes_Rate` (→ rien à voir). Le poids de puissance de combat
`battle_p_d_all_damres_rate` = 4500 existe sous ce nom de stat, ce qui plaide
pour la seconde. Le module avertit déjà : « ne pas le borner par bon sens sans
mesure à l'appui ».

**Ce qui trancherait** : un coup en jeu avec plus de percement qu'il n'en faut
pour annuler la défense de la cible, comparé au même coup sur mannequin nu.

### Candidat B — le plafond de percement, 90 % ou 150 % ?

`PLAFOND_PERCEMENT` = 9000 vient de `battle_max_sum_protect_cur_rate`, dont le
nom colle exactement à la stat `D_Protect_Cur_Rate`. Mais la table porte aussi
`ga_pierceper_rate_max` = **15000** (150 %), `min` = 7500, `default` = 10000 —
et tapscreen accepte justement 150 % sans broncher.

Deux clés, deux mécaniques probablement distinctes (`protect_cur` = brèche
d'armure, `pierceper` = autre chose). Le choix actuel reste le mieux nommé.
**Ne rien changer sans savoir ce que `pierceper` désigne.**

### Écart cosmétique, sans effet aujourd'hui

`js/metier/dps-simulation.js:716` borne le taux de réduction de recharge à
**9999**, garde-fou anti-division-par-zéro, là où le jeu porte
`battle_max_skillrecycle_rate` = **9000** (90 %).

**Inatteignable** : une seule règle `recharge-taux` en `application:"base"` existe
dans tout `data/effets-dps.js` — drake/Sword2h, `all-skills`, **30 %**. Aucun
chiffre affiché ne bouge. À aligner le jour où un héros dépassera 90 %.

### Non modélisé, déjà documenté

La couche précision / blocage (`A_Accuracy` contre `A_Block`) : `ga_accuracy_rate_max`
= 9500, `ga_block_rate_max` = 6000, `battle_default_block_rate` = 1000. Aucune
formule publiée pour l'affrontement toucher/bloquer. Reste débranchée.

`PLAFOND_FAIBLESSE` = ×6 vient du datamine 7dsorigin. La table porte
`ga_weaknessdmgrate` = 50000, lisible en ×5 comme en +500 % (= ×6). Ambigu, et
sans effet : Akumu n'a aucune faiblesse.

---

## Fausses pistes — ne pas rouvrir

- **207 potentiels « +N% attaque » classés `sans-impact-dps`** chez les 23
  autres héros. C'est **correct** : le catalogue les porte sous
  `I_AtkAdd_Rate`, pas sous `B_Atk`. Chercher `B_Atk` fait croire à une hausse
  perdue. Deux heures dépensées là-dessus.
- **8 règles `bonus-stat` chez dreydrin, gil-thunder et griamore** qui
  ressemblent au doublon du chantier 0. Ce sont des effets **conditionnels**
  distincts (« +20 % de défense pendant 40 s après la compétence normale ») ;
  leurs valeurs ne coïncident d'ailleurs pas avec la ligne de stat. Le garde a
  bien fonctionné pour eux.
- **La table des potentiels dans les fichiers du jeu.** Elle n'est ni dans
  `Skill/HeroPotentialRewardTable` (une seule ligne, des récompenses), ni dans
  `HeroMastery/*` (c'est l'arbre de maîtrise d'arme, pas les paliers P0–P10).
  Non trouvée à ce jour ; `7ds-stats/personnages.json` reste la source.
- **Le modèle « deux termes additionnés » d'un joueur** — attaque/défense d'un
  côté, attaque élémentaire/défense élémentaire de l'autre, divisés puis
  additionnés. La structure est juste (les deux canaux existent, `B_Def` et
  `<Elem>_Res` sont des colonnes distinctes), mais les bornes sont fausses : la
  défense plancherait à 1 (non — `battle_min_sum_def = 0`, c'est
  `battle_min_final_atk` qui vaut 1), et le rendement du shred exploserait
  (non — `battle_min_elementdam_rate = 500`, le terme est borné). 7dsorigin
  confirme : l'attaque élémentaire **s'ajoute au pool d'attaque**, elle n'est
  pas divisée séparément.

## Sources externes, et le crédit qu'on leur donne

| Source | Ce qu'elle vaut |
|---|---|
| Tables du jeu (`Output/Exports/.../Table`) | **Autorité.** Le code de la stat tranche. |
| `docs/constantes-combat-du-jeu.md` | Les constantes, lues dans `DefineTable`. Donne les bornes, pas l'ordre des opérations. |
| `7dsorigin.app/en/damage-formula` | Sérieux, daté, méthodologie citée. Mais c'est une **mesure externe**, pas le code. À croiser, jamais à recopier. |
| `RAPPORT-analyse-tapscreen.md` | Rétro-ingénierie de l'outil de référence. Prouve ce que fait **l'outil**, pas ce que fait le jeu. |
| `7dscalc.com` | Modèle communautaire, qui s'annonce lui-même comme estimé (« DEF scaling, resistance stacking, debuff math remain community-derived »). Sa mitigation `DEF/(DEF+500+niveau×10)` contredit `K/(K+DEF)`. **Ne pas s'en servir comme référence.** |

## Commandes utiles

```
node scripts/lancer-tests.js unit          # 83 tests, ~60 s
node scripts/lancer-tests.js e2e           # 23 parcours, ~3 min
node scripts/lancer-tests.js -f effets     # filtrer sur un nom

python scripts/generate-stats-build.py --check
python scripts/generate-effets-dps.py --check
python scripts/generate-effets-dps.py      # RÉSEAU : 26 fiches 7dsorigin
```

⚠️ `generate-effets-dps.py` sans `--check` va chercher les fiches en ligne.
Régénérer mélange donc tes changements avec toute dérive amont : compare
toujours le catalogue avant/après et vérifie que le total de sources est
stable (2 283 au 1er septembre 2026).
