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
   destination soit rendue avant de cibler un element dedans. */

  const mainTabs = [...document.querySelectorAll(".tab[data-view]")];

  const rendus = new Map();

  function enregistrerVue(nom, rendu){
    rendus.set(nom, rendu);
  }

  function showView(name){
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

  mainTabs.forEach((button, index) => {
    button.addEventListener("click", ()=>showView(button.dataset.view));
    button.addEventListener("keydown", event => {
      let next = null;
      if(event.key === "ArrowRight") next = (index + 1) % mainTabs.length;
      if(event.key === "ArrowLeft"){
        next = (index - 1 + mainTabs.length) % mainTabs.length;
      }
      if(event.key === "Home") next = 0;
      if(event.key === "End") next = mainTabs.length - 1;
      if(next === null) return;
      event.preventDefault();
      const target = mainTabs[next];
      showView(target.dataset.view);
      target.focus();
    });
  });

export { enregistrerVue, mainTabs, showView };
