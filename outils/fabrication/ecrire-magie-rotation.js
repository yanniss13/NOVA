/* Ecrit data/magie-rotation.js depuis PC_SkillTable.

   `UI_MagicForceGauge` est la recharge brute affichee pour une competence.
   `UseMagicForceStack` est le nombre de boules depensees par son lancement.
   Une boule contient 1000 points et l'equipe en garde sept, d'apres
   `ga_magicforce_gage` et `magicforcemaxstack` dans Misc/DefineTable.

   Lancer : node outils/fabrication/ecrire-magie-rotation.js
   L'export direct DONNEES_JEU est prioritaire ; les archives restent un repli.
*/
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const racine = path.join(__dirname, "..", "..");
const sortie = path.join(racine, "data", "magie-rotation.js");

function sourceDirecte(env){
  if(!env.DONNEES_JEU) return null;
  return path.join(env.DONNEES_JEU, "Table", "Skill", "PC_SkillTable.json");
}

function sourcesDisponibles(env){
  const base = env.DONNEES_JEU_SOURCES;
  if(!base || !fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes:true })
    .filter(entree => entree.isDirectory() && entree.name.startsWith("Exports"))
    .map(entree => path.join(
      base, entree.name, "SevenDeadlySins", "Content", "Table", "Skill",
      "PC_SkillTable.json"
    ))
    .filter(fichier => fs.existsSync(fichier))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function choisirSource(env){
  const directe = sourceDirecte(env);
  if(directe && fs.existsSync(directe)) return directe;
  const archive = sourcesDisponibles(env)[0];
  if(archive) return archive;
  throw new Error("PC_SkillTable.json introuvable");
}

function ecrireMagieRotation(env = process.env){
  const sourcePath = choisirSource(env);
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const lignes = source[0] && source[0].Rows || source.Rows || source;
  const bac = { window:{} };
  vm.runInNewContext(
    fs.readFileSync(path.join(racine, "data", "wiki-competences.js"), "utf8"), bac
  );
  const wiki = bac.window.SEVEN_DS_WIKI_COMPETENCES;

  const rechargeDe = id => {
    const ligne = lignes[id];
    return ligne ? Math.max(0, Number(ligne.UI_MagicForceGauge) || 0) : null;
  };

  const chaineDAutos = prefixe => Object.keys(lignes)
    .filter(id => id.startsWith(prefixe + "_normalatk_"))
    .sort();

  const magie = {};
  const absentes = [];
  let autos = 0;

  Object.values(wiki).forEach(liste => liste.forEach(competence => {
    if(competence.categorie === "PASSIVE") return;
    const id = competence.gameId;

    if(competence.categorie === "NORMAL"){
      const segments = id.split("_");
      let frappes = [];
      for(let garde = segments.length - 1; garde >= 2 && !frappes.length; garde--){
        frappes = chaineDAutos(segments.slice(0, garde).join("_"));
      }
      if(!frappes.length){
        absentes.push(id + " (chaine d'attaques normales introuvable)");
        return;
      }
      magie[id] = {
        recharge:frappes.reduce((total, frappe) => total + rechargeDe(frappe), 0),
        cout:0
      };
      autos += 1;
      return;
    }

    const ligne = lignes[id];
    if(!ligne){
      absentes.push(id + " (absente de PC_SkillTable)");
      return;
    }
    magie[id] = {
      recharge:Math.max(0, Number(ligne.UI_MagicForceGauge) || 0),
      cout:Math.max(0, Number(ligne.UseMagicForceStack) || 0)
    };
  }));

  if(absentes.length){
    throw new Error("Donnees de magie absentes : " + absentes.join(", "));
  }

  const ordonne = {};
  Object.keys(magie).sort().forEach(id => { ordonne[id] = magie[id]; });
  const entete = [
    "// Genere par outils/fabrication/ecrire-magie-rotation.js depuis les donnees",
    "// du jeu.",
    "// recharge = UI_MagicForceGauge en points bruts ; cout = UseMagicForceStack",
    "// en boules. Une boule vaut 1000 points, avec un plafond d'equipe de 7.",
    "// L'attaque normale somme sa chaine `normalatk_*`.",
    ""
  ].join("\n");

  fs.writeFileSync(
    sortie,
    entete + "window.SEVEN_DS_MAGIE_ROTATION = "
      + JSON.stringify(ordonne, null, 1) + ";\n"
  );

  console.log("source :", sourcePath);
  console.log("competences ecrites :", Object.keys(ordonne).length,
    "| chaines d'attaques normales :", autos);
  console.log("sortie :", sortie);
}

module.exports = { sourceDirecte, choisirSource };

if(require.main === module){
  ecrireMagieRotation();
}
