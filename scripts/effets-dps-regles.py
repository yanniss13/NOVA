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
    # Le buff 302073010 donne `Ice_Add` en mode `Per` : l'attaque de Froid
    # gagne 10 % de l'ATTAQUE du heros, en points, pas un taux. Le moteur ne
    # sait pas indexer l'attaque elementaire sur une autre statistique, et la
    # regle qui vivait ici multipliait l'attaque de Froid par 1,10 — un tout
    # autre calcul. Absente vaut mieux que fausse.
    "skill:merlin_book_skill_e": "attaque-elementaire-indexee-sur-l-attaque",
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
    # --- Version 2.0, 26 aout 2026 ---------------------------------------
    #
    # Les trois mecaniques de Ban sont desormais ETABLIES, lues dans
    # Table/Buff/BuffTable le 27 aout 2026 (le hotfix du 26 au soir a livre
    # les traductions francaises qui manquaient). Ce qui reste dehors ne
    # l'est plus par ignorance, mais parce que le schema ne sait pas
    # l'exprimer — chaque entree dit laquelle de ces deux raisons s'applique.
    #
    #   « Breche »       buffs 302293005 et 302293024, poses sur la CIBLE :
    #                    resistance au Deluge -20 %, degats subis +25 %
    #                    (302293005) ou +55 % (302293024). Le champ
    #                    ActiveElement vaut None dans les deux : la hausse
    #                    porte sur TOUS les degats subis, contrairement au
    #                    texte francais qui dit « degats des Tenebres ».
    #   « Detournement » buff 302293021 : F_Def -> Dark_Res -20 %, soit une
    #                    reduction indexee sur la defense, pas un taux plat.
    #   « Berserker »    buffs 302292002 / 302292021 (+20 % degats crit.) et
    #                    302292024 (+50 %). Voir REGLES_SPECIFIQUES.
    #
    # Breche et Detournement sont des etats poses sur l'ENNEMI. Le
    # comparateur compare des builds a cible constante : un debuff de cible
    # profite a toute l'equipe et sort de son perimetre, comme les
    # `effet-equipe` plus haut.
    "potential:ban:Cudgel3c:9": "degats-supplementaires-d-ultime-hors-schema",
    "skill:ban_gauntlets_jumpatk": "breche-debuff-sur-la-cible",
    # T7 majore de 30 % les degats des Tenebres subis via Breche : c'est un
    # renfort de debuff, il vit sur la cible comme Breche elle-meme.
    "potential:ban:Gauntlets:7": "breche-debuff-sur-la-cible",
    # T10 donne du percement de defense a TOUS les heros allies.
    "potential:ban:Gauntlets:10": "effet-equipe",
    # Le passif des gantelets pose Detournement, puis majore les degats crit.
    # de la SEULE attaque normale de 100 %. `bonus-critique` ne porte pas de
    # champ de portee — `cible` n'existe que pour les regles de recharge — et
    # une regle `critDamage` globale majorerait aussi les competences et
    # l'ultime. Surestimer serait pire que taire : un membre reglerait son
    # stuff sur un chiffre faux.
    "hero-passive:ban_gauntlets_passive": "crit-limite-a-l-attaque-normale",
    "potential:ban:Gauntlets:5": "crit-limite-a-l-attaque-normale",
    # T5 retire 2 des 4 touches requises pour ameliorer la competence normale
    # en Berserker. C'est une cadence de declenchement, pas une statistique :
    # rien a majorer, seulement un palier atteint plus tot.
    "potential:ban:Sword2h:5": "cadence-de-declenchement-hors-schema",
    # T4 (+20 %) et T9 (+65 %) majorent la competence normale AMELIOREE.
    # Celle-ci n'a pas d'entree propre dans data/competences.js : le jeu la
    # decrit a l'interieur du texte de `ban_sword2h_skill_e` au lieu de lui
    # donner un identifiant. Sans cible a majorer, la regle generique les
    # laissait tomber en `sans-impact-dps` — un contresens, car ces deux
    # potentiels augmentent bel et bien des degats. `non-inclus` dit la
    # verite : l'effet existe, le comparateur ne sait pas ou l'accrocher.
    "potential:ban:Sword2h:4": "competence-normale-amelioree-hors-catalogue",
    "potential:ban:Sword2h:9": "competence-normale-amelioree-hors-catalogue",
    # La gravure du costume « Instinct incisif » de Bug, sorti avec la 2.0 :
    # elle applique Malediction sur un ennemi Provoque et donne +18 % de
    # degats des Tenebres a TOUTE l'equipe. La part d'equipe sort du perimetre
    # du comparateur, comme les autres `effet-equipe` ci-dessus.
    "engraving:133065003:EpEq_Bug_D:1": "effet-equipe",
    "engraving:133065003:EpEq_Bug_D:2": "effet-equipe",
    "engraving:133065003:EpEq_Bug_D:3": "effet-equipe",
}

