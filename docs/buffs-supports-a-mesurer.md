# Buffs de soutien à mesurer en jeu

Date du relevé des sources : 23 août 2026.

Ce document ne met pas en doute les **chiffres** de `data/buffs-supports.js` :
ils sont transcrits du texte du jeu et des tests vérifient que chaque valeur
cite une phrase littérale de la compétence qui la porte. Ce qui n'a jamais été
mesuré, c'est **le trajet** de ces chiffres : qui les reçoit, dans quel seau du
calcul ils tombent, et s'ils s'appliquent avant ou après les taux du receveur.

Les six questions ci-dessous sont classées par **ce qu'elles déplacent sur un
build réel**, pas par facilité de mesure. La dernière ne vaut probablement pas
le déplacement : elle est conservée pour dire pourquoi.

## Ce qui est déjà tenu, et n'a pas à être remesuré

- **La chaîne de dégâts elle-même.** Mannequin, Merlin p10 Baguette, Jugement
  foudroyant à 159 % : relevé en jeu **70 563**, calculé par le moteur avec un
  écart inférieur à 0,01 % (`tests/calculateur-entrees.test.js`). Ce relevé
  tient les quatre codes élémentaires, le seau additif et le facteur
  multiplicatif du palier d'un bout à l'autre.
- **Le percement de défense**, mesuré séparément sur mannequin — cinq
  prédictions posées à l'avance et vérifiées (`RAPPORT-analyse-tapscreen.md`,
  session 3).
- **La transcription des 43 buffs** : phrase littérale, code de statistique
  existant, et produit `parCumul × cumuls = valeur` recalculé par un test.

Autrement dit, une mesure qui tombe à côté ne remettra pas la formule en cause :
elle désignera l'aiguillage fautif dans la table ou dans les entrées du calcul.

## Protocole général

Il vaut pour les six questions et reprend la méthode des relevés déjà validés.

1. **Mannequin**, sans défense, sans résistance, sans faiblesse élémentaire.
2. Noter **avant le tir** : ATK affichée du héros calculé, attaque élémentaire
   de son élément, augmentation de l'attaque élémentaire, augmentation des
   dégâts de l'élément, bonus de catégorie, palier de potentiel.
3. Noter les **mêmes statistiques du support**, en particulier son ATK et son
   attaque élémentaire : trois buffs se chiffrent dessus.
4. **Deux tirs identiques** : un sans le buff, un avec. C'est le **rapport**
   entre les deux qui tranche, pas le chiffre absolu — il évacue tout ce qui
   n'a pas bougé entre les deux tirs.
5. **Écarter les critiques** : recommencer jusqu'à obtenir deux tirs sans coup
   critique, ou filmer pour recompter au ralenti.
6. Relever aussi, quand le jeu l'affiche, **la statistique du receveur pendant
   le buff**. Pour les questions 3 et 6, une fiche de stats lue en cours de
   buff tranche sans aucune arithmétique.

## 1. Les passifs qui ne disent pas qui reçoit

**Enjeu : 30 à 60 % de dégâts sur chaque build de l'équipe.** C'est de loin la
plus grosse inconnue de la table.

Deux passifs écrivent « augmente **les** dégâts » sans nommer le bénéficiaire,
là où Hauser écrit « augmente **ses** dégâts », et où le passif de Manny
précise « de tous les héros alliés » sur son autre effet :

| Support | Compétence | Texte | Lu aujourd'hui comme |
| --- | --- | --- | --- |
| Elisabeth | Bâton, passif *Vent favorable de la déesse* | « Lorsqu'un héros allié attaque un ennemi affecté par Altération, augmente les dégâts d'attaque normale de 60 % » | bonus pour Elisabeth seule → **hors table** |
| Manny | Bâton, passif *Prêtresse des dragons* | « Augmente les dégâts d'attaque ultime de 30 % lorsqu'un héros allié attaque un ennemi affecté par Châtiment » | bonus pour Manny seule → **hors table** |

**La mesure qui tranche.** Héros calculé au mannequin, support présent dans
l'équipe, cible sous Altération (ou Châtiment). Deux tirs de la catégorie visée
— attaque normale pour Elisabeth, attaque ultime pour Manny — l'un avec l'état
posé sur la cible, l'autre sans.

- rapport ≈ **1,60** (ou 1,30) → le bonus est **collectif** : les deux lignes
  entrent dans la table, sur la catégorie visée, et chaque build concerné gagne
  ce que le calculateur lui refuse aujourd'hui ;
- rapport ≈ **1,00** → la lecture actuelle est la bonne et la question est
  close définitivement.

