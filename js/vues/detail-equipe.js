/* La modale de detail d'une equipe : l'equipement complet, heros par heros.

   Elle ne dessine rien elle-meme — chaque heros passe par la fiche commune de
   vues/fiche-heros.js. Son travail est de rassembler le contexte que la fiche
   attend : a qui appartient l'equipe, et quels builds le visiteur possede
   deja, pour que le bouton d'import sache dire « ajouter » ou « mettre a jour ».

   `ownEntries` est lu une seule fois a l'ouverture, pas par heros : la modale
   affiche jusqu'a huit fiches et le roster ne bouge pas entre-temps.

   Le branchement des boutons de fermeture se fait au chargement du module,
   comme dans editeur-arme.js et picker.js : le balisage vient d'index.html,
   il existe donc avant que le module ne s'execute. */

import { $ } from "../noyau/dom.js";
import { canManageTeam, sessionCourante } from "../etat/session.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { ModalStack } from "./modal-stack.js";
import { heroDetail } from "./fiche-heros.js";

  function openTeamDetail(t){
    $("#teamTitle").textContent = t.name
      ? t.name + " — " + (t.pseudo || "Sans pseudo")
      : "Équipe — " + (t.pseudo || "Sans pseudo");
    const box = $("#teamDetail");
    box.innerHTML = "";
    const ownEntries = sessionCourante.user ? MemberRosterStore.all(sessionCourante.user.id) : [];
    const settings = {
      team:t,
      canImport:canManageTeam(t) && !!sessionCourante.user,
      hasBuild:(charId, type)=>{
        const entry = ownEntries.find(item => item.charId === charId);
        return !!entry && !!type
          && Object.prototype.hasOwnProperty.call(entry.builds, type);
      }
    };
    (t.heroes||[]).forEach(h=>box.appendChild(heroDetail(h, settings)));
    ModalStack.open($("#teamOverlay"), "#teamClose", closeTeamDetail);
  }
  function closeTeamDetail(){
    ModalStack.close($("#teamOverlay"));
  }
  $("#teamClose").addEventListener("click", closeTeamDetail);
  $("#teamOverlay").addEventListener("click", event => {
    if(event.target === $("#teamOverlay")) closeTeamDetail();
  });

export { openTeamDetail };
