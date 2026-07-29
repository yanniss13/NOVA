# Armes secondaires et changement de build dans le Team Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conserver les trois builds d'un héros d'équipe, permettre leur changement sans perte depuis le Team Builder et ajouter à l'ATK les 30 % d'ATK plate de chacune des deux armes secondaires.

**Architecture:** Les champs historiques du héros restent le miroir du build actif, tandis qu'un dictionnaire `rosterBuilds` contient des instantanés indépendants des trois builds. Le moteur d'arme reste l'unique calculateur de l'ATK de chaque arme ; un agrégateur dédié n'en extrait que `B_Atk_Equip`, crée deux contributions de transfert reconstructibles et marque uniquement l'ATK comme partielle lorsqu'une arme secondaire manque. Les actions roster restent explicites et la protection JSONB est étendue sans nouvelle table ni colonne.

**Tech Stack:** HTML/CSS/JavaScript autonome dans `index.html`, Supabase/PostgreSQL JSONB et RLS, tests Node `vm`, Playwright, Python `pglast`, GitHub Pages/PWA.

## Global Constraints

- Le taux de transfert vaut exactement `3000` dix-millièmes, soit 30 %.
- La valeur transférable inclut niveau, promotion, outrepassement et enchantements `B_Atk_Equip` plats.
- `I_AtkAdd_Rate` et tous les autres codes d'une arme secondaire sont exclus.
- `SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE` vaut initialement `"before-hero-rates"` et reste marqué présumé.
- Un seul build est visible et modifiable à la fois dans le Team Builder.
- Le potentiel reste commun aux trois builds.
- Un changement d'icône n'effectue aucune lecture ni écriture réseau.
- Une arme secondaire manquante ne masque ni PV ni DEF ; seule `B_Atk` est partielle.
- Les champs historiques `weapon`, `weaponConfig`, `armor`, `armorConfig`, `jewel`, `jewelConfig` et `note` restent présents.
- Aucune table, colonne, politique RLS ou dépendance d'exécution n'est ajoutée.
- `index.html` conserve ses fins de ligne existantes ; ne pas normaliser le fichier entier.
- Toute modification de production suit RED → GREEN → REFACTOR et se termine par un commit ciblé.
- Source de vérité : `docs/superpowers/specs/2026-07-29-armes-secondaires-team-builder-design.md`.

## File Structure

- Modify: `index.html` — modèle normalisé, changement de build, moteur, rendu et actions roster.
- Modify: `tests/helpers/load-app.js` — exposition des nouvelles fonctions pures et deux armes synthétiques calculables.
- Modify: `tests/stats-build.test.js` — contrats du modèle, des instantanés, du transfert et de la complétude.
- Modify: `supabase/schema.sql` — préservation de `rosterBuilds` face aux anciennes PWA.
- Modify: `tests/stats-build-schema.test.js` — garde SQL mordante et syntaxe inchangée.
- Modify: `tests/potentiel-commun.playwright.js` — boutons d'arme et état partiel sans compte.
- Modify: `tests/supabase-etape1.playwright.js` — import des trois builds, brouillons, mise à jour/rechargement et conflits roster.
- Modify: `tests/accessibilite-mobile.playwright.js` — cibles tactiles, clavier et absence de débordement.
- Modify: `AGENTS.md` — contrat livré et procédure Supabase/PWA.
- Create: `docs/superpowers/plans/2026-07-29-armes-secondaires-team-builder-progress.md` — suivi durable des tâches.

---

### Task 1: Normaliser et transporter les trois builds

**Files:**
- Modify: `tests/helpers/load-app.js:75-110`
- Modify: `tests/stats-build.test.js:490-615`
- Modify: `index.html:5358-5505`
- Modify: `index.html:5668-5705`

**Interfaces:**
- Consumes: `weaponTypesOf(charId)`, `weaponFolderOf(file)`, `normalizeWeaponConfig()`, `normalizeGearConfigMap()`, `normalizePotentiel()`, `jsonCopy()`.
- Produces:
  - `normalizeBuildFields(charId, weaponType, raw) -> TeamBuild`
  - `teamBuildSnapshot(raw) -> TeamBuild`
  - `storeActiveHeroBuild(hero) -> Hero`
  - `activateHeroBuild(hero, weaponType) -> Hero`
  - `normalizeHero(raw) -> Hero` avec `rosterBuilds` et `activeWeaponType`
  - `rosterHeroSnapshot(entry, weaponType) -> Hero`

- [ ] **Step 1: Exposer les futures fonctions au chargeur `vm`**

Dans `tests/helpers/load-app.js`, ajouter au `HOOK_EXPORT` :

```js
  normalizeBuildFields:typeof normalizeBuildFields === "function"
    ? normalizeBuildFields : undefined,
  teamBuildSnapshot:typeof teamBuildSnapshot === "function"
    ? teamBuildSnapshot : undefined,
  storeActiveHeroBuild:typeof storeActiveHeroBuild === "function"
    ? storeActiveHeroBuild : undefined,
  activateHeroBuild:typeof activateHeroBuild === "function"
    ? activateHeroBuild : undefined,
```

- [ ] **Step 2: Écrire les tests RED du modèle**

Étendre le bloc « copies de roster » de `tests/stats-build.test.js` avec trois
builds distincts :

```js
const DOUBLE_FILE = "7ds-armes/Epees doubles/doubles.webp";
const entry = {
  owner:"user-1",
  charId:"meliodas",
  potentialTier:7,
  builds:{
    Hache:{
      weapon:HACHE_FILE,
      weaponConfig:validConfig(),
      armor:{ Haut:"haut-hache" },
      armorConfig:{ Haut:{ version:1 } },
      jewel:{ Anneau:"anneau-hache" },
      jewelConfig:{ Anneau:{ version:1 } },
      note:"hache",
      favorite:true
    },
    "Epee 1 main":{
      weapon:EPEE_FILE,
      weaponConfig:validConfig({gradeGameId:"grade-sword"}),
      armor:{ Haut:"haut-epee" },
      armorConfig:{},
      jewel:{},
      jewelConfig:{},
      note:"épée",
      favorite:false
    },
    "Epees doubles":{
      weapon:DOUBLE_FILE,
      weaponConfig:validConfig({gradeGameId:"grade-dual"}),
      armor:{ Haut:"haut-double" },
      armorConfig:{},
      jewel:{},
      jewelConfig:{},
      note:"doubles",
      favorite:false
    }
  },
  updatedAt:123
};

const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
assert.deepStrictEqual(Object.keys(snapshot.rosterBuilds).sort(), [
  "Epee 1 main", "Epees doubles", "Hache"
].sort());
assert.strictEqual(snapshot.activeWeaponType, "Hache");
assert.strictEqual(snapshot.note, "hache");
assert.strictEqual("favorite" in snapshot.rosterBuilds.Hache, false);

snapshot.weaponConfig.level = 8;
const switched = plain(hooks.activateHeroBuild(snapshot, "Epee 1 main"));
assert.strictEqual(switched.activeWeaponType, "Epee 1 main");
assert.strictEqual(switched.note, "épée");
const returned = plain(hooks.activateHeroBuild(switched, "Hache"));
assert.strictEqual(returned.weaponConfig.level, 8);
assert.strictEqual(returned.note, "hache");

const legacy = plain(hooks.normalizeHero({
  char:"meliodas",
  weapon:HACHE_FILE,
  weaponConfig:validConfig(),
  potentiel:{tier:7}
}));
assert.deepStrictEqual(Object.keys(legacy.rosterBuilds), ["Hache"]);
assert.strictEqual(legacy.activeWeaponType, "Hache");
```

