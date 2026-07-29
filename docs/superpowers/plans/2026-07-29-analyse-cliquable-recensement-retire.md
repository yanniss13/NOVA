# Analyse cliquable et retrait du Recensement — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche.

**Objectif :** rendre les personnages cliquables dans l'Analyse pour consulter
l'équipement d'un membre, exclure les SR du DPS, puis retirer l'onglet
Recensement devenu doublon.

**Architecture :** la donnée dérivée `dpsEntriesFromRoster()` cesse de perdre
des builds et porte désormais ses types d'armes. `rosterDerivedPlayers()` cesse
de jeter les rosters normalisés, ce qui permet d'ouvrir la modale de détail
sans aucune lecture réseau. La modale gagne un second point d'entrée explicite.

**Pile technique :** JavaScript inline dans `index.html`, aucune étape de
build, aucun module ES. Tests Node natifs via le bac à sable `vm` de
`tests/helpers/load-app.js`, plus Playwright.

**Spec :** `docs/superpowers/specs/2026-07-29-analyse-cliquable-recensement-retire-design.md`

## Contraintes globales

- **Aucune étape de build.** Tout fonctionne par double-clic sur `index.html`,
  en `file://`.
- **`index.html` a des fins de ligne mixtes (CRLF et LF).** Ne jamais présumer
  le séparateur d'une ancre multi-ligne. Ne pas normaliser le fichier.
- **Les numéros de ligne de ce plan valent pour `6dba9ec`** et se décalent dès
  la première édition. Toujours ancrer par nom de fonction
  (`grep -n "function dpsEntriesFromRoster" index.html`).
- **Vérifier chaque extrait de code de ce plan contre le corps réel de la
  fonction avant de le transcrire.** Un plan précédent de ce dépôt portait
  trois erreurs de transcription invisibles à la relecture. Si un extrait
  contredit le code existant, s'arrêter et le signaler.
- **Toute fonction pure à tester doit être ajoutée à `HOOK_EXPORT`** dans
  `tests/helpers/load-app.js`.
- **`supabase/schema.sql` n'est jamais modifié.** Aucun `DROP`, aucune
  migration. Les clés `localStorage` du recensement ne sont jamais supprimées.
- **Espace de noms des armes :** `weaponTypes` et `preferredWeaponType` sont des
  enums (`Sword1h`, `Axe`, `Wand`). Les clés de `builds` sont des dossiers
  français. Convertir par `FOLDER_TO_ENUM` / `ENUM_TO_FOLDER` (~2013), jamais
  par une nouvelle table.
- **Lecture seule stricte** dans la modale ouverte depuis l'Analyse : aucun
  contrôle d'édition, aucune requête réseau au clic.
- **TDD strict**, une mutation volontaire prouve que chaque assertion mord.
- **Un commit par tâche**, message en français décrivant le *pourquoi*.
- Vérification : `node tests/stats-build.test.js` et `node tests/potentiel-commun.test.js`
  pour la boucle courte, `npm test` en fin de lot, puis `git diff --check` et
  `git status --short`.
- **Ne rien pousser sans autorisation explicite du propriétaire.**

---

### Tâche 1 : rareté et agrégation dans la donnée dérivée

`dpsEntriesFromRoster()` déduplique par élément et **jette** les builds
suivants : Meliodas SSR a trois builds DPS Ténèbres, deux disparaissent, et le
survivant dépend de l'ordre de `Object.keys(entry.builds)` que rien ne
garantit. Cette tâche transforme la déduplication en agrégation et ajoute le
filtre de rareté.

**Fichiers :**
- Modifier : `index.html` (`dpsEntriesFromRoster`, ~6288)
- Modifier : `tests/helpers/load-app.js` (`HOOK_EXPORT`)
- Test : `tests/potentiel-commun.test.js`

**Interfaces produites :**
- `dpsEntriesFromRoster(entry) -> Array<{char, element, pot, weaponTypes, preferredWeaponType}>`
- `DPS_PREFERRED_WEAPON_BY_CHAR` — préférence produit, propre à Meliodas.

- [ ] **Étape 1 : lire le code existant**

