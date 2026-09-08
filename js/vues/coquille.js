/* LA COQUILLE : en-tete, navigation, onglets locaux, barre du pouce.

   Tout ce qui entoure la vue ouverte. Ce module ne decide jamais QUELLE vue
   s'affiche — c'est le role de `navigation.js` — il montre seulement ou l'on
   se trouve et offre les moyens d'aller ailleurs.

   UNE SEULE SOURCE. Trois barres affichent la meme navigation : celle du
   bureau, le tiroir mobile et la barre du pouce. Les ecrire toutes les trois
   dans `index.html`, c'etait trois listes a tenir d'accord a la main, et
   l'ancienne barre en donnait la preuve — le compte y existait en double, six
   elements jumeaux. Les trois sont donc construites ici, depuis
   `js/metier/rubriques.js`.

   LE SENS DE LA DEPENDANCE. Ce module importe `navigation.js` ; jamais
   l'inverse. La navigation annonce le changement de vue par
   `surChangementDeVue`, et la coquille se range toute seule. */

import {
  RUBRIQUES, ongletsDeRubrique, rubriqueDeVue, rubriqueParId, vueChefDeRubrique
} from "../metier/rubriques.js";
import { $ } from "../noyau/dom.js";
import { openAuth } from "./modale-auth.js";
import {
  ouvrirSousVue, showView, sousVueCourante, surChangementDeVue,
  vueAutorisee, vueCourante
} from "./navigation.js";

/* Les quatre rubriques de la barre du pouce, dans l'ordre. Le cinquieme
   bouton est « Plus », qui ouvre le tiroir : les rubriques absentes d'ici —
   Outils et Membres — y sont. */
const RUBRIQUES_AU_POUCE = ["guilde", "equipes", "centre-boss", "mon-roster"];

/* La rubrique qui se deplie en menu plutot qu'en simple bouton. Quatre outils
   dans la barre du haut la feraient deborder. */
const RUBRIQUE_EN_MENU = "outils";

/* Traces des pictogrammes de la barre du pouce, reprises de la maquette.
   Decoratifs : le libelle visible est aussi le nom accessible. */
const TRACES = {
  guilde:'<path d="M6 27 20 15l14 12v12H24v-9h-8v9H6z"/>',
  equipes:'<path d="M20 6v34M8 23h24M12 11l16 24M28 11 12 35"/>',
  "centre-boss":'<path d="M20 5 34 11v10c0 9-6 15-14 18C12 36 6 30 6 21V11zM13 22l5 5 9-11"/>',
  "mon-roster":'<circle cx="15" cy="15" r="6"/><circle cx="29" cy="17" r="5"/>'
    + '<path d="M4 37v-5c0-7 5-11 11-11s11 4 11 11v5m1-13c6 0 10 4 10 10v3"/>',
  plus:'<circle cx="9" cy="22" r="1.5"/><circle cx="20" cy="22" r="1.5"/>'
    + '<circle cx="31" cy="22" r="1.5"/>'
};

/* Le menu Outils, garde sous la main des sa construction. Le retrouver par
   `closest` a chaque rangement ferait une traversee du DOM pour un element
   qu'on vient d'ecrire. */
let menuOutils = null;

function pictogramme(nom){
  return '<svg viewBox="0 0 40 44" aria-hidden="true">' + TRACES[nom] + "</svg>";
}

/* Un bouton, libelle par `textContent` : le libelle est du TEXTE, il ne doit
   jamais etre interprete comme du balisage. */
function boutonDeCoquille(libelle, attributs){
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.textContent = libelle;
  Object.entries(attributs).forEach(([nom, valeur]) => {
    bouton.setAttribute(nom, valeur);
  });
  return bouton;
}

/* Une rubrique est atteignable des qu'UNE de ses vues l'est. Outils reste
   ouvert a un visiteur par le Wiki, meme si l'Analyse lui est fermee. */
function rubriqueAtteignable(rubrique){
  return rubrique.vues.some(vueAutorisee);
}

function ouvrirRubrique(id){
  const vue = vueChefDeRubrique(id);
  if(vue) void showView(vue);
}

/* ============================ Construction ============================ */

