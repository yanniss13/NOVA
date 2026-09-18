# Passation Claude — import jouable de Khala

Date de passation : 2026-09-17  
Branche : `feat/khala-import`  
Worktree à utiliser : `.worktrees/khala-import`  
Dernier commit validé : `e6db1df`

## Où reprendre

Ne pas travailler dans le checkout principal sur `main`. Depuis la racine du
dépôt, entrer dans le worktree :

```powershell
Set-Location '.worktrees/khala-import'
git branch --show-current
git status --short
```

La branche attendue est `feat/khala-import`. Lire, dans cet ordre :

1. `AGENTS.md` en entier ;
2. `docs/superpowers/specs/2026-09-17-import-contenu-khala-design.md` ;
3. `docs/superpowers/plans/2026-09-17-import-contenu-khala.md` ;
4. `.superpowers/sdd/2026-09-17-import-contenu-khala/progress.md` ;
5. `.superpowers/sdd/2026-09-17-import-contenu-khala/task-3-brief.md`.

La spec est l'autorité. Le plan la détaille. Le ledger contient les décisions
prises et les revues déjà effectuées.

## État synthétique

| Tâche | État | Commits / travail |
| --- | --- | --- |
| 1 — extracteur normalisé | Terminée, revue propre | `c049763`, `fa4fb05`, `acd2a9b` |
| 2 — assets WebP | Terminée, revue propre | `3ba7c73`, `e6db1df` |
| 3 — stats, meta, potentiels, builds | Interrompue après le premier cycle TDD | Deux fichiers non suivis, décrits ci-dessous |
| 4 — Wiki, compétences, effets DPS | Non commencée | Brief déjà généré dans le workspace SDD |
| 5 — armures liées, transcendances | Non commencée | Suivre le plan |
| 6 — rotation et chronométrage | Non commencée | Suivre le plan |
| 7 — inventaire et parcours visibles | Non commencée | Suivre le plan |
| 8 — audit final et documentation | Non commencée | Suivre le plan |

## Travail non commité à préserver

`git status --short` doit montrer exactement :

```text
?? scripts/client_content.py
?? tests/test_client_content.py
```

Ces fichiers appartiennent au début de la tâche 3. Ils ne doivent être ni
supprimés ni remplacés sans lecture :

- `scripts/client_content.py` implémente déjà le chargement du snapshot,
  `merge_mapping`, `merge_characters`, la normalisation initiale des maîtrises
  et potentiels, l'empreinte sémantique hors slugs clients et l'écriture
  atomique ;
- `tests/test_client_content.py` contient 11 tests de fusion, collision,
  remplacement ciblé, version, ordre, normalisation et empreinte.

Dernière preuve exécutée avant passation :

```text
python -m unittest tests/test_client_content.py
Ran 11 tests — OK
git diff --check — OK
```

Rien d'autre de la tâche 3 n'a été modifié. En particulier,
`generate-stats.py`, `generate-meta.py`, `generate-potentiels.py`,
`generate-stats-build.py` et leurs sorties ne sont pas encore branchés.

## Données déjà livrées

`7ds-stats/contenu-jeu.json` est le snapshot versionné et validé de Khala :

- identité interne `Calla`, héros `1029`, slug public `khala` ;
- armes `SwordDual`, `Cudgel3c`, `Gauntlets` ;
- dossiers publics `Epees doubles`, `Nunchaku`, `Gantelets` ;
- 18 entrées Wiki, 15 compétences calculateur, 3 × 10 potentiels ;
- trois branches de maîtrise à cinq niveaux ;
- sources d'effets et lignes de buffs résolues ;
- trois armures liées ;
- aucun chemin absolu et aucune clé `local_*` brute.

Deux coefficients JcJ absents des tables valent volontairement `null` avec
couverture `missing-from-export`; aucun nombre historique n'est inventé.

La description FR/EN de `calla_gauntlets_skill_e` est réellement absente de
l'export. La compétence reste présente avec descriptions `null` et motif de
non-couverture. Ne pas traduire la version coréenne et ne pas afficher la clé
interne.

Les assets déjà commitées sont :