Ajouter aussi :

```js
const changedCharacter = plain(hooks.normalizeHero({
  ...snapshot,
  char:"merlin"
}));
assert.deepStrictEqual(changedCharacter.rosterBuilds, {});
assert.strictEqual(changedCharacter.weapon, null);
```

- [ ] **Step 3: Vérifier RED**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: FAIL parce que `rosterBuilds`, `activeWeaponType` et
`activateHeroBuild()` n'existent pas.

- [ ] **Step 4: Extraire la normalisation d'un build sans récursion**

Dans `index.html`, avant `normalizeHero()`, créer :

```js
const TEAM_BUILD_FIELDS = [
  "weapon", "weaponConfig",
  "armor", "armorConfig",
  "jewel", "jewelConfig",
  "note"
];

function normalizeBuildFields(charId, weaponType, raw){
  const source = raw && typeof raw === "object" ? raw : {};
  const knownWeapons = Object.values(compatibleWeaponGroups(charId)).flat();
  const candidateType = weaponFolderOf(source.weapon);
  const weapon = (!weaponType || candidateType === weaponType)
    && knownWeapons.some(item => item.file === source.weapon)
    ? source.weapon
    : null;
  const armor = Object.assign(emptyArmor(), source.armor || {});
  if(!isLinkedArmorCompatible(charId, armor[LINKED_ARMOR_SLOT])){
    armor[LINKED_ARMOR_SLOT] = null;
  }
  const jewel = Object.assign(emptyJewel(), source.jewel || {});
  return {
    weapon,
    weaponConfig:weapon
      ? normalizeWeaponConfig(weapon, source.weaponConfig)
      : null,
    armor,
    armorConfig:normalizeGearConfigMap(
      armor, source.armorConfig, ARMOR_SLOTS
    ),
    jewel,
    jewelConfig:normalizeGearConfigMap(
      jewel, source.jewelConfig, JEWEL_SLOTS
    ),
    note:typeof source.note === "string" ? source.note : ""
  };
}

function teamBuildSnapshot(raw){
  const source = raw && typeof raw === "object" ? raw : {};
  const defaults = {
    weapon:null,
    weaponConfig:null,
    armor:emptyArmor(),
    armorConfig:{},
    jewel:emptyJewel(),
    jewelConfig:{},
    note:""
  };
  return TEAM_BUILD_FIELDS.reduce((copy, field) => {
    copy[field] = jsonCopy(
      Object.prototype.hasOwnProperty.call(source, field)
        ? source[field]
        : defaults[field]
    );
    return copy;
  }, {});
}
```

Refactorer `normalizeRosterBuild()` pour appeler `normalizeBuildFields()` puis
ajouter uniquement `favorite`. Ne pas faire appeler `normalizeHero()` par
`normalizeRosterBuild()`, sinon `normalizeHero()` et `normalizeRosterBuild()`
se rappellent mutuellement.

- [ ] **Step 5: Étendre `normalizeHero()`**

Implémenter les règles suivantes :

```js
function normalizeHero(raw){
  const source = raw && typeof raw === "object" ? raw : {};
  const char = source.char || null;
  const allowed = weaponTypesOf(char);
  const equippedType = weaponFolderOf(source.weapon);
  const storedType = allowed.includes(source.activeWeaponType)
    ? source.activeWeaponType : null;
  const activeWeaponType = allowed.includes(equippedType)
    ? equippedType : storedType;
  const rosterBuilds = {};

  if(source.rosterBuilds && typeof source.rosterBuilds === "object"
    && !Array.isArray(source.rosterBuilds)){
    allowed.forEach(type => {
      if(Object.prototype.hasOwnProperty.call(source.rosterBuilds, type)){
        rosterBuilds[type] = teamBuildSnapshot(
          normalizeBuildFields(char, type, source.rosterBuilds[type])
        );
      }
    });
  }

  const active = normalizeBuildFields(char, activeWeaponType, source);
  if(activeWeaponType){
    rosterBuilds[activeWeaponType] = teamBuildSnapshot(active);
  }
  return Object.assign({
    char,
    rosterBuilds,
    activeWeaponType,
    potentiel:normalizePotentiel(source.potentiel)
  }, active);
}
```

Si `char` change dans une interaction, la Task 5 videra explicitement le
dictionnaire avant d'appeler cette normalisation. La normalisation seule ne
doit conserver que les types et armes compatibles.

- [ ] **Step 6: Ajouter les deux primitives de changement**

```js
function storeActiveHeroBuild(hero){
  if(!hero || !hero.char) return hero;
  const type = weaponFolderOf(hero.weapon) || hero.activeWeaponType;
  if(!weaponTypesOf(hero.char).includes(type)) return hero;
  if(!hero.rosterBuilds || typeof hero.rosterBuilds !== "object"){
    hero.rosterBuilds = {};
  }
  hero.rosterBuilds[type] = teamBuildSnapshot(
    normalizeBuildFields(hero.char, type, hero)
  );
  hero.activeWeaponType = type;
  return hero;
}

function activateHeroBuild(hero, weaponType){
  if(!hero || !weaponTypesOf(hero.char).includes(weaponType)) return hero;
  storeActiveHeroBuild(hero);
  const target = normalizeBuildFields(
    hero.char,
    weaponType,
    hero.rosterBuilds && hero.rosterBuilds[weaponType]
  );
  Object.assign(hero, teamBuildSnapshot(target), {
    activeWeaponType:weaponType
  });
  return hero;
}
```

- [ ] **Step 7: Copier les trois builds depuis le roster**

Dans `rosterHeroSnapshot()` :

