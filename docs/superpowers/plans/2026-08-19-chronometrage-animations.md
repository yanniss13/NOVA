# Chronométrage des animations — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les
> étapes utilisent des cases à cocher (`- [ ]`).

**But :** rendre mesurable les 161 temps d'animation dont dépend tout calcul
de DPS, et permettre à trois ou quatre membres d'y contribuer sans que leurs
mesures veuillent dire des choses différentes.

**Architecture :** un correctif au générateur existant, puis une page
autonome de chronométrage image par image servie par GitHub Pages, puis une
table Supabase en boîte de réception et un script de rapatriement vers
`data/animations-mesurees.json`, qui reste la source de vérité versionnée.

**Pile :** Python 3 (générateurs et scripts), JavaScript sans dépendance
(site), Supabase (auth + Postgres + RLS), Playwright (parcours navigateur).

**Spec :** `docs/superpowers/specs/2026-08-19-chronometrage-animations-design.md`

## Contraintes globales

- Tout le code, les commentaires, les messages de commit et l'interface sont
  en français. Les tests aussi.
- `docs/chronometrage-animations.md` et `data/competences.js` sont
  **générés** : ne jamais les éditer à la main.
- `data/animations-mesurees.json` est **écrit à la main** et jamais
  régénéré. Il reste indexé par `gameId`.
- Le client Supabase du site est `sb`, importé de
  `js/noyau/supabase-client.js`. Il vaut `null` sans configuration : toujours
  le tester avant usage.
- Chaque nouveau fichier de test est ajouté à `SUITES.unit` ou `SUITES.e2e`
  dans `scripts/lancer-tests.js`.
- La clé publique est `window.SB_KEY`. Ne jamais introduire de clé
  `service_role` dans le dépôt.

**Découpage d'un `gameId`.** Le slot est le suffixe qui commence au premier
`jumpatk`, `normalatk` ou `skill_` rencontré, et va jusqu'à la fin. Cette
règle ne dépend ni du slug du héros ni du nom de l'arme, donc elle traite
`gil_thunder_lance_skill_tag` comme `bug_axe_jumpatk`. Un couple
héros × slot désigne une animation ; les modificateurs `_ready`, `_enchant`,
`_1`, `_a` font partie du slot, car un clic droit chargé n'est pas le même
geste qu'un clic droit simple.

---

### Tâche 1 : corriger la permutation E/Q

**Fichiers :**
- Modifier : `scripts/lister-chronometrage.py:51-57`
- Modifier : `tests/test_lister_chronometrage.py:69-75`

**Interfaces :**
- Consomme : rien.
- Produit : `TOUCHES_CATEGORIES`, table corrigée dont dépend l'affichage du
  document.

- [ ] **Étape 1 : corriger d'abord le test**

Dans `tests/test_lister_chronometrage.py`, remplacer la liste des couples
attendus :

```python
        for categorie, touche in [
            ("Attaque normale", "clic gauche"),
            ("Compétence normale", "E"),
            ("Attaque spéciale", "Q"),
            ("Attaque ultime", "R"),
            ("Compétence de relève", "1 à 4"),
        ]:
            self.assertIn("| %s | %s |" % (categorie, touche), document)
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Lancer : `python -m unittest tests/test_lister_chronometrage.py`
Attendu : ÉCHEC, `| Compétence normale | E |` absent du document.

- [ ] **Étape 3 : corriger la table**

Dans `scripts/lister-chronometrage.py`, `TOUCHES_CATEGORIES` devient :

```python
# Verifie en jeu. Les noms internes des gameId ont derive : `skill_rmb_ready`
# se declenche sur Q et `skill_q` sur R. La categorie reste donc la source de
# la touche, et c'est bien elle qui portait l'erreur.
TOUCHES_CATEGORIES = {
    "NORMAL": "clic gauche",
    "NORMAL_SKILL": "E",
    "ACTIVE_THIRD": "Q",
    "ULTIMATE": "R",
    "TAG_SKILL": "1 à 4",
}
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

Lancer : `python -m unittest tests/test_lister_chronometrage.py`
Attendu : OK.

- [ ] **Étape 5 : régénérer le document**

Lancer : `python scripts/lister-chronometrage.py`
Vérifier : `grep -c "| Compétence normale | E |" docs/chronometrage-animations.md`
Attendu : un nombre supérieur à zéro.

- [ ] **Étape 6 : commit**

```bash
git add scripts/lister-chronometrage.py tests/test_lister_chronometrage.py docs/chronometrage-animations.md
git commit -m "fix(dps): retablir les touches E et Q du guide de chronometrage"
```

---

### Tâche 2 : interdire tout retour à l'anglais

**Fichiers :**
- Modifier : `tests/test_lister_chronometrage.py`

**Interfaces :**
- Consomme : `MODULE.catalogue()`, `MODULE.noms_francais()`.
- Produit : une garantie, rien de consommable.

Le test existant travaille sur des données factices : il prouve que la
traduction *fonctionne*, pas qu'elle *couvre*. Une compétence ajoutée demain
sans `nomFr` retomberait sur son nom anglais sans rien faire échouer.

- [ ] **Étape 1 : écrire le test**

Ajouter à `tests/test_lister_chronometrage.py`, dans la classe existante :

