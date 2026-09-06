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
    lastFocus:null
  };

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const routeFromHash = () => {
    const route = location.hash.replace(/^#/, "").split("/")[0];
    return Object.hasOwn(ROUTES, route) ? route : "home";
  };

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

  function modalContent(kind){
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

  function openDemoModal(kind="login"){
    state.lastFocus = document.activeElement;
    const content = modalContent(kind);
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
  renderHeader();
  showView(routeFromHash(), { push:false, focus:false });
})();
