# Refactor de `index.html` — passation

> **À LIRE EN PREMIER, avant toute autre ligne de ce document.**
>
> Ce fichier peut être périmé dès sa rédaction. **L'avancement réel se lit dans
> les commits, jamais ici.** Commence toujours par :
>
> ```bash
> git log --oneline main..HEAD
> git status --short
> npm test
> ```
>
> Le journal fait foi. Si un commit contredit ce document, c'est ce document qui
> a tort — corrige-le.

## Où en est-on

**Branche :** `refactor/decoupage-index`, créée le 1er août 2026 depuis `main`
au commit `5e0b491`.

**Conception : TRANCHÉE avec l'utilisateur le 1er août 2026.** Elle est écrite
dans [2026-08-01-refactor-index-design.md](2026-08-01-refactor-index-design.md).
La section « Ce qu'il faut trancher » plus bas est conservée pour mémoire, mais
**elle est close** — n'y retourne pas poser les questions.

Décisions retenues, en résumé :

- **modules ES**, choix explicite de l'utilisateur en connaissance du coût ;
- **JavaScript seul**, le CSS et le balisage restent dans `index.html` ;
- **découpage par domaine**, un lot par domaine, `npm test` vert avant commit ;
- **l'ouverture en `file://` est abandonnée** — l'utilisateur passe toujours par
  GitHub Pages.

La branche a été remise à niveau sur `main` (correctif mobile des dispos
inclus).

### Lot 0 — TERMINÉ

Les six tests Playwright ne chargent plus le site en `file://` : ils passent par
un serveur statique local. **`index.html` n'a pas été touché d'une ligne.**
`npm test` est vert. La dette du harnais est donc payée sans que la branche
soit jamais passée au rouge.

- `tests/helpers/serve.js` — `serveRepo()` → `{ url, close }`, serveur
  `node:http` sur un port éphémère de `127.0.0.1`, sans dépendance.
  **Piège déjà résolu :** `close()` appelle `closeAllConnections()`, sans quoi
  Playwright garde des sockets ouvertes et le processus de test se fige.
- `tests/serve.test.js` — couvre le type MIME JavaScript (un module servi en
  `text/plain` serait refusé par le navigateur), le 404, et le refus de lire
  hors du dépôt.
- Les six `.playwright.js` démarrent le serveur en tête et le ferment dans leur
  `finally`. `grep -rn pathToFileURL tests/` ne renvoie plus rien.
- `tests/pwa-update.playwright.js` était le cas à risque : il redéfinit
  `navigator.serviceWorker`, qui existe vraiment en `http` alors qu'il n'existe
  pas en `file://`. Il passe sans modification, son descripteur portant déjà
  `configurable: true`.

Commits : `77d18c0` (serveur), `35c0bcb` (conversion des six tests).

### Lot 1 — TERMINÉ

Le script principal a quitté `index.html` pour `js/app.js`, chargé par
`<script type="module" src="js/app.js"></script>`. **Déplacement pur : aucune
ligne de code applicatif n'a été modifiée.** `npm test` est vert, tests
navigateur compris — ce qui prouve que le module se charge bien en http.

- `index.html` : **12 752 → 2 263 lignes**. Il ne reste que le CSS, le balisage
  et les deux petits scripts de fin (service worker, header rétractable), qui
  restent classiques et en ligne à dessein.
- `js/app.js` : 10 489 lignes, toujours une seule IIFE. **Rien n'y est encore
  découpé.**
- `sw.js` : `"./js/app.js"` ajouté à `CORE_ASSETS`.
- `tests/helpers/modules.js` : **source unique de vérité** de l'ordre des
  modules. Toute extraction s'y déclare, sinon ni le chargeur `vm` ni le lecteur
  de source ne verront le nouveau fichier.
- `tests/helpers/app-source.js` : concatène `index.html` et les modules pour les
  tests qui vérifient la structure du code. Quatre fichiers l'utilisent —
  `availability`, `potentiel-commun`, `stats-build` — parce que leurs assertions
  cherchaient du JavaScript qui a déménagé.