```python
    def test_toute_competence_reelle_a_un_nom_francais(self):
        """Le document est genere depuis les vraies donnees : aucune
        competence ne doit retomber sur son nom anglais de competences.js."""
        noms = MODULE.noms_francais()
        sans_traduction = [
            (heros, skill["gameId"])
            for heros, liste in MODULE.catalogue().items()
            for skill in liste
            if skill.get("gameId") and skill["gameId"] not in noms
        ]
        self.assertEqual(
            sans_traduction,
            [],
            "ces competences sortiraient en anglais dans le document",
        )
```

- [ ] **Étape 2 : vérifier qu'il passe, puis qu'il mord**

Lancer : `python -m unittest tests/test_lister_chronometrage.py`
Attendu : OK. Les 376 compétences ont un `nomFr` aujourd'hui — c'est un
garde-fou, pas un correctif.

Vérifier qu'il détecte bien une régression : retirer temporairement la
première entrée de `data/wiki-competences.js`, relancer, constater l'échec,
puis `git checkout data/wiki-competences.js`.

- [ ] **Étape 3 : commit**

```bash
git add tests/test_lister_chronometrage.py
git commit -m "test(dps): garantir que le guide reste entierement en francais"
```

---

### Tâche 3 : l'arithmétique du chronométrage

**Fichiers :**
- Créer : `outils/chrono-calcul.js`
- Créer : `tests/chrono-calcul.test.js`
- Modifier : `scripts/lancer-tests.js` (`SUITES.unit`)

**Interfaces :**
- Consomme : rien.
- Produit :
  - `slotDeGameId(gameId) -> string`
  - `dureeRafale({secondeDebut, secondeFin, repetitions}) -> number`
  - `dureeUnique({secondeDebut, secondeFin}) -> number`

Fonctions pures, sans DOM. C'est la seule partie où une erreur passerait
inaperçue dans l'interface, donc la seule qui mérite un test unitaire séparé
du parcours navigateur.

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `tests/chrono-calcul.test.js` :

```javascript
"use strict";

/* L'arithmetique du chronometrage, isolee du navigateur. Le mode rafale
   divise par le nombre de repetitions : c'est ce qui ramene l'erreur de
   marquage d'une image a un dixieme d'image. */

const assert = require("node:assert/strict");
const path = require("node:path");

const outils = require(path.resolve(__dirname, "..", "outils", "chrono-calcul.js"));

assert.equal(outils.slotDeGameId("bug_axe_jumpatk"), "jumpatk");
assert.equal(outils.slotDeGameId("gil_thunder_lance_skill_tag"), "skill_tag");
assert.equal(outils.slotDeGameId("meliodas_axe_skill_rmb_ready"), "skill_rmb_ready");
assert.equal(outils.slotDeGameId("daisy_book_normalatk_1_enchant"), "normalatk_1_enchant");

// Dix lancements entre 1.000 s et 13.000 s : 1.2 s chacun.
assert.equal(
  outils.dureeRafale({ secondeDebut: 1, secondeFin: 13, repetitions: 10 }),
  1.2
);

// Arrondi au millieme : au-dela on afficherait du bruit.
assert.equal(
  outils.dureeRafale({ secondeDebut: 0, secondeFin: 1, repetitions: 3 }),
  0.333
);

assert.equal(outils.dureeUnique({ secondeDebut: 2.5, secondeFin: 4 }), 1.5);

// Une saisie incoherente ne doit pas produire un nombre credible.
assert.throws(
  () => outils.dureeRafale({ secondeDebut: 5, secondeFin: 2, repetitions: 10 }),
  /apres le debut/i
);
assert.throws(
  () => outils.dureeRafale({ secondeDebut: 0, secondeFin: 5, repetitions: 0 }),
  /repetition/i
);

console.log("chrono-calcul.test.js : OK");
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Lancer : `node tests/chrono-calcul.test.js`
Attendu : ÉCHEC, `Cannot find module '.../outils/chrono-calcul.js'`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `outils/chrono-calcul.js` :

```javascript
"use strict";

/* Le calcul du chronometrage, sans DOM ni navigateur.

   Le mode rafale existe pour une raison precise : une competence sans
   recharge se rejoue quand son animation finit, donc l'intervalle entre deux
   lancements EST la duree cherchee. On evite ainsi d'avoir a definir ce que
   veut dire « la fin de l'animation », question sur laquelle deux mesureurs
   ne repondraient jamais pareil. */

  const DEBUTS_DE_SLOT = ["jumpatk", "normalatk", "skill_"];

  function slotDeGameId(gameId){
    const texte = String(gameId || "");
    const positions = DEBUTS_DE_SLOT
      .map(debut => texte.indexOf(debut))
      .filter(position => position >= 0);
    return positions.length ? texte.slice(Math.min(...positions)) : texte;
  }

  function arrondirAuMillieme(valeur){
    return Math.round(valeur * 1000) / 1000;
  }

  function verifierBornes(secondeDebut, secondeFin){
    if(!(secondeFin > secondeDebut)){
      throw new Error("La fin doit venir apres le debut.");
    }
  }

  function dureeRafale({ secondeDebut, secondeFin, repetitions }){
    verifierBornes(secondeDebut, secondeFin);
    if(!(repetitions >= 1)){
      throw new Error("Il faut au moins une repetition.");
    }
    return arrondirAuMillieme((secondeFin - secondeDebut) / repetitions);
  }

  function dureeUnique({ secondeDebut, secondeFin }){
    verifierBornes(secondeDebut, secondeFin);
    return arrondirAuMillieme(secondeFin - secondeDebut);
  }

  const API = { slotDeGameId, dureeRafale, dureeUnique };

  if(typeof module !== "undefined" && module.exports) module.exports = API;
  if(typeof window !== "undefined") window.ChronoCalcul = API;
