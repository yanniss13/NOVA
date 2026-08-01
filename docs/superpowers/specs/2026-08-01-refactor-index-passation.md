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

**Travail effectué à ce jour : AUCUN.** Seul ce document existe. Rien n'a été
découpé, déplacé ni renommé. La branche part d'un `main` entièrement vert
(`npm test` = 0) et déployé sur GitHub Pages.

**Décision de conception : PAS ENCORE PRISE.** Voir « Ce qu'il faut trancher
avec l'utilisateur » plus bas. Ne touche pas au code avant d'avoir tranché.

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
