# Parité des statistiques de Merlin — plan d'implémentation

> **Objectif :** reproduire les statistiques affichées dans le jeu pour la Merlin
> Foudre fournie par le propriétaire, sans masquer les hypothèses ni casser la
> décomposition reconstructible du moteur.

## Résultat de référence

- ATK : `22 422`
- DEF : `36 355`
- PV : `98 184`
- Détail du jeu :
  - base : ATK `4 813`, DEF `2 950`, PV `9 296`
  - équipement : ATK `10 036`, DEF `21 614`, PV `60 338`
  - taux : ATK `51 %`, DEF `48 %`, PV `41 %`

## Tâche 1 — Conserver le type des nœuds de maîtrise

**Fichiers :**
- Modifier : `tests/test_generate_stats_build.py`
- Modifier : `generate-stats-build.py`
- Régénérer : `stats-build.js`

1. Ajouter un test exigeant `source.nodeType` pour les aptitudes issues d'un nœud.
2. Vérifier que le test échoue.
3. Exporter `nodeType` dans le catalogue généré.
4. Régénérer le catalogue et vérifier les tests Python et le contrat du catalogue.

## Tâche 2 — Ajouter la maîtrise des deux armes de réserve

**Fichiers :**
- Modifier : `tests/stats-build.test.js`
- Modifier : `tests/helpers/load-app.js`
- Modifier : `index.html`

1. Ajouter un test qui prouve la règle :
   - arme active : tous les sous-niveaux et tous les nœuds ;
   - armes de réserve : tous les sous-niveaux et seulement les gros nœuds
     `nodeType:"Special"`.
2. Vérifier que le test échoue.
3. Implémenter des termes séparés et traçables pour chaque arme de réserve.
4. Vérifier les sommes fixes manquantes de Merlin : ATK `1 764`, DEF `1 134`,
   PV `3 024`, plus les taux et statistiques secondaires des gros nœuds.

## Tâche 3 — Corriger l'outrepassement et les multiplicateurs imbriqués

**Fichiers :**
- Modifier : `tests/stats-build.test.js`
- Modifier : `index.html`

1. Tester que l'outrepassement ne multiplie que la statistique principale de
   l'arme, jamais les sous-statistiques/passifs.
2. Tester qu'un multiplicateur peut produire un seau ensuite ciblé par un autre
   multiplicateur.
3. Vérifier les échecs.
4. Donner un seau de sortie au bonus d'outrepassement.
5. Reconstruire les totaux à partir des dépendances de seaux, sans ordre de
   domaine figé.
6. Faire cibler par les taux du héros la statistique native de l'arme et son
   bonus d'outrepassement.

## Tâche 4 — Appliquer les arrondis du jeu

**Fichiers :**
- Modifier : `tests/stats-build.test.js`
- Modifier : `index.html`

1. Tester l'arrondi supérieur de chaque pièce d'équipement.
2. Tester l'arrondi supérieur de chacune des deux contributions d'arme de
   réserve à 30 %.
3. Tester l'arrondi supérieur final de PV/ATK/DEF.
4. Vérifier les échecs.
5. Implémenter des termes d'arrondi explicites afin que les totaux restent
   strictement reconstructibles depuis `terms`.

## Tâche 5 — Régression réelle de Merlin

**Fichiers :**
- Modifier : `tests/stats-build.test.js`
- Modifier : `AGENTS.md`

1. Construire une fixture à partir du JSON Supabase fourni.
2. Vérifier séparément le détail base/équipement/taux.
3. Exiger les trois totaux exacts du jeu.
4. Documenter la maîtrise de réserve, l'outrepassement limité à l'attaque de
   l'arme et les arrondis désormais vérifiés.

## Tâche 6 — Vérification finale

1. Exécuter les tests ciblés après chaque cycle rouge/vert.
2. Exécuter `npm test` sur l'arbre complet.
3. Exécuter `git diff --check`.
4. Faire une revue du diff.
5. Conserver le travail sur `fix/merlin-stats-parity` jusqu'à validation avant
   fusion/push.
