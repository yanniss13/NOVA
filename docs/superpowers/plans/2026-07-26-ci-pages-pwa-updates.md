# CI GitHub Pages et mises à jour PWA — Plan d’implémentation

> **Pour Codex :** compétence requise pendant l’exécution :
> `superpowers:executing-plans`. Implémenter les tâches dans l’ordre, avec
> `superpowers:test-driven-development`, puis terminer par
> `superpowers:verification-before-completion`.

**Objectif :** empêcher tout déploiement GitHub Pages si la suite de tests
échoue et proposer explicitement aux visiteurs d’activer une nouvelle version
de la PWA.

**Architecture :** une Action GitHub teste toutes les contributions. Sur
`main` seulement, elle fabrique une copie propre du commit testé, injecte son
SHA dans `sw.js`, puis publie cet artefact sur Pages. Le service worker garde
la nouvelle version en attente jusqu’à l’action de l’utilisateur. Un bandeau
dans `index.html` commande son activation et recharge la page une seule fois
après `controllerchange`.

**Technologies :** GitHub Actions, GitHub Pages, Node.js 24 LTS, Playwright
Chromium, service workers, Cache Storage, HTML/CSS/JavaScript autonome.

**Spécification :**
`docs/superpowers/specs/2026-07-26-ci-pages-pwa-updates-design.md`

---

## Tâche 1 — Verrouiller le contrat du workflow Pages

**Fichiers :**

- Créer : `tests/pages-workflow.test.js`
- Modifier : `package.json`
- Créer : `.github/workflows/pages.yml`

### Étape 1 : écrire le test statique en échec

Créer `tests/pages-workflow.test.js`. Le test doit lire le workflow comme du
texte, sans ajouter de dépendance YAML, puis vérifier :

- les déclencheurs `push`, `pull_request` sur `main` et `workflow_dispatch` ;
- `actions/checkout@v6`, `actions/setup-node@v6`,
  `actions/setup-python@v6` ;
- Node `24`, Python `3.13`, `npm ci`,
  `npx playwright install --with-deps chromium` et `npm test` ;
- un job de paquetage avec `needs: test`, absent des pull requests ;
- la création de `_site` depuis `git archive HEAD` ;
- le remplacement obligatoire de `__BUILD_VERSION__` par `${GITHUB_SHA}` ;
- `actions/configure-pages@v5`, `actions/upload-pages-artifact@v4` et
  `actions/deploy-pages@v4` ;
- un job de déploiement avec `needs: package`, l’environnement
  `github-pages`, `pages: write` et `id-token: write`.

Squelette attendu :

```js
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const workflowPath = path.join(ROOT, ".github", "workflows", "pages.yml");
assert.ok(fs.existsSync(workflowPath), "workflow Pages manquant");

const yaml = fs.readFileSync(workflowPath, "utf8");
const required = [
  /push:\s*\n\s*branches:\s*\[main\]/,
  /pull_request:\s*\n\s*branches:\s*\[main\]/,
  /workflow_dispatch:/,
  /actions\/checkout@v6/,
  /actions\/setup-node@v6/,
  /node-version:\s*["']?24["']?/,
  /actions\/setup-python@v6/,
  /python-version:\s*["']?3\.13["']?/,
  /npm ci/,
  /npx playwright install --with-deps chromium/,
  /npm test/,
  /git archive HEAD/,
  /__BUILD_VERSION__/,
  /GITHUB_SHA/,
  /actions\/configure-pages@v5/,
  /actions\/upload-pages-artifact@v4/,
  /actions\/deploy-pages@v4/,
  /pages:\s*write/,
  /id-token:\s*write/,
  /name:\s*github-pages/
];
required.forEach(pattern =>
  assert.match(yaml, pattern, "contrat manquant : " + pattern)
);
assert.ok(
  (yaml.match(/needs:\s*test/g) || []).length >= 1,
  "le paquetage doit dépendre des tests"
);
assert.ok(
  (yaml.match(/github\.event_name != 'pull_request'/g) || []).length >= 2,
  "paquetage et déploiement doivent être exclus des pull requests"
);
assert.match(yaml, /deploy:[\s\S]*needs:\s*package/);

console.log("PASS workflow Pages : tests obligatoires avant déploiement");
```

Ajouter `node tests/pages-workflow.test.js` au début de `test` et
`test:unit` dans `package.json`.

### Étape 2 : vérifier l’échec

Exécuter :

```powershell
node tests/pages-workflow.test.js
```

Résultat attendu : échec `workflow Pages manquant`.

### Étape 3 : créer le workflow minimal

Créer `.github/workflows/pages.yml` :

