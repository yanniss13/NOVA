"""Fusion deterministe du contenu client exporte dans les catalogues locaux.

Le snapshot `7ds-stats/contenu-jeu.json` decrit les heros lus dans les tables
du jeu. Ce module les ramene exactement aux formes historiques des catalogues
(`personnages.json`, `personnages-meta.js`, `potentiels.js`) : memes cles,
meme ordre, meme vocabulaire. Il ne contacte jamais une source distante.
"""

import copy
import hashlib
import json
import os
import pathlib
import re
import tempfile


ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_SNAPSHOT = ROOT / "7ds-stats" / "contenu-jeu.json"
MAPPING_SECTIONS = {"meta", "potentials", "linkedArmors"}
LINKED_ARMOR_FOLDER = "7ds-armures-ssr/Armure liee/"
# Prefixe de nom de fichier quand deux heros portent une tenue du meme nom.
HERO_NAME_SEPARATOR = " — "

# enum weaponType du jeu -> nom de dossier d'arme public (segment de chemin).
WEAPON_FOLDERS = {
    "Axe": "Hache", "Book": "Livre", "SwordDual": "Epees doubles", "Rapier": "Rapiere",
    "Shield": "Bouclier", "Lance": "Lance", "Sword1h": "Epee 1 main", "Cudgel3c": "Nunchaku",
    "Gauntlets": "Gantelets", "Sword2h": "Epee 2 mains", "Staff": "Baton", "Wand": "Baguette",
}
# Le jeu note la rarete d'un heros par grade ; le site emploie SR/SSR.
RARITY_BY_GRADE = {"Grade5": "SSR", "Grade4": "SR"}
ROLES = {"ATTACKER", "DEFENDER", "SUPPORT"}
ELEMENTS = {"FIRE", "WIND", "DARK", "EARTH", "HOLY", "ICE", "THUNDER", "DEFAULT"}
BASE_STAT_FIELDS = (
    "baseHp", "baseAtk", "baseDef", "baseSpd", "accuracy", "block", "critRate",
    "critDamage", "critResist", "critDmgResist", "blockDmgResist",
    "pvpDmgUp", "pvpDmgDown",
)
MISSING_FROM_EXPORT = "missing-from-export"
PLACEHOLDER = re.compile(r"\{\d+\}")
NO_BREAK_SPACE = chr(0xA0)


def load_snapshot(path=DEFAULT_SNAPSHOT):
    """Lit le snapshot versionne sans jamais contacter une source distante."""
    payload = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    validate_snapshot(payload)
    return payload


def validate_snapshot(payload):
    if not isinstance(payload, dict) or payload.get("version") != 1:
        raise ValueError("version de contenu-jeu incompatible")
    if not isinstance(payload.get("heroes"), dict):
        raise ValueError("heroes de contenu-jeu invalide")


def snapshot_or_default(snapshot):
    if snapshot is None:
        return load_snapshot()
    validate_snapshot(snapshot)
    return snapshot


def client_slugs(snapshot=None):
    """Slugs clients, dans l'ordre canonique de fusion."""
    payload = snapshot_or_default(snapshot)
    return tuple(sorted(payload["heroes"], key=str.casefold))


def normalize_rarity(value, slug):
    if value not in RARITY_BY_GRADE:
        raise ValueError(f"rareté inconnue pour {slug}: {value}")
    return RARITY_BY_GRADE[value]


def normalize_role(value, slug):
    if value not in ROLES:
        raise ValueError(f"rôle inconnu pour {slug}: {value}")
    return value


def normalize_element(value, slug):
    if value not in ELEMENTS:
        raise ValueError(f"élément inconnu pour {slug}: {value}")
    return value


def normalize_slots(slots, slug):
    """Trois emplacements dans l'ordre du jeu, cles dans l'ordre historique."""
    if not isinstance(slots, list) or len(slots) != 3:
        raise ValueError(f"{slug}: trois emplacements d'arme requis")
    normalized = []
    for slot in slots:
        weapon = slot.get("weapon") if isinstance(slot, dict) else None
        if weapon not in WEAPON_FOLDERS:
            raise ValueError(f"{slug}: arme inconnue {weapon}")
        if not isinstance(slot.get("role"), str) or not isinstance(slot.get("element"), str):
            raise ValueError(f"{slug}/{weapon}: emplacement invalide")
        normalized.append({"role": slot["role"], "weapon": weapon, "element": slot["element"]})
    if len({slot["weapon"] for slot in normalized}) != 3:
        raise ValueError(f"{slug}: armes dupliquées")
    return normalized


