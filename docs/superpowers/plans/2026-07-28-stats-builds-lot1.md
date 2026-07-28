# Stats de builds — Lot 1 : arme de bout en bout — Plan d’implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque membre de configurer précisément une arme dans son roster ou une équipe et d’afficher un apport partiel intégralement reconstructible depuis des termes typés, sans faux total pour les anciens builds.

**Architecture:** Les paramètres saisis vivent dans les JSONB existants sous `weaponConfig`; les résultats sont recalculés dans le navigateur depuis un catalogue compact généré, `stats-build.js`. Le moteur renvoie `coverage`, une liste de termes additifs ou multiplicatifs munis d’une unité et des totaux strictement dérivés de ces termes. Un panneau dédié commun au roster et au Team Builder consomme ce contrat, tandis que deux triggers Supabase préservent le nouveau champ face aux anciennes PWA.

**Tech Stack:** HTML/CSS/JavaScript sans build, Python 3 standard library, Supabase PostgreSQL/RLS/Realtime, Node.js tests, Playwright Chromium, service worker PWA.

## Global Constraints

- Lire intégralement `AGENTS.md`, la spec `docs/superpowers/specs/2026-07-28-stats-builds-lot1-design.md` et la passation `docs/superpowers/specs/2026-07-28-stats-builds-passation.md` avant toute modification.
- Utiliser `superpowers:using-git-worktrees` avant l’exécution et créer le repère local annoté `backup-before-stats-builds-lot1-2026-07-28` sur la base validée.
- Ne jamais appeler `/api/` de 7dsorigin.app. `generate-stats-build.py` consomme uniquement les fichiers locaux `7ds-stats/*.json` et les assets locaux.
- Ne jamais coder en dur une liste d’armes ou de fichiers image. Le générateur scanne `7ds-armes/<type>/*.webp`.
- Conserver l’application utilisable en `file://`, sans module ES, bundler, serveur ou dépendance runtime npm.
- Conserver la logique applicative dans le script principal inline d’`index.html`; seuls les fichiers de données générés restent externes.
- Conserver le français dans l’interface, le thème héraldique existant, les cibles tactiles de 44 × 44 px et l’absence de débordement horizontal entre 320 et 390 px.
- Ne jamais afficher un total lorsque `weaponConfig` est absent, incomplet, incompatible ou indisponible ; le moteur renvoie alors `coverage:[]`, `terms:[]` et `totals:[]`.
- Chaque terme porte obligatoirement `unit:"flat"` ou `unit:"ten-thousandths"`. Ne jamais déduire cette unité du nom du code ni du drapeau `taux` incomplet de `libelles-stats.json`.
- Stocker les taux comme entiers en dix-millièmes. `787` s’affiche `7,87 %`.
- Appliquer `overlimit.statRate` comme multiplicateur de chaque statistique native de l’arme avant les enchantements. La base est présumée et pilotée uniquement par `OVERLIMIT_APPLICATION_MODE`.
- Le commentaire de `OVERLIMIT_APPLICATION_MODE` doit contenir « PRÉSUMÉ, NON VÉRIFIÉ » et le protocole : relever l’ATK à outrepassement 0 puis 1 sur une arme enchantée.
- La sortie canonique contient `coverage:["weapon"]` uniquement pour une configuration valide, des `terms`, des `totals` reconstructibles et `assumptions.overlimitBase`.
- Aucun terme ne peut utiliser `stat:"*"`. L’outrepassement émet un terme `multiply` concret par statistique affectée.
- Chaque terme déclare `operation`, `unit`, `confidence` et une provenance structurée ; aucun consommateur ne déduit ces propriétés du code de stat.
- La reconstruction est pilotée par `bucket` et `appliesTo`, jamais par un ordre de domaines codé en dur.
- Tant que la couverture est incomplète, l’interface dit exactement « Apport de l’arme — calcul partiel » et jamais « stats du héros » ou « total du héros ».
- Ne jamais utiliser pour une arme la progression
  `[10300,10700,11200,11800,12500]` ni un `growthType:"reinforce"` : ces données
  appartiennent exclusivement aux armures.
- Ne créer aucune table de correspondance `equiplv_N`. Le futur lot armures
  déduira ses segments de `max(1, len(tierBoundaries) − 1)` et centralisera
  l'unique hypothèse restante dans `ARMOR_SEGMENT_ORIGIN_MODE`, avec
  `confidence:"presumed"` et un protocole de mesure dans le vrai jeu. Le lot 1
  n'exécute pas ce paramètre puisqu'il ne couvre pas les armures.
- Ne créer aucune table ni colonne Supabase et ne modifier aucune politique RLS.
- Conserver la lecture des équipes et rosters par tous les membres authentifiés,
  mais l’édition uniquement par leur propriétaire. Le détail d’autrui ne montre
  jamais le bouton de configuration.
- Conserver au maximum un build par type d’arme compatible dans chaque fiche de
  roster.
- Exécuter un vrai cycle TDD rouge → vert pour chaque tâche et prouver au moins une assertion critique par mutation temporaire.
- Un commit local par tâche, message en français décrivant le pourquoi. Aucun push sans autorisation explicite.

## Structure des fichiers

**Créations**

- `7ds-stats/stat-metadata.json` — famille et unité explicites des 57 codes utilisés par les armes.
- `generate-stats-build.py` — rapproche assets/données, validation et génération déterministe du catalogue runtime.
- `stats-build.js` — fichier généré posant `window.SEVEN_DS_BUILD_STATS`.
- `tests/test_generate_stats_build.py` — tests unitaires Python du générateur et de la sortie réelle.
- `tests/stats-build.test.js` — tests Node des modèles, validations, calculs et regroupements.
- `tests/stats-build-schema.test.js` — contrat idempotent des protections SQL.

**Modifications**

- `index.html` — chargement du catalogue, modèle `weaponConfig`, moteur pur, panneau partagé et rendus.
- `tests/helpers/load-app.js` — catalogue de fixture et exposition des fonctions pures.
- `tests/potentiel-commun.playwright.js` — parcours Team Builder et changement d’arme.
- `tests/supabase-etape1.playwright.js` — persistance roster, lecture d’autrui et conflit Realtime.
- `tests/accessibilite-mobile.playwright.js` — panneau empilé, focus et géométrie mobile.
- `tests/pwa-update.playwright.js` — le catalogue et le calcul restent utilisables sans réseau.
- `supabase/schema.sql` — fonctions/triggers de conservation sans changement RLS.
- `tests/roster-schema.test.js` — maintien des contrats RLS existants après ajout des triggers.
- `sw.js` — précache et `CORE_PATHS` pour `stats-build.js`.
- `tests/pwa.test.js` — présence du catalogue et exclusion des références lourdes.
- `package.json` — intégration des nouvelles suites dans `test`, `test:unit`.
- `AGENTS.md` — modèle, calculs, limites, activation SQL et procédure de retour arrière.

---

### Task 1: Générer le catalogue compact et ses unités explicites

**Files:**
- Create: `7ds-stats/stat-metadata.json`
- Create: `generate-stats-build.py`
- Create: `stats-build.js`
- Create: `tests/test_generate_stats_build.py`
- Modify: `package.json`

**Interfaces:**
- Consumes: `7ds-stats/armes.json`, `7ds-stats/libelles-stats.json`, `7ds-armes/<type>/*.webp`.
- Produces: `build_catalog(stats_root: Path, weapons_root: Path, metadata: dict) -> dict`, `render_js(catalog: dict) -> str`, CLI `python generate-stats-build.py [--check]`, et `window.SEVEN_DS_BUILD_STATS`.

- [ ] **Step 1: Écrire les tests rouges du rapprochement et de la validation**

Importer `copy`, `json`, `tempfile`, `unittest` et `Path`, puis créer un fixture
minimal dans `tests/test_generate_stats_build.py`. Le
`setUp()` conserve son JSON dans `self.official_weapons`, écrit ce tableau dans
`self.stats_root / "armes.json"` et crée l’image locale correspondante. Définir
ces helpers dans la classe de test, avant de les utiliser :

```python
def write_official_weapons(self):
    (self.stats_root / "armes.json").write_text(
        json.dumps(self.official_weapons, ensure_ascii=False),
        encoding="utf-8",
    )

def fixture_grade(self):
    return self.official_weapons[0]["grades"][0]

def fixture_masterstone_grade(self):
    return self.official_weapons[0]["grades"][1]

def add_second_weapon_with_same_normalized_name_and_type(self):
    duplicate = copy.deepcopy(self.official_weapons[0])
    duplicate["slug"] = "test-axe-duplicate"
    self.official_weapons.append(duplicate)
    self.write_official_weapons()
```

