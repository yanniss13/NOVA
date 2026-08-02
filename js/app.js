/* Les `import` doivent précéder l'IIFE : ils vivent au niveau du module, pas
   dans sa portée interne. */
import { shouldIgnoreAvailabilityEcho } from "./metier/dispos-logique.js";
import { ModalStack } from "./vues/modal-stack.js";
import { sessionCourante } from "./etat/session.js";
import { brouillonEquipe } from "./etat/brouillon-equipe.js";
import { sb } from "./noyau/supabase-client.js";
import {
  WEAPON_RARITY_LABELS,
  closeWeaponConfigEditor,
  openWeaponConfigEditor,
  weaponConfigField,
  weaponConfigOption,
  weaponDefaultGradeGameId,
  weaponTermLabel
} from "./vues/editeur-arme.js";
import {
  calculateGearStats,
  calculateHeroStats,
  gearDomainOf,
  groupBuildStatResults
} from "./metier/stats-calcul.js";
import {
  BUILD_GEAR,
  BUILD_GEAR_SETS,
  GEAR_PASSIVE_MAX_LEVEL,
  buildGearDefinition,
  buildWeaponGrade,
  gearConfigStatus,
  gearEnchantmentChoiceStatus,
  gearEnchantmentLength,
  weaponConfigStatus
} from "./metier/build-config.js";
import {
  equippedEnumOf,
  isLinkedArmorCompatible,
  isWeaponCompatible,
  linkedArmorsOf,
  weaponFolderOf,
  weaponTypesOf
} from "./metier/armes.js";
import { enchantmentExpectedLength, enchantmentRequiredLength } from "./metier/perles.js";
import { isInteger, jsonCopy, owns } from "./noyau/outils.js";
import {
  BUILD_STAT_FAMILY_LABELS,
  buildStatsTitle,
  formatBuildStatValue,
  mainRateValueText,
  statTermsDetails
} from "./vues/stats-affichage.js";
import { Availability, renderAvailabilityView } from "./vues/dispos.js";
import { BOSS_NAME, BossStore } from "./donnees/boss-store.js";
import { refreshRosterProfiles } from "./donnees/roster-profils.js";
import { toast } from "./vues/toast.js";
import {
  ARMOR_SET_SLOTS,
  armorSetsFrom,
  emptyArmor,
  emptyJewel,
  emptyPot,
  jewelSetsFrom
} from "./metier/equipement.js";
import {
  DATA,
  BUILD_STATS,
  STORAGE_KEY,
  TEAM_SIZE,
  ARMOR_SLOTS,
  LINKED_ARMOR_SLOT,
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
  WSLOT_ROLES,
  WEAPON_ENUM,
  metaOf,
  FOLDER_TO_ENUM,
  ENUM_TO_FOLDER
} from "./noyau/constantes.js";
import { Picker } from "./vues/picker.js";
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
} from "./metier/boss-logique.js";
import { $, uid, norm, initials, numericKeyboardInputProps, el } from "./noyau/dom.js";

