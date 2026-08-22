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

  /* Le dossier du fichier EST la cle d'emplacement de l'application : elle
     ecrit « Haut », « Ceinture », « Armure liee ». Aucune table de traduction —
     `gearDomainOf` compare a ces memes noms, et une cle anglaise y tomberait
     silencieusement dans « armor », rangeant un anneau parmi les armures. */
  const EMPLACEMENTS_CONNUS = new Set([
    "Haut", "Bas", "Bottes", "Ceinture", "Armure liee",
    "Anneau", "Collier", "Boucle d'oreille"
  ]);

  function slotDuFichier(fichier){
    const dossier = String(fichier).split("/")[1];
    return EMPLACEMENTS_CONNUS.has(dossier) ? dossier : null;
  }

  function toutesLesPieces(){
    return [
      ...Object.keys(BUILD_STATS.gearByFile || {}),
      ...Object.keys(BUILD_STATS.engravedByFile || {})
    ];
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

  /* Les stats qu'une piece peut porter : sa principale, sa secondaire, et ses
     enchantements possibles. C'est ce qui ramene les candidats du recalage de
     quatre-vingts a une quinzaine, et fait tomber la confusion entre libelles
     elementaires voisins. */
  function codesPossibles(definition){
    const options = ((definition.randomOptions || {}).stats) || [];
    /* Une piece gravee porte en plus des `extraStats` fixes — defense,
       degats crit., degats de competence normale selon la piece. Les omettre
       rendait ses propres lignes inexplicables, et la piece etait ecartee. */
    const supplements = (definition.extraStats || [])
      .map(extra => extra && extra.stat);
    return [definition.mainStat, definition.subStat,
      ...options.map(o => o.stat), ...supplements].filter(Boolean);
  }

  function deduirePiece(entree){
    const stats = (entree && Array.isArray(entree.stats)) ? entree.stats : [];
    if(!stats.length) return { statut:"aucun", candidats:[] };

    const candidats = [];
    for(const fichier of toutesLesPieces()){
      const slot = slotDuFichier(fichier);
      const definition = buildGearDefinition(fichier);
      if(!slot || !definition) continue;

      /* Une piece gravee est liee a un personnage. Connaitre le heros suffit
         donc a ecarter les cinq autres qui partagent son profil de statistiques
         — sans ce filtre, la gravee restait le seul cas vraiment ambigu. */
      if(definition.character && entree.herosSlug
        && definition.character !== entree.herosSlug) continue;

      const permis = codesPossibles(definition);
      const lues = stats.map(s => ({
        /* Deux recalages, et la difference entre eux porte tout le
           raisonnement. Contre le catalogue ENTIER : ce texte est-il une vraie
           statistique ? Contre les stats PERMISES : cette piece peut-elle la
           porter ? */
        connue:recalerLibelle(s.libelle, s.valeur, []),
        recale:recalerLibelle(s.libelle, s.valeur, permis),
        nombre:valeurNumerique(s.valeur)
      }));

      /* Une vraie statistique que la piece ne peut pas porter la disqualifie.
         Sans ce controle, une ceinture atteignant par hasard la meme valeur
         principale qu'une armure gravee etait retenue, ses stats surnumeraires
         simplement ignorees — et le resultat sortait en « unique », donc avec
         confiance, entierement faux.

         Un texte qui ne correspond a AUCUNE statistique est du bruit : le
         panneau contient aussi des descriptions de bonus d'ensemble, que l'OCR
         agglomere parfois en une fausse ligne. On l'ignore au lieu de
         condamner la piece. */
      const contredite = lues.some(s =>
        s.connue.statut !== "rejete"
        && (s.recale.statut === "rejete" || s.nombre === null));
      if(contredite) continue;

      const principale = lues.find(s => s.recale.code === definition.mainStat);
      if(!principale) continue;
      const secondaire = definition.subStat
        ? lues.find(s => s.recale.code === definition.subStat) : null;

      for(const config of configsDePiece(fichier, slot, principale.nombre,
        secondaire ? secondaire.nombre : null)){
        candidats.push({
          fichier,
          slot,
          level:config.level,
          reinforce:config.reinforce,
          enchantments:Array.from(
            { length:gearEnchantmentLength(definition) }, () => null),
          passiveLevel:Array.isArray(definition.passiveLevels)
            && definition.passiveLevels.length ? 1 : null
        });
      }
    }
    if(!candidats.length) return { statut:"aucun", candidats:[] };
    return { statut:candidats.length === 1 ? "unique" : "ambigu", candidats };
  }

export { deduirePiece };
