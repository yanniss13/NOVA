# Passifs d'arme — ce qui reste, et la mesure qui débloque la liche

Écrit le 11 août 2026, après les trois lots qui ont porté la couverture de
1 arme à 85 sur 94.

Ce document a un objectif précis : que la clause dérivée du **Rugissement de la
liche draconique** puisse être écrite par n'importe qui, sans refaire l'analyse.
Le reste du dossier suit, plus court.

---

## 1. La liche draconique — la moitié de phrase qui manque

### Ce qui est déjà en table

Douze armes, une par type. La ligne posée :

| Niveau | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Chances crit. | 6 % | 10 % | 12 % | 14 % | 16 % | 18 % | 20 % |

Identifiant `liche-draconique-releve-critique`, code `C_Critical_Rate`,
`porteur:"hero"`. Ancre : `augmente les chances crit. de `.

### Ce qui manque

Le texte publié, au niveau 7 :

> L'utilisation de la compétence de relève augmente les chances crit. de 20 %
> pendant 10s, **et augmente l'attaque à hauteur de la valeur de chances crit.
> qui dépasse 50 %. (Max : 30 %)**

Les plafonds, relus niveau par niveau dans `data/stats-build.js` :

| Niveau | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Plafond d'attaque | 16 % | 18 % | 20 % | 22 % | 24 % | 26 % | 30 % |

Soit, en dix-millièmes : `[1600, 1800, 2000, 2200, 2400, 2600, 3000]`.

L'ancre `(Max : ` convient : elle apparaît **exactement une fois** à chacun des
sept niveaux, la seconde phrase du niveau 4 n'en portant pas.

### Pourquoi elle n'est pas écrite

Ce serait **le premier bonus du dépôt dérivé d'une autre statistique**. Sa
valeur n'est pas un nombre dans une table mais un calcul :

```
attaque = min(plafond, taux_critique − 50 %)
```

Et une question reste sans réponse : **les 20 % de taux critique que ce même
passif vient de poser comptent-ils dans l'excédent ?**

Les deux lectures, sur un héros à 65 % de critique au niveau 7 :

| Lecture | Taux retenu | Attaque obtenue |
|---|---|---|
| Les 20 % **ne** comptent **pas** | 65 % | **+15 %** |
| Les 20 % comptent | 85 % | **+30 %**, au plafond |

Quinze points d'attaque d'écart. Le texte est ambigu : la conjonction « et »
lie les deux effets dans une même phrase, ce qui plaide pour la seconde
lecture, mais rien ne l'établit.

**L'ambiguïté ne mord que sous 80 % de critique.** Au-dessus, `crit − 50` passe
déjà 30 % et le plafond absorbe la différence. C'est pourquoi la clause a de
bonnes chances d'être triviale pour les builds d'endgame — et fausse pour tous
les autres.

### La mesure qui tranche

Il faut **un membre équipé d'une arme liche**, dont le taux critique est
**strictement compris entre 55 % et 75 %** hors buff. En dessous de 55 %, la
première lecture donnerait zéro et on ne distinguerait rien ; au-dessus de
75 %, la seconde lecture est déjà au plafond.

Protocole, sur le **mannequin** :

1. Noter le **taux critique** sur l'écran de détails, et le **niveau du passif**
   de l'arme.
2. Frapper une compétence connue **sans avoir utilisé la relève**. Noter les
   dégâts **non critiques**. C'est la référence.
3. Utiliser la **compétence de relève**, puis refrapper la même compétence dans
   les 10 secondes. Noter à nouveau les dégâts **non critiques**.

Le rapport entre les deux coups donne directement le bonus d'attaque, puisque
tout le reste est constant et que le mannequin n'a ni défense ni résistance :

- rapport ≈ `1 + (crit − 50 %)` → les 20 % **ne** comptent **pas** ;
- rapport ≈ `1 + min(plafond, crit + 20 % − 50 %)` → ils comptent.

**Le coup doit être non critique.** Le passif change aussi le taux critique, et
un coup critique mélangerait les deux effets dans un seul chiffre.

### Ce qu'il faudra écrire ensuite

Une fois la lecture connue, trois pièces :

1. **La table** — une ligne portant, au lieu de `niveaux` seuls, une dérivation
   nommée : la statistique source, le seuil (5 000) et le plafond par niveau.
2. **Le module pur** — la résolution de cette valeur, testable sans navigateur,
   à côté de `versLAttaqueElementaire()`. C'est là que la lecture mesurée doit
   être écrite noir sur blanc, avec la mesure qui la fonde.
3. **La vue** — résoudre la ligne **après** `basesDuBuild()`, dont elle lit le
   taux critique retouché. Elle n'est pas élémentaire, donc elle n'entre pas
   dans les bases et ne crée aucune circularité.

---

## 2. Les neuf armes hors modèle

Sur les 94 armes à passif, 85 sont couvertes. Les neuf autres sortent du modèle
de dégâts, et pour des raisons distinctes — aucune n'est un oubli.

