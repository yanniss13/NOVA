"use strict";

/* Ordre de chargement des modules applicatifs, source unique de vérité.
   Il doit rester identique à l'ordre des `import` réels : le chargeur `vm` des
   tests unitaires concatène ces fichiers dans une portée commune, et le lecteur
   de source les parcourt pour les assertions structurelles.
   Toute extraction ajoute son fichier ICI, avant celui qui le consomme. */
const MODULES = ["constantes.js", "session.js", "brouillon-equipe.js", "supabase-client.js", "outils.js", "dom.js", "equipement.js", "roster-profils.js", "toast.js", "perles.js", "build-config.js", "stats-calcul.js", "armes.js", "dispos-logique.js", "modal-stack.js", "picker.js", "boss-logique.js", "boss-store.js", "dispos.js", "stats-affichage.js", "app.js"];

module.exports = { MODULES };
