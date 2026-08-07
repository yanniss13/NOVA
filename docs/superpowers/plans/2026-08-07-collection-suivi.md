# Suivi de collection — plan d'implémentation

> **Pour l'exécutant :** spec de référence
> `docs/superpowers/specs/2026-08-07-collection-suivi-design.md`.
> Les étapes se cochent (`- [x]`) au fur et à mesure.

**But :** un onglet où le membre coche les armes et armures gravées qu'il
possède, pour ne garder sous les yeux que ce qui lui reste à chercher.

**Architecture :** une table Supabase à une ligne par objet possédé, un module
métier pur qui fusionne le marqué et l'équipé, une vue qui réemploie les listes
et les grilles déjà écrites pour le Wiki.

**Pile :** ES modules sans étape de build, Supabase (PostgREST + RLS + Realtime),
tests `node:test` et Playwright.

## Contraintes globales

- **Tout export doit être importé par quelqu'un** —
  `tests/modules-imports.test.js` refuse un export orphelin. C'est ce qui dicte
  le regroupement des tâches : un module et son premier consommateur atterrissent
  dans le même commit.
- **Tout module de `js/` doit figurer dans `tests/helpers/modules.js` et dans
  `CORE_ASSETS` de `sw.js`** — `tests/pwa.test.js` le vérifie.
- **Les couches de `tests/helpers/modules.js` sont ordonnées** : un module
  n'importe jamais un module déclaré après lui.
- **Les noms de premier niveau sont uniques dans tout `js/`.** Le chargeur `vm`
  des tests concatène tous les modules dans une portée commune : deux
  `function entete()` dans deux fichiers sont une redéclaration, et un test sans
  rapport échoue sur une `SyntaxError`.
- **Aucune ligne de commentaire ne commence par le mot-clé de sortie de module** :
  le chargeur `vm` la prendrait pour une déclaration.
- **Le cache local n'accorde jamais un droit.** La RLS reste seule juge ; le
  cache ne sert qu'à afficher vite et hors ligne.
- **`supabase/schema.sql` est idempotent** : `create table if not exists`,
  `drop policy if exists` avant chaque `create policy`.
- Français partout dans l'interface ; commentaires de code en français **sans
  accents**, convention du dépôt.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `supabase/schema.sql` *(modifié)* | la table `collection_items` et ses trois politiques |
| `js/metier/collection.js` *(créé)* | pur : équipés, possession fusionnée, utilité au roster, décompte |
| `js/donnees/collection-store.js` *(créé)* | lecture, marquage, démarquage, cache hors ligne |
| `js/vues/collection.js` *(créé)* | l'onglet : sélecteur de membre, filtres, grilles, geste |
| `css/collection.css` *(créé)* | l'habillage propre à l'onglet |
| `js/noyau/constantes.js` *(modifié)* | la clé de cache |
| `js/vues/synchro-temps-reel.js` *(modifié)* | la table dans la liste écoutée |

---

### Tâche 1 : la table et ses politiques

Indépendante du reste : elle ne touche que du SQL et son test de forme.

**Fichiers :**
- Modifier : `supabase/schema.sql`
- Créer : `tests/collection-schema.test.js`
- Modifier : `package.json` (les scripts `test` et `test:unit`)

**Interfaces produites :** la table `public.collection_items(owner, item,
created_at)`, clé primaire `(owner, item)`, politiques `collection_read`,
`collection_insert`, `collection_delete`.

- [x] **Étape 1 : écrire le test qui échoue**

Créer `tests/collection-schema.test.js`, sur le modèle de
`tests/roster-schema.test.js` :

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
  /create table if not exists public\.collection_items/i,
  /primary key\s*\(\s*owner\s*,\s*item\s*\)/i,
  /alter table public\.collection_items enable row level security/i,
  /create policy collection_read[\s\S]*?for select to authenticated using\s*\(\s*true\s*\)/i,
  /create policy collection_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i,
  /create policy collection_delete[\s\S]*?using\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

/* Aucune politique `update` : une ligne de collection n'a rien a modifier,
   elle existe ou elle n'existe pas. En creer une ouvrirait un droit dont
   personne n'a besoin. */
assert.equal(
  /create policy collection_update/i.test(sql),
  false,
  "collection_items ne doit pas avoir de politique update"
);

