import importlib.util
import json
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("generate_stats", ROOT / "scripts" / "generate-stats.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


def push(payload):
    """Un morceau RSC tel que le sert Next.js : du JSON dans une chaine JSON."""
    return "self.__next_f.push([1,%s])" % json.dumps(payload)


class FlightPayloadTests(unittest.TestCase):
    def test_chunks_are_joined_in_order(self):
        html = (
            "<html><script>" + push('{"weapons":[{"slug":"ha')
            + "</script><script>" + push('che"}]}')
            + "</script></html>"
        )
        self.assertEqual(module.flight_payload(html), '{"weapons":[{"slug":"hache"}]}')

    def test_non_string_pushes_are_ignored(self):
        html = "self.__next_f.push([1,0])" + push('{"a":1}')
        self.assertEqual(module.flight_payload(html), '{"a":1}')


class BalancedEndTests(unittest.TestCase):
    def test_nested_structures(self):
        text = '{"a":[1,[2,3]],"b":{"c":4}}'
        self.assertEqual(module.balanced_end(text, 0), len(text) - 1)

    def test_brackets_inside_strings_are_not_counted(self):
        text = '["]}}}", "fin"]'
        self.assertEqual(module.balanced_end(text, 0), len(text) - 1)

    def test_escaped_quote_does_not_open_a_string(self):
        text = '["a\\"]", "fin"]'
        self.assertEqual(module.balanced_end(text, 0), len(text) - 1)

    def test_unterminated_structure_returns_minus_one(self):
        self.assertEqual(module.balanced_end('[1,2', 0), -1)


class CollectTests(unittest.TestCase):
    def test_merges_every_occurrence_and_dedupes(self):
        flight = (
            '{"weapons":[{"slug":"a"},{"slug":"b"}]}'
            '{"weapons":[{"slug":"b"},{"slug":"c"}]}'
        )
        self.assertEqual(
            module.collect(flight, "weapons"),
            [{"slug": "a"}, {"slug": "b"}, {"slug": "c"}],
        )

    def test_ignores_a_key_whose_value_is_not_an_array(self):
        self.assertEqual(module.collect('{"weapons":{"slug":"a"}}', "weapons"), [])

    def test_unknown_key_gives_an_empty_list(self):
        self.assertEqual(module.collect('{"weapons":[{"slug":"a"}]}', "armors"), [])

    def test_output_order_does_not_depend_on_chunk_order(self):
        first = (
            '{"weapons":[{"slug":"zeta","value":1}]}'
            '{"weapons":[{"slug":"alpha","value":2}]}'
        )
        second = (
            '{"weapons":[{"value":2,"slug":"alpha"}]}'
            '{"weapons":[{"value":1,"slug":"zeta"}]}'
        )
        self.assertEqual(module.collect(first, "weapons"), module.collect(second, "weapons"))
        self.assertEqual(
            [item["slug"] for item in module.collect(first, "weapons")],
            ["alpha", "zeta"],
        )


class StableSerializationTests(unittest.TestCase):
    def test_canonical_json_ignores_property_order(self):
        self.assertEqual(
            module.canonical_json({"b": 2, "a": 1}),
            module.canonical_json({"a": 1, "b": 2}),
        )

    def test_mapping_is_sorted_case_insensitively(self):
        self.assertEqual(
            list(module.sorted_mapping({"z": 1, "Alpha": 2, "beta": 3})),
            ["Alpha", "beta", "z"],
        )


class FindObjectTests(unittest.TestCase):
    def test_reads_the_label_dictionary(self):
        flight = 'xx"statLabels":{"B_Atk":"ATK","B_Def":"DEF"}yy'
        self.assertEqual(
            module.find_object(flight, "statLabels"),
            {"B_Atk": "ATK", "B_Def": "DEF"},
        )

    def test_absent_key_gives_an_empty_dict(self):
        self.assertEqual(module.find_object('{"a":1}', "statLabels"), {})


class StatLabelsTests(unittest.TestCase):
    def test_collects_codes_from_stat_and_key_fields(self):
        labels = {}
        module.stat_labels(
            {
                "options": [
                    {"stat": "B_Atk_Equip", "nameFr": "Attaque", "nameEn": "Attack"},
                    {"key": "C_Critical_Rate", "nameFr": "Crit", "isRate": True},
                ],
                "nested": {"abilityType": "B_Def", "nameEn": "Defense"},
            },
            labels,
        )
        self.assertEqual(
            labels,
            {
                "B_Atk_Equip": {"fr": "Attaque", "en": "Attack"},
                "C_Critical_Rate": {"fr": "Crit", "taux": True},
                "B_Def": {"en": "Defense"},
            },
        )

    def test_entry_without_any_label_is_skipped(self):
        labels = {}
        module.stat_labels({"stat": "B_Atk", "value": 138}, labels)
        self.assertEqual(labels, {})


if __name__ == "__main__":
    unittest.main()