```js
const rosterBuilds = Object.keys(normalized.builds).reduce((result, type) => {
  result[type] = teamBuildSnapshot(normalized.builds[type]);
  return result;
}, {});
return normalizeHero({
  char:normalized.charId,
  ...teamBuildSnapshot(normalized.builds[weaponType]),
  rosterBuilds,
  activeWeaponType:weaponType,
  potentiel:{tier:normalized.potentialTier}
});
```

Ajouter `rosterBuilds:{}` et `activeWeaponType:null` à `emptyHero()`.
`normalizeTeam()`, `teamToCloudRow()`, la duplication et les instantanés de boss
doivent continuer à copier le JSON complet sans liste blanche supplémentaire.

- [ ] **Step 8: Vérifier GREEN et les frontières JSON**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: PASS, y compris mutation indépendante des trois builds et conservation
dans la copie d'équipe.

- [ ] **Step 9: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: conserver les trois builds d'un héros"
```

Mettre Task 1 à `[x]` dans le fichier de progression.

---

### Task 2: Protéger `rosterBuilds` contre les anciennes PWA

**Files:**
- Modify: `tests/stats-build-schema.test.js:1-176`
- Modify: `supabase/schema.sql:190-245`

**Interfaces:**
- Consumes: trigger `private.preserve_team_weapon_configs()`.
- Produces: préservation imbriquée de `teams.data.heroes[index].rosterBuilds`.

- [ ] **Step 1: Écrire le contrat SQL RED**

Dans `tests/stats-build-schema.test.js`, après les assertions de
`weaponConfig`, ajouter :

```js
assert.match(
  teamFunction,
  /v_new_hero->>'char'\s+is\s+not\s+distinct\s+from\s+v_old_hero->>'char'[\s\S]*not\s*\(\s*v_new_hero\s*\?\s*'rosterBuilds'\s*\)[\s\S]*v_old_hero\s*\?\s*'rosterBuilds'/i,
  "rosterBuilds omis n'est préservé que pour le même personnage"
);
assert.match(
  teamFunction,
  /jsonb_set\(\s*new\.data\s*,\s*array\['heroes'\s*,\s*v_index::text\s*,\s*'rosterBuilds'\]\s*,\s*v_old_hero->'rosterBuilds'\s*,\s*true\s*\)/i
);
assert.doesNotMatch(
  teamFunction,
  /coalesce\(\s*v_new_hero->'rosterBuilds'/i,
  "un null explicite ne doit pas être remplacé"
);
```

Ajouter une mutation mordante :

```js
const withoutRosterBuildsGuard = teamFunction.replace(
  /if\s+not\s*\(\s*v_new_hero\s*\?\s*'rosterBuilds'\s*\)[\s\S]*?end if\s*;/i,
  ""
);
assert.throws(
  () => assertTeamRosterBuildsGuard(withoutRosterBuildsGuard),
  /rosterBuilds/
);
```

La fonction `assertTeamRosterBuildsGuard(body)` regroupe exactement les deux
assertions positives ci-dessus.

- [ ] **Step 2: Vérifier RED**

Run:

```powershell
node tests/stats-build-schema.test.js
```

Expected: FAIL sur l'absence de `rosterBuilds` dans le trigger.

- [ ] **Step 3: Étendre le trigger idempotent**

Dans la branche déjà protégée par :

```sql
if v_new_hero->>'char' is not distinct from v_old_hero->>'char' then
```

ajouter avant les configs d'armure :

```sql
      -- Une PWA antérieure aux armes secondaires réécrit le héros sans ce
      -- dictionnaire. Une clé null explicite reste une suppression volontaire.
      if not (v_new_hero ? 'rosterBuilds')
         and v_old_hero ? 'rosterBuilds'
      then
        new.data := jsonb_set(
          new.data,
          array['heroes', v_index::text, 'rosterBuilds'],
          v_old_hero->'rosterBuilds',
          true
        );
        v_new_hero := new.data->'heroes'->v_index;
      end if;
```

Ne pas toucher au trigger du roster : ses trois builds vivent déjà dans
`roster_characters.builds`.

- [ ] **Step 4: Vérifier GREEN et la syntaxe PostgreSQL**

Run:

```powershell
node tests/stats-build-schema.test.js
python -m unittest tests/test_schema_sql.py
```

Expected: PASS des deux commandes.

- [ ] **Step 5: Commit**

```powershell
git add supabase/schema.sql tests/stats-build-schema.test.js
git commit -m "fix: préserver les trois builds d'équipe"
```

Mettre Task 2 à `[x]` dans le fichier de progression.

---

### Task 3: Calculer le transfert reconstructible de 30 %

**Files:**
- Modify: `tests/helpers/load-app.js:375-440`
- Modify: `tests/stats-build.test.js:1280-1590`
- Modify: `index.html:3580-3855`

**Interfaces:**
- Consumes: `calculateWeaponStats(file, config)`, `weaponTypesOf(charId)`,
  `reconstructStatTotals(terms)`.
- Produces:
  - `SECONDARY_WEAPON_ATTACK_TRANSFER_RATE = 3000`
  - `SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE = "before-hero-rates"`
  - `secondaryWeaponAttackResult(hero, activeWeaponType)`
  - `calculateHeroStats()` avec `status:"partial"` et `partialStats`.

- [ ] **Step 1: Ajouter deux armes synthétiques calculables au bac à sable**

Dans `tests/helpers/load-app.js`, extraire le grade synthétique dans une
fabrique de test :

```js
function testWeaponDefinition(gameId, base, percentOption){
  return {
    mainStat:"attack",
    mainStatCode:"B_Atk_Equip",
    passiveLevels:[],
    gradesByGameId:{
      [gameId]:{
        gameId,
        mainStatValues:{
          base,
          max:base + 50,
          progression:[1, 1, 1, 1, 1]
        },
        subStats:[],
        promotionSteps:[
          { reinforceMax:20 }, { reinforceMax:30 },
          { reinforceMax:40 }, { reinforceMax:50 }
        ],
        promotionValues:{base:5,max:55,progression:[5,10,15,20]},
        overlimit:{levels:[
          {level:0,passiveLevel:1,statRate:0},
          {level:1,passiveLevel:2,statRate:500}
        ]},
        enchantments:{
          type:"basic",
          slots:[10000],
          options:[
            {stat:"B_Atk_Equip",min:1,max:1000},
            ...(percentOption
              ? [{stat:"I_AtkAdd_Rate",min:1,max:5000}]
              : [])
          ]
        }
      }
    }
  };
}
```

Ajouter aux `weaponsByFile` synthétiques :

```js
"7ds-armes/Epee 1 main/epee.webp":
  testWeaponDefinition("grade-sword", 100, true),
"7ds-armes/Epees doubles/doubles.webp":
  testWeaponDefinition("grade-dual", 200, true),
```

Ajouter les métadonnées `I_AtkAdd_Rate` nécessaires au catalogue synthétique si
elles ne viennent pas déjà du catalogue réel.

- [ ] **Step 2: Écrire le test RED de la formule**

Dans la fixture de héros complet, ajouter :

```js
hero.activeWeaponType = "Hache";
hero.rosterBuilds = {
  Hache:plain(hooks.teamBuildSnapshot(hero)),
  "Epee 1 main":{
    ...plain(hooks.teamBuildSnapshot(hero)),
    weapon:EPEE_FILE,
    weaponConfig:{
      version:1,
      gradeGameId:"grade-sword",
      level:10,
      promotion:1,
      overlimit:1,
      enchantments:[{
        slot:0, tier:null, element:null,
        stat:"B_Atk_Equip", value:100
      }]
    }
  },
  "Epees doubles":{
    ...plain(hooks.teamBuildSnapshot(hero)),
    weapon:DOUBLE_FILE,
    weaponConfig:{
      version:1,
      gradeGameId:"grade-dual",
      level:0,
      promotion:0,
      overlimit:0,
      enchantments:[{
        slot:0, tier:null, element:null,
        stat:"I_AtkAdd_Rate", value:3000
      }]
    }
  }
};
```

Puis :

```js
const result = plain(hooks.calculateHeroStats(hero));
const transfers = result.terms.filter(term =>
  term.source.domain === "secondary-weapon"
);
assert.strictEqual(transfers.length, 2);
assert.deepStrictEqual(
  transfers.map(term => term.source.transferRate),
  [3000, 3000]
);
transfers.forEach(term => {
  assert.strictEqual(term.stat, "B_Atk");
  assert.strictEqual(term.operation, "add");
  assert.strictEqual(term.unit, "flat");
  assert.strictEqual(
    term.value,
    term.source.originalValue * 3000 / 10000
  );
});
assert.strictEqual(
  result.terms.some(term =>
    term.source.domain === "secondary-weapon"
    && term.source.originalStat === "I_AtkAdd_Rate"
  ),
  false
);
assert.deepStrictEqual(
  plain(hooks.reconstructStatTotals(result.terms)),
  result.totals
);
assert.ok(result.coverage.includes("secondary-weapon"));
assert.deepStrictEqual(result.partialStats, []);
```

Créer une seconde variante où l'enchantement de l'épée passe de
`B_Atk_Equip:100` à `I_AtkAdd_Rate:100`. La contribution transférée doit baisser
exactement de `30`, sans autre changement.

- [ ] **Step 3: Écrire le test RED de complétude par statistique**

```js
const missingSecondary = plain(hero);
delete missingSecondary.rosterBuilds["Epees doubles"];
const partial = plain(hooks.calculateHeroStats(missingSecondary));
assert.strictEqual(partial.status, "partial");
assert.deepStrictEqual(partial.partialStats, ["B_Atk"]);
assert.ok(partial.missing.includes(
  "rosterBuilds.Epees doubles.weapon"
));
assert.ok(partial.uncovered.includes(
  "secondary-weapon:Epees doubles"
));
assert.strictEqual(partial.coverage.includes("secondary-weapon"), false);
assert.ok(partial.totals.some(total => total.stat === "B_MaxHp"));
assert.ok(partial.totals.some(total => total.stat === "B_Def"));
assert.ok(partial.totals.some(total => total.stat === "B_Atk"));
```

Conserver les tests existants : une armure, un bijou ou le build actif
incomplet continue à produire `terms:[]` et `totals:[]`.

- [ ] **Step 4: Vérifier RED**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: FAIL sur l'absence de termes `secondary-weapon` et de
`partialStats`.

- [ ] **Step 5: Implémenter le calcul secondaire isolé**

Avant `calculateHeroStats()` :

```js
const SECONDARY_WEAPON_ATTACK_TRANSFER_RATE = 3000;
const SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE =
  "before-hero-rates";

function secondaryWeaponAttackResult(hero, activeWeaponType){
  const terms = [];
  const missing = [];
  const uncovered = [];
  weaponTypesOf(hero.char)
    .filter(type => type !== activeWeaponType)
    .forEach(type => {
      const build = hero.rosterBuilds && hero.rosterBuilds[type];
      if(!build || !build.weapon){
        missing.push("rosterBuilds."+type+".weapon");
        uncovered.push("secondary-weapon:"+type);
        return;
      }
      const weapon = calculateWeaponStats(build.weapon, build.weaponConfig);
      if(weapon.status !== "valid"){
        missing.push("rosterBuilds."+type+".weaponConfig");
        uncovered.push("secondary-weapon:"+type);
        return;
      }
      const attack = weapon.totals.find(total =>
        total.stat === "B_Atk_Equip" && total.unit === "flat"
      );
      if(!attack){
        missing.push("rosterBuilds."+type+".weaponConfig");
        uncovered.push("secondary-weapon:"+type);
        return;
      }
      const metadata = buildStatMetadata("B_Atk");
      terms.push({
        id:"secondary-weapon:"+type+":attack-transfer",
        stat:"B_Atk",
        operation:"add",
        value:attack.value
          * SECONDARY_WEAPON_ATTACK_TRANSFER_RATE / 10000,
        unit:"flat",
        bucket:"secondary-weapon:"+type,
        family:metadata.family,
        source:{
          domain:"secondary-weapon",
          component:"attack-transfer",
          weaponType:type,
          file:build.weapon,
          originalStat:"B_Atk_Equip",
          originalValue:attack.value,
          transferRate:SECONDARY_WEAPON_ATTACK_TRANSFER_RATE
        },
        confidence:"exact"
      });
    });
  return {terms, missing, uncovered};
}
```

Ajouter un commentaire `PRÉSUMÉ, NON VÉRIFIÉ` au paramètre d'application avec
le protocole Merlin de la spec.

- [ ] **Step 6: Brancher sans affaiblir les gardes existants**

Après validation complète du build actif dans `calculateHeroStats()` :

```js
const secondary = secondaryWeaponAttackResult(source, weaponType);
const rawTerms = characterBaseTerms(character)
  .concat(fullMasteryTerms(character, weaponType))
  .concat(potentialTerms(character, weaponType, potentialTier))
  .concat(build.terms.map(canonicalHeroTerm))
  .concat(secondary.terms);
```

Le mode `"before-hero-rates"` laisse `heroMainRateTargetBuckets()` inclure les
seaux `secondary-weapon:*`. Tout autre mode lève
`SECONDARY_WEAPON_TRANSFER_MODE_INVALID`.

Retourner :

```js
status:secondary.missing.length ? "partial" : "valid",
coverage:secondary.missing.length
  ? [...HERO_STAT_COVERAGE]
  : [...HERO_STAT_COVERAGE, "secondary-weapon"],
uncovered:[
  ...new Set(build.uncovered.concat(secondary.uncovered))
],
missing:secondary.missing,
partialStats:secondary.missing.length ? ["B_Atk"] : [],
```

Ajouter `partialStats:[]` à `emptyHeroStatResult()`.

- [ ] **Step 7: Vérifier GREEN**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: PASS de la formule, de l'exclusion des taux, de la reconstruction et
des anciennes erreurs tout-ou-rien.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js
git commit -m "feat: calculer l'ATK des armes secondaires"
```

Mettre Task 3 à `[x]` dans le fichier de progression.

---

### Task 4: Rendre le résultat partiel impossible à confondre

**Files:**
- Modify: `tests/stats-build.test.js:1390-1550`
- Modify: `tests/potentiel-commun.playwright.js:130-285`
- Modify: `index.html:1230-1450`
- Modify: `index.html:3860-4115`

**Interfaces:**
- Consumes: `calculateHeroStats(hero).status`, `.partialStats`, `.terms`.
- Produces: carte ATK partielle, titre partiel et libellé détaillé du transfert.

- [ ] **Step 1: Écrire les assertions RED du rendu pur**

Dans `tests/stats-build.test.js` :

```js
const partialSection = hooks.heroStatsSection(missingSecondary);
assert.strictEqual(
  hooks.heroStatsTitle(partial),
  "Statistiques du héros — calcul partiel"
);
const attackCard = fakeNodes(partialSection, node =>
  node.className && node.className.includes("hero-stat-card")
    && /ATK/.test(fakeText(node))
)[0];
assert.ok(attackCard);
assert.match(
  fakeText(attackCard),
  /calcul incomplet — arme secondaire manquante/i
);
const hpAndDef = fakeNodes(partialSection, node =>
  node.className && node.className.includes("hero-stat-card")
    && /(?:PV|DEF)/.test(fakeText(node))
);
assert.strictEqual(hpAndDef.length, 2);
hpAndDef.forEach(card =>
  assert.doesNotMatch(fakeText(card), /arme secondaire manquante/i)
);

const completeSection = hooks.heroStatsSection(hero);
assert.match(
  fakeText(completeSection),
  /secondaire.*×\s*30\s*%.*=\s*\+/i
);
```

- [ ] **Step 2: Vérifier RED**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: FAIL sur l'ancien titre et l'absence du libellé ATK partiel.

- [ ] **Step 3: Étendre le rendu**

Modifier `heroStatsTitle(result)` :

```js
if(result && result.status === "partial"){
  return "Statistiques du héros — calcul partiel";
}
```

Dans `heroStatsSection()`, traiter `"partial"` comme un résultat chiffré
affichable :

```js
const hasNumericResult =
  result.status === "valid" || result.status === "partial";
if(!hasNumericResult){
  const details = result.missing.length
    ? " À compléter : "+result.missing.join(", ")+"."
    : "";
  section.appendChild(el("p",{
    class:"weapon-stats-state",
    text:(result.status === "incomplete"
      ? "Équipe et configure les neuf pièces pour obtenir une valeur fiable."
      : "Les données de cette configuration ne peuvent pas être calculées.")
      +details
  }));
  return section;
}
```

Le corps ci-dessus est le chemin actuel, recopié sans changer ses messages ;
seule sa condition d'entrée est élargie.

Lors de la création des trois cartes principales, déterminer :

```js
const partial = (result.partialStats || []).includes(total.stat);
```

Pour `B_Atk`, ajouter dans la carte :

```js
partial
  ? "calcul incomplet — arme secondaire manquante"
  : "borne inférieure"
```

PV et DEF conservent « borne inférieure ». Dans la décomposition d'un terme
`source.domain === "secondary-weapon"`, rendre :

```text
<type> secondaire : <originalValue> ATK × 30 % = +<value> ATK
```

Réutiliser `formatBuildStatValue()` et le format français existant ; ne pas
arrondir la valeur du moteur.

- [ ] **Step 4: Ajouter le contrat navigateur sans compte**

Dans `tests/potentiel-commun.playwright.js`, injecter par `page.evaluate()` une
ancienne équipe ne portant que le build actif, puis ouvrir son détail. Vérifier :

```js
await expectText(
  page.locator(".hero-stats-title"),
  /calcul partiel/i
);
assert.match(
  await page.locator(".hero-stat-card")
    .filter({hasText:"ATK"}).innerText(),
  /arme secondaire manquante/i
);
assert.doesNotMatch(
  await page.locator(".hero-stat-card")
    .filter({hasText:"PV"}).innerText(),
  /arme secondaire manquante/i
);
```

Utiliser les helpers d'assertion déjà présents dans ce fichier, pas `expect` de
Playwright Test.

- [ ] **Step 5: Vérifier GREEN**

Run:

```powershell
node tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
```

Expected: PASS des deux commandes.

- [ ] **Step 6: Commit**

```powershell
git add index.html tests/stats-build.test.js tests/potentiel-commun.playwright.js
git commit -m "feat: signaler l'ATK secondaire incomplète"
```

Mettre Task 4 à `[x]` dans le fichier de progression.

---

### Task 5: Changer de build par les trois icônes sans perte

**Files:**
- Modify: `tests/helpers/load-app.js:75-115`
- Modify: `tests/stats-build.test.js:330-390`
- Modify: `tests/supabase-etape1.playwright.js:1450-1700`
- Modify: `index.html:850-1030`
- Modify: `index.html:2050-2140`
- Modify: `index.html:7150-7470`

**Interfaces:**
- Consumes: `storeActiveHeroBuild()`, `activateHeroBuild()`,
  `weaponTypesOf()`, `weaponSlotBadge()`, `renderBuilder()`.
- Produces:
  - `applyCharacterChange(hero, nextChar) -> Hero`
  - `builderWeaponSwitcher(hero, heroIndex, character) -> HTMLElement`
  - `switchBuilderHeroBuild(heroIndex, weaponType)`

- [ ] **Step 1: Écrire le test RED de changement de personnage**

Exposer `applyCharacterChange` dans le chargeur, puis ajouter :

```js
const changed = plain(hooks.applyCharacterChange(snapshot, "merlin"));
assert.strictEqual(changed.char, "merlin");
assert.deepStrictEqual(changed.rosterBuilds, {});
assert.strictEqual(changed.weapon, null);
assert.strictEqual(changed.activeWeaponType, null);
assert.strictEqual(changed.potentiel.tier, snapshot.potentiel.tier);
```

- [ ] **Step 2: Vérifier RED du helper**

Run:

```powershell
node tests/stats-build.test.js
```

Expected: FAIL car `applyCharacterChange()` n'existe pas.

- [ ] **Step 3: Implémenter le changement de personnage**

```js
function applyCharacterChange(hero, nextChar){
  const next = jsonCopy(normalizeHero(hero));
  if(next.char === nextChar) return next;
  next.char = nextChar || null;
  next.rosterBuilds = {};
  next.activeWeaponType = null;
  if(!isWeaponCompatible(next.char, next.weapon)){
    next.weapon = null;
    next.weaponConfig = null;
  }
  if(!isLinkedArmorCompatible(
    next.char,
    next.armor && next.armor[LINKED_ARMOR_SLOT]
  )){
    next.armor[LINKED_ARMOR_SLOT] = null;
    delete next.armorConfig[LINKED_ARMOR_SLOT];
  }
  return normalizeHero(next);
}
```

Ce code conserve exactement le comportement historique : armures génériques,
bijoux, note, potentiel et arme encore compatible restent en place. Il vide
obligatoirement `rosterBuilds`, et retire seulement l'arme devenue incompatible
ainsi que l'armure liée devenue incompatible.

- [ ] **Step 4: Remplacer la rangée passive par des boutons dans le builder**

Créer `builderWeaponSwitcher()` sans modifier `badgesRow()` dans les vues
lecture seule :

```js
function builderWeaponSwitcher(hero, heroIndex, character){
  const row = el("div",{
    class:"hero-badges builder-weapon-switcher",
    role:"group",
    "aria-label":"Builds par type d'arme"
  });
  const slots = el("div",{class:"wslots"});
  const activeType = weaponFolderOf(hero.weapon) || hero.activeWeaponType;
  (metaOf(character.id).weapons || []).forEach(slot => {
    const type = ENUM_TO_FOLDER[slot.weapon];
    const badge = weaponSlotBadge(slot, type === activeType);
    const button = el("button",{
      class:"builder-weapon-switch"
        +(type === activeType ? " active" : ""),
      type:"button",
      dataset:{weaponType:type},
      "aria-pressed":String(type === activeType),
      title:"Afficher le build "+rosterWeaponLabel(type),
      onclick:()=>switchBuilderHeroBuild(heroIndex, type)
    }, [badge]);
    slots.appendChild(button);
  });
  row.appendChild(slots);
  return row;
}
```

Ajouter une constante inverse unique :

```js
const ENUM_TO_FOLDER = Object.fromEntries(
  Object.entries(FOLDER_TO_ENUM).map(([folder, value]) => [value, folder])
);
```

Dans `heroCard()`, remplacer seulement le `badgesRow(..., false)` du builder par
`builderWeaponSwitcher()`.

- [ ] **Step 5: Sauvegarder avant de changer**

```js
function switchBuilderHeroBuild(heroIndex, weaponType){
  const hero = draft.heroes[heroIndex];
  if(!hero || hero.activeWeaponType === weaponType) return;
  draft.heroes[heroIndex] = activateHeroBuild(hero, weaponType);
  renderBuilder();
  const active = heroGrid.children[heroIndex]
    .querySelector(
      '.builder-weapon-switch[data-weapon-type="'
      + cssEscape(weaponType) + '"]'
    );
  if(active) active.focus();
}
```

Ne pas utiliser un sélecteur construit avec une valeur non échappée si
`CSS.escape` est absent en `file://` ; préférer chercher dans
`querySelectorAll()` par comparaison de `dataset.weaponType`.

Modifier `pickWeapon()` pour n'afficher que le groupe de
`hero.activeWeaponType` lorsqu'il est défini. Le bouton change l'arme précise
du type, jamais le type actif.

Le repère sale est ajouté dans la Task 6, une fois les baselines roster
disponibles. Aucun booléen sale n'est persisté dans le héros.

- [ ] **Step 6: Ajouter le test Playwright A → B → A**

Dans `tests/supabase-etape1.playwright.js`, créer une entrée Meliodas avec trois
builds, importer Hache, puis :

```js
const hero = page.locator("#heroGrid .hero").first();
const hache = hero.locator(
  '.builder-weapon-switch[data-weapon-type="Hache"]'
);
const sword = hero.locator(
  '.builder-weapon-switch[data-weapon-type="Epee 1 main"]'
);
assert.equal(await hache.getAttribute("aria-pressed"), "true");

await hero.locator(".weapon-config-open").click();
await page.locator(".weapon-config-level").fill("8");
await page.locator("#weaponConfigSave").click();
await sword.click();
assert.equal(await sword.getAttribute("aria-pressed"), "true");
assert.match(await hero.innerText(), /épée/i);
await hache.click();
await hero.locator(".weapon-config-open").click();
assert.equal(
  await page.locator(".weapon-config-level").inputValue(),
  "8"
);
```

Capturer `location.href` avant et après ; il doit rester identique. Vérifier que
le focus est sur l'icône activée et que les clics n'ont ajouté aucun appel
Supabase dans `window.__fakeSupabaseState.calls`.

- [ ] **Step 7: Vérifier GREEN**

Run:

```powershell
node tests/stats-build.test.js
node tests/supabase-etape1.playwright.js
```

Expected: PASS et aucun rechargement.

- [ ] **Step 8: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js tests/supabase-etape1.playwright.js
git commit -m "feat: changer de build depuis une équipe"
```

Mettre Task 5 à `[x]` dans le fichier de progression.

---

### Task 6: Mettre à jour ou recharger le roster explicitement

**Files:**
- Modify: `tests/supabase-etape1.playwright.js:1450-1700`
- Modify: `tests/accessibilite-mobile.playwright.js:480-890`
- Modify: `index.html:1000-1120`
- Modify: `index.html:5660-5730`
- Modify: `index.html:7150-7300`
- Modify: `index.html:7900-7960`

**Interfaces:**
- Consumes: `MemberRosterStore.refresh()`, `MemberRosterStore.upsert()`,
  `normalizeRosterCharacter()`, `normalizeRosterBuild()`,
  `rosterHeroSnapshot()`.
- Produces:
  - `builderRosterBaselines`
  - `updateBuilderHeroRoster(heroIndex)`
  - `reloadBuilderHeroFromRoster(heroIndex)`
  - actions visibles « Mettre à jour mon roster » et
    « Recharger depuis mon roster ».

- [ ] **Step 1: Écrire le scénario RED d'écriture ciblée**

Après le scénario A → B → A, capturer les deux builds inactifs :

```js
const before = await page.evaluate(() => {
  const row = window.__fakeSupabaseState.roster_characters.find(item =>
    item.owner === "user-1" && item.char_id === "meliodas"
  );
  return {
    sword:JSON.stringify(row.builds["Epee 1 main"]),
    dual:JSON.stringify(row.builds["Epees doubles"])
  };
});
await hero.getByRole("button", {
  name:"Mettre à jour mon roster",
  exact:true
}).click();
await page.waitForFunction(() => {
  const row = window.__fakeSupabaseState.roster_characters.find(item =>
    item.owner === "user-1" && item.char_id === "meliodas"
  );
  return row.builds.Hache.weaponConfig.level === 8;
});
const after = await page.evaluate(() => {
  const row = window.__fakeSupabaseState.roster_characters.find(item =>
    item.owner === "user-1" && item.char_id === "meliodas"
  );
  return {
    sword:JSON.stringify(row.builds["Epee 1 main"]),
    dual:JSON.stringify(row.builds["Epees doubles"])
  };
});
assert.deepStrictEqual(after, before);
```

Changer le potentiel avant l'action et vérifier `potential_tier`.

Passer temporairement le contexte hors ligne et vérifier que
`.hero-roster-update` est désactivé, puis restaurer la connexion :

```js
await page.context().setOffline(true);
await page.evaluate(() => window.dispatchEvent(new Event("offline")));
assert.equal(await hero.locator(".hero-roster-update").isDisabled(), true);
await page.context().setOffline(false);
await page.evaluate(() => window.dispatchEvent(new Event("online")));
```

- [ ] **Step 2: Écrire les scénarios RED de rechargement et conflit**

1. Modifier localement Hache et Épée.
2. Cliquer « Recharger depuis mon roster ».
3. Refuser la confirmation : les deux brouillons restent modifiés.
4. Accepter : les trois redeviennent identiques au roster.
5. Modifier `updated_at` du roster dans le faux Supabase après ouverture.
6. Cliquer « Mettre à jour mon roster ».
7. Refuser le conflit : aucun upsert.
8. Accepter l'écrasement : un seul upsert et seul le build actif change.

Assertions obligatoires :

```js
assert.equal(upsertsAfterRefusal, upsertsBefore);
assert.equal(await page.locator("#view-builder").isVisible(), true);
assert.match(await page.locator("#toast").innerText(), /roster.*modifi/i);
```

- [ ] **Step 3: Vérifier RED**

Run:

```powershell
node tests/supabase-etape1.playwright.js
```

Expected: FAIL car les deux actions n'existent pas.

- [ ] **Step 4: Ajouter les baselines de session**

À côté de `teamDraftInitialJson` :

```js
let builderRosterBaselines = Array.from(
  {length:TEAM_SIZE},
  () => ({updatedAt:0, builds:{}})
);
```

Créer :

```js
function resetBuilderRosterBaselines(){
  builderRosterBaselines = draft.heroes.map(hero => {
    const entry = currentUser && hero.char
      ? MemberRosterStore.all(currentUser.id)
        .find(item => item.charId === hero.char)
      : null;
    return {
      updatedAt:Number(entry && entry.updatedAt) || 0,
      builds:entry
        ? jsonCopy(entry.builds)
        : {}
    };
  });
}
```

L'appeler dans `resetTeamDraft()`, `editTeam()`, `duplicateTeam()` et après
`loadRosterHero()`. Pour une nouvelle équipe, les baselines sont vides.

Le repère sale compare `teamBuildSnapshot(hero.rosterBuilds[type])` à
`builderRosterBaselines[index].builds[type]` par JSON canonique normalisé.

Ajouter :

```js
function builderBuildIsDirty(index, type){
  const hero = draft.heroes[index];
  const activeType = hero
    && (weaponFolderOf(hero.weapon) || hero.activeWeaponType);
  const current = type === activeType
    ? teamBuildSnapshot(hero)
    : hero && hero.rosterBuilds && hero.rosterBuilds[type];
  const baseline = builderRosterBaselines[index]
    && builderRosterBaselines[index].builds[type];
  return JSON.stringify(teamBuildSnapshot(current || {}))
    !== JSON.stringify(teamBuildSnapshot(baseline || {}));
}
```

`builderWeaponSwitcher()` ajoute la classe `dirty` et le suffixe accessible
« modifié » au bouton concerné. Le CSS place un petit point dans le coin sans
diminuer la cible de 44 px :

```css
.builder-weapon-switch{position:relative;min-width:44px;min-height:44px}
.builder-weapon-switch.dirty::after{
  content:"";position:absolute;right:2px;top:2px;width:7px;height:7px;
  border-radius:50%;background:var(--gold);box-shadow:0 0 0 2px #15121c;
}
```

- [ ] **Step 5: Implémenter la mise à jour ciblée**

`updateBuilderHeroRoster(index)` :

1. refuser si compte/Supabase absent ou `navigator.onLine === false` ;
2. appeler `storeActiveHeroBuild(hero)` ;
3. rafraîchir le roster propriétaire ;
4. comparer `latest.updatedAt` à la baseline du slot ;
5. demander confirmation si la version distante a changé ;
6. partir d'une copie de l'entrée distante ou d'une nouvelle entrée ;
7. remplacer uniquement `builds[hero.activeWeaponType]` ;
8. conserver son booléen `favorite` existant ;
9. écrire le potentiel commun ;
10. appeler `MemberRosterStore.upsert(next)` ;
11. mettre à jour la baseline du seul type et `updatedAt` ;
12. rendre le builder et annoncer le succès.

La construction ciblée doit être pure :

```js
function rosterEntryWithActiveHeroBuild(existing, hero, ownerId){
  const type = hero.activeWeaponType || weaponFolderOf(hero.weapon);
  const next = normalizeRosterCharacter(existing || {
    owner:ownerId,
    charId:hero.char,
    potentialTier:0,
    builds:{}
  });
  const favorite = !!(
    next.builds[type] && next.builds[type].favorite
  );
  next.potentialTier = normalizePotentiel(hero.potentiel).tier;
  next.builds[type] = Object.assign(
    normalizeRosterBuild(hero.char, type, hero),
    {favorite}
  );
  return next;
}
```

Exposer cette fonction dans `tests/helpers/load-app.js` et ajouter un test pur
qui compare byte-for-byte les deux builds non ciblés.

- [ ] **Step 6: Implémenter le rechargement complet**

`reloadBuilderHeroFromRoster(index)` :

1. détecter les brouillons sales ;
2. confirmer une seule fois s'il y en a ;
3. rafraîchir le roster ;
4. trouver le personnage ;
5. choisir le type actif s'il existe encore, sinon favori, sinon premier build ;
6. remplacer `draft.heroes[index]` par `rosterHeroSnapshot()` ;
7. réinitialiser la baseline du slot ;
8. rendre et conserver le focus sur l'icône active.

Ne jamais fusionner silencieusement un build local et un build distant.

- [ ] **Step 7: Ajouter les boutons au héros**

Dans `heroCard()`, sous le sélecteur d'armes :

```js
sourceActions.appendChild(el("button",{
  class:"btn hero-roster-update",
  type:"button",
  disabled:(!currentUser || !sb || navigator.onLine === false)
    ? "disabled" : undefined,
  text:"Mettre à jour mon roster",
  onclick:()=>void updateBuilderHeroRoster(i)
}));
```

Conserver le bouton existant « Recharger depuis mon roster », mais le brancher
sur `reloadBuilderHeroFromRoster(i)` afin qu'il recharge les trois builds.

Un bouton désactivé doit porter une explication dans `title`. Ne pas rendre
`disabled="undefined"` via `el()` : construire les propriétés conditionnellement.

Ajouter une fonction unique :

```js
function rosterNetworkAvailable(){
  return !!currentUser && !!sb && navigator.onLine !== false;
}
```

Les deux actions l'utilisent à la fois pour leur état visuel et juste avant
l'écriture. Après la définition de `renderBuilder()` :

```js
if(window.addEventListener){
  ["online","offline"].forEach(eventName => {
    window.addEventListener(eventName, () => {
      if($("#view-builder").classList.contains("active")) renderBuilder();
    });
  });
}
```

Le garde `window.addEventListener` conserve le bac à sable `vm`.

- [ ] **Step 8: Ajouter les contrats mobile et clavier**

Dans `tests/accessibilite-mobile.playwright.js`, à 320, 360 et 390 px :

```js
const switches = page.locator(
  "#heroGrid .hero:first-child .builder-weapon-switch"
);
assert.equal(await switches.count(), 3);
for(let index = 0; index < 3; index++){
  const box = await switches.nth(index).boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44);
}
await switches.nth(1).focus();
await page.keyboard.press("Enter");
assert.equal(
  await switches.nth(1).getAttribute("aria-pressed"),
  "true"
);
assert.equal(
  await switches.nth(0).evaluate(node => node.classList.contains("dirty")),
  true
);
```

Vérifier `scrollWidth - clientWidth <= 1` sur le document.

- [ ] **Step 9: Vérifier GREEN**

Run:

```powershell
node tests/stats-build.test.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: PASS, un seul build roster modifié, trois brouillons rechargés et
aucun débordement.

