# Passation — passifs d'arme à cumuls, et une correction à faire

**Écrit le 2026-08-10.** Le dépôt est propre et tout est poussé au moment de
l'écriture : `main` = `4cafcf8`, zéro commit d'avance.

> **Ne fais pas confiance à ce document sur l'avancement.** Il peut être
> périmé dès sa rédaction. L'état réel se lit dans `git log`, pas ici. Ce qui
> vaut, ce sont les **mesures** et le **raisonnement** ci-dessous : elles
> coûtent cher à refaire, le reste non.

---

## 1. Ce qu'il faut corriger, et c'est urgent

`data/passifs-cumuls.js` contient **une ligne fausse**, expédiée dans
`221b56f`. Elle est fausse sur trois points à la fois :

```js
id:"derieri-gantelets-combo-de-coups",
effet:"bonusDegatsHeros",   // ← mécanisme faux
parCumul:54.48,
cumuls:50,
valeur:2724                 // ← valeur fausse
```

| | ce que la table fait | ce qu'il faut |
|---|---|---|
| mécanisme | bonus de dégâts global (`bonusGlobal`) | un **taux sur l'attaque élémentaire** |
| valeur au plafond | +27,24 % | **+21,8 %** sur ce build |
| plafond | 50 cumuls | **40 cumuls** |
| clé | `derieri` → `Gantelets` (type d'arme) | l'**arme précise**, à son niveau de passif |

**Pourquoi c'était faux.** J'ai attribué la croissance des dégâts coup après
coup au passif de personnage « Combo de coups », en concluant que son
infobulle était incomplète. Elle ne l'était pas. La vraie source était
publiée, sur l'**arme**, et je n'avais pas regardé l'arme.

La ligne donne le bon chiffre sur ce build précis — les deux modèles sont
linéaires et coïncident numériquement — mais elle diverge dès qu'un build a
une autre part d'attaque élémentaire, et elle s'applique aujourd'hui à
n'importe quels gantelets que Derieri équipe. Les douze autres gantelets du
catalogue n'ont pas ce passif.

**« Combo de coups » n'est pas mort pour autant** : ses cumuls majorent bien
les dégâts de *Duel* de 10 % chacun, exactement comme l'infobulle le dit. À
10 cumuls, le tic de Duel double — c'est ce qui explique les 5 097 relevés.
Ce qu'il ne fait pas, c'est toucher les dégâts de compétence.

---

## 2. La vraie source

**Gantelets de l'âme vorace**, passif « Barrage des Ténèbres ».
Fichier : `7ds-armes/Gantelets/Gantelets de l'âme vorace.webp`

> « Chaque coup porté sur un ennemi augmente l'attaque des Ténèbres de 2,5 %
> pendant 5 s. (Max : 100 %) »

Les sept niveaux sont **déjà dans `data/stats-build.js`**, sous
`weaponsByFile[fichier].passiveLevels` :

| niveau | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| pas | 0,8 % | 1,2 % | 1,4 % | 1,6 % | 1,8 % | 2 % | 2,5 % |
| plafond | 32 % | 48 % | 56 % | 64 % | 72 % | 80 % | 100 % |

**40 cumuls à tous les niveaux.** Aucune donnée à relever : tout est là.

Rien ne l'applique aujourd'hui — `weaponPassiveFact()` dans
[js/metier/build-config.js:170](../../../js/metier/build-config.js#L170) n'en
fait qu'un **texte affiché**.

Le niveau 7 porte une **seconde phrase**, elle aussi non modélisée :

> « L'utilisation de l'attaque ultime avec une consommation en magie réduite
> augmente les dégâts crit. de 1,5 % pendant 20 s pour chaque cumul de boost
> d'attaque des Ténèbres. (Max : 60 %) »

---

## 3. Les mesures — la partie irremplaçable

Toutes sur le **mannequin d'entraînement** (défense, résistances et défense
critique nulles), héros seul.

### Derieri, Gantelets, potentiel p5, passif d'arme niveau 7

Écran de stats : Attaque **4 382**, Attaque de l'équipement **8 817**,
Augmentation de l'attaque **51,00 %**, Attaque de tous les éléments **270**,
Attaque des Ténèbres **5 281**, Dégâts crit. **126,46 %**, Augmentation des
dégâts de compétence normale **0,00 %**.

Compétence : « Assaut fulgurant », 501 % (1er coup 186 %, 2e coup 315 %).
Le potentiel palier 4 donne **+45 %** de compétence normale, invisible à
l'écran.

| relevé | coups déjà portés | mesuré |
|---|---:|---:|
| frappe 1 | 0 | **68 724** |
| frappe 2 | 1 | **117 021** |
| frappe 1 | 4 | **70 221** |
| frappe 2, critique | 5 | **270 747** |
| tic « Duel » | — | **5 097** |

La frappe 2 porte toujours **un coup de plus** que la frappe 1 : chaque coup
porté octroie un cumul, et le premier vient d'être porté.

**La formule qui ferme, pire écart 0,0006 % sur les quatre :**

```
[ (4382 + 8817) × 1,51  +  5551 × (1 + 0,025 n) ] × coeff × 1,45 × (crit)
```

- `5551` = 5 281 de Ténèbres **+ 270 de « tous éléments »**. Les 2,5 % portent
  sur l'attaque élémentaire **entière**, pas sur la seule ligne « Ténèbres ».
  Prendre 5 281 seul donne un écart de **0,13 %**, soit 200 fois pire. C'est
  mesuré, pas déduit.
- `1,45` = le palier 4 du potentiel, mesuré à `1,450001` près.
- `crit` = `1 + 1,2646`, exact aux quatre relevés.
- Le tic de Duel vaut `2 × 10 % × 25 481` = 5 096,3 contre 5 097 relevés.
  Le facteur 2 vient de « Combo de coups » à 10 cumuls.

**Autres faits établis sur ce build :**
- La 2e frappe délivre **316,7 %**, pas les 315 % publiés. Le 1er coup, lui,
  ferme à 6 ppm sur 186 %. L'écart de 0,5 % est resté non corrigé, à dessein.
- Le palier 5 (« dégâts crit. +50 % à partir de 25 cumuls ») ne s'est jamais
  déclenché : le critique vaut exactement `1 + 126,46 %`.
- Duel (+30 % de dégâts) **ne s'applique jamais au lancer qui le pose** — la
  dernière frappe pose le débuff, sa propre valeur est résolue avant.

### Merlin p10, Baguette, Jugement foudroyant (159 %)

Deux états, avant et après un rerolle d'enchantement.

| | avant | après |
|---|---:|---:|
| non critique | **65 819** | **70 563** |
| critique | **178 119** | **181 256** |

État après : Attaque **4 813** + équipement **10 374**, Augmentation de
l'attaque **73,16 %**, Attaque de Foudre **1 409**, Augmentation de l'attaque
de Foudre **43,76 %**, Augmentation des dégâts de Foudre **12,44 %**,
compétence normale **23,81 %**, Dégâts crit. **150,87 %**, palier 4 **+15 %**.

```
[15187 × 1,7316 + 1409 × 1,4376] × 1,59 × (1 + 0,2381 + 0,1244) × 1,15 = 70 563
```

- Le **taux** d'attaque élémentaire ne se replie pas dans le nombre affiché :
  l'écran montre toujours 1 409 et range les 43,76 % à part.
- Le bonus de dégâts élémentaire tombe dans le **même seau additif** que le
  bonus de catégorie. Multiplicatif donnerait 72 097, soit 2,2 % de trop.
- Le critique porte **+6 points invisibles**, aux deux états, à 3 · 10⁻⁵
  près : un cumul du passif de sa tenue gravée (sanglier niveau 3, +6 % par
  utilisation de la compétence normale, plafond 24 %).

### King p9, Livre, « Protector of the forest » (151 %)

25 406 sans critique, 55 441 avec. Ferme à 0,0008 %.

---

## 4. Le plan que j'étais en train d'exécuter

Rien n'est commencé — l'arbre était propre à l'arrêt.

### 4.1 Nouvelle table `data/passifs-armes.js`

Clé = **fichier d'arme**, sur le modèle de `passifs-graves.js` (qui est clé
par fichier de tenue). Une seule ligne pour l'instant :

