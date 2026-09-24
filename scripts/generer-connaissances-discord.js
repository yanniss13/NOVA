"use strict";

/* Fabrique `data/connaissances-discord.json`, le catalogue que la commande
   Discord /jarvis consulte.

   POURQUOI UN FICHIER DE PLUS. L'Edge Function ne peut pas importer les
   modules du site, et `stats-build.js` pese 2,6 Mo. Le bot n'a besoin que de
   texte lisible : les heros, leurs competences et potentiels, le nom, le
   passif et l'ensemble de chaque objet. Publie sur GitHub Pages comme
   `libelles-discord.json`, il est lu une fois par instance Edge.

   Les balises de couleur `[#RRGGBB]texte[-]` sont retirees ICI : elles ne
   servent qu'au rendu du site, et coutent du quota a chaque question.

   Usage :
     node scripts/generer-connaissances-discord.js              (re)ecrit le fichier
     node scripts/generer-connaissances-discord.js --verifier   echoue s'il est perime
*/

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  BUILD_TYPE_TO_ENUM, ELEMENT_LABELS, SLOT_ROLE_LABELS, libelleArme
} = require("../supabase/functions/_shared/discord-build.js");

const RACINE = path.resolve(__dirname, "..");
const SORTIE = path.join(RACINE, "data", "connaissances-discord.json");
const ARMURE_GRAVEE = "Armure liee";
const BALISE_COULEUR = /\[#[0-9A-Fa-f]{6}\]|\[-\]/g;
const TYPE_VERS_DOSSIER = Object.fromEntries(
  Object.entries(BUILD_TYPE_TO_ENUM).map(([dossier, type]) => [type, dossier])
);

function lireCatalogueConnaissances(fichier, propriete) {
  const source = fs.readFileSync(path.join(RACINE, "data", fichier), "utf8");
  const bac = { window:{} };
  vm.createContext(bac);
  vm.runInContext(source, bac, { filename:fichier });
  const catalogue = bac.window[propriete];
  if(!catalogue || typeof catalogue !== "object"){
    throw new Error(fichier + " ne pose pas window." + propriete);
  }
  return catalogue;
}

function sansBalisesCouleur(texte) {
  return String(texte === null || texte === undefined ? "" : texte)
    .replace(BALISE_COULEUR, "")
    .trim();
}

function libelleDuTypeArme(type) {
  const dossier = TYPE_VERS_DOSSIER[type];
  return dossier ? libelleArme(dossier) : String(type || "");
}

function personnagesConnus(data, meta) {
  const sortie = {};
  data.personnages.slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach(personnage => {
      const fiche = meta[personnage.id] || {};
      sortie[personnage.id] = {
        nom:personnage.name,
        rarete:fiche.rarity || null,
        armes:(fiche.weapons || []).map(slot => ({
          type:slot.weapon,
          arme:libelleDuTypeArme(slot.weapon),
          element:ELEMENT_LABELS[String(slot.element || "").toUpperCase()]
            || slot.element || null,
          role:SLOT_ROLE_LABELS[slot.role] || slot.role || null
        }))
      };
    });
  return sortie;
}

function competencesConnues(wiki) {
  const sortie = {};
  Object.keys(wiki).sort().forEach(id => {
    sortie[id] = (wiki[id] || []).map(competence => ({
      type:competence.weaponType || null,
      categorie:competence.categorie || null,
      nom:competence.nomFr,
      description:sansBalisesCouleur(competence.descriptionFr),
      recharge:Number.isFinite(competence.recharge) ? competence.recharge : null
    }));
  });
  return sortie;
}

function potentielsConnus(potentiels) {
  const sortie = {};
  Object.keys(potentiels).sort().forEach(id => {
    sortie[id] = {};
    Object.keys(potentiels[id]).sort().forEach(dossier => {
      const type = BUILD_TYPE_TO_ENUM[dossier];
      if(!type) throw new Error("Dossier d'arme inconnu dans potentiels.js : " + dossier);
      sortie[id][type] = potentiels[id][dossier].map(sansBalisesCouleur);
    });
  });
  return sortie;
}

function passifAuPlusHautNiveau(stats) {
  const niveaux = (stats && stats.passiveLevels) || [];
  if(!niveaux.length) return null;
  const dernier = niveaux[niveaux.length - 1];
  return { niveau:dernier.level, texte:sansBalisesCouleur(dernier.textFr) };
}

function entreeEquipement(item, categorie, type, stats, heros) {
  const entree = { nom:item.name, fichier:item.file, categorie, type };
  if(heros) entree.heros = heros;
  const passif = passifAuPlusHautNiveau(stats);
  if(passif) entree.passif = passif;
  if(stats && stats.setId) entree.ensemble = stats.setId;
  return entree;
}

function equipementsConnus(data, stats) {
  const liste = [];
  Object.values(data.armes || {}).forEach(items => items.forEach(item => {
    const dossier = item.file.split("/")[1];
    liste.push(entreeEquipement(
      item, "arme", libelleArme(dossier), stats.weaponsByFile[item.file], null
    ));
  }));
  Object.entries(data.armures || {}).forEach(([slot, items]) => items.forEach(item => {
    if(slot === ARMURE_GRAVEE){
      const gravee = stats.engravedByFile[item.file];
      liste.push(entreeEquipement(
        item, "gravee", "Armure gravée", gravee, (gravee && gravee.character) || null
      ));
    }else{
      liste.push(entreeEquipement(item, "armure", slot, stats.gearByFile[item.file], null));
    }
  }));
  Object.entries(data.bijoux || {}).forEach(([slot, items]) => items.forEach(item => {
    liste.push(entreeEquipement(item, "bijou", slot, stats.gearByFile[item.file], null));
  }));
  return liste.sort((a, b) =>
    a.nom.localeCompare(b.nom, "fr") || a.fichier.localeCompare(b.fichier));
}

/* Les seuils d'ensemble se lisent dans les donnees : ils ne valent pas
   toujours 2 / 4 / 7. Un seuil absent signifie que le palier n'existe pas. */
const PALIERS_ENSEMBLE = [
  ["twoCount", "twoTextFr"], ["fourCount", "fourTextFr"], ["sevenCount", "sevenTextFr"]
];

function ensemblesConnus(stats, utilises) {
  const sortie = {};
  [...utilises].sort().forEach(id => {
    const brut = stats.gearSets[id];
    if(!brut) throw new Error("Ensemble cité par une pièce mais absent de stats-build.js : " + id);
    sortie[id] = {
      nom:brut.nameFr || id,
      paliers:PALIERS_ENSEMBLE
        .filter(([compte]) => brut[compte] !== null && brut[compte] !== undefined)
        .map(([compte, texte]) => ({ pieces:brut[compte], texte:sansBalisesCouleur(brut[texte]) }))
    };
  });
  return sortie;
}

function verifierConnaissances(catalogue) {
  if(/\[#[0-9A-Fa-f]{6}\]|\[-\]/.test(JSON.stringify(catalogue))){
    throw new Error("Une balise de couleur a survécu dans le catalogue");
  }
  const ids = Object.keys(catalogue.personnages);
  if(ids.length < 27) throw new Error("Seulement " + ids.length + " héros dans le catalogue");
  ids.forEach(id => {
    if(!catalogue.competences[id]) throw new Error("Compétences absentes pour " + id);
    if(!catalogue.potentiels[id]) throw new Error("Potentiels absents pour " + id);
    catalogue.personnages[id].armes.forEach(arme => {
      if(!catalogue.potentiels[id][arme.type]){
        throw new Error("Potentiels absents pour " + id + " / " + arme.type);
      }
    });
  });
}

function construireConnaissances() {
  const data = lireCatalogueConnaissances("data.js", "SEVEN_DS_DATA");
  const meta = lireCatalogueConnaissances("personnages-meta.js", "SEVEN_DS_META");
  const wiki = lireCatalogueConnaissances("wiki-competences.js", "SEVEN_DS_WIKI_COMPETENCES");
  const potentiels = lireCatalogueConnaissances("potentiels.js", "SEVEN_DS_POTENTIELS");
  const stats = lireCatalogueConnaissances("stats-build.js", "SEVEN_DS_BUILD_STATS");
  const equipements = equipementsConnus(data, stats);
  const catalogue = {
    version:1,
    personnages:personnagesConnus(data, meta),
    competences:competencesConnues(wiki),
    potentiels:potentielsConnus(potentiels),
    equipements,
    ensembles:ensemblesConnus(
      stats, new Set(equipements.map(entree => entree.ensemble).filter(Boolean))
    )
  };
  verifierConnaissances(catalogue);
  return catalogue;
}

function main() {
  const attendu = JSON.stringify(construireConnaissances(), null, 1) + "\n";
  if(process.argv.includes("--verifier")){
    const present = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, "utf8") : "";
    if(present.replace(/\r\n/g, "\n") !== attendu){
      console.error("data/connaissances-discord.json est périmé : lancer "
        + "node scripts/generer-connaissances-discord.js");
      process.exit(1);
    }
    console.log("OK connaissances-discord.json à jour");
    return;
  }
  fs.writeFileSync(SORTIE, attendu);
  console.log("Écrit " + path.relative(RACINE, SORTIE) + " ("
    + Math.round(Buffer.byteLength(attendu) / 1024) + " Ko)");
}

main();
