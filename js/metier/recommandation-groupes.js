/* Proposition pure de groupes de boss.

   Elle ne reserve aucun groupe et ne choisit aucune equipe a la place des
   membres. Le classement combine seulement disponibilite, potentiel declare,
   builds armes renseignes et diversite elementaire. */

import { ELEMENTS, FOLDER_TO_ENUM, META } from "../noyau/constantes.js";
import {
  AVAIL_DAY_FULL,
  aggregateAvailability,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask
} from "./dispos-logique.js";

  function bossSlotLabel(index){
    const slot = availabilitySlotFromIndex(index);
    return AVAIL_DAY_FULL[slot.day]+" · "+String(slot.hour).padStart(2,"0")+"h–"+
      String((slot.hour + 1) % 24).padStart(2,"0")+"h";
  }

  function memberRosterSummary(owner, roster){
    const entries = (roster || []).filter(entry => entry && entry.owner === owner);
    const elements = new Set();
    let potential = 0;
    let preparedBuilds = 0;
    entries.forEach(entry => {
      potential = Math.max(potential, Number(entry.potentialTier) || 0);
      Object.entries(entry.builds || {}).forEach(([folder, build]) => {
        if(!build || !build.weapon) return;
        preparedBuilds += 1;
        const weapon = (META[entry.charId]?.weapons || [])
          .find(slot => slot.weapon === FOLDER_TO_ENUM[folder]);
        const code = String(weapon?.element || META[entry.charId]?.element || "")
          .toUpperCase();
        if(ELEMENTS[code]) elements.add(code);
      });
    });
    return {
      potential,
      preparedBuilds,
      elements:[...elements].sort()
    };
  }

  function recommendationCandidates(options){
    const config = options || {};
    const profiles = new Map((config.profiles || []).map(profile => [
      profile.id, profile.pseudo || "Membre"
    ]));
    const currentSessionIds = new Set((config.sessions || []).map(group => group.id));
    const runsByOwner = new Map();
    (config.memberships || []).forEach(member => {
      if(!currentSessionIds.has(member.session_id) || !member.owner) return;
      runsByOwner.set(member.owner, (runsByOwner.get(member.owner) || 0) + 1);
    });
    const seen = new Set();
    return (config.availabilityRows || [])
      .filter(row => row && row.owner
        && normalizeAvailabilityMask(row.slots)[config.slotIndex] === "1"
        && !seen.has(row.owner) && seen.add(row.owner))
      .map(row => Object.assign({
        owner:row.owner,
        pseudo:profiles.get(row.owner) || "Membre",
        runs:runsByOwner.get(row.owner) || 0
      }, memberRosterSummary(row.owner, config.roster)))
      .filter(member => member.runs < 3)
      .sort((a,b) =>
        b.potential - a.potential
        || b.preparedBuilds - a.preparedBuilds
        || a.pseudo.localeCompare(b.pseudo, "fr")
        || a.owner.localeCompare(b.owner)
      );
  }

  function groupChoiceScore(group, member){
    const newElements = member.elements.filter(code => !group.elements.has(code)).length;
    return group.potential * 100 + group.members.length * 20 - newElements * 35;
  }

  function recommendBossGroups(options){
    const config = Object.assign({maxGroupSize:5, maxGroups:6}, options || {});
    const candidates = recommendationCandidates(config);
    const capacity = config.maxGroupSize * config.maxGroups;
    const selected = candidates.slice(0, capacity);
    const excluded = candidates.slice(capacity);
    const count = selected.length
      ? Math.min(config.maxGroups, Math.ceil(selected.length / config.maxGroupSize))
      : 0;
    const groups = Array.from({length:count}, (_, index) => ({
      index:index + 1,
      members:[],
      potential:0,
      preparedBuilds:0,
      elements:new Set()
    }));
    selected.forEach(member => {
      const target = groups
        .filter(group => group.members.length < config.maxGroupSize)
        .sort((a,b) =>
          groupChoiceScore(a, member) - groupChoiceScore(b, member)
          || a.index - b.index
        )[0];
      target.members.push(member);
      target.potential += member.potential;
      target.preparedBuilds += member.preparedBuilds;
      member.elements.forEach(code => target.elements.add(code));
    });
    return {
      slotIndex:config.slotIndex,
      slotLabel:bossSlotLabel(config.slotIndex),
      available:candidates.length,
      groups:groups.map(group => Object.assign({}, group, {
        elements:[...group.elements].sort()
      })),
      excluded
    };
  }

  function bestBossSlots(rows){
    return aggregateAvailability(rows).best.map(entry => ({
      index:entry.index,
      count:entry.count,
      label:bossSlotLabel(entry.index)
    }));
  }

export {
  bestBossSlots,
  recommendBossGroups
};
