/* Les equipes : stockage local et miroir Supabase.

   `LocalTeams` ne parle qu'au localStorage, `Store` arbitre entre le local et
   le nuage selon qu'un membre est connecte. Le cache `cloudTeamsCache` sert
   a afficher quelque chose avant que le reseau reponde — et a rester lisible
   hors ligne.

   Aucun rendu ici : ce module rend des donnees, jamais des noeuds. */

import { STORAGE_KEY, CLOUD_TEAMS_CACHE_KEY } from "../noyau/constantes.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";
import { normalizeTeam } from "../metier/equipe-modele.js";

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

export {
  LocalTeams,
  Store
};