| Armes | Effet publié | Pourquoi dehors |
|---|---|---|
| Espadon de l'ombre noire, Nunchaku du souffle de l'esprit mort | Résistance au **Déluge** de la cible −100 % | Le Déluge n'est pas modélisé : ni jauge, ni résistance, ni dégâts propres |
| Gantelets de la volonté corrompue, Hache de souverain de la forêt | Dégâts d'**un certain type de compétence** +20 % | Le jeu ne dit pas lequel. Un bonus de catégorie doit nommer sa catégorie |
| Épée et bouclier de l'esprit inébranlable | Efficacité des barrières +30 % | Défensif |
| En plein cœur ! | Efficacité de Déluge +30 % | Déluge, voir ci-dessus |
| Grimoire de l'ombre de la rupture | Dégâts de **faiblesse** +10 % | Le terme `faiblesse` du moteur vaut 0 et reste en suspens — voir `AKUMU_ELEMENTAIRE` dans `js/metier/degats-calcul.js` |
| **Grimoire de l'âme vorace** | **Attaque de Froid +50 %** | **Bloqué par la plomberie, pas par le sens** — voir §3 |
| 『100 façons de gagner en amour』 | Soins reçus +30 % | Soin |

---

## 3. Le Grimoire de l'âme vorace — un cas à part

C'est le seul des neuf qui **devrait** entrer et n'entre pas. Son passif :

> L'utilisation de la compétence normale augmente l'**attaque de Froid** de 50 %
> pendant 20s.

Valeurs : `[2600, 3800, 4400, 5000, 5000, 5000, 5000]` — le chiffre plafonne
dès le niveau 4. Ancre : `augmente l'attaque de Froid de `.

Le code est `Ice_Rate`, « Augmentation de l'attaque de Froid ». Le problème est
qu'aucune route ne l'accepte :

- `CIBLE_DU_BUFF` connaît `X_Add` (attaque élémentaire plate) et
  `X_Element_Rate` (bonus de dégâts), **mais pas `X_Rate`** ;
- `versLAttaqueElementaire()` n'accepte que `AllElement_Rate`, et le verser là
  serait **faux** : `AllElement_Rate` majore les deux attaques élémentaires
  — celle de l'élément et celle de « tous éléments » — tandis que `X_Rate` ne
  majore que la sienne. Voir le commentaire de `statsElementairesDuBuild()`
  dans `js/metier/calculateur-entrees.js`.

Ce qu'il faut : que `statsElementairesDuBuild()` reçoive **deux** taux
supplémentaires au lieu d'un — celui de l'élément propre et celui de tous les
éléments — et que `versLAttaqueElementaire()` distingue les deux cas. C'est une
demi-heure de travail, sans aucune mesure à faire : le comportement des deux
taux est déjà établi par le relevé de Merlin.

---

## 4. Deux chantiers plus petits, toujours ouverts

**`I_All_DamAdd_Rate` n'est lu par personne.** « Augmentation de tous les
dégâts », +7,5 % sur l'ensemble **Au bord du néant**, qui se déclenche dès trois
pièces. Le code existe dans le catalogue, rien ne le branche. Il tombe dans
`bonusGlobal`, un seau que le moteur additionne déjà. Correction d'une ligne
dans `basesDuBuild()`.

**Huit tenues gravées à effet offensif ne sont pas en table** : Chevalier sacré
prometteur, Dignité de la sainte, Furtivité du démon, Le Serpent de l'Envie,
Marche des ombres, Protection de la fée, Résistance et révolution, Tenue
modeste. La machinerie de `data/passifs-graves.js` les accepte telles quelles.

---

## 5. Les pièges rencontrés, pour ne pas les repayer

**Le produit `pas × cumuls` révèle les irrégularités.** Trois familles ont un
plafond dont le **nombre de crans change selon le niveau** : l'aura triomphale
(13 puis 15), l'épée et bouclier de l'âme vorace (11 puis 15), la hache (5 puis
8), l'épée longue (2 puis 3). Barrage des Ténèbres en avait 40 partout, ce qui
laissait croire à une constante. Le champ `cumuls` accepte un tableau.

**Les pourcentages impairs cassaient le lecteur du test.** `2.2 × 100` vaut
`220.00000000000003`. L'arrondi est maintenant dans `nombreApres()` ; ne pas le
retirer.

**Une seconde phrase apparaît au niveau 4** sur plusieurs passifs. L'ancre du
plafond doit alors porter la durée — `pendant 10s. (Max : ` — sinon elle
trouve deux `(Max : ` et le test refuse, à juste titre.

**Une arme ne doit appartenir qu'à une famille.** Deux entrées la nommant lui
donneraient deux fois le même passif sans que rien ne le signale. Le test le
refuse.

**Exister dans `stats-build.js` ne suffit pas.** C'est `data/data.js` qui
remplit le sélecteur d'arme du roster : une variante d'accent entre les deux
listes rendrait le passif introuvable sans qu'aucun chiffre soit faux. Le test
vérifie les deux.
