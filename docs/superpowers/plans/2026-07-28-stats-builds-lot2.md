# Stats de builds — Lot 2 : équipement, gravure et ensembles — Plan d'implémentation

> **Pour l'agent exécutant :** SOUS-COMPÉTENCE REQUISE — utilise
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour implémenter tâche par tâche. Les étapes sont
> des cases à cocher (`- [ ]`).

**Objectif :** permettre au membre de saisir le détail chiffré de ses 4 armures,
3 bijoux et de son équipement gravé, et afficher leur contribution décomposée,
bonus d'ensemble compris.

**Architecture :** le catalogue statique `stats-build.js` gagne les pièces
d'équipement et les ensembles. Un moteur pur, symétrique de celui de l'arme,
transforme `(fichier, config, emplacement)` en termes typés. La saisie réutilise
la modale de configuration existante. Aucune étape de build : tout reste
utilisable en `file://`.

**Pile technique :** HTML/CSS/JS inline dans `index.html`, Python 3 pour les
générateurs, Node `vm` pour les tests unitaires, Playwright pour les parcours,
PostgreSQL/Supabase pour la persistance.

## Global Constraints

- Lire `AGENTS.md` **en entier** avant la première tâche.
- Aucune étape de build. Le site doit fonctionner par double-clic sur
  `index.html`, en `file://`. Pas de modules ES, pas de bundler.
- Toute la logique applicative vit dans le `<script>` principal inline
  d'`index.html`. Les blocs `<script>` de fin de fichier existent parce que le
  bac à sable `vm` ne fournit ni `addEventListener`, ni `matchMedia`, ni
  `requestAnimationFrame`.
- **`index.html` est en CRLF.** Les remplacements multi-lignes en Python échouent
  silencieusement si l'on écrit `\n`. Éditer ligne par ligne.
- **Règle d'or :** aucune liste d'armes, d'armures, d'éléments ou de stats codée
  en dur. Tout dérive de `window.SEVEN_DS_DATA` et de
  `window.SEVEN_DS_BUILD_STATS`. Comparaison des ensembles **par suffixe**, jamais
  par égalité de nom exacte.
- **Les seuils d'ensemble ne sont pas 2 et 4.** Toujours lire `bonusTwoCount` et
  `bonusFourCount`. Un `bonusFourCount` absent signifie pas de second palier.
- Toute fonction pure testée doit être ajoutée à `HOOK_EXPORT` dans
  `tests/helpers/load-app.js`, avec la garde `typeof x === "function" ? x : undefined`.
- Cibles tactiles ≥ 44 px et **`overflow-x:hidden` sur tout conteneur défilant de
  modale**, à 320 et 390 px.
- TDD strict : écrire le test, le voir échouer **pour la bonne raison**, puis
  implémenter au minimum. À chaque tâche, **prouver qu'au moins une assertion
  mord** en cassant volontairement le code visé, puis restaurer.
- Un commit par tâche. Terminer chaque tâche par `npm test`.
- **Ne pousser sur GitHub qu'avec l'autorisation explicite du propriétaire.**

---

## Structure des fichiers

| Fichier | Responsabilité |
| --- | --- |
| `generate-stats-build.py` | Modifier : ajouter les pièces d'équipement, les gravures et les ensembles au catalogue compact |
| `stats-build.js` | Régénéré, jamais édité à la main |
| `7ds-stats/stat-metadata.json` | Modifier : compléter `family` et `unit` des codes de stat propres à l'équipement |
| `index.html` | Modifier : catalogue, modèle, moteur, sélecteur d'ensemble, panneau de saisie |
| `supabase/schema.sql` | Modifier : étendre les deux triggers à `armorConfig` et `jewelConfig` |
| `tests/test_generate_stats_build.py` | Modifier : contrats du générateur étendu |
| `tests/stats-build.test.js` | Modifier : moteur d'équipement, ensembles, reconstruction |
| `tests/stats-build-schema.test.js` | Modifier : forme du catalogue |
| `tests/roster-schema.test.js` | Modifier : gardes SQL des nouvelles configs |
| `tests/potentiel-commun.playwright.js` | Modifier : parcours de saisie d'une pièce |
| `tests/accessibilite-mobile.playwright.js` | Modifier : 44 px et absence de débordement |

---

### Task 1 : Le catalogue d'équipement

**Files:**
- Modify: `generate-stats-build.py`
- Modify: `7ds-stats/stat-metadata.json`
- Test: `tests/test_generate_stats_build.py`, `tests/stats-build-schema.test.js`

**Interfaces:**
- Consomme : `7ds-stats/armures.json`, `armures-gravees.json`, `sets.json`,
  `libelles-stats.json`.
- Produit : dans `window.SEVEN_DS_BUILD_STATS`, trois nouvelles clés —
  `gearByFile`, `engravedByFile`, `gearSets`. Formes exactes :

```js
gearByFile["7ds-armures-ssr/Haut/Nom.webp"] = {
  slug:"...", slot:"Top", grade:"grade5", setId:"equip_t5_x"|null,
  mainStat:"B_Def_Equip", subStat:"C_Critical_ResRate"|null,
  qualityMin:120, qualityMax:160, tierBoundaries:[119], reinforceMax:5,
  mainValues:{base:0,progression:[3073]}, mainAdd:{base:0,progression:[35]},
  subValues:{...}|null, subAdd:{...}|null,
  randomOptions:{slots:1, stats:[{stat:"...",min:0,max:0,chance:0}]}|null
}
engravedByFile["7ds-armures-ssr/Armure liee/Nom.webp"] = { même forme, plus character:"meliodas" }
gearSets["equip_t5_x"] = {
  nameFr:"...", twoCount:3, twoStats:[{stat,value}], fourCount:4|null, fourStats:[{stat,value}]|null
}
```

- [ ] **Step 1 : Écrire les tests rouges du générateur**

Dans `tests/test_generate_stats_build.py` :

