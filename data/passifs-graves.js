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
//
// LES CUMULS. Seize de ces quarante-huit lignes montent par paliers, et
// `niveaux` n'en stocke que le PLAFOND. Trois champs ouvrent le grain :
//
//   parCumul    le pas, un par niveau, dans le meme ordre que `niveaux`.
//   cumuls      le nombre de crans. Il vaut 3 a 30 selon la ligne, et il est
//               toujours le MEME aux trois niveaux. Meme nom et meme role que
//               dans buffs-supports.js, ou le pas est un scalaire faute de
//               niveaux : deux noms pour une seule notion finiraient par
//               diverger.
//   phraseCumul l'ancre du pas, sous la meme regle que `phrase` - une
//               occurrence unique dans le texte, le nombre juste apres.
//
// Le plafond reste la reference : un test verifie que `parCumul[i] x cumuls`
// vaut exactement `niveaux[i]` aux trois niveaux, donc les deux ecritures ne
// peuvent pas diverger.
//
// POURQUOI CE GRAIN. Mesure en jeu sur le mannequin, Merlin p10 : son passif
// de tenue rendait +6 % de degats critiques, pas +24 %. Un cumul sur quatre.
// La case tout-ou-rien envoyait donc au plafond un build qui n'y etait pas, et
// l'ecart valait 14 % de degats sur un coup critique.
//
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
// passifs offensifs pour leur seul porteur et 14 qui buffent l'equipe.
// TRENTE-SEPT tenues sont transcrites ici. Les autres ne le sont pas, et il
// vaut mieux le dire que les approximer :
//
//   Chevalier sacre a la visiere en etoile (jericho) et Piste de la flamme
//     cramoisie (guila)   « resistance au Deluge » : une resistance de jauge,
//     distincte de la resistance elementaire que la cible porte.
//   Retour du Chevalier Sacre (hendrickson), Resistance et revolution
//     (derieri), Tenue modeste (dreyfus)   des degats critiques ou
//     elementaires restreints a UNE categorie de competence. Le moteur porte
//     les deux notions separement, jamais croisees. Tenue modeste dit
//     « degats de TERRE de l'attaque ultime » : la ranger en bonus d'ultime
//     supposerait que tout l'ultime du porteur soit de Terre, et la ranger en
//     bonus de Terre gonflerait les quatre autres categories. Les deux
//     rangements sont faux ; on n'en choisit aucun.
//   Tenue de fete legere (klotho)   des degats de proc, sans effet sur les
//     statistiques.
//   Protection de la fee (tioreh)   seule la defense des allies monte : rien
//     d'offensif a chiffrer.
//
// CINQ SONT REVENUES, et voici ce qui les bloquait :
//
//   Chevalier sacre prometteur (gil-thunder)   attendait un seau pour les
//     « degats infliges aux ennemis affectes par Electrocution ». Aucun CODE
//     DE STAT ne le porte, c'etait exact - mais l'effet vulnerabiliteGlobale
//     le porte, et ce n'est pas un code invente : c'est un effet sur la cible,
//     deja branche et deja teste.
//   Le Serpent de l'Envie (diane) et Dignite de la sainte (elaine)   leur
//     plafond ecrit DEUX nombres dans la meme parenthese, et il fallait
//     designer le second. L'ancre retenue est « %, » : ce n'est pas un
//     nombre, donc elle ne change pas d'un niveau a l'autre, et c'est
//     justement la virgule qui separe les deux plafonds. Verifiee unique aux
//     trois niveaux.
//   Furtivite du demon (drake) et Marche des ombres (drake)   simplement
//     oubliees : rien ne les bloquait.
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
// Celles qui restent reviendront le jour ou le moteur portera le seau qui leur
// manque. Sept l'ont deja fait : Fille de la foret et de la terre (tioreh) et
// Seigneur des ombres (drake) attendaient toutes deux un seau de reduction de
// RESISTANCE critique, qui existe desormais. La premiere attendait en plus la
// vulnerabilite par categorie, arrivee avec les potentiels d'equipe. C'est
// exactement ce que cette liste est censee produire : des retours, pas des
// oublis.
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
      parCumul:[900, 1200, 1500],
      cumuls:5,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts d'attaque ultime de "
      }
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
      parCumul:[120, 160, 200],
      cumuls:10,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"par les héros alliés de "
      }
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
      parCumul:[200, 250, 300],
      cumuls:15,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts de Vent de "
      }
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
      parCumul:[1000, 1250, 1500],
      cumuls:10,
      provenance:{
        phrase:"des bonus pendant 30\u00a0s. (Max\u00a0: ",
        phraseCumul:"augmente les dégâts de compétence normale de "
      }
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
      parCumul:[300, 400, 500],
      cumuls:6,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"d'attribut Feu de "
      }
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
  "7ds-armures-ssr/Armure liee/Fille de la forêt et de la terre.webp":[
    {
      /* Cette tenue a longtemps ete NOMMEE dans la liste des absentes : ses
         deux effets visent la cible, et le moteur n'avait de seau pour aucun
         des deux. Les deux existent maintenant. */
      id:"tioreh-fille-foret-resistance-crit",
      libelle:"Coups sur cible en Combustion : résistance crit. de l'ennemi −42 %",
      cible:"allies",
      cibleEnnemi:true,
      effet:"resistanceCritique",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[3000, 3600, 4200],
      parCumul:[100, 120, 140],
      cumuls:30,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"réduit sa résistance crit. de "
      }
    },
    {
      id:"tioreh-fille-foret-vulnerabilite-competence-normale",
      libelle:"Cumuls au maximum : compétence normale subie par l'ennemi +30 %",
      cible:"allies",
      cibleEnnemi:true,
      effet:"vulnerabiliteCategorie",
      categorie:"NORMAL_SKILL",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1000, 2000, 3000],
      provenance:{ phrase:"subis par l'ennemi de " }
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
      parCumul:[600, 800, 1000],
      cumuls:3,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts de Foudre de "
      }
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
      parCumul:[120, 160, 200],
      cumuls:10,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les chances crit. de "
      }
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
      parCumul:[400, 500, 600],
      cumuls:4,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts crit. de "
      }
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
      parCumul:[1600, 2000, 2400],
      cumuls:3,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente l'attaque de Vent de "
      }
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
      parCumul:[200, 250, 300],
      cumuls:15,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"les dégâts de Froid de "
      }
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
      parCumul:[800, 1000, 1200],
      cumuls:4,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"réduit la défense crit. de la cible de "
      }
    }
  ],
  "7ds-armures-ssr/Armure liee/Seigneur des ombres.webp":[
    {
      id:"drake-seigneur-ombres-resistance-crit",
      libelle:"Coups sur cible à défense crit. réduite : résistance crit. de l'ennemi −70 %",
      cible:"allies",
      cibleEnnemi:true,
      effet:"resistanceCritique",
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[5000, 6000, 7000],
      parCumul:[1000, 1200, 1400],
      cumuls:5,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"réduit sa résistance crit. de "
      }
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
      parCumul:[200, 300, 400],
      cumuls:5,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts de Foudre de tous les héros alliés de "
      }
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
      parCumul:[500, 600, 700],
      cumuls:5,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"que l'utilisateur lui inflige de "
      }
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
      parCumul:[800, 1000, 1200],
      cumuls:4,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts de Froid de "
      }
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
  ],
  "7ds-armures-ssr/Armure liee/Chevalier sacré prometteur.webp":[
    {
      /* « Degats infliges AUX ENNEMIS affectes par… » : une propriete de la
         cible, pas un bonus du heros, et elle ne vise aucune categorie. */
      id:"chevalier-sacre-electrocution",
      libelle:"Cible électrocutée : dégâts subis +25 %",
      cible:"soi",
      effet:"vulnerabiliteGlobale",
      cibleEnnemi:true,
      operation:"add",
      unite:"ten-thousandths",
      element:null,
      niveaux:[1500, 2000, 2500],
      /* « par Électrocution de » et non « Électrocution » seule : la seconde
         phrase dit « affecte par Électrocution augmente la duree ». */
      provenance:{ phrase:"par Électrocution de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Dignité de la sainte.webp":[
    {
      id:"dignite-sainte-degats-terre",
      libelle:"Résistance au Déluge de Terre réduite : dégâts de Terre +32 %",
      cible:"allies",
      stat:"Earth_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"earth",
      niveaux:[1600, 2400, 3200],
      parCumul:[200, 300, 400],
      cumuls:8,
      /* DEUX plafonds dans une seule parenthese - « (Max : 16 %, 32 %) » - un
         pour la defense, un pour les degats. L'ancre « (Max » designerait le
         premier. « %, » designe le second, et n'apparait qu'une fois dans tout
         le texte : c'est precisement cette virgule qui separe les deux. */
      provenance:{
        phrase:"%, ",
        phraseCumul:"et les dégâts de Terre de "
      }
    }
  ],
  "7ds-armures-ssr/Armure liee/Furtivité du démon.webp":[
    {
      id:"furtivite-demon-degats-tenebres",
      libelle:"Attaque dans le dos : dégâts des Ténèbres +50 %",
      cible:"soi",
      stat:"Dark_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"dark",
      niveaux:[3000, 4000, 5000],
      provenance:{ phrase:"d'augmenter les dégâts des Ténèbres de " }
    }
  ],
  "7ds-armures-ssr/Armure liee/Le Serpent de l'Envie.webp":[
    {
      id:"serpent-envie-degats-terre",
      libelle:"Cible sous Brise-tout : dégâts de Terre +32 %",
      cible:"soi",
      stat:"Earth_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"earth",
      niveaux:[2400, 2800, 3200],
      parCumul:[600, 700, 800],
      cumuls:4,
      /* Meme forme a deux plafonds que la Dignite de la sainte, sous un autre
         libelle : « (Nombre maximal de cumuls pour chaque effet : 80 %, 32 %) ».
         La virgule reste le seul separateur fiable. */
      provenance:{
        phrase:"%, ",
        phraseCumul:"augmente les dégâts de Terre de "
      }
    }
  ],
  "7ds-armures-ssr/Armure liee/Marche des ombres.webp":[
    {
      id:"marche-des-ombres-degats-tenebres",
      libelle:"Par coup critique : dégâts des Ténèbres +4,5 %",
      cible:"soi",
      stat:"Dark_Element_Rate",
      operation:"add",
      unite:"ten-thousandths",
      element:"dark",
      niveaux:[3500, 4000, 4500],
      parCumul:[350, 400, 450],
      cumuls:10,
      provenance:{
        phrase:"(Max\u00a0: ",
        phraseCumul:"augmente les dégâts des Ténèbres de "
      }
    }
  ]
};