def hero_weapons(hero, slug):
    return [slot["weapon"] for slot in normalize_slots(hero["meta"].get("weapons"), slug)]


def normalize_meta(hero, slug):
    meta = hero.get("meta") if isinstance(hero, dict) else None
    character = hero.get("character") if isinstance(hero, dict) else None
    if not isinstance(meta, dict) or not isinstance(character, dict):
        raise ValueError(f"section meta absente pour {slug}")
    rarity = normalize_rarity(meta.get("rarity"), slug)
    role = normalize_role(meta.get("role"), slug)
    if (normalize_rarity(character.get("rarity"), slug) != rarity
            or normalize_role(character.get("role"), slug) != role):
        raise ValueError(f"{slug}: meta et personnage incohérents")
    return {
        "element": normalize_element(character.get("element"), slug),
        "rarity": rarity,
        "role": role,
        "weapons": normalize_slots(meta.get("weapons"), slug),
    }


def potential_rows(hero, slug):
    """Paliers valides par arme, dans l'ordre alphabetique des enums d'arme."""
    raw = hero.get("potentials") if isinstance(hero, dict) else None
    if not isinstance(raw, dict):
        raise ValueError(f"section potentials absente pour {slug}")
    allowed = set(hero_weapons(hero, slug))
    result = {}
    for weapon_type in sorted(raw):
        tiers = raw[weapon_type]
        context = f"{slug}/{weapon_type}"
        if weapon_type not in allowed:
            raise ValueError(f"{context}: arme hors maîtrises du héros")
        if not isinstance(tiers, list) or [
            tier.get("tier") if isinstance(tier, dict) else None for tier in tiers
        ] != list(range(1, 11)):
            raise ValueError(f"{context}: paliers 1 à 10 requis")
        rows = []
        for tier in tiers:
            if tier.get("weaponType") != weapon_type:
                raise ValueError(f"{context}: type de potentiel incoherent")
            for field in ("bonusFr", "bonusEn"):
                if not isinstance(tier.get(field), str) or PLACEHOLDER.search(tier[field]):
                    raise ValueError(f"{context}: texte absent ou placeholder résiduel")
            # Typographie seulement : les paliers historiques n'emploient
            # aucune espace insecable, et des phrases citees en dependent.
            rows.append({
                "tier": tier["tier"],
                "bonusFr": tier["bonusFr"].replace(NO_BREAK_SPACE, " "),
                "bonusEn": tier["bonusEn"].replace(NO_BREAK_SPACE, " "),
            })
        result[weapon_type] = rows
    if set(result) != allowed:
        raise ValueError(f"{slug}: potentiels requis pour les trois armes")
    return result


def normalize_potentials_catalog(hero, slug):
    """Forme de potentiels.js : dossier public -> dix textes francais."""
    return {
        WEAPON_FOLDERS[weapon_type]: [tier["bonusFr"] for tier in tiers]
        for weapon_type, tiers in potential_rows(hero, slug).items()
    }


def linked_armor_files(hero, slug):
    """Images locales des tenues liees d'un heros, une par tenue du snapshot.

    Le catalogue public identifie une tenue par le NOM DE SON FICHIER. Deux
    heros peuvent porter une tenue du meme nom : le fichier prend alors le nom
    du heros en prefixe. Les deux formes sont admises, aucune autre : un
    fichier qui ne nomme pas sa tenue rattacherait l'image a la mauvaise piece.
    """
    armors = hero.get("linkedArmors")
    assets = (hero.get("assets") or {}).get("linkedArmors")
    if not isinstance(armors, list) or not armors:
        raise ValueError(f"{slug}: aucune tenue liée dans le snapshot")
    if not isinstance(assets, list) or len(assets) != len(armors):
        raise ValueError(f"{slug}: autant d'images que de tenues liées attendues")
    targets = [str(asset.get("target") or "") for asset in assets]
    for target in targets:
        if not target.startswith(LINKED_ARMOR_FOLDER) or not target.endswith(".webp"):
            raise ValueError(f"{slug}: image hors de {LINKED_ARMOR_FOLDER} : {target}")
    files = {}
    for armor in armors:
        name = armor.get("nameFr")
        prefixe = f"{hero.get('nameFr')}{HERO_NAME_SEPARATOR}{name}"
        stems = {name, prefixe}
        found = [
            target for target in targets
            if target[len(LINKED_ARMOR_FOLDER):-len(".webp")] in stems
        ]
        if len(found) != 1:
            raise ValueError(
                f"{slug}: {len(found)} image(s) nommée(s) « {name} »"
            )
        files[armor.get("gameId")] = found[0]
    if len(set(files.values())) != len(targets):
        raise ValueError(f"{slug}: une image sert deux tenues liées")
    return files


