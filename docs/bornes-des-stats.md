# Bornes des 223 statistiques du jeu

Lues dans `Actor/StatInfoTable`, débloquée par le usmap 1.8. Build `1.8.1.2`,
export du 25 août 2026. Ce sont les bornes que **le moteur applique** à chaque
statistique, indépendamment de la valeur calculée.

**Unités** : `ten-thousandths` = dix-millièmes (`1000` vaut 10 %), `flat` = valeur brute.

Version exploitable par script : `7ds-stats/bornes-stats.json`, indexée par le
code du jeu.

## Les bornes qui pèsent sur un calcul de dégâts

Un plancher négatif signifie que la statistique peut retrancher. `-10000` en
dix-millièmes vaut **−100 %** : la contribution s'annule entièrement.

| Code du jeu | Min | Max | Unité | Libellé |
|---|---:|---:|---|---|
| `t_maxhp` | -999999999 | 999999999 | brut | — |
| `allelement_add` | -999999 | 999999 | brut | Attaque de tous les éléments |
| `allelement_res` | -999999 | 999999 | brut | Défense de tous les éléments |
| `breath_max_add` | -999999 | 999999 | brut | Durée max. de la plongée |
| `dark_add` | -999999 | 999999 | brut | Attaque des Ténèbres |
| `dark_res` | -999999 | 999999 | brut | Défense des Ténèbres |
| `default_add` | -999999 | 999999 | brut | Attaque physique |
| `default_res` | -999999 | 999999 | brut | Défense physique |
| `earth_add` | -999999 | 999999 | brut | Attaque de Terre |
| `earth_res` | -999999 | 999999 | brut | Défense de Terre |
| `fire_add` | -999999 | 999999 | brut | Attaque de Feu |
| `fire_res` | -999999 | 999999 | brut | Défense de Feu |
| `h_healpower` | -999999 | 999999 | brut | Pouvoir de guérison |
| `holy_add` | -999999 | 999999 | brut | Attaque du Sacré |
| `holy_res` | -999999 | 999999 | brut | Défense du Sacré |
| `ice_add` | -999999 | 999999 | brut | Attaque de Froid |
| `ice_res` | -999999 | 999999 | brut | Défense de Froid |
| `maxsp_rate` | -999999 | 999999 | ‰ | — |
| `recoverysp_rate` | -999999 | 999999 | ‰ | — |
| `s_skillrecycle_rate` | -999999 | 10000 | ‰ | Réduction de temps de recharge |
| `thunder_add` | -999999 | 999999 | brut | Attaque de Foudre |
| `thunder_res` | -999999 | 999999 | brut | Défense de Foudre |
| `wind_add` | -999999 | 999999 | brut | Attaque de Vent |
| `wind_res` | -999999 | 999999 | brut | Défense de Vent |
| `s_glidingstamina_rate` | -15000 | 999999 | ‰ | — |
| `s_petflyingstamina_rate` | -15000 | 999999 | ‰ | — |
| `breath_recoverytime_rate` | -10000 | 999999 | ‰ | — |
| `burstactivation_duration_rate` | -10000 | 999999 | ‰ | — |
| `dark_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse aux Ténèbres  |
| `default_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse physique  |
| `earth_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse à la Terre  |
| `final_all_dam_rate` | -10000 | 999999 | ‰ | Taux de dégâts finaux |
| `fire_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse au Feu  |
| `h_healpower_rate` | -10000 | 999999 | ‰ | Efficacité de guérison |
| `h_healpower_tick_rate` | -10000 | 999999 | ‰ | Augmentation de la guérison naturelle |
| `h_healreceive_rate` | -10000 | 999999 | ‰ | Augmentation des soins reçus |
| `holy_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse au Sacré  |
| `ice_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse au Froid  |
| `mf_assim_rate` | -10000 | 10000 | ‰ | Taux de conversion magique |
| `mf_chargeeffic_rate` | -10000 | 999999 | ‰ | Efficacité de recharge de la magie |
| `mf_costreduce_rate_ultimateskill` | -10000 | 10000 | brut | Taux de réduction de magie de l'attaque ultime |
| `mf_protect_rate` | -10000 | 10000 | ‰ | Protection magique |
| `p_shield_rate` | -10000 | 999999 | ‰ | Efficacité des barrières |
| `thunder_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse à la Foudre  |
| `tickdam_period_rate` | -10000 | 999999 | ‰ | Délai d'infliction des dégâts sur la durée |
| `tickdam_rate` | -10000 | 999999 | ‰ | Efficacité des dégâts sur la durée |
| `wind_weakness_rate` | -10000 | 999999 | ‰ | Dégâts de faiblesse au Vent  |
| `a_block_rate` | -9999 | 10000 | ‰ | Taux de parade |
| `allelement_rate` | -9999 | 999999 | ‰ | Augmentation de toutes les attaques élémentaires |
| `allelement_res_rate` | -9999 | 999999 | ‰ | Augmentation de toutes les défenses élémentaires |
| `breath_addrate` | -9999 | 999999 | ‰ | Capacité pulmonaire |
| `buff_time_rate` | -9999 | 999999 | ‰ | Efficacité de la durée des bonus |
| `burst_gauge_extra` | -9999 | 999999 | brut | Bonus de jauge de Déluge |
| `dark_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque des Ténèbres  |
| `dark_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense des Ténèbres  |
| `debuff_time_rate` | -9999 | 999999 | ‰ | Efficacité de la durée des malus |
| `default_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque physique  |
| `default_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense physique  |
| `earth_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque de Terre  |
| `earth_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense de Terre  |
| `fire_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque de Feu  |
| `fire_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense de Feu  |
| `h_revivalheal_rate` | -9999 | 999999 | ‰ | — |
| `holy_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque du Sacré  |
| `holy_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense du Sacré  |
| `i_atkadd_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque |
| `i_defadd_rate` | -9999 | 999999 | ‰ | Augmentation de la défense |
| `i_maxhpadd_rate` | -9999 | 999999 | ‰ | Augmentation des PV |
| `ice_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque de Froid  |
| `ice_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense de Froid  |
| `m_detectdisadd_rate` | -9999 | 999999 | ‰ | Augmentation de la portée de détection |
| `makingtime_res` | -9999 | 999999 | brut | — |
| `makingtime_res_rate` | -9999 | 999999 | ‰ | — |
| `recoverystaminaamount` | -9999 | 999999 | brut | Récupération d'endurance |
| `s_glidingspdadd_rate` | -9999 | 999999 | ‰ | — |
| `s_movespdadd_rate` | -9999 | 10000 | ‰ | Vitesse de déplacement |
| `s_petflyingspdadd_rate` | -9999 | 999999 | ‰ | — |
| `s_swimspdadd_rate` | -9999 | 999999 | ‰ | — |
| `s_swimstamina_rate` | -9999 | 999999 | ‰ | — |
| `s_townspdadd_rate` | -9999 | 10000 | ‰ | Vitesse de déplacement en ville |
| `s_underwaterspdadd_rate` | -9999 | 999999 | ‰ | — |
| `threaten_rate` | -9999 | 999999 | ‰ | Taux de menace |
| `thunder_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque de Foudre  |
| `thunder_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense de Foudre  |
| `wind_rate` | -9999 | 999999 | ‰ | Augmentation de l'attaque de Vent  |
| `wind_res_rate` | -9999 | 999999 | ‰ | Augmentation de la défense de Vent  |
| `temp_cold_res` | -3 | 3 | brut | Résistance au froid |
| `temp_hot_res` | -3 | 3 | brut | Résistance au chaud |
| `b_atk_lvadd` | 0 | 1 | brut | Augmentation de l'attaque au niveau supérieur |
| `b_def_lvadd` | 0 | 1 | brut | Augmentation de la défense au niveau supérieur |
| `b_maxhp_lvadd` | 0 | 1 | brut | Augmentation des PV au niveau supérieur |
| `c_critical_rate` | 0 | 10000 | ‰ | Chances crit. |
| `c_critical_resrate` | 0 | 10000 | ‰ | Résistance crit. |
| `d_block_damres_rate` | 0 | 10000 | ‰ | Persévérance défense |
| `d_normal_damres_rate` | 0 | 1 | ‰ | Résistance aux dégâts d'attaque normale |
| `d_protect_cur_rate` | 0 | 10000 | ‰ | Percement de défense |
| `d_protect_curres_rate` | 0 | 10000 | ‰ | Résistance au percement |
| `d_skill_damres_rate` | 0 | 1 | ‰ | Résistance aux dégâts de compétence d'attaque |
| `h_vampireheal_rate` | 0 | 2500 | ‰ | Vampirisme |
| `i_normal_damadd_rate` | 0 | 1 | ‰ | Augmentation des dégâts d'attaque normale |
| `i_skill_damadd_rate` | 0 | 1 | ‰ | Augmentation des dégâts, compétence d'attaque |
| `max_stamina` | 0 | 10000 | brut | Endurance |
| `mf_stackmax` | 0 | 7 | brut | Jauge de magie |
| `skillrangeangle` | 0 | 360 | brut | — |
| `venom_add` | 0 | 1 | brut | — |
| `venom_element_rate` | 0 | 1 | ‰ | — |
| `venom_element_res_rate` | 0 | 1 | ‰ | — |
| `venom_rate` | 0 | 1 | ‰ | — |
| `venom_res` | 0 | 1 | brut | — |
| `venom_res_rate` | 0 | 1 | ‰ | — |
| `venom_value` | 0 | 1 | brut | — |
| `water_add` | 0 | 1 | brut | — |
| `water_element_rate` | 0 | 1 | ‰ | — |
| `water_element_res_rate` | 0 | 1 | ‰ | — |
| `water_rate` | 0 | 1 | ‰ | — |
| `water_res` | 0 | 1 | brut | — |
| `water_res_rate` | 0 | 1 | ‰ | — |
| `water_value` | 0 | 1 | brut | — |
| `move_spd` | 100 | 10000 | brut | — |

