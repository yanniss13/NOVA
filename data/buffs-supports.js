// Buffs des supports que la confrerie joue reellement.
//
// ECRIT ET MAINTENU A LA MAIN. C'est l'exception de data/ : aucun script ne le
// regenere, et aucun ne doit le citer. La source ne publie pas ces valeurs -
// son champ `buffs` ne porte qu'un identifiant, un type et une duree, jamais
// une stat ni une cible - donc elles sont transcrites depuis les descriptions
// francaises de data/wiki-competences.js.
//
// provenance.gameId + provenance.phrase disent d'ou vient chaque chiffre :
// quand le jeu dement une valeur, on sait quelle phrase avait ete lue. Un test
// verifie que la phrase est un extrait LITTERAL de la description du gameId.
//
// Deux formes, selon QUI la ligne modifie. Une entree porte l'une ou l'autre,
// jamais les deux, et un test le verifie :
//
//   BONUS SUR LE HEROS
//     stat    : code du depot, present dans 7ds-stats/libelles-stats.json.
//
//   MALUS SUR L'ENNEMI          (cible:"ennemi")
//     effet   : "defense"          la defense de la cible, MULTIPLIEE
//                                  par (1 - valeur)
//               "defenseCritique"  sa defense critique, en POINTS retranches
//
//     Ces deux formes ne sont pas interchangeables et la difference est
//     mesuree, pas supposee : chez l'outil de reference, `d-edef` multiplie
//     la defense tandis que `d-ecdr` se retranche en points (une defense
//     critique de 50 reduite de « 50 » tombe a 0, pas a 25).
//
//     Il n'existe AUCUN code de stat pour ces malus : libelles-stats.json ne
//     decrit que des statistiques de heros. Leur inventer un code aurait
//     desactive le test qui refuse les codes inventes.
//
// operation : "add" ajoute la valeur, "multiply" multiplie celle du heros.
// element   : null, ou l'attribut vise quand le buff ne concerne que lui.
//             L'element d'un heros vient de son ARME equipee, pas du perso.
// unite     : "ten-thousandths" pour un taux, "flat" pour une valeur brute.
//
// Les valeurs a CUMULS sont transcrites au maximum atteignable, comme le
// reste de la table : « 2 % par cumul, max 10 fois » s'ecrit 2000.
//
// CE QUI N'Y FIGURE PAS, ET POURQUOI :
//
// - les soins, barrieres, gains de defense ou de PV : sans conversion
//   offensive ils ne changent aucun degat. Les mettre a zero serait pire que
//   les omettre, car un zero se lit comme « ce buff ne sert a rien ».
// - les buffs restreints a une CATEGORIE de competence - « degats d'attaque
//   ultime +30 % », « degats de competence normale +50 % ». Les entrees du
//   moteur sont calculees une fois pour toutes les competences : appliquer un
//   bonus d'attaque normale a une ultime serait faux. Ils sont connus, listes
//   ci-dessous, et attendent que le calcul devienne par competence :
//     elizabeth_staff_skill_q  degats crit. des attaques normales +50 %
//     elizabeth_staff_passive  degats d'attaque normale +60 %
//     manny_staff_passive      degats d'attaque ultime +30 %
//     derieri_axe_skill_q      degats de competence normale (Tenebres) +50 %
//     derieri_sword2h_passive  degats crit. d'ultime et d'attaque combinee +60 %
// - la perforation et les efficacites de duree : le moteur n'a pas d'entree
//   pour elles. La perforation ne perce d'ailleurs aucune defense - elle
//   s'oppose a la Perseverance de l'ennemi, une couche que la formule
//   publiee ne modelise pas du tout.
// - les reductions de defense ELEMENTAIRE, qui visent une defense distincte
//   de la defense generale et que le moteur ne separe pas :
//     derieri_sword2h_skill_q  defense de Feu -20 % de la defense
//     gowther_wand_skill_e     defense de Foudre -6 % de la defense, max 4x
//   Les verser dans la reduction generale supposerait que le jeu confond les
//   deux. Elles reviendront quand la cible portera ses defenses par element.
window.SEVEN_DS_BUFFS_SUPPORTS = {
  "daisy": [
    {
      id:"daisy-salve-defense-crit",
      libelle:"Défense crit. de l'ennemi −50 %",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      valeur:5000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"daisy_book_skill_q",
        phrase:"réduit leur défense crit. de 50% pendant 10s"
      }
    },
    {
      id:"daisy-reveil-degats-crit",
      libelle:"Dégâts crit. des alliés +15 %",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"daisy_book_skill_rmb",
        phrase:"Augmente les dégâts crit. des alliés de 15% pendant 40s"
      }
    },
    {
      id:"daisy-flash-chances-crit",
      libelle:"Chances crit. +5 % par cumul, 4 cumuls",
      stat:"C_Critical_Rate",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"daisy_wand_skill_rmb_ready",
        phrase:"augmente les chances crit. de tous les héros alliés de 5% pendant 40s tant que la posture est maintenue"
      }
    },
    {
      id:"daisy-charge-degats-crit",
      libelle:"Charge électrique : dégâts crit. +2 % par cumul, 20 cumuls",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:4000,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"daisy_book_skill_e",
        phrase:"augmente les dégâts crit. des héros d'attribut Foudre de 2% et leurs chances crit. de 1.5%"
      }
    },
    {
      id:"daisy-charge-chances-crit",
      libelle:"Charge électrique : chances crit. +1,5 % par cumul, 20 cumuls",
      stat:"C_Critical_Rate",
      operation:"add",
      valeur:3000,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"daisy_book_skill_e",
        phrase:"augmente les dégâts crit. des héros d'attribut Foudre de 2% et leurs chances crit. de 1.5%"
      }
    }
  ],
  "derieri": [
    {
      id:"derieri-charge-degats-crit",
      libelle:"Dégâts crit. des alliés Ténèbres +40 %",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:4000,
      unite:"ten-thousandths",
      element:"dark",
      provenance:{
        gameId:"derieri_axe_passive",
        phrase:"augmente les dégâts crit. des héros alliés d'attribut Ténèbres de 40% pendant 30s"
      }
    },
    {
      id:"derieri-taillade-attaque-feu",
      libelle:"Attaque de Feu +30 % de l'ATK de Derieri (plafond 3000)",
      stat:"Fire_Add",
      operation:"add",
      valeur:3000,
      unite:"flat",
      element:"fire",
      provenance:{
        gameId:"derieri_sword2h_skill_e",
        phrase:"Augmente l'attaque de Feu de tous les héros alliés à hauteur de 30% de l'attaque du héros (Max : 3000) pendant 40s"
      }
    }
  ],
  "dreydrin": [
    {
      id:"dreydrin-sens-du-combat-defense",
      libelle:"Défense de l'ennemi −10 % (ennemi entravé)",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      valeur:1000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"dreydrin_axe_passive",
        phrase:"réduit sa défense de 10% pendant 30s"
      }
    },
    {
      id:"dreydrin-combat-divin-attaque",
      libelle:"Attaque des alliés +10 %",
      stat:"I_AtkAdd_Rate",
      operation:"multiply",
      valeur:1000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"dreydrin_rapier_skill_q",
        phrase:"Augmente l'attaque des alliés à portée de 10% pendant 15s."
      }
    }
  ],
  "elizabeth": [
    {
      id:"elizabeth-eclaboussures-defense",
      libelle:"Éclaboussures : défense de l'ennemi −20 %",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"elizabeth_book_skill_q",
        phrase:"réduit la défense de 20%"
      }
    },
    {
      id:"elizabeth-vague-attaque-vent",
      libelle:"Attaque de Vent +30 % de l'ATK d'Elisabeth (plafond 3000)",
      stat:"Wind_Add",
      operation:"add",
      valeur:3000,
      unite:"flat",
      element:"wind",
      provenance:{
        gameId:"elizabeth_staff_skill_e",
        phrase:"Augmente l'attaque de Vent de tous les héros alliés à hauteur de 30% de l'attaque du héros pendant 40s. (Max : 3000)"
      }
    },
    {
      id:"elizabeth-priere-chances-crit",
      libelle:"Chances crit. des alliés Terre +20 %",
      stat:"C_Critical_Rate",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:"earth",
      provenance:{
        gameId:"elizabeth_wand_passive",
        phrase:"augmente les chances crit. de tous les héros alliés d'attribut Terre de 20%"
      }
    },
    {
      id:"elizabeth-hawk-degats-terre",
      libelle:"Dégâts de Terre +50 % des dégâts crit. d'Elisabeth (plafond 50 %)",
      stat:"Earth_Element_Rate",
      operation:"add",
      valeur:5000,
      unite:"ten-thousandths",
      element:"earth",
      provenance:{
        gameId:"elizabeth_wand_skill_e",
        phrase:"augmente les dégâts de Terre des alliés de 50% des dégâts crit. du héros pendant 40s"
      }
    }
  ],
  "gowther": [
    {
      id:"gowther-dissonance-defense",
      libelle:"Défense de l'ennemi −20 %",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"gowther_book_skill_q",
        phrase:"réduit sa défense de 20% pendant 30s"
      }
    },
    {
      id:"gowther-charge-degats-foudre",
      libelle:"Charge : dégâts de Foudre +25 %",
      stat:"Thunder_Element_Rate",
      operation:"add",
      valeur:2500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gowther_staff_skill_e",
        phrase:"les dégâts de Foudre de 25%"
      }
    },
    {
      id:"gowther-synchronisation-attaque",
      libelle:"Synchronisation : attaque +1 % par cumul, 25 cumuls",
      stat:"I_AtkAdd_Rate",
      operation:"multiply",
      valeur:2500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"gowther_book_passive",
        phrase:"augmente l'attaque de 1%"
      }
    },
    {
      id:"gowther-confusion-attaque-foudre",
      libelle:"Attaque de Foudre +10 % de l'ATK de Gowther (plafond 3000)",
      stat:"Thunder_Add",
      operation:"add",
      valeur:3000,
      unite:"flat",
      element:"thunder",
      provenance:{
        gameId:"gowther_wand_passive",
        phrase:"Augmente l'attaque de Foudre à hauteur de 10% de l'attaque du héros pendant 30s lorsqu'un héros allié active un Déluge de Foudre. (Max : 3000)"
      }
    }
  ],
  "guila": [
    {
      id:"guila-protection-degats-feu",
      libelle:"Dégâts de Feu des alliés +30 %",
      stat:"Fire_Element_Rate",
      operation:"add",
      valeur:3000,
      unite:"ten-thousandths",
      element:"fire",
      provenance:{
        gameId:"guila_shield_passive",
        phrase:"Augmente les dégâts de Feu de tous les héros alliés de 30% lorsqu'une barrière appliquée par le héros est active sur lui."
      }
    }
  ],
  "howzer": [
    {
      id:"howzer-choc-degats-crit",
      libelle:"Dégâts crit. des alliés Vent +30 %",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:3000,
      unite:"ten-thousandths",
      element:"wind",
      provenance:{
        gameId:"howzer_gauntlets_skill_q",
        phrase:"Augmente les dégâts crit. de tous les héros alliés d'attribut Vent de 30%"
      }
    },
    {
      id:"howzer-rugissement-degats-vent",
      libelle:"Dégâts de Vent +20 % sur cible qui saigne",
      stat:"Wind_Element_Rate",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:"wind",
      provenance:{
        gameId:"howzer_gauntlets_passive",
        phrase:"augmente ses dégâts de Vent de 20%"
      }
    }
  ],
  "manny": [
    {
      id:"manny-gelure-defense-crit",
      libelle:"Gelure : défense crit. de l'ennemi −20 % (10 cumuls)",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"manny_sworddual_jumpatk",
        phrase:"réduit la défense crit. de 2%"
      }
    },
    {
      id:"manny-pretresse-degats-crit",
      libelle:"Prêtresse draco : dégâts crit. +30 %",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:3000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"manny_staff_skill_rmb",
        phrase:"augmente les dégâts crit. de 30%"
      }
    },
    {
      id:"manny-champ-attaque-froid",
      libelle:"Attaque de Froid des alliés +15 %",
      stat:"Ice_Add",
      operation:"multiply",
      valeur:1500,
      unite:"ten-thousandths",
      element:"ice",
      provenance:{
        gameId:"manny_sworddual_skill_q",
        phrase:"augmente l'attaque de Froid des alliés de 15% pendant 40s"
      }
    },
    {
      id:"manny-givre-degats-froid",
      libelle:"Dégâts de Froid +35 % à cumuls de Gelure au maximum",
      stat:"Ice_Element_Rate",
      operation:"add",
      valeur:3500,
      unite:"ten-thousandths",
      element:"ice",
      provenance:{
        gameId:"manny_sworddual_passive",
        phrase:"augmente ses dégâts de Froid de 35%"
      }
    }
  ]
};
