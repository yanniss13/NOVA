# Khala End-to-End Content Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer Khala depuis les tables locales du jeu et la rendre utilisable dans tous les catalogues, vues et calculs de NOVA sans publier les exports bruts ni inventer de valeurs.

**Architecture:** Un extracteur Node privé transforme les tables sous `DONNEES_JEU` en un instantané réduit `7ds-stats/contenu-jeu.json`. Un module Python commun fusionne cet instantané dans les générateurs existants ; les scripts locaux régénèrent ensuite assets, statistiques, compétences et catalogues dérivés. Les vues restent pilotées par les données et ne reçoivent aucun cas particulier `khala`.

**Tech Stack:** JavaScript Node 24, Python 3 et `unittest`, PowerShell, Pillow pour la conversion PNG→WebP, modules ES du site, Playwright, fichiers de données JavaScript statiques.

**Spec:** `docs/superpowers/specs/2026-09-17-import-contenu-khala-design.md`

## Global Constraints

- Importer uniquement les héros jouables possédant un nom français, trois maîtrises et une fiche complète ; exclure explicitement `409100119` et `409100124`.
- Utiliser le slug public `khala` pour l'identité interne `Calla` / héros `1029`.
- Mapper `SwordDual`, `Cudgel3c`, `Gauntlets` vers `Epees doubles`, `Nunchaku`, `Gantelets`.
- Ne jamais enregistrer le chemin absolu de `DONNEES_JEU` dans un fichier versionné.
- Ne jamais éditer directement un fichier `data/` sans modifier le générateur qui le produit.
- Ne jamais modifier `data/animations-mesurees.json` : ce fichier reste exclusivement manuel.
- Toute description générée contenant encore `/{\d+}/` fait échouer la génération.
- Les tables donnent des faits ; la prose seule ne doit jamais créer une règle numérique ambiguë.
- Préserver les fichiers non suivis existants sous `assets/ambiance/` et `outils/fmodel/`.
- Ne créer aucune migration Supabase : tous les nouveaux champs restent dans les catalogues statiques existants.

---

### Task 1: Extracteur normalisé du contenu jouable

**Files:**
- Create: `outils/fabrication/contenu-jouable.js`
- Create: `tests/contenu-jouable-source.test.js`
- Modify: `scripts/lancer-tests.js`
- Generate: `7ds-stats/contenu-jeu.json`

**Interfaces:**
- Consumes: `DONNEES_JEU`, les tables et localisations nommées dans la spec.
- Produces: `extraireDepuisTables(tables): Snapshot`, `extraireContenu(racine): Snapshot`, `substituer(texte, remplacements): string`, `validerSnapshot(snapshot): void`.
- `Snapshot` vaut `{version:1, heroes:{khala:HeroSnapshot}}` ; `HeroSnapshot`
  porte `id`, `internalName`, `nameFr`, `nameEn`, `meta`, `character`,
  `potentials`, `wikiSkills`, `calculatorSkills`, `effectSources`,
  `linkedArmors` et `assets`. `effectSources` vaut
  `{skills: RawEffectSource[], potentials: RawEffectSource[]}` et conserve les
  textes FR/EN ainsi que les lignes de buff strictement nécessaires au
  normaliseur existant.

- [ ] **Step 1: Écrire les tests unitaires en échec**

```js
const assert = require("node:assert/strict");
const {
  substituer, filtrerHerosJouables, validerSnapshot
} = require("../outils/fabrication/contenu-jouable.js");

assert.equal(
  substituer("Inflige {0} pendant {1}s.", ["{0}:{294%}", "{1}:{10}"]),
  "Inflige 294% pendant 10s."
);
assert.deepEqual(
  filtrerHerosJouables([
    {id:"1029", internalName:"Calla", nameFr:"Khala", weapons:["SwordDual","Cudgel3c","Gauntlets"]},
    {id:"409100119", internalName:null, nameFr:null, weapons:["Axe","Cudgel3c","Shield"]}
  ]).map(hero => hero.id),
  ["1029"]
);
assert.throws(
  () => validerSnapshot({version:1, heroes:{khala:{
    id:"1029", nameFr:"Khala", potentials:{SwordDual:["reste {0}"]}
  }}}),
  /placeholder.*khala/i
);
```

- [ ] **Step 2: Lancer le test et vérifier l'échec attendu**

Run: `node tests/contenu-jouable-source.test.js`  
Expected: FAIL avec `Cannot find module '../outils/fabrication/contenu-jouable.js'`.