```yaml
name: Tests et déploiement GitHub Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
          cache: npm
      - uses: actions/setup-python@v6
        with:
          python-version: "3.13"
      - name: Installer les dépendances Node
        run: npm ci
      - name: Installer Chromium
        run: npx playwright install --with-deps chromium
      - name: Tester le site
        run: npm test

  package:
    if: github.event_name != 'pull_request'
    needs: test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
      - name: Préparer le commit testé
        shell: bash
        run: |
          mkdir _site
          git archive HEAD | tar -x -C _site
          grep -q "__BUILD_VERSION__" _site/sw.js
          sed -i "s/__BUILD_VERSION__/${GITHUB_SHA}/g" _site/sw.js
          ! grep -q "__BUILD_VERSION__" _site/sw.js
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: _site

  deploy:
    if: github.event_name != 'pull_request'
    needs: package
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Publier GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Ne pas modifier `boss-reminder.yml` : son calendrier et ses secrets sont
indépendants du déploiement du site.

### Étape 4 : vérifier le test

Exécuter :

```powershell
node tests/pages-workflow.test.js
npm run test:unit
```

Résultat attendu : les deux commandes réussissent.

### Étape 5 : commit intermédiaire

```powershell
git add .github/workflows/pages.yml tests/pages-workflow.test.js package.json
git commit -m "ci: gate Pages deployment on tests"
```

---

## Tâche 2 — Rendre le cycle de vie du service worker explicite

**Fichiers :**

- Modifier : `tests/pwa.test.js`
- Modifier : `sw.js`

### Étape 1 : étendre le test en échec

Remplacer l’ancienne assertion `conf7ds-v\d+` dans `tests/pwa.test.js` par des
assertions qui imposent :

```js
assert.match(
  sw,
  /const BUILD_VERSION = "__BUILD_VERSION__";/,
  "marqueur de version de déploiement requis"
);
assert.match(
  sw,
  /const CACHE = CACHE_PREFIX \+ BUILD_VERSION;/,
  "le cache doit dépendre du commit déployé"
);
assert.doesNotMatch(
  sw.match(/self\.addEventListener\("install"[\s\S]*?\n\}\);/)?.[0] || "",
  /skipWaiting/,
  "une mise à jour ne doit pas s'activer sans accord"
);
assert.match(sw, /event\.data\.type === "SKIP_WAITING"/);
assert.match(sw, /CORE_PATHS/);
assert.match(sw, /isImage/);
assert.match(sw, /networkFirst/);
assert.match(sw, /staleWhileRevalidate/);
```

Conserver les assertions existantes sur Supabase, jsDelivr et la purge des
anciens caches.

### Étape 2 : vérifier l’échec

Exécuter :

```powershell
node tests/pwa.test.js
```

Résultat attendu : échec sur le marqueur `__BUILD_VERSION__`.

### Étape 3 : réécrire `sw.js`

Conserver la liste actuelle des fichiers de base et appliquer cette structure :

```js
const BUILD_VERSION = "__BUILD_VERSION__";
const CACHE_PREFIX = "conf7ds-";
const CACHE = CACHE_PREFIX + BUILD_VERSION;
const CORE_ASSETS = [
  "./", "./index.html",
  "./data.js", "./potentiels.js", "./armures-liees.js",
  "./personnages-meta.js", "./supabase-config.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png"
];
const CORE_PATHS = new Set(
  CORE_ASSETS.map(asset => new URL(asset, self.registration.scope).pathname)
);
```

Implémenter ensuite :

1. `install` : `cache.addAll(CORE_ASSETS)` sans `skipWaiting()`.
2. `message` : appeler `self.skipWaiting()` uniquement pour
   `{type:"SKIP_WAITING"}` et rattacher la promesse à `event.waitUntil`.
3. `activate` : supprimer uniquement les caches commençant par
   `CACHE_PREFIX` et différents de `CACHE`, puis `clients.claim()`.
4. `networkFirst(request, fallbackKey)` :
   - essaie le réseau ;
   - stocke seulement une réponse `ok` ;
   - en erreur, restitue la requête en cache, puis la clé de repli ;
   - finit par `Response.error()` si rien n’existe.
5. `staleWhileRevalidate(event, request)` :
   - démarre immédiatement la requête réseau ;
   - rattache sa mise en cache à `event.waitUntil` ;
   - répond tout de suite depuis le cache quand disponible ;
   - sinon attend le réseau, puis utilise `Response.error()` en dernier recours.
6. `fetch` :
   - ignorer les méthodes autres que `GET` ;
   - laisser Supabase et jsDelivr entièrement au réseau ;
   - ne traiter que la même origine ;
   - navigation : `networkFirst(request, "./index.html")` ;
   - chemin présent dans `CORE_PATHS` : `networkFirst(request)` ;
   - image (`request.destination === "image"` ou extension locale
     `webp|png|jpg|jpeg|gif|svg|ico`) : `staleWhileRevalidate` ;
   - autres ressources locales : `networkFirst`.

Le fichier source garde littéralement `__BUILD_VERSION__`. Seule la copie
`_site/sw.js` reçoit le SHA pendant l’Action.

### Étape 4 : vérifier le contrat PWA

Exécuter :

```powershell
node tests/pwa.test.js
npm run test:unit
```

Résultat attendu : succès, avec le message PWA mis à jour pour mentionner le
cycle de mise à jour explicite.

### Étape 5 : commit intermédiaire

```powershell
git add sw.js tests/pwa.test.js
git commit -m "feat: stage PWA updates before activation"
```

---

## Tâche 3 — Ajouter le bandeau « Nouvelle version disponible »

**Fichiers :**

- Créer : `tests/pwa-update.playwright.js`
- Modifier : `package.json`
- Modifier : `index.html`
- Modifier : `tests/accessibilite-mobile.playwright.js`

### Étape 1 : écrire le parcours Playwright en échec

Créer un faux `navigator.serviceWorker` avec `page.addInitScript` avant
l’ouverture de `index.html`. Il doit fournir :

- `register()` retournant une inscription dotée d’un worker `waiting` ;
- `addEventListener()` pour `updatefound` et `controllerchange` ;
- un worker dont `postMessage()` enregistre les messages dans
  `window.__pwaTest.messages` ;
- `registration.update()` qui incrémente
  `window.__pwaTest.updateCalls` ;
- une méthode de test qui émet deux fois `controllerchange` de manière
  synchrone ;
- un compteur de chargements conservé dans `sessionStorage`, afin de constater
  un seul rechargement réel.

Le test doit vérifier :

1. le bandeau `#pwaUpdateBanner` devient visible pour un worker déjà en
   attente ;
