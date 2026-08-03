# Page d'accueil — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes utilisent des cases à cocher (`- [ ]`).

**But :** faire de « Mon suivi » un véritable écran d'arrivée nommé
« Accueil », qui répond aux questions qu'un membre se pose en ouvrant le site —
dispos, roster, créneau fort — et plus seulement à celles du boss.

**Architecture :** un module métier pur (`accueil-logique.js`) compose des faits
que d'autres modules produisent déjà ; `suivi-store.js` fait les lectures et les
range dans l'état du tableau de bord ; `suivi.js` rend trois cartes de plus.
Aucune donnée nouvelle n'est inventée.

**Pile :** modules ES natifs, aucun build, aucun framework. Tests : harnais
maison `vm` (`tests/helpers/load-app.js`) pour l'unitaire, Playwright pour le
bout en bout.

## Contraintes globales

- **Spec de référence :** `docs/superpowers/specs/2026-08-04-page-accueil-design.md`.
- **Une lecture indisponible vaut `null`, jamais une valeur par défaut.** Trois
  états et non deux : donnée absente, donnée vide, donnée pleine. Une carte
  dont la donnée est absente **disparaît**.
- **Un module métier neuf s'enregistre à QUATRE endroits :**
  `tests/helpers/modules.js` (ordre des couches), `sw.js` (`CORE_ASSETS`),
  l'`import` du consommateur, et `tests/helpers/load-app.js` (objet `hooks`,
  liste explicite). En oublier un casse les tests de couches, le mode hors
  ligne, ou rend le module intestable.
- **Règle des couches :** un module ne dépend jamais d'un module situé **plus
  bas** dans `tests/helpers/modules.js`. `tests/modules-imports.test.js`
  protège cette règle **et rejette tout export que personne n'importe** — d'où
  le regroupement du module et de son branchement dans une seule tâche.
- **Messages de commit sans accents.** Libellés d'interface en français
  accentué.
- **Vérification navigateur :** toujours un port jamais utilisé. Le service
  worker sert `CORE_PATHS` en `cacheFirst` (`sw.js:157`) et masquerait
  totalement les changements sur un port déjà visité.
- Commande de test complète : `npm test`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `js/metier/accueil-logique.js` *(créé)* | Pur. Résume les dispos et le roster en faits affichables. Ne connaît ni DOM ni réseau. |
| `js/donnees/suivi-store.js` *(modifié)* | Ajoute deux lectures et les range dans l'état. Aucun rendu. |
| `js/vues/suivi.js` *(modifié)* | Rend les trois cartes et route leurs boutons. |
| `index.html` *(modifié)* | Onglet « Accueil » en tête, vue active déplacée, deux cibles de focus rendues focalisables. |
| `tests/accueil.test.js` *(créé)* | Unitaire du module pur. |
| `tests/supabase-etape1.playwright.js` *(modifié)* | Accueille les scénarios bout en bout : le harnais Supabase factice du tableau de bord y vit déjà (64 références). |

**Décision de découpage :** aucun nouveau fichier Playwright. Reconstruire un
faux Supabase ailleurs dupliquerait un harnais de plusieurs centaines de lignes
pour tester la même vue.

---

## Tâche 1 : le module d'accueil et ses données

**Fichiers :**
- Créer : `js/metier/accueil-logique.js`
- Créer : `tests/accueil.test.js`
- Modifier : `tests/helpers/modules.js` (après `"metier/boss-logique.js"`)
- Modifier : `tests/helpers/load-app.js` (objet `hooks`)
- Modifier : `sw.js` (`CORE_ASSETS`, après `"./js/metier/boss-logique.js"`)
- Modifier : `js/donnees/suivi-store.js`

**Interfaces :**
- Consomme : `normalizeAvailabilityMask`, `aggregateAvailability`,
  `availabilitySlotFromIndex` (`metier/dispos-logique.js`) ;
  `normalizeRosterCharacter`, `favoriteRosterWeaponType`, `rosterHeroSnapshot`
  (`metier/equipe-modele.js`) ; `calculateHeroStats` (`metier/stats-calcul.js`).
