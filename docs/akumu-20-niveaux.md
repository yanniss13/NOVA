# Akumu, bête démoniaque — relevé des 20 niveaux

**Source** : https://7dsorigin.app/fr/boss-de-confrerie/akumu-bete-demoniaque
**Date du relevé** : 2026-08-08
**Nature** : relevé de données, pas d'analyse. Aucun chiffre n'est calculé, déduit ou complété —
tout est lu tel qu'affiché par la page.

Bandeau de consentement : refusé (« Rejeter tout ») avant tout relevé.

---

## 1. L'infobulle « Résistance élémentaire de base »

Le bloc STATISTIQUES se termine par une bande `RÉSISTANCE ÉLÉMENTAIRE DE BASE — 50%` portant une
icône ⓘ (`<button aria-label="Plus d'informations">`). Au clic, une bulle s'ouvre. Texte **exact**,
cité mot pour mot, tel que rendu dans l'élément `role="tooltip"` et vérifié à l'écran :

> Réduction de dégâts plate appliquée à tous les éléments, en plus des faiblesses. Augmente avec le niveau de monde / la difficulté.

### Ce que la page permet d'établir sur le rapport entre les deux valeurs

Faits observés, sans interprétation :

1. **L'infobulle dit que cette réduction s'applique « à tous les éléments »**, et qu'elle vient
   « **en plus des faiblesses** ». Le mot employé est *faiblesses*, pas *résistances*.
2. **Aucun autre texte de la page ne parle de combinaison.** Recherche faite sur l'intégralité du
   texte rendu : les seules occurrences sont le libellé de la bande (« Résistance élémentaire de
   base 50 % »), l'en-tête du bloc « RÉSISTANCES » avec ses 8 lignes à 30 %, et une phrase de
   description en bas de page (« stats complètes des 20 niveaux du boss, résistances
   élémentaires, … »). Nulle part il n'est écrit si 50 % et 30 % s'additionnent, se multiplient,
   ou si l'un remplace l'autre.
3. **Il n'y a qu'UNE seule infobulle sur toute la page** (un seul
   `button[aria-label="Plus d'informations"]`, un seul `[role="tooltip"]`). Le bloc RÉSISTANCES et
   ses 8 éléments n'ont ni infobulle, ni attribut `title`, ni texte d'aide.
4. **Les deux valeurs vivent dans deux cartes distinctes.** « Résistance élémentaire de base » est
   *à l'intérieur* de la carte STATISTIQUES, celle que pilote le sélecteur « Niveau du boss ». Les
   8 résistances élémentaires sont dans une carte séparée, intitulée « RÉSISTANCES », placée à
   côté et **hors** du périmètre du sélecteur de niveau.
5. **Aucun bloc de la page n'est intitulé « Faiblesses ».** La sous-navigation propose bien une
   entrée « Faiblesses », mais elle fait défiler vers la bande à trois colonnes
   (Statistiques / Résistances / Stratégies de combat) et aucun élément affiché ne porte le mot
   *faiblesse* avec une valeur en face. Le mot employé par l'infobulle n'a donc **aucune donnée
   correspondante affichée** sur cette page.
6. **Mesuré sur les 20 niveaux** : la « résistance élémentaire de base » reste à **50 %** et les 8
   résistances élémentaires restent à **30 %** — voir §3. À noter : l'infobulle annonce que la
   valeur « augmente avec le niveau de monde / la difficulté », or elle ne bouge pas d'un pouce
   quand on parcourt les 20 niveaux du boss. Fait brut : sur cette page, « niveau du boss » ne
   fait pas varier cette valeur.

### Conclusion

**Le rapport entre les deux est INDÉTERMINÉ.** L'infobulle établit que la « résistance élémentaire
de base » est une réduction plate qui touche tous les éléments et qui s'ajoute à autre chose
(« en plus des faiblesses »), mais elle ne dit pas comment elle se combine avec les 8 résistances
élémentaires à 30 %, et rien d'autre sur la page ne le dit. La page ne tranche pas.

---

## 2. Les 20 niveaux

Sélecteur « NIVEAU DU BOSS », niveaux 1 à 20 cliqués un par un. **Les 20 niveaux se sont affichés,
aucun n'a refusé.** Valeurs recopiées telles qu'affichées (la page écrit « 20% » et non « 20,00 % »
quand la décimale est nulle).

| Niveau | DEF | Résistance crit. | Défense crit. | HP |
|---:|---:|---:|---:|---:|
| 1 | 3 454 | 20 % | 50 % | 2 090 121 |
| 2 | 4 161 | 22 % | 54 % | 2 923 402 |
| 3 | 5 045 | 24,2 % | 58,32 % | 3 974 208 |
| 4 | 6 009 | 26,62 % | 62,99 % | 5 180 389 |
| 5 | 7 054 | 29,28 % | 68,03 % | 6 541 945 |
| 6 | 8 316 | 32,21 % | 73,47 % | 8 198 714 |
| 7 | 9 819 | 35,43 % | 79,35 % | 10 197 308 |
| 8 | 11 436 | 38,97 % | 85,7 % | 12 413 428 |
| 9 | 13 165 | 42,87 % | 92,56 % | 14 847 073 |
| 10 | 14 453 | 47,16 % | 99,96 % | 17 700 232 |
| 11 | 17 891 | 51,88 % | 107,96 % | 24 022 303 |
| 12 | 19 521 | 57,07 % | 116,6 % | 28 721 553 |
| 13 | 21 333 | 62,78 % | 125,93 % | 34 135 530 |
| 14 | 23 326 | 69,06 % | 136 % | 40 334 151 |
| 15 | 25 500 | 75,97 % | 146,88 % | 47 387 335 |
| 16 | 27 674 | 83,57 % | 158,63 % | 54 999 870 |
| 17 | 30 029 | 91,93 % | 171,32 % | 63 560 194 |
| 18 | 32 747 | 101,12 % | 185,03 % | 73 549 970 |
| 19 | 35 464 | 111,23 % | 199,83 % | 84 238 935 |
| 20 | 38 544 | 122,35 % | 215,82 % | 96 543 801 |

