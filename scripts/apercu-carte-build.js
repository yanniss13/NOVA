"use strict";

/* Rend une carte /build dans `apercu-build.png`, sans Discord ni Supabase.

   Le rendu est difficile a juger autrement qu'en le regardant : ce script
   fabrique un build complet a partir du catalogue reel, charge les vignettes
   depuis le dossier local plutot que depuis Pages, et ecrit le PNG.

   Prealable : `python scripts/generer-vignettes.py`, sinon la carte sort avec
   des cadres vides — ce qui reste un cas valide, mais ne dit rien du rendu. */

const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.resolve(__dirname, "..");
const partage = nom => path.join(RACINE, "supabase", "functions", "_shared", nom);

require(partage("availability-font.js"));
require(partage("availability-pdf.js"));
require(partage("carte-font.js"));
const { decodePng } = require(partage("png-decode.js"));
const { resoudreDemandeBuild } = require(partage("discord-build.js"));
const { generateBuildCardPng } = require(partage("discord-build-png.js"));

const libelles = require(path.join(RACINE, "data", "libelles-discord.json"));

/* Les vignettes locales, celles que le workflow Pages publiera. */
async function chargerLocale(chemin) {
  const fichier = path.join(RACINE, "7ds-vignettes",
    chemin.replace(/\.webp$/i, ".png"));
  return fs.existsSync(fichier)
    ? decodePng(fs.readFileSync(fichier))
    : null;
}

function catalogue() {
  const source = fs.readFileSync(path.join(RACINE, "data", "data.js"), "utf8");
  return JSON.parse(
    source.replace(/^[\s\S]*?=\s*/, "").trim().replace(/;$/, "")
  );
}

function premierAvecBornes(liste) {
  return liste.find(objet => libelles.bornes.objets.index[objet.file] !== undefined)
    || liste[0];
}

function enchantementsObjet(objet, quantite, parts, preferes) {
  if(!objet) return [];
  const index = libelles.bornes.objets.index[objet.file];
  const table = index === undefined ? null : libelles.bornes.objets.tables[index];
  if(!table) return [];
  const disponibles = Object.keys(table);
  const stats = (preferes || []).filter(stat => disponibles.includes(stat))
    .concat(disponibles.filter(stat => !(preferes || []).includes(stat)))
    .slice(0, quantite);
  return stats.map((stat, rang) => {
    const [minimum, maximum] = table[stat];
    const part = parts[rang] === undefined ? 0.5 : parts[rang];
    return {
      slot:rang,
      stat,
      value:Math.round(minimum + (maximum - minimum) * part)
    };
  });
}

function construireBuild() {
  const data = catalogue();
  /* Le CATALOGUE range ses armes par categorie (« Epee a une main ») ; le
     ROSTER les range par dossier (« Epee 1 main »), et c'est cette cle-la que
     la carte recoit. Batir l'apercu avec l'autre vocabulaire donnait une image
     credible et fausse : ni role, ni icone de maitrise. */
  const categorie = "Epee a une main";
  const arme = data.armes[categorie][0];
  const typeArme = arme.file.split("/")[1];
  const grade = Object.keys(libelles.armes[arme.file] || {})[0];
  const table = grade
    ? libelles.bornes.armes.tables[libelles.bornes.armes.index[grade]]
    : null;

  /* Trois enchantements places a des hauteurs differentes dans leurs bornes :
     c'est ce qui rend les barres lisibles d'un coup d'oeil. */
  const parts = [0.35, 0.8, 0.6];
  const enchantements = table
    ? Object.keys(table.stats).slice(0, 3).map((cle, rang) => {
      const [palier, stat] = cle.split("|");
      const [minimum, maximum] = table.stats[cle];
      return {
        slot:rang,
        tier:Number(palier),
        stat,
        value:Math.round(minimum + (maximum - minimum) * parts[rang])
      };
    })
    : [];

  const haut = premierAvecBornes(data.armures.Haut);
  const bornesHaut = libelles.bornes.objets.tables[
    libelles.bornes.objets.index[haut.file]
  ];
  const statHaut = bornesHaut ? Object.keys(bornesHaut)[0] : null;
  const gravee = premierAvecBornes(data.armures["Armure liee"] || []);
  const anneau = premierAvecBornes(data.bijoux.Anneau || []);
  const collier = premierAvecBornes(data.bijoux.Collier || []);
  const boucle = premierAvecBornes(data.bijoux["Boucle d'oreille"] || []);

  return {
    owner:"apercu",
    char_id:"meliodas",
    potential_tier:10,
    builds:{
      [typeArme]:{
        weapon:arme.file,
        weaponConfig:{
          gradeGameId:grade, level:50, promotion:4, overlimit:6,
          enchantments:enchantements
        },
        armor:{
          Haut:haut.file,
          Bas:data.armures.Bas[0].file,
          Bottes:data.armures.Bottes[0].file,
          Ceinture:data.armures.Ceinture[0].file,
          "Armure liee":gravee ? gravee.file : null
        },
        armorConfig:{
          Haut:{
            passiveLevel:3,
            enchantments:enchantementsObjet(haut, 1, [0.5], [statHaut])
          },
          "Armure liee":{
            passiveLevel:3,
            enchantments:enchantementsObjet(gravee, 3, [0.72, 0.55, 0.85], [
              "C_Critical_Dam_Rate", "I_AtkAdd_Rate",
              "Normalskill_Damadd_Rate"
            ])
          }
        },
        jewel:{
          Anneau:anneau && anneau.file,
          Collier:collier && collier.file,
          "Boucle d'oreille":boucle && boucle.file
        },
        jewelConfig:{
          Anneau:{ enchantments:enchantementsObjet(anneau, 1, [0.68]) },
          Collier:{ enchantments:enchantementsObjet(collier, 1, [0.44]) },
          "Boucle d'oreille":{
            enchantments:enchantementsObjet(boucle, 1, [0.81])
          }
        },
        note:"Build de raid : garder la perle légendaire sur le taux critique."
      }
    }
  };
}

async function principal() {
  const ligne = construireBuild();
  const resultat = resoudreDemandeBuild({
    profils:[{ id:"apercu", pseudo:"YanniSs13" }],
    lignes:[ligne],
    libelles,
    options:{ joueur:"YanniSs13", personnage:"Meliodas", arme:"" }
  });
  if(resultat.erreur){
    console.error(resultat.erreur);
    process.exitCode = 1;
    return;
  }
  const png = await generateBuildCardPng(resultat.cartes[0], {
    chargerImage:chargerLocale
  });
  const sortie = path.join(RACINE, "apercu-build.png");
  fs.writeFileSync(sortie, png);
  console.log("apercu-build.png ecrit : "
    + png.readUInt32BE(16) + " x " + png.readUInt32BE(20)
    + ", " + Math.round(png.length / 1024) + " Ko.");
}

principal().catch(erreur => {
  console.error(erreur);
  process.exitCode = 1;
});
