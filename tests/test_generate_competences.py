# -*- coding: utf-8 -*-
"""Les regles qui transforment une competence brute en coefficient chiffre.

Toutes les descriptions ci-dessous sont RECOPIEES telles quelles depuis
7dsorigin.app : les balises de couleur, les tournures, les virgules. Une
regle validee sur du texte reecrit ne prouve rien.

Aucun acces reseau : ces tests jugent les regles, pas la disponibilite du
site tiers.
"""
import importlib.util
import unittest
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "generate_competences", RACINE / "scripts" / "generate-competences.py"
)
_gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gen)

V = "[#1A7331]"  # la balise de couleur des nombres, chez eux
B = "[#0F5CD8]"  # celle des noms d'effet
F = "[-]"


def compet(gid, desc, **reste):
    """Une competence brute, dans la forme exacte du payload."""
    base = {
        "gameId": gid,
        "weaponType": "Wand",
        "skillCategory": "NORMAL_SKILL",
        "nameEn": "Essai",
        "descriptionEn": desc,
        "damagePercent": None,
        "hitCount": None,
        "hitDamages": None,
        "damType": "Melee",
        "cooldown": None,
    }
    base.update(reste)
    return base


class DegatsDirects(unittest.TestCase):
    def test_phrase_simple(self):
        """La forme dominante : un coup, un pourcentage, rien d'autre."""
        c = compet(
            "merlin_wand_skill_e_enchant",
            "Inflicts damage equal to %s159%%%s of Attack.\n"
            "Using this attack %s2 time(s)%s within %s7 sec%s allows the use of "
            "Normal Skill: Divine Judgment for %s5 sec%s." % (V, F, V, F, V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (159.0, "direct"))

    def test_un_buff_initial_ne_masque_pas_le_coup_garanti(self):
        c = compet(
            "merlin_book_skill_r",
            "Increases the hero's Crit Damage by %s50%%%s for %s15 sec%s, "
            "then inflicts damage equal to %s394%%%s of Attack."
            % (V, F, V, F, V, F),
        )

        self.assertEqual(_gen.degats_de(c), (394.0, "direct"))

    def test_la_suite_conditionnelle_ne_compte_pas(self):
        """« Divine Judgment » a 329 % s'obtient sous condition : hors calcul.

        La compter reviendrait a promettre un degat que le joueur n'obtient
        qu'en enchainant deux fois en sept secondes."""
        c = compet(
            "merlin_wand_skill_e_enchant",
            "Inflicts damage equal to %s159%%%s of Attack.\n"
            "Divine Judgment\nInflicts damage equal to %s329%%%s of Attack."
            % (V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c)[0], 159.0)

    def test_un_degat_en_deuxieme_phrase_est_chiffre(self):
        """Ruée sauvage ouvre sur une immunité, pas sur son coup.

        Le catalogue la classait « non-chiffree » alors que la somme de ses
        coups publiés — 93 + 118 + 157 + 206 — vaut exactement les 574 %
        annoncés. C'est ce contrôle indépendant qui a fait accepter le repli."""
        c = compet(
            "derieri_gauntlets_skill_q_1",
            "Becomes immune to Reactions while using the Special Attack.\n"
            "Inflicts damage equal to %s574%%%s of Attack. If all hits land, "
            "the hero's Ultimate Move Magic Consumption decreases by %s50%%%s "
            "for %s7 sec%s.\n1st hit: 93%%\n2nd hit: 118%%\n3rd hit: 157%%\n"
            "4th hit: 206%%" % (V, F, V, F, V, F),
            skillCategory="ACTIVE_THIRD",
        )

        self.assertEqual(_gen.degats_de(c), (574.0, "direct"))

    def test_un_buff_d_equipe_avant_le_coup_ne_le_masque_pas(self):
        """Même repli, sur une phrase d'ouverture qui buffe au lieu d'immuniser."""
        c = compet(
            "griamore_cudgel3c_skill_rmb",
            "Removes the hero's %sBarrier%s to increase their Attack by "
            "%s15%%%s for %s20 sec%s.\n"
            "Inflicts damage equal to %s186%%%s of Attack, then gains a "
            "%sBarrier%s equal to %s50%%%s of Attack for %s5 sec%s."
            % (B, F, V, F, V, F, V, F, B, F, V, F, V, F),
            skillCategory="ACTIVE_THIRD",
        )

        self.assertEqual(_gen.degats_de(c), (186.0, "direct"))

    def test_un_maintien_non_borne_reste_exclu_malgre_sa_frappe_finale(self):
        """Le repli ne doit PAS rouvrir ce que la garde des maintiens ferme.

        Tristan annonce 81 % en frappe finale, mais ses ticks de posture ne
        sont pas bornés : le total reste inconnu, donc la compétence reste
        hors calcul. La garde passe avant le repli, et c'est voulu."""
        c = compet(
            "tristan_sword2h_skill_rmb_ready",
            "Inflicts damage equal to %s8%%%s of Attack on nearby enemies "
            "while the stance is maintained. Inflicts damage equal to "
            "%s81%%%s of Attack with the final strike." % (V, F, V, F),
            skillCategory="ACTIVE_THIRD",
        )

        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))

    def test_un_tick_periodique_en_seconde_phrase_ne_chiffre_pas(self):
        """« 3 % toutes les 0,3 s » est un tick, jamais un total.

        Ici l'ancre de DIRECT suffit — la phrase commence par « ※ Pulse: » —
        mais le repli refuse de son côté toute phrase périodique, pour la
        variante qui commencerait bien par « Inflicts »."""
        c = compet(
            "drake_sword1h_skill_e",
            "Grants all allied heroes %sPulse%s for %s20 sec%s.\n\n"
            "※ %sPulse%s: Inflicts damage equal to %s3%%%s of Attack to "
            "nearby enemies every %s0.3 sec%s. Increases Burst Gauge by "
            "%s30%s when hit %s5 time(s)%s."
            % (B, F, V, F, B, F, V, F, V, F, V, F, V, F),
        )

        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))

    def test_le_repli_refuse_deux_candidates(self):
        """Deux coups garantis annonces plus loin : le choix serait arbitraire.

        Aucune competence du jeu n'expose ce cas aujourd'hui. La description
        assemble donc DEUX phrases reelles - l'ouverture de Griamore et les
        deux frappes de Tristan - pour eprouver la garde sans inventer une
        tournure que la source n'ecrit pas."""
        c = compet(
            "essai_deux_candidates",
            "Removes the hero's %sBarrier%s to increase their Attack by "
            "%s15%%%s for %s20 sec%s.\n"
            "Inflicts damage equal to %s186%%%s of Attack.\n"
            "Inflicts damage equal to %s81%%%s of Attack with the final "
            "strike." % (B, F, V, F, V, F, V, F, V, F),
        )

        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))

    def test_le_champ_fait_foi_quand_la_repartition_est_complete(self):
        """`hitDamages` renseigne : sa somme est le total publie."""
        c = compet(
            "dreyfus_sword1h_skill_q",
            "Inflicts damage equal to %s400%%%s of Attack." % (V, F),
            damagePercent="800% ATK",
            hitCount=4,
            hitDamages=["400%", "400%"],
        )
        self.assertEqual(_gen.degats_de(c), (800.0, "direct"))

    def test_le_champ_prime_meme_sur_une_phrase_a_paliers(self):
        """« 166% / 237% selon la charge » : la phrase ne donne pas le total."""
        c = compet(
            "bug_axe_skill_rmb_ready",
            "Inflicts damage equal to %s166%%%s / %s237%%%s of Attack based on "
            "the charge level." % (V, F, V, F),
            damagePercent="1072% ATK",
            hitDamages=["166%", "166%", "166%", "237%", "237%", "100%"],
        )
        self.assertEqual(_gen.degats_de(c)[0], 1072.0)

    def test_la_charge_maximale_rattrape_une_repartition_tronquee(self):
        c = compet(
            "meliodas_axe_skill_rmb_ready",
            "Inflicts damage equal to %s140%%%s / %s302%%%s of Attack based "
            "on the charge level." % (V, F, V, F),
            damagePercent="112% ATK",
            hitCount=3,
            hitDamages=["30%", "82%"],
        )

        self.assertEqual(_gen.degats_de(c), (442.0, "direct"))

    def test_la_description_rattrape_un_champ_absurde(self):
        """31,3 % contre 188 % annonces : le champ est faux, le texte non."""
        c = compet(
            "bug_axe_skill_e",
            "Inflicts damage equal to %s188%%%s of Attack on the enemy and "
            "pulls them to the center." % (V, F),
            damagePercent="31.3% ATK",
            skillCategory="NORMAL_SKILL",
        )
        self.assertEqual(_gen.degats_de(c)[0], 188.0)


