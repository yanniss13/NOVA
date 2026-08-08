"use strict";

/* Ordre de chargement des modules applicatifs, source unique de vérité.

   Il doit rester identique à l'ordre des `import` réels : le chargeur `vm` des
   tests unitaires concatène ces fichiers dans une portée commune, et le lecteur
   de source les parcourt pour les assertions structurelles.

   L'ordre suit les couches, des feuilles vers le tronc. **Une couche ne dépend
   jamais d'une couche située plus bas dans cette liste.** C'est la règle qui
   rend le découpage lisible ; `tests/modules-imports.test.js` la protège.

   Toute extraction ajoute son fichier ICI, dans sa couche. */
const MODULES = [
  /* noyau — aucune dépendance applicative, tout le reste s'appuie dessus. */
  "noyau/constantes.js",
  "noyau/outils.js",
  "noyau/dom.js",
  "noyau/supabase-client.js",

  /* etat — état mutable partagé, porté par des objets pour rester réaffectable. */
  "etat/session.js",
  "etat/brouillon-equipe.js",

  /* metier — logique pure, testable sans navigateur. Ni DOM ni réseau. */
  "metier/catalogue.js",
  "metier/armes.js",
  "metier/equipement.js",
  "metier/perles.js",
  "metier/build-config.js",
  "metier/stats-calcul.js",
  "metier/degats-calcul.js",
  "metier/calculateur-entrees.js",
  "metier/equipe-buffs.js",
  "metier/equipe-modele.js",
  "metier/dispos-logique.js",
  "metier/boss-logique.js",
  "metier/accueil-logique.js",
  "metier/wiki-competences.js",
  "metier/wiki-equipement.js",
  "metier/collection.js",

  /* donnees — lectures et écritures Supabase, sans aucun rendu. */
  "donnees/roster-profils.js",
  "donnees/equipes-store.js",
  "donnees/roster-store.js",
  "donnees/collection-store.js",
  "donnees/boss-store.js",
  "donnees/suivi-store.js",
  "donnees/calibration-store.js",

  /* vues — tout ce qui touche au DOM. */
  "vues/navigation.js",
  "vues/etat-synchro.js",
  "vues/elements.js",
  "vues/toast.js",
  "vues/modal-stack.js",
  "vues/modale-auth.js",
  "vues/picker.js",
  "vues/stats-affichage.js",
  "vues/stats-heros.js",
  "vues/editeur-arme.js",
  "vues/editeur-equipement.js",
  "vues/edition-build.js",
  "vues/dispos.js",
  "vues/detail-piece.js",
  /* Avant `fiche-heros.js`, qui l'importe pour son lien « Calculer les
     dégâts » : un module n'importe jamais un module déclaré après lui. */
  "vues/calculateur.js",
  "vues/fiche-heros.js",
  "vues/detail-equipe.js",
  "vues/equipe-boss.js",
  "vues/detail-roster.js",
  "vues/boss-sessions.js",
  "vues/builder.js",
  "vues/roster-membres.js",
  "vues/analyse.js",
  "vues/roster-equipes.js",
  "vues/suivi.js",
  /* Avant `synchro-temps-reel.js`, qui la re-rend quand `collection_items`
     bouge : un module n'importe jamais un module declare apres lui. */
  "vues/collection.js",
  "vues/synchro-temps-reel.js",
  "vues/session-auth.js",
  "vues/wiki-blocs.js",
  "vues/wiki.js",
  "vues/wiki-fiche-heros.js",
  "vues/wiki-corps-arme.js",
  "vues/wiki-corps-equipement.js",
  "vues/wiki-fiche-objet.js",

  /* le reste, pas encore découpé. */
  "app.js"
];

module.exports = { MODULES };
