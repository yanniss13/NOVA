# Ancien site publié et refonte en cours

À la demande du propriétaire, le 8 septembre 2026 :

- `main` publie l'interface de `ancien-site` (`e979ded`, avant refonte).
- `refonte-en-cours` conserve toute la nouvelle interface au commit `1b36fac`,
  puis les 23 fichiers locaux (bannières, aperçus et documents) sauvegardés dans
  `d17fe72`. Cette branche est également sauvegardée sur GitHub.
- `ancien-site` reste le repère historique, sans déplacement.

Le retour est un nouveau commit sur `main` : aucun historique n'est réécrit.
Le schéma Supabase, ses fonctions, ses données et les workflows de publication
ne sont pas modifiés. Seule `main` peut publier GitHub Pages.

Les correctifs indépendants de la refonte sont conservés sur `main` : protection
des pièces équipées dans Collection (`b78de24`), réseau prioritaire pour le cache
local sans version injectée, et comparaison des exports usmap (`1b36fac`).
La suite de tests de l'ancienne interface est restaurée avec elle.

## Continuer la refonte

Depuis un répertoire de travail sans modifications en attente :

```powershell
git switch refonte-en-cours
python -m http.server
```

Les bannières sont dans `output/bannieres-2026-09-08/` sur cette branche.
Les worktrees préexistants restent indépendants et n'ont pas été modifiés.

## Republier la refonte plus tard

Le retour arrière étant déjà dans l'historique de `main`, une simple fusion
de `refonte-en-cours` ne rétablira pas les changements précédemment annulés.
Préparer une branche d'intégration depuis `main`, annuler le commit de retour
à l'ancien site, puis fusionner les nouveaux travaux de `refonte-en-cours`.
Conserver les correctifs ajoutés entre-temps, résoudre les conflits et lancer
`npm test` avant de publier la version validée par le propriétaire.

Après chaque publication, les membres ayant une PWA ou un onglet déjà ouvert
doivent accepter « Mettre à jour » pour activer la version publiée.