console.log("PASS schema : collection_items et ses politiques");
```

- [x] **Étape 2 : vérifier l'échec**

Run : `node tests/collection-schema.test.js`
Attendu : ÉCHEC sur `create table if not exists public.collection_items`.

- [x] **Étape 3 : ajouter la table au schéma**

Dans `supabase/schema.sql`, après le bloc du roster (section 4), insérer :

```sql
-- 4bis) Collection : les armes et armures gravees qu'un membre possede.
-- UNE LIGNE PAR OBJET, et non un tableau par membre : cocher est un insert,
-- decocher un delete, deux operations atomiques. Un tableau imposerait de
-- reecrire les 223 entrees a chaque clic, et deux appareils ouverts en meme
-- temps s'ecraseraient — c'est exactement ce qui a impose un verrou de
-- comparaison-et-echange a roster_characters.
create table if not exists public.collection_items (
  owner      uuid not null references auth.users(id) on delete cascade,
  item       text not null,
  created_at timestamptz not null default now(),
  primary key (owner, item)
);
create index if not exists collection_items_owner_idx
  on public.collection_items(owner);
```

Puis, dans la section RLS, à la suite des politiques du roster :

```sql
-- collection : lecture par tout membre ; ecriture/suppression de la sienne.
-- Pas de politique update : une ligne existe ou n'existe pas.
alter table public.collection_items enable row level security;
drop policy if exists collection_read   on public.collection_items;
drop policy if exists collection_insert on public.collection_items;
drop policy if exists collection_delete on public.collection_items;
create policy collection_read   on public.collection_items for select to authenticated using (true);
create policy collection_insert on public.collection_items for insert to authenticated with check (owner = auth.uid());
create policy collection_delete on public.collection_items for delete to authenticated using (owner = auth.uid());
```

- [x] **Étape 4 : vérifier que le test passe**

Run : `node tests/collection-schema.test.js`
Attendu : `PASS schema : collection_items et ses politiques`.

- [x] **Étape 5 : brancher le test**

Dans `package.json`, ajouter `&& node tests/collection-schema.test.js` juste
après `node tests/roster-schema.test.js`, dans **`test` et `test:unit`**.

- [x] **Étape 6 : commit**

```bash
git add supabase/schema.sql tests/collection-schema.test.js package.json
git commit -m "feat: table de collection, une ligne par objet possede"
```

---

### Tâche 2 : le module métier et l'onglet

Le module métier et son premier consommateur atterrissent ensemble : un export
que personne n'importe fait échouer `tests/modules-imports.test.js`.

À la fin de cette tâche, l'onglet affiche les 223 objets, les filtre et les
compte. **Les équipés apparaissent déjà possédés et verrouillés**, puisqu'ils se
dérivent du roster déjà chargé. Rien n'est encore persistant : le marquage
arrive en tâche 3.

**Fichiers :**
- Créer : `js/metier/collection.js`, `js/vues/collection.js`,
  `css/collection.css`, `tests/collection.test.js`
- Modifier : `index.html`, `js/app.js`, `sw.js`, `tests/helpers/modules.js`,
  `tests/css-ordre.test.js`, `tests/accessibilite-mobile.playwright.js`,
  `package.json`

**Interfaces consommées :** `armesDuWiki()`, `graveesDuWiki()`
(`js/metier/wiki-equipement.js`) ; `MemberRosterStore.all(ownerId)`
(`js/donnees/roster-store.js`) ; `weaponTypesOf(charId)`
(`js/metier/armes.js`) ; `FOLDER_TO_ENUM`, `LINKED_ARMOR_SLOT`
(`js/noyau/constantes.js`).

**Interfaces produites :**

```js
// js/metier/collection.js
equipesDuRoster(entrees)            // Set<string> des chemins equipes
possessionsDe(marques, equipes)     // Set<string> : marque OU equipe
utilesAuRoster(entrees, objets)     // Set<string> des chemins qui servent
progressionDe(objets, possessions)  // {total, possedes, manquants}
```

- [x] **Étape 1 : écrire le test du module métier**

Créer `tests/collection.test.js`. Le module tourne dans un `vm` avec ses
dépendances posées en globales, comme `tests/wiki-equipement.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { plain } = require("./helpers/load-app");

const RACINE = path.join(__dirname, "..");

function charger(){
  const source = fs
    .readFileSync(path.join(RACINE, "js", "metier", "collection.js"), "utf8")
    .replace(/^\s*import\s[\s\S]*?from\s+"[^"]*";\s*$/gm, "")
    .replace(/export\s*\{[^}]*\};?/, "");
  const contexte = {
    LINKED_ARMOR_SLOT:"Armure liee",
    FOLDER_TO_ENUM:{ "Hache":"Axe", "Livre":"Book" },
    /* Derieri manie la hache, Merlin le livre. */
    weaponTypesOf:charId => (
      { derieri:["Hache"], merlin:["Livre"] }[charId] || []
    )
  };
  vm.runInNewContext(
    source + "\nthis.__api = { equipesDuRoster, possessionsDe,"
      + " utilesAuRoster, progressionDe };",
    contexte,
    { filename:"collection.js" }
  );
  return contexte.__api;
}

