# J.A.R.V.I.S. lot 2b — effets, porteurs et règles : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/jarvis` répond à « c'est quoi Pétrification ? », « qui réduit la défense ? » et « comment marche le Déluge ? » à partir des tables du jeu, déposées dans le bucket privé.

**Architecture:** Une extraction pure (`outils/fabrication/mecaniques-jarvis.js`) fabrique `mecaniques.json` depuis l'export local ; le propriétaire le dépose dans `jarvis-prive`. L'Edge Function le lit par un lecteur de stockage commun aux monstres et aux mécaniques, et expose trois outils en lecture seule à Gemini.

**Tech Stack:** Node (tests `assert`, `npm test`), Deno (Edge Function Supabase), JavaScript universel dans `supabase/functions/_shared/` (`require` côté Node, `globalThis.NOVA_*` côté Deno).

**Spec:** `docs/superpowers/specs/2026-09-24-jarvis-mecaniques-design.md`

## Global Constraints

- Palier gratuit de Gemini uniquement ; aucune facturation.
- Les données du jeu ne vont jamais dans le dépôt public ni sur Pages : `output/jarvis/` est ignoré par git, le bucket `jarvis-prive` n'a aucune politique.
- Aucun chemin personnel dans un fichier suivi par git (`tests/chemins-personnels.test.js`).
- Chaque module partagé est importé par `await import` dans `supabase/functions/discord-planning/index.ts`, après ceux qu'il lit (`tests/edge-modules.test.js`).
- Un seul nom par chose, sans alias : un renommage se fait partout dans le même commit.
- Commits en français, sans accents dans le message (convention du dépôt), terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Le dépôt est en CRLF par endroits : ancrer une modification multi-ligne avec l'outil Edit, jamais par un heredoc shell.
- Ne pas pousser : demander avant chaque poussée.

## Review Focus

1. Gemini passe une stat (« défense », « attaque ») à `fiche_effet` au lieu d'un nom d'effet : il obtient l'effet dont le nom contient ce mot, sinon `introuvable` et des noms proches, jamais une erreur muette. Test : Task 4, `fiche_effet({nom:"defense"})` et `({nom:"attaque"})`.
2. `chercher_effets` avec un texte vide ne doit jamais rendre tout le catalogue. Test : Task 4.
3. Un effet nommé sans description dans l'export (`Local_Desc` à `None`) garde une description `""`, que la validation accepte. Test : Task 2 (« Mystère ») et Task 4 (validation du catalogue extrait).
4. Filtre `heros` saisi avec une autre casse ou des accents (« BAN », « élizabeth »). Test : Task 4.
5. La vraie extraction doit rester petite et ses comptes plausibles (≈ 549 effets, 120 avec porteur, ≈ 230 sujets). Test : Task 3, lecture de la sortie réelle.

---

### Task 1: Lecteur de stockage commun

**Files:**
- Create: `supabase/functions/_shared/discord-jarvis-stockage.js`
- Modify: `supabase/functions/_shared/discord-jarvis-monstres.js` (retirer le lecteur, ajouter `validerCatalogueMonstres`)
- Modify: `supabase/functions/discord-planning/index.ts` (import, typage, `lireMonstresJarvis`)
- Create: `tests/discord-jarvis-stockage.test.js`
- Modify: `tests/discord-jarvis-monstres.test.js` (le bloc « Lecteur du bucket » part dans le nouveau test)
- Modify: `scripts/lancer-tests.js` (enregistrer le nouveau test)

**Interfaces:**
- Produces: `creerLecteurStockageJarvis({ fetch, url, cle, nom, valider, horloge, journaliser? }) → () => Promise<objet|null>` sur `globalThis.NOVA_DISCORD_JARVIS_STOCKAGE` ; `validerCatalogueMonstres(brut) → string|null` sur `NOVA_DISCORD_JARVIS_MONSTRES`.
- `creerLecteurMonstresJarvis` disparaît partout.

- [ ] **Step 1: Écrire le test du lecteur commun**

Créer `tests/discord-jarvis-stockage.test.js` :

```js
"use strict";

/* Le lecteur des fichiers de /jarvis deposes dans le bucket PRIVE
   jarvis-prive : cache, delai, lecture partagee, journal et refus du
   validateur. Faux fetch, fausse horloge. Le bucket lui-meme (prive, sans
   politique) est garde par tests/jarvis-stockage.test.js. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const S = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-stockage.js"));
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-monstres.js"));

const FICHIER = { version:1, contenu:["a"] };
const valider = brut => (brut && brut.version === 1 ? null : "format inconnu : " + (brut && brut.version));

function reponse(status, corps) {
  return { ok:status >= 200 && status < 300, status,
    json:async () => { if(corps instanceof Error) throw corps; return corps; } };
}

async function main() {
  let instant = 0;
  const appels = [];
  let suite = [reponse(200, FICHIER)];
  const lignes = [];
  const lire = S.creerLecteurStockageJarvis({
    url:"https://x.supabase.co/storage/v1/object/jarvis-prive/essai.json",
    cle:"service-role", nom:"essai", valider, horloge:() => instant,
    journaliser:ligne => lignes.push(ligne),
    fetch:async (url, init) => { appels.push({ url, init }); return suite.shift(); }
  });
  assert.equal(await lire(), FICHIER);
  assert.equal(appels[0].url, "https://x.supabase.co/storage/v1/object/jarvis-prive/essai.json");
  assert.equal(appels[0].init.headers.Authorization, "Bearer service-role");
  assert.equal(appels[0].init.headers.apikey, "service-role");
  assert.ok(appels[0].init.signal, "la lecture du stockage porte un délai");
  assert.deepEqual(lignes, [{ etape:"stockage-essai", ms:0, issue:"ok" }]);
  instant = 3_599_999;
  assert.equal(await lire(), FICHIER, "gardé une heure");
  assert.equal(appels.length, 1);
  instant = 3_600_001;
  suite = [reponse(404, {})];
  assert.equal(await lire(), null, "après l'heure, relu ; un 404 rend null");
  assert.equal(appels.length, 2);
  instant += 59_999;
  assert.equal(await lire(), null, "l'échec est gardé une minute");
  assert.equal(appels.length, 2);
  instant += 2;
  suite = [reponse(200, { version:2 })];
  assert.equal(await lire(), null, "refusé par le validateur");
  assert.equal(lignes[lignes.length - 1].issue, "format inconnu : 2",
    "le motif du refus est journalisé tel quel");
  instant += 60_001;
  suite = [reponse(200, new SyntaxError("JSON tronqué"))];
  assert.equal(await lire(), null, "JSON illisible refusé");

  const lireReseau = S.creerLecteurStockageJarvis({ url:"u", cle:"c", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {}, fetch:async () => { throw new TypeError("réseau"); } });
  assert.equal(await lireReseau(), null, "stockage injoignable : null, pas d'exception");

  const lireAvecDelai = S.creerLecteurStockageJarvis({ url:"u", cle:"c", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {},
    fetch:async () => { throw new DOMException("trop long", "TimeoutError"); } });
  assert.equal(await lireAvecDelai(), null, "délai dépassé : null, pas d'exception");

  /* Deux questions simultanees a froid : une seule lecture du fichier. */
  let lectures = 0;
  let libererLecture;
  const lectureEnCours = new Promise(resoudre => { libererLecture = resoudre; });
  const lirePartage = S.creerLecteurStockageJarvis({ url:"u", cle:"c", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {},
    fetch:async () => { lectures += 1; await lectureEnCours; return reponse(200, FICHIER); } });
  const [premiere, seconde] = [lirePartage(), lirePartage()];
  libererLecture();
  assert.deepEqual([await premiere, await seconde], [FICHIER, FICHIER]);
  assert.equal(lectures, 1, "une lecture partagée, pas deux");

  const sansConfig = S.creerLecteurStockageJarvis({ url:"", cle:"", nom:"essai", valider,
    horloge:() => 0, journaliser:() => {},
    fetch:async () => { throw new Error("ne doit pas être appelé"); } });
  assert.equal(await sansConfig(), null);

  /* Le validateur des monstres, branche sur ce lecteur par index.ts. */
  assert.equal(M.validerCatalogueMonstres({ version:1, monstres:[] }), null);
  assert.match(M.validerCatalogueMonstres({ version:2, monstres:[] }), /format de monstres\.json inconnu : 2/);
  assert.match(M.validerCatalogueMonstres({ version:1, monstres:[{ nom:"Esprit", versions:[{}] }] }),
    /entrée mal formée dans monstres\.json : Esprit/);
  assert.match(M.validerCatalogueMonstres(null), /format de monstres\.json inconnu/);
  assert.equal(M.creerLecteurMonstresJarvis, undefined, "un seul lecteur, sans alias");

  console.log("OK discord-jarvis-stockage");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
```

- [ ] **Step 2: Le lancer, le voir échouer**

Run: `node tests/discord-jarvis-stockage.test.js`
Expected: FAIL, `Cannot find module '…discord-jarvis-stockage.js'`.

- [ ] **Step 3: Écrire le lecteur commun**

Créer `supabase/functions/_shared/discord-jarvis-stockage.js` :

```js
"use strict";

/* Lecture des fichiers de /jarvis deposes dans le bucket PRIVE jarvis-prive
   (monstres.json, mecaniques.json). Seule la cle service_role de l'Edge
   Function les lit : ils ne sont ni dans le depot ni sur Pages.

   Un succes est garde une heure : un fichier redepose est pris en compte au
   plus tard une heure apres, sans redeploiement. Un echec est garde une
   minute, pour reessayer vite sans marteler le stockage. Le lecteur ne leve
   jamais : il rend le fichier ou null. */

const CACHE_STOCKAGE_SUCCES_MS = 3_600_000;
const CACHE_STOCKAGE_ECHEC_MS = 60_000;
/* La lecture reussie la plus lente observee a pris 646 ms : 5 s laissent de
   la marge sans laisser un stockage muet bloquer la question. */
const DELAI_LECTURE_STOCKAGE_MS = 5_000;

/* options : fetch, url (adresse complete), cle (service_role), nom (pour le
   journal), valider(brut) -> null si bon, sinon le motif du refus, horloge,
   journaliser facultatif. */
function creerLecteurStockageJarvis(options) {
  let memoire = null;
  /* Chaque lecture reelle (hors cache) laisse une ligne : sa duree et son
     issue. C'est la premiere suspecte quand /jarvis depasse son delai. */
  const journaliser = options.journaliser
    || (ligne => console.log(JSON.stringify({ jarvis:ligne })));
  /* Une seule lecture a la fois : deux questions simultanees sur une
     instance froide partagent la meme, au lieu de telecharger deux fois. */
  let enCours = null;
  return function lireStockageJarvis() {
    const maintenant = options.horloge();
    if(memoire && memoire.expire > maintenant) return Promise.resolve(memoire.valeur);
    if(!enCours){
      enCours = lireDepuisLeStockage(maintenant).finally(() => { enCours = null; });
    }
    return enCours;
  };

  async function lireDepuisLeStockage(maintenant) {
    let valeur = null;
    let issue = "ok";
    try {
      if(!options.url || !options.cle) throw new Error("configuration du stockage absente");
      const reponse = await options.fetch(options.url, {
        headers:{ Authorization:"Bearer " + options.cle, apikey:options.cle },
        /* Un stockage lent ne doit pas bloquer toute la reponse /jarvis. */
        signal:AbortSignal.timeout(DELAI_LECTURE_STOCKAGE_MS)
      });
      if(!reponse.ok) throw new Error("stockage -> " + reponse.status);
      const brut = await reponse.json();
      /* Tout le fichier, pas seulement l'en-tete : une seule entree mal
         formee ferait lever l'outil a chaque question pendant une heure. */
      const refus = options.valider(brut);
      if(refus) throw new Error(refus);
      valeur = brut;
    } catch (erreur) {
      issue = erreur instanceof Error ? erreur.message : String(erreur);
      console.error("Fichier /jarvis « " + options.nom + " » indisponible :", issue);
    }
    journaliser({ etape:"stockage-" + options.nom, ms:options.horloge() - maintenant, issue });
    memoire = {
      valeur,
      expire:maintenant + (valeur ? CACHE_STOCKAGE_SUCCES_MS : CACHE_STOCKAGE_ECHEC_MS)
    };
    return valeur;
  }
}

const discordJarvisStockageApi = { creerLecteurStockageJarvis };

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisStockageApi;
}
globalThis.NOVA_DISCORD_JARVIS_STOCKAGE = discordJarvisStockageApi;
```

