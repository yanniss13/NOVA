/* Le roster des membres : lecture et ecriture Supabase, avec cache local.

   Le cache est indexe par proprietaire, parce qu'on affiche aussi bien son
   propre roster que celui d'un autre membre :
   `replaceRosterCacheForOwner` remplace la part d'un seul proprietaire sans
   toucher aux autres.

   Aucun rendu ici. La normalisation des entrees vit dans
   metier/equipe-modele.js. */

import { CLOUD_ROSTER_CACHE_KEY } from "../noyau/constantes.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";
import { normalizeRosterCharacter } from "../metier/equipe-modele.js";

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

export {
  MemberRosterStore,
  cloudRosterFromRow
};