Exiger ensuite les comportements suivants :

```python
class GenerateStatsBuildTests(unittest.TestCase):
    def test_catalog_is_keyed_by_exact_local_file(self):
        catalog = module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        weapon = catalog["weaponsByFile"]["7ds-armes/Hache/Hache test.webp"]
        self.assertEqual(weapon["slug"], "test-axe")
        self.assertEqual(weapon["mainStatCode"], "B_Atk_Equip")
        self.assertIn("grade-axe", weapon["gradesByGameId"])
        self.assertEqual(
            catalog["statLabels"]["B_Atk_Equip"],
            {"fr": "Attaque de l'équipement", "family": "main", "unit": "flat"},
        )

    def test_ambiguous_name_fails_instead_of_guessing(self):
        self.add_second_weapon_with_same_normalized_name_and_type()
        with self.assertRaisesRegex(ValueError, "ambigu"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_unknown_stat_family_fails(self):
        self.fixture_grade()["subStats"][0]["stat"] = "unknownStat"
        self.write_official_weapons()
        with self.assertRaisesRegex(ValueError, "famille"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_missing_explicit_unit_fails_even_when_label_has_rate_flag(self):
        self.metadata["I_AtkAdd_Rate"].pop("unit")
        with self.assertRaisesRegex(ValueError, "unité"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_unit_does_not_depend_on_incomplete_label_rate_flag(self):
        self.labels["B_Atk_Equip"].pop("taux", None)
        self.write_labels()
        catalog = module.build_catalog(
            self.stats_root, self.weapons_root, self.metadata
        )
        self.assertEqual(
            catalog["statLabels"]["B_Atk_Equip"]["unit"],
            "flat",
        )

    def test_tier_five_keeps_element_groups(self):
        grade = self.fixture_masterstone_grade()
        emitted = module.compact_enchantments(grade["enchantments"])
        self.assertEqual(emitted["tiers"][-1]["tier"], 5)
        self.assertEqual(
            [group["element"] for group in emitted["tiers"][-1]["elements"]],
            ["generic", "default", "fire"]
        )

    def test_weapon_promotion_reaches_declared_max(self):
        values = self.fixture_grade()["promotionValues"]
        self.assertEqual(values["max"], values["base"] + sum(values["progression"]))

    def test_overlimit_uses_the_canonical_rate_table(self):
        levels = self.fixture_grade()["overlimit"]["levels"]
        self.assertEqual(
            [level["statRate"] for level in levels],
            [0, 500, 1000, 1750, 2500, 3750, 5000],
        )
```

Le fixture doit contenir une arme, deux grades, un enchantement basique, une
pierre maîtresse, `self.metadata` et `self.labels`. Ajouter
`write_labels()` qui sérialise `self.labels` dans `libelles-stats.json`.
`B_Atk_Equip` n’a volontairement aucun drapeau `taux` dans ce fixture.

Ajouter aussi les contrats déterministes suivants : deux générations donnent
les mêmes octets, la sortie ne contient aucun champ `description`, chaque image
locale du fixture produit exactement une clé `weaponsByFile`, et
`python generate-stats-build.py --check` accepte la vraie sortie suivie.

- [ ] **Step 2: Exécuter le test et constater l’échec attendu**

Run:

```powershell
python -m unittest tests/test_generate_stats_build.py
```

Expected: `ModuleNotFoundError` ou échec indiquant que `build_catalog` n’existe pas.

- [ ] **Step 3: Ajouter les métadonnées exhaustives des codes utilisés par les armes**

Créer `7ds-stats/stat-metadata.json` sous cette forme exacte. Les trois codes
`B_*_Equip` sont plats ; tous les autres codes émis par les armes sont des
dix-millièmes :

```json
{
  "Activethird_Damadd_Rate": {"family":"damage","unit":"ten-thousandths"},
  "B_Atk_Equip": {"family":"main","unit":"flat"},
  "B_Def_Equip": {"family":"main","unit":"flat"},
  "B_MaxHp_Equip": {"family":"main","unit":"flat"},
  "C_Critical_DamRes_Rate": {"family":"additional","unit":"ten-thousandths"},
  "C_Critical_Dam_Rate": {"family":"additional","unit":"ten-thousandths"},
  "C_Critical_Rate": {"family":"additional","unit":"ten-thousandths"},
  "C_Critical_ResRate": {"family":"additional","unit":"ten-thousandths"},
  "D_Protect_Cur_Rate": {"family":"additional","unit":"ten-thousandths"},
  "Dark_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Dark_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Default_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Default_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Earth_Burst_Gauge_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Earth_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Earth_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Fire_Burst_Gauge_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Fire_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Fire_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Holy_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Holy_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "I_AtkAdd_Rate": {"family":"additional","unit":"ten-thousandths"},
  "I_DefAdd_Rate": {"family":"additional","unit":"ten-thousandths"},
  "I_MaxHpAdd_Rate": {"family":"additional","unit":"ten-thousandths"},
  "Ice_Burst_Gauge_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Ice_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Ice_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "MF_ChargeEffic_Rate": {"family":"special","unit":"ten-thousandths"},
  "Normalattack_Damadd_Rate": {"family":"damage","unit":"ten-thousandths"},
  "Normalskill_Damadd_Rate": {"family":"damage","unit":"ten-thousandths"},
  "Normalskillchangetag_Damadd_Rate": {"family":"damage","unit":"ten-thousandths"},
  "S_SkillRecycle_Rate": {"family":"special","unit":"ten-thousandths"},
  "Thunder_Burst_Gauge_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Thunder_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Thunder_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Ultimateskill_Damadd_Rate": {"family":"damage","unit":"ten-thousandths"},
  "Wind_Burst_Gauge_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Wind_Element_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "Wind_Rate": {"family":"elemental","unit":"ten-thousandths"},
  "accuracy": {"family":"additional","unit":"ten-thousandths"},
  "atkRate": {"family":"additional","unit":"ten-thousandths"},
  "burstGauge": {"family":"special","unit":"ten-thousandths"},
  "critDamage": {"family":"additional","unit":"ten-thousandths"},
  "critRate": {"family":"additional","unit":"ten-thousandths"},
  "darkDamage": {"family":"elemental","unit":"ten-thousandths"},
  "defRate": {"family":"additional","unit":"ten-thousandths"},
  "defense": {"family":"additional","unit":"ten-thousandths"},
  "earthDamage": {"family":"elemental","unit":"ten-thousandths"},
  "fireDamage": {"family":"elemental","unit":"ten-thousandths"},
  "healPower": {"family":"special","unit":"ten-thousandths"},
  "lightDamage": {"family":"elemental","unit":"ten-thousandths"},
  "normalAtkDamage": {"family":"damage","unit":"ten-thousandths"},
  "thunderBurstGauge": {"family":"elemental","unit":"ten-thousandths"},
  "ultimateDmg": {"family":"damage","unit":"ten-thousandths"},
  "waterDamage": {"family":"elemental","unit":"ten-thousandths"},
  "windBurstGauge": {"family":"elemental","unit":"ten-thousandths"},
  "windDamage": {"family":"elemental","unit":"ten-thousandths"}
}
```

Le chargeur Python accepte uniquement `family` parmi
`main/additional/damage/special/elemental` et `unit` parmi
`flat/ten-thousandths`. Il refuse toute clé manquante ou valeur supplémentaire.

- [ ] **Step 4: Implémenter le générateur minimal et déterministe**

Dans `generate-stats-build.py`, définir :

```python
FOLDER_TO_ENUM = {
    "Baguette": "Wand", "Baton": "Staff", "Bouclier": "Shield",
    "Epee 1 main": "Sword1h", "Epee 2 mains": "Sword2h",
    "Epees doubles": "SwordDual", "Gantelets": "Gauntlets",
    "Hache": "Axe", "Lance": "Lance", "Livre": "Book",
    "Nunchaku": "Cudgel3c", "Rapiere": "Rapier",
}
MAIN_STAT_CODES = {
    "attack": "B_Atk_Equip",
    "defense": "B_Def_Equip",
    "hp": "B_MaxHp_Equip",
}

def normalize_name(value):
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()

def render_js(catalog):
    body = json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "window.SEVEN_DS_BUILD_STATS = " + body + ";\n"
```

`build_catalog` doit :

1. indexer les armes officielles par `(weaponType, normalize_name(nameFr))` ;
2. scanner les `.webp` avec `Path.rglob`;
3. transformer le dossier via `FOLDER_TO_ENUM`;
4. exiger une correspondance unique ;
5. compacter uniquement `gameId`, `rarity`,
   `mainStatValues`, `subStats`, `promotionSteps`, `promotionValues`,
   `overlimit` sans descriptions, et `enchantments`;
