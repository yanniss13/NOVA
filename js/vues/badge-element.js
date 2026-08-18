/* Le badge d'element : une pastille coloree suivie de son libelle.

   Il vivait dans `analyse.js`, mais le recensement en a besoin autant que la
   matrice. Le sortir ici evite que le module extrait reimporte son ancien
   parent, ce que la regle de couches de `tests/helpers/modules.js` interdit. */

import { ELEMENTS } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";

  const elemLabel = e => e==="HOLY" ? "Lumière" : (ELEMENTS[e] ? ELEMENTS[e].label : (e||"—"));
  const elemColor = e => ELEMENTS[e] ? ELEMENTS[e].color : "#8a8a8a";

  function elemBadge(e){
    const b = el("span",{class:"elem-badge", title:elemLabel(e)});
    b.style.setProperty("--ec", elemColor(e));
    b.appendChild(el("span",{class:"dot"}));
    b.appendChild(el("span",{text:elemLabel(e)}));
    return b;
  }

export {
  elemBadge,
  elemColor,
  elemLabel
};
