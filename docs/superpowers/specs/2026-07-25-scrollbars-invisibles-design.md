# Barres de défilement invisibles — Design

**Date :** 2026-07-25  
**Statut :** validé par l’utilisateur

## Objectif

Masquer visuellement toutes les barres de défilement du site afin de préserver
le thème héraldique sombre, sans supprimer aucune possibilité de navigation.

## Comportement

- La barre verticale de la page principale est invisible.
- Les barres des modales, tableaux, onglets, filtres et rails horizontaux sont
  invisibles.
- Le défilement reste fonctionnel avec la molette, le pavé tactile, le toucher,
  le clavier et les gestes horizontaux.
- Les règles `overflow`, les dimensions et la disposition des composants ne
  changent pas.

## Implémentation

Une règle CSS globale couvre les moteurs modernes :

- `scrollbar-width:none` pour Firefox ;
- pseudo-élément `::-webkit-scrollbar` masqué pour Chromium et Safari.

La règle s’applique à la page et à tous les éléments internes. Les anciennes
règles ciblées devenues redondantes peuvent rester si elles ne contredisent pas
la règle globale.

## Vérification

Un test statique confirme la présence des deux mécanismes CSS. Les tests
Playwright existants vérifient que les pages et rails restent défilables et
qu’aucun débordement horizontal du document n’apparaît à 320, 360 et 390 px.

## Hors périmètre

- bloquer le défilement ;
- remplacer les barres par des contrôles personnalisés ;
- modifier les couleurs, espacements ou animations du thème.