```

- [ ] **Étape 4 : lancer et vérifier le succès**

Lancer : `node tests/chrono-calcul.test.js`
Attendu : `chrono-calcul.test.js : OK`.

- [ ] **Étape 5 : enregistrer dans le lanceur**

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit`, après
`"node tests/degats-calcul.test.js",` :

```javascript
    "node tests/chrono-calcul.test.js",
```

- [ ] **Étape 6 : commit**

```bash
git add outils/chrono-calcul.js tests/chrono-calcul.test.js scripts/lancer-tests.js
git commit -m "feat(dps): calculer une duree d'animation en mode rafale ou unique"
```

---

### Tâche 4 : la page de chronométrage

**Fichiers :**
- Créer : `outils/chrono-animation.html`
- Créer : `outils/chrono-animation.js`
- Créer : `robots.txt`

**Interfaces :**
- Consomme : `window.ChronoCalcul` (tâche 3), `window.SEVEN_DS_COMPETENCES`
  de `data/competences.js`.
- Produit : `window.ChronoPage.mesureCourante()`, qui rend
  `{heros, slot, secondes, mode, repetitions, gameIds}` ou `null`. Le
  parcours de la tâche 5 et l'envoi de la tâche 7 s'appuient dessus.

La vidéo est lue par `URL.createObjectURL` depuis un `<input type="file">` :
elle ne quitte jamais la machine, il n'y a donc ni téléversement, ni
stockage, ni question de taille.

- [ ] **Étape 1 : créer la page**

Créer `outils/chrono-animation.html` :

```html
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Chronométrage des animations — Confrérie</title>
</head>
<body>
<main>
  <h1>Chronométrage des animations</h1>
  <p>Ta vidéo reste sur ton ordinateur, elle n'est envoyée nulle part.</p>
  <p id="avancement">Avancement : chargement…</p>

  <input type="file" id="fichierVideo" accept="video/*">
  <video id="video" controls playsinline width="640"></video>

  <p>Image <output id="imageCourante">0</output> —
     <output id="secondeCourante">0.000</output> s</p>
  <p>Flèches gauche et droite pour une image, Maj pour dix.</p>

  <fieldset>
    <legend>Héros et compétence</legend>
    <label for="heros">Héros</label>
    <select id="heros"></select>
    <label for="slot">Emplacement</label>
    <select id="slot"></select>
    <p id="gameIdsVises"></p>
  </fieldset>

  <fieldset>
    <legend>Mode</legend>
    <label><input type="radio" name="mode" value="rafale" checked> Rafale</label>
    <label><input type="radio" name="mode" value="unique"> Unique</label>
    <label for="repetitions">Répétitions</label>
    <input type="number" id="repetitions" min="1" value="10">
  </fieldset>

  <button type="button" id="marquerDebut">Marquer le début</button>
  <button type="button" id="marquerFin">Marquer la fin</button>
  <p>Début <output id="sortieDebut">—</output> ·
     Fin <output id="sortieFin">—</output></p>
  <p>Durée : <output id="sortieDuree">—</output> s</p>
</main>

<script src="../data/competences.js"></script>
<script src="chrono-calcul.js"></script>
<script src="chrono-animation.js"></script>
</body>
</html>
```

Créer `robots.txt` à la racine du dépôt :

```
User-agent: *
Disallow: /outils/
```

- [ ] **Étape 2 : écrire le module de la page**

Créer `outils/chrono-animation.js` :

