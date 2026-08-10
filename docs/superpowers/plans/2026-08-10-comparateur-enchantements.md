# Comparateur local d'enchantements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comparer, competence par competence, le build enregistre a un essai local d'enchantements sur son arme et son armure gravee.

**Architecture:** Une couche metier copie et remplace uniquement les deux configurations essayables, puis la couche de calcul associe les resultats de reference et d'essai avec leurs ecarts. Le calculateur conserve cet essai en memoire, delegue sa saisie aux editeurs existants limites aux enchantements, et rend les ecarts sous les trois chiffres existants.

**Tech Stack:** JavaScript ES modules, moteur local de stats existant, DOM maison `el()`, Node `assert`, Playwright et Chromium.

## Global Constraints

- Modules `js/metier/` purs : ni DOM, ni reseau, ni roster ; toutes les donnees arrivent par argument.
- Ne jamais ecrire roster, equipes, collection, disponibilites, localStorage ou Supabase : l'essai appartient seulement a l'etat du calculateur.
- Ne pas modifier les fichiers generes, notamment `data/stats-build.js`, `data/competences.js`, `data/wiki-competences.js` et `data/potentiels.js`.
- Aucun code de statistique invente ; les listes et bornes viennent des validateurs et catalogues existants.
- Commentaires de code en francais sans accents ; textes affiches en francais avec accents.
- Conserver UTF-8 et les fins de ligne ciblees ; ne pas normaliser les fichiers entiers.
- Les trois valeurs actuelles (non-crit, crit, esperance) sont comparees ; ce chantier ne cree pas de DPS temporel, de rotation ou de modele de recharges.
- Le mobile garde le tableau a trois colonnes : Crit peut etre masquee, reference et essai restent dans chaque cellule visible.

---

## File Structure

| Fichier | Responsabilite |
|---|---|
| `js/metier/essai-enchantements.js` | Etat immutable de reference/essai et reconstruction d'un heros avec seulement les deux configurations d'essai. |
| `js/metier/calculateur-entrees.js` | Association pure des resultats de deux calculs et calcul des ecarts absolus/relatifs. |
| `js/vues/editeur-arme.js` | Mode `enchantmentsOnly` de l'editeur d'arme, qui masque les parametres exclus. |
| `js/vues/editeur-equipement.js` | Mode `enchantmentsOnly` de l'editeur de gravure, avec retour a la reference d'essai. |
| `js/vues/calculateur.js` | Etat ephemere, carte de comparaison, second calcul et cellules de delta. |
| `css/calculateur.css` | Hierarchie visuelle compacte reference/essai/delta, lisible a 320 px. |
| `tests/essai-enchantements.test.js` | Contrat pur de copie, remplacement et reinitialisation. |
| `tests/calculateur-entrees.test.js` | Contrat pur des ecarts par competence. |
| `tests/calculateur.playwright.js` | Parcours local de saisie, comparaison, reinitialisation et viewport mobile. |
| `tests/helpers/modules.js` | Ordre de chargement du nouveau module metier. |

### Task 1: Etat pur de l'essai d'enchantements

**Files:**
- Create: `js/metier/essai-enchantements.js`
- Create: `tests/essai-enchantements.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `jsonCopy()` de `js/noyau/outils.js` et `LINKED_ARMOR_SLOT` de `js/noyau/constantes.js`.
- Produces: `creerEssaiEnchantements(hero)`, `herosAvecEssaiEnchantements(hero, essai)`, `remplacerConfigEssai(essai, cle, config)`, `reinitialiserEssaiEnchantements(essai)` et `essaiEnchantementsDiffere(essai)`.
- `cle` vaut exactement `"weapon"` ou `"engraving"` ; une valeur inconnue rend l'essai inchange, jamais une nouvelle cle.
- `essai` a la forme `{ reference:{ weaponConfig, engravingConfig }, essai:{ weaponConfig, engravingConfig } }`.

- [ ] **Step 1: Write the failing pure test**

```js
const essai = creerEssaiEnchantements(HEROS);
const modifie = remplacerConfigEssai(essai, "weapon", CONFIG_ARME_ESSAI);
const herosEssai = herosAvecEssaiEnchantements(HEROS, modifie);