class AttaqueSautee(unittest.TestCase):
    """Le saut vaut 25 %, le combo est dans la phrase : le total est la somme.

    Verifie sur 39 des 49 attaques sautees dont la source publie les deux ;
    les dix autres ont une liste de coups tronquee, donc un total sous-estime.
    """

    def test_saut_plus_combo(self):
        c = compet(
            "howzer_lance_jumpatk",
            "Inflicts damage equal to %s158%%%s of Attack." % (V, F),
            skillCategory="NORMAL",
            damagePercent="71% ATK",
            hitDamages=["25%", "22%", "24%"],
        )
        self.assertEqual(_gen.degats_de(c), (183.0, "direct"))

    def test_liste_complete_donne_le_meme_total(self):
        """Quand la source est complete, la regle retrouve son chiffre."""
        c = compet(
            "dreyfus_sword1h_jumpatk",
            "Inflicts damage equal to %s110%%%s of Attack.\n"
            "1st hit: 26%%\n2nd hit: 31%%\n3rd hit: 53%%" % (V, F),
            skillCategory="NORMAL",
            damagePercent="135% ATK",
            hitDamages=["25%", "26%", "31%", "53%"],
        )
        self.assertEqual(_gen.degats_de(c)[0], 135.0)

    def test_tous_les_x_coups_n_est_pas_periodique(self):
        """« every 5 hit(s) » parle de declenchement, pas de degats repetes."""
        c = compet(
            "klotho_book_jumpatk",
            "Inflicts damage equal to %s81%%%s of Attack, granting all allied "
            "heroes %s1%s Runestone stack(s) for %s30 sec%s every %s5 hit(s)%s."
            % (V, F, V, F, V, F, V, F),
            skillCategory="NORMAL",
            damagePercent="25% ATK",
        )
        self.assertEqual(_gen.degats_de(c), (106.0, "direct"))


