# Habillage visuel du calculateur

**Date :** 2026-08-09
**État :** validé, prêt pour le plan d'implémentation

## Objectif

Faire que l'onglet Calculateur ressemble au reste du site. C'est le seul onglet
sans cartes, sans titres en Cinzel et sans contour de tableau : `calculateur.css`
fait 96 lignes quand `analyse.css` en fait cinq fois plus, et les quatre sections
de buffs sont titrées par un `<strong>` nu.

**Ce chantier ne change ni un chiffre, ni un texte, ni un comportement.** Il
n'ajoute aucune fonctionnalité. C'est de l'habillage, et rien d'autre.

## Ce qui a été écarté, et pourquoi

Trois pistes ont été examinées puis retenues hors périmètre, sur décision
explicite :

- **Remonter le tableau avant les sections de buffs.** Le CSS actuel porte
  déjà la trace du problème (« vingt-quatre buffs en liste plate faisaient
  défiler la page entière avant d'atteindre le tableau, qui est pourtant l'objet
  de la page »). L'ordre de la page **ne change pas** : ce n'est pas la gêne
  ressentie.
- **Trier les compétences par dégâts, ou mettre en avant la plus forte.** Écarté
  nettement. Les lignes restent dans l'ordre du kit. Aucun maximum n'est calculé.
- **Refondre le balisage de la vue.** Écarté au profit de retouches d'enveloppe :
  1254 lignes touchées et les tests Playwright à reprendre pour un gain visuel
  identique.

## Le vocabulaire visuel retenu

Deux emprunts au site, aucune invention :

**Les cartes** reprennent trait pour trait `.cov-card` d'`analyse.css` : fond
`--panel`, bordure `--line`, `border-top: 2px solid var(--ec)`, rayon 10. Le
mécanisme `--ec` est celui que `js/vues/analyse.js` pose déjà en variable CSS
inline.

**Le tableau** devient un panneau de résultat : conteneur `--panel-2`, bordure
`--gold-deep`, coins arrondis, `overflow: hidden`, bandeau doré en tête. Les
en-têtes de colonne adoptent le style de `.rank-head` — 11 px, majuscules,
`--muted`, sans graisse.

### Le dégradé d'or

Les quatre sources de buffs se distinguent par un liseré, tiré du seul axe doré.
Aucune couleur nouvelle : le site réserve déjà sept teintes aux éléments
(`ELEMENTS` dans `js/noyau/constantes.js`), et le badge d'élément du build est
affiché sur cette même page. Un liseré violet sur « Tenues gravées » se lirait
comme un indice d'élément Ténèbres — une histoire fausse.

| Section | `--ec` | Valeur |
|---|---|---|
| Soutiens | `var(--gold-bright)` | `#f0c674` |
| Tenues gravées | `var(--gold)` | `#d9a441` |
| Potentiels d'équipe | `var(--gold-deep)` | `#a97e2c` |
| Dégâts supplémentaires | `var(--muted-2)` | `#6f6960` |

L'ordre du dégradé suit l'ordre d'affichage : la lecture descend du clair à
l'éteint.

## Les modifications de balisage

Dans `js/vues/calculateur.js`, uniquement des enveloppes et des titres. Aucune
condition, aucun calcul, aucune chaîne de caractères modifiée.

| Ligne | Aujourd'hui | Après |
|---|---|---|
| 441-442 | `section.calc-soutiens` + `el("strong",{text:"Soutiens"})` | `section.calc-soutiens.calc-carte` + `el("h3",{class:"calc-carte-titre",text:"Soutiens"})` |
| 525-526 | `section.calc-tenues` + `strong` | `.calc-tenues.calc-carte` + `h3.calc-carte-titre` |
| 578-579 | `section.calc-potentiels` + `strong` | `.calc-potentiels.calc-carte` + `h3.calc-carte-titre` |
| 699-700 | `section.calc-supplements` + `strong` | `.calc-supplements.calc-carte` + `h3.calc-carte-titre` |
| 736 | `section.calc-calibration` | `.calc-calibration.calc-carte` (son `<h3>` de la ligne 737 reçoit `calc-carte-titre`) |
| 860-870 | `tableauDesCompetences()` retourne le `<table>` | retourne `div.calc-resultat` contenant `div.calc-resultat-titre` puis le `<table class="calc-table">` inchangé |
| 874 | `section.calc-avertissement` final | `.calc-avertissement.calc-carte` |

