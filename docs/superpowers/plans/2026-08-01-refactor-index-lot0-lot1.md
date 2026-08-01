# Découpage de `index.html` — lots 0 et 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Avant toute chose :** lis
> [la passation](../specs/2026-08-01-refactor-index-passation.md) puis
> `git log --oneline main..HEAD`. Le journal fait foi, pas ce document.

**Goal:** Faire passer les six tests Playwright de `file://` à un serveur local
sans toucher à l'application, puis déplacer le script en ligne de `index.html`
vers `js/app.js` chargé en module ES.

**Architecture:** Le lot 0 paie seul la dette du harnais, sur du code inchangé,
pour que la branche ne soit jamais rouge. Le lot 1 est un déplacement pur, sans
réagencement. Le découpage par domaine ne commence qu'au lot 2, selon la recette
donnée en fin de document.

**Tech Stack:** HTML autonome, JavaScript, modules ES, `node:http` sans
dépendance, Playwright, tests Node existants.

## Global Constraints

- Aucune dépendance npm nouvelle : le serveur de test utilise `node:http`.
- Un lot = un commit, `npm test` vert avant de commiter.
- Le refactor ne change aucun comportement ; aucun test n'est modifié pour
  « passer », hors harnais.
- Ne jamais renormaliser les fins de ligne : `index.html` est en CRLF.
- Chaque fichier de `js/` rejoint `CORE_ASSETS` dans `sw.js`.
- Ne toucher ni `.claude/`, ni `.vscode/`, ni `.worktrees/`.
- Commentaires, libellés et messages de commit en français.

---

### Task 1 : serveur statique partagé pour les tests

**Files:**
- Create: `tests/helpers/serve.js`
- Test: `tests/serve.test.js`
- Modify: `package.json` (scripts `test` et `test:unit`)

**Interfaces:**
- Consumes: rien.
- Produces: `serveRepo()` → `Promise<{ url, close }>`. `url` est l'origine sans
  barre finale, par exemple `"http://127.0.0.1:53124"`. `close()` retourne une
  `Promise` résolue quand le serveur est arrêté.

- [ ] **Step 1: Écrire le test en échec**

Créer `tests/serve.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");

(async () => {
  const server = await serveRepo();
  try{
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/,
      "L'origine doit être locale et sur un port éphémère");

    // La racine sert index.html.
    const racine = await fetch(server.url + "/");
    assert.equal(racine.status, 200);
    assert.match(racine.headers.get("content-type"), /text\/html/);
    assert.match(await racine.text(), /<title>/i);

    // Un module doit être servi avec un type MIME exécutable, sinon le
    // navigateur refuse de l'évaluer.
    const script = await fetch(server.url + "/data.js");
    assert.equal(script.status, 200);
    assert.match(script.headers.get("content-type"), /javascript/);

    // Un fichier absent répond 404 sans faire tomber le serveur.
    assert.equal((await fetch(server.url + "/inexistant.js")).status, 404);

    // Aucun test ne doit pouvoir lire hors du dépôt.
    const dehors = await fetch(server.url + "/../../../etc/passwd");
    assert.ok([403, 404].includes(dehors.status),
      "Une remontée de chemin doit être refusée");
  }finally{
    await server.close();
  }
  console.log("serve.test.js OK");
})().catch(error => { console.error(error); process.exit(1); });
```

- [ ] **Step 2: Vérifier que le test échoue pour la bonne raison**

Run: `node tests/serve.test.js`

Expected: FAIL avec `Cannot find module './helpers/serve'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `tests/helpers/serve.js` :

```js
"use strict";

/* Serveur statique minimal pour les tests Playwright.
   Depuis le passage aux modules ES, `file://` ne convient plus : un
   `<script type="module">` y est bloqué par la politique d'origine. On sert
   donc le dépôt en http sur 127.0.0.1, qui est un contexte sécurisé pour les
   navigateurs. Aucune dépendance : `node:http` suffit. */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

const TYPES = {
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".mjs":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".webmanifest":"application/manifest+json; charset=utf-8",
  ".webp":"image/webp",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".svg":"image/svg+xml",
  ".ico":"image/x-icon"
};