function construireNavigationDeBureau(){
  const barre = $("#desktopNav");
  if(!barre) return;
  barre.textContent = "";
  RUBRIQUES.forEach(rubrique => {
    if(rubrique.id !== RUBRIQUE_EN_MENU){
      /* Un identifiant stable, sur cette barre seulement : le tiroir et la
         barre du pouce portent les memes entrees, et trois copies d'un meme
         identifiant n'en font plus un. Il sert a rendre le focus apres une
         modale, et aux tests. */
      barre.appendChild(boutonDeCoquille(rubrique.libelle, {
        id:"rubrique-" + rubrique.id,
        "data-rubrique":rubrique.id
      }));
      return;
    }
    const menu = document.createElement("div");
    menu.className = "tools-menu";
    const declencheur = boutonDeCoquille(rubrique.libelle, {
      id:"toolsMenuButton",
      "aria-haspopup":"true",
      "aria-expanded":"false",
      "aria-controls":"toolsMenu"
    });
    /* Le chevron s'ajoute apres le libelle : `textContent` l'aurait efface. */
    const chevron = document.createElement("span");
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = " ⌄";
    declencheur.appendChild(chevron);
    const surgissant = document.createElement("div");
    surgissant.className = "tools-popover";
    surgissant.id = "toolsMenu";
    surgissant.hidden = true;
    ongletsDeRubrique(rubrique.id).forEach(onglet => {
      surgissant.appendChild(boutonDeCoquille(onglet.libelle, {
        "data-view":onglet.vue
      }));
    });
    menu.appendChild(declencheur);
    menu.appendChild(surgissant);
    menuOutils = menu;
    barre.appendChild(menu);
  });
}

function construireTiroirMobile(){
  const tiroir = $("#mobileDrawer");
  if(!tiroir) return;
  tiroir.textContent = "";
  const titre = document.createElement("p");
  titre.textContent = "Explorer";
  tiroir.appendChild(titre);
  RUBRIQUES.forEach(rubrique => {
    /* Une rubrique a menu se deplie a plat dans le tiroir : un menu dans un
       tiroir demanderait deux gestes la ou un seul suffit. */
    const onglets = rubrique.id === RUBRIQUE_EN_MENU
      ? ongletsDeRubrique(rubrique.id)
      : [];
    if(!onglets.length){
      tiroir.appendChild(boutonDeCoquille(rubrique.libelle, {
        "data-rubrique":rubrique.id
      }));
      return;
    }
    onglets.forEach(onglet => {
      tiroir.appendChild(boutonDeCoquille(onglet.libelle, {
        "data-view":onglet.vue
      }));
    });
  });
  tiroir.appendChild(boutonDeCoquille("Mon compte", { "data-action":"compte" }));
}

function construireBarreAuPouce(){
  const barre = $("#mobileNav");
  if(!barre) return;
  barre.textContent = "";
  RUBRIQUES_AU_POUCE.forEach(id => {
    const rubrique = rubriqueParId(id);
    if(!rubrique) return;
    const bouton = boutonDeCoquille("", { "data-rubrique":id });
    bouton.innerHTML = pictogramme(id);
    const libelle = document.createElement("span");
    libelle.textContent = rubrique.libelle === "Notre guilde"
      ? "Accueil"
      : rubrique.libelle.replace("Boss de guilde", "Boss");
    bouton.appendChild(libelle);
    barre.appendChild(bouton);
  });
  const plus = boutonDeCoquille("", {
    id:"mobileMoreButton",
    "aria-haspopup":"true",
    "aria-expanded":"false",
    "aria-controls":"mobileDrawer"
  });
  plus.innerHTML = pictogramme("plus");
  const libellePlus = document.createElement("span");
  libellePlus.textContent = "Plus";
  plus.appendChild(libellePlus);
  barre.appendChild(plus);
}

/* ============================ Surlignage ============================ */

