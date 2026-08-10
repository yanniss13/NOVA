# Souverain cupide dans le calculateur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simuler localement les trois etats temporaires de Souverain cupide et injecter leurs bonus dans toutes les competences du calculateur.

**Architecture:** Une table manuelle ne contient que les deux paliers publies de `equip_t5_greed`, avec une provenance textuelle par valeur. Un module pur selectionne le meilleur palier actif et son etat exclusif. La vue calcule les ensembles deja equipes, rend le selecteur et transmet les lignes actives aux entrees de degats, pour la reference comme pour l'essai d'enchantements.

**Tech Stack:** JavaScript ES modules, scripts de donnees classiques, Node `assert`, VM de `tests/helpers/load-app.js`, Playwright et Chromium.

## Global Constraints

- Ne modifier aucun roster, equipe, collection ou disponibilite ; les parcours navigateur utilisent exclusivement `confrerie7ds.teams`.
- Ne jamais modifier `data/stats-build.js`, `data/competences.js`, `data/wiki-competences.js` ou `data/potentiels.js`.
- N'utiliser que les codes publies par `SEVEN_DS_BUILD_STATS.statLabels` : `C_Critical_Rate` et `D_Protect_Cur_Rate`.
- Stocker les pourcentages en dix-milliemes : 300 = 3 %, 1200 = 12 %.
- Garder les modules `js/metier/` purs ; commentaires de code francais sans accents et fichiers preserves en UTF-8/CRLF.
- Les nouveaux chiffres manuels ont une ancre qui apparait exactement une fois dans le texte du set et un test qui lit le nombre immediatement apres cette ancre.
- A sept pieces, le palier sept remplace le palier cinq--six : les buffs temporaires des deux paliers ne s'additionnent jamais.

---

### Task 1: Figer les chiffres publies dans une table testee

