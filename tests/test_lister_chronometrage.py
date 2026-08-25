import importlib.util
import json
import pathlib
import tempfile
import unittest


RACINE = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "lister_chronometrage",
    RACINE / "scripts" / "lister-chronometrage.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ListerChronometrageTests(unittest.TestCase):
    def test_le_document_separe_les_touches_et_traduit_competences_et_armes(self):
        armes = [
            "Axe", "Book", "SwordDual", "Rapier", "Shield", "Lance",
            "Sword1h", "Cudgel3c", "Gauntlets", "Sword2h", "Staff", "Wand",
        ]
        categories = [
            "NORMAL", "NORMAL_SKILL", "ACTIVE_THIRD", "ULTIMATE", "TAG_SKILL",
        ]
        competences = []
        for index, arme in enumerate(armes):
            competences.append({
                "gameId": "skill-%d" % index,
                "weaponType": arme,
                "nom": "Coup %d" % index,
                "categorie": categories[index % len(categories)],
                "pourcentage": 100 + index,
                "recharge": 1 if categories[index % len(categories)] in (
                    "NORMAL_SKILL", "ULTIMATE") else 0,
            })

        catalogue_original = MODULE.catalogue
        mesures_originales = MODULE.mesures_existantes
        wiki_original = getattr(MODULE, "WIKI", None)
        avait_wiki = hasattr(MODULE, "WIKI")
        with tempfile.TemporaryDirectory() as dossier:
            wiki = pathlib.Path(dossier) / "wiki.js"
            wiki.write_text(
                "window.TEST = " + json.dumps({
                    "test": [
                        {"gameId": "skill-%d" % index,
                         "nomFr": "Compétence française %d" % index}
                        for index in range(len(competences))
                    ]
                }, ensure_ascii=False) + ";",
                encoding="utf-8",
            )
            try:
                MODULE.catalogue = lambda: {"test": competences}
                MODULE.mesures_existantes = lambda: {}
                MODULE.WIKI = str(wiki)
                document = MODULE.rendre()
            finally:
                MODULE.catalogue = catalogue_original
                MODULE.mesures_existantes = mesures_originales
                if avait_wiki:
                    MODULE.WIKI = wiki_original
                else:
                    delattr(MODULE, "WIKI")

        self.assertIn(
            "| héros | arme | compétence | catégorie | touche | dégâts % | mesure (s) |",
            document,
        )
        self.assertIn("Mesures qui débloquent maintenant", document)
        self.assertIn("Mesures qui affinent maintenant", document)
        self.assertIn("Relèves — simulation d’équipe future", document)

        for categorie, touche in [
            ("Attaque normale", "clic gauche"),
            ("Compétence normale", "E"),
            ("Attaque spéciale", "Q"),
            ("Attaque ultime", "R"),
            ("Compétence de relève", "1 à 4"),
        ]:
            self.assertIn("| %s | %s |" % (categorie, touche), document)

        for index in range(len(competences)):
            self.assertIn("Compétence française %d" % index, document)
            self.assertNotIn("Coup %d |" % index, document)

        for libelle in [
            "Hache", "Grimoire", "Épées doubles", "Rapière",
            "Épée & bouclier", "Lance", "Épée à une main", "Nunchaku",
            "Gantelets", "Épée à deux mains", "Bâton", "Baguette",
        ]:
            self.assertIn("| %s |" % libelle, document)

        for code in categories + [arme for arme in armes if arme != "Lance"]:
            self.assertNotIn("| %s |" % code, document)


    def test_l_avancement_classe_trois_priorites_sans_proposer_une_mesure_faite(self):
        """Les normales et spéciales débloquent, les recharges affinent,
        les relèves attendent la future simulation d'équipe."""
        competences = [
            {"gameId": "avec-recharge", "weaponType": "Axe", "nom": "Affine",
             "categorie": "ULTIMATE", "pourcentage": 500, "recharge": 12},
            {"gameId": "auto", "weaponType": "Axe", "nom": "Débloque",
             "categorie": "NORMAL", "pourcentage": 100, "recharge": 0},
            {"gameId": "speciale-zero", "weaponType": "Axe", "nom": "Débloque Q",
             "categorie": "ACTIVE_THIRD", "pourcentage": 200, "recharge": 0},
            {"gameId": "releve", "weaponType": "Axe", "nom": "Future",
             "categorie": "TAG_SKILL", "pourcentage": 300, "recharge": 0},
            {"gameId": "deja-mesuree", "weaponType": "Axe", "nom": "Faite",
             "categorie": "NORMAL", "pourcentage": 400, "recharge": 0},
        ]
        catalogue_original = MODULE.catalogue
        mesures_originales = MODULE.mesures_existantes
        noms_originaux = MODULE.noms_francais
        try:
            MODULE.catalogue = lambda: {"test": competences}
            MODULE.mesures_existantes = lambda: {"deja-mesuree": 1.2}
            MODULE.noms_francais = lambda: {}
            avancement = json.loads(MODULE.rendre_avancement())
        finally:
            MODULE.catalogue = catalogue_original
            MODULE.mesures_existantes = mesures_originales
            MODULE.noms_francais = noms_originaux

        self.assertEqual(avancement["total"], 5)
        self.assertEqual(avancement["mesurees"], 1)
        self.assertEqual(avancement["debloquent"], 3)
        self.assertEqual(avancement["affinent"], 1)
        self.assertEqual(avancement["releves"], 1)
        self.assertEqual(
            [ligne["gameId"] for ligne in avancement["prochaines"]],
            ["auto", "speciale-zero", "avec-recharge", "releve"],
        )
        self.assertEqual(
            [ligne["role"] for ligne in avancement["prochaines"]],
            ["debloque", "debloque", "affine", "releve"],
        )
        self.assertEqual(avancement["prochaines"][0]["arme"], "Hache")
        self.assertEqual(avancement["prochaines"][0]["touche"], "clic gauche")
        self.assertEqual(avancement["prochaines"][1]["touche"], "Q")

    def test_lignes_trie_chaque_priorite_selon_sa_regle(self):
        competences = [
            {"gameId": "auto-faible", "weaponType": "Axe", "nom": "Auto faible",
             "categorie": "NORMAL", "pourcentage": 100, "recharge": 0},
            {"gameId": "affine-lente", "weaponType": "Axe", "nom": "Affine lente",
             "categorie": "ULTIMATE", "pourcentage": 100, "recharge": 20},
            {"gameId": "releve-faible", "weaponType": "Axe", "nom": "Relève faible",
             "categorie": "TAG_SKILL", "pourcentage": 100, "recharge": 0},
            {"gameId": "auto-forte", "weaponType": "Axe", "nom": "Auto forte",
             "categorie": "NORMAL", "pourcentage": 300, "recharge": 0},
            {"gameId": "affine-rapide", "weaponType": "Axe", "nom": "Affine rapide",
             "categorie": "ULTIMATE", "pourcentage": 100, "recharge": 5},
            {"gameId": "speciale", "weaponType": "Axe", "nom": "Spéciale",
             "categorie": "ACTIVE_THIRD", "pourcentage": 200, "recharge": 0},
            {"gameId": "affine-moyenne", "weaponType": "Axe", "nom": "Affine moyenne",
             "categorie": "ULTIMATE", "pourcentage": 100, "recharge": 10},
            {"gameId": "releve-forte", "weaponType": "Axe", "nom": "Relève forte",
             "categorie": "TAG_SKILL", "pourcentage": 300, "recharge": 0},
        ]
        catalogue_original = MODULE.catalogue
        mesures_originales = MODULE.mesures_existantes
        noms_originaux = MODULE.noms_francais
        try:
            MODULE.catalogue = lambda: {"test": competences}
            MODULE.mesures_existantes = lambda: {}
            MODULE.noms_francais = lambda: {}
            debloquent, affinent, releves = MODULE.lignes()
        finally:
            MODULE.catalogue = catalogue_original
            MODULE.mesures_existantes = mesures_originales
            MODULE.noms_francais = noms_originaux

        self.assertEqual(
            [ligne["gameId"] for ligne in debloquent],
            ["auto-forte", "auto-faible", "speciale"],
        )
        self.assertEqual(
            [ligne["gameId"] for ligne in affinent],
            ["affine-rapide", "affine-moyenne", "affine-lente"],
        )
        self.assertEqual(
            [ligne["gameId"] for ligne in releves],
            ["releve-forte", "releve-faible"],
        )

    def test_lignes_refuse_une_categorie_hors_catalogue_quel_que_soit_sa_recharge(self):
        catalogue_original = MODULE.catalogue
        mesures_originales = MODULE.mesures_existantes
        noms_originaux = MODULE.noms_francais
        try:
            MODULE.mesures_existantes = lambda: {}
            MODULE.noms_francais = lambda: {}
            for recharge in (0, 5):
                game_id = "categorie-inconnue-%d" % recharge
                MODULE.catalogue = lambda: {"test": [{
                    "gameId": game_id,
                    "weaponType": "Axe",
                    "nom": "Compétence inconnue",
                    "categorie": "INCONNUE",
                    "pourcentage": 100,
                    "recharge": recharge,
                }]}
                with self.subTest(recharge=recharge):
                    with self.assertRaisesRegex(ValueError, game_id + ".*INCONNUE"):
                        MODULE.lignes()
        finally:
            MODULE.catalogue = catalogue_original
            MODULE.mesures_existantes = mesures_originales
            MODULE.noms_francais = noms_originaux

    def test_lignes_classe_la_categorie_avant_la_recharge(self):
        competences = [
            {"gameId": "auto-zero", "weaponType": "Axe", "nom": "Auto",
             "categorie": "NORMAL", "pourcentage": 100, "recharge": 0},
            {"gameId": "speciale-zero", "weaponType": "Axe", "nom": "Spéciale",
             "categorie": "ACTIVE_THIRD", "pourcentage": 100, "recharge": 0},
            {"gameId": "normal-recharge", "weaponType": "Axe", "nom": "Auto avec recharge",
             "categorie": "NORMAL", "pourcentage": 100, "recharge": 5},
            {"gameId": "skill-recharge", "weaponType": "Axe", "nom": "Compétence",
             "categorie": "NORMAL_SKILL", "pourcentage": 100, "recharge": 5},
            {"gameId": "speciale-recharge", "weaponType": "Axe", "nom": "Spéciale avec recharge",
             "categorie": "ACTIVE_THIRD", "pourcentage": 100, "recharge": 5},
            {"gameId": "ultime-recharge", "weaponType": "Axe", "nom": "Ultime",
             "categorie": "ULTIMATE", "pourcentage": 100, "recharge": 5},
            {"gameId": "releve-recharge", "weaponType": "Axe", "nom": "Relève",
             "categorie": "TAG_SKILL", "pourcentage": 100, "recharge": 5},
        ]
        catalogue_original = MODULE.catalogue
        mesures_originales = MODULE.mesures_existantes
        noms_originaux = MODULE.noms_francais
        try:
            MODULE.catalogue = lambda: {"test": competences}
            MODULE.mesures_existantes = lambda: {}
            MODULE.noms_francais = lambda: {}
            debloquent, affinent, releves = MODULE.lignes()
        finally:
            MODULE.catalogue = catalogue_original
            MODULE.mesures_existantes = mesures_originales
            MODULE.noms_francais = noms_originaux

        self.assertEqual([ligne["gameId"] for ligne in debloquent],
                         ["auto-zero", "speciale-zero"])
        self.assertEqual([ligne["gameId"] for ligne in affinent],
                         ["normal-recharge", "skill-recharge", "speciale-recharge", "ultime-recharge"])
        self.assertEqual([ligne["gameId"] for ligne in releves], ["releve-recharge"])

    def test_l_avancement_publie_ne_depasse_pas_cinq_lignes(self):
        """Le fichier est charge par une carte de tableau de bord : il doit
        rester minuscule, et le compte total rester exact malgre la coupe."""
        publie = json.loads(
            (RACINE / "data" / "chronometrage-avancement.json")
            .read_text(encoding="utf-8")
        )
        self.assertLessEqual(len(publie["prochaines"]), MODULE.PROCHAINES)
        self.assertGreater(publie["total"], len(publie["prochaines"]))
        self.assertEqual(publie["mesurees"], len(MODULE.mesures_existantes()))

    def test_l_avancement_publie_compte_les_trois_priorites(self):
        publie = json.loads(
            (RACINE / "data" / "chronometrage-avancement.json")
            .read_text(encoding="utf-8")
        )
        # 335 avant que la liste tienne compte des verrous deduits des
        # fichiers du jeu : elle demandait de chronometrer 137
        # competences dont le montage donne deja la reponse.
        self.assertEqual(publie["total"], 198)
        self.assertEqual(publie["debloquent"], 76)
        self.assertEqual(publie["affinent"], 122)
        self.assertEqual(publie["releves"], 0)
        self.assertEqual(
            [ligne["role"] for ligne in publie["prochaines"]],
            ["debloque"] * MODULE.PROCHAINES,
        )

    def test_rien_a_mesurer_de_ce_que_le_jeu_renseigne_deja(self):
        """Un membre ne doit jamais etre envoye chronometrer une
        competence dont `animations-verrous.json` porte deja le verrou :
        ce serait refaire a la main un travail que le jeu publie."""
        deduits = MODULE.verrous_deduits()
        self.assertTrue(deduits, "les verrous deduits doivent exister")
        debloquent, affinent, releves = MODULE.lignes()
        listees = {
            ligne["gameId"]
            for groupe in (debloquent, affinent, releves)
            for ligne in groupe
        }
        self.assertFalse(
            listees & set(deduits),
            "competences deja deduites et pourtant listees a mesurer",
        )

    def test_toute_competence_reelle_a_un_nom_francais(self):
        """Le document est genere depuis les vraies donnees : aucune
        competence ne doit retomber sur son nom anglais de competences.js."""
        noms = MODULE.noms_francais()
        sans_traduction = [
            (heros, skill["gameId"])
            for heros, liste in MODULE.catalogue().items()
            for skill in liste
            if skill.get("gameId") and skill["gameId"] not in noms
        ]
        self.assertEqual(
            sans_traduction,
            [],
            "ces competences sortiraient en anglais dans le document",
        )


if __name__ == "__main__":
    unittest.main()
