# -*- coding: utf-8 -*-
"""Normalisation des passifs et interactions utilisés par le DPS 60 s."""
import importlib.util
import json
import tempfile
import unittest
from unittest import mock
from pathlib import Path


RACINE = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "generate_effets_dps", RACINE / "scripts" / "generate-effets-dps.py"
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)


class EffetsNormalises(unittest.TestCase):
    def test_passif_degats_globaux_et_defense_cible(self):
        degats = _gen.normaliser_effet({
            "id": "hero-passive:bug_sworddual_passive",
            "kind": "hero-passive",
            "textEn": "Back Attacks increase damage by 35%.",
        })
        defense = _gen.normaliser_effet({
            "id": "hero-passive:dreydrin_axe_passive",
            "kind": "hero-passive",
            "textEn": "Attacking a Petrified enemy decreases their Defense "
                      "by 10% for 30 sec.",
        })

        self.assertEqual(degats["regles"][0]["cible"], "global")
        self.assertEqual(degats["regles"][0]["valeur"], 3500)
        self.assertEqual(defense["regles"][0]["stat"], "targetDefRate")
        self.assertEqual(defense["regles"][0]["valeur"], -1000)

    def test_passif_gilthunder_epee_conserve_la_baisse_de_resistance_foudre(self):
        resultat = _gen.normaliser_effet({
            "id": "hero-passive:gilthunder_sword1h_passive",
            "kind": "hero-passive",
            "textEn": "Additionally increases Burst Gauge by 20 with each "
                      "hit on a Shocked enemy. When the hero activates "
                      "Lightning Burst, the enemy's Lightning Resistance "
                      "decreases by 15% for 20 sec.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "resistance-elementaire",
            "element": "thunder",
            "valeur": -1500,
            "condition": "lightning-burst",
            "duree": 20.0,
            "mode": "passif-max",
            "sourceId": "hero-passive:gilthunder_sword1h_passive",
        }])

    def test_passif_gilthunder_bouclier_applique_la_resistance_foudre(self):
        resultat = _gen.normaliser_effet({
            "id": "hero-passive:gilthunder_shield_passive",
            "kind": "hero-passive",
            "textEn": "Decreases the hero's damage taken by 10% while a "
                      "Barrier is active. When the Normal Skill's Lightning "
                      "Barrier is removed, it decreases the Lightning "
                      "Resistance of nearby enemies by 15% for 30 sec.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "resistance-elementaire",
            "element": "thunder",
            "valeur": -1500,
            "condition": "lightning-barrier-removed",
            "duree": 30.0,
            "mode": "passif-max",
            "sourceId": "hero-passive:gilthunder_shield_passive",
        }])

    def test_reset_de_recharge_et_coefficient_seul(self):
        reset = _gen.normaliser_effet({
            "id": "skill:bug_sworddual_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 263% of Attack. Back Attacks "
                      "reset the Special Attack cooldown.",
        })
        simple = _gen.normaliser_effet({
            "id": "skill:bug_axe_jumpatk",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 160% of Attack. 1st hit: 24% "
                      "2nd hit: 26% 3rd hit: 41% 4th hit: 69%",
        })

        self.assertEqual(reset["regles"][0]["type"], "recharge-taux")
        self.assertEqual(reset["regles"][0]["cible"], "special")
        self.assertEqual(reset["regles"][0]["valeur"], 10000)
        self.assertEqual(reset["regles"][0]["declencheur"], "skill")
        self.assertEqual(simple["classification"], "sans-impact-dps")
        self.assertEqual(simple["regles"], [])

    def test_reset_de_la_recharge_de_la_competence_courante(self):
        source = {
            "id": "skill:diane_axe_skill_rmb_ready",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 100% / 307% of Attack based "
                      "on the charge level. A fully charged attack resets the "
                      "cooldown when landing the final strike on an enemy "
                      "affected by Breaker.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-taux",
            "cible": "self",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
            "declencheur": "skill",
            "sourceId": "skill:diane_axe_skill_rmb_ready",
        }])

    def test_reset_de_toutes_les_recharges(self):
        source = {
            "id": "skill:meliodas_axe_skill_q",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 407% of Attack. Resets all "
                      "skill cooldowns if the hero has 3 or more Infernal "
                      "Release stacks.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-taux",
            "cible": "all-skills",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
            "declencheur": "skill",
            "sourceId": "skill:meliodas_axe_skill_q",
        }])

    def test_reset_consecutif_et_bonus_de_la_competence_courante(self):
        source = {
            "id": "potential:tristan:SwordDual:7",
            "textEn": "When landing a Critical Hit with the Special Attack, "
                      "its cooldown is reset and its damage dealt is increased "
                      "by 30% for 10 sec. Cooldown reset can be triggered up "
                      "to 2 times in a row.",
            "statsDejaCalculees": True,
        }

        regles = _gen.normaliser_effet(source)["regles"]
        self.assertEqual(regles[0]["type"], "bonus-degats")
        self.assertEqual(regles[0]["cible"], "self")
        self.assertEqual(regles[1]["type"], "recharge-taux")
        self.assertEqual(regles[1]["maxDeclenchementsConsecutifs"], 2)

    def test_energie_demoniaque_et_liberation_infernale_maximales(self):
        special = _gen.normaliser_effet({
            "id": "skill:meliodas_axe_skill_rmb_ready",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 140% / 302% of Attack based "
                      "on the charge level. Each Darkness projectile inflicts "
                      "Demon Energy for 10 sec. Demon Energy: Inflicts damage "
                      "equal to 120% of Attack when the effect is removed.",
        })
        passif = _gen.normaliser_effet({
            "id": "hero-passive:meliodas_axe_passive",
            "kind": "hero-passive",
            "textEn": "Gains Infernal Release for 10 sec every time Demon "
                      "Energy is removed from the enemy. (Max: 3 times) "
                      "Infernal Release: Increases Darkness damage by 30%.",
        })

        self.assertEqual(special["regles"][0]["applications"], 3)
        self.assertEqual(special["regles"][0]["composantes"], [
            {"base": "atk", "pourcentage": 120.0}
        ])
        self.assertEqual(passif["regles"], [{
            "type": "bonus-degats",
            "cible": "element:dark",
            "valeur": 9000,
            "condition": "infernal-release-max",
            "mode": "passif-max",
            "sourceId": "hero-passive:meliodas_axe_passive",
        }])

    def test_potentiel_meliodas_double_les_degats_energie_demoniaque(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:meliodas:Axe:10",
            "textEn": "Slightly increases the range of the Ultimate Move. "
                      "Increases Demon Energy damage by 100% for 10 sec on "
                      "hit enemies.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"], [{
            "type": "bonus-degats",
            "cible": "status:demon-energy",
            "valeur": 10000,
            "duree": 10.0,
            "condition": "active-max",
            "mode": "passif-max",
            "sourceId": "potential:meliodas:Axe:10",
        }])

    def test_potentiel_meliodas_renforce_la_reduction_de_recharge(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:meliodas:Sword1h:5",
            "textEn": "Decreases the Passive effect's Darkness Burst "
                      "duration reduction by 25%. Additionally increases "
                      "Normal Skill cooldown reduction by 15%. Using the "
                      "Special Attack additionally grants 1 Haste stack(s).",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"], [{
            "type": "recharge-taux",
            "cible": "normal-skill",
            "valeur": 1500,
            "condition": "haste-max",
            "mode": "amplification-reduction",
            "sourceId": "potential:meliodas:Sword1h:5",
        }])

    def test_potentiel_meliodas_reduit_deux_recharges(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:meliodas:SwordDual:5",
            "textEn": "Slightly increases the range of the Special Attack. "
                      "The Special Attack's final strike decreases the "
                      "cooldowns of the Special Attack and Normal Skill by "
                      "50% while Demonic Power is active.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"], [
            {
                "type": "recharge-taux",
                "cible": "self",
                "valeur": 5000,
                "condition": "demonic-power",
                "mode": "passif-max",
                "declencheur": "special",
                "sourceId": "potential:meliodas:SwordDual:5",
            },
            {
                "type": "recharge-taux",
                "cible": "normal-skill",
                "valeur": 5000,
                "condition": "demonic-power",
                "mode": "passif-max",
                "declencheur": "special",
                "sourceId": "potential:meliodas:SwordDual:5",
            },
        ])

    def test_potentiel_merlin_livre_distingue_speciale_et_releve(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:merlin:Book:6",
            "textEn": "Increases Special Attack: Glacial Pierce power by "
                      "50% and additional Tag Skill damage power from Frost "
                      "Mark by 15%.",
            "statsDejaCalculees": True,
        })
        releve = _gen.normaliser_effet({
            "id": "potential:merlin:Book:9",
            "textEn": "Increases the additional Tag Skill damage power "
                      "from Frost Mark by 55%.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"], [
            {
                "type": "bonus-degats",
                "cible": "special",
                "valeur": 5000,
                "mode": "passif-max",
                "sourceId": "potential:merlin:Book:6",
            },
            {
                "type": "bonus-degats",
                "cible": "tag-skill:frost-mark",
                "valeur": 1500,
                "mode": "passif-max",
                "sourceId": "potential:merlin:Book:6",
            },
        ])
        self.assertEqual(releve["regles"][0]["cible"],
                         "tag-skill:frost-mark")
        self.assertEqual(releve["regles"][0]["valeur"], 5500)

    def test_degats_conditionnels_supposes_actifs(self):
        resultat = _gen.normaliser_effet({
            "id": "weapon:test:condition",
            "textEn": "Increases damage dealt to enemies taking DoT by 9.5%.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "bonus-degats",
            "cible": "global",
            "valeur": 950,
            "condition": "active-max",
            "mode": "passif-max",
            "sourceId": "weapon:test:condition",
        }])

    def test_shutdown_gowther_augmente_les_degats_pendant_cinq_secondes(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:gowther_book_skill_r",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 250% of Attack, then "
                      "inflicts Shutdown for 5 sec. Shutdown: Stops enemies. "
                      "Increases damage taken by 100% (Reapplication "
                      "cooldown: 60 sec)",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "bonus-degats",
            "cible": "global",
            "valeur": 10000,
            "condition": "shutdown",
            "duree": 5.0,
            "rechargeInterne": 60.0,
            "mode": "passif-max",
            "sourceId": "skill:gowther_book_skill_r",
        }])

    def test_ultime_charge_gowther_conserve_critique_et_brise_defense(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:gowther_wand_skill_q_ready",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 90% / 350% of Attack "
                      "based on the charge level, dealing increased Crit "
                      "Damage of 100% to enemies with Lightning Burst "
                      "activated. If fully charged and the enemy has a "
                      "barrier, Defense Shatter increases by 25%.",
        })

        self.assertEqual(resultat["regles"], [
            {
                "type": "bonus-critique",
                "stat": "critDamage",
                "valeur": 10000,
                "cible": "self",
                "condition": "lightning-burst",
                "mode": "passif-max",
                "sourceId": "skill:gowther_wand_skill_q_ready",
            },
            {
                "type": "bonus-stat",
                "stat": "defenseShatter",
                "valeur": 2500,
                "cible": "self",
                "condition": "fully-charged-barrier",
                "mode": "passif-max",
                "sourceId": "skill:gowther_wand_skill_q_ready",
            },
        ])

    def test_full_bloom_ne_cumule_pas_les_etats_intermediaires(self):
        normale = _gen.normaliser_effet({
            "id": "skill:king_staff_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 245% of Attack. Increases "
                      "damage dealt by 2% for every 1 Bloom stack. If the "
                      "hero has Full Bloom, damage dealt increases by 40%. "
                      "Bloom: Increases Attack by 1% per stack. Full Bloom: "
                      "Increases Attack by 25% and Defense Shatter by 10%.",
        })
        ultime = _gen.normaliser_effet({
            "id": "skill:king_staff_skill_q",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 433% of Attack. If the hero "
                      "has Full Bloom, damage dealt increases by 50% and "
                      "Crit Chance by 50%. Full Bloom: Increases Attack by "
                      "25% and Defense Shatter by 10%.",
        })
        passif = _gen.normaliser_effet({
            "id": "hero-passive:king_staff_passive",
            "kind": "hero-passive",
            "textEn": "Bloom increases Attack by 1% per stack. At max "
                      "stacks, Bloom is removed and Full Bloom is gained. "
                      "Full Bloom: Increases Attack by 25% and Defense "
                      "Shatter by 10%.",
        })
        speciale = _gen.normaliser_effet({
            "id": "skill:king_staff_skill_rmb",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Gains 1 Bloom stack, then inflicts damage equal to "
                      "166% of Attack. Full Bloom increases Attack by 25% "
                      "and Defense Shatter by 10%.",
        })

        self.assertEqual(normale["regles"], [{
            "type": "bonus-degats", "cible": "self", "valeur": 4000,
            "condition": "full-bloom", "mode": "passif-max",
            "sourceId": "skill:king_staff_skill_e",
        }])
        self.assertEqual(ultime["regles"], [
            {
                "type": "bonus-degats", "cible": "self", "valeur": 5000,
                "condition": "full-bloom", "mode": "passif-max",
                "sourceId": "skill:king_staff_skill_q",
            },
            {
                "type": "bonus-critique", "stat": "critRate",
                "valeur": 5000, "cible": "self",
                "condition": "full-bloom", "mode": "passif-max",
                "sourceId": "skill:king_staff_skill_q",
            },
        ])
        self.assertEqual(passif["regles"], [
            {
                "type": "bonus-stat", "stat": "atk", "valeur": 2500,
                "condition": "full-bloom", "mode": "passif-max",
                "sourceId": "hero-passive:king_staff_passive",
            },
            {
                "type": "bonus-stat", "stat": "defenseShatter",
                "valeur": 1000, "condition": "full-bloom",
                "mode": "passif-max",
                "sourceId": "hero-passive:king_staff_passive",
            },
        ])
        self.assertEqual(speciale["classification"], "sans-impact-dps")

    def test_flare_escanor_remplace_les_cumuls_sunspot(self):
        competence = _gen.normaliser_effet({
            "id": "skill:escanor_axe_skill_e",
            "kind": "skill", "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 279% of Attack and gains "
                      "Sunspot. At max stacks, Sunspot is removed and Flare "
                      "is gained. Flare increases Fire damage by 50%, Max HP "
                      "by 35%, and Pierce by 20%.",
        })
        passif = _gen.normaliser_effet({
            "id": "hero-passive:escanor_axe_passive",
            "kind": "hero-passive",
            "textEn": "Sunspot increases Fire damage by 3% and Max HP by "
                      "1.5% per stack. At max stacks, Sunspot is removed and "
                      "Flare is gained. Flare increases Fire damage by 50%, "
                      "Max HP by 35%, and Pierce by 20%.",
        })

        self.assertEqual(competence["classification"], "sans-impact-dps")
        self.assertEqual([(r["stat"], r["valeur"])
                          for r in passif["regles"] if r["type"] == "bonus-stat"],
                         [("maxHp", 3500), ("pierce", 2000)])
        self.assertEqual(passif["regles"][0]["valeur"], 5000)

    def test_enhanced_surge_remplace_les_cumuls_de_dreyfus(self):
        saut = _gen.normaliser_effet({
            "id": "skill:dreyfus_lance_jumpatk", "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 148% of Attack. Surge "
                      "increases Crit Damage by 8% up to 5 times. At max "
                      "stacks, it changes to Enhanced Surge, which increases "
                      "Crit Damage by 40%.",
        })
        speciale = _gen.normaliser_effet({
            "id": "skill:dreyfus_lance_skill_rmb", "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 180% of Attack and gains "
                      "Surge. Enhanced Surge increases Crit Damage by 40%.",
        })

        self.assertEqual(saut["classification"], "sans-impact-dps")
        self.assertEqual(speciale["regles"], [{
            "type": "bonus-critique", "stat": "critDamage",
            "valeur": 4000, "condition": "enhanced-surge",
            "mode": "passif-max",
            "sourceId": "skill:dreyfus_lance_skill_rmb",
        }])

    def test_merlin_livre_exclut_les_degats_de_lattaque_combinee(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:merlin_book_skill_r", "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Increases Crit Damage by 50%, then inflicts damage "
                      "equal to 394% of Attack. A Combined Attack inflicts "
                      "additional damage equal to 10% of Attack and "
                      "increases Crit Damage by 50%.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "bonus-critique", "stat": "critDamage",
            "valeur": 5000, "condition": "ultimate-active",
            "mode": "passif-max", "sourceId": "skill:merlin_book_skill_r",
        }])

    def test_zone_daisy_separe_zone_graine_et_declenchement(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:daisy_wand_skill_q", "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "For 10 sec, enemies have Wind Resistance decreased "
                      "by 20%, receive Wind Seed every sec, and take damage "
                      "equal to 19% of Attack. Wind Seed decreases Wind "
                      "Resistance by 5% for 20 sec (Max: 4 times) and "
                      "inflicts damage equal to 80% of Attack when struck "
                      "by a Critical Hit. (Cooldown: 3 sec)",
        })

        self.assertEqual(resultat["regles"], [
            {
                "type": "resistance-elementaire", "element": "wind",
                "valeur": -2000, "condition": "zone-active", "duree": 10.0,
                "mode": "passif-max", "sourceId": "skill:daisy_wand_skill_q",
            },
            {
                "type": "resistance-elementaire", "element": "wind",
                "valeur": -2000, "condition": "wind-seed-max", "duree": 20.0,
                "mode": "passif-max", "sourceId": "skill:daisy_wand_skill_q",
            },
            {
                "type": "degats-additionnels",
                "composantes": [{"base": "atk", "pourcentage": 190.0}],
                "declencheur": "ultimate",
                "periodique": {"pourcentageParTick": 19.0, "intervalle": 1.0,
                               "duree": 10.0, "ticks": 10},
                "mode": "passif-max", "sourceId": "skill:daisy_wand_skill_q",
            },
            {
                "type": "degats-additionnels",
                "composantes": [{"base": "atk", "pourcentage": 80.0}],
                "declencheur": "critical-hit", "statut": "wind-seed",
                "rechargeInterne": 3.0, "mode": "passif-max",
                "sourceId": "skill:daisy_wand_skill_q",
            },
        ])

    def test_faille_dimensionnelle_totalise_sept_ticks_et_lexpiration(self):
        resultat = _gen.normaliser_effet({
            "id": "hero-passive:klotho_rapier_passive",
            "kind": "hero-passive",
            "textEn": "Dimensional Rift lasts 15 sec. It inflicts Wind "
                      "damage equal to 10% of Attack as a Critical Hit every "
                      "2 sec and 105% of Attack as a Critical Hit when the "
                      "effect is removed.",
        })

        self.assertEqual(resultat["regles"][0]["composantes"],
                         [{"base": "atk", "pourcentage": 70.0}])
        self.assertEqual(resultat["regles"][0]["periodique"]["ticks"], 7)
        self.assertEqual(resultat["regles"][1]["composantes"],
                         [{"base": "atk", "pourcentage": 105.0}])
        self.assertTrue(all(r["critiqueGaranti"] for r in resultat["regles"]))

    def test_set_avidite_garde_seulement_le_buff_de_remplacement(self):
        quatre = _gen.normaliser_effet({
            "id": "set:equip_t5_greed:four",
            "textEn": "Crit Damage +15% Using the Tag Skill increases Crit "
                      "Chance by 3%. Using it again replaces this with Crit "
                      "Chance +7% and Defense Shatter +7%.",
            "statsDejaCalculees": True,
        })
        sept = _gen.normaliser_effet({
            "id": "set:equip_t5_greed:seven",
            "textEn": "Defense Shatter +10% Using the Tag Skill increases "
                      "Crit Chance by 6%. Using it again replaces this with "
                      "Crit Chance +12% and Defense Shatter +12%.",
            "statsDejaCalculees": True,
        })

        self.assertEqual([(r["stat"], r["valeur"])
                          for r in quatre["regles"]],
                         [("critRate", 700), ("defenseShatter", 700)])
        self.assertEqual([(r["stat"], r["valeur"])
                          for r in sept["regles"]],
                         [("critRate", 1200), ("defenseShatter", 1200)])

    def test_zone_brulante_de_guila_totalise_ses_huit_ticks(self):
        resultat = _gen.normaliser_effet({
            "id": "armor:132809003:EpAcc_Boss_Guila:1",
            "textEn": "Using the Ultimate Move inflicts Fire damage equal "
                      "to 150% of Attack. The area burns for 8 sec and "
                      "inflicts Fire damage equal to 4% of Attack per "
                      "second. (Cooldown: 20 sec)",
        })

        self.assertEqual(resultat["regles"][1]["composantes"],
                         [{"base": "atk", "pourcentage": 32.0}])
        self.assertEqual(resultat["regles"][1]["periodique"]["ticks"], 8)

    def test_degats_infliges_conditionnels_supposes_actifs(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:bug:Axe:10",
            "textEn": "Grants Reaction Immunity while charging the Special "
                      "Attack. Hitting an enemy while the weapon is glowing "
                      "increases damage dealt by 75%.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"][0]["cible"], "global")
        self.assertEqual(resultat["regles"][0]["valeur"], 7500)

    def test_type_de_competence_aleatoire_prend_la_branche_favorable(self):
        resultat = _gen.normaliser_effet({
            "id": "weapon:test:any-skill",
            "textEn": "20% chance to increase a certain skill type's damage "
                      "by 20% for 15 sec.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "bonus-degats",
            "cible": "any-skill",
            "valeur": 2000,
            "mode": "passif-max",
            "sourceId": "weapon:test:any-skill",
        }])

    def test_intervalle_dot_et_bonus_apres_conjonction(self):
        dot = _gen.normaliser_effet({
            "id": "engraving:test:dot",
            "textEn": "The DoT Interval decreases by 30% for 10 sec.",
        })
        crit = _gen.normaliser_effet({
            "id": "weapon:test:conjunction",
            "textEn": "Landing the Special Attack increases Wind Burst "
                      "Efficiency by 30% and Crit Damage by 80% for 16 sec.",
        })

        self.assertEqual(dot["regles"], [{
            "type": "recharge-taux",
            "cible": "periodic",
            "valeur": 3000,
            "mode": "passif-max",
            "sourceId": "engraving:test:dot",
        }])
        self.assertEqual(crit["regles"], [{
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 8000,
            "mode": "passif-max",
            "sourceId": "weapon:test:conjunction",
        }])

    def test_saignement_howzer_totalise_les_vingt_ticks_bornes(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:howzer_lance_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 276% of Attack. Inflicts "
                      "Bleed for 20 sec if the hero has Gust. Bleed: "
                      "Inflicts Wind damage equal to 10% of the damage dealt "
                      "every 1 sec. Decreases Healing Efficiency by 20%.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "degats-additionnels",
            "ratioDegats": 20000,
            "cible": "self",
            "declencheur": "statut",
            "statut": "bleed",
            "periodique": {
                "ratioParTick": 1000,
                "intervalle": 1.0,
                "duree": 20.0,
                "ticks": 20,
            },
            "condition": "gust",
            "mode": "passif-max",
            "sourceId": "skill:howzer_lance_skill_e",
        }])

    def test_saignement_ratio_degats_est_extrait_generiquement(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:tristan_sword1h_skill_rmb",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 103% of Attack, then "
                      "inflicts Bleed for 20 sec. Bleed: Inflicts Wind "
                      "damage equal to 10% of damage dealt every 1 sec. "
                      "Decreases Healing Efficiency by 20%.",
        })

        self.assertEqual(resultat["regles"][0]["ratioDegats"], 20000)
        self.assertEqual(resultat["regles"][0]["periodique"]["ticks"], 20)
        self.assertEqual(resultat["regles"][0]["statut"], "bleed")

    def test_degats_additionnels_indexees_sur_les_pv_restants(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:escanor_axe_skill_rmb_ready",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Immune to Reactions and decreases damage taken by "
                      "30% while the stance is maintained. Inflicts damage "
                      "equal to 150% / 170% / 202% of Attack based on the "
                      "charge level. A fully charged attack inflicts "
                      "additional damage equal to 17% of the hero's "
                      "remaining HP.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "degats-additionnels",
            "composantes": [{"base": "remainingHp", "pourcentage": 17.0}],
            "declencheur": "hit",
            "mode": "passif-max",
            "sourceId": "skill:escanor_axe_skill_rmb_ready",
        }])

    def test_efficacite_de_deluge_seule_ne_change_pas_le_dps_direct(self):
        resultat = _gen.normaliser_effet({
            "id": "weapon:aiming-for-your-heart:1",
            "textEn": "Attacking an enemy without a Burst activated "
                      "increases All Elemental Burst Efficiency by 12% for "
                      "15 sec. (Cooldown: 30 sec)",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_efficacite_de_deluge_indexee_sur_le_crit_reste_hors_dps(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:elizabeth_wand_skill_q",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Increases the hero's Earth Burst Efficiency equal "
                      "to 40% of Crit Damage for 20 sec, then inflicts "
                      "damage equal to 102% of Attack.",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_gain_de_jauge_conditionne_par_une_resistance_reste_hors_dps(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:tristan_sworddual_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 200% of Attack. "
                      "Additionally increases the Burst Gauge by 200 if the "
                      "enemy's Fire Resistance is decreased.",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_resistance_de_brise_de_diane_reste_defensive(self):
        resultat = _gen.normaliser_effet({
            "id": "skill:diane_gauntlets_skill_q",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Gains Heavy Metal for 15 sec, then inflicts damage "
                      "equal to 278% of Attack. Heavy Metal: Becomes immune "
                      "to Reactions. Increases the enemy's Burst Gauge by "
                      "50. Increases the hero's Shatter Resistance by 3% "
                      "for 20 sec when hit. (Max: 10 times)",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_resistance_au_deluge_seule_ne_change_pas_le_dps_direct(self):
        resultat = _gen.normaliser_effet({
            "id": "weapon:black-shadow-greatsword:1",
            "textEn": "Attacking an Incapacitated enemy decreases their "
                      "All Elemental Burst Resistance by 40% for 20 sec. "
                      "(Cooldown: 30 sec)",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_malus_de_mobilite_et_perseverance_ne_change_pas_le_dps(self):
        resultat = _gen.normaliser_effet({
            "id": "armor:132429005:EpAr_Boss_SpiderQueen:1",
            "textEn": "Activating Burst summons spider silk near enemies. "
                      "(Cooldown: 15 sec) Enemies that come into contact "
                      "with spider silk have their Movement Speed decreased "
                      "by 50% and Perseverance decreased by 40 for 8 sec.",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_stat_de_set_deja_calculee_ne_masque_pas_leffet_voisin(self):
        resultat = _gen.normaliser_effet({
            "id": "set:equip_t4_scale_2:two",
            "textEn": "Crit Chance +3% Attacking an enemy whose remaining "
                      "HP is 50% or higher increases the Burst Gauge by 4.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

        resistance = _gen.normaliser_effet({
            "id": "set:armor_t5_undying:two",
            "textEn": "Shatter Resistance +5%",
            "statsDejaCalculees": True,
        })
        self.assertEqual(resistance["classification"], "sans-impact-dps")

    def test_effet_declenche_par_un_allie_est_exclu_du_comparatif_solo(self):
        resultat = _gen.normaliser_effet({
            "id": "set:armor_t5_fortrees:two",
            "textEn": "Attack +10% Inflicts Curse of Self-Destruction on "
                      "the enemy for 30 sec when attacking with a Tag Skill. "
                      "Each time an enemy with the effect is hit by an allied "
                      "hero, has a 3% chance to inflict additional damage "
                      "equal to 40% of the caster's Attack.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["classification"], "non-inclus")
        self.assertEqual(resultat["raison"], "effet-equipe")
        self.assertEqual(resultat["regles"], [])

        lien = _gen.normaliser_effet({
            "id": "skill:gowther_book_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 117% of Attack, then "
                      "inflicts Link for 30 sec. When an enemy affected by "
                      "Link is hit by an allied hero, all linked enemies "
                      "take additional damage equal to 100% of Gowther's "
                      "Attack (Cooldown: 5 sec).",
        })
        self.assertEqual(lien["classification"], "non-inclus")
        self.assertEqual(lien["raison"], "effet-equipe")

    def test_intervalle_de_declenchement_d_un_statut_periodique(self):
        source = {
            "id": "skill:escanor_sword2h_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 289% of Attack, then "
                      "decreases Burn damage trigger interval by 50% for 15 sec.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-taux",
            "cible": "periodic",
            "valeur": 5000,
            "mode": "passif-max",
            "sourceId": "skill:escanor_sword2h_skill_e",
        }])

    def test_bonus_du_heros_apres_une_condition(self):
        source = {
            "id": "skill:diane_axe_skill_e",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 205% of Attack. Attacking "
                      "an enemy with Earth Burst activated increases the "
                      "hero's Crit Damage by 50% for 20 sec.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 5000,
            "mode": "passif-max",
            "sourceId": "skill:diane_axe_skill_e",
        }])

    def test_bonus_du_heros_accepte_l_apostrophe_typographique(self):
        source = {
            "id": "skill:elaine_wand_skill_q",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 202% of Attack. Each Critical "
                      "Hit increases the hero’s Crit Damage by 20% for 5 sec. "
                      "(Max: 3 times)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"][0]["valeur"], 6000)

    def test_recharge_en_pourcentage(self):
        source = {
            "id": "engraving:test:cooldown",
            "textEn": "Landing the Special Attack decreases the Normal Skill "
                      "cooldown by 70%.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-taux",
            "cible": "normal-skill",
            "valeur": 7000,
            "mode": "passif-max",
            "declencheur": "special",
            "sourceId": "engraving:test:cooldown",
        }])

    def test_recharge_conditionnelle_conserve_declencheur_et_recharge_interne(self):
        source = {
            "id": "armor:test:cooldown",
            "kind": "armor",
            "textEn": "Each hit has 5% chance to decrease the hero's Normal "
                      "Skill cooldown by 50%. (Cooldown: 50 sec)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-taux",
            "cible": "normal-skill",
            "valeur": 5000,
            "mode": "passif-max",
            "declencheur": "hit",
            "rechargeInterne": 50.0,
            "sourceId": "armor:test:cooldown",
        }])

    def test_recharge_reconnait_using_a_et_attaque_amelioree(self):
        normal = _gen.normaliser_effet({
            "id": "engraving:test:normal",
            "textEn": "While a ward is active, using a Normal Skill decreases "
                      "the Special Attack cooldown by 100%.",
        })
        speciale = _gen.normaliser_effet({
            "id": "potential:test:7",
            "textEn": "Decreases Normal Skill cooldown by 50% when landing "
                      "the enhanced Special Attack.",
        })

        self.assertEqual(normal["regles"][0]["declencheur"], "normal-skill")
        self.assertEqual(speciale["regles"][0]["declencheur"], "special")

    def test_recharge_conditionnelle_permanente_reste_une_recharge_de_base(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:manny:Staff:7",
            "textEn": "Decreases the Normal Skill cooldown by 11 sec if "
                      "Draco Priestess is active on the hero.",
        })

        self.assertEqual(resultat["regles"], [{
            "type": "recharge-plate",
            "cible": "normal-skill",
            "secondes": 11.0,
            "condition": "active-max",
            "mode": "passif-max",
            "sourceId": "potential:manny:Staff:7",
        }])

    def test_recharge_du_heros_en_secondes(self):
        source = {
            "id": "skill:elaine_wand_skill_q",
            "kind": "skill",
            "coefficientDejaCalcule": True,
            "textEn": "Inflicts damage equal to 402% of Attack. Decreases "
                      "the hero's Normal Skill cooldown by 15 sec.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-plate",
            "cible": "normal-skill",
            "secondes": 15.0,
            "mode": "passif-max",
            "declencheur": "skill",
            "sourceId": "skill:elaine_wand_skill_q",
        }])

    def test_bonus_de_reduction_de_recharge_prend_tous_les_cumuls(self):
        source = {
            "id": "hero-passive:drake_sword2h_passive",
            "textEn": "Using the Normal Skill grants the hero a(n) 10% "
                      "Cooldown Reduction boost for 10 sec. (Max: 3 times)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "recharge-taux",
            "cible": "all-skills",
            "valeur": 3000,
            "condition": "active-max",
            "mode": "passif-max",
            "application": "base",
            "sourceId": "hero-passive:drake_sword2h_passive",
        }])

    def test_bonus_inverse_et_attaque_elementaire(self):
        source = {
            "id": "engraving:test:inverse",
            "textEn": "Ultimate Move Damage increases by 12% for 10 sec. "
                      "(Max: 60%)\nUsing the Normal Skill increases Cold Attack "
                      "by 26% for 20 sec.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [
            {
                "type": "bonus-degats",
                "cible": "ultimate",
                "valeur": 6000,
                "mode": "passif-max",
                "sourceId": "engraving:test:inverse",
            },
            {
                "type": "bonus-stat",
                "stat": "elementalAttack:ice",
                "valeur": 2600,
                "mode": "passif-max",
                "sourceId": "engraving:test:inverse",
            },
        ])

    def test_reduction_de_resistance_cible(self):
        source = {
            "id": "weapon:test:resistance",
            "textEn": "Back Attacks decrease Crit Resistance by 40% for 20 sec.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-critique",
            "stat": "targetCritResist",
            "valeur": -4000,
            "mode": "passif-max",
            "sourceId": "weapon:test:resistance",
        }])

    def test_augmentation_d_une_reduction_de_resistance(self):
        source = {
            "id": "potential:gil-thunder:Shield:7",
            "textEn": "Increases Lightning Resistance reduction by 12% "
                      "when the Lightning Barrier is removed.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "resistance-elementaire",
            "element": "thunder",
            "valeur": -1200,
            "mode": "passif-max",
            "sourceId": "potential:gil-thunder:Shield:7",
        }])

    def test_competence_a_deux_utilisations(self):
        source = {
            "id": "potential:test:SwordDual:5",
            "textEn": "Changes the Special Attack into a skill that can be used "
                      "2 time(s).",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "deblocage-competence",
            "cible": "special",
            "utilisations": 2,
            "mode": "passif-max",
            "sourceId": "potential:test:SwordDual:5",
        }])

    def test_bonus_exclusivement_equipe_reste_non_inclus(self):
        resultat = _gen.normaliser_effet({
            "id": "engraving:test:team",
            "textEn": "Increases all allied heroes' Combined Attack damage by 20%.",
        })

        self.assertEqual(resultat["classification"], "non-inclus")
        self.assertEqual(resultat["regles"], [])

    def test_la_branche_critique_favorable_prend_la_valeur_maximale(self):
        source = {
            "id": "weapon:razorwind-wand:7",
            "textEn": "Critical Hits have 50% chance to increase Crit Damage "
                      "by 50% or 10% for 20 sec. (Cooldown: 20 sec)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 5000,
            "mode": "passif-max",
            "sourceId": "weapon:razorwind-wand:7",
        }])

    def test_deux_cumuls_max_produisent_deux_bonus(self):
        source = {
            "id": "weapon:breath-of-glory-wand:7",
            "textEn": "For 20 sec after using the Special Attack, each hit of "
                      "the Normal Attack increases Attack by 2.2%. (Max: 33%)\n"
                      "Increases All Elemental Damage by 1% each time damage "
                      "is inflicted on the enemy while the effect is active. "
                      "(Max: 20%)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [
            {
                "type": "bonus-stat",
                "stat": "atk",
                "valeur": 3300,
                "mode": "passif-max",
                "sourceId": "weapon:breath-of-glory-wand:7",
            },
            {
                "type": "bonus-degats",
                "cible": "all-elements",
                "valeur": 2000,
                "mode": "passif-max",
                "sourceId": "weapon:breath-of-glory-wand:7",
            },
        ])

    def test_degats_additionnels_conservent_la_recharge_interne(self):
        source = {
            "id": "armor:test:3",
            "textEn": "Each hit has 20% chance to inflict additional damage "
                      "equal to 80% of Attack. (Cooldown: 1 sec)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 80.0}],
            "declencheur": "hit",
            "rechargeInterne": 1.0,
            "mode": "passif-max",
            "sourceId": "armor:test:3",
        }])

    def test_stats_de_potentiel_deja_calculees_ne_sont_pas_doublees(self):
        source = {
            "id": "potential:bug:Axe:1",
            "textEn": "Increases Attack by 3%, Defense by 2%, and Max HP by 1%.",
            "statsDejaCalculees": True,
        }

        resultat = _gen.normaliser_effet(source)

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_une_stat_conditionnelle_du_potentiel_n_est_pas_confondue_avec_sa_base(self):
        source = {
            "id": "potential:gil-thunder:Shield:5",
            "textEn": "Increases the hero's Defense by 5% for 10 sec each "
                      "time the Special Attack stance is maintained for 1 sec. "
                      "(Max: 5 times)",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"][0], {
            "type": "bonus-stat",
            "stat": "def",
            "valeur": 2500,
            "mode": "passif-max",
            "sourceId": "potential:gil-thunder:Shield:5",
        })

    def test_un_effet_offensif_a_cote_des_stats_deja_calculees_reste_lu(self):
        source = {
            "id": "potential:bug:Axe:6",
            "textEn": "Amplifies the Ultimate Attack power by 20%.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-degats",
            "cible": "ultimate",
            "valeur": 2000,
            "mode": "passif-max",
            "sourceId": "potential:bug:Axe:6",
        }])

    def test_puissance_de_competence_ultime(self):
        source = {
            "id": "potential:dreydrin:Axe:6",
            "textEn": "Amplifies Ultimate Move skill power by 20%.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"][0]["cible"], "ultimate")

    def test_augmentation_du_boost_d_attaque_d_une_competence(self):
        source = {
            "id": "potential:dreydrin:Rapier:9",
            "textEn": "Additionally increases the Ultimate Move's Attack "
                      "boost by 10%.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-stat",
            "stat": "atk",
            "valeur": 1000,
            "condition": "ultimate-active",
            "mode": "passif-max",
            "sourceId": "potential:dreydrin:Rapier:9",
        }])

    def test_augmentation_de_stat_gagnee_par_une_competence(self):
        source = {
            "id": "potential:dreydrin:Shield:4",
            "textEn": "Additionally increases the Defense gained from the "
                      "Special Attack by 5%.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"][0], {
            "type": "bonus-stat",
            "stat": "def",
            "valeur": 500,
            "condition": "special-active",
            "mode": "passif-max",
            "sourceId": "potential:dreydrin:Shield:4",
        })

    def test_augmentation_du_bonus_elementaire_gagne_par_une_competence(self):
        source = {
            "id": "potential:tioreh:Staff:4",
            "textEn": "Additionally increases the Earth damage boost gained "
                      "from the Special Attack by 2%.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"][0], {
            "type": "bonus-degats",
            "cible": "element:earth",
            "valeur": 200,
            "condition": "special-active",
            "mode": "passif-max",
            "sourceId": "potential:tioreh:Staff:4",
        })

    def test_augmentation_du_bonus_de_degats_du_passif(self):
        source = {
            "id": "potential:dreyfus:Sword1h:10",
            "textEn": "Additionally increases the Passive's damage boost "
                      "by 15%.",
            "statsDejaCalculees": True,
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"][0]["valeur"], 1500)

    def test_les_stats_deja_calculees_ne_masquent_pas_un_effet_inconnu(self):
        source = {
            "id": "potential:test:Axe:10",
            "textEn": "Increases Attack by 9%. A mysterious effect changes "
                      "Normal Skill cooldown behavior.",
            "statsDejaCalculees": True,
        }

        with self.assertRaisesRegex(
            ValueError, "effet DPS non classe: potential:test:Axe:10"
        ):
            _gen.normaliser_effet(source)

    def test_bonus_categorie_et_cumul_max(self):
        source = {
            "id": "engraving:test:3",
            "textEn": "Each use of the Normal Skill increases Normal Skill "
                      "damage by 6% for 20 sec. (Max: 24%)",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [{
            "type": "bonus-degats",
            "cible": "normal-skill",
            "valeur": 2400,
            "mode": "passif-max",
            "sourceId": "engraving:test:3",
        }])

    def test_reduction_plate_periodique(self):
        source = {
            "id": "potential:merlin:Wand:6",
            "textEn": "While Overload is active, decreases the hero's Normal "
                      "Skill cooldown by 2 sec every 1 sec.",
        }

        self.assertEqual(_gen.normaliser_effet(source)["regles"], [
            {
                "type": "bonus-critique",
                "stat": "critRate",
                "valeur": 3000,
                "condition": "overload",
                "sourceId": "potential:merlin:Wand:6",
            },
            {
                "type": "recharge-periodique",
                "cible": "normal-skill",
                "secondes": 2.0,
                "intervalle": 1.0,
                "condition": "overload",
                "sourceId": "potential:merlin:Wand:6",
            },
        ])

    def test_cinq_charges_electriques_maximisent_les_trois_paliers_de_drake(self):
        p4 = _gen.normaliser_effet({
            "id": "potential:drake:Staff:4",
            "textEn": "Increases Normal Skill damage by 12% for every 1 "
                      "Electric Current stack on the enemy.",
            "statsDejaCalculees": True,
        })
        p7 = _gen.normaliser_effet({
            "id": "potential:drake:Staff:7",
            "textEn": "Landing the Special Attack increases Shock duration "
                      "by 2 sec for every 1 Electric Current stack.",
            "statsDejaCalculees": True,
        })
        p9 = _gen.normaliser_effet({
            "id": "potential:drake:Staff:9",
            "textEn": "Landing the Ultimate Move on an enemy with 5 or more "
                      "Electric Current stacks additionally increases damage "
                      "by 4%.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(p4["regles"][0]["valeur"], 6000)
        self.assertEqual(p7["regles"][0]["type"], "duree-periodique")
        self.assertEqual(p7["regles"][0]["secondes"], 10.0)
        self.assertEqual(p9["regles"][0]["cible"], "ultimate")

    def test_elizabeth_p7_allonge_accelere_et_releve_le_plafond_de_rupture(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:elizabeth:Staff:7",
            "textEn": "The Ultimate Move's duration increases by 5 sec, and "
                      "the hit interval decreases by 0.5 sec. The maximum "
                      "number of Crit Defense reduction stacks from Rupture "
                      "increases by 25.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"][0]["type"], "duree-periodique")
        self.assertEqual(resultat["regles"][0]["intervalleReduction"], 0.5)
        self.assertEqual(resultat["regles"][1]["stat"], "targetCritDmgResist")
        self.assertEqual(resultat["regles"][1]["valeur"], -2000)

    def test_escanor_p10_prend_la_charge_maximale_et_vingt_ticks(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:escanor:Axe:10",
            "textEn": "The Special Attack inflicts damage equal to 5% / 7% / "
                      "12% of Attack + 0.42% / 0.60% / 1.05% of the hero's "
                      "remaining HP every 1 sec for 20 sec based on the charge "
                      "level. Increases the hero's damage dealt to enemies in "
                      "range by 5% / 10% / 20%.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"][0]["composantes"], [
            {"base": "atk", "pourcentage": 240.0},
            {"base": "remainingHp", "pourcentage": 21.0},
        ])
        self.assertEqual(resultat["regles"][1]["valeur"], 2000)

    def test_guila_lance_prend_sa_forme_demoniaque_maximale(self):
        p7 = _gen.normaliser_effet({
            "id": "potential:guila:Lance:7",
            "textEn": "Increases Normal Skill's number of attacks by 2 while "
                      "in Demon Form.",
            "statsDejaCalculees": True,
        })
        p10 = _gen.normaliser_effet({
            "id": "potential:guila:Lance:10",
            "textEn": "Inflicts damage equal to 25% of Attack to nearby "
                      "enemies every 1 sec while in Demon Form.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(
            p7["regles"][0]["composantes"],
            [{"base": "atk", "pourcentage": 552.0}]
        )
        self.assertEqual(p10["regles"][0]["periodique"]["ticks"], 30)
        self.assertEqual(p10["regles"][0]["composantes"][0]["pourcentage"], 750.0)

    def test_zone_de_jericho_applique_dix_reductions_de_resistance(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:jericho:Lance:7",
            "textEn": "The first strike creates a zone for 10 sec which "
                      "decreases the Cold Resistance of enemies in range by "
                      "30% every 1 sec for 40 sec.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["regles"][0]["element"], "ice")
        self.assertEqual(resultat["regles"][0]["valeur"], -30000)

    def test_effet_defensif_est_classe_sans_impact(self):
        resultat = _gen.normaliser_effet({
            "id": "gear:test:1",
            "textEn": "Increases Healing Efficiency by 20%.",
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_duree_d_un_controle_reste_sans_impact_dps(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:dreydrin:Axe:6",
            "textEn": "Additionally increases the duration of the Special "
                      "Attack's Stun by 3 sec.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")

    def test_reduction_de_resistance_au_burst_reste_sans_impact_direct(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:gil-thunder:Sword1h:7",
            "textEn": "Increases the Ultimate Move's Lightning Burst "
                      "Resistance reduction by 10%.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")

    def test_la_jauge_de_magie_reste_sans_impact_quand_la_ressource_est_illimitee(self):
        resultat = _gen.normaliser_effet({
            "id": "potential:hendrickson:SwordDual:5",
            "textEn": "Restores the Magic Gauge by 100 and Tag Gauge by 150 "
                      "when landing a Critical Hit with the Special Attack.",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")

    def test_endurance_rendue_reste_sans_impact_malgre_le_delai_qualifie(self):
        """La parenthese « (Fixed duration, Cooldown: 30 sec) » ne decrit que
        l'effet lui-meme. Tant qu'elle n'etait pas retiree, le mot « cooldown »
        survivait dans le residuel et un pur regain d'endurance restait non
        classe."""
        resultat = _gen.normaliser_effet({
            "id": "set:accessory_t5_tropical:two",
            "textEn": "HP +15%\nRestores Stamina by a fixed amount of 2000 "
                      "every 0.5 sec for 5 sec if you dodge when your Stamina "
                      "is 30% or lower while in combat. "
                      "(Fixed duration, Cooldown: 30 sec)",
            "statsDejaCalculees": True,
        })

        self.assertEqual(resultat["classification"], "sans-impact-dps")
        self.assertEqual(resultat["regles"], [])

    def test_la_tournure_possessive_de_l_ultime_est_rattrapee_par_une_regle(self):
        """« the Ultimate Move's skill power » n'apparait qu'a ce palier ; la
        regle generique lit le libelle nu, sans apostrophe."""
        resultat = _gen.normaliser_effet({
            "id": "potential:derieri:Axe:9",
            "textEn": "Amplifies the Ultimate Move's skill power by 120%, and "
                      "increases the Ultimate Move's Defense Shatter by 20%.",
        })

        self.assertEqual(resultat["classification"], "modelise")
        self.assertEqual(resultat["regles"], [
            {
                "type": "bonus-degats",
                "cible": "ultimate",
                "valeur": 12000,
                "sourceId": "potential:derieri:Axe:9",
            },
            {
                "type": "bonus-stat",
                "stat": "defenseShatter",
                "cible": "ultimate",
                "valeur": 2000,
                "sourceId": "potential:derieri:Axe:9",
            },
        ])

    def test_l_ultime_nomme_des_gantelets_est_rattache_a_sa_categorie(self):
        """« Ultimate Move: Devastator » designe l'ultime de l'arme ; seul son
        nom propre empeche la regle generique de le reconnaitre."""
        for identifiant, valeur in (
            ("potential:derieri:Gauntlets:6", 6500),
            ("potential:derieri:Gauntlets:9", 12500),
        ):
            with self.subTest(identifiant):
                resultat = _gen.normaliser_effet({"id": identifiant, "textEn": ""})

                self.assertEqual(resultat["classification"], "modelise")
                self.assertEqual(resultat["regles"][0], {
                    "type": "bonus-degats",
                    "cible": "ultimate",
                    "valeur": valeur,
                    "sourceId": identifiant,
                })

    def test_un_cumul_absent_du_catalogue_est_annonce_non_inclus(self):
        """Showdown et Strike Combo ne portent aucun gameId simule. Le passif
        n'a pas d'autre contenu offensif : il ne doit ni valoir zero en silence,
        ni recevoir une regle inventee."""
        resultat = _gen.normaliser_effet({
            "id": "hero-passive:derieri_gauntlets_passive",
            "kind": "hero-passive",
            "textEn": "The hero gains Strike Combo for 5 sec with each hit on "
                      "the enemy.",
        })

        self.assertEqual(resultat["classification"], "non-inclus")
        self.assertEqual(resultat["regles"], [])
        self.assertEqual(resultat["raison"], "showdown-hors-catalogue")


class CatalogueLocal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        def charge(nom):
            return json.loads(
                (RACINE / "7ds-stats" / nom).read_text(encoding="utf-8")
            )

        cls.characters = charge("personnages.json")
        cls.weapons = charge("armes.json")
        cls.armors = charge("armures.json")
        cls.engraved = charge("armures-gravees.json")
        cls.sets = charge("sets.json")

    def test_collecte_des_identifiants_uniques_et_indexe_le_schema_ferme(self):
        sources = _gen.collecter_sources(
            self.characters,
            self.weapons,
            self.armors,
            self.engraved,
            self.sets,
            [],
        )
        identifiants = [source["id"] for source in sources]

        self.assertGreaterEqual(len(sources), 1600)
        self.assertEqual(len(identifiants), len(set(identifiants)))

        catalogue = _gen.construire_catalogue(sources)

        self.assertEqual(catalogue["version"], 1)
        self.assertEqual(catalogue["audit"]["inconnus"], 0)
        self.assertEqual(catalogue["audit"]["total"], len(sources))
        for source in catalogue["audit"]["sources"]:
            self.assertIn(source["classification"], _gen.CLASSIFICATIONS)
            for regle in source["regles"]:
                self.assertIn(regle["type"], _gen.TYPES_REGLES)
                self.assertEqual(regle["sourceId"], source["id"])

    def test_catalogue_conserve_les_cles_de_raccordement_du_build(self):
        sources = [
            {
                "id": "skill:merlin_wand_skill_q",
                "kind": "skill",
                "hero": "merlin",
                "weaponType": "Wand",
                "gameId": "merlin_wand_skill_q",
                "textEn": "Inflicts damage equal to 100% of Attack.",
                "coefficientDejaCalcule": True,
            },
            {
                "id": "armor:132000001:passive:1",
                "kind": "armor",
                "gear": "132000001",
                "slug": "test-armor",
                "passive": "passive",
                "level": 1,
                "textEn": "Increases Attack by 10%.",
            },
            {
                "id": "engraving:133000001:passive:1",
                "kind": "engraving",
                "gear": "133000001",
                "slug": "hero-costume-1",
                "passive": "passive",
                "level": 1,
                "textEn": "Increases Attack by 10%.",
            },
        ]

        catalogue = _gen.construire_catalogue(sources)

        self.assertEqual(catalogue["skills"]["merlin_wand_skill_q"]["hero"], "merlin")
        self.assertEqual(catalogue["skills"]["merlin_wand_skill_q"]["weaponType"], "Wand")
        self.assertEqual(catalogue["gear"]["armors"]["132000001"]["slug"], "test-armor")
        self.assertEqual(
            catalogue["gear"]["engravings"]["133000001"]["slug"],
            "hero-costume-1",
        )

    def test_payload_personnage_conserve_passif_et_interaction_active(self):
        passif = {
            "gameId": "merlin_wand_passive",
            "weaponType": "Wand",
            "skillCategory": "PASSIVE",
            "descriptionEn": "Increases Lightning damage by 50%.",
        }
        actif = {
            "gameId": "merlin_wand_skill_q",
            "weaponType": "Wand",
            "skillCategory": "ACTIVE_THIRD",
            "descriptionEn": "Each hit decreases cooldown by 1 sec.",
        }
        payload = json.dumps({"skills": [passif, actif, passif]})

        resultat = _gen.extraire_skills_payload("merlin", payload)

        self.assertEqual([skill["gameId"] for skill in resultat], [
            "merlin_wand_passive",
            "merlin_wand_skill_q",
        ])
        self.assertTrue(all(skill["hero"] == "merlin" for skill in resultat))

    def test_declencheur_des_degats_additionnels_suit_le_texte(self):
        """Un degat additionnel se rattache a la competence que son texte nomme.

        Les textes sont recopies depuis `7ds-stats/personnages.json`. Ils
        etaient tous classes `hit`, que le simulateur lit comme « toute action
        OU tout tick » : les quatre potentiels du Baton de Merlin se
        declenchaient 158 fois en soixante secondes, sur les ticks d'une
        competence qui n'est meme pas la leur, et pesaient 99,5 % du total.
        """
        def declencheur(identifiant, texte):
            resultat = _gen.normaliser_effet({
                "id": identifiant,
                "kind": "potential",
                "textEn": texte,
            })
            degats = [regle for regle in resultat["regles"]
                      if regle["type"] == "degats-additionnels"]
            self.assertTrue(degats, identifiant + " : aucun degat additionnel")
            return degats[0].get("declencheur")

        self.assertEqual(
            declencheur(
                "potential:merlin:Staff:5",
                "The Ultimate Move summons an additional meteorite which "
                "inflicts damage equal to [#1A7331]250%[-] of Attack.",
            ),
            "ultimate",
        )
        # « The Ultimate Move's meteorites inflict… » : ni « using », ni « hits ».
        self.assertEqual(
            declencheur(
                "potential:merlin:Staff:9",
                "The Ultimate Move's meteorites inflict additional damage "
                "equal to [#1A7331]150%[-] of Attack.",
            ),
            "ultimate",
        )
        self.assertEqual(
            declencheur(
                "potential:merlin:Staff:7",
                "Each hit of the Normal Skills additionally increases the "
                "Burst Gauge by [#1A7331]10[-], with the final strike "
                "inflicting damage equal to [#1A7331]180%[-] of Attack.",
            ),
            "normal-skill",
        )
        # Aucune categorie nommee : on ne devine pas, le declencheur reste `hit`.
        self.assertEqual(
            declencheur(
                "potential:essai:Axe:1",
                "Back Attacks inflict additional damage equal to "
                "[#1A7331]40%[-] of Attack.",
            ),
            "hit",
        )
        # Deux categories dans la meme phrase : choisir serait inventer.
        self.assertEqual(
            declencheur(
                "potential:essai:Axe:2",
                "The Normal Skill and the Ultimate Move each inflict "
                "additional damage equal to [#1A7331]60%[-] of Attack.",
            ),
            "hit",
        )

    def test_check_ne_touche_jamais_au_reseau(self):
        with tempfile.TemporaryDirectory() as dossier:
            cible = Path(dossier) / "effets-dps.js"
            cible.write_text(
                "window.SEVEN_DS_EFFETS_DPS = {\"version\":1};\n",
                encoding="utf-8",
            )
            with mock.patch.object(
                _gen, "fetch", side_effect=AssertionError("reseau interdit")
            ):
                code = _gen.main(["--check"], cible=cible)

        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