- [ ] **Step 3: Implémenter les primitives pures et le chargeur de tables**

```js
"use strict";
const fs = require("node:fs");
const path = require("node:path");

function substituer(texte, remplacements){
  let sortie = String(texte || "");
  for(const brut of remplacements || []){
    const match = /^\{(\d+)\}:\{(.*)\}$/.exec(String(brut));
    if(match) sortie = sortie.split("{" + match[1] + "}").join(match[2]);
  }
  return sortie;
}

function filtrerHerosJouables(heroes){
  return heroes.filter(hero =>
    hero.nameFr && hero.internalName && hero.weapons.length === 3
  );
}

function lireTable(racine, relatif){
  const brut = JSON.parse(fs.readFileSync(path.join(racine, "Table", relatif), "utf8"));
  return (Array.isArray(brut) ? brut[0] : brut).Rows || {};
}
```

Le CLI doit exiger `DONNEES_JEU`, construire l'objet complet en mémoire, appeler `validerSnapshot`, puis écrire `7ds-stats/contenu-jeu.json` avec un renommage atomique. Il doit refuser tout héros autre que `1029` tant qu'il n'est pas localisé et explicitement jouable.

- [ ] **Step 4: Ajouter les invariants complets du snapshot**

`validerSnapshot` doit exiger pour Khala : trois armes uniques, dix potentiels
par arme, dix-huit compétences Wiki, quinze compétences de calcul, une source
d'effet par compétence ou potentiel qui en porte réellement un, treize stats
de base utiles au moteur, trois branches de maîtrise à cinq niveaux, trois
armures liées et zéro placeholder. Le test doit construire un fixture nominal
minimal avec ces cardinalités et prouver qu'il passe.

- [ ] **Step 5: Ajouter le test au lanceur unitaire**

Ajouter `"node tests/contenu-jouable-source.test.js"` juste avant les tests de catalogues dans `SUITES.unit`.

- [ ] **Step 6: Générer le vrai instantané**

Run:

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content exporté')).Path
node outils/fabrication/contenu-jouable.js
```

Expected: `1 héros jouable extrait : khala`, `2 entrées anonymes ignorées`, et création de `7ds-stats/contenu-jeu.json` sans chemin absolu.

- [ ] **Step 7: Vérifier et committer**

Run: `node tests/contenu-jouable-source.test.js`  
Expected: PASS.

```bash
git add outils/fabrication/contenu-jouable.js tests/contenu-jouable-source.test.js scripts/lancer-tests.js 7ds-stats/contenu-jeu.json
git commit -m "feat(import): extraire le contenu jouable de Khala"
```

---

### Task 2: Importer et convertir les assets de Khala

**Files:**
- Create: `outils/fabrication/importer-assets-jouables.py`
- Create: `tests/test_importer_assets_jouables.py`
- Modify: `scripts/lancer-tests.js`
- Create: `7ds-personnages/khala.webp`
- Create: `7ds-ui/skills/Calla_*.webp` (les icônes propres citées par le snapshot)
- Create: `7ds-armures-ssr/Armure liee/<nom français>.webp` (trois fichiers)

**Interfaces:**
- Consumes: `7ds-stats/contenu-jeu.json`, `DONNEES_JEU/UIImg`.
- Produces: `import_assets(snapshot_path, export_root, repo_root) -> list[pathlib.Path]` et les WebP référencés par les catalogues.

- [ ] **Step 1: Écrire les tests en échec avec des PNG temporaires**

```python
def test_convertit_uniquement_les_assets_declares(self):
    snapshot = {"version": 1, "heroes": {"khala": {"assets": {
        "portrait": {"source": "slot_Calla_001.png", "target": "7ds-personnages/khala.webp"},
        "skills": [], "linkedArmors": []
    }}}}
    produits = module.import_assets(snapshot, self.exports, self.repo)
    self.assertEqual([p.relative_to(self.repo).as_posix() for p in produits],
                     ["7ds-personnages/khala.webp"])
    with Image.open(produits[0]) as image:
        self.assertEqual(image.format, "WEBP")
```

Ajouter aussi les cas : source absente, cible dupliquée et tentative de cible hors des trois racines autorisées.

- [ ] **Step 2: Vérifier l'échec**

Run: `python -m unittest tests/test_importer_assets_jouables.py`  
Expected: FAIL car le module n'existe pas.

- [ ] **Step 3: Implémenter la conversion sûre**

```python
ALLOWED_TARGETS = (
    "7ds-personnages/", "7ds-ui/skills/",
    "7ds-armures-ssr/Armure liee/",
)

