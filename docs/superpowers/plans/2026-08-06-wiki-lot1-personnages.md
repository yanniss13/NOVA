# Wiki lot 1 — catégorie Personnages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un onglet « Wiki » dont la catégorie Personnages donne, pour chacun des 25 héros, ses compétences et ses passifs en français, arme par arme.

**Architecture :** Un générateur Python aspire `https://7dsorigin.app/fr/characters/<slug>` et écrit un catalogue statique `data/wiki-competences.js`. Ce fichier est chargé **à la demande**, à la première ouverture de l'onglet, pas au démarrage. Un module métier pur regroupe et ordonne les compétences ; deux modules de vue affichent la grille de héros puis la fiche en modale.

**Tech Stack :** Python 3 (stdlib seule, `urllib`), JavaScript ES modules sans build, Node `assert` pour les tests unitaires, Playwright pour les tests de bout en bout, PowerShell/Bash pour lancer les scripts.

**Spec de référence :** `docs/superpowers/specs/2026-08-06-wiki-lot1-personnages-design.md`

## Global Constraints

- **Français partout dans l'UI.** Libellés, messages d'erreur, `aria-label`.
- **Aucun appel réseau au rendu.** Le site est une PWA ; toute donnée vient d'un fichier commité. `npm test` ne doit dépendre d'aucun site tiers.
- **`robots.txt` de 7dsorigin.app interdit `/api/`**, `ClaudeBot` nommément. Lire le payload RSC de la page publique via `flight_payload()` de `scripts/generate-stats.py`.
- **Jamais de liste d'assets ou de slugs écrite à la main.** Les héros viennent de `7ds-stats/personnages.json`, les filtres de `window.SEVEN_DS_META`.
- **Les fichiers générés ne s'éditent pas à la main.** `data/wiki-competences.js` est réécrit par son script.
- **Une absence n'est pas une valeur.** Une recharge non publiée vaut `null`, jamais `0`.
- **Tout module de `js/` doit être inscrit dans `tests/helpers/modules.js`**, dans sa couche, et dans `CORE_ASSETS` de `sw.js`. `tests/modules-imports.test.js` et `tests/pwa.test.js` le vérifient.
- **Toute feuille de `css/` doit être liée dans `index.html`, listée dans `tests/css-ordre.test.js` et présente dans `CORE_ASSETS`.**
- **Le balisage couleur `[#RRGGBB]texte[-]` est conservé tel quel** dans les données ; c'est `renderBonus()` (`js/vues/elements.js`) qui le rend.
- **Commandes de vérification :** `npm run test:unit` (rapide), `npm run test:e2e` (Playwright), `npm test` (les deux).

---

## File Structure

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `scripts/generate-wiki.py` | Aspire les compétences FR des 25 héros, écrit le catalogue. | 1 |
| `data/wiki-competences.js` | Catalogue généré. Pose `window.SEVEN_DS_WIKI_COMPETENCES`. | 1 |
| `tests/test_generate_wiki.py` | Le parsing du générateur, sur un payload figé. | 1 |
| `tests/wiki-catalogue.test.js` | La cohérence du catalogue commité. | 1 |
| `js/metier/wiki-competences.js` | Regroupement par arme et ordre des compétences. Pur, sans DOM. | 2 |
| `tests/wiki-competences.test.js` | Le module métier. | 2 |
| `js/vues/wiki.js` | Onglet, rail de catégories, grille, filtres, chargement du catalogue. | 3 |
| `css/wiki.css` | Styles de l'onglet. | 3 |
| `js/vues/wiki-fiche-heros.js` | La fiche d'un héros, en modale. | 4 |
| `tests/wiki.playwright.js` | Le parcours réel, y compris hors ligne. | 3 puis 4 |
| `index.html` | Onglet, section de vue, feuille de style, modale. | 3 et 4 |
| `js/app.js`, `sw.js`, `package.json`, `tests/helpers/modules.js`, `tests/css-ordre.test.js` | Câblage. | 3 et 4 |
| `AGENTS.md` | Documentation du catalogue et de son générateur. | 4 |

---

## Task 1: Le catalogue des compétences

**Files:**
- Create: `scripts/generate-wiki.py`
- Create: `tests/test_generate_wiki.py`
- Create: `tests/wiki-catalogue.test.js`
- Generate: `data/wiki-competences.js`
- Modify: `package.json` (scripts `test` et `test:unit`)

**Interfaces:**
- Consomme : `flight_payload()`, `fetch()`, `balanced_end()` de `scripts/generate-stats.py`, importés par chemin (le nom du fichier contient un tiret) ; `7ds-stats/personnages.json` pour la liste des slugs.
- Produit : `window.SEVEN_DS_WIKI_COMPETENCES`, objet `{ [slug]: Competence[] }` où
  `Competence = { gameId: string, weaponType: string, categorie: string, nomFr: string, descriptionFr: string, recharge: number|null }`.
  Les tâches 2 à 4 ne dépendent que de cette forme.

- [ ] **Step 1: Écrire le test du parsing**

Créer `tests/test_generate_wiki.py` :

```python
import importlib.util
import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "generate_wiki", ROOT / "scripts" / "generate-wiki.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def competence(game_id, weapon, categorie, nom, description, cooldown=None):
    """Un objet de competence tel que la source le publie."""
    return json.dumps({
        "gameId": game_id,
        "weaponType": weapon,
        "skillCategory": categorie,
        "nameFr": nom,
        "nameEn": "ignored",
        "descriptionFr": description,
        "descriptionEn": "ignored",
        "cooldown": cooldown,
    }, ensure_ascii=False)


PAYLOAD = "[" + ",".join([
    competence("derieri_axe_passive", "Axe", "PASSIVE",
               "Charge ténébreuse", "Réduit la résistance de [#1A7331]3%[-]."),
    competence("derieri_axe_skill_q", "Axe", "NORMAL",
               "Poing de fureur", "Inflige des dégâts.", 12),
]) + "]"


class ExtractionTests(unittest.TestCase):
    def test_retient_les_champs_francais(self):
        self.assertEqual(
            module.competences_du_payload(PAYLOAD),
            [
                {
                    "gameId": "derieri_axe_passive",
                    "weaponType": "Axe",
                    "categorie": "PASSIVE",
                    "nomFr": "Charge ténébreuse",
                    "descriptionFr": "Réduit la résistance de [#1A7331]3%[-].",
                    "recharge": None,
                },
                {
                    "gameId": "derieri_axe_skill_q",
                    "weaponType": "Axe",
                    "categorie": "NORMAL",
                    "nomFr": "Poing de fureur",
                    "descriptionFr": "Inflige des dégâts.",
                    "recharge": 12.0,
                },
            ],
        )

    def test_garde_les_passifs(self):
        categories = [c["categorie"]
                      for c in module.competences_du_payload(PAYLOAD)]
        self.assertIn("PASSIVE", categories)

    def test_deduplique_sur_le_game_id(self):
        double = "[" + ",".join([
            competence("derieri_axe_passive", "Axe", "PASSIVE", "A", "desc"),
            competence("derieri_axe_passive", "Axe", "PASSIVE", "A", "desc"),
        ]) + "]"
        self.assertEqual(len(module.competences_du_payload(double)), 1)


class ValidationTests(unittest.TestCase):
    def test_description_vide_rejetee(self):
        vide = "[" + competence(
            "derieri_axe_passive", "Axe", "PASSIVE", "Charge", "") + "]"
        with self.assertRaises(module.CatalogueIncomplet):
            module.valide("derieri", module.competences_du_payload(vide))

    def test_arme_sans_passif_rejetee(self):
        sans = "[" + competence(
            "derieri_axe_skill_q", "Axe", "NORMAL", "Poing", "desc") + "]"
        with self.assertRaises(module.CatalogueIncomplet):
            module.valide("derieri", module.competences_du_payload(sans))

    def test_heros_sans_competence_rejete(self):
        with self.assertRaises(module.CatalogueIncomplet):
            module.valide("derieri", [])

    def test_catalogue_nominal_accepte(self):
        self.assertIsNone(
            module.valide("derieri", module.competences_du_payload(PAYLOAD))
        )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `python -m unittest tests/test_generate_wiki.py`
Expected: FAIL — `FileNotFoundError` sur `scripts/generate-wiki.py`.

- [ ] **Step 3: Écrire le générateur**

Créer `scripts/generate-wiki.py` :

```python
# =============================================================================
#  generate-wiki.py
#  Aspire les competences et les passifs des heros depuis les pages francaises
#  de 7dsorigin.app, et ecrit data/wiki-competences.js — le catalogue de
#  LECTURE du wiki.
#
#  A ne pas confondre avec data/competences.js (branche comparateur), qui est
#  un catalogue de CALCUL : noms anglais, pourcentages, passifs exclus. Ici on
#  garde le francais et surtout les passifs, et on ne chiffre rien.
#
#  Usage :   python scripts/generate-wiki.py           (connexion requise)
#            python scripts/generate-wiki.py --check   (verifie la presence)
#
#  Le catalogue est fige et commite : le site est une PWA et ne doit aucun
#  appel reseau au rendu. `--check` ne re-aspire pas, sous peine de rendre
#  `npm test` dependant d'un site tiers.
# =============================================================================
import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
RACINE = Path(__file__).resolve().parent.parent

