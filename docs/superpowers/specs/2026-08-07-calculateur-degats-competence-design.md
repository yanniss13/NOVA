# Calculateur de dégâts par compétence

**Date :** 2026-08-07
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Une page où un membre choisit un personnage, un de ses builds enregistrés et
lit **les dégâts que chaque compétence inflige à Akumu**, le boss de confrérie.

Inspiration revendiquée : `tapscreen.app`, dont le Damage Calculator est une
page à part entière, avec choix de la cible et détail par compétence. Trois
choses en sont reprises — la page dédiée, le choix de la cible, le détail par
compétence — et une est écartée : son habillage visuel.

## Pourquoi pas un DPS

La branche `comparateur-degats-lot1` contient un simulateur événementiel qui
déroule 60 secondes et rend un DPS. Il n'est pas repris, pour une raison
énoncée par le propriétaire : **les données qui manquent sont précisément
celles dont un DPS dépend.**

- Les temps d'animation ne sont mesurés nulle part. La simulation pose
  `durée: 0` pour chaque action, hypothèse qui gonfle mécaniquement le nombre
  d'actions tenues dans la fenêtre.
- Les buffs des coéquipiers sont hors modèle, alors qu'ils changent l'ordre des
  compétences autant que leur valeur.

Un dégât par compétence ne demande ni chronologie, ni ordre, ni cadence. Les
inconnues disparaissent du calcul au lieu d'être approximées en silence. Le
simulateur reste dans l'historique de la branche, récupérable le jour où les
animations seront mesurées — le protocole de mesure est décrit dans
`docs/superpowers/specs/2026-08-05-comparateur-dps-60s-design.md`.

## Ce qui est repris, ce qui est laissé

La branche `comparateur-degats-lot1` a 13 commits d'avance sur `main`, qui en a
pris 29 depuis. Elle n'est pas fusionnable telle quelle et ne doit pas l'être en
entier.

| Repris de la branche | Rôle |
|---|---|
| `data/competences.js` | Coefficients, nombre de coups, répartition par coup, nature, composantes. |
| `scripts/generate-competences.py` + ses tests | Régénère le catalogue, mode `--check` hors réseau. |
| `js/metier/degats-calcul.js` | La formule, terme à terme, critique en espérance. |
| `tests/degats-calcul.test.js`, `tests/competences-catalogue.test.js` | Leurs régressions. |

| Laissé sur la branche | Pourquoi |
|---|---|
| `js/metier/dps-simulation.js` | N'existe que pour dérouler le temps. |
| `js/metier/dps-effets.js`, `data/effets-dps.js` | Effets personnels datés, inutiles sans fenêtre. |
| `scripts/generate-effets-dps.py`, `scripts/effets-dps-regles.py` | Leurs générateurs. |
| `tests/dps-*.test.js`, `tests/effets-dps-catalogue.test.js`, `tests/test_generate_effets_dps.py` | Leurs suites. |

**Préalable d'intégration.** Ne pas rebaser les 13 commits. Partir d'une branche
neuve issue de `main`, y importer les seuls fichiers repris
(`git checkout comparateur-degats-lot1 -- <fichiers>`), puis les adapter.
`js/vues/fiche-heros.js` a divergé des deux côtés : son correctif d'ouverture de
fiche est déjà sur `main` (`dd8dac4`), il ne doit pas revenir en double.

## Le catalogue de compétences et celui du wiki

`main` a gagné `data/wiki-competences.js` après la branche. Les deux catalogues
portent le **même `gameId`** et se complètent sans se recouvrir :

- `wiki-competences.js` — `nomFr`, `descriptionFr`, `icone`, passifs inclus ;
- `competences.js` — les chiffres, passifs exclus.

La page joint les deux par `gameId` : nom et icône français d'un côté, valeurs
de l'autre. Aucun des deux n'est à régénérer, aucune fusion n'est nécessaire.

Quand un `gameId` chiffré n'a pas d'équivalent dans le catalogue du wiki, la
ligne est **conservée avec son chiffre** et affiche le `nom` anglais que
`competences.js` porte déjà, sans icône. Un nom anglais se remarque ; un chiffre
absent se croirait nul.

## La cible : Akumu

`CIBLE_REFERENCE` conserve son nom et change de valeurs. Elles sont **relevées**
sur `https://7dsorigin.app/en/knighthood-boss/demonic-beast-akumu`, jamais
inventées :

```js
const CIBLE_REFERENCE = {
  nom:"Akumu, bête démoniaque",
  def:3454,
  critResist:2000,          // 20 %
  critDmgResist:5000,       // 50 %
  resistanceElementaire:3000, // 30 %, identique sur les 8 éléments
  faiblesse:0
};
```

