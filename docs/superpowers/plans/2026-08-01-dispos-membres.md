# Disponibilités hebdomadaires des membres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet « Dispos » où chaque membre peint ses créneaux horaires de la semaine et où la confrérie lit d'un coup d'œil les heures les plus fournies, afin de former les groupes de Boss de Guilde.

**Architecture:** Une table `member_availability` stocke une ligne par membre et par semaine, avec un masque texte de 168 caractères (un par créneau d'une heure, index `jour * 24 + heure`). Toute la logique est écrite en fonctions pures exposées au chargeur `vm` des tests ; le rendu DOM ne fait que les appeler. La grille est écrite à la main en CSS Grid, sans aucune bibliothèque de calendrier.

**Tech Stack:** HTML autonome (`index.html`), JavaScript inline, PostgreSQL/Supabase avec RLS et Realtime, tests Node et Playwright existants.

## Global Constraints

- Aucune dépendance externe supplémentaire : la seule ressource distante du site reste `supabase-js`. Ne rien ajouter au `<head>`, ni CDN, ni fichier vendoré.
- Le site doit rester ouvrable en `file://` et fonctionner hors ligne pour tout ce qui ne touche pas Supabase.
- Conserver les fins de ligne existantes de `index.html` et éviter toute normalisation globale du fichier.
- Ne toucher ni `.claude/`, ni `.vscode/`, ni `.worktrees/`.
- `supabase/schema.sql` doit rester **idempotent** : tout ajout passe par `create ... if not exists`, `drop policy if exists` avant `create policy`, ou un bloc conditionnel.
- Aucune vue ne doit déborder horizontalement entre 320 et 390 px de large. Un conteneur volontairement défilant est autorisé, la page non.
- Toute cible tactile fait au moins 44 × 44 px.
- La couleur ne porte jamais seule une information : un nombre ou un texte l'accompagne toujours.
- `member_availability.week_start` est le **lundi ISO à 00h**, et non la semaine de boss qui bascule le lundi à 9h. Ne jamais joindre les deux.
- Commentaires, libellés d'interface et messages de commit en français.

---

### Task 1: Table `member_availability` dans le schéma Supabase

**Files:**
- Create: `tests/availability-schema.test.js`
- Modify: `supabase/schema.sql` (insertion avant la section `-- ==== Realtime ====`, ligne ~1040 ; ajout dans le tableau des tables publiées, ligne ~1046)
- Modify: `package.json` (scripts `test` et `test:unit`)

**Interfaces:**
- Consumes: rien.
- Produces: la table `public.member_availability(owner uuid, week_start date, slots text, updated_at timestamptz)`, clé primaire `(owner, week_start)`, les politiques `avail_read` / `avail_insert` / `avail_update` / `avail_delete`, et l'entrée `member_availability` dans la publication `supabase_realtime`.

- [ ] **Step 1: Écrire le test en échec**

Créer `tests/availability-schema.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.member_availability/i,
  /owner\s+uuid not null references auth\.users\(id\) on delete cascade/i,
  /week_start\s+date not null/i,
  /slots\s+text not null default repeat\('0', 168\)/i,
  /check\s*\(\s*slots\s*~\s*'\^\[01\]\{168\}\$'\s*\)/i,
  /primary key\s*\(\s*owner\s*,\s*week_start\s*\)/i,
  /create index if not exists member_availability_week_idx/i,
  /alter table public\.member_availability enable row level security/i
].forEach(pattern => assert.match(sql, pattern));

function normalizedPolicy(name){
  const marker = "create policy " + name;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, name + " doit exister");
  const end = sql.indexOf(";", start);
  assert.notEqual(end, -1, name + " doit être une instruction complète");
  return sql.slice(start, end + 1).replace(/\s+/g, " ").trim().toLowerCase();
}

assert.strictEqual(
  normalizedPolicy("avail_read"),
  "create policy avail_read on public.member_availability "
  + "for select to authenticated using (true);"
);
assert.strictEqual(
  normalizedPolicy("avail_insert"),
  "create policy avail_insert on public.member_availability "
  + "for insert to authenticated with check (owner = auth.uid());"
);
assert.strictEqual(
  normalizedPolicy("avail_update"),
  "create policy avail_update on public.member_availability "
  + "for update to authenticated using (owner = auth.uid()) "
  + "with check (owner = auth.uid());"
);
assert.strictEqual(
  normalizedPolicy("avail_delete"),
  "create policy avail_delete on public.member_availability "
  + "for delete to authenticated using (owner = auth.uid());"
);

// La table doit être publiée en Realtime comme les autres tables partagées.
const realtimeStart = sql.indexOf("foreach realtime_table in array array[");
assert.notEqual(realtimeStart, -1, "Le bloc Realtime doit exister");
const realtimeEnd = sql.indexOf("]", realtimeStart);
assert.match(
  sql.slice(realtimeStart, realtimeEnd),
  /'member_availability'/,
  "member_availability doit rejoindre la publication supabase_realtime"
);

// La divergence avec la semaine de boss doit rester documentée dans le SQL.
assert.match(
  sql,
  /lundi ISO[\s\S]{0,400}current_boss_week_start/i,
  "Le commentaire doit avertir que week_start n'est pas la semaine de boss"
);

console.log("availability-schema.test.js OK");
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability-schema.test.js`

Expected: FAIL sur la première assertion, `create table if not exists public.member_availability` étant absent du schéma.

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `supabase/schema.sql`, insérer le bloc suivant **juste avant** la ligne `-- ============================ Realtime ============================` :

```sql
-- 8) Disponibilités hebdomadaires des membres.
-- Une ligne par membre et par semaine : la saisie complète tient dans un seul
-- upsert, là où une ligne par créneau produirait des centaines d'écritures.
-- `week_start` est le LUNDI ISO (00h) et NON la semaine de boss, qui bascule le
-- lundi à 9h via private.current_boss_week_start(). Les deux diffèrent entre
-- minuit et 9h le lundi : ne jamais les joindre.
-- `slots` : un caractère par créneau d'une heure, à l'index jour * 24 + heure,
-- le jour 0 étant le lundi. '1' = disponible.
create table if not exists public.member_availability (
  owner      uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  slots      text not null default repeat('0', 168)
             check (slots ~ '^[01]{168}$'),
  updated_at timestamptz not null default now(),
  primary key (owner, week_start)
);

create index if not exists member_availability_week_idx
  on public.member_availability(week_start);

alter table public.member_availability enable row level security;

drop policy if exists avail_read   on public.member_availability;
drop policy if exists avail_insert on public.member_availability;
drop policy if exists avail_update on public.member_availability;
drop policy if exists avail_delete on public.member_availability;

create policy avail_read on public.member_availability
  for select to authenticated using (true);
create policy avail_insert on public.member_availability
  for insert to authenticated with check (owner = auth.uid());
create policy avail_update on public.member_availability
  for update to authenticated using (owner = auth.uid())
  with check (owner = auth.uid());
create policy avail_delete on public.member_availability
  for delete to authenticated using (owner = auth.uid());
```

Puis ajouter `'member_availability'` au tableau du bloc Realtime, après `'boss_run_reports'` :

```sql
    'boss_run_reports',
    'member_availability'
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node tests/availability-schema.test.js`

Expected: PASS, affiche `availability-schema.test.js OK`.

- [ ] **Step 5: Brancher le test sur npm**

Dans `package.json`, ajouter `node tests/availability-schema.test.js && ` juste avant `node tests/boss-reports-schema.test.js` dans les scripts `test` **et** `test:unit`.

Run: `npm run test:unit`

Expected: PASS pour l'ensemble de la suite unitaire.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql tests/availability-schema.test.js package.json
git commit -m "feat: declarer la table des disponibilites hebdomadaires"
```

---

### Task 2: Fonctions pures — semaine, index de créneau et masque

**Files:**
- Create: `tests/availability.test.js`
- Modify: `index.html` (nouvelle section de code après le bloc `RealtimeSync`, avant `showView`)
- Modify: `tests/helpers/load-app.js` (constante `HOOK_EXPORT`)
- Modify: `package.json` (scripts `test` et `test:unit`)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `AVAIL_SLOTS` = `168`, `AVAIL_HOURS` = `24`, `AVAIL_DAYS` = `7`, `AVAIL_EMPTY_MASK` = `"0".repeat(168)` ;
  - `availabilityWeekStart(date)` → `string` `"YYYY-MM-DD"`, lundi ISO local de la semaine contenant `date` ;
  - `availabilityPreviousWeekStart(weekStart)` → `string`, lundi précédent ;
  - `availabilitySlotIndex(day, hour)` → `number` ;
  - `availabilitySlotFromIndex(index)` → `{ day, hour }` ;
  - `normalizeAvailabilityMask(value)` → `string` de 168 caractères, `AVAIL_EMPTY_MASK` si l'entrée est invalide ;
  - `availabilityMaskHas(mask, index)` → `boolean` ;
  - `availabilityMaskWith(mask, indexes, fill)` → `string`, nouveau masque, sans mutation.

- [ ] **Step 1: Écrire le test en échec**

Ajouter les huit entrées suivantes à l'objet de `HOOK_EXPORT` dans `tests/helpers/load-app.js`, en suivant la forme gardée par `typeof` déjà utilisée pour `numericKeyboardInputProps` :

```js
  availabilityWeekStart:typeof availabilityWeekStart === "function"
    ? availabilityWeekStart
    : undefined,
  availabilityPreviousWeekStart:
    typeof availabilityPreviousWeekStart === "function"
      ? availabilityPreviousWeekStart
      : undefined,
  availabilitySlotIndex:typeof availabilitySlotIndex === "function"
    ? availabilitySlotIndex
    : undefined,
  availabilitySlotFromIndex:typeof availabilitySlotFromIndex === "function"
    ? availabilitySlotFromIndex
    : undefined,
  normalizeAvailabilityMask:typeof normalizeAvailabilityMask === "function"
    ? normalizeAvailabilityMask
    : undefined,
  availabilityMaskHas:typeof availabilityMaskHas === "function"
    ? availabilityMaskHas
    : undefined,
  availabilityMaskWith:typeof availabilityMaskWith === "function"
    ? availabilityMaskWith
    : undefined,
```

Créer `tests/availability.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const {
  availabilityWeekStart,
  availabilityPreviousWeekStart,
  availabilitySlotIndex,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask,
  availabilityMaskHas,
  availabilityMaskWith
} = hooks;

const EMPTY = "0".repeat(168);

/* Semaine ISO calculée en heure de Paris, comme tout le reste de l'appli : les
   instants sont donnés en UTC explicite pour que le test ne dépende ni du
   fuseau ni de la locale de la machine qui l'exécute. */
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-01T12:00:00Z")),
  "2026-07-27",
  "Un samedi appartient à la semaine du lundi précédent"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-07-26T22:30:00Z")),
  "2026-07-27",
  "Minuit trente à Paris le lundi ouvre déjà la nouvelle semaine"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-02T21:00:00Z")),
  "2026-07-27",
  "23h à Paris le dimanche appartient encore à la semaine écoulée"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-02T23:30:00Z")),
  "2026-08-03",
  "1h30 à Paris le lundi bascule sur la nouvelle semaine, pas 9h"
);
assert.strictEqual(
  availabilityWeekStart(new Date("2026-08-03T05:00:00Z")),
  "2026-08-03",
  "Le lundi 7h à Paris : la semaine ISO a basculé alors que la semaine de "
  + "boss est encore la précédente"
);
assert.strictEqual(
  availabilityPreviousWeekStart("2026-08-03"),
  "2026-07-27"
);
assert.strictEqual(
  availabilityPreviousWeekStart("2026-01-05"),
  "2025-12-29",
  "Le passage d'année doit rester correct"
);