# Le nom du fichier contient un tiret : import par chemin, pas par `import`.
_spec = importlib.util.spec_from_file_location(
    "generate_stats", RACINE / "scripts" / "generate-stats.py"
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)

FICHE = "https://7dsorigin.app/fr/characters/{slug}"
CIBLE = RACINE / "data" / "wiki-competences.js"
# En deca, la page a change de forme : mieux vaut echouer que publier un
# catalogue ampute.
HEROS_MINIMUM = 20


class CatalogueIncomplet(RuntimeError):
    pass


def nombre_ou_none(valeur):
    """Normalise une recharge. Une absence reste une absence, jamais un zero."""
    if isinstance(valeur, bool) or valeur is None:
        return None
    try:
        return float(str(valeur).replace(",", "."))
    except ValueError:
        return None


def competences_du_payload(payload):
    """Les competences d'un heros, dans l'ordre ou la source les publie.

    On repere chaque objet par sa cle `skillCategory` puis on remonte a
    l'accolade ouvrante : une expression reguliere plate ne suffirait pas, les
    competences portent des objets imbriques.
    """
    retenues = []
    vus = set()
    for brut in _objets_portant(payload, "skillCategory"):
        try:
            skill = json.loads(brut)
        except ValueError:
            continue
        game_id = skill.get("gameId")
        if not game_id or not skill.get("weaponType") or game_id in vus:
            continue
        vus.add(game_id)
        retenues.append({
            "gameId": game_id,
            "weaponType": skill.get("weaponType"),
            "categorie": skill.get("skillCategory"),
            "nomFr": skill.get("nameFr") or "",
            "descriptionFr": skill.get("descriptionFr") or "",
            "recharge": nombre_ou_none(skill.get("cooldown")),
        })
    return retenues


def _ouverture(texte, position):
    """Remonte a l'accolade qui ouvre l'objet contenant `position`."""
    profondeur = 0
    i = position
    while i >= 0:
        caractere = texte[i]
        if caractere == "}":
            profondeur += 1
        elif caractere == "{":
            if profondeur == 0:
                return i
            profondeur -= 1
        i -= 1
    return None


def _objets_portant(payload, cle):
    marque = '"%s"' % cle
    trouves = []
    position = payload.find(marque)
    while position != -1:
        debut = _ouverture(payload, position)
        if debut is not None:
            fin = _gen.balanced_end(payload, debut)
            if fin is not None and fin > debut:
                trouves.append(payload[debut:fin + 1])
        position = payload.find(marque, position + 1)
    return trouves


def valide(slug, competences):
    """Leve `CatalogueIncomplet` plutot que de publier une fiche trouee."""
    if not competences:
        raise CatalogueIncomplet("%s : aucune competence extraite" % slug)
    for competence in competences:
        if not competence["nomFr"]:
            raise CatalogueIncomplet(
                "%s : nom francais absent (%s)" % (slug, competence["gameId"]))
        if not competence["descriptionFr"]:
            raise CatalogueIncomplet(
                "%s : description francaise absente (%s)"
                % (slug, competence["gameId"]))
    par_arme = {}
    for competence in competences:
        par_arme.setdefault(competence["weaponType"], []).append(competence)
    for arme, liste in sorted(par_arme.items()):
        if not any(c["categorie"] == "PASSIVE" for c in liste):
            raise CatalogueIncomplet(
                "%s/%s : aucun passif" % (slug, arme))
    return None


def slugs():
    personnages = json.loads(
        (RACINE / "7ds-stats" / "personnages.json").read_text(encoding="utf-8"))
    return [p["slug"] for p in personnages if p.get("slug")]


def rendu(catalogue):
    corps = json.dumps(catalogue, ensure_ascii=False, indent=1, sort_keys=True)
    return (
        "// Genere par generate-wiki.py depuis les pages FR de 7dsorigin.app.\n"
        "// Catalogue de LECTURE du wiki : noms et descriptions francais,\n"
        "// PASSIFS INCLUS. Ne pas confondre avec data/competences.js, qui\n"
        "// est le catalogue de calcul du comparateur de degats.\n"
        "// Cle = slug personnage. recharge = secondes, ou null si la source\n"
        "// ne la publie pas. Le balisage [#RRGGBB]texte[-] est rendu par\n"
        "// renderBonus() ; il est conserve tel quel ici.\n"
        "window.SEVEN_DS_WIKI_COMPETENCES = " + corps + ";\n"
    )


def main():
    parseur = argparse.ArgumentParser()
    parseur.add_argument("--check", action="store_true")
    options = parseur.parse_args()

    if options.check:
        if not CIBLE.exists():
            raise SystemExit("wiki-competences.js doit etre genere")
        print("wiki-competences.js present")
        return

    catalogue = {}
    for slug in slugs():
        payload = _gen.flight_payload(_gen.fetch(FICHE.format(slug=slug)))
        competences = competences_du_payload(payload)
        valide(slug, competences)
        catalogue[slug] = competences
        print("%-16s %2d competences" % (slug, len(competences)))

    if len(catalogue) < HEROS_MINIMUM:
        raise SystemExit(
            "seulement %d heros extraits : la page a change de forme"
            % len(catalogue))

    CIBLE.write_text(rendu(catalogue), encoding="utf-8", newline="\n")
    print()
    print("wiki-competences.js genere : %d heros, %d competences, %.1f Ko"
          % (len(catalogue),
             sum(len(v) for v in catalogue.values()),
             CIBLE.stat().st_size / 1024))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `python -m unittest tests/test_generate_wiki.py`
Expected: PASS — 7 tests.

- [ ] **Step 5: Générer le catalogue pour de vrai**

Run: `python scripts/generate-wiki.py`
Expected: 25 lignes `slug NN competences`, puis un récapitulatif. Chaque héros doit sortir 18 compétences (6 par arme × 3 armes) ; un écart n'est pas forcément une erreur, mais un héros à moins de 9 compétences doit être signalé dans le compte rendu de la tâche.

**Si le fichier dépasse 400 Ko :** ne pas continuer en silence. Le noter dans le compte rendu — la spec prévoit alors de scinder le catalogue par héros et de le charger à l'ouverture d'une fiche plutôt que de l'onglet. C'est un changement de plan, pas une décision d'implémentation.

- [ ] **Step 6: Écrire le test de cohérence du catalogue commité**

Créer `tests/wiki-catalogue.test.js` :

```js
"use strict";

/* Le catalogue commité du wiki : ce test est le garde-fou qui criera le jour
   où le jeu ajoutera un héros sans qu'on regénère.

   Il lit le fichier réel, pas un échantillon : c'est le seul contrôle qui
   voit un catalogue périmé. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RACINE = path.join(__dirname, "..");

const contexte = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(RACINE, "data", "wiki-competences.js"), "utf8"),
  contexte,
  { filename:"wiki-competences.js" }
);
const catalogue = contexte.window.SEVEN_DS_WIKI_COMPETENCES;

const personnages = JSON.parse(
  fs.readFileSync(path.join(RACINE, "7ds-stats", "personnages.json"), "utf8")
);
const slugs = personnages.map(p => p.slug);

assert.deepEqual(
  Object.keys(catalogue).sort(),
  [...slugs].sort(),
  "le catalogue doit couvrir exactement les personnages de 7ds-stats"
);

slugs.forEach(slug => {
  const competences = catalogue[slug];
  assert.ok(competences.length, slug+" : catalogue vide");

  const parArme = {};
  competences.forEach(competence => {
    (parArme[competence.weaponType] = parArme[competence.weaponType] || [])
      .push(competence);
  });
  assert.equal(
    Object.keys(parArme).length, 3,
    slug+" : trois types d'arme attendus, reçu "+Object.keys(parArme).length
  );

  Object.entries(parArme).forEach(([arme, liste]) => {
    assert.ok(
      liste.some(competence => competence.categorie === "PASSIVE"),
      slug+"/"+arme+" : aucun passif"
    );
  });

  competences.forEach(competence => {
    assert.ok(competence.nomFr, slug+" : nom absent ("+competence.gameId+")");
    assert.ok(
      competence.descriptionFr,
      slug+" : description absente ("+competence.gameId+")"
    );
    assert.ok(
      competence.recharge === null || typeof competence.recharge === "number",
      slug+" : recharge ni nombre ni null ("+competence.gameId+")"
    );
  });
});

console.log(
  "PASS wiki : catalogue cohérent ("+slugs.length+" personnages, "
  + Object.values(catalogue).reduce((total, l) => total + l.length, 0)
  + " compétences)"
);
```

