/* Des statistiques d'arme lues vers la configuration que le site stocke.

   Le panneau montre des totaux, pas le grade ni les promotions. On parcourt
   donc les configurations valides du catalogue et on ne garde que celles qui
   reproduisent exactement les chiffres natifs lus. Les lignes en section sont
   traitees ensuite : elles sont des enchantements, jamais des totaux natifs. */

import { BUILD_STATS } from "../noyau/constantes.js";
import { weaponTypesOf } from "./armes.js";
import { buildWeaponDefinition, weaponConfigStatus, weaponLevelCap } from "./build-config.js";
import { enchantementsDArme, nueDArme } from "./ocr-enchantements.js";
import { normaliserLibelle, rapprocher, recalerLibelle, valeurNumerique } from "./ocr-libelles.js";
import { calculateWeaponStats } from "./stats-calcul.js";

  function nomDuFichier(fichier){
    return String(fichier).split("/").pop().replace(/\.webp$/i, "");
  }

  function armesRapprochables(herosSlug){
    const compatibles = herosSlug ? new Set(weaponTypesOf(herosSlug)) : null;
    return Object.keys(BUILD_STATS.weaponsByFile || {}).filter(fichier =>
      !compatibles || compatibles.has(String(fichier).split("/")[1])
    );
  }

  function statsNatives(lignes, codes){
    const lues = lignes.map(ligne => ({
      recale:recalerLibelle(ligne && ligne.libelle, ligne && ligne.valeur, []),
      valeur:valeurNumerique(ligne && ligne.valeur)
    }));
    if(lues.some(ligne => !ligne.recale.code || ligne.recale.statut === "rejete"
      || ligne.valeur === null || !codes.has(ligne.recale.code))){
      return null;
    }
    return lues;
  }

  function totauxCorrespondent(fichier, config, lues){
    const resultat = calculateWeaponStats(fichier, config);
    if(resultat.status !== "valid") return false;
    const totaux = new Map((resultat.totals || []).map(total =>
      [total.stat, total.value]));
    return lues.every(ligne => totaux.get(ligne.recale.code) === ligne.valeur);
  }

  function niveauxDeDepassement(grade, passif){
    const niveaux = grade.overlimit && Array.isArray(grade.overlimit.levels)
      ? grade.overlimit.levels.map(item => item && item.level).filter(Number.isInteger)
      : [0];
    return Number.isInteger(passif) ? niveaux.filter(niveau => niveau === passif - 1)
      : niveaux;
  }

  function deduireArme(entree){
    const source = entree || {};
    const nom = normaliserLibelle(source.nom);
    const lignes = Array.isArray(source.stats) ? source.stats : [];
    const natives = lignes.filter(ligne => ligne && ligne.section === null);
    const enchantees = lignes.filter(ligne => ligne && ligne.section !== null);
    if(!nom || !natives.length) return { statut:"aucun", candidats:[] };

    const fichiers = armesRapprochables(source.herosSlug);
    const rapprochement = rapprocher(nom, fichiers.map(fichier => ({
      code:fichier, cle:normaliserLibelle(nomDuFichier(fichier))
    })));
    if(!rapprochement.code || rapprochement.statut === "rejete"){
      return { statut:"aucun", candidats:[] };
    }

    const fichier = rapprochement.code;
    const weapon = buildWeaponDefinition(fichier);
    if(!weapon) return { statut:"aucun", candidats:[] };
    const candidats = [];
    for(const grade of Object.values(weapon.gradesByGameId || {})){
      if(!grade) continue;
      /* Une sous-stat est propre au grade : l'union de tous les grades
         accepterait une ligne que la candidate courante ne peut pas porter. */
      const codes = new Set([weapon.mainStatCode,
        ...(grade.subStats || []).map(sub => sub && sub.stat)].filter(Boolean));
      const lues = statsNatives(natives, codes);
      if(!lues) continue;
      for(let promotion = 0; promotion <= (grade.promotionSteps || []).length; promotion++){
        const plafond = weaponLevelCap(grade, promotion);
        if(plafond < 0) continue;
        for(let level = 0; level <= plafond; level++){
          if(Number.isInteger(source.niveau) && level !== source.niveau) continue;
          for(const overlimit of niveauxDeDepassement(grade, source.passif)){
            const nue = {
              version:1, gradeGameId:grade.gameId, level, promotion, overlimit,
              enchantments:nueDArme(grade)
            };
            if(!totauxCorrespondent(fichier, nue, lues)) continue;
            const deduction = enchantementsDArme(grade, enchantees, [...codes]);
            const config = Object.assign({}, nue, { enchantments:deduction.choix });
            /* Une candidate OCR passe par le meme juge que la saisie manuelle. */
            if(weaponConfigStatus(fichier, config) !== "valid") continue;
            candidats.push({
              fichier, slot:"Arme", gradeGameId:config.gradeGameId,
              level:config.level, promotion:config.promotion,
              overlimit:config.overlimit, enchantments:config.enchantments,
              elementSuppose:deduction.suppose
            });
          }
        }
      }
    }
    if(!candidats.length) return { statut:"aucun", candidats:[] };
    return { statut:candidats.length === 1 ? "unique" : "ambigu", candidats };
  }

export { deduireArme };