## Les 223, par groupe d’interface

`Type` dit ce que le jeu montre : `Main` en tête de fiche, `Sub` en second,
`NonHide` dans le détail, `Hide` jamais — ces dernières existent pour le moteur
seul, ce qui ne veut pas dire qu'elles ne comptent pas.

### group_1 — 17 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `b_atk` | 0 | 999999 | brut | Main | Attaque |
| `b_atk_equip` | 0 | 999999 | brut | Main | Attaque de l'équipement |
| `b_atk_lvadd` | 0 | 1 | brut | Hide | Augmentation de l'attaque au niveau supérieur |
| `b_def` | 0 | 999999 | brut | Main | Défense |
| `b_def_equip` | 0 | 999999 | brut | Main | Défense de l'équipement |
| `b_def_lvadd` | 0 | 1 | brut | Hide | Augmentation de la défense au niveau supérieur |
| `b_maxhp` | 0 | 999999999 | brut | Main | PV |
| `b_maxhp_equip` | 0 | 999999999 | brut | Main | PV de l'équipement |
| `b_maxhp_lvadd` | 0 | 1 | brut | Hide | Augmentation des PV au niveau supérieur |
| `e_atk` | 0 | 999999 | brut | Hide | — |
| `equip_amplify_rate` | 0 | 999999 | ‰ | Main | Amplification des stats de l'équipement |
| `i_atkadd_rate` | -9999 | 999999 | ‰ | Main | Augmentation de l'attaque |
| `i_defadd_rate` | -9999 | 999999 | ‰ | Main | Augmentation de la défense |
| `i_maxhpadd_rate` | -9999 | 999999 | ‰ | Main | Augmentation des PV |
| `t_atk` | 0 | 999999 | brut | Hide | — |
| `t_def` | 0 | 999999 | brut | Hide | — |
| `t_maxhp` | -999999999 | 999999999 | brut | Hide | — |