2. le bouton `#pwaUpdateClose` masque le bandeau sans envoyer de message ;
3. après une nouvelle notification d’attente, `#pwaUpdateApply` envoie
   exactement `{type:"SKIP_WAITING"}` ;
4. pendant l’activation, le bouton est désactivé et affiche
   `Mise à jour…` ;
5. deux événements `controllerchange` consécutifs causent exactement un
   rechargement ;
6. une première installation sans contrôleur n’affiche pas le bandeau.

Ajouter `node tests/pwa-update.playwright.js` à la fin de `test` et
`test:e2e`.

### Étape 2 : vérifier l’échec

Exécuter :

```powershell
node tests/pwa-update.playwright.js
```

Résultat attendu : échec car `#pwaUpdateBanner` n’existe pas.

### Étape 3 : ajouter le HTML et le style

Placer le bandeau juste avant `#toast` :

```html
<aside class="pwa-update" id="pwaUpdateBanner"
       aria-labelledby="pwaUpdateText" hidden>
  <p id="pwaUpdateText" role="status" aria-live="polite">
    Nouvelle version disponible
  </p>
  <button class="btn btn-primary" id="pwaUpdateApply" type="button">
    Mettre à jour
  </button>
  <button class="icon-btn" id="pwaUpdateClose" type="button"
          aria-label="Masquer la mise à jour">×</button>
</aside>
```

Ajouter près du style du toast :

```css
.pwa-update{
  position:fixed;z-index:79;left:50%;
  bottom:calc(24px + env(safe-area-inset-bottom));
  width:min(620px,calc(100vw - 24px));max-width:calc(100% - 24px);
  transform:translateX(-50%);display:flex;align-items:center;gap:10px;
  padding:10px 12px;border:1px solid var(--gold-deep);border-radius:12px;
  background:var(--panel-2);box-shadow:var(--shadow);color:var(--parchment)
}
.pwa-update[hidden]{display:none}
.pwa-update p{flex:1;min-width:0;margin:0;font-size:14px}
.pwa-update .btn,.pwa-update .icon-btn{flex:none;min-height:44px}
@media(max-width:560px){
  .pwa-update{align-items:stretch;flex-wrap:wrap}
  .pwa-update p{flex-basis:calc(100% - 54px);align-self:center}
  .pwa-update #pwaUpdateApply{order:3;flex:1 0 100%}
}
```

Vérifier que le bandeau ne recouvre pas le toast lorsqu’ils sont affichés
ensemble ; si nécessaire, monter le toast au-dessus du bandeau visible avec
une classe d’état, sans ajouter de débordement horizontal.

### Étape 4 : remplacer l’enregistrement simple par le contrôleur de mise à jour

Dans le dernier `<script>` de `index.html`, conserver l’enregistrement au
`load`, mais encapsuler la logique. L’état minimal est :

