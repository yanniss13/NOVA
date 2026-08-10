/* Un essai reste local au calculateur : copier les deux configurations visees
   empeche son editeur de remonter une modification vers le build enregistre. */

import { LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { jsonCopy } from "../noyau/outils.js";

  function copie(value){
    return value == null ? null : jsonCopy(value);
  }

  function creerEssaiEnchantements(hero){
    const source = hero && typeof hero === "object" ? hero : {};
    const reference = {
      weaponConfig:copie(source.weaponConfig),
      engravingConfig:copie((source.armorConfig || {})[LINKED_ARMOR_SLOT])
    };
    return { reference:copie(reference), essai:copie(reference) };
  }

  function remplacerConfigEssai(etat, cle, config){
    const source = etat && typeof etat === "object" ? etat : {};
    const reference = copie(source.reference) || {};
    const essai = copie(source.essai) || copie(reference) || {};
    const cible = cle === "weapon" ? "weaponConfig"
      : cle === "engraving" ? "engravingConfig" : null;
    if(!cible) return { reference, essai };
    essai[cible] = copie(config);
    return { reference, essai };
  }

  function reinitialiserEssaiEnchantements(etat){
    const source = etat && typeof etat === "object" ? etat : {};
    const reference = copie(source.reference) || {};
    return { reference, essai:copie(reference) };
  }

  function herosAvecEssaiEnchantements(hero, etat){
    const cible = copie(hero) || {};
    const essai = etat && etat.essai ? etat.essai : {};
    cible.weaponConfig = copie(essai.weaponConfig);
    cible.armorConfig = Object.assign({}, cible.armorConfig || {}, {
      [LINKED_ARMOR_SLOT]:copie(essai.engravingConfig)
    });
    return cible;
  }

  function essaiEnchantementsDiffere(etat){
    const source = etat && typeof etat === "object" ? etat : {};
    return JSON.stringify(source.reference || null) !== JSON.stringify(source.essai || null);
  }

export {
  creerEssaiEnchantements, essaiEnchantementsDiffere,
  herosAvecEssaiEnchantements, reinitialiserEssaiEnchantements,
  remplacerConfigEssai
};
