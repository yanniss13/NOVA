/* Synchronisation entre les fragments d'URL et les vues de NOVA.

   Les routes de groupe sont enregistrees par leurs vues respectives. Ce petit
   registre evite a la navigation d'importer Boss ou Analyse, donc de recreer
   les cycles que le registre de `navigation.js` avait justement supprimes. */

import { sessionCourante } from "../etat/session.js";
import {
  fragmentDeRoute,
  lireRoute,
  routeDeVue
} from "../metier/routage.js";
import { sb } from "../noyau/supabase-client.js";
import { openAuth } from "./modale-auth.js";
import { showView, vueAutorisee, vuePublique } from "./navigation.js";

const gestionnaires = new Map();
let routageInitialise = false;
let routeEnAttente = null;
let fragmentIgnoreAuProchainLogin = "";

function enregistrerGestionnaireRoute(view, handler){
  if((view === "boss" || view === "analyse") && typeof handler === "function"){
    gestionnaires.set(view, handler);
  }
}

async function replierRouteInvalide(){
  routeEnAttente = null;
  const view = sessionCourante.user ? "dashboard" : "wiki";
  const fragment = fragmentDeRoute(routeDeVue(view));
  if(fragment && location.hash !== fragment){
    history.replaceState(null, "", fragment);
  }
  await showView(view, { historyMode:"none" });
  return true;
}

async function ouvrirRoute(route){
  if(!route) return false;
  const attendConnexion = !vuePublique(route.view)
    && !sessionCourante.user
    && !!sb;
  if(attendConnexion){
    routeEnAttente = route;
    await showView("wiki", { historyMode:"none" });
    openAuth();
    return true;
  }
  /* Vue hors de portee, mais le compte est deja ouvert : un invite n'a rien a
     faire d'une fenetre de connexion, il en a une. Le repli est confie a
     `showView`, seul juge de la vue d'accueil de chacun — le Wiki pour un
     visiteur, son roster pour un invite. */
  if(!vueAutorisee(route.view)){
    routeEnAttente = null;
    await showView(route.view, { historyMode:"none" });
    return true;
  }
  routeEnAttente = null;
  if(route.type === "view"){
    await showView(route.view, { historyMode:"none" });
    return true;
  }
  const handler = gestionnaires.get(route.view);
  if(!handler) return replierRouteInvalide();
  return !!(await handler(route));
}

async function reprendreRouteCourante(options){
  /* Une connexion ne rejoue QUE la route réservée mise en attente. Sans
     elle, « Mon suivi » reste l'ouverture par défaut : un visiteur qui
     parcourait le Builder puis s'identifie ne doit pas rester sur le
     Builder. Relire location.hash ici rejouerait n'importe quelle vue
     publique déjà ouverte, ce que la spécification exclut. */
  if(options && options.apresConnexion){
    const attendue = routeEnAttente;
    routeEnAttente = null;
    fragmentIgnoreAuProchainLogin = "";
    return attendue ? ouvrirRoute(attendue) : false;
  }
  if(!location.hash) return false;
  if(fragmentIgnoreAuProchainLogin){
    const ignore = location.hash === fragmentIgnoreAuProchainLogin;
    fragmentIgnoreAuProchainLogin = "";
    routeEnAttente = null;
    if(ignore) return false;
  }
  const route = lireRoute(location.hash);
  if(!route) return replierRouteInvalide();
  return ouvrirRoute(routeEnAttente || route);
}

function ignorerRepliDeconnexionAuProchainLogin(){
  fragmentIgnoreAuProchainLogin = fragmentDeRoute(routeDeVue("wiki"));
  routeEnAttente = null;
}

async function naviguerVersRoute(route, options){
  const fragment = fragmentDeRoute(route);
  if(!fragment) return replierRouteInvalide();
  if(location.hash !== fragment){
    if(options && options.replace) history.replaceState(null, "", fragment);
    else history.pushState(null, "", fragment);
  }
  return ouvrirRoute(route);
}

function routeDepuisLien(anchor){
  try{
    const url = new URL(anchor.href, location.href);
    if(url.origin !== location.origin || url.pathname !== location.pathname){
      return null;
    }
    return lireRoute(url.hash);
  }catch(error){
    return null;
  }
}

async function initialiserRoutage(){
  if(!routageInitialise){
    routageInitialise = true;
    window.addEventListener("popstate", () => void reprendreRouteCourante());
    document.addEventListener("click", event => {
      if(event.defaultPrevented || event.button !== 0
        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target && event.target.closest
        ? event.target.closest("a[data-app-route]")
        : null;
      if(!anchor || anchor.target === "_blank") return;
      const route = routeDepuisLien(anchor);
      if(!route) return;
      event.preventDefault();
      void naviguerVersRoute(route);
    });
  }
  return reprendreRouteCourante();
}

export {
  enregistrerGestionnaireRoute,
  ignorerRepliDeconnexionAuProchainLogin,
  initialiserRoutage,
  reprendreRouteCourante
};
