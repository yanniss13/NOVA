"""Valide la syntaxe des fichiers SQL avec le vrai parseur PostgreSQL.

Le propriétaire colle le contenu de `supabase/schema.sql` dans l'éditeur SQL de
Supabase. Les autres tests de ce dossier vérifient le CONTENU de ce fichier par
expressions régulières — ils ne détectent aucune faute de syntaxe. Une virgule
oubliée n'apparaissait donc qu'au moment de l'exécution en production.

`pglast` embarque le parseur de PostgreSQL lui-même, y compris celui des corps
PL/pgSQL : une faute d'un seul caractère dans une fonction est refusée ici.

Installation : `pip install -r requirements-dev.txt`
"""

import pathlib
import unittest

try:
    import pglast
except ImportError as error:  # pragma: no cover - dépendance manquante
    raise SystemExit(
        "pglast est requis pour valider la syntaxe SQL.\n"
        "Installe-le avec : pip install -r requirements-dev.txt"
    ) from error


ROOT = pathlib.Path(__file__).resolve().parents[1]
SQL_FILES = sorted((ROOT / "supabase").glob("*.sql"))


class SqlSyntaxTests(unittest.TestCase):
    def test_the_sql_folder_is_not_empty(self):
        """Un dossier vide ferait passer les autres tests sans rien vérifier."""
        self.assertTrue(SQL_FILES, "aucun fichier .sql trouvé dans supabase/")

    def test_every_file_parses_as_postgresql(self):
        for path in SQL_FILES:
            with self.subTest(fichier=path.name):
                pglast.parse_sql(path.read_text(encoding="utf-8"))

    def test_every_plpgsql_body_parses(self):
        """Le corps d'une fonction est une chaîne littérale : `parse_sql` ne le
        regarde pas. Il faut le parseur PL/pgSQL dédié."""
        for path in SQL_FILES:
            with self.subTest(fichier=path.name):
                pglast.parser.parse_plpgsql_json(path.read_text(encoding="utf-8"))

    def test_the_parser_rejects_a_broken_body(self):
        """Preuve que le test ci-dessus mord : sans elle, on ne saurait pas si le
        parseur regarde vraiment les corps PL/pgSQL."""
        source = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")
        marker = "return new;"
        self.assertIn(marker, source, "ancre de mutation absente")
        broken = source.replace(marker, "return new", 1)
        self.assertNotEqual(broken, source, "la mutation doit s'appliquer")
        with self.assertRaises(pglast.parser.ParseError):
            pglast.parser.parse_plpgsql_json(broken)


if __name__ == "__main__":
    unittest.main()
