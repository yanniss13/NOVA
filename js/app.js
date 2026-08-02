/* Les `import` doivent précéder l'IIFE : ils vivent au niveau du module, pas
   dans sa portée interne. */
import { shouldIgnoreAvailabilityEcho } from "./metier/dispos-logique.js";
import { ModalStack } from "./vues/modal-stack.js";
import { enregistrerVue, showView } from "./vues/navigation.js";
import { closeAuth, openAuth, setAuthBusy, setAuthStatus } from "./vues/modale-auth.js";
import {
  bossViewState,
  ensureBossViewOwner,
  openBossReport,
  openBossTeamPicker,
  renderBossView
} from "./vues/boss-sessions.js";
import {
  activateHeroBuild,
  applyCharacterChange,
  applyGearChange,
  applyWeaponChange,
  equipmentSetButton,
  findGearConfigButton,
  gearConfigurableSlot,
  rosterEntryWithActiveHeroBuild,
  storeActiveHeroBuild,
  weaponConfigControl
} from "./vues/edition-build.js";
import { canManageTeam, sessionCourante } from "./etat/session.js";
import { brouillonEquipe } from "./etat/brouillon-equipe.js";
import { authMessage, sb } from "./noyau/supabase-client.js";
import { charOf, nameOfFile } from "./metier/catalogue.js";
import { heroStatsSection } from "./vues/stats-heros.js";
import { badgesRow, weaponSlotBadge } from "./vues/fiche-heros.js";
import { openTeamDetail } from "./vues/detail-equipe.js";

import {
  openRosterDetailFor,
  rosterDetail,
  rosterDetailOwnerLabel
} from "./vues/detail-roster.js";
import { MemberRosterStore, cloudRosterFromRow } from "./donnees/roster-store.js";
import { DashboardStore } from "./donnees/suivi-store.js";
import { LocalTeams, Store } from "./donnees/equipes-store.js";
import {
  compatibleWeaponGroups,
  favoriteRosterWeaponType,
  normalizeHero,
  normalizePotentiel,
  normalizeRosterCharacter,
  normalizeTeam,
  normalizeTeamName,
  rosterHeroSnapshot,
  teamBuildSnapshot
} from "./metier/equipe-modele.js";
import {
  closeGearConfigEditor,
  gearConfigEditorState,
  renderGearConfigEditor
} from "./vues/editeur-equipement.js";
import { gearSlot, renderBonus, rosterWeaponLabel } from "./vues/elements.js";
import {
  closeWeaponConfigEditor,
  weaponDefaultGradeGameId
} from "./vues/editeur-arme.js";

import {
  BUILD_GEAR,
  BUILD_GEAR_SETS,
  buildGearDefinition,
  gearConfigStatus,
  gearEnchantmentChoiceStatus
} from "./metier/build-config.js";
import { linkedArmorsOf, weaponFolderOf, weaponTypesOf } from "./metier/armes.js";

import { isInteger, jsonCopy, owns } from "./noyau/outils.js";

import { Availability, renderAvailabilityView } from "./vues/dispos.js";

import { refreshRosterProfiles } from "./donnees/roster-profils.js";
import { toast } from "./vues/toast.js";
import {
  ARMOR_SET_SLOTS,
  emptyArmor,
  emptyJewel,
  emptyPot
} from "./metier/equipement.js";
import {
  DATA,
  TEAM_SIZE,
  ARMOR_SLOTS,
  LINKED_ARMOR_SLOT,
  ARMOR_LABELS,
  JEWEL_SLOTS,
  JEWEL_LABELS,
  POT,
  POT_MAX,
  META,
  MIGRATION_KEY_PREFIX,
  ELEMENTS,
  WSLOT_ROLES,
  WEAPON_ENUM,
  metaOf,
  FOLDER_TO_ENUM,
  ENUM_TO_FOLDER
} from "./noyau/constantes.js";
import { Picker } from "./vues/picker.js";
import { formatBossScore, frDateTime } from "./metier/boss-logique.js";
import { $, uid, norm, initials, el } from "./noyau/dom.js";

