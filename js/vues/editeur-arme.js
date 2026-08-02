/* L'editeur de configuration d'arme : la modale ou le membre saisit grade,
   niveau, enchantements et perle de sortilege.

   Elle porte son propre brouillon (`weaponConfigEditorState`), distinct du
   brouillon d'equipe : on peut annuler la saisie sans toucher a l'equipe.
   D'ou les gardes sur les conflits et sur la suppression de la source.

   25 declarations sur 32 restent privees. Les sept qui sortent sont la
   modale elle-meme et quatre aides de rendu partagees avec l'editeur
   d'equipement, reste dans js/app.js. */

import { $, el, numericKeyboardInputProps } from "../noyau/dom.js";
import { BUILD_STATS, ELEMENTS } from "../noyau/constantes.js";
import { isInteger, jsonCopy } from "../noyau/outils.js";
import { ModalStack } from "./modal-stack.js";

import {
  pearlSlotCount,
  pearlTierLabel,
  pearlRequiredSlotCount,
  enchantmentLength,
  enchantmentExpectedLength,
  enchantmentRequiredLength
} from "../metier/perles.js";
import {
  BUILD_STAT_FAMILY_LABELS,
  BUILD_BUCKET_LABELS,
  buildStatsTitle,
  formatBuildStatValue,
  statTermsDetails
} from "./stats-affichage.js";
import { calculateWeaponStats, groupBuildStatResults } from "../metier/stats-calcul.js";
import {
  buildWeaponDefinition,
  buildWeaponGrade,
  weaponLevelCap,
  weaponConfigStatus,
  allowedEnchantValueStatus,
  enchantmentChoiceStatus,
  enchantmentsStatus,
  enchantmentBounds
} from "../metier/build-config.js";

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

  function isAllowedEnchantValue(choice, options){
    return !!choice && typeof choice === "object" && !Array.isArray(choice)
      && allowedEnchantValueStatus(choice, options) === "valid";
  }
  function areEnchantmentsValid(grade, enchantments){
    return enchantmentsStatus(grade, enchantments) === "valid";
  }

  const WEAPON_RARITY_LABELS = {
    grade1:"Grade 1",
    grade2:"Grade 2",
    grade3:"Grade 3",
    grade4:"Grade 4",
    grade5:"SSR"
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

export {
  WEAPON_RARITY_LABELS,
  closeWeaponConfigEditor,
  openWeaponConfigEditor,
  weaponConfigField,
  weaponConfigOption,
  weaponDefaultGradeGameId,
  weaponTermLabel
};
