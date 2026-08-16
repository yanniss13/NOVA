// Les DEGATS que certains potentiels ajoutent a une competence.
//
//   « La derniere frappe d'une competence normale inflige des degats
//     supplementaires egaux a 220% de l'attaque. »   (meliodas, Epee 1 main, T7)
//
// MAINTENU A LA MAIN, comme buffs-supports.js, passifs-graves.js et
// potentiels-equipe.js. Sa structure a ete echafaudee une fois par un script
// jete apres usage ; aucun script ne le rejoue, aucun ne doit le citer, et
// c'est le test qui le tient.
//
// POURQUOI CE FICHIER EXISTE. Ces degats n'etaient nulle part. Ni dans le
// coefficient de la competence - le catalogue publie 286 % pour l'Attaque
// enchainee de Meliodas, pas 506 % - ni dans l'instantane chiffre du palier,
// qui ne porte que des STATISTIQUES. Un membre au palier 7 voyait donc un
// chiffre amputé de 220 % d'ATK sur une competence qui en vaut 286 : presque
// la moitie de la frappe manquait.
//
// Cle : personnage -> ARME -> PALIER, comme potentiels-equipe.js, et pour les
// memes raisons - trois branches distinctes, une seule en main, et un palier
// que le roster stocke. Les paliers sont CUMULATIFS.
//
// CE QUE CES DEGATS TRAVERSENT, et c'est un CHOIX, pas une mesure :
//   ils deviennent une COMPOSANTE de plus sur la competence de leur categorie,
//   donc ils recoivent le bonus de categorie, le critique et la mitigation,
//   exactement comme le reste de cette competence.
//
//   Ce que ce choix suppose : que « des degats supplementaires » infliges par
//   la derniere frappe d'une competence appartiennent a cette frappe. C'est ce
//   que le texte dit, et le moteur n'a aucun autre endroit ou les poser qui ne
//   serait pas une supposition plus forte. L'outil de reference ne tranche
//   pas : il n'expose aucun champ de degats supplementaires.
//
//   Consequence a garder en tete : sur un build a +115 % de competence normale
//   et 200 % de degats critiques, ces 220 % ne valent pas 220 % du chiffre
//   final. Ils sont multiplies comme le reste.
//
// categorie   : la competence que ces degats accompagnent, parmi les cinq du
//               catalogue. Une ligne d'une autre categorie ne la touche pas.
// pourcentage : le total, en pourcentage de l'ATK. Quand la source publie une
//               REPETITION - « 40% de l'attaque 5 fois » - la ligne porte
//               `pas` et `repetitions`, et un test verifie que le total vaut
//               leur produit : un maximum qui se calcule ne se pose pas de
//               tete.
// condition   : absente, les degats sont TOUJOURS la et s'appliquent seuls ;
//               presente, ils demandent une case a cocher, selon la meme regle
//               que partout ailleurs - cocher, c'est declarer sa condition
//               remplie.
// coups       : LE COUP RECOPIE. « Ajoute 1 coup a la 2e frappe de la
// frappeCopiee  competence normale ; ce coup inflige les memes degats que la
//               2e frappe. » Le palier ne chiffre rien - il DESIGNE une frappe
//               dont le catalogue publie le coefficient. La ligne porte donc
//               le nombre de coups ajoutes, la frappe recopiee (`gameId` et
//               `rang`), et un test refait le produit contre la repartition
//               par coup de data/wiki-competences.js.
//
//               C'est une troisieme forme, apres le total sec et la
//               repetition, et elle existe parce que le nombre a stocker vit
//               dans deux textes a la fois : le compte de coups dans le
//               palier, le coefficient dans la competence.
//
// LA REGLE DE TRANSCRIPTION, la meme que pour les tenues et les potentiels :
// `provenance.phrase` est choisie pour que le nombre qui la suit soit la
// valeur stockee, et elle doit apparaitre exactement UNE fois dans le texte du
// palier. data/potentiels.js n'emploie pas d'espace insecable, donc les
// phrases citees ici s'ecrivent avec des espaces ordinaires. Pour un coup
// recopie, ce nombre est le COMPTE DE COUPS, jamais le pourcentage.
//
// CE QUI N'Y FIGURE PAS. Trois lignes disent « chaque coup » sans publier le
// nombre de coups, et leur total en depend :
//   klotho Rapiere T10   « Chaque coup de l'attaque ultime inflige … 33% »
//   howzer Gantelets T10 « Chaque coup porte avec la competence normale … 65% »
//   merlin Baton T9      « Les meteores de l'attaque ultime infligent … 150% »
// Le catalogue de competences publie parfois la repartition par coup, parfois
// non ; s'en servir la ou elle existe et deviner ailleurs donnerait deux
// regimes pour une meme table. Elles reviendront le jour ou le nombre de coups
// sera connu partout.
//
// DEUX AUTRES ABSENTES, pour une raison differente : derieri Gantelets T10
// ajoute un coup a la 2e frappe de l'attaque speciale et deux a la 3e, soit
// +432 % sur Ruee sauvage. La competence qu'elles augmentent n'a AUCUN
// coefficient dans data/competences.js - le generateur la classe
// « non-chiffree » - donc la page l'exclut deja du calcul. Les poser ici ne
// changerait pas un chiffre : une composante s'ajoute a une base qui n'existe
// pas, et le total reste nul. Elles attendent que Ruee sauvage soit chiffree,
// ce qui se joue dans scripts/generate-competences.py, pas dans cette table.
window.SEVEN_DS_DEGATS_SUPPLEMENTAIRES = {
  "bug": {
    "Epees doubles": {
      "10": [
        {
          id:"bug-epees-doubles-t10-supplement",
          libelle:"Dégâts supplémentaires sur attaque spéciale : +100 % de l'ATK",
          categorie:"ACTIVE_THIRD",
          pourcentage:100,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "derieri": {
    "Epee 2 mains": {
      "5": [
        {
          id:"derieri-epee-2-mains-t5-supplement",
          libelle:"Dégâts supplémentaires sur attaque spéciale : +120 % de l'ATK",
          categorie:"ACTIVE_THIRD",
          pourcentage:120,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ],
      "7": [
        {
          id:"derieri-epee-2-mains-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +40 % × 5 de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:200,
          pas:40,
          repetitions:5,
          /* Ancrages refaits le 16/08/2026. La phrase du 15 aout coupe l'effet
             en deux : « inflige des degats supplementaires 5 fois … Chaque coup
             supplementaire inflige des degats egaux a 40% de l'attaque. »
             Avant, un seul membre portait les deux nombres (« egaux a 40% de
             l'attaque 5 fois »), d'ou l'ancien `phraseRepetitions` qui lisait le
             compte juste apres le pourcentage. Les deux valeurs, 40 et 5, sont
             inchangees ; seul l'endroit ou les lire a bouge. */
          provenance:{
            phrase:"Chaque coup supplémentaire inflige des dégâts égaux à ",
            phraseRepetitions:"inflige des dégâts supplémentaires "
          }
        }
      ]
    },
    "Gantelets": {
      "7": [
        {
          /* Le seul coup RECOPIE de la table. Le palier ne chiffre rien : il
             renvoie a la 2e frappe d'Assaut fulgurant, que le catalogue
             publie a 315 %. La competence passe donc de 501 % a 816 %.

             A savoir, et volontairement non corrige ici : la mesure sur le
             mannequin donne 316,7 % pour cette 2e frappe, pas 315. L'ecart de
             0,5 % est deja dans le coefficient de base, qu'on n'a pas retouche
             non plus - le recopier tel quel garde la table coherente avec le
             catalogue qu'elle cite. */
          id:"derieri-gantelets-t7-coup-ajoute",
          libelle:"Compétence normale : 1 coup de plus, copie de la 2e frappe "
            + "(+315 % de l'ATK)",
          categorie:"NORMAL_SKILL",
          pourcentage:315,
          coups:1,
          frappeCopiee:{ gameId:"derieri_gauntlets_skill_e_1", rang:2 },
          provenance:{ phrase:"Ajoute " }
        }
      ]
    },
    "Hache": {
      "7": [
        {
          id:"derieri-hache-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +220 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:220,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "diane": {
    "Gantelets": {
      "7": [
        {
          id:"diane-gantelets-t7-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +270 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:270,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Nunchaku": {
      "5": [
        {
          id:"diane-nunchaku-t5-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +45 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:45,
          condition:"Ennemis situés dans la zone centrale",
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "drake": {
    "Epee 2 mains": {
      "10": [
        {
          id:"drake-epee-2-mains-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +180 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:180,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "dreyfus": {
    "Lance": {
      "10": [
        {
          id:"dreyfus-lance-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +150 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:150,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "elaine": {
    "Baguette": {
      "7": [
        {
          id:"elaine-baguette-t7-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +260 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:260,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "escanor": {
    "Epee 2 mains": {
      "10": [
        {
          id:"escanor-epee-2-mains-t10-supplement",
          libelle:"Dégâts supplémentaires sur attaque spéciale : +85 % de l'ATK",
          categorie:"ACTIVE_THIRD",
          pourcentage:85,
          condition:"Attaque spéciale améliorée",
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "gowther": {
    "Baguette": {
      "7": [
        {
          id:"gowther-baguette-t7-supplement",
          libelle:"Dégâts supplémentaires sur attaque spéciale : +100 % de l'ATK",
          categorie:"ACTIVE_THIRD",
          pourcentage:100,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ],
      "10": [
        {
          id:"gowther-baguette-t10-supplement",
          libelle:"Dégâts supplémentaires sur attaque spéciale : +325 % de l'ATK",
          categorie:"ACTIVE_THIRD",
          pourcentage:325,
          condition:"Attaque spéciale complètement chargée",
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "griamore": {
    "Gantelets": {
      "10": [
        {
          id:"griamore-gantelets-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +120 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:120,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "howzer": {
    "Gantelets": {
      "5": [
        {
          id:"howzer-gantelets-t5-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +187 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:187,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Lance": {
      "5": [
        {
          id:"howzer-lance-t5-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +170 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:170,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ],
      "10": [
        {
          id:"howzer-lance-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +225 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:225,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Nunchaku": {
      "5": [
        {
          id:"howzer-nunchaku-t5-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +160 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:160,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "klotho": {
    "Baton": {
      "7": [
        {
          id:"klotho-baton-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +180 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:180,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "manny": {
    "Epee 1 main": {
      "7": [
        {
          id:"manny-epee-1-main-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +50 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:50,
          condition:"Disparition d'une attaque d'épée de Frappe de givre",
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "meliodas": {
    "Epee 1 main": {
      "7": [
        {
          id:"meliodas-epee-1-main-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +220 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:220,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ],
      "10": [
        {
          id:"meliodas-epee-1-main-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +350 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:350,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Epees doubles": {
      "7": [
        {
          id:"meliodas-epees-doubles-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +220 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:220,
          condition:"Pouvoir démoniaque actif",
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ],
      "10": [
        {
          id:"meliodas-epees-doubles-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +300 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:300,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Hache": {
      "7": [
        {
          id:"meliodas-hache-t7-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +160 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:160,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "slader": {
    "Epee 2 mains": {
      "10": [
        {
          id:"slader-epee-2-mains-t10-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +120 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:120,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Hache": {
      "5": [
        {
          id:"slader-hache-t5-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +55 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:55,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    },
    "Nunchaku": {
      "10": [
        {
          id:"slader-nunchaku-t10-supplement",
          libelle:"Dégâts supplémentaires sur compétence normale : +80 % de l'ATK",
          categorie:"NORMAL_SKILL",
          pourcentage:80,
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  },
  "tristan": {
    "Epee 2 mains": {
      "5": [
        {
          id:"tristan-epee-2-mains-t5-supplement",
          libelle:"Dégâts supplémentaires sur ultime : +105 % de l'ATK",
          categorie:"ULTIMATE",
          pourcentage:105,
          condition:"Attaque ultime complètement chargée",
          provenance:{
            phrase:"dégâts supplémentaires égaux à "
          }
        }
      ]
    }
  }
};
