# Unités des effets J.A.R.V.I.S. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les valeurs brutes de `mecaniques.json` uniquement lorsque l'unité est prouvée par l'export, conserver la valeur de table lors d'un désaccord avec le texte du jeu et rendre ce désaccord visible à J.A.R.V.I.S.

**Architecture:** `BuffTable.Local_Replace` sert de preuve par occurrence, par rapprochement numérique et jamais par position. `EAbilityStatValueType::Per` prouve aussi une valeur en dix-millièmes. Les métadonnées du dépôt restent un repli normalisé par casse et ponctuation ; les codes dont l'unité stable est prouvée rejoignent `stat-metadata.json`. Une description du jeu substituée accompagne les valeurs sans rapprochement afin que Gemini voie simultanément la table et le texte.

**Tech Stack:** Node.js CommonJS, JSON, tests `node:assert`, extracteur FModel local.

**Spec:** `docs/passation-jarvis-codex.md` (Tâche 1), complétée par les garde-fous validés par le propriétaire le 24/09/2026.

## Global Constraints

- Le chemin personnel de l'export passe uniquement par `DONNEES_JEU` et n'entre dans aucun fichier suivi.
- Une unité n'est jamais déduite du nom du code ni du drapeau `taux`.
- `Local_Replace` se rapproche par valeur absolue : `N` prouve des points si `N == abs(Value)` ; `N%` prouve des dix-millièmes si `N * 100 == abs(Value)`.
- L'ordre des remplacements et celui d'`AddAbil_List` ne sont jamais supposés identiques.
- En cas d'absence de rapprochement, la valeur de table reste autoritaire dans `valeur`; le texte localisé substitué est ajouté séparément.
- `Per` est en dix-millièmes et s'affiche en pourcentage.
- Les sorties privées `output/jarvis/*.json` restent ignorées par Git.

## Review Focus

- Un nombre identique présent dans un champ sans rapport ne doit pas être associé par position : le test `302000001` impose le rapprochement par nombre.
- Une valeur de table et un texte contradictoires doivent toutes deux atteindre Gemini : le test `302000002` impose `-6 %` plus le texte affichant `15 %`.
- Les petites valeurs en dix-millièmes restent décimales : `-15` doit devenir `-0,15 %`, jamais `-15` ni `-15 %`.
- Une opération `Per` sur une statistique plate doit rester un pourcentage : `Move_Spd -500` doit devenir `-5 %`.
- Une valeur sans remplacement, sans `Per` et sans métadonnée prouvée doit rester explicitement brute.

---

### Task 1: Rapprochement numérique et désaccords visibles

**Files:**
- Modify: `tests/mecaniques-jarvis.test.js`
- Modify: `outils/fabrication/mecaniques-jarvis.js`
- Modify: `tests/discord-jarvis-mecaniques.test.js`
- Modify: `supabase/functions/_shared/discord-jarvis-mecaniques.js`

**Interfaces:**
- Consumes: `buff.AddAbil_List[]`, `buff.Local_Replace[]`, `buff.Local_Desc`, `entree.unites`.
- Produces: chaque valeur `{stat, valeur}` et, sur la variante concernée, `texteJeu?: string`; le catalogue expose `controleValeurs:{prouvees,brutes,desaccords}`.

- [ ] **Step 1: Write the failing extraction tests**

Ajouter quatre fixtures littérales :

```js
// 302000001 : les deux premiers remplacements appartiennent à d'autres champs.
Local_Replace:["{0}:{1}", "{1}:{10%}", "{2}:{20%}"]
// 302000002 : Value=-600 mais le texte du jeu annonce 15 %.
Local_Replace:["{0}:{1}", "{1}:{10%}", "{2}:{15%}"]
// 302000102 : Value=-15 correspond exactement à 0.15 %.
Local_Replace:["{1}:{0.15%}"]
// 302000501 : Move_Spd, Type=Per, Value=-500, remplacement 5 %.
Local_Replace:["{0}:{5%}"]
```

Attendre respectivement `-20 %`, `-6 %` avec un `texteJeu` qui contient `15 %`, `-0,15 %` et `-5 %`. Ajouter une valeur sans aucune preuve qui reste `42 (valeur brute)`. Attendre les compteurs littéraux du mini-catalogue.

- [ ] **Step 2: Run the extraction test and verify RED**

Run: `node tests/mecaniques-jarvis.test.js`

Expected: FAIL parce que `Local_Replace`, `Per`, `texteJeu` et `controleValeurs` ne sont pas encore consommés.

- [ ] **Step 3: Implement the minimal extraction behavior**

Dans `mecaniques-jarvis.js` :

```js
function remplacementsDuBuff(buff) { /* parse {n}:{nombre} et {n}:{nombre%} */ }
function uniteProuveePourAjout(ajout, remplacements, unites) {
  /* rapprochement par nombre -> Per -> metadata canonique -> famille établie -> null */
}
function texteAfficheDuBuff(buff, lire) {
  /* substitue par indice de placeholder uniquement dans la description */
}
```

Ne jamais choisir un remplacement par sa position. Comparer les valeurs absolues, conserver le signe de `Value`, et utiliser une recherche de métadonnée par clé canonique (`casefold` + retrait de la ponctuation). Si `Local_Replace` est non vide mais qu'aucun remplacement ne correspond numériquement à un ajout, poser `texteJeu` sur la variante sans modifier `valeur`. Compter les valeurs finales après déduplication des variantes.

- [ ] **Step 4: Run the extraction test and verify GREEN**

Run: `node tests/mecaniques-jarvis.test.js`

Expected: `OK mecaniques-jarvis`.

- [ ] **Step 5: Write the failing Discord propagation tests**

