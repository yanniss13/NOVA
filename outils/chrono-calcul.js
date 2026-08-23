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

  /* La duree d'une image ne se deduit pas de DEUX images voisines : leur ecart
     tremble, et le trembler suffit a ecrire 29.999 pour un fichier a 30. On la
     lit donc sur une fenetre longue, en divisant le temps ecoule par le nombre
     EXACT d'images ecoulees, que le navigateur compte lui-meme.

     Ce compteur ferme aussi une porte : si un rappel manque des images, elles
     restent comptees, et la cadence ne se retrouve pas divisee par deux. */
  function dureeImageMesuree({ tempsDebut, imagesDebut, tempsFin, imagesFin }){
    const images = Number(imagesFin) - Number(imagesDebut);
    const temps = Number(tempsFin) - Number(tempsDebut);
    if(!(images > 0) || !(temps > 0)) return 0;
    const duree = temps / images;
    // Entre 10 et 240 images par seconde : au-dela c'est une recherche, pas une image.
    return (duree > 0.004 && duree < 0.1) ? duree : 0;
  }

  /* Deux decimales : assez pour distinguer 29.97 de 30, pas assez pour montrer
     le tremblement de la derniere image. Les zeros de queue tombent, sinon un
     fichier a 30 s'annoncerait « 30.00 img/s ». */
  function cadenceAffichee(fps){
    return String(Number(Number(fps).toFixed(2)));
  }

  const API = {
    dureeRafale, dureeUnique, protocolePour, protocoleValide, fpsPour,
    dureeImageMesuree, cadenceAffichee
  };

  if(typeof module !== "undefined" && module.exports) module.exports = API;
  if(typeof window !== "undefined") window.ChronoCalcul = API;
