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
import { metaOf } from "../noyau/constantes.js";
import { canManageTeam, sessionCourante } from "../etat/session.js";
import { MemberRosterStore } from "../donnees/roster-store.js";
import { equippedEnumOf, weaponFolderOf } from "../metier/armes.js";
import { calculateHeroStats } from "../metier/stats-calcul.js";
import { termesDEquipe } from "../metier/potentiels-equipe.js";
import { ModalStack } from "./modal-stack.js";
import { heroDetail } from "./fiche-heros.js";

  /* L'element vient de l'ARME equipee, jamais du personnage. Piege documente
     dans AGENTS.md, et la raison pour laquelle un potentiel restreint a un
     element ne peut pas se decider a l'echelle de l'equipe. */
  function elementDuHerosDEquipe(hero){
    const meta = hero && hero.char ? metaOf(hero.char) : null;
    const equipee = equippedEnumOf(hero);
    const slot = meta && meta.weapons
      ? meta.weapons.find(w => w.weapon === equipee) : null;
    return slot && slot.element ? String(slot.element).toLowerCase() : null;
  }

  /* Une statistique d'un coequipier, ou null quand son build n'est pas
     calculable. `termesDEquipe` ecarte alors la ligne plutot que de servir un
     chiffre invente. */
  function statDeCoequipier(hero, code){
    const result = calculateHeroStats(hero);
    if(!result || (result.status !== "valid" && result.status !== "partial")){
      return null;
    }
    const total = result.totals.find(item => item.stat === code);
    return total && Number.isFinite(total.value) ? total.value : null;
  }

  /* CE QUE LES COEQUIPIERS DONNENT, heros par heros.

     Les porteurs sont montes UNE FOIS - chaque `calculateHeroStats` coute -
     puis relus pour chacun : seul `estLeHeros` change d'un heros a l'autre, et
     l'element avec lui. */
  function apportsDEquipe(heroes){
    const liste = Array.isArray(heroes) ? heroes.filter(Boolean) : [];
    const porteurs = liste.map(hero => ({
      hero,
      charId:hero.char,
      typeArme:weaponFolderOf(hero.weapon),
      palier:hero.potentiel ? hero.potentiel.tier : null,
      atk:statDeCoequipier(hero, "B_Atk"),
      def:statDeCoequipier(hero, "B_Def")
    }));
    return hero => termesDEquipe({
      element:elementDuHerosDEquipe(hero),
      porteurs:porteurs.map(porteur => Object.assign({}, porteur, {
        estLeHeros:porteur.hero === hero
      }))
    });
  }

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
    settings.termesEquipePour = apportsDEquipe(t.heroes || []);
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
