# Buffs de soutien : qui recoit, lu dans la table du jeu

`docs/buffs-supports-a-mesurer.md` posait six questions et demandait pour
chacune une mesure en jeu. La table des buffs, **illisible jusqu'au usmap du
24 aout 2026**, en tranche plusieurs sans mesure.

Regenerer : `node outils/fmodel/portee-des-buffs.js [--tout]`

## Le champ qui decide

Chaque ligne de `Table/Buff/BuffTable` porte un `ApplyType` :

| Valeur | Sens |
|---|---|
| `EApplyType::Hero` | le porteur seul |
| `EApplyType::Team` | toute l'equipe |

Et chaque modificateur de `AddAbil_List` porte un `Type` :

| Valeur | Sens |
|---|---|
| `None` | la valeur s'ajoute a plat |
| `Per` | la valeur est un pourcentage d'une statistique **du lanceur**, fige au moment ou le buff est pose |

## Question 1 — les deux passifs qui ne disaient pas qui recoit : COLLECTIFS

C'etait la plus grosse inconnue de la table, chiffree a « 30 a 60 % de degats
sur chaque build de l'equipe ». Le jeu repond sans ambiguite.

| Buff | Statistique | Valeur | `ApplyType` |
|---|---|---|---|
| `302172012` — Elizabeth | `NormalAttack_DamAdd_Rate` | **+60 %** | **`Team`** |
| `302221001` — Manny | `UltimateSkill_DamAdd_Rate` | **+30 %** | **`Team`** |

Les deux sont donc **collectifs**. Le depot les lit aujourd'hui comme un bonus
pour le porteur seul et les laisse **hors table** : c'est a corriger.

Les deux buffs n'ont ni nom, ni icone, ni description. C'est pourquoi le texte
de la competence etait la seule source disponible, et pourquoi il fallait le
lire au mot pres — « les degats » contre « ses degats ».

### Comment un buff est rattache a un heros

Les buffs ne portent pas le nom de leur heros. L'attribution passe par les
**blocs d'identifiants** : les six premiers chiffres. Le script ne le suppose
pas, il le verifie — pour chaque bloc, il releve tous les heros dont une
competence pose un buff de ce bloc.

Resultat : **79 blocs n'appartiennent qu'a un seul heros**, et 10 sont
partages. Les 10 partages sont les blocs communs et elementaires
(`302000`, `309000`, `308000`…), pas des heros : ils sont ecartes.

Le bloc `302172` n'est touche que par des competences d'Elizabeth (24 poses),
le bloc `302221` que par des competences de Manny (10 poses).

## Ce que la table revele en plus

**110 buffs offensifs de portee `Team`** sont rattaches a un heros, contre
**20 lignes alliees** dans `data/buffs-supports.js`. Une partie de l'ecart est
normale — un meme effet existe en plusieurs versions selon le palier de
potentiel, et une seule court a la fois — mais pas la totalite.

Repartition : klotho 15, elizabeth 14, drake 13, daisy 11, manny 7, derieri 7,
tristan 5, tioreh 5, puis une longue traine.

## Ce que le controle des 43 lignes existantes donne

`node outils/fmodel/verifier-buffs-officiels.js --detail`

- 23 lignes visent une statistique **de l'ennemi** : hors de portee de ce
  controle, le depot ne publie pas de code d'abilite pour elles.
- Sur les 20 lignes alliees, **11 ont ete rattachees a un buff du jeu**, dont
  **10 avec la valeur exacte**.
- **Les 11 sont `Team`. Aucune n'est `Hero`.**
- Les 9 restantes echouent sur le nommage, pas sur la donnee : le depot ecrit
  `gilthunder_shield_passive` la ou le jeu ecrit `gil_thunder_shield_skillpassive`.

## Question 4 — la defense de Foudre de Gowther : mauvais seau

`gowther_wand_skill_e` est versee dans la **reduction de defense generale**,
faute de mieux. Le jeu est explicite :

```
302081004  Thunder_Res  Value=-600  Type=Per  MaxStack=4     (gowther_wand_skill_e_obj_a)
302081011  Thunder_Res  Value=-600  Type=Per  MaxStack=8     (grade_5_...)
```

Ce n'est pas la defense generale, c'est `Thunder_Res` — et le palier 5 de
potentiel **double le plafond de cumuls**, de 4 a 8, ce que le depot ne dit
nulle part.

## Ce que la table ne dit toujours pas

**Question 3 reste ouverte.** Le jeu confirme la lecture du depot sur la
source du buff plat (`Wind_Add`, `Type: Per`, 30 % de l'attaque **du
lanceur**), mais il ne dit pas si le taux d'augmentation elementaire **du
receveur** multiplie ensuite cette valeur. C'est une question de formule, pas
de table : la mesure de la fiche de stats en cours de buff reste la seule
reponse.
