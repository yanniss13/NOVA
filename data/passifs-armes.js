// Passifs d'arme qui changent les degats.
//
// ECRIT ET MAINTENU A LA MAIN. Aucun generateur ne produit cette table : le
// test relit chaque chiffre dans le texte publie de l'arme, niveau par niveau.
//
// UNE ENTREE, PLUSIEURS FICHIERS. Les armes de raid vont par familles de douze
// - une par type d'arme - qui partagent le MEME passif, mot pour mot et niveau
// par niveau. Le catalogue compte 94 armes a passif pour seulement 23 passifs
// distincts. Nommer la famille plutot que le fichier evite donc douze copies a
// tenir d'accord a chaque correction, SANS elargir la portee : `armes` cite
// chaque fichier un par un, et le test relit le texte publie de chacun.
//
// Le TYPE d'arme, lui, resterait trop large : Derieri peut equiper treize
// gantelets, mais seul celui de l'ame vorace porte Barrage des Tenebres.
//
// CE QUI RESTE DEHORS, et pourquoi. Plusieurs passifs gagnent une SECONDE
// PHRASE a partir du niveau 4. Elle est absente des trois premiers niveaux,
// donc l'ancre du test ne peut pas la trouver aux sept niveaux, et surtout sa
// condition de declenchement n'est mesuree nulle part. Aucune valeur ne lui est
// attribuee ici tant qu'un releve en jeu ne l'aura pas confirmee.
window.SEVEN_DS_PASSIFS_ARMES = [
  {
    famille:"Flamme cramoisie",
    armes:[
      "7ds-armes/Baguette/Baguette de la flamme cramoisie.webp",
      "7ds-armes/Baton/Bâton de la flamme cramoisie.webp",
      "7ds-armes/Bouclier/Épée et bouclier de la flamme cramoisie.webp",
      "7ds-armes/Epee 1 main/Épée longue de la flamme cramoisie.webp",
      "7ds-armes/Epee 2 mains/Espadon de la flamme cramoisie.webp",
      "7ds-armes/Epees doubles/Épées doubles de la flamme cramoisie.webp",
      "7ds-armes/Gantelets/Gantelets de la flamme cramoisie.webp",
      "7ds-armes/Hache/Hache de la flamme cramoisie.webp",
      "7ds-armes/Lance/Lance de la flamme cramoisie.webp",
      "7ds-armes/Livre/Grimoire de la flamme cramoisie.webp",
      "7ds-armes/Nunchaku/Nunchaku de la flamme cramoisie.webp",
      "7ds-armes/Rapiere/Rapière de la flamme cramoisie.webp"
    ],
    lignes:[
      {
        id:"flamme-cramoisie-deluge-attaque",
        libelle:"Après un Déluge : attaque +40 % (10 s)",
        stat:"I_AtkAdd_Rate",
        /* Un TAUX sur l'attaque, jamais une valeur plate : `multiply` est ce
           qui distingue « +40 % d'attaque » de « +40 points d'attaque ». */
        operation:"multiply",
        unite:"ten-thousandths",
        niveaux:[2800, 3000, 3200, 3400, 3600, 3800, 4000],
        provenance:{ phrase:"augmente l'attaque de " }
      }
    ]
  },
  {
    famille:"Ailes de la flamme noire",
    armes:[
      "7ds-armes/Baguette/Baguette des ailes de la flamme noire.webp",
      "7ds-armes/Baton/Bâton des ailes de la flamme noire.webp",
      "7ds-armes/Bouclier/Épée et bouclier des ailes de la flamme noire.webp",
      "7ds-armes/Epee 1 main/Épée longue des ailes de la flamme noire.webp",
      "7ds-armes/Epee 2 mains/Espadon des ailes de la flamme noire.webp",
      "7ds-armes/Epees doubles/Épées doubles des ailes de la flamme noire.webp",
      "7ds-armes/Gantelets/Gantelets des ailes de la flamme noire.webp",
      "7ds-armes/Hache/Hache des ailes de la flamme noire.webp",
      "7ds-armes/Lance/Lance des ailes de la flamme noire.webp",
      "7ds-armes/Livre/Grimoire des ailes de la flamme noire.webp",
      "7ds-armes/Nunchaku/Nunchaku des ailes de la flamme noire.webp",
      "7ds-armes/Rapiere/Rapière des ailes de la flamme noire.webp"
    ],
    /* Une seule phrase du jeu, mais DEUX statistiques : elles se cochent
       ensemble en jeu et se cochent donc separement ici, faute de quoi une
       seule case porterait deux valeurs que le moteur range ailleurs. */
    lignes:[
      {
        id:"ailes-flamme-noire-deluge-attaque",
        libelle:"Après un Déluge : attaque +40 % (10 s)",
        stat:"I_AtkAdd_Rate",
        operation:"multiply",
        unite:"ten-thousandths",
        niveaux:[2800, 3000, 3200, 3400, 3600, 3800, 4000],
        provenance:{ phrase:"augmente l'attaque de " }
      },
      {
        id:"ailes-flamme-noire-deluge-critique",
        libelle:"Après un Déluge : chances crit. +15 % (10 s)",
        stat:"C_Critical_Rate",
        /* Le critique de l'ARME est celui du heros, donc il subit le plafond
           de 90 % - a la difference d'un buff de soutien, qui s'ajoute apres.
           `porteur` est ce qui fait la difference dans entreesDuCalcul. */
        porteur:"hero",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[600, 750, 900, 1050, 1200, 1350, 1500],
        provenance:{ phrase:"et les chances crit. de " }
      }
    ]
  },
  {
    famille:"Flamboyante",
    armes:[
      "7ds-armes/Baguette/Baguette flamboyante.webp",
      "7ds-armes/Baton/Bâton flamboyant.webp",
      "7ds-armes/Bouclier/Épée et bouclier flamboyants.webp",
      "7ds-armes/Epee 1 main/Épée longue flamboyante.webp",
      "7ds-armes/Epee 2 mains/Espadon flamboyant.webp",
      "7ds-armes/Epees doubles/Épées doubles flamboyantes.webp",
      "7ds-armes/Gantelets/Gantelets flamboyants.webp",
      "7ds-armes/Hache/Hache flamboyante.webp",
      "7ds-armes/Lance/Lance flamboyante.webp",
      "7ds-armes/Livre/Grimoire flamboyant.webp",
      "7ds-armes/Nunchaku/Nunchaku flamboyant.webp",
      "7ds-armes/Rapiere/Rapière flamboyante.webp"
    ],
    lignes:[
      {
        id:"flamboyante-pv-pleins-vulnerabilite",
        libelle:"Ennemi à PV pleins : dégâts subis +50 % (20 s)",
        /* Une propriete de la CIBLE, pas du heros : elle porte un `effet` et
           aucun code de stat, parce que libelles-stats.json ne decrit que des
           statistiques de heros. Le premier coup d'un combat la remplit
           toujours ; les suivants, presque jamais. */
        effet:"vulnerabiliteGlobale",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[2000, 2500, 3000, 3500, 4000, 4500, 5000],
        provenance:{ phrase:"augmente ses dégâts subis de " }
      }
    ]
  },
  {
    famille:"Noir de jais",
    armes:[
      "7ds-armes/Baguette/Baguette noir de jais.webp",
      "7ds-armes/Baton/Bâton noir de jais.webp",
      "7ds-armes/Bouclier/Épée et bouclier noir de jais.webp",
      "7ds-armes/Epee 1 main/Épée longue noir de jais.webp",
      "7ds-armes/Epee 2 mains/Espadon noir de jais.webp",
      "7ds-armes/Epees doubles/Épées doubles noir de jais.webp",
      "7ds-armes/Gantelets/Gantelets noir de jais.webp",
      "7ds-armes/Hache/Hache noir de jais.webp",
      "7ds-armes/Lance/Lance noir de jais.webp",
      "7ds-armes/Livre/Grimoire noir de jais.webp",
      "7ds-armes/Nunchaku/Nunchaku noir de jais.webp",
      "7ds-armes/Rapiere/Rapière noir de jais.webp"
    ],
    lignes:[
      {
        id:"noir-de-jais-ultime-critique",
        /* Le libelle dit « 1 chance sur 5 » parce que la page prend le
           critique en ESPERANCE et non au tirage : cocher cette case declare
           le tirage GAGNE, pas sa probabilite moyenne. Le taux publie, 20 %,
           n'entre donc dans aucun calcul - il n'est la que pour prevenir. */
        libelle:"Après l'ultime, 1 chance sur 5 : chances crit. +80 % (7 s)",
        stat:"C_Critical_Rate",
        porteur:"hero",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[5000, 5500, 6000, 6500, 7000, 7500, 8000],
        /* L'ancre commence apres le « 20 % de chances » : sans « d' », elle
           attraperait la probabilite au lieu du bonus. */
        provenance:{ phrase:"d'augmenter les chances crit. de " }
      }
    ]
  },
  {
    famille:"Aura triomphale",
    armes:[
      "7ds-armes/Baguette/Baguette à l'aura triomphale.webp",
      "7ds-armes/Baton/Bâton à l'aura triomphale.webp",
      "7ds-armes/Bouclier/Épée et bouclier à l'aura triomphale.webp",
      "7ds-armes/Epee 1 main/Épée longue à l'aura triomphale.webp",
      "7ds-armes/Epee 2 mains/Espadon à l'aura triomphale.webp",
      "7ds-armes/Epees doubles/Épées doubles à l'aura triomphale.webp",
      "7ds-armes/Gantelets/Gantelets à l'aura triomphale.webp",
      "7ds-armes/Hache/Hache à l'aura triomphale.webp",
      "7ds-armes/Lance/Lance à l'aura triomphale.webp",
      "7ds-armes/Livre/Grimoire à l'aura triomphale.webp",
      "7ds-armes/Nunchaku/Nunchaku à l'aura triomphale.webp",
      "7ds-armes/Rapiere/Rapière à l'aura triomphale.webp"
    ],
    lignes:[
      {
        id:"aura-triomphale-coups-attaque",
        libelle:"Après la spéciale : attaque +2,2 % par coup normal",
        stat:"I_AtkAdd_Rate",
        operation:"multiply",
        unite:"ten-thousandths",
        niveaux:[2080, 2550, 2700, 2850, 3000, 3150, 3300],
        parCumul:[160, 170, 180, 190, 200, 210, 220],
        /* LE PLAFOND CHANGE DE COMPTE SELON LE NIVEAU : treize coups au niveau
           un, quinze ensuite. Barrage des Tenebres en avait quarante partout,
           ce qui laissait croire a un nombre constant. Le champ accepte donc
           un tableau, et le test verifie pas x cumuls = plafond a chacun des
           sept niveaux - c'est ce produit qui a revele l'irregularite. */
        cumuls:[13, 15, 15, 15, 15, 15, 15],
        /* L'ancre du plafond porte « pendant 20s. » : a partir du niveau 4, la
           seconde phrase ajoute son propre « (Max : » et un plafond nu
           designerait la mauvaise valeur. */
        provenance:{
          phrase:"pendant 20s. (Max : ",
          phraseCumul:"augmente l'attaque de "
        }
      }
    ]
  },
  {
    famille:"Rugissement de la liche draconique",
    armes:[
      "7ds-armes/Baguette/Baguette du rugissement de la liche draconique.webp",
      "7ds-armes/Baton/Bâton du rugissement de la liche draconique.webp",
      "7ds-armes/Bouclier/Épée et bouclier du rugissement de la liche draconique.webp",
      "7ds-armes/Epee 1 main/Épée longue du rugissement de la liche draconique.webp",
      "7ds-armes/Epee 2 mains/Espadon du rugissement de la liche draconique.webp",
      "7ds-armes/Epees doubles/Épées doubles du rugissement de la liche draconique.webp",
      "7ds-armes/Gantelets/Gantelets du rugissement de la liche draconique.webp",
      "7ds-armes/Hache/Hache du rugissement de la liche draconique.webp",
      "7ds-armes/Lance/Lance du rugissement de la liche draconique.webp",
      "7ds-armes/Livre/Grimoire du rugissement de la liche draconique.webp",
      "7ds-armes/Nunchaku/Nunchaku du rugissement de la liche draconique.webp",
      "7ds-armes/Rapiere/Rapière du rugissement de la liche draconique.webp"
    ],
    /* LA SECONDE MOITIE DE LA PHRASE RESTE DEHORS, et elle est grosse : «
       augmente l'attaque a hauteur de la valeur de chances crit. qui depasse
       50 %. (Max : 30 %) ». Ce serait le premier bonus du depot DERIVE d'une
       autre statistique, et son ordre d'application n'est pas mesure : rien ne
       dit si les 20 % que ce meme passif vient de poser comptent dans
       l'excedent. L'ecart va jusqu'a vingt points d'attaque sur un build sous
       80 % de critique. Une mesure trancherait ; sans elle, on n'invente pas. */
    lignes:[
      {
        id:"liche-draconique-releve-critique",
        libelle:"Après une relève : chances crit. +20 % (10 s)",
        stat:"C_Critical_Rate",
        porteur:"hero",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[600, 1000, 1200, 1400, 1600, 1800, 2000],
        /* « les chances crit. de » et non « de chances crit. » : la seconde
           tournure apparait dans la clause derivee, juste apres. */
        provenance:{ phrase:"augmente les chances crit. de " }
      }
    ]
  },
  {
    /* Trois armes sans famille commune, mais un passif identique au mot pres.
       Elles sont donc une famille au sens de cette table : ce qui la definit
       est le texte partage, pas le nom de l'arme. */
    famille:"Tirage sur coup critique",
    armes:[
      "7ds-armes/Baguette/Baguette des vents tranchants.webp",
      "7ds-armes/Baton/Bâton de renforcement des nuages sombres.webp",
      "7ds-armes/Epee 1 main/Épée longue de la conviction corrompue.webp"
    ],
    lignes:[
      {
        id:"tirage-critique-degats-crit",
        /* Le jeu tire DEUX fois : une chance sur deux de declencher, puis
           « 50 % ou 10 % ». Cocher la case declare les deux tirages gagnes,
           comme pour noir de jais - la page ne joue pas aux des. */
        libelle:"Sur un critique, au mieux : dégâts crit. +50 % (sinon +10 %)",
        stat:"C_Critical_Dam_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[2600, 3000, 3400, 3800, 4200, 4600, 5000],
        provenance:{ phrase:"d'augmenter les dégâts crit. de " }
      }
    ]
  },
  {
    famille:"Attaques dans le dos",
    armes:[
      "7ds-armes/Epees doubles/Épées doubles de la rafale céleste.webp",
      "7ds-armes/Livre/Grimoire de la mélodie de la tentation.webp"
    ],
    lignes:[
      {
        id:"attaques-dans-le-dos-resistance-crit",
        libelle:"Attaque dans le dos : résistance crit. de la cible −40 %",
        /* La resistance critique decide si le coup critique PART ; la defense
           critique, de ce qu'il rapporte. Les confondre ferait payer deux fois
           le meme malus. Sans effet sur le mannequin, qui n'en a aucune. */
        effet:"resistanceCritique",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[1600, 2000, 2400, 2800, 3200, 3600, 4000],
        provenance:{ phrase:"réduisent la résistance crit. de " }
      }
    ]
  },
  {
    famille:"Lance de l'épine de la cupidité",
    armes:["7ds-armes/Lance/Lance de l'épine de la cupidité.webp"],
    lignes:[
      {
        id:"epine-cupidite-degats-sur-la-duree",
        libelle:"Cible sous dégâts sur la durée : dégâts +10 %",
        /* « Degats infliges AUX ENNEMIS qui... » : une propriete de la cible,
           donc le meme seau global qu'une vulnerabilite. Elle ne vise aucune
           categorie, ce qui est exactement la definition de cet effet. */
        effet:"vulnerabiliteGlobale",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[700, 750, 800, 850, 900, 950, 1000],
        provenance:{ phrase:"sur la durée de " }
      }
    ]
  },
  {
    famille:"Rapière du chant du chaos",
    armes:["7ds-armes/Rapiere/Rapière du chant du chaos.webp"],
    lignes:[
      {
        id:"chant-du-chaos-defense-reduite",
        libelle:"Cible ralentie : défense −40 %",
        /* La reduction de defense MULTIPLIE la defense de la cible, la ou le
           percement s'ajoute au rapport de mitigation. Deux mecaniques
           distinctes, et la difference est mesuree. */
        effet:"defense",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[1600, 2000, 2400, 2800, 3200, 3600, 4000],
        provenance:{ phrase:"réduit sa défense de " }
      }
    ]
  },
  {
    /* LES SEPT ARMES DE L'AME VORACE portent chacune un passif DIFFERENT,
       taille pour le personnage qui les equipe. Elles ne forment donc pas une
       famille au sens de cette table, et chacune a son entree. */
    famille:"Âme vorace — Baguette",
    armes:["7ds-armes/Baguette/Baguette de l'âme vorace.webp"],
    lignes:[
      {
        id:"baguette-ame-vorace-deluge-foudre",
        libelle:"Déluge de Foudre allié : dégâts de Foudre +20 % (20 s)",
        stat:"Thunder_Element_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[500, 1000, 1200, 1400, 1600, 1800, 2000],
        /* L'ancre porte « les degats de » : a partir du niveau 4, une premiere
           phrase parle de « l'efficacite de Deluge de Foudre de tous les heros
           allies de », qu'un texte plus court attraperait aussi. */
        provenance:{
          phrase:"les dégâts de Foudre de tous les héros alliés de "
        }
      },
      {
        id:"baguette-ame-vorace-attaque-speciale",
        libelle:"Cible à défense de Foudre réduite : attaque spéciale +100 %",
        /* Un bonus de CATEGORIE : il ne vaut que pour l'attaque speciale, donc
           il ne passe pas par les entrees communes mais par
           bonusCategorieDesBuffs, qui l'applique a sa seule ligne. */
        stat:"Activethird_Damadd_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[3000, 4500, 5500, 6500, 7500, 8500, 10000],
        provenance:{
          phrase:"augmente les dégâts d'attaque spéciale du héros de "
        }
      }
    ]
  },
  {
    famille:"Âme vorace — Épée et bouclier",
    armes:["7ds-armes/Bouclier/Épée et bouclier de l'âme vorace.webp"],
    lignes:[
      {
        id:"bouclier-ame-vorace-degats-terre",
        libelle:"Par boost d'ultime reçu : dégâts de Terre +4 %",
        stat:"Earth_Element_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[2200, 3450, 3900, 4350, 4800, 5250, 6000],
        parCumul:[200, 230, 260, 290, 320, 350, 400],
        cumuls:[11, 15, 15, 15, 15, 15, 15],
        provenance:{
          phrase:"pendant 10s. (Max : ",
          phraseCumul:"augmente les dégâts de Terre de "
        }
      }
    ]
  },
  {
    famille:"Âme vorace — Épée longue",
    armes:["7ds-armes/Epee 1 main/Épée longue de l'âme vorace.webp"],
    lignes:[
      {
        id:"epee-longue-ame-vorace-degats-tenebres",
        libelle:"Par compétence normale : dégâts des Ténèbres +18 %",
        stat:"Dark_Element_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[1800, 3150, 3600, 4050, 4500, 4950, 5400],
        parCumul:[900, 1050, 1200, 1350, 1500, 1650, 1800],
        cumuls:[2, 3, 3, 3, 3, 3, 3],
        provenance:{
          phrase:"pendant 7s. (Max : ",
          phraseCumul:"augmente les dégâts des Ténèbres de "
        }
      }
    ]
  },
  {
    famille:"Âme vorace — Hache",
    armes:["7ds-armes/Hache/Hache de l'âme vorace.webp"],
    lignes:[
      {
        id:"hache-ame-vorace-degats-feu",
        libelle:"Par boost de PV max reçu : dégâts de Feu +10,5 %",
        stat:"Fire_Element_Rate",
        operation:"add",
        unite:"ten-thousandths",
        niveaux:[3200, 5400, 6000, 6600, 7200, 7800, 8400],
        parCumul:[640, 675, 750, 825, 900, 975, 1050],
        cumuls:[5, 8, 8, 8, 8, 8, 8],
        provenance:{
          phrase:"pendant 15s. (Max : ",
          phraseCumul:"augmente les dégâts de Feu de "
        }
      }
    ]
  },
  {
    famille:"Âme vorace — Rapière",
    armes:["7ds-armes/Rapiere/Rapière de l'âme vorace.webp"],
    lignes:[
      {
        id:"rapiere-ame-vorace-degats-crit",
        libelle:"Attaque spéciale réussie : dégâts crit. +80 %",
        stat:"C_Critical_Dam_Rate",
        operation:"add",
        unite:"ten-thousandths",
        /* Le chiffre stagne aux trois premiers niveaux : c'est le texte du
           jeu, pas une transcription paresseuse. Le test le relit a chacun. */
        niveaux:[4000, 4000, 4000, 6000, 6500, 7000, 8000],
        provenance:{ phrase:"et les dégâts crit. de " }
      }
    ]
  },
  {
    famille:"Âme vorace — Grimoire",
    armes:["7ds-armes/Livre/Grimoire de l'âme vorace.webp"],
    lignes:[
      {
        id:"grimoire-ame-vorace-attaque-froid",
        libelle:"Après une compétence normale : attaque de Froid +50 % (20 s)",
        /* Un taux d'attaque D'UN SEUL element, la ou Barrage des Tenebres en
           porte un de TOUS. La difference n'est pas cosmetique : celui-ci ne
           majore pas l'attaque « tous elements ». C'est seauElementaireDeLaStat
           qui les separe, et le relevé de Merlin qui fonde la distinction. */
        stat:"Ice_Rate",
        operation:"add",
        unite:"ten-thousandths",
        /* Le chiffre plafonne des le niveau 4 : c'est le texte du jeu. */
        niveaux:[2600, 3800, 4400, 5000, 5000, 5000, 5000],
        provenance:{ phrase:"augmente l'attaque de Froid de " }
      }
    ]
  },
  {
    famille:"Âme vorace — Gantelets",
    armes:["7ds-armes/Gantelets/Gantelets de l'âme vorace.webp"],
    lignes:[
      {
        /* `AllElement_Rate` semble contredire la prose « attaque des
           Tenebres ». Les releves de Derieri tranchent : le bonus majore aussi
           « tous elements ». C'est donc un taux sur toute l'attaque
           elementaire, jamais un bonus de degats.
           La seconde phrase de ce passif ajoute elle aussi un « (Max : » a
           partir du niveau 4. L'ancre du plafond contient donc « pendant 5s. »
           pour ne designer que l'effet d'attaque. */
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
  }
];
