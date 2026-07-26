# Roster Favori et Copie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de marquer un build favori par personnage et de copier ses armures, bijoux et sa note vers un autre type d'arme compatible.

**Architecture:** Le favori reste un booléen dans chaque objet du JSON `builds`, ce qui évite toute migration Supabase. Trois fonctions pures normalisent l'unicité, basculent le favori et produisent une copie indépendante ; l'éditeur du roster ne fait qu'orchestrer ces fonctions.

**Tech Stack:** JavaScript inline, JSONB Supabase existant, Node.js `assert`, Playwright.

## Global Constraints

- Un seul build modifiable par type d'arme.
- Un seul favori maximum par personnage.
- Aucun favori possible sur un build absent.
- La copie ne transfère jamais l'arme source ni le statut favori.
- Une arme de destination existante est conservée.
- La destination reçoit des clones indépendants des armures et bijoux.
- Aucun changement de table Supabase et aucune nouvelle dépendance.

## File Structure

- `index.html` : modèle normalisé, fonctions pures et actions de l'éditeur.
- `tests/potentiel-commun.test.js` : contrats de migration, unicité et copie.
- `tests/supabase-etape1.playwright.js` : parcours utilisateur favori/copie/persistance.
- `AGENTS.md` : forme mise à jour du JSON `builds`.

## Visual Direction

- Sujet : équipement de prédilection inscrit dans un registre de guilde.
- Palette : étoile en or `#d9a441`/`#f0c674`, texte parchemin `#e8e0d0`,
  panneaux obsidienne existants.
- Typographie : Cinzel uniquement pour la hiérarchie actuelle ; actions et
  libellés restent dans la police UI.
- Signature : l'étoile est intégrée au sceau du type d'arme favori, visible dans
  l'onglet et sur la carte sans ajouter un panneau décoratif.
- Auto-critique : une seule étoile fonctionnelle remplace toute décoration
  supplémentaire ; les autres contrôles restent visuellement calmes.

---

### Task 1: Étendre le modèle du roster avec un favori unique

**Files:**
- Modify: `tests/potentiel-commun.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: un `rosterCharacter` et ses `builds`.
- Produces: `favoriteRosterWeaponType(entry): string|null` et des builds normalisés avec `favorite:boolean`.

- [ ] **Step 1: Exposer les futures fonctions dans le chargeur de test**

Ajouter dans la chaîne `Object.assign(globalThis.__hooks, {...})` :

```js
favoriteRosterWeaponType,setFavoriteRosterBuild,copyFavoriteRosterBuild
```

Le chargement doit échouer tant que les fonctions n'existent pas ; ajouter les
tests dans l'étape suivante avant de relancer.

- [ ] **Step 2: Écrire les tests en échec de normalisation**

Ajouter après les tests actuels du roster :

```js
{
  const { hooks } = loadApp();
  const legacy = plain(hooks.normalizeRosterCharacter({
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{ Hache:{ note:"Ancien build" } }
  }));
  assert.equal(legacy.builds.Hache.favorite, false);
  assert.equal(hooks.favoriteRosterWeaponType(legacy), null);

  const duplicated = plain(hooks.normalizeRosterCharacter({
    owner:"user-1",
    charId:"meliodas",
    potentialTier:7,
    builds:{
      Hache:{ favorite:true },
      "Epee 1 main":{ favorite:true }
    }
  }));
  assert.equal(duplicated.builds.Hache.favorite, true);
  assert.equal(duplicated.builds["Epee 1 main"].favorite, false);
  assert.equal(hooks.favoriteRosterWeaponType(duplicated), "Hache");
}
```

Le changement de production qui doit faire échouer ce test est l'absence de
normalisation du champ `favorite` et de la fonction de résolution.

- [ ] **Step 3: Vérifier le RED**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL car `favoriteRosterWeaponType` n'existe pas.

- [ ] **Step 4: Implémenter la normalisation minimale**

Modifier `emptyRosterBuild()` :

```js
  const emptyRosterBuild = () => ({
    weapon:null,
    armor:emptyArmor(),
    jewel:emptyJewel(),
    note:"",
    favorite:false
  });
```

Ajouter à la valeur renvoyée par `normalizeRosterBuild()` :

```js
      favorite:source.favorite === true
