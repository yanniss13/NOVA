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
import {
  fixedStatsOf,
  groupBuildStatResults,
  randomRollsFor
} from "../metier/stats-calcul.js";
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

  /* La vignette de la piece, a cote de son nom : c'est elle que le membre
     reconnait dans le jeu, bien avant le libelle du catalogue. Elle reprend
     les codes couleur de la fiche — bord dore pour l'arme, rouge pour un
     bijou. Le bonus d'ensemble n'a pas d'image : il n'est pas une piece. */
  function renderPieceThumb(entry){
    const thumb = $("#pieceDetailThumb");
    const domain = entry ? entry.domain : "";
    thumb.className = "eq-thumb piece-detail-thumb"
      +(domain === "weapon" || domain === "jewel" ? " "+domain : "");
    thumb.hidden = !(entry && entry.file);
    thumb.style.backgroundImage = entry && entry.file
      ? "url('"+entry.file.replace(/'/g,"%27")+"')"
      : "";
  }

  /* Les gravures, presentees comme dans le jeu : le libelle, puis une jauge
     avec sa valeur a droite.

     La jauge vit ici et NON a cote des statistiques agregees plus bas. Une
     statistique agregee peut melanger une part venue du niveau et une part
     tiree au sort ; y coller une jauge bornee par le seul tirage afficherait
     un remplissage faux. Ici chaque ligne est un tirage et un seul.

     `aria-hidden` sur la jauge : la valeur juste a cote la dit deja en
     toutes lettres, et un lecteur d'ecran n'a que faire du remplissage. */
  function randomRollNode(tirage){
    const remplissage = el("span",{class:"roll-gauge-fill"});
    remplissage.style.width = Math.round(tirage.ratio * 100)+"%";
    const jauge = el("div",{class:"roll-gauge", "aria-hidden":"true"},[remplissage]);
    return el("div",{class:"roll-line"},[
      el("div",{class:"roll-label", text:tirage.label}),
      el("div",{class:"roll-track"},[
        jauge,
        el("span",{
          class:"roll-value",
          text:formatBuildStatValue(tirage.value, tirage.unit)
            +(tirage.unit === "flat" ? " points" : "")
        })
      ])
    ]);
  }

  /* Le jeu ne nomme pas la meme chose des deux cotes : une arme porte des
     « enchantements », une piece d'equipement une « gravure ». Reprendre son
     vocabulaire evite au membre d'avoir a traduire. */
  function rollsTitle(entry, nombre){
    if(entry && entry.domain === "weapon"){
      return nombre > 1 ? "Enchantements" : "Enchantement";
    }
    return nombre > 1 ? "Gravures" : "Gravure";
  }

  function randomRollsSection(entry, tirages){
    const section = el("section",{class:"weapon-stats-family roll-section"});
    section.appendChild(el("h4",{
      class:"weapon-stats-family-title",
      text:rollsTitle(entry, tirages.length)
    }));
    tirages.forEach(tirage => section.appendChild(randomRollNode(tirage)));
    return section;
  }

  function renderPieceDetail(){
    const entry = pieceDetail.entries[pieceDetail.index];
    const body = $("#pieceDetailBody");
    body.innerHTML = "";
    renderPieceThumb(entry);
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
    /* L'ordre du jeu : les statistiques fixes de la piece d'abord, les
       tirages ensuite. Et les deux parts sont DISJOINTES — `fixedStatsOf`
       retire les termes tires au sort — donc un meme apport n'apparait
       jamais dans les deux sections. */
    groupBuildStatResults(fixedStatsOf(entry)).forEach(group => {
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

    const tirages = randomRollsFor(entry);
    if(tirages.length) body.appendChild(randomRollsSection(entry, tirages));
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
