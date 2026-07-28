"""Recupere les stats de 7dsorigin.app et ecrit les fichiers de 7ds-stats/.

Source : la page /fr/team-builder/create embarque tout son jeu de donnees dans
le payload RSC de Next.js (les morceaux `self.__next_f.push([1,"..."])` du HTML
rendu par le serveur). Un simple GET suffit donc : pas de navigateur, et on ne
touche jamais /api/, que leur robots.txt interdit a tous les agents.

Usage : python generate-stats.py
"""

import json
import os
import urllib.request

PAGE = "https://7dsorigin.app/fr/team-builder/create"
OUT_DIR = "7ds-stats"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; ConfrerieSevenDS/1.0)",
    "Accept-Language": "fr-FR,fr;q=0.9",
}
# Collections extraites du payload, avec le nombre attendu au moment de l'ecriture
# de ce script. Un ecart n'est pas une erreur (le jeu evolue) mais est signale.
EXPECTED = {
    "characters": 24,
    "weapons": 142,
    "equipItems": 229,
    "costumeArmors": 83,
    "gearSets": 21,
}


def fetch(url):
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read().decode("utf-8", "replace")


def flight_payload(html):
    """Recolle les morceaux RSC en une seule chaine."""
    decoder = json.JSONDecoder()
    marker = "self.__next_f.push([1,"
    chunks = []
    index = html.find(marker)
    while index != -1:
        start = index + len(marker)
        while start < len(html) and html[start] in " \t\r\n":
            start += 1
        if start < len(html) and html[start] == '"':
            try:
                text, _ = decoder.raw_decode(html, start)
                chunks.append(text)
            except ValueError:
                pass
        index = html.find(marker, index + 1)
    return "".join(chunks)


def balanced_end(text, start):
    """Index de fermeture du tableau ou de l'objet ouvert en `start`."""
    opener = text[start]
    closer = "]" if opener == "[" else "}"
    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(text)):
        char = text[i]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == opener:
            depth += 1
        elif char == closer:
            depth -= 1
            if depth == 0:
                return i
    return -1


def collect(flight, key):
    """Toutes les occurrences de `"key":[...]`, fusionnees et dedupliquees.

    Le payload peut livrer une meme collection en plusieurs morceaux ; on
    deduplique sur la representation JSON pour ne pas compter deux fois.
    """
    needle = '"%s":[' % key
    merged = []
    seen = set()
    index = flight.find(needle)
    while index != -1:
        start = index + len(needle) - 1
        end = balanced_end(flight, start)
        if end != -1:
            try:
                items = json.loads(flight[start:end + 1])
            except ValueError:
                items = None
            if isinstance(items, list):
                for item in items:
                    signature = json.dumps(item, sort_keys=True, ensure_ascii=False)
                    if signature in seen:
                        continue
                    seen.add(signature)
                    merged.append(item)
        index = flight.find(needle, index + 1)
    return merged


def find_object(flight, key):
    """Premier objet `"key":{...}` du payload, decode."""
    needle = '"%s":{' % key
    index = flight.find(needle)
    while index != -1:
        start = index + len(needle) - 1
        end = balanced_end(flight, start)
        if end != -1:
            try:
                return json.loads(flight[start:end + 1])
            except ValueError:
                pass
        index = flight.find(needle, index + 1)
    return {}


def stat_labels(node, labels):
    """Dictionnaire code de stat -> libelles, collecte partout dans l'arbre."""
    if isinstance(node, list):
        for item in node:
            stat_labels(item, labels)
        return
    if not isinstance(node, dict):
        return
    code = node.get("stat") or node.get("key") or node.get("abilityType")
    if isinstance(code, str) and code and (node.get("nameFr") or node.get("nameEn")):
        entry = labels.setdefault(code, {})
        if node.get("nameFr"):
            entry["fr"] = node["nameFr"]
        if node.get("nameEn"):
            entry["en"] = node["nameEn"]
        if "isRate" in node:
            entry["taux"] = bool(node["isRate"])
    for value in node.values():
        stat_labels(value, labels)


def write(name, payload):
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1, sort_keys=False)
        handle.write("\n")
    return os.path.getsize(path)


