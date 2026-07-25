# Recensement DPS — exception Gowther Briseur P7

## Objectif

Corriger le recensement automatique des DPS afin qu'un rôle **Briseur** ne soit
plus considéré comme un DPS par défaut.

## Règle fonctionnelle

- Un build dont le rôle d'arme est `Attacker` est recensé comme DPS.
- Un build dont le rôle d'arme est `Buster` est exclu du recensement DPS.
- Une seule exception existe : le build **Baguette** de **Gowther**, dont le rôle
  est `Buster`, est recensé lorsque le potentiel commun de Gowther est supérieur
  ou égal à **P7**.
- Gowther en Baguette de P0 à P6 reste exclu.
- Les autres armes de Gowther suivent leur rôle normal et ne bénéficient pas de
  l'exception.
- Tous les autres Briseurs restent exclus, quel que soit leur potentiel.

L'exception s'applique uniquement si le build Baguette est réellement enregistré
dans le roster du joueur. La présence de Gowther P7+ sans ce build ne crée pas de
DPS automatiquement.

## Conception technique

La décision d'éligibilité sera centralisée dans une fonction dédiée appelée par
`dpsEntriesFromRoster(entry)` :

1. accepter immédiatement les emplacements d'arme `Attacker` ;
2. refuser les rôles différents de `Buster` ;
3. pour un `Buster`, accepter uniquement `entry.charId === "gowther"`, l'arme
   `Wand` correspondant au dossier `Baguette`, et
   `entry.potentialTier >= 7`.

La dérivation existante de l'élément, du potentiel et la déduplication par
élément restent inchangées. Aucun changement de schéma Supabase ni de données
persistées n'est nécessaire.

## Interface

Le texte qui décrit le recensement offensif ne doit plus présenter tous les
Briseurs comme des DPS. Il indiquera que les Attaquants sont recensés, avec
l'exception de Gowther Baguette à partir de P7.

## Tests d'acceptation

- Un build `Attacker` est toujours recensé comme DPS.
- Un Briseur ordinaire, même P7 ou plus, n'est pas recensé.
- Gowther Baguette P6 n'est pas recensé.
- Gowther Baguette P7 est recensé avec son élément et son potentiel P7.
- Gowther Baguette P10 reste recensé.
- Gowther P7+ sans build Baguette n'est pas ajouté.
- Les builds Support de Gowther ne sont jamais acceptés par l'exception.

Cette règle remplace, pour le recensement DPS, la définition antérieure qui
classait indistinctement les rôles `Attacker` et `Buster` comme offensifs.
