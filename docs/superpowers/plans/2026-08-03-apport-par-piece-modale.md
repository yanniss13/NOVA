# Modale par pièce — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le résumé en ligne illisible par une modale dédiée à chaque pièce, avec navigation `‹ ›` entre les pièces du héros.

**Architecture:** Un module `js/vues/detail-piece.js` possède l'overlay, l'état de navigation et le rendu, sur le modèle de `detail-roster.js`. `fiche-heros.js` ne fait que câbler le clic. L'ordre du parcours est établi par une fonction pure de la couche métier, testable sans navigateur.

**Tech Stack:** JavaScript modules ES, aucune dépendance. Tests Node avec `node:assert` et le chargeur `vm` de `tests/helpers/load-app.js`. Tests navigateur avec Playwright.

**Conception de référence :** `docs/superpowers/specs/2026-08-03-apport-par-piece-modale-design.md`

## Global Constraints

- **Aucun changement du schéma Supabase.** Aucune migration.
- **Aucune dépendance npm nouvelle.**
- **Un module neuf s'enregistre à TROIS endroits** : `tests/helpers/modules.js` (ordre des couches), `sw.js` (`CORE_ASSETS`), et l'`import` de son consommateur. En oublier un casse respectivement `modules-imports.test.js`, le hors-ligne, et le chargement.
- **Ordre des couches** : `vues/detail-piece.js` s'insère en position 13, entre `vues/dispos.js` et `vues/fiche-heros.js`. Il ne peut dépendre que de modules situés plus haut dans la liste.
- **`modules-imports.test.js` refuse tout export que personne n'importe.** Ce garde-fou a déjà mordu deux fois pendant l'implémentation précédente.
- **Libellés en français** avec accents ; **messages de commit sans accents**.
- La couche métier reste **pure** : ni DOM, ni réseau.

---

## File Structure

| Fichier | Rôle | Nature |
|---|---|---|
| `js/metier/stats-calcul.js` | `orderedBuildEntries` ; retrait de `summaryTermsFor` | Modifier |
| `js/vues/detail-piece.js` | l'overlay, la navigation, le rendu d'une pièce | **Créer** |
| `js/vues/fiche-heros.js` | la ligne devient un bouton ; retrait du résumé en ligne | Modifier |
| `index.html` | le balisage de l'overlay | Modifier |
| `css/modales.css` | styles de la ligne cliquable ; retrait de `.eq-contribution` | Modifier |
| `tests/helpers/modules.js` | enregistrer le module en position 13 | Modifier |
| `sw.js` | ajouter le module aux `CORE_ASSETS` | Modifier |
| `tests/apport-par-piece.test.js` | tests de `orderedBuildEntries` ; retrait de ceux de `summaryTermsFor` | Modifier |
| `tests/apport-par-piece.playwright.js` | réécrit pour la modale | Modifier |

---

## Task 1 : l'ordre du parcours, et le retrait de `summaryTermsFor`

**Files:**
- Modify: `js/metier/stats-calcul.js`
- Modify: `tests/helpers/load-app.js`
- Test: `tests/apport-par-piece.test.js`

**Interfaces:**
- Consumes: `groupBuildTermsBySlot(build)` et le champ `role`, tous deux déjà en place.
- Produces:

```
orderedBuildEntries(build) → [{ slot, domain, file, status, terms, totals }]
```

Les mêmes entrées que `groupBuildTermsBySlot`, triées : celles qui ont au moins un terme d'abord, les autres ensuite ; dans chaque groupe, l'ordre naturel arme → armures → bijoux → ensemble. **C'est le seul point d'entrée exporté** ; `groupBuildTermsBySlot` redevient privée.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `tests/apport-par-piece.test.js`, ajouter avant les appels finaux :