### group_10 — 6 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `attackspdper_rate` | 0 | 0 | ‰ | Hide | — |
| `cc_resistper_rate` | 0 | 0 | ‰ | Hide | — |
| `hero_maxhp` | 0 | 0 | brut | Hide | — |
| `move_spd` | 100 | 10000 | brut | Hide | — |
| `reduced_hp` | 0 | 0 | brut | Hide | — |
| `skillrangeangle` | 0 | 360 | brut | Hide | — |

### group_2 — 12 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `a_accuracy` | 0 | 999999 | brut | Sub | Perforation |
| `a_block` | 0 | 999999 | brut | Sub | Persévérance |
| `a_block_rate` | -9999 | 10000 | ‰ | Sub | Taux de parade |
| `b_pvp_dam_dec` | 0 | 999999 | brut | Hide | Agilité |
| `b_pvp_dam_inc` | 0 | 999999 | brut | Hide | Robustesse |
| `c_critical_dam_rate` | 0 | 50000 | ‰ | Sub | Dégâts crit. |
| `c_critical_damres_rate` | 0 | 50000 | ‰ | Sub | Défense crit. |
| `c_critical_rate` | 0 | 10000 | ‰ | Sub | Chances crit. |
| `c_critical_resrate` | 0 | 10000 | ‰ | Sub | Résistance crit. |
| `d_block_damres_rate` | 0 | 10000 | ‰ | Hide | Persévérance défense |
| `d_protect_cur_rate` | 0 | 10000 | ‰ | Sub | Percement de défense |
| `d_protect_curres_rate` | 0 | 10000 | ‰ | Sub | Résistance au percement |

