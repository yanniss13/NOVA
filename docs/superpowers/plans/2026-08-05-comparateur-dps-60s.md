# Comparateur DPS 60 s Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à la fiche d'un héros un DPS théorique des compétences sur 60 secondes et une rotation optimale explicable pour comparer ses builds d'arme.

**Architecture:** Deux catalogues générés et commités alimentent des modules métier purs : le catalogue de compétences conserve coefficients, composantes DEF/PV, périodicité et recharge ; le catalogue d'effets transforme les passifs personnels en règles typées et auditées. Un sélecteur construit le contexte du build réel, puis un simulateur événementiel optimise les actions sur `[0, 60 s[` et la vue affiche cycle, DPS, ouverture, priorités, chronologie, hypothèses et exclusions.

**Tech Stack:** Python 3 `unittest` pour les générateurs, JavaScript vanilla ES modules, tests Node avec `vm`, Playwright, PWA statique sans build.

## Global Constraints

- Le site reste statique, sans dépendance d'exécution ni étape de build.
- `npm test` et tous ses sous-tests ne touchent jamais le réseau.
- Une aspiration complète est manuelle ; `--check` ne fait que valider les fichiers commités.
- Les couches restent `noyau → etat → metier → donnees → vues` ; aucun module ne remonte vers une couche interdite.
- Chaque nouveau module métier est inscrit dans `tests/helpers/modules.js`, `sw.js`, l'import du consommateur et `tests/helpers/load-app.js`.
- Aucun caractère backtick n'est ajouté dans `tests/helpers/load-app.js`, qui contient déjà un template literal englobant.
- Les données générées sous `data/` ne sont jamais modifiées à la main.
- Test rouge avant chaque correction ; un test passant malgré le défaut doit être renforcé avant le code.
- Les commentaires sont en français ; les messages de commit sont en français sans accent.
- Niveau, potentiel et niveaux de passifs restent réels ; seules leurs conditions et leurs cumuls sont maximisés.
- Une chance de déclenchement d'un passif est considérée réussie pour ce score
  maximal ; sa recharge interne réelle reste néanmoins respectée.
- Magie et endurance sont illimitées ; l'ultime est disponible ; dégâts de relève et d'attaque combinée exclus.
- Les attaques normales sont mentionnées dans la rotation mais non chiffrées tant que leur cadence n'est pas mesurée.
- Les cinq compétences maintenues de `docs/competences-maintenues-a-tester.md` restent exclues.
- Les dégâts DEF/PV utilisent les totaux du build ; les PV restants valent provisoirement 100 % des PV max.
- La cible reste `CIBLE_REFERENCE` (Banakro), critique en espérance.
- Aucun push n'est effectué sans choix explicite du propriétaire.

---

## File map

### Fichiers créés

- `scripts/generate-effets-dps.py` — collecte, normalise et audite les effets personnels et les interactions des compétences actives.
- `scripts/effets-dps-regles.py` — grammaire déterministe et règles particulières indexées par identifiant stable.
- `data/effets-dps.js` — catalogue d'exécution figé, sans prose à interpréter dans le navigateur.
- `tests/test_generate_effets_dps.py` — dents du générateur et preuve de fonctionnement hors réseau.
- `tests/effets-dps-catalogue.test.js` — cohérence et couverture du catalogue commité.
- `js/metier/dps-effets.js` — sélection des effets réellement actifs pour un build.
- `tests/dps-effets.test.js` — niveau réel, potentiel réel, sets et exclusions.
- `js/metier/dps-simulation.js` — simulateur événementiel et recherche de rotation.
- `tests/dps-simulation.test.js` — fenêtre, recharges, périodiques, transformations et déterminisme.
- `tests/dps-merlin.test.js` — régression intégrée de Merlin foudre.

### Fichiers modifiés

- `scripts/generate-competences.py` — composantes ATK/DEF/PV, périodicité et recharge.
- `data/competences.js` — régénéré, jamais retouché directement.
- `tests/test_generate_competences.py` — fixtures réelles des nouveaux champs.
- `tests/competences-catalogue.test.js` — contrat du catalogue temporel.
- `js/metier/degats-calcul.js` — base multi-stat et modificateurs publiés.
- `tests/degats-calcul.test.js` — formule, composantes et compatibilité du cycle.
- `js/vues/fiche-heros.js` — contexte du build, classement DPS et rendu de rotation.
- `tests/fiche-heros.test.js` — rendu rouge avant intégration.
- `tests/apport-par-piece.playwright.js` — parcours réel de la fiche et détail de rotation.
- `index.html` — chargement du catalogue et styles de la section.
- `sw.js` — précache du catalogue et des deux modules métier.
- `tests/helpers/modules.js` — ordre `dps-effets.js`, puis `dps-simulation.js`.
- `tests/helpers/load-app.js` — données factices et hooks sans ajouter de backtick.
- `tests/pwa.test.js` — ressources essentielles hors ligne.
- `tests/modules-imports.test.js` — inchangé fonctionnellement, valide les nouveaux imports/exports.
- `package.json` — branchement des trois nouveaux tests Node et du test Python dans `test` et `test:unit`.
- `AGENTS.md` — état, hypothèses et protocole vidéo du comparateur.

---

### Task 1: Conserver la temporalité et les bases de chaque compétence

**Files:**
- Modify: `scripts/generate-competences.py:34-214`
- Modify: `tests/test_generate_competences.py:19-178`
- Regenerate: `data/competences.js`
- Modify: `tests/competences-catalogue.test.js:33-100`

**Interfaces:**
- Consumes: objets bruts portant `damagePercent`, `descriptionEn`, `cooldown`, `skillCategory` et `weaponType`.
- Produces: `compacte_competence(skill) -> dict` et les champs JS `composantes`, `periodique`, `recharge`.

- [ ] **Step 1: Écrire les tests Python rouges des composantes et de la recharge**

