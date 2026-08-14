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

  const mainTabs = [...document.querySelectorAll(".tab[data-view]")];

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

  function vueAutorisee(nom){
    return VUES_PUBLIQUES.has(nom) || !visiteurAnonyme();
  }

  function ongletsAtteignables(){
    return mainTabs.filter(button => !button.hidden);
  }

  /* Appelee a chaque changement de session, depuis session-auth.js. Elle
     range la barre, puis rattrape la navigation si elle vient de fermer la
     porte sous les pieds du visiteur. */
  function appliquerVisibiliteOnglets(){
    mainTabs.forEach(button => {
      button.hidden = !vueAutorisee(button.dataset.view);
    });
    const active = document.querySelector(".view.active");
    const nomActif = active ? active.id.replace(/^view-/, "") : "";
    if(nomActif && !vueAutorisee(nomActif)) void showView(VUE_DE_REPLI);
  }

  function showView(name){
    /* Le repli est prefere a un retour sec : une navigation qui ne mene nulle
       part laisse l'onglet precedent surligne et la page inchangee, ce qui se
       lit comme une panne. */
    if(!vueAutorisee(name)) return showView(VUE_DE_REPLI);
    mainTabs.forEach(button => {
      const selected = button.dataset.view === name;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
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

  /* La liste parcourue est celle des onglets ATTEIGNABLES, relue a chaque
     touche : un rang fige a la construction enverrait la fleche sur un bouton
     masque, donc le focus dans le vide. */
  mainTabs.forEach(button => {
    button.addEventListener("click", ()=>showView(button.dataset.view));
    button.addEventListener("keydown", event => {
      const atteignables = ongletsAtteignables();
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

export { appliquerVisibiliteOnglets, enregistrerVue, mainTabs, showView };
