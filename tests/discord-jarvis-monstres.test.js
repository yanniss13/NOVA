"use strict";

/* Les monstres de /jarvis : le lecteur du bucket prive (faux fetch, fausse
   horloge) et les deux outils, sur un catalogue fabrique par la VRAIE
   extraction a partir du mini-export de tests/monstres-jarvis.test.js. Les
   formes ne peuvent donc pas diverger entre l'extracteur et le bot. */

const assert = require("node:assert/strict");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const M = require(path.join(ROOT, "supabase", "functions", "_shared", "discord-jarvis-monstres.js"));
const { construireCatalogueMonstres } = require(path.join(ROOT, "outils", "fabrication", "monstres-jarvis.js"));
const { ENTREE_MONSTRES_TEST } = require("./monstres-jarvis.test.js");

const CATALOGUE = construireCatalogueMonstres(ENTREE_MONSTRES_TEST);

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

function reponse(status, corps) {
  return { ok:status >= 200 && status < 300, status,
    json:async () => { if(corps instanceof Error) throw corps; return corps; } };
}

async function main() {
  /* ---------------- Declarations ---------------- */
  assert.deepEqual(M.DECLARATIONS_OUTILS_MONSTRES.map(d => d.name), ["fiche_monstre", "chercher_monstres"]);
  M.DECLARATIONS_OUTILS_MONSTRES.forEach(d => assert.equal(d.parameters.type, "OBJECT"));
  assert.equal(M.CHEMIN_MONSTRES_JARVIS, "jarvis-prive/monstres.json");

  /* ---------------- Lecteur du bucket ---------------- */
  let instant = 0;
  const appels = [];
  let suite = [reponse(200, CATALOGUE)];
  const lire = M.creerLecteurMonstresJarvis({
    url:"https://x.supabase.co/storage/v1/object/jarvis-prive/monstres.json",
    cle:"service-role", horloge:() => instant,
    fetch:async (url, init) => { appels.push({ url, init }); return suite.shift(); }
  });
  assert.equal(await lire(), CATALOGUE);
  assert.equal(appels[0].init.headers.Authorization, "Bearer service-role");
  assert.equal(appels[0].init.headers.apikey, "service-role");
  instant = 3_599_999;
  assert.equal(await lire(), CATALOGUE, "gardé une heure");
  assert.equal(appels.length, 1);
  instant = 3_600_001;
  suite = [reponse(404, {})];
  assert.equal(await lire(), null, "après l'heure, relu ; un 404 rend null");
  assert.equal(appels.length, 2);
  instant += 59_999;
  assert.equal(await lire(), null, "l'échec est gardé une minute");
  assert.equal(appels.length, 2);
  instant += 2;
  suite = [reponse(200, { version:2, monstres:[] })];
  assert.equal(await lire(), null, "format inconnu refusé");
  instant += 60_001;
  suite = [reponse(200, new SyntaxError("JSON tronqué"))];
  assert.equal(await lire(), null, "JSON illisible refusé");
  instant += 60_001;
  suite = [new TypeError("réseau")];
  const lireReseau = M.creerLecteurMonstresJarvis({ url:"u", cle:"c", horloge:() => 0,
    fetch:async () => { throw new TypeError("réseau"); } });
  assert.equal(await lireReseau(), null, "stockage injoignable : null, pas d'exception");
  const sansConfig = M.creerLecteurMonstresJarvis({ url:"", cle:"", horloge:() => 0,
    fetch:async () => { throw new Error("ne doit pas être appelé"); } });
  assert.equal(await sansConfig(), null);

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
     Sans niveau demande, on garde les versions hors paliers ET le premier
     et le dernier palier : jamais la version hors paliers a la place du 1. */
  const akumuMixte = outils({ version:1, dateExport:"2026-09-24", monstres:[{
    nom:"Akumu, bête démoniaque", rang:"boss",
    versions:[Object.assign({}, CATALOGUE.monstres[2].versions[0], { rang:"boss", acteurs:["51300084"] }),
      ...CATALOGUE.monstres[0].versions]
  }] });
  const mixte = await akumuMixte.executer("fiche_monstre", { nom:"akumu" });
  assert.deepEqual(mixte.donnees.versions.map(v => v.niveau), [undefined, 1, 30]);
  assert.equal(mixte.donnees.versions[0].nonConfirme, true);
  assert.equal(mixte.donnees.paliers, "1 à 30");
  const mixte30 = await akumuMixte.executer("fiche_monstre", { nom:"akumu", niveau:30 });
  assert.deepEqual(mixte30.donnees.versions.map(v => v.niveau), [30],
    "un niveau demande ne garde que ce palier");

  const lapin = await o.executer("fiche_monstre", { nom:"lapin" });
  assert.equal(lapin.donnees.versions[0].nonConfirme, true);
  assert.deepEqual(lapin.donnees.versions[0].contextes, ["présent dans les fichiers, contexte non retrouvé"]);
  assert.equal(lapin.donnees.versions[0].resistanceElementaireBase, "aucune");
  assert.equal(lapin.donnees.versions[0].puissanceRecommandee, undefined);

  const inconnu = await o.executer("fiche_monstre", { nom:"Démon roux" });
  assert.equal(inconnu.donnees.introuvable, "Démon roux");
  assert.ok(inconnu.donnees.proches.includes("Démon rouge"));

  /* Nom trop vague : la meilleure correspondance, et les autres nommées. */
  const vague = outils({ version:1, dateExport:"2026-09-24", monstres:[
    { nom:"Démon gris", rang:"boss", versions:CATALOGUE.monstres[1].versions.slice(0, 1) },
    CATALOGUE.monstres[1]
  ] });
  const demon = await vague.executer("fiche_monstre", { nom:"démon" });
  assert.equal(demon.donnees.nom, "Démon gris");
  assert.deepEqual(demon.donnees.autresCorrespondances, ["Démon rouge"]);

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
  const anglais = await o.executer("chercher_monstres", { element:"Holy" });
  assert.equal(anglais.donnees.element, "Sacré", "le code anglais du jeu est compris");
  const foudre = await o.executer("chercher_monstres", { element:"foudre", rang:"tous" });
  assert.deepEqual([foudre.donnees.total, foudre.donnees.monstres], [0, []]);
  const lumiere = await o.executer("chercher_monstres", { element:"lumière" });
  assert.equal(lumiere.donnees.erreur, "élément inconnu");
  assert.equal(lumiere.donnees.elements.length, 8);
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