Ajouter des fixtures qui recopient les formes sources et verrouillent ce contrat :

```python
def test_recharge_decimal_et_periodique_borne(self):
    c = compet(
        "merlin_wand_skill_q",
        "Inflicts damage equal to 16% of Attack every 0.5 sec "
        "to enemies in range for 5 sec.",
        skillCategory="ACTIVE_THIRD",
        cooldown=16.5,
    )
    compact = _gen.compacte_competence(c)
    self.assertEqual(compact["recharge"], 16.5)
    self.assertEqual(compact["composantes"], [
        {"base": "atk", "pourcentage": 160.0}
    ])
    self.assertEqual(compact["periodique"], {
        "base": "atk", "pourcentageParTick": 16.0,
        "intervalle": 0.5, "duree": 5.0, "ticks": 10,
    })

def test_atk_et_defense_restent_deux_composantes(self):
    c = compet(
        "dreydrin_shield_skill_e",
        "Inflicts damage equal to 70% of Attack + 30% of Defense.",
        cooldown=12,
    )
    self.assertEqual(_gen.compacte_competence(c)["composantes"], [
        {"base": "atk", "pourcentage": 70.0},
        {"base": "def", "pourcentage": 30.0},
    ])

def test_pv_restants_utilisent_une_base_distincte(self):
    c = compet(
        "escanor_axe_skill_r",
        "Inflicts damage equal to 397% of Attack + 30% of remaining HP.",
        skillCategory="ULTIMATE",
        cooldown=10,
    )
    self.assertEqual(_gen.compacte_competence(c)["composantes"][-1], {
        "base": "remainingHp", "pourcentage": 30.0
    })
```

- [ ] **Step 2: Lancer le test ciblé et constater l'échec**

Run: `python -m unittest tests/test_generate_competences.py`

Expected: FAIL parce que `compacte_competence` et les nouveaux champs n'existent pas.

- [ ] **Step 3: Ajouter une normalisation unique dans le générateur**

Introduire les expressions pour `Attack`, `Defense`, `Max HP` et `remaining HP`, puis retourner :

```python
def compacte_competence(skill):
    pourcentage, nature = degats_de(skill)
    return {
        "gameId": skill.get("gameId") or skill.get("id"),
        "weaponType": skill.get("weaponType"),
        "categorie": skill.get("skillCategory"),
        "nom": skill.get("nameEn"),
        "pourcentage": pourcentage,
        "nature": nature,
        "composantes": composantes_de(skill),
        "periodique": periodique_de(skill),
        "recharge": nombre_brut(skill.get("cooldown")),
        "coups": skill.get("hitCount"),
        "repartition": repartition_de(skill),
        "portee": skill.get("damType"),
    }
```

`degats_de` conserve le score de cycle historique. `composantes_de` porte la
nouvelle base chiffrée. Les cinq identifiants maintenus sont une constante
nommée et retournent `nature:"non-chiffree"`, `composantes:[]`.

- [ ] **Step 4: Faire passer les tests Python**

Run: `python -m unittest tests/test_generate_competences.py`

Expected: les tests existants et les nouveaux passent.

- [ ] **Step 5: Régénérer manuellement le catalogue avec le réseau**

Run: `python scripts/generate-competences.py`

Expected: 24 personnages écrits dans `data/competences.js`; aucune requête ne sera faite lors de `--check`.

- [ ] **Step 6: Renforcer le test du catalogue commité**

Ajouter les assertions suivantes, dont la régression Merlin :

```js
assert.ok(
  competence.recharge === null
    || (typeof competence.recharge === "number" && competence.recharge > 0)
);
assert.ok(Array.isArray(competence.composantes));
if(competence.periodique){
  assert.ok(competence.periodique.intervalle > 0);
  assert.ok(competence.periodique.duree > 0);
  assert.equal(
    competence.periodique.ticks,
    Math.floor(competence.periodique.duree / competence.periodique.intervalle)
  );
}
const merlin = catalogue.merlin;
assert.equal(
  merlin.find(c => c.gameId === "merlin_wand_skill_e_enchant").recharge,
  19.9
);
assert.equal(
  merlin.find(c => c.gameId === "merlin_wand_skill_q").recharge,
  16.5
);
```

- [ ] **Step 7: Vérifier le catalogue hors réseau**

Run: `node tests/competences-catalogue.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add scripts/generate-competences.py tests/test_generate_competences.py data/competences.js tests/competences-catalogue.test.js
git commit -m "feat: conserver la temporalite des competences"
```

---

### Task 2: Appliquer les composantes DEF/PV et les bonus offensifs publiés

**Files:**
- Modify: `js/metier/degats-calcul.js:31-122`
- Modify: `tests/degats-calcul.test.js:8-129`

**Interfaces:**
- Consumes: `stats` enrichi et `competence.composantes` de Task 1.
- Produces: `degatsAttendus({stats, competence, cible})`, encore privé jusqu'à
  ce que son consommateur l'importe dans Task 4.

- [ ] **Step 1: Écrire les tests rouges de la base multi-stat**

```js
const MIXTE = {
  composantes:[
    { base:"atk", pourcentage:70 },
    { base:"def", pourcentage:30 }
  ],
  pourcentage:null,
  repartition:[]
};
const stats = {
  atk:1000, def:500, maxHp:10000, remainingHp:10000,
  attaqueElementaire:0, critRate:0, critDamage:0,
  bonusCategorie:0, bonusElementaire:0, bonusGlobal:0
};
assert.equal(Math.round(degatsAttendus({
  stats, competence:MIXTE, cible:CIBLE_NEUTRE
}).total), 425, "(700 + 150) x 0,5");

const PV = {
  composantes:[{ base:"remainingHp", pourcentage:10 }],
  pourcentage:null,
  repartition:[]
};
assert.equal(Math.round(degatsAttendus({
  stats, competence:PV, cible:CIBLE_NEUTRE
}).total), 500);
```