```

Normaliser l'unicité dans `normalizeRosterCharacter()` :

```js
    let favoriteFound = false;
    const builds = allowed.reduce((result, weaponType)=>{
      if(Object.prototype.hasOwnProperty.call(sourceBuilds, weaponType)){
        const build = normalizeRosterBuild(
          charId,
          weaponType,
          sourceBuilds[weaponType]
        );
        if(build.favorite){
          if(favoriteFound) build.favorite = false;
          else favoriteFound = true;
        }
        result[weaponType] = build;
      }
      return result;
    }, {});
```

Ajouter :

```js
  function favoriteRosterWeaponType(entry){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized) return null;
    return Object.keys(normalized.builds)
      .find(type => normalized.builds[type].favorite) || null;
  }
```

- [ ] **Step 5: Vérifier le GREEN**

Run: `node tests/potentiel-commun.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/potentiel-commun.test.js
git commit -m "feat: normalize one favorite roster build"
```

---

### Task 2: Basculer le favori et copier son équipement

**Files:**
- Modify: `tests/potentiel-commun.test.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `setFavoriteRosterBuild(entry, weaponType)` et `copyFavoriteRosterBuild(entry, targetWeaponType)`.
- Produces: une nouvelle fiche normalisée ; `null` lorsque la demande de copie est invalide.

- [ ] **Step 1: Écrire les tests en échec du basculement**

Ajouter :

```js
{
  const { hooks } = loadApp();
  const original = {
    owner:"user-1",
    charId:"meliodas",
    potentialTier:8,
    builds:{
      Hache:{
        weapon:"7ds-armes/Hache/hache.webp",
        armor:{ Haut:"haut.webp" },
        jewel:{ Anneau:"anneau.webp" },
        note:"Favori",
        favorite:true
      },
      "Epee 1 main":{
        weapon:"7ds-armes/Epee 1 main/epee.webp",
        armor:{ Haut:"ancien.webp" },
        jewel:{ Anneau:"ancien-anneau.webp" },
        note:"Destination",
        favorite:false
      }
    }
  };

  const switched = plain(hooks.setFavoriteRosterBuild(
    original,
    "Epee 1 main"
  ));
  assert.equal(switched.builds.Hache.favorite, false);
  assert.equal(switched.builds["Epee 1 main"].favorite, true);
  assert.equal(hooks.favoriteRosterWeaponType(switched), "Epee 1 main");

  const removed = plain(hooks.setFavoriteRosterBuild(
    switched,
    "Epee 1 main"
  ));
  assert.equal(hooks.favoriteRosterWeaponType(removed), null);
  assert.equal(removed.builds["Epee 1 main"].weapon,
    "7ds-armes/Epee 1 main/epee.webp");

  assert.equal(hooks.setFavoriteRosterBuild(original, "Epees doubles"), null);
}
```

Le dernier cas est invalide parce que le build `Epees doubles` n'est pas
enregistré, même si le type est compatible.

- [ ] **Step 2: Écrire les tests en échec de la copie**

Dans le même bloc :

```js
  const copied = plain(hooks.copyFavoriteRosterBuild(
    original,
    "Epee 1 main"
  ));
  const source = copied.builds.Hache;
  const target = copied.builds["Epee 1 main"];
  assert.equal(target.weapon, "7ds-armes/Epee 1 main/epee.webp");
  assert.deepStrictEqual(target.armor, source.armor);
  assert.deepStrictEqual(target.jewel, source.jewel);
  assert.equal(target.note, "Favori");
  assert.equal(target.favorite, false);
  assert.equal(source.favorite, true);

  target.armor.Haut = "copie-modifiee.webp";
  target.jewel.Anneau = "copie-modifiee.webp";
  assert.equal(source.armor.Haut, "haut.webp");
  assert.equal(source.jewel.Anneau, "anneau.webp");

  const newTarget = plain(hooks.copyFavoriteRosterBuild(
    original,
    "Epees doubles"
  ));
  assert.equal(newTarget.builds["Epees doubles"].weapon, null);
  assert.equal(newTarget.builds["Epees doubles"].note, "Favori");

  assert.equal(hooks.copyFavoriteRosterBuild(original, "Hache"), null);
  assert.equal(hooks.copyFavoriteRosterBuild({
    charId:"meliodas",
    builds:{ Hache:{ favorite:false } }
  }, "Epee 1 main"), null);
}
```

- [ ] **Step 3: Vérifier le RED**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL car les deux fonctions pures n'existent pas.

