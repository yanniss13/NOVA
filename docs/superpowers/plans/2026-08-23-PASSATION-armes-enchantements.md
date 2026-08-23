# Passation — Import de captures : armes et enchantements

**Écrite le 2026-08-23.** Branche `worktree-ocr-stats-screens`, worktree
`.claude/worktrees/ocr-stats-screens`.

> **Ne fais pas confiance à ce document sur l'avancement.** Vérifie dans git :
> `git log --oneline -8`. Les tâches 1 à 4 sont commitées, les tâches 5 à 9 ne
> le sont pas. Si le log dit autre chose, le log a raison.

**Spec :** `docs/superpowers/specs/2026-08-23-import-captures-armes-enchantements-design.md`
**Plan :** `docs/superpowers/plans/2026-08-23-import-captures-armes-enchantements.md`

Lis la spec avant de coder : elle contient les mesures qui justifient chaque
décision, et sans elles tu vas refaire les mêmes erreurs.

---

## Où on en est

| tâche | état |
|---|---|
| 1. `ocr-libelles.js` — socle partagé extrait | **fait, testé** |
| 2. `ocr-panneau.js` — en-tête, sections, débris de bordure | **fait, testé** |
| 3. `ocr-enchantements.js` — enchantements gravées + armes | **fait, testé** |
| 4. `ocr-deduction.js` — les gravées portent leurs enchantements | **fait, testé** |
| 5. `ocr-arme.js` — la déduction d'arme | **à faire** |
| 6. `import-captures.js` — passe d'en-tête, aiguillage | **à faire** |
| 7. `roster-membres.js` — écriture de l'arme | **à faire** |
| 8. test de bout en bout + fixtures | **à faire** |
| 9. documentation | **à faire** |

Suite unitaire au vert au moment de la passation. Les parcours Playwright
n'ont **pas** été relancés depuis la tâche 1 : lance-les avant de continuer
(`node scripts/lancer-tests.js e2e`).

---

## Les mesures. Ne les refais pas, ne les contredis pas sans mesurer.

Toutes sont reproductibles par les sondes laissées dans `probe-ocr/`
(non versionné, jetable).

**154 armes sur 155 s'inversent.** La 155e est l'`Épée longue usée`, dont les
courbes sont nulles dans `data/stats-build.js`.

> ⚠️ Une première mesure disait 60 armes sur 155. Elle était fausse : la sonde
> passait `enchantments: []` alors qu'une arme à perle en attend `[null]`.
> **Si un jour tu vois un dénominateur s'effondrer, cherche le bug dans ta
> sonde avant de conclure.** C'est exactement l'erreur qui a fait sortir les
> armes du périmètre pendant une journée entière.

**Ce qu'il faut connaître pour trancher**, sur 115 790 configurations valides :

| connu | déduction unique |
|---|---|
| les valeurs seules | 11,13 % |
| \+ le nom de l'arme | 98,00 % |
| \+ le `Lv.XX` | 99,47 % |
| \+ le `Niv. N` du passif | 99,96 % |

Le nom **doit** être lu. Il vit dans l'en-tête, que `detecterPanneau`
laissait dehors — d'où `detecterEntete`, déjà écrit.

**Le filet :** 99,32 % des valeurs mal lues d'un chiffre ne correspondent à
aucune configuration (2 640 411 cas simulés).

**Le discriminant arme/armure :** une armure n'affiche jamais `Lv.` — elle
affiche `+5` et `+159`. Vérifié sur les huit captures de `image-ocr/`.

---

## Tâche 5 — `js/metier/ocr-arme.js`

Le morceau qui reste le plus technique. Tout ce dont il a besoin existe déjà.

### Signature

```js
deduireArme({ nom, niveau, passif, stats, herosSlug })
// -> { statut:"unique"|"ambigu"|"aucun", candidats:[{
//      fichier, slot:"Arme", gradeGameId, level, promotion, overlimit,
//      enchantments, elementSuppose }] }
```

- `nom`, `niveau` viennent de `lireEntete(mots)` (déjà écrit).
- `passif` vient de `niveauDePassif(texteBrut)` (déjà écrit) ; l'overlimit
  vaut `passif - 1`. Facultatif : `null` si illisible.
- `stats` : les lignes de `extraireStats` **dont `section` est `null`**.
  Celles qui portent une section sont les enchantements.

### La méthode

