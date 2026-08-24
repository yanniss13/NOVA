/* De ce que l'OCR a lu vers ce que le site stocke.

   Le site ne stocke pas des statistiques : il stocke une configuration, et
   recalcule les statistiques a partir des tables du jeu. Ce module fait le
   trajet inverse.

   Le rapprochement d'un texte lu sur une statistique du catalogue vit dans
   `ocr-libelles.js`, que la deduction d'arme et celle des enchantements
   partagent. Ici on ne fait que l'inversion : des valeurs affichees vers la
   piece, son niveau et son renforcement. */

import { BUILD_STATS } from "../noyau/constantes.js";
import { buildGearDefinition, gearEnchantmentLength } from "./build-config.js";
import { enchantementsDePiece } from "./ocr-enchantements.js";
import {
  normaliserLibelle, rapprocher, recalerLibelle, valeurNumerique
} from "./ocr-libelles.js";
import { calculateGearStats } from "./stats-calcul.js";

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

  /* Une ligne rangee sous un titre de section n'est pas une statistique
     native de la piece : « Bonus de gravure » coiffe ses options
     aleatoires, « Ensemble 3 pieces » les bonus de panoplie. Les melanger
     a l'inversion reviendrait a chercher une piece capable de toutes les
     porter — et aucune ne le peut, donc rien ne sortirait. */
  function estNative(ligne){ return !ligne.section; }

  function nomDePieceDuFichier(fichier){
    return String(fichier).split("/").pop().replace(/\.webp$/i, "");
  }

  /* LE NOM LU TRANCHE ENTRE DES PIECES INDISCERNABLES.

     Trois armures liees partagent les memes courbes de statistiques : leurs
     totaux sont identiques au point pres, et l'inversion ne peut pas les
     departager. Le membre devait choisir a chaque import. Le titre du panneau,
     lui, les distingue sans ambiguite.

     DEUX GARDE-FOUS, et ils comptent plus que la fonction elle-meme :

     - le nom RESTREINT une liste que le catalogue a deja validee, il n'y ajoute
       jamais rien. Un nom mal lu ne peut donc pas faire entrer une piece que
       les chiffres contredisent ;
     - seule une correspondance EXACTE est retenue. Un rapprochement approximatif
       transformerait une ambiguite honnete — ou le site pose la question — en
       certitude fausse, ce qui est bien pire. Tesseract lit rarement un titre
       au caractere pres et retombe donc sur le comportement d'avant ; la
       lecture assistee, elle, le rend fidelement. */
  function restreindreParLeNom(candidats, nom){
    const cible = normaliserLibelle(nom);
    if(!cible) return candidats;
    const fichiers = [...new Set(candidats.map(item => item.fichier))];
    if(fichiers.length < 2) return candidats;
    const trouve = rapprocher(cible, fichiers.map(fichier => ({
      code:fichier, cle:normaliserLibelle(nomDePieceDuFichier(fichier))
    })));
    if(trouve.statut !== "exact") return candidats;
    const retenus = candidats.filter(item => item.fichier === trouve.code);
    return retenus.length ? retenus : candidats;
  }

  function deduirePiece(entree){
    const lignes = (entree && Array.isArray(entree.stats)) ? entree.stats : [];
    const stats = lignes.filter(estNative);
    const enchantees = lignes.filter(ligne => !estNative(ligne));
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

      /* Les enchantements ne participent pas a l'inversion — ils n'entrent
         ni dans la valeur principale ni dans la secondaire — mais ils font
         partie de la piece. Les omettre livrait un build sous-estime. */
      const enchantments = enchantementsDePiece(fichier, enchantees);
      for(const config of configsDePiece(fichier, slot, principale.nombre,
        secondaire ? secondaire.nombre : null)){
        candidats.push({
          fichier,
          slot,
          level:config.level,
          reinforce:config.reinforce,
          enchantments,
          passiveLevel:Array.isArray(definition.passiveLevels)
            && definition.passiveLevels.length ? 1 : null
        });
      }
    }
    if(!candidats.length) return { statut:"aucun", candidats:[] };
    const retenus = restreindreParLeNom(candidats, entree && entree.nom);
    return {
      statut:retenus.length === 1 ? "unique" : "ambigu",
      candidats:retenus
    };
  }

export { deduirePiece };
