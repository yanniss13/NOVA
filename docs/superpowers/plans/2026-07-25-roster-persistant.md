# Roster persistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un roster Supabase partagé où chaque membre enregistre un personnage avec un potentiel commun et une configuration par arme compatible, puis copie ces configurations comme instantanés indépendants dans ses équipes.

**Architecture:** Ajouter `roster_characters` à Supabase, puis isoler dans `index.html` trois frontières nommées : normalisation (`normalizeRosterCharacter`), persistance/cache (`MemberRosterStore`) et interface (`renderMemberRoster`). Le builder consomme uniquement des instantanés produits par `rosterHeroSnapshot`, afin qu’aucune équipe publiée ne reste liée au roster.

**Tech Stack:** HTML/CSS/JavaScript sans framework dans `index.html`, Supabase JS v2 par CDN, PostgreSQL/RLS dans `supabase/schema.sql`, tests Node et Playwright Chromium.

## Global Constraints

- Français partout dans l’interface.
- La logique applicative reste inline dans `index.html`; aucun framework, bundler ou dépendance runtime supplémentaire.
- Les assets viennent uniquement de `window.SEVEN_DS_DATA`, `window.SEVEN_DS_POTENTIELS`, `window.SEVEN_DS_ARMURES_LIEES` et `window.SEVEN_DS_META`.
- Ne jamais coder en dur une liste d’images dans `index.html`.
- Potentiel commun T0–T10 par personnage, indépendant de l’arme.
- Au maximum une configuration par type d’arme compatible.
- Chaque configuration accepte une arme précise, cinq armures, trois bijoux et une note; tous les emplacements restent facultatifs.
- Tous les membres authentifiés lisent les rosters; seul le propriétaire écrit ou supprime ses fiches.
- Une configuration copiée vers une équipe devient indépendante.
- Le Recensement DPS, les sessions de boss, les statistiques calculées, le temps réel et la PWA restent hors périmètre.
- Le cache du roster utilise `confrerie7ds.cloud.roster`; une écriture exige Supabase.
- Aucun défilement horizontal global à 320, 360 ou 390 pixels.
- La suite `npm test` doit rester verte.

---

### Task 1: Schéma Supabase et modèle de domaine

**Files:**
- Modify: `supabase/schema.sql:26-64`
- Create: `tests/roster-schema.test.js`
- Modify: `tests/potentiel-commun.test.js:56-68,95-150,fin du fichier`
- Modify: `index.html:894-899,1152-1185`
- Modify: `package.json:6-9`

**Interfaces:**
- Consumes: `ARMOR_SLOTS`, `JEWEL_SLOTS`, `weaponTypesOf(charId)`, `weaponFolderOf(file)`, `isWeaponCompatible(charId,file)`, `normalizeHero(raw)`, `normalizePotentiel(raw)`, `charOf(id)`.
- Produces:
  - `emptyRosterBuild(): {weapon:string|null, armor:Object, jewel:Object, note:string}`
  - `normalizeRosterBuild(charId:string, weaponType:string, raw:Object): RosterBuild`
  - `normalizeRosterCharacter(raw:Object): RosterCharacter|null`
  - `rosterHeroSnapshot(entry:RosterCharacter, weaponType:string): Hero|null`
  - SQL table `public.roster_characters`.

- [ ] **Step 1: Écrire le test statique rouge du schéma**

Créer `tests/roster-schema.test.js` :

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
  /create table if not exists public\.roster_characters/i,
  /primary key\s*\(\s*owner\s*,\s*char_id\s*\)/i,
  /check\s*\(\s*potential_tier\s+between\s+0\s+and\s+10\s*\)/i,
  /alter table public\.roster_characters enable row level security/i,
  /create policy roster_read[\s\S]*for select to authenticated using\s*\(\s*true\s*\)/i,
  /create policy roster_insert[\s\S]*with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy roster_update[\s\S]*using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy roster_delete[\s\S]*using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

console.log("PASS schéma roster persistant");
```

Ajouter le test au début du script `test:unit` et du script `test` :

```json
"test": "node tests/roster-schema.test.js && python -m unittest tests/test_generate_armures_liees.py && ...",
"test:unit": "node tests/roster-schema.test.js && python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js"
```

- [ ] **Step 2: Lancer le test du schéma et confirmer l’échec**

Run: `node tests/roster-schema.test.js`

Expected: FAIL sur `create table if not exists public.roster_characters`.

- [ ] **Step 3: Ajouter la table et les politiques idempotentes**

Ajouter après `recensement` dans `supabase/schema.sql` :

```sql
-- 4) Roster persistant : une ligne par personnage et par membre
create table if not exists public.roster_characters (
  owner          uuid not null references auth.users(id) on delete cascade,
  char_id        text not null,
  potential_tier smallint not null default 0
                 check (potential_tier between 0 and 10),
  builds         jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (owner, char_id)
);
create index if not exists roster_characters_owner_idx
  on public.roster_characters(owner);
```

Activer RLS et ajouter les quatre politiques :

```sql
alter table public.roster_characters enable row level security;

drop policy if exists roster_read   on public.roster_characters;
drop policy if exists roster_insert on public.roster_characters;
drop policy if exists roster_update on public.roster_characters;
drop policy if exists roster_delete on public.roster_characters;
create policy roster_read on public.roster_characters
  for select to authenticated using (true);
create policy roster_insert on public.roster_characters
  for insert to authenticated with check (owner = auth.uid());
