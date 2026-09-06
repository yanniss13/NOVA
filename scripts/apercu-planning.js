"use strict";

/* Rend les deux images de /planning, sans Discord ni Supabase.

   Le rendu se juge en le regardant : ce script fabrique une confrerie de douze
   membres — neuf qui ont repondu, trois qui n'ont rien rempli — et ecrit les
   deux PNG a la racine. Le tirage est deterministe : deux executions donnent la
   meme image, une difference vient donc du code et de rien d'autre.

   Usage : node scripts/apercu-planning.js */

const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const partage = nom => path.join(RACINE, "supabase", "functions", "_shared", nom);

require(partage("availability-font.js"));
const { buildAvailabilityReport } = require(partage("availability-pdf.js"));
require(partage("carte-font.js"));
require(partage("discord-build.js"));
require(partage("carte-ornements.js"));
const {
  generatePlanningTablePng, generatePlanningMembersPng
} = require(partage("planning-png.js"));

const PSEUDOS = [
  "YanniSs13", "Élodie", "Bastien", "Maëlys", "Kevin", "Zoé",
  "Grégoire", "Anaïs", "Tom", "Léa", "Nicolas-Étienne", "Sam"
];

/* Un tirage reproductible, et vraisemblable : on joue le soir, un peu
   l'apres-midi, presque jamais a huit heures du matin. */
function masqueDeMembre(graine) {
  let etat = (graine * 2654435761) % 2147483647;
  const suivant = () => {
    etat = (etat * 48271) % 2147483647;
    return etat / 2147483647;
  };
  let masque = "";
  for(let jour = 0; jour < 7; jour += 1){
    for(let heure = 0; heure < 24; heure += 1){
      const chance = heure >= 19 ? 0.72
        : heure >= 14 ? 0.34
          : heure < 8 ? 0.05 : 0.15;
      masque += suivant() < chance ? "1" : "0";
    }
  }
  return masque;
}

async function principal() {
  const profils = PSEUDOS.map((pseudo, rang) => ({ id:"u" + rang, pseudo }));
  /* Les trois derniers n'ont pas de ligne : c'est le cas que la carte doit
     distinguer d'une semaine sans creneau. */
  const lignes = profils.slice(0, 9).map((profil, rang) => ({
    owner:profil.id, slots:masqueDeMembre(rang + 3)
  }));
  const report = buildAvailabilityReport(profils, lignes, "2026-09-07");

  const images = [
    ["apercu-planning-grille.png", await generatePlanningTablePng(report)],
    ["apercu-planning-membres.png", await generatePlanningMembersPng(report)]
  ];
  images.forEach(([nom, png]) => {
    fs.writeFileSync(path.join(RACINE, nom), png);
    console.log(nom + " ecrit : " + png.readUInt32BE(16) + " x "
      + png.readUInt32BE(20) + ", " + Math.round(png.length / 1024) + " Ko.");
  });
}

principal().catch(erreur => {
  console.error(erreur);
  process.exitCode = 1;
});