```js
function testOrdreConfigureesDAbord(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  build.armorConfig.Bas = null;

  const entrees = plain(hooks.orderedBuildEntries(build));
  const slots = entrees.map(entree => entree.slot);
  const iHaut = slots.indexOf("Haut");
  const iBas = slots.indexOf("Bas");

  assert.ok(iHaut >= 0 && iBas >= 0, "les deux pieces sont dans le parcours");
  assert.ok(
    iHaut < iBas,
    "la piece configuree passe avant la non configuree, recu : " + slots.join(", ")
  );
}

function testOrdreNaturelDansUnGroupe(){
  const { hooks } = loadApp();
  const entrees = plain(hooks.orderedBuildEntries(buildDeuxPieces()));
  const slots = entrees.map(entree => entree.slot);
  assert.ok(
    slots.indexOf("Haut") < slots.indexOf("Bas"),
    "a statut egal, l'ordre naturel des emplacements est conserve"
  );
}

function testOrdreContientLesMemesEntrees(){
  const { hooks } = loadApp();
  const build = buildDeuxPieces();
  const brut = plain(hooks.groupBuildTermsBySlot(build)).map(e => e.slot).sort();
  const trie = plain(hooks.orderedBuildEntries(build)).map(e => e.slot).sort();
  assert.deepStrictEqual(
    trie,
    brut,
    "le tri ne perd ni n'invente aucune entree"
  );
}
```

Et remplacer les trois appels de `summaryTermsFor` par les nouveaux :

```js
testRolesEquipement();
testRolesArme();
testRolesBonusEnsemble();
testInvariantDeSomme();
testToleranceAuxPiecesNonConfigurees();
testBonusEnsembleNonAttribue();
testOrdreConfigureesDAbord();
testOrdreNaturelDansUnGroupe();
testOrdreContientLesMemesEntrees();
console.log("PASS apport par piece : roles, regroupement, invariant et ordre");
```

- [ ] **Step 2: Supprimer les trois tests de `summaryTermsFor`**

Retirer de `tests/apport-par-piece.test.js` les fonctions `testClassementSuitLesRoles`, `testResumeNeCompletePas` et `testResumeVidePourPieceNonConfiguree` — leur sujet disparaît.

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

```bash
node tests/apport-par-piece.test.js
```

Attendu : ÉCHEC — `hooks.orderedBuildEntries is not a function`.

- [ ] **Step 4: Écrire la fonction**

Dans `js/metier/stats-calcul.js`, juste après `groupBuildTermsBySlot` :

```js
  /* L'ordre dans lequel la modale fait defiler les pieces.

     Les pieces configurees d'abord : trois heros sur quatre n'ont rien de
     configure, et enchainer neuf modales vides serait penible. Les non
     configurees restent atteignables, mais apres.

     Le tri vit ici plutot que dans la vue pour rester pur et testable sans
     navigateur — et parce que c'est lui qui donne son sens a la position
     affichee (« 2 / 9 »). */
  const ENTRY_NATURAL_ORDER = ["weapon"]
    .concat(ARMOR_SLOTS, JEWEL_SLOTS, ["set"]);

  function orderedBuildEntries(build){
    const entries = groupBuildTermsBySlot(build);
    const rank = slot => {
      const index = ENTRY_NATURAL_ORDER.indexOf(slot);
      return index < 0 ? ENTRY_NATURAL_ORDER.length : index;
    };
    return entries.slice().sort((a, b) => {
      const aVide = a.terms.length === 0;
      const bVide = b.terms.length === 0;
      if(aVide !== bVide) return aVide ? 1 : -1;
      return rank(a.slot) - rank(b.slot);
    });
  }
```

- [ ] **Step 5: Retirer `summaryTermsFor` et sa constante**

Supprimer de `js/metier/stats-calcul.js` le bloc `SUMMARY_ROLE_ORDER` et la fonction `summaryTermsFor` en entier, commentaire compris.

- [ ] **Step 6: Ajuster les exports**

Le bloc `export` devient :

```js
export {
  calculateGearStats,
  calculateHeroStats,
  calculateWeaponStats,
  gearDomainOf,
  groupBuildStatResults,
  orderedBuildEntries
};
```

`groupBuildTermsBySlot` et `summaryTermsFor` en sortent. La première reste une fonction privée du module ; la seconde est supprimée.

- [ ] **Step 7: Ajuster le chargeur de test**

Dans `tests/helpers/load-app.js`, retirer le bloc `summaryTermsFor:` et ajouter à côté de `groupBuildTermsBySlot:` :

```js
  orderedBuildEntries:typeof orderedBuildEntries === "function"
    ? orderedBuildEntries
    : undefined,
```

Garder l'exposition de `groupBuildTermsBySlot` : ses tests existants en dépendent, et `loadApp` atteint aussi les fonctions privées.

- [ ] **Step 8: Lancer le test**

```bash
node tests/apport-par-piece.test.js
```

Attendu : `PASS apport par piece : roles, regroupement, invariant et ordre`

