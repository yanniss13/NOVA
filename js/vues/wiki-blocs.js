/* Les briques de rendu partagees par les fiches du wiki.

   Elles vivent ici plutot que dans chaque fiche : la fiche de heros, celle
   d'une arme et celle d'une piece affichent les memes titres barres, les memes
   lignes de statistique, les memes selecteurs de niveau et les memes blocs
   repliables. Trois definitions ne doivent pas en devenir douze. */

import { BUILD_STATS } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";
import { formatBuildStatValue } from "./stats-affichage.js";

  /* « grade5 » est le vocabulaire des donnees, pas celui du jeu. Une seule
     definition pour tout le wiki : les filtres et les trois fiches nomment une
     rarete de la meme facon. Le tri par libelle reste juste, « Grade 1 » a
     « Grade 5 » s'ordonnant bien. */
  const libelleDeRarete = code => String(code).replace(/^grade/, "Grade ");

  /* Un titre barre, comme sur la fiche de reference : un filet, puis le
     libelle en petites capitales. Le `ton` colore les deux. */
  function titreSection(texte, ton){
    return el("div",{class:"wiki-section wiki-section-"+ton},[
      el("span",{class:"wiki-section-rule"}),
      el("span",{class:"wiki-section-label", text:texte})
    ]);
  }

  /* Le libelle francais et l'unite d'un code de stat, ou null.

     Ils viennent du catalogue, jamais d'une table ecrite ici : un code inedit
     apparait des la regeneration, sans toucher a ce fichier. Un code absent du
     catalogue est tu plutot que d'afficher « B_Atk » a un membre. */
  function libelleDeStat(code){
    const libelle = (BUILD_STATS.statLabels || {})[code];
    return libelle && libelle.fr ? libelle : null;
  }

  /* `formatBuildStatValue` leve sur une unite inconnue — c'est voulu, une
     valeur mal mise a l'echelle serait pire qu'absente. Ici on tait la ligne
     plutot que de casser la fiche entiere. */
  function texteDeValeur(valeur, unite){
    try{
      return formatBuildStatValue(valeur, unite);
    }catch(erreur){
      return null;
    }
  }

  function ligneDeValeur(nom, texte){
    return el("li",{class:"wiki-stat"},[
      el("span",{class:"wiki-stat-name", text:nom}),
      el("span",{class:"wiki-stat-value", text:texte})
    ]);
  }

  function ligneDeStat(code, valeur){
    const libelle = libelleDeStat(code);
    if(!libelle) return null;
    const texte = texteDeValeur(valeur, libelle.unit);
    return texte === null ? null : ligneDeValeur(libelle.fr, texte);
  }

  /* Une liste batie sur des lignes deja construites, ou null si aucune n'est
     affichable — auquel cas l'appelant n'ouvre pas de section vide. */
  function listeDeLignes(lignes){
    const liste = el("ul",{class:"wiki-stats"});
    (lignes || []).forEach(ligne => { if(ligne) liste.appendChild(ligne); });
    return liste.children.length ? liste : null;
  }

  /* Le meme, a partir de paires [code, valeur]. */
  function listeDeStats(paires){
    return listeDeLignes(
      (paires || []).map(paire => ligneDeStat(paire[0], paire[1]))
    );
  }

  /* Une rangee de pastilles de niveau : meme geste que le selecteur d'arme de
     la fiche de heros. Le niveau porte l'information, d'ou le chiffre nu ;
     l'intitule complet reste dans `aria-label` pour la lecture d'ecran. */
  function selecteurNiveaux(niveaux, actif, auChangement){
    const rangee = el("div",{class:"wiki-levels"});
    (niveaux || []).forEach(niveau => {
      const choisi = niveau === actif;
      rangee.appendChild(el("button",{
        class:"wiki-level"+(choisi ? " active" : ""),
        type:"button",
        "aria-pressed":String(choisi),
        "aria-label":"Niveau "+niveau,
        onclick:()=>auChangement(niveau)
      },[String(niveau)]));
    });
    return rangee;
  }

  function repliable(titre, contenu){
    if(!contenu) return null;
    return el("details",{class:"wiki-fold"},[
      el("summary",{text:titre}),
      contenu
    ]);
  }

export {
  libelleDeRarete,
  libelleDeStat,
  ligneDeValeur,
  listeDeLignes,
  listeDeStats,
  repliable,
  selecteurNiveaux,
  texteDeValeur,
  titreSection
};
