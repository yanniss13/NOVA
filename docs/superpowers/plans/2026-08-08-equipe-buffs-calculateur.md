# Buffs d'équipe réels dans le calculateur — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sur l'onglet Calculateur, choisir une équipe déjà enregistrée et ne voir que les buffs de ses membres, venant de l'arme que chacun a réellement équipée, avec les trois buffs indexés sur l'ATK chiffrés sur le build réel du support.

**Architecture:** Un module métier PUR (`js/metier/equipe-buffs.js`) filtre et chiffre ; la vue (`js/vues/calculateur.js`) fait les entrées/sorties — lire les équipes, appeler `calculateHeroStats` sur chaque membre, en extraire `B_Atk`. Le moteur de dégâts n'est pas touché. Le modèle d'équipe existe déjà et porte potentiel, arme et armure liée : rien à construire de ce côté.

**Tech Stack:** ES modules natifs (pas de bundler), `window.SEVEN_DS_*` pour les données, tests node via `vm` (`tests/helpers/load-app.js`), Playwright pour le bout en bout.

**Spec :** `docs/superpowers/specs/2026-08-08-equipe-buffs-calculateur-design.md`

## Global Constraints

- **Aucun chiffre existant ne doit bouger tant qu'aucune équipe n'est choisie.** « Aucune équipe » est le défaut et rend le comportement actuel à l'identique.
- **Français sans accents dans les commentaires de code et les messages de commit** ; les accents sont autorisés dans les chaînes affichées à l'écran et dans les fichiers Markdown.
- **`data/buffs-supports.js` est écrit à la main.** Aucun générateur ne le réécrit et aucun ne doit le citer.
- **Les pourcentages sont en dix-millièmes** dans tout le dépôt : `3000` vaut 30 %. Diviser par `10000` donne le rapport.
- **`weaponTypesOf(charId)` rend des DOSSIERS français** (`Epee 2 mains`), pas des enums. `FOLDER_TO_ENUM` convertit vers l'enum (`Sword2h`).
- **`modules-imports.test.js` refuse tout export mort** : un symbole exporté doit être importé quelque part. **C'est ce qui dicte le découpage ci-dessous** — chaque tâche livre son module ET son premier consommateur, sinon la suite est rouge au moment de commiter.
- **Tout nouveau module `js/` doit être déclaré dans `tests/helpers/modules.js`**, dans l'ordre des couches (une couche ne dépend jamais d'une couche plus bas dans la liste).
- Commandes : `npm run test:unit` (rapide), `npm run test:e2e` (Playwright), `npm test` (tout).

---

### Task 1: Écrire le taux dans la table des buffs

La table ne garde que le plafond (`valeur:3000`), donc le pourcentage est perdu et les trois buffs sont figés au maximum. On ajoute `indexeSurAtk` sans retirer `valeur`, qui reste le repli.

**Files:**
- Modify: `data/buffs-supports.js` — trois entrées, et l'en-tête documentaire
- Test: `tests/calculateur-entrees.test.js` (garde ajoutée)

**Interfaces:**
- Consumes: rien
- Produces: le champ `indexeSurAtk:{ taux, plafond }` sur les trois entrées portant `unite:"flat"`. Consommé par la Task 2.

- [ ] **Step 1: Écrire le test qui échoue**

À ajouter dans `tests/calculateur-entrees.test.js`, à l'intérieur de la boucle `tousLesBuffs.forEach(buff => { ... })` existante, juste après le bloc qui vérifie `stat` OU `effet` :

```js
  /* Un buff plat vaut un pourcentage de l'ATK de son lanceur, plafonne. La
     table gardait le seul plafond, donc le taux etait perdu et la valeur
     figee : `indexeSurAtk` le rend, et `valeur` reste le repli utilise quand
     l'ATK du support est inconnue.

     Le plafond et le repli DOIVENT rester egaux. S'ils divergeaient, le repli
     cesserait d'etre le chiffre d'avant sans que rien ne le signale. */
  if(buff.unite === "flat"){
    assert.ok(buff.indexeSurAtk,
      buff.id + " : un buff plat doit porter indexeSurAtk");
    assert.ok(Number.isFinite(buff.indexeSurAtk.taux)
      && buff.indexeSurAtk.taux > 0,
      buff.id + " : indexeSurAtk.taux doit etre un taux positif");
    assert.equal(buff.indexeSurAtk.plafond, buff.valeur,
      buff.id + " : le plafond et la valeur de repli doivent rester egaux");
  }else{
    assert.ok(!Object.prototype.hasOwnProperty.call(buff, "indexeSurAtk"),
      buff.id + " : indexeSurAtk n'a de sens que sur un buff plat");
  }
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
node tests/calculateur-entrees.test.js
```