6. ajouter à chaque label `{fr, family, unit}` depuis
   `stat-metadata.json`, sans lire `taux`;
7. trier fichiers, grades, sous-stats, options et groupes.

Pour chaque grade, le générateur refuse une `promotionValues` dont
`max !== base + Σ(progression)`. Les `promotionSteps[].reinforceMax` doivent
être le préfixe attendu de `[20,30,40,50]`. Lorsqu'un `overlimit` existe, ses
sept niveaux doivent porter exactement les taux
`[0,500,1000,1750,2500,3750,5000]`. Le générateur ne lit jamais
`armures.json` pour produire le lot 1.

Le CLI normal écrit `stats-build.js`. `--check` génère en mémoire, compare les
octets au fichier suivi et quitte avec le message
`stats-build.js doit être régénéré` en cas d’écart.

- [ ] **Step 5: Régénérer les données réelles et faire passer les tests**

Run:

```powershell
python generate-stats-build.py
python -m unittest tests/test_generate_stats_build.py
python generate-stats-build.py --check
```

Expected: tests `OK`, puis sortie `stats-build.js à jour`.

- [ ] **Step 6: Prouver que le contrôle d’ambiguïté mord**

Modifier temporairement `build_catalog` pour ne plus filtrer sur `weaponType`,
relancer le test ciblé et vérifier qu’il échoue. Restaurer immédiatement le
filtre, puis relancer toute la suite Python.

- [ ] **Step 7: Brancher la vérification dans npm**

Ajouter avant les tests Node fonctionnels dans `test` et `test:unit` :

```json
"python -m unittest tests/test_generate_stats_build.py && python generate-stats-build.py --check"
```

Run:

```powershell
npm run test:unit
```

Expected: toutes les suites unitaires existantes et le nouveau générateur passent.

- [ ] **Step 8: Commit**

```powershell
git add 7ds-stats/stat-metadata.json generate-stats-build.py stats-build.js tests/test_generate_stats_build.py package.json
git commit -m "data: générer les statistiques d’armes utilisables hors ligne"
```

---

### Task 2: Étendre le modèle sans casser les anciens builds

**Files:**
- Create: `tests/stats-build.test.js`
- Modify: `index.html:1667-1695`
- Modify: `index.html:2195-2338`
- Modify: `index.html:2509-2513`
- Modify: `tests/helpers/load-app.js:80-130,145-232`
- Modify: `package.json`

**Interfaces:**
- Consumes: `window.SEVEN_DS_BUILD_STATS`.
- Produces: `buildWeaponDefinition(file)`, `buildWeaponGrade(file, gameId)`,
  `normalizeWeaponConfig(file, raw)`, `emptyWeaponConfig(file, gameId)`,
  `weaponConfigStatus(file, config)`, `weaponLevelCap(grade, promotion)`,
  `applyWeaponChange(hero, nextFile)`.

- [ ] **Step 1: Écrire les tests rouges du modèle**

Dans `tests/stats-build.test.js`, charger `loadApp()` et couvrir :

```js
const HACHE_FILE = "7ds-armes/Hache/hache.webp";
const EPEE_FILE = "7ds-armes/Epee 1 main/epee.webp";
function validConfig(overrides = {}){
  return Object.assign({
    version:1,
    gradeGameId:"grade-axe",
    level:0,
    promotion:0,
    overlimit:0,
    enchantments:[null]
  }, overrides);
}

{
  const { hooks } = loadApp();
  const legacy = plain(hooks.normalizeHero({
    char:"meliodas",
    weapon:HACHE_FILE
  }));
  assert.equal(legacy.weaponConfig, null);
  assert.equal(hooks.weaponConfigStatus(legacy.weapon, legacy.weaponConfig), "missing");
}

{
  const { hooks } = loadApp();
  const future = { version:99, opaque:{ keep:"yes" } };
  const normalized = plain(hooks.normalizeHero({
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:future
  }));
  assert.deepEqual(normalized.weaponConfig, future);
  assert.equal(hooks.weaponConfigStatus(normalized.weapon, future), "incompatible");
}

{
  const { hooks } = loadApp();
  const changed = plain(hooks.applyWeaponChange({
    char:"meliodas",
    weapon:HACHE_FILE,
    weaponConfig:validConfig()
  }, EPEE_FILE));
  assert.equal(changed.weaponConfig, null);
}
```

Ajouter des cas pour `unavailable`, `incomplete`, `valid`, grade étranger,
niveau supérieur au plafond et tableau d’enchantements de mauvaise longueur.

- [ ] **Step 2: Exécuter le test rouge**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: échec sur l’absence de `weaponConfigStatus`.

- [ ] **Step 3: Charger le catalogue dans l’application et dans le VM**

Ajouter avant `potentiels.js` :

```html
<script src="stats-build.js"></script>
```

Puis dans le script principal :

```js
const BUILD_STATS = window.SEVEN_DS_BUILD_STATS || {
  version:0,
  weaponsByFile:{},
  statLabels:{}
};
```

Dans `tests/helpers/load-app.js`, injecter un `SEVEN_DS_BUILD_STATS` minimal
contenant `hache.webp`, deux grades, une courbe principale, une sous-stat, une
option basique et une pierre maîtresse. Chaque entrée de `statLabels` porte
explicitement `{fr, family, unit}` ; le fixture ne fournit aucun booléen `rate`
et le VM ne tente jamais d'en déduire un. Ajouter les nouvelles fonctions à
`HOOK_EXPORT`.

- [ ] **Step 4: Implémenter les fonctions de catalogue et d’état**

Ajouter les signatures suivantes au script principal :

```js
function buildWeaponDefinition(file){
  return file && Object.prototype.hasOwnProperty.call(BUILD_STATS.weaponsByFile, file)
    ? BUILD_STATS.weaponsByFile[file]
    : null;
}

function buildWeaponGrade(file, gameId){
  const weapon = buildWeaponDefinition(file);
  return weapon && Object.prototype.hasOwnProperty.call(weapon.gradesByGameId, gameId)
    ? weapon.gradesByGameId[gameId]
    : null;
}

function weaponLevelCap(grade, promotion){
  const steps = Array.isArray(grade && grade.promotionSteps)
    ? grade.promotionSteps : [];
  if(!steps.length) return -1;
  if(promotion === 0) return Math.max(0, Number(steps[0].reinforceMax) - 10);
  const step = steps[promotion - 1];
  return step ? Number(step.reinforceMax) : -1;
}
```

`normalizeWeaponConfig` doit préserver par copie JSON toute version future,
normaliser la version 1 sans ajouter de valeurs manquantes et retourner `null`
uniquement pour une absence réelle.

`weaponConfigStatus` applique exactement les cinq états de la spec. Un élément
`null` dans un tableau d’enchantements de bonne longueur est un choix valide.
Ajouter les assertions `weaponLevelCap(grade, 0) === 10`, puis
`20/30/40/50` pour les promotions 1 à 4 ; l'absence de `promotionSteps` doit
produire `incompatible`, jamais un plafond inventé.

- [ ] **Step 5: Propager `weaponConfig` dans tous les modèles**

Modifier :

```js
const emptyHero = () => ({
  char:null, weapon:null, weaponConfig:null,
  armor:emptyArmor(), jewel:emptyJewel(), potentiel:emptyPot(), note:""
});

const emptyRosterBuild = () => ({
  weapon:null, weaponConfig:null,
  armor:emptyArmor(), jewel:emptyJewel(), note:"", favorite:false
});
```

Ajouter le champ à `normalizeHero`, `normalizeRosterBuild`,
`rosterHeroSnapshot` et aux retours de copie. Dans `copyFavoriteRosterBuild`,
conserver impérativement :

```js
weapon:target.weapon,
weaponConfig:JSON.parse(JSON.stringify(target.weaponConfig)),
```

`applyWeaponChange` conserve la configuration si le chemin est identique et la
met à `null` si le chemin change.

- [ ] **Step 6: Faire passer le test et les régressions de potentiel**

Run:

```powershell
node tests/stats-build.test.js
node tests/potentiel-commun.test.js
```

Expected: deux commandes vertes.

- [ ] **Step 7: Ajouter la suite Node à npm et commit**