async function serveRepo(){
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const target = path.resolve(ROOT, relative || "index.html");
    /* Un test ne doit jamais pouvoir lire en dehors du dépôt. */
    if(target !== ROOT && !target.startsWith(ROOT + path.sep)){
      response.writeHead(403);
      response.end();
      return;
    }
    fs.readFile(target, (error, body) => {
      if(error){
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "content-type":
          TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
        /* Sans cela, deux tests successifs peuvent recevoir une version
           périmée du fichier qu'on vient de modifier. */
        "cache-control":"no-store"
      });
      response.end(body);
    });
  });

  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    url:"http://127.0.0.1:" + port,
    close(){
      /* Playwright garde des connexions ouvertes : sans cette coupure
         explicite, `close()` ne rend jamais la main et le test se fige. */
      if(typeof server.closeAllConnections === "function"){
        server.closeAllConnections();
      }
      return new Promise(resolve => server.close(resolve));
    }
  };
}

module.exports = { serveRepo };
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node tests/serve.test.js`

Expected: PASS, affiche `serve.test.js OK`.

- [ ] **Step 5: Brancher sur npm**

Dans `package.json`, ajouter `node tests/serve.test.js && ` au tout début des
scripts `test` et `test:unit`, avant `python -m unittest tests/test_schema_sql.py`.

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/serve.js tests/serve.test.js package.json
git commit -m "test: servir le depot en http pour les tests navigateur"
```

---

### Task 2 : les six tests Playwright passent par le serveur

**Files:**
- Modify: `tests/scrollbars-invisibles.playwright.js:12`
- Modify: `tests/potentiel-commun.playwright.js:20-21`
- Modify: `tests/supabase-etape1.playwright.js:16-17`
- Modify: `tests/availability.playwright.js:195,295`
- Modify: `tests/accessibilite-mobile.playwright.js:222,349,614,1381,1480,1738,1793`
- Modify: `tests/pwa-update.playwright.js:8,137`

**Interfaces:**
- Consumes: `serveRepo()` de la tâche 1.
- Produces: rien de nouveau ; les six fichiers chargent désormais
  `server.url + "/index.html"`.

**L'application n'est pas touchée par cette tâche.** C'est ce qui garantit que
la branche reste verte.

- [ ] **Step 1: Convertir le fichier le plus simple**

Dans `tests/scrollbars-invisibles.playwright.js`, remplacer l'import :

```js
const { pathToFileURL } = require("node:url");
```

par :

```js
const { serveRepo } = require("./helpers/serve");
```

Démarrer le serveur au début du bloc `(async()=>{ … })()`, juste après
`chromium.launch()`, et le fermer dans le `finally` existant :

```js
  const server = await serveRepo();
```

```js
    await page.goto(server.url + "/index.html");
```

```js
  }finally{
    await browser.close();
    await server.close();
  }
```

- [ ] **Step 2: Vérifier ce fichier seul**

Run: `node tests/scrollbars-invisibles.playwright.js`

Expected: PASS.

Si le processus ne rend pas la main, c'est que `close()` attend des connexions :
vérifier que `closeAllConnections()` est bien appelé dans `serve.js`.

- [ ] **Step 3: Convertir les quatre fichiers suivants**

Appliquer exactement la même transformation à, dans cet ordre :

1. `tests/potentiel-commun.playwright.js`
2. `tests/supabase-etape1.playwright.js`
3. `tests/availability.playwright.js`
4. `tests/accessibilite-mobile.playwright.js`

Dans `availability.playwright.js`, les deux `page.goto` sont dans deux fonctions
différentes (`runMobileChecks` et le bloc principal). Passer `server.url` en
argument à `runMobileChecks(browser, baseUrl)` plutôt que de démarrer deux
serveurs.

Dans `accessibilite-mobile.playwright.js`, les sept `goto` sont dans le même
bloc : un seul serveur en tête suffit.

Vérifier après chaque fichier :

```bash
node tests/potentiel-commun.playwright.js
node tests/supabase-etape1.playwright.js
node tests/availability.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: PASS à chaque fois.

- [ ] **Step 4: Convertir le test PWA, qui est le cas à risque**

`tests/pwa-update.playwright.js` installe un **faux** `navigator.serviceWorker`
par `Object.defineProperty(navigator, "serviceWorker", …)` (ligne ~96).

En `file://`, `navigator.serviceWorker` n'existe pas. En `http://127.0.0.1`, il
existe : la redéfinition peut échouer si la propriété n'est pas configurable.

