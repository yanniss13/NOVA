# Dossier jury DWWM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer un dossier DWWM complet et prêt à soutenir pour Site Confrérie 7DS, avec documents sourcés, diagrammes, captures réelles, support oral, PDF et contrôles reproductibles.

**Architecture:** Le dossier `docs/jury/` est la source éditoriale ; un manifeste JSON en décrit les livrables et un validateur Node contrôle structure, liens et absence de contenu hérité de MoniteurConnect. Les captures et rendus utilisent Playwright avec le serveur et le faux Supabase déjà employés par les tests, tandis qu’un script Python exporte les Markdown en PDF puis vérifie leur lisibilité.

**Tech Stack:** Markdown, HTML/CSS/JavaScript, SVG, Node.js, Playwright, Python 3, Python-Markdown, pypdf, GitHub Actions, Supabase/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-11-dossier-jury-dwwm-design.md`

## Global Constraints

- La certification ciblée est le TP Développeur web et web mobile RNCP37674, valable du 1er septembre 2023 au 1er septembre 2028.
- Aucun texte, écran, chiffre, schéma ou résultat de conformité propre à MoniteurConnect ne doit subsister dans `docs/jury/`.
- Toute affirmation technique ou quantitative doit citer un fichier, une commande, un résultat daté ou une source officielle.
- Les limites de Supabase, des Edge Functions, de la PWA et du calculateur doivent être annoncées sans transformer une hypothèse en preuve.
- Les captures utilisent uniquement les données synthétiques de `tests/helpers/faux-supabase.js` ou des données locales anonymes.
- L’application livrée reste statique et sans nouvelle dépendance d’exécution ; les dépendances ajoutées sont réservées à la documentation et au développement.
- Les fichiers générés sous `data/` ne sont jamais modifiés à la main.
- Les deux fichiers non suivis préexistants sous `assets/ambiance/` restent hors staging.
- Chaque tâche se termine par une vérification ciblée et un commit limité à ses propres fichiers.

---

### Task 1: Manifeste et garde-fous du dossier

**Files:**
- Create: `docs/jury/manifest.json`
- Create: `scripts/verifier-dossier-jury.js`
- Create: `tests/jury-dossier.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: racine du dépôt obtenue avec `path.resolve(__dirname, "..")`.
- Produces: `verifierDossier({ root, requireGenerated }): { errors: string[], stats: object }` et la commande `node scripts/verifier-dossier-jury.js [--complet]`.

- [ ] **Step 1: Écrire le test rouge du validateur**

Créer un dossier temporaire dans `tests/jury-dossier.test.js`, y placer un
manifeste qui exige `README.md`, puis vérifier qu’un lien cassé et le nom du
projet interdit sont tous deux signalés :

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verifierDossier } = require("../scripts/verifier-dossier-jury");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "jury-7ds-"));
fs.mkdirSync(path.join(root, "docs", "jury"), { recursive:true });
fs.writeFileSync(path.join(root, "docs", "jury", "manifest.json"), JSON.stringify({
  required:["README.md"], generated:[], forbidden:["MoniteurConnect"]
}));
fs.writeFileSync(path.join(root, "docs", "jury", "README.md"),
  "# Jury\nMoniteurConnect\n[absent](absent.md)\n");
