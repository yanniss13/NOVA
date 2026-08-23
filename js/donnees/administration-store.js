/* Les comptes du site, et le seul droit qu'on leur accorde ou leur retire.

   Le magasin ne connait pas le DOM, l'ecran ne connait pas Supabase : c'est ce
   qui permet de lire la regle sans navigateur et l'affichage sans reseau.

   ⚠️ Les noms de premier niveau sont uniques dans tout js/ — le chargeur `vm`
   des tests concatene les modules dans une portee commune. */

import { sb } from "../noyau/supabase-client.js";

  const AdministrationStore = {
    /* Tous les profils, invites compris. Un admin est membre : la politique
       « a moi ou membre » lui rend donc la table entiere. */
    async comptes(){
      if(!sb) return [];
      const { data, error } = await sb.from("profiles")
        .select("id,pseudo,membre,admin")
        .order("pseudo", { ascending:true });
      if(error) throw error;
      return (data || [])
        .filter(item => item && item.id)
        .map(item => ({
          id:item.id,
          pseudo:item.pseudo || "Membre",
          membre:item.membre === true,
          admin:item.admin === true
        }));
    },
    /* Par la RPC et jamais par un `update` direct : le droit d'ecrire sur la
       ligne d'autrui n'existe pas, et c'est voulu. Un trigger refuse de toute
       facon un drapeau pose a la main depuis une session. */
    async definirMembre(id, membre){
      if(!sb) throw new Error("AUTH_REQUIRED");
      const { error } = await sb.rpc("definir_membre", {
        p_uid:id,
        p_membre:!!membre
      });
      if(error) throw error;
    }
  };

export { AdministrationStore };