- `AGENTS.md` : les quatre passages qui promettaient `file://` sont corrigés.

Commit : `692833c`.

### Lot 2 — TERMINÉ : le mécanisme d'extraction est validé

`js/dispos-logique.js` (282 lignes) porte la logique pure des disponibilités.
**22 symboles exportés, 5 devenus privés** — `AVAIL_SLOTS`,
`availabilityParisParts`, `availabilityMaskWith`, `AVAIL_MONTHS`,
`availabilityWeekLabel` ne sortent plus du module. C'est exactement le bénéfice
recherché.

`npm test` est vert, **tests navigateur compris** : cela prouve que les
`import`/`export` se chargent réellement en http, et pas seulement dans le `vm`.

`tests/helpers/load-app.js` neutralise désormais les lignes de module avant
d'exécuter la concaténation, avec une garde qui échoue si une déclaration
survit. Ce mécanisme est **le point le plus fragile du chantier** ; il est
maintenant écrit et couvert.

Commit : `255636e`.

### Lots 3 et 4 — TERMINÉS

- **Lot 3** : `js/modal-stack.js` (167 lignes), la pile de modales. Bloc net,
  n'exposant que `ModalStack`. Commit `6630876`.
- **Lot 4** : `js/dom.js` (45 lignes) — `$`, `uid`, `norm`, `initials`,
  `numericKeyboardInputProps`, `el`. Commit `68f4e39`.

Le lot 4 mérite une explication, parce qu'il n'était pas dans l'ordre prévu.
`Picker`, `Potentiel`, `DashboardStore` et `RealtimeSync` semblaient être les
prochains candidats évidents ; le relevé de leurs dépendances a montré qu'ils
s'appuient **tous** sur `$`, `el` et `norm`. Ces utilitaires étaient donc la
vraie feuille de l'arbre. Les sortir en premier débloque les quatre.

**Leçon pour la suite : ne pas se fier à l'ordre proposé, relever les
dépendances réelles avant de choisir.** La commande est donnée plus bas.

### Où en sont les fichiers

| Fichier | Lignes |
|---|---|
| `index.html` | 2 263 |
| `js/app.js` | 10 082 |
| `js/dispos-logique.js` | 282 |
| `js/modal-stack.js` | 167 |
| `js/dom.js` | 45 |

### Prochaine étape — lot 3 et suivants

La recette est en fin de
[plan](../plans/2026-08-01-refactor-index-lot0-lot1.md). Elle a servi une fois
et fonctionne : **la suivre à la lettre, un domaine par lot.**

Méthode pour choisir le prochain domaine et ses exports, éprouvée au lot 2 :
relever les bornes du bloc, lister ses déclarations de premier niveau, et
chercher lesquelles apparaissent encore dans le reste de `js/app.js`. Celles qui
n'y apparaissent pas deviennent privées.

**Trois endroits à mettre à jour à chaque extraction**, en oublier un casse
quelque chose de silencieux :

1. `MODULES` dans `tests/helpers/modules.js` — **avant** son consommateur ;
2. `CORE_ASSETS` dans `sw.js` — sinon le mode hors ligne casse sans test rouge ;
3. l'`import` réel en tête de `js/app.js`, **au-dessus de l'IIFE** : un `import`
   ne peut pas vivre dans une portée de fonction.

**Relever les dépendances réelles avant de choisir le prochain domaine.** Ce
script donne, pour chaque module en IIFE, ses bornes et ce dont il dépend encore :