- `7ds-personnages/khala.webp` ;
- douze icônes propres `7ds-ui/skills/Calla_*.webp` ;
- trois armures sous `7ds-armures-ssr/Armure liee/Khala — *.webp`.

Le préfixe de chemin `Khala — ` est obligatoire : l'armure officielle
« Préparation totale » partage son nom avec une image de Slader, mais les deux
images sont différentes. Le fichier historique de Slader ne doit jamais être
écrasé. Le nom officiel affiché reste stocké séparément du chemin.

## Prochaine action exacte — tâche 3

Continuer depuis les deux fichiers non suivis et respecter le brief de tâche 3.
Avant d'écrire davantage, vérifier que les formes produites correspondent aux
schémas historiques réels de `7ds-stats/personnages.json`,
`data/personnages-meta.js` et `data/potentiels.js`; les normalisations actuelles
sont un premier jet testé isolément, pas encore une preuve d'intégration.

Puis :

1. brancher `generate-stats.py`, `generate-meta.py` et
   `generate-potentiels.py` avec un mode `--client-only` sans réseau ;
2. rendre le mode idempotent et atomique ;
3. comparer avant/après l'empreinte sémantique des 26 héros existants ;
4. régénérer `7ds-stats/personnages.json`, `data/personnages-meta.js`,
   `data/potentiels.js`, puis `data/stats-build.js` ;
5. exiger 27 héros et les trois armes de Khala dans les tests de catalogues ;
6. exécuter tous les tests ciblés et modes `--check` du brief ;
7. committer la tâche ;
8. faire une revue indépendante du diff avant de commencer la tâche 4.

Ne pas exécuter le mode réseau normal pour cette mise à jour : il pourrait
introduire une dérive non liée sur les 26 héros existants. L'export local est
fourni au processus par `DONNEES_JEU`; demander le chemin à l'opérateur sans le
consigner dans le dépôt :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content exporté')).Path
```

## Décisions et garde-fous à conserver

- Les IDs anonymes `409100119` et `409100124` sont explicitement exclus.
- Une collision de slug en mode historique échoue. Seul `--client-only` peut
  remplacer un slug appartenant déjà au snapshot client.
- Les 26 héros existants ne changent pas sans écart structuré démontré.
- Aucun fichier `data/` n'est édité à la main : modifier son générateur.
- Ne jamais modifier `data/animations-mesurees.json`.
- Aucun cas spécial `if (slug === "khala")` dans les vues.
- Aucune migration Supabase.
- Ne pas ajouter le dossier d'export, le dossier d'outils local ou un chemin personnel à
  Git.
- `requirements-dev.txt` contient maintenant `pglast` et `Pillow`; cette
  dépendance est nécessaire avant `npm test` dans la CI.
- Les fichiers non suivis du checkout principal sous `assets/ambiance/` et
  le dossier d'outils local appartiennent à l'utilisateur et restent hors chantier.

## Vérifications déjà acquises

Avant le développement, `npm test` était entièrement vert :

```text
unit 100/100
e2e 25/25
total 312.2 s
```

Tâche 1 : tests extracteur et revue en deux rounds, propres.  
Tâche 2 : 10 tests importeur, test workflow Pages, validation snapshot,
compilation Python et revue de correction, propres.

Deux remarques mineures sont différées au contrôle final :

- harmoniser la validation de forme de `effectSources` entre fixture et
  production (`texts.{fr,en}` contre `textFr`/`textEn`) ;
- corriger la grammaire du paragraphe `requirements-dev.txt` dans `AGENTS.md`.

## Discipline de reprise

Le chantier utilise `superpowers:subagent-driven-development` : une seule
tâche d'implémentation à la fois, puis revue indépendante, et aucune nouvelle
tâche tant que les findings Critical/Important restent ouverts. Les rapports,
briefs et paquets de revue vivent dans le workspace SDD ignoré par Git.

À la fin des huit tâches, lancer les modes `--check`, les tests ciblés,
`npm test`, une inspection visuelle bureau/mobile, une revue globale, puis le
workflow `superpowers:finishing-a-development-branch`. Ne pas fusionner ni
publier sans accord du propriétaire.