function remplirOngletsLocaux(rubriqueActive, vue){
  const barre = $("#localTabsBar");
  const liste = $("#localTabs");
  if(!barre || !liste) return;
  const onglets = ongletsDeRubrique(rubriqueActive)
    .filter(onglet => vueAutorisee(onglet.vue));
  /* Un seul onglet atteignable, ce n'est plus un choix : la barre se tait. */
  barre.hidden = onglets.length < 2;
  liste.textContent = "";
  /* Plusieurs onglets peuvent viser la meme vue et n'en changer que la
     sous-vue : leur identifiant et leur etat actif doivent donc tenir compte
     des deux, sinon trois onglets du centre Boss porteraient le meme `id` et
     s'allumeraient ensemble. */
  const sousVueActive = sousVueCourante(vue);
  onglets.forEach(onglet => {
    const actif = onglet.vue === vue
      && (!onglet.sousVue || onglet.sousVue === sousVueActive);
    const bouton = boutonDeCoquille(onglet.libelle, {
      id:"onglet-" + onglet.vue + (onglet.sousVue ? "-" + onglet.sousVue : ""),
      role:"tab",
      "data-view":onglet.vue,
      "aria-selected":String(actif),
      "aria-controls":"view-" + onglet.vue
    });
    if(onglet.sousVue) bouton.dataset.sousVue = onglet.sousVue;
    bouton.tabIndex = actif ? 0 : -1;
    liste.appendChild(bouton);
  });
}

/* LES TROIS BARRES QUE LA COQUILLE CONSTRUIT, et rien d'autre.

   `[data-rubrique]` visait tout le document. La coquille masquait donc aussi
   les boutons de l'accueil, qui portent le meme marqueur pour dire ou ils
   menent — et elle les REMONTRAIT juste apres que la session les avait
   caches : « Explorer les outils » restait affiche a un membre alors que
   « Creer mon compte », son voisin, disparaissait bien. Deux proprietaires
   pour un meme `hidden`, et le dernier qui ecrit gagne.

   La coquille ne range plus que ses propres barres. Ce qu'une VUE affiche lui
   appartient : l'accueil montre ses trois cartes a tout le monde, et c'est la
   modale de connexion qui accueille un visiteur au clic. */
const BARRES = "#desktopNav, #mobileDrawer, #mobileNav";
const dansLesBarres = selecteur => document.querySelectorAll(
  BARRES.split(", ").map(barre => barre + " " + selecteur).join(", "));

/* Range la coquille sur la vue ouverte : ce qui est hors de portee disparait,
   et l'entree de la rubrique courante s'allume. */
function rangerCoquille(vue){
  const active = vue || vueCourante();
  const rubriqueActive = rubriqueDeVue(active);

  dansLesBarres("[data-rubrique]").forEach(element => {
    const rubrique = rubriqueParId(element.dataset.rubrique);
    if(!rubrique) return;
    element.hidden = !rubriqueAtteignable(rubrique);
    if(rubrique.id === rubriqueActive) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });

  dansLesBarres("[data-view]").forEach(element => {
    element.hidden = !vueAutorisee(element.dataset.view);
    if(element.dataset.view === active) element.setAttribute("aria-current", "page");
    else element.removeAttribute("aria-current");
  });

  /* La rubrique en menu s'allume quand une de ses vues est ouverte : son
     declencheur ne porte pas `data-rubrique`, il vit dans le menu. */
  const declencheur = $("#toolsMenuButton");
  if(menuOutils){
    menuOutils.hidden = !rubriqueAtteignable(rubriqueParId(RUBRIQUE_EN_MENU));
  }
  if(declencheur){
    if(rubriqueActive === RUBRIQUE_EN_MENU){
      declencheur.setAttribute("aria-current", "page");
    }else{
      declencheur.removeAttribute("aria-current");
    }
  }

  const plus = $("#mobileMoreButton");
  if(plus){
    const dansLePlus = rubriqueActive
      && !RUBRIQUES_AU_POUCE.includes(rubriqueActive);
    if(dansLePlus) plus.setAttribute("aria-current", "page");
    else plus.removeAttribute("aria-current");
  }

  remplirOngletsLocaux(rubriqueActive, active);
}

/* L'entree qui ouvre une vue, quelle que soit la barre ou elle vit. Les vues
   s'en servent pour rendre le focus apres une modale. */
function ongletDeLaVue(nom){
  const rubrique = rubriqueDeVue(nom);
  return document.querySelector(`#localTabs [data-view="${nom}"]`)
    || document.querySelector(`#desktopNav [data-view="${nom}"]`)
    || (rubrique
      ? document.querySelector(`#desktopNav [data-rubrique="${rubrique}"]`)
      : null)
    || null;
}