```python
class GearCatalogTests(unittest.TestCase):
    def test_gear_entry_keeps_only_numeric_fields(self):
        piece = {
            "slug": "haut-x", "slot": "Top", "grade": "grade5",
            "setId": "equip_t5_x", "mainStat": "B_Def_Equip",
            "subStat": "C_Critical_ResRate", "qualityMin": 120,
            "qualityMax": 160, "tierBoundaries": [119], "reinforceMax": 5,
            "nameFr": "Haut X",
            "growth": {
                "mainStatValues": {"base": 0, "progression": [3073]},
                "mainEquiplvAdd": {"base": 0, "progression": [35]},
                "subStatValues": {"base": 0, "progression": [328]},
                "subEquiplvAdd": {"base": 0, "progression": [4]},
                "randomOptions": {"slots": 1, "stats": [
                    {"key": "TickDam_Rate", "min": 304, "max": 759, "chance": 714}
                ]},
            },
        }
        entry = module.gear_entry(piece)
        self.assertEqual(entry["slot"], "Top")
        self.assertEqual(entry["mainValues"], {"base": 0, "progression": [3073]})
        self.assertEqual(entry["mainAdd"], {"base": 0, "progression": [35]})
        self.assertEqual(
            entry["randomOptions"],
            {"slots": 1, "stats": [
                {"stat": "TickDam_Rate", "min": 304, "max": 759, "chance": 714}
            ]},
        )
        self.assertNotIn("nameFr", entry)

    def test_piece_without_random_options_yields_none(self):
        piece = {
            "slug": "bas-y", "slot": "Bottom", "grade": "grade1",
            "setId": None, "mainStat": "B_Def_Equip", "subStat": None,
            "qualityMin": 1, "qualityMax": 10, "tierBoundaries": [0],
            "reinforceMax": 5,
            "growth": {
                "mainStatValues": {"base": 0, "progression": [10]},
                "mainEquiplvAdd": {"base": 0, "progression": [1]},
            },
        }
        self.assertIsNone(module.gear_entry(piece)["randomOptions"])

    def test_set_thresholds_come_from_the_data(self):
        raw = {
            "gameId": "equip_t4_scale_1", "nameFr": "Cœur ardent",
            "bonusTwoCount": 3, "bonusTwoStats": [{"stat": "A_Accuracy", "value": 30}],
            "bonusFourCount": None, "bonusFourStats": None,
        }
        entry = module.gear_set_entry(raw)
        self.assertEqual(entry["twoCount"], 3)
        self.assertIsNone(entry["fourCount"])
        self.assertIsNone(entry["fourStats"])
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `python -m unittest tests/test_generate_stats_build.py -v`
Expected: FAIL — `module has no attribute 'gear_entry'`.

- [ ] **Step 3 : Compléter les métadonnées de stat**

Lister les codes de stat introduits par l'équipement et les ensembles :

```bash
python - <<'PY'
import json
codes=set()
def walk(n):
    if isinstance(n,list):
        for i in n: walk(i)
    elif isinstance(n,dict):
        for k in ("stat","key","abilityType","mainStat","subStat"):
            v=n.get(k)
            if isinstance(v,str) and v: codes.add(v)
        for v in n.values(): walk(v)
for f in ("armures.json","armures-gravees.json","sets.json"):
    walk(json.load(open("7ds-stats/"+f,encoding="utf-8")))
known=set(json.load(open("7ds-stats/stat-metadata.json",encoding="utf-8")))
print(sorted(codes-known))
PY
```

Pour **chaque** code manquant, ajouter dans `7ds-stats/stat-metadata.json` une
entrée `{"family":…, "unit":"flat"|"ten-thousandths"}`. Un code en `_Rate` est en
dix-millièmes ; les codes `B_*_Equip` sont `flat`. Familles autorisées : celles
déjà présentes dans le fichier — ne pas en inventer.

⚠️ `buildStatMetadata()` **lève** `BUILD_STAT_METADATA_MISSING` sur un code
inconnu. Un oubli ici fera échouer le moteur à l'exécution, pas à la génération.

- [ ] **Step 4 : Implémenter les trois fonctions du générateur**

```python
def _curve(block):
    if not block or not isinstance(block.get("progression"), list):
        return None
    return {"base": block.get("base") or 0, "progression": list(block["progression"])}


def _random_options(growth):
    options = (growth or {}).get("randomOptions") or {}
    stats = options.get("stats") or []
    if not stats:
        return None
    return {
        "slots": options.get("slots") or 0,
        "stats": [
            {"stat": s["key"], "min": s["min"], "max": s["max"],
             "chance": s.get("chance") or 0}
            for s in stats
        ],
    }


def gear_entry(piece):
    growth = piece.get("growth") or {}
    return {
        "slug": piece.get("slug"),
        "slot": piece.get("slot"),
        "grade": piece.get("grade"),
        "setId": piece.get("setId") or None,
        "mainStat": piece.get("mainStat"),
        "subStat": piece.get("subStat") or None,
        "qualityMin": piece.get("qualityMin"),
        "qualityMax": piece.get("qualityMax"),
        "tierBoundaries": list(piece.get("tierBoundaries") or []),
        "reinforceMax": piece.get("reinforceMax"),
        "mainValues": _curve(growth.get("mainStatValues")),
        "mainAdd": _curve(growth.get("mainEquiplvAdd")),
        "subValues": _curve(growth.get("subStatValues")),
        "subAdd": _curve(growth.get("subEquiplvAdd")),
        "randomOptions": _random_options(growth),
    }


def gear_set_entry(raw):
    return {
        "nameFr": raw.get("nameFr"),
        "twoCount": raw.get("bonusTwoCount"),
        "twoStats": raw.get("bonusTwoStats") or None,
        "fourCount": raw.get("bonusFourCount"),
        "fourStats": raw.get("bonusFourStats") or None,
    }
