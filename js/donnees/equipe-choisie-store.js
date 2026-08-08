/* L'equipe que le calculateur regarde, retenue sur l'appareil.

   LOCALE, et volontairement pas synchronisee : ce n'est pas une donnee de
   confrerie mais un reglage d'ecran. Les EQUIPES, elles, vivent deja dans
   EquipesStore et se synchronisent - on ne retient ici que LAQUELLE est
   regardee.

   Aucun repli : `null` signifie « aucune equipe », qui est un choix valide et
   le defaut de la page. Rendre un identifiant de repli ferait regarder une
   equipe que le membre n'a pas choisie. */

import { EQUIPE_CHOISIE_KEY } from "../noyau/constantes.js";

  const EquipeChoisieStore = {
    get(){
      try{
        const brut = localStorage.getItem(EQUIPE_CHOISIE_KEY);
        return typeof brut === "string" && brut ? brut : null;
      }catch(erreur){
        /* Un stockage illisible ne doit pas condamner l'onglet : la page
           retombe sur « aucune equipe », donc sur son comportement d'avant. */
        return null;
      }
    },
    /* `set(null)` efface. Une seule porte pour poser et retirer : un `clear()`
       separe serait un export de plus a garder vivant. */
    set(id){
      const valeur = typeof id === "string" && id ? id : null;
      try{
        if(valeur) localStorage.setItem(EQUIPE_CHOISIE_KEY, valeur);
        else localStorage.removeItem(EQUIPE_CHOISIE_KEY);
      }catch(erreur){
        /* Stockage plein ou refuse : le choix vaut pour la session et ne
           survivra pas au rechargement. Mieux que de jeter. */
      }
      return valeur;
    }
  };

export { EquipeChoisieStore };