- [ ] **Step 7: Câbler les deux tests dans `npm test`**

Dans `package.json`, ajouter aux scripts `test` **et** `test:unit`, juste après `python -m unittest tests/test_generate_stats.py` :

```
 && python -m unittest tests/test_generate_wiki.py && python scripts/generate-wiki.py --check && node tests/wiki-catalogue.test.js
```

- [ ] **Step 8: Lancer la suite unitaire**

Run: `npm run test:unit`
Expected: PASS de bout en bout, dont `PASS wiki : catalogue cohérent (25 personnages, … compétences)`.

- [ ] **Step 9: Commit**

```bash
git add scripts/generate-wiki.py data/wiki-competences.js tests/test_generate_wiki.py tests/wiki-catalogue.test.js package.json
git commit -m "feat: aspirer les competences et passifs francais des heros"
```

---

## Task 2: Le module métier

**Files:**
- Create: `js/metier/wiki-competences.js`
- Create: `tests/wiki-competences.test.js`
- Modify: `tests/helpers/modules.js`
- Modify: `package.json`

**Interfaces:**
- Consomme : `window.SEVEN_DS_WIKI_COMPETENCES` produit par la tâche 1.
- Produit :
  - `competencesParArme(slug: string) → { [weaponType: string]: Competence[] }` — un objet vide si le héros est absent ou si le catalogue n'est pas encore chargé.
  - `armesDuHeros(slug: string) → string[]` — les `weaponType` du héros, dans l'ordre où le catalogue les présente.
  - Les tâches 3 et 4 n'appellent que ces deux fonctions.

**Point d'attention majeur :** le catalogue est chargé **après** l'évaluation des modules (il arrive à l'ouverture de l'onglet). Ce module doit donc lire `window.SEVEN_DS_WIKI_COMPETENCES` **à chaque appel**, jamais à l'évaluation. Écrire `const CATALOGUE = window.SEVEN_DS_WIKI_COMPETENCES` en tête du module donnerait un objet vide à vie. C'est la différence avec `js/noyau/constantes.js`, dont les données sont posées par des `<script>` classiques avant les modules.

- [ ] **Step 1: Écrire le test du module**

Créer `tests/wiki-competences.test.js` :

```js
"use strict";

/* Le module métier du wiki : regroupement par arme et ordre d'affichage.

   Il est lu ici en isolation, avec un faux catalogue posé sur un `window`
   fabriqué : c'est ce qui permet de tester l'ordre sans dépendre des données
   réelles, qui changent à chaque mise à jour du jeu. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RACINE = path.join(__dirname, "..");

function charger(catalogue){
  const source = fs
    .readFileSync(path.join(RACINE, "js", "metier", "wiki-competences.js"), "utf8")
    .replace(/^export\s*\{[\s\S]*?\};?\s*$/m, "");
  const contexte = { window:{ SEVEN_DS_WIKI_COMPETENCES:catalogue } };
  vm.runInNewContext(
    source + "\nthis.__api = { competencesParArme, armesDuHeros };",
    contexte,
    { filename:"wiki-competences.js" }
  );
  return contexte.__api;
}

const competence = (gameId, weaponType, categorie) => ({
  gameId, weaponType, categorie,
  nomFr:gameId, descriptionFr:"desc", recharge:null
});

/* L'ordre d'affichage : passif, Q, E, R, TAG, attaque sautée. La source les
   publie dans un ordre quelconque — ici volontairement à l'envers. */
{
  const { competencesParArme } = charger({
    derieri:[
      competence("derieri_axe_jumpatk", "Axe", "NORMAL"),
      competence("derieri_axe_skill_tag", "Axe", "NORMAL"),
      competence("derieri_axe_skill_r", "Axe", "ULTIMATE"),
      competence("derieri_axe_skill_e", "Axe", "NORMAL"),
      competence("derieri_axe_skill_q", "Axe", "NORMAL"),
      competence("derieri_axe_passive", "Axe", "PASSIVE")
    ]
  });
  assert.deepEqual(
    competencesParArme("derieri").Axe.map(c => c.gameId),
    [
      "derieri_axe_passive",
      "derieri_axe_skill_q",
      "derieri_axe_skill_e",
      "derieri_axe_skill_r",
      "derieri_axe_skill_tag",
      "derieri_axe_jumpatk"
    ]
  );
}

/* Les suffixes composés du jeu — `skill_q_1`, `skill_r_enchant` — désignent
   bien la même touche et doivent se ranger au même endroit. */
{
  const { competencesParArme } = charger({
    derieri:[
      competence("derieri_gauntlets_skill_r_enchant", "Gauntlets", "ULTIMATE"),
      competence("derieri_gauntlets_skill_q_1", "Gauntlets", "NORMAL"),
      competence("derieri_gauntlets_passive", "Gauntlets", "PASSIVE")
    ]
  });
  assert.deepEqual(
    competencesParArme("derieri").Gauntlets.map(c => c.gameId),
    [
      "derieri_gauntlets_passive",
      "derieri_gauntlets_skill_q_1",
      "derieri_gauntlets_skill_r_enchant"
    ]
  );
}

/* Un suffixe inconnu est rangé en fin, jamais perdu : le wiki doit montrer
   une compétence inédite plutôt que la taire. */
{
  const { competencesParArme } = charger({
    derieri:[
      competence("derieri_axe_skill_inconnu", "Axe", "NORMAL"),
      competence("derieri_axe_passive", "Axe", "PASSIVE")
    ]
  });
  assert.deepEqual(
    competencesParArme("derieri").Axe.map(c => c.gameId),
    ["derieri_axe_passive", "derieri_axe_skill_inconnu"]
  );
}

// Le regroupement sépare bien les armes, et `armesDuHeros` suit l'ordre source.
{
  const { competencesParArme, armesDuHeros } = charger({
    derieri:[
      competence("derieri_gauntlets_passive", "Gauntlets", "PASSIVE"),
      competence("derieri_axe_passive", "Axe", "PASSIVE"),
      competence("derieri_gauntlets_skill_q", "Gauntlets", "NORMAL")
    ]
  });
  assert.deepEqual(armesDuHeros("derieri"), ["Gauntlets", "Axe"]);
  assert.equal(competencesParArme("derieri").Gauntlets.length, 2);
  assert.equal(competencesParArme("derieri").Axe.length, 1);
}

/* Le catalogue arrive APRÈS l'évaluation des modules : tant qu'il manque, le
   site doit rester affichable plutôt que lever. */
{
  const { competencesParArme, armesDuHeros } = charger(undefined);
  assert.deepEqual(competencesParArme("derieri"), {});
  assert.deepEqual(armesDuHeros("derieri"), []);
}

// Un héros absent du catalogue ne lève pas non plus.
{
  const { competencesParArme, armesDuHeros } = charger({ derieri:[] });
  assert.deepEqual(competencesParArme("inconnu"), {});
  assert.deepEqual(armesDuHeros("inconnu"), []);
}

console.log("PASS wiki : regroupement et ordre des compétences");
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/wiki-competences.test.js`
Expected: FAIL — `ENOENT` sur `js/metier/wiki-competences.js`.

- [ ] **Step 3: Écrire le module**

Créer `js/metier/wiki-competences.js` :

