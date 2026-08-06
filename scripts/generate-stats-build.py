import argparse
import json
import re
import unicodedata
from pathlib import Path


FOLDER_TO_ENUM = {
    "Baguette": "Wand", "Baton": "Staff", "Bouclier": "Shield",
    "Epee 1 main": "Sword1h", "Epee 2 mains": "Sword2h",
    "Epees doubles": "SwordDual", "Gantelets": "Gauntlets",
    "Hache": "Axe", "Lance": "Lance", "Livre": "Book",
    "Nunchaku": "Cudgel3c", "Rapiere": "Rapier",
}
MAIN_STAT_CODES = {
    "attack": "B_Atk_Equip",
    "defense": "B_Def_Equip",
    "hp": "B_MaxHp_Equip",
}
ALLOWED_FAMILIES = {"main", "additional", "damage", "special", "elemental"}
ALLOWED_UNITS = {"flat", "ten-thousandths"}
PROMOTION_MAXES = [20, 30, 40, 50]
OVERLIMIT_RATES = [0, 500, 1000, 1750, 2500, 3750, 5000]
SLOT_FOLDERS = {
    "Haut": "Top", "Bas": "Bottom", "Bottes": "Shoes", "Ceinture": "Belt",
    "Anneau": "Ring", "Collier": "Necklace", "Boucle d'oreille": "Earring",
}
ENGRAVED_FOLDER = "Armure liee"
CHARACTER_BASE_FIELDS = {
    "baseHp": ("B_MaxHp", "flat"),
    "baseAtk": ("B_Atk", "flat"),
    "baseDef": ("B_Def", "flat"),
    "baseSpd": ("baseSpd", "flat"),
    "accuracy": ("accuracy", "ten-thousandths"),
    "block": ("block", "ten-thousandths"),
    "critRate": ("critRate", "ten-thousandths"),
    "critDamage": ("critDamage", "ten-thousandths"),
    "critResist": ("critResist", "ten-thousandths"),
    "critDmgResist": ("critDmgResist", "ten-thousandths"),
    "blockDmgResist": ("blockDmgResist", "ten-thousandths"),
    "pvpDmgUp": ("pvpDmgUp", "ten-thousandths"),
    "pvpDmgDown": ("pvpDmgDown", "ten-thousandths"),
}
WEAPON_PASSIVE_MAX_LEVEL = 7
GEAR_PASSIVE_MAX_LEVEL = 3


def canonical_key(code):
    """Clé de comparaison d'un code de statistique.

    Le jeu écrit la même statistique de plusieurs façons : `B_MaxHp_Equip`
    apparaît 388 fois et `B_MaxHP_Equip` 24 fois, dans le même fichier ;
    `AllElement_Rate` et `All_Element_Rate` ne diffèrent que d'un underscore.
    Les traiter comme deux codes distincts scinderait un total en deux lignes
    qui ne s'additionnent pas, et seule l'orthographe dominante porte un
    libellé.
    """
    return re.sub(r"[^a-z0-9]+", "", code.casefold())


def canonical_stat(code, known):
    """Ramène un code à l'orthographe de référence, celle que `known` contient."""
    if code in known:
        return code
    key = canonical_key(code)
    for reference in sorted(known):
        if canonical_key(reference) == key:
            return reference
    return code


def elect_canonical(counts, labels):
    """Élit une orthographe de référence par groupe de variantes.

    `canonical_stat` ne sait ramener un code que vers une orthographe déjà
    connue. Quand les deux variantes sont nouvelles — `AllElement_Rate` et
    `All_Element_Rate` par exemple — aucune ne gagne et le catalogue en garde
    deux, ce qui scinde le total. On élit donc d'abord : la variante qui porte
    un libellé, sinon la plus fréquente, et l'ordre alphabétique pour trancher
    afin que la génération reste déterministe.
    """
    groups = {}
    for code, count in counts.items():
        groups.setdefault(canonical_key(code), []).append((code, count))
    elected = set()
    for variants in groups.values():
        variants.sort(
            key=lambda item: (
                0 if labels.get(item[0], {}).get("fr") else 1,
                -item[1],
                item[0],
            )
        )
        elected.add(variants[0][0])
    return elected


