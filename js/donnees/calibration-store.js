/* La constante C mesuree par un membre, rangee par personnage et type d'arme.

   LOCALE, et volontairement pas synchronisee vers Supabase. C n'est pas une
   donnee de confrerie : elle est propre au build d'un membre ET a ses
   potentiels debloques. Partager celle d'un autre reviendrait a lui proposer
   un chiffre faux, avec l'autorite d'un chiffre mesure - c'est pire que de ne
   rien proposer.

   La procedure publiee precise qu'elle change a CHAQUE potentiel debloque.
   Une valeur ancienne reste plus utile que la constante par defaut, mais la
   vue doit rappeler qu'elle se recalibre. */

import { CALIBRATION_KEY } from "../noyau/constantes.js";

  function lireCalibrations(){
    try{
      const brut = JSON.parse(localStorage.getItem(CALIBRATION_KEY));
      return brut && typeof brut === "object" && !Array.isArray(brut) ? brut : {};
    }catch(erreur){
      /* Un stockage illisible ne doit pas condamner l'onglet : on repart d'un
         registre vide, la page retombe sur la constante par defaut. */
      return {};
    }
  }

  let calibrations = lireCalibrations();

  /* Le type d'arme fait partie de la cle : un meme personnage change de build
     en changeant d'arme, donc de constante. */
  function cleCalibration(charId, typeArme){
    return charId && typeArme ? charId + "|" + typeArme : null;
  }

  function enregistrerCalibrations(){
    localStorage.setItem(CALIBRATION_KEY, JSON.stringify(calibrations));
  }

  const CalibrationStore = {
    /* `null` et jamais une valeur de repli : c'est le moteur qui decide de son
       defaut, pas le stockage. Un repli rendu ici se confondrait avec une
       mesure. */
    get(charId, typeArme){
      const cle = cleCalibration(charId, typeArme);
      const valeur = cle ? Number(calibrations[cle]) : NaN;
      return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
    },
    set(charId, typeArme, constante){
      const cle = cleCalibration(charId, typeArme);
      const valeur = Number(constante);
      if(!cle || !Number.isFinite(valeur) || valeur <= 0) return null;
      calibrations[cle] = valeur;
      enregistrerCalibrations();
      return valeur;
    },
    clear(charId, typeArme){
      const cle = cleCalibration(charId, typeArme);
      if(!cle || !Object.prototype.hasOwnProperty.call(calibrations, cle)){
        return false;
      }
      delete calibrations[cle];
      enregistrerCalibrations();
      return true;
    }
  };

export { CalibrationStore };
