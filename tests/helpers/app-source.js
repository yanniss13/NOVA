"use strict";

/* Texte source de l'application, pour les tests qui vérifient la STRUCTURE du
   code plutôt que son comportement (présence d'un onglet, d'un identifiant,
   d'une table écoutée en Realtime…).
   Depuis le découpage en modules, ce texte n'est plus `index.html` seul : le
   balisage y reste, mais le JavaScript vit dans `js/`. On concatène les deux
   afin qu'une assertion continue de trouver ce qu'elle cherche, où qu'il ait
   été déplacé. */

const fs = require("node:fs");
const path = require("node:path");
const { MODULES } = require("./modules");

const ROOT = path.resolve(__dirname, "..", "..");

function appSource(){
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const scripts = MODULES
    .map(name => fs.readFileSync(path.join(ROOT, "js", name), "utf8"))
    .join("\n");
  return html + "\n" + scripts;
}

module.exports = { appSource };