def gear_curve(block):
    """Une courbe de croissance d'équipement : base et incréments par segment."""
    if not block or not isinstance(block.get("progression"), list):
        return None
    return {
        "base": block.get("base") or 0,
        "progression": list(block["progression"]),
    }


def gear_random_options(growth, known):
    """Options d'enchantement d'une pièce. Elles vivent dans `growth`, pas à la
    racine : 67 des 229 armures en ont, et 83 gravées sur 83."""
    options = (growth or {}).get("randomOptions") or {}
    stats = options.get("stats") or []
    if not stats:
        return None
    return {
        "slots": options.get("slots") or 0,
        "stats": [
            {
                "stat": canonical_stat(item["key"], known),
                "min": item["min"],
                "max": item["max"],
                "chance": item.get("chance") or 0,
            }
            for item in sorted(stats, key=lambda item: (item["key"], item["min"]))
        ],
    }


def gear_extra_stats(growth, known):
    """Contributions supplementaires d'une piece, avec leurs courbes.

    Les equipements graves en portent 179 au total. Les omettre sous-estime
    leur apport."""
    extras = []
    for extra in (growth or {}).get("extraStats") or []:
        code = extra.get("key")
        if not code:
            continue
        values = gear_curve(extra.get("statValues"))
        add = gear_curve(extra.get("equiplvAdd"))
        if not values:
            continue
        extras.append({
            "stat": canonical_stat(code, known),
            "values": values,
            "add": add,
        })
    return sorted(extras, key=lambda item: item["stat"]) or None


def gear_reinforce_max(piece):
    """Plafond de renforcement. Les armures le declarent a la racine ; les
    gravures le cachent dans `growth.promotion[].maxReinforce`."""
    declared = piece.get("reinforceMax")
    if isinstance(declared, int):
        return declared
    steps = [
        step.get("maxReinforce")
        for step in ((piece.get("growth") or {}).get("promotion") or [])
        if isinstance(step.get("maxReinforce"), int)
    ]
    return max(steps) if steps else None


def compact_passive_levels(raw, expected_max, context):
    """Ne conserve que le niveau et le texte francais d'un passif fixe."""
    if raw is None:
        return None
    if isinstance(raw, dict):
        declared_max = raw.get("maxLevel")
        levels = raw.get("levels")
    elif isinstance(raw, list):
        # Les gravures enveloppent leur unique passif dans un tableau, tandis
        # que les armes exposent directement le tableau de niveaux.
        if raw and all(isinstance(item, dict) and "levels" in item for item in raw):
            if len(raw) != 1:
                raise ValueError(f"{context} : plusieurs passifs de gravure")
            declared_max = raw[0].get("maxLevel")
            levels = raw[0].get("levels")
        else:
            declared_max = None
            levels = raw
    else:
        raise ValueError(f"{context} : passif invalide")
    if not isinstance(levels, list):
        raise ValueError(f"{context} : niveaux de passif absents")
    compact = []
    seen = set()
    for item in levels:
        if not isinstance(item, dict):
            raise ValueError(f"{context} : niveau de passif invalide")
        level = item.get("level")
        text = item.get("descFr")
        if not isinstance(level, int) or level in seen:
            raise ValueError(f"{context} : niveau de passif duplique ou invalide")
        if not isinstance(text, str):
            raise ValueError(f"{context} : texte francais du passif absent")
        seen.add(level)
        compact.append({"level": level, "textFr": text})
    compact.sort(key=lambda item: item["level"])
    expected = list(range(1, expected_max + 1))
    if [item["level"] for item in compact] != expected:
        raise ValueError(f"{context} : table de passif incomplete")
    if declared_max is not None and declared_max != expected_max:
        raise ValueError(f"{context} : plafond de passif invalide")
    return compact