create policy roster_update on public.roster_characters
  for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy roster_delete on public.roster_characters
  for delete to authenticated using (owner = auth.uid());
```

- [ ] **Step 4: Vérifier le schéma vert**

Run: `node tests/roster-schema.test.js`

Expected: `PASS schéma roster persistant`.

- [ ] **Step 5: Écrire les tests rouges du modèle**

Dans la transformation de source de `tests/potentiel-commun.test.js`, exposer :

```js
emptyRosterBuild,
normalizeRosterBuild,
normalizeRosterCharacter,
rosterHeroSnapshot
```

Ajouter ces assertions :

```js
{
  const { hooks } = loadApp();
  const raw = {
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{
      Hache:{
        weapon:"7ds-armes/Hache/hache.webp",
        armor:{
          Haut:"7ds-armures-ssr/Haut/universel.webp",
          "Armure liee":"7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
        },
        jewel:{ Anneau:"7ds-bijoux/Anneau/test.webp" },
        note:"Boss"
      },
      Livre:{ weapon:"7ds-armes/Livre/livre.webp" }
    }
  };
  const entry = plain(hooks.normalizeRosterCharacter(raw));
  assert.strictEqual(entry.potentialTier, 7);
  assert.deepStrictEqual(Object.keys(entry.builds), ["Hache"]);
  assert.strictEqual(entry.builds.Hache.weapon, "7ds-armes/Hache/hache.webp");
  assert.strictEqual(
    entry.builds.Hache.armor["Armure liee"],
    "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
  );

  const snapshot = plain(hooks.rosterHeroSnapshot(entry, "Hache"));
  assert.strictEqual(snapshot.char, "meliodas");
  assert.deepStrictEqual(snapshot.potentiel, { tier:7 });
  snapshot.note = "Copie modifiée";
  assert.strictEqual(entry.builds.Hache.note, "Boss");

  assert.strictEqual(hooks.normalizeRosterCharacter({ charId:"inconnu" }), null);
  assert.strictEqual(hooks.rosterHeroSnapshot(entry, "Livre"), null);
}
```

- [ ] **Step 6: Lancer le test du modèle et confirmer l’échec**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL car `normalizeRosterCharacter` n’existe pas.

- [ ] **Step 7: Implémenter les quatre fonctions pures**

Ajouter après `normalizeHero` :

```js
const emptyRosterBuild = () => ({
  weapon:null,
  armor:emptyArmor(),
  jewel:emptyJewel(),
  note:""
});

function normalizeRosterBuild(charId, weaponType, raw){
  const source = raw && typeof raw === "object" ? raw : {};
  const knownWeapons = Object.values(compatibleWeaponGroups(charId)).flat();
  const weapon = weaponFolderOf(source.weapon) === weaponType &&
    knownWeapons.some(item => item.file === source.weapon)
    ? source.weapon
    : null;
  const hero = normalizeHero({
    char:charId,
    weapon,
    armor:source.armor,
    jewel:source.jewel,
    note:source.note
  });
  return {
    weapon:hero.weapon,
    armor:hero.armor,
    jewel:hero.jewel,
    note:hero.note
  };
}

function normalizeRosterCharacter(raw){
  const source = raw && typeof raw === "object" ? raw : {};
  const charId = typeof source.charId === "string" ? source.charId : "";
  if(!charOf(charId)) return null;
  const allowed = weaponTypesOf(charId);
  const sourceBuilds = source.builds && typeof source.builds === "object"
    ? source.builds : {};
  const builds = {};
  allowed.forEach(type => {
    if(Object.prototype.hasOwnProperty.call(sourceBuilds, type)){
      builds[type] = normalizeRosterBuild(charId, type, sourceBuilds[type]);
    }
  });
  const updatedAt = Number(source.updatedAt);
  return {
    owner:typeof source.owner === "string" ? source.owner : "",
    charId,
    potentialTier:normalizePotentiel({ tier:source.potentialTier }).tier,
    builds,
    updatedAt:Number.isFinite(updatedAt) ? updatedAt : 0
  };
}