```bash
python - <<'PY'
import io, re
NL="\r\n"
lines = io.open("js/app.js", encoding="utf-8", newline="").read().split(NL)
def bornes(nom):
    deb = next(i for i,l in enumerate(lines,1)
               if l.startswith("  const %s = (function(){" % nom))
    fin = next(i for i in range(deb, len(lines)+1) if lines[i-1].startswith("  })();"))
    return deb, fin
for nom in ["Picker","Potentiel","DashboardStore","RealtimeSync","Availability"]:
    try: d, f = bornes(nom)
    except StopIteration: print(nom, ": deja extrait ou introuvable"); continue
    bloc = lines[d-1:f]
    appels = set(re.findall(r"(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(", NL.join(bloc)))
    internes = {m.group(1) for l in bloc
                for m in [re.match(r"\s+(?:const|let|function)\s+([A-Za-z_$][\w$]*)", l)] if m}
    builtins = {"if","for","while","switch","catch","return","function","Number","String",
                "Array","Object","Date","Set","Map","Math","JSON","parseInt","parseFloat",
                "setTimeout","clearTimeout","requestAnimationFrame","Promise","Boolean"}
    ext = sorted(a for a in appels if a not in internes and a not in builtins and a != nom)
    print("%-15s %5d-%-5d (%4d lignes) | depend de : %s"
          % (nom, d, f, f-d+1, ", ".join(ext[:12]) or "rien"))
PY
```

État constaté au lot 4 — à refaire, il a changé depuis :

| Module | Lignes | Dépend encore de |
|---|---|---|
| `Picker` | 90 | `$`, `el`, `norm` → **désormais extraits, il est prêt** |
| `Potentiel` | 64 | `charOf`, `normalizePotentiel`, `potentielDetailsOf`, `renderBonus`, `renderBuilder`, `weaponTypesOf` |
| `DashboardStore` | 95 | `buildDashboardState`, `currentBossWeek`, `readDashboardCache`, `writeDashboardCache` |
| `RealtimeSync` | 141 | les rendus de toutes les vues — **à garder pour la fin** |

### ⚠️ Lot 5 tenté sur `Picker` — ÉCHOUÉ, annulé, à reprendre

Une extraction de `Picker` vers `js/picker.js` a été tentée puis **annulée** :
elle n'a jamais été commitée, le dépôt est resté vert. Ne pas la refaire à
l'identique en croyant qu'elle marchera.

Ce qui a été fait : bloc `const Picker = (function(){` … `})();` (90 lignes)
déplacé tel quel dans `js/picker.js`, avec
`import { $, el, norm } from "./dom.js";` et `export { Picker };`, plus les
trois déclarations habituelles.

Ce qui s'est passé :

- `npm run test:unit` : **vert**. Le `vm` et la concaténation fonctionnent.
- `node tests/potentiel-commun.playwright.js` : **échec**, la modale du
  sélecteur ne s'ouvre plus (`element is not visible`, l'attente de clic expire).

Ce qui a déjà été écarté : il ne s'agit **pas** d'un symbole oublié. Un relevé
des identifiants de `js/app.js` encore référencés par `js/picker.js`, y compris
les références simples et pas seulement les appels, renvoie une liste **vide**.

Piste sérieuse non vérifiée, faute de quota : **le moment d'évaluation**. Dans
l'IIFE d'origine, `Picker` s'exécutait à un point précis du démarrage. Devenu
module importé par `app.js`, il est évalué **avant** le corps de `app.js`. S'il
capte des nœuds du DOM ou un état applicatif à l'évaluation, il peut le faire
trop tôt. À vérifier en premier : ce que le corps de l'IIFE de `Picker` lit au
moment de sa création, par opposition à ce qu'il lit à l'ouverture.

**Leçon générale :** les tests unitaires ne suffisent pas à valider une
extraction. Toujours lancer `npm test` en entier — c'est un test navigateur qui
a attrapé celui-ci. Le garde-fou employé, à réutiliser :

```bash
npm test >/dev/null 2>&1 && git add js/ sw.js tests/helpers/ && git commit -m "…" \
  || echo "ECHEC : rien n'est commite"
```

Prochain candidat, une fois `Picker` compris : `Potentiel`, puis les dates de
boss.

Ancien candidat évident : **`Picker`**, dont toutes les dépendances sont
sorties. Ensuite les fonctions de potentiel, puis les dates de boss
(`currentBossWeek` et les helpers du tableau de bord), puis les vues.
`RealtimeSync` en dernier : il appelle les rendus de toutes les vues, il ne
pourra sortir qu'une fois celles-ci extraites.

## Pourquoi ce refactor

