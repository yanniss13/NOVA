# Plan — Import de captures : armes et enchantements

**Spec :** `docs/superpowers/specs/2026-08-23-import-captures-armes-enchantements-design.md`

**But :** une capture d'arme remplit l'arme du roster ; une capture de pièce
gravée remplit aussi ses enchantements.

## Contraintes globales

- Modules ES, une seule ligne `export {}` en fin de fichier.
- **Tout symbole exporté doit être importé quelque part**, sinon
  `tests/modules-imports.test.js` échoue. Un module ne reçoit sa ligne
  `export` qu'au moment où son consommateur existe.
- **Tout module de `js/` doit figurer dans `CORE_ASSETS` de `sw.js`** et dans
  `tests/helpers/modules.js`, dans sa couche.
- Avant de nommer une fonction ou une constante, vérifier qu'elle n'existe pas
  déjà : le chargeur `vm` concatène tous les modules dans une portée unique.
  `grep -rn "function <nom>\|const <nom>" js/`
- `metier/` n'a droit ni au DOM ni au réseau.
- Fins de ligne CRLF. Commentaires en français, sur le *pourquoi*.
- `plain()` pour comparer un objet venu du `vm` avec `deepStrictEqual`.

## Tâche 1 — Extraire le socle de libellés

**Fichiers :** créer `js/metier/ocr-libelles.js` ; modifier
`js/metier/ocr-deduction.js`, `tests/helpers/modules.js`, `sw.js`.

Déplacer sans les changer : `normaliserLibelle`, `distance`,
`uniteDeLaValeur`, `candidatsDuCatalogue`, `recalerLibelle`,
`valeurNumerique`, `TOLERANCE`, `MARGE_MINIMALE`.

**Produit :** `recalerLibelle(texte, valeurBrute, codesAutorises)` →
`{statut:"exact"|"rattrape"|"ambigu"|"rejete", code, rival}` ;
`valeurNumerique(brut)` → nombre entier ou `null` ;
`normaliserLibelle(texte)` → chaîne.

Refactorisation pure : `tests/ocr-deduction.test.js` et
`tests/ocr-deduction-piece.test.js` doivent passer sans être touchés.

## Tâche 2 — L'en-tête du panneau

**Fichiers :** `js/metier/ocr-panneau.js`, `tests/ocr-panneau.test.js`.

- `detecterEntete(image, zone)` → rectangle au-dessus de `zone`, borné par la
  première ligne dont la luminance moyenne dans la colonne du panneau retombe
  sous le fond. Mesuré : fond à 22-40, carte à 103-107. Seuil à 80.
- `lireEntete(mots)` → `{nom, type, niveau}`. `niveau` vient de
  `/Lv\.\s*(\d+)/` ; `type` est le texte qui précède sur cette ligne ; `nom`
  est la ligne la plus longue au-dessus.
- `niveauDePassif(texte)` → `/Niv\.\s*(\d+)/` ou `null`.
- `extraireStats` gagne un champ `section` par ligne : `null` avant tout titre,
  sinon le titre normalisé du dernier vu.
- Un fragment de libellé doit contenir un mot d'au moins 4 lettres.

## Tâche 3 — Les enchantements

**Fichiers :** créer `js/metier/ocr-enchantements.js`, `tests/ocr-enchantements.test.js`.

- `enchantementsDePiece(definition, lignes)` → tableau de longueur
  `randomOptions.slots`, chaque entrée `{slot, stat, value}` ou `null`.
- `enchantementsDArme(grade, lignes, elementParDefaut)` →
  `{choix, elementSuppose}`. Basique : `{slot, stat, value}` avec bornes
  redressées par `enchantmentBounds`. Perle : palier déduit du nombre de
  lignes croisé aux bornes, élément déduit des stats élémentaires, sinon
  `elementParDefaut` et `elementSuppose:true`.

Vérité terrain : Sanglier de la Gourmandise (3 lignes, gravure) ; Baguette des
ailes de la flamme noire (4 lignes, palier 5 foudre, unique) ; Rapière de
l'âme vorace (3 lignes, palier 5, élément indéterminé).

## Tâche 4 — Les enchantements dans la déduction de pièce

**Fichiers :** `js/metier/ocr-deduction.js`, `tests/ocr-deduction-piece.test.js`.

Les lignes de `section === null` servent à l'inversion ; celles d'une section
d'enchantement alimentent `enchantementsDePiece`. Le candidat porte désormais
ses enchantements au lieu d'un tableau de `null`.

## Tâche 5 — La déduction d'arme

**Fichiers :** créer `js/metier/ocr-arme.js`, `tests/ocr-arme.test.js`.

`deduireArme({nom, niveau, passif, stats, herosSlug})` →
`{statut:"unique"|"ambigu"|"aucun", candidats:[{fichier, slot:"Arme",
gradeGameId, level, promotion, overlimit, enchantments, elementSuppose}]}`.

Le nom se recale sur les 155 armes, restreint aux types compatibles du héros
quand `herosSlug` est connu. La configuration nue est
`[null]` pour une perle, un `null` par emplacement pour un basique.

## Tâche 6 — L'aiguillage dans la vue

**Fichiers :** `js/vues/import-captures.js`, `css/import-captures.css`.

Troisième passe d'OCR sur l'en-tête. `Lv.<nombre>` présent → arme, sinon
pièce. Le récapitulatif affiche le nombre d'enchantements remplis et signale
un élément supposé.

## Tâche 7 — L'écriture de l'arme

**Fichiers :** `js/vues/roster-membres.js`.

Le brouillon de roster range un build **par type d'arme**. Une arme importée
impose donc son type : basculer `memberRosterWeaponType` avant d'écrire, pour
que l'arme et les armures d'une même série de captures atterrissent dans le
même build.

## Tâche 8 — Le test de bout en bout

**Fichiers :** `tests/import-captures.playwright.js`, fixtures
`tests/fixtures/ocr/pc-arme-baguette.png`, `ultrawide-arme-rapiere.png`.

Trois résolutions, trois rapports d'image, aucun réglage.

## Tâche 9 — La documentation

`docs/` : ce que l'import remplit désormais, et ce qu'il laisse au membre.