def normalize_linked_armors(hero, slug):
    """Forme d'armures-liees.js : slug -> chemins d'images, triés."""
    return sorted(linked_armor_files(hero, slug).values())


def linked_armor_rows(snapshot=None):
    """Lignes de tenues liees pour le rapprochement du generateur public.

    Meme forme que les lignes lues sur la page publique — `char`, `name`,
    `game_id` —, `name` etant le nom du FICHIER, seule cle du rapprochement.
    """
    payload = snapshot_or_default(snapshot)
    rows = []
    for slug in client_slugs(payload):
        files = linked_armor_files(payload["heroes"][slug], slug)
        for game_id, target in files.items():
            rows.append({
                "char": slug,
                "name": target[len(LINKED_ARMOR_FOLDER):-len(".webp")],
                "game_id": game_id,
            })
    return sorted(rows, key=lambda row: (row["char"], row["name"]))


SECTION_NORMALIZERS = {
    "meta": normalize_meta,
    "potentials": normalize_potentials_catalog,
    "linkedArmors": normalize_linked_armors,
}


def merge_mapping(base, section, snapshot=None, replace_client=False):
    """Ajoute une section par slug sans muter la source historique.

    Le mode normal refuse une collision : il signale qu'un heros est devenu
    public et qu'il faut alors retirer son import client explicitement. Le
    mode cible ne peut remplacer que les slugs presentes dans le snapshot.
    """
    if section not in MAPPING_SECTIONS:
        raise ValueError(f"section inconnue: {section}")
    if not isinstance(base, dict):
        raise ValueError(f"base invalide dans {section}")
    payload = snapshot_or_default(snapshot)
    result = copy.deepcopy(base)
    for slug in client_slugs(payload):
        hero = payload["heroes"][slug]
        if not isinstance(hero, dict) or section not in hero:
            raise ValueError(f"section {section} absente pour {slug}")
        if slug in result and not replace_client:
            raise ValueError(f"slug dupliqué dans {section}: {slug}")
        result[slug] = SECTION_NORMALIZERS[section](hero, slug)
    return result


def stat_key(code):
    """Cle de comparaison d'un code de stat : casse et separateurs ignores."""
    return re.sub(r"[^a-z0-9]+", "", code.casefold())


def gains(items, context):
    if not isinstance(items, list):
        raise ValueError(f"{context}: gains invalides")
    normalized = []
    for item in items:
        stat = item.get("stat") if isinstance(item, dict) else None
        value = item.get("value") if isinstance(item, dict) else None
        if not isinstance(stat, str) or not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{context}: gain invalide")
        normalized.append({"stat": stat, "value": value})
    return normalized


def mastery_node(node, slug, weapon_type, level):
    abilities = node.get("abilities") or []
    values = node.get("values") or []
    if not isinstance(abilities, list) or not isinstance(values, list):
        raise ValueError(f"{slug}/{weapon_type}/{level}: noeud de maitrise invalide")
    if len(abilities) != len(values):
        raise ValueError(f"{slug}/{weapon_type}/{level}: valeurs de maitrise incoherentes")
    grade = node.get("grade")
    if grade not in {1, 2}:
        raise ValueError(f"{slug}/{weapon_type}/{level}: grade de noeud invalide")
    normalized = []
    for stat, value in zip(abilities, values):
        if not isinstance(stat, str) or not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{slug}/{weapon_type}/{level}: aptitude de maitrise invalide")
        normalized.append({"stat": stat, "value": value})
    # Verifie sur les 1638 noeuds historiques : grade 2 <=> Special.
    return {
        "nodeType": "Special" if grade == 2 else "Normal",
        "grade": grade,
        "abilities": normalized,
    }