- [ ] **Step 9: Commit**

Le reste du dépôt ne compile plus à cette étape — `fiche-heros.js` importe encore `summaryTermsFor`. C'est attendu : la tâche 3 le corrige. Ne pas lancer `npm run test:unit` ici.

```bash
git add js/metier/stats-calcul.js tests/helpers/load-app.js tests/apport-par-piece.test.js
git commit -m "feat: ordonner les pieces pour le parcours de la modale

Les pieces configurees d'abord : trois heros sur quatre n'ont rien de
configure, et enchainer neuf modales vides serait penible.

summaryTermsFor disparait avec ses tests : la ligne ne portera plus de
resume, donc plus personne ne l'appelle, et le depot refuse les exports
orphelins. Elle reste dans l'historique en 22f5e29."
```

---

## Task 2 : le module de la modale et son balisage

**Files:**
- Create: `js/vues/detail-piece.js`
- Modify: `index.html` (après le bloc `#rosterDetailOverlay`, ligne ~362)
- Modify: `tests/helpers/modules.js` (position 13)
- Modify: `sw.js` (`CORE_ASSETS`)
- Modify: `css/modales.css`

**Interfaces:**
- Consumes: `orderedBuildEntries` (tâche 1).
- Produces:

```
openPieceDetail(entries, index, restoreFocus)
```

`entries` vient de `orderedBuildEntries`, `index` est l'entrée à afficher, `restoreFocus` le bouton qui a déclenché l'ouverture. La tâche 3 l'appelle.

- [ ] **Step 1: Ajouter le balisage**

Dans `index.html`, juste après la fermeture de `#rosterDetailOverlay` (ligne ~362) :

```html
<!-- Apport d'une piece d'equipement -->
<div class="overlay" id="pieceDetailOverlay" role="dialog" aria-modal="true"
     aria-labelledby="pieceDetailTitle" aria-hidden="true">
  <div class="modal rostermodal">
    <div class="picker-head">
      <span class="picker-title" id="pieceDetailTitle">Pièce</span>
      <button class="icon-btn" id="pieceDetailClose" aria-label="Fermer">✕</button>
    </div>
    <div class="roster-detail-nav">
      <button class="icon-btn" id="pieceDetailPrev" type="button"
              aria-label="Pièce précédente">‹</button>
      <span class="roster-detail-position" id="pieceDetailPosition"
            aria-live="polite"></span>
      <button class="icon-btn" id="pieceDetailNext" type="button"
              aria-label="Pièce suivante">›</button>
    </div>
    <div class="roster-detail-body" id="pieceDetailBody"></div>
  </div>
</div>
```

Les classes `modal rostermodal`, `picker-head`, `roster-detail-nav`, `roster-detail-position` et `roster-detail-body` sont reprises telles quelles : elles sont déjà stylées et éprouvées par la modale de roster.

- [ ] **Step 2: Écrire le module**

Créer `js/vues/detail-piece.js` :