```

Puis brancher : les pièces sont indexées **par chemin d'image**, retrouvé comme
le fait déjà le générateur pour les armes — par correspondance de nom entre
`nameFr` et le nom de fichier dans `window.SEVEN_DS_DATA`. Une pièce du catalogue
sans image locale est **omise** du résultat, sans erreur. Une image sans pièce
correspondante est **signalée** par `--check`.

- [ ] **Step 5 : Étendre le contrat de forme du catalogue**

Dans `tests/stats-build-schema.test.js`, ajouter : `gearByFile`, `engravedByFile`
et `gearSets` existent ; chaque entrée de `gearByFile` a un `slot` parmi les sept
du jeu ; chaque `setId` non nul existe dans `gearSets` ; chaque entrée de
`engravedByFile` a un `character` non vide ; et **tout code de stat cité** par ces
trois structures existe dans `statLabels`.

- [ ] **Step 6 : Régénérer et vérifier**

Run: `python generate-stats-build.py && python generate-stats-build.py --check && npm run test:unit`
Expected: PASS, et `stats-build.js` régénéré.

Relever la taille : `python -c "import os,gzip;p='stats-build.js';print(round(os.path.getsize(p)/1024,1),'Ko brut,',round(len(gzip.compress(open(p,'rb').read(),6))/1024,1),'Ko gzip')"`.
Si le gzip dépasse **120 Ko**, s'arrêter et le signaler au propriétaire : le
budget de précache devient un sujet.

- [ ] **Step 7 : Prouver qu'une assertion mord**

Faire renvoyer `2` en dur à `gear_set_entry` pour `twoCount`, vérifier que
`test_set_thresholds_come_from_the_data` échoue, restaurer.

- [ ] **Step 8 : Commit**

```bash
git add generate-stats-build.py 7ds-stats/stat-metadata.json stats-build.js tests/test_generate_stats_build.py tests/stats-build-schema.test.js
git commit -m "feat: ajouter equipement, gravures et ensembles au catalogue"
```

---

### Task 2 : Le modèle de configuration d'une pièce

**Files:**
- Modify: `index.html` (près de `emptyWeaponConfig`, ~ligne 2468)
- Modify: `tests/helpers/load-app.js`
- Test: `tests/stats-build.test.js`

**Interfaces:**
- Consomme : `gearByFile`, `engravedByFile` (Task 1).
- Produit :
  - `buildGearDefinition(file)` → l'entrée de catalogue ou `null` ;
  - `emptyGearConfig(file)` → `{version:1, level:qualityMin, reinforce:0, enchantments:[…nulls]}` ou `null` ;
  - `gearConfigStatus(file, config)` → `"unavailable" | "missing" | "incomplete" | "incompatible" | "valid"`.

- [ ] **Step 1 : Écrire les tests rouges**

Dans `tests/stats-build.test.js` :

```js
{
  const { hooks } = loadApp();
  const FILE = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const definition = hooks.buildGearDefinition(FILE);
  assert.ok(definition, "la pièce doit exister au catalogue");

  assert.strictEqual(hooks.gearConfigStatus(FILE, undefined), "missing");
  assert.strictEqual(hooks.gearConfigStatus("7ds-armures-ssr/Haut/inconnu.webp", null), "unavailable");

  const base = hooks.emptyGearConfig(FILE);
  assert.strictEqual(base.level, definition.qualityMin);
  assert.strictEqual(base.reinforce, 0);
  assert.strictEqual(hooks.gearConfigStatus(FILE, base), "valid");

  // Niveau hors bornes de qualité.
  assert.strictEqual(
    hooks.gearConfigStatus(FILE, { ...base, level: definition.qualityMax + 1 }),
    "incompatible"
  );
  assert.strictEqual(hooks.gearConfigStatus(FILE, { ...base, level: definition.qualityMin - 1 }), "incompatible");
  // Renforcement hors 0..reinforceMax.
  assert.strictEqual(hooks.gearConfigStatus(FILE, { ...base, reinforce: definition.reinforceMax + 1 }), "incompatible");
  assert.strictEqual(hooks.gearConfigStatus(FILE, { ...base, reinforce: -1 }), "incompatible");
  // Version inconnue.
  assert.strictEqual(hooks.gearConfigStatus(FILE, { ...base, version: 2 }), "incompatible");
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/stats-build.test.js`
Expected: FAIL — `hooks.buildGearDefinition is not a function`.

- [ ] **Step 3 : Implémenter**

```js
  const BUILD_GEAR = BUILD_STATS.gearByFile || {};
  const BUILD_ENGRAVED = BUILD_STATS.engravedByFile || {};
  function buildGearDefinition(file){
    if(typeof file !== "string" || !file) return null;
    if(owns(BUILD_GEAR, file)) return BUILD_GEAR[file];
    if(owns(BUILD_ENGRAVED, file)) return BUILD_ENGRAVED[file];
    return null;
  }
  function gearEnchantmentLength(definition){
    const options = definition && definition.randomOptions;
    return options && Number.isFinite(options.slots) ? options.slots : 0;
  }
  function emptyGearConfig(file){
    const definition = buildGearDefinition(file);
    if(!definition) return null;
    return {
      version:1,
      level:definition.qualityMin,
      reinforce:0,
      enchantments:Array.from({length:gearEnchantmentLength(definition)}, ()=>null)
    };
  }
  function gearConfigStatus(file, config){
    const definition = buildGearDefinition(file);
    if(!definition) return "unavailable";
    if(!definition.mainValues || !definition.mainAdd) return "unavailable";
    if(config === undefined || config === null) return "missing";
    if(typeof config !== "object" || Array.isArray(config) || config.version !== 1){
      return "incompatible";
    }
    const required = ["level", "reinforce", "enchantments"];
    if(required.some(key => !owns(config, key) || config[key] === null)) return "incomplete";
    if(!isInteger(config.level) || !isInteger(config.reinforce)) return "incompatible";
    if(config.level < definition.qualityMin || config.level > definition.qualityMax){
      return "incompatible";
    }
    if(config.reinforce < 0 || config.reinforce > definition.reinforceMax){
      return "incompatible";
    }
    if(!Array.isArray(config.enchantments)) return "incompatible";
    const length = gearEnchantmentLength(definition);
    if(config.enchantments.length > length) return "incompatible";
    const status = gearEnchantmentsStatus(definition, config.enchantments);
    if(status === "incompatible") return "incompatible";
    if(config.enchantments.length < length) return "incomplete";
    return status;
  }
```

`gearEnchantmentsStatus(definition, enchantments)` suit **exactement** la logique
de `enchantmentsStatus` du lot 1 : une entrée `null` est valide, une entrée dont
la stat n'est pas dans `randomOptions.stats` est `incompatible`, une entrée sans
valeur est `incomplete`, une valeur hors `[min, max]` est `incompatible`. La même
stat ne peut pas occuper deux emplacements de la même pièce.

- [ ] **Step 4 : Exposer les hooks**

Ajouter `buildGearDefinition`, `emptyGearConfig`, `gearConfigStatus` à
`HOOK_EXPORT` dans `tests/helpers/load-app.js`, avec la garde `typeof`.

- [ ] **Step 5 : Vérifier et prouver**

Run: `node tests/stats-build.test.js` → PASS.
Puis supprimer la borne haute de qualité, vérifier l'échec, restaurer.

- [ ] **Step 6 : Commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: modeliser la configuration d'une piece d'equipement"
```

---

### Task 3 : La valeur d'une stat à un niveau donné

**Files:**
- Modify: `index.html`
- Modify: `tests/helpers/load-app.js`
- Test: `tests/stats-build.test.js`

**Interfaces:**
- Produit :
  - `ARMOR_LEVEL_ORIGIN_MODE` — constante, `"segment-lower-bound"` ;
  - `gearSegmentCount(definition)` → `max(1, len(tierBoundaries) − 1)` ;
  - `gearSegmentIndex(definition, level)` → indice de segment, borné ;
  - `gearLevelOrigin(definition, index)` → niveau d'origine du segment ;
  - `gearStatValue(definition, curve, add, level, reinforce)` → nombre entier ;
  - `REINFORCE_PROGRESSION` — `[10300, 10700, 11200, 11800, 12500]` ;
  - `reinforceMultiplier(level)` → `1` à 0, sinon `progression[level-1]/10000`.

- [ ] **Step 1 : Écrire les tests rouges**

```js
{
  const { hooks } = loadApp();
  // Segments : max(1, bornes - 1), verifie sur 1156 blocs du catalogue.
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[119] }), 1);
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[60, 70] }), 1);
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[95, 112, 119, 125] }), 3);
  assert.strictEqual(hooks.gearSegmentCount({ tierBoundaries:[] }), 1);

  // Renforcement : constante universelle des armures.
  assert.deepStrictEqual(
    [0, 1, 2, 3, 4, 5].map(hooks.reinforceMultiplier),
    [1, 1.03, 1.07, 1.12, 1.18, 1.25]
  );

  // Valeur : base du segment + gain par niveau depuis l'origine, puis renfort.
  const definition = {
    tierBoundaries:[119], qualityMin:120, qualityMax:160, reinforceMax:5
  };
  const curve = { base:0, progression:[3073] };
  const add = { base:0, progression:[35] };
  assert.strictEqual(hooks.gearStatValue(definition, curve, add, 120, 0), 3073);
  assert.strictEqual(hooks.gearStatValue(definition, curve, add, 160, 0), 3073 + 35 * 40);
  assert.strictEqual(
    hooks.gearStatValue(definition, curve, add, 120, 5),
    Math.round(3073 * 1.25)
  );
  // Le mode d'origine est une hypothese nommee, pas une valeur dispersee.
  assert.strictEqual(hooks.ARMOR_LEVEL_ORIGIN_MODE, "segment-lower-bound");
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/stats-build.test.js`
Expected: FAIL — `hooks.gearSegmentCount is not a function`.

- [ ] **Step 3 : Implémenter**

```js
  /* PRÉSUMÉ, NON VÉRIFIÉ :
   * le gain par niveau d'une pièce part de la borne basse de son segment.
   *
   * Vérification en jeu : relever la stat principale d'une pièce à deux niveaux
   * du même segment et comparer l'écart au gain par niveau annoncé. Si l'écart
   * vaut (niveau − borne) × gain, ce mode est le bon. Sinon, remplacer
   * uniquement "segment-lower-bound" par "quality-min".
   *
   * Aucune autre partie du calcul ne connaît cette hypothèse. */
  const ARMOR_LEVEL_ORIGIN_MODE = "segment-lower-bound";
  const REINFORCE_PROGRESSION = [10300, 10700, 11200, 11800, 12500];
  function reinforceMultiplier(level){
    const step = Math.trunc(Number(level) || 0);
    if(step <= 0) return 1;
    const rate = REINFORCE_PROGRESSION[step - 1];
    return rate ? rate / 10000 : 1;
  }
  function gearSegmentCount(definition){
    const bounds = (definition && definition.tierBoundaries) || [];
    return Math.max(1, bounds.length - 1);
  }
  function gearSegmentIndex(definition, level){
    const bounds = (definition && definition.tierBoundaries) || [];
    const count = gearSegmentCount(definition);
    let index = 0;
    for(let i = 1; i < bounds.length; i += 1){
      if(level > bounds[i]) index = i;
    }
    return Math.min(index, count - 1);
  }
  function gearLevelOrigin(definition, index){
    const bounds = (definition && definition.tierBoundaries) || [];
    if(ARMOR_LEVEL_ORIGIN_MODE === "quality-min") return definition.qualityMin;
    const bound = bounds.length > 1 ? bounds[index] : bounds[0];
    return Number.isFinite(bound) ? bound + 1 : definition.qualityMin;
  }
  function gearStatValue(definition, curve, add, level, reinforce){
    if(!curve || !Array.isArray(curve.progression)) return 0;
    const index = gearSegmentIndex(definition, level);
    const origin = gearLevelOrigin(definition, index);
    const base = Number(curve.progression[index]) || Number(curve.base) || 0;
    const perLevel = add && Array.isArray(add.progression)
      ? Number(add.progression[index]) || 0
      : 0;
    const steps = Math.max(0, Math.trunc(level) - origin);
    return Math.round((base + perLevel * steps) * reinforceMultiplier(reinforce));
  }
```

- [ ] **Step 4 : Exposer les hooks et vérifier**

Ajouter `ARMOR_LEVEL_ORIGIN_MODE`, `REINFORCE_PROGRESSION`,
`reinforceMultiplier`, `gearSegmentCount`, `gearSegmentIndex`,
`gearLevelOrigin`, `gearStatValue` à `HOOK_EXPORT`.

Run: `node tests/stats-build.test.js` → PASS.

- [ ] **Step 5 : Prouver que le mode est bien centralisé**

Basculer `ARMOR_LEVEL_ORIGIN_MODE` sur `"quality-min"` : les tests de valeur
doivent changer de résultat **sans** qu'aucun autre test de format échoue.
Restaurer ensuite. Consigner le résultat observé dans le rapport de tâche.

- [ ] **Step 6 : Commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: calculer la valeur d'une stat d'equipement par segment"
```

---

### Task 4 : La contribution décomposée d'une pièce

**Files:**
- Modify: `index.html` (près de `calculateWeaponStats`, ~ligne 2831)
- Modify: `tests/helpers/load-app.js`
- Test: `tests/stats-build.test.js`

**Interfaces:**
- Consomme : `gearConfigStatus`, `gearStatValue` (Tasks 2-3),
  `addWeaponStatTerm`, `buildStatMetadata`, `reconstructStatTotals` (lot 1).
- Produit : `calculateGearStats(file, config, slotKey)` → même forme que
  `calculateWeaponStats` : `{version:1, status, coverage, assumptions, terms, totals, facts}`.

- [ ] **Step 1 : Écrire les tests rouges**

```js
{
  const { hooks } = loadApp();
  const FILE = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const definition = hooks.buildGearDefinition(FILE);
  const config = hooks.emptyGearConfig(FILE);

  const result = hooks.calculateGearStats(FILE, config, "Haut");
  assert.strictEqual(result.status, "valid");
  assert.deepStrictEqual(result.coverage, ["armor"]);
  assert.strictEqual(result.assumptions.armorLevelOrigin, "segment-lower-bound");

  // Un terme par stat native, dans le seau de l'emplacement.
  const buckets = [...new Set(result.terms.map(term => term.bucket))];
  assert.deepStrictEqual(buckets, ["armor:Haut"]);
  result.terms.forEach(term => {
    assert.ok(term.unit === "flat" || term.unit === "ten-thousandths", "unite obligatoire");
    assert.strictEqual(term.operation, "add");
    assert.strictEqual(term.confidence, "presumed");
    assert.strictEqual(term.source.domain, "armor");
  });

  // La reconstruction redonne le total.
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(result.terms)),
    plain(result.totals)
  );

  // Une piece sans options aleatoires n'emet aucun terme d'enchantement,
  // et reste declaree couverte : pas de faux zero.
  const sansOptions = Object.entries(hooks.buildGearCatalog())
    .find(([, item]) => !item.randomOptions);
  assert.ok(sansOptions, "il existe des pieces sans options aleatoires");
  const plain2 = hooks.calculateGearStats(
    sansOptions[0], hooks.emptyGearConfig(sansOptions[0]), sansOptions[1].slot
  );
  assert.deepStrictEqual(plain2.coverage, ["armor"]);
  assert.strictEqual(
    plain2.terms.some(term => term.source.component === "enchantment"),
    false
  );

  // Statut non valide : aucun terme, aucun total.
  const invalide = hooks.calculateGearStats(FILE, { ...config, level:9999 }, "Haut");
  assert.strictEqual(invalide.status, "incompatible");
  assert.deepStrictEqual(invalide.terms, []);
  assert.deepStrictEqual(invalide.totals, []);
  assert.deepStrictEqual(invalide.coverage, []);
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/stats-build.test.js`
Expected: FAIL — `hooks.calculateGearStats is not a function`.

- [ ] **Step 3 : Implémenter**

Structure imposée, sur le modèle de `calculateWeaponStats` :

```js
  function gearDomainOf(slotKey){
    return JEWEL_SLOTS.indexOf(slotKey) >= 0
      ? "jewel"
      : (slotKey === "Armure liee" ? "engraving" : "armor");
  }
  function addGearStatTerm(terms, settings){
    if(settings.value === 0) return;
    const metadata = buildStatMetadata(settings.stat);
    terms.push({
      id:settings.id,
      stat:settings.stat,
      operation:"add",
      value:settings.value,
      unit:metadata.unit,
      bucket:settings.bucket,
      family:metadata.family,
      source:settings.source,
      confidence:settings.confidence
    });
  }
  function calculateGearStats(file, config, slotKey){
    const status = gearConfigStatus(file, config);
    if(status !== "valid"){
      return {
        version:1, status, coverage:[], uncovered:[],
        assumptions:{ armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE },
        terms:[], totals:[], facts:[]
      };
    }
    const definition = buildGearDefinition(file);
    const domain = gearDomainOf(slotKey);
    const bucket = domain + ":" + slotKey;
    const terms = [];
    addGearStatTerm(terms, {
      id:bucket + ":main:" + definition.mainStat,
      stat:definition.mainStat,
      value:gearStatValue(definition, definition.mainValues, definition.mainAdd,
        config.level, config.reinforce),
      bucket,
      source:{ domain, component:"level", slot:slotKey },
      confidence:"presumed"
    });
    if(definition.subStat && definition.subValues){
      addGearStatTerm(terms, {
        id:bucket + ":sub:" + definition.subStat,
        stat:definition.subStat,
        value:gearStatValue(definition, definition.subValues, definition.subAdd,
          config.level, config.reinforce),
        bucket,
        source:{ domain, component:"level", slot:slotKey },
        confidence:"presumed"
      });
    }
    /* Contributions supplémentaires : 145 sur les équipements gravés. Les
       omettre sous-estimerait chaque gravure. Même forme que la statistique
       principale, un terme par entrée. */
    (definition.extraStats || []).forEach(extra => {
      addGearStatTerm(terms, {
        id:bucket + ":extra:" + extra.stat,
        stat:extra.stat,
        value:gearStatValue(definition, extra.values, extra.add,
          config.level, config.reinforce),
        bucket,
        source:{ domain, component:"level", slot:slotKey, extra:true },
        confidence:"presumed"
      });
    });
    (config.enchantments || []).forEach((choice, index) => {
      if(!choice || !choice.stat) return;
      addGearStatTerm(terms, {
        id:bucket + ":enchantment:" + index + ":" + choice.stat,
        stat:choice.stat,
        value:Number(choice.value) || 0,
        bucket,
        source:{ domain, component:"enchantment", slot:slotKey, index },
        confidence:"exact"
      });
    });
    /* La gravure garde ses contributions numériques calculables, mais son
       passif est en prose : il est déclaré non couvert, jamais omis en
       silence. Les 10 armures portant un `equipPassive` suivent la même
       règle. Sans cette déclaration, l'absence du passif passerait pour
       un vrai zéro. */
    const uncovered = [];
    if(domain === "engraving") uncovered.push("engraving:passive");
    if(definition.equipPassive) uncovered.push("armor:passive");
    return {
      version:1, status:"valid", coverage:[domain], uncovered,
      assumptions:{ armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE },
      terms,
      totals:reconstructStatTotals(terms),
      facts:[]
    };
  }
