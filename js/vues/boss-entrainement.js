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
import {
  comparaisonEquipesEntrainement, resumeProgressionEntrainement,
  serieProgressionEntrainement, topRunsEntrainement, trierRunsEntrainement
} from "../metier/entrainement-boss.js";
import { teamFromBossSnapshot } from "../metier/equipe-modele.js";
import { $, el } from "../noyau/dom.js";
import { openTeamDetail } from "./detail-equipe.js";
import { bossTeamBanner } from "./equipe-boss.js";
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
      el("span",{class:"training-run-meta",text:frDateEntrainement(run.playedOn)+" · saisie par "+run.createdByPseudo
        +(run.updatedByPseudo ? " · corrigée par "+run.updatedByPseudo : "")})
    ]);
    if(moi && run.participants.includes(moi)){
      tete.appendChild(el("button",{
        class:"btn btn-ghost training-edit", type:"button",
        dataset:{trainingRunId:run.id},
        "aria-label":"Corriger la run du "+frDateEntrainement(run.playedOn),
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

  const SVG_NS_ENTRAINEMENT = "http://www.w3.org/2000/svg";

  function svgEntrainement(tag, attributs){
    const noeud = document.createElementNS(SVG_NS_ENTRAINEMENT, tag);
    Object.entries(attributs || {}).forEach(([cle, valeur]) => noeud.setAttribute(cle, String(valeur)));
    return noeud;
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

  /* La courbe n'est qu'une aide visuelle : les valeurs sont aussi écrites
     dans la liste qui suit. Les pixels passent par Number — la précision
     n'y compte pas — mais jamais les valeurs affichées. */
  function courbeEntrainement(serie){
    const L = 640, H = 220, M = 24;
    const svg = svgEntrainement("svg",{ class:"training-chart", viewBox:"0 0 "+L+" "+H,
      role:"img", "aria-label":"Courbe des scores d’entraînement" });
    const valeurs = serie.map(p => Number(p.score));
    const max = Math.max(...valeurs, 1);
    const x = i => serie.length === 1 ? L / 2 : M + i * (L - 2 * M) / (serie.length - 1);
    const y = v => H - M - (v / max) * (H - 2 * M);
    svg.appendChild(svgEntrainement("line",{ x1:M, y1:H - M, x2:L - M, y2:H - M, class:"training-axis" }));
    if(serie.length > 1){
      svg.appendChild(svgEntrainement("polyline",{ class:"training-line",
        points:valeurs.map((v, i) => x(i)+","+y(v)).join(" ") }));
    }
    valeurs.forEach((v, i) => svg.appendChild(
      svgEntrainement("circle",{ class:"training-dot", cx:x(i), cy:y(v), r:4 })));
    return svg;
  }

  function vueProgressionEntrainement(runs){
    const serie = serieProgressionEntrainement(runs, etatEntrainement.membreProgression || null);
    const bloc = el("div",{class:"training-progression"},[
      choixMembreEntrainement("trainingProgressionMember", "Runs de", etatEntrainement.membreProgression, true,
        valeur => { etatEntrainement.membreProgression = valeur; dessinerEntrainement(); })
    ]);
    if(!serie.length){
      bloc.appendChild(el("p",{class:"empty-state",text:"Aucune run pour ce choix."}));
      return bloc;
    }
    const resume = resumeProgressionEntrainement(serie);
    bloc.appendChild(courbeEntrainement(serie));
    bloc.appendChild(el("p",{class:"training-summary",text:
      "Meilleur : "+formatBossScore(resume.meilleur)
      +" · Dernier : "+formatBossScore(resume.dernier)
      +" · Écart au meilleur : "+formatBossScore(resume.ecart)}));
    bloc.appendChild(el("ol",{class:"training-points"}, serie.map(point =>
      el("li",{ text:frDateEntrainement(point.playedOn)+" : "+formatBossScore(point.score) }))));
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
      ? el("ol",{class:"training-top"}, top.map(({ rang, run }) => {
          const carte = carteRunEntrainement(run);
          carte.insertBefore(el("span",{class:"training-rank","aria-label":"Rang "+rang,text:String(rang)}),
            carte.firstChild);
          return carte;
        }))
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