Ajouter aussi une assertion que `bonusCategorie + bonusElementaire +
bonusGlobal` forment un seul seau additif avant le multiplicateur, conformément
à la formule publiée.

- [ ] **Step 2: Lancer le test et constater l'échec**

Run: `node tests/degats-calcul.test.js`

Expected: FAIL, la fonction exige encore `competence.pourcentage` et ignore DEF/PV.

- [ ] **Step 3: Remplacer la base ATK unique par une somme de composantes**

Implémenter sans branche parallèle de totaux :

```js
function baseDeComposante(stats, base){
  if(base === "atk"){
    return (Number(stats.atk) || 0) + (Number(stats.attaqueElementaire) || 0);
  }
  if(base === "def") return Number(stats.def) || 0;
  if(base === "maxHp") return Number(stats.maxHp) || 0;
  if(base === "remainingHp"){
    return Number.isFinite(stats.remainingHp)
      ? stats.remainingHp : (Number(stats.maxHp) || 0);
  }
  return null;
}

function baseDeDegats(stats, competence){
  const composantes = Array.isArray(competence.composantes)
    && competence.composantes.length
    ? competence.composantes
    : [{ base:"atk", pourcentage:competence.pourcentage }];
  return composantes.reduce((total, composante) => {
    const base = baseDeComposante(stats, composante.base);
    return base === null || !nombreFini(composante.pourcentage)
      ? NaN : total + base * composante.pourcentage / 100;
  }, 0);
}
```

Le multiplicateur offensif vaut :

```js
const bonusOffensif = 1 + (
  (Number(stats.bonusCategorie) || 0)
  + (Number(stats.bonusElementaire) || 0)
  + (Number(stats.bonusGlobal) || 0)
) / RAPPORT;
```

Garder `degatsAttendus` privé dans ce commit. Task 4 ajoutera l'export et son
import consommateur dans le même diff afin de ne jamais créer d'export mort.

- [ ] **Step 4: Faire passer le test unitaire**

Run: `node tests/degats-calcul.test.js`

Expected: PASS, y compris les anciennes fixtures `pourcentage`.

- [ ] **Step 5: Vérifier les imports publics**

Run: `node tests/modules-imports.test.js`

Expected: PASS, aucun nouvel export n'existe encore.

- [ ] **Step 6: Commit**

```powershell
git add js/metier/degats-calcul.js tests/degats-calcul.test.js
git commit -m "feat: calculer les bases offensives du build"
```

---

### Task 3: Générer un catalogue exhaustif d'effets et d'interactions

**Files:**
- Create: `scripts/effets-dps-regles.py`
- Create: `scripts/generate-effets-dps.py`
- Create: `tests/test_generate_effets_dps.py`
- Create: `data/effets-dps.js`
- Create: `tests/effets-dps-catalogue.test.js`
- Modify: `package.json:7-12`

**Interfaces:**
- Consumes: toutes les compétences des pages personnage, dont les passifs,
  `7ds-stats/personnages.json`, `armes.json`, `armures.json`,
  `armures-gravees.json`, `sets.json`.
- Produces: `window.SEVEN_DS_EFFETS_DPS` version 1 et des règles exclusivement typées.

- [ ] **Step 1: Écrire le test rouge de la grammaire d'effets**

Le test importe le générateur par chemin et vérifie les formes dominantes :

```python
class EffetsNormalises(unittest.TestCase):
    def test_bonus_categorie_et_cumul_max(self):
        source = {
            "id": "engraving:test:3",
            "textEn": "Each use of the Normal Skill increases Normal Skill "
                      "damage by 6% for 20 sec. (Max: 24%)",
        }
        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-degats",
            "cible": "normal-skill",
            "valeur": 2400,
            "mode": "passif-max",
        }])

    def test_reduction_plate_periodique(self):
        source = {
            "id": "potential:merlin:Wand:6",
            "textEn": "While Overload is active, decreases the hero's Normal "
                      "Skill cooldown by 2 sec every 1 sec.",
        }
        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-periodique",
            "cible": "normal-skill",
            "secondes": 2.0,
            "intervalle": 1.0,
            "condition": "overload",
        }])

    def test_effet_defensif_est_classe_sans_impact(self):
        resultat = _gen.normaliser_effet({
            "id":"gear:test:1",
            "textEn":"Increases Healing Efficiency by 20%.",
        })
        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])
```

- [ ] **Step 2: Lancer le test et constater l'absence du générateur**

Run: `python -m unittest tests/test_generate_effets_dps.py`

Expected: FAIL à l'import de `scripts/generate-effets-dps.py`.

- [ ] **Step 3: Définir le schéma fermé des règles**

Dans `scripts/effets-dps-regles.py`, déclarer exactement :

```python
TYPES_REGLES = {
    "bonus-stat", "bonus-degats", "bonus-critique",
    "recharge-plate", "recharge-taux", "recharge-periodique",
    "recharge-par-impact", "cumul-degats", "deblocage-sequence",
    "degats-additionnels", "resistance-elementaire",
    "deblocage-competence", "remplacement-competence",
}
CLASSIFICATIONS = {"modelise", "sans-impact-dps", "non-inclus"}
```

Chaque règle porte `sourceId`. Les valeurs de taux sont en dix-millièmes, les
durées en secondes et les composantes de dégâts réutilisent `{base,
pourcentage}`. Les règles particulières sont dans `REGLES_SPECIFIQUES`, jamais
dans le fichier généré.

- [ ] **Step 4: Implémenter le collecteur et la classification stricte**

Le générateur expose :

```python
def collecter_sources(characters, weapons, armors, engraved, sets, hero_skills):
    """Retourne passifs et effets actifs avec id, niveau, texte et portée."""

def normaliser_effet(source):
    """Retourne id, classification, regles, texteFr et provenance."""

def construire_catalogue(sources):
    """Indexe héros/potentiels/armes/pièces/sets et refuse tout doublon."""
```

