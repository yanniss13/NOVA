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

   `chefConnecte` est celle qu'elle ouvre a la place quand le visiteur y a
   droit. Un seul cas aujourd'hui : « Notre guilde » montre l'accueil public a
   un visiteur, et « Mon suivi » a un membre. C'est une DONNEE de la table,
   pas un `if` dans la coquille : la table ne connait pas la session, mais
   elle sait dire quelle vue prefererait un compte ouvert, et c'est le portier
   de `navigation.js` qui tranche. */
const RUBRIQUES = Object.freeze([
  {
    id:"guilde",
    libelle:"Notre guilde",
    chef:"home",
    chefConnecte:"dashboard",
    vues:["home", "dashboard"],
    onglets:[]
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

/* `autorisee` est le portier, passe par l'appelant : la table ne connait ni
   la session ni les droits. Sans lui, la vue chef ordinaire est rendue. */
function vueChefDeRubrique(id, autorisee){
  const rubrique = rubriqueParId(id);
  if(!rubrique) return null;
  const preferee = rubrique.chefConnecte;
  if(preferee && typeof autorisee === "function" && autorisee(preferee)){
    return preferee;
  }
  return rubrique.chef;
}

/* LA VUE QUI DOIT PRENDRE LA PLACE DE CELLE-CI quand un compte s'ouvre.

   Un visiteur atterrit sur l'accueil public. S'il se connecte, il ne doit pas
   y rester : sa rubrique a une vue de membre, et c'est elle qu'il attend.

   La regle est etroite a dessein. Elle ne vaut QUE si l'on se trouve sur la
   vue chef publique de la rubrique : un membre pose sur les equipes partagees
   ne doit pas etre renvoye vers « Creer une equipe » a la premiere
   verification de droits. */
function vuePreferee(vue, autorisee){
  const rubrique = rubriqueParId(rubriqueDeVue(vue));
  if(!rubrique || !rubrique.chefConnecte) return null;
  if(vue !== rubrique.chef) return null;
  if(typeof autorisee !== "function" || !autorisee(rubrique.chefConnecte)) return null;
  return rubrique.chefConnecte;
}

export {
  RUBRIQUES,
  ongletsDeRubrique,
  rubriqueDeVue,
  rubriqueParId,
  vueChefDeRubrique,
  vuePreferee
};
