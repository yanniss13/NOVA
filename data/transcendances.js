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
// Les valeurs sont deja substituees dans les descriptions : le jeu les tient
// a part du gabarit, et un « {0} » survivant serait une substitution manquee.
// tests/transcendances-catalogue.test.js le refuse.
window.SEVEN_DS_TRANSCENDANCES = {
  "ban":[
    { id:"eplb_ban_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_ban_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_ban_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts des Ténèbres de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." }
  ],
  "bug":[
    { id:"eplb_bug_b", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%." },
    { id:"eplb_bug_c", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%." },
    { id:"eplb_bug_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts des Ténèbres de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "daisy":[
    { id:"eplb_daisy_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_daisy_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_daisy_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "derieri":[
    { id:"eplb_derieri_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_derieri_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_derieri_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts des Ténèbres de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "diane":[
    { id:"eplb_diane_b", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%." },
    { id:"eplb_diane_c", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Terre de tous les héros alliés de 15%." },
    { id:"eplb_diane_d", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 30% de la défense." }
  ],
  "drake":[
    { id:"eplb_drake_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_drake_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_drake_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." }
  ],
  "dreydrin":[
    { id:"eplb_dreydrin_b", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s." },
    { id:"eplb_dreydrin_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts physiques de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_dreydrin_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts du Sacré de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "dreyfus":[
    { id:"eplb_dreyfus_b", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_dreyfus_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_dreyfus_d", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." }
  ],
  "elaine":[
    { id:"eplb_elaine_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_elaine_c", nom:"Transcendance explosive : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 30 s lorsqu'un Déluge est déclenché." },
    { id:"eplb_elaine_d", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s." }
  ],
  "elizabeth":[
    { id:"eplb_elizabeth_b", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 30% de la défense." },
    { id:"eplb_elizabeth_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_elizabeth_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Terre de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." }
  ],
  "escanor":[
    { id:"eplb_escanor_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_escanor_c", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_escanor_d", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s." }
  ],
  "gil-thunder":[
    { id:"eplb_gilthunder_b", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Foudre de tous les héros alliés de 15%." },
    { id:"eplb_gilthunder_c", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s." },
    { id:"eplb_gilthunder_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." }
  ],
  "gowther":[
    { id:"eplb_gowther_b", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." },
    { id:"eplb_gowther_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_gowther_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Foudre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "griamore":[
    { id:"eplb_griamore_b", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s." },
    { id:"eplb_griamore_c", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%." },
    { id:"eplb_griamore_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts physiques de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "guila":[
    { id:"eplb_guila_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_guila_c", nom:"Transcendance protectrice : Airain", texte:"Lorsqu'un héros allié subit une défense crit. ennemie, 20% de chances d'augmenter la résistance crit. et la défense crit. de tous les héros alliés de 30% pendant 20 s." },
    { id:"eplb_guila_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." }
  ],
  "hendrickson":[
    { id:"eplb_hendrickson_b", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 60% de l'attaque." },
    { id:"eplb_hendrickson_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_hendrickson_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." }
  ],
  "howzer":[
    { id:"eplb_howzer_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_howzer_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_howzer_d", nom:"Transcendance protectrice : Airain", texte:"Lorsqu'un héros allié subit une défense crit. ennemie, 20% de chances d'augmenter la résistance crit. et la défense crit. de tous les héros alliés de 30% pendant 20 s." }
  ],
  "jericho":[
    { id:"eplb_jericho_b", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Froid de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." },
    { id:"eplb_jericho_c", nom:"Transcendance protectrice : Résistance", texte:"Lorsqu'un héros allié subit une attaque ennemie, 20% de chances d'augmenter la résistance élémentaire de tous les héros alliés correspondant à l'attaque subie de 15% pendant 20 s." },
    { id:"eplb_jericho_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." }
  ],
  "king":[
    { id:"eplb_king_b", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_king_c", nom:"Transcendance protectrice : Airain", texte:"Lorsqu'un héros allié subit une défense crit. ennemie, 20% de chances d'augmenter la résistance crit. et la défense crit. de tous les héros alliés de 30% pendant 20 s." },
    { id:"eplb_king_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Terre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "klotho":[
    { id:"eplb_klotho_b", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Vent de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." },
    { id:"eplb_klotho_c", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 60% de l'attaque." },
    { id:"eplb_klotho_d", nom:"Transcendance de puissance : Frappe rapide", texte:"Augmente les dégâts d'attaque normale de 50%." }
  ],
  "manny":[
    { id:"eplb_manny_b", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_manny_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Froid de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_manny_d", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." }
  ],
  "meliodas":[
    { id:"eplb_meliodas_b", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_meliodas_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_meliodas_d", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." }
  ],
  "merlin":[
    { id:"eplb_merlin_b", nom:"Transcendance de puissance : Synergie", texte:"Augmente les dégâts de compétence de relève de 50%." },
    { id:"eplb_merlin_c", nom:"Transcendance de puissance : Technique", texte:"Augmente les dégâts de compétence normale de 50%." },
    { id:"eplb_merlin_d", nom:"Transcendance explosive : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 30 s lorsqu'un Déluge est déclenché." }
  ],
  "slader":[
    { id:"eplb_slader_b", nom:"Transcendance de puissance : Frappe lourde", texte:"Augmente les dégâts d'attaque spéciale de 50%." },
    { id:"eplb_slader_c", nom:"Transcendance de soutien : Amélioration", texte:"Augmente tous les dégâts élémentaires de tous les héros alliés de 25% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_slader_d", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de tous les éléments de tous les héros alliés de 12%." }
  ],
  "tioreh":[
    { id:"eplb_tioreh_b", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Feu de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." },
    { id:"eplb_tioreh_c", nom:"Transcendance protectrice : Récupération", texte:"Lorsqu'un héros allié subit une attaque ennemie, 5% de chances de restaurer les PV à hauteur de 60% de l'attaque." },
    { id:"eplb_tioreh_d", nom:"Transcendance de soutien : Amélioration", texte:"Augmente les dégâts de Terre de tous les héros alliés de 30% pendant 10 s lorsqu'un héros allié utilise une compétence de relève." }
  ],
  "tristan":[
    { id:"eplb_tristan_b", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Feu de tous les héros alliés de 15%." },
    { id:"eplb_tristan_c", nom:"Transcendance de puissance : Frappe mortelle", texte:"Augmente les dégâts d'attaque ultime de 50%." },
    { id:"eplb_tristan_d", nom:"Transcendance explosive : Amplification", texte:"Augmente l'efficacité de Déluge de Vent de tous les héros alliés de 15%." }
  ]
};
