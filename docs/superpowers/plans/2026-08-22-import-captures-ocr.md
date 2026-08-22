# Import de builds depuis des captures d'écran — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> superpowers:subagent-driven-development (recommandé) ou
> superpowers:executing-plans pour dérouler ce plan tâche par tâche. Les étapes
> utilisent des cases à cocher (`- [ ]`).

**But :** permettre à un membre de remplir la configuration d'équipement d'un
héros en déposant des captures d'écran du jeu, au lieu de saisir chaque champ.

**Architecture :** la lecture d'image produit une liste de `{libelle, valeur}` ;
la déduction remonte de ces valeurs affichées vers la configuration stockée, en
s'appuyant sur les tables du jeu déjà présentes dans `data/stats-build.js` ; la
vue montre un récapitulatif que le membre valide avant toute écriture. Le
chemin d'écriture existant n'est pas modifié.

**Pile technique :** JavaScript ES modules sans bundler, tesseract.js (WASM,
servi depuis le dépôt), tests Node en CommonJS et Playwright.

**Spec :** `docs/superpowers/specs/2026-08-22-import-captures-ocr-design.md`

## Contraintes globales

- **Le dépôt est en CRLF.** Écrire les fichiers avec des fins de ligne `\r\n`.
- **Les modules applicatifs sont des ES modules** avec un unique bloc
  `export { ... };` en fin de fichier. Indentation de 2 espaces.
- **Les commentaires sont en français et expliquent le POURQUOI**, jamais le
  quoi. Un commentaire qui paraphrase le code est un défaut.
- **La couche `metier/` n'a ni DOM ni réseau.** `canvas`, `Image`, `fetch` et
  le worker tesseract vivent dans `vues/`.
- **Tout nouveau module applicatif doit être déclaré dans
  `tests/helpers/modules.js`**, dans sa couche. Un module n'importe jamais un
  module déclaré après lui — `tests/modules-imports.test.js` protège la règle.
- **Toute fonction testée doit être exposée dans `HOOK_EXPORT` de
  `tests/helpers/load-app.js`**, avec la garde `typeof` du fichier.
- **Tout nouveau fichier de test doit être inscrit dans `SUITES` de
  `scripts/lancer-tests.js`** (`unit` ou `e2e`).
- **Aucun appel à un CDN.** Tout est servi depuis le dépôt.
- Les tests unitaires sont en CommonJS, avec `node:assert/strict` et des
  assertions au niveau racine du fichier.
- Commande de vérification : `node scripts/lancer-tests.js unit`

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `js/metier/ocr-panneau.js` *(créé)* | Pur. Détection du rectangle du panneau à partir d'une grille de luminance, puis extraction des `{libelle, valeur}` à partir des mots OCR et de leurs boîtes. Aucun DOM. |
| `js/metier/ocr-deduction.js` *(créé)* | Pur. Recalage des libellés sur `statLabels`, puis inversion vers une configuration. Aucun DOM. |
| `js/vues/import-captures.js` *(créé)* | Décodage des images, worker tesseract, orchestration, récapitulatif, écriture. |
| `vendor/tesseract/` *(créé)* | Worker, WASM et `fra.traineddata`. |
| `css/import-captures.css` *(créé)* | Styles de la modale d'import. |
| `js/vues/edition-build.js` *(modifié)* | Ajout du bouton « Remplir depuis des captures ». |
| `tests/helpers/modules.js` *(modifié)* | Déclaration des deux modules `metier`. |
| `tests/helpers/load-app.js` *(modifié)* | Exposition des fonctions testées. |
| `scripts/lancer-tests.js` *(modifié)* | Inscription des fichiers de test. |
| `sw.js` *(modifié)* | `css/import-captures.css` dans `CORE_ASSETS` ; `vendor/` volontairement absent. |

**Divergence assumée avec la spec :** elle nommait un seul module
`js/metier/ocr-lecture.js`. Il est scindé en `js/metier/ocr-panneau.js` (pur) et
la partie pixels de `js/vues/import-captures.js`, parce que la couche `metier`
interdit le DOM et que décoder une image exige un `canvas`. Le contenu et les
mécanismes décrits par la spec sont inchangés.

---

### Tâche 1 : Recalage d'un libellé sur le catalogue

**Fichiers :**
- Créer : `js/metier/ocr-deduction.js`
- Créer : `tests/ocr-deduction.test.js`
- Modifier : `tests/helpers/modules.js` (couche `metier`, après `stats-calcul.js`)
- Modifier : `tests/helpers/load-app.js` (bloc `HOOK_EXPORT`)
- Modifier : `scripts/lancer-tests.js` (`SUITES.unit`)

**Interfaces :**
- Consomme : `BUILD_STATS` depuis `js/noyau/constantes.js`.
- Produit : `recalerLibelle(texte, valeurBrute, codesAutorises)` qui rend
  `{ statut, code, rival }`. `statut` vaut `"exact"`, `"rattrape"`, `"ambigu"`
  ou `"rejete"`. `code` est un code de stat de `statLabels`, ou `null` si
  rejeté. `codesAutorises` est un tableau de codes ; s'il est vide, tout le
  catalogue est candidat.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/ocr-deduction.test.js` :

```js
"use strict";

/* Le recalage des libelles lus par l'OCR.

   Le jeu ecrit exactement les memes chaines que `statLabels` : l'OCR n'a donc
   pas besoin d'etre exact, seulement d'etre proche. Trois contraintes se
   cumulent pour que « proche » suffise sans jamais deviner faux. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { recalerLibelle } = hooks;
assert.equal(typeof recalerLibelle, "function",
  "recalerLibelle doit etre expose par js/metier/ocr-deduction.js");

/* Un libelle intact se reconnait sans distance. */
assert.deepEqual(
  { statut:recalerLibelle("PV de l'équipement", "21 678", []).statut,
    code:recalerLibelle("PV de l'équipement", "21 678", []).code },
  { statut:"exact", code:"B_MaxHp_Equip" }
);

/* Accents perdus, ponctuation changee, icone collee devant : la normalisation
   absorbe tout ca sans que la distance d'edition ait a intervenir. */
assert.equal(
  recalerLibelle("* Degats crit,", "12.42%", []).code,
  "C_Critical_Dam_Rate"
);

/* Une vraie faute de lecture doit etre rattrapee, pas rejetee. */
const rattrape = recalerLibelle("Augmentation des dégats, competence norrnale",
  "10.80%", []);
assert.equal(rattrape.code, "Normalskill_Damadd_Rate");
assert.equal(rattrape.statut, "rattrape");

/* L'unite est le garde-fou decisif. Sept paires de libelles sont homonymes :
   `Attaque de Feu` existe en valeur brute ET en pourcentage. Sans le signal du
   « % », le recalage tranchait a pile ou face. */
assert.equal(recalerLibelle("Attaque de Feu", "1 409", []).code, "Fire_Add");
assert.equal(recalerLibelle("Attaque de Feu", "12.34%", []).code, "fireDamage");

/* Restreindre aux stats que la piece peut porter reduit les candidats de 87 a
   une quinzaine, ce qui fait tomber l'ambiguite entre libelles voisins. */
assert.equal(
  recalerLibelle("Defense de Foudr", "10.50%",
    ["Thunder_Res_Rate", "C_Critical_DamRes_Rate"]).code,
  "Thunder_Res_Rate"
);

/* Un texte qui n'est pas un libelle de stat doit etre REJETE, jamais rapproche
   du moins mauvais candidat : c'est ce qui empeche un titre de section ou une
   phrase de description d'entrer dans le roster. */
assert.equal(recalerLibelle("Équipement gravé", "130", []).statut, "rejete");
assert.equal(recalerLibelle("Échanger", "0", []).statut, "rejete");

console.log("ocr-deduction (recalage) : OK");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/ocr-deduction.test.js`
Attendu : échec sur `recalerLibelle doit etre expose par
js/metier/ocr-deduction.js`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `js/metier/ocr-deduction.js` :

```js
/* De ce que l'OCR a lu vers ce que le site stocke.

   Le site ne stocke pas des statistiques : il stocke une configuration, et
   recalcule les statistiques a partir des tables du jeu. Ce module fait le
   trajet inverse. Il commence par ramener chaque libelle lu sur une entree de
   `statLabels` — le jeu ecrit exactement les memes chaines, donc l'OCR n'a
   besoin que d'etre proche. */

