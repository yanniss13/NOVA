# Rapport — tâche 6 : aiguillage arme/pièce

## TDD

Le test comportemental `tests/import-captures-routage.test.js` a été ajouté
avant le code de production. Son premier lancement a échoué comme attendu :
la Baguette était envoyée à `deduirePiece`, donc la ligne sortait en `echec`
au lieu de `unique`. Après l'aiguillage sur `entete.niveau`, le même test est
vert. Il couvre aussi une Ceinture existante pour la non-régression pièce.

## Changements

- `js/vues/import-captures.js` : troisième passe OCR sur l'en-tête,
  luminance carte `>= 80`, lecture de l'en-tête et du passif, aiguillage
  exclusif par `Lv.`, affichage propre arme/pièce, validation par le juge de
  configuration correspondant, et attente du catalogue chiffré avant la
  déduction.
- `js/metier/ocr-panneau.js` : exports nominaux des lecteurs d'en-tête.
- `js/metier/ocr-arme.js` : export nominal de `deduireArme`.
- `tests/helpers/load-app.js` et le nouveau test : seam de lecture interne,
  uniquement pour tester le routage réel.

L'arme conserve le contrat `{version:1, gradeGameId, level, promotion,
overlimit, enchantments}` et est sortie sous la clé `Arme`. Les conflits
restent indexés par `slot`. Aucun changement d'écriture du roster ni de
fixtures réelles d'arme n'a été fait.

## Vérifications

Verts :

- `node tests/import-captures-routage.test.js`
- `node tests/ocr-arme.test.js`
- `node tests/ocr-panneau.test.js`
- `node tests/modules-imports.test.js`
- `node tests/pwa.test.js`
- `git diff --check`

`node tests/import-captures.playwright.js` est vert. Le premier échec a été
diagnostiqué : sur une première visite, l'import pouvait déduire avant que
`data/stats-build.js`, chargé à la demande par l'application, ait fini son
hydratation. Les mêmes statistiques OCR étaient alors bien lues mais le
catalogue vide donnait `deduirePiece(...).statut === "aucun"`. La vue attend
désormais `ensureBuildStats()` avant toute lecture réelle ; le faux lecteur du
test de routage reste volontairement indépendant de ce chargement navigateur.

## Commit

Code de la tâche : `6445941ffb0588be0673dcbcb2b6029a86b9c27a`
(`OCR : aiguiller armes et pièces`).

## Préoccupations

Le catalogue doit rester attendu avant toute déduction réelle : l'OCR peut être
plus rapide qu'une première injection de `stats-build.js`.
