/* La liste des pseudos de la confrerie, lue une fois puis mise en cache
   dans sessionCourante.

   Partagee par les dispos, le roster des membres et l'analyse : c'est ce qui
   lui vaut son propre module plutot qu'une place dans l'une des trois. */

import { sessionCourante } from "./session.js";
import { sb } from "./supabase-client.js";

  async function refreshRosterProfiles(){
    if(!sessionCourante.user || !sb) return sessionCourante.rosterProfiles.slice();
    const { data, error } = await sb.from("profiles")
      .select("id,pseudo")
      .order("pseudo", {ascending:true});
    if(error) throw error;
    sessionCourante.rosterProfiles = (data || [])
      .filter(item => item && item.id)
      .map(item => ({id:item.id, pseudo:item.pseudo || "Membre"}));
    return sessionCourante.rosterProfiles.slice();
  }

export {
  refreshRosterProfiles
};
