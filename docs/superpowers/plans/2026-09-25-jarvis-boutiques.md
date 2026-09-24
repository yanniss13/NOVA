# /jarvis — boutiques (lot 2c, étape 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/jarvis` répond à « où trouver X ? » (boutiques, prix) et « que vend telle boutique ? ».

**Architecture:** extraction pure `outils/fabrication/objets-jarvis.js` → `output/jarvis/objets.json` (bucket privé) → module bot `_shared/discord-jarvis-objets.js` (outils `ou_trouver`, `boutique`) branché dans `discord-jarvis-outils.js` et `discord-planning/index.ts` par le lecteur commun.

**Tech Stack:** Node (CommonJS) pour l'extraction et les tests, Deno pour l'Edge Function, Gemini (palier gratuit).

**Spec:** `docs/superpowers/specs/2026-09-25-jarvis-boutiques-design.md`

## Global Constraints

- Gemini palier gratuit uniquement : chaque résultat d'outil est borné.
- `output/jarvis/objets.json` n'entre jamais dans le dépôt (déjà couvert par `.gitignore` : `output/jarvis/`).
- L'export se lit par `DONNEES_JEU` ; aucun chemin personnel dans un fichier suivi.
- Noms de fonctions de premier niveau uniques (suffixe `Objet`/`Objets`), comme les autres modules jarvis.
- Pas de push sans accord du propriétaire.

## Review Focus

1. Recherche d'objet très courte (« or ») : l'exact doit gagner sur « Minerai d'or ». → test dans Task 3.
2. Région saisie sans accent (« foret » pour « Forêt du roi des fées ») : le filtre doit la trouver. → test dans Task 3.
3. Limite avec `GoodsResetTime::None` et `LimitCount` > 0 : « N au total », jamais « par undefined ». → test dans Task 1.
4. Deux articles identiques dans une même boutique (objets homonymes) : une seule ligne. → test dans Task 1.
5. Taille du fichier réel : `objets.json` doit rester sous 1 Mo, sinon réduire. → vérification dans Task 2.

---

### Task 1: Extraction pure `objets-jarvis.js`

**Files:**
- Create: `outils/fabrication/objets-jarvis.js`
- Test: `tests/objets-jarvis.test.js`

**Interfaces:**
- Consumes: `lecteurDeTextes(textes)` de `outils/fabrication/monstres-jarvis.js`.
- Produces: `construireCatalogueObjets(entree) -> { version:1, genereLe, dateExport, objets, boutiques, articlesEcartes }` avec
  `entree = { objets:{ etc, equip, use, quest, pet, dropType }, monnaies, articles, boutons, interactions, pnj, apparitions:[{ acteur, secteur, sousSecteur }], textes, genereLe, dateExport }`.
  Exporte aussi `ENTREE_OBJETS_TEST` depuis le test pour Task 3.