```javascript
"use strict";

/* La page de chronometrage.

   La cadence est saisie une fois et sert uniquement a afficher un numero
   d'image lisible et a calculer le pas des fleches. Le calcul de duree, lui,
   n'utilise que currentTime : il reste juste meme si la cadence declaree est
   fausse. */

(function(){
  const CADENCE = 60;

  const video = document.getElementById("video");
  const etat = {
    secondeDebut:null, secondeFin:null, cadence:CADENCE, mesurees:new Set()
  };

  function tousLesHeros(){
    return Object.keys(window.SEVEN_DS_COMPETENCES || {}).sort();
  }

  function competencesDe(nomHeros){
    return (window.SEVEN_DS_COMPETENCES || {})[nomHeros] || [];
  }

  function slotsDe(nomHeros){
    return [...new Set(
      competencesDe(nomHeros)
        .filter(competence => competence.gameId)
        .map(competence => window.ChronoCalcul.slotDeGameId(competence.gameId))
    )].sort();
  }

  function gameIdsDe(nomHeros, slot){
    return competencesDe(nomHeros)
      .filter(competence => competence.gameId
        && window.ChronoCalcul.slotDeGameId(competence.gameId) === slot)
      .map(competence => competence.gameId);
  }

  function modeChoisi(){
    const coche = document.querySelector("input[name=mode]:checked");
    return coche ? coche.value : "rafale";
  }

  function mesureCourante(){
    if(etat.secondeDebut === null || etat.secondeFin === null) return null;
    const nomHeros = document.getElementById("heros").value;
    const slot = document.getElementById("slot").value;
    const repetitions = Number(document.getElementById("repetitions").value);
    const mode = modeChoisi();
    const bornes = { secondeDebut:etat.secondeDebut, secondeFin:etat.secondeFin };
    const secondes = mode === "rafale"
      ? window.ChronoCalcul.dureeRafale({ ...bornes, repetitions })
      : window.ChronoCalcul.dureeUnique(bornes);
    return {
      heros:nomHeros,
      slot:slot,
      secondes:secondes,
      mode:mode,
      repetitions:mode === "rafale" ? repetitions : null,
      gameIds:gameIdsDe(nomHeros, slot)
    };
  }

  function afficher(){
    document.getElementById("secondeCourante").textContent =
      video.currentTime.toFixed(3);
    document.getElementById("imageCourante").textContent =
      String(Math.round(video.currentTime * etat.cadence));
    document.getElementById("sortieDebut").textContent =
      etat.secondeDebut === null ? "—" : etat.secondeDebut.toFixed(3);
    document.getElementById("sortieFin").textContent =
      etat.secondeFin === null ? "—" : etat.secondeFin.toFixed(3);
    let duree = "—";
    try{
      const mesure = mesureCourante();
      if(mesure) duree = String(mesure.secondes);
    }catch(erreur){
      duree = erreur.message;
    }
    document.getElementById("sortieDuree").textContent = duree;
  }

  function remplirSlots(){
    const select = document.getElementById("slot");
    const nomHeros = document.getElementById("heros").value;
    select.innerHTML = "";
    slotsDe(nomHeros).forEach(slot => {
      const option = document.createElement("option");
      option.value = slot;
      option.textContent = slotDejaMesure(nomHeros, slot) ? slot + " ✓" : slot;
      select.append(option);
    });
    majGameIdsVises();
  }

  function majGameIdsVises(){
    const nomHeros = document.getElementById("heros").value;
    const slot = document.getElementById("slot").value;
    document.getElementById("gameIdsVises").textContent =
      "Cette mesure renseignera : " + gameIdsDe(nomHeros, slot).join(", ");
    afficher();
  }

  /* L'avancement partage. Sans lui, deux membres mesurent le meme heros le
     meme soir sans le savoir : c'est le seul vrai risque d'une collecte a
     plusieurs, la saisie elle-meme ne pose pas de probleme. */
  function slotDejaMesure(nomHeros, slot){
    const cibles = gameIdsDe(nomHeros, slot);
    return cibles.length > 0 && cibles.every(id => etat.mesurees.has(id));
  }

  async function chargerAvancement(){
    try{
      const reponse = await fetch("../data/animations-mesurees.json");
      const contenu = await reponse.json();
      etat.mesurees = new Set(Object.keys(contenu.animations || {}));
    }catch(erreur){
      etat.mesurees = new Set();
    }
    let faits = 0;
    let total = 0;
    tousLesHeros().forEach(nom => slotsDe(nom).forEach(slot => {
      total += 1;
      if(slotDejaMesure(nom, slot)) faits += 1;
    }));
    document.getElementById("avancement").textContent =
      "Avancement : " + faits + " / " + total + " animations mesurées.";
    remplirSlots();
  }

  function deplacer(images){
    video.pause();
    video.currentTime = Math.max(0, video.currentTime + images / etat.cadence);
  }

  document.getElementById("fichierVideo").addEventListener("change", evenement => {
    const fichier = evenement.target.files && evenement.target.files[0];
    if(fichier) video.src = URL.createObjectURL(fichier);
  });

  video.addEventListener("seeked", afficher);
  video.addEventListener("timeupdate", afficher);

  document.addEventListener("keydown", evenement => {
    if(evenement.key !== "ArrowLeft" && evenement.key !== "ArrowRight") return;
    evenement.preventDefault();
    const pas = evenement.shiftKey ? 10 : 1;
    deplacer(evenement.key === "ArrowRight" ? pas : -pas);
  });

  document.getElementById("marquerDebut").addEventListener("click", () => {
    etat.secondeDebut = video.currentTime;
    afficher();
  });
  document.getElementById("marquerFin").addEventListener("click", () => {
    etat.secondeFin = video.currentTime;
    afficher();
  });
  document.getElementById("heros").addEventListener("change", remplirSlots);
  document.getElementById("slot").addEventListener("change", majGameIdsVises);
  document.getElementById("repetitions").addEventListener("input", afficher);
  Array.from(document.querySelectorAll("input[name=mode]")).forEach(bouton => {
    bouton.addEventListener("change", afficher);
  });

  const selectHeros = document.getElementById("heros");
  tousLesHeros().forEach(nom => {
    const option = document.createElement("option");
    option.value = nom;
    option.textContent = nom;
    selectHeros.append(option);
  });
  remplirSlots();
  chargerAvancement();

  window.ChronoPage = { mesureCourante, etat, chargerAvancement };
})();
```

- [ ] **Étape 3 : vérifier à la main**

Lancer : `python -m http.server 8000`
Ouvrir : `http://localhost:8000/outils/chrono-animation.html`
Vérifier : la liste des héros est peuplée ; choisir `meliodas` puis
`jumpatk` affiche « Cette mesure renseignera : » suivi de plusieurs
`gameId` commençant tous par `meliodas_`.

