import collections
import copy
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "generate-stats-build.py"
SPEC = importlib.util.spec_from_file_location("generate_stats_build", SCRIPT_PATH)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class CanonicalStatTests(unittest.TestCase):
    """Le jeu écrit la même statistique de plusieurs façons : B_MaxHp_Equip
    apparaît 388 fois et B_MaxHP_Equip 24 fois, dans le même fichier. Les
    traiter comme deux codes distincts scinderait un total en deux lignes qui ne
    s'additionnent pas. Seule l'orthographe dominante porte un libellé."""

    def test_case_variants_collapse_to_one_key(self):
        self.assertEqual(
            module.canonical_key("B_MaxHP_Equip"),
            module.canonical_key("B_MaxHp_Equip"),
        )
        self.assertEqual(
            module.canonical_key("UltimateSkill_DamAdd_Rate"),
            module.canonical_key("Ultimateskill_Damadd_Rate"),
        )

    def test_underscore_variants_collapse_too(self):
        self.assertEqual(
            module.canonical_key("All_Element_Rate"),
            module.canonical_key("AllElement_Rate"),
        )

    def test_distinct_stats_keep_distinct_keys(self):
        self.assertNotEqual(
            module.canonical_key("Dark_Add"), module.canonical_key("Dark_Res")
        )
        self.assertNotEqual(
            module.canonical_key("B_Atk_Equip"), module.canonical_key("B_Def_Equip")
        )

    def test_the_reference_spelling_wins(self):
        """La forme retenue est celle que connaît la table de métadonnées."""
        known = {"B_MaxHp_Equip", "AllElement_Rate"}
        self.assertEqual(module.canonical_stat("B_MaxHP_Equip", known), "B_MaxHp_Equip")
        self.assertEqual(module.canonical_stat("All_Element_Rate", known), "AllElement_Rate")
        # Un code déjà canonique reste inchangé.
        self.assertEqual(module.canonical_stat("B_MaxHp_Equip", known), "B_MaxHp_Equip")

    def test_an_unknown_stat_is_left_alone(self):
        self.assertEqual(module.canonical_stat("Inconnu_Rate", set()), "Inconnu_Rate")

    def test_two_unknown_variants_elect_a_single_reference(self):
        """Sans élection, deux variantes toutes deux inconnues survivraient
        côte à côte et scinderaient le total en deux lignes."""
        elected = module.elect_canonical(
            {"AllElement_Rate": 8, "All_Element_Rate": 1}, {}
        )
        self.assertEqual(elected, {"AllElement_Rate"}, "la plus fréquente gagne")

    def test_a_labelled_variant_wins_over_a_more_frequent_one(self):
        elected = module.elect_canonical(
            {"Ultimateskill_Damadd_Rate": 2, "UltimateSkill_DamAdd_Rate": 99},
            {"Ultimateskill_Damadd_Rate": {"fr": "Dégâts ultime"}},
        )
        self.assertEqual(elected, {"Ultimateskill_Damadd_Rate"})

    def test_distinct_stats_are_never_merged_by_the_election(self):
        elected = module.elect_canonical({"Dark_Add": 5, "Dark_Res": 5}, {})
        self.assertEqual(elected, {"Dark_Add", "Dark_Res"})