def safe_target(repo_root, relative):
    if not relative.startswith(ALLOWED_TARGETS):
        raise ValueError(f"cible asset interdite: {relative}")
    target = (repo_root / relative).resolve()
    target.relative_to(repo_root.resolve())
    return target

def convert_png(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".tmp")
    with Image.open(source) as image:
        image.convert("RGBA").save(temporary, "WEBP", lossless=True)
    temporary.replace(target)
```

Les icônes communes d'attaque normale et de relève déjà présentes ne doivent pas être dupliquées.

- [ ] **Step 4: Importer les vrais assets et vérifier leurs références**

Run:

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content exporté')).Path
python outils/fabrication/importer-assets-jouables.py
```

Expected: un portrait, les icônes propres de Khala et trois armures liées sont écrits ; aucune autre image n'est copiée.

- [ ] **Step 5: Ajouter le test au lanceur et committer**

Ajouter `"python -m unittest tests/test_importer_assets_jouables.py"` dans `SUITES.unit`.

```bash
git add outils/fabrication/importer-assets-jouables.py tests/test_importer_assets_jouables.py scripts/lancer-tests.js 7ds-personnages/khala.webp 7ds-ui/skills 7ds-armures-ssr/Armure\ liee
git commit -m "feat(assets): importer les visuels jouables de Khala"
```

---

### Task 3: Fusionner Khala dans les références, métadonnées et potentiels

**Files:**
- Create: `scripts/client_content.py`
- Create: `tests/test_client_content.py`
- Modify: `scripts/generate-stats.py`
- Modify: `scripts/generate-meta.py`
- Modify: `scripts/generate-potentiels.py`
- Modify: `scripts/generate-stats-build.py`
- Modify: `tests/test_generate_stats.py`
- Modify: `tests/test_generate_stats_build.py`
- Modify: `tests/stats-build-catalog.test.js`
- Modify: `tests/badges-role-element.test.js`
- Generate: `7ds-stats/personnages.json`
- Generate: `data/personnages-meta.js`
- Generate: `data/potentiels.js`
- Generate: `data/stats-build.js`

**Interfaces:**
- Consumes: `7ds-stats/contenu-jeu.json` produit en Task 1.
- Produces: `load_snapshot(path=None)`, `merge_mapping(base, section, replace_client=False)`, `merge_characters(base, replace_client=False)`, `semantic_hash_without_slugs(payload, slugs)` et les quatre catalogues générés.

- [ ] **Step 1: Écrire les tests de fusion en échec**

```python
def test_merge_characters_preserve_existing_and_add_khala(self):
    existing = [{"slug": "ban", "nameFr": "Ban"}]
    snapshot = {"version": 1, "heroes": {"khala": {
        "character": {"slug": "khala", "nameFr": "Khala"}
    }}}
    result = module.merge_characters(existing, snapshot)
    self.assertEqual([row["slug"] for row in result], ["ban", "khala"])
    self.assertEqual(existing, [{"slug": "ban", "nameFr": "Ban"}])

def test_duplicate_slug_is_rejected(self):
    with self.assertRaisesRegex(ValueError, "slug dupliqué.*khala"):
        module.merge_characters([{"slug":"khala"}], self.snapshot)
```

Tester aussi `version != 1`, fichier absent, section inconnue et ordre déterministe.
Tester enfin que `replace_client=True` remplace uniquement `khala`, tandis que
`replace_client=False` refuse une collision avec une source historique.

- [ ] **Step 2: Vérifier l'échec**

Run: `python -m unittest tests/test_client_content.py`  
Expected: FAIL car `scripts/client_content.py` n'existe pas.

- [ ] **Step 3: Implémenter le module de fusion partagé**

```python
ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_SNAPSHOT = ROOT / "7ds-stats" / "contenu-jeu.json"

def load_snapshot(path=DEFAULT_SNAPSHOT):
    payload = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    if payload.get("version") != 1:
        raise ValueError("version de contenu-jeu incompatible")
    return payload

def merge_mapping(base, section, snapshot=None, replace_client=False):
    result = copy.deepcopy(base)
    for slug, hero in sorted((snapshot or load_snapshot())["heroes"].items()):
        if slug in result and not replace_client:
            raise ValueError(f"slug dupliqué dans {section}: {slug}")
        result[slug] = copy.deepcopy(hero[section])
    return result
```

