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
import { formatBossScore } from "../metier/boss-logique.js";
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

  /* `absent` : ce qu'on ecrit a la place de l'equipe. Une archive de boss dit
     « non disponible » — l'instantane a existe, ou pas —, une run
     d'entrainement dit « non renseignee », puisque son auteur avait le choix
     de la laisser vide. Meme ligne, meme mise en page, un seul mot change. */
  function bossReportParticipant(member, options){
    const absent = (options && options.absent) || "Équipe non disponible";
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
        text:absent
      }));
    }
    return row;
  }

  /* La carte d'une run, partagee par le palmares des sessions et l'historique
     d'entrainement : un score, sa ligne de contexte, une note facultative et
     les equipes des participants. Les deux pages montraient la meme chose
     avec deux habillages differents ; elles montrent desormais la meme.

     `equipes` recoit des noeuds deja construits : les deux appelants lisent
     des instantanes de formes differentes, et c'est tout ce qui les separe. */
  function bossRunCarte(options){
    const carte = el("li",{
      class:"boss-run-card"+(options.premier ? " is-first" : ""),
      dataset:options.dataset || {}
    });
    const tete = el("div",{class:"boss-run-card-head"});
    if(options.rang != null){
      tete.appendChild(el("span",{
        class:"boss-run-card-rank",
        "aria-label":"Rang "+options.rang,
        text:String(options.rang)
      }));
    }
    tete.appendChild(el("div",{class:"boss-run-card-score-wrap"},[
      el("strong",{class:"boss-run-card-score",text:formatBossScore(options.score)}),
      el("span",{class:"boss-run-card-meta",text:options.meta || ""})
    ]));
    (options.actions || []).forEach(action => tete.appendChild(action));
    carte.appendChild(tete);
    if(options.note){
      carte.appendChild(el("p",{class:"boss-run-card-note",text:options.note}));
    }
    const equipes = el("div",{class:"boss-report-participants boss-run-card-teams"});
    if((options.equipes || []).length){
      options.equipes.forEach(noeud => equipes.appendChild(noeud));
    }else{
      equipes.appendChild(el("p",{
        class:"boss-run-card-empty",
        text:options.vide || "Participants non disponibles pour cette run."
      }));
    }
    carte.appendChild(equipes);
    return carte;
  }

export { bossReportParticipant, bossRunCarte, bossTeamBanner };
