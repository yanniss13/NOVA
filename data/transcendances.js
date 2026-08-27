// Les transcendances : les passifs de Limit Break de chaque heros.
//
// GENERE — ne pas editer a la main :
//     node outils/fmodel/extraire-transcendances.js
//
// La source n'est ni 7dsorigin.app ni SevenCodex, qui ne les publient pas,
// mais l'extraction locale du client (FModel). La CI ne peut donc PAS
// regenerer ce fichier : le commit fait foi, comme pour data/competences.js.
// A refaire apres chaque nouvel export du jeu.
//
// Cle = slug du personnage, celui de personnages-meta.js.
// Trois transcendances par heros, dans l'ordre du jeu.
//
// Le champ « tenue » est la tenue gravee qui donne la transcendance, sous la
// cle de engravedByFile (data/stats-build.js). Elle n'est ACTIVE QUE SI CETTE
// TENUE EST PORTEE, et une fois la piece promue au palier « promotion ».
// Sans ce lien, le catalogue ne serait qu'un texte a lire.
//
// Les valeurs sont deja substituees dans les descriptions : le jeu les tient
// a part du gabarit, et un « {0} » survivant serait une substitution manquee.
// tests/transcendances-catalogue.test.js le refuse.
window.SEVEN_DS_TRANSCENDANCES = {
  "ban":[
    { id:"eplb_ban_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Cuisinier remplaçant.webp", promotion:3, arme:"Cudgel3c",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_ban_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Le Renard de l'Avarice.webp", promotion:3, arme:"Sword2h",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_ban_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts des Ténèbres de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Maraudeur décontracté.webp", promotion:3, arme:"Gauntlets" }
  ],
  "bug":[
    { id:"eplb_bug_b", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Marche des ombres.webp", promotion:3, arme:"Axe",
      regle:{ cible:"special", valeur:5000, phrase:"Augmente les dégâts d'attaque spéciale de " } },
    { id:"eplb_bug_c", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Furtivité du démon.webp", promotion:3, arme:"SwordDual",
      regle:{ cible:"special", valeur:5000, phrase:"Augmente les dégâts d'attaque spéciale de " } },
    { id:"eplb_bug_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts des Ténèbres de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Instinct incisif.webp", promotion:3, arme:"Book" }
  ],
  "daisy":[
    { id:"eplb_daisy_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Petite exploratrice.webp", promotion:3, arme:"Shield",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_daisy_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Souffle d'exploration.webp", promotion:3, arme:"Book" },
    { id:"eplb_daisy_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Robe de printemps.webp", promotion:3, arme:"Wand" }
  ],
  "derieri":[
    { id:"eplb_derieri_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Résistance et révolution.webp", promotion:3, arme:"Gauntlets",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_derieri_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Courtoisie minimale.webp", promotion:3, arme:"Sword2h" },
    { id:"eplb_derieri_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts des Ténèbres de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Mouvement rebelle.webp", promotion:3, arme:"Axe" }
  ],
  "diane":[
    { id:"eplb_diane_b", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Le Serpent de l'Envie.webp", promotion:3, arme:"Axe",
      regle:{ cible:"special", valeur:5000, phrase:"Augmente les dégâts d'attaque spéciale de " } },
    { id:"eplb_diane_c", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Terre de tous les héros alliés de 15%.",
      tenue:"7ds-armures-ssr/Armure liee/Fille enjouée.webp", promotion:3, arme:"Gauntlets" },
    { id:"eplb_diane_d", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 30% de la défense.",
      tenue:"7ds-armures-ssr/Armure liee/Tenue de combat cloutée.webp", promotion:3, arme:"Cudgel3c" }
  ],
  "drake":[
    { id:"eplb_drake_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Gloire du passé.webp", promotion:3, arme:"Sword2h",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_drake_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Seigneur des ombres.webp", promotion:3, arme:"Staff" },
    { id:"eplb_drake_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier impérial.webp", promotion:3, arme:"Sword1h" }
  ],
  "dreydrin":[
    { id:"eplb_dreydrin_b", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Ascendance royale.webp", promotion:3, arme:"Shield" },
    { id:"eplb_dreydrin_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts physiques de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Préparation minutieuse.webp", promotion:3, arme:"Axe" },
    { id:"eplb_dreydrin_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts du Sacré de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Défense solide.webp", promotion:3, arme:"Rapier" }
  ],
  "dreyfus":[
    { id:"eplb_dreyfus_b", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Honneur au vieux soldat.webp", promotion:3, arme:"Rapier" },
    { id:"eplb_dreyfus_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Tenue modeste.webp", promotion:3, arme:"Sword1h",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_dreyfus_d", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier honorable.webp", promotion:3, arme:"Lance",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } }
  ],
  "elaine":[
    { id:"eplb_elaine_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Lumière de guidance.webp", promotion:3, arme:"Wand",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_elaine_c", nom:"Transcendance explosive : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Sortie joyeuse.webp", promotion:3, arme:"Staff" },
    { id:"eplb_elaine_d", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Dignité de la sainte.webp", promotion:3, arme:"Book" }
  ],
  "elizabeth":[
    { id:"eplb_elizabeth_b", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 30% de la défense.",
      tenue:"7ds-armures-ssr/Armure liee/Vedette de la taverne.webp", promotion:3, arme:"Book" },
    { id:"eplb_elizabeth_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Héros de Liones.webp", promotion:3, arme:"Staff" },
    { id:"eplb_elizabeth_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Terre de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Lumière de Liones.webp", promotion:3, arme:"Wand" }
  ],
  "escanor":[
    { id:"eplb_escanor_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Violence nordique.webp", promotion:3, arme:"Axe",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_escanor_c", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Arrogance adéquate.webp", promotion:3, arme:"Sword2h",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_escanor_d", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Dignité dorée.webp", promotion:3, arme:"Shield" }
  ],
  "gil-thunder":[
    { id:"eplb_gilthunder_b", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Foudre de tous les héros alliés de 15%.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier sacré de la foudre.webp", promotion:3, arme:"Sword1h" },
    { id:"eplb_gilthunder_c", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Aventure exemplaire.webp", promotion:3, arme:"Shield" },
    { id:"eplb_gilthunder_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier sacré prometteur.webp", promotion:3, arme:"Lance",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } }
  ],
  "gowther":[
    { id:"eplb_gowther_b", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Tenue de soirée pour un rendez-vous secret.webp", promotion:3, arme:"Wand" },
    { id:"eplb_gowther_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Le Bélier de la Luxure.webp", promotion:3, arme:"Book" },
    { id:"eplb_gowther_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Défense minimale.webp", promotion:3, arme:"Staff" }
  ],
  "griamore":[
    { id:"eplb_griamore_b", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier sacré du mur de fer.webp", promotion:3, arme:"Shield" },
    { id:"eplb_griamore_c", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Barricade de fortune.webp", promotion:3, arme:"Cudgel3c",
      regle:{ cible:"special", valeur:5000, phrase:"Augmente les dégâts d'attaque spéciale de " } },
    { id:"eplb_griamore_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts physiques de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Forteresse de fer impénétrable.webp", promotion:3, arme:"Gauntlets" }
  ],
  "guila":[
    { id:"eplb_guila_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier sacré des explosions.webp", promotion:3, arme:"Lance",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_guila_c", nom:"Transcendance protectrice : Airain", texte:"Lorsqu'un héros allié subit une défense crit. ennemie, 20% de chances d'augmenter la résistance crit. et la défense crit. de tous les héros alliés de 30% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Pas légers.webp", promotion:3, arme:"Shield" },
    { id:"eplb_guila_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Piste de la flamme cramoisie.webp", promotion:3, arme:"Rapier" }
  ],
  "hendrickson":[
    { id:"eplb_hendrickson_b", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 60% de l'attaque.",
      tenue:"7ds-armures-ssr/Armure liee/Une tenue de jeunesse.webp", promotion:3, arme:"Sword1h" },
    { id:"eplb_hendrickson_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Vêtements de travail de l'apothicaire.webp", promotion:3, arme:"SwordDual",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_hendrickson_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Retour du Chevalier Sacré.webp", promotion:3, arme:"Lance",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } }
  ],
  "howzer":[
    { id:"eplb_howzer_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier sacré de la tempête.webp", promotion:3, arme:"Lance",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_howzer_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Aventure en toute sécurité.webp", promotion:3, arme:"Gauntlets" },
    { id:"eplb_howzer_d", nom:"Transcendance protectrice : Airain", texte:"Lorsqu'un héros allié subit une défense crit. ennemie, 20% de chances d'augmenter la résistance crit. et la défense crit. de tous les héros alliés de 30% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Dignité du capitaine.webp", promotion:3, arme:"Cudgel3c" }
  ],
  "jericho":[
    { id:"eplb_jericho_b", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Froid de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Chevalier sacré à la visière en étoile.webp", promotion:3, arme:"SwordDual" },
    { id:"eplb_jericho_c", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/Voyageuse cachottière.webp", promotion:3, arme:"Lance" },
    { id:"eplb_jericho_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Traces de souvenirs.webp", promotion:3, arme:"Rapier",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } }
  ],
  "king":[
    { id:"eplb_king_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Le Grizzly de la Paresse.webp", promotion:3, arme:"Staff",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_king_c", nom:"Transcendance protectrice : Airain", texte:"Lorsqu'un héros allié subit une défense crit. ennemie, 20% de chances d'augmenter la résistance crit. et la défense crit. de tous les héros alliés de 30% pendant 20 s.",
      tenue:"7ds-armures-ssr/Armure liee/L'ombre de la forêt profonde.webp", promotion:3, arme:"Book" },
    { id:"eplb_king_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Terre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Ombre du roi des fées.webp", promotion:3, arme:"Wand" }
  ],
  "klotho":[
    { id:"eplb_klotho_b", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Tenue de fête légère.webp", promotion:3, arme:"Rapier" },
    { id:"eplb_klotho_c", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 60% de l'attaque.",
      tenue:"7ds-armures-ssr/Armure liee/Formalité de l'érudite en chef.webp", promotion:3, arme:"Book" },
    { id:"eplb_klotho_d", nom:"Transcendance de puissance : Frappe rapide", texte:"Augmente les dégâts d'attaque normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Tenue d'exercice d'exploratrice.webp", promotion:3, arme:"Staff",
      regle:{ cible:"normal", valeur:5000, phrase:"Augmente les dégâts d'attaque normale de " } }
  ],
  "manny":[
    { id:"eplb_manny_b", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Prestige de l'archiprêtresse.webp", promotion:3, arme:"Staff" },
    { id:"eplb_manny_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Froid de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Exploration de l'inconnu.webp", promotion:3, arme:"SwordDual" },
    { id:"eplb_manny_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Rituel sacré.webp", promotion:3, arme:"Sword1h",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } }
  ],
  "meliodas":[
    { id:"eplb_meliodas_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Une nouvelle aventure.webp", promotion:3, arme:"Sword1h",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_meliodas_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Défense simple.webp", promotion:3, arme:"Axe",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_meliodas_d", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Majesté bien malveillante.webp", promotion:3, arme:"SwordDual",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } }
  ],
  "merlin":[
    { id:"eplb_merlin_b", nom:"Transcendance de puissance : Synergie", texte:"Augmente les dégâts de compétence de relève de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Vêtements formels légers.webp", promotion:3, arme:"Book",
      regle:{ cible:"tag-skill", valeur:5000, phrase:"Augmente les dégâts de compétence de relève de " } },
    { id:"eplb_merlin_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Le Sanglier de la Gourmandise.webp", promotion:3, arme:"Wand",
      regle:{ cible:"normal-skill", valeur:5000, phrase:"Augmente les dégâts de compétence normale de " } },
    { id:"eplb_merlin_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché.",
      tenue:"7ds-armures-ssr/Armure liee/Chercheuse de savoir.webp", promotion:3, arme:"Staff" }
  ],
  "slader":[
    { id:"eplb_slader_b", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Épée du vieux roi.webp", promotion:3, arme:"Sword2h",
      regle:{ cible:"special", valeur:5000, phrase:"Augmente les dégâts d'attaque spéciale de " } },
    { id:"eplb_slader_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Mission secrète.webp", promotion:3, arme:"Axe" },
    { id:"eplb_slader_d", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de tous les éléments de tous les héros alliés de 12%.",
      tenue:"7ds-armures-ssr/Armure liee/Préparation totale.webp", promotion:3, arme:"Cudgel3c" }
  ],
  "tioreh":[
    { id:"eplb_tioreh_b", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Fille de la forêt et de la terre.webp", promotion:3, arme:"Book" },
    { id:"eplb_tioreh_c", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 60% de l'attaque.",
      tenue:"7ds-armures-ssr/Armure liee/Début de l'aventure.webp", promotion:3, arme:"Wand" },
    { id:"eplb_tioreh_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Terre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève.",
      tenue:"7ds-armures-ssr/Armure liee/Protection de la fée.webp", promotion:3, arme:"Staff" }
  ],
  "tristan":[
    { id:"eplb_tristan_b", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Feu de tous les héros alliés de 15%.",
      tenue:"7ds-armures-ssr/Armure liee/Dignité royale.webp", promotion:3, arme:"SwordDual" },
    { id:"eplb_tristan_c", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%.",
      tenue:"7ds-armures-ssr/Armure liee/Aventure du prince.webp", promotion:3, arme:"Sword2h",
      regle:{ cible:"ultimate", valeur:5000, phrase:"Augmente les dégâts d'attaque ultime de " } },
    { id:"eplb_tristan_d", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Vent de tous les héros alliés de 15%.",
      tenue:"7ds-armures-ssr/Armure liee/Vœu du prince.webp", promotion:3, arme:"Sword1h" }
  ]
};
