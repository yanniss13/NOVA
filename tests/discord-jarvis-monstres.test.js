"use strict";

/* Les monstres de /jarvis : les deux outils, sur un catalogue fabrique par la VRAIE
   extraction a partir du mini-export de tests/monstres-jarvis.test.js. Les
   formes ne peuvent donc pas diverger entre l'extracteur et le bot. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-monstres.js"));
const { construireCatalogueMonstres } = require(path.join(ROOT, "outils", "fabrication", "monstres-jarvis.js"));
const { ENTREE_MONSTRES_TEST } = require("./monstres-jarvis.test.js");
const { effetsParActeur, rattacherEffets } = require(path.join(ROOT, "outils", "fabrication", "effets-monstres-jarvis.js"));
const { ENTREE_EFFETS_TEST } = require("./effets-monstres-jarvis.test.js");

/* Les effets d'Akumu viennent du mini-export des effets, rattaches a
   l'acteur d'Akumu de ce catalogue-ci : la meme chaine qu'extraire-monstres. */
const CATALOGUE = construireCatalogueMonstres(ENTREE_MONSTRES_TEST);
rattacherEffets(CATALOGUE.monstres, new Map([[
  CATALOGUE.monstres.find(m => m.nom === "Akumu, bête démoniaque").versions[0].acteurs[0],
  effetsParActeur(ENTREE_EFFETS_TEST).get("50700109")
]]));

function outils(catalogue) {
  const table = {};
  M.ajouterOutilsMonstresJarvis(table, async () => catalogue);
  return {
    async executer(nom, args) {
      const donnees = await table[nom].executer(args);
      return { donnees, source:table[nom].source(args, donnees) };
    }
  };
}