class DegatsSurLaDuree(unittest.TestCase):
    """Un degat periodique borne se totalise : tick x nombre de ticks."""

    def test_intervalle_puis_duree(self):
        c = compet(
            "merlin_book_skill_e",
            "Inflicts damage equal to %s22%%%s of Attack every %s0.5 sec%s to "
            "enemies in range for %s5 sec%s, also applying %sFrost Marks%s for "
            "%s10 sec%s." % (V, F, V, F, V, F, B, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (220.0, "duree"))

    def test_duree_annoncee_avant(self):
        c = compet(
            "diane_cudgel3c_skill_e",
            "For %s10 sec%s, decreases the Movement Speed of enemies in range "
            "by %s40%%%s and inflicts damage equal to %s16%%%s of Attack every "
            "%s1 sec%s." % (V, F, V, F, V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (160.0, "duree"))

    def test_zone_qui_dure(self):
        c = compet(
            "klotho_staff_skill_e",
            "Creates a zone which lasts %s7.5 sec%s, inflicting damage equal "
            "to %s5%%%s of Attack to enemies in range every %s0.5 sec%s and "
            "pulling them in toward the center." % (V, F, V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (75.0, "duree"))

    def test_ticks_arrondis_vers_le_bas(self):
        """8 sec par pas de 1,5 : cinq ticks, pas 5,33."""
        c = compet(
            "elaine_staff_skill_e",
            "Inflicts damage equal to %s33%%%s of Attack to enemies in range "
            "every %s1.5 sec%s for %s8 sec%s." % (V, F, V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (165.0, "duree"))

    def test_duree_indefinie_reste_non_chiffree(self):
        """« tant que la posture tient » n'a pas de fin : rien a totaliser."""
        c = compet(
            "elaine_wand_skill_rmb_ready",
            "Inflicts damage equal to %s66%%%s of Attack every %s1 sec%s while "
            "the stance is maintained." % (V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))


class RienAChiffrer(unittest.TestCase):
    def test_soin_pur(self):
        c = compet(
            "elaine_staff_skill_q",
            "Restores HP of allies in range by %s10%%%s of Max HP + %s50%%%s "
            "of Attack every %s1 sec%s for %s5 sec%s." % (V, F, V, F, V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))

    def test_degat_indexe_sur_la_defense(self):
        """Notre formule part de l'ATK : un degat en % de DEF n'y entre pas."""
        c = compet(
            "dreydrin_shield_skill_e",
            "Deals damage equal to %s120%%%s of Defense." % (V, F),
        )
        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))

    def test_buff_sans_degat(self):
        c = compet(
            "bug_sworddual_skill_rmb",
            "Increases the hero's Darkness damage by %s10%%%s for %s20 sec%s."
            % (V, F, V, F),
        )
        self.assertEqual(_gen.degats_de(c), (None, "non-chiffree"))


class CatalogueDps(unittest.TestCase):
    def test_intervalle_decimal_ne_perd_pas_un_tick(self):
        """Six secondes par pas de 0,2 donnent exactement trente ticks."""
        c = compet(
            "gowther_staff_skill_q",
            "Inflicts damage equal to 3% of Attack every 0.2 sec for 6 sec.",
        )

        self.assertEqual(_gen.periodique_de(c)["ticks"], 30)

    def test_posture_bornee_utilise_sa_duree_et_sa_frappe_finale(self):
        """La durée du buff annexe ne doit pas remplacer celle de la posture."""
        c = compet(
            "daisy_wand_skill_rmb_ready",
            "Inflicts damage equal to 11% of Attack on nearby enemies every "
            "0.8 sec and increases all allied heroes' Crit Chance by 5% for "
            "40 sec while the stance is maintained.\nMaintains stance for up "
            "to 5 sec. When maintained for the maximum duration, the stance "
            "is removed, inflicting damage equal to 32% of Attack.",
            hitDamages=["11%", "32%"],
        )

        compact = _gen.compacte_competence(c)

        self.assertEqual(compact["periodique"]["duree"], 5.0)
        self.assertEqual(compact["periodique"]["ticks"], 6)

    def test_un_soin_periodique_n_est_pas_un_degat_pv(self):
        """Une base chiffrée de soin ne doit jamais entrer dans le DPS."""
        c = compet(
            "hendrickson_sword1h_skill_q",
            "Restores HP of allies in range by 0.5% of Max HP + 25% of Attack "
            "every 1 sec for 10 sec.",
        )

        compact = _gen.compacte_competence(c)

        self.assertIsNone(compact["periodique"])
        self.assertEqual(compact["composantes"], [])

    def test_une_premiere_frappe_n_est_pas_le_tick(self):
        """« 203 % puis 20 % toutes les 1 s » : le tick vaut 20, jamais 203.

        Le module cherchait le premier « damage equal to » de la phrase et le
        prenait pour le tick, sans regarder lequel portait le « every N sec ».
        L'ultime de Derieri valait 2030 % - dix fois sa frappe d'ouverture -
        au lieu de 403 %, soit cinq fois trop.
        """
        c = compet(
            "derieri_sword2h_skill_r",
            "The first hit inflicts damage equal to %s203%%%s of Attack + "
            "%s21%%%s of remaining HP, then inflicts damage equal to %s20%%%s "
            "of Attack + %s3%%%s of the whole team's remaining HP every "
            "%s1 sec%s to enemies in range for %s10 sec%s."
            % (V, F, V, F, V, F, V, F, V, F, V, F),
            skillCategory="ULTIMATE",
        )

        compact = _gen.compacte_competence(c)

        self.assertEqual(compact["periodique"]["pourcentageParTick"], 20.0)
        self.assertEqual(compact["periodique"]["ticks"], 10)
        # 20 x 10 ticks + la frappe d'ouverture, portee UNE fois.
        self.assertEqual(compact["pourcentage"], 403.0)
        self.assertEqual(compact["composantes"], [
            {"base": "atk", "pourcentage": 403.0}
        ])

    def test_un_buff_indexe_sur_l_attaque_n_est_pas_un_degat(self):
        """« Fire Attack by 30% of the hero's Attack » buffe, ne frappe pas.

        Les composantes se lisaient au fil du texte, donc tout pourcentage
        indexe sur l'attaque devenait des degats : Rending Slam frappait pour
        144 % la ou la description en annonce 114.
        """
        c = compet(
            "derieri_sword2h_skill_e",
            "Increases all allied heroes' Fire Attack by %s30%%%s of the "
            "hero's Attack (Max: %s3000%s) for %s40 sec%s, then inflicts "
            "damage equal to %s114%%%s of Attack + %s13%%%s of the whole "
            "team's remaining HP." % (V, F, V, F, V, F, V, F, V, F),
        )

        compact = _gen.compacte_competence(c)

        self.assertEqual(compact["pourcentage"], 114.0)
        self.assertEqual(compact["composantes"], [
            {"base": "atk", "pourcentage": 114.0}
        ])

    def test_une_jauge_remplie_en_pourcent_d_attaque_n_est_pas_un_degat(self):
        """La jauge de Deluge se remplit ; elle n'inflige rien.

        Seule une composante rattachee a « damage equal to », et liee aux
        suivantes par « + », compte. La virgule de « , then additionally
        increases » ferme la chaine.
        """
        c = compet(
            "elizabeth_wand_skill_e",
            "Inflicts damage equal to %s157%%%s of Attack, then additionally "
            "increases the Burst Gauge by %s3%%%s of Attack. (Max: %s500%s)"
            % (V, F, V, F, V, F),
            damagePercent="157% ATK",
            hitCount=1,
        )

        compact = _gen.compacte_competence(c)

        self.assertEqual(compact["pourcentage"], 157.0)
        self.assertEqual(compact["composantes"], [
            {"base": "atk", "pourcentage": 157.0}
        ])

    def test_le_total_affiche_est_celui_qui_est_calcule(self):
        """`pourcentage` et `composantes` ne peuvent pas se contredire.

        La vue lit `pourcentage`, le moteur lit `composantes` : les laisser
        diverger affiche un chiffre et en applique un autre. Flash Fruit
        annoncait 43 % et frappait pour 98, parce que les deux chemins ne
        classaient pas les memes sources dans le meme ordre.
        """
        c = compet(
            "daisy_wand_skill_rmb_ready",
            "Inflicts damage equal to 11% of Attack on nearby enemies every "
            "0.8 sec and increases all allied heroes' Crit Chance by 5% for "
            "40 sec while the stance is maintained.\nMaintains stance for up "
            "to 5 sec. When maintained for the maximum duration, the stance "
            "is removed, inflicting damage equal to 32% of Attack.",
            damagePercent="43% ATK",
            hitCount=2,
            hitDamages=["11%", "32%"],
        )

        compact = _gen.compacte_competence(c)

        # La repartition publiee par la source fait foi, comme partout
        # ailleurs : sa somme vaut le total qu'elle affiche (43 % ATK).
        self.assertEqual(compact["pourcentage"], 43.0)
        self.assertEqual(compact["composantes"], [
            {"base": "atk", "pourcentage": 43.0}
        ])
        # Le rythme reste decrit, lui : c'est ce qui fait vivre le DPS.
        self.assertEqual(compact["periodique"]["duree"], 5.0)
        self.assertEqual(compact["periodique"]["ticks"], 6)

    def test_parse_les_recharges_sevencodex_sans_decaler_les_competences(self):
        """Un bloc sans CD ne doit pas voler celui du bloc suivant."""
        page = """
        <div class="skill skill--normal">
          <h4 class="skill__name">Electrostream</h4>
          <div class="skill__kpis">
            <span class="kpi"><span class="kpi__l">Hits</span>
            <span class="kpi__v">8</span></span>
          </div>
        </div><div class="skill skill--active">
          <h4 class="skill__name">Judgment of Thunder</h4>
          <div class="skill__kpis">
            <span class="kpi"><span class="kpi__l">CD</span>
            <span class="kpi__v">19.9 s</span></span>
          </div>
        </div><div class="skill skill--special">
          <h4 class="skill__name">Electromagnetic Field</h4>
          <div class="skill__kpis">
            <span class="kpi"><span class="kpi__l">CD</span>
            <span class="kpi__v">16.5 s</span></span>
          </div>
        </div>
        """

        self.assertEqual(_gen.recharges_sevencodex(page), {
            "Judgment of Thunder": 19.9,
            "Electromagnetic Field": 16.5,
        })

    def test_recharge_precise_prime_sur_la_valeur_arrondie(self):
        """Le DPS utilise le temps combat précis quand la fiche le publie."""
        c = compet(
            "merlin_wand_skill_q",
            "Inflicts damage equal to 16% of Attack.",
            nameEn="Electromagnetic Field",
            cooldown=16,
        )

        compact = _gen.compacte_competence(
            c, {"Electromagnetic Field": 16.5}
        )

        self.assertEqual(compact["recharge"], 16.5)

    def test_les_cinq_maintiens_non_bornes_restent_exclus(self):
        """Une répartition interne ne borne pas la durée d'un maintien."""
        identifiants = (
            "elaine_wand_skill_rmb_ready",
            "howzer_cudgel3c_skill_e_ready",
            "klotho_rapier_skill_rmb_ready",
            "tioreh_book_skill_e",
            "tristan_sword2h_skill_rmb_ready",
        )
        for identifiant in identifiants:
            with self.subTest(identifiant=identifiant):
                c = compet(
                    identifiant,
                    "Inflicts damage equal to 10% of Attack while the stance "
                    "is maintained, then 46% of Attack on the final hit.",
                    hitCount=9,
                    hitDamages=["70%", "46%"],
                )

                compact = _gen.compacte_competence(c)

                self.assertIsNone(compact["pourcentage"])
                self.assertEqual(compact["nature"], "non-chiffree")
                self.assertEqual(compact["composantes"], [])

    def test_recharge_decimale_et_periodique_borne(self):
        """Le DPS conserve le rythme des ticks et la recharge publiee."""
        c = compet(
            "merlin_wand_skill_q",
            "Inflicts damage equal to 16% of Attack every 0.5 sec "
            "to enemies in range for 5 sec.",
            skillCategory="ACTIVE_THIRD",
            cooldown=16.5,
        )

        compact = _gen.compacte_competence(c)

        self.assertEqual(compact["recharge"], 16.5)
        self.assertEqual(compact["composantes"], [
            {"base": "atk", "pourcentage": 160.0}
        ])
        self.assertEqual(compact["periodique"], {
            "base": "atk",
            "pourcentageParTick": 16.0,
            "intervalle": 0.5,
            "duree": 5.0,
            "ticks": 10,
        })

    def test_attaque_et_defense_restent_deux_composantes(self):
        """Une composante DEF ne doit pas etre presentee comme de l'ATK."""
        c = compet(
            "dreydrin_shield_skill_e",
            "Inflicts damage equal to 70% of Attack + 30% of Defense.",
            cooldown=12,
        )

        self.assertEqual(_gen.compacte_competence(c)["composantes"], [
            {"base": "atk", "pourcentage": 70.0},
            {"base": "def", "pourcentage": 30.0},
        ])

    def test_pv_restants_utilisent_une_base_distincte(self):
        """Les PV restants ne doivent pas etre confondus avec les PV max."""
        c = compet(
            "escanor_axe_skill_q",
            "The first hit inflicts damage equal to %s397%%%s of Attack, and "
            "additional damage equal to %s30%%%s of the hero's remaining HP "
            "when attacking an enemy with %sFire Burst%s activated."
            % (V, F, V, F, B, F),
            skillCategory="ULTIMATE",
            cooldown=10,
        )

        self.assertEqual(_gen.compacte_competence(c)["composantes"], [
            {"base": "atk", "pourcentage": 397.0},
            {"base": "remainingHp", "pourcentage": 30.0},
        ])

if __name__ == "__main__":
    unittest.main()