Les gains de stats déjà présents dans `potential.stats` ou dans les
`bonus*Stats` des sets sont classés `sans-impact-dps` dans ce catalogue pour ne
pas les doubler : ils sont déjà inclus par `calculateHeroStats`.

Pour une compétence active, son coefficient reste dans `competences.js`, mais
les modifications de recharge, cumuls, fenêtres et transformations de sa
description vivent ici. Elles sont indexées par `gameId` et sélectionnées avec
le même type d'arme ; le navigateur ne relit pas la prose.

Une source offensive qui ne correspond ni à la grammaire ni à
`REGLES_SPECIFIQUES` lève `ValueError("effet DPS non classe: <id>")`. Seuls les
identifiants explicitement justifiés par la spec peuvent produire
`classification:"non-inclus"`.

Quand une description porte une probabilité, la branche favorable est retenue
sans multiplier par cette probabilité. Quand elle propose plusieurs valeurs
exclusives, la valeur offensive maximale est retenue. Une mention `(Cooldown:
N sec)` devient toujours une recharge interne et empêche le déclenchement avant
son échéance suivante.

- [ ] **Step 5: Verrouiller les règles particulières de Merlin**

Ajouter dans `REGLES_SPECIFIQUES` les règles stables suivantes :

```python
REGLES_SPECIFIQUES.update({
    "skill:merlin_wand_skill_q": [
        {"type":"recharge-par-impact", "cible":"normal-skill",
         "secondes":1.0, "declencheur":"tick"},
        {"type":"cumul-degats", "cible":"normal-skill",
         "valeurParCumul":1000, "cumulsMax":5,
         "declencheur":"tick", "duree":20.0}
    ],
    "skill:merlin_wand_skill_e_enchant": [
        {"type":"deblocage-sequence", "usages":2, "fenetre":7.0,
         "competence":"merlin_wand_divine_judgment", "duree":5.0}
    ],
    "potential:merlin:Wand:5": [
        {"type":"recharge-plate", "cible":"normal-skill", "secondes":4.0}
    ],
    "potential:merlin:Wand:6": [
        {"type":"bonus-critique", "stat":"critRate", "valeur":3000,
         "condition":"overload"},
        {"type":"recharge-periodique", "cible":"normal-skill",
         "secondes":2.0, "intervalle":1.0, "condition":"overload"}
    ],
    "potential:merlin:Wand:7": [
        {"type":"deblocage-competence", "declencheur":"special",
         "competence":"merlin_wand_divine_judgment", "duree":7.0},
        {"type":"resistance-elementaire", "element":"thunder",
         "valeur":-3000, "duree":20.0}
    ],
    "potential:merlin:Wand:9": [
        {"type":"bonus-degats", "cible":"merlin_wand_divine_judgment",
         "valeur":7000}
    ],
    "potential:merlin:Wand:10": [
        {"type":"remplacement-competence", "declencheur":"ultimate",
         "cible":"special", "competence":"merlin_wand_overdrive",
         "duree":15.0}
    ],
})
```

Le catalogue porte aussi les compétences synthétiques `Divine Judgment` à
329 % ATK et `Overdrive` à 416 % ATK, avec leur provenance textuelle. La
dernière frappe de `Divine Judgment` porte en plus sa réduction de recharge de
5 secondes comme règle indexée par son identifiant synthétique.

- [ ] **Step 6: Ajouter les dents de couverture réelle**

Le test Python charge les cinq JSON locaux et une fixture de passifs héros,
puis exige : identifiants uniques, classifications fermées, règles typées et
aucune source offensive silencieuse. Le test Node charge le fichier commité et
vérifie :

```js
assert.equal(catalogue.version, 1);
assert.equal(catalogue.audit.inconnus, 0);
assert.ok(catalogue.audit.total > 700);
assert.ok(catalogue.heroes.merlin.Wand.potentials["10"]);
assert.ok(catalogue.skills.merlin_wand_divine_judgment);
for(const source of catalogue.audit.sources){
  assert.ok(["modelise", "sans-impact-dps", "non-inclus"]
    .includes(source.classification));
}
```

- [ ] **Step 7: Prouver que `--check` ne touche pas au réseau**

Dans le test Python, remplacer `_gen.fetch` par une fonction qui lève
immédiatement, appeler `_gen.main(["--check"])` sur un fichier temporaire valide
et vérifier le succès. Le chemin réseau ne doit pas être atteint.

- [ ] **Step 8: Faire passer le générateur sur toutes les sources locales**

Run: `python -m unittest tests/test_generate_effets_dps.py`

Expected: PASS, aucun effet offensif non classé.

- [ ] **Step 9: Générer une fois le catalogue commité**

Run: `python scripts/generate-effets-dps.py`

Expected: `data/effets-dps.js` contient les sources locales, les 72 passifs de
héros et les interactions des compétences actives issues des 24 fiches, sans
être relu sur le réseau par les tests.

- [ ] **Step 10: Brancher les tests déjà créés dans les deux scripts npm**

Ajouter, dans `test` et `test:unit`, à côté des tests du comparateur :

```text
python -m unittest tests/test_generate_effets_dps.py
python scripts/generate-effets-dps.py --check
node tests/effets-dps-catalogue.test.js
```

Les trois tests du moteur seront ajoutés dans les Tasks 4 et 5, après création
de leurs fichiers.

- [ ] **Step 11: Vérifier le catalogue et le câblage Python**

Run: `python scripts/generate-effets-dps.py --check`

Run: `node tests/effets-dps-catalogue.test.js`

Expected: PASS sans réseau.

- [ ] **Step 12: Commit**

```powershell
git add scripts/effets-dps-regles.py scripts/generate-effets-dps.py tests/test_generate_effets_dps.py data/effets-dps.js tests/effets-dps-catalogue.test.js package.json
git commit -m "feat: typer les effets personnels du dps"
```

