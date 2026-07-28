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


def gear_entry(piece, known):
    """Une pièce d'équipement réduite à ce dont le moteur a besoin."""
    growth = piece.get("growth") or {}
    entry = {
        "slug": piece.get("slug"),
        "slot": piece.get("slot"),
        "grade": piece.get("grade"),
        "setId": piece.get("setId") or None,
        "mainStat": canonical_stat(piece["mainStat"], known),
        "subStat": (
            canonical_stat(piece["subStat"], known) if piece.get("subStat") else None
        ),
        "qualityMin": piece.get("qualityMin"),
        "qualityMax": piece.get("qualityMax"),
        "tierBoundaries": list(piece.get("tierBoundaries") or []),
        "reinforceMax": piece.get("reinforceMax"),
        "mainValues": gear_curve(growth.get("mainStatValues")),
        "mainAdd": gear_curve(growth.get("mainEquiplvAdd")),
        "subValues": gear_curve(growth.get("subStatValues")),
        "subAdd": gear_curve(growth.get("subEquiplvAdd")),
        "randomOptions": gear_random_options(growth, known),
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

    return {
        "nameFr": raw.get("nameFr"),
        "twoCount": raw.get("bonusTwoCount"),
        "twoStats": stats(raw.get("bonusTwoStats")),
        "fourCount": raw.get("bonusFourCount"),
        "fourStats": stats(raw.get("bonusFourStats")),
    }


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


def build_catalog(stats_root: Path, weapons_root: Path, metadata: dict) -> dict:
    validate_metadata(metadata)
    official_weapons = read_json(stats_root / "armes.json")
    labels = read_json(stats_root / "libelles-stats.json")
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
            "gradesByGameId": {},
        }
        for grade in sorted(source.get("grades") or [], key=lambda grade: grade["gameId"]):
            compact_weapon["gradesByGameId"][grade["gameId"]] = compact_grade(
                grade, source["slug"]
            )
            fallback_labels.update(grade_stat_labels(grade))
        weapons_by_file[catalog_file] = compact_weapon

    codes = sorted(
        code
        for weapon in weapons_by_file.values()
        for code in collect_stat_codes(weapon)
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
        "statLabels": dict(sorted(stat_labels.items())),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    catalog = build_catalog(
        root / "7ds-stats",
        root / "7ds-armes",
        read_json(root / "7ds-stats" / "stat-metadata.json"),
    )
    rendered = render_js(catalog)
    target = root / "stats-build.js"
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != rendered:
            raise SystemExit("stats-build.js doit être régénéré")
        print("stats-build.js à jour")
        return
    target.write_text(rendered, encoding="utf-8", newline="\n")
    print("stats-build.js généré")


if __name__ == "__main__":
    main()
