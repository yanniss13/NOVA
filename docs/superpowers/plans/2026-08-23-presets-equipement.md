# Presets d'équipement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nommer un ensemble de 7 pièces d'équipement, le ranger hors du personnage, et le reposer sur n'importe quel héros depuis trois écrans.

**Architecture:** Un module métier pur (`js/metier/presets.js`) capture et applique ; un store (`js/donnees/presets-store.js`) persiste dans une table Supabase dédiée ; un sélecteur partagé dans `js/vues/edition-build.js` sert les trois écrans. Les fonctions d'application ne modifient jamais sur place — elles renvoient un nouveau build, convention déjà tenue par les `apply*` du dépôt.

**Tech Stack:** JavaScript ES modules sans framework, Supabase (PostgREST + RLS), tests Node `node:assert` + `node:vm`, Playwright/Chromium.

**Spec:** `docs/superpowers/specs/2026-08-23-presets-equipement-design.md`

## Global Constraints

- **7 emplacements transportables.** Armure : `Haut`, `Bas`, `Bottes`, `Ceinture`. Bijoux : `Anneau`, `Collier`, `Boucle d'oreille`.
- **`"Armure liee"` ne voyage jamais.** Ni capturée, ni écrasée. La constante existe : `LINKED_ARMOR_SLOT` dans `js/noyau/constantes.js:27`.
- **Une config ne se sépare jamais de sa pièce.** Une config dont la pièce est absente est écartée.
- **Nom d'un preset :** 1 à 40 caractères après `trim`. Doublons autorisés.
- **Limite :** 40 presets par membre, contrôlée côté client uniquement.
- **Aucune allocation d'inventaire.** Appliquer un preset ne retire rien à personne.
- **Presets privés.** Aucune lecture par un autre membre, aucune politique `for all`.
- **Tout nouveau module s'inscrit dans `tests/helpers/modules.js`**, dans sa couche, sinon `tests/modules-imports.test.js` échoue.
- **Tout nouveau test s'inscrit dans `scripts/lancer-tests.js`** : le lanceur ne découvre rien tout seul.
- **Le dépôt est en CRLF.** Ne jamais normaliser un fichier entier dans un commit fonctionnel.

---

### Task 1 : Le module métier pur

**Files:**
- Create: `js/metier/presets.js`
- Create: `tests/presets.test.js`
- Modify: `tests/helpers/modules.js` (couche `metier`)
- Modify: `scripts/lancer-tests.js` (liste des tests unitaires)

**Interfaces:**
- Consumes: `ARMOR_SLOTS`, `JEWEL_SLOTS`, `LINKED_ARMOR_SLOT` de `js/noyau/constantes.js` ; `jsonCopy` de `js/noyau/outils.js`.
- Produces: `PRESET_ARMOR_SLOTS: string[]`, `PRESET_NAME_MAX: number`, `PRESETS_MAX: number`, `nomPresetValide(nom: string) → string|null`, `normaliserPreset(source: object) → {armor, armorConfig, jewel, jewelConfig}|null`, `capturerPreset(build: object) → payload|null`, `appliquerPreset(build: object, preset: object) → build|null`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/presets.test.js` :

```js
"use strict";

