/* De ce que l'OCR a lu vers ce que le site stocke.

   Le site ne stocke pas des statistiques : il stocke une configuration, et
   recalcule les statistiques a partir des tables du jeu. Ce module fait le
   trajet inverse.

   Premiere etape : ramener chaque libelle lu sur une entree de `statLabels`.
   Le jeu ecrit exactement les memes chaines que le catalogue — les treize
   libelles releves sur des captures reelles s'y retrouvent au caractere pres.
   L'OCR n'a donc pas besoin d'etre exact, seulement d'etre assez proche pour
   qu'un seul candidat se detache. */

import { BUILD_STATS } from "../noyau/constantes.js";
import { buildGearDefinition, gearEnchantmentLength } from "./build-config.js";
import { calculateGearStats } from "./stats-calcul.js";

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

  function recalerLibelle(texte, valeurBrute, codesAutorises){
    const cible = normaliserLibelle(texte);
    if(!cible) return { statut:"rejete", code:null, rival:null };

    const unite = uniteDeLaValeur(valeurBrute);
    let liste = candidatsDuCatalogue(codesAutorises, unite);
    /* Une piece dont aucune stat permise ne partage l'unite lue : plutot que
       de renoncer, on rouvre le catalogue permis. C'est le cas d'une valeur
       dont le « % » a saute a la lecture. */
    if(!liste.length) liste = candidatsDuCatalogue(codesAutorises, null);
    if(!liste.length) return { statut:"rejete", code:null, rival:null };

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

  /* Une configuration « nue » : le bon nombre d'emplacements d'enchantement,
     tous vides. On ne cherche ici que le couple (niveau, renforcement), et les
     enchantements n'entrent ni dans la valeur principale ni dans la
     secondaire — c'est ce qui rend l'inversion possible sans les connaitre. */
  function configNue(definition, level, reinforce){
    return {
      version:1,
      level,
      reinforce,
      enchantments:Array.from(
        { length:gearEnchantmentLength(definition) }, () => null),
      passiveLevel:Array.isArray(definition.passiveLevels)
        && definition.passiveLevels.length ? 1 : null
    };
  }

  function valeurDuRole(resultat, role){
    const terme = (resultat.terms || []).find(t => t.role === role);
    return terme ? terme.value : null;
  }

  /* Le site calcule configuration -> valeurs. Ici on parcourt l'espace des
     configurations possibles et on garde celles qui reproduisent ce qui est
     affiche.

     L'espace est petit — au plus une quarantaine de niveaux fois six
     renforcements — donc la force brute est le bon outil. Surtout, elle appelle
     les vraies formules du jeu au lieu de les reimplementer : si les tables
     evoluent, l'inversion suit sans qu'on y touche. */
  function configsDePiece(fichier, slotKey, valeurPrincipale, valeurSecondaire){
    const definition = buildGearDefinition(fichier);
    if(!definition) return [];
    const attendueSecondaire = (valeurSecondaire === null
      || valeurSecondaire === undefined) ? null : valeurSecondaire;
    const trouvees = [];
    for(let level = definition.qualityMin; level <= definition.qualityMax; level++){
      for(let reinforce = 0; reinforce <= definition.reinforceMax; reinforce++){
        const resultat = calculateGearStats(
          fichier, configNue(definition, level, reinforce), slotKey);
        if(!resultat || resultat.status !== "valid") continue;
        if(valeurDuRole(resultat, "main") !== valeurPrincipale) continue;
        if(attendueSecondaire !== null
          && valeurDuRole(resultat, "sub") !== attendueSecondaire) continue;
        trouvees.push({ level, reinforce });
      }
    }
    return trouvees;
  }

/* Aucun `export` tant qu'aucun module n'importe d'ici : le depot exige que
   tout symbole exporte soit consomme, et `tests/modules-imports.test.js`
   le verifie. Les tests unitaires passent par les hooks du chargeur `vm`,
   pas par les imports. La vue d'import ajoutera la ligne le jour ou elle
   consommera `deduirePiece`. */
