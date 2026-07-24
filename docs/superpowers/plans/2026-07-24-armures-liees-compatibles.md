# Compatibilité des armures liées Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restreindre l’emplacement `Armure liee` aux 2 ou 3 tenues gravées du personnage sélectionné, avec retrait automatique des choix incompatibles.

**Architecture:** Un script Python manuel extrait en une requête les associations costume–personnage de la page publique du team builder, les rapproche des 66 images locales et génère un instantané `armures-liees.js`. L’application charge cet instantané local, centralise la compatibilité dans deux fonctions pures, puis l’applique à la normalisation des sauvegardes et au sélecteur d’armure liée.

**Tech Stack:** HTML/CSS/JavaScript sans build, Python 3 standard library, Node.js `assert`/`vm`, Playwright Chromium.

## Global Constraints

- L’application livrée doit rester autonome, utilisable en `file://` et sans dépendance d’exécution.
- Seul l’emplacement `Armure liee` est filtré ; `Haut`, `Bas`, `Bottes` et `Ceinture` restent universels.
- `index.html` ne doit contenir aucune liste d’images codée en dur.
- Le générateur effectue une seule requête manuelle vers `https://7dsorigin.app/fr/team-builder/create`.
- Aucune GitHub Action, aucun téléchargement automatique d’image et aucun accès à `/api/`.
- Une erreur de correspondance ne doit jamais écraser le dernier `armures-liees.js` valide.
- Une donnée absente ou inconnue est refusée par défaut : aucune liste globale de secours.
- Français partout dans l’interface.

---

### Task 1: Générateur manuel et instantané des compatibilités

