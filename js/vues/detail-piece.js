/* L'apport d'une piece d'equipement, dans sa propre modale.

   Elle s'ouvre PAR-DESSUS la modale d'equipe ou de roster : ModalStack pose
   son verrou de defilement a la premiere ouverture et ne le leve qu'a la
   derniere, donc l'empilement est deja gere.

   Le rendu passe par la chaine d'affichage des editeurs — familles, totaux,
   ventilation par terme — pour que le membre y retrouve une presentation
   qu'il connait. Ce module n'invente aucun balisage de statistique.

   L'ordre du parcours vient de metier/stats-calcul.js : il est pur, teste,
   et c'est lui qui donne son sens a la position affichee. */

import { $, el } from "../noyau/dom.js";
import { nameOfFile } from "../metier/catalogue.js";
import { groupBuildStatResults } from "../metier/stats-calcul.js";
import { ModalStack } from "./modal-stack.js";
import {
  BUILD_STAT_FAMILY_LABELS,
  formatBuildStatValue,
  gearTermLabel,
  statTermsDetails
} from "./stats-affichage.js";

  const pieceDetail = { entries:[], index:0 };

  function titleOf(entry){
    if(!entry) return "Pièce";
    if(entry.slot === "set") return "Bonus d’ensemble";
    return entry.file ? nameOfFile(entry.file) : entry.slot;
  }

  function renderPieceDetail(){
    const entry = pieceDetail.entries[pieceDetail.index];
    const body = $("#pieceDetailBody");
    body.innerHTML = "";
    $("#pieceDetailTitle").textContent = titleOf(entry);
    $("#pieceDetailPosition").textContent =
      (pieceDetail.index + 1) + " / " + pieceDetail.entries.length;

    /* Le navigateur retire le focus d'un bouton des qu'il devient
       `disabled` : on note qui l'avait AVANT de desactiver, puis on le rend
       au controle encore utilisable plutot que de le perdre sur le body. */
    const prev = $("#pieceDetailPrev");
    const next = $("#pieceDetailNext");
    const active = document.activeElement;
    prev.disabled = pieceDetail.index <= 0;
    next.disabled = pieceDetail.index >= pieceDetail.entries.length - 1;
    if((active === prev || active === next) && active.disabled){
      const fallback = active === prev ? next : prev;
      (fallback.disabled ? $("#pieceDetailClose") : fallback).focus();
    }

    if(!entry || !entry.terms.length){
      body.appendChild(el("p",{
        class:"weapon-stats-state",
        text:"Cette pièce n’est pas encore configurée."
      }));
      return;
    }
    groupBuildStatResults(entry).forEach(group => {
      const family = el("section",{class:"weapon-stats-family"});
      family.appendChild(el("h4",{
        class:"weapon-stats-family-title",
        text:BUILD_STAT_FAMILY_LABELS[group.family] || group.family
      }));
      group.stats.forEach(stat => {
        const node = el("div",{class:"weapon-stat"});
        node.appendChild(el("div",{class:"weapon-stat-head"},[
          el("span",{text:stat.label}),
          el("span",{
            class:"weapon-stat-total",
            dataset:{unit:stat.unit},
            text:formatBuildStatValue(stat.value, stat.unit)
              +(stat.unit === "flat" ? " points" : "")
          })
        ]));
        node.appendChild(statTermsDetails(stat, {
          termLabel:gearTermLabel,
          termValue:term => formatBuildStatValue(term.value, term.unit),
          termProvenance:term => term.source.component
        }));
        family.appendChild(node);
      });
      body.appendChild(family);
    });
  }

  function movePieceDetail(step){
    const next = pieceDetail.index + step;
    if(next < 0 || next >= pieceDetail.entries.length) return;
    pieceDetail.index = next;
    renderPieceDetail();
  }

  function closePieceDetail(){
    ModalStack.close($("#pieceDetailOverlay"));
  }

  function openPieceDetail(entries, index, restoreFocus){
    if(!Array.isArray(entries) || !entries.length) return;
    pieceDetail.entries = entries;
    pieceDetail.index = Math.max(0, Math.min(index, entries.length - 1));
    renderPieceDetail();
    ModalStack.open(
      $("#pieceDetailOverlay"),
      "#pieceDetailClose",
      closePieceDetail,
      restoreFocus
    );
  }

  $("#pieceDetailPrev").addEventListener("click", ()=>movePieceDetail(-1));
  $("#pieceDetailNext").addEventListener("click", ()=>movePieceDetail(1));
  $("#pieceDetailClose").addEventListener("click", closePieceDetail);
  $("#pieceDetailOverlay").addEventListener("click", event => {
    if(event.target === $("#pieceDetailOverlay")) closePieceDetail();
  });

export { openPieceDetail };
