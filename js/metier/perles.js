/* Perle de sortilege : paliers, emplacements ouverts et longueur attendue
   des enchantements d'une arme.

   La table PEARL_TIERS vient du jeu, rapportee par le proprietaire. Elle
   reste privee : on n'y accede que par les fonctions de ce module. */

import { isInteger } from "../noyau/outils.js";

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

export {
  enchantmentExpectedLength,
  enchantmentLength,
  enchantmentRequiredLength,
  pearlRequiredSlotCount,
  pearlSlotCount,
  pearlTierLabel
};