```js
let registration = null;
let waitingWorker = null;
let dismissedWorker = null;
let activationRequested = false;
let reloadStarted = false;
let lastUpdateCheck = 0;
const UPDATE_INTERVAL = 60 * 60 * 1000;
```

Implémenter :

- `showUpdate(worker)` : mémorise le worker et révèle le bandeau, sauf si ce
  même worker a été fermé ;
- fermeture : mémorise `dismissedWorker` et masque le bandeau ;
- clic « Mettre à jour » : passe le bouton en
  `disabled`/`Mise à jour…`, pose `activationRequested = true`, puis envoie
  `{type:"SKIP_WAITING"}` au worker ; restaurer le bouton si `postMessage`
  échoue ;
- `controllerchange` : ne rien faire sans demande d’activation ; avec une
  demande, protéger par `reloadStarted` puis appeler une seule fois
  `window.location.reload()` ;
- après `register("sw.js")`, montrer immédiatement `registration.waiting` ;
- sur `updatefound`, écouter le `statechange` de `registration.installing` et
  montrer le worker lorsqu’il atteint `installed` alors qu’un contrôleur
  existe déjà ;
- appeler `registration.update()` une première fois, puis toutes les
  60 minutes ;
- refaire une vérification au retour au premier plan si la dernière remonte à
  plus de 60 minutes ;
- absorber les erreurs d’enregistrement et de vérification : le site et le
  mode hors ligne doivent rester utilisables.

La garde `activationRequested` est obligatoire : le `clients.claim()` de la
première installation ne doit jamais provoquer un rechargement surprise.

### Étape 5 : couvrir le mobile

Dans la boucle 320/390 px de `tests/accessibilite-mobile.playwright.js`,
forcer temporairement `#pwaUpdateBanner.hidden = false`, puis vérifier :

- débordement horizontal du document inférieur ou égal à 1 px ;
- hauteur et largeur tactiles des deux boutons au moins égales à 44 px ;
- texte, bouton principal et fermeture sans superposition.

Remasquer le bandeau avant de poursuivre les autres modales.

### Étape 6 : exécuter les tests ciblés

```powershell
node tests/pwa-update.playwright.js
node tests/accessibilite-mobile.playwright.js
npm run test:e2e
```

Résultat attendu : tous les tests réussissent et aucune erreur de page n’est
rapportée.

### Étape 7 : commit intermédiaire

```powershell
git add index.html package.json tests/pwa-update.playwright.js tests/accessibilite-mobile.playwright.js
git commit -m "feat: let users activate PWA updates"
```

---

## Tâche 4 — Documenter, vérifier et préparer l’activation Pages

**Fichiers :**

- Modifier : `AGENTS.md`

### Étape 1 : documenter l’état opérationnel

Ajouter dans `AGENTS.md` :

- l’Action teste les pull requests et les pushes vers `main` ;
- seul un commit de `main` dont `npm test` réussit est publié ;
- le SHA du commit devient la version du cache PWA ;
- les visiteurs appliquent une version via le bandeau ;
- GitHub Pages doit utiliser une fois pour toutes
  `Settings → Pages → Source → GitHub Actions`.

Préciser qu’aucun secret Supabase n’est nécessaire pour le workflow Pages et
que `boss-reminder.yml` conserve ses propres secrets.

### Étape 2 : lancer la vérification complète

```powershell
npm test
git diff --check
git status --short
```

Résultat attendu :

- tous les tests Node, Python et Playwright réussissent ;
- `git diff --check` ne signale rien ;
- seul `AGENTS.md` reste non commité à cette étape.

### Étape 3 : commit de documentation

```powershell
git add AGENTS.md
git commit -m "docs: explain tested Pages releases"
```

### Étape 4 : revue finale avant intégration

Appliquer `superpowers:requesting-code-review`, corriger les constats valides,
puis relancer :

```powershell
npm test
git diff --check
git status --short
git log --oneline -5
```

La branche est prête seulement si la suite complète est verte et le worktree
est propre.

### Étape 5 : intégration et opération manuelle

Appliquer `superpowers:finishing-a-development-branch`. Après intégration dans
`main` et push autorisé :

1. ouvrir le dépôt GitHub ;
2. aller dans `Settings → Pages` ;
3. choisir `GitHub Actions` dans **Source** ;
4. ouvrir l’onglet `Actions` et attendre la réussite de
   **Tests et déploiement GitHub Pages** ;
5. ouvrir l’URL Pages indiquée par le job `deploy` ;
6. lors d’un déploiement ultérieur, laisser un ancien onglet ouvert et
   confirmer que le bandeau apparaît, puis que « Mettre à jour » recharge une
   seule fois vers la nouvelle version.

Le changement de source Pages est le seul réglage manuel requis pour cette
phase.
