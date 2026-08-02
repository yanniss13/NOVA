/* Petites briques de rendu partagees par le Builder, le Roster et les
   editeurs de configuration.

   `renderBonus` produit du HTML a partir du texte de bonus du jeu, qui porte
   ses propres marqueurs de couleur `[#RRGGBB]…[-]`. L'echappement vient
   AVANT la conversion des marqueurs : sans cela, un nom de bonus contenant
   un chevron injecterait du balisage. */

import { el } from "../noyau/dom.js";
import { nameOfFile } from "../metier/catalogue.js";

  function gearThumb(file){
    const box = el("div",{class:"gear-thumb"});
    if(file) box.appendChild(el("img",{src:file, alt:"", loading:"lazy"}));
    else box.textContent = "+";
    return box;
  }

  function gearSlot(label, file, isWeapon, onclick, extraClass, slotKey){
    return el("button",{
      class:"gear-slot"+(isWeapon?" weapon":"")+(extraClass?" "+extraClass:"")+(file?" filled":""),
      type:"button",
      title:(isWeapon?"Arme":label)+(file?" : "+nameOfFile(file):""),
      dataset:slotKey ? {slot:slotKey} : undefined,
      onclick
    },[
      gearThumb(file),
      el("span",{class:"gear-label", text:label})
    ]);
  }

  function renderBonus(str){
    const esc = (str||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    return esc
      .replace(/\[#([0-9A-Fa-f]{6})\]/g, '<span style="color:#$1">')
      .replace(/\[-\]/g, "</span>")
      .replace(/\n/g, "<br>");
  }

export {
  gearSlot,
  renderBonus
};
