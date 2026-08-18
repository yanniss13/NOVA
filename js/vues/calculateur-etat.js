/* L'etat de la page Calculateur, sorti pour etre partage.

   Il vit dans un objet `const` mute sur place, jamais reaffecte : les modules
   qui l'importent lisent donc toujours la meme instance. C'est ce qui permet
   aux sections de lignes cochables de vivre dans leur propre fichier sans que
   chaque fonction ait a recevoir l'etat en parametre. */

import { CoequipiersStore } from "../donnees/coequipiers-store.js";

  /* Etat de la page. `retouches` ne contient que ce que le membre a
     REELLEMENT modifie : une cle absente vaut « valeur du build ». */
  const etat = {
    charId:null,
    typeArme:null,
    heroImpose:null,
    /* Le palier d'Akumu affronte par la confrerie, ou le mannequin. Le defaut
       reste le palier 1 : c'etait la cible unique avant que les vingt niveaux
       ne soient releves, et ajouter le choix ne doit deplacer aucun chiffre
       tant que le membre n'a rien touche. */
    cibleId:"akumu-1",
    /* Les coequipiers retenus, restaures du stockage. Trois cases vides par
       defaut : le chiffre reste celui du heros seul tant qu'on n'y touche
       pas. */
    coequipiers:CoequipiersStore.get(),
    retouches:{},
    essaiEnchantements:null,
    etatsEnsembles:{},
    coches:new Set(),
    /* Les passifs qui montent par CUMULS : leur nombre de crans, par
       identifiant. Un etat a part de `coches`, parce qu'une case ne sait dire
       que oui ou non, et que ces passifs-la valent 0, 1, 2 … jusqu'a leur
       plafond. Absent du dictionnaire = zero cumul = eteint. */
    cumuls:{},
    /* La calibration : index de la competence choisie, degats saisis, et le
       dernier message rendu. Le message est garde dans l'etat parce que la
       page se redessine entierement a chaque action. */
    calibrationCompetence:0,
    degatsObserves:"",
    messageCalibration:null
  };

export { etat };