```

Ajouter aussi `buildGearCatalog()` renvoyant `BUILD_GEAR`, pour que le test
puisse trouver une pièce sans options aléatoires sans coder de nom en dur.

- [ ] **Step 4 : Exposer, vérifier, prouver**

Ajouter `calculateGearStats` et `buildGearCatalog` à `HOOK_EXPORT`.
Run: `node tests/stats-build.test.js` → PASS.
Puis faire renvoyer `confidence:"exact"` aux termes de niveau : le test doit
échouer. Restaurer.

- [ ] **Step 5 : Commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: decomposer la contribution d'une piece d'equipement"
```

---

### Task 5 : Les bonus d'ensemble et l'agrégation du build

**Files:**
- Modify: `index.html`
- Modify: `tests/helpers/load-app.js`
- Test: `tests/stats-build.test.js`

**Interfaces:**
- Consomme : `gearSets` (Task 1), `addGearStatTerm` et `calculateGearStats`
  (Task 4), `calculateWeaponStats` (lot 1).
- Produit :
  - `buildGearSets()` → `BUILD_GEAR_SETS` ;
  - `activeGearSets(files)` → `[{setId, count, twoActive, fourActive, sevenActive}]` ;
  - `gearSetTerms(files)` → tableau de termes, `bucket:"set"`, **pour les trois paliers** ;
  - `calculateBuildStats(build)` → `{version:1, coverage, uncovered, assumptions, terms, totals, statuses}`
    où `statuses` associe chaque source à son statut, et `coverage` ne liste que
    les domaines réellement calculés.