Attendu : ÉCHEC sur `derieri-taillade-attaque-feu : un buff plat doit porter indexeSurAtk`.

- [ ] **Step 3: Ajouter le champ aux trois entrées**

Dans `data/buffs-supports.js`, entrée `derieri-taillade-attaque-feu` — ajouter la ligne juste après `unite:"flat",` :

```js
      indexeSurAtk:{ taux:3000, plafond:3000 },
```

Entrée `elizabeth-vague-attaque-vent`, même place, même valeur :

```js
      indexeSurAtk:{ taux:3000, plafond:3000 },
```

Entrée `gowther-confusion-attaque-foudre`, même place — **le taux vaut 10 %, pas 30 %** :

```js
      indexeSurAtk:{ taux:1000, plafond:3000 },
```

- [ ] **Step 4: Documenter le champ dans l'en-tête**

Dans le bloc de commentaires en tête de `data/buffs-supports.js`, juste après la ligne décrivant `unite`, insérer :

```
// indexeSurAtk : present UNIQUEMENT sur les buffs plats, qui valent un
//             pourcentage de l'ATK de leur LANCEUR, plafonne. `taux` est ce
//             pourcentage en dix-milliemes, `plafond` la borne publiee.
//             `valeur` reste le plafond : c'est le repli servi quand l'ATK du
//             support est inconnue - sans equipe choisie, ou build incomplet.
//             Un test refuse que `plafond` et `valeur` divergent.
```

- [ ] **Step 5: Lancer le test pour le voir passer**

```bash
node tests/calculateur-entrees.test.js
```

Attendu : `calculateur-entrees.test.js OK (24 buffs sur 8 supports)`.

- [ ] **Step 6: Vérifier qu'aucun chiffre n'a bougé**

```bash
npm run test:unit
```

Attendu : tout passe. `valeur` étant inchangée, aucun calcul existant ne peut avoir changé.

- [ ] **Step 7: Commit**

```bash
git add data/buffs-supports.js tests/calculateur-entrees.test.js
git commit -m "feat: ecrire le taux des trois buffs indexes sur l'ATK du lanceur

Trois buffs valent un pourcentage de l'attaque de celui qui les lance,
plafonne a 3000. La table ne gardait que le plafond, donc le taux etait
perdu et la valeur figee au maximum, que le support puisse l'atteindre ou
non.

indexeSurAtk porte desormais le taux et le plafond. \`valeur\` ne bouge pas :
elle reste le repli servi quand l'ATK du support est inconnue, donc aucun
chiffre affiche aujourd'hui ne change. Un test refuse que le plafond et ce
repli divergent - sinon le repli cesserait d'etre le chiffre d'avant sans
que rien ne le signale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Le module pur, branché à vide

Le module est écrit ET consommé dans la même tâche, avec `coequipiers:null` — donc à comportement strictement inchangé. C'est nécessaire : `modules-imports.test.js` refuse un export sans consommateur, et c'est aussi ce qui rend la tâche vérifiable seule.

**Files:**
- Create: `js/metier/equipe-buffs.js`
- Create: `tests/equipe-buffs.test.js`
- Modify: `tests/helpers/modules.js` — déclarer le module
- Modify: `tests/helpers/load-app.js` — exposer `buffsDeLEquipe`
- Modify: `js/vues/calculateur.js` — appeler le module avec `coequipiers:null`
- Modify: `package.json` — brancher le test

**Interfaces:**
- Consumes: `buffsApplicables(element)` de `js/metier/calculateur-entrees.js`, qui rend des buffs copiés et annotés de `{ support }`. `FOLDER_TO_ENUM` de `js/noyau/constantes.js`.
- Produces: `buffsDeLEquipe({ element, coequipiers })` → tableau. Chaque élément est une copie du buff, plus `support` (déjà présent), `arme` (dossier français, ou `null` sans équipe) et `repli` (booléen). `coequipiers` vaut `null` pour « aucune équipe », sinon un tableau de `{ charId, typeArme, atk }` où `atk` est un nombre ou `null`. Consommé par la Task 3.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `tests/equipe-buffs.test.js` :

```js
"use strict";

/* Le filtre d'equipe : qui buffe, avec quelle arme, et pour combien.

   Ces tests portent sur le module PUR. Ils ne lisent ni roster, ni Supabase,
   ni DOM : la vue fait cette corvee et lui passe des coequipiers deja reduits
   a { charId, typeArme, atk }. */

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { buffsApplicables, buffsDeLEquipe } = hooks;

assert.equal(typeof buffsDeLEquipe, "function",
  "buffsDeLEquipe doit etre expose par le chargeur de tests");

