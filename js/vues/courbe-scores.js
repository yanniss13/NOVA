/* LA COURBE DE SCORES, partagée par l'entraînement et par le boss de guilde.

   Une seule chose entre : une série de points `{ id, score, libelle,
   libelleCourt }`, déjà triée du plus ancien au plus récent. Le module ne
   sait ni ce qu'est une run d'entraînement, ni ce qu'est une semaine de
   boss — c'est l'appelant qui rédige les libellés.

   Aucune bibliothèque de graphiques : par CDN elle disparaîtrait hors ligne
   (`sw.js` ne met jamais jsDelivr en cache), et versée dans le dépôt elle
   pèserait 200 Ko, demanderait une ligne d'exclusion dans `LICENSE` et
   rendrait dans un `<canvas>` muet. */

import { formatBossScore } from "../metier/boss-logique.js";
import { echelleCourbeScores } from "../metier/courbe-scores.js";
import { el } from "../noyau/dom.js";

  const SVG_NS_COURBE = "http://www.w3.org/2000/svg";

  function svgCourbe(tag, attributs){
    const noeud = document.createElementNS(SVG_NS_COURBE, tag);
    Object.entries(attributs || {}).forEach(([cle, valeur]) => noeud.setAttribute(cle, String(valeur)));
    return noeud;
  }

  /* SPLINE CUBIQUE MONOTONE (Fritsch-Carlson).

     Une polyligne donne une ligne brisée ; une courbe de Bézier naïve, elle,
     DÉPASSE les points qu'elle relie — elle afficherait un creux sous le
     minimum réel ou un pic au-dessus du meilleur score, c'est-à-dire des
     valeurs que personne n'a jouées. Cette variante contraint les tangentes
     pour que la courbe reste bornée par ses propres points : jolie, et qui
     ne raconte rien de faux. */
  function cheminLisseCourbe(points){
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
  let degradeCourbe = 0;

  /* La courbe reste une aide visuelle : la liste chiffrée qui la suit est
     l'équivalent textuel, et c'est elle que lit un lecteur d'écran. Les
     pixels passent par Number — la précision n'y compte pas —, jamais les
     scores affichés. */
  function traceCourbeScores(serie, largeurCadre, description){
    /* Le viewBox épouse la largeur réelle du cadre, si bien qu'une unité vaut
       un pixel : les graduations et les libellés gardent alors leur corps de
       texte, sur un écran de 320 px comme sur un 27 pouces. Un viewBox fixe
       imposerait de choisir entre un texte étiré (`preserveAspectRatio:none`)
       et un texte illisible une fois la courbe réduite. */
    const L = Math.round(Math.min(1400, Math.max(300, largeurCadre || 720)));
    const compact = L < 420;
    const H = compact ? 200 : 240;
    const MG = compact ? 54 : 62, MD = 22, MH = 16, MB = 32;
    const echelle = echelleCourbeScores(serie.map(p => p.score));
    const valeurs = serie.map(p => Number(p.score));
    const amplitude = echelle.haut - echelle.bas || 1;
    const x = i => serie.length === 1
      ? MG + (L - MG - MD) / 2
      : MG + i * (L - MG - MD) / (serie.length - 1);
    const y = v => MH + (1 - (v - echelle.bas) / amplitude) * (H - MH - MB);
    const points = valeurs.map((v, i) => ({ x:x(i), y:y(v) }));

    const premier = serie[0], dernier = serie[serie.length - 1];
    const svg = svgCourbe("svg",{ class:"score-chart", viewBox:"0 0 "+L+" "+H,
      role:"img",
      "aria-label":description
        + ", de " + formatBossScore(premier.score) + " (" + premier.libelle + ")"
        + " à " + formatBossScore(dernier.score) + " (" + dernier.libelle + ")"
        + ". Les valeurs sont listées sous la courbe." });

    /* Graduations chiffrées : une courbe qui ne part pas de zéro exagère
       l'écart, et c'est le seul garde-fou honnête contre cette illusion. */
    echelle.graduations.forEach(valeur => {
      const yg = y(valeur);
      svg.appendChild(svgCourbe("line",{ class:"score-chart-grid",
        x1:MG, y1:yg, x2:L - MD, y2:yg }));
      const libelle = svgCourbe("text",{ class:"score-chart-axis-label",
        x:MG - 10, y:yg, "text-anchor":"end", "dominant-baseline":"middle" });
      libelle.textContent = formatBossScore(valeur);
      svg.appendChild(libelle);
    });

    const id = "courbeAire" + (++degradeCourbe);
    const defs = svgCourbe("defs",{});
    const degrade = svgCourbe("linearGradient",{ id, x1:0, y1:0, x2:0, y2:1 });
    degrade.appendChild(svgCourbe("stop",{ class:"score-chart-area-haut", offset:"0%" }));
    degrade.appendChild(svgCourbe("stop",{ class:"score-chart-area-bas", offset:"100%" }));
    defs.appendChild(degrade);
    svg.appendChild(defs);

    if(serie.length > 1){
      const trace = cheminLisseCourbe(points);
      svg.appendChild(svgCourbe("path",{ class:"score-chart-area",
        fill:"url(#"+id+")",
        d:trace + " L"+points[points.length - 1].x+","+(H - MB)
          + " L"+points[0].x+","+(H - MB) + " Z" }));
      svg.appendChild(svgCourbe("path",{ class:"score-chart-line", d:trace }));
    }

    /* Au-delà d'une trentaine de points les pastilles se recouvrent et
       brouillent la courbe : seuls le meilleur et le dernier restent. */
    const meilleur = valeurs.indexOf(Math.max(...valeurs));
    const toutes = serie.length <= 30;
    points.forEach((point, i) => {
      if(!toutes && i !== meilleur && i !== points.length - 1) return;
      svg.appendChild(svgCourbe("circle",{
        class:"score-chart-dot"+(i === meilleur ? " is-best" : ""),
        cx:point.x, cy:point.y, r:i === meilleur ? 5 : 4
      }));
    });

    /* Libellés en abscisse, répartis régulièrement, les deux extrémités
       comprises. Un simple « un sur N » collerait l'avant-dernière étiquette
       à la dernière dès que le compte n'est pas un multiple de N. */
    const combien = Math.min(compact ? 3 : 6, serie.length);
    const rangs = combien === 1 ? [0] : Array.from({ length:combien },
      (_, k) => Math.round(k * (serie.length - 1) / (combien - 1)));
    [...new Set(rangs)].forEach(i => {
      /* Les étiquettes des deux bouts s'ancrent vers l'intérieur : centrées,
         elles débordent du cadre et la dernière se retrouve coupée. */
      const ancre = i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle";
      const libelle = svgCourbe("text",{ class:"score-chart-axis-label",
        x:points[i].x, y:H - MB + 20, "text-anchor":serie.length === 1 ? "middle" : ancre });
      libelle.textContent = serie[i].libelleCourt;
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
  function viseurCourbe(bloc, serie, trace){
    const { svg, points, haut, largeur, hauteur } = trace;
    const repere = svgCourbe("line",{ class:"score-chart-guide", y1:0, y2:haut });
    const halo = svgCourbe("circle",{ class:"score-chart-dot is-active", r:6 });
    const etiquette = el("div",{ class:"score-chart-tip", "aria-hidden":"true" });
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
        el("span",{ text:serie[proche].libelle })
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

  function dessinerCourbe(cadre, serie, description){
    const largeur = cadre.clientWidth || 720;
    cadre.replaceChildren();
    const trace = traceCourbeScores(serie, largeur, description);
    cadre.appendChild(trace.svg);
    viseurCourbe(cadre, serie, trace);
    cadre.dataset.largeurCourbe = String(largeur);
  }

  /* Une unité de viewBox valant un pixel, tourner son téléphone ou réduire
     la fenêtre déformerait le texte : on redessine. Le seuil évite de le
     refaire à chaque pixel, et le redessin ne change pas la largeur du
     cadre — il ne peut donc pas se rappeler lui-même. */
  function suivreLargeurCourbe(cadre, serie, description){
    if(typeof ResizeObserver !== "function") return;
    const observateur = new ResizeObserver(() => {
      if(!cadre.isConnected){ observateur.disconnect(); return; }
      const largeur = cadre.clientWidth;
      if(!largeur || Math.abs(largeur - Number(cadre.dataset.largeurCourbe)) < 24) return;
      dessinerCourbe(cadre, serie, description);
    });
    observateur.observe(cadre);
  }

  /* Les cadres préparés mais pas encore dans le document : leur largeur ne se
     connaît qu'une fois attachés, et c'est elle qui donne son viewBox à la
     courbe. La vue appelle donc dessinerCourbesEnAttente() juste après avoir
     inséré son contenu. */
  let courbesEnAttente = [];

  /* `resume` est la ligne chiffrée placée entre la courbe et sa liste : son
     texte diffère d'une vue à l'autre, l'ordre non. La liste, elle, reste
     ici : c'est l'équivalent textuel que promet l'aria-label de la courbe, et
     un appelant ne doit pas pouvoir l'oublier. */
  function preparerCourbeScores(serie, options){
    const reglages = options || {};
    const description = reglages.description || "Courbe des scores";
    const cadre = el("div",{class:"score-chart-wrap"});
    courbesEnAttente.push({ cadre, serie, description });
    const bloc = el("div",{class:"score-chart-block"},[cadre]);
    if(reglages.resume){
      bloc.appendChild(el("p",{class:"score-chart-summary",text:reglages.resume}));
    }
    bloc.appendChild(el("ol",{class:"score-chart-points"}, serie.map(point =>
      el("li",{ text:point.libelle+" : "+formatBossScore(point.score) }))));
    return bloc;
  }

  /* Une vue qui reconstruit son contenu abandonne les cadres qu'elle avait
     préparés : on repart d'une file vide, sinon un cadre détaché du document
     resterait à dessiner indéfiniment. */
  function dessinerCourbesEnAttente(){
    const attente = courbesEnAttente;
    courbesEnAttente = [];
    attente.forEach(({ cadre, serie, description }) => {
      if(!cadre.isConnected) return;
      dessinerCourbe(cadre, serie, description);
      suivreLargeurCourbe(cadre, serie, description);
    });
  }

export { dessinerCourbesEnAttente, preparerCourbeScores };
