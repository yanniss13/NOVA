# Refonte du site — maquette interactive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire une maquette HTML interactive et responsive de la refonte complète, inspirée de l'accueil simplifié validé et couvrant toutes les fonctions du site actuel.

**Architecture:** La maquette vit uniquement dans `docs/refonte-maquette/` et réutilise les assets locaux du dépôt. Un petit état de démonstration côté navigateur pilote les routes, onglets, menus et modales sans Supabase ni persistance ; deux tests dédiés vérifient la couverture fonctionnelle et les parcours desktop/mobile.

**Tech Stack:** HTML5, CSS natif, JavaScript navigateur sans dépendance, Node.js `assert`, Playwright existant.

**Spec:** `docs/superpowers/specs/2026-09-06-refonte-site-maquette-design.md`

## Global Constraints

- Ne modifier ni `index.html`, ni les modules applicatifs, ni Supabase, ni le service worker.
- Ne lire et n'écrire aucune donnée réelle ; la maquette utilise uniquement des données fictives déterministes.
- Réutiliser les portraits et icônes locaux sans les renommer.
- Ne pas ajouter de dépendance ou d'étape de build.
- Conserver toutes les destinations actuelles : suivi, Builder, équipes, disponibilités, sessions et rapports de boss, roster, analyse, Wiki, Collection, Calculateur, compte et administration.
- Garantir une utilisation sans débordement horizontal à 1440 px, 1024 px, 390 px et 320 px.
- Garantir des cibles tactiles de 44 px, un focus visible, des modales accessibles et le respect de `prefers-reduced-motion`.
- Ne pas publier ni déployer la maquette.

## Structure des fichiers

- `docs/refonte-maquette/index.html` : enveloppe, navigation, conteneurs de vues et modale.
- `docs/refonte-maquette/donnees-demo.js` : contenu fictif immuable exposé par `window.NOVA_MAQUETTE`.
- `docs/refonte-maquette/maquette.js` : rendu des vues et interactions locales.
- `docs/refonte-maquette/maquette.css` : palette, typographie, composants et mises en page desktop.
- `docs/refonte-maquette/responsive.css` : régimes intermédiaire, mobile et mouvement réduit.
- `tests/refonte-maquette.test.js` : contrat statique de couverture et d'isolation.
- `tests/refonte-maquette.playwright.js` : navigation, responsive, clavier et modale.
- `scripts/lancer-tests.js` : enregistrement des deux nouveaux tests dans les suites existantes.

---

### Task 1: Poser le contrat de couverture et l'enveloppe isolée

**Files:**
- Create: `tests/refonte-maquette.test.js`
- Create: `docs/refonte-maquette/index.html`
- Create: `docs/refonte-maquette/donnees-demo.js`
- Create: `docs/refonte-maquette/maquette.js`
- Create: `docs/refonte-maquette/maquette.css`
- Create: `docs/refonte-maquette/responsive.css`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Produces: `window.NOVA_MAQUETTE` avec `{ navigation, bossTabs, team, roster, tools }`.
- Produces: sections `[data-view]` nommées `home`, `dashboard`, `teams`, `boss`, `roster`, `tools`, `admin`.
- Produces: fonction globale interne `showView(viewId, options)` dans `maquette.js`.

- [ ] **Step 1: Write the failing static contract test**

Créer un test qui lit les fichiers du prototype et exige les destinations ainsi
que l'absence de dépendance à l'application réelle :

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const PROTO = path.join(ROOT, "docs", "refonte-maquette");
const read = file => fs.readFileSync(path.join(PROTO, file), "utf8");

const html = read("index.html");
const data = read("donnees-demo.js");
const js = read("maquette.js");
const css = read("maquette.css") + read("responsive.css");

["home", "dashboard", "teams", "boss", "roster", "tools", "admin"]
  .forEach(view => assert.match(html,
    new RegExp(`data-view=["']${view}["']`), `vue absente : ${view}`));

