/* L'onglet « Sessions de boss » : les six groupes de la semaine, l'inscription
   des membres, le choix d'equipe, les rapports et l'archive des semaines
   passees.

   Six groupes sont crees chaque semaine et remis a zero le lundi a 9h. La
   semaine de boss n'est donc PAS la semaine calendaire : voir currentBossWeek()
   dans metier/boss-logique.js.

   L'etat de la vue est en tete du module et non dans etat/ : il ne sort d'ici
   que pour « Mon suivi », qui lit `bossViewState` et appelle
   `ensureBossViewOwner`. Le reste — intentions en attente, jetons de rendu —
   ne regarde que cette vue, et les rendus s'appellent entre eux, ce qui rendait
   toute separation etat/vue circulaire.

   Ce module reste gros. S'il faut le redecouper, les deux modales — le rapport
   de boss et le choix d'equipe — sont les candidats naturels ; elles partagent
   `bossViewState`, qui devra sortir en premier. */

import { BOSS_NAME, BossStore } from "../donnees/boss-store.js";
import { Store } from "../donnees/equipes-store.js";
import { sessionCourante } from "../etat/session.js";
import {
  bossEvolutionPercentage,
  bossScoreBigInt,
  bossStatsForWeek,
  currentBossWeek,
  formatBossScore,
  frDate,
  frDateTime,
  isBossSchemaCompatibilityError,
  previousBossWeekStart
} from "../metier/boss-logique.js";
import { charOf } from "../metier/catalogue.js";
import { teamFromBossSnapshot } from "../metier/equipe-modele.js";
import { $, el } from "../noyau/dom.js";
import { authMessage } from "../noyau/supabase-client.js";
import { openTeamDetail } from "./detail-equipe.js";
import { bossReportParticipant, bossTeamBanner } from "./equipe-boss.js";
import { ModalStack, closeModalAfterAsyncRefresh } from "./modal-stack.js";
import { openAuth } from "./modale-auth.js";
import { mainTabs, showView } from "./navigation.js";
import { toast } from "./toast.js";

  /* ============================ Sessions de boss ============================ */
  /* 6 groupes auto-créés chaque semaine (reset lundi 9h). Les membres rejoignent
     un ou plusieurs groupes ; les semaines passées s'archivent toutes seules. */
  const BOSS_SCHEMA_MAINTENANCE_MESSAGE =
    "La version du site et le schéma partagé ne sont pas compatibles. "+
    "La maintenance est en cours ; applique la mise à jour proposée puis recharge la page.";
  let bossRenderIssuedId = 0;
  let bossRenderAppliedId = 0;
  let bossViewOwnerVersion = 0;
  const emptyBossViewState = userId => ({
    userId:userId || "",
    week:null,
    allGroups:[],
    membership:[],
    reports:[],
    ready:false
  });
  let bossViewState = emptyBossViewState("");
  const bossPendingActions = new Map();

  function invalidateBossRenders(){
    bossRenderAppliedId = ++bossRenderIssuedId;
  }

  function ensureBossViewOwner(){
    const userId = sessionCourante.user ? sessionCourante.user.id : "";
    if(bossViewState.userId === userId) return;
    bossViewOwnerVersion++;
    if(bossTeamPickerContext && bossTeamPickerContext.userId !== userId){
      closeBossTeamPicker();
    }
    if(bossReportContext && bossReportContext.userId !== userId){
      closeBossReport();
    }
    invalidateBossRenders();
    bossViewState = emptyBossViewState(userId);
    bossPendingActions.clear();
  }

  function bossApplyIntent(membership, sessionId, intent){
    const owner = sessionCourante.user && sessionCourante.user.id;
    const next = (membership || []).filter(member =>
      member.session_id !== sessionId || member.owner !== owner
    );
    if(intent && intent.type === "join") next.push(intent.member);
    return next;
  }

  function bossVisibleMembership(){
    let membership = (bossViewState.membership || []).slice();
    bossPendingActions.forEach((intent, sessionId) => {
      membership = bossApplyIntent(membership, sessionId, intent);
    });
    return membership;
  }

  function bossStatCell(label, className, value){
    return el("div",{class:"boss-stat"},[
      el("span",{class:"boss-stat-label",text:label}),
      el("span",{class:"boss-stat-value "+className,text:value})
    ]);
  }

  function bossStatsBlock(groups, reports, weekStart){
    const current = bossStatsForWeek(groups, reports, weekStart);
    const previous = bossStatsForWeek(
      groups,
      reports,
      previousBossWeekStart(weekStart)
    );
    const head = el("div",{class:"boss-stats-head"},[
      el("h2",{
        class:"boss-stats-title",
        id:"bossStatsTitle",
        text:"Statistiques de la semaine"
      })
    ]);
    if(current.average !== null && previous.average !== null){
      const difference = current.average - previous.average;
      const sign = difference > 0n ? "+" : (difference < 0n ? "−" : "");
      const absolute = difference < 0n ? -difference : difference;
      const percentage = bossEvolutionPercentage(
        difference,
        previous.average
      );
      head.appendChild(el("span",{
        class:"boss-stat-evolution",
        text:sign+formatBossScore(absolute)+" ("+percentage+")"+
          " par rapport à la semaine précédente"
      }));
    }
    const latestScore = current.latest
      ? bossScoreBigInt(current.latest.global_score)
      : null;
    return el("section",{
      class:"boss-stats",
      "aria-labelledby":"bossStatsTitle"
    },[
      head,
      el("div",{class:"boss-stats-grid"},[
        bossStatCell("Rapports", "boss-stat-count", String(current.count)),
        bossStatCell(
          "Meilleur score",
          "boss-stat-best",
          current.best === null ? "—" : formatBossScore(current.best)
        ),
        bossStatCell(
          "Score moyen",
          "boss-stat-average",
          current.average === null ? "—" : formatBossScore(current.average)
        ),
        bossStatCell(
          "Dernier score",
          "boss-stat-latest",
          latestScore === null ? "—" : formatBossScore(latestScore)
        )
      ])
    ]);
  }

  function focusedBossActionIdentity(){
    const body = $("#bossBody");
    const active = document.activeElement;
    if(!active || !body.contains(active)) return null;
    const session = active.closest("[data-session-id]");
    const action = active.dataset.bossAction;
    return session && action
      ? { sessionId:session.dataset.sessionId, action }
      : null;
  }

  function restoreBossActionFocus(identity){
    if(!identity) return;
    const target = [...$("#bossBody").querySelectorAll("[data-boss-action]")]
      .find(node => {
        const session = node.closest("[data-session-id]");
        return node.dataset.bossAction === identity.action &&
          session?.dataset.sessionId === identity.sessionId;
      });
    if(target && target.getClientRects().length) target.focus();
  }

  function renderBossContent(){
    const focusedAction = focusedBossActionIdentity();
    const body = $("#bossBody");
    const week = bossViewState.week || currentBossWeek();
    const allGroups = bossViewState.allGroups || [];
    const membership = bossVisibleMembership();
    const reports = bossViewState.reports || [];

    const weekGroups = allGroups.filter(g => g.week_start === week.startDate);
    const current = weekGroups
      .filter(g => g.status === "open")
      .sort((a,b)=>(a.slot||0)-(b.slot||0));
    const completedCurrent = weekGroups
      .filter(g => g.status === "archived")
      .sort((a,b)=>(b.completed_at||"").localeCompare(a.completed_at||""));
    const past = allGroups.filter(g => g.week_start && g.week_start !== week.startDate);
    const currentSessionIds = new Set(weekGroups.map(g => g.id));
    const myCount = membership.filter(m =>
      m.owner === sessionCourante.user.id && currentSessionIds.has(m.session_id)
    ).length;

    body.className = ""; body.innerHTML = "";
    $("#bossCount").innerHTML =
      "<b>"+myCount+"/3</b> runs réservés ou terminés";

    body.appendChild(el("div",{class:"boss-weekhead"},[
      el("div",{class:"boss-weekboss", text:BOSS_NAME}),
      el("div",{class:"boss-weeksub", text:"Semaine du "+frDate(week.startDate)+" au "+frDate(week.endDate)+" · reset lundi 9h"})
    ]));
    body.appendChild(bossStatsBlock(allGroups, reports, week.startDate));

    if(!current.length){
      body.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Groupes en préparation…"}),
        el("p",{text:"Recharge la page dans un instant."})
      ]));
    }else{
      const grid = el("div",{class:"boss-grid"});
      current.forEach(g => grid.appendChild(bossGroupCard(g, membership, myCount)));
      body.appendChild(grid);
    }

    if(completedCurrent.length){
      const currentArchive = el("details",{
        class:"boss-archive boss-archive-current",
        open:true
      });
      currentArchive.appendChild(el("summary",{
        text:"Runs terminées cette semaine ("+completedCurrent.length+")"
      }));
      currentArchive.appendChild(
        bossArchiveRows(completedCurrent, membership, reports)
      );
      body.appendChild(currentArchive);
    }
    if(past.length) body.appendChild(bossArchive(past, membership, reports));
    restoreBossActionFocus(focusedAction);
  }

  function renderBossUnavailableState(){
    invalidateBossRenders();
    bossViewState = emptyBossViewState(sessionCourante.user?.id);
    $("#bossCount").textContent = "";
    const body = $("#bossBody");
    body.className = "";
    body.innerHTML = "";
    const retry = el("button",{
      class:"btn btn-primary",
      type:"button",
      text:"Réessayer",
      onclick:()=>void renderBossView()
    });
    body.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Groupes indisponibles"}),
      el("p",{text:"Impossible d’actualiser les groupes pour le moment."}),
      retry
    ]));
    return retry;
  }

  function renderBossCompatibilityState(){
    invalidateBossRenders();
    bossViewState = emptyBossViewState(sessionCourante.user?.id);
    $("#bossCount").textContent = "";
    const body = $("#bossBody");
    body.className = "";
    body.innerHTML = "";
    const retry = el("button",{
      class:"btn btn-primary",
      type:"button",
      text:"Réessayer",
      onclick:()=>void renderBossView()
    });
    body.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Maintenance des rapports de boss"}),
      el("p",{text:BOSS_SCHEMA_MAINTENANCE_MESSAGE}),
      retry
    ]));
    return retry;
  }

  async function renderBossView(options){
    const settings = Object.assign({
      showLoading:true,
      ensureWeek:true,
      showErrorToast:true
    }, options || {});
    const body = $("#bossBody");
    ensureBossViewOwner();
    const renderUserId = sessionCourante.user?.id || "";
    const renderId = ++bossRenderIssuedId;
    const isCurrentRender = () =>
      renderId === bossRenderIssuedId &&
      sessionCourante.user?.id === renderUserId;

    if(!renderUserId){
      $("#bossCount").textContent = "";
      body.className = "";
      body.innerHTML = "";
      body.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour les groupes de boss"}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return true;
    }
    if(settings.showLoading || !bossViewState.ready){
      body.className = "";
      body.innerHTML = "";
      body.appendChild(el("div",{class:"empty-state"},[el("p",{class:"big",text:"Chargement…"})]));
    }

    const week = currentBossWeek();
    try{
      if(settings.ensureWeek) await BossStore.ensureWeek(week);
      const allGroups = await BossStore.listAll();
      const [membership, reports] = await Promise.all([
        BossStore.listMembership(allGroups.map(group => group.id)),
        BossStore.listReports()
      ]);
      if(!isCurrentRender()) return true;
      bossRenderAppliedId = renderId;
      bossViewState = {
        userId:renderUserId,
        week,
        allGroups,
        membership,
        reports,
        ready:true
      };
      renderBossContent();
      reconcileOpenBossReport();
      return true;
    }catch(error){
      if(!isCurrentRender()) return true;
      if(isBossSchemaCompatibilityError(error)){
        if(settings.showErrorToast){
          toast(BOSS_SCHEMA_MAINTENANCE_MESSAGE, true);
        }
        renderBossCompatibilityState();
        return false;
      }
      if(settings.showErrorToast) toast("Groupes indisponibles.", true);
      if(bossViewState.ready){
        renderBossContent();
      }else{
        $("#bossCount").textContent = "";
        body.className = "";
        body.innerHTML = "";
        body.appendChild(el("div",{class:"empty-state"},[
          el("p",{class:"big",text:"Groupes indisponibles"}),
          el("p",{text:"Impossible de charger les groupes pour le moment."}),
          el("button",{
            class:"btn btn-primary",
            type:"button",
            text:"Réessayer",
            onclick:()=>void renderBossView()
          })
        ]));
      }
      return false;
    }
  }

  function bossActionMessage(error){
    const message = String(error && error.message || "");
    if(isBossSchemaCompatibilityError(error)){
      return BOSS_SCHEMA_MAINTENANCE_MESSAGE;
    }
    if(message.includes("RUN_INVALID_WEEK")) return "La semaine de boss a changé. La liste a été actualisée.";
    if(message.includes("AUTH_REQUIRED")) return "Ta session a expiré. Reconnecte-toi pour continuer.";
    if(message.includes("RUN_LIMIT_REACHED")) return "Tes 3 runs de la semaine sont déjà réservés ou terminés.";
    if(message.includes("GROUP_FULL")) return "Ce groupe est déjà complet (5/5).";
    if(message.includes("TEAM_NOT_OWNED")) return "Cette équipe ne t’appartient plus. Actualise tes équipes puis choisis-en une autre.";
    if(message.includes("NOT_A_PARTICIPANT")) return "Seuls les participants peuvent effectuer cette action.";
    if(message.includes("RUN_ARCHIVED")) return "Cette run vient d’être terminée. La liste a été actualisée.";
    if(message.includes("RUN_MEMBERS_ONLY")) return "Seuls les membres de ce groupe peuvent terminer la run.";
    if(message.includes("RUN_NOT_FOUND")) return "Cette run n’existe plus. La liste a été actualisée.";
    return authMessage(error);
  }

  async function changeBossMembership(group, mine){
    const actionUserId = sessionCourante.user?.id;
    if(!actionUserId || bossPendingActions.has(group.id)) return;
    const intent = mine
      ? { type:"leave", member:null }
      : {
          type:"join",
          member:{
            session_id:group.id,
            owner:actionUserId,
            pseudo:sessionCourante.pseudo || "Membre",
            team_id:null,
            team_snapshot:null
          }
        };
    const isCurrentAction = () =>
      sessionCourante.user?.id === actionUserId &&
      bossViewState.userId === actionUserId &&
      bossPendingActions.get(group.id) === intent;
    bossPendingActions.set(group.id, intent);
    renderBossContent();

    try{
      mine
        ? await BossStore.leave(group.id)
        : await BossStore.join(group.id);
      if(!isCurrentAction()) return;
      invalidateBossRenders();
      bossViewState.membership = bossApplyIntent(
        bossViewState.membership,
        group.id,
        intent
      );
      bossPendingActions.delete(group.id);
      renderBossContent();
    }catch(error){
      if(!isCurrentAction()) return;
      bossPendingActions.delete(group.id);
      renderBossContent();
      toast("Action impossible : "+bossActionMessage(error), true);
      void renderBossView({
        showLoading:false,
        ensureWeek:true,
        showErrorToast:false
      });
    }
  }

  let bossTeamPickerRequestId = 0;
  let bossTeamPickerPendingRequestId = null;
  let bossTeamPickerContext = null;

  function isBossTeamPickerCurrent(requestId){
    return !!bossTeamPickerContext &&
      bossTeamPickerContext.requestId === requestId &&
      requestId === bossTeamPickerRequestId &&
      bossTeamPickerContext.ownerVersion === bossViewOwnerVersion &&
      sessionCourante.user?.id === bossTeamPickerContext.userId;
  }

  function closeBossTeamPicker(){
    bossTeamPickerRequestId++;
    bossTeamPickerPendingRequestId = null;
    bossTeamPickerContext = null;
    ModalStack.close($("#bossTeamOverlay"));
  }

  function setBossTeamPickerPending(requestId, pending, activeChoice){
    if(!isBossTeamPickerCurrent(requestId)) return;
    bossTeamPickerPendingRequestId = pending ? requestId : null;
    $("#bossTeamList").querySelectorAll(".boss-team-choice").forEach(choice => {
      choice.disabled = pending;
      choice.removeAttribute("aria-busy");
    });
    if(pending && activeChoice){
      activeChoice.setAttribute("aria-busy", "true");
    }
  }

  function bossTeamPickerEmpty(list){
    list.appendChild(el("div",{class:"boss-team-empty"},[
      el("p",{
        text:"Crée d’abord une équipe dans le Team Builder pour la déclarer sur cette run."
      }),
      el("button",{
        class:"btn btn-primary",
        type:"button",
        text:"Créer une équipe",
        onclick:()=>{
          closeBossTeamPicker();
          showView("builder");
          const tab = mainTabs.find(button => button.dataset.view === "builder");
          if(tab) tab.focus();
        }
      })
    ]));
  }

  function bossTeamPickerTeams(list, teams, group, requestId){
    list.innerHTML = "";
    if(teams.length){
      teams.forEach(team =>
        list.appendChild(bossTeamChoice(team, group, requestId))
      );
    }else{
      bossTeamPickerEmpty(list);
    }
  }

  function bossTeamActionFor(sessionId){
    const card = [...document.querySelectorAll(".boss-card")]
      .find(item => item.dataset.sessionId === sessionId);
    return card
      ? card.querySelector(".boss-member-team-action, .boss-join")
      : mainTabs.find(button => button.dataset.view === "boss");
  }

  function bossTeamChoice(team, group, requestId){
    const pickerUserId = bossTeamPickerContext?.userId;
    const pickerOwnerVersion = bossTeamPickerContext?.ownerVersion;
    const heroes = el("span",{class:"boss-team-choice-heroes"});
    (team.heroes || []).forEach(hero => {
      const character = hero && hero.char ? charOf(hero.char) : null;
      const portrait = el("span",{class:"boss-team-choice-portrait"});
      if(character){
        portrait.appendChild(el("img",{
          src:character.file,
          alt:"",
          loading:"lazy"
        }));
      }else{
        portrait.textContent = "—";
      }
      heroes.appendChild(el("span",{class:"boss-team-choice-hero"},[
        portrait,
        el("span",{
          class:"boss-team-choice-name",
          text:character ? character.name : "Libre"
        })
      ]));
    });

    const choice = el("button",{
      class:"boss-team-choice",
      type:"button",
      onclick:async()=>{
        if(
          choice.disabled ||
          bossTeamPickerPendingRequestId !== null ||
          !isBossTeamPickerCurrent(requestId)
        ) return;
        setBossTeamPickerPending(requestId, true, choice);
        try{
          await BossStore.selectTeam(group.id, team.id);
          if(!isBossTeamPickerCurrent(requestId)) return;
          const refreshed = await renderBossView({
            showLoading:false,
            ensureWeek:false,
            showErrorToast:false
          });
          if(!isBossTeamPickerCurrent(requestId)) return;
          const restoreTarget = refreshed
            ? bossTeamActionFor(group.id)
            : renderBossUnavailableState();
          closeModalAfterAsyncRefresh(
            $("#bossTeamOverlay"),
            closeBossTeamPicker,
            restoreTarget
          );
          if(!refreshed){
            toast(
              "Équipe sélectionnée, mais les groupes n’ont pas pu être actualisés.",
              true
            );
          }
        }catch(error){
          if(!isBossTeamPickerCurrent(requestId)) return;
          const message = String(error && error.message || "");
          const mustReconcile = [
            "TEAM_NOT_OWNED",
            "NOT_A_PARTICIPANT",
            "RUN_ARCHIVED"
          ].some(code => message.includes(code));
          if(mustReconcile){
            const [teamsResult, bossResult] = await Promise.allSettled([
              Store.refresh(),
              renderBossView({
                showLoading:false,
                ensureWeek:false,
                showErrorToast:false
              })
            ]);
            const pickerIsCurrent = isBossTeamPickerCurrent(requestId);
            const bossRefreshed = bossResult.status === "fulfilled"
              && bossResult.value === true;
            if(!bossRefreshed){
              if(
                !pickerIsCurrent &&
                (
                  sessionCourante.user?.id !== pickerUserId ||
                  bossViewOwnerVersion !== pickerOwnerVersion ||
                  bossTeamPickerContext !== null
                )
              ) return;
              const retry = renderBossUnavailableState();
              if(pickerIsCurrent){
                ModalStack.setRestoreFocus($("#bossTeamOverlay"), retry);
                closeBossTeamPicker();
                toast("Équipe non sélectionnée : "+bossActionMessage(error), true);
              }else{
                const active = document.activeElement;
                const focusWasLost = !active
                  || !active.isConnected
                  || active === document.body
                  || active === document.documentElement;
                if(focusWasLost) retry.focus();
              }
              return;
            }
            if(!pickerIsCurrent) return;
            const currentGroup = (bossViewState.allGroups || [])
              .find(item => item.id === group.id);
            const currentMembership = (bossViewState.membership || [])
              .find(item =>
                item.session_id === group.id &&
                item.owner === sessionCourante.user?.id
              );
            const refreshedTrigger = bossTeamActionFor(group.id);
            ModalStack.setRestoreFocus(
              $("#bossTeamOverlay"),
              refreshedTrigger
            );
            if(!currentGroup || currentGroup.status !== "open" || !currentMembership){
              closeBossTeamPicker();
            }else if(teamsResult.status === "fulfilled"){
              bossTeamPickerPendingRequestId = null;
              const teams = teamsResult.value
                .filter(item => item.owner === sessionCourante.user.id)
                .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
              bossTeamPickerTeams(
                $("#bossTeamList"),
                teams,
                group,
                requestId
              );
              const target = $("#bossTeamList").querySelector(
                teams.length ? ".boss-team-choice" : ".btn"
              );
              if(target) target.focus();
            }else{
              const list = $("#bossTeamList");
              list.innerHTML = "";
              list.appendChild(el("div",{class:"boss-team-empty"},[
                el("p",{
                  text:"Tes équipes n’ont pas pu être actualisées. Ferme cette fenêtre puis réessaie."
                })
              ]));
            }
            toast("Équipe non sélectionnée : "+bossActionMessage(error), true);
            return;
          }
          setBossTeamPickerPending(requestId, false);
          toast("Équipe non sélectionnée : "+bossActionMessage(error), true);
        }
      }
    },[
      // Le nom est la raison d'être de ce champ : c'est ici qu'on distinguait
      // mal deux compos partageant trois héros sur quatre.
      el("span",{
        class:"boss-team-choice-title",
        text:team.name || "Équipe sans nom"
      }),
      heroes,
      el("span",{
        class:"boss-team-choice-date",
        text:"Modifiée le "+frDateTime(team.updatedAt)
      })
    ]);
    return choice;
  }

  async function openBossTeamPicker(group, member){
    const userId = sessionCourante.user && sessionCourante.user.id;
    if(!userId || !member || member.owner !== userId) return;
    const restoreFocus = document.activeElement;
    const requestId = ++bossTeamPickerRequestId;
    bossTeamPickerPendingRequestId = null;
    bossTeamPickerContext = {
      requestId,
      userId,
      ownerVersion:bossViewOwnerVersion,
      groupId:group.id
    };
    const overlay = $("#bossTeamOverlay");
    const list = $("#bossTeamList");
    try{
      const teams = (await Store.refresh())
        .filter(team => team.owner === userId)
        .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
      if(!isBossTeamPickerCurrent(requestId)) return;
      bossTeamPickerTeams(list, teams, group, requestId);
      if(overlay.classList.contains("on")){
        const target = list.querySelector(teams.length ? ".boss-team-choice" : ".btn");
        if(target) target.focus();
      }else{
        ModalStack.open(
          overlay,
          teams.length ? ".boss-team-choice" : "#bossTeamList .btn",
          closeBossTeamPicker,
          restoreFocus
        );
      }
    }catch(error){
      if(!isBossTeamPickerCurrent(requestId)) return;
      list.innerHTML = "";
      list.appendChild(el("div",{class:"boss-team-empty"},[
        el("p",{
          text:"Tes équipes n’ont pas pu être chargées. Vérifie ta connexion puis réessaie."
        }),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Réessayer",
          onclick:()=>void openBossTeamPicker(group, member)
        })
      ]));
      ModalStack.open(
        overlay,
        "#bossTeamList .btn",
        closeBossTeamPicker,
        restoreFocus
      );
      toast("Équipes indisponibles : "+authMessage(error), true);
    }
  }

  $("#bossTeamClose").addEventListener("click", closeBossTeamPicker);
  $("#bossTeamOverlay").addEventListener("click", event => {
    if(event.target === $("#bossTeamOverlay")) closeBossTeamPicker();
  });

  const SCORE_RE = /^[1-9]\d*$/;
  let bossReportRequestId = 0;
  let bossReportContext = null;

  function validBossScore(value){
    const text = String(value || "").trim();
    if(!SCORE_RE.test(text)) return false;
    try{
      const score = BigInt(text);
      return score > 0n && score <= BigInt(Number.MAX_SAFE_INTEGER);
    }catch(error){
      return false;
    }
  }

  function bossReportMembers(group){
    return (bossViewState.membership || [])
      .filter(member => member.session_id === group.id);
  }

  function bossMissingTeamMessage(members){
    const missing = members.filter(member => !member.team_snapshot);
    if(!missing.length) return "";
    const names = missing.map(member => member.pseudo || "Membre").join(", ");
    return "Chaque membre doit choisir une équipe avant de terminer la run : "+names+".";
  }

  function bossOverCapacityMessage(members){
    return members.length > 5
      ? "Groupe au-dessus de la nouvelle limite"
      : "";
  }

  function bossReportActionMessage(error, mode){
    const message = String(error && error.message || "");
    if(isBossSchemaCompatibilityError(error)){
      return BOSS_SCHEMA_MAINTENANCE_MESSAGE;
    }
    if(message.includes("RUN_INVALID_WEEK")){
      return "La semaine de boss a changé. La liste a été actualisée.";
    }
    if(message.includes("REPORT_REQUIRED")){
      return "Une mise à jour du site est nécessaire pour terminer cette run.";
    }
    if(message.includes("TEAM_REQUIRED")){
      const names = message.split("TEAM_REQUIRED:")[1];
      return "Chaque membre doit choisir une équipe avant de terminer la run"+
        (names ? " : "+names : "")+".";
    }
    if(message.includes("INVALID_SCORE")){
      return "Saisis un score entier supérieur à zéro.";
    }
    if(message.includes("NOTE_TOO_LONG")){
      return "La note doit contenir 1 000 caractères maximum.";
    }
    if(message.includes("GROUP_OVER_CAPACITY")){
      return "Des membres doivent quitter ce groupe pour revenir à 5 joueurs.";
    }
    if(message.includes("RUN_ARCHIVED")){
      return "Cette run est déjà terminée. Ferme ce rapport puis actualise la liste.";
    }
    if(message.includes("RUN_NOT_ARCHIVED")){
      return "Cette run n’est pas archivée. Ferme ce rapport puis actualise la liste.";
    }
    if(message.includes("NOT_A_PARTICIPANT")){
      return "Seuls les participants peuvent effectuer cette action.";
    }
    if(message.includes("REPORT_NOT_FOUND")){
      return "Aucun rapport modifiable n’existe pour cette run.";
    }
    if(message.includes("RUN_NOT_FOUND")){
      return "Cette run n’existe plus. Ferme cette fenêtre puis actualise la liste.";
    }
    if(message.includes("AUTH_REQUIRED")){
      return "Ta session a expiré. Reconnecte-toi avant de réessayer.";
    }
    return mode === "edit"
      ? "La correction n’a pas été enregistrée. Vérifie ta connexion puis réessaie."
      : "Le rapport n’a pas été enregistré. Vérifie ta connexion puis réessaie.";
  }

  function renderBossReportMembers(context){
    const box = $("#bossReportMembers");
    box.innerHTML = "";
    context.members.forEach(member => {
      const ready = !!member.team_snapshot;
      box.appendChild(el("div",{class:"boss-report-member"},[
        el("span",{
          class:"boss-report-member-name",
          text:member.pseudo || "Membre"
        }),
        el("span",{
          class:"boss-report-member-state"+(ready?"":" missing"),
          text:ready ? "Équipe prête" : "Équipe à choisir"
        })
      ]));
    });
  }

  function updateBossReportForm(clearError, scoreChanged){
    const context = bossReportContext;
    if(!context) return;
    if(scoreChanged){
      context.error = "";
      context.serverInvalidScore = false;
    }else if(clearError && !context.serverInvalidScore){
      context.error = "";
    }
    const scoreValue = $("#bossScore").value;
    const overCapacityMessage = bossOverCapacityMessage(context.members);
    const missingMessage = bossMissingTeamMessage(context.members);
    const validScore = validBossScore(scoreValue);
    const scoreMessage = validScore
      ? ""
      : "Saisis un score entier supérieur à zéro.";
    $("#bossScore").setAttribute(
      "aria-invalid",
      String(!validScore || context.serverInvalidScore)
    );
    const noteLength = $("#bossReportNote").value.length;
    $("#bossReportCount").textContent = noteLength+"/1000";
    if(noteLength >= 900){
      $("#bossReportCount").setAttribute("aria-live", "polite");
    }else{
      $("#bossReportCount").removeAttribute("aria-live");
    }
    $("#bossReportError").textContent =
      context.error || overCapacityMessage || missingMessage || scoreMessage;
    $("#bossReportSubmit").disabled =
      context.pending || !validScore || context.serverInvalidScore ||
      !!overCapacityMessage || !!missingMessage;
    $("#bossReportSubmit").setAttribute(
      "aria-busy",
      context.pending ? "true" : "false"
    );
  }

  function closeBossReport(){
    bossReportRequestId++;
    bossReportContext = null;
    ModalStack.close($("#bossReportOverlay"));
  }

  function bossReportResultTarget(group, mode){
    let target = null;
    if(mode === "edit"){
      const reportCard = [...document.querySelectorAll(".boss-report-card")]
        .find(card => card.dataset.sessionId === group.id);
      target = reportCard && reportCard.querySelector(".boss-report-edit");
    }else{
      const next = (bossViewState.allGroups || [])
        .filter(item => item.status === "open" && item.slot === group.slot)
        .sort((a,b)=>(b.run_no||1)-(a.run_no||1))[0];
      const nextCard = next && [...document.querySelectorAll(".boss-card")]
        .find(card => card.dataset.sessionId === next.id);
      target = nextCard && nextCard.querySelector(".boss-join");
    }
    if(!target){
      target = mainTabs.find(button => button.dataset.view === "boss");
    }
    return target;
  }

  function focusBossReportResult(group, mode){
    const target = bossReportResultTarget(group, mode);
    if(target && target.focus) target.focus();
  }

  function reconcileOpenBossReport(){
    const context = bossReportContext;
    if(!context) return;
    if(context.userId !== sessionCourante.user?.id){
      closeBossReport();
      return;
    }
    const group = (bossViewState.allGroups || [])
      .find(item => item.id === context.group.id);
    const members = group ? bossReportMembers(group) : [];
    const report = (bossViewState.reports || [])
      .find(item => item.session_id === context.group.id) || null;
    const mine = members.some(member => member.owner === context.userId);
    const remainsValid = context.mode === "edit"
      ? !!group && group.status === "archived" && !!report && mine
      : !!group && group.status === "open" && mine;

    if(!remainsValid){
      closeModalAfterAsyncRefresh(
        $("#bossReportOverlay"),
        closeBossReport,
        bossReportResultTarget(context.group, context.mode)
      );
      return;
    }

    context.group = group;
    context.members = members;
    context.report = report;
    renderBossReportMembers(context);
    updateBossReportForm(false);
  }

  function openBossReport(group, mode){
    const selectedMode = mode === "edit" ? "edit" : "complete";
    const members = bossReportMembers(group);
    const report = (bossViewState.reports || [])
      .find(item => item.session_id === group.id) || null;
    const mine = members.some(member => member.owner === sessionCourante.user?.id);
    if(!mine || (selectedMode === "edit" && !report)) return;

    const context = {
      requestId:++bossReportRequestId,
      userId:sessionCourante.user.id,
      group,
      mode:selectedMode,
      members,
      report,
      pending:false,
      serverInvalidScore:false,
      error:""
    };
    bossReportContext = context;
    $("#bossReportTitle").textContent =
      selectedMode === "edit" ? "Corriger le rapport" : "Terminer la run";
    $("#bossReportSubmit").textContent = selectedMode === "edit"
      ? "Enregistrer la correction"
      : "Enregistrer et terminer la run";
    $("#bossScore").value = report ? String(report.global_score) : "";
    $("#bossReportNote").value = report ? String(report.note || "") : "";
    renderBossReportMembers(context);
    updateBossReportForm(false);
    ModalStack.open(
      $("#bossReportOverlay"),
      "#bossScore",
      closeBossReport
    );
  }

  async function submitBossReport(){
    const context = bossReportContext;
    if(!context || context.pending) return;
    const score = $("#bossScore").value.trim();
    const note = $("#bossReportNote").value;
    const missingMessage = bossMissingTeamMessage(context.members);
    if(!validBossScore(score) || missingMessage) return;

    context.pending = true;
    context.error = "";
    updateBossReportForm(false);
    const submission = {
      requestId:context.requestId,
      userId:context.userId,
      group:context.group,
      mode:context.mode,
      score,
      note
    };
    const isCurrent = () =>
      bossReportContext === context &&
      context.requestId === submission.requestId &&
      sessionCourante.user?.id === submission.userId;

    try{
      if(submission.mode === "edit"){
        await BossStore.updateReport(
          submission.group.id,
          submission.score,
          submission.note
        );
      }else{
        await BossStore.complete(
          submission.group.id,
          submission.score,
          submission.note
        );
      }
      const restoreFocus = isCurrent();
      if(restoreFocus) closeBossReport();
      invalidateBossRenders();
      await renderBossView({
        showLoading:false,
        ensureWeek:false,
        showErrorToast:true
      });
      const active = document.activeElement;
      const focusWasLost = !active ||
        !active.isConnected ||
        active === document.body ||
        active === document.documentElement;
      if(restoreFocus || focusWasLost){
        focusBossReportResult(submission.group, submission.mode);
      }
    }catch(error){
      if(!isCurrent()) return;
      const errorCode = String(error && error.message || "");
      const actionMessage = bossReportActionMessage(error, context.mode);
      if(errorCode.includes("RUN_INVALID_WEEK")){
        const actionUserId = submission.userId;
        closeBossReport();
        toast(actionMessage, true);
        const refreshed = await renderBossView({
          showLoading:false,
          ensureWeek:true,
          showErrorToast:false
        });
        if(sessionCourante.user?.id !== actionUserId) return;
        if(!refreshed){
          const retry = renderBossUnavailableState();
          retry.focus();
          return;
        }
        focusBossReportResult(submission.group, submission.mode);
        return;
      }
      context.pending = false;
      context.serverInvalidScore = errorCode.includes("INVALID_SCORE");
      context.error = actionMessage;
      updateBossReportForm(false);
      $("#bossReportError").focus?.();
    }
  }

  $("#bossScore").addEventListener(
    "input",
    ()=>updateBossReportForm(true, true)
  );
  $("#bossReportNote").addEventListener(
    "input",
    ()=>updateBossReportForm(true, false)
  );
  $("#bossReportSubmit").addEventListener("click", ()=>void submitBossReport());
  $("#bossReportClose").addEventListener("click", closeBossReport);
  $("#bossReportOverlay").addEventListener("click", event => {
    if(event.target === $("#bossReportOverlay")) closeBossReport();
  });

  function bossGroupCard(g, membership, myCount){
    const members = membership.filter(m => m.session_id === g.id);
    const mine = members.some(m => m.owner === sessionCourante.user.id);
    const pending = bossPendingActions.has(g.id);
    const overCapacity = members.length > 5;
    const list = el("div",{class:"boss-members"});
    if(overCapacity){
      list.appendChild(el("p",{
        class:"boss-over-capacity",
        role:"status",
        text:"Groupe au-dessus de la nouvelle limite"
      }));
    }
    if(members.length){
      members.forEach(member => {
        const isMe = member.owner === sessionCourante.user.id;
        const team = teamFromBossSnapshot(member.team_snapshot);
        const row = el("div",{class:"boss-member"+(isMe?" me":"")},[
          el("div",{class:"boss-member-head"},[
            el("span",{class:"boss-member-name",text:member.pseudo||"Membre"}),
            el("span",{
              class:"boss-team-state"+(team?" ready":""),
              text:team ? "Équipe prête" : "Équipe manquante"
            })
          ])
        ]);
        if(isMe && team){
          row.appendChild(el("button",{
            class:"boss-member-team-preview",
            type:"button",
            dataset:{bossAction:"team-preview"},
            "aria-label":"Voir l’équipe de "+(member.pseudo||"Membre"),
            onclick:()=>openTeamDetail(team)
          },[
            bossTeamBanner(team)
          ]));
        }
        if(isMe){
          row.appendChild(el("button",{
            class:"btn boss-member-team-action",
            type:"button",
            dataset:{bossAction:"team"},
            text:team ? "Changer" : "Choisir mon équipe",
            onclick:()=>void openBossTeamPicker(g, member)
          }));
        }
        list.appendChild(row);
      });
    }else{
      list.appendChild(el("span",{
        class:"boss-none",
        text:"Personne pour l'instant"
      }));
    }

    const joinButton = el("button",{
      class:"btn "+(mine?"btn-danger":"btn-primary")+" boss-join",
      type:"button",
      dataset:{bossAction:"membership"},
      text:pending ? "Synchronisation…" : (mine ? "Quitter" : "Rejoindre"),
      title:!mine && members.length >= 5
        ? "Groupe complet : 5/5"
        : (!mine && myCount >= 3 ? "Limite hebdomadaire atteinte : 3/3" : ""),
      onclick:()=>void changeBossMembership(g, mine)
    });
    joinButton.disabled = pending || (!mine && (myCount >= 3 || members.length >= 5));

    const completeButton = mine ? el("button",{
      class:"btn btn-secondary boss-complete",
      type:"button",
      dataset:{bossAction:"complete"},
      text:"Run terminée",
      onclick:()=>openBossReport(g, "complete")
    }) : null;
    if(completeButton) completeButton.disabled = pending || overCapacity;

    const actions = el("div",{class:"boss-actions"},[
      joinButton,
      ...(completeButton ? [completeButton] : [])
    ]);

    return el("div",{
      class:"boss-card"+(mine?" mine":""),
      dataset:{sessionId:g.id}
    },[
      el("div",{class:"boss-card-head"},[
        el("span",{
          class:"boss-card-title",
          text:g.title+" · Run "+(g.run_no||1)
        }),
        el("span",{
          class:"boss-membercount",
          text:members.length+"/5 joueurs"
        })
      ]),
      list,
      actions
    ]);
  }

  function bossReportCard(group, members, report){
    const card = el("article",{
      class:"boss-report-card"+(report?"":" boss-report-unavailable"),
      dataset:{sessionId:group.id}
    });
    card.appendChild(el("div",{class:"boss-report-head"},[
      el("h3",{
        class:"boss-report-heading",
        text:group.title+" · Run "+(group.run_no||1)
      }),
      el("span",{
        class:"boss-report-date",
        text:group.completed_at ? "Terminée le "+frDateTime(group.completed_at) : ""
      })
    ]));

    if(!report){
      card.appendChild(el("p",{
        text:"Rapport non disponible pour cette ancienne run."
      }));
      const legacyParticipants = el("div",{class:"boss-report-participants"});
      members.forEach(member =>
        legacyParticipants.appendChild(bossReportParticipant(member))
      );
      card.appendChild(legacyParticipants);
      return card;
    }

    card.appendChild(el("div",{class:"boss-report-score-block"},[
      el("span",{class:"boss-report-score-label",text:"Score global"}),
      el("strong",{
        class:"boss-report-score",
        text:formatBossScore(report.global_score)
      })
    ]));
    card.appendChild(el("p",{
      class:"boss-report-note",
      text:report.note || "Aucune note de run."
    }));
    const meta = el("div",{class:"boss-report-meta"},[
      el("span",{
        text:"Rapport enregistré par "+
          (report.created_by_pseudo || "Membre")+
          (report.created_at ? " le "+frDateTime(report.created_at) : "")
      })
    ]);
    if(report.updated_at){
      meta.appendChild(el("span",{
        text:"Corrigé par "+(report.updated_by_pseudo || "Membre")+
          " le "+frDateTime(report.updated_at)
      }));
    }
    card.appendChild(meta);

    const participants = el("div",{class:"boss-report-participants"});
    members.forEach(member =>
      participants.appendChild(bossReportParticipant(member))
    );
    card.appendChild(participants);

    if(members.some(member => member.owner === sessionCourante.user?.id)){
      card.appendChild(el("div",{class:"boss-report-actions"},[
        el("button",{
          class:"btn boss-report-edit",
          type:"button",
          dataset:{bossAction:"report-edit"},
          text:"Corriger le rapport",
          onclick:()=>openBossReport(group, "edit")
        })
      ]));
    }
    return card;
  }

  function bossArchiveRows(groups, membership, reports){
    const wrap = el("div",{class:"boss-report-list"});
    const reportsBySession = new Map(
      (reports || []).map(report => [report.session_id, report])
    );
    groups.forEach(group => {
      const members = membership.filter(member =>
        member.session_id === group.id
      );
      wrap.appendChild(
        bossReportCard(group, members, reportsBySession.get(group.id) || null)
      );
    });
    return wrap;
  }

  function bossArchive(past, membership, reports){
    const weeks = [...new Set(past.map(g=>g.week_start))].sort().reverse();
    const wrap = el("details",{class:"boss-archive"});
    wrap.appendChild(el("summary",{
      text:"Semaines précédentes ("+weeks.length+")"
    }));
    weeks.forEach(weekStart=>{
      const groups = past
        .filter(g => g.week_start === weekStart)
        .sort((a,b)=>
          ((a.slot||0)-(b.slot||0)) ||
          ((a.run_no||1)-(b.run_no||1))
        );
      const weekBlock = el("div",{class:"boss-archive-week"});
      weekBlock.appendChild(el("div",{
        class:"boss-archive-title",
        text:"Semaine du "+frDate(weekStart)
      }));
      weekBlock.appendChild(bossArchiveRows(groups, membership, reports));
      wrap.appendChild(weekBlock);
    });
    return wrap;
  }

export {
  bossViewState,
  ensureBossViewOwner,
  openBossReport,
  openBossTeamPicker,
  renderBossView
};