/* Daisy porte des buffs de Livre ET de Baguette. C'est le cas qui motive tout
   ce chantier : elle n'en tient qu'une a la fois. */
const DAISY_LIVRE = { charId:"daisy", typeArme:"Livre", atk:null };
const DAISY_BAGUETTE = { charId:"daisy", typeArme:"Baguette", atk:null };

const idsDe = liste => liste.map(buff => buff.id).sort();

/* Sans equipe, la liste est celle d'avant ce module, a l'identique. C'est le
   test qui garantit qu'aucun chiffre ne bouge par defaut. */
{
  const attendu = idsDe(buffsApplicables("thunder"));
  const obtenu = idsDe(buffsDeLEquipe({ element:"thunder", coequipiers:null }));
  assert.deepEqual(obtenu, attendu,
    "sans equipe, la liste doit rester celle de buffsApplicables");
}

/* Un buff venu d'une arme NON equipee disparait. */
{
  const livre = buffsDeLEquipe({
    element:"thunder", coequipiers:[DAISY_LIVRE]
  });
  const baguette = buffsDeLEquipe({
    element:"thunder", coequipiers:[DAISY_BAGUETTE]
  });

  assert.ok(livre.length > 0, "Daisy au Livre doit apporter des buffs");
  assert.ok(baguette.length > 0, "Daisy a la Baguette doit apporter des buffs");
  assert.notDeepEqual(idsDe(livre), idsDe(baguette),
    "les deux armes de Daisy ne doivent pas rendre la meme liste");

  livre.forEach(buff => assert.ok(
    buff.provenance.gameId.includes("_book_"),
    buff.id + " : ne vient pas du Livre alors que c'est l'arme equipee"
  ));
  livre.forEach(buff => assert.equal(buff.arme, "Livre",
    buff.id + " : doit etre annote de l'arme d'ou il vient"));
}

/* Le filtre par element continue de s'appliquer PAR-DESSUS celui par arme :
   la charge electrique de Daisy ne vaut que pour un build Foudre. */
{
  const foudre = buffsDeLEquipe({
    element:"thunder", coequipiers:[DAISY_LIVRE]
  });
  const feu = buffsDeLEquipe({
    element:"fire", coequipiers:[DAISY_LIVRE]
  });
  assert.ok(foudre.length > feu.length,
    "un build Foudre doit voir plus de buffs de Daisy qu'un build Feu");
}

/* Un coequipier hors table n'apporte rien, et ne casse rien. */
{
  const rien = buffsDeLEquipe({
    element:"dark",
    coequipiers:[{ charId:"meliodas", typeArme:"Epee 1 main", atk:12000 }]
  });
  assert.deepEqual(rien, [],
    "un personnage sans buff modelise ne doit rien apporter");
}

/* Les QUATRE sieges comptent, et l'ordre de l'equipe est conserve : le membre
   lit son equipe telle qu'il l'a composee, pas dans l'ordre du catalogue. */
{
  const equipe = buffsDeLEquipe({
    element:"thunder",
    coequipiers:[
      { charId:"gowther", typeArme:"Livre", atk:null },
      DAISY_LIVRE
    ]
  });
  const supports = [...new Set(equipe.map(buff => buff.support))];
  assert.deepEqual(supports, ["gowther", "daisy"],
    "l'ordre des sieges de l'equipe doit etre conserve");
}

/* Le buff indexe sur l'ATK : chiffre, ecrete, et repli. */
{
  const surCible = atk => buffsDeLEquipe({
    element:"thunder",
    coequipiers:[{ charId:"gowther", typeArme:"Baguette", atk }]
  }).find(buff => buff.id === "gowther-confusion-attaque-foudre");

  /* 10 % de 20 000 = 2000, sous le plafond de 3000. */
  const sousLePlafond = surCible(20000);
  assert.ok(sousLePlafond, "le buff indexe doit etre present a la Baguette");
  assert.equal(sousLePlafond.valeur, 2000, "10 % de 20 000 d'ATK valent 2000");
  assert.equal(sousLePlafond.repli, false,
    "une valeur calculee n'est pas un repli");

  /* 10 % de 50 000 = 5000, ecrete au plafond publie. */
  assert.equal(surCible(50000).valeur, 3000,
    "la valeur doit etre ecretee au plafond de 3000");

  /* Build illisible : on rend le plafond, et on le DIT. */
  const repli = surCible(null);
  assert.equal(repli.valeur, 3000,
    "sans ATK connue, le repli est le plafond - le chiffre d'avant");
  assert.equal(repli.repli, true,
    "un repli doit etre signale, pour que la vue ne le presente pas comme un calcul");

  /* Une ATK nulle est un build illisible, pas un buff nul. */
  assert.equal(surCible(0).repli, true, "une ATK nulle vaut build illisible");
}

