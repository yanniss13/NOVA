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
    /* DEUX ACTIONS DE MEME NIVEAU, DEUX POIDS EGAUX. « Accueillir » portait
       l aplat dore — le seul du site, reserve a l action principale d un ecran
       — et il apparait une fois par invite : cinq invites, cinq aplats. En
       face, « Retirer » n etait qu un lien dore, alors que c est le geste
       destructeur. Les deux prennent le cadre discret ; seul le retrait porte
       la teinte d alerte, au survol. */
    const bouton = el("button", {
      class:"btn" + (compte.membre ? " btn-danger" : ""),
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
    return el("article", null, [
      el("span", { class:"member-seal", "aria-hidden":"true",
        text:(compte.pseudo || "?").slice(0, 1).toUpperCase() }),
      el("div", null, [
        el("b", { text:compte.pseudo }),
        el("small", { text:compte.admin
          ? "Administrateur de la confrérie"
          : (compte.membre ? "Accès aux données de la confrérie" : "Ne voit que son propre roster") })
      ]),
      el("span", { text:compte.membre ? "Membre" : "Invité" }),
      el("em", { text:compte.admin ? "Administrateur" : "—" }),
      bouton
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
    /* LES TROIS COMPTEURS de la maquette. Ils repondent a la question qu'on
       se pose en ouvrant cet ecran — combien sommes-nous, et qui attend — que
       le tableau seul obligeait a compter des yeux. */
    const membres = comptes.filter(compte => compte.membre);
    const invites = comptes.filter(compte => !compte.membre);
    const administrateurs = comptes.filter(compte => compte.admin);
    corps.appendChild(el("div", { class:"stat-grid admin-summary" }, [
      el("article", null, [
        el("span", { text:"Membres" }),
        el("strong", { text:String(membres.length) }),
        el("small", { text:"accès aux données de la confrérie" })
      ]),
      el("article", null, [
        el("span", { text:"Comptes invités" }),
        el("strong", { text:String(invites.length) }),
        el("small", { text:invites.length
          ? "en attente d'être accueillis"
          : "personne n'attend" })
      ]),
      el("article", null, [
        el("span", { text:"Administrateurs" }),
        el("strong", { text:String(administrateurs.length) }),
        el("small", { text:"peuvent accueillir et retirer" })
      ])
    ]));

    /* LA LISTE DE LA MAQUETTE : un sceau rond a l'initiale, le pseudo et ce
       que le compte peut voir, son acces, son role, et le geste. Un tableau
       HTML demandait quatre en-tetes de colonne pour dire la meme chose, et
       s'ecrasait sur un telephone. */
    corps.appendChild(el("div", { class:"section-title-row" }, [
      el("h2", { text:"Comptes" }),
      el("span", { text:comptes.length + " au total" })
    ]));
    corps.appendChild(el("div", { class:"member-table" },
      comptes.map(compte => ligneDeCompte(compte, renderAdministration))));
    return true;
  }

export { renderAdministration };