### group_3 — 19 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `activethird_damadd_rate` | 0 | 999999 | ‰ | Sub | Augmentation des dégâts d'attaque spéciale |
| `activethird_damres_rate` | 0 | 999999 | ‰ | Sub | Réduction des dégâts d'attaque spéciale |
| `aerialattack_damadd_rate` | 0 | 999999 | ‰ | Sub | Augmentation des dégâts d'attaque plongée |
| `aerialattack_damres_rate` | 0 | 999999 | ‰ | Sub | Réduction des dégâts d'attaque plongée |
| `d_all_damres_rate` | 0 | 999999 | ‰ | NonHide | Résistance à tous les dégâts |
| `d_normal_damres_rate` | 0 | 1 | ‰ | Hide | Résistance aux dégâts d'attaque normale |
| `d_skill_damres_rate` | 0 | 1 | ‰ | Hide | Résistance aux dégâts de compétence d'attaque |
| `final_all_dam_rate` | -10000 | 999999 | ‰ | Hide | Taux de dégâts finaux |
| `i_all_damadd_rate` | 0 | 999999 | ‰ | NonHide | Augmentation : tous les dégâts |
| `i_normal_damadd_rate` | 0 | 1 | ‰ | Hide | Augmentation des dégâts d'attaque normale |
| `i_skill_damadd_rate` | 0 | 1 | ‰ | Hide | Augmentation des dégâts, compétence d'attaque |
| `normalattack_damadd_rate` | 0 | 999999 | ‰ | Sub | Augmentation des dégâts d'attaque normale |
| `normalattack_damres_rate` | 0 | 999999 | ‰ | Sub | Réduction des dégâts d'attaque normale |
| `normalskill_damadd_rate` | 0 | 999999 | ‰ | Sub | Augmentation des dégâts, compétence normale |
| `normalskill_damres_rate` | 0 | 999999 | ‰ | Sub | Réduction des dégâts de compétence normale |
| `normalskillchangetag_damadd_rate` | 0 | 999999 | ‰ | Sub | Augmentation des dégâts, compétence de relève |
| `normalskillchangetag_damres_rate` | 0 | 999999 | ‰ | Sub | Réduction des dégâts de compétence de relève |
| `ultimateskill_damadd_rate` | 0 | 999999 | ‰ | Sub | Augmentation des dégâts d'attaque ultime |
| `ultimateskill_damres_rate` | 0 | 999999 | ‰ | Sub | Réduction des dégâts d'attaque ultime |

