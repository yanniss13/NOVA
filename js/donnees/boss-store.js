/* Acces Supabase aux sessions de boss : lecture, creation des groupes de la
   semaine, inscription et rapports de run.

   Aucun rendu ici. La vue qui consomme ce store est restee dans js/app.js
   pour l'instant. `BOSS_GROUPS` ne sort pas : seul BossStore s'en sert. */

import { sb } from "../noyau/supabase-client.js";
import { uid } from "../noyau/dom.js";
import { sessionCourante } from "../etat/session.js";

  const BOSS_NAME = "Akumu, bête démoniaque";
  const BOSS_GROUPS = 6;

  const BossStore = {
    async listAll(){
      if(!sessionCourante.user || !sb) return [];
      const { data, error } = await sb.from("boss_sessions").select("*")
        .order("week_start",{ascending:false}).order("slot",{ascending:true})
        .order("run_no",{ascending:true});
      if(error) throw error;
      return data || [];
    },
    // Crée les 6 groupes de la semaine s'ils n'existent pas encore (anti-doublon multi-clients).
    async ensureWeek(week){
      if(!sessionCourante.user || !sb) return;
      const now = new Date().toISOString();
      const rows = [];
      for(let i=1; i<=BOSS_GROUPS; i++){
        rows.push({ id:uid(), created_by:sessionCourante.user.id, title:"Groupe "+i,
          boss_name:BOSS_NAME, session_date:week.startDate, week_start:week.startDate, slot:i,
          run_no:1, elements:[], status:"open", created_at:now });
      }
      const { error } = await sb.from("boss_sessions")
        .upsert(rows, {
          onConflict:"week_start,slot,run_no",
          ignoreDuplicates:true
        });
      if(error) throw error;
    },
    /* Lectures ciblées de « Mon suivi » : la semaine seule, sans toucher aux
       méthodes déjà utilisées par la vue Boss. */
    async listWeek(weekStart){
      if(!sessionCourante.user || !sb) return [];
      const { data, error } = await sb.from("boss_sessions")
        .select("*")
        .eq("week_start", weekStart)
        .order("slot", {ascending:true})
        .order("run_no", {ascending:true});
      if(error) throw error;
      return data || [];
    },
    async listReportsForSessions(sessionIds){
      if(!sessionCourante.user || !sb || !sessionIds.length) return [];
      const reports = [];
      for(let start=0; start<sessionIds.length; start+=100){
        const batch = sessionIds.slice(start, start+100);
        const { data, error } = await sb.from("boss_run_reports")
          .select("*")
          .in("session_id", batch);
        if(error) throw error;
        reports.push(...(data || []));
      }
      return reports;
    },
    async listMembership(sessionIds){
      if(!sessionCourante.user || !sb || !sessionIds.length) return [];
      const memberships = [];
      const batchSize = 100;
      for(let start=0; start<sessionIds.length; start+=batchSize){
        const batch = sessionIds.slice(start, start + batchSize);
        const { data, error } = await sb.from("boss_participation")
          .select("session_id,owner,pseudo,team_id,team_snapshot").in("session_id", batch);
        if(error) throw error;
        memberships.push(...(data || []));
      }
      return memberships;
    },
    async listReports(){
      if(!sessionCourante.user || !sb) return [];
      const { data, error } = await sb.from("boss_run_reports")
        .select("*")
        .order("created_at", { ascending:false });
      if(error) throw error;
      return data || [];
    },
    async join(sessionId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("join_boss_run", { p_session_id:sessionId });
      if(error) throw error;
    },
    async leave(sessionId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("leave_boss_run", { p_session_id:sessionId });
      if(error) throw error;
    },
    async selectTeam(sessionId, teamId){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("select_boss_team", {
        p_session_id:sessionId,
        p_team_id:teamId
      });
      if(error) throw error;
    },
    async complete(sessionId, globalScore, note){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("complete_boss_run_with_report", {
        p_session_id:sessionId,
        p_global_score:globalScore,
        p_note:note
      });
      if(error) throw error;
    },
    async updateReport(sessionId, globalScore, note){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("update_boss_run_report", {
        p_session_id:sessionId,
        p_global_score:globalScore,
        p_note:note
      });
      if(error) throw error;
    }
  };

export {
  BOSS_NAME,
  BossStore
};