```js
/* L'apport d'une piece d'equipement, dans sa propre modale.

   Elle s'ouvre PAR-DESSUS la modale d'equipe ou de roster : ModalStack pose
   son verrou de defilement a la premiere ouverture et ne le leve qu'a la
   derniere, donc l'empilement est deja gere.

   Le rendu passe par la chaine d'affichage des editeurs — le membre y
   retrouve une presentation qu'il connait — et le module n'invente aucun
   balisage de statistique.

   L'ordre du parcours vient de metier/stats-calcul.js : il est pur, teste,
   et c'est lui qui donne son sens a la position affichee. */

import { $, el } from "../noyau/dom.js";
import { nameOfFile } from "../metier/catalogue.js";
import { groupBuildStatResults } from "../metier/stats-calcul.js";
import { ModalStack } from "./modal-stack.js";
import {
  formatBuildStatValue,
  gearTermLabel,
  statTermsDetails
} from "./stats-affichage.js";

  const pieceDetail = { entries:[], index:0 };

  function titleOf(entry){
    if(!entry) return "Pièce";
    if(entry.slot === "set") return "Bonus d’ensemble";
    return entry.file ? nameOfFile(entry.file) : entry.slot;
  }

  function renderPieceDetail(){
    const entry = pieceDetail.entries[pieceDetail.index];
    const body = $("#pieceDetailBody");
    body.innerHTML = "";
    $("#pieceDetailTitle").textContent = titleOf(entry);
    $("#pieceDetailPosition").textContent =
      (pieceDetail.index + 1) + " / " + pieceDetail.entries.length;

    /* Le navigateur retire le focus d'un bouton des qu'il devient
       `disabled` : on note qui l'avait AVANT de desactiver, puis on le rend
       au controle encore utilisable plutot que de le perdre sur le body. */
    const prev = $("#pieceDetailPrev");
    const next = $("#pieceDetailNext");
    const active = document.activeElement;
    prev.disabled = pieceDetail.index <= 0;
    next.disabled = pieceDetail.index >= pieceDetail.entries.length - 1;
    if((active === prev || active === next) && active.disabled){
      const fallback = active === prev ? next : prev;
      (fallback.disabled ? $("#pieceDetailClose") : fallback).focus();
    }

    if(!entry || !entry.terms.length){
      body.appendChild(el("p",{
        class:"weapon-stats-state",
        text:"Cette pièce n’est pas encore configurée."
      }));
      return;
    }
    groupBuildStatResults(entry).forEach(group => {
      group.stats.forEach(stat => {
        const node = el("div",{class:"weapon-stat"});
        node.appendChild(el("div",{class:"weapon-stat-head"},[
          el("span",{text:stat.label}),
          el("span",{
            class:"weapon-stat-total",
            dataset:{unit:stat.unit},
            text:formatBuildStatValue(stat.value, stat.unit)
          })
        ]));
        node.appendChild(statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit),
          termProvenance:term => term.source.component
        }));
        body.appendChild(node);
      });
    });
  }

  function movePieceDetail(step){
    const next = pieceDetail.index + step;
    if(next < 0 || next >= pieceDetail.entries.length) return;
    pieceDetail.index = next;
    renderPieceDetail();
  }

  function closePieceDetail(){
    ModalStack.close($("#pieceDetailOverlay"));
  }

  function openPieceDetail(entries, index, restoreFocus){
    if(!Array.isArray(entries) || !entries.length) return;
    pieceDetail.entries = entries;
    pieceDetail.index = Math.max(0, Math.min(index, entries.length - 1));
    renderPieceDetail();
    ModalStack.open(
      $("#pieceDetailOverlay"),
      "#pieceDetailClose",
      closePieceDetail,
      restoreFocus
    );
  }

  $("#pieceDetailPrev").addEventListener("click", ()=>movePieceDetail(-1));
  $("#pieceDetailNext").addEventListener("click", ()=>movePieceDetail(1));
  $("#pieceDetailClose").addEventListener("click", closePieceDetail);
  $("#pieceDetailOverlay").addEventListener("click", event => {
    if(event.target === $("#pieceDetailOverlay")) closePieceDetail();
  });

export { openPieceDetail };
```

- [ ] **Step 3: Enregistrer le module dans l'ordre des couches**

Dans `tests/helpers/modules.js`, insérer entre `"vues/dispos.js"` et `"vues/fiche-heros.js"` :

```js
  "vues/detail-piece.js",
```

L'ordre compte : `fiche-heros.js` l'importera, donc il doit venir avant.

- [ ] **Step 4: Enregistrer le module dans le service worker**

Dans `sw.js`, dans `CORE_ASSETS`, ajouter `"./js/vues/detail-piece.js",` juste avant `"./js/vues/fiche-heros.js"`. Sans ça, la modale ne fonctionne pas hors ligne.

- [ ] **Step 5: Ajouter les styles de la ligne cliquable**

Dans `css/modales.css`, **remplacer** le bloc `.eq-contribution` ajouté précédemment (repérable par le commentaire « L'apport d'une pièce, sous son nom ») par :

```css
/* La ligne d'une piece devient un bouton : elle ouvre l'apport de la piece.
   Un vrai <button> plutot qu'un div cliquable, pour etre atteignable au
   clavier sans tabindex artificiel et annoncable par un lecteur d'ecran. */
.eq-line[type="button"]{
  width:100%;background:none;border:0;text-align:left;
  font:inherit;color:inherit;cursor:pointer
}
.eq-line[type="button"]:hover,
.eq-line[type="button"]:focus-visible{background:rgba(255,255,255,.05)}
.eq-chevron{margin-left:auto;color:var(--gold);flex:none}
@media(pointer:coarse){
  .eq-line[type="button"]{min-height:44px}
}
```