- [ ] **Step 1 : Écrire les tests rouges**

```js
{
  const { hooks } = loadApp();
  const sets = hooks.buildGearSets();
  // Un ensemble dont le premier palier demande 3 pieces : le cas majoritaire.
  const troisPieces = Object.entries(sets).find(([, item]) => item.twoCount === 3);
  assert.ok(troisPieces, "il existe des ensembles a 3 pieces");
  const [setId] = troisPieces;
  const catalog = hooks.buildGearCatalog();
  const pieces = Object.keys(catalog).filter(file => catalog[file].setId === setId);
  assert.ok(pieces.length >= 3, "assez de pieces pour ce test");

  // Deux pieces ne suffisent pas quand le seuil est trois.
  const deux = hooks.activeGearSets(pieces.slice(0, 2));
  assert.strictEqual(deux[0].count, 2);
  assert.strictEqual(deux[0].twoActive, false);
  assert.deepStrictEqual(hooks.gearSetTerms(pieces.slice(0, 2)), []);

  // Trois pieces activent le premier palier.
  const trois = hooks.activeGearSets(pieces.slice(0, 3));
  assert.strictEqual(trois[0].twoActive, true);
  const termes = hooks.gearSetTerms(pieces.slice(0, 3));
  assert.ok(termes.length > 0, "le premier palier doit emettre des termes");
  termes.forEach(term => {
    assert.strictEqual(term.bucket, "set");
    assert.strictEqual(term.source.domain, "set");
    assert.strictEqual(term.confidence, "exact");
  });

  // Un ensemble sans second palier n'en emet jamais.
  const sansSecond = Object.entries(sets).find(([, item]) => item.fourCount === null);
  if(sansSecond){
    const files = Object.keys(catalog).filter(file => catalog[file].setId === sansSecond[0]);
    const etat = hooks.activeGearSets(files);
    assert.strictEqual(etat[0].fourActive, false);
  }

  // Une piece sans ensemble n'apparait pas.
  const orpheline = Object.keys(catalog).find(file => !catalog[file].setId);
  assert.deepStrictEqual(hooks.activeGearSets([orpheline]), []);
}
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/stats-build.test.js`
Expected: FAIL — `hooks.activeGearSets is not a function`.