**Piège :** le bonus vise une **catégorie** de compétence. Tirer une compétence
normale pour tester le passif de Manny ne montrera rien même si le bonus est
collectif.

## 2. Les quatre réductions de résistance élémentaire

**Enjeu : +21 % de dégâts sur une cible à 30 % de résistance**, par ligne.

Quatre buffs sont transcrits, chiffrés, et **écartés du calcul** (`horsCalcul`)
parce que rien dans le moteur ne réduit la résistance élémentaire de la cible.
Le recensement de l'Analyse les affiche, le calculateur les ignore.

| Support | Ligne | Valeur |
| --- | --- | --- |
| Drake | Paralysie | résistance à la Foudre −15 % |
| Gil Thunder | Paralysie | résistance à la Foudre −15 % |
| Gil Thunder | Barrière de Foudre retirée (30 s) | résistance à la Foudre −15 % |
| Gil Thunder | Déluge de Foudre activé (20 s) | résistance à la Foudre −15 % |

**La mesure qui tranche.** Elle ne peut pas se faire au mannequin : il faut une
cible qui **résiste** à la Foudre, donc un boss dont la résistance est connue ou
au moins stable. Deux tirs identiques d'un héros Foudre, l'un avec la Paralysie
posée, l'autre sans.

**Ce qu'on cherche d'abord, et ce n'est pas le chiffre :** est-ce que les
quatre lignes **se cumulent** entre elles (−60 % au total sur un Gil Thunder qui
enchaîne ses trois états) ou est-ce qu'elles se remplacent ? La réponse décide
si brancher cet effet vaut un chantier moteur ou une ligne.

## 3. Le taux d'attaque élémentaire s'applique-t-il au buff plat ?

**Enjeu : jusqu'à +44 % sur la valeur du buff**, soit plusieurs pour cent de
dégâts. C'est la mesure la moins chère de la liste.

Trois buffs donnent une **attaque élémentaire plate** (`Fire_Add`, `Wind_Add`,
`Thunder_Add`). Le calculateur les ajoute **tels quels** au seau élémentaire du
receveur (`entreesDuCalcul`, `js/metier/calculateur-entrees.js`), alors que
l'attaque élémentaire **du build**, elle, est multipliée par « Augmentation de
l'attaque de Foudre », « … de Vent », « … de Feu ».

Sur le build de référence, dont l'augmentation d'attaque de Foudre vaut 43,76 % :

