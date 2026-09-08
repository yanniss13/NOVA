/* L'ecran d'administration : la liste des comptes, et un interrupteur.

   Il ne fait qu'une chose — ouvrir ou fermer la porte de la confrerie. Pas de
   suppression de compte, pas de roles fins, pas de retrait du drapeau `admin` :
   celui-la se pose une fois a la main dans Supabase, et le SQL refuse de le
   changer autrement.

   Cet ecran n'est PAS la securite. Un compte non-admin qui appellerait la RPC
   directement recevrait `ADMIN_REQUIS` : c'est la que vit la regle. Ici, on
   evite seulement de proposer des gestes qui echoueront.

   ⚠️ Noms de premier niveau uniques dans tout js/ — le chargeur `vm` des tests
   concatene les modules dans une portee commune. D'ou `ligneDeCompte` et
   `renderAdministration` plutot que `ligne` et `rendre`. */

import { $, el } from "../noyau/dom.js";
import { authMessage } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";
import { AdministrationStore } from "../donnees/administration-store.js";
import { toast } from "./toast.js";

  function ligneDeCompte(compte, redessiner){
    const moi = !!sessionCourante.user && compte.id === sessionCourante.user.id;
    const bouton = el("button", {
      class:"btn " + (compte.membre ? "btn-ghost" : "btn-primary"),
      type:"button",
      text:compte.membre
        ? "Retirer de la confrérie"
        : "Accueillir dans la confrérie"
    });
    /* Se retirer soi-meme couperait le dernier responsable de tout ce qu'il
       administre. Le SQL le refuse aussi : ici on ne propose simplement pas un
       geste dont on connait deja la reponse. */
    bouton.disabled = moi && compte.membre;
    bouton.addEventListener("click", async () => {
      bouton.disabled = true;
      try{
        await AdministrationStore.definirMembre(compte.id, !compte.membre);
        toast(compte.membre
          ? compte.pseudo + " n'est plus membre de la confrérie."
          : compte.pseudo + " rejoint la confrérie. Il doit recharger la page.");
        await redessiner();
      }catch(error){
        bouton.disabled = false;
        toast("Changement impossible : " + authMessage(error), true);
      }
    });
    return el("tr", null, [
      el("td", { text:compte.pseudo }),
      el("td", { text:compte.membre ? "Membre" : "Invité" }),
      el("td", { text:compte.admin ? "Oui" : "—" }),
      el("td", null, [bouton])
    ]);
  }

  async function renderAdministration(){
    const corps = $("#adminBody");
    if(!corps) return true;
    corps.textContent = "";
    let comptes;
    try{
      comptes = await AdministrationStore.comptes();
    }catch(error){
      corps.appendChild(el("p", {
        class:"admin-etat",
        text:"Comptes indisponibles : " + authMessage(error)
      }));
      return true;
    }
    if(!comptes.length){
      corps.appendChild(el("p", {
        class:"admin-etat",
        text:"Aucun compte."
      }));
      return true;
    }
    corps.appendChild(el("table", { class:"admin-table" }, [
      el("thead", null, [el("tr", null, [
        el("th", { text:"Pseudo" }),
        el("th", { text:"Accès" }),
        el("th", { text:"Admin" }),
        el("th", { text:"Action" })
      ])]),
      el("tbody", null,
        comptes.map(compte => ligneDeCompte(compte, renderAdministration)))
    ]));
    return true;
  }

export { renderAdministration };
