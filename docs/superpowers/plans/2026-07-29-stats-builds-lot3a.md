# Stats de builds — Lot 3A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculer et afficher, héros par héros, une borne inférieure diagnostiquable de toutes les statistiques couvertes par le personnage, sa maîtrise maximale, son potentiel commun et ses neuf équipements, tout en conservant les passifs comme faits non calculés.

**Architecture:** Le générateur enrichit le catalogue local avec les personnages et les passifs. Le moteur pur d’`index.html` transforme chaque source en termes canoniques reconstructibles, refuse tout total numérique si un équipement requis est incomplet et concentre l’unique hypothèse de formule dans un mode nommé. La même vue de résultat est réutilisée par le Team Builder, le roster, les détails d’équipe et les archives de boss. Les JSONB existants stockent uniquement le niveau des passifs de pièce ; un garde SQL imbriqué protège ce nouveau sous-champ contre les anciennes PWA.

**Tech Stack:** Python 3, JavaScript navigateur sans build, Node `vm`, Playwright, PostgreSQL/Supabase, `pglast`, HTML/CSS statiques.

## Global Constraints

- Le potentiel est commun au personnage : une seule valeur `hero.potentiel.tier`, affichée `P0` à `P10`. L’arme équipée sélectionne seulement la branche chiffrée et le descriptif.
- Un personnage n’a aucun niveau. Sa base est fixe.
- Tous les personnages sont calculés en maîtrise maximale ; aucun réglage de maîtrise n’est persisté.
- Les vues d’équipe restent séparées par héros. Aucun score ou total global d’équipe n’est introduit.
- Les passifs sont affichés mais ne contribuent jamais aux nombres du lot 3A.
- Les plafonds restent distincts : arme `7`, armure/gravure `3`.
- Un `passiveLevel` absent ou invalide n’annule pas un total numérique par ailleurs complet.
- Un équipement ou une configuration numérique requis absent/invalide annule le total du héros : `terms` et `totals` sont alors vides.
- Les trois correspondances de statistique autorisées sont exclusivement :

  ```text
  B_Atk_Equip   -> B_Atk
  B_Def_Equip   -> B_Def
  B_MaxHp_Equip -> B_MaxHp
  ```

  Tous les autres codes gardent leur identité exacte.
- L’unité vient des métadonnées explicites, jamais du nom du code ni du champ `taux`.
- Le catalogue généré reste la seule donnée d’exécution. `index.html` ne charge jamais `7ds-stats/*.json`.
- L’application reste utilisable en `file://`, sans serveur et sans étape de build.
- Ne pas hardcoder une liste d’assets ou de personnages dans `index.html`.
- `index.html` a des fins de ligne mixtes : modifier des ancres courtes avec `apply_patch`, sans normalisation globale.
- Écrire chaque régression avant son correctif, observer l’échec attendu, puis seulement implémenter.
- Ne pas fusionner ni pousser sans autorisation explicite du propriétaire.

## File and Interface Map

### Production

- `generate-stats-build.py`
  - ajouter le compactage des personnages ;
  - ajouter les passifs d’arme, d’équipement spécial et de gravure ;
  - étendre la validation des métadonnées ;
  - produire `charactersBySlug`.
- `7ds-stats/stat-metadata.json`
  - déclarer `family` et `unit` pour chaque code nouvellement émis.
- `7ds-stats/stat-labels-supplement.json`
  - fournir les libellés français absents de la source publique.
- `stats-build.js`
  - fichier généré, jamais édité manuellement.
- `index.html`
  - modèle `passiveLevel` ;
  - moteur personnage/maîtrise/potentiel ;
  - agrégation complète du héros ;
  - affichage et édition des passifs ;
  - correction visible `T` vers `P`.
- `supabase/schema.sql`
  - protection imbriquée de `passiveLevel`.
- `AGENTS.md`
  - documenter le contrat livré, le SQL à rejouer et le protocole de validation en jeu.

### Tests

- `tests/test_generate_stats_build.py`
  - fixtures et contrats du générateur.
- `tests/stats-build-catalog.test.js`
  - intégrité du catalogue généré réel.
- `tests/helpers/load-app.js`
  - exposer les nouvelles fonctions pures et charger `charactersBySlug`.
- `tests/stats-build.test.js`
  - contrat de calcul, reconstruction, complétude et passifs.
- `tests/stats-build-schema.test.js`
  - structure du garde SQL imbriqué.
- `tests/test_schema_sql.py`
  - syntaxe PostgreSQL du schéma complet.
- `tests/potentiel-commun.playwright.js`
  - potentiel commun et libellés `P0`–`P10`.
- `tests/supabase-etape1.playwright.js`
  - persistance/copie JSONB et compatibilité avec une ancienne PWA.
- `tests/accessibilite-mobile.playwright.js`
  - rendu compact, panneaux repliés, aucune régression mobile.

### Interfaces nouvelles ou étendues

```js
window.SEVEN_DS_BUILD_STATS.charactersBySlug[charId]

gearPassiveStatus(definition, config)

calculateHeroStats(hero)

heroStatsSection(hero, settings?)
```

`calculateHeroStats(hero)` retourne :

