/* « Meilleures runs » : le palmares des runs de boss, sous les statistiques
   de la semaine.

   La question a laquelle il repond est celle d'un membre qui prepare sa
   semaine : « qu'ont joue ceux qui ont fait le plus ? ». Chaque run montre
   donc les equipes de TOUS ses participants — le score est celui du groupe,
   voir bossTopRuns() dans metier/boss-logique.js.

   Rien n'est lu ici : les sessions, inscriptions et rapports sont ceux que la
   vue Boss a deja charges. Changer de periode ne fait aucune requete et ne
   reconstruit que la liste, pour que le focus reste sur le bouton presse. */

import { bossTopRuns, frDate, frDateTime } from "../metier/boss-logique.js";
import { el } from "../noyau/dom.js";
import { bossReportParticipant, bossRunCarte } from "./equipe-boss.js";

  const MEILLEURES_RUNS_LIMITE = 5;

  /* `null` tant que le membre n'a rien choisi : la semaine si elle a deja un
     rapport, sinon tout l'historique. Un palmares vide le lundi matin
     n'apprendrait rien a personne. Une fois choisie, la periode tient d'un
     rendu a l'autre — un evenement Realtime ne doit pas la lui reprendre. */
  let meilleuresRunsPeriode = null;

  function meilleureRunCarte(row, periode){
    const { group, report, members } = row;
    const quand = periode === "all"
      ? "Semaine du "+frDate(group.week_start)
      : (group.completed_at ? "Terminée le "+frDateTime(group.completed_at) : "");
    return bossRunCarte({
      rang:row.rank,
      premier:row.rank === 1,
      score:row.score,
      meta:group.title+" · Run "+(group.run_no || 1)+(quand ? " · "+quand : ""),
      note:report.note,
      equipes:members.map(member => bossReportParticipant(member)),
      vide:"Participants non disponibles pour cette run.",
      /* Jamais `sessionId` : dans la vue Boss, `data-session-id` designe la
         carte d'un groupe ou d'un rapport, et « Mon suivi » y cherche la
         premiere qui porte l'identifiant. Place au-dessus, le palmares la
         lui volerait. */
      dataset:{bestRunId:group.id}
    });
  }

  function remplirMeilleuresRuns(liste, lignes, periode){
    liste.innerHTML = "";
    if(!lignes.length){
      liste.appendChild(el("li",{
        class:"boss-run-cards-empty",
        text:periode === "week"
          ? "Aucune run rapportée cette semaine pour l’instant."
          : "Les meilleures runs apparaîtront ici dès le premier rapport de score."
      }));
      return;
    }
    lignes.forEach(row => liste.appendChild(meilleureRunCarte(row, periode)));
  }

  function bossMeilleuresRunsBlock(groups, reports, membership, weekStart){
    const lignesDe = periode => bossTopRuns(groups, reports, membership, {
      weekStart:periode === "week" ? weekStart : null,
      limit:MEILLEURES_RUNS_LIMITE
    });
    let periode = meilleuresRunsPeriode;
    if(!periode) periode = lignesDe("week").length ? "week" : "all";

    const liste = el("ol",{class:"boss-run-cards"});
    const boutons = [
      ["week", "Cette semaine"],
      ["all", "Toutes les semaines"]
    ].map(([valeur, libelle]) => el("button",{
      class:"boss-best-runs-period",
      type:"button",
      dataset:{periode:valeur},
      "aria-pressed":String(valeur === periode),
      text:libelle
    }));
    boutons.forEach(bouton => bouton.addEventListener("click", ()=>{
      periode = meilleuresRunsPeriode = bouton.dataset.periode;
      boutons.forEach(autre =>
        autre.setAttribute("aria-pressed", String(autre === bouton))
      );
      remplirMeilleuresRuns(liste, lignesDe(periode), periode);
    }));
    remplirMeilleuresRuns(liste, lignesDe(periode), periode);

    return el("section",{
      class:"boss-stats boss-best-runs",
      "aria-labelledby":"bossBestRunsTitle"
    },[
      el("div",{class:"boss-stats-head"},[
        el("div",{},[
          el("h2",{
            class:"boss-stats-title",
            id:"bossBestRunsTitle",
            text:"Meilleures runs"
          }),
          el("p",{
            class:"boss-best-runs-hint",
            text:"Le score est celui du groupe : chaque run montre les équipes de tous ses participants."
          })
        ]),
        el("div",{
          class:"boss-best-runs-periods",
          role:"group",
          "aria-label":"Période du classement"
        }, boutons)
      ]),
      liste
    ]);
  }

export { bossMeilleuresRunsBlock };