**Files:**
- Create: `data/passifs-ensembles.js`
- Create: `tests/passifs-ensembles.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces `window.SEVEN_DS_PASSIFS_ENSEMBLES.equip_t5_greed` avec `{ nom, paliers }`.
- Chaque palier est `{ seuil, tier, etats }`; `etats[0]` est vide, `etats[1]` est apres une releve et `etats[2]` apres deux releves.
- Chaque ligne est `{ stat, valeur, porteur:"hero", provenance:{ phrase } }`.

- [ ] **Step 1: Ecrire le test de table en echec**

  Creer `tests/passifs-ensembles.test.js`. Charger la vraie table et le vrai
  `stats-build.js` avec `vm`, nettoyer les balises `[...]`, puis definir :

  ```js
  function nombreApres(texte, phrase, quoi){
    const morceaux = texte.split(phrase);
    assert.equal(morceaux.length, 2, quoi + " : ancre non unique.");
    const trouve = /^(\\d+(?:\\.\\d+)?)%/.exec(morceaux[1]);
    assert.ok(trouve, quoi + " : pourcentage absent.");
    return Number(trouve[1]) * 100;
  }
  ```

  Verifier les deux paliers : `seuil:5`, `tier:"four"`, puis `seuil:7`,
  `tier:"seven"`; verifier les etats vides, puis respectivement
  `C_Critical_Rate:300`, `C_Critical_Rate:700` +
  `D_Protect_Cur_Rate:700`, et `C_Critical_Rate:600`,
  `C_Critical_Rate:1200` + `D_Protect_Cur_Rate:1200`.
  Pour chaque ligne, verifier `BUILD.statLabels[ligne.stat]` et lire sa
  valeur depuis `BUILD.gearSets.equip_t5_greed[tier + "TextFr"]` avec la
  phrase de provenance.

  Ajouter `node tests/passifs-ensembles.test.js` juste apres
  `tests/passifs-armes.test.js` dans `test:unit`.

- [ ] **Step 2: Constater l'echec**

  Run: `node tests/passifs-ensembles.test.js`

  Expected: FAIL avec `ENOENT` ou une table `SEVEN_DS_PASSIFS_ENSEMBLES`
  absente.

- [ ] **Step 3: Ajouter la table minimale**

  Creer `data/passifs-ensembles.js` avec uniquement :

  ```js
  window.SEVEN_DS_PASSIFS_ENSEMBLES = {
    equip_t5_greed:{
      nom:"Souverain cupide",
      paliers:[
        { seuil:5, tier:"four", etats:[
          [],
          [{ stat:"C_Critical_Rate", valeur:300, porteur:"hero",
            provenance:{ phrase:"L'utilisation de la competence de releve augmente les chances crit. de " } }],
          [
            { stat:"C_Critical_Rate", valeur:700, porteur:"hero",
              provenance:{ phrase:"L'utilisation de la competence de releve alors que cet effet est actif le remplace par un effet qui augmente les chances crit. de " } },
            { stat:"D_Protect_Cur_Rate", valeur:700, porteur:"hero",
              provenance:{ phrase:"et le percement de defense de " } }
          ]
        ]},
        { seuil:7, tier:"seven", etats:[
          [],
          [{ stat:"C_Critical_Rate", valeur:600, porteur:"hero",
            provenance:{ phrase:"L'utilisation de la competence de releve augmente les chances crit. de " } }],
          [
            { stat:"C_Critical_Rate", valeur:1200, porteur:"hero",
              provenance:{ phrase:"L'utilisation de la competence de releve alors que cet effet est actif le remplace par un effet qui augmente les chances crit. de " } },
            { stat:"D_Protect_Cur_Rate", valeur:1200, porteur:"hero",
              provenance:{ phrase:"et le percement de defense de " } }
          ]
        ]}
      ]
    }
  };
  ```

  Employer les phrases nettoyees exactement telles qu'elles apparaissent dans
  chaque `TextFr`, avec les accents reels dans les chaines. Aucun autre set,
  chiffre ou code de stat ne doit etre ajoute.

- [ ] **Step 4: Verifier le test et ses dents**

  Run: `node tests/passifs-ensembles.test.js`

  Expected: PASS.

  Remplacer temporairement `1200` par `1100` dans le palier sept, relancer la
  commande et constater FAIL sur la valeur ancree; restaurer `1200`, relancer
  et constater PASS.

- [ ] **Step 5: Commit**

  ```powershell
  git add data/passifs-ensembles.js tests/passifs-ensembles.test.js package.json
  git commit -m "feat: ancrer les buffs de Souverain cupide"
  ```

### Task 2: Resoudre le meilleur palier et l'etat exclusif dans un module pur

**Files:**
- Create: `js/metier/passifs-ensembles.js`
- Create: `tests/passifs-ensembles-metier.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes `window.SEVEN_DS_PASSIFS_ENSEMBLES` et une liste d'ensembles actifs
  de forme `[{ setId, count }]`.
- Produces `passifEnsembleApplicable({ ensembles, etats, setId })`, qui renvoie
  `{ setId, nom, seuil, tier, etat, lignes }` ou `null`.
- `etats` est un dictionnaire local `{ [setId]:0|1|2 }`; toute valeur invalide
  replie sur `0`.

- [ ] **Step 1: Ecrire le test pur en echec**

  Dans `tests/passifs-ensembles-metier.test.js`, charger le module sans DOM,
  lui fournir la vraie table, puis verifier :

  ```js
  assert.equal(resolve({ ensembles:[], etats:{}, setId:"equip_t5_greed" }), null);
  assert.equal(resolve({ ensembles:[{setId:"equip_t5_greed",count:5}],
    etats:{equip_t5_greed:1}, setId:"equip_t5_greed" }).lignes[0].valeur, 300);
  assert.equal(resolve({ ensembles:[{setId:"equip_t5_greed",count:6}],
    etats:{equip_t5_greed:2}, setId:"equip_t5_greed" }).lignes[1].valeur, 700);
  const sept = resolve({ ensembles:[{setId:"equip_t5_greed",count:7}],
    etats:{equip_t5_greed:2}, setId:"equip_t5_greed" });
  assert.equal(sept.tier, "seven");
  assert.deepEqual(sept.lignes.map(ligne => ligne.valeur), [1200, 1200]);
  ```

  Verifier aussi qu'un etat `99` rend `lignes:[]`, et que les lignes retournees
  sont des copies : muter la sortie ne modifie pas la table.