| Lecture | Buff de 3 000 reçu | Attaque de Foudre affichée |
| --- | ---: | ---: |
| ajouté à plat (calculateur aujourd'hui) | 3 000 | 2 026 + 3 000 = **5 026** |
| majoré par le taux du receveur | 4 313 | 2 026 + 4 313 = **6 338** |

**La mesure qui tranche.** Ouvrir la fiche de statistiques du héros pendant que
le buff court et **lire l'attaque élémentaire**. 5 026 contre 6 338 se
distinguent d'un coup d'œil. Si le jeu n'affiche pas la statistique en combat,
deux tirs suffisent : le rapport attendu diffère de plus de 4 %.

## 4. La défense élémentaire versée dans la défense générale

**Enjeu : la ligne Foudre de Gowther, et le retour de celle de Derieri.**

`gowther_wand_skill_e` — « Salve de flèches », défense de Foudre de l'ennemi
−6 % par cumul, 4 cumuls, soit −24 % — est versée dans la **réduction de
défense générale**, ce qui suppose que le jeu ne sépare pas les deux défenses.
C'est assumé pour la seule Foudre, parce que la confrérie mène ses Boss de
Guilde en Merlin Foudre. La ligne jumelle de Derieri (défense de Feu −20 %)
reste dehors en attendant.

**La mesure qui tranche.** Sur une cible dont la défense est connue, deux tirs
d'un héros Foudre à quatre cumuls posés, comparés à la prédiction du
calculateur qui applique déjà cette réduction. Puis **le même essai avec un
héros d'un autre élément** : si ses dégâts montent aussi, la réduction n'est pas
élémentaire du tout, et la ligne doit perdre son `element:"thunder"`.

## 5. Les cumuls, transcrits au maximum

**Enjeu : l'écart entre un plafond et un run réel.**

Toutes les valeurs à cumuls sont transcrites **au maximum atteignable** — Daisy
à 4 cumuls, Drake à 5, Gowther à 25 sur sa Synchronisation. Le calculateur
annonce donc un plafond, jamais une moyenne de combat.

Ce n'est pas une erreur à corriger : c'est une convention qu'il faut **mesurer
pour savoir de combien on se trompe**. Relever, sur un run de Boss de Guilde
filmé, le nombre de cumuls réellement tenu au moment des gros tirs, pour les
trois lignes les plus fournies (Gowther 25 cumuls, Drake 5, Daisy 4).

## 6. « 30 % de l'attaque du héros » — probablement sans objet

**À ne mesurer que si le support a moins de 10 000 d'ATK.**

`js/metier/equipe-buffs.js` porte une hypothèse déclarée : « 30 % de l'attaque
du héros » est lu comme la **seule ATK**, sans l'attaque élémentaire du
lanceur — alors que le moteur de dégâts, lui, additionne les deux ailleurs.

Le calcul montre que la question se referme d'elle-même sur un build développé :

| Buff | Taux | Plafond atteint à |
| --- | ---: | ---: |
| Derieri, Attaque de Feu | 30 % | **10 000** d'ATK |
| Elisabeth, Attaque de Vent | 30 % | **10 000** d'ATK |
| Gowther, Attaque de Foudre | 10 % | **30 000** d'ATK |

Le seul build réellement relevé dans le dépôt affiche **26 298** d'ATK. Les deux
lectures butent donc sur le plafond de 3 000 pour Derieri et Elisabeth : elles
rendent le **même chiffre**, et l'hypothèse est inerte. Elle ne discrimine que
chez Gowther, où l'écart vaut 2 630 contre 2 832 — environ 200 points d'attaque
élémentaire sur une base de 28 000, soit moins de 1 % de dégâts, sous le bruit
de mesure.

**Vérification préalable, sans quitter le site :** choisir l'équipe dans le
calculateur et lire l'ATK affichée du support. Au-dessus de 10 000, la question
est close pour Derieri et Elisabeth. En dessous, et alors seulement, appliquer
le protocole général en notant l'ATK **et** l'attaque élémentaire du support.

## Relevés à compléter

### Passifs collectifs (question 1)

| Support | État sur la cible | Catégorie tirée | Dégâts sans l'état | Dégâts avec l'état | Rapport | Critique | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Elisabeth Bâton | Altération | attaque normale |  |  |  |  |  |
| Manny Bâton | Châtiment | attaque ultime |  |  |  |  |  |

### Résistance élémentaire (question 2)

| Support | Ligne | Cible | Résistance annoncée | Dégâts sans | Dégâts avec | Cumul avec une autre ligne | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| Drake | Paralysie |  |  |  |  |  |  |
| Gil Thunder | Paralysie |  |  |  |  |  |  |
| Gil Thunder | Barrière retirée |  |  |  |  |  |  |
| Gil Thunder | Déluge activé |  |  |  |  |  |  |

### Attaque élémentaire plate (questions 3 et 6)

| Support | Buff | ATK du support | Attaque élém. du support | Attaque élém. du receveur avant | pendant le buff | Taux élém. du receveur | Notes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Derieri Épée 2M |  |  |  |  |  |  |  |
| Elisabeth Bâton |  |  |  |  |  |  |  |
| Gowther Baguette |  |  |  |  |  |  |  |

### Défense élémentaire et cumuls (questions 4 et 5)

| Support | Ligne | Cumuls posés | Cumuls tenus en run | Élément du tireur | Dégâts sans | Dégâts avec | Notes |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| Gowther | Salve de flèches |  |  |  |  |  |  |
| Gowther | Synchronisation |  |  |  |  |  |  |
| Drake | Courant électrique |  |  |  |  |  |  |
| Daisy | Bombe de graine |  |  |  |  |  |  |

## Où atterrissent les réponses

- une valeur confirmée ou corrigée → `data/buffs-supports.js`, avec sa phrase
  de provenance inchangée : c'est le trajet qui change, pas le texte lu ;
- une ligne qui devient calculable → retirer son `horsCalcul` **et** brancher
  l'effet correspondant dans `js/metier/calculateur-entrees.js` ;
- une lecture d'aiguillage tranchée → mettre à jour le commentaire qui porte
  l'hypothèse, dans `js/metier/equipe-buffs.js` ou l'en-tête de la table. Une
  hypothèse mesurée cesse d'être une hypothèse et doit cesser de s'annoncer
  comme telle.

## Sources

- `data/buffs-supports.js` — la table et son en-tête, qui documente déjà ce qui
  est écarté et pourquoi.
- `js/metier/equipe-buffs.js` — l'hypothèse de la question 6, ligne 51.
- `js/metier/calculateur-entrees.js` — les seaux du calcul, questions 3 et 4.
- `tests/calculateur-entrees.test.js` — le relevé Merlin p10 à 70 563.
- `RAPPORT-analyse-tapscreen.md` — la méthode des mesures au mannequin.
- `docs/competences-maintenues-a-tester.md` — le protocole jumeau, pour les
  compétences maintenues.