Ajouter `node tests/stats-build.test.js` dans `test` et `test:unit`, puis :

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js package.json
git commit -m "feat: préserver la configuration chiffrée des armes"
```

---

### Task 3: Produire une contribution d’arme décomposable et reconstructible

**Files:**
- Modify: `tests/stats-build.test.js`
- Modify: `index.html` près des fonctions de modèle ajoutées à la Task 2
- Modify: `tests/helpers/load-app.js`

**Interfaces:**
- Consumes: `buildWeaponGrade`, `weaponConfigStatus`, `BUILD_STATS.statLabels`.
- Produces: `curveValueAtLevel(curve, level)`,
  `promotionValueAt(grade, promotion)`,
  `enchantmentBounds(option, slotRate)`,
  `overlimitTargetBuckets(mode)`,
  `calculateWeaponStats(file, config)`,
  `reconstructStatTotals(terms)`,
  `groupBuildStatResults(result)`,
  `formatBuildStatValue(value, unit)` et
  `OVERLIMIT_APPLICATION_MODE`.

- [ ] **Step 1: Ajouter les tests rouges des primitives exactes**

Ajouter :

```js
assert.equal(
  hooks.curveValueAtLevel({base:100, progression:[2,3], max:150}, 0),
  100
);
assert.equal(hooks.curveValueAtLevel({base:100, progression:[2,3]}, 10), 120);
assert.equal(hooks.curveValueAtLevel({base:100, progression:[2,3]}, 11), 123);
assert.equal(hooks.curveValueAtLevel({base:100, progression:[2,3]}, 20), 150);

assert.equal(
  hooks.promotionValueAt({
    promotionValues:{base:50, progression:[73,145,218], max:486}
  }, 0),
  50
);
assert.equal(
  hooks.promotionValueAt({
    promotionValues:{base:50, progression:[73,145,218], max:486}
  }, 3),
  486
);
assert.deepEqual(
  plain(hooks.enchantmentBounds({min:315,max:787}, 5000)),
  {min:158,max:393}
);
assert.equal(
  hooks.formatBuildStatValue(787, "ten-thousandths"),
  "+7,87 %"
);
assert.equal(hooks.formatBuildStatValue(3291, "flat"), "+3 291");
assert.deepEqual(
  plain(hooks.overlimitTargetBuckets("native-before-enchantments")),
  ["weapon-native"]
);
assert.deepEqual(
  plain(hooks.overlimitTargetBuckets("native-and-enchantments")),
  ["weapon-native", "weapon-enchantment"]
);
assert.throws(
  () => hooks.overlimitTargetBuckets("mode-inconnu"),
  /OVERLIMIT_MODE_INVALID/
);
```

Le test lit également `index.html` comme texte et exige une seule déclaration
`OVERLIMIT_APPLICATION_MODE`, le texte `PRÉSUMÉ, NON VÉRIFIÉ`, les deux mesures
`outrepassement 0 puis 1` et la mention d'une arme enchantée. Cela empêche
l'hypothèse d'être déplacée ou dupliquée sans son protocole.

- [ ] **Step 2: Vérifier l’échec**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: échec sur `curveValueAtLevel`.

- [ ] **Step 3: Implémenter les fonctions pures**

Utiliser :

```js
function curveValueAtLevel(curve, level){
  const base = Number(curve && curve.base) || 0;
  const current = Math.max(0, Math.trunc(Number(level) || 0));
  return (curve && Array.isArray(curve.progression) ? curve.progression : [])
    .reduce((total, increment, index) =>
      total + Number(increment) * Math.max(0, Math.min(10, current - index * 10)),
      base
    );
}

function promotionValueAt(grade, promotion){
  const values = grade && grade.promotionValues;
  const count = Math.max(0, Math.trunc(Number(promotion) || 0));
  return (Array.isArray(values && values.progression)
    ? values.progression.slice(0, count) : []
  ).reduce((sum, value) => sum + Number(value), Number(values && values.base) || 0);
}

function enchantmentBounds(option, slotRate){
  return {
    min:Math.ceil(Number(option.min) * Number(slotRate) / 10000),
    max:Math.floor(Number(option.max) * Number(slotRate) / 10000)
  };
}
```

Ajouter à un seul endroit :

```js
/*
 * PRÉSUMÉ, NON VÉRIFIÉ :
 * l’outrepassement multiplie les statistiques natives de l’arme avant
 * les enchantements.
 *
 * Vérification dans le jeu :
 * relever l’ATK à outrepassement 0 puis 1 sur une arme enchantée.
 * Si le gain de 5 % inclut les enchantements, remplacer uniquement
 * "native-before-enchantments" par "native-and-enchantments".
 */
const OVERLIMIT_APPLICATION_MODE = "native-before-enchantments";

function overlimitTargetBuckets(mode){
  if(mode === "native-before-enchantments") return ["weapon-native"];
  if(mode === "native-and-enchantments"){
    return ["weapon-native", "weapon-enchantment"];
  }
  throw new Error("OVERLIMIT_MODE_INVALID");
}
```

Seule `overlimitTargetBuckets` lit ce mode. Aucune autre branche du moteur ne
doit connaître ces deux valeurs.

- [ ] **Step 4: Tester d'abord la reconstruction générique par seaux**

Ajouter ce fixture manuel, indépendant du catalogue :

```js
const bucketTerms = [
  {
    id:"level", stat:"B_Atk_Equip", operation:"add",
    value:2000, unit:"flat", bucket:"weapon-native", family:"main",
    source:{domain:"weapon", component:"level"}, confidence:"exact"
  },
  {
    id:"promotion", stat:"B_Atk_Equip", operation:"add",
    value:1000, unit:"flat", bucket:"weapon-native", family:"main",
    source:{domain:"weapon", component:"promotion"}, confidence:"exact"
  },
  {
    id:"overlimit", stat:"B_Atk_Equip", operation:"multiply",
    value:500, unit:"ten-thousandths", appliesTo:["weapon-native"],
    family:"main",
    source:{domain:"weapon", component:"overlimit"}, confidence:"exact"
  },
  {
    id:"enchantment", stat:"B_Atk_Equip", operation:"add",
    value:100, unit:"flat", bucket:"weapon-enchantment", family:"main",
    source:{domain:"weapon", component:"enchantment", slot:0},
    confidence:"exact"
  }
];
assert.deepEqual(
  plain(hooks.reconstructStatTotals(bucketTerms)),
  [{stat:"B_Atk_Equip", unit:"flat", value:3250}]
);
const includingEnchantments = bucketTerms.map(term =>
  term.id === "overlimit"
    ? {...term, appliesTo:["weapon-native", "weapon-enchantment"]}
    : term
);
assert.deepEqual(
  plain(hooks.reconstructStatTotals(includingEnchantments)),
  [{stat:"B_Atk_Equip", unit:"flat", value:3255}]
);
```

Exiger aussi les rejets suivants :

- un terme sans `unit` ;
- un terme sans `confidence` ou avec une valeur autre que `exact/presumed` ;
- deux additifs d'une même stat portant des unités différentes ;
- un multiplicateur dont `unit` n'est pas `ten-thousandths` ;
- un multiplicateur avec `stat:"*"` ;
- un `appliesTo` vide ou dont aucun seau ne possède d'additif pour cette stat ;
- une opération autre que `add` ou `multiply`.

- [ ] **Step 5: Implémenter `reconstructStatTotals` sans ordre de domaines**

Pour chaque `stat`, la fonction :

1. valide les termes et somme séparément chaque `bucket` additif ;
2. calcule chaque delta multiplicatif comme
   `Σ(seaux nommés) × value / 10000` ;
3. ajoute tous les seaux additifs et tous les deltas multiplicatifs ;
4. retourne des objets `{stat, unit, value}` triés par code de stat.

Elle ne contient aucune liste ordonnée `character/weapon/armor/...`, aucun nom
de seau privilégié et aucune règle propre à l'outrepassement. `totals` est
toujours produit par cette fonction, jamais calculé en parallèle.
Un seau nommé qui n'a pas d'additif pour une stat contribue zéro ; le
multiplicateur reste valide si au moins un de ses seaux ciblés contribue à cette
stat. Cette règle préserve le sens « source couverte, terme absent = vrai zéro ».

- [ ] **Step 6: Écrire le test rouge du contrat complet du moteur**

Avec un grade contenant niveau, promotion, sous-stat, enchantement,
outrepassement 1 et passif niveau 7, exiger :

```js
const result = plain(hooks.calculateWeaponStats(HACHE_FILE, validConfig({
  overlimit:1
})));
assert.equal(result.version, 1);
assert.equal(result.status, "valid");
assert.deepEqual(result.coverage, ["weapon"]);
assert.equal(
  result.assumptions.overlimitBase,
  "native-before-enchantments"
);
assert.ok(result.terms.length > 0);
assert.ok(result.terms.every(term =>
  term.stat !== "*" &&
  ["add", "multiply"].includes(term.operation) &&
  ["flat", "ten-thousandths"].includes(term.unit)
));
assert.ok(result.terms.some(term =>
  term.operation === "multiply" &&
  term.source.component === "overlimit" &&
  term.stat === "B_Atk_Equip" &&
  term.value === 500 &&
  JSON.stringify(term.appliesTo) === JSON.stringify(["weapon-native"])
));
assert.ok(result.facts.some(fact =>
  fact.source.component === "passive" && fact.level === 7
));
assert.deepEqual(
  plain(hooks.reconstructStatTotals(result.terms)),
  result.totals
);
```

Le calcul doit émettre des termes séparés pour :

- le niveau et la promotion, dans `bucket:"weapon-native"` ;
- chaque sous-stat native, dans `bucket:"weapon-native"` ;
- chaque enchantement non nul, dans `bucket:"weapon-enchantment"` ;
- l'outrepassement, sous forme d'un terme `multiply` pour chaque code de stat
  réellement présent dans les seaux ciblés.

Chaque terme porte une provenance structurée
`source:{domain:"weapon", component, id, ...}`, sa `family` et
`confidence:"exact"`. Le passif reste dans `facts`, sans devenir un terme
chiffré.

Ajouter trois contrats de sens :

```js
const invalidCases = [
  [HACHE_FILE, null, "missing"],
  [HACHE_FILE, validConfig({gradeGameId:null}), "incomplete"],
  ["7ds-armes/Hache/sans-stats.webp", validConfig(), "unavailable"],
  [HACHE_FILE, {version:99, opaque:true}, "incompatible"]
];
for(const [file, config, expectedStatus] of invalidCases){
  const invalidResult = plain(hooks.calculateWeaponStats(file, config));
  assert.equal(invalidResult.status, expectedStatus);
  assert.deepEqual(invalidResult.coverage, []);
  assert.deepEqual(invalidResult.terms, []);
  assert.deepEqual(invalidResult.totals, []);
}