- [ ] **Step 4: Brancher les générateurs avec un mode local ciblé**

Dans `generate-stats.py`, fusionner `personnages` juste avant `write`. Dans
`generate-meta.py` et `generate-potentiels.py`, fusionner respectivement les
sections `meta` et `potentials`. Leur exécution normale conserve la source
historique puis refuse une collision de slug. Ajouter aux trois scripts
`--client-only`, qui charge la sortie commitée, remplace uniquement les slugs
du snapshot avec `replace_client=True`, écrit atomiquement, puis prouve avec
`semantic_hash_without_slugs` que les 26 autres héros sont byte-sémantiquement
inchangés. Ajouter `--check` à `generate-meta.py` et
`generate-potentiels.py` : le mode charge le fichier commité et vérifie que ses
clés égalent exactement les slugs de `7ds-stats/personnages.json`.

- [ ] **Step 5: Régénérer les références et le catalogue de build**

Run:

```powershell
python scripts/generate-stats.py --client-only
python scripts/generate-meta.py --client-only
python scripts/generate-potentiels.py --client-only
python scripts/generate-stats-build.py
```

Expected: 27 héros dans les quatre sorties ; Khala possède treize stats de base,
trois maîtrises et trente instantanés de potentiel ; les empreintes des 26
héros préexistants sont identiques avant/après.

- [ ] **Step 6: Remplacer les littéraux de cardinalité par les nouveaux contrats**

Dans `tests/stats-build-catalog.test.js`, exiger 27 personnages. Dans les tests de badges et potentiels, vérifier explicitement :

```js
assert.deepEqual(
  meta.khala.weapons.map(slot => slot.weapon),
  ["SwordDual", "Cudgel3c", "Gauntlets"]
);
assert.deepEqual(
  Object.keys(potentiels.khala),
  ["Epees doubles", "Nunchaku", "Gantelets"]
);
```

- [ ] **Step 7: Vérifier et committer**

Run:

```powershell
python -m unittest tests/test_client_content.py tests/test_generate_stats.py tests/test_generate_stats_build.py
python scripts/generate-meta.py --check
python scripts/generate-potentiels.py --check
python scripts/generate-stats-build.py --check
node tests/stats-build-catalog.test.js
node tests/badges-role-element.test.js
```

Expected: toutes les commandes passent.

```bash
git add scripts/client_content.py scripts/generate-stats.py scripts/generate-meta.py scripts/generate-potentiels.py scripts/generate-stats-build.py tests/test_client_content.py tests/test_generate_stats.py tests/test_generate_stats_build.py tests/stats-build-catalog.test.js tests/badges-role-element.test.js 7ds-stats/personnages.json data/personnages-meta.js data/potentiels.js data/stats-build.js
git commit -m "feat(catalogues): ajouter les stats et potentiels de Khala"
```

---

### Task 4: Générer le Wiki, les compétences et les effets DPS de Khala

**Files:**
- Modify: `scripts/generate-wiki.py`
- Modify: `scripts/generate-competences.py`
- Modify: `scripts/generate-effets-dps.py`
- Modify: `tests/test_generate_wiki.py`
- Modify: `tests/test_generate_competences.py`
- Modify: `tests/test_generate_effets_dps.py`
- Modify: `tests/wiki-catalogue.test.js`
- Modify: `tests/competences-catalogue.test.js`
- Modify: `tests/effets-dps-catalogue.test.js`
- Generate: `data/wiki-competences.js`
- Generate: `data/competences.js`
- Generate: `data/effets-dps.js`

**Interfaces:**
- Consumes: `client_content.load_snapshot()`, sections `wikiSkills`,
  `calculatorSkills`, `effectSources`, et les catalogues de Task 3.
- Produces: 18 entrées Wiki et 15 compétences de calcul pour `khala`, plus leurs classifications d'effets démontrables.

- [ ] **Step 1: Écrire les tests de source locale en échec**

```python
def test_khala_uses_snapshot_without_network(self):
    local = [{"gameId":"calla_sworddual_passive", "categorie":"PASSIVE",
              "weaponType":"SwordDual", "nomFr":"Copieuse",
              "descriptionFr":"Description", "recharge":0,
              "icone":"Calla_SwordDual_Passive.webp"}]
    with mock.patch.object(module, "client_wiki_skills", return_value=local), \
         mock.patch.object(module, "_gen.fetch", side_effect=AssertionError("réseau")):
        self.assertEqual(module.competences_du("khala"), local)
```