```js
window.SEVEN_DS_PASSIFS_ARMES = {
  "7ds-armes/Gantelets/Gantelets de l'âme vorace.webp":[
    {
      id:"gantelets-ame-vorace-barrage-tenebres",
      libelle:"Barrage des Ténèbres : attaque élémentaire +100 %",
      stat:"AllElement_Rate",
      operation:"add",
      unite:"ten-thousandths",
      niveaux:[3200, 4800, 5600, 6400, 7200, 8000, 10000],
      parCumul:[80, 120, 140, 160, 180, 200, 250],
      cumuls:40,
      provenance:{
        phrase:"(Max : ",
        phraseCumul:"augmente l'attaque des Ténèbres de "
      }
    }
  ]
};
```

`stat:"AllElement_Rate"` **et non `Dark_Rate`**, alors que le texte du jeu dit
« attaque des Ténèbres » : c'est la mesure qui tranche. `AllElement_Rate` est
le seul code du dépôt qui majore aussi la ligne « tous éléments », et c'est ce
que les relevés montrent. À écrire noir sur blanc dans l'en-tête du fichier.

Attention : ici l'espace avant les deux-points de « (Max : » est **ordinaire**
(0x20), contrairement aux tenues gravées qui emploient une insécable échappée
en ` `. Vérifié.

