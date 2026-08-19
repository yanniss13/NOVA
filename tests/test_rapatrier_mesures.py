import importlib.util
import pathlib
import unittest


RACINE = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "rapatrier_mesures", RACINE / "scripts" / "rapatrier-mesures.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


CATALOGUE = {
    "meliodas": [
        {"gameId": "meliodas_axe_jumpatk"},
        {"gameId": "meliodas_sword1h_jumpatk"},
        {"gameId": "meliodas_axe_skill_q"},
    ],
    "diane": [{"gameId": "diane_axe_jumpatk"}],
}


class RapatrierMesuresTests(unittest.TestCase):
    def test_le_slot_ignore_le_heros_et_l_arme(self):
        self.assertEqual(MODULE.slot_de_game_id("bug_axe_jumpatk"), "jumpatk")
        self.assertEqual(
            MODULE.slot_de_game_id("gil_thunder_lance_skill_tag"), "skill_tag"
        )

    def test_une_mesure_couvre_toutes_les_armes_du_heros(self):
        self.assertEqual(
            sorted(MODULE.game_ids_du_couple(CATALOGUE, "meliodas", "jumpatk")),
            ["meliodas_axe_jumpatk", "meliodas_sword1h_jumpatk"],
        )

    def test_l_ecriture_touche_tous_les_game_ids_du_couple(self):
        mesures = {"animations": {}}
        obtenu = MODULE.appliquer(mesures, CATALOGUE, "meliodas", "jumpatk", 1.2)
        self.assertEqual(
            obtenu["animations"],
            {"meliodas_axe_jumpatk": 1.2, "meliodas_sword1h_jumpatk": 1.2},
        )

    def test_un_ecart_de_plus_de_dix_pour_cent_est_signale(self):
        envois = [
            {"hero": "meliodas", "slot": "jumpatk", "seconds": 1.2, "pseudo": "a"},
            {"hero": "meliodas", "slot": "jumpatk", "seconds": 1.5, "pseudo": "b"},
            {"hero": "diane", "slot": "jumpatk", "seconds": 1.0, "pseudo": "a"},
            {"hero": "diane", "slot": "jumpatk", "seconds": 1.05, "pseudo": "b"},
        ]
        signales = MODULE.desaccords(envois)
        self.assertEqual(
            [couple for couple, _ in signales], [("meliodas", "jumpatk")]
        )


    def test_le_vrai_catalogue_donne_161_couples(self):
        """La meme regle vit en Python ici et en JS dans outils/chrono-calcul.js.
        Le parcours navigateur verrouille 161 cote JS ; ce test verrouille le
        meme nombre cote Python. Une derive entre les deux ferait ecrire le
        rapatriement ailleurs que ce que l'outil annonce au membre."""
        catalogue = MODULE._charge_js(MODULE.CATALOGUE)
        couples = {
            (heros, MODULE.slot_de_game_id(skill["gameId"]))
            for heros, liste in catalogue.items()
            for skill in liste
            if skill.get("gameId")
        }
        self.assertEqual(len(couples), 161)


if __name__ == "__main__":
    unittest.main()
