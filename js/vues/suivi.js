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
import { BOSS_NAME } from "../donnees/boss-store.js";
import {
  currentBossWeek, formatBossScore, frDate, frDateTime
} from "../metier/boss-logique.js";
import { AVAIL_DAY_FULL } from "../metier/dispos-logique.js";
import { $, el } from "../noyau/dom.js";
import { bossViewState, openBossReport, openBossTeamPicker } from "./boss-sessions.js";
import { resetTeamDraft } from "./builder.js";
import { Availability } from "./dispos.js";
import { openAuth } from "./modale-auth.js";
import { ongletDeLaVue } from "./coquille.js";
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
    else {
      const entree = ongletDeLaVue("boss");
      if(entree) entree.focus();
    }
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
      const repli = target || ongletDeLaVue("boss");
      if(repli) repli.focus();
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

  /* UNE CELLULE DE LA RANGEE CLOISONNEE. */
  function celluleDeStat(label, valeur, detail){
    return el("article", null, [
      el("span",{text:label}),
      el("strong",{text:String(valeur)}),
      el("small",{text:detail})
    ]);
  }

  /* CE QU'UNE ACTION RACONTE. Le type dit le geste ; il ne dit pas encore ce
     qu'un membre doit comprendre. Chaque type recoit donc son etat, sa phrase
     et son degre d'urgence — c'est la carte d'action de la maquette. */
  const RECIT_DES_ACTIONS = {
    "choose-team":{
      etat:"Équipe à choisir",
      phrase:"Ta place est prise. Il reste à désigner l'équipe que tu engages.",
      ton:"urgent"
    },
    "create-team":{
      etat:"Aucune équipe",
      phrase:"Compose une équipe avant de pouvoir l'engager sur cette run.",
      ton:"urgent"
    },
    "view-group":{
      etat:"Équipe engagée",
      phrase:"Ton équipe est choisie. Il reste à jouer la run avec le groupe.",
      ton:""
    },
    "find-group":{
      etat:"Run disponible",
      phrase:"Tu peux encore t'engager sur un groupe cette semaine.",
      ton:""
    },
    "edit-report":{
      etat:"Rapport à corriger",
      phrase:"Le score de cette run peut encore être rectifié.",
      ton:"done"
    },
    /* Les deux taches qui n'ont rien a voir avec une run, mais qui empechent
       d'en mener une : sans dispos, personne ne peut compter sur toi ; sans
       roster complet, tes heros ne sont pas proposables. */
    "post-availability":{ etat:"Créneaux", phrase:"", ton:"urgent" },
    "complete-roster":{ etat:"Roster", phrase:"", ton:"" }
  };

  /* Le rang n'est pas decoratif : `buildDashboardState` trie les actions par
     priorite, de la plus bloquante a la plus tranquille. Le numero dit donc
     quelque chose de vrai — par quoi commencer. */
  function carteDAction(action, rang){
    const recit = RECIT_DES_ACTIONS[action.type] || { etat:"À faire", phrase:"", ton:"" };
    const titre = action.sessionId
      ? "Groupe " + action.slot + " · Run " + action.runNo
      : action.titre || "Une run reste disponible";
    return el("article",{
      class:"action-card",
      dataset:{ tone:recit.ton }
    },[
      el("div",{class:"action-index",text:String(rang).padStart(2, "0")}),
      el("div", null, [
        el("span",{class:"action-state",text:recit.etat}),
        el("h3",{text:titre}),
        el("p",{text:action.phrase || recit.phrase})
      ]),
      dashboardActionButton(action)
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
      /* Toutes les actions sont de meme nature — un lien vers l'endroit ou
         le geste se fait. L'aplat dore reste a l'action principale de la vue,
         dans le cadre majeur. */
      class:"btn btn-ghost",
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

  /* ---------- Chronométrage des animations ----------
     Le seul endroit du site qui mène à outils/chrono-animation.html. L'outil
     existe depuis le 19 août ; sans cette carte, aucun membre ne peut le
     trouver, et le compteur reste à zéro quoi qu'il arrive.

     Le fichier lu est minuscule et généré par le même script que
     docs/chronometrage-animations.md : le classement ne peut pas diverger
     entre la page et la liste de travail. */
  const CHRONO_AVANCEMENT = "./data/chronometrage-avancement.json";
  const CHRONO_OUTIL = "outils/chrono-animation.html";
  let chronoAvancement = null;

  function chargerChronoAvancement(){
    if(chronoAvancement) return chronoAvancement;
    chronoAvancement = fetch(CHRONO_AVANCEMENT)
      .then(reponse => reponse.ok ? reponse.json() : null)
      .catch(() => null)
      .then(avancement => {
        /* Rejouable, comme les autres chargements différés du site : un premier
           rendu hors ligne, ou un fichier pas encore déployé, ne doit pas
           condamner la carte pour toute la durée de la session. Sans cette
           remise à zéro, la promesse mémorisée rendrait `null` à jamais. */
        if(!avancement) chronoAvancement = null;
        return avancement;
      });
    return chronoAvancement;
  }

  function chronoProchaine(avancement){
    const prochaine = (avancement.prochaines || [])[0];
    if(!prochaine) return null;
    return el("p",{class:"dashboard-chrono-prochaine"},[
      el("span",{text:"À mesurer en premier : "}),
      el("strong",{text:prochaine.heros+" · "+prochaine.arme+" · "+prochaine.nom}),
      el("span",{text:" ("+String(prochaine.categorie || "").toLowerCase()
        +", touche "+prochaine.touche+")"})
    ]);
  }

  /* Rien à afficher quand tout est mesuré : une carte qui annonce un travail
     fini est du bruit, comme les trois cartes d'accueil juste au-dessus. */
  function chronoCarte(avancement){
    const total = Number(avancement && avancement.total) || 0;
    const mesurees = Number(avancement && avancement.mesurees) || 0;
    if(!total || mesurees >= total) return null;
    const debloquent = Number(avancement.debloquent) || 0;
    const affinent = Number(avancement.affinent) || 0;
    const releves = Number(avancement.releves) || 0;
    const calculs = [];
    if(debloquent){
      calculs.push(debloquent+" compétences sans recharge deviennent calculables"
        + " avec leur mesure");
    }
    if(affinent){
      calculs.push(affinent+" calculs existants sont affinés");
    }
    const explication = "Aucune source publique ne publie ces durées."
      + (calculs.length ? " "+calculs.join(" ; ")+"." : "")
      + (releves ? " "+releves+" compétences de relève attendent une simulation"
        + " d’équipe." : "");
    return el("section",{
      class:"dashboard-section",
      dataset:{ card:"chronometrage" }
    },[
      el("strong",{text:mesurees+" / "+total+" animations mesurées"}),
      el("p",{text:explication}),
      chronoProchaine(avancement),
      /* Un lien, pas un bouton `data-dashboard-action` : l'outil est une page
         hors PWA, il s'ouvre à côté au lieu de piloter une vue de NOVA, et
         `runDashboardAction` n'a donc rien à connaître de lui. */
      el("a",{
        class:"btn btn-primary",
        href:CHRONO_OUTIL,
        target:"_blank",
        rel:"noopener",
        text:"Chronométrer une animation"
      })
    ]);
  }

  /* La carte arrive après le reste : le tableau de bord ne doit pas attendre un
     fichier statique pour s'afficher. Un tableau de bord re-rendu entre-temps
     laisse un hôte détaché, et `replaceWith` n'y fait rien. */
  function ajouterChronoCarte(hote){
    chargerChronoAvancement().then(avancement => {
      const carte = avancement && chronoCarte(avancement);
      if(carte) hote.replaceWith(carte);
      else hote.remove();
    });
  }

  function renderDashboardContent(state){
    const body = $("#dashboardBody");
    const blocks = [];

    /* LE CADRE MAJEUR DE L'ECRAN, et le seul. La maquette lui donne trois
       parts : de quoi l'on parle, le chiffre qui compte, et l'action. Ici, le
       boss de la semaine, les runs engagees avec leur echeance, et le chemin
       vers le centre Boss. */
    const semaine = currentBossWeek(new Date());
    blocks.push(el("section",{class:"ornate-panel boss-feature"},[
      el("div", null, [
        el("p",{class:"context-label",text:"Boss de la semaine"}),
        el("h2",{text:BOSS_NAME}),
        el("p",{text:"Semaine du " + frDate(semaine.startDate)
          + " au " + frDate(semaine.endDate) + " · reset lundi 9h"})
      ]),
      el("div",{class:"feature-score"},[
        el("span",{text:"Runs engagées"}),
        el("strong",{text:state.engaged + "/3"}),
        el("small",{
          dataset:{ level:state.deadlineStatus.level },
          text:state.deadlineStatus.label
        })
      ]),
      el("button",{
        class:"btn btn-primary",
        type:"button",
        dataset:{ dashboardAction:"find-group", dashboardNetworkAction:"true" },
        text:"Préparer ma run",
        onclick:()=>void runDashboardAction({ type:"find-group" })
      })
    ]));

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
          class:"btn btn-ghost",
          type:"button",
          text:"Réessayer",
          onclick:()=>void renderDashboardView({ force:true })
        })
      ]));
    }

    /* LES PRIORITES. Les runs a mener, mais aussi les deux choses qui les
       empechent : des dispos jamais posees, un roster incomplet. Elles
       vivaient dans des panneaux separes, en bas de page ; ce sont des taches
       comme les autres, elles rejoignent la meme grille. */
    const priorites = state.actions.slice();
    const availability = state.availability;
    if(availability && !availability.mine.posed){
      priorites.push({
        type:"post-availability",
        titre:"Tes dispos ne sont pas posées",
        phrase:"La confrérie ne peut pas te compter dans ses créneaux tant "
          + "que tu n'as rien posé.",
        label:"Poser mes dispos"
      });
    }
    if(state.roster && state.roster.toComplete > 0){
      priorites.push({
        type:"complete-roster",
        titre:state.roster.toComplete + " héros à compléter",
        phrase:"Un héros sans équipement complet ne peut pas être proposé "
          + "aux autres membres.",
        label:"Compléter mon roster"
      });
    }

    if(priorites.length){
      blocks.push(el("div",{class:"section-title-row"},[
        el("div", null, [
          el("p",{class:"context-label",text:"Priorités"}),
          el("h2",{text:"À faire maintenant"})
        ]),
        el("span",{text:priorites.length
          + (priorites.length > 1 ? " actions" : " action")})
      ]));
      blocks.push(el("div",{class:"dashboard-grid"},
        priorites.map((action, rang) => carteDAction(action, rang + 1))));
    }

    /* CE QUE LA SEMAINE DONNE, en rangee cloisonnee. Ce sont des chiffres de
       meme nature : ils se lisent ensemble, pas dans quatre panneaux. */
    blocks.push(el("div",{class:"section-title-row"},[
      el("div", null, [
        el("p",{class:"context-label",text:"Cette semaine"}),
        el("h2",{text:"Où tu en es"})
      ])
    ]));
    blocks.push(el("div",{class:"stat-grid"},[
      celluleDeStat("Runs terminées", state.completed, "sur 3 possibles"),
      celluleDeStat("Runs en cours", state.open, "engagées, pas encore jouées"),
      celluleDeStat("Encore disponibles", state.remaining, "avant le reset"),
      celluleDeStat(
        "Créneaux posés",
        availability ? availability.mine.count : "—",
        availability && availability.best
          ? "meilleur : " + bestSlotLabel(availability.best)
          : "pour la confrérie"
      )
    ]));

    if(availability && availability.best){
      blocks.push(el("section",{class:"ornate-panel recommendation-panel"},[
        el("div", null, [
          el("p",{class:"context-label",text:"Créneau de la confrérie"}),
          el("h2",{text:bestSlotLabel(availability.best)}),
          el("p",{text:"C'est l'heure ou le plus de membres sont disponibles "
            + "cette semaine."})
        ]),
        el("button",{
          class:"btn btn-ghost",
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
      blocks.push(el("div",{class:"section-title-row"},[
        el("h2",{text:"Runs en cours"}),
        el("span",{text:openGroups.length + " sur 3"})
      ]));
      blocks.push(el("div",{class:"dashboard-run-grid"},
        openGroups.map(dashboardRunCard)));
    }

    const doneGroups = state.groups.filter(group => group.status === "archived");
    if(doneGroups.length){
      blocks.push(el("div",{class:"section-title-row"},[
        el("h2",{text:"Runs terminées"}),
        el("span",{text:"cette semaine"})
      ]));
      blocks.push(el("div",{class:"dashboard-run-grid"},
        doneGroups.map(dashboardRunCard)));
    }

    /* L'hôte de la carte de chronométrage : elle se remplace elle-même dès
       que le fichier d'avancement répond, et disparaît s'il ne dit rien.
       Il reste SANS la classe `dashboard-section` et masqué : celle-ci porte
       une bordure et un fond, et un encadré vide clignoterait à chaque rendu
       le temps de la lecture. */
    const hoteChrono = el("section",{
      hidden:"hidden",
      dataset:{ card:"chronometrage", chronometrage:"attente" }
    });
    blocks.push(hoteChrono);

    body.replaceChildren(...blocks);
    ajouterChronoCarte(hoteChrono);
    if(state.offline){
      body.querySelectorAll('[data-dashboard-network-action="true"]')
        .forEach(button => {
          button.disabled = true;
          button.title = "Action indisponible hors ligne";
        });
    }
  }

  /* LA CARTE DE SYNCHRONISATION de la maquette : une pastille verte, l'etat,
     et l'heure. Elle remplace deux lignes de texte gris qui disaient la meme
     chose sans qu'on les voie. Hors ligne, la pastille s'eteint. */
  function renderDashboardSyncMeta(state){
    const meta = $("#dashboardSyncMeta");
    if(!state){
      meta.replaceChildren();
      meta.className = "dashboard-sync-meta";
      return;
    }
    const heure = state.lastSyncedAt
      ? frDateTime(new Date(state.lastSyncedAt).toISOString())
      : "heure inconnue";
    meta.className = "sync-card dashboard-sync-meta";
    meta.dataset.offline = String(!!state.offline);
    /* La pastille occupe les deux rangees, le titre et l'heure s'empilent a
       cote : ce sont donc trois enfants directs, pas un bloc emboite. */
    meta.replaceChildren(
      el("span",{class:"live-dot"}),
      el("b",{text:state.offline ? "Hors ligne" : "Données synchronisées"}),
      el("small",{text:heure})
    );
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
