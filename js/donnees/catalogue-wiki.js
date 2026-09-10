/* Le chargement A LA DEMANDE des catalogues du wiki.

   `wiki-competences.js` pese 230 Ko : le charger au demarrage le ferait payer
   a chaque visiteur qui n'ouvre ni le wiki ni une rotation d'equipe.

   Ce module vit dans `donnees` et non dans `metier` parce qu'il TOUCHE le
   reseau et le document. Il a ete extrait de vues/wiki.js le jour ou la modale
   de detail d'une equipe en a eu besoin a son tour — deux chargeurs auraient
   fini par diverger sur ce qui est bloquant et ce qui ne l'est pas, qui est
   justement la seule chose subtile ici. */

import { el } from "../noyau/dom.js";

  /* Nomme LONG a dessein : le chargeur `vm` des tests concatene tous les
     modules dans une portee commune, ou un `chargement` tout court entrerait
     en collision avec son homonyme d'un autre module. */
  let chargementCatalogueWiki = null;

  function scriptDeCatalogue(src){
    return new Promise((resolve, reject) => {
      document.head.appendChild(el("script",{
        src,
        onload:()=>resolve(true),
        onerror:()=>reject(new Error("catalogue introuvable : " + src))
      }));
    });
  }

  function catalogueWikiPret(){
    return Boolean(typeof window !== "undefined"
      && window.SEVEN_DS_WIKI_COMPETENCES);
  }

  /* Les competences sont BLOQUANTES : sans elles, ni fiche de heros ni
     rotation d'equipe.

     Les transcendances, les competences combinees et les jauges de releve ne
     le sont PAS. Elles viennent d'une extraction locale du jeu, pas de
     7dsorigin : le jour ou l'une manque, la page doit perdre une section,
     jamais son onglet. Sans les jauges, la rotation s'affiche entiere et
     cesse seulement de placer les releves. */
  function chargerCatalogueWiki(){
    if(catalogueWikiPret()) return Promise.resolve(true);
    if(chargementCatalogueWiki) return chargementCatalogueWiki;
    chargementCatalogueWiki = Promise.all([
      scriptDeCatalogue("./data/wiki-competences.js"),
      scriptDeCatalogue("./data/transcendances.js").catch(()=>false),
      scriptDeCatalogue("./data/ultimes-combines.js").catch(()=>false),
      scriptDeCatalogue("./data/jauges-releve.js").catch(()=>false)
    ]).then(()=>true).catch(erreur => {
      /* Rejouable : un echec reseau ne doit pas condamner la page pour toute
         la duree de la session. */
      chargementCatalogueWiki = null;
      throw erreur;
    });
    return chargementCatalogueWiki;
  }

export { catalogueWikiPret, chargerCatalogueWiki };