def gear_entry(piece, known):
    """Une pièce d'équipement réduite à ce dont le moteur a besoin."""
    growth = piece.get("growth") or {}
    entry = {
        "slug": piece.get("slug") or piece.get("costumeSlug"),
        "slot": piece.get("slot"),
        "grade": piece.get("grade") or piece.get("rarity"),
        "setId": piece.get("setId") or None,
        "mainStat": canonical_stat(piece["mainStat"], known),
        "subStat": (
            canonical_stat(piece["subStat"], known) if piece.get("subStat") else None
        ),
        "qualityMin": piece.get("qualityMin"),
        "qualityMax": piece.get("qualityMax"),
        "tierBoundaries": list(piece.get("tierBoundaries") or []),
        "reinforceMax": gear_reinforce_max(piece),
        "mainValues": gear_curve(growth.get("mainStatValues")),
        "mainAdd": gear_curve(growth.get("mainEquiplvAdd")),
        "subValues": gear_curve(growth.get("subStatValues")),
        "subAdd": gear_curve(growth.get("subEquiplvAdd")),
        "randomOptions": gear_random_options(growth, known),
        "hasEquipPassive": bool(piece.get("equipPassive")),
        "passiveLevels": compact_passive_levels(
            piece.get("equipPassive") or piece.get("engravingPassives"),
            GEAR_PASSIVE_MAX_LEVEL,
            piece.get("slug") or piece.get("costumeSlug") or piece.get("nameFr") or "piece",
        ),
        "extraStats": gear_extra_stats(growth, known),
    }
    return entry


def gear_set_entry(raw, known):
    """Un ensemble et ses deux paliers.

    ⚠️ Les seuils ne sont PAS 2 et 4 : `bonusTwoCount` vaut 3 dans onze
    ensembles sur vingt-et-un et 4 dans un ; `bonusFourCount` vaut 5 dans cinq
    et est absent dans cinq autres. Ils se lisent toujours dans les données.
    """
    def stats(items):
        if not items:
            return None
        return [
            {"stat": canonical_stat(item["stat"], known), "value": item["value"]}
            for item in items
        ]

    def texte(valeur):
        """Une absence de palier, quelle que soit la forme qu'elle prend.

        ⚠️ La source n'est pas coherente avec elle-meme : un palier 4 absent
        se dit `""` (six ensembles), un palier 7 absent se dit `null` (quinze).
        Les deux disent la meme chose ; le catalogue n'en garde qu'une.
        """
        return valeur or None

    return {
        "nameFr": raw.get("nameFr"),
        "twoCount": raw.get("bonusTwoCount"),
        "twoStats": stats(raw.get("bonusTwoStats")),
        # Le texte du palier, tel que publie, balisage [#RRGGBB]texte[-]
        # compris : renderBonus() le rend cote vue.
        #
        # ⚠️ Il n'est pas redondant avec `*Stats`. Ceux-ci ne retiennent que
        # ce qui se chiffre ; la prose porte en plus des clauses
        # conditionnelles — « l'activation d'un Deluge restaure la jauge de
        # magie de 200 » — qu'aucun code de stat ne represente. Le wiki les
        # affiche, le comparateur ne les compte pas.
        "twoTextFr": texte(raw.get("bonusTwoFr")),
        "fourCount": raw.get("bonusFourCount"),
        "fourStats": stats(raw.get("bonusFourStats")),
        "fourTextFr": texte(raw.get("bonusFourFr")),
        "sevenCount": raw.get("bonusSevenCount"),
        "sevenStats": stats(raw.get("bonusSevenStats")),
        "sevenTextFr": texte(raw.get("bonusSevenFr")),
    }


