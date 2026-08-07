/* La collection d'un membre : les chemins d'objets qu'il a marques.

   UNE LIGNE PAR OBJET dans Supabase : marquer est un insert, demarquer un
   delete. Aucune ecriture ne reecrit l'ensemble, donc deux appareils ouverts
   en meme temps ne peuvent pas s'effacer mutuellement — c'est exactement le
   probleme qui a impose un verrou de comparaison-et-echange a
   roster_characters, et qu'on evite ici par la forme de la table.

   Le cache local est indexe par proprietaire, comme celui du roster : on
   affiche aussi bien sa collection que celle d'un autre membre. Il sert a
   afficher vite et hors ligne, et n'accorde JAMAIS un droit : la RLS reste
   seule juge de ce qu'un membre peut ecrire. */

import { CLOUD_COLLECTION_CACHE_KEY } from "../noyau/constantes.js";
import { sb } from "../noyau/supabase-client.js";
import { sessionCourante } from "../etat/session.js";

  function lireCacheCollection(){
    try{
      const brut = JSON.parse(localStorage.getItem(CLOUD_COLLECTION_CACHE_KEY));
      return brut && typeof brut === "object" && !Array.isArray(brut) ? brut : {};
    }catch(erreur){
      return {};
    }
  }
  let cacheCollection = lireCacheCollection();

  function ecrireCacheCollection(){
    localStorage.setItem(
      CLOUD_COLLECTION_CACHE_KEY,
      JSON.stringify(cacheCollection)
    );
  }

  /* Remplace la part d'un seul proprietaire, sans toucher aux autres. */
  function remplacerCollectionDe(ownerId, items){
    cacheCollection[ownerId] = [...new Set(
      (Array.isArray(items) ? items : []).filter(item => typeof item === "string")
    )];
    ecrireCacheCollection();
    return new Set(cacheCollection[ownerId]);
  }

  const CollectionStore = {
    all(ownerId){
      if(!ownerId) return new Set();
      return new Set(cacheCollection[ownerId] || []);
    },
    async refresh(ownerId){
      if(!ownerId) return new Set();
      if(!sessionCourante.user || !sb) return CollectionStore.all(ownerId);
      const { data, error } = await sb.from("collection_items")
        .select("item")
        .eq("owner", ownerId);
      if(error) throw error;
      return remplacerCollectionDe(ownerId, (data || []).map(ligne => ligne.item));
    },
    async mark(item){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const { error } = await sb.from("collection_items")
        .insert({ owner, item });
      /* 23505 : la ligne existe deja. Marquer deux fois n'est pas une erreur
         pour le membre — le resultat voulu est atteint. */
      if(error && error.code !== "23505") throw error;
      const suivant = CollectionStore.all(owner);
      suivant.add(item);
      return remplacerCollectionDe(owner, [...suivant]);
    },
    async unmark(item){
      if(!sessionCourante.user || !sb) throw new Error("AUTH_REQUIRED");
      const owner = sessionCourante.user.id;
      const { error } = await sb.from("collection_items")
        .delete()
        .eq("owner", owner)
        .eq("item", item);
      if(error) throw error;
      const suivant = CollectionStore.all(owner);
      suivant.delete(item);
      return remplacerCollectionDe(owner, [...suivant]);
    }
  };

export { CollectionStore };