const result = verifierDossier({ root, requireGenerated:false });
assert.ok(result.errors.some(item => item.includes("MoniteurConnect")));
assert.ok(result.errors.some(item => item.includes("absent.md")));
console.log("jury-dossier.test.js: OK");
```

- [ ] **Step 2: Vérifier que le test échoue faute de module**

Run: `node tests/jury-dossier.test.js`

Expected: FAIL avec `Cannot find module '../scripts/verifier-dossier-jury'`.

- [ ] **Step 3: Implémenter le validateur minimal**

Dans `scripts/verifier-dossier-jury.js`, exporter `verifierDossier`, parcourir
les fichiers déclarés dans `manifest.json`, lire les Markdown en UTF-8 et
résoudre les liens relatifs sans fragments. Ignorer les liens `http:`, `https:`,
`mailto:` et les ancres. Le mode `--complet` exige aussi chaque chemin de
`generated`. Le programme doit afficher le nombre de fichiers contrôlés, le
nombre de liens et toutes les erreurs, puis sortir avec le code 1 si la liste
n’est pas vide.

```js
function verifierDossier({ root, requireGenerated }) {
  const jury = path.join(root, "docs", "jury");
  const manifest = JSON.parse(fs.readFileSync(path.join(jury, "manifest.json"), "utf8"));
  const errors = [];
  const attendus = [...manifest.required,
    ...(requireGenerated ? manifest.generated : [])];
  for (const relatif of attendus) {
    if (!fs.existsSync(path.join(jury, relatif))) errors.push("Absent: " + relatif);
  }
  let links = 0;
  for (const relatif of manifest.required.filter(file => file.endsWith(".md"))) {
    const source = path.join(jury, relatif);
    if (!fs.existsSync(source)) continue;
    const text = fs.readFileSync(source, "utf8");
    for (const forbidden of manifest.forbidden) {
      if (text.toLowerCase().includes(forbidden.toLowerCase())) {
        errors.push(`Terme interdit dans ${relatif}: ${forbidden}`);
      }
    }
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const raw = match[1].trim().replace(/^<|>$/g, "");
      if (/^(https?:|mailto:|#)/i.test(raw)) continue;
      links++;
      const target = decodeURIComponent(raw.split("#", 1)[0]);
      if (target && !fs.existsSync(path.resolve(path.dirname(source), target))) {
        errors.push(`Lien absent dans ${relatif}: ${target}`);
      }
    }
  }
  return { errors, stats:{ files:attendus.length, links } };
}
```

- [ ] **Step 4: Déclarer le manifeste initial**

`manifest.json` contient quatre listes : `required`, `generated`, `forbidden`
et `externalSources`. `required` liste les 16 Markdown de premier niveau, les
trois livrables de soutenance et les quatre SVG ; `generated` liste les PNG,
captures et PDF ; `forbidden` contient
`MoniteurConnect`, `moniteur-connect` et les noms de ses parcours ;
`externalSources` contient la fiche France Compétences RNCP37674.

- [ ] **Step 5: Ajouter le test à la suite unitaire**

Ajouter `node tests/jury-dossier.test.js` à la fin de `SUITES.unit` dans
`scripts/lancer-tests.js`.

- [ ] **Step 6: Vérifier le garde-fou**

Run: `node tests/jury-dossier.test.js`

Expected: `jury-dossier.test.js: OK`.

Run: `node scripts/verifier-dossier-jury.js`

Expected: échec listant les livrables éditoriaux encore absents, ce qui prouve
que le manifeste détecte un dossier incomplet.

- [ ] **Step 7: Commit**

```bash
git add docs/jury/manifest.json scripts/verifier-dossier-jury.js tests/jury-dossier.test.js scripts/lancer-tests.js
git commit -m "test(jury): ajouter les garde-fous du dossier DWWM"
```

### Task 2: Inventaire reproductible des preuves du dépôt

**Files:**
- Create: `scripts/inventorier-jury.js`
- Create: `docs/jury/preuves/inventaire.json`
- Create: `docs/jury/preuves/README.md`
- Test: `tests/jury-inventaire.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `package.json`, `scripts/lancer-tests.js`, `tests/helpers/modules.js`, `supabase/schema.sql`, `.github/workflows/pages.yml`, `sw.js` et l’arborescence Git suivie.
- Produces: `collecterInventaire(root): InventaireJury` et `docs/jury/preuves/inventaire.json` généré de manière déterministe.

- [ ] **Step 1: Écrire le test rouge de l’inventaire**

```js
"use strict";
const assert = require("node:assert/strict");
const path = require("node:path");
const { collecterInventaire } = require("../scripts/inventorier-jury");
const data = collecterInventaire(path.resolve(__dirname, ".."));
assert.equal(data.project, "site-confrerie-7ds");
assert.ok(data.modules.total > 0);
assert.ok(data.tests.unit > 0 && data.tests.e2e > 0);
assert.ok(data.database.tables.includes("profiles"));
assert.ok(data.database.rpcs.length > 0);
assert.equal(data.deployment.provider, "GitHub Pages");
console.log("jury-inventaire.test.js: OK");
```

- [ ] **Step 2: Vérifier l’échec initial**

Run: `node tests/jury-inventaire.test.js`

Expected: FAIL avec `Cannot find module '../scripts/inventorier-jury'`.

- [ ] **Step 3: Implémenter la collecte sans écrire de métrique à la main**

Parser les listes `unit` et `e2e` du lanceur, charger `MODULES`, extraire les
`create table` et `create or replace function` du schéma par expressions
régulières ancrées, et détecter `actions/deploy-pages` dans le workflow. Le JSON
doit inclure `generatedAt`, `gitHead`, `modules`, `tests`, `database`,
`deployment`, `pwa` et `catalogues`.

```js
function nomsSql(source, motif) {
  return [...source.matchAll(motif)].map(match => match[1]).sort();
}
function commandesSuite(source, nom) {
  const match = new RegExp(`${nom}:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`).exec(source);
  if (!match) throw new Error(`Suite absente: ${nom}`);
  return [...match[1].matchAll(/"([^"\n]+)"/g)].map(item => item[1]);
}
function collecterInventaire(root) {
  const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "pages.yml"), "utf8");
  const launcher = fs.readFileSync(path.join(root, "scripts", "lancer-tests.js"), "utf8");
  const { MODULES } = require(path.join(root, "tests", "helpers", "modules"));
  return {
    project:require(path.join(root, "package.json")).name,
    generatedAt:new Date().toISOString(),
    gitHead:execFileSync("git", ["rev-parse", "HEAD"], { cwd:root, encoding:"utf8" }).trim(),
    modules:{ total:MODULES.length },
    tests:{
      unit:commandesSuite(launcher, "unit").length,
      e2e:commandesSuite(launcher, "e2e").length
    },
    database:{
      tables:nomsSql(schema, /create table if not exists public\.([a-z0-9_]+)/gi),
      rpcs:nomsSql(schema, /create or replace function public\.([a-z0-9_]+)/gi)
    },
    deployment:{ provider:/actions\/deploy-pages@/.test(workflow) ? "GitHub Pages" : "inconnu" },
    pwa:{ serviceWorker:fs.existsSync(path.join(root, "sw.js")) },
    catalogues:fs.readdirSync(path.join(root, "data")).sort()
  };
}
```

- [ ] **Step 4: Ajouter les modes écriture et contrôle**

La commande `node scripts/inventorier-jury.js` écrit le JSON avec indentation
de deux espaces. La commande `node scripts/inventorier-jury.js --check`
recalcule le document après neutralisation de `generatedAt` et échoue si le
contenu versionné est périmé.

- [ ] **Step 5: Générer l’inventaire et expliquer son statut**

Run: `node scripts/inventorier-jury.js`

Dans `preuves/README.md`, préciser que l’inventaire prouve la structure du dépôt
à un commit donné, tandis que le résultat complet de `npm test` sera enregistré
séparément avec sa date et son code de sortie.

- [ ] **Step 6: Brancher et vérifier le test**

Ajouter au lanceur `node tests/jury-inventaire.test.js` et
`node scripts/inventorier-jury.js --check`.

Run: `node tests/jury-inventaire.test.js`

Expected: `jury-inventaire.test.js: OK`.

- [ ] **Step 7: Commit**

```bash
git add scripts/inventorier-jury.js docs/jury/preuves tests/jury-inventaire.test.js scripts/lancer-tests.js
git commit -m "docs(jury): inventorier les preuves du projet"
```

### Task 3: Socle narratif et fonctionnel

**Files:**
- Create: `docs/jury/README.md`
- Create: `docs/jury/resume-projet.md`
- Create: `docs/jury/expression-du-besoin.md`
- Create: `docs/jury/specifications-fonctionnelles-techniques.md`
- Create: `docs/jury/decoupage-fonctionnel.md`

**Interfaces:**
- Consumes: `AGENTS.md`, `docs/superpowers/specs/*.md`, `docs/jury/preuves/inventaire.json`, `index.html` et les routes de `js/metier/routage.js`.
- Produces: vocabulaire canonique, acteurs, périmètre et parcours réutilisés par tous les documents suivants.

- [ ] **Step 1: Écrire le vocabulaire commun**

Dans `resume-projet.md`, définir en une phrase « confrérie », « héros »,
« build », « boss de guilde », « potentiel » et « run ». Présenter ensuite le
problème, la solution, les utilisateurs et la valeur du projet en moins de
1 200 mots.

- [ ] **Step 2: Rédiger le besoin sans jargon de jeu non expliqué**

`expression-du-besoin.md` contient : contexte, commanditaire, trois profils
(visiteur, membre, administrateur), objectifs mesurables, contraintes, critères
d’acceptation et hors-périmètre. Relier chaque critère à une vue ou à un test.

- [ ] **Step 3: Rédiger les spécifications**

Regrouper les fonctions sous dix domaines : catalogue/wiki, collection,
roster, builder, calculs de statistiques, calculateur de dégâts, analyse,
disponibilités, boss et administration. Pour chaque domaine, donner entrées,
règles, sorties, persistance et erreurs visibles.

- [ ] **Step 4: Décrire les parcours**

`decoupage-fonctionnel.md` décrit quatre parcours : visiteur hors ligne, membre
qui prépare une équipe, confrérie qui organise une run et administrateur qui
gère les accès/corrections. Chaque parcours cite les routes exactes parmi
`dashboard`, `builder`, `roster`, `member-roster`, `availability`, `boss`,
`analyse`, `wiki`, `collection`, `calculateur` et `admin`.

- [ ] **Step 5: Construire le sommaire de reprise**

`README.md` pointe vers chaque livrable, donne les commandes de régénération et
distingue clairement sources éditoriales, preuves générées et exports PDF.

- [ ] **Step 6: Vérifier les documents**

Run: `node scripts/verifier-dossier-jury.js`

Expected: aucune erreur sur les fichiers créés ; seuls les livrables des tâches
suivantes restent annoncés absents.

Run: `rg -n "MoniteurConnect|moniteur-connect" docs/jury`

Expected: aucune sortie.

- [ ] **Step 7: Commit**

```bash
git add docs/jury/README.md docs/jury/resume-projet.md docs/jury/expression-du-besoin.md docs/jury/specifications-fonctionnelles-techniques.md docs/jury/decoupage-fonctionnel.md
git commit -m "docs(jury): présenter le besoin et les parcours 7DS"
```

### Task 4: Architecture, base de données et sécurité

**Files:**
- Create: `docs/jury/architecture-application.md`
- Create: `docs/jury/base-de-donnees.md`
- Create: `docs/jury/securite-rgpd.md`

**Interfaces:**
- Consumes: `js/ARCHITECTURE.md`, `tests/helpers/modules.js`, `supabase/schema.sql`, `supabase-config.js`, `sw.js`, `.github/workflows/pages.yml`, `supabase/functions/**`.
- Produces: description technique de référence utilisée par la matrice DWWM, les diagrammes et les questions/réponses.

- [ ] **Step 1: Mesurer les couches JavaScript**

Utiliser `docs/jury/preuves/inventaire.json` pour présenter le nombre de modules
par dossier, sans copier une mesure dans le texte lorsqu’elle peut être liée au
JSON généré.

- [ ] **Step 2: Rédiger l’architecture applicative**

Expliquer les responsabilités de `noyau`, `etat`, `metier`, `donnees` et `vues`,
le chargement différé des catalogues lourds, le flux DOM → métier → store →
Supabase et la stratégie PWA. Inclure une section « choix et compromis » sur
l’absence de framework et le site statique.

- [ ] **Step 3: Rédiger le modèle de données**

Pour chaque table extraite du schéma, documenter clé primaire, propriétaire,
relations, cardinalité, données JSONB et politique de lecture/écriture. Décrire
les RPC de boss et d’administration comme frontières transactionnelles.

- [ ] **Step 4: Rédiger sécurité et RGPD**

Séparer authentification, autorisation RLS, validation côté client, validation
SQL, secrets, contenu utilisateur, caches locaux, Realtime et Edge Functions.
Inclure un tableau `Risque | Mesure | Preuve | Limite` et ne jamais qualifier
la clé publishable Supabase de secret.

- [ ] **Step 5: Vérifier chaque référence technique**

Run: `node scripts/inventorier-jury.js --check`

Expected: inventaire à jour.

Run: `python -m unittest tests/test_schema_sql.py`

Expected: PASS, syntaxe des fichiers SQL validée par pglast.

- [ ] **Step 6: Commit**

```bash
git add docs/jury/architecture-application.md docs/jury/base-de-donnees.md docs/jury/securite-rgpd.md
git commit -m "docs(jury): documenter architecture donnees et securite"
```

### Task 5: Compétences DWWM, qualité et audit initial

**Files:**
- Create: `docs/jury/competences-dwwm.md`
- Create: `docs/jury/tests-qualite-deploiement.md`
- Create: `docs/jury/conformite-accessibilite-responsive.md`
- Create: `docs/jury/audit-certification-dwwm.md`

**Interfaces:**
- Consumes: fiche officielle RNCP37674, inventaire, documents des Tasks 3 et 4, tests du dépôt et workflow Pages.
- Produces: matrice canonique `Compétence | Réalisation | Preuve | Démonstration | Limite`.

- [ ] **Step 1: Transcrire exactement les huit compétences**

Créer deux sections correspondant à RNCP37674BC01 et RNCP37674BC02. Pour chaque
compétence, citer au moins deux preuves distinctes lorsque le dépôt le permet.

- [ ] **Step 2: Choisir une fonctionnalité significative**

Retenir le parcours « construire un build, calculer ses statistiques puis
composer une équipe de boss » : il relie interface dynamique, règles métier,
persistance, SQL/RLS et tests. Documenter ses entrées, traitements, sorties et
cas d’erreur.

- [ ] **Step 3: Documenter tests et déploiement**

Expliquer le lanceur qui exécute toutes les commandes, les tests unitaires,
Playwright, les contrôles Python, le packaging GitHub Pages, l’injection du SHA
dans `sw.js` et l’activation PWA choisie par le membre.

- [ ] **Step 4: Écrire la méthode de conformité**

Définir les largeurs 320, 375, 768 et 1440 px, la checklist clavier, les cibles
tactiles de 44 px, le focus des modales et l’absence de débordement horizontal.
Marquer les résultats W3C/axe comme non mesurés tant que la Task 7 ne les a pas
effectivement produits.

- [ ] **Step 5: Produire l’audit initial**

Classer chaque exigence en `PROUVÉ`, `À RENFORCER` ou `NON COUVERT`, avec une
preuve ou une action précise. Une couverture back-end partielle via Supabase
doit rester visible si le jury attend du code serveur autonome.

- [ ] **Step 6: Vérifier la matrice**

Run: `rg -n "Installer et configurer|Maquetter|interfaces utilisateur statiques|partie dynamique|base de données relationnelle|accès aux données|composants métier|déploiement" docs/jury/competences-dwwm.md`

Expected: les huit formulations apparaissent.

- [ ] **Step 7: Commit**

```bash
git add docs/jury/competences-dwwm.md docs/jury/tests-qualite-deploiement.md docs/jury/conformite-accessibilite-responsive.md docs/jury/audit-certification-dwwm.md
git commit -m "docs(jury): relier le projet aux competences DWWM"
```

### Task 6: Charte, comparaison et diagrammes

**Files:**
- Create: `docs/jury/charte-graphique.md`
- Create: `docs/jury/comparaison-conception-realisation.md`
- Create: `docs/jury/diagrammes/architecture.svg`
- Create: `docs/jury/diagrammes/cas-utilisation.svg`
- Create: `docs/jury/diagrammes/modele-donnees.svg`
- Create: `docs/jury/diagrammes/parcours-principal.svg`
- Create: `scripts/rendre-diagrammes-jury.js`
- Test: `tests/jury-diagrammes.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `css/*.css`, `docs/apparence-nova.md`, documents des Tasks 3 à 5 et inventaire SQL.
- Produces: quatre SVG autonomes et leurs PNG homonymes sous `docs/jury/diagrammes/`.

- [ ] **Step 1: Écrire le test rouge des SVG**

```js
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
for (const name of ["architecture", "cas-utilisation", "modele-donnees", "parcours-principal"]) {
  const file = path.join(__dirname, "..", "docs", "jury", "diagrammes", name + ".svg");
  const svg = fs.readFileSync(file, "utf8");
  assert.match(svg, /<svg[^>]+viewBox=/);
  assert.match(svg, /<title>[^<]+<\/title>/);
  assert.doesNotMatch(svg, /MoniteurConnect/i);
}
console.log("jury-diagrammes.test.js: OK");
```

- [ ] **Step 2: Vérifier l’échec sur les SVG absents**

Run: `node tests/jury-diagrammes.test.js`

Expected: FAIL avec `ENOENT`.

- [ ] **Step 3: Rédiger la charte graphique**

Extraire les variables réelles des CSS, expliquer les thèmes Ténèbres/Lumière,
la bannière NOVA, les composants, états, contrastes et règles responsive. Citer
les chemins d’assets sans dupliquer les images du produit.

- [ ] **Step 4: Rédiger la comparaison**

Comparer les spécifications historiques présentes sous `docs/superpowers/specs/`
avec le produit actuel et l’historique Git. Distinguer décision maintenue,
évolution et abandon justifié.

- [ ] **Step 5: Dessiner les quatre SVG accessibles**

Chaque fichier utilise un `viewBox`, un `<title>`, une palette lisible à
l’impression et des libellés textuels. Le modèle de données reprend seulement
les tables et relations présentes dans `supabase/schema.sql`.

- [ ] **Step 6: Implémenter le rendu PNG**

`scripts/rendre-diagrammes-jury.js` ouvre chaque SVG avec Chromium Playwright,
fixe un viewport de 1600 × 1000, puis écrit un PNG portant le même nom. Le
script accepte `--check` pour vérifier dimensions non nulles et fraîcheur par
rapport au SVG.

```js
const { chromium } = require("playwright");
const files = ["architecture", "cas-utilisation", "modele-donnees", "parcours-principal"];
async function main() {
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1600, height:1000 }, deviceScaleFactor:1 });
  for (const name of files) {
    const svg = path.join(JURY, "diagrammes", name + ".svg");
    const png = path.join(JURY, "diagrammes", name + ".png");
    await page.goto(pathToFileURL(svg).href);
    await page.locator("svg").screenshot({ path:png });
  }
  await browser.close();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
```

- [ ] **Step 7: Vérifier et brancher les tests**

Run: `node scripts/rendre-diagrammes-jury.js`

Expected: quatre PNG générés.

Run: `node tests/jury-diagrammes.test.js`

Expected: `jury-diagrammes.test.js: OK`.

Ajouter le test et `node scripts/rendre-diagrammes-jury.js --check` à la suite
unitaire.

- [ ] **Step 8: Commit**

```bash
git add docs/jury/charte-graphique.md docs/jury/comparaison-conception-realisation.md docs/jury/diagrammes scripts/rendre-diagrammes-jury.js tests/jury-diagrammes.test.js scripts/lancer-tests.js
git commit -m "docs(jury): ajouter charte comparaison et diagrammes"
```

### Task 7: Captures réelles et preuves responsive

**Files:**
- Create: `scripts/capturer-jury.js`
- Create: `docs/jury/captures/manifest.json`
- Create: `docs/jury/captures/desktop/*.png`
- Create: `docs/jury/captures/mobile/*.png`
- Create: `docs/jury/preuves/captures.json`
- Modify: `docs/jury/conformite-accessibilite-responsive.md`
- Test: `tests/jury-captures.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `serveRepo()`, `installFakeSupabase(page)`, routes publiques et session synthétique `user-1`.
- Produces: captures déterministes, sans PII, et rapport `{ route, viewport, width, height, overflow }[]`.

- [ ] **Step 1: Écrire le manifeste de prises de vue**

Déclarer les vues `dashboard`, `builder`, `member-roster`, `roster`, `analyse`,
`wiki`, `collection`, `calculateur`, `availability`, `boss` et `admin`. Pour
chaque vue, indiquer si une session membre ou administrateur est requise et le
sélecteur stable attendu (`#view-<nom>` ou sélecteur documenté par la vue).

- [ ] **Step 2: Écrire le test rouge des dimensions et données privées**

Le test charge `captures/manifest.json`, exige un fichier desktop 1440 px et un
fichier mobile 375 px par entrée, lit leurs dimensions PNG et refuse les chaînes
`@gmail`, `@outlook` ou `supabase.co` dans les métadonnées JSON.

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const JURY = path.join(__dirname, "..", "docs", "jury");
const readPngWidth = buffer => buffer.readUInt32BE(16);
const manifest = require("../docs/jury/captures/manifest.json");
const report = require("../docs/jury/preuves/captures.json");
for (const shot of manifest.views) {
  for (const [folder, width] of [["desktop", 1440], ["mobile", 375]]) {
    const file = path.join(JURY, "captures", folder, shot.name + ".png");
    assert.ok(fs.existsSync(file), "capture absente: " + file);
    assert.equal(readPngWidth(fs.readFileSync(file)), width);
  }
}
assert.doesNotMatch(JSON.stringify(report), /@gmail|@outlook|supabase\.co/i);
```

- [ ] **Step 3: Vérifier l’échec initial**

Run: `node tests/jury-captures.test.js`

Expected: FAIL sur la première capture absente.

- [ ] **Step 4: Implémenter le harnais Playwright**

Utiliser `serveRepo`, `installFakeSupabase`, `chromium.launch()` et
`window.__fakeSupabaseApplySession`. Pour l’administration, passer le profil
`user-1` à `admin:true` avant d’ouvrir `#admin`. Attendre le conteneur visible,
masquer les toasts transitoires, injecter une date fixe lorsque la vue dépend de
la semaine et prendre une capture `fullPage:true`.

- [ ] **Step 5: Mesurer le débordement**

Pour chaque capture, enregistrer :

```js
const overflow = await page.evaluate(() => ({
  viewport: document.documentElement.clientWidth,
  scroll: document.documentElement.scrollWidth,
  ok: document.documentElement.scrollWidth <= document.documentElement.clientWidth
}));
```

Le script échoue si `ok` vaut faux.

- [ ] **Step 6: Générer et contrôler visuellement les captures**

Run: `node scripts/capturer-jury.js`

Expected: toutes les captures et `preuves/captures.json` sont créés, sans
débordement signalé.

Ouvrir au minimum accueil/suivi, builder, roster, calculateur, disponibilités,
boss et administration dans chaque largeur. Corriger le scénario de capture si
une modale masque involontairement le contenu ; ne pas modifier l’application
pour maquiller un défaut.

- [ ] **Step 7: Mettre à jour le rapport de conformité**

Reporter la date, les viewports exacts, la commande, le nombre de vues et les
limites. Conserver séparée la checklist clavier manuelle.

- [ ] **Step 8: Vérifier et brancher le test**

Run: `node tests/jury-captures.test.js`

Expected: `jury-captures.test.js: OK`.

Ajouter ce test à la suite unitaire ; ne pas ajouter la génération elle-même à
`npm test` afin d’éviter de réécrire les preuves pendant la CI.

- [ ] **Step 9: Commit**

```bash
git add scripts/capturer-jury.js docs/jury/captures docs/jury/preuves/captures.json docs/jury/conformite-accessibilite-responsive.md tests/jury-captures.test.js scripts/lancer-tests.js
git commit -m "docs(jury): capturer les parcours desktop et mobile"
```

### Task 8: Soutenance, démonstration et questions

**Files:**
- Create: `docs/jury/soutenance/soutenance.html`
- Create: `docs/jury/soutenance/demo-11-minutes.md`
- Create: `docs/jury/soutenance/questions-reponses.md`
- Test: `tests/jury-soutenance.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: documents des Tasks 3 à 7, diagrammes et captures.
- Produces: deck HTML autonome pilotable au clavier, notes orateur et scénario de secours.

- [ ] **Step 1: Écrire le test rouge du support**

Le test extrait les `<section class="slide">`, exige entre 25 et 30 diapositives,
un `<h1>` par diapositive, des notes orateur, une navigation clavier pour
`ArrowLeft`, `ArrowRight`, `Home`, `End` et `n`, ainsi que zéro ressource HTTP
externe.

```js
const html = fs.readFileSync(path.join(__dirname, "..", "docs", "jury",
  "soutenance", "soutenance.html"), "utf8");
const slides = [...html.matchAll(/<section\s+class="slide[^"\n]*"[\s\S]*?<\/section>/g)];
assert.ok(slides.length >= 25 && slides.length <= 30, `diapositives: ${slides.length}`);
for (const [index, slide] of slides.entries()) {
  assert.match(slide[0], /<h1[ >]/, `h1 absent diapositive ${index + 1}`);
  assert.match(slide[0], /class="notes"/, `notes absentes diapositive ${index + 1}`);
}
for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
  assert.ok(html.includes(`"${key}"`), `navigation absente: ${key}`);
}
assert.doesNotMatch(html, /(?:src|href)="https?:/i);
```

- [ ] **Step 2: Vérifier l’échec initial**

Run: `node tests/jury-soutenance.test.js`

Expected: FAIL avec `ENOENT`.

- [ ] **Step 3: Écrire le conducteur de 35 minutes**

Répartir le temps : 3 min contexte, 5 min besoin/conception, 6 min architecture
et données, 11 min démonstration, 5 min sécurité/qualité, 3 min compétences et
2 min bilan. Chaque note orateur contient un temps cible.

- [ ] **Step 4: Construire le deck autonome**

Intégrer CSS et JavaScript dans `soutenance.html`, référencer les images locales,
afficher numéro/progression et proposer un mode notes avec la touche `N`. Les
diapositives restent lisibles en 16:9 à 1280 × 720 et n’embarquent aucune donnée
personnelle.

- [ ] **Step 5: Écrire la démonstration nominale et de secours**

`demo-11-minutes.md` contient minute, action, résultat attendu, message DWWM et
capture de secours. Le scénario commence sur une session synthétique déjà prête
et termine sur un rapport ou une analyse de boss.

- [ ] **Step 6: Écrire au moins 30 questions/réponses**

Couvrir architecture, SQL/RLS, sécurité, RGPD, tests, accessibilité, PWA,
performance, choix technologiques, limites du calculateur, dette technique et
évolutions. Chaque réponse tient en 30 à 90 secondes et cite une preuve locale.

- [ ] **Step 7: Vérifier le support**

Run: `node tests/jury-soutenance.test.js`

Expected: `jury-soutenance.test.js: OK`.

Ouvrir le deck via `serveRepo`, contrôler les diapositives 1, 10, 20 et la
dernière à 1280 × 720, puis vérifier la touche `N` et les flèches.

- [ ] **Step 8: Brancher le test et commit**

Ajouter `node tests/jury-soutenance.test.js` à la suite unitaire.

```bash
git add docs/jury/soutenance tests/jury-soutenance.test.js scripts/lancer-tests.js
git commit -m "docs(jury): preparer la soutenance DWWM"
```

### Task 9: Veilles technique et sécurité

**Files:**
- Create: `docs/jury/veille-technique.md`
- Create: `docs/jury/veille-securite.md`

**Interfaces:**
- Consumes: sources officielles consultées à la date d’exécution et choix techniques du dépôt.
- Produces: fiches `Source | Date | Signal | Décision pour le projet` réutilisées à l’oral.

- [ ] **Step 1: Vérifier les sources primaires**

Consulter au minimum MDN pour PWA/service workers et accessibilité, Supabase
pour RLS/Auth/Realtime, PostgreSQL pour les politiques ou fonctions, OWASP pour
les risques web et GitHub pour Pages/Actions. Enregistrer l’URL directe et la
date de consultation.

- [ ] **Step 2: Rédiger la veille technique**

Créer quatre fiches : stratégie de cache PWA, JavaScript modulaire sans
framework, temps réel Supabase et tests navigateur. Pour chaque fiche, relier le
signal observé à une décision déjà prise ou à une évolution concrète.

- [ ] **Step 3: Rédiger la veille sécurité**

Créer huit fiches courtes : contrôle d’accès, injection, XSS, authentification,
gestion des secrets, dépendances, données personnelles et journalisation. Ne pas
affirmer une conformité OWASP globale ; décrire les mesures et risques résiduels.

- [ ] **Step 4: Vérifier les liens externes**

Run: `node scripts/verifier-dossier-jury.js`

Expected: les liens locaux sont valides et les URLs externes sont listées dans
les statistiques sans être considérées comme vérifiées par le seul script.

- [ ] **Step 5: Commit**

```bash
git add docs/jury/veille-technique.md docs/jury/veille-securite.md
git commit -m "docs(jury): ajouter les veilles technique et securite"
```

### Task 10: Export PDF et contrôle de rendu

**Files:**
- Modify: `requirements-dev.txt`
- Create: `scripts/pdf_jury.py`
- Create: `scripts/pdf-jury.py`
- Create: `docs/jury/pdf/**/*.pdf`
- Create: `docs/jury/preuves/pdf.json`
- Test: `tests/test_pdf_jury.py`

**Interfaces:**
- Consumes: tous les `docs/jury/**/*.md` hors `pdf/`, images et SVG locaux.
- Produces: un PDF miroir par Markdown et un rapport `{ source, pdf, pages, bytes }[]`.

- [ ] **Step 1: Écrire le test rouge des chemins de sortie**

```python
import unittest
from pathlib import Path
from scripts.pdf_jury import chemin_pdf

class PdfJuryTest(unittest.TestCase):
    def test_chemin_miroir(self):
        jury = Path("docs/jury").resolve()
        source = jury / "soutenance" / "demo-11-minutes.md"
        self.assertEqual(
            chemin_pdf(jury, source),
            jury / "pdf" / "soutenance" / "demo-11-minutes.pdf")

if __name__ == "__main__":
    unittest.main()
```

Le fichier importable est nommé `scripts/pdf_jury.py`; `scripts/pdf-jury.py`
reste une enveloppe CLI de trois lignes si la compatibilité avec le nom du
dossier modèle est souhaitée.

- [ ] **Step 2: Vérifier l’échec initial**

Run: `python -m unittest tests/test_pdf_jury.py`

Expected: FAIL avec `No module named 'scripts.pdf_jury'`.

- [ ] **Step 3: Ajouter les dépendances de développement**

Ajouter des versions minimales bornées à `requirements-dev.txt` :

```text
Markdown>=3.7,<4
pypdf>=5,<7
```

- [ ] **Step 4: Implémenter l’export**

Convertir Markdown en HTML avec `tables`, `fenced_code` et `sane_lists`, injecter
une feuille A4 cohérente avec la charte NOVA, réécrire les liens vers un Markdown
en liens vers son PDF miroir, puis imprimer avec Microsoft Edge headless. La
fonction `chemin_pdf(jury, source)` est pure et testable.

```python
def chemin_pdf(jury: Path, source: Path) -> Path:
    return jury / "pdf" / source.relative_to(jury).with_suffix(".pdf")

def convertir(source: Path, jury: Path, navigateur: Path) -> dict:
    texte = source.read_text(encoding="utf-8")
    corps = markdown.markdown(
        texte, extensions=["tables", "fenced_code", "sane_lists"])
    sortie = chemin_pdf(jury, source)
    sortie.parent.mkdir(parents=True, exist_ok=True)
    imprimer_html(navigateur, source, corps, sortie)
    reader = PdfReader(str(sortie))
    if not reader.pages or sortie.stat().st_size <= 1000:
        raise RuntimeError(f"PDF invalide: {sortie}")
    return {
        "source": source.relative_to(jury).as_posix(),
        "pdf": sortie.relative_to(jury).as_posix(),
        "pages": len(reader.pages),
        "bytes": sortie.stat().st_size,
    }
```

- [ ] **Step 5: Vérifier chaque PDF**

Après impression, ouvrir le fichier avec `pypdf.PdfReader`, exiger au moins une
page et une taille supérieure à 1 000 octets, puis écrire `preuves/pdf.json`.
Le script sort avec le code 1 si un document manque ou est illisible.

- [ ] **Step 6: Exécuter les tests et générer**

Run: `python -m unittest tests/test_pdf_jury.py`

Expected: PASS.

Run: `python scripts/pdf-jury.py`

Expected: un PDF lisible pour chaque Markdown source.

- [ ] **Step 7: Contrôler visuellement le rendu**

Rendre en PNG au minimum `resume-projet.pdf`, `base-de-donnees.pdf`,
`competences-dwwm.pdf`, `soutenance/demo-11-minutes.pdf` et le document le plus
long. Inspecter première, page médiane et dernière page de chacun ; corriger les
coupures de tableau, débordements, pages blanches ou images floues.

- [ ] **Step 8: Brancher le test et commit**

Ajouter `python -m unittest tests/test_pdf_jury.py` à la suite unitaire.

```bash
git add requirements-dev.txt scripts/pdf_jury.py scripts/pdf-jury.py tests/test_pdf_jury.py docs/jury/pdf docs/jury/preuves/pdf.json scripts/lancer-tests.js
git commit -m "docs(jury): exporter et verifier les PDF"
```

### Task 11: Audit final et livraison

**Files:**
- Modify: `docs/jury/audit-certification-dwwm.md`
- Modify: `docs/jury/conformite-accessibilite-responsive.md`
- Modify: `docs/jury/tests-qualite-deploiement.md`
- Modify: `docs/jury/README.md`
- Create: `docs/jury/preuves/tests.json`
- Modify: `docs/jury/manifest.json`

**Interfaces:**
- Consumes: tous les livrables précédents et sorties fraîches des commandes finales.
- Produces: état final daté, audit sans promesse non prouvée et dossier validé en mode `--complet`.

- [ ] **Step 1: Rejouer l’inventaire et les générateurs**

Run: `node scripts/inventorier-jury.js`

Run: `node scripts/rendre-diagrammes-jury.js`

Run: `node scripts/capturer-jury.js`

Run: `python scripts/pdf-jury.py`

Expected: toutes les commandes sortent avec le code 0.

- [ ] **Step 2: Exécuter la suite complète**

Run: `npm test`

Expected: toutes les commandes du récapitulatif sont au vert. Enregistrer dans
`preuves/tests.json` le commit, l’horodatage, le code de sortie, le nombre de
commandes unitaires/E2E et la durée affichée ; ne pas inventer un nombre
d’assertions que le lanceur ne calcule pas.

- [ ] **Step 3: Mettre à jour les rapports depuis les preuves fraîches**

Remplacer les statuts « non mesuré » par les seuls résultats effectivement
obtenus. Toute vérification manuelle non réalisée reste cochée comme action du
candidat avant la soutenance.

- [ ] **Step 4: Fermer l’audit DWWM**

Pour chaque ligne, relire la preuve et classer `PROUVÉ`, `À RENFORCER` ou
`NON COUVERT`. Ajouter une synthèse chiffrée dont la somme égale exactement le
nombre de critères du tableau.

- [ ] **Step 5: Exécuter le validateur complet**

Run: `node scripts/verifier-dossier-jury.js --complet`

Expected: `0 erreur`, tous les fichiers éditoriaux et générés présents.

Run: `git diff --check`

Expected: aucune erreur de format.

Run: `rg -n "MoniteurConnect|moniteur-connect|annonce-detail|dashboard-ecole" docs/jury`

Expected: aucune sortie.

- [ ] **Step 6: Contrôle humain final**

Ouvrir `docs/jury/README.md`, suivre tous les liens du sommaire, parcourir le
deck complet, ouvrir les PDF, puis effectuer une répétition chronométrée. Noter
dans le README la date de cette répétition et sa durée réelle uniquement si elle
a été faite.

- [ ] **Step 7: Commit final**

```bash
git add docs/jury
git commit -m "docs(jury): finaliser le dossier DWWM de Site Confrerie 7DS"
```

- [ ] **Step 8: Vérifier le périmètre Git**

Run: `git status --short`

Expected: seuls les fichiers personnels préexistants sous `assets/ambiance/`
restent non suivis ; aucun fichier du dossier jury n’est en attente.
