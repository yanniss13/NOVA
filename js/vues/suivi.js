/* « Mon suivi » : le tableau de bord personnel du membre.

   Il ne possede aucune donnee. Il assemble ce que les autres domaines savent
   deja — equipes, roster, dispos, sessions de boss — en une liste de choses a
   faire cette semaine, chacune avec son action directe.

   D'ou son cache hors ligne, cloisonne par compte ET par semaine, versionne,
   et JAMAIS utilise pour accorder un droit ni pour envoyer une mutation. On
   n'y cherche jamais « le dernier cache » : l'identite et la semaine doivent
   etre connues d'abord.

   `runDashboardAction` est le seul endroit du site qui pilote une autre vue :
   il change d'onglet puis met le focus sur l'element vise. C'est pour lui que
   `showView` renvoie une promesse — sans elle, le focus partirait avant que la
   vue destination ne soit rendue. */

import { DashboardStore } from "../donnees/suivi-store.js";
import { sessionCourante } from "../etat/session.js";
import { formatBossScore, frDateTime } from "../metier/boss-logique.js";
import { AVAIL_DAY_FULL } from "../metier/dispos-logique.js";
import { $, el } from "../noyau/dom.js";
import { bossViewState, openBossReport, openBossTeamPicker } from "./boss-sessions.js";
import { resetTeamDraft } from "./builder.js";
import { Availability } from "./dispos.js";
import { openAuth } from "./modale-auth.js";
import { showView } from "./navigation.js";
import { toast } from "./toast.js";

  /* ---------- Mon suivi : cache hors ligne ----------
     Cloisonné par compte ET par semaine, versionné, et jamais utilisé pour
     accorder un droit ni pour envoyer une mutation. On ne cherche jamais « le
     dernier cache » : l'identité et la semaine doivent être connues d'abord. */

  /* ---------- Mon suivi : store et rendu ----------
     Le store protège chaque lecture par une génération, l'identité du compte et
     la semaine attendue : une réponse lente ne remplace jamais un état plus
     récent, et une déconnexion ne réaffiche pas le compte précédent. */

  /* Une carte ouverte est un `.boss-card`, une archive un `.boss-report-card` :
     les deux portent `data-session-id`, donc une seule recherche suffit. */
  function dashboardBossCard(sessionId){
    return [...$("#bossBody").querySelectorAll("[data-session-id]")]
      .find(node => node.dataset.sessionId === sessionId) || null;
  }

  async function openDashboardBossTarget(sessionId, mode){
    const loaded = await showView("boss");
    if(!loaded){
      toast("Le groupe n’a pas pu être chargé.", true);
      return;
    }
    const group = (bossViewState.allGroups || [])
      .find(item => item.id === sessionId);
    if(!group){
      toast("Cette run n’est plus disponible.", true);
      return;
    }
    const card = dashboardBossCard(sessionId);
    if(card) card.scrollIntoView({ block:"center", behavior:"smooth" });

    if(mode === "choose-team"){
      const member = (bossViewState.membership || []).find(item =>
        item.session_id === sessionId &&
        item.owner === sessionCourante.user?.id
      );
      const trigger = card && card.querySelector('[data-boss-action="team"]');
      if(!member || group.status !== "open" || !trigger){
        toast("Cette run n’accepte plus de sélection d’équipe.", true);
        if(card) dashboardFocusCard(card);
        return;
      }
      trigger.focus();
      await openBossTeamPicker(group, member);
      return;
    }

    if(mode === "edit-report"){
      const trigger = card && card.querySelector(
        '[data-boss-action="report-edit"]'
      );
      const report = (bossViewState.reports || []).find(item =>
        item.session_id === sessionId
      );
      if(group.status !== "archived" || !report || !trigger){
        toast("Ce rapport n’est plus modifiable.", true);
        if(card) dashboardFocusCard(card);
        return;
      }
      trigger.focus();
      openBossReport(group, "edit");
      return;
    }

    if(card) dashboardFocusCard(card);
    else $("#tab-boss").focus();
  }

  function dashboardFocusCard(card){
    card.setAttribute("tabindex", "-1");
    card.focus();
  }

  async function runDashboardAction(action){
    if(!action) return;
    if(action.type === "choose-team" ||
       action.type === "view-group" ||
       action.type === "edit-report"){
      await openDashboardBossTarget(action.sessionId, action.type);
      return;
    }
    if(action.type === "create-team"){
      resetTeamDraft();
      await showView("builder");
      $("#builderTitle").focus();
      return;
    }
    if(action.type === "view-teams"){
      await showView("roster");
      $("#rosterTitle").focus();
      return;
    }
    if(action.type === "post-availability"){
      await showView("availability");
      $("#availTitle").focus();
      return;
    }
    if(action.type === "complete-roster"){
      await showView("member-roster");
      $("#memberRosterViewTitle").focus();
      return;
    }
    /* Le creneau fort est une lecture collective : arriver en mode « Mes
       dispos » obligerait le membre a basculer lui-meme pour voir ce que la
       carte vient de lui annoncer. */
    if(action.type === "view-planning"){
      await showView("availability");
      Availability.setMode("guild");
      $("#availTitle").focus();
      return;
    }
    if(action.type === "find-group"){
      const loaded = await showView("boss");
      if(!loaded) return;
      const target = $("#bossBody").querySelector(
        '.boss-card:not(.mine) .boss-join:not([disabled])'
      );
      (target || $("#tab-boss")).focus();
    }
  }

  function slotsPosedLabel(count){
    return count + " créneau" + (count > 1 ? "x" : "")
      + " posé" + (count > 1 ? "s" : "") + " cette semaine";
  }

  function bestSlotLabel(best){
    return AVAIL_DAY_FULL[best.day] + " "
      + String(best.hour).padStart(2, "0") + " h — "
      + best.count + " membre" + (best.count > 1 ? "s" : "")
      + " disponible" + (best.count > 1 ? "s" : "");
  }

  function dashboardProgressCell(label, value, className){
    return el("div",{class:"dashboard-progress-cell "+className},[
      el("strong",{text:String(value)}),
      el("span",{text:label})
    ]);
  }

  const DASHBOARD_NETWORK_ACTIONS = [
    "choose-team",
    "view-group",
    "find-group",
    "edit-report"
  ];

  function dashboardActionButton(action){
    return el("button",{
      class:"btn "+(action.priority === 1 ? "btn-primary" : ""),
      type:"button",
      dataset:{
        dashboardAction:action.type,
        sessionId:action.sessionId || "",
        dashboardNetworkAction:DASHBOARD_NETWORK_ACTIONS.includes(action.type)
          ? "true"
          : "false"
      },
      text:action.label,
      onclick:()=>void runDashboardAction(action)
    });
  }

  function dashboardRunCard(group){
    const head = el("div",{class:"dashboard-card-head"},[
      el("strong",{text:group.title+" · Run "+group.runNo})
    ]);
    const card = el("div",{
      class:"dashboard-run-card",
      dataset:{ sessionId:group.id, status:group.status }
    },[head]);
    if(group.status === "open"){
      card.appendChild(el("p",{
        text:group.memberCount+"/5 joueurs"
      }));
      card.appendChild(el("p",{
        class:"dashboard-team-state",
        text:group.teamSelected ? "Équipe sélectionnée" : "Équipe manquante"
      }));
      /* Action secondaire : elle complète « Choisir mon équipe » sans la
         remplacer, et seulement si le membre possède déjà des équipes. */
      if(!group.teamSelected && group.hasOwnTeams){
        card.appendChild(dashboardActionButton({
          type:"view-teams",
          sessionId:null,
          slot:group.slot,
          runNo:group.runNo,
          label:"Voir mes équipes",
          priority:5
        }));
      }
      return card;
    }
    card.appendChild(el("p",{
      text:group.completedAt
        ? "Terminée le "+frDateTime(group.completedAt)
        : "Terminée"
    }));
    card.appendChild(el("p",{
      text:group.report
        ? formatBossScore(group.report.globalScore)+" points"
        : "Rapport non disponible pour cette ancienne run."
    }));
    return card;
  }

  function renderDashboardContent(state){
    const body = $("#dashboardBody");
    const blocks = [];

    const summary = el("section",{class:"dashboard-summary"},[
      el("div",{class:"dashboard-summary-head"},[
        el("strong",{text:"Runs engagées "+state.engaged+"/3"})
      ]),
      el("div",{class:"dashboard-progress"},[
        dashboardProgressCell("Terminées", state.completed, "is-done"),
        dashboardProgressCell("En cours", state.open, "is-open"),
        dashboardProgressCell("Encore disponibles", state.remaining, "is-left")
      ])
    ]);
    blocks.push(summary);

    if(state.reportsAvailable === false){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Maintenance des rapports de boss"}),
        el("p",{text:"Les scores ne sont pas lisibles pour le moment. Tes runs restent correctes."})
      ]));
    }

    if(state.offline){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Données potentiellement anciennes"}),
        el("p",{text:"Ces informations viennent du dernier suivi enregistré sur cet appareil."}),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Réessayer",
          onclick:()=>void renderDashboardView({ force:true })
        })
      ]));
    }

    if(state.actions.length){
      blocks.push(el("section",{class:"dashboard-actions-panel"},[
        el("strong",{text:"À faire maintenant"}),
        el("div",{class:"dashboard-action-list"},
          state.actions.map(action => el("div",{class:"dashboard-action-row"},[
            // Le libellé du groupe sert de contexte ; le bouton porte l'action.
            action.sessionId
              ? el("span",{text:"Groupe "+action.slot+" · Run "+action.runNo})
              : el("span",{text:"Tu peux encore engager une run"}),
            dashboardActionButton(action)
          ]))
        )
      ]));
    }

    /* Les trois cartes d'accueil. Chacune disparait quand elle n'a rien a
       dire : donnee absente (lecture en echec) ou rien a signaler. Une carte
       qui affiche « 0 » est du bruit, et une carte qui affiche un faux « 0 »
       est un mensonge. */
    const availability = state.availability;
    if(availability){
      const posed = availability.mine.posed;
      blocks.push(el("section",{
        class:"dashboard-section",
        dataset:{ card:"availability" }
      },[
        el("strong",{text:posed
          ? slotsPosedLabel(availability.mine.count)
          : "Tes dispos ne sont pas posées"}),
        posed
          ? null
          : el("p",{text:"La confrérie ne peut pas te compter dans ses créneaux."}),
        el("button",{
          class:"btn "+(posed ? "" : "btn-primary"),
          type:"button",
          dataset:{ dashboardAction:"post-availability" },
          text:posed ? "Modifier mes dispos" : "Poser mes dispos",
          onclick:()=>void runDashboardAction({ type:"post-availability" })
        })
      ]));
    }

    if(state.roster && state.roster.toComplete > 0){
      blocks.push(el("section",{
        class:"dashboard-section",
        dataset:{ card:"roster" }
      },[
        el("strong",{text:state.roster.toComplete+" héros à compléter"}),
        el("button",{
          class:"btn",
          type:"button",
          dataset:{ dashboardAction:"complete-roster" },
          text:"Compléter mon roster",
          onclick:()=>void runDashboardAction({ type:"complete-roster" })
        })
      ]));
    }

    if(availability && availability.best){
      blocks.push(el("section",{
        class:"dashboard-section",
        dataset:{ card:"best-slot" }
      },[
        el("strong",{text:bestSlotLabel(availability.best)}),
        el("button",{
          class:"btn",
          type:"button",
          dataset:{ dashboardAction:"view-planning" },
          text:"Voir le planning",
          onclick:()=>void runDashboardAction({ type:"view-planning" })
        })
      ]));
    }

    const openGroups = state.groups
      .filter(group => group.status === "open")
      .map(group => Object.assign({}, group, {
        hasOwnTeams:state.hasOwnTeams
      }));
    if(openGroups.length){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Runs en cours"}),
        el("div",{class:"dashboard-run-grid"}, openGroups.map(dashboardRunCard))
      ]));
    }

    const doneGroups = state.groups.filter(group => group.status === "archived");
    if(doneGroups.length){
      blocks.push(el("section",{class:"dashboard-section"},[
        el("strong",{text:"Runs terminées cette semaine"}),
        el("div",{class:"dashboard-run-grid"}, doneGroups.map(dashboardRunCard))
      ]));
    }

    blocks.push(el("section",{
      class:"dashboard-deadline",
      dataset:{ level:state.deadlineStatus.level }
    },[
      el("strong",{text:state.deadlineStatus.label})
    ]));

    body.replaceChildren(...blocks);
    if(state.offline){
      body.querySelectorAll('[data-dashboard-network-action="true"]')
        .forEach(button => {
          button.disabled = true;
          button.title = "Action indisponible hors ligne";
        });
    }
  }

  function renderDashboardSyncMeta(state){
    const meta = $("#dashboardSyncMeta");
    if(!state){
      meta.replaceChildren();
      return;
    }
    const stamp = state.lastSyncedAt
      ? "Dernière synchronisation "+frDateTime(
          new Date(state.lastSyncedAt).toISOString()
        )
      : "Dernière synchronisation inconnue";
    if(state.offline){
      meta.replaceChildren(
        el("span",{class:"dashboard-offline-badge",text:"Hors ligne"}),
        el("span",{text:stamp})
      );
      return;
    }
    meta.replaceChildren(el("span",{text:stamp}));
  }

  async function renderDashboardView(options){
    const settings = options || {};
    const body = $("#dashboardBody");
    if(!sessionCourante.user){
      $("#dashboardSyncMeta").replaceChildren();
      $("#dashboardStatus").textContent = "";
      body.replaceChildren(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour afficher ton suivi"}),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Connexion",
          onclick:()=>openAuth()
        })
      ]));
      return true;
    }
    /* Rouvrir un onglet propre ne relit pas le réseau : seul un marquage sale
       ou une demande explicite déclenche une nouvelle lecture. */
    const known = DashboardStore.current();
    if(known && !DashboardStore.isDirty() && settings.force !== true){
      renderDashboardSyncMeta(known);
      renderDashboardContent(known);
      return true;
    }
    if(settings.showLoading !== false){
      body.replaceChildren(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Chargement du suivi…"})
      ]));
    }
    $("#dashboardStatus").textContent = "Chargement du suivi";
    try{
      const state = await DashboardStore.refresh();
      if(!state) return true;
      renderDashboardSyncMeta(state);
      renderDashboardContent(state);
      $("#dashboardStatus").textContent = state.offline
        ? "Suivi hors ligne"
        : "Suivi actualisé";
      return !state.offline;
    }catch(error){
      // Aucun cache compatible : on ne montre jamais un faux 0/3.
      renderDashboardSyncMeta(null);
      body.replaceChildren(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Suivi indisponible hors ligne"}),
        el("p",{text:"Reconnecte-toi puis réessaie. Aucun compteur fiable n’est disponible."}),
        el("button",{
          class:"btn btn-primary",
          type:"button",
          text:"Réessayer",
          onclick:()=>void renderDashboardView({ force:true })
        })
      ]));
      $("#dashboardStatus").textContent = "Suivi indisponible";
      return false;
    }
  }

export { renderDashboardView };