Remplacer `PAGE_URL` par l'URL du serveur, puis lancer :

Run: `node tests/pwa-update.playwright.js`

Expected: PASS.

**Si le test échoue sur la redéfinition**, ajouter `configurable:true` au
descripteur et repasser par `Object.defineProperty` sur `navigator` lui-même.
Si l'échec persiste, **ne pas affaiblir le test** : consigner le blocage dans la
passation, commiter les cinq fichiers déjà convertis, et demander un arbitrage.

- [ ] **Step 5: Vérifier l'ensemble**

Run: `npm test`

Expected: PASS, exit 0.

- [ ] **Step 6: Vérifier qu'aucun `file://` ne subsiste**

Run: `grep -rn "pathToFileURL" tests/`

Expected: aucune occurrence dans les fichiers `.playwright.js`.

- [ ] **Step 7: Commit**

```bash
git add tests/
git commit -m "test: charger le site par http au lieu de file://"
```

---

### Task 3 : pivot du script en ligne vers `js/app.js`

**Files:**
- Create: `js/app.js`
- Modify: `index.html` (le bloc `<script>` principal, lignes ~1997 à ~12435)
- Modify: `sw.js` (`CORE_ASSETS`)
- Modify: `tests/helpers/load-app.js` (source lue)
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: le harnais http de la tâche 2.
- Produces: `js/app.js`, module ES contenant l'intégralité de l'ancien script en
  ligne, chargé par `<script type="module" src="js/app.js"></script>`.

**Relever les bornes réelles avant de couper**, elles ont bougé :

```bash
grep -n "<script>" index.html
grep -n "</script>" index.html
```

- [ ] **Step 1: Déplacer le script sans le modifier**

Créer `js/app.js` avec le contenu exact du bloc `<script>` principal — celui qui
contient `(function(){` — **sans les balises**, et sans changer une seule ligne
du code.

Dans `index.html`, remplacer ce bloc par :

```html
<script type="module" src="js/app.js"></script>
```

Les deux petits blocs `<script>` de fin de fichier (service worker, header
rétractable) **restent en ligne et classiques** : ils sont volontairement hors
du bac à sable des tests unitaires.

- [ ] **Step 2: Déclarer le fichier au service worker**

Dans `sw.js`, ajouter `"./js/app.js"` au tableau `CORE_ASSETS`, après
`"./supabase-config.js"`.

- [ ] **Step 3: Adapter le chargeur des tests unitaires**

Dans `tests/helpers/load-app.js`, remplacer la lecture du script en ligne :

```js
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1]);
  const source = scripts.find(script => script.includes("(function(){"));
  assert.ok(source, "Le script principal inline doit exister");
```

par :

```js
  /* Depuis le lot 1, le script principal vit dans js/app.js. Il sera découpé en
     plusieurs modules : MODULES tient l'ordre de concaténation, qui doit rester
     identique à l'ordre de chargement déclaré dans index.html. */
  const source = MODULES
    .map(name => fs.readFileSync(path.join(ROOT, "js", name), "utf8"))
    .join("\n");
  assert.ok(source.includes("(function(){"), "Le script principal doit exister");
```

et déclarer en tête de fichier :

```js
/* Ordre de concaténation des modules, identique à l'ordre de chargement.
   Toute extraction ajoute son fichier ICI, avant celui qui le consomme. */
const MODULES = ["app.js"];
```

- [ ] **Step 4: Vérifier les tests unitaires**

Run: `npm run test:unit`

Expected: PASS. Les quatorze fichiers qui passent par `loadApp()` doivent
fonctionner sans avoir été modifiés.

- [ ] **Step 5: Vérifier les tests navigateur**

Run: `npm run test:e2e`

Expected: PASS. C'est ici que se vérifie que le module se charge bien en http.

- [ ] **Step 6: Corriger la documentation devenue fausse**

Dans `AGENTS.md`, la section « Comment lancer » affirme :

> Double-clic sur `index.html` ou ouvrir le site GitHub Pages. Aucun serveur,
> aucune install, aucun build.

