/* Catalogue de build et validation d'une configuration.

   Deux moities : la lecture du catalogue genere (stats-build.js) pour une
   piece ou une arme, et le diagnostic d'une configuration saisie par le
   membre — champs manquants, valeurs hors bornes, perles incoherentes.

   Rien ici ne calcule de statistique finale : c'est le role de
   js/stats-calcul.js, qui s'appuie sur ce module. */

import { BUILD_STATS } from "../noyau/constantes.js";
import { isInteger, owns } from "../noyau/outils.js";
import {
  enchantmentExpectedLength,
  enchantmentRequiredLength,
  pearlSlotCount
} from "./perles.js";

  const BUILD_GEAR = BUILD_STATS.gearByFile || {};
  const BUILD_ENGRAVED = BUILD_STATS.engravedByFile || {};
  const BUILD_GEAR_SETS = BUILD_STATS.gearSets || {};
  const BUILD_CHARACTERS = BUILD_STATS.charactersBySlug || {};
  const WEAPON_PASSIVE_MAX_LEVEL = 7;
  const GEAR_PASSIVE_MAX_LEVEL = 3;
  function buildGearDefinition(file){
    if(typeof file !== "string" || !file) return null;
    if(owns(BUILD_GEAR, file)) return BUILD_GEAR[file];
    if(owns(BUILD_ENGRAVED, file)) return BUILD_ENGRAVED[file];
    return null;
  }

  function gearEnchantmentLength(definition){
    const options = definition && definition.randomOptions;
    return options && Number.isFinite(options.slots)
      ? Math.max(0, Math.trunc(options.slots))
      : 0;
  }

  function gearPassiveStatus(definition, config){
    if(!definition || !Array.isArray(definition.passiveLevels)
      || definition.passiveLevels.length === 0){
      return "not-applicable";
    }
    if(!config || config.passiveLevel === undefined
      || config.passiveLevel === null){
      return "missing";
    }
    return isInteger(config.passiveLevel)
      && config.passiveLevel >= 1
      && config.passiveLevel <= GEAR_PASSIVE_MAX_LEVEL
      ? "valid" : "incompatible";
  }
  function gearEnchantmentChoiceStatus(definition, choice, index){
    if(choice === null) return "valid";
    if(!choice || typeof choice !== "object" || Array.isArray(choice)){
      return "incompatible";
    }
    if(enchantmentFieldIsMissing(choice, "slot")
      || enchantmentFieldIsMissing(choice, "stat")
      || enchantmentFieldIsMissing(choice, "value")){
      return "incomplete";
    }
    if(!isInteger(choice.slot) || choice.slot !== index) return "incompatible";
    return allowedEnchantValueStatus(
      choice,
      (definition.randomOptions && definition.randomOptions.stats) || []
    );
  }
  function gearEnchantmentsStatus(definition, enchantments){
    let status = "valid";
    const seenStats = new Set();
    enchantments.forEach((choice, index) => {
      if(choice && typeof choice === "object"
        && typeof choice.stat === "string" && choice.stat){
        if(seenStats.has(choice.stat)){
          status = "incompatible";
          return;
        }
        seenStats.add(choice.stat);
      }
      const choiceStatus = gearEnchantmentChoiceStatus(definition, choice, index);
      if(choiceStatus === "incompatible"){
        status = "incompatible";
      }else if(choiceStatus === "incomplete" && status === "valid"){
        status = "incomplete";
      }
    });
    return status;
  }
  function gearConfigStatus(file, config){
    const definition = buildGearDefinition(file);
    if(!definition) return "unavailable";
    if(!definition.mainValues || !definition.mainAdd) return "unavailable";
    if(config === undefined || config === null) return "missing";
    if(typeof config !== "object" || Array.isArray(config) || config.version !== 1){
      return "incompatible";
    }
    const required = ["level", "reinforce", "enchantments"];
    if(required.some(key => !owns(config, key) || config[key] === null)){
      return "incomplete";
    }
    if(!isInteger(config.level) || !isInteger(config.reinforce)){
      return "incompatible";
    }
    if(config.level < definition.qualityMin
      || config.level > definition.qualityMax
      || config.reinforce < 0
      || config.reinforce > definition.reinforceMax
      || !Array.isArray(config.enchantments)){
      return "incompatible";
    }
    const length = gearEnchantmentLength(definition);
    if(config.enchantments.length > length) return "incompatible";
    const status = gearEnchantmentsStatus(definition, config.enchantments);
    if(status === "incompatible") return "incompatible";
    if(config.enchantments.length < length) return "incomplete";
    return status;
  }

  const ARMOR_LEVEL_ORIGIN_MODE = "segment-lower-bound";
  const REINFORCE_PROGRESSION = [10300, 10700, 11200, 11800, 12500];
  function reinforceMultiplier(level){
    const step = Math.trunc(Number(level) || 0);
    if(step <= 0) return 1;
    const rate = REINFORCE_PROGRESSION[step - 1];
    return rate ? rate / 10000 : 1;
  }
  function gearSegmentCount(definition){
    const bounds = (definition && definition.tierBoundaries) || [];
    return Math.max(1, bounds.length - 1);
  }
  function gearSegmentIndex(definition, level){
    const bounds = (definition && definition.tierBoundaries) || [];
    const count = gearSegmentCount(definition);
    let index = 0;
    for(let cursor = 1; cursor < bounds.length; cursor += 1){
      if(level > bounds[cursor]) index = cursor;
    }
    return Math.min(index, count - 1);
  }
  function gearLevelOrigin(definition, index){
    const bounds = (definition && definition.tierBoundaries) || [];
    if(ARMOR_LEVEL_ORIGIN_MODE === "quality-min"){
      return definition.qualityMin;
    }
    const bound = bounds.length > 1 ? bounds[index] : bounds[0];
    return Number.isFinite(bound) ? bound + 1 : definition.qualityMin;
  }
  function gearStatValue(definition, curve, add, level, reinforce){
    if(!curve || !Array.isArray(curve.progression)) return 0;
    const index = gearSegmentIndex(definition, level);
    const origin = gearLevelOrigin(definition, index);
    const segmentBase = Number(curve.progression[index]);
    const base = Number.isFinite(segmentBase)
      ? segmentBase
      : (Number(curve.base) || 0);
    const addValue = add && Array.isArray(add.progression)
      ? Number(add.progression[index])
      : 0;
    const perLevel = Number.isFinite(addValue) ? addValue : 0;
    const steps = Math.max(0, Math.trunc(level) - origin);
    return gameCeil(
      (base + perLevel * steps) * reinforceMultiplier(reinforce)
    );
  }
  function buildWeaponDefinition(file){
    return file && owns(BUILD_STATS.weaponsByFile, file)
      ? BUILD_STATS.weaponsByFile[file]
      : null;
  }
  function weaponPassiveFact(definition, config){
    if(!definition || !Array.isArray(definition.passiveLevels)
      || definition.passiveLevels.length === 0
      || !config || !isInteger(config.overlimit)
      || config.overlimit < 0 || config.overlimit >= WEAPON_PASSIVE_MAX_LEVEL){
      return null;
    }
    const level = config.overlimit + 1;
    const passive = definition.passiveLevels.find(item => item.level === level);
    if(!passive) return null;
    return {
      key:"passiveLevel",
      level,
      value:level,
      maxLevel:WEAPON_PASSIVE_MAX_LEVEL,
      text:passive.textFr || "",
      source:{ domain:"weapon", component:"passive" }
    };
  }
  function buildWeaponGrade(file, gameId){
    const weapon = buildWeaponDefinition(file);
    return weapon && owns(weapon.gradesByGameId, gameId)
      ? weapon.gradesByGameId[gameId]
      : null;
  }
  function weaponLevelCap(grade, promotion){
    const steps = Array.isArray(grade && grade.promotionSteps)
      ? grade.promotionSteps : [];
    if(!steps.length) return -1;
    if(promotion === 0) return Math.max(0, Number(steps[0].reinforceMax) - 10);
    const step = steps[promotion - 1];
    return step ? Number(step.reinforceMax) : -1;
  }

  function nativeWeaponCurveIsComplete(curve){
    return !!curve && typeof curve === "object" && !Array.isArray(curve)
      && Number.isFinite(curve.base)
      && Number.isFinite(curve.max)
      && Array.isArray(curve.progression)
      && curve.progression.every(Number.isFinite);
  }
  function weaponGradeHasCompleteNativeCurves(grade){
    return nativeWeaponCurveIsComplete(grade && grade.mainStatValues)
      && nativeWeaponCurveIsComplete(grade && grade.promotionValues)
      && Array.isArray(grade && grade.subStats)
      && grade.subStats.every(subStat =>
        nativeWeaponCurveIsComplete(subStat && subStat.values)
      );
  }
  function weaponHasCompleteNativeCurves(weapon){
    return !!weapon && Object.values(weapon.gradesByGameId || {})
      .some(weaponGradeHasCompleteNativeCurves);
  }
  function enchantmentFieldIsMissing(choice, key){
    return !owns(choice, key) || choice[key] === null || choice[key] === "";
  }
  function allowedEnchantValueStatus(choice, options){
    if(enchantmentFieldIsMissing(choice, "stat")) return "incomplete";
    if(typeof choice.stat !== "string") return "incompatible";
    const option = (options || []).find(item =>
      item && item.stat === choice.stat
    );
    if(!option) return "incompatible";
    if(enchantmentFieldIsMissing(choice, "value")) return "incomplete";
    if(!isInteger(choice.value)) return "incompatible";
    return choice.value >= option.min && choice.value <= option.max
      ? "valid" : "incompatible";
  }
  function enchantmentChoiceStatus(grade, choice, index){
    const catalog = grade.enchantments;
    if(catalog.type === "basic"){
      if(choice === null) return "valid";
      if(!choice || typeof choice !== "object" || Array.isArray(choice)){
        return "incompatible";
      }
      if(enchantmentFieldIsMissing(choice, "slot")) return "incomplete";
      if(choice.slot !== index) return "incompatible";
      return allowedEnchantValueStatus(
        choice,
        (catalog.options || []).map(option => Object.assign(
          {},
          option,
          enchantmentBounds(option, catalog.slots[index])
        ))
      );
    }
    if(catalog.type === "masterstone"){
      if(choice === null) return "valid";
      if(!choice || typeof choice !== "object" || Array.isArray(choice)){
        return "incompatible";
      }
      if(enchantmentFieldIsMissing(choice, "slot")
        || enchantmentFieldIsMissing(choice, "tier")){
        return "incomplete";
      }
      if(choice.slot !== index || !isInteger(choice.tier)) return "incompatible";
      if(index >= pearlSlotCount(choice.tier)) return "incompatible";
      const tier = (catalog.tiers || []).find(item => item && item.tier === choice.tier);
      if(!tier) return "incompatible";
      let group = tier;
      if(tier.elements){
        if(enchantmentFieldIsMissing(choice, "element")) return "incomplete";
        if(typeof choice.element !== "string") return "incompatible";
        group = (tier.elements || [])
          .find(item => item && item.element === choice.element);
        if(!group) return "incompatible";
      }else if(!owns(choice, "element") || choice.element === undefined){
        return "incomplete";
      }else if(choice.element !== null){
        return "incompatible";
      }
      return allowedEnchantValueStatus(choice, group.options);
    }
    return "incompatible";
  }

  function pearlEntriesAgree(enchantments){
    const filled = (enchantments || []).filter(choice =>
      choice && typeof choice === "object" && !Array.isArray(choice)
    );
    if(filled.length < 2) return true;
    const first = filled[0];
    return filled.every(choice =>
      choice.tier === first.tier
      && (choice.element || null) === (first.element || null)
    );
  }

  function pearlStatsAreDistinct(enchantments){
    const stats = (enchantments || [])
      .map(choice => choice && typeof choice === "object" ? choice.stat : null)
      .filter(stat => typeof stat === "string" && stat !== "");
    return new Set(stats).size === stats.length;
  }
  function enchantmentsStatus(grade, enchantments){
    let status = "valid";
    if(grade && grade.enchantments && grade.enchantments.type === "masterstone"
      && (!pearlEntriesAgree(enchantments) || !pearlStatsAreDistinct(enchantments))){
      return "incompatible";
    }
    enchantments.forEach((choice, index) => {
      const choiceStatus = enchantmentChoiceStatus(grade, choice, index);
      if(choiceStatus === "incompatible"){
        status = "incompatible";
      }else if(choiceStatus === "incomplete" && status === "valid"){
        status = "incomplete";
      }
    });
    return status;
  }

  function weaponConfigStatus(file, config){
    const weapon = buildWeaponDefinition(file);
    if(!weapon) return "unavailable";
    if(!weaponHasCompleteNativeCurves(weapon)) return "unavailable";
    if(config === undefined || config === null) return "missing";
    if(!config || typeof config !== "object" || Array.isArray(config) || config.version !== 1){
      return "incompatible";
    }
    const required = ["gradeGameId", "level", "promotion", "overlimit", "enchantments"];
    if(required.some(key => !owns(config, key) || config[key] === null)) return "incomplete";
    const grade = buildWeaponGrade(file, config.gradeGameId);
    if(!grade) return "incompatible";
    if(!weaponGradeHasCompleteNativeCurves(grade)) return "unavailable";
    if(!isInteger(config.level) || !isInteger(config.promotion) || !isInteger(config.overlimit)){
      return "incompatible";
    }
    const cap = weaponLevelCap(grade, config.promotion);
    if(cap < 0 || config.promotion < 0 || config.promotion > grade.promotionSteps.length
      || config.level < 0 || config.level > cap){
      return "incompatible";
    }
    const overlimitLevels = grade.overlimit && Array.isArray(grade.overlimit.levels)
      ? grade.overlimit.levels : null;
    if(overlimitLevels){
      if(!overlimitLevels.some(item => item && item.level === config.overlimit)) return "incompatible";
    }else if(config.overlimit !== 0){
      return "incompatible";
    }
    if(!Array.isArray(config.enchantments)) return "incompatible";
    const maximumLength = enchantmentExpectedLength(grade, config.enchantments);
    const minimumLength = enchantmentRequiredLength(grade, config.enchantments);
    if(maximumLength < 0 || minimumLength < 0) return "incompatible";
    /* Trop d'emplacements = état impossible, quel que soit le type.
       Pas assez : pour un enchantement basique le nombre est fixé par les
       données, donc c'est invalide ; pour une perle c'est une saisie en cours,
       ou une configuration enregistrée avant que les paliers ouvrent plusieurs
       emplacements — on la déclare incomplète pour ne pas condamner les données
       déjà en base. */
    const isPearl = grade.enchantments.type === "masterstone";
    if(config.enchantments.length > maximumLength) return "incompatible";
    /* `incompatible` prime sur `incomplete` : une stat interdite ou une valeur
       hors bornes reste invalide même dans un tableau encore court. On valide
       donc le contenu avant de juger la longueur. */
    const currentEnchantmentsStatus = enchantmentsStatus(grade, config.enchantments);
    if(currentEnchantmentsStatus === "incompatible") return "incompatible";
    if(config.enchantments.length < minimumLength){
      return isPearl ? "incomplete" : "incompatible";
    }
    return currentEnchantmentsStatus;
  }

  function enchantmentBounds(option, slotRate){
    return {
      min:Math.ceil(Number(option.min) * Number(slotRate) / 10000),
      max:Math.floor(Number(option.max) * Number(slotRate) / 10000)
    };
  }

  function gameCeil(value){
    return Math.ceil(Number(value) - 1e-9);
  }

export {
  ARMOR_LEVEL_ORIGIN_MODE,
  BUILD_CHARACTERS,
  BUILD_GEAR,
  BUILD_GEAR_SETS,
  GEAR_PASSIVE_MAX_LEVEL,
  WEAPON_PASSIVE_MAX_LEVEL,
  allowedEnchantValueStatus,
  buildGearDefinition,
  buildWeaponDefinition,
  buildWeaponGrade,
  enchantmentBounds,
  enchantmentChoiceStatus,
  enchantmentsStatus,
  gameCeil,
  gearConfigStatus,
  gearEnchantmentChoiceStatus,
  gearEnchantmentLength,
  gearPassiveStatus,
  gearStatValue,
  weaponConfigStatus,
  weaponPassiveFact,
  weaponLevelCap
};