```bash
grep -n "function dpsEntriesFromRoster" -A 20 index.html
grep -n "function isRosterBuildDps" -A 8 index.html
grep -n "function favoriteRosterWeaponType" -A 6 index.html
grep -n "const FOLDER_TO_ENUM" -A 8 index.html
```

Noter que `favoriteRosterWeaponType(entry)` renvoie une clé de **dossier**, pas
un enum. La conversion est obligatoire avant comparaison.

- [ ] **Étape 2 : écrire les tests qui échouent**

Ajouter dans `tests/potentiel-commun.test.js` :

```js
function dpsFixture(charId, folders, tier){
  const builds = {};
  folders.forEach(folder => { builds[folder] = { weapon:"x.webp" }; });
  return { charId, potentialTier:tier || 0, builds };
}

function testDpsAggregatesWeaponTypes(hooks){
  // Meliodas SSR : trois builds DPS Ténèbres. Une seule ligne, trois armes.
  const entries = plain(hooks.dpsEntriesFromRoster(
    dpsFixture("meliodas", ["Epee 1 main", "Hache", "Epees doubles"], 7)
  ));
  const dark = entries.filter(e => e.element === "DARK");
  assert.strictEqual(dark.length, 1, "Une seule ligne par personnage et élément");
  assert.deepStrictEqual(
    dark[0].weaponTypes.slice().sort(),
    ["Axe", "Sword1h", "SwordDual"],
    "Aucun build DPS n'est perdu par la déduplication"
  );
}

function testDpsWeaponOrderIsStable(hooks){
  const forward = plain(hooks.dpsEntriesFromRoster(
    dpsFixture("meliodas", ["Epee 1 main", "Hache", "Epees doubles"], 7)
  ));
  const reversed = plain(hooks.dpsEntriesFromRoster(
    dpsFixture("meliodas", ["Epees doubles", "Hache", "Epee 1 main"], 7)
  ));
  assert.deepStrictEqual(
    forward.find(e => e.element === "DARK").weaponTypes,
    reversed.find(e => e.element === "DARK").weaponTypes,
    "L'ordre suit les slots du personnage, pas l'ordre de saisie"
  );
}

function testDpsExcludesSr(hooks){
  // `bug` est SR Attaquant avec deux builds Ténèbres : il ne doit rien produire.
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster(dpsFixture("bug", ["Hache", "Epees doubles"]))),
    [],
    "Un SR ne produit aucune entrée DPS, même avec des builds valides"
  );
  assert.ok(
    plain(hooks.dpsEntriesFromRoster(
      dpsFixture("meliodas", ["Hache"], 0)
    )).length > 0,
    "Un SSR équivalent reste présent"
  );
}

function testDpsPreferredWeapon(hooks){
  const entry = dpsFixture("meliodas", ["Hache", "Epee 1 main"], 7);
  assert.strictEqual(
    plain(hooks.dpsEntriesFromRoster(entry))
      .find(e => e.element === "DARK").preferredWeaponType,
    "Sword1h",
    "Sans favori, Meliodas ouvre Sword1h"
  );

  const favored = dpsFixture("meliodas", ["Hache", "Epee 1 main"], 7);
  favored.builds["Hache"].favorite = true;
  assert.strictEqual(
    plain(hooks.dpsEntriesFromRoster(favored))
      .find(e => e.element === "DARK").preferredWeaponType,
    "Axe",
    "Le favori prime sur la préférence Meliodas"
  );

  const noSword = dpsFixture("meliodas", ["Hache", "Epees doubles"], 7);
  const fallback = plain(hooks.dpsEntriesFromRoster(noSword))
    .find(e => e.element === "DARK");
  assert.strictEqual(
    fallback.preferredWeaponType,
    fallback.weaponTypes[0],
    "Sans Sword1h, repli stable sur le premier de weaponTypes"
  );
}

function testGowtherPotentialGate(hooks){
  const seven = plain(hooks.dpsEntriesFromRoster(dpsFixture("gowther", ["Baguette"], 7)));
  assert.deepStrictEqual(
    seven.length ? seven[0].weaponTypes : [],
    ["Wand"],
    "Gowther P7 ne porte que la Baguette"
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster(dpsFixture("gowther", ["Baguette"], 6))),
    [],
    "Gowther P6 ne produit aucune entrée DPS"
  );
}
```