### Deux blocs volontairement épargnés

**`calc-tout-cocher`** ne devient pas une carte. Le commentaire de
`calculateur.css` établit qu'elle est sans trait de séparation pour se lire
comme l'en-tête des quatre sections et non comme une cinquième source de buffs.
La carder contredirait cette intention.

**`calc-calibration`** reçoit la coque de carte mais **aucun liseré**. Le
dégradé signifie « source de buff » ; la calibration n'en est pas une. Même
règle pour le bloc `avertissements()` final.

## Les ajouts CSS

Dans `css/calculateur.css`, quatre blocs nouveaux :

- `.calc-carte` — la coque, avec `--ec` par défaut à `var(--gold)`.
- `.calc-carte-titre` — Cinzel 13 px, majuscules, `letter-spacing:.10em`,
  couleur `var(--ec)`.
- Les quatre affectations de `--ec` par classe de section, plus la neutralisation
  du liseré sur `.calc-calibration` et `.calc-avertissement.calc-carte`.
- `.calc-resultat` et `.calc-resultat-titre` — le panneau et son bandeau.

Le style de `.calc-table` est ajusté pour vivre dans le panneau : plus de
`margin-bottom` propre, filets internes conservés, et les `<th>` reprennent
l'allure de `.rank-head` — 11 px, majuscules, `letter-spacing:.1em`, `--muted`.

**Ces propriétés sont recopiées dans `css/calculateur.css`, la classe
`.rank-head` n'est pas réutilisée.** L'emprunter coupléraient deux feuilles dont
l'ordre de chargement est déjà vérifié par `tests/css-ordre.test.js`, et
importerait au passage son `background:var(--panel)`, qui jure avec le fond
`--panel-2` du panneau.

Enfin, une suppression : la règle actuelle qui donne
`border-top:1px solid var(--line-soft); padding-top:12px` à `.calc-soutiens`,
`.calc-tenues`, `.calc-potentiels`, `.calc-supplements` — et la règle jumelle sur
`.calc-calibration` — **disparaît**. La bordure de la carte remplace ce
séparateur ; les laisser cohabiter donnerait un filet à l'intérieur du cadre.

### Responsive

Les trois règles existantes sous 560 px sont **conservées telles quelles** :
colonne Crit masquée, cases à cocher ramenées à 44 px, grille de soutiens en une
colonne. Une seule règle s'ajoute : réduction du rembourrage des cartes, pour
que la densité gagnée sur grand écran ne coûte pas de largeur utile à 320 px.

## Non-régression

`tests/calculateur.playwright.js` doit passer **sans la moindre retouche**. Si un
test casse, c'est le signe que le périmètre a été dépassé. Trois contraintes en
découlent, relevées dans le fichier de test :

1. **`.calc-table` reste un vrai `<table>` avec `tbody tr`.** Douze assertions
   lisent `.calc-table tbody tr` et `.calc-valeur`. Le panneau est un `<div>`
   *autour* du tableau, jamais un remplacement par des `<div>`.
2. **Aucun `.calc-champ` nouveau.** Le test repère « Coéquipier 1 » par
   `hasText`, et un commentaire du fichier prévient qu'un `.calc-champ`
   supplémentaire décale tout repérage positionnel.
3. **Le bandeau n'est pas un `.calc-avertissement`.** Trois tests appellent
   `allTextContents()` sur cette classe et compareraient un texte de plus.

Les classes existantes sont toutes conservées : `.calc-soutien`, `.calc-buff`,
`.calc-valeur`, `.calc-muette`, `.calc-retouche`, `.calc-cible`,
`.calc-coequipier(s)`, `.calc-calibration-message`. Aucune n'est renommée.

## Critères de réussite

- Les quatre sections de buffs se distinguent au premier coup d'œil par leur
  liseré, sans qu'aucune couleur nouvelle n'entre dans la palette.
- Les titres sont en Cinzel, comme partout ailleurs sur le site.
- Le tableau est un panneau bordé et coiffé d'un bandeau, dans l'ordre du kit,
  sans ligne mise en avant.
- La suite Playwright du calculateur passe sans modification.
- À 320 px, rien ne déborde et les cibles tactiles restent à 44 px.
