"""Instantane des armures liees jouables, par personnage.

Usage :   python generate-armures-liees.py               (reseau requis)
          python generate-armures-liees.py --client-only (sans reseau :
                 remplace seulement les heros du snapshot local)
          python generate-armures-liees.py --check
"""
import argparse
import datetime
import json
import os
import pathlib
import re
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import client_content  # noqa: E402


# Ce script vit dans scripts/ ; les donnees qu'il lit et ecrit sont a la
# racine du depot, d'ou le second .parent.
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = "https://7dsorigin.app/fr/team-builder/create"
ARMOR_DIR = ROOT / "7ds-armures-ssr" / "Armure liee"
CHARACTER_DIR = ROOT / "7ds-personnages"
OUT = ROOT / "data" / "armures-liees.js"
NAME = "SEVEN_DS_ARMURES_LIEES"
FOLDER = client_content.LINKED_ARMOR_FOLDER


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


def build_mapping(html, armor_dir=ARMOR_DIR, character_dir=CHARACTER_DIR,
                  client_rows=None):
    """Rapproche les images locales de leur personnage, par nom de fichier.

    Les lignes clientes completent celles de la page publique : un heros
    absent de cette page y apporte ses tenues, sous la meme forme.
    """
    candidates = extract_candidates(html) + list(client_rows or [])
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
        "// Héros absents de cette page : tables du jeu, via 7ds-stats/contenu-jeu.json.\n"
        f"// Date de génération : {generated_at}\n"
        "// Instantané local : aucun appel réseau n'est effectué par index.html.\n"
        "window.SEVEN_DS_ARMURES_LIEES = "
        + json.dumps(mapping, ensure_ascii=False, indent=2)
        + ";\n"
    )


def generate(html, output=OUT, armor_dir=ARMOR_DIR, character_dir=CHARACTER_DIR,
             snapshot=None):
    mapping = build_mapping(
        html, armor_dir, character_dir,
        client_rows=client_content.linked_armor_rows(snapshot),
    )
    rendered = render_js(mapping)
    pathlib.Path(output).write_text(rendered, encoding="utf-8", newline="\n")
    return mapping


def local_files(armor_dir, character_dir):
    """Ce que le depot porte vraiment : les images pilotent le catalogue."""
    files = {FOLDER + path.name for path in pathlib.Path(armor_dir).glob("*.webp")}
    characters = {path.stem for path in pathlib.Path(character_dir).glob("*.webp")}
    if not files:
        raise DataError("Aucune armure liee locale trouvee")
    if not characters:
        raise DataError("Aucun personnage local trouve")
    return files, characters


def merge_client(base, snapshot, replace_client=False):
    return client_content.merge_mapping(
        base, "linkedArmors", snapshot, replace_client=replace_client)


def client_only(output=OUT, snapshot=None, armor_dir=ARMOR_DIR,
                character_dir=CHARACTER_DIR):
    """Sans reseau : remplace les heros du snapshot, prouve le reste intact.

    Le mode complet relit la page publique et refait les 26 rapprochements ;
    ce mode-ci ne touche qu'aux slugs du snapshot et verifie, par empreinte,
    que les autres n'ont pas bouge. L'ecriture est atomique : une sortie
    complete ou l'ancienne, jamais un entre-deux.
    """
    base = client_content.read_window_assignment(output, NAME)
    mapping, digest = client_content.replace_client_entries(
        base, merge_client, snapshot)
    files, characters = local_files(armor_dir, character_dir)
    for slug in client_content.client_slugs(snapshot):
        if slug not in characters:
            raise DataError(f"{slug}: portrait local absent")
        for path in mapping[slug]:
            if path not in files:
                raise DataError(f"{slug}: image absente du depot ({path})")
    client_content.write_text_atomic(output, render_js(mapping))
    return mapping, digest


def check(output=OUT, snapshot=None, armor_dir=ARMOR_DIR,
          character_dir=CHARACTER_DIR):
    """Le catalogue commite dit-il encore ce que le depot porte ?

    Sans reseau : les entrees clientes doivent etre a jour, chaque image
    locale doit etre citee une fois et une seule, et chaque personnage local
    doit avoir sa tenue. Une image ajoutee sans regeneration se voit ici.
    """
    mapping = client_content.read_window_assignment(output, NAME)
    if mapping != merge_client(mapping, snapshot, replace_client=True):
        raise DataError("armures-liees.js doit etre regenere")
    files, characters = local_files(armor_dir, character_dir)
    cited = [path for paths in mapping.values() for path in paths]
    if len(cited) != len(set(cited)):
        raise DataError("une image locale est citee deux fois")
    missing = sorted(files - set(cited))
    if missing:
        raise DataError("images locales absentes du catalogue : "
                        + ", ".join(missing))
    unknown = sorted(set(cited) - files)
    if unknown:
        raise DataError("images citees mais absentes du depot : "
                        + ", ".join(unknown))
    if set(mapping) != characters:
        raise DataError("personnages du catalogue et du depot differents")
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--client-only", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        mapping = check()
        print("armures-liees.js à jour")
        print(f"  Personnages : {len(mapping)}")
        return
    if args.client_only:
        mapping, digest = client_only()
        print("OK -> armures-liees.js : héros du snapshot fusionnés")
        print(f"  Personnages : {len(mapping)}")
        print(f"  Armures liées : {sum(map(len, mapping.values()))}")
        print(f"  Empreinte des héros publics inchangée : {digest}")
        return
    mapping = generate(fetch())
    print("OK -> armures-liees.js généré")
    print(f"  Personnages : {len(mapping)}")
    print(f"  Armures liées : {sum(map(len, mapping.values()))}")


if __name__ == "__main__":
    main()
