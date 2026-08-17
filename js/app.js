/* Le point d'assemblage du site.

   Ce fichier ne dessine rien. Il declare les onglets aupres du registre
   de vues/navigation.js, affiche la banniere de donnees, puis lance le
   Builder et la session. Tout le reste vit dans js/, range en cinq couches :
   lis js/ARCHITECTURE.md.

   Les `import` precedent l'IIFE : ils vivent au niveau du module, pas dans sa
   portee interne. Ils suivent l'ordre de MODULES (tests/helpers/modules.js). */

import { DATA, POT } from "./noyau/constantes.js";
import { buildStatsReady, ensureBuildStats } from "./noyau/catalogue-build.js";
import { $ } from "./noyau/dom.js";
import { enregistrerVue } from "./vues/navigation.js";
import { renderAvailabilityView } from "./vues/dispos.js";
import { renderBossView } from "./vues/boss-sessions.js";
import { renderBuilder } from "./vues/builder.js";
import { renderMemberRoster } from "./vues/roster-membres.js";
import { renderAnalyse } from "./vues/analyse.js";
import { renderRoster } from "./vues/roster-equipes.js";
import { renderDashboardView } from "./vues/suivi.js";
import { renderCollection } from "./vues/collection.js";
import { renderCalculateur } from "./vues/calculateur.js";
import { renderWiki } from "./vues/wiki.js";
/* Importe pour effet de bord : il branche la fiche sur wiki.js. */
import "./vues/wiki-fiche-heros.js";
import "./vues/wiki-fiche-objet.js";
import { initAuth } from "./vues/session-auth.js";
import { toast } from "./vues/toast.js";

(function(){
  "use strict";

  if(!DATA){
    document.getElementById("heroGrid").innerHTML =
      '<div class="empty-state"><p class="big">data.js introuvable</p>' +
      '<p>Lance <b>scripts/generate-data.ps1</b> puis recharge la page.</p></div>';
    return;
  }

  /* ============================ Navigation onglets ============================ */
  const withBuildStats = renderer => () => {
    const render = () => Promise.resolve(renderer()).then(()=>true);
    if(buildStatsReady()) return render();
    return ensureBuildStats()
      .then(render)
      .catch(()=>{
        toast("Catalogue chiffré indisponible.", true);
        return false;
      });
  };
  /* Chaque vue s'annonce au registre de vues/navigation.js. L'enveloppe dit ce
     que `showView` doit renvoyer : les trois vues enveloppees ici renvoyaient
     deja `true` quel que soit leur resultat, seul le rendu comptait. */
  enregistrerVue("dashboard", renderDashboardView);
  enregistrerVue("builder", withBuildStats(renderBuilder));
  enregistrerVue("roster", withBuildStats(renderRoster));
  enregistrerVue("member-roster", withBuildStats(renderMemberRoster));
  enregistrerVue("analyse", withBuildStats(renderAnalyse));
  enregistrerVue("boss", renderBossView);
  enregistrerVue("availability", renderAvailabilityView);
  enregistrerVue("wiki", withBuildStats(renderWiki));
  enregistrerVue("collection", withBuildStats(renderCollection));
  enregistrerVue("calculateur", withBuildStats(renderCalculateur));

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
