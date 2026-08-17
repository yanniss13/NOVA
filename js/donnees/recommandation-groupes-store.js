/* Lecture groupee des donnees necessaires a la proposition de groupes.
   Ce module ne fait aucune ecriture Supabase. */

import { sessionCourante } from "../etat/session.js";
import { availabilityWeekStart } from "../metier/dispos-logique.js";
import { sb } from "../noyau/supabase-client.js";
import { refreshRosterProfiles } from "./roster-profils.js";
import { MemberRosterStore } from "./roster-store.js";

  async function loadBossRecommendationData(now){
    if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
    const weekStart = availabilityWeekStart(now || new Date());
    const availabilityPromise = sb.from("member_availability")
      .select("owner,slots,week_start")
      .eq("week_start", weekStart);
    const [profiles, roster, availabilityResult] = await Promise.all([
      refreshRosterProfiles(),
      MemberRosterStore.refreshAll(),
      availabilityPromise
    ]);
    if(availabilityResult.error) throw availabilityResult.error;
    return {
      weekStart,
      profiles,
      roster,
      availabilityRows:availabilityResult.data || []
    };
  }

export { loadBossRecommendationData };