// Une source couverte et aucun enchantement signifie un vrai zéro.
const validWithoutEnchantments = plain(hooks.calculateWeaponStats(
  HACHE_FILE,
  validConfig({enchantments:[null]})
));
assert.deepEqual(validWithoutEnchantments.coverage, ["weapon"]);
assert.equal(
  validWithoutEnchantments.terms.some(
    term => term.source.component === "enchantment"
  ),
  false
);

// Une décomposition tronquée ne peut plus reproduire le total publié.
assert.notDeepEqual(
  plain(hooks.reconstructStatTotals(result.terms.slice(1))),
  result.totals
);
```

Le test exige enfin qu'aucune valeur `10300` ne soit utilisée par le moteur
d'arme et que `formatBuildStatValue(500, "ten-thousandths") === "+5 %"`.

- [ ] **Step 7: Implémenter `calculateWeaponStats` et le regroupement d'UI**

Pour tout statut autre que `valid`, retourner :

```js
{
  version:1,
  status,
  coverage:[],
  assumptions:{overlimitBase:OVERLIMIT_APPLICATION_MODE},
  terms:[],
  totals:[],
  facts:[]
}
```

Pour un état valide :

1. construire uniquement les termes effectivement calculés ;
2. créer les termes d'outrepassement après les additifs, en résolvant une stat
   concrète par seau ciblé ;
3. calculer `totals` exclusivement avec `reconstructStatTotals(terms)` ;
4. retourner `coverage:["weapon"]` ;
5. exposer le niveau du passif dans `facts`.

`groupBuildStatResults(result)` suit l'ordre visuel `main`, `additional`,
`damage`, `special`, `elemental`. Il regroupe les `totals` par famille et leur
associe les termes complets correspondants sans les fusionner ni perdre
`source`, `operation`, `unit`, `bucket`, `appliesTo` ou `confidence`.

- [ ] **Step 8: Faire passer les tests**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: `PASS stats de builds : modèle et calcul de l’arme`.

- [ ] **Step 9: Prouver les deux invariants critiques par mutation**

Remplacer temporairement `current - index * 10` par
`current - index * 10 - 1`. Le cas niveau 11 doit échouer. Restaurer la formule
et relancer le test vert.

Puis remplacer temporairement `totals:reconstructStatTotals(terms)` par un total
calculé directement ou retirer un terme avant reconstruction. Le contrat
`reconstructStatTotals(result.terms) === result.totals` doit échouer. Restaurer
la dérivation unique et relancer le test vert.

- [ ] **Step 10: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: décomposer l’apport calculé des armes"
```

---

### Task 4: Protéger les JSONB contre les anciennes PWA

**Files:**
- Create: `tests/stats-build-schema.test.js`
- Modify: `supabase/schema.sql:34-87`
- Modify: `tests/roster-schema.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: colonnes `teams.data` et `roster_characters.builds`.
- Produces: `private.preserve_roster_weapon_configs()`,
  `private.preserve_team_weapon_configs()` et deux triggers `BEFORE UPDATE`.

- [ ] **Step 1: Écrire le contrat SQL rouge**

Dans `tests/stats-build-schema.test.js`, lire `supabase/schema.sql` et exiger :

```js
[
  /create or replace function private\.preserve_roster_weapon_configs/i,
  /create trigger preserve_roster_weapon_configs[\s\S]*before update of builds/i,
  /not\s*\(\s*v_new_build\s*\?\s*'weaponConfig'\s*\)/i,
  /v_new_build->>'weapon'\s+is not distinct from\s+v_old_build->>'weapon'/i,
  /jsonb_set[\s\S]*weaponConfig/i,
  /create or replace function private\.preserve_team_weapon_configs/i,
  /create trigger preserve_team_weapon_configs[\s\S]*before update of data/i,
  /v_new_hero->>'char'\s+is not distinct from\s+v_old_hero->>'char'/i
].forEach(pattern => assert.match(sql, pattern));
```

Exiger aussi que le bloc ne crée aucune table/colonne et ne modifie pas les
quatre policies roster/teams existantes.

- [ ] **Step 2: Vérifier l’échec**

Run:

```powershell
node tests/stats-build-schema.test.js
```

Expected: échec sur la première fonction absente.

- [ ] **Step 3: Implémenter le trigger roster**

Ajouter après la création des tables :

```sql
create or replace function private.preserve_roster_weapon_configs()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_type text;
  v_old_build jsonb;
  v_new_build jsonb;