Appeler les cinq fonctions avec les autres tests du fichier.

**Fixtures : la répartition est imposée.** `bug` sert **uniquement** à prouver
l'exclusion des SR. Il ne peut pas prouver l'agrégation, puisqu'exclu il ne
produit rien. L'agrégation se prouve sur Meliodas réel.

- [ ] **Étape 3 : lancer les tests pour les voir échouer**

```bash
node tests/potentiel-commun.test.js
```

Attendu : `weaponTypes` est `undefined`, et `bug` produit encore des entrées.

- [ ] **Étape 4 : exposer la fonction**

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  dpsEntriesFromRoster:typeof dpsEntriesFromRoster === "function"
    ? dpsEntriesFromRoster
    : undefined,
```

- [ ] **Étape 5 : implémenter**

Remplacer le corps de `dpsEntriesFromRoster` :

```js
  /* Préférence de jeu du propriétaire, propre à Meliodas : à défaut de favori,
     ouvrir l'Épée à une main. Ce n'est pas une liste d'assets — c'est une
     règle produit nommée. La généraliser changerait le comportement de futurs
     personnages sans décision. */
  const DPS_PREFERRED_WEAPON_BY_CHAR = { meliodas:"Sword1h" };

  function dpsEntriesFromRoster(entry){
    const m = entry && metaOf(entry.charId);
    if(!m || !entry.builds) return [];
    /* Les SR sont hors de l'analyse DPS. Filtrer ici les retire d'un coup du
       classement, de la couverture et de la matrice, qui dérivent toutes de
       cette sortie. */
    if(m.rarity !== "SSR") return [];
    const favoriteFolder = favoriteRosterWeaponType(entry);
    const favoriteEnum = favoriteFolder ? FOLDER_TO_ENUM[favoriteFolder] : null;
    const preferred = DPS_PREFERRED_WEAPON_BY_CHAR[entry.charId] || null;
    const byElement = new Map();
    /* On parcourt les slots du personnage, pas les clés de `builds` : l'ordre
       des armes devient stable d'un membre à l'autre. */
    (m.weapons||[]).forEach(slot => {
      const en = slot.weapon;
      const folder = ENUM_TO_FOLDER[en];
      if(!folder || !owns(entry.builds, folder)) return;
      if(!isRosterBuildDps(entry, slot, en)) return;
      const element = (slot.element||"").toUpperCase();
      if(!element) return;
      if(!byElement.has(element)){
        byElement.set(element, {
          char:entry.charId,
          element,
          pot:entry.potentialTier||0,
          weaponTypes:[],
          preferredWeaponType:null
        });
      }
      byElement.get(element).weaponTypes.push(en);
    });
    return [...byElement.values()].map(item => Object.assign(item, {
      preferredWeaponType:
        (favoriteEnum && item.weaponTypes.includes(favoriteEnum) && favoriteEnum)
        || (preferred && item.weaponTypes.includes(preferred) && preferred)
        || item.weaponTypes[0]
    }));
  }
```

Vérifier que `owns()` existe dans ce fichier ; sinon utiliser
`Object.prototype.hasOwnProperty.call(entry.builds, folder)`.

- [ ] **Étape 6 : voir passer, puis prouver que ça mord**

```bash
node tests/potentiel-commun.test.js
```

Trois mutations, chacune doit faire échouer le test nommé, puis rétablir :

| Mutation | Test qui doit échouer |
| --- | --- |
| retirer `if(m.rarity !== "SSR") return [];` | `testDpsExcludesSr` |
| repasser sur `Object.keys(entry.builds)` au lieu des slots | `testDpsWeaponOrderIsStable` |
| vider `DPS_PREFERRED_WEAPON_BY_CHAR` | `testDpsPreferredWeapon` |

- [ ] **Étape 7 : commit**

```bash
git add index.html tests/helpers/load-app.js tests/potentiel-commun.test.js
git commit -m "fix: cesser de perdre les builds DPS et exclure les SR

La deduplication par element jetait les builds suivants : Meliodas SSR a
trois builds DPS Tenebres dont deux disparaissaient, et le survivant
dependait d'un ordre de cles que rien ne garantit. Elle devient une
agregation, et l'ordre suit les slots du personnage.

