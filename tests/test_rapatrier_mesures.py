import importlib.util
import pathlib
import unittest


RACINE = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "rapatrier_mesures", RACINE / "scripts" / "rapatrier-mesures.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RapatrierMesuresTests(unittest.TestCase):
    def test_une_mesure_ne_touche_qu_une_animation(self):
        """Un heros change de moveset avec son arme : Meliodas a la hache et
        Meliodas a l'epee longue sont deux animations distinctes. Ecrire l'une
        ne doit jamais renseigner l'autre."""
        mesures = {"animations": {"meliodas_sword1h_jumpatk": 0.9}}
        obtenu = MODULE.appliquer(mesures, "meliodas_axe_jumpatk", 1.2)
        self.assertEqual(
            obtenu["animations"],
            {"meliodas_sword1h_jumpatk": 0.9, "meliodas_axe_jumpatk": 1.2},
        )

    def test_un_ecart_de_plus_de_dix_pour_cent_est_signale(self):
        envois = [
            {"game_id": "meliodas_axe_jumpatk", "seconds": 1.2, "pseudo": "a"},
            {"game_id": "meliodas_axe_jumpatk", "seconds": 1.5, "pseudo": "b"},
            {"game_id": "diane_axe_jumpatk", "seconds": 1.0, "pseudo": "a"},
            {"game_id": "diane_axe_jumpatk", "seconds": 1.05, "pseudo": "b"},
        ]
        self.assertEqual(
            [game_id for game_id, _ in MODULE.desaccords(envois)],
            ["meliodas_axe_jumpatk"],
        )

    def test_un_seul_envoi_ne_declenche_aucun_desaccord(self):
        envois = [{"game_id": "bug_axe_jumpatk", "seconds": 1.1, "pseudo": "a"}]
        self.assertEqual(MODULE.desaccords(envois), [])


if __name__ == "__main__":
    unittest.main()