Vérifier aussi la ligne d'avancement : elle doit indiquer « 0 / 161 »
tant qu'aucune mesure n'est saisie. Ce dénominateur est la meilleure
vérification que le découpage en couples héros × slot est correct — s'il
affiche 376, c'est que `slotDeGameId` ne regroupe rien.

- [ ] **Étape 4 : commit**

```bash
git add outils/chrono-animation.html outils/chrono-animation.js robots.txt
git commit -m "feat(dps): outiller le chronometrage image par image"
```

---

### Tâche 5 : parcours navigateur de la page

**Fichiers :**
- Créer : `tests/chrono-animation.playwright.js`
- Modifier : `scripts/lancer-tests.js` (`SUITES.e2e`)

**Interfaces :**
- Consomme : `window.ChronoPage.mesureCourante()` (tâche 4),
  `require("./helpers/serve").serveRepo`.
- Produit : rien.

- [ ] **Étape 1 : écrire le parcours**

Créer `tests/chrono-animation.playwright.js` :

```javascript
"use strict";

/* La page de chronometrage, dans un vrai navigateur. On ne charge pas de
   fichier video : on pilote directement currentTime, car ce qu'on verifie
   ici c'est la chaine marquage -> calcul -> affichage, pas le decodage. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

(async () => {
  const serveur = await serveRepo();
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  try{
    await page.goto(serveur.url + "/outils/chrono-animation.html");

    const nombreHeros = await page.locator("#heros option").count();
    assert.ok(nombreHeros >= 20, "les heros doivent etre proposes, vu " + nombreHeros);

    await page.selectOption("#heros", "meliodas");
    await page.selectOption("#slot", "jumpatk");

    // Dix lancements entre 1.000 s et 13.000 s : 1.2 s chacun.
    await page.evaluate(() => {
      const video = document.getElementById("video");
      Object.defineProperty(video, "currentTime", { value:1, writable:true });
      document.getElementById("marquerDebut").click();
      video.currentTime = 13;
      document.getElementById("marquerFin").click();
    });

    const mesure = await page.evaluate(() => window.ChronoPage.mesureCourante());
    assert.equal(mesure.secondes, 1.2);
    assert.equal(mesure.heros, "meliodas");
    assert.equal(mesure.slot, "jumpatk");
    assert.ok(
      mesure.gameIds.every(id => id.startsWith("meliodas_")),
      "la mesure ne doit viser que les gameId de meliodas"
    );
    assert.ok(
      mesure.gameIds.length > 1,
      "une animation couvre plusieurs armes du meme heros"
    );

    const affiche = await page.locator("#sortieDuree").textContent();
    assert.equal(affiche.trim(), "1.2");

    /* Le denominateur de l'avancement vaut le nombre de couples heros x slot.
       S'il valait 376, slotDeGameId ne regrouperait rien et chaque arme
       demanderait sa propre mesure. */
    await page.waitForFunction(
      () => !/chargement/.test(document.getElementById("avancement").textContent)
    );
    const avancement = await page.locator("#avancement").textContent();
    assert.match(avancement, /Avancement : \d+ \/ 161 animations mesurées\./);

    console.log("chrono-animation.playwright.js : OK");
  } finally {
    await navigateur.close();
    await serveur.close();
  }
})();
```

- [ ] **Étape 2 : lancer et vérifier**

Lancer : `node tests/chrono-animation.playwright.js`
Attendu : `chrono-animation.playwright.js : OK`.

`serveRepo()` rend `{url, close()}` : contrat vérifié dans
`tests/helpers/serve.js:62-71`, ne pas le modifier, une dizaine de parcours
en dépendent.

- [ ] **Étape 3 : enregistrer dans le lanceur**

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.e2e` :

```javascript
    "node tests/chrono-animation.playwright.js",
```

- [ ] **Étape 4 : commit**

```bash
git add tests/chrono-animation.playwright.js scripts/lancer-tests.js
git commit -m "test(dps): verifier le chronometrage dans un navigateur"
```

---

### Tâche 6 : la table de réception Supabase

**Fichiers :**
- Modifier : `supabase/schema.sql` (ajout en fin de fichier)
- Créer : `tests/animation-measures-schema.test.js`
- Modifier : `scripts/lancer-tests.js` (`SUITES.unit`)

**Interfaces :**
- Consomme : `auth.users`, `public.profiles`.
- Produit : `public.animation_measures`, lue par le script de la tâche 8 et
  écrite par l'envoi de la tâche 7.

Pas de colonne de statut, pas de rôle d'administration : la table est un
journal d'envois. Accepter une mesure, c'est l'écrire dans
`data/animations-mesurees.json` et la commiter.

- [ ] **Étape 1 : écrire le test de schéma qui échoue**

Créer `tests/animation-measures-schema.test.js` :

```javascript
"use strict";

