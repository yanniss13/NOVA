"use strict";

/* Ordre de chargement des modules applicatifs, source unique de vérité.
   Il doit rester identique à l'ordre des `import` réels : le chargeur `vm` des
   tests unitaires concatène ces fichiers dans une portée commune, et le lecteur
   de source les parcourt pour les assertions structurelles.
   Toute extraction ajoute son fichier ICI, avant celui qui le consomme. */
const MODULES = ["dom.js", "dispos-logique.js", "modal-stack.js", "picker.js", "app.js"];

module.exports = { MODULES };