- Produit :
  ```js
  availabilitySummary({ rows, userId })
    // rows non-tableau -> null (lecture indisponible)
    // -> { mine:{ posed:boolean, count:number },
    //      best:{ day:number, hour:number, count:number } | null }

  rosterSummary({ characters })
    // characters non-tableau -> null
    // -> { toComplete:number }
  ```
  Et deux champs dans l'état du tableau de bord : `state.availability`
  (le retour de `availabilitySummary`) et `state.roster` (celui de
  `rosterSummary`).

- [ ] **Étape 1 : écrire le test unitaire qui échoue**

Créer `tests/accueil.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { availabilitySummary, rosterSummary } = hooks;

const VIDE = "0".repeat(168);
function masqueAvec(...indexes){
  const cases = VIDE.split("");
  indexes.forEach(index => { cases[index] = "1"; });
  return cases.join("");
}

/* LECTURE INDISPONIBLE : `null`, jamais un resume vide.

   Annoncer « tes dispos ne sont pas posees » parce que la requete a echoue
   pousserait le membre a refaire un travail deja fait. La carte doit
   disparaitre, donc le resume doit pouvoir dire « je ne sais pas ». */
assert.strictEqual(availabilitySummary({ rows:null, userId:"moi" }), null);
assert.strictEqual(availabilitySummary({ rows:undefined, userId:"moi" }), null);
assert.strictEqual(availabilitySummary(), null);
assert.strictEqual(rosterSummary({ characters:null }), null);
assert.strictEqual(rosterSummary(), null);

/* SEMAINE VIDE : personne n'a rien pose. C'est une donnee, pas une absence. */
{
  const resume = availabilitySummary({ rows:[], userId:"moi" });
  assert.strictEqual(resume.mine.posed, false);
  assert.strictEqual(resume.mine.count, 0);
  assert.strictEqual(resume.best, null);
}

/* MES CRENEAUX : seules mes lignes comptent pour `mine`. */
{
  const resume = availabilitySummary({
    userId:"moi",
    rows:[
      { owner:"moi", slots:masqueAvec(0, 1, 2) },
      { owner:"autre", slots:masqueAvec(0, 1, 2, 3, 4) }
    ]
  });
  assert.strictEqual(resume.mine.posed, true);
  assert.strictEqual(
    resume.mine.count, 3,
    "Le decompte ne doit compter que MES creneaux"
  );
}

/* CRENEAU FORT : le plus peuple, tous membres confondus. L'index 25 vaut
   mardi 1h (index = jour * 24 + heure), et il est le seul a reunir deux
   membres. */
{
  const resume = availabilitySummary({
    userId:"moi",
    rows:[
      { owner:"moi", slots:masqueAvec(25) },
      { owner:"autre", slots:masqueAvec(25, 30) }
    ]
  });
  assert.deepStrictEqual(
    { day:resume.best.day, hour:resume.best.hour, count:resume.best.count },
    { day:1, hour:1, count:2 }
  );
}

/* Un membre sans ligne du tout n'a rien pose, mais la semaine reste lisible. */
{
  const resume = availabilitySummary({
    userId:"absent",
    rows:[{ owner:"autre", slots:masqueAvec(10) }]
  });
  assert.strictEqual(resume.mine.posed, false);
  assert.strictEqual(resume.best.count, 1);
}

/* ROSTER : le build JUGE est le favori.

   Merlin porte trois types d'arme (Livre, Baton, Baguette). Un membre qui
   garde volontairement un build alternatif a moitie rempli ne doit PAS etre
   signale : c'est son favori qui fait foi. */
{
  assert.deepStrictEqual(rosterSummary({ characters:[] }), { toComplete:0 });

  /* Aucun build du tout -> a completer. */
  assert.deepStrictEqual(
    rosterSummary({ characters:[{ owner:"moi", charId:"merlin", builds:{} }] }),
    { toComplete:1 }
  );

  /* Un build sans arme -> a completer. */
  assert.deepStrictEqual(
    rosterSummary({
      characters:[{
        owner:"moi", charId:"merlin",
        builds:{ Livre:{ favorite:true } }
      }]
    }),
    { toComplete:1 }
  );

  /* Une entree que le catalogue ne reconnait pas -> a completer, jamais une
     exception : le tableau de bord ne doit pas tomber sur une donnee vieillie. */
  assert.deepStrictEqual(
    rosterSummary({ characters:[{ owner:"moi", charId:"personnage-inconnu" }] }),
    { toComplete:1 }
  );
}

console.log("accueil.test.js OK");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/accueil.test.js`