/* Un buff NON indexe garde sa valeur, quelle que soit l'ATK du support. */
{
  buffsDeLEquipe({
    element:"thunder",
    coequipiers:[{ charId:"daisy", typeArme:"Livre", atk:99999 }]
  }).filter(buff => buff.unite !== "flat").forEach(buff => {
    assert.equal(buff.repli, false,
      buff.id + " : un buff a valeur fixe n'est jamais un repli");
  });
}

console.log("equipe-buffs.test.js OK");
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

```bash
node tests/equipe-buffs.test.js
```

Attendu : ÉCHEC sur `buffsDeLEquipe doit etre expose par le chargeur de tests`.

- [ ] **Step 3: Écrire le module**

Créer `js/metier/equipe-buffs.js` :

```js
/* Les buffs qu'une EQUIPE apporte reellement.

   Sans equipe, le calculateur propose tous les buffs du catalogue, toutes
   armes confondues : cocher Daisy offre ses buffs de Livre ET de Baguette,
   alors qu'elle n'en tient qu'une. Six des huit supports sont dans ce cas.

   Module PUR : ni DOM, ni reseau, ni roster. La vue lui passe des coequipiers
   deja reduits a { charId, typeArme, atk } ; c'est elle qui appelle
   calculateHeroStats et en extrait B_Atk. */

import { FOLDER_TO_ENUM } from "../noyau/constantes.js";
import { buffsApplicables } from "./calculateur-entrees.js";

  const DIX_MILLIEMES = 10000;

  /* Le buff vient-il de l'arme equipee ?

     On ne cherche PAS quelle arme le gameId nomme : on verifie qu'il contient
     le jeton de l'arme equipee. Le sens compte, parce qu'un gameId s'ecrit
     <slug>_<arme>_<reste> et que le slug peut lui-meme contenir un tiret bas -
     `gil_thunder_lance_jumpatk` piegerait tout decoupage par position.

     Le roster range les armes par DOSSIER francais ; FOLDER_TO_ENUM donne
     l'enum, et le jeton est cet enum en minuscules, encadre de tirets bas. */
  function vientDeLArme(gameId, typeArme){
    const enumArme = FOLDER_TO_ENUM[typeArme];
    if(!enumArme) return false;
    return String(gameId || "").toLowerCase()
      .includes("_" + enumArme.toLowerCase() + "_");
  }

  /* La valeur effective d'un buff, et si elle est un repli.

     Trois buffs valent un pourcentage de l'ATK de leur LANCEUR, plafonne. Sans
     equipe, ou quand le build du support n'est pas lisible, on rend `valeur` -
     c'est-a-dire le plafond, donc exactement le chiffre d'avant ce module.

     HYPOTHESE, non mesuree : « 30 % de l'attaque du heros » est lu comme la
     seule ATK, sans l'attaque elementaire. Le moteur de degats, lui, ajoute
     l'attaque elementaire a l'ATK pour les composantes de base `atk` : les deux
     lectures ne coincident pas, et rien ne dit laquelle le jeu applique ici.
     La vue passe B_Atk. */
  function chiffre(buff, membre){
    const indexe = buff.indexeSurAtk;
    const atk = membre ? Number(membre.atk) : NaN;
    const chiffrable = Boolean(indexe) && Number.isFinite(atk) && atk > 0;
    return Object.assign({}, buff, {
      arme:membre ? membre.typeArme : null,
      valeur:chiffrable
        ? Math.min(indexe.plafond, Math.round(indexe.taux * atk / DIX_MILLIEMES))
        : buff.valeur,
      repli:Boolean(indexe) && !chiffrable
    });
  }

  /* `coequipiers` a null vaut « aucune equipe » et rend la liste complete,
     telle qu'avant ce module. C'est ce qui garantit qu'aucun chiffre ne bouge
     tant que le membre n'a choisi aucune equipe.

     L'ordre suit les SIEGES de l'equipe, pas l'ordre alphabetique du
     catalogue : le membre lit son equipe telle qu'il l'a composee. */
  function buffsDeLEquipe(entree){
    const source = entree || {};
    const disponibles = buffsApplicables(source.element);
    const equipe = Array.isArray(source.coequipiers)
      ? source.coequipiers : null;
    if(!equipe) return disponibles.map(buff => chiffre(buff, null));
    return equipe.flatMap(membre => disponibles
      .filter(buff => buff.support === (membre && membre.charId)
        && vientDeLArme(
          buff.provenance && buff.provenance.gameId, membre && membre.typeArme
        ))
      .map(buff => chiffre(buff, membre)));
  }

export { buffsDeLEquipe };
```

