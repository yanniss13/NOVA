# Perle de sortilège — emplacements facultatifs

## Décision

Le nombre d'emplacements d'une perle reste son plafond d'affichage et de
stockage :

| Palier | Emplacements possibles | Emplacements obligatoires |
| --- | ---: | ---: |
| Commune | 1 | 1 |
| Remarquable | 2 | 2 |
| Rare | 2 | 2 |
| Héroïque | 3 | 2 |
| Légendaire | 4 | 3 |

Le troisième emplacement Héroïque et le quatrième emplacement Légendaire ne
sont pas garantis dans le jeu. Ils restent configurables lorsqu'ils existent,
mais une configuration ne doit plus être déclarée incomplète lorsqu'ils sont
vides.

## Validation

- La longueur maximale reste pilotée par `slots`.
- Un palier Héroïque ou Légendaire conserve tous ses emplacements dans
  l'éditeur.
- Le dernier emplacement facultatif est affiché comme tel.
- Un emplacement facultatif vide est normalisé à `null` et ne bloque pas
  l'enregistrement.
- Un emplacement facultatif renseigné reste soumis à toutes les validations
  existantes : statistique autorisée, valeur bornée, palier et élément communs,
  et absence de doublon.
- Les autres paliers et les enchantements basiques conservent leurs règles
  actuelles.

## Régression

Les tests doivent prouver qu'une perle Héroïque avec deux statistiques et une
perle Légendaire avec trois statistiques sont valides, tout en refusant une
configuration trop longue ou une valeur invalide dans l'emplacement
facultatif.