assert.deepEqual(HEROS.weaponConfig, CONFIG_ARME_REFERENCE);
assert.deepEqual(HEROS.armorConfig["Armure liee"], CONFIG_GRAVURE_REFERENCE);
assert.deepEqual(herosEssai.weaponConfig, CONFIG_ARME_ESSAI);
assert.deepEqual(herosEssai.armorConfig["Armure liee"], CONFIG_GRAVURE_REFERENCE);
assert.equal(essaiEnchantementsDiffere(modifie), true);
assert.deepEqual(
  reinitialiserEssaiEnchantements(modifie).essai,
  essai.reference
);
```

`HEROS` contient une arme, `weaponConfig`, cinq emplacements d'armure dont
`"Armure liee"`, et une `armorConfig` ; les configurations ne doivent porter
que des objets JSON valides. Ajouter aussi le cas `remplacerConfigEssai(essai,
"bijou", CONFIG)` : son resultat est profondement egal a `essai`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node tests/essai-enchantements.test.js`
Expected: `MODULE_NOT_FOUND` ou `creerEssaiEnchantements is not a function`.

- [ ] **Step 3: Implement the immutable trial module**

```js
function creerEssaiEnchantements(hero){
  const source = hero && typeof hero === "object" ? hero : {};
  const reference = {
    weaponConfig:jsonCopy(source.weaponConfig || null),
    engravingConfig:jsonCopy((source.armorConfig || {})[LINKED_ARMOR_SLOT] || null)
  };
  return { reference:jsonCopy(reference), essai:jsonCopy(reference) };
}

function herosAvecEssaiEnchantements(hero, etat){
  const cible = jsonCopy(hero || {});
  const source = etat && etat.essai ? etat.essai : {};
  cible.weaponConfig = jsonCopy(source.weaponConfig || null);
  cible.armorConfig = Object.assign({}, cible.armorConfig || {}, {
    [LINKED_ARMOR_SLOT]:jsonCopy(source.engravingConfig || null)
  });
  return cible;
}
```

Completer ces deux fonctions par remplacement/restauration en copiant chaque
valeur avant de la retourner. Ne jamais muter `hero` ni `essai`.

- [ ] **Step 4: Register the direct test and run its focused checks**

Ajouter `node tests/essai-enchantements.test.js` a `test:unit`, puis lancer :

Run: `node tests/essai-enchantements.test.js`
Expected: la commande quitte avec le code 0.

Ne pas inscrire encore le module dans `tests/helpers/modules.js` :
`modules-imports.test.js` refuse a juste titre les exports sans importateur.
La Task 3 l'inscrira directement avant `vues/calculateur.js`, quand cette vue
importera ses cinq fonctions.

- [ ] **Step 5: Commit the pure state boundary**

```bash
git add js/metier/essai-enchantements.js tests/essai-enchantements.test.js package.json
git commit -m "feat: isoler un essai local d'enchantements"
```

### Task 2: Ecarts purs entre les deux calculs de competences

**Files:**
- Modify: `js/metier/calculateur-entrees.js`
- Modify: `tests/calculateur-entrees.test.js`

**Interfaces:**
- Consumes: deux listes homonymes sorties de `resultatsParCompetence()`.
- Produces: `resultatsParCompetenceCompares(reference, essai)`.
- Chaque ligne produite garde `{ competence, resultat }` de reference et ajoute
  `essai` et `ecarts`. `ecarts` est `null` si une des deux lignes est non
  chiffree ; sinon il contient les cles `sansCritique`, `avecCritique` et
  `total`, chacune egale a `{ absolu, relatif }`.

- [ ] **Step 1: Write the failing delta test**

```js
const lignes = resultatsParCompetenceCompares([
  { competence:{ gameId:"a" }, resultat:{ sansCritique:100, avecCritique:200, total:150 } },
  { competence:{ gameId:"b" }, resultat:null }
], [
  { competence:{ gameId:"a" }, resultat:{ sansCritique:125, avecCritique:260, total:180 } },
  { competence:{ gameId:"b" }, resultat:null }
]);

assert.deepEqual(lignes[0].ecarts.total, { absolu:30, relatif:2000 });
assert.deepEqual(lignes[0].ecarts.avecCritique, { absolu:60, relatif:3000 });
assert.equal(lignes[1].ecarts, null);
```

