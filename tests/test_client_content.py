import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "client_content.py"
SPEC = importlib.util.spec_from_file_location("client_content", MODULE_PATH)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

WEAPONS = ["SwordDual", "Cudgel3c", "Gauntlets"]
SLOTS = [
    {"weapon": "SwordDual", "role": "Attacker", "element": "Wind"},
    {"weapon": "Cudgel3c", "role": "Buster", "element": "Wind"},
    {"weapon": "Gauntlets", "role": "Buster", "element": "Earth"},
]
# L'ordre des clés d'un personnage historique de 7ds-stats/personnages.json,
# sans `costumes` ni `bannerUrl` que le snapshot ne fournit pas.
HISTORICAL_KEYS = [
    "id", "slug", "nameFr", "nameEn", "element", "rarity", "role",
    "portraitUrl", "weaponSlots", "weaponMasteries", "potentials",
    "commonMasteryTid", "baseHp", "baseAtk", "baseDef", "baseSpd", "accuracy",
    "block", "critRate", "critDamage", "critResist", "critDmgResist",
    "blockDmgResist", "pvpDmgUp", "pvpDmgDown", "commonMasteryStats",
]


def potential_tiers(weapon):
    return [
        {
            "tier": tier,
            "weaponType": weapon,
            "bonusFr": f"Palier {tier} de {weapon}",
            "bonusEn": f"Tier {tier} of {weapon}",
            "effectSourceIds": [f"potential:khala:{weapon}:{tier}"],
        }
        for tier in range(1, 11)
    ]


def mastery_branch(weapon):
    return {
        "weaponType": weapon,
        "levels": [{
            "level": 1,
            "subLevels": [
                {"exp": 18750, "abilities": [{"stat": "B_Atk", "value": 132}]},
            ],
            "nodes": [{
                "id": "210291000", "level": 1, "grade": 1, "group": "21029100",
                "abilities": ["B_Atk", "A_Accuracy"], "values": [165, 37],
                "descriptionFr": None, "descriptionEn": None,
                "provenance": "Table/HeroMastery/HeroWeaponMastery",
                "coverage": {"status": "missing-from-export"},
            }, {
                "id": "210291005", "level": 1, "grade": 2, "group": "21029100",
                "abilities": ["I_AtkAdd_Rate", "I_MaxHPAdd_Rate"], "values": [300, 300],
                "descriptionFr": None, "descriptionEn": None,
                "provenance": "Table/HeroMastery/HeroWeaponMastery",
                "coverage": {"status": "missing-from-export"},
            }],
        }],
    }


def client_hero(slug="khala", name="Khala"):
    """Un héros du snapshot, dans la forme exacte qu'écrit l'extracteur."""
    return {
        "id": "1029",
        "internalName": "Calla",
        "nameFr": name,
        "nameEn": name,
        "meta": {"role": "ATTACKER", "rarity": "Grade5", "weapons": copy.deepcopy(SLOTS)},
        "character": {
            "id": "1029", "slug": slug, "nameFr": name, "nameEn": name,
            "rarity": "Grade5", "role": "ATTACKER", "element": "WIND",
            "portraitUrl": f"/images/characters/{slug}.webp",
            "weaponSlots": copy.deepcopy(SLOTS),
            "commonMasteryTid": "11002",
            "commonMasteryStats": [{"stat": "B_Atk", "value": 624}],
            "baseHp": 2000, "baseAtk": 250, "baseDef": 200, "baseSpd": 500,
            "accuracy": 80, "block": 50, "critRate": 1000, "critDamage": 2500,
            "critResist": 300, "critDmgResist": 1000, "blockDmgResist": 9500,
            "pvpDmgUp": None, "pvpDmgDown": None,
            "coverage": {
                "pvpDmgUp": {"status": "missing-from-export", "provenance": "Table/Actor/HeroStatGroupTable"},
                "pvpDmgDown": {"status": "missing-from-export", "provenance": "Table/Actor/HeroStatGroupTable"},
            },
            "weaponMasteries": [mastery_branch(weapon) for weapon in WEAPONS],
        },
        "potentials": {weapon: potential_tiers(weapon) for weapon in WEAPONS},
        "linkedArmors": [
            {"gameId": "133235001", "nameFr": "Tenue de travail", "weaponType": "sworddual"},
            {"gameId": "133235002", "nameFr": "Préparation totale", "weaponType": "cudgel3c"},
        ],
        "assets": {
            "portrait": {"source": "portrait.png", "target": f"7ds-personnages/{slug}.webp"},
            "linkedArmors": [
                {"source": "a.png",
                 "target": "7ds-armures-ssr/Armure liee/Tenue de travail.webp"},
                {"source": "b.png",
                 "target": f"7ds-armures-ssr/Armure liee/{name} — Préparation totale.webp"},
            ],
        },
    }