```js
{
  version: 1,
  status: "valid" | "incomplete" | "unavailable" | "incompatible",
  coverage: [],
  uncovered: [],
  assumptions: {},
  missing: [],
  terms: [],
  totals: [],
  facts: { passives: [] }
}
```

---

## Task 1: Enrichir le catalogue avec personnages et passifs

**Files:**

- Modify: `tests/test_generate_stats_build.py`
- Modify: `tests/stats-build-catalog.test.js`
- Modify: `generate-stats-build.py`
- Modify: `7ds-stats/stat-metadata.json`
- Modify: `7ds-stats/stat-labels-supplement.json`
- Regenerate: `stats-build.js`

- [ ] **Step 1: Ajouter les fixtures minimales de personnage et de passifs**

Dans `tests/test_generate_stats_build.py`, enrichir `setUp()` avec :

```python
self.write_json(
    self.stats / "personnages.json",
    [{
        "slug": "hero",
        "baseHp": 1200,
        "baseAtk": 200,
        "baseDef": 160,
        "baseSpd": 500,
        "accuracy": 50,
        "block": 30,
        "critRate": 500,
        "critDamage": 1500,
        "critResist": 0,
        "critDmgResist": 0,
        "blockDmgResist": 9500,
        "pvpDmgUp": 150,
        "pvpDmgDown": 125,
        "commonMasteryStats": [{"stat": "B_Atk", "value": 10}],
        "weaponMasteries": [{
            "weaponType": "Axe",
            "level": 1,
            "subLevels": [{
                "abilities": [{"stat": "B_Def", "value": 20}]
            }],
            "nodes": [{
                "abilities": [{"stat": "I_AtkAdd_Rate", "value": 200}]
            }]
        }],
        "potentials": [{
            "weaponType": "Axe",
            "tier": 1,
            "stats": [{"stat": "I_AtkAdd_Rate", "value": 300}]
        }]
    }]
)
```

Ajouter aussi :

- sept `passiveLevels` français au niveau racine de l’arme ;
- trois niveaux dans `equipPassive` pour la pièce spéciale ;
- trois niveaux dans `engravingPassives` pour la gravure.

Le générateur doit continuer à rapprocher les fichiers par les mécanismes existants. Aucun chemin absolu de fixture ne doit apparaître dans le résultat.

- [ ] **Step 2: Écrire les contrats rouges du catalogue compact**

Ajouter des assertions équivalentes à :

```python
hero = catalog["charactersBySlug"]["hero"]
self.assertEqual(hero["baseStats"][0], {
    "stat": "B_MaxHp",
    "value": 1200,
})
self.assertEqual(
    hero["masteriesByWeapon"]["Axe"]["abilities"][0]["source"]["kind"],
    "subLevel",
)
self.assertEqual(
    hero["potentialsByWeapon"]["Axe"]["1"],
    [{"stat": "I_AtkAdd_Rate", "value": 300}],
)
self.assertEqual(len(catalog["weaponsByFile"][weapon_file]["passiveLevels"]), 7)
self.assertEqual(len(catalog["gearByFile"][gear_file]["passiveLevels"]), 3)
self.assertEqual(len(catalog["engravedByFile"][engraved_file]["passiveLevels"]), 3)
```

Exiger une forme compacte :

```js
{ level: 1, textFr: "…" }
```

et l’absence des autres champs de prose ou matériaux non nécessaires.

- [ ] **Step 3: Lancer les tests ciblés et constater l’échec**

Run:

```powershell
python -m unittest tests.test_generate_stats_build
node --test tests/stats-build-catalog.test.js
```

Expected: FAIL, car `charactersBySlug` et `passiveLevels` ne sont pas encore générés.

- [ ] **Step 4: Implémenter les correspondances explicites de base**

Dans `generate-stats-build.py`, définir une seule table :

```python
CHARACTER_BASE_FIELDS = {
    "baseHp": ("B_MaxHp", "flat"),
    "baseAtk": ("B_Atk", "flat"),
    "baseDef": ("B_Def", "flat"),
    "baseSpd": ("baseSpd", "flat"),
    "accuracy": ("accuracy", "ten-thousandths"),
    "block": ("block", "ten-thousandths"),
    "critRate": ("critRate", "ten-thousandths"),
    "critDamage": ("critDamage", "ten-thousandths"),
    "critResist": ("critResist", "ten-thousandths"),
    "critDmgResist": ("critDmgResist", "ten-thousandths"),
    "blockDmgResist": ("blockDmgResist", "ten-thousandths"),
    "pvpDmgUp": ("pvpDmgUp", "ten-thousandths"),
    "pvpDmgDown": ("pvpDmgDown", "ten-thousandths"),
}
```

Cette table est la seule traduction des champs primitifs. Elle ne fusionne pas
`accuracy` avec `A_Accuracy`, ni `block` avec `A_Block` : les unités et les
échelles diffèrent dans les données.

Ajouter :

```python
def compact_character(character):
    ...

def compact_passive_levels(raw_levels, expected_max):
    ...
```

`compact_character()` doit :

- échouer si `slug` est absent ou dupliqué ;
- émettre les treize statistiques fixes, zéro compris ;
- conserver chaque contribution de maîtrise séparée avec
  `{level, kind, index}` ;