- [ ] **Step 3 : Implémenter**

```js
  const BUILD_GEAR_SETS = BUILD_STATS.gearSets || {};
  function activeGearSets(files){
    const counts = new Map();
    (files || []).forEach(file => {
      const definition = buildGearDefinition(file);
      const setId = definition && definition.setId;
      if(!setId || !owns(BUILD_GEAR_SETS, setId)) return;
      counts.set(setId, (counts.get(setId) || 0) + 1);
    });
    return [...counts.entries()].map(([setId, count]) => {
      const set = BUILD_GEAR_SETS[setId];
      /* Les seuils viennent TOUJOURS des donnees : `twoCount` vaut 3 dans onze
         ensembles et 4 dans un ; `fourCount` est absent dans cinq. Ecrire 2 et 4
         en dur serait faux pour la majorite. */
      return {
        setId,
        count,
        twoActive:Number.isFinite(set.twoCount) && count >= set.twoCount,
        fourActive:Number.isFinite(set.fourCount) && count >= set.fourCount,
        /* Troisième palier, découvert en mesurant : sept ensembles en ont
           un, dont un à six pièces. Cinq sont référencés par des pièces
           possédées. Ne pas l'oublier. */
        sevenActive:Number.isFinite(set.sevenCount) && count >= set.sevenCount
      };
    });
  }
  function gearSetTerms(files){
    const terms = [];
    activeGearSets(files).forEach(state => {
      const set = BUILD_GEAR_SETS[state.setId];
      const push = (stats, palier) => {
        (stats || []).forEach(entry => addGearStatTerm(terms, {
          id:"set:" + state.setId + ":" + palier + ":" + entry.stat,
          stat:entry.stat,
          value:Number(entry.value) || 0,
          bucket:"set",
          source:{ domain:"set", component:"bonus", setId:state.setId, tier:palier },
          confidence:"exact"
        }));
      };
      if(state.twoActive) push(set.twoStats, "two");
      if(state.fourActive) push(set.fourStats, "four");
      if(state.sevenActive) push(set.sevenStats, "seven");
    });
    return terms;
  }
```

Ajouter aussi l'accès au catalogue d'ensembles et l'agrégation du build :

```js
  function buildGearSets(){ return BUILD_GEAR_SETS; }

  const GEAR_SLOT_DOMAINS = [
    ["armor", ARMOR_SLOTS],
    ["jewel", JEWEL_SLOTS]
  ];
  /* Agrégation : chaque source produit ses termes, puis on reconstruit une
     seule fois. `coverage` ne liste que ce qui a réellement été calculé — c'est
     ce qui permet de distinguer un vrai zéro d'une source non couverte.
     `uncovered` cumule les manques connus de chaque source : le total reste
     alors une borne inférieure, et l'interface doit le dire. */
  function calculateBuildStats(build){
    const terms = [];
    const statuses = {};
    const coverage = [];
    /* Les manques connus de chaque source se cumulent : sans cette
       collecte, le resultat global perdrait tous les avertissements et
       presenterait une borne inferieure comme un total. */
    const uncovered = [];
    const noteUncovered = list => {
      (list || []).forEach(entry => {
        if(!uncovered.includes(entry)) uncovered.push(entry);
      });
    };
    const assumptions = {
      overlimitBase:OVERLIMIT_APPLICATION_MODE,
      armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE
    };
    const weapon = calculateWeaponStats(build.weapon, build.weaponConfig);
    statuses.weapon = weapon.status;
    if(weapon.status === "valid"){
      terms.push(...weapon.terms);
      coverage.push("weapon");
      noteUncovered(weapon.uncovered);
    }
    const equipped = [];
    GEAR_SLOT_DOMAINS.forEach(([domain, slots]) => {
      let covered = false;
      slots.forEach(slotKey => {
        const file = (build[domain] || {})[slotKey];
        if(!file) return;
        equipped.push(file);
        const configs = build[domain + "Config"] || {};
        const result = calculateGearStats(file, configs[slotKey], slotKey);
        statuses[domain + ":" + slotKey] = result.status;
        if(result.status !== "valid") return;
        terms.push(...result.terms);
        noteUncovered(result.uncovered);
        covered = true;
      });
      if(covered) coverage.push(domain);
    });
    const setTerms = gearSetTerms(equipped);
    if(setTerms.length){
      terms.push(...setTerms);
      coverage.push("set");
    }
    return {
      version:1,
      coverage,
      uncovered,
      assumptions,
      terms,
      totals:reconstructStatTotals(terms),
      statuses
    };
  }
```