Faire accepter `texteJeu?: string` et `controleValeurs` par le validateur, puis attendre `texteDuJeu` dans la variante lisible d'un effet en désaccord. Ajouter un cas mal formé où `texteJeu` n'est pas une chaîne.

- [ ] **Step 6: Run the Discord test and verify RED**

Run: `node tests/discord-jarvis-mecaniques.test.js`

Expected: FAIL car le consommateur ne propage pas encore `texteJeu`.

- [ ] **Step 7: Implement and verify Discord propagation**

Dans `discord-jarvis-mecaniques.js`, valider l'option puis exposer `texteDuJeu` dans `varianteLisible`. Ne pas modifier la phrase `valeurs`, qui reste issue de la table.

Run: `node tests/discord-jarvis-mecaniques.test.js`

Expected: `OK discord-jarvis-mecaniques`.

- [ ] **Step 8: Commit Task 1**

```powershell
git add tests/mecaniques-jarvis.test.js outils/fabrication/mecaniques-jarvis.js tests/discord-jarvis-mecaniques.test.js supabase/functions/_shared/discord-jarvis-mecaniques.js
git commit -m "fix(jarvis): prouver les unités par occurrence"
```

### Task 2: Métadonnées prouvées, provenance et extraction réelle

**Files:**
- Modify: `tests/mecaniques-jarvis.test.js`
- Modify: `7ds-stats/stat-metadata.json`
- Create: `docs/unites-effets-jarvis.md`
- Modify: `outils/fabrication/extraire-mecaniques.js`
- Regenerate (ignored): `output/jarvis/mecaniques.json`

**Interfaces:**
- Consumes: recherche canonique de Task 1 et `controleValeurs`.
- Produces: replis d'unité stables pour les occurrences sans `Local_Replace`, preuve humaine code par code et bilan d'extraction affiché en console.

- [ ] **Step 1: Write the failing metadata fallback test**

Charger le vrai `stat-metadata.json` dans le test et construire des buffs sans `Local_Replace` pour représenter un code prouvé en pourcentage (`TickDam_Period_Rate`) et un code plat (`T_Def`). Attendre `-20 %` et `+46`. Ajouter une variante de casse (`NormalAttack_DamAdd_Rate`) qui doit retrouver `Normalattack_Damadd_Rate`.

- [ ] **Step 2: Run the metadata test and verify RED**

Run: `node tests/mecaniques-jarvis.test.js`

Expected: FAIL sur les codes encore absents ou sur la recherche exacte sensible à la casse.

- [ ] **Step 3: Add only stable, proven metadata**

Ajouter avec les familles suivantes :

```text
damage: D_All_DamRes_Rate, Final_All_Dam_Rate, TickDam_Period_Rate
elemental: Burst_Gauge_Res_Rate, Dark_Res_Rate,
  Earth_Burst_Gauge_Res_Rate, Earth_Res_Rate,
  Fire_Burst_Gauge_Res_Rate, Fire_Res_Rate,
  Holy_Res_Rate, Ice_Burst_Gauge_Res_Rate, Ice_Res_Rate,
  Thunder_Burst_Gauge_Res_Rate, Thunder_Res_Rate,
  Wind_Burst_Gauge_Res_Rate, Wind_Res_Rate
special: MaxSP_Rate, MF_CostReduce_Rate_UltimateSkill, RecoverySP_Rate,
  S_GlidingSpdAdd_Rate, S_GlidingStamina_Rate, S_MoveSpdAdd_Rate,
  S_PetFlyingSpdAdd_Rate, S_PetFlyingStamina_Rate,
  S_SwimSpdAdd_Rate, S_SwimStamina_Rate, S_UnderWaterSpdAdd_Rate
main/flat: T_Atk, T_Def
special/flat: Temp_Cold_Res, Temp_Hot_Res
```

Tous les codes ci-dessus sont `ten-thousandths` sauf les quatre explicitement marqués `flat`. Ne pas ajouter `Move_Spd` ni `T_MaxHP` : leur pourcentage est prouvé par l'opération `Per`, pas par l'unité stable du code. Ne pas dupliquer les huit variantes déjà couvertes par la recherche canonique.

- [ ] **Step 4: Document provenance**

Créer `docs/unites-effets-jarvis.md` avec les 41 codes observés, un identifiant de buff témoin, la valeur de table, le remplacement exact ou `Type=Per`, l'unité retenue et les deux codes contextuels non ajoutés aux métadonnées. Documenter aussi les cas contradictoires `302000002` et non positionnels `302000001`.

- [ ] **Step 5: Verify focused tests GREEN**

Run: `node tests/mecaniques-jarvis.test.js && node tests/discord-jarvis-mecaniques.test.js && python -m unittest tests/test_generate_stats_build.py`

Expected: trois commandes vertes.

- [ ] **Step 6: Print extraction controls**

Faire afficher par `extraire-mecaniques.js` : `valeurs prouvées`, `valeurs brutes`, `désaccords texte/table`. Le chemin de l'export ne doit apparaître ni dans le code ni dans la documentation.

- [ ] **Step 7: Regenerate from the real export and inspect controls**

Run locally with `DONNEES_JEU` set only in the process environment, then inspect `controleValeurs`, the four buff IDs de régression et la taille inférieure à 2 Mo.

Expected: 468 effets ; les compteurs sont non négatifs et leur somme cohérente ; `302000002` conserve `-6 %` et expose le texte `15 %`.

- [ ] **Step 8: Run the complete suite**

Run: `npm test`

Expected: toute la suite unitaire et de bout en bout passe.

- [ ] **Step 9: Commit Task 2**

```powershell
git add 7ds-stats/stat-metadata.json docs/unites-effets-jarvis.md outils/fabrication/extraire-mecaniques.js tests/mecaniques-jarvis.test.js
git commit -m "docs(jarvis): tracer la provenance des unités"
```
