/* Le point d'assemblage du site.

   Ce fichier ne dessine rien. Il declare les sept onglets aupres du registre
   de vues/navigation.js, affiche la banniere de donnees, puis lance le
   Builder et la session. Tout le reste vit dans js/, range en cinq couches :
   lis js/ARCHITECTURE.md.

   Les `import` precedent l'IIFE : ils vivent au niveau du module, pas dans sa
   portee interne. Ils suivent l'ordre de MODULES (tests/helpers/modules.js). */

import { DATA, POT } from "./noyau/constantes.js";
import { $ } from "./noyau/dom.js";
import { enregistrerVue } from "./vues/navigation.js";
import { renderAvailabilityView } from "./vues/dispos.js";
import { renderBossView } from "./vues/boss-sessions.js";
import { renderBuilder } from "./vues/builder.js";
import { renderMemberRoster } from "./vues/roster-membres.js";
import { renderAnalyse } from "./vues/analyse.js";
import { renderRoster } from "./vues/roster-equipes.js";
import { renderDashboardView } from "./vues/suivi.js";
import { initAuth } from "./vues/session-auth.js";

(function(){
  "use strict";

  if(!DATA){
    document.getElementById("heroGrid").innerHTML =
      '<div class="empty-state"><p class="big">data.js introuvable</p>' +
      '<p>Lance <b>generate-data.ps1</b> puis recharge la page.</p></div>';
    return;
  }

  /* ============================ Navigation onglets ============================ */
  /* Chaque vue s'annonce au registre de vues/navigation.js. L'enveloppe dit ce
     que `showView` doit renvoyer : les trois vues enveloppees ici renvoyaient
     deja `true` quel que soit leur resultat, seul le rendu comptait. */
  enregistrerVue("dashboard", renderDashboardView);
  enregistrerVue("builder", ()=>{ renderBuilder(); return true; });
  enregistrerVue("roster", ()=>Promise.resolve(renderRoster()).then(()=>true));
  enregistrerVue("member-roster",
    ()=>Promise.resolve(renderMemberRoster()).then(()=>true));
  enregistrerVue("analyse", ()=>Promise.resolve(renderAnalyse()).then(()=>true));
  enregistrerVue("boss", renderBossView);
  enregistrerVue("availability", renderAvailabilityView);

  /* ============================ Démarrage ============================ */
  $("#databar").textContent =
    (DATA.personnages||[]).length + " héros · " +
    Object.keys(DATA.armes||{}).length + " types d'armes · " +
    Object.keys(DATA.armures||{}).length + " emplacements d'armure · " +
    Object.values(DATA.bijoux||{}).reduce((n,l)=>n+l.length,0) + " bijoux · " +
    Object.keys(POT).length + " persos avec potentiels" +
    (DATA.generatedAt ? "  ·  données du "+DATA.generatedAt : "");

  renderBuilder();
  void initAuth();
})();