Ajouter le même garde à `generate-competences.py` et `generate-effets-dps.py` : Khala vient du snapshot, les autres héros conservent leur source historique.

- [ ] **Step 2: Vérifier les échecs**

Run:

```powershell
python -m unittest tests/test_generate_wiki.py tests/test_generate_competences.py tests/test_generate_effets_dps.py
```

Expected: FAIL sur les fonctions de fallback local absentes.

- [ ] **Step 3: Implémenter les fallbacks par slug**

```python
def client_section(slug, section):
    return (load_snapshot().get("heroes", {}).get(slug) or {}).get(section)

def competences_du(slug):
    locales = client_section(slug, "wikiSkills")
    if locales is not None:
        valide(slug, locales)
        return copy.deepcopy(locales)
    payload = _gen.flight_payload(_gen.fetch(FICHE.format(slug=slug)))
    return competences_du_payload(payload)
```

Dans le calculateur, utiliser `calculatorSkills` déjà normalisées. Dans les
effets, injecter `effectSources.skills` et
`effectSources.potentials` avec `hero:"khala"` afin de réutiliser
`collecter_sources` et `normaliser_effet` ; toute phrase offensive
non classée doit continuer à faire échouer la génération. Ajouter
`--client-only` aux trois générateurs : il charge le catalogue commité, remplace
uniquement les entrées dont le slug ou la provenance est `khala`, puis compare
l'empreinte du reste du catalogue. L'exécution normale garde les sources
historiques pour les autres héros.

- [ ] **Step 4: Régénérer dans l'ordre**

Run:

```powershell
python scripts/generate-wiki.py --client-only
python scripts/generate-competences.py --client-only
python scripts/generate-effets-dps.py --client-only
```

Expected: Khala apparaît avec 18 entrées Wiki, 15 compétences de calcul et des
sources d'effets classées ; aucun accès réseau n'est effectué ; l'empreinte des
sections non-Khala reste identique.

- [ ] **Step 5: Renforcer les tests de catalogues**

Ajouter :

```js
assert.equal(catalogue.khala.length, 18, "Khala : 18 compétences Wiki");
assert.equal(compCalc.khala.length, 15, "Khala : 15 compétences calculables ou explicitement non chiffrées");
assert.ok(effets.heroes.khala, "Khala : effets de potentiel/passifs absents");
assert.ok(
  effets.audit.sources.some(source => source.id === "hero-passive:calla_sworddual_passive"),
  "le passif Épées doubles de Khala doit être audité"
);
```

- [ ] **Step 6: Vérifier et committer**

Run:

```powershell
python -m unittest tests/test_generate_wiki.py tests/test_generate_competences.py tests/test_generate_effets_dps.py
python scripts/generate-wiki.py --check
python scripts/generate-competences.py --check
python scripts/generate-effets-dps.py --check
node tests/wiki-catalogue.test.js
node tests/competences-catalogue.test.js
node tests/effets-dps-catalogue.test.js
```

```bash
git add scripts/generate-wiki.py scripts/generate-competences.py scripts/generate-effets-dps.py tests/test_generate_wiki.py tests/test_generate_competences.py tests/test_generate_effets_dps.py tests/wiki-catalogue.test.js tests/competences-catalogue.test.js tests/effets-dps-catalogue.test.js data/wiki-competences.js data/competences.js data/effets-dps.js
git commit -m "feat(calculateur): intégrer les compétences de Khala"
```

---

### Task 5: Intégrer les armures liées et transcendances de Khala

**Files:**
- Modify: `scripts/generate-armures-liees.py`
- Modify: `tests/test_generate_armures_liees.py`
- Modify: `outils/fabrication/extraire-gravees-non-declarees.js`
- Modify: `outils/fabrication/extraire-transcendances.js`
- Modify: `tests/transcendances-catalogue.test.js`
- Modify: `tests/stats-build-catalog.test.js`
- Generate: `7ds-stats/armures-gravees.json`
- Generate: `data/armures-liees.js`
- Generate: `data/stats-build.js`
- Generate: `data/transcendances.js`

**Interfaces:**
- Consumes: `HeroSnapshot.linkedArmors`, les trois WebP de Task 2 et les tables d'équipement locales.
- Produces: trois armures liées sélectionnables, leurs statistiques/passifs et trois transcendances associées à Khala.

- [ ] **Step 1: Écrire les tests en échec**