- [ ] **Step 2: Constater l'echec**

  Run: `node tests/passifs-ensembles-metier.test.js`

  Expected: FAIL car `passifEnsembleApplicable` n'existe pas.

- [ ] **Step 3: Implementer la selection sans cumul**

  Creer `js/metier/passifs-ensembles.js` :

  ```js
  function passifEnsembleApplicable({ ensembles, etats, setId } = {}){
    const table = (window.SEVEN_DS_PASSIFS_ENSEMBLES || {})[setId];
    const actif = (ensembles || []).find(item => item && item.setId === setId);
    if(!table || !actif) return null;
    const palier = table.paliers.filter(item => actif.count >= item.seuil).at(-1);
    if(!palier) return null;
    const etatLu = Number((etats || {})[setId]);
    const etat = etatLu >= 0 && etatLu <= 2 ? etatLu : 0;
    return { setId, nom:table.nom, seuil:palier.seuil, tier:palier.tier,
      etat, lignes:(palier.etats[etat] || []).map(ligne => Object.assign({}, ligne)) };
  }
  ```

  Exporter uniquement `passifEnsembleApplicable`.

- [ ] **Step 4: Verifier le module**

  Run: `node tests/passifs-ensembles-metier.test.js`

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```powershell
  git add js/metier/passifs-ensembles.js tests/passifs-ensembles-metier.test.js package.json
  git commit -m "feat: choisir le palier actif de Souverain cupide"
  ```

### Task 3: Injecter le scenario dans les entrees et le calculateur

**Files:**
- Modify: `js/metier/calculateur-entrees.js`
- Modify: `tests/calculateur-entrees.test.js`
- Modify: `js/vues/calculateur.js`
- Modify: `tests/calculateur.playwright.js`
- Modify: `tests/helpers/modules.js`
- Modify: `tests/helpers/load-app.js`
- Modify: `sw.js`

**Interfaces:**
- Consumes `passifEnsembleApplicable({ ensembles, etats, setId })` et
  `activeGearSets(files)`.
- `entreesDuCalcul({ statsDuBuild, buffsCoches })` reconnait une ligne
  `{ stat:"C_Critical_Rate", valeur, porteur:"hero" }` comme `critRate`,
  au lieu de `critRateAllie`.
- La vue conserve `etat.etatsEnsembles.equip_t5_greed` et transmet les lignes
  du scenario actif avec les autres lignes cochees.

- [ ] **Step 1: Ecrire les epreuves en echec**

  Dans `tests/calculateur-entrees.test.js`, ajouter :

  ```js
  const sortie = entreesDuCalcul({
    statsDuBuild:{ critRate:8500, percementDefense:0 },
    buffsCoches:[
      { stat:"C_Critical_Rate", valeur:1200, porteur:"hero" },
      { stat:"D_Protect_Cur_Rate", valeur:1200, porteur:"hero" }
    ]
  });
  assert.equal(sortie.critRate, 9700);
  assert.equal(sortie.critRateAllie, 0);
  assert.equal(sortie.percementDefense, 1200);
  ```

  Dans `tests/calculateur.playwright.js`, reutiliser l'equipe locale existante
  mais construire ses emplacements d'armure/bijoux avec les sept fichiers du
  catalogue dont `setId === "equip_t5_greed"`. Ouvrir le calculateur, verifier
  la carte et choisir successivement les valeurs `0`, `1`, `2` du selecteur
  `[data-set-passive="equip_t5_greed"]`. Verifier que l'etat 1 modifie
  l'Esperance par les chances crit., que l'etat 2 modifie aussi les degats via
  le percement, que le texte annonce le palier 7 et que le stockage
  `confrerie7ds.teams` est identique avant et apres les changements.