def normalize_weapon_masteries(raw_masteries, slug):
    """Aplati les trois branches du snapshot vers le format historique."""
    if not isinstance(raw_masteries, list):
        raise ValueError(f"{slug}: maitrises invalides")
    flattened = []
    for branch in sorted(
        raw_masteries,
        key=lambda item: str(item.get("weaponType")) if isinstance(item, dict) else "",
    ):
        weapon_type = branch.get("weaponType") if isinstance(branch, dict) else None
        levels = branch.get("levels") if isinstance(branch, dict) else None
        if not isinstance(weapon_type, str) or not isinstance(levels, list):
            raise ValueError(f"{slug}: branche de maitrise invalide")
        for source_level in levels:
            level = source_level.get("level") if isinstance(source_level, dict) else None
            nodes = source_level.get("nodes") if isinstance(source_level, dict) else None
            sub_levels = source_level.get("subLevels") if isinstance(source_level, dict) else None
            if not isinstance(level, int) or not isinstance(nodes, list) or not isinstance(sub_levels, list):
                raise ValueError(f"{slug}/{weapon_type}: niveau de maitrise invalide")
            context = f"{slug}/{weapon_type}/{level}"
            normalized_sub_levels = []
            for sub_level in sub_levels:
                exp = sub_level.get("exp") if isinstance(sub_level, dict) else None
                if not isinstance(exp, int) or isinstance(exp, bool):
                    raise ValueError(f"{context}: sous-palier invalide")
                normalized_sub_levels.append({
                    "exp": exp,
                    "abilities": gains(sub_level.get("abilities"), context),
                })
            if not all(isinstance(node, dict) for node in nodes):
                raise ValueError(f"{context}: noeud de maitrise invalide")
            flattened.append({
                "weaponType": weapon_type,
                "level": level,
                "subLevels": normalized_sub_levels,
                "nodes": [mastery_node(node, slug, weapon_type, level) for node in nodes],
            })
    return flattened


def normalize_potentials(hero, slug):
    """Forme de personnages.json : `stats` vide, reconstruit par stats-build."""
    return [
        {
            "weaponType": weapon_type,
            "tier": tier["tier"],
            "bonusFr": tier["bonusFr"],
            "bonusEn": tier["bonusEn"],
            "stats": [],
        }
        for weapon_type, tiers in potential_rows(hero, slug).items()
        for tier in tiers
    ]


def base_stats(character, slug):
    """Les treize champs historiques ; seule une absence declaree est admise."""
    coverage = character.get("coverage") or {}
    stats = {}
    for field in BASE_STAT_FIELDS:
        value = character.get(field)
        if value is None:
            if (coverage.get(field) or {}).get("status") != MISSING_FROM_EXPORT:
                raise ValueError(f"{slug}: statistique {field} absente sans couverture")
        elif not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{slug}: statistique {field} invalide")
        stats[field] = value
    return stats


def character_from_snapshot(hero, slug):
    if not isinstance(hero, dict) or not isinstance(hero.get("character"), dict):
        raise ValueError(f"personnage absent pour {slug}")
    source = hero["character"]
    if source.get("slug") != slug:
        raise ValueError(f"slug de personnage incoherent: {slug}")
    meta = normalize_meta(hero, slug)
    common = gains(source.get("commonMasteryStats"), f"{slug}: maitrise commune")
    if not common:
        raise ValueError(f"{slug}: maitrise commune absente")
    character = {
        "id": source.get("id"),
        "slug": slug,
        "nameFr": source.get("nameFr"),
        "nameEn": source.get("nameEn"),
        "element": meta["element"],
        "rarity": meta["rarity"],
        "role": meta["role"],
        "portraitUrl": source.get("portraitUrl"),
        "weaponSlots": normalize_slots(source.get("weaponSlots"), slug),
        "weaponMasteries": normalize_weapon_masteries(source.get("weaponMasteries"), slug),
        "potentials": normalize_potentials(hero, slug),
        "commonMasteryTid": source.get("commonMasteryTid"),
        **base_stats(source, slug),
        "commonMasteryStats": common,
    }
    if character["weaponSlots"] != meta["weapons"]:
        raise ValueError(f"{slug}: emplacements d'arme incohérents")
    if source.get("coverage"):
        character["coverage"] = copy.deepcopy(source["coverage"])
    return character


def historical_stat_spellings(characters):
    """Orthographe de chaque code de stat deja employee par l'historique."""
    spellings = {}

    def visit(value):
        if isinstance(value, dict):
            if isinstance(value.get("stat"), str):
                spellings.setdefault(stat_key(value["stat"]), set()).add(value["stat"])
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(characters)
    # Deux orthographes historiques pour un meme code : on ne tranche pas.
    return {key: next(iter(codes)) for key, codes in spellings.items() if len(codes) == 1}


def align_stat_spelling(value, spellings):
    """Un seul vocabulaire : le code client prend l'orthographe historique."""
    if isinstance(value, dict):
        if isinstance(value.get("stat"), str):
            value["stat"] = spellings.get(stat_key(value["stat"]), value["stat"])
        for child in value.values():
            align_stat_spelling(child, spellings)
    elif isinstance(value, list):
        for child in value:
            align_stat_spelling(child, spellings)