---

### Task 4: Sélectionner le build et simuler exactement `[0, 60 s[`

**Files:**
- Create: `js/metier/dps-effets.js`
- Create: `tests/dps-effets.test.js`
- Create: `js/metier/dps-simulation.js`
- Create: `tests/dps-simulation.test.js`
- Modify: `js/metier/degats-calcul.js:117-122`
- Modify: `tests/helpers/modules.js:22-38`
- Modify: `tests/helpers/load-app.js:158-173, 561-675`
- Modify: `sw.js:25-28`
- Modify: `package.json`

**Interfaces:**
- Consumes: `effetsDuBuild({hero, dossierArme, catalogue, statsResult})`,
  `degatsAttendus`, compétences temporalisées.
- Produces: `{stats, effets, nonInclus, hypotheses}` et
  `simulerDpsCompetences({stats, competences, effets, cible, duree})`.

- [ ] **Step 1: Écrire le test rouge du niveau réel**

Construire un héros factice avec potentiel 6, arme outrepassement 2, passif de
gravure niveau 3 et set actif :

```js
const contexte = effetsDuBuild({
  hero,
  dossierArme:"Baguette",
  catalogue:CATALOGUE,
  statsResult:RESULTAT_STATS
});
assert.deepStrictEqual(
  contexte.effets.filter(e => e.origine === "potential").map(e => e.tier),
  [1, 2, 3, 4, 5, 6]
);
assert.equal(
  contexte.effets.find(e => e.origine === "weapon").level,
  3,
  "overlimit 2 donne le passif d'arme niveau 3"
);
assert.equal(
  contexte.effets.find(e => e.slot === "Armure liee").level,
  3
);
assert.ok(!contexte.effets.some(e => e.tier === 7));
```

- [ ] **Step 2: Lancer le test et constater l'absence du module**

Run: `node tests/dps-effets.test.js`

Expected: FAIL, `effetsDuBuild` est absent.

- [ ] **Step 3: Implémenter la sélection pure**

Le module exporte uniquement :

```js
function effetsDuBuild({ hero, dossierArme, catalogue, statsResult }){
  // 1. sélection héros/type d'arme et interactions des compétences actives ;
  // 2. paliers <= potentiel réel ; 3. passif arme = overlimit + 1 ;
  // 4. passifs de pièces au niveau configuré ;
  // 5. effets de sets dont le seuil réel est atteint ; 6. exclusions et hypothèses.
}
```

Les statuts `missing` et `incompatible` des passifs d'équipement ne produisent
aucune règle et ajoutent une entrée `nonInclus`. Les sources
`sans-impact-dps` sont enregistrées dans `couverture` mais pas dans `effets`.

Construire `stats` depuis `statsResult.totals` avec les correspondances :

```js
const STAT_DPS = {
  atk:"B_Atk", def:"B_Def", maxHp:"B_MaxHp",
  critRate:"C_Critical_Rate", critDamage:"C_Critical_Dam_Rate"
};
const BONUS_CATEGORIE = {
  "normal-skill":"Normalskill_Damadd_Rate",
  special:"Activethird_Damadd_Rate",
  ultimate:"Ultimateskill_Damadd_Rate"
};
```

Le type élémentaire vient de `metaOf(hero.char).weapons` pour l'arme active.
`<Element>_Add` est la base élémentaire plate, `<Element>_Rate` son taux
d'augmentation, et la valeur offensive devient :

```js
attaqueElementaire = elementAdd * (1 + elementRate / 10000);
```

`<Element>_Element_Rate` alimente `bonusElementaire`, tandis que les règles
passives s'ajoutent dans les mêmes unités. Un `bonus-stat` passif applique son
taux à la valeur finale issue de `calculateHeroStats`; le taux critique effectif
est plafonné à 10 000 avant retrait de la résistance de la cible.

- [ ] **Step 4: Préparer le module dans l'ordre de chargement et les hooks**

- `tests/helpers/modules.js` après `degats-calcul.js` ;
- `sw.js` dans `CORE_ASSETS` ;
- hook `effetsDuBuild` dans `tests/helpers/load-app.js`, sans backtick ajouté.

Ajouter `SEVEN_DS_EFFETS_DPS` au bac de test avec un objet minimal typé.

- [ ] **Step 5: Faire passer le test de sélection**

Run: `node tests/dps-effets.test.js`

Expected: PASS. L'export sera ajouté avec son consommateur dans la partie
suivante de cette même task.

#### Partie B — Simuler la fenêtre temporelle

- [ ] **Step 6: Écrire les tests rouges de fenêtre et périodicité**

```js
const resultat = simulerDpsCompetences({
  stats:SANS_CRITIQUE,
  competences:[{
    gameId:"skill-10", nom:"Toutes les dix secondes",
    categorie:"NORMAL_SKILL", recharge:10,
    composantes:[{base:"atk", pourcentage:100}],
    pourcentage:100, repartition:[100]
  }],
  effets:[], cible:CIBLE_NEUTRE, duree:60
});
assert.equal(resultat.rotation.filter(e => e.type === "action").length, 6);
assert.deepStrictEqual(
  resultat.rotation.filter(e => e.type === "action").map(e => e.temps),
  [0, 10, 20, 30, 40, 50]
);
assert.equal(resultat.dps, resultat.total / 60);

const periodic = simulerDpsCompetences({
  stats:SANS_CRITIQUE,
  competences:[{
    gameId:"zone", nom:"Zone", categorie:"ACTIVE_THIRD", recharge:58,
    composantes:[{base:"atk", pourcentage:50}],
    periodique:{base:"atk", pourcentageParTick:10, intervalle:1, duree:5, ticks:5}
  }],
  effets:[], cible:CIBLE_NEUTRE, duree:60
});
assert.equal(
  periodic.rotation.filter(e => e.type === "tick" && e.temps >= 58).length,
  1,
  "le tick à 60 s est hors fenêtre"
);
```