```js
/* Regroupement et ordre des competences du wiki. Pur : ni DOM, ni reseau.

   Le catalogue est charge A LA DEMANDE, a la premiere ouverture de l'onglet
   Wiki — donc APRES l'evaluation de ce module. Le lire ici a l'evaluation
   (`const CATALOGUE = window.SEVEN_DS_WIKI_COMPETENCES`) donnerait un objet
   vide a vie. D'ou l'accesseur, appele a chaque fois.

   C'est la difference avec noyau/constantes.js, dont les donnees sont posees
   par des <script> classiques avant les modules. */

  const catalogue = () => window.SEVEN_DS_WIKI_COMPETENCES || {};

  /* L'ordre d'affichage d'une arme, dans la logique du jeu : ce que le heros
     est en permanence (le passif), puis ses touches, puis l'attaque sautee.
     Les marques sont cherchees en SOUS-CHAINE : la source ecrit
     `skill_q_1` et `skill_r_enchant` pour des variantes de la meme touche. */
  const ORDRE = ["passive", "skill_q", "skill_e", "skill_r", "skill_tag", "jumpatk"];

  /* Un suffixe inconnu passe en fin plutot que d'etre perdu : le jour ou le
     jeu ajoute une touche, le wiki doit la montrer, pas la taire. */
  const rangDe = gameId => {
    const rang = ORDRE.findIndex(marque => String(gameId || "").includes(marque));
    return rang === -1 ? ORDRE.length : rang;
  };

  const competencesDe = slug => {
    const liste = slug && catalogue()[slug];
    return Array.isArray(liste) ? liste : [];
  };

  function competencesParArme(slug){
    const parArme = {};
    competencesDe(slug).forEach(competence => {
      const arme = competence.weaponType;
      if(!arme) return;
      (parArme[arme] = parArme[arme] || []).push(competence);
    });
    /* `sort` est stable : a rang egal, l'ordre de la source est conserve. */
    Object.values(parArme).forEach(liste => {
      liste.sort((a, b) => rangDe(a.gameId) - rangDe(b.gameId));
    });
    return parArme;
  }

  const armesDuHeros = slug => Object.keys(competencesParArme(slug));

export {
  armesDuHeros,
  competencesParArme
};
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `node tests/wiki-competences.test.js`
Expected: PASS — `PASS wiki : regroupement et ordre des compétences`.

- [ ] **Step 5: Inscrire le module au registre**

Dans `tests/helpers/modules.js`, ajouter `"metier/wiki-competences.js",` dans la couche `metier`, après `"metier/accueil-logique.js",`.

- [ ] **Step 6: Câbler le test dans `npm test`**

Dans `package.json`, ajouter aux scripts `test` **et** `test:unit`, après `node tests/wiki-catalogue.test.js` :

```
 && node tests/wiki-competences.test.js
```

- [ ] **Step 7: Lancer la suite unitaire**

Run: `npm run test:unit`
Expected: PASS de bout en bout.

Note : `tests/pwa.test.js` peut échouer ici en réclamant le module dans `CORE_ASSETS`. Si c'est le cas, ajouter `"./js/metier/wiki-competences.js"` à `CORE_ASSETS` dans `sw.js`, à la suite de `"./js/metier/accueil-logique.js"`, et relancer.

- [ ] **Step 8: Commit**

```bash
git add js/metier/wiki-competences.js tests/wiki-competences.test.js tests/helpers/modules.js package.json sw.js
git commit -m "feat: regrouper et ordonner les competences du wiki"
```

---

## Task 3: L'onglet, la grille et les filtres

**Files:**
- Create: `js/vues/wiki.js`
- Create: `css/wiki.css`
- Create: `tests/wiki.playwright.js`
- Modify: `index.html` (onglet, section, lien de feuille)
- Modify: `js/app.js`, `sw.js`, `tests/helpers/modules.js`, `tests/css-ordre.test.js`, `package.json`

**Interfaces:**
- Consomme : `competencesParArme` de la tâche 2 ; `DATA`, `META`, `ELEMENTS`, `WSLOT_ROLES` de `js/noyau/constantes.js` ; `el`, `$`, `norm` de `js/noyau/dom.js` ; `enregistrerVue` de `js/vues/navigation.js`.
- Produit :
  - `renderWiki() → Promise<true>` — enregistré sous le nom de vue `"wiki"`.
  - `chargerCatalogue() → Promise<true>` — injecte `data/wiki-competences.js` une seule fois ; rejette si le fichier est introuvable.
  - La tâche 4 branche l'ouverture de la fiche sur le clic d'une tuile via `ouvrirFiche`, une fonction que la tâche 4 fournira et que la tâche 3 laisse en point d'extension explicite.

- [ ] **Step 1: Écrire le test de bout en bout de la grille**

Créer `tests/wiki.playwright.js` :

```js
"use strict";

/* Le wiki, dans un vrai navigateur : l'onglet, la grille, les filtres.

   La tâche 4 complétera ce fichier avec la fiche en modale et le mode hors
   ligne. */

const assert = require("node:assert/strict");
const { serveRepo } = require("./helpers/serve");
const { chromium } = require("playwright");

(async()=>{
  const server = await serveRepo();
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try{
    await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
      route.fulfill({ status:200, contentType:"application/javascript", body:"" })
    );
    await page.goto(server.url + "/index.html");

    /* Le catalogue ne doit PAS être chargé tant que l'onglet n'est pas
       ouvert : c'est tout l'intérêt de le tenir hors du précache. */
    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_WIKI_COMPETENCES),
      "undefined",
      "le catalogue ne doit pas être chargé avant l'ouverture de l'onglet"
    );

    await page.locator("#tab-wiki").click();
    await page.locator("#view-wiki").waitFor({ state:"visible" });
    await page.locator("#wikiGrid .wiki-tile").first().waitFor();

    assert.equal(
      await page.evaluate(() => typeof window.SEVEN_DS_WIKI_COMPETENCES),
      "object",
      "l'ouverture de l'onglet doit charger le catalogue"
    );

    const total = await page.locator("#wikiGrid .wiki-tile").count();
    assert.ok(total >= 25, "la grille doit lister tous les héros, reçu "+total);

    // La recherche par nom.
    await page.locator("#wikiSearch").fill("derieri");
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length === 1
    );
    assert.equal(
      await page.locator("#wikiGrid .wiki-tile").first().getAttribute("title"),
      "Derieri"
    );

    // Un filtre de catégorie, dérivé des métadonnées.
    await page.locator("#wikiSearch").fill("");
    await page.locator("#wikiFilterElement").selectOption("DARK");
    await page.waitForFunction(
      () => document.querySelectorAll("#wikiGrid .wiki-tile").length > 0
    );
    const sombres = await page.locator("#wikiGrid .wiki-tile").count();
    assert.ok(sombres > 0 && sombres < total,
      "le filtre élément doit restreindre la grille, reçu "+sombres+"/"+total);

    // Une recherche sans résultat annonce le vide plutôt que de le laisser nu.
    await page.locator("#wikiFilterElement").selectOption("");
    await page.locator("#wikiSearch").fill("zzzzz");
    await page.locator("#wikiEmpty").waitFor({ state:"visible" });

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
  } finally {
    await browser.close();
    await server.close();
  }

  console.log("PASS Playwright: wiki, grille et filtres");
})();
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/wiki.playwright.js`
Expected: FAIL — le sélecteur `#tab-wiki` n'existe pas (timeout).

- [ ] **Step 3: Ajouter l'onglet, la section et la feuille dans `index.html`**

Après le bouton `#tab-boss` dans `<nav class="tabs">` :

```html
    <button class="tab" id="tab-wiki" data-view="wiki"
            role="tab" aria-controls="view-wiki"
            aria-selected="false" tabindex="-1">Wiki</button>
```

Après la section `#view-boss` :

```html
  <!-- ============ WIKI ============ -->
  <section id="view-wiki" class="view" role="tabpanel"
           aria-labelledby="tab-wiki">
    <p class="section-eyebrow">Référence</p>
    <h1 class="section-title">Wiki</h1>
    <p class="section-lead">Les compétences et les passifs de chaque héros, arme par arme, en français.</p>
    <div class="wiki-categories" role="tablist" aria-label="Catégories du wiki">
      <button class="wiki-category active" id="wikiCategoryHeros" type="button"
              role="tab" aria-selected="true">Personnages</button>
    </div>
    <div class="wiki-filters">
      <label class="wiki-field">
        <span>Recherche</span>
        <input id="wikiSearch" type="search" placeholder="Nom d'un héros…"
               autocomplete="off">
      </label>
      <label class="wiki-field">
        <span>Élément</span>
        <select id="wikiFilterElement"></select>
      </label>
      <label class="wiki-field">
        <span>Arme</span>
        <select id="wikiFilterWeapon"></select>
      </label>
      <label class="wiki-field">
        <span>Rôle</span>
        <select id="wikiFilterRole"></select>
      </label>
      <label class="wiki-field">
        <span>Rareté</span>
        <select id="wikiFilterRarity"></select>
      </label>
    </div>
    <p class="wiki-state" id="wikiState" role="status" aria-live="polite"></p>
    <p class="wiki-empty" id="wikiEmpty" hidden>Aucun héros ne correspond à cette recherche.</p>
    <div class="wiki-grid" id="wikiGrid"></div>
  </section>
```

Dans `<head>`, après `<link rel="stylesheet" href="./css/dispos.css">` :

```html
<link rel="stylesheet" href="./css/wiki.css">
```

- [ ] **Step 4: Écrire la feuille de style**

Créer `css/wiki.css` :