Le moteur n'a pas à changer : ces cinq champs sont exactement ceux qu'il
consomme déjà.

Trois conséquences à écrire à l'écran, pas seulement ici :

1. **Les classements changent, pas seulement l'échelle.** La DEF est un facteur
   commun à toutes les compétences, mais la défense critique passe de 6,5 % à
   50 % et la résistance critique de 10 % à 20 %. Les builds misés sur le
   critique étaient surévalués par la cible Banakro.
2. **L'élément ne change rien sur Akumu.** Les huit résistances élémentaires
   valent 30 % et aucune faiblesse n'est publiée. C'est une information utile en
   soi, et elle doit être dite plutôt que déduite d'un tableau plat.
3. **Les 20 niveaux de difficulté ne sont pas publiés.** La source expose un
   seul bloc de statistiques. La page annonce que le chiffre vaut pour ce bloc
   et ne prétend pas couvrir un niveau choisi. Aucune extrapolation par niveau
   n'est inventée.

`nom` duplique volontairement `BOSS_NAME` de `js/donnees/boss-store.js` : un
module métier pur n'importe pas depuis `js/donnees/`. Un test vérifie que les
deux chaînes restent identiques, afin que la dérive se voie.

## Les entrées

### Personnage et build

Le membre choisit un personnage, puis un de ses builds enregistrés. Arme,
équipement, enchantements et potentiel viennent du roster. Les trois bases
offensives sont produites par `calculateHeroStats`, lues par code de stat via
`groupBuildStatResults` :

- `B_Atk` → ATK ;
- `C_Critical_Rate` → taux critique ;
- `C_Critical_Dam_Rate` → dégâts critiques.

Un build dont le statut n'est ni `valid` ni `partial` ne porte aucun chiffre :
la page dit « Configuration à compléter » et n'affiche pas de tableau. Jamais de
zéro à la place d'un inconnu.

### Retouche

Les trois bases restent modifiables, ainsi qu'un bonus de dégâts (`bonusType`).
Toute valeur retouchée est marquée, un bouton la réinitialise, et l'en-tête du
résultat porte alors **« Valeurs retouchées — ne reflète plus ton build »**.
Les retouches ne sont jamais écrites dans le roster.

## Les soutiens

La source ne permet pas de les modéliser automatiquement. Son champ `buffs` a
été relevé :

```json
{"buffId":"309000003","iconId":"","nameEn":"","buffType":"Debuff","duration":2000,"descriptionEn":""}
```

Un identifiant, un type, une durée en millisecondes — **aucune stat, aucune
valeur, aucune cible**, et souvent un nom et une description vides. La magnitude
d'un buff n'existe que dans la prose de la description de compétence, que le
navigateur n'a pas le droit de lire. La branche l'avait déjà constaté pour les
effets personnels : `scripts/effets-dps-regles.py` y consacre 765 lignes de
règles écrites à la main.

D'où une table **écrite et maintenue à la main**, `data/buffs-supports.js`,
couvrant les seuls supports que la confrérie joue réellement.

### Les sept supports retenus

Relevés dans `data/wiki-competences.js`, avec le nombre de compétences
mentionnant explicitement les alliés :

| Slug | Nom donné | Compétences citant les alliés |
|---|---|---:|
| `elizabeth` | Elisabeth | 8 |
| `daisy` | Daisy | 4 |
| `manny` | Mannie | 5 |
| `howzer` | Hauser | 3 |
| `gowther` | Gowther | 6 |
| `guila` | Guila | 2 |
| `dreydrin` | Dedrin | 4 |

⚠️ **`dreydrin` est à confirmer.** Le catalogue contient aussi `derieri`, dont
7 compétences visent les alliés, et dont les buffs sont offensifs — attaque de
Feu, dégâts de compétence normale des héros Ténèbres — là où ceux de `dreydrin`
sont défensifs. Les deux tables n'auraient presque aucun contenu commun. Ne pas
trancher au jugé.

### Forme

```js
window.SEVEN_DS_BUFFS_SUPPORTS = {
  "<charId>": [
    {
      id:"<identifiant stable>",
      libelle:"Dégâts crit. des alliés +15 %",
      stat:"C_Critical_Dam_Rate",
      valeur:1500,
      unite:"ten-thousandths",
      element:null,          // ou "wind", "fire", … si le buff cible un élément
      provenance:{
        gameId:"daisy_book_skill_q",
        phrase:"Augmente les dégâts crit. des alliés de 15% pendant 40s"
      }
    }
  ]
};
```

⚠️ Ce fichier vit dans `data/` mais **n'est pas généré**. Son en-tête doit le
dire, parce que la règle du dépôt est l'inverse pour tous ses voisins. Aucun
script ne l'écrit ; un test vérifie qu'aucun générateur ne le cite.

