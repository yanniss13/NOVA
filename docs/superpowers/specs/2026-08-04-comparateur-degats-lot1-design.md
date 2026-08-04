# Comparateur de dégâts — lot 1 : classer les builds d'un héros

**Date :** 2026-08-04
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Répondre à la question « lequel de mes builds frappe le plus fort ? » pour un
personnage du roster, en classant les builds qu'il porte déjà.

## Découpage d'ensemble

Le comparateur complet est trop vaste pour une seule spec. Il est découpé en
tranches **verticales** — chacune livre quelque chose qu'un membre voit — et
non en couches, dont les deux premières seraient invisibles.

| Lot | Contenu | État |
|---|---|---|
| **1** | Classement des builds d'un héros, contre une cible de référence | **cette spec** |
| 2 | Chiffre absolu contre un boss choisi dans le bestiaire | à cadrer |
| 3 | Classement des héros du roster entre eux | à cadrer |
| 4 | Éditeur de simulation : build actuel contre une variante | à cadrer |

Le lot 1 sert aussi, sans travail supplémentaire, la comparaison entre membres :
la fiche de héros s'ouvre déjà depuis le roster d'un autre membre, donc le même
chiffre y apparaît. La mise en regard côte à côte relève du lot 3.

## Ce qui existe déjà et n'est pas à refaire

- **La formule**, publiée et validée empiriquement sur
  `https://7dsorigin.app/en/damage-formula` :
  `Dégâts = ATK × Coef × Bonus-type × Critique × K/(K+DEF) × (1−Résistance) × (1+Faiblesse)`
- **Tous les termes attaquant**, produits par `calculateBuildStats`
  (`js/metier/stats-calcul.js`) : `B_Atk`, `B_Atk_Equip`, `AllElement_Add`,
  `C_Critical_Rate`, `C_Critical_Dam_Rate` et 93 autres codes.
- **La technique d'extraction** : `scripts/generate-stats.py` lit déjà le
  payload RSC de Next.js (`self.__next_f.push`) sur 7dsorigin.app.
- **La correspondance des vocabulaires d'arme** : `FOLDER_TO_ENUM`
  (`js/noyau/constantes.js:66`) relie `"Hache"` à `"Axe"`, `"Livre"` à `"Book"`.
  Le dossier d'image est la clé des builds du roster ; l'énum est le
  `weaponType` de la source. Aucune table nouvelle n'est nécessaire.
- **La convention d'honnêteté** : « Non inclus dans le calcul », déjà employée
  par `js/vues/detail-piece.js:120` et `js/vues/stats-heros.js:154`.

## Source : ce qui a été relevé, pas supposé

### Compétences — `https://7dsorigin.app/en/characters/<slug>`

Objets du payload portant ces clés exactes :

```
id, gameId, weaponType, skillCategory, nameEn, descriptionEn,
damagePercent, damType, hitCount, hitDamages, cooldown, magicCost,
gaugeCharge, gaugeChargeByGrade, buffs, iconUrl, order
```

Exemple relevé sur Meliodas :
`{"damagePercent":"189% ATK","damType":"Melee","hitCount":6,"hitDamages":["25%","24%",…]}`

`weaponType` vaut `"Axe"`, `"Sword1h"`, `"SwordDual"` — le vocabulaire de
`FOLDER_TO_ENUM`. `skillCategory` distingue notamment `"PASSIVE"`.

### Cible — `https://7dsorigin.app/en/field-bosses/<slug>`

Bloc relevé sur Banakro :

```json
{"atk":933,"def":493,"block":112,"maxHp":43198,"accuracy":199,
 "critRate":896,"moveSpeed":500,"burstGauge":1500,"critDamage":3366,
 "critResist":1000,"protectRes":1000,"critDmgResist":650,
 "blockDmgResist":9500}
```

**Échelle — hypothèse levée.** `critResist:1000` vaut 10 %. Deux sources
concordantes et indépendantes :

1. la page de formule donne 10 % comme résistance critique de référence ;
2. le dépôt décode déjà ces valeurs sous l'unité `"ten-thousandths"`, et
   `js/vues/stats-affichage.js:17` les divise par 100 pour l'affichage en
   pourcentage.

Le moteur réutilisera donc `formatBuildStatValue` et l'unité existante plutôt
que d'introduire une conversion parallèle. `valeur / 10000` donne le rapport.

`def` est brut et s'emploie tel quel dans `K/(K+DEF)`.

## Architecture

### 1. `scripts/generate-competences.py` *(créé)*

Produit `data/competences.js`, catalogue **figé et commité** comme les cinq
autres — le site est une PWA et doit fonctionner hors ligne.

**Compétences retenues :** celles qui infligent des dégâts, c'est-à-dire dont
`skillCategory` n'est pas `"PASSIVE"` **et** dont `damagePercent` est renseigné.
Les passifs sont écartés du catalogue de calcul — ils rejoignent la liste
« Non inclus » de la section suivante.

Contenu : pour chacun des 24 personnages, ces compétences réduites aux champs
utiles au calcul :

```js
window.SEVEN_DS_COMPETENCES = {
  "meliodas": [
    { gameId:"…", weaponType:"Axe", categorie:"ACTIVE", nom:"…",
      pourcentage:189, coups:6, repartition:[25,24,…], portee:"Melee" }
  ]
};
```

`damagePercent` (`"189% ATK"`) est converti en nombre à l'aspiration : le
moteur ne doit jamais analyser de texte.

