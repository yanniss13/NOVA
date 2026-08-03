/* La resynchronisation temps reel : quand le nuage change, les vues suivent.

   Un seul canal Supabase ecoute toutes les tables partagees. A chaque
   notification, les rendus concernes sont replanifies plutot qu'appeles :
   une rafale d'evenements — un membre qui enregistre son roster produit
   plusieurs lignes — ne doit declencher qu'un seul re-rendu.

   Le module est le dernier de la couche `vues` parce qu'il les appelle
   toutes. Il n'est PAS dans `donnees/` : cette couche a interdiction de
   toucher au rendu, et c'est precisement ce que fait celui-ci. */

import { Store } from "../donnees/equipes-store.js";
import { DashboardStore } from "../donnees/suivi-store.js";
import { shouldIgnoreAvailabilityEcho } from "../metier/dispos-logique.js";
import { $ } from "../noyau/dom.js";
import { sb } from "../noyau/supabase-client.js";
import { renderAnalyse } from "./analyse.js";
import { renderBossView } from "./boss-sessions.js";
import { Availability, renderAvailabilityView } from "./dispos.js";
import { renderRoster } from "./roster-equipes.js";
import { renderMemberRoster } from "./roster-membres.js";
import { renderDashboardView } from "./suivi.js";

  const RealtimeSync = (function(){
    const tables = [
      "profiles",
      "teams",
      "roster_characters",
      "boss_sessions",
      "boss_participation",
      "boss_run_reports",
      "member_availability"
    ];
    let channel = null;
    let userId = "";
    let timer = null;
    const pending = new Set();

    function setStatus(state, text){
      const node = $("#liveStatus");
      if(!node) return;
      node.dataset.state = state;
      node.textContent = text;
    }

    function activeView(){
      const view = document.querySelector(".view.active");
      return view ? view.id.replace(/^view-/, "") : "";
    }

    async function flush(){
      timer = null;
      const changed = new Set(pending);
      pending.clear();
      const view = activeView();
      /* « Mon suivi » dérive des équipes et des tables de boss. Quand il est
         actif il se recharge silencieusement, et sa lecture unique remplace les
         branches teams/boss pour ce même lot d'événements. Sinon il est
         seulement marqué sale : Realtime ne change jamais l'onglet actif. */
      /* L'accueil lit maintenant les dispos et le roster : une ecriture sur
         l'une de ces tables le perime, exactement comme une ecriture d'equipe
         ou de boss. Sans ces deux ajouts, un membre qui vient de poser ses
         dispos relirait « tes dispos ne sont pas posees » juste apres. */
      const dashboardChanged = changed.has("teams") || changed.has("boss")
        || changed.has("availability") || changed.has("roster");
      const dashboardActive = view === "dashboard";
      try{
        if(changed.has("teams") && !dashboardActive){
          if(view === "roster") await renderRoster();
          else await Store.refresh();
        }
        if(changed.has("roster")){
          if(view === "member-roster") await renderMemberRoster();
          if(view === "analyse") await renderAnalyse();
        }
        if(changed.has("boss") && view === "boss"){
          const refreshed = await renderBossView({
            showLoading:false,
            ensureWeek:false,
            showErrorToast:false
          });
          if(!refreshed) throw new Error("BOSS_SYNC_FAILED");
        }
        if(changed.has("availability") && view === "availability"){
          const refreshed = await renderAvailabilityView();
          if(!refreshed) throw new Error("AVAILABILITY_SYNC_FAILED");
        }
        if(dashboardChanged){
          if(dashboardActive){
            const refreshed = await renderDashboardView({
              showLoading:false,
              force:true
            });
            if(!refreshed) throw new Error("DASHBOARD_SYNC_FAILED");
          }else{
            DashboardStore.markDirty();
          }
        }
      }catch(error){
        setStatus("offline", "Synchronisation indisponible");
      }
    }

    function schedule(table){
      if(table === "teams") pending.add("teams");
      if(table === "profiles" || table === "roster_characters"){
        pending.add("roster");
      }
      if(
        table === "boss_sessions" ||
        table === "boss_participation" ||
        table === "boss_run_reports"
      ){
        pending.add("boss");
      }
      if(table === "member_availability") pending.add("availability");
      clearTimeout(timer);
      timer = setTimeout(()=>void flush(), 120);
    }

    function stop(){
      clearTimeout(timer);
      timer = null;
      pending.clear();
      const previous = channel;
      channel = null;
      userId = "";
      if(previous && sb) void sb.removeChannel(previous);
      setStatus("offline", "Hors ligne");
    }

    function start(nextUserId){
      if(!sb || !nextUserId){
        stop();
        return;
      }
      if(channel && userId === nextUserId) return;
      stop();
      userId = nextUserId;
      setStatus("connecting", "Connexion…");
      let next = sb.channel("confrerie-live-"+nextUserId);
      tables.forEach(table => {
        next = next.on("postgres_changes", {
          event:"*",
          schema:"public",
          table
        }, payload => {
          /* L'écho de sa PROPRE écriture n'apprend rien : soit on peint
             encore, soit la grille affiche déjà ce que la ligne contient. Le
             masque courant sert à distinguer ce cas d'une vraie modification
             venue d'ailleurs (un autre appareil du même membre). */
          if(shouldIgnoreAvailabilityEcho(
            payload && payload.new,
            userId,
            Availability.isSaving(),
            Availability.state ? Availability.state.mask : ""
          )) return;
          schedule(table);
        });
      });
      channel = next.subscribe(status => {
        if(channel !== next) return;
        if(status === "SUBSCRIBED") setStatus("online", "À jour");
        if(status === "CHANNEL_ERROR" || status === "TIMED_OUT"){
          setStatus("offline", "Synchronisation indisponible");
        }
        if(status === "CLOSED") setStatus("offline", "Hors ligne");
      });
    }

    return { start, stop, schedule };
  })();

export { RealtimeSync };
