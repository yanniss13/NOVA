import importlib.util
import os
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


    def test_un_mauvais_mot_de_passe_arrete_proprement(self):
        """Verifie en direct le 19 aout : l'endpoint rend 400 invalid_credentials.
        Un membre qui se trompe doit lire une phrase, pas une pile d'erreurs."""
        import urllib.error
        import urllib.request

        def refuser(requete, timeout=None):
            raise urllib.error.HTTPError(
                requete.full_url, 400, "Bad Request", {}, None
            )

        origine = urllib.request.urlopen
        environnement = dict(os.environ)
        os.environ["CONFRERIE_EMAIL"] = "sonde@invalide.test"
        os.environ["CONFRERIE_MOTDEPASSE"] = "mauvais"
        urllib.request.urlopen = refuser
        try:
            with self.assertRaises(SystemExit) as leve:
                MODULE._jeton({"SB_URL": "https://exemple.test", "SB_KEY": "cle"})
            self.assertIn("incorrect", str(leve.exception))
        finally:
            urllib.request.urlopen = origine
            os.environ.clear()
            os.environ.update(environnement)


if __name__ == "__main__":
    unittest.main()