```css
/* Onglet Wiki : rail de categories, filtres, grille de heros.
   Charge en dernier : il ne surcharge rien, il n'est surcharge par rien. */

.wiki-categories{
  display:flex; gap:8px; flex-wrap:wrap; margin:0 0 16px;
}
.wiki-category{
  background:var(--panel); color:var(--ink);
  border:1px solid var(--line); border-radius:999px;
  padding:6px 16px; font:inherit; cursor:pointer;
}
.wiki-category.active{
  border-color:var(--gold); color:var(--gold);
}

.wiki-filters{
  display:grid; gap:12px; margin:0 0 16px;
  grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
}
.wiki-field{ display:flex; flex-direction:column; gap:4px; }
.wiki-field > span{ font-size:.82rem; opacity:.75; }
.wiki-field input, .wiki-field select{
  background:var(--panel); color:var(--ink);
  border:1px solid var(--line); border-radius:8px;
  padding:8px 10px; font:inherit; min-height:44px;
}

.wiki-state, .wiki-empty{ opacity:.8; margin:0 0 16px; }

.wiki-grid{
  display:grid; gap:12px;
  grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));
}
.wiki-tile{
  display:flex; flex-direction:column; align-items:center; gap:6px;
  background:var(--panel); color:var(--ink);
  border:1px solid var(--line); border-radius:12px;
  padding:10px 6px; font:inherit; cursor:pointer;
}
.wiki-tile:hover, .wiki-tile:focus-visible{ border-color:var(--gold); }
.wiki-tile img{ width:72px; height:72px; border-radius:10px; }
.wiki-tile-name{ font-size:.85rem; text-align:center; }
```

Si une variable CSS employée ici n'existe pas dans `css/base.css`, reprendre celles qu'emploie `css/roster.css` pour les mêmes rôles plutôt que d'en inventer.

- [ ] **Step 5: Écrire la vue**

Créer `js/vues/wiki.js` :

```js
/* L'onglet Wiki : rail de categories, filtres, grille de heros.

   Le catalogue des competences n'est PAS precache : ~200 Ko de prose pour un
   onglet qu'on ouvre deliberement. Il est injecte a la premiere ouverture,
   par une balise <script> classique — la meme forme que les autres fichiers
   de donnees, qui posent tous un window.*. Le gestionnaire `fetch` du service
   worker le met en cache au passage, donc hors ligne ensuite.

   Les valeurs des filtres sont derivees de SEVEN_DS_META : aucune liste
   d'elements, de roles ou de raretes n'est ecrite ici. Un heros ajoute au jeu
   apparait donc sans toucher a ce fichier. */

import { DATA, ELEMENTS, META, WEAPON_ENUM, WSLOT_ROLES, metaOf }
  from "../noyau/constantes.js";
import { $, el, norm } from "../noyau/dom.js";

  const RARETES = { SSR:"SSR", SR:"SR", R:"R" };

  /* Point d'extension : la tache 4 y branche l'ouverture de la fiche. Tant
     qu'il vaut null, une tuile reste inerte plutot que de lever. */
  let ouvrirFiche = null;
  const brancherFiche = fonction => { ouvrirFiche = fonction; };

  let chargement = null;

  function chargerCatalogue(){
    if(window.SEVEN_DS_WIKI_COMPETENCES) return Promise.resolve(true);
    if(chargement) return chargement;
    chargement = new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src:"./data/wiki-competences.js",
        onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable"))
      }));
    }).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner l'onglet pour la
         duree de la session. */
      chargement = null;
      throw erreur;
    });
    return chargement;
  }

  /* Les valeurs d'un filtre, dans l'ordre du dictionnaire de libelles, et
     restreintes a ce que les heros portent reellement. */
  function valeursDe(cle, libelles){
    const portees = new Set();
    Object.values(META).forEach(meta => {
      if(cle === "weapon") (meta.weapons||[]).forEach(slot => portees.add(slot.weapon));
      else if(meta[cle]) portees.add(meta[cle]);
    });
    return Object.keys(libelles)
      .filter(valeur => portees.has(valeur))
      .map(valeur => ({
        valeur,
        libelle:libelles[valeur].label || libelles[valeur]
      }));
  }

  function remplirFiltre(selecteur, valeurs, libelleVide){
    const champ = $(selecteur);
    if(champ.options.length) return;
    champ.appendChild(el("option",{ value:"", text:libelleVide }));
    valeurs.forEach(item => {
      champ.appendChild(el("option",{ value:item.valeur, text:item.libelle }));
    });
    champ.addEventListener("change", renderGrid);
  }

  function correspond(character){
    const meta = metaOf(character.id) || {};
    const recherche = norm($("#wikiSearch").value.trim());
    if(recherche && !norm(character.name).includes(recherche)) return false;
    const element = $("#wikiFilterElement").value;
    if(element && meta.element !== element) return false;
    const role = $("#wikiFilterRole").value;
    if(role && meta.role !== role) return false;
    const rarete = $("#wikiFilterRarity").value;
    if(rarete && meta.rarity !== rarete) return false;
    const arme = $("#wikiFilterWeapon").value;
    if(arme && !(meta.weapons||[]).some(slot => slot.weapon === arme)) return false;
    return true;
  }

  function tuile(character){
    return el("button",{
      class:"wiki-tile",
      type:"button",
      title:character.name,
      dataset:{ char:character.id },
      onclick:()=>{ if(ouvrirFiche) ouvrirFiche(character.id, retenus()); }
    },[
      el("img",{ src:character.file, alt:"", loading:"lazy" }),
      el("span",{ class:"wiki-tile-name", text:character.name })
    ]);
  }

  const retenus = () => (DATA.personnages||[]).filter(correspond);

  function renderGrid(){
    const grille = $("#wikiGrid");
    grille.innerHTML = "";
    const liste = retenus();
    liste.forEach(character => grille.appendChild(tuile(character)));
    $("#wikiEmpty").hidden = liste.length > 0;
  }

  function renderWiki(){
    const etat = $("#wikiState");
    if(window.SEVEN_DS_WIKI_COMPETENCES){
      etat.textContent = "";
      renderGrid();
      return Promise.resolve(true);
    }
    etat.textContent = "Chargement du wiki…";
    return chargerCatalogue().then(()=>{
      etat.textContent = "";
      remplirFiltre("#wikiFilterElement", valeursDe("element", ELEMENTS), "Tous les éléments");
      remplirFiltre("#wikiFilterWeapon", valeursDe("weapon", WEAPON_ENUM), "Toutes les armes");
      remplirFiltre("#wikiFilterRole", valeursDe("role", WSLOT_ROLES_MAJ), "Tous les rôles");
      remplirFiltre("#wikiFilterRarity", valeursDe("rarity", RARETES), "Toutes les raretés");
      renderGrid();
      return true;
    }).catch(()=>{
      etat.textContent = "Le wiki n’a pas pu être chargé. Vérifie ta connexion "
        + "puis rouvre l’onglet.";
      return true;
    });
  }

  /* SEVEN_DS_META parle en MAJUSCULES (`ATTACKER`), WSLOT_ROLES en vocabulaire
     de slot (`Attacker`). Le filtre de role s'appuie sur le premier. */
  const WSLOT_ROLES_MAJ = Object.fromEntries(
    Object.entries(WSLOT_ROLES).map(([enumeration, libelle]) =>
      [enumeration.toUpperCase(), libelle])
  );

  $("#wikiSearch").addEventListener("input", renderGrid);

export { brancherFiche, chargerCatalogue, renderWiki };
```

**Attention à l'ordre d'évaluation :** `WSLOT_ROLES_MAJ` est un `const` employé dans `renderWiki`, appelé bien après l'évaluation du module — c'est légal. Si la lecture gêne, le déplacer plus haut ; ne pas le transformer en `var`.

- [ ] **Step 6: Câbler la vue**

Dans `js/app.js`, ajouter l'import après `import { renderDashboardView } from "./vues/suivi.js";` :

```js
import { renderWiki } from "./vues/wiki.js";
```

et l'enregistrement après `enregistrerVue("availability", renderAvailabilityView);` :

```js
  enregistrerVue("wiki", renderWiki);
```

Dans `tests/helpers/modules.js`, ajouter `"vues/wiki.js",` dans la couche `vues`, après `"vues/session-auth.js",`.

Dans `tests/css-ordre.test.js`, ajouter `"wiki"` en fin du tableau `FEUILLES`.

Dans `sw.js`, ajouter `"./css/wiki.css"` à la suite de `"./css/dispos.css"` et `"./js/vues/wiki.js"` à la suite de `"./js/vues/session-auth.js"` dans `CORE_ASSETS`. **Ne pas y ajouter `./data/wiki-competences.js`** : c'est le point de conception de la tâche, et `tests/wiki.playwright.js` échouerait.

- [ ] **Step 7: Lancer le test de bout en bout**

Run: `node tests/wiki.playwright.js`
Expected: PASS — `PASS Playwright: wiki, grille et filtres`.

- [ ] **Step 8: Câbler le test dans `npm test`**

