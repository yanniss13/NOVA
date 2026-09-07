/* Les rubriques de la navigation, et les vues que chacune abrite.

   La barre d'onglets d'avant la refonte alignait dix vues a plat, avec un seul
   groupe — le Boss de Guilde et ses trois sous-onglets, decrits en dur dans
   `js/vues/navigation.js`. La maquette generalise ce groupe : six rubriques,
   chacune avec ses onglets locaux. Cette table est la generalisation.

   Elle vit dans `metier` parce qu'elle ne connait ni le DOM ni la session :
   c'est une carte, pas un rendu. `js/vues/navigation.js` la lit pour surligner
   la bonne entree ; la coquille la lit pour ecrire ses onglets.

   DEUX REGLES que `tests/rubriques.test.js` protege :

   1. une vue appartient a EXACTEMENT une rubrique. Sans quoi deux entrees de
      navigation se surligneraient en meme temps ;
   2. un identifiant de rubrique n'est JAMAIS un nom de vue. Le piege est reel :
      la vue `roster` du site est « Equipes dispo pour le Boss de Guilde »,
      tandis que la rubrique Roster de la maquette designe le roster personnel,
      c'est-a-dire la vue `member-roster`. Deux choses differentes qui
      voudraient le meme mot. Les rubriques prennent donc des identifiants qui
      leur sont propres. */

/* `chef` est la vue qu'ouvre un clic sur la rubrique elle-meme.

   L'ACCUEIL EST LE CHEF POUR TOUT LE MONDE. Une premiere version envoyait le
   membre connecte droit sur Mon suivi : « Notre guilde » lui aurait montre
   ses chiffres plutot que la page de presentation. Le proprietaire a tranche
   dans l'autre sens — l'accueil est la plus belle page du site, un membre ne
   doit pas en etre prive, elle doit lui SERVIR. Elle reste donc la page
   d'arrivee de tous ; ce qu'elle propose change avec la session, et Mon suivi
   devient un onglet local de la rubrique. */
const RUBRIQUES = Object.freeze([
  {
    id:"guilde",
    libelle:"Notre guilde",
    chef:"home",
    vues:["home", "dashboard"],
    onglets:[
      { vue:"home", libelle:"Accueil" },
      { vue:"dashboard", libelle:"Mon suivi" }
    ]
  },
  {
    id:"equipes",
    libelle:"Équipes",
    chef:"builder",
    vues:["builder", "roster"],
    onglets:[
      { vue:"builder", libelle:"Créer une équipe" },
      { vue:"roster", libelle:"Équipes partagées" }
    ]
  },
  {
    id:"centre-boss",
    libelle:"Boss de guilde",
    chef:"boss",
    vues:["availability", "boss"],
    onglets:[
      { vue:"availability", libelle:"Disponibilités" },
      { vue:"boss", libelle:"Groupes et rapports" }
    ]
  },
  {
    id:"mon-roster",
    libelle:"Roster",
    chef:"member-roster",
    vues:["member-roster"],
    onglets:[]
  },
  {
    id:"outils",
    libelle:"Outils",
    chef:"wiki",
    vues:["wiki", "collection", "calculateur", "analyse"],
    onglets:[
      { vue:"wiki", libelle:"Wiki" },
      { vue:"collection", libelle:"Collection" },
      { vue:"calculateur", libelle:"Calculateur" },
      { vue:"analyse", libelle:"Analyse" }
    ]
  },
  {
    id:"membres",
    libelle:"Membres",
    chef:"admin",
    vues:["admin"],
    onglets:[]
  }
]);

function rubriqueParId(id){
  return RUBRIQUES.find(rubrique => rubrique.id === id) || null;
}

function rubriqueDeVue(vue){
  const trouvee = RUBRIQUES.find(rubrique => rubrique.vues.includes(vue));
  return trouvee ? trouvee.id : null;
}

/* Rend toujours un tableau : la coquille boucle dessus sans avoir a se
   demander si la rubrique existe ou si elle a des onglets. */
function ongletsDeRubrique(id){
  const rubrique = rubriqueParId(id);
  return rubrique ? rubrique.onglets : [];
}

/* La vue qu'ouvre un clic sur la rubrique. Elle ne depend plus de la session :
   un membre et un visiteur cliquent « Notre guilde » et arrivent tous deux sur
   l'accueil. Ce que chacun y trouve, c'est la page qui le decide. */
function vueChefDeRubrique(id){
  const rubrique = rubriqueParId(id);
  return rubrique ? rubrique.chef : null;
}

export {
  RUBRIQUES,
  ongletsDeRubrique,
  rubriqueDeVue,
  rubriqueParId,
  vueChefDeRubrique
};
