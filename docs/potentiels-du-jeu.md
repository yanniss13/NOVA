# Potentiels : le site dit vrai

**748 paliers sur 750 sont exacts, chiffres compris.** Les deux restants sont
une reformulation de traduction, sans consequence sur un calcul.

Ce document remplace `potentiels-divergents.md`, qui annoncait 31 divergences.
**Ces 31 divergences n'existaient pas** : elles venaient d'une erreur de methode
decrite plus bas, pas des donnees du depot.

Regenerer : `node outils/fmodel/potentiels-officiels.js [--detail]`

## L'erreur qu'il fallait corriger

La premiere verification cherchait le texte du jeu sous une cle **devinee** :

```
local_skill_<heros>_<arme>_potential_<n>_desc
```

Cette cle existe bel et bien dans la localisation. Simplement, **le jeu ne s'en
sert pas toujours**. La chaine reellement affichee est designee par le champ
`Local_Key` de la ligne `<heros>_<arme>_grade_<n>` dans
`Table/Skill/DefaultSkillWeaponTypeTable` — une table qui etait **illisible**
jusqu'au usmap du 24 aout 2026.

Beaucoup de paliers pointent vers un **gabarit commun** :

```
daisy_wand_grade_9
  Local_Key      Local_Skill_Common_Potential_NormalSkill_Rate
  Local_Replace  ["{0}:{120%}"]
```

Le gabarit dit « Renforce la puissance de la competence normale de {0}. », et
`Local_Replace` bouche le trou avec `120%`. La cle devinee, elle, pointait vers
un texte propre a Daisy qui decrivait **un autre palier**. D'ou une divergence
apparente totale — recouvrement de mots nul — sur une donnee juste.

Lecon : ne jamais deduire une cle de localisation d'une convention de nommage.
La table la donne.

## Ce que dit la source officielle

| | |
|---|---|
| Paliers `grade_N` dans le jeu | 750 |
| Paliers dans `7ds-stats/personnages.json` | 750 |
| Apparies | **750** |
| Texte **et** chiffres identiques | 748 |
| Reformulation seule | 2 |
| Manquants d'un cote ou de l'autre | 0 |

Vingt-neuf lignes `grade_N` du jeu n'ont pas de `Local_Key` : ce sont les
paliers purement statistiques (`Local_Skill_Common_Potential_Stat` absent), et
les trois pseudo-heros `transform*`, qui ne sont pas jouables.

## Les deux reformulations

Toutes deux chez **Derieri / Gauntlets**, paliers 7 et 10. Le jeu ecrit « le 2e
coup » la ou le site ecrit « la 2e frappe », et deplace une subordonnee. Les
nombres, les effets et les cibles sont identiques. Rien a corriger.

## Deux pieges de comparaison, a garder en tete

- **`40 s` contre `40s`** — le jeu insere une espace avant l'unite, le site non.
  A lui seul, cet ecart typographique faisait remonter **118 faux positifs**.
- **`gil-thunder` / `gil_thunder` / `mannie` / `manny`** — les deux catalogues
  n'orthographient pas les heros pareil. Sans normalisation, 30 paliers
  paraissaient absents du jeu.

Le script neutralise les deux.