(function(){
  "use strict";

  /* ============================ Données & constantes ============================ */

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
  function buildGearCatalog(){
    return BUILD_GEAR;
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
  /* PRÉSUMÉ, NON VÉRIFIÉ :
   * le gain par niveau d'une pièce part de la borne basse de son segment.
   *
   * Vérification dans le jeu : relever la même statistique d'une même armure
   * à qualityMin, juste avant, au niveau et juste après la première borne
   * interne, puis comparer les reconstructions "segment-lower-bound" et
   * "quality-min". Si la mesure contredit ce choix, remplacer uniquement la
   * valeur ci-dessous. Aucune autre partie du moteur ne connaît l'hypothèse. */
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
  /* Une arme ne porte qu'une seule perle : tous les emplacements renseignés
     doivent partager le même palier et le même élément. Sans cette contrainte,
     un état absurde deviendrait « valide ». */
  /* Le jeu interdit deux fois la même stat sur une perle. Les emplacements
     encore vides ne comptent pas : sinon toute saisie en cours serait refusée. */

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

  function buildGearSets(){
    return BUILD_GEAR_SETS;
  }

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * les 30 % d'ATK plate des deux armes secondaires sont ajoutés avant les
   * taux principaux du héros. Protocole : comparer sur Merlin l'ATK affichée
   * avec les deux armes secondaires configurées, puis sans l'une d'elles. Si
   * l'écart réel n'est pas lui-même affecté par les taux principaux, changer
   * uniquement ce mode et le branchement de ces seaux.
   */

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

  /* Le titre dit ce que le total vaut vraiment. `uncovered` non vide signifie
     qu'une part existante n'est pas calculee — les 567 niveaux de passif
     d'arme — donc le total est une borne inferieure, pas un partiel qu'on
     completerait plus tard. Ne jamais annoncer un total complet dans ce cas. */

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

  /* L'etat du brouillon vit dans js/brouillon-equipe.js ; on l'amorce ici,
     au meme instant qu'avant, parce que emptyDraft() a besoin du catalogue. */
  brouillonEquipe.equipe = emptyDraft();
  brouillonEquipe.edition = false;
  brouillonEquipe.sourceMaj = 0;
  brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
  brouillonEquipe.supprimeAilleurs = false;
  brouillonEquipe.referencesRoster = Array.from(
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
    brouillonEquipe.referencesRoster[index] = builderRosterBaselineForHero(
      brouillonEquipe.equipe.heroes[index]
    );
  }
  function resetBuilderRosterBaselines(){
    brouillonEquipe.referencesRoster = brouillonEquipe.equipe.heroes.map(
      builderRosterBaselineForHero
    );
  }
  function builderBuildIsDirty(index, type){
    const hero = brouillonEquipe.equipe.heroes[index];
    const activeType = hero
      && (weaponFolderOf(hero.weapon) || hero.activeWeaponType);
    const current = type === activeType
      ? teamBuildSnapshot(hero)
      : hero && hero.rosterBuilds && hero.rosterBuilds[type];
    const baseline = brouillonEquipe.referencesRoster[index]
      && brouillonEquipe.referencesRoster[index].builds[type];
    return JSON.stringify(teamBuildSnapshot(current || {}))
      !== JSON.stringify(teamBuildSnapshot(baseline || {}));
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
        brouillonEquipe.equipe.pseudo = sessionCourante.pseudo;
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

  pseudoInput.addEventListener("input", e => brouillonEquipe.equipe.pseudo = e.target.value);
  teamNameInput.addEventListener("input", e => brouillonEquipe.equipe.name = e.target.value);

  function renderBuilder(){
    if(sessionCourante.user && sessionCourante.pseudo) brouillonEquipe.equipe.pseudo = sessionCourante.pseudo;
    teamNameInput.value = brouillonEquipe.equipe.name || "";
    pseudoInput.value = brouillonEquipe.equipe.pseudo || "";
    pseudoInput.disabled = !!sessionCourante.user;
    $("#editFlag").classList.toggle("on", brouillonEquipe.edition);
    $("#btnSave").textContent = brouillonEquipe.edition ? "Mettre à jour l'équipe" : "Enregistrer l'équipe";
    heroGrid.innerHTML = "";
    brouillonEquipe.equipe.heroes.forEach((hero, i) => heroGrid.appendChild(heroCard(hero, i)));
  }
  function switchBuilderHeroBuild(heroIndex, weaponType){
    const hero = brouillonEquipe.equipe.heroes[heroIndex];
    if(!hero || hero.activeWeaponType === weaponType) return;
    brouillonEquipe.equipe.heroes[heroIndex] = activateHeroBuild(hero, weaponType);
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
    const hero = brouillonEquipe.equipe.heroes[heroIndex];
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
    const baseline = brouillonEquipe.referencesRoster[heroIndex]
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
      brouillonEquipe.referencesRoster[heroIndex] = {
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
    const hero = brouillonEquipe.equipe.heroes[heroIndex];
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
    brouillonEquipe.equipe.heroes[heroIndex] = snapshot;
    brouillonEquipe.referencesRoster[heroIndex] = {
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
      sourceUpdatedAt:brouillonEquipe.sourceMaj,
      parentIsDirty(){
        return JSON.stringify(brouillonEquipe.equipe) !== brouillonEquipe.jsonInitial;
      },
      sourceWasDeleted(){
        if(brouillonEquipe.sourceMaj <= 0) return false;
        return !Store.all().some(row => row.id === brouillonEquipe.equipe.id);
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
        const latest = Store.all().find(row => row.id === brouillonEquipe.equipe.id);
        return latest ? latest.updatedAt : brouillonEquipe.sourceMaj;
      },
      reload(){
        const latest = Store.all().find(row => row.id === brouillonEquipe.equipe.id);
        if(!latest){
          if(brouillonEquipe.sourceMaj > 0){
            closeDeletedTeamDraft();
          }
          return true;
        }
        brouillonEquipe.equipe = normalizeTeam(JSON.parse(JSON.stringify(latest)));
        brouillonEquipe.sourceMaj = brouillonEquipe.equipe.updatedAt;
        brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
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
      onclick:()=>{ brouillonEquipe.equipe.heroes[i] = emptyHero(); renderBuilder(); }});

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
      title:"Choisir un héros", portrait:true, value:brouillonEquipe.equipe.heroes[i].char,
      items:(DATA.personnages||[]).map(c=>({value:c.id, name:c.name, file:c.file})),
      onSelect:v=>{
        brouillonEquipe.equipe.heroes[i] = applyCharacterChange(
          brouillonEquipe.equipe.heroes[i],
          v
        );
        resetBuilderRosterBaseline(i);
        renderBuilder();
      }
    });
  }
  function pickWeapon(i){
    const hero = brouillonEquipe.equipe.heroes[i];
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
        brouillonEquipe.equipe.heroes[i] = applyWeaponChange(hero, v);
        renderBuilder();
      }
    });
  }
  function pickArmor(i, slot){
    const hero = brouillonEquipe.equipe.heroes[i];
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
      title:"Bijou — "+slot, value:brouillonEquipe.equipe.heroes[i].jewel[slot],
      items:(DATA.bijoux[slot]||[]).map(b=>({value:b.file, name:b.name, file:b.file})),
      emptyHint:"Aucun bijou pour l'instant. Ajoute des images dans 7ds-bijoux/"+slot+"/ puis relance generate-data.ps1.",
      onSelect:v=>{
        applyGearChange(brouillonEquipe.equipe.heroes[i], "jewel", slot, v);
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
    brouillonEquipe.equipe.heroes[slotIndex] = snapshot;
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
      const hero = brouillonEquipe.equipe.heroes[i], ch = charOf(hero.char);
      if(!ch) return;
      const types = weaponTypesOf(ch.id);
      if(!types.length) return;
      titleEl.textContent = "Potentiel — " + ch.name;
      render();
      ModalStack.open(overlay, "#potClose", close);
    }
    function close(){ ModalStack.close(overlay); }

    function render(){
      const hero = brouillonEquipe.equipe.heroes[heroIdx];
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
    brouillonEquipe.equipe = emptyDraft();
    brouillonEquipe.edition = false;
    brouillonEquipe.sourceMaj = 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    resetBuilderRosterBaselines();
    renderBuilder();
  }

  function closeDeletedTeamDraft(){
    closeWeaponConfigEditor();
    resetTeamDraft();
    brouillonEquipe.supprimeAilleurs = true;
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
    if(brouillonEquipe.supprimeAilleurs){
      toast("Cette équipe a été supprimée dans un autre onglet.", true);
      return;
    }
    const pseudo = (sessionCourante.pseudo||brouillonEquipe.equipe.pseudo||"").trim();
    if(!pseudo){ toast("Ajoute d'abord un pseudo de membre.", true); pseudoInput.focus(); return; }
    if(!brouillonEquipe.equipe.heroes.some(h=>h.char)){ toast("Ajoute au moins un héros à l'équipe.", true); return; }

    const now = Date.now();
    const existing = Store.all().find(t=>t.id===brouillonEquipe.equipe.id);
    const team = normalizeTeam(JSON.parse(JSON.stringify(brouillonEquipe.equipe)));
    team.pseudo = pseudo;
    team.createdAt = existing ? existing.createdAt : now;
    team.updatedAt = now;
    const saveButton = $("#btnSave");
    saveButton.disabled = true;
    try{
      const latest = Store.all().find(row => row.id === team.id);
      if(brouillonEquipe.sourceMaj > 0 && !latest){
        closeDeletedTeamDraft();
        return;
      }
      const latestUpdatedAt = Number(latest && latest.updatedAt) || 0;
      if(brouillonEquipe.sourceMaj > 0
        && latestUpdatedAt > brouillonEquipe.sourceMaj
        && !confirm("Une version plus récente existe. Enregistrer quand même ?")){
        saveButton.disabled = false;
        saveButton.focus();
        return;
      }
      const saved = await Store.upsert(team);
      brouillonEquipe.sourceMaj = saved.updatedAt;
      toast(brouillonEquipe.edition ? "Équipe mise à jour." : "Équipe enregistrée !");
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
    brouillonEquipe.equipe = normalizeTeam(JSON.parse(JSON.stringify(t)));
    brouillonEquipe.sourceMaj = Number(brouillonEquipe.equipe.updatedAt) || 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    brouillonEquipe.edition = true;
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
    brouillonEquipe.equipe = copy;
    brouillonEquipe.sourceMaj = 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    brouillonEquipe.edition = false;
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
