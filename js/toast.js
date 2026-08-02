/* Le bandeau de notification, partage par toutes les vues.

   34 declarations de js/app.js l'appellent : c'est la raison d'etre de ce
   module minuscule. `toastTimer` reste prive, personne d'autre n'a a le
   connaitre. */

import { $ } from "./dom.js";

  /* ============================ Toast ============================ */
  let toastTimer;
  function toast(msg, isErr){
    const t = $("#toast");
    t.textContent = msg;
    t.setAttribute("role", isErr ? "alert" : "status");
    t.setAttribute("aria-live", isErr ? "assertive" : "polite");
    t.classList.toggle("err", !!isErr);
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>t.classList.remove("on"), 2600);
  }

export {
  toast
};