- [ ] **Step 2: Constater les echecs**

  Run: `node tests/calculateur-entrees.test.js; node tests/calculateur.playwright.js`

  Expected: le test unitaire echoue car `porteur:"hero"` rejoint encore
  `critRateAllie`; le parcours navigateur ne trouve pas la carte.

- [ ] **Step 3: Brancher la semantique et la vue**

  Dans `calculateur-entrees.js`, ajouter une table locale restreinte :

  ```js
  const CIBLE_DU_BUFF_PROPRE = {
    C_Critical_Rate:"critRate",
    D_Protect_Cur_Rate:"percementDefense"
  };
  ```

  Resoudre `CIBLE_DU_BUFF_PROPRE[buff.stat]` avant `CIBLE_DU_BUFF[buff.stat]`
  seulement lorsque `buff.porteur === "hero"`.

  Dans `calculateur.js`, importer `activeGearSets` et
  `passifEnsembleApplicable`. Construire la liste des fichiers d'armures et
  de bijoux equipes, appeler les deux fonctions avec `setId:"equip_t5_greed"`,
  puis rendre une carte seulement si le resultat n'est pas `null`. Le select
  porte `data-set-passive="equip_t5_greed"` et les options :

  ```js
  ["Aucun buff temporaire", "Apres une releve", "Apres deux releves"]
  ```

  Le changement ecrit seulement dans `etat.etatsEnsembles`, redessine, et le
  changement de build remet ce dictionnaire a `{}`. Ajouter
  `scenario.lignes` a `coches` avant les deux appels a `entreesDuCalcul`, et
  ajouter un au compteur de lignes actives lorsque `scenario.etat > 0`.
  Le meme tableau `coches` alimente la reference et l'essai, afin que le
  comparateur isole les enchantements.

  Enregistrer le nouveau module dans `tests/helpers/modules.js`; charger sa
  table reelle dans `tests/helpers/load-app.js`; ajouter les deux fichiers a
  `CORE_ASSETS` dans `sw.js`; et charger dynamiquement
  `./data/passifs-ensembles.js` avec les autres tables du calculateur.

- [ ] **Step 4: Verifier les boucles courtes**

  Run: `node tests/calculateur-entrees.test.js; node tests/passifs-ensembles-metier.test.js; node tests/calculateur.playwright.js`

  Expected: PASS; le parcours montre uniquement le palier 7 a sept pieces et
  ne modifie pas l'equipe locale.

- [ ] **Step 5: Commit**

  ```powershell
  git add js/metier/calculateur-entrees.js tests/calculateur-entrees.test.js js/vues/calculateur.js tests/calculateur.playwright.js tests/helpers/modules.js tests/helpers/load-app.js sw.js
  git commit -m "feat: simuler les releves de Souverain cupide"
  ```

### Task 4: Verifier l'ensemble du site et livrer

**Files:**
- Modify: aucun fichier attendu

**Interfaces:**
- Consumes tous les tests des trois taches precedentes.
- Produces une branche `main` propre et poussee.

- [ ] **Step 1: Lancer la verification complete**

  Run: `npm test`

  Expected: toutes les unites, verifications de generateurs et les onze
  parcours Playwright passent.

- [ ] **Step 2: Prouver la mutation restante**

  Remplacer temporairement `D_Protect_Cur_Rate` par `C_Critical_Rate` dans
  l'etat deux du palier sept, lancer `node tests/passifs-ensembles.test.js`,
  constater l'echec du code/provenance ou de la forme attendue, restaurer le
  code puis relancer et constater PASS.

- [ ] **Step 3: Inspecter une capture locale**

  Executer un harnais Playwright jetable hors depot, monter uniquement une
  equipe dans `confrerie7ds.teams`, choisir « Apres deux releves », capturer le
  calculateur et verifier visuellement la carte, le palier 7 et les ecarts de
  degats. Ne jamais ouvrir ni modifier Supabase.

- [ ] **Step 4: Verifier l'etat et pousser**

  ```powershell
  git status --short
  git push origin main
  ```

  Expected: aucun changement non suivi apres les commits et `main` est a jour
  sur le depot distant.
