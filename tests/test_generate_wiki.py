import importlib.util
import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "generate_wiki", ROOT / "scripts" / "generate-wiki.py"
)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def competence(game_id, weapon, categorie, nom, description, cooldown=None):
    """Un objet de competence tel que la source le publie."""
    return json.dumps({
        "gameId": game_id,
        "weaponType": weapon,
        "skillCategory": categorie,
        "nameFr": nom,
        "nameEn": "ignored",
        "descriptionFr": description,
        "descriptionEn": "ignored",
        "cooldown": cooldown,
    }, ensure_ascii=False)


PAYLOAD = "[" + ",".join([
    competence("derieri_axe_passive", "Axe", "PASSIVE",
               "Charge ténébreuse", "Réduit la résistance de [#1A7331]3%[-]."),
    competence("derieri_axe_skill_q", "Axe", "NORMAL",
               "Poing de fureur", "Inflige des dégâts.", 12),
]) + "]"


class ExtractionTests(unittest.TestCase):
    def test_retient_les_champs_francais(self):
        self.assertEqual(
            module.competences_du_payload(PAYLOAD),
            [
                {
                    "gameId": "derieri_axe_passive",
                    "weaponType": "Axe",
                    "categorie": "PASSIVE",
                    "nomFr": "Charge ténébreuse",
                    "descriptionFr": "Réduit la résistance de [#1A7331]3%[-].",
                    "recharge": None,
                },
                {
                    "gameId": "derieri_axe_skill_q",
                    "weaponType": "Axe",
                    "categorie": "NORMAL",
                    "nomFr": "Poing de fureur",
                    "descriptionFr": "Inflige des dégâts.",
                    "recharge": 12.0,
                },
            ],
        )

    def test_garde_les_passifs(self):
        categories = [c["categorie"]
                      for c in module.competences_du_payload(PAYLOAD)]
        self.assertIn("PASSIVE", categories)

    def test_deduplique_sur_le_game_id(self):
        double = "[" + ",".join([
            competence("derieri_axe_passive", "Axe", "PASSIVE", "A", "desc"),
            competence("derieri_axe_passive", "Axe", "PASSIVE", "A", "desc"),
        ]) + "]"
        self.assertEqual(len(module.competences_du_payload(double)), 1)


class ValidationTests(unittest.TestCase):
    def test_description_vide_rejetee(self):
        vide = "[" + competence(
            "derieri_axe_passive", "Axe", "PASSIVE", "Charge", "") + "]"
        with self.assertRaises(module.CatalogueIncomplet):
            module.valide("derieri", module.competences_du_payload(vide))

    def test_arme_sans_passif_rejetee(self):
        sans = "[" + competence(
            "derieri_axe_skill_q", "Axe", "NORMAL", "Poing", "desc") + "]"
        with self.assertRaises(module.CatalogueIncomplet):
            module.valide("derieri", module.competences_du_payload(sans))

    def test_heros_sans_competence_rejete(self):
        with self.assertRaises(module.CatalogueIncomplet):
            module.valide("derieri", [])

    def test_catalogue_nominal_accepte(self):
        self.assertIsNone(
            module.valide("derieri", module.competences_du_payload(PAYLOAD))
        )


if __name__ == "__main__":
    unittest.main()