- regrouper les cinq entrées d’une branche sans inventer de niveau de héros ;
- regrouper les dix paliers de potentiel par branche ;
- ne conserver aucun descriptif de potentiel dans le catalogue chiffré.

`compact_passive_levels()` doit :

- conserver `level` et le texte français ;
- refuser un niveau dupliqué ;
- refuser un plafond autre que `7` pour l’arme ou `3` pour une pièce ;
- ordonner par niveau.

- [ ] **Step 5: Étendre les métadonnées et libellés sans déduction**

Ajouter les codes bruts manquants dans `7ds-stats/stat-metadata.json` avec
`family` et `unit` explicites.

Ajouter dans `7ds-stats/stat-labels-supplement.json` :

```json
{
  "baseSpd": "Vitesse",
  "accuracy": "Précision de base",
  "block": "Blocage de base",
  "critRate": "Taux critique de base",
  "critDamage": "Dégâts critiques de base",
  "critResist": "Résistance critique de base",
  "critDmgResist": "Résistance aux dégâts critiques de base",
  "blockDmgResist": "Réduction des dégâts bloqués",
  "pvpDmgUp": "Dégâts JcJ infligés",
  "pvpDmgDown": "Dégâts JcJ subis"
}
```

Conserver les entrées déjà présentes. Ne pas transformer automatiquement un
nom de clé en libellé.

- [ ] **Step 6: Régénérer puis vérifier le catalogue réel**

Run:

```powershell
python generate-stats-build.py
python generate-stats-build.py --check
python -m unittest tests.test_generate_stats_build
node --test tests/stats-build-catalog.test.js
```

Expected: PASS et, sur les données réelles :

- 24 personnages ;
- 81 armes avec sept niveaux de passif ;
- 10 pièces normales avec trois niveaux ;
- 83 gravures avec trois niveaux ;
- chaque code émis possède un libellé, une famille et une unité ;
- aucune clé absolue et aucun antislash.

- [ ] **Step 7: Commit**

```powershell
git add generate-stats-build.py 7ds-stats/stat-metadata.json 7ds-stats/stat-labels-supplement.json stats-build.js tests/test_generate_stats_build.py tests/stats-build-catalog.test.js
git commit -m "feat: enrichir le catalogue des statistiques héros"
```

---

## Task 2: Modéliser les niveaux de passif et corriger T vers P

**Files:**

- Modify: `tests/helpers/load-app.js`
- Modify: `tests/stats-build.test.js`
- Modify: `tests/potentiel-commun.playwright.js`
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `index.html`

- [ ] **Step 1: Charger les nouvelles données dans le bac à sable**

Dans `tests/helpers/load-app.js`, fusionner le catalogue réel avec les fixtures :

```js
charactersBySlug: {
  ...realCatalog.charactersBySlug,
  ...(fixtureCatalog.charactersBySlug || {})
}
```

Exposer via `HOOK_EXPORT` :

```js
WEAPON_PASSIVE_MAX_LEVEL,
GEAR_PASSIVE_MAX_LEVEL,
gearPassiveStatus,
weaponPassiveFact
```

Les tableaux traversant `vm` sont comparés après `plain()`.

- [ ] **Step 2: Écrire les tests rouges du statut de passif**

Dans `tests/stats-build.test.js`, couvrir exactement :

```js
assert.equal(gearPassiveStatus(defWithoutPassive, config), "not-applicable");
assert.equal(gearPassiveStatus(defWithPassive, { passiveLevel: null }), "missing");
assert.equal(gearPassiveStatus(defWithPassive, { passiveLevel: 1 }), "valid");
assert.equal(gearPassiveStatus(defWithPassive, { passiveLevel: 3 }), "valid");
assert.equal(gearPassiveStatus(defWithPassive, { passiveLevel: 0 }), "incompatible");
assert.equal(gearPassiveStatus(defWithPassive, { passiveLevel: 4 }), "incompatible");
```

Vérifier séparément :

```js
assert.equal(WEAPON_PASSIVE_MAX_LEVEL, 7);
assert.equal(GEAR_PASSIVE_MAX_LEVEL, 3);
assert.equal(weaponPassiveFact(weaponDef, { overlimit: 0 }).level, 1);
assert.equal(weaponPassiveFact(weaponDef, { overlimit: 6 }).level, 7);
```

Ajouter une preuve que modifier `passiveLevel` ne change ni
`gearConfigStatus()` ni `calculateGearStats().totals`.

- [ ] **Step 3: Écrire les tests rouges de normalisation et copie**

Vérifier qu’une ancienne configuration devient :

```js
{
  version: 1,
  level: 130,
  reinforce: 5,
  enchantments: [],
  passiveLevel: null
}
```

Puis vérifier les frontières déjà existantes :

- roster vers Team Builder ;
- équipe vers roster ;
- favori copié vers un autre type d’arme ;
- instantané de run de boss.

Dans chaque cas, `passiveLevel: 2` doit être copié comme valeur indépendante,
jamais comme référence partagée.

- [ ] **Step 4: Écrire la régression rouge des libellés P**

Dans `tests/potentiel-commun.playwright.js`, ouvrir l’éditeur de roster et
collecter les onze boutons :