/* ============================ Menus ============================ */

/* Les trois surgissants — outils, compte, tiroir — obeissent aux memes
   regles : un seul ouvert a la fois, Echap ferme, un clic ailleurs ferme. */
const SURGISSANTS = [
  { panneau:"#toolsMenu", declencheur:"#toolsMenuButton" },
  { panneau:"#accountMenu", declencheur:"#accountMenuButton" },
  /* Le tiroir a DEUX declencheurs : le bouton du menu en haut, et « Plus » en
     bas. Le focus doit revenir a celui qui l'a ouvert — le rendre toujours au
     premier renverrait le doigt en haut de l'ecran apres un geste au pouce. */
  { panneau:"#mobileDrawer", declencheur:"#mobileMenuButton,#mobileMoreButton" }
];

/* Le declencheur reellement employe, pour lui rendre le focus. */
let dernierDeclencheur = null;

function surgissantOuvert(){
  return SURGISSANTS.find(entree => {
    const panneau = $(entree.panneau);
    return panneau && !panneau.hidden;
  }) || null;
}

function fermerLesSurgissants(rendreLeFocus){
  const ouvert = surgissantOuvert();
  SURGISSANTS.forEach(entree => {
    const panneau = $(entree.panneau);
    if(panneau) panneau.hidden = true;
    document.querySelectorAll(entree.declencheur).forEach(bouton =>
      bouton.setAttribute("aria-expanded", "false"));
  });
  if(rendreLeFocus && ouvert && dernierDeclencheur){
    dernierDeclencheur.focus();
  }
  dernierDeclencheur = null;
}

function basculerSurgissant(selecteurPanneau, declencheur){
  const panneau = $(selecteurPanneau);
  if(!panneau) return;
  const etaitOuvert = !panneau.hidden;
  fermerLesSurgissants(false);
  if(etaitOuvert) return;
  dernierDeclencheur = declencheur || null;
  panneau.hidden = false;
  SURGISSANTS
    .filter(entree => entree.panneau === selecteurPanneau)
    .forEach(entree => {
      document.querySelectorAll(entree.declencheur).forEach(bouton =>
        bouton.setAttribute("aria-expanded", "true"));
    });
  const premier = panneau.querySelector("button:not([hidden])");
  (premier || panneau).focus();
}

/* ============================ Branchements ============================ */

