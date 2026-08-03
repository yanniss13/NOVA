/* Le moteur de calcul des statistiques d'un build.

   Il produit des *termes* — « +120 ATK, venant du passif de l'arme » — et non
   des totaux opaques : c'est ce qui permet a l'interface d'expliquer chaque
   chiffre au membre. js/stats-affichage.js met ces termes en forme.

   33 declarations sur 38 sont privees. N'exporter que ce qui est reellement
   appele du dehors : la surface de ce module est sa seule protection. */

import {
  BUILD_STATS,
  POT_MAX,
  ARMOR_SLOTS,
  JEWEL_SLOTS,
  LINKED_ARMOR_SLOT
} from "../noyau/constantes.js";
import { isInteger, owns } from "../noyau/outils.js";
import {
  equippedEnumOf,
  weaponFolderOf,
  isLinkedArmorCompatible,
  isWeaponCompatible,
  weaponTypesOf
} from "./armes.js";

import {
  ARMOR_LEVEL_ORIGIN_MODE,
  BUILD_CHARACTERS,
  BUILD_GEAR_SETS,
  GEAR_PASSIVE_MAX_LEVEL,
  WEAPON_PASSIVE_MAX_LEVEL,
  buildGearDefinition,
  gearPassiveStatus,
  weaponPassiveFact,
  buildWeaponDefinition,
  buildWeaponGrade,
  gameCeil,
  gearConfigStatus,
  gearStatValue,
  weaponConfigStatus
} from "./build-config.js";

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * les taux principaux du héros portent sur tous ses apports fixes avant les
   * passifs. Protocole : relever les statistiques d'un nouveau personnage
   * avant son premier potentiel puis juste après, équipement inchangé. Si la
   * mesure contredit cette base, changer uniquement ce mode et
   * heroMainRateTargetBuckets().
   */
  const HERO_STAT_COVERAGE = [
    "character",
    "mastery",
    "potential",
    "weapon",
    "armor",
    "jewel",
    "engraving",
    "set"
  ];

  function curveValueAtLevel(curve, level){
    const base = Number(curve && curve.base) || 0;
    const current = Math.max(0, Math.trunc(Number(level) || 0));
    return (curve && Array.isArray(curve.progression) ? curve.progression : [])
      .reduce((total, increment, index) =>
        total + Number(increment) * Math.max(0, Math.min(10, current - index * 10)),
        base
      );
  }

  function promotionValueAt(grade, promotion){
    const values = grade && grade.promotionValues;
    const count = Math.max(0, Math.trunc(Number(promotion) || 0));
    return (Array.isArray(values && values.progression)
      ? values.progression.slice(0, count) : []
    ).reduce((sum, value) => sum + Number(value), Number(values && values.base) || 0);
  }

  const OVERLIMIT_APPLICATION_MODE = "native-before-enchantments";

  function overlimitTargetBuckets(mode){
    if(mode === "native-before-enchantments") return ["weapon-native"];
    if(mode === "native-and-enchantments"){
      return ["weapon-native", "weapon-enchantment"];
    }
    throw new Error("OVERLIMIT_MODE_INVALID");
  }

  function assertBuildStatTerm(term){
    if(!term || typeof term.stat !== "string" || !term.stat || term.stat === "*"){
      throw new Error("BUILD_STAT_CONCRETE_STAT_REQUIRED");
    }
    if(term.operation !== "add" && term.operation !== "multiply"){
      throw new Error("BUILD_STAT_OPERATION_INVALID");
    }
    if(term.unit !== "flat" && term.unit !== "ten-thousandths"){
      throw new Error("BUILD_STAT_UNIT_INVALID");
    }
    if(term.confidence !== "exact" && term.confidence !== "presumed"){
      throw new Error("BUILD_STAT_CONFIDENCE_INVALID");
    }
    if(typeof term.family !== "string" || !term.family){
      throw new Error("BUILD_STAT_FAMILY_REQUIRED");
    }
    if(!term.source || typeof term.source !== "object"
      || typeof term.source.domain !== "string" || !term.source.domain
      || typeof term.source.component !== "string" || !term.source.component){
      throw new Error("BUILD_STAT_SOURCE_REQUIRED");
    }
    if(!Number.isFinite(term.value)){
      throw new Error("BUILD_STAT_VALUE_INVALID");
    }
    if(term.operation === "add"){
      if(typeof term.bucket !== "string" || !term.bucket){
        throw new Error("BUILD_STAT_BUCKET_REQUIRED");
      }
      return;
    }
    if(term.unit !== "ten-thousandths"){
      throw new Error("BUILD_STAT_MULTIPLIER_UNIT_INVALID");
    }
    if(!Array.isArray(term.appliesTo) || !term.appliesTo.length
      || term.appliesTo.some(bucket => typeof bucket !== "string" || !bucket)){
      throw new Error("BUILD_STAT_TARGETS_INVALID");
    }
  }

  function reconstructStatTotals(terms){
    if(!Array.isArray(terms)) throw new Error("BUILD_STAT_TERMS_INVALID");
    const stats = new Map();
    terms.forEach(term => {
      assertBuildStatTerm(term);
      if(!stats.has(term.stat)){
        stats.set(term.stat, { unit:null, buckets:new Map(), multipliers:[] });
      }
      const entry = stats.get(term.stat);
      if(term.operation === "add"){
        if(entry.unit !== null && entry.unit !== term.unit){
          throw new Error("BUILD_STAT_UNIT_MISMATCH");
        }
        entry.unit = term.unit;
        entry.buckets.set(
          term.bucket,
          (entry.buckets.get(term.bucket) || 0) + term.value
        );
      }else{
        entry.multipliers.push(term);
      }
    });

    return [...stats.entries()]
      .filter(([, entry]) => entry.unit !== null)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([stat, entry]) => {
        const producedBuckets = new Set(
          entry.multipliers
            .map(term => term.bucket)
            .filter(bucket => typeof bucket === "string" && bucket)
        );
        let pending = entry.multipliers.filter(term => producedBuckets.has(term.bucket));
        while(pending.length){
          const ready = pending.filter(term =>
            term.appliesTo.every(bucket =>
              entry.buckets.has(bucket) || !producedBuckets.has(bucket)
            )
          );
          if(!ready.length) throw new Error("BUILD_STAT_TARGET_UNRESOLVED");
          ready.forEach(term => {
            if(!term.appliesTo.some(bucket => entry.buckets.has(bucket))){
              throw new Error("BUILD_STAT_TARGET_UNRESOLVED");
            }
            const base = term.appliesTo.reduce(
              (targeted, bucket) => targeted + (entry.buckets.get(bucket) || 0),
              0
            );
            entry.buckets.set(
              term.bucket,
              (entry.buckets.get(term.bucket) || 0)
                + base * term.value / 10000
            );
          });
          const resolved = new Set(ready);
          pending = pending.filter(term => !resolved.has(term));
        }
        const finalMultipliers = entry.multipliers
          .filter(term => !producedBuckets.has(term.bucket));
        const multiplied = finalMultipliers.reduce((sum, term) => {
          if(!term.appliesTo.some(bucket => entry.buckets.has(bucket))){
            throw new Error("BUILD_STAT_TARGET_UNRESOLVED");
          }
          const base = term.appliesTo.reduce(
            (targeted, bucket) => targeted + (entry.buckets.get(bucket) || 0),
            0
          );
          return sum + base * term.value / 10000;
        }, 0);
        const bucketTotal = [...entry.buckets.values()]
          .reduce((sum, value) => sum + value, 0);
        return { stat, unit:entry.unit, value:bucketTotal + multiplied };
      });
  }

  function buildStatMetadata(stat){
    const metadata = owns(BUILD_STATS.statLabels, stat)
      ? BUILD_STATS.statLabels[stat] : null;
    if(!metadata || typeof metadata.family !== "string"
      || (metadata.unit !== "flat" && metadata.unit !== "ten-thousandths")){
      throw new Error("BUILD_STAT_METADATA_MISSING");
    }
    return metadata;
  }
  function appendCeilRoundingTerm(terms, stat, bucket, source){
    const total = reconstructStatTotals(terms)
      .find(entry => entry.stat === stat);
    if(!total || total.unit !== "flat") return;
    const rounded = gameCeil(total.value);
    const delta = rounded - total.value;
    if(delta === 0) return;
    const metadata = buildStatMetadata(stat);
    terms.push({
      id:"rounding:"+bucket+":"+stat,
      stat,
      operation:"add",
      value:delta,
      unit:"flat",
      bucket,
      family:metadata.family,
      source:Object.assign({
        domain:"rounding",
        component:"final-ceil"
      }, source || {}),
      confidence:"exact"
    });
  }

  const HERO_MAIN_STAT_MAP = {
    B_Atk_Equip:"B_Atk",
    B_Def_Equip:"B_Def",
    B_MaxHp_Equip:"B_MaxHp"
  };
  const CHARACTER_BASE_SOURCE_FIELDS = {
    B_MaxHp:"baseHp",
    B_Atk:"baseAtk",
    B_Def:"baseDef",
    baseSpd:"baseSpd",
    accuracy:"accuracy",
    block:"block",
    critRate:"critRate",
    critDamage:"critDamage",
    critResist:"critResist",
    critDmgResist:"critDmgResist",
    blockDmgResist:"blockDmgResist",
    pvpDmgUp:"pvpDmgUp",
    pvpDmgDown:"pvpDmgDown"
  };
  function characterDefinitionForHero(hero){
    const charId = hero && hero.char;
    return typeof charId === "string" && owns(BUILD_CHARACTERS, charId)
      ? BUILD_CHARACTERS[charId] : null;
  }
  function heroAdditiveTerm(settings){
    const metadata = buildStatMetadata(settings.stat);
    return {
      id:settings.id,
      stat:settings.stat,
      operation:"add",
      value:Number(settings.value),
      unit:metadata.unit,
      bucket:settings.bucket,
      family:metadata.family,
      source:settings.source,
      confidence:"exact"
    };
  }
  function characterBaseTerms(definition){
    if(!definition || !Array.isArray(definition.baseStats)) return [];
    return definition.baseStats
      .filter(item => Number(item.value) !== 0)
      .map((item, index) => heroAdditiveTerm({
        id:"character:base:"+index+":"+item.stat,
        stat:item.stat,
        value:item.value,
        bucket:"character:base",
        source:{
          domain:"character",
          component:"base",
          field:CHARACTER_BASE_SOURCE_FIELDS[item.stat] || item.stat
        }
      }));
  }
  function fullMasteryTerms(definition, weaponType){
    if(!definition) return [];
    const common = (definition.commonMasteryStats || [])
      .filter(item => Number(item.value) !== 0)
      .map((item, index) => heroAdditiveTerm({
        id:"mastery:common:"+index+":"+item.stat,
        stat:item.stat,
        value:item.value,
        bucket:"mastery:common",
        source:{
          domain:"mastery",
          component:"common-mastery",
          index
        }
      }));
    const branch = definition.masteriesByWeapon
      && definition.masteriesByWeapon[weaponType];
    const weapon = branch && Array.isArray(branch.abilities)
      ? branch.abilities : [];
    return common.concat(
      weapon
        .filter(item => Number(item.value) !== 0)
        .map((item, index) => heroAdditiveTerm({
          id:"mastery:"+weaponType+":"+index+":"+item.stat,
          stat:item.stat,
          value:item.value,
          bucket:"mastery:"+weaponType,
          source:Object.assign({
            domain:"mastery",
            component:"weapon-mastery",
            weaponType
          }, item.source || {})
        }))
    );
  }
  function reserveMasteryTerms(definition, activeWeaponType){
    if(!definition || !definition.masteriesByWeapon) return [];
    return Object.entries(definition.masteriesByWeapon)
      .filter(([weaponType]) => weaponType !== activeWeaponType)
      .flatMap(([weaponType, branch]) => {
        const abilities = branch && Array.isArray(branch.abilities)
          ? branch.abilities : [];
        return abilities
          .filter(item => item && item.source
            && (item.source.kind === "subLevel"
              || (item.source.kind === "node"
                && item.source.nodeType === "Special")))
          .filter(item => Number(item.value) !== 0)
          .map((item, index) => heroAdditiveTerm({
            id:"mastery:reserve:"+weaponType+":"+index+":"+item.stat,
            stat:item.stat,
            value:item.value,
            bucket:"mastery:reserve:"+weaponType,
            source:Object.assign({
              domain:"mastery",
              component:"reserve-weapon-mastery",
              weaponType
            }, item.source || {})
          }));
      });
  }
  function potentialTerms(definition, weaponType, tier){
    if(!definition || !isInteger(tier) || tier <= 0 || tier > POT_MAX){
      return [];
    }
    const branch = definition.potentialsByWeapon
      && definition.potentialsByWeapon[weaponType];
    const snapshot = branch && branch[String(tier)];
    if(!Array.isArray(snapshot)) return [];
    return snapshot
      .filter(item => Number(item.value) !== 0)
      .map((item, index) => heroAdditiveTerm({
        id:"potential:"+weaponType+":"+tier+":"+index+":"+item.stat,
        stat:item.stat,
        value:item.value,
        bucket:"potential:"+weaponType+":"+tier,
        source:{
          domain:"potential",
          component:"potential",
          weaponType,
          tier,
          index
        }
      }));
  }
  function canonicalHeroTerm(term){
    const mapped = HERO_MAIN_STAT_MAP[term.stat] || term.stat;
    if(mapped === term.stat){
      return Object.assign({}, term, { source:Object.assign({}, term.source) });
    }
    const metadata = buildStatMetadata(mapped);
    return Object.assign({}, term, {
      stat:mapped,
      unit:term.operation === "multiply" ? term.unit : metadata.unit,
      family:metadata.family,
      source:Object.assign({}, term.source, { originalStat:term.stat })
    });
  }

  function addWeaponStatTerm(terms, settings){
    if(settings.value === 0) return;
    const metadata = buildStatMetadata(settings.stat);
    terms.push({
      id:settings.id,
      stat:settings.stat,
      operation:"add",
      value:settings.value,
      unit:metadata.unit,
      bucket:settings.bucket,
      role:settings.role,
      family:metadata.family,
      source:settings.source,
      confidence:"exact"
    });
  }

  function emptyWeaponStatResult(status){
    return {
      version:1,
      status,
      coverage:[],
      uncovered:[],
      assumptions:{ overlimitBase:OVERLIMIT_APPLICATION_MODE },
      terms:[],
      totals:[],
      facts:[]
    };
  }

  function calculateWeaponStats(file, config){
    const status = weaponConfigStatus(file, config);
    if(status !== "valid") return emptyWeaponStatResult(status);

    const weapon = buildWeaponDefinition(file);
    const grade = buildWeaponGrade(file, config.gradeGameId);
    const terms = [];
    const facts = [];
    const nativeBucket = "weapon-native";
    const enchantmentBucket = "weapon-enchantment";
    const mainStat = weapon.mainStatCode;

    addWeaponStatTerm(terms, {
      id:"weapon:level:"+mainStat,
      role:"main",
      stat:mainStat,
      value:curveValueAtLevel(grade.mainStatValues, config.level),
      bucket:nativeBucket,
      source:{ domain:"weapon", component:"level", id:file }
    });
    addWeaponStatTerm(terms, {
      id:"weapon:promotion:"+mainStat,
      role:"main",
      stat:mainStat,
      value:promotionValueAt(grade, config.promotion),
      bucket:nativeBucket,
      source:{ domain:"weapon", component:"promotion", id:file }
    });
    (grade.subStats || []).forEach((subStat, index) => {
      addWeaponStatTerm(terms, {
        id:"weapon:level:"+subStat.stat+":"+index,
        role:"sub",
        stat:subStat.stat,
        value:curveValueAtLevel(subStat.values, config.level),
        bucket:nativeBucket,
        source:{ domain:"weapon", component:"level", id:file, subStat:index }
      });
    });
    config.enchantments.forEach((enchantment, slot) => {
      if(enchantment === null) return;
      addWeaponStatTerm(terms, {
        id:"weapon:enchantment:"+slot+":"+enchantment.stat,
        role:"enchantment",
        stat:enchantment.stat,
        value:enchantment.value,
        bucket:enchantmentBucket,
        source:{
          domain:"weapon",
          component:"enchantment",
          id:file,
          slot
        }
      });
    });

    const overlimitLevels = grade.overlimit && Array.isArray(grade.overlimit.levels)
      ? grade.overlimit.levels : [];
    const overlimit = overlimitLevels.find(level => level.level === config.overlimit);
    const passiveFact = weaponPassiveFact(weapon, config);
    if(passiveFact){
      passiveFact.source.id = file;
      facts.push(passiveFact);
    }
    if(overlimit && Number(overlimit.statRate) !== 0){
      const appliesTo = overlimitTargetBuckets(OVERLIMIT_APPLICATION_MODE);
      const metadata = buildStatMetadata(mainStat);
      terms.push({
        id:"weapon:overlimit:"+mainStat,
        stat:mainStat,
        operation:"multiply",
        value:Number(overlimit.statRate),
        unit:"ten-thousandths",
        appliesTo:[...appliesTo],
        bucket:"weapon-overlimit",
        family:metadata.family,
        source:{ domain:"weapon", component:"overlimit", id:file },
        confidence:"exact"
      });
    }
    appendCeilRoundingTerm(
      terms,
      mainStat,
      "weapon-rounding",
      { domain:"weapon", component:"final-rounding", scope:"weapon", id:file }
    );

    return {
      version:1,
      status,
      coverage:["weapon"],
      /* Le texte du passif fixe est consultable, mais sa prose conditionnelle
         n'est pas transformee en termes numeriques. */
      uncovered:passiveFact ? ["weapon:passive"] : [],
      assumptions:{ overlimitBase:OVERLIMIT_APPLICATION_MODE },
      terms,
      totals:reconstructStatTotals(terms),
      facts
    };
  }

  function gearDomainOf(slotKey){
    return JEWEL_SLOTS.indexOf(slotKey) >= 0
      ? "jewel"
      : (slotKey === LINKED_ARMOR_SLOT ? "engraving" : "armor");
  }
  function addGearStatTerm(terms, settings){
    if(settings.value === 0) return;
    const metadata = buildStatMetadata(settings.stat);
    terms.push({
      id:settings.id,
      stat:settings.stat,
      operation:"add",
      value:settings.value,
      unit:metadata.unit,
      bucket:settings.bucket,
      role:settings.role,
      family:metadata.family,
      source:settings.source,
      confidence:settings.confidence
    });
  }
  function emptyGearStatResult(status){
    return {
      version:1,
      status,
      coverage:[],
      uncovered:[],
      assumptions:{ armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE },
      terms:[],
      totals:[],
      facts:[]
    };
  }
  function calculateGearStats(file, config, slotKey){
    const status = gearConfigStatus(file, config);
    if(status !== "valid") return emptyGearStatResult(status);

    const definition = buildGearDefinition(file);
    const domain = gearDomainOf(slotKey);
    const bucket = domain + ":" + slotKey;
    const terms = [];
    addGearStatTerm(terms, {
      id:bucket + ":main:" + definition.mainStat,
      role:"main",
      stat:definition.mainStat,
      value:gearStatValue(
        definition,
        definition.mainValues,
        definition.mainAdd,
        config.level,
        config.reinforce
      ),
      bucket,
      source:{ domain, component:"level", slot:slotKey, id:file },
      confidence:"presumed"
    });
    if(definition.subStat && definition.subValues){
      addGearStatTerm(terms, {
        id:bucket + ":sub:" + definition.subStat,
        role:"sub",
        stat:definition.subStat,
        value:gearStatValue(
          definition,
          definition.subValues,
          definition.subAdd,
          config.level,
          config.reinforce
        ),
        bucket,
        source:{ domain, component:"level", slot:slotKey, id:file },
        confidence:"presumed"
      });
    }
    (definition.extraStats || []).forEach((extra, index) => {
      addGearStatTerm(terms, {
        id:bucket + ":extra:" + index + ":" + extra.stat,
        role:"extra",
        stat:extra.stat,
        value:gearStatValue(
          definition,
          extra.values,
          extra.add,
          config.level,
          config.reinforce
        ),
        bucket,
        source:{
          domain,
          component:"level",
          slot:slotKey,
          id:file,
          extra:true,
          index
        },
        confidence:"presumed"
      });
    });
    config.enchantments.forEach((choice, index) => {
      if(!choice || !choice.stat) return;
      addGearStatTerm(terms, {
        id:bucket + ":enchantment:" + index + ":" + choice.stat,
        role:"enchantment",
        stat:choice.stat,
        value:Number(choice.value) || 0,
        bucket,
        source:{
          domain,
          component:"enchantment",
          slot:slotKey,
          id:file,
          index
        },
        confidence:"exact"
      });
    });

    const uncovered = [];
    if(domain === "engraving"){
      uncovered.push("engraving:passive");
    }
    if(definition.hasEquipPassive){
      uncovered.push("armor:passive");
    }
    return {
      version:1,
      status:"valid",
      coverage:[domain],
      uncovered,
      assumptions:{ armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE },
      terms,
      totals:reconstructStatTotals(terms),
      facts:[]
    };
  }

  function activeGearSets(files){
    const counts = new Map();
    (files || []).forEach(file => {
      const definition = buildGearDefinition(file);
      const setId = definition && definition.setId;
      if(!setId || !owns(BUILD_GEAR_SETS, setId)) return;
      counts.set(setId, (counts.get(setId) || 0) + 1);
    });
    return [...counts.entries()].map(([setId, count]) => {
      const set = BUILD_GEAR_SETS[setId];
      return {
        setId,
        count,
        twoActive:Number.isFinite(set.twoCount) && count >= set.twoCount,
        fourActive:Number.isFinite(set.fourCount) && count >= set.fourCount,
        sevenActive:Number.isFinite(set.sevenCount) && count >= set.sevenCount
      };
    });
  }
  function gearSetTerms(files){
    const terms = [];
    activeGearSets(files).forEach(state => {
      const set = BUILD_GEAR_SETS[state.setId];
      const pushTier = (stats, tier) => {
        (stats || []).forEach(entry => addGearStatTerm(terms, {
          id:"set:" + state.setId + ":" + tier + ":" + entry.stat,
          role:"bonus",
          stat:entry.stat,
          value:Number(entry.value) || 0,
          bucket:"set",
          source:{
            domain:"set",
            component:"bonus",
            setId:state.setId,
            tier
          },
          confidence:"exact"
        }));
      };
      if(state.twoActive) pushTier(set.twoStats, "two");
      if(state.fourActive) pushTier(set.fourStats, "four");
      if(state.sevenActive) pushTier(set.sevenStats, "seven");
    });
    return terms;
  }

  const GEAR_SLOT_DOMAINS = [
    ["armor", ARMOR_SLOTS],
    ["jewel", JEWEL_SLOTS]
  ];
  function calculateBuildStats(build){
    const source = build || {};
    const terms = [];
    const statuses = {};
    const coverage = [];
    const uncovered = [];
    const noteCoverage = list => {
      (list || []).forEach(entry => {
        if(!coverage.includes(entry)) coverage.push(entry);
      });
    };
    const noteUncovered = list => {
      (list || []).forEach(entry => {
        if(!uncovered.includes(entry)) uncovered.push(entry);
      });
    };
    const assumptions = {
      overlimitBase:OVERLIMIT_APPLICATION_MODE,
      armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE
    };

    const weapon = calculateWeaponStats(
      source.weapon,
      source.weaponConfig
    );
    statuses.weapon = weapon.status;
    if(weapon.status === "valid"){
      terms.push(...weapon.terms);
      noteCoverage(weapon.coverage);
      noteUncovered(weapon.uncovered);
    }

    const equipped = [];
    GEAR_SLOT_DOMAINS.forEach(([storageKey, slots]) => {
      slots.forEach(slotKey => {
        const file = (source[storageKey] || {})[slotKey];
        if(!file) return;
        equipped.push(file);
        const configs = source[storageKey + "Config"] || {};
        const result = calculateGearStats(file, configs[slotKey], slotKey);
        const domain = gearDomainOf(slotKey);
        statuses[domain + ":" + slotKey] = result.status;
        if(result.status !== "valid") return;
        terms.push(...result.terms);
        noteCoverage(result.coverage);
        noteUncovered(result.uncovered);
      });
    });

    const setTerms = gearSetTerms(equipped);
    if(setTerms.length){
      terms.push(...setTerms);
      noteCoverage(["set"]);
    }
    return {
      version:1,
      coverage,
      uncovered,
      assumptions,
      terms,
      totals:reconstructStatTotals(terms),
      statuses
    };
  }

  /* Range par emplacement les termes deja calcules, sans rien recalculer.

     La source est `calculateBuildStats` et NON `calculateHeroStats` : la
     seconde renvoie un resultat vide des qu'une seule piece n'est pas
     configuree, ce qui ferait disparaitre les resumes de toutes les autres.
     C'est le cas le plus frequent chez les membres.

     L'arme ne porte pas de `source.slot` : on la reconnait a son domaine.
     Le bonus d'ensemble n'appartient a aucune piece : il sort dans sa propre
     entree, sans quoi la somme des entrees ne ferait plus le total. */
  function groupBuildTermsBySlot(build){
    const source = build || {};
    const result = calculateBuildStats(source);
    const entries = new Map();

    const entryFor = (slot, domain, file) => {
      if(!entries.has(slot)){
        entries.set(slot, { slot, domain, file, status:"valid", terms:[] });
      }
      return entries.get(slot);
    };

    if(source.weapon){
      entryFor("weapon", "weapon", source.weapon).status =
        result.statuses.weapon || "missing";
    }
    GEAR_SLOT_DOMAINS.forEach(([storageKey, slots]) => {
      slots.forEach(slot => {
        const file = (source[storageKey] || {})[slot];
        if(!file) return;
        const domain = gearDomainOf(slot);
        entryFor(slot, domain, file).status =
          result.statuses[domain + ":" + slot] || "missing";
      });
    });

    result.terms.forEach(term => {
      if(term.bucket === "set"){
        entryFor("set", "set", null).terms.push(term);
        return;
      }
      const slot = term.source.domain === "weapon" ? "weapon" : term.source.slot;
      if(!slot || !entries.has(slot)) return;
      entries.get(slot).terms.push(term);
    });

    return [...entries.values()].map(entry => Object.assign({}, entry, {
      totals:reconstructStatTotals(entry.terms)
    }));
  }

  /* Les apports les plus caracteristiques d'une entree.

     On ne compare jamais deux unites entre elles : « PV +4 200 » est en
     points, « CRIT 12 % » en dix-milliemes, et toute normalisation serait
     arbitraire. L'ordre vient donc des roles, qui viennent de la structure
     du jeu. A role egal le tri par valeur est licite : les termes d'un meme
     role partagent leur unite.

     On ne complete jamais pour atteindre la limite : une piece qui n'a qu'un
     role rend un seul apport. */
  const SUMMARY_ROLE_ORDER = ["main", "sub", "extra", "enchantment"];

  function summaryTermsFor(entry, limite){
    const max = isInteger(limite) && limite > 0 ? limite : 3;
    const terms = entry && Array.isArray(entry.terms) ? entry.terms : [];
    if(!terms.length) return [];

    const cumules = new Map();
    terms.forEach(term => {
      const rank = SUMMARY_ROLE_ORDER.indexOf(term.role);
      if(rank < 0) return;
      const cle = term.role + "|" + term.stat;
      if(!cumules.has(cle)){
        cumules.set(cle, { stat:term.stat, unit:term.unit, value:0, rank });
      }
      cumules.get(cle).value += term.value;
    });

    return [...cumules.values()]
      .sort((a, b) => a.rank - b.rank || b.value - a.value)
      .slice(0, max)
      .map(item => ({
        stat:item.stat,
        value:item.value,
        unit:item.unit,
        label:buildStatMetadata(item.stat).fr || item.stat
      }));
  }

  const HERO_MAIN_RATE_APPLICATION_MODE = "all-flat-before-passives";
  const HERO_MAIN_RATE_TARGETS = {
    I_AtkAdd_Rate:"B_Atk",
    I_DefAdd_Rate:"B_Def",
    I_MaxHpAdd_Rate:"B_MaxHp"
  };

  function heroMainRateTargetBuckets(stat, sourceTerms, mode){
    const selectedMode = mode || HERO_MAIN_RATE_APPLICATION_MODE;
    if(selectedMode !== "all-flat-before-passives"){
      throw new Error("HERO_MAIN_RATE_MODE_INVALID");
    }
    const seen = new Set();
    return (sourceTerms || []).reduce((buckets, term) => {
      if(term && (term.operation === "add" || term.operation === "multiply")
        && term.stat === stat
        && (term.operation !== "add" || term.unit === "flat")
        && typeof term.bucket === "string"
        && !seen.has(term.bucket)){
        seen.add(term.bucket);
        buckets.push(term.bucket);
      }
      return buckets;
    }, []);
  }
  function emptyHeroStatResult(status, missing){
    return {
      version:1,
      status,
      coverage:[],
      uncovered:[],
      assumptions:{
        overlimitBase:OVERLIMIT_APPLICATION_MODE,
        armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE,
        heroMainRateApplication:{
          mode:HERO_MAIN_RATE_APPLICATION_MODE,
          confidence:"presumed"
        },
        secondaryWeaponTransfer:{
          mode:SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE,
          confidence:"presumed"
        }
      },
      missing:missing || [],
      partialStats:[],
      terms:[],
      totals:[],
      facts:{ passives:[] }
    };
  }
  function heroGearPassiveFacts(hero){
    const facts = [];
    GEAR_SLOT_DOMAINS.forEach(([storageKey, slots]) => {
      slots.forEach(slot => {
        const file = (hero[storageKey] || {})[slot];
        const definition = buildGearDefinition(file);
        if(!definition || !Array.isArray(definition.passiveLevels)
          || definition.passiveLevels.length === 0){
          return;
        }
        const config = (hero[storageKey + "Config"] || {})[slot];
        const status = gearPassiveStatus(definition, config);
        const level = status === "valid" ? config.passiveLevel : null;
        const passive = status === "valid"
          ? definition.passiveLevels.find(item => item.level === level)
          : null;
        facts.push({
          source:slot === LINKED_ARMOR_SLOT
            ? "engraving:passive" : "armor:passive",
          slot,
          file,
          level,
          maxLevel:GEAR_PASSIVE_MAX_LEVEL,
          status,
          text:passive ? passive.textFr || "" : ""
        });
      });
    });
    return facts;
  }
  const SECONDARY_WEAPON_ATTACK_TRANSFER_RATE = 3000;

  const SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE =
    "before-hero-rates";
  function secondaryWeaponAttackResult(
    hero,
    activeWeaponType,
    applicationMode
  ){
    const selectedMode = applicationMode
      || SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE;
    if(selectedMode !== "before-hero-rates"){
      throw new Error("SECONDARY_WEAPON_TRANSFER_MODE_INVALID");
    }
    const source = hero && typeof hero === "object" ? hero : {};
    const terms = [];
    const missing = [];
    const uncovered = [];
    weaponTypesOf(source.char)
      .filter(type => type !== activeWeaponType)
      .forEach(type => {
        const build = source.rosterBuilds && source.rosterBuilds[type];
        if(!build || !build.weapon){
          missing.push("rosterBuilds."+type+".weapon");
          uncovered.push("secondary-weapon:"+type);
          return;
        }
        const weapon = calculateWeaponStats(
          build.weapon,
          build.weaponConfig
        );
        if(weapon.status !== "valid"){
          missing.push("rosterBuilds."+type+".weaponConfig");
          uncovered.push("secondary-weapon:"+type);
          return;
        }
        const attack = weapon.totals.find(total =>
          total.stat === "B_Atk_Equip" && total.unit === "flat"
        );
        if(!attack){
          missing.push("rosterBuilds."+type+".weaponConfig");
          uncovered.push("secondary-weapon:"+type);
          return;
        }
        const metadata = buildStatMetadata("B_Atk");
        terms.push({
          id:"secondary-weapon:"+type+":attack-transfer",
          stat:"B_Atk",
          operation:"add",
          value:gameCeil(
            attack.value * SECONDARY_WEAPON_ATTACK_TRANSFER_RATE / 10000
          ),
          unit:"flat",
          bucket:"secondary-weapon:"+type,
          family:metadata.family,
          source:{
            domain:"secondary-weapon",
            component:"attack-transfer",
            weaponType:type,
            file:build.weapon,
            originalStat:"B_Atk_Equip",
            originalValue:attack.value,
            transferRate:SECONDARY_WEAPON_ATTACK_TRANSFER_RATE
          },
          confidence:"exact"
        });
      });
    return { terms, missing, uncovered };
  }
  function calculateHeroStats(hero){
    const source = hero && typeof hero === "object" ? hero : {};
    const missing = [];
    let status = "valid";
    const severity = {
      valid:0,
      incomplete:1,
      unavailable:2,
      incompatible:3
    };
    const noteIssue = (path, nextStatus) => {
      if(!missing.includes(path)) missing.push(path);
      if(severity[nextStatus] > severity[status]) status = nextStatus;
    };

    const character = characterDefinitionForHero(source);
    if(!source.char){
      noteIssue("character", "incomplete");
    }else if(!character){
      noteIssue("character", "unavailable");
    }

    const potentialTier = source.potentiel && source.potentiel.tier;
    if(!isInteger(potentialTier) || potentialTier < 0 || potentialTier > POT_MAX){
      noteIssue("potential", "incompatible");
    }

    if(!source.weapon){
      noteIssue("weapon", "incomplete");
    }else if(character && !isWeaponCompatible(source.char, source.weapon)){
      noteIssue("weapon", "incompatible");
    }else if(!buildWeaponDefinition(source.weapon)){
      noteIssue("weapon", "unavailable");
    }else{
      const weaponStatus = weaponConfigStatus(source.weapon, source.weaponConfig);
      if(weaponStatus !== "valid"){
        noteIssue(
          "weaponConfig",
          weaponStatus === "missing" || weaponStatus === "incomplete"
            ? "incomplete" : weaponStatus
        );
      }
    }
    const equippedWeaponType = equippedEnumOf(source);
    if(character && source.weapon && buildWeaponDefinition(source.weapon)
      && isWeaponCompatible(source.char, source.weapon)){
      const mastery = character.masteriesByWeapon
        && character.masteriesByWeapon[equippedWeaponType];
      if(!mastery || mastery.levels !== 5){
        noteIssue("mastery", "unavailable");
      }
      const potentials = character.potentialsByWeapon
        && character.potentialsByWeapon[equippedWeaponType];
      if(isInteger(potentialTier) && potentialTier > 0
        && (!potentials || !Array.isArray(potentials[String(potentialTier)]))){
        noteIssue("potential", "unavailable");
      }
    }

    GEAR_SLOT_DOMAINS.forEach(([storageKey, slots]) => {
      slots.forEach(slot => {
        const file = (source[storageKey] || {})[slot];
        const equipmentPath = storageKey + "." + slot;
        const configPath = storageKey + "Config." + slot;
        if(!file){
          noteIssue(equipmentPath, "incomplete");
          return;
        }
        if(character && slot === LINKED_ARMOR_SLOT
          && !isLinkedArmorCompatible(source.char, file)){
          noteIssue(equipmentPath, "incompatible");
          return;
        }
        if(!buildGearDefinition(file)){
          noteIssue(equipmentPath, "unavailable");
          return;
        }
        const config = (source[storageKey + "Config"] || {})[slot];
        const configStatus = gearConfigStatus(file, config);
        if(configStatus !== "valid"){
          noteIssue(
            configPath,
            configStatus === "missing" || configStatus === "incomplete"
              ? "incomplete" : configStatus
          );
        }
      });
    });

    if(status !== "valid") return emptyHeroStatResult(status, missing);

    const weaponType = equippedWeaponType;
    const activeWeaponType = weaponFolderOf(source.weapon);
    const secondary = secondaryWeaponAttackResult(
      source,
      activeWeaponType
    );
    const build = calculateBuildStats(source);
    const rawTerms = characterBaseTerms(character)
      .concat(fullMasteryTerms(character, weaponType))
      .concat(reserveMasteryTerms(character, weaponType))
      .concat(potentialTerms(character, weaponType, potentialTier))
      .concat(build.terms.map(canonicalHeroTerm))
      .concat(secondary.terms);
    const rateTerms = rawTerms.reduce((terms, rateTerm) => {
      const targetStat = HERO_MAIN_RATE_TARGETS[rateTerm.stat];
      if(!targetStat || rateTerm.operation !== "add"
        || rateTerm.unit !== "ten-thousandths"){
        return terms;
      }
      const appliesTo = heroMainRateTargetBuckets(targetStat, rawTerms);
      if(!appliesTo.length) return terms;
      const metadata = buildStatMetadata(targetStat);
      terms.push({
        id:"hero-main-rate:"+rateTerm.id,
        stat:targetStat,
        operation:"multiply",
        value:rateTerm.value,
        unit:"ten-thousandths",
        appliesTo,
        family:metadata.family,
        source:Object.assign({}, rateTerm.source, {
          originalStat:rateTerm.stat,
          application:"hero-main-rate"
        }),
        confidence:"presumed"
      });
      return terms;
    }, []);
    const terms = rawTerms.concat(rateTerms);
    ["B_Atk", "B_Def", "B_MaxHp"].forEach(stat => {
      appendCeilRoundingTerm(
        terms,
        stat,
        "hero-rounding:"+stat,
        { scope:"hero" }
      );
    });
    const weaponFact = calculateWeaponStats(
      source.weapon,
      source.weaponConfig
    ).facts.find(fact => fact.source && fact.source.component === "passive");
    const passives = heroGearPassiveFacts(source);
    if(weaponFact){
      passives.unshift({
        source:"weapon:passive",
        slot:"weapon",
        file:source.weapon,
        level:weaponFact.level,
        maxLevel:WEAPON_PASSIVE_MAX_LEVEL,
        status:"valid",
        text:weaponFact.text || ""
      });
    }
    return {
      version:1,
      status:secondary.missing.length ? "partial" : "valid",
      coverage:secondary.missing.length
        ? [...HERO_STAT_COVERAGE]
        : [...HERO_STAT_COVERAGE, "secondary-weapon"],
      uncovered:[
        ...new Set(build.uncovered.concat(secondary.uncovered))
      ],
      assumptions:{
        overlimitBase:OVERLIMIT_APPLICATION_MODE,
        armorLevelOrigin:ARMOR_LEVEL_ORIGIN_MODE,
        heroMainRateApplication:{
          mode:HERO_MAIN_RATE_APPLICATION_MODE,
          confidence:"presumed"
        },
        secondaryWeaponTransfer:{
          mode:SECONDARY_WEAPON_TRANSFER_APPLICATION_MODE,
          confidence:"presumed"
        }
      },
      missing:secondary.missing,
      partialStats:secondary.missing.length ? ["B_Atk"] : [],
      terms,
      totals:reconstructStatTotals(terms),
      facts:{ passives }
    };
  }

  function groupBuildStatResults(result){
    const familyOrder = ["main", "additional", "damage", "special", "elemental"];
    const totals = result && Array.isArray(result.totals) ? result.totals : [];
    const terms = result && Array.isArray(result.terms) ? result.terms : [];
    return familyOrder.map(family => {
      const stats = totals
        .filter(total => {
          const metadata = BUILD_STATS.statLabels[total.stat];
          return metadata && metadata.family === family;
        })
        .map(total => {
          const metadata = BUILD_STATS.statLabels[total.stat];
          return Object.assign({}, total, {
            label:metadata.fr,
            terms:terms.filter(term => term.stat === total.stat)
          });
        });
      return { family, stats };
    }).filter(group => group.stats.length);
  }

export {
  calculateGearStats,
  calculateHeroStats,
  calculateWeaponStats,
  gearDomainOf,
  groupBuildStatResults
};