(function(){
  "use strict";

  function builderWeaponSwitcher(hero, heroIndex, character){
    const metadata = character ? metaOf(character.id) : null;
    if(!metadata || !Array.isArray(metadata.weapons)
      || !metadata.weapons.length){
      return null;
    }
    const row = el("div",{
      class:"hero-badges builder-weapon-switcher",
      role:"group",
      "aria-label":"Builds par type d'arme"
    });
    const slots = el("div",{class:"wslots"});
    const activeType = weaponFolderOf(hero.weapon)
      || hero.activeWeaponType;
    metadata.weapons.forEach(slot => {
      const type = ENUM_TO_FOLDER[slot.weapon];
      if(!type) return;
      const active = type === activeType;
      const dirty = builderBuildIsDirty(heroIndex, type);
      const badge = weaponSlotBadge(slot, active);
      slots.appendChild(el("button",{
        class:"builder-weapon-switch"
          +(active ? " active" : "")
          +(dirty ? " dirty" : ""),
        type:"button",
        dataset:{weaponType:type},
        "aria-pressed":String(active),
        "aria-label":"Afficher le build "+rosterWeaponLabel(type)
          +(dirty ? " modifié" : ""),
        title:"Afficher le build "+rosterWeaponLabel(type)
          +(dirty ? " — modifié" : ""),
        onclick:()=>switchBuilderHeroBuild(heroIndex, type)
      },[badge]));
    });
    row.appendChild(slots);
    return row;
  }
  function potentielDetailsOf(hero){
    const weaponType = weaponFolderOf(hero && hero.weapon);
    const byWeapon = (hero && hero.char && POT[hero.char]) || {};
    return { weaponType, list:(weaponType && byWeapon[weaponType]) || [] };
  }

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

  const emptyRosterBuild = () => ({
    weapon:null,
    weaponConfig:null,
    armor:emptyArmor(),
    armorConfig:{},
    jewel:emptyJewel(),
    jewelConfig:{},
    note:"",
    favorite:false
  });
  function setFavoriteRosterBuild(entry, weaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized
      || !Object.prototype.hasOwnProperty.call(normalized.builds, weaponType)){
      return null;
    }
    const wasFavorite = normalized.builds[weaponType].favorite;
    Object.values(normalized.builds)
      .forEach(build => { build.favorite = false; });
    normalized.builds[weaponType].favorite = !wasFavorite;
    return normalized;
  }
  function copyFavoriteRosterBuild(entry, targetWeaponType){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized || !weaponTypesOf(normalized.charId).includes(targetWeaponType)){
      return null;
    }
    const sourceType = favoriteRosterWeaponType(normalized);
    if(!sourceType || sourceType === targetWeaponType) return null;
    const source = normalized.builds[sourceType];
    const target = normalized.builds[targetWeaponType] || emptyRosterBuild();
    normalized.builds[targetWeaponType] = {
      weapon:target.weapon,
      weaponConfig:jsonCopy(target.weaponConfig),
      armor:JSON.parse(JSON.stringify(source.armor)),
      armorConfig:JSON.parse(JSON.stringify(source.armorConfig)),
      jewel:JSON.parse(JSON.stringify(source.jewel)),
      jewelConfig:JSON.parse(JSON.stringify(source.jewelConfig)),
      note:source.note,
      favorite:false
    };
    return normalizeRosterCharacter(normalized);
  }

  /* ===== #5 Analyse : DPS dérivés du Roster ===== */
  // Un build Attaquant du roster = une entrée DPS { char, element, pot }.
  // Exception unique : Gowther Baguette (Briseur) à partir de P7.
  function isRosterBuildDps(entry, slot, weaponEnum){
    if(slot.role === "Attacker") return true;
    return slot.role === "Buster"
      && entry.charId === "gowther"
      && weaponEnum === "Wand"
      && (entry.potentialTier||0) >= 7;
  }
  /* Préférence de jeu du propriétaire, propre à Meliodas : à défaut de favori,
     ouvrir l'Épée à une main. Ce n'est pas une liste d'assets — c'est une
     règle produit nommée. La généraliser changerait le comportement de futurs
     personnages sans décision. */
  const DPS_PREFERRED_WEAPON_BY_CHAR = { meliodas:"Sword1h" };

  function dpsEntriesFromRoster(entry){
    const m = entry && metaOf(entry.charId);
    if(!m || !entry.builds) return [];
    /* Les SR sont hors de l'analyse DPS. Filtrer ici les retire d'un coup du
       classement, de la couverture et de la matrice, qui dérivent toutes de
       cette sortie. */
    if(m.rarity !== "SSR") return [];
    const favoriteFolder = favoriteRosterWeaponType(entry);
    const favoriteEnum = favoriteFolder ? FOLDER_TO_ENUM[favoriteFolder] : null;
    const preferred = DPS_PREFERRED_WEAPON_BY_CHAR[entry.charId] || null;
    const byElement = new Map();
    /* On parcourt les slots du personnage, pas les clés de `builds` : l'ordre
       des armes devient stable d'un membre à l'autre. */
    (m.weapons||[]).forEach(slot => {
      const en = slot.weapon;
      const folder = ENUM_TO_FOLDER[en];
      if(!folder || !owns(entry.builds, folder)) return;
      if(!isRosterBuildDps(entry, slot, en)) return;
      const element = (slot.element||"").toUpperCase();
      if(!element) return;
      if(!byElement.has(element)){
        byElement.set(element, {
          char:entry.charId,
          element,
          pot:entry.potentialTier||0,
          weaponTypes:[],
          preferredWeaponType:null
        });
      }
      byElement.get(element).weaponTypes.push(en);
    });
    return [...byElement.values()].map(item => Object.assign(item, {
      preferredWeaponType:
        (favoriteEnum && item.weaponTypes.includes(favoriteEnum) && favoriteEnum)
        || (preferred && item.weaponTypes.includes(preferred) && preferred)
        || item.weaponTypes[0]
    }));
  }

  /* Assemblage d'un joueur de l'analyse. `characters` conserve les rosters
     normalises deja calcules : la modale de detail doit pouvoir s'ouvrir sans
     relire le reseau. */
  function rosterPlayerFrom(owner, name, entries){
    return {
      owner,
      name,
      characters:entries,
      dps:entries.reduce((acc, e) => acc.concat(dpsEntriesFromRoster(e)), [])
    };
  }

  // Agrège tous les rosters de la confrérie -> [{owner, name, dps:[…], characters:[…]}]
  async function rosterDerivedPlayers(){
    if(!sessionCourante.user || !sb) return [];
    const [rosterRes, profiles] = await Promise.all([
      sb.from("roster_characters").select("owner,char_id,potential_tier,builds,updated_at"),
      refreshRosterProfiles().catch(()=>sessionCourante.rosterProfiles.slice())
    ]);
    if(rosterRes.error) throw rosterRes.error;
    const byOwner = {};
    (rosterRes.data||[]).forEach(row=>{
      const entry = cloudRosterFromRow(row);
      if(!entry) return;
      (byOwner[entry.owner] = byOwner[entry.owner] || []).push(entry);
    });
    const nameOf = id => {
      const p = (profiles||[]).find(x => x.id === id);
      if(p) return p.pseudo;
      if(sessionCourante.user && id === sessionCourante.user.id) return sessionCourante.pseudo || "Moi";
      return "Membre";
    };
    return Object.keys(byOwner)
      .map(owner => rosterPlayerFrom(owner, nameOf(owner), byOwner[owner]))
      .filter(p => p.dps.length);
  }

  /* Nom d'équipe facultatif. Il vit dans le jsonb de `teams.data`, donc aucune
     migration Supabase : une équipe antérieure devient simplement sans nom. */

  const emptyHero = () => ({
    char:null,
    weapon:null,
    weaponConfig:null,
    rosterBuilds:{},
    activeWeaponType:null,
    armor:emptyArmor(),
    armorConfig:{},
    jewel:emptyJewel(),
    jewelConfig:{},
    potentiel:emptyPot(),
    note:""
  });
  const emptyDraft = () => ({ id:uid(), name:"", pseudo:"", boss:"",
                              heroes:Array.from({length:TEAM_SIZE}, emptyHero) });

  /* L'etat du brouillon vit dans js/brouillon-equipe.js ; on l'amorce ici,
     au meme instant qu'avant, parce que emptyDraft() a besoin du catalogue. */
  brouillonEquipe.equipe = emptyDraft();
  brouillonEquipe.edition = false;
  brouillonEquipe.sourceMaj = 0;
  brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
  brouillonEquipe.supprimeAilleurs = false;
  brouillonEquipe.referencesRoster = Array.from(
    {length:TEAM_SIZE},
    () => ({
      ownerId:"",
      charId:"",
      updatedAt:0,
      updatedAtToken:"",
      builds:{}
    })
  );
  function rosterBaselineIdentityMatches(baseline, ownerId, charId){
    return !!baseline
      && baseline.ownerId === (ownerId || "")
      && baseline.charId === (charId || "");
  }
  function rosterBaselineVersionMatches(baseline, latest){
    const baselineToken = baseline
      && typeof baseline.updatedAtToken === "string"
      ? baseline.updatedAtToken
      : "";
    const latestToken = latest
      && typeof latest.updatedAtToken === "string"
      ? latest.updatedAtToken
      : "";
    if(baselineToken && latestToken){
      return baselineToken === latestToken;
    }
    return (Number(baseline && baseline.updatedAt) || 0)
      === (Number(latest && latest.updatedAt) || 0);
  }
  function builderRosterBaselineForHero(hero){
    const ownerId = sessionCourante.user ? sessionCourante.user.id : "";
    const charId = hero && hero.char ? hero.char : "";
    const entry = ownerId && charId
      ? MemberRosterStore.all(ownerId)
        .find(item => item.charId === charId)
      : null;
    return {
      ownerId,
      charId,
      updatedAt:Number(entry && entry.updatedAt) || 0,
      updatedAtToken:entry && entry.updatedAtToken || "",
      builds:entry ? jsonCopy(entry.builds) : {}
    };
  }
  function resetBuilderRosterBaseline(index){
    brouillonEquipe.referencesRoster[index] = builderRosterBaselineForHero(
      brouillonEquipe.equipe.heroes[index]
    );
  }
  function resetBuilderRosterBaselines(){
    brouillonEquipe.referencesRoster = brouillonEquipe.equipe.heroes.map(
      builderRosterBaselineForHero
    );
  }
  function builderBuildIsDirty(index, type){
    const hero = brouillonEquipe.equipe.heroes[index];
    const activeType = hero
      && (weaponFolderOf(hero.weapon) || hero.activeWeaponType);
    const current = type === activeType
      ? teamBuildSnapshot(hero)
      : hero && hero.rosterBuilds && hero.rosterBuilds[type];
    const baseline = brouillonEquipe.referencesRoster[index]
      && brouillonEquipe.referencesRoster[index].builds[type];
    return JSON.stringify(teamBuildSnapshot(current || {}))
      !== JSON.stringify(teamBuildSnapshot(baseline || {}));
  }

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
    if(typeof pseudoInput !== "undefined"){
      pseudoInput.disabled = !!sessionCourante.user;
      if(sessionCourante.user && sessionCourante.pseudo){
        brouillonEquipe.equipe.pseudo = sessionCourante.pseudo;
        pseudoInput.value = sessionCourante.pseudo;
      }
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

  /* ============================ Roster des membres ============================ */
  let memberRosterMode = "mine";
  let memberRosterOwnerId = "";
  let memberRosterRenderId = 0;
  let memberRosterEntries = [];
  let memberRosterVisible = [];
  let memberRosterEditable = false;
  let memberRosterDraft = null;
  let memberRosterDraftSourceUpdatedAt = 0;
  let memberRosterDraftInitialJson = "";
  let memberRosterWeaponType = "";
  const memberRosterFilters = {
    query:"",
    element:"",
    weapon:"",
    role:"",
    rarity:""
  };

  const rosterElementLabel = value => {
    const key = String(value || "").toUpperCase();
    return ELEMENTS[key] ? ELEMENTS[key].label : value;
  };
  const rosterRoleLabel = value => WSLOT_ROLES[value] || value;

  function rosterFilterValues(key){
    const values = new Set();
    Object.values(META).forEach(meta => {
      if(!meta) return;
      if(key === "rarity" && meta.rarity) values.add(meta.rarity);
      (meta.weapons || []).forEach(slot => {
        if(key === "element" && slot.element && slot.element !== "Default") values.add(slot.element);
        if(key === "weapon" && slot.weapon) values.add(slot.weapon);
        if(key === "role" && slot.role) values.add(slot.role);
      });
    });
    return [...values].sort((a,b)=>String(a).localeCompare(String(b), "fr"));
  }

  function rosterFilterLabel(key, value){
    if(key === "element") return rosterElementLabel(value);
    if(key === "weapon") return WEAPON_ENUM[value] ? WEAPON_ENUM[value].label : value;
    if(key === "role") return rosterRoleLabel(value);
    return value;
  }

  const MEMBER_ROSTER_FILTER_FIELDS = [
    ["element","Élément","memberRosterFilterElement"],
    ["weapon","Arme","memberRosterFilterWeapon"],
    ["role","Rôle","memberRosterFilterRole"],
    ["rarity","Rareté","memberRosterFilterRarity"]
  ];

  /* Le bouton de réinitialisation n'existe que si un filtre est actif : on
     l'ajoute et le retire seul, sans reconstruire les listes déroulantes, pour
     ne pas voler le focus au clavier juste après un choix. */
  function syncMemberRosterFilterReset(){
    const box = $("#memberRosterFilters");
    const row = box.querySelector(".member-roster-filter-actions");
    const active = MEMBER_ROSTER_FILTER_FIELDS.some(([key]) => memberRosterFilters[key]);
    if(!active){ if(row) row.remove(); return; }
    if(row) return;
    box.appendChild(el("div",{class:"member-roster-filter-actions"},[
      el("button",{
        class:"chip member-roster-filter-reset",
        id:"memberRosterFilterReset",
        type:"button",
        text:"Réinitialiser les filtres",
        onclick:()=>{
          MEMBER_ROSTER_FILTER_FIELDS.forEach(([key,,selectId])=>{
            memberRosterFilters[key] = "";
            const select = box.querySelector("#"+selectId);
            if(select){ select.value = ""; select.classList.remove("on"); }
          });
          syncMemberRosterFilterReset();
          renderMemberRosterCards(memberRosterEntries, memberRosterEditable);
        }
      })
    ]));
  }

  function renderMemberRosterFilterControls(){
    const box = $("#memberRosterFilters");
    box.innerHTML = "";
    const fields = el("div",{class:"member-roster-filter-fields"});
    MEMBER_ROSTER_FILTER_FIELDS.forEach(([key,label,selectId])=>{
      const select = el("select",{
        id:selectId,
        onchange:event=>{
          memberRosterFilters[key] = event.target.value;
          event.target.classList.toggle("on", Boolean(memberRosterFilters[key]));
          syncMemberRosterFilterReset();
          renderMemberRosterCards(memberRosterEntries, memberRosterEditable);
        }
      },[el("option",{value:"",text:"Tous"})]);
      rosterFilterValues(key).forEach(value => {
        select.appendChild(el("option",{ value, text:rosterFilterLabel(key, value) }));
      });
      select.value = memberRosterFilters[key] || "";
      if(memberRosterFilters[key]) select.classList.add("on");
      fields.appendChild(el("label",{class:"member-roster-filter-field",for:selectId},[
        el("span",{text:label}),
        select
      ]));
    });
    box.appendChild(fields);
    syncMemberRosterFilterReset();
  }

  function renderMemberRosterControls(profiles, ownerId){
    const mine = memberRosterMode === "mine";
    const mineButton = $("#memberRosterMine");
    const othersButton = $("#memberRosterOthers");
    mineButton.classList.toggle("btn-primary", mine);
    othersButton.classList.toggle("btn-primary", !mine);
    mineButton.setAttribute("aria-pressed", String(mine));
    othersButton.setAttribute("aria-pressed", String(!mine));
    $(".member-roster-owner-field").hidden = mine;
    $("#memberRosterAdd").hidden = !mine;

    const ownerSelect = $("#memberRosterOwner");
    ownerSelect.innerHTML = "";
    const others = (profiles || []).filter(profile => !sessionCourante.user || profile.id !== sessionCourante.user.id);
    if(!others.length){
      ownerSelect.appendChild(el("option",{value:"",text:"Aucun autre membre"}));
      ownerSelect.disabled = true;
    }else{
      ownerSelect.disabled = false;
      others.forEach(profile => ownerSelect.appendChild(el("option",{
        value:profile.id,
        text:profile.pseudo
      })));
    }
    ownerSelect.value = mine ? "" : ownerId;
    renderMemberRosterFilterControls();
  }

  function memberRosterMatches(entry){
    const character = charOf(entry.charId);
    if(!character) return false;
    if(memberRosterFilters.query && !norm(character.name).includes(norm(memberRosterFilters.query))){
      return false;
    }
    const meta = metaOf(entry.charId) || {};
    const weapons = meta.weapons || [];
    if(memberRosterFilters.element
      && !weapons.some(slot => slot.element === memberRosterFilters.element)) return false;
    if(memberRosterFilters.weapon
      && !weapons.some(slot => slot.weapon === memberRosterFilters.weapon)) return false;
    if(memberRosterFilters.role
      && !weapons.some(slot => slot.role === memberRosterFilters.role)) return false;
    if(memberRosterFilters.rarity && meta.rarity !== memberRosterFilters.rarity) return false;
    return true;
  }

  function memberRosterCard(entry, editable, openDetail){
    const character = charOf(entry.charId);
    const buildTypes = new Set(Object.keys(entry.builds || {}));
    const favoriteType = favoriteRosterWeaponType(entry);
    const firstType = favoriteType || [...buildTypes][0];
    const hero = firstType
      ? rosterHeroSnapshot(entry, firstType)
      : normalizeHero({char:entry.charId, potentiel:{tier:entry.potentialTier}});
    const summary = el("div",{class:"member-roster-summary"},[
      el("h2",{class:"member-roster-name",text:character.name}),
      el("span",{class:"member-roster-potential",text:"P"+entry.potentialTier})
    ]);
    const badges = badgesRow(character, hero, false);
    if(badges) summary.appendChild(badges);

    const card = el("article",{class:"member-roster-card"},[
      el("div",{class:"member-roster-card-head"},[
        el("div",{class:"member-roster-portrait"},[
          el("img",{src:character.file,alt:character.name,loading:"lazy"})
        ]),
        summary
      ])
    ]);
    const builds = el("div",{class:"member-roster-builds"});
    weaponTypesOf(entry.charId).forEach(type => {
      const isSaved = buildTypes.has(type);
      const isFavorite = isSaved && type === favoriteType;
      builds.appendChild(el("span",{
        class:"member-roster-build-tag"
          +(isSaved ? " saved" : "")
          +(isFavorite ? " favorite" : ""),
        text:rosterWeaponLabel(type)
          +(isFavorite ? " · ★ favori" : (isSaved ? " · configuré" : "")),
        "aria-label":rosterWeaponLabel(type)+" : "
          +(isFavorite ? "build favori" : (isSaved ? "build configuré" : "aucun build"))
      }));
    });
    card.appendChild(builds);
    if(editable){
      card.appendChild(el("div",{class:"member-roster-card-actions"},[
        el("button",{
          class:"btn member-roster-edit",
          type:"button",
          text:"Modifier",
          onclick:()=>openMemberRosterEditor(entry)
        }),
        el("button",{
          class:"btn btn-danger member-roster-delete",
          type:"button",
          text:"Retirer",
          onclick:()=>void deleteMemberRosterCharacter(entry)
        })
      ]));
    }
    /* Roster consulté : la fiche entière ouvre le détail, et le bouton donne
       le même accès au clavier. */
    if(openDetail){
      card.classList.add("clickable");
      card.addEventListener("click", openDetail);
      card.appendChild(el("button",{
        class:"btn member-roster-detail-btn",
        type:"button",
        text:"Voir les builds",
        onclick:event=>{ event.stopPropagation(); openDetail(); }
      }));
    }
    return card;
  }

  function renderMemberRosterCards(entries, editable){
    memberRosterEntries = (entries || []).map(normalizeRosterCharacter).filter(Boolean);
    memberRosterEditable = !!editable;
    memberRosterVisible = memberRosterEntries
      .filter(memberRosterMatches)
      .sort((a,b)=>{
        const left = charOf(a.charId);
        const right = charOf(b.charId);
        return left.name.localeCompare(right.name, "fr");
      });
    const filtered = memberRosterVisible;
    const count = $("#memberRosterCount");
    count.innerHTML = "<b>"+filtered.length+"</b> personnage"
      +(filtered.length > 1 ? "s" : "")
      +(filtered.length !== memberRosterEntries.length
        ? " sur "+memberRosterEntries.length
        : "");
    const grid = $("#memberRosterGrid");
    grid.innerHTML = "";
    if(!filtered.length){
      grid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:memberRosterEntries.length
          ? "Aucun personnage ne correspond aux filtres"
          : (editable ? "Ton roster est vide" : "Ce membre n’a encore aucun personnage")}),
        el("p",{text:editable && !memberRosterEntries.length
          ? "Ajoute ton premier personnage pour enregistrer son potentiel et ses équipements."
          : "Modifie les filtres pour afficher d’autres personnages."})
      ]));
      return;
    }
    filtered.forEach((entry, index) => grid.appendChild(memberRosterCard(
      entry,
      editable,
      editable ? null : ()=>openRosterDetail(index)
    )));
  }

  function openRosterDetail(index){
    if(!memberRosterVisible.length) return;
    openRosterDetailFor({
      entries:memberRosterVisible,
      index,
      memberName:rosterDetailOwnerLabel(),
      weaponTypes:null,
      weaponType:null,
      showNavigation:true,
      returnFocusKey:null
    });
  }

  async function renderMemberRoster(){
    const renderId = ++memberRosterRenderId;
    const grid = $("#memberRosterGrid");
    grid.innerHTML = "";
    if(!sessionCourante.user){
      grid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour consulter le roster."}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return;
    }
    grid.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Ouverture du registre…"})
    ]));
    let ownerId = memberRosterMode === "mine"
      ? sessionCourante.user.id
      : memberRosterOwnerId;
    try{
      const profiles = await refreshRosterProfiles();
      if(memberRosterMode === "others" && !ownerId){
        const other = profiles.find(profile => profile.id !== sessionCourante.user.id);
        ownerId = other ? other.id : "";
        memberRosterOwnerId = ownerId;
      }
      const entries = ownerId ? await MemberRosterStore.refresh(ownerId) : [];
      if(renderId !== memberRosterRenderId) return;
      renderMemberRosterControls(profiles, ownerId);
      renderMemberRosterCards(entries, ownerId === sessionCourante.user.id);
    }catch(error){
      if(renderId !== memberRosterRenderId) return;
      renderMemberRosterControls(sessionCourante.rosterProfiles, ownerId);
      renderMemberRosterCards(MemberRosterStore.all(ownerId), ownerId === sessionCourante.user.id);
      toast("Roster indisponible, affichage du cache local.", true);
    }
  }

  function setMemberRosterBuildValue(kind, slot, value){
    const type = memberRosterWeaponType;
    const build = memberRosterDraft.builds[type]
      || (memberRosterDraft.builds[type] = emptyRosterBuild());
    if(kind === "weapon") memberRosterDraft.builds[type] = applyWeaponChange(build, value);
    if(kind === "armor" || kind === "jewel"){
      applyGearChange(build, kind, slot, value);
    }
    renderMemberRosterEditor();
  }

  function pickMemberRosterWeapon(){
    const charId = memberRosterDraft.charId;
    const build = memberRosterDraft.builds[memberRosterWeaponType] || emptyRosterBuild();
    const items = Object.values(compatibleWeaponGroups(charId)).flat()
      .filter(item => weaponFolderOf(item.file) === memberRosterWeaponType)
      .map(item => ({value:item.file,name:item.name,file:item.file}));
    Picker.open({
      title:"Arme — "+memberRosterWeaponType,
      value:build.weapon,
      items,
      emptyHint:"Aucune arme compatible disponible.",
      onSelect:value=>{
        if(value !== build.weapon && build.weaponConfig !== null
          && !confirm(
            "Changer d’arme effacera sa configuration chiffrée. Continuer ?"
          )){
          return;
        }
        setMemberRosterBuildValue("weapon", null, value);
      }
    });
  }

  function currentMemberRosterBuild(){
    const type = memberRosterWeaponType;
    return memberRosterDraft.builds[type]
      || (memberRosterDraft.builds[type] = emptyRosterBuild());
  }

  function applyMemberRosterArmorSet(set){
    const build = currentMemberRosterBuild();
    ARMOR_SET_SLOTS.forEach(slot => {
      applyGearChange(build, "armor", slot, set.pieces[slot]);
    });
    renderMemberRosterEditor();
    toast("Set « "+set.name+" » équipé.");
  }

  function applyMemberRosterJewelSet(set){
    const build = currentMemberRosterBuild();
    JEWEL_SLOTS.forEach(slot => {
      applyGearChange(build, "jewel", slot, set.pieces[slot]);
    });
    renderMemberRosterEditor();
    toast("Bijoux « "+set.name+" » équipés.");
  }

  function pickMemberRosterArmor(slot){
    const charId = memberRosterDraft.charId;
    const build = memberRosterDraft.builds[memberRosterWeaponType] || emptyRosterBuild();
    const allowed = slot === LINKED_ARMOR_SLOT ? new Set(linkedArmorsOf(charId)) : null;
    const items = (DATA.armures[slot] || [])
      .filter(item => !allowed || allowed.has(item.file))
      .map(item => ({value:item.file,name:item.name,file:item.file}));
    Picker.open({
      title:"Armure — "+ARMOR_LABELS[slot],
      value:build.armor[slot],
      items,
      emptyHint:slot === LINKED_ARMOR_SLOT
        ? "Aucune armure liée compatible disponible."
        : "Aucune armure disponible.",
      onSelect:value=>setMemberRosterBuildValue("armor", slot, value)
    });
  }

  function pickMemberRosterJewel(slot){
    const build = memberRosterDraft.builds[memberRosterWeaponType] || emptyRosterBuild();
    Picker.open({
      title:"Bijou — "+slot,
      value:build.jewel[slot],
      items:(DATA.bijoux[slot] || [])
        .map(item => ({value:item.file,name:item.name,file:item.file})),
      emptyHint:"Aucun bijou disponible.",
      onSelect:value=>setMemberRosterBuildValue("jewel", slot, value)
    });
  }

  function renderMemberRosterEditor(){
    if(!memberRosterDraft) return;
    const character = charOf(memberRosterDraft.charId);
    const types = weaponTypesOf(memberRosterDraft.charId);
    if(!types.includes(memberRosterWeaponType)) memberRosterWeaponType = types[0] || "";
    const hasBuild = Object.prototype.hasOwnProperty.call(
      memberRosterDraft.builds,
      memberRosterWeaponType
    );
    const build = hasBuild
      ? memberRosterDraft.builds[memberRosterWeaponType]
      : emptyRosterBuild();
    const favoriteType = favoriteRosterWeaponType(memberRosterDraft);
    $("#memberRosterTitle").textContent = character.name+" — roster";
    const editor = $("#memberRosterEditor");
    editor.innerHTML = "";
    editor.appendChild(el("div",{class:"member-roster-editor-hero"},[
      el("div",{class:"member-roster-portrait"},[
        el("img",{src:character.file,alt:character.name})
      ]),
      el("div",{},[
        el("span",{class:"member-roster-field-label",text:"Personnage"}),
        el("h2",{text:character.name})
      ])
    ]));

    const potentialList = el("div",{class:"member-roster-potential-list"});
    for(let tier = 0; tier <= POT_MAX; tier++){
      potentialList.appendChild(el("button",{
        class:"chip"+(memberRosterDraft.potentialTier === tier ? " active" : ""),
        type:"button",
        text:"P"+tier,
        "aria-pressed":String(memberRosterDraft.potentialTier === tier),
        onclick:()=>{
          memberRosterDraft.potentialTier = tier;
          renderMemberRosterEditor();
        }
      }));
    }
    editor.appendChild(el("div",{class:"member-roster-editor-section"},[
      el("span",{class:"member-roster-field-label",text:"Potentiel commun"}),
      potentialList
    ]));

    const tabs = el("div",{class:"member-roster-weapon-tabs"});
    types.forEach(type => tabs.appendChild(el("button",{
      class:"chip"+(memberRosterWeaponType === type ? " active" : ""),
      type:"button",
      text:rosterWeaponLabel(type)
        +(Object.prototype.hasOwnProperty.call(memberRosterDraft.builds, type) ? " ✓" : "")
        +(memberRosterDraft.builds[type] && memberRosterDraft.builds[type].favorite ? " ★" : ""),
      "aria-pressed":String(memberRosterWeaponType === type),
      onclick:()=>{
        memberRosterWeaponType = type;
        renderMemberRosterEditor();
      }
    })));
    editor.appendChild(el("div",{class:"member-roster-editor-section"},[
      el("span",{class:"member-roster-field-label",text:"Configuration par type d’arme"}),
      tabs
    ]));

    const gear = el("div",{class:"gear"});
    gear.appendChild(gearSlot("Arme", build.weapon, true, pickMemberRosterWeapon));
    const configControl = weaponConfigControl({
      weaponFile:build.weapon,
      config:build.weaponConfig,
      sourceUpdatedAt:memberRosterDraftSourceUpdatedAt,
      parentIsDirty(){
        return !!memberRosterDraft
          && JSON.stringify(memberRosterDraft) !== memberRosterDraftInitialJson;
      },
      sourceWasDeleted(){
        if(!sessionCourante.user || !memberRosterDraft
          || memberRosterDraftSourceUpdatedAt <= 0) return false;
        return !MemberRosterStore.all(sessionCourante.user.id)
          .some(row => row.charId === memberRosterDraft.charId);
      },
      defaultGradeGameId:weaponDefaultGradeGameId(build.weapon),
      commit(nextConfig){
        currentMemberRosterBuild().weaponConfig = nextConfig;
        renderMemberRosterEditor();
        const nextButton = $("#memberRosterEditor")
          .querySelector(".weapon-config-open");
        if(nextButton){
          ModalStack.setRestoreFocus($("#weaponConfigOverlay"), nextButton);
        }
      },
      latestUpdatedAt(){
        if(!sessionCourante.user || !memberRosterDraft) return 0;
        const latest = MemberRosterStore.all(sessionCourante.user.id)
          .find(row => row.charId === memberRosterDraft.charId);
        return latest ? latest.updatedAt : memberRosterDraftSourceUpdatedAt;
      },
      reload(){ return reloadCurrentRosterDraft(); }
    });
    if(configControl) gear.appendChild(configControl);
    gear.appendChild(el("div",{class:"gear-group",text:"Armures"}));
    gear.appendChild(equipmentSetButton("armor", applyMemberRosterArmorSet));
    ARMOR_SLOTS.forEach(slot => gear.appendChild(gearConfigurableSlot(
      ARMOR_LABELS[slot],
      build.armor[slot],
      ()=>pickMemberRosterArmor(slot),
      "",
      slot,
      {
        config:build.armorConfig && build.armorConfig[slot],
        commit(nextConfig){
          const target = currentMemberRosterBuild();
          if(!target.armorConfig) target.armorConfig = {};
          if(nextConfig === null) delete target.armorConfig[slot];
          else target.armorConfig[slot] = nextConfig;
          renderMemberRosterEditor();
          const nextButton = findGearConfigButton($("#memberRosterEditor"), slot);
          if(nextButton){
            ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
          }
        }
      }
    )));
    gear.appendChild(el("div",{class:"gear-group",text:"Bijoux"}));
    gear.appendChild(equipmentSetButton("jewel", applyMemberRosterJewelSet));
    JEWEL_SLOTS.forEach(slot => gear.appendChild(gearConfigurableSlot(
      JEWEL_LABELS[slot],
      build.jewel[slot],
      ()=>pickMemberRosterJewel(slot),
      "jewel",
      slot,
      {
        config:build.jewelConfig && build.jewelConfig[slot],
        commit(nextConfig){
          const target = currentMemberRosterBuild();
          if(!target.jewelConfig) target.jewelConfig = {};
          if(nextConfig === null) delete target.jewelConfig[slot];
          else target.jewelConfig[slot] = nextConfig;
          renderMemberRosterEditor();
          const nextButton = findGearConfigButton($("#memberRosterEditor"), slot);
          if(nextButton){
            ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
          }
        }
      }
    )));
    const noteColumn = el("div",{class:"member-roster-note-column"});
    if(!hasBuild){
      noteColumn.appendChild(el("p",{
        class:"member-roster-build-empty",
        text:"Cette configuration n’est pas encore enregistrée. Choisis un équipement ou saisis une note pour la créer."
      }));
    }
    const note = el("textarea",{
      class:"note member-roster-note",
      placeholder:"Rôle, rotation ou consigne pour ce type d’arme…",
      maxlength:"160"
    });
    note.value = build.note || "";
    note.addEventListener("input", event => {
      const saved = memberRosterDraft.builds[memberRosterWeaponType]
        || (memberRosterDraft.builds[memberRosterWeaponType] = emptyRosterBuild());
      saved.note = event.target.value;
    });
    noteColumn.appendChild(el("span",{class:"member-roster-field-label",text:"Note du build"}));
    noteColumn.appendChild(note);
    if(hasBuild){
      noteColumn.appendChild(el("button",{
        class:"btn member-roster-favorite",
        type:"button",
        "aria-pressed":String(build.favorite),
        text:build.favorite ? "★ Build favori" : "☆ Définir comme favori",
        onclick:()=>{
          memberRosterDraft = setFavoriteRosterBuild(
            memberRosterDraft,
            memberRosterWeaponType
          );
          renderMemberRosterEditor();
        }
      }));
    }
    if(favoriteType && favoriteType !== memberRosterWeaponType){
      noteColumn.appendChild(el("button",{
        class:"btn member-roster-copy-favorite",
        type:"button",
        text:"Copier le favori ici",
        onclick:()=>{
          if(hasBuild && !confirm(
            "Remplacer les armures, bijoux et la note de ce build ? "+
            "Son arme sera conservée."
          )) return;
          const copied = copyFavoriteRosterBuild(
            memberRosterDraft,
            memberRosterWeaponType
          );
          if(copied) memberRosterDraft = copied;
          renderMemberRosterEditor();
        }
      }));
    }
    if(hasBuild){
      noteColumn.appendChild(el("button",{
        class:"btn btn-danger",
        type:"button",
        text:"Retirer cette configuration",
        onclick:()=>{
          delete memberRosterDraft.builds[memberRosterWeaponType];
          renderMemberRosterEditor();
        }
      }));
    }
    editor.appendChild(el("div",{class:"member-roster-build-panel"},[
      gear,
      noteColumn
    ]));
    editor.appendChild(heroStatsSection(
      rosterHeroSnapshot(memberRosterDraft, memberRosterWeaponType)
    ));
    editor.appendChild(el("div",{class:"member-roster-editor-actions"},[
      el("button",{
        class:"btn",
        type:"button",
        text:"Annuler",
        onclick:closeMemberRosterEditor
      }),
      el("button",{
        class:"btn btn-primary",
        id:"memberRosterSave",
        type:"button",
        text:"Enregistrer le personnage",
        onclick:()=>void saveMemberRosterEditor()
      })
    ]));
  }

  function openMemberRosterEditor(entry, restoreFocus){
    const normalized = normalizeRosterCharacter(entry);
    if(!normalized) return;
    memberRosterDraft = JSON.parse(JSON.stringify(normalized));
    memberRosterDraftSourceUpdatedAt = normalized.updatedAt;
    memberRosterDraftInitialJson = JSON.stringify(memberRosterDraft);
    memberRosterWeaponType = favoriteRosterWeaponType(normalized)
      || weaponTypesOf(normalized.charId)[0]
      || "";
    renderMemberRosterEditor();
    ModalStack.open(
      $("#memberRosterOverlay"),
      "#memberRosterClose",
      closeMemberRosterEditor,
      restoreFocus
    );
  }

  function closeMemberRosterEditor(){
    ModalStack.close($("#memberRosterOverlay"));
    memberRosterDraft = null;
    memberRosterDraftSourceUpdatedAt = 0;
    memberRosterDraftInitialJson = "";
  }

  function closeDeletedMemberRosterDraft(){
    closeWeaponConfigEditor();
    closeMemberRosterEditor();
    void renderMemberRoster();
    toast("Ce personnage a été supprimé du roster.", true);
  }

  async function reloadCurrentRosterDraft(){
    if(!sessionCourante.user || !memberRosterDraft) return false;
    const charId = memberRosterDraft.charId;
    try{
      const rows = await MemberRosterStore.refresh(sessionCourante.user.id);
      const latest = rows.find(row => row.charId === charId);
      if(!latest){
        closeDeletedMemberRosterDraft();
        return true;
      }
      memberRosterDraft = JSON.parse(JSON.stringify(
        normalizeRosterCharacter(latest)
      ));
      memberRosterDraftSourceUpdatedAt = memberRosterDraft.updatedAt;
      memberRosterDraftInitialJson = JSON.stringify(memberRosterDraft);
      renderMemberRosterEditor();
      return true;
    }catch(error){
      toast("Impossible de recharger la version récente du roster.", true);
      return false;
    }
  }

  async function saveMemberRosterEditor(){
    if(!memberRosterDraft) return;
    const button = $("#memberRosterSave");
    button.disabled = true;
    try{
      const latest = sessionCourante.user && MemberRosterStore.all(sessionCourante.user.id)
        .find(row => row.charId === memberRosterDraft.charId);
      if(memberRosterDraftSourceUpdatedAt > 0 && !latest){
        closeDeletedMemberRosterDraft();
        return;
      }
      const latestUpdatedAt = Number(latest && latest.updatedAt) || 0;
      if(latestUpdatedAt > memberRosterDraftSourceUpdatedAt && !confirm(
        "Une version plus récente existe. Enregistrer quand même ?"
      )){
        button.disabled = false;
        button.focus();
        return;
      }
      const saved = await MemberRosterStore.upsert(memberRosterDraft);
      memberRosterDraftSourceUpdatedAt = saved.updatedAt;
      closeMemberRosterEditor();
      await renderMemberRoster();
      toast("Personnage enregistré dans ton roster.");
    }catch(error){
      button.disabled = false;
      toast("Roster non enregistré : "+authMessage(error), true);
    }
  }

  async function deleteMemberRosterCharacter(entry){
    if(!sessionCourante.user || sessionCourante.user.id !== entry.owner) return;
    const character = charOf(entry.charId);
    if(!confirm("Retirer "+character.name+" de ton roster ?")) return;
    try{
      await MemberRosterStore.remove(entry.charId);
      await renderMemberRoster();
      toast(character.name+" a été retiré du roster.");
    }catch(error){
      toast("Suppression impossible : "+authMessage(error), true);
    }
  }

  $("#memberRosterMine").addEventListener("click", ()=>{
    memberRosterMode = "mine";
    void renderMemberRoster();
  });
  $("#memberRosterOthers").addEventListener("click", ()=>{
    memberRosterMode = "others";
    memberRosterOwnerId = "";
    void renderMemberRoster();
  });
  $("#memberRosterOwner").addEventListener("change", event => {
    memberRosterOwnerId = event.target.value;
    void renderMemberRoster();
  });
  $("#memberRosterSearch").addEventListener("input", event => {
    memberRosterFilters.query = event.target.value;
    renderMemberRosterCards(memberRosterEntries, memberRosterEditable);
  });
  $("#memberRosterAdd").addEventListener("click", ()=>{
    if(!sessionCourante.user){
      openAuth("Connecte-toi pour modifier ton roster.", true);
      return;
    }
    const existing = new Set(
      MemberRosterStore.all(sessionCourante.user.id).map(entry => entry.charId)
    );
    Picker.open({
      title:"Ajouter un personnage",
      portrait:true,
      allowNone:false,
      items:(DATA.personnages || [])
        .filter(character => !existing.has(character.id))
        .map(character => ({
          value:character.id,
          name:character.name,
          file:character.file
        })),
      emptyHint:"Tous les personnages sont déjà dans ton roster.",
      onSelect:charId=>openMemberRosterEditor({
          owner:sessionCourante.user.id,
          charId,
          potentialTier:0,
          builds:{},
          updatedAt:0
        }, $("#memberRosterAdd"))
    });
  });
  $("#memberRosterClose").addEventListener("click", closeMemberRosterEditor);
  $("#memberRosterOverlay").addEventListener("click", event => {
    if(event.target === $("#memberRosterOverlay")) closeMemberRosterEditor();
  });

  /* ============================ Builder ============================ */
  const heroGrid = $("#heroGrid");
  const pseudoInput = $("#pseudo");
  const teamNameInput = $("#teamName");

  pseudoInput.addEventListener("input", e => brouillonEquipe.equipe.pseudo = e.target.value);
  teamNameInput.addEventListener("input", e => brouillonEquipe.equipe.name = e.target.value);

  function renderBuilder(){
    if(sessionCourante.user && sessionCourante.pseudo) brouillonEquipe.equipe.pseudo = sessionCourante.pseudo;
    teamNameInput.value = brouillonEquipe.equipe.name || "";
    pseudoInput.value = brouillonEquipe.equipe.pseudo || "";
    pseudoInput.disabled = !!sessionCourante.user;
    $("#editFlag").classList.toggle("on", brouillonEquipe.edition);
    $("#btnSave").textContent = brouillonEquipe.edition ? "Mettre à jour l'équipe" : "Enregistrer l'équipe";
    heroGrid.innerHTML = "";
    brouillonEquipe.equipe.heroes.forEach((hero, i) => heroGrid.appendChild(heroCard(hero, i)));
  }
  function switchBuilderHeroBuild(heroIndex, weaponType){
    const hero = brouillonEquipe.equipe.heroes[heroIndex];
    if(!hero || hero.activeWeaponType === weaponType) return;
    brouillonEquipe.equipe.heroes[heroIndex] = activateHeroBuild(hero, weaponType);
    renderBuilder();
    const card = heroGrid.children[heroIndex];
    const active = card && [...card.querySelectorAll(
      ".builder-weapon-switch"
    )].find(button => button.dataset.weaponType === weaponType);
    if(active) active.focus();
  }
  function rosterNetworkAvailable(){
    return !!sessionCourante.user && !!sb
      && (typeof navigator === "undefined"
        || navigator.onLine !== false);
  }
  function focusBuilderWeaponSwitch(heroIndex, weaponType){
    const card = heroGrid.children[heroIndex];
    const button = card && [...card.querySelectorAll(
      ".builder-weapon-switch"
    )].find(item => item.dataset.weaponType === weaponType);
    if(button) button.focus();
  }
  async function updateBuilderHeroRoster(heroIndex){
    if(!rosterNetworkAvailable()){
      toast("Connexion requise pour mettre à jour le roster.", true);
      return;
    }
    const hero = brouillonEquipe.equipe.heroes[heroIndex];
    if(!hero || !hero.char){
      toast("Choisis d’abord un personnage.", true);
      return;
    }
    storeActiveHeroBuild(hero);
    const type = hero.activeWeaponType || weaponFolderOf(hero.weapon);
    if(!type){
      toast("Choisis d’abord un type d’arme.", true);
      return;
    }
    let rows;
    try{
      rows = await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      toast("Impossible de vérifier ton roster.", true);
      return;
    }
    const latest = rows.find(entry => entry.charId === hero.char);
    const baseline = brouillonEquipe.referencesRoster[heroIndex]
      || {
        ownerId:"",
        charId:"",
        updatedAt:0,
        updatedAtToken:"",
        builds:{}
      };
    const latestUpdatedAtToken = latest && latest.updatedAtToken || "";
    const remotelyChanged = !rosterBaselineIdentityMatches(
      baseline,
      sessionCourante.user.id,
      hero.char
    )
      || !rosterBaselineVersionMatches(baseline, latest);
    if(remotelyChanged && !confirm(
      "Ton roster a été modifié depuis son chargement. "
      +"Écraser uniquement le build "+rosterWeaponLabel(type)+" ?"
    )){
      toast("Le roster a été modifié ailleurs. Mise à jour annulée.", true);
      return;
    }
    const next = rosterEntryWithActiveHeroBuild(
      latest,
      hero,
      sessionCourante.user.id
    );
    try{
      const saved = await MemberRosterStore.updateBuild(
        next,
        type,
        latestUpdatedAtToken
      );
      brouillonEquipe.referencesRoster[heroIndex] = {
        ownerId:sessionCourante.user.id,
        charId:hero.char,
        updatedAt:Number(saved.updatedAt) || 0,
        updatedAtToken:saved.updatedAtToken || "",
        builds:jsonCopy(saved.builds)
      };
      renderBuilder();
      focusBuilderWeaponSwitch(heroIndex, type);
      toast("Build "+rosterWeaponLabel(type)+" mis à jour dans ton roster.");
    }catch(error){
      if(String(error && error.message || error).includes("ROSTER_CONFLICT")){
        toast(
          "Ton roster a été modifié ailleurs. Recharge-le puis réessaie.",
          true
        );
        return;
      }
      toast("Roster non enregistré : "+authMessage(error), true);
    }
  }
  async function reloadBuilderHeroFromRoster(heroIndex){
    if(!rosterNetworkAvailable()){
      toast("Connexion requise pour recharger le roster.", true);
      return;
    }
    const hero = brouillonEquipe.equipe.heroes[heroIndex];
    if(!hero || !hero.char) return;
    const dirty = weaponTypesOf(hero.char)
      .some(type => builderBuildIsDirty(heroIndex, type));
    if(dirty && !confirm(
      "Remplacer les trois brouillons de ce héros par ton roster ?"
    )){
      return;
    }
    let rows;
    try{
      rows = await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      toast("Impossible de recharger ton roster.", true);
      return;
    }
    const latest = rows.find(entry => entry.charId === hero.char);
    if(!latest){
      toast("Ce personnage n’existe plus dans ton roster.", true);
      return;
    }
    const currentType = weaponFolderOf(hero.weapon)
      || hero.activeWeaponType;
    const nextType = Object.prototype.hasOwnProperty.call(
      latest.builds,
      currentType
    )
      ? currentType
      : favoriteRosterWeaponType(latest)
        || Object.keys(latest.builds)[0];
    if(!nextType){
      toast("Ce personnage n’a aucun build dans ton roster.", true);
      return;
    }
    const snapshot = rosterHeroSnapshot(latest, nextType);
    if(!snapshot) return;
    brouillonEquipe.equipe.heroes[heroIndex] = snapshot;
    brouillonEquipe.referencesRoster[heroIndex] = {
      ownerId:sessionCourante.user.id,
      charId:hero.char,
      updatedAt:Number(latest.updatedAt) || 0,
      updatedAtToken:latest.updatedAtToken || "",
      builds:jsonCopy(latest.builds)
    };
    renderBuilder();
    focusBuilderWeaponSwitch(heroIndex, nextType);
    toast("Les trois builds ont été rechargés depuis ton roster.");
  }
  if(window.addEventListener){
    ["online","offline"].forEach(eventName => {
      window.addEventListener(eventName, () => {
        if($("#view-builder").classList.contains("active")){
          renderBuilder();
        }
      });
    });
  }

  function heroCard(hero, i){
    const ch = charOf(hero.char);
    const sourceActions = el("div",{class:"hero-source-actions"});
    if(sessionCourante.user){
      sourceActions.appendChild(el("button",{
        class:"btn btn-primary",
        type:"button",
        text:"Depuis mon roster",
        onclick:()=>void pickRosterHero(i)
      }));
    }
    sourceActions.appendChild(el("button",{
      class:"btn",
      type:"button",
      text:"Choisir manuellement",
      onclick:()=>pickChar(i)
    }));
    const currentWeaponType = weaponFolderOf(hero.weapon)
      || hero.activeWeaponType;
    const rosterEntry = sessionCourante.user && hero.char
      ? MemberRosterStore.all(sessionCourante.user.id)
        .find(entry => entry.charId === hero.char)
      : null;
    if(hero.char){
      const updateProps = {
        class:"btn hero-roster-update",
        type:"button",
        text:"Mettre à jour mon roster",
        onclick:()=>void updateBuilderHeroRoster(i)
      };
      if(!rosterNetworkAvailable()){
        updateProps.disabled = "disabled";
        updateProps.title = "Connexion requise pour mettre à jour le roster";
      }
      sourceActions.appendChild(el("button",updateProps));
    }
    if(rosterEntry && currentWeaponType){
      const reloadProps = {
        class:"btn hero-roster-reload",
        type:"button",
        text:"Recharger depuis mon roster",
        onclick:()=>void reloadBuilderHeroFromRoster(i)
      };
      if(!rosterNetworkAvailable()){
        reloadProps.disabled = "disabled";
        reloadProps.title = "Connexion requise pour recharger le roster";
      }
      sourceActions.appendChild(el("button",reloadProps));
    }

    // Portrait
    const portrait = el("button",{class:"portrait", type:"button", title:"Choisir un héros",
      onclick:()=>pickChar(i)});
    if(ch){ portrait.appendChild(el("img",{src:ch.file, alt:ch.name})); }
    else{ portrait.appendChild(el("div",{class:"ph",html:'<span class="plus">+</span><span>Héros</span>'})); }

    const title = el("div",{class:"hero-title"+(ch?"":" empty"), text: ch ? ch.name : "Emplacement libre"});
    const badges = builderWeaponSwitcher(hero, i, ch);

    // Gear : arme + 5 armures + 3 bijoux
    const gear = el("div",{class:"gear"});
    gear.appendChild(gearSlot("Arme", hero.weapon, true, ()=>pickWeapon(i)));
    const configControl = weaponConfigControl({
      weaponFile:hero.weapon,
      config:hero.weaponConfig,
      sourceUpdatedAt:brouillonEquipe.sourceMaj,
      parentIsDirty(){
        return JSON.stringify(brouillonEquipe.equipe) !== brouillonEquipe.jsonInitial;
      },
      sourceWasDeleted(){
        if(brouillonEquipe.sourceMaj <= 0) return false;
        return !Store.all().some(row => row.id === brouillonEquipe.equipe.id);
      },
      defaultGradeGameId:weaponDefaultGradeGameId(hero.weapon),
      commit(nextConfig){
        hero.weaponConfig = nextConfig;
        renderBuilder();
        const nextButton = heroGrid.children[i]
          && heroGrid.children[i].querySelector(".weapon-config-open");
        if(nextButton){
          ModalStack.setRestoreFocus($("#weaponConfigOverlay"), nextButton);
        }
      },
      latestUpdatedAt(){
        const latest = Store.all().find(row => row.id === brouillonEquipe.equipe.id);
        return latest ? latest.updatedAt : brouillonEquipe.sourceMaj;
      },
      reload(){
        const latest = Store.all().find(row => row.id === brouillonEquipe.equipe.id);
        if(!latest){
          if(brouillonEquipe.sourceMaj > 0){
            closeDeletedTeamDraft();
          }
          return true;
        }
        brouillonEquipe.equipe = normalizeTeam(JSON.parse(JSON.stringify(latest)));
        brouillonEquipe.sourceMaj = brouillonEquipe.equipe.updatedAt;
        brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
        renderBuilder();
      }
    });
    if(configControl) gear.appendChild(configControl);
    gear.appendChild(el("div",{class:"gear-group", text:"Armures"}));
    gear.appendChild(equipmentSetButton("armor", set => {
      ARMOR_SET_SLOTS.forEach(slot => {
        applyGearChange(hero, "armor", slot, set.pieces[slot]);
      });
      renderBuilder();
      toast("Set « "+set.name+" » équipé.");
    }));
    ARMOR_SLOTS.forEach(slot=>{
      gear.appendChild(gearConfigurableSlot(
        ARMOR_LABELS[slot],
        hero.armor[slot],
        ()=>pickArmor(i, slot),
        "",
        slot,
        {
          config:hero.armorConfig && hero.armorConfig[slot],
          commit(nextConfig){
            if(!hero.armorConfig) hero.armorConfig = {};
            if(nextConfig === null) delete hero.armorConfig[slot];
            else hero.armorConfig[slot] = nextConfig;
            renderBuilder();
            const nextHero = heroGrid.children[i];
            const nextButton = nextHero
              ? findGearConfigButton(nextHero, slot) : null;
            if(nextButton){
              ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
            }
          }
        }
      ));
    });
    gear.appendChild(el("div",{class:"gear-group", text:"Bijoux"}));
    gear.appendChild(equipmentSetButton("jewel", set => {
      JEWEL_SLOTS.forEach(slot => {
        applyGearChange(hero, "jewel", slot, set.pieces[slot]);
      });
      renderBuilder();
      toast("Bijoux « "+set.name+" » équipés.");
    }));
    JEWEL_SLOTS.forEach(slot=>{
      gear.appendChild(gearConfigurableSlot(
        JEWEL_LABELS[slot],
        hero.jewel[slot],
        ()=>pickJewel(i, slot),
        "jewel",
        slot,
        {
          config:hero.jewelConfig && hero.jewelConfig[slot],
          commit(nextConfig){
            if(!hero.jewelConfig) hero.jewelConfig = {};
            if(nextConfig === null) delete hero.jewelConfig[slot];
            else hero.jewelConfig[slot] = nextConfig;
            renderBuilder();
            const nextHero = heroGrid.children[i];
            const nextButton = nextHero
              ? findGearConfigButton(nextHero, slot) : null;
            if(nextButton){
              ModalStack.setRestoreFocus($("#gearConfigOverlay"), nextButton);
            }
          }
        }
      ));
    });

    // Potentiel
    const pot = potentielControl(hero, i, ch);

    // Note
    const note = el("textarea",{class:"note", placeholder:"Rôle / notes (ex. tank, burst P2)…",
      maxlength:"160"});
    note.value = hero.note || "";
    note.addEventListener("input", e => hero.note = e.target.value);

    const clear = el("button",{class:"clear", type:"button", text:"Vider ce héros",
      onclick:()=>{ brouillonEquipe.equipe.heroes[i] = emptyHero(); renderBuilder(); }});

    const content = [
      sourceActions, portrait, title, badges, gear, pot, note
    ];
    if(ch) content.push(heroStatsSection(hero));
    content.push(clear);
    return el("div",{class:"hero"},content);
  }

  // Petit bloc "Potentiel" sur la carte héros -> ouvre la fenêtre de potentiel
  function potentielControl(hero, i, ch){
    const p = hero.potentiel = normalizePotentiel(hero.potentiel);
    const types = ch ? weaponTypesOf(ch.id) : [];
    const disabled = !ch || !types.length;
    const tierTxt = p.tier > 0 ? ("P" + p.tier) : "—";

    const btn = el("button",{
      class:"pot-btn"+(p.tier>0?" set":"")+(disabled?" disabled":""),
      type:"button",
      title: disabled ? "Choisis d'abord un héros" : "Éditer le potentiel",
      onclick: ()=>{ if(!disabled) openPotentiel(i); }
    },[
      el("span",{class:"pot-star", text:"✦"}),
      el("span",{class:"pot-lbl", text:"Potentiel"}),
      el("span",{class:"pot-val", text:disabled ? "—" : tierTxt})
    ]);
    return btn;
  }

  // Pickers spécialisés
  function pickChar(i){
    Picker.open({
      title:"Choisir un héros", portrait:true, value:brouillonEquipe.equipe.heroes[i].char,
      items:(DATA.personnages||[]).map(c=>({value:c.id, name:c.name, file:c.file})),
      onSelect:v=>{
        brouillonEquipe.equipe.heroes[i] = applyCharacterChange(
          brouillonEquipe.equipe.heroes[i],
          v
        );
        resetBuilderRosterBaseline(i);
        renderBuilder();
      }
    });
  }
  function pickWeapon(i){
    const hero = brouillonEquipe.equipe.heroes[i];
    if(!hero.char){
      toast("Choisis d'abord un héros.", true);
      return;
    }
    const compatible = compatibleWeaponGroups(hero.char);
    const activeType = hero.activeWeaponType;
    const groups = activeType
      ? Object.entries(compatible).reduce((result, [label, items]) => {
          const matching = items.filter(item =>
            weaponFolderOf(item.file) === activeType
          );
          if(matching.length) result[label] = matching;
          return result;
        }, {})
      : compatible;
    Picker.open({
      title:"Choisir une arme", value:hero.weapon,
      groups,
      emptyHint:"Aucune arme compatible disponible.",
      onSelect:v=>{
        if(hero.weaponConfig && hero.weapon !== v
          && !confirm("Changer d’arme réinitialisera sa configuration chiffrée. Continuer ?")){
          return;
        }
        brouillonEquipe.equipe.heroes[i] = applyWeaponChange(hero, v);
        renderBuilder();
      }
    });
  }
  function pickArmor(i, slot){
    const hero = brouillonEquipe.equipe.heroes[i];
    if(slot === LINKED_ARMOR_SLOT && !hero.char){
      toast("Choisis d'abord un héros.", true);
      return;
    }
    const allowed = slot === LINKED_ARMOR_SLOT
      ? new Set(linkedArmorsOf(hero.char))
      : null;
    const items = (DATA.armures[slot]||[])
      .filter(a => !allowed || allowed.has(a.file))
      .map(a => ({value:a.file, name:a.name, file:a.file}));
    Picker.open({
      title:"Armure — "+ARMOR_LABELS[slot],
      value:hero.armor[slot],
      items,
      emptyHint:slot === LINKED_ARMOR_SLOT
        ? "Aucune armure liée compatible disponible."
        : "Aucune armure disponible.",
      onSelect:v=>{
        applyGearChange(hero, "armor", slot, v);
        renderBuilder();
      }
    });
  }
  function pickJewel(i, slot){
    Picker.open({
      title:"Bijou — "+slot, value:brouillonEquipe.equipe.heroes[i].jewel[slot],
      items:(DATA.bijoux[slot]||[]).map(b=>({value:b.file, name:b.name, file:b.file})),
      emptyHint:"Aucun bijou pour l'instant. Ajoute des images dans 7ds-bijoux/"+slot+"/ puis relance generate-data.ps1.",
      onSelect:v=>{
        applyGearChange(brouillonEquipe.equipe.heroes[i], "jewel", slot, v);
        renderBuilder();
      }
    });
  }

  function masteryIconForWeaponType(type){
    const item = WEAPON_ENUM[FOLDER_TO_ENUM[type]];
    return item ? "7ds-ui/mastery/"+item.icon+".webp" : "";
  }

  async function pickRosterHero(slotIndex){
    if(!sessionCourante.user){
      openAuth("Connecte-toi pour utiliser ton roster.", true);
      return;
    }
    let entries;
    try{
      entries = await MemberRosterStore.refresh(sessionCourante.user.id);
    }catch(error){
      entries = MemberRosterStore.all(sessionCourante.user.id);
      if(!entries.length){
        toast("Ton roster est indisponible.", true);
        return;
      }
    }
    if(!entries.length){
      toast("Ton roster est vide. Ajoute d’abord un personnage.", true);
      return;
    }
    Picker.open({
      title:"Choisir dans mon roster",
      portrait:true,
      allowNone:false,
      items:entries.map(entry => {
        const character = charOf(entry.charId);
        return {
          value:entry.charId,
          name:character.name,
          file:character.file
        };
      }),
      onSelect:charId=>{
        const entry = entries.find(item => item.charId === charId);
        if(entry) pickRosterWeapon(slotIndex, entry);
      }
    });
  }

  function pickRosterWeapon(slotIndex, entry){
    const items = Object.keys(entry.builds).map(type => ({
      value:type,
      name:type+" · "+(entry.builds[type].weapon
        ? nameOfFile(entry.builds[type].weapon)
        : "équipement partiel"),
      file:entry.builds[type].weapon || masteryIconForWeaponType(type)
    }));
    if(!items.length){
      toast("Ce personnage n’a encore aucun équipement enregistré.", true);
      return;
    }
    Picker.open({
      title:"Choisir l’équipement",
      allowNone:false,
      items,
      onSelect:type=>loadRosterHero(slotIndex, entry, type)
    });
  }

  function loadRosterHero(slotIndex, entry, weaponType){
    const snapshot = rosterHeroSnapshot(entry, weaponType);
    if(!snapshot) return;
    brouillonEquipe.equipe.heroes[slotIndex] = snapshot;
    resetBuilderRosterBaselines();
    renderBuilder();
    toast("Équipement copié depuis ton roster.");
  }

  /* ---- Potentiel : rendu du balisage couleur [#RRGGBB]texte[-] ---- */

  /* ---- Fenêtre Potentiel (façon page de référence) ---- */
  const Potentiel = (function(){
    const overlay = $("#potOverlay"), body = $("#potBody"), titleEl = $("#potTitle");
    let heroIdx = -1;

    function open(i){
      heroIdx = i;
      const hero = brouillonEquipe.equipe.heroes[i], ch = charOf(hero.char);
      if(!ch) return;
      const types = weaponTypesOf(ch.id);
      if(!types.length) return;
      titleEl.textContent = "Potentiel — " + ch.name;
      render();
      ModalStack.open(overlay, "#potClose", close);
    }
    function close(){ ModalStack.close(overlay); }

    function render(){
      const hero = brouillonEquipe.equipe.heroes[heroIdx];
      const details = potentielDetailsOf(hero);
      const selTier = normalizePotentiel(hero.potentiel).tier;
      body.innerHTML = "";

      // Boutons de palier — P0 puis P1..P10
      const head = el("div",{class:"pot-head"},[
        el("span",{class:"pot-head-lbl", text:"Palier"}),
        el("span",{class:"pot-head-val", text:"P"+selTier+"/"+POT_MAX})
      ]);
      body.appendChild(head);

      const row = el("div",{class:"pot-paliers"});
      const setTier = tier => {
        hero.potentiel = normalizePotentiel({ tier });
        render();
        renderBuilder();
      };
      row.appendChild(el("button",{class:"pot-p"+(selTier===0?" active":""), text:"P0",
        title:"Aucun palier", onclick:()=>setTier(0)}));
      for(let t=1;t<=POT_MAX;t++){
        row.appendChild(el("button",{class:"pot-p"+(t<=selTier?" reached":"")+(t===selTier?" active":""),
          text:"P"+t, onclick:()=>setTier(t)}));
      }
      body.appendChild(row);

      if(details.list.length){
        body.appendChild(el("div",{class:"pot-list-title", text:"Bonus de l'arme équipée"}));
        const listBox = el("div",{class:"pot-list"});
        details.list.forEach((desc, idx)=>{
          const t = idx+1;
          const item = el("div",{class:"pot-item"+(t<=selTier?" on":"")});
          item.appendChild(el("span",{class:"pot-item-t", text:"P"+t}));
          item.appendChild(el("span",{class:"pot-item-d", html:renderBonus(desc)}));
          listBox.appendChild(item);
        });
        body.appendChild(listBox);
      }else{
        body.appendChild(el("div",{class:"pot-empty",
          text:"Équipe une arme compatible pour afficher les bonus de potentiel."}));
      }
    }

    $("#potClose").addEventListener("click", close);
    overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
    return { open };
  })();
  function openPotentiel(i){ Potentiel.open(i); }

  // Actions builder
  function resetTeamDraft(){
    brouillonEquipe.equipe = emptyDraft();
    brouillonEquipe.edition = false;
    brouillonEquipe.sourceMaj = 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    resetBuilderRosterBaselines();
    renderBuilder();
  }

  function closeDeletedTeamDraft(){
    closeWeaponConfigEditor();
    resetTeamDraft();
    brouillonEquipe.supprimeAilleurs = true;
    toast("Cette équipe a été supprimée dans un autre onglet.", true);
  }

  $("#btnNew").addEventListener("click", ()=>{
    resetTeamDraft();
    toast("Nouvelle équipe prête.");
  });

  $("#btnSave").addEventListener("click", async()=>{
    if(!sessionCourante.user || !sb){
      openAuth("Connecte-toi pour enregistrer cette équipe.", true);
      return;
    }
    if(brouillonEquipe.supprimeAilleurs){
      toast("Cette équipe a été supprimée dans un autre onglet.", true);
      return;
    }
    const pseudo = (sessionCourante.pseudo||brouillonEquipe.equipe.pseudo||"").trim();
    if(!pseudo){ toast("Ajoute d'abord un pseudo de membre.", true); pseudoInput.focus(); return; }
    if(!brouillonEquipe.equipe.heroes.some(h=>h.char)){ toast("Ajoute au moins un héros à l'équipe.", true); return; }

    const now = Date.now();
    const existing = Store.all().find(t=>t.id===brouillonEquipe.equipe.id);
    const team = normalizeTeam(JSON.parse(JSON.stringify(brouillonEquipe.equipe)));
    team.pseudo = pseudo;
    team.createdAt = existing ? existing.createdAt : now;
    team.updatedAt = now;
    const saveButton = $("#btnSave");
    saveButton.disabled = true;
    try{
      const latest = Store.all().find(row => row.id === team.id);
      if(brouillonEquipe.sourceMaj > 0 && !latest){
        closeDeletedTeamDraft();
        return;
      }
      const latestUpdatedAt = Number(latest && latest.updatedAt) || 0;
      if(brouillonEquipe.sourceMaj > 0
        && latestUpdatedAt > brouillonEquipe.sourceMaj
        && !confirm("Une version plus récente existe. Enregistrer quand même ?")){
        saveButton.disabled = false;
        saveButton.focus();
        return;
      }
      const saved = await Store.upsert(team);
      brouillonEquipe.sourceMaj = saved.updatedAt;
      toast(brouillonEquipe.edition ? "Équipe mise à jour." : "Équipe enregistrée !");
      resetTeamDraft();
      showView("roster");
    }catch(error){
      toast("Enregistrement impossible : "+authMessage(error), true);
    }finally{
      saveButton.disabled = false;
    }
  });

  /* ============================ Roster (page d'affichage) ============================ */
  const rosterGrid = $("#rosterGrid");
  let rosterRenderId = 0;

  async function renderRoster(){
    const renderId = ++rosterRenderId;
    rosterGrid.className = "";
    rosterGrid.innerHTML = "";
    rosterGrid.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Chargement des équipes…"})
    ]));
    let teams;
    try{
      teams = await Store.refresh();
    }catch(error){
      teams = Store.all();
      toast("Registre indisponible, affichage du cache local.", true);
    }
    if(renderId !== rosterRenderId) return;
    teams = teams.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const c = $("#rosterCount");
    c.innerHTML = "<b>"+teams.length+"</b> équipe"+(teams.length>1?"s":"")+" enregistrée"+(teams.length>1?"s":"");

    rosterGrid.className = teams.length ? "roster-grid" : "";
    rosterGrid.innerHTML = "";

    if(!teams.length){
      rosterGrid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Aucune équipe pour l'instant"}),
        el("p",{text:"Va dans « Créer une équipe » pour proposer ta première compo face au Boss de Guilde."})
      ]));
      return;
    }
    teams.forEach(t=>rosterGrid.appendChild(teamCard(t)));
  }

  function teamCard(t){
    /* Avec un nom, il devient la ligne principale et le pseudo passe dessous.
       Sans nom, on garde exactement l'apparence d'avant. */
    const who = el("div",{class:"team-who"});
    if(t.name){
      who.appendChild(el("span",{class:"team-name", text:t.name}));
      who.appendChild(el("span",{class:"team-pseudo", text:t.pseudo || "Sans pseudo"}));
    }else{
      who.appendChild(el("span",{class:"team-pseudo", text:t.pseudo || "Sans pseudo"}));
    }
    who.appendChild(el("span",{class:"team-date",
      text: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString("fr-FR") : ""}));
    const head = el("div",{class:"team-head"},[
      el("div",{class:"seal", text:initials(t.pseudo)}),
      who
    ]);

    const heroes = el("div",{class:"team-heroes clickable", title:"Voir l'équipement",
      onclick:()=>openTeamDetail(t)});
    (t.heroes||[]).forEach(h=>heroes.appendChild(miniHero(h)));

    const hint = el("button",{class:"team-detail-btn", type:"button",
      text:"Voir l'équipement ▾", onclick:()=>openTeamDetail(t)});

    /* « Dupliquer » est offert sur toute équipe : le registre est partagé, et la
       copie est un brouillon indépendant qu'il faudra enregistrer soi-même.
       Modifier et Supprimer restent réservés au propriétaire. */
    const actions = el("div",{class:"team-actions"},[
      el("button",{
        class:"btn",
        type:"button",
        dataset:{ teamAction:"duplicate" },
        text:"Dupliquer",
        onclick:()=>duplicateTeam(t)
      })
    ]);
    if(canManageTeam(t)){
      actions.appendChild(el("button",{
        class:"btn",
        type:"button",
        dataset:{ teamAction:"edit" },
        text:"Modifier",
        onclick:()=>editTeam(t)
      }));
      actions.appendChild(el("button",{
        class:"btn btn-danger",
        type:"button",
        dataset:{ teamAction:"delete" },
        text:"Supprimer",
        onclick:()=>void deleteTeam(t)
      }));
    }
    return el("div",{class:"team"},[head, heroes, hint, actions]);
  }

  function miniHero(h){
    const ch = h && h.char ? charOf(h.char) : null;

    const portrait = el("div",{class:"mini-portrait"});
    if(ch) portrait.appendChild(el("img",{src:ch.file, alt:ch.name, loading:"lazy"}));
    else portrait.textContent = "—";

    const name = el("div",{class:"mini-name"+(ch?"":" empty"), text: ch ? ch.name : "Libre"});
    const badges = badgesRow(ch, h, true);

    const kids = [portrait, name];
    if(badges) kids.push(badges);
    const p = h && h.potentiel;
    if(p && p.tier > 0){
      kids.push(el("div",{class:"mini-pot", title:"Potentiel",
        text:"✦ P"+p.tier}));
    }
    if(h && h.note && h.note.trim()){
      kids.push(el("div",{class:"mini-note", text:h.note.trim()}));
    }
    return el("div",{class:"mini"}, kids);
  }

  function gearIcon(file, variant){
    const d = el("div",{class:"icn"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file){ d.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')"; d.title = nameOfFile(file); }
    else d.title = variant==="weapon" ? "Pas d'arme" : "Vide";
    return d;
  }

  function editTeam(t){
    if(!canManageTeam(t)){
      toast("Cette équipe appartient à un autre membre.", true);
      return;
    }
    brouillonEquipe.equipe = normalizeTeam(JSON.parse(JSON.stringify(t)));
    brouillonEquipe.sourceMaj = Number(brouillonEquipe.equipe.updatedAt) || 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    brouillonEquipe.edition = true;
    resetBuilderRosterBaselines();
    renderBuilder();
    showView("builder");
    toast("Équipe chargée pour modification.");
  }

  /* Duplication : un brouillon indépendant, jamais une écriture immédiate.
     Nouvel identifiant, hors mode édition, et le pseudo devient le mien — la
     copie m'appartiendra dès que je l'enregistrerai. Rien ne part vers Supabase
     avant « Enregistrer ». */
  function duplicateTeam(t){
    const copy = normalizeTeam(JSON.parse(JSON.stringify(t)));
    copy.id = uid();
    copy.name = normalizeTeamName(
      (copy.name ? copy.name+" " : "Équipe ")+"(copie)"
    );
    copy.pseudo = sessionCourante.pseudo || copy.pseudo || "";
    delete copy.owner;
    delete copy.createdAt;
    delete copy.updatedAt;
    brouillonEquipe.equipe = copy;
    brouillonEquipe.sourceMaj = 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    brouillonEquipe.edition = false;
    resetBuilderRosterBaselines();
    renderBuilder();
    showView("builder");
    teamNameInput.focus();
    toast("Copie prête. Ajuste-la puis enregistre-la.");
  }

  async function deleteTeam(t){
    if(!canManageTeam(t)){
      toast("Cette équipe appartient à un autre membre.", true);
      return;
    }
    if(!confirm('Supprimer l\'équipe de « '+(t.pseudo||"?")+' » ?')) return;
    try{
      await Store.remove(t.id);
      await renderRoster();
      toast("Équipe supprimée.");
    }catch(error){
      toast("Suppression impossible : "+authMessage(error), true);
    }
  }

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

  const ELEM_ORDER = ["FIRE","ICE","WIND","EARTH","HOLY","DARK","THUNDER"];
  const elemLabel = e => e==="HOLY" ? "Lumière" : (ELEMENTS[e] ? ELEMENTS[e].label : (e||"—"));
  const elemColor = e => ELEMENTS[e] ? ELEMENTS[e].color : "#8a8a8a";
  const elemOf = charId => { const m = metaOf(charId); return m ? (m.element||"").toUpperCase() : null; };
  // éléments POSSIBLES d'un perso (il en a un par type d'arme équipable)
  function charElements(charId){
    const m = metaOf(charId); if(!m) return [];
    const set = [];
    (m.weapons||[]).forEach(w=>{ const e=(w.element||"").toUpperCase(); if(e && e!=="DEFAULT" && !set.includes(e)) set.push(e); });
    if(!set.length && m.element) set.push((m.element||"").toUpperCase());
    return set;
  }
  // élément retenu pour une entrée DPS (choisi, sinon 1er possible)
  const dpsElem = d => (d.element||"").toUpperCase() || charElements(d.char)[0] || elemOf(d.char);

  function elemBadge(e){
    const b = el("span",{class:"elem-badge", title:elemLabel(e)});
    b.style.setProperty("--ec", elemColor(e));
    b.appendChild(el("span",{class:"dot"}));
    b.appendChild(el("span",{text:elemLabel(e)}));
    return b;
  }

  /* ============================ Analyse ============================ */
  let analyseElem = null;
  let analyseRenderId = 0;
  let analysePlayers = [];   // joueurs déjà chargés par renderAnalyse (filtrage local)

  function rankRowForFocusKey(root, key){
    if(!root || !key) return null;
    return [...root.querySelectorAll(".rank-action")].find(row =>
      row.dataset.owner === String(key.owner || "")
      && row.dataset.char === String(key.char || "")
      && row.dataset.elem === String(key.element || "")
    ) || null;
  }

  // Construit le tableau du classement dans son conteneur stable, à partir des
  // joueurs déjà chargés et de l'élément choisi. Aucune lecture réseau ici.
  function renderRankTable(rankBox){
    const entries = [];
    analysePlayers.forEach(p=>(p.dps||[]).forEach(d=>{
      if(dpsElem(d)===analyseElem){
        entries.push({
          player:p.name,
          owner:p.owner,
          characters:p.characters,
          dps:d
        });
      }
    }));
    entries.sort((a,b)=>(b.dps.pot||0)-(a.dps.pot||0));
    const rank = el("div",{class:"rank-table"});
    rank.appendChild(el("div",{class:"rank-row rank-head"},[
      el("span",{class:"rk-pos",text:"#"}), el("span",{class:"rk-player",text:"Membre"}),
      el("span",{class:"rk-dps",text:"DPS"}), el("span",{class:"rk-pot",text:"Potentiel"})
    ]));
    if(!entries.length) rank.appendChild(el("div",{class:"rank-empty", text:"Aucun DPS "+elemLabel(analyseElem)+" recensé."}));
    entries.forEach((en,i)=>{
      const ch=charOf(en.dps.char);
      const element = dpsElem(en.dps);
      const port=el("span",{class:"rk-portrait"});
      if(ch) port.appendChild(el("img",{src:ch.file,alt:"",loading:"lazy"}));
      const row = el("button",{
        class:"rank-row rank-action"+(i<3?" top":""),
        type:"button",
        dataset:{ owner:en.owner || "", char:en.dps.char, elem:element },
        onclick:()=>{
          const entry = (en.characters||[])
            .find(character => character.charId === en.dps.char);
          if(!entry) return;
          openRosterDetailFor({
            entries:[entry],
            index:0,
            memberName:en.player,
            weaponTypes:en.dps.weaponTypes,
            weaponType:en.dps.preferredWeaponType,
            showNavigation:false,
            returnFocusKey:{
              owner:en.owner,
              char:en.dps.char,
              element
            }
          });
        }
      },[
        el("span",{class:"rk-pos", text:String(i+1)}),
        el("span",{class:"rk-player", text:en.player}),
        el("span",{class:"rk-dps"},[
          port,
          el("span",{text: ch?ch.name:en.dps.char})
        ]),
        el("span",{
          class:"rk-pot",
          text:en.dps.pot>0 ? ("P"+en.dps.pot) : "—"
        })
      ]);
      rank.appendChild(row);
    });
    rankBox.replaceChildren(rank);
    /* Realtime peut remplacer la ligne qui a ouvert la modale. On corrige la
       cible de restitution dans la pile AVANT la fermeture ; ModalStack reste
       l'unique mécanisme qui déplace effectivement le focus. */
    const overlay = $("#rosterDetailOverlay");
    if(overlay.classList.contains("on") && rosterDetail.returnFocusKey){
      const replacement = rankRowForFocusKey(
        rankBox, rosterDetail.returnFocusKey
      );
      if(replacement) ModalStack.setRestoreFocus(overlay, replacement);
    }
  }

  async function renderAnalyse(){
    const renderId = ++analyseRenderId;
    const box = $("#analyseBody");
    /* Le rafraîchissement détache immédiatement les lignes du classement. Si
       celle qui a ouvert la modale ne réapparaît pas (build supprimé ou lecture
       en échec), l'onglet Analyse reste une cible logique et visible. Une ligne
       reconstruite remplacera ce repli dans `renderRankTable()`. */
    const detailOverlay = $("#rosterDetailOverlay");
    if(detailOverlay.classList.contains("on") && rosterDetail.returnFocusKey){
      ModalStack.setRestoreFocus(detailOverlay, $("#tab-analyse"));
    }
    box.innerHTML = "";
    box.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Chargement de l’analyse…"})
    ]));
    if(!sessionCourante.user){
      box.innerHTML = "";
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Connecte-toi pour voir l'analyse"}),
        el("button",{class:"btn btn-primary",text:"Connexion",onclick:()=>openAuth()})
      ]));
      return;
    }
    let players;
    try{
      players = await rosterDerivedPlayers();
    }catch(error){
      players = [];
      toast("Analyse indisponible pour l'instant.", true);
    }
    if(renderId !== analyseRenderId) return;
    box.innerHTML = "";
    if(!players.length){
      box.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Rien à analyser"}),
        el("p",{text:"Les DPS sont calculés depuis les rosters : ajoute des personnages offensifs dans l'onglet « Roster »."})
      ]));
      return;
    }

    // --- 1) Couverture par élément ---
    const cov = {}; ELEM_ORDER.forEach(e=>cov[e]={players:0,dps:0});
    players.forEach(p=>{
      const has={};
      (p.dps||[]).forEach(d=>{ const e=dpsElem(d); if(cov[e]){ cov[e].dps++; has[e]=true; } });
      ELEM_ORDER.forEach(e=>{ if(has[e]) cov[e].players++; });
    });
    box.appendChild(el("h2",{class:"an-title", text:"Couverture par élément"}));
    const covRow = el("div",{class:"cov-row"});
    ELEM_ORDER.forEach(e=>{
      const c = el("div",{class:"cov-card"});
      c.style.setProperty("--ec", elemColor(e));
      c.appendChild(elemBadge(e));
      c.appendChild(el("div",{class:"cov-nums"},[
        el("span",{class:"cov-big", text:String(cov[e].players)}),
        el("span",{class:"cov-lbl", text:"membre"+(cov[e].players>1?"s":"")})
      ]));
      c.appendChild(el("div",{class:"cov-sub", text:cov[e].dps+" DPS"}));
      covRow.appendChild(c);
    });
    box.appendChild(covRow);

    // --- 2) Classement par élément ---
    // Le classement vit dans un conteneur stable : le clic sur un élément ne
    // remplace que ce conteneur (aucun rechargement Supabase, aucun reflow global).
    box.appendChild(el("h2",{class:"an-title", text:"Classement par potentiel"}));
    if(analyseElem===null){
      analyseElem = ELEM_ORDER.find(e=>cov[e].dps>0) || ELEM_ORDER[0];
    }
    analysePlayers = players;
    const chips = el("div",{class:"elem-chips"});
    const rankBox = el("div",{class:"rank-box"});
    ELEM_ORDER.forEach(e=>{
      chips.appendChild(el("button",{class:"elem-chip"+(e===analyseElem?" active":""),
        "aria-pressed": e===analyseElem ? "true" : "false",
        dataset:{elem:e},
        onclick:()=>{
          analyseElem=e;
          [...chips.children].forEach(b=>{
            const on = b.dataset.elem===analyseElem;
            b.classList.toggle("active", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
          renderRankTable(rankBox);
        }},[ elemBadge(e) ]));
    });
    box.appendChild(chips);
    box.appendChild(rankBox);
    /* Le conteneur doit déjà être connecté : si Realtime reconstruit la vue
       pendant que la modale est ouverte, ModalStack refuse à juste titre une
       cible de focus détachée. */
    renderRankTable(rankBox);

    // --- 3) Matrice joueur × élément ---
    box.appendChild(el("h2",{class:"an-title", text:"Matrice membre × élément"}));
    const wrap = el("div",{class:"matrix-wrap"});
    const table = el("table",{class:"matrix"});
    const thead = el("tr",{},[ el("th",{class:"mx-player",text:"Membre"}), el("th",{text:"Total"}) ]);
    ELEM_ORDER.forEach(e=>{ const th=el("th",{}); th.appendChild(elemBadge(e)); thead.appendChild(th); });
    table.appendChild(thead);
    players.slice().sort((a,b)=>(b.dps||[]).length-(a.dps||[]).length).forEach(p=>{
      const tr=el("tr",{});
      tr.appendChild(el("td",{class:"mx-player", text:p.name}));
      tr.appendChild(el("td",{class:"mx-total", text:String((p.dps||[]).length)}));
      ELEM_ORDER.forEach(e=>{
        const cell = (p.dps||[]).filter(d=>dpsElem(d)===e)
          .sort((a,b)=>(b.pot||0)-(a.pot||0))
          .map(d=>{ const ch=charOf(d.char); return (ch?ch.name:d.char)+(d.pot>0?" P"+d.pot:""); });
        const td = el("td",{class:cell.length?"":"mx-empty"});
        if(cell.length) cell.forEach(t=>td.appendChild(el("div",{class:"mx-item",text:t})));
        else td.textContent="—";
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    box.appendChild(wrap);
  }

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
    if(action.type === "find-group"){
      const loaded = await showView("boss");
      if(!loaded) return;
      const target = $("#bossBody").querySelector(
        '.boss-card:not(.mine) .boss-join:not([disabled])'
      );
      (target || $("#tab-boss")).focus();
    }
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