- [ ] **Step 6: Vérifier les gardes structurels**

```bash
node tests/css-ordre.test.js && node tests/serve.test.js
```

Attendu : les deux PASS. `modules-imports.test.js` échouera encore — `detail-piece.js` n'a pas d'importateur avant la tâche 3.

- [ ] **Step 7: Commit**

```bash
git add js/vues/detail-piece.js index.html tests/helpers/modules.js sw.js css/modales.css
git commit -m "feat: une modale dediee a l'apport d'une piece

Le module possede son overlay, son etat de navigation et son rendu, sur le
modele de detail-roster.js. Il s'ouvre par-dessus la modale d'equipe :
ModalStack gere deja l'empilement et le verrou de defilement.

La navigation reprend le motif du roster, y compris le repli de focus
quand un bouton devient desactive — sans lui, un membre au clavier perd sa
place aux bornes du parcours."
```

---

## Task 3 : la ligne cliquable

**Files:**
- Modify: `js/vues/fiche-heros.js`

**Interfaces:**
- Consumes: `openPieceDetail(entries, index, restoreFocus)` (tâche 2), `orderedBuildEntries(build)` (tâche 1).
- Produces: rien pour la suite.

- [ ] **Step 1: Corriger les imports**

Remplacer le bloc d'import de `stats-calcul.js` et celui de `stats-affichage.js` par :

```js
import { orderedBuildEntries } from "../metier/stats-calcul.js";
```

et **supprimer entièrement** l'import de `./stats-affichage.js` : plus rien ne s'en sert dans ce fichier. Ajouter :

```js
import { openPieceDetail } from "./detail-piece.js";
```

- [ ] **Step 2: Supprimer le rendu en ligne**

Supprimer de `js/vues/fiche-heros.js` les fonctions `shortStatLabel`, `contributionText` et `equipContribution` en entier, commentaires compris.

- [ ] **Step 3: Réécrire `equipLine`**

```js
  /* La ligne d'une piece. `onOpen` presente, elle devient un bouton qui
     ouvre l'apport de la piece ; absente, elle reste un simple div — un
     emplacement vide n'a rien a montrer. */
  function equipLine(file, slotLabel, variant, onOpen){
    const thumb = el("div",{class:"eq-thumb"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file) thumb.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')";
    const txt = el("div",{class:"eq-txt"},[
      el("span",{class:"eq-slot", text:slotLabel}),
      el("span",{class:"eq-name", text: file ? nameOfFile(file) : "—"})
    ]);
    if(!file || !onOpen){
      return el("div",{class:"eq-line"+(file?"":" empty"), title: file ? nameOfFile(file) : ""},[
        thumb,
        txt
      ]);
    }
    const line = el("button",{
      class:"eq-line",
      type:"button",
      title:nameOfFile(file),
      "aria-label":"Voir l’apport — "+nameOfFile(file)
    },[
      thumb,
      txt,
      el("span",{class:"eq-chevron", "aria-hidden":"true", text:"›"})
    ]);
    line.addEventListener("click", ()=>onOpen(line));
    return line;
  }
```

- [ ] **Step 4: Câbler les appels**

Remplacer le bloc `gear` de `heroDetail` par :

```js
    /* Une seule passe de calcul pour tout le heros, et un seul ordre de
       parcours : la position affichee dans la modale doit correspondre a
       ce que le membre voit ici. */
    const entries = orderedBuildEntries(h);
    const indexOfSlot = slot => entries.findIndex(item => item.slot === slot);
    const opener = slot => {
      const index = indexOfSlot(slot);
      if(index < 0) return null;
      return trigger => openPieceDetail(entries, index, trigger);
    };

    const gear = el("div",{class:"hd-gear"});
    gear.appendChild(el("div",{class:"hd-group-t", text:"Arme"}));
    gear.appendChild(equipLine(h.weapon, "Arme", "weapon", opener("weapon")));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Armures"}));
    ARMOR_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.armor ? h.armor[s] : null, ARMOR_LABELS[s], "", opener(s))
    ));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Bijoux"}));
    JEWEL_SLOTS.forEach(s=>gear.appendChild(
      equipLine(h.jewel ? h.jewel[s] : null, JEWEL_LABELS[s], "jewel", opener(s))
    ));
    /* Le bonus d'ensemble n'est pas une piece : il n'a ni vignette ni
       emplacement, mais il a un apport, donc il a sa ligne et sa place dans
       le parcours. */
    const setIndex = indexOfSlot("set");
    if(setIndex >= 0 && entries[setIndex].terms.length){
      const bonus = el("button",{
        class:"eq-line eq-set-line",
        type:"button",
        "aria-label":"Voir l’apport — bonus d’ensemble"
      },[
        el("div",{class:"eq-txt"},[
          el("span",{class:"eq-name", text:"Bonus d’ensemble"})
        ]),
        el("span",{class:"eq-chevron", "aria-hidden":"true", text:"›"})
      ]);
      bonus.addEventListener("click", ()=>openPieceDetail(entries, setIndex, bonus));
      gear.appendChild(bonus);
    }
    col.appendChild(gear);
```

