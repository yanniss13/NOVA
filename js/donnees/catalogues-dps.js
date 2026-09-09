/* Le chargement A LA DEMANDE des trois catalogues du simulateur DPS.

   `effets-dps.js` pese 1,4 Mo et `competences.js` 150 Ko : les charger au
   demarrage les ferait payer a chaque visiteur qui n'ouvre ni fiche de heros
   ni comparateur. Ils arrivent donc a la premiere ouverture de l'un des deux.

   Ce module vit dans `donnees` et non dans `metier` parce qu'il TOUCHE le
   reseau et le document. Il a ete extrait de vues/fiche-heros.js le jour ou
   le calculateur en a eu besoin a son tour : deux chargeurs auraient fini par
   diverger sur l'ordre de confiance des animations, qui est justement la
   seule chose subtile ici. */

import { el } from "../noyau/dom.js";

  /* Les deux etats sont nommes LONG a dessein : le chargeur `vm` des tests
     concatene tous les modules dans une portee commune, ou un `chargement`
     tout court entrerait en collision avec son homonyme d'un autre module. */
  let chargementCataloguesDps = null;
  let animationsChargees = null;

  function cataloguesDpsPrets(){
    return Boolean(typeof window !== "undefined"
      && window.SEVEN_DS_COMPETENCES && window.SEVEN_DS_EFFETS_DPS
      && animationsChargees);
  }

  /* Les durees d'animation retenues, une fois le chargement termine. Rend un
     objet vide tant que rien n'est charge : le simulateur compte alors zero,
     jamais une duree supposee. */
  function animationsDps(){
    return animationsChargees || {};
  }

  function chargerCataloguesDps(){
    if(cataloguesDpsPrets()) return Promise.resolve(true);
    if(chargementCataloguesDps) return chargementCataloguesDps;
    const injecter = src => new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src, onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable : "+src))
      }));
    });
    chargementCataloguesDps = Promise.all([
      window.SEVEN_DS_COMPETENCES
        ? Promise.resolve(true) : injecter("./data/competences.js"),
      window.SEVEN_DS_EFFETS_DPS
        ? Promise.resolve(true) : injecter("./data/effets-dps.js"),
      /* Deux sources, dans cet ordre de confiance.

         `animations-verrous.json` est DEDUIT des fichiers du jeu : le premier
         instant ou le heros peut relancer une action offensive, lu dans les
         marqueurs du montage. Il couvre 155 des 376 competences du catalogue,
         et reste une deduction.

         Les 221 autres ne sont pas des trous : 202 ont une fenetre offensive
         ouverte des t=0, donc un verrou nul que le simulateur compte deja
         comme tel, et 18 n'ont aucune fenetre connue. `ecrire-verrous.js`
         omet les zeros plutot que de les ecrire — le resultat est le meme,
         mais le fichier ne dit pas la difference entre « nul » et « inconnu ».

         `animations-mesurees.json` s'ecrit a la main, chronometre en jeu. Il
         fait FOI la ou il parle, et ecrase donc le precedent cle par cle.

         L'absence des deux n'est pas une panne : le simulateur compte zero,
         jamais une duree supposee. */
      Promise.all([
        fetch("./data/animations-verrous.json")
          .then(reponse => reponse.ok ? reponse.json() : null)
          .catch(() => null),
        fetch("./data/animations-mesurees.json")
          .then(reponse => reponse.ok ? reponse.json() : null)
          .catch(() => null)
      ]).then(([deduites, mesurees]) => {
        animationsChargees = Object.assign(
          {},
          (deduites && deduites.animations) || {},
          (mesurees && mesurees.animations) || {}
        );
        return true;
      })
    ]).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner la vue pour toute
         la duree de la session. */
      chargementCataloguesDps = null;
      throw erreur;
    });
    return chargementCataloguesDps;
  }

export { animationsDps, cataloguesDpsPrets, chargerCataloguesDps };