Ajouter à `test_generate_armures_liees.py` un override client :

```python
def test_client_rows_complete_public_candidates(self):
    rows = [{"char":"khala", "name":"Tenue de Khala", "game_id":"133000029"}]
    mapping = module.build_mapping(
        "", self.armor_dir, self.character_dir, client_rows=rows
    )
    self.assertEqual(mapping["khala"], [
        "7ds-armures-ssr/Armure liee/Tenue de Khala.webp"
    ])
```

Dans le test des transcendances, remplacer les littéraux 26/78 par 27/81 et exiger trois entrées distinctes pour `khala`.

- [ ] **Step 2: Vérifier les échecs**

Run:

```powershell
python -m unittest tests/test_generate_armures_liees.py
node tests/transcendances-catalogue.test.js
```

Expected: le paramètre `client_rows` est inconnu et Khala manque du catalogue.

- [ ] **Step 3: Fusionner les armures locales avant le rapprochement par nom**

```python
def build_mapping(html, armor_dir=ARMOR_DIR, character_dir=CHARACTER_DIR,
                  client_rows=None):
    candidates = extract_candidates(html) + list(client_rows or [])
    # suite inchangée : unicité par nom, présence du personnage et du fichier
```

Le CLI doit charger `linkedArmors` depuis `client_content.py`. `extraire-gravees-non-declarees.js` doit exporter une fonction pure de normalisation, puis fusionner uniquement les trois équipements de Khala dans `armures-gravees.json` en refusant un `gameId` déjà présent.

- [ ] **Step 4: Régénérer les armures, stats et transcendances**

Run:

```powershell
node outils/fabrication/extraire-gravees-non-declarees.js --fusionner
python scripts/generate-armures-liees.py
python scripts/generate-stats-build.py
node outils/fabrication/extraire-transcendances.js
```

Expected: 27 clés dans `armures-liees.js`, trois tenues pour Khala, 81 transcendances au total, aucune ligne `INCOMPLET`.

- [ ] **Step 5: Vérifier et committer**

Run:

```powershell
python -m unittest tests/test_generate_armures_liees.py tests/test_generate_stats_build.py
python scripts/generate-stats-build.py --check
node tests/stats-build-catalog.test.js
node tests/transcendances-catalogue.test.js
```

```bash
git add scripts/generate-armures-liees.py outils/fabrication/extraire-gravees-non-declarees.js outils/fabrication/extraire-transcendances.js tests/test_generate_armures_liees.py tests/test_generate_stats_build.py tests/transcendances-catalogue.test.js tests/stats-build-catalog.test.js 7ds-stats/armures-gravees.json data/armures-liees.js data/stats-build.js data/transcendances.js
git commit -m "feat(equipement): ajouter les armures liees de Khala"
```

---

### Task 6: Régénérer les catalogues de rotation et de chronométrage

**Files:**
- Modify: `outils/fabrication/ecrire-magie-rotation.js`
- Modify: `tests/magie-rotation-catalogue.test.js`
- Modify: `tests/jauges-releve-catalogue.test.js`
- Modify: `tests/ultimes-combines-catalogue.test.js`
- Modify: `tests/test_lister_chronometrage.py`
- Generate: `7ds-stats/recharges-du-jeu.json`
- Generate: `data/jauges-releve.js`
- Generate: `data/magie-rotation.js`
- Generate: `data/ultimes-combines.js`
- Generate: `data/animations-verrous.json`
- Generate: `data/chronometrage-avancement.json`
- Generate: `docs/chronometrage-animations.md`

**Interfaces:**
- Consumes: catalogues Wiki/calcul de Task 4 et `DONNEES_JEU`.
- Produces: une entrée dérivée pour chaque compétence non passive de Khala ; la table manuelle `animations-mesurees.json` reste inchangée.

- [ ] **Step 1: Écrire le test de sélection directe de source en échec**

Extraire dans `ecrire-magie-rotation.js` :

```js
function sourceDirecte(env){
  if(!env.DONNEES_JEU) return null;
  return path.join(env.DONNEES_JEU, "Table", "Skill", "PC_SkillTable.json");
}
```

Le test exige que `DONNEES_JEU` prime sur `DONNEES_JEU_SOURCES` et que l'erreur nomme le fichier recherché sans référencer une variable inexistante.

- [ ] **Step 2: Vérifier l'échec puis implémenter la priorité**

Run: `node tests/magie-rotation-catalogue.test.js`  
Expected: FAIL avant export/import de `sourceDirecte`.

