# Suivi d’avancement — Stats de builds, lot 3A

Dernière mise à jour : 2026-07-29

Branche de travail : `stats-builds-lot3a`

Ce fichier suit l’exécution du plan
`docs/superpowers/plans/2026-07-29-stats-builds-lot3a.md`.
Il ne remplace ni la conception ni le plan détaillé.

## État global

- [x] Tâche 1 — enrichir le catalogue des personnages et des passifs
- [x] Tâche 2 — stocker les niveaux de passif et remplacer les libellés T par P
- [x] Tâche 3 — préserver `passiveLevel` contre les anciennes PWA
- [x] Tâche 4 — calculer base, maîtrise complète et potentiel commun
- [x] Tâche 5 — agréger la borne inférieure des statistiques du héros
- [x] Tâche 6 — terminer l’interface partagée et ses tests d’intégration
- [x] Tâche 7 — mettre à jour la documentation et exécuter la vérification finale

## Travail terminé

### Catalogue

- `stats-build.js` contient maintenant les statistiques de base des 24 personnages.
- La maîtrise complète est cataloguée par type d’arme.
- Le potentiel est catalogué comme un instantané cumulatif par palier P0–P10.
- Les passifs d’armes vont jusqu’au niveau 7.
- Les passifs d’armures et de tenues gravées vont jusqu’au niveau 3.
- Le générateur et ses contrats échouent si ces données deviennent incohérentes.

Commit : `8dda7e4` — `feat: enrichir le catalogue des statistiques héros`

### Modèle persistant et libellés

- `passiveLevel:null|1|2|3` est normalisé dans les configurations d’armures et
  de bijoux.
- Le niveau du passif d’arme reste dérivé de l’outrepassement et n’est pas
  stocké.
- Les anciens objets restent compatibles.
- Les libellés visibles de potentiel utilisent P0–P10 ; la clé interne `tier`
  reste inchangée.

Commit : `db37e65` — `feat: enregistrer les niveaux de passif des équipements`

### Compatibilité des anciennes PWA

- Le garde SQL préserve un `passiveLevel` omis par une ancienne PWA.
- La préservation ne s’applique que si la même pièce reste équipée.
- Une valeur explicitement mise à `null` reste une suppression volontaire.
- La syntaxe PostgreSQL et les mutations du contrat sont testées.

Commit : `24cff2e` — `fix: préserver les niveaux de passif imbriqués`

### Moteur du héros

- La base du personnage est additive.
- Tous les personnages sont considérés à maîtrise complète.
- Le potentiel est commun aux trois armes ; l’arme équipée sélectionne sa
  branche numérique.
- Les termes conservent leur unité, leur opération, leur seau, leur source et
  leur niveau de confiance.
- Seuls `B_Atk_Equip`, `B_Def_Equip` et `B_MaxHp_Equip` sont convertis vers les
  statistiques principales du héros.

Commit : `0bd71f7` — `feat: calculer base maîtrise et potentiel du héros`

### Agrégation finale

- `calculateHeroStats()` exige un personnage, une arme, cinq armures et trois
  bijoux dont toutes les configurations numériques sont valides.
- Aucun faux zéro n’est affiché pour une configuration incomplète.
- La sortie contient `coverage`, `uncovered`, `assumptions`, `missing`,
  `terms`, `totals` et les passifs descriptifs.
- Le mode présumé unique est
  `HERO_MAIN_RATE_APPLICATION_MODE = "all-flat-before-passives"`.
- Les passifs restent exclus des nombres et n’altèrent jamais les totaux.

Commit : `3d6e5d1` — `feat: calculer la borne inférieure des stats héros`

## Interface terminée

Implémenté :

- trois cartes PV / ATK / DEF avec la mention « borne inférieure » ;
- décomposition repliée par défaut ;
- badge indiquant que la base d’application est présumée ;
- section exacte « Passifs non inclus dans le calcul » ;
- sélection du niveau de passif 1–3 dans l’éditeur d’équipement ;
- panneau partagé branché dans le roster propriétaire, le Team Builder et
  `heroDetail()`, donc aussi dans les détails d’équipe, les rosters consultés et
  les archives de boss ;
- une fiche partielle refuse tout faux total ;
- une équipe entièrement configurée affiche et décompose sa borne inférieure ;
- les trois cartes principales s’empilent sous 560 px ;
- le dernier exemple visible « burst T2 » est devenu « burst P2 ».

Commit : `254f900` — `feat: afficher les statistiques finales par héros`

Deux défauts réels ont été trouvés et couverts pendant l’intégration :

- la canonisation `B_Atk_Equip → B_Atk` remplaçait à tort l’unité du
  multiplicateur d’outrepassement par `flat` ;
- le nouveau rendu omettait « base présumée » sur ce multiplicateur, alors que
  seul son taux est exact.

## Vérifications déjà obtenues

- 32 tests Python du générateur : verts
- contrat du catalogue réel : vert
- génération `python generate-stats-build.py --check` : verte
- syntaxe et contrats SQL : verts
- moteur et reconstruction des termes : verts
- `tests/stats-build.test.js` : vert
- `tests/potentiel-commun.playwright.js` : vert
- `tests/supabase-etape1.playwright.js` : vert
- `tests/accessibilite-mobile.playwright.js` : vert
- `tests/scrollbars-invisibles.playwright.js` : vert
- `python generate-stats-build.py --check` : `stats-build.js à jour`
- `git diff --check` : aucune erreur
- `npm test` complet : code de retour 0, toutes les suites vertes (86,4 s)

## Mise en service restante

Le code est prêt sur `stats-builds-lot3a`, mais il n'est ni fusionné ni poussé.
Avant la publication :

1. rejouer `supabase/schema.sql` dans le SQL Editor ;
2. fusionner la branche seulement après validation du propriétaire ;
3. pousser `main` et attendre GitHub Pages vert ;
4. accepter la mise à jour PWA ;
5. comparer le `BUILD_VERSION` servi au SHA publié.

## Dernière erreur résolue

Une fiche qui ne possède que son arme affiche maintenant
« Statistiques du héros — configuration à compléter », sans total. Une fixture
distincte, entièrement équipée et configurée, vérifie le rendu chiffré final
dans le détail d’équipe.

## Retour arrière

Les étapes fonctionnelles sont séparées en commits. Tant que la branche n’est
pas fusionnée, `main` reste intact. Après fusion, un retour arrière peut cibler
les commits du lot 3A individuellement. Les gardes SQL peuvent rester installés :
ils sont compatibles avec les anciennes données et n’ajoutent aucune table.
