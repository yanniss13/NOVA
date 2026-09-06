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
  heroes:[
    { name:"Méliodas", slug:"meliodas", element:"Ténèbres", role:"Attaquant", weapon:"Épée à une main", potential:10, complete:true },
    { name:"Merlin", slug:"merlin", element:"Foudre", role:"Soutien", weapon:"Grimoire", potential:8, complete:false },
    { name:"Diane", slug:"diane", element:"Terre", role:"Gardien", weapon:"Marteau", potential:9, complete:true },
    { name:"King", slug:"king", element:"Vent", role:"Soutien", weapon:"Lance", potential:7, complete:true },
    { name:"Escanor", slug:"escanor", element:"Feu", role:"Attaquant", weapon:"Épée à deux mains", potential:10, complete:true },
    { name:"Elizabeth", slug:"elizabeth", element:"Lumière", role:"Guérisseur", weapon:"Bâton", potential:6, complete:false }
  ],
  equipment:[
    { slot:"Arme", name:"En plein cœur !", image:"../../7ds-armes/Epee 1 main/En plein cœur !.webp", value:"Niv. 50 · +6" },
    { slot:"Haut", name:"Œil de l'étoile sinistre", image:"../../7ds-armures-ssr/Haut/Haut de l'œil de l'étoile sinistre.webp", value:"SSR · +5" },
    { slot:"Bas", name:"Mélodie d'Arachnée", image:"../../7ds-armures-ssr/Bas/Bas de la mélodie d'Arachnée.webp", value:"SSR · +5" },
    { slot:"Collier", name:"Talisman du serment", image:"../../7ds-bijoux/Collier/Collier au talisman du serment.webp", value:"SSR · 9,34 %" }
  ],
  collection:[
    { name:"Rapière à l'aura triomphale", kind:"Rapière", owned:true, image:"../../7ds-armes/Rapiere/Rapière à l'aura triomphale.webp" },
    { name:"Rapière noir de jais", kind:"Rapière", owned:false, image:"../../7ds-armes/Rapiere/Rapière noir de jais.webp" },
    { name:"Collier du souverain cupide", kind:"Collier", owned:true, image:"../../7ds-bijoux/Collier/Collier du souverain cupide.webp" },
    { name:"Boucles du chaos ténébreux", kind:"Boucles", owned:false, image:"../../7ds-bijoux/Boucle d'oreille/Boucles d'oreilles du chaos ténébreux.webp" }
  ],
  calculator:[
    { skill:"Compétence normale", a:"128 450", b:"119 820", gain:"+7,2 %" },
    { skill:"Attaque spéciale", a:"344 910", b:"371 200", gain:"−7,1 %" },
    { skill:"Ultime", a:"892 600", b:"821 440", gain:"+8,7 %" },
    { skill:"Cycle de 60 s", a:"2,48 M", b:"2,35 M", gain:"+5,5 %" }
  ],
  members:[
    { name:"YanniSs13", role:"Administrateur", roster:"18 personnages", status:"Membre" },
    { name:"Merlin", role:"Membre", roster:"14 personnages", status:"Membre" },
    { name:"Elaine", role:"Membre", roster:"11 personnages", status:"Membre" },
    { name:"Nouveau joueur", role:"Accès limité", roster:"1 personnage", status:"Invité" }
  ],
  coverage:[
    "Mon suivi", "Créer une équipe", "Équipes partagées", "Disponibilités",
    "Groupes", "Rapports", "Mon roster", "Roster des membres", "Wiki",
    "Collection", "Calculateur", "Analyse", "Membres"
  ]
});
