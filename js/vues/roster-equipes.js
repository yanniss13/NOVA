/* L'onglet Roster : les equipes enregistrees, celles du membre et celles de
   la confrerie.

   Ne pas confondre avec roster-membres.js : celui-la montre les PERSONNAGES
   d'un membre, celui-ci montre ses EQUIPES. Les deux onglets s'appellent
   « roster » dans l'interface pour des raisons historiques.

   Chaque carte d'equipe delegue l'affichage detaille a detail-equipe.js et
   l'edition au Builder. Ce module ne fait que la liste, le filtre par membre
   et les actions de gestion — modifier, dupliquer, supprimer. */

import { Store } from "../donnees/equipes-store.js";
import { brouillonEquipe } from "../etat/brouillon-equipe.js";
import { canManageTeam, sessionCourante } from "../etat/session.js";
import { charOf, nameOfFile } from "../metier/catalogue.js";
import { normalizeTeam, normalizeTeamName } from "../metier/equipe-modele.js";
import { $, el, initials, uid } from "../noyau/dom.js";
import { authMessage } from "../noyau/supabase-client.js";
import {
  renderBuilder,
  resetBuilderRosterBaselines,
  teamNameInput
} from "./builder.js";
import { openTeamDetail } from "./detail-equipe.js";
import { badgesRow } from "./fiche-heros.js";
import { showView } from "./navigation.js";
import { toast } from "./toast.js";

  const rosterGrid = $("#rosterGrid");
  let rosterRenderId = 0;

  async function renderRoster(){
    const renderId = ++rosterRenderId;
    rosterGrid.className = "";
    rosterGrid.innerHTML = "";
    rosterGrid.appendChild(el("div",{class:"empty-state"},[
      el("p",{class:"big",text:"Chargement des équipes…"})
    ]));
    let teams;
    try{
      teams = await Store.refresh();
    }catch(error){
      teams = Store.all();
      toast("Registre indisponible, affichage du cache local.", true);
    }
    if(renderId !== rosterRenderId) return;
    teams = teams.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const c = $("#rosterCount");
    c.innerHTML = "<b>"+teams.length+"</b> équipe"+(teams.length>1?"s":"")+" enregistrée"+(teams.length>1?"s":"");

    rosterGrid.className = teams.length ? "roster-grid" : "";
    rosterGrid.innerHTML = "";

    if(!teams.length){
      rosterGrid.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Aucune équipe pour l'instant"}),
        el("p",{text:"Va dans « Créer une équipe » pour proposer ta première compo face au Boss de Guilde."})
      ]));
      return;
    }
    teams.forEach(t=>rosterGrid.appendChild(teamCard(t)));
  }

  function teamCard(t){
    /* Avec un nom, il devient la ligne principale et le pseudo passe dessous.
       Sans nom, on garde exactement l'apparence d'avant. */
    const who = el("div",{class:"team-who"});
    if(t.name){
      who.appendChild(el("span",{class:"team-name", text:t.name}));
      who.appendChild(el("span",{class:"team-pseudo", text:t.pseudo || "Sans pseudo"}));
    }else{
      who.appendChild(el("span",{class:"team-pseudo", text:t.pseudo || "Sans pseudo"}));
    }
    who.appendChild(el("span",{class:"team-date",
      text: t.updatedAt ? new Date(t.updatedAt).toLocaleDateString("fr-FR") : ""}));
    const head = el("div",{class:"team-head"},[
      el("div",{class:"seal", text:initials(t.pseudo)}),
      who
    ]);

    const heroes = el("div",{class:"team-heroes clickable", title:"Voir l'équipement",
      onclick:()=>openTeamDetail(t)});
    (t.heroes||[]).forEach(h=>heroes.appendChild(miniHero(h)));

    const hint = el("button",{class:"team-detail-btn", type:"button",
      text:"Voir l'équipement ▾", onclick:()=>openTeamDetail(t)});

    /* « Dupliquer » est offert sur toute équipe : le registre est partagé, et la
       copie est un brouillon indépendant qu'il faudra enregistrer soi-même.
       Modifier et Supprimer restent réservés au propriétaire. */
    const actions = el("div",{class:"team-actions"},[
      el("button",{
        class:"btn",
        type:"button",
        dataset:{ teamAction:"duplicate" },
        text:"Dupliquer",
        onclick:()=>duplicateTeam(t)
      })
    ]);
    if(canManageTeam(t)){
      actions.appendChild(el("button",{
        class:"btn",
        type:"button",
        dataset:{ teamAction:"edit" },
        text:"Modifier",
        onclick:()=>editTeam(t)
      }));
      actions.appendChild(el("button",{
        class:"btn btn-danger",
        type:"button",
        dataset:{ teamAction:"delete" },
        text:"Supprimer",
        onclick:()=>void deleteTeam(t)
      }));
    }
    return el("div",{class:"team"},[head, heroes, hint, actions]);
  }

  function miniHero(h){
    const ch = h && h.char ? charOf(h.char) : null;

    const portrait = el("div",{class:"mini-portrait"});
    if(ch) portrait.appendChild(el("img",{src:ch.file, alt:ch.name, loading:"lazy"}));
    else portrait.textContent = "—";

    const name = el("div",{class:"mini-name"+(ch?"":" empty"), text: ch ? ch.name : "Libre"});
    const badges = badgesRow(ch, h, true);

    const kids = [portrait, name];
    if(badges) kids.push(badges);
    const p = h && h.potentiel;
    if(p && p.tier > 0){
      kids.push(el("div",{class:"mini-pot", title:"Potentiel",
        text:"✦ P"+p.tier}));
    }
    if(h && h.note && h.note.trim()){
      kids.push(el("div",{class:"mini-note", text:h.note.trim()}));
    }
    return el("div",{class:"mini"}, kids);
  }

  function gearIcon(file, variant){
    const d = el("div",{class:"icn"+(variant?" "+variant:"")+(file?"":" empty")});
    if(file){ d.style.backgroundImage = "url('"+file.replace(/'/g,"%27")+"')"; d.title = nameOfFile(file); }
    else d.title = variant==="weapon" ? "Pas d'arme" : "Vide";
    return d;
  }

  function editTeam(t){
    if(!canManageTeam(t)){
      toast("Cette équipe appartient à un autre membre.", true);
      return;
    }
    brouillonEquipe.equipe = normalizeTeam(JSON.parse(JSON.stringify(t)));
    brouillonEquipe.sourceMaj = Number(brouillonEquipe.equipe.updatedAt) || 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    brouillonEquipe.edition = true;
    resetBuilderRosterBaselines();
    renderBuilder();
    showView("builder");
    toast("Équipe chargée pour modification.");
  }

  /* Duplication : un brouillon indépendant, jamais une écriture immédiate.
     Nouvel identifiant, hors mode édition, et le pseudo devient le mien — la
     copie m'appartiendra dès que je l'enregistrerai. Rien ne part vers Supabase
     avant « Enregistrer ». */
  function duplicateTeam(t){
    const copy = normalizeTeam(JSON.parse(JSON.stringify(t)));
    copy.id = uid();
    copy.name = normalizeTeamName(
      (copy.name ? copy.name+" " : "Équipe ")+"(copie)"
    );
    copy.pseudo = sessionCourante.pseudo || copy.pseudo || "";
    delete copy.owner;
    delete copy.createdAt;
    delete copy.updatedAt;
    brouillonEquipe.equipe = copy;
    brouillonEquipe.sourceMaj = 0;
    brouillonEquipe.jsonInitial = JSON.stringify(brouillonEquipe.equipe);
    brouillonEquipe.supprimeAilleurs = false;
    brouillonEquipe.edition = false;
    resetBuilderRosterBaselines();
    renderBuilder();
    showView("builder");
    teamNameInput.focus();
    toast("Copie prête. Ajuste-la puis enregistre-la.");
  }

  async function deleteTeam(t){
    if(!canManageTeam(t)){
      toast("Cette équipe appartient à un autre membre.", true);
      return;
    }
    if(!confirm('Supprimer l\'équipe de « '+(t.pseudo||"?")+' » ?')) return;
    try{
      await Store.remove(t.id);
      await renderRoster();
      toast("Équipe supprimée.");
    }catch(error){
      toast("Suppression impossible : "+authMessage(error), true);
    }
  }

export { renderRoster };
