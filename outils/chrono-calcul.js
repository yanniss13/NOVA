"use strict";

/* Le calcul du chronometrage, sans DOM ni navigateur.

   Le mode rafale existe pour une raison precise : une competence sans
   recharge se rejoue quand son animation finit, donc l'intervalle entre deux
   lancements EST la duree cherchee. On evite ainsi d'avoir a definir ce que
   veut dire « la fin de l'animation », question sur laquelle deux mesureurs
   ne repondraient jamais pareil.

   Une mesure vaut pour UN gameId : heros, arme et emplacement. Un heros n'a
   pas le meme moveset selon l'arme equipee — Meliodas a la hache et Meliodas
   a l'epee longue sont deux animations differentes. */

  function arrondirAuMillieme(valeur){
    return Math.round(valeur * 1000) / 1000;
  }

  function verifierBornes(secondeDebut, secondeFin){
    if(!(secondeFin > secondeDebut)){
      throw new Error("La fin doit venir apres le debut.");
    }
  }

  function dureeRafale({ secondeDebut, secondeFin, repetitions }){
    verifierBornes(secondeDebut, secondeFin);
    if(!(repetitions >= 2)){
      throw new Error("Il faut au moins deux repetitions.");
    }
    return arrondirAuMillieme((secondeFin - secondeDebut) / repetitions);
  }

  function dureeUnique({ secondeDebut, secondeFin }){
    verifierBornes(secondeDebut, secondeFin);
    return arrondirAuMillieme(secondeFin - secondeDebut);
  }

  function estAutoAttaque(gameId){
    return /jumpatk|normalatk/.test(String(gameId || ""));
  }

  function protocolePour(gameId){
    return estAutoAttaque(gameId)
      ? { mode:"rafale", repetitions:10 }
      : { mode:"unique", repetitions:null };
  }

  function protocoleValide({ gameId, mode, repetitions }){
    const attendu = protocolePour(gameId);
    if(mode !== attendu.mode) return false;
    if(mode === "unique") return repetitions === null;
    return Number.isInteger(repetitions) && repetitions >= 2;
  }

  function fpsPour(dureeImage, cadenceRepli=60){
    const fps = Number(dureeImage) > 0 ? 1 / Number(dureeImage) : cadenceRepli;
    return Math.round(fps * 1000) / 1000;
  }

  const API = { dureeRafale, dureeUnique, protocolePour, protocoleValide, fpsPour };

  if(typeof module !== "undefined" && module.exports) module.exports = API;
  if(typeof window !== "undefined") window.ChronoCalcul = API;