- [ ] **Step 5: Lancer la suite unitaire**

```bash
npm run test:unit
```

Attendu : tout au vert, y compris `modules-imports.test.js` — `detail-piece.js` a maintenant son importateur, et plus aucun export n'est orphelin.

- [ ] **Step 6: Vérifier à l'œil dans un navigateur**

```bash
python -m http.server 8200 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8200` **sur un port jamais utilisé auparavant** : un service worker enregistré par une version antérieure sert les fichiers applicatifs depuis son cache (`sw.js:157`, `cacheFirst`) et masquerait entièrement le changement. C'est ce piège qui a fait croire à une fonctionnalité absente lors de la revue précédente.

- [ ] **Step 7: Commit**

```bash
git add js/vues/fiche-heros.js
git commit -m "feat: ouvrir l'apport d'une piece depuis sa ligne

La ligne ne porte plus que le nom et un chevron : le resume de trois
apports etait systematiquement tronque par les libelles du catalogue, et
la mention « A configurer » saturait l'ecran a neuf par heros.

La ligne devient un vrai bouton plutot qu'un div cliquable : atteignable
au clavier sans tabindex artificiel, et annoncable par un lecteur
d'ecran."
```

---

## Task 4 : le test de bout en bout

**Files:**
- Modify: `tests/apport-par-piece.playwright.js` (réécriture complète)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien — c'est la dernière tâche.

- [ ] **Step 1: Réécrire le test**

Remplacer entièrement le contenu de `tests/apport-par-piece.playwright.js` :