const ROSTER = [
  {
    charId:"derieri",
    builds:{
      Hache:{
        weapon:"7ds-armes/Hache/hache-a.webp",
        armor:{ "Armure liee":"7ds-armures-ssr/Armure liee/gravee-a.webp" }
      },
      /* Un build sans arme ni gravee : il ne doit rien ajouter. */
      "Epee 1 main":{ weapon:null, armor:{} }
    }
  }
];

const OBJETS = [
  { file:"7ds-armes/Hache/hache-a.webp",  nature:"arme",   type:"Axe" },
  { file:"7ds-armes/Livre/livre-a.webp",  nature:"arme",   type:"Book" },
  { file:"7ds-armes/Lance/lance-a.webp",  nature:"arme",   type:"Lance" },
  { file:"7ds-armures-ssr/Armure liee/gravee-a.webp", nature:"gravee", heros:"derieri" },
  { file:"7ds-armures-ssr/Armure liee/gravee-b.webp", nature:"gravee", heros:"escanor" }
];

// L'arme et l'armure gravee de chaque build comptent, et rien d'autre.
{
  const { equipesDuRoster } = charger();
  assert.deepEqual(
    plain([...equipesDuRoster(ROSTER)]).sort(),
    [
      "7ds-armes/Hache/hache-a.webp",
      "7ds-armures-ssr/Armure liee/gravee-a.webp"
    ]
  );
  assert.deepEqual(plain([...equipesDuRoster([])]), []);
  assert.deepEqual(plain([...equipesDuRoster(null)]), []);
}

/* Possede = marque explicitement OU equipe. Les deux ensembles se
   fusionnent, ils ne se remplacent pas. */
{
  const { equipesDuRoster, possessionsDe } = charger();
  const equipes = equipesDuRoster(ROSTER);
  const marques = new Set(["7ds-armes/Lance/lance-a.webp"]);
  assert.deepEqual(
    plain([...possessionsDe(marques, equipes)]).sort(),
    [
      "7ds-armes/Hache/hache-a.webp",
      "7ds-armes/Lance/lance-a.webp",
      "7ds-armures-ssr/Armure liee/gravee-a.webp"
    ]
  );
}

/* ⚠️ Les deux vocabulaires d'arme. `weaponTypesOf` rend des noms de DOSSIER
   (« Hache »), les objets portent un ENUM (« Axe »). Sans FOLDER_TO_ENUM,
   l'ensemble serait vide et le filtre ne montrerait jamais rien. */
{
  const { utilesAuRoster } = charger();
  assert.deepEqual(
    plain([...utilesAuRoster(ROSTER, OBJETS)]).sort(),
    [
      // la hache : Derieri la manie
      "7ds-armes/Hache/hache-a.webp",
      // la gravee de Derieri, qui est au roster
      "7ds-armures-ssr/Armure liee/gravee-a.webp"
    ],
    "ni la lance (aucun heros), ni la gravee d'Escanor (hors roster)"
  );
  assert.deepEqual(plain([...utilesAuRoster([], OBJETS)]), []);
}

// Le decompte, sur lequel s'affiche « 2 / 5 possedes ».
{
  const { equipesDuRoster, possessionsDe, progressionDe } = charger();
  const possessions = possessionsDe(new Set(), equipesDuRoster(ROSTER));
  assert.deepEqual(plain(progressionDe(OBJETS, possessions)), {
    total:5, possedes:2, manquants:3
  });
  assert.deepEqual(plain(progressionDe([], new Set())), {
    total:0, possedes:0, manquants:0
  });
}

console.log("PASS collection : possession, utilite au roster et progression");
```

- [x] **Étape 2 : vérifier l'échec**

Run : `node tests/collection.test.js`
Attendu : ÉCHEC, `js/metier/collection.js` n'existe pas.

- [x] **Étape 3 : écrire le module métier**

Créer `js/metier/collection.js` :

```js
/* La possession d'un objet, calculee et non stockee en entier.

   Un objet est possede s'il est MARQUE explicitement ou EQUIPE dans un build
   du membre affiche. La part equipee ne se stocke pas : elle se derive du
   roster a chaque rendu, ce qui evite de tenir a jour deux verites qui
   pourraient diverger.

   Pur : ni DOM ni reseau, donc testable seul. */

