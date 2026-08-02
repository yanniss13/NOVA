/* La session : se connecter, se deconnecter, et propager le resultat.

   `applySession` est le coeur du module et le seul endroit du site qui
   rafraichit TOUTES les vues d'un coup. C'est normal : changer d'identite
   change ce que chaque onglet a le droit de montrer.

   Le compteur `applicationEpoch` protege d'une course reelle. Deux evenements
   d'authentification peuvent se suivre de pres — reprise de session au
   chargement, puis rafraichissement du jeton — et le premier, plus lent,
   ecraserait le second. Chaque application prend un numero et abandonne des
   qu'un plus recent existe.

   Le module s'arrete a la session. La FENETRE de connexion, elle, vit dans
   modale-auth.js : elle n'a besoin de rien de tout ceci, et onze vues
   l'ouvrent sans vouloir dependre de l'authentification entiere. */

import { LocalTeams } from "../donnees/equipes-store.js";
import { DashboardStore } from "../donnees/suivi-store.js";
import { brouillonEquipe } from "../etat/brouillon-equipe.js";
import { sessionCourante } from "../etat/session.js";
import { MIGRATION_KEY_PREFIX } from "../noyau/constantes.js";
import { $ } from "../noyau/dom.js";
import { authMessage, sb } from "../noyau/supabase-client.js";
import { renderAnalyse } from "./analyse.js";
import { ensureBossViewOwner, renderBossView } from "./boss-sessions.js";
import { pseudoInput, renderBuilder, resetBuilderRosterBaselines } from "./builder.js";
import { closeAuth, openAuth, setAuthBusy, setAuthStatus } from "./modale-auth.js";
import { showView } from "./navigation.js";
import { renderRoster } from "./roster-equipes.js";
import { renderMemberRoster } from "./roster-membres.js";
import { renderDashboardView } from "./suivi.js";
import { RealtimeSync } from "./synchro-temps-reel.js";
import { toast } from "./toast.js";
import { Store } from "../donnees/equipes-store.js";

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

  /* Importer dans son compte les equipes reste es en local. Le bouton vit
     a cote de « Deconnexion » dans index.html, et l'operation ne veut rien
     dire sans compte : sa place est avec la session. */
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

/* updateAccountUi est redevenue privee quand la migration des donnees
   locales l a rejointe : c etait son dernier appelant du dehors. */
export { initAuth };
