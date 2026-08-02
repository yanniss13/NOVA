/* Logique pure des sessions de boss et du tableau « Mon suivi ».

   Ces fonctions ne lisent que ce qu'on leur passe : ni DOM, ni Supabase, ni
   stockage. C'est ce qui les rend testables sans navigateur, via le chargeur
   `vm` de tests/helpers/load-app.js. Ne rien y ajouter qui touche au dehors. */

  // Lundi 9h (heure de Paris) de la semaine de boss courante -> { startDate, endDate } (YYYY-MM-DD).
  function currentBossWeek(now){
    const p = new Intl.DateTimeFormat("en-CA",{ timeZone:"Europe/Paris",
      year:"numeric", month:"2-digit", day:"2-digit", weekday:"short", hour:"2-digit", hourCycle:"h23" })
      .formatToParts(now || new Date());
    const get = t => (p.find(x=>x.type===t)||{}).value;
    const y=+get("year"), m=+get("month"), day=+get("day"), hour=+get("hour");
    const wd = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[get("weekday")];
    let offset = (wd + 6) % 7;          // jours écoulés depuis lundi
    if(wd === 1 && hour < 9) offset = 7; // lundi avant 9h -> on est encore dans la semaine précédente
    const base = new Date(Date.UTC(y, m-1, day));
    base.setUTCDate(base.getUTCDate() - offset);
    const end = new Date(base); end.setUTCDate(end.getUTCDate() + 7);
    return { startDate: base.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10) };
  }
  /* ---------- Mon suivi : projection pure des tables existantes ----------
     Aucune table, RPC ni migration Supabase. Ces fonctions ne lisent que ce
     qu'on leur passe, afin d'être testables sans navigateur. */
  function dashboardParisParts(now){
    const parts = new Intl.DateTimeFormat("en-CA",{
      timeZone:"Europe/Paris",
      weekday:"short",
      hour:"2-digit",
      hourCycle:"h23"
    }).formatToParts(now || new Date());
    const get = type => (parts.find(part => part.type === type) || {}).value;
    return {
      weekday:{ Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[
        get("weekday")
      ],
      hour:Number(get("hour"))
    };
  }

  function dashboardRunCountLabel(count){
    return count+" run"+(count > 1 ? "s" : "");
  }

  function dashboardDeadlineStatus(now, remaining){
    const left = Math.max(0, Math.min(3, Number(remaining) || 0));
    if(left === 0){
      return { level:"complete", label:"Semaine complète", remaining:0 };
    }
    const paris = dashboardParisParts(now);
    const urgent = paris.weekday === 0 && paris.hour >= 12
      || paris.weekday === 1 && paris.hour < 9;
    const warning = paris.weekday === 6
      || paris.weekday === 0 && paris.hour < 12;
    if(urgent){
      return {
        level:"urgent",
        label:"Priorité : "+dashboardRunCountLabel(left)+
          " manquante"+(left > 1 ? "s" : "")+" avant le reset",
        remaining:left
      };
    }
    if(warning){
      return {
        level:"warning",
        label:"Il reste "+dashboardRunCountLabel(left)+" avant lundi 9 h",
        remaining:left
      };
    }
    return {
      level:"neutral",
      label:"Reset lundi 9 h · Encore "+dashboardRunCountLabel(left)+
        " disponible"+(left > 1 ? "s" : ""),
      remaining:left
    };
  }

  function buildDashboardState(input){
    const source = input || {};
    const userId = source.userId || "";
    const weekStart = source.weekStart || "";
    const sessions = (source.sessions || []).filter(session =>
      session &&
      session.week_start === weekStart &&
      (session.status === "open" || session.status === "archived")
    );
    const sessionById = new Map(sessions.map(session => [session.id, session]));
    const seen = new Set();
    const mine = (source.membership || []).filter(member => {
      if(!member || member.owner !== userId || !sessionById.has(member.session_id)){
        return false;
      }
      if(seen.has(member.session_id)) return false;
      seen.add(member.session_id);
      return true;
    });
    const reports = new Map(
      (source.reports || []).map(report => [report.session_id, report])
    );
    const ownTeamCount = (source.teams || []).filter(team =>
      team && team.owner === userId
    ).length;
    const groups = mine.map(member => {
      const session = sessionById.get(member.session_id);
      const report = reports.get(session.id) || null;
      return {
        id:session.id,
        slot:Number(session.slot) || 0,
        runNo:Number(session.run_no) || 1,
        title:session.title || "Groupe "+(session.slot || ""),
        status:session.status,
        completedAt:session.completed_at || null,
        memberCount:(source.membership || []).filter(row =>
          row && row.session_id === session.id
        ).length,
        teamSelected:!!member.team_snapshot,
        report:report ? {
          globalScore:String(report.global_score),
          note:String(report.note || "")
        } : null,
        canEditReport:session.status === "archived" && !!report
      };
    }).sort((a,b) => {
      if(a.status !== b.status) return a.status === "open" ? -1 : 1;
      if(a.status === "open" && a.teamSelected !== b.teamSelected){
        return a.teamSelected ? 1 : -1;
      }
      if(a.status === "archived"){
        const dateOrder = String(b.completedAt || "")
          .localeCompare(String(a.completedAt || ""));
        if(dateOrder) return dateOrder;
      }
      return a.slot - b.slot || a.runNo - b.runNo;
    });
    const completed = groups.filter(group => group.status === "archived").length;
    const open = groups.filter(group => group.status === "open").length;
    const engaged = groups.length;
    const remaining = Math.max(0, 3 - engaged);
    const actions = [];
    groups.filter(group => group.status === "open").forEach(group => {
      const type = group.teamSelected
        ? "view-group"
        : (ownTeamCount ? "choose-team" : "create-team");
      actions.push({
        type,
        sessionId:group.id,
        slot:group.slot,
        runNo:group.runNo,
        label:type === "view-group"
          ? "Voir le groupe"
          : (type === "choose-team" ? "Choisir mon équipe" : "Créer une équipe"),
        priority:group.teamSelected ? 2 : 1
      });
    });
    if(remaining > 0){
      actions.push({
        type:"find-group",
        sessionId:null,
        slot:null,
        runNo:null,
        label:"Trouver un groupe",
        priority:3
      });
    }
    groups
      .filter(group => group.canEditReport)
      .forEach(group => actions.push({
        type:"edit-report",
        sessionId:group.id,
        slot:group.slot,
        runNo:group.runNo,
        label:"Corriger le rapport",
        priority:4
      }));
    actions.sort((a,b) =>
      a.priority - b.priority ||
      (a.slot || 0) - (b.slot || 0) ||
      (a.runNo || 0) - (b.runNo || 0)
    );
    return {
      weekStart,
      engaged,
      completed,
      open,
      remaining,
      hasOwnTeams:ownTeamCount > 0,
      groups,
      actions,
      deadlineStatus:dashboardDeadlineStatus(source.now || new Date(), remaining),
      lastSyncedAt:Number(source.lastSyncedAt) || null,
      offline:!!source.offline
    };
  }

  const frDate = iso => iso ? new Date(iso+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "";
  const frDateTime = iso => iso
    ? new Date(iso).toLocaleString("fr-FR", {
        day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"
      })
    : "";
  const BOSS_SCORE_FORMAT = new Intl.NumberFormat("fr-FR");

  function bossScoreBigInt(value){
    try{
      return BigInt(String(value));
    }catch(error){
      return null;
    }
  }

  function formatBossScore(value){
    const score = typeof value === "bigint" ? value : bossScoreBigInt(value);
    return score === null ? "—" : BOSS_SCORE_FORMAT.format(score);
  }

  function isBossSchemaCompatibilityError(error){
    const code = String(error && error.code || "").toUpperCase();
    const message = String(error && error.message || "");
    if([
      "PGRST202",
      "PGRST204",
      "PGRST205",
      "42P01",
      "42703",
      "42883",
      "42501"
    ].includes(code)) return true;
    return /\b(?:PGRST202|PGRST204|PGRST205|42P01|42703|42883|42501)\b/i
      .test(message) ||
      /schema cache[\s\S]*(?:boss_run_reports|select_boss_team|complete_boss_run_with_report|update_boss_run_report)/i
        .test(message) ||
      /permission denied for function\s+(?:select_boss_team|complete_boss_run_with_report|update_boss_run_report)/i
        .test(message);
  }

  function bossStatsForWeek(groups, reports, weekStart){
    const weekGroups = (groups || [])
      .filter(group => group.week_start === weekStart);
    const sessions = new Map(weekGroups.map(group => [group.id, group]));
    const ids = new Set(sessions.keys());
    const rows = (reports || [])
      .filter(report => ids.has(report.session_id))
      .slice()
      .sort((a,b)=>{
        const aCompleted = sessions.get(a.session_id)?.completed_at || "";
        const bCompleted = sessions.get(b.session_id)?.completed_at || "";
        return String(bCompleted).localeCompare(String(aCompleted)) ||
          String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
    const scores = rows.map(report => BigInt(String(report.global_score)));
    const sum = scores.reduce((total, score) => total + score, 0n);
    return {
      count:scores.length,
      best:scores.length ? scores.reduce((a,b) => a > b ? a : b) : null,
      average:scores.length
        ? (sum + BigInt(Math.floor(scores.length / 2))) /
          BigInt(scores.length)
        : null,
      latest:rows[0] || null
    };
  }

  function previousBossWeekStart(weekStart){
    const date = new Date(weekStart+"T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() - 7);
    return date.toISOString().slice(0,10);
  }

  function bossEvolutionPercentage(difference, previousAverage){
    if(previousAverage <= 0n) return "";
    const sign = difference > 0n ? "+" : (difference < 0n ? "−" : "");
    const absolute = difference < 0n ? -difference : difference;
    const hundredths = (
      absolute * 10000n + previousAverage / 2n
    ) / previousAverage;
    const integer = hundredths / 100n;
    const decimals = (hundredths % 100n).toString().padStart(2, "0");
    return sign+integer.toString()+","+decimals+" %";
  }

export {
  bossEvolutionPercentage,
  bossScoreBigInt,
  bossStatsForWeek,
  buildDashboardState,
  currentBossWeek,
  formatBossScore,
  frDate,
  frDateTime,
  isBossSchemaCompatibilityError,
  previousBossWeekStart
};
