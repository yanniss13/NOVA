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

    def test_invalid_data_does_not_replace_existing_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = pathlib.Path(tmp) / "armures-liees.js"
            output.write_text("instantane valide", encoding="utf-8")
            with self.assertRaises(module.DataError):
                module.generate(
                    "aucune donnee", output, pathlib.Path(tmp), pathlib.Path(tmp)
                )
            self.assertEqual(output.read_text(encoding="utf-8"), "instantane valide")
