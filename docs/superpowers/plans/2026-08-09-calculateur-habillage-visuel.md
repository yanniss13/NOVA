# Habillage visuel du calculateur — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à l'onglet Calculateur le vocabulaire visuel du reste du site — cartes à liseré, titres en Cinzel, tableau en panneau de résultat — sans changer un seul chiffre, texte ou comportement.

**Architecture :** Deux fichiers touchés. `css/calculateur.css` reçoit la coque de carte (copiée de `.cov-card` d'`analyse.css`) et le panneau de résultat. `js/vues/calculateur.js` reçoit six retouches d'enveloppe : quatre `<strong>` deviennent des `<h3>`, cinq `<section>` gagnent une classe, et le `<table>` est enveloppé dans un `<div>`. Aucune fonction n'est réécrite, aucune condition n'est touchée.

**Tech Stack :** CSS pur (variables custom, pas de préprocesseur) · JavaScript ES modules sans framework, helper `el(tag, attrs, enfants)` · tests Playwright lancés par `node tests/<fichier>.playwright.js`.

## Global Constraints

- **Spec de référence :** `docs/superpowers/specs/2026-08-09-calculateur-habillage-visuel-design.md`.
- **Aucun texte affiché ne change**, sauf l'ajout du bandeau `Dégâts par compétence`.
- **Aucun chiffre ne change.** Aucun tri, aucun maximum calculé, aucune ligne mise en avant.
- **L'ordre de la page ne change pas.** Le tableau reste après les sections de buffs.
- **`.calc-table` reste un vrai `<table>`** avec `thead`/`tbody`/`tr`/`td`. Le panneau est un `<div>` *autour*, jamais un remplacement par des `<div>`.
- **Aucun `.calc-champ` nouveau** : `tests/calculateur.playwright.js` repère « Coéquipier 1 » par `hasText` et son commentaire prévient qu'un `.calc-champ` de plus casse le repérage.
- **Le bandeau ne porte pas la classe `.calc-avertissement`** : trois assertions comparent le texte complet de cette classe.
- **Aucune couleur nouvelle.** Uniquement `--gold-bright`, `--gold`, `--gold-deep`, `--muted-2`, déjà dans `css/base.css`. Les sept teintes d'élément de `js/noyau/constantes.js` sont hors jeu.
- **Aucune classe existante n'est renommée ni supprimée** : `.calc-soutien`, `.calc-buff`, `.calc-valeur`, `.calc-muette`, `.calc-retouche`, `.calc-cible`, `.calc-coequipier`, `.calc-coequipiers`, `.calc-calibration-message`, `.calc-table`, `.calc-champ`, `.calc-form`, `.calc-armes`, `.calc-tout-cocher`.
- **Aucun fichier CSS créé** : `tests/css-ordre.test.js` et la liste `CORE_ASSETS` du service worker restent inchangés.
- **Les assertions existantes de `tests/calculateur.playwright.js` ne sont pas modifiées.** Ce plan n'y *ajoute* que des assertions, à un point d'insertion unique et précisé. Si une assertion existante casse, c'est que le périmètre a été dépassé — corriger le code, pas le test.
- **Branche de travail :** `calculateur-habillage-visuel`, déjà créée, spec déjà commitée dessus.

---

## Structure des fichiers

| Fichier | Rôle | Action |
|---|---|---|
| `css/calculateur.css` | Toute l'apparence du calculateur. 96 lignes aujourd'hui, ~150 après. Reste sous le seuil où il faudrait le découper. | Modifier |
| `js/vues/calculateur.js` | Rendu de la vue. 1254 lignes. **Six retouches ponctuelles**, aucune restructuration : le fichier est gros mais le découper n'est pas le sujet de ce chantier. | Modifier |
| `tests/calculateur.playwright.js` | Garde-fou de bout en bout. 431 lignes. | Ajouter des assertions à un point d'insertion unique |

**Point d'insertion des tests, valable pour les trois tâches :** juste avant la ligne

```js
    assert.deepEqual(errors, [], "aucune erreur de page attendue");
```

À cet endroit, la page est dans un état connu et stable : cible = `mannequin`, toutes les cases décochées, tableau rendu. Les trois tâches empilent leurs assertions à cet endroit, dans l'ordre des tâches.

---

## Task 1 : Les cartes de section

**Files:**
- Modify: `js/vues/calculateur.js:441-442, 525-526, 578-579, 699-700, 736-737, 874`
- Modify: `css/calculateur.css:19-33, 68-78`
- Test: `tests/calculateur.playwright.js` (point d'insertion ci-dessus)

**Interfaces:**
- Consomme : rien.
- Produit : la classe CSS `calc-carte` (coque, variable `--ec`) et `calc-carte-titre` (titre Cinzel coloré en `--ec`). La tâche 2 réutilise le même vocabulaire de titre pour le bandeau du panneau, mais avec sa propre classe.

- [ ] **Step 1 : Écrire les assertions qui échouent**

Insérer au point d'insertion :

```js
    /* L'HABILLAGE. Les quatre sources de buffs sont des cartes titrees, comme
       partout ailleurs sur le site : c'etait le seul onglet a empiler des
       sections nues sous un <strong>. */
    for(const classe of [
      "calc-soutiens","calc-tenues","calc-potentiels","calc-supplements"
    ]){
      const carte = page.locator("." + classe);
      assert.ok(
        await carte.evaluate(n => n.classList.contains("calc-carte")),
        classe + " doit porter la coque de carte"
      );
      assert.equal(await carte.locator("h3.calc-carte-titre").count(), 1,
        classe + " doit porter un titre h3, pas un <strong> nu");
      assert.equal(await carte.locator("> strong").count(), 0,
        classe + " ne doit plus avoir de <strong> de titre");
    }

    /* Quatre liseres DISTINCTS, tous sur l'axe dore : les sept teintes
       d'element sont deja prises, et le badge d'element du build est sur cette
       meme page. On lit la couleur calculee, pas la variable : elle resout les
       jetons et ne depend pas du navigateur. */
    const liseres = await page.evaluate(() => [
      "calc-soutiens","calc-tenues","calc-potentiels","calc-supplements"
    ].map(c => getComputedStyle(
      document.querySelector("." + c)).borderTopColor));
    assert.equal(new Set(liseres).size, 4,
      "les quatre sources doivent avoir quatre liseres distincts, recu : "
        + liseres.join(" / "));

    /* La carte REMPLACE le separateur : les garder tous les deux poserait un
       filet a l'interieur du cadre. */
    assert.equal(
      await page.locator(".calc-soutiens")
        .evaluate(n => getComputedStyle(n).borderTopWidth),
      "2px",
      "le bord haut de la carte est le lisere, pas l'ancien separateur d'1px"
    );

    /* La calibration prend la coque mais JAMAIS le lisere : le degrade signifie
       « source de buff », et elle n'en est pas une. */
    const bordsCalib = await page.locator(".calc-calibration").evaluate(n => {
      const s = getComputedStyle(n);
      return { haut:s.borderTopWidth, couleur:s.borderTopColor };
    });
    assert.equal(bordsCalib.haut, "1px",
      "la calibration porte un bord neutre, pas le lisere de 2px");

    /* « Tout cocher » n'est PAS une carte : elle commande les quatre sections,
       elle n'en est pas une cinquieme. */
    assert.equal(await page.locator(".calc-tout-cocher.calc-carte").count(), 0,
      "« tout cocher » doit rester l'en-tete des sections, pas une carte");
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

```bash
node tests/calculateur.playwright.js
```

Attendu : ÉCHEC sur la première boucle — `calc-soutiens doit porter la coque de carte`.

- [ ] **Step 3 : Retoucher les titres et les enveloppes dans la vue**

Six remplacements dans `js/vues/calculateur.js`. Aucune autre ligne ne bouge.

Ligne 441-442, dans `sectionSoutiens()` :

```js
    const section = el("section",{class:"calc-soutiens calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Soutiens"}),
```

Ligne 525-526, dans `sectionTenuesGravees()` :

```js
    const section = el("section",{class:"calc-tenues calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Tenues gravées"})
    ]);