```js
"use strict";

/* L'apport d'une piece, verifie dans un vrai navigateur.

   Conception : docs/superpowers/specs/2026-08-03-apport-par-piece-modale-design.md

   L'equipe est amorcee dans localStorage plutot que construite au clic : le
   parcours d'equipement est deja couvert par potentiel-commun.playwright.js.

   Le heros porte une piece configuree ET une piece non configuree : c'est ce
   qui permet de verifier l'ordre du parcours. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

const STORAGE_KEY = "confrerie7ds.teams";
const HAUT = "7ds-armures-ssr/Haut/Haut de l'araignée de l'ombre.webp";
const BAS = "7ds-armures-ssr/Bas/Bas de l'araignée de l'ombre.webp";

const CONFIG = { version:1, level:120, reinforce:0, enchantments:[], passiveLevel:null };

const EQUIPE = {
  id:"apport-1",
  name:"Apport",
  pseudo:"Apport",
  heroes:[{
    char:"diane",
    weapon:null,
    armor:{ Haut:HAUT, Bas:BAS },
    armorConfig:{ Haut:CONFIG },
    jewel:{},
    jewelConfig:{},
    potentiel:{ tier:0 }
  }]
};

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");
    await page.evaluate(([key, data]) => {
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, [EQUIPE]]);
    await page.reload();

    await page.locator('[data-view="roster"]').click();
    await page.getByRole("button", { name:/Voir l.équipement/ }).first().click();

    /* La ligne d'une piece equipee est un bouton, et elle ouvre la modale. */
    const ligne = page.locator("button.eq-line").first();
    await ligne.waitFor({ state:"visible" });
    await ligne.click();

    const overlay = page.locator("#pieceDetailOverlay");
    await overlay.waitFor({ state:"visible" });
    assert.equal(
      await overlay.evaluate(node => node.classList.contains("on")),
      true,
      "un clic sur la ligne ouvre la modale de la piece"
    );

    /* Le titre nomme la piece, et la piece configuree vient en premier. */
    assert.equal(
      (await page.locator("#pieceDetailTitle").textContent()).trim(),
      "Haut de l'araignée de l'ombre",
      "la modale est titree du nom de la piece, configuree d'abord"
    );
    assert.equal(
      (await page.locator("#pieceDetailPosition").textContent()).trim(),
      "1 / 2",
      "la position reflete le parcours"
    );

    /* Aux bornes, les fleches sont desactivees. */
    assert.equal(
      await page.locator("#pieceDetailPrev").isDisabled(),
      true,
      "la fleche precedente est desactivee sur la premiere entree"
    );

    /* La navigation passe a la piece suivante sans refermer la modale. */
    await page.locator("#pieceDetailNext").click();
    assert.equal(
      (await page.locator("#pieceDetailPosition").textContent()).trim(),
      "2 / 2",
      "la fleche suivante avance dans le parcours"
    );
    assert.equal(
      (await page.locator("#pieceDetailTitle").textContent()).trim(),
      "Bas de l'araignée de l'ombre",
      "le titre suit la navigation"
    );
    assert.equal(
      await page.locator("#pieceDetailNext").isDisabled(),
      true,
      "la fleche suivante est desactivee sur la derniere entree"
    );

    /* Une piece non configuree annonce son etat, sans statistique. */
    assert.match(
      await page.locator("#pieceDetailBody").textContent(),
      /pas encore configurée/,
      "une piece non configuree affiche son message"
    );
    assert.equal(
      await page.locator("#pieceDetailBody .weapon-stat").count(),
      0,
      "une piece non configuree n'affiche aucune statistique"
    );

    /* Echap ferme la modale de piece SANS fermer la modale d'equipe qui la
       porte : ModalStack ne leve son verrou de defilement qu'a la derniere
       fermeture, une regression ici casserait le defilement de la page. */
    await page.keyboard.press("Escape");
    assert.equal(
      await overlay.evaluate(node => node.classList.contains("on")),
      false,
      "Echap ferme la modale de la piece"
    );
    assert.equal(
      await page.locator("#teamOverlay").evaluate(node => node.classList.contains("on")),
      true,
      "la modale d'equipe reste ouverte dessous"
    );

    /* Le focus revient sur la ligne d'origine. */
    assert.equal(
      await page.evaluate(() =>
        document.activeElement && document.activeElement.classList.contains("eq-line")
      ),
      true,
      "le focus revient sur la ligne qui a ouvert la modale"
    );

    assert.deepEqual(errors, [], "aucune erreur de page pendant le scenario");
    console.log("PASS Playwright: apport par piece");
  }finally{
    await browser.close();
    await server.close();
  }
})();
```

- [ ] **Step 2: Lancer le test**

```bash
node tests/apport-par-piece.playwright.js
```

Attendu : PASS. En cas d'échec sur un sélecteur, servir le dépôt sur un port neuf et comparer le DOM réel — ne pas relâcher l'assertion pour la faire passer.

- [ ] **Step 3: Lancer la suite complète**

```bash
npm test
```

Attendu : tout au vert. `supabase-etape1` et `accessibilite-mobile` sont connus pour échouer par intermittence — les relancer une fois avant de conclure à une régression.

- [ ] **Step 4: Commit**

```bash
git add tests/apport-par-piece.playwright.js
git commit -m "test: verifier la modale par piece et sa navigation

Le clic ouvre la modale, les fleches avancent dans le parcours et se
desactivent aux bornes, une piece non configuree annonce son etat.

Deux assertions protegent l'empilement : Echap ferme la modale de piece
sans fermer la modale d'equipe, et le focus revient sur la ligne d'origine.
ModalStack ne leve son verrou de defilement qu'a la derniere fermeture —
une regression y casserait le defilement de toute la page."
```

---

## Ce qui n'est PAS dans ce plan

- **Aucun lien vers l'éditeur** depuis la modale de pièce. Les deux modales appelantes sont des vues de consultation, affichant le plus souvent le build d'un autre membre, et `openGearConfigEditor` exige un rappel `commit` qui n'y existe pas.
- **Le Builder et le roster personnel** restent inchangés.
- **Le bloc « Statistiques du héros »** en bas de fiche reste inchangé.
- **L'en-tête périmé de `sw.js`**, qui annonce `network-first` pour les fichiers applicatifs alors que le code fait `cacheFirst` (ligne 157). Le comportement est délibéré et justifié ; seul le commentaire ment. À corriger dans un passage séparé pour ne pas mêler deux sujets.