import { FOLDER_TO_ENUM, LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { weaponTypesOf } from "./armes.js";

  /* Les chemins que le roster d'un membre porte deja : l'arme de chaque build
     et son armure gravee. Une piece equipee est forcement possedee. */
  function equipesDuRoster(entrees){
    const equipes = new Set();
    (entrees || []).forEach(entree => {
      const builds = (entree && entree.builds) || {};
      Object.keys(builds).forEach(type => {
        const build = builds[type];
        if(!build) return;
        if(build.weapon) equipes.add(build.weapon);
        const gravee = build.armor && build.armor[LINKED_ARMOR_SLOT];
        if(gravee) equipes.add(gravee);
      });
    });
    return equipes;
  }

  /* La regle de possession, en un seul endroit. Les deux ensembles se
     fusionnent : un objet marque le reste meme desequipe, un objet equipe
     compte meme jamais marque. */
  function possessionsDe(marques, equipes){
    const tout = new Set(marques || []);
    (equipes || []).forEach(item => tout.add(item));
    return tout;
  }

  /* Ce qui sert vraiment au roster affiche : les armures gravees de ses
     personnages, et les armes du type qu'ils manient.

     ⚠️ Les deux cotes ne parlent pas la meme langue. `weaponTypesOf` rend des
     noms de DOSSIER (« Hache »), les objets du Wiki portent un ENUM
     (« Axe »). FOLDER_TO_ENUM fait le pont ; comparer sans lui rendrait un
     ensemble vide, et le filtre n'afficherait jamais rien. */
  function utilesAuRoster(entrees, objets){
    const personnages = new Set();
    (entrees || []).forEach(entree => {
      if(entree && entree.charId) personnages.add(entree.charId);
    });
    const typesManies = new Set();
    personnages.forEach(charId => {
      weaponTypesOf(charId).forEach(dossier => {
        const marque = FOLDER_TO_ENUM[dossier];
        if(marque) typesManies.add(marque);
      });
    });
    const utiles = new Set();
    (objets || []).forEach(objet => {
      if(!objet || !objet.file) return;
      if(objet.nature === "gravee"){
        if(objet.heros && personnages.has(objet.heros)) utiles.add(objet.file);
        return;
      }
      if(objet.type && typesManies.has(objet.type)) utiles.add(objet.file);
    });
    return utiles;
  }

  function progressionDe(objets, possessions){
    const liste = objets || [];
    const detenues = possessions || new Set();
    const possedes = liste.filter(objet => detenues.has(objet.file)).length;
    return {
      total:liste.length,
      possedes,
      manquants:liste.length - possedes
    };
  }

export { equipesDuRoster, possessionsDe, progressionDe, utilesAuRoster };
```

- [x] **Étape 4 : vérifier que le test passe**

Run : `node tests/collection.test.js`
Attendu : `PASS collection : possession, utilite au roster et progression`.

- [x] **Étape 5 : le balisage de l'onglet**

Dans `index.html` :

1. après le bouton `#tab-wiki`, ajouter le neuvième onglet :

```html
    <button class="tab" id="tab-collection" data-view="collection"
            role="tab" aria-controls="view-collection"
            aria-selected="false" tabindex="-1">Collection</button>
```

2. après `<section id="view-wiki">…</section>`, ajouter la vue :

```html
  <!-- ============ COLLECTION ============ -->
  <section id="view-collection" class="view" role="tabpanel"
           aria-labelledby="tab-collection">
    <p class="section-eyebrow">Chasse</p>
    <h1 class="section-title">Collection</h1>
    <p class="section-lead">Ce qu'il te reste à trouver, arme par arme et gravure par gravure.</p>
    <div class="collection-toolbar">
      <label class="wiki-field">
        <span>Membre</span>
        <select id="collectionOwner"></select>
      </label>
      <p class="collection-progress" id="collectionProgress"
         role="status" aria-live="polite"></p>
    </div>
    <div class="wiki-filters" id="collectionFilters">
      <label class="wiki-field">
        <span>Recherche</span>
        <input id="collectionSearch" type="search" placeholder="Nom d'un objet…"
               autocomplete="off">
      </label>
    </div>
    <p class="wiki-state" id="collectionState" role="status" aria-live="polite"></p>
    <div id="collectionBody"></div>
  </section>
```

3. lier la feuille en dernier, après `wiki.css` :

```html
<link rel="stylesheet" href="./css/collection.css">
```

Le sélecteur `#collectionOwner` est posé dès maintenant mais reste **masqué**
tant que la tâche 4 ne l'alimente pas : un contrôle vide qui ne fait rien est
une promesse non tenue. La vue lui met `hidden = true` à cette étape.

- [x] **Étape 6 : écrire la vue**

Créer `js/vues/collection.js`. Elle réemploie les listes du Wiki et construit
ses filtres comme `wiki.js` — dérivés des objets réellement listés, jamais
d'une liste écrite à la main.

```js
/* L'onglet Collection : ce qu'il reste a trouver.

   Il n'enumere aucun objet lui-meme : `armesDuWiki()` et `graveesDuWiki()`
   joignent deja les images aux statistiques par le chemin, et c'est ce meme
   chemin qui sert de cle a la collection.

   La possession se CALCULE a chaque rendu (metier/collection.js) : le marque
   vient du store, l'equipe se derive du roster. Deux verites tenues a jour
   separement finiraient par diverger. */

import { WEAPON_ENUM } from "../noyau/constantes.js";
import { $, el, norm } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { armesDuWiki, graveesDuWiki } from "../metier/wiki-equipement.js";
import {
  equipesDuRoster, possessionsDe, progressionDe, utilesAuRoster
} from "../metier/collection.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { sessionCourante } from "../etat/session.js";

  const POSSESSION = [
    { valeur:"manquants", libelle:"À trouver" },
    { valeur:"possedes",  libelle:"Possédés" },
    { valeur:"tout",      libelle:"Tout" }
  ];

  const etat = { possession:"manquants", famille:"", type:"", heros:"", utiles:"" };

  /* Marques persistes : vides tant que le store n'existe pas (tache 3). */
  let marques = new Set();

  const objetsDeLaCollection = () => armesDuWiki().concat(graveesDuWiki());

  function rosterAffiche(){
    const id = sessionCourante.user ? sessionCourante.user.id : "";
    return id ? MemberRosterStore.all(id) : [];
  }

  /* Les valeurs d'un filtre : celles que les objets portent REELLEMENT,
     triees par libelle. Aucune liste ecrite a la main. */
  function valeursPortees(objets, lire, nommer){
    const portees = new Set();
    (objets || []).forEach(objet => {
      const valeur = lire(objet);
      if(valeur) portees.add(valeur);
    });
    return [...portees]
      .map(valeur => ({ valeur, libelle:nommer(valeur) }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr-FR"));
  }

  function retenus(objets, possessions, utiles){
    const recherche = norm($("#collectionSearch").value.trim());
    return objets.filter(objet => {
      if(recherche && !norm(objet.nom).includes(recherche)) return false;
      const possede = possessions.has(objet.file);
      if(etat.possession === "manquants" && possede) return false;
      if(etat.possession === "possedes" && !possede) return false;
      if(etat.famille && objet.nature !== etat.famille) return false;
      if(etat.type && objet.type !== etat.type) return false;
      if(etat.heros && objet.heros !== etat.heros) return false;
      if(etat.utiles && !utiles.has(objet.file)) return false;
      return true;
    });
  }

  /* Une tuile. `equipe` la verrouille : l'objet est possede parce qu'il est
     porte, et se dire non possedant de ce qu'on equipe serait se contredire.
     Le titre nomme le personnage, sans quoi le cadenas serait une enigme. */
  function tuile(objet, possessions, equipements){
    const possede = possessions.has(objet.file);
    const equipe = equipements.has(objet.file);
    const bouton = el("button",{
      class:"wiki-tile"
        +(possede ? " collection-owned" : "")
        +(equipe ? " collection-locked" : ""),
      type:"button",
      title:equipe ? "Équipé — possédé d’office" : objet.nom,
      dataset:{ file:objet.file },
      disabled:equipe ? "" : null
    },[
      el("img",{ src:objet.file, alt:"", loading:"lazy" }),
      el("span",{ class:"wiki-tile-name", text:objet.nom })
    ]);
    if(equipe) bouton.disabled = true;
    return bouton;
  }

  function grille(titre, objets, possessions, equipements){
    if(!objets.length) return null;
    const zone = el("div",{},[
      el("h2",{ class:"collection-section-title", text:titre }),
      el("div",{ class:"wiki-grid" },
        objets.map(objet => tuile(objet, possessions, equipements)))
    ]);
    return zone;
  }

  function renderCollection(){
    const objets = objetsDeLaCollection();
    const roster = rosterAffiche();
    const equipements = equipesDuRoster(roster);
    const possessions = possessionsDe(marques, equipements);
    const utiles = utilesAuRoster(roster, objets);

    const compte = progressionDe(objets, possessions);
    $("#collectionProgress").innerHTML =
      "<b>"+compte.possedes+"</b> / "+compte.total+" possédés — "
      +compte.manquants+" à trouver";

    construireFiltres(objets);
    const liste = retenus(objets, possessions, utiles);
    const corps = $("#collectionBody");
    corps.innerHTML = "";
    [
      grille("Armes", liste.filter(objet => objet.nature === "arme"),
        possessions, equipements),
      grille("Armures gravées", liste.filter(objet => objet.nature === "gravee"),
        possessions, equipements)
    ].forEach(zone => { if(zone) corps.appendChild(zone); });
    $("#collectionState").textContent = liste.length
      ? ""
      : "Rien à afficher avec ces filtres.";
    return Promise.resolve(true);
  }

export { renderCollection };
```

`construireFiltres(objets)` remplit `#collectionFilters` sur le patron exact de
`construireFiltres` dans `js/vues/wiki.js` : elle retire les `[data-filtre]`
existants puis ajoute une liste déroulante par filtre. Les cinq filtres et
leurs valeurs :

| Filtre | Valeurs | Libellés |
|---|---|---|
| `possession` | les trois de `POSSESSION` | tels quels, `manquants` par défaut |
| `famille` | `arme`, `gravee` | « Armes », « Armures gravées » |
| `type` | `valeursPortees(objets, o => o.type, …)` | `WEAPON_ENUM[code].label \|\| code` |
| `heros` | `valeursPortees(objets, o => o.heros, …)` | `(charOf(slug) \|\| {}).name \|\| slug` |
| `utiles` | `oui` seulement | « Utile à mon roster » |

Chaque `change` écrit dans `etat` puis rappelle `renderCollection`.

**À cette étape, une tuile n'a aucun gestionnaire de clic** : le marquage
arrive en tâche 3. Les tuiles équipées sont déjà `disabled`.

- [x] **Étape 7 : écrire la feuille de style**

Créer `css/collection.css`. Elle ne redéfinit ni `.wiki-grid` ni `.wiki-tile`,
qu'elle réemploie, et n'ajoute que ce qui lui est propre :

```css
/* L'onglet Collection. Les grilles et les tuiles viennent de wiki.css : cette
   feuille n'ajoute que l'etat de possession et la barre de progression. */

.collection-toolbar{
  display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px
}
.collection-progress{
  margin:0;color:var(--muted);font-variant-numeric:tabular-nums
}
.collection-progress b{color:var(--gold-bright)}
.collection-section-title{
  margin:18px 0 10px;font-size:11.5px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--gold)
}
/* Un objet possede reste visible sous le filtre « Tout » : on l'estompe au
   lieu de le retirer, pour que la grille garde sa forme. */
.wiki-tile.collection-owned{opacity:.42}
.wiki-tile.collection-owned::after{
  content:"✓";position:absolute;top:6px;right:8px;
  color:var(--gold-bright);font-size:15px;font-weight:700
}
/* Equipe : possede et non decochable. Le cadenas dit pourquoi. */
.wiki-tile.collection-locked{cursor:default}
.wiki-tile.collection-locked::after{content:"🔒"}

@media (prefers-reduced-motion:reduce){
  .wiki-tile.collection-owned{transition:none}
}
```

⚠️ `.wiki-tile` doit être `position:relative` pour que le `::after` se place.
Le vérifier dans `css/wiki.css` et l'y ajouter si absent.

- [x] **Étape 8 : brancher la vue**

- `js/app.js` : `import { renderCollection } from "./vues/collection.js";` puis
  `enregistrerVue("collection", renderCollection);` après la ligne du wiki ;
- `tests/helpers/modules.js` : `"metier/collection.js"` après
  `"metier/wiki-equipement.js"`, et `"vues/collection.js"` après
  `"vues/wiki-fiche-objet.js"` ;
- `sw.js` : les deux modules et `"./css/collection.css"` dans `CORE_ASSETS` ;
- `tests/css-ordre.test.js` : `collection.css` en dernier de la liste ordonnée.

- [x] **Étape 9 : ajuster le test d'accessibilité**

Dans `tests/accessibilite-mobile.playwright.js`, remplacer le décompte de 8
onglets par 9, et la cible de la touche `Fin` : `tabs.nth(8)` et
`#view-collection`.

- [x] **Étape 10 : vérifier**

```bash
node tests/collection.test.js
node tests/modules-imports.test.js
node tests/css-ordre.test.js
node tests/pwa.test.js
node tests/accessibilite-mobile.playwright.js
```

Puis `npm test` complet.

- [x] **Étape 11 : commit**

```bash
git add -A
git commit -m "feat: onglet Collection, grilles filtrees et progression"
```

---

### Tâche 3 : la persistance et le geste

**Fichiers :**
- Créer : `js/donnees/collection-store.js`
- Modifier : `js/noyau/constantes.js`, `js/vues/collection.js`,
  `js/vues/synchro-temps-reel.js`, `sw.js`, `tests/helpers/modules.js`
- Créer : `tests/collection.playwright.js`
- Modifier : `package.json`

**Interfaces consommées :** `sessionCourante` (`js/etat/session.js`), `sb`
(`js/noyau/supabase-client.js`), `CLOUD_COLLECTION_CACHE_KEY`.

**Interfaces produites :**

```js
// js/donnees/collection-store.js
CollectionStore.all(ownerId)      // Set<string>, depuis le cache
CollectionStore.refresh(ownerId)  // Promise<Set<string>>, relit la table
CollectionStore.mark(item)        // Promise<void>, insert pour l'utilisateur courant
CollectionStore.unmark(item)      // Promise<void>, delete pour l'utilisateur courant
```

- [x] **Étape 1 : la clé de cache**

Dans `js/noyau/constantes.js`, à côté des deux autres :

```js
  const CLOUD_COLLECTION_CACHE_KEY = "confrerie7ds.cloud.collection";
```

et l'ajouter au bloc d'exports.

- [x] **Étape 2 : écrire le store**

Créer `js/donnees/collection-store.js`, sur le modèle de `roster-store.js` :

```js
/* La collection d'un membre : les chemins d'objets qu'il a marques.

   UNE LIGNE PAR OBJET dans Supabase : marquer est un insert, demarquer un
   delete. Aucune ecriture ne reecrit l'ensemble, donc deux appareils ouverts
   en meme temps ne peuvent pas s'effacer mutuellement.

   Le cache local sert a afficher vite et hors ligne. Il n'accorde JAMAIS un
   droit : la RLS reste seule juge de ce qu'un membre peut ecrire. */

import { CLOUD_COLLECTION_CACHE_KEY } from "../noyau/constantes.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";

  function lireCache(){
    try{
      const brut = JSON.parse(localStorage.getItem(CLOUD_COLLECTION_CACHE_KEY));
      return brut && typeof brut === "object" ? brut : {};
    }catch(erreur){
      return {};
    }
  }
  let cache = lireCache();

  function ecrireCache(){
    localStorage.setItem(CLOUD_COLLECTION_CACHE_KEY, JSON.stringify(cache));
  }

  function remplacerPour(ownerId, items){
    cache[ownerId] = [...new Set(items || [])];
    ecrireCache();
    return new Set(cache[ownerId]);
  }

  const CollectionStore = {
    all(ownerId){
      if(!ownerId) return new Set();
      return new Set(cache[ownerId] || []);
    },
    async refresh(ownerId){
      if(!ownerId) return new Set();
      if(!sessionCourante.user || !sb) return CollectionStore.all(ownerId);
      const { data, error } = await sb.from("collection_items")
        .select("item")
        .eq("owner", ownerId);
      if(error) throw error;
      return remplacerPour(ownerId, (data || []).map(ligne => ligne.item));
    },
    async mark(item){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const { error } = await sb.from("collection_items")
        .insert({ owner, item });
      /* 23505 : la ligne existe deja. Marquer deux fois n'est pas une erreur
         pour le membre — le resultat voulu est atteint. */
      if(error && error.code !== "23505") throw error;
      const suivant = CollectionStore.all(owner);
      suivant.add(item);
      remplacerPour(owner, [...suivant]);
    },
    async unmark(item){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const { error } = await sb.from("collection_items")
        .delete()
        .eq("owner", owner)
        .eq("item", item);
      if(error) throw error;
      const suivant = CollectionStore.all(owner);
      suivant.delete(item);
      remplacerPour(owner, [...suivant]);
    }
  };

export { CollectionStore };
```

- [x] **Étape 3 : le geste dans la vue**

Dans `js/vues/collection.js` :

- importer `CollectionStore` ;
- au rendu, `marques = CollectionStore.all(ownerId)` puis, sans bloquer
  l'affichage, `CollectionStore.refresh(ownerId).then(…)` qui re-rend ;
- une tuile **non verrouillée** de sa propre collection reçoit un `onclick` :

```js
  async function basculer(objet, estPossede){
    try{
      if(estPossede) await CollectionStore.unmark(objet.file);
      else await CollectionStore.mark(objet.file);
      toast(objet.nom + (estPossede ? " remis à trouver" : " marqué comme possédé"));
      renderCollection();
    }catch(erreur){
      toast("Impossible d’enregistrer. Vérifie ta connexion.", true);
    }
  }
```

⚠️ Le rendu ne se fait **qu'après** la réponse de Supabase. Retirer la tuile
avant confirmation ferait disparaître un objet qu'une erreur réseau laisserait
non marqué, et le membre le croirait acquis.

- [x] **Étape 4 : le temps réel**

Dans `js/vues/synchro-temps-reel.js`, ajouter `"collection_items"` au tableau
`tables`, et re-rendre la vue Collection dans le même aiguillage que les autres
tables.

- [x] **Étape 5 : déclarer le module**

`tests/helpers/modules.js` : `"donnees/collection-store.js"` dans la couche
`donnees`. `sw.js` : dans `CORE_ASSETS`.

- [x] **Étape 6 : écrire le parcours Playwright**

Créer `tests/collection.playwright.js`, en réutilisant le faux Supabase de
`tests/supabase-etape1.playwright.js` : y ajouter `collection_items:[]` à
`window.__fakeSupabaseState`. Le test vérifie :

- l'onglet s'ouvre sur les manquants et le décompte est cohérent ;
- un clic sur une tuile la fait disparaître et incrémente le décompte ;
- le filtre « Possédés » la retrouve, et un second clic la remet à trouver ;
- un objet équipé dans un build apparaît possédé, porte `collection-locked` et
  ne réagit pas au clic ;
- le filtre « utile à ce roster » restreint la grille.

- [x] **Étape 7 : vérifier**

`npm test` complet. Le test doit **échouer** si l'on retire le `onclick` :
le vérifier une fois à la main avant de commiter.

- [x] **Étape 8 : commit**

```bash
git add -A
git commit -m "feat: marquer et demarquer un objet de sa collection"
```

---

### Tâche 4 : consulter la collection d'un autre membre

**Fichiers :** `js/vues/collection.js`, `tests/collection.playwright.js`

**Interfaces consommées :** `sessionCourante.rosterProfiles`,
`refreshRosterProfiles()` (`js/donnees/roster-profils.js`),
`MemberRosterStore.refresh(ownerId)`.

- [x] **Étape 1 : alimenter le sélecteur**

Remplir `#collectionOwner` avec « Ma collection » puis les autres profils,
sur le modèle de `renderMemberRosterControls`. Le retirer de `hidden`.

- [x] **Étape 2 : lire la collection et le roster du membre choisi**

`CollectionStore.refresh(ownerId)` et `MemberRosterStore.refresh(ownerId)`
prennent tous deux l'identifiant affiché. Le filtre d'utilité et les objets
verrouillés se rapportent donc au **membre affiché**, pas à celui qui regarde.

- [x] **Étape 3 : lecture seule sur autrui**

Quand `ownerId !== sessionCourante.user.id`, aucune tuile ne reçoit de
`onclick` et le libellé du filtre d'utilité devient
`Utile au roster de <pseudo>`.

- [x] **Étape 4 : étendre le test**

Ajouter à `tests/collection.playwright.js` : choisir un autre membre affiche sa
collection, le décompte change, et un clic sur une tuile ne modifie rien.

- [x] **Étape 5 : vérifier et commit**

```bash
npm test
git add -A
git commit -m "feat: consulter la collection d'un autre membre"
```

---

### Tâche 5 : la documentation

**Fichiers :** `AGENTS.md`

- [x] **Étape 1 : décrire le domaine**

Ajouter une section « Collection » : la table à une ligne par objet et pourquoi
elle n'est pas un tableau ; la règle de possession (marqué **ou** équipé) et le
fait que l'équipé se dérive au lieu de se stocker ; le piège des deux
vocabulaires d'arme (`weaponTypesOf` rend un dossier, les objets un enum,
`FOLDER_TO_ENUM` fait le pont) ; l'absence de politique `update`.