Ajouter le cas reference `0` : `absolu` reste calcule, `relatif` vaut `null`
afin de ne jamais afficher une division par zero.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node tests/calculateur-entrees.test.js`
Expected: `resultatsParCompetenceCompares is not a function`.

- [ ] **Step 3: Implement comparison beside the existing result function**

```js
function ecartDe(reference, essai){
  const absolu = essai - reference;
  return {
    absolu,
    relatif:reference === 0 ? null : Math.round(absolu * 10000 / reference)
  };
}

function resultatsParCompetenceCompares(reference, essai){
  return (reference || []).map((ligne, index) => {
    const second = (essai || [])[index] || {};
    const premierResultat = ligne && ligne.resultat;
    const secondResultat = second.resultat;
    const ecarts = premierResultat && secondResultat ? {
      sansCritique:ecartDe(premierResultat.sansCritique, secondResultat.sansCritique),
      avecCritique:ecartDe(premierResultat.avecCritique, secondResultat.avecCritique),
      total:ecartDe(premierResultat.total, secondResultat.total)
    } : null;
    return Object.assign({}, ligne, { essai:secondResultat || null, ecarts });
  });
}
```

Exporter seulement `resultatsParCompetenceCompares`; garder `ecartDe` privee.
Les taux relatifs restent en dix-milliemes jusqu'a leur affichage.

- [ ] **Step 4: Run the focused and adjacent tests**

Run: `node tests/calculateur-entrees.test.js && node tests/degats-calcul.test.js`
Expected: code 0 et aucune modification des resultats non compares.

- [ ] **Step 5: Commit the comparison contract**

```bash
git add js/metier/calculateur-entrees.js tests/calculateur-entrees.test.js
git commit -m "feat: comparer deux resultats de competence"
```

### Task 3: Ouvrir des editeurs d'essai limites aux enchantements

**Files:**
- Modify: `js/vues/editeur-arme.js`
- Modify: `js/vues/editeur-equipement.js`
- Modify: `js/vues/calculateur.js`
- Modify: `tests/calculateur.playwright.js`

**Interfaces:**
- Consumes: un `context` d'editeur enrichi de
  `{ enchantmentsOnly:true, resetConfig:CONFIG_REFERENCE, commit }`.
- Produces: les callbacks `commit(config)` existants, mais aucun changement de
  niveau, grade, renforcement, outrepassement ou niveau de passif lorsque
  `enchantmentsOnly` est vrai ; une carte `.calc-essai-enchantements` et les
  deux boutons qui ouvrent les editeurs locaux.

- [ ] **Step 1: Write the failing browser assertions**

Dans `tests/calculateur.playwright.js`, depuis le futur bouton d'essai :

```js
await page.getByRole("button", { name:"Essayer les enchantements de l'arme" }).click();
assert.equal(await page.locator("#weaponConfigOverlay .weapon-config-grade").count(), 0);
assert.equal(await page.locator("#weaponConfigOverlay .weapon-config-level").count(), 0);
assert.ok(await page.locator(
  "#weaponConfigOverlay .weapon-enchantment, #weaponConfigOverlay .weapon-enchantment-slot"
).count() > 0);
```

Repeter pour `#gearConfigOverlay` : pas de controle niveau, renforcement ni
passif, au moins un selecteur d'enchantement. Verifier que le bouton
Reinitialiser appelle `commit(resetConfig)` en choisissant une valeur valide,
en enregistrant, en rouvrant puis en reinitialisant.

- [ ] **Step 2: Run the browser test to verify it fails**

Run: `node tests/calculateur.playwright.js`
Expected: le bouton « Essayer les enchantements de l'arme » est absent.

- [ ] **Step 3: Add the explicit editor mode**

Dans chaque fonction de rendu d'editeur, deriver :

```js
const enchantmentsOnly = Boolean(state.context.enchantmentsOnly);
```