### group_4 — 22 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `d_refdam_rate` | 0 | 999999 | ‰ | Sub | Taux de renvoi des dégâts |
| `h_healpower` | -999999 | 999999 | brut | Hide | Pouvoir de guérison |
| `h_healpower_rate` | -10000 | 999999 | ‰ | NonHide | Efficacité de guérison |
| `h_healpower_tick` | 0 | 999999 | brut | Hide | Guérison naturelle |
| `h_healpower_tick_rate` | -10000 | 999999 | ‰ | Hide | Augmentation de la guérison naturelle |
| `h_healreceive_rate` | -10000 | 999999 | ‰ | NonHide | Augmentation des soins reçus |
| `h_vampireheal_rate` | 0 | 2500 | ‰ | NonHide | Vampirisme |
| `m_detectdisadd_rate` | -9999 | 999999 | ‰ | Hide | Augmentation de la portée de détection |
| `max_stamina` | 0 | 10000 | brut | Hide | Endurance |
| `maxsp_rate` | -999999 | 999999 | ‰ | Hide | — |
| `mf_assim_rate` | -10000 | 10000 | ‰ | NonHide | Taux de conversion magique |
| `mf_chargeeffic_rate` | -10000 | 999999 | ‰ | NonHide | Efficacité de recharge de la magie |
| `mf_costreduce_rate_ultimateskill` | -10000 | 10000 | brut | Hide | Taux de réduction de magie de l'attaque ultime |
| `mf_protect_rate` | -10000 | 10000 | ‰ | NonHide | Protection magique |
| `p_shield_add` | 0 | 999999 | brut | Hide | Absorption des barrières |
| `p_shield_damadd` | 0 | 999999 | brut | Hide | Bonus de dégâts des barrières |
| `p_shield_rate` | -10000 | 999999 | ‰ | Sub | Efficacité des barrières |
| `recoverysp_rate` | -999999 | 999999 | ‰ | Hide | — |
| `recoverystaminaamount` | -9999 | 999999 | brut | Hide | Récupération d'endurance |
| `s_movespdadd_rate` | -9999 | 10000 | ‰ | NonHide | Vitesse de déplacement |
| `s_skillrecycle_rate` | -999999 | 10000 | ‰ | NonHide | Réduction de temps de recharge |
| `s_townspdadd_rate` | -9999 | 10000 | ‰ | NonHide | Vitesse de déplacement en ville |

### group_5 — 22 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `allelement_add` | -999999 | 999999 | brut | Sub | Attaque de tous les éléments |
| `allelement_res` | -999999 | 999999 | brut | Sub | Défense de tous les éléments |
| `dark_add` | -999999 | 999999 | brut | Sub | Attaque des Ténèbres |
| `dark_res` | -999999 | 999999 | brut | Sub | Défense des Ténèbres |
| `default_add` | -999999 | 999999 | brut | Sub | Attaque physique |
| `default_res` | -999999 | 999999 | brut | Sub | Défense physique |
| `earth_add` | -999999 | 999999 | brut | Sub | Attaque de Terre |
| `earth_res` | -999999 | 999999 | brut | Sub | Défense de Terre |
| `fire_add` | -999999 | 999999 | brut | Sub | Attaque de Feu |
| `fire_res` | -999999 | 999999 | brut | Sub | Défense de Feu |
| `holy_add` | -999999 | 999999 | brut | Sub | Attaque du Sacré |
| `holy_res` | -999999 | 999999 | brut | Sub | Défense du Sacré |
| `ice_add` | -999999 | 999999 | brut | Sub | Attaque de Froid |
| `ice_res` | -999999 | 999999 | brut | Sub | Défense de Froid |
| `thunder_add` | -999999 | 999999 | brut | Sub | Attaque de Foudre |
| `thunder_res` | -999999 | 999999 | brut | Sub | Défense de Foudre |
| `venom_add` | 0 | 1 | brut | NonHide | — |
| `venom_res` | 0 | 1 | brut | NonHide | — |
| `water_add` | 0 | 1 | brut | NonHide | — |
| `water_res` | 0 | 1 | brut | NonHide | — |
| `wind_add` | -999999 | 999999 | brut | Sub | Attaque de Vent |
| `wind_res` | -999999 | 999999 | brut | Sub | Défense de Vent |

