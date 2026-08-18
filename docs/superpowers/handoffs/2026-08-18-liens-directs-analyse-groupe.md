# Passation — liens directs et analyse de groupe

**Date :** 18 août 2026

**Branche distante :** `feature/liens-directs-analyse-groupe`

**Worktree local :** `.worktrees/liens-directs-analyse-groupe`

**Spec :** `docs/superpowers/specs/2026-08-17-liens-directs-analyse-groupe-design.md`

**Plan :** `docs/superpowers/plans/2026-08-17-liens-directs-analyse-groupe.md`

## État Git

La branche part de `a8f5e71` et contient déjà ce commit fonctionnel :

```text
d766d62 feat(routage): ajouter les liens directs des groupes
```

Ce commit couvre :

- le contrat pur des fragments dans `js/metier/routage.js` ;
- l’historique Précédent/Suivant et les routes stables ;
- la reprise d’une route protégée après connexion ;
- le repli Wiki à la déconnexion sans rejouer la route au login suivant ;
- les actions « Analyser ce groupe » et « Copier le lien » sur les groupes ouverts ;
- le ciblage, le défilement et le focus de `#boss/groupe/<id>` ;
- le repli `window.prompt("Copie ce lien", url)` si le presse-papiers échoue ;
- les tests unitaires et Playwright correspondants.

Les changements Analyse décrits ci-dessous sont présents dans le commit de
passation qui accompagne ce document.

## Analyse de groupe implémentée

Fichiers concernés :

- `js/donnees/boss-store.js` : `BossStore.sessionById(sessionId)` ;
- `js/vues/analyse.js` : gestionnaire de route, contexte de groupe et filtrage ;
- `css/analyse.css` : bandeau responsive ;
- `tests/routage-groupe.playwright.js` : scénarios d’intégration.

Comportement présent :

- `#analyse/groupe/<id>` relit la session et ses participations à chaque ouverture ;
- un groupe absent ou archivé affiche un état explicite ;
- une erreur de lecture des participations propose « Réessayer » ;
- un groupe vide ne retombe jamais silencieusement sur toute la confrérie ;
- le bandeau compte les participants et ceux sans roster exploitable ;
- une erreur de lecture des rosters affiche « Données de roster indisponibles » ;
- résumé, couverture, matrice, affaiblissements et soutiens utilisent tous le
  même sous-ensemble de membres ;
- le filtre manuel reste limité à la matrice ;
- « Toute la confrérie » efface le contexte et ouvre `#analyse` ;
- la sous-vue DPS est sélectionnée à l’ouverture d’un groupe.

## Vérifications déjà obtenues

Avant toute modification, `npm test` a réussi entièrement dans le worktree
(sortie 0, environ 161 secondes).

Après le commit `d766d62`, les commandes suivantes ont réussi :

```powershell
node tests/routage.test.js
node tests/modules-imports.test.js
node tests/pwa.test.js
node tests/routage-groupe.playwright.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Après l’ajout de l’Analyse de groupe, les commandes suivantes ont réussi :

```powershell
node tests/routage-groupe.playwright.js
node tests/modules-imports.test.js
node tests/analyse-recensements.playwright.js
node tests/analyse-elements.test.js
node tests/recensement-supports.test.js
node tests/accessibilite-mobile.playwright.js
```

Après l’ajout des assertions finales (clipboard de secours, fragments invalides,
320/390 px et Précédent/Suivant), cette commande a également réussi dans son
intégralité :

```powershell
node tests/routage-groupe.playwright.js
```

## Travail restant avant fusion sur `main`

1. Faire la mutation contrôlée du clipboard : casser temporairement l’appel à
   `window.prompt`, constater que le test échoue, restaurer le code, puis
   constater qu’il repasse.
2. Lancer :

   ```powershell
   node tests/modules-imports.test.js
   node tests/pwa.test.js
   git diff --check
   npm test
   ```

3. Vérifier visuellement les cartes Boss et le bandeau Analyse à 320 et 390 px.
4. Fusionner seulement après toutes les sorties vertes ; aucun SQL Supabase
   n’est requis pour cette fonctionnalité.

## Reprise sur un autre poste

```powershell
git fetch origin
git switch --track origin/feature/liens-directs-analyse-groupe
npm install
node tests/routage-groupe.playwright.js
npm test
```

Ne pas repartir de `main` et ne pas recopier les fichiers manuellement : la
branche distante contient le code, les tests, la spec, le plan et cette passation.