- [ ] **Step 10: Commit**

```powershell
git add index.html tests/helpers/load-app.js tests/stats-build.test.js tests/supabase-etape1.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "feat: synchroniser un build d'équipe vers le roster"
```

Mettre Task 6 à `[x]` dans le fichier de progression.

---

### Task 7: Documenter, vérifier et préparer l'activation

**Files:**
- Modify: `AGENTS.md:20-105`
- Modify: `AGENTS.md:515-660`
- Modify: `docs/superpowers/plans/2026-07-29-armes-secondaires-team-builder-progress.md`

**Interfaces:**
- Consumes: tous les contrats des Tasks 1 à 6.
- Produces: documentation de reprise, preuve de vérification et consignes
  Supabase/PWA.

- [ ] **Step 1: Mettre à jour `AGENTS.md`**

Ajouter à l'état actuel :

```markdown
- [x] **Armes secondaires et builds interchangeables**. Les deux armes non
      utilisées transfèrent chacune 30 % de leur ATK plate finale. Les trois
      builds du roster sont copiés dans l'instantané d'équipe et leurs icônes
      permettent de changer de build sans perdre les brouillons. Une arme
      secondaire manquante rend seulement l'ATK partielle.
```

Dans le contrat du lot 3A, documenter :

- `rosterBuilds` et `activeWeaponType` ;
- `SECONDARY_WEAPON_ATTACK_TRANSFER_RATE = 3000` ;
- l'exclusion de `I_AtkAdd_Rate` secondaire ;
- le mode présumé `"before-hero-rates"` et son protocole Merlin ;
- `status:"partial"` et `partialStats:["B_Atk"]` ;
- l'obligation de rejouer `supabase/schema.sql`.