### 4.2 Module `js/metier/passifs-armes.js`

Copie conforme de `passifs-graves.js` : sept niveaux au lieu de trois, repli
sur le niveau 1 quand il n'est pas renseigné, et il résout `parCumul` et
`valeur` au niveau atteint.

**Le niveau de passif d'une arme vaut `weaponConfig.overlimit + 1`** — voir
`weaponPassiveFact()` dans `js/metier/build-config.js:170`.

### 4.3 Supprimer `data/passifs-cumuls.js` et tout son attirail

La table n'existait que pour la ligne fausse ; une fois retirée, elle est
vide. À supprimer entièrement plutôt qu'à laisser vide :

- `data/passifs-cumuls.js`
- `js/metier/passifs-cumuls.js`
- `tests/passifs-cumuls.test.js`
- `tests/helpers/passifs-cumuls-table.js`
- dans `sw.js` : les deux entrées de préchargement
- dans `tests/helpers/load-app.js` : le bac à sable et le hook
- dans `tests/helpers/modules.js` : la ligne du module
- dans `package.json` : le test, dans `test` **et** `test:unit`
- dans `js/vues/calculateur.js` : l'import, le chargement paresseux,
  `sectionPassifsCumuls`, et les usages de la variable `cumuls`

### 4.4 Le branchement — le point technique qui compte

Le bonus est un **taux sur l'attaque élémentaire**. Il se branche donc
exactement là où `AllElement_Rate` est déjà géré, dans
`statsElementairesDuBuild()` (`js/metier/calculateur-entrees.js`, arrivé au
commit `c18b574`) :

```
attaqueElementaire = propre × (1 + (tauxPropre + tauxTous)/R)
                   + tous   × (1 + tauxTous/R)
```

Ajouter le taux des cumuls à `tauxTous` reproduit `5551 × (1 + 0,025 n)`
exactement. **Ne surtout pas le faire passer par `entreesDuCalcul()`** :
l'attaque élémentaire y est déjà résolue en amont, dans `basesDuBuild()`, et
la ligne serait inerte.

Concrètement :
1. calculer `passifsArmes` **avant** `basesDuBuild()` — `hero` et `element`
   sont disponibles dès la ligne ~1152 de la vue ;
2. sommer `parCumul × crans` sur les lignes réglées ;
3. passer ce total en troisième argument de
   `basesDuBuild(hero, element, tauxElementaire)`, qui le transmet à
   `statsElementairesDuBuild(lire, element, tauxSupplementaire)`.

Ces lignes **ne rejoignent pas** la liste `coches` : elles n'ont ni `stat`
lisible par `entreesDuCalcul` ni `effet`, et y figurer les rendrait muettes.
Elles doivent en revanche entrer dans `lignesCochables()` — pour que « tout
cocher » les atteigne — et dans le compte « N ligne(s) active(s) ».

### 4.5 La vue

Une carte « Passifs d'arme », sur le modèle de `sectionTenuesGravees`, avec le
sélecteur `ligneACumuls()` qui existe déjà (commit `4cafcf8`). Marquer les
lignes `reglable:true` dans la vue, jamais dans la table — voir le §6.

### 4.6 Les tests

