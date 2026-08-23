# Constantes de combat lues dans le client

Extraites de `SevenDeadlySins/Content/Table/Misc/DefineTable` (934 constantes au
total), build `1.8.1.2`. Valeurs **brutes**, telles que le jeu les stocke.

> **Echelle.** Pour les champs de taux, 10000 vaut 100 %. La colonne « en % »
> n'est remplie que pour ceux-la. Partout ailleurs l'unite est inconnue : une
> portee est en unites Unreal, une duree en millisecondes.

> **Ce que ce fichier n'est pas.** Il donne les constantes de la formule, pas la
> formule. L'ordre des operations est dans le code C++ du client, et le calcul
> qui fait autorite tourne cote serveur. Rien de tout cela n'est extractible.

## Plafonds et planchers

Les bornes que le jeu applique en fin de calcul.

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_max_apply_normalaccuracy_rate` | 10000 | 100 % |
| `battle_max_apply_skillaccuracy_rate` | 10000 | 100 % |
| `battle_max_countref_rate` | 10000 | 100 % |
| `battle_max_critical_rate` | 10000 | 100 % |
| `battle_max_damres_rate` | 10000 | 100 % |
| `battle_max_falldam_time` | 3000 |  |
| `battle_max_norref_rate` | 10000 | 100 % |
| `battle_max_skillrecycle_rate` | 9000 | 90 % |
| `battle_max_sum_protect_cur_rate` | 9000 | 90 % |
| `battle_min_adddam_rate` | 500 | 5 % |
| `battle_min_apply_dam` | 0 |  |
| `battle_min_apply_detectdis` | 0 |  |
| `battle_min_apply_fall` | 0 |  |
| `battle_min_apply_fallrebound` | 0 |  |
| `battle_min_apply_normalaccuracy_rate` | 0 | 0 % |
| `battle_min_apply_skillaccuracy_rate` | 0 | 0 % |
| `battle_min_cor_fall_rate` | 0 | 0 % |
| `battle_min_cor_fallrebound_rate` | 0 | 0 % |
| `battle_min_cor_movespd_rate` | 1000 | 10 % |
| `battle_min_countref_rate` | 0 | 0 % |
| `battle_min_countrefdam` | 0 |  |
| `battle_min_critical_dam_rate` | 10000 | 100 % |
| `battle_min_critical_rate` | 0 | 0 % |
| `battle_min_damres_rate` | 500 | 5 % |
| `battle_min_default_vampireheal` | 0 |  |
| `battle_min_elementdam` | 0 |  |
| `battle_min_elementdam_rate` | 500 | 5 % |
| `battle_min_fall_time` | 0 |  |
| `battle_min_falldam` | 0 |  |
| `battle_min_falldam_time` | 1000 |  |
| `battle_min_fallreb_time` | 0 |  |
| `battle_min_final_atk` | 1 |  |
| `battle_min_healpower` | 0 |  |
| `battle_min_norref_rate` | 0 | 0 % |
| `battle_min_norrefdam` | 0 |  |
| `battle_min_protect_cur_rate` | 0 | 0 % |
| `battle_min_shielddam` | 0 |  |
| `battle_min_staminarecovery` | 0 |  |
| `battle_min_sum_atk` | 0 |  |
| `battle_min_sum_def` | 0 |  |
| `battle_min_sum_protect_cur_rate` | 0 | 0 % |
| `battle_min_weakness_rate` | 0 | 0 % |

## Critique

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_default_critical_rate` | 0 | 0 % |
| `battle_p_c_critical_rate` | 6000 | 60 % |
| `battle_p_c_critical_resrate` | 4500 |  |
| `battle_p_criticalrate_min` | 0 |  |
| `battle_p_criticalresrate_con` | 0 | 0 % |
| `battle_p_criticalresrate_min` | 0 |  |
| `ga_critical_rate_max` | 9000 | 90 % |
| `ga_critical_rate_min` | 0 | 0 % |
| `ga_criticalpowerper_rate_range_max` | 20000 | 200 % |
| `ga_criticalpowerper_rate_range_min` | 12000 | 120 % |
| `ga_criticalpowertrans_rate` | 1 | 0.01 % |
| `ga_criticaltrans_rate` | 1 | 0.01 % |
| `ga_default_criticalper_rate` | 1 | 0.01 % |
| `ga_default_criticalpowerper_rate` | 12000 | 120 % |

