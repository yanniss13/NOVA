# Découpage de `index.html` en modules — conception

## Statut

Design validé avec l'utilisateur le 1er août 2026.

Branche : `refactor/decoupage-index`. Le point d'entrée pour reprendre le
chantier reste [la passation](2026-08-01-refactor-index-passation.md) : elle
donne l'état réel, ce document ne donne que la cible.

## Objectif

Sortir les ~10 400 lignes de JavaScript de `index.html` vers des fichiers
séparés sous `js/`, un par domaine métier, en modules ES avec dépendances
explicites.

Le refactor **ne change aucun comportement**. Aucun test existant ne doit être
modifié pour « passer », à la seule exception du harnais, dont l'adaptation est
un objectif déclaré du chantier.

## Périmètre

Couvert :

- le script principal en ligne de `index.html` ;
- le harnais de tests qui en dépend (`tests/helpers/load-app.js` et les six
  fichiers Playwright) ;
- `sw.js`, qui doit connaître chaque nouveau fichier ;
- `AGENTS.md`, dont une affirmation devient fausse (voir « Renoncements »).

Hors périmètre :

- le CSS (~1 550 lignes) et le balisage (~420 lignes), qui restent dans
  `index.html` ;
- les deux petits scripts déjà isolés en fin de fichier (service worker,
  header rétractable) ;
- les fichiers de données déjà externes (`data.js`, `stats-build.js`,
  `potentiels.js`, `armures-liees.js`, `personnages-meta.js`) ;
- toute correction de bug ou amélioration fonctionnelle rencontrée en chemin.

## Décisions prises

| Question | Décision | Raison |
|---|---|---|
| Modules ES ou scripts classiques | **Modules ES** | Choix explicite de l'utilisateur, en connaissance du coût sur le harnais. |
| Frontière de découpage | **Par domaine métier** | Le fichier est déjà organisé ainsi ; suivre l'existant coûte le moins cher. |
| Périmètre | **JavaScript seul** | C'est là qu'est la douleur, et le seul morceau qui touche aux tests. |
| Granularité | **Un lot = un domaine, `npm test` vert avant commit** | Une interruption doit toujours laisser un dépôt sain. |
| Ouverture en `file://` | **Abandonnée** | L'utilisateur passe toujours par GitHub Pages. |

## Le fait qui commande tout

Mesuré le 1er août 2026 sur Chromium, pas déduit :

```
module    : (module non execute)
classique : script classique charge
erreurs   : Access to script ... from origin 'null' has been blocked by CORS
            policy: Cross origin requests are only supported for protocol
            schemes: chrome, chrome-untrusted, data, http, https.
```

Un `<script type="module">` est **bloqué en `file://`**. Or les six fichiers
Playwright ouvrent aujourd'hui le site par `pathToFileURL(index.html)`, en
dix-neuf appels :

| Fichier | Appels |
|---|---|
| `tests/accessibilite-mobile.playwright.js` | 8 |
| `tests/availability.playwright.js` | 3 |
| `tests/potentiel-commun.playwright.js` | 2 |
| `tests/pwa-update.playwright.js` | 2 |
| `tests/scrollbars-invisibles.playwright.js` | 2 |
| `tests/supabase-etape1.playwright.js` | 2 |

Passer aux modules casse donc les six d'un coup. D'où l'ordre des lots
ci-dessous, qui est la partie la plus importante de cette conception.

## Ordre des lots

L'ordre n'est pas une commodité : c'est ce qui rend le chantier interruptible.

### Lot 0 — payer la dette du harnais, sur du code inchangé

Les six fichiers Playwright cessent d'ouvrir `file://` et passent par un serveur
statique local, démarré et arrêté par le test lui-même. **`index.html` n'est pas
touché.**

À la fin du lot 0, `npm test` est vert avec l'application exactement telle
qu'elle est aujourd'hui. La dette est payée sans qu'on ait jamais été rouge.

Un helper partagé `tests/helpers/serve.js` expose :

```js
// Démarre un serveur statique sur la racine du dépôt, port éphémère.
// Retourne { url, close } ; `url` est l'origine, ex. "http://127.0.0.1:53124".
async function serveRepo(){ … }
```

Chaque fichier Playwright remplace
`page.goto(pathToFileURL(...index.html).href)` par
`page.goto(server.url + "/index.html")`, et ferme le serveur à la fin.

**Attention `pwa-update.playwright.js`** : les service workers exigent un
contexte sécurisé. `http://127.0.0.1` en est un pour les navigateurs, donc ce
test devrait mieux fonctionner qu'en `file://`, mais son comportement doit être
vérifié spécifiquement — il est le plus susceptible de changer de nature.

