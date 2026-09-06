"use strict";

(() => {
  const DATA = window.NOVA_MAQUETTE;
  const ROUTES = Object.freeze({
    home:"Notre guilde",
    dashboard:"Mon suivi",
    teams:"Équipes",
    boss:"Boss de guilde",
    roster:"Roster",
    tools:"Outils",
    admin:"Membres"
  });
  const state = {
    session:"public",
    tool:"wiki",
    bossTab:"overview",
    teamMode:"builder",
    rosterMode:"mine",
    heroIndex:0,
    lastFocus:null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const routeFromHash = () => {
    const route = location.hash.replace(/^#/, "").split("/")[0];
    return Object.hasOwn(ROUTES, route) ? route : "home";
  };

  function pageHeading(context, title, copy, aside=""){
    return `<header class="page-heading">
      <div><p class="context-label">${context}</p><h1 tabindex="-1">${title}</h1><p>${copy}</p></div>
      ${aside}
    </header>`;
  }

  function renderDashboard(){
    const view = $('[data-view="dashboard"]');
    view.innerHTML = `<div class="page-shell">
      ${pageHeading("Notre guilde", "Mon suivi", "Ce qu'il te reste à faire cette semaine.",
        `<div class="sync-card"><span class="live-dot"></span><div><b>Données synchronisées</b><small>à l'instant</small></div></div>`)}
      <section class="boss-feature ornate-panel">
        <div><p class="context-label">Boss de la semaine</p><h2>${DATA.week.boss}</h2><p>${DATA.week.label} · Reset ${DATA.week.reset}</p></div>
        <div class="feature-score"><span>Prochain créneau</span><strong>Jeudi · 21 h</strong><small>6 membres disponibles</small></div>
        <button class="gold-action" type="button" data-action="open-group">Préparer ma run</button>
      </section>
      <div class="section-title-row"><div><p class="context-label">Priorités</p><h2>À faire maintenant</h2></div><span>4 actions</span></div>
      <div class="dashboard-grid">
        ${DATA.dashboardActions.map((item, index) => `<article class="action-card" data-tone="${item.tone}">
          <div class="action-index">0${index + 1}</div>
          <div><span class="action-state">${item.state}</span><h3>${item.title}</h3><p>${item.copy}</p></div>
          <button type="button" class="card-link" data-action="${index === 0 ? "open-group" : "open-info"}" data-modal-title="${item.title}">${item.action} <span aria-hidden="true">→</span></button>
        </article>`).join("")}
      </div>
      <div class="demo-states" aria-label="États de démonstration">
        <span>Prévisualiser :</span>
        <button type="button" data-demo-state="empty">Rien à faire</button>
        <button type="button" data-demo-state="offline">Hors ligne</button>
        <button type="button" data-demo-state="error">Erreur</button>
      </div>
    </div>`;
  }

  function bossOverview(){
    return `<div class="boss-overview">
      <section class="boss-feature ornate-panel">
        <div><p class="context-label">Prochaine attaque</p><h2>Groupe 2 · jeudi 21 h</h2><p>Trois membres inscrits · ton équipe reste à choisir.</p></div>
        <div class="feature-score"><span>Composition recommandée</span><strong>Foudre</strong><small>2 soutiens · 2 attaquants</small></div>
        <button class="gold-action" type="button" data-action="choose-team">Choisir mon équipe</button>
      </section>
      <div class="stat-grid">
        <article><span>Groupes ouverts</span><strong>5</strong><small>sur 6 cette semaine</small></article>
        <article><span>Places disponibles</span><strong>8</strong><small>dans quatre groupes</small></article>
        <article><span>Meilleur créneau</span><strong>Sam. 20 h</strong><small>8 membres disponibles</small></article>
        <article><span>Score cumulé</span><strong>2,27 M</strong><small>deux runs terminées</small></article>
      </div>
      <section class="recommendation-panel ornate-panel"><div><p class="context-label">Suggestion automatique</p><h2>Deux groupes peuvent être complétés</h2><p>La recommandation croise les disponibilités, les rosters et la limite de cinq membres.</p></div><button class="card-link" type="button" data-action="open-info" data-modal-title="Recommandation des groupes">Voir la proposition <span aria-hidden="true">→</span></button></section>
    </div>`;
  }

  function bossTeams(){
    return `<div class="shared-team-list">${DATA.boss.teams.map(team => `<article class="shared-team ornate-panel" data-team-id="${team.id}">
      <div><span class="owner-tag">${team.owner}</span><h2>${team.name}</h2></div>
      <div class="mini-portraits">${team.heroes.map(hero => `<span title="${hero}"><img src="../../7ds-personnages/${hero === "Méliodas" ? "meliodas" : hero.toLowerCase()}.webp" alt=""></span>`).join("")}</div>
      <button class="card-link" type="button" data-action="open-info" data-modal-title="Équipement de ${team.name}">Voir l'équipement <span aria-hidden="true">→</span></button>
    </article>`).join("")}</div>`;
  }

  function bossAvailability(){
    const hours = ["18 h", "19 h", "20 h", "21 h", "22 h", "23 h"];
    return `<section class="availability-panel ornate-panel">
      <header><div><p class="context-label">Heure de Paris</p><h2>Disponibilités de la confrérie</h2></div><div class="segmented"><button type="button">Mes dispos</button><button class="is-selected" type="button">La confrérie</button></div></header>
      <div class="availability-grid" role="table" aria-label="Disponibilités de la semaine">
        <div class="availability-corner"></div>${hours.map(hour => `<div class="hour-head">${hour}</div>`).join("")}
        ${DATA.boss.availability.map(day => `<div class="day-head">${day.day}</div>${day.slots.map(value => `<button type="button" style="--heat:${value}" aria-label="${day.day}, ${value} membres"><b>${value}</b></button>`).join("")}`).join("")}
      </div>
      <p class="availability-best"><b>Meilleur créneau :</b> samedi à 21 h · 8 membres disponibles.</p>
    </section>`;
  }

  function bossGroups(){
    return `<div class="boss-grid">${DATA.boss.groups.map(group => `<article class="boss-card ornate-panel" data-group-id="${group.id}">
      <header><div><span>${group.status}</span><h2>${group.title}</h2></div><time>${group.when}</time></header>
      <div class="participant-list">${group.members.length ? group.members.map(name => `<span>${name.slice(0,1)}<small>${name}</small></span>`).join("") : `<p>Aucun membre inscrit</p>`}</div>
      <div class="boss-card-actions"><button type="button" data-action="join-group">${group.members.includes("YanniSs13") ? "Choisir mon équipe" : "Rejoindre"}</button>${group.status === "Terminé" ? `<button type="button" data-action="correct-report">Corriger</button>` : ""}</div>
    </article>`).join("")}</div>`;
  }

  function bossReports(){
    return `<div class="reports-layout">
      <section class="report-compose ornate-panel"><p class="context-label">Run sélectionnée</p><h2>Groupe 2 · jeudi 21 h</h2><label>Score global<input type="text" value="" placeholder="Ex. 1284500"></label><label>Note de run<textarea rows="3" placeholder="Stratégie, difficulté, amélioration…"></textarea></label><button class="gold-action" type="button" data-action="finish-run">Terminer la run</button></section>
      <section class="report-history"><div class="section-title-row"><h2>Archives récentes</h2><span>${DATA.boss.reports.length} rapports</span></div>${DATA.boss.reports.map(report => `<article class="report-card"><div><span>${report.date}</span><h3>${report.group}</h3><p>${report.note}</p></div><strong>${report.score}<small> points</small></strong><button type="button" data-action="correct-report">Corriger</button></article>`).join("")}</section>
    </div>`;
  }

  function renderBoss(activeTab=state.bossTab){
    state.bossTab = activeTab;
    const tabs = [
      ["overview", "Vue d'ensemble"], ["teams", "Équipes"],
      ["availability", "Disponibilités"], ["groups", "Groupes"],
      ["reports", "Rapports"]
    ];
    const panels = {
      overview:bossOverview,
      teams:bossTeams,
      availability:bossAvailability,
      groups:bossGroups,
      reports:bossReports
    };
    $('[data-view="boss"]').innerHTML = `<div class="page-shell">
      ${pageHeading("Boss de Guilde", "Centre de commandement", "Équipes, créneaux et résultats de la semaine.", `<div class="week-card"><span>${DATA.week.label}</span><strong>${DATA.week.boss}</strong><small>Reset ${DATA.week.reset}</small></div>`)}
      <div class="local-tabs" role="tablist" aria-label="Boss de Guilde">${tabs.map(([id,label]) => `<button type="button" role="tab" data-boss-tab="${id}" aria-selected="${id === state.bossTab}">${label}</button>`).join("")}</div>
      <div data-boss-panel="${state.bossTab}">${panels[state.bossTab]()}</div>
    </div>`;
  }

  function heroPortrait(hero, className=""){
    return `<img class="${className}" src="../../7ds-personnages/${hero.slug}.webp" alt="Portrait de ${hero.name}">`;
  }

  function builderPanel(){
    const hero = DATA.heroes[state.heroIndex] || DATA.heroes[0];
    return `<div class="builder-layout">
      <section class="team-composition ornate-panel">
        <div class="team-meta"><label>Nom de l'équipe<input value="Akumu — Foudre stable"></label><button type="button" data-action="new-team">Nouvelle équipe</button><button class="gold-action" type="button" data-action="save-team">Enregistrer</button></div>
        <div class="hero-strip" role="list" aria-label="Composition de l'équipe">${DATA.heroes.slice(0,4).map((item,index) => `<button type="button" role="listitem" data-hero-index="${index}" aria-pressed="${index === state.heroIndex}">${heroPortrait(item)}<span><b>${item.name}</b><small>${item.element} · P${item.potential}</small></span></button>`).join("")}</div>
      </section>
      <section class="builder-workspace ornate-panel">
        <aside class="active-hero">${heroPortrait(hero)}<p class="context-label">Héros actif</p><h2>${hero.name}</h2><p>${hero.element} · ${hero.role}</p><div class="potential-line"><span>Potentiel</span><strong>P${hero.potential}</strong></div><div class="weapon-switch" role="group" aria-label="Build d'arme"><button aria-pressed="true">Épée 1 main</button><button aria-pressed="false">Épée 2 mains</button><button aria-pressed="false">Rapière</button></div></aside>
        <div class="equipment-editor"><div class="builder-section-head"><div><p class="context-label">Équipement</p><h2>Build principal</h2></div><div><button type="button" data-action="preset">Presets</button><button type="button" data-action="capture-import">Importer des captures</button></div></div><div class="equipment-grid">${DATA.equipment.map(item => `<button class="equipment-slot" type="button" data-action="gear" data-modal-title="${item.slot} · ${item.name}"><img src="${item.image}" alt=""><span><small>${item.slot}</small><b>${item.name}</b><em>${item.value}</em></span></button>`).join("")}<button class="equipment-slot is-empty" type="button" data-action="gear" data-modal-title="Équipement à choisir"><span class="empty-plus">+</span><span><small>Anneau</small><b>À équiper</b><em>Configuration manquante</em></span></button><button class="equipment-slot is-empty" type="button" data-action="gear" data-modal-title="Équipement à choisir"><span class="empty-plus">+</span><span><small>Boucles d'oreilles</small><b>À équiper</b><em>Configuration manquante</em></span></button></div></div>
        <aside class="build-stats"><p class="context-label">Borne inférieure</p><h2>Statistiques</h2>${[["PV","12 842",.82],["ATK","3 946",.68],["DEF","2 118",.54]].map(stat => `<div class="stat-line"><span>${stat[0]}</span><strong>${stat[1]}</strong><i style="--value:${stat[2]}"></i></div>`).join("")}<div class="coverage-note"><b>Calcul partiel</b><span>2 équipements restent à configurer.</span></div><label class="team-note">Note<textarea rows="4">Garder l'ultime pour la phase de rupture.</textarea></label></aside>
      </section>
    </div>`;
  }

  function sharedTeamsPanel(){
    return `<div class="teams-toolbar"><label>Membre<select><option>Toute la confrérie</option><option>YanniSs13</option><option>Elaine</option></select></label><span>3 équipes disponibles</span></div>${bossTeams()}`;
  }

  function renderTeams(mode=state.teamMode){
    state.teamMode = mode;
    $('[data-view="teams"]').innerHTML = `<div class="page-shell">
      ${pageHeading("Forge de la guilde", mode === "builder" ? "Composer une équipe" : "Équipes partagées", "Quatre héros, leurs builds et une stratégie prête pour le Boss de Guilde.")}
      <div class="local-tabs" role="tablist" aria-label="Équipes"><button type="button" role="tab" data-team-mode="builder" aria-selected="${mode === "builder"}">Créer une équipe</button><button type="button" role="tab" data-team-mode="shared" aria-selected="${mode === "shared"}">Équipes partagées</button></div>
      <div data-team-panel="${mode}">${mode === "builder" ? builderPanel() : sharedTeamsPanel()}</div>
    </div>`;
  }

  function rosterCards(readonly=false){
    return `<div class="hero-card-grid">${DATA.heroes.map(hero => `<article class="hero-card ornate-panel">
      <button class="hero-card-main" type="button" data-action="open-roster" data-modal-title="${hero.name} · ${hero.weapon}">${heroPortrait(hero)}<span class="hero-card-copy"><small>${hero.element} · ${hero.role}</small><b>${hero.name}</b><em>${hero.weapon}</em></span><strong>P${hero.potential}</strong></button>
      <footer><span class="completion ${hero.complete ? "is-complete" : ""}">${hero.complete ? "Build complet" : "À compléter"}</span>${readonly ? `<span>Consultation</span>` : `<button type="button" data-action="favorite">☆ Favori</button>`}</footer>
    </article>`).join("")}</div>`;
  }

  function renderRoster(mode=state.rosterMode){
    state.rosterMode = mode;
    const readonly = mode === "others";
    $('[data-view="roster"]').innerHTML = `<div class="page-shell">
      ${pageHeading("Registre de la guilde", readonly ? "Roster des membres" : "Mon roster", "Enregistre les personnages une fois, puis réutilise leurs builds partout.", readonly ? `<label class="owner-select">Membre<select><option>Merlin</option><option>Elaine</option><option>Ban</option></select></label>` : `<button class="gold-action" type="button" data-action="add-hero">Ajouter un personnage</button>`)}
      <div class="local-tabs" role="tablist" aria-label="Roster affiché"><button type="button" role="tab" data-roster-mode="mine" aria-selected="${mode === "mine"}">Mon roster</button><button type="button" role="tab" data-roster-mode="others" aria-selected="${mode === "others"}">Roster des membres</button></div>
      <div class="filter-bar"><label>Recherche<input type="search" placeholder="Nom d'un héros"></label><label>Élément<select><option>Tous</option><option>Foudre</option><option>Ténèbres</option></select></label><label>Rôle<select><option>Tous</option><option>Attaquant</option><option>Soutien</option></select></label><span><b>${DATA.heroes.length}</b> personnages</span></div>
      ${rosterCards(readonly)}
    </div>`;
  }

  function wikiPanel(){
    return `<div class="tool-filter"><div class="category-pills"><button class="is-selected">Héros</button><button>Armes</button><button>Armures</button><button>Bijoux</button><button>Gravures</button></div><label>Recherche<input type="search" placeholder="Nom d'un héros"></label></div><div class="wiki-grid">${DATA.heroes.map(hero => `<button type="button" data-action="open-info" data-modal-title="Fiche de ${hero.name}">${heroPortrait(hero)}<span><b>${hero.name}</b><small>${hero.element} · ${hero.weapon}</small></span></button>`).join("")}</div>`;
  }

  function collectionPanel(){
    return `<section class="collection-head ornate-panel"><div><p class="context-label">Collection de YanniSs13</p><h2>47 objets sur 86</h2><p>Encore 39 objets à trouver pour compléter les builds de la guilde.</p></div><div class="progress-ring"><strong>55<small>%</small></strong></div></section><div class="filter-bar"><label>Recherche<input type="search" placeholder="Nom d'un objet"></label><button>Tout</button><button>Possédés</button><button>Manquants</button></div><div class="collection-grid">${DATA.collection.map(item => `<button type="button" class="collection-item ${item.owned ? "is-owned" : ""}" data-action="collection-toggle"><img src="${item.image}" alt=""><span><small>${item.kind}</small><b>${item.name}</b><em>${item.owned ? "Possédé" : "À trouver"}</em></span></button>`).join("")}</div>`;
  }

  function calculatorPanel(){
    return `<div class="calculator-layout"><aside class="calculator-controls ornate-panel"><p class="context-label">Boss de confrérie</p><h2>Comparer deux builds</h2><label>Personnage<select><option>Méliodas</option><option>Merlin</option></select></label><label>Build A<select><option>Épée 1 main · favori</option></select></label><label>Build B<select><option>Rapière · critique</option></select></label><button class="gold-action" type="button" data-action="calculate">Calculer sur 60 s</button></aside><section class="calculator-results"><div class="calculation-summary ornate-panel"><span>Meilleur résultat</span><strong>Build A · +5,5 %</strong><small>Conditions et cumuls personnels maximisés</small></div><div class="damage-table" role="table"><div class="damage-head"><b>Compétence</b><b>Build A</b><b>Build B</b><b>Écart</b></div>${DATA.calculator.map(row => `<div><span>${row.skill}</span><strong>${row.a}</strong><strong>${row.b}</strong><em>${row.gain}</em></div>`).join("")}</div><details open><summary>Hypothèses et chronologie</summary><p>Ressources illimitées, ouverture optimale et animations non mesurées comptées à zéro. Les attaques normales restent hors calcul.</p></details></section></div>`;
  }

  function analysisPanel(){
    return `<div class="analysis-switch"><button class="is-selected">Vue d'ensemble</button><button>DPS par élément</button><button>Supports Foudre</button></div><div class="analysis-grid"><section class="coverage-wheel ornate-panel"><div class="wheel"><strong>6<small>/8</small></strong></div><h2>Éléments couverts</h2><p>La guilde dispose d'au moins un build complet pour six éléments.</p></section><section class="element-ranking ornate-panel"><p class="context-label">DPS de la confrérie</p><h2>Meilleurs builds</h2>${[["Foudre","2,48 M",92],["Ténèbres","2,31 M",85],["Feu","1,94 M",70],["Vent","1,62 M",58]].map(row => `<div><span>${row[0]}</span><i style="--rank:${row[2]}%"></i><strong>${row[1]}</strong></div>`).join("")}</section><section class="support-list ornate-panel"><p class="context-label">Supports Foudre</p><h2>Affaiblissements disponibles</h2><ul><li><b>Réduction de défense</b><span>Escanor · P10</span></li><li><b>Vulnérabilité générale</b><span>Merlin · P8</span></li><li><b>Résistance critique</b><span>King · P7</span></li></ul></section></div>`;
  }

  function renderTools(tool=state.tool){
    state.tool = ["wiki","collection","calculator","analysis"].includes(tool) ? tool : "wiki";
    const labels = { wiki:"Wiki", collection:"Collection", calculator:"Calculateur", analysis:"Analyse" };
    const panels = { wiki:wikiPanel, collection:collectionPanel, calculator:calculatorPanel, analysis:analysisPanel };
    $('[data-view="tools"]').innerHTML = `<div class="page-shell">
      ${pageHeading("Archives et laboratoire", "Les outils de la confrérie", "Consulte les données du jeu, suis ta collection et compare les performances.")}
      <div class="local-tabs" role="tablist" aria-label="Outils">${Object.entries(labels).map(([id,label]) => `<button type="button" role="tab" data-tool-tab="${id}" aria-selected="${id === state.tool}">${label}</button>`).join("")}</div>
      <div data-tool-panel="${state.tool}">${panels[state.tool]()}</div>
    </div>`;
  }

  function renderAdmin(){
    $('[data-view="admin"]').innerHTML = `<div class="page-shell">
      ${pageHeading("Administration", "Membres", "Accès à la confrérie, comptes invités et rôles.", `<span class="admin-badge">Mode démonstration</span>`)}
      <div class="admin-summary"><article><span>Membres</span><strong>24</strong></article><article><span>Comptes invités</span><strong>2</strong></article><article><span>Actifs cette semaine</span><strong>19</strong></article></div>
      <div class="section-title-row"><h2>Comptes invités</h2><span>Validation manuelle</span></div>
      <div class="member-table">${DATA.members.map(member => `<article><span class="member-seal">${member.name.slice(0,1)}</span><div><b>${member.name}</b><small>${member.roster}</small></div><span>${member.role}</span><em>${member.status}</em><button type="button" data-action="member-action">${member.status === "Invité" ? "Accueillir" : "Gérer"}</button></article>`).join("")}</div>
    </div>`;
  }

  function icon(name){
    const paths = {
      home:'<path d="M6 27 20 15l14 12v12H24v-9h-8v9H6z"/>',
      teams:'<path d="M20 6v34M8 23h24M12 11l16 24M28 11 12 35"/>',
      boss:'<path d="M20 5 34 11v10c0 9-6 15-14 18C12 36 6 30 6 21V11zM13 22l5 5 9-11"/>',
      roster:'<circle cx="15" cy="15" r="6"/><circle cx="29" cy="17" r="5"/><path d="M4 37v-5c0-7 5-11 11-11s11 4 11 11v5m1-13c6 0 10 4 10 10v3"/>',
      more:'<circle cx="9" cy="22" r="1.5"/><circle cx="20" cy="22" r="1.5"/><circle cx="31" cy="22" r="1.5"/>'
    };
    return `<svg viewBox="0 0 40 44" aria-hidden="true">${paths[name]}</svg>`;
  }

  function renderHeader(){
    const guildRoute = state.session === "member" ? "dashboard" : "home";
    $("#appHeader").innerHTML = `
      <a class="brand" href="#${guildRoute}" data-route="${guildRoute}" aria-label="NOVA, accueil">
        <span class="brand-mark" aria-hidden="true">7</span>
        <span>Confrérie 7DS</span>
      </a>
      <nav class="desktop-nav" aria-label="Navigation principale">
        <button type="button" data-route="${guildRoute}">Notre guilde</button>
        <button type="button" data-route="teams">Équipes</button>
        <button type="button" data-route="roster">Roster</button>
        <div class="tools-menu">
          <button type="button" id="toolsMenuButton" aria-expanded="false" aria-controls="toolsMenu">Outils <span aria-hidden="true">⌄</span></button>
          <div class="tools-popover" id="toolsMenu" hidden>
            ${DATA.tools.map(tool => `<button type="button" data-route="tools" data-tool="${tool === "Calculateur" ? "calculator" : tool === "Analyse" ? "analysis" : tool.toLowerCase()}">${tool}</button>`).join("")}
          </div>
        </div>
      </nav>
      <button class="account-button" type="button" data-action="account">
        <span aria-hidden="true">♙</span>${state.session === "member" ? "YanniSs13" : "Connexion"}
      </button>
      <button class="menu-button" id="mobileMenuButton" type="button" data-action="mobile-menu" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="mobileDrawer"><span></span><span></span><span></span></button>
      <aside class="mobile-drawer" id="mobileDrawer" hidden>
        <p>Explorer</p>
        <button type="button" data-route="${guildRoute}">Notre guilde</button>
        <button type="button" data-route="teams">Équipes</button>
        <button type="button" data-route="roster">Roster</button>
        ${DATA.tools.map(tool => `<button type="button" data-route="tools" data-tool="${tool === "Calculateur" ? "calculator" : tool === "Analyse" ? "analysis" : tool.toLowerCase()}">${tool}</button>`).join("")}
        <button type="button" data-action="account">${state.session === "member" ? "Mon compte" : "Connexion"}</button>
      </aside>`;

    $(".mobile-nav").innerHTML = [
      ["home", "Accueil", guildRoute],
      ["teams", "Équipes", "teams"],
      ["boss", "Boss", "boss"],
      ["roster", "Roster", "roster"]
    ].map(([glyph, label, route]) => `
      <button type="button" data-route="${route}">${icon(glyph)}<span>${label}</span></button>`).join("")
      + `<button type="button" data-action="mobile-menu">${icon("more")}<span>Plus</span></button>`;
  }

  function updateNavigation(route){
    $$('[data-route]').forEach(button => {
      const selected = button.dataset.route === route
        || (route === "dashboard" && button.dataset.route === "dashboard");
      if(selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function showView(viewId, options={}){
    const route = Object.hasOwn(ROUTES, viewId) ? viewId : "home";
    if(route === "boss") renderBoss();
    if(route === "teams") renderTeams();
    if(route === "roster") renderRoster();
    if(route === "tools") renderTools();
    if(route === "admin") renderAdmin();
    $$("[data-view]").forEach(view => {
      const active = view.dataset.view === route;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    updateNavigation(route);
    document.title = `${ROUTES[route]} — NOVA`;
    if(options.push !== false && location.hash !== `#${route}`){
      history.pushState(null, "", `#${route}`);
    }
    closeMenus();
    if(options.focus !== false){
      const title = $(`[data-view="${route}"] h1`);
      if(title){
        title.tabIndex = -1;
        title.focus({ preventScroll:true });
      }
      window.scrollTo({ top:0, behavior:"smooth" });
    }
  }

  function closeMenus(){
    const tools = $("#toolsMenu");
    const toolsButton = $("#toolsMenuButton");
    const drawer = $("#mobileDrawer");
    const menuButton = $("#mobileMenuButton");
    if(tools) tools.hidden = true;
    if(toolsButton) toolsButton.setAttribute("aria-expanded", "false");
    if(drawer) drawer.hidden = true;
    if(menuButton) menuButton.setAttribute("aria-expanded", "false");
  }

  function toggleToolsMenu(){
    const menu = $("#toolsMenu");
    const button = $("#toolsMenuButton");
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  function toggleMobileMenu(){
    const drawer = $("#mobileDrawer");
    const button = $("#mobileMenuButton");
    const open = drawer.hidden;
    closeMenus();
    drawer.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if(open) drawer.querySelector("button")?.focus();
  }

  function modalContent(kind, information={}){
    if(kind === "info"){
      return {
        title:information.title || "Action de démonstration",
        body:`<p class="modal-copy">${information.copy || "Cette action sera reliée aux données réelles lors de la refonte du site."}</p><button class="gold-action modal-primary" type="button" data-action="close-modal">Compris</button>`
      };
    }
    if(kind === "account" && state.session === "member"){
      return {
        title:"Compte de YanniSs13",
        body:`<p class="modal-copy">Synchronisé avec la confrérie · à l'instant</p>
          <button class="modal-choice" type="button" data-route="admin">Administration des membres</button>
          <button class="modal-choice" type="button" data-action="offline">Voir l'état hors ligne</button>
          <button class="modal-choice" type="button" data-action="logout">Se déconnecter</button>`
      };
    }
    return {
      title:"Rejoindre la confrérie",
      body:`<p class="modal-copy">Cette maquette n'utilise aucun compte réel. Active le mode membre pour découvrir Mon suivi et les actions partagées.</p>
        <button class="gold-action modal-primary" type="button" data-action="demo-login">Entrer en mode membre</button>`
    };
  }

  function openDemoModal(kind="login", information={}){
    state.lastFocus = document.activeElement;
    const content = modalContent(kind, information);
    const layer = $("#demoModal");
    layer.innerHTML = `
      <button class="modal-backdrop" type="button" data-action="close-modal" aria-label="Fermer"></button>
      <section class="modal-card ornate-panel" role="dialog" aria-modal="true" aria-labelledby="demoModalTitle">
        <div class="modal-head"><h2 id="demoModalTitle">${content.title}</h2><button type="button" data-action="close-modal" aria-label="Fermer">×</button></div>
        <div class="modal-body">${content.body}</div>
      </section>`;
    layer.hidden = false;
    layer.querySelector("button:not(.modal-backdrop)")?.focus();
  }

  function closeDemoModal(){
    const layer = $("#demoModal");
    if(layer.hidden) return;
    layer.hidden = true;
    layer.innerHTML = "";
    state.lastFocus?.focus();
  }

  function setDemoSession(mode){
    state.session = mode === "member" ? "member" : "public";
    document.body.dataset.session = state.session;
    closeDemoModal();
    renderHeader();
    if(state.session === "member") showView("dashboard");
    else showView("home");
  }

  function focusableInModal(){
    return $$("#demoModal button:not([disabled]), #demoModal a[href]")
      .filter(element => element.offsetParent !== null);
  }

  document.addEventListener("click", event => {
    const route = event.target.closest("[data-route]");
    const action = event.target.closest("[data-action]");
    const bossTab = event.target.closest("[data-boss-tab]");
    const teamMode = event.target.closest("[data-team-mode]");
    const rosterMode = event.target.closest("[data-roster-mode]");
    const toolTab = event.target.closest("[data-tool-tab]");
    const heroButton = event.target.closest("[data-hero-index]");
    const demoState = event.target.closest("[data-demo-state]");
    if(teamMode){ renderTeams(teamMode.dataset.teamMode); return; }
    if(rosterMode){ renderRoster(rosterMode.dataset.rosterMode); return; }
    if(toolTab){ renderTools(toolTab.dataset.toolTab); return; }
    if(heroButton){
      state.heroIndex = Number(heroButton.dataset.heroIndex) || 0;
      renderTeams("builder");
      return;
    }
    if(bossTab){
      renderBoss(bossTab.dataset.bossTab);
      return;
    }
    if(demoState){
      const descriptions = {
        empty:"Toutes tes actions sont terminées pour cette semaine.",
        offline:"Le Builder reste disponible. Les données partagées reprendront à la reconnexion.",
        error:"La lecture a échoué. Réessaie sans perdre le contenu déjà affiché."
      };
      openDemoModal("info", { title:demoState.textContent, copy:descriptions[demoState.dataset.demoState] });
      return;
    }
    if(route){
      event.preventDefault();
      if(route.dataset.tool) state.tool = route.dataset.tool;
      if(route.dataset.bossTarget) state.bossTab = route.dataset.bossTarget;
      showView(route.dataset.route);
      return;
    }
    if(!action) return;
    const name = action.dataset.action;
    if(name === "account" || name === "create-account") openDemoModal("account");
    if(name === "demo-login") setDemoSession("member");
    if(name === "logout") setDemoSession("public");
    if(name === "close-modal") closeDemoModal();
    if(name === "mobile-menu") toggleMobileMenu();
    if(name === "collection-toggle"){
      action.classList.toggle("is-owned");
      const status = action.querySelector("em");
      if(status) status.textContent = action.classList.contains("is-owned") ? "Possédé" : "À trouver";
    }
    if(name === "open-group"){
      state.bossTab = "groups";
      showView("boss");
    }
    if(["open-info", "choose-team", "join-group", "finish-run", "correct-report", "offline", "new-team", "save-team", "preset", "capture-import", "gear", "open-roster", "favorite", "add-hero", "calculate", "member-action"].includes(name)){
      const titles = {
        "choose-team":"Choisir mon équipe",
        "join-group":"Rejoindre le groupe",
        "finish-run":"Terminer la run",
        "correct-report":"Corriger le rapport",
        offline:"Mode hors ligne",
        "new-team":"Nouvelle équipe",
        "save-team":"Équipe enregistrée",
        preset:"Presets d'équipement",
        "capture-import":"Importer des captures",
        gear:"Configurer l'équipement",
        "open-roster":"Fiche du roster",
        favorite:"Build favori",
        "add-hero":"Ajouter un personnage",
        calculate:"Comparaison calculée",
        "member-action":"Gérer le membre"
      };
      openDemoModal("info", {
        title:action.dataset.modalTitle || titles[name] || "Détail",
        copy:name === "offline"
          ? "Le Builder reste accessible ; les espaces partagés attendent le retour du réseau."
          : "Le prototype montre ici le parcours final sans enregistrer de données."
      });
    }
  });

  document.addEventListener("click", event => {
    if(event.target.closest("#toolsMenuButton")) toggleToolsMenu();
  });

  document.addEventListener("keydown", event => {
    if(event.key === "Escape"){
      if(!$("#demoModal").hidden) closeDemoModal();
      else closeMenus();
      return;
    }
    if(event.key !== "Tab" || $("#demoModal").hidden) return;
    const focusable = focusableInModal();
    if(!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); }
    else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); }
  });

  window.addEventListener("popstate", () => showView(routeFromHash(), { push:false }));
  renderDashboard();
  renderBoss();
  renderTeams();
  renderRoster();
  renderTools();
  renderAdmin();
  renderHeader();
  showView(routeFromHash(), { push:false, focus:false });
})();