[
  "Mon suivi", "Créer une équipe", "Équipes partagées", "Disponibilités",
  "Groupes", "Rapports", "Mon roster", "Roster des membres", "Wiki",
  "Collection", "Calculateur", "Analyse", "Membres"
].forEach(label => assert.ok((html + data).includes(label),
  `fonction absente : ${label}`));

assert.doesNotMatch(html + js, /supabase|localStorage|serviceWorker/i);
assert.match(html, /nova-banniere-etendue\.png/);
assert.match(css, /@media\s*\(max-width:\s*767px\)/);
console.log("refonte-maquette.test.js OK");
```

- [ ] **Step 2: Run the test and verify the missing prototype fails**

Run: `node tests/refonte-maquette.test.js`

Expected: FAIL avec `ENOENT` sur `docs/refonte-maquette/index.html`.

- [ ] **Step 3: Create the six prototype files with the full semantic shell**

Dans `index.html`, créer un document français avec les feuilles de style, les
deux scripts `defer`, un lien d'évitement, l'en-tête, les sept sections et la
modale. Le corps suit ce contrat exact :

```html
<body data-session="public">
  <a class="skip-link" href="#main">Aller au contenu</a>
  <header class="app-header" id="appHeader"></header>
  <main id="main" tabindex="-1">
    <section class="view is-active" data-view="home"></section>
    <section class="view" data-view="dashboard" hidden></section>
    <section class="view" data-view="teams" hidden></section>
    <section class="view" data-view="boss" hidden></section>
    <section class="view" data-view="roster" hidden></section>
    <section class="view" data-view="tools" hidden></section>
    <section class="view" data-view="admin" hidden></section>
  </main>
  <nav class="mobile-nav" aria-label="Navigation mobile"></nav>
  <div class="modal-layer" id="demoModal" hidden></div>
  <script src="./donnees-demo.js" defer></script>
  <script src="./maquette.js" defer></script>