- [ ] **Step 2: Vérifier les générateurs et les tests ciblés**

Run:

```powershell
python generate-stats-build.py --check
python -m unittest tests/test_schema_sql.py
node tests/stats-build-schema.test.js
node tests/stats-build.test.js
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: toutes les commandes retournent 0.

- [ ] **Step 3: Exécuter la suite complète**

Run:

```powershell
npm test
```

Expected: code de retour 0, aucune suite sautée à cause d'un échec antérieur.

- [ ] **Step 4: Vérifier le diff et les fins de ligne**

Run:

```powershell
git diff --check
git status --short
git diff --stat main...HEAD
```

Expected:

- aucune erreur de whitespace ;
- uniquement les fichiers du plan ;
- aucun script temporaire ;
- pas de réécriture globale d'`index.html`.

Compter les fins de ligne d'`index.html` uniquement pour détecter une
normalisation accidentelle ; ne pas modifier le fichier pour uniformiser.

- [ ] **Step 5: Mettre le suivi en état final**

Dans le fichier de progression :

- cocher les sept tâches ;
- noter les commits ;
- noter chaque commande et son résultat ;
- rappeler les trois mesures Merlin avant correction ;
- réserver trois lignes pour les mesures après déploiement ;
- écrire explicitement « Schéma Supabase à rejouer avant fusion ».

- [ ] **Step 6: Commit de documentation**

```powershell
git add AGENTS.md docs/superpowers/plans/2026-07-29-armes-secondaires-team-builder-progress.md
git commit -m "docs: finaliser les armes secondaires"
```

- [ ] **Step 7: Revue finale avant fusion**

Utiliser `superpowers:requesting-code-review`, corriger uniquement les constats
vérifiés, puis relancer `npm test` et `git diff --check`.

Ne pas fusionner, ne pas pousser et ne pas déclarer GitHub Pages vert sans
autorisation explicite du propriétaire.

---

## Critères d'acceptation finaux

1. Merlin ou tout autre héros peut conserver trois builds dans une équipe.
2. A → B → A restaure exactement les modifications non enregistrées de A.
3. Chaque arme secondaire apporte 30 % de son `B_Atk_Equip` final.
4. Un enchantement `I_AtkAdd_Rate` secondaire n'apporte rien.
5. Une arme secondaire manquante laisse PV/DEF visibles et marque l'ATK seule
   comme incomplète.
6. « Mettre à jour mon roster » ne change que le build affiché et le potentiel.
7. Les équipes et archives restent des instantanés indépendants du roster.
8. Une ancienne PWA ne peut pas effacer `rosterBuilds` par omission.
9. Les trois icônes sont utilisables à 320 px, au tactile et au clavier.
10. `npm test`, `git diff --check` et la syntaxe PostgreSQL sont verts.
