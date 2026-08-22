/* Le socle de lecture des libelles du jeu.

   Un OCR ne rend jamais exactement ce qui est ecrit. Ce module ramene ce qu'il
   a lu sur une entree du catalogue quand c'est possible, et refuse quand ca ne
   l'est pas. Tout le reste de la chaine d'import s'appuie dessus : l'inversion
   d'une piece, celle d'une arme et celle des enchantements posent la meme
   question — « ce texte designe-t-il cette statistique ? ».

   Il vit a part parce que ces trois modules l'utilisent : le laisser dans l'un
   d'eux ferait que les deux autres le citeraient a travers lui, et la couche
   `metier` interdit qu'un module en cite un declare apres lui. */

import { BUILD_STATS } from "../noyau/constantes.js";

  const STAT_LABELS = BUILD_STATS.statLabels || {};

  /* Tout ce qu'un OCR abime sans changer le sens disparait ici : accents,
     casse, ponctuation, et les espaces exotiques — l'insecable fine que le jeu
     emploie comme separateur de milliers en fait partie. A elle seule, cette
     etape neutralise la moitie des lectures legerement fautives. */
  function normaliserLibelle(texte){
    const brut = (texte === undefined || texte === null) ? "" : String(texte);
    return brut
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[\u00a0\u202f\u2009\s]+/g, " ")
      .replace(/[^a-z0-9 ]/g, "")
      .replace(/ +/g, " ")
      .trim();
  }

  function distance(a, b){
    if(a === b) return 0;
    if(!a.length) return b.length;
    if(!b.length) return a.length;
    let precedente = Array.from({ length:b.length + 1 }, (_, i) => i);
    for(let i = 1; i <= a.length; i++){
      const courante = [i];
      for(let j = 1; j <= b.length; j++){
        courante[j] = Math.min(
          precedente[j] + 1,
          courante[j - 1] + 1,
          precedente[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      precedente = courante;
    }
    return precedente[b.length];
  }

  /* La valeur lue a cote du libelle porte un signal gratuit et tres fiable :
     un « % » veut dire `ten-thousandths`, son absence veut dire `flat`. Il
     tranche les sept paires de libelles homonymes du catalogue — `Attaque de
     Feu` existe en valeur brute et en pourcentage. Sans lui, ces paires
     produisaient des lectures fausses et silencieuses. */
  function uniteDeLaValeur(valeurBrute){
    if(valeurBrute === undefined || valeurBrute === null) return null;
    return /%/.test(String(valeurBrute)) ? "ten-thousandths" : "flat";
  }

  /* Au-dela d'un tiers du libelle abime, on ne rattrape plus : on rejette. Et
     un second candidat trop proche rend la reponse suspecte, donc ambigue —
     sans cette marge, on « reussirait » en tirant au sort entre deux voisins. */
  const TOLERANCE = 0.34;
  const MARGE_MINIMALE = 2;

  function candidatsDuCatalogue(codesAutorises, unite){
    const permis = Array.isArray(codesAutorises) && codesAutorises.length
      ? new Set(codesAutorises) : null;
    return Object.keys(STAT_LABELS)
      .filter(code => !permis || permis.has(code))
      .filter(code => !unite || STAT_LABELS[code].unit === unite)
      .map(code => ({ code, cle:normaliserLibelle(STAT_LABELS[code].fr) }));
  }

  /* Le rapprochement d'un texte lu sur une liste de reference. Il sert deux
     fois : sur les libelles de statistiques (via `recalerLibelle`) et sur les
     noms d'armes, ou la reference n'est pas le catalogue de stats. */
  function rapprocher(cible, liste){
    if(!cible || !liste.length){
      return { statut:"rejete", code:null, rival:null };
    }
    let meilleur = null;
    let second = null;
    for(const entree of liste){
      const d = distance(cible, entree.cle);
      if(!meilleur || d < meilleur.d){
        second = meilleur;
        meilleur = { entree, d };
      }else if(!second || d < second.d){
        second = { entree, d };
      }
    }
    if(meilleur.d === 0){
      return { statut:"exact", code:meilleur.entree.code, rival:null };
    }
    const relative = meilleur.d
      / Math.max(cible.length, meilleur.entree.cle.length);
    if(relative > TOLERANCE) return { statut:"rejete", code:null, rival:null };
    if(second && (second.d - meilleur.d) < MARGE_MINIMALE){
      return { statut:"ambigu", code:meilleur.entree.code,
        rival:second.entree.code };
    }
    return { statut:"rattrape", code:meilleur.entree.code, rival:null };
  }

  function recalerLibelle(texte, valeurBrute, codesAutorises){
    const cible = normaliserLibelle(texte);
    if(!cible) return { statut:"rejete", code:null, rival:null };

    const unite = uniteDeLaValeur(valeurBrute);
    let liste = candidatsDuCatalogue(codesAutorises, unite);
    /* Une piece dont aucune stat permise ne partage l'unite lue : plutot que
       de renoncer, on rouvre le catalogue permis. C'est le cas d'une valeur
       dont le « % » a saute a la lecture. */
    if(!liste.length) liste = candidatsDuCatalogue(codesAutorises, null);
    return rapprocher(cible, liste);
  }

  /* Le nombre lu par l'OCR vers l'entier que le catalogue manipule. Les
     pourcentages y sont stockes en dix-millemes : « 5.53% » vaut 553. Les
     separateurs de milliers du jeu sont des espaces insecables fines, que le
     nettoyage doit retirer sans quoi « 12 560 » deviendrait 12. */
  function valeurNumerique(brut){
    const net = String(brut).replace(/[\s\u00a0\u202f]/g, "");
    const pourcentage = /%$/.test(net);
    const nombre = Number(net.replace(/%$/, "").replace(/,/g, "."));
    if(!Number.isFinite(nombre)) return null;
    return pourcentage ? Math.round(nombre * 100) : nombre;
  }

/* `normaliserLibelle` et `rapprocher` attendent leur consommateur :
   `ocr-arme.js` recalera le nom lu sur les cent cinquante-cinq armes, ce
   qui n'est pas un libelle de statistique et ne passe donc pas par
   `recalerLibelle`. Le depot interdit d'exporter avant d'etre importe. */
export { normaliserLibelle, rapprocher, recalerLibelle, valeurNumerique };