```js
expect(labels).toEqual([
  "P0", "P1", "P2", "P3", "P4", "P5",
  "P6", "P7", "P8", "P9", "P10"
]);
expect(await page.locator("text=/\\bT(?:10|[0-9])\\b/").count()).toBe(0);
```

Limiter la recherche aux contrôles et résumés de potentiel afin de ne pas
confondre un texte libre saisi par un membre.

- [ ] **Step 5: Lancer les tests et constater l’échec**

Run:

```powershell
node --test tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
```

Expected: FAIL sur le champ absent et sur les boutons `T0`–`T10`.

- [ ] **Step 6: Implémenter le modèle passif sans toucher au calcul numérique**

Dans `index.html` :

```js
const WEAPON_PASSIVE_MAX_LEVEL = 7;
const GEAR_PASSIVE_MAX_LEVEL = 3;

function gearPassiveStatus(definition, config) {
  if (!definition?.passiveLevels?.length) return "not-applicable";
  if (config?.passiveLevel == null) return "missing";
  return Number.isInteger(config.passiveLevel)
    && config.passiveLevel >= 1
    && config.passiveLevel <= GEAR_PASSIVE_MAX_LEVEL
      ? "valid"
      : "incompatible";
}
```

Ajouter `passiveLevel: null` à la normalisation et à
`emptyGearConfig(file)`. La validation numérique existante ignore toujours ce
champ.

Pour l’arme, dériver le fait sans persistance :

```js
function weaponPassiveFact(definition, config) {
  if (!definition?.passiveLevels?.length) return null;
  const level = config.overlimit + 1;
  return {
    source: "weapon:passive",
    level,
    maxLevel: WEAPON_PASSIVE_MAX_LEVEL,
    text: definition.passiveLevels[level - 1]?.textFr || ""
  };
}
```

- [ ] **Step 7: Remplacer seulement les libellés visibles T par P**

Modifier le contrôle du roster montré dans la capture :

```js
text: "P" + tier
```

Chercher ensuite les autres occurrences visibles :

