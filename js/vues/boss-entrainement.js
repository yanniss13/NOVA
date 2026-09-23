/* L'onglet « Entraînement » du groupe Boss.

   Une seule lecture alimente trois sous-vues locales : changer de sous-vue
   ne fait AUCUNE requête. Hors ligne, le dernier cache s'affiche avec son
   badge ; sans cache, la vue le dit — une liste vide passerait pour « aucune
   run ». */

import { EntrainementStore } from "../donnees/entrainement-store.js";
import { refreshRosterProfiles } from "../donnees/roster-profils.js";
import { sessionCourante } from "../etat/session.js";
import { formatBossScore } from "../metier/boss-logique.js";
import { charOf } from "../metier/catalogue.js";
import { resumeCourbeScores } from "../metier/courbe-scores.js";
import {
  comparaisonEquipesEntrainement, serieProgressionEntrainement,
  topRunsEntrainement, trierRunsEntrainement
} from "../metier/entrainement-boss.js";
import { $, el } from "../noyau/dom.js";
import { bossReportParticipant, bossRunCarte } from "./equipe-boss.js";
import { dessinerCourbesEnAttente, preparerCourbeScores } from "./courbe-scores.js";
import { ouvrirSaisieEntrainement } from "./modale-entrainement.js";

  const etatEntrainement = {
    vue:"historique", horsLigne:false,
    membreProgression:"", membreComparaison:""
  };

  /* frDate() n'affiche jamais l'année : les autres vues qui l'utilisent
     n'en ont pas besoin. L'historique d'entraînement, lui, n'a aucune borne
     dans le temps et affichera un jour plusieurs années : une formule locale
     l'ajoute, sans toucher à frDate() dont dépendent les autres vues. */
  function frDateEntrainement(iso){
    return iso ? new Date(iso+"T00:00:00").toLocaleDateString("fr-FR",
      { day:"numeric", month:"short", year:"numeric" }) : "";
  }

  /* Un participant de run d'entrainement est la meme ligne qu'un participant
     de rapport de boss : pseudo, bandeau de portraits, detail a un clic. Seul
     le chemin de l'instantane change — `snapshot` ici, `team_snapshot` la. */
  function participantEntrainement(run, membreId){
    const entree = run.equipes[membreId] || {};
    return bossReportParticipant(
      { pseudo:entree.pseudo, team_snapshot:entree.snapshot },
      { absent:"Équipe non renseignée" }
    );
  }

  function carteRunEntrainement(run, rang){
    const moi = sessionCourante.user && sessionCourante.user.id;
    const actions = [];
    if(moi && run.participants.includes(moi)){
      actions.push(el("button",{
        class:"btn btn-ghost training-edit", type:"button",
        dataset:{trainingRunId:run.id},
        "aria-label":"Corriger la run du "+frDateEntrainement(run.playedOn),
        onclick:()=>void ouvrirSaisieEntrainement(run,
          { apres:()=>renderTrainingView({ silencieux:true }) })
      },["Corriger"]));
    }
    return bossRunCarte({
      rang:rang == null ? null : rang,
      premier:rang === 1,
      score:run.score,
      meta:frDateEntrainement(run.playedOn)+" · saisie par "+run.createdByPseudo
        +(run.updatedByPseudo ? " · corrigée par "+run.updatedByPseudo : ""),
      note:run.note,
      equipes:run.participants.map(id => participantEntrainement(run, id)),
      vide:"Aucun participant renseigné pour cette run.",
      actions,
      dataset:{trainingRunId:run.id}
    });
  }

  function vueHistoriqueEntrainement(runs){
    if(!runs.length){
      return el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Aucune run d’entraînement"}),
        el("p",{text:"Enregistre la première avec le bouton ci-dessus."})
      ]);
    }
    return el("ol",{class:"boss-run-cards"},
      trierRunsEntrainement(runs).map(run => carteRunEntrainement(run)));
  }

  function choixMembreEntrainement(id, libelle, valeur, avecTous, onChange){
    const profils = sessionCourante.rosterProfiles || [];
    const select = el("select",{ id },
      (avecTous ? [el("option",{ value:"", text:"Toute la confrérie" })] : [])
        .concat(profils.map(p => el("option",{ value:p.id, text:p.pseudo }))));
    select.value = valeur;
    /* onChange() repeint via dessinerEntrainement(), qui fait
       corps.replaceChildren() et reconstruit ce <select> : le focus tombe
       alors sur body (piège déjà connu des filtres du roster, voir
       AGENTS.md). Le nouveau <select> porte le même id : on le retrouve et
       on lui rend le focus après coup. */
    select.addEventListener("change", () => {
      onChange(select.value);
      const reconstruit = document.getElementById(id);
      if(reconstruit) reconstruit.focus();
    });
    return el("div",{class:"training-filter"},[el("label",{ for:id, text:libelle }), select]);
  }

  /* Une date courte pour l'abscisse : l'année est déjà dans la liste
     chiffrée qui suit la courbe, et elle ferait se chevaucher les libellés. */
  function dateCourteEntrainement(iso){
    return iso ? new Date(iso+"T00:00:00")
      .toLocaleDateString("fr-FR", { day:"numeric", month:"short" }) : "";
  }

  function vueProgressionEntrainement(runs){
    /* Le module de courbe ne connaît ni run ni date : c'est ici qu'un
       `playedOn` devient un libellé lisible. */
    const serie = serieProgressionEntrainement(runs, etatEntrainement.membreProgression || null)
      .map(point => Object.assign({}, point, {
        libelle:frDateEntrainement(point.playedOn),
        libelleCourt:dateCourteEntrainement(point.playedOn)
      }));
    const bloc = el("div",{class:"training-progression"},[
      choixMembreEntrainement("trainingProgressionMember", "Runs de", etatEntrainement.membreProgression, true,
        valeur => { etatEntrainement.membreProgression = valeur; dessinerEntrainement(); })
    ]);
    if(!serie.length){
      bloc.appendChild(el("p",{class:"empty-state",text:"Aucune run pour ce choix."}));
      return bloc;
    }
    const resume = resumeCourbeScores(serie);
    bloc.appendChild(preparerCourbeScores(serie, {
      description:"Courbe des scores d’entraînement",
      resume:"Meilleur : "+formatBossScore(resume.meilleur)
        +" · Dernier : "+formatBossScore(resume.dernier)
        +" · Écart au meilleur : "+formatBossScore(resume.ecart)
    }));
    return bloc;
  }

  function nomsHerosEntrainement(heros){
    return heros.map(id => { const c = charOf(id); return c ? c.name : id; }).join(", ");
  }

  function vueClassementEntrainement(runs){
    const bloc = el("div",{class:"training-classement"});
    const top = topRunsEntrainement(runs, 10);
    bloc.appendChild(el("h2",{class:"training-subtitle",text:"Meilleures runs"}));
    bloc.appendChild(top.length
      ? el("ol",{class:"boss-run-cards"},
          top.map(({ rang, run }) => carteRunEntrainement(run, rang)))
      : el("p",{class:"empty-state",text:"Aucune run à classer."}));

    const moi = sessionCourante.user ? sessionCourante.user.id : "";
    const membre = etatEntrainement.membreComparaison || moi;
    bloc.appendChild(el("h2",{class:"training-subtitle",text:"Comparaison des équipes"}));
    bloc.appendChild(choixMembreEntrainement("trainingCompareMember", "Équipes de", membre, false,
      valeur => { etatEntrainement.membreComparaison = valeur; dessinerEntrainement(); }));
    bloc.appendChild(el("p",{class:"training-compare-caveat",
      text:"Le score est celui du groupe : les autres participants y comptent aussi."}));
    const lignes = comparaisonEquipesEntrainement(runs, membre);
    bloc.appendChild(lignes.length
      ? el("div",{class:"training-compare-wrap"},[el("table",{class:"training-compare"},[
          el("thead",{},[el("tr",{},[
            el("th",{scope:"col",text:"Équipe"}), el("th",{scope:"col",text:"Runs"}),
            el("th",{scope:"col",text:"Meilleur"}), el("th",{scope:"col",text:"Médiane"})])]),
          el("tbody",{}, lignes.map(l => el("tr",{},[
            el("th",{scope:"row",text:nomsHerosEntrainement(l.heros)}),
            el("td",{text:String(l.runs)}),
            el("td",{text:formatBossScore(l.meilleur)}),
            el("td",{text:formatBossScore(l.mediane)})])))
        ])])
      : el("p",{class:"empty-state",text:"Aucune équipe renseignée pour ce membre."}));
    return bloc;
  }

  const SOUS_VUES_ENTRAINEMENT = {
    historique:vueHistoriqueEntrainement,
    progression:vueProgressionEntrainement,
    classement:vueClassementEntrainement
  };

  function dessinerEntrainement(){
    const corps = $("#trainingBody");
    if(!corps) return;
    const runs = EntrainementStore.all();
    corps.replaceChildren();
    if(etatEntrainement.horsLigne && !EntrainementStore.aUnCache()){
      corps.appendChild(el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"L’entraînement est indisponible hors ligne"})
      ]));
    }else{
      /* Meme cadre que « Meilleures runs » dans la vue Boss : les cartes se
         detachent sur le panneau, et les deux pages se ressemblent. */
      corps.appendChild(el("section",{class:"boss-stats training-panel"},
        [SOUS_VUES_ENTRAINEMENT[etatEntrainement.vue](runs)]));
      dessinerCourbesEnAttente();
    }
    $("#trainingStatus").textContent = etatEntrainement.horsLigne
      ? "Hors ligne" : runs.length+" run"+(runs.length > 1 ? "s" : "");
    $("#trainingAdd").disabled = etatEntrainement.horsLigne;
    document.querySelectorAll("#trainingSubviews [data-training-vue]").forEach(bouton => {
      bouton.setAttribute("aria-pressed", String(bouton.dataset.trainingVue === etatEntrainement.vue));
    });
  }

  let sousVuesBranchees = false;
  function brancherSousVuesEntrainement(){
    if(sousVuesBranchees) return;
    sousVuesBranchees = true;
    $("#trainingAdd").addEventListener("click", () =>
      void ouvrirSaisieEntrainement(null,
        { apres:()=>renderTrainingView({ silencieux:true }) }));
    document.querySelectorAll("#trainingSubviews [data-training-vue]").forEach(bouton => {
      bouton.addEventListener("click", () => {
        etatEntrainement.vue = bouton.dataset.trainingVue;
        dessinerEntrainement();
        bouton.focus();
      });
    });
  }

  /* Une sauvegarde appelle apres() puis, ~120 ms plus tard, l'écho Realtime
     de sa propre écriture rappelle aussi ce rendu : deux refresh() peuvent
     donc se recouper. Comme DashboardStore.refresh() (js/donnees/suivi-store.js),
     un compteur de génération protège contre une réponse lente qui
     repeindrait par-dessus un rendu plus récent déjà affiché. */
  let generationEntrainement = 0;

  async function renderTrainingView(options){
    const reglages = Object.assign({ silencieux:false }, options || {});
    brancherSousVuesEntrainement();
    const demande = ++generationEntrainement;
    if(!reglages.silencieux && !EntrainementStore.aUnCache()){
      $("#trainingStatus").textContent = "Chargement…";
    }
    let horsLigne = false;
    try{
      await refreshRosterProfiles();
      await EntrainementStore.refresh();
    }catch(erreur){
      horsLigne = true;
    }
    if(demande !== generationEntrainement) return !horsLigne;
    etatEntrainement.horsLigne = horsLigne;
    dessinerEntrainement();
    return !etatEntrainement.horsLigne;
  }

export { renderTrainingView };