- [x] **Étape 2 : vérifier et commit**

```bash
npm test
git add AGENTS.md
git commit -m "docs: decrire le domaine Collection"
```

---

## Relecture du plan

**Couverture de la spec.** Table et RLS → tâche 1. Règle de possession et
utilité au roster → tâche 2 (métier) et 3 (persistance). Onglet, filtres,
décompte → tâche 2. Geste de marquage, toast, temps réel → tâche 3. Sélecteur
de membre et lecture seule → tâche 4. `AGENTS.md` → tâche 5. Les trois tests
annoncés par la spec existent : `collection-schema`, `collection`,
`collection.playwright`.

**Cohérence des noms.** `equipesDuRoster`, `possessionsDe`, `utilesAuRoster` et
`progressionDe` sont définis en tâche 2 et employés sous ces mêmes noms en
tâches 2 à 4. `CollectionStore.all/refresh/mark/unmark` est défini en tâche 3
et consommé aux tâches 3 et 4. La spec, écrite avant, parlait de `possedes()`
et `estVerrouille()` ; **elle a été corrigée pour concorder** — le premier est
devenu `possessionsDe` pour ne pas heurter la règle d'unicité des noms de
premier niveau, le second a disparu : savoir qu'un objet est verrouillé, c'est
tester son appartenance à l'ensemble des équipés, et une fonction d'une ligne
n'ajoutait qu'un nom à retenir.

**Un nom à surveiller à l'exécution.** `valeursPortees`, `construireFiltres`,
`retenus`, `tuile` et `grille` existent déjà dans `js/vues/wiki.js`. Le
chargeur `vm` concatène les deux fichiers dans une même portée : **il faudra
les renommer** dans `collection.js` — `valeursDeCollection`,
`filtresDeCollection`, `retenusDeCollection`, `tuileDeCollection`,
`grilleDeCollection` — sous peine d'une `SyntaxError` dans un test sans rapport.
Le code montré plus haut garde les noms courts pour rester lisible ; les
renommer est la première chose à faire en le recopiant.

**Pièges déjà rencontrés dans ce dépôt, rappelés là où ils mordent.** L'export
orphelin impose de livrer module et consommateur ensemble (tâche 2). Les noms
de premier niveau doivent être uniques dans tout `js/`. Le neuvième onglet
oblige à toucher `accessibilite-mobile` (tâche 2, étape 9).
