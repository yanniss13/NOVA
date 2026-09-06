"use strict";

window.NOVA_MAQUETTE = Object.freeze({
  navigation:["Notre guilde", "Équipes", "Roster", "Outils"],
  bossTabs:["Vue d'ensemble", "Équipes", "Disponibilités", "Groupes", "Rapports"],
  team:{
    name:"Akumu — équipe Foudre",
    heroes:["Méliodas", "Merlin", "Diane", "King"]
  },
  roster:{ modes:["Mon roster", "Roster des membres"] },
  tools:["Wiki", "Collection", "Calculateur", "Analyse"],
  week:{ label:"Semaine du 7 au 13 septembre", reset:"Lundi à 9 h", boss:"Akumu — Souverain cupide" },
  dashboardActions:[
    { state:"Équipe manquante", title:"Groupe 2 · jeudi 21 h", copy:"Choisis une de tes équipes avant la fermeture du groupe.", action:"Ouvrir le groupe", tone:"urgent" },
    { state:"À rejoindre", title:"Groupe 4 · samedi 20 h", copy:"Trois membres sont déjà disponibles sur ce créneau.", action:"Voir la session", tone:"normal" },
    { state:"Rapport prêt", title:"Groupe 1 · terminé", copy:"1 284 500 points enregistrés par cinq membres.", action:"Voir le rapport", tone:"done" },
    { state:"Roster incomplet", title:"Merlin · Grimoire", copy:"La ceinture et le collier restent à configurer.", action:"Compléter le build", tone:"normal" }
  ],
  boss:{
    teams:[
      { id:"team-1", owner:"YanniSs13", name:"Foudre — contrôle", heroes:["Méliodas", "Merlin", "Diane", "King"] },
      { id:"team-2", owner:"Elaine", name:"Burst critique", heroes:["Escanor", "Gowther", "Diane", "Merlin"] },
      { id:"team-3", owner:"Ban", name:"Brise-garde", heroes:["Ban", "King", "Jericho", "Elizabeth"] }
    ],
    availability:[
      { day:"Lun", slots:[1,2,3,4,3,1] }, { day:"Mar", slots:[0,1,2,3,2,1] },
      { day:"Mer", slots:[1,2,4,5,4,2] }, { day:"Jeu", slots:[0,2,4,6,5,3] },
      { day:"Ven", slots:[1,3,5,7,6,4] }, { day:"Sam", slots:[2,4,6,8,7,5] },
      { day:"Dim", slots:[2,3,5,6,5,3] }
    ],
    groups:[
      { id:"group-1", title:"Groupe 1", when:"Mercredi · 20 h 30", status:"Terminé", members:["Merlin","Elaine","Ban","King","Diane"] },
      { id:"group-2", title:"Groupe 2", when:"Jeudi · 21 h", status:"Équipe requise", members:["YanniSs13","Gowther","Jericho"] },
      { id:"group-3", title:"Groupe 3", when:"Vendredi · 21 h 30", status:"1 place", members:["Escanor","Diane","Merlin","King"] },
      { id:"group-4", title:"Groupe 4", when:"Samedi · 20 h", status:"2 places", members:["Elaine","Ban","Dreyfus"] },
      { id:"group-5", title:"Groupe 5", when:"Dimanche · 18 h", status:"3 places", members:["Howzer","Guila"] },
      { id:"group-6", title:"Groupe 6", when:"À définir", status:"Ouvert", members:[] }
    ],
    reports:[
      { group:"Groupe 1", score:"1 284 500", date:"2 septembre · 21 h 48", note:"Cycle propre, ultime gardé pour la phase de rupture." },
      { group:"Groupe 5", score:"986 200", date:"30 août · 19 h 12", note:"Deux équipements restaient incomplets." }
    ]
  },
  coverage:[
    "Mon suivi", "Créer une équipe", "Équipes partagées", "Disponibilités",
    "Groupes", "Rapports", "Mon roster", "Roster des membres", "Wiki",
    "Collection", "Calculateur", "Analyse", "Membres"
  ]
});