async function main() {
  /* ---------------- Declarations ---------------- */
  assert.deepEqual(M.DECLARATIONS_OUTILS_MONSTRES.map(d => d.name), ["fiche_monstre", "chercher_monstres"]);
  M.DECLARATIONS_OUTILS_MONSTRES.forEach(d => assert.equal(d.parameters.type, "OBJECT"));
  assert.equal(M.CHEMIN_MONSTRES_JARVIS, "jarvis-prive/monstres.json");

  /* ---------------- fiche_monstre ---------------- */
  const o = outils(CATALOGUE);
  const rouge = await o.executer("fiche_monstre", { nom:"demon rouge" });
  assert.equal(rouge.donnees.nom, "Démon rouge");
  assert.equal(rouge.donnees.rang, "Boss");
  assert.equal(rouge.donnees.donneesDu, "24/09/2026");
  assert.equal(rouge.donnees.total, 3);
  assert.equal(rouge.source, "fiche monstre Démon rouge · données du jeu du 24/09/2026");
  assert.deepEqual(rouge.donnees.versions[0], {
    contextes:["Boss de terrain", "Zone : Britannia"],
    faiblesses:["Terre +20 %", "Sacré +20 %"],
    resistances:["Feu −30 %"],
    resistanceElementaireBase:"10 % sur tous les éléments",
    resistanceCritique:"10 %",
    defenseCritique:"8,69 %",
    valeursDeBase:{ pv:95747, defense:555, attaque:1547,
      note:"valeurs de base, avant ajustement du niveau de monde" },
    puissanceRecommandee:{ "Niveau de monde 1":3144, "Niveau de monde 4":19495 }
  });

  const cross = await o.executer("fiche_monstre", { nom:"Démon rouge", contexte:"Cross Challenge" });
  assert.equal(cross.donnees.versions.length, 1);
  assert.deepEqual(cross.donnees.versions[0].faiblesses, ["Glace +30 %", "Sacré +30 %"]);
  assert.deepEqual(cross.donnees.versions[0].resistances,
    ["Physique −80 %", "Foudre −80 %", "Vent −80 %", "Feu −80 %", "Terre −80 %", "Ténèbres −80 %"]);
  const donjon = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"donjon" });
  assert.match(donjon.donnees.versions[0].contextes[0], /^Donjon : Démon rouge — Réveil/);
  const contexteInconnu = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"plage" });
  assert.equal(contexteInconnu.donnees.erreur, "contexte inconnu");
  assert.deepEqual(contexteInconnu.donnees.contextesPossibles,
    ["terrain", "donjon", "confrérie", "cross challenge", "zone"]);
  const sansVersion = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"confrérie" });
  assert.equal(sansVersion.donnees.aucuneVersionPour, "confrérie");
  assert.ok(sansVersion.donnees.contextesDisponibles.includes("Cross Challenge"));

  const akumu = await o.executer("fiche_monstre", { nom:"akumu" });
  assert.equal(akumu.donnees.paliers, "1 à 30");
  /* Les strategies officielles du jeu, telles qu'ecrites, dans l'ordre. */
  assert.deepEqual(akumu.donnees.strategies, [
    "Pierres d'élément : Détruisez les cinq pierres d'élément à temps.",
    "Assaut sournois : Les attaques dans le dos infligent des dégâts bien plus importants.",
    "Union : Chaque fois qu'un joueur meurt, Akumu gagne en puissance.",
    "Rage : Pendant l'événement, Akumu enrage."
  ]);
  assert.equal((await o.executer("fiche_monstre", { nom:"lapin" })).donnees.strategies, undefined);
  /* Les effets poses par le boss, sans cible : la note le rappelle au modele. */
  assert.deepEqual(akumu.donnees.effets, [
    "Bouclier (dès son apparition)",
    "Réduction de l'attaque : Attaque -10 % (30 s)",
    "Augmentation de l'attaque : Attaque +20 % (600 s, jusqu'à 5 cumuls, à la mort d'un joueur)",
    "Augmentation des dégâts subis : Dégâts subis +50 %"
  ]);
  assert.equal(akumu.donnees.noteEffets,
    "Le jeu ne dit pas qui reçoit ces effets (le boss ou les joueurs) : ne l'affirme pas.");
  assert.equal((await o.executer("fiche_monstre", { nom:"lapin" })).donnees.effets, undefined);
  assert.equal((await o.executer("fiche_monstre", { nom:"lapin" })).donnees.noteEffets, undefined);
  /* Bornes : au plus 12 effets, chacun sous 200 caracteres. */
  const bavard = JSON.parse(JSON.stringify(CATALOGUE));
  bavard.monstres.find(m => m.effets).effets = Array.from({ length:20 }, (_, i) =>
    ({ nom:"Effet " + i, texte:"x".repeat(400) }));
  const bornes = (await outils(bavard).executer("fiche_monstre", { nom:"akumu" })).donnees.effets;
  assert.equal(bornes.length, 12);
  assert.ok(bornes.every(ligne => Array.from(ligne).length <= 200));
  /* Un effet abime fait refuser le fichier, comme une strategie. */
  const effetAbime = JSON.parse(JSON.stringify(CATALOGUE));
  effetAbime.monstres.find(m => m.effets).effets.push({ nom:"x", dureeS:"30" });
  assert.match(M.validerCatalogueMonstres(effetAbime), /entrée mal formée/);
  /* Un fichier dont une strategie est abimee est refuse en entier. */
  assert.equal(M.validerCatalogueMonstres(CATALOGUE), null);
  const abime = JSON.parse(JSON.stringify(CATALOGUE));
  abime.monstres.find(m => m.strategies).strategies.push({ titre:"x", texte:3 });
  assert.match(M.validerCatalogueMonstres(abime), /entrée mal formée/);
  assert.deepEqual(akumu.donnees.versions.map(v => v.niveau), [1, 30],
    "sans niveau : premier et dernier palier");
  assert.deepEqual(akumu.donnees.versions[0].contextes, ["Boss de confrérie, niveau 1"]);
  assert.deepEqual(akumu.donnees.versions[0].faiblesses, []);
  assert.equal(akumu.donnees.versions[0].resistances.length, 8);
  const akumu30 = await o.executer("fiche_monstre", { nom:"akumu", niveau:"30" });
  assert.deepEqual(akumu30.donnees.versions.map(v => v.niveau), [30], "niveau en chaîne compris");
  const akumu31 = await o.executer("fiche_monstre", { nom:"akumu", niveau:31 });
  assert.equal(akumu31.donnees.erreur, "niveau hors bornes : de 1 à 30");
  const akumu12 = await o.executer("fiche_monstre", { nom:"akumu", niveau:12 });
  assert.equal(akumu12.donnees.erreur, "niveau 12 absent des données");
  assert.deepEqual(akumu12.donnees.niveauxDisponibles, [1, 30]);

  /* L'export reel a un second acteur « Akumu » hors paliers, sans contexte.
     Sans niveau demande, on garde le premier et le dernier palier ET les
     versions hors paliers : jamais une version hors paliers a la place du 1. */
  const akumuMixte = outils({ version:1, dateExport:"2026-09-24", monstres:[{
    nom:"Akumu, bête démoniaque", rang:"boss",
    versions:[Object.assign({}, CATALOGUE.monstres[2].versions[0], { rang:"boss", acteurs:["51300084"] }),
      ...CATALOGUE.monstres[0].versions]
  }] });
  const mixte = await akumuMixte.executer("fiche_monstre", { nom:"akumu" });
  /* Les paliers d'abord : Gemini lit la vraie version avant la version non
     confirmee (relecture finale, point 6). */
  assert.deepEqual(mixte.donnees.versions.map(v => v.niveau), [1, 30, undefined]);
  assert.equal(mixte.donnees.versions[2].nonConfirme, true);
  assert.equal(mixte.donnees.paliers, "1 à 30");
  const mixte30 = await akumuMixte.executer("fiche_monstre", { nom:"akumu", niveau:30 });
  assert.deepEqual(mixte30.donnees.versions.map(v => v.niveau), [30],
    "un niveau demande ne garde que ce palier");

  /* Les bornes des paliers se lisent dans les donnees : un boss a 20 paliers
     ne doit pas annoncer « 1 à 30 ». */
  const vingt = outils({ version:1, dateExport:"2026-09-24", monstres:[{
    nom:"Gardien des vingt", rang:"boss",
    versions:[Object.assign({}, CATALOGUE.monstres[0].versions[0], { niveau:1 }),
      Object.assign({}, CATALOGUE.monstres[0].versions[1], { niveau:20 })] }] });
  assert.equal((await vingt.executer("fiche_monstre", { nom:"gardien" })).donnees.paliers, "1 à 20");
  assert.equal((await vingt.executer("fiche_monstre", { nom:"gardien", niveau:25 })).donnees.erreur,
    "niveau hors bornes : de 1 à 20");
  /* Un niveau demande pour un monstre sans paliers est signale, pas ignore. */
  const rougeNiveau = await o.executer("fiche_monstre", { nom:"demon rouge", niveau:3 });
  assert.equal(rougeNiveau.donnees.total, 3);
  assert.equal(rougeNiveau.donnees.niveauIgnore, "ce monstre n'a pas de paliers : niveau ignoré");

  const lapin = await o.executer("fiche_monstre", { nom:"lapin" });
  assert.equal(lapin.donnees.versions[0].nonConfirme, true);
  assert.deepEqual(lapin.donnees.versions[0].contextes, ["présent dans les fichiers, contexte non retrouvé"]);
  assert.equal(lapin.donnees.versions[0].resistanceElementaireBase, "aucune");
  assert.equal(lapin.donnees.versions[0].puissanceRecommandee, undefined);

  const inconnu = await o.executer("fiche_monstre", { nom:"Démon roux" });
  assert.equal(inconnu.donnees.introuvable, "Démon roux");
  assert.ok(inconnu.donnees.proches.includes("Démon rouge"));

  /* Nom trop vague : a correspondance egale, le boss passe devant le monstre
     normal (l'ordre alphabetique rendait « Démon champignon »), puis le nom
     le plus court. Les autres sont nommes ET comptes. */
  const vague = outils({ version:1, dateExport:"2026-09-24", monstres:[
    { nom:"Démon champignon", rang:"normal", versions:CATALOGUE.monstres[2].versions },
    { nom:"Démon gris", rang:"boss", versions:CATALOGUE.monstres[1].versions.slice(0, 1) },
    CATALOGUE.monstres[1]
  ] });
  const demon = await vague.executer("fiche_monstre", { nom:"démon" });
  assert.equal(demon.donnees.nom, "Démon gris");
  assert.deepEqual(demon.donnees.autresCorrespondances, ["Démon rouge", "Démon champignon"]);
  assert.equal(demon.donnees.correspondances, 3);

  /* La source garde toujours sa date : « Akumu, bête démoniaque » la coupait. */
  assert.equal(akumu.source, "fiche monstre Akumu, bête démoniaque · données du jeu du 24/09/2026");
  const nomTresLong = "Shakeera, la reine araignée arrogante et démesurément longue";
  const longue = outils({ version:1, dateExport:"2026-09-24", monstres:[
    { nom:nomTresLong, rang:"boss", versions:CATALOGUE.monstres[1].versions.slice(0, 1) }] });
  const sourceLongue = (await longue.executer("fiche_monstre", { nom:"shakeera" })).source;
  assert.match(sourceLongue, /^fiche monstre Shakeera.*… · données du jeu du 24\/09\/2026$/,
    "le nom est coupé, la date jamais");
  assert.ok(Array.from(sourceLongue).length <= 90, "une source tient dans la ligne Sources");

  /* Une resistance de base negative garde son signe : l'Esprit du feu a
     Feu −100 %, pas « Feu 100 % », qu'un membre lirait comme une immunite. */
  const base = CATALOGUE.monstres[1].versions[0];
  const avecResistances = (nom, resistances) => outils({ version:1, dateExport:"2026-09-24",
    monstres:[{ nom, rang:"normal", versions:[Object.assign({}, base, {
      stats:Object.assign({}, base.stats, { resistances }) })] }] });
  const esprit = await avecResistances("Esprit du feu", { Default:1000, Thunder:1000, Wind:1000,
    Fire:-10000, Ice:1000, Earth:1000, Dark:1000, Holy:1000 }).executer("fiche_monstre", { nom:"esprit" });
  assert.equal(esprit.donnees.versions[0].resistanceElementaireBase,
    "Physique 10 %, Foudre 10 %, Vent 10 %, Feu −100 %, Glace 10 %, Terre 10 %, Ténèbres 10 %, Sacré 10 %");
  const affaibli = await avecResistances("Golem affaibli", { Default:-1000, Thunder:-1000, Wind:-1000,
    Fire:-1000, Ice:-1000, Earth:-1000, Dark:-1000, Holy:-1000 }).executer("fiche_monstre", { nom:"golem" });
  assert.equal(affaibli.donnees.versions[0].resistanceElementaireBase, "−10 % sur tous les éléments");

  /* Plafond : 5 versions, le total, et le rappel du filtre. */
  const nombreuses = outils({ version:1, dateExport:"2026-09-24", monstres:[{
    nom:"Monstre des abysses", rang:"normal",
    versions:Array.from({ length:7 }, (_, rangVersion) => Object.assign({},
      CATALOGUE.monstres[2].versions[0], { acteurs:[String(rangVersion)] }))
  }] });
  const abysses = await nombreuses.executer("fiche_monstre", { nom:"abysses" });
  assert.equal(abysses.donnees.total, 7);
  assert.equal(abysses.donnees.versions.length, 5);
  assert.match(abysses.donnees.suite, /contexte/);

  /* ---------------- chercher_monstres ---------------- */
  const sacre = await o.executer("chercher_monstres", { element:"sacré" });
  assert.equal(sacre.donnees.element, "Sacré");
  assert.equal(sacre.donnees.total, 3);
  assert.deepEqual(sacre.donnees.monstres.map(m => [m.nom, m.faiblesse, m.contextes[0]]), [
    ["Démon rouge", "+30 %", "Cross Challenge"],
    ["Démon rouge", "+20 %", "Boss de terrain"],
    ["Démon rouge", "+20 %", sacre.donnees.monstres[2].contextes[0]]
  ]);
  assert.match(sacre.donnees.monstres[2].contextes[0], /^Donjon :/);
  assert.equal(sacre.source, "monstres faibles à Sacré · données du jeu du 24/09/2026");
  /* Les versions confirmees en jeu passent devant celles sans contexte, meme
     plus faibles ; un nom sans aucune lettre (« ??? », nom provisoire du jeu)
     n'est jamais recommande — il reste consultable par fiche_monstre. */
  const sansContexte = (nom, faiblesse) => ({ nom, rang:"boss", versions:[Object.assign({},
    CATALOGUE.monstres[2].versions[0], { rang:"boss", stats:Object.assign({},
      CATALOGUE.monstres[2].versions[0].stats, { faiblesses:Object.assign({},
        CATALOGUE.monstres[2].versions[0].stats.faiblesses, { Holy:faiblesse }) }) })] });
  const bruit = outils({ version:1, dateExport:"2026-09-24", monstres:[
    sansContexte("???", 5000), sansContexte("Bête inconnue", 4000), CATALOGUE.monstres[1]] });
  const tri = await bruit.executer("chercher_monstres", { element:"sacré" });
  assert.deepEqual(tri.donnees.monstres.map(m => m.nom + " " + m.faiblesse),
    ["Démon rouge +30 %", "Démon rouge +20 %", "Démon rouge +20 %", "Bête inconnue +40 %"]);
  assert.equal(tri.donnees.total, 4);

  const anglais = await o.executer("chercher_monstres", { element:"Holy" });
  assert.equal(anglais.donnees.element, "Sacré", "le code anglais du jeu est compris");
  const foudre = await o.executer("chercher_monstres", { element:"foudre", rang:"tous" });
  assert.deepEqual([foudre.donnees.total, foudre.donnees.monstres], [0, []]);
  /* Synonymes d'elements : chaque refus coutait a Gemini un tour sur cinq. */
  const lumiere = await o.executer("chercher_monstres", { element:"lumière" });
  assert.equal(lumiere.donnees.element, "Sacré");
  assert.equal((await o.executer("chercher_monstres", { element:"light" })).donnees.element, "Sacré");
  assert.equal((await o.executer("chercher_monstres", { element:"lightning" })).donnees.element, "Foudre");
  assert.equal((await o.executer("chercher_monstres", { element:"éclair" })).donnees.element, "Foudre");
  assert.equal((await o.executer("chercher_monstres", { element:"physical" })).donnees.element, "Physique");
  assert.equal((await o.executer("chercher_monstres", { element:"ombre" })).donnees.element, "Ténèbres");
  const inconnuElement = await o.executer("chercher_monstres", { element:"arc-en-ciel" });
  assert.equal(inconnuElement.donnees.erreur, "élément inconnu");
  assert.equal(inconnuElement.donnees.elements.length, 8);
  /* Synonymes de contextes, anglais compris. */
  const dungeon = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"dungeon" });
  assert.match(dungeon.donnees.versions[0].contextes[0], /^Donjon :/);
  const fieldBoss = await o.executer("fiche_monstre", { nom:"demon rouge", contexte:"field boss" });
  assert.equal(fieldBoss.donnees.versions[0].contextes[0], "Boss de terrain");
  const guild = await o.executer("fiche_monstre", { nom:"akumu", contexte:"guild" });
  assert.equal(guild.donnees.paliers, "1 à 30");
  const rangInconnu = await o.executer("chercher_monstres", { element:"feu", rang:"champion" });
  assert.equal(rangInconnu.donnees.erreur, "rang inconnu : boss, élite ou tous");

  /* ---------------- Catalogue indisponible ---------------- */
  const absent = outils(null);
  assert.deepEqual((await absent.executer("fiche_monstre", { nom:"x" })).donnees,
    { erreur:"données des monstres indisponibles" });
  assert.deepEqual((await absent.executer("chercher_monstres", { element:"feu" })).donnees,
    { erreur:"données des monstres indisponibles" });

  console.log("OK discord-jarvis-monstres");
}

main().catch(erreur => { console.error(erreur); process.exit(1); });