- [ ] **Step 7: Lancer le test et constater l'échec**

Run: `node tests/dps-simulation.test.js`

Expected: FAIL, module absent.

- [ ] **Step 8: Implémenter l'horloge en millisecondes entières**

Éviter les dérives flottantes :

```js
const enMs = secondes => Math.round(Number(secondes) * 1000);
const enSecondes = ms => ms / 1000;
```

Le simulateur :

1. filtre `NORMAL_SKILL`, `ACTIVE_THIRD`, `ULTIMATE` avec recharge positive ;
2. démarre toutes les recharges à `0` ;
3. planifie les ticks strictement avant la borne ;
4. calcule chaque impact avec `degatsAttendus` ;
5. ne compte ni tag, ni attaque combinée, ni attaque normale ;
6. ajoute un événement verbal `attente` entre deux instants utiles ;
7. retourne `total`, `dps`, `rotation`, `nonInclus`, `hypotheses`, `couverture`.

- [ ] **Step 9: Ajouter une politique déterministe sans effet**

À effets vides, utiliser d'abord la compétence qui inflige le plus de dégâts
attendus, puis `gameId` pour départager. Cette politique sert de base vérifiable
avant l'optimiseur de Task 5.

- [ ] **Step 10: Inscrire les deux modules aux quatre endroits obligatoires**

- `tests/helpers/modules.js` après `dps-effets.js` ;
- `sw.js` dans `CORE_ASSETS` ;
- export de `degatsAttendus`, exports de `dps-effets.js`, puis imports réels de
  `degatsAttendus` et `effetsDuBuild` par `dps-simulation.js` ;
- hooks `simulerDpsCompetences` dans `load-app.js`, sans backtick ajouté.

Ajouter `node tests/dps-effets.test.js` et
`node tests/dps-simulation.test.js` dans `test` et `test:unit`.

- [ ] **Step 11: Faire passer les tests unitaires et d'imports**

Run: `node tests/dps-simulation.test.js`

Run: `node tests/degats-calcul.test.js`

Run: `node tests/modules-imports.test.js`

Expected: PASS.

- [ ] **Step 12: Commit**

```powershell
git add js/metier/degats-calcul.js js/metier/dps-effets.js js/metier/dps-simulation.js tests/degats-calcul.test.js tests/dps-effets.test.js tests/dps-simulation.test.js tests/helpers/modules.js tests/helpers/load-app.js sw.js
git commit -m "feat: simuler les competences sur soixante secondes"
```

---

### Task 5: Optimiser les interactions et verrouiller Merlin foudre

**Files:**
- Modify: `js/metier/dps-simulation.js`
- Modify: `tests/dps-simulation.test.js`
- Create: `tests/dps-merlin.test.js`
- Modify: `tests/helpers/load-app.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: règles fermées de `data/effets-dps.js`.
- Produces: `ouverture`, `priorites` et la meilleure `rotation` connue.

- [ ] **Step 1: Écrire les tests rouges des interactions**

Ajouter quatre scénarios synthétiques :

```js
const normal = {
  gameId:"normal", nom:"Frappe", categorie:"NORMAL_SKILL", recharge:10,
  composantes:[{base:"atk", pourcentage:100}], pourcentage:100
};
const special = {
  gameId:"buff", nom:"Buff", categorie:"ACTIVE_THIRD", recharge:20,
  composantes:[{base:"atk", pourcentage:1}], pourcentage:1
};
const divine = {
  gameId:"divine", nom:"Divine", categorie:"NORMAL_SKILL", recharge:10,
  composantes:[{base:"atk", pourcentage:200}], pourcentage:200,
  synthetique:true
};
const lancer = (competences, effets, duree=20) => simulerDpsCompetences({
  stats:SANS_CRITIQUE, competences, effets,
  cible:CIBLE_NEUTRE, duree
});
const tempsActions = (resultat, id) => resultat.rotation
  .filter(e => e.type === "action" && e.competence === id)
  .map(e => e.temps);

const reduction = lancer([normal], [
  {type:"recharge-plate", cible:"normal-skill", secondes:4}
]);
assert.deepStrictEqual(tempsActions(reduction, "normal"), [0, 6, 12, 18]);

const buffAvantFrappe = lancer([normal, special], [
  {type:"bonus-degats", cible:"normal-skill", valeur:5000,
   declencheur:"buff", duree:5}
]);
assert.deepStrictEqual(
  buffAvantFrappe.ouverture.slice(0, 2).map(a => a.gameId),
  ["buff", "normal"]
);

const transformation = lancer([normal, special, divine], [
  {type:"deblocage-competence", declencheur:"buff",
   competence:"divine", duree:7}
]);
assert.ok(tempsActions(transformation, "divine").some(t => t < 7));
assert.ok(tempsActions(transformation, "normal").some(t => t >= 7));