class StatSynonymTests(unittest.TestCase):
    """Les sources amont parlent DEUX vocabulaires pour les mêmes statistiques.

    Dans `armes.json`, un même grade décrit ses `subStats` en vocabulaire
    « lisible » (`critDamage`) et ses `enchantments` en code de jeu
    (`C_Critical_Dam_Rate`). Les statistiques de base des personnages emploient
    le premier, les maîtrises et l'équipement le second. `canonical_key` ne
    peut rien pour ce cas : ce ne sont pas des variantes d'orthographe mais
    deux mots différents, donc il faut la table explicite.

    Sans elle, une arme dont la sous-stat ET l'enchantement donnent des dégâts
    critiques produit DEUX lignes qui ne s'additionnent pas."""

    def test_a_readable_code_resolves_to_the_game_code(self):
        known = {"C_Critical_Dam_Rate", "C_Critical_Rate", "D_Protect_Cur_Rate"}
        self.assertEqual(
            module.canonical_stat("critDamage", known), "C_Critical_Dam_Rate"
        )
        self.assertEqual(module.canonical_stat("critRate", known), "C_Critical_Rate")
        self.assertEqual(
            module.canonical_stat("defense", known), "D_Protect_Cur_Rate"
        )

    def test_the_synonym_wins_even_when_the_readable_code_is_known(self):
        """`known` contient les deux orthographes tant que la table de
        métadonnées décrit encore l'ancienne : le synonyme doit primer sur le
        retour anticipé, sinon rien ne fusionne."""
        known = {"critDamage", "C_Critical_Dam_Rate"}
        self.assertEqual(
            module.canonical_stat("critDamage", known), "C_Critical_Dam_Rate"
        )

    def test_a_stat_without_synonym_is_left_alone(self):
        self.assertEqual(module.canonical_stat("baseSpd", {"baseSpd"}), "baseSpd")

    def test_every_synonym_targets_a_code_of_the_same_unit_and_family(self):
        """Fusionner deux unités différentes produirait un total faux — et
        `reconstructStatTotals` le refuserait à l'exécution."""
        metadata = json.loads(
            (REPO_ROOT / "7ds-stats" / "stat-metadata.json").read_text(
                encoding="utf-8"
            )
        )
        for readable, game_code in module.STAT_SYNONYMS.items():
            with self.subTest(synonym=readable):
                self.assertIn(readable, metadata, f"{readable} sans métadonnée")
                self.assertIn(game_code, metadata, f"{game_code} sans métadonnée")
                self.assertEqual(
                    metadata[readable]["unit"],
                    metadata[game_code]["unit"],
                    f"{readable} et {game_code} n'ont pas la même unité",
                )
                self.assertEqual(
                    metadata[readable]["family"],
                    metadata[game_code]["family"],
                    f"{readable} et {game_code} n'ont pas la même famille",
                )

    def test_no_synonym_points_at_another_synonym(self):
        """Une chaîne `a -> b -> c` laisserait `b` dans le catalogue."""
        for readable, game_code in module.STAT_SYNONYMS.items():
            self.assertNotIn(
                game_code,
                module.STAT_SYNONYMS,
                f"{readable} vise {game_code}, lui-même un synonyme",
            )