### group_6 — 22 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `allelement_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de toutes les attaques élémentaires |
| `allelement_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de toutes les défenses élémentaires |
| `dark_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque des Ténèbres  |
| `dark_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense des Ténèbres  |
| `default_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque physique  |
| `default_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense physique  |
| `earth_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque de Terre  |
| `earth_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense de Terre  |
| `fire_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque de Feu  |
| `fire_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense de Feu  |
| `holy_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque du Sacré  |
| `holy_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense du Sacré  |
| `ice_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque de Froid  |
| `ice_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense de Froid  |
| `thunder_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque de Foudre  |
| `thunder_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense de Foudre  |
| `venom_rate` | 0 | 1 | ‰ | NonHide | — |
| `venom_res_rate` | 0 | 1 | ‰ | NonHide | — |
| `water_rate` | 0 | 1 | ‰ | NonHide | — |
| `water_res_rate` | 0 | 1 | ‰ | NonHide | — |
| `wind_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de l'attaque de Vent  |
| `wind_res_rate` | -9999 | 999999 | ‰ | NonHide | Augmentation de la défense de Vent  |

### group_7 — 12 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `allelement_value` | 0 | 999999 | brut | Hide | Tous les dégâts fixes élémentaires |
| `dark_value` | 0 | 999999 | brut | Hide | Dégâts des Ténèbres fixes (%) |
| `default_value` | 0 | 999999 | brut | Hide | Dégâts physiques fixes (%) |
| `earth_value` | 0 | 999999 | brut | Hide | Dégâts de Terre fixes (%) |
| `fire_value` | 0 | 999999 | brut | Hide | Dégâts de Feu fixes (%) |
| `holy_value` | 0 | 999999 | brut | Hide | Dégâts du Sacré fixes (%) |
| `ice_value` | 0 | 999999 | brut | Hide | Dégâts de Froid fixes (%) |
| `mf_stackmax` | 0 | 7 | brut | Hide | Jauge de magie |
| `thunder_value` | 0 | 999999 | brut | Hide | Dégâts de Foudre fixes (%) |
| `venom_value` | 0 | 1 | brut | Hide | — |
| `water_value` | 0 | 1 | brut | Hide | — |
| `wind_value` | 0 | 999999 | brut | Hide | Dégâts de Vent fixes (%) |

### group_8 — 30 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `all_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation de tous les dégâts élémentaires |
| `all_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance à tous les éléments (%) |
| `dark_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts des Ténèbres  |
| `dark_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance aux Ténèbres (%) |
| `dark_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse aux Ténèbres  |
| `default_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts physiques  |
| `default_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance physique (%) |
| `default_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse physique  |
| `earth_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts de Terre  |
| `earth_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance à la Terre (%) |
| `earth_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse à la Terre  |
| `fire_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts de Feu  |
| `fire_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance au Feu (%) |
| `fire_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse au Feu  |
| `holy_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts du Sacré  |
| `holy_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance au Sacré (%) |
| `holy_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse au Sacré  |
| `ice_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts de Froid  |
| `ice_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance au Froid (%) |
| `ice_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse au Froid  |
| `thunder_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts de Foudre  |
| `thunder_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance à la Foudre (%) |
| `thunder_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse à la Foudre  |
| `venom_element_rate` | 0 | 1 | ‰ | NonHide | — |
| `venom_element_res_rate` | 0 | 1 | ‰ | NonHide | — |
| `water_element_rate` | 0 | 1 | ‰ | NonHide | — |
| `water_element_res_rate` | 0 | 1 | ‰ | NonHide | — |
| `wind_element_rate` | 0 | 999999 | ‰ | NonHide | Augmentation des dégâts de Vent  |
| `wind_element_res_rate` | 0 | 999999 | ‰ | NonHide | Résistance au Vent (%) |
| `wind_weakness_rate` | -10000 | 999999 | ‰ | NonHide | Dégâts de faiblesse au Vent  |

