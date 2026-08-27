"use strict";

/* Chaque arme du roster doit avoir son badge élément/rôle sur le disque.

   `fiche-heros.js` construit le chemin par concaténation :

       "7ds-ui/role-elements/" + element + "_" + role + ".webp"

   Un fichier absent ne casse rien : le navigateur affiche son carré d'image
   brisée, et la fiche reste par ailleurs correcte. C'est passé inaperçu
   jusqu'à ce qu'un membre le signale sur mobile, le 27 août 2026 — les
   Gantelets de Ban sont la première arme Buster de Ténèbres du jeu, et
   `dark_buster.webp` n'avait jamais eu de raison d'exister.

   Ce test rend le trou bruyant. Il ne vérifie QUE les combinaisons
   réellement portées : les 32 autres que 7dsorigin publie n'ont pas à être
   téléchargées tant qu'aucun héros ne les emploie. */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..");
const dossier = path.join(racine, "7ds-ui", "role-elements");

const bac = { window:{} };
vm.runInNewContext(
  fs.readFileSync(path.join(racine, "data", "personnages-meta.js"), "utf8"), bac
);
const meta = bac.window.SEVEN_DS_META;
assert.ok(meta, "personnages-meta.js doit s'exposer sur window");

const portees = new Map();
Object.entries(meta).forEach(([slug, personnage]) => {
  (personnage.weapons || []).forEach(arme => {
    const combo = String(arme.element || "").toLowerCase()
      + "_" + String(arme.role || "").toLowerCase();
    if(!portees.has(combo)) portees.set(combo, []);
    portees.get(combo).push(slug + " / " + arme.weapon);
  });
});

assert.ok(portees.size >= 25,
  "le roster doit porter des combinaisons, reçu : " + portees.size);

const absents = [];
portees.forEach((armes, combo) => {
  if(!fs.existsSync(path.join(dossier, combo + ".webp"))){
    absents.push(combo + "  (" + armes.join(", ") + ")");
  }
});

assert.deepEqual(absents, [],
  "badges élément/rôle absents de 7ds-ui/role-elements :\n  "
  + absents.join("\n  ")
  + "\n  Les récupérer sur https://7dsorigin.app/images/ui/role-elements/<combo>.webp");

console.log(
  "badges-role-element.test.js OK (" + portees.size + " combinaisons portées)"
);