- [ ] **Step 4: Déclarer le module au chargeur de tests**

Dans `tests/helpers/modules.js`, ajouter `"metier/equipe-buffs.js"` **juste après** `"metier/calculateur-entrees.js"` — l'ordre suit les couches, et ce module importe celui-là.

- [ ] **Step 5: Exposer la fonction aux tests**

Dans `tests/helpers/load-app.js`, à côté de l'entrée `buffsApplicables` existante, ajouter :

```js
  buffsDeLEquipe:typeof buffsDeLEquipe === "function"
    ? buffsDeLEquipe
    : undefined,
```

- [ ] **Step 6: Brancher le module dans la vue, à vide**

Dans `js/vues/calculateur.js`, ajouter aux imports :

```js
import { buffsDeLEquipe } from "../metier/equipe-buffs.js";
```

Puis, dans `sectionSoutiens`, remplacer :

```js
    const dispo = buffsApplicables(element);
```

par :

```js
    /* `coequipiers` reste null tant qu'aucune equipe n'est choisissable : la
       liste est alors celle d'avant, a l'identique. */
    const dispo = buffsDeLEquipe({ element, coequipiers:null });
```

- [ ] **Step 7: Brancher le test dans npm**

Dans `package.json`, ajouter `&& node tests/equipe-buffs.test.js` **juste après** `node tests/calculateur-entrees.test.js`, dans `test` ET dans `test:unit`.

- [ ] **Step 8: Lancer les tests**

```bash
node tests/equipe-buffs.test.js && npm run test:unit && node tests/calculateur.playwright.js
```

Attendu : tout passe. `modules-imports.test.js` compris — `buffsDeLEquipe` a maintenant un consommateur. Le Playwright doit passer sans modification : le comportement est identique.

- [ ] **Step 9: Commit**

```bash
git add js/metier/equipe-buffs.js js/vues/calculateur.js tests/equipe-buffs.test.js tests/helpers/modules.js tests/helpers/load-app.js package.json
git commit -m "feat: filtrer et chiffrer les buffs selon l'equipe, module pur

Le calculateur propose tous les buffs du catalogue, toutes armes confondues :
cocher Daisy offre ses buffs de Livre ET de Baguette alors qu'elle n'en tient
qu'une. Six des huit supports portent des buffs venant de plusieurs armes.

buffsDeLEquipe() ne retient que les buffs des membres de l'equipe, et
seulement ceux de l'arme equipee. Le rattachement ne decoupe pas le gameId par
position - \`gil_thunder_lance_jumpatk\` piegerait tout decoupage, le slug
contenant deja un tiret bas : on verifie que le gameId contient le jeton de
l'arme equipee, obtenu par FOLDER_TO_ENUM.

Les trois buffs indexes sur l'ATK du lanceur sont chiffres sur cette ATK et
ecretes au plafond. Sans equipe, ou build illisible, la valeur reste le
plafond - le chiffre d'avant - et le repli est signale pour que la vue ne le
presente pas comme un calcul.

La vue l'appelle deja, avec coequipiers a null : comportement strictement
inchange, mais l'export a son consommateur et la fonction est couverte de
bout en bout des maintenant.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Le choix d'équipe dans la vue

La mémorisation est repliée dans cette tâche : son seul consommateur est le sélecteur, et un relecteur ne pourrait pas accepter l'un en refusant l'autre.

**Files:**
- Create: `js/donnees/equipe-choisie-store.js`
- Modify: `js/noyau/constantes.js` — nouvelle clé de stockage
- Modify: `tests/helpers/modules.js` — déclarer le store
- Modify: `js/vues/calculateur.js` — état, sélecteur, coéquipiers, affichage
- Modify: `tests/calculateur.playwright.js` — bout en bout

**Interfaces:**
- Consumes: `buffsDeLEquipe({ element, coequipiers })` (Task 2), `Store` de `js/donnees/equipes-store.js`, `calculateHeroStats` et `groupBuildStatResults` de `js/metier/stats-calcul.js` — déjà importés par la vue pour `basesDuBuild`.
- Produces: rien pour d'autres tâches.

- [ ] **Step 1: Ajouter la clé de stockage**

Dans `js/noyau/constantes.js`, à côté de `CALIBRATION_KEY` :

```js
  const EQUIPE_CHOISIE_KEY = "confrerie7ds.calculateur.equipe";
