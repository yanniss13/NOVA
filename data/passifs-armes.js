// Passifs d'arme qui changent les degats.
//
// ECRIT ET MAINTENU A LA MAIN. Aucun generateur ne produit cette table : le
// test relit chaque chiffre dans le texte publie de l'arme, niveau par niveau.
//
// La cle est le FICHIER d'arme. Un type d'arme serait trop large : Derieri
// peut equiper treize gantelets, mais seul celui-ci porte Barrage des Tenebres.
//
// `AllElement_Rate` semble contredire la prose « attaque des Tenebres ».
// Les releves de Derieri tranchent : le bonus majore aussi « tous elements ».
// C'est donc un taux sur toute l'attaque elementaire, jamais un bonus de degats.
//
// La seconde phrase de ce passif ajoute elle aussi un « (Max : » a partir du
// niveau 4. L'ancre du plafond contient donc « pendant 5s. » pour ne designer
// que l'effet d'attaque. Chaque ancre apparait exactement une fois par niveau.
//
// La seconde phrase sur les degats crit. reste hors table : sa condition et son
// declenchement ne sont pas mesures. Aucun chiffre ne lui est attribue ici.
window.SEVEN_DS_PASSIFS_ARMES = {
  "7ds-armes/Gantelets/Gantelets de l'âme vorace.webp":[
    {
      id:"gantelets-ame-vorace-barrage-tenebres",
      libelle:"Barrage des Ténèbres : attaque élémentaire +100 %",
      stat:"AllElement_Rate",
      operation:"add",
      unite:"ten-thousandths",
      niveaux:[3200, 4800, 5600, 6400, 7200, 8000, 10000],
      parCumul:[80, 120, 140, 160, 180, 200, 250],
      cumuls:40,
      provenance:{
        phrase:"pendant 5s. (Max : ",
        phraseCumul:"augmente l'attaque des Ténèbres de "
      }
    }
  ]
};