class PotentialTextTests(unittest.TestCase):
    """Les paliers de potentiel chiffrent leur bonus de CATÉGORIE dans la seule
    prose : le champ `stats` de la source ne porte jamais que l'attaque, la
    défense et les PV. « Renforce la puissance de la compétence normale de
    100% » n'atteignait donc aucun calcul.

    La convention des valeurs conditionnelles est le MAXIMUM atteignable, la
    même que `data/buffs-supports.js` applique aux cumuls."""

    def deltas(self, texte):
        return dict(module.potential_tier_deltas(texte))

    def test_the_five_plain_category_forms_are_read(self):
        cas = {
            "l'attaque normale": "Normalattack_Damadd_Rate",
            "la compétence normale": "Normalskill_Damadd_Rate",
            "l'attaque spéciale": "Activethird_Damadd_Rate",
            "l'attaque ultime": "Ultimateskill_Damadd_Rate",
            "la compétence de relève": "Normalskillchangetag_Damadd_Rate",
        }
        for libelle, code in cas.items():
            with self.subTest(categorie=libelle):
                texte = f"Renforce la puissance de {libelle} de 70%."
                self.assertEqual(self.deltas(texte), {code: 7000})

    def test_the_colour_markup_is_stripped(self):
        texte = (
            "Renforce la puissance de la compétence normale "
            "de [#1A7331]100%[-]."
        )
        self.assertEqual(
            self.deltas(texte), {"Normalskill_Damadd_Rate": 10000}
        )

    def test_a_conditional_value_keeps_the_highest(self):
        for texte, attendu in [
            ("Renforce la puissance de la compétence normale de 50%,"
             " ou 60% lorsque l'effet est actif.", 6000),
            ("Renforce la puissance de l'attaque spéciale de 25% / 35%.", 3500),
            ("Renforce la puissance de l'attaque ultime de 20% / 30% / 40%"
             " en fonction du niveau de charge.", 4000),
        ]:
            with self.subTest(texte=texte[:40]):
                self.assertEqual(max(self.deltas(texte).values()), attendu)

    def test_a_second_effect_after_et_is_ignored(self):
        """« et augmente le percement de défense de 20% » décrit une AUTRE
        statistique : la lire comme un bonus de catégorie la doublerait."""
        texte = (
            "Renforce la puissance de l'attaque ultime de 120%, et augmente"
            " le percement de défense de l'attaque ultime de 20%."
        )
        self.assertEqual(self.deltas(texte), {"Ultimateskill_Damadd_Rate": 12000})

    def test_a_named_skill_or_a_sub_part_is_refused(self):
        """Ces bonus visent UNE compétence ou la dernière frappe, pas toute la
        catégorie : les y verser gonflerait toutes les autres compétences."""
        for texte in [
            "Renforce la puissance de Floraison nocturne de 50%.",
            "Renforce la puissance de la dernière frappe de l'attaque ultime de 100%.",
            "Renforce la puissance des dégâts supplémentaires de Duel de 50%.",
            "Renforce la puissance de l'attaque spéciale améliorée de 20%.",
            "Renforce la puissance du passif de 75%.",
            "Renforce la puissance de Compétence normale : Jugement divin de 70%.",
        ]:
            with self.subTest(texte=texte[:50]):
                self.assertEqual(self.deltas(texte), {})

    def test_the_attack_defence_hp_form_is_read(self):
        texte = (
            "Augmente l'attaque de 5%, la défense de 4% et les PV max de 2%."
        )
        self.assertEqual(self.deltas(texte), {
            "I_AtkAdd_Rate": 500,
            "I_DefAdd_Rate": 400,
            "I_MaxHpAdd_Rate": 200,
        })

    def test_an_unquantifiable_sentence_yields_nothing(self):
        for texte in [
            "Augmente légèrement la portée de l'attaque ultime.",
            "La dernière frappe de la compétence normale inflige des dégâts"
            " supplémentaires égaux à 160% de l'attaque.",
            "",
            None,
        ]:
            with self.subTest(texte=str(texte)[:40]):
                self.assertEqual(self.deltas(texte), {})

    def test_the_published_stats_prove_the_cumulative_reading(self):
        """LE test de fond : les paliers portent un CUMUL, pas un delta.

        Reconstruire ce cumul depuis les seules phrases doit reproduire au
        centième près les `stats` déjà publiées des 23 personnages qui en ont.
        S'il passe, appliquer la même lecture aux 2 qui n'en ont pas n'est plus
        une supposition."""
        personnages = json.loads(
            (REPO_ROOT / "7ds-stats" / "personnages.json").read_text(
                encoding="utf-8"
            )
        )
        base = ("I_AtkAdd_Rate", "I_DefAdd_Rate", "I_MaxHpAdd_Rate")
        compares = 0
        for character in personnages:
            par_arme = {}
            for pot in character.get("potentials") or []:
                par_arme.setdefault(pot["weaponType"], {})[pot["tier"]] = pot
            for tiers in par_arme.values():
                cumul = collections.Counter()
                for tier in sorted(tiers):
                    pot = tiers[tier]
                    cumul.update(module.potential_tier_deltas(pot.get("bonusFr")))
                    publie = {s["stat"]: s["value"] for s in pot.get("stats") or []}
                    if not publie:
                        continue
                    compares += 1
                    self.assertEqual(
                        {code: cumul[code] for code in base},
                        {code: publie.get(code, 0) for code in base},
                        f"{character['slug']} palier {tier}",
                    )
        self.assertEqual(compares, 690, "les 690 paliers publiés sont comparés")