- [ ] **Step 1: Write the failing test** — mini-export : boutique d'équipement à deux PNJ (Alexander à Liones/Plaines de Liones, Karim à Vanya sans sous-région), boutique itinérante (Nyandin et Mou, Liones), boutique d'équipement à PNJ sans apparition, boutique d'équipement sans PNJ (homonymes → « (2) »), boutique d'échange d'événement sans PNJ (paiement en jeton via `LinkItemTid`, vente de la monnaie « Or » x1000 payée en objet). Articles : limite quotidienne, hebdomadaire, `Permanent`, `None` avec limite, niveau de monde, `GetCount` 5, deux épées homonymes identiques (une seule ligne), paiement introuvable et objet sans nom (écartés : `articlesEcartes` 2). Assertions `deepEqual` sur `boutiques` et `objets` entiers.
- [ ] **Step 2: Run** `node tests/objets-jarvis.test.js` — Expected: FAIL, module introuvable.
- [ ] **Step 3: Implement** selon la spec : objets par identifiant (familles dans l'ordre Etc, Equip, Use, Quest, Pet, DropType), monnaie par `LinkItemTid`, chaîne bouton → interaction → PNJ, régions « Principal (Sous) » dédoublonnées, nom de boutique `genre de région` puis suffixes « (2) » par identifiant croissant, articles triés par `Order` puis identifiant et dédoublonnés, prix `toLocaleString("fr-FR")` avec espace ordinaire, sources d'objet dédoublonnées, objets triés `localeCompare(…, "fr")`.
- [ ] **Step 4: Run** `node tests/objets-jarvis.test.js` — Expected: `OK objets-jarvis`.
- [ ] **Step 5: Commit** `feat(jarvis): extraction des boutiques et index des objets`.

### Task 2: Enveloppe `extraire-objets.js` et extraction réelle

**Files:**
- Create: `outils/fabrication/extraire-objets.js`
- Modify: `outils/fabrication/LISEZMOI.md`, `scripts/lancer-tests.js` (ajouter `node tests/objets-jarvis.test.js`)

**Interfaces:**
- Consumes: `construireCatalogueObjets` (Task 1).
- Produces: `output/jarvis/objets.json`.

- [ ] **Step 1:** écrire l'enveloppe : `lignesDeTable` (même garde que `extraire-monstres.js`), `apparitionsDesPnj(pnj)` qui parcourt `Table/Scene/Zone/**/_spawntable.json` et ne garde que les `ActorID` de `NPCActorTable`, puis écriture et comptes (objets, boutiques, articles écartés, Ko).
- [ ] **Step 2: Run** `DONNEES_JEU=… node outils/fabrication/extraire-objets.js` — Expected: ~49 boutiques, ~300 objets, fichier < 1 Mo.
- [ ] **Step 3:** contrôle à la main : la boutique d'équipement de Liones cite Alexander, la boutique de la confrérie est « menu ».
- [ ] **Step 4: Commit** `feat(jarvis): extraire-objets.js lit l'export`.

### Task 3: Module bot `discord-jarvis-objets.js`

**Files:**
- Create: `supabase/functions/_shared/discord-jarvis-objets.js`
- Modify: `supabase/functions/_shared/discord-jarvis-mecaniques.js` (exporter `motsProchesMecanique`)
- Test: `tests/discord-jarvis-objets.test.js`, ajouté à `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `normaliserRecherche`, `propositions` (`NOVA_DISCORD_BUILD`) ; `rangCorrespondanceJarvis`, `dateLisibleJarvis` (`NOVA_DISCORD_JARVIS_MONSTRES`) ; `motsProchesMecanique` (`NOVA_DISCORD_JARVIS_MECANIQUES`).
- Produces: `globalThis.NOVA_DISCORD_JARVIS_OBJETS = { CHEMIN_OBJETS_JARVIS, DECLARATIONS_OUTILS_OBJETS, validerCatalogueObjets, ajouterOutilsObjetsJarvis }`.

- [ ] **Step 1: Write the failing test** sur `construireCatalogueObjets(ENTREE_OBJETS_TEST)` : déclarations (`ou_trouver`, `boutique`, `OBJECT`), chemin `jarvis-prive/objets.json`, `ou_trouver` exact / partiel ambigu (`candidats`) / faute proche (`nomApproche`) / introuvable (`proches`) / « or » exact, bornes (12 sources, 40 articles), `boutique` par nom complet, par genre ambigu (`regionsPossibles`), par genre + région sans accent, menu, itinérante (`noteAleatoire`), inconnue (`boutiques`), fichier abîmé refusé, fichier absent (`données des objets indisponibles`), source « boutiques · données du jeu du 22/09/2026 ».
- [ ] **Step 2: Run** `node tests/discord-jarvis-objets.test.js` — Expected: FAIL, module introuvable.
- [ ] **Step 3: Implement** le module.
- [ ] **Step 4: Run** — Expected: `OK discord-jarvis-objets`.
- [ ] **Step 5: Commit** `feat(jarvis): outils ou_trouver et boutique`.

### Task 4: Branchement, consignes, documentation

**Files:**
- Modify: `supabase/functions/_shared/discord-jarvis-outils.js`, `supabase/functions/discord-planning/index.ts`, `supabase/functions/_shared/discord-jarvis.js`
- Modify tests: `tests/discord-jarvis-outils.test.js`, `tests/discord-planning.test.js`, `tests/discord-jarvis.test.js`
- Modify docs: `docs/discord-planning.md`, `AGENTS.md`

- [ ] **Step 1: Write the failing tests** : liste des déclarations avec `ou_trouver`, `boutique` ; `ou_trouver` sans lecteur → indisponible ; `index.ts` importe le module, crée le lecteur `nom:"objets"` et passe `lireObjets` ; consigne contient « boutique itinérante » et « les butins ne sont pas encore couverts » ; consigne demande les valeurs des effets d'un monstre.
- [ ] **Step 2: Run** les trois tests — Expected: FAIL.
- [ ] **Step 3: Implement** le branchement et les deux lignes de consigne.
- [ ] **Step 4: Run** `npm test` et `deno check` (copie isolée) — Expected: tout vert, 3 erreurs `Blob` préexistantes seulement.
- [ ] **Step 5: Commit** `feat(jarvis): boutiques branchées dans /jarvis`.
