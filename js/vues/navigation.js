/* QUELLE VUE EST OUVERTE, ET QUI A LE DROIT DE L'OUVRIR.

   Ce module ne dessine aucune barre. Il tient trois choses :

   - le REGISTRE des vues. Chaque vue s'annonce au chargement, et `showView` ne
     fait que chercher dedans. Sans ce registre, `showView` devrait citer
     chaque vue, donc les importer toutes — et toute vue qui change d'onglet,
     ce que les sessions de boss font cinq fois, creerait un cycle.

   - le PORTIER. C'est ici, et nulle part ailleurs, qu'on decide qu'une vue est
     hors de portee. Le passage par `showView` etant obligatoire, les appels
     disperses dans les vues sont couverts sans qu'un seul ait a connaitre la
     session.

   - l'ANNONCE. `surChangementDeVue` laisse la coquille — en-tete, onglets,
     barre du pouce — apprendre qu'une vue a change, sans que la navigation ait
     a la connaitre. La dependance va dans un seul sens : `coquille.js` importe
     ce module, jamais l'inverse.

   Le contrat d'un rendu enregistre : appele sans argument, il renvoie ce que
   `showView` doit renvoyer. Les vues dont le resultat n'interesse personne
   enregistrent une enveloppe qui renvoie `true`. La valeur sert a « Mon
   suivi », dont les actions attendent que la vue destination soit rendue
   avant de cibler un element dedans. */

import {
  estAdministrateur, inviteHorsConfrerie, visiteurAnonyme
} from "../etat/session.js";
import { fragmentDeRoute, routeDeVue } from "../metier/routage.js";
import { vuePreferee } from "../metier/rubriques.js";

const rendus = new Map();
const auditeursDeVue = new Set();

function enregistrerVue(nom, rendu){
  rendus.set(nom, rendu);
}

/* Previens-moi quand la vue ouverte change. Rend de quoi se desabonner. */
function surChangementDeVue(auditeur){
  auditeursDeVue.add(auditeur);
  return () => auditeursDeVue.delete(auditeur);
}

function vueCourante(){
  const active = document.querySelector(".view.active");
  /* Un element sans identifiant n'est pas une vue : le nom se lit dans
     `id="view-<nom>"`, et rien d'autre ne le porte. */
  return active && active.id ? active.id.replace(/^view-/, "") : "";
}

/* Les pages qui tiennent debout sans compte. L'accueil est la porte d'entree ;
   le Builder compose en local, le Wiki et la Collection se consultent, et le
   Calculateur s'ouvre depuis un heros du Builder. Tout le reste — suivi,
   equipes, dispos, roster, analyse, sessions — lit des donnees liees a un
   compte. */
const VUES_PUBLIQUES = new Set([
  "home", "builder", "wiki", "collection", "calculateur"
]);
const VUE_DE_REPLI = "home";

function vuePublique(nom){
  return VUES_PUBLIQUES.has(nom);
}

/* Les vues qui montrent la CONFRERIE : elles lisent les donnees de tout le
   monde, et la RLS les rend vides pour un invite. Un onglet qui n'affiche rien
   se lit comme une panne — il vaut mieux ne pas l'ouvrir du tout.

   `member-roster` n'y figure pas : c'est SON roster, la raison meme de son
   compte. */
const VUES_DE_CONFRERIE = new Set([
  "dashboard", "roster", "analyse", "availability", "boss"
]);
const VUE_ADMIN = "admin";

function vueAutorisee(nom){
  if(vuePublique(nom)) return true;
  if(visiteurAnonyme()) return false;
  if(nom === VUE_ADMIN) return estAdministrateur();
  return !(VUES_DE_CONFRERIE.has(nom) && inviteHorsConfrerie());
}

/* Le repli depend de qui frappe a la porte. L'accueil recoit le visiteur sans
   compte ; l'invite, lui, a un roster — l'y renvoyer vaut mieux que de le
   poser sur une page de presentation. */
function vueDeRepli(){
  return inviteHorsConfrerie() ? "member-roster" : VUE_DE_REPLI;
}

function annoncerVue(nom){
  auditeursDeVue.forEach(auditeur => auditeur(nom));
}

/* Appelee a chaque changement de session, depuis session-auth.js. Elle
   previent la coquille, qui range ses entrees, puis rattrape la navigation si
   la session vient de fermer la porte sous les pieds du visiteur. */
function appliquerAutorisations(options){
  const settings = Object.assign({ historyMode:"replace" }, options || {});
  const nomActif = vueCourante();
  annoncerVue(nomActif);
  if(nomActif && !vueAutorisee(nomActif)){
    void showView(vueDeRepli(), { historyMode:settings.historyMode });
    return;
  }
  /* Un compte vient de s'ouvrir sur l'accueil public : le membre attend son
     suivi, pas la page qui invite a creer un compte. */
  const preferee = vuePreferee(nomActif, vueAutorisee);
  if(preferee){
    void showView(preferee, { historyMode:settings.historyMode });
  }
}

function showView(name, options){
  const settings = Object.assign({ historyMode:"push" }, options || {});
  /* Le repli est prefere a un retour sec : une navigation qui ne mene nulle
     part laisse l'entree precedente surlignee et la page inchangee, ce qui se
     lit comme une panne. */
  if(!vueAutorisee(name)){
    return showView(vueDeRepli(), {
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
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active", view.id === "view-" + name);
  });
  annoncerVue(name);
  const rendu = rendus.get(name);
  const result = rendu ? Promise.resolve(rendu()) : Promise.resolve(true);
  const reduced = window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top:0, behavior:reduced ? "auto" : "smooth" });
  return result;
}

export {
  appliquerAutorisations,
  enregistrerVue,
  showView,
  surChangementDeVue,
  vueAutorisee,
  vueCourante,
  vuePublique
};
