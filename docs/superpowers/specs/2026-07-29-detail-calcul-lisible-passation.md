# Passation — détail du calcul lisible (et suite du chantier)

**Date :** 2026-07-29
**Pour :** l'agent qui reprend (Codex).
**Raison :** quota épuisé en cours d'exécution. Rien n'est cassé, rien n'est
poussé, `main` est intact.

Vérifie l'état réel avant de supposer quoi que ce soit :

```bash
git -C "C:/Users/yanni/Desktop/Site Confrérie 7ds" log --oneline -3
git -C "C:/Users/yanni/Desktop/Site Confrérie 7ds" worktree list
```

---

## 1. Où est le travail

| Quoi | Où |
| --- | --- |
| Worktree de travail | `.claude/worktrees/detail-calcul-lisible` |
| Branche | `worktree-detail-calcul-lisible` |
| `main` local | `11ca999` — **en avance sur `origin/main` (`4be3fae`)** |
| Spec | `docs/superpowers/specs/2026-07-29-detail-calcul-lisible-design.md` |
| Plan | `docs/superpowers/plans/2026-07-29-detail-calcul-lisible.md` |
| Ledger + briefs + rapports | `.superpowers/sdd/2026-07-29-detail-calcul-lisible/` |

**Trois commits de documentation ne sont pas poussés** : `787613e`, `93ebda4`,
`6a7db16`, `bd8b365`, `7775ebf`, `11ca999`. Ils sont sur `main` local uniquement.
La branche de travail les contient (elle a été fast-forwardée depuis `main`).

Le worktree part d'`origin/main` par défaut : si tu en recrées un, refais
`git merge main --ff-only` dedans, sinon la spec et le plan sont absents.

## 2. État d'avancement

Le plan a **5 tâches**. Exécution en subagent-driven-development.

| Tâche | Commit | Revue |
| --- | --- | --- |
| — correctif pré-vol du plan | `2357a24` | — |
| 1 — libellés d'origine | `ba0fab9` | ✅ approuvée |
| 2 — regroupement pur (clé sextuplet) | `8d28038` + `958d49e` | ✅ approuvée après 1 round |
| 3 — rendu commun + fiche du héros | `0c522b7` | ⚠️ **NON RELUE** |
| 4 — panneaux arme et équipement | — | à faire |
| 5 — régression Merlin + 320/390 px | — | à faire |
| Revue finale de branche | — | à faire |

**Le point de reprise exact : relire la tâche 3.** Son implémenteur a rapporté
DONE, `npm test` complet vert, et les deux suites Playwright vertes **sans avoir
été modifiées** — c'est l'invariant du lot. Mais aucune revue par tâche n'a
encore été faite sur ce commit.

Le ledger `progress.md` fait foi. Une tâche avec une ligne
`Task <N>: complete` est terminée : ne la rejoue pas.

## 3. Comment reprendre

Les briefs sont **déjà extraits** dans le workspace (`task-1-brief.md` à
`task-5-brief.md`). Ne relance pas `scripts/task-brief` : il cherche des titres
anglais `Task N` et le plan est en français (`### Tâche N`). Le script
`scripts/review-package PLAN BASE HEAD` fonctionne, lui.

Ordre :

1. `bash .../scripts/review-package <plan> 958d49e HEAD` puis dispatcher une
   revue de tâche sur le diff de la tâche 3.
2. Traiter les findings (round de correction, re-revue ciblée).
3. Tâches 4 puis 5, même boucle.
4. Revue finale de branche sur le diff complet depuis `4be3fae`.
5. Fusion dans `main` **après validation du propriétaire**, puis push.

## 4. Pièges déjà payés — ne les repaie pas

**Les snippets de code du plan portent des bugs latents.** Trois ont été
attrapés par les implémenteurs, aucun n'était visible à la relecture :

1. `formatBuildStatValue` au lieu de `formatHeroStatTotal` dans la branche
   arme secondaire de `heroTermLabel` — aurait ajouté un préfixe `+` parasite.
2. Le séparateur de clé écrit comme **octet de contrôle littéral** au lieu de
   la séquence d'échappement `"\u0001"`.
3. Un `deepStrictEqual` sur un tableau venant du bac à sable `vm` sans
   `plain()` — échec cross-realm garanti.

**Avertis chaque implémenteur de vérifier les snippets contre le corps réel des
fonctions.** C'est ce qui a sauvé les trois.

Autres contraintes, toutes dans les briefs :