Dans `package.json`, ajouter aux scripts `test` **et** `test:e2e`, en fin de chaîne :

```
 && node tests/wiki.playwright.js
```

- [ ] **Step 9: Lancer la suite complète**

Run: `npm test`
Expected: PASS de bout en bout. Note : `supabase-etape1.playwright.js` et `accessibilite-mobile.playwright.js` sont connus pour échouer par intermittence — les relancer seuls avant de conclure à une régression.

- [ ] **Step 10: Commit**

```bash
git add index.html css/wiki.css js/vues/wiki.js js/app.js sw.js tests/helpers/modules.js tests/css-ordre.test.js tests/wiki.playwright.js package.json
git commit -m "feat: ouvrir l'onglet wiki sur la grille des heros"
```

---

## Task 4: La fiche d'un héros

**Files:**
- Create: `js/vues/wiki-fiche-heros.js`
- Modify: `index.html` (la modale), `js/vues/wiki.js` (branchement), `css/wiki.css`, `sw.js`, `tests/helpers/modules.js`, `tests/wiki.playwright.js`, `AGENTS.md`

**Interfaces:**
- Consomme : `competencesParArme`, `armesDuHeros` (tâche 2) ; `brancherFiche` (tâche 3) ; `charOf` de `js/metier/catalogue.js` ; `renderBonus` de `js/vues/elements.js` ; `ModalStack` de `js/vues/modal-stack.js` ; `POT`, `POT_MAX`, `WEAPON_ENUM`, `ELEMENTS`, `ENUM_TO_FOLDER`, `BUILD_STATS`, `metaOf` de `js/noyau/constantes.js` ; `linkedArmorsOf` de `js/metier/armes.js` ; `formatBuildStatValue` de `js/vues/stats-affichage.js`.
- Forme des données consommées, relevée dans `data/stats-build.js` :
  - `BUILD_STATS.charactersBySlug[slug].baseStats` → `[{ stat: "B_MaxHp", value: 2000 }, …]`
  - `BUILD_STATS.charactersBySlug[slug].masteriesByWeapon[arme]` → `{ levels: 5, abilities: [{ stat, value, source:{ level, kind, index } }, …] }` (68 entrées pour Derieri/Axe)
  - `BUILD_STATS.statLabels[code]` → `{ fr, family, unit }` où `unit` vaut `"flat"` ou `"ten-thousandths"`
  - `formatBuildStatValue(value, unit)` **lève** sur une unité inconnue : toujours l'appeler dans un `try`.
- Produit : `ouvrirFicheWiki(charId: string, entries: {id:string,name:string,file:string}[]) → void`, passée à `brancherFiche()` au chargement du module.

- [ ] **Step 1: Compléter le test de bout en bout**

Dans `tests/wiki.playwright.js`, remplacer le bloc final (depuis le commentaire « Une recherche sans résultat… » jusqu'à l'assertion `errors`) par :

```js
    // Une recherche sans résultat annonce le vide plutôt que de le laisser nu.
    await page.locator("#wikiFilterElement").selectOption("");
    await page.locator("#wikiSearch").fill("zzzzz");
    await page.locator("#wikiEmpty").waitFor({ state:"visible" });

    // La fiche d'un héros : ouverture, contenu, changement d'arme.
    await page.locator("#wikiSearch").fill("");
    await page.locator('#wikiGrid .wiki-tile[data-char="derieri"]').click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.equal(
      await page.locator("#wikiHeroTitle").textContent(),
      "Derieri"
    );

    const armes = await page.locator(".wiki-hero-weapon").count();
    assert.equal(armes, 3, "Derieri a trois types d'arme");

    // Le passif vient en tête des compétences de l'arme affichée.
    assert.equal(
      await page.locator(".wiki-skill").first().locator(".wiki-skill-kind")
        .textContent(),
      "Passif"
    );
    const premiereArme = await page.locator(".wiki-skill-name").first().textContent();

    // Changer d'arme change les compétences affichées.
    await page.locator(".wiki-hero-weapon").nth(1).click();
    await page.waitForFunction(
      nom => document.querySelector(".wiki-skill-name").textContent !== nom,
      premiereArme
    );

    /* Le balisage couleur du jeu est rendu, pas affiché tel quel : c'est le
       contrat de renderBonus(). */
    assert.equal(
      await page.locator(".wiki-skill-desc").first().evaluate(
        node => node.textContent.includes("[#")
      ),
      false,
      "le balisage couleur doit être rendu, pas laissé brut"
    );
    assert.ok(
      await page.locator(".wiki-skill-desc span[style*='color']").count() > 0,
      "au moins une portion colorée attendue"
    );

    // La navigation clavier passe au héros suivant.
    const avant = await page.locator("#wikiHeroTitle").textContent();
    await page.locator("#wikiHeroOverlay").press("ArrowRight");
    await page.waitForFunction(
      nom => document.querySelector("#wikiHeroTitle").textContent !== nom,
      avant
    );

    await page.locator("#wikiHeroClose").click();
    await page.locator("#wikiHeroOverlay.on").waitFor({ state:"detached" });

    /* Hors ligne : le catalogue a été mis en cache par le service worker au
       premier passage, la fiche doit donc rester consultable. */
    await page.context().setOffline(true);
    await page.reload();
    await page.locator("#tab-wiki").click();
    await page.locator('#wikiGrid .wiki-tile[data-char="derieri"]').click();
    await page.locator("#wikiHeroOverlay.on").waitFor();
    assert.ok(
      await page.locator(".wiki-skill").count() > 0,
      "la fiche doit rester consultable hors ligne"
    );
    await page.context().setOffline(false);

    assert.deepEqual(errors, [], "aucune erreur de page attendue");
```

Et remplacer la ligne finale par :

```js
  console.log("PASS Playwright: wiki, grille, filtres et fiche de héros");
```

**Si le test hors ligne s'avère instable** (le service worker peut ne pas avoir pris le contrôle au premier chargement), ne pas le supprimer : attendre explicitement `navigator.serviceWorker.ready` avant `setOffline(true)`, comme le fait `tests/pwa-update.playwright.js`.

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node tests/wiki.playwright.js`
Expected: FAIL — timeout sur `#wikiHeroOverlay.on`, la modale n'existe pas.

- [ ] **Step 3: Ajouter la modale dans `index.html`**

Après le bloc `<div class="overlay" id="rosterDetailOverlay" …>…</div>` :

```html
<!-- Fiche de héros du wiki -->
<div class="overlay" id="wikiHeroOverlay" role="dialog" aria-modal="true"
     aria-labelledby="wikiHeroTitle" aria-hidden="true">
  <div class="modal rostermodal">
    <div class="picker-head">
      <span class="picker-title" id="wikiHeroTitle">Personnage</span>
      <button class="icon-btn" id="wikiHeroClose" aria-label="Fermer">✕</button>
    </div>
    <div class="roster-detail-nav">
      <button class="icon-btn" id="wikiHeroPrev" type="button"
              aria-label="Personnage précédent">‹</button>
      <span class="roster-detail-position" id="wikiHeroPosition"
            aria-live="polite"></span>
      <button class="icon-btn" id="wikiHeroNext" type="button"
              aria-label="Personnage suivant">›</button>
    </div>
    <div class="roster-detail-body" id="wikiHeroBody"></div>
  </div>
</div>
```

- [ ] **Step 4: Écrire la fiche**

Créer `js/vues/wiki-fiche-heros.js` :

