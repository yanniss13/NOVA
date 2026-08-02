/* L'equipe d'un membre, telle qu'elle apparait dans les sessions de boss.

   Deux vues qui partagent le meme bandeau de portraits : la carte d'un groupe
   (« voir l'equipe de ce membre ») et la ligne d'un participant dans un
   rapport. Les deux ouvrent ensuite la modale de detail complete.

   Le bandeau reste volontairement muet : ni stats ni equipement, juste qui est
   dans l'equipe. Le detail est a un clic, et une session de boss affiche
   jusqu'a plusieurs dizaines de ces bandeaux d'un coup.

   La lecture de l'instantane n'est pas ici : elle appartient au modele
   d'equipe, qui sait accueillir une equipe venue de n'importe ou. */

import { el } from "../noyau/dom.js";
import { charOf } from "../metier/catalogue.js";
import { teamFromBossSnapshot } from "../metier/equipe-modele.js";
import { openTeamDetail } from "./detail-equipe.js";

  function bossTeamBanner(team){
    const banner = el("span",{class:"boss-team-banner"});
    (team.heroes || []).forEach(hero => {
      const character = hero && hero.char ? charOf(hero.char) : null;
      const portrait = el("span",{class:"boss-team-banner-portrait"});
      if(character){
        portrait.appendChild(el("img",{
          src:character.file,
          alt:"",
          loading:"lazy"
        }));
      }else{
        portrait.textContent = "—";
      }
      banner.appendChild(el("span",{class:"boss-team-banner-hero"},[
        portrait,
        el("span",{
          class:"boss-team-banner-name",
          text:character ? character.name : "Libre"
        })
      ]));
    });
    return banner;
  }

  function bossReportParticipant(member){
    const team = teamFromBossSnapshot(member.team_snapshot);
    const row = el("div",{class:"boss-report-participant"},[
      el("span",{
        class:"boss-report-participant-name",
        text:member.pseudo || "Membre"
      })
    ]);
    if(team){
      row.appendChild(el("button",{
        class:"boss-report-team",
        type:"button",
        "aria-label":"Voir l’équipe de "+(member.pseudo || "Membre"),
        onclick:()=>openTeamDetail(team)
      },[
        bossTeamBanner(team),
        el("span",{class:"boss-report-team-label",text:"Voir l’équipe"})
      ]));
    }else{
      row.appendChild(el("span",{
        class:"boss-report-team-missing",
        text:"Équipe non disponible"
      }));
    }
    return row;
  }

export { bossReportParticipant, bossTeamBanner };