### Vérification obligatoire — les deux niveaux connus

| Niveau | Attendu | Relevé | Verdict |
|---|---|---|---|
| 1 | 3 454 / 20,00 / 50,00 / 2 090 121 | 3 454 / 20 % / 50 % / 2 090 121 | **conforme** |
| 20 | 38 544 / 122,35 / 215,82 / 96 543 801 | 38 544 / 122,35 % / 215,82 % / 96 543 801 | **conforme** |

Les quatre valeurs tombent exactement, aux deux extrémités de la plage.

### Une irrégularité dans leurs données, signalée telle quelle

Le passage 9 → 10 → 11 n'est pas régulier sur DEF et HP :

| | niveau 9 | niveau 10 | niveau 11 |
|---|---:|---:|---:|
| DEF | 13 165 | 14 453 (**+9,8 %**) | 17 891 (**+23,8 %**) |
| HP | 14 847 073 | 17 700 232 (**+19,2 %**) | 24 022 303 (**+35,7 %**) |
| ATK | 28 508 | 33 562 | 43 117 |

Ailleurs sur la plage, la progression de DEF est régulière (environ +15 % par niveau jusqu'au 9,
environ +9 % à partir du 12). Les niveaux 9, 10 et 11 ont donc été relus une seconde fois,
directement sur la ligne du DOM correspondante, puis vérifiés visuellement par capture d'écran :
**les chiffres sont bien ceux-là.** C'est une irrégularité de leurs données, pas une erreur de
lecture. Résistance crit. et Défense crit. ne présentent aucune irrégularité au même endroit
(+10,01 % et +8,00 % par niveau, sans rupture).

---

## 3. Contrôle des « constantes »

Les quatre valeurs supposées constantes ont été relevées non pas sur trois niveaux intermédiaires
comme demandé, mais **sur les 20 niveaux**, dans le même passage.

| Valeur | Niveaux 1 → 20 | Verdict |
|---|---|---|
| Résistance au percement | **20 %** aux 20 niveaux | constante, ne bouge pas |
| Résistance élémentaire de base | **50 %** aux 20 niveaux | constante, ne bouge pas |
| Vitesse | **500** aux 20 niveaux | constante, ne bouge pas |
| Les 8 résistances élémentaires (Glace, Ténèbres, Feu, Sacré, Vent, Terre, Physique, Foudre) | **30 %** chacune, aux 20 niveaux | constantes, ne bougent pas |

Aucune des quatre ne varie. Détail utile : les 8 résistances sont affichées dans une carte
distincte, **hors** du périmètre du sélecteur de niveau — leur invariance est donc aussi une
conséquence de la structure de la page, pas seulement une observation sur les valeurs.

### Hors périmètre demandé, mais constaté au passage

Deux stats **ne sont pas** constantes, contrairement à ce que leur allure au niveau 1 pourrait
laisser croire : **Perforation** passe de 8 % (niveau 1) à 7,55 % (niveau 20) et **Persévérance**
de 9 % à 8,4 %. Ce sont des stats offensives du boss, hors du périmètre demandé ; c'est noté
uniquement pour éviter qu'on les prenne un jour pour des constantes. Attention à ne pas confondre
**Perforation** (8 %, offensive, variable) et **Résistance au percement** (20 %, défensive,
constante) : ce sont deux champs différents.

---

## 4. Toutes les stats affichées au niveau 1 (relevé de référence complet)

Pour mémoire, l'intégralité de ce que la page affiche au niveau 1, y compris les champs non
demandés :

| Champ | Valeur |
|---|---|
| HP | 2 090 121 |
| ATK | 8 795 |
| DEF | 3 454 |
| Chances crit. | 29,78 % |
| Dégâts crit. | 86,1 % |
| Perforation | 8 % |
| Persévérance | 9 % |
| Résistance crit. | 20 % |
| Défense crit. | 50 % |
| Résistance au percement | 20 % |
| Jauge de Déluge | 1 500 |
| Vitesse | 500 |
| Résistance élémentaire de base | 50 % |
| Résistances (Glace / Ténèbres / Feu / Sacré / Vent / Terre / Physique / Foudre) | 30 % chacune |

Autres éléments affichés sur la page, sans valeur chiffrée : temps limite 5 min, 1 à 5 joueurs,
3 stratégies de combat (Pierres d'élément, Assaut sournois, Union), règles du mode.
