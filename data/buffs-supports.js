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
//     effet   : "defense"             la defense de la cible, MULTIPLIEE
//                                     par (1 - valeur)
//               "defenseCritique"     sa defense critique, en POINTS retranches
//               "resistanceCritique"  sa resistance critique, en POINTS aussi
//               "vulnerabiliteGlobale"  « augmente les degats subis de N % » :
//                                     tout ce que la cible encaisse, sans
//                                     distinction de CATEGORIE. Un element
//                                     peut la restreindre - la Breche de Ban
//                                     ne vise que les Tenebres - et le champ
//                                     `element` suffit a le dire : un build ne
//                                     porte qu'un element, celui de son arme,
//                                     donc la vulnerabilite reste globale pour
//                                     ceux qui la voient
//               "resistanceElementaire"  CONSIGNEE, PAS CALCULEE. Le moteur
//                                     connait la resistance elementaire de la
//                                     cible mais RIEN ne la reduit, et le
//                                     champ correspondant de l'outil de
//                                     reference n'a jamais ete mesure. La
//                                     ligne porte donc `horsCalcul:true` :
//                                     buffsApplicables() l'ecarte, le
//                                     recensement de l'Analyse l'affiche. Un
//                                     test verifie les deux.
//                                     Ce n'est pas une bizarrerie isolee : 14
//                                     personnages reduisent la resistance
//                                     elementaire, et l'enjeu est gros - 15
//                                     points retires a une resistance de 30 %
//                                     valent +21 % de degats.
//
//     PIEGE, et il a deja coute une ligne : ces effets se cachent souvent dans
//     la DEFINITION d'un etat - « ※ Extinction : … augmente les degats subis
//     de 100 % » - et non dans la phrase principale de la competence. Lire les
//     seules premieres phrases fait manquer les plus gros buffs de la table.
//
//     Ces formes ne sont pas interchangeables et la difference est mesuree,
//     pas supposee : chez l'outil de reference, `d-edef` multiplie la defense
//     tandis que `d-ecdr` se retranche en points (une defense critique de 50
//     reduite de « 50 » tombe a 0, pas a 25).
//
//     DEFENSE critique et RESISTANCE critique sont deux choses : la seconde
//     decide si le coup critique PART, la premiere de ce qu'il rapporte. Les
//     confondre ferait payer deux fois le meme debuff.
//
//     Il n'existe AUCUN code de stat pour ces malus : libelles-stats.json ne
//     decrit que des statistiques de heros. Leur inventer un code aurait
//     desactive le test qui refuse les codes inventes.
//
// operation : "add" ajoute la valeur, "multiply" multiplie celle du heros.
// element   : null, ou l'attribut vise quand le buff ne concerne que lui.
//             L'element d'un heros vient de son ARME equipee, pas du perso.
// unite     : "ten-thousandths" pour un taux, "flat" pour une valeur brute.
// indexeSurAtk : present UNIQUEMENT sur les buffs plats, qui valent un
//             pourcentage de l'ATK de leur LANCEUR, plafonne. `taux` est ce
//             pourcentage en dix-milliemes, `plafond` la borne publiee.
//             `valeur` reste le plafond : c'est le repli servi quand l'ATK du
//             support est inconnue - sans equipe choisie, ou build incomplet.
//             Un test refuse que `plafond` et `valeur` divergent.
//
// Les valeurs a CUMULS sont transcrites au maximum atteignable, et ce produit
// est VERIFIE plutot que pose : la ligne porte `parCumul` et `cumuls`, chacun
// designe par sa propre phrase, et un test controle que `valeur` vaut bien
// leur produit.
//
//   « 2 % par cumul, (Max : 10 fois) »  ->  parCumul 200, cumuls 10, valeur 2000
//
// Ces cinq valeurs ont longtemps ete des multiplications faites de tete, que
// rien ne relisait : le texte publiait 2 et 10, la table stockait 2000, et une
// erreur de facteur dix serait passee sans bruit. C'est desormais le seul
// endroit de ce fichier ou les nombres sont relus un a un ; les autres lignes
// ne sont verifiees que par la presence LITTERALE de leur phrase.
//
// CE QUI N'Y FIGURE PAS, ET POURQUOI :
//
// - les soins, barrieres, gains de defense ou de PV : sans conversion
//   offensive ils ne changent aucun degat. Les mettre a zero serait pire que
//   les omettre, car un zero se lit comme « ce buff ne sert a rien ».
// - QUATRE des cinq buffs restreints a une CATEGORIE de competence. Le
//   cinquieme, derieri_axe_skill_q, figure desormais dans la table : le calcul
//   est devenu par competence, et bonusCategorieDesBuffs() de
//   js/metier/calculateur-entrees.js pose son bonus sur la seule categorie
//   visee. Les quatre autres restent dehors, et pas pour la meme raison :
//
//     elizabeth_staff_skill_q  « degats crit. des attaques normales des
//     derieri_sword2h_passive  allies », « degats crit. d'attaque ultime et
//       d'attaque combinee »  -  du CRITIQUE croise avec une CATEGORIE. Le
//       moteur porte les deux notions, jamais croisees : verser ces valeurs
//       dans les degats critiques les appliquerait a toutes les competences.
//       « Attaque combinee » n'est de surcroit pas une categorie du catalogue.
//
//     elizabeth_staff_passive  « Lorsqu'un heros allie attaque un ennemi
//     manny_staff_passive      affecte par X, augmente LES degats … »  -  la
//       phrase ne dit pas QUI recoit. Howzer et Manny ecrivent « augmente SES
//       degats » quand l'allie est le beneficiaire, et « de tous les heros
//       allies » quand c'est l'equipe ; ici les deux marques manquent, donc le
//       bonus revient au support lui-meme et n'atteint pas le heros calcule.
//       Le supposer collectif gonflerait chaque build de 30 a 60 %.
// - la perforation et les efficacites de duree : le moteur n'a pas d'entree
//   pour elles. La perforation ne perce d'ailleurs aucune defense - elle
//   s'oppose a la Perseverance de l'ennemi, une couche que la formule
//   publiee ne modelise pas du tout.
// - la reduction de defense ELEMENTAIRE, sauf pour la FOUDRE et les TENEBRES.
//   Elle vise une defense distincte de la defense generale, que le moteur ne
//   separe pas : la verser dans la reduction generale suppose que le jeu
//   confond les deux. On l'assume pour les deux elements que la confrerie
//   joue - la Foudre pour ses Merlin de Boss de Guilde, les Tenebres pour ses
//   equipes Ban - et chaque ligne porte son `element` pour qu'aucun build d'un
//   autre element ne la voie :
//     gowther_wand_skill_e  defense de Foudre,   element:"thunder"
//     ban_gauntlets_skill_e defense des Tenebres, element:"dark"
//     derieri_sword2h_skill_q  defense de Feu -20 %, reste dehors
//   Elle reviendra quand la cible portera ses defenses par element ; la ligne
//   de Derieri est deja lue et chiffree dans la spec du recensement, sa
//   reintegration ne coute que sa transcription.
window.SEVEN_DS_BUFFS_SUPPORTS = {
  /* BAN GANTELETS, le soutien Tenebres. Absent de cette table jusqu'ici, et
     c'est ce qui manquait a toute equipe Tenebres : ses deux competences de
     soutien ne bougeaient aucun chiffre du calculateur.

     Ses trois lignes sortent de deux competences seulement. La quatrieme
     phrase de Breche - « reduit la resistance au Deluge de tous les elements
     de 20% » - reste dehors, et pas faute de mesure : la resistance au Deluge
     remplit une jauge de reaction elementaire, elle ne touche ni les degats
     d'une competence ni sa recharge. `generate-effets-dps.py` la classe deja
     `sans-impact-dps` pour cette raison. */
  "ban": [
    {
      id:"ban-detournement-defense-tenebres",
      libelle:"Détournement : défense des Ténèbres de l'ennemi −20 %",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:"dark",
      provenance:{
        gameId:"ban_gauntlets_skill_e",
        phrase:"réduit la défense des Ténèbres à hauteur de 20% de la défense pendant 30s"
      }
    },
    {
      /* Un TAUX sur l'attaque des Tenebres, pas des points et pas un bonus de
         degats : `Dark_Rate` gonfle le pool d'attaque elementaire que
         baseDeComposante() ajoute a l'ATK. D'ou `multiply`, seule operation
         qui rende « +30 % » sur une valeur que le build apporte. */
      id:"ban-detournement-attaque-tenebres",
      libelle:"Détournement : attaque des Ténèbres des alliés +30 %",
      stat:"Dark_Rate",
      operation:"multiply",
      valeur:3000,
      unite:"ten-thousandths",
      element:"dark",
      provenance:{
        gameId:"ban_gauntlets_skill_e",
        phrase:"augmente l'attaque des Ténèbres de tous les héros alliés de 30% pendant 30s"
      }
    },
    {
      /* Une vulnerabilite restreinte a un ELEMENT, la premiere de la table.
         `element:"dark"` la reserve aux builds Tenebres, et pour eux elle est
         bien globale : un build ne porte qu'un element, celui de son arme,
         donc toutes ses competences la subissent. */
      id:"ban-breche-degats-tenebres-subis",
      libelle:"Brèche : dégâts des Ténèbres subis par l'ennemi +25 % (30 s)",
      cible:"ennemi",
      effet:"vulnerabiliteGlobale",
      operation:"add",
      valeur:2500,
      unite:"ten-thousandths",
      element:"dark",
      provenance:{
        gameId:"ban_gauntlets_skill_q",
        phrase:"augmente les dégâts des Ténèbres subis de 25%"
      }
    }
  ],
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
      parCumul:500,
      cumuls:4,
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"daisy_wand_skill_rmb_ready",
        phrase:"augmente les chances crit. de tous les héros alliés de ",
        phraseCumuls:"(Max : "
      }
    },
    {
      id:"daisy-electroaimant-resistance-crit",
      libelle:"Électroaimant : résistance crit. de l'ennemi −20 %",
      cible:"ennemi",
      effet:"resistanceCritique",
      operation:"add",
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"daisy_book_passive",
        phrase:"※ Électroaimant : réduit la résistance crit. de 20%"
      }
    },
    {
      id:"daisy-bombe-resistance-crit",
      libelle:"Bombe de graine : résistance crit. de l'ennemi −6 % par coup, 4 cumuls",
      cible:"ennemi",
      effet:"resistanceCritique",
      operation:"add",
      parCumul:600,
      cumuls:4,
      valeur:2400,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"daisy_wand_skill_e",
        phrase:"réduit la résistance crit. de l'ennemi de ",
        phraseCumuls:"(Max : "
      }
    },
    {
      id:"daisy-charge-degats-crit",
      libelle:"Charge électrique : dégâts crit. +2 % par cumul, 20 cumuls",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      parCumul:200,
      cumuls:20,
      valeur:4000,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"daisy_book_skill_e",
        phrase:"augmente les dégâts crit. des héros d'attribut Foudre de ",
        phraseCumuls:"(Max : "
      }
    },
    {
      id:"daisy-charge-chances-crit",
      libelle:"Charge électrique : chances crit. +1,5 % par cumul, 20 cumuls",
      stat:"C_Critical_Rate",
      operation:"add",
      parCumul:150,
      cumuls:20,
      valeur:3000,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"daisy_book_skill_e",
        phrase:"et leurs chances crit. de ",
        phraseCumuls:"(Max : "
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
      /* Le seul buff de categorie de la table, et le seul des cinq dont la
         source dit explicitement qui recoit : « des heros allies d'attribut
         Tenebres ». Il ne passe pas par entreesDuCalcul - dont les seaux
         valent pour toutes les competences a la fois - mais par
         bonusCategorieDesBuffs(), qui le pose sur la competence normale
         seule. */
      id:"derieri-lancer-competence-normale",
      libelle:"Ennemi sous Déluge : compétence normale des alliés Ténèbres +50 %",
      stat:"Normalskill_Damadd_Rate",
      operation:"add",
      valeur:5000,
      unite:"ten-thousandths",
      element:"dark",
      provenance:{
        gameId:"derieri_axe_skill_q",
        phrase:"Augmente les dégâts de compétence normale des héros alliés d'attribut Ténèbres de 50% pendant 15s"
      }
    },
    {
      id:"derieri-taillade-attaque-feu",
      libelle:"Attaque de Feu +30 % de l'ATK de Derieri (plafond 3000)",
      stat:"Fire_Add",
      operation:"add",
      valeur:3000,
      unite:"flat",
      indexeSurAtk:{ taux:3000, plafond:3000 },
      element:"fire",
      provenance:{
        gameId:"derieri_sword2h_skill_e",
        phrase:"Augmente l'attaque de Feu de tous les héros alliés à hauteur de 30% de l'attaque du héros (Max : 3000) pendant 40s"
      }
    }
  ],
  "drake": [
    {
      id:"drake-courant-electrique-defense-crit",
      libelle:"Courant électrique : défense crit. de l'ennemi −8 % par cumul, 5 cumuls",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      parCumul:800,
      cumuls:5,
      valeur:4000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"drake_staff_skill_rmb",
        phrase:"※ Courant électrique : réduit la défense crit. de ",
        phraseCumuls:"(Max : "
      }
    },
    {
      /* Meme competence que la ligne ci-dessus, autre effet : la Tempete de
         Foudre pose Courant electrique ET Paralysie. Deux lignes, deux
         identifiants, une seule source. */
      id:"drake-paralysie-resistance-foudre",
      libelle:"Paralysie : résistance à la Foudre de l'ennemi −15 %",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"drake_staff_skill_rmb",
        phrase:"※ Paralysie : immobilisation. Réduit la résistance à la Foudre de 15%"
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
      /* Les 50 cumuls ne s'empilent qu'« en subissant des attaques de Vent ».
         La valeur transcrite est le maximum atteignable, comme partout dans
         cette table, mais une equipe sans Vent ne l'atteindra pas. */
      id:"elizabeth-rupture-defense-crit",
      libelle:"Rupture : défense crit. de l'ennemi −0,8 % par cumul, 50 cumuls",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      parCumul:80,
      cumuls:50,
      valeur:4000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"elizabeth_staff_skill_r",
        phrase:"et réduit la défense crit. de ",
        phraseCumuls:"(Max : "
      }
    },
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
      indexeSurAtk:{ taux:3000, plafond:3000 },
      element:"wind",
      provenance:{
        gameId:"elizabeth_staff_skill_e",
        phrase:"Augmente l'attaque de Vent de tous les héros alliés à hauteur de 30% de l'attaque du héros pendant 40s. (Max : 3000)"
      }
    },
    {
      /* La valeur de BASE. Elle monte avec les paliers de potentiel du Baton,
         et les supplements sont dans potentiels-equipe.js : +20 % au palier 6,
         +30 % au palier 10. La table du jeu donne la suite complete —
         302172014 = +50 %, 302172035 = +70 %, 302172045 = +100 %.

         Le jeu restreint ce boost aux ATTAQUES NORMALES ; `C_Critical_Dam_Rate`
         ne porte pas cette nuance et le moteur l'applique a tout. C'est
         l'approximation deja retenue pour les autres lignes de degats crit. */
      id:"elizabeth-priere-degats-crit-normale",
      libelle:"Attaque spéciale : dégâts crit. d'attaque normale des alliés +50 %",
      stat:"C_Critical_Dam_Rate",
      operation:"add",
      valeur:5000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"elizabeth_staff_skill_q",
        phrase:"augmente les dégâts crit. des attaques normales des alliés à portée de 50%"
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
    },
    {
      /* LU dans la table du jeu, pas deduit du texte : le buff 302172012 porte
         ApplyType `Team`. « les degats » designe donc toute l'equipe, et non
         le porteur seul comme le depot le lisait jusqu'ici. Le bloc
         d'identifiants 302172 n'est touche que par des competences d'Elizabeth.

         CONDITIONNEL : l'ennemi doit etre sous Alteration, que la competence
         speciale du Baton pose pour 30 s. La table ne sait pas exprimer une
         condition ; la ligne est donc comptee comme acquise, ce qui suppose
         que le support tient son etat. */
      id:"elizabeth-vent-favorable-degats-normale",
      libelle:"Vent favorable : dégâts d'attaque normale des alliés +60 % (cible sous Altération)",
      stat:"Normalattack_Damadd_Rate",
      operation:"add",
      valeur:6000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"elizabeth_staff_passive",
        phrase:"Lorsqu'un héros allié attaque un ennemi affecté par Altération, augmente les dégâts d'attaque normale de 60%"
      }
    }
  ],
  "escanor": [
    {
      /* L'ancre des cumuls est longue : « (Max : » apparait deux fois dans
         cette description. On vise celui de la reduction de defense. */
      id:"escanor-inflammation-defense",
      libelle:"Inflammation : défense de l'ennemi −0,15 % par cumul, 100 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:15,
      cumuls:100,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"escanor_sword2h_jumpatk",
        phrase:"Réduit la défense de ",
        phraseCumuls:"sont infligés. (Max : "
      }
    }
  ],
  /* TROIS ARMES, DEUX ORTHOGRAPHES. Ses identifiants s'ecrivent tantot
     `gil_thunder_`, tantot `gilthunder_` : la regle du jeton `_<enum>_` de
     armeDuGameId() les couvre toutes les trois, un decoupage par position n'y
     survivrait pas. Ses trois lignes sont consignees, aucune n'atteint la
     formule. */
  "gil-thunder": [
    {
      id:"gil-thunder-paralysie-resistance-foudre",
      libelle:"Paralysie : résistance à la Foudre de l'ennemi −15 %",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gil_thunder_lance_skill_rmb",
        phrase:"※ Paralysie : immobilisation. Réduit la résistance à la Foudre de 15%"
      }
    },
    {
      id:"gil-thunder-barriere-resistance-foudre",
      libelle:"Barrière de Foudre retirée : résistance à la Foudre de l'ennemi −15 % (30 s)",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gilthunder_shield_passive",
        phrase:"réduit la résistance à la Foudre des ennemis proches de 15% pendant 30s"
      }
    },
    {
      id:"gil-thunder-deluge-resistance-foudre",
      libelle:"Déluge de Foudre activé : résistance à la Foudre de l'ennemi −15 % (20 s)",
      cible:"ennemi",
      effet:"resistanceElementaire",
      horsCalcul:true,
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gilthunder_sword1h_passive",
        phrase:"réduit la résistance à la Foudre de l'ennemi de 15% pendant 20s"
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
      /* OUBLI, pas exclusion : cette ligne aurait du figurer ici des le
         premier lot. Elle n'a pas ete ecartee pour une raison documentee -
         elle est simplement passee entre les mailles, parce qu'elle se cache
         dans la definition d'un EFFET (« ※ Extinction : … ») et non dans la
         phrase principale de la competence.

         C'est de loin le plus gros buff de la table : +100 % de degats subis
         DOUBLE la ligne de degats. Il ne dure que 5 s et se reapplique toutes
         les 60 s, donc le cocher est une declaration forte. */
      id:"gowther-extinction-degats-subis",
      libelle:"Extinction : dégâts subis par l'ennemi +100 % (5 s)",
      cible:"ennemi",
      effet:"vulnerabiliteGlobale",
      operation:"add",
      valeur:10000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"gowther_book_skill_r",
        phrase:"Augmente les dégâts subis de 100%"
      }
    },
    {
      id:"gowther-salve-defense-foudre",
      libelle:"Salve de flèches : défense de Foudre de l'ennemi −6 % par cumul, 4 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:600,
      cumuls:4,
      valeur:2400,
      unite:"ten-thousandths",
      element:"thunder",
      provenance:{
        gameId:"gowther_wand_skill_e",
        phrase:"réduit la défense de Foudre de l'ennemi à hauteur de ",
        phraseCumuls:"pendant 30s. (Max : "
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
      parCumul:100,
      cumuls:25,
      valeur:2500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"gowther_book_passive",
        phrase:"※ Synchronisation : augmente l'attaque de ",
        phraseCumuls:"(Max : "
      }
    },
    {
      id:"gowther-confusion-attaque-foudre",
      libelle:"Attaque de Foudre +10 % de l'ATK de Gowther (plafond 3000)",
      stat:"Thunder_Add",
      operation:"add",
      valeur:3000,
      unite:"flat",
      /* 10 %, pas 30 % : la phrase de Gowther dit bien « a hauteur de 10% de
         l'attaque du heros », la ou Derieri et Elisabeth en donnent 30. */
      indexeSurAtk:{ taux:1000, plafond:3000 },
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
    },
    {
      id:"guila-inflammation-defense",
      libelle:"Inflammation : défense de l'ennemi −0,15 % par cumul, 100 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:15,
      cumuls:100,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"guila_rapier_skill_e",
        phrase:"Réduit la défense de ",
        phraseCumuls:"sont infligés. (Max : "
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
      id:"howzer-rafale-resistance-crit",
      libelle:"Sous barrière : résistance crit. de l'ennemi −15 %",
      cible:"ennemi",
      effet:"resistanceCritique",
      operation:"add",
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"howzer_cudgel3c_skill_q",
        phrase:"réduit la résistance crit. de l'ennemi de 15% pendant 40s"
      }
    },
    {
      id:"howzer-impact-resistance-crit",
      libelle:"Cible qui saigne : résistance crit. de l'ennemi −5 % par cumul, 3 cumuls",
      cible:"ennemi",
      effet:"resistanceCritique",
      operation:"add",
      parCumul:500,
      cumuls:3,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"howzer_gauntlets_skill_rmb_1",
        phrase:"La deuxième frappe réduit la résistance crit. de ",
        phraseCumuls:"(Max : "
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
  "king": [
    {
      id:"king-marque-degats-subis",
      libelle:"Marque de la forêt : dégâts subis par l'ennemi +2 % par cumul, 10 cumuls",
      cible:"ennemi",
      effet:"vulnerabiliteGlobale",
      operation:"add",
      parCumul:200,
      cumuls:10,
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"king_book_skill_e",
        phrase:"※ Marque de la forêt : augmente les dégâts subis de ",
        phraseCumuls:"(Max : "
      }
    }
  ],
  "klotho": [
    {
      id:"klotho-erosion-defense-crit",
      libelle:"Érosion dimensionnelle : défense crit. de l'ennemi −10 %",
      cible:"ennemi",
      effet:"defenseCritique",
      operation:"add",
      valeur:1000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"klotho_staff_skill_e",
        phrase:"※ Érosion dimensionnelle : réduit la défense crit. de 10%"
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
      parCumul:200,
      cumuls:10,
      valeur:2000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"manny_sworddual_jumpatk",
        phrase:"réduit la défense crit. de ",
        /* Un « max » MINUSCULE ici, quand tout le reste du catalogue ecrit
           « Max ». On cite ce que la source ecrit. */
        phraseCumuls:"(max : "
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
    },
    {
      /* Meme lecture que la ligne d'Elizabeth : buff 302221001, ApplyType
         `Team`, bloc 302221 exclusif a Manny. CONDITIONNEL : l'ennemi doit
         etre sous Chatiment, pose par la competence normale du Baton. */
      id:"manny-pretresse-degats-ultime",
      libelle:"Prêtresse des dragons : dégâts d'attaque ultime des alliés +30 % (cible sous Châtiment)",
      stat:"Ultimateskill_Damadd_Rate",
      operation:"add",
      valeur:3000,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"manny_staff_passive",
        phrase:"Augmente les dégâts d'attaque ultime de 30% lorsqu'un héros allié attaque un ennemi affecté par Châtiment"
      }
    }
  ],
  "slader": [
    {
      id:"slader-blessure-degats-subis",
      libelle:"Blessure profonde : dégâts subis par l'ennemi +25 %",
      cible:"ennemi",
      effet:"vulnerabiliteGlobale",
      operation:"add",
      valeur:2500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"slader_axe_skill_q",
        phrase:"※ Blessure profonde : augmente les dégâts subis de 25%"
      }
    }
  ],
  "tioreh": [
    {
      id:"tioreh-inflammation-defense",
      libelle:"Inflammation : défense de l'ennemi −0,15 % par cumul, 100 cumuls",
      cible:"ennemi",
      effet:"defense",
      operation:"add",
      parCumul:15,
      cumuls:100,
      valeur:1500,
      unite:"ten-thousandths",
      element:null,
      provenance:{
        gameId:"tioreh_wand_skill_q",
        phrase:"Réduit la défense de ",
        phraseCumuls:"sont infligés. (Max : "
      }
    }
  ]
};
