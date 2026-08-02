/* La vue des disponibilites hebdomadaires : grille de saisie, cache hors
   ligne et synchronisation Supabase.

   La logique pure (masques, semaines, agregation) vit a part, dans
   js/dispos-logique.js. Ici, tout ce qui touche au DOM et au reseau.

   Le bloc etait deja d'un seul tenant dans js/app.js et ne dependait que de
   modules deja sortis : seuls `Availability` et `renderAvailabilityView` en
   sortent, les huit autres declarations deviennent privees. */

import { $ } from "../noyau/dom.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";
import { toast } from "./toast.js";
import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { ModalStack } from "./modal-stack.js";
import { currentBossWeek } from "../metier/boss-logique.js";
import {
  AVAIL_DAYS,
  AVAIL_HOURS,
  AVAIL_EMPTY_MASK,
  availabilityWeekStart,
  availabilityPreviousWeekStart,
  availabilitySlotIndex,
  availabilitySlotFromIndex,
  normalizeAvailabilityMask,
  availabilityMaskHas,
  applyAvailabilityRange,
  paintAvailabilityRectangle,
  availabilityToggleDay,
  availabilityToggleHour,
  aggregateAvailability,
  availabilityDensityTier,
  availabilitySlotMembers,
  staleAvailabilityWeeks,
  AVAIL_DAY_LABELS,
  AVAIL_DAY_FULL,
  availabilityDayDate,
  availabilityViewState
} from "../metier/dispos-logique.js";

  const AVAIL_CACHE_PREFIX = "confrerie7ds.cloud.availability.";
  const AVAIL_CACHE_VERSION = 1;
  /* Quatre semaines conservées, la courante comprise. */
  const AVAIL_KEEP_WEEKS = 4;
  /* Seuils d'un appui volontaire au doigt. En dessous du seuil de défilement du
     navigateur, aucun `pointercancel` n'est émis : ces bornes distinguent seules
     l'appui franc du doigt simplement posé pour faire défiler. */
  const AVAIL_TAP_MAX_MOVE = 10;   // pixels
  const AVAIL_TAP_MAX_DELAY = 300; // millisecondes

  function availabilityCacheKey(userId, weekStart){
    return AVAIL_CACHE_PREFIX+userId+"."+weekStart;
  }

  function readAvailabilityCache(userId, weekStart){
    if(!userId || !weekStart) return null;
    try{
      const raw = localStorage.getItem(availabilityCacheKey(userId, weekStart));
      if(!raw) return null;
      const envelope = JSON.parse(raw);
      if(
        !envelope ||
        envelope.version !== AVAIL_CACHE_VERSION ||
        envelope.userId !== userId ||
        envelope.weekStart !== weekStart ||
        !Array.isArray(envelope.rows)
      ) return null;
      return envelope.rows;
    }catch(error){
      return null;
    }
  }

  function writeAvailabilityCache(userId, weekStart, rows){
    if(!userId || !weekStart) return;
    try{
      localStorage.setItem(
        availabilityCacheKey(userId, weekStart),
        JSON.stringify({
          version:AVAIL_CACHE_VERSION,
          userId,
          weekStart,
          savedAt:Date.now(),
          rows
        })
      );
    }catch(error){
      // Un quota local indisponible ne doit jamais casser la vue en ligne.
    }
  }

  const Availability = (function(){
    let state = null;

    function cellLabel(day, hour){
      return AVAIL_DAY_FULL[day]+" "+String(hour).padStart(2, "0")+"h";
    }

    function renderGrid(){
      const body = $("#availBody");
      body.innerHTML = "";
      if(state.message){
        const note = document.createElement("p");
        note.className = "avail-note";
        note.textContent = state.message;
        body.appendChild(note);
      }
      const aggregate = state.mode === "guild"
        ? aggregateAvailability(state.rows)
        : null;
      const wrap = document.createElement("div");
      wrap.className = "avail-grid-wrap";
      const grid = document.createElement("div");
      grid.className = "avail-grid";
      grid.id = "availGrid";
      const corner = document.createElement("div");
      corner.className = "avail-corner avail-head";
      grid.appendChild(corner);
      for(let day = 0; day < AVAIL_DAYS; day += 1){
        const head = document.createElement("button");
        head.type = "button";
        head.className = "avail-head";
        head.dataset.day = String(day);
        const date = availabilityDayDate(state.weekStart, day);
        head.textContent = AVAIL_DAY_LABELS[day]+" "+date.getUTCDate();
        head.disabled = !state.canEdit || state.mode === "guild";
        grid.appendChild(head);
      }
      for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
        const gutter = document.createElement("button");
        gutter.type = "button";
        gutter.className = "avail-gutter";
        gutter.dataset.hour = String(hour);
        gutter.textContent = String(hour).padStart(2, "0")+"h";
        gutter.disabled = !state.canEdit || state.mode === "guild";
        grid.appendChild(gutter);
        for(let day = 0; day < AVAIL_DAYS; day += 1){
          const index = availabilitySlotIndex(day, hour);
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "avail-cell";
          cell.dataset.index = String(index);
          cell.dataset.day = String(day);
          cell.dataset.hour = String(hour);
          if(state.mode === "guild"){
            const count = aggregate.counts[index];
            cell.dataset.tier = String(
              availabilityDensityTier(count, aggregate.max)
            );
            cell.textContent = count ? String(count) : "";
            cell.classList.toggle("mine", availabilityMaskHas(state.mask, index));
            cell.setAttribute(
              "aria-label",
              cellLabel(day, hour)+" — "+count+" membre"+(count > 1 ? "s" : "")
            );
          }else{
            const on = availabilityMaskHas(state.mask, index);
            cell.setAttribute("aria-pressed", String(on));
            cell.setAttribute("aria-label", cellLabel(day, hour));
            cell.disabled = !state.canEdit;
          }
          grid.appendChild(cell);
        }
      }
      wrap.appendChild(grid);
      body.appendChild(wrap);
      if(state.mode === "guild"){
        grid.addEventListener("click", event => {
          const cell = event.target.closest(".avail-cell[data-index]");
          if(cell) openSlot(Number(cell.dataset.index));
        });
      }
      bindGrid();
    }

    function render(){
      $("#availWeek").textContent = state ? state.weekLabel : "";
      $("#availModeMine").classList.toggle("active", state.mode === "mine");
      $("#availModeMine").setAttribute(
        "aria-pressed", String(state.mode === "mine")
      );
      $("#availModeGuild").classList.toggle("active", state.mode === "guild");
      $("#availModeGuild").setAttribute(
        "aria-pressed", String(state.mode === "guild")
      );
      renderGrid();
      renderBest();
      syncRangeControls();
      syncCopyButton();
      /* Les commandes de saisie n'ont aucun sens en lecture collective. */
      $("#availRangeForm").hidden = state.mode === "guild";
    }

    function setMode(mode){
      if(!state) return;
      state.mode = mode;
      render();
    }

    async function refresh(){
      const user = sessionCourante.user;
      const weekStart = availabilityWeekStart(new Date());
      let rows = [];
      let online = true;
      if(user && sb){
        const result = await sb.from("member_availability")
          .select("owner,slots,week_start")
          .eq("week_start", weekStart);
        if(result.error){
          online = false;
          rows = readAvailabilityCache(user.id, weekStart) || [];
        }else{
          rows = result.data || [];
          writeAvailabilityCache(user.id, weekStart, rows);
        }
      }
      await loadOwnersWithGroup();
      state = availabilityViewState({
        now:new Date(),
        rows,
        currentUserId:user ? user.id : "",
        mode:state ? state.mode : "mine",
        online
      });
      render();
      return true;
    }

    /* Enregistrement différé : un glissement produit un seul upsert, et le
       drapeau `savePending` sert de garde contre l'écho Realtime de sa propre
       écriture (voir RealtimeSync). */
    let saveTimer = null;
    let savePending = false;
    let anchor = null;
    let lastCell = null;
    let paintFill = true;
    let holdTimer = null;
    let painting = false;
    let touchStart = null;

    function isSaving(){ return savePending; }

    /* Indicateur dédié plutôt que #liveStatus : ce dernier appartient à
       RealtimeSync, qui y écrit l'état de la connexion. Deux écrivains sur le
       même nœud produiraient des messages qui se chassent l'un l'autre. */
    function setSaveStatus(stateName, text){
      const node = $("#availSaveStatus");
      if(!node) return;
      node.dataset.state = stateName;
      node.textContent = text;
    }

    async function saveNow(){
      clearTimeout(saveTimer);
      saveTimer = null;
      if(!state || !state.canEdit || !sessionCourante.user || !sb){
        savePending = false;
        return false;
      }
      setSaveStatus("saving", "Enregistrement…");
      const payload = {
        owner:sessionCourante.user.id,
        week_start:state.weekStart,
        slots:state.mask,
        updated_at:new Date().toISOString()
      };
      const { error } = await sb.from("member_availability")
        .upsert(payload, { onConflict:"owner,week_start" });
      savePending = false;
      if(error){
        setSaveStatus("error", "Non enregistré");
        toast("Dispos non enregistrées : réessaie une fois reconnecté.", true);
        return false;
      }
      const own = state.rows.find(row => row.owner === sessionCourante.user.id);
      if(own) own.slots = state.mask;
      else state.rows.push({ owner:sessionCourante.user.id, slots:state.mask });
      writeAvailabilityCache(sessionCourante.user.id, state.weekStart, state.rows);
      const stamp = new Intl.DateTimeFormat("fr-FR", {
        timeZone:"Europe/Paris", hour:"2-digit", minute:"2-digit"
      }).format(new Date());
      setSaveStatus("saved", "Enregistré à "+stamp);
      /* Purge auto-nettoyante : chaque membre efface SES semaines anciennes,
         ce qui évite une tâche planifiée côté serveur. */
      const owned = await sb.from("member_availability")
        .select("week_start")
        .eq("owner", sessionCourante.user.id);
      if(!owned.error){
        const stale = staleAvailabilityWeeks(
          (owned.data || []).map(row => row.week_start),
          state.weekStart,
          AVAIL_KEEP_WEEKS
        );
        if(stale.length){
          await sb.from("member_availability")
            .delete()
            .eq("owner", sessionCourante.user.id)
            .in("week_start", stale);
        }
      }
      return true;
    }

    function scheduleSave(){
      savePending = true;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(()=>void saveNow(), 600);
    }

    /* Mise à jour chirurgicale : on ne touche qu'aux attributs des 168 cases
       déjà en place. Reconstruire la grille à chaque bascule faisait perdre la
       position de défilement et le focus, ce qui donnait l'impression que le
       planning se rechargeait à chaque créneau ajouté. */
    function syncCells(){
      const grid = $("#availGrid");
      if(!grid || !state || state.mode !== "mine") return;
      grid.querySelectorAll(".avail-cell").forEach(cell => {
        const index = Number(cell.dataset.index);
        cell.setAttribute(
          "aria-pressed", String(availabilityMaskHas(state.mask, index))
        );
        cell.classList.remove("preview");
      });
    }

    function applyMask(mask){
      if(!state || !state.canEdit || mask === state.mask) return;
      state.mask = mask;
      syncCells();
      syncCopyButton();
      scheduleSave();
    }

    function cellFrom(target){
      if(!target || !target.dataset || target.dataset.index === undefined){
        return null;
      }
      return {
        day:Number(target.dataset.day),
        hour:Number(target.dataset.hour),
        index:Number(target.dataset.index)
      };
    }

    function previewRectangle(cursor){
      if(!anchor) return;
      const grid = $("#availGrid");
      if(!grid) return;
      const preview = paintAvailabilityRectangle(
        state.mask, anchor, cursor, paintFill
      );
      grid.querySelectorAll(".avail-cell").forEach(cell => {
        const index = Number(cell.dataset.index);
        cell.setAttribute("aria-pressed", String(preview[index] === "1"));
        cell.classList.toggle("preview", preview[index] !== state.mask[index]);
      });
    }

    function endPaint(cursor){
      clearTimeout(holdTimer);
      holdTimer = null;
      if(!anchor) return;
      const target = cursor || lastCell || anchor;
      const mask = paintAvailabilityRectangle(
        state.mask, anchor, target, paintFill
      );
      anchor = null;
      lastCell = null;
      painting = false;
      applyMask(mask);
      /* Remet l'affichage sur le masque réel : indispensable quand le geste
         n'a rien changé, applyMask sortant alors sans redessiner. */
      syncCells();
    }

    function abortPaint(){
      clearTimeout(holdTimer);
      holdTimer = null;
      anchor = null;
      lastCell = null;
      painting = false;
      syncCells();
    }

    function bindGrid(){
      const grid = $("#availGrid");
      if(!grid || !state.canEdit || state.mode !== "mine") return;
      grid.addEventListener("pointerdown", event => {
        const cell = cellFrom(event.target);
        if(!cell) return;
        anchor = cell;
        lastCell = cell;
        paintFill = !availabilityMaskHas(state.mask, cell.index);
        touchStart = event.pointerType === "mouse"
          ? null
          : { x:event.clientX, y:event.clientY, at:Date.now(), moved:0 };
        /* Le glissement de peinture est réservé à la souris. Au doigt, le
           navigateur reprend la main dès qu'il décide de faire défiler et émet
           `pointercancel` : une peinture par glissement ne s'engagerait jamais,
           et prétendre le contraire volait le défilement au membre. Sur mobile,
           la saisie de plusieurs créneaux passe par « Ajouter un créneau ». */
        painting = event.pointerType === "mouse";
        if(painting){
          grid.setPointerCapture(event.pointerId);
          event.preventDefault();
        }
      });
      grid.addEventListener("pointermove", event => {
        /* Le déplacement se mesure pendant le geste, jamais au relâchement :
           au doigt, le `pointerup` ne porte pas de position exploitable. */
        if(touchStart){
          touchStart.moved = Math.max(touchStart.moved, Math.hypot(
            event.clientX - touchStart.x, event.clientY - touchStart.y
          ));
        }
        if(!anchor || !painting) return;
        const cell = cellFrom(document.elementFromPoint(
          event.clientX, event.clientY
        ));
        if(cell){
          lastCell = cell;
          previewRectangle(cell);
        }
        event.preventDefault();
      });
      /* La capture du pointeur redirige `pointerup` vers la GRILLE : son
         `event.target` n'est donc plus la case survolée. On repasse par la
         position du curseur, avec la dernière case connue en repli. */
      /* Au doigt, le navigateur n'émet `pointercancel` que s'il a bougé assez
         pour décider de faire défiler. En dessous de son seuil, `pointerup`
         arrive quand même : sans ce filtre, tout doigt posé pour tenter un
         défilement remplissait un créneau. On n'accepte donc qu'un appui à la
         fois BREF et IMMOBILE. */
      grid.addEventListener("pointerup", event => {
        if(!anchor) return;
        if(touchStart){
          const eloigne = touchStart.moved > AVAIL_TAP_MAX_MOVE;
          const trainant = Date.now() - touchStart.at > AVAIL_TAP_MAX_DELAY;
          touchStart = null;
          if(eloigne || trainant){ abortPaint(); return; }
          /* Appui franc : on bascule la case pressée, et elle seule. */
          endPaint(anchor);
          return;
        }
        endPaint(cellFrom(document.elementFromPoint(
          event.clientX, event.clientY
        )));
      });
      grid.addEventListener("pointercancel", ()=>{
        touchStart = null;
        abortPaint();
      });
      grid.addEventListener("click", event => {
        const head = event.target.closest(".avail-head[data-day]");
        if(head){
          applyMask(availabilityToggleDay(state.mask, Number(head.dataset.day)));
          return;
        }
        const gutter = event.target.closest(".avail-gutter[data-hour]");
        if(gutter){
          applyMask(
            availabilityToggleHour(state.mask, Number(gutter.dataset.hour))
          );
        }
      });
      grid.addEventListener("keydown", event => {
        const cell = cellFrom(event.target);
        if(!cell) return;
        let day = cell.day;
        let hour = cell.hour;
        if(event.key === "ArrowRight") day = Math.min(AVAIL_DAYS - 1, day + 1);
        else if(event.key === "ArrowLeft") day = Math.max(0, day - 1);
        else if(event.key === "ArrowDown") hour = Math.min(AVAIL_HOURS - 1, hour + 1);
        else if(event.key === "ArrowUp") hour = Math.max(0, hour - 1);
        else if(event.key === " " || event.key === "Enter"){
          event.preventDefault();
          applyMask(paintAvailabilityRectangle(
            state.mask, cell, cell, !availabilityMaskHas(state.mask, cell.index)
          ));
          const same = $("#availGrid").querySelector(
            '.avail-cell[data-index="'+cell.index+'"]'
          );
          if(same) same.focus();
          return;
        }else return;
        event.preventDefault();
        if(event.shiftKey){
          applyMask(paintAvailabilityRectangle(
            state.mask, cell, { day, hour },
            !availabilityMaskHas(state.mask, cell.index)
          ));
        }
        const next = $("#availGrid").querySelector(
          '.avail-cell[data-index="'+availabilitySlotIndex(day, hour)+'"]'
        );
        if(next) next.focus();
      });
    }

    function fillHourOptions(select, selected){
      select.innerHTML = "";
      for(let hour = 0; hour < AVAIL_HOURS; hour += 1){
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = String(hour).padStart(2, "0")+"h";
        if(hour === selected) option.selected = true;
        select.appendChild(option);
      }
    }

    function selectedRangeDays(){
      return [...$("#availRangeDays").querySelectorAll("input:checked")]
        .map(input => Number(input.value));
    }

    function syncRangeControls(){
      const start = Number($("#availRangeStart").value);
      const end = Number($("#availRangeEnd").value);
      const days = selectedRangeDays();
      /* Heures égales : la plage serait soit vide soit longue de 24 h selon la
         lecture. On refuse le cas plutôt que d'en inventer une. */
      const usable = !!state && state.canEdit && start !== end && days.length > 0;
      $("#availRangeAdd").disabled = !usable;
      $("#availRangeRemove").disabled = !usable;
      $("#availRangeHint").textContent = start === end
        ? "Choisis deux heures différentes."
        : (end < start ? "Ce créneau se poursuit le lendemain." : "");
    }

    function applyRange(fill){
      if(!state || !state.canEdit) return;
      const start = Number($("#availRangeStart").value);
      const end = Number($("#availRangeEnd").value);
      const result = applyAvailabilityRange(
        state.mask, start, end, selectedRangeDays(), fill
      );
      applyMask(result.mask);
      if(result.clipped){
        toast(
          "La fin de la nuit du dimanche appartient à la semaine suivante : "
          + "elle n'a pas été ajoutée."
        );
      }
    }

    async function copyPreviousWeek(){
      if(!state || !state.canEdit || !sessionCourante.user || !sb) return false;
      const previous = availabilityPreviousWeekStart(state.weekStart);
      const { data, error } = await sb.from("member_availability")
        .select("slots")
        .eq("week_start", previous)
        .eq("owner", sessionCourante.user.id)
        .maybeSingle();
      if(error || !data){
        toast("Aucune dispo trouvée pour la semaine dernière.", true);
        return false;
      }
      applyMask(normalizeAvailabilityMask(data.slots));
      return true;
    }

    let ownersWithGroup = new Set();
    let pseudos = [];

    /* Les pseudos viennent de `profiles`, via le même cache que les vues
       partagées. `profilePseudo()` ne convient pas : elle résout le pseudo du
       compte connecté, pas celui d'un propriétaire quelconque. */
    function pseudoOfOwner(owner){
      const found = pseudos.find(profile => profile.id === owner);
      if(found) return found.pseudo;
      if(sessionCourante.user && owner === sessionCourante.user.id) return sessionCourante.pseudo || "Moi";
      return "Membre";
    }

    /* Les participations disent qui a déjà rejoint un groupe. Elles se lisent
       sur la SEMAINE DE BOSS, qui bascule le lundi à 9h, et non sur la semaine
       ISO de la grille : les deux ne coïncident pas le lundi matin. */
    async function loadOwnersWithGroup(){
      ownersWithGroup = new Set();
      if(!sessionCourante.user || !sb) return;
      pseudos = await refreshRosterProfiles().catch(()=>sessionCourante.rosterProfiles.slice());
      const week = currentBossWeek();
      const sessions = await sb.from("boss_sessions")
        .select("id")
        .eq("week_start", week.startDate);
      if(sessions.error || !sessions.data || !sessions.data.length) return;
      const participation = await sb.from("boss_participation")
        .select("owner,session_id")
        .in("session_id", sessions.data.map(session => session.id));
      if(participation.error) return;
      (participation.data || []).forEach(row => {
        if(row.owner) ownersWithGroup.add(row.owner);
      });
    }

    function renderBest(){
      const node = $("#availBest");
      node.innerHTML = "";
      if(!state || state.mode !== "guild") return;
      const { best } = aggregateAvailability(state.rows);
      if(!best.length){
        node.textContent = "Personne n'a encore posé de dispo cette semaine.";
        return;
      }
      node.appendChild(document.createTextNode("Meilleurs créneaux :"));
      best.forEach(entry => {
        const slot = availabilitySlotFromIndex(entry.index);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-ghost";
        button.textContent = AVAIL_DAY_LABELS[slot.day]
          + " " + String(slot.hour).padStart(2, "0") + "h"
          + " (" + entry.count + ")";
        button.addEventListener("click", ()=>openSlot(entry.index));
        node.appendChild(button);
      });
    }

    function openSlot(index){
      if(!state || state.mode !== "guild") return;
      const slot = availabilitySlotFromIndex(index);
      const members = availabilitySlotMembers(state.rows, index, {
        pseudoOf:pseudoOfOwner,
        currentUserId:sessionCourante.user ? sessionCourante.user.id : "",
        ownersWithGroup
      });
      $("#availSlotTitle").textContent = AVAIL_DAY_FULL[slot.day]
        + " " + String(slot.hour).padStart(2, "0") + "h — "
        + members.length + " membre" + (members.length > 1 ? "s" : "");
      const list = $("#availSlotList");
      list.innerHTML = "";
      if(!members.length){
        const empty = document.createElement("li");
        empty.textContent = "Personne n'est disponible sur ce créneau.";
        list.appendChild(empty);
      }
      members.forEach(member => {
        const row = document.createElement("li");
        row.classList.toggle("me", member.isMe);
        const name = document.createElement("b");
        name.textContent = member.pseudo + (member.isMe ? " (toi)" : "");
        row.appendChild(name);
        if(member.withoutGroup){
          const tag = document.createElement("span");
          tag.className = "avail-slot-tag";
          tag.textContent = "sans groupe";
          row.appendChild(tag);
        }
        list.appendChild(row);
      });
      ModalStack.open($("#availSlotOverlay"), "#availSlotClose", closeSlot);
    }

    function closeSlot(){
      ModalStack.close($("#availSlotOverlay"));
    }

    function syncCopyButton(){
      const button = $("#availCopyPrevious");
      /* Le bouton ne s'affiche que s'il a quelque chose à apporter : une
         semaine encore vierge et une saisie possible. */
      button.hidden = !state || !state.canEdit || state.mask !== AVAIL_EMPTY_MASK;
    }

    return {
      refresh, render, setMode, applyMask, saveNow, isSaving,
      fillHourOptions, syncRangeControls, applyRange, copyPreviousWeek,
      openSlot, closeSlot,
      get state(){ return state; }
    };
  })();

  $("#availSlotClose").addEventListener("click", ()=>Availability.closeSlot());

  $("#availModeMine").addEventListener("click", ()=>Availability.setMode("mine"));
  $("#availModeGuild").addEventListener("click", ()=>Availability.setMode("guild"));

  (function initAvailabilityRange(){
    const days = $("#availRangeDays");
    AVAIL_DAY_LABELS.forEach((label, day) => {
      const wrapper = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(day);
      input.setAttribute("aria-label", AVAIL_DAY_FULL[day]);
      const text = document.createElement("span");
      text.textContent = label;
      wrapper.appendChild(input);
      wrapper.appendChild(text);
      days.appendChild(wrapper);
    });
    Availability.fillHourOptions($("#availRangeStart"), 22);
    Availability.fillHourOptions($("#availRangeEnd"), 2);
    days.addEventListener("change", ()=>Availability.syncRangeControls());
    $("#availRangeStart").addEventListener(
      "change", ()=>Availability.syncRangeControls()
    );
    $("#availRangeEnd").addEventListener(
      "change", ()=>Availability.syncRangeControls()
    );
    $("#availRangeAdd").addEventListener("click", ()=>Availability.applyRange(true));
    $("#availRangeRemove").addEventListener(
      "click", ()=>Availability.applyRange(false)
    );
    $("#availCopyPrevious").addEventListener(
      "click", ()=>void Availability.copyPreviousWeek()
    );
  })();

  function renderAvailabilityView(){
    return Availability.refresh();
  }

export {
  Availability,
  renderAvailabilityView
};