def gear_stat_labels(piece):
    """Libelles francais portes par une piece brute, avant compactage."""
    growth = piece.get("growth") or {}
    labels = {}
    for key, code_key in (("mainStatLabel", "mainStat"), ("subStatLabel", "subStat")):
        block = growth.get(key) or {}
        code = piece.get(code_key)
        if code and block.get("nameFr"):
            labels.setdefault(code, block["nameFr"])
    for item in ((growth.get("randomOptions") or {}).get("stats") or []):
        if item.get("key") and item.get("nameFr"):
            labels.setdefault(item["key"], item["nameFr"])
    for extra in growth.get("extraStats") or []:
        if extra.get("key") and extra.get("nameFr"):
            labels.setdefault(extra["key"], extra["nameFr"])
    return labels


def gear_stat_codes(entry):
    """Codes cites par une piece, options aleatoires comprises."""
    codes = {entry["mainStat"]}
    if entry.get("subStat"):
        codes.add(entry["subStat"])
    options = entry.get("randomOptions") or {}
    codes.update(item["stat"] for item in options.get("stats") or [])
    codes.update(item["stat"] for item in entry.get("extraStats") or [])
    return codes


def build_gear_catalogs(stats_root: Path, gear_roots, known, repo_root=None):
    """Rapproche les images locales des pieces officielles, par emplacement et
    par nom. Une piece du catalogue sans image locale est ignoree : la regle
    d'or veut que les assets presents pilotent l'interface. Une image sans
    piece correspondante est une erreur — elle serait insaisissable.

    Les libelles se collectent sur TOUTES les pieces officielles, pas
    seulement celles qui ont une image : une piece sans image peut porter le
    seul libelle francais d'un code que d'autres pieces citent aussi."""
    if not gear_roots:
        return {}, {}, {}
    pieces = read_json(stats_root / "armures.json")
    engraved_pieces = read_json(stats_root / "armures-gravees.json")
    by_slot = {}
    for piece in pieces:
        by_slot.setdefault(
            (piece["slot"], normalize_name(piece["nameFr"])), []
        ).append(piece)
    by_engraved = {}
    for piece in engraved_pieces:
        if not piece.get("nameFr"):
            continue
        by_engraved.setdefault(normalize_name(piece["nameFr"]), []).append(piece)

    fallback = {}
    for piece in pieces + engraved_pieces:
        fallback.update(gear_stat_labels(piece))

    gear_by_file = {}
    engraved_by_file = {}
    for root in gear_roots:
        for image_path in sorted(Path(root).rglob("*.webp")):
            relative = image_path.relative_to(root)
            if len(relative.parts) < 2:
                raise ValueError(f"Image hors emplacement : {image_path}")
            folder = relative.parts[0]
            base = repo_root or Path(root).parent
            catalog_file = image_path.relative_to(base).as_posix()
            if folder == ENGRAVED_FOLDER:
                candidates = by_engraved.get(normalize_name(image_path.stem), [])
                target = engraved_by_file
            else:
                slot = SLOT_FOLDERS.get(folder)
                if not slot:
                    raise ValueError(f"Emplacement local inconnu : {folder}")
                candidates = by_slot.get(
                    (slot, normalize_name(image_path.stem)), []
                )
                target = gear_by_file
            if len(candidates) != 1:
                if not candidates:
                    raise ValueError(f"Aucune piece officielle pour {image_path.name}")
                raise ValueError(f"Piece ambigue pour {image_path.name}")
            if catalog_file in target:
                raise ValueError(f"Cle d'image locale dupliquee : {catalog_file}")
            entry = gear_entry(candidates[0], known)
            if folder == ENGRAVED_FOLDER:
                entry["character"] = candidates[0].get("personnage")
                entry["slot"] = ENGRAVED_FOLDER
            target[catalog_file] = entry
    return gear_by_file, engraved_by_file, fallback


