# Les outils de fabrication des données

Ces scripts lisent les données du jeu déjà exportées sur le disque et
produisent les fichiers de `data/` et `7ds-stats/`. Ils ne tournent jamais en
CI : ils ont besoin d'une source locale que le dépôt ne contient pas, et ne
contiendra pas.

Rien dans le site ne les appelle. Le workflow de publication les retire de
l'artefact — voir `.github/workflows/pages.yml`, dont un test tient le
contrat.

## Les deux variables à poser

Les chemins d'accès aux données ne sont plus écrits dans le code. Ce dépôt est
public, et il n'a pas à dire où vivent les fichiers du jeu ni avec quoi ils ont
été ouverts.

| Variable | Ce qu'elle désigne |
| --- | --- |
| `DONNEES_JEU` | Le dossier `Content` de l'export courant. La plupart des outils y cherchent `Table/`, `Actor/`, `Cha/PC/`. |
| `DONNEES_JEU_SOURCES` | Le dossier qui **contient plusieurs exports** ; seul `ecrire-magie-rotation.js` s'en sert, pour retenir le plus récent. |

```powershell
$env:DONNEES_JEU = "<...>/Content"
node outils/fabrication/ecrire-jauges-releve.js
```

Sans elles, les outils lisent une chaîne vide et échouent tout de suite sur un
fichier introuvable. C'est voulu : mieux vaut une erreur nette qu'un chemin
deviné.

## Ce qui n'est pas ici

Le déchiffreur d'archives et les notes d'extraction ont été retirés du dépôt.
Ils vivent hors de lui, et `.gitignore` empêche qu'une copie de travail les y
ramène. Diffuser publiquement un moyen de contourner une mesure technique de
protection est une infraction distincte du droit d'auteur ; ce dépôt est
public, et le site demande à l'éditeur du jeu l'autorisation d'utiliser ses
données.

## Régénérer un fichier de `data/`

Chaque fichier produit nomme son outil dans son en-tête. L'en-tête écrit par
l'outil et celui du fichier commité doivent dire la même chose : si l'un
change, corriger l'autre dans le même commit, sinon la première régénération
ramène l'ancien texte.
