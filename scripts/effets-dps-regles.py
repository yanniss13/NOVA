# -*- coding: utf-8 -*-
"""Schéma fermé et exceptions auditées des effets du comparateur DPS."""

TYPES_REGLES = {
    "bonus-stat",
    "bonus-degats",
    "bonus-critique",
    "recharge-plate",
    "recharge-taux",
    "recharge-periodique",
    "recharge-par-impact",
    "duree-periodique",
    "cumul-degats",
    "deblocage-sequence",
    "degats-additionnels",
    "resistance-elementaire",
    "deblocage-competence",
    "remplacement-competence",
}

CLASSIFICATIONS = {"modelise", "sans-impact-dps", "non-inclus"}

SANS_IMPACT_SPECIFIQUES = {
    "skill:dreyfus_lance_jumpatk": "enhanced-surge-modelise-sur-la-speciale",
    "skill:escanor_axe_skill_e": "flare-modelise-sur-le-passif",
    "skill:king_staff_skill_rmb": "full-bloom-modelise-sur-le-passif",
    "skill:elizabeth_wand_skill_q": "efficacite-de-deluge",
    "skill:diane_gauntlets_skill_q": "effets-defensifs-et-jauge-de-deluge",
    "skill:tristan_sworddual_skill_e": "jauge-de-deluge",
    "potential:elaine:Book:4": "buff-suppose-actif",
    "potential:elizabeth:Staff:5": "ressources-illimitees",
    "potential:guila:Rapier:7": "ressources-illimitees-et-brulure-deja-maximale",
}

NON_INCLUS_SPECIFIQUES = {
    "skill:gowther_book_skill_e": "effet-equipe",
    "set:armor_t5_fortrees:two": "effet-equipe",
    "skill:elaine_wand_skill_rmb_ready": "maintien-non-borne",
    "skill:howzer_cudgel3c_skill_e_ready": "maintien-non-borne",
    "skill:klotho_rapier_skill_rmb_ready": "maintien-non-borne",
    "skill:tioreh_book_skill_e": "maintien-non-borne",
    "skill:tristan_sword2h_skill_rmb_ready": "maintien-non-borne",
    "skill:klotho_staff_skill_q": "animation-attaque-normale",
    "skill:daisy_shield_jumpatk": "animation-attaque-normale",
    "potential:tioreh:Book:4": "animation-attaque-normale",
    "potential:tioreh:Book:7": "animation-attaque-normale",
    "potential:klotho:Staff:9": "animation-attaque-normale",
    "hero-passive:derieri_gauntlets_passive": "showdown-hors-catalogue",
    "potential:elizabeth:Staff:10": "buff-equipe-et-animation-attaque-normale",
    "potential:jericho:SwordDual:5": "animation-attaque-normale",
    "potential:manny:SwordDual:5": "animation-attaque-normale",
}