```powershell
rg -n '"T"\\s*\\+\\s*tier|`T\\$\\{|>T[0-9]|T0|T10' index.html tests
```

Ne pas renommer :

- `potentiel.tier` ;
- les colonnes ou clés historiques contenant `tier` ;
- du texte libre utilisateur.

- [ ] **Step 8: Rejouer les tests ciblés**

Run:

```powershell
node --test tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js tests/potentiel-commun.playwright.js tests/supabase-etape1.playwright.js
git commit -m "feat: enregistrer les niveaux de passif des équipements"
```

---

## Task 3: Protéger `passiveLevel` contre les anciennes PWA

**Files:**

- Modify: `tests/stats-build-schema.test.js`
- Modify: `tests/test_schema_sql.py`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Remplacer le contrat SQL trop large par le contrat imbriqué**

Retirer l’assertion qui exige le retour immédiat :

```js
/if p_new \? p_config_key then return null/
```

Ajouter des contrats portant sur les deux niveaux :

```js
assert.match(sql, /p_new \? p_config_key/);
assert.match(sql, /p_new_config \? 'passiveLevel'/);
assert.match(sql, /p_old_file = p_new_file/);
assert.match(sql, /jsonb_set\(/);
assert.match(sql, /array\[v_slot, 'passiveLevel'\]/);
```

Le test doit aussi exiger que les triggers roster et équipe utilisent toujours
le même helper pour `armorConfig` et `jewelConfig`.

- [ ] **Step 2: Ajouter une preuve par mutation du garde**

Dans `tests/stats-build-schema.test.js`, charger le SQL puis supprimer
temporairement, en mémoire, la condition d’absence du sous-champ :

```js
const mutated = sql.replace(
  "not (p_new_config ? 'passiveLevel')",
  "false"
);
assert.throws(() => assertNestedPassiveGuard(mutated));
```

Cette mutation prouve que le test échoue si une ancienne PWA peut de nouveau
effacer le sous-champ.

- [ ] **Step 3: Lancer les tests rouges**

Run:

```powershell
node --test tests/stats-build-schema.test.js
python -m unittest tests.test_schema_sql
```

Expected: le contrat imbriqué échoue ; la syntaxe existante reste verte.

- [ ] **Step 4: Refactorer `private.preserved_gear_config`**

Le helper doit renvoyer l’objet `armorConfig`/`jewelConfig` final à replacer
par l’appelant, ou `null` si aucune préservation n’est nécessaire :

1. Si la config complète est absente dans `p_new`, conserver le comportement
   historique : préserver l’objet complet pour chaque pièce inchangée.
2. Si la config complète est présente :
   - parcourir chaque slot ;
   - vérifier que `p_old` et `p_new` portent le même fichier ;
   - lire les anciennes et nouvelles configs de slot ;
   - n’agir que si les deux sont des objets JSON ;
   - si l’ancien objet contient `passiveLevel` et le nouveau ne le contient
     pas, réinsérer uniquement ce sous-champ.
3. Si le nouveau contient explicitement `"passiveLevel": null`, ne rien
   préserver.
4. Si le héros, la pièce ou le slot a changé, ne rien transporter.

Dans la branche où la clé de config existe déjà, initialiser le résultat depuis
la nouvelle config afin de ne jamais écraser les autres champs récents :

```sql
v_kept := p_new -> p_config_key;
```

La fusion imbriquée doit ensuite être équivalente à :

```sql
if jsonb_typeof(p_old_config) = 'object'
   and jsonb_typeof(p_new_config) = 'object'
   and p_old_config ? 'passiveLevel'
   and not (p_new_config ? 'passiveLevel') then
  v_kept := jsonb_set(
    v_kept,
    array[v_slot, 'passiveLevel'],
    p_old_config -> 'passiveLevel',
    true
  );
end if;
```

Conserver le contrôle `char` déjà présent dans le trigger des équipes avant
l’appel au helper.

- [ ] **Step 5: Vérifier syntaxe et contrat**

Run:

```powershell
node --test tests/stats-build-schema.test.js
python -m unittest tests.test_schema_sql
```

Expected: PASS, y compris le test où `pglast` refuse toujours un corps PL/pgSQL
volontairement cassé.

- [ ] **Step 6: Commit**

```powershell
git add supabase/schema.sql tests/stats-build-schema.test.js tests/test_schema_sql.py
git commit -m "fix: préserver les niveaux de passif imbriqués"
```

---

## Task 4: Produire les termes personnage, maîtrise et potentiel

**Files:**

- Modify: `tests/helpers/load-app.js`
- Modify: `tests/stats-build.test.js`
- Modify: `index.html`

- [ ] **Step 1: Exposer les fonctions pures du nouveau domaine**

Ajouter à `HOOK_EXPORT` :

```js
characterBaseTerms,
fullMasteryTerms,
potentialTerms,
canonicalHeroTerm,
characterDefinitionForHero
```

- [ ] **Step 2: Écrire les tests rouges de base**

Avec un personnage de fixture :

```js
const terms = plain(characterBaseTerms(definition));
assert.ok(terms.some(term =>
  term.stat === "B_Atk"
  && term.value === 200
  && term.bucket === "character:base"
  && term.unit === "flat"
));
assert.ok(terms.some(term =>
  term.stat === "critRate"
  && term.value === 500
  && term.unit === "ten-thousandths"
));
```

Chaque terme doit porter :

```js
{
  operation: "add",
  confidence: "exact",
  source: {
    domain: "character",
    field: "baseAtk"
  }
}
```

- [ ] **Step 3: Écrire les tests rouges de maîtrise maximale**

Pour la branche de l’arme équipée, prouver que le résultat contient :

- tous les `commonMasteryStats` ;
- toutes les capacités de `subLevels` des cinq entrées ;
- toutes les capacités de `nodes` des cinq entrées ;
- aucune capacité d’une autre branche.

Tester le nombre de contributions, pas seulement leur somme, afin de préserver
le diagnostic :

```js
assert.equal(
  masteryTerms.filter(t => t.source.kind === "subLevel").length,
  expectedSubLevelAbilityCount
);
assert.equal(
  masteryTerms.filter(t => t.source.kind === "node").length,
  expectedNodeAbilityCount
);
```

- [ ] **Step 4: Écrire les tests rouges du potentiel commun**

Prouver :

```js
assert.deepEqual(plain(potentialTerms(def, "Axe", 0)), []);
assert.deepEqual(
  plain(potentialTerms(def, "Axe", 1)).map(t => t.value),
  [300]
);
```

Puis changer uniquement l’arme équipée :

- le palier stocké reste `1` ;
- la branche utilisée change ;
- aucune écriture n’est effectuée dans `hero.potentiel`.

Un palier P3 doit prendre uniquement l’instantané chiffré de P3. Il est interdit
d’additionner P1 + P2 + P3 : les valeurs sont déjà cumulées dans les données
(mesure vérifiée : `I_AtkAdd_Rate` vaut 300 à P1, 900 à P3 et 1800 à P8 sur la
branche Axe). Le test doit être fixé sur la structure réelle compacte, pas sur
le texte du bonus.

- [ ] **Step 5: Observer l’échec**

Run:

```powershell
node --test tests/stats-build.test.js
```

Expected: FAIL, fonctions absentes.

- [ ] **Step 6: Implémenter les termes sans les agréger**

Dans `index.html`, lire exclusivement :

```js
window.SEVEN_DS_BUILD_STATS.charactersBySlug[hero.char]
```

Créer un terme par contribution. Ne pas pré-sommer les maîtrises : le détail
doit permettre de retrouver le gros nœud ou sous-niveau responsable d’un
écart.

Les seaux sont :

```text
character:base
mastery:common
mastery:<weaponType>
potential:<weaponType>:<tier>
```

`canonicalHeroTerm(term)` applique uniquement les trois correspondances
`*_Equip` documentées et copie le code original dans :

```js
source.originalStat
```

- [ ] **Step 7: Vérifier la reconstruction partielle des nouveaux domaines**

Pour chacune des statistiques émises :

```js
assert.deepEqual(
  reconstructStatTotals(terms),
  expectedTotals
);
```

L’égalité doit être stricte, sans arrondi supplémentaire.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: calculer base maîtrise et potentiel du héros"
```

---

## Task 5: Agréger le héros complet avec une formule centralisée

**Files:**

- Modify: `tests/helpers/load-app.js`
- Modify: `tests/stats-build.test.js`
- Modify: `index.html`

- [ ] **Step 1: Exposer le contrat public**

Ajouter à `HOOK_EXPORT` :

```js
HERO_MAIN_RATE_APPLICATION_MODE,
heroMainRateTargetBuckets,
calculateHeroStats
```

- [ ] **Step 2: Écrire les tests rouges de complétude**

Construire une fixture de héros complet avec :

- personnage connu ;
- arme compatible et configuration valide ;
- cinq pièces d’armure configurées ;
- trois bijoux configurés ;
- potentiel `0`.

Supprimer ensuite chaque source une par une et vérifier :

```js
assert.equal(result.status, "incomplete");
assert.deepEqual(result.terms, []);
assert.deepEqual(result.totals, []);
assert.ok(result.missing.includes(expectedPath));
```

Cas distincts :

- personnage absent : `unavailable` ;
- configuration version inconnue : `incompatible` ;
- pièce/config manquante : `incomplete` ;
- potentiel hors 0–10 : `incompatible`.

Le tableau `missing` utilise des chemins stables, par exemple :

```text
weapon
weaponConfig
armor.Haut
armorConfig.Haut
jewel.Anneau
jewelConfig.Anneau
potential
```

- [ ] **Step 3: Écrire les tests rouges de couverture et passifs**

Sur le héros valide :

```js
assert.deepEqual(plain(result.coverage), [
  "character",
  "mastery",
  "potential",
  "weapon",
  "armor",
  "jewel",
  "engraving",
  "set"
]);
```

Même sans ensemble actif, `set` est couvert : l’absence de terme devient un
vrai zéro.

Vérifier l’union sans doublon de :

```js
["weapon:passive", "armor:passive", "engraving:passive"]
```

selon les pièces réellement équipées.

`facts.passives` doit contenir, selon le cas :

```js
{
  source: "weapon:passive",
  slot: "weapon",
  level: 7,
  maxLevel: 7,
  status: "valid",
  text: "..."
}
```

et pour une pièce :

```js
{
  source: "armor:passive",
  slot: "Haut",
  level: null,
  maxLevel: 3,
  status: "missing",
  text: ""
}
```

Changer ce `level` de `null` à `3` ne doit modifier aucun `term` ni `total`.

- [ ] **Step 4: Écrire le test rouge de formule présumée**

Exiger :

```js
assert.equal(
  HERO_MAIN_RATE_APPLICATION_MODE,
  "all-flat-before-passives"
);
assert.deepEqual(
  plain(result.assumptions),
  {
    heroMainRateApplication: {
      mode: "all-flat-before-passives",
      confidence: "presumed"
    }
  }
);
```

La fonction :

```js
heroMainRateTargetBuckets(stat, additiveTerms)
```

est l’unique traduction du mode en `appliesTo`. Pour `I_AtkAdd_Rate`, elle
renvoie tous les seaux additifs `flat` de `B_Atk`, et rien d’autre.

Le terme multiplicatif est résolu vers la statistique concrète :

```js
{
  stat: "B_Atk",
  operation: "multiply",
  unit: "ten-thousandths",
  value: 300,
  appliesTo: ["character:base", "mastery:common", "..."],
  confidence: "presumed",
  source: {
    originalStat: "I_AtkAdd_Rate",
    domain: "potential"
  }
}
```

L’outrepassement d’arme garde ses propres seaux et son hypothèse existante.

- [ ] **Step 5: Prouver que la décomposition reconstruit chaque total**

Pour chaque `total` :

```js
const rebuilt = reconstructStatTotals(result.terms);
assert.deepEqual(plain(result.totals), plain(rebuilt));
```

Ajouter un cas chiffré simple :

```text
ATK fixe : 100 + 20 + 30 = 150
taux présumé : 500 = 5 %
ATK finale : 157,5
```

Le test doit utiliser la même représentation numérique que
`reconstructStatTotals()` et vérifier strictement le résultat, sans tolérance
floue cachant un mauvais seau.

- [ ] **Step 6: Observer l’échec**

Run:

```powershell
node --test tests/stats-build.test.js
```

Expected: FAIL, car `calculateHeroStats()` n’existe pas.

- [ ] **Step 7: Implémenter l’agrégateur**

`calculateHeroStats(hero)` doit :

1. normaliser son entrée sans la modifier ;
2. valider toutes les sources requises ;
3. retourner immédiatement un résultat sans chiffres si une source échoue ;
4. collecter base, maîtrise, potentiel, arme, équipements et ensembles ;
5. canonicaliser uniquement les trois codes d’équipement principaux ;
6. transformer les taux principaux en termes multiplicatifs concrets ;
7. unir `coverage` et `uncovered` sans doublon ;
8. collecter les faits de passif ;
9. appeler `reconstructStatTotals(terms)` une seule fois.

Ne jamais construire `totals` par une seconde formule.

- [ ] **Step 8: Ajouter le commentaire de validation en jeu**

À l’endroit unique de la constante :

```js
// Présumé, non vérifié dans le jeu.
// Protocole : relever les stats d'un nouveau personnage avant son premier
// potentiel puis juste après, équipement inchangé. Si le taux ne porte pas
// sur tous les apports fixes, changer uniquement ce mode et la fonction
// heroMainRateTargetBuckets().
const HERO_MAIN_RATE_APPLICATION_MODE = "all-flat-before-passives";
```

- [ ] **Step 9: Vérifier puis commit**

Run:

```powershell
node --test tests/stats-build.test.js
```

Expected: PASS.

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: calculer la borne inférieure des stats héros"
```

---

## Task 6: Afficher et éditer le résultat dans toutes les vues

**Files:**

- Modify: `tests/stats-build.test.js`
- Modify: `tests/potentiel-commun.playwright.js`
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `tests/accessibilite-mobile.playwright.js`
- Modify: `index.html`

- [ ] **Step 1: Écrire les contrats purs du titre et des groupes**

Exposer si nécessaire :

```js
heroStatsTitle,
heroStatsGroups,
heroStatsSection
```

Tester :

- héros incomplet : aucun faux `0` ;
- héros valide : titre de borne inférieure ;
- `B_MaxHp`, `B_Atk`, `B_Def` en tête ;
- chaque carte principale contient elle-même « borne inférieure » ;
- les autres statistiques restent dans les cinq familles existantes ;
- `uncovered` non vide conserve la mention de borne inférieure ;
- la décomposition est un `<details>` sans attribut `open`.

- [ ] **Step 2: Écrire le parcours Playwright du sélecteur de passif**

Dans le roster propriétaire :

1. ouvrir une pièce avec passif ;
2. vérifier que le sélecteur est dans une section nommée « Passif » ;
3. vérifier les valeurs `À renseigner`, `1`, `2`, `3` ;
4. choisir `2` ;
5. enregistrer ;
6. rouvrir et vérifier `2`.

Pour une pièce sans passif, le sélecteur n’existe pas.

Le bouton d’enregistrement reste piloté uniquement par la configuration
numérique. `À renseigner` n’empêche donc pas l’enregistrement.

- [ ] **Step 3: Écrire les parcours de rendu**

Vérifier le même composant dans :

- Team Builder ;
- éditeur du roster propriétaire ;
- détail en lecture seule du roster d’un autre membre ;
- détail d’une équipe ;
- instantané depuis une archive de boss.

Dans une vue en lecture seule :

- aucun `select` de passif ;
- le niveau et la description sont visibles ;
- le texte exact « Passifs non inclus dans le calcul » est présent ;
- la description passe par `renderBonus()` et aucun HTML brut n’est interprété.

- [ ] **Step 4: Écrire le contrat mobile et accessibilité**

À 320, 360 et 390 px :

```js
expect(document.documentElement.scrollWidth)
  .toBe(document.documentElement.clientWidth);
```

Vérifier aussi :

- trois cartes principales réorganisées sans rail horizontal ;
- zones tactiles de 44 px ;
- tous les panneaux de décomposition repliés à l’ouverture ;
- ouvrir/fermer un panneau conserve le focus logique ;
- fermer une modale d’équipement rend le focus à son déclencheur.

- [ ] **Step 5: Observer les échecs**

Run:

```powershell
node --test tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: FAIL, car le composant héros et le sélecteur n’existent pas.

- [ ] **Step 6: Ajouter le sélecteur de passif à l’éditeur partagé**

Dans `renderGearConfigEditor()` :

- n’ajouter la section que si `definition.passiveLevels.length > 0` ;
- placer le sélecteur après les contrôles numériques, sous un titre « Passif » ;
- stocker `null` ou un entier 1–3 ;
- afficher « Niveau du passif à renseigner » pour `null` ;
- ne pas inclure ce sélecteur dans `gearConfigFirstInvalidSelector()`.

Après chaque modification, recalculer le fait affiché, mais ne pas recalculer
un terme passif.

- [ ] **Step 7: Créer un composant de résultat réutilisable**

`heroStatsSection(hero, settings)` doit :

1. appeler `calculateHeroStats(hero)` ;
2. afficher un message de complétude et la liste `missing` si le résultat
   n’est pas valide ;
3. afficher trois cartes PV/ATK/DEF en premier si le résultat est valide ;
4. inscrire « borne inférieure » dans chaque carte ;
5. afficher le badge « Base d’application présumée » ;
6. afficher les autres statistiques par famille ;
7. rendre chaque décomposition dans un `<details>` fermé ;
8. rendre la section « Passifs non inclus dans le calcul » depuis
   `facts.passives`.

Les passifs manquants ou incompatibles portent un texte explicite, sans
changer le chiffre principal :

```text
Niveau du passif à renseigner
Niveau du passif invalide
```

- [ ] **Step 8: Brancher le composant dans toutes les vues**

Réutiliser une entrée normalisée :

- `heroCard()` : héros courant du Team Builder ;
- `renderMemberRosterEditor()` : instantané construit depuis le build en cours
  et `potentialTier` ;
- `heroDetail()` : détails d’équipe, roster tiers et archives de boss.

Ne pas dupliquer le calcul dans les vues. `heroDetail()` doit suffire aux
archives qui le réutilisent déjà.

Les aperçus de pièce du lot 2 restent disponibles dans les modales
d’équipement.

- [ ] **Step 9: Ajouter le CSS sans débordement**

Réutiliser les tokens visuels existants. Ajouter au maximum :

```css
.hero-stats-primary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 560px) {
  .hero-stats-primary {
    grid-template-columns: 1fr;
  }
}
```

Tous les descendants de grille pouvant contenir du texte ont `min-width: 0`.
Les descriptions longues utilisent `overflow-wrap: anywhere`. Ne pas ajouter
de défilement horizontal.

- [ ] **Step 10: Rejouer les tests ciblés**

Run:

```powershell
node --test tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: PASS.

- [ ] **Step 11: Commit**

```powershell
git add index.html tests/stats-build.test.js tests/potentiel-commun.playwright.js tests/supabase-etape1.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "feat: afficher les statistiques finales par héros"
```

---

## Task 7: Documenter, vérifier et préparer la mise en service

**Files:**

- Modify: `AGENTS.md`
- Modify if required by cache inventory only: `sw.js`
- Modify if required by test grouping only: `package.json`

- [ ] **Step 1: Mettre à jour la documentation de reprise**

Dans `AGENTS.md` :

- marquer le lot 3A livré ;
- documenter `charactersBySlug` ;
- documenter `calculateHeroStats()` ;
- préciser maîtrise maximale et absence de niveau de personnage ;
- rappeler que le potentiel est commun et s’affiche `P0`–`P10` ;
- documenter les deux plafonds de passif ;
- documenter `passiveLevel` sur `armorConfig`/`jewelConfig` ;
- expliquer la borne inférieure, `coverage` et `uncovered` ;
- rappeler le mode présumé et son protocole ;
- demander de rejouer `supabase/schema.sql` avant le frontend ;
- conserver le lot 3B d’optimisation du recensement comme lot séparé.

- [ ] **Step 2: Vérifier le cache PWA**

`stats-build.js` est déjà une ressource essentielle. Vérifier sans modifier par
réflexe :

```powershell
rg -n "stats-build\\.js" index.html sw.js tests
```

Ne modifier `sw.js` que si le catalogue n’est réellement pas précaché.
`7ds-stats/*.json` ne doit jamais entrer dans `CORE_ASSETS`.

- [ ] **Step 3: Vérifier les artefacts générés et les espaces**

Run:

```powershell
python generate-stats-build.py --check
git diff --check
git status --short
```

Expected:

- aucun fichier généré périmé ;
- aucune erreur d’espace ;
- uniquement les fichiers attendus modifiés.

- [ ] **Step 4: Lancer la suite complète fraîche**

Run:

```powershell
npm test
```

Expected: toutes les suites vertes, y compris :

- générateur et catalogue ;
- calculs unitaires ;
- syntaxe SQL ;
- gardes de conservation ;
- Team Builder et roster ;
- Supabase simulé ;
- mobile/accessibilité ;
- PWA et workflows.

- [ ] **Step 5: Inspecter visuellement les deux largeurs critiques**

Lancer le serveur de test existant utilisé par Playwright, puis vérifier dans
Chromium :

- bureau 1440 px : hiérarchie PV/ATK/DEF, badge de présomption, passifs ;
- mobile 320 px : absence de superposition et de débordement ;
- détails repliés par défaut ;
- `P0`–`P10` partout ;
- aucune présentation « stats du héros » quand la configuration est
  incomplète.

Prendre des captures locales uniquement si elles aident la revue ; ne pas les
committer.

- [ ] **Step 6: Revue finale du contrat**

Relire `docs/superpowers/specs/2026-07-29-stats-builds-lot3a-design.md` et
cocher explicitement :

- 24 personnages rapprochés ;
- cinq entrées de maîtrise par branche, toutes consommées ;
- potentiel commun ;
- neuf équipements obligatoires ;
- reconstruction stricte ;
- formule présumée centralisée ;
- passifs affichés mais non calculés ;
- plafonds 7 et 3 séparés ;
- garde SQL imbriqué ;
- toutes les vues couvertes ;
- aucun total d’équipe ;
- aucune dépendance runtime ajoutée.

- [ ] **Step 7: Commit documentation**

```powershell
git add AGENTS.md
git commit -m "docs: documenter les statistiques finales du héros"
```

- [ ] **Step 8: Préparer le retour arrière**

Avant toute fusion future, relever :

```powershell
git rev-parse main
git log --oneline main..stats-builds-lot3a
```

Le retour arrière prévu est :

1. revert du ou des commits frontend ;
2. redéploiement ;
3. acceptation de la mise à jour PWA ;
4. conservation des gardes SQL.

Les champs `passiveLevel` restent dans les JSONB et réapparaissent lors d’une
réactivation. Aucun rollback SQL destructif n’est nécessaire.

- [ ] **Step 9: Arrêt avant publication**

Présenter :

- les commits ;
- le résultat frais de `npm test` ;
- les écarts éventuels à la spec ;
- la consigne exacte de replay SQL.

Ne pas fusionner et ne pas pousser avant l’accord explicite du propriétaire.
