/* La possession d'un objet, CALCULEE et non stockee en entier.

   Un objet est possede s'il est MARQUE explicitement ou EQUIPE dans un build
   du membre affiche. La part equipee ne se stocke pas : elle se derive du
   roster a chaque rendu. Tenir a jour deux verites — la table et le roster —
   les ferait tot ou tard diverger, et il faudrait alors decider laquelle ment.

   Pur : ni DOM ni reseau, donc testable seul. */

import { FOLDER_TO_ENUM, LINKED_ARMOR_SLOT } from "../noyau/constantes.js";
import { weaponTypesOf } from "./armes.js";

  /* Les chemins que le roster d'un membre porte deja : l'arme de chaque build
     et son armure gravee. Une piece equipee est forcement possedee — c'est ce
     qui epargne au membre des dizaines de clics au demarrage. */
  function equipesDuRoster(entrees){
    const equipes = new Set();
    (entrees || []).forEach(entree => {
      const builds = (entree && entree.builds) || {};
      Object.keys(builds).forEach(type => {
        const build = builds[type];
        if(!build) return;
        if(build.weapon) equipes.add(build.weapon);
        const gravee = build.armor && build.armor[LINKED_ARMOR_SLOT];
        if(gravee) equipes.add(gravee);
      });
    });
    return equipes;
  }

  /* La regle de possession, en un seul endroit.

     Les deux ensembles se FUSIONNENT, ils ne se remplacent pas : un objet
     marque le reste une fois desequipe, un objet equipe compte meme s'il n'a
     jamais ete marque. */
  function possessionsDe(marques, equipes){
    const tout = new Set(marques || []);
    (equipes || []).forEach(item => tout.add(item));
    return tout;
  }

  /* Ce qui sert vraiment au roster affiche : les armures gravees de ses
     personnages, et les armes du type qu'ils manient.

     L'utilite ne depend PAS de la possession — une arme du bon type compte
     meme jamais obtenue. C'est tout l'interet du filtre : montrer ce qu'il
     vaut la peine de chercher.

     ⚠️ Les deux cotes ne parlent pas la meme langue. `weaponTypesOf` rend des
     noms de DOSSIER (« Hache »), les objets du Wiki portent un ENUM (« Axe »).
     FOLDER_TO_ENUM fait le pont ; comparer sans lui rendrait un ensemble vide,
     et le filtre n'afficherait jamais rien — en silence. */
  function utilesAuRoster(entrees, objets){
    const personnages = new Set();
    (entrees || []).forEach(entree => {
      if(entree && entree.charId) personnages.add(entree.charId);
    });
    const typesManies = new Set();
    personnages.forEach(charId => {
      weaponTypesOf(charId).forEach(dossier => {
        const marque = FOLDER_TO_ENUM[dossier];
        if(marque) typesManies.add(marque);
      });
    });
    const utiles = new Set();
    (objets || []).forEach(objet => {
      if(!objet || !objet.file) return;
      if(objet.nature === "gravee"){
        if(objet.heros && personnages.has(objet.heros)) utiles.add(objet.file);
        return;
      }
      if(objet.type && typesManies.has(objet.type)) utiles.add(objet.file);
    });
    return utiles;
  }

  /* Le decompte affiche en tete de page.

     Il compte les objets LISTES qui sont possedes, et non les possessions :
     une image retiree du depot laisse sa ligne en base, et la compter
     gonflerait un total dont plus rien ne repond. */
  function progressionDe(objets, possessions){
    const liste = objets || [];
    const detenues = possessions || new Set();
    const possedes = liste.filter(objet => detenues.has(objet.file)).length;
    return {
      total:liste.length,
      possedes,
      manquants:liste.length - possedes
    };
  }

export { equipesDuRoster, possessionsDe, progressionDe, utilesAuRoster };