Implémentation : utiliser le fichier direct s'il existe, sinon le plus récent de `DONNEES_JEU_SOURCES`, sinon lever `PC_SkillTable.json introuvable`.

- [ ] **Step 3: Régénérer les données dérivées dans l'ordre**

```powershell
node outils/fabrication/extraire-recharges.js
python scripts/generate-competences.py --recuperer
node outils/fabrication/ecrire-jauges-releve.js
node outils/fabrication/ecrire-magie-rotation.js
node outils/fabrication/ecrire-ultimes-combines.js
node outils/fabrication/ecrire-verrous.js
python scripts/lister-chronometrage.py
```

Expected: zéro compétence Wiki absente des jauges ou de la magie ; Khala est présente dans chaque catalogue applicable ; `data/animations-mesurees.json` n'apparaît pas dans `git diff`.

- [ ] **Step 4: Rendre les tests de cardinalité dérivés plutôt que fragiles**

Chaque test doit comparer ses clés à la liste non passive du Wiki, puis porter une contre-épreuve explicite Khala :

```js
const khala = wiki.khala.filter(skill => skill.categorie !== "PASSIVE");
khala.forEach(skill => assert.ok(
  Object.prototype.hasOwnProperty.call(magie, skill.gameId),
  "magie absente pour " + skill.gameId
));
```

Dans `test_lister_chronometrage.py`, remplacer le total littéral 23 par la somme recalculée depuis les groupes produits, tout en gardant les invariants de priorité et de couverture.

- [ ] **Step 5: Vérifier et committer**

Run:

```powershell
node tests/jauges-releve-catalogue.test.js
node tests/magie-rotation-catalogue.test.js
node tests/ultimes-combines-catalogue.test.js
python -m unittest tests/test_lister_chronometrage.py
python scripts/lister-chronometrage.py --check
```

```bash
git add outils/fabrication/ecrire-magie-rotation.js tests/magie-rotation-catalogue.test.js tests/jauges-releve-catalogue.test.js tests/ultimes-combines-catalogue.test.js tests/test_lister_chronometrage.py 7ds-stats/recharges-du-jeu.json data/jauges-releve.js data/magie-rotation.js data/ultimes-combines.js data/animations-verrous.json data/chronometrage-avancement.json docs/chronometrage-animations.md data/competences.js
git commit -m "feat(rotation): intégrer les compétences de Khala"
```

---

### Task 7: Régénérer l'inventaire d'assets et prouver les parcours visibles

**Files:**
- Modify: `data/data.js` (généré)
- Modify: `tests/wiki.playwright.js`
- Modify: `tests/calculateur.playwright.js`
- Modify: `tests/analyse-recensements.playwright.js`
- Modify: `tests/collection.playwright.js`
- Modify: `tests/rotation-equipe.playwright.js`
- Create: `tests/khala.playwright.js`
- Modify: `scripts/lancer-tests.js`

**Interfaces:**
- Consumes: tous les catalogues et assets des Tasks 2 à 6.
- Produces: parcours navigateur prouvant Builder → roster → fiche → Wiki →
  Analyse → Collection → calculateur → rotation pour Khala sur bureau et
  mobile.

- [ ] **Step 1: Régénérer l'inventaire d'assets**

Run: `powershell -ExecutionPolicy Bypass -File scripts/generate-data.ps1`  
Expected: `Personnages : 27` et présence de `7ds-personnages/khala.webp` dans `data/data.js`.

- [ ] **Step 2: Écrire le parcours Playwright en échec**

```js
await page.getByRole("button", {name:/choisir.*personnage/i}).first().click();
await page.getByRole("button", {name:/Khala/i}).click();
assert.equal(
  await page.locator('[data-hero-slot="0"] img').getAttribute("src"),
  "7ds-personnages/khala.webp"
);
await page.getByRole("tab", {name:"Wiki"}).click();
await page.getByPlaceholder(/rechercher/i).fill("Khala");
await assert.equal(await page.locator(".wiki-card").count(), 1);
```

Le test crée ensuite, avec le faux client Supabase déjà injecté par le helper du
projet, une fiche roster `khala` contenant les trois builds. Il la rouvre, lance
le calculateur depuis la fiche et exige `window.SEVEN_DS_SKILLS.khala`,
`window.SEVEN_DS_DPS_EFFECTS.heroes.khala` et une rotation offrant les quinze
compétences non passives. Le même fichier configure un second contexte
`390×844`, vérifie `document.documentElement.scrollWidth <= innerWidth`, ouvre
la fiche de Khala et confirme que ses trois armes sont accessibles avec
`Tab`, `Enter` et `Escape`.