/* Le schema de la boite de reception : la table et ses politiques, telles
   qu'elles sont commitees. Ce test ne parle a aucun serveur, il lit le SQL
   que l'administrateur va coller dans Supabase. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sql = fs.readFileSync(
  path.resolve(__dirname, "..", "supabase", "schema.sql"),
  "utf8"
);

[
  /create table if not exists public\.animation_measures/i,
  /alter table public\.animation_measures enable row level security/i,
  /create policy animation_measures_read[\s\S]*?for select to authenticated using\s*\(\s*true\s*\)/i,
  /create policy animation_measures_insert[\s\S]*?with check\s*\(\s*owner\s*=\s*auth\.uid\(\)\s*\)/i
].forEach(pattern => assert.match(sql, pattern));

/* Aucune politique `update` ni `delete` : une mesure envoyee est un fait
   date, pas un brouillon. La corriger, c'est en envoyer une autre, et c'est
   le rapatriement qui tranche entre les deux sous les yeux d'un humain. */
["update", "delete"].forEach(verbe => {
  assert.equal(
    new RegExp("create policy animation_measures_" + verbe, "i").test(sql),
    false,
    "aucune politique " + verbe + " ne doit exister sur animation_measures"
  );
});

/* Le mode conditionne la lecture du chiffre : sans lui, on ne sait pas si
   `seconds` est une mesure directe ou une moyenne sur `reps` lancements. */
assert.match(sql, /mode\s+text\s+not null[\s\S]*?rafale[\s\S]*?unique/i);

console.log("animation-measures-schema.test.js : OK");
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Lancer : `node tests/animation-measures-schema.test.js`
Attendu : ÉCHEC sur `create table if not exists public.animation_measures`.

- [ ] **Étape 3 : ajouter la table au schéma**

Ajouter à la fin de `supabase/schema.sql` :

```sql
-- =============================================================================
--  Boite de reception des temps d'animation.
--
--  Une ligne = un envoi date, jamais modifie. data/animations-mesurees.json
--  reste la source de verite : cette table alimente une relecture humaine,
--  elle ne la remplace pas. D'ou l'absence de colonne de statut et de role
--  d'administration — accepter une mesure, c'est l'ecrire dans le fichier.
--
--  `mode` est obligatoire : sans lui, `seconds` est ininterpretable. En
--  rafale c'est une moyenne sur `reps` lancements, en unique une mesure
--  directe entre deux marqueurs.
-- =============================================================================
create table if not exists public.animation_measures (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  pseudo     text,
  hero       text not null,
  slot       text not null,
  seconds    numeric not null check (seconds > 0),
  mode       text not null check (mode in ('rafale', 'unique')),
  reps       integer check (reps is null or reps >= 1),
  fps        numeric,
  created_at timestamptz not null default now()
);

create index if not exists animation_measures_hero_slot
  on public.animation_measures (hero, slot);

alter table public.animation_measures enable row level security;

drop policy if exists animation_measures_read   on public.animation_measures;
drop policy if exists animation_measures_insert on public.animation_measures;
create policy animation_measures_read   on public.animation_measures for select to authenticated using (true);
create policy animation_measures_insert on public.animation_measures for insert to authenticated with check (owner = auth.uid());
```

- [ ] **Étape 4 : lancer et vérifier le succès**

Lancer : `node tests/animation-measures-schema.test.js`
Attendu : `animation-measures-schema.test.js : OK`.

- [ ] **Étape 5 : enregistrer dans le lanceur**

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit`, après
`"node tests/collection-schema.test.js",` :

```javascript
    "node tests/animation-measures-schema.test.js",
```

- [ ] **Étape 6 : commit**

```bash
git add supabase/schema.sql tests/animation-measures-schema.test.js scripts/lancer-tests.js
git commit -m "feat(dps): recevoir les mesures d'animation des membres"
```

- [ ] **Étape 7 : appliquer dans Supabase**

Coller le bloc ajouté dans Supabase → SQL Editor → Run. Le fichier entier
est idempotent, le rejouer est sans risque.

---

### Tâche 7 : envoyer sa mesure depuis la page

**Fichiers :**
- Modifier : `outils/chrono-animation.html`
- Modifier : `outils/chrono-animation.js`

**Interfaces :**
- Consomme : `window.ChronoPage.mesureCourante()` (tâche 4),
  `window.supabase`, `window.SB_URL`, `window.SB_KEY`,
  `public.animation_measures` (tâche 6).
- Produit : des lignes dans `public.animation_measures`.

- [ ] **Étape 1 : charger le client dans la page**

Dans `outils/chrono-animation.html`, avant `<script src="chrono-calcul.js">` :

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="../supabase-config.js"></script>
```

Et dans le `<main>`, après le paragraphe de la durée :

```html
<button type="button" id="envoyer">Envoyer ma mesure</button>
<p id="retourEnvoi" role="status"></p>
```

- [ ] **Étape 2 : brancher l'envoi**

Ajouter dans `outils/chrono-animation.js`, juste avant
`window.ChronoPage = ...` :