```

Et l'ajouter à la liste `export { ... }`, juste après `CALIBRATION_KEY`.

- [ ] **Step 2: Écrire le store**

Créer `js/donnees/equipe-choisie-store.js` :

```js
/* L'equipe que le calculateur regarde, retenue sur l'appareil.

   LOCALE, et volontairement pas synchronisee : ce n'est pas une donnee de
   confrerie mais un reglage d'ecran. Les EQUIPES, elles, vivent deja dans
   EquipesStore et se synchronisent - on ne retient ici que LAQUELLE est
   regardee.

   Aucun repli : `null` signifie « aucune equipe », qui est un choix valide et
   le defaut de la page. Rendre un identifiant de repli ferait regarder une
   equipe que le membre n'a pas choisie. */

import { EQUIPE_CHOISIE_KEY } from "../noyau/constantes.js";

  const EquipeChoisieStore = {
    get(){
      try{
        const brut = localStorage.getItem(EQUIPE_CHOISIE_KEY);
        return typeof brut === "string" && brut ? brut : null;
      }catch(erreur){
        /* Un stockage illisible ne doit pas condamner l'onglet : la page
           retombe sur « aucune equipe », donc sur son comportement d'avant. */
        return null;
      }
    },
    /* `set(null)` efface. Une seule porte pour poser et retirer : un `clear()`
       separe serait un export de plus a garder vivant. */
    set(id){
      const valeur = typeof id === "string" && id ? id : null;
      try{
        if(valeur) localStorage.setItem(EQUIPE_CHOISIE_KEY, valeur);
        else localStorage.removeItem(EQUIPE_CHOISIE_KEY);
      }catch(erreur){
        /* Stockage plein ou refuse : le choix vaut pour la session et ne
           survivra pas au rechargement. Mieux que de jeter. */
      }
      return valeur;
    }
  };

export { EquipeChoisieStore };
```

- [ ] **Step 3: Déclarer le store au chargeur de tests**

Dans `tests/helpers/modules.js`, ajouter `"donnees/equipe-choisie-store.js"` **juste après** `"donnees/equipes-store.js"`.

- [ ] **Step 4: Importer dans la vue et tenir l'état**

Dans `js/vues/calculateur.js`, ajouter aux imports :

```js
import { EquipeChoisieStore } from "../donnees/equipe-choisie-store.js";
import { Store as EquipesStore } from "../donnees/equipes-store.js";
```

Dans l'objet `etat`, ajouter :

```js
    /* Restauree du stockage : le membre retrouve son equipe a la visite
       suivante. `null` vaut « aucune equipe », qui reste le defaut. */
    equipeId:EquipeChoisieStore.get(),
```

- [ ] **Step 5: Lire les coéquipiers**

Ajouter dans `js/vues/calculateur.js`, à côté de `basesDuBuild` :

```js
  /* Les equipes lisibles ici et maintenant. Hors ligne ou deconnecte, le store
     rend ce qu'il a en cache : mieux vaut une liste ancienne qu'un onglet
     vide. */
  function equipesDisponibles(){
    const liste = EquipesStore.all();
    return Array.isArray(liste) ? liste : [];
  }

  function equipeCourante(){
    if(!etat.equipeId) return null;
    return equipesDisponibles().find(equipe => equipe.id === etat.equipeId)
      || null;
  }

  /* L'ATK d'un membre d'equipe, ou null si son build n'est pas exploitable.

     Un heros d'equipe a EXACTEMENT la forme qu'attend calculateHeroStats -
     c'est normalizeHero qui la produit, pour le roster comme pour l'equipe -
     donc aucune conversion n'est necessaire ici. Potentiel, arme et armure
     gravee entrent donc dans ce chiffre sans travail supplementaire. */
  function atkDuMembre(heros){
    if(!heros || !heros.char) return null;
    const result = calculateHeroStats(heros);
    if(result.status !== "valid" && result.status !== "partial") return null;
    const trouve = groupBuildStatResults(result)
      .flatMap(groupe => groupe.stats)
      .find(stat => stat.stat === "B_Atk");
    return trouve && Number.isFinite(trouve.value) ? trouve.value : null;
  }

  /* Les coequipiers reduits a ce dont le module pur a besoin. Les QUATRE
     sieges comptent, le heros calcule compris : le jeu dit « tous les heros
     allies », et ses passifs ne sont pas deja dans ses stats. */
  function coequipiersDeLEquipe(){
    const equipe = equipeCourante();
    if(!equipe) return null;
    return (equipe.heroes || [])
      .filter(heros => heros && heros.char)
      .map(heros => ({
        charId:heros.char,
        typeArme:heros.activeWeaponType,
        atk:atkDuMembre(heros)
      }));
  }
