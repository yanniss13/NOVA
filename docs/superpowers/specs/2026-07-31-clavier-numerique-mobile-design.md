# Clavier numérique mobile — conception

## Objectif

Lorsqu’un membre doit saisir exclusivement un entier, afficher le pavé numérique
sur téléphone au lieu du clavier texte complet.

## Périmètre

Les champs concernés sont :

- le niveau d’une arme ;
- la valeur d’un enchantement d’arme ;
- le niveau de qualité d’une armure, d’une gravure ou d’un bijou ;
- la valeur d’une option aléatoire d’équipement ;
- le score global d’une run de boss.

Les menus déroulants, recherches, notes, identifiants et autres champs texte ne
changent pas.

## Comportement

Chaque champ du périmètre déclare `inputmode="numeric"` et
`pattern="[0-9]*"`. Cette combinaison donne aux navigateurs mobiles le signal
le plus explicite pour afficher un pavé composé de chiffres.

Les types, bornes `min`/`max`, pas `step`, valeurs et gestionnaires existants
restent inchangés. La validation métier demeure donc la source de vérité : ce
lot améliore uniquement le clavier proposé et ne modifie aucun calcul ni aucune
donnée persistée.

## Compatibilité et vérification

Le site reste fonctionnel sur ordinateur et hors ligne. Une régression
automatisée vérifie que tous les champs numériques du périmètre portent les deux
attributs, et que les champs textuels ne sont pas convertis par erreur.