function rosterHeroSnapshot(entry, weaponType){
  const normalized = normalizeRosterCharacter(entry);
  if(!normalized ||
     !Object.prototype.hasOwnProperty.call(normalized.builds, weaponType)){
    return null;
  }
  const build = normalized.builds[weaponType];
  return normalizeHero({
    char:normalized.charId,
    weapon:build.weapon,
    armor:build.armor,
    jewel:build.jewel,
    potentiel:{ tier:normalized.potentialTier },
    note:build.note
  });
}
```

- [ ] **Step 8: Vérifier les tests unitaires**

Run: `npm run test:unit`

Expected: tous les tests unitaires passent.

- [ ] **Step 9: Commit**

```powershell
git add -- supabase/schema.sql tests/roster-schema.test.js tests/potentiel-commun.test.js index.html package.json
git commit -m "feat: ajouter le modèle du roster persistant"
```

---

### Task 2: Cache local et frontière Supabase du roster

**Files:**
- Modify: `tests/potentiel-commun.test.js`
- Modify: `index.html:894-901,1049-1150,1266-1284`

**Interfaces:**
- Consumes: `normalizeRosterCharacter`, `currentUser`, `sb`, `authMessage`.
- Produces:
  - `cloudRosterFromRow(row): RosterCharacter|null`
  - `rosterToCloudRow(entry): SupabaseRosterRow|null`
  - `replaceRosterCacheForOwner(ownerId, entries): RosterCharacter[]`
  - `MemberRosterStore.all(ownerId): RosterCharacter[]`
  - `MemberRosterStore.refresh(ownerId): Promise<RosterCharacter[]>`
  - `MemberRosterStore.upsert(entry): Promise<RosterCharacter>`
  - `MemberRosterStore.remove(charId): Promise<void>`
  - `refreshRosterProfiles(): Promise<Array<{id,pseudo}>>`.

- [ ] **Step 1: Écrire les tests rouges de conversion et fusion du cache**

Exposer dans `tests/potentiel-commun.test.js` :

```js
cloudRosterFromRow,
rosterToCloudRow,
replaceRosterCacheForOwner,
MemberRosterStore
```

Ajouter :

```js
{
  const { hooks, localStorage } = loadApp();
  const row = {
    owner:"user-1",
    char_id:"meliodas",
    potential_tier:8,
    builds:{ Hache:{ weapon:"7ds-armes/Hache/hache.webp" } },
    updated_at:"2026-07-25T12:00:00.000Z"
  };
  const entry = plain(hooks.cloudRosterFromRow(row));
  assert.strictEqual(entry.charId, "meliodas");
  assert.strictEqual(entry.potentialTier, 8);

  hooks.replaceRosterCacheForOwner("user-2", [{
    owner:"user-2",
    charId:"merlin",
    potentialTier:4,
    builds:{}
  }]);
  hooks.replaceRosterCacheForOwner("user-1", [entry]);

  assert.strictEqual(plain(hooks.MemberRosterStore.all("user-1")).length, 1);
  assert.strictEqual(plain(hooks.MemberRosterStore.all("user-2")).length, 1);
  assert.match(
    localStorage.getItem("confrerie7ds.cloud.roster"),
    /"charId":"meliodas"/
  );
}
```

- [ ] **Step 2: Lancer le test et confirmer l’échec**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL car `cloudRosterFromRow` n’existe pas.

- [ ] **Step 3: Ajouter la clé, les conversions et le cache par propriétaire**

Ajouter aux constantes :

```js
const CLOUD_ROSTER_CACHE_KEY = "confrerie7ds.cloud.roster";
```

Implémenter :

```js
function cloudRosterFromRow(row){
  if(!row || typeof row !== "object") return null;
  return normalizeRosterCharacter({
    owner:row.owner,
    charId:row.char_id,
    potentialTier:row.potential_tier,
    builds:row.builds,
    updatedAt:row.updated_at ? Date.parse(row.updated_at) : 0
  });
}

function rosterToCloudRow(entry){
  const normalized = normalizeRosterCharacter(entry);
  if(!normalized || !currentUser) return null;
  return {
    owner:currentUser.id,
    char_id:normalized.charId,
    potential_tier:normalized.potentialTier,
    builds:JSON.parse(JSON.stringify(normalized.builds)),
    updated_at:new Date(normalized.updatedAt || Date.now()).toISOString()
  };
}

function readRosterCache(){
  try{
    const list = JSON.parse(localStorage.getItem(CLOUD_ROSTER_CACHE_KEY)) || [];
    return Array.isArray(list)
      ? list.map(normalizeRosterCharacter).filter(Boolean)
      : [];
  }catch(error){
    return [];
  }
}

let cloudRosterCache = readRosterCache();

function saveRosterCache(list){
  cloudRosterCache = (Array.isArray(list) ? list : [])
    .map(normalizeRosterCharacter)
    .filter(Boolean);
  localStorage.setItem(
    CLOUD_ROSTER_CACHE_KEY,
    JSON.stringify(cloudRosterCache)
  );
}

function replaceRosterCacheForOwner(ownerId, entries){
  const others = cloudRosterCache.filter(entry => entry.owner !== ownerId);
  const owned = (Array.isArray(entries) ? entries : [])
    .map(entry => normalizeRosterCharacter(
      Object.assign({}, entry, { owner:ownerId })
    ))
    .filter(Boolean);
  saveRosterCache(others.concat(owned));
  return owned;
}
```

- [ ] **Step 4: Ajouter `MemberRosterStore`**

```js
const MemberRosterStore = {
  all(ownerId){
    if(!ownerId) return [];
    return cloudRosterCache
      .filter(entry => entry.owner === ownerId)
      .map(normalizeRosterCharacter)
      .filter(Boolean);
  },
  async refresh(ownerId){
    if(!ownerId) return [];
    if(!currentUser || !sb) return MemberRosterStore.all(ownerId);
    const { data, error } = await sb.from("roster_characters")
      .select("*")
      .eq("owner", ownerId);
    if(error) throw error;
    return replaceRosterCacheForOwner(
      ownerId,
      (data || []).map(cloudRosterFromRow).filter(Boolean)
    );
  },
  async upsert(entry){
    if(!currentUser || !sb) throw new Error("AUTH_REQUIRED");
    const normalized = normalizeRosterCharacter(Object.assign({}, entry, {
      owner:currentUser.id,
      updatedAt:Date.now()
    }));
    if(!normalized) throw new Error("ROSTER_INVALID");
    const { error } = await sb.from("roster_characters")
      .upsert(rosterToCloudRow(normalized));
    if(error) throw error;
    const owned = MemberRosterStore.all(currentUser.id);
    const index = owned.findIndex(item => item.charId === normalized.charId);
    if(index >= 0) owned[index] = normalized;
    else owned.push(normalized);
    replaceRosterCacheForOwner(currentUser.id, owned);
    return normalized;
  },
  async remove(charId){
    if(!currentUser || !sb) throw new Error("AUTH_REQUIRED");
    const { error } = await sb.from("roster_characters")
      .delete()
      .eq("owner", currentUser.id)
      .eq("char_id", charId);
    if(error) throw error;
    replaceRosterCacheForOwner(
      currentUser.id,
      MemberRosterStore.all(currentUser.id)
        .filter(entry => entry.charId !== charId)
    );
  }
};
```

- [ ] **Step 5: Ajouter la lecture légère des profils**

```js
let rosterProfiles = [];