def normalize_name(value):
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def render_js(catalog):
    body = json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return "window.SEVEN_DS_BUILD_STATS = " + body + ";\n"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate_metadata(metadata):
    for stat, details in metadata.items():
        if "family" not in details:
            raise ValueError(f"famille manquante pour {stat}")
        if "unit" not in details:
            raise ValueError(f"unité manquante pour {stat}")
        if set(details) != {"family", "unit"}:
            raise ValueError(f"Métadonnées invalides pour {stat}")
        if details["family"] not in ALLOWED_FAMILIES:
            raise ValueError(f"famille invalide pour {stat}")
        if details["unit"] not in ALLOWED_UNITS:
            raise ValueError(f"unité invalide pour {stat}")


def compact_values(values):
    return {
        "base": values["base"],
        "max": values["max"],
        "progression": list(values["progression"]),
    }


def compact_options(options):
    return [
        {key: option[key] for key in ("stat", "min", "max", "chance") if key in option}
        for option in sorted(options, key=lambda option: (option["stat"], option["min"], option["max"]))
    ]


def compact_enchantments(enchantments):
    if enchantments["type"] == "basic":
        return {
            "type": "basic",
            "slots": list(enchantments.get("slots") or []),
            "options": compact_options(enchantments.get("options") or []),
        }

    if enchantments["type"] != "masterstone":
        raise ValueError("Type d'enchantement inconnu")

    tiers = []
    for tier in sorted(enchantments.get("tiers") or [], key=lambda tier: tier["tier"]):
        compact_tier = {"tier": tier["tier"]}
        if "options" in tier:
            compact_tier["options"] = compact_options(tier["options"])
        if "elements" in tier:
            compact_tier["elements"] = [
            {
                "element": group["element"],
                "options": compact_options(group.get("options") or []),
            }
                for group in sorted(
                    tier["elements"],
                    key=lambda group: (
                        {"generic": 0, "default": 1}.get(group["element"], 2),
                        group["element"],
                    ),
                )
            ]
        tiers.append(compact_tier)
    return {"type": "masterstone", "tiers": tiers}


def validate_grade(grade, weapon_slug):
    values = grade["promotionValues"]
    if values is not None and values["max"] != values["base"] + sum(values["progression"]):
        raise ValueError(f"promotionValues invalide pour {weapon_slug}/{grade['gameId']}")
    maxima = [step["reinforceMax"] for step in grade.get("promotionSteps") or []]
    if maxima != PROMOTION_MAXES[:len(maxima)]:
        raise ValueError(f"promotionSteps invalides pour {weapon_slug}/{grade['gameId']}")
    if "overlimit" in grade:
        overlimit = grade["overlimit"]
        levels = overlimit.get("levels") if isinstance(overlimit, dict) else None
        rates = (
            [level.get("statRate") for level in levels]
            if isinstance(levels, list) and all(isinstance(level, dict) for level in levels)
            else None
        )
        if rates != OVERLIMIT_RATES:
            raise ValueError(f"overlimit invalide pour {weapon_slug}/{grade['gameId']}")


def grade_stat_labels(grade):
    labels = {}
    for sub_stat in grade.get("subStats") or []:
        label = sub_stat.get("statLabel", {}).get("nameFr")
        if label:
            labels.setdefault(sub_stat["stat"], label)

    enchantments = grade.get("enchantments") or {}
    for option in enchantments.get("options") or []:
        if option.get("nameFr"):
            labels.setdefault(option["stat"], option["nameFr"])
    for tier in enchantments.get("tiers") or []:
        for option in tier.get("options") or []:
            if option.get("nameFr"):
                labels.setdefault(option["stat"], option["nameFr"])
        for group in tier.get("elements") or []:
            for option in group.get("options") or []:
                if option.get("nameFr"):
                    labels.setdefault(option["stat"], option["nameFr"])
    return labels


