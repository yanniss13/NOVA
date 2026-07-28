import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "generate-stats-build.py"
SPEC = importlib.util.spec_from_file_location("generate_stats_build", SCRIPT_PATH)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


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
            "I_AtkAdd_Rate": {
                "family": "additional",
                "unit": "ten-thousandths",
            },
        }
        self.labels = {
            "B_Atk_Equip": {"fr": "Attaque de l'équipement"},
            "I_AtkAdd_Rate": {
                "fr": "Augmentation de l'attaque",
                "taux": True,
            },
        }
        self.official_weapons = [
            {
                "slug": "test-axe",
                "nameFr": "Hache test",
                "weaponType": "Axe",
                "mainStat": "attack",
                "description": "Ne doit jamais sortir",
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
        result = subprocess.run(
            [sys.executable, str(SCRIPT_PATH), "--check"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("stats-build.js à jour", result.stdout)


if __name__ == "__main__":
    unittest.main()