- [ ] **Step 4: Retirer le lecteur du module des monstres**

Dans `supabase/functions/_shared/discord-jarvis-monstres.js` :

1. Supprimer les constantes `CACHE_MONSTRES_SUCCES_MS`, `CACHE_MONSTRES_ECHEC_MS`, `DELAI_LECTURE_MONSTRES_MS` et le commentaire « La lecture reussie la plus lente… » qui précède la dernière.
2. Remplacer le titre `/* ---------------- Lecteur du bucket ---------------- */` et le commentaire qui le suit (« Rend une fonction qui lit le catalogue… ») par `/* ---------------- Validation du fichier ---------------- */`.
3. Supprimer toute la fonction `creerLecteurMonstresJarvis` (de `function creerLecteurMonstresJarvis(options) {` jusqu'à son `}` final, juste avant `/* ---------------- Mise en mots ---------------- */`) et la remplacer par :

```js
/* Rend null si le fichier est bon, sinon le motif du refus : le lecteur de
   stockage commun le journalise et garde l'echec une minute. */
function validerCatalogueMonstres(brut) {
  if(!brut || brut.version !== 1 || !Array.isArray(brut.monstres)){
    return "format de monstres.json inconnu : " + (brut && brut.version);
  }
  const malFormee = brut.monstres.find(monstre => !catalogueMonstreValide(monstre));
  if(malFormee !== undefined){
    return "entrée mal formée dans monstres.json : "
      + String((malFormee && malFormee.nom) || "?").slice(0, 40);
  }
  return null;
}
```

4. Dans `discordJarvisMonstresApi`, remplacer `creerLecteurMonstresJarvis,` par `validerCatalogueMonstres,`.
5. Dans l'en-tête du fichier, remplacer « lecture du bucket prive et deux outils » par « validation du fichier du bucket prive et deux outils ».

- [ ] **Step 5: Déplacer les tests du lecteur**

Dans `tests/discord-jarvis-monstres.test.js` : supprimer tout le bloc qui va de `/* ---------------- Lecteur du bucket ---------------- */` jusqu'à la ligne `assert.equal(await sansConfig(), null);` incluse (le bloc suivant, `/* ---------------- fiche_monstre ---------------- */`, reste). Supprimer ensuite la fonction `reponse(status, corps)` si plus rien ne l'appelle (`grep -n "reponse(" tests/discord-jarvis-monstres.test.js`). Dans l'en-tête, remplacer « le lecteur du bucket prive (faux fetch, fausse horloge) et les deux outils » par « les deux outils ».

Dans `scripts/lancer-tests.js`, après `"node tests/discord-jarvis-monstres.test.js",`, ajouter la ligne `"node tests/discord-jarvis-stockage.test.js",`.

- [ ] **Step 6: Brancher index.ts**

Dans `supabase/functions/discord-planning/index.ts` :

1. Dans le type `EdgeSharedGlobal`, après `NOVA_DISCORD_JARVIS_MONSTRES?: unknown;`, ajouter `NOVA_DISCORD_JARVIS_STOCKAGE?: unknown;`.
2. Remplacer :

```ts
/* Lot 2a : les monstres, lus par les outils de /jarvis. */
await import("../_shared/discord-jarvis-monstres.js");
```

par :

```ts
/* Lots 2a et 2b : le lecteur du bucket prive, puis les monstres, lus par
   les outils de /jarvis. */
await import("../_shared/discord-jarvis-stockage.js");
await import("../_shared/discord-jarvis-monstres.js");
```

3. Remplacer le bloc `const { CHEMIN_MONSTRES_JARVIS, creerLecteurMonstresJarvis } = … }): () => Promise<unknown>;\n  };` par :

```ts
const { creerLecteurStockageJarvis } =
  edgeSharedGlobal.NOVA_DISCORD_JARVIS_STOCKAGE as {
    creerLecteurStockageJarvis(options: {
      fetch: typeof fetch;
      url: string;
      cle: string;
      nom: string;
      valider(brut: unknown): string | null;
      horloge(): number;
    }): () => Promise<unknown>;
  };
const { CHEMIN_MONSTRES_JARVIS, validerCatalogueMonstres } =
  edgeSharedGlobal.NOVA_DISCORD_JARVIS_MONSTRES as {
    CHEMIN_MONSTRES_JARVIS: string;
    validerCatalogueMonstres(brut: unknown): string | null;
  };
```

4. Dans `lireMonstresJarvis`, remplacer `lecteurMonstresJarvis = creerLecteurMonstresJarvis({` par `lecteurMonstresJarvis = creerLecteurStockageJarvis({`, et ajouter après `cle:config.serviceRoleKey,` les deux lignes `nom:"monstres",` et `valider:validerCatalogueMonstres,`.

- [ ] **Step 7: Lancer les tests**

Run: `node tests/discord-jarvis-stockage.test.js && node tests/discord-jarvis-monstres.test.js && node tests/edge-modules.test.js && grep -rn "creerLecteurMonstresJarvis" supabase tests docs AGENTS.md || echo "aucune trace"`
Expected: `OK discord-jarvis-stockage`, `OK discord-jarvis-monstres`, `OK edge-modules (…)`, puis `aucune trace`. Si `docs/` cite encore l'ancien nom, le remplacer par `creerLecteurStockageJarvis`.

- [ ] **Step 8: Vérifier le typage Deno**

Run (PowerShell ou Bash, depuis la racine) : copier `supabase/functions` dans un dossier du scratchpad, puis `npx -y deno@latest check --node-modules-dir=auto functions/discord-planning/index.ts` depuis ce dossier.
Expected: seulement les 3 erreurs TS2322 préexistantes sur `Blob` ; aucune erreur nouvelle.

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/discord-jarvis-stockage.js supabase/functions/_shared/discord-jarvis-monstres.js supabase/functions/discord-planning/index.ts tests/discord-jarvis-stockage.test.js tests/discord-jarvis-monstres.test.js scripts/lancer-tests.js
git commit -m "refactor(jarvis): un lecteur de stockage commun aux fichiers du bucket prive"
```

---

### Task 2: Extraction pure des mécaniques

**Files:**
- Create: `outils/fabrication/mecaniques-jarvis.js`
- Modify: `outils/fabrication/monstres-jarvis.js:270` (exporter `lecteurDeTextes` et `enListe`)
- Create: `tests/mecaniques-jarvis.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `lecteurDeTextes(textes) → (cle) => string|null`, `enListe(valeur) → string[]` de `monstres-jarvis.js`.
- Produces: `construireCatalogueMecaniques(entree) → { version:1, genereLe, dateExport, effets:[{ nom, nature, description, variantes:[{ valeurs:[{stat, valeur}], duree?, cumulMax?, cible, posePar:[{ heros, arme, competence, categorie, citeParDescription }] }] }], regles:[{ sujet, pages:string[] }] }`. Le test exporte `ENTREE_MECANIQUES_TEST` pour la Task 4.

- [ ] **Step 1: Écrire le test**

Créer `tests/mecaniques-jarvis.test.js` :

```js
"use strict";

/* L'extraction des mecaniques pour /jarvis, sur un mini-export ecrit ici.
   Les formes sont celles de l'export reel du 24/09/2026 : le Canon a eau
   d'Elizabeth et ses deux effets (l'un cite par la description, l'autre
   non), deux buffs de meme nom pour l'equipe et pour le porteur, un
   controle sans porteur, un effet sans texte, un identifiant de competence
   qui en prolonge un autre, et les tables du journal et des guides. */

const assert = require("node:assert/strict");
const path = require("node:path");

const { construireCatalogueMecaniques } = require(path.resolve(
  __dirname, "..", "outils", "fabrication", "mecaniques-jarvis.js"
));

const ajout = (code, valeur) => ({ TargetAbil:"EAbilityType::" + code, Value:valeur });
function buff(type, application, cle, ajouts, cumul, detail) {
  return { Type:"EBuffDivision::" + type, DetailType:"EBuffType::" + (detail || "None"),
    ApplyType:"EApplyType::" + application, Local_Key:cle,
    Local_Desc:cle === "None" ? "None" : cle.replace(/_Name$/, "_Desc"),
    AddAbil_List:ajouts, StackType:{ MaxStack:cumul } };
}
const pose = (id, ms) => ({ BuffTid:id, BuffTime:ms });

const ENTREE_MECANIQUES_TEST = {
  buffs:{
    "302171011":buff("DeBuff", "Team", "Local_Buff_Splash_Name", [ajout("I_DefAdd_Rate", -2000)], 1),
    "302171012":buff("DeBuff", "Team", "Local_Buff_WeakUp_Name",
      [ajout("Thunder_Weakness_Rate", 1000), ajout("Holy_Weakness_Rate", 1000)], 1),
    "302171017":buff("Buff", "Team", "None", [], 1),
    "301000001":buff("Buff", "Team", "Local_Buff_AtkUp_Name", [ajout("I_AtkAdd_Rate", 1500)], 1),
    "301000002":buff("Buff", "Hero", "Local_Buff_AtkUp_Name", [ajout("I_AtkAdd_Rate", 3000), ajout("None", 5)], 5),
    "301000003":buff("Buff", "Hero", "Local_Buff_Mystery_Name", [ajout("Mystery_Stat", 42)], 0),
    "309000001":buff("DeBuff", "Team", "Local_Buff_Petrify_Name", [ajout("Earth_Weakness_Rate", 1500)], 1, "StateCC"),
    "309000002":buff("DeBuff", "Team", "Local_Debuff_Fear_Name", [], 1)
  },
  comportements:{
    elizabeth_book_skill_q_a:{ BehaviorDetail_SetBuffTid:[pose("302171011", 40000), pose("302171012", 20000)] },
    elizabeth_book_skill_q_b:{ BehaviorDetail_SetBuffTid:[pose("302171011", 40000), pose("302171012", 20000)] },
    elizabeth_book_skill_e:{ BehaviorDetail_SetBuffTid:[pose("302171017", 20000)] },
    ban_cudgel3c_skill_e:{ BehaviorDetail_SetBuffTid:[pose("301000001", 30000)] },
    ban_cudgel3c_skill_q:{ BehaviorDetail_SetBuffTid:[pose("301000002", -1)] },
    ban_cudgel3c_skill_q_ex_a:{ BehaviorDetail_SetBuffTid:[pose("301000003", 10000)] },
    common_effect_atk:{ BehaviorDetail_SetBuffTid:[pose("301000001", 30000)] },
    ban_cudgel3c_skill_e_vide:{ BehaviorDetail_SetBuffTid:[pose("999", 1000)] }
  },
  competences:{
    elizabeth:[
      { gameId:"elizabeth_book_skill_q", weaponType:"Book", categorie:"ACTIVE_THIRD", nomFr:"Canon à eau",
        descriptionFr:"Inflige [#0F5CD8]Éclaboussures[-] à l'ennemi pendant [#1A7331]40s[-]." },
      { gameId:"elizabeth_book_skill_e", weaponType:"Book", categorie:"NORMAL_SKILL",
        nomFr:"Bouchée rafraîchissante", descriptionFr:"Soigne." }
    ],
    ban:[
      { gameId:"ban_cudgel3c_skill_e", weaponType:"Cudgel3c", categorie:"NORMAL_SKILL",
        nomFr:"Ruée en spirale", descriptionFr:"Augmente l'attaque de 15 %." },
      { gameId:"ban_cudgel3c_skill_q", weaponType:"Cudgel3c", categorie:"ACTIVE_THIRD",
        nomFr:"Chaîne", descriptionFr:"AUGMENTATION DE L'ATTAQUE de 30 %." },
      { gameId:"ban_cudgel3c_skill_q_ex", weaponType:"Lance", categorie:"ACTIVE_THIRD",
        nomFr:"Chaîne renforcée", descriptionFr:"Rien." }
    ]
  },
  personnages:{
    elizabeth:{ nom:"Elizabeth", armes:[{ type:"Book", arme:"Grimoire" }] },
    ban:{ nom:"Ban", armes:[{ type:"Cudgel3c", arme:"Nunchaku" }] }
  },
  libelles:{
    I_DefAdd_Rate:{ fr:"Augmentation de la défense", taux:true },
    I_AtkAdd_Rate:{ fr:"Augmentation de l'attaque", taux:true }
  },
  unites:{
    I_DefAdd_Rate:{ family:"additional", unit:"ten-thousandths" },
    I_AtkAdd_Rate:{ family:"additional", unit:"ten-thousandths" }
  },
  journal:{
    combat_1:{ Local_Key:"Local_Tutorial_Log_SubTitle_Burst_Fire" },
    combat_2:{ Local_Key:"Local_Tutorial_Log_SubTitle_Vide" },
    combat_3:{ Local_Key:"None" }
  },
  pagesJournal:{
    combat_1_2:{ Group_Tid:"combat_1", List_Sort:2, Pc_Desc_Local:"local_tutorial_log_pagedesc_burst_fire02" },
    combat_1_1:{ Group_Tid:"combat_1", List_Sort:1, Pc_Desc_Local:"local_tutorial_log_pagedesc_burst_fire01" },
    combat_1_10:{ Group_Tid:"combat_1", List_Sort:10, Pc_Desc_Local:"local_tutorial_log_pagedesc_burst_fire10" },
    combat_3_1:{ Group_Tid:"combat_3", List_Sort:1, Pc_Desc_Local:"local_tutorial_log_pagedesc_orphelin" }
  },
  guides:{
    burst_fire:{ Title_Local:"ui_tutorial_burst_fire_title", Group_Value:["burst_fire_1", "burst_fire_2"] },
    meliodas_sword:{ Title_Local:"ui_guide_meliodas_sword_title", Group_Value:["meliodas_sword_1"] }
  },
  pagesGuides:{
    burst_fire_1:{ Pc_Desc_Local:["local_tutorial_log_pagedesc_burst_fire02"] },
    burst_fire_2:{ Pc_Desc_Local:["ui_tutorial_burst_fire_desc_03"] },
    meliodas_sword_1:{ Pc_Desc_Local:["ui_guide_meliodas_sword_desc"] }
  },
  textes:{
    local_buff_splash_name:"Éclaboussures",
    local_buff_splash_desc:"Réduit la défense de [#1A7331]{0}[-]",
    Local_Buff_WeakUp_Name:"Augmentation des dégâts de faiblesse",
    Local_Buff_WeakUp_Desc:"Dégâts de faiblesse +{0}",
    Local_Buff_AtkUp_Name:"Augmentation de l'attaque",
    Local_Buff_AtkUp_Desc:"Attaque +{0}",
    Local_Buff_Mystery_Name:"Mystère",
    Local_Buff_Petrify_Name:"Pétrification",
    Local_Buff_Petrify_Desc:"Immobilisation. Dégâts de Terre subis +{0}",
    local_tutorial_log_subtitle_burst_fire:"Déluge élémentaire - Feu",
    local_tutorial_log_subtitle_vide:"Sujet sans page",
    local_tutorial_log_pagedesc_burst_fire01:"Remplissez la [#FF0000]jauge[-] avec {Inputkey_Hero_Attack}.",
    local_tutorial_log_pagedesc_burst_fire02:"Deuxième page.",
    local_tutorial_log_pagedesc_burst_fire10:"Dixième page.",
    local_tutorial_log_pagedesc_orphelin:"Page sans titre.",
    ui_tutorial_burst_fire_title:"Déluge élémentaire - Feu",
    ui_tutorial_burst_fire_desc_03:"Page du guide.",
    ui_guide_meliodas_sword_title:"Meliodas (épée longue)",
    ui_guide_meliodas_sword_desc:"Enchaînez les coups.",
    ui_loadingtip_desc_08:"Astuce huit.",
    ui_loadingtip_desc_02:"Astuce deux."
  },
  genereLe:"2026-09-24T12:00:00.000Z",
  dateExport:"2026-09-24"
};

function main() {
  const catalogue = construireCatalogueMecaniques(ENTREE_MECANIQUES_TEST);
  assert.equal(catalogue.version, 1);
  assert.equal(catalogue.dateExport, "2026-09-24");
  assert.equal(catalogue.genereLe, "2026-09-24T12:00:00.000Z");
  assert.deepEqual(catalogue.effets.map(effet => effet.nom), [
    "Augmentation de l'attaque", "Augmentation des dégâts de faiblesse",
    "Éclaboussures", "Mystère", "Pétrification"
  ], "tri par nom ; l'effet sans nom et celui dont le texte manque sont écartés");

  const effet = nom => catalogue.effets.find(entree => entree.nom === nom);
  assert.deepEqual(effet("Éclaboussures"), {
    nom:"Éclaboussures", nature:"malus", description:"Réduit la défense de X",
    variantes:[{
      valeurs:[{ stat:"Augmentation de la défense", valeur:"-20 %" }],
      duree:40, cumulMax:1, cible:"ennemi",
      posePar:[{ heros:"Elizabeth", arme:"Grimoire", competence:"Canon à eau",
        categorie:"ACTIVE_THIRD", citeParDescription:true }]
    }]
  }, "posé par _a et _b : un seul porteur");

  assert.deepEqual(effet("Augmentation des dégâts de faiblesse").variantes, [{
    valeurs:[
      { stat:"Dégâts de faiblesse Foudre", valeur:"+10 %" },
      { stat:"Dégâts de faiblesse Sacré", valeur:"+10 %" }
    ],
    duree:20, cumulMax:1, cible:"ennemi",
    posePar:[{ heros:"Elizabeth", arme:"Grimoire", competence:"Canon à eau",
      categorie:"ACTIVE_THIRD", citeParDescription:false }]
  }], "familles élémentaires libellées et en dix-millièmes ; nom absent de la description");

  assert.deepEqual(effet("Augmentation de l'attaque").variantes, [
    { valeurs:[{ stat:"Augmentation de l'attaque", valeur:"+15 %" }], duree:30, cumulMax:1, cible:"equipe",
      posePar:[{ heros:"Ban", arme:"Nunchaku", competence:"Ruée en spirale",
        categorie:"NORMAL_SKILL", citeParDescription:false }] },
    { valeurs:[{ stat:"Augmentation de l'attaque", valeur:"+30 %" }], cumulMax:5, cible:"porteur",
      posePar:[{ heros:"Ban", arme:"Nunchaku", competence:"Chaîne",
        categorie:"ACTIVE_THIRD", citeParDescription:true }] }
  ], "Team → équipe, Hero → porteur ; -1 ms → sans durée ; la stat None est ignorée ;"
    + " le comportement commun sans compétence est ignoré ; citation sans casse");

  assert.deepEqual(effet("Mystère"), {
    nom:"Mystère", nature:"buff", description:"",
    variantes:[{ valeurs:[{ stat:"Mystery_Stat", valeur:"42 (valeur brute)" }], duree:10, cible:"porteur",
      posePar:[{ heros:"Ban", arme:"Lance", competence:"Chaîne renforcée",
        categorie:"ACTIVE_THIRD", citeParDescription:false }] }]
  }, "le plus long identifiant gagne ; type d'arme inconnu gardé brut ; cumul 0 omis ; sans description");

  assert.deepEqual(effet("Pétrification"), {
    nom:"Pétrification", nature:"controle", description:"Immobilisation. Dégâts de Terre subis +X",
    variantes:[{ valeurs:[{ stat:"Dégâts de faiblesse Terre", valeur:"+15 %" }], cumulMax:1,
      cible:"ennemi", posePar:[] }]
  }, "StateCC passe avant DeBuff ; sans porteur, gardé dans le glossaire");

  assert.deepEqual(catalogue.regles, [
    { sujet:"Astuces de chargement", pages:["Astuce deux.", "Astuce huit."] },
    { sujet:"Déluge élémentaire - Feu", pages:[
      "Remplissez la jauge avec (touche).", "Deuxième page.", "Dixième page.", "Page du guide."
    ] },
    { sujet:"Meliodas (épée longue)", pages:["Enchaînez les coups."] }
  ], "journal trié par List_Sort ; guide de même titre fusionné sans doublon ;"
    + " sujets sans page ou sans titre écartés");

  console.log("OK mecaniques-jarvis");
}

module.exports = { ENTREE_MECANIQUES_TEST };

if(require.main === module) main();
```

- [ ] **Step 2: Le lancer, le voir échouer**

Run: `node tests/mecaniques-jarvis.test.js`
Expected: FAIL, `Cannot find module '…mecaniques-jarvis.js'`.

- [ ] **Step 3: Exporter les deux utilitaires du lot 2a**

Dans `outils/fabrication/monstres-jarvis.js`, remplacer `module.exports = { construireCatalogueMonstres };` par :

```js
module.exports = { construireCatalogueMonstres, lecteurDeTextes, enListe };
```

- [ ] **Step 4: Écrire l'extraction**

Créer `outils/fabrication/mecaniques-jarvis.js` :

```js
"use strict";

/* Les effets du jeu et ses regles, que /jarvis consulte : logique PURE.

   Elle recoit les tables deja lues et rend l'objet a deposer dans le bucket
   prive `jarvis-prive`. Aucun acces disque ici : `extraire-mecaniques.js`
   lit l'export, et les tests lui tendent un mini-export.

   LA CHAINE, verifiee sur l'export du 24/09/2026 :
     BuffTable[id].Local_Key / Local_Desc -> Localization fr (sans la casse)
     Competence -> effets : par le NOM. Les comportements de
       PC_SkillBehaviorTable s'appellent comme l'identifiant de la
       competence (data/wiki-competences.js), ou le prolongent par « _ ».
       BehaviorDetail_SetBuffTid[] donne BuffTid et BuffTime (ms).
     TutorialLogGroupTable + TutorialLogTable, GuidePopupGroupTable +
       GuidePopupTable -> les regles, dans les mots du jeu. */

const { lecteurDeTextes, enListe } = require("./monstres-jarvis.js");

const ELEMENTS_MECANIQUES = {
  Default:"Physique", Thunder:"Foudre", Wind:"Vent", Fire:"Feu",
  Ice:"Glace", Earth:"Terre", Dark:"Ténèbres", Holy:"Sacré"
};
/* Absentes de libelles-stats.json, en dix-milliemes (etabli au lot 2a). */
const FAMILLE_ELEMENTAIRE = /^(Default|Thunder|Wind|Fire|Ice|Earth|Dark|Holy)_(Weakness_Rate|Element_Res_Rate)$/;
const BALISES_MECANIQUES = /\[#?[-0-9A-Fa-f]*\]/g;

function nettoyerMecanique(texte) {
  return String(texte || "")
    .replace(BALISES_MECANIQUES, "")
    .replace(/\{Inputkey_[^}]*\}/gi, "(touche)")
    .replace(/\{\d+\}/g, "X")
    .trim();
}

function sansAccentsMecanique(texte) {
  return String(texte || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/* Le controle d'abord : Petrification est un DeBuff de DetailType StateCC. */
function natureDuBuff(buff) {
  if(String(buff.DetailType) === "EBuffType::StateCC"
    || String(buff.Type) === "EBuffDivision::SystemDebuff") return "controle";
  if(String(buff.Type) === "EBuffDivision::DeBuff") return "malus";
  return "buff";
}

/* « Team » sur un malus n'a pas de sens etabli : un malus vise l'ennemi. */
function cibleDuBuff(buff, nature) {
  if(nature !== "buff") return "ennemi";
  return String(buff.ApplyType) === "EApplyType::Team" ? "equipe" : "porteur";
}

function libelleStatMecanique(code, libelles) {
  const connu = libelles[code];
  if(connu && (connu.court || connu.fr)) return connu.court || connu.fr;
  const famille = FAMILLE_ELEMENTAIRE.exec(code);
  if(famille){
    return (famille[2] === "Weakness_Rate" ? "Dégâts de faiblesse " : "Résistance élémentaire ")
      + ELEMENTS_MECANIQUES[famille[1]];
  }
  return code;
}

/* L'unite ne se devine jamais d'apres le nom du code : stat-metadata.json,
   ou la famille elementaire etablie, sinon la valeur brute annoncee. */
function valeurLisibleMecanique(code, valeur, unites) {
  const unite = (unites[code] && unites[code].unit)
    || (FAMILLE_ELEMENTAIRE.test(code) ? "ten-thousandths" : null);
  const signe = valeur > 0 ? "+" : "";
  if(unite === "ten-thousandths"){
    return signe + String(Number((valeur / 100).toFixed(2))).replace(".", ",") + " %";
  }
  if(unite === "flat") return signe + valeur;
  return valeur + " (valeur brute)";
}

function valeursDuBuff(buff, libelles, unites) {
  return (buff.AddAbil_List || []).map(ajout => {
    const code = String(ajout && ajout.TargetAbil || "").replace("EAbilityType::", "");
    const valeur = Number(ajout && ajout.Value) || 0;
    if(!code || code === "None" || !valeur) return null;
    return { stat:libelleStatMecanique(code, libelles), valeur:valeurLisibleMecanique(code, valeur, unites) };
  }).filter(Boolean);
}

/* Nom de comportement -> competence. Le plus long identifiant gagne : si un
   jour « x_skill_q_ex » existe a cote de « x_skill_q », « x_skill_q_ex_a »
   revient au premier. */
function proprietairesDesComportements(competences, comportements) {
  const candidates = [];
  Object.entries(competences || {}).forEach(([slug, liste]) => {
    (liste || []).forEach(competence => {
      if(competence && competence.gameId) candidates.push({ slug, competence });
    });
  });
  candidates.sort((a, b) => b.competence.gameId.length - a.competence.gameId.length);
  const proprietaires = new Map();
  Object.keys(comportements || {}).forEach(nom => {
    const trouve = candidates.find(({ competence }) =>
      nom === competence.gameId || nom.startsWith(competence.gameId + "_"));
    if(trouve) proprietaires.set(nom, trouve);
  });
  return proprietaires;
}

function porteurDeCompetence(proprietaire, personnages, nomEffet) {
  const { slug, competence } = proprietaire;
  const personnage = (personnages || {})[slug] || {};
  const arme = (personnage.armes || []).find(entree => entree && entree.type === competence.weaponType);
  return {
    heros:personnage.nom || slug,
    arme:arme ? arme.arme : String(competence.weaponType || ""),
    competence:competence.nomFr,
    categorie:competence.categorie,
    citeParDescription:sansAccentsMecanique(nettoyerMecanique(competence.descriptionFr))
      .includes(sansAccentsMecanique(nomEffet))
  };
}

function cleDePorteur(porteur) {
  return porteur.heros + "|" + porteur.arme + "|" + porteur.competence;
}

function reglesDuJeu(entree, lire) {
  const parSujet = new Map();
  function ajouter(titre, pages) {
    const sujet = nettoyerMecanique(titre);
    const propres = pages.map(nettoyerMecanique).filter(Boolean);
    if(!sujet || !propres.length) return;
    const liste = parSujet.get(sujet) || [];
    propres.forEach(page => { if(!liste.includes(page)) liste.push(page); });
    parSujet.set(sujet, liste);
  }
  const pagesJournal = Object.values(entree.pagesJournal || {});
  Object.entries(entree.journal || {}).forEach(([id, groupe]) => {
    ajouter(lire(groupe && groupe.Local_Key), pagesJournal
      .filter(page => page && page.Group_Tid === id)
      .sort((a, b) => (Number(a.List_Sort) || 0) - (Number(b.List_Sort) || 0))
      .map(page => lire(page.Pc_Desc_Local)));
  });
  const pagesGuides = entree.pagesGuides || {};
  Object.values(entree.guides || {}).forEach(groupe => {
    ajouter(lire(groupe && groupe.Title_Local), enListe(groupe && groupe.Group_Value)
      .flatMap(id => enListe(pagesGuides[id] && pagesGuides[id].Pc_Desc_Local))
      .map(lire));
  });
  ajouter("Astuces de chargement", Object.keys(entree.textes || {})
    .map(cle => [cle, /^ui_loadingtip_desc_(\d+)$/i.exec(cle)])
    .filter(([, numero]) => numero)
    .sort((a, b) => Number(a[1][1]) - Number(b[1][1]))
    .map(([cle]) => lire(cle)));
  return [...parSujet].map(([sujet, pages]) => ({ sujet, pages }))
    .sort((a, b) => a.sujet.localeCompare(b.sujet, "fr"));
}

function construireCatalogueMecaniques(entree) {
  const lire = lecteurDeTextes(entree.textes);
  const libelles = entree.libelles || {};
  const unites = entree.unites || {};
  const buffs = entree.buffs || {};

  /* Les buffs nommes, du plus petit identifiant au plus grand : le premier
     d'un nom donne la nature et la description de l'effet. */
  const nommes = new Map();
  const premierParNom = new Map();
  Object.keys(buffs).sort((a, b) => Number(a) - Number(b)).forEach(id => {
    const brut = buffs[id];
    const nom = brut && nettoyerMecanique(lire(brut.Local_Key));
    if(!nom) return;
    const nature = natureDuBuff(brut);
    const cumul = Number(brut.StackType && brut.StackType.MaxStack) || 0;
    const info = {
      nom, nature, rang:Number(id),
      description:nettoyerMecanique(lire(brut.Local_Desc)),
      valeurs:valeursDuBuff(brut, libelles, unites),
      cumulMax:cumul > 0 ? cumul : undefined,
      cible:cibleDuBuff(brut, nature)
    };
    nommes.set(id, info);
    if(!premierParNom.has(nom)) premierParNom.set(nom, info);
  });

  const variantesParNom = new Map();
  function variante(id, dureeMs) {
    const info = nommes.get(id);
    if(!variantesParNom.has(info.nom)) variantesParNom.set(info.nom, new Map());
    const variantes = variantesParNom.get(info.nom);
    const duree = dureeMs > 0 ? Number((dureeMs / 1000).toFixed(2)) : undefined;
    const cle = JSON.stringify([info.valeurs, duree === undefined ? null : duree,
      info.cumulMax === undefined ? null : info.cumulMax, info.cible]);
    let courante = variantes.get(cle);
    if(!courante){
      courante = { valeurs:info.valeurs };
      if(duree !== undefined) courante.duree = duree;
      if(info.cumulMax !== undefined) courante.cumulMax = info.cumulMax;
      courante.cible = info.cible;
      courante.posePar = [];
      courante.rang = info.rang;
      variantes.set(cle, courante);
    }
    courante.rang = Math.min(courante.rang, info.rang);
    return courante;
  }

  const proprietaires = proprietairesDesComportements(entree.competences, entree.comportements);
  const appliques = new Set();
  Object.keys(entree.comportements || {}).sort().forEach(nomComportement => {
    const proprietaire = proprietaires.get(nomComportement);
    if(!proprietaire) return;
    (entree.comportements[nomComportement].BehaviorDetail_SetBuffTid || []).forEach(pose => {
      const id = String(pose && pose.BuffTid);
      if(!nommes.has(id)) return;
      appliques.add(id);
      const courante = variante(id, Number(pose.BuffTime));
      const porteur = porteurDeCompetence(proprietaire, entree.personnages, nommes.get(id).nom);
      if(!courante.posePar.some(deja => cleDePorteur(deja) === cleDePorteur(porteur))){
        courante.posePar.push(porteur);
      }
    });
  });
  /* Un effet que ne pose aucune competence de heros reste au glossaire :
     il repond a « c'est quoi Gel ? ». */
  nommes.forEach((info, id) => { if(!appliques.has(id)) variante(id, -1); });

  const effets = [...variantesParNom].map(([nom, variantes]) => {
    const premier = premierParNom.get(nom);
    return {
      nom,
      nature:premier.nature,
      description:premier.description,
      variantes:[...variantes.values()]
        .sort((a, b) => Number(b.posePar.length > 0) - Number(a.posePar.length > 0) || a.rang - b.rang)
        .map(({ rang, ...reste }) => Object.assign(reste, {
          posePar:reste.posePar.sort((a, b) =>
            a.heros.localeCompare(b.heros, "fr") || a.competence.localeCompare(b.competence, "fr"))
        }))
    };
  }).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return {
    version:1,
    genereLe:entree.genereLe,
    dateExport:entree.dateExport,
    effets,
    regles:reglesDuJeu(entree, lire)
  };
}

module.exports = { construireCatalogueMecaniques };
```

- [ ] **Step 5: Lancer le test**

Run: `node tests/mecaniques-jarvis.test.js && node tests/monstres-jarvis.test.js`
Expected: `OK mecaniques-jarvis` puis `OK monstres-jarvis`. En cas d'écart sur l'ordre d'un tri `localeCompare`, lire la valeur réelle avant de toucher au test : c'est le code qui doit suivre la spec.

- [ ] **Step 6: Enregistrer le test et commiter**

Dans `scripts/lancer-tests.js`, après `"node tests/monstres-jarvis.test.js",`, ajouter `"node tests/mecaniques-jarvis.test.js",`.

```bash
git add outils/fabrication/mecaniques-jarvis.js outils/fabrication/monstres-jarvis.js tests/mecaniques-jarvis.test.js scripts/lancer-tests.js
git commit -m "feat(jarvis): extraction pure des effets, porteurs et regles du jeu"
```

---

### Task 3: Enveloppe d'extraction et vraie sortie

**Files:**
- Create: `outils/fabrication/extraire-mecaniques.js`

**Interfaces:**
- Consumes: `construireCatalogueMecaniques(entree)` (Task 2).
- Produces: `output/jarvis/mecaniques.json` (ignoré par git), à déposer dans `jarvis-prive`.

- [ ] **Step 1: Écrire l'enveloppe**

Créer `outils/fabrication/extraire-mecaniques.js` :

```js
"use strict";

/* Extrait les effets du jeu et ses regles pour /jarvis.

   Lit l'export local designe par DONNEES_JEU (le dossier `Content`), plus
   trois fichiers publics du depot (competences du wiki, heros de /jarvis,
   libelles et unites des stats), et ecrit output/jarvis/mecaniques.json, a
   deposer dans le bucket PRIVE jarvis-prive de Supabase (Storage). Ce
   fichier n'entre jamais dans le depot : .gitignore l'en empeche.

   La logique vit dans mecaniques-jarvis.js, testee en CI sans l'export.

     $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
     node outils/fabrication/extraire-mecaniques.js
*/

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { construireCatalogueMecaniques } = require("./mecaniques-jarvis.js");

const CONTENU = process.env.DONNEES_JEU || "";
const RACINE = path.resolve(__dirname, "..", "..");
const SORTIE = path.join(RACINE, "output", "jarvis", "mecaniques.json");

function lignesDeTable(relatif) {
  const fichier = path.join(CONTENU, "Table", relatif);
  const brut = JSON.parse(fs.readFileSync(fichier, "utf8"));
  const lignes = Array.isArray(brut) && brut[0] && brut[0].Rows;
  if(!lignes || !Object.keys(lignes).length){
    throw new Error("Table vide ou illisible : " + relatif);
  }
  return lignes;
}

function jsonDuDepot(relatif) {
  return JSON.parse(fs.readFileSync(path.join(RACINE, relatif), "utf8"));
}

/* data/wiki-competences.js pose window.SEVEN_DS_WIKI_COMPETENCES. */
function competencesDuWiki() {
  const contexte = { window:{} };
  vm.runInNewContext(fs.readFileSync(path.join(RACINE, "data", "wiki-competences.js"), "utf8"), contexte);
  const competences = contexte.window.SEVEN_DS_WIKI_COMPETENCES;
  if(!competences || !Object.keys(competences).length) throw new Error("wiki-competences.js vide");
  return competences;
}

function main() {
  if(!CONTENU){
    console.error("DONNEES_JEU n'est pas défini. Lancer d'abord :\n"
      + "  $env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path");
    process.exit(1);
  }
  const tableBuffs = path.join(CONTENU, "Table", "Buff", "BuffTable.json");
  const catalogue = construireCatalogueMecaniques({
    buffs:lignesDeTable("Buff/BuffTable.json"),
    comportements:lignesDeTable("Skill/PC_SkillBehaviorTable.json"),
    journal:lignesDeTable("TutorialLogGroupTable.json"),
    pagesJournal:lignesDeTable("TutorialLogTable.json"),
    guides:lignesDeTable("GuidePopup/GuidePopupGroupTable.json"),
    pagesGuides:lignesDeTable("GuidePopup/GuidePopupTable.json"),
    textes:JSON.parse(fs.readFileSync(
      path.join(CONTENU, "Localization", "Game", "fr", "Game.json"), "utf8"
    )).client_language_table,
    competences:competencesDuWiki(),
    personnages:jsonDuDepot("data/connaissances-discord.json").personnages,
    libelles:jsonDuDepot("7ds-stats/libelles-stats.json"),
    unites:jsonDuDepot("7ds-stats/stat-metadata.json"),
    genereLe:new Date().toISOString(),
    dateExport:fs.statSync(tableBuffs).mtime.toISOString().slice(0, 10)
  });
  fs.mkdirSync(path.dirname(SORTIE), { recursive:true });
  const texte = JSON.stringify(catalogue);
  fs.writeFileSync(SORTIE, texte);
  const avecPorteur = catalogue.effets.filter(effet =>
    effet.variantes.some(variante => variante.posePar.length)).length;
  console.log("Écrit " + path.relative(RACINE, SORTIE) + " : " + catalogue.effets.length
    + " effets (" + avecPorteur + " posés par un héros), " + catalogue.regles.length
    + " sujets de règles, " + Math.round(Buffer.byteLength(texte) / 1024) + " Ko.");
  console.log("À déposer dans le bucket privé « jarvis-prive » (Supabase → Storage).");
}

main();
```

- [ ] **Step 2: Lancer la vraie extraction**

Run (PowerShell) : `$env:DONNEES_JEU = "<dossier Content de l'export FModel>"; node outils/fabrication/extraire-mecaniques.js`
Expected: `Écrit output/jarvis/mecaniques.json : ≈549 effets (≈120 posés par un héros), ≈230 sujets de règles, … Ko.` La taille doit rester sous 2 Mo. Des comptes très différents (par exemple 0 porteur) signalent une rupture de la chaîne : la déboguer avant d'aller plus loin.

- [ ] **Step 3: Contrôler le cas de référence**

Run: `node -e "const c=require('./output/jarvis/mecaniques.json');const e=c.effets.find(x=>x.nom==='Éclaboussures');console.log(JSON.stringify(e.variantes.slice(0,2),null,1));console.log(c.regles.filter(r=>/Déluge|Meliodas/.test(r.sujet)).map(r=>r.sujet+' ('+r.pages.length+')').join(' | '))"`
Expected: une variante `-20 %`, `duree:40`, `cible:"ennemi"`, posée par Elizabeth (Grimoire) avec « Canon à eau », `citeParDescription:true` ; la liste des sujets contient « Déluge », les « Déluge élémentaire - … » et des « Meliodas (…) ».

- [ ] **Step 4: Vérifier que rien du jeu n'est suivi par git**

Run: `git status --porcelain output/ ; node tests/jarvis-stockage.test.js ; node tests/chemins-personnels.test.js`
Expected: aucune ligne pour `output/`, puis `OK jarvis-stockage` et le OK du test des chemins personnels.

- [ ] **Step 5: Commit**

```bash
git add outils/fabrication/extraire-mecaniques.js
git commit -m "feat(jarvis): extraction des mecaniques depuis l'export local"
```

---

### Task 4: Les trois outils

**Files:**
- Create: `supabase/functions/_shared/discord-jarvis-mecaniques.js`
- Modify: `supabase/functions/_shared/discord-jarvis-monstres.js` (fonctions communes renommées et exportées)
- Modify: `supabase/functions/_shared/discord-jarvis-outils.js` (sa copie locale de `rangCorrespondanceJarvis` disparaît)
- Create: `tests/discord-jarvis-mecaniques.test.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: `construireCatalogueMecaniques` et `ENTREE_MECANIQUES_TEST` (Task 2) ; `normaliserRecherche`, `propositions` de `discord-build.js`.
- Produces, sur `NOVA_DISCORD_JARVIS_MONSTRES` : `rangCorrespondanceJarvis(candidat, chercheNormalise) → 0..4`, `dateLisibleJarvis(catalogue) → "JJ/MM/AAAA"|null`, `sourceDateeJarvis(debut, nom, donnees) → string`, `elementDeSaisieMonstre(saisie) → [code, libelle]|null`.
- Produces, sur `NOVA_DISCORD_JARVIS_MECANIQUES` : `CHEMIN_MECANIQUES_JARVIS = "jarvis-prive/mecaniques.json"`, `validerCatalogueMecaniques(brut) → string|null`, `DECLARATIONS_OUTILS_MECANIQUES` (3), `ajouterOutilsMecaniquesJarvis(table, lireMecaniques)`.

- [ ] **Step 1: Écrire le test**

Créer `tests/discord-jarvis-mecaniques.test.js` :

```js
"use strict";

/* Les trois outils des mecaniques de /jarvis, sur un catalogue fabrique par
   la VRAIE extraction a partir du mini-export de
   tests/mecaniques-jarvis.test.js : les formes ne peuvent pas diverger
   entre l'extracteur et le bot. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-mecaniques.js"));
const { construireCatalogueMecaniques } = require(path.join(ROOT, "outils", "fabrication", "mecaniques-jarvis.js"));
const { ENTREE_MECANIQUES_TEST } = require("./mecaniques-jarvis.test.js");

const CATALOGUE = construireCatalogueMecaniques(ENTREE_MECANIQUES_TEST);

function outils(catalogue) {
  const table = {};
  M.ajouterOutilsMecaniquesJarvis(table, async () => catalogue);
  return {
    async executer(nom, args) {
      const donnees = await table[nom].executer(args);
      return { donnees, source:table[nom].source(args, donnees) };
    }
  };
}

async function main() {
  /* ---------------- Declarations et validation ---------------- */
  assert.deepEqual(M.DECLARATIONS_OUTILS_MECANIQUES.map(d => d.name), ["fiche_effet", "chercher_effets", "regle"]);
  M.DECLARATIONS_OUTILS_MECANIQUES.forEach(d => assert.equal(d.parameters.type, "OBJECT"));
  assert.equal(M.CHEMIN_MECANIQUES_JARVIS, "jarvis-prive/mecaniques.json");
  assert.equal(M.validerCatalogueMecaniques(CATALOGUE), null, "le vrai catalogue extrait passe");
  assert.match(M.validerCatalogueMecaniques({ version:2, effets:[], regles:[] }), /format de mecaniques\.json inconnu : 2/);
  assert.match(M.validerCatalogueMecaniques(null), /format de mecaniques\.json inconnu/);
  assert.match(M.validerCatalogueMecaniques({ version:1, regles:[],
    effets:[{ nom:"Bizarre", nature:"autre", description:"", variantes:[] }] }),
  /entrée mal formée dans mecaniques\.json : Bizarre/);
  assert.match(M.validerCatalogueMecaniques({ version:1, effets:[], regles:[{ sujet:"Vide", pages:[3] }] }),
    /sujet mal formé dans mecaniques\.json : Vide/);

  const o = outils(CATALOGUE);

  /* ---------------- fiche_effet ---------------- */
  const eclaboussures = await o.executer("fiche_effet", { nom:"eclaboussures" });
  assert.deepEqual(eclaboussures.donnees, {
    nom:"Éclaboussures", nature:"Malus", description:"Réduit la défense de X",
    donneesDu:"24/09/2026", totalVariantes:1,
    variantes:[{ cible:"l'ennemi", valeurs:["Augmentation de la défense : -20 %"], duree:"40 s",
      cumulMax:1, posePar:["Elizabeth (Grimoire) — Canon à eau"] }]
  });
  assert.equal(eclaboussures.source, "effet Éclaboussures · données du jeu du 24/09/2026");

  const attaque = await o.executer("fiche_effet", { nom:"augmentation" });
  assert.equal(attaque.donnees.nom, "Augmentation de l'attaque", "à égalité : le nom le plus court");
  assert.equal(attaque.donnees.correspondances, 2);
  assert.deepEqual(attaque.donnees.autresCorrespondances, ["Augmentation des dégâts de faiblesse"]);
  assert.deepEqual(attaque.donnees.variantes, [
    { cible:"toute l'équipe", valeurs:["Augmentation de l'attaque : +15 %"], duree:"30 s", cumulMax:1,
      posePar:["Ban (Nunchaku) — Ruée en spirale — nom absent de la description"] },
    { cible:"le porteur", valeurs:["Augmentation de l'attaque : +30 %"], cumulMax:5,
      posePar:["Ban (Nunchaku) — Chaîne"] }
  ]);

  const petrification = await o.executer("fiche_effet", { nom:"pétrification" });
  assert.equal(petrification.donnees.nature, "Contrôle");
  assert.deepEqual(petrification.donnees.variantes, [{ cible:"l'ennemi",
    valeurs:["Dégâts de faiblesse Terre : +15 %"], cumulMax:1 }], "sans porteur : pas de posePar");

  /* Gemini passe parfois une stat au lieu d'un nom d'effet. */
  const parStat = await o.executer("fiche_effet", { nom:"defense" });
  assert.equal(parStat.donnees.introuvable, "defense",
    "aucun NOM d'effet ne contient « défense » ici : introuvable, jamais une erreur muette");
  assert.ok(Array.isArray(parStat.donnees.proches));
  const parNomPartiel = await o.executer("fiche_effet", { nom:"attaque" });
  assert.equal(parNomPartiel.donnees.nom, "Augmentation de l'attaque", "un nom qui contient le mot suffit");
  const introuvable = await o.executer("fiche_effet", { nom:"zzzz" });
  assert.equal(introuvable.donnees.introuvable, "zzzz");
  assert.ok(Array.isArray(introuvable.donnees.proches));

  /* ---------------- chercher_effets ---------------- */
  const defense = await o.executer("chercher_effets", { texte:"défense", nature:"malus" });
  assert.deepEqual(defense.donnees, {
    texte:"défense", donneesDu:"24/09/2026", total:1,
    effets:[{ nom:"Éclaboussures", nature:"Malus", description:"Réduit la défense de X",
      cibles:["l'ennemi"], porteurs:["Elizabeth — Canon à eau"] }]
  });
  assert.equal(defense.source, "recherche d'effets défense · données du jeu du 24/09/2026");

  const lumiere = await o.executer("chercher_effets", { texte:"lumière" });
  assert.deepEqual(lumiere.donnees.effets.map(e => e.nom), ["Augmentation des dégâts de faiblesse"],
    "synonyme d'élément : lumière → Sacré");

  const deBan = await o.executer("chercher_effets", { texte:"attaque", heros:"BAN" });
  assert.deepEqual(deBan.donnees.effets.map(e => e.nom), ["Augmentation de l'attaque"]);
  assert.deepEqual(deBan.donnees.effets[0].porteurs, ["Ban — Ruée en spirale", "Ban — Chaîne"]);
  assert.equal((await o.executer("chercher_effets", { texte:"attaque", heros:"élizabeth" })).donnees.total, 0);

  const controle = await o.executer("chercher_effets", { texte:"immobilisation", nature:"contrôle" });
  assert.deepEqual(controle.donnees.effets.map(e => e.nom), ["Pétrification"]);

  assert.deepEqual((await o.executer("chercher_effets", { texte:"   " })).donnees,
    { erreur:"texte à chercher manquant" }, "un texte vide ne rend jamais tout");
  assert.deepEqual((await o.executer("chercher_effets", { texte:"x", nature:"poison" })).donnees,
    { erreur:"nature inconnue : buff, malus ou contrôle" });

  /* ---------------- regle ---------------- */
  const deluge = await o.executer("regle", { sujet:"deluge" });
  assert.deepEqual(deluge.donnees, {
    donneesDu:"24/09/2026",
    sujets:[{ sujet:"Déluge élémentaire - Feu",
      texte:"Remplissez la jauge avec (touche).\n\nDeuxième page.\n\nDixième page.\n\nPage du guide." }]
  });
  assert.equal(deluge.source, "règle Déluge élémentaire - Feu · données du jeu du 24/09/2026");
  assert.equal((await o.executer("regle", { sujet:"meliodas" })).donnees.sujets[0].sujet, "Meliodas (épée longue)");
  assert.deepEqual((await o.executer("regle", { sujet:"feu de camp" })).donnees,
    { introuvable:"feu de camp", proches:["Déluge élémentaire - Feu"] });
  assert.deepEqual((await o.executer("regle", { sujet:"pêche" })).donnees, { erreur:"aucune règle sur ce sujet" });

  const long = outils({ version:1, dateExport:"2026-09-24", effets:[], regles:[
    { sujet:"Relève", pages:["a".repeat(2000)] },
    { sujet:"Relève A", pages:["a"] }, { sujet:"Relève B", pages:["b"] }, { sujet:"Relève C", pages:["c"] }
  ] });
  const releve = (await long.executer("regle", { sujet:"releve" })).donnees;
  assert.equal(Array.from(releve.sujets[0].texte).length, 1500, "borné à 1 500 caractères");
  assert.ok(releve.sujets[0].texte.endsWith("…"));
  assert.equal(releve.sujets.length, 3);
  assert.deepEqual(releve.autresSujets, ["Relève C"]);

  /* ---------------- Fichier indisponible ---------------- */
  const absent = outils(null);
  for(const [nom, args] of [["fiche_effet", { nom:"x" }], ["chercher_effets", { texte:"x" }], ["regle", { sujet:"x" }]]){
    assert.deepEqual((await absent.executer(nom, args)).donnees, { erreur:"données des mécaniques indisponibles" });
  }

  console.log("OK discord-jarvis-mecaniques");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
```

- [ ] **Step 2: Le lancer, le voir échouer**

Run: `node tests/discord-jarvis-mecaniques.test.js`
Expected: FAIL, `Cannot find module '…discord-jarvis-mecaniques.js'`.

- [ ] **Step 3: Rendre communes les fonctions du lot 2a**

Dans `supabase/functions/_shared/discord-jarvis-monstres.js` :

1. Renommer `rangNomMonstre` en `rangCorrespondanceJarvis` (définition et appel dans `trouverMonstresJarvis`), et remplacer son absence de commentaire par `/* 4 : egal, 3 : commence par, 2 : contient, 1 : contient tous les mots. */` juste au-dessus.
2. Renommer `dateLisibleMonstre` en `dateLisibleJarvis` (définition et ses deux appels).
3. Renommer `sourceDateeMonstre` en `sourceDateeJarvis` (définition et ses deux appels).
4. Remplacer l'objet exporté par :

```js
const discordJarvisMonstresApi = {
  CHEMIN_MONSTRES_JARVIS,
  DECLARATIONS_OUTILS_MONSTRES,
  validerCatalogueMonstres,
  ajouterOutilsMonstresJarvis,
  rangCorrespondanceJarvis,
  dateLisibleJarvis,
  sourceDateeJarvis,
  elementDeSaisieMonstre
};
```

Dans `supabase/functions/_shared/discord-jarvis-outils.js` : supprimer la fonction locale `rangCorrespondanceJarvis` et son commentaire `/* 4 : egal, … */`, puis ajouter `rangCorrespondanceJarvis` à la déstructuration existante :

```js
const {
  DECLARATIONS_OUTILS_MONSTRES, ajouterOutilsMonstresJarvis, rangCorrespondanceJarvis
} = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;
```

Run: `grep -rn "rangNomMonstre\|dateLisibleMonstre\|sourceDateeMonstre" supabase tests || echo "aucune trace" ; node tests/discord-jarvis-monstres.test.js && node tests/discord-jarvis-outils.test.js`
Expected: `aucune trace`, `OK discord-jarvis-monstres`, le OK des outils.

- [ ] **Step 4: Écrire le module des mécaniques**

Créer `supabase/functions/_shared/discord-jarvis-mecaniques.js` :

```js
"use strict";

/* Les effets du jeu et ses regles pour /jarvis : trois outils en lecture
   seule sur mecaniques.json, fabrique sur le poste du proprietaire
   (outils/fabrication/extraire-mecaniques.js) et depose dans le bucket
   PRIVE jarvis-prive.

   Les chiffres de la description d'une competence priment : les tables
   ajoutent la cible, le cumul et la duree. « nom absent de la description »
   ne dit PAS qu'un effet est cache : la prose le decrit souvent avec
   d'autres mots. */

if(typeof module !== "undefined" && module.exports){
  if(!globalThis.NOVA_DISCORD_BUILD) require("./discord-build.js");
  if(!globalThis.NOVA_DISCORD_JARVIS_MONSTRES) require("./discord-jarvis-monstres.js");
}

const { normaliserRecherche, propositions } = globalThis.NOVA_DISCORD_BUILD;
const {
  rangCorrespondanceJarvis, dateLisibleJarvis, sourceDateeJarvis, elementDeSaisieMonstre
} = globalThis.NOVA_DISCORD_JARVIS_MONSTRES;

const CHEMIN_MECANIQUES_JARVIS = "jarvis-prive/mecaniques.json";
/* Plafonds des resultats : chaque ligne envoyee coute du quota gratuit. */
const EFFET_VARIANTES_MAX = 6;
const EFFET_PORTEURS_MAX = 10;
const EFFETS_RESULTATS_MAX = 12;
const EFFETS_PORTEURS_RESUME_MAX = 6;
const REGLES_SUJETS_MAX = 3;
const REGLES_AUTRES_MAX = 10;
const REGLES_PROCHES_MAX = 20;
const REGLE_TEXTE_MAX = 1_500;
const NATURES_MECANIQUES = ["buff", "malus", "controle"];
const LIBELLES_NATURE = { buff:"Buff", malus:"Malus", controle:"Contrôle" };
const LIBELLES_CIBLE = { equipe:"toute l'équipe", porteur:"le porteur", ennemi:"l'ennemi" };
const NATURES_SAISIE = {
  buff:"buff", bonus:"buff", malus:"malus", debuff:"malus", controle:"controle", cc:"controle"
};
const NOTE_NON_CITE = "nom absent de la description";
const INDISPONIBLE_MECANIQUES = { erreur:"données des mécaniques indisponibles" };

/* ---------------- Validation du fichier ---------------- */

function estObjetMecanique(valeur) {
  return Boolean(valeur) && typeof valeur === "object" && !Array.isArray(valeur);
}

function effetValide(effet) {
  return estObjetMecanique(effet)
    && typeof effet.nom === "string" && effet.nom.trim() !== ""
    && NATURES_MECANIQUES.includes(effet.nature)
    && typeof effet.description === "string"
    && Array.isArray(effet.variantes)
    && effet.variantes.every(variante => estObjetMecanique(variante)
      && Array.isArray(variante.valeurs) && Array.isArray(variante.posePar)
      && typeof variante.cible === "string");
}

function sujetValide(regle) {
  return estObjetMecanique(regle)
    && typeof regle.sujet === "string" && regle.sujet.trim() !== ""
    && Array.isArray(regle.pages) && regle.pages.every(page => typeof page === "string");
}

/* Rend null si le fichier est bon, sinon le motif du refus. */
function validerCatalogueMecaniques(brut) {
  if(!brut || brut.version !== 1 || !Array.isArray(brut.effets) || !Array.isArray(brut.regles)){
    return "format de mecaniques.json inconnu : " + (brut && brut.version);
  }
  const effet = brut.effets.find(entree => !effetValide(entree));
  if(effet !== undefined){
    return "entrée mal formée dans mecaniques.json : " + String((effet && effet.nom) || "?").slice(0, 40);
  }
  const regle = brut.regles.find(entree => !sujetValide(entree));
  if(regle !== undefined){
    return "sujet mal formé dans mecaniques.json : " + String((regle && regle.sujet) || "?").slice(0, 40);
  }
  return null;
}

/* ---------------- Mise en mots ---------------- */

function aUnPorteur(effet) {
  return effet.variantes.some(variante => variante.posePar.length > 0);
}

function varianteLisible(variante) {
  const lisible = {
    cible:LIBELLES_CIBLE[variante.cible] || variante.cible,
    valeurs:variante.valeurs.map(valeur => valeur.stat + " : " + valeur.valeur)
  };
  if(variante.duree !== undefined) lisible.duree = String(variante.duree).replace(".", ",") + " s";
  if(variante.cumulMax !== undefined) lisible.cumulMax = variante.cumulMax;
  if(variante.posePar.length){
    lisible.posePar = variante.posePar.slice(0, EFFET_PORTEURS_MAX).map(porteur =>
      porteur.heros + " (" + porteur.arme + ") — " + porteur.competence
      + (porteur.citeParDescription ? "" : " — " + NOTE_NON_CITE));
    if(variante.posePar.length > EFFET_PORTEURS_MAX){
      lisible.autresPorteurs = variante.posePar.length - EFFET_PORTEURS_MAX;
    }
  }
  return lisible;
}

function texteBorneRegle(texte) {
  const lettres = Array.from(texte);
  return lettres.length > REGLE_TEXTE_MAX
    ? lettres.slice(0, REGLE_TEXTE_MAX - 1).join("").trimEnd() + "…"
    : texte;
}

/* ---------------- Outils ---------------- */

async function outilFicheEffet(lireMecaniques, args) {
  const catalogue = await lireMecaniques();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MECANIQUES);
  const cherche = normaliserRecherche(args.nom);
  let meilleurRang = 0;
  let trouves = [];
  catalogue.effets.forEach(effet => {
    const rang = rangCorrespondanceJarvis(effet.nom, cherche);
    if(rang > meilleurRang){
      meilleurRang = rang;
      trouves = [effet];
    }else if(rang && rang === meilleurRang){
      trouves.push(effet);
    }
  });
  if(!trouves.length){
    return {
      introuvable:String(args.nom === undefined ? "" : args.nom),
      proches:propositions(catalogue.effets.map(effet => effet.nom), args.nom)
    };
  }
  /* A correspondance egale : un effet qu'un heros pose, puis le nom le plus
     court. */
  trouves.sort((a, b) => Number(aUnPorteur(b)) - Number(aUnPorteur(a))
    || a.nom.length - b.nom.length || a.nom.localeCompare(b.nom, "fr"));
  const effet = trouves[0];
  const resultat = {
    nom:effet.nom,
    nature:LIBELLES_NATURE[effet.nature],
    description:effet.description,
    donneesDu:dateLisibleJarvis(catalogue)
  };
  if(trouves.length > 1){
    resultat.correspondances = trouves.length;
    resultat.autresCorrespondances = trouves.slice(1, 6).map(autre => autre.nom);
  }
  resultat.totalVariantes = effet.variantes.length;
  resultat.variantes = effet.variantes.slice(0, EFFET_VARIANTES_MAX).map(varianteLisible);
  if(effet.variantes.length > EFFET_VARIANTES_MAX){
    resultat.suite = "seules les " + EFFET_VARIANTES_MAX + " premières variantes sont listées";
  }
  return resultat;
}