begin
  for v_type in select jsonb_object_keys(coalesce(new.builds, '{}'::jsonb))
  loop
    v_old_build := old.builds -> v_type;
    v_new_build := new.builds -> v_type;
    if jsonb_typeof(v_old_build) = 'object'
       and jsonb_typeof(v_new_build) = 'object'
       and not (v_new_build ? 'weaponConfig')
       and v_old_build ? 'weaponConfig'
       and nullif(v_new_build->>'weapon', '') is not null
       and v_new_build->>'weapon' is not distinct from v_old_build->>'weapon'
    then
      new.builds := jsonb_set(
        new.builds,
        array[v_type, 'weaponConfig'],
        v_old_build->'weaponConfig',
        true
      );
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists preserve_roster_weapon_configs on public.roster_characters;
create trigger preserve_roster_weapon_configs
before update of builds on public.roster_characters
for each row execute function private.preserve_roster_weapon_configs();
```

Une clé présente avec `null` satisfait `v_new_build ? 'weaponConfig'` et reste
donc une suppression explicite.

- [ ] **Step 4: Implémenter le trigger équipes**

Parcourir les index de `new.data->'heroes'`. Préserver uniquement quand les deux
héros sont des objets, que `char` et `weapon` sont identiques, que l’arme est non
nulle, que l’ancien objet possède la clé et que le nouveau l’omet. Utiliser :

```sql
new.data := jsonb_set(
  new.data,
  array['heroes', v_index::text, 'weaponConfig'],
  v_old_hero->'weaponConfig',
  true
);
```

Ne jamais recréer un index absent du nouveau tableau.

- [ ] **Step 5: Faire passer les contrats schema**

Run:

```powershell
node tests/stats-build-schema.test.js
node tests/roster-schema.test.js
```

Expected: deux commandes vertes, avec les policies RLS historiques toujours
détectées.

- [ ] **Step 6: Ajouter la suite à npm et commit**

Ajouter `node tests/stats-build-schema.test.js` après `roster-schema.test.js`
dans `test` et `test:unit`.

```powershell
git add supabase/schema.sql tests/stats-build-schema.test.js tests/roster-schema.test.js package.json
git commit -m "fix: empêcher les anciennes PWA d’effacer les stats d’arme"
```

---

### Task 5: Construire le panneau dédié et l’intégrer au Team Builder

**Files:**
- Modify: `index.html:230-600` styles
- Modify: `index.html:1520-1672` markup
- Modify: `index.html:3813-3990` Team Builder
- Modify: `index.html` après le moteur de la Task 3
- Modify: `tests/potentiel-commun.playwright.js`

**Interfaces:**
- Consumes: modèle et moteur des Tasks 2-3, `ModalStack`.
- Produces: `WeaponConfigEditor`,
  `openWeaponConfigEditor(context, restoreFocus)`,
  `closeWeaponConfigEditor()`,
  `renderWeaponConfigEditor()`,
  `weaponConfigSummary(file, config)`,
  `weaponStatsSection(file, config)`.

- [ ] **Step 1: Ajouter le parcours Playwright rouge**

Dans `tests/potentiel-commun.playwright.js`, après avoir choisi Meliodas et une
Hache réelle :

```js
const configButton = firstHero.locator(".weapon-config-open");
await assertVisibleText(
  firstHero.locator(".weapon-config-summary"),
  "Configuration à compléter"
);
await configButton.click();
await page.locator("#weaponConfigOverlay").waitFor({state:"visible"});
await page.locator("#weaponConfigCancel").click();
assert.equal(
  await firstHero.locator(".weapon-config-summary").textContent(),
  "Configuration à compléter"
);
```

Rouvrir, choisir le premier grade, niveau `0`, **promotion** `0`,
outrepassement `0`, choisir explicitement « Aucun » dans chaque emplacement,
valider et exiger le résumé `Configurée` ainsi que le titre exact
`Apport de l’arme — calcul partiel`. Le panneau ne doit contenir ni
`stats du héros`, ni `total du héros`, et le détail doit afficher `Promotion`
sans jamais afficher `Renforcement` pour `source.component === "promotion"`.

Rouvrir avec une arme permettant l'outrepassement, choisir le niveau 1 et
exiger le libellé exact
`Outrepassement ×1,05 — base présumée`. Changer ensuite d’arme en acceptant la
confirmation et exiger le retour à `Configuration à compléter`.

- [ ] **Step 2: Vérifier l’échec**

Run:

```powershell
node tests/potentiel-commun.playwright.js
```

Expected: locator `.weapon-config-open` absent.

- [ ] **Step 3: Ajouter le markup et les styles du panneau A validé**

Ajouter un overlay unique :

```html
<div class="overlay" id="weaponConfigOverlay" role="dialog" aria-modal="true"
     aria-labelledby="weaponConfigTitle" aria-hidden="true">
  <div class="modal weapon-config-modal">
    <div class="picker-head">
      <span class="picker-title" id="weaponConfigTitle">Configurer l’arme</span>
      <button class="icon-btn" id="weaponConfigClose" type="button"
              aria-label="Fermer">×</button>
    </div>
    <div class="weapon-config-layout">
      <div id="weaponConfigBody"></div>
      <aside id="weaponConfigPreview" aria-live="polite"></aside>
    </div>
    <p id="weaponConfigError" role="alert"></p>
    <div class="weapon-config-actions">
      <button class="btn" id="weaponConfigCancel" type="button">Annuler</button>
      <button class="btn btn-danger" id="weaponConfigReset"
              type="button">Réinitialiser</button>
      <button class="btn btn-primary" id="weaponConfigSave"
              type="button">Valider la configuration</button>
    </div>
  </div>
</div>
```

Desktop : grille deux colonnes `minmax(0,1fr) minmax(260px,.8fr)`. Sous
`max-width:700px`, une colonne, modal `width:min(100%,680px)`,
`max-height:calc(100dvh - 16px)`, contenu défilable verticalement. Aucun
`min-width` ne doit dépasser la fenêtre.

- [ ] **Step 4: Implémenter l’état transactionnel partagé**

Utiliser :

```js
let weaponConfigEditorState = null;

function openWeaponConfigEditor(context, restoreFocus){
  const initial = context.config == null
    ? emptyWeaponConfig(context.weaponFile, context.defaultGradeGameId)
    : JSON.parse(JSON.stringify(context.config));
  weaponConfigEditorState = { context, draft:initial, restoreFocus };
  renderWeaponConfigEditor();
  ModalStack.open(
    $("#weaponConfigOverlay"),
    ".weapon-config-grade",
    closeWeaponConfigEditor,
    restoreFocus
  );
}
```

Le `context` contient :

```js
{
  weaponFile,
  config,
  sourceUpdatedAt,
  defaultGradeGameId,
  commit(nextConfig){},
  latestUpdatedAt(){ return sourceUpdatedAt; },
  reload(){}
}
```

Annuler et Échap jettent le draft. Valider exige `weaponConfigStatus ===
"valid"`, appelle `context.commit(clone)` puis ferme. La première entrée
invalide reçoit le focus. Réinitialiser confirme, appelle `commit(null)` et
ferme.

- [ ] **Step 5: Rendre les champs depuis le catalogue**

Créer des `select` pour grade, **promotion** et outrepassement, un
`input type="number"` pour le niveau et un bloc par enchantement. Une valeur
`null` est représentée par l’option « Aucun enchantement ».

Au changement de grade :

1. demander confirmation si le draft contient déjà des choix ;
2. reconstruire via `emptyWeaponConfig`;
3. ajuster longueur et type des enchantements.

Le panneau de droite utilise uniquement `calculateWeaponStats` et
`groupBuildStatResults`. Il porte toujours le titre
`Apport de l’arme — calcul partiel`, puisqu'il ne couvre que `["weapon"]`.
Un état invalide affiche le message d’état, jamais des zéros.

Les lignes de décomposition utilisent les libellés `Niveau`, `Promotion`,
`Enchantement` et `Outrepassement`. La ligne du multiplicateur affiche le
facteur exact à partir de son terme, suivi de `— base présumée`; c'est la base
d'application, et non le facteur, qui est présumée.

- [ ] **Step 6: Ajouter le contrôle à chaque héros du Team Builder**

Après le `gearSlot("Arme", ...)`, rendre :

```js
weaponConfigControl({
  weaponFile:hero.weapon,
  config:hero.weaponConfig,
  sourceUpdatedAt:draft.updatedAt,
  commit(next){ hero.weaponConfig = next; renderBuilder(); }
});
```

Le contrôle est absent sans arme. Modifier `pickWeapon(i)` afin d’appeler
`applyWeaponChange`; si une configuration existe et que l’arme change, demander
confirmation avant d’ouvrir la nouvelle valeur.

- [ ] **Step 7: Faire passer le parcours Team Builder**

Run:

```powershell
node tests/potentiel-commun.playwright.js
node tests/stats-build.test.js
```

Expected: deux suites vertes.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/potentiel-commun.playwright.js
git commit -m "feat: configurer une arme depuis le Team Builder"
```

---

### Task 6: Brancher le roster, la persistance et les vues en lecture seule

**Files:**
- Modify: `index.html:3313-3375`
- Modify: `index.html:3415-3748`
- Modify: `index.html:4300-4380`
- Modify: `index.html:4415-4500`
- Modify: `tests/stats-build.test.js`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `WeaponConfigEditor`, `weaponConfigControl`,
  `weaponStatsSection`, modèle JSONB.
- Produces: configuration roster persistée, détail partagé en lecture seule et
  conservation dans les copies/snapshots.

- [ ] **Step 1: Écrire les tests rouges des copies pures**

Ajouter à `tests/stats-build.test.js` :

```js
const emptyArmorFixture = {
  Haut:null, Bas:null, Bottes:null, Ceinture:null, "Armure liee":null
};
const emptyJewelFixture = {
  Anneau:null, Collier:null, "Boucle d'oreille":null
};
function buildFixture(weapon, weaponConfig, favorite){
  return {
    weapon,
    weaponConfig,
    armor:emptyArmorFixture,
    jewel:emptyJewelFixture,
    note:"",
    favorite:!!favorite
  };
}

const sourceConfig = validConfig();
const entry = {
  owner:"user-1",
  charId:"meliodas",
  potentialTier:7,
  builds:{
    Hache:buildFixture(HACHE_FILE, sourceConfig, true)
  },
  updatedAt:123
};
const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
assert.deepEqual(snapshot.weaponConfig, sourceConfig);

const targetConfig = validConfig({
  gradeGameId:"grade-sword",
  enchantments:[null, null]
});
const copied = plain(hooks.copyFavoriteRosterBuild(
  Object.assign({}, entry, {
    builds:Object.assign({}, entry.builds, {
      "Epee 1 main":buildFixture(EPEE_FILE, targetConfig, false)
    })
  }),
  "Epee 1 main"
));
assert.deepEqual(
  copied.builds["Epee 1 main"].weaponConfig,
  targetConfig
);
```