Les SR sortent de l'analyse DPS a la source, ce qui les retire d'un coup
des trois sections qui derivent de cette sortie."
```

---

### Tâche 2 : conserver les rosters normalisés

`rosterDerivedPlayers()` calcule les personnages normalisés puis les jette.
Sans eux, ouvrir la modale depuis l'Analyse imposerait une lecture réseau, que
la spec interdit.

**Fichiers :**
- Modifier : `index.html` (`rosterDerivedPlayers`, ~6307)
- Test : `tests/potentiel-commun.test.js`

**Interfaces produites :**
- `rosterDerivedPlayers() -> Array<{owner, name, dps, characters}>`

- [ ] **Étape 1 : écrire le test qui échoue**

Ce test porte sur la forme retournée, pas sur le réseau. Construire le joueur
depuis un faux `byOwner` n'est pas possible sans Supabase : tester donc la
fonction pure d'assemblage extraite à l'étape 3.

```js
function testRosterPlayerKeepsCharacters(hooks){
  const player = plain(hooks.rosterPlayerFrom(
    "owner-1",
    "Yannis",
    [{ charId:"meliodas", potentialTier:7, builds:{ "Hache":{ weapon:"x.webp" } } }]
  ));
  assert.strictEqual(player.name, "Yannis");
  assert.ok(player.dps.length > 0, "Les entrées DPS restent calculées");
  assert.deepStrictEqual(
    player.characters.map(c => c.charId),
    ["meliodas"],
    "Les personnages normalisés sont conservés pour la modale"
  );
}
```

- [ ] **Étape 2 : voir échouer**

```bash
node tests/potentiel-commun.test.js
```

Attendu : `hooks.rosterPlayerFrom is not a function`.

- [ ] **Étape 3 : extraire l'assemblage et l'exposer**

Dans `index.html`, juste avant `rosterDerivedPlayers` :

```js
  /* Assemblage d'un joueur de l'analyse. `characters` conserve les rosters
     normalises deja calcules : la modale de detail doit pouvoir s'ouvrir sans
     relire le reseau. */
  function rosterPlayerFrom(owner, name, entries){
    return {
      owner,
      name,
      characters:entries,
      dps:entries.reduce((acc, e) => acc.concat(dpsEntriesFromRoster(e)), [])
    };
  }
```

Puis, dans `rosterDerivedPlayers`, remplacer le `return Object.keys(byOwner).map(...)`
par un appel à `rosterPlayerFrom(owner, nameOf(owner), byOwner[owner])`, en
conservant le `.filter(p => p.dps.length)` existant.

Ajouter `rosterPlayerFrom` à `HOOK_EXPORT`.

- [ ] **Étape 4 : voir passer, prouver la morsure**

Retirer `characters:entries` du retour : `testRosterPlayerKeepsCharacters` doit
échouer. Rétablir.

- [ ] **Étape 5 : commit**

```bash
git add index.html tests/helpers/load-app.js tests/potentiel-commun.test.js
git commit -m "feat: conserver les rosters normalises pour l'analyse

Ils etaient calcules puis jetes. Sans eux, ouvrir un equipement depuis
l'Analyse imposerait une relecture reseau au clic."
```

---

### Tâche 3 : point d'entrée explicite de la modale

**Fichiers :**
- Modifier : `index.html` (`openRosterDetail`, `renderRosterDetail`,
  `rosterDetailWeaponSwitch`, ~7200-7300)

**Interfaces produites :**
- `openRosterDetailFor(context)` — voir §4.3 de la spec.
- `openRosterDetail(index)` — comportement inchangé pour ses appelants.

- [ ] **Étape 1 : lire l'existant avant de toucher**

```bash
grep -n "rosterDetail = \|function renderRosterDetail" -A 30 index.html
grep -n "function rosterDetailWeaponSwitch" -A 25 index.html
grep -n "rosterDetailPrev\|rosterDetailNext" index.html
```

Relever la forme exacte de l'état `rosterDetail` et comment
`rosterDetailWeaponSwitch(entry)` construit ses badges d'arme.

- [ ] **Étape 2 : étendre l'état et le point d'entrée**

`rosterDetail` gagne trois champs : `weaponTypes` (enums autorisés ou `null`),
`showNavigation` (booléen) et `returnFocusKey`.

```js
  function openRosterDetailFor(context){
    if(!context || !Array.isArray(context.entries) || !context.entries.length){
      return;
    }
    rosterDetail.entries = context.entries;
    rosterDetail.index = Math.min(
      Math.max(context.index || 0, 0), context.entries.length - 1
    );
    rosterDetail.type = context.weaponType || null;
    rosterDetail.owner = context.memberName || rosterDetailOwnerLabel();
    rosterDetail.weaponTypes = context.weaponTypes || null;
    rosterDetail.showNavigation = context.showNavigation !== false;
    rosterDetail.returnFocusKey = context.returnFocusKey || null;
    renderRosterDetail();
    ModalStack.open($("#rosterDetailOverlay"), "#rosterDetailClose", closeRosterDetail);
  }

  function openRosterDetail(index){
    if(!memberRosterVisible.length) return;
    openRosterDetailFor({
      entries:memberRosterVisible,
      index,
      memberName:rosterDetailOwnerLabel(),
      weaponTypes:null,
      weaponType:null,
      showNavigation:true,
      returnFocusKey:null
    });
  }
