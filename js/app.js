/* Les `import` doivent précéder l'IIFE : ils vivent au niveau du module, pas
   dans sa portée interne. */
import { shouldIgnoreAvailabilityEcho } from "./metier/dispos-logique.js";

import { enregistrerVue, showView } from "./vues/navigation.js";
import { closeAuth, openAuth, setAuthBusy, setAuthStatus } from "./vues/modale-auth.js";
import { ensureBossViewOwner, renderBossView } from "./vues/boss-sessions.js";

import {
  pseudoInput,
  renderBuilder,
  resetBuilderRosterBaselines
} from "./vues/builder.js";
import { renderMemberRoster } from "./vues/roster-membres.js";
import { renderAnalyse } from "./vues/analyse.js";
import { renderRoster } from "./vues/roster-equipes.js";
import { renderDashboardView } from "./vues/suivi.js";
import { sessionCourante } from "./etat/session.js";
import { brouillonEquipe } from "./etat/brouillon-equipe.js";
import { authMessage, sb } from "./noyau/supabase-client.js";







import { DashboardStore } from "./donnees/suivi-store.js";
import { LocalTeams, Store } from "./donnees/equipes-store.js";
import { normalizeTeam } from "./metier/equipe-modele.js";
import {
  closeGearConfigEditor,
  gearConfigEditorState,
  renderGearConfigEditor
} from "./vues/editeur-equipement.js";



import {
  BUILD_GEAR,
  BUILD_GEAR_SETS,
  buildGearDefinition,
  gearConfigStatus,
  gearEnchantmentChoiceStatus
} from "./metier/build-config.js";


import { isInteger, jsonCopy } from "./noyau/outils.js";

import { Availability, renderAvailabilityView } from "./vues/dispos.js";


import { toast } from "./vues/toast.js";

import { DATA, POT, MIGRATION_KEY_PREFIX } from "./noyau/constantes.js";


import { $, uid, el } from "./noyau/dom.js";

