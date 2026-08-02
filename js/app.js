/* Les `import` doivent précéder l'IIFE : ils vivent au niveau du module, pas
   dans sa portée interne. */
import {
  AVAIL_DAYS,
  AVAIL_HOURS,
  AVAIL_EMPTY_MASK,
  availabilityWeekStart,
  availabilityPreviousWeekStart,
  availabilitySlotIndex,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask,
  availabilityMaskHas,
  applyAvailabilityRange,
  paintAvailabilityRectangle,
  availabilityToggleDay,
  availabilityToggleHour,
  aggregateAvailability,
  availabilityDensityTier,
  availabilitySlotMembers,
  staleAvailabilityWeeks,
  shouldIgnoreAvailabilityEcho,
  AVAIL_DAY_LABELS,
  AVAIL_DAY_FULL,
  availabilityDayDate,
  availabilityViewState
} from "./dispos-logique.js";
import { ModalStack } from "./modal-stack.js";
import { sessionCourante } from "./session.js";
import { sb } from "./supabase-client.js";
import { ARMOR_SET_SLOTS, armorSetsFrom, emptyArmor, emptyJewel, emptyPot, jewelSetsFrom } from "./equipement.js";
import {
  DATA,
  BUILD_STATS,
  STORAGE_KEY,
  TEAM_SIZE,
  ARMOR_SLOTS,
  LINKED_ARMOR_SLOT,
  LINKED_ARMORS,
  ARMOR_LABELS,
  JEWEL_SLOTS,
  JEWEL_LABELS,
  POT,
  POT_MAX,
  META,
  CLOUD_TEAMS_CACHE_KEY,
  CLOUD_ROSTER_CACHE_KEY,
  MIGRATION_KEY_PREFIX,
  ELEMENTS,
  ROLES,
  WSLOT_ROLES,
  WEAPON_ENUM,
  metaOf,
  FOLDER_TO_ENUM,
  ENUM_TO_FOLDER
} from "./constantes.js";
import { Picker } from "./picker.js";
import {
  bossEvolutionPercentage,
  bossScoreBigInt,
  bossStatsForWeek,
  buildDashboardState,
  currentBossWeek,
  formatBossScore,
  frDate,
  frDateTime,
  isBossSchemaCompatibilityError,
  previousBossWeekStart
} from "./boss-logique.js";
import {
  $,
  uid,
  norm,
  initials,
  numericKeyboardInputProps,
  el
} from "./dom.js";