```

Ligne 578-579, dans `sectionPotentiels()` :

```js
    const section = el("section",{class:"calc-potentiels calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Potentiels d'équipe"})
    ]);
```

Ligne 699-700, dans `sectionSupplements()` :

```js
    const section = el("section",{class:"calc-supplements calc-carte"},[
      el("h3",{class:"calc-carte-titre",text:"Dégâts supplémentaires"})
    ]);
```

Ligne 736-737, dans `sectionCalibration()` :

```js
    const section = el("section",{class:"calc-calibration calc-carte"});
    section.appendChild(el("h3",{class:"calc-carte-titre",text:"Constante C"}));
```

Ligne 874, dans `avertissements()` :

```js
    return el("section",{class:"calc-avertissement calc-carte"},[
```

- [ ] **Step 4 : Supprimer les séparateurs devenus doubles**

Dans `css/calculateur.css`, **supprimer** ce bloc (lignes 19-24, commentaire compris) :

```css
/* Les trois sources de buffs - soutiens, tenues gravées, potentiels - portent
   le même habillage : empilées sans séparateur, elles se lisaient comme une
   seule liste, et le membre ne voyait plus d'où venait chaque case. */
.calc-soutiens,.calc-tenues,.calc-potentiels,.calc-supplements{
  margin:16px 0;border-top:1px solid var(--line-soft);padding-top:12px
}
```

Dans le bloc `.calc-calibration` (lignes 71-74), **retirer** `border-top:1px solid var(--line-soft);` et `padding-top:12px;`. Il devient :

```css
.calc-calibration{
  margin:24px 0 8px;
  display:flex;flex-direction:column;gap:10px;align-items:flex-start
}
```

**Supprimer** aussi la ligne `.calc-calibration h3{margin:0;font-size:15px}` : `.calc-carte-titre` s'en charge, et cette règle, plus spécifique, écraserait la taille du titre.

- [ ] **Step 5 : Ajouter la coque de carte**

À insérer dans `css/calculateur.css`, à la place du bloc supprimé au Step 4 :

```css
/* Chaque source de buff est une carte, sur le modele de `.cov-card`
   d'analyse.css : le calculateur etait le seul onglet du site a empiler des
   sections nues, et c'est ce qui lui donnait son air de brouillon.
   `--ec` porte le lisere, et rien d'autre. */
.calc-carte{
  --ec:var(--gold);
  margin:12px 0;padding:12px 14px;
  background:var(--panel);border:1px solid var(--line);
  border-top:2px solid var(--ec);border-radius:var(--radius)
}
.calc-carte-titre{
  margin:0 0 8px;font-family:var(--display);font-size:13px;font-weight:700;
  letter-spacing:.10em;text-transform:uppercase;color:var(--ec)
}

/* Le degrade d'or, dans l'ordre d'affichage : du clair a l'eteint. AUCUNE
   teinte nouvelle - les sept couleurs d'element sont deja prises, et le badge
   d'element du build s'affiche sur cette meme page : un lisere violet se
   lirait comme un indice de Tenebres. */
.calc-soutiens{--ec:var(--gold-bright)}
.calc-tenues{--ec:var(--gold)}
.calc-potentiels{--ec:var(--gold-deep)}
.calc-supplements{--ec:var(--muted-2)}

/* La calibration et les avertissements prennent la coque, jamais le lisere :
   le degrade signifie « source de buff », et ces deux blocs n'en sont pas. */
.calc-calibration.calc-carte,.calc-avertissement.calc-carte{
  border-top:1px solid var(--line)
}
```

- [ ] **Step 6 : Lancer le test pour le voir passer**

```bash
node tests/calculateur.playwright.js
```

Attendu : `PASS Playwright: calculateur, trois colonnes, buffs et retouche`. **Toutes** les assertions antérieures doivent passer sans avoir été touchées.

- [ ] **Step 7 : Commiter**

```bash
git add css/calculateur.css js/vues/calculateur.js tests/calculateur.playwright.js
git commit -m "feat: les sources de buffs deviennent des cartes a lisere dore

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2 : Le panneau de résultat

**Files:**
- Modify: `js/vues/calculateur.js:860-870` (le `return` de `tableauDesCompetences()`)
- Modify: `css/calculateur.css` (bloc `.calc-table`, lignes 57-62 après la tâche 1)
- Test: `tests/calculateur.playwright.js` (même point d'insertion, à la suite des assertions de la tâche 1)

**Interfaces:**
- Consomme : rien de la tâche 1 (les deux tâches sont indépendantes ; la tâche 1 d'abord uniquement pour garder les commits lisibles).
- Produit : `tableauDesCompetences(charId, competences, entrees, bonusParCategorie)` retourne désormais un `HTMLDivElement` de classe `calc-resultat` au lieu d'un `HTMLTableElement`. **Sa signature ne change pas** et son unique appelant (`dessiner()`, ligne 1212) fait un `appendChild` : aucune adaptation n'est nécessaire côté appelant.

- [ ] **Step 1 : Écrire les assertions qui échouent**

Insérer au point d'insertion, **après** les assertions de la tâche 1 :

```js
    /* LE PANNEAU DE RESULTAT. Le tableau reste un vrai <table> - les assertions
       plus haut le lisent en `tbody tr` -, il est seulement enveloppe. */
    const panneau = page.locator(".calc-resultat");
    assert.equal(await panneau.count(), 1, "un seul panneau de resultat");
    assert.equal(await panneau.locator("> .calc-resultat-titre").count(), 1,
      "le panneau porte un bandeau");
    assert.equal(await panneau.locator("> table.calc-table").count(), 1,
      "le tableau reste un <table>, enfant direct du panneau");
    assert.equal(
      (await panneau.locator(".calc-resultat-titre").textContent()).trim(),
      "Dégâts par compétence",
      "le bandeau annonce ce que le tableau contient"
    );

    /* Le bandeau ne doit PAS etre un `.calc-avertissement` : trois assertions
       plus haut comparent le texte complet de cette classe, et un texte de plus
       les ferait mentir. */
    assert.equal(
      await page.locator(".calc-resultat-titre.calc-avertissement").count(), 0,
      "le bandeau ne doit pas se presenter comme un avertissement"
    );

    /* NI TRI, NI VEDETTE. Seule `calc-muette` a le droit d'habiller une ligne :
       toute autre classe signalerait une mise en avant, explicitement hors
       perimetre. */
    const classesDeLigne = await page.evaluate(() =>
      [...document.querySelectorAll(".calc-table tbody tr")]
        .map(tr => tr.className.trim())
        .filter(c => c && c !== "calc-muette"));
    assert.deepEqual(classesDeLigne, [],
      "aucune ligne mise en avant : pas de tri, pas de vedette, recu : "
        + classesDeLigne.join(" / "));
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

```bash
node tests/calculateur.playwright.js
```

Attendu : ÉCHEC sur `un seul panneau de resultat` — reçu 0.

- [ ] **Step 3 : Envelopper le tableau**

Dans `js/vues/calculateur.js`, remplacer le `return` de `tableauDesCompetences()` (lignes 860-870) par :

```js
    /* Le tableau est l'objet de la page : il porte donc son propre panneau,
       plutot que de flotter sur le fond comme une liste parmi d'autres.
       Le <table> lui-meme n'est PAS remplace par des <div> - les tests le
       lisent en `tbody tr`, et un tableau de nombres reste un tableau. */
    return el("div",{class:"calc-resultat"},[
      el("div",{class:"calc-resultat-titre",text:"Dégâts par compétence"}),
      el("table",{class:"calc-table"},[
        el("thead",{},[
          el("tr",{},[
            el("th",{text:"Compétence"}),
            el("th",{text:"Non-crit"}),
            el("th",{text:"Crit"}),
            el("th",{text:"Espérance"})
          ])
        ]),
        corps
      ])
    ]);
```

- [ ] **Step 4 : Habiller le panneau**

Dans `css/calculateur.css`, remplacer le bloc `.calc-table` existant :

```css
.calc-table{width:100%;border-collapse:collapse;margin-bottom:16px}
```

par :

```css
/* Le panneau de resultat : bandeau dore, bordure accentuee, coins arrondis.
   L'ordre du kit est conserve et aucune ligne n'est mise en avant - c'est un
   choix, pas un oubli. */
.calc-resultat{
  margin:16px 0;background:var(--panel-2);border:1px solid var(--gold-deep);
  border-radius:var(--radius);overflow:hidden
}
.calc-resultat-titre{
  padding:9px 14px;background:rgba(217,164,65,.10);
  border-bottom:1px solid var(--gold-deep);
  font-family:var(--display);font-size:12px;font-weight:700;
  letter-spacing:.10em;text-transform:uppercase;color:var(--gold-bright)
}
.calc-table{width:100%;border-collapse:collapse;margin-bottom:0}
.calc-resultat .calc-table th,.calc-resultat .calc-table td{padding:8px 14px}
/* L'allure de `.rank-head` d'analyse.css, RECOPIEE et non empruntee :
   importer la classe couplerait deux feuilles dont tests/css-ordre.test.js
   verifie l'ordre, et amenerait son fond `--panel`, qui jure avec le
   `--panel-2` du panneau. */
.calc-resultat .calc-table th{
  font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted)
}
/* Le dernier filet tomberait sur la bordure du panneau. */
.calc-resultat .calc-table tbody tr:last-child td{border-bottom:0}
```

- [ ] **Step 5 : Lancer le test pour le voir passer**

```bash
node tests/calculateur.playwright.js
```

Attendu : PASS, assertions des tâches 1 et 2 comprises.

- [ ] **Step 6 : Commiter**

```bash
git add css/calculateur.css js/vues/calculateur.js tests/calculateur.playwright.js
git commit -m "feat: le tableau des degats devient un panneau de resultat

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3 : Le petit écran

**Files:**
- Modify: `css/calculateur.css` (bloc `@media (max-width:560px)`, en fin de fichier)
- Test: `tests/calculateur.playwright.js` (même point d'insertion, à la suite des assertions de la tâche 2)

**Interfaces:**
- Consomme : `.calc-carte` (tâche 1), `.calc-resultat` (tâche 2).
- Produit : rien que d'autres tâches consomment. Dernière tâche du plan.

- [ ] **Step 1 : Écrire les assertions qui échouent**

Insérer au point d'insertion, **après** les assertions de la tâche 2 :

```js
    /* A 320 PX. La densite gagnee sur grand ecran ne doit pas se payer en
       largeur utile : la carte perd du rembourrage, pas le tableau sa
       lisibilite. */
    await page.setViewportSize({ width:320, height:720 });
    await page.locator(".calc-table tbody tr").first().waitFor();

    const debord = await page.evaluate(() =>
      document.documentElement.scrollWidth
        - document.documentElement.clientWidth);
    assert.ok(debord <= 1,
      "aucun debordement horizontal a 320 px, recu : " + debord + " px");

    /* La colonne Crit cede la place - regle deja en place, on verifie qu'elle
       survit au panneau. Non-crit et esperance suffisent a comparer. */
    assert.equal(
      await page.locator(".calc-table tbody tr").first()
        .locator(".calc-valeur:visible").count(),
      2,
      "sous 560 px, la colonne Crit est masquee"
    );

    /* La cible tactile reste a 44 px : c'est la regle du site, et une carte
       plus dense ne l'annule pas. */
    const hauteurCase = await page.locator(".calc-buff").first()
      .evaluate(n => n.getBoundingClientRect().height);
    assert.ok(hauteurCase >= 44,
      "une case a cocher reste a 44 px au doigt, recu : " + hauteurCase);

    /* Le rembourrage de carte se resserre, sans disparaitre. */
    const rembourrage = await page.locator(".calc-soutiens")
      .evaluate(n => parseFloat(getComputedStyle(n).paddingLeft));
    assert.ok(rembourrage > 0 && rembourrage < 14,
      "la carte se resserre sous 560 px sans coller au bord, recu : "
        + rembourrage);

    await page.setViewportSize({ width:1280, height:720 });
```

- [ ] **Step 2 : Lancer le test pour le voir échouer**

```bash
node tests/calculateur.playwright.js
```

Attendu : ÉCHEC sur `la carte se resserre sous 560 px sans coller au bord` — reçu 14, la valeur de bureau.

- [ ] **Step 3 : Resserrer les cartes sur petit écran**

Dans `css/calculateur.css`, à l'intérieur du bloc `@media (max-width:560px)` existant, **ajouter** ces règles à la suite de celles déjà présentes — sans toucher aux trois existantes :

```css
  /* La carte se resserre : sur 320 px, 28 px de rembourrage horizontal
     mangeaient une colonne du tableau. */
  .calc-carte{padding:10px 11px}
  .calc-resultat .calc-table th,.calc-resultat .calc-table td{padding:8px 10px}
```

- [ ] **Step 4 : Lancer le test pour le voir passer**

```bash
node tests/calculateur.playwright.js
```

Attendu : PASS, les trois tâches comprises.

- [ ] **Step 5 : Lancer la suite complète de bout en bout**

```bash
npm run test:e2e
```

Attendu : tous les fichiers `PASS`. Deux tests sont connus pour être instables et ne signalent pas une régression de ce chantier : `supabase-etape1.playwright.js` (assertion de 44 px) et `accessibilite-mobile.playwright.js` (tuile du sélecteur). En cas d'échec sur l'un des deux, le relancer seul avant de conclure.

- [ ] **Step 6 : Commiter**

```bash
git add css/calculateur.css tests/calculateur.playwright.js
git commit -m "feat: les cartes du calculateur se resserrent sous 560 px

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Vérification finale

- [ ] `npm run test:unit` passe — aucun fichier CSS créé, `tests/css-ordre.test.js` doit rester vert sans modification.
- [ ] `git diff main --stat` ne montre que trois fichiers : `css/calculateur.css`, `js/vues/calculateur.js`, `tests/calculateur.playwright.js` (plus les deux documents de `docs/superpowers/`).
- [ ] `git diff main -- js/vues/calculateur.js` ne contient **que** des lignes de `class:`, de `el("h3"` et l'enveloppe du tableau. Aucune condition, aucun calcul, aucune chaîne de texte affichée hors le bandeau.
