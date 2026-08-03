/* « Mon suivi » : assemblage de l'etat du tableau de bord et son cache.

   Le tableau de bord ne possede aucune table : il projette ce que les autres
   stores ont deja. Le cache local sert a l'afficher immediatement au
   chargement, avant que Supabase reponde, puis a le garder hors ligne.

   La projection elle-meme est pure et vit dans metier/boss-logique.js
   (`buildDashboardState`). Ici, seulement le va-et-vient. */

import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";
import { Store } from "./equipes-store.js";
import { buildDashboardState, currentBossWeek,
  isBossSchemaCompatibilityError } from "../metier/boss-logique.js";
import { BossStore } from "./boss-store.js";
import { availabilitySummary, rosterSummary } from "../metier/accueil-logique.js";
import { availabilityWeekStart } from "../metier/dispos-logique.js";
import { MemberRosterStore } from "./roster-store.js";

  const DASHBOARD_CACHE_PREFIX = "confrerie7ds.cloud.dashboard.";
  /* Version 2 : l'etat porte desormais `availability` et `roster`. Sans ce
     passage, les enveloppes deja ecrites sur les appareils des membres —
     depourvues de ces champs — seraient relues comme valides et les trois
     cartes resteraient absentes jusqu'a la premiere synchro reussie. */
  const DASHBOARD_CACHE_VERSION = 2;

  function dashboardCacheKey(userId, weekStart){
    return DASHBOARD_CACHE_PREFIX+userId+"."+weekStart;
  }

  function readDashboardCache(userId, weekStart){
    if(!userId || !weekStart) return null;
    try{
      const raw = localStorage.getItem(dashboardCacheKey(userId, weekStart));
      if(!raw) return null;
      const envelope = JSON.parse(raw);
      if(
        !envelope ||
        envelope.version !== DASHBOARD_CACHE_VERSION ||
        envelope.userId !== userId ||
        envelope.weekStart !== weekStart ||
        !envelope.state
      ) return null;
      return Object.assign({}, envelope.state, {
        offline:true,
        userId
      });
    }catch(error){
      return null;
    }
  }

  function writeDashboardCache(userId, state){
    if(!userId || !state || !state.weekStart) return;
    try{
      localStorage.setItem(
        dashboardCacheKey(userId, state.weekStart),
        JSON.stringify({
          version:DASHBOARD_CACHE_VERSION,
          userId,
          weekStart:state.weekStart,
          savedAt:Date.now(),
          state:Object.assign({}, state, { offline:false })
        })
      );
    }catch(error){
      // Un quota local indisponible ne doit jamais casser la vue en ligne.
    }
  }

  const DashboardStore = (function(){
    let issued = 0;
    let ownerId = "";
    let state = null;
    let dirty = true;

    function reset(userId){
      issued++;
      ownerId = userId || "";
      state = null;
      dirty = true;
    }

    function current(){
      return state;
    }

    function markDirty(){
      dirty = true;
    }

    function isDirty(){
      return dirty;
    }

    async function refresh(){
      const userId = sessionCourante.user?.id || "";
      if(!userId || !sb) throw new Error("AUTH_REQUIRED");
      if(ownerId !== userId) reset(userId);
      const requestId = ++issued;
      const weekStart = currentBossWeek().startDate;
      const isCurrent = () =>
        issued === requestId &&
        sessionCourante.user?.id === userId &&
        currentBossWeek().startDate === weekStart;

      try{
        return await load(requestId, userId, weekStart, isCurrent);
      }catch(error){
        // Une réponse périmée ne touche ni l'état, ni le cache, ni le DOM.
        if(!isCurrent()) return state;
        const cached = readDashboardCache(userId, weekStart);
        if(!cached) throw error;
        state = cached;
        return state;
      }
    }

    async function load(requestId, userId, weekStart, isCurrent){
      const teamsPromise = Store.refresh();
      /* Si une lecture Boss échoue avant le Promise.all, cette promesse reste
         pendante : on lui attache un puits pour éviter une rejection non gérée,
         sans consommer l'erreur que le Promise.all doit encore voir. */
      teamsPromise.catch(() => {});
      await BossStore.ensureWeek(currentBossWeek());
      const sessions = await BossStore.listWeek(weekStart);
      const sessionIds = sessions.map(session => session.id);
      const membershipPromise = BossStore.listMembership(sessionIds);
      // Une base sans les rapports de boss reste lisible : on dégrade au lieu
      // d'échouer, comme le fait déjà la vue Boss.
      const reportsPromise = BossStore.listReportsForSessions(sessionIds)
        .then(reports => ({ reports, reportsAvailable:true }))
        .catch(error => {
          if(isBossSchemaCompatibilityError(error)){
            return { reports:[], reportsAvailable:false };
          }
          throw error;
        });
      /* Les dispos ont LEUR semaine : lundi 0h, quand le boss compte a partir
         du lundi 9h. Le lundi matin entre les deux, `weekStart` designerait la
         semaine ecoulee et la carte afficherait les creneaux d'avant. */
      const availabilityWeek = availabilityWeekStart(new Date());
      /* Chaque lecture porte SON repli a `null` : l'echec d'une carte ne doit
         jamais emporter le tableau de bord entier, et `null` se distingue d'une
         semaine vide — la carte disparait au lieu d'annoncer un faux zero. */
      const availabilityPromise = sb
        ? sb.from("member_availability")
            .select("owner,slots,week_start")
            .eq("week_start", availabilityWeek)
            .then(result => result.error ? null : (result.data || []))
            .catch(() => null)
        : Promise.resolve(null);
      const rosterPromise = MemberRosterStore.refresh(userId).catch(() => null);
      const [membership, reportResult, teams, availabilityRows, rosterCharacters] =
        await Promise.all([
          membershipPromise,
          reportsPromise,
          teamsPromise,
          availabilityPromise,
          rosterPromise
        ]);
      if(!isCurrent()) return state;
      state = Object.assign(buildDashboardState({
        userId,
        weekStart,
        sessions,
        membership,
        reports:reportResult.reports,
        teams,
        now:new Date(),
        lastSyncedAt:Date.now(),
        offline:false
      }), {
        userId,
        reportsAvailable:reportResult.reportsAvailable,
        availability:availabilitySummary({ rows:availabilityRows, userId }),
        roster:rosterSummary({ characters:rosterCharacters })
      });
      dirty = false;
      writeDashboardCache(userId, state);
      return state;
    }

    return { current, refresh, reset, markDirty, isDirty };
  })();

export {
  DashboardStore
};