```

- [ ] **Step 6: Écrire le sélecteur**

Ajouter dans `js/vues/calculateur.js`, juste après `selecteurCible` :

```js
  function selecteurEquipe(redessiner){
    const choix = el("select",{
      class:"calc-equipe",
      onchange:event => {
        etat.equipeId = EquipeChoisieStore.set(event.target.value || null);
        /* Changer d'equipe change les buffs PROPOSES : ceux qui etaient coches
           et ne le sont plus n'ont plus de sens. */
        etat.coches.clear();
        redessiner();
      }
    });
    const aucune = el("option",{ value:"", text:"Aucune équipe" });
    aucune.selected = !etat.equipeId;
    choix.appendChild(aucune);
    equipesDisponibles().forEach((equipe, index) => {
      const option = el("option",{
        value:equipe.id,
        text:equipe.name || "Équipe " + (index + 1)
      });
      option.selected = equipe.id === etat.equipeId;
      choix.appendChild(option);
    });
    return el("div",{class:"calc-champ"},[
      el("label",{text:"Équipe"}), choix
    ]);
  }
```

- [ ] **Step 7: Dessiner le sélecteur aux deux endroits**

`selecteurCible(...)` est rendu à **deux** endroits — lignes ~585 et ~626.

Ligne 585, remplacer :

```js
    bloc.appendChild(selecteurCible(redessiner));
```

par :

```js
    bloc.appendChild(selecteurCible(redessiner));
    bloc.appendChild(selecteurEquipe(redessiner));
```

Ligne 626, remplacer :

```js
        selecteurCible(dessiner)
```

par :

```js
        selecteurCible(dessiner),
        selecteurEquipe(dessiner)
```

- [ ] **Step 8: Brancher les coéquipiers**

Dans `sectionSoutiens`, remplacer les deux lignes posées à la Task 2 :

```js
    /* `coequipiers` reste null tant qu'aucune equipe n'est choisissable : la
       liste est alors celle d'avant, a l'identique. */
    const dispo = buffsDeLEquipe({ element, coequipiers:null });
```

par :

```js
    const coequipiers = coequipiersDeLEquipe();
    const dispo = buffsDeLEquipe({ element, coequipiers });
```

Puis remplacer le message affiché quand `dispo` est vide :

```js
    if(!dispo.length){
      section.appendChild(el("p",{class:"calc-muette",
        text:coequipiers
          ? "Aucun membre de cette équipe n'apporte de buff modélisé "
            + "pour l'élément de ce build."
          : "Aucun buff connu ne s'applique à l'élément de ce build."}));
      return section;
    }
```

- [ ] **Step 9: Nommer l'arme sur l'EN-TÊTE, pas sur chaque ligne**

Les buffs sont déjà regroupés par soutien, et le commentaire en place dit pourquoi : en liste plate, le nom se répétait sur chacune des vingt-quatre lignes. Mettre la provenance sur chaque buff annulerait ce regroupement. Elle va donc sur l'en-tête — et c'est exact, puisqu'avec une équipe tous les buffs d'un soutien viennent de la même arme.

Remplacer :

```js
      bloc.appendChild(el("h4",{class:"calc-soutien-nom", text:nomDuSoutien(slug)}));
```

par :

```js
      /* L'arme sur l'EN-TETE, jamais sur chaque ligne : les buffs sont
         regroupes par soutien precisement pour ne pas repeter son nom
         vingt-quatre fois, et avec une equipe ils viennent tous de la meme
         arme. */
      const armeDuGroupe = buffs.find(buff => buff.arme);
      bloc.appendChild(el("h4",{class:"calc-soutien-nom",
        text:armeDuGroupe
          ? nomDuSoutien(slug) + " · " + armeDuGroupe.arme
          : nomDuSoutien(slug)}));
```

Puis, pour signaler un repli, remplacer :

```js
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:buff.libelle})
        ]));
```

par :

```js
        bloc.appendChild(el("label",{class:"calc-buff"},[
          caseACocher,
          el("span",{text:buff.libelle})
        ]));
        /* Le repli est DIT : sans cette ligne, un plafond servi faute de build
           lisible se lirait comme une valeur mesuree. */
        if(buff.repli){
          bloc.appendChild(el("p",{class:"calc-muette",
            text:"Build du coéquipier incomplet — valeur plafond."}));
        }
```

- [ ] **Step 10: Lister les coéquipiers sans buff modélisé**

Toujours dans `sectionSoutiens`, juste avant `return section;` (la ligne qui suit `section.appendChild(grilleSoutiens);`), ajouter :

```js
    /* Un coequipier sans buff modelise garde une ligne. Le taire le ferait
       lire comme absent de l'equipe ; le chiffrer a zero le ferait lire comme
       inutile. C'est la meme regle qu'une competence sans coefficient. */
    if(coequipiers){
      const muets = coequipiers
        .filter(membre => !dispo.some(buff => buff.support === membre.charId))
        .map(membre => nomDuSoutien(membre.charId));
      if(muets.length){
        section.appendChild(el("p",{class:"calc-muette",
          text:"Aucun buff modélisé : " + muets.join(", ") + "."}));
      }
    }