`provenance` porte le `gameId` et la phrase française exacte dont la valeur est
tirée. C'est ce qui rend la correction possible : quand un chiffre est démenti
en jeu, on sait quelle phrase avait été lue et où.

**Application.** Chaque buff alimente une des quatre entrées que le moteur
accepte déjà — `atk`, `critRate`, `critDamage`, `bonusType`. Aucune
modification du moteur n'est nécessaire.

Trois natures de buff sont apparues au relevé, et la table doit les distinguer
au lieu de les aplatir :

1. **Buff chiffrable directement** — « Augmente les dégâts crit. des alliés de
   15 % ». Il entre tel quel.
2. **Buff indexé sur le support lui-même** — « Augmente l'attaque de Vent de
   tous les héros alliés à hauteur de 30 % de l'attaque du héros (Max : 3000) ».
   Sa valeur dépend du build du *support*, que le calculateur ne connaît pas.
   La table porte alors la valeur **plafond** relevée et l'annonce comme telle ;
   le membre la corrige à ce que son propre support produit. C'est précisément
   ce que le champ modifiable sert à couvrir.
3. **Buff conditionnel** — « lorsqu'un héros allié attaque un ennemi affecté par
   Lien ». Aucune condition n'est modélisée : cocher le buff, c'est déclarer la
   condition remplie, et la page le dit.

Un soin, une barrière ou un gain de défense n'entre pas dans la table : sans
conversion offensive, il ne change aucun dégât. Ne pas l'y mettre à zéro — il
n'y a pas sa place du tout.

**Élément.** Beaucoup de ces buffs ne visent qu'un élément — « dégâts de Vent »,
« attaque de Feu », « héros alliés d'attribut Ténèbres ». Or l'élément d'un
héros **dépend de l'arme équipée**, pas du personnage : c'est le piège
documenté dans `AGENTS.md`, et `FOLDER_TO_ENUM` donne l'élément du slot d'arme
via `personnages-meta.js`. Un buff portant un `element` n'est proposé que si le
build affiché a cet élément. Il n'est ni grisé ni affiché à zéro : il est
absent, comme une compétence sans coefficient.

**Interface.** Une section « Soutiens » liste les buffs applicables, chacun
avec une case à cocher et sa valeur modifiable. **Tout est décoché par
défaut** : le chiffre par défaut est celui du héros seul, et l'en-tête indique
« héros seul » ou « avec N buff(s) d'équipe ». Les durées ne sont pas
modélisées : un buff coché est considéré actif, hypothèse énoncée à l'écran.

## La sortie

Une ligne par compétence du type d'arme du build, dans l'ordre du catalogue :

```text
Compétence                   Non-crit      Crit    Espérance
Fendoir des ombres              8 402    18 380       11 866
Rossée des ténèbres             9 118    19 512       13 806
```

- **Non-crit** — le facteur sans aucun terme critique ;
- **Crit** — le facteur multiplié par `1 + (critDamage − critDmgResist)/10000` ;
- **Espérance** — `1 + taux × dégâts`, la valeur déjà rendue par le moteur.

Les trois colonnes sont montrées parce que l'espérance seule masque la variance
qu'un joueur ressent, et que le critique seul flatte.

`degatsAttendus` ne rend aujourd'hui que l'espérance, sous le nom `total`. Elle
gagne deux champs, `sansCritique` et `critique`, calculés depuis le **même**
`facteur` intermédiaire. Ne pas les obtenir en rappelant la fonction avec un
taux critique forcé : trois appels aux entrées différentes ouvriraient trois
occasions de diverger, alors que les trois colonnes doivent rester trois
lectures d'un seul calcul. `total` conserve son sens et sa valeur, et les
assertions existantes de `tests/degats-calcul.test.js` restent vraies.

Un dépliant par compétence donne :

1. la décomposition terme à terme, telle que `degatsAttendus` la renvoie déjà ;
2. le détail par coup, quand `repartition` est publiée.

Une compétence de `nature:"non-chiffree"` reste **listée sans chiffre**, sous la
formule exacte **« Non inclus dans le calcul »**. Une compétence absente du
catalogue n'apparaît pas plutôt que d'apparaître à zéro.

## Non inclus dans le calcul

Énoncé à l'écran, sous cette formule exacte :

- les passifs conditionnels du héros et de son équipement ;
- les buffs de coéquipiers non cochés, et les durées de ceux qui le sont ;
- les debuffs appliqués à la cible ;
- les temps d'animation, donc toute notion de dégâts par seconde ;
- les attaques normales, les compétences de relève et les attaques combinées ;
- les mécaniques propres à Akumu : pierres élémentaires, attaque dorsale,
  renforcement à chaque mort d'un joueur.