Quand ce drapeau est vrai, rendre uniquement le bloc d'enchantements et son
apercu de statistiques. Conserver les valeurs non rendues dans `draft`, afin
que `weaponConfigStatus()` et `gearConfigStatus()` valident toujours la
configuration complete. Dans les fonctions de reinitialisation, remplacer
`commit(null)` par :

```js
state.context.commit(jsonCopy(state.context.resetConfig));
```

uniquement si `enchantmentsOnly` est vrai. Le mode normal conserve exactement
son comportement actuel.

Dans `calculateur.js`, ajouter `etat.essaiEnchantements`, initialise par
`creerEssaiEnchantements(hero)` au moment ou le heros courant devient
calculable et vide lors d'un changement de heros, d'arme ou de fermeture.
Ajouter `sectionEssaiEnchantements(hero, essai, redessiner)` avant la table :

```js
openWeaponConfigEditor({
  weaponFile:hero.weapon,
  config:essai.essai.weaponConfig,
  enchantmentsOnly:true,
  resetConfig:essai.reference.weaponConfig,
  commit:config => { etat.essaiEnchantements = remplacerConfigEssai(essai, "weapon", config); redessiner(); }
}, button);
```

Employer le meme schema pour l'armure liee avec `openGearConfigEditor()`,
`file:hero.armor[LINKED_ARMOR_SLOT]`, `slotKey:LINKED_ARMOR_SLOT` et la cle
`"engraving"`. Desactiver une ligne dont la configuration de reference n'est
pas `valid` et expliquer pourquoi au lieu de proposer un essai non calculable.

- [ ] **Step 4: Run the browser test to verify it passes**

Run: `node tests/calculateur.playwright.js`
Expected: les deux overlays n'exposent que les enchantements et reinitialisent
l'essai sans ecrire le build.

- [ ] **Step 5: Commit the scoped editors**

```bash
git add js/vues/editeur-arme.js js/vues/editeur-equipement.js js/vues/calculateur.js tests/calculateur.playwright.js
git commit -m "feat: ouvrir des editeurs d'essai d'enchantements"
```

### Task 4: Carte locale et double calcul dans le calculateur

**Files:**
- Modify: `js/vues/calculateur.js`
- Modify: `css/calculateur.css`
- Modify: `tests/calculateur.playwright.js`

**Interfaces:**
- Consumes: l'essai et les callbacks d'editeur de la Task 3, les fonctions de
  comparaison de la Task 2, les configurations du heros ouvert et les valeurs
  communes deja retenues par le calculateur.
- Produces: des cellules `.calc-essai` sous les valeurs de reference.

- [ ] **Step 1: Extend the failing browser test with a real comparison**

Apres avoir enregistre un enchantement d'arme valide different de la
reference, stocker les trois valeurs de la premiere ligne puis verifier :

```js
assert.match(await page.locator(".calc-table tbody tr").first().textContent(),
  /Essai.*\+\d+[\s\d]*.*\+\d+[,.]\d+ %/);
assert.notDeepEqual(valeursEssai, valeursReference);
```

Cliquer « Réinitialiser l'essai » et verifier que les valeurs de reference
reapparaissent sans aucun delta. Faire le meme parcours avec un enchantement
de l'armure gravee. Enfin, saisir une retouche manuelle d'ATK et verifier
qu'un avertissement nomme explicitement les retouches qui peuvent masquer un
ecart.

- [ ] **Step 2: Run the browser test to verify it fails**

Run: `node tests/calculateur.playwright.js`
Expected: les boutons d'essai existent, mais les cellules `.calc-essai` sont
encore absentes.

- [ ] **Step 3: Add the reference/trial calculations**

Construire `heroEssai` avec `herosAvecEssaiEnchantements(hero, etat.essaiEnchantements)`.
Calculer ses bases, ses entrees et `resultatsParCompetence()` exactement avec
la cible, les buffs, cumuls, bonus de categorie, calibration et retouches de
la reference. Passer les deux listes a `resultatsParCompetenceCompares()`.

- [ ] **Step 4: Render deltas without widening the table**

Modifier `tableauDesCompetences()` pour recevoir les lignes deja comparees.
Pour chaque resultat chiffre, conserver le nombre de reference dans
`.calc-valeur` et ajouter :

