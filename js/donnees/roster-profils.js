/* La liste des pseudos de la confrerie, lue une fois puis mise en cache
   dans sessionCourante.

   Partagee par les dispos, le roster des membres et l'analyse : c'est ce qui
   lui vaut son propre module plutot qu'une place dans l'une des trois.

   ELLE NE CONTIENT QUE DES MEMBRES. Un invite garde son compte et son acces,
   mais il n'appartient pas a la confrerie : le laisser ici le ferait
   apparaitre dans le planning et dans le webhook comme un membre qui n'a
   jamais pose ses creneaux. L'administration, elle, a son propre lecteur
   (`AdministrationStore.comptes`) qui garde tout le monde — c'est son role. */

import { sessionCourante } from "../etat/session.js";
import { sb } from "../noyau/supabase-client.js";

  /* Le drapeau vaut `not null default false` cote base : une ligne qui ne le
     porte pas est une ligne qu'on ne sait pas lire, et on ne l'invente pas
     membre. */
  function profilsDeLaConfrerie(lignes){
    return (lignes || [])
      .filter(item => item && item.id && item.membre === true)
      .map(item => ({id:item.id, pseudo:item.pseudo || "Membre"}));
  }

  async function refreshRosterProfiles(){
    if(!sessionCourante.user || !sb) return sessionCourante.rosterProfiles.slice();
    const { data, error } = await sb.from("profiles")
      .select("id,pseudo,membre")
      .order("pseudo", {ascending:true});
    if(error) throw error;
    sessionCourante.rosterProfiles = profilsDeLaConfrerie(data);
    return sessionCourante.rosterProfiles.slice();
  }

export {
  refreshRosterProfiles
};