`index.html` fait **12 701 lignes pour 500 Ko**. Un seul fichier porte le style,
le balisage et la totalité de la logique applicative. Conséquences concrètes :

- toute modification demande de retrouver son chemin dans un fichier qu'aucun
  outil n'ouvre confortablement ;
- les agents qui reprennent le projet ne peuvent pas tenir le fichier en
  contexte, ce qui rend leurs éditions moins fiables ;
- les frontières entre domaines existent (bannières de commentaires, modules en
  IIFE) mais ne sont imposées par rien : rien n'empêche une fonction du Builder
  d'appeler un détail interne du Roster.

## Cartographie du fichier

Relevé le 1er août 2026 au commit `5e0b491`. **Les numéros de ligne bougent à
chaque commit — re-fais le relevé avant de t'en servir :**

```bash
grep -nE "^  /\* =+ .* =+ \*/|^  const [A-Z][A-Za-z]+ = \(function\(\)\{" index.html
```

| Zone | Lignes | Taille |
|---|---|---|
| `<style>` | 18 – 1569 | ~1 550 lignes |
| `<body>` (balisage) | 1570 – 1989 | ~420 lignes |
| Scripts externes existants | 1990 – 1996 | `data.js`, `stats-build.js`, `potentiels.js`, `armures-liees.js`, `personnages-meta.js`, supabase-js (CDN), `supabase-config.js` |
| **Script principal en ligne** | **1997 – 12435** | **~10 440 lignes** |
| Script « service worker » | 12436 – 12572 | ~135 lignes, déjà isolé |
| Script « header rétractable » | 12573 – 12699 | ~125 lignes, déjà isolé |

Les deux derniers blocs sont **déjà séparés volontairement** : leur commentaire
d'en-tête explique que le bac à sable `vm` des tests n'a ni `navigator`, ni
`matchMedia`, ni `window.addEventListener`. C'est le précédent à suivre.

### Découpage interne du script principal

Bannières et modules, dans l'ordre du fichier :