- [ ] **Step 3: Ajouter le parcours au lanceur E2E et corriger uniquement les régressions révélées**

Ajouter `"node tests/khala.playwright.js"` près des parcours Wiki/calculateur.
Étendre les fixtures existantes d'Analyse, Collection et rotation avec une
entrée Khala et ajouter une assertion visible dans chaque fichier : élément et
rôle corrects dans l'Analyse, trois armures liées dans la Collection, quinze
compétences proposées dans la palette de rotation. Les vues étant pilotées par
les données, aucun `if (slug === "khala")` n'est autorisé ; si un rendu casse,
corriger le contrat générique concerné.

- [ ] **Step 4: Vérifier les parcours ciblés**

Run:

```powershell
node tests/khala.playwright.js
node tests/wiki.playwright.js
node tests/calculateur.playwright.js
node tests/analyse-recensements.playwright.js
node tests/collection.playwright.js
node tests/rotation-equipe.playwright.js
node tests/accessibilite-mobile.playwright.js
```

Expected: les sept commandes passent.

- [ ] **Step 5: Committer**

```bash
git add data/data.js tests/khala.playwright.js tests/wiki.playwright.js tests/calculateur.playwright.js tests/analyse-recensements.playwright.js tests/collection.playwright.js tests/rotation-equipe.playwright.js scripts/lancer-tests.js
git commit -m "test(khala): couvrir le parcours complet du nouveau heros"
```

---

### Task 8: Audit final, documentation et suite complète

**Files:**
- Modify: `AGENTS.md`
- Modify: `outils/fabrication/LISEZMOI.md`
- Modify: `README.md` uniquement si ses comptes de héros ou sa provenance deviennent faux.
- Verify: tous les fichiers générés et tests précédents.

**Interfaces:**
- Consumes: implémentation complète des Tasks 1 à 7.
- Produces: documentation exacte, diff audité et branche entièrement vérifiée.

- [ ] **Step 1: Documenter la commande reproductible sans chemin personnel**

Ajouter à `LISEZMOI.md` :

```powershell
$env:DONNEES_JEU = (Resolve-Path (Read-Host 'Dossier Content exporté')).Path
node outils/fabrication/contenu-jouable.js
python outils/fabrication/importer-assets-jouables.py
```

Dans `AGENTS.md`, porter l'état à 27 héros et préciser que Khala vient de l'instantané local normalisé, sans remplacer les sources historiques des 26 autres héros.

- [ ] **Step 2: Vérifier les fichiers générés**

Run:

```powershell
python scripts/generate-meta.py --check
python scripts/generate-potentiels.py --check
python scripts/generate-stats-build.py --check
python scripts/generate-wiki.py --check
python scripts/generate-competences.py --check
python scripts/generate-effets-dps.py --check
python scripts/lister-chronometrage.py --check
```

Expected: toutes les commandes passent.

- [ ] **Step 3: Auditer le diff de données**

Run:

```powershell
git diff --stat 9601933..HEAD
git diff --check
git status --short
```

Vérifier explicitement : aucun chemin absolu vers l'export, aucune modification de `data/animations-mesurees.json`, aucune suppression d'un héros existant, aucun ajout des IDs anonymes, aucun fichier sous `outils/fmodel/` indexé.

- [ ] **Step 4: Lancer toute la suite**

Run: `npm test`  
Expected: code 0, tous les tests unitaires et E2E au vert.

- [ ] **Step 5: Inspection visuelle finale**

Servir le dépôt avec `python -m http.server`, puis inspecter Khala dans : Builder, roster, Wiki, détail d'armure liée, calculateur, rotation d'équipe et viewport 390 px. Confirmer que le portrait n'est ni étiré ni rogné de manière incohérente et qu'aucun texte ne contient `{n}`.

- [ ] **Step 6: Committer la documentation et les corrections finales**

```bash
git add AGENTS.md outils/fabrication/LISEZMOI.md README.md
git commit -m "docs(donnees): documenter l import reproductible de Khala"
```

- [ ] **Step 7: Vérifier l'état final**

Run: `git status --short`  
Expected: seuls les fichiers non suivis préexistants sous `assets/ambiance/` et `outils/fmodel/` restent visibles ; aucun fichier du chantier ne demeure non commité.