async function outilChercherEffets(lireMecaniques, args) {
  const catalogue = await lireMecaniques();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MECANIQUES);
  const cherche = normaliserRecherche(args.texte);
  if(!cherche) return { erreur:"texte à chercher manquant" };
  let nature = null;
  if(args.nature !== undefined && args.nature !== null && String(args.nature).trim()){
    nature = NATURES_SAISIE[normaliserRecherche(args.nature)] || null;
    if(!nature) return { erreur:"nature inconnue : buff, malus ou contrôle" };
  }
  const heros = normaliserRecherche(args.heros);
  const deCeHeros = porteur => !heros || normaliserRecherche(porteur.heros).startsWith(heros);
  /* « lumière » cherche aussi « Sacré » : le libelle des stats est en
     francais du jeu, pas dans les mots du membre. */
  const termes = [cherche];
  const element = elementDeSaisieMonstre(args.texte);
  if(element) termes.push(normaliserRecherche(element[1]));

  const trouves = [];
  catalogue.effets.forEach(effet => {
    if(nature && effet.nature !== nature) return;
    const variantes = heros
      ? effet.variantes.filter(variante => variante.posePar.some(deCeHeros))
      : effet.variantes;
    if(!variantes.length) return;
    const foin = [effet.nom, effet.description]
      .concat(effet.variantes.flatMap(variante => variante.valeurs.map(valeur => valeur.stat)))
      .map(normaliserRecherche).join(" | ");
    if(!termes.some(terme => terme.split(/\s+/).every(mot => foin.includes(mot)))) return;
    const porteurs = [];
    variantes.forEach(variante => variante.posePar.forEach(porteur => {
      if(!deCeHeros(porteur)) return;
      const ligne = porteur.heros + " — " + porteur.competence;
      if(!porteurs.includes(ligne)) porteurs.push(ligne);
    }));
    trouves.push({
      nom:effet.nom,
      nature:LIBELLES_NATURE[effet.nature],
      description:effet.description,
      cibles:[...new Set(variantes.map(variante => LIBELLES_CIBLE[variante.cible] || variante.cible))],
      porteurs:porteurs.slice(0, EFFETS_PORTEURS_RESUME_MAX)
    });
  });
  /* Un membre cherche d'abord qui POSE l'effet. */
  trouves.sort((a, b) => Number(b.porteurs.length > 0) - Number(a.porteurs.length > 0)
    || a.nom.localeCompare(b.nom, "fr"));
  return {
    texte:String(args.texte),
    donneesDu:dateLisibleJarvis(catalogue),
    total:trouves.length,
    effets:trouves.slice(0, EFFETS_RESULTATS_MAX)
  };
}

