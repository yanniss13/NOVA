/* Les presets d'equipement : capturer sept emplacements, les reposer ailleurs.

   L'armure gravee ne voyage pas. Elle est propre au personnage — c'est ce que
   dit deja js/metier/equipement.js, qui l'exclut des sets pour la meme raison.

   Une config d'enchantement decrit UNE piece precise. Piece et config ne se
   separent donc jamais : supabase/schema.sql avertit qu'une config restauree
   sur une piece qui a change est perimee.

   Module PUR : ni DOM ni reseau, comme tout js/metier/. */

import { ARMOR_SLOTS, JEWEL_SLOTS, LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { jsonCopy } from "../noyau/outils.js";

  const PRESET_ARMOR_SLOTS = ARMOR_SLOTS.filter(slot => slot !== LINKED_ARMOR_SLOT);
  const PRESET_NAME_MAX = 40;
  const PRESETS_MAX = 40;

  /* Les aides privees portent un nom prefixe : le chargeur des tests concatene
     TOUS les modules dans une seule portee, ou `copie` appartient deja a
     metier/essai-enchantements.js et `piecesDe` a metier/wiki-equipement.js. */
  function copiePreset(valeur){
    return valeur == null ? null : jsonCopy(valeur);
  }

  function nomPresetValide(nom){
    const propre = String(nom == null ? "" : nom).trim();
    return propre.length >= 1 && propre.length <= PRESET_NAME_MAX ? propre : null;
  }

  /* Ne garde que les emplacements connus, dans leur ordre canonique. Une cle
     inconnue — « Armure liee » comprise — disparait ici, une fois pour toutes. */
  function piecesPresetDe(source, emplacements){
    const lu = source && typeof source === "object" ? source : {};
    return emplacements.reduce((resultat, emplacement) => {
      const piece = lu[emplacement];
      resultat[emplacement] = typeof piece === "string" && piece ? piece : null;
      return resultat;
    }, {});
  }

  /* Une config n'existe que si sa piece est la. */
  function configsPresetDe(source, pieces, emplacements){
    const lu = source && typeof source === "object" ? source : {};
    return emplacements.reduce((resultat, emplacement) => {
      if(pieces[emplacement] && lu[emplacement] != null){
        resultat[emplacement] = copiePreset(lu[emplacement]);
      }
      return resultat;
    }, {});
  }

  function normaliserPreset(source){
    if(!source || typeof source !== "object") return null;
    const armor = piecesPresetDe(source.armor, PRESET_ARMOR_SLOTS);
    const jewel = piecesPresetDe(source.jewel, JEWEL_SLOTS);
    return {
      armor,
      armorConfig:configsPresetDe(source.armorConfig, armor, PRESET_ARMOR_SLOTS),
      jewel,
      jewelConfig:configsPresetDe(source.jewelConfig, jewel, JEWEL_SLOTS)
    };
  }

  function capturerPreset(build){
    const preset = normaliserPreset(build);
    if(!preset) return null;
    const rempli = PRESET_ARMOR_SLOTS.some(emplacement => preset.armor[emplacement])
      || JEWEL_SLOTS.some(emplacement => preset.jewel[emplacement]);
    return rempli ? preset : null;
  }

  /* Renvoie un NOUVEAU build, comme les apply* de js/vues/edition-build.js.
     L'appelant decide seul ou l'ecrire — c'est ce qui permet au calculateur
     d'appliquer sans jamais toucher au roster. */
  function appliquerPreset(build, preset){
    if(!build || typeof build !== "object") return null;
    const normalise = normaliserPreset(preset);
    if(!normalise) return null;

    const armor = Object.assign({}, build.armor || {});
    const armorConfig = Object.assign({}, build.armorConfig || {});
    PRESET_ARMOR_SLOTS.forEach(emplacement => {
      armor[emplacement] = normalise.armor[emplacement];
      const config = normalise.armorConfig[emplacement];
      if(config == null) delete armorConfig[emplacement];
      else armorConfig[emplacement] = copiePreset(config);
    });

    const jewel = Object.assign({}, normalise.jewel);
    const jewelConfig = {};
    JEWEL_SLOTS.forEach(emplacement => {
      const config = normalise.jewelConfig[emplacement];
      if(config != null) jewelConfig[emplacement] = copiePreset(config);
    });

    return Object.assign({}, build, { armor, armorConfig, jewel, jewelConfig });
  }

/* On n'exporte qu'un symbole qui a un consommateur : `tests/modules-imports.js`
   refuse un export orphelin, et le chargeur des tests atteint les symboles
   sans passer par les exports. `capturerPreset` et `appliquerPreset` sortiront
   quand les vues les appelleront. */
export { PRESETS_MAX, nomPresetValide, normaliserPreset };