```js
el("small", { class:"calc-essai", text:
  "Essai " + NOMBRE.format(Math.round(valeurEssai))
  + " — " + formatDelta(ecart.absolu, ecart.relatif)
})
```

`formatDelta()` affiche `+` ou `−`, formate les points avec `NOMBRE`, puis le
pourcentage depuis les dix-milliemes. Si `ecart.relatif === null`, afficher
seulement l'ecart absolu. Ne rien afficher si `ecarts === null`.

Ajouter les styles `.calc-essai` et `.calc-essai-negatif`, avec un texte plus
petit, des chiffres tabulaires et un retour a la ligne naturel. Dans la media
query 560 px, ne changer ni le nombre de colonnes ni les regles existantes de
masquage de Crit.

- [ ] **Step 5: Run browser, mobile and regression tests**

Run: `node tests/calculateur.playwright.js && node tests/accessibilite-mobile.playwright.js && node tests/apport-par-piece.playwright.js`
Expected: code 0 ; aucune barre horizontale a 320 px ; aucune modification du
roster local ou distant.

- [ ] **Step 6: Commit the local comparison UI**

```bash
git add js/vues/calculateur.js css/calculateur.css tests/calculateur.playwright.js
git commit -m "feat: comparer l'essai d'enchantements par competence"
```

### Task 5: Verification finale et mise a jour PWA

**Files:**
- Modify if needed: `sw.js`
- Modify if needed: `tests/calculateur.playwright.js`

**Interfaces:**
- Consumes: les quatre taches precedentes.
- Produces: un comparateur accessible, precache si un nouveau module devient
une ressource chargee par le navigateur, et sans ecriture de donnees membre.

- [ ] **Step 1: Add the regression test for isolation**

Dans le parcours Playwright, lire `localStorage["confrerie7ds.teams"]` avant
l'essai, puis apres modification, enregistrement et reinitialisation :

```js
assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY),
  teamsAvant);
```

L'assertion doit couvrir aussi l'essai de gravure.

- [ ] **Step 2: Run the isolation test to verify it fails if a callback persists**

Temporarily remplacer le callback local de l'arme par l'appel de sauvegarde du
build ; lancer `node tests/calculateur.playwright.js`, constater l'echec de
l'egalite localStorage, restaurer le callback local et relancer jusqu'au vert.

- [ ] **Step 3: Update the service-worker manifest if required**

Si `js/metier/essai-enchantements.js` est importe directement par le navigateur,
ajouter son chemin a `CORE_ASSETS` de `sw.js`; sinon ne pas modifier `sw.js`.
Verifier :

Run: `node tests/pwa.test.js`
Expected: code 0 et le module est precache s'il est charge en module ES.

- [ ] **Step 4: Run the complete suite**

Run: `npm run test:unit` puis `npm test`
Expected: code 0, generation `--check` verte et onze parcours Playwright verts.

- [ ] **Step 5: Inspect a local-only capture**

Creer hors depot un harnais Playwright qui ecrit exclusivement
`confrerie7ds.teams`, ouvre le calculateur, modifie un enchantement d'arme et
un de gravure, puis capture le tableau avec les lignes `Essai`. Verifier
visuellement les cellules reference/essai a 1440 px et 320 px, puis supprimer
le harnais temporaire.

- [ ] **Step 6: Commit and push the verification fixes**

```bash
git add sw.js tests/calculateur.playwright.js
git commit -m "test: garder l'essai d'enchantements hors des donnees membre"
git push origin main
```

## Plan Self-Review

- Couverture : les Tasks 1 et 5 assurent l'isolation ; Task 2 couvre les trois
  ecarts et les competences non chiffrees ; Task 3 interdit les parametres hors
  scope et ouvre la carte ; Task 4 couvre le second calcul, les retouches et le
  mobile.
- Absence de donnees inventees : les editeurs reutilisent les catalogues et
  validateurs existants ; aucune table manuelle n'est introduite.
- Coherence : la forme `essai.reference` / `essai.essai`, les cles `weapon` et
  `engraving`, et `resultatsParCompetenceCompares()` sont definis avant leurs
  consommateurs.
- Aucun placeholder : chaque tache donne les fichiers, interfaces, test rouge,
  implementation minimale, test vert et commit correspondant.