⚠️ `ARMOR_SLOTS` contient `"Armure liee"`, dont le domaine est `"engraving"` et
non `"armor"` — `gearDomainOf` s'en charge déjà, mais la couverture doit alors
lister `"engraving"`. Ajouter dans `calculateBuildStats` : le domaine poussé dans
`coverage` est celui renvoyé par `gearDomainOf(slotKey)`, pas celui de la boucle.

- [ ] **Step 4 : Tester l'agrégation**

```js
{
  const { hooks } = loadApp();
  const vide = hooks.calculateBuildStats({ weapon:null, armor:{}, jewel:{} });
  assert.deepStrictEqual(vide.coverage, [], "rien d'equipe, rien de couvert");
  assert.deepStrictEqual(vide.terms, []);
  assert.strictEqual(vide.assumptions.armorLevelOrigin, "segment-lower-bound");
  assert.strictEqual(vide.assumptions.overlimitBase !== undefined, true);

  const FILE = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
  const avec = hooks.calculateBuildStats({
    weapon:null, armor:{ Haut:FILE }, jewel:{},
    armorConfig:{ Haut:hooks.emptyGearConfig(FILE) }
  });
  assert.deepStrictEqual(avec.coverage, ["armor"]);
  assert.strictEqual(avec.statuses["armor:Haut"], "valid");
  // La reconstruction du build entier reste egale a la somme de ses termes.
  assert.deepStrictEqual(
    plain(hooks.reconstructStatTotals(avec.terms)),
    plain(avec.totals)
  );

  // Une piece equipee sans config est signalee, pas silencieusement ignoree.
  const sansConfig = hooks.calculateBuildStats({
    weapon:null, armor:{ Haut:FILE }, jewel:{}
  });
  assert.strictEqual(sansConfig.statuses["armor:Haut"], "missing");
  assert.deepStrictEqual(sansConfig.coverage, []);
}
```

- [ ] **Step 5 : Exposer, vérifier, prouver**

Ajouter `activeGearSets`, `gearSetTerms`, `buildGearSets`, `calculateBuildStats`
à `HOOK_EXPORT`.
Run: `node tests/stats-build.test.js` → PASS.

Deux preuves par mutation, toutes deux à consigner :

1. remplacer `count >= set.twoCount` par `count >= 2` : le test des trois pièces
   doit échouer. **C'est la preuve la plus importante de ce lot.**
2. faire pousser `"armor"` dans `coverage` même quand le statut n'est pas
   `valid` : le test « une pièce équipée sans config » doit échouer.

- [ ] **Step 6 : Commit**

```bash
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: bonus d'ensemble et agregation du build"
```

---

### Task 6 : Protéger les nouvelles configs en base

**Files:**
- Modify: `supabase/schema.sql`
- Test: `tests/roster-schema.test.js`

**Interfaces:**
- Consomme : les deux fonctions `private.preserve_roster_weapon_configs` et
  `private.preserve_team_weapon_configs` du lot 1.
- Produit : les mêmes fonctions, étendues à `armorConfig` et `jewelConfig`.

- [ ] **Step 1 : Écrire le contrat rouge**

Dans `tests/roster-schema.test.js`, ajouter des assertions de texte sur
`supabase/schema.sql` : les deux fonctions citent `armorConfig` **et**
`jewelConfig` ; elles conservent une config seulement si la pièce équipée est
inchangée ; elles portent toujours `set search_path` ; et les triggers restent
précédés d'un `drop trigger if exists`.

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/roster-schema.test.js`
Expected: FAIL — `armorConfig` absent du fichier.

- [ ] **Step 3 : Implémenter**

Dans chaque fonction, remplacer la préservation unique de `weaponConfig` par une
boucle sur les trois clés de config. Pour `armorConfig` et `jewelConfig`, la
comparaison se fait **par emplacement** : on ne conserve
`armorConfig->'Haut'` que si `armor->>'Haut'` est identique entre `old` et `new`
et non vide.

- [ ] **Step 4 : Vérifier**

Run: `npm run test:unit` → PASS.

- [ ] **Step 5 : Prouver**

Retirer `jewelConfig` de l'une des deux fonctions, vérifier l'échec du contrat,
restaurer.

- [ ] **Step 6 : Commit et signalement**

```bash
git add supabase/schema.sql tests/roster-schema.test.js
git commit -m "feat: proteger armorConfig et jewelConfig des anciennes PWA"
```

Signaler au propriétaire dans le rapport de tâche : **le contenu complet de
`supabase/schema.sql` doit être rejoué dans l'éditeur SQL Supabase avant le
déploiement.** Le script est idempotent.

---

### Task 7 : La saisie d'une pièce

**Files:**
- Modify: `index.html` (modale de configuration, ~lignes 1686 et 3410-3560)
- Test: `tests/potentiel-commun.playwright.js`

**Interfaces:**
- Consomme : `emptyGearConfig`, `gearConfigStatus`, `calculateGearStats`,
  `gearSetTerms`.
- Produit : un bouton `.gear-config-open` sur chaque emplacement configurable, et
  une modale `#gearConfigOverlay` réutilisant `weaponConfigField`,
  `weaponConfigOption` et `ModalStack`.

- [ ] **Step 1 : Écrire le parcours rouge**

Dans `tests/potentiel-commun.playwright.js`, à la suite du parcours d'arme
existant :