async function outilRegle(lireMecaniques, args) {
  const catalogue = await lireMecaniques();
  if(!catalogue) return Object.assign({}, INDISPONIBLE_MECANIQUES);
  const cherche = normaliserRecherche(args.sujet);
  if(!cherche) return { erreur:"sujet manquant" };
  const classes = catalogue.regles
    .map(regle => ({ regle, rang:rangCorrespondanceJarvis(regle.sujet, cherche) }))
    .filter(entree => entree.rang > 0)
    .sort((a, b) => b.rang - a.rang || a.regle.sujet.localeCompare(b.regle.sujet, "fr"));
  if(!classes.length){
    const mots = cherche.split(/\s+/).filter(mot => mot.length >= 3);
    const proches = catalogue.regles.map(regle => regle.sujet)
      .filter(sujet => mots.some(mot => normaliserRecherche(sujet).includes(mot)))
      .slice(0, REGLES_PROCHES_MAX);
    return proches.length
      ? { introuvable:String(args.sujet), proches }
      : { erreur:"aucune règle sur ce sujet" };
  }
  const resultat = {
    donneesDu:dateLisibleJarvis(catalogue),
    sujets:classes.slice(0, REGLES_SUJETS_MAX).map(({ regle }) => ({
      sujet:regle.sujet, texte:texteBorneRegle(regle.pages.join("\n\n"))
    }))
  };
  if(classes.length > REGLES_SUJETS_MAX){
    resultat.autresSujets = classes.slice(REGLES_SUJETS_MAX, REGLES_SUJETS_MAX + REGLES_AUTRES_MAX)
      .map(({ regle }) => regle.sujet);
  }
  return resultat;
}