(function(){
  "use strict";

  /* ============================ Données & constantes ============================ */
  const equippedEnumOf = hero => {
    const f = weaponFolderOf(hero && hero.weapon);
    return f ? (FOLDER_TO_ENUM[f] || null) : null;
  };

  // Badge d'un slot d'arme : icône d'arme + coin élément/rôle
  function weaponSlotBadge(ws, active){
    const w = WEAPON_ENUM[ws.weapon];
    if(!w) return null;
    const elu = (ws.element||"").toUpperCase();
    const elLbl = ELEMENTS[elu] ? ELEMENTS[elu].label : (ws.element||"");
    const roleLbl = WSLOT_ROLES[ws.role] || ws.role || "";
    const combo = (ws.element||"default").toLowerCase()+"_"+(ws.role||"").toLowerCase();
    const badge = el("span",{class:"wslot"+(active?" active":""),
      title: w.label+(elLbl?" · "+elLbl:"")+(roleLbl?" · "+roleLbl:"")+(active?" (équipée)":"")});
    badge.appendChild(el("img",{class:"wslot-w", src:"7ds-ui/mastery/"+w.icon+".webp", alt:w.label, loading:"lazy"}));
    badge.appendChild(el("img",{class:"wslot-e", src:"7ds-ui/role-elements/"+combo+".webp", alt:"", loading:"lazy"}));
    return badge;
  }

  // Rangée de badges. L'élément et les badges suivent l'ARME ÉQUIPÉE.
  // Builder (compact=false) : les 3 armes possibles, l'équipée surlignée.
  // Roster (compact=true)   : seulement l'arme équipée (compact, aligné).
  function badgesRow(ch, hero, compact){
    const m = ch ? metaOf(ch.id) : null;
    if(!m || !m.weapons || !m.weapons.length) return compact ? el("div",{class:"hero-badges mini-badges"}) : null;

    const eq = equippedEnumOf(hero);
    const active = eq ? m.weapons.find(s => s.weapon === eq) : null;
    const row = el("div",{class:"hero-badges"+(compact?" mini-badges":"")});

    const slots = el("div",{class:"wslots"});
    if(compact){
      if(active){ const b = weaponSlotBadge(active, true); if(b) slots.appendChild(b); }
    } else {
      m.weapons.forEach(ws=>{
        const b = weaponSlotBadge(ws, !!active && ws.weapon === active.weapon);
        if(!b) return;
        if(active && ws.weapon !== active.weapon) b.classList.add("dim");
        slots.appendChild(b);
      });
    }
    if(slots.children.length) row.appendChild(slots);

    // en compact on renvoie toujours la rangée (réserve la hauteur -> colonnes alignées)
    return compact ? row : (row.children.length ? row : null);
  }
  function builderWeaponSwitcher(hero, heroIndex, character){
    const metadata = character ? metaOf(character.id) : null;
    if(!metadata || !Array.isArray(metadata.weapons)
      || !metadata.weapons.length){
      return null;
    }
    const row = el("div",{
      class:"hero-badges builder-weapon-switcher",
      role:"group",
      "aria-label":"Builds par type d'arme"
    });
    const slots = el("div",{class:"wslots"});
    const activeType = weaponFolderOf(hero.weapon)
      || hero.activeWeaponType;
    metadata.weapons.forEach(slot => {
      const type = ENUM_TO_FOLDER[slot.weapon];
      if(!type) return;
      const active = type === activeType;
      const dirty = builderBuildIsDirty(heroIndex, type);
      const badge = weaponSlotBadge(slot, active);
      slots.appendChild(el("button",{
        class:"builder-weapon-switch"
          +(active ? " active" : "")
          +(dirty ? " dirty" : ""),
        type:"button",
        dataset:{weaponType:type},
        "aria-pressed":String(active),
        "aria-label":"Afficher le build "+rosterWeaponLabel(type)
          +(dirty ? " modifié" : ""),
        title:"Afficher le build "+rosterWeaponLabel(type)
          +(dirty ? " — modifié" : ""),
        onclick:()=>switchBuilderHeroBuild(heroIndex, type)
      },[badge]));
    });
    row.appendChild(slots);
    return row;
  }
  const weaponFolderOf = file => file ? file.split("/")[1] : null;
  const weaponTypesOf = charId => Object.keys((charId && POT[charId]) || {});
  const isWeaponCompatible = (charId, file) =>
    !file || !!charId && weaponTypesOf(charId).includes(weaponFolderOf(file));
  const linkedArmorsOf = charId => {
    const linked = charId && Object.prototype.hasOwnProperty.call(LINKED_ARMORS, charId)
      && LINKED_ARMORS[charId];
    return Array.isArray(linked) ? [...linked] : [];
  };
  const isLinkedArmorCompatible = (charId, file) =>
    !file || !!charId && linkedArmorsOf(charId).includes(file);
  function compatibleWeaponGroups(charId){
    const allowed = new Set(weaponTypesOf(charId));
    return Object.entries(DATA.armes||{}).reduce((groups, [label, items])=>{
      const compatible = items.filter(item => allowed.has(weaponFolderOf(item.file)));
      if(compatible.length) groups[label] = compatible;
      return groups;
    }, {});
  }
  function potentielDetailsOf(hero){
    const weaponType = weaponFolderOf(hero && hero.weapon);
    const byWeapon = (hero && hero.char && POT[hero.char]) || {};
    return { weaponType, list:(weaponType && byWeapon[weaponType]) || [] };
  }

  if(!DATA){
    document.getElementById("heroGrid").innerHTML =
      '<div class="empty-state"><p class="big">data.js introuvable</p>' +
      '<p>Lance <b>generate-data.ps1</b> puis recharge la page.</p></div>';
    return;
  }

  // Index de recherche : chemin de fichier -> nom lisible
  const FILE_NAME = new Map();
  Object.values(DATA.armes||{}).forEach(list => list.forEach(w => FILE_NAME.set(w.file, w.name)));
  Object.values(DATA.armures||{}).forEach(list => list.forEach(a => FILE_NAME.set(a.file, a.name)));
  Object.values(DATA.bijoux||{}).forEach(list => list.forEach(b => FILE_NAME.set(b.file, b.name)));
  const CHAR_BY_ID = new Map((DATA.personnages||[]).map(c => [c.id, c]));

  const nameOfFile = f => FILE_NAME.get(f) || (f ? f.split("/").pop().replace(/\.webp$/i,"") : "");
  const charOf = id => CHAR_BY_ID.get(id) || null;



  function closeModalAfterAsyncRefresh(overlay, closeAction, restoreTarget){
    const active = document.activeElement;
    const preserveExternalFocus = !!active &&
      active.isConnected &&
      active !== document.body &&
      active !== document.documentElement &&
      !overlay.contains(active) &&
      active.getClientRects().length > 0;
    if(restoreTarget){
      ModalStack.setRestoreFocus(overlay, restoreTarget);
    }
    closeAction();
    if(
      preserveExternalFocus &&
      active.isConnected &&
      active.getClientRects().length > 0
    ){
      active.focus();
    }
  }

  /* ============================ Équipes : local + Supabase ============================ */
  const LocalTeams = {
    all(){
      try{
        const list = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        return Array.isArray(list) ? list.map(normalizeTeam) : [];
      }
      catch(e){ return []; }
    },
    save(list){
      const normalized = Array.isArray(list) ? list.map(normalizeTeam) : [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    },
    upsert(team){
      const list = LocalTeams.all();
      const normalized = normalizeTeam(team);
      const i = list.findIndex(t => t.id === normalized.id);
      if(i>=0) list[i] = normalized; else list.push(normalized);
      LocalTeams.save(list);
    },
    remove(id){ LocalTeams.save(LocalTeams.all().filter(t => t.id !== id)); }
  };

  function readTeamCache(){
    try{
      const list = JSON.parse(localStorage.getItem(CLOUD_TEAMS_CACHE_KEY)) || [];
      return Array.isArray(list) ? list.map(normalizeTeam) : [];
    }catch(e){ return []; }
  }
  let cloudTeamsCache = readTeamCache();

  function cloudTeamFromRow(row){
    const raw = row && row.data && typeof row.data === "object" ? row.data : {};
    return normalizeTeam(Object.assign({}, raw, {
      id:row.id,
      owner:row.owner,
      pseudo:row.pseudo || raw.pseudo || "",
      createdAt:row.created_at ? Date.parse(row.created_at) : raw.createdAt,
      updatedAt:row.updated_at ? Date.parse(row.updated_at) : raw.updatedAt
    }));
  }

  function teamToCloudRow(team){
    const normalized = normalizeTeam(team);
    const data = JSON.parse(JSON.stringify(normalized));
    delete data.owner;
    return {
      id:normalized.id,
      owner:sessionCourante.user && sessionCourante.user.id,
      pseudo:sessionCourante.pseudo || normalized.pseudo || "",
      data,
      updated_at:new Date(normalized.updatedAt || Date.now()).toISOString()
    };
  }

  function saveCloudTeamCache(list){
    cloudTeamsCache = Array.isArray(list) ? list.map(normalizeTeam) : [];
    localStorage.setItem(CLOUD_TEAMS_CACHE_KEY, JSON.stringify(cloudTeamsCache));
  }

  const Store = {
    all(){
      return sessionCourante.user ? cloudTeamsCache.map(normalizeTeam) : LocalTeams.all();
    },
    save(list){
      if(sessionCourante.user) saveCloudTeamCache(list);
      else LocalTeams.save(list);
    },
    async refresh(){
      if(!sessionCourante.user || !sb) return Store.all();
      const { data, error } = await sb.from("teams")
        .select("*")
        .order("updated_at", { ascending:false });
      if(error) throw error;
      saveCloudTeamCache((data||[]).map(cloudTeamFromRow));
      return Store.all();
    },
    async upsert(team){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const normalized = normalizeTeam(Object.assign({}, team, {
        owner:sessionCourante.user.id,
        pseudo:sessionCourante.pseudo || team.pseudo || ""
      }));
      const { error } = await sb.from("teams").upsert(teamToCloudRow(normalized));
      if(error) throw error;
      const list = cloudTeamsCache.slice();
      const index = list.findIndex(item => item.id === normalized.id);
      if(index >= 0) list[index] = normalized; else list.push(normalized);
      saveCloudTeamCache(list);
      return normalized;
    },
    async remove(id){
      if(!sessionCourante.user){
        LocalTeams.remove(id);
        return;
      }
      if(!sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.from("teams").delete().eq("id", id);
      if(error) throw error;
      saveCloudTeamCache(cloudTeamsCache.filter(team => team.id !== id));
    }
  };

  /* ============================ Brouillon d'équipe ============================ */
  const normalizePotentiel = raw => {
    const tier = Number.isFinite(Number(raw && raw.tier)) ? Math.trunc(Number(raw.tier)) : 0;
    return { tier:Math.max(0, Math.min(POT_MAX, tier)) };
  };
  const jsonCopy = value => JSON.parse(JSON.stringify(value));
  const owns = (object, key) => !!object && Object.prototype.hasOwnProperty.call(object, key);
  const isInteger = value => Number.isInteger(value);
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
  function buildGearCatalog(){
    return BUILD_GEAR;
  }
  function gearEnchantmentLength(definition){
    const options = definition && definition.randomOptions;
    return options && Number.isFinite(options.slots)
      ? Math.max(0, Math.trunc(options.slots))
      : 0;
  }
  function emptyGearConfig(file){
    const definition = buildGearDefinition(file);
    if(!definition) return null;
    return {
      version:1,
      level:definition.qualityMin,
      reinforce:0,
      enchantments:Array.from({
        length:gearEnchantmentLength(definition)
      }, ()=>null),
      passiveLevel:null
    };
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
  /* PRÉSUMÉ, NON VÉRIFIÉ :
   * le gain par niveau d'une pièce part de la borne basse de son segment.
   *
   * Vérification dans le jeu : relever la même statistique d'une même armure
   * à qualityMin, juste avant, au niveau et juste après la première borne
   * interne, puis comparer les reconstructions "segment-lower-bound" et
   * "quality-min". Si la mesure contredit ce choix, remplacer uniquement la
   * valeur ci-dessous. Aucune autre partie du moteur ne connaît l'hypothèse. */
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
  /* Perle de sortilège : chaque palier ouvre un nombre d'emplacements de stat
     différent. Cette table vient du jeu, rapportée par le propriétaire — les
     données de 7dsorigin ne la contiennent pas, leurs `tiers[].options` ne
     listent que les stats possibles. Ne pas la « corriger » d'après le
     catalogue. */
  const PEARL_TIERS = [
    { tier:1, label:"Commune", slots:1, requiredSlots:1 },
    { tier:2, label:"Remarquable", slots:2, requiredSlots:2 },
    { tier:3, label:"Rare", slots:2, requiredSlots:2 },
    { tier:4, label:"Héroïque", slots:3, requiredSlots:2 },
    { tier:5, label:"Légendaire", slots:4, requiredSlots:3 }
  ];
  function pearlTierOf(tier){
    return PEARL_TIERS.find(item => item.tier === tier) || null;
  }
  function pearlSlotCount(tier){
    const found = pearlTierOf(tier);
    return found ? found.slots : 0;
  }
  function pearlRequiredSlotCount(tier){
    const found = pearlTierOf(tier);
    return found ? found.requiredSlots : 0;
  }
  function pearlTierLabel(tier){
    const found = pearlTierOf(tier);
    return found ? found.label : "Palier "+tier;
  }
  // Le palier d'une perle est commun à tous ses emplacements : on le lit sur la
  // première entrée renseignée.
  function pearlTierInUse(enchantments){
    const choices = Array.isArray(enchantments) ? enchantments : [];
    const first = choices.find(choice =>
      choice && typeof choice === "object" && !Array.isArray(choice)
    );
    return first && isInteger(first.tier) ? first.tier : null;
  }
  function enchantmentLength(grade){
    const enchantments = grade && grade.enchantments;
    if(!enchantments || typeof enchantments !== "object") return -1;
    if(enchantments.type === "basic"){
      return Array.isArray(enchantments.slots) ? enchantments.slots.length : -1;
    }
    // Perle vide : un emplacement suffit tant qu'aucun palier n'est choisi.
    if(enchantments.type === "masterstone") return 1;
    return -1;
  }
  // Longueur attendue pour une saisie en cours : elle suit le palier choisi.
  function enchantmentExpectedLength(grade, enchantments){
    const catalog = grade && grade.enchantments;
    if(!catalog || catalog.type !== "masterstone") return enchantmentLength(grade);
    const tier = pearlTierInUse(enchantments);
    return tier === null ? 1 : pearlSlotCount(tier);
  }
  function enchantmentRequiredLength(grade, enchantments){
    const catalog = grade && grade.enchantments;
    if(!catalog || catalog.type !== "masterstone") return enchantmentLength(grade);
    const tier = pearlTierInUse(enchantments);
    return tier === null ? 1 : pearlRequiredSlotCount(tier);
  }
  function emptyWeaponConfig(file, gameId){
    const grade = buildWeaponGrade(file, gameId);
    const length = enchantmentLength(grade);
    if(!grade || length < 0) return null;
    return {
      version:1,
      gradeGameId:gameId,
      level:0,
      promotion:0,
      overlimit:0,
      enchantments:Array.from({length}, ()=>null)
    };
  }
  function normalizeWeaponConfig(file, raw){
    if(raw === undefined || raw === null) return null;
    const config = jsonCopy(raw);
    const grade = config && buildWeaponGrade(file, config.gradeGameId);
    if(grade && grade.enchantments
      && grade.enchantments.type === "masterstone"
      && Array.isArray(config.enchantments)){
      const maximumLength = enchantmentExpectedLength(grade, config.enchantments);
      const minimumLength = enchantmentRequiredLength(grade, config.enchantments);
      if(config.enchantments.length >= minimumLength
        && config.enchantments.length < maximumLength){
        config.enchantments = config.enchantments.concat(
          Array(maximumLength - config.enchantments.length).fill(null)
        );
      }
    }
    return config;
  }
  function normalizeGearConfigMap(equipment, raw, slots){
    const source = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw : {};
    return slots.reduce((result, slot) => {
      if(equipment[slot] && owns(source, slot)
        && source[slot] !== undefined && source[slot] !== null){
        const config = jsonCopy(source[slot]);
        if(config && typeof config === "object" && !Array.isArray(config)
          && config.version === 1 && !owns(config, "passiveLevel")){
          config.passiveLevel = null;
        }
        result[slot] = config;
      }
      return result;
    }, {});
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
  /* Une arme ne porte qu'une seule perle : tous les emplacements renseignés
     doivent partager le même palier et le même élément. Sans cette contrainte,
     un état absurde deviendrait « valide ». */
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
  /* Le jeu interdit deux fois la même stat sur une perle. Les emplacements
     encore vides ne comptent pas : sinon toute saisie en cours serait refusée. */
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
  function isAllowedEnchantValue(choice, options){
    return !!choice && typeof choice === "object" && !Array.isArray(choice)
      && allowedEnchantValueStatus(choice, options) === "valid";
  }
  function areEnchantmentsValid(grade, enchantments){
    return enchantmentsStatus(grade, enchantments) === "valid";
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

  function enchantmentBounds(option, slotRate){
    return {
      min:Math.ceil(Number(option.min) * Number(slotRate) / 10000),
      max:Math.floor(Number(option.max) * Number(slotRate) / 10000)
    };
  }

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * l’outrepassement multiplie la statistique principale native de l’arme
   * avant les enchantements. Le fait qu’il ne touche ni les sous-statistiques
   * ni le passif est confirmé par le propriétaire ; seule la base précise de
   * la statistique principale reste présumée.
   *
   * Vérification dans le jeu :
   * relever l’ATK à outrepassement 0 puis 1 sur une arme enchantée.
   * Si le gain de 5 % inclut les enchantements, remplacer uniquement
   * "native-before-enchantments" par "native-and-enchantments".
   */
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
  function gameCeil(value){
    return Math.ceil(Number(value) - 1e-9);
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
      stat:mainStat,
      value:curveValueAtLevel(grade.mainStatValues, config.level),
      bucket:nativeBucket,
      source:{ domain:"weapon", component:"level", id:file }
    });
    addWeaponStatTerm(terms, {
      id:"weapon:promotion:"+mainStat,
      stat:mainStat,
      value:promotionValueAt(grade, config.promotion),
      bucket:nativeBucket,
      source:{ domain:"weapon", component:"promotion", id:file }
    });
    (grade.subStats || []).forEach((subStat, index) => {
      addWeaponStatTerm(terms, {
        id:"weapon:level:"+subStat.stat+":"+index,
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

  function buildGearSets(){
    return BUILD_GEAR_SETS;
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

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * les taux principaux du héros portent sur tous ses apports fixes avant les
   * passifs. Protocole : relever les statistiques d'un nouveau personnage
   * avant son premier potentiel puis juste après, équipement inchangé. Si la
   * mesure contredit cette base, changer uniquement ce mode et
   * heroMainRateTargetBuckets().
   */
  const HERO_MAIN_RATE_APPLICATION_MODE = "all-flat-before-passives";
  const HERO_MAIN_RATE_TARGETS = {
    I_AtkAdd_Rate:"B_Atk",
    I_DefAdd_Rate:"B_Def",
    I_MaxHpAdd_Rate:"B_MaxHp"
  };
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
  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * les 30 % d'ATK plate des deux armes secondaires sont ajoutés avant les
   * taux principaux du héros. Protocole : comparer sur Merlin l'ATK affichée
   * avec les deux armes secondaires configurées, puis sans l'une d'elles. Si
   * l'écart réel n'est pas lui-même affecté par les taux principaux, changer
   * uniquement ce mode et le branchement de ces seaux.
   */
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

  function formatBuildStatValue(value, unit){
    if(unit !== "flat" && unit !== "ten-thousandths"){
      throw new Error("BUILD_STAT_UNIT_INVALID");
    }
    const numeric = Number(value);
    if(!Number.isFinite(numeric)) throw new Error("BUILD_STAT_VALUE_INVALID");
    const displayed = unit === "ten-thousandths" ? numeric / 100 : numeric;
    const prefix = displayed >= 0 ? "+" : "";
    return prefix + new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:2
    }).format(displayed) + (unit === "ten-thousandths" ? " %" : "");
  }

  const HERO_PRIMARY_STATS = [
    ["B_MaxHp", "PV"],
    ["B_Atk", "ATK"],
    ["B_Def", "DEF"]
  ];
  function heroStatsTitle(result){
    if(!result || result.status === "incomplete"){
      return "Statistiques du héros — configuration à compléter";
    }
    if(result.status === "partial"){
      return "Statistiques du héros — calcul partiel";
    }
    if(result.status !== "valid"){
      return "Statistiques du héros — indisponibles";
    }
    return "Statistiques du héros — borne inférieure";
  }
  function heroStatsGroups(result){
    const primary = new Set(HERO_PRIMARY_STATS.map(item => item[0]));
    return groupBuildStatResults(result).map(group => ({
      family:group.family,
      stats:group.stats.filter(stat => !primary.has(stat.stat))
    })).filter(group => group.stats.length);
  }
  function formatHeroStatTotal(value, unit){
    const numeric = unit === "ten-thousandths"
      ? Number(value) / 100 : Number(value);
    return new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:2
    }).format(numeric) + (unit === "ten-thousandths" ? " %" : "");
  }
  /* Libellé de la provenance d'un terme, indépendant de son opération. C'est
     lui qui réunit les pièces sous « Équipement » et qui donne un nom aux taux
     principaux, dont le libellé historique « Application du taux » était le
     même pour des dizaines de lignes. Renvoie null quand la provenance n'est
     pas regroupée : l'appelant garde alors son libellé spécifique. */
  function heroTermOriginLabel(term){
    const source = (term && term.source) || {};
    if(source.domain === "character") return "Base du personnage";
    if(source.domain === "mastery"){
      if(source.component === "common-mastery") return "Maîtrise commune";
      if(source.component === "reserve-weapon-mastery"){
        return "Maîtrises de réserve";
      }
      const meta = WEAPON_ENUM[source.weaponType];
      return "Maîtrise "+((meta && meta.label) || source.weaponType || "");
    }
    if(source.domain === "potential") return "Potentiel P"+source.tier;
    if(source.domain === "set") return "Bonus d’ensemble";
    if(source.domain === "armor" || source.domain === "jewel"
      || source.domain === "engraving"){
      return "Équipement";
    }
    return null;
  }
  function heroTermLabel(term){
    const source = term.source || {};
    if(source.component === "final-ceil"
      || source.component === "final-rounding"){
      return "Arrondi du jeu";
    }
    if(term.operation === "multiply"){
      if(source.application === "hero-main-rate"){
        return heroTermOriginLabel(term) || "Application du taux";
      }
      return source.component === "overlimit"
        ? "Outrepassement" : "Application du taux";
    }
    const origin = heroTermOriginLabel(term);
    if(origin) return origin;
    if(source.domain === "weapon") return weaponTermLabel(term);
    if(source.domain === "secondary-weapon"){
      return (source.weaponType || "Arme")
        +" secondaire : "
        +formatHeroStatTotal(source.originalValue, "flat")
        +" ATK × "
        +formatHeroStatTotal(source.transferRate, "ten-thousandths")
        +" =";
    }
    return gearTermLabel(term);
  }
  function heroTermProvenance(term){
    const source = term.source || {};
    const component = source.component === "final-ceil"
      || source.component === "final-rounding"
      ? "arrondi au supérieur"
      : (source.component || "contribution");
    const parts = [
      "Source : "+(source.domain || "inconnue"),
      component,
      "unité "+(term.unit === "flat" ? "points" : "dix-millièmes")
    ];
    if(source.field) parts.push("champ "+source.field);
    if(source.weaponType) parts.push("arme "+source.weaponType);
    if(Number.isInteger(source.level)) parts.push("nœud "+source.level);
    if(source.kind) parts.push(source.kind);
    if(source.slot) parts.push("emplacement "+source.slot);
    if(source.id) parts.push(source.id);
    if(source.originalStat) parts.push("code original "+source.originalStat);
    if(term.operation === "add") parts.push("seau "+term.bucket);
    return parts.join(" · ");
  }
  /* Dictionnaire partagé par les provenances et par le pied de bloc des seaux
     ciblés : un même seau doit porter le même libellé partout, faute de quoi
     la note de pied de bloc et la ligne d'un terme additif se contrediraient. */
  const BUILD_BUCKET_LABELS = {
    "weapon-native":"statistiques natives de l’arme",
    "weapon-enchantment":"enchantements de l’arme"
  };
  /* Deux termes ne sont regroupés que s'ils produiraient exactement la même
     ligne. `appliesTo` fait partie de la clé parce que la contribution d'un
     multiplicateur vaut base(appliesTo) × valeur : sommer deux taux visant des
     seaux différents afficherait un total appliqué à une base qui n'existe
     pas. L'emphase en fait partie parce qu'elle change la ligne rendue. */
  const STAT_TERM_KEY_SEPARATOR = "\u0001";
  function statTermGroupKey(term, termLabel, termEmphasis){
    return [
      termLabel(term) || "Autre",
      term.operation,
      term.unit,
      term.operation === "multiply"
        ? [...(term.appliesTo || [])].sort().join(",")
        : "",
      termEmphasis(term) || "",
      /* `mainRate` change la notation ET l'emplacement du groupe : un taux
         principal et un multiplicateur ordinaire ne doivent jamais fusionner,
         même si tout le reste coïncide. */
      ((term.source || {}).application === "hero-main-rate") ? "1" : "0"
    ].join(STAT_TERM_KEY_SEPARATOR);
  }
  function statTermGroups(stat, options){
    const settings = options || {};
    const termLabel = settings.termLabel;
    const termEmphasis = settings.termEmphasis || (() => "");
    const groups = [];
    const index = new Map();
    ((stat && stat.terms) || []).forEach(term => {
      const key = statTermGroupKey(term, termLabel, termEmphasis);
      let group = index.get(key);
      if(!group){
        const source = term.source || {};
        group = {
          key,
          label:termLabel(term) || "Autre",
          operation:term.operation,
          unit:term.unit,
          appliesTo:term.operation === "multiply"
            ? [...(term.appliesTo || [])].sort() : [],
          emphasis:termEmphasis(term) || "",
          mainRate:source.application === "hero-main-rate",
          value:0,
          terms:[]
        };
        index.set(key, group);
        groups.push(group);
      }
      group.value += Number(term.value) || 0;
      group.terms.push(term);
    });
    return groups;
  }
  /* Les taux principaux s'additionnent : les écrire ×1,03 laisserait croire à
     un produit composé. Trois nœuds à 3 % font +9 %, pas +9,27 %. */
  function mainRateValueText(value){
    return formatBuildStatValue(value, "ten-thousandths");
  }
  function statTermNode(term, group, termValue, termProvenance){
    return el("div",{
      class:"weapon-stat-term",
      dataset:{
        termId:term.id,
        operation:term.operation,
        unit:term.unit,
        buckets:term.operation === "multiply"
          ? term.appliesTo.join(",") : term.bucket
      }
    },[
      el("div",{class:"weapon-stat-term-value"},[
        el("span",{text:group.label}),
        el("span",{
          class:group.emphasis,
          text:termValue(term, group)
        })
      ]),
      el("small",{
        class:"weapon-stat-provenance",
        text:termProvenance(term)
      })
    ]);
  }
  /* Le total d'un groupe n'est affiché que pour les taux principaux et les
     additifs, dont la somme a un sens. Un groupe de multiplicateurs non
     principaux n'existe pas en pratique : chacun porte un libellé distinct. */
  function statGroupTotalText(group){
    if(group.operation === "multiply"){
      return group.mainRate ? mainRateValueText(group.value) : "";
    }
    return formatBuildStatValue(group.value, group.unit)
      +(group.unit === "flat" ? " points" : "");
  }
  function statGroupNode(group, termValue, termProvenance){
    if(group.terms.length === 1){
      return statTermNode(group.terms[0], group, termValue, termProvenance);
    }
    const node = el("details",{class:"stat-term-group"},[
      el("summary",{},[
        el("span",{
          text:group.label+" · "+group.terms.length+" apports"
        }),
        el("span",{class:group.emphasis, text:statGroupTotalText(group)})
      ])
    ]);
    group.terms.forEach(term => {
      node.appendChild(statTermNode(term, group, termValue, termProvenance));
    });
    return node;
  }
  function statBucketNotes(groups){
    /* Une même statistique porte plusieurs bases : les taux principaux visent
       tous les seaux fixes, l'outrepassement les seuls seaux natifs de l'arme.
       Une note unique afficherait la mauvaise base pour l'un des deux.
       La note dit seulement où le taux s'applique : la mention « base
       présumée » vit sur la ligne ou le bloc concerné, jamais deux fois. */
    const seen = new Set();
    const notes = [];
    groups.forEach(group => {
      if(group.operation !== "multiply") return;
      const key = group.appliesTo.join(",");
      if(!key || seen.has(key)) return;
      seen.add(key);
      notes.push(el("small",{
        class:"stat-term-buckets",
        text:"Appliqué à : "+key.split(",")
          .map(bucket => BUILD_BUCKET_LABELS[bucket] || bucket)
          .join(", ")
      }));
    });
    return notes;
  }
  function statTermsDetails(stat, options){
    const settings = options || {};
    const termValue = settings.termValue;
    const termProvenance = settings.termProvenance;
    const termEmphasis = settings.termEmphasis || (() => "");
    const details = el("details",{class:"weapon-stat-details"},[
      el("summary",{text:"Détail du calcul"})
    ]);
    const groups = statTermGroups(stat, {
      termLabel:settings.termLabel,
      termEmphasis
    });
    /* Un bloc « Taux principaux » par base visée. Additionner des taux qui ne
       visent pas les mêmes seaux donnerait un total appliqué à une base qui
       n'existe pas — c'est précisément ce que la clé de groupe interdit, et le
       rendu ne doit pas le réintroduire. */
    const mainRateBlocks = new Map();
    groups.forEach(group => {
      if(!group.mainRate) return;
      const key = group.appliesTo.join(",");
      if(!mainRateBlocks.has(key)) mainRateBlocks.set(key, []);
      mainRateBlocks.get(key).push(group);
    });
    const renderedBlocks = new Set();
    groups.forEach(group => {
      if(!group.mainRate){
        details.appendChild(
          statGroupNode(group, termValue, termProvenance)
        );
        return;
      }
      const key = group.appliesTo.join(",");
      if(renderedBlocks.has(key)) return;
      renderedBlocks.add(key);
      const block = mainRateBlocks.get(key);
      const total = block.reduce((sum, item) => sum + item.value, 0);
      const presumed = block.some(item =>
        item.terms.some(term => term.confidence === "presumed")
      );
      const parent = el("details",{class:"stat-term-group"},[
        el("summary",{},[
          el("span",{
            text:"Taux principaux"+(presumed ? " — base présumée" : "")
          }),
          el("span",{text:mainRateValueText(total)})
        ])
      ]);
      block.forEach(item => {
        parent.appendChild(statGroupNode(item, termValue, termProvenance));
      });
      details.appendChild(parent);
    });
    statBucketNotes(groups).forEach(note => details.appendChild(note));
    return details;
  }
  /* La valeur affichée diffère réellement d'un appelant à l'autre : le panneau
     d'arme met le libellé complet à droite — c'est la chaîne exacte assertie
     par tests/potentiel-commun.playwright.js — là où la fiche du héros n'y met
     que le facteur. D'où termValue plutôt qu'une règle unique. */
  function heroTermValue(term, group){
    if(term.operation !== "multiply"){
      return formatBuildStatValue(term.value, term.unit)
        +(term.unit === "flat" ? " points" : "");
    }
    if(group.mainRate) return mainRateValueText(term.value);
    const presumed = term.confidence === "presumed"
      || (term.source && term.source.component === "overlimit");
    return "×"+new Intl.NumberFormat("fr-FR", {
      maximumFractionDigits:4
    }).format(1 + Number(term.value) / 10000)
      +(presumed ? " — base présumée" : "");
  }
  function heroStatDetails(stat){
    return statTermsDetails(stat, {
      termLabel:heroTermLabel,
      termValue:heroTermValue,
      termProvenance:heroTermProvenance,
      termEmphasis:term => term.operation === "multiply"
        ? "weapon-stat-term-overlimit" : ""
    });
  }
  function heroPassiveLabel(fact){
    if(fact.source === "weapon:passive") return "Arme";
    return ARMOR_LABELS[fact.slot] || JEWEL_LABELS[fact.slot] || fact.slot;
  }
  function heroPassivesSection(passives){
    if(!Array.isArray(passives) || !passives.length) return null;
    const section = el("section",{class:"hero-passives"});
    section.appendChild(el("h4",{
      class:"weapon-stats-family-title",
      text:"Passifs non inclus dans le calcul"
    }));
    passives.forEach(fact => {
      let state = "Niveau du passif à renseigner";
      if(fact.status === "valid"){
        state = "Niveau "+fact.level+" / "+fact.maxLevel;
      }else if(fact.status === "incompatible"){
        state = "Niveau du passif invalide";
      }
      const item = el("article",{class:"hero-passive"},[
        el("div",{class:"hero-passive-head"},[
          el("strong",{text:heroPassiveLabel(fact)}),
          el("span",{text:state})
        ])
      ]);
      if(fact.status === "valid" && fact.text){
        item.appendChild(el("p",{
          class:"hero-passive-text",
          html:renderBonus(fact.text)
        }));
      }
      section.appendChild(item);
    });
    return section;
  }
  function heroStatsSection(hero){
    const result = calculateHeroStats(hero);
    const section = el("section",{
      class:"hero-stats",
      dataset:{status:result.status}
    });
    section.appendChild(el("h3",{
      class:"weapon-stats-title",
      text:heroStatsTitle(result)
    }));
    const hasNumericResult =
      result.status === "valid" || result.status === "partial";
    if(!hasNumericResult){
      const details = result.missing.length
        ? " À compléter : "+result.missing.join(", ")+"."
        : "";
      section.appendChild(el("p",{
        class:"weapon-stats-state",
        text:(result.status === "incomplete"
          ? "Équipe et configure les neuf pièces pour obtenir une valeur fiable."
          : "Les données de cette configuration ne peuvent pas être calculées.")
          +details
      }));
      return section;
    }

    section.appendChild(el("span",{
      class:"hero-stats-assumption",
      text:"Base d’application présumée"
    }));
    const grouped = groupBuildStatResults(result);
    const statsByCode = new Map(
      grouped.flatMap(group => group.stats).map(stat => [stat.stat,stat])
    );
    const primary = el("div",{class:"hero-stats-primary"});
    HERO_PRIMARY_STATS.forEach(([code, label]) => {
      const stat = statsByCode.get(code);
      const partial = (result.partialStats || []).includes(stat.stat);
      const card = el("article",{
        class:"hero-stat-card",
        dataset:{stat:code}
      },[
        el("span",{class:"hero-stat-card-label",text:label}),
        el("strong",{
          class:"hero-stat-card-value",
          text:formatHeroStatTotal(stat.value, stat.unit)
        }),
        el("small",{
          class:"hero-stat-card-bound",
          text:partial
            ? "calcul incomplet — arme secondaire manquante"
            : "borne inférieure"
        })
      ]);
      card.appendChild(heroStatDetails(stat));
      primary.appendChild(card);
    });
    section.appendChild(primary);

    heroStatsGroups(result).forEach(group => {
      const family = el("section",{class:"weapon-stats-family"});
      family.appendChild(el("h4",{
        class:"weapon-stats-family-title",
        text:BUILD_STAT_FAMILY_LABELS[group.family] || group.family
      }));
      group.stats.forEach(stat => {
        const node = el("div",{class:"weapon-stat"},[
          el("div",{class:"weapon-stat-head"},[
            el("span",{text:stat.label}),
            el("span",{
              class:"weapon-stat-total",
              dataset:{unit:stat.unit},
              text:formatHeroStatTotal(stat.value, stat.unit)
            })
          ])
        ]);
        node.appendChild(heroStatDetails(stat));
        family.appendChild(node);
      });
      section.appendChild(family);
    });
    const passives = heroPassivesSection(result.facts.passives);
    if(passives) section.appendChild(passives);
    return section;
  }

  const WEAPON_RARITY_LABELS = {
    grade1:"Grade 1",
    grade2:"Grade 2",
    grade3:"Grade 3",
    grade4:"Grade 4",
    grade5:"SSR"
  };
  const BUILD_STAT_FAMILY_LABELS = {
    main:"PV · ATK · DEF",
    additional:"Statistiques supplémentaires",
    damage:"Modificateurs de dégâts",
    special:"Statistiques spéciales",
    elemental:"Statistiques élémentaires"
  };

  function weaponGrades(file){
    const weapon = buildWeaponDefinition(file);
    if(!weapon) return [];
    return Object.values(weapon.gradesByGameId || {}).sort((left, right) => {
      const leftGrade = Number(String(left.rarity || "").replace(/\D/g, "")) || 0;
      const rightGrade = Number(String(right.rarity || "").replace(/\D/g, "")) || 0;
      return leftGrade - rightGrade || String(left.gameId).localeCompare(String(right.gameId));
    });
  }

  function weaponDefaultGradeGameId(file){
    const first = weaponGrades(file)[0];
    return first ? first.gameId : null;
  }

  function weaponConfigSummary(file, config){
    const status = weaponConfigStatus(file, config);
    if(status === "unavailable") return "Données chiffrées indisponibles";
    if(status !== "valid") return "Configuration à compléter";
    const grade = buildWeaponGrade(file, config.gradeGameId);
    const rarity = WEAPON_RARITY_LABELS[grade.rarity] || grade.rarity;
    const parts = [
      "Configurée",
      rarity,
      "Nv. "+config.level
    ];
    if(grade.overlimit && Array.isArray(grade.overlimit.levels)){
      parts.push("Outrepassement "+config.overlimit);
    }
    return parts.join(" · ");
  }

  function weaponStatsStatusMessage(status){
    if(status === "unavailable"){
      return "Les données chiffrées de cette arme ne sont pas disponibles.";
    }
    if(status === "missing"){
      return "Configuration à compléter pour calculer l’apport de l’arme.";
    }
    if(status === "incomplete"){
      return "Complète les champs requis pour afficher l’apport de l’arme.";
    }
    return "Cette configuration n’est pas compatible avec les données de l’arme.";
  }

  function weaponTermLabel(term){
    if(term.source.component === "level") return "Niveau";
    if(term.source.component === "promotion") return "Promotion";
    if(term.source.component === "enchantment") return "Enchantement";
    if(term.source.component === "overlimit"){
      const factor = new Intl.NumberFormat("fr-FR", {
        minimumFractionDigits:2,
        maximumFractionDigits:2
      }).format(1 + Number(term.value) / 10000);
      return "Outrepassement ×"+factor+" — base présumée";
    }
    if(term.source.component === "final-rounding") return "Arrondi du jeu";
    return term.source.component;
  }

  function weaponTermProvenance(term){
    const source = term.source || {};
    const parts = [
      "Source : "+(source.domain === "weapon" ? "arme" : (source.domain || "inconnue")),
      source.component ? weaponTermLabel(term) : "inconnue",
      "opération "+(term.operation === "add" ? "addition" : "multiplication"),
      "unité "+(term.unit === "flat" ? "points" : "dix-millièmes")
    ];
    if(source.id) parts.push(source.id);
    if(Number.isInteger(source.slot)) parts.push("emplacement "+(source.slot + 1));
    if(term.operation === "add"){
      parts.push("seau "+(BUILD_BUCKET_LABELS[term.bucket] || term.bucket));
    }
    return parts.join(" · ");
  }

  /* Le titre dit ce que le total vaut vraiment. `uncovered` non vide signifie
     qu'une part existante n'est pas calculee — les 567 niveaux de passif
     d'arme — donc le total est une borne inferieure, pas un partiel qu'on
     completerait plus tard. Ne jamais annoncer un total complet dans ce cas. */
  function buildStatsTitle(subject, result){
    const missing = Array.isArray(result.uncovered) ? result.uncovered : [];
    if(missing.includes(subject.passiveKey)){
      return "Apport " + subject.of + " hors passif — borne inférieure";
    }
    if(missing.length) return "Apport " + subject.of + " — borne inférieure";
    return "Apport " + subject.of + " — calcul partiel";
  }

  function weaponStatsSection(file, config){
    const section = el("section",{class:"weapon-stats"});
    const result = calculateWeaponStats(file, config);
    section.appendChild(el("h3",{
      class:"weapon-stats-title",
      text:buildStatsTitle(
        { of:"de l’arme", passiveKey:"weapon:passive" },
        result
      )
    }));
    const weaponCovered = result.status === "valid"
      && Array.isArray(result.coverage)
      && result.coverage.length === 1
      && result.coverage[0] === "weapon";
    if(!weaponCovered){
      section.appendChild(el("p",{
        class:"weapon-stats-state",
        text:weaponStatsStatusMessage(
          result.status === "valid" ? "incompatible" : result.status
        )
      }));
      return section;
    }

    groupBuildStatResults(result).forEach(group => {
      const family = el("section",{class:"weapon-stats-family"});
      family.appendChild(el("h4",{
        class:"weapon-stats-family-title",
        text:BUILD_STAT_FAMILY_LABELS[group.family] || group.family
      }));
      group.stats.forEach(stat => {
        const statNode = el("div",{class:"weapon-stat"});
        statNode.appendChild(el("div",{class:"weapon-stat-head"},[
          el("span",{text:stat.label}),
          el("span",{
            class:"weapon-stat-total",
            dataset:{unit:stat.unit},
            text:formatBuildStatValue(stat.value, stat.unit)
              +(stat.unit === "flat" ? " points" : "")
          })
        ]));
        const details = statTermsDetails(stat, {
          termLabel:term => term.operation === "multiply"
            ? "Outrepassement" : weaponTermLabel(term),
          termValue:term => term.operation === "multiply"
            ? weaponTermLabel(term)
            : formatBuildStatValue(term.value, term.unit)
              +(term.unit === "flat" ? " points" : ""),
          termProvenance:weaponTermProvenance,
          termEmphasis:term => term.operation === "multiply"
            ? "weapon-stat-term-overlimit" : ""
        });
        statNode.appendChild(details);
        family.appendChild(statNode);
      });
      section.appendChild(family);
    });
    return section;
  }

  function weaponConfigControl(context){
    if(!context.weaponFile) return null;
    const status = weaponConfigStatus(context.weaponFile, context.config);
    const button = el("button",{
      class:"btn weapon-config-open",
      type:"button",
      text:status === "valid" ? "Modifier la configuration" : "Configurer l’arme",
      onclick:()=>openWeaponConfigEditor(context, button)
    });
    if(status === "unavailable") button.disabled = true;
    return el("div",{
      class:"weapon-config-control"+(status === "valid" ? " is-valid" : "")
    },[
      el("span",{
        class:"weapon-config-summary",
        text:weaponConfigSummary(context.weaponFile, context.config)
      }),
      button
    ]);
  }

  function weaponConfigField(label, control, hint){
    const field = el("label",{class:"weapon-config-field"},[
      el("span",{text:label}),
      control
    ]);
    if(hint) field.appendChild(el("p",{class:"weapon-config-hint",text:hint}));
    return field;
  }

  function weaponConfigOption(value, label){
    return el("option",{value:String(value),text:label});
  }

  function weaponEnchantOptions(grade, choice){
    const catalog = grade.enchantments;
    if(catalog.type === "basic") return catalog.options || [];
    if(!choice || !Number.isInteger(choice.tier)) return [];
    const tier = (catalog.tiers || []).find(item => item.tier === choice.tier);
    if(!tier) return [];
    if(!tier.elements) return tier.options || [];
    const group = (tier.elements || []).find(item => item.element === choice.element);
    return group ? (group.options || []) : [];
  }

  function weaponDraftHasChoices(draft){
    return !!draft && (
      draft.level !== 0 ||
      draft.promotion !== 0 ||
      draft.overlimit !== 0 ||
      (draft.enchantments || []).some(choice => choice !== null)
    );
  }

  function weaponConfigFirstInvalidSelector(file, draft){
    const grade = draft && buildWeaponGrade(file, draft.gradeGameId);
    if(!grade) return ".weapon-config-grade";
    if(!isInteger(draft.promotion)
      || draft.promotion < 0
      || draft.promotion > grade.promotionSteps.length){
      return ".weapon-config-promotion";
    }
    const cap = weaponLevelCap(grade, draft.promotion);
    if(!isInteger(draft.level) || draft.level < 0 || draft.level > cap){
      return ".weapon-config-level";
    }
    const levels = grade.overlimit && Array.isArray(grade.overlimit.levels)
      ? grade.overlimit.levels : [{level:0}];
    if(!isInteger(draft.overlimit)
      || !levels.some(item => item.level === draft.overlimit)){
      return ".weapon-config-overlimit";
    }
    if(!Array.isArray(draft.enchantments)){
      return ".weapon-config-enchantment-choice";
    }
    const maximumEnchantments = enchantmentExpectedLength(grade, draft.enchantments);
    const minimumEnchantments = enchantmentRequiredLength(grade, draft.enchantments);
    const isPearl = grade.enchantments.type === "masterstone";
    if(maximumEnchantments < 0
      || minimumEnchantments < 0
      || draft.enchantments.length > maximumEnchantments
      || draft.enchantments.length < minimumEnchantments
      || (!isPearl && draft.enchantments.length !== maximumEnchantments)){
      // Une perle sous son minimum : c'est le palier qu'il faut reprendre.
      return ".weapon-config-enchantment-choice";
    }
    if(!areEnchantmentsValid(grade, draft.enchantments)){
      if(grade.enchantments.type === "masterstone"){
        /* Plusieurs emplacements : viser celui qui bloque, pas le premier. */
        const position = draft.enchantments.findIndex((entry, index) =>
          enchantmentChoiceStatus(grade, entry, index) !== "valid"
        );
        const slot = position < 0 ? 0 : position;
        const choice = draft.enchantments[slot];
        const scope = '.weapon-enchantment-slot[data-pearl-slot="'+slot+'"] ';
        const tier = choice && (grade.enchantments.tiers || [])
          .find(item => item.tier === choice.tier);
        if(!tier) return ".weapon-config-enchantment-choice";
        if(tier.elements
          && !(tier.elements || []).some(item => item.element === choice.element)){
          return ".weapon-config-enchantment-element";
        }
        const options = weaponEnchantOptions(grade, choice);
        if(!options.some(option => option.stat === choice.stat)){
          return scope + ".weapon-config-enchantment-stat";
        }
        return scope + ".weapon-config-enchantment-value";
      }
      const invalidIndex = draft.enchantments.findIndex((choice, index) => {
        if(choice === null) return false;
        const slotRate = grade.enchantments.slots[index];
        const options = (grade.enchantments.options || []).map(option =>
          Object.assign({}, option, enchantmentBounds(option, slotRate))
        );
        return choice.slot !== index || !isAllowedEnchantValue(choice, options);
      });
      return invalidIndex < 0
        ? ".weapon-config-enchantment-choice"
        : '.weapon-enchantment[data-slot="'+invalidIndex+'"] '
          + ".weapon-config-enchantment-value";
    }
    return ".weapon-config-grade";
  }

  let weaponConfigEditorState = null;

  function weaponConfigHasConflict(state){
    const source = Number(
      state && state.context && state.context.sourceUpdatedAt
    ) || 0;
    const latest = Number(
      state &&
      state.context &&
      typeof state.context.latestUpdatedAt === "function" &&
      state.context.latestUpdatedAt()
    ) || 0;
    return latest > source && !state.overwriteConfirmed;
  }

  function weaponConfigDraftIsDirty(state){
    return !!state && JSON.stringify(state.draft) !== state.initialDraftJson;
  }

  function weaponConfigParentIsDirty(state){
    return !!(
      state &&
      state.context &&
      typeof state.context.parentIsDirty === "function" &&
      state.context.parentIsDirty()
    );
  }

  function weaponConfigSourceWasDeleted(state){
    return !!(
      state &&
      state.context &&
      typeof state.context.sourceWasDeleted === "function" &&
      state.context.sourceWasDeleted()
    );
  }

  async function reloadDeletedWeaponConfigSource(state){
    if(!state || weaponConfigEditorState !== state) return;
    state.overwriteConfirmed = false;
    const reloaded = typeof state.context.reload === "function"
      ? await state.context.reload()
      : true;
    if(reloaded !== false && weaponConfigEditorState === state){
      closeWeaponConfigEditor();
    }
  }

  function weaponConfigConflictNode(state){
    const reload = el("button",{
      class:"btn",
      id:"weaponConfigReload",
      type:"button",
      text:"Recharger la version récente",
      onclick:async()=>{
        if((weaponConfigDraftIsDirty(state) || weaponConfigParentIsDirty(state))
          && !confirm(
          "Recharger la version récente et abandonner tes modifications ?"
        )){
          reload.focus();
          return;
        }
        const reloaded = typeof state.context.reload === "function"
          ? await state.context.reload()
          : true;
        if(reloaded !== false && weaponConfigEditorState === state){
          closeWeaponConfigEditor();
        }
      }
    });
    const overwrite = el("button",{
      class:"btn btn-danger",
      id:"weaponConfigOverwrite",
      type:"button",
      text:"Enregistrer quand même",
      onclick:()=>{
        state.overwriteConfirmed = true;
        state.conflictVisible = false;
        saveWeaponConfigEditor();
      }
    });
    return el("div",{
      class:"weapon-config-conflict",
      role:"alert"
    },[
      el("p",{
        text:"Une version plus récente existe. Choisis laquelle conserver."
      }),
      el("div",{class:"weapon-config-conflict-actions"},[reload,overwrite])
    ]);
  }

  function showWeaponConfigConflict(state){
    if(!state || weaponConfigEditorState !== state) return;
    state.conflictVisible = true;
    renderWeaponConfigEditor();
    const reload = $("#weaponConfigReload");
    if(reload) reload.focus();
  }

  function openWeaponConfigEditor(context, restoreFocus){
    const defaultGradeGameId = context.defaultGradeGameId
      || weaponDefaultGradeGameId(context.weaponFile);
    const initial = context.config == null
      ? emptyWeaponConfig(context.weaponFile, defaultGradeGameId)
      : jsonCopy(context.config);
    weaponConfigEditorState = {
      context,
      draft:initial,
      restoreFocus,
      initialDraftJson:JSON.stringify(initial),
      validationAttempted:false,
      conflictVisible:false,
      overwriteConfirmed:false
    };
    renderWeaponConfigEditor();
    ModalStack.open(
      $("#weaponConfigOverlay"),
      ".weapon-config-grade",
      closeWeaponConfigEditor,
      restoreFocus
    );
  }

  function closeWeaponConfigEditor(){
    ModalStack.close($("#weaponConfigOverlay"));
    weaponConfigEditorState = null;
  }

  function updateWeaponConfigPreview(){
    if(!weaponConfigEditorState) return;
    const preview = $("#weaponConfigPreview");
    preview.innerHTML = "";
    preview.appendChild(weaponStatsSection(
      weaponConfigEditorState.context.weaponFile,
      weaponConfigEditorState.draft
    ));
    $("#weaponConfigError").textContent = weaponConfigEditorState.validationAttempted
      && weaponConfigStatus(
        weaponConfigEditorState.context.weaponFile,
        weaponConfigEditorState.draft
      ) !== "valid"
      ? "Vérifie les champs signalés avant de valider."
      : "";
  }

  function renderBasicWeaponEnchantments(container, grade, draft){
    const catalog = grade.enchantments;
    catalog.slots.forEach((slotRate, index) => {
      const choice = draft.enchantments[index];
      const box = el("div",{
        class:"weapon-enchantment",
        dataset:{slot:String(index)}
      });
      box.appendChild(el("span",{
        class:"weapon-enchantment-title",
        text:"Enchantement "+(index + 1)
      }));
      const select = el("select",{class:"weapon-config-enchantment-choice"});
      select.appendChild(weaponConfigOption("none","Aucun enchantement"));
      (catalog.options || []).forEach(option => {
        select.appendChild(weaponConfigOption(
          option.stat,
          BUILD_STATS.statLabels[option.stat].fr
        ));
      });
      select.value = choice ? choice.stat : "none";
      select.addEventListener("change", event => {
        if(event.target.value === "none"){
          draft.enchantments[index] = null;
        }else{
          const option = catalog.options.find(item => item.stat === event.target.value);
          const bounds = enchantmentBounds(option, slotRate);
          draft.enchantments[index] = {
            slot:index,
            stat:option.stat,
            value:bounds.min
          };
        }
        renderWeaponConfigEditor();
      });
      box.appendChild(weaponConfigField("Statistique",select));
      if(choice){
        const option = catalog.options.find(item => item.stat === choice.stat);
        const bounds = option && enchantmentBounds(option, slotRate);
        const input = el("input",numericKeyboardInputProps({
          class:"weapon-config-enchantment-value",
          step:"1",
          min:bounds ? String(bounds.min) : "0",
          max:bounds ? String(bounds.max) : "0",
          value:String(choice.value)
        }));
        input.addEventListener("input", event => {
          choice.value = event.target.value === ""
            ? null
            : Math.trunc(Number(event.target.value));
          updateWeaponConfigPreview();
        });
        box.appendChild(weaponConfigField(
          "Valeur",
          input,
          bounds ? "De "+bounds.min+" à "+bounds.max+"." : ""
        ));
      }
      container.appendChild(box);
    });
  }

  function renderMasterstoneWeaponEnchantments(container, grade, draft){
    const catalog = grade.enchantments;
    /* Le palier et l'élément appartiennent à la perle entière ; seules les stats
       sont propres à chaque emplacement. La première entrée renseignée porte
       donc la référence. */
    const lead = draft.enchantments.find(item =>
      item && typeof item === "object" && !Array.isArray(item)
    ) || null;
    const box = el("div",{
      class:"weapon-enchantment weapon-enchantment-master",
      dataset:{slot:"0"}
    });
    box.appendChild(el("span",{
      class:"weapon-enchantment-title",
      text:"Perle de sortilège"
    }));
    const tierSelect = el("select",{class:"weapon-config-enchantment-choice"});
    tierSelect.appendChild(weaponConfigOption("none","Aucun enchantement"));
    (catalog.tiers || []).forEach(tier => {
      tierSelect.appendChild(weaponConfigOption(tier.tier,pearlTierLabel(tier.tier)));
    });
    tierSelect.value = lead ? String(lead.tier) : "none";
    tierSelect.addEventListener("change", event => {
      if(event.target.value === "none"){
        draft.enchantments = [null];
      }else{
        // Changer de palier change le nombre d'emplacements : on reconstruit.
        // Les derniers slots Héroïque et Légendaire ne sont pas garantis.
        const tier = Number(event.target.value);
        const requiredSlots = pearlRequiredSlotCount(tier);
        draft.enchantments = Array.from(
          {length:pearlSlotCount(tier)},
          (unused, index) => index < requiredSlots ? {
            slot:index,
            tier,
            element:tier === 5 ? "" : null,
            stat:"",
            value:null
          } : null
        );
      }
      renderWeaponConfigEditor();
    });
    box.appendChild(weaponConfigField("Palier",tierSelect));

    if(lead){
      const tier = (catalog.tiers || []).find(item => item.tier === lead.tier);
      if(tier && tier.elements){
        const elementSelect = el("select",{class:"weapon-config-enchantment-element"});
        elementSelect.appendChild(weaponConfigOption("","Choisir un élément"));
        tier.elements.forEach(group => {
          const label = group.element === "generic"
            ? "Générique"
            : group.element === "default"
              ? "Physique"
              : (ELEMENTS[group.element.toUpperCase()]
                ? ELEMENTS[group.element.toUpperCase()].label
                : group.element);
          elementSelect.appendChild(weaponConfigOption(group.element,label));
        });
        elementSelect.value = lead.element || "";
        elementSelect.addEventListener("change", event => {
          // L'élément vaut pour toute la perle : chaque emplacement le suit.
          draft.enchantments.forEach(entry => {
            if(!entry) return;
            entry.element = event.target.value;
            entry.stat = "";
            entry.value = null;
          });
          renderWeaponConfigEditor();
        });
        box.appendChild(weaponConfigField("Élément",elementSelect));
      }

      const slots = pearlSlotCount(lead.tier);
      const requiredSlots = pearlRequiredSlotCount(lead.tier);
      for(let index = 0; index < slots; index += 1){
        const storedChoice = draft.enchantments[index] || null;
        const choice = storedChoice || {
          slot:index,
          tier:lead.tier,
          element:lead.tier === 5 ? (lead.element || "") : null,
          stat:"",
          value:null
        };
        const slotBox = el("div",{
          class:"weapon-enchantment-slot",
          dataset:{pearlSlot:String(index)}
        });
        if(slots > 1){
          slotBox.appendChild(el("span",{
            class:"weapon-enchantment-slot-title",
            text:"Emplacement "+(index + 1)+" sur "+slots
              +(index >= requiredSlots ? " — facultatif" : "")
          }));
        }
        /* Une stat déjà posée sur un autre emplacement n'est pas proposée :
           autant empêcher l'état interdit que le signaler après coup. */
        const used = new Set(draft.enchantments
          .filter((entry, position) => entry && position !== index && entry.stat)
          .map(entry => entry.stat));
        const options = weaponEnchantOptions(grade, choice)
          .filter(option => !used.has(option.stat));
        const statSelect = el("select",{class:"weapon-config-enchantment-stat"});
        statSelect.appendChild(weaponConfigOption("","Choisir une statistique"));
        options.forEach(option => {
          statSelect.appendChild(weaponConfigOption(
            option.stat,
            BUILD_STATS.statLabels[option.stat].fr
          ));
        });
        statSelect.value = choice.stat || "";
        statSelect.addEventListener("change", event => {
          const stat = event.target.value;
          if(!stat && index >= requiredSlots){
            draft.enchantments[index] = null;
          }else{
            const option = options.find(item => item.stat === stat);
            draft.enchantments[index] = {
              slot:index,
              tier:lead.tier,
              element:lead.tier === 5 ? (lead.element || "") : null,
              stat,
              value:option ? option.min : null
            };
          }
          renderWeaponConfigEditor();
        });
        slotBox.appendChild(weaponConfigField("Statistique",statSelect));

        if(storedChoice && choice.stat){
          const option = options.find(item => item.stat === choice.stat);
          const input = el("input",numericKeyboardInputProps({
            class:"weapon-config-enchantment-value",
            step:"1",
            min:option ? String(option.min) : "0",
            max:option ? String(option.max) : "0",
            value:String(choice.value)
          }));
          input.addEventListener("input", event => {
            choice.value = event.target.value === ""
              ? null
              : Math.trunc(Number(event.target.value));
            updateWeaponConfigPreview();
          });
          slotBox.appendChild(weaponConfigField(
            "Valeur",
            input,
            option ? "De "+option.min+" à "+option.max+"." : ""
          ));
        }
        box.appendChild(slotBox);
      }
    }
    container.appendChild(box);
  }

  function renderWeaponConfigEditor(){
    const state = weaponConfigEditorState;
    if(!state) return;
    const body = $("#weaponConfigBody");
    body.innerHTML = "";
    if(state.conflictVisible){
      body.appendChild(weaponConfigConflictNode(state));
    }
    const grades = weaponGrades(state.context.weaponFile);
    if(!state.draft || !grades.length){
      body.appendChild(el("p",{
        class:"weapon-stats-state",
        text:"Les données chiffrées de cette arme ne sont pas disponibles."
      }));
      updateWeaponConfigPreview();
      return;
    }
    const draft = state.draft;
    const grade = buildWeaponGrade(state.context.weaponFile, draft.gradeGameId);
    if(draft.version !== 1 || !grade){
      body.appendChild(el("p",{
        class:"weapon-stats-state",
        text:"Cette configuration provient d’une version non compatible. "
          +"Tu peux l’annuler ou la réinitialiser sans perdre l’arme."
      }));
      updateWeaponConfigPreview();
      return;
    }

    const gradeSelect = el("select",{class:"weapon-config-grade"});
    grades.forEach(item => {
      gradeSelect.appendChild(weaponConfigOption(
        item.gameId,
        (WEAPON_RARITY_LABELS[item.rarity] || item.rarity)+" · "+item.gameId
      ));
    });
    gradeSelect.value = draft.gradeGameId;
    gradeSelect.addEventListener("change", event => {
      const nextGameId = event.target.value;
      if(nextGameId === draft.gradeGameId) return;
      if(weaponDraftHasChoices(draft)
        && !confirm("Changer de grade effacera les valeurs incompatibles. Continuer ?")){
        event.target.value = draft.gradeGameId;
        return;
      }
      state.draft = emptyWeaponConfig(state.context.weaponFile, nextGameId);
      state.validationAttempted = false;
      renderWeaponConfigEditor();
    });
    body.appendChild(weaponConfigField("Grade",gradeSelect));

    const levelInput = el("input",numericKeyboardInputProps({
      class:"weapon-config-level",
      step:"1",
      min:"0",
      max:String(weaponLevelCap(grade, draft.promotion)),
      value:String(draft.level)
    }));
    levelInput.addEventListener("input", event => {
      draft.level = event.target.value === "" ? null : Math.trunc(Number(event.target.value));
      updateWeaponConfigPreview();
    });
    body.appendChild(weaponConfigField(
      "Niveau",
      levelInput,
      "Maximum actuel : "+weaponLevelCap(grade, draft.promotion)+"."
    ));

    const promotionSelect = el("select",{class:"weapon-config-promotion"});
    for(let promotion = 0; promotion <= grade.promotionSteps.length; promotion += 1){
      promotionSelect.appendChild(weaponConfigOption(promotion,String(promotion)));
    }
    promotionSelect.value = String(draft.promotion);
    promotionSelect.addEventListener("change", event => {
      draft.promotion = Number(event.target.value);
      const cap = weaponLevelCap(grade, draft.promotion);
      if(draft.level > cap) draft.level = cap;
      renderWeaponConfigEditor();
    });
    body.appendChild(weaponConfigField("Promotion",promotionSelect));

    const overlimitLevels = grade.overlimit && Array.isArray(grade.overlimit.levels)
      ? grade.overlimit.levels : [];
    if(overlimitLevels.length){
      const overlimitSelect = el("select",{class:"weapon-config-overlimit"});
      overlimitLevels.forEach(item => {
        overlimitSelect.appendChild(weaponConfigOption(
          item.level,
          item.level+" · +"+new Intl.NumberFormat("fr-FR", {
            maximumFractionDigits:2
          }).format(item.statRate / 100)+" %"
        ));
      });
      overlimitSelect.value = String(draft.overlimit);
      overlimitSelect.addEventListener("change", event => {
        draft.overlimit = Number(event.target.value);
        updateWeaponConfigPreview();
      });
      body.appendChild(weaponConfigField("Outrepassement",overlimitSelect));
    }else{
      draft.overlimit = 0;
    }

    const enchantments = el("div",{class:"weapon-enchantments"},[
      el("span",{class:"weapon-enchantment-title",text:"Enchantements"})
    ]);
    if(grade.enchantments.type === "basic"){
      renderBasicWeaponEnchantments(enchantments, grade, draft);
    }else{
      renderMasterstoneWeaponEnchantments(enchantments, grade, draft);
    }
    body.appendChild(enchantments);
    updateWeaponConfigPreview();
  }

  function saveWeaponConfigEditor(){
    const state = weaponConfigEditorState;
    if(!state) return;
    const status = weaponConfigStatus(state.context.weaponFile, state.draft);
    if(status !== "valid"){
      state.validationAttempted = true;
      renderWeaponConfigEditor();
      const selector = weaponConfigFirstInvalidSelector(
        state.context.weaponFile,
        state.draft
      );
      const invalid = $("#weaponConfigOverlay").querySelector(selector);
      if(invalid){
        invalid.setAttribute("aria-invalid","true");
        invalid.focus();
      }
      return;
    }
    if(weaponConfigSourceWasDeleted(state)){
      void reloadDeletedWeaponConfigSource(state);
      return;
    }
    if(weaponConfigHasConflict(state)){
      showWeaponConfigConflict(state);
      return;
    }
    state.overwriteConfirmed = false;
    state.context.commit(jsonCopy(state.draft));
    closeWeaponConfigEditor();
  }

  function resetWeaponConfigEditor(){
    const state = weaponConfigEditorState;
    if(!state) return;
    if(!confirm("Réinitialiser la configuration chiffrée de cette arme ?")) return;
    state.context.commit(null);
    closeWeaponConfigEditor();
  }

  const WeaponConfigEditor = Object.freeze({
    open:openWeaponConfigEditor,
    close:closeWeaponConfigEditor,
    render:renderWeaponConfigEditor
  });

  $("#weaponConfigClose").addEventListener("click", closeWeaponConfigEditor);
  $("#weaponConfigCancel").addEventListener("click", closeWeaponConfigEditor);
  $("#weaponConfigSave").addEventListener("click", saveWeaponConfigEditor);
  $("#weaponConfigReset").addEventListener("click", resetWeaponConfigEditor);
  $("#weaponConfigOverlay").addEventListener("click", event => {
    if(event.target === $("#weaponConfigOverlay")) closeWeaponConfigEditor();
  });

  let gearConfigEditorState = null;

  function gearConfigSummary(file, config){
    const status = gearConfigStatus(file, config);
    if(status === "unavailable") return "Données indisponibles";
    if(status !== "valid") return "Configurer";
    return "Chiffrée · Nv. "+config.level+" · Renf. +"+config.reinforce;
  }

  function gearConfigControl(context){
    if(!context.file) return null;
    const status = gearConfigStatus(context.file, context.config);
    const summary = gearConfigSummary(context.file, context.config);
    const button = el("button",{
      class:"gear-config-open"+(status === "valid" ? " is-valid" : ""),
      type:"button",
      dataset:{slot:context.slotKey},
      text:summary,
      title:status === "unavailable"
        ? "Données chiffrées indisponibles"
        : "Configurer "+context.label.toLowerCase(),
      "aria-label":status === "valid"
        ? "Modifier la configuration chiffrée — "+context.label
        : "Configurer "+context.label,
      onclick:()=>openGearConfigEditor(context, button)
    });
    if(status === "unavailable") button.disabled = true;
    return button;
  }

  function gearStatsStatusMessage(status){
    if(status === "unavailable"){
      return "Les données chiffrées de cette pièce ne sont pas disponibles.";
    }
    if(status === "missing"){
      return "Configuration à compléter pour calculer l’apport de cette pièce.";
    }
    if(status === "incomplete"){
      return "Complète les champs requis pour afficher l’apport de cette pièce.";
    }
    return "Cette configuration n’est pas compatible avec les données de la pièce.";
  }

  function gearTermLabel(term){
    if(term.source.component === "level") return "Niveau et renforcement";
    if(term.source.component === "enchantment"){
      return "Option aléatoire"
        +(Number.isInteger(term.source.index) ? " "+(term.source.index + 1) : "");
    }
    if(term.source.component === "bonus") return "Bonus d’ensemble";
    return term.source.component;
  }

  function gearTermProvenance(term){
    const source = term.source || {};
    const domains = {
      armor:"armure",
      engraving:"gravure",
      jewel:"bijou",
      set:"ensemble"
    };
    const parts = [
      "Source : "+(domains[source.domain] || source.domain || "inconnue"),
      gearTermLabel(term),
      "opération addition",
      "unité "+(term.unit === "flat" ? "points" : "dix-millièmes")
    ];
    if(source.id) parts.push(source.id);
    if(source.slot) parts.push("emplacement "+source.slot);
    if(term.bucket) parts.push("seau "+term.bucket);
    return parts.join(" · ");
  }

  function gearStatsSection(file, config, slotKey){
    const section = el("section",{class:"weapon-stats"});
    const result = calculateGearStats(file, config, slotKey);
    const engraving = gearDomainOf(slotKey) === "engraving";
    section.appendChild(el("h3",{
      class:"weapon-stats-title",
      text:buildStatsTitle(
        engraving
          ? {of:"de la gravure",passiveKey:"engraving:passive"}
          : {of:"de l’équipement",passiveKey:"armor:passive"},
        result
      )
    }));
    const covered = result.status === "valid"
      && Array.isArray(result.coverage)
      && result.coverage.includes(gearDomainOf(slotKey));
    if(!covered){
      section.appendChild(el("p",{
        class:"weapon-stats-state",
        text:gearStatsStatusMessage(result.status)
      }));
      return section;
    }

    groupBuildStatResults(result).forEach(group => {
      const family = el("section",{class:"weapon-stats-family"});
      family.appendChild(el("h4",{
        class:"weapon-stats-family-title",
        text:BUILD_STAT_FAMILY_LABELS[group.family] || group.family
      }));
      group.stats.forEach(stat => {
        const statNode = el("div",{class:"weapon-stat"});
        statNode.appendChild(el("div",{class:"weapon-stat-head"},[
          el("span",{text:stat.label}),
          el("span",{
            class:"weapon-stat-total",
            dataset:{unit:stat.unit},
            text:formatBuildStatValue(stat.value, stat.unit)
              +(stat.unit === "flat" ? " points" : "")
          })
        ]));
        const details = statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit)
            +(term.unit === "flat" ? " points" : ""),
          termProvenance:gearTermProvenance
        });
        statNode.appendChild(details);
        family.appendChild(statNode);
      });
      section.appendChild(family);
    });
    return section;
  }

  function gearConfigFirstInvalidSelector(file, draft){
    const definition = buildGearDefinition(file);
    if(!definition) return ".gear-config-level";
    if(!draft || !isInteger(draft.level)
      || draft.level < definition.qualityMin
      || draft.level > definition.qualityMax){
      return ".gear-config-level";
    }
    if(!isInteger(draft.reinforce)
      || draft.reinforce < 0
      || draft.reinforce > definition.reinforceMax){
      return ".gear-config-reinforce";
    }
    const choices = Array.isArray(draft.enchantments) ? draft.enchantments : [];
    for(let index = 0; index < choices.length; index += 1){
      const status = gearEnchantmentChoiceStatus(definition, choices[index], index);
      if(status !== "valid"){
        const suffix = choices[index] && choices[index].stat ? "value" : "stat";
        return '[data-gear-slot="'+index+'"] .gear-config-enchantment-'+suffix;
      }
    }
    return ".gear-config-level";
  }

  function updateGearConfigPreview(){
    const state = gearConfigEditorState;
    if(!state) return;
    const preview = $("#gearConfigPreview");
    preview.innerHTML = "";
    preview.appendChild(gearStatsSection(
      state.context.file,
      state.draft,
      state.context.slotKey
    ));
    $("#gearConfigError").textContent = state.validationAttempted
      && gearConfigStatus(state.context.file, state.draft) !== "valid"
      ? "Vérifie les champs signalés avant de valider."
      : "";
  }

  function renderGearConfigEnchantments(body, definition, draft){
    const container = el("div",{class:"weapon-enchantments"},[
      el("span",{class:"weapon-enchantment-title",text:"Options aléatoires"})
    ]);
    const options = (definition.randomOptions
      && Array.isArray(definition.randomOptions.stats))
      ? definition.randomOptions.stats : [];
    draft.enchantments.forEach((choice, index) => {
      const used = new Set(draft.enchantments
        .filter((entry, position) => entry && position !== index && entry.stat)
        .map(entry => entry.stat));
      const available = options.filter(option => !used.has(option.stat));
      const box = el("div",{
        class:"weapon-enchantment",
        dataset:{gearSlot:String(index)}
      });
      box.appendChild(el("span",{
        class:"weapon-enchantment-title",
        text:"Option "+(index + 1)
      }));
      const select = el("select",{class:"gear-config-enchantment-stat"});
      select.appendChild(weaponConfigOption("","Aucune option"));
      available.forEach(option => {
        const metadata = BUILD_STATS.statLabels[option.stat];
        select.appendChild(weaponConfigOption(
          option.stat,
          metadata ? metadata.fr : option.stat
        ));
      });
      select.value = choice ? choice.stat : "";
      select.addEventListener("change", event => {
        const option = options.find(item => item.stat === event.target.value);
        draft.enchantments[index] = option ? {
          slot:index,
          stat:option.stat,
          value:option.min
        } : null;
        renderGearConfigEditor();
      });
      box.appendChild(weaponConfigField("Statistique",select));
      if(choice){
        const option = options.find(item => item.stat === choice.stat);
        const value = el("input",numericKeyboardInputProps({
          class:"gear-config-enchantment-value",
          step:"1",
          min:option ? String(option.min) : "0",
          max:option ? String(option.max) : "0",
          value:String(choice.value)
        }));
        value.addEventListener("input", event => {
          choice.value = event.target.value === ""
            ? null
            : Math.trunc(Number(event.target.value));
          updateGearConfigPreview();
        });
        box.appendChild(weaponConfigField(
          "Valeur",
          value,
          option ? "De "+option.min+" à "+option.max+"." : ""
        ));
      }
      container.appendChild(box);
    });
    if(!draft.enchantments.length){
      container.appendChild(el("p",{
        class:"weapon-config-hint",
        text:"Cette pièce ne possède aucun emplacement d’option aléatoire."
      }));
    }
    body.appendChild(container);
  }

  function renderGearConfigPassive(body, definition, draft){
    if(!Array.isArray(definition.passiveLevels)
      || !definition.passiveLevels.length){
      return;
    }
    const container = el("div",{class:"gear-config-passive"},[
      el("span",{class:"weapon-enchantment-title",text:"Passif"})
    ]);
    const select = el("select",{class:"gear-config-passive-level"});
    select.appendChild(weaponConfigOption("","À renseigner"));
    definition.passiveLevels.forEach(item => {
      select.appendChild(weaponConfigOption(item.level,String(item.level)));
    });
    select.value = isInteger(draft.passiveLevel)
      && draft.passiveLevel >= 1
      && draft.passiveLevel <= GEAR_PASSIVE_MAX_LEVEL
      ? String(draft.passiveLevel) : "";
    const description = el("p",{class:"hero-passive-text weapon-config-hint"});
    const updateDescription = () => {
      const selected = definition.passiveLevels.find(
        item => item.level === draft.passiveLevel
      );
      description.innerHTML = selected
        ? renderBonus(selected.textFr || "")
        : "Niveau du passif à renseigner";
    };
    select.addEventListener("change", event => {
      draft.passiveLevel = event.target.value === ""
        ? null : Number(event.target.value);
      updateDescription();
      updateGearConfigPreview();
    });
    container.appendChild(weaponConfigField(
      "Niveau du passif",
      select,
      "Information enregistrée séparément ; elle ne modifie pas les chiffres."
    ));
    updateDescription();
    container.appendChild(description);
    body.appendChild(container);
  }

  function renderGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    const body = $("#gearConfigBody");
    body.innerHTML = "";
    const definition = buildGearDefinition(state.context.file);
    if(!definition || !state.draft){
      body.appendChild(el("p",{
        class:"weapon-stats-state",
        text:"Les données chiffrées de cette pièce ne sont pas disponibles."
      }));
      updateGearConfigPreview();
      return;
    }
    const draft = state.draft;
    const level = el("input",numericKeyboardInputProps({
      class:"gear-config-level",
      step:"1",
      min:String(definition.qualityMin),
      max:String(definition.qualityMax),
      value:String(draft.level)
    }));
    level.addEventListener("input", event => {
      draft.level = event.target.value === ""
        ? null
        : Math.trunc(Number(event.target.value));
      updateGearConfigPreview();
    });
    body.appendChild(weaponConfigField(
      "Niveau de qualité",
      level,
      "De "+definition.qualityMin+" à "+definition.qualityMax+"."
    ));

    const reinforce = el("select",{class:"gear-config-reinforce"});
    for(let value = 0; value <= definition.reinforceMax; value += 1){
      reinforce.appendChild(weaponConfigOption(value,"+"+value));
    }
    reinforce.value = String(draft.reinforce);
    reinforce.addEventListener("change", event => {
      draft.reinforce = Number(event.target.value);
      updateGearConfigPreview();
    });
    body.appendChild(weaponConfigField("Renforcement",reinforce));
    renderGearConfigEnchantments(body, definition, draft);
    renderGearConfigPassive(body, definition, draft);
    updateGearConfigPreview();
  }

  function openGearConfigEditor(context, restoreFocus){
    const initial = context.config == null
      ? emptyGearConfig(context.file)
      : jsonCopy(context.config);
    if(initial && initial.version === 1 && !owns(initial, "passiveLevel")){
      initial.passiveLevel = null;
    }
    gearConfigEditorState = {
      context,
      draft:initial,
      validationAttempted:false
    };
    $("#gearConfigTitle").textContent = "Configurer — "+context.label;
    renderGearConfigEditor();
    ModalStack.open(
      $("#gearConfigOverlay"),
      ".gear-config-level",
      closeGearConfigEditor,
      restoreFocus
    );
  }

  function closeGearConfigEditor(){
    ModalStack.close($("#gearConfigOverlay"));
    gearConfigEditorState = null;
  }

  function saveGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    if(gearConfigStatus(state.context.file, state.draft) !== "valid"){
      state.validationAttempted = true;
      renderGearConfigEditor();
      const invalid = $("#gearConfigOverlay").querySelector(
        gearConfigFirstInvalidSelector(state.context.file, state.draft)
      );
      if(invalid){
        invalid.setAttribute("aria-invalid","true");
        invalid.focus();
      }
      return;
    }
    state.context.commit(jsonCopy(state.draft));
    closeGearConfigEditor();
  }

  function resetGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    if(!confirm("Réinitialiser la configuration chiffrée de cette pièce ?")) return;
    state.context.commit(null);
    closeGearConfigEditor();
  }

  $("#gearConfigClose").addEventListener("click", closeGearConfigEditor);
  $("#gearConfigCancel").addEventListener("click", closeGearConfigEditor);
  $("#gearConfigSave").addEventListener("click", saveGearConfigEditor);
  $("#gearConfigReset").addEventListener("click", resetGearConfigEditor);
  $("#gearConfigOverlay").addEventListener("click", event => {
    if(event.target === $("#gearConfigOverlay")) closeGearConfigEditor();
  });

  function applyWeaponChange(hero, nextFile){
    const source = hero && typeof hero === "object" ? hero : {};
    const changed = source.weapon !== nextFile;
    return Object.assign({}, jsonCopy(source), {
      weapon:nextFile || null,
      weaponConfig:changed ? null : normalizeWeaponConfig(nextFile, source.weaponConfig)
    });
  }
  function applyGearChange(target, kind, slot, nextFile){
    const configKey = kind + "Config";
    if(!target[kind] || typeof target[kind] !== "object"){
      target[kind] = kind === "armor" ? emptyArmor() : emptyJewel();
    }
    if(!target[configKey] || typeof target[configKey] !== "object"){
      target[configKey] = {};
    }
    if(target[kind][slot] !== nextFile){
      delete target[configKey][slot];
    }
    target[kind][slot] = nextFile || null;
    return target;
  }
  const TEAM_BUILD_FIELDS = [
    "weapon",
    "weaponConfig",
    "armor",
    "armorConfig",
    "jewel",
    "jewelConfig",
    "note"
  ];
  function teamBuildSnapshot(raw){
    const source = raw && typeof raw === "object" ? raw : {};
    const defaults = {
      weapon:null,
      weaponConfig:null,
      armor:emptyArmor(),
      armorConfig:{},
      jewel:emptyJewel(),
      jewelConfig:{},
      note:""
    };
    return TEAM_BUILD_FIELDS.reduce((copy, field) => {
      copy[field] = jsonCopy(
        Object.prototype.hasOwnProperty.call(source, field)
          ? source[field]
          : defaults[field]
      );
      return copy;
    }, {});
  }
  function normalizeBuildFields(charId, weaponType, raw){
    const source = raw && typeof raw === "object" ? raw : {};
    const candidateType = weaponFolderOf(source.weapon);
    const weapon = isWeaponCompatible(charId, source.weapon)
      && (!weaponType || candidateType === weaponType)
      ? (source.weapon || null)
      : null;
    const armor = Object.assign(emptyArmor(), source.armor || {});
    if(!isLinkedArmorCompatible(charId, armor[LINKED_ARMOR_SLOT])){
      armor[LINKED_ARMOR_SLOT] = null;
    }
    const jewel = Object.assign(emptyJewel(), source.jewel || {});
    return {
      weapon,
      weaponConfig:weapon
        ? normalizeWeaponConfig(weapon, source.weaponConfig)
        : null,
      armor,
      armorConfig:normalizeGearConfigMap(
        armor,
        source.armorConfig,
        ARMOR_SLOTS
      ),
      jewel,
      jewelConfig:normalizeGearConfigMap(
        jewel,
        source.jewelConfig,
        JEWEL_SLOTS
      ),
      note:typeof source.note === "string" ? source.note : ""
    };
  }
  function normalizeHero(raw){
    const h = raw && typeof raw === "object" ? raw : {};
    const char = h.char||null;
    const allowed = weaponTypesOf(char);
    const equippedType = weaponFolderOf(h.weapon);
    const storedType = allowed.includes(h.activeWeaponType)
      ? h.activeWeaponType
      : null;
    const activeWeaponType = allowed.includes(equippedType)
      ? equippedType
      : storedType;
    const rosterBuilds = {};
    if(h.rosterBuilds && typeof h.rosterBuilds === "object"
      && !Array.isArray(h.rosterBuilds)){
      allowed.forEach(type => {
        if(Object.prototype.hasOwnProperty.call(h.rosterBuilds, type)){
          rosterBuilds[type] = teamBuildSnapshot(
            normalizeBuildFields(char, type, h.rosterBuilds[type])
          );
        }
      });
    }
    const active = normalizeBuildFields(char, activeWeaponType, h);
    if(activeWeaponType){
      rosterBuilds[activeWeaponType] = teamBuildSnapshot(active);
    }
    return Object.assign({
      char,
      rosterBuilds,
      activeWeaponType,
      potentiel:normalizePotentiel(h.potentiel),
    }, active);
  }
  function storeActiveHeroBuild(hero){
    if(!hero || !hero.char) return hero;
    const type = weaponFolderOf(hero.weapon) || hero.activeWeaponType;
    if(!weaponTypesOf(hero.char).includes(type)) return hero;
    if(!hero.rosterBuilds || typeof hero.rosterBuilds !== "object"
      || Array.isArray(hero.rosterBuilds)){
      hero.rosterBuilds = {};
    }
    hero.rosterBuilds[type] = teamBuildSnapshot(
      normalizeBuildFields(hero.char, type, hero)
    );
    hero.activeWeaponType = type;
    return hero;
  }
  function activateHeroBuild(hero, weaponType){
    if(!hero || !weaponTypesOf(hero.char).includes(weaponType)) return hero;
    storeActiveHeroBuild(hero);
    const target = normalizeBuildFields(
      hero.char,
      weaponType,
      hero.rosterBuilds && hero.rosterBuilds[weaponType]
    );
    Object.assign(hero, teamBuildSnapshot(target), {
      activeWeaponType:weaponType
    });
    return hero;
  }
  function applyCharacterChange(hero, nextChar){
    const next = jsonCopy(normalizeHero(hero));
    if(next.char === nextChar) return next;
    next.char = nextChar || null;
    next.rosterBuilds = {};
    next.activeWeaponType = null;
    if(!isWeaponCompatible(next.char, next.weapon)){
      next.weapon = null;
      next.weaponConfig = null;
    }
    if(!isLinkedArmorCompatible(
      next.char,
      next.armor && next.armor[LINKED_ARMOR_SLOT]
    )){
      next.armor[LINKED_ARMOR_SLOT] = null;
      delete next.armorConfig[LINKED_ARMOR_SLOT];
    }
    return normalizeHero(next);
  }
  const emptyRosterBuild = () => ({
    weapon:null,
    weaponConfig:null,
    armor:emptyArmor(),
    armorConfig:{},
    jewel:emptyJewel(),
    jewelConfig:{},
    note:"",
    favorite:false
  });
  function normalizeRosterBuild(charId, weaponType, raw){
    const source = raw && typeof raw === "object" ? raw : {};
    const knownWeapons = Object.values(compatibleWeaponGroups(charId)).flat();
    const weapon = weaponFolderOf(source.weapon) === weaponType
      && knownWeapons.some(item => item.file === source.weapon)
      ? source.weapon
      : null;
    const build = normalizeBuildFields(charId, weaponType, {
      ...source,
      weapon,
    });
    return {
      ...build,
      favorite:source.favorite === true
    };
  }
  function normalizeRosterCharacter(raw){
    const source = raw && typeof raw === "object" ? raw : {};
    const charId = typeof source.charId === "string" ? source.charId : "";
    if(!charOf(charId)) return null;
    const allowed = weaponTypesOf(charId);
    const sourceBuilds = source.builds && typeof source.builds === "object" ? source.builds : {};
    let favoriteFound = false;
    const builds = allowed.reduce((result, weaponType)=>{
      if(Object.prototype.hasOwnProperty.call(sourceBuilds, weaponType)){
        const build = normalizeRosterBuild(
          charId,
          weaponType,
          sourceBuilds[weaponType]
        );
        if(build.favorite){
          if(favoriteFound) build.favorite = false;
          else favoriteFound = true;
        }
        result[weaponType] = build;
      }
      return result;
    }, {});
    return {
      owner:typeof source.owner === "string" ? source.owner : "",
      charId,
      potentialTier:normalizePotentiel({tier:source.potentialTier}).tier,
      builds,
      updatedAt:Number.isFinite(Number(source.updatedAt))
        ? Number(source.updatedAt)
        : 0,
      updatedAtToken:typeof source.updatedAtToken === "string"
        ? source.updatedAtToken
        : ""
    };
  }
  function rosterEntryWithActiveHeroBuild(existing, hero, ownerId){
    const type = hero.activeWeaponType || weaponFolderOf(hero.weapon);
    const next = normalizeRosterCharacter(existing || {
      owner:ownerId,
      charId:hero.char,
      potentialTier:0,
      builds:{}
    });
    const favorite = !!(
      next.builds[type] && next.builds[type].favorite
    );
    next.potentialTier = normalizePotentiel(hero.potentiel).tier;
    next.builds[type] = Object.assign(
      normalizeRosterBuild(hero.char, type, hero),
      { favorite }
    );
    return next;
  }
  function favoriteRosterWeaponType(entry){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized) return null;
    return Object.keys(normalized.builds)
      .find(type => normalized.builds[type].favorite) || null;
  }
  function setFavoriteRosterBuild(entry, weaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized
      || !Object.prototype.hasOwnProperty.call(normalized.builds, weaponType)){
      return null;
    }
    const wasFavorite = normalized.builds[weaponType].favorite;
    Object.values(normalized.builds)
      .forEach(build => { build.favorite = false; });
    normalized.builds[weaponType].favorite = !wasFavorite;
    return normalized;
  }
  function copyFavoriteRosterBuild(entry, targetWeaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized || !weaponTypesOf(normalized.charId).includes(targetWeaponType)){
      return null;
    }
    const sourceType = favoriteRosterWeaponType(normalized);
    if(!sourceType || sourceType === targetWeaponType) return null;
    const source = normalized.builds[sourceType];
    const target = normalized.builds[targetWeaponType] || emptyRosterBuild();
    normalized.builds[targetWeaponType] = {
      weapon:target.weapon,
      weaponConfig:jsonCopy(target.weaponConfig),
      armor:JSON.parse(JSON.stringify(source.armor)),
      armorConfig:JSON.parse(JSON.stringify(source.armorConfig)),
      jewel:JSON.parse(JSON.stringify(source.jewel)),
      jewelConfig:JSON.parse(JSON.stringify(source.jewelConfig)),
      note:source.note,
      favorite:false
    };
    return normalizeRosterCharacter(normalized);
  }
  function rosterHeroSnapshot(entry, weaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized || !Object.prototype.hasOwnProperty.call(normalized.builds, weaponType)) return null;
    const build = normalized.builds[weaponType];
    const rosterBuilds = Object.keys(normalized.builds)
      .reduce((result, type) => {
        result[type] = teamBuildSnapshot(normalized.builds[type]);
        return result;
      }, {});
    return normalizeHero({
      char:normalized.charId,
      weapon:build.weapon,
      weaponConfig:build.weaponConfig,
      armor:build.armor,
      armorConfig:build.armorConfig,
      jewel:build.jewel,
      jewelConfig:build.jewelConfig,
      rosterBuilds,
      activeWeaponType:weaponType,
      potentiel:{tier:normalized.potentialTier},
      note:build.note
    });
  }
  function cloudRosterFromRow(row){
    if(!row || typeof row !== "object") return null;
    return normalizeRosterCharacter({
      owner:row.owner,
      charId:row.char_id,
      potentialTier:row.potential_tier,
      builds:row.builds,
      updatedAt:row.updated_at ? Date.parse(row.updated_at) : 0,
      updatedAtToken:typeof row.updated_at === "string"
        ? row.updated_at
        : ""
    });
  }
  function rosterToCloudRow(entry, ownerId){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized || typeof ownerId !== "string" || !ownerId) return null;
    return {
      owner:ownerId,
      char_id:normalized.charId,
      potential_tier:normalized.potentialTier,
      builds:JSON.parse(JSON.stringify(normalized.builds)),
      updated_at:new Date(normalized.updatedAt || Date.now()).toISOString()
    };
  }
  function readRosterCache(){
    try{
      const list = JSON.parse(localStorage.getItem(CLOUD_ROSTER_CACHE_KEY)) || [];
      return Array.isArray(list)
        ? list.map(normalizeRosterCharacter).filter(Boolean)
        : [];
    }catch(error){
      return [];
    }
  }
  let cloudRosterCache = readRosterCache();
  function saveRosterCache(list){
    cloudRosterCache = (Array.isArray(list) ? list : [])
      .map(normalizeRosterCharacter)
      .filter(Boolean);
    localStorage.setItem(
      CLOUD_ROSTER_CACHE_KEY,
      JSON.stringify(cloudRosterCache)
    );
  }
  function replaceRosterCacheForOwner(ownerId, entries){
    const others = cloudRosterCache.filter(entry => entry.owner !== ownerId);
    const owned = (Array.isArray(entries) ? entries : [])
      .map(entry => normalizeRosterCharacter(
        Object.assign({}, entry, {owner:ownerId})
      ))
      .filter(Boolean);
    saveRosterCache(others.concat(owned));
    return owned;
  }
  const MemberRosterStore = {
    all(ownerId){
      if(!ownerId) return [];
      return cloudRosterCache
        .filter(entry => entry.owner === ownerId)
        .map(normalizeRosterCharacter)
        .filter(Boolean);
    },
    async refresh(ownerId){
      if(!ownerId) return [];
      if(!sessionCourante.user || !sb) return MemberRosterStore.all(ownerId);
      const { data, error } = await sb.from("roster_characters")
        .select("*")
        .eq("owner", ownerId);
      if(error) throw error;
      return replaceRosterCacheForOwner(
        ownerId,
        (data || []).map(cloudRosterFromRow).filter(Boolean)
      );
    },
    async upsert(entry){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const normalized = normalizeRosterCharacter(Object.assign({}, entry, {
        owner:sessionCourante.user.id,
        updatedAt:Date.now(),
        updatedAtToken:""
      }));
      if(!normalized) throw new Error("ROSTER_INVALID");
      const { error } = await sb.from("roster_characters")
        .upsert(rosterToCloudRow(normalized, sessionCourante.user.id));
      if(error) throw error;
      const owned = MemberRosterStore.all(sessionCourante.user.id);
      const index = owned.findIndex(item => item.charId === normalized.charId);
      if(index >= 0) owned[index] = normalized;
      else owned.push(normalized);
      replaceRosterCacheForOwner(sessionCourante.user.id, owned);
      return normalized;
    },
    async updateBuild(entry, weaponType, expectedUpdatedAtToken){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const normalized = normalizeRosterCharacter(Object.assign({}, entry, {
        owner:sessionCourante.user.id
      }));
      if(!normalized
        || !Object.prototype.hasOwnProperty.call(
          normalized.builds,
          weaponType
        )){
        throw new Error("ROSTER_INVALID");
      }
      const { data, error } = await sb.rpc("update_roster_build", {
        p_char_id:normalized.charId,
        p_expected_updated_at:expectedUpdatedAtToken || null,
        p_potential_tier:normalized.potentialTier,
        p_weapon_type:weaponType,
        p_build:normalized.builds[weaponType]
      });
      if(error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      const saved = cloudRosterFromRow(row);
      if(!saved) throw new Error("ROSTER_INVALID");
      const owned = MemberRosterStore.all(sessionCourante.user.id);
      const index = owned.findIndex(item =>
        item.charId === saved.charId
      );
      if(index >= 0) owned[index] = saved;
      else owned.push(saved);
      replaceRosterCacheForOwner(sessionCourante.user.id, owned);
      return saved;
    },
    async remove(charId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.from("roster_characters")
        .delete()
        .eq("owner", sessionCourante.user.id)
        .eq("char_id", charId);
      if(error) throw error;
      replaceRosterCacheForOwner(
        sessionCourante.user.id,
        MemberRosterStore.all(sessionCourante.user.id)
          .filter(entry => entry.charId !== charId)
      );
    }
  };
  async function refreshRosterProfiles(){
    if(!sessionCourante.user || !sb) return sessionCourante.rosterProfiles.slice();
    const { data, error } = await sb.from("profiles")
      .select("id,pseudo")
      .order("pseudo", {ascending:true});
    if(error) throw error;
    sessionCourante.rosterProfiles = (data || [])
      .filter(item => item && item.id)
      .map(item => ({id:item.id, pseudo:item.pseudo || "Membre"}));
    return sessionCourante.rosterProfiles.slice();
  }

  /* ===== #5 Analyse : DPS dérivés du Roster ===== */
  // Un build Attaquant du roster = une entrée DPS { char, element, pot }.
  // Exception unique : Gowther Baguette (Briseur) à partir de P7.
  function isRosterBuildDps(entry, slot, weaponEnum){
    if(slot.role === "Attacker") return true;
    return slot.role === "Buster"
      && entry.charId === "gowther"
      && weaponEnum === "Wand"
      && (entry.potentialTier||0) >= 7;
  }
  /* Préférence de jeu du propriétaire, propre à Meliodas : à défaut de favori,
     ouvrir l'Épée à une main. Ce n'est pas une liste d'assets — c'est une
     règle produit nommée. La généraliser changerait le comportement de futurs
     personnages sans décision. */
  const DPS_PREFERRED_WEAPON_BY_CHAR = { meliodas:"Sword1h" };

  function dpsEntriesFromRoster(entry){
    const m = entry && metaOf(entry.charId);
    if(!m || !entry.builds) return [];
    /* Les SR sont hors de l'analyse DPS. Filtrer ici les retire d'un coup du
       classement, de la couverture et de la matrice, qui dérivent toutes de
       cette sortie. */
    if(m.rarity !== "SSR") return [];
    const favoriteFolder = favoriteRosterWeaponType(entry);
    const favoriteEnum = favoriteFolder ? FOLDER_TO_ENUM[favoriteFolder] : null;
    const preferred = DPS_PREFERRED_WEAPON_BY_CHAR[entry.charId] || null;
    const byElement = new Map();
    /* On parcourt les slots du personnage, pas les clés de `builds` : l'ordre
       des armes devient stable d'un membre à l'autre. */
    (m.weapons||[]).forEach(slot => {
      const en = slot.weapon;
      const folder = ENUM_TO_FOLDER[en];
      if(!folder || !owns(entry.builds, folder)) return;
      if(!isRosterBuildDps(entry, slot, en)) return;
      const element = (slot.element||"").toUpperCase();
      if(!element) return;
      if(!byElement.has(element)){
        byElement.set(element, {
          char:entry.charId,
          element,
          pot:entry.potentialTier||0,
          weaponTypes:[],
          preferredWeaponType:null
        });
      }
      byElement.get(element).weaponTypes.push(en);
    });
    return [...byElement.values()].map(item => Object.assign(item, {
      preferredWeaponType:
        (favoriteEnum && item.weaponTypes.includes(favoriteEnum) && favoriteEnum)
        || (preferred && item.weaponTypes.includes(preferred) && preferred)
        || item.weaponTypes[0]
    }));
  }

  /* Assemblage d'un joueur de l'analyse. `characters` conserve les rosters
     normalises deja calcules : la modale de detail doit pouvoir s'ouvrir sans
     relire le reseau. */
  function rosterPlayerFrom(owner, name, entries){
    return {
      owner,
      name,
      characters:entries,
      dps:entries.reduce((acc, e) => acc.concat(dpsEntriesFromRoster(e)), [])
    };
  }

  // Agrège tous les rosters de la confrérie -> [{owner, name, dps:[…], characters:[…]}]
  async function rosterDerivedPlayers(){
    if(!sessionCourante.user || !sb) return [];
    const [rosterRes, profiles] = await Promise.all([
      sb.from("roster_characters").select("owner,char_id,potential_tier,builds,updated_at"),
      refreshRosterProfiles().catch(()=>sessionCourante.rosterProfiles.slice())
    ]);
    if(rosterRes.error) throw rosterRes.error;
    const byOwner = {};
    (rosterRes.data||[]).forEach(row=>{
      const entry = cloudRosterFromRow(row);
      if(!entry) return;
      (byOwner[entry.owner] = byOwner[entry.owner] || []).push(entry);
    });
    const nameOf = id => {
      const p = (profiles||[]).find(x => x.id === id);
      if(p) return p.pseudo;
      if(sessionCourante.user && id === sessionCourante.user.id) return sessionCourante.pseudo || "Moi";
      return "Membre";
    };
    return Object.keys(byOwner)
      .map(owner => rosterPlayerFrom(owner, nameOf(owner), byOwner[owner]))
      .filter(p => p.dps.length);
  }
  const TEAM_NAME_MAX = 40;

  /* Nom d'équipe facultatif. Il vit dans le jsonb de `teams.data`, donc aucune
     migration Supabase : une équipe antérieure devient simplement sans nom. */
  function normalizeTeamName(value){
    if(value === null || value === undefined) return "";
    return String(value).trim().slice(0, TEAM_NAME_MAX);
  }

  function normalizeTeam(raw){
    const t = raw && typeof raw === "object" ? raw : {};
    const heroes = Array.isArray(t.heroes) ? t.heroes.slice(0, TEAM_SIZE) : [];
    while(heroes.length < TEAM_SIZE) heroes.push({});
    return Object.assign({}, t, {
      name:normalizeTeamName(t.name),
      heroes:heroes.map(normalizeHero)
    });
  }
  const emptyHero = () => ({
    char:null,
    weapon:null,
    weaponConfig:null,
    rosterBuilds:{},
    activeWeaponType:null,
    armor:emptyArmor(),
    armorConfig:{},
    jewel:emptyJewel(),
    jewelConfig:{},
    potentiel:emptyPot(),
    note:""
  });
  const emptyDraft = () => ({ id:uid(), name:"", pseudo:"", boss:"",
                              heroes:Array.from({length:TEAM_SIZE}, emptyHero) });

  let draft = emptyDraft();
  let editing = false;
  let teamDraftSourceUpdatedAt = 0;
  let teamDraftInitialJson = JSON.stringify(draft);
  let teamDraftDeletedRemotely = false;
  let builderRosterBaselines = Array.from(
    {length:TEAM_SIZE},
    () => ({
      ownerId:"",
      charId:"",
      updatedAt:0,
      updatedAtToken:"",
      builds:{}
    })
  );
  function rosterBaselineIdentityMatches(baseline, ownerId, charId){
    return !!baseline
      && baseline.ownerId === (ownerId || "")
      && baseline.charId === (charId || "");
  }
  function rosterBaselineVersionMatches(baseline, latest){
    const baselineToken = baseline
      && typeof baseline.updatedAtToken === "string"
      ? baseline.updatedAtToken
      : "";
    const latestToken = latest
      && typeof latest.updatedAtToken === "string"
      ? latest.updatedAtToken
      : "";
    if(baselineToken && latestToken){
      return baselineToken === latestToken;
    }
    return (Number(baseline && baseline.updatedAt) || 0)
      === (Number(latest && latest.updatedAt) || 0);
  }
  function builderRosterBaselineForHero(hero){
    const ownerId = sessionCourante.user ? sessionCourante.user.id : "";
    const charId = hero && hero.char ? hero.char : "";
    const entry = ownerId && charId
      ? MemberRosterStore.all(ownerId)
        .find(item => item.charId === charId)
      : null;
    return {
      ownerId,
      charId,
      updatedAt:Number(entry && entry.updatedAt) || 0,
      updatedAtToken:entry && entry.updatedAtToken || "",
      builds:entry ? jsonCopy(entry.builds) : {}
    };
  }
  function resetBuilderRosterBaseline(index){
    builderRosterBaselines[index] = builderRosterBaselineForHero(
      draft.heroes[index]
    );
  }
  function resetBuilderRosterBaselines(){
    builderRosterBaselines = draft.heroes.map(
      builderRosterBaselineForHero
    );
  }
  function builderBuildIsDirty(index, type){
    const hero = draft.heroes[index];
    const activeType = hero
      && (weaponFolderOf(hero.weapon) || hero.activeWeaponType);
    const current = type === activeType
      ? teamBuildSnapshot(hero)
      : hero && hero.rosterBuilds && hero.rosterBuilds[type];
    const baseline = builderRosterBaselines[index]
      && builderRosterBaselines[index].builds[type];
    return JSON.stringify(teamBuildSnapshot(current || {}))
      !== JSON.stringify(teamBuildSnapshot(baseline || {}));
  }

  /* ============================ Toast ============================ */
  let toastTimer;
  function toast(msg, isErr){
    const t = $("#toast");
    t.textContent = msg;
    t.setAttribute("role", isErr ? "alert" : "status");
    t.setAttribute("aria-live", isErr ? "assertive" : "polite");
    t.classList.toggle("err", !!isErr);
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>t.classList.remove("on"), 2600);
  }

  const RealtimeSync = (function(){
    const tables = [
      "profiles",
      "teams",
      "roster_characters",
      "boss_sessions",
      "boss_participation",
      "boss_run_reports",
      "member_availability"
    ];
    let channel = null;
    let userId = "";
    let timer = null;
    const pending = new Set();

    function setStatus(state, text){
      const node = $("#liveStatus");
      if(!node) return;
      node.dataset.state = state;
      node.textContent = text;
    }

    function activeView(){
      const view = document.querySelector(".view.active");
      return view ? view.id.replace(/^view-/, "") : "";
    }

    async function flush(){
      timer = null;
      const changed = new Set(pending);
      pending.clear();
      const view = activeView();
      /* « Mon suivi » dérive des équipes et des tables de boss. Quand il est
         actif il se recharge silencieusement, et sa lecture unique remplace les
         branches teams/boss pour ce même lot d'événements. Sinon il est
         seulement marqué sale : Realtime ne change jamais l'onglet actif. */
      const dashboardChanged = changed.has("teams") || changed.has("boss");
      const dashboardActive = view === "dashboard";
      try{
        if(changed.has("teams") && !dashboardActive){
          if(view === "roster") await renderRoster();
          else await Store.refresh();
        }
        if(changed.has("roster")){
          if(view === "member-roster") await renderMemberRoster();
          if(view === "analyse") await renderAnalyse();
        }
        if(changed.has("boss") && view === "boss"){
          const refreshed = await renderBossView({
            showLoading:false,
            ensureWeek:false,
            showErrorToast:false
          });
          if(!refreshed) throw new Error("BOSS_SYNC_FAILED");
        }
        if(changed.has("availability") && view === "availability"){
          const refreshed = await renderAvailabilityView();
          if(!refreshed) throw new Error("AVAILABILITY_SYNC_FAILED");
        }
        if(dashboardChanged){
          if(dashboardActive){
            const refreshed = await renderDashboardView({
              showLoading:false,
              force:true
            });
            if(!refreshed) throw new Error("DASHBOARD_SYNC_FAILED");
          }else{
            DashboardStore.markDirty();
          }
        }
      }catch(error){
        setStatus("offline", "Synchronisation indisponible");
      }
    }

    function schedule(table){
      if(table === "teams") pending.add("teams");
      if(table === "profiles" || table === "roster_characters"){
        pending.add("roster");
      }
      if(
        table === "boss_sessions" ||
        table === "boss_participation" ||
        table === "boss_run_reports"
      ){
        pending.add("boss");
      }
      if(table === "member_availability") pending.add("availability");
      clearTimeout(timer);
      timer = setTimeout(()=>void flush(), 120);
    }

    function stop(){
      clearTimeout(timer);
      timer = null;
      pending.clear();
      const previous = channel;
      channel = null;
      userId = "";
      if(previous && sb) void sb.removeChannel(previous);
      setStatus("offline", "Hors ligne");
    }

    function start(nextUserId){
      if(!sb || !nextUserId){
        stop();
        return;
      }
      if(channel && userId === nextUserId) return;
      stop();
      userId = nextUserId;
      setStatus("connecting", "Connexion…");
      let next = sb.channel("confrerie-live-"+nextUserId);
      tables.forEach(table => {
        next = next.on("postgres_changes", {
          event:"*",
          schema:"public",
          table
        }, payload => {
          /* L'écho de sa PROPRE écriture, pendant qu'on peint encore, ferait
             réapparaître un masque plus ancien que la sélection en cours. */
          if(shouldIgnoreAvailabilityEcho(
            payload && payload.new,
            userId,
            Availability.isSaving()
          )) return;
          schedule(table);
        });
      });
      channel = next.subscribe(status => {
        if(channel !== next) return;
        if(status === "SUBSCRIBED") setStatus("online", "À jour");
        if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
          setStatus("offline", "Synchronisation indisponible");
        }
        if(status === "CLOSED") setStatus("offline", "Hors ligne");
      });
    }

    return { start, stop, schedule };
  })();

  /* ============================ Authentification Supabase ============================ */
  const authOverlay = $("#authOverlay");
  const authStatus = $("#authStatus");

  function setAuthStatus(message, isErr){
    authStatus.textContent = message || "";
    authStatus.classList.toggle("err", !!isErr);
  }

  function openAuth(message, isErr){
    setAuthStatus(message, isErr);
    ModalStack.open(authOverlay, "#authEmail", closeAuth);
  }

  function closeAuth(){
    ModalStack.close(authOverlay);
    setAuthStatus("");
  }

  function setAuthBusy(busy){
    ["#authSignIn","#authSignUp","#authOffline"].forEach(selector => {
      $(selector).disabled = !!busy;
    });
  }

  function authMessage(error){
    const message = String(error && error.message || "");
    if(/invalid login credentials/i.test(message)) return "Email ou mot de passe incorrect.";
    if(/already registered/i.test(message)) return "Un compte existe déjà avec cet email.";
    if(/password/i.test(message)) return "Le mot de passe doit contenir au moins 6 caractères.";
    return message || "La connexion au registre a échoué.";
  }

  async function profilePseudo(user){
    if(!user || !sb) return "";
    const { data, error } = await sb.from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .maybeSingle();
    if(error) throw error;
    return data && typeof data.pseudo === "string" ? data.pseudo.trim() : "";
  }

  function updateAccountUi(){
    $("#accountLogin").hidden = !!sessionCourante.user;
    $("#accountConnected").hidden = !sessionCourante.user;
    $("#accountPseudo").textContent = sessionCourante.pseudo || (sessionCourante.user && sessionCourante.user.email) || "";
    /* Bouton à usage unique : il n'apparaît que s'il reste vraiment quelque
       chose à importer depuis CE navigateur. Une fois la migration faite — ou
       s'il n'y a aucune donnée locale — il disparaît au lieu de rester
       désactivé, car il occupait une ligne entière du header mobile. */
    const migrationButton = $("#btnMigrateLocal");
    const migrated = !!sessionCourante.user &&
      localStorage.getItem(MIGRATION_KEY_PREFIX+sessionCourante.user.id) === "1";
    let hasLocalData = false;
    try{
      hasLocalData = LocalTeams.all().length > 0;
    }catch(error){
      hasLocalData = false;
    }
    migrationButton.hidden = !sessionCourante.user || migrated || !hasLocalData;
    migrationButton.disabled = migrated;
    migrationButton.textContent = "Importer mes données locales";
    if(typeof pseudoInput !== "undefined"){
      pseudoInput.disabled = !!sessionCourante.user;
      if(sessionCourante.user && sessionCourante.pseudo){
        draft.pseudo = sessionCourante.pseudo;
        pseudoInput.value = sessionCourante.pseudo;
      }
    }
  }

  async function applySession(session){
    const applicationEpoch = ++sessionCourante.applicationEpoch;
    const expectedUser = session && session.user ? session.user : null;
    const expectedUserId = expectedUser ? expectedUser.id : "";
    const isCurrentApplication = () =>
      applicationEpoch === sessionCourante.applicationEpoch &&
      (sessionCourante.user ? sessionCourante.user.id : "") === expectedUserId;
    const previousUserId = sessionCourante.user ? sessionCourante.user.id : "";
    sessionCourante.user = expectedUser;
    const sessionChanged = previousUserId !== expectedUserId;
    if(sessionChanged){
      ensureBossViewOwner();
      resetBuilderRosterBaselines();
      // Le suivi du compte précédent ne doit jamais rester visible.
      DashboardStore.reset(expectedUserId);
      if($("#view-boss").classList.contains("active")) void renderBossView();
    }
    sessionCourante.pseudo = "";
    sessionCourante.rosterProfiles = [];
    if(sessionCourante.user){
      let loadedPseudo = "";
      try{
        loadedPseudo = await profilePseudo(expectedUser);
      }catch(error){
        if(!isCurrentApplication()) return;
        toast("Profil indisponible : "+authMessage(error), true);
      }
      if(!isCurrentApplication()) return;
      sessionCourante.pseudo = loadedPseudo;
      if(!sessionCourante.pseudo) sessionCourante.pseudo = (sessionCourante.user.email||"membre").split("@")[0];
      closeAuth();
    }else if(sb){
      openAuth();
    }
    if(sessionCourante.user) RealtimeSync.start(sessionCourante.user.id);
    else RealtimeSync.stop();
    updateAccountUi();
    if($("#view-builder").classList.contains("active")) renderBuilder();
    if($("#view-roster").classList.contains("active")) void renderRoster();
    const memberRosterView = $("#view-member-roster");
    if(memberRosterView && memberRosterView.classList.contains("active")
      && typeof renderMemberRoster === "function"){
      void renderMemberRoster();
    }
    if($("#view-analyse").classList.contains("active")) void renderAnalyse();
    /* « Mon suivi » devient la vue par défaut à la résolution initiale d'une
       session et après une connexion réussie, c'est-à-dire au passage
       « aucun compte -> un compte ». Un changement de compte piloté de
       l'extérieur, comme un TOKEN_REFRESHED, ne déplace jamais la navigation :
       il se contente de réafficher le suivi du bon compte s'il est visible. */
    if(sessionChanged && !previousUserId && sessionCourante.user){
      void showView("dashboard");
    }else if($("#view-dashboard").classList.contains("active")){
      void renderDashboardView();
    }
  }

  async function signIn(){
    if(!sb){ openAuth("Connexion indisponible hors ligne.", true); return; }
    const email = ($("#authEmail").value||"").trim();
    const password = $("#authPassword").value||"";
    if(!email || !password){ setAuthStatus("Renseigne ton email et ton mot de passe.", true); return; }
    setAuthBusy(true);
    setAuthStatus("Connexion au registre…");
    try{
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if(error) throw error;
      await applySession(data && data.session);
    }catch(error){
      setAuthStatus(authMessage(error), true);
    }finally{
      setAuthBusy(false);
    }
  }

  async function signUp(){
    if(!sb){ openAuth("Création de compte indisponible hors ligne.", true); return; }
    const email = ($("#authEmail").value||"").trim();
    const password = $("#authPassword").value||"";
    const pseudo = ($("#authSignupPseudo").value||"").trim();
    if(!email || !password || !pseudo){
      setAuthStatus("Renseigne l’email, le mot de passe et le pseudo.", true);
      return;
    }
    setAuthBusy(true);
    setAuthStatus("Création du compte…");
    try{
      const { data, error } = await sb.auth.signUp({ email, password });
      if(error) throw error;
      if(!data || !data.user) throw new Error("Compte non créé.");
      if(!data.session){
        setAuthStatus("Compte créé, mais la session n’est pas ouverte. Désactive « Confirm email » dans Supabase.", true);
        return;
      }
      const profileResult = await sb.from("profiles").upsert({ id:data.user.id, pseudo });
      if(profileResult.error) throw profileResult.error;
      sessionCourante.pseudo = pseudo;
      await applySession(data.session);
      sessionCourante.pseudo = pseudo;
      updateAccountUi();
      toast("Compte créé. Bienvenue "+pseudo+" !");
    }catch(error){
      setAuthStatus(authMessage(error), true);
    }finally{
      setAuthBusy(false);
    }
  }

  async function initAuth(){
    updateAccountUi();
    if(!sb) return;
    sb.auth.onAuthStateChange((event, session) => {
      if(event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED"){
        setTimeout(()=>void applySession(session), 0);
      }
    });
    try{
      const { data, error } = await sb.auth.getSession();
      if(error) throw error;
      await applySession(data && data.session);
    }catch(error){
      openAuth(authMessage(error), true);
    }
  }

  $("#accountLogin").addEventListener("click", ()=>
    openAuth(sb ? "" : "Connexion indisponible hors ligne.", !sb)
  );
  $("#authOffline").addEventListener("click", closeAuth);
  $("#authSignIn").addEventListener("click", ()=>void signIn());
  $("#authSignUp").addEventListener("click", ()=>void signUp());
  $("#authPassword").addEventListener("keydown", event => {
    if(event.key === "Enter") void signIn();
  });
  $("#authLogout").addEventListener("click", async()=>{
    if(!sb) return;
    const { error } = await sb.auth.signOut();
    if(error) toast(authMessage(error), true);
  });


  const AVAIL_CACHE_PREFIX = "confrerie7ds.cloud.availability.";
  const AVAIL_CACHE_VERSION = 1;
  /* Quatre semaines conservées, la courante comprise. */
  const AVAIL_KEEP_WEEKS = 4;
  /* Seuils d'un appui volontaire au doigt. En dessous du seuil de défilement du
     navigateur, aucun `pointercancel` n'est émis : ces bornes distinguent seules
     l'appui franc du doigt simplement posé pour faire défiler. */
  const AVAIL_TAP_MAX_MOVE = 10;   // pixels
  const AVAIL_TAP_MAX_DELAY = 300; // millisecondes

  function availabilityCacheKey(userId, weekStart){
    return AVAIL_CACHE_PREFIX+userId+"."+weekStart;
  }

  function readAvailabilityCache(userId, weekStart){
    if(!userId || !weekStart) return null;
    try{
      const raw = localStorage.getItem(availabilityCacheKey(userId, weekStart));
      if(!raw) return null;
      const envelope = JSON.parse(raw);
      if(
        !envelope ||
        envelope.version !== AVAIL_CACHE_VERSION ||
        envelope.userId !== userId ||
        envelope.weekStart !== weekStart ||
        !Array.isArray(envelope.rows)
      ) return null;
      return envelope.rows;
    }catch(error){
      return null;
    }
  }

  function writeAvailabilityCache(userId, weekStart, rows){
    if(!userId || !weekStart) return;
    try{
      localStorage.setItem(
        availabilityCacheKey(userId, weekStart),
        JSON.stringify({
          version:AVAIL_CACHE_VERSION,
          userId,
          weekStart,
          savedAt:Date.now(),
          rows
        })
      );
    }catch(error){
      // Un quota local indisponible ne doit jamais casser la vue en ligne.
    }
  }

  const Availability = (function(){
    let state = null;

    function cellLabel(day, hour){
      return AVAIL_DAY_FULL[day]+" "+String(hour).padStart(2, "0")+"h";
    }

    function renderGrid(){
      const body = $("#availBody");
      body.innerHTML = "";
      if(state.message){
        const note = document.createElement("p");
        note.className = "avail-note";
        note.textContent = state.message;
        body.appendChild(note);
      }
      const aggregate = state.mode === "guild"
        ? aggregateAvailability(state.rows)
        : null;
      const wrap = document.createElement("div");
      wrap.className = "avail-grid-wrap";
      const grid = document.createElement("div");
      grid.className = "avail-grid";
      grid.id = "availGrid";
      const corner = document.createElement("div");
      corner.className = "avail-corner avail-head";
      grid.appendChild(corner);
      for(let day = 0; day < AVAIL_DAYS; day += 1){
        const head = document.createElement("button");
        head.type = "button";
        head.className = "avail-head";
        head.dataset.day = String(day);
        const date = availabilityDayDate(state.weekStart, day);
        head.textContent = AVAIL_DAY_LABELS[day]+" "+date.getUTCDate();
        head.disabled = !state.canEdit || state.mode === "guild";
        grid.appendChild(head);
      }
      for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
        const gutter = document.createElement("button");
        gutter.type = "button";
        gutter.className = "avail-gutter";
        gutter.dataset.hour = String(hour);
        gutter.textContent = String(hour).padStart(2, "0")+"h";
        gutter.disabled = !state.canEdit || state.mode === "guild";
        grid.appendChild(gutter);
        for(let day = 0; day < AVAIL_DAYS; day += 1){
          const index = availabilitySlotIndex(day, hour);
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "avail-cell";
          cell.dataset.index = String(index);
          cell.dataset.day = String(day);
          cell.dataset.hour = String(hour);
          if(state.mode === "guild"){
            const count = aggregate.counts[index];
            cell.dataset.tier = String(
              availabilityDensityTier(count, aggregate.max)
            );
            cell.textContent = count ? String(count) : "";
            cell.classList.toggle("mine", availabilityMaskHas(state.mask, index));
            cell.setAttribute(
              "aria-label",
              cellLabel(day, hour)+" — "+count+" membre"+(count > 1 ? "s" : "")
            );
          }else{
            const on = availabilityMaskHas(state.mask, index);
            cell.setAttribute("aria-pressed", String(on));
            cell.setAttribute("aria-label", cellLabel(day, hour));
            cell.disabled = !state.canEdit;
          }
          grid.appendChild(cell);
        }
      }
      wrap.appendChild(grid);
      body.appendChild(wrap);
      if(state.mode === "guild"){
        grid.addEventListener("click", event => {
          const cell = event.target.closest(".avail-cell[data-index]");
          if(cell) openSlot(Number(cell.dataset.index));
        });
      }
      bindGrid();
    }

    function render(){
      $("#availWeek").textContent = state ? state.weekLabel : "";
      $("#availModeMine").classList.toggle("active", state.mode === "mine");
      $("#availModeMine").setAttribute(
        "aria-pressed", String(state.mode === "mine")
      );
      $("#availModeGuild").classList.toggle("active", state.mode === "guild");
      $("#availModeGuild").setAttribute(
        "aria-pressed", String(state.mode === "guild")
      );
      renderGrid();
      renderBest();
      syncRangeControls();
      syncCopyButton();
      /* Les commandes de saisie n'ont aucun sens en lecture collective. */
      $("#availRangeForm").hidden = state.mode === "guild";
    }

    function setMode(mode){
      if(!state) return;
      state.mode = mode;
      render();
    }

    async function refresh(){
      const user = sessionCourante.user;
      const weekStart = availabilityWeekStart(new Date());
      let rows = [];
      let online = true;
      if(user && sb){
        const result = await sb.from("member_availability")
          .select("owner,slots,week_start")
          .eq("week_start", weekStart);
        if(result.error){
          online = false;
          rows = readAvailabilityCache(user.id, weekStart) || [];
        }else{
          rows = result.data || [];
          writeAvailabilityCache(user.id, weekStart, rows);
        }
      }
      await loadOwnersWithGroup();
      state = availabilityViewState({
        now:new Date(),
        rows,
        currentUserId:user ? user.id : "",
        mode:state ? state.mode : "mine",
        online
      });
      render();
      return true;
    }

    /* Enregistrement différé : un glissement produit un seul upsert, et le
       drapeau `savePending` sert de garde contre l'écho Realtime de sa propre
       écriture (voir RealtimeSync). */
    let saveTimer = null;
    let savePending = false;
    let anchor = null;
    let lastCell = null;
    let paintFill = true;
    let holdTimer = null;
    let painting = false;
    let touchStart = null;

    function isSaving(){ return savePending; }

    /* Indicateur dédié plutôt que #liveStatus : ce dernier appartient à
       RealtimeSync, qui y écrit l'état de la connexion. Deux écrivains sur le
       même nœud produiraient des messages qui se chassent l'un l'autre. */
    function setSaveStatus(stateName, text){
      const node = $("#availSaveStatus");
      if(!node) return;
      node.dataset.state = stateName;
      node.textContent = text;
    }

    async function saveNow(){
      clearTimeout(saveTimer);
      saveTimer = null;
      if(!state || !state.canEdit || !sessionCourante.user || !sb){
        savePending = false;
        return false;
      }
      setSaveStatus("saving", "Enregistrement…");
      const payload = {
        owner:sessionCourante.user.id,
        week_start:state.weekStart,
        slots:state.mask,
        updated_at:new Date().toISOString()
      };
      const { error } = await sb.from("member_availability")
        .upsert(payload, { onConflict:"owner,week_start" });
      savePending = false;
      if(error){
        setSaveStatus("error", "Non enregistré");
        toast("Dispos non enregistrées : réessaie une fois reconnecté.", true);
        return false;
      }
      const own = state.rows.find(row => row.owner === sessionCourante.user.id);
      if(own) own.slots = state.mask;
      else state.rows.push({ owner:sessionCourante.user.id, slots:state.mask });
      writeAvailabilityCache(sessionCourante.user.id, state.weekStart, state.rows);
      const stamp = new Intl.DateTimeFormat("fr-FR", {
        timeZone:"Europe/Paris", hour:"2-digit", minute:"2-digit"
      }).format(new Date());
      setSaveStatus("saved", "Enregistré à "+stamp);
      /* Purge auto-nettoyante : chaque membre efface SES semaines anciennes,
         ce qui évite une tâche planifiée côté serveur. */
      const owned = await sb.from("member_availability")
        .select("week_start")
        .eq("owner", sessionCourante.user.id);
      if(!owned.error){
        const stale = staleAvailabilityWeeks(
          (owned.data || []).map(row => row.week_start),
          state.weekStart,
          AVAIL_KEEP_WEEKS
        );
        if(stale.length){
          await sb.from("member_availability")
            .delete()
            .eq("owner", sessionCourante.user.id)
            .in("week_start", stale);
        }
      }
      return true;
    }

    function scheduleSave(){
      savePending = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(()=>void saveNow(), 600);
    }

    /* Mise à jour chirurgicale : on ne touche qu'aux attributs des 168 cases
       déjà en place. Reconstruire la grille à chaque bascule faisait perdre la
       position de défilement et le focus, ce qui donnait l'impression que le
       planning se rechargeait à chaque créneau ajouté. */
    function syncCells(){
      const grid = $("#availGrid");
      if(!grid || !state || state.mode !== "mine") return;
      grid.querySelectorAll(".avail-cell").forEach(cell => {
        const index = Number(cell.dataset.index);
        cell.setAttribute(
          "aria-pressed", String(availabilityMaskHas(state.mask, index))
        );
        cell.classList.remove("preview");
      });
    }

    function applyMask(mask){
      if(!state || !state.canEdit || mask === state.mask) return;
      state.mask = mask;
      syncCells();
      syncCopyButton();
      scheduleSave();
    }

    function cellFrom(target){
      if(!target || !target.dataset || target.dataset.index === undefined){
        return null;
      }
      return {
        day:Number(target.dataset.day),
        hour:Number(target.dataset.hour),
        index:Number(target.dataset.index)
      };
    }

    function previewRectangle(cursor){
      if(!anchor) return;
      const grid = $("#availGrid");
      if(!grid) return;
      const preview = paintAvailabilityRectangle(
        state.mask, anchor, cursor, paintFill
      );
      grid.querySelectorAll(".avail-cell").forEach(cell => {
        const index = Number(cell.dataset.index);
        cell.setAttribute("aria-pressed", String(preview[index] === "1"));
        cell.classList.toggle("preview", preview[index] !== state.mask[index]);
      });
    }

    function endPaint(cursor){
      clearTimeout(holdTimer);
      holdTimer = null;
      if(!anchor) return;
      const target = cursor || lastCell || anchor;
      const mask = paintAvailabilityRectangle(
        state.mask, anchor, target, paintFill
      );
      anchor = null;
      lastCell = null;
      painting = false;
      applyMask(mask);
      /* Remet l'affichage sur le masque réel : indispensable quand le geste
         n'a rien changé, applyMask sortant alors sans redessiner. */
      syncCells();
    }

    function abortPaint(){
      clearTimeout(holdTimer);
      holdTimer = null;
      anchor = null;
      lastCell = null;
      painting = false;
      syncCells();
    }

    function bindGrid(){
      const grid = $("#availGrid");
      if(!grid || !state.canEdit || state.mode !== "mine") return;
      grid.addEventListener("pointerdown", event => {
        const cell = cellFrom(event.target);
        if(!cell) return;
        anchor = cell;
        lastCell = cell;
        paintFill = !availabilityMaskHas(state.mask, cell.index);
        touchStart = event.pointerType === "mouse"
          ? null
          : { x:event.clientX, y:event.clientY, at:Date.now(), moved:0 };
        /* Le glissement de peinture est réservé à la souris. Au doigt, le
           navigateur reprend la main dès qu'il décide de faire défiler et émet
           `pointercancel` : une peinture par glissement ne s'engagerait jamais,
           et prétendre le contraire volait le défilement au membre. Sur mobile,
           la saisie de plusieurs créneaux passe par « Ajouter un créneau ». */
        painting = event.pointerType === "mouse";
        if(painting){
          grid.setPointerCapture(event.pointerId);
          event.preventDefault();
        }
      });
      grid.addEventListener("pointermove", event => {
        /* Le déplacement se mesure pendant le geste, jamais au relâchement :
           au doigt, le `pointerup` ne porte pas de position exploitable. */
        if(touchStart){
          touchStart.moved = Math.max(touchStart.moved, Math.hypot(
            event.clientX - touchStart.x, event.clientY - touchStart.y
          ));
        }
        if(!anchor || !painting) return;
        const cell = cellFrom(document.elementFromPoint(
          event.clientX, event.clientY
        ));
        if(cell){
          lastCell = cell;
          previewRectangle(cell);
        }
        event.preventDefault();
      });
      /* La capture du pointeur redirige `pointerup` vers la GRILLE : son
         `event.target` n'est donc plus la case survolée. On repasse par la
         position du curseur, avec la dernière case connue en repli. */
      /* Au doigt, le navigateur n'émet `pointercancel` que s'il a bougé assez
         pour décider de faire défiler. En dessous de son seuil, `pointerup`
         arrive quand même : sans ce filtre, tout doigt posé pour tenter un
         défilement remplissait un créneau. On n'accepte donc qu'un appui à la
         fois BREF et IMMOBILE. */
      grid.addEventListener("pointerup", event => {
        if(!anchor) return;
        if(touchStart){
          const eloigne = touchStart.moved > AVAIL_TAP_MAX_MOVE;
          const trainant = Date.now() - touchStart.at > AVAIL_TAP_MAX_DELAY;
          touchStart = null;
          if(eloigne || trainant){ abortPaint(); return; }
          /* Appui franc : on bascule la case pressée, et elle seule. */
          endPaint(anchor);
          return;
        }
        endPaint(cellFrom(document.elementFromPoint(
          event.clientX, event.clientY
        )));
      });
      grid.addEventListener("pointercancel", ()=>{
        touchStart = null;
        abortPaint();
      });
      grid.addEventListener("click", event => {
        const head = event.target.closest(".avail-head[data-day]");
        if(head){
          applyMask(availabilityToggleDay(state.mask, Number(head.dataset.day)));
          return;
        }
        const gutter = event.target.closest(".avail-gutter[data-hour]");
        if(gutter){
          applyMask(
            availabilityToggleHour(state.mask, Number(gutter.dataset.hour))
          );
        }
      });
      grid.addEventListener("keydown", event => {
        const cell = cellFrom(event.target);
        if(!cell) return;
        let day = cell.day;
        let hour = cell.hour;
        if(event.key === "ArrowRight") day = Math.min(AVAIL_DAYS - 1, day + 1);
        else if(event.key === "ArrowLeft") day = Math.max(0, day - 1);
        else if(event.key === "ArrowDown") hour = Math.min(AVAIL_HOURS - 1, hour + 1);
        else if(event.key === "ArrowUp") hour = Math.max(0, hour - 1);
        else if(event.key === " " || event.key === "Enter"){
          event.preventDefault();
          applyMask(paintAvailabilityRectangle(
            state.mask, cell, cell, !availabilityMaskHas(state.mask, cell.index)
          ));
          const same = $("#availGrid").querySelector(
            '.avail-cell[data-index="'+cell.index+'"]'
          );
          if(same) same.focus();
          return;
        }else return;
        event.preventDefault();
        if(event.shiftKey){
          applyMask(paintAvailabilityRectangle(
            state.mask, cell, { day, hour },
            !availabilityMaskHas(state.mask, cell.index)
          ));
        }
        const next = $("#availGrid").querySelector(
          '.avail-cell[data-index="'+availabilitySlotIndex(day, hour)+'"]'
        );
        if(next) next.focus();
      });
    }

    function fillHourOptions(select, selected){
      select.innerHTML = "";
      for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = String(hour).padStart(2, "0")+"h";
        if(hour === selected) option.selected = true;
        select.appendChild(option);
      }
    }

    function selectedRangeDays(){
      return [...$("#availRangeDays").querySelectorAll("input:checked")]
        .map(input => Number(input.value));
    }

    function syncRangeControls(){
      const start = Number($("#availRangeStart").value);
      const end = Number($("#availRangeEnd").value);
      const days = selectedRangeDays();
      /* Heures égales : la plage serait soit vide soit longue de 24 h selon la
         lecture. On refuse le cas plutôt que d'en inventer une. */
      const usable = !!state && state.canEdit && start !== end && days.length > 0;
      $("#availRangeAdd").disabled = !usable;
      $("#availRangeRemove").disabled = !usable;
      $("#availRangeHint").textContent = start === end
        ? "Choisis deux heures différentes."
        : (end < start ? "Ce créneau se poursuit le lendemain." : "");
    }

    function applyRange(fill){
      if(!state || !state.canEdit) return;
      const start = Number($("#availRangeStart").value);
      const end = Number($("#availRangeEnd").value);
      const result = applyAvailabilityRange(
        state.mask, start, end, selectedRangeDays(), fill
      );
      applyMask(result.mask);
      if(result.clipped){
        toast(
          "La fin de la nuit du dimanche appartient à la semaine suivante : "
          + "elle n'a pas été ajoutée."
        );
      }
    }

    async function copyPreviousWeek(){
      if(!state || !state.canEdit || !sessionCourante.user || !sb) return false;
      const previous = availabilityPreviousWeekStart(state.weekStart);
      const { data, error } = await sb.from("member_availability")
        .select("slots")
        .eq("week_start", previous)
        .eq("owner", sessionCourante.user.id)
        .maybeSingle();
      if(error || !data){
        toast("Aucune dispo trouvée pour la semaine dernière.", true);
        return false;
      }
      applyMask(normalizeAvailabilityMask(data.slots));
      return true;
    }

    let ownersWithGroup = new Set();
    let pseudos = [];

    /* Les pseudos viennent de `profiles`, via le même cache que les vues
       partagées. `profilePseudo()` ne convient pas : elle résout le pseudo du
       compte connecté, pas celui d'un propriétaire quelconque. */
    function pseudoOfOwner(owner){
      const found = pseudos.find(profile => profile.id === owner);
      if(found) return found.pseudo;
      if(sessionCourante.user && owner === sessionCourante.user.id) return sessionCourante.pseudo || "Moi";
      return "Membre";
    }

    /* Les participations disent qui a déjà rejoint un groupe. Elles se lisent
       sur la SEMAINE DE BOSS, qui bascule le lundi à 9h, et non sur la semaine
       ISO de la grille : les deux ne coïncident pas le lundi matin. */
    async function loadOwnersWithGroup(){
      ownersWithGroup = new Set();
      if(!sessionCourante.user || !sb) return;
      pseudos = await refreshRosterProfiles().catch(()=>sessionCourante.rosterProfiles.slice());
      const week = currentBossWeek();
      const sessions = await sb.from("boss_sessions")
        .select("id")
        .eq("week_start", week.startDate);
      if(sessions.error || !sessions.data || !sessions.data.length) return;
      const participation = await sb.from("boss_participation")
        .select("owner,session_id")
        .in("session_id", sessions.data.map(session => session.id));
      if(participation.error) return;
      (participation.data || []).forEach(row => {
        if(row.owner) ownersWithGroup.add(row.owner);
      });
    }

    function renderBest(){
      const node = $("#availBest");
      node.innerHTML = "";
      if(!state || state.mode !== "guild") return;
      const { best } = aggregateAvailability(state.rows);
      if(!best.length){
        node.textContent = "Personne n'a encore posé de dispo cette semaine.";
        return;
      }
      node.appendChild(document.createTextNode("Meilleurs créneaux :"));
      best.forEach(entry => {
        const slot = availabilitySlotFromIndex(entry.index);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost";
        button.textContent = AVAIL_DAY_LABELS[slot.day]
          + " " + String(slot.hour).padStart(2, "0") + "h"
          + " (" + entry.count + ")";
        button.addEventListener("click", ()=>openSlot(entry.index));
        node.appendChild(button);
      });
    }

    function openSlot(index){
      if(!state || state.mode !== "guild") return;
      const slot = availabilitySlotFromIndex(index);
      const members = availabilitySlotMembers(state.rows, index, {
        pseudoOf:pseudoOfOwner,
        currentUserId:sessionCourante.user ? sessionCourante.user.id : "",
        ownersWithGroup
      });
      $("#availSlotTitle").textContent = AVAIL_DAY_FULL[slot.day]
        + " " + String(slot.hour).padStart(2, "0") + "h — "
        + members.length + " membre" + (members.length > 1 ? "s" : "");
      const list = $("#availSlotList");
      list.innerHTML = "";
      if(!members.length){
        const empty = document.createElement("li");
        empty.textContent = "Personne n'est disponible sur ce créneau.";
        list.appendChild(empty);
      }
      members.forEach(member => {
        const row = document.createElement("li");
        row.classList.toggle("me", member.isMe);
        const name = document.createElement("b");
        name.textContent = member.pseudo + (member.isMe ? " (toi)" : "");
        row.appendChild(name);
        if(member.withoutGroup){
          const tag = document.createElement("span");
          tag.className = "avail-slot-tag";
          tag.textContent = "sans groupe";
          row.appendChild(tag);
        }
        list.appendChild(row);
      });
      ModalStack.open($("#availSlotOverlay"), "#availSlotClose", closeSlot);
    }

    function closeSlot(){
      ModalStack.close($("#availSlotOverlay"));
    }

    function syncCopyButton(){
      const button = $("#availCopyPrevious");
      /* Le bouton ne s'affiche que s'il a quelque chose à apporter : une
         semaine encore vierge et une saisie possible. */
      button.hidden = !state || !state.canEdit || state.mask !== AVAIL_EMPTY_MASK;
    }

    return {
      refresh, render, setMode, applyMask, saveNow, isSaving,
      fillHourOptions, syncRangeControls, applyRange, copyPreviousWeek,
      openSlot, closeSlot,
      get state(){ return state; }
    };
  })();

  $("#availSlotClose").addEventListener("click", ()=>Availability.closeSlot());

  $("#availModeMine").addEventListener("click", ()=>Availability.setMode("mine"));
  $("#availModeGuild").addEventListener("click", ()=>Availability.setMode("guild"));

  (function initAvailabilityRange(){
    const days = $("#availRangeDays");
    AVAIL_DAY_LABELS.forEach((label, day) => {
      const wrapper = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(day);
      input.setAttribute("aria-label", AVAIL_DAY_FULL[day]);
      const text = document.createElement("span");
      text.textContent = label;
      wrapper.appendChild(input);
      wrapper.appendChild(text);
      days.appendChild(wrapper);
    });
    Availability.fillHourOptions($("#availRangeStart"), 22);
    Availability.fillHourOptions($("#availRangeEnd"), 2);
    days.addEventListener("change", ()=>Availability.syncRangeControls());
    $("#availRangeStart").addEventListener(
      "change", ()=>Availability.syncRangeControls()
    );
    $("#availRangeEnd").addEventListener(
      "change", ()=>Availability.syncRangeControls()
    );
    $("#availRangeAdd").addEventListener("click", ()=>Availability.applyRange(true));
    $("#availRangeRemove").addEventListener(
      "click", ()=>Availability.applyRange(false)
    );
    $("#availCopyPrevious").addEventListener(
      "click", ()=>void Availability.copyPreviousWeek()
    );
  })();

  function renderAvailabilityView(){
    return Availability.refresh();
  }

  /* ============================ Navigation onglets ============================ */
  const mainTabs = [...document.querySelectorAll(".tab[data-view]")];

  function showView(name){
    mainTabs.forEach(button => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("active", view.id === "view-"+name);
    });
    /* La promesse de rendu est renvoyée pour que les actions de « Mon suivi »
       puissent attendre la vue destination avant de cibler un élément. Les
       écouteurs existants continuent d'ignorer la valeur de retour. */
    let result = Promise.resolve(true);
    if(name==="dashboard") result = renderDashboardView();
    if(name==="builder") renderBuilder();
    if(name==="roster") result = Promise.resolve(renderRoster()).then(()=>true);
    if(name==="member-roster"){
      result = Promise.resolve(renderMemberRoster()).then(()=>true);
    }
    if(name==="analyse") result = Promise.resolve(renderAnalyse()).then(()=>true);
    if(name==="boss") result = renderBossView();
    if(name==="availability") result = renderAvailabilityView();
    const reduced = window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top:0, behavior:reduced ? "auto" : "smooth"});
    return result;
  }
  mainTabs.forEach((button, index) => {
    button.addEventListener("click", ()=>showView(button.dataset.view));
    button.addEventListener("keydown", event => {
      let next = null;
      if(event.key === "ArrowRight") next = (index + 1) % mainTabs.length;
      if(event.key === "ArrowLeft"){
        next = (index - 1 + mainTabs.length) % mainTabs.length;
      }
      if(event.key === "Home") next = 0;
      if(event.key === "End") next = mainTabs.length - 1;
      if(next === null) return;
      event.preventDefault();
      const target = mainTabs[next];
      showView(target.dataset.view);
      target.focus();
    });
  });

  /* ============================ Roster des membres ============================ */
  let memberRosterMode = "mine";
  let memberRosterOwnerId = "";
  let memberRosterRenderId = 0;
  let memberRosterEntries = [];
  let memberRosterVisible = [];
  let memberRosterEditable = false;
  let memberRosterDraft = null;
  let memberRosterDraftSourceUpdatedAt = 0;
  let memberRosterDraftInitialJson = "";
  let memberRosterWeaponType = "";
  const memberRosterFilters = {
    query:"",
    element:"",
    weapon:"",
    role:"",
    rarity:""
  };

  const rosterWeaponLabel = type => type || "Arme";
  const rosterElementLabel = value => {
    const key = String(value || "").toUpperCase();
    return ELEMENTS[key] ? ELEMENTS[key].label : value;
  };
  const rosterRoleLabel = value => WSLOT_ROLES[value] || value;

  function rosterFilterValues(key){
    const values = new Set();
    Object.values(META).forEach(meta => {
      if(!meta) return;
      if(key === "rarity" && meta.rarity) values.add(meta.rarity);
      (meta.weapons || []).forEach(slot => {
        if(key === "element" && slot.element && slot.element !== "Default") values.add(slot.element);
        if(key === "weapon" && slot.weapon) values.add(slot.weapon);
        if(key === "role" && slot.role) values.add(slot.role);
      });
    });
    return [...values].sort((a,b)=>String(a).localeCompare(String(b), "fr"));
  }

  function rosterFilterLabel(key, value){
    if(key === "element") return rosterElementLabel(value);
    if(key === "weapon") return WEAPON_ENUM[value] ? WEAPON_ENUM[value].label : value;
    if(key === "role") return rosterRoleLabel(value);
    return value;
  }

  const MEMBER_ROSTER_FILTER_FIELDS = [
    ["element","Élément","memberRosterFilterElement"],
    ["weapon","Arme","memberRosterFilterWeapon"],
    ["role","Rôle","memberRosterFilterRole"],
    ["rarity","Rareté","memberRosterFilterRarity"]
  ];

  /* Le bouton de réinitialisation n'existe que si un filtre est actif : on
     l'ajoute et le retire seul, sans reconstruire les listes déroulantes, pour
     ne pas voler le focus au clavier juste après un choix. */
  function syncMemberRosterFilterReset(){
    const box = $("#memberRosterFilters");
    const row = box.querySelector(".member-roster-filter-actions");
    const active = MEMBER_ROSTER_FILTER_FIELDS.some(([key]) => memberRosterFilters[key]);
    if(!active){ if(row) row.remove(); return; }
    if(row) return;
    box.appendChild(el("div",{class:"member-roster-filter-actions"},[
      el("button",{
        class:"chip member-roster-filter-reset",
        id:"memberRosterFilterReset",
        type:"button",
        text:"Réinitialiser les filtres",
        onclick:()=>{
          MEMBER_ROSTER_FILTER_FIELDS.forEach(([key,,selectId])=>{
            memberRosterFilters[key] = "";
            const select = box.querySelector("#"+selectId);
            if(select){ select.value = ""; select.classList.remove("on"); }
          });
          syncMemberRosterFilterReset();
          renderMemberRosterCards(memberRosterEntries, memberRosterEditable);
        }
      })
    ]));
  }

  function renderMemberRosterFilterControls(){
    const box = $("#memberRosterFilters");
    box.innerHTML = "";
    const fields = el("div",{class:"member-roster-filter-fields"});
    MEMBER_ROSTER_FILTER_FIELDS.forEach(([key,label,selectId])=>{
      const select = el("select",{
        id:selectId,
        onchange:event=>{
          memberRosterFilters[key] = event.target.value;
          event.target.classList.toggle("on", Boolean(memberRosterFilters[key]));
          syncMemberRosterFilterReset();
          renderMemberRosterCards(memberRosterEntries, memberRosterEditable);
        }
      },[el("option",{value:"",text:"Tous"})]);
      rosterFilterValues(key).forEach(value => {
        select.appendChild(el("option",{ value, text:rosterFilterLabel(key, value) }));
      });
      select.value = memberRosterFilters[key] || "";
      if(memberRosterFilters[key]) select.classList.add("on");
      fields.appendChild(el("label",{class:"member-roster-filter-field",for:selectId},[
        el("span",{text:label}),
        select
      ]));
    });
    box.appendChild(fields);
    syncMemberRosterFilterReset();
  }

  function renderMemberRosterControls(profiles, ownerId){
    const mine = memberRosterMode === "mine";
    const mineButton = $("#memberRosterMine");
    const othersButton = $("#memberRosterOthers");
    mineButton.classList.toggle("btn-primary", mine);
    othersButton.classList.toggle("btn-primary", !mine);
    mineButton.setAttribute("aria-pressed", String(mine));
    othersButton.setAttribute("aria-pressed", String(!mine));
    $(".member-roster-owner-field").hidden = mine;
    $("#memberRosterAdd").hidden = !mine;

    const ownerSelect = $("#memberRosterOwner");
    ownerSelect.innerHTML = "";
    const others = (profiles || []).filter(profile => !sessionCourante.user || profile.id !== sessionCourante.user.id);
    if(!others.length){
      ownerSelect.appendChild(el("option",{value:"",text:"Aucun autre membre"}));
      ownerSelect.disabled = true;
    }else{
      ownerSelect.disabled = false;
      others.forEach(profile => ownerSelect.appendChild(el("option",{
        value:profile.id,
        text:profile.pseudo
      })));
    }
    ownerSelect.value = mine ? "" : ownerId;
    renderMemberRosterFilterControls();
  }

  function memberRosterMatches(entry){
    const character = charOf(entry.charId);
    if(!character) return false;
    if(memberRosterFilters.query && !norm(character.name).includes(norm(memberRosterFilters.query))){
      return false;
    }
    const meta = metaOf(entry.charId) || {};
    const weapons = meta.weapons || [];
    if(memberRosterFilters.element
      && !weapons.some(slot => slot.element === memberRosterFilters.element)) return false;
    if(memberRosterFilters.weapon
      && !weapons.some(slot => slot.weapon === memberRosterFilters.weapon)) return false;
    if(memberRosterFilters.role
      && !weapons.some(slot => slot.role === memberRosterFilters.role)) return false;
    if(memberRosterFilters.rarity && meta.rarity !== memberRosterFilters.rarity) return false;
    return true;
  }

  function memberRosterCard(entry, editable, openDetail){
    const character = charOf(entry.charId);
    const buildTypes = new Set(Object.keys(entry.builds || {}));
    const favoriteType = favoriteRosterWeaponType(entry);
    const firstType = favoriteType || [...buildTypes][0];
    const hero = firstType
      ? rosterHeroSnapshot(entry, firstType)
      : normalizeHero({char:entry.charId, potentiel:{tier:entry.potentialTier}});
    const summary = el("div",{class:"member-roster-summary"},[
      el("h2",{class:"member-roster-name",text:character.name}),
      el("span",{class:"member-roster-potential",text:"P"+entry.potentialTier})
    ]);
    const badges = badgesRow(character, hero, false);
    if(badges) summary.appendChild(badges);

    const card = el("article",{class:"member-roster-card"},[
      el("div",{class:"member-roster-card-head"},[
        el("div",{class:"member-roster-portrait"},[
          el("img",{src:character.file,alt:character.name,loading:"lazy"})
        ]),
        summary
      ])
    ]);
    const builds = el("div",{class:"member-roster-builds"});
    weaponTypesOf(entry.charId).forEach(type => {
      const isSaved = buildTypes.has(type);
      const isFavorite = isSaved && type === favoriteType;
      builds.appendChild(el("span",{
        class:"member-roster-build-tag"
          +(isSaved ? " saved" : "")
          +(isFavorite ? " favorite" : ""),
        text:rosterWeaponLabel(type)
          +(isFavorite ? " · ★ favori" : (isSaved ? " · configuré" : "")),
        "aria-label":rosterWeaponLabel(type)+" : "
          +(isFavorite ? "build favori" : (isSaved ? "build configuré" : "aucun build"))
      }));
    });
    card.appendChild(builds);
    if(editable){
      card.appendChild(el("div",{class:"member-roster-card-actions"},[
        el("button",{
          class:"btn member-roster-edit",
          type:"button",
          text:"Modifier",
          onclick:()=>openMemberRosterEditor(entry)
        }),
        el("button",{
          class:"btn btn-danger member-roster-delete",
          type:"button",
          text:"Retirer",
          onclick:()=>void deleteMemberRosterCharacter(entry)
        })
      ]));
    }
    /* Roster consulté : la fiche entière ouvre le détail, et le bouton donne
       le même accès au clavier. */
    if(openDetail){
      card.classList.add("clickable");
      card.addEventListener("click", openDetail);
      card.appendChild(el("button",{
        class:"btn member-roster-detail-btn",
        type:"button",
        text:"Voir les builds",
        onclick:event=>{ event.stopPropagation(); openDetail(); }
      }));
    }
    return card;
  }

  function renderMemberRosterCards(entries, editable){
    memberRosterEntries = (entries || []).map(normalizeRosterCharacter).filter(Boolean);
    memberRosterEditable = !!editable;
    memberRosterVisible = memberRosterEntries
      .filter(memberRosterMatches)
      .sort((a,b)=>{
        const left = charOf(a.charId);
        const right = charOf(b.charId);
        return left.name.localeCompare(right.name, "fr");
      });
    const filtered = memberRosterVisible;
    const count = $("#memberRosterCount");
    count.innerHTML = "<b>"+filtered.length+"</b> personnage"
      +(filtered.length > 1 ? "s" : "")
      +(filtered.length !== memberRosterEntries.length
        ? " sur "+memberRosterEntries.length
        : "");
    const grid = $("#memberRosterGrid");
    grid.innerHTML = "";
    if(!filtered.length){
      grid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:memberRosterEntries.length
          ? "Aucun personnage ne correspond aux filtres"
          : (editable ? "Ton roster est vide" : "Ce membre n’a encore aucun personnage")}),
        el("p",{text:editable && !memberRosterEntries.length
          ? "Ajoute ton premier personnage pour enregistrer son potentiel et ses équipements."
          : "Modifie les filtres pour afficher d’autres personnages."})
      ]));
      return;
    }
    filtered.forEach((entry, index) => grid.appendChild(memberRosterCard(
      entry,
      editable,
      editable ? null : ()=>openRosterDetail(index)
    )));
  }

  /* ---- Modal détail d'un personnage consulté chez un autre membre ----
     La modale garde sa propre copie de la liste affichée : une synchronisation
     Realtime pendant la consultation ne déplace pas le personnage sous les
     yeux du lecteur. */
  /* `weaponTypes` restreint le sélecteur d'arme à ces enums (null = tout
     proposer, comportement historique). `showNavigation` masque les flèches
     précédent/suivant quand l'appelant n'a qu'une seule entrée (l'Analyse).
     `returnFocusKey` est réservé aux futurs appelants qui reconstruisent leur
     liste pendant que la modale reste ouverte : personne ne le consomme
     encore ici, mais le champ doit survivre au passage. */
  const rosterDetail = {
    entries:[], index:0, type:null, owner:"",
    weaponTypes:null, showNavigation:true, returnFocusKey:null
  };

  function rosterDetailOwnerLabel(){
    const select = $("#memberRosterOwner");
    const option = select && select.selectedOptions && select.selectedOptions[0];
    return option ? option.textContent : "";
  }

  function rosterDetailWeaponSwitch(entry){
    const meta = metaOf(entry.charId);
    const slots = (meta && meta.weapons) || [];
    const allowed = rosterDetail.weaponTypes;
    /* L'Analyse ne propose qu'un sous-ensemble d'armes DPS (des enums) : on
       filtre AVANT de construire les badges. Sans filtre, comportement
       historique inchangé. */
    const types = allowed
      ? weaponTypesOf(entry.charId).filter(type => allowed.includes(FOLDER_TO_ENUM[type]))
      : weaponTypesOf(entry.charId);
    /* Un sélecteur à un seul choix n'en est plus un : le masquer plutôt que
       proposer un bouton qui ne fait rien. Le comportement historique (filtre
       absent) n'est pas concerné : il peut légitimement n'afficher qu'une
       arme. */
    if(allowed && types.length <= 1) return null;
    const row = el("div",{class:"roster-detail-weapons"});
    types.forEach(type => {
      const enumName = FOLDER_TO_ENUM[type];
      const slot = slots.find(item => item.weapon === enumName)
        || { weapon:enumName, element:"", role:"" };
      const badge = weaponSlotBadge(slot, false);
      if(!badge) return;
      const saved = Object.prototype.hasOwnProperty.call(entry.builds || {}, type);
      const props = {
        class:"roster-detail-weapon",
        type:"button",
        dataset:{ weaponType:type },
        "aria-pressed":String(saved && type === rosterDetail.type),
        title:rosterWeaponLabel(type)
          +(saved ? "" : " · aucun build enregistré")
      };
      if(saved) props.onclick = ()=>{ rosterDetail.type = type; renderRosterDetail(); };
      else props.disabled = "disabled";
      row.appendChild(el("button",props,[badge]));
    });
    return row;
  }

  function renderRosterDetail(){
    const entry = rosterDetail.entries[rosterDetail.index];
    const body = $("#rosterDetailBody");
    body.innerHTML = "";
    if(!entry) return;
    const character = charOf(entry.charId);
    const types = Object.keys(entry.builds || {});
    if(!rosterDetail.type || !types.includes(rosterDetail.type)){
      rosterDetail.type = favoriteRosterWeaponType(entry) || types[0] || null;
    }
    $("#rosterDetailTitle").textContent = rosterDetail.owner
      ? character.name + " — " + rosterDetail.owner
      : character.name;
    $("#rosterDetailPosition").textContent =
      (rosterDetail.index + 1) + " / " + rosterDetail.entries.length;
    const prev = $("#rosterDetailPrev");
    const next = $("#rosterDetailNext");
    /* Prev/next et le compteur de position partagent un même conteneur : sans
       rien à parcourir (l'Analyse n'a qu'une entrée), on masque tout le bloc
       plutôt que de laisser des flèches inertes visibles — une promesse non
       tenue. */
    const nav = prev.parentElement;
    if(nav) nav.hidden = !rosterDetail.showNavigation;
    /* Le navigateur retire le focus d'un bouton dès qu'il devient `disabled` :
       on note qui l'avait AVANT de désactiver, puis on le rend au contrôle
       encore utilisable plutôt que de le perdre sur le body. */
    const active = document.activeElement;
    prev.disabled = rosterDetail.index <= 0;
    next.disabled = rosterDetail.index >= rosterDetail.entries.length - 1;
    if((active === prev || active === next) && active.disabled){
      const fallback = active === prev ? next : prev;
      (fallback.disabled ? $("#rosterDetailClose") : fallback).focus();
    }
    const hero = rosterDetail.type
      ? rosterHeroSnapshot(entry, rosterDetail.type)
      : normalizeHero({ char:entry.charId, potentiel:{tier:entry.potentialTier} });
    body.appendChild(heroDetail(hero, {
      badgesFor:()=>rosterDetailWeaponSwitch(entry)
    }));
    if(!types.length){
      body.appendChild(el("p",{
        class:"roster-detail-hint",
        text:"Ce membre n’a enregistré aucun build pour ce personnage."
      }));
    }
  }

  /* Point d'entrée explicite : le Roster indexe sur sa propre liste affichée,
     mais l'Analyse (une seule fiche, aucune liste) n'a pas cet index. Les deux
     passent désormais par le même contexte plutôt que par un second chemin
     parallèle dans la modale. */
  function openRosterDetailFor(context){
    if(!context || !Array.isArray(context.entries) || !context.entries.length){
      return;
    }
    /* Capturé avant tout rendu : `renderRosterDetail()` ne déplace pas le
       focus sur un premier affichage, mais le rendre explicite ici évite de
       dépendre implicitement de l'ordre d'exécution pour la restitution. */
    const trigger = document.activeElement;
    rosterDetail.entries = context.entries;
    rosterDetail.index = Math.min(
      Math.max(context.index || 0, 0), context.entries.length - 1
    );
    /* `rosterDetail.type` est une clé de DOSSIER : c'est ce que
       `rosterHeroSnapshot(entry, type)` attend. Le contexte parle en enums.
       La conversion est obligatoire ; l'oublier ouvre un build introuvable. */
    rosterDetail.type = context.weaponType
      ? (ENUM_TO_FOLDER[context.weaponType] || null)
      : null;
    rosterDetail.owner = context.memberName || rosterDetailOwnerLabel();
    rosterDetail.weaponTypes = context.weaponTypes || null;
    rosterDetail.showNavigation = context.showNavigation !== false;
    rosterDetail.returnFocusKey = context.returnFocusKey || null;
    renderRosterDetail();
    ModalStack.open(
      $("#rosterDetailOverlay"), "#rosterDetailClose", closeRosterDetail, trigger
    );
  }

  function openRosterDetail(index){
    if(!memberRosterVisible.length) return;
    openRosterDetailFor({
      entries:memberRosterVisible,
      index,
      memberName:rosterDetailOwnerLabel(),
      weaponTypes:null,
      weaponType:null,
      showNavigation:true,
      returnFocusKey:null
    });
  }

  function moveRosterDetail(step){
    const next = rosterDetail.index + step;
    if(next < 0 || next >= rosterDetail.entries.length) return;
    rosterDetail.index = next;
    rosterDetail.type = null;
    renderRosterDetail();
  }

  function closeRosterDetail(){
    ModalStack.close($("#rosterDetailOverlay"));
  }

  $("#rosterDetailClose").addEventListener("click", closeRosterDetail);
  $("#rosterDetailPrev").addEventListener("click", ()=>moveRosterDetail(-1));
  $("#rosterDetailNext").addEventListener("click", ()=>moveRosterDetail(1));
  $("#rosterDetailOverlay").addEventListener("click", event => {
    if(event.target === $("#rosterDetailOverlay")) closeRosterDetail();
  });
  $("#rosterDetailOverlay").addEventListener("keydown", event => {
    if(event.key === "ArrowLeft"){ event.preventDefault(); moveRosterDetail(-1); }
    else if(event.key === "ArrowRight"){ event.preventDefault(); moveRosterDetail(1); }
  });

  async function renderMemberRoster(){
    const renderId = ++memberRosterRenderId;
    const grid = $("#memberRosterGrid");
    grid.innerHTML = "";
    if(!sessionCourante.user){
      grid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour consulter le roster."}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return;
    }
    grid.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Ouverture du registre…"})
    ]));
    let ownerId = memberRosterMode === "mine"
      ? sessionCourante.user.id
      : memberRosterOwnerId;
    try{
      const profiles = await refreshRosterProfiles();
      if(memberRosterMode === "others" && !ownerId){
        const other = profiles.find(profile => profile.id !== sessionCourante.user.id);
        ownerId = other ? other.id : "";
        memberRosterOwnerId = ownerId;
      }
      const entries = ownerId ? await MemberRosterStore.refresh(ownerId) : [];
      if(renderId !== memberRosterRenderId) return;
      renderMemberRosterControls(profiles, ownerId);
      renderMemberRosterCards(entries, ownerId === sessionCourante.user.id);
    }catch(error){
      if(renderId !== memberRosterRenderId) return;
      renderMemberRosterControls(sessionCourante.rosterProfiles, ownerId);
      renderMemberRosterCards(MemberRosterStore.all(ownerId), ownerId === sessionCourante.user.id);
      toast("Roster indisponible, affichage du cache local.", true);
    }
  }

  function setMemberRosterBuildValue(kind, slot, value){
    const type = memberRosterWeaponType;
    const build = memberRosterDraft.builds[type]
      || (memberRosterDraft.builds[type] = emptyRosterBuild());
    if(kind === "weapon") memberRosterDraft.builds[type] = applyWeaponChange(build, value);
    if(kind === "armor" || kind === "jewel"){
      applyGearChange(build, kind, slot, value);
    }
    renderMemberRosterEditor();
  }

  function pickMemberRosterWeapon(){
    const charId = memberRosterDraft.charId;
    const build = memberRosterDraft.builds[memberRosterWeaponType] || emptyRosterBuild();
    const items = Object.values(compatibleWeaponGroups(charId)).flat()
      .filter(item => weaponFolderOf(item.file) === memberRosterWeaponType)
      .map(item => ({value:item.file,name:item.name,file:item.file}));
    Picker.open({
      title:"Arme — "+memberRosterWeaponType,
      value:build.weapon,
      items,
      emptyHint:"Aucune arme compatible disponible.",
      onSelect:value=>{
        if(value !== build.weapon && build.weaponConfig !== null
          && !confirm(
            "Changer d’arme effacera sa configuration chiffrée. Continuer ?"
          )){
          return;
        }
        setMemberRosterBuildValue("weapon", null, value);
      }
    });
  }

  /* Un clic équipe les 4 emplacements universels d'un set. L'armure liée n'est
     jamais touchée : elle dépend du personnage, pas du set. */
  function openEquipmentSetPicker(config){
    const sets = config.sets;
    if(!sets.length){
      toast("Aucun set complet dans les données actuelles.", true);
      return;
    }
    Picker.open({
      title:config.title,
      allowNone:false,
      items:sets.map(set => ({
        value:set.name,
        name:set.name,
        file:set.pieces[config.thumbSlot]
      })),
      emptyHint:"Aucun set complet disponible.",
      onSelect:value => {
        const chosen = sets.find(set => set.name === value);
        if(chosen) config.onApply(chosen);
      }
    });
  }

  function equipmentSetButton(kind, onApply){
    const armor = kind === "armor";
    return el("button",{
      class:"btn btn-ghost gear-set",
      type:"button",
      dataset:{ gearAction:armor ? "armor-set" : "jewel-set" },
      text:armor ? "Équiper un set d’armure" : "Équiper un set de bijoux",
      onclick:()=>openEquipmentSetPicker({
        title:armor ? "Équiper un set d’armure" : "Équiper un set de bijoux",
        sets:armor ? armorSetsFrom(DATA.armures) : jewelSetsFrom(DATA.bijoux),
        thumbSlot:armor ? ARMOR_SET_SLOTS[0] : JEWEL_SLOTS[0],
        onApply
      })
    });
  }

  function currentMemberRosterBuild(){
    const type = memberRosterWeaponType;
    return memberRosterDraft.builds[type]
      || (memberRosterDraft.builds[type] = emptyRosterBuild());
  }

  function applyMemberRosterArmorSet(set){
    const build = currentMemberRosterBuild();
    ARMOR_SET_SLOTS.forEach(slot => {
      applyGearChange(build, "armor", slot, set.pieces[slot]);
    });
    renderMemberRosterEditor();
    toast("Set « "+set.name+" » équipé.");
  }

  function applyMemberRosterJewelSet(set){
    const build = currentMemberRosterBuild();
    JEWEL_SLOTS.forEach(slot => {
      applyGearChange(build, "jewel", slot, set.pieces[slot]);
    });
    renderMemberRosterEditor();
    toast("Bijoux « "+set.name+" » équipés.");
  }

  function pickMemberRosterArmor(slot){
    const charId = memberRosterDraft.charId;
    const build = memberRosterDraft.builds[memberRosterWeaponType] || emptyRosterBuild();
    const allowed = slot === LINKED_ARMOR_SLOT ? new Set(linkedArmorsOf(charId)) : null;
    const items = (DATA.armures[slot] || [])
      .filter(item => !allowed || allowed.has(item.file))
      .map(item => ({value:item.file,name:item.name,file:item.file}));
    Picker.open({
      title:"Armure — "+ARMOR_LABELS[slot],
      value:build.armor[slot],
      items,
      emptyHint:slot === LINKED_ARMOR_SLOT
        ? "Aucune armure liée compatible disponible."
        : "Aucune armure disponible.",
      onSelect:value=>setMemberRosterBuildValue("armor", slot, value)
    });
  }

  function pickMemberRosterJewel(slot){
    const build = memberRosterDraft.builds[memberRosterWeaponType] || emptyRosterBuild();
    Picker.open({
      title:"Bijou — "+slot,
      value:build.jewel[slot],
      items:(DATA.bijoux[slot] || [])
        .map(item => ({value:item.file,name:item.name,file:item.file})),
      emptyHint:"Aucun bijou disponible.",
      onSelect:value=>setMemberRosterBuildValue("jewel", slot, value)
    });
  }

  function renderMemberRosterEditor(){
    if(!memberRosterDraft) return;
    const character = charOf(memberRosterDraft.charId);
    const types = weaponTypesOf(memberRosterDraft.charId);
    if(!types.includes(memberRosterWeaponType)) memberRosterWeaponType = types[0] || "";
    const hasBuild = Object.prototype.hasOwnProperty.call(
      memberRosterDraft.builds,
      memberRosterWeaponType
    );
    const build = hasBuild
      ? memberRosterDraft.builds[memberRosterWeaponType]
      : emptyRosterBuild();
    const favoriteType = favoriteRosterWeaponType(memberRosterDraft);
    $("#memberRosterTitle").textContent = character.name+" — roster";
    const editor = $("#memberRosterEditor");
    editor.innerHTML = "";
    editor.appendChild(el("div",{class:"member-roster-editor-hero"},[
      el("div",{class:"member-roster-portrait"},[
        el("img",{src:character.file,alt:character.name})
      ]),
      el("div",{},[
        el("span",{class:"member-roster-field-label",text:"Personnage"}),
        el("h2",{text:character.name})
      ])
    ]));

    const potentialList = el("div",{class:"member-roster-potential-list"});
    for(let tier = 0; tier <= POT_MAX; tier++){
      potentialList.appendChild(el("button",{
        class:"chip"+(memberRosterDraft.potentialTier === tier ? " active" : ""),
        type:"button",
        text:"P"+tier,
        "aria-pressed":String(memberRosterDraft.potentialTier === tier),
        onclick:()=>{
          memberRosterDraft.potentialTier = tier;
          renderMemberRosterEditor();
        }
      }));
    }
    editor.appendChild(el("div",{class:"member-roster-editor-section"},[
      el("span",{class:"member-roster-field-label",text:"Potentiel commun"}),
      potentialList
    ]));

    const tabs = el("div",{class:"member-roster-weapon-tabs"});
    types.forEach(type => tabs.appendChild(el("button",{
      class:"chip"+(memberRosterWeaponType === type ? " active" : ""),
      type:"button",
      text:rosterWeaponLabel(type)
        +(Object.prototype.hasOwnProperty.call(memberRosterDraft.builds, type) ? " ✓" : "")
        +(memberRosterDraft.builds[type] && memberRosterDraft.builds[type].favorite ? " ★" : ""),
      "aria-pressed":String(memberRosterWeaponType === type),
      onclick:()=>{
        memberRosterWeaponType = type;
        renderMemberRosterEditor();
      }
    })));
    editor.appendChild(el("div",{class:"member-roster-editor-section"},[
      el("span",{class:"member-roster-field-label",text:"Configuration par type d’arme"}),
      tabs
    ]));

    const gear = el("div",{class:"gear"});
    gear.appendChild(gearSlot("Arme", build.weapon, true, pickMemberRosterWeapon));
    const configControl = weaponConfigControl({
      weaponFile:build.weapon,
      config:build.weaponConfig,
      sourceUpdatedAt:memberRosterDraftSourceUpdatedAt,
      parentIsDirty(){
        return !!memberRosterDraft
          && JSON.stringify(memberRosterDraft) !== memberRosterDraftInitialJson;
      },
      sourceWasDeleted(){
        if(!sessionCourante.user || !memberRosterDraft
          || memberRosterDraftSourceUpdatedAt <= 0) return false;
        return !MemberRosterStore.all(sessionCourante.user.id)
          .some(row => row.charId === memberRosterDraft.charId);
      },
      defaultGradeGameId:weaponDefaultGradeGameId(build.weapon),
      commit(nextConfig){
        currentMemberRosterBuild().weaponConfig = nextConfig;
        renderMemberRosterEditor();
        const nextButton = $("#memberRosterEditor")
          .querySelector(".weapon-config-open");
        if(nextButton){
          ModalStack.setRestoreFocus($("#weaponConfigOverlay"), nextButton);
        }
      },
      latestUpdatedAt(){
        if(!sessionCourante.user || !memberRosterDraft) return 0;
        const latest = MemberRosterStore.all(sessionCourante.user.id)
          .find(row => row.charId === memberRosterDraft.charId);
        return latest ? latest.updatedAt : memberRosterDraftSourceUpdatedAt;
      },
      reload(){ return reloadCurrentRosterDraft(); }
    });
    if(configControl) gear.appendChild(configControl);
    gear.appendChild(el("div",{class:"gear-group",text:"Armures"}));
    gear.appendChild(equipmentSetButton("armor", applyMemberRosterArmorSet));
    ARMOR_SLOTS.forEach(slot => gear.appendChild(gearConfigurableSlot(
      ARMOR_LABELS[slot],
      build.armor[slot],
      ()=>pickMemberRosterArmor(slot),
      "",
      slot,
      {
        config:build.armorConfig && build.armorConfig[slot],
        commit(nextConfig){
          const target = currentMemberRosterBuild();
          if(!target.armorConfig) target.armorConfig = {};
          if(nextConfig === null) delete target.armorConfig[slot];
          else target.armorConfig[slot] = nextConfig;
          renderMemberRosterEditor();
          const nextButton = findGearConfigButton($("#memberRosterEditor"), slot);
          if(nextButton){
            ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
          }
        }
      }
    )));
    gear.appendChild(el("div",{class:"gear-group",text:"Bijoux"}));
    gear.appendChild(equipmentSetButton("jewel", applyMemberRosterJewelSet));
    JEWEL_SLOTS.forEach(slot => gear.appendChild(gearConfigurableSlot(
      JEWEL_LABELS[slot],
      build.jewel[slot],
      ()=>pickMemberRosterJewel(slot),
      "jewel",
      slot,
      {
        config:build.jewelConfig && build.jewelConfig[slot],
        commit(nextConfig){
          const target = currentMemberRosterBuild();
          if(!target.jewelConfig) target.jewelConfig = {};
          if(nextConfig === null) delete target.jewelConfig[slot];
          else target.jewelConfig[slot] = nextConfig;
          renderMemberRosterEditor();
          const nextButton = findGearConfigButton($("#memberRosterEditor"), slot);
          if(nextButton){
            ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
          }
        }
      }
    )));
    const noteColumn = el("div",{class:"member-roster-note-column"});
    if(!hasBuild){
      noteColumn.appendChild(el("p",{
        class:"member-roster-build-empty",
        text:"Cette configuration n’est pas encore enregistrée. Choisis un équipement ou saisis une note pour la créer."
      }));
    }
    const note = el("textarea",{
      class:"note member-roster-note",
      placeholder:"Rôle, rotation ou consigne pour ce type d’arme…",
      maxlength:"160"
    });
    note.value = build.note || "";
    note.addEventListener("input", event => {
      const saved = memberRosterDraft.builds[memberRosterWeaponType]
        || (memberRosterDraft.builds[memberRosterWeaponType] = emptyRosterBuild());
      saved.note = event.target.value;
    });
    noteColumn.appendChild(el("span",{class:"member-roster-field-label",text:"Note du build"}));
    noteColumn.appendChild(note);
    if(hasBuild){
      noteColumn.appendChild(el("button",{
        class:"btn member-roster-favorite",
        type:"button",
        "aria-pressed":String(build.favorite),
        text:build.favorite ? "★ Build favori" : "☆ Définir comme favori",
        onclick:()=>{
          memberRosterDraft = setFavoriteRosterBuild(
            memberRosterDraft,
            memberRosterWeaponType
          );
          renderMemberRosterEditor();
        }
      }));
    }
    if(favoriteType && favoriteType !== memberRosterWeaponType){
      noteColumn.appendChild(el("button",{
        class:"btn member-roster-copy-favorite",
        type:"button",
        text:"Copier le favori ici",
        onclick:()=>{
          if(hasBuild && !confirm(
            "Remplacer les armures, bijoux et la note de ce build ? "+
            "Son arme sera conservée."
          )) return;
          const copied = copyFavoriteRosterBuild(
            memberRosterDraft,
            memberRosterWeaponType
          );
          if(copied) memberRosterDraft = copied;
          renderMemberRosterEditor();
        }
      }));
    }
    if(hasBuild){
      noteColumn.appendChild(el("button",{
        class:"btn btn-danger",
        type:"button",
        text:"Retirer cette configuration",
        onclick:()=>{
          delete memberRosterDraft.builds[memberRosterWeaponType];
          renderMemberRosterEditor();
        }
      }));
    }
    editor.appendChild(el("div",{class:"member-roster-build-panel"},[
      gear,
      noteColumn
    ]));
    editor.appendChild(heroStatsSection(
      rosterHeroSnapshot(memberRosterDraft, memberRosterWeaponType)
    ));
    editor.appendChild(el("div",{class:"member-roster-editor-actions"},[
      el("button",{
        class:"btn",
        type:"button",
        text:"Annuler",
        onclick:closeMemberRosterEditor
      }),
      el("button",{
        class:"btn btn-primary",
        id:"memberRosterSave",
        type:"button",
        text:"Enregistrer le personnage",
        onclick:()=>void saveMemberRosterEditor()
      })
    ]));
  }

  function openMemberRosterEditor(entry, restoreFocus){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized) return;
    memberRosterDraft = JSON.parse(JSON.stringify(normalized));
    memberRosterDraftSourceUpdatedAt = normalized.updatedAt;
    memberRosterDraftInitialJson = JSON.stringify(memberRosterDraft);
    memberRosterWeaponType = favoriteRosterWeaponType(normalized)
      || weaponTypesOf(normalized.charId)[0]
      || "";
    renderMemberRosterEditor();
    ModalStack.open(
      $("#memberRosterOverlay"),
      "#memberRosterClose",
      closeMemberRosterEditor,
      restoreFocus
    );
  }

  function closeMemberRosterEditor(){
    ModalStack.close($("#memberRosterOverlay"));
    memberRosterDraft = null;
    memberRosterDraftSourceUpdatedAt = 0;
    memberRosterDraftInitialJson = "";
  }

  function closeDeletedMemberRosterDraft(){
    closeWeaponConfigEditor();
    closeMemberRosterEditor();
    void renderMemberRoster();
    toast("Ce personnage a été supprimé du roster.", true);
  }

  async function reloadCurrentRosterDraft(){
    if(!sessionCourante.user || !memberRosterDraft) return false;
    const charId = memberRosterDraft.charId;
    try{
      const rows = await MemberRosterStore.refresh(sessionCourante.user.id);
      const latest = rows.find(row => row.charId === charId);
      if(!latest){
        closeDeletedMemberRosterDraft();
        return true;
      }
      memberRosterDraft = JSON.parse(JSON.stringify(
        normalizeRosterCharacter(latest)
      ));
      memberRosterDraftSourceUpdatedAt = memberRosterDraft.updatedAt;
      memberRosterDraftInitialJson = JSON.stringify(memberRosterDraft);
      renderMemberRosterEditor();
      return true;
    }catch(error){
      toast("Impossible de recharger la version récente du roster.", true);
      return false;
    }
  }

  async function saveMemberRosterEditor(){
    if(!memberRosterDraft) return;
    const button = $("#memberRosterSave");
    button.disabled = true;
    try{
      const latest = sessionCourante.user && MemberRosterStore.all(sessionCourante.user.id)
        .find(row => row.charId === memberRosterDraft.charId);
      if(memberRosterDraftSourceUpdatedAt > 0 && !latest){
        closeDeletedMemberRosterDraft();
        return;
      }
      const latestUpdatedAt = Number(latest && latest.updatedAt) || 0;
      if(latestUpdatedAt > memberRosterDraftSourceUpdatedAt && !confirm(
        "Une version plus récente existe. Enregistrer quand même ?"
      )){
        button.disabled = false;
        button.focus();
        return;
      }
      const saved = await MemberRosterStore.upsert(memberRosterDraft);
      memberRosterDraftSourceUpdatedAt = saved.updatedAt;
      closeMemberRosterEditor();
      await renderMemberRoster();
      toast("Personnage enregistré dans ton roster.");
    }catch(error){
      button.disabled = false;
      toast("Roster non enregistré : "+authMessage(error), true);
    }
  }

  async function deleteMemberRosterCharacter(entry){
    if(!sessionCourante.user || sessionCourante.user.id !== entry.owner) return;
    const character = charOf(entry.charId);
    if(!confirm("Retirer "+character.name+" de ton roster ?")) return;
    try{
      await MemberRosterStore.remove(entry.charId);
      await renderMemberRoster();
      toast(character.name+" a été retiré du roster.");
    }catch(error){
      toast("Suppression impossible : "+authMessage(error), true);
    }
  }

  $("#memberRosterMine").addEventListener("click", ()=>{
    memberRosterMode = "mine";
    void renderMemberRoster();
  });
  $("#memberRosterOthers").addEventListener("click", ()=>{
    memberRosterMode = "others";
    memberRosterOwnerId = "";
    void renderMemberRoster();
  });
  $("#memberRosterOwner").addEventListener("change", event => {
    memberRosterOwnerId = event.target.value;
    void renderMemberRoster();
  });
  $("#memberRosterSearch").addEventListener("input", event => {
    memberRosterFilters.query = event.target.value;
    renderMemberRosterCards(memberRosterEntries, memberRosterEditable);
  });
  $("#memberRosterAdd").addEventListener("click", ()=>{
    if(!sessionCourante.user){
      openAuth("Connecte-toi pour modifier ton roster.", true);
      return;
    }
    const existing = new Set(
      MemberRosterStore.all(sessionCourante.user.id).map(entry => entry.charId)
    );
    Picker.open({
      title:"Ajouter un personnage",
      portrait:true,
      allowNone:false,
      items:(DATA.personnages || [])
        .filter(character => !existing.has(character.id))
        .map(character => ({
          value:character.id,
          name:character.name,
          file:character.file
        })),
      emptyHint:"Tous les personnages sont déjà dans ton roster.",
      onSelect:charId=>openMemberRosterEditor({
          owner:sessionCourante.user.id,
          charId,
          potentialTier:0,
          builds:{},
          updatedAt:0
        }, $("#memberRosterAdd"))
    });
  });
  $("#memberRosterClose").addEventListener("click", closeMemberRosterEditor);
  $("#memberRosterOverlay").addEventListener("click", event => {
    if(event.target === $("#memberRosterOverlay")) closeMemberRosterEditor();
  });

  /* ============================ Builder ============================ */
  const heroGrid = $("#heroGrid");
  const pseudoInput = $("#pseudo");
  const teamNameInput = $("#teamName");

  pseudoInput.addEventListener("input", e => draft.pseudo = e.target.value);
  teamNameInput.addEventListener("input", e => draft.name = e.target.value);

  function renderBuilder(){
    if(sessionCourante.user && sessionCourante.pseudo) draft.pseudo = sessionCourante.pseudo;
    teamNameInput.value = draft.name || "";
    pseudoInput.value = draft.pseudo || "";
    pseudoInput.disabled = !!sessionCourante.user;
    $("#editFlag").classList.toggle("on", editing);
    $("#btnSave").textContent = editing ? "Mettre à jour l'équipe" : "Enregistrer l'équipe";
    heroGrid.innerHTML = "";
    draft.heroes.forEach((hero, i) => heroGrid.appendChild(heroCard(hero, i)));
  }
  function switchBuilderHeroBuild(heroIndex, weaponType){
    const hero = draft.heroes[heroIndex];
    if(!hero || hero.activeWeaponType === weaponType) return;
    draft.heroes[heroIndex] = activateHeroBuild(hero, weaponType);
    renderBuilder();
    const card = heroGrid.children[heroIndex];
    const active = card && [...card.querySelectorAll(
      ".builder-weapon-switch"
    )].find(button => button.dataset.weaponType === weaponType);
    if(active) active.focus();
  }
  function rosterNetworkAvailable(){
    return !!sessionCourante.user && !!sb
      && (typeof navigator === "undefined"
        || navigator.onLine !== false);
  }
  function focusBuilderWeaponSwitch(heroIndex, weaponType){
    const card = heroGrid.children[heroIndex];
    const button = card && [...card.querySelectorAll(
      ".builder-weapon-switch"
    )].find(item => item.dataset.weaponType === weaponType);
    if(button) button.focus();
  }
  async function updateBuilderHeroRoster(heroIndex){
    if(!rosterNetworkAvailable()){
      toast("Connexion requise pour mettre à jour le roster.", true);
      return;
    }
    const hero = draft.heroes[heroIndex];
    if(!hero || !hero.char){
      toast("Choisis d’abord un personnage.", true);
      return;
    }
    storeActiveHeroBuild(hero);
    const type = hero.activeWeaponType || weaponFolderOf(hero.weapon);
    if(!type){
      toast("Choisis d’abord un type d’arme.", true);
      return;
    }
    let rows;
    try{
      rows = await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      toast("Impossible de vérifier ton roster.", true);
      return;
    }
    const latest = rows.find(entry => entry.charId === hero.char);
    const baseline = builderRosterBaselines[heroIndex]
      || {
        ownerId:"",
        charId:"",
        updatedAt:0,
        updatedAtToken:"",
        builds:{}
      };
    const latestUpdatedAtToken = latest && latest.updatedAtToken || "";
    const remotelyChanged = !rosterBaselineIdentityMatches(
      baseline,
      sessionCourante.user.id,
      hero.char
    )
      || !rosterBaselineVersionMatches(baseline, latest);
    if(remotelyChanged && !confirm(
      "Ton roster a été modifié depuis son chargement. "
      +"Écraser uniquement le build "+rosterWeaponLabel(type)+" ?"
    )){
      toast("Le roster a été modifié ailleurs. Mise à jour annulée.", true);
      return;
    }
    const next = rosterEntryWithActiveHeroBuild(
      latest,
      hero,
      sessionCourante.user.id
    );
    try{
      const saved = await MemberRosterStore.updateBuild(
        next,
        type,
        latestUpdatedAtToken
      );
      builderRosterBaselines[heroIndex] = {
        ownerId:sessionCourante.user.id,
        charId:hero.char,
        updatedAt:Number(saved.updatedAt) || 0,
        updatedAtToken:saved.updatedAtToken || "",
        builds:jsonCopy(saved.builds)
      };
      renderBuilder();
      focusBuilderWeaponSwitch(heroIndex, type);
      toast("Build "+rosterWeaponLabel(type)+" mis à jour dans ton roster.");
    }catch(error){
      if(String(error && error.message || error).includes("ROSTER_CONFLICT")){
        toast(
          "Ton roster a été modifié ailleurs. Recharge-le puis réessaie.",
          true
        );
        return;
      }
      toast("Roster non enregistré : "+authMessage(error), true);
    }
  }
  async function reloadBuilderHeroFromRoster(heroIndex){
    if(!rosterNetworkAvailable()){
      toast("Connexion requise pour recharger le roster.", true);
      return;
    }
    const hero = draft.heroes[heroIndex];
    if(!hero || !hero.char) return;
    const dirty = weaponTypesOf(hero.char)
      .some(type => builderBuildIsDirty(heroIndex, type));
    if(dirty && !confirm(
      "Remplacer les trois brouillons de ce héros par ton roster ?"
    )){
      return;
    }
    let rows;
    try{
      rows = await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      toast("Impossible de recharger ton roster.", true);
      return;
    }
    const latest = rows.find(entry => entry.charId === hero.char);
    if(!latest){
      toast("Ce personnage n’existe plus dans ton roster.", true);
      return;
    }
    const currentType = weaponFolderOf(hero.weapon)
      || hero.activeWeaponType;
    const nextType = Object.prototype.hasOwnProperty.call(
      latest.builds,
      currentType
    )
      ? currentType
      : favoriteRosterWeaponType(latest)
        || Object.keys(latest.builds)[0];
    if(!nextType){
      toast("Ce personnage n’a aucun build dans ton roster.", true);
      return;
    }
    const snapshot = rosterHeroSnapshot(latest, nextType);
    if(!snapshot) return;
    draft.heroes[heroIndex] = snapshot;
    builderRosterBaselines[heroIndex] = {
      ownerId:sessionCourante.user.id,
      charId:hero.char,
      updatedAt:Number(latest.updatedAt) || 0,
      updatedAtToken:latest.updatedAtToken || "",
      builds:jsonCopy(latest.builds)
    };
    renderBuilder();
    focusBuilderWeaponSwitch(heroIndex, nextType);
    toast("Les trois builds ont été rechargés depuis ton roster.");
  }
  if(window.addEventListener){
    ["online","offline"].forEach(eventName => {
      window.addEventListener(eventName, () => {
        if($("#view-builder").classList.contains("active")){
          renderBuilder();
        }
      });
    });
  }

  function gearThumb(file){
    const box = el("div",{class:"gear-thumb"});
    if(file) box.appendChild(el("img",{src:file, alt:"", loading:"lazy"}));
    else box.textContent = "+";
    return box;
  }

  function heroCard(hero, i){
    const ch = charOf(hero.char);
    const sourceActions = el("div",{class:"hero-source-actions"});
    if(sessionCourante.user){
      sourceActions.appendChild(el("button",{
        class:"btn btn-primary",
        type:"button",
        text:"Depuis mon roster",
        onclick:()=>void pickRosterHero(i)
      }));
    }
    sourceActions.appendChild(el("button",{
      class:"btn",
      type:"button",
      text:"Choisir manuellement",
      onclick:()=>pickChar(i)
    }));
    const currentWeaponType = weaponFolderOf(hero.weapon)
      || hero.activeWeaponType;
    const rosterEntry = sessionCourante.user && hero.char
      ? MemberRosterStore.all(sessionCourante.user.id)
        .find(entry => entry.charId === hero.char)
      : null;
    if(hero.char){
      const updateProps = {
        class:"btn hero-roster-update",
        type:"button",
        text:"Mettre à jour mon roster",
        onclick:()=>void updateBuilderHeroRoster(i)
      };
      if(!rosterNetworkAvailable()){
        updateProps.disabled = "disabled";
        updateProps.title = "Connexion requise pour mettre à jour le roster";
      }
      sourceActions.appendChild(el("button",updateProps));
    }
    if(rosterEntry && currentWeaponType){
      const reloadProps = {
        class:"btn hero-roster-reload",
        type:"button",
        text:"Recharger depuis mon roster",
        onclick:()=>void reloadBuilderHeroFromRoster(i)
      };
      if(!rosterNetworkAvailable()){
        reloadProps.disabled = "disabled";
        reloadProps.title = "Connexion requise pour recharger le roster";
      }
      sourceActions.appendChild(el("button",reloadProps));
    }

    // Portrait
    const portrait = el("button",{class:"portrait", type:"button", title:"Choisir un héros",
      onclick:()=>pickChar(i)});
    if(ch){ portrait.appendChild(el("img",{src:ch.file, alt:ch.name})); }
    else{ portrait.appendChild(el("div",{class:"ph",html:'<span class="plus">+</span><span>Héros</span>'})); }

    const title = el("div",{class:"hero-title"+(ch?"":" empty"), text: ch ? ch.name : "Emplacement libre"});
    const badges = builderWeaponSwitcher(hero, i, ch);

    // Gear : arme + 5 armures + 3 bijoux
    const gear = el("div",{class:"gear"});
    gear.appendChild(gearSlot("Arme", hero.weapon, true, ()=>pickWeapon(i)));
    const configControl = weaponConfigControl({
      weaponFile:hero.weapon,
      config:hero.weaponConfig,
      sourceUpdatedAt:teamDraftSourceUpdatedAt,
      parentIsDirty(){
        return JSON.stringify(draft) !== teamDraftInitialJson;
      },
      sourceWasDeleted(){
        if(teamDraftSourceUpdatedAt <= 0) return false;
        return !Store.all().some(row => row.id === draft.id);
      },
      defaultGradeGameId:weaponDefaultGradeGameId(hero.weapon),
      commit(nextConfig){
        hero.weaponConfig = nextConfig;
        renderBuilder();
        const nextButton = heroGrid.children[i]
          && heroGrid.children[i].querySelector(".weapon-config-open");
        if(nextButton){
          ModalStack.setRestoreFocus($("#weaponConfigOverlay"), nextButton);
        }
      },
      latestUpdatedAt(){
        const latest = Store.all().find(row => row.id === draft.id);
        return latest ? latest.updatedAt : teamDraftSourceUpdatedAt;
      },
      reload(){
        const latest = Store.all().find(row => row.id === draft.id);
        if(!latest){
          if(teamDraftSourceUpdatedAt > 0){
            closeDeletedTeamDraft();
          }
          return true;
        }
        draft = normalizeTeam(JSON.parse(JSON.stringify(latest)));
        teamDraftSourceUpdatedAt = draft.updatedAt;
        teamDraftInitialJson = JSON.stringify(draft);
        renderBuilder();
      }
    });
    if(configControl) gear.appendChild(configControl);
    gear.appendChild(el("div",{class:"gear-group", text:"Armures"}));
    gear.appendChild(equipmentSetButton("armor", set => {
      ARMOR_SET_SLOTS.forEach(slot => {
        applyGearChange(hero, "armor", slot, set.pieces[slot]);
      });
      renderBuilder();
      toast("Set « "+set.name+" » équipé.");
    }));
    ARMOR_SLOTS.forEach(slot=>{
      gear.appendChild(gearConfigurableSlot(
        ARMOR_LABELS[slot],
        hero.armor[slot],
        ()=>pickArmor(i, slot),
        "",
        slot,
        {
          config:hero.armorConfig && hero.armorConfig[slot],
          commit(nextConfig){
            if(!hero.armorConfig) hero.armorConfig = {};
            if(nextConfig === null) delete hero.armorConfig[slot];
            else hero.armorConfig[slot] = nextConfig;
            renderBuilder();
            const nextHero = heroGrid.children[i];
            const nextButton = nextHero
              ? findGearConfigButton(nextHero, slot) : null;
            if(nextButton){
              ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
            }
          }
        }
      ));
    });
    gear.appendChild(el("div",{class:"gear-group", text:"Bijoux"}));
    gear.appendChild(equipmentSetButton("jewel", set => {
      JEWEL_SLOTS.forEach(slot => {
        applyGearChange(hero, "jewel", slot, set.pieces[slot]);
      });
      renderBuilder();
      toast("Bijoux « "+set.name+" » équipés.");
    }));
    JEWEL_SLOTS.forEach(slot=>{
      gear.appendChild(gearConfigurableSlot(
        JEWEL_LABELS[slot],
        hero.jewel[slot],
        ()=>pickJewel(i, slot),
        "jewel",
        slot,
        {
          config:hero.jewelConfig && hero.jewelConfig[slot],
          commit(nextConfig){
            if(!hero.jewelConfig) hero.jewelConfig = {};
            if(nextConfig === null) delete hero.jewelConfig[slot];
            else hero.jewelConfig[slot] = nextConfig;
            renderBuilder();
            const nextHero = heroGrid.children[i];
            const nextButton = nextHero
              ? findGearConfigButton(nextHero, slot) : null;
            if(nextButton){
              ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
            }
          }
        }
      ));
    });

    // Potentiel
    const pot = potentielControl(hero, i, ch);

    // Note
    const note = el("textarea",{class:"note", placeholder:"Rôle / notes (ex. tank, burst P2)…",
      maxlength:"160"});
    note.value = hero.note || "";
    note.addEventListener("input", e => hero.note = e.target.value);

    const clear = el("button",{class:"clear", type:"button", text:"Vider ce héros",
      onclick:()=>{ draft.heroes[i] = emptyHero(); renderBuilder(); }});

    const content = [
      sourceActions, portrait, title, badges, gear, pot, note
    ];
    if(ch) content.push(heroStatsSection(hero));
    content.push(clear);
    return el("div",{class:"hero"},content);
  }

  // Petit bloc "Potentiel" sur la carte héros -> ouvre la fenêtre de potentiel
  function potentielControl(hero, i, ch){
    const p = hero.potentiel = normalizePotentiel(hero.potentiel);
    const types = ch ? weaponTypesOf(ch.id) : [];
    const disabled = !ch || !types.length;
    const tierTxt = p.tier > 0 ? ("P" + p.tier) : "—";

    const btn = el("button",{
      class:"pot-btn"+(p.tier>0?" set":"")+(disabled?" disabled":""),
      type:"button",
      title: disabled ? "Choisis d'abord un héros" : "Éditer le potentiel",
      onclick: ()=>{ if(!disabled) openPotentiel(i); }
    },[
      el("span",{class:"pot-star", text:"✦"}),
      el("span",{class:"pot-lbl", text:"Potentiel"}),
      el("span",{class:"pot-val", text:disabled ? "—" : tierTxt})
    ]);
    return btn;
  }

  function gearSlot(label, file, isWeapon, onclick, extraClass, slotKey){
    return el("button",{
      class:"gear-slot"+(isWeapon?" weapon":"")+(extraClass?" "+extraClass:"")+(file?" filled":""),
      type:"button",
      title:(isWeapon?"Arme":label)+(file?" : "+nameOfFile(file):""),
      dataset:slotKey ? {slot:slotKey} : undefined,
      onclick
    },[
      gearThumb(file),
      el("span",{class:"gear-label", text:label})
    ]);
  }

  function gearConfigurableSlot(label, file, onclick, extraClass, slotKey, settings){
    const cell = el("div",{
      class:"gear-configurable-slot",
      dataset:{slot:slotKey}
    },[
      gearSlot(label, file, false, onclick, extraClass, slotKey)
    ]);
    if(file){
      const control = gearConfigControl({
        file,
        slotKey,
        label,
        config:settings && settings.config,
        commit:settings && settings.commit
      });
      if(control) cell.appendChild(control);
    }
    return cell;
  }

  function findGearConfigButton(container, slotKey){
    return [...container.querySelectorAll(".gear-config-open")]
      .find(button => button.dataset.slot === slotKey) || null;
  }

  // Pickers spécialisés
  function pickChar(i){
    Picker.open({
      title:"Choisir un héros", portrait:true, value:draft.heroes[i].char,
      items:(DATA.personnages||[]).map(c=>({value:c.id, name:c.name, file:c.file})),
      onSelect:v=>{
        draft.heroes[i] = applyCharacterChange(
          draft.heroes[i],
          v
        );
        resetBuilderRosterBaseline(i);
        renderBuilder();
      }
    });
  }
  function pickWeapon(i){
    const hero = draft.heroes[i];
    if(!hero.char){
      toast("Choisis d'abord un héros.", true);
      return;
    }
    const compatible = compatibleWeaponGroups(hero.char);
    const activeType = hero.activeWeaponType;
    const groups = activeType
      ? Object.entries(compatible).reduce((result, [label, items]) => {
          const matching = items.filter(item =>
            weaponFolderOf(item.file) === activeType
          );
          if(matching.length) result[label] = matching;
          return result;
        }, {})
      : compatible;
    Picker.open({
      title:"Choisir une arme", value:hero.weapon,
      groups,
      emptyHint:"Aucune arme compatible disponible.",
      onSelect:v=>{
        if(hero.weaponConfig && hero.weapon !== v
          && !confirm("Changer d’arme réinitialisera sa configuration chiffrée. Continuer ?")){
          return;
        }
        draft.heroes[i] = applyWeaponChange(hero, v);
        renderBuilder();
      }
    });
  }
  function pickArmor(i, slot){
    const hero = draft.heroes[i];
    if(slot === LINKED_ARMOR_SLOT && !hero.char){
      toast("Choisis d'abord un héros.", true);
      return;
    }
    const allowed = slot === LINKED_ARMOR_SLOT
      ? new Set(linkedArmorsOf(hero.char))
      : null;
    const items = (DATA.armures[slot]||[])
      .filter(a => !allowed || allowed.has(a.file))
      .map(a => ({value:a.file, name:a.name, file:a.file}));
    Picker.open({
      title:"Armure — "+ARMOR_LABELS[slot],
      value:hero.armor[slot],
      items,
      emptyHint:slot === LINKED_ARMOR_SLOT
        ? "Aucune armure liée compatible disponible."
        : "Aucune armure disponible.",
      onSelect:v=>{
        applyGearChange(hero, "armor", slot, v);
        renderBuilder();
      }
    });
  }
  function pickJewel(i, slot){
    Picker.open({
      title:"Bijou — "+slot, value:draft.heroes[i].jewel[slot],
      items:(DATA.bijoux[slot]||[]).map(b=>({value:b.file, name:b.name, file:b.file})),
      emptyHint:"Aucun bijou pour l'instant. Ajoute des images dans 7ds-bijoux/"+slot+"/ puis relance generate-data.ps1.",
      onSelect:v=>{
        applyGearChange(draft.heroes[i], "jewel", slot, v);
        renderBuilder();
      }
    });
  }

  function masteryIconForWeaponType(type){
    const item = WEAPON_ENUM[FOLDER_TO_ENUM[type]];
    return item ? "7ds-ui/mastery/"+item.icon+".webp" : "";
  }

  async function pickRosterHero(slotIndex){
    if(!sessionCourante.user){
      openAuth("Connecte-toi pour utiliser ton roster.", true);
      return;
    }
    let entries;
    try{
      entries = await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      entries = MemberRosterStore.all(sessionCourante.user.id);
      if(!entries.length){
        toast("Ton roster est indisponible.", true);
        return;
      }
    }
    if(!entries.length){
      toast("Ton roster est vide. Ajoute d’abord un personnage.", true);
      return;
    }
    Picker.open({
      title:"Choisir dans mon roster",
      portrait:true,
      allowNone:false,
      items:entries.map(entry => {
        const character = charOf(entry.charId);
        return {
          value:entry.charId,
          name:character.name,
          file:character.file
        };
      }),
      onSelect:charId=>{
        const entry = entries.find(item => item.charId === charId);
        if(entry) pickRosterWeapon(slotIndex, entry);
      }
    });
  }

  function pickRosterWeapon(slotIndex, entry){
    const items = Object.keys(entry.builds).map(type => ({
      value:type,
      name:type+" · "+(entry.builds[type].weapon
        ? nameOfFile(entry.builds[type].weapon)
        : "équipement partiel"),
      file:entry.builds[type].weapon || masteryIconForWeaponType(type)
    }));
    if(!items.length){
      toast("Ce personnage n’a encore aucun équipement enregistré.", true);
      return;
    }
    Picker.open({
      title:"Choisir l’équipement",
      allowNone:false,
      items,
      onSelect:type=>loadRosterHero(slotIndex, entry, type)
    });
  }

  function loadRosterHero(slotIndex, entry, weaponType){
    const snapshot = rosterHeroSnapshot(entry, weaponType);
    if(!snapshot) return;
    draft.heroes[slotIndex] = snapshot;
    resetBuilderRosterBaselines();
    renderBuilder();
    toast("Équipement copié depuis ton roster.");
  }

  /* ---- Potentiel : rendu du balisage couleur [#RRGGBB]texte[-] ---- */
  function renderBonus(str){
    const esc = (str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return esc
      .replace(/\[#([0-9A-Fa-f]{6})\]/g, '<span style="color:#$1">')
      .replace(/\[-\]/g, "</span>")
      .replace(/\n/g, "<br>");
  }

  /* ---- Fenêtre Potentiel (façon page de référence) ---- */
  const Potentiel = (function(){
    const overlay = $("#potOverlay"), body = $("#potBody"), titleEl = $("#potTitle");
    let heroIdx = -1;

    function open(i){
      heroIdx = i;
      const hero = draft.heroes[i], ch = charOf(hero.char);
      if(!ch) return;
      const types = weaponTypesOf(ch.id);
      if(!types.length) return;
      titleEl.textContent = "Potentiel — " + ch.name;
      render();
      ModalStack.open(overlay, "#potClose", close);
    }
    function close(){ ModalStack.close(overlay); }

    function render(){
      const hero = draft.heroes[heroIdx];
      const details = potentielDetailsOf(hero);
      const selTier = normalizePotentiel(hero.potentiel).tier;
      body.innerHTML = "";

      // Boutons de palier — P0 puis P1..P10
      const head = el("div",{class:"pot-head"},[
        el("span",{class:"pot-head-lbl", text:"Palier"}),
        el("span",{class:"pot-head-val", text:"P"+selTier+"/"+POT_MAX})
      ]);
      body.appendChild(head);

      const row = el("div",{class:"pot-paliers"});
      const setTier = tier => {
        hero.potentiel = normalizePotentiel({ tier });
        render();
        renderBuilder();
      };
      row.appendChild(el("button",{class:"pot-p"+(selTier===0?" active":""), text:"P0",
        title:"Aucun palier", onclick:()=>setTier(0)}));
      for(let t=1;t<=POT_MAX;t++){
        row.appendChild(el("button",{class:"pot-p"+(t<=selTier?" reached":"")+(t===selTier?" active":""),
          text:"P"+t, onclick:()=>setTier(t)}));
      }
      body.appendChild(row);

      if(details.list.length){
        body.appendChild(el("div",{class:"pot-list-title", text:"Bonus de l'arme équipée"}));
        const listBox = el("div",{class:"pot-list"});
        details.list.forEach((desc, idx)=>{
          const t = idx+1;
          const item = el("div",{class:"pot-item"+(t<=selTier?" on":"")});
          item.appendChild(el("span",{class:"pot-item-t", text:"P"+t}));
          item.appendChild(el("span",{class:"pot-item-d", html:renderBonus(desc)}));
          listBox.appendChild(item);
        });
        body.appendChild(listBox);
      }else{
        body.appendChild(el("div",{class:"pot-empty",
          text:"Équipe une arme compatible pour afficher les bonus de potentiel."}));
      }
    }

    $("#potClose").addEventListener("click", close);
    overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
    return { open };
  })();
  function openPotentiel(i){ Potentiel.open(i); }

  // Actions builder
  function resetTeamDraft(){
    draft = emptyDraft();
    editing = false;
    teamDraftSourceUpdatedAt = 0;
    teamDraftInitialJson = JSON.stringify(draft);
    teamDraftDeletedRemotely = false;
    resetBuilderRosterBaselines();
    renderBuilder();
  }

  function closeDeletedTeamDraft(){
    closeWeaponConfigEditor();
    resetTeamDraft();
    teamDraftDeletedRemotely = true;
    toast("Cette équipe a été supprimée dans un autre onglet.", true);
  }

  $("#btnNew").addEventListener("click", ()=>{
    resetTeamDraft();
    toast("Nouvelle équipe prête.");
  });

  $("#btnSave").addEventListener("click", async()=>{
    if(!sessionCourante.user || !sb){
      openAuth("Connecte-toi pour enregistrer cette équipe.", true);
      return;
    }
    if(teamDraftDeletedRemotely){
      toast("Cette équipe a été supprimée dans un autre onglet.", true);
      return;
    }
    const pseudo = (sessionCourante.pseudo||draft.pseudo||"").trim();
    if(!pseudo){ toast("Ajoute d'abord un pseudo de membre.", true); pseudoInput.focus(); return; }
    if(!draft.heroes.some(h=>h.char)){ toast("Ajoute au moins un héros à l'équipe.", true); return; }

    const now = Date.now();
    const existing = Store.all().find(t=>t.id===draft.id);
    const team = normalizeTeam(JSON.parse(JSON.stringify(draft)));
    team.pseudo = pseudo;
    team.createdAt = existing ? existing.createdAt : now;
    team.updatedAt = now;
    const saveButton = $("#btnSave");
    saveButton.disabled = true;
    try{
      const latest = Store.all().find(row => row.id === team.id);
      if(teamDraftSourceUpdatedAt > 0 && !latest){
        closeDeletedTeamDraft();
        return;
      }
      const latestUpdatedAt = Number(latest && latest.updatedAt) || 0;
      if(teamDraftSourceUpdatedAt > 0
        && latestUpdatedAt > teamDraftSourceUpdatedAt
        && !confirm("Une version plus récente existe. Enregistrer quand même ?")){
        saveButton.disabled = false;
        saveButton.focus();
        return;
      }
      const saved = await Store.upsert(team);
      teamDraftSourceUpdatedAt = saved.updatedAt;
      toast(editing ? "Équipe mise à jour." : "Équipe enregistrée !");
      resetTeamDraft();
      showView("roster");
    }catch(error){
      toast("Enregistrement impossible : "+authMessage(error), true);
    }finally{
      saveButton.disabled = false;
    }
  });

  /* ============================ Roster (page d'affichage) ============================ */
  const rosterGrid = $("#rosterGrid");
  let rosterRenderId = 0;

  async function renderRoster(){
    const renderId = ++rosterRenderId;
    rosterGrid.className = "";
    rosterGrid.innerHTML = "";
    rosterGrid.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Chargement des équipes…"})
    ]));
    let teams;
    try{
      teams = await Store.refresh();
    }catch(error){
      teams = Store.all();
      toast("Registre indisponible, affichage du cache local.", true);
    }
    if(renderId !== rosterRenderId) return;
    teams = teams.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const c = $("#rosterCount");
    c.innerHTML = "<b>"+teams.length+"</b> équipe"+(teams.length>1?"s":"")+" enregistrée"+(teams.length>1?"s":"");

    rosterGrid.className = teams.length ? "roster-grid" : "";
    rosterGrid.innerHTML = "";

    if(!teams.length){
      rosterGrid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Aucune équipe pour l'instant"}),
        el("p",{text:"Va dans « Créer une équipe » pour proposer ta première compo face au Boss de Guilde."})
      ]));
      return;
    }
    teams.forEach(t=>rosterGrid.appendChild(teamCard(t)));
  }

  function teamCard(t){
    /* Avec un nom, il devient la ligne principale et le pseudo passe dessous.
       Sans nom, on garde exactement l'apparence d'avant. */
    const who = el("div",{class:"team-who"});
    if(t.name){
      who.appendChild(el("span",{class:"team-name", text:t.name}));
      who.appendChild(el("span",{class:"team-pseudo", text:t.pseudo || "Sans pseudo"}));
    }else{
      who.appendChild(el("span",{class:"team-pseudo", text:t.pseudo || "Sans pseudo"}));
    }
    who.appendChild(el("span",{class:"team-date",
      text: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString("fr-FR") : ""}));
    const head = el("div",{class:"team-head"},[
      el("div",{class:"seal", text:initials(t.pseudo)}),
      who
    ]);

    const heroes = el("div",{class:"team-heroes clickable", title:"Voir l'équipement",
      onclick:()=>openTeamDetail(t)});
    (t.heroes||[]).forEach(h=>heroes.appendChild(miniHero(h)));

    const hint = el("button",{class:"team-detail-btn", type:"button",
      text:"Voir l'équipement ▾", onclick:()=>openTeamDetail(t)});

    /* « Dupliquer » est offert sur toute équipe : le registre est partagé, et la
       copie est un brouillon indépendant qu'il faudra enregistrer soi-même.
       Modifier et Supprimer restent réservés au propriétaire. */
    const actions = el("div",{class:"team-actions"},[
      el("button",{
        class:"btn",
        type:"button",
        dataset:{ teamAction:"duplicate" },
        text:"Dupliquer",
        onclick:()=>duplicateTeam(t)
      })
    ]);
    if(canManageTeam(t)){
      actions.appendChild(el("button",{
        class:"btn",
        type:"button",
        dataset:{ teamAction:"edit" },
        text:"Modifier",
        onclick:()=>editTeam(t)
      }));
      actions.appendChild(el("button",{
        class:"btn btn-danger",
        type:"button",
        dataset:{ teamAction:"delete" },
        text:"Supprimer",
        onclick:()=>void deleteTeam(t)
      }));
    }
    return el("div",{class:"team"},[head, heroes, hint, actions]);
  }

  /* ---- Modal de détail d'une équipe (équipement complet par héros) ---- */
  function equipLine(file, slotLabel, variant){
    const thumb = el("div",{class:"eq-thumb"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file) thumb.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')";
    return el("div",{class:"eq-line"+(file?"":" empty"), title: file ? nameOfFile(file) : ""},[
      thumb,
      el("div",{class:"eq-txt"},[
        el("span",{class:"eq-slot", text:slotLabel}),
        el("span",{class:"eq-name", text: file ? nameOfFile(file) : "—"})
      ])
    ]);
  }

  function heroDetail(h, options){
    const settings = options || {};
    const ch = h && h.char ? charOf(h.char) : null;
    const col = el("div",{class:"hdetail"});

    const port = el("div",{class:"hd-portrait"});
    if(ch) port.appendChild(el("img",{src:ch.file, alt:ch.name, loading:"lazy"}));
    else port.textContent = "—";
    const idBox = el("div",{class:"hd-id"},[
      el("div",{class:"hd-name"+(ch?"":" empty"), text: ch ? ch.name : "Emplacement libre"})
    ]);
    /* `badgesFor` remplace la rangée de badges figée par un sélecteur
       interactif (modal du roster d'un membre). */
    const badges = ch
      ? (settings.badgesFor ? settings.badgesFor(ch, h) : badgesRow(ch, h, false))
      : null;
    if(badges) idBox.appendChild(badges);
    col.appendChild(el("div",{class:"hd-head"},[port, idBox]));

    if(!ch) return col;

    if(h.potentiel && h.potentiel.tier > 0)
      col.appendChild(el("div",{class:"hd-pot", text:"✦ P"+h.potentiel.tier}));

    const gear = el("div",{class:"hd-gear"});
    gear.appendChild(el("div",{class:"hd-group-t", text:"Arme"}));
    gear.appendChild(equipLine(h.weapon, "Arme", "weapon"));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Armures"}));
    ARMOR_SLOTS.forEach(s=>gear.appendChild(equipLine(h.armor ? h.armor[s] : null, ARMOR_LABELS[s], "")));
    gear.appendChild(el("div",{class:"hd-group-t", text:"Bijoux"}));
    JEWEL_SLOTS.forEach(s=>gear.appendChild(equipLine(h.jewel ? h.jewel[s] : null, JEWEL_LABELS[s], "jewel")));
    col.appendChild(gear);

    const stats = heroStatsSection(h);
    if(stats) col.appendChild(stats);

    if(h.note && h.note.trim())
      col.appendChild(el("div",{class:"hd-note", text:h.note.trim()}));

    if(settings.canImport && h && h.char){
      const type = weaponFolderOf(h.weapon);
      const valid = type && weaponTypesOf(h.char).includes(type);
      const props = {
        class:"btn hd-roster-import",
        type:"button",
        title:valid ? "" : "Équipe d’abord une arme compatible.",
        text:settings.hasBuild(h.char, type)
          ? "Mettre à jour ce build dans mon roster"
          : "Ajouter au roster",
        onclick:()=>{ if(valid) void importTeamHeroToRoster(settings.team, h); }
      };
      if(!valid) props.disabled = "disabled";
      col.appendChild(el("button",props));
    }
    return col;
  }

  function openTeamDetail(t){
    $("#teamTitle").textContent = t.name
      ? t.name + " — " + (t.pseudo || "Sans pseudo")
      : "Équipe — " + (t.pseudo || "Sans pseudo");
    const box = $("#teamDetail");
    box.innerHTML = "";
    const ownEntries = sessionCourante.user ? MemberRosterStore.all(sessionCourante.user.id) : [];
    const settings = {
      team:t,
      canImport:canManageTeam(t) && !!sessionCourante.user,
      hasBuild:(charId, type)=>{
        const entry = ownEntries.find(item => item.charId === charId);
        return !!entry && !!type
          && Object.prototype.hasOwnProperty.call(entry.builds, type);
      }
    };
    (t.heroes||[]).forEach(h=>box.appendChild(heroDetail(h, settings)));
    ModalStack.open($("#teamOverlay"), "#teamClose", closeTeamDetail);
  }
  function closeTeamDetail(){
    ModalStack.close($("#teamOverlay"));
  }
  $("#teamClose").addEventListener("click", closeTeamDetail);
  $("#teamOverlay").addEventListener("click", event => {
    if(event.target === $("#teamOverlay")) closeTeamDetail();
  });

  function miniHero(h){
    const ch = h && h.char ? charOf(h.char) : null;

    const portrait = el("div",{class:"mini-portrait"});
    if(ch) portrait.appendChild(el("img",{src:ch.file, alt:ch.name, loading:"lazy"}));
    else portrait.textContent = "—";

    const name = el("div",{class:"mini-name"+(ch?"":" empty"), text: ch ? ch.name : "Libre"});
    const badges = badgesRow(ch, h, true);

    const kids = [portrait, name];
    if(badges) kids.push(badges);
    const p = h && h.potentiel;
    if(p && p.tier > 0){
      kids.push(el("div",{class:"mini-pot", title:"Potentiel",
        text:"✦ P"+p.tier}));
    }
    if(h && h.note && h.note.trim()){
      kids.push(el("div",{class:"mini-note", text:h.note.trim()}));
    }
    return el("div",{class:"mini"}, kids);
  }

  function gearIcon(file, variant){
    const d = el("div",{class:"icn"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file){ d.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')"; d.title = nameOfFile(file); }
    else d.title = variant==="weapon" ? "Pas d'arme" : "Vide";
    return d;
  }

  function canManageTeam(team){
    return !sessionCourante.user || !!team && team.owner === sessionCourante.user.id;
  }

  async function importTeamHeroToRoster(team, hero){
    if(!sessionCourante.user || !canManageTeam(team)) return;
    const type = weaponFolderOf(hero && hero.weapon);
    if(!hero || !hero.char || !type
      || !weaponTypesOf(hero.char).includes(type)){
      toast("Équipe d’abord une arme compatible.", true);
      return;
    }
    try{
      await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      if(!MemberRosterStore.all(sessionCourante.user.id).length){
        toast("Roster indisponible : "+authMessage(error), true);
        return;
      }
    }
    const existing = MemberRosterStore.all(sessionCourante.user.id)
      .find(entry => entry.charId === hero.char);
    const replacing = !!existing
      && Object.prototype.hasOwnProperty.call(existing.builds, type);
    const character = charOf(hero.char);
    if(replacing && !confirm(
      "Remplacer le build "+type+" de "+(character ? character.name : hero.char)+" ?"
    )) return;

    const next = normalizeRosterCharacter(existing || {
      owner:sessionCourante.user.id,
      charId:hero.char,
      potentialTier:hero.potentiel && hero.potentiel.tier,
      builds:{}
    });
    next.potentialTier = normalizePotentiel(hero.potentiel).tier;
    const importedBuild = normalizeRosterBuild(hero.char, type, hero);
    importedBuild.favorite = !!(
      existing
      && existing.builds[type]
      && existing.builds[type].favorite
    );
    next.builds[type] = importedBuild;
    try{
      await MemberRosterStore.upsert(next);
      toast(replacing
        ? "Build mis à jour dans ton roster."
        : "Personnage ajouté à ton roster.");
    }catch(error){
      toast("Import impossible : "+authMessage(error), true);
    }
  }

  function editTeam(t){
    if(!canManageTeam(t)){
      toast("Cette équipe appartient à un autre membre.", true);
      return;
    }
    draft = normalizeTeam(JSON.parse(JSON.stringify(t)));
    teamDraftSourceUpdatedAt = Number(draft.updatedAt) || 0;
    teamDraftInitialJson = JSON.stringify(draft);
    teamDraftDeletedRemotely = false;
    editing = true;
    resetBuilderRosterBaselines();
    renderBuilder();
    showView("builder");
    toast("Équipe chargée pour modification.");
  }

  /* Duplication : un brouillon indépendant, jamais une écriture immédiate.
     Nouvel identifiant, hors mode édition, et le pseudo devient le mien — la
     copie m'appartiendra dès que je l'enregistrerai. Rien ne part vers Supabase
     avant « Enregistrer ». */
  function duplicateTeam(t){
    const copy = normalizeTeam(JSON.parse(JSON.stringify(t)));
    copy.id = uid();
    copy.name = normalizeTeamName(
      (copy.name ? copy.name+" " : "Équipe ")+"(copie)"
    );
    copy.pseudo = sessionCourante.pseudo || copy.pseudo || "";
    delete copy.owner;
    delete copy.createdAt;
    delete copy.updatedAt;
    draft = copy;
    teamDraftSourceUpdatedAt = 0;
    teamDraftInitialJson = JSON.stringify(draft);
    teamDraftDeletedRemotely = false;
    editing = false;
    resetBuilderRosterBaselines();
    renderBuilder();
    showView("builder");
    teamNameInput.focus();
    toast("Copie prête. Ajuste-la puis enregistre-la.");
  }

  async function deleteTeam(t){
    if(!canManageTeam(t)){
      toast("Cette équipe appartient à un autre membre.", true);
      return;
    }
    if(!confirm('Supprimer l\'équipe de « '+(t.pseudo||"?")+' » ?')) return;
    try{
      await Store.remove(t.id);
      await renderRoster();
      toast("Équipe supprimée.");
    }catch(error){
      toast("Suppression impossible : "+authMessage(error), true);
    }
  }

  /* ============================ Export / Import ============================ */
  $("#btnExport").addEventListener("click", ()=>{
    const data = Store.all();
    if(!data.length){ toast("Rien à exporter.", true); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const a = el("a",{href:URL.createObjectURL(blob), download:"confrerie7ds-equipes.json"});
    document.body.appendChild(a); a.click(); a.remove();
    toast(data.length+" équipe(s) exportée(s).");
  });

  $("#btnImport").addEventListener("click", ()=>$("#importFile").click());
  $("#importFile").addEventListener("change", e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async()=>{
      try{
        const incoming = JSON.parse(reader.result);
        if(!Array.isArray(incoming)) throw new Error("format");
        const normalized = [];
        let added=0;
        incoming.forEach(t=>{
          if(!t || typeof t!=="object") return;
          const team = normalizeTeam(Object.assign({}, t, { id:t.id||uid() }));
          normalized.push(team);
          added++;
        });
        if(sessionCourante.user){
          for(const team of normalized) await Store.upsert(team);
        }else{
          const list = LocalTeams.all();
          normalized.forEach(team=>{
            const index = list.findIndex(item=>item.id===team.id);
            if(index>=0) list[index]=team; else list.push(team);
          });
          LocalTeams.save(list);
        }
        await renderRoster();
        toast(added+" équipe(s) importée(s).");
      }catch(err){ toast("Fichier JSON invalide.", true); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  async function migrateLocalData(){
    if(!sessionCourante.user || !sb){
      openAuth("Connecte-toi pour importer tes données locales.", true);
      return;
    }
    const migrationKey = MIGRATION_KEY_PREFIX+sessionCourante.user.id;
    if(localStorage.getItem(migrationKey) === "1") return;
    const button = $("#btnMigrateLocal");
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Import en cours…";
    try{
      const localTeams = LocalTeams.all();
      if(!localTeams.length){
        toast("Aucune donnée locale à importer.");
        return;
      }

      for(const localTeam of localTeams){
        await Store.upsert(Object.assign({}, localTeam, {
          pseudo:sessionCourante.pseudo,
          owner:sessionCourante.user.id,
          updatedAt:localTeam.updatedAt || Date.now()
        }));
      }

      localStorage.setItem(migrationKey, "1");
      updateAccountUi();
      if($("#view-roster").classList.contains("active")) await renderRoster();
      if($("#view-analyse").classList.contains("active")) await renderAnalyse();
      toast(
        localTeams.length+" équipe"+(localTeams.length>1 ? "s" : "")
          +" importée"+(localTeams.length>1 ? "s" : "")+" dans le registre."
      );
    }catch(error){
      toast("Import local impossible : "+authMessage(error), true);
    }finally{
      if(localStorage.getItem(migrationKey) !== "1"){
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }
  $("#btnMigrateLocal").addEventListener("click", ()=>void migrateLocalData());

  const ELEM_ORDER = ["FIRE","ICE","WIND","EARTH","HOLY","DARK","THUNDER"];
  const elemLabel = e => e==="HOLY" ? "Lumière" : (ELEMENTS[e] ? ELEMENTS[e].label : (e||"—"));
  const elemColor = e => ELEMENTS[e] ? ELEMENTS[e].color : "#8a8a8a";
  const elemOf = charId => { const m = metaOf(charId); return m ? (m.element||"").toUpperCase() : null; };
  // éléments POSSIBLES d'un perso (il en a un par type d'arme équipable)
  function charElements(charId){
    const m = metaOf(charId); if(!m) return [];
    const set = [];
    (m.weapons||[]).forEach(w=>{ const e=(w.element||"").toUpperCase(); if(e && e!=="DEFAULT" && !set.includes(e)) set.push(e); });
    if(!set.length && m.element) set.push((m.element||"").toUpperCase());
    return set;
  }
  // élément retenu pour une entrée DPS (choisi, sinon 1er possible)
  const dpsElem = d => (d.element||"").toUpperCase() || charElements(d.char)[0] || elemOf(d.char);

  function elemBadge(e){
    const b = el("span",{class:"elem-badge", title:elemLabel(e)});
    b.style.setProperty("--ec", elemColor(e));
    b.appendChild(el("span",{class:"dot"}));
    b.appendChild(el("span",{text:elemLabel(e)}));
    return b;
  }

  /* ============================ Analyse ============================ */
  let analyseElem = null;
  let analyseRenderId = 0;
  let analysePlayers = [];   // joueurs déjà chargés par renderAnalyse (filtrage local)

  function rankRowForFocusKey(root, key){
    if(!root || !key) return null;
    return [...root.querySelectorAll(".rank-action")].find(row =>
      row.dataset.owner === String(key.owner || "")
      && row.dataset.char === String(key.char || "")
      && row.dataset.elem === String(key.element || "")
    ) || null;
  }

  // Construit le tableau du classement dans son conteneur stable, à partir des
  // joueurs déjà chargés et de l'élément choisi. Aucune lecture réseau ici.
  function renderRankTable(rankBox){
    const entries = [];
    analysePlayers.forEach(p=>(p.dps||[]).forEach(d=>{
      if(dpsElem(d)===analyseElem){
        entries.push({
          player:p.name,
          owner:p.owner,
          characters:p.characters,
          dps:d
        });
      }
    }));
    entries.sort((a,b)=>(b.dps.pot||0)-(a.dps.pot||0));
    const rank = el("div",{class:"rank-table"});
    rank.appendChild(el("div",{class:"rank-row rank-head"},[
      el("span",{class:"rk-pos",text:"#"}), el("span",{class:"rk-player",text:"Membre"}),
      el("span",{class:"rk-dps",text:"DPS"}), el("span",{class:"rk-pot",text:"Potentiel"})
    ]));
    if(!entries.length) rank.appendChild(el("div",{class:"rank-empty", text:"Aucun DPS "+elemLabel(analyseElem)+" recensé."}));
    entries.forEach((en,i)=>{
      const ch=charOf(en.dps.char);
      const element = dpsElem(en.dps);
      const port=el("span",{class:"rk-portrait"});
      if(ch) port.appendChild(el("img",{src:ch.file,alt:"",loading:"lazy"}));
      const row = el("button",{
        class:"rank-row rank-action"+(i<3?" top":""),
        type:"button",
        dataset:{ owner:en.owner || "", char:en.dps.char, elem:element },
        onclick:()=>{
          const entry = (en.characters||[])
            .find(character => character.charId === en.dps.char);
          if(!entry) return;
          openRosterDetailFor({
            entries:[entry],
            index:0,
            memberName:en.player,
            weaponTypes:en.dps.weaponTypes,
            weaponType:en.dps.preferredWeaponType,
            showNavigation:false,
            returnFocusKey:{
              owner:en.owner,
              char:en.dps.char,
              element
            }
          });
        }
      },[
        el("span",{class:"rk-pos", text:String(i+1)}),
        el("span",{class:"rk-player", text:en.player}),
        el("span",{class:"rk-dps"},[
          port,
          el("span",{text: ch?ch.name:en.dps.char})
        ]),
        el("span",{
          class:"rk-pot",
          text:en.dps.pot>0 ? ("P"+en.dps.pot) : "—"
        })
      ]);
      rank.appendChild(row);
    });
    rankBox.replaceChildren(rank);
    /* Realtime peut remplacer la ligne qui a ouvert la modale. On corrige la
       cible de restitution dans la pile AVANT la fermeture ; ModalStack reste
       l'unique mécanisme qui déplace effectivement le focus. */
    const overlay = $("#rosterDetailOverlay");
    if(overlay.classList.contains("on") && rosterDetail.returnFocusKey){
      const replacement = rankRowForFocusKey(
        rankBox, rosterDetail.returnFocusKey
      );
      if(replacement) ModalStack.setRestoreFocus(overlay, replacement);
    }
  }

  async function renderAnalyse(){
    const renderId = ++analyseRenderId;
    const box = $("#analyseBody");
    /* Le rafraîchissement détache immédiatement les lignes du classement. Si
       celle qui a ouvert la modale ne réapparaît pas (build supprimé ou lecture
       en échec), l'onglet Analyse reste une cible logique et visible. Une ligne
       reconstruite remplacera ce repli dans `renderRankTable()`. */
    const detailOverlay = $("#rosterDetailOverlay");
    if(detailOverlay.classList.contains("on") && rosterDetail.returnFocusKey){
      ModalStack.setRestoreFocus(detailOverlay, $("#tab-analyse"));
    }
    box.innerHTML = "";
    box.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Chargement de l’analyse…"})
    ]));
    if(!sessionCourante.user){
      box.innerHTML = "";
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour voir l'analyse"}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return;
    }
    let players;
    try{
      players = await rosterDerivedPlayers();
    }catch(error){
      players = [];
      toast("Analyse indisponible pour l'instant.", true);
    }
    if(renderId !== analyseRenderId) return;
    box.innerHTML = "";
    if(!players.length){
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Rien à analyser"}),
        el("p",{text:"Les DPS sont calculés depuis les rosters : ajoute des personnages offensifs dans l'onglet « Roster »."})
      ]));
      return;
    }

    // --- 1) Couverture par élément ---
    const cov = {}; ELEM_ORDER.forEach(e=>cov[e]={players:0,dps:0});
    players.forEach(p=>{
      const has={};
      (p.dps||[]).forEach(d=>{ const e=dpsElem(d); if(cov[e]){ cov[e].dps++; has[e]=true; } });
      ELEM_ORDER.forEach(e=>{ if(has[e]) cov[e].players++; });
    });
    box.appendChild(el("h2",{class:"an-title", text:"Couverture par élément"}));
    const covRow = el("div",{class:"cov-row"});
    ELEM_ORDER.forEach(e=>{
      const c = el("div",{class:"cov-card"});
      c.style.setProperty("--ec", elemColor(e));
      c.appendChild(elemBadge(e));
      c.appendChild(el("div",{class:"cov-nums"},[
        el("span",{class:"cov-big", text:String(cov[e].players)}),
        el("span",{class:"cov-lbl", text:"membre"+(cov[e].players>1?"s":"")})
      ]));
      c.appendChild(el("div",{class:"cov-sub", text:cov[e].dps+" DPS"}));
      covRow.appendChild(c);
    });
    box.appendChild(covRow);

    // --- 2) Classement par élément ---
    // Le classement vit dans un conteneur stable : le clic sur un élément ne
    // remplace que ce conteneur (aucun rechargement Supabase, aucun reflow global).
    box.appendChild(el("h2",{class:"an-title", text:"Classement par potentiel"}));
    if(analyseElem===null){
      analyseElem = ELEM_ORDER.find(e=>cov[e].dps>0) || ELEM_ORDER[0];
    }
    analysePlayers = players;
    const chips = el("div",{class:"elem-chips"});
    const rankBox = el("div",{class:"rank-box"});
    ELEM_ORDER.forEach(e=>{
      chips.appendChild(el("button",{class:"elem-chip"+(e===analyseElem?" active":""),
        "aria-pressed": e===analyseElem ? "true" : "false",
        dataset:{elem:e},
        onclick:()=>{
          analyseElem=e;
          [...chips.children].forEach(b=>{
            const on = b.dataset.elem===analyseElem;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          renderRankTable(rankBox);
        }},[ elemBadge(e) ]));
    });
    box.appendChild(chips);
    box.appendChild(rankBox);
    /* Le conteneur doit déjà être connecté : si Realtime reconstruit la vue
       pendant que la modale est ouverte, ModalStack refuse à juste titre une
       cible de focus détachée. */
    renderRankTable(rankBox);

    // --- 3) Matrice joueur × élément ---
    box.appendChild(el("h2",{class:"an-title", text:"Matrice membre × élément"}));
    const wrap = el("div",{class:"matrix-wrap"});
    const table = el("table",{class:"matrix"});
    const thead = el("tr",{},[ el("th",{class:"mx-player",text:"Membre"}), el("th",{text:"Total"}) ]);
    ELEM_ORDER.forEach(e=>{ const th=el("th",{}); th.appendChild(elemBadge(e)); thead.appendChild(th); });
    table.appendChild(thead);
    players.slice().sort((a,b)=>(b.dps||[]).length-(a.dps||[]).length).forEach(p=>{
      const tr=el("tr",{});
      tr.appendChild(el("td",{class:"mx-player", text:p.name}));
      tr.appendChild(el("td",{class:"mx-total", text:String((p.dps||[]).length)}));
      ELEM_ORDER.forEach(e=>{
        const cell = (p.dps||[]).filter(d=>dpsElem(d)===e)
          .sort((a,b)=>(b.pot||0)-(a.pot||0))
          .map(d=>{ const ch=charOf(d.char); return (ch?ch.name:d.char)+(d.pot>0?" P"+d.pot:""); });
        const td = el("td",{class:cell.length?"":"mx-empty"});
        if(cell.length) cell.forEach(t=>td.appendChild(el("div",{class:"mx-item",text:t})));
        else td.textContent="—";
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    box.appendChild(wrap);
  }

  /* ============================ Sessions de boss ============================ */
  /* 6 groupes auto-créés chaque semaine (reset lundi 9h). Les membres rejoignent
     un ou plusieurs groupes ; les semaines passées s'archivent toutes seules. */
  const BOSS_NAME = "Akumu, bête démoniaque";
  const BOSS_GROUPS = 6;
  const BOSS_SCHEMA_MAINTENANCE_MESSAGE =
    "La version du site et le schéma partagé ne sont pas compatibles. "+
    "La maintenance est en cours ; applique la mise à jour proposée puis recharge la page.";
  let bossRenderIssuedId = 0;
  let bossRenderAppliedId = 0;
  let bossViewOwnerVersion = 0;
  const emptyBossViewState = userId => ({
    userId:userId || "",
    week:null,
    allGroups:[],
    membership:[],
    reports:[],
    ready:false
  });
  let bossViewState = emptyBossViewState("");
  const bossPendingActions = new Map();

  function invalidateBossRenders(){
    bossRenderAppliedId = ++bossRenderIssuedId;
  }

  function ensureBossViewOwner(){
    const userId = sessionCourante.user ? sessionCourante.user.id : "";
    if(bossViewState.userId === userId) return;
    bossViewOwnerVersion++;
    if(bossTeamPickerContext && bossTeamPickerContext.userId !== userId){
      closeBossTeamPicker();
    }
    if(bossReportContext && bossReportContext.userId !== userId){
      closeBossReport();
    }
    invalidateBossRenders();
    bossViewState = emptyBossViewState(userId);
    bossPendingActions.clear();
  }

  function bossApplyIntent(membership, sessionId, intent){
    const owner = sessionCourante.user && sessionCourante.user.id;
    const next = (membership || []).filter(member =>
      member.session_id !== sessionId || member.owner !== owner
    );
    if(intent && intent.type === "join") next.push(intent.member);
    return next;
  }

  function bossVisibleMembership(){
    let membership = (bossViewState.membership || []).slice();
    bossPendingActions.forEach((intent, sessionId) => {
      membership = bossApplyIntent(membership, sessionId, intent);
    });
    return membership;
  }

  const BossStore = {
    async listAll(){
      if(!sessionCourante.user || !sb) return [];
      const { data, error } = await sb.from("boss_sessions").select("*")
        .order("week_start",{ascending:false}).order("slot",{ascending:true})
        .order("run_no",{ascending:true});
      if(error) throw error;
      return data || [];
    },
    // Crée les 6 groupes de la semaine s'ils n'existent pas encore (anti-doublon multi-clients).
    async ensureWeek(week){
      if(!sessionCourante.user || !sb) return;
      const now = new Date().toISOString();
      const rows = [];
      for(let i=1; i<=BOSS_GROUPS; i++){
        rows.push({ id:uid(), created_by:sessionCourante.user.id, title:"Groupe "+i,
          boss_name:BOSS_NAME, session_date:week.startDate, week_start:week.startDate, slot:i,
          run_no:1, elements:[], status:"open", created_at:now });
      }
      const { error } = await sb.from("boss_sessions")
        .upsert(rows, {
          onConflict:"week_start,slot,run_no",
          ignoreDuplicates:true
        });
      if(error) throw error;
    },
    /* Lectures ciblées de « Mon suivi » : la semaine seule, sans toucher aux
       méthodes déjà utilisées par la vue Boss. */
    async listWeek(weekStart){
      if(!sessionCourante.user || !sb) return [];
      const { data, error } = await sb.from("boss_sessions")
        .select("*")
        .eq("week_start", weekStart)
        .order("slot", {ascending:true})
        .order("run_no", {ascending:true});
      if(error) throw error;
      return data || [];
    },
    async listReportsForSessions(sessionIds){
      if(!sessionCourante.user || !sb || !sessionIds.length) return [];
      const reports = [];
      for(let start=0; start<sessionIds.length; start+=100){
        const batch = sessionIds.slice(start, start+100);
        const { data, error } = await sb.from("boss_run_reports")
          .select("*")
          .in("session_id", batch);
        if(error) throw error;
        reports.push(...(data || []));
      }
      return reports;
    },
    async listMembership(sessionIds){
      if(!sessionCourante.user || !sb || !sessionIds.length) return [];
      const memberships = [];
      const batchSize = 100;
      for(let start=0; start<sessionIds.length; start+=batchSize){
        const batch = sessionIds.slice(start, start + batchSize);
        const { data, error } = await sb.from("boss_participation")
          .select("session_id,owner,pseudo,team_id,team_snapshot").in("session_id", batch);
        if(error) throw error;
        memberships.push(...(data || []));
      }
      return memberships;
    },
    async listReports(){
      if(!sessionCourante.user || !sb) return [];
      const { data, error } = await sb.from("boss_run_reports")
        .select("*")
        .order("created_at", { ascending:false });
      if(error) throw error;
      return data || [];
    },
    async join(sessionId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("join_boss_run", { p_session_id:sessionId });
      if(error) throw error;
    },
    async leave(sessionId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("leave_boss_run", { p_session_id:sessionId });
      if(error) throw error;
    },
    async selectTeam(sessionId, teamId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("select_boss_team", {
        p_session_id:sessionId,
        p_team_id:teamId
      });
      if(error) throw error;
    },
    async complete(sessionId, globalScore, note){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("complete_boss_run_with_report", {
        p_session_id:sessionId,
        p_global_score:globalScore,
        p_note:note
      });
      if(error) throw error;
    },
    async updateReport(sessionId, globalScore, note){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("update_boss_run_report", {
        p_session_id:sessionId,
        p_global_score:globalScore,
        p_note:note
      });
      if(error) throw error;
    }
  };

  /* ---------- Mon suivi : cache hors ligne ----------
     Cloisonné par compte ET par semaine, versionné, et jamais utilisé pour
     accorder un droit ni pour envoyer une mutation. On ne cherche jamais « le
     dernier cache » : l'identité et la semaine doivent être connues d'abord. */
  const DASHBOARD_CACHE_PREFIX = "confrerie7ds.cloud.dashboard.";
  const DASHBOARD_CACHE_VERSION = 1;

  function dashboardCacheKey(userId, weekStart){
    return DASHBOARD_CACHE_PREFIX+userId+"."+weekStart;
  }

  function readDashboardCache(userId, weekStart){
    if(!userId || !weekStart) return null;
    try{
      const raw = localStorage.getItem(dashboardCacheKey(userId, weekStart));
      if(!raw) return null;
      const envelope = JSON.parse(raw);
      if(
        !envelope ||
        envelope.version !== DASHBOARD_CACHE_VERSION ||
        envelope.userId !== userId ||
        envelope.weekStart !== weekStart ||
        !envelope.state
      ) return null;
      return Object.assign({}, envelope.state, {
        offline:true,
        userId
      });
    }catch(error){
      return null;
    }
  }

  function writeDashboardCache(userId, state){
    if(!userId || !state || !state.weekStart) return;
    try{
      localStorage.setItem(
        dashboardCacheKey(userId, state.weekStart),
        JSON.stringify({
          version:DASHBOARD_CACHE_VERSION,
          userId,
          weekStart:state.weekStart,
          savedAt:Date.now(),
          state:Object.assign({}, state, { offline:false })
        })
      );
    }catch(error){
      // Un quota local indisponible ne doit jamais casser la vue en ligne.
    }
  }

  /* ---------- Mon suivi : store et rendu ----------
     Le store protège chaque lecture par une génération, l'identité du compte et
     la semaine attendue : une réponse lente ne remplace jamais un état plus
     récent, et une déconnexion ne réaffiche pas le compte précédent. */
  const DashboardStore = (function(){
    let issued = 0;
    let ownerId = "";
    let state = null;
    let dirty = true;

    function reset(userId){
      issued++;
      ownerId = userId || "";
      state = null;
      dirty = true;
    }

    function current(){
      return state;
    }

    function markDirty(){
      dirty = true;
    }

    function isDirty(){
      return dirty;
    }

    async function refresh(){
      const userId = sessionCourante.user?.id || "";
      if(!userId || !sb) throw new Error("AUTH_REQUIRED");
      if(ownerId !== userId) reset(userId);
      const requestId = ++issued;
      const weekStart = currentBossWeek().startDate;
      const isCurrent = () =>
        issued === requestId &&
        sessionCourante.user?.id === userId &&
        currentBossWeek().startDate === weekStart;

      try{
        return await load(requestId, userId, weekStart, isCurrent);
      }catch(error){
        // Une réponse périmée ne touche ni l'état, ni le cache, ni le DOM.
        if(!isCurrent()) return state;
        const cached = readDashboardCache(userId, weekStart);
        if(!cached) throw error;
        state = cached;
        return state;
      }
    }

    async function load(requestId, userId, weekStart, isCurrent){
      const teamsPromise = Store.refresh();
      /* Si une lecture Boss échoue avant le Promise.all, cette promesse reste
         pendante : on lui attache un puits pour éviter une rejection non gérée,
         sans consommer l'erreur que le Promise.all doit encore voir. */
      teamsPromise.catch(() => {});
      await BossStore.ensureWeek(currentBossWeek());
      const sessions = await BossStore.listWeek(weekStart);
      const sessionIds = sessions.map(session => session.id);
      const membershipPromise = BossStore.listMembership(sessionIds);
      // Une base sans les rapports de boss reste lisible : on dégrade au lieu
      // d'échouer, comme le fait déjà la vue Boss.
      const reportsPromise = BossStore.listReportsForSessions(sessionIds)
        .then(reports => ({ reports, reportsAvailable:true }))
        .catch(error => {
          if(isBossSchemaCompatibilityError(error)){
            return { reports:[], reportsAvailable:false };
          }
          throw error;
        });
      const [membership, reportResult, teams] = await Promise.all([
        membershipPromise,
        reportsPromise,
        teamsPromise
      ]);
      if(!isCurrent()) return state;
      state = Object.assign(buildDashboardState({
        userId,
        weekStart,
        sessions,
        membership,
        reports:reportResult.reports,
        teams,
        now:new Date(),
        lastSyncedAt:Date.now(),
        offline:false
      }), {
        userId,
        reportsAvailable:reportResult.reportsAvailable
      });
      dirty = false;
      writeDashboardCache(userId, state);
      return state;
    }

    return { current, refresh, reset, markDirty, isDirty };
  })();

  /* Une carte ouverte est un `.boss-card`, une archive un `.boss-report-card` :
     les deux portent `data-session-id`, donc une seule recherche suffit. */
  function dashboardBossCard(sessionId){
    return [...$("#bossBody").querySelectorAll("[data-session-id]")]
      .find(node => node.dataset.sessionId === sessionId) || null;
  }

  async function openDashboardBossTarget(sessionId, mode){
    const loaded = await showView("boss");
    if(!loaded){
      toast("Le groupe n’a pas pu être chargé.", true);
      return;
    }
    const group = (bossViewState.allGroups || [])
      .find(item => item.id === sessionId);
    if(!group){
      toast("Cette run n’est plus disponible.", true);
      return;
    }
    const card = dashboardBossCard(sessionId);
    if(card) card.scrollIntoView({ block:"center", behavior:"smooth" });

    if(mode === "choose-team"){
      const member = (bossViewState.membership || []).find(item =>
        item.session_id === sessionId &&
        item.owner === sessionCourante.user?.id
      );
      const trigger = card && card.querySelector('[data-boss-action="team"]');
      if(!member || group.status !== "open" || !trigger){
        toast("Cette run n’accepte plus de sélection d’équipe.", true);
        if(card) dashboardFocusCard(card);
        return;
      }
      trigger.focus();
      await openBossTeamPicker(group, member);
      return;
    }

    if(mode === "edit-report"){
      const trigger = card && card.querySelector(
        '[data-boss-action="report-edit"]'
      );
      const report = (bossViewState.reports || []).find(item =>
        item.session_id === sessionId
      );
      if(group.status !== "archived" || !report || !trigger){
        toast("Ce rapport n’est plus modifiable.", true);
        if(card) dashboardFocusCard(card);
        return;
      }
      trigger.focus();
      openBossReport(group, "edit");
      return;
    }

    if(card) dashboardFocusCard(card);
    else $("#tab-boss").focus();
  }

  function dashboardFocusCard(card){
    card.setAttribute("tabindex", "-1");
    card.focus();
  }

  async function runDashboardAction(action){
    if(!action) return;
    if(action.type === "choose-team" ||
       action.type === "view-group" ||
       action.type === "edit-report"){
      await openDashboardBossTarget(action.sessionId, action.type);
      return;
    }
    if(action.type === "create-team"){
      resetTeamDraft();
      await showView("builder");
      $("#builderTitle").focus();
      return;
    }
    if(action.type === "view-teams"){
      await showView("roster");
      $("#rosterTitle").focus();
      return;
    }
    if(action.type === "find-group"){
      const loaded = await showView("boss");
      if(!loaded) return;
      const target = $("#bossBody").querySelector(
        '.boss-card:not(.mine) .boss-join:not([disabled])'
      );
      (target || $("#tab-boss")).focus();
    }
  }

  function dashboardProgressCell(label, value, className){
    return el("div",{class:"dashboard-progress-cell "+className},[
      el("strong",{text:String(value)}),
      el("span",{text:label})
    ]);
  }

  const DASHBOARD_NETWORK_ACTIONS = [
    "choose-team",
    "view-group",
    "find-group",
    "edit-report"
  ];

  function dashboardActionButton(action){
    return el("button",{
      class:"btn "+(action.priority === 1 ? "btn-primary" : ""),
      type:"button",
      dataset:{
        dashboardAction:action.type,
        sessionId:action.sessionId || "",
        dashboardNetworkAction:DASHBOARD_NETWORK_ACTIONS.includes(action.type)
          ? "true"
          : "false"
      },
      text:action.label,
      onclick:()=>void runDashboardAction(action)
    });
  }

  function dashboardRunCard(group){
    const head = el("div",{class:"dashboard-card-head"},[
      el("strong",{text:group.title+" · Run "+group.runNo})
    ]);
    const card = el("div",{
      class:"dashboard-run-card",
      dataset:{ sessionId:group.id, status:group.status }
    },[head]);
    if(group.status === "open"){
      card.appendChild(el("p",{
        text:group.memberCount+"/5 joueurs"
      }));
      card.appendChild(el("p",{
        class:"dashboard-team-state",
        text:group.teamSelected ? "Équipe sélectionnée" : "Équipe manquante"
      }));
      /* Action secondaire : elle complète « Choisir mon équipe » sans la
         remplacer, et seulement si le membre possède déjà des équipes. */
      if(!group.teamSelected && group.hasOwnTeams){
        card.appendChild(dashboardActionButton({
          type:"view-teams",
          sessionId:null,
          slot:group.slot,
          runNo:group.runNo,
          label:"Voir mes équipes",
          priority:5
        }));
      }
      return card;
    }
    card.appendChild(el("p",{
      text:group.completedAt
        ? "Terminée le "+frDateTime(group.completedAt)
        : "Terminée"
    }));
    card.appendChild(el("p",{
      text:group.report
        ? formatBossScore(group.report.globalScore)+" points"
        : "Rapport non disponible pour cette ancienne run."
    }));
    return card;
  }

  function renderDashboardContent(state){
    const body = $("#dashboardBody");
    const blocks = [];

    const summary = el("section",{class:"dashboard-summary"},[
      el("div",{class:"dashboard-summary-head"},[
        el("strong",{text:"Runs engagées "+state.engaged+"/3"})
      ]),
      el("div",{class:"dashboard-progress"},[
        dashboardProgressCell("Terminées", state.completed, "is-done"),
        dashboardProgressCell("En cours", state.open, "is-open"),
        dashboardProgressCell("Encore disponibles", state.remaining, "is-left")
      ])
    ]);
    blocks.push(summary);

    if(state.reportsAvailable === false){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Maintenance des rapports de boss"}),
        el("p",{text:"Les scores ne sont pas lisibles pour le moment. Tes runs restent correctes."})
      ]));
    }

    if(state.offline){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Données potentiellement anciennes"}),
        el("p",{text:"Ces informations viennent du dernier suivi enregistré sur cet appareil."}),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Réessayer",
          onclick:()=>void renderDashboardView({ force:true })
        })
      ]));
    }

    if(state.actions.length){
      blocks.push(el("section",{class:"dashboard-actions-panel"},[
        el("strong",{text:"À faire maintenant"}),
        el("div",{class:"dashboard-action-list"},
          state.actions.map(action => el("div",{class:"dashboard-action-row"},[
            // Le libellé du groupe sert de contexte ; le bouton porte l'action.
            action.sessionId
              ? el("span",{text:"Groupe "+action.slot+" · Run "+action.runNo})
              : el("span",{text:"Tu peux encore engager une run"}),
            dashboardActionButton(action)
          ]))
        )
      ]));
    }

    const openGroups = state.groups
      .filter(group => group.status === "open")
      .map(group => Object.assign({}, group, {
        hasOwnTeams:state.hasOwnTeams
      }));
    if(openGroups.length){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Runs en cours"}),
        el("div",{class:"dashboard-run-grid"}, openGroups.map(dashboardRunCard))
      ]));
    }

    const doneGroups = state.groups.filter(group => group.status === "archived");
    if(doneGroups.length){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Runs terminées cette semaine"}),
        el("div",{class:"dashboard-run-grid"}, doneGroups.map(dashboardRunCard))
      ]));
    }

    blocks.push(el("section",{
      class:"dashboard-deadline",
      dataset:{ level:state.deadlineStatus.level }
    },[
      el("strong",{text:state.deadlineStatus.label})
    ]));

    body.replaceChildren(...blocks);
    if(state.offline){
      body.querySelectorAll('[data-dashboard-network-action="true"]')
        .forEach(button => {
          button.disabled = true;
          button.title = "Action indisponible hors ligne";
        });
    }
  }

  function renderDashboardSyncMeta(state){
    const meta = $("#dashboardSyncMeta");
    if(!state){
      meta.replaceChildren();
      return;
    }
    const stamp = state.lastSyncedAt
      ? "Dernière synchronisation "+frDateTime(
          new Date(state.lastSyncedAt).toISOString()
        )
      : "Dernière synchronisation inconnue";
    if(state.offline){
      meta.replaceChildren(
        el("span",{class:"dashboard-offline-badge",text:"Hors ligne"}),
        el("span",{text:stamp})
      );
      return;
    }
    meta.replaceChildren(el("span",{text:stamp}));
  }

  async function renderDashboardView(options){
    const settings = options || {};
    const body = $("#dashboardBody");
    if(!sessionCourante.user){
      $("#dashboardSyncMeta").replaceChildren();
      $("#dashboardStatus").textContent = "";
      body.replaceChildren(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour afficher ton suivi"}),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Connexion",
          onclick:()=>openAuth()
        })
      ]));
      return true;
    }
    /* Rouvrir un onglet propre ne relit pas le réseau : seul un marquage sale
       ou une demande explicite déclenche une nouvelle lecture. */
    const known = DashboardStore.current();
    if(known && !DashboardStore.isDirty() && settings.force !== true){
      renderDashboardSyncMeta(known);
      renderDashboardContent(known);
      return true;
    }
    if(settings.showLoading !== false){
      body.replaceChildren(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Chargement du suivi…"})
      ]));
    }
    $("#dashboardStatus").textContent = "Chargement du suivi";
    try{
      const state = await DashboardStore.refresh();
      if(!state) return true;
      renderDashboardSyncMeta(state);
      renderDashboardContent(state);
      $("#dashboardStatus").textContent = state.offline
        ? "Suivi hors ligne"
        : "Suivi actualisé";
      return !state.offline;
    }catch(error){
      // Aucun cache compatible : on ne montre jamais un faux 0/3.
      renderDashboardSyncMeta(null);
      body.replaceChildren(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Suivi indisponible hors ligne"}),
        el("p",{text:"Reconnecte-toi puis réessaie. Aucun compteur fiable n’est disponible."}),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Réessayer",
          onclick:()=>void renderDashboardView({ force:true })
        })
      ]));
      $("#dashboardStatus").textContent = "Suivi indisponible";
      return false;
    }
  }

  function bossStatCell(label, className, value){
    return el("div",{class:"boss-stat"},[
      el("span",{class:"boss-stat-label",text:label}),
      el("span",{class:"boss-stat-value "+className,text:value})
    ]);
  }

  function bossStatsBlock(groups, reports, weekStart){
    const current = bossStatsForWeek(groups, reports, weekStart);
    const previous = bossStatsForWeek(
      groups,
      reports,
      previousBossWeekStart(weekStart)
    );
    const head = el("div",{class:"boss-stats-head"},[
      el("h2",{
        class:"boss-stats-title",
        id:"bossStatsTitle",
        text:"Statistiques de la semaine"
      })
    ]);
    if(current.average !== null && previous.average !== null){
      const difference = current.average - previous.average;
      const sign = difference > 0n ? "+" : (difference < 0n ? "−" : "");
      const absolute = difference < 0n ? -difference : difference;
      const percentage = bossEvolutionPercentage(
        difference,
        previous.average
      );
      head.appendChild(el("span",{
        class:"boss-stat-evolution",
        text:sign+formatBossScore(absolute)+" ("+percentage+")"+
          " par rapport à la semaine précédente"
      }));
    }
    const latestScore = current.latest
      ? bossScoreBigInt(current.latest.global_score)
      : null;
    return el("section",{
      class:"boss-stats",
      "aria-labelledby":"bossStatsTitle"
    },[
      head,
      el("div",{class:"boss-stats-grid"},[
        bossStatCell("Rapports", "boss-stat-count", String(current.count)),
        bossStatCell(
          "Meilleur score",
          "boss-stat-best",
          current.best === null ? "—" : formatBossScore(current.best)
        ),
        bossStatCell(
          "Score moyen",
          "boss-stat-average",
          current.average === null ? "—" : formatBossScore(current.average)
        ),
        bossStatCell(
          "Dernier score",
          "boss-stat-latest",
          latestScore === null ? "—" : formatBossScore(latestScore)
        )
      ])
    ]);
  }

  function focusedBossActionIdentity(){
    const body = $("#bossBody");
    const active = document.activeElement;
    if(!active || !body.contains(active)) return null;
    const session = active.closest("[data-session-id]");
    const action = active.dataset.bossAction;
    return session && action
      ? { sessionId:session.dataset.sessionId, action }
      : null;
  }

  function restoreBossActionFocus(identity){
    if(!identity) return;
    const target = [...$("#bossBody").querySelectorAll("[data-boss-action]")]
      .find(node => {
        const session = node.closest("[data-session-id]");
        return node.dataset.bossAction === identity.action &&
          session?.dataset.sessionId === identity.sessionId;
      });
    if(target && target.getClientRects().length) target.focus();
  }

  function renderBossContent(){
    const focusedAction = focusedBossActionIdentity();
    const body = $("#bossBody");
    const week = bossViewState.week || currentBossWeek();
    const allGroups = bossViewState.allGroups || [];
    const membership = bossVisibleMembership();
    const reports = bossViewState.reports || [];

    const weekGroups = allGroups.filter(g => g.week_start === week.startDate);
    const current = weekGroups
      .filter(g => g.status === "open")
      .sort((a,b)=>(a.slot||0)-(b.slot||0));
    const completedCurrent = weekGroups
      .filter(g => g.status === "archived")
      .sort((a,b)=>(b.completed_at||"").localeCompare(a.completed_at||""));
    const past = allGroups.filter(g => g.week_start && g.week_start !== week.startDate);
    const currentSessionIds = new Set(weekGroups.map(g => g.id));
    const myCount = membership.filter(m =>
      m.owner === sessionCourante.user.id && currentSessionIds.has(m.session_id)
    ).length;

    body.className = ""; body.innerHTML = "";
    $("#bossCount").innerHTML =
      "<b>"+myCount+"/3</b> runs réservés ou terminés";

    body.appendChild(el("div",{class:"boss-weekhead"},[
      el("div",{class:"boss-weekboss", text:BOSS_NAME}),
      el("div",{class:"boss-weeksub", text:"Semaine du "+frDate(week.startDate)+" au "+frDate(week.endDate)+" · reset lundi 9h"})
    ]));
    body.appendChild(bossStatsBlock(allGroups, reports, week.startDate));

    if(!current.length){
      body.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Groupes en préparation…"}),
        el("p",{text:"Recharge la page dans un instant."})
      ]));
    }else{
      const grid = el("div",{class:"boss-grid"});
      current.forEach(g => grid.appendChild(bossGroupCard(g, membership, myCount)));
      body.appendChild(grid);
    }

    if(completedCurrent.length){
      const currentArchive = el("details",{
        class:"boss-archive boss-archive-current",
        open:true
      });
      currentArchive.appendChild(el("summary",{
        text:"Runs terminées cette semaine ("+completedCurrent.length+")"
      }));
      currentArchive.appendChild(
        bossArchiveRows(completedCurrent, membership, reports)
      );
      body.appendChild(currentArchive);
    }
    if(past.length) body.appendChild(bossArchive(past, membership, reports));
    restoreBossActionFocus(focusedAction);
  }

  function renderBossUnavailableState(){
    invalidateBossRenders();
    bossViewState = emptyBossViewState(sessionCourante.user?.id);
    $("#bossCount").textContent = "";
    const body = $("#bossBody");
    body.className = "";
    body.innerHTML = "";
    const retry = el("button",{
      class:"btn btn-primary",
      type:"button",
      text:"Réessayer",
      onclick:()=>void renderBossView()
    });
    body.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Groupes indisponibles"}),
      el("p",{text:"Impossible d’actualiser les groupes pour le moment."}),
      retry
    ]));
    return retry;
  }

  function renderBossCompatibilityState(){
    invalidateBossRenders();
    bossViewState = emptyBossViewState(sessionCourante.user?.id);
    $("#bossCount").textContent = "";
    const body = $("#bossBody");
    body.className = "";
    body.innerHTML = "";
    const retry = el("button",{
      class:"btn btn-primary",
      type:"button",
      text:"Réessayer",
      onclick:()=>void renderBossView()
    });
    body.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Maintenance des rapports de boss"}),
      el("p",{text:BOSS_SCHEMA_MAINTENANCE_MESSAGE}),
      retry
    ]));
    return retry;
  }

  async function renderBossView(options){
    const settings = Object.assign({
      showLoading:true,
      ensureWeek:true,
      showErrorToast:true
    }, options || {});
    const body = $("#bossBody");
    ensureBossViewOwner();
    const renderUserId = sessionCourante.user?.id || "";
    const renderId = ++bossRenderIssuedId;
    const isCurrentRender = () =>
      renderId === bossRenderIssuedId &&
      sessionCourante.user?.id === renderUserId;

    if(!renderUserId){
      $("#bossCount").textContent = "";
      body.className = "";
      body.innerHTML = "";
      body.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour les groupes de boss"}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return true;
    }
    if(settings.showLoading || !bossViewState.ready){
      body.className = "";
      body.innerHTML = "";
      body.appendChild(el("div",{class:"empty-state"},[el("p",{class:"big",text:"Chargement…"})]));
    }

    const week = currentBossWeek();
    try{
      if(settings.ensureWeek) await BossStore.ensureWeek(week);
      const allGroups = await BossStore.listAll();
      const [membership, reports] = await Promise.all([
        BossStore.listMembership(allGroups.map(group => group.id)),
        BossStore.listReports()
      ]);
      if(!isCurrentRender()) return true;
      bossRenderAppliedId = renderId;
      bossViewState = {
        userId:renderUserId,
        week,
        allGroups,
        membership,
        reports,
        ready:true
      };
      renderBossContent();
      reconcileOpenBossReport();
      return true;
    }catch(error){
      if(!isCurrentRender()) return true;
      if(isBossSchemaCompatibilityError(error)){
        if(settings.showErrorToast){
          toast(BOSS_SCHEMA_MAINTENANCE_MESSAGE, true);
        }
        renderBossCompatibilityState();
        return false;
      }
      if(settings.showErrorToast) toast("Groupes indisponibles.", true);
      if(bossViewState.ready){
        renderBossContent();
      }else{
        $("#bossCount").textContent = "";
        body.className = "";
        body.innerHTML = "";
        body.appendChild(el("div",{class:"empty-state"},[
          el("p",{class:"big",text:"Groupes indisponibles"}),
          el("p",{text:"Impossible de charger les groupes pour le moment."}),
          el("button",{
            class:"btn btn-primary",
            type:"button",
            text:"Réessayer",
            onclick:()=>void renderBossView()
          })
        ]));
      }
      return false;
    }
  }

  function bossActionMessage(error){
    const message = String(error && error.message || "");
    if(isBossSchemaCompatibilityError(error)){
      return BOSS_SCHEMA_MAINTENANCE_MESSAGE;
    }
    if(message.includes("RUN_INVALID_WEEK")) return "La semaine de boss a changé. La liste a été actualisée.";
    if(message.includes("AUTH_REQUIRED")) return "Ta session a expiré. Reconnecte-toi pour continuer.";
    if(message.includes("RUN_LIMIT_REACHED")) return "Tes 3 runs de la semaine sont déjà réservés ou terminés.";
    if(message.includes("GROUP_FULL")) return "Ce groupe est déjà complet (5/5).";
    if(message.includes("TEAM_NOT_OWNED")) return "Cette équipe ne t’appartient plus. Actualise tes équipes puis choisis-en une autre.";
    if(message.includes("NOT_A_PARTICIPANT")) return "Seuls les participants peuvent effectuer cette action.";
    if(message.includes("RUN_ARCHIVED")) return "Cette run vient d’être terminée. La liste a été actualisée.";
    if(message.includes("RUN_MEMBERS_ONLY")) return "Seuls les membres de ce groupe peuvent terminer la run.";
    if(message.includes("RUN_NOT_FOUND")) return "Cette run n’existe plus. La liste a été actualisée.";
    return authMessage(error);
  }

  async function changeBossMembership(group, mine){
    const actionUserId = sessionCourante.user?.id;
    if(!actionUserId || bossPendingActions.has(group.id)) return;
    const intent = mine
      ? { type:"leave", member:null }
      : {
          type:"join",
          member:{
            session_id:group.id,
            owner:actionUserId,
            pseudo:sessionCourante.pseudo || "Membre",
            team_id:null,
            team_snapshot:null
          }
        };
    const isCurrentAction = () =>
      sessionCourante.user?.id === actionUserId &&
      bossViewState.userId === actionUserId &&
      bossPendingActions.get(group.id) === intent;
    bossPendingActions.set(group.id, intent);
    renderBossContent();

    try{
      mine
        ? await BossStore.leave(group.id)
        : await BossStore.join(group.id);
      if(!isCurrentAction()) return;
      invalidateBossRenders();
      bossViewState.membership = bossApplyIntent(
        bossViewState.membership,
        group.id,
        intent
      );
      bossPendingActions.delete(group.id);
      renderBossContent();
    }catch(error){
      if(!isCurrentAction()) return;
      bossPendingActions.delete(group.id);
      renderBossContent();
      toast("Action impossible : "+bossActionMessage(error), true);
      void renderBossView({
        showLoading:false,
        ensureWeek:true,
        showErrorToast:false
      });
    }
  }

  function teamFromBossSnapshot(snapshot){
    if(!snapshot || typeof snapshot !== "object") return null;
    return normalizeTeam(Object.assign({}, snapshot.data || {}, {
      id:snapshot.id || snapshot.teamId || "",
      pseudo:snapshot.pseudo || ""
    }));
  }

  function bossTeamBanner(team){
    const banner = el("span",{class:"boss-team-banner"});
    (team.heroes || []).forEach(hero => {
      const character = hero && hero.char ? charOf(hero.char) : null;
      const portrait = el("span",{class:"boss-team-banner-portrait"});
      if(character){
        portrait.appendChild(el("img",{
          src:character.file,
          alt:"",
          loading:"lazy"
        }));
      }else{
        portrait.textContent = "—";
      }
      banner.appendChild(el("span",{class:"boss-team-banner-hero"},[
        portrait,
        el("span",{
          class:"boss-team-banner-name",
          text:character ? character.name : "Libre"
        })
      ]));
    });
    return banner;
  }

  let bossTeamPickerRequestId = 0;
  let bossTeamPickerPendingRequestId = null;
  let bossTeamPickerContext = null;

  function isBossTeamPickerCurrent(requestId){
    return !!bossTeamPickerContext &&
      bossTeamPickerContext.requestId === requestId &&
      requestId === bossTeamPickerRequestId &&
      bossTeamPickerContext.ownerVersion === bossViewOwnerVersion &&
      sessionCourante.user?.id === bossTeamPickerContext.userId;
  }

  function closeBossTeamPicker(){
    bossTeamPickerRequestId++;
    bossTeamPickerPendingRequestId = null;
    bossTeamPickerContext = null;
    ModalStack.close($("#bossTeamOverlay"));
  }

  function setBossTeamPickerPending(requestId, pending, activeChoice){
    if(!isBossTeamPickerCurrent(requestId)) return;
    bossTeamPickerPendingRequestId = pending ? requestId : null;
    $("#bossTeamList").querySelectorAll(".boss-team-choice").forEach(choice => {
      choice.disabled = pending;
      choice.removeAttribute("aria-busy");
    });
    if(pending && activeChoice){
      activeChoice.setAttribute("aria-busy", "true");
    }
  }

  function bossTeamPickerEmpty(list){
    list.appendChild(el("div",{class:"boss-team-empty"},[
      el("p",{
        text:"Crée d’abord une équipe dans le Team Builder pour la déclarer sur cette run."
      }),
      el("button",{
        class:"btn btn-primary",
        type:"button",
        text:"Créer une équipe",
        onclick:()=>{
          closeBossTeamPicker();
          showView("builder");
          const tab = mainTabs.find(button => button.dataset.view === "builder");
          if(tab) tab.focus();
        }
      })
    ]));
  }

  function bossTeamPickerTeams(list, teams, group, requestId){
    list.innerHTML = "";
    if(teams.length){
      teams.forEach(team =>
        list.appendChild(bossTeamChoice(team, group, requestId))
      );
    }else{
      bossTeamPickerEmpty(list);
    }
  }

  function bossTeamActionFor(sessionId){
    const card = [...document.querySelectorAll(".boss-card")]
      .find(item => item.dataset.sessionId === sessionId);
    return card
      ? card.querySelector(".boss-member-team-action, .boss-join")
      : mainTabs.find(button => button.dataset.view === "boss");
  }

  function bossTeamChoice(team, group, requestId){
    const pickerUserId = bossTeamPickerContext?.userId;
    const pickerOwnerVersion = bossTeamPickerContext?.ownerVersion;
    const heroes = el("span",{class:"boss-team-choice-heroes"});
    (team.heroes || []).forEach(hero => {
      const character = hero && hero.char ? charOf(hero.char) : null;
      const portrait = el("span",{class:"boss-team-choice-portrait"});
      if(character){
        portrait.appendChild(el("img",{
          src:character.file,
          alt:"",
          loading:"lazy"
        }));
      }else{
        portrait.textContent = "—";
      }
      heroes.appendChild(el("span",{class:"boss-team-choice-hero"},[
        portrait,
        el("span",{
          class:"boss-team-choice-name",
          text:character ? character.name : "Libre"
        })
      ]));
    });

    const choice = el("button",{
      class:"boss-team-choice",
      type:"button",
      onclick:async()=>{
        if(
          choice.disabled ||
          bossTeamPickerPendingRequestId !== null ||
          !isBossTeamPickerCurrent(requestId)
        ) return;
        setBossTeamPickerPending(requestId, true, choice);
        try{
          await BossStore.selectTeam(group.id, team.id);
          if(!isBossTeamPickerCurrent(requestId)) return;
          const refreshed = await renderBossView({
            showLoading:false,
            ensureWeek:false,
            showErrorToast:false
          });
          if(!isBossTeamPickerCurrent(requestId)) return;
          const restoreTarget = refreshed
            ? bossTeamActionFor(group.id)
            : renderBossUnavailableState();
          closeModalAfterAsyncRefresh(
            $("#bossTeamOverlay"),
            closeBossTeamPicker,
            restoreTarget
          );
          if(!refreshed){
            toast(
              "Équipe sélectionnée, mais les groupes n’ont pas pu être actualisés.",
              true
            );
          }
        }catch(error){
          if(!isBossTeamPickerCurrent(requestId)) return;
          const message = String(error && error.message || "");
          const mustReconcile = [
            "TEAM_NOT_OWNED",
            "NOT_A_PARTICIPANT",
            "RUN_ARCHIVED"
          ].some(code => message.includes(code));
          if(mustReconcile){
            const [teamsResult, bossResult] = await Promise.allSettled([
              Store.refresh(),
              renderBossView({
                showLoading:false,
                ensureWeek:false,
                showErrorToast:false
              })
            ]);
            const pickerIsCurrent = isBossTeamPickerCurrent(requestId);
            const bossRefreshed = bossResult.status === "fulfilled"
              && bossResult.value === true;
            if(!bossRefreshed){
              if(
                !pickerIsCurrent &&
                (
                  sessionCourante.user?.id !== pickerUserId ||
                  bossViewOwnerVersion !== pickerOwnerVersion ||
                  bossTeamPickerContext !== null
                )
              ) return;
              const retry = renderBossUnavailableState();
              if(pickerIsCurrent){
                ModalStack.setRestoreFocus($("#bossTeamOverlay"), retry);
                closeBossTeamPicker();
                toast("Équipe non sélectionnée : "+bossActionMessage(error), true);
              }else{
                const active = document.activeElement;
                const focusWasLost = !active
                  || !active.isConnected
                  || active === document.body
                  || active === document.documentElement;
                if(focusWasLost) retry.focus();
              }
              return;
            }
            if(!pickerIsCurrent) return;
            const currentGroup = (bossViewState.allGroups || [])
              .find(item => item.id === group.id);
            const currentMembership = (bossViewState.membership || [])
              .find(item =>
                item.session_id === group.id &&
                item.owner === sessionCourante.user?.id
              );
            const refreshedTrigger = bossTeamActionFor(group.id);
            ModalStack.setRestoreFocus(
              $("#bossTeamOverlay"),
              refreshedTrigger
            );
            if(!currentGroup || currentGroup.status !== "open" || !currentMembership){
              closeBossTeamPicker();
            }else if(teamsResult.status === "fulfilled"){
              bossTeamPickerPendingRequestId = null;
              const teams = teamsResult.value
                .filter(item => item.owner === sessionCourante.user.id)
                .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
              bossTeamPickerTeams(
                $("#bossTeamList"),
                teams,
                group,
                requestId
              );
              const target = $("#bossTeamList").querySelector(
                teams.length ? ".boss-team-choice" : ".btn"
              );
              if(target) target.focus();
            }else{
              const list = $("#bossTeamList");
              list.innerHTML = "";
              list.appendChild(el("div",{class:"boss-team-empty"},[
                el("p",{
                  text:"Tes équipes n’ont pas pu être actualisées. Ferme cette fenêtre puis réessaie."
                })
              ]));
            }
            toast("Équipe non sélectionnée : "+bossActionMessage(error), true);
            return;
          }
          setBossTeamPickerPending(requestId, false);
          toast("Équipe non sélectionnée : "+bossActionMessage(error), true);
        }
      }
    },[
      // Le nom est la raison d'être de ce champ : c'est ici qu'on distinguait
      // mal deux compos partageant trois héros sur quatre.
      el("span",{
        class:"boss-team-choice-title",
        text:team.name || "Équipe sans nom"
      }),
      heroes,
      el("span",{
        class:"boss-team-choice-date",
        text:"Modifiée le "+frDateTime(team.updatedAt)
      })
    ]);
    return choice;
  }

  async function openBossTeamPicker(group, member){
    const userId = sessionCourante.user && sessionCourante.user.id;
    if(!userId || !member || member.owner !== userId) return;
    const restoreFocus = document.activeElement;
    const requestId = ++bossTeamPickerRequestId;
    bossTeamPickerPendingRequestId = null;
    bossTeamPickerContext = {
      requestId,
      userId,
      ownerVersion:bossViewOwnerVersion,
      groupId:group.id
    };
    const overlay = $("#bossTeamOverlay");
    const list = $("#bossTeamList");
    try{
      const teams = (await Store.refresh())
        .filter(team => team.owner === userId)
        .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      if(!isBossTeamPickerCurrent(requestId)) return;
      bossTeamPickerTeams(list, teams, group, requestId);
      if(overlay.classList.contains("on")){
        const target = list.querySelector(teams.length ? ".boss-team-choice" : ".btn");
        if(target) target.focus();
      }else{
        ModalStack.open(
          overlay,
          teams.length ? ".boss-team-choice" : "#bossTeamList .btn",
          closeBossTeamPicker,
          restoreFocus
        );
      }
    }catch(error){
      if(!isBossTeamPickerCurrent(requestId)) return;
      list.innerHTML = "";
      list.appendChild(el("div",{class:"boss-team-empty"},[
        el("p",{
          text:"Tes équipes n’ont pas pu être chargées. Vérifie ta connexion puis réessaie."
        }),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Réessayer",
          onclick:()=>void openBossTeamPicker(group, member)
        })
      ]));
      ModalStack.open(
        overlay,
        "#bossTeamList .btn",
        closeBossTeamPicker,
        restoreFocus
      );
      toast("Équipes indisponibles : "+authMessage(error), true);
    }
  }

  $("#bossTeamClose").addEventListener("click", closeBossTeamPicker);
  $("#bossTeamOverlay").addEventListener("click", event => {
    if(event.target === $("#bossTeamOverlay")) closeBossTeamPicker();
  });

  const SCORE_RE = /^[1-9]\d*$/;
  let bossReportRequestId = 0;
  let bossReportContext = null;

  function validBossScore(value){
    const text = String(value || "").trim();
    if(!SCORE_RE.test(text)) return false;
    try{
      const score = BigInt(text);
      return score > 0n && score <= BigInt(Number.MAX_SAFE_INTEGER);
    }catch(error){
      return false;
    }
  }

  function bossReportMembers(group){
    return (bossViewState.membership || [])
      .filter(member => member.session_id === group.id);
  }

  function bossMissingTeamMessage(members){
    const missing = members.filter(member => !member.team_snapshot);
    if(!missing.length) return "";
    const names = missing.map(member => member.pseudo || "Membre").join(", ");
    return "Chaque membre doit choisir une équipe avant de terminer la run : "+names+".";
  }

  function bossOverCapacityMessage(members){
    return members.length > 5
      ? "Groupe au-dessus de la nouvelle limite"
      : "";
  }

  function bossReportActionMessage(error, mode){
    const message = String(error && error.message || "");
    if(isBossSchemaCompatibilityError(error)){
      return BOSS_SCHEMA_MAINTENANCE_MESSAGE;
    }
    if(message.includes("RUN_INVALID_WEEK")){
      return "La semaine de boss a changé. La liste a été actualisée.";
    }
    if(message.includes("REPORT_REQUIRED")){
      return "Une mise à jour du site est nécessaire pour terminer cette run.";
    }
    if(message.includes("TEAM_REQUIRED")){
      const names = message.split("TEAM_REQUIRED:")[1];
      return "Chaque membre doit choisir une équipe avant de terminer la run"+
        (names ? " : "+names : "")+".";
    }
    if(message.includes("INVALID_SCORE")){
      return "Saisis un score entier supérieur à zéro.";
    }
    if(message.includes("NOTE_TOO_LONG")){
      return "La note doit contenir 1 000 caractères maximum.";
    }
    if(message.includes("GROUP_OVER_CAPACITY")){
      return "Des membres doivent quitter ce groupe pour revenir à 5 joueurs.";
    }
    if(message.includes("RUN_ARCHIVED")){
      return "Cette run est déjà terminée. Ferme ce rapport puis actualise la liste.";
    }
    if(message.includes("RUN_NOT_ARCHIVED")){
      return "Cette run n’est pas archivée. Ferme ce rapport puis actualise la liste.";
    }
    if(message.includes("NOT_A_PARTICIPANT")){
      return "Seuls les participants peuvent effectuer cette action.";
    }
    if(message.includes("REPORT_NOT_FOUND")){
      return "Aucun rapport modifiable n’existe pour cette run.";
    }
    if(message.includes("RUN_NOT_FOUND")){
      return "Cette run n’existe plus. Ferme cette fenêtre puis actualise la liste.";
    }
    if(message.includes("AUTH_REQUIRED")){
      return "Ta session a expiré. Reconnecte-toi avant de réessayer.";
    }
    return mode === "edit"
      ? "La correction n’a pas été enregistrée. Vérifie ta connexion puis réessaie."
      : "Le rapport n’a pas été enregistré. Vérifie ta connexion puis réessaie.";
  }

  function renderBossReportMembers(context){
    const box = $("#bossReportMembers");
    box.innerHTML = "";
    context.members.forEach(member => {
      const ready = !!member.team_snapshot;
      box.appendChild(el("div",{class:"boss-report-member"},[
        el("span",{
          class:"boss-report-member-name",
          text:member.pseudo || "Membre"
        }),
        el("span",{
          class:"boss-report-member-state"+(ready?"":" missing"),
          text:ready ? "Équipe prête" : "Équipe à choisir"
        })
      ]));
    });
  }

  function updateBossReportForm(clearError, scoreChanged){
    const context = bossReportContext;
    if(!context) return;
    if(scoreChanged){
      context.error = "";
      context.serverInvalidScore = false;
    }else if(clearError && !context.serverInvalidScore){
      context.error = "";
    }
    const scoreValue = $("#bossScore").value;
    const overCapacityMessage = bossOverCapacityMessage(context.members);
    const missingMessage = bossMissingTeamMessage(context.members);
    const validScore = validBossScore(scoreValue);
    const scoreMessage = validScore
      ? ""
      : "Saisis un score entier supérieur à zéro.";
    $("#bossScore").setAttribute(
      "aria-invalid",
      String(!validScore || context.serverInvalidScore)
    );
    const noteLength = $("#bossReportNote").value.length;
    $("#bossReportCount").textContent = noteLength+"/1000";
    if(noteLength >= 900){
      $("#bossReportCount").setAttribute("aria-live", "polite");
    }else{
      $("#bossReportCount").removeAttribute("aria-live");
    }
    $("#bossReportError").textContent =
      context.error || overCapacityMessage || missingMessage || scoreMessage;
    $("#bossReportSubmit").disabled =
      context.pending || !validScore || context.serverInvalidScore ||
      !!overCapacityMessage || !!missingMessage;
    $("#bossReportSubmit").setAttribute(
      "aria-busy",
      context.pending ? "true" : "false"
    );
  }

  function closeBossReport(){
    bossReportRequestId++;
    bossReportContext = null;
    ModalStack.close($("#bossReportOverlay"));
  }

  function bossReportResultTarget(group, mode){
    let target = null;
    if(mode === "edit"){
      const reportCard = [...document.querySelectorAll(".boss-report-card")]
        .find(card => card.dataset.sessionId === group.id);
      target = reportCard && reportCard.querySelector(".boss-report-edit");
    }else{
      const next = (bossViewState.allGroups || [])
        .filter(item => item.status === "open" && item.slot === group.slot)
        .sort((a,b)=>(b.run_no||1)-(a.run_no||1))[0];
      const nextCard = next && [...document.querySelectorAll(".boss-card")]
        .find(card => card.dataset.sessionId === next.id);
      target = nextCard && nextCard.querySelector(".boss-join");
    }
    if(!target){
      target = mainTabs.find(button => button.dataset.view === "boss");
    }
    return target;
  }

  function focusBossReportResult(group, mode){
    const target = bossReportResultTarget(group, mode);
    if(target && target.focus) target.focus();
  }

  function reconcileOpenBossReport(){
    const context = bossReportContext;
    if(!context) return;
    if(context.userId !== sessionCourante.user?.id){
      closeBossReport();
      return;
    }
    const group = (bossViewState.allGroups || [])
      .find(item => item.id === context.group.id);
    const members = group ? bossReportMembers(group) : [];
    const report = (bossViewState.reports || [])
      .find(item => item.session_id === context.group.id) || null;
    const mine = members.some(member => member.owner === context.userId);
    const remainsValid = context.mode === "edit"
      ? !!group && group.status === "archived" && !!report && mine
      : !!group && group.status === "open" && mine;

    if(!remainsValid){
      closeModalAfterAsyncRefresh(
        $("#bossReportOverlay"),
        closeBossReport,
        bossReportResultTarget(context.group, context.mode)
      );
      return;
    }

    context.group = group;
    context.members = members;
    context.report = report;
    renderBossReportMembers(context);
    updateBossReportForm(false);
  }

  function openBossReport(group, mode){
    const selectedMode = mode === "edit" ? "edit" : "complete";
    const members = bossReportMembers(group);
    const report = (bossViewState.reports || [])
      .find(item => item.session_id === group.id) || null;
    const mine = members.some(member => member.owner === sessionCourante.user?.id);
    if(!mine || (selectedMode === "edit" && !report)) return;

    const context = {
      requestId:++bossReportRequestId,
      userId:sessionCourante.user.id,
      group,
      mode:selectedMode,
      members,
      report,
      pending:false,
      serverInvalidScore:false,
      error:""
    };
    bossReportContext = context;
    $("#bossReportTitle").textContent =
      selectedMode === "edit" ? "Corriger le rapport" : "Terminer la run";
    $("#bossReportSubmit").textContent = selectedMode === "edit"
      ? "Enregistrer la correction"
      : "Enregistrer et terminer la run";
    $("#bossScore").value = report ? String(report.global_score) : "";
    $("#bossReportNote").value = report ? String(report.note || "") : "";
    renderBossReportMembers(context);
    updateBossReportForm(false);
    ModalStack.open(
      $("#bossReportOverlay"),
      "#bossScore",
      closeBossReport
    );
  }

  async function submitBossReport(){
    const context = bossReportContext;
    if(!context || context.pending) return;
    const score = $("#bossScore").value.trim();
    const note = $("#bossReportNote").value;
    const missingMessage = bossMissingTeamMessage(context.members);
    if(!validBossScore(score) || missingMessage) return;

    context.pending = true;
    context.error = "";
    updateBossReportForm(false);
    const submission = {
      requestId:context.requestId,
      userId:context.userId,
      group:context.group,
      mode:context.mode,
      score,
      note
    };
    const isCurrent = () =>
      bossReportContext === context &&
      context.requestId === submission.requestId &&
      sessionCourante.user?.id === submission.userId;

    try{
      if(submission.mode === "edit"){
        await BossStore.updateReport(
          submission.group.id,
          submission.score,
          submission.note
        );
      }else{
        await BossStore.complete(
          submission.group.id,
          submission.score,
          submission.note
        );
      }
      const restoreFocus = isCurrent();
      if(restoreFocus) closeBossReport();
      invalidateBossRenders();
      await renderBossView({
        showLoading:false,
        ensureWeek:false,
        showErrorToast:true
      });
      const active = document.activeElement;
      const focusWasLost = !active ||
        !active.isConnected ||
        active === document.body ||
        active === document.documentElement;
      if(restoreFocus || focusWasLost){
        focusBossReportResult(submission.group, submission.mode);
      }
    }catch(error){
      if(!isCurrent()) return;
      const errorCode = String(error && error.message || "");
      const actionMessage = bossReportActionMessage(error, context.mode);
      if(errorCode.includes("RUN_INVALID_WEEK")){
        const actionUserId = submission.userId;
        closeBossReport();
        toast(actionMessage, true);
        const refreshed = await renderBossView({
          showLoading:false,
          ensureWeek:true,
          showErrorToast:false
        });
        if(sessionCourante.user?.id !== actionUserId) return;
        if(!refreshed){
          const retry = renderBossUnavailableState();
          retry.focus();
          return;
        }
        focusBossReportResult(submission.group, submission.mode);
        return;
      }
      context.pending = false;
      context.serverInvalidScore = errorCode.includes("INVALID_SCORE");
      context.error = actionMessage;
      updateBossReportForm(false);
      $("#bossReportError").focus?.();
    }
  }

  $("#bossScore").addEventListener(
    "input",
    ()=>updateBossReportForm(true, true)
  );
  $("#bossReportNote").addEventListener(
    "input",
    ()=>updateBossReportForm(true, false)
  );
  $("#bossReportSubmit").addEventListener("click", ()=>void submitBossReport());
  $("#bossReportClose").addEventListener("click", closeBossReport);
  $("#bossReportOverlay").addEventListener("click", event => {
    if(event.target === $("#bossReportOverlay")) closeBossReport();
  });

  function bossGroupCard(g, membership, myCount){
    const members = membership.filter(m => m.session_id === g.id);
    const mine = members.some(m => m.owner === sessionCourante.user.id);
    const pending = bossPendingActions.has(g.id);
    const overCapacity = members.length > 5;
    const list = el("div",{class:"boss-members"});
    if(overCapacity){
      list.appendChild(el("p",{
        class:"boss-over-capacity",
        role:"status",
        text:"Groupe au-dessus de la nouvelle limite"
      }));
    }
    if(members.length){
      members.forEach(member => {
        const isMe = member.owner === sessionCourante.user.id;
        const team = teamFromBossSnapshot(member.team_snapshot);
        const row = el("div",{class:"boss-member"+(isMe?" me":"")},[
          el("div",{class:"boss-member-head"},[
            el("span",{class:"boss-member-name",text:member.pseudo||"Membre"}),
            el("span",{
              class:"boss-team-state"+(team?" ready":""),
              text:team ? "Équipe prête" : "Équipe manquante"
            })
          ])
        ]);
        if(isMe && team){
          row.appendChild(el("button",{
            class:"boss-member-team-preview",
            type:"button",
            dataset:{bossAction:"team-preview"},
            "aria-label":"Voir l’équipe de "+(member.pseudo||"Membre"),
            onclick:()=>openTeamDetail(team)
          },[
            bossTeamBanner(team)
          ]));
        }
        if(isMe){
          row.appendChild(el("button",{
            class:"btn boss-member-team-action",
            type:"button",
            dataset:{bossAction:"team"},
            text:team ? "Changer" : "Choisir mon équipe",
            onclick:()=>void openBossTeamPicker(g, member)
          }));
        }
        list.appendChild(row);
      });
    }else{
      list.appendChild(el("span",{
        class:"boss-none",
        text:"Personne pour l'instant"
      }));
    }

    const joinButton = el("button",{
      class:"btn "+(mine?"btn-danger":"btn-primary")+" boss-join",
      type:"button",
      dataset:{bossAction:"membership"},
      text:pending ? "Synchronisation…" : (mine ? "Quitter" : "Rejoindre"),
      title:!mine && members.length >= 5
        ? "Groupe complet : 5/5"
        : (!mine && myCount >= 3 ? "Limite hebdomadaire atteinte : 3/3" : ""),
      onclick:()=>void changeBossMembership(g, mine)
    });
    joinButton.disabled = pending || (!mine && (myCount >= 3 || members.length >= 5));

    const completeButton = mine ? el("button",{
      class:"btn btn-secondary boss-complete",
      type:"button",
      dataset:{bossAction:"complete"},
      text:"Run terminée",
      onclick:()=>openBossReport(g, "complete")
    }) : null;
    if(completeButton) completeButton.disabled = pending || overCapacity;

    const actions = el("div",{class:"boss-actions"},[
      joinButton,
      ...(completeButton ? [completeButton] : [])
    ]);

    return el("div",{
      class:"boss-card"+(mine?" mine":""),
      dataset:{sessionId:g.id}
    },[
      el("div",{class:"boss-card-head"},[
        el("span",{
          class:"boss-card-title",
          text:g.title+" · Run "+(g.run_no||1)
        }),
        el("span",{
          class:"boss-membercount",
          text:members.length+"/5 joueurs"
        })
      ]),
      list,
      actions
    ]);
  }

  function bossReportParticipant(member){
    const team = teamFromBossSnapshot(member.team_snapshot);
    const row = el("div",{class:"boss-report-participant"},[
      el("span",{
        class:"boss-report-participant-name",
        text:member.pseudo || "Membre"
      })
    ]);
    if(team){
      row.appendChild(el("button",{
        class:"boss-report-team",
        type:"button",
        "aria-label":"Voir l’équipe de "+(member.pseudo || "Membre"),
        onclick:()=>openTeamDetail(team)
      },[
        bossTeamBanner(team),
        el("span",{class:"boss-report-team-label",text:"Voir l’équipe"})
      ]));
    }else{
      row.appendChild(el("span",{
        class:"boss-report-team-missing",
        text:"Équipe non disponible"
      }));
    }
    return row;
  }

  function bossReportCard(group, members, report){
    const card = el("article",{
      class:"boss-report-card"+(report?"":" boss-report-unavailable"),
      dataset:{sessionId:group.id}
    });
    card.appendChild(el("div",{class:"boss-report-head"},[
      el("h3",{
        class:"boss-report-heading",
        text:group.title+" · Run "+(group.run_no||1)
      }),
      el("span",{
        class:"boss-report-date",
        text:group.completed_at ? "Terminée le "+frDateTime(group.completed_at) : ""
      })
    ]));

    if(!report){
      card.appendChild(el("p",{
        text:"Rapport non disponible pour cette ancienne run."
      }));
      const legacyParticipants = el("div",{class:"boss-report-participants"});
      members.forEach(member =>
        legacyParticipants.appendChild(bossReportParticipant(member))
      );
      card.appendChild(legacyParticipants);
      return card;
    }

    card.appendChild(el("div",{class:"boss-report-score-block"},[
      el("span",{class:"boss-report-score-label",text:"Score global"}),
      el("strong",{
        class:"boss-report-score",
        text:formatBossScore(report.global_score)
      })
    ]));
    card.appendChild(el("p",{
      class:"boss-report-note",
      text:report.note || "Aucune note de run."
    }));
    const meta = el("div",{class:"boss-report-meta"},[
      el("span",{
        text:"Rapport enregistré par "+
          (report.created_by_pseudo || "Membre")+
          (report.created_at ? " le "+frDateTime(report.created_at) : "")
      })
    ]);
    if(report.updated_at){
      meta.appendChild(el("span",{
        text:"Corrigé par "+(report.updated_by_pseudo || "Membre")+
          " le "+frDateTime(report.updated_at)
      }));
    }
    card.appendChild(meta);

    const participants = el("div",{class:"boss-report-participants"});
    members.forEach(member =>
      participants.appendChild(bossReportParticipant(member))
    );
    card.appendChild(participants);

    if(members.some(member => member.owner === sessionCourante.user?.id)){
      card.appendChild(el("div",{class:"boss-report-actions"},[
        el("button",{
          class:"btn boss-report-edit",
          type:"button",
          dataset:{bossAction:"report-edit"},
          text:"Corriger le rapport",
          onclick:()=>openBossReport(group, "edit")
        })
      ]));
    }
    return card;
  }

  function bossArchiveRows(groups, membership, reports){
    const wrap = el("div",{class:"boss-report-list"});
    const reportsBySession = new Map(
      (reports || []).map(report => [report.session_id, report])
    );
    groups.forEach(group => {
      const members = membership.filter(member =>
        member.session_id === group.id
      );
      wrap.appendChild(
        bossReportCard(group, members, reportsBySession.get(group.id) || null)
      );
    });
    return wrap;
  }

  function bossArchive(past, membership, reports){
    const weeks = [...new Set(past.map(g=>g.week_start))].sort().reverse();
    const wrap = el("details",{class:"boss-archive"});
    wrap.appendChild(el("summary",{
      text:"Semaines précédentes ("+weeks.length+")"
    }));
    weeks.forEach(weekStart=>{
      const groups = past
        .filter(g => g.week_start === weekStart)
        .sort((a,b)=>
          ((a.slot||0)-(b.slot||0)) ||
          ((a.run_no||1)-(b.run_no||1))
        );
      const weekBlock = el("div",{class:"boss-archive-week"});
      weekBlock.appendChild(el("div",{
        class:"boss-archive-title",
        text:"Semaine du "+frDate(weekStart)
      }));
      weekBlock.appendChild(bossArchiveRows(groups, membership, reports));
      wrap.appendChild(weekBlock);
    });
    return wrap;
  }

  /* ============================ Démarrage ============================ */
  $("#databar").textContent =
    (DATA.personnages||[]).length + " héros · " +
    Object.keys(DATA.armes||{}).length + " types d'armes · " +
    Object.keys(DATA.armures||{}).length + " emplacements d'armure · " +
    Object.values(DATA.bijoux||{}).reduce((n,l)=>n+l.length,0) + " bijoux · " +
    Object.keys(POT).length + " persos avec potentiels" +
    (DATA.generatedAt ? "  ·  données du "+DATA.generatedAt : "");

  renderBuilder();
  void initAuth();
})();