```js
  // Saisie d'une piece d'equipement, de bout en bout.
  const heroSlot = page.locator(".hero").first();
  await heroSlot.locator('.gear-slot[data-slot="Haut"]').click();
  await page.locator("#pickerGrid .tile").first().click();
  const gearConfigButton = heroSlot.locator('.gear-config-open[data-slot="Haut"]');
  assert.equal(await gearConfigButton.count(), 1, "un bouton de configuration par piece");
  await gearConfigButton.click();
  await page.locator("#gearConfigOverlay").waitFor({ state:"visible" });

  const levelInput = page.locator(".gear-config-level");
  const minimum = Number(await levelInput.getAttribute("min"));
  const maximum = Number(await levelInput.getAttribute("max"));
  assert.ok(maximum > minimum, "les bornes de qualite doivent venir de la piece");
  await levelInput.fill(String(maximum));
  await page.locator(".gear-config-reinforce").selectOption("5");
  await page.locator("#gearConfigPreview .weapon-stats-family").first()
    .waitFor({ state:"visible" });
  const preview = await page.locator("#gearConfigPreview").innerText();
  assert.match(preview, /calcul partiel/, "le total doit rester annonce comme partiel");
  assert.match(preview, /\d/, "la contribution doit afficher des chiffres");

  // Un niveau hors bornes n'est pas enregistrable et recoit le focus.
  await levelInput.fill(String(maximum + 1));
  await page.locator("#gearConfigSave").click();
  assert.equal(
    await page.locator("#gearConfigOverlay").getAttribute("aria-hidden"),
    "false",
    "une configuration invalide ne doit pas etre enregistree"
  );
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.classList.contains("gear-config-level")
    ),
    true,
    "le premier champ invalide doit recevoir le focus"
  );
  await levelInput.fill(String(maximum));
  await page.locator("#gearConfigSave").click();
  await page.locator("#gearConfigOverlay").waitFor({ state:"hidden" });
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.classList.contains("gear-config-open")
    ),
    true,
    "fermer doit rendre le focus au bouton exact qui a ouvert"
  );
```

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/potentiel-commun.playwright.js`
Expected: FAIL — `.gear-config-open` introuvable.

- [ ] **Step 3 : Implémenter**

Ajouter le balisage de la modale à côté de `#weaponConfigOverlay` (~ligne 1686) :

```html
<div class="overlay" id="gearConfigOverlay" role="dialog" aria-modal="true"
     aria-labelledby="gearConfigTitle" aria-hidden="true">
  <div class="modal weapon-config-modal">
    <div class="picker-head">
      <span class="picker-title" id="gearConfigTitle">Configurer la pièce</span>
      <button class="icon-btn" id="gearConfigClose" type="button"
              aria-label="Fermer">×</button>
    </div>
    <div class="weapon-config-layout">
      <div id="gearConfigBody"></div>
      <aside id="gearConfigPreview"></aside>
    </div>
    <div class="picker-foot">
      <button class="btn" id="gearConfigCancel" type="button">Annuler</button>
      <button class="btn btn-primary" id="gearConfigSave" type="button">Enregistrer</button>
    </div>
  </div>
</div>
```

Le rendu réutilise `weaponConfigField`, `weaponConfigOption` et `ModalStack.open`.
Le corps contient : un `input[type=number].gear-config-level` dont `min` et `max`
viennent de `qualityMin`/`qualityMax` de la pièce, un `select.gear-config-reinforce`
de 0 à `reinforceMax`, puis un bloc par emplacement d'option aléatoire — stat et
valeur, sur le modèle exact de la perle du lot 1, doublon de stat interdit.

L'aperçu affiche `calculateGearStats(...)` regroupé par famille de stat, avec le
titre **« Apport de l'équipement — calcul partiel »**.

Contraintes non négociables :

- le conteneur défilant de la modale porte **`overflow-y:auto; overflow-x:hidden`** ;
- les `<select>` portent `width:100%; min-width:0; max-width:100%; text-overflow:ellipsis`
  — Safari ne rétrécit pas un `<select>` sous sa plus longue option ;
- chaque contrôle mesure au moins 44 px de haut en pointeur grossier ;
- le titre suit **`uncovered`**, pas `coverage` : vide → « calcul partiel » ;
  contenant une entree de passif → **« Apport de l'equipement hors passif —
  borne inferieure »** ; non vide autrement → « borne inferieure ». Le test
  doit lire le TEXTE affiche, pas seulement le resultat du moteur.

- [ ] **Step 4 : Vérifier**

Run: `node tests/potentiel-commun.playwright.js` → PASS.

- [ ] **Step 5 : Commit**

```bash
git add index.html tests/potentiel-commun.playwright.js
git commit -m "feat: saisir le detail chiffre d'une piece d'equipement"
```

---

### Task 8 : Persistance, mobile et documentation

**Files:**
- Modify: `index.html` (roster et Team Builder)
- Modify: `AGENTS.md`
- Test: `tests/supabase-etape1.playwright.js`, `tests/accessibilite-mobile.playwright.js`

**Interfaces:**
- Consomme : tout ce qui précède.
- Produit : `armorConfig` et `jewelConfig` persistés et synchronisés, comme
  `weaponConfig`.

- [ ] **Step 1 : Écrire les tests rouges**

Dans `tests/supabase-etape1.playwright.js` : une config d'armure saisie est
enregistrée dans `roster_characters.builds`, survit à un rechargement, et est
copiée telle quelle vers le Team Builder puis vers un instantané de boss.

Dans `tests/accessibilite-mobile.playwright.js`, à 320 et 390 px, avec **toutes**
les pièces configurées : chaque contrôle mesure 44 px, `overflow-x` du conteneur
de la modale vaut `hidden`, et aucun élément ne dépasse la largeur de son
conteneur.

- [ ] **Step 2 : Vérifier l'échec**

Run: `node tests/supabase-etape1.playwright.js`
Expected: FAIL — `armorConfig` absent de la ligne enregistrée.

- [ ] **Step 3 : Implémenter**

Propager `armorConfig` et `jewelConfig` dans `normalizeRosterBuild`,
`rosterHeroSnapshot`, `normalizeHero`, `normalizeTeam` et les instantanés de
boss, **exactement** comme `weaponConfig` du lot 1. Changer une pièce équipée
efface sa config.

- [ ] **Step 4 : Documenter**

Dans `AGENTS.md`, ajouter une section « Stats de builds — lot 2 » : la
correspondance des emplacements, le fait que « Armure liée » est l'équipement
gravé, la règle de segmentation `max(1, len(tierBoundaries) − 1)`, la constante
de renforcement, **et en avertissement encadré que les seuils d'ensemble ne sont
pas 2 et 4**. Mentionner `ARMOR_LEVEL_ORIGIN_MODE` comme présomption à vérifier.

- [ ] **Step 5 : Vérifier l'ensemble**

Run: `npm test`
Expected: toutes les suites PASS.
Puis `git diff --check` et `git status --short`.

- [ ] **Step 6 : Commit**

```bash
git add index.html AGENTS.md tests/supabase-etape1.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "feat: persister et documenter les configs d'equipement"
```

---

## Rapport final attendu

À la fin des huit tâches, présenter au propriétaire :

1. les fonctionnalités livrées, en une ligne chacune ;
2. la liste des commits ;
3. le résultat de `npm test` ;
4. les écarts au plan, s'il y en a ;
5. **le rappel que `supabase/schema.sql` doit être rejoué** avant le déploiement ;
6. **la présomption `ARMOR_LEVEL_ORIGIN_MODE`** et son protocole de vérification
   en jeu, puisque c'est le propriétaire qui la tranchera ;
7. la taille gzippée de `stats-build.js`, pour surveiller le budget de précache.