```javascript
  const sb = window.supabase && window.SB_URL && window.SB_KEY
    ? window.supabase.createClient(window.SB_URL, window.SB_KEY)
    : null;

  async function envoyer(){
    const retour = document.getElementById("retourEnvoi");
    if(!sb){ retour.textContent = "Connexion au registre indisponible."; return; }

    let mesure;
    try{
      mesure = mesureCourante();
    }catch(erreur){
      retour.textContent = erreur.message;
      return;
    }
    if(!mesure){ retour.textContent = "Marque d'abord un début et une fin."; return; }

    const reponseUtilisateur = await sb.auth.getUser();
    const utilisateur = reponseUtilisateur.data && reponseUtilisateur.data.user;
    if(!utilisateur){
      retour.textContent = "Connecte-toi sur le site avant d'envoyer.";
      return;
    }

    const profil = await sb.from("profiles")
      .select("pseudo").eq("id", utilisateur.id).maybeSingle();

    const { error } = await sb.from("animation_measures").insert({
      owner:utilisateur.id,
      pseudo:(profil.data && profil.data.pseudo) || null,
      hero:mesure.heros,
      slot:mesure.slot,
      seconds:mesure.secondes,
      mode:mesure.mode,
      reps:mesure.repetitions,
      fps:etat.cadence
    });
    retour.textContent = error
      ? "L'envoi a échoué : " + error.message
      : "Mesure envoyée, merci.";
  }

  document.getElementById("envoyer").addEventListener("click", envoyer);
```

- [ ] **Étape 3 : vérifier à la main**

Ouvrir la page en étant connecté au site, marquer une mesure, envoyer, puis
dans Supabase → Table Editor → `animation_measures`, constater la ligne.

Se déconnecter et réessayer : le message doit inviter à se connecter, et
aucune ligne ne doit apparaître. C'est la RLS qu'on vérifie, pas le message.

- [ ] **Étape 4 : commit**

```bash
git add outils/chrono-animation.html outils/chrono-animation.js
git commit -m "feat(dps): envoyer une mesure d'animation depuis l'outil"
```

---

### Tâche 8 : rapatrier les mesures dans le fichier

**Fichiers :**
- Créer : `scripts/rapatrier-mesures.py`
- Créer : `tests/test_rapatrier_mesures.py`
- Modifier : `scripts/lancer-tests.js` (`SUITES.unit`)

**Interfaces :**
- Consomme : `public.animation_measures` (tâche 6),
  `data/animations-mesurees.json`, `data/competences.js`.
- Produit :
  - `slot_de_game_id(game_id) -> str`
  - `game_ids_du_couple(catalogue, heros, slot) -> list[str]`
  - `desaccords(envois) -> list[tuple]`
  - `appliquer(mesures, catalogue, heros, slot, secondes) -> dict`

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `tests/test_rapatrier_mesures.py` :

```python
import importlib.util
import pathlib
import unittest


RACINE = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "rapatrier_mesures", RACINE / "scripts" / "rapatrier-mesures.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


CATALOGUE = {
    "meliodas": [
        {"gameId": "meliodas_axe_jumpatk"},
        {"gameId": "meliodas_sword1h_jumpatk"},
        {"gameId": "meliodas_axe_skill_q"},
    ],
    "diane": [{"gameId": "diane_axe_jumpatk"}],
}


class RapatrierMesuresTests(unittest.TestCase):
    def test_le_slot_ignore_le_heros_et_l_arme(self):
        self.assertEqual(MODULE.slot_de_game_id("bug_axe_jumpatk"), "jumpatk")
        self.assertEqual(
            MODULE.slot_de_game_id("gil_thunder_lance_skill_tag"), "skill_tag"
        )

    def test_une_mesure_couvre_toutes_les_armes_du_heros(self):
        self.assertEqual(
            sorted(MODULE.game_ids_du_couple(CATALOGUE, "meliodas", "jumpatk")),
            ["meliodas_axe_jumpatk", "meliodas_sword1h_jumpatk"],
        )

    def test_l_ecriture_touche_tous_les_game_ids_du_couple(self):
        mesures = {"animations": {}}
        obtenu = MODULE.appliquer(mesures, CATALOGUE, "meliodas", "jumpatk", 1.2)
        self.assertEqual(
            obtenu["animations"],
            {"meliodas_axe_jumpatk": 1.2, "meliodas_sword1h_jumpatk": 1.2},
        )

    def test_un_ecart_de_plus_de_dix_pour_cent_est_signale(self):
        envois = [
            {"hero": "meliodas", "slot": "jumpatk", "seconds": 1.2, "pseudo": "a"},
            {"hero": "meliodas", "slot": "jumpatk", "seconds": 1.5, "pseudo": "b"},
            {"hero": "diane", "slot": "jumpatk", "seconds": 1.0, "pseudo": "a"},
            {"hero": "diane", "slot": "jumpatk", "seconds": 1.05, "pseudo": "b"},
        ]
        signales = MODULE.desaccords(envois)
        self.assertEqual(
            [couple for couple, _ in signales], [("meliodas", "jumpatk")]
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Lancer : `python -m unittest tests/test_rapatrier_mesures.py`
Attendu : ÉCHEC, `scripts/rapatrier-mesures.py` n'existe pas.

- [ ] **Étape 3 : écrire le script**

Créer `scripts/rapatrier-mesures.py` :

```python
"""Rapatrie les mesures envoyees par les membres dans animations-mesurees.json.

Supabase est une boite de reception, pas la source de verite : ce script
montre ce qui est arrive, signale les desaccords, et n'ecrit que ce qu'un
humain a valide. Les chiffres qu'il produit determinent tout le calcul de DPS
de la confrerie — une valeur fausse qui passe inapercue vaut moins que pas de
valeur du tout.

    python scripts/rapatrier-mesures.py
"""

import json
import os
import sys
import urllib.request

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOGUE = os.path.join(RACINE, "data", "competences.js")
MESURES = os.path.join(RACINE, "data", "animations-mesurees.json")
CONFIG = os.path.join(RACINE, "supabase-config.js")

