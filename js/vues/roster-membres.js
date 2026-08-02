/* Le roster des membres : la collection de personnages d'un membre, et
   l'editeur d'un de ses builds.

   Un personnage porte plusieurs builds, un par type d'arme, dont un seul est
   « favori » — c'est celui que l'Analyse et les equipes reprennent. Les trois
   aides en tete du module tiennent cette regle : un seul favori a la fois,
   et copier le favori vers un autre type d'arme ne touche jamais l'arme.

   L'editeur reutilise les widgets d'edition-build.js, exactement les memes
   que le Builder. C'est voulu : configurer une piece doit se faire pareil des
   deux cotes du site.

   Le module garde sa propre copie de la liste affichee pendant l'edition :
   une synchronisation Realtime ne doit pas deplacer un personnage sous les
   yeux du lecteur. */

import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { sessionCourante } from "../etat/session.js";
import { linkedArmorsOf, weaponFolderOf, weaponTypesOf } from "../metier/armes.js";
import { charOf } from "../metier/catalogue.js";
import {
  compatibleWeaponGroups,
  favoriteRosterWeaponType,
  normalizeHero,
  normalizeRosterCharacter,
  rosterHeroSnapshot
} from "../metier/equipe-modele.js";
import { ARMOR_SET_SLOTS, emptyArmor, emptyJewel } from "../metier/equipement.js";
import {
  ARMOR_LABELS,
  ARMOR_SLOTS,
  DATA,
  ELEMENTS,
  JEWEL_LABELS,
  JEWEL_SLOTS,
  LINKED_ARMOR_SLOT,
  META,
  POT_MAX,
  WEAPON_ENUM,
  WSLOT_ROLES,
  metaOf
} from "../noyau/constantes.js";
import { $, el, norm } from "../noyau/dom.js";
import { jsonCopy } from "../noyau/outils.js";
import { authMessage } from "../noyau/supabase-client.js";
import { openRosterDetailFor, rosterDetailOwnerLabel } from "./detail-roster.js";
import {
  closeWeaponConfigEditor,
  setWeaponConfigRestoreFocus,
  weaponDefaultGradeGameId
} from "./editeur-arme.js";
import { setGearConfigRestoreFocus } from "./editeur-equipement.js";
import {
  applyGearChange,
  applyWeaponChange,
  equipmentSetButton,
  findGearConfigButton,
  gearConfigurableSlot,
  weaponConfigControl
} from "./edition-build.js";
import { gearSlot, rosterWeaponLabel } from "./elements.js";
import { badgesRow } from "./fiche-heros.js";
import { ModalStack } from "./modal-stack.js";
import { openAuth } from "./modale-auth.js";
import { Picker } from "./picker.js";
import { heroStatsSection } from "./stats-heros.js";
import { toast } from "./toast.js";

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
        setWeaponConfigRestoreFocus(nextButton);
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
          setGearConfigRestoreFocus(nextButton);
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
          setGearConfigRestoreFocus(nextButton);
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

export { renderMemberRoster };