async function refreshRosterProfiles(){
  if(!currentUser || !sb) return rosterProfiles.slice();
  const { data, error } = await sb.from("profiles")
    .select("id,pseudo")
    .order("pseudo", { ascending:true });
  if(error) throw error;
  rosterProfiles = (data || [])
    .filter(item => item && item.id)
    .map(item => ({ id:item.id, pseudo:item.pseudo || "Membre" }));
  return rosterProfiles.slice();
}
```

Dans `applySession`, vider `rosterProfiles` au changement de session et relancer
`renderMemberRoster()` uniquement si `#view-member-roster` est actif.

- [ ] **Step 6: Vérifier les tests unitaires**

Run: `npm run test:unit`

Expected: PASS, y compris conservation simultanée des caches `user-1` et
`user-2`.

- [ ] **Step 7: Commit**

```powershell
git add -- tests/potentiel-commun.test.js index.html
git commit -m "feat: ajouter le stockage partagé du roster"
```

---

### Task 3: Interface partagée du roster

**Files:**
- Modify: `index.html:140-370,524-612,708-789,794-830,1369-1463,1734-1917`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `MemberRosterStore`, `refreshRosterProfiles`, `Picker`,
  `normalizeRosterCharacter`, `weaponTypesOf`, `metaOf`, `badgesRow`,
  `currentUser`.
- Produces:
  - DOM `#view-member-roster`, `#memberRosterGrid`,
    `#memberRosterOverlay`.
  - `renderMemberRoster(): Promise<void>`
  - `openMemberRosterEditor(entry:RosterCharacter): void`
  - `saveMemberRosterEditor(): Promise<void>`
  - `deleteMemberRosterCharacter(entry:RosterCharacter): Promise<void>`.

- [ ] **Step 1: Étendre le faux Supabase et écrire le parcours rouge**

Dans l’état de `tests/supabase-etape1.playwright.js`, ajouter :

```js
profiles:[
  { id:"user-1", pseudo:"Yannis" },
  { id:"user-2", pseudo:"Merlin" }
],
roster_characters:[
  {
    owner:"user-1",
    char_id:"meliodas",
    potential_tier:7,
    builds:{
      Hache:{
        weapon:"7ds-armes/Hache/Hache à l'aura triomphale.webp",
        armor:{},
        jewel:{},
        note:"Mon build"
      }
    },
    updated_at:"2026-07-25T08:40:00.000Z"
  },
  {
    owner:"user-2",
    char_id:"merlin",
    potential_tier:9,
    builds:{},
    updated_at:"2026-07-25T08:35:00.000Z"
  }
]
```

Dans l’upsert du faux client, remplacer le calcul de clé par :

```js
const index = rows.findIndex(row => {
  if(table === "roster_characters"){
    return row.owner === value.owner && row.char_id === value.char_id;
  }
  const key = table === "profiles"
    ? "id"
    : (table === "recensement" ? "owner" : "id");
  return row[key] === value[key];
});
```

Ajouter après la connexion :

```js
await page.locator('.tab[data-view="member-roster"]').click();
await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
assert.equal(await page.locator("#memberRosterGrid .member-roster-card").count(), 1);
assert.match(await page.locator("#memberRosterGrid").textContent(), /Meliodas/);
assert.equal(await page.locator("#memberRosterGrid .member-roster-edit").count(), 1);

await page.locator("#memberRosterOthers").click();
await page.locator("#memberRosterOwner").selectOption("user-2");
await page.locator("#memberRosterGrid .member-roster-card").first().waitFor();
assert.match(await page.locator("#memberRosterGrid").textContent(), /Merlin/);
assert.equal(await page.locator("#memberRosterGrid .member-roster-edit").count(), 0);
assert.equal(await page.locator("#memberRosterGrid .member-roster-delete").count(), 0);
```

- [ ] **Step 2: Lancer le parcours et confirmer l’échec**

Run: `node tests/supabase-etape1.playwright.js`

Expected: FAIL car l’onglet `data-view="member-roster"` n’existe pas.

- [ ] **Step 3: Ajouter l’onglet, la vue et la modale**

Ajouter dans la navigation :

```html
<button class="tab" data-view="member-roster" role="tab">Roster</button>
```

Ajouter avant le Recensement :