/* Index de créneau : le jour 0 est le lundi, l'heure 0 est minuit. */
assert.strictEqual(availabilitySlotIndex(0, 0), 0);
assert.strictEqual(availabilitySlotIndex(0, 22), 22);
assert.strictEqual(availabilitySlotIndex(1, 0), 24);
assert.strictEqual(availabilitySlotIndex(6, 23), 167);
assert.deepStrictEqual(availabilitySlotFromIndex(0), { day:0, hour:0 });
assert.deepStrictEqual(availabilitySlotFromIndex(24), { day:1, hour:0 });
assert.deepStrictEqual(availabilitySlotFromIndex(167), { day:6, hour:23 });

/* Normalisation : toute valeur douteuse retombe sur une semaine vide. */
assert.strictEqual(normalizeAvailabilityMask(EMPTY), EMPTY);
assert.strictEqual(normalizeAvailabilityMask(null), EMPTY);
assert.strictEqual(normalizeAvailabilityMask(undefined), EMPTY);
assert.strictEqual(normalizeAvailabilityMask(""), EMPTY);
assert.strictEqual(normalizeAvailabilityMask("1".repeat(167)), EMPTY);
assert.strictEqual(normalizeAvailabilityMask("2".repeat(168)), EMPTY);
assert.strictEqual(normalizeAvailabilityMask("1".repeat(168)), "1".repeat(168));

/* Écriture : jamais de mutation en place, ce qui rend l'aperçu de sélection
   trivial à afficher puis à jeter. */
const filled = availabilityMaskWith(EMPTY, [0, 24, 167], true);
assert.strictEqual(filled.length, 168);
assert.strictEqual(EMPTY, "0".repeat(168), "Le masque source ne doit pas changer");
assert.ok(availabilityMaskHas(filled, 0));
assert.ok(availabilityMaskHas(filled, 24));
assert.ok(availabilityMaskHas(filled, 167));
assert.ok(!availabilityMaskHas(filled, 1));
const erased = availabilityMaskWith(filled, [24], false);
assert.ok(availabilityMaskHas(erased, 0));
assert.ok(!availabilityMaskHas(erased, 24));
assert.strictEqual(availabilityMaskWith(EMPTY, [], true), EMPTY);

console.log("availability.test.js OK");
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL avec `TypeError: availabilityWeekStart is not a function`, les fonctions n'existant pas encore dans `index.html`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `index.html`, insérer ce bloc **après** la fermeture du module `RealtimeSync` et **avant** `function showView(name)` :

```js
  /* ============================ Dispos ============================
     Les disponibilités tiennent dans un masque de 168 caractères, un par
     créneau d'une heure, à l'index jour * 24 + heure (jour 0 = lundi).
     Le masque étant une frise temporelle continue, franchir minuit revient à
     avancer d'un index : aucun cas particulier n'est nécessaire.
     ATTENTION : la semaine utilisée ici est la semaine ISO (lundi 00h), et non
     la semaine de boss qui bascule le lundi à 9h. */
  const AVAIL_DAYS = 7;
  const AVAIL_HOURS = 24;
  const AVAIL_SLOTS = AVAIL_DAYS * AVAIL_HOURS;
  const AVAIL_EMPTY_MASK = "0".repeat(AVAIL_SLOTS);

  /* La semaine est calculée en heure de Paris, comme currentBossWeek() et le
     tableau de bord : un membre connecté depuis un autre fuseau doit voir la
     même grille que les autres. Différence essentielle avec currentBossWeek() :
     aucune règle des 9h ici, la semaine ISO bascule le lundi à 00h.
     Toute l'arithmétique de dates se fait ensuite en UTC sur des dates civiles,
     ce qui met les changements d'heure hors de portée. */
  function availabilityParisParts(now){
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone:"Europe/Paris",
      year:"numeric", month:"2-digit", day:"2-digit", weekday:"short"
    }).formatToParts(now || new Date());
    const get = type => (parts.find(part => part.type === type) || {}).value;
    return {
      year:+get("year"),
      month:+get("month"),
      day:+get("day"),
      weekday:{ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[get("weekday")]
    };
  }

  function availabilityWeekStart(now){
    const paris = availabilityParisParts(now);
    const base = new Date(Date.UTC(paris.year, paris.month - 1, paris.day));
    /* weekday place le dimanche à 0 ; on ramène le lundi à 0. */
    base.setUTCDate(base.getUTCDate() - ((paris.weekday + 6) % 7));
    return base.toISOString().slice(0, 10);
  }

  function availabilityPreviousWeekStart(weekStart){
    const parts = String(weekStart).split("-").map(Number);
    const day = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    day.setUTCDate(day.getUTCDate() - 7);
    return day.toISOString().slice(0, 10);
  }

  function availabilitySlotIndex(day, hour){
    return day * AVAIL_HOURS + hour;
  }

  function availabilitySlotFromIndex(index){
    return {
      day:Math.floor(index / AVAIL_HOURS),
      hour:index % AVAIL_HOURS
    };
  }

  function normalizeAvailabilityMask(value){
    return typeof value === "string" && /^[01]{168}$/.test(value)
      ? value
      : AVAIL_EMPTY_MASK;
  }

  function availabilityMaskHas(mask, index){
    return mask[index] === "1";
  }

  function availabilityMaskWith(mask, indexes, fill){
    if(!indexes || !indexes.length) return mask;
    const chars = mask.split("");
    indexes.forEach(index => { chars[index] = fill ? "1" : "0"; });
    return chars.join("");
  }
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS, affiche `availability.test.js OK`.

- [ ] **Step 5: Brancher le test sur npm et vérifier la non-régression**

Dans `package.json`, ajouter `node tests/availability.test.js && ` juste après `node tests/availability-schema.test.js && ` dans les scripts `test` et `test:unit`.

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/availability.test.js tests/helpers/load-app.js package.json
git commit -m "feat: poser le masque de disponibilites hebdomadaires"
```

---

### Task 3: Plage horaire enjambant minuit et peinture rectangulaire