1. **Recaler le nom** sur les 155 armes. `ocr-libelles.js` expose déjà
   `rapprocher(cible, liste)` pour ça — c'est le moteur de `recalerLibelle`
   sorti de son contexte « statistiques ». Construis
   `[{ code:fichier, cle:normaliserLibelle(nomDuFichier) }]`.
   **Il faut rendre `normaliserLibelle` et `rapprocher` exportés** (aujourd'hui
   ils ne le sont pas, faute de consommateur — voir le commentaire en bas de
   `ocr-libelles.js`).
   Quand `herosSlug` est connu, restreins aux types compatibles :
   `weaponTypesOf(charId)` dans `js/metier/armes.js`.

2. **Énumérer** `(gradeGameId, promotion, level, overlimit)` avec une
   configuration nue, et garder celles dont les totaux reproduisent les
   valeurs lues. Exactement la structure de `configsDePiece` dans
   `ocr-deduction.js` — lis-la, elle est le modèle.

   La configuration nue **doit** être :
   ```js
   enchantments: grade.enchantments.type === "masterstone"
     ? [null]
     : (grade.enchantments.slots || []).map(() => null)
   ```
   `nueDArme` fait déjà ça dans `ocr-enchantements.js`, mais n'est pas exporté.

   Bornes : `promotion` de 0 à `grade.promotionSteps.length` ;
   `level` de 0 à `weaponLevelCap(grade, promotion)` (rends la main si < 0) ;
   `overlimit` parmi `grade.overlimit.levels[].level`, sinon `[0]`.

3. **Comparer** avec `calculateWeaponStats(fichier, config).totals`, qui rend
   `[{stat, unit, value}]`. Ne compare pas les `terms` : l'attaque en compte
   plusieurs (niveau, promotion, puis un facteur de dépassement).
   Vérité terrain : `Baguette des ailes de la flamme noire`,
   `gradeGameId 131065005`, `level 50`, `promotion 4`, `overlimit 6`
   → `B_Atk_Equip = 4731`, `C_Critical_Dam_Rate = 4882`. Ce sont les deux
   nombres lisibles sur `image-ocr/image-ocr-mobile/IMG_3947.PNG`.

4. **Les enchantements** : appeler `enchantementsDArme(grade, lignes, statsNatives)`
   où `statsNatives` sont les codes des stats natives de l'arme
   (`weapon.mainStatCode` et `grade.subStats[].stat`). Il faut l'exporter.
   Il rend `{ choix, tier, element, suppose }` — reporte `suppose` dans le
   candidat sous `elementSuppose`.

5. **Le dernier verrou** : ne rends un candidat que si
   `weaponConfigStatus(fichier, config) === "valid"`.

### Le piège du nom d'emplacement

`slot:"Arme"` est une **chaîne d'affichage**, pas une clé de rangement comme
pour les armures. L'arme ne vit pas dans `build.armor[slot]` mais directement
dans `build.weapon` / `build.weaponConfig`. Ne la fais pas passer par
`applyGearChange`.

---

## Tâche 6 — `js/vues/import-captures.js`

1. Après `detecterPanneau`, appeler `detecterEntete(image, zone)`. Le contrat
   demande `image.estCarte(x, y)` — un prédicat de luminance **≥ 80**, à
   fabriquer dans `luminanceDe` à côté du `> 195` existant. Mesuré : le fond
   du jeu est à 20-40, la carte ne descend pas sous 92.
2. Une passe d'OCR supplémentaire sur ce rectangle → `lireEntete(mots)`.
3. `entete.niveau !== null` → **arme** (`deduireArme`), sinon **pièce**
   (`deduirePiece`). Ne bricole pas d'autre heuristique : celle-ci est
   vérifiée sur les huit captures.
4. Le récapitulatif : afficher le nombre d'enchantements remplis, et signaler
   « élément supposé » quand `elementSuppose` est vrai. La modale existe déjà,
   son CSS est dans `css/import-captures.css`.
5. `enregistrer()` doit passer une arme par `weaponConfigStatus` et une pièce
   par `gearConfigStatus`, comme aujourd'hui.

---

## Tâche 7 — `js/vues/roster-membres.js`

`appliquerImportCaptures` (ligne ~505) ne connaît que des emplacements
d'armure. Pour une arme :

```js
memberRosterWeaponType = weaponFolderOf(fichier);   // AVANT tout le reste
const build = currentMemberRosterBuild();
build.weapon = fichier;
build.weaponConfig = config;
```

