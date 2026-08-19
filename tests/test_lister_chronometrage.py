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
            ("Compétence normale", "Q"),
            ("Attaque spéciale", "E"),
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


if __name__ == "__main__":
    unittest.main()
