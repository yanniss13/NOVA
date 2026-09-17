import importlib.util
import pathlib
import tempfile
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "generate_armures_liees", ROOT / "scripts" / "generate-armures-liees.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

HTML = (
    r'\"slug\":\"meliodas-costume-134100502\",'
    r'\"nameFr\":\"Une nouvelle aventure\",'
    r'\"rarity\":\"SSR\",\"bindingRecipeId\":\"133010052-133214001\",'
    r'\"itemGameId\":\"133214001\"'
)


HERO_SEPARATOR = " — "


def client_snapshot(slug="khala", name="Khala"):
    """Un heros du snapshot local, reduit a ce que ce generateur lit."""
    tenues = ["Une nouvelle aventure", "Tenue de travail"]
    return {
        "version": 1,
        "heroes": {
            slug: {
                "id": "1029",
                "nameFr": name,
                "linkedArmors": [
                    {"gameId": "13323500" + str(index), "nameFr": tenue}
                    for index, tenue in enumerate(tenues)
                ],
                "assets": {
                    "linkedArmors": [
                        {
                            "source": tenue + ".png",
                            "target": "7ds-armures-ssr/Armure liee/"
                                      + name + HERO_SEPARATOR + tenue + ".webp",
                        }
                        for tenue in tenues
                    ]
                },
            }
        },
    }


def client_files(snapshot):
    return [
        asset["target"].rsplit("/", 1)[-1]
        for hero in snapshot["heroes"].values()
        for asset in hero["assets"]["linkedArmors"]
    ]


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

    def test_client_rows_complete_public_candidates(self):
        """Une tenue absente de la page publique arrive du snapshot local.

        Son nom de ligne est celui du FICHIER : deux héros peuvent porter une
        tenue du même nom, et l'image préfixée ne doit jamais se rapprocher de
        la ligne publique du même intitulé."""
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            (armor_dir / "Une nouvelle aventure.webp").touch()
            (armor_dir / ("Khala" + HERO_SEPARATOR + "Une nouvelle aventure.webp")).touch()
            (character_dir / "meliodas.webp").touch()
            (character_dir / "khala.webp").touch()
            rows = [{
                "char": "khala",
                "name": "Khala" + HERO_SEPARATOR + "Une nouvelle aventure",
                "game_id": "133235001",
            }]

            self.assertEqual(
                module.build_mapping(HTML, armor_dir, character_dir, client_rows=rows),
                {
                    "khala": [
                        "7ds-armures-ssr/Armure liee/Khala"
                        + HERO_SEPARATOR + "Une nouvelle aventure.webp"
                    ],
                    "meliodas": [
                        "7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp"
                    ],
                },
            )

    def test_client_only_replaces_only_the_snapshot_heroes(self):
        snapshot = client_snapshot()
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            for name in client_files(snapshot):
                (armor_dir / name).touch()
            (character_dir / "khala.webp").touch()
            output = root / "armures-liees.js"
            output.write_text(
                module.render_js({
                    "ban": ["7ds-armures-ssr/Armure liee/Ancienne.webp"],
                    "khala": ["7ds-armures-ssr/Armure liee/Périmée.webp"],
                }),
                encoding="utf-8",
            )

            mapping, digest = module.client_only(
                output, snapshot, armor_dir, character_dir
            )

            self.assertEqual(mapping["ban"], ["7ds-armures-ssr/Armure liee/Ancienne.webp"])
            self.assertEqual(mapping["khala"], sorted(
                "7ds-armures-ssr/Armure liee/" + name for name in client_files(snapshot)
            ))
            self.assertEqual(len(digest), 64)
            self.assertEqual(
                module.client_content.read_window_assignment(output, module.NAME), mapping
            )

    def test_client_only_refuses_a_file_missing_from_the_repository(self):
        snapshot = client_snapshot()
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            (armor_dir / client_files(snapshot)[0]).touch()
            (character_dir / "khala.webp").touch()
            output = root / "armures-liees.js"
            output.write_text(module.render_js({"khala": []}), encoding="utf-8")

            with self.assertRaisesRegex(module.DataError, "Tenue de travail"):
                module.client_only(output, snapshot, armor_dir, character_dir)
            self.assertEqual(
                module.client_content.read_window_assignment(output, module.NAME),
                {"khala": []},
            )

    def test_check_rejects_a_stale_client_entry(self):
        snapshot = client_snapshot()
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            for name in client_files(snapshot):
                (armor_dir / name).touch()
            (character_dir / "khala.webp").touch()
            output = root / "armures-liees.js"
            output.write_text(
                module.render_js({"khala": [
                    "7ds-armures-ssr/Armure liee/" + client_files(snapshot)[0]
                ]}),
                encoding="utf-8",
            )

            with self.assertRaises(module.DataError):
                module.check(output, snapshot, armor_dir, character_dir)

            module.client_only(output, snapshot, armor_dir, character_dir)
            module.check(output, snapshot, armor_dir, character_dir)

    def test_check_rejects_a_local_image_absent_from_the_catalog(self):
        snapshot = client_snapshot()
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            armor_dir = root / "Armure liee"
            character_dir = root / "personnages"
            armor_dir.mkdir()
            character_dir.mkdir()
            for name in client_files(snapshot):
                (armor_dir / name).touch()
            (character_dir / "khala.webp").touch()
            output = root / "armures-liees.js"
            output.write_text(module.render_js({"khala": []}), encoding="utf-8")
            module.client_only(output, snapshot, armor_dir, character_dir)
            (armor_dir / "Orpheline.webp").touch()

            with self.assertRaisesRegex(module.DataError, "Orpheline"):
                module.check(output, snapshot, armor_dir, character_dir)

    def test_invalid_data_does_not_replace_existing_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = pathlib.Path(tmp) / "armures-liees.js"
            output.write_text("instantane valide", encoding="utf-8")
            with self.assertRaises(module.DataError):
                module.generate(
                    "aucune donnee", output, pathlib.Path(tmp), pathlib.Path(tmp)
                )
            self.assertEqual(output.read_text(encoding="utf-8"), "instantane valide")