**L'ordre compte.** Le brouillon de roster range un build **par type d'arme** :
`memberRosterDraft.builds[type]`. Si tu écris les armures d'abord et l'arme
ensuite, les armures atterrissent dans le build de l'onglet courant et l'arme
dans un autre. Elles viennent de la même série de captures, elles doivent
finir ensemble.

Vérifie aussi que le type est compatible avec le personnage
(`weaponTypesOf(charId)`), sinon n'écris rien pour cette ligne.

---

## Tâche 8 — Le test de bout en bout

`tests/import-captures.playwright.js` existe et pilote la vraie interface avec
de vraies captures. Ajoute deux fixtures d'arme, recadrées **en gardant le
fond sombre** (la détection du panneau en dépend) et **en gardant l'en-tête**,
sinon le nom n'est plus lisible et rien ne marche :

| fixture | source | attendu |
|---|---|---|
| `pc-arme-baguette.png` | `image-ocr/image-ocr-pc/image copy.png` (1920×1080) | Baguette des ailes de la flamme noire, Lv.50, palier 5 foudre |
| `ultrawide-arme-rapiere.png` | `image-ocr/image-ocr-pc/image copy 3.png` (3440×1440) | Rapière de l'âme vorace, Lv.50, palier 5, élément supposé |

`image-ocr/image-ocr-mobile/IMG_3947.PNG` (2796×1290) est la même baguette sur
mobile — utile pour vérifier que rien n'est calé sur une résolution.

---

## Ce que tu ne dois PAS faire

- **Ne recale jamais un libellé contre une liste restreinte.** Mesure à
  l'appui : « Augmentation des dégâts de Foudre » se recalait sur
  « Augmentation des dégâts physiques » quand on lui retirait ses vrais
  voisins, et le groupe élémentaire faux ressortait comme explication valable.
  Identifie la statistique contre le catalogue **entier**, puis demande si la
  pièce peut la porter. Le commentaire de `choixDeLaLigne` le dit aussi.
- **N'ajoute pas `vendor/tesseract` à `CORE_ASSETS`.** Cinq mégaoctets pour
  chaque membre. `tests/vendor-tesseract.test.js` échoue si tu le fais.
- **N'invente pas de valeur.** Une ligne illisible laisse son emplacement
  vide ; une valeur hors bornes est refusée, jamais arrondie. C'est la seule
  propriété qui rend l'import sûr : un roster est lu par d'autres membres.
- **Ne mets pas les deux `Sortie décontractée` au catalogue.** Deux pièces,
  un seul nom français, et le générateur lève « Pièce ambiguë ».

## Les pièges de l'outillage

- **Tout symbole exporté doit être importé quelque part**
  (`tests/modules-imports.test.js`). Un module ne reçoit sa ligne `export`
  qu'au moment où son consommateur existe. C'est pour ça que
  `normaliserLibelle`, `rapprocher`, `enchantementsDArme` et `nueDArme` ne sont
  pas exportés aujourd'hui : la tâche 5 est leur consommateur.
- **Tout module de `js/` doit figurer dans `CORE_ASSETS` de `sw.js`** et dans
  `tests/helpers/modules.js`, dans sa couche. `ocr-arme.js` va après
  `ocr-deduction.js`.
- **Le chargeur `vm` des tests concatène tous les modules dans une portée
  unique.** Avant de nommer quoi que ce soit :
  `grep -rn "function <nom>\|const <nom>" js/`. Deux collisions ont déjà coûté
  une heure (`normaliser`, `SECTIONS`).
- **Expose tes nouvelles fonctions dans `HOOK_EXPORT`** de
  `tests/helpers/load-app.js` — `deduireArme` y est déjà prévu.
- **Utilise `plain()`** pour comparer un objet venu du `vm` avec
  `deepStrictEqual`, sinon « same structure but not reference-equal ».
- **Les heredocs bash mangent un niveau d'échappement.** Un script node écrit
  en heredoc perd ses `\p{L}`. Passe par l'outil d'écriture de fichier, ou par
  python avec `newline=""`. Les fichiers du dépôt sont en CRLF ; détecte-le
  (`s.includes("\r\n")`) au lieu de le supposer.

## Reste dehors, volontairement

- L'`Épée longue usée` : courbes absentes des données.
- Les deux `Sortie décontractée` : nom français partagé.
- Le niveau et le renforcement affichés dans l'en-tête d'une **armure** :
  l'inversion les retrouve déjà, les lire n'ajouterait qu'un recoupement.
- `probe-ocr/` : sondes jetables, non versionnées. Supprime-les à la fin.