**Files:**
- Create: `generate-armures-liees.py`
- Create: `armures-liees.js`
- Create: `tests/test_generate_armures_liees.py`
- Modify: `tests/potentiel-commun.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces Python: `extract_candidates(html: str) -> list[dict[str, str]]`
- Produces Python: `build_mapping(html: str, armor_dir: str, character_dir: str) -> dict[str, list[str]]`
- Produces browser global: `window.SEVEN_DS_ARMURES_LIEES: Record<string, string[]>`
- Consumes local assets: `7ds-armures-ssr/Armure liee/*.webp` and `7ds-personnages/*.webp`

- [x] **Step 1: Écrire les tests Python en échec**

Créer un chargeur du module à nom composé et couvrir une extraction valide,
une image locale sans correspondance et la non-écriture en cas d’erreur :

```python
import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "generate_armures_liees", ROOT / "generate-armures-liees.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

HTML = (
    r'\"slug\":\"meliodas-costume-134100502\",'
    r'\"nameFr\":\"Une nouvelle aventure\",'
    r'\"rarity\":\"SSR\",\"bindingRecipeId\":\"133010052-133214001\",'
    r'\"itemGameId\":\"133214001\"'
)

class LinkedArmorGeneratorTests(unittest.TestCase):
    def test_build_mapping_matches_local_french_filename(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            (armor_dir / "Une nouvelle aventure.webp").touch()
            (character_dir / "meliodas.webp").touch()

            self.assertEqual(
                module.build_mapping(HTML, armor_dir, character_dir),
                {
                    "meliodas": [
                        "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
                    ]
                },
            )

    def test_unmatched_local_file_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            (armor_dir / "Inconnue.webp").touch()
            (character_dir / "meliodas.webp").touch()

            with self.assertRaisesRegex(module.DataError, "Inconnue"):
                module.build_mapping(HTML, armor_dir, character_dir)

    def test_invalid_data_does_not_replace_existing_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = pathlib.Path(tmp) / "armures-liees.js"
            output.write_text("instantane valide", encoding="utf-8")
            with self.assertRaises(module.DataError):
                module.generate("aucune donnee", output, pathlib.Path(tmp), pathlib.Path(tmp))
            self.assertEqual(output.read_text(encoding="utf-8"), "instantane valide")
```

- [x] **Step 2: Vérifier que les tests échouent faute de générateur**

Run:

```powershell
python -m unittest tests/test_generate_armures_liees.py
```

Expected: `FileNotFoundError` pour `generate-armures-liees.py`.

- [x] **Step 3: Implémenter le générateur minimal et ses validations**

Le script utilise uniquement la bibliothèque standard. Il décode les guillemets
du payload Next, ne laisse pas une expression régulière traverser le costume
suivant, filtre les `itemGameId` d’armure liée (`133...`) et décode `nameFr`
avec `json.loads` :

```python
import datetime
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
URL = "https://7dsorigin.app/fr/team-builder/create"
ARMOR_DIR = ROOT / "7ds-armures-ssr" / "Armure liee"
CHARACTER_DIR = ROOT / "7ds-personnages"
OUT = ROOT / "armures-liees.js"

class DataError(RuntimeError):
    pass

COSTUME_RE = re.compile(
    r'"slug":"(?P<char>[a-z0-9-]+)-costume-[^"]+",'
    r'"nameFr":"(?P<name>(?:[^"\\]|\\.)*)"'
    r'(?:(?!"slug":).)*?'
    r'"itemGameId":"(?P<game_id>133\d+)"',
    re.DOTALL,
)

def extract_candidates(html):
    decoded = html.replace(r"\"", '"').replace(r"\/", "/")
    rows = []
    for match in COSTUME_RE.finditer(decoded):
        rows.append({
            "char": match.group("char"),
            "name": json.loads(f'"{match.group("name")}"'),
            "game_id": match.group("game_id"),
        })
    return rows

def build_mapping(html, armor_dir=ARMOR_DIR, character_dir=CHARACTER_DIR):
    candidates = extract_candidates(html)
    local_files = sorted(pathlib.Path(armor_dir).glob("*.webp"))
    characters = {path.stem for path in pathlib.Path(character_dir).glob("*.webp")}
    if not local_files:
        raise DataError("Aucune armure liée locale trouvée")
    if not characters:
        raise DataError("Aucun personnage local trouvé")
    by_name = {}
    for row in candidates:
        by_name.setdefault(row["name"], []).append(row)

    mapping = {}
    for path in local_files:
        matches = by_name.get(path.stem, [])
        if len(matches) != 1:
            raise DataError(
                f"{path.stem}: {len(matches)} correspondance(s) dans la source"
            )
        char_id = matches[0]["char"]
        if char_id not in characters:
            raise DataError(f"{path.stem}: personnage local absent ({char_id})")
        relative = f"7ds-armures-ssr/Armure liee/{path.name}"
        mapping.setdefault(char_id, []).append(relative)

    missing_characters = sorted(characters - mapping.keys())
    if missing_characters:
        raise DataError(
            "Personnages sans armure liée locale: " + ", ".join(missing_characters)
        )
    return {
        char_id: sorted(files)
        for char_id, files in sorted(mapping.items())
    }
```

`generate()` construit et valide entièrement le contenu en mémoire avant
d’appeler `output.write_text(...)`. `main()` ajoute un `User-Agent` descriptif,
effectue un seul `urlopen`, puis écrit :

```python
def render_js(mapping):
    generated_at = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    return (
        "// Généré manuellement depuis la page publique du team builder 7dsorigin.app.\n"
        f"// Date de génération : {generated_at}\n"
        "// Instantané local : aucun appel réseau n'est effectué par index.html.\n"
        "window.SEVEN_DS_ARMURES_LIEES = "
        + json.dumps(mapping, ensure_ascii=False, indent=2)
        + ";\n"
    )

def generate(html, output=OUT, armor_dir=ARMOR_DIR, character_dir=CHARACTER_DIR):
    mapping = build_mapping(html, armor_dir, character_dir)
    rendered = render_js(mapping)
    pathlib.Path(output).write_text(rendered, encoding="utf-8", newline="\n")
    return mapping

def fetch():
    request = urllib.request.Request(
        URL,
        headers={"User-Agent": "N-VA linked-armor updater (manual; github.com/yanniss13/N-VA)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", "ignore")

def main():
    mapping = generate(fetch())
    print("OK -> armures-liees.js généré")
    print(f"  Personnages : {len(mapping)}")
    print(f"  Armures liées : {sum(map(len, mapping.values()))}")

if __name__ == "__main__":
    main()
```

- [x] **Step 4: Vérifier les tests Python**

Run:

```powershell
python -m unittest tests/test_generate_armures_liees.py
```

Expected: `Ran 3 tests ... OK`.

- [x] **Step 5: Ajouter le test en échec de l’instantané réel**

Dans `tests/potentiel-commun.test.js`, charger `armures-liees.js` avec `vm`,
charger `data.js`, puis vérifier :

```js
const armorContext = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, "armures-liees.js"), "utf8"),
  armorContext,
  { filename:"armures-liees.js" }
);
const dataContext = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(ROOT, "data.js"), "utf8"),
  dataContext,
  { filename:"data.js" }
);
const linked = armorContext.window.SEVEN_DS_ARMURES_LIEES;
const files = Object.values(linked).flat();
const localArmorFiles = dataContext.window.SEVEN_DS_DATA.armures["Armure liee"]
  .map(item => item.file);

assert.strictEqual(Object.keys(linked).length, 24);
assert.strictEqual(files.length, 66);
assert.strictEqual(new Set(files).size, 66);
assert.ok(Object.values(linked).every(items => [2, 3].includes(items.length)));
assert.deepStrictEqual(
  plain([...files].sort()),
  plain([...localArmorFiles].sort())
);
```

- [x] **Step 6: Vérifier que le test échoue faute d’instantané**

Run:

```powershell
node tests/potentiel-commun.test.js
```

Expected: `ENOENT` pour `armures-liees.js`.

- [x] **Step 7: Générer l’instantané réel en une requête**

Run:

```powershell
python generate-armures-liees.py
```

Expected:

```text
OK -> armures-liees.js généré
  Personnages : 24
  Armures liées : 66
```

- [x] **Step 8: Intégrer les tests Python à la commande unitaire**

Dans `package.json` :

```json
{
  "scripts": {
    "test": "python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js && node tests/potentiel-commun.playwright.js",
    "test:unit": "python -m unittest tests/test_generate_armures_liees.py && node tests/potentiel-commun.test.js",
    "test:e2e": "node tests/potentiel-commun.playwright.js"
  }
}
```

- [x] **Step 9: Vérifier l’instantané et le générateur**

Run:

```powershell
npm run test:unit
```

Expected: trois tests Python `OK`, puis `PASS potentiel commun`.

- [x] **Step 10: Commit**

```powershell
git add generate-armures-liees.py armures-liees.js tests/test_generate_armures_liees.py tests/potentiel-commun.test.js package.json
git commit -m "feat: generate linked armor compatibility"
```

---

### Task 2: Validation centrale et migration des anciennes équipes

**Files:**
- Modify: `index.html:495-625`
- Modify: `tests/potentiel-commun.test.js`

**Interfaces:**
- Consumes: `window.SEVEN_DS_ARMURES_LIEES: Record<string, string[]>`
- Produces: `linkedArmorsOf(charId: string | null) -> string[]`
- Produces: `isLinkedArmorCompatible(charId: string | null, file: string | null) -> boolean`
- Updates: `normalizeHero(raw) -> Hero` avec `armor["Armure liee"]` validée

- [x] **Step 1: Écrire les tests unitaires en échec**

Ajouter au sandbox de `loadApp()` :

```js
SEVEN_DS_ARMURES_LIEES:{
  meliodas:[
    "7ds-armures-ssr/Armure liee/Défense simple.webp",
    "7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp",
    "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
  ],
  merlin:[
    "7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp",
    "7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp",
    "7ds-armures-ssr/Armure liee/Vêtements formels légers.webp"
  ]
}
```

Exposer `linkedArmorsOf` et `isLinkedArmorCompatible` dans `__hooks`, puis
ajouter :

```js
{
  const { hooks } = loadApp();
  assert.deepStrictEqual(plain(hooks.linkedArmorsOf("meliodas")), [
    "7ds-armures-ssr/Armure liee/Défense simple.webp",
    "7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp",
    "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
  ]);
  assert.strictEqual(
    hooks.isLinkedArmorCompatible(
      "meliodas",
      "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
    ),
    true
  );
  assert.strictEqual(
    hooks.isLinkedArmorCompatible(
      "meliodas",
      "7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp"
    ),
    false
  );

  const normalized = plain(hooks.normalizeHero({
    char:"meliodas",
    armor:{
      Haut:"7ds-armures-ssr/Haut/universel.webp",
      "Armure liee":"7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp"
    }
  }));
  assert.strictEqual(normalized.armor.Haut, "7ds-armures-ssr/Haut/universel.webp");
  assert.strictEqual(normalized.armor["Armure liee"], null);
}
```

- [x] **Step 2: Vérifier l’échec avant implémentation**

Run:

```powershell
npm run test:unit
```

Expected: échec car `linkedArmorsOf` n’existe pas dans le script principal.

- [x] **Step 3: Charger l’instantané et ajouter les fonctions pures**

Ajouter le chargement avant le script inline :

```html
<script src="data.js"></script>
<script src="potentiels.js"></script>
<script src="armures-liees.js"></script>
<script>
```

À côté des constantes d’équipement :

```js
const LINKED_ARMOR_SLOT = "Armure liee";
const LINKED_ARMORS = window.SEVEN_DS_ARMURES_LIEES || {};
const linkedArmorsOf = charId =>
  [...((charId && LINKED_ARMORS[charId]) || [])];
const isLinkedArmorCompatible = (charId, file) =>
  !file || !!charId && linkedArmorsOf(charId).includes(file);
```

- [x] **Step 4: Valider l’armure liée dans `normalizeHero()`**

Construire l’armure avant l’objet retourné :

```js
function normalizeHero(raw){
  const h = raw && typeof raw === "object" ? raw : {};
  const char = h.char||null;
  const weapon = isWeaponCompatible(char, h.weapon) ? (h.weapon||null) : null;
  const armor = Object.assign(emptyArmor(), h.armor||{});
  if(!isLinkedArmorCompatible(char, armor[LINKED_ARMOR_SLOT])){
    armor[LINKED_ARMOR_SLOT] = null;
  }
  return {
    char,
    weapon,
    armor,
    jewel:Object.assign(emptyJewel(), h.jewel||{}),
    potentiel:normalizePotentiel(h.potentiel),
    note:typeof h.note === "string" ? h.note : ""
  };
}
```

- [x] **Step 5: Vérifier la migration et la non-régression**

Run:

```powershell
npm run test:unit
```

Expected: tous les tests Python et Node passent.

- [x] **Step 6: Commit**

```powershell
git add index.html tests/potentiel-commun.test.js
git commit -m "feat: validate linked armor per hero"
```

---

### Task 3: Sélecteur filtré et retrait au changement de héros

**Files:**
- Modify: `index.html:831-861`
- Modify: `tests/potentiel-commun.playwright.js`

**Interfaces:**
- Consumes: `linkedArmorsOf(charId)` et `isLinkedArmorCompatible(charId, file)`
- Updates: `pickChar(i)` retire une armure liée incompatible
- Updates: `pickArmor(i, slot)` filtre uniquement `Armure liee`

- [x] **Step 1: Ajouter le parcours Playwright en échec**

Créer un helper stable pour cibler les slots par libellé :

```js
function armorSlot(hero, label){
  return hero.locator(".gear-slot").filter({ hasText:label });
}

async function chooseArmor(page, hero, label, itemName){
  await armorSlot(hero, label).click();
  await page.locator(`#pickerGrid .tile[title="${itemName}"]`).click();
}
```

Dans le scénario principal :

```js
const linkedSlot = armorSlot(firstHero, "Armure liée");
await linkedSlot.click();
assert.equal(
  await page.locator("#overlay").evaluate(el => el.classList.contains("on")),
  false
);
assert.equal(await page.locator("#toast").textContent(), "Choisis d'abord un héros.");

await chooseHero(page, firstHero, "Meliodas");
await linkedSlot.click();
assert.deepEqual(
  (await page.locator("#pickerGrid .tile:not(.none)").evaluateAll(nodes =>
    nodes.map(node => node.title).sort()
  )),
  ["Défense simple", "Majesté bien malveillante", "Une nouvelle aventure"].sort()
);
await page.locator("#pickerClose").click();

await chooseArmor(page, firstHero, "Armure liée", "Une nouvelle aventure");
await chooseHero(page, firstHero, "Merlin");
assert.equal(await linkedSlot.evaluate(el => el.classList.contains("filled")), false);

const topSlot = armorSlot(firstHero, "Haut");
await topSlot.click();
const expectedTopCount = await page.evaluate(
  () => window.SEVEN_DS_DATA.armures.Haut.length
);
assert.equal(
  await page.locator("#pickerGrid .tile:not(.none)").count(),
  expectedTopCount
);
await page.locator("#pickerClose").click();
```

Étendre la sauvegarde historique avec une armure liée de Merlin portée par
Meliodas, puis vérifier après sauvegarde :

```js
armor:{
  "Armure liee":"7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp"
}
```

```js
assert.equal(migrated[0].heroes[0].armor["Armure liee"], null);
```

- [x] **Step 2: Vérifier que le picker global fait échouer le test**

Run:

```powershell
npm run test:e2e
```

Expected: échec sur l’ouverture sans héros ou sur le nombre de tuiles.

- [x] **Step 3: Retirer le choix incompatible dans `pickChar()`**

Après la validation existante de l’arme :

```js
hero.char = v;
if(!isWeaponCompatible(hero.char, hero.weapon)) hero.weapon = null;
if(!isLinkedArmorCompatible(
  hero.char,
  hero.armor[LINKED_ARMOR_SLOT]
)){
  hero.armor[LINKED_ARMOR_SLOT] = null;
}
renderBuilder();
```

- [x] **Step 4: Filtrer uniquement le picker `Armure liee`**

Remplacer `pickArmor()` par :

```js
function pickArmor(i, slot){
  const hero = draft.heroes[i];
  if(slot === LINKED_ARMOR_SLOT && !hero.char){
    toast("Choisis d'abord un héros.", true);
    return;
  }
  const allowed = slot === LINKED_ARMOR_SLOT
    ? new Set(linkedArmorsOf(hero.char))
    : null;
  const items = (DATA.armures[slot]||[])
    .filter(a => !allowed || allowed.has(a.file))
    .map(a => ({value:a.file, name:a.name, file:a.file}));
  Picker.open({
    title:"Armure — "+ARMOR_LABELS[slot],
    value:hero.armor[slot],
    items,
    emptyHint:slot === LINKED_ARMOR_SLOT
      ? "Aucune armure liée compatible disponible."
      : "Aucune armure disponible.",
    onSelect:v=>{ hero.armor[slot] = v; renderBuilder(); }
  });
}
```

- [x] **Step 5: Vérifier le parcours complet**

Run:

```powershell
npm run test:e2e
```

Expected: `PASS Playwright` et aucune `pageerror`.

- [x] **Step 6: Vérifier aussi les tests unitaires**

Run:

```powershell
npm run test:unit
```

Expected: tous les tests Python et Node passent.

- [x] **Step 7: Commit**

```powershell
git add index.html tests/potentiel-commun.playwright.js
git commit -m "feat: filter linked armor by hero"
```

---

### Task 4: Documentation et vérification finale

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/plans/2026-07-24-armures-liees-compatibles.md`

**Interfaces:**
- Documents: `window.SEVEN_DS_ARMURES_LIEES`
- Documents: commande `python generate-armures-liees.py`
- Documents: règle de normalisation de `armor["Armure liee"]`

- [x] **Step 1: Mettre à jour l’état et la structure dans `AGENTS.md`**

Ajouter à l’état actuel :

```markdown
- [x] Compatibilité des armures liées : 66 images locales associées aux 24 héros
      (2 ou 3 par héros). Le picker filtre selon le personnage et retire les
      anciennes valeurs incompatibles.
```

Ajouter à la structure :

```markdown
├─ armures-liees.js         # GÉNÉRÉ. Fichiers d’armure liée par personnage.
├─ generate-armures-liees.py # Régénération manuelle depuis la page publique.
```

Documenter que le script ne télécharge pas d’image, ne s’exécute jamais dans le
navigateur et ne doit être relancé que manuellement.

- [x] **Step 2: Documenter le contrat de données**

Ajouter :

```js
window.SEVEN_DS_ARMURES_LIEES = {
  "<charId>": [
    "7ds-armures-ssr/Armure liee/<nom>.webp"
  ]
};
```

Préciser que `normalizeHero()` retire l’armure liée si le fichier n’appartient
pas au tableau du héros, sans toucher aux quatre armures universelles.

- [x] **Step 3: Exécuter la suite complète**

Run:

```powershell
npm test
```

Expected:

```text
Ran 3 tests
OK
PASS potentiel commun
PASS Playwright
```

- [x] **Step 4: Vérifier le diff et l’état Git**

Run:

```powershell
git diff --check
git status --short
```

Expected: aucune erreur d’espacement ; seuls `AGENTS.md` et le plan sont encore
modifiés à cette étape.

- [x] **Step 5: Marquer le plan exécuté et commit**

Cocher les étapes réellement terminées, puis :

```powershell
git add AGENTS.md docs/superpowers/plans/2026-07-24-armures-liees-compatibles.md
git commit -m "docs: document linked armor compatibility"
```

- [x] **Step 6: Vérification post-commit**

Run:

```powershell
npm test
git status --short --branch
git log --oneline -5
```

Expected: suite complète verte, branche propre et quatre commits de
fonctionnalité visibles après les commits de spécification et de plan.