### group_9 — 61 statistiques

| Code | Min | Max | Unité | Type | Libellé |
|---|---:|---:|---|---|---|
| `breath_addrate` | -9999 | 999999 | ‰ | Hide | Capacité pulmonaire |
| `breath_max_add` | -999999 | 999999 | brut | Hide | Durée max. de la plongée |
| `breath_recoverytime_rate` | -10000 | 999999 | ‰ | Hide | — |
| `buff_time_rate` | -9999 | 999999 | ‰ | NonHide | Efficacité de la durée des bonus |
| `burst_gauge_extra` | -9999 | 999999 | brut | Hide | Bonus de jauge de Déluge |
| `burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge de tous les éléments |
| `burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge de tous les éléments |
| `burstactivation_duration_rate` | -10000 | 999999 | ‰ | Hide | — |
| `dark_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge des Ténèbres |
| `dark_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge des Ténèbres |
| `dark_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur des Ténèbres |
| `dark_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur des Ténèbres |
| `debuff_time_rate` | -9999 | 999999 | ‰ | NonHide | Efficacité de la durée des malus |
| `default_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge physique |
| `default_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge physique |
| `default_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur physique |
| `default_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur physique |
| `earth_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge de Terre |
| `earth_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge de Terre |
| `earth_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur de Terre |
| `earth_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur de Terre |
| `falldam_value` | 0 | 999999 | brut | Hide | Augmentation des dégâts d'attaque plongée |
| `fire_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge de Feu |
| `fire_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge de Feu |
| `fire_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur de Feu |
| `fire_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur de Feu |
| `h_revivalheal_rate` | -9999 | 999999 | ‰ | Hide | — |
| `healreceive_value` | 0 | 999999 | brut | Hide | Récupération fixe |
| `holy_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge du Sacré |
| `holy_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge du Sacré |
| `holy_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur du Sacré |
| `holy_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur du Sacré |
| `ice_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge de Froid |
| `ice_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge de Froid |
| `ice_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur de Froid |
| `ice_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur de Froid |
| `m_burst_gauge` | 0 | 999999 | brut | Hide | Coût de Déluge |
| `makingtime_res` | -9999 | 999999 | brut | Hide | — |
| `makingtime_res_rate` | -9999 | 999999 | ‰ | Hide | — |
| `recfalldam_value` | 0 | 999999 | brut | Hide | Augmentation des dégâts de chute subis |
| `s_glidingspdadd_rate` | -9999 | 999999 | ‰ | Hide | — |
| `s_glidingstamina_rate` | -15000 | 999999 | ‰ | Hide | — |
| `s_petflyingspdadd_rate` | -9999 | 999999 | ‰ | Hide | — |
| `s_petflyingstamina_rate` | -15000 | 999999 | ‰ | Hide | — |
| `s_swimspdadd_rate` | -9999 | 999999 | ‰ | Hide | — |
| `s_swimstamina_rate` | -9999 | 999999 | ‰ | Hide | — |
| `s_underwaterspdadd_rate` | -9999 | 999999 | ‰ | Hide | — |
| `temp_cold_res` | -3 | 3 | brut | NonHide | Résistance au froid |
| `temp_hot_res` | -3 | 3 | brut | NonHide | Résistance au chaud |
| `threaten_rate` | -9999 | 999999 | ‰ | NonHide | Taux de menace |
| `thunder_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge de Foudre |
| `thunder_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge de Foudre |
| `thunder_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur de Foudre |
| `thunder_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur de Foudre |
| `tickdam_period_rate` | -10000 | 999999 | ‰ | Hide | Délai d'infliction des dégâts sur la durée |
| `tickdam_rate` | -10000 | 999999 | ‰ | NonHide | Efficacité des dégâts sur la durée |
| `vampireheal_value` | 0 | 999999 | brut | Hide | Vampirisme fixe |
| `wind_burst_gauge_rate` | 0 | 999999 | ‰ | NonHide | Efficacité de Déluge de Vent |
| `wind_burst_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance au Déluge de Vent |
| `wind_event_gauge_rate` | 0 | 999999 | ‰ | Hide | Efficacité de stupeur de Vent |
| `wind_event_gauge_res_rate` | 0 | 999999 | ‰ | Hide | Résistance à la stupeur de Vent |

## Deux éléments prévus et jamais nommés

`Venom` et `Water` ont leurs colonnes dans le schéma — attaque, défense, taux,
résistance — mais **aucun libellé dans aucune des 13 langues** du client. Les
sept autres éléments (Foudre, Vent, Feu, Froid, Terre, Ténèbres, Sacré) sont
tous nommés.

Le même déséquilibre se retrouve côté monstres : dans `NpcStatGroupTable`,
`Venom` et `Water` ont un `_Res` mais ni `_Element_Res_Rate` ni
`_Weakness_Rate`, là où les sept autres ont les trois.

| Code | Min | Max |
|---|---:|---:|
| `attackspdper_rate` | 0 | 0 |
| `breath_recoverytime_rate` | -10000 | 999999 |
| `burstactivation_duration_rate` | -10000 | 999999 |
| `cc_resistper_rate` | 0 | 0 |
| `e_atk` | 0 | 999999 |
| `h_revivalheal_rate` | -9999 | 999999 |
| `hero_maxhp` | 0 | 0 |
| `makingtime_res` | -9999 | 999999 |
| `makingtime_res_rate` | -9999 | 999999 |
| `maxsp_rate` | -999999 | 999999 |
| `move_spd` | 100 | 10000 |
| `recoverysp_rate` | -999999 | 999999 |
| `reduced_hp` | 0 | 0 |
| `s_glidingspdadd_rate` | -9999 | 999999 |
| `s_glidingstamina_rate` | -15000 | 999999 |
| `s_petflyingspdadd_rate` | -9999 | 999999 |
| `s_petflyingstamina_rate` | -15000 | 999999 |
| `s_swimspdadd_rate` | -9999 | 999999 |
| `s_swimstamina_rate` | -9999 | 999999 |
| `s_underwaterspdadd_rate` | -9999 | 999999 |
| `skillrangeangle` | 0 | 360 |
| `t_atk` | 0 | 999999 |
| `t_def` | 0 | 999999 |
| `t_maxhp` | -999999999 | 999999999 |
| `venom_add` | 0 | 1 |
| `venom_element_rate` | 0 | 1 |
| `venom_element_res_rate` | 0 | 1 |
| `venom_rate` | 0 | 1 |
| `venom_res` | 0 | 1 |
| `venom_res_rate` | 0 | 1 |
| `venom_value` | 0 | 1 |
| `water_add` | 0 | 1 |
| `water_element_rate` | 0 | 1 |
| `water_element_res_rate` | 0 | 1 |
| `water_rate` | 0 | 1 |
| `water_res` | 0 | 1 |
| `water_res_rate` | 0 | 1 |
| `water_value` | 0 | 1 |
