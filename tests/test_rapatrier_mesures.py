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


    def test_un_membre_qui_reenvoie_corrige_au_lieu_de_voter_deux_fois(self):
        """La table est en ajout seul : corriger sa mesure, c'est en envoyer
        une autre. Compter les deux lignes ferait passer un seul avis pour
        deux accords."""
        envois = [
            {"game_id": "bug_axe_jumpatk", "owner": "u1", "seconds": 2.0,
             "pseudo": "a", "created_at": "2026-08-20T10:00:00Z"},
            {"game_id": "bug_axe_jumpatk", "owner": "u1", "seconds": 1.2,
             "pseudo": "a", "created_at": "2026-08-21T10:00:00Z"},
        ]
        groupes = MODULE.grouper(envois)

        self.assertEqual(len(groupes["bug_axe_jumpatk"]), 1)
        self.assertEqual(groupes["bug_axe_jumpatk"][0]["seconds"], 1.2)
        self.assertEqual(MODULE.desaccords(envois), [])

    def test_le_plus_recent_gagne_quel_que_soit_l_ordre_d_arrivee(self):
        """La requete trie deja par created_at, mais la fonction ne doit pas
        tenir QUE sous cette condition : appelee autrement, elle retiendrait
        la mesure corrigee avant la correction."""
        recente = {"game_id": "x", "owner": "u1", "seconds": 1.2,
                   "created_at": "2026-08-21T10:00:00Z"}
        ancienne = {"game_id": "x", "owner": "u1", "seconds": 2.0,
                    "created_at": "2026-08-20T10:00:00Z"}

        for ordre in ([ancienne, recente], [recente, ancienne]):
            with self.subTest([envoi["seconds"] for envoi in ordre]):
                retenus = MODULE.grouper(ordre)["x"]
                self.assertEqual(len(retenus), 1)
                self.assertEqual(retenus[0]["seconds"], 1.2)

    def test_un_envoi_sans_date_ne_fait_pas_echouer_le_groupement(self):
        """Une ligne anterieure a la colonne created_at, ou un export partiel,
        ne doit pas lever : elle passe simplement pour la plus ancienne."""
        envois = [
            {"game_id": "x", "owner": "u1", "seconds": 2.0},
            {"game_id": "x", "owner": "u1", "seconds": 1.2,
             "created_at": "2026-08-20T10:00:00Z"},
        ]
        retenus = MODULE.grouper(envois)["x"]

        self.assertEqual(len(retenus), 1)
        self.assertEqual(retenus[0]["seconds"], 1.2)

    def test_la_mediane_resiste_a_un_releve_aberrant(self):
        """Une moyenne suivrait le membre qui s'est trompe d'un facteur deux.
        Une mediane ne bouge pas des que deux autres l'encadrent."""
        envois = [
            {"game_id": "x", "owner": "u1", "seconds": 1.2, "pseudo": "a"},
            {"game_id": "x", "owner": "u2", "seconds": 1.25, "pseudo": "b"},
            {"game_id": "x", "owner": "u3", "seconds": 2.5, "pseudo": "c"},
        ]
        accord = MODULE.consensus(MODULE.grouper(envois)["x"])

        self.assertEqual(accord["valeur"], 1.25)
        self.assertEqual(accord["auteurs"], 3)
        self.assertGreater(accord["ecart"], MODULE.ECART_TOLERE)

    def test_un_nombre_pair_d_auteurs_moyenne_les_deux_du_milieu(self):
        self.assertEqual(MODULE.mediane([1.0, 2.0]), 1.5)
        self.assertEqual(MODULE.mediane([3.0, 1.0, 2.0]), 2.0)

    def test_un_envoi_qui_contredit_une_mesure_deja_ecrite_est_signale(self):
        """Sans ce controle, une mesure fausse validee une fois est
        definitive : le script ne repropose jamais une animation deja
        renseignee."""
        envois = [
            {"game_id": "x", "owner": "u1", "seconds": 2.0, "pseudo": "a"},
            {"game_id": "y", "owner": "u1", "seconds": 1.02, "pseudo": "a"},
        ]
        mesures = {"animations": {"x": 1.0, "y": 1.0}}

        signales = MODULE.dementis(envois, mesures)

        self.assertEqual([game_id for game_id, _, _ in signales], ["x"])
        self.assertEqual(signales[0][1], 1.0)
        self.assertEqual(signales[0][2]["valeur"], 2.0)

    def test_une_animation_jamais_ecrite_ne_dement_rien(self):
        envois = [{"game_id": "x", "owner": "u1", "seconds": 2.0, "pseudo": "a"}]
        self.assertEqual(MODULE.dementis(envois, {"animations": {}}), [])

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