```html
<section id="view-member-roster" class="view">
  <p class="section-eyebrow">Collection de la confrérie</p>
  <h1 class="section-title">Roster des membres</h1>
  <p class="section-lead">Enregistre tes personnages une fois, puis réutilise leurs équipements dans tes équipes.</p>
  <div class="member-roster-toolbar">
    <div class="member-roster-modes" role="group" aria-label="Roster affiché">
      <button class="btn btn-primary" id="memberRosterMine" type="button">Mon roster</button>
      <button class="btn" id="memberRosterOthers" type="button">Roster des membres</button>
    </div>
    <label class="field member-roster-owner-field" for="memberRosterOwner">
      <span>Membre</span>
      <select id="memberRosterOwner"></select>
    </label>
    <button class="btn btn-primary" id="memberRosterAdd" type="button">Ajouter un personnage</button>
  </div>
  <div class="member-roster-filters">
    <input class="picker-search" id="memberRosterSearch" type="search"
           placeholder="Rechercher un personnage…" autocomplete="off">
    <div id="memberRosterFilters"></div>
  </div>
  <div class="member-roster-count" id="memberRosterCount"></div>
  <div class="member-roster-grid" id="memberRosterGrid"></div>
</section>
```

Ajouter une modale avec les identifiants :

```html
<div class="overlay" id="memberRosterOverlay" role="dialog"
     aria-modal="true" aria-labelledby="memberRosterTitle">
  <div class="modal member-roster-modal">
    <div class="picker-head">
      <span class="picker-title" id="memberRosterTitle">Personnage du roster</span>
      <button class="icon-btn" id="memberRosterClose" aria-label="Fermer">✕</button>
    </div>
    <div class="member-roster-editor" id="memberRosterEditor"></div>
  </div>
</div>
```

- [ ] **Step 4: Permettre au Picker de masquer l’option “Aucun”**

Ajouter un état `allowNone` initialisé dans `Picker.open` :

```js
let allowNone = true;
// dans open(cfg)
allowNone = cfg.allowNone !== false;
// dans renderGrid()
if(allowNone){
  grid.appendChild(el("button",{class:"tile none",onclick:()=>pick(null)},[
    el("div",{class:"tile-img",text:"∅"}),
    el("div",{class:"tile-name",text:"Aucun"})
  ]));
}
```

- [ ] **Step 5: Ajouter le rendu lecture/édition**

Ajouter l’état :

```js
let memberRosterMode = "mine";
let memberRosterOwnerId = "";
let memberRosterRenderId = 0;
let memberRosterDraft = null;
let memberRosterWeaponType = "";
const memberRosterFilters = {
  query:"",
  element:"",
  weapon:"",
  role:"",
  rarity:""
};
```

Implémenter `renderMemberRoster()` avec ce flux exact :

```js
async function renderMemberRoster(){
  const renderId = ++memberRosterRenderId;
  const grid = $("#memberRosterGrid");
  grid.innerHTML = "";
  if(!currentUser){
    grid.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Connecte-toi pour consulter le roster."}),
      el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
    ]));
    return;
  }
  let ownerId = memberRosterMode === "mine"
    ? currentUser.id
    : memberRosterOwnerId;
  try{
    const profiles = await refreshRosterProfiles();
    if(memberRosterMode === "others" && !ownerId){
      const other = profiles.find(profile => profile.id !== currentUser.id);
      ownerId = other ? other.id : "";
      memberRosterOwnerId = ownerId;
    }
    const entries = ownerId ? await MemberRosterStore.refresh(ownerId) : [];
    if(renderId !== memberRosterRenderId) return;
    renderMemberRosterControls(profiles, ownerId);
    renderMemberRosterCards(entries, ownerId === currentUser.id);
  }catch(error){
    if(renderId !== memberRosterRenderId) return;
    renderMemberRosterControls(rosterProfiles, ownerId);
    renderMemberRosterCards(MemberRosterStore.all(ownerId), ownerId === currentUser.id);
    toast("Roster indisponible, affichage du cache local.", true);
  }
}
```

Créer `renderMemberRosterControls`, `renderMemberRosterCards` et
`memberRosterCard`. Les filtres sont des boutons/chips générés depuis `META` :

- élément : valeurs de `meta.weapons[].element`;
- arme : valeurs de `meta.weapons[].weapon`, libellés via `WEAPON_ENUM`;
- rôle : valeurs de `meta.weapons[].role`, libellés via `WSLOT_ROLES`;
- rareté : `meta.rarity`.

Un filtre correspond aux trois slots compatibles du personnage, comme sur la
page Personnages de référence; il ne dépend pas du build actuellement rempli.
`#memberRosterSearch` met à jour `memberRosterFilters.query` à chaque saisie,
puis rappelle uniquement `renderMemberRosterCards` avec les entrées déjà
chargées.

- [ ] **Step 6: Implémenter l’éditeur propriétaire**

`openMemberRosterEditor(entry)` clone l’entrée, sélectionne sa première arme
compatible et ouvre la modale. Pour un onglet absent, il utilise
`emptyRosterBuild()` sans l’ajouter à `builds` avant la sauvegarde explicite.

Brancher `#memberRosterAdd` ainsi :

```js
$("#memberRosterAdd").addEventListener("click", ()=>{
  if(!currentUser){
    openAuth("Connecte-toi pour modifier ton roster.", true);
    return;
  }
  const existing = new Set(
    MemberRosterStore.all(currentUser.id).map(entry => entry.charId)
  );
  Picker.open({
    title:"Ajouter un personnage",
    portrait:true,
    allowNone:false,
    items:(DATA.personnages || [])
      .filter(ch => !existing.has(ch.id))
      .map(ch => ({ value:ch.id, name:ch.name, file:ch.file })),
    emptyHint:"Tous les personnages sont déjà dans ton roster.",
    onSelect:charId => openMemberRosterEditor({
      owner:currentUser.id,
      charId,
      potentialTier:0,
      builds:{},
      updatedAt:0
    })
  });
});
```

