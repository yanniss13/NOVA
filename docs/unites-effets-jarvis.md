# Unités des effets J.A.R.V.I.S.

Audit réalisé sur l'export du 24/09/2026. La source est
`Table/Buff/BuffTable.json` : le code vient de
`AddAbil_List[].TargetAbil`, la valeur de `Value`, l'opération de `Type` et
la preuve d'affichage de `Local_Replace`.

Une preuve en pourcentage est retenue seulement lorsque le remplacement vaut
exactement `abs(Value) / 100`. Une preuve plate vaut exactement `abs(Value)`.
L'ordre de `Local_Replace` n'est jamais rapproché de celui d'`AddAbil_List`.
Le signe reste celui de la table.

## Témoins des 41 codes observés

`10⁻⁴ → %` signifie que la table stocke des dix-millièmes. « Déjà couvert »
désigne une entrée historique retrouvée par la clé canonique, sans ajouter un
alias qui ne différerait que par la casse ou les `_`.

| Code | Buff témoin | Valeur de table | Preuve dans l'export | Décision |
| --- | ---: | ---: | --- | --- |
| `ActiveThird_DamAdd_Rate` | `302011020` | 3000 | `{0}:{30%}` | 10⁻⁴ → % (déjà couvert) |
| `All_Element_Rate` | `303151022` | 60 | `{0}:{0.6%}` | 10⁻⁴ → % (déjà couvert) |
| `AllElement_Res_Rate` | `304080057` | -500 | `{0}:{5%}` | 10⁻⁴ → % (déjà couvert) |
| `Burst_Gauge_Res_Rate` | `302091007` | -2500 | `{0}:{25%}` | 10⁻⁴ → % |
| `D_All_DamRes_Rate` | `304070009` | 2500 | `{0}:{25%}` | 10⁻⁴ → % |
| `Dark_Res_Rate` | `304003650` | 5000 | `{0}:{50%}` | 10⁻⁴ → % |
| `Earth_Burst_Gauge_Res_Rate` | `302093003` | -2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `Earth_Res_Rate` | `302162002` | 500 | `{1}:{5%}` | 10⁻⁴ → % |
| `Final_All_Dam_Rate` | `304070107` | 5000 | `{0}:{50%}` | 10⁻⁴ → % |
| `Fire_Burst_Gauge_Res_Rate` | `302071002` | -2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `Fire_Res_Rate` | `302162002` | 500 | `{2}:{5%}` | 10⁻⁴ → % |
| `Holy_Res_Rate` | `304003550` | 5000 | `{0}:{50%}` | 10⁻⁴ → % |
| `I_MaxHPAdd_Rate` | `302071021` | 2000 | `{0}:{20%}` | 10⁻⁴ → % (déjà couvert) |
| `Ice_Burst_Gauge_Res_Rate` | `302000501` | -300 | `{1}:{3%}`, `Type=Per` | 10⁻⁴ → % |
| `Ice_Res_Rate` | `304003150` | 5000 | `{0}:{50%}` | 10⁻⁴ → % |
| `MaxSP_Rate` | `309000601` | -1500 | `{0}:{15%}` | 10⁻⁴ → % |
| `MF_CostReduce_Rate_UltimateSkill` | `302172013` | 1000 | `{0}:{10%}` | 10⁻⁴ → % |
| `Move_Spd` | `302000501` | -500 | `{0}:{5%}`, `Type=Per` | % par occurrence, pas de métadonnée |
| `NormalAttack_DamAdd_Rate` | `302271015` | 1000 | `{0}:{10%}` | 10⁻⁴ → % (déjà couvert) |
| `NormalSkill_DamAdd_Rate` | `302012002` | 200 | `{1}:{2%}` | 10⁻⁴ → % (déjà couvert) |
| `NormalSkillChangeTag_DamAdd_Rate` | `302133002` | 4000 | `{0}:{40%}` | 10⁻⁴ → % (déjà couvert) |
| `RecoverySP_Rate` | `304070007` | -2500 | `{0}:{25%}` | 10⁻⁴ → % |
| `S_GlidingSpdAdd_Rate` | `305124008` | 2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `S_GlidingStamina_Rate` | `305124002` | -2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `S_MoveSpdAdd_Rate` | `302122006` | -3000 | `{0}:{30%}` | 10⁻⁴ → % |
| `S_PetFlyingSpdAdd_Rate` | `305124007` | 2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `S_PetFlyingStamina_Rate` | `305124001` | -2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `S_SwimSpdAdd_Rate` | `305122011` | 2000 | `{2}:{20%}` | 10⁻⁴ → % |
| `S_SwimStamina_Rate` | `305122012` | -2000 | `{2}:{20%}` | 10⁻⁴ → % |
| `S_UnderWaterSpdAdd_Rate` | `305124010` | 2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `T_Atk` | `305112001` | 58 | `{1}:{58}` | plate |
| `T_Def` | `305113001` | 46 | `{1}:{46}` | plate |
| `T_MaxHP` | `302202013` | 2000 | `{0}:{20%}`, `Type=Per` | % par occurrence, pas de métadonnée |
| `Temp_Cold_Res` | `305205004` | 2 | `{0}:{2}` | plate |
| `Temp_Hot_Res` | `305205001` | 1 | `{0}:{1}` | plate |
| `Thunder_Burst_Gauge_Res_Rate` | `302061002` | -2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `Thunder_Res_Rate` | `304003350` | 5000 | `{0}:{50%}` | 10⁻⁴ → % |
| `TickDam_Period_Rate` | `303421307` | -1000 | `{0}:{10%}` | 10⁻⁴ → % |
| `UltimateSkill_DamAdd_Rate` | `302012002` | 300 | `{2}:{3%}` | 10⁻⁴ → % (déjà couvert) |
| `Wind_Burst_Gauge_Res_Rate` | `302241002` | -2000 | `{0}:{20%}` | 10⁻⁴ → % |
| `Wind_Res_Rate` | `304003250` | 5000 | `{0}:{50%}` | 10⁻⁴ → % |

Les huit clés déjà couvertes sont rapprochées de
`Activethird_Damadd_Rate`, `AllElement_Rate`, `All_Element_Res_Rate`,
`I_MaxHpAdd_Rate`, `Normalattack_Damadd_Rate`,
`Normalskill_Damadd_Rate`, `Normalskillchangetag_Damadd_Rate` et
`Ultimateskill_Damadd_Rate`.

`Move_Spd` et `T_MaxHP` ne rejoignent pas `stat-metadata.json` : leur unité
est portée par l'opération `Per` de l'occurrence. La priorité d'extraction
reste : correspondance numérique locale, puis `Per`, puis métadonnée. Elle
préserve notamment les occurrences `T_Atk` contextuelles déclarées `Per`
même si son repli stable est plat.

## Garde-fous texte/table

- `302000001` contient `H_HealReceive_Rate=-2000` et les remplacements
  `{0}:{1}`, `{1}:{10%}`, `{2}:{20%}`. Seul `20 %` correspond à la valeur de
  table : associer les listes par position produirait un résultat faux.
- `302000002` contient `H_HealReceive_Rate=-600`, donc `-6 %`, alors que le
  texte remplace son paramètre par `15 %`. L'extraction conserve `-6 %` dans
  `valeur` et fournit séparément la description substituée dans `texteJeu`.

`controleValeurs` compte, après déduplication des variantes, les valeurs dont
l'unité est prouvée, celles laissées brutes et les désaccords texte/table.
