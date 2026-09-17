import importlib.util
import json
import pathlib
import tempfile
import unittest

from PIL import Image


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "importer_assets_jouables", ROOT / "outils" / "fabrication" / "importer-assets-jouables.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def write_png(path, *, rgba=(20, 40, 60, 255)):
    path.parent.mkdir(parents=True, exist_ok=True)
    with Image.new("RGBA", (3, 2), rgba) as image:
        image.save(path, "PNG")


class JouableAssetsImporterTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = pathlib.Path(self.tmp.name)
        self.exports = root / "Content"
        self.repo = root / "repo"
        (self.exports / "UIImg").mkdir(parents=True)
        self.repo.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def write_snapshot(self, assets):
        snapshot = {"version": 1, "heroes": {"khala": {"assets": assets}}}
        path = pathlib.Path(self.tmp.name) / "contenu-jeu.json"
        path.write_text(json.dumps(snapshot), encoding="utf-8")
        return path

    def source(self, relative):
        path = self.exports / "UIImg" / relative
        write_png(path)
        return path

    def test_convertit_uniquement_les_assets_declares(self):
        portrait = "Icon_Item/portrait_Hero/slot_Calla_001.png"
        self.source(portrait)
        with Image.new("RGBA", (3, 2), (20, 40, 60, 127)) as image:
            image.save(self.exports / "UIImg" / portrait, "PNG")
        assets = {
            "portrait": {
                "source": portrait,
                "target": "7ds-personnages/khala.webp",
            },
            "skills": [],
            "commonSkills": [
                {"target": "7ds-ui/skills/common_SwordDual_normalAttack.webp"}
            ],
            "linkedArmors": [],
        }

        produits = module.import_assets(self.write_snapshot(assets), self.exports, self.repo)

        self.assertEqual(
            [p.relative_to(self.repo).as_posix() for p in produits],
            ["7ds-personnages/khala.webp"],
        )
        with Image.open(produits[0]) as image:
            self.assertEqual(image.format, "WEBP")
            self.assertEqual(image.mode, "RGBA")
            self.assertEqual(image.size, (3, 2))
            self.assertEqual(image.getpixel((0, 0)), (20, 40, 60, 127))
        self.assertFalse((self.repo / "7ds-ui/skills/common_SwordDual_normalAttack.webp").exists())

    def test_convertit_skills_et_armures_dans_lordre_du_snapshot(self):
        skill = "Icon_Item/Skill/Calla_Test.png"
        armor = "Icon_Item/BindArmor/BindArmor_PC_Calla_0002.png"
        self.source(skill)
        self.source(armor)
        assets = {
            "portrait": None,
            "skills": [{"source": skill, "target": "7ds-ui/skills/Calla_Test.webp"}],
            "linkedArmors": [
                {"source": armor, "target": "7ds-armures-ssr/Armure liee/Tenue.webp"}
            ],
        }

        produits = module.import_assets(self.write_snapshot(assets), self.exports, self.repo)

        self.assertEqual(
            [p.relative_to(self.repo).as_posix() for p in produits],
            [
                "7ds-ui/skills/Calla_Test.webp",
                "7ds-armures-ssr/Armure liee/Tenue.webp",
            ],
        )

    def test_refuse_source_absente_sans_ecrire_de_sortie(self):
        assets = {
            "portrait": {
                "source": "Icon_Item/portrait_Hero/inconnue.png",
                "target": "7ds-personnages/khala.webp",
            },
            "skills": [],
            "linkedArmors": [],
        }

        with self.assertRaisesRegex(ValueError, "source absente"):
            module.import_assets(self.write_snapshot(assets), self.exports, self.repo)
        self.assertFalse((self.repo / "7ds-personnages/khala.webp").exists())

    def test_refuse_cible_dupliquee_sans_ecrire_de_sortie(self):
        skill = "Icon_Item/Skill/Calla_Test.png"
        self.source(skill)
        assets = {
            "portrait": {
                "source": skill,
                "target": "7ds-personnages/khala.webp",
            },
            "skills": [{"source": skill, "target": "7ds-personnages/khala.webp"}],
            "linkedArmors": [],
        }

        with self.assertRaisesRegex(ValueError, "cible asset dupliquée"):
            module.import_assets(self.write_snapshot(assets), self.exports, self.repo)
        self.assertFalse((self.repo / "7ds-personnages/khala.webp").exists())

    def test_refuse_cible_hors_racines_autorisees(self):
        skill = "Icon_Item/Skill/Calla_Test.png"
        self.source(skill)
        assets = {
            "portrait": {
                "source": skill,
                "target": "docs/khala.webp",
            },
            "skills": [],
            "linkedArmors": [],
        }

        with self.assertRaisesRegex(ValueError, "cible asset interdite"):
            module.import_assets(self.write_snapshot(assets), self.exports, self.repo)

    def test_refuse_traversee_depuis_une_racine_autorisee(self):
        skill = "Icon_Item/Skill/Calla_Test.png"
        self.source(skill)
        assets = {
            "portrait": {
                "source": skill,
                "target": "7ds-ui/skills/../../docs/khala.webp",
            },
            "skills": [],
            "linkedArmors": [],
        }

        with self.assertRaisesRegex(ValueError, "cible asset interdite"):
            module.import_assets(self.write_snapshot(assets), self.exports, self.repo)

    def test_refuse_collision_avec_une_cible_normale_differente(self):
        skill = "Icon_Item/Skill/Calla_Test.png"
        self.source(skill)
        target = self.repo / "7ds-ui/skills/Calla_Test.webp"
        target.parent.mkdir(parents=True)
        with Image.new("RGBA", (3, 2), (200, 100, 40, 255)) as image:
            image.save(target, "WEBP", lossless=True)
        assets = {
            "portrait": None,
            "skills": [{"source": skill, "target": "7ds-ui/skills/Calla_Test.webp"}],
            "commonSkills": [],
            "linkedArmors": [],
        }

        with self.assertRaisesRegex(ValueError, "cible existante différente"):
            module.import_assets(self.write_snapshot(assets), self.exports, self.repo)

    def test_cible_normale_identique_est_idempotente(self):
        skill = "Icon_Item/Skill/Calla_Test.png"
        source = self.source(skill)
        target = self.repo / "7ds-ui/skills/Calla_Test.webp"
        target.parent.mkdir(parents=True)
        with Image.open(source) as image:
            image.convert("RGBA").save(target, "WEBP", lossless=True)
        before = target.read_bytes()
        assets = {
            "portrait": None,
            "skills": [{"source": skill, "target": "7ds-ui/skills/Calla_Test.webp"}],
            "commonSkills": [],
            "linkedArmors": [],
        }

        produits = module.import_assets(self.write_snapshot(assets), self.exports, self.repo)

        self.assertEqual(produits, [])
        self.assertEqual(target.read_bytes(), before)

    def test_echec_de_conversion_ne_remplace_pas_les_cibles_precedentes(self):
        good = "Icon_Item/Skill/Calla_Good.png"
        bad = "Icon_Item/Skill/Calla_Bad.png"
        self.source(good)
        bad_path = self.exports / "UIImg" / bad
        bad_path.parent.mkdir(parents=True, exist_ok=True)
        bad_path.write_bytes(b"not an image")
        assets = {
            "portrait": None,
            "skills": [
                {"source": good, "target": "7ds-ui/skills/Calla_Good.webp"},
                {"source": bad, "target": "7ds-ui/skills/Calla_Bad.webp"},
            ],
            "linkedArmors": [],
        }

        with self.assertRaises(Exception):
            module.import_assets(self.write_snapshot(assets), self.exports, self.repo)
        self.assertFalse((self.repo / "7ds-ui/skills/Calla_Good.webp").exists())
        self.assertFalse((self.repo / "7ds-ui/skills/Calla_Bad.webp").exists())

    def test_snapshot_et_assets_reels_portent_des_cibles_d_armures_propres(self):
        snapshot = json.loads((ROOT / "7ds-stats/contenu-jeu.json").read_text(encoding="utf-8"))
        armor_assets = snapshot["heroes"]["khala"]["assets"]["linkedArmors"]

        self.assertEqual(len(armor_assets), 3)
        self.assertTrue(
            all(pathlib.PurePosixPath(asset["target"]).name.startswith("Khala — ") for asset in armor_assets)
        )
        self.assertTrue(all((ROOT / asset["target"]).is_file() for asset in armor_assets))
        self.assertTrue((ROOT / "7ds-armures-ssr/Armure liee/Préparation totale.webp").is_file())


if __name__ == "__main__":
    unittest.main()