Attendu : `TypeError: availabilitySummary is not a function` — les deux noms
sont `undefined` dans `hooks`.

- [ ] **Étape 3 : créer le module**

Créer `js/metier/accueil-logique.js` :

```js
/* L'accueil : ce que le membre doit faire cette semaine, au-dela du boss.

   Module PUR — ni DOM ni reseau. Il n'invente aucune donnee : il compose des
   faits que dispos-logique, equipe-modele et stats-calcul savent deja produire.

   Il vit hors de boss-logique.js a dessein. Ce dernier parle du boss ; lui
   faire accueillir les dispos et le roster brouillerait sa raison d'etre.

   REGLE TRANSVERSE — une lecture indisponible vaut `null`, jamais une valeur
   par defaut. Trois etats et non deux : donnee absente, donnee vide, donnee
   pleine. Annoncer « tes dispos ne sont pas posees » parce que la requete a
   echoue pousserait le membre a refaire un travail deja fait. */

import {
  aggregateAvailability,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask
} from "./dispos-logique.js";
import {
  favoriteRosterWeaponType,
  normalizeRosterCharacter,
  rosterHeroSnapshot
} from "./equipe-modele.js";
import { calculateHeroStats } from "./stats-calcul.js";

  function countPosedSlots(mask){
    let total = 0;
    for(let index = 0; index < mask.length; index += 1){
      if(mask[index] === "1") total += 1;
    }
    return total;
  }

  function availabilitySummary(input){
    const source = input || {};
    /* Un tableau, meme vide, dit « j'ai lu ». Tout le reste dit « je ne sais
       pas », et la carte disparaitra plutot que de mentir. */
    if(!Array.isArray(source.rows)) return null;
    const userId = source.userId || "";
    const own = source.rows.find(row => row && row.owner === userId);
    const count = countPosedSlots(normalizeAvailabilityMask(own && own.slots));
    const { best } = aggregateAvailability(source.rows);
    const first = best.length ? best[0] : null;
    return {
      mine:{ posed:count > 0, count },
      best:first
        ? Object.assign(
            availabilitySlotFromIndex(first.index), { count:first.count }
          )
        : null
    };
  }

  /* Le build JUGE est le favori. A defaut, le premier build declare : les cles
     de `builds` sont posees par `normalizeRosterCharacter` dans l'ordre de
     `weaponTypesOf(charId)`, donc « le premier » est deterministe et non
     arbitraire. */
  function judgedWeaponType(entry){
    const favorite = favoriteRosterWeaponType(entry);
    if(favorite) return favorite;
    const normalized = normalizeRosterCharacter(entry);
    const types = normalized ? Object.keys(normalized.builds) : [];
    return types.length ? types[0] : null;
  }

  function rosterSummary(input){
    const source = input || {};
    if(!Array.isArray(source.characters)) return null;
    const toComplete = source.characters.filter(entry => {
      const weaponType = judgedWeaponType(entry);
      if(!weaponType) return true;
      const hero = rosterHeroSnapshot(entry, weaponType);
      if(!hero) return true;
      return calculateHeroStats(hero).status !== "valid";
    }).length;
    return { toComplete };
  }

export { availabilitySummary, rosterSummary };
```

- [ ] **Étape 4 : enregistrer le module aux quatre endroits**

Dans `tests/helpers/modules.js`, après `"metier/boss-logique.js"` :

```js
  "metier/boss-logique.js",
  "metier/accueil-logique.js",
```

Dans `sw.js`, dans `CORE_ASSETS`, juste après `"./js/metier/boss-logique.js"` :

```js
"./js/metier/boss-logique.js", "./js/metier/accueil-logique.js",
```

