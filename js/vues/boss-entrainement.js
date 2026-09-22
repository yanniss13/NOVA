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
  comparaisonEquipesEntrainement, echelleProgressionEntrainement,
  resumeProgressionEntrainement, serieProgressionEntrainement,
  topRunsEntrainement, trierRunsEntrainement
} from "../metier/entrainement-boss.js";
import { $, el } from "../noyau/dom.js";
import { bossReportParticipant, bossRunCarte } from "./equipe-boss.js";
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

  /* Une date courte pour l'abscisse : l'année est déjà dans la liste
     chiffrée qui suit la courbe, et elle ferait se chevaucher les libellés. */
  function dateCourteEntrainement(iso){
    return iso ? new Date(iso+"T00:00:00")
      .toLocaleDateString("fr-FR", { day:"numeric", month:"short" }) : "";
  }

  /* SPLINE CUBIQUE MONOTONE (Fritsch-Carlson).

     Une polyligne donne une ligne brisée ; une courbe de Bézier naïve, elle,
     DÉPASSE les points qu'elle relie — elle afficherait un creux sous le
     minimum réel ou un pic au-dessus du meilleur score, c'est-à-dire des
     valeurs que personne n'a jouées. Cette variante contraint les tangentes
     pour que la courbe reste bornée par ses propres points : jolie, et qui
     ne raconte rien de faux. */
  function cheminLisseEntrainement(points){
    const n = points.length;
    if(n < 2) return "";
    const dx = [], pentes = [];
    for(let i = 0; i < n - 1; i++){
      dx.push(points[i + 1].x - points[i].x);
      pentes.push((points[i + 1].y - points[i].y) / dx[i]);
    }
    const tangentes = [pentes[0]];
    for(let i = 1; i < n - 1; i++){
      if(pentes[i - 1] * pentes[i] <= 0){
        tangentes.push(0);
      }else{
        const p1 = 2 * dx[i] + dx[i - 1], p2 = dx[i] + 2 * dx[i - 1];
        tangentes.push((p1 + p2) / (p1 / pentes[i - 1] + p2 / pentes[i]));
      }
    }
    tangentes.push(pentes[n - 2]);
    const rond = valeur => Math.round(valeur * 100) / 100;
    let chemin = "M"+rond(points[0].x)+","+rond(points[0].y);
    for(let i = 0; i < n - 1; i++){
      const t = dx[i] / 3;
      chemin += " C"+rond(points[i].x + t)+","+rond(points[i].y + tangentes[i] * t)
        +" "+rond(points[i + 1].x - t)+","+rond(points[i + 1].y - tangentes[i + 1] * t)
        +" "+rond(points[i + 1].x)+","+rond(points[i + 1].y);
    }
    return chemin;
  }

  /* Chaque courbe a son dégradé : deux `<linearGradient>` ne peuvent pas
     partager un identifiant, et un rendu en remplace un autre. */
  let degradeEntrainement = 0;

  /* La courbe reste une aide visuelle : la liste chiffrée qui la suit est
     l'équivalent textuel, et c'est elle que lit un lecteur d'écran. Les
     pixels passent par Number — la précision n'y compte pas —, jamais les
     scores affichés. */
  function courbeEntrainement(serie, largeurCadre){
    /* Le viewBox épouse la largeur réelle du cadre, si bien qu'une unité vaut
       un pixel : les graduations et les dates gardent alors leur corps de
       texte, sur un écran de 320 px comme sur un 27 pouces. Un viewBox fixe
       imposerait de choisir entre un texte étiré (`preserveAspectRatio:none`)
       et un texte illisible une fois la courbe réduite. */
    const L = Math.round(Math.min(1400, Math.max(300, largeurCadre || 720)));
    const compact = L < 420;
    const H = compact ? 200 : 240;
    const MG = compact ? 54 : 62, MD = 22, MH = 16, MB = 32;
    const echelle = echelleProgressionEntrainement(serie.map(p => p.score));
    const valeurs = serie.map(p => Number(p.score));
    const amplitude = echelle.haut - echelle.bas || 1;
    const x = i => serie.length === 1
      ? MG + (L - MG - MD) / 2
      : MG + i * (L - MG - MD) / (serie.length - 1);
    const y = v => MH + (1 - (v - echelle.bas) / amplitude) * (H - MH - MB);
    const points = valeurs.map((v, i) => ({ x:x(i), y:y(v) }));

    const svg = svgEntrainement("svg",{ class:"training-chart", viewBox:"0 0 "+L+" "+H,
      role:"img",
      "aria-label":"Courbe des scores d’entraînement, de "
        + formatBossScore(serie[0].score) + " le " + frDateEntrainement(serie[0].playedOn)
        + " à " + formatBossScore(serie[serie.length - 1].score) + " le "
        + frDateEntrainement(serie[serie.length - 1].playedOn)
        + ". Les valeurs sont listées sous la courbe." });

    /* Graduations chiffrées : une courbe qui ne part pas de zéro exagère
       l'écart, et c'est le seul garde-fou honnête contre cette illusion. */
    echelle.graduations.forEach(valeur => {
      const yg = y(valeur);
      svg.appendChild(svgEntrainement("line",{ class:"training-grid",
        x1:MG, y1:yg, x2:L - MD, y2:yg }));
      const libelle = svgEntrainement("text",{ class:"training-axis-label",
        x:MG - 10, y:yg, "text-anchor":"end", "dominant-baseline":"middle" });
      libelle.textContent = formatBossScore(valeur);
      svg.appendChild(libelle);
    });

    const id = "trainingAire" + (++degradeEntrainement);
    const defs = svgEntrainement("defs",{});
    const degrade = svgEntrainement("linearGradient",{ id, x1:0, y1:0, x2:0, y2:1 });
    degrade.appendChild(svgEntrainement("stop",{ class:"training-area-haut", offset:"0%" }));
    degrade.appendChild(svgEntrainement("stop",{ class:"training-area-bas", offset:"100%" }));
    defs.appendChild(degrade);
    svg.appendChild(defs);

    if(serie.length > 1){
      const trace = cheminLisseEntrainement(points);
      svg.appendChild(svgEntrainement("path",{ class:"training-area",
        fill:"url(#"+id+")",
        d:trace + " L"+points[points.length - 1].x+","+(H - MB)
          + " L"+points[0].x+","+(H - MB) + " Z" }));
      svg.appendChild(svgEntrainement("path",{ class:"training-line", d:trace }));
    }

    /* Au-delà d'une trentaine de runs les pastilles se recouvrent et
       brouillent la courbe : seuls le meilleur et le dernier restent. */
    const meilleur = valeurs.indexOf(Math.max(...valeurs));
    const toutes = serie.length <= 30;
    points.forEach((point, i) => {
      if(!toutes && i !== meilleur && i !== points.length - 1) return;
      svg.appendChild(svgEntrainement("circle",{
        class:"training-dot"+(i === meilleur ? " is-best" : ""),
        cx:point.x, cy:point.y, r:i === meilleur ? 5 : 4
      }));
    });

    /* Dates en abscisse, réparties régulièrement, les deux extrémités
       comprises. Un simple « une sur N » collerait l'avant-dernière étiquette
       à la dernière dès que le compte n'est pas un multiple de N. */
    const combien = Math.min(compact ? 3 : 6, serie.length);
    const rangs = combien === 1 ? [0] : Array.from({ length:combien },
      (_, k) => Math.round(k * (serie.length - 1) / (combien - 1)));
    [...new Set(rangs)].forEach(i => {
      /* Les étiquettes des deux bouts s'ancrent vers l'intérieur : centrées,
         elles débordent du cadre et la dernière date se retrouve coupée. */
      const ancre = i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle";
      const libelle = svgEntrainement("text",{ class:"training-axis-label",
        x:points[i].x, y:H - MB + 20, "text-anchor":serie.length === 1 ? "middle" : ancre });
      libelle.textContent = dateCourteEntrainement(serie[i].playedOn);
      svg.appendChild(libelle);
    });

    return { svg, points, haut:H - MB, largeur:L, hauteur:H };
  }

  /* Le point survolé, avec son repère vertical et son étiquette.

     L'étiquette est en HTML, pas en SVG : un `<text>` ne revient pas à la
     ligne, ne porte pas de fond arrondi, et ne suivrait pas les polices du
     site. Le survol se déclenche au pointeur pour la souris et au toucher
     pour le doigt, SANS `preventDefault` — sur la grille des dispos, capter
     un geste tactile avait déjà coûté le défilement de la page au membre. */
  function viseurEntrainement(bloc, serie, trace){
    const { svg, points, haut, largeur, hauteur } = trace;
    const repere = svgEntrainement("line",{ class:"training-guide", y1:0, y2:haut });
    const halo = svgEntrainement("circle",{ class:"training-dot is-active", r:6 });
    const etiquette = el("div",{ class:"training-tip", "aria-hidden":"true" });
    repere.style.display = halo.style.display = "none";
    svg.appendChild(repere);
    svg.appendChild(halo);
    bloc.appendChild(etiquette);

    function viser(evenement){
      const cadre = svg.getBoundingClientRect();
      if(!cadre.width) return;
      const vise = (evenement.clientX - cadre.left) / cadre.width * largeur;
      let proche = 0;
      points.forEach((point, i) => {
        if(Math.abs(point.x - vise) < Math.abs(points[proche].x - vise)) proche = i;
      });
      const point = points[proche];
      repere.setAttribute("x1", point.x);
      repere.setAttribute("x2", point.x);
      halo.setAttribute("cx", point.x);
      halo.setAttribute("cy", point.y);
      repere.style.display = halo.style.display = "";
      etiquette.replaceChildren(
        el("strong",{ text:formatBossScore(serie[proche].score) }),
        el("span",{ text:frDateEntrainement(serie[proche].playedOn) })
      );
      etiquette.classList.add("on");
      etiquette.style.left = Math.min(92, Math.max(8, point.x / largeur * 100)) + "%";
      etiquette.style.top = (point.y / hauteur * 100) + "%";
    }
    function effacer(){
      repere.style.display = halo.style.display = "none";
      etiquette.classList.remove("on");
    }

    svg.addEventListener("pointermove", ev => { if(ev.pointerType === "mouse") viser(ev); });
    svg.addEventListener("pointerdown", ev => { if(ev.pointerType !== "mouse") viser(ev); });
    svg.addEventListener("pointerleave", effacer);
  }

  /* Le cadre préparé par la sous-vue, en attente d'être dans le document. */
  let courbeEnAttente = null;

  function dessinerCourbeEntrainement(cadre, serie){
    const largeur = cadre.clientWidth || 720;
    cadre.replaceChildren();
    const trace = courbeEntrainement(serie, largeur);
    cadre.appendChild(trace.svg);
    viseurEntrainement(cadre, serie, trace);
    cadre.dataset.largeurCourbe = String(largeur);
  }

  /* Une unité de viewBox valant un pixel, tourner son téléphone ou réduire
     la fenêtre déformerait le texte : on redessine. Le seuil évite de le
     refaire à chaque pixel, et le redessin ne change pas la largeur du
     cadre — il ne peut donc pas se rappeler lui-même. */
  function suivreLargeurCourbe(cadre, serie){
    if(typeof ResizeObserver !== "function") return;
    const observateur = new ResizeObserver(() => {
      if(!cadre.isConnected){ observateur.disconnect(); return; }
      const largeur = cadre.clientWidth;
      if(!largeur || Math.abs(largeur - Number(cadre.dataset.largeurCourbe)) < 24) return;
      dessinerCourbeEntrainement(cadre, serie);
    });
    observateur.observe(cadre);
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
    /* Le cadre part vide : sa largeur ne se connaît qu'une fois dans le
       document, et c'est elle qui donne son viewBox à la courbe. */
    const cadre = el("div",{class:"training-chart-wrap"});
    courbeEnAttente = { cadre, serie };
    bloc.appendChild(cadre);
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
      courbeEnAttente = null;
      corps.appendChild(el("section",{class:"boss-stats training-panel"},
        [SOUS_VUES_ENTRAINEMENT[etatEntrainement.vue](runs)]));
      if(courbeEnAttente){
        dessinerCourbeEntrainement(courbeEnAttente.cadre, courbeEnAttente.serie);
        suivreLargeurCourbe(courbeEnAttente.cadre, courbeEnAttente.serie);
        courbeEnAttente = null;
      }
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