**Files:**
- Modify: `index.html` (à la suite du bloc de la tâche 2)
- Modify: `tests/helpers/load-app.js` (`HOOK_EXPORT`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: `AVAIL_SLOTS`, `AVAIL_HOURS`, `availabilitySlotIndex`, `availabilityMaskWith` (tâche 2).
- Produces:
  - `applyAvailabilityRange(mask, startHour, endHour, days, fill)` → `{ mask, clipped }`. Plage `[startHour, endHour[` appliquée à chaque jour de `days` (tableau d'index de jours). Si `endHour < startHour`, la plage se poursuit le lendemain. Si `endHour === startHour`, aucune modification et `clipped` vaut `false`. Ce qui dépasse dimanche 24h est écrêté et lève `clipped`.
  - `paintAvailabilityRectangle(mask, anchor, cursor, fill)` → `string`. `anchor` et `cursor` sont des `{ day, hour }` ; le rectangle est **inclusif** des deux extrémités.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `HOOK_EXPORT` dans `tests/helpers/load-app.js` :

```js
  applyAvailabilityRange:typeof applyAvailabilityRange === "function"
    ? applyAvailabilityRange
    : undefined,
  paintAvailabilityRectangle:typeof paintAvailabilityRectangle === "function"
    ? paintAvailabilityRectangle
    : undefined,
```

Ajouter à la fin de `tests/availability.test.js`, **avant** la ligne `console.log(...)` :

```js
const {
  applyAvailabilityRange,
  paintAvailabilityRectangle
} = hooks;

function selectedIndexes(mask){
  const indexes = [];
  for(let index = 0; index < 168; index += 1){
    if(mask[index] === "1") indexes.push(index);
  }
  return indexes;
}

/* Cas nominal : 22h → 02h le lundi couvre quatre créneaux, dont deux le mardi.
   La plage est [début, fin[ : 02h n'est pas inclus. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 2, [0], true);
  assert.strictEqual(result.clipped, false);
  assert.deepStrictEqual(selectedIndexes(result.mask), [22, 23, 24, 25]);
}

/* La même plage sur plusieurs jours cochés. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 2, [0, 1], true);
  assert.deepStrictEqual(
    selectedIndexes(result.mask),
    [22, 23, 24, 25, 46, 47, 48, 49]
  );
}

/* Plage ordinaire, sans franchissement. */
{
  const result = applyAvailabilityRange(EMPTY, 20, 23, [2], true);
  assert.strictEqual(result.clipped, false);
  assert.deepStrictEqual(selectedIndexes(result.mask), [68, 69, 70]);
}

/* Heures égales : cas interdit, aucun effet et aucun écrêtage signalé. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 22, [0, 1, 2], true);
  assert.strictEqual(result.mask, EMPTY);
  assert.strictEqual(result.clipped, false);
}

/* Nuit du dimanche : la partie après minuit appartient à la semaine suivante,
   elle est écrêtée et signalée. */
{
  const result = applyAvailabilityRange(EMPTY, 22, 2, [6], true);
  assert.strictEqual(result.clipped, true);
  assert.deepStrictEqual(selectedIndexes(result.mask), [166, 167]);
}

/* Effacement : la même plage retire exactement ce qu'elle aurait ajouté. */
{
  const added = applyAvailabilityRange(EMPTY, 22, 2, [0], true).mask;
  const removed = applyAvailabilityRange(added, 22, 2, [0], false).mask;
  assert.strictEqual(removed, EMPTY);
}

/* Rectangle : bornes inclusives, ordre des extrémités indifférent. */
{
  const painted = paintAvailabilityRectangle(
    EMPTY, { day:1, hour:20 }, { day:3, hour:22 }, true
  );
  assert.deepStrictEqual(selectedIndexes(painted), [
    44, 45, 46,
    68, 69, 70,
    92, 93, 94
  ]);
  const reversed = paintAvailabilityRectangle(
    EMPTY, { day:3, hour:22 }, { day:1, hour:20 }, true
  );
  assert.strictEqual(reversed, painted, "Le sens du glissement est indifférent");
}

/* Une seule case : le rectangle dégénéré bascule un créneau. */
{
  const single = paintAvailabilityRectangle(
    EMPTY, { day:0, hour:0 }, { day:0, hour:0 }, true
  );
  assert.deepStrictEqual(selectedIndexes(single), [0]);
}

/* Le rectangle efface aussi bien qu'il remplit. */
{
  const full = "1".repeat(168);
  const cleared = paintAvailabilityRectangle(
    full, { day:0, hour:0 }, { day:0, hour:1 }, false
  );
  assert.strictEqual(cleared[0], "0");
  assert.strictEqual(cleared[1], "0");
  assert.strictEqual(cleared[2], "1");
}
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL avec `TypeError: applyAvailabilityRange is not a function`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Ajouter dans `index.html`, à la suite de `availabilityMaskWith` :

```js
  /* Le masque étant une frise continue, une plage qui franchit minuit est une
     simple suite d'index : `jour * 24 + heure + n` traverse naturellement la
     limite du jour. Seule la fin de la semaine demande un écrêtage, la nuit du
     dimanche débordant sur la semaine suivante, hors de cette grille. */
  function applyAvailabilityRange(mask, startHour, endHour, days, fill){
    if(startHour === endHour) return { mask, clipped:false };
    const span = endHour > startHour
      ? endHour - startHour
      : (AVAIL_HOURS - startHour) + endHour;
    const indexes = [];
    let clipped = false;
    (days || []).forEach(day => {
      for(let step = 0; step < span; step += 1){
        const index = availabilitySlotIndex(day, startHour) + step;
        if(index >= AVAIL_SLOTS){ clipped = true; continue; }
        indexes.push(index);
      }
    });
    return { mask:availabilityMaskWith(mask, indexes, fill), clipped };
  }

  /* Peinture rectangulaire : les deux extrémités sont des cases, donc incluses.
     Glisser de 22h à 23h sélectionne bien deux créneaux. */
  function paintAvailabilityRectangle(mask, anchor, cursor, fill){
    const dayFrom = Math.min(anchor.day, cursor.day);
    const dayTo = Math.max(anchor.day, cursor.day);
    const hourFrom = Math.min(anchor.hour, cursor.hour);
    const hourTo = Math.max(anchor.hour, cursor.hour);
    const indexes = [];
    for(let day = dayFrom; day <= dayTo; day += 1){
      for(let hour = hourFrom; hour <= hourTo; hour += 1){
        indexes.push(availabilitySlotIndex(day, hour));
      }
    }
    return availabilityMaskWith(mask, indexes, fill);
  }
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/availability.test.js tests/helpers/load-app.js
git commit -m "feat: appliquer les plages de nuit et la peinture rectangulaire"
```

---

### Task 4: Agrégation, densité, membres d'un créneau et purge

**Files:**
- Modify: `index.html` (à la suite du bloc de la tâche 3)
- Modify: `tests/helpers/load-app.js` (`HOOK_EXPORT`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: `AVAIL_SLOTS`, `normalizeAvailabilityMask`, `availabilityPreviousWeekStart` (tâches 2 et 3).
- Produces:
  - `aggregateAvailability(rows)` → `{ counts, max, best }`. `rows` est un tableau d'objets `{ owner, slots }`. `counts` est un tableau de 168 entiers, `max` le plus grand d'entre eux, `best` les trois créneaux les mieux fournis sous forme `[{ index, count }]`, triés par effectif décroissant puis par index croissant, les créneaux vides exclus.
  - `availabilityDensityTier(count, max)` → entier de 0 à 4.
  - `availabilitySlotMembers(rows, index, options)` → `[{ owner, pseudo, isMe, withoutGroup }]`. `options` vaut `{ pseudoOf, currentUserId, ownersWithGroup }` où `pseudoOf` est une fonction `owner → string` et `ownersWithGroup` un `Set` d'identifiants. Le membre courant est en tête, les autres par pseudo croissant.
  - `staleAvailabilityWeeks(weekStarts, currentWeekStart, keepWeeks)` → `string[]`, les semaines strictement antérieures à `currentWeekStart` moins `keepWeeks` semaines.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `HOOK_EXPORT` dans `tests/helpers/load-app.js` :

```js
  aggregateAvailability:typeof aggregateAvailability === "function"
    ? aggregateAvailability
    : undefined,
  availabilityDensityTier:typeof availabilityDensityTier === "function"
    ? availabilityDensityTier
    : undefined,
  availabilitySlotMembers:typeof availabilitySlotMembers === "function"
    ? availabilitySlotMembers
    : undefined,
  staleAvailabilityWeeks:typeof staleAvailabilityWeeks === "function"
    ? staleAvailabilityWeeks
    : undefined,
```

Ajouter à `tests/availability.test.js`, avant le `console.log(...)` final :

```js
const {
  aggregateAvailability,
  availabilityDensityTier,
  availabilitySlotMembers,
  staleAvailabilityWeeks
} = hooks;

function maskOf(indexes){
  const chars = EMPTY.split("");
  indexes.forEach(index => { chars[index] = "1"; });
  return chars.join("");
}

/* Agrégation : trois membres, des recouvrements partiels. */
{
  const rows = [
    { owner:"a", slots:maskOf([20, 21, 22]) },
    { owner:"b", slots:maskOf([21, 22]) },
    { owner:"c", slots:maskOf([21]) }
  ];
  const { counts, max, best } = aggregateAvailability(rows);
  assert.strictEqual(counts.length, 168);
  assert.strictEqual(counts[20], 1);
  assert.strictEqual(counts[21], 3);
  assert.strictEqual(counts[22], 2);
  assert.strictEqual(counts[23], 0);
  assert.strictEqual(max, 3);
  assert.deepStrictEqual(best, [
    { index:21, count:3 },
    { index:22, count:2 },
    { index:20, count:1 }
  ]);
}

/* Une ligne au masque corrompu ne doit pas fausser le comptage. */
{
  const { counts, max } = aggregateAvailability([
    { owner:"a", slots:"pas un masque" },
    { owner:"b", slots:null },
    { owner:"c", slots:maskOf([5]) }
  ]);
  assert.strictEqual(max, 1);
  assert.strictEqual(counts[5], 1);
}

/* Semaine vide : aucun meilleur créneau, aucun maximum. */
{
  const { max, best } = aggregateAvailability([]);
  assert.strictEqual(max, 0);
  assert.deepStrictEqual(best, []);
}

/* Égalité : le créneau le plus tôt passe devant, pour un classement stable. */
{
  const rows = [{ owner:"a", slots:maskOf([100, 40, 70]) }];
  const { best } = aggregateAvailability(rows);
  assert.deepStrictEqual(best.map(entry => entry.index), [40, 70, 100]);
}

/* Moins de trois créneaux occupés : on n'invente jamais un créneau vide. */
{
  const { best } = aggregateAvailability([{ owner:"a", slots:maskOf([3]) }]);
  assert.deepStrictEqual(best, [{ index:3, count:1 }]);
}

/* Paliers de densité : cinq niveaux, et zéro quand personne n'a rien saisi. */
assert.strictEqual(availabilityDensityTier(0, 16), 0);
assert.strictEqual(availabilityDensityTier(1, 16), 1);
assert.strictEqual(availabilityDensityTier(4, 16), 1);
assert.strictEqual(availabilityDensityTier(5, 16), 2);
assert.strictEqual(availabilityDensityTier(16, 16), 4);
assert.strictEqual(availabilityDensityTier(0, 0), 0, "Aucune division par zéro");
assert.strictEqual(availabilityDensityTier(3, 0), 0);

/* Membres d'un créneau : moi d'abord, puis l'ordre alphabétique. Le marquage
   « sans groupe » repose sur les participations de la semaine de boss. */
{
  const rows = [
    { owner:"zoe", slots:maskOf([21]) },
    { owner:"moi", slots:maskOf([21]) },
    { owner:"alix", slots:maskOf([21]) },
    { owner:"absent", slots:maskOf([22]) }
  ];
  const members = availabilitySlotMembers(rows, 21, {
    pseudoOf:owner => ({ zoe:"Zoé", moi:"Moi", alix:"Alix" })[owner],
    currentUserId:"moi",
    ownersWithGroup:new Set(["alix"])
  });
  assert.deepStrictEqual(members, [
    { owner:"moi", pseudo:"Moi", isMe:true, withoutGroup:true },
    { owner:"alix", pseudo:"Alix", isMe:false, withoutGroup:false },
    { owner:"zoe", pseudo:"Zoé", isMe:false, withoutGroup:true }
  ]);
}

/* Un profil manquant ne doit jamais produire « undefined » à l'écran. */
{
  const members = availabilitySlotMembers(
    [{ owner:"inconnu", slots:maskOf([0]) }],
    0,
    { pseudoOf:() => null, currentUserId:"moi", ownersWithGroup:new Set() }
  );
  assert.strictEqual(members[0].pseudo, "Membre");
}

/* Purge : quatre semaines conservées, la cinquième part. */
assert.deepStrictEqual(
  staleAvailabilityWeeks(
    ["2026-08-03", "2026-07-27", "2026-07-06", "2026-06-29"],
    "2026-08-03",
    4
  ),
  ["2026-07-06", "2026-06-29"]
);
assert.deepStrictEqual(staleAvailabilityWeeks([], "2026-08-03", 4), []);
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL avec `TypeError: aggregateAvailability is not a function`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Ajouter dans `index.html`, à la suite de `paintAvailabilityRectangle` :

```js
  function aggregateAvailability(rows){
    const counts = new Array(AVAIL_SLOTS).fill(0);
    (rows || []).forEach(row => {
      const mask = normalizeAvailabilityMask(row && row.slots);
      for(let index = 0; index < AVAIL_SLOTS; index += 1){
        if(mask[index] === "1") counts[index] += 1;
      }
    });
    let max = 0;
    counts.forEach(count => { if(count > max) max = count; });
    /* À effectif égal, le créneau le plus tôt passe devant : le classement
       reste déterministe, donc testable et stable d'un rendu à l'autre. */
    const best = counts
      .map((count, index) => ({ index, count }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 3);
    return { counts, max, best };
  }

  function availabilityDensityTier(count, max){
    if(!count || !max) return 0;
    return Math.min(4, Math.ceil((count / max) * 4));
  }

  function availabilitySlotMembers(rows, index, options){
    const config = options || {};
    const pseudoOf = config.pseudoOf || (() => "");
    const withGroup = config.ownersWithGroup || new Set();
    const members = (rows || [])
      .filter(row => normalizeAvailabilityMask(row && row.slots)[index] === "1")
      .map(row => ({
        owner:row.owner,
        pseudo:pseudoOf(row.owner) || "Membre",
        isMe:row.owner === config.currentUserId,
        withoutGroup:!withGroup.has(row.owner)
      }));
    members.sort((a, b) =>
      (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0)
      || a.pseudo.localeCompare(b.pseudo, "fr")
    );
    return members;
  }

  /* Purge auto-nettoyante : chaque membre supprime SES anciennes semaines en
     enregistrant, ce qui évite une tâche planifiée côté serveur. La comparaison
     de chaînes suffit, le format ISO étant ordonné lexicographiquement. */
  function staleAvailabilityWeeks(weekStarts, currentWeekStart, keepWeeks){
    let floor = currentWeekStart;
    for(let step = 0; step < keepWeeks; step += 1){
      floor = availabilityPreviousWeekStart(floor);
    }
    return (weekStarts || []).filter(week => week < floor);
  }
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/availability.test.js tests/helpers/load-app.js
git commit -m "feat: agreger les disponibilites de la confrerie"
```

---

### Task 5: Onglet, vue et rendu de la grille

**Files:**
- Modify: `index.html` (CSS avant `</style>` ; bouton d'onglet après la ligne 1513 ; section de vue après `view-boss` ; module `Availability` après le bloc de la tâche 4 ; `showView`)
- Modify: `tests/helpers/load-app.js` (`HOOK_EXPORT`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: toutes les fonctions pures des tâches 2 à 4.
- Produces:
  - l'onglet `#tab-availability` (`data-view="availability"`) et la section `#view-availability` ;
  - `availabilityViewState(options)` → `{ weekStart, weekLabel, mask, rows, mode, canEdit, offline, message }`, fonction pure qui décrit la vue à rendre. `options` vaut `{ now, rows, currentUserId, mode, online }`.
  - `availabilityWeekLabel(weekStart)` → `string` du type `"semaine du 3 au 9 août"`.
  - `renderAvailabilityView()`, branchée dans `showView`.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `HOOK_EXPORT` dans `tests/helpers/load-app.js` :

```js
  availabilityViewState:typeof availabilityViewState === "function"
    ? availabilityViewState
    : undefined,
  availabilityWeekLabel:typeof availabilityWeekLabel === "function"
    ? availabilityWeekLabel
    : undefined,
```

Ajouter à `tests/availability.test.js`, avant le `console.log(...)` final :

```js
const fs = require("node:fs");
const path = require("node:path");
const { availabilityViewState, availabilityWeekLabel } = hooks;
const indexSource = fs.readFileSync(
  path.resolve(__dirname, "..", "index.html"),
  "utf8"
);

/* L'onglet et la vue doivent exister et se répondre par leurs attributs ARIA. */
assert.match(
  indexSource,
  /<button class="tab" id="tab-availability" data-view="availability"[\s\S]{0,160}aria-controls="view-availability"/,
  "L'onglet Dispos doit exister et cibler sa vue"
);
assert.match(
  indexSource,
  /<section id="view-availability" class="view" role="tabpanel"[\s\S]{0,120}aria-labelledby="tab-availability"/,
  "La vue Dispos doit exister et pointer vers son onglet"
);
assert.match(
  indexSource,
  /if\(name==="availability"\)/,
  "showView doit rendre la vue Dispos"
);

assert.strictEqual(availabilityWeekLabel("2026-08-03"), "semaine du 3 au 9 août");
assert.strictEqual(
  availabilityWeekLabel("2026-07-27"),
  "semaine du 27 juillet au 2 août",
  "Un changement de mois doit nommer les deux mois"
);

/* Membre connecté : sa propre ligne alimente la grille, l'édition est ouverte. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[
      { owner:"moi", slots:maskOf([20, 21]) },
      { owner:"autre", slots:maskOf([21]) }
    ],
    currentUserId:"moi",
    mode:"mine",
    online:true
  });
  assert.strictEqual(state.weekStart, "2026-07-27");
  assert.strictEqual(state.weekLabel, "semaine du 27 juillet au 2 août");
  assert.strictEqual(state.mask, maskOf([20, 21]));
  assert.strictEqual(state.canEdit, true);
  assert.strictEqual(state.offline, false);
  assert.strictEqual(state.rows.length, 2);
}

/* Membre sans ligne enregistrée : grille vide, édition ouverte quand même. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[],
    currentUserId:"moi",
    mode:"mine",
    online:true
  });
  assert.strictEqual(state.mask, EMPTY);
  assert.strictEqual(state.canEdit, true);
}

/* Hors ligne : lecture seule et message explicite. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[{ owner:"moi", slots:maskOf([20]) }],
    currentUserId:"moi",
    mode:"mine",
    online:false
  });
  assert.strictEqual(state.canEdit, false);
  assert.strictEqual(state.offline, true);
  assert.match(state.message, /hors ligne/i);
}

/* Visiteur déconnecté : aucune donnée servie, invitation à se connecter.
   Les politiques RLS réservent déjà la lecture aux membres connectés. */
{
  const state = availabilityViewState({
    now:new Date("2026-08-01T12:00:00Z"),
    rows:[{ owner:"autre", slots:maskOf([20]) }],
    currentUserId:"",
    mode:"guild",
    online:true
  });
  assert.strictEqual(state.canEdit, false);
  assert.deepStrictEqual(state.rows, []);
  assert.strictEqual(state.mask, EMPTY);
  assert.match(state.message, /connecte/i);
}
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL sur l'assertion `L'onglet Dispos doit exister et cibler sa vue`.

- [ ] **Step 3: Ajouter le balisage**

Dans `index.html`, insérer le bouton d'onglet **après** celui de `tab-roster` (« Boss de Guilde », ligne 1513) :

```html
    <button class="tab" id="tab-availability" data-view="availability"
            role="tab" aria-controls="view-availability"
            aria-selected="false" tabindex="-1">Dispos</button>
```

Insérer la section de vue **après** la fermeture de `</section>` de `view-boss`, avant `<p class="databar" id="databar"></p>` :

```html
  <!-- ============ DISPOS ============ -->
  <section id="view-availability" class="view" role="tabpanel"
           aria-labelledby="tab-availability">
    <p class="section-eyebrow">Confrérie</p>
    <h1 class="section-title">Dispos de la semaine</h1>
    <p class="section-lead">Indique les heures où tu peux jouer. La vue « La confrérie » montre les créneaux où le plus de monde est disponible pour lancer une run.</p>
    <div class="avail-toolbar">
      <div class="avail-modes" role="group" aria-label="Vue des disponibilités">
        <button class="avail-mode active" id="availModeMine" type="button"
                aria-pressed="true">Mes dispos</button>
        <button class="avail-mode" id="availModeGuild" type="button"
                aria-pressed="false">La confrérie</button>
      </div>
      <span class="avail-save" id="availSaveStatus" role="status"
            aria-live="polite" aria-atomic="true"></span>
      <span class="avail-week" id="availWeek"></span>
    </div>
    <div id="availBody"></div>
  </section>
```

- [ ] **Step 4: Ajouter le style**

Insérer avant `</style>` dans `index.html` :

```css
  .avail-toolbar{
    display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0 16px
  }
  .avail-modes{display:flex;gap:6px;border:1px solid var(--line);border-radius:10px;padding:4px}
  .avail-mode{
    min-height:44px;padding:0 14px;border:0;border-radius:7px;background:transparent;
    color:var(--muted);font:inherit;font-size:13px;cursor:pointer
  }
  .avail-mode.active{background:var(--panel-2);color:var(--gold-bright)}
  .avail-save{font-size:12px;color:var(--muted-2);margin-left:auto}
  .avail-save[data-state="saving"]{color:var(--muted)}
  .avail-save[data-state="saved"]{color:var(--gold-bright)}
  .avail-save[data-state="error"]{color:#e07a5f}
  .avail-week{font-size:13px;color:var(--muted)}
  .avail-note{font-size:13px;color:var(--muted);margin:10px 0 0}

  /* La grille défile dans son propre conteneur : les cases gardent 44 px même
     sur 320 px de large, sans jamais faire déborder la page. */
  .avail-grid-wrap{overflow:auto;max-height:70vh;border:1px solid var(--line);border-radius:12px}
  .avail-grid{
    display:grid;grid-template-columns:56px repeat(7, minmax(44px, 1fr));
    min-width:364px;background:var(--panel)
  }
  .avail-head,.avail-gutter{
    position:sticky;background:var(--panel-2);z-index:2;
    font-size:12px;color:var(--muted);display:flex;align-items:center;
    justify-content:center;min-height:44px
  }
  .avail-head{top:0}
  .avail-gutter{left:0;z-index:1}
  .avail-corner{position:sticky;top:0;left:0;z-index:3;background:var(--panel-2)}
  .avail-head,.avail-gutter,.avail-corner{border-bottom:1px solid var(--line-soft)}
  .avail-cell{
    min-height:44px;border:0;border-top:1px solid var(--line-soft);
    border-left:1px solid var(--line-soft);background:transparent;
    color:var(--muted-2);font:inherit;font-size:11px;cursor:pointer;padding:0
  }
  .avail-cell[aria-pressed="true"]{background:var(--gold-deep);color:var(--ink)}
  .avail-cell.preview{outline:2px solid var(--gold-bright);outline-offset:-2px}
  .avail-cell:disabled{cursor:default}
  .avail-cell.mine{box-shadow:inset 0 0 0 2px var(--gold-bright)}
  .avail-cell[data-tier="0"]{background:transparent;color:var(--muted-2)}
  .avail-cell[data-tier="1"]{background:#2b2a3c;color:var(--muted)}
  .avail-cell[data-tier="2"]{background:#3d3547;color:#cfc4b4}
  .avail-cell[data-tier="3"]{background:var(--gold-deep);color:var(--ink)}
  .avail-cell[data-tier="4"]{background:var(--gold-bright);color:var(--ink);font-weight:700}
```

- [ ] **Step 5: Écrire l'état et le rendu**

Ajouter dans `index.html`, à la suite de `staleAvailabilityWeeks` :

```js
  const AVAIL_DAY_LABELS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  const AVAIL_DAY_FULL = [
    "Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"
  ];
  const AVAIL_MONTHS = [
    "janvier","février","mars","avril","mai","juin",
    "juillet","août","septembre","octobre","novembre","décembre"
  ];

  /* Dates civiles manipulées en UTC : `weekStart` est un jour du calendrier, pas
     un instant, et l'arithmétique UTC ignore les changements d'heure. */
  function availabilityDayDate(weekStart, day){
    const parts = String(weekStart).split("-").map(Number);
    const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + day);
    return date;
  }

  function availabilityWeekLabel(weekStart){
    const first = availabilityDayDate(weekStart, 0);
    const last = availabilityDayDate(weekStart, 6);
    const lastLabel = last.getUTCDate()+" "+AVAIL_MONTHS[last.getUTCMonth()];
    const firstLabel = first.getUTCMonth() === last.getUTCMonth()
      ? String(first.getUTCDate())
      : first.getUTCDate()+" "+AVAIL_MONTHS[first.getUTCMonth()];
    return "semaine du "+firstLabel+" au "+lastLabel;
  }

  /* Fonction pure : elle décrit la vue sans toucher au DOM, ce qui permet de la
     tester sans navigateur. Un visiteur déconnecté ne reçoit AUCUNE donnée :
     les politiques RLS réservent déjà la lecture aux membres connectés, et la
     vue ne doit pas laisser croire le contraire. */
  function availabilityViewState(options){
    const config = options || {};
    const weekStart = availabilityWeekStart(config.now || new Date());
    const signedIn = !!config.currentUserId;
    const online = config.online !== false;
    const rows = signedIn ? (config.rows || []) : [];
    const own = rows.find(row => row.owner === config.currentUserId);
    let message = "";
    if(!signedIn){
      message = "Connecte-toi pour voir les dispos de la confrérie et poser les tiennes.";
    }else if(!online){
      message = "Tu es hors ligne : les dispos affichées viennent du cache et ne peuvent pas être modifiées.";
    }
    return {
      weekStart,
      weekLabel:availabilityWeekLabel(weekStart),
      mask:normalizeAvailabilityMask(own && own.slots),
      rows,
      mode:config.mode === "guild" ? "guild" : "mine",
      canEdit:signedIn && online,
      offline:signedIn && !online,
      message
    };
  }
```

Puis, à la suite, le module de rendu :

```js
  const Availability = (function(){
    let state = null;

    function cellLabel(day, hour){
      return AVAIL_DAY_FULL[day]+" "+String(hour).padStart(2, "0")+"h";
    }

    function renderGrid(){
      const body = $("#availBody");
      body.innerHTML = "";
      if(state.message){
        const note = document.createElement("p");
        note.className = "avail-note";
        note.textContent = state.message;
        body.appendChild(note);
      }
      const aggregate = state.mode === "guild"
        ? aggregateAvailability(state.rows)
        : null;
      const wrap = document.createElement("div");
      wrap.className = "avail-grid-wrap";
      const grid = document.createElement("div");
      grid.className = "avail-grid";
      grid.id = "availGrid";
      const corner = document.createElement("div");
      corner.className = "avail-corner avail-head";
      grid.appendChild(corner);
      for(let day = 0; day < AVAIL_DAYS; day += 1){
        const head = document.createElement("button");
        head.type = "button";
        head.className = "avail-head";
        head.dataset.day = String(day);
        const date = availabilityDayDate(state.weekStart, day);
        head.textContent = AVAIL_DAY_LABELS[day]+" "+date.getUTCDate();
        head.disabled = !state.canEdit || state.mode === "guild";
        grid.appendChild(head);
      }
      for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
        const gutter = document.createElement("button");
        gutter.type = "button";
        gutter.className = "avail-gutter";
        gutter.dataset.hour = String(hour);
        gutter.textContent = String(hour).padStart(2, "0")+"h";
        gutter.disabled = !state.canEdit || state.mode === "guild";
        grid.appendChild(gutter);
        for(let day = 0; day < AVAIL_DAYS; day += 1){
          const index = availabilitySlotIndex(day, hour);
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "avail-cell";
          cell.dataset.index = String(index);
          cell.dataset.day = String(day);
          cell.dataset.hour = String(hour);
          if(state.mode === "guild"){
            const count = aggregate.counts[index];
            cell.dataset.tier = String(
              availabilityDensityTier(count, aggregate.max)
            );
            cell.textContent = count ? String(count) : "";
            cell.classList.toggle("mine", availabilityMaskHas(state.mask, index));
            cell.setAttribute(
              "aria-label",
              cellLabel(day, hour)+" — "+count+" membre"+(count > 1 ? "s" : "")
            );
          }else{
            const on = availabilityMaskHas(state.mask, index);
            cell.setAttribute("aria-pressed", String(on));
            cell.setAttribute("aria-label", cellLabel(day, hour));
            cell.disabled = !state.canEdit;
          }
          grid.appendChild(cell);
        }
      }
      wrap.appendChild(grid);
      body.appendChild(wrap);
    }

    function render(){
      $("#availWeek").textContent = state ? state.weekLabel : "";
      $("#availModeMine").classList.toggle("active", state.mode === "mine");
      $("#availModeMine").setAttribute(
        "aria-pressed", String(state.mode === "mine")
      );
      $("#availModeGuild").classList.toggle("active", state.mode === "guild");
      $("#availModeGuild").setAttribute(
        "aria-pressed", String(state.mode === "guild")
      );
      renderGrid();
    }

    function setMode(mode){
      if(!state) return;
      state.mode = mode;
      render();
    }

    async function refresh(){
      const user = currentUser;
      const weekStart = availabilityWeekStart(new Date());
      let rows = [];
      let online = true;
      if(user && sb){
        const result = await sb.from("member_availability")
          .select("owner,slots,week_start")
          .eq("week_start", weekStart);
        if(result.error){
          online = false;
          rows = readAvailabilityCache(user.id, weekStart) || [];
        }else{
          rows = result.data || [];
          writeAvailabilityCache(user.id, weekStart, rows);
        }
      }
      state = availabilityViewState({
        now:new Date(),
        rows,
        currentUserId:user ? user.id : "",
        mode:state ? state.mode : "mine",
        online
      });
      render();
      return true;
    }

    return { refresh, render, setMode, get state(){ return state; } };
  })();

  $("#availModeMine").addEventListener("click", ()=>Availability.setMode("mine"));
  $("#availModeGuild").addEventListener("click", ()=>Availability.setMode("guild"));

  function renderAvailabilityView(){
    return Availability.refresh();
  }
```

Ajouter le cache local, juste avant le module `Availability` :

```js
  const AVAIL_CACHE_PREFIX = "confrerie7ds.cloud.availability.";
  const AVAIL_CACHE_VERSION = 1;

  function availabilityCacheKey(userId, weekStart){
    return AVAIL_CACHE_PREFIX+userId+"."+weekStart;
  }

  function readAvailabilityCache(userId, weekStart){
    if(!userId || !weekStart) return null;
    try{
      const raw = localStorage.getItem(availabilityCacheKey(userId, weekStart));
      if(!raw) return null;
      const envelope = JSON.parse(raw);
      if(
        !envelope ||
        envelope.version !== AVAIL_CACHE_VERSION ||
        envelope.userId !== userId ||
        envelope.weekStart !== weekStart ||
        !Array.isArray(envelope.rows)
      ) return null;
      return envelope.rows;
    }catch(error){
      return null;
    }
  }

  function writeAvailabilityCache(userId, weekStart, rows){
    if(!userId || !weekStart) return;
    try{
      localStorage.setItem(
        availabilityCacheKey(userId, weekStart),
        JSON.stringify({
          version:AVAIL_CACHE_VERSION,
          userId,
          weekStart,
          savedAt:Date.now(),
          rows
        })
      );
    }catch(error){
      // Un quota local indisponible ne doit jamais casser la vue en ligne.
    }
  }
```

Enfin, brancher dans `showView`, à la suite de la ligne `if(name==="boss") result = renderBossView();` :

```js
    if(name==="availability") result = renderAvailabilityView();
```

- [ ] **Step 6: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 7: Vérifier la non-régression et le rendu réel**

Run: `npm run test:unit`

Expected: PASS.

Ouvrir `index.html` dans un navigateur, cliquer l'onglet « Dispos ». Attendu : la grille de 24 lignes × 7 colonnes s'affiche, l'intitulé de semaine est correct, et un visiteur déconnecté voit l'invitation à se connecter sans aucune donnée.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/availability.test.js tests/helpers/load-app.js
git commit -m "feat: afficher la grille des dispos de la semaine"
```

---

### Task 6: Saisie par glissement, raccourcis et clavier

**Files:**
- Modify: `index.html` (module `Availability`)
- Modify: `tests/helpers/load-app.js` (`HOOK_EXPORT`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: `paintAvailabilityRectangle`, `availabilityMaskHas`, `availabilityMaskWith`, `availabilitySlotIndex`, le module `Availability` (tâche 5).
- Produces:
  - `availabilityToggleDay(mask, day)` → `string`. Si la journée est entièrement remplie, elle est vidée ; sinon elle est remplie.
  - `availabilityToggleHour(mask, hour)` → `string`. Même règle sur les sept jours.
  - `Availability.applyMask(mask)` : remplace le masque courant, rend la grille et programme l'enregistrement.
  - `Availability.saveNow()` : `Promise` résolue une fois l'`upsert` effectué.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `HOOK_EXPORT` dans `tests/helpers/load-app.js` :

```js
  availabilityToggleDay:typeof availabilityToggleDay === "function"
    ? availabilityToggleDay
    : undefined,
  availabilityToggleHour:typeof availabilityToggleHour === "function"
    ? availabilityToggleHour
    : undefined,
```

Ajouter à `tests/availability.test.js`, avant le `console.log(...)` final :

```js
const { availabilityToggleDay, availabilityToggleHour } = hooks;

/* En-tête de jour : remplit la colonne, puis la vide au second appui. */
{
  const filled = availabilityToggleDay(EMPTY, 2);
  for(let hour = 0; hour < 24; hour += 1){
    assert.strictEqual(filled[48 + hour], "1");
  }
  assert.strictEqual(filled[47], "0");
  assert.strictEqual(filled[72], "0");
  assert.strictEqual(availabilityToggleDay(filled, 2), EMPTY);
}

/* Journée partiellement remplie : le premier appui complète, il n'efface pas. */
{
  const partial = maskOf([48, 49]);
  const filled = availabilityToggleDay(partial, 2);
  for(let hour = 0; hour < 24; hour += 1){
    assert.strictEqual(filled[48 + hour], "1");
  }
}

/* Gouttière d'heure : même règle, sur les sept jours. */
{
  const filled = availabilityToggleHour(EMPTY, 21);
  assert.deepStrictEqual(
    selectedIndexes(filled),
    [21, 45, 69, 93, 117, 141, 165]
  );
  assert.strictEqual(availabilityToggleHour(filled, 21), EMPTY);
}
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL avec `TypeError: availabilityToggleDay is not a function`.

- [ ] **Step 3: Écrire les bascules**

Ajouter dans `index.html`, à la suite de `paintAvailabilityRectangle` :

```js
  /* Les raccourcis suivent la même règle que le glissement : tant qu'il reste
     une case vide on remplit, et on n'efface qu'une sélection déjà complète. */
  function availabilityToggleDay(mask, day){
    const indexes = [];
    for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
      indexes.push(availabilitySlotIndex(day, hour));
    }
    const full = indexes.every(index => availabilityMaskHas(mask, index));
    return availabilityMaskWith(mask, indexes, !full);
  }

  function availabilityToggleHour(mask, hour){
    const indexes = [];
    for(let day = 0; day < AVAIL_DAYS; day += 1){
      indexes.push(availabilitySlotIndex(day, hour));
    }
    const full = indexes.every(index => availabilityMaskHas(mask, index));
    return availabilityMaskWith(mask, indexes, !full);
  }
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 5: Brancher la saisie sur la grille**

Dans le module `Availability` de `index.html`, ajouter la gestion des gestes et de l'enregistrement. Insérer avant `return { refresh, render, setMode, ... }` :

```js
    /* Enregistrement différé : un glissement produit un seul upsert, et le
       drapeau `saving` sert de garde contre l'écho Realtime de sa propre
       écriture (voir RealtimeSync). */
    let saveTimer = null;
    let savePending = false;
    let anchor = null;
    let paintFill = true;
    let holdTimer = null;
    let painting = false;

    function isSaving(){ return savePending; }

    /* Indicateur dédié plutôt que #liveStatus : ce dernier appartient à
       RealtimeSync, qui y écrit l'état de la connexion. Deux écrivains sur le
       même nœud produiraient des messages qui se chassent l'un l'autre. */
    function setSaveStatus(stateName, text){
      const node = $("#availSaveStatus");
      if(!node) return;
      node.dataset.state = stateName;
      node.textContent = text;
    }

    async function saveNow(){
      clearTimeout(saveTimer);
      saveTimer = null;
      if(!state || !state.canEdit || !currentUser || !sb){
        savePending = false;
        return false;
      }
      setSaveStatus("saving", "Enregistrement…");
      const payload = {
        owner:currentUser.id,
        week_start:state.weekStart,
        slots:state.mask,
        updated_at:new Date().toISOString()
      };
      const { error } = await sb.from("member_availability")
        .upsert(payload, { onConflict:"owner,week_start" });
      savePending = false;
      if(error){
        setSaveStatus("error", "Non enregistré");
        toast("Dispos non enregistrées : réessaie une fois reconnecté.", true);
        return false;
      }
      const own = state.rows.find(row => row.owner === currentUser.id);
      if(own) own.slots = state.mask;
      else state.rows.push({ owner:currentUser.id, slots:state.mask });
      writeAvailabilityCache(currentUser.id, state.weekStart, state.rows);
      const stamp = new Intl.DateTimeFormat("fr-FR", {
        timeZone:"Europe/Paris", hour:"2-digit", minute:"2-digit"
      }).format(new Date());
      setSaveStatus("saved", "Enregistré à "+stamp);
      return true;
    }

    function scheduleSave(){
      savePending = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(()=>void saveNow(), 600);
    }

    function applyMask(mask){
      if(!state || !state.canEdit || mask === state.mask) return;
      state.mask = mask;
      render();
      scheduleSave();
    }

    function cellFrom(target){
      if(!target || !target.dataset || target.dataset.index === undefined){
        return null;
      }
      return {
        day:Number(target.dataset.day),
        hour:Number(target.dataset.hour),
        index:Number(target.dataset.index)
      };
    }

    function previewRectangle(cursor){
      if(!anchor) return;
      const grid = $("#availGrid");
      if(!grid) return;
      const preview = paintAvailabilityRectangle(
        state.mask, anchor, cursor, paintFill
      );
      grid.querySelectorAll(".avail-cell").forEach(cell => {
        const index = Number(cell.dataset.index);
        const on = preview[index] === "1";
        cell.setAttribute("aria-pressed", String(on));
        cell.classList.toggle("preview", preview[index] !== state.mask[index]);
      });
    }

    function endPaint(cursor){
      clearTimeout(holdTimer);
      holdTimer = null;
      if(!anchor) return;
      const target = cursor || anchor;
      const mask = paintAvailabilityRectangle(
        state.mask, anchor, target, paintFill
      );
      anchor = null;
      painting = false;
      applyMask(mask);
      render();
    }

    function bindGrid(){
      const grid = $("#availGrid");
      if(!grid || !state.canEdit || state.mode !== "mine") return;
      grid.addEventListener("pointerdown", event => {
        const cell = cellFrom(event.target);
        if(!cell) return;
        anchor = cell;
        paintFill = !availabilityMaskHas(state.mask, cell.index);
        painting = event.pointerType === "mouse";
        if(painting){
          grid.setPointerCapture(event.pointerId);
          event.preventDefault();
        }else{
          /* Sur écran tactile, la peinture ne démarre qu'après un appui
             maintenu : un glissement immédiat doit rester un défilement. */
          holdTimer = setTimeout(() => {
            painting = true;
            grid.setPointerCapture(event.pointerId);
          }, 150);
        }
      });
      grid.addEventListener("pointermove", event => {
        if(!anchor || !painting) return;
        const cell = cellFrom(document.elementFromPoint(
          event.clientX, event.clientY
        ));
        if(cell) previewRectangle(cell);
        event.preventDefault();
      });
      grid.addEventListener("pointerup", event => {
        if(!anchor) return;
        const cell = cellFrom(event.target) || anchor;
        endPaint(cell);
      });
      grid.addEventListener("pointercancel", ()=>{
        clearTimeout(holdTimer);
        anchor = null;
        painting = false;
        render();
      });
      grid.addEventListener("click", event => {
        const head = event.target.closest(".avail-head[data-day]");
        if(head){
          applyMask(availabilityToggleDay(state.mask, Number(head.dataset.day)));
          return;
        }
        const gutter = event.target.closest(".avail-gutter[data-hour]");
        if(gutter){
          applyMask(
            availabilityToggleHour(state.mask, Number(gutter.dataset.hour))
          );
        }
      });
      grid.addEventListener("keydown", event => {
        const cell = cellFrom(event.target);
        if(!cell) return;
        let day = cell.day;
        let hour = cell.hour;
        if(event.key === "ArrowRight") day = Math.min(AVAIL_DAYS - 1, day + 1);
        else if(event.key === "ArrowLeft") day = Math.max(0, day - 1);
        else if(event.key === "ArrowDown") hour = Math.min(AVAIL_HOURS - 1, hour + 1);
        else if(event.key === "ArrowUp") hour = Math.max(0, hour - 1);
        else if(event.key === " " || event.key === "Enter"){
          event.preventDefault();
          applyMask(paintAvailabilityRectangle(
            state.mask, cell, cell, !availabilityMaskHas(state.mask, cell.index)
          ));
          return;
        }else return;
        event.preventDefault();
        if(event.shiftKey){
          applyMask(paintAvailabilityRectangle(
            state.mask, cell, { day, hour }, paintFill
          ));
        }
        const next = $("#availGrid").querySelector(
          '.avail-cell[data-index="'+availabilitySlotIndex(day, hour)+'"]'
        );
        if(next) next.focus();
      });
    }
```

Appeler `bindGrid()` à la fin de `renderGrid()`, et exposer les nouveaux membres dans l'objet retourné :

```js
    return {
      refresh, render, setMode, applyMask, saveNow, isSaving,
      get state(){ return state; }
    };
```

Ajouter enfin `touch-action:manipulation` sur les cases, dans le CSS de `.avail-cell` :

```css
  .avail-cell{
    min-height:44px;border:0;border-top:1px solid var(--line-soft);
    border-left:1px solid var(--line-soft);background:transparent;
    color:var(--muted-2);font:inherit;font-size:11px;cursor:pointer;padding:0;
    touch-action:manipulation
  }
```

- [ ] **Step 6: Vérifier la non-régression**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 7: Vérifier à la main**

Ouvrir `index.html`, se connecter, ouvrir « Dispos ». Vérifier : un clic bascule une case ; un cliquer-glisser peint un rectangle ; partir d'une case pleine efface ; l'appui sur un en-tête de jour remplit puis vide la colonne ; `Tab` puis les flèches déplacent le focus et `Espace` bascule.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/availability.test.js tests/helpers/load-app.js
git commit -m "feat: peindre ses dispos a la souris et au clavier"
```

---

### Task 7: Créneau de nuit et reprise de la semaine précédente

**Files:**
- Modify: `index.html` (balisage de `view-availability`, CSS, module `Availability`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: `applyAvailabilityRange`, `availabilityPreviousWeekStart`, `Availability.applyMask` (tâches 3, 2 et 6).
- Produces: le formulaire `#availRangeForm` (`#availRangeStart`, `#availRangeEnd`, cases `#availRangeDays input[type=checkbox]`, boutons `#availRangeAdd` et `#availRangeRemove`) et le bouton `#availCopyPrevious`.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `tests/availability.test.js`, avant le `console.log(...)` final :

```js
/* Le formulaire de créneau de nuit et la reprise doivent exister dans la page. */
assert.match(indexSource, /id="availRangeForm"/);
assert.match(indexSource, /id="availRangeStart"/);
assert.match(indexSource, /id="availRangeEnd"/);
assert.match(indexSource, /id="availRangeAdd"/);
assert.match(indexSource, /id="availRangeRemove"/);
assert.match(indexSource, /id="availCopyPrevious"/);
assert.match(
  indexSource,
  /availRangeDays/,
  "Les sept cases de jours doivent être regroupées"
);
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL sur `id="availRangeForm"`, absent de `index.html`.

- [ ] **Step 3: Ajouter le balisage**

Dans `index.html`, remplacer `<div id="availBody"></div>` de `view-availability` par :

```html
    <div id="availBody"></div>
    <div class="avail-range" id="availRangeForm">
      <span class="avail-range-title">Ajouter un créneau</span>
      <label class="avail-range-hour">de
        <select id="availRangeStart"></select>
      </label>
      <label class="avail-range-hour">à
        <select id="availRangeEnd"></select>
      </label>
      <span class="avail-range-days" id="availRangeDays"></span>
      <button class="btn" id="availRangeAdd" type="button">Ajouter</button>
      <button class="btn btn-ghost" id="availRangeRemove" type="button">Retirer</button>
      <p class="avail-note" id="availRangeHint"></p>
    </div>
    <div class="avail-actions">
      <button class="btn btn-ghost" id="availCopyPrevious" type="button" hidden>
        Reprendre mes dispos de la semaine dernière
      </button>
    </div>
```

Ajouter le style avant `</style>` :

```css
  .avail-range{
    display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 0 0;
    padding:14px;border:1px solid var(--line);border-radius:12px
  }
  .avail-range-title{font-size:13px;color:var(--gold-bright);width:100%}
  .avail-range-hour{font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px}
  .avail-range-hour select{min-height:44px;background:var(--panel-2);color:inherit;
    border:1px solid var(--line);border-radius:8px;padding:0 8px;font:inherit}
  .avail-range-days{display:flex;gap:4px;flex-wrap:wrap}
  .avail-range-days label{
    min-width:44px;min-height:44px;display:flex;align-items:center;
    justify-content:center;border:1px solid var(--line);border-radius:8px;
    font-size:13px;color:var(--muted);cursor:pointer
  }
  .avail-range-days input{position:absolute;opacity:0;pointer-events:none}
  .avail-range-days input:checked + span{color:var(--gold-bright);font-weight:700}
  .avail-range-days label:focus-within{outline:2px solid var(--gold-bright)}
  .avail-actions{margin:14px 0 0}
```

- [ ] **Step 4: Brancher le formulaire**

Ajouter dans le module `Availability` de `index.html`, avant le `return` :

```js
    function fillHourOptions(select, selected){
      select.innerHTML = "";
      for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = String(hour).padStart(2, "0")+"h";
        if(hour === selected) option.selected = true;
        select.appendChild(option);
      }
    }

    function selectedRangeDays(){
      return [...$("#availRangeDays").querySelectorAll("input:checked")]
        .map(input => Number(input.value));
    }

    function syncRangeControls(){
      const start = Number($("#availRangeStart").value);
      const end = Number($("#availRangeEnd").value);
      const days = selectedRangeDays();
      /* Heures égales : la plage serait soit vide soit longue de 24 h selon la
         lecture. On refuse le cas plutôt que d'en inventer une. */
      const usable = !!state && state.canEdit && start !== end && days.length > 0;
      $("#availRangeAdd").disabled = !usable;
      $("#availRangeRemove").disabled = !usable;
      $("#availRangeHint").textContent = start === end
        ? "Choisis deux heures différentes."
        : (end < start
          ? "Ce créneau se poursuit le lendemain."
          : "");
    }

    function applyRange(fill){
      const start = Number($("#availRangeStart").value);
      const end = Number($("#availRangeEnd").value);
      const result = applyAvailabilityRange(
        state.mask, start, end, selectedRangeDays(), fill
      );
      applyMask(result.mask);
      if(result.clipped){
        toast(
          "La fin de la nuit du dimanche appartient à la semaine suivante : "
          + "elle n'a pas été ajoutée."
        );
      }
    }

    async function copyPreviousWeek(){
      if(!state || !state.canEdit || !currentUser || !sb) return false;
      const previous = availabilityPreviousWeekStart(state.weekStart);
      const { data, error } = await sb.from("member_availability")
        .select("slots")
        .eq("week_start", previous)
        .eq("owner", currentUser.id)
        .maybeSingle();
      if(error || !data){
        toast("Aucune dispo trouvée pour la semaine dernière.", true);
        return false;
      }
      applyMask(normalizeAvailabilityMask(data.slots));
      return true;
    }

    function syncCopyButton(){
      const button = $("#availCopyPrevious");
      /* Le bouton ne s'affiche que s'il a quelque chose à apporter : une
         semaine encore vierge et une saisie possible. */
      button.hidden = !state || !state.canEdit || state.mask !== AVAIL_EMPTY_MASK;
    }
```

Appeler `syncRangeControls()` et `syncCopyButton()` à la fin de `render()`, puis câbler les écouteurs juste après ceux des deux boutons de mode :

```js
  (function initAvailabilityRange(){
    const days = $("#availRangeDays");
    AVAIL_DAY_LABELS.forEach((label, day) => {
      const wrapper = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(day);
      const text = document.createElement("span");
      text.textContent = label;
      wrapper.appendChild(input);
      wrapper.appendChild(text);
      days.appendChild(wrapper);
    });
    Availability.fillHourOptions($("#availRangeStart"), 22);
    Availability.fillHourOptions($("#availRangeEnd"), 2);
    days.addEventListener("change", ()=>Availability.syncRangeControls());
    $("#availRangeStart").addEventListener(
      "change", ()=>Availability.syncRangeControls()
    );
    $("#availRangeEnd").addEventListener(
      "change", ()=>Availability.syncRangeControls()
    );
    $("#availRangeAdd").addEventListener("click", ()=>Availability.applyRange(true));
    $("#availRangeRemove").addEventListener(
      "click", ()=>Availability.applyRange(false)
    );
    $("#availCopyPrevious").addEventListener(
      "click", ()=>void Availability.copyPreviousWeek()
    );
  })();
```

Exposer les nouvelles fonctions dans le `return` du module :

```js
    return {
      refresh, render, setMode, applyMask, saveNow, isSaving,
      fillHourOptions, syncRangeControls, applyRange, copyPreviousWeek,
      get state(){ return state; }
    };
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 6: Vérifier à la main**

Ouvrir `index.html`, se connecter, onglet « Dispos ». Vérifier : `de 22h à 02h` avec `L` coché remplit lundi 22h, 23h et mardi 00h, 01h ; `de 22h à 22h` désactive les deux boutons ; cocher `D` seul affiche le message d'écrêtage ; le bouton de reprise disparaît dès que la grille n'est plus vide.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/availability.test.js
git commit -m "feat: saisir un creneau de nuit et reprendre la semaine passee"
```

---

### Task 8: Vue « La confrérie » et panneau d'un créneau

**Files:**
- Modify: `index.html` (balisage de la modale, CSS, module `Availability`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: `aggregateAvailability`, `availabilityDensityTier`, `availabilitySlotMembers` (tâche 4), `ModalStack`, la table `boss_participation` et les profils déjà lus par les vues partagées.
- Produces: la modale `#availSlotOverlay` (`#availSlotTitle`, `#availSlotList`, `#availSlotClose`), la ligne `#availBest`, et `Availability.openSlot(index)`.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `tests/availability.test.js`, avant le `console.log(...)` final :

```js
assert.match(indexSource, /id="availSlotOverlay"/);
assert.match(indexSource, /id="availSlotTitle"/);
assert.match(indexSource, /id="availSlotList"/);
assert.match(indexSource, /id="availBest"/);
assert.match(
  indexSource,
  /sans groupe/i,
  "Le panneau doit marquer les membres sans groupe"
);
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL sur `id="availSlotOverlay"`.

- [ ] **Step 3: Ajouter le balisage**

Dans `index.html`, ajouter la ligne des meilleurs créneaux à `view-availability`, juste après `<div id="availBody"></div>` :

```html
    <p class="avail-best" id="availBest"></p>
```

Ajouter la modale à côté des autres overlays, après celle du picker :

```html
<div class="overlay" id="availSlotOverlay" role="dialog" aria-modal="true"
     aria-labelledby="availSlotTitle" aria-hidden="true">
  <div class="modal">
    <div class="picker-head">
      <span class="picker-title" id="availSlotTitle">Créneau</span>
      <button class="icon-btn" id="availSlotClose" aria-label="Fermer">✕</button>
    </div>
    <ul class="avail-slot-list" id="availSlotList"></ul>
  </div>
</div>
```

Ajouter le style avant `</style>` :

```css
  .avail-best{font-size:13px;color:var(--muted);margin:14px 0 0}
  .avail-best b{color:var(--gold-bright)}
  .avail-slot-list{list-style:none;margin:0;padding:0;max-height:60vh;overflow:auto}
  .avail-slot-list li{
    display:flex;align-items:center;gap:10px;min-height:44px;
    border-bottom:1px solid var(--line-soft);font-size:14px
  }
  .avail-slot-list li.me b{color:var(--gold-bright)}
  .avail-slot-tag{
    margin-left:auto;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
    color:var(--muted-2);border:1px solid var(--line);border-radius:999px;padding:3px 8px
  }
```

- [ ] **Step 4: Brancher la vue confrérie**

Ajouter dans le module `Availability`, avant le `return` :

```js
    let ownersWithGroup = new Set();
    let pseudos = [];

    /* Les pseudos viennent de `profiles`, via le même cache que les vues
       partagées. `profilePseudo()` ne convient pas : elle résout le pseudo du
       compte connecté, pas celui d'un propriétaire quelconque. */
    function pseudoOfOwner(owner){
      const found = pseudos.find(profile => profile.id === owner);
      if(found) return found.pseudo;
      if(currentUser && owner === currentUser.id) return currentPseudo || "Moi";
      return "Membre";
    }

    /* Les participations donnent qui a déjà rejoint un groupe. Elles se lisent
       sur la SEMAINE DE BOSS, qui bascule le lundi à 9h, et non sur la semaine
       ISO de la grille : les deux ne coïncident pas le lundi matin. */
    async function loadOwnersWithGroup(){
      ownersWithGroup = new Set();
      if(!currentUser || !sb) return;
      pseudos = await refreshRosterProfiles().catch(()=>rosterProfiles.slice());
      const week = currentBossWeek();
      const sessions = await sb.from("boss_sessions")
        .select("id")
        .eq("week_start", week.startDate);
      if(sessions.error || !sessions.data || !sessions.data.length) return;
      const participation = await sb.from("boss_participation")
        .select("owner,session_id")
        .in("session_id", sessions.data.map(session => session.id));
      if(participation.error) return;
      (participation.data || []).forEach(row => {
        if(row.owner) ownersWithGroup.add(row.owner);
      });
    }

    function renderBest(){
      const node = $("#availBest");
      if(!state || state.mode !== "guild"){
        node.textContent = "";
        return;
      }
      const { best } = aggregateAvailability(state.rows);
      if(!best.length){
        node.textContent = "Personne n'a encore posé de dispo cette semaine.";
        return;
      }
      node.innerHTML = "";
      node.appendChild(document.createTextNode("Meilleurs créneaux : "));
      best.forEach((entry, position) => {
        if(position) node.appendChild(document.createTextNode(" · "));
        const slot = availabilitySlotFromIndex(entry.index);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost";
        button.textContent = AVAIL_DAY_LABELS[slot.day]
          + " " + String(slot.hour).padStart(2, "0") + "h"
          + " (" + entry.count + ")";
        button.addEventListener("click", ()=>openSlot(entry.index));
        node.appendChild(button);
      });
    }

    function openSlot(index){
      if(!state || state.mode !== "guild") return;
      const slot = availabilitySlotFromIndex(index);
      const members = availabilitySlotMembers(state.rows, index, {
        pseudoOf:pseudoOfOwner,
        currentUserId:currentUser ? currentUser.id : "",
        ownersWithGroup
      });
      $("#availSlotTitle").textContent = AVAIL_DAY_FULL[slot.day]
        + " " + String(slot.hour).padStart(2, "0") + "h — "
        + members.length + " membre" + (members.length > 1 ? "s" : "");
      const list = $("#availSlotList");
      list.innerHTML = "";
      if(!members.length){
        const empty = document.createElement("li");
        empty.textContent = "Personne n'est disponible sur ce créneau.";
        list.appendChild(empty);
      }
      members.forEach(member => {
        const row = document.createElement("li");
        row.classList.toggle("me", member.isMe);
        const name = document.createElement("b");
        name.textContent = member.pseudo + (member.isMe ? " (toi)" : "");
        row.appendChild(name);
        if(member.withoutGroup){
          const tag = document.createElement("span");
          tag.className = "avail-slot-tag";
          tag.textContent = "sans groupe";
          row.appendChild(tag);
        }
        list.appendChild(row);
      });
      ModalStack.open($("#availSlotOverlay"), "#availSlotClose", closeSlot);
    }

    function closeSlot(){
      ModalStack.close($("#availSlotOverlay"));
    }
```

Dans `renderGrid()`, ajouter l'ouverture du panneau en mode confrérie, à la fin de la fonction :

```js
      if(state.mode === "guild"){
        grid.addEventListener("click", event => {
          const cell = event.target.closest(".avail-cell[data-index]");
          if(cell) openSlot(Number(cell.dataset.index));
        });
      }
```

Appeler `renderBest()` à la fin de `render()`, et `await loadOwnersWithGroup();` dans `refresh()` juste avant la construction de `state`.

Porter le `return` du module à sa forme définitive :

```js
    return {
      refresh, render, setMode, applyMask, saveNow, isSaving,
      fillHourOptions, syncRangeControls, applyRange, copyPreviousWeek,
      openSlot, closeSlot,
      get state(){ return state; }
    };
```

Puis câbler la fermeture, à côté des autres écouteurs de la vue :

```js
  $("#availSlotClose").addEventListener("click", ()=>Availability.closeSlot());
```

> **Repères vérifiés dans `index.html` :** `currentBossWeek(now)` (ligne ~9297) renvoie `{ startDate, endDate }` en heure de Paris avec la bascule du lundi 9h ; `refreshRosterProfiles()` (ligne ~6172) renvoie `[{ id, pseudo }]` et alimente le cache `rosterProfiles` ; `currentPseudo` porte le pseudo du compte connecté ; `ModalStack.open(overlay, focusSelector, closeFn)` prend bien trois arguments, comme à la ligne ~8768.

- [ ] **Step 5: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 6: Vérifier la non-régression et le rendu**

Run: `npm run test:unit`

Expected: PASS.

Ouvrir `index.html`, se connecter, onglet « Dispos », basculer sur « La confrérie ». Vérifier : chaque case porte son effectif, les couleurs suivent cinq paliers, la ligne des meilleurs créneaux apparaît, et un clic ouvre le panneau avec la liste et la mention « sans groupe ».

- [ ] **Step 7: Commit**

```bash
git add index.html tests/availability.test.js
git commit -m "feat: lire les dispos de la confrerie par densite"
```

---

### Task 9: Synchronisation Realtime, garde de saisie et purge

**Files:**
- Modify: `index.html` (module `RealtimeSync`, ligne ~6396 pour le tableau `tables` et ~6467 pour `schedule`; module `Availability`)
- Modify: `tests/helpers/load-app.js` (`HOOK_EXPORT`)
- Modify: `tests/availability.test.js`

**Interfaces:**
- Consumes: `RealtimeSync`, `Availability.isSaving()`, `staleAvailabilityWeeks` (tâches 4 et 6).
- Produces: `shouldIgnoreAvailabilityEcho(payload, currentUserId, savePending)` → `boolean`, et la purge appelée à chaque enregistrement réussi.

- [ ] **Step 1: Écrire le test en échec**

Ajouter à `HOOK_EXPORT` dans `tests/helpers/load-app.js` :

```js
  shouldIgnoreAvailabilityEcho:
    typeof shouldIgnoreAvailabilityEcho === "function"
      ? shouldIgnoreAvailabilityEcho
      : undefined,
```

Ajouter à `tests/availability.test.js`, avant le `console.log(...)` final :

```js
const { shouldIgnoreAvailabilityEcho } = hooks;

/* Pendant une saisie, l'écho de sa propre écriture ne doit pas écraser la
   sélection en cours de peinture. */
assert.strictEqual(
  shouldIgnoreAvailabilityEcho({ owner:"moi" }, "moi", true),
  true
);
/* Une fois l'enregistrement terminé, plus rien n'est ignoré. */
assert.strictEqual(
  shouldIgnoreAvailabilityEcho({ owner:"moi" }, "moi", false),
  false
);
/* La saisie d'un autre membre est toujours prise en compte. */
assert.strictEqual(
  shouldIgnoreAvailabilityEcho({ owner:"autre" }, "moi", true),
  false
);
assert.strictEqual(shouldIgnoreAvailabilityEcho(null, "moi", true), false);

/* La table doit être écoutée par la chaîne Realtime unique. */
assert.match(
  indexSource,
  /"boss_run_reports",\s*\n\s*"member_availability"/,
  "member_availability doit rejoindre la liste des tables suivies"
);
assert.match(
  indexSource,
  /table === "member_availability"/,
  "schedule doit router les evenements de disponibilite"
);
assert.match(
  indexSource,
  /shouldIgnoreAvailabilityEcho\([\s\S]{0,160}Availability\.isSaving\(\)/,
  "Le gestionnaire Realtime doit consulter la garde de saisie"
);
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/availability.test.js`

Expected: FAIL avec `TypeError: shouldIgnoreAvailabilityEcho is not a function`.

- [ ] **Step 3: Écrire la garde**

Ajouter dans `index.html`, à la suite de `staleAvailabilityWeeks` :

```js
  /* Sans cette garde, l'écho Realtime de sa PROPRE écriture réapplique un
     masque plus ancien que celui qu'on est en train de peindre. */
  function shouldIgnoreAvailabilityEcho(payload, currentUserId, savePending){
    return !!savePending && !!payload && payload.owner === currentUserId;
  }
```

- [ ] **Step 4: Brancher Realtime**

Dans le module `RealtimeSync` de `index.html`, ajouter `"member_availability"` à la fin du tableau `tables` :

```js
      "boss_run_reports",
      "member_availability"
```

Dans `schedule(table)`, ajouter avant `clearTimeout(timer);` :

```js
      if(table === "member_availability") pending.add("availability");
```

Dans `flush()`, ajouter avant le `catch` :

```js
        if(changed.has("availability") && view === "availability"){
          const refreshed = await renderAvailabilityView();
          if(!refreshed) throw new Error("AVAILABILITY_SYNC_FAILED");
        }
```

Le gestionnaire `postgres_changes` (ligne ~6503) jette aujourd'hui la charge utile : `}, ()=>schedule(table));`. Il faut la recevoir pour reconnaître son propre écho. Remplacer cette ligne par :

```js
        }, payload => {
          /* L'écho de sa PROPRE écriture, pendant qu'on peint encore, ferait
             réapparaître un masque plus ancien que la sélection en cours. */
          if(shouldIgnoreAvailabilityEcho(
            payload && payload.new,
            userId,
            Availability.isSaving()
          )) return;
          schedule(table);
        });
```

- [ ] **Step 5: Brancher la purge**

Dans `saveNow()` du module `Availability`, ajouter juste avant `return true;` :

```js
      /* Purge auto-nettoyante : chaque membre efface SES semaines anciennes,
         ce qui évite une tâche planifiée côté serveur. */
      const owned = await sb.from("member_availability")
        .select("week_start")
        .eq("owner", currentUser.id);
      if(!owned.error){
        const stale = staleAvailabilityWeeks(
          (owned.data || []).map(row => row.week_start),
          state.weekStart,
          4
        );
        if(stale.length){
          await sb.from("member_availability")
            .delete()
            .eq("owner", currentUser.id)
            .in("week_start", stale);
        }
      }
```

- [ ] **Step 6: Vérifier que le test passe**

Run: `node tests/availability.test.js`

Expected: PASS.

- [ ] **Step 7: Vérifier la non-régression**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/availability.test.js tests/helpers/load-app.js
git commit -m "feat: synchroniser les dispos sans ecraser la saisie en cours"
```

---

### Task 10: Test de bout en bout, documentation et vérification complète

**Files:**
- Create: `tests/availability.playwright.js`
- Modify: `package.json` (scripts `test` et `test:e2e`)
- Modify: `AGENTS.md` (section « État actuel » et note de migration)

**Interfaces:**
- Consumes: tout le travail des tâches 1 à 9.
- Produces: la couverture de bout en bout et la documentation d'exploitation.

- [ ] **Step 1: Écrire le test en échec**

Créer `tests/availability.playwright.js`. Partir de la structure de `tests/accessibilite-mobile.playwright.js` : copier sa fonction `installRosterFocusFakeSupabase`, la renommer `installAvailabilityFakeSupabase`, lui donner la signature `(page, weekStart)` et transmettre `weekStart` au script injecté, `page.addInitScript` acceptant un argument :

```js
async function installAvailabilityFakeSupabase(page, weekStart){
  await page.addInitScript(injectedWeekStart => {
    // … corps copié de installRosterFocusFakeSupabase …
  }, weekStart);
}
```

La semaine est calculée côté Node pour que le test reste juste quel que soit le jour où il s'exécute :

```js
function isoWeekStart(now){
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:"Europe/Paris",
    year:"numeric", month:"2-digit", day:"2-digit", weekday:"short"
  }).formatToParts(now);
  const get = type => (parts.find(part => part.type === type) || {}).value;
  const weekday = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[
    get("weekday")
  ];
  const base = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day")));
  base.setUTCDate(base.getUTCDate() - ((weekday + 6) % 7));
  return base.toISOString().slice(0, 10);
}
```

1. Remplacer le contenu de `state` par :

```js
    const EMPTY = "0".repeat(168);
    const maskOf = indexes => {
      const chars = EMPTY.split("");
      indexes.forEach(index => { chars[index] = "1"; });
      return chars.join("");
    };
    const state = {
      session:{ user:{ id:"moi", email:"moi@example.test" } },
      profiles:[
        { id:"moi", pseudo:"Moi" },
        { id:"alix", pseudo:"Alix" }
      ],
      teams:[],
      roster_characters:[],
      boss_sessions:[],
      boss_participation:[],
      boss_run_reports:[],
      member_availability:[
        {
          owner:"alix",
          week_start:injectedWeekStart,
          slots:maskOf([21, 45])
        }
      ],
      channels:[],
      queryCalls:[]
    };
```

2. Rendre l'`upsert` persistant, l'original se contentant de renvoyer sa charge sans écrire :

```js
        upsert(value){
          operation = "upsert";
          payload = clone(value);
          const rows = state[table] || (state[table] = []);
          const existing = rows.findIndex(row =>
            row.owner === payload.owner && row.week_start === payload.week_start
          );
          if(existing === -1) rows.push(clone(payload));
          else rows[existing] = clone(payload);
          return execute();
        },
```

3. Ajouter `delete()` au constructeur de requête, la purge en ayant besoin :

```js
        delete(){ operation = "delete"; return builder; },
```

et dans `execute()`, avant le retour de sélection :

```js
        if(operation === "delete"){
          state[table] = rows.filter(row => !filters.every(([column,value]) =>
            Array.isArray(value) ? value.includes(row[column]) : row[column] === value
          ));
          return { data:null, error:null };
        }
```

Écrire ensuite le corps du test :

```js
"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

// isoWeekStart() et installAvailabilityFakeSupabase() telles que définies ci-dessus.

async function run(){
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{ width:360, height:780 } });
  await installAvailabilityFakeSupabase(page, isoWeekStart(new Date()));
  await page.goto(pathToFileURL(
    path.resolve(__dirname, "..", "index.html")
  ).href);
  await page.click("#tab-availability");
  await page.waitForSelector("#availGrid .avail-cell");

  // La grille couvre bien la semaine entière, minuit à minuit.
  assert.strictEqual(
    await page.locator("#availGrid .avail-cell").count(),
    168,
    "La grille doit compter 168 créneaux"
  );

  // Aucune vue ne déborde horizontalement : seule la grille défile.
  const overflow = await page.evaluate(() => ({
    doc:document.documentElement.scrollWidth,
    view:window.innerWidth
  }));
  assert.ok(
    overflow.doc <= overflow.view + 1,
    "La page ne doit pas déborder horizontalement sur 360 px"
  );

  // Les cibles tactiles respectent 44 px.
  const box = await page.locator('#availGrid .avail-cell[data-index="0"]')
    .boundingBox();
  assert.ok(box.height >= 44, "Une case doit faire au moins 44 px de haut");

  // Un clic bascule un créneau et déclenche un enregistrement.
  await page.click('#availGrid .avail-cell[data-index="20"]');
  await page.waitForFunction(() => {
    const rows = window.__focusSupabaseState.member_availability;
    return rows.some(row => row.owner === "moi" && row.slots[20] === "1");
  }, null, { timeout:4000 });

  // Le formulaire de nuit franchit minuit.
  await page.selectOption("#availRangeStart", "22");
  await page.selectOption("#availRangeEnd", "2");
  await page.check('#availRangeDays input[value="0"]');
  await page.click("#availRangeAdd");
  await page.waitForFunction(() => {
    const row = window.__focusSupabaseState.member_availability
      .find(item => item.owner === "moi");
    return row
      && row.slots[22] === "1" && row.slots[23] === "1"
      && row.slots[24] === "1" && row.slots[25] === "1";
  }, null, { timeout:4000 });

  // Heures égales : les deux boutons se désactivent.
  await page.selectOption("#availRangeEnd", "22");
  assert.ok(
    await page.locator("#availRangeAdd").isDisabled(),
    "Une plage d'heures égales doit être refusée"
  );

  // Vue confrérie : effectifs affichés et panneau nominatif.
  await page.click("#availModeGuild");
  await page.waitForSelector('#availGrid .avail-cell[data-tier]');
  await page.click('#availGrid .avail-cell[data-index="21"]');
  await page.waitForSelector("#availSlotOverlay:not([aria-hidden='true'])");
  const listText = await page.locator("#availSlotList").innerText();
  assert.match(listText, /Alix/, "Le panneau doit nommer les membres disponibles");
  assert.match(listText, /sans groupe/i, "Les membres sans groupe sont marqués");
  await page.click("#availSlotClose");

  // Le clavier suffit à basculer un créneau.
  await page.click("#availModeMine");
  await page.waitForSelector('#availGrid .avail-cell[aria-pressed]');
  await page.focus('#availGrid .avail-cell[data-index="100"]');
  await page.keyboard.press("Space");
  await page.waitForFunction(() => {
    const cell = document.querySelector(
      '#availGrid .avail-cell[data-index="100"]'
    );
    return cell && cell.getAttribute("aria-pressed") === "true";
  }, null, { timeout:4000 });

  await browser.close();
  console.log("availability.playwright.js OK");
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
```

> **Attention :** le test s'exécute à une date réelle. C'est pourquoi `isoWeekStart()` est recalculé côté Node et injecté : une valeur en dur ferait passer le test aujourd'hui et échouer la semaine prochaine.

- [ ] **Step 2: Vérifier que le test échoue s'il est cassé**

Run: `node tests/availability.playwright.js`

Expected: PASS si les tâches 1 à 9 sont complètes. Si une assertion échoue, corriger l'implémentation concernée avant de continuer — ne jamais affaiblir l'assertion.

- [ ] **Step 3: Brancher sur npm**

Dans `package.json`, ajouter `node tests/availability.playwright.js && ` avant `node tests/pwa-update.playwright.js` dans les scripts `test` **et** `test:e2e`.

- [ ] **Step 4: Documenter**

Dans `AGENTS.md`, ajouter à la fin de la liste « État actuel » :

```markdown
- [x] **Dispos hebdomadaires des membres**. Un onglet « Dispos » où chacun peint
      ses créneaux d'une heure sur la semaine (grille maison, minuit à minuit,
      sans bibliothèque de calendrier), avec un formulaire dédié aux créneaux
      qui enjambent minuit et la reprise de la semaine précédente. La vue « La
      confrérie » colore chaque créneau selon le nombre de membres disponibles,
      liste les meilleurs créneaux et ouvre la liste nominative, en marquant
      ceux qui n'ont encore rejoint aucun groupe. Table `member_availability`,
      un masque de 168 caractères par membre et par semaine, synchronisée par
      Realtime et purgée au-delà de quatre semaines.
      ⚠️ `member_availability.week_start` est le **lundi ISO (00h)**, et non la
      semaine de boss qui bascule le lundi à 9h : ne jamais joindre les deux.
```

Mettre à jour la date de la ligne `## État actuel — 2026-07-29` en `## État actuel — 2026-08-01`, et rappeler dans le paragraphe de migration qui suit la liste que `supabase/schema.sql` doit être rejoué.

- [ ] **Step 5: Vérification complète**

Run: `npm test`

Expected: PASS pour la totalité de la suite, tests Python, Node et Playwright compris.

Ne déclarer la fonctionnalité terminée qu'après avoir lu cette sortie et constaté qu'elle est verte.

- [ ] **Step 6: Commit**

```bash
git add tests/availability.playwright.js package.json AGENTS.md
git commit -m "test: couvrir les dispos de bout en bout"
```

---

## Vérification finale

- [ ] `npm test` passe intégralement.
- [ ] `index.html` s'ouvre en `file://` sans erreur de console.
- [ ] Aucune requête réseau nouvelle au chargement : le `<head>` est inchangé.
- [ ] Sur 320 px de large, la page ne déborde pas horizontalement et les cases font 44 px.
- [ ] Le SQL a été rejoué dans le SQL Editor Supabase par l'utilisateur, la table et ses politiques existent.