Dans `tests/helpers/load-app.js`, ajouter au littéral `hooks` (le garde
`typeof` est le motif du fichier, il rend le harnais tolérant à un module pas
encore écrit) :

```js
  availabilitySummary:typeof availabilitySummary === "function"
    ? availabilitySummary
    : undefined,
  rosterSummary:typeof rosterSummary === "function"
    ? rosterSummary
    : undefined,
```

Le quatrième endroit — l'`import` du consommateur — est l'étape 6.

- [ ] **Étape 5 : lancer le test unitaire et vérifier qu'il passe**

Commande : `node tests/accueil.test.js`
Attendu : `accueil.test.js OK`

- [ ] **Étape 6 : brancher le store**

Dans `js/donnees/suivi-store.js` :

1. Passer la version du cache de `1` à `2` (ligne 18) :

```js
  /* Version 2 : l'etat porte desormais `availability` et `roster`. Sans ce
     passage, les enveloppes deja ecrites sur les appareils des membres —
     depourvues de ces champs — seraient relues comme valides et les trois
     cartes resteraient absentes jusqu'a la premiere synchro reussie. */
  const DASHBOARD_CACHE_VERSION = 2;
```

2. Ajouter les imports :

```js
import { availabilitySummary, rosterSummary } from "../metier/accueil-logique.js";
import { availabilityWeekStart } from "../metier/dispos-logique.js";
import { MemberRosterStore } from "./roster-store.js";
```

3. Dans `load()`, avant le `Promise.all`, ajouter les deux lectures :

```js
      /* Les dispos ont LEUR semaine : lundi 0h, quand le boss compte a partir
         du lundi 9h. Le lundi matin entre les deux, `weekStart` designerait la
         semaine ecoulee et la carte afficherait les creneaux d'avant. */
      const availabilityWeek = availabilityWeekStart(new Date());
      /* Chaque lecture porte SON repli a `null` : l'echec d'une carte ne doit
         jamais emporter le tableau de bord entier. */
      const availabilityPromise = sb
        ? sb.from("member_availability")
            .select("owner,slots,week_start")
            .eq("week_start", availabilityWeek)
            .then(result => result.error ? null : (result.data || []))
            .catch(() => null)
        : Promise.resolve(null);
      const rosterPromise = MemberRosterStore.refresh(userId).catch(() => null);
```

4. Les ajouter au `Promise.all` :

```js
      const [membership, reportResult, teams, availabilityRows, rosterCharacters] =
        await Promise.all([
          membershipPromise,
          reportsPromise,
          teamsPromise,
          availabilityPromise,
          rosterPromise
        ]);
```

5. Les ranger dans l'état, dans le second argument de `Object.assign` :

```js
      }), {
        userId,
        reportsAvailable:reportResult.reportsAvailable,
        availability:availabilitySummary({ rows:availabilityRows, userId }),
        roster:rosterSummary({ characters:rosterCharacters })
      });
```

`sb` est déjà importé dans ce fichier ; vérifier l'`import` existant avant d'en
ajouter un doublon.

- [ ] **Étape 7 : lancer la suite complète**

Commande : `npm test`

Attendu : tout au vert, `PASS modules : imports déclarés et fichiers mis en
cache` compris. Un échec de ce test précis signale un enregistrement oublié
parmi les quatre.

- [ ] **Étape 8 : commit**

```bash
git add js/metier/accueil-logique.js tests/accueil.test.js \
        tests/helpers/modules.js tests/helpers/load-app.js \
        sw.js js/donnees/suivi-store.js
git commit -m "feat: resumer les dispos et le roster pour l'accueil"
```

---

## Tâche 2 : les trois cartes

**Fichiers :**
- Modifier : `js/vues/suivi.js` (`renderDashboardContent`, `runDashboardAction`)
- Modifier : `js/vues/synchro-temps-reel.js:60` (fraîcheur des cartes)
- Modifier : `index.html:195` et `index.html:254` (cibles de focus)
- Modifier : `tests/supabase-etape1.playwright.js` (scénarios)

