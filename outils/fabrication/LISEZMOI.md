# Les outils de fabrication des données

Ces scripts lisent les données du jeu déjà exportées sur le disque et
produisent les fichiers de `data/` et `7ds-stats/`. Ils ne tournent jamais en
CI : ils ont besoin d'une source locale que le dépôt ne contient pas, et ne
contiendra pas.

Rien dans le site ne les appelle. Le workflow de publication les retire de
l'artefact — voir `.github/workflows/pages.yml`, dont un test tient le
contrat.

## Les variables à poser

Les chemins d'accès aux données ne sont plus écrits dans le code. Ce dépôt est
public, et il n'a pas à dire où vivent les fichiers du jeu ni avec quoi ils ont
été ouverts.

| Variable | Ce qu'elle désigne |
| --- | --- |
| `DONNEES_JEU` | Le dossier `Content` de l'export courant. La plupart des outils y cherchent `Table/`, `Actor/`, `Cha/PC/`. |
| `DONNEES_JEU_SOURCES` | Le dossier qui **contient plusieurs exports** ; seul `ecrire-magie-rotation.js` s'en sert, pour retenir le plus récent. |
| `LISTE_CHEMINS_JEU` | Le fichier `tous-les-chemins.txt`, index des chemins de l'export ; seul `apparier-animations.js` s'en sert, et s'arrête avec un message s'il manque. |

```powershell
$env:DONNEES_JEU = "<...>/Content"
node outils/fabrication/ecrire-jauges-releve.js
```

Les outils trouvent la racine du dépôt par leur propre emplacement
(`__dirname`), jamais par un chemin écrit : `tests/chemins-personnels.test.js`
refuse tout chemin de dossier utilisateur dans un fichier suivi.

Sans ces variables, les outils lisent une chaîne vide et échouent tout de suite sur un
fichier introuvable. C'est voulu : mieux vaut une erreur nette qu'un chemin
deviné.

## Importer un héros absent du site public

Un héros que 7dsorigin.app ne publie pas — aujourd'hui Khala — se lit dans les
tables du jeu. Deux outils, lancés à la main dans cet ordre :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content exporté')).Path
node outils/fabrication/contenu-jouable.js
python outils/fabrication/importer-assets-jouables.py
```

`Read-Host` demande le dossier à chaque fois : aucun chemin n'est écrit, ni
dans ce fichier, ni dans l'historique du dépôt. Le premier outil écrit
l'instantané normalisé `7ds-stats/contenu-jeu.json` et ignore les deux entrées
internes sans nom ; le second en tire portrait, icônes de compétences et
images d'armures liées, sans jamais écraser un fichier identique. Relancés sur
le même export, ils ne changent aucun octet.

Viennent ensuite, sans réseau, les modes `--client-only` des générateurs de
`scripts/` (voir « Héros lus dans les tables du jeu » dans `AGENTS.md`) : ils
ne remplacent que les héros de l'instantané, prouvent que les autres n'ont pas
bougé, et leur `--check` le vérifie.

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