- [ ] **Step 4: Implémenter les fonctions**

Ajouter après `favoriteRosterWeaponType()` :

```js
  function setFavoriteRosterBuild(entry, weaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized ||
      !Object.prototype.hasOwnProperty.call(normalized.builds, weaponType)){
      return null;
    }
    const wasFavorite = normalized.builds[weaponType].favorite;
    Object.values(normalized.builds)
      .forEach(build => { build.favorite = false; });
    normalized.builds[weaponType].favorite = !wasFavorite;
    return normalized;
  }

  function copyFavoriteRosterBuild(entry, targetWeaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized || !weaponTypesOf(normalized.charId).includes(targetWeaponType)){
      return null;
    }
    const sourceType = favoriteRosterWeaponType(normalized);
    if(!sourceType || sourceType === targetWeaponType) return null;
    const source = normalized.builds[sourceType];
    const target = normalized.builds[targetWeaponType] || emptyRosterBuild();
    normalized.builds[targetWeaponType] = {
      weapon:target.weapon,
      armor:JSON.parse(JSON.stringify(source.armor)),
      jewel:JSON.parse(JSON.stringify(source.jewel)),
      note:source.note,
      favorite:false
    };
    return normalizeRosterCharacter(normalized);
  }
```

- [ ] **Step 5: Vérifier le GREEN**

Run: `node tests/potentiel-commun.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/potentiel-commun.test.js
git commit -m "feat: copy favorite roster equipment"
```

---

### Task 3: Ajouter les actions à l'éditeur du roster

**Files:**
- Modify: `tests/supabase-etape1.playwright.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: fonctions pures de la Task 2 et `memberRosterDraft`.
- Produces: boutons `.member-roster-favorite` et `.member-roster-copy-favorite`.

- [ ] **Step 1: Enrichir la fixture du roster**

Dans le build Hache de Meliodas du faux Supabase, ajouter un équipement visible
et le favori :

```js
            Hache:{
              weapon:"7ds-armes/Hache/Hache à l'aura triomphale.webp",
              armor:{ Haut:"7ds-armures-ssr/Haut/Haut de la mélodie d'Arachnée.webp" },
              jewel:{ Anneau:"7ds-bijoux/Anneau/Anneau de la mélodie d'Arachnée.webp" },
              note:"Mon build",
              favorite:true
            },
            "Epee 1 main":{
              weapon:"7ds-armes/Epee 1 main/En plein cœur !.webp",
              armor:{},
              jewel:{},
              note:"",
              favorite:false
            }
```

- [ ] **Step 2: Écrire le parcours UI en échec**

Après l'ouverture de l'éditeur Meliodas :

```js
    assert.equal(
      await page.locator(".member-roster-weapon-tabs .chip.active").textContent(),
      "Hache ✓ ★"
    );
    const favoriteButton = page.locator(".member-roster-favorite");
    assert.equal(await favoriteButton.getAttribute("aria-pressed"), "true");

    await page.getByRole("button", { name:/Epee 1 main/ }).click();
    const copyButton = page.locator(".member-roster-copy-favorite");
    await copyButton.waitFor();
    page.once("dialog", dialog => dialog.accept());
    await copyButton.click();

    const copiedDraft = await page.evaluate(() => {
      const editor = document.querySelector("#memberRosterEditor");
      return {
        note:editor.querySelector("textarea").value,
        favorite:editor.querySelector(".member-roster-favorite")
          .getAttribute("aria-pressed")
      };
    });
    assert.equal(copiedDraft.note, "Mon build");
    assert.equal(copiedDraft.favorite, "false");

    await page.locator("#memberRosterSave").click();
    await page.waitForFunction(() => {
      const row = window.__fakeSupabaseState.roster_characters
        .find(item => item.owner === "user-1" && item.char_id === "meliodas");
      const target = row && row.builds["Epee 1 main"];
      return target &&
        target.weapon === "7ds-armes/Epee 1 main/En plein cœur !.webp" &&
        target.note === "Mon build" &&
        target.favorite === false &&
        row.builds.Hache.favorite === true;
    });
    assert.match(
      await page.locator("#memberRosterGrid .member-roster-card")
        .filter({hasText:"Meliodas"}).textContent(),
      /★ favori/
    );
    assert.match(
      await page.locator("#memberRosterGrid .member-roster-card")
        .filter({hasText:"Meliodas"})
        .locator(".member-roster-build-tag")
        .filter({hasText:"favori"})
        .getAttribute("aria-label"),
      /build favori/i
    );