```

- [ ] **Étape 3 : masquer la navigation et filtrer les armes**

Dans `renderRosterDetail()`, avant le calcul `prev.disabled` / `next.disabled` :

```js
    const nav = $("#rosterDetailPrev").parentElement;
    if(nav) nav.hidden = !rosterDetail.showNavigation;
```

Vérifier que `#rosterDetailPrev` et `#rosterDetailNext` partagent bien un
conteneur ; sinon masquer les deux boutons individuellement. **Masquer, pas
désactiver** : un contrôle inerte visible est une promesse non tenue.

Faire filtrer les badges d'arme par `rosterDetail.weaponTypes` : quand il vaut
`null`, comportement actuel ; sinon ne proposer que ces enums, et n'afficher
aucun sélecteur s'il n'en reste qu'un.

- [ ] **Étape 4 : restituer le focus malgré Realtime**

Dans `closeRosterDetail()`, après la fermeture, appliquer la cascade de la
spec §4.5 : le nœud d'origine s'il est encore dans le document, sinon la ligne
portant `{owner, char, element}`, sinon un repli logique de l'onglet Analyse.

- [ ] **Étape 5 : vérifier la non-régression du Roster**

```bash
node tests/supabase-etape1.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Attendu : les deux passent **sans modification**. Ils couvrent l'ouverture
existante depuis le Roster.

- [ ] **Étape 6 : commit**

```bash
git add index.html
git commit -m "feat: ouvrir le detail du roster depuis un contexte explicite

openRosterDetail etait indexe sur la liste du roster affichee. L'Analyse
n'a pas cette liste : le contexte porte desormais ses entrees, son index
et la visibilite de la navigation, et l'ancien point d'entree en devient
un adaptateur."
```

---

### Tâche 4 : lignes cliquables dans le classement

**Fichiers :**
- Modifier : `index.html` (`renderRankTable`, ~9471)
- Test : `tests/accessibilite-mobile.playwright.js`

- [ ] **Étape 1 : rendre la ligne actionnable**

Dans `renderRankTable()`, l'entrée poussée porte désormais le joueur complet :

```js
    analysePlayers.forEach(p=>(p.dps||[]).forEach(d=>{
      if(dpsElem(d)===analyseElem){
        entries.push({ player:p.name, owner:p.owner, characters:p.characters, dps:d });
      }
    }));
```

Chaque ligne devient un `<button>` — pas une `<div>` avec `onclick` : le rôle,
la tabulation et l'activation clavier viennent alors du navigateur. Elle porte
`dataset` `{owner, char, elem}` pour permettre la restitution du focus après
une reconstruction Realtime.

Au clic :

```js
        const entry = (en.characters||[]).find(c => c.charId === en.dps.char);
        if(!entry) return;
        openRosterDetailFor({
          entries:[entry],
          index:0,
          memberName:en.player,
          weaponTypes:en.dps.weaponTypes,
          weaponType:en.dps.preferredWeaponType,
          showNavigation:false,
          returnFocusKey:{ owner:en.owner, char:en.dps.char, element:analyseElem }
        });