Tester aussi `normalizeTeam`, `cloudRosterFromRow`, `rosterToCloudRow` et une
équipe passée par duplication/import-export : la configuration doit survivre
octet pour octet. Ajouter explicitement un instantané d’équipe simulant
`boss_participation.team_snapshot` :

```js
const team = hooks.normalizeTeam({
  id:"team-1",
  pseudo:"Yannis",
  heroes:[{char:"meliodas", weapon:HACHE_FILE, weaponConfig:sourceConfig}]
});
const bossSnapshot = plain(JSON.parse(JSON.stringify(team)));
assert.deepEqual(bossSnapshot.heroes[0].weaponConfig, sourceConfig);
```

Dans `tests/boss-reports-schema.test.js`, conserver aussi le contrat existant
qui impose que `select_boss_team` copie le JSON complet de `teams.data` dans
`team_snapshot`, sans reconstruire une liste fermée de champs.

- [ ] **Step 2: Ajouter le parcours roster rouge au fake Supabase**

Dans `tests/supabase-etape1.playwright.js` :

1. ouvrir son roster ;
2. modifier le premier build ;
3. configurer l’arme avec le panneau partagé ;
4. enregistrer le personnage ;
5. attendre que `window.__fakeSupabaseState.roster_characters` contienne
   `weaponConfig.version === 1`;
6. rouvrir et vérifier le résumé configuré ;
7. sélectionner un autre membre et vérifier
   `Apport de l’arme — calcul partiel` en lecture seule ;
8. vérifier l’absence de `.weapon-config-open` dans le détail d’autrui.

- [ ] **Step 3: Vérifier les échecs**

Run:

```powershell
node tests/stats-build.test.js
node tests/supabase-etape1.playwright.js
```

Expected: copie ou bouton roster absent.

- [ ] **Step 4: Intégrer le contrôle à l’éditeur roster**

Après le slot d’arme de `renderMemberRosterEditor`, appeler le même
`weaponConfigControl`. Son adaptateur :

```js
{
  weaponFile:build.weapon,
  config:build.weaponConfig,
  sourceUpdatedAt:memberRosterDraftSourceUpdatedAt,
  commit(next){
    currentMemberRosterBuild().weaponConfig = next;
    renderMemberRosterEditor();
  },
  latestUpdatedAt(){
    const latest = MemberRosterStore.all(currentUser.id)
      .find(row => row.charId === memberRosterDraft.charId);
    return latest ? latest.updatedAt : memberRosterDraft.updatedAt;
  },
  reload(){ void reloadCurrentRosterDraft(); }
}
```

Définir `reloadCurrentRosterDraft()` sans helper implicite : il relit
`MemberRosterStore.refresh(currentUser.id)`, retrouve `memberRosterDraft.charId`,
copie la ligne normalisée dans `memberRosterDraft`, actualise
`memberRosterDraftSourceUpdatedAt`, puis appelle `renderMemberRosterEditor()`.
Si la ligne a été supprimée, fermer l’éditeur et afficher un toast explicite.

Le choix d’une nouvelle arme passe aussi par `applyWeaponChange` et la
confirmation de perte.

- [ ] **Step 5: Afficher les statistiques dans les détails partagés**

Faire en sorte que `heroDetail()` ajoute, après l’équipement :

```js
const stats = weaponStatsSection(h.weapon, h.weaponConfig);
if(stats) body.appendChild(stats);
```

`weaponStatsSection` :

- retourne un message explicite pour `missing`, `incomplete`, `unavailable` et
  `incompatible`;
- appelle `calculateWeaponStats`, vérifie `coverage:["weapon"]` et rend
  exactement `Apport de l’arme — calcul partiel` pour `valid`;
- rend uniquement les familles non vides de `groupBuildStatResults(result)`;
- affiche les valeurs synthétiques depuis `result.totals`, avec l'unité
  explicite de chaque total ;
- utilise `<details>` pour les termes intacts, avec leur provenance, leur
  opération et, pour un multiplicateur, les seaux ciblés ;
- affiche `Promotion`, jamais `Renforcement`, pour
  `source.component === "promotion"`;
- affiche `Outrepassement ×1,05 — base présumée` pour un terme de valeur `500`;
- ne mentionne jamais `stats du héros` ou `total du héros` tant que les domaines
  `character`, `armor`, `set`, `potential` et `mastery` ne sont pas couverts ;
- ne crée aucun bouton d’édition.

La modale de roster d’autrui et `teamOverlay` réutilisent déjà `heroDetail`, donc
aucun rendu parallèle ne doit être ajouté.

- [ ] **Step 6: Faire passer persistance et lecture seule**

Run:

```powershell
node tests/stats-build.test.js
node tests/supabase-etape1.playwright.js
```

Expected: données persistées, contribution visible chez autrui, aucun contrôle
d’écriture.

- [ ] **Step 7: Commit**

```powershell
git add index.html tests/stats-build.test.js tests/supabase-etape1.playwright.js
git commit -m "feat: partager les statistiques d’armes du roster"
```

---

### Task 7: Gérer les conflits Realtime sans perdre le brouillon

**Files:**
- Modify: `index.html` dans `WeaponConfigEditor`
- Modify: `index.html:3726-3740`
- Modify: `index.html:2517` état source du brouillon d’équipe
- Modify: `index.html:4157-4192` `resetTeamDraft` et clic `#btnSave`
- Modify: `index.html:3708-3740` ouverture/sauvegarde du roster
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `tests/accessibilite-mobile.playwright.js`

**Interfaces:**
- Consumes: `context.sourceUpdatedAt`, `context.latestUpdatedAt()`,
  `context.reload()`.
- Produces: `weaponConfigHasConflict(state)`,
  `showWeaponConfigConflict()`, actions
  `#weaponConfigReload` et `#weaponConfigOverwrite`.

- [ ] **Step 1: Écrire le scénario Realtime rouge**

Pendant que le panneau roster est ouvert :

1. modifier un champ du draft ;
2. mettre à jour la ligne correspondante dans `__fakeSupabaseState` avec un
   `updated_at` supérieur ;
3. déclencher l’événement Realtime existant ;
4. vérifier que la valeur saisie est toujours dans le champ ;
5. cliquer « Valider la configuration » ;
6. exiger le bandeau `.weapon-config-conflict`;
7. vérifier deux boutons nommés « Recharger la version récente » et
   « Enregistrer quand même ».

Tester le chemin recharger, puis refaire le scénario et tester l’écrasement
explicite.

- [ ] **Step 2: Vérifier l’échec**

Run:

```powershell
node tests/supabase-etape1.playwright.js
```

Expected: le bandeau de conflit est absent.

- [ ] **Step 3: Implémenter le garde**

```js
function weaponConfigHasConflict(state){
  const source = Number(state && state.context.sourceUpdatedAt) || 0;
  const latest = Number(state && state.context.latestUpdatedAt()) || 0;
  return latest > source && !state.overwriteConfirmed;
}
```

Si conflit :

- ne pas appeler `commit`;
- ne pas fermer la modale ;
- rendre le bandeau `role="alert"`;
- « Recharger » demande confirmation si le draft est sale, appelle
  `context.reload()` puis ferme ;
- « Enregistrer quand même » pose `overwriteConfirmed=true` et relance la
  validation.

Conserver aussi la date source du parent :

```js
let teamDraftSourceUpdatedAt = 0;
let memberRosterDraftSourceUpdatedAt = 0;
```

`editTeam(t)` et `openMemberRosterEditor(entry, ...)` capturent le `updatedAt`
lu. `resetTeamDraft()` remet la source d’équipe à zéro. Juste avant
`MemberRosterStore.upsert(memberRosterDraft)`, comparer avec
`MemberRosterStore.all(currentUser.id)`; juste avant `Store.upsert(team)`,
comparer avec `Store.all()` sur le même `id`.

Si la ligne est devenue plus récente après fermeture du panneau, demander
explicitement :

```js
if(latestUpdatedAt > sourceUpdatedAt && !confirm(
  "Une version plus récente existe. Enregistrer quand même ?"
)){
  button.disabled = false;
  button.focus();
  return;
}
```

Refuser conserve le brouillon parent intact. Accepter autorise cette sauvegarde
et met à jour la date source avec la ligne effectivement retournée par le store.
Ajouter les deux branches au scénario fake Supabase afin que ce dernier garde
ne soit pas seulement couvert dans le panneau.

Pour le contexte Team Builder de `WeaponConfigEditor`, fournir exactement :