Les contrôles d’équipement appellent le `Picker` existant :

```js
function setMemberRosterBuildValue(kind, slot, value){
  const type = memberRosterWeaponType;
  const build = memberRosterDraft.builds[type] ||
    (memberRosterDraft.builds[type] = emptyRosterBuild());
  if(kind === "weapon") build.weapon = value;
  if(kind === "armor") build.armor[slot] = value;
  if(kind === "jewel") build.jewel[slot] = value;
  renderMemberRosterEditor();
}
```

Le potentiel est rendu comme onze boutons T0–T10. Un clic modifie uniquement le
champ commun :

```js
for(let tier = 0; tier <= POT_MAX; tier++){
  potentialBox.appendChild(el("button",{
    class:"chip"+(memberRosterDraft.potentialTier === tier ? " active" : ""),
    type:"button",
    text:"T"+tier,
    "aria-pressed":String(memberRosterDraft.potentialTier === tier),
    onclick:()=>{
      memberRosterDraft.potentialTier = tier;
      renderMemberRosterEditor();
    }
  }));
}
```

`saveMemberRosterEditor()` attend la réponse avant de fermer :

```js
async function saveMemberRosterEditor(){
  if(!memberRosterDraft) return;
  const button = $("#memberRosterSave");
  button.disabled = true;
  try{
    await MemberRosterStore.upsert(memberRosterDraft);
    $("#memberRosterOverlay").classList.remove("on");
    memberRosterDraft = null;
    await renderMemberRoster();
    toast("Personnage enregistré dans ton roster.");
  }catch(error){
    button.disabled = false;
    toast("Roster non enregistré : "+authMessage(error), true);
  }
}
```

La suppression vérifie `currentUser.id === entry.owner`, demande confirmation,
appelle `MemberRosterStore.remove(entry.charId)` puis relance le rendu.

- [ ] **Step 7: Brancher navigation, session, fermeture et accessibilité**

Dans `showView` :

```js
if(name === "member-roster") void renderMemberRoster();
```

Dans `applySession`, relancer cette vue lorsqu’elle est active. Fermer la modale
par le bouton, clic sur l’arrière-plan et `Escape`. Les onglets d’arme utilisent
des boutons avec `aria-pressed`; le mode actif et les chips de filtre aussi.

- [ ] **Step 8: Ajouter le style responsive**

Créer des règles ciblées pour :

- grille `repeat(auto-fill,minmax(min(280px,100%),1fr))`;
- cartes obsidienne/or cohérentes avec `.team`;
- toolbar avec retour à la ligne;
- filtres défilables dans leur propre conteneur;
- onglets d’arme défilables dans la modale;
- champs à `font-size:16px` sous 560 px;
- `.member-roster-card`, `.member-roster-toolbar` et `.member-roster-editor`
  avec `min-width:0`.

Ne pas ajouter de nouvelle règle globale `overflow-x:hidden`.

- [ ] **Step 9: Vérifier le parcours Supabase**

Run: `node tests/supabase-etape1.playwright.js`

Expected: PASS avec un roster propre modifiable et celui de Merlin en lecture
seule.

- [ ] **Step 10: Commit**

```powershell
git add -- index.html tests/supabase-etape1.playwright.js
git commit -m "feat: ajouter interface roster partagée"
```

---

### Task 4: Copie indépendante du roster vers le builder

**Files:**
- Modify: `index.html:1381-1463,1471-1620`
- Modify: `tests/supabase-etape1.playwright.js`

**Interfaces:**
- Consumes: `MemberRosterStore.all(currentUser.id)`,
  `MemberRosterStore.refresh(currentUser.id)`, `rosterHeroSnapshot`.
- Produces:
  - `pickRosterHero(slotIndex:number): Promise<void>`
  - `pickRosterWeapon(slotIndex:number, entry:RosterCharacter): void`
  - `loadRosterHero(slotIndex:number, entry:RosterCharacter, weaponType:string): void`.

- [ ] **Step 1: Écrire le parcours rouge du builder**

Ajouter au test Playwright, après le retour à `Mon roster` :

```js
await page.locator('.tab[data-view="builder"]').click();
const firstHero = page.locator(".hero").first();
await firstHero.getByRole("button", { name:"Depuis mon roster", exact:true }).click();
await page.locator('#pickerGrid .tile[title="Meliodas"]').click();
await page.locator('#pickerGrid .tile[title*="Hache"]').click();

assert.match(await firstHero.textContent(), /Meliodas/);
assert.match(await firstHero.textContent(), /P7/);

await firstHero.locator("textarea.note").fill("Copie modifiée");
const rosterNote = await page.evaluate(() =>
  window.__fakeSupabaseState.roster_characters
    .find(row => row.owner === "user-1" && row.char_id === "meliodas")
    .builds.Hache.note
);
assert.equal(rosterNote, "Mon build");
```

- [ ] **Step 2: Lancer le test et confirmer l’échec**

Run: `node tests/supabase-etape1.playwright.js`

Expected: FAIL car le bouton `Depuis mon roster` n’existe pas.

- [ ] **Step 3: Ajouter les actions source sur chaque carte du builder**

Dans `heroCard`, avant le portrait, ajouter :

