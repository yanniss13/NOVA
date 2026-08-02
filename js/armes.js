/* Identite d'une arme : dossier, type, compatibilite avec un personnage.

   Le dossier d'image est la cle de tout le reste du site : c'est lui qui
   relie une arme a son enum, donc a ses stats et a ses armures liees. */

import { FOLDER_TO_ENUM, LINKED_ARMORS, POT } from "./constantes.js";

  const equippedEnumOf = hero => {
    const f = weaponFolderOf(hero && hero.weapon);
    return f ? (FOLDER_TO_ENUM[f] || null) : null;
  };

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

export {
  equippedEnumOf,
  isLinkedArmorCompatible,
  isWeaponCompatible,
  linkedArmorsOf,
  weaponFolderOf,
  weaponTypesOf
};