def compact_grade(grade, weapon_slug):
    validate_grade(grade, weapon_slug)
    compact = {
        "gameId": grade["gameId"],
        "rarity": grade["rarity"],
        "mainStatValues": (
            compact_values(grade["mainStatValues"])
            if grade["mainStatValues"] is not None
            else None
        ),
        "subStats": [
            {"stat": item["stat"], "values": compact_values(item["values"])}
            for item in sorted(grade.get("subStats") or [], key=lambda item: item["stat"])
        ],
        "promotionSteps": [
            {"reinforceMax": step["reinforceMax"]}
            for step in grade.get("promotionSteps") or []
        ],
        "promotionValues": (
            compact_values(grade["promotionValues"])
            if grade["promotionValues"] is not None
            else None
        ),
        "enchantments": compact_enchantments(grade["enchantments"]),
    }
    if "overlimit" in grade:
        compact["overlimit"] = {
            "levels": [
                {
                    key: level[key]
                    for key in ("level", "statRate", "passiveLevel")
                    if key in level
                }
                for level in grade["overlimit"]["levels"]
            ]
        }
    return compact


def compact_character(character, known):
    """Reduit un personnage aux statistiques necessaires au moteur local."""
    slug = character.get("slug")
    if not slug:
        raise ValueError("personnage sans slug")
    base_stats = []
    for field, (stat, expected_unit) in CHARACTER_BASE_FIELDS.items():
        value = character.get(field)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{slug} : statistique de base absente ({field})")
        details = known.get(stat)
        if not details or details.get("unit") != expected_unit:
            raise ValueError(f"{slug} : unite explicite incoherente pour {stat}")
        base_stats.append({"stat": stat, "value": value})

    common = []
    for item in character.get("commonMasteryStats") or []:
        stat = item.get("stat")
        value = item.get("value")
        if not stat or not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{slug} : maitrise commune invalide")
        common.append({
            "stat": canonical_stat(stat, known),
            "value": value,
        })

    mastery_groups = {}
    for mastery in character.get("weaponMasteries") or []:
        weapon_type = mastery.get("weaponType")
        level = mastery.get("level")
        if not weapon_type or not isinstance(level, int):
            raise ValueError(f"{slug} : branche de maitrise invalide")
        group = mastery_groups.setdefault(
            weapon_type, {"levelsSeen": set(), "abilities": []}
        )
        if level in group["levelsSeen"]:
            raise ValueError(f"{slug}/{weapon_type} : niveau de maitrise duplique")
        group["levelsSeen"].add(level)
        for index, sub_level in enumerate(mastery.get("subLevels") or []):
            for ability in sub_level.get("abilities") or []:
                group["abilities"].append({
                    "stat": canonical_stat(ability["stat"], known),
                    "value": ability["value"],
                    "source": {
                        "level": level,
                        "kind": "subLevel",
                        "index": index,
                    },
                })
        for index, node in enumerate(mastery.get("nodes") or []):
            node_type = node.get("nodeType")
            if node_type not in {"Normal", "Special"}:
                raise ValueError(
                    f"{slug}/{weapon_type} : type de noeud de maitrise invalide"
                )
            for ability in node.get("abilities") or []:
                group["abilities"].append({
                    "stat": canonical_stat(ability["stat"], known),
                    "value": ability["value"],
                    "source": {
                        "level": level,
                        "kind": "node",
                        "index": index,
                        "nodeType": node_type,
                    },
                })
    masteries_by_weapon = {}
    for weapon_type, group in sorted(mastery_groups.items()):
        masteries_by_weapon[weapon_type] = {
            "levels": len(group["levelsSeen"]),
            "abilities": group["abilities"],
        }

    potentials_by_weapon = {}
    for potential in character.get("potentials") or []:
        weapon_type = potential.get("weaponType")
        tier = potential.get("tier")
        if not weapon_type or not isinstance(tier, int) or not 1 <= tier <= 10:
            raise ValueError(f"{slug} : palier de potentiel invalide")
        tiers = potentials_by_weapon.setdefault(weapon_type, {})
        key = str(tier)
        if key in tiers:
            raise ValueError(f"{slug}/{weapon_type} : palier de potentiel duplique")
        tiers[key] = [
            {
                "stat": canonical_stat(item["stat"], known),
                "value": item["value"],
            }
            for item in potential.get("stats") or []
        ]

    return {
        "baseStats": base_stats,
        "commonMasteryStats": common,
        "masteriesByWeapon": masteries_by_weapon,
        "potentialsByWeapon": {
            weapon_type: dict(
                sorted(tiers.items(), key=lambda item: int(item[0]))
            )
            for weapon_type, tiers in sorted(potentials_by_weapon.items())
        },
    }


