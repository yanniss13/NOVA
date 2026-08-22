import importlib.util
import json
import os
import pathlib
import tempfile
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

    def test_un_ecart_exactement_egal_a_dix_pour_cent_est_accepte(self):
        envois = [
            {"game_id": "x", "seconds": 1.0, "pseudo": "a"},
            {"game_id": "x", "seconds": 1.1, "pseudo": "b"},
        ]

        self.assertEqual(MODULE.desaccords(envois), [])

    def test_un_seul_envoi_ne_declenche_aucun_desaccord(self):
        envois = [{"game_id": "bug_axe_jumpatk", "seconds": 1.1, "pseudo": "a"}]
        self.assertEqual(MODULE.desaccords(envois), [])

    def test_une_mesure_doit_etre_finie_positive_et_plafonnee(self):
        self.assertEqual(MODULE.normaliser_mesure("1,25"), 1.25)
        for valeur in ("", "0", "-1", "31", "nan", "inf", None):
            with self.subTest(valeur=valeur):
                self.assertIsNone(MODULE.normaliser_mesure(valeur))

    def test_le_protocole_mode_repetitions_et_fps_est_valide_ensemble(self):
        valides = [
            {"mode": "unique", "reps": None, "fps": 30},
            {"mode": "rafale", "reps": 10, "fps": 59.94},
            {"mode": "unique", "reps": None, "fps": None},
        ]
        invalides = [
            {"mode": "unique", "reps": 1, "fps": 60},
            {"mode": "rafale", "reps": None, "fps": 60},
            {"mode": "rafale", "reps": 1, "fps": 60},
            {"mode": "rafale", "reps": True, "fps": 60},
            {"mode": "rafale", "reps": 10.5, "fps": 60},
            {"mode": "rafale", "reps": 10, "fps": 9},
            {"mode": "rafale", "reps": 10, "fps": float("inf")},
        ]
        for envoi in valides:
            self.assertTrue(MODULE.protocole_mesure_valide(envoi), envoi)
        for envoi in invalides:
            self.assertFalse(MODULE.protocole_mesure_valide(envoi), envoi)

    def test_un_protocole_invalide_est_ecarte_apres_la_correction_la_plus_recente(self):
        envois = [{
            "id": "a", "game_id": "connu", "owner": "u1", "seconds": 1.2,
            "mode": "unique", "reps": 1, "fps": 60,
            "created_at": "2026-08-21T10:00:00Z",
        }]

        valides, inconnus, invalides = MODULE.trier_envois(envois, {"connu"})

        self.assertEqual(valides, [])
        self.assertEqual(inconnus, [])
        self.assertEqual(invalides, envois)

    def test_le_detail_signale_un_fps_inconnu(self):
        envoi = {
            "pseudo": "Anne", "seconds": 1.234,
            "mode": "unique", "reps": None, "fps": None,
        }

        self.assertEqual(
            MODULE.detail_envoi(envoi),
            "Anne 1.234 s (unique, fps inconnu)",
        )

    def test_les_identifiants_inconnus_et_mesures_invalides_sont_ecartes(self):
        envois = [
            {"game_id": "connu", "seconds": 1.2,
             "mode": "unique", "reps": None, "fps": None},
            {"game_id": "orphelin", "seconds": 1.3},
            {"game_id": "connu", "seconds": float("inf")},
        ]

        valides, inconnus, invalides = MODULE.trier_envois(envois, {"connu"})

        self.assertEqual(valides, [envois[0]])
        self.assertEqual(inconnus, [envois[1]])
        self.assertEqual(invalides, [envois[2]])

    def test_une_correction_invalide_ne_ressuscite_pas_l_ancienne_mesure(self):
        envois = [
            {"id": "a", "game_id": "connu", "owner": "u1", "seconds": 1.2,
             "mode": "unique", "reps": None, "fps": None,
             "created_at": "2026-08-20T10:00:00Z"},
            {"id": "b", "game_id": "connu", "owner": "u1", "seconds": 31,
             "mode": "rafale", "reps": True, "fps": None,
             "created_at": "2026-08-21T10:00:00Z"},
        ]

        valides, inconnus, invalides = MODULE.trier_envois(envois, {"connu"})

        self.assertEqual(valides, [])
        self.assertEqual(inconnus, [])
        self.assertEqual(invalides, [envois[1]])

    def test_seules_les_competences_chiffrables_sont_des_identifiants_connus(self):
        noms = MODULE.libelles()

        self.assertIn("diane_gauntlets_skill_rmb_1", noms)
        self.assertNotIn("bug_book_skill_e", noms)

    def test_le_detail_rappelle_le_protocole_de_mesure(self):
        envoi = {
            "pseudo": "Anne",
            "seconds": 1.234,
            "mode": "rafale",
            "reps": 10,
            "fps": 60,
        }

        self.assertEqual(
            MODULE.detail_envoi(envoi),
            "Anne 1.234 s (rafale, 10 repetitions, 60 fps)",
        )

    def test_tous_les_envois_sont_pagines_dans_un_ordre_stable(self):
        pages = [[{"id": "a"}, {"id": "b"}], [{"id": "c"}], []]
        requetes = []

        class Reponse:
            def __init__(self, contenu):
                self.contenu = contenu

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return False

            def read(self):
                return json.dumps(self.contenu).encode("utf-8")

        def ouvrir(requete, timeout=None):
            requetes.append(requete)
            return Reponse(pages[len(requetes) - 1])

        config_originale = MODULE._config
        jeton_original = MODULE._jeton
        ouvrir_original = MODULE.urllib.request.urlopen
        try:
            MODULE._config = lambda: {"SB_URL": "https://exemple.test", "SB_KEY": "cle"}
            MODULE._jeton = lambda config: "jeton"
            MODULE.urllib.request.urlopen = ouvrir
            obtenus = MODULE._envois(taille_page=2)
        finally:
            MODULE._config = config_originale
            MODULE._jeton = jeton_original
            MODULE.urllib.request.urlopen = ouvrir_original

        self.assertEqual([ligne["id"] for ligne in obtenus], ["a", "b", "c"])
        self.assertEqual(
            [requete.get_header("Range") for requete in requetes],
            ["0-1", "2-3", "3-4"],
        )
        self.assertTrue(all(
            "order=created_at.asc,id.asc" in requete.full_url
            for requete in requetes
        ))

    def test_l_ecriture_remplace_le_json_completement(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = pathlib.Path(dossier) / "mesures.json"
            chemin.write_text('{"animations":{"ancienne":1}}\n', encoding="utf-8")

            MODULE.ecrire_mesures_atomiquement(
                chemin, {"animations": {"nouvelle": 1.2}}
            )

            self.assertEqual(
                json.loads(chemin.read_text(encoding="utf-8")),
                {"animations": {"nouvelle": 1.2}},
            )

    def test_une_ecriture_interrompue_preserve_le_fichier_original(self):
        with tempfile.TemporaryDirectory() as dossier:
            chemin = pathlib.Path(dossier) / "mesures.json"
            original = '{"animations":{"sure":1}}\n'
            chemin.write_text(original, encoding="utf-8")
            dump_original = MODULE.json.dump

            def interrompre(*_args, **_kwargs):
                raise RuntimeError("disque interrompu")

            MODULE.json.dump = interrompre
            try:
                with self.assertRaises(RuntimeError):
                    MODULE.ecrire_mesures_atomiquement(
                        chemin, {"animations": {"nouvelle": 1.2}}
                    )
            finally:
                MODULE.json.dump = dump_original

            self.assertEqual(chemin.read_text(encoding="utf-8"), original)
            self.assertEqual(list(pathlib.Path(dossier).iterdir()), [chemin])


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

    def test_l_identifiant_departage_deux_envois_au_meme_instant(self):
        premier = {"id": "a", "game_id": "x", "owner": "u1", "seconds": 2.0,
                   "created_at": "2026-08-21T10:00:00Z"}
        correction = {"id": "b", "game_id": "x", "owner": "u1", "seconds": 1.2,
                      "created_at": "2026-08-21T10:00:00Z"}

        for ordre in ([premier, correction], [correction, premier]):
            with self.subTest([envoi["id"] for envoi in ordre]):
                self.assertEqual(MODULE.grouper(ordre)["x"][0]["id"], "b")

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