- `index.html` a des fins de ligne **mixtes** (CRLF et LF) : ne jamais présumer
  le séparateur d'une ancre multi-ligne, ne jamais normaliser le fichier.
- Les numéros de ligne du plan valent pour `11ca999` et se sont **déjà**
  décalés. Ancrer par nom de fonction.
- Toute fonction pure à tester doit être ajoutée à `HOOK_EXPORT`
  (`tests/helpers/load-app.js`).
- `tests/potentiel-commun.playwright.js` et `tests/supabase-etape1.playwright.js`
  **ne doivent pas être réécrits**. Ils prouvent que le refactor n'a rien changé.
  `assertVisibleText` compare le texte **exactement**.

## 5. Minors reportés (à trier à la revue finale)

- `statTermGroups` n'a pas de repli pour `settings.termLabel` alors que
  `termEmphasis` en a un. Tous les appelants le fournissent.
- Aucun test ne couvre deux termes `multiply` de même clé sommant leur `value` ;
  seul le cas additif est couvert.
- Le test du repli « Autre » a migré de la tâche 3 vers la tâche 2 ;
  `task-3-brief.md` a été mis à jour pour ne pas le dupliquer.

## 6. Le chantier suivant, déjà cadré mais pas spécifié

Le propriétaire a demandé une **estimation des dégâts**. Le cadrage est fait,
la conception s'est arrêtée avant d'être écrite. Décisions prises, ce sont des
décisions et non des préférences à re-litiger :

1. Usage : comparer deux builds du même perso, classer les membres pour le boss,
   comparer des persos, et des dégâts chiffrés.
2. **Saisie manuelle des 4 multiplicateurs de compétence par personnage**
   (~96 valeurs). Les données de compétence n'existent nulle part : le payload
   RSC de 7dsorigin lu par `generate-stats.py` ne les contient pas, et leur
   `robots.txt` interdit `/api/`.
3. Passifs : **deux bornes**, basse (sans passifs) et haute (passifs supposés
   actifs à leur cumul max).
4. Table des passifs : **complète d'un coup** (10 équipements spéciaux et
   83 tenues gravées × 3 niveaux).
5. Modèle retenu : **approche A** — indice par compétence contre une cible sans
   défense. `dégâts(s) = ATK effective × multiplicateur(s) × (1 + I_All_DamAdd_Rate
   + modificateur du type de s) × (1 + <élément>_Element_Rate) × espérance de crit`.

Correspondance vérifiée entre types de compétence et codes de stat :
`Normalattack_Damadd_Rate`, `Normalskill_Damadd_Rate`, `Activethird_Damadd_Rate`,
`Ultimateskill_Damadd_Rate`, `Normalskillchangetag_Damadd_Rate`.

Trois hypothèses à isoler chacune dans une constante unique, sur le modèle des
`*_APPLICATION_MODE` existants : `ELEMENTAL_ATTACK_APPLICATION_MODE`,
`CRIT_DAMAGE_BASE_MODE`, `CRIT_EXPECTANCY_MODE`.

**Question restée sans réponse :** le jeu affiche 4 compétences ; les codes en
listent 5. Laquelle n'existe pas, ou la compétence de relève est-elle une 5ᵉ à
part ? À poser au propriétaire avant de spécifier.

**Avertissement transmis au propriétaire et maintenu par lui :** la table
complète des passifs plus les 96 multiplicateurs, c'est plusieurs jours de
saisie avant que le moindre membre voie un chiffre — le schéma qui lui a déjà
fait lâcher un chantier. Il faut un découpage où le premier lot affiche déjà
des dégâts.

## 7. Autre sujet ouvert

Le propriétaire veut construire automatiquement les rosters des membres depuis
leurs captures d'écran. Deux obstacles chiffrés :

- **~9 captures par build** (une par pièce), pas une seule.
- **Les RLS interdisent d'écrire le roster d'autrui** :
  `supabase/schema.sql:328-330`, `owner = auth.uid()`. Ne pas y toucher.
  Voie recommandée : le propriétaire colle des `insert ... on conflict` dans le
  SQL Editor Supabase, qui passe outre les RLS. Aucune fonctionnalité à écrire.

Il a été convenu de commencer par **un seul build** pour mesurer le taux
d'erreur réel avant de lancer la confrérie là-dessus.

## 8. Rappels du dépôt

- **Ne pousse rien sans autorisation explicite** du propriétaire.
- Après déploiement, vérifier que le `BUILD_VERSION` du `sw.js` servi
  correspond au SHA poussé.
- Terminer par `npm test`, `git diff --check`, `git status --short`.
