/* L'onglet « Entraînement » du groupe Boss.

   Une seule lecture alimente trois sous-vues locales : changer de sous-vue
   ne fait AUCUNE requête. Hors ligne, le dernier cache s'affiche avec son
   badge ; sans cache, la vue le dit — une liste vide passerait pour « aucune
   run ». */

import { EntrainementStore } from "../donnees/entrainement-store.js";
import { sessionCourante } from "../etat/session.js";
import { frDate, formatBossScore } from "../metier/boss-logique.js";
import { trierRunsEntrainement } from "../metier/entrainement-boss.js";
import { teamFromBossSnapshot } from "../metier/equipe-modele.js";
import { $, el } from "../noyau/dom.js";
import { openTeamDetail } from "./detail-equipe.js";
import { bossTeamBanner } from "./equipe-boss.js";
import { ouvrirSaisieEntrainement } from "./modale-entrainement.js";

  const etatEntrainement = { vue:"historique", horsLigne:false, perime:true };

  function invaliderEntrainement(){
    etatEntrainement.perime = true;
  }

  function participantEntrainement(run, membreId){
    const entree = run.equipes[membreId] || {};
    const pseudo = entree.pseudo || "Membre";
    const equipe = teamFromBossSnapshot(entree.snapshot);
    const ligne = el("div",{class:"boss-report-participant training-participant"},[
      el("span",{class:"boss-report-participant-name",text:pseudo})
    ]);
    if(equipe){
      ligne.appendChild(el("button",{
        class:"boss-report-team", type:"button",
        "aria-label":"Voir l’équipe de "+pseudo,
        onclick:()=>openTeamDetail(equipe)
      },[bossTeamBanner(equipe), el("span",{class:"boss-report-team-label",text:"Voir l’équipe"})]));
    }else{
      ligne.appendChild(el("span",{class:"boss-report-team-missing",text:"Équipe non renseignée"}));
    }
    return ligne;
  }

  function carteRunEntrainement(run){
    const moi = sessionCourante.user && sessionCourante.user.id;
    const tete = el("div",{class:"training-run-head"},[
      el("strong",{class:"training-run-score",text:formatBossScore(run.score)}),
      el("span",{class:"training-run-meta",text:frDate(run.playedOn)+" · saisie par "+run.createdByPseudo
        +(run.updatedByPseudo ? " · corrigée par "+run.updatedByPseudo : "")})
    ]);
    if(moi && run.participants.includes(moi)){
      tete.appendChild(el("button",{
        class:"btn btn-ghost training-edit", type:"button",
        dataset:{trainingRunId:run.id},
        "aria-label":"Corriger la run du "+frDate(run.playedOn),
        onclick:()=>void ouvrirSaisieEntrainement(run,
          { apres:()=>renderTrainingView({ silencieux:true }) })
      },["Corriger"]));
    }
    const carte = el("li",{class:"training-run",dataset:{trainingRunId:run.id}},[tete]);
    if(run.note) carte.appendChild(el("p",{class:"training-run-note",text:run.note}));
    carte.appendChild(el("div",{class:"boss-report-participants"},
      run.participants.map(id => participantEntrainement(run, id))));
    return carte;
  }

  function vueHistoriqueEntrainement(runs){
    if(!runs.length){
      return el("div",{class:"empty-state"},[
        el("p",{class:"big",text:"Aucune run d’entraînement"}),
        el("p",{text:"Enregistre la première avec le bouton ci-dessus."})
      ]);
    }
    return el("ol",{class:"training-runs"}, trierRunsEntrainement(runs).map(carteRunEntrainement));
  }

  /* Tâche 6 remplacera ces deux sous-vues provisoires. */
  const SOUS_VUES_ENTRAINEMENT = {
    historique:vueHistoriqueEntrainement,
    progression:vueHistoriqueEntrainement,
    classement:vueHistoriqueEntrainement
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
      corps.appendChild(SOUS_VUES_ENTRAINEMENT[etatEntrainement.vue](runs));
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

  async function renderTrainingView(options){
    const reglages = Object.assign({ silencieux:false }, options || {});
    brancherSousVuesEntrainement();
    if(!reglages.silencieux && !EntrainementStore.aUnCache()){
      $("#trainingStatus").textContent = "Chargement…";
    }
    try{
      await EntrainementStore.refresh();
      etatEntrainement.horsLigne = false;
      etatEntrainement.perime = false;
    }catch(erreur){
      etatEntrainement.horsLigne = true;
    }
    dessinerEntrainement();
    return !etatEntrainement.horsLigne;
  }

export { invaliderEntrainement, renderTrainingView };