function brancherCoquille(){
  /* UNE SEULE DELEGATION pour toute la coquille. Les barres sont
     reconstruites a chaque changement de droits : brancher chaque bouton
     individuellement demanderait de tout rebrancher a chaque fois, et un
     ecouteur oublie est un bouton mort et silencieux. */
  document.addEventListener("click", event => {
    /* Les declencheurs de menu n'ouvrent pas une vue : ils n'ont donc ni
       `data-view` ni `data-rubrique`, et doivent etre nommes ici. Les
       oublier faisait sortir la delegation avant de les voir, et le menu
       Outils ne s'ouvrait pas — sans la moindre erreur en console. */
    const cible = event.target.closest(
      "[data-rubrique],[data-view],[data-action],"
      + "#toolsMenuButton,#accountMenuButton,#mobileMenuButton,#mobileMoreButton");
    if(!cible) return;

    if(cible.dataset.action === "auth"){
      event.preventDefault();
      openAuth();
      return;
    }
    if(cible.dataset.action === "compte"){
      event.preventDefault();
      const connecte = $("#accountConnected");
      if(connecte && !connecte.hidden) basculerSurgissant("#accountMenu", cible);
      else openAuth();
      return;
    }
    if(cible === $("#toolsMenuButton")){
      basculerSurgissant("#toolsMenu", cible);
      return;
    }
    if(cible === $("#accountMenuButton")){
      basculerSurgissant("#accountMenu", cible);
      return;
    }
    if(cible.id === "mobileMenuButton" || cible.id === "mobileMoreButton"){
      basculerSurgissant("#mobileDrawer", cible);
      return;
    }
    /* La marque est un lien : le laisser suivre son href rechargerait la page. */
    if(cible.tagName === "A") event.preventDefault();
    if(cible.dataset.view){
      /* Un onglet peut viser une sous-vue : on la pose AVANT d'ouvrir la vue,
         sinon le rendu se ferait sur l'ancienne.

         Et si la vue est DEJA ouverte, on s'arrete la : `ouvrirSousVue` vient
         de redessiner, tandis que `showView` relancerait la lecture complete
         des donnees. Mesure faite : changer d'onglet dans le centre Boss
         relisait les 211 participations de la semaine pour rien. */
      if(cible.dataset.sousVue){
        ouvrirSousVue(cible.dataset.view, cible.dataset.sousVue);
        /* SEULEMENT pour un onglet de sous-vue. Recliquer l'onglet d'une vue
           ordinaire la redessine, et c'est voulu : c'est ainsi qu'on rafraichit
           un ecran. */
        if(cible.dataset.view !== vueCourante()) void showView(cible.dataset.view);
      }else{
        void showView(cible.dataset.view);
      }
    }
    else if(cible.dataset.rubrique) ouvrirRubrique(cible.dataset.rubrique);
    else return;
    /* Le menu se referme parce qu'une DESTINATION a ete choisie. Le refermer
       depuis `rangerCoquille` le fermait aussi a chaque verification de droits
       — un rafraichissement de session escamotait le menu sous le doigt. */
    fermerLesSurgissants(false);
  });

  /* Les fleches parcourent les onglets locaux, comme le veut un `tablist`. */
  document.addEventListener("keydown", event => {
    if(event.key === "Escape" && surgissantOuvert()){
      event.preventDefault();
      fermerLesSurgissants(true);
      return;
    }
    const liste = $("#localTabs");
    if(!liste || !liste.contains(event.target)) return;
    const onglets = [...liste.querySelectorAll("button")];
    const index = onglets.indexOf(event.target);
    if(index === -1) return;
    let suivant = null;
    if(event.key === "ArrowRight") suivant = (index + 1) % onglets.length;
    if(event.key === "ArrowLeft") suivant = (index - 1 + onglets.length) % onglets.length;
    if(event.key === "Home") suivant = 0;
    if(event.key === "End") suivant = onglets.length - 1;
    if(suivant === null) return;
    event.preventDefault();
    const cible = onglets[suivant];
    if(cible.dataset.sousVue){
      ouvrirSousVue(cible.dataset.view, cible.dataset.sousVue);
      if(cible.dataset.view !== vueCourante()) void showView(cible.dataset.view);
    }else{
      void showView(cible.dataset.view);
    }
    const rendu = ongletDeLaVue(cible.dataset.view);
    if(rendu) rendu.focus();
  });

  /* Un clic hors d'un surgissant le ferme. `focusin` plutot que `blur` : la
     tabulation doit fermer aussi, sinon le focus continue dans un panneau que
     l'on croit ferme. */
  document.addEventListener("focusin", event => {
    const ouvert = surgissantOuvert();
    if(!ouvert) return;
    const panneau = $(ouvert.panneau);
    const declencheur = $(ouvert.declencheur);
    if(panneau && panneau.contains(event.target)) return;
    if(declencheur && declencheur.contains(event.target)) return;
    fermerLesSurgissants(false);
  });
}

/* Le tiroir n'existe qu'en dessous de 768 px. Passe cette largeur, son
   declencheur disparait : le laisser ouvert le rendrait impossible a fermer. */
function surveillerLaLargeur(){
  if(!window.matchMedia) return;
  const mobile = window.matchMedia("(max-width:767px)");
  const normaliser = evenement => {
    if(evenement.matches) return;
    const tiroir = $("#mobileDrawer");
    if(tiroir && !tiroir.hidden) fermerLesSurgissants(false);
  };
  if(mobile.addEventListener) mobile.addEventListener("change", normaliser);
  else if(mobile.addListener) mobile.addListener(normaliser);
}

function initialiserCoquille(){
  construireNavigationDeBureau();
  construireTiroirMobile();
  construireBarreAuPouce();
  brancherCoquille();
  surveillerLaLargeur();
  surChangementDeVue(rangerCoquille);
  rangerCoquille(vueCourante());
}

export { initialiserCoquille, ongletDeLaVue };