(function(){
  "use strict";

  if(!DATA){
    document.getElementById("heroGrid").innerHTML =
      '<div class="empty-state"><p class="big">data.js introuvable</p>' +
      '<p>Lance <b>generate-data.ps1</b> puis recharge la page.</p></div>';
    return;
  }

  /* ============================ Équipes : local + Supabase ============================ */

  /* ============================ Brouillon d'équipe ============================ */
  function buildGearCatalog(){
    return BUILD_GEAR;
  }
  /* PRÉSUMÉ, NON VÉRIFIÉ :
   * le gain par niveau d'une pièce part de la borne basse de son segment.
   *
   * Vérification dans le jeu : relever la même statistique d'une même armure
   * à qualityMin, juste avant, au niveau et juste après la première borne
   * interne, puis comparer les reconstructions "segment-lower-bound" et
   * "quality-min". Si la mesure contredit ce choix, remplacer uniquement la
   * valeur ci-dessous. Aucune autre partie du moteur ne connaît l'hypothèse. */
  /* Une arme ne porte qu'une seule perle : tous les emplacements renseignés
     doivent partager le même palier et le même élément. Sans cette contrainte,
     un état absurde deviendrait « valide ». */
  /* Le jeu interdit deux fois la même stat sur une perle. Les emplacements
     encore vides ne comptent pas : sinon toute saisie en cours serait refusée. */

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * l’outrepassement multiplie la statistique principale native de l’arme
   * avant les enchantements. Le fait qu’il ne touche ni les sous-statistiques
   * ni le passif est confirmé par le propriétaire ; seule la base précise de
   * la statistique principale reste présumée.
   *
   * Vérification dans le jeu :
   * relever l’ATK à outrepassement 0 puis 1 sur une arme enchantée.
   * Si le gain de 5 % inclut les enchantements, remplacer uniquement
   * "native-before-enchantments" par "native-and-enchantments".
   */

  function buildGearSets(){
    return BUILD_GEAR_SETS;
  }

  /*
   * PRÉSUMÉ, NON VÉRIFIÉ :
   * les 30 % d'ATK plate des deux armes secondaires sont ajoutés avant les
   * taux principaux du héros. Protocole : comparer sur Merlin l'ATK affichée
   * avec les deux armes secondaires configurées, puis sans l'une d'elles. Si
   * l'écart réel n'est pas lui-même affecté par les taux principaux, changer
   * uniquement ce mode et le branchement de ces seaux.
   */

  function gearConfigFirstInvalidSelector(file, draft){
    const definition = buildGearDefinition(file);
    if(!definition) return ".gear-config-level";
    if(!draft || !isInteger(draft.level)
      || draft.level < definition.qualityMin
      || draft.level > definition.qualityMax){
      return ".gear-config-level";
    }
    if(!isInteger(draft.reinforce)
      || draft.reinforce < 0
      || draft.reinforce > definition.reinforceMax){
      return ".gear-config-reinforce";
    }
    const choices = Array.isArray(draft.enchantments) ? draft.enchantments : [];
    for(let index = 0; index < choices.length; index += 1){
      const status = gearEnchantmentChoiceStatus(definition, choices[index], index);
      if(status !== "valid"){
        const suffix = choices[index] && choices[index].stat ? "value" : "stat";
        return '[data-gear-slot="'+index+'"] .gear-config-enchantment-'+suffix;
      }
    }
    return ".gear-config-level";
  }

  function saveGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    if(gearConfigStatus(state.context.file, state.draft) !== "valid"){
      state.validationAttempted = true;
      renderGearConfigEditor();
      const invalid = $("#gearConfigOverlay").querySelector(
        gearConfigFirstInvalidSelector(state.context.file, state.draft)
      );
      if(invalid){
        invalid.setAttribute("aria-invalid","true");
        invalid.focus();
      }
      return;
    }
    state.context.commit(jsonCopy(state.draft));
    closeGearConfigEditor();
  }

  function resetGearConfigEditor(){
    const state = gearConfigEditorState;
    if(!state) return;
    if(!confirm("Réinitialiser la configuration chiffrée de cette pièce ?")) return;
    state.context.commit(null);
    closeGearConfigEditor();
  }

  $("#gearConfigClose").addEventListener("click", closeGearConfigEditor);
  $("#gearConfigCancel").addEventListener("click", closeGearConfigEditor);
  $("#gearConfigSave").addEventListener("click", saveGearConfigEditor);
  $("#gearConfigReset").addEventListener("click", resetGearConfigEditor);
  $("#gearConfigOverlay").addEventListener("click", event => {
    if(event.target === $("#gearConfigOverlay")) closeGearConfigEditor();
  });

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
      const dashboardChanged = changed.has("teams") || changed.has("boss");
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
          /* L'écho de sa PROPRE écriture, pendant qu'on peint encore, ferait
             réapparaître un masque plus ancien que la sélection en cours. */
          if(shouldIgnoreAvailabilityEcho(
            payload && payload.new,
            userId,
            Availability.isSaving()
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

  /* ============================ Authentification Supabase ============================ */
  async function profilePseudo(user){
    if(!user || !sb) return "";
    const { data, error } = await sb.from("profiles")
      .select("pseudo")
      .eq("id", user.id)
      .maybeSingle();
    if(error) throw error;
    return data && typeof data.pseudo === "string" ? data.pseudo.trim() : "";
  }

  function updateAccountUi(){
    $("#accountLogin").hidden = !!sessionCourante.user;
    $("#accountConnected").hidden = !sessionCourante.user;
    $("#accountPseudo").textContent = sessionCourante.pseudo || (sessionCourante.user && sessionCourante.user.email) || "";
    /* Bouton à usage unique : il n'apparaît que s'il reste vraiment quelque
       chose à importer depuis CE navigateur. Une fois la migration faite — ou
       s'il n'y a aucune donnée locale — il disparaît au lieu de rester
       désactivé, car il occupait une ligne entière du header mobile. */
    const migrationButton = $("#btnMigrateLocal");
    const migrated = !!sessionCourante.user &&
      localStorage.getItem(MIGRATION_KEY_PREFIX+sessionCourante.user.id) === "1";
    let hasLocalData = false;
    try{
      hasLocalData = LocalTeams.all().length > 0;
    }catch(error){
      hasLocalData = false;
    }
    migrationButton.hidden = !sessionCourante.user || migrated || !hasLocalData;
    migrationButton.disabled = migrated;
    migrationButton.textContent = "Importer mes données locales";
    /* `pseudoInput` vient d'un module : il est initialisé avant que ce
       fichier ne s'exécute. Le garde `typeof` d'avant ne protégeait déjà de
       rien — sur un `const` en zone morte, `typeof` lève au lieu de renvoyer
       « undefined ». */
    pseudoInput.disabled = !!sessionCourante.user;
    if(sessionCourante.user && sessionCourante.pseudo){
      brouillonEquipe.equipe.pseudo = sessionCourante.pseudo;
      pseudoInput.value = sessionCourante.pseudo;
    }
  }

  async function applySession(session){
    const applicationEpoch = ++sessionCourante.applicationEpoch;
    const expectedUser = session && session.user ? session.user : null;
    const expectedUserId = expectedUser ? expectedUser.id : "";
    const isCurrentApplication = () =>
      applicationEpoch === sessionCourante.applicationEpoch &&
      (sessionCourante.user ? sessionCourante.user.id : "") === expectedUserId;
    const previousUserId = sessionCourante.user ? sessionCourante.user.id : "";
    sessionCourante.user = expectedUser;
    const sessionChanged = previousUserId !== expectedUserId;
    if(sessionChanged){
      ensureBossViewOwner();
      resetBuilderRosterBaselines();
      // Le suivi du compte précédent ne doit jamais rester visible.
      DashboardStore.reset(expectedUserId);
      if($("#view-boss").classList.contains("active")) void renderBossView();
    }
    sessionCourante.pseudo = "";
    sessionCourante.rosterProfiles = [];
    if(sessionCourante.user){
      let loadedPseudo = "";
      try{
        loadedPseudo = await profilePseudo(expectedUser);
      }catch(error){
        if(!isCurrentApplication()) return;
        toast("Profil indisponible : "+authMessage(error), true);
      }
      if(!isCurrentApplication()) return;
      sessionCourante.pseudo = loadedPseudo;
      if(!sessionCourante.pseudo) sessionCourante.pseudo = (sessionCourante.user.email||"membre").split("@")[0];
      closeAuth();
    }else if(sb){
      openAuth();
    }
    if(sessionCourante.user) RealtimeSync.start(sessionCourante.user.id);
    else RealtimeSync.stop();
    updateAccountUi();
    if($("#view-builder").classList.contains("active")) renderBuilder();
    if($("#view-roster").classList.contains("active")) void renderRoster();
    const memberRosterView = $("#view-member-roster");
    if(memberRosterView && memberRosterView.classList.contains("active")
      && typeof renderMemberRoster === "function"){
      void renderMemberRoster();
    }
    if($("#view-analyse").classList.contains("active")) void renderAnalyse();
    /* « Mon suivi » devient la vue par défaut à la résolution initiale d'une
       session et après une connexion réussie, c'est-à-dire au passage
       « aucun compte -> un compte ». Un changement de compte piloté de
       l'extérieur, comme un TOKEN_REFRESHED, ne déplace jamais la navigation :
       il se contente de réafficher le suivi du bon compte s'il est visible. */
    if(sessionChanged && !previousUserId && sessionCourante.user){
      void showView("dashboard");
    }else if($("#view-dashboard").classList.contains("active")){
      void renderDashboardView();
    }
  }

  async function signIn(){
    if(!sb){ openAuth("Connexion indisponible hors ligne.", true); return; }
    const email = ($("#authEmail").value||"").trim();
    const password = $("#authPassword").value||"";
    if(!email || !password){ setAuthStatus("Renseigne ton email et ton mot de passe.", true); return; }
    setAuthBusy(true);
    setAuthStatus("Connexion au registre…");
    try{
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if(error) throw error;
      await applySession(data && data.session);
    }catch(error){
      setAuthStatus(authMessage(error), true);
    }finally{
      setAuthBusy(false);
    }
  }

  async function signUp(){
    if(!sb){ openAuth("Création de compte indisponible hors ligne.", true); return; }
    const email = ($("#authEmail").value||"").trim();
    const password = $("#authPassword").value||"";
    const pseudo = ($("#authSignupPseudo").value||"").trim();
    if(!email || !password || !pseudo){
      setAuthStatus("Renseigne l’email, le mot de passe et le pseudo.", true);
      return;
    }
    setAuthBusy(true);
    setAuthStatus("Création du compte…");
    try{
      const { data, error } = await sb.auth.signUp({ email, password });
      if(error) throw error;
      if(!data || !data.user) throw new Error("Compte non créé.");
      if(!data.session){
        setAuthStatus("Compte créé, mais la session n’est pas ouverte. Désactive « Confirm email » dans Supabase.", true);
        return;
      }
      const profileResult = await sb.from("profiles").upsert({ id:data.user.id, pseudo });
      if(profileResult.error) throw profileResult.error;
      sessionCourante.pseudo = pseudo;
      await applySession(data.session);
      sessionCourante.pseudo = pseudo;
      updateAccountUi();
      toast("Compte créé. Bienvenue "+pseudo+" !");
    }catch(error){
      setAuthStatus(authMessage(error), true);
    }finally{
      setAuthBusy(false);
    }
  }

  async function initAuth(){
    updateAccountUi();
    if(!sb) return;
    sb.auth.onAuthStateChange((event, session) => {
      if(event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED"){
        setTimeout(()=>void applySession(session), 0);
      }
    });
    try{
      const { data, error } = await sb.auth.getSession();
      if(error) throw error;
      await applySession(data && data.session);
    }catch(error){
      openAuth(authMessage(error), true);
    }
  }

  $("#accountLogin").addEventListener("click", ()=>
    openAuth(sb ? "" : "Connexion indisponible hors ligne.", !sb)
  );
  $("#authOffline").addEventListener("click", closeAuth);
  $("#authSignIn").addEventListener("click", ()=>void signIn());
  $("#authSignUp").addEventListener("click", ()=>void signUp());
  $("#authPassword").addEventListener("keydown", event => {
    if(event.key === "Enter") void signIn();
  });
  $("#authLogout").addEventListener("click", async()=>{
    if(!sb) return;
    const { error } = await sb.auth.signOut();
    if(error) toast(authMessage(error), true);
  });

  /* ============================ Navigation onglets ============================ */
  /* Chaque vue s'annonce au registre de vues/navigation.js. L'enveloppe dit ce
     que `showView` doit renvoyer : les trois vues enveloppees ici renvoyaient
     deja `true` quel que soit leur resultat, seul le rendu comptait. */
  enregistrerVue("dashboard", renderDashboardView);
  enregistrerVue("builder", ()=>{ renderBuilder(); return true; });
  enregistrerVue("roster", ()=>Promise.resolve(renderRoster()).then(()=>true));
  enregistrerVue("member-roster",
    ()=>Promise.resolve(renderMemberRoster()).then(()=>true));
  enregistrerVue("analyse", ()=>Promise.resolve(renderAnalyse()).then(()=>true));
  enregistrerVue("boss", renderBossView);
  enregistrerVue("availability", renderAvailabilityView);

  /* ============================ Export / Import ============================ */
  $("#btnExport").addEventListener("click", ()=>{
    const data = Store.all();
    if(!data.length){ toast("Rien à exporter.", true); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const a = el("a",{href:URL.createObjectURL(blob), download:"confrerie7ds-equipes.json"});
    document.body.appendChild(a); a.click(); a.remove();
    toast(data.length+" équipe(s) exportée(s).");
  });

  $("#btnImport").addEventListener("click", ()=>$("#importFile").click());
  $("#importFile").addEventListener("change", e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = async()=>{
      try{
        const incoming = JSON.parse(reader.result);
        if(!Array.isArray(incoming)) throw new Error("format");
        const normalized = [];
        let added=0;
        incoming.forEach(t=>{
          if(!t || typeof t!=="object") return;
          const team = normalizeTeam(Object.assign({}, t, { id:t.id||uid() }));
          normalized.push(team);
          added++;
        });
        if(sessionCourante.user){
          for(const team of normalized) await Store.upsert(team);
        }else{
          const list = LocalTeams.all();
          normalized.forEach(team=>{
            const index = list.findIndex(item=>item.id===team.id);
            if(index>=0) list[index]=team; else list.push(team);
          });
          LocalTeams.save(list);
        }
        await renderRoster();
        toast(added+" équipe(s) importée(s).");
      }catch(err){ toast("Fichier JSON invalide.", true); }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  async function migrateLocalData(){
    if(!sessionCourante.user || !sb){
      openAuth("Connecte-toi pour importer tes données locales.", true);
      return;
    }
    const migrationKey = MIGRATION_KEY_PREFIX+sessionCourante.user.id;
    if(localStorage.getItem(migrationKey) === "1") return;
    const button = $("#btnMigrateLocal");
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "Import en cours…";
    try{
      const localTeams = LocalTeams.all();
      if(!localTeams.length){
        toast("Aucune donnée locale à importer.");
        return;
      }

      for(const localTeam of localTeams){
        await Store.upsert(Object.assign({}, localTeam, {
          pseudo:sessionCourante.pseudo,
          owner:sessionCourante.user.id,
          updatedAt:localTeam.updatedAt || Date.now()
        }));
      }

      localStorage.setItem(migrationKey, "1");
      updateAccountUi();
      if($("#view-roster").classList.contains("active")) await renderRoster();
      if($("#view-analyse").classList.contains("active")) await renderAnalyse();
      toast(
        localTeams.length+" équipe"+(localTeams.length>1 ? "s" : "")
          +" importée"+(localTeams.length>1 ? "s" : "")+" dans le registre."
      );
    }catch(error){
      toast("Import local impossible : "+authMessage(error), true);
    }finally{
      if(localStorage.getItem(migrationKey) !== "1"){
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }
  $("#btnMigrateLocal").addEventListener("click", ()=>void migrateLocalData());

  /* ============================ Démarrage ============================ */
  $("#databar").textContent =
    (DATA.personnages||[]).length + " héros · " +
    Object.keys(DATA.armes||{}).length + " types d'armes · " +
    Object.keys(DATA.armures||{}).length + " emplacements d'armure · " +
    Object.values(DATA.bijoux||{}).reduce((n,l)=>n+l.length,0) + " bijoux · " +
    Object.keys(POT).length + " persos avec potentiels" +
    (DATA.generatedAt ? "  ·  données du "+DATA.generatedAt : "");

  renderBuilder();
  void initAuth();
})();