- **`tests/passifs-armes.test.js`** : calqué sur `passifs-graves.test.js`.
  Relit le pas ET le plafond dans les sept textes de `stats-build.js`, vérifie
  `parCumul[i] × cumuls === niveaux[i]` aux sept niveaux, refuse un code de
  stat inventé, et refuse une ligne qui ne changerait rien.
- **`tests/degats-calcul.test.js`** : le bloc Derieri existant encode le
  mauvais mécanisme (`bonusGlobal`) et lit
  `tests/helpers/passifs-cumuls-table`. À réécrire sur le modèle
  attaque-élémentaire, en rejouant les quatre relevés du §3. Tolérance
  relative de `1e-4` : les valeurs sont mesurées, pas exactes.
- Enregistrer le nouveau test dans `package.json`, `test` **et** `test:unit`.

---

## 5. Mesures encore à demander

1. **King p9 Livre, compétence de relève, sans critique.** Seul cas connu qui
   départage additif et multiplicatif sur les bonus de catégorie — il cumule
   19,70 % d'équipement et 25 % de potentiel sur la même catégorie.
   Multiplicatif : `× 1,49625`. Additif : `× 1,447`. **3,4 % d'écart.**
   C'est la mesure la plus rentable de toutes : elle touche presque tout le
   roster.
2. **Derieri à 25 cumuls, frappe 1, critique.** Déclenche le palier 5
   (« dégâts crit. +50 % »). Attendu **215 850** s'il s'ajoute à la stat,
   **176 825** s'il ne fait rien.
3. **Derieri, deux lancers d'Assaut fulgurant en moins de 15 s.** Confirme si
   les +30 % de Duel existent vraiment : le second lancer doit rendre
   **89 341** et **152 127**.
4. **Un coup sur Akumu, build connu.** Aucune mesure en jeu n'a jamais touché
   la moitié droite de la formule — mitigation, percement, faiblesse. Tout ce
   qu'on en sait vient de l'outil de référence.

---

## 6. Pièges du dépôt

- **CRLF partout**, encodage UTF-8. Une substitution Python doit lire avec
  `newline=""` et écrire de même.
- **`data/passifs-graves.js` cite « (Max : » avec une insécable
  échappée.** L'outil Edit peut convertir l'échappement en vrai caractère et
  casser la garde. Passer par un script pour toucher à ces lignes. L'arme du
  §4.1, elle, emploie une espace ordinaire — vérifié octet par octet.)
- **Le nom du champ est `cumuls`, pas `cumulMax`.** `buffs-supports.js` le
  portait déjà ; un synonyme a été introduit puis renommé le 2026-08-10.
- **Le marqueur `reglable` est posé par la vue**, jamais par les tables.
  Porter `cumuls` ne suffit pas à mériter un sélecteur : les huit buffs de
  soutien à cumuls gardent leur case. Le déduire du champ casserait ces
  sections en silence — elles écrivent dans `etat.coches` quand les fonctions
  de cumuls lisent `etat.cumuls`.
- **`npm test` lance aussi onze tests navigateur** (~4 min). `npm run
  test:unit` pour la boucle courte.
- **Ne jamais toucher au roster, aux équipes ni à la collection** du
  propriétaire lors d'un essai en navigateur : le site est branché sur son
  vrai compte. Les harnais de capture montent une équipe **locale** dans
  `localStorage` sous la clé `confrerie7ds.teams`.

---

## 7. Chantiers ouverts, par ordre de dégâts récupérés

1. **Les huit buffs de soutien à cumuls** (`data/buffs-supports.js`). Ils
   portent déjà `parCumul` et `cumuls`, testés. Même sélecteur, aucune donnée
   à écrire. Le propriétaire n'a pas encore tranché.
2. **Chiffrer « Ruée sauvage »** (`derieri_gauntlets_skill_q_1`). Le
   générateur la classe « non-chiffrée » alors que la description publie
   574 % et sa répartition en quatre coups. Ça débloque les deux lignes du
   palier 10 de Derieri, soit **+75 %** sur cette compétence, déjà rédigées
   dans l'en-tête de `data/degats-supplementaires.js`.
3. **La seconde phrase du passif de l'âme vorace** (§2), dégâts critiques
   indexés sur les cumuls de Ténèbres.