def character_stat_codes(character):
    codes = {item["stat"] for item in character["baseStats"]}
    codes.update(item["stat"] for item in character["commonMasteryStats"])
    for mastery in character["masteriesByWeapon"].values():
        codes.update(item["stat"] for item in mastery["abilities"])
    for tiers in character["potentialsByWeapon"].values():
        for stats in tiers.values():
            codes.update(item["stat"] for item in stats)
    return codes


def collect_stat_codes(weapon):
    codes = {weapon["mainStatCode"]}
    for grade in weapon["gradesByGameId"].values():
        codes.update(item["stat"] for item in grade["subStats"])
        enchantments = grade["enchantments"]
        for option in enchantments.get("options") or []:
            codes.add(option["stat"])
        for tier in enchantments.get("tiers") or []:
            for option in tier.get("options") or []:
                codes.add(option["stat"])
            for group in tier.get("elements") or []:
                for option in group["options"]:
                    codes.add(option["stat"])
    return codes


def build_catalog(stats_root: Path, weapons_root: Path, metadata: dict,
                  gear_roots=()) -> dict:
    validate_metadata(metadata)
    official_weapons = read_json(stats_root / "armes.json")
    official_characters = read_json(stats_root / "personnages.json")
    labels = read_json(stats_root / "libelles-stats.json")
    supplement_path = stats_root / "stat-labels-supplement.json"
    supplement = read_json(supplement_path) if supplement_path.exists() else {}
    official_by_key = {}
    for weapon in official_weapons:
        key = (weapon["weaponType"], normalize_name(weapon["nameFr"]))
        official_by_key.setdefault(key, []).append(weapon)

    weapons_by_file = {}
    fallback_labels = {}
    for image_path in sorted(weapons_root.rglob("*.webp")):
        relative_to_weapons = image_path.relative_to(weapons_root)
        if len(relative_to_weapons.parts) < 2:
            raise ValueError(f"Image d'arme hors type : {image_path}")
        folder = relative_to_weapons.parts[0]
        weapon_type = FOLDER_TO_ENUM.get(folder)
        if not weapon_type:
            raise ValueError(f"Type d'arme local inconnu : {folder}")
        candidates = official_by_key.get(
            (weapon_type, normalize_name(image_path.stem)), []
        )
        if len(candidates) != 1:
            if not candidates:
                raise ValueError(f"Aucune arme officielle pour {image_path.name}")
            raise ValueError(f"Arme ambiguë pour {image_path.name}")
        source = candidates[0]
        if source["mainStat"] not in MAIN_STAT_CODES:
            raise ValueError(f"Statistique principale inconnue pour {source['slug']}")
        catalog_file = image_path.relative_to(weapons_root.parent).as_posix()
        if catalog_file in weapons_by_file:
            raise ValueError(f"Clé d'image locale dupliquée : {catalog_file}")
        compact_weapon = {
            "slug": source["slug"],
            "weaponType": source["weaponType"],
            "mainStat": source["mainStat"],
            "mainStatCode": MAIN_STAT_CODES[source["mainStat"]],
            "passiveLevels": compact_passive_levels(
                source.get("passiveLevels"),
                WEAPON_PASSIVE_MAX_LEVEL,
                source["slug"],
            ),
            "gradesByGameId": {},
        }
        for grade in sorted(source.get("grades") or [], key=lambda grade: grade["gameId"]):
            compact_weapon["gradesByGameId"][grade["gameId"]] = compact_grade(
                grade, source["slug"]
            )
            fallback_labels.update(grade_stat_labels(grade))
        weapons_by_file[catalog_file] = compact_weapon

    known = set(metadata)
    characters_by_slug = {}
    for character in official_characters:
        slug = character.get("slug")
        if not slug:
            raise ValueError("personnage sans slug")
        if slug in characters_by_slug:
            raise ValueError(f"personnage duplique : {slug}")
        characters_by_slug[slug] = compact_character(character, metadata)

    gear_by_file, engraved_by_file, gear_labels = build_gear_catalogs(
        stats_root, gear_roots, known, weapons_root.parent
    )
    fallback_labels.update(gear_labels)
    all_gear = list(gear_by_file.values()) + list(engraved_by_file.values())
    gear_sets = {}
    referenced = {
        entry["setId"] for entry in all_gear if entry.get("setId")
    }
    if referenced:
        for raw in read_json(stats_root / "sets.json"):
            if raw.get("gameId") in referenced:
                gear_sets[raw["gameId"]] = gear_set_entry(raw, known)
        missing = sorted(referenced - set(gear_sets))
        if missing:
            raise ValueError(f"Ensembles introuvables : {chr(44).join(missing)}")

    codes = sorted(
        {
            code
            for weapon in weapons_by_file.values()
            for code in collect_stat_codes(weapon)
        }
        | {code for entry in all_gear for code in gear_stat_codes(entry)}
        | {
            code
            for character in characters_by_slug.values()
            for code in character_stat_codes(character)
        }
        | {
            item["stat"]
            for entry in gear_sets.values()
            for group in (
                entry["twoStats"] or [],
                entry["fourStats"] or [],
                entry["sevenStats"] or [],
            )
            for item in group
        }
    )
    stat_labels = {}
    for code in codes:
        details = metadata.get(code)
        if not details:
            raise ValueError(f"famille ou unité inconnue pour {code}")
        if code in labels and labels[code].get("fr"):
            french_label = labels[code]["fr"]
        elif code in fallback_labels:
            french_label = fallback_labels[code]
        elif code in supplement:
            french_label = supplement[code]
        elif code in labels and labels[code].get("court"):
            # Certains codes n'ont qu'un libelle court d'interface.
            french_label = labels[code]["court"]
        else:
            raise ValueError(f"Libellé français manquant pour {code}")
        stat_labels[code] = {
            "fr": french_label,
            "family": details["family"],
            "unit": details["unit"],
        }

    return {
        "version": 1,
        "weaponsByFile": dict(sorted(weapons_by_file.items())),
        "gearByFile": dict(sorted(gear_by_file.items())),
        "engravedByFile": dict(sorted(engraved_by_file.items())),
        "gearSets": dict(sorted(gear_sets.items())),
        "charactersBySlug": dict(sorted(characters_by_slug.items())),
        "statLabels": dict(sorted(stat_labels.items())),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    # scripts/ -> racine du depot : les references locales y vivent.
    root = Path(__file__).resolve().parent.parent
    catalog = build_catalog(
        root / "7ds-stats",
        root / "7ds-armes",
        read_json(root / "7ds-stats" / "stat-metadata.json"),
        (root / "7ds-armures-ssr", root / "7ds-bijoux"),
    )
    rendered = render_js(catalog)
    target = root / "data" / "stats-build.js"
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != rendered:
            raise SystemExit("stats-build.js doit être régénéré")
        print("stats-build.js à jour")
        return
    target.write_text(rendered, encoding="utf-8", newline="\n")
    print("stats-build.js généré")


if __name__ == "__main__":
    main()