REGLES_SPECIFIQUES = {
    # --- Attaque elementaire contre degats elementaires -------------------
    #
    # Le jeu distingue TROIS statistiques la ou la prose n'en nomme qu'une :
    #
    #   <Element>_Add          l'attaque elementaire, en points
    #   <Element>_Rate         le taux qui multiplie cette attaque
    #   <Element>_Element_Rate le taux de DEGATS de cet element
    #
    # `_regle_bonus` traduit « X Attack +n% » par un taux sur l'attaque
    # elementaire. Les quatre entrees ci-dessous corrigent des cas ou la
    # description du jeu dit « attaque » alors que le code de la statistique,
    # lu dans Table/Buff/BuffTable, dit `_Element_Rate`. La table fait foi :
    # pour Drake, la description de la COMPETENCE dit « attaque de Foudre »
    # et celle du BUFF dit « Degats de Foudre » — le jeu se contredit, seul le
    # code tranche.
    #
    # Les valeurs sont donnees au maximum de cumuls, ce que `passif-max`
    # suppose. Verification : node outils/fmodel/verifier-buffs-officiels.js
    "skill:meliodas_sword1h_skill_rmb": [
        # buff 302051001 « Hate » : Dark_Element_Rate 1500, 2 cumuls, 7 s
        {
            "type": "bonus-degats",
            "cible": "element:dark",
            "valeur": 3000,
            "mode": "passif-max",
        },
        {
            "type": "recharge-taux",
            "cible": "self",
            "valeur": 10000,
            "condition": "active-max",
            "mode": "passif-max",
            "declencheur": "skill",
        },
    ],
    "skill:drake_sword2h_skill_e_1": [
        # buff 302262001 « Magie du roi » : Thunder_Element_Rate 1000 et
        # C_Critical_Rate 500, 3 cumuls, 20 s. Les deux montent par cumul.
        #
        # Le meme buff porte aussi UltimateSkill_DamAdd_Rate 3000, que NI la
        # description de la competence NI celle du buff ne mentionnent. A +30 %
        # par cumul ce serait +90 % de degats d'ultime : trop gros pour etre
        # publie sur la foi d'un champ que deux textes ignorent. A mesurer.
        {
            "type": "bonus-degats",
            "cible": "element:thunder",
            "valeur": 3000,
            "mode": "passif-max",
        },
        {
            "type": "bonus-critique",
            "stat": "critRate",
            "valeur": 1500,
            "mode": "passif-max",
        },
    ],
    # Klotho : la part `bonus-degats` etait juste (Ice_Element_Rate 1000 et
    # 4000). Seule la ligne d'attaque elementaire sautait : le jeu l'indexe sur
    # les PV max du porteur avec un plafond (`Ice_Add` en `Per`), mecanique que
    # le moteur ne sait pas exprimer. On garde ce qui est vrai, on retire le
    # reste plutot que de publier un chiffre faux.
    "skill:klotho_book_jumpatk": [
        {
            "type": "bonus-degats",
            "cible": "element:ice",
            "valeur": 1000,
            "mode": "passif-max",
        }
    ],
    "skill:klotho_book_skill_rmb": [
        {
            "type": "bonus-degats",
            "cible": "element:ice",
            "valeur": 1000,
            "mode": "passif-max",
        }
    ],
    "skill:klotho_book_skill_q_a": [
        {
            "type": "bonus-degats",
            "cible": "element:ice",
            "valeur": 4000,
            "mode": "passif-max",
        }
    ],
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
    # --- Ban : la Chaine, un cumul pose sur l'ennemi ----------------------
    #
    # `ban_cudgel3c_passive` (« Rythme jubilatoire ») pose un cumul de Chaine
    # chaque fois que Ban touche trois fois la meme cible, jusqu'a 5, pour 20 s.
    # Chaque cumul vaut deja +2 % de percement et +6 % de chances crit., et
    # plusieurs effets du nunchaku s'indexent en plus dessus.
    #
    # Le cycle d'auto-attaque au nunchaku fait 4 coups : 15 coups saturent la
    # pile, et la fenetre de 20 s la maintient. Confirme par un joueur le
    # 26 aout 2026 : sur un boss, Ban reste sature en permanence. Les effets
    # indexes sur la Chaine sont donc donnes AU MAXIMUM, en `passif-max`,
    # comme ceux de Merlin baguette et de Drake.
    "potential:ban:Cudgel3c:5": [
        # 10 % de degats crit. par cumul, 15 s, plafonne a 5 fois.
        # La portee d'ultime de la premiere phrase ne se chiffre pas.
        {
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 5000,
            "mode": "passif-max",
        }
    ],
    # --- Ban : l'etat Berserker, permanent par arithmetique ---------------
    #
    # L'ultime de l'epee a deux mains (« Hurlement inebranlable ») fait
    # entrer en [Berserker] pendant 12 s. Sa recharge est de 10 s.
    # 12 > 10 : joue sur recharge, l'etat ne retombe jamais. Ce n'est pas
    # une hypothese de confort comme la saturation de Chaine plus haut,
    # c'est une soustraction — et c'est ce qui autorise `passif-max` ici.
    # Si un patch allonge la recharge au-dela de 12 s, cette regle devient
    # fausse : la verification tient dans data/competences.js, entree
    # `ban_sword2h_skill_r`.
    #
    # Le potentiel 6 porte trois phrases, une seule chiffre des degats :
    # l'immunite aux reactions et les -20 % de degats subis sont defensifs.
    # Restent les « 30 % supplementaires » de degats crit. en Berserker.
    # Ils s'ajoutent aux +20 % du passif d'arme et aux +30 % de la
    # competence normale amelioree, deja portes par le buff 302292024
    # (C_Critical_Dam_Rate = 5000 = 2000 + 3000) — d'ou le choix de ne
    # compter ICI que la part propre au potentiel.
    "potential:ban:Sword2h:6": [
        {
            "type": "bonus-critique",
            "stat": "critDamage",
            "valeur": 3000,
            "condition": "berserker",
            "mode": "passif-max",
        }
    ],
    # T10 : +15 % de percement de defense en Berserker. Meme raisonnement de
    # permanence que le T6 ci-dessus. La portee de la premiere phrase ne se
    # chiffre pas ; la regle generique laissait donc tomber le potentiel
    # entier en `sans-impact-dps` alors qu'il porte une stat offensive.
    "potential:ban:Sword2h:10": [
        {
            "type": "bonus-stat",
            "stat": "defenseShatter",
            "valeur": 1500,
            "condition": "berserker",
            "mode": "passif-max",
        }
    ],
}
