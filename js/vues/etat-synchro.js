/* Le temoin d'etat de synchronisation, `#liveStatus`.

   Il vit dans son propre module parce que DEUX vues doivent l'ecrire et
   qu'elles ne peuvent pas s'appeler l'une l'autre : `synchro-temps-reel.js`
   rapporte l'etat du canal Supabase, et `roster-membres.js` signale une
   lecture echouee alors que le cache local est deja peint. Or le second est
   plus haut que le premier dans l'ordre des couches — l'importer serait
   interdit, et `tests/modules-imports.test.js` le refuserait.

   Un seul proprietaire des deux miroirs desktop/mobile evite aussi que deux
   ecrivains se chassent l'un l'autre, ecueil deja rencontre avec l'indicateur
   d'enregistrement des disponibilites. */

import { $ } from "../noyau/dom.js";

  function setSyncStatus(state, text){
    [$("#liveStatus"), $("#mobileLiveStatus")].filter(Boolean).forEach(node => {
      node.dataset.state = state;
      node.textContent = text;
    });
  }

  /* Une lecture qui echoue alors que l'ecran affiche deja le cache local ne
     doit pas interrompre par une alerte rouge : le temoin suffit. */
  function markSyncOffline(){
    setSyncStatus("offline", "Synchronisation indisponible");
  }

export { markSyncOffline, setSyncStatus };
