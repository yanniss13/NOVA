/* La modale de detail d'un personnage consulte chez un autre membre.

   Deux appelants la nourrissent par le meme contexte : le Roster, qui indexe
   sur sa liste affichee, et l'Analyse, qui n'a qu'une fiche et aucune liste.
   Un seul chemin d'entree — `openRosterDetailFor` — plutot que deux rendus
   paralleles a garder d'accord.

   Elle garde sa PROPRE copie de la liste : une synchronisation Realtime
   pendant la consultation ne doit pas deplacer le personnage sous les yeux du
   lecteur. C'est la raison d'etre de `rosterDetail.entries`.

   La fiche elle-meme vient de fiche-heros.js ; ce module ne fournit que le
   selecteur d'arme qui remplace la rangee de badges figee.

   `rosterDetail` sort parce que app.js lit `returnFocusKey` pour rendre le
   focus a la bonne tuile apres fermeture. */

import { $, el } from "../noyau/dom.js";
import { ENUM_TO_FOLDER, FOLDER_TO_ENUM, metaOf } from "../noyau/constantes.js";
import { charOf } from "../metier/catalogue.js";
import { weaponTypesOf } from "../metier/armes.js";
import {
  favoriteRosterWeaponType,
  normalizeHero,
  rosterHeroSnapshot
} from "../metier/equipe-modele.js";
import { rosterWeaponLabel } from "./elements.js";
import { ModalStack } from "./modal-stack.js";
import { heroDetail, weaponSlotBadge } from "./fiche-heros.js";

  /* `weaponTypes` restreint le sélecteur d'arme à ces enums (null = tout
     proposer, comportement historique). `showNavigation` masque les flèches
     précédent/suivant quand l'appelant n'a qu'une seule entrée (l'Analyse).
     `returnFocusKey` est réservé aux futurs appelants qui reconstruisent leur
     liste pendant que la modale reste ouverte : personne ne le consomme
     encore ici, mais le champ doit survivre au passage. */
  const rosterDetail = {
    entries:[], index:0, type:null, owner:"",
    weaponTypes:null, showNavigation:true, returnFocusKey:null
  };

  function rosterDetailOwnerLabel(){
    const select = $("#memberRosterOwner");
    const option = select && select.selectedOptions && select.selectedOptions[0];
    return option ? option.textContent : "";
  }

  function rosterDetailWeaponSwitch(entry){
    const meta = metaOf(entry.charId);
    const slots = (meta && meta.weapons) || [];
    const allowed = rosterDetail.weaponTypes;
    /* L'Analyse ne propose qu'un sous-ensemble d'armes DPS (des enums) : on
       filtre AVANT de construire les badges. Sans filtre, comportement
       historique inchangé. */
    const types = allowed
      ? weaponTypesOf(entry.charId).filter(type => allowed.includes(FOLDER_TO_ENUM[type]))
      : weaponTypesOf(entry.charId);
    /* Un sélecteur à un seul choix n'en est plus un : le masquer plutôt que
       proposer un bouton qui ne fait rien. Le comportement historique (filtre
       absent) n'est pas concerné : il peut légitimement n'afficher qu'une
       arme. */
    if(allowed && types.length <= 1) return null;
    const row = el("div",{class:"roster-detail-weapons"});
    types.forEach(type => {
      const enumName = FOLDER_TO_ENUM[type];
      const slot = slots.find(item => item.weapon === enumName)
        || { weapon:enumName, element:"", role:"" };
      const badge = weaponSlotBadge(slot, false);
      if(!badge) return;
      const saved = Object.prototype.hasOwnProperty.call(entry.builds || {}, type);
      const props = {
        class:"roster-detail-weapon",
        type:"button",
        dataset:{ weaponType:type },
        "aria-pressed":String(saved && type === rosterDetail.type),
        title:rosterWeaponLabel(type)
          +(saved ? "" : " · aucun build enregistré")
      };
      if(saved) props.onclick = ()=>{ rosterDetail.type = type; renderRosterDetail(); };
      else props.disabled = "disabled";
      row.appendChild(el("button",props,[badge]));
    });
    return row;
  }

  function renderRosterDetail(){
    const entry = rosterDetail.entries[rosterDetail.index];
    const body = $("#rosterDetailBody");
    body.innerHTML = "";
    if(!entry) return;
    const character = charOf(entry.charId);
    const types = Object.keys(entry.builds || {});
    if(!rosterDetail.type || !types.includes(rosterDetail.type)){
      rosterDetail.type = favoriteRosterWeaponType(entry) || types[0] || null;
    }
    $("#rosterDetailTitle").textContent = rosterDetail.owner
      ? character.name + " — " + rosterDetail.owner
      : character.name;
    $("#rosterDetailPosition").textContent =
      (rosterDetail.index + 1) + " / " + rosterDetail.entries.length;
    const prev = $("#rosterDetailPrev");
    const next = $("#rosterDetailNext");
    /* Prev/next et le compteur de position partagent un même conteneur : sans
       rien à parcourir (l'Analyse n'a qu'une entrée), on masque tout le bloc
       plutôt que de laisser des flèches inertes visibles — une promesse non
       tenue. */
    const nav = prev.parentElement;
    if(nav) nav.hidden = !rosterDetail.showNavigation;
    /* Le navigateur retire le focus d'un bouton dès qu'il devient `disabled` :
       on note qui l'avait AVANT de désactiver, puis on le rend au contrôle
       encore utilisable plutôt que de le perdre sur le body. */
    const active = document.activeElement;
    prev.disabled = rosterDetail.index <= 0;
    next.disabled = rosterDetail.index >= rosterDetail.entries.length - 1;
    if((active === prev || active === next) && active.disabled){
      const fallback = active === prev ? next : prev;
      (fallback.disabled ? $("#rosterDetailClose") : fallback).focus();
    }
    const hero = rosterDetail.type
      ? rosterHeroSnapshot(entry, rosterDetail.type)
      : normalizeHero({ char:entry.charId, potentiel:{tier:entry.potentialTier} });
    body.appendChild(heroDetail(hero, {
      badgesFor:()=>rosterDetailWeaponSwitch(entry)
    }));
    if(!types.length){
      body.appendChild(el("p",{
        class:"roster-detail-hint",
        text:"Ce membre n’a enregistré aucun build pour ce personnage."
      }));
    }
  }

  /* Point d'entrée explicite : le Roster indexe sur sa propre liste affichée,
     mais l'Analyse (une seule fiche, aucune liste) n'a pas cet index. Les deux
     passent désormais par le même contexte plutôt que par un second chemin
     parallèle dans la modale. */
  function openRosterDetailFor(context){
    if(!context || !Array.isArray(context.entries) || !context.entries.length){
      return;
    }
    /* Capturé avant tout rendu : `renderRosterDetail()` ne déplace pas le
       focus sur un premier affichage, mais le rendre explicite ici évite de
       dépendre implicitement de l'ordre d'exécution pour la restitution. */
    const trigger = document.activeElement;
    rosterDetail.entries = context.entries;
    rosterDetail.index = Math.min(
      Math.max(context.index || 0, 0), context.entries.length - 1
    );
    /* `rosterDetail.type` est une clé de DOSSIER : c'est ce que
       `rosterHeroSnapshot(entry, type)` attend. Le contexte parle en enums.
       La conversion est obligatoire ; l'oublier ouvre un build introuvable. */
    rosterDetail.type = context.weaponType
      ? (ENUM_TO_FOLDER[context.weaponType] || null)
      : null;
    rosterDetail.owner = context.memberName || rosterDetailOwnerLabel();
    rosterDetail.weaponTypes = context.weaponTypes || null;
    rosterDetail.showNavigation = context.showNavigation !== false;
    rosterDetail.returnFocusKey = context.returnFocusKey || null;
    renderRosterDetail();
    ModalStack.open(
      $("#rosterDetailOverlay"), "#rosterDetailClose", closeRosterDetail, trigger
    );
  }

  function moveRosterDetail(step){
    const next = rosterDetail.index + step;
    if(next < 0 || next >= rosterDetail.entries.length) return;
    rosterDetail.index = next;
    rosterDetail.type = null;
    renderRosterDetail();
  }

  function closeRosterDetail(){
    ModalStack.close($("#rosterDetailOverlay"));
  }

  $("#rosterDetailClose").addEventListener("click", closeRosterDetail);
  $("#rosterDetailPrev").addEventListener("click", ()=>moveRosterDetail(-1));
  $("#rosterDetailNext").addEventListener("click", ()=>moveRosterDetail(1));
  $("#rosterDetailOverlay").addEventListener("click", event => {
    if(event.target === $("#rosterDetailOverlay")) closeRosterDetail();
  });
  $("#rosterDetailOverlay").addEventListener("keydown", event => {
    if(event.key === "ArrowLeft"){ event.preventDefault(); moveRosterDetail(-1); }
    else if(event.key === "ArrowRight"){ event.preventDefault(); moveRosterDetail(1); }
  });

export { openRosterDetailFor, rosterDetail, rosterDetailOwnerLabel };