```

- [ ] **Step 11: Écrire le test de bout en bout**

Dans `tests/calculateur.playwright.js`, ajouter avant l'assertion finale.

**Localiser par LIBELLÉ, jamais par index** : un `.calc-champ` ajouté décale tout locator positionnel, piège déjà rencontré sur ce fichier.

```js
  /* Le choix d'equipe existe et vaut « Aucune equipe » par defaut : c'est ce
     qui garantit qu'aucun chiffre ne bouge tant que le membre n'a rien
     touche. */
  const choixEquipe = page.locator(".calc-champ", { hasText:"Équipe" })
    .locator("select");
  await choixEquipe.waitFor();
  assert.equal(await choixEquipe.inputValue(), "",
    "le calculateur doit demarrer sans equipe");

  const soutiensAvant = await page.locator(".calc-soutien").count();

  if(await choixEquipe.locator("option").count() > 1){
    await choixEquipe.selectOption({ index:1 });
    const soutiensApres = await page.locator(".calc-soutien").count();
    assert.ok(soutiensApres <= soutiensAvant,
      "choisir une equipe ne doit jamais AJOUTER de soutiens, recu "
        + soutiensApres + " apres " + soutiensAvant);

    /* Revenir a « Aucune equipe » doit restaurer la liste complete. */
    await choixEquipe.selectOption("");
    assert.equal(await page.locator(".calc-soutien").count(), soutiensAvant,
      "revenir a « Aucune equipe » doit restaurer la liste complete");
  }
```

- [ ] **Step 12: Lancer les tests**

```bash
npm run test:unit && node tests/calculateur.playwright.js
```

Attendu : tout passe, `modules-imports.test.js` compris.

- [ ] **Step 13: Commit**

```bash
git add js/vues/calculateur.js js/donnees/equipe-choisie-store.js js/noyau/constantes.js tests/helpers/modules.js tests/calculateur.playwright.js
git commit -m "feat: choisir une equipe et n'en compter que ses buffs

Le bloc des soutiens proposait les buffs de tous les supports du catalogue,
toutes armes confondues. Choisir une equipe deja enregistree le reduit a ses
membres, et a la seule arme que chacun a equipee.

Rien n'est coche a la place du membre : l'equipe decide de ce qui est PROPOSE,
jamais de ce qui est applique. La plupart de ces buffs durent de 5 a 40
secondes et demandent une action du coequipier ; les appliquer d'office
annoncerait des degats qu'on n'obtient qu'en alignant tout au meme instant.

« Aucune equipe » reste le defaut et rend le comportement d'avant a
l'identique. Le choix est retenu sur l'appareil - les equipes, elles, vivaient
deja dans EquipesStore et se synchronisent : on ne memorise ici que LAQUELLE
est regardee.

Un membre d'equipe a exactement la forme qu'attend calculateHeroStats, donc
son ATK reelle se lit sans conversion, potentiel, arme et armure gravee
compris. L'arme s'affiche sur l'en-tete du soutien et non sur chaque ligne :
les buffs sont regroupes precisement pour ne pas repeter ce nom. Un coequipier
sans buff modelise garde une ligne le disant, plutot que de disparaitre.

Le test de bout en bout localise le champ par son LIBELLE : un .calc-champ de
plus decalerait tout reperage par index, piege deja rencontre sur ce fichier.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 14: Suite complète avant de pousser**

```bash
npm test
```

Attendu : tout passe. Deux tests sont connus pour être instables — `supabase-etape1.playwright.js` et `accessibilite-mobile.playwright.js` — les relancer avant de conclure à une régression.

---

## Ce que ce plan ne fait PAS

Écrit ici pour qu'aucune tâche ne dérive :

- **Les passifs de tenue gravée.** Dix-neuf tenues buffent l'équipe, la plupart sous condition, et beaucoup sont défensives donc écartées par la règle déjà posée. Chantier de transcription distinct.
- **Les cinq buffs restreints à une catégorie de compétence**, listés dans l'en-tête de `data/buffs-supports.js`. L'obstacle historique est levé depuis que le calcul est par compétence, mais les activer touche la table des buffs, pas la composition d'équipe.
- **Créer ou modifier une équipe depuis le calculateur.** On lit les équipes existantes ; le builder reste seul à les composer.
- **Toucher `js/metier/degats-calcul.js`.** Le moteur ignore que les buffs viennent d'une équipe.
