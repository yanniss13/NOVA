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
                "recharge": 0,
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


    def test_l_avancement_met_les_competences_sans_recharge_devant(self):
        """« Mon suivi » lit ce fichier. Ce qui debloque un calcul passe avant
        ce qui l'affine, et une animation deja mesuree ne se propose plus."""
        competences = [
            {"gameId": "avec-recharge", "weaponType": "Axe", "nom": "Affine",
             "categorie": "ULTIMATE", "pourcentage": 500, "recharge": 12},
            {"gameId": "sans-recharge", "weaponType": "Axe", "nom": "Debloque",
             "categorie": "NORMAL", "pourcentage": 100, "recharge": 0},
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

        self.assertEqual(avancement["total"], 3)
        self.assertEqual(avancement["mesurees"], 1)
        self.assertEqual(avancement["debloquent"], 2)
        self.assertEqual(
            [ligne["gameId"] for ligne in avancement["prochaines"]],
            ["sans-recharge", "avec-recharge"],
        )
        self.assertEqual(avancement["prochaines"][0]["role"], "debloque")
        self.assertEqual(avancement["prochaines"][1]["role"], "affine")
        self.assertEqual(avancement["prochaines"][0]["arme"], "Hache")
        self.assertEqual(avancement["prochaines"][0]["touche"], "clic gauche")

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
