/* Les coequipiers retenus dans le calculateur, sur cet appareil.

   LOCAL, et volontairement pas synchronise : c'est un reglage d'ecran. On ne
   stocke que des COUPLES personnage + arme, jamais un build recopie - sinon
   une modification du roster laisserait ici une copie perimee.

   Un choix qui ne designe plus rien de reel est ignore a la lecture par la
   vue, qui ne propose que des builds existants. */

import { COEQUIPIERS_KEY } from "../noyau/constantes.js";

  /* Trois, parce que le heros calcule occupe le quatrieme siege. */
  const EMPLACEMENTS_COEQUIPIERS = 3;

  /* La liste garde TOUJOURS trois cases, vides comprises : la vue dessine
     trois emplacements, et une liste plus courte les ferait apparaitre et
     disparaitre au fil des choix. */
  function normaliser(brut){
    const liste = Array.isArray(brut) ? brut : [];
    const propre = [];
    for(let index = 0; index < EMPLACEMENTS_COEQUIPIERS; index++){
      const choix = liste[index];
      const valide = choix
        && typeof choix.charId === "string" && choix.charId
        && typeof choix.typeArme === "string" && choix.typeArme;
      propre.push(valide
        ? { charId:choix.charId, typeArme:choix.typeArme }
        : null);
    }
    return propre;
  }

  const CoequipiersStore = {
    get(){
      try{
        return normaliser(JSON.parse(localStorage.getItem(COEQUIPIERS_KEY)));
      }catch(erreur){
        /* Un stockage illisible ne doit pas condamner l'onglet : trois cases
           vides rendent le comportement du heros seul. */
        return normaliser(null);
      }
    },
    set(liste){
      const propre = normaliser(liste);
      try{
        localStorage.setItem(COEQUIPIERS_KEY, JSON.stringify(propre));
      }catch(erreur){
        /* Stockage plein ou refuse : le choix vaut pour la session. */
      }
      return propre;
    }
  };

export { EMPLACEMENTS_COEQUIPIERS, CoequipiersStore };
