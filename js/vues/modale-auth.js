/* La fenetre de connexion : son ouverture, sa fermeture, son bandeau d'etat.

   Seul le CONTENANT est ici. Ce qui se passe une fois connecte — inscription,
   lecture du pseudo, rechargement de toutes les vues — reste dans app.js :
   c'est de la composition, ca touche a tout, et ca ne descendrait pas dans une
   couche sans y trainer le reste du site.

   `openAuth` est appele depuis onze endroits, chaque vue voulant proposer la
   connexion quand elle n'a rien a montrer. C'est ce qui justifie ce module :
   sans lui, aucune de ces vues ne pouvait sortir d'app.js. */

import { $ } from "../noyau/dom.js";
import { ModalStack } from "./modal-stack.js";

  const authOverlay = $("#authOverlay");
  const authStatus = $("#authStatus");

  function setAuthStatus(message, isErr){
    authStatus.textContent = message || "";
    authStatus.classList.toggle("err", !!isErr);
  }

  function openAuth(message, isErr){
    setAuthStatus(message, isErr);
    ModalStack.open(authOverlay, "#authEmail", closeAuth);
  }

  function closeAuth(){
    ModalStack.close(authOverlay);
    setAuthStatus("");
  }

  function setAuthBusy(busy){
    ["#authSignIn","#authSignUp","#authOffline"].forEach(selector => {
      $(selector).disabled = !!busy;
    });
  }

export { closeAuth, openAuth, setAuthBusy, setAuthStatus };