</body>
```

Dans `donnees-demo.js`, exposer un objet gelé qui contient tous les libellés du
contrat et des exemples pour Méliodas, Merlin, Diane et King :

```js
window.NOVA_MAQUETTE = Object.freeze({
  navigation:["Notre guilde", "Équipes", "Roster", "Outils"],
  bossTabs:["Vue d'ensemble", "Équipes", "Disponibilités", "Groupes", "Rapports"],
  team:{ name:"Akumu — équipe Foudre", heroes:["Méliodas", "Merlin", "Diane", "King"] },
  roster:{ modes:["Mon roster", "Roster des membres"] },
  tools:["Wiki", "Collection", "Calculateur", "Analyse"],
  coverage:[
    "Mon suivi", "Créer une équipe", "Équipes partagées", "Disponibilités",
    "Groupes", "Rapports", "Mon roster", "Roster des membres", "Wiki",
    "Collection", "Calculateur", "Analyse", "Membres"
  ]
});
```

Initialiser les CSS avec les variables de la spec et les vues cachées. Créer
dans `maquette.js` une initialisation sans réseau qui écrit le nom du prototype
dans l'en-tête et laisse les sections prêtes pour les tâches suivantes.

- [ ] **Step 4: Register the static test in the project runner**

Ajouter `node tests/refonte-maquette.test.js` à la fin de `SUITES.unit`. Le test
navigateur sera créé et enregistré avec son premier parcours complet dans Task 3.

- [ ] **Step 5: Run the static contract**

Run: `node tests/refonte-maquette.test.js`

Expected: `refonte-maquette.test.js OK`.

- [ ] **Step 6: Commit the isolated shell**

```powershell
git add -- docs/refonte-maquette tests/refonte-maquette.test.js scripts/lancer-tests.js
git commit -m "test(refonte): poser le contrat de la maquette"
```

---

### Task 2: Construire l'Accueil public de la guilde et le système visuel

**Files:**
- Modify: `docs/refonte-maquette/index.html`
- Modify: `docs/refonte-maquette/maquette.css`
- Modify: `docs/refonte-maquette/responsive.css`
- Modify: `tests/refonte-maquette.test.js`

**Interfaces:**
- Consumes: section `[data-view="home"]` et variables CSS de Task 1.
- Produces: composants `.guild-hero`, `.essential-card`, `.tools-band`, `.ornate-panel`, `.gold-action`.

- [ ] **Step 1: Extend the static test for the approved composition**

Ajouter ces assertions :

```js
assert.match(html, /On prépare la suite,\s*ensemble/);
assert.match(html, /data-action="create-account"/);
assert.match(html, /data-route="boss"/);
assert.match(html, /data-route="roster"/);
assert.match(html, /data-route="tools"/);
assert.match(css, /--abyss:\s*#050d14/i);
assert.match(css, /--gold-light:\s*#ddb45f/i);
assert.match(css, /min-height:\s*44px/);
```

- [ ] **Step 2: Verify the new composition contract fails**

Run: `node tests/refonte-maquette.test.js`

Expected: FAIL sur le titre ou la première route absente.

- [ ] **Step 3: Implement the public homepage markup**

Remplir la section `home` avec :

```html
<div class="guild-hero ornate-panel">
  <div class="guild-hero__copy">
    <p class="context-label">L'espace de notre guilde</p>
    <h1>On prépare la suite,<br>ensemble.</h1>
    <p>Retrouve les équipes du Boss de Guilde, partage ton roster et organise les prochaines sessions.</p>
    <div class="hero-actions">
      <button class="gold-action" data-action="create-account">Créer mon compte</button>
      <button class="text-action" data-route="tools">Explorer les outils</button>
    </div>
  </div>
  <figure class="guild-hero__visual">
    <img src="../../nova-banniere-etendue.png" alt="Les héros de NOVA réunis devant la forteresse">
  </figure>
</div>
```

Ajouter les trois cartes Boss, Roster et Disponibilités, la bande des quatre
outils, l'appel à la connexion, le lien LootBar sponsorisé et le pied de page.
Utiliser des boutons avec `data-route` pour toutes les destinations internes.

- [ ] **Step 4: Implement the desktop visual system**

Définir les couleurs, typographies, filets, fonds et gabarits. Le panneau
principal suit une grille `minmax(360px, .9fr) minmax(520px, 1.1fr)` et les
trois cartes essentielles utilisent `repeat(3, minmax(0, 1fr))`. Employer
`clamp()` pour le titre et une largeur de lecture maximale de 58 caractères.

- [ ] **Step 5: Implement the mobile composition**

Sous `767px`, placer l'image avant le texte par `grid-template-areas`, empiler
les actions, transformer les trois cartes en lignes icône/texte/action et les
outils en liste. Réserver `padding-bottom:calc(78px + env(safe-area-inset-bottom))`
au contenu pour la navigation basse.

- [ ] **Step 6: Run the static test and inspect the source diff**

Run: `node tests/refonte-maquette.test.js`

Expected: PASS.

Run: `git diff --check`

Expected: aucun espace fautif.

- [ ] **Step 7: Commit the homepage**

```powershell
git add -- docs/refonte-maquette tests/refonte-maquette.test.js
git commit -m "feat(refonte): composer l accueil de la guilde"
```

---

### Task 3: Rendre la navigation et les états de démonstration interactifs

**Files:**
- Modify: `docs/refonte-maquette/index.html`
- Modify: `docs/refonte-maquette/maquette.js`
- Modify: `docs/refonte-maquette/maquette.css`
- Modify: `docs/refonte-maquette/donnees-demo.js`
- Create: `tests/refonte-maquette.playwright.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: boutons `[data-route]`, sections `[data-view]`, `window.NOVA_MAQUETTE`.
- Produces: `showView(viewId, { push=true, focus=true }={})`.
- Produces: `setDemoSession(mode)` avec `mode` égal à `public`, `member` ou `offline`.
- Produces: `openDemoModal(title, body)` et `closeDemoModal()` avec restitution du focus.

- [ ] **Step 1: Create and register the browser navigation test**

Créer le test, ajouter `node tests/refonte-maquette.playwright.js` à la fin de
`SUITES.e2e`, démarrer `serveRepo()`, ouvrir Chromium et vérifier :

```js
await page.goto(server.url + "/docs/refonte-maquette/");
await page.getByRole("button", { name:"Boss de guilde", exact:true }).first().click();
await page.locator('[data-view="boss"]:not([hidden])').waitFor();
assert.equal(await page.evaluate(() => location.hash), "#boss");
await page.goBack();
await page.locator('[data-view="home"]:not([hidden])').waitFor();
await page.getByRole("button", { name:"Connexion", exact:true }).click();
await page.getByRole("dialog").waitFor();
await page.getByRole("button", { name:"Entrer en mode membre" }).click();
assert.equal(await page.locator("body").getAttribute("data-session"), "member");
```

Collecter les `pageerror` et exiger un tableau vide avant la fermeture.

- [ ] **Step 2: Run the browser test and verify it fails**

Run: `node tests/refonte-maquette.playwright.js`

Expected: FAIL car le bouton ne change pas encore de vue.

- [ ] **Step 3: Render the shared header, desktop navigation and mobile navigation**

Générer l'en-tête depuis une table de routes stable :

```js
const ROUTES = Object.freeze({
  home:"Notre guilde", teams:"Équipes", boss:"Boss", roster:"Roster",
  tools:"Outils", dashboard:"Mon suivi", admin:"Membres"
});
```

Le menu Outils contient Wiki, Collection, Calculateur et Analyse avec
`data-tool`. Le panneau mobile s'ouvre avec `aria-expanded`, se ferme avec
Échap, au clic extérieur et après sélection d'une destination.

- [ ] **Step 4: Implement hash navigation and view focus**

`showView` refuse les identifiants inconnus, synchronise `hidden`,
`.is-active`, `aria-current`, le hash et le titre du document. Le gestionnaire
`popstate` relit `location.hash`. Après navigation, il focalise le premier `h1`
de la vue avec `tabindex="-1"`.

- [ ] **Step 5: Implement the session and modal demo**

Le bouton Connexion ouvre une modale qui propose « Entrer en mode membre ».
Ce choix pose `data-session="member"`, remplace Connexion par « YanniSs13 » et
fait de `dashboard` la destination de « Notre guilde ». La modale enferme le
focus entre ses boutons et rend le focus au déclencheur à la fermeture.

- [ ] **Step 6: Run the navigation test**

Run: `node tests/refonte-maquette.playwright.js`

Expected: PASS sur navigation, historique, session et absence d'erreur JS.

- [ ] **Step 7: Commit the interactive shell**

```powershell
git add -- docs/refonte-maquette tests/refonte-maquette.playwright.js scripts/lancer-tests.js
git commit -m "feat(refonte): rendre la maquette navigable"
```

---

### Task 4: Construire Mon suivi et le centre Boss de Guilde

**Files:**
- Modify: `docs/refonte-maquette/donnees-demo.js`
- Modify: `docs/refonte-maquette/maquette.js`
- Modify: `docs/refonte-maquette/maquette.css`
- Modify: `docs/refonte-maquette/responsive.css`
- Modify: `tests/refonte-maquette.playwright.js`

**Interfaces:**
- Consumes: `showView`, `openDemoModal`, composant `.ornate-panel`.
- Produces: `renderDashboard()` et `renderBoss(activeTab="overview")`.
- Produces: boutons `[data-boss-tab]` pour `overview`, `teams`, `availability`, `groups`, `reports`.

- [ ] **Step 1: Add failing Boss coverage assertions**

Après passage en mode membre, vérifier les actions de suivi puis chaque onglet :

```js
await page.getByRole("button", { name:"Mon suivi" }).click();
await page.getByText("Équipe manquante", { exact:true }).waitFor();
await page.getByRole("button", { name:"Ouvrir le groupe" }).click();
await page.locator('[data-view="boss"]:not([hidden])').waitFor();
for(const label of ["Équipes", "Disponibilités", "Groupes", "Rapports"]){
  await page.getByRole("tab", { name:label, exact:true }).click();
  await page.locator('[data-boss-panel]:not([hidden])').waitFor();
}
await page.getByText("Score global").waitFor();
```

- [ ] **Step 2: Run and observe the missing dashboard failure**

Run: `node tests/refonte-maquette.playwright.js`

Expected: FAIL sur « Équipe manquante ».

- [ ] **Step 3: Add deterministic dashboard and Boss fixtures**

Ajouter une semaine, six groupes, cinq participants, trois équipes, un rapport
terminé, une recommandation et une matrice de disponibilités simplifiée. Chaque
entrée porte un identifiant stable utilisé comme `data-group-id` ou
`data-team-id`.

- [ ] **Step 4: Render the member dashboard**

Afficher la semaine, le reset, la synchronisation, quatre cartes d'action et le
meilleur créneau. « Ouvrir le groupe » navigue vers `boss` et active l'onglet
`groups`. Fournir aussi les panneaux de démonstration vide, hors ligne et erreur
via un sélecteur `data-demo-state`.

- [ ] **Step 5: Render all five Boss tabs**

La vue d'ensemble montre le boss courant et la prochaine attaque. Les quatre
autres panneaux montrent respectivement les équipes partagées, une grille de
disponibilité 7 × 6 avec nombres écrits, six groupes de 1 à 5 membres, puis le
rapport et les archives. Les actions « Choisir mon équipe », « Rejoindre »,
« Terminer la run » et « Corriger » ouvrent une modale crédible sans persister.

- [ ] **Step 6: Style the command center**

Employer un panneau dominant pour la prochaine attaque, des lignes compactes
pour les participants et une couleur d'alerte uniquement pour l'échéance. Sous
767 px, mettre les onglets dans un rail horizontal et les groupes sur une seule
colonne.

- [ ] **Step 7: Run focused tests and commit**

Run: `node tests/refonte-maquette.test.js`

Run: `node tests/refonte-maquette.playwright.js`

Expected: deux PASS.

```powershell
git add -- docs/refonte-maquette tests/refonte-maquette.playwright.js
git commit -m "feat(refonte): maqueter le centre Boss de Guilde"
```

---

### Task 5: Maquetter le Team Builder, le roster et tous les outils

**Files:**
- Modify: `docs/refonte-maquette/donnees-demo.js`
- Modify: `docs/refonte-maquette/maquette.js`
- Modify: `docs/refonte-maquette/maquette.css`
- Modify: `docs/refonte-maquette/responsive.css`
- Modify: `tests/refonte-maquette.playwright.js`

**Interfaces:**
- Consumes: données de héros, `showView`, `openDemoModal` et composants communs.
- Produces: `renderTeams(mode="builder")`, `renderRoster(mode="mine")`, `renderTools(tool="wiki")`, `renderAdmin()`.
- Produces: onglets `[data-team-mode]`, `[data-roster-mode]`, `[data-tool-tab]`.

- [ ] **Step 1: Add failing navigation assertions for every functional area**

Ajouter un parcours qui ouvre chaque zone et exige son contenu distinctif :

```js
const destinations = [
  ["teams", "Composer une équipe"],
  ["roster", "Mon roster"],
  ["tools", "Les outils de la confrérie"],
  ["admin", "Comptes invités"]
];
for(const [route, text] of destinations){
  await page.evaluate(value => location.hash = value, route);
  await page.waitForFunction(value =>
    !document.querySelector(`[data-view="${value}"]`).hidden, route);
  await page.getByText(text, { exact:true }).waitFor();
}
for(const tool of ["Wiki", "Collection", "Calculateur", "Analyse"]){
  await page.getByRole("tab", { name:tool, exact:true }).click();
  await page.locator(`[data-tool-panel="${tool.toLowerCase()}"]:not([hidden])`).waitFor();
}
```

- [ ] **Step 2: Run and verify the first missing view fails**

Run: `node tests/refonte-maquette.playwright.js`

Expected: FAIL sur « Composer une équipe ».

- [ ] **Step 3: Implement Teams and the Builder composition**

Afficher les modes « Créer une équipe » et « Équipes partagées ». Le Builder
montre quatre portraits, le héros actif, ses trois armes, neuf équipements, les
états de configuration, les statistiques partielles, les presets, l'import de
captures, la note et les actions Nouvelle/Enregistrer. Les clics sur un slot
ouvrent une fiche de démonstration avec image et options.

- [ ] **Step 4: Implement both roster modes**

Afficher recherche, filtres, membre, compteur et cartes. La fiche du roster
personnel présente les trois builds, favori, copie, suppression, import depuis
une équipe, import de captures et comparateur DPS. Le roster d'un autre membre
cache les actions d'édition et affiche les commandes précédent/suivant.

- [ ] **Step 5: Implement the four tool panels**

Le panneau Wiki montre ses cinq catégories et une grille de héros réels. Le
panneau Collection montre progression et objets manquants. Le Calculateur
compare deux builds sur 60 s avec compétences, hypothèses et chronologie.
Analyse montre ses trois vues locales : ensemble, DPS par élément et Supports
Foudre. Chaque panneau possède au moins une interaction visible.

- [ ] **Step 6: Implement account and administration states**

Le panneau compte propose mode membre, hors ligne, migration locale,
déconnexion et mise à jour PWA. La vue Administration montre deux invités et
quatre membres avec des actions de démonstration accessibles uniquement en mode
administrateur activé depuis le panneau de démonstration.

- [ ] **Step 7: Style dense views without flattening their hierarchy**

Utiliser une bande de héros pour le Builder, des cartes verticales pour le
roster, un tableau compact pour le calculateur et des panneaux de collection
distincts. Les filtres deviennent collants dans la vue, pas dans toute la page.

- [ ] **Step 8: Run focused tests and commit**

Run: `node tests/refonte-maquette.test.js`

Run: `node tests/refonte-maquette.playwright.js`

Expected: deux PASS.

```powershell
git add -- docs/refonte-maquette tests/refonte-maquette.playwright.js
git commit -m "feat(refonte): couvrir equipes roster et outils"
```

---

### Task 6: Verrouiller responsive, clavier et contrôle visuel

**Files:**
- Modify: `docs/refonte-maquette/index.html`
- Modify: `docs/refonte-maquette/maquette.js`
- Modify: `docs/refonte-maquette/maquette.css`
- Modify: `docs/refonte-maquette/responsive.css`
- Modify: `tests/refonte-maquette.playwright.js`
- Create: `docs/refonte-maquette/README.md`

**Interfaces:**
- Consumes: toutes les vues et interactions des Tasks 1 à 5.
- Produces: prototype final à `/docs/refonte-maquette/` et instructions de revue.

- [ ] **Step 1: Add failing responsive and accessibility assertions**

Tester successivement 1440 × 1000, 1024 × 900, 390 × 844 et 320 × 700 :

```js
for(const viewport of [
  { width:1440, height:1000 }, { width:1024, height:900 },
  { width:390, height:844 }, { width:320, height:700 }
]){
  await page.setViewportSize(viewport);
  await page.goto(server.url + "/docs/refonte-maquette/#home");
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `débordement ${viewport.width}px : ${overflow}px`);
}
await page.setViewportSize({ width:390, height:844 });
await page.locator("#mobileMenuButton").focus();
await page.keyboard.press("Enter");
assert.equal(await page.locator("#mobileMenuButton").getAttribute("aria-expanded"), "true");
await page.keyboard.press("Escape");
assert.equal(await page.locator("#mobileMenuButton").getAttribute("aria-expanded"), "false");
```

Mesurer chaque bouton visible et exiger une hauteur et une largeur d'au moins
44 px, sauf liens textuels intégrés à une phrase.

- [ ] **Step 2: Run and capture the first responsive failure**

Run: `node tests/refonte-maquette.playwright.js`

Expected: FAIL sur le débordement ou une cible tactile avant ajustement.

- [ ] **Step 3: Fix all four responsive regimes**

Ajouter les contraintes `min-width:0`, `overflow-wrap:anywhere`, grilles à une
colonne, rails défilants locaux et marges sûres. À 320 px, aucun panneau ne doit
conserver une largeur minimale supérieure au viewport. À 1024 px, le héros
d'accueil passe en proportions 45/55 et les panneaux denses utilisent deux
colonnes au maximum.

- [ ] **Step 4: Complete keyboard and reduced-motion behavior**

Ajouter l'ouverture clavier des menus, Échap pour les fermer, focus capturé
dans la modale, restitution au déclencheur et styles `:focus-visible`. Sous
`@media (prefers-reduced-motion: reduce)`, couper transitions et animations.

- [ ] **Step 5: Write the prototype review guide**

`README.md` indique :

```markdown
# Maquette de refonte NOVA

Depuis la racine du dépôt :

    python -m http.server

Ouvrir `http://localhost:8000/docs/refonte-maquette/`.

La maquette n'utilise aucune donnée réelle. Le bouton Connexion active un état
de démonstration. Les routes, onglets, menus et modales sont cliquables.
```

Ajouter la liste des routes et préciser qu'aucune action n'est persistée.

- [ ] **Step 6: Generate review screenshots outside Git**

Ajouter à la fin du parcours Playwright, avant la fermeture du navigateur :

```js
if(process.env.NOVA_CAPTURE === "1"){
  await page.setViewportSize({ width:1440, height:1000 });
  await page.goto(server.url + "/docs/refonte-maquette/#home");
  await page.screenshot({ path:"apercu-refonte-desktop.png", fullPage:true });
  await page.setViewportSize({ width:390, height:844 });
  await page.reload();
  await page.screenshot({ path:"apercu-refonte-mobile.png", fullPage:true });
  await page.setViewportSize({ width:1440, height:1000 });
  await page.goto(server.url + "/docs/refonte-maquette/#boss");
  await page.screenshot({ path:"apercu-refonte-boss.png", fullPage:true });
}
```

Puis lancer :

```powershell
$env:NOVA_CAPTURE='1'; node tests/refonte-maquette.playwright.js
```

Cette commande produit :

- `apercu-refonte-desktop.png` à 1440 × 1000 ;
- `apercu-refonte-mobile.png` à 390 × 844 ;
- `apercu-refonte-boss.png` à 1440 × 1000 sur `#boss`.

Les trois images restent non suivies et servent uniquement à l'inspection
visuelle. Vérifier les alignements, la lisibilité, les recadrages d'image et la
densité. Corriger le CSS puis régénérer seulement si un défaut est visible.

- [ ] **Step 7: Run focused and full verification**

Run: `node tests/refonte-maquette.test.js`

Expected: PASS.

Run: `node tests/refonte-maquette.playwright.js`

Expected: PASS sans erreur navigateur.

Run: `npm test`

Expected: toutes les commandes unitaires et Playwright au vert, y compris les
deux nouveaux tests.

- [ ] **Step 8: Commit the final prototype**

```powershell
git add -- docs/refonte-maquette tests/refonte-maquette.test.js tests/refonte-maquette.playwright.js scripts/lancer-tests.js
git commit -m "feat(refonte): finaliser la maquette interactive"
```

Ne pas ajouter les captures PNG de revue.
