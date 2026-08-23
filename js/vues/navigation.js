/* Les onglets principaux, et le registre des vues qu'ils affichent.

   Pourquoi un registre plutot qu'une suite de `if(name==="boss")` : `showView`
   devait citer chaque vue, donc les importer toutes. Toute vue qui voulait
   changer d'onglet — les sessions de boss le font cinq fois — creait alors un
   cycle. Ici la navigation ne connait personne : chaque vue s'annonce au
   chargement, et `showView` ne fait que chercher dans le registre.

   Le contrat d'un rendu enregistre : appele sans argument, il renvoie ce que
   `showView` doit renvoyer. Les vues dont le resultat n'interesse personne
   enregistrent une enveloppe qui renvoie `true` — c'est l'appelant qui sait,
   pas la navigation.

   La valeur de retour sert a « Mon suivi » : ses actions attendent que la vue
   destination soit rendue avant de cibler un element dedans.

   Ce module est aussi le portier : c'est ici, et nulle part ailleurs, qu'on
   decide qu'une vue est hors de portee d'un visiteur sans compte. Le passage
   par `showView` etant obligatoire, les onze appels disperses dans les vues
   — « Mon suivi » et les sessions de boss surtout — sont couverts sans qu'un
   seul ait a connaitre la session. */

import { visiteurAnonyme } from "../etat/session.js";
import { fragmentDeRoute, routeDeVue } from "../metier/routage.js";

  /* Deux barres, deux niveaux. La principale porte huit onglets ; la seconde
     n'apparait que dans le groupe « Boss de Guilde » et en porte trois.

     Les selecteurs sont SCOPES a leur barre : un `.tab[data-view]` global
     melangerait les deux, et la fleche droite du dernier onglet principal
     partirait dans le sous-menu — un niveau que l'utilisateur n'a pas demande
     a parcourir. */
  const mainTabs = [...document.querySelectorAll(".tabs .tab[data-view]")];
  const subTabs = [...document.querySelectorAll(".subtabs .tab[data-view]")];
  const subBar = document.querySelector(".subtabs");
  const mobileViewButtons = [
    ...document.querySelectorAll("[data-mobile-view]")
  ];
  const mobileNavMore = document.querySelector("#mobileNavMore");
  const mobileBossSubBar = document.querySelector("#mobileBossSubtabs");
  const mobileMorePanel = document.querySelector("#mobileMorePanel");
  const mobileMoreBackdrop = document.querySelector("#mobileMoreBackdrop");
  let mobileMoreScrollLock = null;

  /* LE GROUPE. Trois vues qui parlent du meme sujet et qui encombraient la
     barre principale : les equipes du Boss de Guilde, les dispos des membres,
     et les sessions. Le chef est `roster` - c'est la vue qu'ouvre l'onglet du
     groupe, et celle qui reste surlignee tant qu'on est dans le groupe.

     Une seule liste ici : la barre secondaire est construite dans index.html,
     mais c'est cette constante qui decide de l'appartenance. Les deux ne
     peuvent pas diverger sans qu'un test le voie. */
  const GROUPE_BOSS = "roster";
  const VUES_DU_GROUPE = new Set(["roster", "availability", "boss"]);
  const VUES_DANS_PLUS = new Set(["analyse", "wiki", "collection", "calculateur"]);

  function chefDuGroupe(nom){
    return VUES_DU_GROUPE.has(nom) ? GROUPE_BOSS : null;
  }

  /* L'ONGLET QUI OUVRE UNE VUE, dans l'une ou l'autre barre.

     Les vues appelantes ne doivent pas savoir a quel etage vit un onglet :
     elles s'en servent pour rendre le focus apres une modale, et le jour ou
     « Sessions de boss » est passe au sous-menu, une recherche limitee a la
     barre principale a rendu `undefined` - le focus tombait alors sur le
     document, sans que rien ne le signale.

     Pour `roster`, la barre principale gagne : c'est l'onglet du groupe, celui
     qui reste visible quelle que soit la vue ouverte. */
  function ongletDeLaVue(nom){
    return mainTabs.find(button => button.dataset.view === nom)
      || subTabs.find(button => button.dataset.view === nom)
      || null;
  }

  const rendus = new Map();

  function enregistrerVue(nom, rendu){
    rendus.set(nom, rendu);
  }

  /* Les pages qui tiennent debout sans compte. Le Builder compose en local, le
     Wiki et la Collection se consultent, et le Calculateur s'ouvre depuis un
     heros du Builder. Tout le reste — suivi, equipes, dispos, roster, analyse,
     sessions — lit des donnees liees a un compte. */
  const VUES_PUBLIQUES = new Set(["builder", "wiki", "collection", "calculateur"]);
  const VUE_DE_REPLI = "wiki";

  function vuePublique(nom){
    return VUES_PUBLIQUES.has(nom);
  }

  function vueAutorisee(nom){
    return vuePublique(nom) || !visiteurAnonyme();
  }

  function ongletsAtteignables(barre){
    return barre.filter(button => !button.hidden);
  }

  /* Appelee a chaque changement de session, depuis session-auth.js. Elle
     range les deux barres, puis rattrape la navigation si elle vient de
     fermer la porte sous les pieds du visiteur. */
  function appliquerVisibiliteOnglets(options){
    const settings = Object.assign({ historyMode:"replace" }, options || {});
    mainTabs.concat(subTabs, mobileViewButtons).forEach(button => {
      const vue = button.dataset.view || button.dataset.mobileView;
      button.hidden = !vueAutorisee(vue);
    });
    const active = document.querySelector(".view.active");
    const nomActif = active ? active.id.replace(/^view-/, "") : "";
    if(nomActif && !vueAutorisee(nomActif)){
      void showView(VUE_DE_REPLI, { historyMode:settings.historyMode });
    }
  }

  function showView(name, options){
    const settings = Object.assign({ historyMode:"push" }, options || {});
    /* Le repli est prefere a un retour sec : une navigation qui ne mene nulle
       part laisse l'onglet precedent surligne et la page inchangee, ce qui se
       lit comme une panne. */
    if(!vueAutorisee(name)){
      return showView(VUE_DE_REPLI, {
        historyMode:settings.historyMode === "none" ? "none" : "replace"
      });
    }
    const route = routeDeVue(name);
    const fragment = route && fragmentDeRoute(route);
    if(fragment && settings.historyMode !== "none"
      && location.hash !== fragment){
      if(settings.historyMode === "replace"){
        history.replaceState(null, "", fragment);
      }else{
        history.pushState(null, "", fragment);
      }
    }
    /* L'onglet du groupe reste surligne dans les trois vues qu'il ouvre :
       sinon la barre principale n'indiquerait plus ou l'on est des qu'on passe
       aux Dispos ou aux Sessions. */
    const chef = chefDuGroupe(name);
    document.documentElement.classList.toggle("has-mobile-subnav", chef !== null);
    mainTabs.forEach(button => {
      const selected = button.dataset.view === name
        || (chef !== null && button.dataset.view === chef);
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    /* La seconde ligne n'existe que dans le groupe. `hidden` plutot qu'une
       classe : elle sort ainsi de l'arbre d'accessibilite et de l'ordre de
       tabulation, au lieu de rester une cible invisible. */
    if(subBar) subBar.hidden = chef === null;
    if(mobileBossSubBar) mobileBossSubBar.hidden = chef === null;
    subTabs.forEach(button => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    mobileViewButtons.forEach(button => {
      const vue = button.dataset.mobileView;
      /* « Le chef reste allume dans tout le groupe » ne vaut que pour la barre
         du bas, qui designe la FAMILLE de vues. Dans la sous-barre, chaque
         bouton designe UNE vue : « Équipes » porte pourtant `roster` comme le
         bouton du groupe, et heritait donc de son surlignage — deux
         sous-onglets brillaient ensemble et la barre mentait sur l'endroit ou
         l'on se trouve. */
      const dansLaSousBarre = !!mobileBossSubBar
        && mobileBossSubBar.contains(button);
      const selected = vue === name
        || (!dansLaSousBarre && vue === GROUPE_BOSS && chef !== null);
      button.classList.toggle("active", selected);
      if(button.getAttribute("role") === "tab"){
        button.setAttribute("aria-selected", String(selected));
      }
      if(selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if(mobileNavMore){
      const selected = VUES_DANS_PLUS.has(name);
      mobileNavMore.classList.toggle("active", selected);
      if(selected) mobileNavMore.setAttribute("aria-current", "page");
      else mobileNavMore.removeAttribute("aria-current");
    }
    fermerPlusMobile(false);
    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("active", view.id === "view-"+name);
    });
    const rendu = rendus.get(name);
    const result = rendu ? Promise.resolve(rendu()) : Promise.resolve(true);
    const reduced = window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top:0, behavior:reduced ? "auto" : "smooth"});
    return result;
  }

  /* La liste parcourue est celle des onglets ATTEIGNABLES de LA MEME barre,
     relue a chaque touche : un rang fige a la construction enverrait la fleche
     sur un bouton masque, donc le focus dans le vide. Chaque barre boucle sur
     elle-meme - c'est ce que la fleche fait dans un `tablist`, et deux
     niveaux ne se parcourent pas d'une seule touche. */
  function brancherOnglets(barre){
  barre.forEach(button => {
    button.addEventListener("click", ()=>showView(button.dataset.view));
    button.addEventListener("keydown", event => {
      const atteignables = ongletsAtteignables(barre);
      const index = atteignables.indexOf(button);
      if(index === -1) return;
      let next = null;
      if(event.key === "ArrowRight") next = (index + 1) % atteignables.length;
      if(event.key === "ArrowLeft"){
        next = (index - 1 + atteignables.length) % atteignables.length;
      }
      if(event.key === "Home") next = 0;
      if(event.key === "End") next = atteignables.length - 1;
      if(next === null) return;
      event.preventDefault();
      const target = atteignables[next];
      showView(target.dataset.view);
      target.focus();
    });
  });
  }
  brancherOnglets(mainTabs);
  brancherOnglets(subTabs);

  function verrouillerFondPlus(){
    if(mobileMoreScrollLock) return;
    const body = document.body;
    mobileMoreScrollLock = {
      scrollY:window.scrollY,
      position:body.style.position,
      top:body.style.top,
      left:body.style.left,
      right:body.style.right,
      width:body.style.width,
      overflow:body.style.overflow
    };
    body.classList.add("mobile-more-open");
    body.style.position = "fixed";
    body.style.top = `-${mobileMoreScrollLock.scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
  }

  function deverrouillerFondPlus(){
    if(!mobileMoreScrollLock) return;
    const body = document.body;
    const lock = mobileMoreScrollLock;
    mobileMoreScrollLock = null;
    body.style.position = lock.position;
    body.style.top = lock.top;
    body.style.left = lock.left;
    body.style.right = lock.right;
    body.style.width = lock.width;
    body.style.overflow = lock.overflow;
    body.classList.remove("mobile-more-open");
    window.scrollTo(0, lock.scrollY);
  }

  function fermerPlusMobile(restaurerFocus){
    if(!mobileMorePanel || mobileMorePanel.hidden) return;
    mobileMorePanel.hidden = true;
    if(mobileMoreBackdrop) mobileMoreBackdrop.hidden = true;
    if(mobileNavMore) mobileNavMore.setAttribute("aria-expanded", "false");
    deverrouillerFondPlus();
    if(restaurerFocus && mobileNavMore) mobileNavMore.focus();
  }

  function ouvrirPlusMobile(){
    if(!mobileMorePanel || !mobileNavMore) return;
    mobileMorePanel.hidden = false;
    if(mobileMoreBackdrop) mobileMoreBackdrop.hidden = false;
    mobileNavMore.setAttribute("aria-expanded", "true");
    verrouillerFondPlus();
    const active = mobileMorePanel.querySelector("[aria-current='page']:not([hidden])");
    const first = mobileMorePanel.querySelector("button:not([hidden])");
    (active || first || mobileMorePanel).focus();
  }

  mobileViewButtons.forEach(button => {
    button.addEventListener("click", () => {
      const depuisPlus = mobileMorePanel && mobileMorePanel.contains(button);
      void showView(button.dataset.mobileView);
      if(depuisPlus && mobileNavMore) mobileNavMore.focus();
    });
  });
  if(mobileNavMore){
    mobileNavMore.addEventListener("click", () => {
      if(mobileMorePanel && mobileMorePanel.hidden) ouvrirPlusMobile();
      else fermerPlusMobile(false);
    });
  }
  if(mobileMoreBackdrop){
    mobileMoreBackdrop.addEventListener("click", () => fermerPlusMobile(true));
  }
  document.addEventListener("keydown", event => {
    if(event.key === "Escape" && mobileMorePanel && !mobileMorePanel.hidden){
      event.preventDefault();
      fermerPlusMobile(true);
    }
  });
  document.addEventListener("focusin", event => {
    if(!mobileMorePanel || mobileMorePanel.hidden) return;
    if(mobileMorePanel.contains(event.target) || event.target === mobileNavMore) return;
    fermerPlusMobile(false);
  });

  ["mobileAccountLogin", "mobileAuthLogout", "mobileBtnMigrateLocal"]
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .forEach(button => button.addEventListener("click", () => fermerPlusMobile(false)));

  const mobileBreakpoint = window.matchMedia
    ? window.matchMedia("(max-width:560px)")
    : null;
  function normaliserPlusHorsMobile(event){
    if(event.matches || !mobileMorePanel || mobileMorePanel.hidden) return;
    const focusEtaitMobile = mobileMorePanel.contains(document.activeElement)
      || document.activeElement === mobileNavMore;
    const active = document.querySelector(".view.active");
    const nomActif = active ? active.id.replace(/^view-/, "") : "";
    fermerPlusMobile(false);
    if(focusEtaitMobile){
      const onglet = ongletDeLaVue(nomActif);
      if(onglet) onglet.focus();
    }
  }
  if(mobileBreakpoint){
    if(mobileBreakpoint.addEventListener){
      mobileBreakpoint.addEventListener("change", normaliserPlusHorsMobile);
    }else if(mobileBreakpoint.addListener){
      mobileBreakpoint.addListener(normaliserPlusHorsMobile);
    }
  }

export {
  appliquerVisibiliteOnglets,
  enregistrerVue,
  ongletDeLaVue,
  showView,
  vueAutorisee,
  vuePublique
};
