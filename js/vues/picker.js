/* Picker reutilisable : la modale de selection partagee par les vues. */

import { $, el, norm } from "../noyau/dom.js";
import { ModalStack } from "./modal-stack.js";

  /* ============================ Picker réutilisable ============================ */
  const Picker = (function(){
    const overlay = $("#overlay"), grid = $("#pickerGrid"), chipsBox = $("#pickerChips"),
          search = $("#pickerSearch"), titleEl = $("#pickerTitle");
    let groups=null, flat=null, activeGroup="__all__", current=null, onPick=null,
        portrait=false, emptyHint="", allowNone=true;

    function open(cfg){
      titleEl.textContent = cfg.title || "Choisir";
      groups = cfg.groups || null;
      flat = cfg.items || null;
      current = cfg.value || null;
      onPick = cfg.onSelect;
      portrait = !!cfg.portrait;
      emptyHint = cfg.emptyHint || "";
      allowNone = cfg.allowNone !== false;
      activeGroup = "__all__";
      search.value = "";
      renderChips();
      renderGrid();
      ModalStack.open(overlay, "#pickerSearch", close);
    }
    function close(){
      const trigger = ModalStack.close(overlay);
      onPick=null;
      return trigger;
    }

    function renderChips(){
      chipsBox.innerHTML = "";
      if(!groups){ chipsBox.style.display="none"; return; }
      chipsBox.style.display="flex";
      const keys = ["__all__", ...Object.keys(groups)];
      keys.forEach(k=>{
        chipsBox.appendChild(el("button",{
          class:"chip"+(k===activeGroup?" active":""),
          text: k==="__all__" ? "Tous" : k,
          onclick:()=>{ activeGroup=k; renderChips(); renderGrid(); }
        }));
      });
    }

    function currentItems(){
      if(flat) return flat;
      if(activeGroup==="__all__") return Object.values(groups).flat();
      return groups[activeGroup] || [];
    }

    function renderGrid(){
      const q = norm(search.value);
      const items = currentItems().filter(it => !q || norm(it.name).includes(q));
      grid.innerHTML = "";

      if(allowNone){
        grid.appendChild(el("button",{class:"tile none",onclick:()=>pick(null)},[
          el("div",{class:"tile-img",text:"∅"}),
          el("div",{class:"tile-name",text:"Aucun"})
        ]));
      }

      if(!items.length){
        grid.appendChild(el("div",{class:"picker-empty",
          text: q ? "Rien trouvé." : (emptyHint || "Aucun élément disponible.")}));
        return;
      }
      items.forEach(it=>{
        const val = it.value!=null ? it.value : it.file;
        const tile = el("button",{
          class:"tile"+(portrait?" portrait-tile":"")+(val===current?" selected":""),
          title: it.name,
          onclick:()=>pick(val)
        },[
          el("div",{class:"tile-img"},[ el("img",{src:it.file, alt:it.name, loading:"lazy"}) ]),
          el("div",{class:"tile-name",text:it.name})
        ]);
        grid.appendChild(tile);
      });
    }

    function pick(val){
      const callback = onPick;
      const trigger = close();
      if(callback) callback(val, trigger);
    }

    search.addEventListener("input", renderGrid);
    $("#pickerClose").addEventListener("click", close);
    overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });

    return { open };
  })();

export { Picker };