import { BUILD_STATS } from "../noyau/constantes.js";

  const STAT_LABELS = BUILD_STATS.statLabels || {};

  /* Tout ce qu'un OCR abime sans changer le sens disparait ici : accents,
     casse, ponctuation, et les espaces exotiques — l'insecable fine que le jeu
     emploie comme separateur de milliers en fait partie. */
  function normaliser(texte){
    return String(texte === undefined || texte === null ? "" : texte)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\u00a0\u202f\u2009\s]+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ +/g, " ")
      .trim();
  }

  function distance(a, b){
    if(a === b) return 0;
    if(!a.length) return b.length;
    if(!b.length) return a.length;
    let precedente = Array.from({ length:b.length + 1 }, (_, i) => i);
    for(let i = 1; i <= a.length; i++){
      const courante = [i];
      for(let j = 1; j <= b.length; j++){
        courante[j] = Math.min(
          precedente[j] + 1,
          courante[j - 1] + 1,
          precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      precedente = courante;
    }
    return precedente[b.length];
  }

  /* La valeur lue a cote du libelle porte un signal gratuit et tres fiable :
     un « % » veut dire `ten-thousandths`, son absence veut dire `flat`. Il
     tranche les sept paires de libelles homonymes du catalogue. */
  function uniteDeLaValeur(valeurBrute){
    if(valeurBrute === undefined || valeurBrute === null) return null;
    return /%/.test(String(valeurBrute)) ? "ten-thousandths" : "flat";
  }

  /* Au-dela d'un tiers du libelle abime, on ne rattrape plus : on rejette. Et
     un second candidat trop proche rend la reponse suspecte, donc ambigue —
     sans cette marge, on « reussirait » en tirant au sort entre deux voisins. */
  const TOLERANCE = 0.34;
  const MARGE_MINIMALE = 2;

  function candidats(codesAutorises, unite){
    const permis = Array.isArray(codesAutorises) && codesAutorises.length
      ? new Set(codesAutorises) : null;
    return Object.keys(STAT_LABELS)
      .filter(code => !permis || permis.has(code))
      .filter(code => !unite || STAT_LABELS[code].unit === unite)
      .map(code => ({ code, cle:normaliser(STAT_LABELS[code].fr) }));
  }

  function recalerLibelle(texte, valeurBrute, codesAutorises){
    const cible = normaliser(texte);
    if(!cible) return { statut:"rejete", code:null, rival:null };
    const unite = uniteDeLaValeur(valeurBrute);
    let liste = candidats(codesAutorises, unite);
    if(!liste.length) liste = candidats(codesAutorises, null);
    if(!liste.length) return { statut:"rejete", code:null, rival:null };

    let meilleur = null, second = null;
    for(const entree of liste){
      const d = distance(cible, entree.cle);
      if(!meilleur || d < meilleur.d){ second = meilleur; meilleur = { entree, d }; }
      else if(!second || d < second.d){ second = { entree, d }; }
    }
    if(meilleur.d === 0){
      return { statut:"exact", code:meilleur.entree.code, rival:null };
    }
    const relative = meilleur.d
      / Math.max(cible.length, meilleur.entree.cle.length);
    if(relative > TOLERANCE) return { statut:"rejete", code:null, rival:null };
    if(second && (second.d - meilleur.d) < MARGE_MINIMALE){
      return { statut:"ambigu", code:meilleur.entree.code,
        rival:second.entree.code };
    }
    return { statut:"rattrape", code:meilleur.entree.code, rival:null };
  }

export { normaliser, distance, uniteDeLaValeur, recalerLibelle };
```

- [ ] **Étape 4 : déclarer le module et exposer la fonction**

Dans `tests/helpers/modules.js`, ajouter dans la couche `metier`, juste après
`"metier/stats-calcul.js"` :

```js
  /* Apres `stats-calcul.js` et `build-config.js` : la deduction s'appuie sur
     leurs tables pour inverser une valeur affichee. */
  "metier/ocr-deduction.js",
```

Dans `tests/helpers/load-app.js`, ajouter dans l'objet `HOOK_EXPORT` :

```js
  recalerLibelle:typeof recalerLibelle === "function"
    ? recalerLibelle
    : undefined,
```

Dans `scripts/lancer-tests.js`, ajouter à la fin de `SUITES.unit` :

```js
    "node tests/ocr-deduction.test.js",
```

- [ ] **Étape 5 : lancer le test et vérifier qu'il passe**

Commande : `node tests/ocr-deduction.test.js`
Attendu : `ocr-deduction (recalage) : OK`

Puis la non-régression de la règle de couches :
Commande : `node tests/modules-imports.test.js`
Attendu : succès.

- [ ] **Étape 6 : commiter**

```bash
git add js/metier/ocr-deduction.js tests/ocr-deduction.test.js \
        tests/helpers/modules.js tests/helpers/load-app.js scripts/lancer-tests.js
git commit -m "feat(ocr): recaler un libelle lu sur le catalogue de stats"
```

---

### Tâche 2 : Inversion d'une valeur affichée vers (niveau, renforcement)

**Fichiers :**
- Modifier : `js/metier/ocr-deduction.js`
- Modifier : `tests/ocr-deduction.test.js`
- Modifier : `tests/helpers/load-app.js`

**Interfaces :**
- Consomme : `calculateGearStats(fichier, config, slotKey)` de
  `js/metier/stats-calcul.js` ; `buildGearDefinition(fichier)` de
  `js/metier/build-config.js`.
- Produit : `configsDePiece(fichier, slotKey, valeurPrincipale, valeurSecondaire)`
  qui rend un tableau de `{ level, reinforce }`, vide si aucune configuration
  ne reproduit les valeurs. Tableau à plus d'un élément = ambiguïté.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à la fin de `tests/ocr-deduction.test.js`, avant le `console.log` final :

```js
const { configsDePiece } = hooks;
assert.equal(typeof configsDePiece, "function",
  "configsDePiece doit etre expose");

/* Valeurs relevees a l'oeil sur une capture reelle : la ceinture affiche
   « PV de l'equipement 12 560 ». Une seule configuration la produit. */
assert.deepEqual(
  configsDePiece("7ds-armures-ssr/Ceinture/Ceinture du souverain cupide.webp",
    "belt", 12560, null),
  [{ level:159, reinforce:5 }]
);

/* La piece gravee, avec sa stat secondaire : PV 21 678 et Foudre 1 409. */
assert.deepEqual(
  configsDePiece("7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp",
    "engraved", 21678, 1409),
  [{ level:130, reinforce:5 }]
);

/* Le point qui compte le plus : les valeurs atteignables sont RARES dans leur
   intervalle — 3,56 % des entiers en mediane. Un chiffre mal lu ne correspond
   donc presque jamais a une configuration, et l'erreur se signale au lieu de
   s'ecrire. C'est ce filet qui rend l'import sur. */
assert.deepEqual(
  configsDePiece("7ds-armures-ssr/Ceinture/Ceinture du souverain cupide.webp",
    "belt", 12561, null),
  []
);

/* Un fichier inconnu ne doit pas lever, seulement ne rien proposer. */
assert.deepEqual(configsDePiece("inexistant.webp", "belt", 100, null), []);
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/ocr-deduction.test.js`
Attendu : échec sur `configsDePiece doit etre expose`.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `js/metier/ocr-deduction.js`, ajouter les imports en tête :

```js
import { buildGearDefinition, gearEnchantmentLength } from "./build-config.js";
import { calculateGearStats } from "./stats-calcul.js";
```

Puis, avant le bloc `export` :

```js
  /* Une configuration « nue » : le bon nombre d'emplacements d'enchantement,
     tous vides. On ne cherche ici que le couple (niveau, renforcement), et les
     enchantements n'entrent pas dans les valeurs principale et secondaire. */
  function configNue(definition, level, reinforce){
    return {
      version:1,
      level,
      reinforce,
      enchantments:Array.from(
        { length:gearEnchantmentLength(definition) }, () => null),
      passiveLevel:Array.isArray(definition.passiveLevels)
        && definition.passiveLevels.length ? 1 : null
    };
  }

  function valeurDuRole(resultat, role){
    const terme = (resultat.terms || []).find(t => t.role === role);
    return terme ? terme.value : null;
  }

  /* Le site calcule config -> valeurs. Ici on parcourt l'espace des
     configurations possibles et on garde celles qui reproduisent ce qui est
     affiche. L'espace est petit — au plus une quarantaine de niveaux fois six
     renforcements — donc la force brute est le bon outil : elle reste exacte
     meme si les formules du jeu changent, puisqu'elle les appelle. */
  function configsDePiece(fichier, slotKey, valeurPrincipale, valeurSecondaire){
    const definition = buildGearDefinition(fichier);
    if(!definition) return [];
    const trouvees = [];
    for(let level = definition.qualityMin; level <= definition.qualityMax; level++){
      for(let reinforce = 0; reinforce <= definition.reinforceMax; reinforce++){
        const resultat = calculateGearStats(
          fichier, configNue(definition, level, reinforce), slotKey);
        if(!resultat || resultat.status !== "valid") continue;
        if(valeurDuRole(resultat, "main") !== valeurPrincipale) continue;
        if(valeurSecondaire !== null && valeurSecondaire !== undefined
          && valeurDuRole(resultat, "sub") !== valeurSecondaire) continue;
        trouvees.push({ level, reinforce });
      }
    }
    return trouvees;
  }
```

Compléter la ligne `export` :

```js
export { normaliser, distance, uniteDeLaValeur, recalerLibelle, configsDePiece };
```

- [ ] **Étape 4 : exposer la fonction**

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  configsDePiece:typeof configsDePiece === "function"
    ? configsDePiece
    : undefined,
```

- [ ] **Étape 5 : lancer le test et vérifier qu'il passe**

Commande : `node tests/ocr-deduction.test.js`
Attendu : `ocr-deduction (recalage) : OK`

- [ ] **Étape 6 : commiter**

```bash
git add js/metier/ocr-deduction.js tests/ocr-deduction.test.js tests/helpers/load-app.js
git commit -m "feat(ocr): inverser une valeur affichee vers niveau et renforcement"
```

---

### Tâche 3 : Déduction complète d'une pièce d'équipement

**Fichiers :**
- Modifier : `js/metier/ocr-deduction.js`
- Créer : `tests/ocr-deduction-piece.test.js`
- Modifier : `tests/helpers/load-app.js`, `scripts/lancer-tests.js`

**Interfaces :**
- Consomme : `recalerLibelle` et `configsDePiece` de la tâche 2.
- Produit : `deduirePiece({ stats, herosSlug })` où `stats` est un tableau de
  `{ libelle, valeur }`. Rend
  `{ statut, candidats }` avec `statut` valant `"unique"`, `"ambigu"` ou
  `"aucun"`, et `candidats` un tableau de
  `{ fichier, slot, level, reinforce, enchantments }`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/ocr-deduction-piece.test.js` :

```js
"use strict";

/* La deduction d'une piece entiere a partir de ce que l'OCR a lu.

   Le point contre-intuitif : les trois donnees qui identifient une piece — le
   niveau en chiffres dores, le badge de renforcement, l'icone — sont
   precisement celles qui se lisent le plus mal. On ne les lit donc pas : on les
   deduit des valeurs de statistiques, qui elles se lisent tres bien. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { deduirePiece } = hooks;
assert.equal(typeof deduirePiece, "function", "deduirePiece doit etre expose");

/* Releve reel sur une capture de ceinture. Une seule piece du catalogue porte
   `B_MaxHp_Equip` en principale avec cette valeur exacte. */
const ceinture = deduirePiece({
  herosSlug:"merlin",
  stats:[
    { libelle:"PV de l'équipement", valeur:"12 560" },
    { libelle:"Augmentation des soins reçus", valeur:"5.53%" }
  ]
});
assert.equal(ceinture.statut, "unique");
assert.equal(ceinture.candidats.length, 1);
assert.equal(ceinture.candidats[0].slot, "belt");
assert.equal(ceinture.candidats[0].level, 159);
assert.equal(ceinture.candidats[0].reinforce, 5);
assert.match(ceinture.candidats[0].fichier, /Ceinture du souverain cupide/);

/* Une valeur incoherente ne doit produire AUCUN candidat. C'est le filet : une
   lecture fausse se signale au lieu d'entrer dans le roster. */
assert.equal(deduirePiece({
  herosSlug:"merlin",
  stats:[{ libelle:"PV de l'équipement", valeur:"12 561" }]
}).statut, "aucun");

/* Aucun libelle reconnaissable : echec franc, pas de devinette. */
assert.equal(deduirePiece({
  herosSlug:"merlin",
  stats:[{ libelle:"Échanger", valeur:"0" }]
}).statut, "aucun");

/* Une liste vide ne doit pas lever. */
assert.equal(deduirePiece({ herosSlug:"merlin", stats:[] }).statut, "aucun");

console.log("ocr-deduction (piece) : OK");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/ocr-deduction-piece.test.js`
Attendu : échec sur `deduirePiece doit etre expose`.

- [ ] **Étape 3 : écrire l'implémentation**

Dans `js/metier/ocr-deduction.js`, ajouter avant le bloc `export` :

```js
  /* Le dossier du fichier porte l'emplacement : c'est la source de verite du
     catalogue, on ne la duplique pas ailleurs. */
  const SLOT_PAR_DOSSIER = {
    "Haut":"top", "Bas":"bottom", "Bottes":"shoes", "Ceinture":"belt",
    "Anneau":"ring", "Collier":"necklace", "Boucle d'oreille":"earring",
    "Armure liee":"engraved"
  };

  function slotDuFichier(fichier){
    return SLOT_PAR_DOSSIER[String(fichier).split("/")[1]] || null;
  }

  function toutesLesPieces(){
    return [
      ...Object.keys(BUILD_STATS.gearByFile || {}),
      ...Object.keys(BUILD_STATS.engravedByFile || {})
    ];
  }

  /* Le nombre lu par l'OCR vers l'entier que le catalogue manipule. Les
     pourcentages sont stockes en dix-millemes : « 5.53% » vaut 553. Les
     separateurs de milliers du jeu sont des espaces insecables fines. */
  function valeurNumerique(brut){
    const net = String(brut).replace(/[\s\u00a0\u202f]/g, "");
    const pourcentage = /%$/.test(net);
    const nombre = Number(net.replace(/%$/, "").replace(/,/g, "."));
    if(!Number.isFinite(nombre)) return null;
    return pourcentage ? Math.round(nombre * 100) : nombre;
  }

  /* Les stats qu'une piece peut porter : sa principale, sa secondaire, et ses
     enchantements possibles. C'est ce qui ramene les candidats de 87 a une
     quinzaine lors du recalage. */
  function codesPossibles(definition){
    const options = ((definition.randomOptions || {}).stats) || [];
    return [definition.mainStat, definition.subStat,
      ...options.map(o => o.stat)].filter(Boolean);
  }

  function deduirePiece(entree){
    const stats = (entree && Array.isArray(entree.stats)) ? entree.stats : [];
    if(!stats.length) return { statut:"aucun", candidats:[] };

    const candidats = [];
    for(const fichier of toutesLesPieces()){
      const slot = slotDuFichier(fichier);
      const definition = buildGearDefinition(fichier);
      if(!slot || !definition) continue;

      /* La piece gravee est liee a un personnage : connaitre le heros suffit a
         ecarter les cinq autres qui partagent son profil de statistiques. */
      if(definition.character && entree.herosSlug
        && definition.character !== entree.herosSlug) continue;

      const permis = codesPossibles(definition);
      const lues = stats
        .map(s => ({ recale:recalerLibelle(s.libelle, s.valeur, permis),
          nombre:valeurNumerique(s.valeur) }))
        .filter(s => s.recale.statut !== "rejete" && s.nombre !== null);

      const principale = lues.find(s => s.recale.code === definition.mainStat);
      if(!principale) continue;
      const secondaire = definition.subStat
        ? lues.find(s => s.recale.code === definition.subStat) : null;

      for(const config of configsDePiece(fichier, slot, principale.nombre,
        secondaire ? secondaire.nombre : null)){
        candidats.push({
          fichier, slot,
          level:config.level,
          reinforce:config.reinforce,
          enchantments:Array.from(
            { length:gearEnchantmentLength(definition) }, () => null)
        });
      }
    }
    if(!candidats.length) return { statut:"aucun", candidats:[] };
    return { statut:candidats.length === 1 ? "unique" : "ambigu", candidats };
  }
```

Compléter le bloc `export` en y ajoutant `deduirePiece`.

- [ ] **Étape 4 : exposer et inscrire**

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  deduirePiece:typeof deduirePiece === "function" ? deduirePiece : undefined,
```

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit` après le test précédent :

```js
    "node tests/ocr-deduction-piece.test.js",
```

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

Commande : `node tests/ocr-deduction-piece.test.js`
Attendu : `ocr-deduction (piece) : OK`

Commande : `node tests/ocr-deduction.test.js`
Attendu : `ocr-deduction (recalage) : OK` — la tâche 2 ne doit pas régresser.

- [ ] **Étape 6 : commiter**

```bash
git add js/metier/ocr-deduction.js tests/ocr-deduction-piece.test.js \
        tests/helpers/load-app.js scripts/lancer-tests.js
git commit -m "feat(ocr): deduire une piece complete a partir des stats lues"
```

---

### Tâche 4 : Déduction d'une arme

**Fichiers :**
- Modifier : `js/metier/ocr-deduction.js`
- Créer : `tests/ocr-deduction-arme.test.js`
- Modifier : `tests/helpers/load-app.js`, `scripts/lancer-tests.js`

**Interfaces :**
- Consomme : `buildWeaponDefinition`, `buildWeaponGrade`, `weaponConfigStatus`
  de `js/metier/build-config.js` ; `calculateWeaponStats` de
  `js/metier/stats-calcul.js`.
- Produit : `deduireArme({ stats, titre, niveau })` où `titre` est le nom lu
  dans le bandeau et `niveau` l'entier lu dans `Lv.XX` (ou `null`). Rend
  `{ statut, candidats }`, `candidats` étant un tableau de
  `{ fichier, gradeGameId, level, promotion, overlimit, enchantments }`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/ocr-deduction-arme.test.js` :

```js
"use strict";

/* La deduction d'une arme.

   Une armure a deux inconnues, une arme en a quatre. Deux elements ramenent
   l'arme au meme niveau de fiabilite : le bandeau donne son nom et son niveau,
   et la promotion ne modifie AUCUNE statistique — elle ne fait que relever le
   plafond de niveau. Elle est donc invisible dans les chiffres tant que l'arme
   n'a pas atteint ce plafond, et parfaitement determinee au-dela. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { deduireArme } = hooks;
assert.equal(typeof deduireArme, "function", "deduireArme doit etre expose");

/* Releve reel : la baguette de Merlin, lue sur PC et sur mobile a l'identique. */
const montee = deduireArme({
  titre:"Baguette des ailes de la flamme noire",
  niveau:50,
  stats:[
    { libelle:"Attaque de l'équipement", valeur:"4 731" },
    { libelle:"Dégâts crit.", valeur:"48.82%" }
  ]
});
assert.equal(montee.statut, "unique");
assert.match(montee.candidats[0].fichier, /flamme noire/);
assert.equal(montee.candidats[0].level, 50);

/* Le nom lu sert a identifier l'arme, et il tolere une lecture approximative
   comme n'importe quel libelle. */
assert.match(
  deduireArme({
    titre:"Baguette des ailes de la flarnme noir",
    niveau:50,
    stats:[{ libelle:"Attaque de l'équipement", valeur:"4 731" }]
  }).candidats[0].fichier,
  /flamme noire/
);

/* Un titre illisible ne doit pas faire echouer : on retombe sur la recherche
   par statistiques dans tout le catalogue. */
assert.notEqual(
  deduireArme({
    titre:"@F à",
    niveau:50,
    stats:[{ libelle:"Attaque de l'équipement", valeur:"4 731" }]
  }).statut,
  "aucun"
);

/* Valeur incoherente : aucun candidat, comme pour une armure. */
assert.equal(deduireArme({
  titre:"Baguette des ailes de la flamme noire",
  niveau:50,
  stats:[{ libelle:"Attaque de l'équipement", valeur:"4 732" }]
}).statut, "aucun");

console.log("ocr-deduction (arme) : OK");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/ocr-deduction-arme.test.js`
Attendu : échec sur `deduireArme doit etre expose`.

- [ ] **Étape 3 : écrire l'implémentation**

Compléter les imports en tête de `js/metier/ocr-deduction.js` :

```js
import {
  buildGearDefinition, gearEnchantmentLength,
  buildWeaponDefinition, buildWeaponGrade, weaponConfigStatus
} from "./build-config.js";
import { calculateGearStats, calculateWeaponStats } from "./stats-calcul.js";
```

Puis, avant le bloc `export` :

```js
  /* Le nom de l'arme se recale sur les 155 du catalogue exactement comme un
     libelle de stat : meme normalisation, meme distance, meme tolerance. */
  function armeParLeTitre(titre){
    const cible = normaliser(titre);
    if(cible.length < 4) return null;
    let meilleur = null;
    for(const fichier of Object.keys(BUILD_STATS.weaponsByFile || {})){
      const nom = fichier.split("/").pop().replace(/\.webp$/, "");
      const d = distance(cible, normaliser(nom));
      if(!meilleur || d < meilleur.d) meilleur = { fichier, d, nom };
    }
    if(!meilleur) return null;
    const relative = meilleur.d
      / Math.max(cible.length, normaliser(meilleur.nom).length);
    return relative <= TOLERANCE ? meilleur.fichier : null;
  }

  function deduireArme(entree){
    const stats = (entree && Array.isArray(entree.stats)) ? entree.stats : [];
    if(!stats.length) return { statut:"aucun", candidats:[] };

    /* Le titre restreint a une seule arme quand il est lisible ; sinon on
       parcourt le catalogue, ce qui reste tenable et evite un echec sec. */
    const parLeTitre = armeParLeTitre(entree.titre);
    const fichiers = parLeTitre
      ? [parLeTitre] : Object.keys(BUILD_STATS.weaponsByFile || {});

    const candidats = [];
    for(const fichier of fichiers){
      const definition = buildWeaponDefinition(fichier);
      if(!definition) continue;
      const permis = [definition.mainStat].filter(Boolean);
      const lues = stats
        .map(s => ({ recale:recalerLibelle(s.libelle, s.valeur, []),
          nombre:valeurNumerique(s.valeur) }))
        .filter(s => s.recale.statut !== "rejete" && s.nombre !== null);
      const principale = lues.find(s => s.recale.code === definition.mainStat);
      if(!principale) continue;

      for(const id of Object.keys(definition.gradesByGameId || {})){
        const grade = buildWeaponGrade(fichier, Number(id));
        if(!grade) continue;
        const promotions = (grade.promotionSteps || []).length;
        const paliers = (grade.overlimit && Array.isArray(grade.overlimit.levels))
          ? grade.overlimit.levels.map(l => l.level) : [0];
        const nbEnchantements = (((grade.enchantments || {}).tiers) || []).length;
        for(let promotion = 0; promotion <= promotions; promotion++){
          for(const overlimit of paliers){
            const niveaux = Number.isInteger(entree.niveau)
              ? [entree.niveau] : Array.from({ length:61 }, (_, n) => n);
            for(const level of niveaux){
              const config = {
                version:1, gradeGameId:Number(id), level, promotion, overlimit,
                enchantments:Array.from({ length:nbEnchantements }, () => null)
              };
              if(weaponConfigStatus(fichier, config) === "incompatible") continue;
              const resultat = calculateWeaponStats(fichier, config);
              if(!resultat || resultat.status !== "valid") continue;
              if(valeurDuRole(resultat, "main") !== principale.nombre) continue;
              candidats.push({ fichier, gradeGameId:Number(id), level,
                promotion, overlimit, enchantments:config.enchantments });
            }
          }
        }
      }
    }
    if(!candidats.length) return { statut:"aucun", candidats:[] };
    return { statut:candidats.length === 1 ? "unique" : "ambigu", candidats };
  }
```

Compléter le bloc `export` en y ajoutant `deduireArme`.

- [ ] **Étape 4 : exposer et inscrire**

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  deduireArme:typeof deduireArme === "function" ? deduireArme : undefined,
```

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit` :

```js
    "node tests/ocr-deduction-arme.test.js",
```

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

Commande : `node tests/ocr-deduction-arme.test.js`
Attendu : `ocr-deduction (arme) : OK`

- [ ] **Étape 6 : commiter**

```bash
git add js/metier/ocr-deduction.js tests/ocr-deduction-arme.test.js \
        tests/helpers/load-app.js scripts/lancer-tests.js
git commit -m "feat(ocr): deduire une arme depuis son bandeau et ses stats"
```

---

### Tâche 5 : Détection du panneau et extraction des stats (pur)

**Fichiers :**
- Créer : `js/metier/ocr-panneau.js`
- Créer : `tests/ocr-panneau.test.js`
- Modifier : `tests/helpers/modules.js`, `tests/helpers/load-app.js`,
  `scripts/lancer-tests.js`

**Interfaces :**
- Produit :
  - `detecterPanneau({ largeur, hauteur, estClair })` où `estClair(x, y)` rend
    un booléen. Rend `{ left, top, width, height }` ou `null`.
  - `extraireStats(mots)` où chaque mot est
    `{ text, bbox:{ x0, y0, x1, y1 } }`. Rend un tableau de
    `{ libelle, valeur }`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/ocr-panneau.test.js` :

```js
"use strict";

/* La geometrie du panneau de statistiques, isolee du navigateur.

   Aucune coordonnee n'est codee en dur : le panneau se detecte par sa zone
   claire collee au bord droit, et les colonnes se deduisent de son contenu.
   C'est ce qui permet a la meme lecture de fonctionner en 1920x1080 et en
   2796x1290, deux resolutions et deux rapports d'image differents. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { detecterPanneau, extraireStats } = hooks;
assert.equal(typeof detecterPanneau, "function");
assert.equal(typeof extraireStats, "function");

/* Une image sombre avec un rectangle clair colle au bord droit. */
const zone = detecterPanneau({
  largeur:1000, hauteur:800,
  estClair:(x, y) => x >= 700 && y >= 100 && y <= 600
});
assert.ok(zone, "le panneau doit etre trouve");
assert.ok(Math.abs(zone.left - 700) <= 4, "bord gauche du panneau");
assert.ok(Math.abs(zone.top - 100) <= 4, "bord haut du panneau");

/* Une image entierement sombre n'a pas de panneau : on rend null plutot que
   d'inventer un rectangle que l'OCR lira pour rien. */
assert.equal(detecterPanneau({
  largeur:400, hauteur:300, estClair:() => false
}), null);

const mot = (text, x0, x1, y) => ({ text, bbox:{ x0, x1, y0:y, y1:y + 18 } });

/* Disposition 1 — la valeur est sur la premiere ligne du libelle, et le
   libelle continue en dessous. Fermer le bloc a la premiere valeur perdrait
   « compétence normale ». */
assert.deepEqual(
  extraireStats([
    mot("Augmentation", 100, 220, 10), mot("des", 226, 250, 10),
    mot("dégâts,", 256, 320, 10), mot("10.80%", 700, 780, 10),
    mot("compétence", 100, 200, 40), mot("normale", 206, 270, 40)
  ]),
  [{ libelle:"Augmentation des dégâts, compétence normale", valeur:"10.80%" }]
);

/* Disposition 2 — la valeur arrive APRES une barre de progression, sous le
   libelle. La bouillie que la barre laisse a l'OCR (« Le », « —e ») ne fait
   jamais plus de trois lettres, la ou un vrai mot en fait davantage. */
assert.deepEqual(
  extraireStats([
    mot("Efficacité", 100, 190, 10), mot("des", 196, 220, 10),
    mot("dégâts", 226, 280, 10), mot("sur", 286, 310, 10),
    mot("la", 316, 330, 10),
    mot("durée", 100, 150, 40),
    mot("—e", 300, 320, 70), mot("29.30%", 700, 780, 70)
  ]),
  [{ libelle:"Efficacité des dégâts sur la durée", valeur:"29.30%" }]
);

/* Un titre de section n'a pas de valeur et ne doit pas polluer le libelle
   suivant. */
assert.deepEqual(
  extraireStats([
    mot("Bonus", 100, 150, 10), mot("de", 156, 176, 10),
    mot("gravure", 182, 240, 10),
    mot("Chances", 100, 170, 40), mot("crit.", 176, 210, 40),
    mot("4.50%", 700, 780, 70)
  ]),
  [{ libelle:"Chances crit.", valeur:"4.50%" }]
);

console.log("ocr-panneau : OK");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/ocr-panneau.test.js`
Attendu : échec sur `detecterPanneau`.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `js/metier/ocr-panneau.js` :

```js
/* La geometrie du panneau de statistiques du jeu, sans aucun pixel.

   Ce module ne connait rien au 7DS : ni les stats, ni les pieces. C'est un
   lecteur de panneaux. Il recoit une fonction de luminance et des mots avec
   leurs boites, il rend un rectangle et des couples libelle/valeur.

   Aucune coordonnee n'est codee en dur : c'est ce qui lui permet de traiter un
   1920x1080 et un 2796x1290 sans reglage. */

  const EST_NOMBRE = /^[0-9][0-9\s\u202f\u00a0.,]*%?$/;

  const SECTIONS = ["Enchanter", "Bonus de gravure", "Parametre de promotion",
    "Ensemble 3 pieces", "Ensemble 5 pieces", "Stats"];

  function nettoyer(texte){
    return String(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/ +/g, " ").trim();
  }

  function estSection(texte){
    const cible = nettoyer(texte);
    return !!cible && SECTIONS.some(section => {
      const reference = nettoyer(section);
      return cible === reference
        || (cible.length >= 4 && reference.startsWith(cible))
        || (reference.length >= 4 && cible.startsWith(reference));
    });
  }

  /* Le panneau est la derniere bande de colonnes majoritairement claires. On
     part du bord droit parce que c'est la qu'il vit, quelle que soit la
     resolution. */
  function detecterPanneau(image){
    const { largeur, hauteur, estClair } = image;
    const pas = Math.max(1, Math.round(hauteur / 300));
    const parColonne = [];
    for(let x = 0; x < largeur; x += 2){
      let clairs = 0, total = 0;
      for(let y = 0; y < hauteur; y += pas){
        total++;
        if(estClair(x, y)) clairs++;
      }
      parColonne.push({ x, part:total ? clairs / total : 0 });
    }
    const SEUIL = 0.28;
    let fin = -1, debut = -1;
    for(let i = parColonne.length - 1; i >= 0; i--){
      if(parColonne[i].part >= SEUIL){
        if(fin < 0) fin = parColonne[i].x;
        debut = parColonne[i].x;
      }else if(fin >= 0 && parColonne[i].x < debut - 30) break;
    }
    if(fin < 0) return null;
    const lignes = [];
    for(let y = 0; y < hauteur; y++){
      let clairs = 0, total = 0;
      for(let x = debut; x <= fin; x += 3){
        total++;
        if(estClair(x, y)) clairs++;
      }
      if(total && clairs / total >= 0.5) lignes.push(y);
    }
    if(!lignes.length) return null;
    const haut = Math.min(...lignes);
    return { left:debut, top:haut, width:fin - debut,
      height:Math.max(...lignes) - haut };
  }

  /* Les valeurs sont les mots numeriques colles au bord droit du panneau. Leur
     x0 le plus a gauche donne la frontiere de la colonne — la deduire ainsi
     evite qu'un libelle long soit pris pour une valeur. */
  function seuilValeur(mots){
    const bordDroit = Math.max(...mots.map(m => m.bbox.x1));
    const valeurs = mots.filter(m =>
      EST_NOMBRE.test(String(m.text).trim()) && m.bbox.x1 >= bordDroit - 25);
    if(!valeurs.length) return bordDroit - 90;
    return Math.min(...valeurs.map(m => m.bbox.x0)) - 12;
  }

  function rangs(mots, tolerance){
    const sortie = [];
    mots.filter(m => String(m.text).trim())
      .sort((a, b) => a.bbox.y0 - b.bbox.y0)
      .forEach(mot => {
        const centre = (mot.bbox.y0 + mot.bbox.y1) / 2;
        let rang = sortie.find(r => Math.abs(r.y - centre) < tolerance);
        if(!rang){ rang = { y:centre, mots:[] }; sortie.push(rang); }
        rang.mots.push(mot);
        rang.y = (rang.y * (rang.mots.length - 1) + centre) / rang.mots.length;
      });
    sortie.sort((a, b) => a.y - b.y);
    sortie.forEach(r => r.mots.sort((a, b) => a.bbox.x0 - b.bbox.x0));
    return sortie;
  }

  /* Une stat est un bloc de libelle plus EXACTEMENT une valeur.

     Deux dispositions coexistent dans le jeu : la valeur sur la premiere ligne
     du libelle, ou la valeur apres une barre de progression sous le libelle. La
     presence de texte reel sur la ligne de la valeur les distingue.

     Ne pas revenir a une detection fondee sur les icones de debut de ligne :
     l'OCR les rate sur mobile, ce qui produisait un appariement faux et
     silencieux. */
  function extraireStats(mots){
    if(!Array.isArray(mots) || !mots.length) return [];
    const XV = seuilValeur(mots);
    const stats = [];
    let bloc = [], attente = null;
    const fermer = () => {
      if(bloc.length && attente){
        stats.push({ libelle:bloc.join(" "), valeur:attente });
      }
      bloc = []; attente = null;
    };
    for(const rang of rangs(mots, 14)){
      const gauche = rang.mots.filter(m => m.bbox.x1 <= XV)
        .map(m => m.text).join(" ").trim();
      const droite = rang.mots.filter(m => m.bbox.x1 > XV)
        .map(m => m.text).join("").trim();
      const valeur = EST_NOMBRE.test(droite) ? droite : null;
      const lettres = gauche.replace(/[^\p{L}]/gu, "").length;
      const texte = lettres > 3 ? gauche.replace(/^[^\p{L}]+/u, "").trim() : "";

      if(texte && estSection(texte)){ fermer(); continue; }
      if(texte && valeur){
        /* Un libelle deja commence sans valeur : cette ligne le termine et
           porte sa valeur. Fermer d'abord perdrait les lignes precedentes. */
        if(bloc.length && !attente){ bloc.push(texte); attente = valeur; fermer(); }
        else { fermer(); bloc = [texte]; attente = valeur; }
      }else if(texte){
        bloc.push(texte);
      }else if(valeur){
        if(!attente) attente = valeur;
        fermer();
      }
    }
    fermer();
    return stats;
  }

export { detecterPanneau, extraireStats, EST_NOMBRE };
```

- [ ] **Étape 4 : déclarer, exposer et inscrire**

Dans `tests/helpers/modules.js`, ajouter dans la couche `metier`, **avant**
`"metier/ocr-deduction.js"` :

```js
  /* Pur : ni DOM ni pixels. Le decodage d'image vit dans `vues`. */
  "metier/ocr-panneau.js",
```

Dans `tests/helpers/load-app.js`, ajouter à `HOOK_EXPORT` :

```js
  detecterPanneau:typeof detecterPanneau === "function"
    ? detecterPanneau
    : undefined,
  extraireStats:typeof extraireStats === "function"
    ? extraireStats
    : undefined,
```

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit`, **avant** les tests de
déduction :

```js
    "node tests/ocr-panneau.test.js",
```

- [ ] **Étape 5 : lancer les tests et vérifier qu'ils passent**

Commande : `node tests/ocr-panneau.test.js`
Attendu : `ocr-panneau : OK`

Commande : `node tests/modules-imports.test.js`
Attendu : succès.

- [ ] **Étape 6 : commiter**

```bash
git add js/metier/ocr-panneau.js tests/ocr-panneau.test.js \
        tests/helpers/modules.js tests/helpers/load-app.js scripts/lancer-tests.js
git commit -m "feat(ocr): detecter le panneau et en extraire les couples libelle-valeur"
```

---

### Tâche 6 : Le moteur OCR servi depuis le dépôt

**Fichiers :**
- Créer : `vendor/tesseract/` (worker, WASM, `fra.traineddata`)
- Créer : `vendor/tesseract/README.md`
- Créer : `tests/vendor-tesseract.test.js`
- Modifier : `scripts/lancer-tests.js`

**Interfaces :**
- Produit : les fichiers du moteur à des chemins stables, consommés par la
  tâche 7 :
  `vendor/tesseract/worker.min.js`, `vendor/tesseract/tesseract-core-lstm.wasm`,
  `vendor/tesseract/fra.traineddata.gz`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/vendor-tesseract.test.js` :

```js
"use strict";

/* Le moteur OCR doit etre servi depuis le depot.

   Un appel a un CDN casserait le mode hors ligne de la PWA et introduirait une
   dependance reseau au moment precis ou le membre travaille. Ce test existe
   pour qu'une mise a jour du moteur ne reintroduise pas un CDN par megarde. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const DOSSIER = path.join(RACINE, "vendor", "tesseract");

for(const fichier of ["worker.min.js", "tesseract-core-lstm.wasm",
  "fra.traineddata.gz"]){
  const chemin = path.join(DOSSIER, fichier);
  assert.ok(fs.existsSync(chemin), fichier + " doit etre versé dans vendor/tesseract/");
  assert.ok(fs.statSync(chemin).size > 1024, fichier + " ne doit pas etre vide");
}

/* Le worker ne doit pointer vers aucun hebergeur externe. */
const worker = fs.readFileSync(path.join(DOSSIER, "worker.min.js"), "utf8");
for(const hote of ["unpkg.com", "cdn.jsdelivr.net", "jsdelivr.net",
  "tessdata.projectnaptha.com"]){
  assert.ok(!worker.includes(hote),
    "le worker ne doit pas referencer " + hote);
}

console.log("vendor tesseract : OK");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/vendor-tesseract.test.js`
Attendu : échec sur `worker.min.js doit etre versé dans vendor/tesseract/`.

- [ ] **Étape 3 : verser le moteur**

```bash
mkdir -p vendor/tesseract
npm pack tesseract.js@7.0.0 --pack-destination /tmp/ocr
npm pack tesseract.js-core@latest --pack-destination /tmp/ocr
```

Extraire et copier :
- `tesseract.js/dist/worker.min.js` → `vendor/tesseract/worker.min.js`
- `tesseract.js-core/tesseract-core-lstm.wasm` →
  `vendor/tesseract/tesseract-core-lstm.wasm`
- `tesseract.js-core/tesseract-core-lstm.wasm.js` →
  `vendor/tesseract/tesseract-core-lstm.wasm.js`
- `tesseract.js/dist/tesseract.min.js` → `vendor/tesseract/tesseract.min.js`

Télécharger le modèle français (1,25 Mo) depuis le dépôt officiel
`tessdata_fast` et le placer en `vendor/tesseract/fra.traineddata.gz`.

Si le worker contient une référence à un CDN, la remplacer par un chemin
relatif `./vendor/tesseract/`.

Créer `vendor/tesseract/README.md` :

```markdown
# Moteur OCR embarqué

Fichiers repris tels quels de `tesseract.js` 7.0.0 et `tesseract.js-core`, plus
le modèle français `fra.traineddata` de `tessdata_fast`.

Ils sont versés dans le dépôt et non chargés depuis un CDN : la PWA doit rester
utilisable hors ligne, et `sw.js` déclare les CDN en `network-only`.

Environ 5 Mo au total. Volontairement **absents** de `CORE_ASSETS` : le moteur
est chargé au premier import de captures, puis mis en cache. Un membre qui
n'utilise jamais la fonction ne télécharge rien.

Pour mettre à jour : reprendre les mêmes fichiers d'une version plus récente et
relancer `node tests/vendor-tesseract.test.js`, qui vérifie qu'aucun CDN n'est
réintroduit.
```

- [ ] **Étape 4 : inscrire le test**

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit` :

```js
    "node tests/vendor-tesseract.test.js",
```

- [ ] **Étape 5 : lancer le test et vérifier qu'il passe**

Commande : `node tests/vendor-tesseract.test.js`
Attendu : `vendor tesseract : OK`

- [ ] **Étape 6 : commiter**

```bash
git add vendor/tesseract tests/vendor-tesseract.test.js scripts/lancer-tests.js
git commit -m "chore(ocr): verser le moteur tesseract dans le depot"
```

---

### Tâche 7 : Lecture d'une image et orchestration

**Fichiers :**
- Créer : `js/vues/import-captures.js`
- Créer : `tests/import-captures.playwright.js`
- Modifier : `tests/helpers/modules.js` (couche `vues`),
  `scripts/lancer-tests.js` (`SUITES.e2e`)

**Interfaces :**
- Consomme : `detecterPanneau`, `extraireStats` de `js/metier/ocr-panneau.js` ;
  `deduirePiece`, `deduireArme` de `js/metier/ocr-deduction.js`.
- Produit : `lireCapture(fichierImage)` qui rend
  `{ statut, stats, titre, niveau }`, et
  `analyserCaptures(fichiers, herosSlug, surProgression)` qui rend un tableau de
  `{ fichier, statut, candidats, choix }`.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/import-captures.playwright.js`. Il charge la page, remplace le
lecteur par un bouchon, et vérifie le comportement de l'orchestration :

```js
"use strict";

/* Le parcours d'import, avec la lecture d'image remplacee par un bouchon.

   On ne teste PAS l'OCR ici : il est couvert par les tests unitaires de
   `ocr-panneau`. On teste que rien n'est ecrit avant le clic final, ce qui est
   la propriete de surete de toute la fonctionnalite. */

const { demarrerServeur } = require("./helpers/serve");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

(async () => {
  const { url, arreter } = await demarrerServeur();
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  await page.goto(url);

  const resume = await page.evaluate(async () => {
    const module = await import("./js/vues/import-captures.js");
    /* Bouchon : deux captures deja « lues », dont une incoherente. */
    module.__remplacerLecteur(async fichier => fichier === "bonne"
      ? { statut:"ok", stats:[
          { libelle:"PV de l'équipement", valeur:"12 560" },
          { libelle:"Augmentation des soins reçus", valeur:"5.53%" }
        ], titre:"", niveau:null }
      : { statut:"panneau-introuvable", stats:[], titre:"", niveau:null });
    const lignes = await module.analyserCaptures(["bonne", "mauvaise"],
      "merlin", () => {});
    return lignes.map(l => l.statut);
  });

  assert.deepEqual(resume, ["unique", "echec"],
    "une capture illisible doit produire un echec, pas une devinette");

  await navigateur.close();
  await arreter();
  console.log("import-captures : OK");
})();
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/import-captures.playwright.js`
Attendu : échec sur le module `js/vues/import-captures.js` introuvable.

- [ ] **Étape 3 : écrire l'implémentation**

Créer `js/vues/import-captures.js` :

```js
/* L'import de builds depuis des captures d'ecran.

   Ce module tient les pixels et le worker OCR ; toute la logique testable vit
   dans `metier/ocr-panneau.js` et `metier/ocr-deduction.js`.

   Deux passes d'OCR, et ce n'est pas un luxe : la premiere lit le panneau
   entier pour les libelles, la seconde ne lit qu'une bande a droite, sans
   barre de progression ni libelle, pour les valeurs. Sans la seconde, deux
   valeurs sur six etaient perdues sur mobile. */

import { detecterPanneau, extraireStats } from "../metier/ocr-panneau.js";
import { deduirePiece, deduireArme } from "../metier/ocr-deduction.js";

  const MOTEUR = "./vendor/tesseract/";
  /* Sous cette largeur de panneau, la lecture s'effondre : une capture
     redimensionnee par une messagerie tombe dans ce cas. On previent avant de
     lancer l'OCR plutot que de rendre des chiffres faux. */
  const LARGEUR_MINIMALE = 400;

  let worker = null;
  async function moteur(){
    if(worker) return worker;
    const { createWorker } = await import(MOTEUR + "tesseract.min.js");
    worker = await createWorker("fra", 1, {
      workerPath:MOTEUR + "worker.min.js",
      corePath:MOTEUR,
      langPath:MOTEUR
    });
    return worker;
  }

  function pixels(image){
    const toile = document.createElement("canvas");
    toile.width = image.naturalWidth;
    toile.height = image.naturalHeight;
    toile.getContext("2d").drawImage(image, 0, 0);
    return toile.getContext("2d")
      .getImageData(0, 0, toile.width, toile.height).data;
  }

  async function chargerImage(fichier){
    const image = new Image();
    image.src = URL.createObjectURL(fichier);
    await image.decode();
    return image;
  }

  function motsDe(donnees){
    const mots = [];
    (donnees.blocks || []).forEach(bloc =>
      (bloc.paragraphs || []).forEach(paragraphe =>
        (paragraphe.lines || []).forEach(ligne =>
          (ligne.words || []).forEach(mot => mots.push(mot)))));
    return mots;
  }

  async function lireCaptureReelle(fichier){
    const image = await chargerImage(fichier);
    const data = pixels(image);
    const largeur = image.naturalWidth;
    const zone = detecterPanneau({
      largeur, hauteur:image.naturalHeight,
      estClair:(x, y) => {
        const i = (y * largeur + x) * 4;
        return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) > 195;
      }
    });
    if(!zone) return { statut:"panneau-introuvable", stats:[], titre:"", niveau:null };
    if(zone.width < LARGEUR_MINIMALE){
      return { statut:"resolution-insuffisante", stats:[], titre:"", niveau:null };
    }

    const ocr = await moteur();
    const plein = await ocr.recognize(fichier,
      { rectangle:{ left:zone.left, top:zone.top,
        width:zone.width, height:zone.height } }, { blocks:true });
    const mots = motsDe(plein.data);

    /* Seconde passe : la bande des valeurs, isolee des barres. */
    const bande = Math.round(zone.width * 0.30);
    await ocr.setParameters({ tessedit_char_whitelist:"0123456789.,%" });
    const droite = await ocr.recognize(fichier,
      { rectangle:{ left:zone.left + zone.width - bande, top:zone.top,
        width:bande, height:zone.height } }, { blocks:true });
    await ocr.setParameters({ tessedit_char_whitelist:"" });
    motsDe(droite.data).forEach(mot => mots.push(mot));

    /* Le bandeau, au-dessus du panneau clair : il porte le nom de l'arme et son
       niveau. Les bandes plus etroites que 22 % ne rendent que du bruit. */
    const hauteurBandeau = Math.min(zone.top, Math.round(zone.height * 0.30));
    const bandeau = await ocr.recognize(fichier,
      { rectangle:{ left:zone.left, top:zone.top - hauteurBandeau,
        width:zone.width, height:hauteurBandeau } });
    const lignes = bandeau.data.text.split("\n")
      .map(l => l.trim()).filter(l => l.length > 3);
    const titre = lignes.slice().sort((a, b) => b.length - a.length)[0] || "";
    const niveauLu = bandeau.data.text.match(/[Ll][vV]\s*[.,:]?\s*(\d{1,2})/);

    return { statut:"ok", stats:extraireStats(mots), titre,
      niveau:niveauLu ? Number(niveauLu[1]) : null };
  }

  /* Remplacable pour les tests : la lecture d'image est la seule partie qu'on
     ne peut pas exercer sans navigateur ni fichiers lourds. */
  let lireCapture = lireCaptureReelle;
  function __remplacerLecteur(faux){ lireCapture = faux; }

  async function analyserCaptures(fichiers, herosSlug, surProgression){
    const lignes = [];
    for(let i = 0; i < fichiers.length; i++){
      if(typeof surProgression === "function") surProgression(i, fichiers.length);
      const lue = await lireCapture(fichiers[i]);
      if(lue.statut !== "ok" || !lue.stats.length){
        lignes.push({ fichier:fichiers[i], statut:"echec",
          raison:lue.statut, candidats:[], choix:null });
        continue;
      }
      const deduite = lue.titre
        ? deduireArme({ stats:lue.stats, titre:lue.titre, niveau:lue.niveau })
        : deduirePiece({ stats:lue.stats, herosSlug });
      const resultat = deduite.statut === "aucun"
        ? deduirePiece({ stats:lue.stats, herosSlug }) : deduite;
      lignes.push({
        fichier:fichiers[i],
        statut:resultat.statut === "aucun" ? "echec" : resultat.statut,
        candidats:resultat.candidats,
        choix:resultat.statut === "unique" ? resultat.candidats[0] : null
      });
    }
    if(typeof surProgression === "function"){
      surProgression(fichiers.length, fichiers.length);
    }
    return lignes;
  }

export { lireCapture, analyserCaptures, __remplacerLecteur, LARGEUR_MINIMALE };
```

- [ ] **Étape 4 : déclarer et inscrire**

Dans `tests/helpers/modules.js`, ajouter à la fin de la couche `vues`, avant
`vues/routage.js` :

```js
  "vues/import-captures.js",
```

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.e2e` :

```js
    "node tests/import-captures.playwright.js",
```

- [ ] **Étape 5 : lancer le test et vérifier qu'il passe**

Commande : `node tests/import-captures.playwright.js`
Attendu : `import-captures : OK`

- [ ] **Étape 6 : commiter**

```bash
git add js/vues/import-captures.js tests/import-captures.playwright.js \
        tests/helpers/modules.js scripts/lancer-tests.js
git commit -m "feat(ocr): lire une capture et orchestrer l'analyse d'un heros"
```

---

### Tâche 8 : Le récapitulatif et l'écriture

**Fichiers :**
- Modifier : `js/vues/import-captures.js`
- Créer : `css/import-captures.css`
- Modifier : `index.html` (lien CSS), `sw.js` (`CORE_ASSETS`)
- Modifier : `js/vues/edition-build.js` (bouton d'ouverture)
- Modifier : `tests/import-captures.playwright.js`

**Interfaces :**
- Consomme : `analyserCaptures` de la tâche 7 ;
  `gearConfigStatus` de `js/metier/build-config.js` ; `ModalStack` de
  `js/vues/modal-stack.js`.
- Produit : `ouvrirImportCaptures({ herosSlug, build, surEnregistrement })`.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter à `tests/import-captures.playwright.js`, avant la fermeture :

```js
  /* La propriete de surete : rien ne part avant le clic final, et une ligne en
     echec ne touche a rien meme quand les autres sont enregistrees. */
  const ecritures = await page.evaluate(async () => {
    const module = await import("./js/vues/import-captures.js");
    const vues = [];
    module.__remplacerLecteur(async fichier => fichier === "bonne"
      ? { statut:"ok", stats:[
          { libelle:"PV de l'équipement", valeur:"12 560" },
          { libelle:"Augmentation des soins reçus", valeur:"5.53%" }
        ], titre:"", niveau:null }
      : { statut:"panneau-introuvable", stats:[], titre:"", niveau:null });
    await module.ouvrirImportCaptures({
      herosSlug:"merlin", build:{},
      surEnregistrement:configs => vues.push(configs)
    });
    await module.__analyserPourTest(["bonne", "mauvaise"]);
    const avant = vues.length;
    module.__enregistrerPourTest();
    return { avant, apres:vues.length,
      emplacements:vues.length ? Object.keys(vues[0]) : [] };
  });

  assert.equal(ecritures.avant, 0, "aucune ecriture avant le clic");
  assert.equal(ecritures.apres, 1, "une ecriture apres le clic");
  assert.deepEqual(ecritures.emplacements, ["belt"],
    "seule la ligne lue est ecrite, la ligne en echec est ignoree");
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Commande : `node tests/import-captures.playwright.js`
Attendu : échec sur `ouvrirImportCaptures` non exportée.

- [ ] **Étape 3 : écrire la vue**

Ajouter à `js/vues/import-captures.js` les imports nécessaires
(`ModalStack`, `el`, `gearConfigStatus`), puis une fonction
`ouvrirImportCaptures` qui :

1. ouvre une modale via `ModalStack` contenant un `<input type="file" multiple
   accept="image/*">` et une zone de dépôt ;
2. sur sélection, appelle `analyserCaptures` en alimentant une barre de
   progression ;
3. rend un tableau : une ligne par capture, avec l'emplacement, le nom de pièce,
   le niveau, le renforcement, l'état, et pour la valeur existante du build la
   mention de ce qui sera remplacé ;
4. pour une ligne `ambigu`, rend un `<select>` des candidats, sans présélection ;
5. signale les **conflits** : si deux lignes désignent le même emplacement, les
   deux restent visibles, aucune n'est présélectionnée, et le membre coche celle
   qu'il garde. Aucune n'est écrasée arbitrairement ;
6. n'active le bouton **Enregistrer** que s'il existe au moins une ligne dont
   `choix` est défini et qu'aucun conflit ne reste non tranché ;
7. au clic, appelle `enregistrer()` :

```js
  /* Le dernier verrou avant ecriture. `gearConfigStatus` est le juge de la
     saisie manuelle : une configuration deduite ne doit jamais entrer par une
     porte qu'une saisie a la main n'aurait pas franchie. */
  function enregistrer(){
    const parEmplacement = {};
    const conflits = new Set();
    for(const ligne of etatCourant.lignes){
      if(!ligne.choix) continue;
      const { fichier, slot } = ligne.choix;
      const config = {
        version:1,
        level:ligne.choix.level,
        reinforce:ligne.choix.reinforce,
        enchantments:ligne.choix.enchantments,
        passiveLevel:ligne.choix.passiveLevel === undefined
          ? null : ligne.choix.passiveLevel
      };
      if(gearConfigStatus(fichier, config) !== "valid") continue;
      if(owns(parEmplacement, slot)){ conflits.add(slot); continue; }
      parEmplacement[slot] = { fichier, config };
    }
    /* Un conflit non tranche n'ecrit rien pour cet emplacement : mieux vaut ne
       rien faire que choisir a la place du membre. */
    conflits.forEach(slot => { delete parEmplacement[slot]; });
    etatCourant.surEnregistrement(parEmplacement);
  }
```

Exposer pour les tests :

```js
  /* Points d'entree reserves aux tests : la modale n'a pas de DOM interrogeable
     dans le faux navigateur du chargeur `vm`. */
  let etatCourant = null;
  async function __analyserPourTest(fichiers){
    etatCourant.lignes = await analyserCaptures(
      fichiers, etatCourant.herosSlug, () => {});
    return etatCourant.lignes;
  }
  function __enregistrerPourTest(){ enregistrer(); }
```

Créer `css/import-captures.css` avec les styles de la modale, en suivant les
conventions de `css/modales.css`.

Ajouter dans `index.html`, avec les autres feuilles :

```html
  <link rel="stylesheet" href="./css/import-captures.css">
```

Ajouter dans `sw.js`, dans `CORE_ASSETS`, à la suite des autres CSS :

```js
  "./css/import-captures.css",
```

Dans `js/vues/edition-build.js`, ajouter le bouton près des actions de build :

```js
  /* Le bouton ne s'affiche que si le navigateur sait executer le moteur : mieux
     vaut le masquer que proposer une fonction qui echouera. */
  typeof WebAssembly === "object"
    ? el("button", { class:"btn", textContent:"Remplir depuis des captures",
        onclick:() => ouvrirImportCaptures({
          herosSlug:context.heroSlug, build:context.build,
          surEnregistrement:appliquerConfigsImportees }) })
    : null
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Commande : `node tests/import-captures.playwright.js`
Attendu : `import-captures : OK`

- [ ] **Étape 5 : lancer la suite complète**

Commande : `node scripts/lancer-tests.js unit`
Attendu : aucune panne.

Commande : `node tests/pwa.test.js`
Attendu : succès — il vérifie la cohérence de `CORE_ASSETS`.

- [ ] **Étape 6 : commiter**

```bash
git add js/vues/import-captures.js js/vues/edition-build.js \
        css/import-captures.css index.html sw.js \
        tests/import-captures.playwright.js
git commit -m "feat(ocr): recapituler l'import et n'ecrire qu'apres validation"
```

---

### Tâche 9 : Non-régression sur captures réelles

**Fichiers :**
- Créer : `tests/fixtures/ocr/` (deux captures entières, quatre recadrées)
- Créer : `tests/ocr-captures-reelles.test.js`
- Modifier : `scripts/lancer-tests.js`

**Interfaces :**
- Consomme : `detecterPanneau` et `extraireStats` de
  `js/metier/ocr-panneau.js`.

- [ ] **Étape 1 : préparer les images de référence**

Conserver **entières** une capture PC (1920x1080) et une mobile (2796x1290) :
elles seules exercent la détection du panneau à deux rapports d'image.

Recadrer les autres sur le panneau, ce qui divise le poids par six **sans
toucher à la résolution** — c'est la résolution qui compte, la lecture
s'effondre sous 0,6x.

- [ ] **Étape 2 : écrire le test**

Créer `tests/ocr-captures-reelles.test.js`, qui pour chaque image lance la
chaîne complète en Node (via `tesseract.js` depuis `vendor/`) et compare à la
sortie attendue, relevée à l'œil sur la capture :

```js
"use strict";

/* Non-regression sur de vraies captures.

   Les valeurs attendues ont ete relevees a l'oeil sur chaque image. Une capture
   PC et une mobile de la MEME piece doivent produire une sortie identique :
   c'est ce qui prouve que rien n'est cale sur une resolution particuliere. */

const ATTENDU = {
  "pc-armure-gravee.png":[
    { libelle:"PV de l'équipement", valeur:"21678" },
    { libelle:"Défense de l'équipement", valeur:"7759" },
    { libelle:"Attaque de Foudre", valeur:"1409" },
    { libelle:"Augmentation des dégâts, compétence normale", valeur:"10.80%" },
    { libelle:"Dégâts crit.", valeur:"12.42%" },
    { libelle:"Augmentation des dégâts, compétence normale", valeur:"17.66%" },
    { libelle:"Efficacité des dégâts sur la durée", valeur:"29.30%" },
    { libelle:"Chances crit.", valeur:"4.50%" }
  ]
};
```

Comparer les libellés après recalage, et les valeurs après conversion
numérique — pas les chaînes brutes, qui dépendent de la version du moteur.

- [ ] **Étape 3 : inscrire le test**

Dans `scripts/lancer-tests.js`, ajouter à `SUITES.unit` :

```js
    "node tests/ocr-captures-reelles.test.js",
```

- [ ] **Étape 4 : lancer la suite complète**

Commande : `node scripts/lancer-tests.js`
Attendu : aucune panne, unitaires et parcours navigateur.

- [ ] **Étape 5 : commiter**

```bash
git add tests/fixtures/ocr tests/ocr-captures-reelles.test.js scripts/lancer-tests.js
git commit -m "test(ocr): verrouiller la lecture sur des captures reelles"
```

---

## Points de vigilance pour l'exécutant

- **Ne jamais faire dépendre l'appariement des icônes de début de ligne.**
  L'OCR les rate sur mobile, ce qui produisait un appariement faux et
  silencieux — le seul mode d'échec réellement dangereux ici.
- **Ne jamais supprimer la seconde passe OCR** au motif qu'elle paraît
  redondante : sans elle, deux valeurs sur six sont perdues sur mobile.
- **Ne jamais retirer le filtre d'unité** du recalage : sans lui, sept paires
  de libellés homonymes produisent 4,3 % de faux silencieux.
- **`gearConfigStatus()` reste le dernier mot avant écriture.** L'import ne doit
  jamais écrire une configuration que la saisie manuelle refuserait.
- Ce qui **n'a pas été vérifié de bout en bout** : la chaîne complète sur une
  capture d'arme. Le bandeau et l'inversion ont été mesurés séparément, leur
  assemblage non. Le traiter comme le point le plus susceptible de surprendre.
