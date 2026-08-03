import datetime
import json
import pathlib
import re
import urllib.request


# Ce script vit dans scripts/ ; les donnees qu'il lit et ecrit sont a la
# racine du depot, d'ou le second .parent.
ROOT = pathlib.Path(__file__).resolve().parent.parent
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
    decoded = html.replace(r'\"', '"').replace(r'\/', '/')
    rows = []
    for match in COSTUME_RE.finditer(decoded):
        rows.append(
            {
                "char": match.group("char"),
                "name": json.loads(f'"{match.group("name")}"'),
                "game_id": match.group("game_id"),
            }
        )
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
    return {char_id: sorted(files) for char_id, files in sorted(mapping.items())}


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
        headers={
            "User-Agent": "N-VA linked-armor updater (manual; github.com/yanniss13/N-VA)"
        },
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