```js
const sourceActions = el("div",{class:"hero-source-actions"},[
  el("button",{
    class:"btn btn-primary",
    type:"button",
    text:"Depuis mon roster",
    onclick:()=>void pickRosterHero(i)
  }),
  el("button",{
    class:"btn",
    type:"button",
    text:"Choisir manuellement",
    onclick:()=>pickChar(i)
  })
]);
```

Si aucun membre n’est connecté, masquer le premier bouton et garder le portrait
ainsi que le choix manuel existants.

- [ ] **Step 4: Implémenter la sélection en deux temps**

```js
async function pickRosterHero(slotIndex){
  if(!currentUser){
    openAuth("Connecte-toi pour utiliser ton roster.", true);
    return;
  }
  let entries;
  try{
    entries = await MemberRosterStore.refresh(currentUser.id);
  }catch(error){
    entries = MemberRosterStore.all(currentUser.id);
    if(!entries.length){
      toast("Ton roster est indisponible.", true);
      return;
    }
  }
  Picker.open({
    title:"Choisir dans mon roster",
    portrait:true,
    allowNone:false,
    items:entries.map(entry => {
      const ch = charOf(entry.charId);
      return { value:entry.charId, name:ch.name, file:ch.file };
    }),
    onSelect:charId => {
      const entry = entries.find(item => item.charId === charId);
      if(entry) pickRosterWeapon(slotIndex, entry);
    }
  });
}

function pickRosterWeapon(slotIndex, entry){
  const items = Object.keys(entry.builds).map(type => ({
    value:type,
    name:type+" · "+(entry.builds[type].weapon
      ? nameOfFile(entry.builds[type].weapon)
      : "équipement partiel"),
    file:entry.builds[type].weapon || masteryIconForWeaponType(type)
  }));
  if(!items.length){
    toast("Ce personnage n’a encore aucun équipement enregistré.", true);
    return;
  }
  Picker.open({
    title:"Choisir l’équipement",
    allowNone:false,
    items,
    onSelect:type => loadRosterHero(slotIndex, entry, type)
  });
}

function loadRosterHero(slotIndex, entry, weaponType){
  const snapshot = rosterHeroSnapshot(entry, weaponType);
  if(!snapshot) return;
  draft.heroes[slotIndex] = snapshot;
  renderBuilder();
  toast("Équipement copié depuis ton roster.");
}
```

Lors du calcul de l’icône de repli, ignorer proprement un type sans entrée
`WEAPON_ENUM`; ne jamais construire un chemin d’image à partir d’une valeur
inconnue.

```js
function masteryIconForWeaponType(type){
  const item = WEAPON_ENUM[FOLDER_TO_ENUM[type]];
  return item ? "7ds-ui/mastery/"+item.icon+".webp" : "";
}
```

- [ ] **Step 5: Ajouter “Recharger depuis mon roster”**

Lorsque le slot contient un héros et que le roster courant possède une
configuration pour `weaponFolderOf(hero.weapon)`, afficher un bouton qui appelle
`loadRosterHero` après confirmation :

```js
confirm("Remplacer ce héros par la version actuelle de ton roster ?")
```

L’absence de cette configuration ne modifie pas le slot et masque le bouton.

- [ ] **Step 6: Vérifier la copie indépendante**

Run: `node tests/supabase-etape1.playwright.js`

Expected: PASS; le builder affiche Meliodas P7 et la note Supabase reste
`Mon build` après modification de la copie.

- [ ] **Step 7: Commit**

```powershell
git add -- index.html tests/supabase-etape1.playwright.js
git commit -m "feat: réutiliser le roster dans le builder"
```

---

### Task 5: Import depuis les équipes, erreurs, mobile et documentation

**Files:**
- Modify: `index.html:1734-1856`
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `AGENTS.md:16-52,74-84,213-223`

**Interfaces:**
- Consumes: `canManageTeam(team)`, `MemberRosterStore`,
  `normalizeRosterBuild`, `weaponFolderOf`, `normalizePotentiel`.
- Produces:
  - `importTeamHeroToRoster(team:Team, hero:Hero): Promise<void>`
  - action `Ajouter au roster` ou `Mettre à jour ce build dans mon roster`
    dans la modale d’une équipe propriétaire.

- [ ] **Step 1: Écrire les tests rouges d’import et d’erreur**

Compléter le test Playwright :

```js
await page.locator('.tab[data-view="roster"]').click();
const ownTeam = page.locator("#rosterGrid .team").filter({ hasText:"Yannis" });
await ownTeam.getByRole("button", { name:/Voir l'équipement/ }).click();

const importButton = page.locator("#teamDetail")
  .getByRole("button", { name:/roster/i })
  .first();
await importButton.click();
await page.waitForFunction(() =>
  window.__fakeSupabaseState.roster_characters.some(row =>
    row.owner === "user-1" && row.char_id
  )
);

await page.locator("#teamClose").click();
const otherTeam = page.locator("#rosterGrid .team").filter({ hasText:"Merlin" });
await otherTeam.getByRole("button", { name:/Voir l'équipement/ }).click();
assert.equal(
  await page.locator("#teamDetail").getByRole("button", { name:/roster/i }).count(),
  0
);
```

Ajouter au faux état `failNextRosterUpsert:false` et, dans l’upsert :

```js
if(table === "roster_characters" && state.failNextRosterUpsert){
  state.failNextRosterUpsert = false;
  return { data:null, error:{ message:"Échec simulé" } };
}
```

Tester que, après `state.failNextRosterUpsert = true`, la modale
`#memberRosterOverlay` reste ouverte et la note saisie reste présente.