## Où ça vit

Un onglet **« Calculateur »**. L'en-tête sait déjà passer sur deux étages quand
les onglets ne tiennent plus (`d82b486`).

Le bloc « Puissance par arme » de la fiche de héros **ne calcule plus rien** :
il devient un lien « Calculer les dégâts » qui ouvre la page pré-remplie sur ce
héros et ce build. Une seule implémentation du calcul, un seul endroit à
corriger.

## Architecture

| Fichier | Responsabilité |
|---|---|
| `data/competences.js` *(importé de la branche)* | Catalogue de calcul, figé. |
| `data/buffs-supports.js` *(créé, manuel)* | Buffs des supports réellement joués. |
| `scripts/generate-competences.py` *(importé)* | Régénère le catalogue. `--check` hors réseau. |
| `js/metier/degats-calcul.js` *(importé, cible modifiée)* | La formule et ses termes. |
| `js/metier/calculateur-entrees.js` *(créé)* | Pur : build + buffs cochés → les quatre entrées du moteur. |
| `js/vues/calculateur.js` *(créé)* | La page : sélection, retouche, soutiens, tableau. |
| `js/vues/fiche-heros.js` *(modifié)* | Le bloc devient un lien. |
| `css/calculateur.css` *(créé)* | Son habillage. |

Un module métier neuf s'enregistre aux **quatre** endroits obligatoires :
`tests/helpers/modules.js`, `sw.js` (`CORE_ASSETS`), l'`import` du consommateur,
et la liste `hooks` de `tests/helpers/load-app.js`. Les deux catalogues sont
chargés par `index.html` en `<script>` classique et précachés : la page
fonctionne hors ligne. Un test unitaire neuf rejoint **les deux** scripts
`test` et `test:unit` de `package.json`.

`js/metier/calculateur-entrees.js` existe pour que la traduction
« build + buffs → entrées du moteur » soit testable sans navigateur, et pour que
`js/vues/calculateur.js` ne contienne aucun calcul.

## Tests

### Moteur et cible

- `tests/degats-calcul.test.js`, repris : ses assertions sur la formule restent
  valables, celles qui figeaient les valeurs de Banakro deviennent celles
  d'Akumu.
- La défense critique de 50 % réduit bien l'espérance par rapport à l'ancienne
  cible, à build identique — c'est la conséquence n° 1 annoncée à l'écran.
- `CIBLE_REFERENCE.nom` est identique à `BOSS_NAME` de `js/donnees/boss-store.js`.

### Entrées et buffs

- Un buff coché modifie l'entrée attendue et une seule ; décoché, le résultat
  est strictement celui du héros seul.
- Chaque buff de `data/buffs-supports.js` porte un `stat` connu des
  métadonnées, une `unite` autorisée, et une `provenance` dont le `gameId`
  existe dans `wiki-competences.js` et dont la `phrase` est un extrait littéral
  de la `descriptionFr` correspondante. C'est ce qui empêche une valeur
  inventée de s'installer.
- Un buff portant un `element` est proposé pour un build de cet élément et
  absent des autres, l'élément étant lu depuis l'**arme équipée** et non depuis
  le personnage.
- Aucun générateur de `scripts/` ne cite `buffs-supports.js`.
- Un build de statut autre que `valid` ou `partial` ne produit aucune entrée.

### Catalogues

- `tests/competences-catalogue.test.js`, repris.
- La jointure par `gameId` est mesurée : un `gameId` chiffré sans équivalent
  dans `wiki-competences.js` garde son chiffre et retombe sur son nom anglais.
- `degatsAttendus` rend `sansCritique ≤ total ≤ critique` pour tout taux
  critique compris entre 0 et 100 %.

### Page

- La page s'ouvre pré-remplie depuis la fiche de héros.
- Les trois colonnes sont présentes et le tableau est ordonné.
- Retoucher une base marque le résultat.
- Une compétence `non-chiffree` apparaît sous « Non inclus dans le calcul ».
- Aucun zéro affiché à la place d'une donnée absente.

Validation finale : `npm test`. Les deux scénarios Playwright connus comme
instables sont relancés isolément avant toute conclusion de régression.

## Hors périmètre

Dégâts par seconde, rotations, temps d'animation, attaques normales, relève et
attaques combinées. Choix d'un autre boss ou d'un autre niveau de difficulté.
Debuffs appliqués à la cible. Modélisation automatique des buffs d'alliés.
Comparaison de plusieurs héros entre eux. Aspiration réseau pendant les tests
ou au rendu.
