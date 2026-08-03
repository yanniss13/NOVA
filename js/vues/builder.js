/* L'onglet Builder : composer une equipe de heros, l'equiper, la comparer au
   roster du membre, puis l'enregistrer.

   Le module s'ouvre sur deux aides qui vivaient tout en haut d'app.js
   (`builderWeaponSwitcher`, `potentielDetailsOf`) et sur le modele du
   brouillon (`emptyHero`, `emptyDraft`) : ils ne servaient qu'ici.

   Les « baselines roster » mesurent l'ecart entre le heros affiche et le build
   enregistre dans le roster du membre. C'est ce qui permet de dire « ce heros
   differe de ton roster » sans relire le reseau a chaque frappe.

   Les widgets d'edition ne sont PAS ici : ils sont partages avec l'editeur du
   roster d'un membre, et vivent dans edition-build.js. */

import { Store } from "../donnees/equipes-store.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { brouillonEquipe } from "../etat/brouillon-equipe.js";
import { sessionCourante } from "../etat/session.js";
import { linkedArmorsOf, weaponFolderOf, weaponTypesOf } from "../metier/armes.js";
import { charOf, nameOfFile } from "../metier/catalogue.js";
import {
  compatibleWeaponGroups,
  favoriteRosterWeaponType,
  normalizePotentiel,
  normalizeTeam,
  rosterHeroSnapshot,
  teamBuildSnapshot
} from "../metier/equipe-modele.js";
import {
  ARMOR_SET_SLOTS,
  emptyArmor,
  emptyJewel,
  emptyPot
} from "../metier/equipement.js";
import {
  ARMOR_LABELS,
  ARMOR_SLOTS,
  DATA,
  ENUM_TO_FOLDER,
  FOLDER_TO_ENUM,
  JEWEL_LABELS,
  JEWEL_SLOTS,
  LINKED_ARMOR_SLOT,
  POT,
  POT_MAX,
  TEAM_SIZE,
  WEAPON_ENUM,
  metaOf
} from "../noyau/constantes.js";
import { $, el, uid } from "../noyau/dom.js";
import { jsonCopy } from "../noyau/outils.js";
import { authMessage, sb } from "../noyau/supabase-client.js";
import {
  closeWeaponConfigEditor,
  setWeaponConfigRestoreFocus,
  weaponDefaultGradeGameId
} from "./editeur-arme.js";
import { setGearConfigRestoreFocus } from "./editeur-equipement.js";
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
} from "./edition-build.js";
import { gearSlot, renderBonus, rosterWeaponLabel } from "./elements.js";
import { weaponSlotBadge } from "./fiche-heros.js";
import { ModalStack } from "./modal-stack.js";
import { openAuth } from "./modale-auth.js";
import { showView } from "./navigation.js";
import { Picker } from "./picker.js";
import { heroStatsSection } from "./stats-heros.js";
import { toast } from "./toast.js";

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
        setWeaponConfigRestoreFocus(nextButton);
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
            setGearConfigRestoreFocus(nextButton);
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
            setGearConfigRestoreFocus(nextButton);
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
      emptyHint:"Aucun bijou pour l'instant. Ajoute des images dans 7ds-bijoux/"+slot+"/ puis relance scripts/generate-data.ps1.",
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

export {
  pseudoInput,
  renderBuilder,
  resetBuilderRosterBaselines,
  resetTeamDraft,
  teamNameInput
};
