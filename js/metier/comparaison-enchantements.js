/* L'ecart de DPS entre un build et son essai d'enchantements, PALIER PAR
   PALIER. Pur : ni DOM ni reseau.

   Pourquoi tous les paliers plutot que celui qu'on regarde : parce que le
   classement CHANGE d'un palier a l'autre, et pas qu'un peu. La resistance
   critique d'Akumu depasse le taux critique d'un heros vers le palier 18, et
   sa defense critique triple au palier 21 — deux ruptures qui rendent une
   ligne de degats critiques tantot decisive, tantot morte. Un membre qui lit
   « +5 % » sur le palier 1 et applique le jet peut donc perdre du DPS la ou
   il joue vraiment.

   Le module ne tranche pas a la place du membre : il rend l'ecart de chaque
   palier et de quoi le resumer. C'est la vue qui met en forme. */

import { simulationDuBuild } from "./dps-build.js";

  /* Un ecart RELATIF n'a de sens qu'entre deux nombres connus et non nuls :
     un build dont le catalogue ne chiffre rien rend null, jamais zero. */
  function ecartEntre(reference, essai){
    if(!Number.isFinite(reference) || !Number.isFinite(essai)) return null;
    const absolu = essai - reference;
    return {
      absolu,
      relatif:reference > 0 ? (absolu / reference) * 10000 : null
    };
  }

  /* Deux paliers voisins qui rendent le meme verdict n'apprennent rien. Ce
     qui compte, c'est l'endroit ou le signe CHANGE : c'est la que le membre
     doit savoir dans quel contenu il joue. */
  function basculesDe(lignes){
    const signe = ligne => {
      if(!ligne.ecart || ligne.ecart.relatif === null) return null;
      if(ligne.ecart.relatif > 0) return 1;
      return ligne.ecart.relatif < 0 ? -1 : 0;
    };
    const bascules = [];
    lignes.forEach((ligne, rang) => {
      if(rang === 0) return;
      const avant = signe(lignes[rang - 1]);
      const ici = signe(ligne);
      if(avant === null || ici === null || avant === ici) return;
      bascules.push({ depuis:lignes[rang - 1].cible, vers:ligne.cible });
    });
    return bascules;
  }

  function comparerSurLesCibles(entree){
    const source = entree || {};
    const cibles = Array.isArray(source.cibles) ? source.cibles : [];
    const commun = {
      dossierArme:source.dossierArme,
      duree:source.duree,
      animations:source.animations,
      /* Les lignes cochees valent pour les DEUX simulations : elles decrivent
         l'equipe, pas l'enchantement. Les passer d'un cote seulement ferait
         mesurer l'equipe au lieu de mesurer le jet. */
      apports:source.apports
    };

    const lignes = cibles.map(cible => {
      const reference = simulationDuBuild(
        Object.assign({ hero:source.reference, cible }, commun)
      );
      const essai = simulationDuBuild(
        Object.assign({ hero:source.essai, cible }, commun)
      );
      return {
        cible,
        reference:reference && reference.dps,
        essai:essai && essai.dps,
        ecart:ecartEntre(reference && reference.dps, essai && essai.dps),
        /* Les exclusions ne dependent pas des enchantements : celles de la
           reference suffisent, et les repeter doublerait la liste a l'ecran. */
        nonInclus:reference ? reference.nonInclus : [],
        hypotheses:reference ? reference.hypotheses : [],
        animations:reference ? reference.animations : null
      };
    });

    const chiffrees = lignes.filter(
      ligne => ligne.ecart && ligne.ecart.relatif !== null
    );
    const taux = chiffrees.map(ligne => ligne.ecart.relatif);
    return {
      lignes,
      /* Le resume ne parle QUE des cibles chiffrees : en compter une
         inconnue comme une egalite ferait croire a un match nul.

         « CIBLE » et non « palier » : le mannequin d'entrainement en est une
         sans etre un palier, et Akumu n'en a que trente. Dire « 31 paliers »
         inventait un palier 31 qui n'existe pas. */
      resume:chiffrees.length ? {
        cibles:chiffrees.length,
        gagnants:taux.filter(valeur => valeur > 0).length,
        perdants:taux.filter(valeur => valeur < 0).length,
        minimum:Math.min(...taux),
        maximum:Math.max(...taux),
        bascules:basculesDe(lignes)
      } : null
    };
  }

export { comparerSurLesCibles };
