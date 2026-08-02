/* Les widgets d'edition d'un build : la case d'equipement configurable, les
   panneaux d'arme et de piece, les boutons de set, et les fonctions qui
   appliquent un changement a un heros.

   Ils sont ici parce que DEUX ecrans s'en servent : le Builder, qui edite une
   equipe, et l'editeur du roster d'un membre, qui edite un personnage seul.
   Tant qu'ils vivaient dans app.js, aucun des deux ne pouvait sortir.

   Les fonctions `apply*` ne modifient rien sur place : elles renvoient un
   nouveau heros normalise. C'est ce qui permet aux deux ecrans de decider
   eux-memes quoi en faire — l'un ecrit dans le brouillon d'equipe, l'autre
   dans un build du roster. */

import {
  isLinkedArmorCompatible,
  isWeaponCompatible,
  weaponFolderOf,
  weaponTypesOf
} from "../metier/armes.js";
import {
  buildWeaponGrade,
  gearConfigStatus,
  weaponConfigStatus
} from "../metier/build-config.js";
import {
  normalizeBuildFields,
  normalizeHero,
  normalizePotentiel,
  normalizeRosterBuild,
  normalizeRosterCharacter,
  normalizeWeaponConfig,
  teamBuildSnapshot
} from "../metier/equipe-modele.js";
import {
  ARMOR_SET_SLOTS,
  armorSetsFrom,
  emptyArmor,
  emptyJewel,
  jewelSetsFrom
} from "../metier/equipement.js";
import { DATA, JEWEL_SLOTS, LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";
import { jsonCopy } from "../noyau/outils.js";
import { WEAPON_RARITY_LABELS, openWeaponConfigEditor } from "./editeur-arme.js";
import { openGearConfigEditor } from "./editeur-equipement.js";
import { gearSlot } from "./elements.js";
import { Picker } from "./picker.js";
import { toast } from "./toast.js";

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

export {
  activateHeroBuild,
  applyCharacterChange,
  applyGearChange,
  applyWeaponChange,
  equipmentSetButton,
  findGearConfigButton,
  gearConfigurableSlot,
  rosterEntryWithActiveHeroBuild,
  storeActiveHeroBuild,
  weaponConfigControl
};