const DECLARATIONS_OUTILS_MECANIQUES = [
  {
    name:"fiche_effet",
    description:"Fiche d'un effet du jeu (buff, malus ou contrôle : Pétrification, Éclaboussures,"
      + " Augmentation de l'attaque…) : description, valeurs, durée, cumul, cible, et les héros et"
      + " compétences qui le posent. Données lues dans les fichiers du jeu.",
    parameters:{
      type:"OBJECT",
      properties:{
        nom:{ type:"STRING", description:"Nom de l'effet, même approximatif." }
      },
      required:["nom"]
    }
  },
  {
    name:"chercher_effets",
    description:"Cherche les effets du jeu par mot (« défense », « critique », « Foudre »…) et dit"
      + " quels héros les posent : répond à « qui réduit la défense ? ».",
    parameters:{
      type:"OBJECT",
      properties:{
        texte:{ type:"STRING", description:"Mot ou stat à chercher." },
        nature:{ type:"STRING", enum:["buff", "malus", "controle"],
          description:"Facultatif : buff, malus ou controle." },
        heros:{ type:"STRING", description:"Facultatif : ne garder que les effets posés par ce héros." }
      },
      required:["texte"]
    }
  },
  {
    name:"regle",
    description:"Textes officiels du jeu sur une règle ou une mécanique (Déluge, Contre, Relève,"
      + " jauge de stupeur…) et fiches d'aide par héros et par arme : journal des tutoriels,"
      + " fenêtres d'aide, astuces de chargement.",
    parameters:{
      type:"OBJECT",
      properties:{
        sujet:{ type:"STRING", description:"Sujet cherché (ex. « Déluge », « Contre », « Meliodas »)." }
      },
      required:["sujet"]
    }
  }
];