## Precision, blocage, percement

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_cor_lvblock_rate` | 300 | 3 % |
| `battle_default_accuracy_rate` | 10000 | 100 % |
| `battle_default_block_rate` | 1000 | 10 % |
| `battle_p_a_accuracy` | 5 |  |
| `battle_p_a_block` | 6 |  |
| `battle_p_a_block_rate` | 10000 | 100 % |
| `battle_p_accuracy_con` | 0 | 0 % |
| `battle_p_accuracy_min` | 0 |  |
| `battle_p_block_con` | 0 | 0 % |
| `battle_p_d_block_damres_rate` | 4500 | 45 % |
| `battle_p_d_protect_cur_rate` | 6000 | 60 % |
| `battle_p_d_protect_curres_rate` | 4500 | 45 % |
| `battle_p_mf_protect_con` | 0 | 0 % |
| `battle_p_protect_cur_con` | 33000 | 330 % |
| `battle_p_protect_curres_con` | 33000 | 330 % |
| `block_drop_fever_max_count` | 50 |  |
| `blocked_hitbonecurve_off` | `True` |  |
| `blocked_reaction_immunity` | `["CC_Stiff","CC_Knockback","CC_Down","HC_KnockbackDown","CC_Strain","CC_AirBorne"]` |  |
| `ga_accuracy_rate_max` | 9500 | 95 % |
| `ga_accuracy_rate_min` | 500 | 5 % |
| `ga_accuracytrans_rate` | 1 | 0.01 % |
| `ga_avgrng_accuracy_rate` | -1000 | -10 % |
| `ga_back_accuracy_rate` | 1000 | 10 % |
| `ga_block_rate_max` | 6000 | 60 % |
| `ga_block_rate_min` | 0 | 0 % |
| `ga_blocktrans_rate` | 1 | 0.01 % |
| `ga_climb_camera_rotate_block` | `True` |  |
| `ga_default_accuracy_rate` | 8000 | 80 % |
| `ga_default_block_rate` | 1000 | 10 % |
| `ga_default_pierceper_rate` | 10000 | 100 % |
| `ga_exhaustprotection` | 1 |  |
| `ga_longrng_accuracy_rate` | -2000 | -20 % |
| `ga_pierceper_rate_max` | 15000 | 150 % |
| `ga_pierceper_rate_min` | 7500 | 75 % |
| `ga_restprotectiondeduction` | 1 |  |
| `ga_shortrng_accuracy_rate` | 0 | 0 % |

## Elements et faiblesse

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_p_all_element_damres_rate` | 4500 | 45 % |
| `battle_p_allelement_add` | 2604 |  |
| `battle_p_allelement_dam_rate` | 6000 | 60 % |
| `battle_p_allelement_rate` | 2604 | 26.04 % |
| `battle_p_allelement_res` | 3255 | 32.55 % |
| `battle_p_allelement_res_rate` | 3255 | 32.55 % |
| `battle_p_allelement_value` | 3000 |  |
| `battle_p_element_add` | 868 |  |
| `battle_p_element_burst_gauge_rate` | 1286 | 12.86 % |
| `battle_p_element_burst_gauge_res_rate` | 1286 | 12.86 % |
| `battle_p_element_burst_gauge_synergy` | 1100 |  |
| `battle_p_element_dam_rate` | 2000 | 20 % |
| `battle_p_element_damres_rate` | 563 | 5.63 % |
| `battle_p_element_rate` | 868 | 8.68 % |
| `battle_p_element_res` | 407 | 4.07 % |
| `battle_p_element_res_rate` | 407 | 4.07 % |
| `battle_p_element_value` | 1000 |  |
| `battle_p_elementatk_min` | 0 |  |
| `battle_p_elementdef_min` | 0 |  |
| `ga_weaknessdmgrate` | 50000 |  |

## Correction de degats selon la distance

Mecanique de decroissance des degats avec la portee.

| Constante | Valeur | En % |
|---|---:|---:|
| `ga_damcorrection_1_damrate` | 10000 |  |
| `ga_damcorrection_1_range` | 500 |  |
| `ga_damcorrection_2_damrate` | 5000 |  |
| `ga_damcorrection_2_range` | 1000 |  |
| `ga_damcorrection_3_damrate` | 1000 |  |