```js
/* La fiche d'un heros dans le wiki : lecture seule.

   Elle ne reutilise pas heroDetail() de fiche-heros.js, qui decrit un BUILD —
   un heros equipe, avec ses pieces et ses statistiques calculees. Ici on
   decrit un PERSONNAGE : ce qu'il sait faire, independamment de tout
   equipement.

   Le comportement de navigation (precedent, suivant, fleches clavier,
   compteur) reprend celui de detail-roster.js, deja eprouve. */

import {
  BUILD_STATS, ELEMENTS, ENUM_TO_FOLDER, POT, POT_MAX, WEAPON_ENUM, metaOf
} from "../noyau/constantes.js";
import { $, el } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { linkedArmorsOf } from "../metier/armes.js";
import { armesDuHeros, competencesParArme } from "../metier/wiki-competences.js";
import { renderBonus } from "./elements.js";
import { ModalStack } from "./modal-stack.js";
import { formatBuildStatValue } from "./stats-affichage.js";
import { brancherFiche } from "./wiki.js";

  const fiche = { entries:[], index:0, arme:null };

  /* Le libelle de la touche, lu sur le gameId. Les suffixes composes du jeu
     (`skill_q_1`, `skill_r_enchant`) designent la meme touche. */
  const TOUCHES = [
    ["passive", "Passif"],
    ["skill_q", "Q"],
    ["skill_e", "E"],
    ["skill_r", "R"],
    ["skill_tag", "Tag"],
    ["jumpatk", "Attaque sautée"]
  ];
  function toucheDe(gameId){
    const trouve = TOUCHES.find(([marque]) => String(gameId||"").includes(marque));
    return trouve ? trouve[1] : "Compétence";
  }

  function blocCompetence(competence){
    const entete = el("div",{class:"wiki-skill-head"},[
      el("span",{class:"wiki-skill-kind", text:toucheDe(competence.gameId)}),
      el("span",{class:"wiki-skill-name", text:competence.nomFr})
    ]);
    /* Une recharge absente n'est pas une recharge nulle : on ne l'annonce
       pas plutot que d'afficher « 0 s ». */
    if(competence.recharge !== null && competence.recharge !== undefined){
      entete.appendChild(
        el("span",{class:"wiki-skill-cd", text:competence.recharge+" s"})
      );
    }
    return el("div",{class:"wiki-skill"},[
      entete,
      el("p",{class:"wiki-skill-desc", html:renderBonus(competence.descriptionFr)})
    ]);
  }

  function selecteurArmes(armes){
    const rangee = el("div",{class:"wiki-hero-weapons"});
    armes.forEach(arme => {
      const libelle = (WEAPON_ENUM[arme] && WEAPON_ENUM[arme].label) || arme;
      rangee.appendChild(el("button",{
        class:"wiki-hero-weapon"+(arme === fiche.arme ? " active" : ""),
        type:"button",
        "aria-pressed":String(arme === fiche.arme),
        text:libelle,
        onclick:()=>{ fiche.arme = arme; renderFiche(); }
      }));
    });
    return rangee;
  }

  function repliable(titre, contenu){
    if(!contenu) return null;
    return el("details",{class:"wiki-fold"},[
      el("summary",{text:titre}),
      contenu
    ]);
  }

  function blocPotentiels(charId, arme){
    const dossier = ENUM_TO_FOLDER[arme];
    const paliers = (POT[charId] || {})[dossier];
    if(!Array.isArray(paliers) || !paliers.length) return null;
    const liste = el("ol",{class:"wiki-pot"});
    paliers.slice(0, POT_MAX).forEach((texte, index) => {
      if(!texte) return;
      liste.appendChild(el("li",{},[
        el("span",{class:"wiki-pot-tier", text:"P"+(index+1)}),
        el("span",{class:"wiki-pot-text", html:renderBonus(texte)})
      ]));
    });
    return liste.children.length ? liste : null;
  }

  /* Un code de stat rendu lisible. Le libelle francais et l'unite viennent du
     catalogue, jamais d'une table ecrite ici : un code inedit doit apparaitre
     des la regeneration, sans toucher a ce fichier. Un code absent du
     catalogue est tu plutot que d'afficher « B_Atk » a un membre. */
  function ligneDeStat(code, valeur){
    const libelle = (BUILD_STATS.statLabels || {})[code];
    if(!libelle || !libelle.fr) return null;
    let texte;
    try{
      texte = formatBuildStatValue(valeur, libelle.unit);
    }catch(erreur){
      return null;
    }
    return el("li",{class:"wiki-stat"},[
      el("span",{class:"wiki-stat-name", text:libelle.fr}),
      el("span",{class:"wiki-stat-value", text:texte})
    ]);
  }

  function blocStatsDeBase(charId){
    const personnage = (BUILD_STATS.charactersBySlug || {})[charId];
    const stats = personnage && personnage.baseStats;
    if(!Array.isArray(stats) || !stats.length) return null;
    const liste = el("ul",{class:"wiki-stats"});
    stats.forEach(item => {
      const ligne = ligneDeStat(item.stat, item.value);
      if(ligne) liste.appendChild(ligne);
    });
    return liste.children.length ? liste : null;
  }

  /* Le total qu'apporte la branche de maitrise une fois montee.

     La source la publie apport par apport (68 entrees pour Derieri a la
     hache : sous-niveaux et noeuds). Les sommer n'est pas une interpretation :
     `masteryTerms()` dans metier/stats-calcul.js pose chacune comme un terme
     ADDITIF dans un meme seau. On reprend donc sa semantique, sans la
     redemontrer. */
  function blocMaitrises(charId, arme){
    const personnage = (BUILD_STATS.charactersBySlug || {})[charId];
    const branche = personnage
      && personnage.masteriesByWeapon
      && personnage.masteriesByWeapon[arme];
    const apports = branche && branche.abilities;
    if(!Array.isArray(apports) || !apports.length) return null;
    const totaux = new Map();
    apports.forEach(item => {
      if(!item || !item.stat) return;
      const cumul = (totaux.get(item.stat) || 0) + Number(item.value || 0);
      totaux.set(item.stat, cumul);
    });
    const liste = el("ul",{class:"wiki-stats"});
    totaux.forEach((valeur, code) => {
      if(valeur === 0) return;
      const ligne = ligneDeStat(code, valeur);
      if(ligne) liste.appendChild(ligne);
    });
    return liste.children.length ? liste : null;
  }

  function blocArmuresLiees(charId){
    const fichiers = linkedArmorsOf(charId);
    if(!fichiers.length) return null;
    const rangee = el("div",{class:"wiki-linked"});
    fichiers.forEach(fichier => {
      rangee.appendChild(el("img",{
        src:fichier, alt:"", loading:"lazy",
        title:fichier.split("/").pop().replace(/\.webp$/i, "")
      }));
    });
    return rangee;
  }

  function renderFiche(){
    const entree = fiche.entries[fiche.index];
    const corps = $("#wikiHeroBody");
    corps.innerHTML = "";
    if(!entree) return;
    const character = charOf(entree.id);
    if(!character) return;

    $("#wikiHeroTitle").textContent = character.name;
    $("#wikiHeroPosition").textContent =
      (fiche.index + 1) + " / " + fiche.entries.length;
    const precedent = $("#wikiHeroPrev");
    const suivant = $("#wikiHeroNext");
    /* Le navigateur retire le focus d'un bouton des qu'il devient `disabled` :
       on le rend au controle encore utilisable plutot que de le perdre. */
    const actif = document.activeElement;
    precedent.disabled = fiche.index <= 0;
    suivant.disabled = fiche.index >= fiche.entries.length - 1;
    if((actif === precedent || actif === suivant) && actif.disabled){
      const repli = actif === precedent ? suivant : precedent;
      (repli.disabled ? $("#wikiHeroClose") : repli).focus();
    }

    const meta = metaOf(entree.id) || {};
    const element = ELEMENTS[meta.element];
    corps.appendChild(el("div",{class:"wiki-hero-head"},[
      el("img",{class:"wiki-hero-portrait", src:character.file, alt:"", loading:"lazy"}),
      el("div",{class:"wiki-hero-id"},[
        el("div",{class:"wiki-hero-name", text:character.name}),
        el("div",{class:"wiki-hero-badges", text:[
          meta.rarity, element && element.label
        ].filter(Boolean).join(" · ")})
      ])
    ]));

    const armes = armesDuHeros(entree.id);
    if(!armes.length){
      corps.appendChild(el("p",{
        class:"wiki-hero-hint",
        text:"Aucune compétence connue pour ce personnage."
      }));
      return;
    }
    if(!fiche.arme || !armes.includes(fiche.arme)) fiche.arme = armes[0];
    corps.appendChild(selecteurArmes(armes));

    const parArme = competencesParArme(entree.id);
    (parArme[fiche.arme] || []).forEach(competence => {
      corps.appendChild(blocCompetence(competence));
    });

    [
      repliable("Potentiels", blocPotentiels(entree.id, fiche.arme)),
      repliable("Maîtrises d’arme", blocMaitrises(entree.id, fiche.arme)),
      repliable("Stats de base", blocStatsDeBase(entree.id)),
      repliable("Armures gravées", blocArmuresLiees(entree.id))
    ].forEach(bloc => { if(bloc) corps.appendChild(bloc); });
  }

  function deplacer(pas){
    const suivant = fiche.index + pas;
    if(suivant < 0 || suivant >= fiche.entries.length) return;
    fiche.index = suivant;
    fiche.arme = null;
    renderFiche();
  }

  function fermer(){ ModalStack.close($("#wikiHeroOverlay")); }

  function ouvrirFicheWiki(charId, entries){
    const liste = Array.isArray(entries) && entries.length ? entries : [];
    const index = liste.findIndex(item => item.id === charId);
    if(index === -1) return;
    const declencheur = document.activeElement;
    fiche.entries = liste;
    fiche.index = index;
    fiche.arme = null;
    renderFiche();
    ModalStack.open(
      $("#wikiHeroOverlay"), "#wikiHeroClose", fermer, declencheur
    );
  }

  $("#wikiHeroClose").addEventListener("click", fermer);
  $("#wikiHeroPrev").addEventListener("click", ()=>deplacer(-1));
  $("#wikiHeroNext").addEventListener("click", ()=>deplacer(1));
  $("#wikiHeroOverlay").addEventListener("click", event => {
    if(event.target === $("#wikiHeroOverlay")) fermer();
  });
  $("#wikiHeroOverlay").addEventListener("keydown", event => {
    if(event.key === "ArrowLeft"){ event.preventDefault(); deplacer(-1); }
    else if(event.key === "ArrowRight"){ event.preventDefault(); deplacer(1); }
  });

  brancherFiche(ouvrirFicheWiki);

export { ouvrirFicheWiki };
```