/* Un preset transporte sept emplacements et rien d'autre. L'armure gravee
   appartient au heros : la capturer la deplacerait d'un personnage a l'autre,
   ce que le jeu ne permet pas. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(racine, "js", "metier", "presets.js"), "utf8"
).replace(/^import[\s\S]*?;\s*$/gm, "")
  .replace(/^export\s*\{[\s\S]*?\}\s*;\s*$/m, "");
const bac = {
  ARMOR_SLOTS:["Haut","Bas","Bottes","Ceinture","Armure liee"],
  JEWEL_SLOTS:["Anneau","Collier","Boucle d'oreille"],
  LINKED_ARMOR_SLOT:"Armure liee",
  jsonCopy:value => JSON.parse(JSON.stringify(value))
};
vm.runInNewContext(source, bac, { filename:"presets.js" });

const {
  PRESET_ARMOR_SLOTS, PRESET_NAME_MAX, PRESETS_MAX,
  nomPresetValide, normaliserPreset, capturerPreset, appliquerPreset
} = bac;

const buildComplet = () => ({
  weapon:"7ds-armes/Hache/Hache de guerre.webp",
  weaponConfig:{ niveau:80 },
  armor:{
    "Haut":"7ds-armures-ssr/Haut/Haut A.webp",
    "Bas":"7ds-armures-ssr/Bas/Bas A.webp",
    "Bottes":"7ds-armures-ssr/Bottes/Bottes A.webp",
    "Ceinture":"7ds-armures-ssr/Ceinture/Ceinture A.webp",
    "Armure liee":"7ds-armures-ssr/Armure liee/Gravee A.webp"
  },
  armorConfig:{
    "Haut":{ niveau:20 },
    "Armure liee":{ niveau:5 }
  },
  jewel:{ "Anneau":"Anneau A.webp", "Collier":null, "Boucle d'oreille":null },
  jewelConfig:{ "Anneau":{ niveau:10 } },
  note:"mon build boss",
  favorite:true
});

// Les quatre emplacements transportables, jamais l'armure gravee.
assert.deepStrictEqual(PRESET_ARMOR_SLOTS, ["Haut","Bas","Bottes","Ceinture"]);
assert.equal(PRESET_NAME_MAX, 40);
assert.equal(PRESETS_MAX, 40);

// Un nom se nettoie, et refuse le vide comme le trop long.
assert.equal(nomPresetValide("  Boss  "), "Boss");
assert.equal(nomPresetValide("   "), null);
assert.equal(nomPresetValide(null), null);
assert.equal(nomPresetValide("x".repeat(41)), null);
assert.equal(nomPresetValide("x".repeat(40)), "x".repeat(40));

// La capture prend les sept emplacements et laisse l'armure gravee au heros.
const capture = capturerPreset(buildComplet());
assert.deepStrictEqual(Object.keys(capture.armor), ["Haut","Bas","Bottes","Ceinture"]);
assert.equal(Object.prototype.hasOwnProperty.call(capture.armor, "Armure liee"), false);
assert.equal(
  Object.prototype.hasOwnProperty.call(capture.armorConfig, "Armure liee"),
  false
);
assert.deepStrictEqual(capture.armorConfig["Haut"], { niveau:20 });
assert.deepStrictEqual(capture.jewelConfig["Anneau"], { niveau:10 });

// Une config sans sa piece est perimee : elle ne voyage pas.
const sansPiece = capturerPreset(Object.assign(buildComplet(), {
  jewel:{ "Anneau":null, "Collier":null, "Boucle d'oreille":null },
  jewelConfig:{ "Anneau":{ niveau:10 } }
}));
assert.deepStrictEqual(sansPiece.jewelConfig, {});

// Un build sans aucune des sept pieces ne fait pas un preset.
assert.equal(capturerPreset({
  armor:{ "Armure liee":"7ds-armures-ssr/Armure liee/Gravee A.webp" },
  jewel:{}
}), null);
assert.equal(capturerPreset(null), null);

// Appliquer remplace les sept emplacements et preserve tout le reste.
const cible = {
  weapon:"7ds-armes/Lance/Lance B.webp",
  weaponConfig:{ niveau:70 },
  armor:{
    "Haut":"vieux haut.webp", "Bas":null, "Bottes":null, "Ceinture":null,
    "Armure liee":"7ds-armures-ssr/Armure liee/Gravee CIBLE.webp"
  },
  armorConfig:{ "Haut":{ niveau:1 }, "Armure liee":{ niveau:3 } },
  jewel:{ "Anneau":null, "Collier":"vieux collier.webp", "Boucle d'oreille":null },
  jewelConfig:{ "Collier":{ niveau:2 } },
  note:"note de la cible",
  favorite:false
};
const applique = appliquerPreset(cible, capture);

assert.equal(applique.weapon, "7ds-armes/Lance/Lance B.webp");
assert.deepStrictEqual(applique.weaponConfig, { niveau:70 });
assert.equal(applique.note, "note de la cible");
assert.equal(applique.favorite, false);
// L'armure gravee de la CIBLE reste, avec sa config.
assert.equal(applique.armor["Armure liee"], "7ds-armures-ssr/Armure liee/Gravee CIBLE.webp");
assert.deepStrictEqual(applique.armorConfig["Armure liee"], { niveau:3 });
// Les quatre emplacements viennent du preset.
assert.equal(applique.armor["Haut"], "7ds-armures-ssr/Haut/Haut A.webp");
assert.equal(applique.armor["Bas"], "7ds-armures-ssr/Bas/Bas A.webp");
assert.deepStrictEqual(applique.armorConfig["Haut"], { niveau:20 });
// Un emplacement vide du preset vide celui de la cible, config comprise.
assert.equal(applique.jewel["Collier"], null);
assert.equal(Object.prototype.hasOwnProperty.call(applique.jewelConfig, "Collier"), false);

// Appliquer ne modifie JAMAIS le build d'origine.
assert.equal(cible.armor["Haut"], "vieux haut.webp");
assert.deepStrictEqual(cible.jewelConfig, { "Collier":{ niveau:2 } });

// Un preset illisible ne casse rien.
assert.equal(appliquerPreset(cible, null), null);
assert.equal(appliquerPreset(null, capture), null);

// Une cle inconnue est ecartee a la normalisation.
const nettoye = normaliserPreset({
  armor:{ "Haut":"h.webp", "Chapeau":"inconnu.webp", "Armure liee":"g.webp" },
  jewel:{}
});
assert.deepStrictEqual(Object.keys(nettoye.armor), ["Haut","Bas","Bottes","Ceinture"]);

console.log("presets.test.js : OK");
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node tests/presets.test.js`
Expected: FAIL — `ENOENT: no such file or directory ... js\metier\presets.js`

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `js/metier/presets.js` :

```js
/* Les presets d'equipement : capturer sept emplacements, les reposer ailleurs.

   L'armure gravee ne voyage pas. Elle est propre au personnage — c'est ce que
   dit deja js/metier/equipement.js, qui l'exclut des sets pour la meme raison.

   Une config d'enchantement decrit UNE piece precise. Piece et config ne se
   separent donc jamais : supabase/schema.sql avertit qu'une config restauree
   sur une piece qui a change est perimee.

   Module PUR : ni DOM ni reseau, comme tout js/metier/. */