```

Ajouter ensuite le test d'annulation :

```js
    await page.locator("#memberRosterGrid .member-roster-card")
      .filter({hasText:"Meliodas"})
      .locator(".member-roster-edit")
      .click();
    await page.getByRole("button", { name:/Epee 1 main/ }).click();
    const destinationNote = page.locator("#memberRosterEditor textarea");
    await destinationNote.fill("Ne pas écraser");
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator(".member-roster-copy-favorite").click();
    assert.equal(await destinationNote.inputValue(), "Ne pas écraser");
    await page.locator("#memberRosterClose").click();
```

- [ ] **Step 3: Vérifier le RED**

Run: `node tests/supabase-etape1.playwright.js`

Expected: FAIL car l'éditeur ne sélectionne pas le favori et les boutons
n'existent pas.

- [ ] **Step 4: Sélectionner et signaler le favori**

Dans `openMemberRosterEditor(entry)` :

```js
    memberRosterWeaponType = favoriteRosterWeaponType(normalized)
      || weaponTypesOf(normalized.charId)[0]
      || "";
```

Dans les libellés des onglets :

```js
      text:rosterWeaponLabel(type)
        +(Object.prototype.hasOwnProperty.call(memberRosterDraft.builds, type) ? " ✓" : "")
        +(memberRosterDraft.builds[type] && memberRosterDraft.builds[type].favorite ? " ★" : ""),
```

Dans `memberRosterCard(entry, editable)`, ajouter ` ★ favori` au tag dont le
build possède `favorite:true`, et un `aria-label` explicite.

- [ ] **Step 5: Ajouter les actions de l'éditeur**

Dans `renderMemberRosterEditor()`, calculer :

```js
    const favoriteType = favoriteRosterWeaponType(memberRosterDraft);
```

Pour un build existant, ajouter avant le bouton de suppression :

```js
      noteColumn.appendChild(el("button",{
        class:"btn member-roster-favorite",
        type:"button",
        "aria-pressed":String(build.favorite),
        text:build.favorite ? "★ Build favori" : "☆ Définir comme favori",
        onclick:()=>{
          memberRosterDraft = setFavoriteRosterBuild(
            memberRosterDraft,
            memberRosterWeaponType
          );
          renderMemberRosterEditor();
        }
      }));
```

Lorsque `favoriteType` existe et diffère de l'onglet courant :

```js
      noteColumn.appendChild(el("button",{
        class:"btn member-roster-copy-favorite",
        type:"button",
        text:"Copier le favori ici",
        onclick:()=>{
          if(hasBuild && !confirm(
            "Remplacer les armures, bijoux et la note de ce build ? "+
            "Son arme sera conservée."
          )) return;
          const copied = copyFavoriteRosterBuild(
            memberRosterDraft,
            memberRosterWeaponType
          );
          if(copied) memberRosterDraft = copied;
          renderMemberRosterEditor();
        }
      }));
```

- [ ] **Step 6: Vérifier le GREEN**

Run: `node tests/supabase-etape1.playwright.js`

Expected: PASS.

- [ ] **Step 7: Vérifier la suite unitaire**

Run: `npm run test:unit`

Expected: toutes les suites unitaires passent.

- [ ] **Step 8: Commit**

```bash
git add index.html tests/supabase-etape1.playwright.js
git commit -m "feat: manage favorite builds in roster editor"
```

---

### Task 4: Documenter et vérifier le format

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: modèle favori terminé.
- Produces: documentation exacte du JSON partagé.

- [ ] **Step 1: Mettre à jour l'exemple du roster**

Ajouter `favorite: true|false` à l'objet de build dans `AGENTS.md`, puis
documenter :

```markdown
Chaque personnage possède au maximum un build favori. Le champ `favorite` est
stocké dans l'objet du type d'arme ; les anciens builds sont normalisés à
`false`. La copie du favori transfère armures, bijoux et note, conserve l'arme
de destination et ne crée jamais un second favori.
```

- [ ] **Step 2: Exécuter la suite complète**

Run: `npm test`

Expected: toutes les suites passent.

- [ ] **Step 3: Vérifier le diff**

Run: `git diff --check`

Expected: aucune sortie et code de retour 0.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: describe favorite roster builds"
```