- [ ] **Step 5: Câbler la fiche**

Dans `js/app.js`, importer le module pour qu'il s'enregistre, après l'import de `renderWiki` :

```js
import "./vues/wiki-fiche-heros.js";
```

Dans `tests/helpers/modules.js`, ajouter `"vues/wiki-fiche-heros.js",` **après** `"vues/wiki.js",` : il en dépend, l'ordre des couches doit le refléter.

Dans `sw.js`, ajouter `"./js/vues/wiki-fiche-heros.js"` à la suite de `"./js/vues/wiki.js"`.

- [ ] **Step 6: Compléter la feuille de style**

Ajouter à la fin de `css/wiki.css` :

```css
.wiki-hero-head{ display:flex; gap:12px; align-items:center; margin:0 0 12px; }
.wiki-hero-portrait{ width:72px; height:72px; border-radius:10px; }
.wiki-hero-name{ font-size:1.1rem; }
.wiki-hero-badges{ font-size:.85rem; opacity:.8; }

.wiki-hero-weapons{ display:flex; gap:8px; flex-wrap:wrap; margin:0 0 16px; }
.wiki-hero-weapon{
  background:var(--panel); color:var(--ink);
  border:1px solid var(--line); border-radius:999px;
  padding:6px 14px; font:inherit; cursor:pointer; min-height:44px;
}
.wiki-hero-weapon.active{ border-color:var(--gold); color:var(--gold); }

.wiki-skill{
  border:1px solid var(--line); border-radius:10px;
  padding:10px 12px; margin:0 0 10px;
}
.wiki-skill-head{ display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
.wiki-skill-kind{
  font-size:.75rem; letter-spacing:.06em; text-transform:uppercase;
  opacity:.7;
}
.wiki-skill-name{ font-weight:600; }
.wiki-skill-cd{ margin-left:auto; font-size:.8rem; opacity:.75; }
.wiki-skill-desc{ margin:6px 0 0; line-height:1.5; }

.wiki-fold{ border-top:1px solid var(--line); padding:10px 0 0; margin:10px 0 0; }
.wiki-fold > summary{ cursor:pointer; min-height:44px; display:flex; align-items:center; }
.wiki-pot{ margin:8px 0 0; padding-left:18px; }
.wiki-pot-tier{ font-weight:600; margin-right:6px; }
.wiki-stats{ margin:8px 0 0; padding:0; list-style:none; }
.wiki-stat{
  display:flex; justify-content:space-between; gap:12px;
  padding:4px 0; border-bottom:1px solid var(--line);
}
.wiki-stat:last-child{ border-bottom:0; }
.wiki-stat-value{ font-variant-numeric:tabular-nums; opacity:.9; }
.wiki-linked{ display:flex; gap:8px; flex-wrap:wrap; margin:8px 0 0; }
.wiki-linked img{ width:56px; height:56px; border-radius:8px; }
```

- [ ] **Step 7: Lancer le test de bout en bout**

Run: `node tests/wiki.playwright.js`
Expected: PASS — `PASS Playwright: wiki, grille, filtres et fiche de héros`.

- [ ] **Step 8: Lancer la suite complète**

Run: `npm test`
Expected: PASS de bout en bout.

- [ ] **Step 9: Documenter dans `AGENTS.md`**

Dans la liste `├─ scripts/`, ajouter après `generate-meta.py` :

```
│  ├─ generate-wiki.py            # Régénère wiki-competences.js (compétences FR + passifs).
```

Dans la liste des fichiers de `data/`, ajouter :

```
│  ├─ wiki-competences.js        # Compétences et passifs FR par héros (catalogue du wiki).
```

Et ajouter une section, avant `## Conventions` :

```markdown
## Wiki — catalogue des compétences

`data/wiki-competences.js` pose `window.SEVEN_DS_WIKI_COMPETENCES` :
`{ [slug]: [{ gameId, weaponType, categorie, nomFr, descriptionFr, recharge }] }`.
Régénérable par `python scripts/generate-wiki.py`, qui lit les pages
**françaises** `7dsorigin.app/fr/characters/<slug>`. 18 compétences par héros,
six par type d'arme, **passifs compris**.

Ne pas le confondre avec `data/competences.js` (comparateur de dégâts) : celui-là
est un catalogue de **calcul**, en anglais, dont les passifs sont exclus par
construction. Les deux coexistent volontairement tant que le comparateur n'a pas
atterri sur `main` ; leur fusion est un chantier à ouvrir après.

**Ce fichier n'est pas précaché.** ~200 Ko de prose pour un onglet qu'on ouvre
délibérément : `js/vues/wiki.js` l'injecte par une balise `<script>` à la
première ouverture, et `cacheFirst` de `sw.js` le met en cache au passage.
Conséquence : `js/metier/wiki-competences.js` lit `window.SEVEN_DS_WIKI_COMPETENCES`
**à chaque appel**, jamais à l'évaluation du module.
```

- [ ] **Step 10: Commit**

```bash
git add index.html css/wiki.css js/vues/wiki-fiche-heros.js js/app.js sw.js tests/helpers/modules.js tests/wiki.playwright.js AGENTS.md
git commit -m "feat: ouvrir la fiche wiki d'un heros, arme par arme"
```

---

## Self-review du plan

**Couverture de la spec :**

| Exigence de la spec | Tâche |
|---|---|
| `scripts/generate-wiki.py`, forme du fichier, garde-fous, `--check` | 1 |
| Liste des héros depuis `7ds-stats/personnages.json` | 1, step 3 |
| `js/metier/wiki-competences.js`, ordre passif → saut, héros absent | 2 |
| Suffixe inconnu rangé en fin | 2, step 1 |
| Onglet, rail de catégories, grille, filtres dérivés de META, recherche | 3 |
| Chargement à la demande, état d'attente, message d'échec | 3, step 5 |
| Fiche en modale, prev/suivant, flèches clavier, compteur | 4 |
| Sélecteur d'arme, six compétences, `renderBonus` | 4 |
| Blocs repliables : potentiels, maîtrises, stats de base, armures liées | 4 |
| Fiche distincte de `heroDetail()` | 4, en-tête du module |
| `sw.js` : modules et CSS précachés, données non | 3 step 6, 4 step 5 |
| Les cinq tests annoncés | 1, 2, 3, 4 |
| `AGENTS.md` | 4, step 9 |

**Deux corrections issues de la relecture du plan**, l'une et l'autre vérifiées contre le code réel plutôt que supposées :

- `masteriesByWeapon[arme]` **n'est pas un tableau** mais `{ levels, abilities }`. Une première rédaction itérait dessus comme sur une liste de niveaux et n'aurait rien affiché.
- **Sommer les apports de maîtrise est légitime** : `masteryTerms()` (`js/metier/stats-calcul.js:308-326`) pose chaque entrée d'`abilities` comme un terme additif dans un même seau. La fiche reprend cette sémantique au lieu d'en inventer une.

Les stats de base et les maîtrises sont donc bien au plan, contrairement à ce qu'une première lecture laissait croire : `formatBuildStatValue(value, unit)` et `BUILD_STATS.statLabels[code]` suffisent à les rendre lisibles, sans extraire quoi que ce soit de `js/vues/stats-heros.js`.

**Cohérence des noms :** `competencesParArme` et `armesDuHeros` (tâche 2) sont appelées sous ces noms exacts en tâche 4. `brancherFiche` est exportée en tâche 3 et importée en tâche 4. `ouvrirFiche` est la variable interne de `js/vues/wiki.js` ; `ouvrirFicheWiki` est la fonction de `js/vues/wiki-fiche-heros.js` qui lui est passée — les deux noms sont volontairement distincts.

**Points de vigilance signalés aux implémenteurs :**
- Le catalogue lu à chaque appel, jamais à l'évaluation (tâche 2).
- `data/wiki-competences.js` hors de `CORE_ASSETS` (tâche 3, step 6).
- Le seuil de 400 Ko qui rouvre la conception (tâche 1, step 5).
