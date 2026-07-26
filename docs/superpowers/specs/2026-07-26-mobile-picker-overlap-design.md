# Correctif mobile — superposition des vignettes dans les sélecteurs

## Problème reproduit

Dans les modales de sélection du Team Builder, la grille devient un élément
flexible contraint par la hauteur maximale de la modale. Sur un viewport de
320 px, CSS Grid réduit chaque ligne à 44 px alors que l'image d'une vignette
mesure environ 110 px. L'image et le nom débordent alors sur les lignes
suivantes.

Le défaut touche le sélecteur commun `#pickerGrid`, donc les choix de héros,
d'armes, d'armures et de bijoux. La modale de potentiel, qui n'utilise pas
cette grille, ne présente pas cette superposition.

## Correction retenue

La grille `.picker-grid` utilisera des lignes implicites dimensionnées sur leur
contenu avec `grid-auto-rows: max-content`.

Chaque `.tile` conservera ainsi la hauteur nécessaire pour contenir :

- son image carrée ;
- son nom ;
- ses espacements et bordures.

La modale conserve sa hauteur maximale dynamique et `.picker-grid` reste la
zone défilable. La taille des images, le nombre de colonnes et l'identité
visuelle ne changent pas.

## Test de non-régression

Le parcours Playwright mobile ouvrira les sélecteurs de héros et d'armes à
320 px et 390 px. Pour chaque vignette représentative, il vérifiera que :

- l'image et le nom restent à l'intérieur du bouton `.tile` ;
- la vignette suivante commence après la fin de la ligne précédente ;
- la grille reste défilable dans la modale ;
- le document ne gagne aucun débordement horizontal.

Les tests existants des modales, du mobile et du Team Builder doivent rester
verts.
