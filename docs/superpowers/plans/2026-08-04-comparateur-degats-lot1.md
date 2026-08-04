# Comparateur de dégâts, lot 1 — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes utilisent des cases à cocher (`- [ ]`).

**But :** classer les builds déjà enregistrés d'un personnage par puissance de
frappe, dans la fiche de héros que les membres ouvrent déjà.

**Architecture :** un générateur fige les coefficients de compétence en
catalogue commité ; un module métier pur applique la formule de dégâts publiée
et renvoie ses termes ; la fiche de héros affiche le classement.

**Pile :** modules ES natifs sans build, Python 3 pour les générateurs, harnais
`vm` maison pour l'unitaire, Playwright pour le bout en bout.

## Contraintes globales

- **Spec de référence :** `docs/superpowers/specs/2026-08-04-comparateur-degats-lot1-design.md`.
- **Formule :** `Dégâts = ATK × Coef × Bonus-type × Critique × K/(K+DEF) × (1−Résistance) × (1+Faiblesse)`.
- **`K = 5600`** (milieu de l'intervalle 5500–5700 publié).
- **Cible de référence, valeurs réelles relevées sur Banakro :** `def:493`,
  `critResist:1000`, `critDmgResist:650`, résistance élémentaire et faiblesse à `0`.
- **Échelle des pourcentages :** unité `"ten-thousandths"` déjà en vigueur dans
  le dépôt — `valeur / 10000` donne le rapport, `valeur / 100` le pourcentage
  affiché (`js/vues/stats-affichage.js:17`).
- **Le critique est pris en espérance**, jamais tiré au sort : un comparateur
  doit être déterministe.
- **Une donnée absente vaut `null`, jamais zéro.** Une ligne sans compétence
  connue disparaît du classement au lieu d'afficher `0`.
- **Un module métier neuf s'enregistre à QUATRE endroits :**
  `tests/helpers/modules.js`, `sw.js` (`CORE_ASSETS`), l'`import` du
  consommateur, et `tests/helpers/load-app.js` (objet `hooks`, liste
  explicite). Un test unitaire neuf s'ajoute en plus aux **deux** scripts
  `test` et `test:unit` de `package.json`.
- **Messages de commit sans accents.** Libellés d'interface en français accentué.
- **Vérification navigateur :** toujours un port jamais utilisé (service worker
  en `cacheFirst`).
- Suite complète : `npm test`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `scripts/generate-competences.py` *(créé)* | Aspire les compétences des 24 personnages et rend `data/competences.js`. Mode `--check` sans réseau. |
| `data/competences.js` *(généré, commité)* | Catalogue figé. Le site est une PWA : aucun appel réseau au rendu. |
| `js/metier/degats-calcul.js` *(créé)* | Pur. Applique la formule, renvoie total et termes. |
| `js/vues/fiche-heros.js` *(modifié)* | Affiche le bloc « Puissance ». |
| `tests/degats-calcul.test.js` *(créé)* | Unitaire du moteur. |
| `tests/competences-catalogue.test.js` *(créé)* | Cohérence du catalogue commité. |

---

## Tâche 1 : le catalogue de compétences

**Fichiers :**
- Créer : `scripts/generate-competences.py`, `data/competences.js`,
  `tests/competences-catalogue.test.js`
- Modifier : `index.html` (après `data/personnages-meta.js`, ligne 476),
  `sw.js` (`CORE_ASSETS`), `package.json` (les deux scripts)

**Interfaces :**
- Consomme : `scripts/generate-stats.py` (`fetch`, `flight_payload`, `collect`,
  `PAGE`), importé par chemin puisque le nom du fichier contient un tiret.
- Produit :
  ```js
  window.SEVEN_DS_COMPETENCES = {
    "<slug>": [
      { gameId:"…", weaponType:"Axe", categorie:"ACTIVE", nom:"…",
        pourcentage:189, coups:6, repartition:[25,24,…], portee:"Melee" }
    ]
  };
  ```

- [ ] **Étape 1 : écrire le générateur**

Créer `scripts/generate-competences.py` :

```python
# -*- coding: utf-8 -*-
"""Aspire les competences chiffrees de 7dsorigin.app -> data/competences.js.

Seules les competences qui INFLIGENT des degats sont retenues : categorie
autre que PASSIVE, et damagePercent renseigne. Les passifs restent hors du
catalogue de calcul ; la vue les annonce « non inclus ».

Le catalogue est fige et commite : le site est une PWA et ne doit aucun appel
reseau au rendu. `--check` compare le fichier commite au rendu attendu.
"""
import argparse
import importlib.util
import json
import re
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

_spec = importlib.util.spec_from_file_location(
    "generate_stats", RACINE / "scripts" / "generate-stats.py"
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)

FICHE = "https://7dsorigin.app/en/characters/{slug}"
POURCENT = re.compile(r"(-?\d+(?:[.,]\d+)?)\s*%")


def nombre(texte):
    """« 189% ATK » -> 189.0 ; rien d'exploitable -> None (jamais 0)."""
    if not isinstance(texte, str):
        return None
    trouve = POURCENT.search(texte)
    return float(trouve.group(1).replace(",", ".")) if trouve else None


def slugs():
    flight = _gen.flight_payload(_gen.fetch(_gen.PAGE))
    return [c["slug"] for c in _gen.collect(flight, "characters") if c.get("slug")]


def competences_du(slug):
    flight = _gen.flight_payload(_gen.fetch(FICHE.format(slug=slug)))
    retenues = []
    for brut in re.findall(r'\{[^{}]*"damagePercent"[^{}]*\}', flight):
        try:
            skill = json.loads(brut)
        except ValueError:
            continue
        if skill.get("skillCategory") == "PASSIVE":
            continue
        pourcentage = nombre(skill.get("damagePercent"))
        if pourcentage is None:
            continue
        retenues.append({
            "gameId": skill.get("gameId") or skill.get("id"),
            "weaponType": skill.get("weaponType"),
            "categorie": skill.get("skillCategory"),
            "nom": skill.get("nameEn"),
            "pourcentage": pourcentage,
            "coups": skill.get("hitCount"),
            "repartition": [
                n for n in (nombre(h) for h in skill.get("hitDamages") or []) if n is not None
            ],
            "portee": skill.get("damType"),
        })
    retenues.sort(key=lambda s: (s["weaponType"] or "", s["gameId"] or ""))
    return retenues


def rendu(catalogue):
    corps = json.dumps(catalogue, ensure_ascii=False, indent=1, sort_keys=True)
    return (
        "// Genere par generate-competences.py depuis 7dsorigin.app.\n"
        "// Cle = slug personnage. Seules les competences infligeant des degats\n"
        "// figurent ici : les passifs sont annonces « non inclus » par la vue.\n"
        "// pourcentage = % de l'ATK ; repartition = % par coup.\n"
        "window.SEVEN_DS_COMPETENCES = " + corps + ";\n"
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    cible = RACINE / "data" / "competences.js"

    if args.check:
        if not cible.exists():
            raise SystemExit("competences.js doit etre genere")
        print("competences.js present")
        return

    catalogue = {}
    for slug in slugs():
        catalogue[slug] = competences_du(slug)
        print(slug, ":", len(catalogue[slug]), "competences")
    cible.write_text(rendu(catalogue), encoding="utf-8", newline="\n")
    print("competences.js genere")


if __name__ == "__main__":
    main()
```

**Pourquoi `--check` ne re-aspire pas** : les autres générateurs comparent au
rendu recalculé depuis des fichiers **locaux**. Ici la source est le réseau —
recalculer dans `npm test` rendrait la suite dépendante d'un site tiers et
lente. `--check` vérifie donc seulement la présence ; la cohérence du contenu
est l'affaire de l'étape 4.

- [ ] **Étape 2 : générer le catalogue**

Commande : `python scripts/generate-competences.py`

Attendu : 24 lignes `slug : N competences`, puis `competences.js genere`.
Inspecter `data/competences.js` : `meliodas` doit porter des compétences
`Axe`, `Sword1h` et `SwordDual` avec des `pourcentage` non nuls.

- [ ] **Étape 3 : charger le catalogue**

`index.html`, après la ligne 476 (`data/personnages-meta.js`) :

```html
  <script src="data/competences.js"></script>
```

`sw.js`, dans `CORE_ASSETS`, après `"./data/personnages-meta.js"` :

```js
"./data/personnages-meta.js", "./data/competences.js",
```

- [ ] **Étape 4 : écrire le test de cohérence**

Créer `tests/competences-catalogue.test.js` :

```js
"use strict";

/* Le catalogue commite doit rester exploitable sans reseau. Ce test le lit
   comme le navigateur : un simple fichier de donnees. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "competences.js"), "utf8"),
  bac
);
const catalogue = bac.window.SEVEN_DS_COMPETENCES;

assert.ok(catalogue, "Le catalogue doit s'exposer sur window");
const slugs = Object.keys(catalogue);
assert.ok(
  slugs.length >= 20,
  "Le catalogue doit couvrir les personnages du jeu, recu : " + slugs.length
);

/* Les types d'arme doivent parler le vocabulaire du depot, sinon aucune
   competence ne se rattachera jamais a un build du roster. */
const source = fs.readFileSync(
  path.join(racine, "js", "noyau", "constantes.js"), "utf8"
);
const bloc = source.slice(
  source.indexOf("const FOLDER_TO_ENUM"),
  source.indexOf("const ENUM_TO_FOLDER")
);
const enums = new Set([...bloc.matchAll(/:\s*"([A-Za-z0-9]+)"/g)].map(m => m[1]));
assert.ok(enums.size >= 12, "FOLDER_TO_ENUM doit avoir ete lu, recu : " + enums.size);

slugs.forEach(slug => {
  catalogue[slug].forEach(competence => {
    assert.ok(
      enums.has(competence.weaponType),
      slug + " : type d'arme inconnu de FOLDER_TO_ENUM -> " + competence.weaponType
    );
    /* Une donnee absente vaut null, jamais zero : un zero se propagerait dans
       la somme sans que personne ne le remarque. */
    assert.ok(
      typeof competence.pourcentage === "number" && competence.pourcentage > 0,
      slug + " : pourcentage non exploitable sur " + competence.nom
    );
    assert.notStrictEqual(
      competence.categorie, "PASSIVE",
      slug + " : un passif ne doit pas entrer dans le catalogue de calcul"
    );
  });
});

console.log("competences : catalogue coherent (" + slugs.length + " personnages)");
```

- [ ] **Étape 5 : inscrire le test dans les deux scripts npm**

Dans `package.json`, ajouter `&& node tests/competences-catalogue.test.js`
après `node tests/roster-affichage-instantane.test.js` **dans `test` et dans
`test:unit`**. Un test absent des scripts ne s'exécute jamais.

- [ ] **Étape 6 : lancer**

Commandes :
```
node tests/competences-catalogue.test.js
python scripts/generate-competences.py --check
npm test
```
Attendu : tout au vert.

- [ ] **Étape 7 : commit**

```bash
git add scripts/generate-competences.py data/competences.js \
        tests/competences-catalogue.test.js index.html sw.js package.json
git commit -m "feat: figer les coefficients de competence en catalogue"
```

---

## Tâche 2 : le moteur de dégâts

**Fichiers :**
- Créer : `js/metier/degats-calcul.js`, `tests/degats-calcul.test.js`
- Modifier : `tests/helpers/modules.js` (après `"metier/stats-calcul.js"`),
  `tests/helpers/load-app.js` (`hooks`), `sw.js`, `package.json` (les deux scripts)

**Interfaces :**
- Consomme : le catalogue de la tâche 1 ; rien d'autre — le module est pur et
  reçoit ses entrées par argument.
- Produit :
  ```js
  degatsAttendus({ stats, competence, cible })
    // stats : { atk:number, critRate:number, critDamage:number,
    //           bonusType:number }  — tous en dix-millièmes sauf `atk`
    // competence : { pourcentage:number, repartition:number[] }
    // cible : { def, critResist, critDmgResist,
    //           resistanceElementaire, faiblesse }
    // -> null si une entrée manque
    // -> { total:number, parCoup:number[], termes:[{id,libelle,valeur}] }

  degatsDuCycle({ stats, competences, cible })
    // -> null si `competences` est vide
    // -> { total:number, detail:[{competence, total}] }

  CIBLE_REFERENCE  // constante exportée
  ```

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `tests/degats-calcul.test.js` :

```js
"use strict";

const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app");

const { hooks } = loadApp();
const { degatsAttendus, degatsDuCycle, CIBLE_REFERENCE } = hooks;

/* Cible neutre et lisible : aucune resistance, aucune faiblesse, et une
   defense choisie pour que K/(K+DEF) tombe juste. K vaut 5600, donc
   DEF = 5600 donne exactement une reduction de moitie. */
const CIBLE_NEUTRE = {
  def:5600, critResist:0, critDmgResist:0,
  resistanceElementaire:0, faiblesse:0
};
const SANS_CRITIQUE = { atk:1000, critRate:0, critDamage:0, bonusType:0 };
const COUP_SIMPLE = { pourcentage:100, repartition:[100] };

/* Le terme de defense : K/(K+DEF). Avec DEF = K, il vaut 0,5. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE, competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 500, "1000 ATK x 100 % x 0,5 = 500");
}

/* Doubler l'ATK double les degats : le terme est lineaire. */
{
  const r = degatsAttendus({
    stats:Object.assign({}, SANS_CRITIQUE, { atk:2000 }),
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 1000);
}

/* Doubler la DEF ne divise PAS les degats par deux : K/(K+DEF) n'est pas
   lineaire, et cette difference est exactement ce qu'un comparateur doit
   representer correctement. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE, competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { def:11200 })
  });
  assert.ok(
    r.total > 250 && r.total < 500,
    "La mitigation doit etre hyperbolique, recu : " + r.total
  );
  assert.equal(Math.round(r.total), 333);
}

/* Le critique en ESPERANCE : 1 + taux x degats. 5000 dix-millemes = 50 %,
   et 14000 = 140 % -> facteur 1 + 0,5 x 1,4 = 1,7. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:5000, critDamage:14000, bonusType:0 },
    competence:COUP_SIMPLE, cible:CIBLE_NEUTRE
  });
  assert.equal(Math.round(r.total), 850, "500 x 1,7 = 850");
}

/* La resistance critique de la cible se retranche aux degats critiques. */
{
  const r = degatsAttendus({
    stats:{ atk:1000, critRate:10000, critDamage:14000, bonusType:0 },
    competence:COUP_SIMPLE,
    cible:Object.assign({}, CIBLE_NEUTRE, { critDmgResist:4000 })
  });
  assert.equal(Math.round(r.total), 1000, "500 x (1 + 1 x 1,0) = 1000");
}

/* La repartition par coup somme au total, et chaque coup est chiffre. */
{
  const r = degatsAttendus({
    stats:SANS_CRITIQUE,
    competence:{ pourcentage:100, repartition:[25, 75] },
    cible:CIBLE_NEUTRE
  });
  assert.deepStrictEqual(r.parCoup.map(Math.round), [125, 375]);
  assert.equal(Math.round(r.parCoup.reduce((a, b) => a + b, 0)), r.total);
}

/* Une entree manquante rend null, jamais zero : un zero se propagerait dans
   la somme du cycle sans que personne ne le remarque. */
{
  assert.strictEqual(degatsAttendus(), null);
  assert.strictEqual(
    degatsAttendus({ stats:SANS_CRITIQUE, cible:CIBLE_NEUTRE }), null
  );
  assert.strictEqual(
    degatsAttendus({
      stats:SANS_CRITIQUE, cible:CIBLE_NEUTRE,
      competence:{ pourcentage:null, repartition:[] }
    }),
    null
  );
}

/* Le cycle additionne chaque competence jouee une fois. */
{
  const r = degatsDuCycle({
    stats:SANS_CRITIQUE,
    competences:[COUP_SIMPLE, { pourcentage:200, repartition:[200] }],
    cible:CIBLE_NEUTRE
  });
  assert.equal(r.total, 1500, "500 + 1000");
  assert.equal(r.detail.length, 2);
  assert.strictEqual(degatsDuCycle({
    stats:SANS_CRITIQUE, competences:[], cible:CIBLE_NEUTRE
  }), null);
}

/* La cible de reference porte les valeurs relevees sur Banakro, pas des
   chiffres inventes. */
{
  assert.equal(CIBLE_REFERENCE.def, 493);
  assert.equal(CIBLE_REFERENCE.critResist, 1000);
  assert.equal(CIBLE_REFERENCE.critDmgResist, 650);
}

console.log("degats-calcul.test.js OK");
```

- [ ] **Étape 2 : lancer et vérifier l'échec**

Commande : `node tests/degats-calcul.test.js`
Attendu : `TypeError: degatsAttendus is not a function`.

- [ ] **Étape 3 : écrire le module**

Créer `js/metier/degats-calcul.js` :

```js
/* Les degats attendus d'une competence, selon la formule publiee par
   7dsorigin.app/en/damage-formula et validee empiriquement par ses auteurs :

     Degats = ATK x Coef x Bonus-type x Critique x K/(K+DEF)
              x (1 - Resistance) x (1 + Faiblesse)

   Module PUR : ni DOM ni reseau, toutes les entrees arrivent par argument.

   Le critique est pris en ESPERANCE (1 + taux x degats) et non tire au sort :
   un comparateur doit etre deterministe, sinon deux consultations de la meme
   fiche donneraient deux classements.

   Les pourcentages arrivent en dix-milliemes, unite deja en vigueur dans le
   depot (voir js/vues/stats-affichage.js) : valeur / 10000 donne le rapport. */

  /* Milieu de l'intervalle 5500-5700 publie. L'incertitude qui en resulte se
     simplifie dans un rapport entre deux builds, ce qui est precisement
     l'usage vise par ce lot. */
  const K = 5600;

  /* Valeurs REELLES relevees sur Banakro, jamais inventees. Resistance
     elementaire et faiblesse a zero : la fiche ne les expose pas, une cible
     neutre est un choix assume plutot qu'une valeur devinee. */
  const CIBLE_REFERENCE = {
    nom:"Banakro",
    def:493,
    critResist:1000,
    critDmgResist:650,
    resistanceElementaire:0,
    faiblesse:0
  };

  const RAPPORT = 10000;

  function nombreFini(valeur){
    return typeof valeur === "number" && Number.isFinite(valeur);
  }

  function degatsAttendus(entree){
    const source = entree || {};
    const stats = source.stats;
    const competence = source.competence;
    const cible = source.cible;
    if(!stats || !competence || !cible) return null;
    if(!nombreFini(stats.atk) || !nombreFini(competence.pourcentage)) return null;
    if(competence.pourcentage <= 0) return null;

    const coef = competence.pourcentage / 100;
    const bonusType = 1 + (Number(stats.bonusType) || 0) / RAPPORT;
    const taux = Math.max(
      0, ((Number(stats.critRate) || 0) - (Number(cible.critResist) || 0)) / RAPPORT
    );
    const degatsCrit = Math.max(
      0,
      ((Number(stats.critDamage) || 0) - (Number(cible.critDmgResist) || 0)) / RAPPORT
    );
    const critique = 1 + taux * degatsCrit;
    const mitigation = K / (K + (Number(cible.def) || 0));
    const resistance = 1 - (Number(cible.resistanceElementaire) || 0) / RAPPORT;
    const faiblesse = 1 + (Number(cible.faiblesse) || 0) / RAPPORT;

    const facteur = stats.atk * bonusType * critique * mitigation
      * resistance * faiblesse;
    const total = facteur * coef;

    /* La repartition par coup, quand la source la donne. A defaut, un coup
       unique portant tout : mieux vaut un detail pauvre qu'un detail faux. */
    const parts = Array.isArray(competence.repartition)
      && competence.repartition.length
      ? competence.repartition
      : [competence.pourcentage];
    const parCoup = parts.map(part => facteur * (Number(part) || 0) / 100);

    return {
      total,
      parCoup,
      termes:[
        { id:"atk", libelle:"Attaque", valeur:stats.atk },
        { id:"coefficient", libelle:"Coefficient", valeur:coef },
        { id:"bonus-type", libelle:"Bonus de type", valeur:bonusType },
        { id:"critique", libelle:"Critique (espérance)", valeur:critique },
        { id:"mitigation", libelle:"Défense de la cible", valeur:mitigation },
        { id:"resistance", libelle:"Résistance", valeur:resistance },
        { id:"faiblesse", libelle:"Faiblesse", valeur:faiblesse }
      ]
    };
  }

  /* Un cycle : chaque competence active jouee UNE fois. Ce n'est pas un degat
     par seconde - les temps de recharge ne sont pas modelises - et la vue doit
     le dire. Le choix ne privilegie aucune competence arbitrairement. */
  function degatsDuCycle(entree){
    const source = entree || {};
    const liste = Array.isArray(source.competences) ? source.competences : [];
    const detail = liste
      .map(competence => ({
        competence,
        resultat:degatsAttendus({
          stats:source.stats, competence, cible:source.cible
        })
      }))
      .filter(ligne => ligne.resultat !== null)
      .map(ligne => ({ competence:ligne.competence, total:ligne.resultat.total }));
    if(!detail.length) return null;
    return {
      total:detail.reduce((somme, ligne) => somme + ligne.total, 0),
      detail
    };
  }

export { CIBLE_REFERENCE, degatsAttendus, degatsDuCycle };
```

- [ ] **Étape 4 : enregistrer le module aux quatre endroits**

`tests/helpers/modules.js`, après `"metier/stats-calcul.js"` :

```js
  "metier/stats-calcul.js",
  "metier/degats-calcul.js",
```

`sw.js`, dans `CORE_ASSETS`, après `"./js/metier/stats-calcul.js"` :

```js
"./js/metier/stats-calcul.js", "./js/metier/degats-calcul.js",
```

`tests/helpers/load-app.js`, dans le littéral `hooks` (le garde `typeof` est le
motif du fichier ; **aucun accent grave** dans ce fichier, son contenu vit dans
un gabarit de chaîne) :

```js
  degatsAttendus:typeof degatsAttendus === "function"
    ? degatsAttendus
    : undefined,
  degatsDuCycle:typeof degatsDuCycle === "function"
    ? degatsDuCycle
    : undefined,
  CIBLE_REFERENCE:typeof CIBLE_REFERENCE === "object"
    ? CIBLE_REFERENCE
    : undefined,
```

Le quatrième endroit — l'`import` du consommateur — est la tâche 3. En
attendant, `tests/modules-imports.test.js` refuse tout export que personne
n'importe : c'est pourquoi les tâches 2 et 3 se lancent **d'affilée**, et que
la suite complète n'est exigée qu'à la fin de la tâche 3.

- [ ] **Étape 5 : ajouter le test aux deux scripts npm**

Dans `package.json`, ajouter `&& node tests/degats-calcul.test.js` après
`node tests/competences-catalogue.test.js`, **dans `test` et dans `test:unit`**.

- [ ] **Étape 6 : lancer le test du moteur**

Commande : `node tests/degats-calcul.test.js`
Attendu : `degats-calcul.test.js OK`

- [ ] **Étape 7 : commit**

```bash
git add js/metier/degats-calcul.js tests/degats-calcul.test.js \
        tests/helpers/modules.js tests/helpers/load-app.js sw.js package.json
git commit -m "feat: moteur de degats attendus, formule publiee et termes traces"
```

---

## Tâche 3 : le bloc « Puissance » dans la fiche

**Fichiers :**
- Modifier : `js/vues/fiche-heros.js` (`heroDetail`, ligne 115),
  `css/roster.css`, `tests/apport-par-piece.playwright.js`

**Interfaces :**
- Consomme : `degatsDuCycle`, `CIBLE_REFERENCE` (tâche 2) ; le catalogue
  `window.SEVEN_DS_COMPETENCES` (tâche 1) ; `FOLDER_TO_ENUM`
  (`js/noyau/constantes.js`) ; `calculateBuildStats` (`js/metier/stats-calcul.js`).
- Produit : une `<section class="hd-puissance">` portant
  `data-puissance="<nombre de builds classés>"`.

- [ ] **Étape 1 : écrire l'assertion bout en bout qui échoue**

Dans `tests/apport-par-piece.playwright.js`, à la suite des assertions
existantes sur la fiche de héros ouverte :

```js
    /* LE BLOC PUISSANCE : il classe les builds enregistres du personnage.

       Il n'apparait qu'a partir de DEUX builds : avec un seul, un classement
       n'apprend rien et occuperait de la place pour rien. */
    const puissance = page.locator(".hd-puissance");
    if(await puissance.count()){
      const lignes = await puissance.locator(".hd-puissance-ligne").count();
      assert.ok(lignes >= 2, "Un classement suppose au moins deux builds");
      const valeurs = await puissance
        .locator(".hd-puissance-valeur").allTextContent();
      const nombres = valeurs.map(t => Number(t.replace(/[^0-9]/g, "")));
      assert.deepStrictEqual(
        nombres, nombres.slice().sort((a, b) => b - a),
        "Le classement doit etre decroissant"
      );
      assert.match(
        await puissance.textContent(),
        /cycle/i,
        "Le libelle doit dire que le chiffre est un cycle, pas un DPS"
      );
    }
```

- [ ] **Étape 2 : lancer et constater**

Commande : `node tests/apport-par-piece.playwright.js`

Attendu : PASS, mais **sans rien vérifier** — le bloc n'existe pas encore, donc
`count()` vaut 0 et la branche est sautée. C'est voulu : l'assertion se réveille
dès que le bloc apparaît. Après l'étape 3, elle doit s'exécuter réellement ;
l'étape 5 le vérifie en la rendant temporairement inconditionnelle.

- [ ] **Étape 3 : rendre le bloc**

Dans `js/vues/fiche-heros.js`, ajouter aux imports :

```js
import { CIBLE_REFERENCE, degatsDuCycle } from "../metier/degats-calcul.js";
import { FOLDER_TO_ENUM } from "../noyau/constantes.js";
```

Si `FOLDER_TO_ENUM` n'est pas exporté par `js/noyau/constantes.js`, l'ajouter à
son bloc `export` — la table existe déjà ligne 66, seule sa sortie manque.

Ajouter la fonction, au-dessus de `heroDetail` :

```js
  /* Les compétences du catalogue rattachées à un build du roster. Le roster
     range ses builds par DOSSIER d'image (« Hache »), la source les publie par
     ÉNUM (« Axe ») : FOLDER_TO_ENUM fait le pont, et il existe déjà. */
  function competencesDuBuild(charId, dossierArme){
    const catalogue = window.SEVEN_DS_COMPETENCES || {};
    const enumArme = FOLDER_TO_ENUM[dossierArme];
    if(!enumArme) return [];
    return (catalogue[charId] || [])
      .filter(competence => competence.weaponType === enumArme);
  }

  /* Le classement des builds enregistrés, du plus fort au plus faible.
     Un build dont aucune compétence n'est connue est ABSENT du classement :
     l'afficher à zéro le ferait passer pour mauvais alors qu'il est seulement
     inconnu du catalogue. */
  function classementPuissance(hero){
    const builds = (hero && hero.rosterBuilds) || {};
    return Object.keys(builds)
      .map(dossierArme => {
        const competences = competencesDuBuild(hero.char, dossierArme);
        if(!competences.length) return null;
        const stats = calculateBuildStats(builds[dossierArme]);
        if(!stats) return null;
        const cycle = degatsDuCycle({
          stats:{
            atk:stats.atk,
            critRate:stats.critRate,
            critDamage:stats.critDamage,
            bonusType:0
          },
          competences,
          cible:CIBLE_REFERENCE
        });
        return cycle ? { arme:dossierArme, total:cycle.total } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.total - a.total);
  }
```

**À vérifier avant d'écrire ceci** : les noms exacts des champs rendus par
`calculateBuildStats` pour l'attaque et le critique. Les relever par
`node -e "const{loadApp}=require('./tests/helpers/load-app');…"` et adapter
`stats.atk`, `stats.critRate`, `stats.critDamage` en conséquence. Ne pas
deviner : un mauvais nom donnerait `undefined`, donc `null`, donc un bloc
silencieusement absent.

Puis, dans `heroDetail`, après le bloc de statistiques existant :

```js
    const classement = classementPuissance(h);
    if(classement.length >= 2){
      const bloc = el("section",{
        class:"hd-puissance",
        dataset:{ puissance:String(classement.length) }
      },[
        el("strong",{text:"Puissance par arme"}),
        el("p",{class:"hd-puissance-note",
          text:"Somme d'un cycle de compétences contre une cible de référence. "
            + "Sert à comparer, pas à prédire : les temps de recharge, les buffs "
            + "d'équipe et les effets conditionnels n'y entrent pas."})
      ]);
      classement.forEach(ligne => {
        bloc.appendChild(el("div",{class:"hd-puissance-ligne"},[
          el("span",{text:ligne.arme}),
          el("span",{class:"hd-puissance-valeur",
            text:new Intl.NumberFormat("fr-FR").format(Math.round(ligne.total))})
        ]));
      });
      col.appendChild(bloc);
    }
```

- [ ] **Étape 4 : habiller le bloc**

Dans `css/roster.css`, à la suite des règles `.hd-*` :

```css
.hd-puissance{margin-top:14px;border-top:1px solid var(--line-soft);padding-top:12px}
.hd-puissance-note{font-size:12px;color:var(--muted);margin:4px 0 10px}
.hd-puissance-ligne{
  display:flex;justify-content:space-between;gap:12px;
  padding:6px 0;border-bottom:1px solid var(--line-soft)
}
.hd-puissance-ligne:last-child{border-bottom:0}
.hd-puissance-valeur{font-variant-numeric:tabular-nums;color:var(--gold-bright)}
```

- [ ] **Étape 5 : prouver que l'assertion s'exécute**

Rendre temporairement la branche inconditionnelle dans le test — remplacer
`if(await puissance.count()){` par `{` — puis lancer
`node tests/apport-par-piece.playwright.js`.

Attendu : PASS. Un échec signifie que le bloc ne s'affiche pas, et il faut le
comprendre **avant** de restaurer la condition. Restaurer ensuite le `if`.

- [ ] **Étape 6 : lancer la suite complète**

Commande : `npm test`
Attendu : tout au vert, `PASS modules : imports déclarés et fichiers mis en
cache` compris — c'est lui qui valide les quatre enregistrements de la tâche 2.

- [ ] **Étape 7 : vérifier au navigateur**

```bash
npx --yes http-server -p <port jamais utilisé> -c-1 --silent
```

Ouvrir la fiche d'un héros portant au moins deux builds : le classement doit
apparaître, décroissant, avec sa note.

- [ ] **Étape 8 : commit**

```bash
git add js/vues/fiche-heros.js js/noyau/constantes.js css/roster.css \
        tests/apport-par-piece.playwright.js
git commit -m "feat: classer les builds d'un heros par puissance de frappe"
```

---

## Auto-relecture du plan

**Couverture de la spec.** Générateur et catalogue figé → tâche 1. Compétences
retenues (non-`PASSIVE` + `damagePercent`) → tâche 1 étape 1, contrôlé étape 4.
Moteur pur et termes tracés → tâche 2. Critique en espérance → tâche 2, testé.
`CIBLE_REFERENCE` aux valeurs de Banakro → tâche 2, testé. Unité « un cycle » →
`degatsDuCycle`, et le libellé de la tâche 3 l'énonce. Bloc « Puissance » et
seuil de deux builds → tâche 3. Trois limites affichées à l'écran → note de la
tâche 3 étape 3. Absence plutôt que zéro → testé en tâche 2, appliqué dans
`classementPuissance`. Enregistrement aux quatre endroits → tâche 2 étape 4.

**Écarts assumés par rapport à la spec.**

1. La spec demandait un `--check` « sur le modèle de `generate-stats-build.py` ».
   Celui-ci recalcule depuis des fichiers locaux ; ici la source est le réseau.
   `--check` vérifie donc la **présence** du catalogue, et la cohérence du
   contenu passe par `tests/competences-catalogue.test.js`. Faire autrement
   rendrait `npm test` dépendant d'un site tiers.
2. La spec citait `tests/competences-catalogue.test.js` sans préciser qu'un test
   neuf doit rejoindre **les deux** scripts npm. Le plan l'impose deux fois,
   parce que l'oubli s'est déjà produit sur `tests/accueil.test.js`.
3. Les noms de champs rendus par `calculateBuildStats` ne sont pas figés dans le
   plan : ils doivent être **relevés** en tâche 3 étape 3. Les inventer aurait
   produit un bloc absent sans erreur visible — le pire des échecs.

**Cohérence des types.** `degatsAttendus`, `degatsDuCycle` et `CIBLE_REFERENCE`
portent les mêmes noms et les mêmes formes dans le bloc « Interfaces » de la
tâche 2, dans le test de l'étape 1, dans le module de l'étape 3, dans les
`hooks` de l'étape 4 et dans l'appel de la tâche 3. La classe `.hd-puissance`
et ses enfants `.hd-puissance-ligne` / `.hd-puissance-valeur` sont identiques
entre le test (tâche 3 étape 1), le rendu (étape 3) et le CSS (étape 4).
