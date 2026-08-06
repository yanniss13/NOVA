/* Les briques de rendu partagees par les fiches du wiki.

   Elles vivent ici plutot que dans chaque fiche : la fiche de heros, celle
   d'une arme et celle d'une piece affichent les memes titres barres, les memes
   lignes de statistique et les memes blocs repliables. Trois definitions ne
   doivent pas en devenir neuf. */

import { BUILD_STATS } from "../noyau/constantes.js";
import { el } from "../noyau/dom.js";
import { formatBuildStatValue } from "./stats-affichage.js";

  /* Un titre barre, comme sur la fiche de reference : un filet, puis le
     libelle en petites capitales. Le `ton` colore les deux. */
  function titreSection(texte, ton){
    return el("div",{class:"wiki-section wiki-section-"+ton},[
      el("span",{class:"wiki-section-rule"}),
      el("span",{class:"wiki-section-label", text:texte})
    ]);
  }

  /* Un code de stat rendu lisible. Le libelle francais et l'unite viennent du
     catalogue, jamais d'une table ecrite ici : un code inedit apparait des la
     regeneration, sans toucher a ce fichier. Un code absent du catalogue est
     tu plutot que d'afficher « B_Atk » a un membre.

     Reste interne : les fiches passent par `listeDeStats`, qui evite d'ecrire
     quatre fois la meme boucle. */
  function ligneDeStat(code, valeur){
    const libelle = (BUILD_STATS.statLabels || {})[code];
    if(!libelle || !libelle.fr) return null;
    let texte;
    try{
      texte = formatBuildStatValue(valeur, libelle.unit);
    }catch(erreur){
      return null;
    }
    return el("li",{class:"wiki-stat"},[
      el("span",{class:"wiki-stat-name", text:libelle.fr}),
      el("span",{class:"wiki-stat-value", text:texte})
    ]);
  }

  /* Une liste de statistiques a partir de paires [code, valeur], ou null si
     aucune n'est affichable — auquel cas l'appelant n'ouvre pas de section
     vide. */
  function listeDeStats(paires){
    const liste = el("ul",{class:"wiki-stats"});
    (paires || []).forEach(paire => {
      const ligne = ligneDeStat(paire[0], paire[1]);
      if(ligne) liste.appendChild(ligne);
    });
    return liste.children.length ? liste : null;
  }

  function repliable(titre, contenu){
    if(!contenu) return null;
    return el("details",{class:"wiki-fold"},[
      el("summary",{text:titre}),
      contenu
    ]);
  }

export { listeDeStats, repliable, titreSection };