### Lot 1 — le pivot, sans découper

`index.html` remplace son `<script>` en ligne par :

```html
<script type="module" src="js/app.js"></script>
```

Les ~10 400 lignes partent **telles quelles** dans `js/app.js`. Aucun
réagencement, aucun renommage : un seul déplacement, facile à relire et à
annuler.

`js/app.js` rejoint `CORE_ASSETS` dans `sw.js`.

C'est aussi le lot où `tests/helpers/load-app.js` change de source : il lit
désormais `js/app.js` au lieu de fouiller les balises `<script>` de
`index.html`.

### Lots 2 à n — un domaine par lot

Chaque lot sort un domaine de `js/app.js` vers son fichier, avec `export` des
fonctions consommées ailleurs et `import` de ce dont il a besoin.

Ordre proposé, des feuilles vers le tronc — les domaines qui dépendent le moins
des autres sortent en premier :

1. `js/dates.js` — semaines de boss et semaines ISO, formatage
2. `js/masques-dispos.js` — masque de 168 caractères et ses opérations
3. `js/modal-stack.js` — pile de modales
4. `js/toast.js`
5. `js/supabase.js` — client, authentification, Realtime
6. `js/roster.js`, `js/builder.js`, `js/boss.js`, `js/dispos.js`,
   `js/analyse.js`, `js/suivi.js`
7. `js/app.js` réduit au démarrage et au câblage des onglets

Cette liste est indicative. Le plan d'implémentation fixe l'ordre exact après
relevé des dépendances réelles, qui peuvent contredire cette intuition.

## Le harnais de tests unitaires

C'est le point le plus délicat, et celui qu'une reprise naïve cassera.

`tests/helpers/load-app.js` fait aujourd'hui :

```js
const source = scripts.find(script => script.includes("(function(){"));
const exposed = source.replace(/\}\)\(\);\s*$/, HOOK_EXPORT);
vm.runInNewContext(exposed, sandbox, { filename:"index.html" });
```

Quatorze fichiers de tests en dépendent.

**Node ne peut pas simplement `import()` ces modules.** Ils touchent au
`document` dès leur exécution, et Node n'a pas de DOM. Le bac à sable
`FakeElement` du chargeur existe précisément pour ça.

Le chargeur va donc, après le lot 1 :

1. lire les fichiers de `js/` **dans l'ordre des dépendances** ;
2. **neutraliser leurs lignes `import` et `export`** — un `export function x`
   devient `function x`, un `import {…} from "…"` disparaît, les symboles étant
   déjà dans la portée commune de la concaténation ;
3. concaténer le tout et l'exécuter dans le `vm`, comme aujourd'hui, avec le
   même faux DOM et le même `HOOK_EXPORT`.

C'est une évolution du bricolage existant, assumée comme telle. Elle garde les
quatorze fichiers de tests intacts, ce qui est le seul moyen de vérifier que le
refactor ne change aucun comportement.

L'ordre de concaténation doit être **la même liste** que l'ordre des balises,
maintenue à un seul endroit pour qu'elle ne puisse pas diverger.

## Contraintes permanentes

- **Un lot = un commit vert.** `npm test` passe avant chaque commit.
- **Aucun changement de comportement.** Si un test doit changer, c'est soit le
  harnais, soit un bug — et un bug se traite hors de ce chantier.
- **Ne jamais renormaliser les fins de ligne.** `index.html` est en CRLF ; une
  réécriture globale rend le diff illisible et la relecture impossible.
- **Chaque fichier de `js/` rejoint `CORE_ASSETS` dans `sw.js`**, sinon le mode
  hors ligne casse en silence.
- Ne toucher ni `.claude/`, ni `.vscode/`, ni `.worktrees/`.
- Commentaires, libellés et messages de commit en français.

## Renoncements assumés

- **L'ouverture en `file://` disparaît.** `AGENTS.md` affirme aujourd'hui
  « Double-clic sur `index.html` […] Aucun serveur, aucune install, aucun
  build » : cette phrase devient fausse au lot 1 et doit être corrigée dans le
  même commit. Le déploiement GitHub Pages n'est pas affecté, il sert en `https`.
- **Le CSS et le balisage restent dans `index.html`**, qui pèsera encore environ
  2 000 lignes à la fin du chantier. C'est un progrès, pas une fin.
- **Aucun découpage du balisage** : sans build, il n'existe pas de mécanisme
  d'inclusion HTML, et l'injecter en JavaScript coûterait plus que le gain.