DEBUTS_DE_SLOT = ("jumpatk", "normalatk", "skill_")
ECART_TOLERE = 0.10


def slot_de_game_id(game_id):
    texte = str(game_id or "")
    positions = [texte.find(debut) for debut in DEBUTS_DE_SLOT]
    positions = [position for position in positions if position >= 0]
    return texte[min(positions):] if positions else texte


def game_ids_du_couple(catalogue, heros, slot):
    return [
        skill["gameId"]
        for skill in catalogue.get(heros, [])
        if skill.get("gameId") and slot_de_game_id(skill["gameId"]) == slot
    ]


def desaccords(envois):
    par_couple = {}
    for envoi in envois:
        par_couple.setdefault((envoi["hero"], envoi["slot"]), []).append(envoi)
    signales = []
    for couple, liste in par_couple.items():
        valeurs = [float(envoi["seconds"]) for envoi in liste]
        if len(valeurs) < 2:
            continue
        if (max(valeurs) - min(valeurs)) / min(valeurs) > ECART_TOLERE:
            signales.append((couple, liste))
    return signales


def appliquer(mesures, catalogue, heros, slot, secondes):
    for game_id in game_ids_du_couple(catalogue, heros, slot):
        mesures["animations"][game_id] = secondes
    return mesures


def _charge_js(chemin):
    with open(chemin, encoding="utf-8") as fichier:
        source = fichier.read()
    return json.loads(source[source.index("{"):].rstrip().rstrip(";"))


def _config():
    with open(CONFIG, encoding="utf-8") as fichier:
        source = fichier.read()
    valeurs = {}
    for cle in ("SB_URL", "SB_KEY"):
        valeurs[cle] = source[source.index(cle) + len(cle):].split('"')[1]
    return valeurs


def _envois():
    config = _config()
    url = config["SB_URL"] + "/rest/v1/animation_measures?select=*&order=created_at"
    requete = urllib.request.Request(url, headers={
        "apikey": config["SB_KEY"],
        "Authorization": "Bearer " + config["SB_KEY"],
    })
    with urllib.request.urlopen(requete, timeout=30) as reponse:
        return json.loads(reponse.read().decode("utf-8"))


def main():
    catalogue = _charge_js(CATALOGUE)
    with open(MESURES, encoding="utf-8") as fichier:
        mesures = json.load(fichier)

    envois = _envois()

    for couple, liste in desaccords(envois):
        print("DESACCORD sur %s / %s :" % couple)
        for envoi in liste:
            print("   %-12s %s s (%s)" % (
                envoi.get("pseudo") or "?", envoi["seconds"], envoi["mode"]))
        print("   -> tranche a la main, ce script ne choisira pas pour toi.\n")

    deja = set(mesures["animations"])
    nouveaux = [
        envoi for envoi in envois
        if not set(game_ids_du_couple(catalogue, envoi["hero"], envoi["slot"])) & deja
    ]
    if not nouveaux:
        print("Rien de nouveau.")
        return 0

    for envoi in nouveaux:
        cibles = game_ids_du_couple(catalogue, envoi["hero"], envoi["slot"])
        reponse = input("%s / %s = %s s (%s) -> ecrire sur %d gameId ? [o/N] " % (
            envoi["hero"], envoi["slot"], envoi["seconds"],
            envoi.get("pseudo") or "?", len(cibles)))
        if reponse.strip().lower() == "o":
            appliquer(mesures, catalogue, envoi["hero"], envoi["slot"],
                      float(envoi["seconds"]))

    with open(MESURES, "w", encoding="utf-8") as fichier:
        json.dump(mesures, fichier, ensure_ascii=False, indent=2)
        fichier.write("\n")
    print("\nEcrit. Relance maintenant : python scripts/lister-chronometrage.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Étape 4 : lancer et vérifier le succès**

Lancer : `python -m unittest tests/test_rapatrier_mesures.py`
Attendu : OK, quatre tests.

- [ ] **Étape 5 : enregistrer dans le lanceur**

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit` :

```javascript
    "python -m unittest tests/test_rapatrier_mesures.py",
```

- [ ] **Étape 6 : commit**

```bash
git add scripts/rapatrier-mesures.py tests/test_rapatrier_mesures.py scripts/lancer-tests.js
git commit -m "feat(dps): rapatrier les mesures des membres dans le fichier"
```

---

### Tâche 9 : la suite entière passe

**Fichiers :** aucun, sauf correctifs révélés par la suite.

**Interfaces :**
- Consomme : tout ce qui précède.
- Produit : rien.

- [ ] **Étape 1 : lancer toute la suite**

Lancer : `node scripts/lancer-tests.js`
Attendu : aucun échec. Deux parcours sont connus pour être instables,
`supabase-etape1` et `accessibilite-mobile` : les relancer seuls avant de
conclure à une régression.

- [ ] **Étape 2 : vérifier que le document est à jour**

Lancer : `python scripts/lister-chronometrage.py`
Puis : `git diff --stat docs/chronometrage-animations.md`
Attendu : aucune différence, la tâche 1 ayant commité le document régénéré.

- [ ] **Étape 3 : commit s'il y a lieu**

```bash
git add -A
git commit -m "test(dps): la suite entiere passe avec le chronometrage"
```