assert.deepStrictEqual(
  lancer([normal, special], []),
  lancer([normal, special], [])
);
```

- [ ] **Step 2: Lancer le test et constater que la politique gloutonne échoue**

Run: `node tests/dps-simulation.test.js`

Expected: FAIL sur l'ordre buff/frappe ou la transformation.

- [ ] **Step 3: Implémenter la recherche événementielle mémorisée**

Représenter un état canonique :

```js
{
  tempsMs,
  recharges:{ [gameId]:disponibleMs },
  buffs:{ [id]:{ expirationMs, cumuls } },
  transformations:{ [categorie]:{ gameId, expirationMs } },
  internes:{ [sourceId]:disponibleMs },
  ticks:[{ tempsMs, gameId, index }]
}
```

À chaque état, générer :

- une transition par action disponible ;
- une transition d'attente vers le prochain événement utile ;
- aucune attente arbitraire entre deux événements.

La clé de mémoïsation sérialise les champs triés. Pour une même clé, abandonner
un chemin dont le total est inférieur ou égal à celui déjà vu. À 60 s,
conserver le plus grand total ; départager par la séquence lexicographique des
`gameId` pour un résultat stable.

Les règles sont appliquées par un `switch` exhaustif. `recharge-par-impact` et
`cumul-degats` réagissent aux événements d'impact ou de tick du `gameId`
porteur ; `deblocage-sequence` conserve les horodatages d'usage compris dans sa
fenêtre. Un type inconnu lève une erreur et ne devient jamais silencieusement
neutre.

- [ ] **Step 4: Produire une ouverture et des priorités depuis la trace**

`ouverture` contient les actions jusqu'à la première répétition d'un `gameId`.
`priorites` trie les actions selon leur ordre moyen quand elles sont disponibles
et ajoute la phrase « attaques normales pendant l'attente » lorsqu'un événement
`attente` existe.

- [ ] **Step 5: Écrire la régression intégrée Merlin avec le catalogue réel**

Le test charge `data/competences.js` et `data/effets-dps.js`, sélectionne Merlin
baguette au potentiel 10, puis compare deux simulations identiques sauf la
réduction de recharge du champ :

```js
assert.ok(avecChamp.total > sansReduction.total);
assert.ok(
  usages(avecChamp, "merlin_wand_skill_e_enchant")
    > usages(sansReduction, "merlin_wand_skill_e_enchant")
);
assert.ok(
  avecChamp.rotation.some(e =>
    e.competence === "merlin_wand_divine_judgment"
  )
);
assert.equal(avecChamp.duree, 60);
```

Ne pas figer arbitrairement « ultime puis champ » : la transformation de la
spéciale peut rendre un autre ordre meilleur, et c'est précisément ce que le
simulateur doit décider.

- [ ] **Step 6: Faire passer les tests du moteur et de Merlin**

Run: `node tests/dps-simulation.test.js`

Run: `node tests/dps-merlin.test.js`

Expected: PASS avec une rotation stable.

- [ ] **Step 7: Finaliser le câblage npm des tests créés**

Vérifier que `test` et `test:unit` contiennent une fois chacun : test Python du
catalogue d'effets, `--check`, test catalogue JS, `dps-effets`,
`dps-simulation`, `dps-merlin`.

- [ ] **Step 8: Commit**

```powershell
git add js/metier/dps-simulation.js tests/dps-simulation.test.js tests/dps-merlin.test.js tests/helpers/load-app.js package.json
git commit -m "feat: optimiser les rotations connues"
```

---

### Task 6: Afficher cycle, DPS et rotation dans la fiche

**Files:**
- Modify: `tests/fiche-heros.test.js`
- Modify: `js/vues/fiche-heros.js:31-222`
- Modify: `index.html:430-477` et styles `.hd-puissance*`
- Modify: `tests/apport-par-piece.playwright.js`

**Interfaces:**
- Consumes: `effetsDuBuild`, `simulerDpsCompetences`, résultat complet de `calculateHeroStats`.
- Produces: lignes classées par `dps`, détails accessibles et notes honnêtes.

- [ ] **Step 1: Écrire d'abord le test rouge du nouveau rendu**

Remplacer la fixture par :

```js
function fakeText(node){
  if(node === null || node === undefined) return "";
  if(typeof node === "string") return node;
  return String(node.textContent || "")
    + (Array.isArray(node.children) ? node.children.map(fakeText).join("") : "");
}