La remplacer par :

```markdown
Ouvrir le site GitHub Pages. Aucune install, aucun build.

⚠️ Le double-clic sur `index.html` ne fonctionne plus depuis le passage aux
modules ES : un `<script type="module">` est bloqué en `file://` par la
politique d'origine des navigateurs. Pour essayer une modification en local,
servir le dépôt en http, par exemple `python -m http.server`, puis ouvrir
`http://localhost:8000/`.
```

Corriger de même la phrase « L'appli reste un site statique ouvrable en
`file://` ou via GitHub Pages » plus haut dans le fichier.

- [ ] **Step 7: Vérification complète**

Run: `npm test`

Expected: PASS, exit 0.

- [ ] **Step 8: Commit**

```bash
git add index.html js/app.js sw.js tests/helpers/load-app.js AGENTS.md
git commit -m "refactor: sortir le script principal vers js/app.js en module"
```

---

## Recette des lots suivants (2 à n)

Ces lots ne sont pas détaillés un par un : ils suivent tous la même procédure.
**Un domaine par lot, jamais deux.**

Pour chaque domaine, dans l'ordre des feuilles vers le tronc :

1. **Relever les frontières réelles** dans `js/app.js` :

   ```bash
   grep -nE "^  /\* =+ .* =+ \*/|^  const [A-Z][A-Za-z]+ = \(function\(\)\{" js/app.js
   ```

2. **Créer `js/<domaine>.js`** et y déplacer le bloc, sans rien réécrire.

3. **Déclarer les sorties** : `export` sur chaque fonction ou constante
   consommée ailleurs. Ne rien exporter d'autre — ce qui n'est pas exporté
   devient privé, et c'est le bénéfice recherché.

4. **Déclarer les entrées** : `import { … } from "./<autre>.js";` en tête.

5. **Ajouter le fichier à trois endroits, sans en oublier un** :
   - `index.html` n'a rien à changer si le module est importé par `app.js` ;
   - `CORE_ASSETS` dans `sw.js` ;
   - `MODULES` dans `tests/helpers/load-app.js`, **avant** le fichier qui le
     consomme.

6. **Neutraliser `import`/`export` pour le `vm`.** Le chargeur concatène les
   fichiers dans une portée commune : les lignes de module y sont illégales.
   Ajouter dans `load-app.js`, avant l'exécution :

   ```js
   /* La concaténation place tous les symboles dans une même portée : les
      déclarations de module n'y ont plus de sens et casseraient le `vm`. */
   const sansModules = source
     .replace(/^\s*import\s[^;]*;\s*$/gm, "")
     .replace(/^\s*export\s+(?=(const|let|function|class)\s)/gm, "")
     .replace(/^\s*export\s*\{[^}]*\}\s*;\s*$/gm, "");
   ```

   et exécuter `sansModules` au lieu de `source`.

7. **Vérifier** : `npm test`. Si un test échoue, le domaine n'était pas
   autonome — remettre le bloc dans `app.js` et couper ailleurs plutôt que de
   forcer.

8. **Commiter** avec un message qui nomme le domaine, par exemple
   `refactor: extraire le domaine des dispos vers js/dispos.js`.

9. **Mettre à jour la passation dans le même commit** : la section « Où en
   est-on » doit dire quel domaine vient de sortir et lequel suit.

Ordre proposé, à confirmer par le relevé des dépendances réelles :
`dates`, `masques-dispos`, `modal-stack`, `toast`, `supabase`, puis les vues
`roster`, `builder`, `boss`, `dispos`, `analyse`, `suivi`, `app.js` finissant
réduit au démarrage et au câblage des onglets.

## Vérification finale du chantier

- [ ] `npm test` passe intégralement.
- [ ] `grep -rn "pathToFileURL" tests/` ne renvoie plus rien pour les
      `.playwright.js`.
- [ ] Chaque fichier de `js/` figure dans `CORE_ASSETS` de `sw.js` **et** dans
      `MODULES` de `tests/helpers/load-app.js`.
- [ ] `AGENTS.md` ne promet plus le double-clic.
- [ ] Le site déployé fonctionne : les modules sont servis en `https` par
      GitHub Pages.