REGLES_SPECIFIQUES = {
    "potential:elaine:Book:6": [
        {
            "type": "recharge-plate",
            "cible": "normal-skill",
            "secondes": 5.0,
            "condition": "active-max",
            "mode": "passif-max",
        }
    ],
    "potential:manny:Staff:7": [
        {
            "type": "recharge-plate",
            "cible": "normal-skill",
            "secondes": 11.0,
            "condition": "active-max",
            "mode": "passif-max",
        }
    ],
    "armor:132809003:EpAcc_Boss_Guila:1": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 150.0}],
            "declencheur": "ultimate",
            "rechargeInterne": 20.0,
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 32.0}],
            "declencheur": "zone",
            "periodique": {
                "pourcentageParTick": 4.0,
                "intervalle": 1.0,
                "duree": 8.0,
                "ticks": 8,
            },
            "rechargeInterne": 20.0,
            "mode": "passif-max",
        },
    ],
    "armor:132809003:EpAcc_Boss_Guila:2": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 175.0}],
            "declencheur": "ultimate",
            "rechargeInterne": 20.0,
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 48.0}],
            "declencheur": "zone",
            "periodique": {
                "pourcentageParTick": 6.0,
                "intervalle": 1.0,
                "duree": 8.0,
                "ticks": 8,
            },
            "rechargeInterne": 20.0,
            "mode": "passif-max",
        },
    ],
    "armor:132809003:EpAcc_Boss_Guila:3": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 200.0}],
            "declencheur": "ultimate",
            "rechargeInterne": 20.0,
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 64.0}],
            "declencheur": "zone",
            "periodique": {
                "pourcentageParTick": 8.0,
                "intervalle": 1.0,
                "duree": 8.0,
                "ticks": 8,
            },
            "rechargeInterne": 20.0,
            "mode": "passif-max",
        },
    ],
    "set:equip_t5_greed:four": [
        {
            "type": "bonus-critique",
            "stat": "critRate",
            "valeur": 700,
            "condition": "tag-replacement-active",
            "mode": "passif-max",
        },
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "valeur": 700,
            "condition": "tag-replacement-active",
            "mode": "passif-max",
        },
    ],
    "set:equip_t5_greed:seven": [
        {
            "type": "bonus-critique",
            "stat": "critRate",
            "valeur": 1200,
            "condition": "tag-replacement-active",
            "mode": "passif-max",
        },
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "valeur": 1200,
            "condition": "tag-replacement-active",
            "mode": "passif-max",
        },
    ],
    "skill:daisy_wand_skill_q": [
        {
            "type": "resistance-elementaire",
            "element": "wind",
            "valeur": -2000,
            "condition": "zone-active",
            "duree": 10.0,
            "mode": "passif-max",
        },
        {
            "type": "resistance-elementaire",
            "element": "wind",
            "valeur": -2000,
            "condition": "wind-seed-max",
            "duree": 20.0,
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 190.0}],
            "declencheur": "ultimate",
            "periodique": {
                "pourcentageParTick": 19.0,
                "intervalle": 1.0,
                "duree": 10.0,
                "ticks": 10,
            },
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 80.0}],
            "declencheur": "critical-hit",
            "statut": "wind-seed",
            "rechargeInterne": 3.0,
            "mode": "passif-max",
        },
    ],
    "hero-passive:klotho_rapier_passive": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 70.0}],
            "declencheur": "statut",
            "statut": "dimensional-rift",
            "periodique": {
                "pourcentageParTick": 10.0,
                "intervalle": 2.0,
                "duree": 15.0,
                "ticks": 7,
            },
            "critiqueGaranti": True,
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 105.0}],
            "declencheur": "expiration-statut",
            "statut": "dimensional-rift",
            "critiqueGaranti": True,
            "mode": "passif-max",
        },
    ],
    "skill:dreyfus_lance_skill_rmb": [
        {
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 4000,
            "condition": "enhanced-surge",
            "mode": "passif-max",
        }
    ],
    "hero-passive:escanor_axe_passive": [
        {
            "type": "bonus-degats",
            "cible": "element:fire",
            "valeur": 5000,
            "condition": "flare",
            "mode": "passif-max",
        },
        {
            "type": "bonus-stat",
            "stat": "maxHp",
            "valeur": 3500,
            "condition": "flare",
            "mode": "passif-max",
        },
        {
            "type": "bonus-stat",
            "stat": "pierce",
            "valeur": 2000,
            "condition": "flare",
            "mode": "passif-max",
        },
    ],
    "skill:king_staff_skill_e": [
        {
            "type": "bonus-degats",
            "cible": "self",
            "valeur": 4000,
            "condition": "full-bloom",
            "mode": "passif-max",
        }
    ],
    "skill:king_staff_skill_q": [
        {
            "type": "bonus-degats",
            "cible": "self",
            "valeur": 5000,
            "condition": "full-bloom",
            "mode": "passif-max",
        },
        {
            "type": "bonus-critique",
            "stat": "critRate",
            "valeur": 5000,
            "cible": "self",
            "condition": "full-bloom",
            "mode": "passif-max",
        },
    ],
    "hero-passive:king_staff_passive": [
        {
            "type": "bonus-stat",
            "stat": "atk",
            "valeur": 2500,
            "condition": "full-bloom",
            "mode": "passif-max",
        },
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "valeur": 1000,
            "condition": "full-bloom",
            "mode": "passif-max",
        },
    ],
    "skill:merlin_book_skill_r": [
        {
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 5000,
            "condition": "ultimate-active",
            "mode": "passif-max",
        }
    ],
    "skill:gowther_wand_skill_q_ready": [
        {
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 10000,
            "cible": "self",
            "condition": "lightning-burst",
            "mode": "passif-max",
        },
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "valeur": 2500,
            "cible": "self",
            "condition": "fully-charged-barrier",
            "mode": "passif-max",
        },
    ],
    "skill:gowther_book_skill_r": [
        {
            "type": "bonus-degats",
            "cible": "global",
            "valeur": 10000,
            "condition": "shutdown",
            "duree": 5.0,
            "rechargeInterne": 60.0,
            "mode": "passif-max",
        }
    ],
    "skill:howzer_lance_skill_e": [
        {
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
        }
    ],
    "hero-passive:gilthunder_sword1h_passive": [
        {
            "type": "resistance-elementaire",
            "element": "thunder",
            "valeur": -1500,
            "condition": "lightning-burst",
            "duree": 20.0,
            "mode": "passif-max",
        }
    ],
    "hero-passive:gilthunder_shield_passive": [
        {
            "type": "resistance-elementaire",
            "element": "thunder",
            "valeur": -1500,
            "condition": "lightning-barrier-removed",
            "duree": 30.0,
            "mode": "passif-max",
        }
    ],
    "potential:merlin:Book:9": [
        {
            "type": "bonus-degats",
            "cible": "tag-skill:frost-mark",
            "valeur": 5500,
            "mode": "passif-max",
        }
    ],
    "potential:merlin:Book:6": [
        {
            "type": "bonus-degats",
            "cible": "special",
            "valeur": 5000,
            "mode": "passif-max",
        },
        {
            "type": "bonus-degats",
            "cible": "tag-skill:frost-mark",
            "valeur": 1500,
            "mode": "passif-max",
        },
    ],
    "potential:meliodas:SwordDual:5": [
        {
            "type": "recharge-taux",
            "cible": "self",
            "valeur": 5000,
            "condition": "demonic-power",
            "mode": "passif-max",
            "declencheur": "special",
        },
        {
            "type": "recharge-taux",
            "cible": "normal-skill",
            "valeur": 5000,
            "condition": "demonic-power",
            "mode": "passif-max",
            "declencheur": "special",
        },
    ],
    "potential:meliodas:Sword1h:5": [
        {
            "type": "recharge-taux",
            "cible": "normal-skill",
            "valeur": 1500,
            "condition": "haste-max",
            "mode": "amplification-reduction",
        }
    ],
    "potential:meliodas:Axe:10": [
        {
            "type": "bonus-degats",
            "cible": "status:demon-energy",
            "valeur": 10000,
            "duree": 10.0,
            "condition": "active-max",
            "mode": "passif-max",
        }
    ],
    "potential:jericho:Lance:7": [
        {
            "type": "resistance-elementaire",
            "element": "ice",
            "valeur": -30000,
            "applications": 10,
            "intervalle": 1.0,
            "dureeZone": 10.0,
            "condition": "zone-max",
            "mode": "passif-max",
        }
    ],
    "skill:guila_rapier_skill_e": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 36.0}],
            "declencheur": "skill",
            "condition": "demon-form",
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 150.0}],
            "declencheur": "skill",
            "condition": "burn-defense-max",
            "mode": "passif-max",
        },
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 300.0}],
            "declencheur": "statut",
            "statut": "burn",
            "cumulsMax": 5,
            "periodique": {
                "pourcentageParTick": 15.0,
                "intervalle": 1.0,
                "duree": 20.0,
                "ticks": 20,
            },
            "mode": "passif-max",
        },
    ],
    "skill:guila_rapier_skill_rmb": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 38.0}],
            "declencheur": "skill",
            "condition": "demon-form",
            "mode": "passif-max",
        }
    ],
    "hero-passive:guila_rapier_passive": [
        {
            "type": "bonus-degats",
            "cible": "global",
            "valeur": 10000,
            "condition": "burn-defense-max",
            "mode": "passif-max",
        }
    ],
    "potential:guila:Rapier:6": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 75.0}],
            "declencheur": "normal-skill",
            "condition": "demon-form",
            "mode": "passif-max",
        }
    ],
    "potential:guila:Rapier:10": [
        {
            "type": "bonus-degats",
            "cible": "status:burn",
            "valeur": 5000,
            "condition": "demonic-flame",
            "mode": "passif-max",
        },
        {
            "type": "recharge-taux",
            "cible": "status:burn",
            "valeur": 3000,
            "condition": "demonic-flame",
            "mode": "passif-max",
        },
    ],
    "skill:guila_lance_skill_e": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 30.0}],
            "declencheur": "skill",
            "condition": "demon-form",
            "mode": "passif-max",
        },
        {
            "type": "bonus-degats",
            "cible": "self",
            "valeur": 3000,
            "condition": "fire-burst",
            "mode": "passif-max",
        },
    ],
    "potential:guila:Lance:7": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 552.0}],
            "declencheur": "normal-skill",
            "condition": "demon-form",
            "mode": "passif-max",
        }
    ],
    "potential:guila:Lance:10": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 750.0}],
            "declencheur": "ultimate",
            "periodique": {
                "pourcentageParTick": 25.0,
                "intervalle": 1.0,
                "duree": 30.0,
                "ticks": 30,
            },
            "condition": "demon-form",
            "mode": "passif-max",
        }
    ],
    "potential:escanor:Axe:10": [
        {
            "type": "degats-additionnels",
            "composantes": [
                {"base": "atk", "pourcentage": 240.0},
                {"base": "remainingHp", "pourcentage": 21.0},
            ],
            "declencheur": "skill",
            "periodique": {
                "intervalle": 1.0,
                "duree": 20.0,
                "ticks": 20,
            },
            "condition": "charge-max",
            "mode": "passif-max",
        },
        {
            "type": "bonus-degats",
            "cible": "global",
            "valeur": 2000,
            "condition": "charge-max",
            "mode": "passif-max",
        },
    ],
    "potential:elizabeth:Staff:9": [
        {
            "type": "bonus-degats",
            "cible": "status:rupture",
            "valeur": 10000,
            "condition": "rupture-active",
            "mode": "passif-max",
        }
    ],
    "potential:elizabeth:Staff:7": [
        {
            "type": "duree-periodique",
            "cible": "ultimate",
            "secondes": 5.0,
            "intervalleReduction": 0.5,
            "mode": "passif-max",
        },
        {
            "type": "bonus-critique",
            "stat": "targetCritDmgResist",
            "valeur": -2000,
            "condition": "rupture-max",
            "mode": "passif-max",
        },
    ],
    "potential:drake:Staff:4": [
        {
            "type": "bonus-degats",
            "cible": "normal-skill",
            "valeur": 6000,
            "condition": "electric-current-max",
            "mode": "passif-max",
        }
    ],
    "potential:drake:Staff:7": [
        {
            "type": "duree-periodique",
            "statut": "shock",
            "secondes": 10.0,
            "cumulsMax": 5,
            "condition": "electric-current-max",
            "mode": "passif-max",
        }
    ],
    "potential:drake:Staff:9": [
        {
            "type": "bonus-degats",
            "cible": "ultimate",
            "valeur": 400,
            "condition": "electric-current-max",
            "mode": "passif-max",
        }
    ],
    # « the Ultimate Move's skill power » : seule occurrence de la tournure
    # possessive dans la source. La regle generique lit « Ultimate Move skill
    # power », sans apostrophe, et laissait donc ce palier non classe.
    # Le percement de defense est porte par l'ultime, non par le heros : la
    # cible le dit, meme si le simulateur ne modelise pas encore cette stat.
    # Provenance : 7ds-stats/personnages.json, potentiel 9 de Derieri a la hache.
    # « Ultimate Move: Devastator » nomme l'ultime des gantelets ; le catalogue
    # le connait sous « Combo Star ». La regle generique attend le libelle nu
    # « Ultimate Move power », le nom propre l'en empeche.
    # Strike Combo et Showdown sont des cumuls absents du catalogue de
    # competences : leur part reste hors regle, comme au palier 5 ou seul le
    # degat critique est modelise et le Percement laisse de cote.
    # Provenance : 7ds-stats/personnages.json, potentiels de Derieri aux gantelets.
    "potential:derieri:Gauntlets:6": [
        {
            "type": "bonus-degats",
            "cible": "ultimate",
            "valeur": 6500,
        }
    ],
    "potential:derieri:Gauntlets:9": [
        {
            "type": "bonus-degats",
            "cible": "ultimate",
            "valeur": 12500,
        },
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "valeur": 2000,
            "condition": "strike-combo-max",
            "mode": "passif-max",
        },
    ],
    "potential:derieri:Axe:9": [
        {
            "type": "bonus-degats",
            "cible": "ultimate",
            "valeur": 12000,
        },
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "cible": "ultimate",
            "valeur": 2000,
        },
    ],
    "potential:daisy:Book:9": [
        {
            "type": "bonus-degats",
            "cible": "daisy_book_skill_e",
            "valeur": 3500,
            "mode": "passif-max",
        }
    ],
    "skill:meliodas_axe_skill_rmb_ready": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 120.0}],
            "declencheur": "application-statut",
            "statut": "demon-energy",
            "applications": 3,
            "duree": 10.0,
            "mode": "passif-max",
        }
    ],
    "skill:meliodas_axe_skill_tag": [
        {
            "type": "degats-additionnels",
            "composantes": [{"base": "atk", "pourcentage": 120.0}],
            "declencheur": "application-statut",
            "statut": "demon-energy",
            "applications": 1,
            "duree": 10.0,
            "mode": "passif-max",
        }
    ],
    "hero-passive:meliodas_axe_passive": [
        {
            "type": "bonus-degats",
            "cible": "element:dark",
            "valeur": 9000,
            "condition": "infernal-release-max",
            "mode": "passif-max",
        }
    ],
    "skill:merlin_wand_skill_q": [
        {
            "type": "recharge-par-impact",
            "cible": "normal-skill",
            "secondes": 1.0,
            "declencheur": "tick",
        },
        {
            "type": "cumul-degats",
            "cible": "normal-skill",
            "valeurParCumul": 1000,
            "cumulsMax": 5,
            "declencheur": "tick",
            "duree": 20.0,
        },
    ],
    "skill:merlin_wand_skill_e_enchant": [
        {
            "type": "deblocage-sequence",
            "usages": 2,
            "fenetre": 7.0,
            "competence": "merlin_wand_divine_judgment",
            "duree": 5.0,
        }
    ],
    "skill:merlin_wand_divine_judgment": [
        {
            "type": "recharge-plate",
            "cible": "normal-skill",
            "secondes": 5.0,
        }
    ],
    "potential:merlin:Wand:5": [
        {
            "type": "recharge-plate",
            "cible": "normal-skill",
            "secondes": 4.0,
        }
    ],
    "potential:merlin:Wand:6": [
        {
            "type": "bonus-critique",
            "stat": "critRate",
            "valeur": 3000,
            "condition": "overload",
        },
        {
            "type": "recharge-periodique",
            "cible": "normal-skill",
            "secondes": 2.0,
            "intervalle": 1.0,
            "condition": "overload",
        },
    ],
    "potential:merlin:Wand:7": [
        {
            "type": "deblocage-competence",
            "declencheur": "special",
            "competence": "merlin_wand_divine_judgment",
            "duree": 7.0,
        },
        {
            "type": "resistance-elementaire",
            "element": "thunder",
            "valeur": -3000,
            "duree": 20.0,
        },
    ],
    "potential:merlin:Wand:9": [
        {
            "type": "bonus-degats",
            "cible": "merlin_wand_divine_judgment",
            "valeur": 7000,
        }
    ],
    "potential:merlin:Wand:10": [
        {
            "type": "remplacement-competence",
            "declencheur": "ultimate",
            "cible": "special",
            "competence": "merlin_wand_overdrive",
            "duree": 15.0,
        }
    ],
}
