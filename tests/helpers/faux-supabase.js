"use strict";

/* Le faux Supabase des tests navigateur : auth, tables, RLS et Realtime.

   Il vivait dans supabase-etape1.playwright.js. Il en est sorti le jour ou un
   second parcours en a eu besoin : deux copies auraient diverge, et une regle
   d'acces qui differe entre deux harnais ne prouve plus rien.

   Le faux applique les memes refus que la RLS reelle — AUTH_REQUIRED,
   RPC_REQUIRED, lecture vide — parce qu'un harnais plus permissif que la
   production laisserait passer exactement les fautes qu'on cherche. */
async function installFakeSupabase(page){
  await page.addInitScript(() => {
    const emptyHeroes = () => Array.from({ length:4 }, () => ({
      char:null,
      weapon:null,
      armor:{ Haut:null, Bas:null, Bottes:null, Ceinture:null, "Armure liee":null },
      jewel:{ Anneau:null, Collier:null, "Boucle d'oreille":null },
      potentiel:{ tier:0 },
      note:""
    }));
    const state = {
      session:null,
      authCallbacks:[],
      realtimeChannels:[],
      realtimeTables:[],
      removedRealtimeChannels:0,
      failNextRosterUpsert:false,
      rosterConflictOnce:false,
      profiles:[
        { id:"user-1", pseudo:"Yannis" },
        { id:"user-2", pseudo:"Merlin" }
      ],
      teams:[
        {
          id:"team-own",
          owner:"user-1",
          pseudo:"Yannis",
          data:{ id:"team-own", pseudo:"Yannis", heroes:emptyHeroes() },
          created_at:"2026-07-24T20:00:00.000Z",
          updated_at:"2026-07-25T08:00:00.000Z"
        },
        {
          id:"team-other",
          owner:"user-2",
          pseudo:"Merlin",
          data:{ id:"team-other", pseudo:"Merlin", heroes:emptyHeroes() },
          created_at:"2026-07-24T19:00:00.000Z",
          updated_at:"2026-07-25T07:00:00.000Z"
        }
      ],
      recensement:[
        {
          owner:"user-1",
          pseudo:"Yannis",
          dps:[{ char:"meliodas", element:"FIRE", pot:7 }],
          updated_at:"2026-07-25T08:30:00.000Z"
        },
        {
          owner:"user-2",
          pseudo:"Merlin",
          dps:[{ char:"merlin", element:"ICE", pot:9 }],
          updated_at:"2026-07-25T08:20:00.000Z"
        }
      ],
      roster_characters:[
        {
          owner:"user-1",
          char_id:"meliodas",
          potential_tier:7,
          builds:{
            Hache:{
              weapon:"7ds-armes/Hache/Hache à l'aura triomphale.webp",
              armor:{
                Haut:"7ds-armures-ssr/Haut/Haut de la mélodie d'Arachnée.webp"
              },
              jewel:{
                Anneau:"7ds-bijoux/Anneau/Anneau de la mélodie d'Arachnée.webp"
              },
              note:"Mon build",
              favorite:true
            },
            "Epee 1 main":{
              weapon:"7ds-armes/Epee 1 main/En plein cœur !.webp",
              armor:{},
              jewel:{},
              note:"",
              favorite:false
            },
            "Epees doubles":{
              weapon:"7ds-armes/Epees doubles/Épées doubles bénies.webp",
              armor:{},
              jewel:{},
              note:"Build doubles",
              favorite:false
            }
          },
          updated_at:"2026-07-25T08:40:00.123456Z"
        },
        {
          owner:"user-2",
          char_id:"merlin",
          potential_tier:9,
          builds:{
            Livre:{ weapon:"7ds-armes/Livre/Grimoire béni.webp", armor:{}, jewel:{}, note:"" }
          },
          updated_at:"2026-07-25T08:35:00.000Z"
        }
      ],
      boss_sessions:[],
      boss_participation:[],
      boss_run_reports:[],
      /* L'accueil lit les dispos de la semaine : sans cette table, la lecture
         echoue et la carte disparait — le harnais mentirait sur l'etat reel. */
      member_availability:[],
      /* Collection : une ligne par objet possede, cle primaire (owner, item). */
      collection_items:[],
      calls:[],
      rpcCalls:[],
      bossRpcFailureOnce:null,
      bossRpcHold:null,
      bossReadHold:null,
      bossReadQueue:[],
      bossReadFailureOnce:null,
      profileReadHold:null
    };

    function clone(value){
      return value == null ? value : JSON.parse(JSON.stringify(value));
    }

    function emit(event){
      const session = clone(state.session);
      queueMicrotask(() => state.authCallbacks.forEach(callback => callback(event, session)));
    }

    function tableRows(table){
      return state[table];
    }

    /* Malgre son nom, cet objet couvre desormais toutes les tables dont la RLS
       dit `to authenticated` : lecture partagee entre membres connectes,
       ecriture refusee sans compte. `collection_items` en fait partie. */
    const bossAcl = {
      sharedReadTables:new Set([
        "boss_sessions",
        "boss_participation",
        "boss_run_reports",
        "collection_items"
      ]),
      rpcOnlyWriteTables:new Set([
        "boss_participation",
        "boss_run_reports"
      ]),
      owner(){
        return state.session && state.session.user && state.session.user.id;
      },
      canRead(table){
        return !this.sharedReadTables.has(table) || !!this.owner();
      },
      requiresAuthentication(table, operation){
        return operation !== "select" && this.sharedReadTables.has(table);
      },
      requiresRpc(table, operation){
        if(operation === "select") return false;
        if(this.rpcOnlyWriteTables.has(table)) return true;
        return table === "boss_sessions" && operation !== "upsert";
      }
    };

    function currentBossWeekStart(now){
      const p = new Intl.DateTimeFormat("en-CA",{ timeZone:"Europe/Paris",
        year:"numeric", month:"2-digit", day:"2-digit", weekday:"short", hour:"2-digit", hourCycle:"h23" })
        .formatToParts(now || new Date());
      const get = type => (p.find(item => item.type === type) || {}).value;
      const year = +get("year"), month = +get("month"), day = +get("day"), hour = +get("hour");
      const weekday = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[get("weekday")];
      let offset = (weekday + 6) % 7;
      if(weekday === 1 && hour < 9) offset = 7;
      const start = new Date(Date.UTC(year, month - 1, day));
      start.setUTCDate(start.getUTCDate() - offset);
      return start.toISOString().slice(0,10);
    }

    async function rpc(name, args){
      const sessionId = args && args.p_session_id;
      const owner = bossAcl.owner();
      const fail = message => ({ data:null, error:{ message } });
      state.rpcCalls.push({ name, args:clone(args) });
      if(!owner) return fail("AUTH_REQUIRED");
      const hold = state.bossRpcHold;
      if(hold && (!hold.name || hold.name === name)){
        await new Promise(resolve => { hold.release = resolve; });
        if(state.bossRpcHold === hold) state.bossRpcHold = null;
      }
      if(state.bossRpcFailureOnce &&
        (!state.bossRpcFailureOnce.name || state.bossRpcFailureOnce.name === name)){
        const message = state.bossRpcFailureOnce.message;
        state.bossRpcFailureOnce = null;
        return fail(message);
      }
      if(name === "update_roster_build"){
        let row = state.roster_characters.find(item =>
          item.owner === owner && item.char_id === args.p_char_id
        );
        if(state.rosterConflictOnce && row){
          state.rosterConflictOnce = false;
          row.updated_at = new Date(
            Date.parse(row.updated_at) + 1_000
          ).toISOString().replace(/\.\d{3}Z$/, ".654321Z");
          if(row.builds["Epee 1 main"]){
            row.builds["Epee 1 main"].note = "Modification concurrente";
          }
        }
        const expected = args.p_expected_updated_at;
        if(row){
          if(!expected || row.updated_at !== expected){
            return fail("ROSTER_CONFLICT");
          }
          row.potential_tier = args.p_potential_tier;
          row.builds[args.p_weapon_type] = clone(args.p_build);
          row.updated_at = new Date(
            Date.parse(row.updated_at) + 1_000
          ).toISOString().replace(/\.\d{3}Z$/, ".654321Z");
        }else{
          if(expected) return fail("ROSTER_CONFLICT");
          row = {
            owner,
            char_id:args.p_char_id,
            potential_tier:args.p_potential_tier,
            builds:{
              [args.p_weapon_type]:clone(args.p_build)
            },
            updated_at:"2026-07-25T09:00:00.123456Z"
          };
          state.roster_characters.push(row);
        }
        return { data:clone(row), error:null };
      }
      if(name === "complete_boss_run") return fail("REPORT_REQUIRED");

      const scoreValue = value => {
        if(typeof value === "number" && !Number.isSafeInteger(value)) return null;
        const text = String(value == null ? "" : value).trim();
        if(!/^[+-]?\d+$/.test(text)) return null;
        try{
          const exact = BigInt(text);
          if(exact <= 0n) return null;
          return {
            exact,
            stored:exact <= BigInt(Number.MAX_SAFE_INTEGER)
              ? Number(exact)
              : exact.toString()
          };
        }catch(error){
          return null;
        }
      };
      const noteValue = value => String(value == null ? "" : value);
      const profile = state.profiles.find(item => item.id === owner);
      const pseudo = (profile && String(profile.pseudo || "").trim()) || "Membre";

      if(name === "update_boss_run_report"){
        const report = state.boss_run_reports.find(item =>
          item.session_id === sessionId
        );
        if(!report) return fail("REPORT_NOT_FOUND");
        const reportRun = state.boss_sessions.find(item =>
          item.id === report.session_id
        );
        if(!reportRun || reportRun.status !== "archived"){
          return fail("RUN_NOT_ARCHIVED");
        }
        const mine = state.boss_participation.some(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!mine) return fail("NOT_A_PARTICIPANT");
        const score = scoreValue(args && args.p_global_score);
        if(!score) return fail("INVALID_SCORE");
        const note = noteValue(args && args.p_note);
        if(Array.from(note).length > 1000) return fail("NOTE_TOO_LONG");
        report.global_score = score.stored;
        report.note = note.trim();
        report.updated_by = owner;
        report.updated_by_pseudo = pseudo;
        report.updated_at = "2026-07-25T10:45:00.000Z";
        return { data:null, error:null };
      }

      const run = state.boss_sessions.find(item => item.id === sessionId);
      if(!run) return fail("RUN_NOT_FOUND");
      if(!run.week_start || run.week_start !== currentBossWeekStart()){
        return fail("RUN_INVALID_WEEK");
      }

      if(name === "join_boss_run"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        if(state.boss_participation.some(item =>
          item.session_id === sessionId && item.owner === owner
        )) return { data:null, error:null };
        const memberCount = state.boss_participation.filter(item =>
          item.session_id === sessionId
        ).length;
        if(memberCount >= 5) return fail("GROUP_FULL");
        const weekSessionIds = new Set(state.boss_sessions
          .filter(item => item.week_start === run.week_start)
          .map(item => item.id));
        const used = state.boss_participation.filter(item =>
          item.owner === owner && weekSessionIds.has(item.session_id)
        ).length;
        if(used >= 3) return fail("RUN_LIMIT_REACHED");
        state.boss_participation.push({
          session_id:sessionId,
          owner,
          pseudo,
          team_id:null,
          team_snapshot:null,
          updated_at:"2026-07-25T10:00:00.000Z"
        });
        return { data:null, error:null };
      }

      if(name === "select_boss_team"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        const membership = state.boss_participation.find(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!membership) return fail("NOT_A_PARTICIPANT");
        const team = state.teams.find(item =>
          item.id === args.p_team_id && item.owner === owner
        );
        if(!team) return fail("TEAM_NOT_OWNED");
        membership.team_id = team.id;
        membership.team_snapshot = clone({
          id:team.id,
          owner:team.owner,
          pseudo:team.pseudo,
          data:team.data,
          createdAt:team.created_at,
          updatedAt:team.updated_at,
          capturedAt:"2026-07-25T10:15:00.000Z"
        });
        membership.updated_at = "2026-07-25T10:15:00.000Z";
        emitDatabase("boss_participation", "UPDATE");
        return { data:null, error:null };
      }

      if(name === "leave_boss_run"){
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        state.boss_participation = state.boss_participation.filter(item =>
          item.session_id !== sessionId || item.owner !== owner
        );
        return { data:null, error:null };
      }

      if(name === "complete_boss_run_with_report"){
        const members = state.boss_participation.filter(item =>
          item.session_id === sessionId
        );
        if(run.status !== "open") return fail("RUN_ARCHIVED");
        const mine = members.some(item =>
          item.session_id === sessionId && item.owner === owner
        );
        if(!mine || members.length < 1) return fail("NOT_A_PARTICIPANT");
        if(members.length > 5) return fail("GROUP_OVER_CAPACITY");
        const missing = members.filter(item => !item.team_snapshot);
        if(missing.length){
          return fail(
            "TEAM_REQUIRED:" +
            (missing.map(item => item.pseudo || "Membre").join(", ") || "Membre")
          );
        }
        const score = scoreValue(args && args.p_global_score);
        if(!score) return fail("INVALID_SCORE");
        const note = noteValue(args && args.p_note);
        if(Array.from(note).length > 1000) return fail("NOTE_TOO_LONG");

        state.boss_run_reports.push({
          session_id:sessionId,
          global_score:score.stored,
          note:note.trim(),
          created_by:owner,
          created_by_pseudo:pseudo,
          created_at:"2026-07-25T10:30:00.000Z",
          updated_by:null,
          updated_by_pseudo:null,
          updated_at:null
        });
        run.status = "archived";
        run.completed_at = "2026-07-25T10:30:00.000Z";
        const nextRunNo = (run.run_no || 1) + 1;
        if(!state.boss_sessions.some(item =>
          item.week_start === run.week_start &&
          item.slot === run.slot &&
          item.run_no === nextRunNo
        )){
          state.boss_sessions.push({
            id:"boss-" + run.week_start + "-" + run.slot + "-" + nextRunNo,
            created_by:owner,
            title:"Groupe " + run.slot,
            boss_name:run.boss_name || null,
            session_date:run.session_date || null,
            week_start:run.week_start,
            slot:run.slot,
            run_no:nextRunNo,
            elements:clone(run.elements || []),
            status:"open",
            completed_at:null,
            created_at:"2026-07-25T10:30:00.000Z"
          });
        }
        return { data:null, error:null };
      }

      return fail("RPC inconnue");
    }

    function query(table){
      let operation = "select";
      let payload = null;
      let upsertOptions = null;
      const filters = [];
      const sorts = [];
      const matchRow = row => filters.every(([key, value]) => {
        if(typeof key === "string" && key.startsWith("__in:")) return value.includes(row[key.slice(5)]);
        return row[key] === value;
      });
      const builder = {
        select(){ operation = "select"; return builder; },
        order(column, options){ sorts.push([column, options && options.ascending === false ? -1 : 1]); return builder; },
        eq(column, value){ filters.push([column, value]); return builder; },
        in(column, values){ filters.push(["__in:" + column, values || []]); return builder; },
        maybeSingle(){ return execute().then(result => ({
          data:Array.isArray(result.data) ? (result.data[0] || null) : result.data,
          error:result.error
        })); },
        upsert(value, options){ operation = "upsert"; payload = clone(value); upsertOptions = options || null; return execute(); },
        insert(value){ operation = "insert"; payload = clone(value); return execute(); },
        update(value){ operation = "update"; payload = clone(value); return builder; },
        delete(){ operation = "delete"; return builder; },
        then(resolve, reject){ return execute().then(resolve, reject); }
      };

      async function execute(){
        state.calls.push({ table, operation, filters:clone(filters), payload:clone(payload) });
        const rows = tableRows(table);
        if(!Array.isArray(rows)) return { data:null, error:{ message:"Table inconnue" } };

        const rpcRequired = () => ({ data:null, error:{ message:"RPC_REQUIRED" } });
        if(
          bossAcl.requiresAuthentication(table, operation) &&
          !bossAcl.owner()
        ){
          return { data:null, error:{ message:"AUTH_REQUIRED" } };
        }
        if(bossAcl.requiresRpc(table, operation)){
          return rpcRequired();
        }

        if(operation === "select"){
          const selected = bossAcl.canRead(table)
            ? clone(rows.filter(matchRow))
            : [];
          if(sorts.length){
            selected.sort((a,b) => {
              for(const [col,dir] of sorts){
                const av = a[col], bv = b[col];
                let c;
                if(typeof av === "number" && typeof bv === "number") c = (av - bv);
                else c = String(av==null?"":av).localeCompare(String(bv==null?"":bv));
                if(c) return c * dir;
              }
              return 0;
            });
          }
          const queuedHold = state.bossReadQueue.find(item =>
            !item.claimed && (!item.table || item.table === table)
          );
          if(queuedHold){
            queuedHold.claimed = true;
            await new Promise(resolve => { queuedHold.release = resolve; });
            queuedHold.finished = true;
            if(queuedHold.error){
              return { data:null, error:{ message:queuedHold.error } };
            }
          }
          if(state.bossReadFailureOnce &&
            (!state.bossReadFailureOnce.table || state.bossReadFailureOnce.table === table)){
            const message = state.bossReadFailureOnce.message;
            state.bossReadFailureOnce = null;
            return { data:null, error:{ message } };
          }
          const hold = state.bossReadHold;
          if(
            hold &&
            (!hold.table || hold.table === table) &&
            (!hold.once || !hold.claimed)
          ){
            hold.claimed = true;
            await new Promise(resolve => { hold.release = resolve; });
            if(state.bossReadHold === hold) state.bossReadHold = null;
          }
          const profileHold = state.profileReadHold;
          const profileId = filters.find(([key]) => key === "id");
          if(table === "profiles" && profileHold &&
            (!profileHold.userId || (profileId && profileId[1] === profileHold.userId))){
            await new Promise(resolve => { profileHold.release = resolve; });
            if(state.profileReadHold === profileHold) state.profileReadHold = null;
          }
          return { data:selected, error:null };
        }

        if(operation === "delete"){
          for(let index = rows.length - 1; index >= 0; index--){
            if(matchRow(rows[index])) rows.splice(index, 1);
          }
          /* Supabase renvoie l'echo de sa PROPRE ecriture : le taire ici
             rendrait le harnais plus doux que la production. */
          if(table === "collection_items") emitDatabase(table, "DELETE");
          return { data:null, error:null };
        }

        if(operation === "update"){
          rows.forEach((row, index) => {
            if(matchRow(row)) rows[index] = Object.assign({}, row, payload);
          });
          return { data:null, error:null };
        }

        const values = Array.isArray(payload) ? payload : [payload];

        /* `collection_items` : la cle primaire (owner, item) et la politique
           d'insertion `owner = auth.uid()`, toutes deux appliquees ici. Un
           doublon rend 23505 comme PostgreSQL, parce que le client compte
           dessus pour ne PAS traiter un double clic en erreur. */
        if(table === "collection_items" && operation === "insert"){
          const owner = bossAcl.owner();
          if(values.some(value => value.owner !== owner)){
            return { data:null, error:{ code:"42501",
              message:"new row violates row-level security policy" } };
          }
          if(values.some(value => rows.some(row =>
            row.owner === value.owner && row.item === value.item
          ))){
            return { data:null, error:{ code:"23505",
              message:"duplicate key value violates unique constraint" } };
          }
          values.forEach(value => rows.push(Object.assign({
            created_at:"2026-07-25T11:00:00.000Z"
          }, value)));
          emitDatabase(table, "INSERT");
          return { data:clone(values), error:null };
        }

        if(table === "boss_sessions"){
          const validSeed = operation === "upsert" &&
            upsertOptions && upsertOptions.ignoreDuplicates === true &&
            values.length === 6 &&
            values.every(value =>
              value.created_by === (state.session && state.session.user && state.session.user.id) &&
              value.week_start === currentBossWeekStart() &&
              value.session_date === value.week_start &&
              (value.run_no == null || value.run_no === 1) &&
              value.title === "Groupe " + value.slot &&
              value.boss_name === "Akumu, bête démoniaque" &&
              Array.isArray(value.elements) && value.elements.length === 0 &&
              value.status === "open" &&
              value.completed_at == null &&
              value.remind_at == null &&
              value.reminded_at == null
            );
          const slots = values.map(value => value.slot).sort((a,b) => a-b);
          if(!validSeed || slots.join(",") !== "1,2,3,4,5,6") return rpcRequired();
        }
        if(table === "roster_characters" && state.failNextRosterUpsert){
          state.failNextRosterUpsert = false;
          return { data:null, error:{ message:"Échec simulé" } };
        }
        values.forEach(value => {
          const index = rows.findIndex(row => {
            if(table === "roster_characters"){
              return row.owner === value.owner && row.char_id === value.char_id;
            }
            if(table === "boss_participation"){
              return row.session_id === value.session_id && row.owner === value.owner;
            }
            if(table === "boss_sessions"){
              return row.week_start === value.week_start &&
                row.slot === value.slot &&
                (row.run_no || 1) === (value.run_no || 1);
            }
            const key = table === "profiles"
              ? "id"
              : (table === "recensement" ? "owner" : "id");
            return row[key] === value[key];
          });
          // onConflict + ignoreDuplicates : on ne réécrit pas une ligne déjà là (garde son id).
          if(index >= 0 && upsertOptions && upsertOptions.ignoreDuplicates) return;
          const stamped = Object.assign({}, value);
          if(table === "boss_sessions") stamped.run_no = stamped.run_no || 1;
          if(table === "teams"){
            stamped.created_at = index >= 0 ? rows[index].created_at : "2026-07-25T09:00:00.000Z";
            stamped.updated_at = stamped.updated_at || "2026-07-25T09:00:00.000Z";
          }
          if(index >= 0) rows[index] = Object.assign({}, rows[index], stamped);
          else rows.push(stamped);
        });
        return { data:clone(values), error:null };
      }

      return builder;
    }

    function channel(name){
      const handlers = [];
      const realtimeChannel = {
        name,
        handlers,
        on(kind, filter, callback){
          if(
            kind === "postgres_changes" &&
            !state.realtimeTables.includes(filter.table)
          ){
            state.realtimeTables.push(filter.table);
          }
          handlers.push({ kind, filter:clone(filter), callback });
          return realtimeChannel;
        },
        subscribe(callback){
          realtimeChannel.statusCallback = callback;
          state.realtimeChannels.push(realtimeChannel);
          queueMicrotask(() => callback("SUBSCRIBED"));
          return realtimeChannel;
        }
      };
      return realtimeChannel;
    }

    function emitDatabase(table, eventType){
      state.realtimeChannels.forEach(realtimeChannel => {
        realtimeChannel.handlers
          .filter(handler =>
            handler.kind === "postgres_changes" &&
            handler.filter.schema === "public" &&
            handler.filter.table === table
          )
          .forEach(handler => handler.callback({
            schema:"public",
            table,
            eventType:eventType || "UPDATE",
            new:{},
            old:{}
          }));
      });
    }

    window.__fakeSupabaseState = state;
    window.__fakeSupabaseEmit = emitDatabase;
    window.__fakeSupabaseHoldBossRpc = name => {
      state.bossRpcHold = { name, release:null };
    };
    window.__fakeSupabaseReleaseBossRpc = () => {
      const hold = state.bossRpcHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseHoldBossRead = table => {
      state.bossReadHold = { table, release:null, once:false, claimed:false };
    };
    window.__fakeSupabaseHoldBossReadOnce = table => {
      state.bossReadHold = { table, release:null, once:true, claimed:false };
    };
    window.__fakeSupabaseReleaseBossRead = () => {
      const hold = state.bossReadHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseQueueBossRead = (token, table, error) => {
      state.bossReadQueue.push({
        token,
        table,
        error:error || null,
        claimed:false,
        release:null,
        finished:false
      });
    };
    window.__fakeSupabaseReleaseQueuedBossRead = token => {
      const hold = state.bossReadQueue.find(item => item.token === token);
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseClearBossReadQueue = () => {
      state.bossReadQueue = state.bossReadQueue.filter(item => !item.finished);
    };
    window.__fakeSupabaseHoldProfileRead = userId => {
      state.profileReadHold = { userId, release:null };
    };
    window.__fakeSupabaseReleaseProfileRead = () => {
      const hold = state.profileReadHold;
      if(!hold || typeof hold.release !== "function") return false;
      hold.release();
      return true;
    };
    window.__fakeSupabaseApplySession = user => {
      state.session = user ? { user:clone(user) } : null;
      emit(user ? "SIGNED_IN" : "SIGNED_OUT");
    };
    localStorage.setItem("confrerie7ds.teams", JSON.stringify([{
      id:"local-team",
      pseudo:"Ancien pseudo",
      heroes:emptyHeroes(),
      createdAt:1700000000000,
      updatedAt:1700000000000
    }]));
    localStorage.setItem("confrerie7ds.recensement", JSON.stringify([{
      id:"local-player",
      name:"Yannis",
      dps:[{ char:"diane", element:"EARTH", pot:6 }]
    }]));
    localStorage.setItem(
      "confrerie7ds.cloud.recensement",
      JSON.stringify([{ owner:"legacy-user", dps:[] }])
    );
    window.__fakeSupabaseClient = {
      auth:{
        async getSession(){ return { data:{ session:clone(state.session) }, error:null }; },
        async signInWithPassword({ email }){
          state.session = { user:{ id:"user-1", email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
        async signUp({ email }){
          state.session = { user:{ id:"user-1", email } };
          emit("SIGNED_IN");
          return { data:{ session:clone(state.session), user:clone(state.session.user) }, error:null };
        },
        async signOut(){
          state.session = null;
          emit("SIGNED_OUT");
          return { error:null };
        },
        onAuthStateChange(callback){
          state.authCallbacks.push(callback);
          return { data:{ subscription:{ unsubscribe(){} } } };
        }
      },
      channel,
      async removeChannel(realtimeChannel){
        state.realtimeChannels = state.realtimeChannels
          .filter(item => item !== realtimeChannel);
        state.removedRealtimeChannels++;
        return "ok";
      },
      rpc,
      from:query
    };
  });

  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2*", route =>
    route.fulfill({
      status:200,
      contentType:"application/javascript",
      body:"window.supabase={createClient:function(){return window.__fakeSupabaseClient;}};"
    })
  );
}

module.exports = { installFakeSupabase };