**Interfaces :**
- Consomme : `state.availability` et `state.roster` produits par la tâche 1 ;
  `AVAIL_DAY_FULL` (`metier/dispos-logique.js`) ; `Availability`
  (`vues/dispos.js` — situé **avant** `vues/suivi.js` dans l'ordre des couches,
  l'import est donc légal).
- Produit : trois sections portant `data-card="availability"`,
  `data-card="roster"`, `data-card="best-slot"`, et trois types d'action
  routés par `runDashboardAction` : `"post-availability"`, `"complete-roster"`,
  `"view-planning"`.

- [ ] **Étape 1 : rendre les deux titres focalisables**

`runDashboardAction` met le focus sur le titre de la vue d'arrivée. Un `<h1>`
sans `tabindex="-1"` ignore silencieusement `.focus()` : le membre changerait
d'onglet mais son curseur clavier resterait derrière.

`index.html:195` — ajouter identifiant et `tabindex` :

```html
    <h1 class="section-title" id="availTitle" tabindex="-1">Dispos de la semaine</h1>
```

`index.html:254` — ajouter `tabindex` (l'identifiant existe déjà) :

```html
    <h1 class="section-title" id="memberRosterTitle" tabindex="-1">
```

- [ ] **Étape 2 : écrire les scénarios bout en bout qui échouent**

Dans `tests/supabase-etape1.playwright.js`, à la suite du scénario du tableau
de bord (autour de la ligne 5280, après les assertions
`/1\s*Encore disponibles/`) :

```js
    /* LES TROIS CARTES D'ACCUEIL.

       Elles repondent aux questions qu'un membre se pose en arrivant et que le
       suivi, purement boss, laissait sans reponse. */
    assert.match(
      await dashboardText(),
      /Tes dispos ne sont pas posées/,
      "Une semaine sans dispo doit le dire et proposer d'y aller"
    );
    await page.locator('[data-dashboard-action="post-availability"]').click();
    await page.locator("#view-availability").waitFor({ state:"visible" });
    await page.locator('.tab[data-view="dashboard"]').click();

    /* LA REGLE QUI COMPTE : une lecture en echec MASQUE la carte.

       Afficher « tes dispos ne sont pas posees » parce que la requete a echoue
       pousserait le membre a refaire un travail deja fait. Une donnee absente
       n'est pas une donnee vide.

       `bossReadFailureOnce` porte un nom trompeur : le faux client le compare a
       n'importe quel nom de table (ligne 6183), pas seulement aux tables de
       boss. C'est un echec a UN COUP, remis a `null` des qu'il a servi.

       L'emission Realtime qui suit teste au passage le cablage de l'etape 6 :
       sans lui, une ecriture de dispos ne rafraichirait pas l'accueil. */
    await page.evaluate(() => {
      window.__fakeSupabaseState.bossReadFailureOnce = {
        table:"member_availability",
        message:"Réseau dispos indisponible"
      };
      window.__fakeSupabaseEmit("member_availability", "UPDATE");
    });
    await page.waitForFunction(() =>
      window.__fakeSupabaseState.bossReadFailureOnce === null &&
      !document.querySelector('#dashboardBody [data-card="availability"]'),
      null, { timeout:5000 }
    );
    assert.doesNotMatch(
      await dashboardText(),
      /Tes dispos ne sont pas posées/,
      "Une lecture en echec doit masquer la carte, jamais annoncer un faux zero"
    );
```

- [ ] **Étape 3 : lancer et vérifier l'échec**

Commande : `node tests/supabase-etape1.playwright.js`

Attendu : échec sur `Une semaine sans dispo doit le dire et proposer d'y aller`
— aucune carte n'est encore rendue.

- [ ] **Étape 4 : rendre les trois cartes**

Dans `js/vues/suivi.js`, ajouter aux imports :

```js
import { AVAIL_DAY_FULL } from "../metier/dispos-logique.js";
import { Availability } from "./dispos.js";
```

Ajouter deux fonctions de libellé au-dessus de `renderDashboardContent` :

```js
  function slotsPosedLabel(count){
    return count + " créneau" + (count > 1 ? "x" : "")
      + " posé" + (count > 1 ? "s" : "") + " cette semaine";
  }

  function bestSlotLabel(best){
    return AVAIL_DAY_FULL[best.day] + " "
      + String(best.hour).padStart(2, "0") + " h — "
      + best.count + " membre" + (best.count > 1 ? "s" : "")
      + " disponible" + (best.count > 1 ? "s" : "");
  }
```

Dans `renderDashboardContent`, **après** le bloc `if(state.actions.length)` et
**avant** le calcul de `openGroups` :

```js
    /* Les trois cartes d'accueil. Chacune disparait quand elle n'a rien a
       dire : donnee absente (lecture en echec) ou rien a signaler. Une carte
       qui affiche « 0 » est du bruit, et une carte qui affiche un faux « 0 »
       est un mensonge. */
    const availability = state.availability;
    if(availability){
      const posed = availability.mine.posed;
      blocks.push(el("section",{
        class:"dashboard-section",
        dataset:{ card:"availability" }
      },[
        el("strong",{text:posed
          ? slotsPosedLabel(availability.mine.count)
          : "Tes dispos ne sont pas posées"}),
        posed
          ? null
          : el("p",{text:"La confrérie ne peut pas te compter dans ses créneaux."}),
        el("button",{
          class:"btn "+(posed ? "" : "btn-primary"),
          type:"button",
          dataset:{ dashboardAction:"post-availability" },
          text:posed ? "Modifier mes dispos" : "Poser mes dispos",
          onclick:()=>void runDashboardAction({ type:"post-availability" })
        })
      ]));
    }

    if(state.roster && state.roster.toComplete > 0){
      blocks.push(el("section",{
        class:"dashboard-section",
        dataset:{ card:"roster" }
      },[
        el("strong",{text:state.roster.toComplete+" héros à compléter"}),
        el("button",{
          class:"btn",
          type:"button",
          dataset:{ dashboardAction:"complete-roster" },
          text:"Compléter mon roster",
          onclick:()=>void runDashboardAction({ type:"complete-roster" })
        })
      ]));
    }

    if(availability && availability.best){
      blocks.push(el("section",{
        class:"dashboard-section",
        dataset:{ card:"best-slot" }
      },[
        el("strong",{text:bestSlotLabel(availability.best)}),
        el("button",{
          class:"btn",
          type:"button",
          dataset:{ dashboardAction:"view-planning" },
          text:"Voir le planning",
          onclick:()=>void runDashboardAction({ type:"view-planning" })
        })
      ]));
    }
```

Le helper `el` ignore déjà les enfants `null` (`js/noyau/dom.js:34`) : le `<p>`
conditionnel n'a pas besoin d'être filtré.

Aucune règle CSS n'est ajoutée : `.dashboard-section` habille déjà exactement
cette forme — un `<strong>`, un `<p>` facultatif, un bouton — comme le fait le
bloc « Données potentiellement anciennes ».

- [ ] **Étape 5 : router les trois actions**

Dans `runDashboardAction`, avant la branche `"find-group"` :

```js
    if(action.type === "post-availability"){
      await showView("availability");
      $("#availTitle").focus();
      return;
    }
    if(action.type === "complete-roster"){
      await showView("member-roster");
      $("#memberRosterTitle").focus();
      return;
    }
    /* Le creneau fort est une lecture collective : arriver en mode « Mes
       dispos » obligerait le membre a basculer lui-meme pour voir ce que la
       carte vient de lui annoncer. */
    if(action.type === "view-planning"){
      await showView("availability");
      Availability.setMode("guild");
      $("#availTitle").focus();
      return;
    }
```

- [ ] **Étape 6 : faire vivre les cartes en temps réel**

Sans cette étape, les deux cartes neuves affichent un état figé : un membre qui
pose ses dispos verrait encore « tes dispos ne sont pas posées » jusqu'au
prochain rechargement complet.

`js/vues/synchro-temps-reel.js:60` décide ce qui salit le tableau de bord, et
ne connaît aujourd'hui que les équipes et le boss :

```js
        const dashboardChanged = changed.has("teams") || changed.has("boss");
```

L'accueil dépend désormais aussi des dispos et du roster :

```js
        /* L'accueil lit maintenant les dispos et le roster : une ecriture sur
           l'une de ces tables le perime, exactement comme une ecriture
           d'equipe ou de boss. */
        const dashboardChanged = changed.has("teams") || changed.has("boss")
          || changed.has("availability") || changed.has("roster");
```

`schedule()` alimente déjà `"availability"` (table `member_availability`) et
`"roster"` (tables `profiles` et `roster_characters`) : aucun autre changement
n'est nécessaire dans ce fichier.

- [ ] **Étape 7 : lancer la suite complète**

Commande : `npm test`
Attendu : tout au vert.

- [ ] **Étape 8 : commit**

```bash
git add js/vues/suivi.js js/vues/synchro-temps-reel.js index.html \
        tests/supabase-etape1.playwright.js
git commit -m "feat: trois cartes d'accueil - dispos, roster et creneau fort"
```

---

## Tâche 3 : l'accueil devient la vue d'arrivée

**Fichiers :**
- Modifier : `index.html:44-66` (onglets), `index.html:85-96` (titre et chapô)
- Modifier : `tests/accessibilite-mobile.playwright.js` (2 références)
- Modifier : `tests/supabase-etape1.playwright.js` (11 références)

**Interfaces :**
- Consomme : les cartes de la tâche 2.
- Produit : `#view-dashboard` porte `class="view active"` au chargement ;
  `#tab-dashboard` est le premier onglet, libellé « Accueil ».

- [ ] **Étape 1 : écrire l'assertion d'arrivée qui échoue**

Dans `tests/supabase-etape1.playwright.js`, au tout début du premier scénario,
juste après le premier `page.goto` :

```js
    /* L'ARRIVEE. Le membre atterrissait sur le Builder, puis session-auth
       basculait vers le tableau de bord : un clignotement a chaque ouverture.
       L'accueil est desormais la vue de depart, sans detour. */
    assert.equal(
      await page.locator("#view-dashboard").getAttribute("class"),
      "view active",
      "L'accueil doit etre la vue d'arrivee"
    );
    assert.equal(
      await page.locator(".tabs .tab").first().getAttribute("id"),
      "tab-dashboard",
      "L'accueil doit etre le premier onglet"
    );
    assert.equal(
      await page.locator("#tab-dashboard").textContent(),
      "Accueil"
    );
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `node tests/supabase-etape1.playwright.js`
Attendu : échec sur `L'accueil doit etre la vue d'arrivee` — la classe vaut
`"view"`.

- [ ] **Étape 3 : déplacer l'onglet**

Dans `index.html`, `<nav class="tabs">` : placer le bouton `#tab-dashboard` en
**première** position, renommé, et lui donner l'état sélectionné :

```html
    <button class="tab active" id="tab-dashboard" data-view="dashboard"
            role="tab" aria-controls="view-dashboard"
            aria-selected="true" tabindex="0">Accueil</button>
    <button class="tab" id="tab-builder" data-view="builder"
            role="tab" aria-controls="view-builder"
            aria-selected="false" tabindex="-1">Créer une équipe</button>
```

Les cinq autres boutons ne changent pas.

- [ ] **Étape 4 : déplacer la vue active et réécrire l'en-tête**

`index.html:85` — `#view-dashboard` devient la vue active :

```html
  <section id="view-dashboard" class="view active" role="tabpanel"
           aria-labelledby="tab-dashboard">
```

`index.html:90-91` — titre et chapô :

```html
        <h1 class="section-title" id="dashboardTitle" tabindex="-1">Accueil</h1>
        <p class="section-lead">Ce qu'il te reste à faire cette semaine.</p>
```

`index.html:101` — `#view-builder` perd `active` :

```html
  <section id="view-builder" class="view" role="tabpanel"
           aria-labelledby="tab-builder">
```

Ne **pas** toucher `js/vues/session-auth.js:128` : son `showView("dashboard")`
devient sans effet visible à l'arrivée, mais reste nécessaire quand le membre
se connecte depuis un autre onglet.

- [ ] **Étape 5 : corriger les treize références**

Commande pour les lister :

```bash
grep -n "view-builder\|tab-builder\|Créer une équipe" \
  tests/accessibilite-mobile.playwright.js tests/supabase-etape1.playwright.js
```

Chacune doit être **relue**, pas remplacée mécaniquement. Deux cas distincts :

- celles qui affirment que le Builder est la vue d'arrivée décrivent
  l'ancien comportement : elles deviennent des assertions sur l'accueil, ou
  gagnent un `click` explicite sur `#tab-builder` avant leur suite ;
- celles qui se contentent d'atteindre le Builder pour tester autre chose
  gardent leur intention : leur ajouter le `click` sur `#tab-builder` suffit.

Le premier onglet changeant, vérifier aussi dans
`tests/accessibilite-mobile.playwright.js` toute assertion sur la navigation au
clavier entre onglets : c'est `#tab-dashboard` qui porte désormais
`tabindex="0"`.

- [ ] **Étape 6 : lancer la suite complète**

Commande : `npm test`
Attendu : tout au vert.

- [ ] **Étape 7 : vérifier au navigateur**

```bash
npx --yes http-server -p <port jamais utilisé> -c-1 --silent
```

Contrôler : l'accueil s'affiche d'emblée, le Builder n'apparaît à aucun
instant, et les trois cartes mènent au bon onglet.

- [ ] **Étape 8 : commit**

```bash
git add index.html tests/accessibilite-mobile.playwright.js \
        tests/supabase-etape1.playwright.js
git commit -m "feat: l'accueil devient la vue d'arrivee"
```

---

## Auto-relecture du plan

**Couverture de la spec.** Section 1 navigation → tâche 3. Section 2 les trois
cartes → tâche 2 (contenus, libellés et actions repris mot pour mot). Section 3
dégradation → tâche 1 étape 1 (le `null` testé) et tâche 2 étape 2
(l'assertion bout en bout qui doit être vue rouge). Section 4 semaines → tâche 1
étape 6, point 3 ; cache version 2 → tâche 1 étape 6, point 1. Section 5
découpage → tâche 1 étapes 3 et 4. Section 6 tests → répartis. Aucun trou.

**Écarts assumés par rapport à la spec.**

1. La spec annonçait « trois endroits » pour enregistrer un module neuf. Il y
   en a **quatre** : `tests/helpers/load-app.js` expose `hooks` par une liste
   explicite, sans quoi le module serait intestable en unitaire.
2. La spec prévoyait un fichier `tests/accueil.playwright.js`. Les scénarios
   rejoignent `tests/supabase-etape1.playwright.js`, où le faux Supabase du
   tableau de bord existe déjà — en dupliquer un ailleurs coûterait des
   centaines de lignes pour tester la même vue.
3. La spec décrivait à la main la résolution du build favori.
   `favoriteRosterWeaponType` (`js/metier/equipe-modele.js:255`) la fait déjà ;
   seul le repli « premier build déclaré » reste à écrire.
4. Deux `<h1>` doivent devenir focalisables (tâche 2 étape 1). La spec ne
   l'avait pas vu : sans `tabindex="-1"`, `.focus()` échoue en silence et le
   curseur clavier reste derrière après un changement d'onglet.
5. **Trouvaille tardive, absente de la spec :**
   `js/vues/synchro-temps-reel.js:60` ne tient le tableau de bord pour périmé
   que sur un changement d'équipe ou de boss. Les cartes dispos et roster
   seraient donc restées figées jusqu'au rechargement suivant — un membre
   aurait posé ses dispos et lu « tes dispos ne sont pas posées » juste après.
   Corrigé en tâche 2 étape 6, et couvert par le scénario de l'étape 2.

**Cohérence des types.** `availabilitySummary` et `rosterSummary` portent les
mêmes noms, arguments et formes de retour dans le bloc « Interfaces » de la
tâche 1, dans le code de l'étape 3, dans le test de l'étape 1 et dans les
lectures de `state.availability` / `state.roster` de la tâche 2. Les trois
types d'action — `"post-availability"`, `"complete-roster"`, `"view-planning"` —
sont identiques entre le rendu (étape 4) et le routage (étape 5).