Mode `--check` obligatoire, sur le modèle de
`python scripts/generate-stats-build.py --check` déjà présent dans `npm test` :
la suite détecte alors une dérive du catalogue sans réseau.

**Politique réseau :** 24 requêtes, séquentielles. Le générateur n'est lancé
qu'à la main ; `--check` compare le fichier commité à lui-même sans réseau.

### 2. `js/metier/degats-calcul.js` *(créé)*

Pur — ni DOM ni réseau. Placé après `stats-calcul.js` dans l'ordre des couches.

```js
degatsAttendus({ stats, competence, cible })
  // -> { total:number, parCoup:number[], termes:[{id,libelle,valeur}] }
```

Il retourne ses **termes**, dans le style de `stats-calcul.js`, pour que
l'affichage puisse justifier le chiffre au lieu de l'asséner.

Le critique est pris en **espérance** — `1 + taux × dégâts` — et non tiré au
sort : un comparateur doit être déterministe, sinon deux consultations de la
même fiche donneraient deux classements.

### 3. `CIBLE_REFERENCE`

Constante nommée du même module, reprenant les valeurs **réelles** relevées
sur Banakro, jamais des chiffres inventés :

```js
const CIBLE_REFERENCE = {
  nom:"Banakro", def:493, critResist:1000, critDmgResist:650,
  resistanceElementaire:0, faiblesse:0
};
const K = 5600; // milieu de l'intervalle 5500-5700 publié
```

`resistanceElementaire` et `faiblesse` sont à zéro faute d'être exposées par la
fiche : une cible neutre est un choix assumé, pas une valeur devinée.

Dans un rapport entre deux builds d'un même personnage, la cible se simplifie :
c'est ce qui rend le classement fiable malgré l'incertitude sur `K`. Le lot 2
introduira la cible choisie, et avec elle la marge à afficher.

### 4. L'unité de comparaison

Un type d'arme porte **plusieurs** compétences actives. Il faut donc dire ce
que le chiffre unique affiché par build additionne.

**Retenu : un cycle — chaque compétence active jouée une fois.** Le chiffre est
la somme de leurs dégâts.

Ce n'est **pas** un dégât par seconde, et le libellé doit le dire : les temps
de recharge ne sont pas modélisés. Deux builds dont les compétences ont des
recharges très différentes seraient mal départagés par cette mesure — limite
assumée, que le lot 4 pourra lever s'il s'avère gênante.

Le choix se défend parce qu'il ne privilégie aucune compétence arbitrairement
et reste calculable sans notion de temps.

### 5. `js/vues/fiche-heros.js` *(modifié)*

Un bloc **« Puissance »** dans la modale de fiche, listant les builds
enregistrés du personnage, classés par dégâts décroissants :

```
Livre        184 200
Bâton        171 400
Baguette     160 900
```

La modale s'ouvrant déjà depuis le roster d'un autre membre, le chiffre y
apparaît sans travail supplémentaire.

Le bloc n'apparaît que si le personnage porte **au moins deux builds** : avec
un seul, un classement n'apprend rien.

## Honnêteté du chiffre

Trois limites, toutes affichées **à l'écran** et non reléguées en commentaire :

1. **Effets conditionnels non calculables.** Les passifs du type « Attaquer un
   ennemi affecté par… » dépendent du déroulé du combat. Listés sous « Non
   inclus dans le calcul », convention déjà en place.
2. **Buffs d'équipe hors modèle**, la source l'annonce elle-même.
3. **Chiffre comparatif, pas absolu.** Le libellé doit l'énoncer : il sert à
   classer des builds entre eux, pas à prédire un dégât en jeu.

Une carte muette vaut mieux qu'une carte fausse : si le catalogue ne connaît
aucune compétence pour un type d'arme donné, la ligne correspondante est
**absente** du classement plutôt que chiffrée à zéro.

## Tests

### `tests/degats-calcul.test.js` *(créé, unitaire)*

- Chaque terme de la formule appliqué isolément donne la valeur attendue.
- Doubler l'ATK double les dégâts ; doubler la DEF de la cible ne les divise
  **pas** par deux — c'est `K/(K+DEF)`, et cette non-linéarité mérite d'être
  fixée.
- L'espérance du critique : `1 + taux × dégâts`, avec la résistance critique de
  la cible retranchée.
- Un `damagePercent` absent rend `null`, jamais zéro.
- La somme de `repartition` vaut `pourcentage` à l'arrondi près.

### `tests/competences-catalogue.test.js` *(créé)*

Le catalogue commité est cohérent : chaque `weaponType` existe dans
`FOLDER_TO_ENUM`, chaque personnage cité existe dans le catalogue des
personnages, aucun `pourcentage` nul sur une compétence active.

### `tests/apport-par-piece.playwright.js` *(modifié)*

La fiche de héros y est déjà ouverte : le scénario gagne l'assertion que le
bloc « Puissance » classe bien les builds, et qu'il est **absent** quand le
personnage n'en porte qu'un.

## Hors périmètre

Chiffre absolu contre un boss (lot 2), classement du roster (lot 3), éditeur de
simulation (lot 4), rotations et temps de recharge, dégâts par seconde réels.

Le nom « comparateur » est retenu plutôt que « simulateur de DPS » : aucune
notion de temps n'entre dans ce calcul, et le mot promettrait ce que la formule
ne donne pas.