def snapshot(heroes=None, version=1):
    return {"version": version, "heroes": heroes or {"khala": client_hero()}}


class ClientContentTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = snapshot()

    def test_merge_characters_preserve_existing_and_add_khala(self):
        existing = [{"slug": "ban", "nameFr": "Ban"}]

        result = module.merge_characters(existing, self.snapshot)

        self.assertEqual([row["slug"] for row in result], ["ban", "khala"])
        self.assertEqual(existing, [{"slug": "ban", "nameFr": "Ban"}])

    def test_duplicate_slug_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "slug dupliqué.*khala"):
            module.merge_characters([{"slug": "khala"}], self.snapshot)

    def test_replace_client_replaces_only_the_snapshot_slug(self):
        existing = [
            {"slug": "ban", "nameFr": "Ban"},
            {"slug": "khala", "nameFr": "Ancienne Khala"},
        ]

        result = module.merge_characters(existing, self.snapshot, replace_client=True)

        self.assertEqual(result[0], {"slug": "ban", "nameFr": "Ban"})
        self.assertEqual(result[1]["nameFr"], "Khala")
        self.assertEqual(len(result), 2)
        self.assertEqual(existing[1]["nameFr"], "Ancienne Khala")

    def test_merge_characters_flattens_snapshot_masteries_and_potentials(self):
        character = module.merge_characters([], self.snapshot)[0]

        self.assertEqual(
            [branch["weaponType"] for branch in character["weaponMasteries"]],
            ["Cudgel3c", "Gauntlets", "SwordDual"],
            "les branches suivent l'ordre alphabétique des 26 héros historiques",
        )
        self.assertEqual(
            character["weaponMasteries"][0],
            {
                "weaponType": "Cudgel3c",
                "level": 1,
                "subLevels": [
                    {"exp": 18750, "abilities": [{"stat": "B_Atk", "value": 132}]},
                ],
                "nodes": [
                    {
                        "nodeType": "Normal",
                        "grade": 1,
                        "abilities": [
                            {"stat": "B_Atk", "value": 165},
                            {"stat": "A_Accuracy", "value": 37},
                        ],
                    },
                    {
                        "nodeType": "Special",
                        "grade": 2,
                        "abilities": [
                            {"stat": "I_AtkAdd_Rate", "value": 300},
                            {"stat": "I_MaxHPAdd_Rate", "value": 300},
                        ],
                    },
                ],
            },
        )
        self.assertEqual(
            [(row["weaponType"], row["tier"]) for row in character["potentials"]][:2],
            [("Cudgel3c", 1), ("Cudgel3c", 2)],
        )
        self.assertEqual(len(character["potentials"]), 30)
        self.assertEqual(
            character["potentials"][0],
            {
                "weaponType": "Cudgel3c",
                "tier": 1,
                "bonusFr": "Palier 1 de Cudgel3c",
                "bonusEn": "Tier 1 of Cudgel3c",
                "stats": [],
            },
            "un palier historique porte `stats` et jamais d'identifiant de source",
        )

    def test_character_has_the_historical_key_order_and_vocabulary(self):
        character = module.merge_characters([], self.snapshot)[0]

        self.assertEqual(list(character), HISTORICAL_KEYS + ["coverage"])
        self.assertEqual(character["rarity"], "SSR")
        self.assertEqual(
            [list(slot) for slot in character["weaponSlots"]],
            [["role", "weapon", "element"]] * 3,
        )
        self.assertEqual(
            [slot["weapon"] for slot in character["weaponSlots"]], WEAPONS
        )
        self.assertEqual(character["commonMasteryStats"], [{"stat": "B_Atk", "value": 624}])
        self.assertIsNone(character["pvpDmgUp"])

    def test_rarity_grades_map_to_the_site_vocabulary(self):
        self.assertEqual(module.normalize_rarity("Grade5", "khala"), "SSR")
        self.assertEqual(module.normalize_rarity("Grade4", "khala"), "SR")
        with self.assertRaisesRegex(ValueError, "rareté inconnue.*khala.*Grade3"):
            module.normalize_rarity("Grade3", "khala")

    def test_unknown_role_is_rejected(self):
        client = snapshot()
        client["heroes"]["khala"]["character"]["role"] = "BUSTER"
        with self.assertRaisesRegex(ValueError, "rôle inconnu.*khala"):
            module.merge_characters([], client)

    def test_missing_stat_without_declared_coverage_is_rejected(self):
        client = snapshot()
        del client["heroes"]["khala"]["character"]["coverage"]["pvpDmgDown"]
        with self.assertRaisesRegex(ValueError, "khala.*pvpDmgDown"):
            module.merge_characters([], client)

    def test_stat_codes_follow_the_historical_spelling(self):
        existing = [{
            "slug": "ban",
            "weaponMasteries": [{
                "weaponType": "Axe", "level": 1, "subLevels": [],
                "nodes": [{"nodeType": "Special", "grade": 2, "abilities": [
                    {"stat": "I_MaxHpAdd_Rate", "value": 200},
                ]}],
            }],
        }]

        character = module.merge_characters(existing, self.snapshot)[1]

        special = character["weaponMasteries"][0]["nodes"][1]["abilities"]
        self.assertEqual(special[1], {"stat": "I_MaxHpAdd_Rate", "value": 300})
        self.assertEqual(special[0], {"stat": "I_AtkAdd_Rate", "value": 300})

    def test_merge_mapping_sorts_new_client_slugs_deterministically(self):
        clients = snapshot({
            "zulu": client_hero("zulu", "Zulu"),
            "alpha": client_hero("alpha", "Alpha"),
        })
        base = {"ban": {"role": "ATTACKER"}}

        result = module.merge_mapping(base, "meta", clients)

        self.assertEqual(list(result), ["ban", "alpha", "zulu"])
        self.assertEqual(base, {"ban": {"role": "ATTACKER"}})

    def test_merge_mapping_rejects_unknown_section(self):
        with self.assertRaisesRegex(ValueError, "section inconnue.*inconnue"):
            module.merge_mapping({}, "inconnue", self.snapshot)

    def test_merge_mapping_rejects_historical_collision(self):
        with self.assertRaisesRegex(ValueError, "slug dupliqué.*khala"):
            module.merge_mapping({"khala": {"role": "SUPPORT"}}, "meta", self.snapshot)

    def test_merge_mapping_replaces_only_the_client_entry(self):
        result = module.merge_mapping(
            {"ban": {"role": "SUPPORT"}, "khala": {"role": "DEFENDER"}},
            "meta",
            self.snapshot,
            replace_client=True,
        )

        self.assertEqual(result["ban"], {"role": "SUPPORT"})
        self.assertEqual(result["khala"]["role"], "ATTACKER")
        self.assertEqual(list(result), ["ban", "khala"])

    def test_meta_section_has_the_historical_shape(self):
        meta = module.merge_mapping({}, "meta", self.snapshot)["khala"]

        self.assertEqual(list(meta), ["element", "rarity", "role", "weapons"])
        self.assertEqual(
            (meta["element"], meta["rarity"], meta["role"]), ("WIND", "SSR", "ATTACKER")
        )
        self.assertEqual(meta["weapons"], [
            {"role": "Attacker", "weapon": "SwordDual", "element": "Wind"},
            {"role": "Buster", "weapon": "Cudgel3c", "element": "Wind"},
            {"role": "Buster", "weapon": "Gauntlets", "element": "Earth"},
        ])
        self.assertEqual([list(slot) for slot in meta["weapons"]], [["role", "weapon", "element"]] * 3)

    def test_linked_armors_section_lists_the_local_images(self):
        armures = module.merge_mapping({}, "linkedArmors", self.snapshot)["khala"]

        # Triées comme le générateur public les écrit, et préfixées du nom du
        # héros quand deux tenues portent le même nom.
        self.assertEqual(armures, [
            "7ds-armures-ssr/Armure liee/Khala — Préparation totale.webp",
            "7ds-armures-ssr/Armure liee/Tenue de travail.webp",
        ])

    def test_linked_armors_rows_carry_the_file_name(self):
        rows = module.linked_armor_rows(self.snapshot)

        # Le rapprochement du générateur se fait sur le nom de fichier : une
        # ligne cliente qui ne dirait que « Préparation totale » volerait
        # l'image d'un héros public du même nom.
        self.assertEqual(rows, [
            {"char": "khala", "name": "Khala — Préparation totale", "game_id": "133235002"},
            {"char": "khala", "name": "Tenue de travail", "game_id": "133235001"},
        ])

    def test_linked_armors_reject_an_image_that_names_no_tenue(self):
        client = snapshot()
        client["heroes"]["khala"]["assets"]["linkedArmors"][0]["target"] = (
            "7ds-armures-ssr/Armure liee/Autre chose.webp"
        )

        with self.assertRaisesRegex(ValueError, "Tenue de travail"):
            module.merge_mapping({}, "linkedArmors", client)

    def test_linked_armors_reject_an_image_outside_the_linked_armor_folder(self):
        client = snapshot()
        client["heroes"]["khala"]["assets"]["linkedArmors"][0]["target"] = (
            "7ds-armures-ssr/Haut/Tenue de travail.webp"
        )

        with self.assertRaisesRegex(ValueError, "Armure liee"):
            module.merge_mapping({}, "linkedArmors", client)

    def test_potentials_section_uses_public_folders_in_enum_order(self):
        potentials = module.merge_mapping({}, "potentials", self.snapshot)["khala"]

        self.assertEqual(list(potentials), ["Nunchaku", "Gantelets", "Epees doubles"])
        self.assertEqual(potentials["Nunchaku"][0], "Palier 1 de Cudgel3c")
        self.assertEqual(len(potentials["Epees doubles"]), 10)

    def test_potential_texts_use_the_historical_plain_spaces(self):
        # Les 780 paliers historiques n'ont aucune espace insécable ; les
        # phrases citées par potentiels-equipe.js en dépendent.
        client = snapshot()
        tier = client["heroes"]["khala"]["potentials"]["SwordDual"][4]
        tier["bonusFr"] = "Dure [#1A7331]3" + chr(0xA0) + "s[-] (Max" + chr(0xA0) + ": 5)"
        tier["bonusEn"] = "Lasts 3" + chr(0xA0) + "sec"

        catalog = module.merge_mapping({}, "potentials", client)["khala"]
        character = module.merge_characters([], client)[0]

        self.assertEqual(catalog["Epees doubles"][4], "Dure [#1A7331]3 s[-] (Max : 5)")
        row = character["potentials"][24]
        self.assertEqual((row["weaponType"], row["tier"]), ("SwordDual", 5))
        self.assertEqual(row["bonusFr"], "Dure [#1A7331]3 s[-] (Max : 5)")
        self.assertEqual(row["bonusEn"], "Lasts 3 sec")

    def test_potentials_section_rejects_incomplete_or_unresolved_tiers(self):
        incomplete = snapshot()
        incomplete["heroes"]["khala"]["potentials"]["SwordDual"].pop()
        with self.assertRaisesRegex(ValueError, "khala/SwordDual.*paliers 1 à 10"):
            module.merge_mapping({}, "potentials", incomplete)

        placeholder = snapshot()
        placeholder["heroes"]["khala"]["potentials"]["Gauntlets"][3]["bonusFr"] = "reste {0}"
        with self.assertRaisesRegex(ValueError, "khala/Gauntlets.*placeholder"):
            module.merge_mapping({}, "potentials", placeholder)

        foreign = snapshot()
        foreign["heroes"]["khala"]["potentials"]["Axe"] = potential_tiers("Axe")
        with self.assertRaisesRegex(ValueError, "khala/Axe.*arme hors maîtrises"):
            module.merge_mapping({}, "potentials", foreign)

    def test_load_snapshot_rejects_missing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "absent.json"
            with self.assertRaises(FileNotFoundError):
                module.load_snapshot(path)

    def test_load_snapshot_rejects_an_incompatible_version(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "contenu-jeu.json"
            path.write_text(json.dumps(snapshot(version=2)), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "version de contenu-jeu incompatible"):
                module.load_snapshot(path)

    def test_semantic_hash_ignores_client_slug_but_not_historical_content(self):
        before = {"ban": {"name": "Ban"}, "khala": {"name": "Ancienne Khala"}}
        replaced = {"ban": {"name": "Ban"}, "khala": {"name": "Khala"}}
        changed = {"ban": {"name": "Ban le renard"}, "khala": {"name": "Khala"}}

        initial = module.semantic_hash_without_slugs(before, {"khala"})
        self.assertEqual(initial, module.semantic_hash_without_slugs(replaced, {"khala"}))
        self.assertNotEqual(initial, module.semantic_hash_without_slugs(changed, {"khala"}))

    def test_replace_client_entries_proves_history_is_untouched(self):
        base = {"ban": {"role": "SUPPORT"}, "khala": {"role": "DEFENDER"}}

        result, digest = module.replace_client_entries(
            base,
            lambda payload, client, replace_client: module.merge_mapping(
                payload, "meta", client, replace_client=replace_client
            ),
            self.snapshot,
        )

        self.assertEqual(result["khala"]["role"], "ATTACKER")
        self.assertEqual(digest, module.semantic_hash_without_slugs(base, {"khala"}))

    def test_replace_client_entries_refuses_a_historical_change(self):
        def tampering(payload, client, replace_client):
            result = module.merge_mapping(payload, "meta", client, replace_client=replace_client)
            result["ban"] = {"role": "ATTACKER"}
            return result

        with self.assertRaisesRegex(ValueError, "héros historiques modifiés"):
            module.replace_client_entries({"ban": {"role": "SUPPORT"}}, tampering, self.snapshot)

    def write_catalog_fixture(self, directory, meta):
        characters = pathlib.Path(directory) / "personnages.json"
        characters.write_text(
            json.dumps([{"slug": "ban"}, {"slug": "khala"}]), encoding="utf-8"
        )
        catalog = pathlib.Path(directory) / "personnages-meta.js"
        catalog.write_text(
            module.render_window_assignment(["// En-tête."], "SEVEN_DS_META", meta),
            encoding="utf-8",
        )
        return catalog, characters

    def test_client_only_mapping_catalog_replaces_the_client_entry(self):
        with tempfile.TemporaryDirectory() as directory:
            catalog, _ = self.write_catalog_fixture(
                directory, {"ban": {"role": "SUPPORT"}, "khala": {"role": "DEFENDER"}}
            )

            count, digest = module.client_only_mapping_catalog(
                catalog, "SEVEN_DS_META", "meta", ["// En-tête."], self.snapshot
            )

            written = module.read_window_assignment(catalog, "SEVEN_DS_META")
        self.assertEqual(count, 2)
        self.assertEqual(written["ban"], {"role": "SUPPORT"})
        self.assertEqual(written["khala"]["rarity"], "SSR")
        self.assertEqual(
            digest,
            module.semantic_hash_without_slugs({"ban": {"role": "SUPPORT"}}, {"khala"}),
        )

    def test_check_mapping_catalog_accepts_an_up_to_date_catalog(self):
        meta = module.merge_mapping({"ban": {"role": "SUPPORT"}}, "meta", self.snapshot)
        with tempfile.TemporaryDirectory() as directory:
            catalog, characters = self.write_catalog_fixture(directory, meta)

            module.check_mapping_catalog(
                catalog, "SEVEN_DS_META", "meta", ["// En-tête."], characters, self.snapshot
            )

    def test_check_mapping_catalog_rejects_keys_that_differ_from_characters(self):
        meta = module.merge_mapping({"bug": {"role": "SUPPORT"}}, "meta", self.snapshot)
        with tempfile.TemporaryDirectory() as directory:
            catalog, characters = self.write_catalog_fixture(directory, meta)

            with self.assertRaisesRegex(ValueError, "clés.*personnages.json.*ban.*bug"):
                module.check_mapping_catalog(
                    catalog, "SEVEN_DS_META", "meta", ["// En-tête."], characters, self.snapshot
                )

    def test_check_mapping_catalog_rejects_a_stale_client_entry(self):
        meta = {"ban": {"role": "SUPPORT"}, "khala": {"role": "DEFENDER"}}
        with tempfile.TemporaryDirectory() as directory:
            catalog, characters = self.write_catalog_fixture(directory, meta)

            with self.assertRaisesRegex(ValueError, "personnages-meta.js doit être régénéré"):
                module.check_mapping_catalog(
                    catalog, "SEVEN_DS_META", "meta", ["// En-tête."], characters, self.snapshot
                )

    def test_window_assignment_round_trips(self):
        payload = {"khala": {"Nunchaku": ["Augmente l'attaque de [#1A7331]5%[-].\nSuite"]}}
        text = module.render_window_assignment(
            ["// Ligne d'en-tête."], "SEVEN_DS_POTENTIELS", payload
        )

        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "potentiels.js"
            module.write_text_atomic(path, text)
            self.assertEqual(
                module.read_window_assignment(path, "SEVEN_DS_POTENTIELS"), payload
            )
        self.assertTrue(text.startswith("// Ligne d'en-tête.\nwindow.SEVEN_DS_POTENTIELS = {\n"))
        self.assertTrue(text.endswith("};\n"))


if __name__ == "__main__":
    unittest.main()