## Defense

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_def_con` | 280 | 2.8 % |
| `battle_exceptiondef_con` | 40 | 0.4 % |
| `battle_mydef_con` | 220 | 2.2 % |
| `battle_p_def` | 3255 |  |
| `battle_p_def_con` | 10000 | 100 % |
| `battle_p_def_min` | 0 |  |
| `battle_p_stat_def_min` | 0 |  |
| `ga_ability_totaldefrate_key` | `TotalDef` |  |
| `ga_totaldef_rate` | 10000 | 100 % |

## JcJ

| Constante | Valeur | En % |
|---|---:|---:|
| `ga_pvp_dam_rate` | 250 | 2.5 % |
| `ga_pvp_finaldam_rate` | 7000 | 70 % |

## Poids de puissance de combat

Prefixe `battle_p_`. Les suffixes reprennent les codes de statistiques (`a_accuracy` pour `A_Accuracy`, `c_critical_rate` pour `C_Critical_Rate`). Lecture a confirmer contre une puissance affichee en jeu.

| Constante | Valeur | En % |
|---|---:|---:|
| `battle_p_activethird_damadd_rate` | 1532 | 15.32 % |
| `battle_p_activethird_damres_rate` | 1532 | 15.32 % |
| `battle_p_aerialattack_damadd_rate` | 1162 | 11.62 % |
| `battle_p_aerialattack_damres_rate` | 1162 | 11.62 % |
| `battle_p_atk` | 2604 |  |
| `battle_p_atk_min` | 0 |  |
| `battle_p_battletime_con` | 70000 | 700 % |
| `battle_p_burst_gauge_rate` | 3858 | 38.58 % |
| `battle_p_burst_gauge_res_rate` | 3858 | 38.58 % |
| `battle_p_burstactivation_duration_rate` | 3600 | 36 % |
| `battle_p_crit_con` | 55000 | 550 % |
| `battle_p_d_all_damres_rate` | 4500 | 45 % |
| `battle_p_d_refdam_rate` | 3500 | 35 % |
| `battle_p_damadd_con` | 23000 | 230 % |
| `battle_p_damrate_min` | 0 |  |
| `battle_p_damres_con` | 23000 | 230 % |
| `battle_p_damresrate_min` | 0 |  |
| `battle_p_ehp_exponent` | 5000 |  |
| `battle_p_equippassive_con` | 30 | 0.3 % |
| `battle_p_equippassive_lv_con` | 120 | 1.2 % |
| `battle_p_equipset_2` | 300 |  |
| `battle_p_equipset_3` | 450 |  |
| `battle_p_equipset_4` | 600 |  |
| `battle_p_equipset_5` | 750 |  |
| `battle_p_equipset_6` | 900 |  |
| `battle_p_equipset_7` | 1050 |  |
| `battle_p_evade_con` | 0 | 0 % |
| `battle_p_evade_rate_con` | 0 | 0 % |
| `battle_p_grade_con` | 0 | 0 % |
| `battle_p_h_healpower` | 5000 |  |
| `battle_p_h_healpower_rate` | 500 | 5 % |
| `battle_p_h_healpower_synergy` | 11000 |  |
| `battle_p_h_healreceive_rate` | 4808 | 48.08 % |
| `battle_p_h_vampireheal_rate` | 3600 | 36 % |
| `battle_p_heal_min` | 0 |  |
| `battle_p_healpower_con` | 0 | 0 % |
| `battle_p_i_all_damadd_rate` | 6000 | 60 % |
| `battle_p_i_atkadd_rate` | 10000 | 100 % |
| `battle_p_i_defadd_rate` | 10000 | 100 % |
| `battle_p_i_maxhpadd_rate` | 10000 | 100 % |
| `battle_p_maxhp` | 1302 |  |
| `battle_p_mf_assim_rate` | 3125 | 31.25 % |
| `battle_p_mf_chargeeffic_rate` | 2894 | 28.94 % |
| `battle_p_mf_con` | 0 | 0 % |
| `battle_p_mf_min` | 0 |  |
| `battle_p_mf_synergy` | 1150 |  |
| `battle_p_normalattack_damadd_rate` | 1395 | 13.95 % |
| `battle_p_normalattack_damres_rate` | 1395 | 13.95 % |
| `battle_p_normalskill_damadd_rate` | 1990 | 19.9 % |
| `battle_p_normalskill_damres_rate` | 1990 | 19.9 % |
| `battle_p_normalskillchangetag_damadd_rate` | 1132 | 11.32 % |
| `battle_p_normalskillchangetag_damres_rate` | 1132 | 11.32 % |
| `battle_p_optkind_con` | 4 | 0.04 % |
| `battle_p_p_shield_add` | 3125 |  |
| `battle_p_p_shield_damadd` | 3500 |  |
| `battle_p_p_shield_rate` | 50 | 0.5 % |
| `battle_p_p_shield_synergy` | 1150 |  |
| `battle_p_s_skillrecycle_rate` | 3858 | 38.58 % |
| `battle_p_shield_con` | 0 | 0 % |
| `battle_p_shield_damadd_con` | 0 | 0 % |
| `battle_p_shield_min` | 0 |  |
| `battle_p_skilldam_con` | 165000000 | 1650000 % |
| `battle_p_skilllv_con_a` | 10000 |  |
| `battle_p_skilllv_con_b` | 10000 |  |
| `battle_p_stat_atk_min` | 0 |  |
| `battle_p_stat_etc_min` | 0 |  |
| `battle_p_stat_hp_min` | 0 |  |
| `battle_p_ultimateskill_damadd_rate` | 2541 | 25.41 % |
| `battle_p_ultimateskill_damres_rate` | 2541 | 25.41 % |
| `battle_p_valuedam_con` | 0 | 0 % |
| `battle_p_valuedam_min` | 0 |  |
| `battle_p_vampireheal_con` | 0 | 0 % |

---

200 constantes de combat retenues sur les 934 de la table.