const bloc = puissanceSection([
  {
    arme:"Baguette", cycle:160900, dps:8432.4, nonInclus:1,
    ouverture:["Champ électromagnétique", "Jugement divin"],
    priorites:["Champ électromagnétique", "Jugement divin dès que disponible"],
    rotation:[{temps:0, nom:"Champ électromagnétique"}],
    hypotheses:["Ressources illimitées", "Animations non mesurées"]
  },
  {
    arme:"Livre", cycle:140700, dps:7020.1, nonInclus:2,
    ouverture:["Graine de givre"], priorites:[], rotation:[], hypotheses:[]
  }
]);
const texte = fakeText(bloc);
assert.match(texte, /DPS des compétences sur 60 s/);
assert.match(texte, /8.?432\/s/);
assert.match(texte, /Dégâts d'un cycle/);
assert.match(texte, /Ouverture/);
assert.match(texte, /Rotation optimale selon les données connues/);
assert.match(texte, /Non inclus dans le calcul/);
```

Ajouter un test qui donne un cycle supérieur mais un DPS inférieur et vérifie
que l'ordre suit le DPS.

- [ ] **Step 2: Lancer le test et constater l'échec**

Run: `node tests/fiche-heros.test.js`

Expected: FAIL, le rendu ne connaît que `total`.

- [ ] **Step 3: Construire toutes les stats de frappe depuis le résultat héros**

Remplacer `statsDeFrappe(hero)` par une fonction qui retourne à la fois le
résultat canonique et le dictionnaire de totaux, afin que `effetsDuBuild` lise
ATK, DEF, PV, élément et bonus de catégorie sans recalcul parallèle.

Pour chaque build, `classementPuissance` :

1. construit l'instantané actif ;
2. calcule `calculateHeroStats` une fois ;
3. calcule le cycle historique ;
4. sélectionne les effets au niveau réel ;
5. simule 60 s ;
6. retourne `cycle`, `dps`, `rotation`, `ouverture`, `priorites`,
   `hypotheses`, `nonInclus` ;
7. trie par DPS décroissant.

- [ ] **Step 4: Ajouter le rendu accessible et compact**

Chaque arme affiche deux lignes libellées. Un `<details>` natif contient :

- « Rotation optimale selon les données connues » ;
- « Ouverture » sous forme de liste ordonnée ;
- « Priorité » ;
- chronologie `0,0 s — compétence` ;
- hypothèses ;
- « Non inclus dans le calcul ».

Le texte principal doit être exactement :

```text
DPS des compétences sur 60 s — théorique. Ressources illimitées, passifs
personnels activés au maximum de leur niveau réel. Attaques normales et temps
d'animation non chiffrés.
```

- [ ] **Step 5: Charger le catalogue avant les modules**

Ajouter dans `index.html`, avec les autres scripts de données :

```html
<script src="data/effets-dps.js"></script>
```

Ajouter `./data/effets-dps.js` à `CORE_ASSETS` dans `sw.js`.

- [ ] **Step 6: Adapter les styles sans déborder en mobile**

Réutiliser `.hd-puissance` et ajouter des classes ciblées :

```css
.hd-puissance-mesures{display:grid;gap:4px;text-align:right}
.hd-puissance-detail{grid-column:1/-1}
.hd-puissance-rotation{margin:8px 0 0;padding-left:20px}
.hd-puissance-temps{font-variant-numeric:tabular-nums}
```

À 320 px, les libellés peuvent revenir à la ligne ; aucune largeur fixe n'est
introduite.

- [ ] **Step 7: Faire passer le test de vue**

Run: `node tests/fiche-heros.test.js`

Expected: PASS.

- [ ] **Step 8: Ajouter le test navigateur rouge puis le faire passer**

Dans `tests/apport-par-piece.playwright.js`, ouvrir la fiche de Merlin avec au
moins deux builds, déplier la première rotation et vérifier :

```js
await page.getByText("DPS des compétences sur 60 s").waitFor();
await page.getByText("Rotation optimale selon les données connues").first().click();
await expectVisibleText(page, "Ouverture");
await expectVisibleText(page, "Animations non mesurées");
```

Run: `node tests/apport-par-piece.playwright.js`

Expected: PASS sur un port neuf fourni par le helper.

- [ ] **Step 9: Commit**

```powershell
git add js/vues/fiche-heros.js tests/fiche-heros.test.js tests/apport-par-piece.playwright.js index.html sw.js
git commit -m "feat: afficher le dps theorique et sa rotation"
```

---

### Task 7: Vérifier la PWA, documenter et exécuter toute la suite

**Files:**
- Modify: `tests/pwa.test.js`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-08-05-comparateur-dps-60s-design.md`
- Verify: `package.json`, tout `tests/`

**Interfaces:**
- Consumes: tous les livrables précédents.
- Produces: branche vérifiée, aucune publication automatique.

- [ ] **Step 1: Écrire le test PWA rouge des nouvelles ressources**

```js
assert.match(sw, /\.\/data\/effets-dps\.js/);
assert.match(sw, /\.\/js\/metier\/dps-effets\.js/);
assert.match(sw, /\.\/js\/metier\/dps-simulation\.js/);
assert.match(index, /data\/effets-dps\.js/);
```

- [ ] **Step 2: Faire passer les tests structurels**

Run: `node tests/pwa.test.js`

Run: `node tests/modules-imports.test.js`

Run: `node tests/css-ordre.test.js`

Expected: PASS.

- [ ] **Step 3: Auditer le câblage de chaque fichier de test**

Lister `tests/*.test.js`, `tests/*.playwright.js` et `tests/test_*.py`, puis
vérifier que chaque test exécutable autonome figure dans `test`, `test:unit` ou
`test:e2e` selon sa nature. Les helpers et fixtures ne sont pas des commandes.

Run: `rg --files tests | Sort-Object`

Run: `Get-Content package.json`

Expected: aucun des nouveaux tests ni `tests/accueil.test.js` n'est absent.

- [ ] **Step 4: Mettre à jour la documentation de vérité**

Dans `AGENTS.md`, ajouter à l'état actuel :

```text
[x] Comparateur DPS des compétences sur 60 s. Le cycle historique reste
visible ; le DPS simule normale, spéciale et ultime avec ressources illimitées,
passifs personnels au niveau réel mais conditions/cumuls maximisés. Les attaques
normales et animations restent annoncées comme non chiffrées.
```

Dans la spec, passer l'état à `implémenté` uniquement après la suite complète.

- [ ] **Step 5: Lancer tous les tests unitaires**

Run: `npm run test:unit`

Expected: tous verts, aucun accès réseau.

- [ ] **Step 6: Lancer `npm test` en entier**

Run: `npm test`

Expected: toute la suite verte. Rapporter fidèlement chaque échec.

- [ ] **Step 7: Relancer les deux scénarios connus comme instables si nécessaire**

Si `supabase-etape1` échoue sur la cible 44 px :

Run: `node tests/supabase-etape1.playwright.js`

Si `accessibilite-mobile` échoue sur la tuile du picker :

Run: `node tests/accessibilite-mobile.playwright.js`

Une relance verte est rapportée comme instabilité connue ; un échec répété est
diagnostiqué avec `superpowers:systematic-debugging` et la cause applicative est
corrigée, jamais le test affaibli.

- [ ] **Step 8: Contrôler le diff et l'absence de secret**

Run: `git diff --check`

Run: `git status --short --branch`

Run: `rg -n "https://discord\.com/api/webhooks/" .`

Run: `rg -n "SUPABASE_SERVICE_ROLE\s*=" --glob '!AGENTS.md' --glob '!docs/**' .`

Expected: aucun secret ajouté, aucun fichier étranger au périmètre.

- [ ] **Step 9: Commit final de documentation et vérification**

```powershell
git add AGENTS.md docs/superpowers/specs/2026-08-05-comparateur-dps-60s-design.md tests/pwa.test.js package.json
git commit -m "test: verifier le comparateur dps complet"
```

- [ ] **Step 10: Proposer le menu de fin de branche sans pousser**

Présenter exactement les trois choix : merger en local, pousser et ouvrir une
PR, laisser la branche en l'état. Ne choisir ni push ni PR sans réponse
explicite.
