# Recensement DPS Gowther Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exclure les Briseurs du recensement DPS, sauf Gowther avec un build Baguette enregistré et un potentiel commun supérieur ou égal à P7.

**Architecture:** La règle d'éligibilité sera isolée dans `isRosterBuildDps(entry, slot, weaponEnum)`, puis consommée par `dpsEntriesFromRoster(entry)`. Les données et le schéma Supabase restent inchangés : le calcul continue de dériver les DPS côté client depuis le roster existant.

**Tech Stack:** HTML/CSS/JavaScript autonome dans `index.html`, tests Node.js avec `assert` et `vm`.

## Global Constraints

- Un build `Attacker` est toujours recensé comme DPS.
- Un build `Buster` est exclu, sauf Gowther avec l'arme `Wand` (`Baguette`) à partir de P7.
- L'exception exige que le build `Baguette` soit présent dans `entry.builds`.
- Aucun changement de schéma Supabase ni de format de stockage.
- Interface en français et application sans nouvelle dépendance.

---

### Task 1: Filtrer les Briseurs et autoriser Gowther Baguette P7+

**Files:**
- Modify: `tests/potentiel-commun.test.js:122-145`
- Modify: `tests/potentiel-commun.test.js:433-458`
- Modify: `index.html:974`
- Modify: `index.html:1576-1595`

**Interfaces:**
- Consumes: `entry = { charId:string, potentialTier:number, builds:Record<string, object> }`, un slot de `META[charId].weapons`, et `FOLDER_TO_ENUM`.
- Produces: `isRosterBuildDps(entry, slot, weaponEnum): boolean`; `dpsEntriesFromRoster(entry): Array<{char:string, element:string, pot:number}>`.

- [ ] **Step 1: Écrire le test en échec qui retire un Briseur ordinaire**

Dans le bloc « Recensement auto » de `tests/potentiel-commun.test.js`, remplacer
l'attente de Merlin afin que son build `Livre` reste recensé et que son build
`Baton` Briseur disparaisse :

```js
  // merlin : Livre(Attaquant/Glace) est recensé, Bâton(Briseur/Feu) est exclu
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"merlin", potentialTier:9,
      builds:{ Livre:{}, Baton:{} } })),
    [{ char:"merlin", element:"ICE", pot:9 }]
  );
```

- [ ] **Step 2: Lancer le test et constater l'échec attendu**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL parce que le résultat réel contient encore
`{ char:"merlin", element:"FIRE", pot:9 }`.

- [ ] **Step 3: Écrire le minimum pour exclure les Briseurs ordinaires**

Dans `index.html`, ajouter la fonction d'éligibilité avant
`dpsEntriesFromRoster` et l'utiliser dans la boucle :

```js
  function isRosterBuildDps(entry, slot, weaponEnum){
    return slot.role === "Attacker";
  }
```

```js
      if(!isRosterBuildDps(entry, slot, en)) return;
```

- [ ] **Step 4: Relancer le test et vérifier le premier passage au vert**

Run: `node tests/potentiel-commun.test.js`

Expected: PASS.

- [ ] **Step 5: Écrire les tests en échec de l'exception Gowther**

Ajouter Gowther aux fixtures `SEVEN_DS_POTENTIELS` et `SEVEN_DS_META` :

```js
      gowther:{
        Baguette:["Bonus baguette T1"],
        Livre:["Bonus livre T1"],
        Baton:["Bonus bâton T1"]
      }
```

```js
      gowther:{ element:"THUNDER", role:"ATTACKER", rarity:"SSR", weapons:[
        { weapon:"Wand", role:"Buster", element:"Thunder" },
        { weapon:"Book", role:"Supporter", element:"Default" },
        { weapon:"Staff", role:"Supporter", element:"Thunder" }
      ]}
```

Puis ajouter au bloc « Recensement auto » :

```js
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:6,
      builds:{ Baguette:{} } })),
    []
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:7,
      builds:{ Baguette:{} } })),
    [{ char:"gowther", element:"THUNDER", pot:7 }]
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:10,
      builds:{ Baguette:{} } })),
    [{ char:"gowther", element:"THUNDER", pot:10 }]
  );
  assert.deepStrictEqual(
    plain(hooks.dpsEntriesFromRoster({ charId:"gowther", potentialTier:9,
      builds:{ Livre:{}, Baton:{} } })),
    []
  );
```

- [ ] **Step 6: Lancer le test et constater l'échec attendu**

Run: `node tests/potentiel-commun.test.js`

Expected: FAIL sur Gowther Baguette P7, car la première version de
`isRosterBuildDps` refuse encore tous les rôles `Buster`.

- [ ] **Step 7: Implémenter précisément l'exception Gowther**

Remplacer le corps de `isRosterBuildDps` par :

```js
  function isRosterBuildDps(entry, slot, weaponEnum){
    if(slot.role === "Attacker") return true;
    return slot.role === "Buster"
      && entry.charId === "gowther"
      && weaponEnum === "Wand"
      && (entry.potentialTier||0) >= 7;
  }
```

Mettre à jour le commentaire voisin pour préciser que les Attaquants sont
recensés et que Gowther Baguette P7+ constitue l'unique exception.

- [ ] **Step 8: Corriger le texte visible du recensement**

Dans `index.html`, remplacer le paragraphe introductif par :

```html
    <p class="section-lead">Calculé automatiquement à partir du <b>Roster</b> de chaque membre : chaque personnage avec un build Attaquant devient un DPS, avec son élément et son potentiel. Exception : Gowther avec une Baguette est recensé à partir de P7. Pour te recenser, remplis ton roster.</p>
```

- [ ] **Step 9: Vérifier le comportement ciblé et toute la suite unitaire**

Run: `node tests/potentiel-commun.test.js`

Expected: PASS.

Run: `npm run test:unit`

Expected: toutes les suites unitaires passent sans échec.

- [ ] **Step 10: Vérifier le diff et enregistrer l'implémentation**

Run: `git diff --check`

Expected: aucune sortie et code de retour 0.

```bash
git add index.html tests/potentiel-commun.test.js docs/superpowers/plans/2026-07-26-recensement-dps-gowther.md
git commit -m "fix: restrict Buster DPS to Gowther P7"
```