function ajouterOutilsMecaniquesJarvis(table, lireMecaniques) {
  table.fiche_effet = {
    executer:args => outilFicheEffet(lireMecaniques, args),
    source:(args, donnees) => sourceDateeJarvis("effet ", donnees.nom || args.nom || "?", donnees)
  };
  table.chercher_effets = {
    executer:args => outilChercherEffets(lireMecaniques, args),
    source:(args, donnees) => sourceDateeJarvis("recherche d'effets ", String(args.texte || "?"), donnees)
  };
  table.regle = {
    executer:args => outilRegle(lireMecaniques, args),
    source:(args, donnees) => sourceDateeJarvis("règle ",
      (donnees.sujets && donnees.sujets[0] && donnees.sujets[0].sujet) || args.sujet || "?", donnees)
  };
}

const discordJarvisMecaniquesApi = {
  CHEMIN_MECANIQUES_JARVIS,
  DECLARATIONS_OUTILS_MECANIQUES,
  validerCatalogueMecaniques,
  ajouterOutilsMecaniquesJarvis
};

if(typeof module !== "undefined" && module.exports){
  module.exports = discordJarvisMecaniquesApi;
}
globalThis.NOVA_DISCORD_JARVIS_MECANIQUES = discordJarvisMecaniquesApi;
```

- [ ] **Step 5: Lancer le test**

Run: `node tests/discord-jarvis-mecaniques.test.js`
Expected: `OK discord-jarvis-mecaniques`.

- [ ] **Step 6: Enregistrer le test et commiter**

Dans `scripts/lancer-tests.js`, après `"node tests/discord-jarvis-stockage.test.js",`, ajouter `"node tests/discord-jarvis-mecaniques.test.js",`.

```bash
git add supabase/functions/_shared/discord-jarvis-mecaniques.js supabase/functions/_shared/discord-jarvis-monstres.js supabase/functions/_shared/discord-jarvis-outils.js tests/discord-jarvis-mecaniques.test.js scripts/lancer-tests.js
git commit -m "feat(jarvis): outils fiche_effet, chercher_effets et regle"
```

---

### Task 5: Branchement, consigne et documentation

**Files:**
- Modify: `supabase/functions/_shared/discord-jarvis-outils.js` (déclarations et table)
- Modify: `supabase/functions/_shared/discord-jarvis.js` (consigne)
- Modify: `supabase/functions/discord-planning/index.ts` (import, typage, lecteur, passage à `creerOutilsJarvis`)
- Modify: `tests/discord-jarvis-outils.test.js`, `tests/discord-jarvis.test.js`, `tests/discord-planning.test.js`
- Modify: `docs/discord-planning.md`, `AGENTS.md`, `outils/fabrication/LISEZMOI.md`

**Interfaces:**
- Consumes: `DECLARATIONS_OUTILS_MECANIQUES`, `ajouterOutilsMecaniquesJarvis`, `CHEMIN_MECANIQUES_JARVIS`, `validerCatalogueMecaniques` (Task 4) ; `creerLecteurStockageJarvis` (Task 1).
- Produces: `creerOutilsJarvis({ …, lireMecaniques? })`.

- [ ] **Step 1: Écrire les tests du branchement**

Dans `tests/discord-jarvis-outils.test.js`, remplacer la liste des déclarations attendues et ajouter l'indisponibilité :

```js
  assert.deepEqual(DECLARATIONS_OUTILS_JARVIS.map(d => d.name), [
    "lister_personnages", "fiche_personnage", "chercher_equipement",
    "qui_possede", "roster_de", "dispos", "scores_boss",
    "fiche_monstre", "chercher_monstres",
    "fiche_effet", "chercher_effets", "regle"
  ]);