```js
latestUpdatedAt(){
  const latest = Store.all().find(row => row.id === draft.id);
  return latest ? latest.updatedAt : teamDraftSourceUpdatedAt;
},
reload(){
  const latest = Store.all().find(row => row.id === draft.id);
  if(!latest) return;
  draft = normalizeTeam(JSON.parse(JSON.stringify(latest)));
  teamDraftSourceUpdatedAt = draft.updatedAt;
  renderBuilder();
}
```

Pour une nouvelle équipe (`teamDraftSourceUpdatedAt === 0`), ces fonctions ne
signalent jamais de faux conflit.

- [ ] **Step 4: Verrouiller focus et pile de modales**

Dans `tests/accessibilite-mobile.playwright.js`, ouvrir l’éditeur roster, puis
le panneau arme. Vérifier :

```js
assert.equal(
  await page.locator("#weaponConfigOverlay").getAttribute("aria-hidden"),
  "false"
);
await page.keyboard.press("Escape");
assert.equal(
  await page.locator("#memberRosterOverlay").getAttribute("aria-hidden"),
  "false"
);
assert.equal(
  await page.evaluate(() => document.activeElement.classList.contains("weapon-config-open")),
  true
);
```

Ajouter le cas où le bandeau de conflit apparaît et reçoit un ordre de focus
logique sans sortir de l’overlay.

- [ ] **Step 5: Faire passer les tests**

Run:

```powershell
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: deux suites vertes, brouillon conservé et restitution du focus exacte.

- [ ] **Step 6: Commit**

```powershell
git add index.html tests/supabase-etape1.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "fix: avertir avant d’écraser une configuration plus récente"
```

---

### Task 8: Garantir le mobile, le hors ligne et documenter l’activation

**Files:**
- Modify: `sw.js:19-25`
- Modify: `tests/pwa.test.js`
- Modify: `tests/pwa-update.playwright.js`
- Modify: `tests/accessibilite-mobile.playwright.js`
- Modify: `AGENTS.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `stats-build.js`, panneau final et triggers SQL.
- Produces: catalogue précaché, documentation de maintenance et suite complète.

- [ ] **Step 1: Écrire les assertions PWA rouges**

Dans `tests/pwa.test.js` :

```js
assert.match(html, /<script src="stats-build\.js"><\/script>/);
assert.match(sw, /"\.\/stats-build\.js"/);
assert.ok(fs.existsSync(path.join(ROOT, "stats-build.js")));
assert.doesNotMatch(sw, /7ds-stats\/.*\.json/);
```

Extraire la liste `CORE_ASSETS` ou vérifier chaque entrée par regex et exiger
que chaque fichier local existe sur disque.

- [ ] **Step 2: Ajouter les mesures mobiles rouges**

Pour les viewports 320, 360 et 390 px, ouvrir le panneau et mesurer :

```js
const geometry = await page.locator("#weaponConfigOverlay .weapon-config-modal")
  .evaluate(node => ({
    left:node.getBoundingClientRect().left,
    right:node.getBoundingClientRect().right,
    viewport:document.documentElement.clientWidth,
    bodyScroll:document.documentElement.scrollWidth
  }));
assert.ok(geometry.left >= -1);
assert.ok(geometry.right <= geometry.viewport + 1);
assert.equal(geometry.bodyScroll, geometry.viewport);
```

Vérifier aussi `min-width`/`min-height >= 44` sur les actions principales et
qu’aucun champ, label ou résultat ne chevauche le suivant.

- [ ] **Step 3: Ajouter le parcours hors ligne rouge**

Dans `tests/pwa-update.playwright.js`, ajouter un cas séparé qui :

1. ouvre `index.html` une première fois avec le catalogue local ;
2. sélectionne une arme, saisit une configuration valide et mémorise le texte
   exact de la contribution affichée ;
3. passe le contexte Playwright hors ligne avec
   `await context.setOffline(true)`;
4. recharge la page ;
5. refait la même saisie dans le builder et exige exactement la même
   contribution ;
6. vérifie qu’aucune requête vers `7ds-stats/*.json` ou `/api/` n’a été émise.

Le fichier `file://` et les scripts locaux doivent continuer à charger quand le
CDN Supabase est indisponible. Ce test ne remplace pas le contrat statique du
précache : les deux preuves sont nécessaires.

- [ ] **Step 4: Vérifier les échecs**

Run:

```powershell
node tests/pwa.test.js
node tests/pwa-update.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: `stats-build.js` absent du précache ou géométrie non encore garantie.

- [ ] **Step 5: Ajouter le catalogue aux ressources essentielles**

Dans `sw.js` :

```js
const CORE_ASSETS = [
  "./", "./index.html",
  "./data.js", "./stats-build.js", "./potentiels.js",
  "./armures-liees.js", "./personnages-meta.js",
  "./supabase-config.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"
];
```

Ne modifier ni `BUILD_VERSION`, ni le cycle d’installation, ni les stratégies
network-first/stale-while-revalidate.

- [ ] **Step 6: Ajuster le CSS mobile uniquement selon les mesures**

Sous `max-width:700px`, garantir :

```css
.weapon-config-modal{width:calc(100% - 16px);max-height:calc(100dvh - 16px)}
.weapon-config-layout{grid-template-columns:minmax(0,1fr)}
.weapon-config-actions{display:grid;grid-template-columns:1fr}
.weapon-config-body,.weapon-config-preview{min-width:0}
```

Ne masquer aucune barre nécessaire à l’intérieur de la modale ; seule la barre
visuelle peut rester invisible selon la convention globale.

- [ ] **Step 7: Documenter le modèle et l’ordre de déploiement**

Mettre à jour `AGENTS.md` avec :

- forme complète de `weaponConfig`;
- cinq statuts et absence de faux zéro ;
- formule segmentée du niveau et cumul de la **promotion** issu uniquement de
  `promotionValues` ;
- plafonds 10/20/30/40/50 issus de `promotionSteps[].reinforceMax` ;
- absence explicite de la progression multiplicative des armures ;
- métadonnées explicites `{fr, family, unit}` et interdiction de déduire l'unité
  depuis le code de stat ou le drapeau incomplet `taux` ;
- contrat `coverage`, `terms`, `totals`, `facts` et signification d'une source
  couverte sans terme ;
- distinction `operation:"add"`/`"multiply"`, `bucket`/`appliesTo` et
  reconstruction générique pilotée par les seaux ;
- invariant strict : chaque total est exactement reconstructible depuis ses
  termes ;
- titre imposé `Apport de l’arme — calcul partiel` tant que seule l'arme est
  couverte ;
- outrepassement multiplicatif et taux séparés ;
- table d'outrepassement `0/500/1000/1750/2500/3750/5000`, avec
  `500 = +5 %` ;
- base d'outrepassement présumée pilotée uniquement par
  `OVERLIMIT_APPLICATION_MODE`, avec son protocole de validation dans le jeu ;
- aucune table `equiplv_N` pour le futur lot armures ; segmentation dérivée de
  `tierBoundaries` et seule origine pilotée plus tard par
  `ARMOR_SEGMENT_ORIGIN_MODE` avec `confidence:"presumed"` ;
- catalogue généré et commande `python generate-stats-build.py`;
- triggers de conservation ;
- ordre SQL → Pages → mise à jour PWA ;
- rollback frontend en conservant les triggers.

- [ ] **Step 8: Exécuter les suites ciblées**

Run:

```powershell
python -m unittest tests/test_generate_stats_build.py
python generate-stats-build.py --check
node tests/stats-build.test.js
node tests/stats-build-schema.test.js
node tests/pwa.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
node tests/pwa-update.playwright.js
```

Expected: toutes les commandes sortent avec code 0.

- [ ] **Step 9: Exécuter la vérification complète**

Run:

```powershell
npm test
git diff --check
git status --short
```

Expected:

- toutes les suites `npm test` vertes ;
- aucune sortie de `git diff --check` ;
- uniquement les fichiers de cette tâche avant le commit.

- [ ] **Step 10: Commit de documentation et PWA**

```powershell
git add sw.js tests/pwa.test.js tests/pwa-update.playwright.js tests/accessibilite-mobile.playwright.js AGENTS.md package.json
git commit -m "docs: rendre les stats d’armes sûres hors ligne et au déploiement"
```

- [ ] **Step 11: Vérifier l’arbre final sans pousser**

Run:

```powershell
npm test
git diff --check
git status --short
git log --oneline -8
```

Expected: tests verts, diff check propre, worktree propre, huit commits du lot
visibles au-dessus du commit de conception. Ne pas fusionner, pousser ou
exécuter le SQL Supabase sans instruction explicite du propriétaire.