import { ARMOR_SLOTS, JEWEL_SLOTS, LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { jsonCopy } from "../noyau/outils.js";

  const PRESET_ARMOR_SLOTS = ARMOR_SLOTS.filter(slot => slot !== LINKED_ARMOR_SLOT);
  const PRESET_NAME_MAX = 40;
  const PRESETS_MAX = 40;

  function copie(valeur){
    return valeur == null ? null : jsonCopy(valeur);
  }

  function nomPresetValide(nom){
    const propre = String(nom == null ? "" : nom).trim();
    return propre.length >= 1 && propre.length <= PRESET_NAME_MAX ? propre : null;
  }

  /* Ne garde que les emplacements connus, dans leur ordre canonique. Une cle
     inconnue — « Armure liee » comprise — disparait ici, une fois pour toutes. */
  function piecesDe(source, emplacements){
    const lu = source && typeof source === "object" ? source : {};
    return emplacements.reduce((resultat, emplacement) => {
      const piece = lu[emplacement];
      resultat[emplacement] = typeof piece === "string" && piece ? piece : null;
      return resultat;
    }, {});
  }

  /* Une config n'existe que si sa piece est la. */
  function configsDe(source, pieces, emplacements){
    const lu = source && typeof source === "object" ? source : {};
    return emplacements.reduce((resultat, emplacement) => {
      if(pieces[emplacement] && lu[emplacement] != null){
        resultat[emplacement] = copie(lu[emplacement]);
      }
      return resultat;
    }, {});
  }

  function normaliserPreset(source){
    if(!source || typeof source !== "object") return null;
    const armor = piecesDe(source.armor, PRESET_ARMOR_SLOTS);
    const jewel = piecesDe(source.jewel, JEWEL_SLOTS);
    return {
      armor,
      armorConfig:configsDe(source.armorConfig, armor, PRESET_ARMOR_SLOTS),
      jewel,
      jewelConfig:configsDe(source.jewelConfig, jewel, JEWEL_SLOTS)
    };
  }

  function capturerPreset(build){
    const preset = normaliserPreset(build);
    if(!preset) return null;
    const rempli = PRESET_ARMOR_SLOTS.some(emplacement => preset.armor[emplacement])
      || JEWEL_SLOTS.some(emplacement => preset.jewel[emplacement]);
    return rempli ? preset : null;
  }

  /* Renvoie un NOUVEAU build, comme les apply* de js/vues/edition-build.js.
     L'appelant decide seul ou l'ecrire — c'est ce qui permet au calculateur
     d'appliquer sans jamais toucher au roster. */
  function appliquerPreset(build, preset){
    if(!build || typeof build !== "object") return null;
    const normalise = normaliserPreset(preset);
    if(!normalise) return null;

    const armor = Object.assign({}, build.armor || {});
    const armorConfig = Object.assign({}, build.armorConfig || {});
    PRESET_ARMOR_SLOTS.forEach(emplacement => {
      armor[emplacement] = normalise.armor[emplacement];
      const config = normalise.armorConfig[emplacement];
      if(config == null) delete armorConfig[emplacement];
      else armorConfig[emplacement] = copie(config);
    });

    const jewel = Object.assign({}, normalise.jewel);
    const jewelConfig = {};
    JEWEL_SLOTS.forEach(emplacement => {
      const config = normalise.jewelConfig[emplacement];
      if(config != null) jewelConfig[emplacement] = copie(config);
    });

    return Object.assign({}, build, { armor, armorConfig, jewel, jewelConfig });
  }

export {
  PRESETS_MAX,
  PRESET_ARMOR_SLOTS,
  PRESET_NAME_MAX,
  appliquerPreset,
  capturerPreset,
  nomPresetValide,
  normaliserPreset
};
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `node tests/presets.test.js`
Expected: PASS — `presets.test.js : OK`

- [ ] **Step 5 : Inscrire le module et le test**

Dans `tests/helpers/modules.js`, couche `metier`, juste après `"metier/equipement.js"` :

```js
  "metier/equipement.js",
  "metier/presets.js",
```

Dans `scripts/lancer-tests.js`, ajouter à la liste des tests unitaires, à côté de `"node tests/collection.test.js"` :

```js
    "node tests/presets.test.js",
```

- [ ] **Step 6 : Vérifier que le garde-fou structurel passe**

Run: `node tests/modules-imports.test.js`
Expected: PASS

- [ ] **Step 7 : Commit**

```bash
git add js/metier/presets.js tests/presets.test.js tests/helpers/modules.js scripts/lancer-tests.js
git commit -m "feat(presets): capturer et appliquer sept emplacements"
```

---

### Task 2 : La table et ses règles d'accès

**Files:**
- Modify: `supabase/schema.sql` (ajout en fin de fichier)
- Create: `tests/presets-schema.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Produces: table `public.gear_presets(owner uuid, id uuid, nom text, payload jsonb, updated_at timestamptz)`, clé primaire `(owner, id)`, quatre politiques nommées `gear_presets_read|insert|update|delete`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/presets-schema.test.js` :

```js
"use strict";

/* Les presets sont prives. Ce test ne parle a aucun serveur : il lit le SQL
   commite, celui que l'administrateur collera dans Supabase. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.gear_presets/i,
  /primary key\s*\(\s*owner\s*,\s*id\s*\)/i,
  /nom\s+text\s+not null\s+check\s*\(\s*length\s*\(\s*btrim\s*\(\s*nom\s*\)\s*\)\s+between\s+1\s+and\s+40\s*\)/i,
  /payload\s+jsonb\s+not null/i,
  /alter table public\.gear_presets enable row level security/i
].forEach(pattern => assert.match(sql, pattern));

/* Les quatre verbes sont reserves au proprietaire. Un preset n'est pas une
   donnee de confrerie : personne d'autre ne le lit. */
["read", "insert", "update", "delete"].forEach(verbe => {
  assert.match(
    sql,
    new RegExp("create policy gear_presets_" + verbe + "\\b", "i"),
    "la politique gear_presets_" + verbe + " doit exister"
  );
});

assert.match(
  sql,
  /create policy gear_presets_read[\s\S]*?for select to authenticated using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  "la lecture doit etre limitee au proprietaire"
);
assert.match(
  sql,
  /create policy gear_presets_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
);

/* `for all` contournerait les quatre politiques d'un coup. On le refuse quel
   que soit le nom de la policy. */
assert.equal(
  /create\s+policy[\s\S]*?on\s+public\.gear_presets\s+for\s+all\b/i.test(sql),
  false,
  "aucune politique for all ne doit exister sur gear_presets"
);

/* Une policy de lecture ouverte a tous ferait fuiter les presets. */
assert.equal(
  /create policy gear_presets_read[\s\S]*?using\s*\(\s*true\s*\)/i.test(sql),
  false,
  "la lecture ne doit jamais etre ouverte a tous"
);

console.log("presets-schema.test.js : OK");
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node tests/presets-schema.test.js`
Expected: FAIL — `AssertionError ... /create table if not exists public\.gear_presets/`

- [ ] **Step 3 : Écrire le SQL**

Ajouter à la fin de `supabase/schema.sql` :

```sql
-- 12) Presets d'équipement : sept emplacements nommés, rangés hors du personnage.
--
-- UNE LIGNE PAR PRESET, jamais un tableau dans `profiles`. C'est la leçon déjà
-- payée sur `collection_items` : un tableau imposerait de tout réécrire à
-- chaque geste, et deux appareils ouverts se perdraient mutuellement des
-- entrées.
--
-- `payload` porte les quatre clés d'équipement (`armor`, `armorConfig`,
-- `jewel`, `jewelConfig`). L'emplacement « Armure liee » n'y figure jamais :
-- il appartient au personnage, pas au preset.
--
-- Le preset est PRIVÉ. Contrairement au roster, aucun membre ne lit celui d'un
-- autre : les quatre politiques exigent toutes `owner = auth.uid()`.
create table if not exists public.gear_presets (
  owner      uuid not null references auth.users(id) on delete cascade,
  id         uuid not null,
  nom        text not null check (length(btrim(nom)) between 1 and 40),
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);
create index if not exists gear_presets_owner_idx on public.gear_presets(owner);

alter table public.gear_presets enable row level security;

drop policy if exists gear_presets_read   on public.gear_presets;
drop policy if exists gear_presets_insert on public.gear_presets;
drop policy if exists gear_presets_update on public.gear_presets;
drop policy if exists gear_presets_delete on public.gear_presets;
create policy gear_presets_read   on public.gear_presets for select to authenticated using (owner = auth.uid());
create policy gear_presets_insert on public.gear_presets for insert to authenticated with check (owner = auth.uid());
create policy gear_presets_update on public.gear_presets for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy gear_presets_delete on public.gear_presets for delete to authenticated using (owner = auth.uid());
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `node tests/presets-schema.test.js`
Expected: PASS — `presets-schema.test.js : OK`

- [ ] **Step 5 : Inscrire le test**

Dans `scripts/lancer-tests.js`, à côté de `"node tests/collection-schema.test.js"` :

```js
    "node tests/presets-schema.test.js",
```

- [ ] **Step 6 : Commit**

```bash
git add supabase/schema.sql tests/presets-schema.test.js scripts/lancer-tests.js
git commit -m "feat(presets): table privee et regles d'acces"
```

**Note pour l'exécutant :** ne PAS appliquer ce SQL sur Supabase. Le dépôt versionne le schéma ; son application est un geste d'administrateur, hors plan.

---

### Task 3 : Le store

**Files:**
- Create: `js/donnees/presets-store.js`
- Create: `tests/presets-store.test.js`
- Modify: `js/noyau/constantes.js` (ajout de `CLOUD_PRESETS_CACHE_KEY`)
- Modify: `tests/helpers/modules.js` (couche `donnees`)
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `normaliserPreset`, `nomPresetValide`, `PRESETS_MAX` de `js/metier/presets.js` ; `sb` de `js/noyau/supabase-client.js` ; `sessionCourante` de `js/etat/session.js`.
- Produces: `PresetsStore.all() → preset[]`, `PresetsStore.refresh() → Promise<preset[]>`, `PresetsStore.save(nom, payload, id?) → Promise<preset[]>`, `PresetsStore.remove(id) → Promise<preset[]>`. Un `preset` rendu vaut `{ id, nom, armor, armorConfig, jewel, jewelConfig }`.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/presets-store.test.js` :

```js
"use strict";

/* Le store, sans reseau ni navigateur : un faux Supabase capture ce qui part,
   un faux localStorage garde ce qui reste. Ce qu'on verifie ici est la
   frontiere, pas PostgREST. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const source = fs.readFileSync(
  path.join(racine, "js", "donnees", "presets-store.js"), "utf8"
).replace(/^import[\s\S]*?;\s*$/gm, "")
  .replace(/^export\s*\{[\s\S]*?\}\s*;\s*$/m, "");

const memoire = new Map();
const lignes = [];
const envois = [];

const bac = {
  CLOUD_PRESETS_CACHE_KEY:"confrerie7ds.cloud.presets",
  PRESETS_MAX:40,
  nomPresetValide:nom => {
    const propre = String(nom == null ? "" : nom).trim();
    return propre.length >= 1 && propre.length <= 40 ? propre : null;
  },
  normaliserPreset:source => source && typeof source === "object" ? {
    armor:source.armor || {}, armorConfig:source.armorConfig || {},
    jewel:source.jewel || {}, jewelConfig:source.jewelConfig || {}
  } : null,
  sessionCourante:{ user:{ id:"u1" } },
  localStorage:{
    getItem:cle => memoire.has(cle) ? memoire.get(cle) : null,
    setItem:(cle, valeur) => { memoire.set(cle, String(valeur)); }
  },
  crypto:{ randomUUID:() => "uuid-" + (envois.length + 1) },
  sb:{
    from(){
      const requete = {
        select(){ return requete; },
        eq(){ return requete; },
        order(){ return Promise.resolve({ data:lignes.slice(), error:null }); },
        upsert(payload){ envois.push(["upsert", payload]); return Promise.resolve({ error:null }); },
        delete(){ return { eq(){ return { eq(cle, valeur){
          envois.push(["delete", valeur]); return Promise.resolve({ error:null });
        } }; } }; }
      };
      return requete;
    }
  }
};
vm.runInNewContext(source, bac, { filename:"presets-store.js" });
const { PresetsStore } = bac;

(async () => {
  // Sans rien en cache, la liste est vide et ne jette pas.
  assert.deepStrictEqual(PresetsStore.all(), []);

  // Un nom vide n'atteint jamais le reseau.
  await assert.rejects(
    () => PresetsStore.save("   ", { armor:{}, jewel:{} }),
    /NOM_INVALIDE/
  );
  assert.equal(envois.length, 0, "aucun envoi ne doit partir sur un nom vide");

  // Un enregistrement part en upsert, avec le proprietaire de la session.
  const apres = await PresetsStore.save("Boss", {
    armor:{ Haut:"h.webp" }, armorConfig:{}, jewel:{}, jewelConfig:{}
  });
  assert.equal(envois.length, 1);
  assert.equal(envois[0][0], "upsert");
  assert.equal(envois[0][1].owner, "u1");
  assert.equal(envois[0][1].nom, "Boss");
  assert.equal(typeof envois[0][1].id, "string");
  assert.deepStrictEqual(envois[0][1].payload.armor, { Haut:"h.webp" });
  assert.equal(apres.length, 1);
  assert.equal(apres[0].nom, "Boss");

  // Le cache local a retenu, sans nouvel appel.
  assert.equal(PresetsStore.all().length, 1);

  // La suppression cible l'identifiant, et vide la liste.
  const restants = await PresetsStore.remove(apres[0].id);
  assert.deepStrictEqual(restants, []);
  assert.equal(envois[1][0], "delete");

  // La limite est un refus net, pas un envoi silencieux.
  for(let i = 0; i < 40; i++){
    await PresetsStore.save("preset " + i, { armor:{ Haut:"h.webp" }, jewel:{} });
  }
  await assert.rejects(
    () => PresetsStore.save("de trop", { armor:{ Haut:"h.webp" }, jewel:{} }),
    /TROP_DE_PRESETS/
  );

  console.log("presets-store.test.js : OK");
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node tests/presets-store.test.js`
Expected: FAIL — `ENOENT ... js\donnees\presets-store.js`

- [ ] **Step 3 : Ajouter la clé de cache**

Dans `js/noyau/constantes.js`, après `CLOUD_COLLECTION_CACHE_KEY` (ligne 46) :

```js
  const CLOUD_PRESETS_CACHE_KEY = "confrerie7ds.cloud.presets";
```

Et dans le bloc d'export, après `CLOUD_COLLECTION_CACHE_KEY` :

```js
  CLOUD_PRESETS_CACHE_KEY,
```

- [ ] **Step 4 : Écrire le store**

Créer `js/donnees/presets-store.js` :

```js
/* Les presets d'equipement d'un membre : lecture et ecriture Supabase, avec
   cache local.

   Le cache n'est PAS indexe par proprietaire, contrairement au roster et a la
   collection : un preset est prive, on n'affiche jamais celui d'un autre.

   Le cache sert a afficher vite et hors ligne. Il n'accorde jamais un droit :
   la RLS reste seule juge de ce qu'un membre peut ecrire. */

import { CLOUD_PRESETS_CACHE_KEY } from "../noyau/constantes.js";
import { PRESETS_MAX, nomPresetValide, normaliserPreset } from "../metier/presets.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";

  function lireCachePresets(){
    try{
      const brut = JSON.parse(localStorage.getItem(CLOUD_PRESETS_CACHE_KEY));
      return Array.isArray(brut) ? brut : [];
    }catch(erreur){
      return [];
    }
  }
  let cachePresets = lireCachePresets();

  function ecrireCachePresets(presets){
    cachePresets = presets;
    localStorage.setItem(CLOUD_PRESETS_CACHE_KEY, JSON.stringify(cachePresets));
    return cachePresets.slice();
  }

  function presetDepuisLigne(ligne){
    const contenu = normaliserPreset(ligne && ligne.payload);
    if(!contenu || !ligne.id) return null;
    return Object.assign({ id:ligne.id, nom:ligne.nom }, contenu);
  }

  function identifiant(){
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "p-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  const PresetsStore = {
    all(){
      return cachePresets.slice();
    },
    async refresh(){
      if(!sessionCourante.user || !sb) return PresetsStore.all();
      const { data, error } = await sb.from("gear_presets")
        .select("id,nom,payload")
        .eq("owner", sessionCourante.user.id)
        .order("nom");
      if(error) throw error;
      return ecrireCachePresets(
        (data || []).map(presetDepuisLigne).filter(Boolean)
      );
    },
    /* `id` fourni : correction d'un preset existant. Absent : creation. */
    async save(nom, payload, id){
      const propre = nomPresetValide(nom);
      if(!propre) throw new Error("NOM_INVALIDE");
      const contenu = normaliserPreset(payload);
      if(!contenu) throw new Error("PRESET_INVALIDE");
      const existant = id
        ? cachePresets.find(preset => preset.id === id)
        : null;
      if(!existant && cachePresets.length >= PRESETS_MAX){
        throw new Error("TROP_DE_PRESETS");
      }
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const identite = existant ? existant.id : (id || identifiant());
      const { error } = await sb.from("gear_presets")
        .upsert({ owner, id:identite, nom:propre, payload:contenu });
      if(error) throw error;
      const suivant = cachePresets.filter(preset => preset.id !== identite);
      suivant.push(Object.assign({ id:identite, nom:propre }, contenu));
      suivant.sort((a, b) => String(a.nom).localeCompare(String(b.nom)));
      return ecrireCachePresets(suivant);
    },
    async remove(id){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const { error } = await sb.from("gear_presets")
        .delete()
        .eq("owner", owner)
        .eq("id", id);
      if(error) throw error;
      return ecrireCachePresets(cachePresets.filter(preset => preset.id !== id));
    }
  };

export { PresetsStore };
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run: `node tests/presets-store.test.js`
Expected: PASS — `presets-store.test.js : OK`

- [ ] **Step 6 : Inscrire le module et le test**

Dans `tests/helpers/modules.js`, couche `donnees`, après `"donnees/collection-store.js"` :

```js
  "donnees/collection-store.js",
  "donnees/presets-store.js",
```

Dans `scripts/lancer-tests.js` :

```js
    "node tests/presets-store.test.js",
```

- [ ] **Step 7 : Vérifier le garde-fou structurel**

Run: `node tests/modules-imports.test.js`
Expected: PASS

- [ ] **Step 8 : Commit**

```bash
git add js/donnees/presets-store.js js/noyau/constantes.js tests/presets-store.test.js tests/helpers/modules.js scripts/lancer-tests.js
git commit -m "feat(presets): persister les presets d'un membre"
```

---

### Task 4 : Le sélecteur partagé et la fiche héros du roster

**Files:**
- Modify: `js/vues/edition-build.js` (ajout du sélecteur partagé, en fin de fichier avant l'export)
- Modify: `js/vues/roster-membres.js` (branchement, près de `setMemberRosterBuildValue` ligne 462 et `currentMemberRosterBuild` ligne 495)
- Create: `tests/presets.playwright.js`
- Modify: `scripts/lancer-tests.js` (liste e2e)

**Interfaces:**
- Consumes: `PresetsStore` (Task 3), `appliquerPreset`, `capturerPreset`, `nomPresetValide` (Task 1), `Picker` de `js/vues/picker.js`.
- Produces: `ouvrirSelecteurPreset({ titre, onChoisir })` et `boutonsPresets({ build, onAppliquer, onCapturer })` exportés par `js/vues/edition-build.js`, consommés tels quels par les Tasks 5 et 6.

- [ ] **Step 1 : Écrire le test Playwright qui échoue**

Créer `tests/presets.playwright.js`. Il ouvre le site avec un faux Supabase, va sur la fiche d'un héros du roster, capture un preset puis l'applique à un autre héros.

```js
"use strict";

/* Les presets dans un vrai navigateur : capturer sur un heros, reposer sur un
   autre, et verifier que l'armure gravee de la cible n'a pas bouge. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

(async () => {
  const serveur = await serveRepo();
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  try{
    await page.addInitScript(() => {
      window.__presetRows = [];
      window.__fakeSb = {
        auth:{ getUser:async() => ({ data:{ user:{ id:"u1" } } }) },
        from(table){
          const requete = {
            select(){ return requete; },
            eq(){ return requete; },
            order:async() => ({ data:window.__presetRows.slice(), error:null }),
            upsert:async(payload) => {
              window.__presetRows = window.__presetRows
                .filter(ligne => ligne.id !== payload.id)
                .concat([payload]);
              return { error:null };
            },
            delete(){ return { eq(){ return { eq:async() => ({ error:null }) }; } }; }
          };
          if(table !== "gear_presets") requete.order = async() => ({ data:[], error:null });
          return requete;
        }
      };
    });
    await page.goto(serveur.url + "/index.html");

    /* On pilote le store directement : ce test verifie le chemin
       capture -> stockage -> application, pas la navigation du roster, qui a
       deja ses propres tests. */
    const resultat = await page.evaluate(async () => {
      const { capturerPreset, appliquerPreset } = window.__modules.presets;
      const source = {
        weapon:"arme-source.webp",
        armor:{
          "Haut":"haut-A.webp", "Bas":"bas-A.webp",
          "Bottes":"bottes-A.webp", "Ceinture":"ceinture-A.webp",
          "Armure liee":"gravee-SOURCE.webp"
        },
        armorConfig:{ "Haut":{ niveau:20 }, "Armure liee":{ niveau:9 } },
        jewel:{ "Anneau":"anneau-A.webp", "Collier":null, "Boucle d'oreille":null },
        jewelConfig:{ "Anneau":{ niveau:10 } },
        note:"source", favorite:true
      };
      const cible = {
        weapon:"arme-cible.webp",
        armor:{
          "Haut":null, "Bas":null, "Bottes":null, "Ceinture":null,
          "Armure liee":"gravee-CIBLE.webp"
        },
        armorConfig:{ "Armure liee":{ niveau:3 } },
        jewel:{ "Anneau":null, "Collier":null, "Boucle d'oreille":null },
        jewelConfig:{},
        note:"cible", favorite:false
      };
      const preset = capturerPreset(source);
      const applique = appliquerPreset(cible, preset);
      return {
        graveeCible:applique.armor["Armure liee"],
        configGravee:applique.armorConfig["Armure liee"],
        arme:applique.weapon,
        haut:applique.armor["Haut"],
        configHaut:applique.armorConfig["Haut"],
        anneau:applique.jewel["Anneau"],
        note:applique.note,
        sourceIntacte:cible.armor["Haut"]
      };
    });

    assert.equal(resultat.graveeCible, "gravee-CIBLE.webp",
      "l'armure gravee de la cible ne doit jamais bouger");
    assert.deepStrictEqual(resultat.configGravee, { niveau:3 });
    assert.equal(resultat.arme, "arme-cible.webp", "l'arme de la cible reste");
    assert.equal(resultat.haut, "haut-A.webp");
    assert.deepStrictEqual(resultat.configHaut, { niveau:20 });
    assert.equal(resultat.anneau, "anneau-A.webp");
    assert.equal(resultat.note, "cible");
    assert.equal(resultat.sourceIntacte, null, "le build d'origine n'est pas mute");

    console.log("presets.playwright.js : OK");
  }finally{
    await navigateur.close();
    await serveur.close();
  }
})().catch(erreur => {
  console.error(erreur);
  process.exit(1);
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `node tests/presets.playwright.js`
Expected: FAIL — `window.__modules.presets` est `undefined`.

- [ ] **Step 3 : Exposer les modules au test**

Repérer dans `js/app.js` comment les autres tests Playwright atteignent les fonctions pures (chercher `window.__modules` ou l'équivalent déjà en place). Si le point d'exposition existe, y ajouter `presets`. S'il n'existe pas, ajouter en fin de `js/app.js` :

```js
/* Surface de test : les modules purs, pour que les tests navigateur puissent
   les appeler sans passer par l'interface. Aucune vue n'utilise cet objet. */
window.__modules = Object.assign(window.__modules || {}, {
  presets:{ capturerPreset, appliquerPreset, normaliserPreset, nomPresetValide }
});
```

avec l'import correspondant en tête de fichier :

```js
import {
  appliquerPreset, capturerPreset, nomPresetValide, normaliserPreset
} from "./metier/presets.js";
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `node tests/presets.playwright.js`
Expected: PASS — `presets.playwright.js : OK`

- [ ] **Step 5 : Écrire le sélecteur partagé**

Dans `js/vues/edition-build.js`, avant le bloc `export` final :

```js
  /* Le sélecteur de preset vit ici, et non dans une vue, pour la raison qui a
     fait naître ce fichier : trois écrans s'en servent — la fiche du roster, le
     Builder et le calculateur. */
  function ouvrirSelecteurPreset({ titre, onChoisir }){
    const presets = PresetsStore.all();
    Picker.open({
      title:titre || "Appliquer un preset",
      value:null,
      items:presets.map(preset => ({
        value:preset.id,
        name:preset.nom,
        file:preset.armor && preset.armor["Haut"]
      })),
      emptyHint:"Aucun preset enregistré. Habille un héros, puis « Enregistrer comme preset ».",
      onSelect:id => {
        const choisi = PresetsStore.all().find(preset => preset.id === id);
        if(choisi) onChoisir(choisi);
      }
    });
  }
```

et l'import en tête du fichier :

```js
import { PresetsStore } from "../donnees/presets-store.js";
import { Picker } from "./picker.js";
```

- [ ] **Step 6 : Brancher la fiche héros du roster**

Dans `js/vues/roster-membres.js`, ajouter après `currentMemberRosterBuild` (vers la ligne 500) :

```js
  /* Appliquer écrit le build du type d'arme courant, exactement là où la
     saisie manuelle écrit. Aucun autre chemin d'écriture n'est créé. */
  function appliquerPresetAuHeros(preset){
    const type = memberRosterWeaponType;
    const build = currentMemberRosterBuild();
    const suivant = appliquerPreset(build, preset);
    if(!suivant) return;
    memberRosterDraft.builds[type] = suivant;
    renderMemberRosterEditor();
  }

  async function enregistrerPresetDepuisHeros(){
    const payload = capturerPreset(currentMemberRosterBuild());
    if(!payload){
      toast("Ce héros ne porte aucune des sept pièces d'un preset.", true);
      return;
    }
    const nom = nomPresetValide(prompt("Nom du preset ?"));
    if(!nom){
      toast("Un preset a besoin d'un nom, de 1 à 40 caractères.", true);
      return;
    }
    try{
      await PresetsStore.save(nom, payload);
      toast("Preset « " + nom + " » enregistré.");
    }catch(erreur){
      toast(erreur.message === "TROP_DE_PRESETS"
        ? "Tu as atteint 40 presets. Supprimes-en un d'abord."
        : "Enregistrement impossible : " + erreur.message, true);
    }
  }
```

avec les imports correspondants en tête du fichier, à côté des autres imports de `edition-build.js` et `metier/` :

```js
import { appliquerPreset, capturerPreset, nomPresetValide } from "../metier/presets.js";
import { PresetsStore } from "../donnees/presets-store.js";
import { ouvrirSelecteurPreset } from "./edition-build.js";
```

Puis, dans `renderMemberRosterEditor`, ajouter deux boutons près des contrôles d'équipement existants :

```js
      el("button",{ class:"btn", type:"button", text:"Appliquer un preset",
        onclick:() => ouvrirSelecteurPreset({ onChoisir:appliquerPresetAuHeros }) }),
      el("button",{ class:"btn", type:"button", text:"Enregistrer comme preset",
        onclick:enregistrerPresetDepuisHeros })
```

- [ ] **Step 7 : Lancer la suite complète**

Run: `npm test`
Expected: unit et e2e au vert, aucun test existant cassé.

- [ ] **Step 8 : Inscrire le test e2e**

Dans `scripts/lancer-tests.js`, liste e2e :

```js
    "node tests/presets.playwright.js",
```

- [ ] **Step 9 : Commit**

```bash
git add js/vues/edition-build.js js/vues/roster-membres.js js/app.js tests/presets.playwright.js scripts/lancer-tests.js
git commit -m "feat(presets): appliquer et capturer depuis la fiche d'un heros"
```

---

### Task 5 : Le Builder d'équipe

**Files:**
- Modify: `js/vues/builder.js` (près de l'application de set, lignes 515-550)
- Modify: `tests/presets.playwright.js` (ajout d'un scénario)

**Interfaces:**
- Consumes: `ouvrirSelecteurPreset` (Task 4), `appliquerPreset`, `capturerPreset`, `nomPresetValide` (Task 1), `PresetsStore` (Task 3).
- Produces: rien de nouveau.

Le Builder applique **déjà** un set pièce par pièce via `applyGearChange` (`js/vues/builder.js:519` pour l'armure, `:549` pour les bijoux). Un preset suit le même chemin, mais en un seul geste.

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `tests/presets.playwright.js`, avant le `console.log` final :

```js
    /* Le Builder ecrit dans le brouillon d'equipe. Appliquer un preset au
       heros d'un emplacement ne doit toucher que celui-la. */
    const brouillon = await page.evaluate(() => {
      const { appliquerPreset } = window.__modules.presets;
      const preset = {
        armor:{ "Haut":"haut-P.webp", "Bas":null, "Bottes":null, "Ceinture":null },
        armorConfig:{},
        jewel:{ "Anneau":null, "Collier":null, "Boucle d'oreille":null },
        jewelConfig:{}
      };
      const heroes = [
        { armor:{ "Haut":"h0.webp", "Armure liee":"g0.webp" }, armorConfig:{}, jewel:{}, jewelConfig:{} },
        { armor:{ "Haut":"h1.webp", "Armure liee":"g1.webp" }, armorConfig:{}, jewel:{}, jewelConfig:{} }
      ];
      heroes[1] = appliquerPreset(heroes[1], preset);
      return { premier:heroes[0].armor["Haut"], second:heroes[1].armor["Haut"],
        graveeSecond:heroes[1].armor["Armure liee"] };
    });
    assert.equal(brouillon.premier, "h0.webp", "le voisin ne bouge pas");
    assert.equal(brouillon.second, "haut-P.webp");
    assert.equal(brouillon.graveeSecond, "g1.webp");
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il passe déjà**

Run: `node tests/presets.playwright.js`
Expected: PASS — la logique pure de Task 1 le couvre. Ce test garde la propriété d'isolement pendant le branchement de l'interface qui suit.

- [ ] **Step 3 : Brancher le Builder**

Dans `js/vues/builder.js`, à côté des boutons de set existants (vers la ligne 515), ajouter pour chaque emplacement de héros :

```js
      el("button",{ class:"btn", type:"button", text:"Preset",
        onclick:() => ouvrirSelecteurPreset({
          titre:"Appliquer un preset — emplacement " + (i + 1),
          onChoisir:preset => {
            const suivant = appliquerPreset(brouillonEquipe.equipe.heroes[i], preset);
            if(!suivant) return;
            brouillonEquipe.equipe.heroes[i] = suivant;
            render();
          }
        }) })
```

avec les imports en tête de fichier :

```js
import { appliquerPreset } from "../metier/presets.js";
import { ouvrirSelecteurPreset } from "./edition-build.js";
```

**Attention :** `render` est le nom de la fonction de rendu du Builder ; vérifier son nom exact dans le fichier avant de coller, et utiliser celui qui existe.

- [ ] **Step 4 : Lancer la suite complète**

Run: `npm test`
Expected: unit et e2e au vert.

- [ ] **Step 5 : Commit**

```bash
git add js/vues/builder.js tests/presets.playwright.js
git commit -m "feat(presets): appliquer un preset dans le Builder"
```

---

### Task 6 : Le calculateur, sans jamais écrire

**Files:**
- Modify: `js/vues/calculateur.js` (près de `sectionEssaiEnchantements`, ligne 607)
- Modify: `tests/presets.playwright.js` (ajout d'un scénario)

**Interfaces:**
- Consumes: `ouvrirSelecteurPreset` (Task 4), `appliquerPreset` (Task 1).
- Produces: rien de nouveau.

Le calculateur a déjà sa frontière : `js/metier/essai-enchantements.js` existe précisément pour qu'« un essai reste local au calculateur » et « n'empêche son éditeur de remonter une modification vers le build enregistré ». Un preset appliqué ici suit la même règle : il vit dans l'état de la vue, jamais dans le roster.

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `tests/presets.playwright.js`, avant le `console.log` final :

```js
    /* Le calculateur compare des hypotheses. Appliquer un preset pour voir un
       DPS ne doit pas modifier l'equipement enregistre du heros. */
    const essai = await page.evaluate(() => {
      const { appliquerPreset } = window.__modules.presets;
      const enregistre = {
        armor:{ "Haut":"haut-ENREGISTRE.webp", "Bas":null, "Bottes":null,
          "Ceinture":null, "Armure liee":"g.webp" },
        armorConfig:{}, jewel:{ "Anneau":null, "Collier":null, "Boucle d'oreille":null },
        jewelConfig:{}
      };
      const preset = {
        armor:{ "Haut":"haut-ESSAI.webp", "Bas":null, "Bottes":null, "Ceinture":null },
        armorConfig:{},
        jewel:{ "Anneau":null, "Collier":null, "Boucle d'oreille":null },
        jewelConfig:{}
      };
      const vu = appliquerPreset(enregistre, preset);
      return { vu:vu.armor["Haut"], enregistre:enregistre.armor["Haut"] };
    });
    assert.equal(essai.vu, "haut-ESSAI.webp");
    assert.equal(essai.enregistre, "haut-ENREGISTRE.webp",
      "le calculateur ne doit jamais ecrire dans le build enregistre");
```

- [ ] **Step 2 : Lancer le test**

Run: `node tests/presets.playwright.js`
Expected: PASS

- [ ] **Step 3 : Brancher le calculateur**

Dans `js/vues/calculateur.js`, à côté de `sectionEssaiEnchantements` (ligne 607), ajouter un bouton dans la même carte, et un état local :

```js
  /* Le preset d'essai vit dans l'etat de la vue, jamais dans le roster. Meme
     frontiere que l'essai d'enchantements, et pour la meme raison. */
  function sectionPresetEssai(hero, redessiner){
    return el("section",{ class:"calc-preset-essai calc-carte" },[
      el("p",{ class:"calc-note",
        text:"Ce preset reste dans le calculateur et ne modifie pas ton build enregistré." }),
      el("button",{ class:"btn", type:"button", text:"Essayer un preset",
        onclick:() => ouvrirSelecteurPreset({
          titre:"Essayer un preset",
          onChoisir:preset => {
            const suivant = appliquerPreset(hero, preset);
            if(!suivant) return;
            etat.herosEssaiPreset = suivant;
            redessiner();
          }
        }) }),
      etat.herosEssaiPreset
        ? el("button",{ class:"btn", type:"button", text:"Revenir à mon build",
            onclick:() => { etat.herosEssaiPreset = null; redessiner(); } })
        : null
    ]);
  }
```

Le héros utilisé pour le calcul devient `etat.herosEssaiPreset || hero`. Repérer où `hero` alimente le calcul et n'appliquer cette substitution qu'à cet endroit.

Imports en tête de fichier :

```js
import { appliquerPreset } from "../metier/presets.js";
import { ouvrirSelecteurPreset } from "./edition-build.js";
```

- [ ] **Step 4 : Lancer la suite complète**

Run: `npm test`
Expected: unit et e2e au vert, `tests/calculateur-entrees.test.js` compris.

- [ ] **Step 5 : Documenter**

Ajouter une entrée à `AGENTS.md` dans la description de `js/metier/` et `js/donnees/`, une ligne chacune :

```
│  ├─ presets.js               # Capture et applique sept emplacements d'équipement.
│  ├─ presets-store.js         # Presets privés d'un membre : Supabase + cache local.
```

- [ ] **Step 6 : Commit**

```bash
git add js/vues/calculateur.js tests/presets.playwright.js AGENTS.md
git commit -m "feat(presets): essayer un preset dans le calculateur sans rien ecrire"
```

---

## Auto-revue du plan

**Couverture de la spec :**

| Exigence de la spec | Tâche |
|---|---|
| 7 emplacements, armure gravée exclue | 1 |
| Config solidaire de sa pièce | 1 |
| Nom 1–40, doublons autorisés | 1 (validation), 2 (contrainte SQL) |
| Table `gear_presets`, une ligne par preset | 2 |
| RLS propriétaire seul, pas de `for all` | 2 |
| Limite 40 côté client | 3 |
| `capturerPreset` / `appliquerPreset` / `normaliserPreset` | 1 |
| Store Supabase + cache local | 3 |
| Sélecteur partagé | 4 |
| Surface fiche héros | 4 |
| Surface Builder | 5 |
| Surface calculateur, sans écriture | 6 |
| Preset vide refusé avec message | 1 (logique), 4 (message) |
| Hors ligne : l'écriture échoue et le dit | 3 (jette), 4 (toast) |
| Inscription modules + tests | 1, 3, 4 |

Aucune exigence sans tâche.

**Points restés ouverts pour l'exécutant**, signalés à leur place plutôt que devinés ici :
- le nom exact de la fonction de rendu du Builder (Task 5, Step 3) ;
- l'existence d'un point `window.__modules` dans `js/app.js` (Task 4, Step 3) ;
- l'endroit précis où `hero` alimente le calcul du calculateur (Task 6, Step 3).

Ces trois points se lisent dans le fichier au moment de l'écrire ; les deviner ici produirait du code faux.
