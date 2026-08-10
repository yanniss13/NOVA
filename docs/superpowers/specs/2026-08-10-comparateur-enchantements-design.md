# Conception — comparateur local d'enchantements

**Date :** 2026-08-10
**Etat :** conception validee par le proprietaire.

## 1. But et limite

Le calculateur comparera les degats de **toutes les competences deja
chiffrees** entre le build enregistre et un essai d'enchantements.

Ce n'est pas un DPS temporel : les temps d'animation, les rotations et les
recharges restent inconnus. Les trois valeurs existantes par competence
(non-critique, critique, esperance) restent donc les mesures comparees.

La comparaison couvre uniquement :

- l'arme equipee ;
- l'armure gravee equipee (`Armure liee`).

Les bijoux, les quatre armures ordinaires, les niveaux, les renforcements, les
grades, l'outrepassement et les niveaux de passif restent hors essai. Le but
est d'arbitrer les **sous-stats d'enchantement**, pas de simuler un autre
build entier.

## 2. Donnees et isolation

A l'ouverture du calculateur, la configuration chiffree du build est la
reference. La vue cree une copie profonde locale des seules configurations
essayeables : `weaponConfig` et `armorConfig["Armure liee"]`.

Les changements n'ecrivent jamais dans le roster, les equipes, la collection,
le localStorage ni Supabase. Changer de heros, de type d'arme ou fermer puis
rouvrir le calculateur abandonne l'essai et repart de la reference courante.
Le bouton **Reinitialiser l'essai** restaure cette copie exacte.

Un build de reference incomplet, incompatible ou non couvert reste
incomparable : la vue conserve le message actuel « Configuration a completer »
et n'invente aucun zero.

## 3. Saisie des enchantements

Une carte « Comparer les enchantements » apparait dans le calculateur, avant
les resultats. Elle contient une ligne pour l'arme et une ligne pour l'armure
gravee lorsqu'elles sont equipees et calculees.

Chaque ligne ouvre l'editeur existant dans un mode `enchantmentsOnly` :

- les stats proposees, leurs bornes, le nombre d'emplacements et les regles de
  doublon viennent du catalogue existant ;
- l'editeur ne montre ni ne modifie niveau, renforcement, grade,
  outrepassement ou passif ;
- son action « Reinitialiser » remet la piece d'essai a sa configuration de
  reference, jamais a `null` ;
- une saisie invalide ou incomplete ne peut pas etre enregistree. Les degats
  de l'essai precedent restent alors visibles, sans faux resultat intermediaire.

Les validateurs metier actuels restent la source unique de verite. Aucun code
de statistique ni aucune borne n'est recopie dans la vue.

## 4. Calcul et affichage

La vue reconstruit un heros d'essai par valeur, en ne remplacant que les deux
configurations locales. Elle calcule ensuite une seconde fois les memes bases,
entrees et resultats de competences que la reference.

Les buffs coches, cumuls, cible, competence calibree et retouches manuelles
sont communs aux deux colonnes. Une retouche manuelle d'une statistique peut
masquer le gain d'un enchantement sur cette statistique ; un avertissement le
dit explicitement au lieu de faire croire que l'enchantement est sans effet.

Le tableau garde ses trois colonnes actuelles. Lorsqu'un essai differe de la
reference, chaque cellule affiche sous la valeur de reference la valeur
d'essai et son ecart (`+N`, `+N %` ou `-N`, `-N %`). Ainsi, le mobile conserve
la meme structure : la colonne Crit peut toujours etre masquee sans perdre la
reference ni l'essai des deux autres mesures.

Une competence non chiffree reste « Non inclus dans le calcul » dans les deux
cas. Aucun delta n'est affiche pour elle.

## 5. Decoupage

- `js/metier/` recoit les fonctions pures de preparation du build d'essai et
  de comparaison des resultats par competence. Elles ne lisent ni DOM ni
  stockage.
- `js/vues/calculateur.js` possede l'etat ephemere, ouvre les editeurs avec un
  rappel de commit local et rend la carte ainsi que les deltas.
- Les editeurs d'arme et d'equipement acceptent un mode explicite
  `enchantmentsOnly`, afin de reutiliser les validations sans laisser changer
  d'autres parametres.

Les modules importes seront ajoutes dans l'ordre de `tests/helpers/modules.js`.
Les donnees generees restent en lecture seule.

## 6. Tests et verification

Les tests unitaires verifieront que :

1. le build d'essai ne modifie pas son entree ;
2. seul l'enchantement de l'arme ou de l'armure gravee peut differer ;
3. les trois resultats de chaque competence portent le bon ecart ;
4. une competence non chiffree et une configuration invalide ne produisent pas
   de faux delta.

Le parcours Playwright montera une equipe exclusivement dans
`localStorage["confrerie7ds.teams"]`, ouvrira les deux editeurs d'essai,
verifiera une hausse visible sur toutes les mesures applicables, puis le
retour exact a la reference apres reinitialisation. Il verifiera aussi la vue
a 320 px.

Avant livraison : `npm run test:unit`, `npm test`, mutation volontaire d'une
valeur protegee et capture visuelle locale. Aucun essai navigateur ne contacte
ou ne modifie les donnees reelles du proprietaire.