class GearCatalogTests(unittest.TestCase):
    PIECE = {
        "slug": "haut-x",
        "slot": "Top",
        "grade": "grade5",
        "setId": "equip_t5_x",
        "mainStat": "B_Def_Equip",
        "subStat": "C_Critical_ResRate",
        "qualityMin": 120,
        "qualityMax": 160,
        "tierBoundaries": [119],
        "reinforceMax": 5,
        "nameFr": "Haut X",
        "growth": {
            "mainStatValues": {"base": 0, "progression": [3073]},
            "mainEquiplvAdd": {"base": 0, "progression": [35]},
            "subStatValues": {"base": 0, "progression": [328]},
            "subEquiplvAdd": {"base": 0, "progression": [4]},
            "randomOptions": {
                "slots": 1,
                "stats": [
                    {"key": "TickDam_Rate", "min": 304, "max": 759, "chance": 714}
                ],
            },
        },
    }

    def test_entry_keeps_only_what_the_engine_needs(self):
        entry = module.gear_entry(self.PIECE, set())
        self.assertEqual(entry["slot"], "Top")
        self.assertEqual(entry["mainValues"], {"base": 0, "progression": [3073]})
        self.assertEqual(entry["mainAdd"], {"base": 0, "progression": [35]})
        self.assertEqual(entry["tierBoundaries"], [119])
        self.assertEqual(
            entry["randomOptions"],
            {
                "slots": 1,
                "stats": [
                    {"stat": "TickDam_Rate", "min": 304, "max": 759, "chance": 714}
                ],
            },
        )
        self.assertNotIn("nameFr", entry)
        self.assertNotIn("growth", entry)

    def test_normal_gear_keeps_its_three_passive_levels(self):
        piece = copy.deepcopy(self.PIECE)
        piece["equipPassive"] = {
            "maxLevel": 3,
            "levels": [
                {"level": 1, "descFr": "Niveau un", "dropRate": 60},
                {"level": 2, "descFr": "Niveau deux", "dropRate": 30},
                {"level": 3, "descFr": "Niveau trois", "dropRate": 10},
            ],
        }
        entry = module.gear_entry(piece, set())
        self.assertEqual(
            entry["passiveLevels"],
            [
                {"level": 1, "textFr": "Niveau un"},
                {"level": 2, "textFr": "Niveau deux"},
                {"level": 3, "textFr": "Niveau trois"},
            ],
        )
        self.assertNotIn("equipPassive", entry)
        self.assertNotIn("dropRate", json.dumps(entry))

    def test_random_options_are_none_when_absent(self):
        piece = copy.deepcopy(self.PIECE)
        del piece["growth"]["randomOptions"]
        self.assertIsNone(module.gear_entry(piece, set())["randomOptions"])

    def test_stat_codes_are_canonicalised(self):
        piece = copy.deepcopy(self.PIECE)
        piece["mainStat"] = "B_MaxHP_Equip"
        piece["growth"]["randomOptions"]["stats"][0]["key"] = "I_MaxHPAdd_Rate"
        entry = module.gear_entry(piece, {"B_MaxHp_Equip", "I_MaxHpAdd_Rate"})
        self.assertEqual(entry["mainStat"], "B_MaxHp_Equip")
        self.assertEqual(entry["randomOptions"]["stats"][0]["stat"], "I_MaxHpAdd_Rate")

    def test_set_thresholds_come_from_the_data(self):
        entry = module.gear_set_entry(
            {
                "gameId": "equip_t4_scale_1",
                "nameFr": "Cœur ardent",
                "bonusTwoCount": 3,
                "bonusTwoStats": [{"stat": "A_Accuracy", "value": 30}],
                "bonusFourCount": None,
                "bonusFourStats": None,
            },
            set(),
        )
        self.assertEqual(entry["twoCount"], 3)
        self.assertIsNone(entry["fourCount"])
        self.assertIsNone(entry["fourStats"])

    def test_set_bonus_stats_are_canonicalised(self):
        entry = module.gear_set_entry(
            {
                "gameId": "s",
                "nameFr": "S",
                "bonusTwoCount": 2,
                "bonusTwoStats": [{"stat": "All_Element_Rate", "value": 500}],
                "bonusFourCount": 4,
                "bonusFourStats": [{"stat": "UltimateSkill_DamAdd_Rate", "value": 700}],
            },
            {"AllElement_Rate", "Ultimateskill_Damadd_Rate"},
        )
        self.assertEqual(entry["twoStats"][0]["stat"], "AllElement_Rate")
        self.assertEqual(entry["fourStats"][0]["stat"], "Ultimateskill_Damadd_Rate")


class GenerateStatsBuildTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        root = Path(self.tempdir.name)
        self.stats_root = root / "7ds-stats"
        self.weapons_root = root / "7ds-armes"
        self.stats_root.mkdir()
        (self.weapons_root / "Hache").mkdir(parents=True)
        (self.weapons_root / "Hache" / "Hache test.webp").write_bytes(b"webp")

        self.metadata = {
            "B_Atk_Equip": {"family": "main", "unit": "flat"},
            "B_Atk": {"family": "main", "unit": "flat"},
            "B_Def": {"family": "main", "unit": "flat"},
            "B_MaxHp": {"family": "main", "unit": "flat"},
            "baseSpd": {"family": "main", "unit": "flat"},
            "accuracy": {"family": "additional", "unit": "ten-thousandths"},
            "block": {"family": "additional", "unit": "ten-thousandths"},
            "critRate": {"family": "additional", "unit": "ten-thousandths"},
            "critDamage": {"family": "additional", "unit": "ten-thousandths"},
            "critResist": {"family": "additional", "unit": "ten-thousandths"},
            "critDmgResist": {"family": "additional", "unit": "ten-thousandths"},
            "blockDmgResist": {"family": "additional", "unit": "ten-thousandths"},
            "pvpDmgUp": {"family": "special", "unit": "ten-thousandths"},
            "pvpDmgDown": {"family": "special", "unit": "ten-thousandths"},
            "I_AtkAdd_Rate": {
                "family": "additional",
                "unit": "ten-thousandths",
            },
        }
        self.labels = {
            "B_Atk_Equip": {"fr": "Attaque de l'équipement"},
            "B_Atk": {"court": "ATK"},
            "B_Def": {"court": "DEF"},
            "B_MaxHp": {"court": "PV max"},
            "I_AtkAdd_Rate": {
                "fr": "Augmentation de l'attaque",
                "taux": True,
            },
        }
        self.supplement = {
            "baseSpd": "Vitesse",
            "accuracy": "Précision de base",
            "block": "Blocage de base",
            "critRate": "Taux critique de base",
            "critDamage": "Dégâts critiques de base",
            "critResist": "Résistance critique de base",
            "critDmgResist": "Résistance aux dégâts critiques de base",
            "blockDmgResist": "Réduction des dégâts bloqués",
            "pvpDmgUp": "Dégâts JcJ infligés",
            "pvpDmgDown": "Dégâts JcJ subis",
        }
        self.characters = [
            {
                "slug": "hero",
                "baseHp": 1200,
                "baseAtk": 200,
                "baseDef": 160,
                "baseSpd": 500,
                "accuracy": 50,
                "block": 30,
                "critRate": 500,
                "critDamage": 1500,
                "critResist": 0,
                "critDmgResist": 0,
                "blockDmgResist": 9500,
                "pvpDmgUp": 150,
                "pvpDmgDown": 125,
                "commonMasteryStats": [{"stat": "B_Atk", "value": 10}],
                "weaponMasteries": [
                    {
                        "weaponType": "Axe",
                        "level": 1,
                        "subLevels": [
                            {"abilities": [{"stat": "B_Def", "value": 20}]}
                        ],
                        "nodes": [
                            {
                                "nodeType": "Special",
                                "abilities": [
                                    {"stat": "I_AtkAdd_Rate", "value": 200}
                                ]
                            }
                        ],
                    }
                ],
                "potentials": [
                    {
                        "weaponType": "Axe",
                        "tier": 1,
                        "stats": [{"stat": "I_AtkAdd_Rate", "value": 300}],
                    }
                ],
            }
        ]
        self.official_weapons = [
            {
                "slug": "test-axe",
                "nameFr": "Hache test",
                "weaponType": "Axe",
                "mainStat": "attack",
                "description": "Ne doit jamais sortir",
                "passiveLevels": [
                    {"level": level, "descFr": f"Passif arme {level}"}
                    for level in range(1, 8)
                ],
                "grades": [
                    {
                        "gameId": "grade-axe",
                        "rarity": "grade5",
                        "mainStatValues": {
                            "base": 100,
                            "max": 300,
                            "progression": [10, 10],
                        },
                        "subStats": [
                            {
                                "stat": "I_AtkAdd_Rate",
                                "values": {
                                    "base": 10,
                                    "max": 30,
                                    "progression": [1, 1],
                                },
                                "description": "Ne doit jamais sortir",
                            }
                        ],
                        "promotionSteps": [
                            {"reinforceMax": 20, "description": "ignore"},
                            {"reinforceMax": 30, "description": "ignore"},
                        ],
                        "promotionValues": {
                            "base": 5,
                            "max": 15,
                            "progression": [4, 6],
                        },
                        "overlimit": {
                            "levels": [
                                {"level": 0, "statRate": 0, "passiveLevel": 1},
                                {"level": 1, "statRate": 500, "passiveLevel": 2},
                                {"level": 2, "statRate": 1000, "passiveLevel": 3},
                                {"level": 3, "statRate": 1750, "passiveLevel": 4},
                                {"level": 4, "statRate": 2500, "passiveLevel": 5},
                                {"level": 5, "statRate": 3750, "passiveLevel": 6},
                                {"level": 6, "statRate": 5000, "passiveLevel": 7},
                            ],
                            "passive": {"description": "Ne doit jamais sortir"},
                        },
                        "enchantments": {
                            "type": "basic",
                            "slots": [10000],
                            "options": [
                                {
                                    "stat": "I_AtkAdd_Rate",
                                    "min": 100,
                                    "max": 200,
                                    "description": "Ne doit jamais sortir",
                                }
                            ],
                        },
                    },
                    {
                        "gameId": "grade-masterstone",
                        "rarity": "grade5",
                        "mainStatValues": {
                            "base": 100,
                            "max": 300,
                            "progression": [10, 10],
                        },
                        "subStats": [],
                        "promotionSteps": [{"reinforceMax": 20}],
                        "promotionValues": {
                            "base": 1,
                            "max": 2,
                            "progression": [1],
                        },
                        "enchantments": {
                            "type": "masterstone",
                            "tiers": [
                                {
                                    "tier": 1,
                                    "options": [
                                        {
                                            "stat": "B_Atk_Equip",
                                            "min": 1,
                                            "max": 2,
                                        }
                                    ],
                                },
                                {
                                    "tier": 5,
                                    "elements": [
                                        {
                                            "element": "generic",
                                            "options": [
                                                {
                                                    "stat": "B_Atk_Equip",
                                                    "min": 3,
                                                    "max": 4,
                                                }
                                            ],
                                        },
                                        {
                                            "element": "default",
                                            "options": [
                                                {
                                                    "stat": "B_Atk_Equip",
                                                    "min": 5,
                                                    "max": 6,
                                                }
                                            ],
                                        },
                                        {
                                            "element": "fire",
                                            "options": [
                                                {
                                                    "stat": "I_AtkAdd_Rate",
                                                    "min": 7,
                                                    "max": 8,
                                                }
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                ],
            }
        ]
        self.write_official_weapons()
        self.write_labels()
        self.write_characters()
        self.write_supplement()

    def tearDown(self):
        self.tempdir.cleanup()

    def write_official_weapons(self):
        (self.stats_root / "armes.json").write_text(
            json.dumps(self.official_weapons, ensure_ascii=False),
            encoding="utf-8",
        )

    def write_labels(self):
        (self.stats_root / "libelles-stats.json").write_text(
            json.dumps(self.labels, ensure_ascii=False), encoding="utf-8"
        )

    def write_characters(self):
        (self.stats_root / "personnages.json").write_text(
            json.dumps(self.characters, ensure_ascii=False), encoding="utf-8"
        )

    def write_supplement(self):
        (self.stats_root / "stat-labels-supplement.json").write_text(
            json.dumps(self.supplement, ensure_ascii=False), encoding="utf-8"
        )

    def fixture_grade(self):
        return self.official_weapons[0]["grades"][0]

    def fixture_masterstone_grade(self):
        return self.official_weapons[0]["grades"][1]

    def add_second_weapon_with_same_normalized_name_and_type(self):
        duplicate = copy.deepcopy(self.official_weapons[0])
        duplicate["slug"] = "test-axe-duplicate"
        self.official_weapons.append(duplicate)
        self.write_official_weapons()

    def add_second_weapon_with_same_normalized_name_and_other_type(self):
        duplicate = copy.deepcopy(self.official_weapons[0])
        duplicate["slug"] = "test-sword"
        duplicate["weaponType"] = "Sword1h"
        self.official_weapons.append(duplicate)
        self.write_official_weapons()

    def test_catalog_is_keyed_by_exact_local_file(self):
        catalog = module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        weapon = catalog["weaponsByFile"]["7ds-armes/Hache/Hache test.webp"]
        self.assertEqual(weapon["slug"], "test-axe")
        self.assertEqual(weapon["mainStatCode"], "B_Atk_Equip")
        self.assertIn("grade-axe", weapon["gradesByGameId"])
        self.assertEqual(
            catalog["statLabels"]["B_Atk_Equip"],
            {"fr": "Attaque de l'équipement", "family": "main", "unit": "flat"},
        )

    def test_catalog_compacts_characters_and_weapon_passives(self):
        catalog = module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        hero = catalog["charactersBySlug"]["hero"]
        self.assertIn({"stat": "B_MaxHp", "value": 1200}, hero["baseStats"])
        self.assertIn({"stat": "critResist", "value": 0}, hero["baseStats"])
        self.assertEqual(
            hero["masteriesByWeapon"]["Axe"]["abilities"],
            [
                {
                    "stat": "B_Def",
                    "value": 20,
                    "source": {"level": 1, "kind": "subLevel", "index": 0},
                },
                {
                    "stat": "I_AtkAdd_Rate",
                    "value": 200,
                    "source": {
                        "level": 1,
                        "kind": "node",
                        "index": 0,
                        "nodeType": "Special",
                    },
                },
            ],
        )
        self.assertEqual(
            hero["potentialsByWeapon"]["Axe"]["1"],
            [{"stat": "I_AtkAdd_Rate", "value": 300}],
        )
        weapon = catalog["weaponsByFile"]["7ds-armes/Hache/Hache test.webp"]
        self.assertEqual(len(weapon["passiveLevels"]), 7)
        self.assertEqual(
            weapon["passiveLevels"][0],
            {"level": 1, "textFr": "Passif arme 1"},
        )

    def test_duplicate_character_slug_fails(self):
        self.characters.append(copy.deepcopy(self.characters[0]))
        self.write_characters()
        with self.assertRaisesRegex(ValueError, "personnage dupli"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_passive_level_table_must_be_complete(self):
        self.official_weapons[0]["passiveLevels"].pop()
        self.write_official_weapons()
        with self.assertRaisesRegex(ValueError, "passif"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_ambiguous_name_fails_instead_of_guessing(self):
        self.add_second_weapon_with_same_normalized_name_and_type()
        with self.assertRaisesRegex(ValueError, "ambigu"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_same_name_in_other_weapon_type_is_not_ambiguous(self):
        self.add_second_weapon_with_same_normalized_name_and_other_type()
        catalog = module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        self.assertEqual(
            catalog["weaponsByFile"]["7ds-armes/Hache/Hache test.webp"]["slug"],
            "test-axe",
        )

    def test_unknown_stat_family_fails(self):
        self.fixture_grade()["subStats"][0]["stat"] = "unknownStat"
        self.write_official_weapons()
        with self.assertRaisesRegex(ValueError, "famille"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_missing_explicit_unit_fails_even_when_label_has_rate_flag(self):
        self.metadata["I_AtkAdd_Rate"].pop("unit")
        with self.assertRaisesRegex(ValueError, "unité"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_unit_does_not_depend_on_incomplete_label_rate_flag(self):
        self.labels["B_Atk_Equip"].pop("taux", None)
        self.write_labels()
        catalog = module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        self.assertEqual(catalog["statLabels"]["B_Atk_Equip"]["unit"], "flat")

    def test_tier_five_keeps_element_groups(self):
        grade = self.fixture_masterstone_grade()
        emitted = module.compact_enchantments(grade["enchantments"])
        self.assertEqual(emitted["tiers"][-1]["tier"], 5)
        self.assertEqual(
            [group["element"] for group in emitted["tiers"][-1]["elements"]],
            ["generic", "default", "fire"],
        )

    def test_weapon_promotion_reaches_declared_max(self):
        values = self.fixture_grade()["promotionValues"]
        self.assertEqual(values["max"], values["base"] + sum(values["progression"]))

    def test_invalid_weapon_promotion_table_is_rejected(self):
        self.fixture_grade()["promotionValues"]["max"] += 1
        self.write_official_weapons()
        with self.assertRaisesRegex(ValueError, "promotionValues"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_overlimit_uses_the_canonical_rate_table(self):
        levels = self.fixture_grade()["overlimit"]["levels"]
        self.assertEqual(
            [level["statRate"] for level in levels],
            [0, 500, 1000, 1750, 2500, 3750, 5000],
        )

    def test_invalid_overlimit_rate_table_is_rejected(self):
        self.fixture_grade()["overlimit"]["levels"][1]["statRate"] = 501
        self.write_official_weapons()
        with self.assertRaisesRegex(ValueError, "overlimit"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_present_empty_overlimit_is_rejected_instead_of_being_omitted(self):
        self.fixture_grade()["overlimit"] = {}
        self.write_official_weapons()
        with self.assertRaisesRegex(ValueError, "overlimit"):
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)

    def test_catalog_rendering_is_deterministic_and_excludes_descriptions(self):
        first = module.render_js(
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        )
        second = module.render_js(
            module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        )
        self.assertEqual(first, second)
        self.assertNotIn("description", first)

    def test_every_fixture_image_emits_exactly_one_catalog_key(self):
        catalog = module.build_catalog(self.stats_root, self.weapons_root, self.metadata)
        images = sorted(
            path.relative_to(self.weapons_root.parent).as_posix()
            for path in self.weapons_root.rglob("*.webp")
        )
        self.assertEqual(sorted(catalog["weaponsByFile"]), images)

    def test_check_accepts_the_tracked_generated_catalog(self):
        # Sans PYTHONIOENCODING, le script suit la page de codes de la console
        # Windows et « stats-build.js à jour » revient en cp1252 : le décodage
        # UTF-8 échoue alors dans le thread de lecture, et `stdout` vaut None.
        # On impose l'encodage au processus fils au lieu de le supposer.
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        result = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "--check"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("stats-build.js à jour", result.stdout)


if __name__ == "__main__":
    unittest.main()
