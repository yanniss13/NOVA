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
//     plutot que de dependre de ce qu'un editeur aura insere.
//
// niveaux : les trois valeurs, du niveau 1 au niveau 3, en dix-milliemes.
// cible   : "soi"     le passif ne profite qu'a celui qui porte la tenue ;
//           "allies"  il profite a l'equipe ENTIERE, porteur compris. Les
//                     malus infliges a l'ENNEMI portent "allies" : quiconque
//                     frappe cette cible en beneficie.
// element : null, ou l'attribut vise quand le buff ne concerne que lui.
//
// CE QUI N'Y FIGURE PAS, ET POURQUOI. Sur les 68 tenues, 28 n'ont aucun effet
// offensif - barrieres, soins, recharges, jauges, deplacement - et 14 buffent
// l'equipe, lot suivant. Restaient 26 passifs offensifs pour leur porteur.
// DIX-SEPT sont transcrits ici. Les NEUF autres ne le sont pas, et il vaut
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
//   Le Serpent de l'Envie (diane)   son plafond s'ecrit « (… : 56%, 24%) », et
//     le 24 ne suit aucune phrase STABLE d'un niveau a l'autre : la garde
//     refuse une valeur qu'on ne peut pas designer sans ambiguite. C'est
//     exactement son role.
//   Lumiere de guidance (elaine)   « augmente l'attaque de Vent de 16% » : un
//     POURCENTAGE, quand le seau `Wind_Add` du moteur est une valeur plate.
//   Retour du Chevalier Sacre (hendrickson), Resistance et revolution
//     (derieri), Tenue modeste (dreyfus)   des degats critiques ou
//     elementaires restreints a UNE categorie de competence. Le moteur porte
//     les deux notions separement, jamais croisees.
//   Tenue de fete legere (klotho)   des degats de proc, sans effet sur les
//     statistiques.
//
// Ces neuf reviendront le jour ou le moteur portera le seau qui leur manque.
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
  ]
};
