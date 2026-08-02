/* Le modele d'une equipe : normalisation de ce qui entre.

   Toute equipe venue du dehors — stockage local, Supabase, import d'un
   fichier — passe par ici avant d'etre affichee. Les fonctions completent ce
   qui manque et rognent ce qui deborde, sans jamais lever : une equipe
   sauvegardee par une version plus ancienne du site doit rester ouvrable.

   Logique pure, aucune lecture du DOM ni du reseau. C'est ce qui permet aux
   trois stores (local, equipes, roster) de s'appuyer dessus sans se connaitre. */

import {
  DATA,
  POT_MAX,
  TEAM_SIZE,
  ARMOR_SLOTS,
  JEWEL_SLOTS,
  LINKED_ARMOR_SLOT
} from "../noyau/constantes.js";
import { jsonCopy, owns } from "../noyau/outils.js";
import { charOf } from "./catalogue.js";
import { isLinkedArmorCompatible, isWeaponCompatible, weaponFolderOf, weaponTypesOf } from "./armes.js";
import { emptyArmor, emptyJewel } from "./equipement.js";
import { enchantmentExpectedLength, enchantmentRequiredLength } from "./perles.js";
import { buildWeaponGrade } from "./build-config.js";

  const normalizePotentiel = raw => {
    const tier = Number.isFinite(Number(raw && raw.tier)) ? Math.trunc(Number(raw.tier)) : 0;
    return { tier:Math.max(0, Math.min(POT_MAX, tier)) };
  };

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

  const TEAM_NAME_MAX = 40;

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

  function compatibleWeaponGroups(charId){
    const allowed = new Set(weaponTypesOf(charId));
    return Object.entries(DATA.armes||{}).reduce((groups, [label, items])=>{
      const compatible = items.filter(item => allowed.has(weaponFolderOf(item.file)));
      if(compatible.length) groups[label] = compatible;
      return groups;
    }, {});
  }

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

  /* Un instantane de boss est une equipe venue du dehors comme une autre :
     il arrive d'une colonne jsonb, ecrite par une version quelconque du
     site. Il passe donc par normalizeTeam, qui ne leve jamais. */
  function teamFromBossSnapshot(snapshot){
    if(!snapshot || typeof snapshot !== "object") return null;
    return normalizeTeam(Object.assign({}, snapshot.data || {}, {
      id:snapshot.id || snapshot.teamId || "",
      pseudo:snapshot.pseudo || ""
    }));
  }

  /* Deux lectures d'une entree de roster, remontees ici depuis app.js : la
     modale de detail les partageait avec sept autres appelants, dont
     copyFavoriteRosterBuild juste au-dessus. Une aide de modele ne peut pas
     vivre dans la vue qui l'a fait sortir. */
  function favoriteRosterWeaponType(entry){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized) return null;
    return Object.keys(normalized.builds)
      .find(type => normalized.builds[type].favorite) || null;
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

export {
  normalizeRosterCharacter,  normalizeRosterBuild,  compatibleWeaponGroups,  normalizeBuildFields,
  normalizeHero,
  normalizePotentiel,
  normalizeTeam,
  normalizeTeamName,
  normalizeWeaponConfig,
  favoriteRosterWeaponType,
  rosterHeroSnapshot,
  teamBuildSnapshot,
  teamFromBossSnapshot
};