```

et, juste après l'assertion `fiche_monstre` « données des monstres indisponibles » :

```js
  assert.deepEqual((await outils().executer("regle", { sujet:"déluge" })).donnees,
    { erreur:"données des mécaniques indisponibles" });
```

Dans `tests/discord-jarvis.test.js`, après `assert.match(Q.CONSIGNE_JARVIS, /autresCorrespondances/);`, ajouter :

```js
  assert.match(Q.CONSIGNE_JARVIS, /la description de la compétence prime/);
  assert.match(Q.CONSIGNE_JARVIS, /nom absent de la description/);
  assert.match(Q.CONSIGNE_JARVIS, /effets et règles du jeu/);
```

Dans `tests/discord-planning.test.js`, après la déclaration de `edgeSource`, ajouter :

```js
/* Lot 2b : les mecaniques passent par le lecteur commun et arrivent aux
   outils de /jarvis. */
assert.match(edgeSource, /await import\("\.\.\/_shared\/discord-jarvis-mecaniques\.js"\)/);
assert.match(edgeSource, /nom:"mecaniques",\s*valider:validerCatalogueMecaniques/);
assert.match(edgeSource, /lireMecaniques:\(\) => lireMecaniquesJarvis\(config\)/);
```

- [ ] **Step 2: Les lancer, les voir échouer**

Run: `node tests/discord-jarvis-outils.test.js ; node tests/discord-jarvis.test.js ; node tests/discord-planning.test.js`
Expected: trois échecs — la liste des déclarations (il manque les trois outils), la consigne (`la description de la compétence prime`), l'import absent de `index.ts`.

- [ ] **Step 3: Brancher les outils**

Dans `supabase/functions/_shared/discord-jarvis-outils.js` :

1. Dans le bloc Node en tête, après la ligne qui charge `discord-jarvis-monstres.js`, ajouter :

```js
  if(!globalThis.NOVA_DISCORD_JARVIS_MECANIQUES) require("./discord-jarvis-mecaniques.js");
