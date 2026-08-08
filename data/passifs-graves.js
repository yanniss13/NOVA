// Passifs de tenue gravee qui changent les degats.
//
// ECRIT ET MAINTENU A LA MAIN, comme data/buffs-supports.js : aucun script ne
// le regenere, et aucun ne doit le citer.
//
// Cle = le fichier de la tenue, celui d'engravedByFile dans stats-build.js.
//
// LA REGLE DE TRANSCRIPTION, et elle n'est pas negociable :
//   `provenance.phrase` est choisie pour que le NOMBRE QUI LA SUIT
//   IMMEDIATEMENT soit la valeur stockee, et elle doit apparaitre exactement
//   UNE fois dans le texte de chaque niveau.
//
//   Ces passifs portent deux ou trois effets chacun, donc autant de nombres.
//   Sans cette regle, rien n'empecherait d'attribuer a un effet la valeur d'un
//   autre, et l'erreur serait MUETTE : aucun test ne casse, seuls les degats
//   sont faux. Un test relit les trois niveaux dans stats-build.js et compare.
//
//   Pour un cumul - « +5 % par coup (Max\u00a0: 30 %) » - la phrase pointe
//   « (Max\u00a0: » et la valeur vaut 30. Le transcripteur est force de designer le
//   nombre exact au lieu de le deduire. C'est la convention « max atteignable »
//   deja retenue pour buffs-supports.js.
//
//   PIEGE : la source ecrit « (Max\u00a0: » avec une ESPACE INSECABLE avant les
//   deux-points, comme le veut la typographie francaise. Un « (Max\u00a0: » tape au
//   clavier ne correspond a rien. Les phrases citees ici l'echappent donc en
//   `\u00a0` plutot que de dependre de ce qu'un editeur aura insere.
//
// niveaux : les trois valeurs, du niveau 1 au niveau 3, en dix-milliemes.
// cible   : "soi"     le passif ne profite qu'a celui qui porte la tenue ;
//           "allies"  il profite a l'equipe ENTIERE, porteur compris. Les
//                     malus infliges a l'ENNEMI portent "allies" : quiconque
//                     frappe cette cible en beneficie.
// element : null, ou l'attribut vise quand le buff ne concerne que lui.
//
// QUI RECOIT QUOI, quand le texte ne le dit pas d'un mot. La source distingue
// deux tournures, et la difference porte tout le sens :
//
//     « Lorsqu'un heros allie attaque …, augmente SES degats de Vent »
//        le possessif renvoie a l'allie qui frappe   ->  cible "allies"
//     « Augmente LES degats de competence normale … lorsqu'un heros allie … »
//        aucun possessif, l'allie n'est que la CONDITION  ->  cible "soi"
//
// Cette lecture vaut pour tout le fichier, et elle se verifie sur les cas ou
// la source tranche elle-meme : partout ou l'equipe est visee, elle ecrit
// « de tous les heros allies ». Une tournure sans possessif ET sans « allies »
// ne buffe que son porteur.
//
// CE QUI N'Y FIGURE PAS, ET POURQUOI. Sur les 68 tenues, 28 n'ont aucun effet
// offensif - barrieres, soins, recharges, jauges, deplacement. Restaient 26
// passifs offensifs pour leur seul porteur et 14 qui buffent l'equipe. TRENTE
// tenues sont transcrites ici. Les douze autres ne le sont pas, et il vaut
// mieux le dire que les approximer :
//
//   Chevalier sacre prometteur (gil-thunder)   « degats infliges aux ennemis
//     affectes par Electrocution » : un bonus GLOBAL, dont aucun code de stat
//     du depot ne porte le seau. En inventer un desactiverait le test qui
//     refuse les codes inventes.
//   Chevalier sacre a la visiere en etoile (jericho) et Piste de la flamme
//     cramoisie (guila)   « resistance au Deluge » : une resistance de jauge,
//     distincte de la resistance elementaire que la cible porte.
//   Fille de la foret et de la terre (tioreh)   « degats de competence normale
//     SUBIS PAR L'ENNEMI » : une vulnerabilite de la cible. La verser dans le
//     bonus du heros supposerait que le jeu confond les deux - meme raison qui
//     tient les reductions de defense elementaire hors de buffs-supports.js.
//   Le Serpent de l'Envie (diane) et Dignite de la sainte (elaine)   leur
//     plafond s'ecrit « (Max\u00a0: 56%, 24%) », et le second nombre ne suit aucune
//     phrase STABLE d'un niveau a l'autre, puisque le premier change avec le
//     niveau. La garde refuse une valeur qu'on ne peut pas designer sans
//     ambiguite ; c'est exactement son role.
//   Retour du Chevalier Sacre (hendrickson), Resistance et revolution
//     (derieri), Tenue modeste (dreyfus)   des degats critiques ou
//     elementaires restreints a UNE categorie de competence. Le moteur porte
//     les deux notions separement, jamais croisees.
//   Tenue de fete legere (klotho)   des degats de proc, sans effet sur les
//     statistiques.
//   Protection de la fee (tioreh)   seule la defense des allies monte : rien
//     d'offensif a chiffrer.
//
// Et, DANS des tenues par ailleurs transcrites, trois effets isoles restent
// dehors pour la meme raison - un seau qui manque :
//
//   Chercheuse de savoir (merlin)   « les degats crit. d'attaque ultime » :
//     du critique croise avec une categorie, que le moteur ne croise pas.
//   Le Belier de la Luxure (gowther)   « tous les degats elementaires » :
//     aucun code du depot ne le porte. `AllElement_Add` est une ATTAQUE plate
//     et `Default_Element_Rate` vise le physique ; ni l'un ni l'autre ne dit
//     « degats de tous les elements ».
//   Vedette de la taverne (elizabeth)   « reduit la resistance a tous les
//     elements de la cible » : la cible n'a pas de seau de reduction de
//     resistance, et la VALEUR DE BASE de cette resistance est elle-meme en
//     suspens (voir l'encadre AKUMU_ELEMENTAIRE de js/metier/degats-calcul.js).
//     Batir une reduction sur un socle conteste ferait deux erreurs au lieu
//     d'une.
//
// Ces douze reviendront le jour ou le moteur portera le seau qui leur manque.
window.SEVEN_DS_PASSIFS_GRAVES = {
  "7ds-armures-ssr/Armure liee/Aventure du prince.webp":[
    {
      id:"tristan-aventure-du-prince-ultime",
      libelle:"Compétence normale sous boost : ultime +180 %",
      cible:"soi",
      stat:"Ultimateskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[10000, 14000, 18000],
      provenance:{ phrase:"augmente les dégâts d'attaque ultime de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Aventure en toute sécurité.webp":[
    {
      /* Un malus sur la CIBLE : quiconque la frappe en profite, donc
         « allies ». */
      id:"howzer-aventure-securite-defense-crit",
      libelle:"Attaque spéciale réussie : défense crit. de l'ennemi −60 %",
      cible:"allies",
      cibleEnnemi:true,
      effet:"defenseCritique",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[4000, 5000, 6000],
      provenance:{ phrase:"réduit la défense crit. de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp":[
    {
      /* Un POURCENTAGE d'attaque elementaire, donc `multiply` sur le seau
         plat : c'est la forme deja retenue pour manny-champ-attaque-froid
         dans buffs-supports.js, et non une nouvelle convention. */
      id:"merlin-chercheuse-attaque-feu",
      libelle:"Déluge activé : attaque de Feu des alliés +20 %",
      cible:"allies",
      stat:"Fire_Add",
      operation:"multiply",
      unite:"ten-thousandths",
      element:"fire",
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"augmente l'attaque de Feu de tous les héros alliés de " }
    },
    {
      id:"merlin-chercheuse-ultime",
      libelle:"Après l'ultime : ultime des alliés Feu +30 %",
      cible:"allies",
      stat:"Ultimateskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"fire",
      niveaux:[1800, 2400, 3000],
      provenance:{
        phrase:"augmente les dégâts d'attaque ultime de tous les héros alliés d'attribut Feu de "
      }
    }
  ],
  "7ds-armures-ssr/Armure liee/Chevalier honorable.webp":[
    {
      id:"dreyfus-chevalier-honorable-ultime",
      libelle:"Boosts de dégâts crit. cumulés : ultime +75 %",
      cible:"soi",
      stat:"Ultimateskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[4500, 6000, 7500],
      provenance:{ phrase:"(Max\u00a0: " }
    },
    {
      id:"dreyfus-chevalier-honorable-sacre",
      libelle:"Cible sous barrière : dégâts du Sacré +40 %",
      cible:"soi",
      stat:"Holy_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"holy",
      niveaux:[2400, 3200, 4000],
      provenance:{ phrase:"Augmente les dégâts du Sacré de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Chevalier impérial.webp":[
    {
      /* « Augmente LES degats … lorsqu'un heros allie … » : l'allie est la
         CONDITION, pas le beneficiaire. Voir l'en-tete. */
      id:"drake-chevalier-imperial-competence-normale",
      libelle:"Allié Foudre sous Pulsion : compétence normale +30 %",
      cible:"soi",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1800, 2400, 3000],
      provenance:{ phrase:"Augmente les dégâts de compétence normale de " }
    },
    {
      id:"drake-chevalier-imperial-degats-foudre",
      libelle:"Coups de Pulsion cumulés : dégâts de Foudre des alliés +20 %",
      cible:"allies",
      stat:"Thunder_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"thunder",
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Chevalier sacré de la tempête.webp":[
    {
      id:"howzer-chevalier-tempete-vent",
      libelle:"Cible qui saigne, cumulé : dégâts de Vent +45 %",
      cible:"soi",
      stat:"Wind_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"wind",
      niveaux:[3000, 3750, 4500],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Chevalier sacré des explosions.webp":[
    {
      /* Deux « (Max\u00a0: » dans ce texte - la duree des bonus, puis les degats.
         La phrase est allongee pour ne designer que le second. */
      id:"guila-chevalier-explosions-competence-normale",
      libelle:"Ultime lancée, cumulé : compétence normale +150 %",
      cible:"soi",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[10000, 12500, 15000],
      provenance:{ phrase:"des bonus pendant 30\u00a0s. (Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Courtoisie minimale.webp":[
    {
      id:"derieri-courtoisie-ultime",
      libelle:"Coups sous boost de PV max : ultime des alliés Feu +30 %",
      cible:"allies",
      stat:"Ultimateskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"fire",
      niveaux:[1800, 2400, 3000],
      provenance:{ phrase:"(Max\u00a0: " }
    },
    {
      id:"derieri-courtoisie-degats-crit",
      libelle:"Défense de Feu réduite : dégâts crit. des alliés Feu +40 %",
      cible:"allies",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"fire",
      niveaux:[2400, 3200, 4000],
      provenance:{ phrase:"avec une défense de Feu réduite de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Défense simple.webp":[
    {
      id:"meliodas-defense-simple-competence-normale",
      libelle:"Libération infernale reçue : compétence normale +80 %",
      cible:"soi",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[5000, 6500, 8000],
      provenance:{ phrase:"augmente les dégâts de compétence normale de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Défense solide.webp":[
    {
      id:"dreydrin-defense-solide-releve",
      libelle:"3 points de magie ou moins : compétence de relève +40 %",
      cible:"soi",
      stat:"Normalskillchangetag_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2000, 3000, 4000],
      provenance:{ phrase:"Augmente les dégâts de la compétence de relève de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Fille enjouée.webp":[
    {
      id:"diane-fille-enjouee-competence-normale",
      libelle:"Déluge activé : compétence normale +35 %",
      cible:"soi",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2500, 3000, 3500],
      provenance:{ phrase:"Augmente les dégâts de compétence normale de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Formalité de l'érudite en chef.webp":[
    {
      id:"klotho-formalite-chances-crit",
      libelle:"Pierre ou Barrière runique : chances crit. des alliés Froid +20 %",
      cible:"allies",
      stat:"C_Critical_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"ice",
      niveaux:[1000, 1500, 2000],
      provenance:{ phrase:"augmente les chances crit. de " }
    },
    {
      id:"klotho-formalite-degats-crit",
      libelle:"Pierre ou Barrière runique : dégâts crit. des alliés Froid +50 %",
      cible:"allies",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"ice",
      niveaux:[3000, 4000, 5000],
      provenance:{ phrase:"les dégâts crit. de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Gloire du passé.webp":[
    {
      id:"drake-gloire-du-passe-foudre",
      libelle:"Attaque spéciale sous boost, cumulé : dégâts de Foudre +30 %",
      cible:"soi",
      stat:"Thunder_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"thunder",
      niveaux:[1800, 2400, 3000],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Héros de Liones.webp":[
    {
      id:"elizabeth-heros-de-liones-degats-crit",
      libelle:"Ennemi sous Altération : dégâts crit. de Vent des alliés +42 %",
      cible:"allies",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"wind",
      niveaux:[2600, 3400, 4200],
      provenance:{ phrase:"infligés aux ennemis affectés par Altération de " }
    },
    {
      id:"elizabeth-heros-de-liones-attaque",
      libelle:"Après une compétence de relève : attaque +20 %",
      cible:"soi",
      stat:"I_AtkAdd_Rate",
      operation:"multiply",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"Augmente l'attaque du héros de " }
    },
    {
      /* Le beneficiaire est le heros qui ENTRE en releve, pas Elisabeth : la
         source dit « si le heros change est d'attribut Vent ». D'ou « allies »,
         et l'element Vent. */
      id:"elizabeth-heros-de-liones-chances-crit",
      libelle:"Relève vers un héros Vent : chances crit. +20 %",
      cible:"allies",
      stat:"C_Critical_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"wind",
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"augmente les chances crit. de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Le Bélier de la Luxure.webp":[
    {
      id:"gowther-belier-degats-crit",
      libelle:"Après l'ultime : dégâts crit. des alliés +20 %",
      cible:"allies",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"augmente les dégâts crit. de tous les héros alliés de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Le Grizzly de la Paresse.webp":[
    {
      id:"king-grizzly-chances-crit",
      libelle:"Chaque coup, cumulé : chances crit. +20 %",
      cible:"soi",
      stat:"C_Critical_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"(Max\u00a0: " }
    },
    {
      id:"king-grizzly-sacre",
      libelle:"Floraison totale reçue : dégâts du Sacré +80 %",
      cible:"soi",
      stat:"Holy_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"holy",
      niveaux:[6000, 7000, 8000],
      provenance:{ phrase:"augmente les dégâts du Sacré de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp":[
    {
      id:"merlin-sanglier-competence-normale",
      libelle:"Attaque combinée réussie : compétence normale +40 %",
      cible:"soi",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2400, 3200, 4000],
      provenance:{ phrase:"augmente les dégâts de compétence normale de " }
    },
    {
      id:"merlin-sanglier-degats-crit",
      libelle:"Compétences normales cumulées : dégâts crit. +24 %",
      cible:"soi",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1600, 2000, 2400],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Lumière de guidance.webp":[
    {
      /* Le lot precedent l'ecartait au motif que `Wind_Add` est un seau PLAT
         quand la source donne un pourcentage. C'etait une erreur de ma part :
         buffs-supports.js modelise deja le meme cas par `multiply`
         (manny-champ-attaque-froid). La tenue rejoint donc la table. */
      id:"elaine-lumiere-attaque-vent",
      libelle:"Boosts de dégâts crit. cumulés : attaque de Vent +72 %",
      cible:"soi",
      stat:"Wind_Add",
      operation:"multiply",
      unite:"ten-thousandths",
      element:"wind",
      niveaux:[4800, 6000, 7200],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp":[
    {
      id:"meliodas-majeste-chances-crit",
      libelle:"Résistance crit. de l'ennemi réduite : chances crit. +16 %",
      cible:"soi",
      stat:"C_Critical_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1200, 1400, 1600],
      provenance:{ phrase:"augmente les chances crit. de " }
    },
    {
      id:"meliodas-majeste-degats-crit",
      libelle:"Défense crit. de l'ennemi réduite : dégâts crit. +32 %",
      cible:"soi",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2400, 2800, 3200],
      provenance:{ phrase:"Augmente les dégâts crit. de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Retour du Chevalier Sacré.webp":[
    {
      id:"hendrickson-retour-chances-crit",
      libelle:"Berserk actif : chances crit. +15 %",
      cible:"soi",
      stat:"C_Critical_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[900, 1200, 1500],
      provenance:{ phrase:"Augmente les chances crit. de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Rituel sacré.webp":[
    {
      id:"manny-rituel-attaque-normale",
      libelle:"Givre obtenu : attaque normale +20 %",
      cible:"soi",
      stat:"Normalattack_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1200, 1600, 2000],
      provenance:{ phrase:"Augmente les dégâts d'attaque normale de " }
    },
    {
      id:"manny-rituel-froid",
      libelle:"Attaques normales cumulées : dégâts de Froid +45 %",
      cible:"soi",
      stat:"Ice_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"ice",
      niveaux:[3000, 3750, 4500],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Robe de printemps.webp":[
    {
      id:"daisy-robe-chances-crit",
      libelle:"Chances crit. des alliés +10 %",
      cible:"allies",
      stat:"C_Critical_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[600, 800, 1000],
      provenance:{ phrase:"Augmente les chances crit. de tous les héros alliés de " }
    },
    {
      id:"daisy-robe-defense-crit",
      libelle:"Coups crit. sur résistance crit. réduite : défense crit. de l'ennemi −48 %",
      cible:"allies",
      cibleEnnemi:true,
      effet:"defenseCritique",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[3200, 4000, 4800],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Sortie joyeuse.webp":[
    {
      id:"elaine-sortie-joyeuse-releve",
      libelle:"Déluge activé : compétence de relève des alliés +50 %",
      cible:"allies",
      stat:"Normalskillchangetag_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[3000, 4000, 5000],
      provenance:{
        phrase:"augmente les dégâts de la compétence de relève de tous les héros alliés de "
      }
    }
  ],
  "7ds-armures-ssr/Armure liee/Souffle d'exploration.webp":[
    {
      /* Deux « \u00a0: » dans ce texte - le plafond du cumul, puis un temps de
         recharge. La phrase citee garde la parenthese ouvrante, qui n'apparait
         qu'une fois. */
      id:"daisy-souffle-degats-foudre",
      libelle:"Boosts de chances crit. cumulés : dégâts de Foudre des alliés +20 %",
      cible:"allies",
      stat:"Thunder_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"thunder",
      niveaux:[1000, 1500, 2000],
      provenance:{ phrase:"(Max\u00a0: " }
    },
    {
      id:"daisy-souffle-degats-crit",
      libelle:"Cumuls au maximum : dégâts crit. des alliés +30 %",
      cible:"allies",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2000, 2500, 3000],
      provenance:{ phrase:"augmente les dégâts crit. de tous les héros alliés de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Tenue d'exercice d'exploratrice.webp":[
    {
      id:"klotho-exercice-attaque-normale",
      libelle:"Expansion dimensionnelle, cumulé : attaque normale +35 %",
      cible:"soi",
      stat:"Normalattack_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2500, 3000, 3500],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Tenue de soirée pour un rendez-vous secret.webp":[
    {
      id:"gowther-tenue-de-soiree-degats-foudre",
      libelle:"Ennemi sous Déluge : dégâts de Foudre +60 %",
      cible:"soi",
      stat:"Thunder_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"thunder",
      niveaux:[3600, 4800, 6000],
      provenance:{ phrase:"Augmente les dégâts de Foudre de " }
    },
    {
      id:"gowther-tenue-de-soiree-percement",
      libelle:"Ennemi sous Déluge : percement de défense +10 %",
      cible:"soi",
      stat:"D_Protect_Cur_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[600, 800, 1000],
      provenance:{ phrase:"le percement de défense de " }
    },
    {
      id:"gowther-tenue-de-soiree-attaque-foudre",
      libelle:"Déluge de Foudre activé : attaque de Foudre des alliés +30 %",
      cible:"allies",
      stat:"Thunder_Add",
      operation:"multiply",
      unite:"ten-thousandths",
      element:"thunder",
      niveaux:[1800, 2400, 3000],
      provenance:{ phrase:"augmente l'attaque de Foudre de tous les héros alliés de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Traces de souvenirs.webp":[
    {
      id:"jericho-traces-froid",
      libelle:"Spéciale ou compétence normale, cumulé : dégâts de Froid +48 %",
      cible:"soi",
      stat:"Ice_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"ice",
      niveaux:[3200, 4000, 4800],
      provenance:{ phrase:"(Max\u00a0: " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Vedette de la taverne.webp":[
    {
      id:"elizabeth-vedette-degats-crit",
      libelle:"Soins sur la durée reçus : dégâts crit. des alliés +40 %",
      cible:"allies",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2400, 3200, 4000],
      provenance:{ phrase:"augmente les dégâts crit. de tous les héros alliés de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Vêtements formels légers.webp":[
    {
      id:"merlin-vetements-formels-degats-crit",
      libelle:"Boost d'attaque de Froid obtenu : dégâts crit. +40 %",
      cible:"soi",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[2400, 3200, 4000],
      provenance:{ phrase:"Augmente les dégâts crit. de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Vœu du prince.webp":[
    {
      /* Le Deluge de Vent est la CONDITION, pas un filtre sur le beneficiaire :
         la source buffe « tous les heros allies », sans mention d'attribut.
         D'ou element null. */
      id:"tristan-voeu-du-prince-attaque-normale",
      libelle:"Déluge de Vent d'un allié : attaque normale des alliés +20 %",
      cible:"allies",
      stat:"Normalattack_Damadd_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1200, 1600, 2000],
      provenance:{
        phrase:"augmente les dégâts d'attaque normale de tous les héros alliés de "
      }
    }
  ]
};