- [ ] **Step 2: Lancer le parcours et confirmer l’échec**

Run: `node tests/supabase-etape1.playwright.js`

Expected: FAIL car la modale d’équipe ne contient aucune action roster.

- [ ] **Step 3: Ajouter l’action explicite sur les équipes propriétaires**

Faire accepter à `heroDetail` un contexte :

```js
function heroDetail(h, options){
  const settings = options || {};
  // rendu existant
  if(settings.canImport && h && h.char){
    const type = weaponFolderOf(h.weapon);
    const valid = type && weaponTypesOf(h.char).includes(type);
    col.appendChild(el("button",{
      class:"btn hd-roster-import",
      type:"button",
      disabled:valid ? null : "disabled",
      title:valid ? "" : "Équipe d’abord une arme compatible.",
      text:settings.hasBuild(h.char, type)
        ? "Mettre à jour ce build dans mon roster"
        : "Ajouter au roster",
      onclick:()=>{ if(valid) void importTeamHeroToRoster(settings.team, h); }
    }));
  }
  return col;
}
```

Dans `openTeamDetail`, fournir `team`, `canImport:canManageTeam(t) &&
!!currentUser` et `hasBuild`.

- [ ] **Step 4: Implémenter l’import sans modifier l’équipe**

```js
async function importTeamHeroToRoster(team, hero){
  if(!currentUser || !canManageTeam(team)) return;
  const type = weaponFolderOf(hero && hero.weapon);
  if(!hero || !hero.char || !type ||
     !weaponTypesOf(hero.char).includes(type)){
    toast("Équipe d’abord une arme compatible.", true);
    return;
  }
  const existing = MemberRosterStore.all(currentUser.id)
    .find(entry => entry.charId === hero.char);
  const replacing = !!existing &&
    Object.prototype.hasOwnProperty.call(existing.builds, type);
  const ch = charOf(hero.char);
  if(replacing && !confirm(
    "Remplacer le build "+type+" de "+(ch ? ch.name : hero.char)+" ?"
  )) return;

  const next = normalizeRosterCharacter(existing || {
    owner:currentUser.id,
    charId:hero.char,
    potentialTier:hero.potentiel && hero.potentiel.tier,
    builds:{}
  });
  next.potentialTier = normalizePotentiel(hero.potentiel).tier;
  next.builds[type] = normalizeRosterBuild(hero.char, type, hero);
  try{
    await MemberRosterStore.upsert(next);
    toast(replacing
      ? "Build mis à jour dans ton roster."
      : "Personnage ajouté à ton roster.");
  }catch(error){
    toast("Import impossible : "+authMessage(error), true);
  }
}
```

Ne jamais modifier `team` ou `hero`; `normalizeRosterBuild` retourne ses propres
objets `armor` et `jewel`.

- [ ] **Step 5: Ajouter les assertions mobiles**

Dans le test Playwright, vérifier la nouvelle vue :

```js
for(const width of [320, 360, 390]){
  await page.setViewportSize({ width, height:844 });
  await page.locator('.tab[data-view="member-roster"]').click();
  await page.waitForTimeout(100);
  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement;
    return root.scrollWidth - root.clientWidth;
  });
  assert.ok(overflow <= 1, `Débordement roster de ${overflow}px à ${width}px`);
}
```

Vérifier aussi qu’un onglet d’arme trop large possède
`scrollWidth > clientWidth` dans son propre conteneur sans agrandir le document.

- [ ] **Step 6: Vérifier le maintien de la saisie sur erreur**

Ouvrir l’éditeur, saisir une note distinctive, activer
`failNextRosterUpsert`, cliquer Enregistrer puis vérifier :

```js
assert.equal(
  await page.locator("#memberRosterOverlay").evaluate(node =>
    node.classList.contains("on")
  ),
  true
);
assert.equal(
  await page.locator("#memberRosterEditor textarea").inputValue(),
  "Saisie conservée"
);
```

- [ ] **Step 7: Mettre à jour `AGENTS.md`**

Documenter :

- table `roster_characters` et cache `confrerie7ds.cloud.roster`;
- potentiel commun et `builds` indexés par dossier d’arme;
- lecture partagée/écriture propriétaire;
- copie indépendante vers une équipe;
- commande utilisateur restante : relancer `supabase/schema.sql`;
- prochaine évolution : sessions de boss, puis PWA.

- [ ] **Step 8: Exécuter la vérification complète**

Run: `npm test`

Expected:

```text
PASS schéma roster persistant
PASS potentiel commun
PASS Playwright: Supabase ... partage et roster
PASS Playwright: pas de débordement mobile ...
```

Run: `git diff --check`

Expected: aucune sortie.

- [ ] **Step 9: Commit**

```powershell
git add -- index.html tests/supabase-etape1.playwright.js AGENTS.md package.json
git commit -m "feat: finaliser le roster persistant"
```

- [ ] **Step 10: Contrôle manuel Supabase après intégration**

Dans Supabase :

1. ouvrir `SQL Editor`;
2. coller le contenu complet de `supabase/schema.sql`;
3. cliquer `Run query`;
4. vérifier dans `Table Editor` que `roster_characters` existe;
5. se connecter au site avec deux comptes;
6. confirmer que le second compte voit la fiche du premier sans pouvoir la
   modifier.

Ce contrôle ne bloque pas les tests locaux, qui utilisent le faux client
Supabase.