```

2. Après la déstructuration de `NOVA_DISCORD_JARVIS_MONSTRES`, ajouter :

```js
const {
  DECLARATIONS_OUTILS_MECANIQUES, ajouterOutilsMecaniquesJarvis
} = globalThis.NOVA_DISCORD_JARVIS_MECANIQUES;
```

3. Remplacer `].concat(DECLARATIONS_OUTILS_MONSTRES);` par `].concat(DECLARATIONS_OUTILS_MONSTRES, DECLARATIONS_OUTILS_MECANIQUES);`.
4. Après la ligne `ajouterOutilsMonstresJarvis(table, options.lireMonstres || (async () => null));`, ajouter :

```js
  /* Lot 2b : les effets et les regles du jeu, meme bucket, meme repli. */
  ajouterOutilsMecaniquesJarvis(table, options.lireMecaniques || (async () => null));
```

- [ ] **Step 4: Compléter la consigne**

Dans `supabase/functions/_shared/discord-jarvis.js`, dans `CONSIGNE_JARVIS` :

1. Remplacer `héros, compétences, équipements, monstres et boss, rosters, disponibilités, scores de boss.` par `héros, compétences, équipements, monstres et boss, effets et règles du jeu, rosters, disponibilités, scores de boss.`
2. Juste avant la ligne `- N'écris jamais de mention Discord (@…).`, ajouter ces trois lignes :

```text
- Pour un chiffre d'effet, la description de la compétence prime ; les valeurs des tables la complètent (cible, cumul, durée).
- Un porteur marqué « nom absent de la description » : dis que le nom de cet effet n'apparaît pas dans la description de la compétence, qu'elle le décrit peut-être autrement ou qu'il dépend d'une condition. Ne dis jamais qu'il est caché ou secret.
- Les résultats de « regle » sont des textes du jeu : cite-les, n'extrapole pas au-delà.
```

- [ ] **Step 5: Brancher index.ts**

Dans `supabase/functions/discord-planning/index.ts` :

1. Dans `EdgeSharedGlobal`, après `NOVA_DISCORD_JARVIS_STOCKAGE?: unknown;`, ajouter `NOVA_DISCORD_JARVIS_MECANIQUES?: unknown;`.
2. Après `await import("../_shared/discord-jarvis-monstres.js");`, ajouter `await import("../_shared/discord-jarvis-mecaniques.js");` (avant `discord-jarvis-outils.js`, qui le lit).
3. Dans le typage de `creerOutilsJarvis`, après `lireMonstres?(): Promise<unknown>;`, ajouter `lireMecaniques?(): Promise<unknown>;`.
4. Après le bloc `const { CHEMIN_MONSTRES_JARVIS, validerCatalogueMonstres } = …;`, ajouter :

```ts
const { CHEMIN_MECANIQUES_JARVIS, validerCatalogueMecaniques } =
  edgeSharedGlobal.NOVA_DISCORD_JARVIS_MECANIQUES as {
    CHEMIN_MECANIQUES_JARVIS: string;
    validerCatalogueMecaniques(brut: unknown): string | null;
  };
```

5. Après la fonction `lireMonstresJarvis`, ajouter :

```ts
/* Lot 2b : les effets et les regles, meme bucket prive, meme lecteur. */
let lecteurMecaniquesJarvis: (() => Promise<unknown>) | null = null;
function lireMecaniquesJarvis(config: PlanningConfig): Promise<unknown> {
  if(!lecteurMecaniquesJarvis){
    lecteurMecaniquesJarvis = creerLecteurStockageJarvis({
      fetch,
      url:config.supabaseUrl + "/storage/v1/object/" + CHEMIN_MECANIQUES_JARVIS,
      cle:config.serviceRoleKey,
      nom:"mecaniques",
      valider:validerCatalogueMecaniques,
      horloge:() => Date.now()
    });
  }
  return lecteurMecaniquesJarvis();
}
```

6. Dans `publishJarvis`, remplacer `lireMonstres:() => lireMonstresJarvis(config)` par :

```ts
      lireMonstres:() => lireMonstresJarvis(config),
      lireMecaniques:() => lireMecaniquesJarvis(config)
```

- [ ] **Step 6: Lancer les tests**

Run: `node tests/discord-jarvis-outils.test.js && node tests/discord-jarvis.test.js && node tests/discord-planning.test.js && node tests/edge-modules.test.js`
Expected: les quatre OK ; `edge-modules` compte un module partagé de plus qu'avant la Task 1 (+2 au total sur la branche).

Puis le typage Deno, comme en Task 1 Step 8.
Expected: seulement les 3 erreurs TS2322 préexistantes sur `Blob`.

- [ ] **Step 7: Documenter**

1. `docs/discord-planning.md` : après la section « Monstres et boss (lot 2a) » (qui finit par « …concordent avec les mesures en jeu. »), ajouter :

```markdown
### Effets, porteurs et règles (lot 2b)

Trois outils de plus : `fiche_effet` (un effet du jeu, ses valeurs, sa
durée, son cumul, sa cible et les compétences de héros qui le posent),
`chercher_effets` (« qui réduit la défense ? ») et `regle` (les textes
officiels du journal des tutoriels, des fenêtres d'aide et des astuces).

Même chaîne que les monstres, même bucket privé :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content')).Path
node outils/fabrication/extraire-mecaniques.js
```

Puis déposer `output/jarvis/mecaniques.json` dans Storage → `jarvis-prive`,
et redéployer `discord-planning` la première fois. Ensuite, un nouveau
dépôt est pris en compte au plus tard une heure après.

Les porteurs viennent des compétences publiques du wiki
(`data/wiki-competences.js`) : relancer l'extraction après une
régénération du wiki. Un porteur marqué « nom absent de la description »
n'est pas un effet caché : la description de la compétence le décrit
souvent avec d'autres mots.
```

2. `outils/fabrication/LISEZMOI.md` : renommer la section « Les monstres de /jarvis » en « Les fichiers de /jarvis », et remplacer son paragraphe par :

```markdown
`extraire-monstres.js` et `extraire-mecaniques.js` fabriquent
`output/jarvis/monstres.json` et `output/jarvis/mecaniques.json` pour la
commande Discord `/jarvis`. Ces fichiers sont ignorés par git et vont dans le
bucket Supabase **privé** `jarvis-prive` : ils n'entrent jamais dans ce dépôt
public. La logique vit dans `monstres-jarvis.js` et `mecaniques-jarvis.js`,
testée en CI sans l'export. Procédure : `docs/discord-planning.md`.
```

3. `AGENTS.md`, puce « Commande Discord `/jarvis` » :
   - remplacer « Gemini n'a accès qu'à sept outils **en lecture seule** » par « Gemini n'a accès qu'à des outils **en lecture seule** » ;
   - après la phrase qui finit par « Lots suivants prévus : 2b (buffs), 2c (boutiques et butins), 2d (contenu non sorti), sur la même chaîne. », remplacer cette phrase par :

```markdown
  **Lot 2b (effets, porteurs et règles)** :
  `outils/fabrication/extraire-mecaniques.js` écrit
  `output/jarvis/mecaniques.json`, déposé dans le même bucket privé. Les
  outils `fiche_effet`, `chercher_effets` et `regle` vivent dans
  `_shared/discord-jarvis-mecaniques.js` ; les deux fichiers passent par
  un seul lecteur, `_shared/discord-jarvis-stockage.js`. Une compétence se
  relie à ses effets par le **nom** de ses comportements (identifiant du
  wiki, ou identifiant suivi de `_`). Les règles viennent de
  `TutorialLogGroupTable`/`TutorialLogTable` et `GuidePopupGroupTable`/
  `GuidePopupTable`, jamais des noms de clés. Lots suivants prévus : effets
  posés par les boss (recherche), 2c (boutiques et butins), 2d (contenu
  non sorti).
```

   - dans « Ce que ce dépôt public ne porte pas », remplacer « Les cinquante et un outils de `outils/fabrication/` » par « Les outils de `outils/fabrication/` ».

- [ ] **Step 8: Suite complète**

Run: `npm test > "$SCRATCH/suite-2b.txt" 2>&1; grep -E "au vert|EN ECHEC" -A6 "$SCRATCH/suite-2b.txt"` (où `$SCRATCH` est le dossier scratchpad de la session)
Expected: `unit … au vert` et `e2e … au vert`. Un échec de `supabase-etape1`, `accessibilite-mobile` ou `visiteur-anonyme` se relance une fois avant d'être traité comme une régression (instabilités connues).

- [ ] **Step 9: Commit**

```bash
git add supabase/functions/_shared/discord-jarvis-outils.js supabase/functions/_shared/discord-jarvis.js supabase/functions/discord-planning/index.ts tests/discord-jarvis-outils.test.js tests/discord-jarvis.test.js tests/discord-planning.test.js docs/discord-planning.md AGENTS.md outils/fabrication/LISEZMOI.md
git commit -m "feat(jarvis): brancher les effets et les regles dans /jarvis"
```

Mise en service (par le propriétaire, après accord de poussée) : déposer `output/jarvis/mecaniques.json` dans `jarvis-prive`, puis `npx -y supabase@latest functions deploy discord-planning --project-ref uxouhbgdlolidjmxwgae`.
