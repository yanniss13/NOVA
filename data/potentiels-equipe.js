// Ce que les POTENTIELS d'un soutien apportent a l'EQUIPE, ou retirent a
// l'ennemi.
//
// ECRIT ET MAINTENU A LA MAIN, comme buffs-supports.js et passifs-graves.js :
// aucun script ne le regenere, et aucun ne doit le citer.
//
// POURQUOI CE FICHIER EXISTE. Le catalogue publie deja les potentiels sous
// forme chiffree - potentialsByWeapon dans stats-build.js - mais il n'y met
// que les statistiques du PORTEUR, celles qui entrent dans son propre build.
// Tout ce qu'un potentiel donne aux ALLIES ou inflige a l'ENNEMI ne vit que
// dans le TEXTE de data/potentiels.js. Un soutien pouvait donc etre au palier
// 10 sans que rien de son palier 10 n'atteigne le heros calcule.
//
// Cle : personnage -> ARME -> PALIER -> lignes. Les trois comptent.
//   L'arme, parce qu'un personnage a trois branches de potentiels distinctes
//   et n'en tient qu'une a la fois.
//   Le palier, parce qu'un coequipier au palier 5 ne doit pas rendre le
//   palier 7. Les paliers sont CUMULATIFS : au palier N, tout ce qui est
//   ecrit pour 1..N est actif.
//
// LA REGLE DE TRANSCRIPTION, la meme que pour les tenues gravees :
//   `provenance.phrase` est choisie pour que le NOMBRE QUI LA SUIT
//   IMMEDIATEMENT soit la valeur stockee, et elle doit apparaitre exactement
//   UNE fois dans le texte du palier. Un test relit data/potentiels.js et
//   compare. Ces paliers portent deux ou trois effets chacun ; sans cette
//   regle, attribuer a un effet la valeur d'un autre serait une erreur MUETTE.
//
//   Les lignes indexees sur l'ATK du lanceur citent DEUX phrases - le taux et
//   le plafond - et le test verifie les deux nombres. Le plafond ne se deduit
//   pas du taux.
//
//   Contrairement a stats-build.js, data/potentiels.js n'emploie PAS d'espace
//   insecable : les phrases citees ici s'ecrivent avec des espaces ordinaires,
//   et un test le confirmerait aussitot si la source changeait d'avis.
//
// cible   : "soi"     le potentiel ne profite qu'a son porteur ;
//           "allies"  il profite a l'equipe entiere, porteur compris. Les
//                     malus infliges a l'ENNEMI portent "allies" : quiconque
//                     frappe cette cible en beneficie.
// element : null, ou l'attribut vise quand le buff ne concerne que lui.
//
// LES HUIT SOUTIENS SEULEMENT, comme buffs-supports.js. Les dix-sept autres
// personnages ont eux aussi des potentiels tournes vers l'equipe ; ils
// viendront quand la confrerie les jouera.
//
// Une valeur a CUMULS - « 5 % par cumul, (Max : 20 fois) » - porte `parCumul`
// et `cumuls`, chacun designe par sa propre phrase, et le test controle que
// `valeur` vaut leur produit. Un maximum qui se CALCULE ne se pose pas de
// tete : +100 % de degats critiques merite d'etre relu.
//
// CE QUI N'Y FIGURE PAS, ET POURQUOI. Sur les vingt-sept lignes des huit
// soutiens qui visent l'equipe ou la cible, SEIZE sont transcrites. Les onze
// autres sont nommees plutot qu'approximees :
//
//   Soins, PV, barrieres, jauges de magie, vitesse de deplacement, reduction
//     de degats subis (dreydrin Rapiere T7 et Bouclier T7, elizabeth Livre T9,
//     Baguette T7, et la premiere moitie de Livre T6)   aucun effet offensif.
//   elizabeth Livre T10   « augmente l'attaque de tous les heros allies a
//     hauteur de 10% de la DEFENSE du heros » : indexe sur la defense du
//     lanceur, quand la vue ne transmet que son ATK. Une ligne de plumberie a
//     ajouter le jour ou une deuxieme s'y indexera.
//   derieri Epee 2 mains T10, elizabeth Baton T6   des degats critiques
//     restreints a UNE categorie de competence. Le moteur porte les deux
//     notions separement, jamais croisees.
//   manny Epees doubles T7   « reduit la resistance au Froid de l'ennemi » :
//     une resistance elementaire, dont la valeur de base est elle-meme en
//     suspens (voir AKUMU_ELEMENTAIRE dans js/metier/degats-calcul.js).
//   daisy Baguette T10   « reduit la resistance au percement de l'ennemi » :
//     ce seau vaut zero chez nous, et l'outil de reference mesure le sien
//     inerte. Reduire zero ne changerait rien.
//   manny Epees doubles T9   « augmente le boost de degats de Froid octroye
//     aux allies de 15% » : un bonus SUR un autre bonus, que le moteur ne sait
//     pas composer.
//   elizabeth Livre T5   « augmente les degats subis par les ennemis de 10%
//     toutes les 1s pendant 20s » : un cumul sans maximum publie. On ne sait
//     pas ou il s'arrete.
//   derieri Hache T5   la duree d'un Deluge, sans effet sur les statistiques.
//
// Deux lignes ont deja quitte cette liste : le T5 Baton de gowther attendait
// un seau de reduction de RESISTANCE critique, qui existe desormais dans
// js/metier/degats-calcul.js, et le second effet du T10 Baguette d'elizabeth
// attendait que le produit « pas x cumuls » puisse etre VERIFIE plutot que
// pose. C'est ce que cette liste est censee produire : des retours, pas des
// oublis.
window.SEVEN_DS_POTENTIELS_EQUIPE = {
  "daisy": {
    "Livre": {
      "6": [
        {
          id:"daisy-livre-t6-defense-crit",
          libelle:"Attaque normale ou ultime réussie : défense crit. de l'ennemi −15 %",
          cible:"allies",
          cibleEnnemi:true,
          effet:"defenseCritique",
          operation:"add",
          valeur:1500,
          unite:"ten-thousandths",
          element:null,
          provenance:{ phrase:"réduit la défense crit. de l'ennemi de " }
        }
      ]
    }
  },
  "derieri": {
    "Hache": {
      "7": [
        {
          /* LA VULNERABILITE. Elle atterrit dans le meme seau additif que le
             bonus de categorie du heros, par analogie avec la faiblesse de
             l'ennemi - mesuree additive chez l'outil de reference. Ce n'est
             pas une mesure : le detail du raisonnement est dans
             js/metier/calculateur-entrees.js, la ou le choix s'applique. */
          id:"derieri-hache-t7-vulnerabilite-competence-normale",
          libelle:"Dégâts supplémentaires : compétence normale subie par l'ennemi +50 %",
          cible:"allies",
          cibleEnnemi:true,
          effet:"vulnerabiliteCategorie",
          categorie:"NORMAL_SKILL",
          operation:"add",
          valeur:5000,
          unite:"ten-thousandths",
          element:null,
          provenance:{ phrase:"subis par l'ennemi de " }
        }
      ],
      "10": [
        {
          id:"derieri-hache-t10-attaque-tenebres",
          libelle:"Compétence normale : attaque des Ténèbres des alliés, 30 % de l'ATK de Derieri (plafond 4000)",
          cible:"allies",
          stat:"Dark_Add",
          operation:"add",
          valeur:4000,
          unite:"flat",
          indexeSurAtk:{ taux:3000, plafond:4000 },
          element:"dark",
          provenance:{
            phrase:"à hauteur de ",
            phrasePlafond:"(Max : "
          }
        }
      ]
    },
    "Epee 2 mains": {
      "7": [
        {
          /* La source vise « l'attaque ultime ET l'attaque combinee ». Seule
             l'ultime est retenue : « attaque combinee » n'est pas une des cinq
             categories du catalogue de competences, donc rien ici ne peut la
             porter. Une moitie chiffree vaut mieux qu'un total invente. */
          id:"derieri-epee2m-t7-vulnerabilite-ultime",
          libelle:"Dégâts supplémentaires : ultime subi par la cible +50 %",
          cible:"allies",
          cibleEnnemi:true,
          effet:"vulnerabiliteCategorie",
          categorie:"ULTIMATE",
          operation:"add",
          valeur:5000,
          unite:"ten-thousandths",
          element:null,
          /* Ancrage refait le 16/08/2026 : « subis par la cible » est devenu
             « subis par les ennemis » dans la reformulation francaise du 15.
             Les 50 % n'ont pas bouge. */
          provenance:{ phrase:"subis par les ennemis de " }
        }
      ],
      "9": [
        {
          id:"derieri-epee2m-t9-percement",
          libelle:"Compétence normale : percement de défense des alliés Feu +15 %",
          cible:"allies",
          stat:"D_Protect_Cur_Rate",
          operation:"add",
          valeur:1500,
          unite:"ten-thousandths",
          element:"fire",
          provenance:{
            phrase:"le percement de défense de tous les héros alliés d'attribut Feu de "
          }
        }
      ]
    }
  },
  "elizabeth": {
    "Livre": {
      "6": [
        {
          id:"elizabeth-livre-t6-chances-crit",
          libelle:"Chances crit. des alliés +10 %",
          cible:"allies",
          stat:"C_Critical_Rate",
          operation:"add",
          valeur:1000,
          unite:"ten-thousandths",
          element:null,
          provenance:{ phrase:"leurs chances crit. de " }
        }
      ],
      "7": [
        {
          id:"elizabeth-livre-t7-attaques-elementaires",
          libelle:"Ultime : toutes les attaques élémentaires des alliés +30 %",
          cible:"allies",
          stat:"AllElement_Add",
          operation:"multiply",
          valeur:3000,
          unite:"ten-thousandths",
          element:null,
          provenance:{
            phrase:"toutes les attaques élémentaires des alliés à portée de "
          }
        }
      ]
    },
    "Baton": {
      /* Le boost de degats crit. de l'attaque normale que l'attaque speciale
         donne aux allies monte par paliers. La table du jeu le confirme buff
         par buff : 302172014 vaut +50 %, 302172035 (palier 6) +70 %, et
         302172045 (palier 10) +100 %. La ligne de base vit dans
         buffs-supports.js ; ici on n'ecrit que les SUPPLEMENTS, puisque les
         paliers se cumulent. */
      "6": [
        {
          id:"elizabeth-baton-t6-degats-crit-normale",
          libelle:"Attaque spéciale : dégâts crit. d'attaque normale des alliés +20 % de plus",
          cible:"allies",
          stat:"C_Critical_Dam_Rate",
          operation:"add",
          valeur:2000,
          unite:"ten-thousandths",
          element:null,
          provenance:{
            phrase:"octroyé par l'attaque spéciale de "
          }
        }
      ],
      "9": [
        {
          id:"elizabeth-baton-t9-percement",
          libelle:"Compétence normale : percement de défense des alliés Vent +15 %",
          cible:"allies",
          stat:"D_Protect_Cur_Rate",
          operation:"add",
          valeur:1500,
          unite:"ten-thousandths",
          element:"wind",
          provenance:{
            phrase:"le percement de défense de tous les héros alliés d'attribut Vent de "
          }
        }
      ],
      "10": [
        {
          id:"elizabeth-baton-t10-degats-crit-normale",
          libelle:"Attaque spéciale : dégâts crit. d'attaque normale des alliés +30 % de plus",
          cible:"allies",
          stat:"C_Critical_Dam_Rate",
          operation:"add",
          valeur:3000,
          unite:"ten-thousandths",
          element:null,
          provenance:{
            phrase:"octroyée par l'attaque spéciale de "
          }
        }
        /* CE PALIER PORTE UN SECOND EFFET, VOLONTAIREMENT ABSENT.
           « Accroit l'augmentation maximale de l'attaque de Vent octroyee par
           la competence normale de 3000 » releve le PLAFOND du buff
           `elizabeth-vague-attaque-vent`, de 3000 a 6000. Ce buff vaut
           min(30 % de l'ATK, plafond) : relever un plafond ne s'ecrit pas
           comme une ligne qui s'ajoute. Une seconde ligne indexee donnerait
           le bon total au-dela de 20 000 d'ATK et le DOUBLE en dessous.
           Il faut que `potentiels-equipe.js` sache modifier le plafond d'un
           buff existant ; tant que ce n'est pas le cas, rien plutot que faux. */
      ]
    },
    "Baguette": {
      "10": [
        {
          /* La phrase citee s'arrete AVANT le nombre sans « de » : la source
             ecrit « de tous les heros allies 30% », sans preposition. On cite
             ce qu'elle ecrit, pas ce qu'elle aurait du ecrire. */
          id:"elizabeth-baguette-t10-degats-terre",
          libelle:"Déluge de Terre : dégâts de Terre des alliés +30 %",
          cible:"allies",
          stat:"Earth_Element_Rate",
          operation:"add",
          valeur:3000,
          unite:"ten-thousandths",
          element:"earth",
          provenance:{
            phrase:"augmente les dégâts de Terre de tous les héros alliés "
          }
        },
        {
          /* Le maximum ne s'ecrit nulle part : il se CALCULE, 5 x 20. La ligne
             porte donc les DEUX facteurs, chacun designe par sa phrase, et le
             test compare leur produit a `valeur`. Sans cela, +100 % de degats
             critiques serait un nombre pose de tete. */
          id:"elizabeth-baguette-t10-degats-crit",
          libelle:"Coups sur cible sous Déluge : dégâts crit. des alliés Terre +5 % par cumul, 20 cumuls",
          cible:"allies",
          stat:"C_Critical_Dam_Rate",
          operation:"add",
          parCumul:500,
          cumuls:20,
          valeur:10000,
          unite:"ten-thousandths",
          element:"earth",
          provenance:{
            phrase:"augmente les dégâts crit. des héros d'attribut Terre de ",
            phraseCumuls:"(Max : "
          }
        }
      ]
    }
  },
  "gowther": {
    "Livre": {
      "10": [
        {
          id:"gowther-livre-t10-defense-crit",
          libelle:"Ultime : défense crit. de l'ennemi −40 %",
          cible:"allies",
          cibleEnnemi:true,
          effet:"defenseCritique",
          operation:"add",
          valeur:4000,
          unite:"ten-thousandths",
          element:null,
          provenance:{ phrase:"réduit la défense crit. de l'ennemi de " }
        }
      ]
    },
    "Baton": {
      "5": [
        {
          id:"gowther-baton-t5-resistance-crit",
          libelle:"Attaque spéciale : résistance crit. de l'ennemi −20 %",
          cible:"allies",
          cibleEnnemi:true,
          effet:"resistanceCritique",
          operation:"add",
          valeur:2000,
          unite:"ten-thousandths",
          element:null,
          provenance:{ phrase:"réduit la résistance crit. de l'ennemi de " }
        }
      ],
      "6": [
        {
          id:"gowther-baton-t6-attaque-foudre",
          libelle:"Compétence normale : attaque de Foudre des alliés +35 %",
          cible:"allies",
          stat:"Thunder_Add",
          operation:"multiply",
          valeur:3500,
          unite:"ten-thousandths",
          element:"thunder",
          provenance:{
            phrase:"augmente l'attaque de Foudre de tous les héros alliés de "
          }
        }
      ],
      "10": [
        {
          /* « augmente les degats crit. de 70% » : ni possessif, ni « des
             allies ». Par la regle de lecture etablie dans
             data/passifs-graves.js, le beneficiaire est le porteur. */
          id:"gowther-baton-t10-degats-crit",
          libelle:"Alliés Foudre tous sous Charge : dégâts crit. +70 %",
          cible:"soi",
          stat:"C_Critical_Dam_Rate",
          operation:"add",
          valeur:7000,
          unite:"ten-thousandths",
          element:"thunder",
          provenance:{ phrase:"augmente les dégâts crit. de " }
        }
      ]
    }
  },
  "guila": {
    "Bouclier": {
      "5": [
        {
          id:"guila-bouclier-t5-degats-feu",
          libelle:"Ultime : dégâts de Feu des alliés +20 %",
          cible:"allies",
          stat:"Fire_Element_Rate",
          operation:"add",
          valeur:2000,
          unite:"ten-thousandths",
          element:"fire",
          provenance:{ phrase:"augmente les dégâts de Feu des alliés à portée de " }
        }
      ]
    }
  },
  "manny": {
    "Epee 1 main": {
      "5": [
        {
          id:"manny-epee1main-t5-degats-froid",
          libelle:"Ultime : dégâts de Froid des alliés +15 %",
          cible:"allies",
          stat:"Ice_Element_Rate",
          operation:"add",
          valeur:1500,
          unite:"ten-thousandths",
          element:"ice",
          provenance:{ phrase:"Augmente les dégâts de Froid des alliés à portée de " }
        }
      ]
    }
  }
};