def main():
    html = fetch(PAGE)
    flight = flight_payload(html)
    if len(flight) < 1_000_000:
        raise SystemExit(
            "payload RSC trop court (%d octets) : la page a change de forme"
            % len(flight)
        )

    data = {key: collect(flight, key) for key in EXPECTED}
    for key, expected in EXPECTED.items():
        found = len(data[key])
        flag = "" if found == expected else "  (attendu %d)" % expected
        print("%-15s %4d%s" % (key, found, flag))
        if not found:
            raise SystemExit("collection vide : %s" % key)

    os.makedirs(OUT_DIR, exist_ok=True)
    labels = {}
    stat_labels(data, labels)
    # Le site expose en plus un dictionnaire court d'interface (« ATK », « DEF »)
    # pour quelques codes seulement : il complete les libelles longs, sans les
    # remplacer.
    for code, short in (find_object(flight, "statLabels") or {}).items():
        if isinstance(short, str) and short:
            labels.setdefault(code, {})["court"] = short

    # Armures gravees : les stats sont indexees par gameId, l'identite du costume
    # vit chez le personnage. On rapproche les deux.
    costume_by_game_id = {}
    for character in data["characters"]:
        for costume in character.get("costumes") or []:
            game_id = costume.get("itemGameId")
            if game_id:
                costume_by_game_id[game_id] = (character, costume)
    engraved = []
    for armor in data["costumeArmors"]:
        character, costume = costume_by_game_id.get(armor.get("gameId"), (None, None))
        entry = dict(armor)
        if character:
            entry["personnage"] = character["slug"]
            entry["personnageNomFr"] = character["nameFr"]
        if costume:
            entry["costumeSlug"] = costume.get("slug")
            entry["nameFr"] = costume.get("nameFr")
            entry["nameEn"] = costume.get("nameEn")
            entry["rarity"] = costume.get("rarity")
            entry["effectNameFr"] = costume.get("effectNameFr")
            entry["engravingPassives"] = costume.get("engravingPassives")
            entry["bindingMaterials"] = costume.get("bindingMaterials")
            entry["iconUrl"] = costume.get("iconUrl")
        engraved.append(entry)

    # Enchantements : consolides depuis les trois endroits ou ils vivent.
    basic, masterstone, armor_options = [], [], []
    for weapon in data["weapons"]:
        for grade in weapon.get("grades") or []:
            ench = grade.get("enchantments") or {}
            row = {
                "arme": weapon["slug"],
                "nomFr": weapon["nameFr"],
                "typeArme": weapon["weaponType"],
                "rarete": grade.get("rarity"),
                "gameId": grade.get("gameId"),
            }
            if ench.get("type") == "masterstone":
                row["paliers"] = ench.get("tiers")
                masterstone.append(row)
            elif ench.get("type") == "basic":
                row["emplacements"] = ench.get("slots")
                row["options"] = ench.get("options")
                basic.append(row)
    # Les options aleatoires d'une armure vivent dans `growth`, pas a la racine.
    # Seuls les hauts grades en ont : on n'inscrit que celles qui existent.
    for item in data["equipItems"]:
        options = (item.get("growth") or {}).get("randomOptions") or {}
        if not options.get("stats"):
            continue
        armor_options.append({
            "armure": item["slug"],
            "nomFr": item["nameFr"],
            "emplacement": item.get("slot"),
            "grade": item.get("grade"),
            "emplacements": options.get("slots"),
            "stats": options.get("stats"),
        })
    engraved_options = []
    for armor in engraved:
        options = (armor.get("growth") or {}).get("randomOptions") or {}
        if not options.get("stats"):
            continue
        engraved_options.append({
            "gameId": armor.get("gameId"),
            "personnage": armor.get("personnage"),
            "nomFr": armor.get("nameFr"),
            "emplacements": options.get("slots"),
            "stats": options.get("stats"),
        })

    sizes = [
        ("personnages.json", write("personnages.json", data["characters"])),
        ("armes.json", write("armes.json", data["weapons"])),
        ("armures.json", write("armures.json", data["equipItems"])),
        ("armures-gravees.json", write("armures-gravees.json", engraved)),
        ("sets.json", write("sets.json", data["gearSets"])),
        ("enchantements.json", write("enchantements.json", {
            "armesBasiques": basic,
            "armesPierreMaitresse": masterstone,
            "armuresOptions": armor_options,
            "armuresGraveesOptions": engraved_options,
        })),
        ("libelles-stats.json", write("libelles-stats.json", labels)),
    ]
    print()
    for name, size in sizes:
        print("%-24s %7.1f Ko" % (name, size / 1024))
    print()
    print("enchantements : %d tables basiques, %d pierre maitresse, "
          "%d armures, %d armures gravees"
          % (len(basic), len(masterstone), len(armor_options), len(engraved_options)))
    print("%d codes de stat repertories" % len(labels))


if __name__ == "__main__":
    main()