def merge_characters(base, snapshot=None, replace_client=False):
    """Fusionne les personnages client tout en preservant l'ordre historique."""
    if not isinstance(base, list):
        raise ValueError("base personnages invalide")
    payload = snapshot_or_default(snapshot)
    result = copy.deepcopy(base)
    positions = {}
    for index, character in enumerate(result):
        slug = character.get("slug") if isinstance(character, dict) else None
        if not isinstance(slug, str):
            raise ValueError("personnage historique sans slug")
        if slug in positions:
            raise ValueError(f"slug dupliqué dans personnages: {slug}")
        positions[slug] = index
    clients = client_slugs(payload)
    spellings = historical_stat_spellings(
        [character for character in result if character["slug"] not in clients]
    )
    for slug in clients:
        character = character_from_snapshot(payload["heroes"][slug], slug)
        align_stat_spelling(character, spellings)
        if slug in positions:
            if not replace_client:
                raise ValueError(f"slug dupliqué dans personnages: {slug}")
            result[positions[slug]] = character
        else:
            positions[slug] = len(result)
            result.append(character)
    return result


def without_slugs(payload, slugs):
    targets = set(slugs)
    if isinstance(payload, dict):
        return {key: value for key, value in payload.items() if key not in targets}
    if isinstance(payload, list):
        return [
            value for value in payload
            if not isinstance(value, dict) or value.get("slug") not in targets
        ]
    raise ValueError("payload sans slug invalide")


def semantic_hash_without_slugs(payload, slugs):
    """Empreinte de contenu stable, hors entrees clients remplacables."""
    canonical = json.dumps(
        without_slugs(payload, slugs),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def replace_client_entries(base, merge, snapshot=None):
    """Mode --client-only : remplace les slugs clients et prouve le reste intact.

    `merge(base, snapshot, replace_client)` produit la sortie complete. Son
    empreinte hors slugs clients doit egaler celle de la base, sinon rien
    n'est publie. Renvoie la sortie et cette empreinte.
    """
    payload = snapshot_or_default(snapshot)
    slugs = client_slugs(payload)
    before = semantic_hash_without_slugs(base, slugs)
    result = merge(base, payload, replace_client=True)
    after = semantic_hash_without_slugs(result, slugs)
    if before != after:
        raise ValueError(f"héros historiques modifiés: {before} != {after}")
    return result, before


def read_window_assignment(path, name):
    """Relit l'objet JSON d'un catalogue `window.NAME = {...};` genere."""
    text = pathlib.Path(path).read_text(encoding="utf-8")
    marker = f"window.{name} = "
    start = text.find(marker)
    if start == -1:
        raise ValueError(f"{name} introuvable dans {pathlib.Path(path).name}")
    body = text[start + len(marker):].rstrip()
    if not body.endswith(";"):
        raise ValueError(f"{name} non terminé dans {pathlib.Path(path).name}")
    return json.loads(body[:-1])


def render_window_assignment(header_lines, name, payload):
    return (
        "".join(line + "\n" for line in header_lines)
        + f"window.{name} = "
        + json.dumps(payload, ensure_ascii=False, indent=1)
        + ";\n"
    )


def merge_section(section):
    def merge(base, snapshot, replace_client=False):
        return merge_mapping(base, section, snapshot, replace_client=replace_client)
    return merge


def client_only_mapping_catalog(path, name, section, header_lines, snapshot=None):
    """--client-only d'un catalogue `window.NAME` : sans reseau, atomique."""
    base = read_window_assignment(path, name)
    result, digest = replace_client_entries(base, merge_section(section), snapshot)
    write_text_atomic(path, render_window_assignment(header_lines, name, result))
    return len(result), digest


def check_mapping_catalog(path, name, section, header_lines,
                          characters_path=ROOT / "7ds-stats" / "personnages.json",
                          snapshot=None):
    """--check : memes cles que personnages.json, entrees client a jour."""
    catalog = read_window_assignment(path, name)
    characters = json.loads(pathlib.Path(characters_path).read_text(encoding="utf-8"))
    slugs = sorted(character["slug"] for character in characters)
    if sorted(catalog) != slugs:
        raise ValueError(
            f"clés de {pathlib.Path(path).name} différentes de personnages.json : "
            f"{sorted(set(slugs) - set(catalog))} manquants, "
            f"{sorted(set(catalog) - set(slugs))} en trop"
        )
    expected = render_window_assignment(
        header_lines, name, merge_mapping(catalog, section, snapshot, replace_client=True)
    )
    if pathlib.Path(path).read_text(encoding="utf-8") != expected:
        raise ValueError(f"{pathlib.Path(path).name} doit être régénéré")


def write_text_atomic(path, text):
    """Publie une sortie complete ou conserve l'ancienne, jamais un entre-deux."""
    target = pathlib.Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=target.parent, text=True
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
        os.replace(temporary, target)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