| Ligne | Bloc |
|---|---|
| 2001 | Données & constantes |
| 2196 | Utilitaires |
| 2229 | `ModalStack` (IIFE) |
| 2411 | Équipes : local + Supabase |
| 2514 | Brouillon d'équipe |
| 6318 | Analyse : DPS dérivés du Roster |
| 6516 | Toast |
| 6529 | `RealtimeSync` (IIFE) |
| 6671 | Authentification Supabase |
| 7181 | `Availability` (IIFE) |
| 7756 | Navigation onglets |
| 7805 | `Picker` (IIFE) |
| 7897 | Roster des membres |
| 8878 | Builder |
| 9477 | `Potentiel` (IIFE) |
| 9613 | Roster (page d'affichage) |
| 9941 | Export / Import |
| 10053 | Analyse |
| 10261 | Sessions de boss |
| 10758 | `DashboardStore` (IIFE) |
| 12423 | Démarrage |

Le CSS (lignes 18–1569) porte lui aussi des bannières par domaine et se découpe
selon les mêmes frontières.

## Les trois contraintes qui décident de tout

Ce sont elles qui écartent la solution « évidente ». Ne les contourne pas sans
l'accord explicite de l'utilisateur.

### 1. Le site doit rester ouvrable en `file://`

C'est une propriété produit affirmée dans [AGENTS.md](../../../AGENTS.md)
(« Double-clic sur `index.html` […] Aucun serveur, aucune install, aucun
build »).

**Conséquence majeure : les modules ES sont exclus.** Un
`<script type="module" src="…">` est bloqué par la politique d'origine des
navigateurs sur `file://` — la page se charge, aucun module ne s'exécute, et le
site est mort pour quiconque ouvre le fichier en double-clic. Vérifie-le
toi-même avant d'en douter, c'est rapide.

Le découpage doit donc se faire en **scripts classiques** `<script src="…">`,
chargés dans l'ordre des dépendances, partageant leur état par un objet global
unique plutôt que par des `import`.

### 2. Le harnais de tests lit le script en ligne par expression régulière

`tests/helpers/load-app.js` fait exactement ceci :

```js
const source = scripts.find(script => script.includes("(function(){"));
const exposed = source.replace(/\}\)\(\);\s*$/, HOOK_EXPORT);
```

Il **cherche le bloc `<script>` en ligne** qui contient l'IIFE, puis remplace sa
fermeture par l'export des fonctions internes, et exécute le tout dans un `vm`.

**Sortir le code d'`index.html` casse ce mécanisme et, avec lui, la totalité des
tests unitaires** (14 fichiers Node en dépendent). Adapter ce chargeur fait
partie intégrante du refactor, ce n'est pas un détail de fin de chantier : il
devra concaténer les fichiers extraits dans l'ordre de chargement avant de les
exécuter dans le `vm`.

Le faux DOM de ce chargeur est volontairement minimal (`FakeElement`). Tout code
exécuté au chargement qui touche au DOM doit rester tolérant, ou vivre dans un
bloc séparé comme les deux scripts de fin de fichier.

### 3. Le service worker doit connaître chaque nouveau fichier

`sw.js` liste `CORE_ASSETS` explicitement. **Un fichier extrait qui n'y est pas
ajouté casse le mode hors ligne** sans qu'aucun test ne s'en aperçoive
forcément. La mise en cache est faite fichier par fichier — un 404 n'y vide plus
tout le cache, mais le fichier manquant reste absent hors ligne.

`tests/pwa.test.js` couvre une partie du contrat : lis-le avant de modifier
`sw.js`.

## Ce qu'il faut trancher avec l'utilisateur

**N'écris pas une ligne de code avant d'avoir ces réponses.** Passe par la skill
`superpowers:brainstorming`, puis `superpowers:writing-plans`.

1. **Périmètre.** Découper uniquement le JavaScript, ou aussi le CSS et le
   balisage ? Le CSS est plus simple et sans risque pour les tests ; le balisage
   n'a pas de mécanisme d'inclusion sans build, donc il resterait dans
   `index.html`.
2. **Frontière de découpage.** Un fichier par domaine métier (builder, roster,
   boss, dispos, analyse…) ou par nature technique (état, rendu, réseau) ? Le
   fichier suit aujourd'hui les domaines — les suivre coûte le moins cher.
3. **Partage de l'état.** Aujourd'hui tout vit dans la portée d'une seule IIFE.
   Après découpage, il faut un porteur explicite : un objet global unique
   (`window.Conf7DS = {}`) que chaque fichier complète, ou des IIFE qui
   s'exposent nommément. À décider une fois pour toutes.
4. **Granularité de la livraison.** Un refactor de cette taille ne peut pas être
   un seul commit. Combien de fichiers extraits par lot, avec `npm test` vert
   entre chaque ?
5. **Renoncement possible.** Si l'utilisateur accepte d'abandonner `file://`, le
   passage aux modules ES devient possible et change tout. C'est **sa** décision,
   pas la tienne : cette propriété est annoncée dans la documentation du projet.

## Règles de reprise

- **Un lot = un commit vert.** `npm test` doit passer avant chaque commit. Ne
  jamais empiler deux extractions non testées.
- **Le refactor ne change aucun comportement.** Aucun test existant ne doit être
  modifié pour « passer », sauf s'il vérifie explicitement la structure du
  fichier (c'est le cas de `load-app.js`, dont l'adaptation est prévue).
- **Interdit de renormaliser les fins de ligne.** `index.html` est en CRLF ; un
  outil qui réécrit tout le fichier produit un diff illisible qui rend la
  relecture impossible.
- **Ne touche ni `.claude/`, ni `.vscode/`, ni `.worktrees/`.**
- Commentaires, libellés et messages de commit **en français**.
- La branche part de `main`. En cas de doute sur le point de départ :
  `git merge-base main HEAD`.

## Si tu es coupé en cours de route

1. Commite ce qui est vert, même partiel, avec un message qui dit où ça s'arrête.
2. Mets à jour la section « Où en est-on » de ce document **dans le même
   commit**.
3. N'écris jamais dans ce document une étape « en cours » : soit elle est
   commitée, soit elle n'existe pas.