```

- [ ] **Étape 2 : style et cible tactile**

La ligne-bouton conserve l'apparence actuelle de `.rank-row` : `appearance:none`,
fond et bordure hérités, `width:100%`, `text-align:left`, `min-height:44px`,
plus un état `:focus-visible` visible.

- [ ] **Étape 3 : test Playwright**

Ajouter dans `tests/accessibilite-mobile.playwright.js`, sur le motif de la
boucle 320/390 px existante (~1146) : ouvrir l'Analyse, activer une ligne **au
clavier**, vérifier que la modale s'ouvre, la fermer par Échap, vérifier que le
focus revient sur la ligne, et qu'aucun débordement horizontal n'apparaît.

- [ ] **Étape 4 : suite complète et commit**

```bash
npm test
git add index.html tests/accessibilite-mobile.playwright.js
git commit -m "feat: consulter l'equipement d'un membre depuis l'Analyse

Le classement ne menait nulle part. Chaque ligne devient un bouton qui
ouvre le detail du roster en lecture seule, sur le bon build, sans aucune
lecture reseau."
```

---

### Tâche 5 : retrait du Recensement DPS

**Fichiers :**
- Modifier : `index.html`, `tests/accessibilite-mobile.playwright.js`,
  `AGENTS.md`

- [ ] **Étape 1 : inventorier avant de supprimer**

```bash
grep -n "recensement\|Recensement\|cloudRec\|LocalRec\|recPlayersForView" index.html
```

Supprimer **seulement** ce que cet inventaire montre comme inutilisé ailleurs.
Chaque suppression de fonction ou de CSS est précédée d'une recherche de ses
appelants. Ne rien supprimer par présomption.

- [ ] **Étape 2 : supprimer**

L'onglet `tab-recensement`, la vue `view-recensement`, `renderRecensement()`,
son routage, ses rafraîchissements Realtime, `cloudRecCache`,
`saveCloudRecCache()`, `readRecCache()`, `recPlayersForView()`, le repli
`LocalRec`, `localPlayerForMigration`, le CSS devenu mort, et les textes
frontend qui mentionnent encore le recensement — notamment le message
d'authentification.

**Ne pas supprimer** les clés `localStorage` existantes : seul le code qui les
lit disparaît.

- [ ] **Étape 3 : mettre à jour les tests et la doc**

Retirer `"recensement"` de la liste d'onglets de
`tests/accessibilite-mobile.playwright.js` (~1193). Mettre à jour `AGENTS.md`
pour décrire l'Analyse comme unique vue DPS, en indiquant que la table
Supabase est conservée sans être lue.

- [ ] **Étape 4 : test de fin, ciblé**

Ajouter une assertion vérifiant l'absence des **points d'accroche frontend**,
et non un `grep` global qui frapperait `AGENTS.md` et `schema.sql` conservés :
aucun `tab-recensement`, aucun `view-recensement`, aucune fonction
`renderRecensement` / `recPlayersForView` / `saveCloudRecCache` / `readRecCache`,
aucun `from("recensement")` dans `index.html`.

- [ ] **Étape 5 : vérifier que le schéma est intact**

```bash
git diff --stat supabase/schema.sql
```

Attendu : **aucune sortie**.

- [ ] **Étape 6 : suite complète et commit**

```bash
npm test
git diff --check
git add index.html tests/accessibilite-mobile.playwright.js AGENTS.md
git commit -m "refactor: retirer le Recensement DPS devenu doublon

L'Analyse derive du roster et n'a jamais lu la table recensement, que
seule sa propre vue consommait. Le frontend disparait ; la table, ses
donnees et les cles localStorage sont conservees, une suppression SQL
eventuelle fera l'objet d'une migration separee."
```

---

## Vérification manuelle avant fusion

- [ ] Meliodas apparaît une seule fois en Ténèbres, sa modale propose trois armes.
- [ ] Un personnage à une seule arme DPS ouvre son build sans sélecteur.
- [ ] Gowther P7 ouvre sa Baguette et rien d'autre.
- [ ] Aucun SR nulle part dans les trois sections de l'Analyse.
- [ ] À 320 px : aucun débordement, cibles de 44 px, focus rendu à la ligne.
- [ ] L'onglet Recensement a disparu et aucun autre onglet n'est cassé.
